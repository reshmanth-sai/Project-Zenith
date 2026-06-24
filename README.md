# Scope Radar & Satellite Observatory Dome

An advanced full-stack celestial tracking and observation application designed for real-time tracking of planets, artificial satellites, and the International Space Station (ISS). This system merges high-precision coordinate math with high-fidelity, polar-radar style telemetry visualizations.

---

## 🌌 System Overview

The applet provides a professional dashboard designed to project the position of orbiting artificial satellites and planetary objects relative to an observer at any given location on Earth. Users can manipulate their geographic coordinates, adjust local simulation time-dilation multipliers, and immediately bind spectral telemetry streams for any target.

At its core, the application integrates orbital mechanics engines (`satellite.js` and `astronomy-engine`) on a lightweight Node/Express backend that proxies real-time satellite orbital parameters directly from global space registries such as **CelesTrak**.

---

## 🚀 Core Features

1. **Polar Radar Planisphere (`SkyView.tsx`)**:
   - A unified rotating circular radar projection where the center maps directly to the zenith (90° overhead) and the extreme outer edge maps to the local horizon (0° elevation).
   - Draws dynamic concentric altitude guidelines (15°, 30°, 45°, 60°, and 75° elevation) and 10° high-fidelity azimuth tick markers.
   - Features a continuous sweeping green laser radar line representing active signal sweep routines.
   - Plotted targets dynamically respond to hover and click inputs, lighting up advanced telemetry reticles.

2. **Orthographic Observer Globe (`Globe.tsx`)**:
   - A Leaflet-powered global tracker mapped to the observer's location with circular horizon radii.
   - Renders live orbital lines representing previous and future ground tracks.
   - Features dynamic vector icons projecting current NADIR (sub-lat/lng) positions.

3. **Intelligent Directory List & Sliding Telemetry Panel (`ObjectPanel.tsx`)**:
   - A dual-column telemetry drawer that slides open with smooth spring transitions (`motion`).
   - Computes live physics values like **Orbital Velocity** in real-time (km/h and km/s conversions).
   - Converts raw azimuth angles to localized direction bearings (e.g., `NNE`, `SW`, `ESE`).
   - Renders active lock states, NADIR coordinates, or Right Ascension and Declination parameters.

---

## 🛠️ Project Setup & Installation

Follow these steps to launch the system locally or inside container environments:

### Prerequisites
- **Node.js**: `v18` or higher
- **package manager**: `npm`

### Installation Commands

1. **Install required dependencies**:
   ```bash
   npm install
   ```

2. **Establish Environment Variables**:
   Create a `.env` file at the root. The applet automatically utilizes standard environment fallback setups, but sensitive APIs should be declared here:
   ```env
   PORT=3000
   NODE_ENV=development
   GEMINI_API_KEY=your-api-key-here
   ```

3. **Fire up the Development Server**:
   ```bash
   npm run dev
   ```
   *This starts the `tsx`-wrapped Express server locally on port 3000.*

4. **Compile Production Bundle**:
   The build command compiles the static React client with Vite while bundling the TypeScript backend into a compressed CommonJS production server using **esbuild**:
   ```bash
   npm run build
   ```

5. **Start Production Instance**:
   Run the pre-compiled production file:
   ```bash
   npm run start
   ```

---

## 🗃️ Dependency Architecture

The application depends on highly stable and validated scientific math libraries:

### Main Operational Packages:
- **`satellite.js` (`^7.0.1`)**: Employs standard orbital propagation routines (SGP4/SDP4 models) based on CelesTrak's Three-Line/Two-Line Elements (TLEs). It transforms raw orbital characteristics into geodetic latitude/longitude parameters and computes exact range distances relative to the observer's horizon.
- **`astronomy-engine` (`^2.1.19`)**: Computes topocentric horizontal coordinates (Altitude & Azimuth), Right Ascension (RA), and Declination (Dec) of major solar system bodies (Mars, Jupiter, Saturn, Venus, and the Moon) relative to any latitude/longitude observer position and UTC timestamp.
- **`leaflet` / `react-leaflet` (`^5.0.0`)**: Powers the interactive geo-canvas projecting the planetary map, current observer location, and current Nadir projections of moving objects.
- **`motion` (`^12.23.24`)**: Configures spring micro-interactions and seamless side-panel entry transitions.
- **`lucide-react`**: Standardized, pixel-perfect vector icons for systemic controls.

---

## 📡 Real-Time Data Pipeline & Synchronization

```
 [ Space Catalogs (CelesTrak / Keep-Alive API) ]
                     │
                     ▼  (Express Server API Proxies)
        [ /api/satellites | /api/iss ]
                     │
     (Local propagation via satellite.js)
                     │
                     ▼  (Client React State)
 [ Active Coordinate Inputs / Clock Speed Multiplier ]
                     │
    (Local Topocentric Horizontal Conversions)
                     │
      ┌──────────────┴──────────────┐
      ▼                             ▼
[ Globe.tsx: Leaflet Map ]     [ SkyView.tsx: Radar Dome ]
```

### 1. Data Retrieval & TLE Propagation
The application bypasses unstable external client requests by proxying through the Express server. 
- When the backend receives a query on `/api/satellites`, it fetches active catalog sets (such as Earth science, weather, and communication fleets) from CelesTrak.
- It parses these TLE datasets into standard `satellite.twoline2satrec()` records, propagating position coordinates (`satellite.propagate()`) using the client-synchronized simulation time.

### 2. Observer Coordinates & Time-Dilation Math
When an observer adjusts their coordinates (using the map clicks or manual numerical inputs) or accelerates simulation time (up to 120x normal speed), the synchronized coordinate pipeline recalculates:
- **Azimuth & Elevation**: Converts Earth-Centered Inertial (ECI) coordinates to Earth-Centered Earth-Fixed (ECEF) coordinates, subsequently projecting them down to the observer's localized horizon grid.
- **Horizon Filtering**: Objects carrying an calculated altitude below `0°` (indicating they are below the observer's horizon line) are automatically filtered out of the radar domes to preserve astronomical accuracy.

---

## 🎨 UI/UX Design Philosophy

Our interface matches the look and feel of modern professional astronomical observatories:

- **Swiss-Modernist Grid & Typography**:
  We pair the clean geometric sans-serif **Inter** layout with a dense monospaced typeface (**JetBrains Mono**) to display numbers, degrees, and catalog designations.
- **High-Contrast Dark Aesthetic**:
  Designed around Deep Indigo and Slate shades (`bg-slate-950/50`, `border-slate-800/80`), using emerald glow filters (`filter="url(#neon-green)"`) to simulate real telescope radar feeds. This increases ambient contrast and prevents eye strain.
- **Zero Tech-Larping**:
  All telemetry fields represent actual physical values. We strictly avoid using empty mock lines, terminal filler logs, or generic sci-fi clutter. Every line of data is traceable to active satellite physics or planetary orbital trajectories.
- **Fluid Layout Boundaries**:
  Utilizes robust `ResizeObserver` limits rather than rigid JS-based pixel variables, ensuring the circular radar and map frames scale gracefully across standard monitors and mobile views.
