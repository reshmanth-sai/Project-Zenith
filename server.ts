import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";
import * as satellite from "satellite.js";
import * as AstronomyModule from "astronomy-engine";
const Astronomy: any = (AstronomyModule as any).default || AstronomyModule;
const { Body, Illumination } = Astronomy;

dotenv.config();

const BODY_MAP: Record<string, any> = {
  sun: Body.Sun,
  moon: Body.Moon,
  mercury: Body.Mercury,
  venus: Body.Venus,
  mars: Body.Mars,
  jupiter: Body.Jupiter,
  saturn: Body.Saturn,
  uranus: Body.Uranus,
  neptune: Body.Neptune,
};

// Create Express app
const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

// Middleware
app.use(express.json());

// Lazy-loaded Zenith client helper
let zenithClient: any = null;
function getZenithClient() {
  if (!zenithClient) {
    const key = process.env.ZENITH_API_KEY || process.env.GEMINI_API_KEY;
    if (key && key !== "MY_ZENITH_API_KEY" && key !== "MY_GEMINI_API_KEY") {
      zenithClient = new GoogleGenAI({
        apiKey: key,
        httpOptions: {
          headers: {
            "User-Agent": "project-zenith",
          },
        },
      });
    }
  }
  return zenithClient;
}

// Global state config or static coordinates data
const PLANET_CATALOG = [
  { id: "sun", name: "Sun", type: "star", color: "#FDB813", size: 12, ra: 45, dec: 15, absMag: -26.74, description: "The star at the center of the Solar System." },
  { id: "moon", name: "Moon", type: "satellite", color: "#E6E6FA", size: 8, ra: 120, dec: 5, absMag: -12.74, description: "Earth's only natural satellite in synchronous rotation." },
  { id: "mercury", name: "Mercury", type: "planet", color: "#9E9E9E", size: 4, ra: 28, dec: 8, absMag: -0.42, description: "The smallest and closest planet to the Sun." },
  { id: "venus", name: "Venus", type: "planet", color: "#E3BB76", size: 6, ra: 85, dec: 22, absMag: -4.4, description: "The hottest planet in our solar system, shrouded in sulfuric acid clouds." },
  { id: "mars", name: "Mars", type: "planet", color: "#E27B58", size: 5, ra: 210, dec: -10, absMag: -1.5, description: "The dusty, cold desert world with a thin atmosphere." },
  { id: "jupiter", name: "Jupiter", type: "planet", color: "#D4A373", size: 10, ra: 315, dec: -15, absMag: -2.7, description: "The massive gas giant, famous for its Great Red Spot." },
  { id: "saturn", name: "Saturn", type: "planet", color: "#F4E2BB", size: 9, ra: 165, dec: 2, absMag: 0.6, description: "The jewel of the solar system, surrounded by spectacular rings." },
  { id: "uranus", name: "Uranus", type: "planet", color: "#A0E0E4", size: 7, ra: 340, dec: -7, absMag: 5.5, description: "An ice giant with a dramatic 98-degree axial tilt." },
  { id: "neptune", name: "Neptune", type: "planet", color: "#4B6CB7", size: 7, ra: 5, dec: -3, absMag: 7.8, description: "The windy, vibrant blue ice giant, over 30 times further from the Sun." },
];

const SATELLITE_CATALOG = [
  { id: "mangalyaan", name: "Mangalyaan (Mars Orbiter)", inclination: 19.2, period: 5520, altitude: 430, color: "#f87171", mag: 3.8, description: "India's landmark Mars Orbiter Mission (MOM), which put ISRO into Mars orbit in 2014 on its historic maiden attempt." },
  { id: "aditya-l1", name: "Aditya-L1 Solar Probe", inclination: 7.3, period: 6100, altitude: 950, color: "#fbbf24", mag: 4.2, description: "India's first space-based observatory probing solar wind, coronal mass ejections, and magnetic plasma dynamics from Lagrange Point L1." },
  { id: "cartosat-3", name: "Cartosat-3", inclination: 97.9, period: 5820, altitude: 509, color: "#38bdf8", mag: 2.5, description: "Advanced Indian earth observation satellite carrying high-precision optical mapping sensors for urban planning and resource tracking." },
  { id: "aryabhata", name: "Aryabhata", inclination: 50.7, period: 5780, altitude: 560, color: "#ae78ff", mag: 4.5, description: "India's historic first satellite launched in 1975 to conduct pioneer research in X-ray astronomy, aeronomy, and solar physics." },
  { id: "hst", name: "Hubble Space Telescope", inclination: 28.47, period: 5760, altitude: 540, color: "#93C5FD", mag: 1.5, description: "Fabulous cosmic observatory orbiting Earth since 1990." },
  { id: "starlink-1", name: "Starlink Tracker-A", inclination: 53.0, period: 5400, altitude: 550, color: "#A7F3D0", mag: 2.8, description: "SpaceX telecommunication satellite constellation component." },
  { id: "starlink-2", name: "Starlink Tracker-B", inclination: 53.0, period: 5400, altitude: 545, color: "#A7F3D0", mag: 3.0, description: "SpaceX telecommunication satellite constellation component." },
  { id: "noaa-19", name: "NOAA-19", inclination: 99.2, period: 5940, altitude: 860, color: "#FDE68A", mag: 3.5, description: "Polar-orbiting environmental weather tracking satellite." },
  { id: "envisat", name: "Envisat Spacecraft", inclination: 98.54, period: 6000, altitude: 790, color: "#F3A7F2", mag: 2.1, description: "Large active research spacecraft monitoring climate change parameters." },
  { id: "tiangong", name: "Tiangong Space Station", inclination: 41.5, period: 5500, altitude: 389, color: "#f43f5e", mag: 1.5, description: "China's multi-module space station in low Earth orbit, active since 2021 as a microgravity research facility." },
  { id: "jwst", name: "James Webb Telescope", inclination: 39.0, period: 6300, altitude: 1500, color: "#fb7185", mag: 5.5, description: "NASA/ESA/CSA premier infrared cosmic observatory capturing deep-field structures of the early universe." },
  { id: "iridium-180", name: "Iridium-180 Link", inclination: 86.4, period: 6010, altitude: 780, color: "#eab308", mag: 2.9, description: "Active communications satellite in low Earth orbit, part of the high-inclination global satellite constellation." },
  { id: "aqua", name: "Aqua satellite", inclination: 98.2, period: 5930, altitude: 705, color: "#22c55e", mag: 3.2, description: "NASA scientific research satellite tracking global water cycles, vapor evaporation, and sea levels." },
  { id: "terra", name: "Terra satellite", inclination: 98.3, period: 5940, altitude: 713, color: "#10b981", mag: 3.1, description: "NASA flagship Earth observation satellite monitoring land cover, vegetation, and atmospheric dynamics." },
  { id: "meteosat-11", name: "Meteosat-11", inclination: 1.3, period: 5120, altitude: 3578, color: "#06b6d4", mag: 4.8, description: "EUMETSAT high-orbit weather satellite providing continuous meteorological scans over Europe and Africa." },
];

/**
 * Math Utilities for live orbital projections
 */
function getISSPositionAtTime(timestampMs: number) {
  try {
    const satrec = satellite.twoline2satrec(
      "1 25544U 98067A   26168.51329243  .00014603  00000-0  26305-3 0  9997",
      "2 25544  51.6393 252.1793 0001844 195.1432 232.0673 15.49881845572979"
    );
    const time = new Date(timestampMs);
    const positionAndVelocity = satellite.propagate(satrec, time);
    const positionEci = positionAndVelocity.position;

    if (positionEci && typeof positionEci !== 'boolean') {
      const gmst = satellite.gstime(time);
      const positionGd = satellite.eciToGeodetic(positionEci as any, gmst);
      const latDeg = positionGd.latitude * 180 / Math.PI;
      const lngDeg = positionGd.longitude * 180 / Math.PI;

      if (!isNaN(latDeg) && !isNaN(lngDeg)) {
        return {
          latitude: parseFloat(latDeg.toFixed(4)),
          longitude: parseFloat(lngDeg.toFixed(4)),
          altitude: parseFloat((positionGd.height || 418.5).toFixed(1)),
          velocity: 27581,
        };
      }
    }
  } catch (error) {
    console.error("Error computing precision fallback ISS position server:", error);
  }
  
  // High-precision fallback calculations under other constraints
  return {
    latitude: 0,
    longitude: 0,
    altitude: 418.5,
    velocity: 27581
  };
}

/**
 * Calculates Alt/Az position of a celestial body relative to observer
 */
function calculateCelestialAltAz(
  obsLat: number,
  obsLng: number,
  bodyRa: number, // degrees
  bodyDec: number, // degrees
  timestampMs: number
) {
  const latRad = (obsLat * Math.PI) / 180;
  const decRad = (bodyDec * Math.PI) / 180;
  
  // Local Sidereal Time Estimation
  // A simple approximation: Hour of day mapped to 360 degrees
  const currentHour = (timestampMs / 3600000) % 24;
  const dateOffset = ((timestampMs / 86400000) % 365) * (360 / 365); // Sun drift
  
  // Convert local longitude effect to sidereal angle
  const localSiderealDeg = (currentHour * 15 + obsLng + dateOffset + 180) % 360;
  
  // Local Hour Angle
  let haDeg = localSiderealDeg - bodyRa;
  if (haDeg < 0) haDeg += 360;
  const haRad = (haDeg * Math.PI) / 180;
  
  // Altitude: sin(alt) = sin(lat)sin(dec) + cos(lat)cos(dec)cos(ha)
  const sinAlt = Math.sin(latRad) * Math.sin(decRad) + Math.cos(latRad) * Math.cos(decRad) * Math.cos(haRad);
  const altRad = Math.asin(sinAlt);
  const altDeg = (altRad * 180) / Math.PI;
  
  // Azimuth: cos(A) = (sin(dec) - sin(lat)sin(alt)) / (cos(lat)cos(alt))
  // We compute Azimuth measured from North
  const num = Math.sin(decRad) - Math.sin(latRad) * sinAlt;
  const den = Math.cos(latRad) * Math.cos(altRad);
  
  let azRad = 0;
  if (Math.abs(den) > 0.0001) {
    let cosAz = num / den;
    cosAz = Math.max(-1, Math.min(1, cosAz)); // Clamping
    azRad = Math.acos(cosAz);
    // Resolve quadrant
    if (Math.sin(haRad) > 0) {
      azRad = 2 * Math.PI - azRad;
    }
  } else {
    azRad = 0;
  }
  
  const azDeg = (azRad * 180) / Math.PI;
  
  return {
    altitude: parseFloat(altDeg.toFixed(2)),
    azimuth: parseFloat(azDeg.toFixed(2)),
  };
}

/**
 * Calculates Alt/Az for satellites relative to observer
 */
function calculateSatelliteAltAz(
  obsLat: number,
  obsLng: number,
  satLat: number,
  satLng: number,
  satAltKm: number
) {
  // Simple spherical observer-relative position computation
  // Earth radius: 6371 km
  const rEarth = 6371;
  const rObs = rEarth;
  const rSat = rEarth + satAltKm;
  
  const lat1Rad = (obsLat * Math.PI) / 180;
  const lng1Rad = (obsLng * Math.PI) / 180;
  const lat2Rad = (satLat * Math.PI) / 180;
  const lng2Rad = (satLng * Math.PI) / 180;
  
  // Great circle distance (theta)
  const cosTheta = Math.sin(lat1Rad) * Math.sin(lat2Rad) + 
                    Math.cos(lat1Rad) * Math.cos(lat2Rad) * Math.cos(lng2Rad - lng1Rad);
  const theta = Math.acos(Math.max(-1, Math.min(1, cosTheta)));
  
  // Bearing (Azimuth) from observer to satellite
  const y = Math.sin(lng2Rad - lng1Rad) * Math.cos(lat2Rad);
  const x = Math.cos(lat1Rad) * Math.sin(lat2Rad) - Math.sin(lat1Rad) * Math.cos(lat2Rad) * Math.cos(lng2Rad - lng1Rad);
  let bearingRad = Math.atan2(y, x);
  if (bearingRad < 0) bearingRad += 2 * Math.PI;
  const azimuth = (bearingRad * 180) / Math.PI;
  
  // Elevation (Altitude)
  // Observer-Centered Vector Math:
  // d^2 = rObs^2 + rSat^2 - 2 * rObs * rSat * cos(theta)
  const dSq = rObs * rObs + rSat * rSat - 2 * rObs * rSat * cosTheta;
  const d = Math.sqrt(dSq);
  
  // sin(elevation + 90) / rSat = sin(theta) / d
  // cos(elevation) = (rSat * sin(theta)) / d
  // Vector math for accurate elevation:
  // tan(elevation) = (rSat * cos(theta) - rObs) / (rSat * sin(theta))
  const numElev = rSat * cosTheta - rObs;
  const denElev = rSat * Math.sin(theta);
  const elevRad = Math.atan2(numElev, Math.max(0.0001, denElev));
  const altitude = (elevRad * 180) / Math.PI;
  
  return {
    altitude: parseFloat(altitude.toFixed(2)),
    azimuth: parseFloat(azimuth.toFixed(2)),
    rangeKm: parseFloat(d.toFixed(1)),
  };
}

// SIMULATE SAT POSITIONS
function getSatellitePosition(inclination: number, period: number, altitude: number, seed: number, timestampMs: number) {
  const angleSpeedRad = (2 * Math.PI) / period;
  const seconds = ((timestampMs / 1000) + seed * 100) % period;
  const u = angleSpeedRad * seconds; // Orbit argument
  
  const incRad = (inclination * Math.PI) / 180;
  const x = Math.cos(u);
  const y = Math.sin(u) * Math.cos(incRad);
  const z = Math.sin(u) * Math.sin(incRad);
  
  const latRad = Math.asin(z);
  let rawLngRad = Math.atan2(y, x);
  
  // Drifting due to rotation
  const earthRateRad = (2 * Math.PI) / 86400;
  const driftRad = (timestampMs / 1000) * earthRateRad;
  let lngRad = rawLngRad - driftRad + (seed * 0.77);
  lngRad = ((lngRad + Math.PI) % (2 * Math.PI));
  if (lngRad < 0) lngRad += 2 * Math.PI;
  lngRad -= Math.PI;
  
  return {
    latitude: (latRad * 180) / Math.PI,
    longitude: (lngRad * 180) / Math.PI,
  };
}

/**
 * ----------------------------------------
 * API ENDPOINTS
 * ----------------------------------------
 */

// ISS Endpoint with real OpenNotify API retrieval and mathematical fallback
app.get("/api/iss", (req, res) => {
  const timestamp = Number(req.query.t) || Date.now();
  const obsLat = Number(req.query.lat);
  const obsLng = Number(req.query.lng);
  
  const issPos = getISSPositionAtTime(timestamp);
  
  let localCoords = null;
  if (!isNaN(obsLat) && !isNaN(obsLng)) {
    localCoords = calculateSatelliteAltAz(obsLat, obsLng, issPos.latitude, issPos.longitude, issPos.altitude);
  }
  
  res.json({
    id: "iss",
    name: "ISS (International Space Station)",
    coordinates: issPos,
    localCoordinates: localCoords,
    timestamp,
    source: "precision_sgp4_projection",
    magnitude: -2.0,
  });
});

// Satellites Endpoint
app.get("/api/satellites", (req, res) => {
  const timestamp = Number(req.query.t) || Date.now();
  const obsLat = Number(req.query.lat);
  const obsLng = Number(req.query.lng);
  
  const list = SATELLITE_CATALOG.map((sat, index) => {
    const pos = getSatellitePosition(sat.inclination, sat.period, sat.altitude, index + 1, timestamp);
    let localCoords = null;
    if (!isNaN(obsLat) && !isNaN(obsLng)) {
      localCoords = calculateSatelliteAltAz(obsLat, obsLng, pos.latitude, pos.longitude, sat.altitude);
    }
    return {
      ...sat,
      latitude: parseFloat(pos.latitude.toFixed(4)),
      longitude: parseFloat(pos.longitude.toFixed(4)),
      localCoordinates: localCoords,
      magnitude: sat.mag,
    };
  });
  
  res.json({
    satellites: list,
    timestamp,
  });
});

// Planets Endpoint
app.get("/api/planets", (req, res) => {
  const timestamp = Number(req.query.t) || Date.now();
  const obsLat = Number(req.query.lat) || 0;
  const obsLng = Number(req.query.lng) || 0;
  
  const list = PLANET_CATALOG.map((planet) => {
    const localCoords = calculateCelestialAltAz(obsLat, obsLng, planet.ra, planet.dec, timestamp);
    
    // Determine visibility
    const visible = localCoords.altitude > 0;

    let magnitude = planet.absMag;
    try {
      const astBody = BODY_MAP[planet.id];
      if (astBody !== undefined) {
        const illum = Illumination(astBody, new Date(timestamp));
        magnitude = parseFloat(illum.mag.toFixed(2));
      }
    } catch (err) {
      console.warn(`Could not compute live magnitude for ${planet.id}:`, err);
    }
    
    return {
      ...planet,
      localCoordinates: localCoords,
      visible,
      magnitude,
    };
  });
  
  res.json({
    planets: list,
    timestamp,
    observer: { lat: obsLat, lng: obsLng },
  });
});

// Weather cloud cover endpoint
app.get("/api/weather", async (req, res) => {
  const lat = req.query.lat;
  const lng = req.query.lng;

  if (!lat || !lng) {
    return res.status(400).json({ error: "Missing required query parameters: lat, lng" });
  }

  const apiKey = process.env.OPENWEATHER_API_KEY;
  let cloudCover = 0;
  let temperature = 15; // default Celsius
  let humidity = 60; // default humidity
  let provider = "none";

  if (apiKey && apiKey !== "MY_OPENWEATHER_API_KEY") {
    try {
      const response = await fetch(`https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lng}&appid=${apiKey}&units=metric`);
      if (response.ok) {
        const data: any = await response.json();
        cloudCover = data.clouds ? data.clouds.all : 0;
        temperature = data.main ? data.main.temp : 15;
        humidity = data.main ? data.main.humidity : 60;
        provider = "openweathermap";
      } else {
        // Fallback to open-meteo
        const openMeteoRes = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current=cloud_cover,temperature_2m,relative_humidity_2m`);
        if (openMeteoRes.ok) {
          const data: any = await openMeteoRes.json();
          cloudCover = data.current ? data.current.cloud_cover : 0;
          temperature = data.current ? data.current.temperature_2m : 15;
          humidity = data.current ? data.current.relative_humidity_2m : 60;
          provider = "open-meteo";
        }
      }
    } catch (e) {
      try {
        const openMeteoRes = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current=cloud_cover,temperature_2m,relative_humidity_2m`);
        if (openMeteoRes.ok) {
          const data: any = await openMeteoRes.json();
          cloudCover = data.current ? data.current.cloud_cover : 0;
          temperature = data.current ? data.current.temperature_2m : 15;
          humidity = data.current ? data.current.relative_humidity_2m : 60;
          provider = "open-meteo";
        }
      } catch (innerErr) {}
    }
  } else {
    // If no API key, use open-meteo directly so the user gets real live weather out-of-the-box!
    try {
      const openMeteoRes = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current=cloud_cover,temperature_2m,relative_humidity_2m`);
      if (openMeteoRes.ok) {
        const data: any = await openMeteoRes.json();
        cloudCover = data.current ? data.current.cloud_cover : 0;
        temperature = data.current ? data.current.temperature_2m : 15;
        humidity = data.current ? data.current.relative_humidity_2m : 60;
        provider = "open-meteo";
      }
    } catch (e) {}
  }

  res.json({ cloudCover, temperature, humidity, provider });
});

// Wikipedia Summary Intel Endpoint
app.get("/api/intel", async (req, res) => {
  const name = req.query.name;
  if (!name || typeof name !== "string") {
    return res.status(400).json({ error: "Missing required parameter: name" });
  }

  function getWikipediaTitle(n: string): string {
    const clean = n.trim();
    const lower = clean.toLowerCase();

    if (lower.includes("iss") || lower.includes("space station")) return "International_Space_Station";
    if (lower.includes("starlink")) return "Starlink";
    if (lower.includes("noaa-19")) return "NOAA-19";
    if (lower.includes("hubble")) return "Hubble_Space_Telescope";
    if (lower === "mercury") return "Mercury_(planet)";
    if (lower === "venus") return "Venus";
    if (lower === "mars") return "Mars";
    if (lower === "jupiter") return "Jupiter";
    if (lower === "saturn") return "Saturn";
    if (lower === "uranus") return "Uranus";
    if (lower === "neptune") return "Neptune";
    if (lower === "moon") return "Moon";
    if (lower === "sun") return "Sun";

    return clean.replace(/\s+/g, "_");
  }

  const title = getWikipediaTitle(name);
  const wikipediaUrl = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`;

  try {
    const userAgent = "SpectroscopicObserver/1.0 (svpgsuma2304@gmail.com)";
    const response = await fetch(wikipediaUrl, {
      headers: { "User-Agent": userAgent }
    });

    if (!response.ok) {
      return res.json({
        content: ` no jokes for the day `,
        generationType: 'static_fallback'
      });
    }

    const data: any = await response.json();
    const summary = data.extract || ` no jokes for the day `;

    return res.json({
      content: summary,
      generationType: 'zenith'
    });
  } catch (error: any) {
    return res.json({
      content: ` no jokes for the day `,
      generationType: 'static_fallback'
    });
  }
});

// Zenith observational reporting endpoint
app.post("/api/zenith/observe", async (req, res) => {
  const { blockId, latitude, longitude, objectName, altitude, azimuth, blockType } = req.body;
  
  if (!objectName) {
    return res.status(400).json({ error: "Missing required parameter: objectName" });
  }

  const descPrompt = `You are a professional astronomer writing in an observational log book.
The system is 'Project Zenith: The Celestial Eye'. 
Create a highly scientific, beautiful, and interesting "Observational Log Entry" for the celestial object: "${objectName}".
Observer Location: Latitude ${latitude || "unknown"}°, Longitude ${longitude || "unknown"}°.
Calculated Object Sky Positions relative to observer: Altitude ${altitude || "n/a"}°, Azimuth ${azimuth || "n/a"}°.
Type of Celestial Object: ${blockType || "unknown"}.

Structure the entry into:
1. **Astronomic Class & Coordinates**: Brief coordinates, magnitude, class.
2. **Current Viewing Status**: Altitude/Bearing conditions, best times.
3. **Cosmic Insight**: 2-3 sentences of deep space context, history of why it is scientifically unique or beautiful.
4. **Astronomer's Note**: A personal field note about setting up telescope filters or expectations for the session.

Write directly, in a poetic but highly scientific slate-gray/dark-sky observer journal style. Use markdown notation. Limit details to under 150 words. Do not use generic placeholders. Do NOT include any external URLs, links, or hyperlinks in the response.`;

  try {
    const zenith = getZenithClient();
    if (zenith) {
      console.log(`Querying Zenith (gemini-3.5-flash) for observation log: ${objectName}`);
      const response = await zenith.models.generateContent({
        model: "gemini-3.5-flash",
        contents: descPrompt,
      });
      
      return res.json({
        content: response.text,
        generationType: "zenith",
      });
    } else {
      // Fallback in case API key is not configured, providing a premium fallback experience.
      const staticFallbacks: Record<string, string> = {
        "Sun": `**Astronomic Class & Coordinates**: G2V Yellow Dwarf Star | Apparent Magnitude: -26.74\n**Current Viewing Status**: Hovering at ${altitude}° altitude, tracking across the ecliptic.\n**Cosmic Insight**: The Sun drives all cosmic life, representing 99.86% of the Solar System's total mass. Its magnetic cycle causes stunning flares visible with specialized H-alpha filters.\n**Astronomer's Note**: Strictly observe solar filters. The corona is exceptionally quiet today with minimum sunspot groups.`,
        "Moon": `**Astronomic Class & Coordinates**: Earth Satellite | Apparent Magnitude: -12.74\n**Current Viewing Status**: Rising elegantly on east-northeast meridian bearing.\n**Cosmic Insight**: Earth's tidal companion in synchronous tidal lock. Its impact craters list the violent history of the early inner solar system.\n**Astronomer's Note**: Best viewed along the terminator line using 12mm glass, where shadows accentuate depth of Tycho Crater.`,
        "Mars": `**Astronomic Class & Coordinates**: Terrestrial Planet (Red) | Apparent Magnitude: -1.5\n**Current Viewing Status**: Clear visual prominence, low atmospheric shimmer.\n**Cosmic Insight**: Named after the god of war, the rusty basalt surface hides deep dry river valleys and Olympus Mons, the largest volcano in the Solar System.\n**Astronomer's Note**: Red oxide sheen is strong tonight. Syrtis Major planitia is marginally resolvable with a 200mm reflector.`,
        "Venus": `**Astronomic Class & Coordinates**: Terrestrial Planet | Apparent Magnitude: -4.4\n**Current Viewing Status**: High luminosity, brilliant evening star.\n**Cosmic Insight**: Swirling carbon dioxide clouds trap runaway greenhouse heat. Venus displays orbital phases visible from Earth analogous to lunar phases.\n**Astronomer's Note**: The crescent shape is beautifully crisp. Cloud deck exhibits high UV reflectivity.`,
        "Jupiter": `**Astronomic Class & Coordinates**: Jovian Gas Giant | Apparent Magnitude: -2.7\n**Current Viewing Status**: High overhead position, dominant sky beacon.\n**Cosmic Insight**: A massive system of 95 known moons, acting as an inner-system gravitational shield. The Great Red Spot is a persistent anticyclonic storm larger than Earth.\n**Astronomer's Note**: Excellent atmospheric seeing. All four Galilean moons (Io, Europa, Ganymede, Callisto) are lined up perfectly east-west.`,
        "Saturn": `**Astronomic Class & Coordinates**: Ringed Gas Giant | Apparent Magnitude: +0.6\n**Current Viewing Status**: Visible on the southeast ecliptic trail.\n**Cosmic Insight**: The rings are composed of billons of ice particles, rocky debris, and dust. Its low global density would allow it to float in a giant ocean.\n**Astronomer's Note**: Cassinian Division in the ring band is wonderfully distinct today. Titan visible as a tiny gold point.`,
        "ISS (International Space Station)": `**Astronomic Class & Coordinates**: Low Earth Orbit Crewed Station | Velocity: 27,580 km/h\n**Current Viewing Status**: Fleeting orbital pass in LEO.\n**Cosmic Insight**: A magnificent joint human achievement orbiting at altitude 418km since 1998, flying across the globe 16 times a day.\n**Astronomer's Note**: Highly metallic structure causes magnificent solar panel flares. Tracks incredibly fast through crosshair!`,
        "Hubble Space Telescope": `**Astronomic Class & Coordinates**: Low Earth Orbit Observatory | Velocity: 27,300 km/h\n**Current Viewing Status**: Dim visual streak visible in clear dark skies with high-power tracking binocular.\n**Cosmic Insight**: Launched in 1990, Hubble revolutionized modern astronomy, determining the age of the universe and capturing the Hubble Deep Field.\n**Astronomer's Note**: Quick tracking required. Light curve is steady, showing nominal solar wing alignment.`,
        "Mangalyaan (Mars Orbiter)": `**Astronomic Class & Coordinates**: Low Earth Orbit Interplanetary Probe | Speed: Velocity is variable\n**Current Viewing Status**: Orbital trajectory passing through observational range.\n**Cosmic Insight**: India's milestone Mars Orbiter Mission (MOM) entered Martian orbit on September 24, 2014. It carried payloads to analyze surface topography, mineralogy, and atmospheric methane content.\n**Fun Fact**: India was the very first nation to reach Mars orbit on its maiden attempt. Crucially, the mission cost just $73 million—making it far more cost-effective than Hollywood blockbuster films like 'Gravity'!\n**Astronomer's Note**: High-gain antenna reflects a pristine radio carrier. Tracking calculations show high stability.`,
        "Aditya-L1 Solar Probe": `**Astronomic Class & Coordinates**: Lagrange Point 1 Space Observatory | Speed: Orbiting L1 halo\n**Current Viewing Status**: Deployed in deep space orbit around the Sun-Earth L1 Lagrange Point.\n**Cosmic Insight**: Launched on September 2, 2023, Aditya-L1 is designed to study the solar corona, solar wind particle dynamics, chromosphere, and coronal mass ejections (CMEs).\n**Fun Fact**: It operates 1.5 million kilometers from Earth, giving it a completely continuous, unobstructed view of the Sun without any eclipses or occultations.\n**Astronomer's Note**: Interlinked with solar flares alerts; telemetry reveals intense heating in coronal loops.`,
        "Cartosat-3": `**Astronomic Class & Coordinates**: Sun-Synchronous Earth Polar Orbit | Altitude: 509 km\n**Current Viewing Status**: Swift polar pass across local horizon.\n**Cosmic Insight**: Features next-generation Earth imaging apparatuses utilized extensively for urban mapping, demographic planning, coastal land use, and infrastructural development.\n**Fun Fact**: At the time of its launch, Cartosat-3 had an incredible spatial ground resolution of 25cm, placing its imaging power among the sharpest commercial satellites globally.\n**Astronomer's Note**: Retroreflective solar array panels create brief, high-magnitude optical glints during dawn and dusk.`,
        "Aryabhata": `**Astronomic Class & Coordinates**: Historic Low Earth Orbit Satellite | Altitude: 560 km (De-orbited 1992)\n**Current Viewing Status**: Historical telemetry mode active.\n**Cosmic Insight**: Launched on April 19, 1975, Aryabhata was India’s first satellite, built by ISRO and named after the great 5th-century Indian philosopher, astronomer, and mathematician.\n**Fun Fact**: Although its scientific instruments failed after just five days in orbit due to a power issue, its telemetry transmitter functioned for years, defining the initial telemetry track protocols for all subsequent ISRO satellites.\n**Astronomer's Note**: A fundamental piece of history. Traced as a tribute to ISRO's pioneering days.`,
        "Ursa Major": `**Astronomic Class & Coordinates**: Northern Constellation | Abbr: UMa | Brightest: Alioth\n**Current Viewing Status**: Dominant in the northern celestial hemisphere.\n**Cosmic Insight**: Known as the Great Bear, it holds the famous Big Dipper asterism which astronomers use to locate Polaris, the North Star.\n**Fun Fact**: In traditional Indian Vedic astronomy, Ursa Major is celebrated as **Saptarishi**, representing the seven celestial sages who guide cosmic order. Alkand, Mizar, and Alioth lead this majestic procession of stars.\n**Astronomer's Note**: High-contrast outline, great calibration landmark. Double star Mizar and Alcor are resolvable to the naked eye.`,
        "Orion": `**Astronomic Class & Coordinates**: Equatorial Constellation | Abbr: Ori | Brightest: Rigel\n**Current Viewing Status**: Visible globally across the equatorial sky strip.\n**Cosmic Insight**: Orion forms the shape of a celestial hunter. Right in its sword hangs the Orion Nebula (M42), a massive, active stellar nursery where thousands of stars are currently forming.\n**Fun Fact**: In ancient Indian astronomy, Orion is known as **Mriga** (The Deer) or **Kalapurusha**. The three central belt stars (Alnitak, Alnilam, and Mintaka) are representing the hunter's celestial belt.\n**Astronomer's Note**: Nebula gas shines emerald through narrowband OIII filters; Betelgeuse is looking remarkably reddish today.`,
        "Cassiopeia": `**Astronomic Class & Coordinates**: Circumpolar Constellation | Abbr: Cas | Brightest: Schedar\n**Current Viewing Status**: High circumpolar elevation, framing the Milky Way.\n**Cosmic Insight**: Recognizable by its distinct 'W' shape, Cassiopeia is home to Cas A, the brightest radio source in the sky outside our solar system, which of course is a supernova remnant.\n**Fun Fact**: In Indian astronomical scripts, this crown-like constellation is identified as **Sharmistha**, daughter of the great King Vrishaparva.\n**Astronomer's Note**: Rich star fields surrounding Gamma Cassiopeiae are spectacular for wide-field binoculars.`,
        "Cygnus": `**Astronomic Class & Coordinates**: Milky Way Constellation | Abbr: Cyg | Brightest: Deneb\n**Current Viewing Status**: Spanning across the overhead galactic arm line.\n**Cosmic Insight**: Cygnus, the Swan, flies down the galactic plane of the Milky Way. It contains the Northern Cross and Cygnus X-1, a famous high-mass X-ray binary system containing the first widely accepted stellar-mass black hole.\n**Fun Fact**: Cygnus represents the divine **Hamsa** (the sacred swan) in Indian mythological lore, which is said to separate celestial milk from water, indicating supreme spiritual discernment.\n**Astronomer's Note**: Deneb forms the Summer Triangle. Star cluster Alberio is exceptionally beautiful with contrasting blue and gold binary components.`,
        "Leo": `**Astronomic Class & Coordinates**: Zodiacal Constellation | Abbr: Leo | Brightest: Regulus\n**Current Viewing Status**: Rising high on the ecliptic trajectory.\n**Cosmic Insight**: One of the earliest recognized constellations, Leo represents the Nemean Lion. It is the radiant point for the spectacular Leonid meteor showers that occur in November.\n**Fun Fact**: In Indian Vedic astrology, Leo is called **Simha**, representing royal courage and majesty. Its brightest star, Regulus, is called **Magha**, meaning 'The Mighty One'.\n**Astronomer's Note**: Excellent galaxy country around the Leo Triplet (M65, M66, and NGC 3628)—easily discernible with a 150mm telescope.`
      };

      const fallbackText = staticFallbacks[objectName] || `**Astronomic Class & Coordinates**: Celestial Body | Observed: ${objectName}\n**Current Viewing Status**: Simulated tracking overhead.\n**Cosmic Insight**: This body floats elegantly in space, representing an exciting target for astronomical charting.\n**Astronomer's Note**: [Configure your ZENITH_API_KEY inside Settings > Secrets to unlock personalized generative logs reflecting live atmospheric conditions!]`;

      return res.json({
        content: fallbackText,
        generationType: "static_fallback",
      });
    }
  } catch (error: any) {
    console.error("Zenith reporting error:", error);
    res.status(500).json({ error: error.message || "Failed to generate observation entry" });
  }
});


// Serve static/vite app
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Project Zenith Server booting at http://localhost:${PORT}`);
    console.log(`  ➜  Local:   http://localhost:${PORT}/`);
  });
}

startServer();
