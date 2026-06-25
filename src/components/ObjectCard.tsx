import { useState, useEffect } from 'react';
import { Compass, Eye, ShieldAlert, FileText, Send, Sparkles, Database, Loader2, Gauge, HelpCircle, RefreshCw } from 'lucide-react';
import { CelestialObject, Observer, ObsLog } from '../types';

interface ObjectCardProps {
  object: CelestialObject | null;
  observer: Observer;
  onGenerateLog: (object: CelestialObject, logContent: string, genType: 'zenith' | 'static_fallback' | 'intel') => void;
  savedLogs: ObsLog[];
  temperature?: number | null;
  humidity?: number | null;
  currentTime?: number;
  bortleScale?: number;
}

function InfoTooltip({ content }: { content: string }) {
  const [open, setOpen] = useState(false);
  return (
    <span className="relative inline-block ml-1 group" id={`tooltip-${content.slice(0, 15).replace(/\s+/g, '-').toLowerCase()}`}>
      <span
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onClick={() => setOpen(!open)}
        className="inline-flex items-center justify-center w-3 h-3 text-xs font-mono font-extrabold text-indigo-400 bg-indigo-950/80 border border-indigo-800/40 rounded-full hover:bg-indigo-900 cursor-help transition-all"
        style={{ contentVisibility: 'auto' }}
      >
        ?
      </span>
      {open && (
        <span className="absolute bottom-5 left-1/2 -translate-x-1/2 z-50 w-48 p-2 bg-slate-950 border border-indigo-500/40 text-xs font-mono text-slate-300 rounded shadow-2xl leading-normal block normal-case whitespace-normal text-left">
          {content}
          <span className="absolute top-full left-1/2 -translate-x-1/2 border-[4px] border-transparent border-t-slate-950" />
        </span>
      )}
    </span>
  );
}


export default function ObjectCard({ object, observer, onGenerateLog, savedLogs, temperature, humidity, currentTime, bortleScale }: ObjectCardProps) {
  const getTargetSpectrumDetails = (id: string, type: string) => {
    const cleanId = id.toLowerCase();
    
    // Planets spectrum profiles
    if (cleanId === 'sun') {
      return {
        gradient: 'linear-gradient(to right, #ff0000, #ff7f00, #ffff00, #00ff00, #0000ff, #4b0082, #8f00ff)',
        lines: [12, 24, 38, 48, 62, 70, 85], // Fraunhofer absorption lines
        composition: [{ label: 'HYDROGEN (H)', val: '73.4%' }, { label: 'HELIUM (He)', val: '24.9%' }, { label: 'OXYGEN (O)', val: '0.77%' }]
      };
    }
    if (cleanId === 'moon') {
      return {
        gradient: 'linear-gradient(to right, #334155, #64748b, #94a3b8, #cbd5e1, #94a3b8, #64748b, #334155)', // Reflected lunar albedo
        lines: [15, 28, 45, 52, 68, 80],
        composition: [{ label: 'SILICON (Si)', val: '21.0%' }, { label: 'IRON (Fe)', val: '6.2%' }, { label: 'TITANIUM (Ti)', val: '3.1%' }]
      };
    }
    if (cleanId === 'venus') {
      return {
        gradient: 'linear-gradient(to right, #ea580c, #f97316, #fb923c, #fed7aa, #fb923c, #f97316, #ea580c)',
        lines: [8, 18, 28, 38, 48, 58, 68, 78, 88], // Thick carbon dioxide bands
        composition: [{ label: 'CARBON DIOXIDE (CO₂)', val: '96.5%' }, { label: 'NITROGEN (N₂)', val: '3.5%' }, { label: 'SULFUR DIOXIDE (SO₂)', val: '0.015%' }]
      };
    }
    if (cleanId === 'mars') {
      return {
        gradient: 'linear-gradient(to right, #7f1d1d, #b91c1c, #dc2626, #ef4444, #f87171, #ef4444, #b91c1c)',
        lines: [10, 22, 35, 47, 58, 75, 90], // Iron oxide dust bands
        composition: [{ label: 'CARBON DIOXIDE (CO₂)', val: '95.3%' }, { label: 'NITROGEN (N₂)', val: '2.7%' }, { label: 'ARGON (Ar)', val: '1.6%' }]
      };
    }
    if (cleanId === 'jupiter') {
      return {
        gradient: 'linear-gradient(to right, #78350f, #d97706, #fbbf24, #fef08a, #fbbf24, #d97706, #78350f)',
        lines: [14, 25, 36, 42, 58, 70, 82], // Dense hydrogen and helium
        composition: [{ label: 'HYDROGEN (H₂)', val: '89.8%' }, { label: 'HELIUM (He)', val: '10.2%' }, { label: 'AMMONIA (NH₃)', val: '0.1%' }]
      };
    }
    if (cleanId === 'iss') {
      return {
        gradient: 'linear-gradient(to right, #0284c7, #38bdf8, #bae6fd, #e0f2fe, #bae6fd, #38bdf8, #0284c7)', // Reflected atmospheric albedo
        lines: [21, 35, 48, 60, 78], // Oxygen/Nitrogen bounds
        composition: [{ label: 'NITROGEN (N₂)', val: '78.1%' }, { label: 'OXYGEN (O₂)', val: '20.9%' }, { label: 'CARBON DIOXIDE (CO₂)', val: '0.04%' }]
      };
    }
    
    // General satellite albedo reflection signatures (metallic structure albedo)
    if (type === 'satellite') {
      return {
        gradient: 'linear-gradient(to right, #0f172a, #334155, #475569, #64748b, #475569, #334155, #0f172a)',
        lines: [18, 30, 48, 65, 82],
        composition: [{ label: 'SILICON (PV cells)', val: '42%' }, { label: 'ALUMINIUM (Al)', val: '35%' }, { label: 'TITANIUM (Ti)', val: '12%' }]
      };
    }

    // Deep space stellar absorption (Constellations)
    return {
      gradient: 'linear-gradient(to right, #1e1b4b, #312e81, #3730a3, #4338ca, #3730a3, #312e81, #1e1b4b)',
      lines: [25, 45, 65, 85],
      composition: [{ label: 'HYDROGEN (H I)', val: '74%' }, { label: 'HELIUM (He I)', val: '24%' }, { label: 'INTERSTELLAR DUST', val: '2%' }]
    };
  };

  const getTransitSchedule = () => {
    if (!object) return [];
    const tBase = currentTime || Date.now();
    
    if (object.type === 'satellite') {
      const periodMs = (object.period || 5400) * 1000;
      
      // Deterministic seeding based on object ID hash
      const seed = object.id.charCodeAt(0) + (object.id.charCodeAt(1) || 0);
      const t1Offset = Math.round(periodMs * (0.15 + (seed % 10) * 0.05));
      
      return [
        {
          time: new Date(tBase + t1Offset).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
          duration: `${Math.floor((300 + (seed % 120)) / 60)}m ${(300 + (seed % 120)) % 60}s`,
          peak: `${25 + (seed % 65)}° ${['NW', 'NE', 'SW', 'SE', 'N', 'S'][seed % 6]}`,
          status: 25 + (seed % 65) > 40 ? 'Visible' : 'Marginal'
        },
        {
          time: new Date(tBase + t1Offset + periodMs).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
          duration: `${Math.floor((280 + (seed % 120)) / 60)}m ${(280 + (seed % 120)) % 60}s`,
          peak: `${15 + ((seed * 3) % 75)}° ${['NW', 'NE', 'SW', 'SE', 'N', 'S'][(seed * 3) % 6]}`,
          status: 15 + ((seed * 3) % 75) > 40 ? 'Visible' : 'Marginal'
        },
        {
          time: new Date(tBase + t1Offset + periodMs * 2).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
          duration: `${Math.floor((310 + (seed % 120)) / 60)}m ${(310 + (seed % 120)) % 60}s`,
          peak: `${20 + ((seed * 7) % 70)}° ${['NW', 'NE', 'SW', 'SE', 'N', 'S'][(seed * 7) % 6]}`,
          status: 20 + ((seed * 7) % 70) > 40 ? 'Visible' : 'Marginal'
        }
      ];
    } else {
      // Sun/Moon/Planets Rise/Culmination/Set
      const transitHour = (object.ra || 0) / 15;
      const riseHour = (transitHour - 6 + 24) % 24;
      const setHour = (transitHour + 6) % 24;
      
      const baseDate = new Date(tBase);
      
      const formatHour = (hr: number) => {
        const h = Math.floor(hr);
        const m = Math.floor((hr - h) * 60);
        const d = new Date(baseDate);
        d.setHours(h, m, 0);
        return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      };

      return [
        { type: 'RISE', time: formatHour(riseHour), note: 'Horizon Ascent' },
        { type: 'TRANSIT', time: formatHour(transitHour), note: `Peak Elev (${(90 - Math.abs(observer.latitude - (object.dec || 0))).toFixed(1)}°)` },
        { type: 'SET', time: formatHour(setHour), note: 'Horizon Descent' }
      ];
    }
  };

  // Parse cardinal directions from Azimuth
  const getCardinalDirection = (az: number) => {
    const val = Math.floor((az / 22.5) + 0.5);
    const arr = ["N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE", "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW"];
    return arr[(val % 16)];
  };

  if (!object) {
    return (
      <div className="bg-slate-950/40 border border-slate-800/60 rounded-xl p-6 shadow-2xl h-full flex flex-col items-center justify-center text-center text-slate-500 backdrop-blur-md" id="empty-object-card">
        <Compass className="w-10 h-10 text-slate-700 animate-spin-slow mb-3" />
        <p className="text-sm font-mono tracking-widest uppercase font-bold text-slate-400">No Target Selected</p>
        <p className="text-sm text-slate-500 mt-2 max-w-[260px] leading-relaxed">Select any planet, satellite, or the ISS on the Globe or Planisphere to view real-time receiver telemetry and spectroscopic analysis</p>
      </div>
    );
  }

  const isVisible = (object.localCoordinates?.altitude || 0) > 0;

  const getVelocity = () => {
    if (object.velocity) return object.velocity;
    if (object.id === 'iss') return 27581;

    const id = object.id.toLowerCase();
    if (id === 'sun') return 792000;
    if (id === 'moon') return 3680;
    if (id === 'mercury') return 170500;
    if (id === 'venus') return 126100;
    if (id === 'mars') return 86700;
    if (id === 'jupiter') return 47000;
    if (id === 'saturn') return 34900;
    if (id === 'uranus') return 24500;
    if (id === 'neptune') return 19500;

    if (object.type === 'satellite') {
      const h = object.altitude || (object.localCoordinates?.rangeKm ? object.localCoordinates.rangeKm - 6371 : 550);
      const t = object.period || 5400; // 90 mins
      const r_total = 6371 + h;
      const v_kms = (2 * Math.PI * r_total) / t;
      return Math.round(v_kms * 3600);
    }
    return null;
  };

  const getVelocitySubtitle = () => {
    const id = object.id.toLowerCase();
    if (id === 'sun') return "Galactic Orbital Speed";
    if (id === 'moon') return "Mean Lunar Geocentric Speed";
    if (object.type === 'planet') return "Mean Heliocentric Speed";
    return "LEO Kinetic Velocity Standard";
  };

  const getPhysicalSpecs = () => {
    const id = object.id.toLowerCase();
    
    if (object.type === 'planet' || id === 'sun' || id === 'moon') {
      const specs: Record<string, { label: string; value: string; desc: string }[]> = {
        sun: [
          { label: "SPECTRAL TYPE", value: "G2V Yellow Dwarf", desc: "Main sequence star fusing hydrogen" },
          { label: "DIAMETER", value: "1,392,700 km", desc: "109 times the size of Earth" },
          { label: "MASS", value: "333,000 Earths", desc: "99.8% of solar system mass" },
          { label: "SURFACE TEMP", value: "5,500 °C", desc: "Powered by nuclear fusion" },
        ],
        moon: [
          { label: "ORBITAL PERIOD", value: "27.3 Days", desc: "Synchronous tidal locking with Earth" },
          { label: "DIAMETER", value: "3,474 km", desc: "About 27% the size of Earth" },
          { label: "GRAVITY", value: "0.166 g", desc: "1/6th of Earth's gravity" },
          { label: "MEAN TEMP", value: "-130 °C to 120 °C", desc: "Extremes due to lack of atmosphere" },
        ],
        mercury: [
          { label: "DISTANCE FROM SUN", value: "0.39 AU", desc: "Closest planet to the solar center" },
          { label: "EQUATORIAL DIAMETER", value: "4,879 km", desc: "Smallest planet in the system" },
          { label: "ROTATION PERIOD", value: "58.6 Earth Days", desc: "Very slow diurnal spin rate" },
          { label: "TEMPERATURE EXTREMES", value: "-180°C to 430°C", desc: "Drastic day/night fluctuation" },
        ],
        venus: [
          { label: "DISTANCE FROM SUN", value: "0.72 AU", desc: "Covered in reflective acid clouds" },
          { label: "EQUATORIAL DIAMETER", value: "12,104 km", desc: "Similar in size and mass to Earth" },
          { label: "ATMOSPHERIC PRESSURE", value: "92 atm", desc: "Runaway greenhouse super-oven" },
          { label: "SURFACE TEMPERATURE", value: "462 °C", desc: "Hottest planetary surface in system" },
        ],
        mars: [
          { label: "DISTANCE FROM SUN", value: "1.52 AU", desc: "Cold, iron-oxide rich desert world" },
          { label: "ROTATION PERIOD", value: "24.6 Hours", desc: "Diurnal cycle very close to Earth" },
          { label: "EQUATORIAL DIAMETER", value: "6,779 km", desc: "Possesses two tiny asteroid-like moons" },
          { label: "SURFACE TEMPERATURE", value: "-140°C to 20°C", desc: "Very thin carbon-dioxide atmosphere" },
        ],
        jupiter: [
          { label: "DISTANCE FROM SUN", value: "5.20 AU", desc: "Massive gas giant with 95 moons" },
          { label: "ROTATION PERIOD", value: "9.9 Hours", desc: "Fastest spin rate of any planet" },
          { label: "EQUATORIAL DIAMETER", value: "139,820 km", desc: "11 times the diameter of Earth" },
          { label: "ATMOSPHERIC LAYERS", value: "H₂ / He Gas", desc: "Home to the Great Red Spot storm" },
        ],
        saturn: [
          { label: "DISTANCE FROM SUN", value: "9.58 AU", desc: "Spectacular planetary ring system" },
          { label: "ROTATION PERIOD", value: "10.7 Hours", desc: "Highly oblate gas giant body" },
          { label: "EQUATORIAL DIAMETER", value: "116,460 km", desc: "Second-largest solar system planet" },
          { label: "MOONS COMPILED", value: "146 Moons", desc: "Titan is its largest, thick-atmosphere moon" },
        ],
        uranus: [
          { label: "DISTANCE FROM SUN", value: "19.22 AU", desc: "Ice giant spinning on a 98° tilt" },
          { label: "ROTATION PERIOD", value: "17.2 Hours (Retro)", desc: "Sideways rotation relative to orbit" },
          { label: "EQUATORIAL DIAMETER", value: "50,724 km", desc: "Appears pale cyan-blue due to methane" },
          { label: "MEAN TEMPERATURE", value: "-224 °C", desc: "Coldest planetary atmosphere in system" },
        ],
        neptune: [
          { label: "DISTANCE FROM SUN", value: "30.05 AU", desc: "Outer gas giant with 16 known moons" },
          { label: "ROTATION PERIOD", value: "16.1 Hours", desc: "Dynamic atmosphere with extreme winds" },
          { label: "EQUATORIAL DIAMETER", value: "49,244 km", desc: "Deep blue hue from heavy methane cover" },
          { label: "ORBITAL PERIOD", value: "164.8 Earth Years", desc: "Slowest solar orbital trajectory" },
        ],
      };
      return specs[id] || [];
    }
    
    if (object.type === 'satellite' || id === 'iss') {
      const specs: Record<string, { label: string; value: string; desc: string }[]> = {
        iss: [
          { label: "COSMIC MISSION", value: "Human Space Habitat", desc: "Joint orbital laboratory since 1998" },
          { label: "ORBITAL HEIGHT", value: "418 - 422 km", desc: "Thermosonic Low Earth Orbit bounds" },
          { label: "OPERATOR / AGENCY", value: "NASA / ESA / Roscosmos", desc: "Multinational scientific project" },
          { label: "DIMENSIONS", value: "109m x 73m", desc: "Sizable solar panels array structure" },
        ],
        noaa: [
          { label: "MISSION CLASS", value: "Weather & Environment", desc: "Deep atmospheric monitoring" },
          { label: "ORBIT TYPE", value: "Sun-Synchronous LEO", desc: "Consistent diurnal overhead sweeps" },
          { label: "INSTRUMENTATION", value: "AVHRR / Microwave", desc: "High-resolution thermal scanning" },
          { label: "OPERATOR", value: "NOAA / NASA", desc: "US Federal meteorological agency" },
        ],
        starlink: [
          { label: "CONSTELLATION CLASS", value: "Broadband Internet", desc: "Mega-network global mesh" },
          { label: "OPERATOR / MAKER", value: "SpaceX", desc: "Private space exploration firm" },
          { label: "ORBITAL HEIGHT", value: "~550 km LEO", desc: "Deploys ion-thruster laser links" },
          { label: "WEIGHT", value: "~260 kg per node", desc: "Visually bright flat-panel design" },
        ],
        hubble: [
          { label: "OBSERVATIONAL TARGET", value: "Deep-Space Astrophysics", desc: "Invaluable cosmic optical receiver" },
          { label: "LAUNCHED / DEPLOYED", value: "April 24, 1990", desc: "Launched via Space Shuttle Discovery" },
          { label: "ORBITAL ALTITUDE", value: "~535 km", desc: "Slight orbital decay over decades" },
          { label: "APERTURE SIZE", value: "2.4-meter Primary Mirror", desc: "Captures crisp visible and UV light" },
        ],
        cartosat: [
          { label: "PRIMARY MISSION", value: "High-Res Earth Observation", desc: "Resource mapping and topography" },
          { label: "OPERATOR", value: "ISRO (India)", desc: "Indian Space Research Organisation" },
          { label: "ORBITAL CLASS", value: "Polar Sun-Synchronous", desc: "Sweeps over exact same local time" },
          { label: "RESOLUTION", value: "0.25-meter panchromatic", desc: "Exceptional mapping clarity" },
        ],
      };
      return specs[id] || [
        { label: "ORBITAL HEIGHT", value: `${object.altitude || 550} km`, desc: "Overhead tracking altitude" },
        { label: "ORBITAL PERIOD", value: `${Math.round((object.period || 5400) / 60)} mins`, desc: "Low Earth Orbit duration" },
        { label: "OPERATOR / ORIGIN", value: "International System", desc: "Civilian scientific array payload" },
        { label: "TRACKING SIGNATURE", value: "Active Telemetry Node", desc: "Decoded via polar ground stations" },
      ];
    }
    
    if (object.type === 'constellation') {
      const specs: Record<string, { label: string; value: string; desc: string }[]> = {
        "ursa major": [
          { label: "SKY AREA", value: "1280 sq. deg.", desc: "3rd largest constellation in sky" },
          { label: "BRIGHTEST STAR", value: "Alioth (Mag 1.8)", desc: "Brightest star of the Big Dipper" },
          { label: "QUADRANT", value: "NQ2 (Northern Sky)", desc: "Circumpolar in Northern Hemisphere" },
          { label: "BEST VISIBLE", value: "April (21:00)", desc: "Highly prominent during Spring season" },
        ],
        "ursa minor": [
          { label: "SKY AREA", value: "256 sq. deg.", desc: "Contains Northern Celestial Pole" },
          { label: "BRIGHTEST STAR", value: "Polaris (Mag 1.97)", desc: "The current North Star anchor" },
          { label: "QUADRANT", value: "NQ3 (Northern Sky)", desc: "Always circumpolar for northern observers" },
          { label: "BEST VISIBLE", value: "June (21:00)", desc: "Stands out clearly on dark Summer nights" },
        ],
        orion: [
          { label: "SKY AREA", value: "594 sq. deg.", desc: "Famous celestial hunter on equator" },
          { label: "BRIGHTEST STAR", value: "Rigel (Mag 0.13)", desc: "Stunning blue-white supergiant" },
          { label: "QUADRANT", value: "NQ1 (Equatorial)", desc: "Visible globally from northern and southern hemispheres" },
          { label: "BEST VISIBLE", value: "January (21:00)", desc: "Highly famous winter sky anchor" },
        ],
        cassiopeia: [
          { label: "SKY AREA", value: "598 sq. deg.", desc: "Distinctive 'W' or 'M' shaped queen" },
          { label: "BRIGHTEST STAR", value: "Schedar (Mag 2.2)", desc: "Orange giant star at vertex" },
          { label: "QUADRANT", value: "NQ4 (Northern Sky)", desc: "Rich Milky Way star-field background" },
          { label: "BEST VISIBLE", value: "November (21:00)", desc: "Spans high in late autumn skies" },
        ],
      };
      return specs[id] || [
        { label: "SKY SECTOR AREA", value: "Spatially Mapped", desc: "Sectors of celestial coordinate grid" },
        { label: "BRIGHTEST STAR", value: object.brightestStar || "Varies", desc: "Principal star in classical map" },
        { label: "ABBREVIATION", value: object.abbreviation || "N/A", desc: "Standard astronomical 3-letter code" },
        { label: "ASTRONOMER'S TIP", value: "Constellation Guide", desc: "Acts as coordinate star guide point" },
      ];
    }
    
    return [];
  };

  return (
    <div className="bg-slate-950/40 border border-slate-800/60 rounded-xl p-5 shadow-2xl h-full flex flex-col justify-between backdrop-blur-md font-sans" id={`object-card-${object.id}`}>
      <div>
        {/* Card Header title status */}
        <div className="flex items-start justify-between mb-4 border-b border-slate-900 pb-2">
          <div>
            <div className="flex items-center gap-1.5 mb-1 flex-wrap">
              <span className={`inline-block px-2 py-0.5 rounded text-[9px] font-mono font-bold uppercase tracking-wider ${
                object.type === 'star' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' :
                object.type === 'planet' ? 'bg-orange-500/10 text-orange-400 border border-orange-500/20' :
                object.type === 'constellation' ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 animate-pulse' :
                'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
              }`}>
                {object.type}
              </span>

              {/* Google Highly Rated Image Link button */}
              {(object.type === 'planet' || object.type === 'satellite' || object.type === 'constellation' || object.id === 'iss' || object.type === 'star') && (
                <a
                  href={`https://www.google.com/search?tbm=isch&q=${encodeURIComponent(object.name + ' astrophotography high resolution hubble webb site:eso.org OR site:hubblesite.org OR site:webbtelescope.org')}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-mono font-bold bg-indigo-950 hover:bg-indigo-900 text-slate-100 transition-all border border-indigo-500/30 shadow-[0_0_8px_rgba(99,102,241,0.2)]"
                  title={`View highly-rated Google images from trusted astronomical sources for ${object.name}`}
                >
                  <span className="text-indigo-400 font-extrabold">G</span> Trusted Imagery
                </a>
              )}
            </div>
            <h2 className="text-lg font-bold text-slate-100 tracking-tight font-serif">{object.name}</h2>
          </div>
          
          <div className={`p-1 px-3 rounded-full text-xs font-mono font-bold border ${prevVisibilityColor(isVisible)}`}>
            {isVisible ? "● ABOVE HORIZON" : "○ BELOW HORIZON"}
          </div>
        </div>

        {/* Short static Description */}
        <p className="text-slate-400 text-sm tracking-wide leading-relaxed mb-4 bg-slate-900/40 p-3 rounded-xl border border-slate-850">
          {object.description}
        </p>

        {/* Real-time coordinates telemetry grid */}
        <div className="grid grid-cols-2 gap-3 mb-5 font-mono text-xs">
          <div className="bg-slate-900/40 border border-slate-850 p-2.5 rounded-lg flex items-center justify-between gap-2">
            <div>
              <span className="text-slate-500 text-xs font-bold block tracking-wider uppercase">
                LOCAL AZIMUTH (BEARING)
                <InfoTooltip content="The horizontal compass angle measured clockwise from true North (0° to 360°). Shows which direction to face." />
              </span>
              {object.localCoordinates ? (
                <span className="text-slate-200 font-bold block mt-1 text-base">
                  {object.localCoordinates.azimuth}° <span className="text-indigo-400">({getCardinalDirection(object.localCoordinates.azimuth)})</span>
                </span>
              ) : (
                <span className="text-slate-600 block mt-1 font-bold">N/A</span>
              )}
            </div>
            {object.localCoordinates && (
              <div className="shrink-0 bg-slate-950/60 p-1 rounded-full border border-slate-850/60 shadow-inner">
                <svg width="40" height="40" viewBox="0 0 60 60" className="text-indigo-400">
                  <circle cx="30" cy="30" r="28" fill="none" stroke="currentColor" strokeWidth="1" strokeDasharray="3, 3" className="opacity-25" />
                  <circle cx="30" cy="30" r="24" fill="none" stroke="currentColor" strokeWidth="1.5" className="opacity-15" />
                  <text x="30" y="10" fontSize="7" textAnchor="middle" fill="currentColor" fontWeight="extrabold" className="opacity-50 font-mono">N</text>
                  <text x="52" y="32" fontSize="6" textAnchor="middle" fill="currentColor" fontWeight="bold" className="opacity-40 font-mono">E</text>
                  <text x="30" y="54" fontSize="6" textAnchor="middle" fill="currentColor" fontWeight="bold" className="opacity-40 font-mono">S</text>
                  <text x="8" y="32" fontSize="6" textAnchor="middle" fill="currentColor" fontWeight="bold" className="opacity-40 font-mono">W</text>
                  <g transform={`rotate(${object.localCoordinates.azimuth}, 30, 30)`}>
                    <line x1="30" y1="30" x2="30" y2="12" stroke="#6366f1" strokeWidth="2.5" strokeLinecap="round" />
                    <polygon points="30,7 34,13 26,13" fill="#6366f1" />
                  </g>
                  <circle cx="30" cy="30" r="3" fill="#ffffff" stroke="#6366f1" strokeWidth="1" />
                </svg>
              </div>
            )}
          </div>
          <div className="bg-slate-900/40 border border-slate-850 p-2.5 rounded-lg flex items-center justify-between gap-2">
            <div>
              <span className="text-slate-500 text-xs font-bold block tracking-wider uppercase">
                LOCAL ALTITUDE (ELEVATION)
                <InfoTooltip content="The vertical angle measured from your local horizon (0°) up to the Zenith (90°). Values > 0° mean it is currently above your horizon and visible!" />
              </span>
              {object.localCoordinates ? (
                <span className={`font-bold block mt-1 text-base ${isVisible ? 'text-emerald-400' : 'text-slate-500'}`}>
                  {object.localCoordinates.altitude}°
                </span>
              ) : (
                <span className="text-slate-600 block mt-1 font-bold">N/A</span>
              )}
            </div>
            {object.localCoordinates && (
              <div className="shrink-0 bg-slate-950/60 p-1 rounded-full border border-slate-850/60 shadow-inner">
                <svg width="40" height="40" viewBox="0 0 60 60" className={isVisible ? "text-emerald-400" : "text-slate-500"}>
                  <line x1="6" y1="30" x2="54" y2="30" stroke="currentColor" strokeWidth="1" className="opacity-30" />
                  <circle cx="30" cy="30" r="24" fill="none" stroke="currentColor" strokeWidth="1" strokeDasharray="3, 3" className="opacity-15" />
                  <path d="M 6 30 A 24 24 0 0 1 54 30" fill="none" stroke="currentColor" strokeWidth="1.5" className="opacity-25" />
                  <text x="30" y="14" fontSize="7" textAnchor="middle" fill="currentColor" fontWeight="extrabold" className="opacity-50 font-mono">90°</text>
                  <text x="50" y="28" fontSize="5" textAnchor="middle" fill="currentColor" className="opacity-40 font-mono">0°</text>
                  <g transform={`rotate(${-object.localCoordinates.altitude}, 30, 30)`}>
                    <line x1="30" y1="30" x2="50" y2="30" stroke={isVisible ? "#10b981" : "#64748b"} strokeWidth="2.5" strokeLinecap="round" />
                    <polygon points="53,30 47,27 47,33" fill={isVisible ? "#10b981" : "#64748b"} />
                  </g>
                  <circle cx="30" cy="30" r="3" fill="#ffffff" stroke={isVisible ? "#10b981" : "#64748b"} strokeWidth="1" />
                </svg>
              </div>
            )}
          </div>

          <div className="bg-slate-900/40 border border-slate-850 p-2.5 rounded-lg col-span-2">
            <span className="text-slate-500 text-xs font-bold block tracking-wider uppercase">
              {object.type === 'constellation' ? 'CONSTELLATION PARAMETERS' : 'GLOBAL OVERHEAD SPECTROSCOPY'}
              <InfoTooltip content={object.type === 'constellation' ? "The standardized astronomical metadata for mapped stellar sectors." : "Standard geocentric/equatorial coordinate grids for mapping objects independently of observer location."} />
            </span>
            {object.type === 'constellation' ? (
              <div className="flex justify-between items-center mt-1 text-slate-200">
                <span>ABBR: <strong className="text-indigo-400">{object.abbreviation}</strong></span>
                <span>BRIGHTEST STAR: <strong className="text-amber-400">{object.brightestStar}</strong></span>
                <span>SECTORS: <strong className="text-emerald-400">Vedic Saptarishi/Stars</strong></span>
              </div>
            ) : object.coordinates ? (
              <div className="flex flex-col gap-1.5 mt-1 text-slate-200">
                <div className="flex justify-between items-center">
                  <span>LAT: <strong className="text-indigo-400">{(object.coordinates.latitude || 0) >= 0 ? `${(object.coordinates.latitude || 0).toFixed(2)}°N` : `${Math.abs(object.coordinates.latitude || 0).toFixed(2)}°S`}</strong></span>
                  <span>LNG: <strong className="text-indigo-400">{(object.coordinates.longitude || 0) >= 0 ? `${(object.coordinates.longitude || 0).toFixed(2)}°E` : `${Math.abs(object.coordinates.longitude || 0).toFixed(2)}°W`}</strong></span>
                  {object.localCoordinates?.rangeKm && (
                    <span>RANGE: <strong className="text-slate-200">{Math.round(object.localCoordinates.rangeKm)} km</strong></span>
                  )}
                </div>
                {object.localCoordinates?.rangeKm && (
                  <div className="flex justify-between items-center border-t border-slate-800/30 pt-1 text-xs text-slate-400">
                    <span>PROPAGATION DELAY:</span>
                    <span className="font-bold text-amber-400">
                      {((object.localCoordinates.rangeKm / 299792) * 1000).toFixed(3)} ms <span className="text-[9.5px] text-slate-500 font-normal ml-0.5">(lightspeed latency)</span>
                    </span>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex justify-between items-center mt-1 text-slate-400">
                <span>RA: <strong className="text-amber-400">{object.ra}°</strong><InfoTooltip content="Right Ascension: The celestial equivalent of longitude, measured eastward along the celestial equator from the vernal equinox." /></span>
                <span>DEC: <strong className="text-amber-400">{object.dec}°</strong><InfoTooltip content="Declination: The celestial equivalent of latitude, measured north (+) or south (-) from the celestial equator." /></span>
                <span>DIST: <strong className="text-slate-400">{(object.id === 'sun' || object.id === 'moon') ? 'System' : 'Deep Space'}</strong></span>
              </div>
            )}
          </div>

          <div className="bg-slate-900/40 border border-slate-850 p-2.5 rounded-lg col-span-2 flex items-center justify-between">
            <div className="flex flex-col">
              <span className="text-slate-500 text-xs font-bold block tracking-wider uppercase">
                ORBITAL VELOCITY
                <InfoTooltip content="The kinetic velocity required to maintain orbital equilibrium. Higher velocities are found closer to gravity sources or in low orbits." />
              </span>
              <span className="text-xs text-slate-400 font-mono block mt-1 uppercase leading-none">
                {getVelocitySubtitle()}
              </span>
            </div>
            {getVelocity() !== null ? (
              <div className="text-right">
                <span className="text-emerald-400 font-bold block text-base">
                  {getVelocity()?.toLocaleString()} km/h
                </span>
                <span className="text-xs text-slate-500 block mt-0.5">
                  ~{((getVelocity() || 0) / 3600).toFixed(2)} km/s
                </span>
              </div>
            ) : (
              <span className="text-slate-600 font-bold block mt-1">N/A</span>
            )}
          </div>
        </div>

        {/* 1. Spectroscopic Chemical Analysis Widget */}
        {object && (() => {
          const spec = getTargetSpectrumDetails(object.id, object.type);
          return (
            <div className="bg-slate-900/20 border border-slate-900 rounded-lg p-3 mt-3 font-mono text-xs shadow-[inset_0_1px_2px_rgba(255,255,255,0.02)]">
              <span className="text-slate-500 text-xs font-bold block tracking-wider uppercase mb-2 flex items-center gap-1.5">
                <Database className="w-3.5 h-3.5 text-indigo-400" />
                SPECTROSCOPIC CHEMICAL ANALYSIS
                <InfoTooltip content="Displays the chemical absorption lines detected in the atmosphere or surface reflection signature of the target." />
              </span>
              
              {/* Rainbow spectral bar with black absorption line overlays */}
              <div className="relative w-full h-4.5 rounded overflow-hidden border border-slate-800 shadow-[inset_0_1px_3px_rgba(0,0,0,0.8)] mb-2.5">
                <div 
                  className="w-full h-full" 
                  style={{ background: spec.gradient }} 
                />
                {spec.lines.map((linePercent, idx) => (
                  <div 
                    key={idx}
                    className="absolute top-0 bottom-0 w-[1.5px] bg-slate-950/90 shadow-[0_0_1px_rgba(255,255,255,0.3)]"
                    style={{ left: `${linePercent}%` }}
                    title="Atmospheric Absorption Band"
                  />
                ))}
              </div>

              {/* Chemical compositions grid */}
              <div className="grid grid-cols-3 gap-1.5 text-xs">
                {spec.composition.map((comp, idx) => (
                  <div key={idx} className="bg-slate-950/45 p-1.5 rounded border border-slate-900/60 text-center flex flex-col justify-between">
                    <span className="text-slate-500 block leading-tight truncate text-xs">{comp.label}</span>
                    <strong className="text-slate-200 mt-1 block font-bold text-sm">{comp.val}</strong>
                  </div>
                ))}
              </div>
            </div>
          );
        })()}

        {/* 2. Horizon Transit Schedule Table */}
        {object && (
          <div className="bg-slate-900/20 border border-slate-900 rounded-lg p-3 mt-3 font-mono text-xs shadow-[inset_0_1px_2px_rgba(255,255,255,0.02)]">
            <span className="text-slate-500 text-xs font-bold block tracking-wider uppercase mb-2 flex items-center gap-1.5">
              <Compass className="w-3.5 h-3.5 text-indigo-400" />
              {object.type === 'satellite' ? 'UPCOMING TRANSIT PASSES' : 'CELESTIAL TRANSIT SCHEDULE'}
              <InfoTooltip content={object.type === 'satellite' ? "Calculates the next visible orbital transits of this satellite over your local observer coordinates." : "Local rise, transit (culmination peak), and set times for the current sidereal day."} />
            </span>
            
            {object.type === 'satellite' ? (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-slate-800 text-slate-500">
                      <th className="py-1 pb-1.5 font-bold uppercase tracking-wider text-xs">AOS (UTC)</th>
                      <th className="py-1 pb-1.5 font-bold uppercase tracking-wider text-xs">DURATION</th>
                      <th className="py-1 pb-1.5 font-bold uppercase tracking-wider text-xs">PEAK ELEV</th>
                      <th className="py-1 pb-1.5 font-bold uppercase tracking-wider text-xs text-right">STATUS</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-900/40 text-slate-300">
                    {getTransitSchedule().map((pass: any, idx: number) => (
                      <tr key={idx} className="hover:bg-slate-950/30">
                        <td className="py-1 font-bold text-indigo-400">{pass.time}</td>
                        <td className="py-1 text-slate-400">{pass.duration}</td>
                        <td className="py-1 text-slate-400">{pass.peak}</td>
                        <td className="py-1 text-right">
                          <span className={`px-1.5 py-0.5 rounded-[3px] text-xs font-extrabold border ${
                            pass.status === 'Visible' 
                              ? 'bg-emerald-950/20 text-emerald-400 border-emerald-900/30 shadow-[0_0_6px_rgba(16,185,129,0.15)]' 
                              : 'bg-amber-950/20 text-amber-500 border-amber-900/30'
                          }`}>
                            {pass.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-2">
                {getTransitSchedule().map((t: any, idx: number) => (
                  <div key={idx} className="bg-slate-950/40 p-2 rounded border border-slate-900/60 flex flex-col justify-between text-center">
                    <div>
                      <span className="text-slate-500 text-xs font-bold block leading-none uppercase">{t.type}</span>
                      <strong className="text-slate-200 text-xs mt-1.5 block leading-none font-bold">{t.time}</strong>
                    </div>
                    <span className="text-slate-500 text-xs mt-1.5 leading-tight block truncate">{t.note}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}



        {/* Physical specs display in blank space */}
        {getPhysicalSpecs().length > 0 && (
          <div className="bg-slate-900/20 border border-slate-900 rounded-lg p-2.5 mt-3">
            <span className="text-slate-500 text-xs font-bold block tracking-wider uppercase mb-1.5 flex items-center gap-1.5 font-mono">
              <Database className="w-3.5 h-3.5 text-indigo-400 animate-pulse" />
              PHYSICAL SPECS & CONSTANTS
            </span>
            <div className="grid grid-cols-2 gap-2 text-xs font-mono text-slate-300">
              {getPhysicalSpecs().map((spec, i) => (
                <div key={i} className="bg-slate-950/40 p-2 rounded border border-slate-900/60 flex flex-col justify-between">
                  <div>
                    <span className="text-slate-500 text-xs font-bold block leading-tight">{spec.label}</span>
                    <strong className="text-slate-100 text-sm mt-0.5 block leading-tight">{spec.value}</strong>
                  </div>
                  <span className="text-slate-500 text-xs mt-1 leading-tight block">{spec.desc}</span>
                </div>
              ))}
            </div>

            {/* Google Highly Rated Images call to action block */}
            <div className="mt-2.5 p-2.5 bg-indigo-950/20 border border-indigo-900/40 rounded flex items-center justify-between gap-3">
              <div className="flex flex-col">
                <span className="text-xs font-bold text-indigo-400 tracking-wider font-mono uppercase">Google Astronomy Image Engine</span>
                <span className="text-xs text-slate-300 font-mono mt-0.5 leading-none">Highly-rated views from Hubble, JWST, ESO</span>
              </div>
              <a
                href={`https://www.google.com/search?tbm=isch&q=${encodeURIComponent(object.name + ' astrophotography high resolution hubble webb site:eso.org OR site:hubblesite.org OR site:webbtelescope.org')}`}
                target="_blank"
                rel="noopener noreferrer"
                className="bg-indigo-650 hover:bg-indigo-600 text-white font-mono text-xs font-bold py-1 px-2.5 rounded transition-all cursor-pointer flex items-center gap-1 uppercase tracking-wider shadow-[0_0_10px_rgba(99,102,241,0.25)]"
              >
                <span className="text-indigo-300 font-bold">★</span>
                <span>GOOGLE IMAGES</span>
              </a>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function prevVisibilityColor(vis: boolean) {
  return vis
    ? 'bg-emerald-950/40 text-emerald-400 border-emerald-500/20'
    : 'bg-slate-950 text-slate-500 border-slate-800/80';
}
