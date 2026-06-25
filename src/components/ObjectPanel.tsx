import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Orbit, 
  Radio, 
  X, 
  Activity, 
  Gauge,
  Compass
} from 'lucide-react';
import { CelestialObject } from '../types';
import { DEFAULT_STAR_CATALOG } from '../lib/starCatalog';

// SGP4-inspired orbital decay and atmospheric drag calculator
export const getSatelliteDecayInfo = (obj: CelestialObject) => {
  let altitude = 500; // default
  if (obj.id === 'iss') altitude = 418;
  else if (obj.id === 'hubble') altitude = 535;
  else if (obj.id === 'cartosat') altitude = 635;
  else if (obj.altitude) altitude = obj.altitude;
  
  const lifetimeYears = Math.exp((altitude - 300) / 75) * 1.5;
  const decayMetersPerDay = 500 / Math.pow((altitude - 200) / 100, 3);
  const clampedDecayRate = Math.min(2500, Math.max(0.1, decayMetersPerDay));
  
  const designLife = 25;
  const remainingPercent = Math.min(100, Math.max(1, (lifetimeYears / designLife) * 100));
  
  let risk: 'STABLE' | 'LOW' | 'MODERATE' | 'HIGH' = 'STABLE';
  let riskColor = 'text-emerald-400';
  let barColor = 'bg-emerald-500';
  
  if (altitude < 350) {
    risk = 'HIGH';
    riskColor = 'text-rose-500';
    barColor = 'bg-rose-500 animate-pulse';
  } else if (altitude < 450) {
    risk = 'MODERATE';
    riskColor = 'text-amber-400';
    barColor = 'bg-amber-500';
  } else if (altitude < 550) {
    risk = 'LOW';
    riskColor = 'text-indigo-400';
    barColor = 'bg-indigo-500';
  }
  
  return {
    altitude,
    lifetimeYears: lifetimeYears > 100 ? '100+ Years' : `${lifetimeYears.toFixed(1)} Years`,
    decayRate: `${clampedDecayRate.toFixed(2)} m/day`,
    remainingPercent,
    risk,
    riskColor,
    barColor
  };
};

interface ObjectPanelProps {
  planets: CelestialObject[];
  satellites: CelestialObject[];
  iss: CelestialObject | null;
  selectedObjectId: string | null;
  onSelectObject: (obj: CelestialObject) => void;
  activeFilter: 'all' | 'planets' | 'constellations' | 'satellites';
  setActiveFilter: (filter: 'all' | 'planets' | 'constellations' | 'satellites') => void;
}

export default function ObjectPanel({
  planets,
  satellites,
  iss,
  selectedObjectId,
  onSelectObject,
  activeFilter,
  setActiveFilter
}: ObjectPanelProps) {
  const [searchQuery, setSearchQuery] = useState('');

  const constellationObjects: CelestialObject[] = DEFAULT_STAR_STAR_CATALOG_constellations();

  function DEFAULT_STAR_STAR_CATALOG_constellations() {
    return DEFAULT_STAR_CATALOG.constellations.map(c => ({
      id: c.id,
      name: c.name,
      type: 'constellation' as const,
      color: c.color || '#22d3ee',
      size: 5,
      description: c.description,
      abbreviation: c.abbreviation,
      brightestStar: c.brightestStar
    }));
  }

  // Combine all items based on filter
  const items: CelestialObject[] = [];

  if (activeFilter === 'all' || activeFilter === 'planets') {
    items.push(...planets);
  }

  if (activeFilter === 'all' || activeFilter === 'constellations') {
    items.push(...constellationObjects);
  }

  if (activeFilter === 'all' || activeFilter === 'satellites') {
    if (iss) {
      items.push(iss);
    }
    items.push(...satellites);
  }

  const filteredItems = items.filter(item => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      item.name.toLowerCase().includes(query) ||
      (item.id && item.id.toLowerCase().includes(query)) ||
      (item.description && item.description.toLowerCase().includes(query)) ||
      (item.abbreviation && item.abbreviation.toLowerCase().includes(query))
    );
  });

  // Find currently selected object info
  const selectedObject = 
    planets.find(p => p.id === selectedObjectId) || 
    satellites.find(s => s.id === selectedObjectId) || 
    (iss && selectedObjectId === 'iss' ? iss : null) ||
    (() => {
      const foundConst = DEFAULT_STAR_CATALOG.constellations.find(c => c.id === selectedObjectId);
      if (foundConst) {
        return {
          id: foundConst.id,
          name: foundConst.name,
          type: 'constellation' as const,
          color: foundConst.color || '#22d3ee',
          size: 5,
          description: foundConst.description,
          abbreviation: foundConst.abbreviation,
          brightestStar: foundConst.brightestStar
        };
      }
      return null;
    })();

  // Helper to parse compass/cardinal bearing
  const getCardinalDirection = (az: number) => {
    const val = Math.floor((az / 22.5) + 0.5);
    const arr = ["N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE", "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW"];
    return arr[(val % 16)];
  };

  const getPlanetaryPeriod = (id: string) => {
    const key = id.toLowerCase();
    if (key === 'sun') return "230M years";
    if (key === 'moon') return "27.32 days";
    if (key === 'mercury') return "87.97 days";
    if (key === 'venus') return "224.70 days";
    if (key === 'mars') return "686.98 days";
    if (key === 'jupiter') return "11.86 years";
    if (key === 'saturn') return "29.45 years";
    if (key === 'uranus') return "84.01 years";
    if (key === 'neptune') return "164.79 years";
    return "N/A";
  };

  const getPlanetaryAxis = (id: string) => {
    const key = id.toLowerCase();
    if (key === 'sun') return "0.00 AU";
    if (key === 'moon') return "384,400 km";
    if (key === 'mercury') return "0.387 AU";
    if (key === 'venus') return "0.723 AU";
    if (key === 'mars') return "1.524 AU";
    if (key === 'jupiter') return "5.203 AU";
    if (key === 'saturn') return "9.582 AU";
    if (key === 'uranus') return "19.201 AU";
    if (key === 'neptune') return "30.047 AU";
    return "N/A";
  };

  const getPlanetaryInclination = (id: string) => {
    const key = id.toLowerCase();
    if (key === 'sun') return "0.00°";
    if (key === 'moon') return "5.14°";
    if (key === 'mercury') return "7.01°";
    if (key === 'venus') return "3.39°";
    if (key === 'mars') return "1.85°";
    if (key === 'jupiter') return "1.31°";
    if (key === 'saturn') return "2.49°";
    if (key === 'uranus') return "0.77°";
    if (key === 'neptune') return "1.77°";
    return "N/A";
  };

  const getPlanetaryEccentricity = (id: string) => {
    const key = id.toLowerCase();
    if (key === 'sun') return "0.0000";
    if (key === 'moon') return "0.0549";
    if (key === 'mercury') return "0.2056";
    if (key === 'venus') return "0.0067";
    if (key === 'mars') return "0.0934";
    if (key === 'jupiter') return "0.0489";
    if (key === 'saturn') return "0.0565";
    if (key === 'uranus') return "0.0473";
    if (key === 'neptune') return "0.0113";
    return "N/A";
  };

  // Helper to calculate orbital velocity for all types of celestial objects
  const getVelocity = (obj: CelestialObject) => {
    if (obj.velocity) return obj.velocity; // e.g. ISS preset 27581
    if (obj.id === 'iss') return 27581; // standard LEO speed in km/h

    const id = obj.id.toLowerCase();
    if (id === 'sun') {
      return 792000; // Galactic orbit speed in km/h (220 km/s)
    }
    if (id === 'moon') {
      return 3680; // Geocentric orbital speed in km/h (1.022 km/s)
    }
    if (id === 'mercury') {
      return 170500; // Heliocentric orbital speed in km/h (47.36 km/s)
    }
    if (id === 'venus') {
      return 126100; // Heliocentric orbital speed in km/h (35.02 km/s)
    }
    if (id === 'mars') {
      return 86700; // Heliocentric orbital speed in km/h (24.08 km/s)
    }
    if (id === 'jupiter') {
      return 47000; // Heliocentric orbital speed in km/h (13.07 km/s)
    }
    if (id === 'saturn') {
      return 34900; // Heliocentric orbital speed in km/h (9.69 km/s)
    }
    if (id === 'uranus') {
      return 24500; // Heliocentric orbital speed in km/h (6.80 km/s)
    }
    if (id === 'neptune') {
      return 19500; // Heliocentric orbital speed in km/h (5.43 km/s)
    }

    if (obj.type === 'satellite') {
      // Standard circular LEO orbit approximation
      // h is altitude, default to 550 km if undefined
      const h = obj.altitude || (obj.localCoordinates?.rangeKm ? obj.localCoordinates.rangeKm - 6371 : 550);
      const t = obj.period || 5400; // default period 90 mins (5400s)
      const r_total = 6371 + h;
      const v_kms = (2 * Math.PI * r_total) / t;
      return Math.round(v_kms * 3600); // km/h
    }
    return null;
  };

  const getVelocitySubtitle = (obj: CelestialObject) => {
    const id = obj.id.toLowerCase();
    if (id === 'sun') return "Galactic Orbital Speed";
    if (id === 'moon') return "Mean Lunar Geocentric Speed";
    if (obj.type === 'planet') return "Mean Heliocentric Orbital Speed";
    return "Kinetic LEO Velocity Standard";
  };

  return (
    <div 
      className="bg-slate-950/50 border border-slate-800/80 rounded-xl shadow-2xl backdrop-blur-md relative overflow-hidden flex flex-col md:flex-row h-[380px] w-full" 
      id="object-list-telemetry-panel"
    >
      {/* 1. Main Directory Listing Panel */}
      <div 
        className={`flex-1 p-5 flex flex-col justify-between transition-all duration-300 ${
          selectedObject ? 'md:pr-[370px]' : ''
        }`}
        id="catalog-list-split-panel"
      >
        <div>
          {/* Panel Header */}
          <div className="flex items-center justify-between mb-4 border-b border-slate-900 pb-2">
            <div className="flex items-center gap-2">
              <Orbit className="w-5 h-5 text-indigo-400 animate-spin-slow" />
              <h2 className="text-xs font-bold uppercase tracking-widest text-slate-300 font-mono">
                Observation Target List
              </h2>
            </div>
            <div className="text-[10px] text-slate-500 font-mono">
              ENTRIES: <strong className="text-indigo-400 font-bold">{filteredItems.length} / {items.length} ACTIVE</strong>
            </div>
          </div>

          {/* Filters Tabs inside Panel */}
          <div className="grid grid-cols-4 gap-1 mb-3 bg-slate-900/40 p-1 rounded-xl border border-slate-900">
            <button
              onClick={() => setActiveFilter('all')}
              className={`py-1.5 px-1 rounded-lg font-mono text-[9px] text-center tracking-wide font-bold transition-all cursor-pointer ${
                activeFilter === 'all' 
                  ? 'bg-slate-800 text-indigo-300 shadow' 
                  : 'text-slate-500 hover:text-slate-300'
              }`}
              id="tab-all-nodes"
            >
              ALL
            </button>
            <button
              onClick={() => setActiveFilter('planets')}
              className={`py-1.5 px-1 rounded-lg font-mono text-[9px] text-center tracking-wide font-bold transition-all cursor-pointer ${
                activeFilter === 'planets' 
                  ? 'bg-slate-800 text-indigo-300 shadow' 
                  : 'text-slate-500 hover:text-slate-300'
              }`}
              id="tab-planets-nodes"
            >
              PLANETARY
            </button>
            <button
              onClick={() => setActiveFilter('constellations')}
              className={`py-1.5 px-1 rounded-lg font-mono text-[9px] text-center tracking-wide font-bold transition-all cursor-pointer ${
                activeFilter === 'constellations' 
                  ? 'bg-slate-800 text-indigo-300 shadow' 
                  : 'text-slate-500 hover:text-slate-300'
              }`}
              id="tab-constellations-nodes"
            >
              CONSTELL
            </button>
            <button
              onClick={() => setActiveFilter('satellites')}
              className={`py-1.5 px-1 rounded-lg font-mono text-[9px] text-center tracking-wide font-bold transition-all cursor-pointer ${
                activeFilter === 'satellites' 
                  ? 'bg-slate-800 text-indigo-300 shadow' 
                  : 'text-slate-500 hover:text-slate-300'
              }`}
              id="tab-satellites-nodes"
            >
              SATELLITES
            </button>
          </div>

          {/* Search Input Filter */}
          <div className="relative mb-3 flex items-center">
            <span className="absolute left-3 text-slate-500">
              <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24" className="stroke-slate-500">
                <circle cx="11" cy="11" r="8"></circle>
                <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
              </svg>
            </span>
            <input
              type="text"
              placeholder="Search constellations, planets or objects..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-900/40 border border-slate-900 rounded-lg py-1.5 pl-9 pr-8 text-[11px] font-mono text-slate-200 placeholder-slate-600 focus:outline-none focus:border-indigo-500/50 transition-all"
              id="object-panel-search"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 p-1 text-slate-500 hover:text-slate-300 transition-colors cursor-pointer"
                title="Clear search"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>

          {/* Scrollable nodes list */}
          <div className="space-y-1.5 h-[160px] overflow-y-auto pr-1">
            {filteredItems.length === 0 ? (
              <div className="text-center py-10 text-slate-600 font-mono text-xs uppercase tracking-wider">
                No matching targets found
              </div>
            ) : (
              filteredItems.map((item) => {
                const isSelected = selectedObjectId === item.id;
                const isVisible = (item.localCoordinates?.altitude || 0) > 0;

                return (
                  <button
                    key={item.id}
                    onClick={() => onSelectObject(item)}
                    className={`w-full text-left p-2.5 px-3 rounded-lg border transition-all flex items-center justify-between font-mono cursor-pointer group ${
                      isSelected
                        ? 'bg-indigo-950/40 border-indigo-500/80 text-white shadow-lg shadow-indigo-950/25'
                        : 'bg-slate-900/30 border-slate-900 text-slate-300 hover:bg-slate-800/40 hover:border-slate-800'
                    }`}
                    id={`panel-object-row-${item.id}`}
                  >
                    {/* Object Identification badge */}
                    <div className="flex items-center gap-2">
                      <span
                        className="h-2.5 w-2.5 rounded-full block animate-pulse border border-white/10"
                        style={{ backgroundColor: item.color }}
                      />
                      <div className="flex flex-col">
                        <span className="text-sm font-semibold tracking-tight leading-none group-hover:text-indigo-300 transition-colors">
                          {item.name}
                        </span>
                        <span className="text-[9px] text-slate-500 uppercase font-bold mt-1.5 leading-none">
                          {item.id === 'iss' ? 'Station (LEO)' : item.type}
                        </span>
                      </div>
                    </div>

                    {/* Local Telemetry alt/az readout parameters */}
                    <div className="text-right flex flex-col items-end">
                      {item.localCoordinates ? (
                        <>
                          <span className={`text-[11px] font-bold leading-none ${isVisible ? 'text-emerald-400' : 'text-slate-500'}`}>
                            ALT: {item.localCoordinates.altitude >= 0 ? `+${item.localCoordinates.altitude.toFixed(0)}°` : `${item.localCoordinates.altitude.toFixed(0)}°`}
                          </span>
                          <span className="text-[9px] text-slate-500 font-bold mt-1.5 leading-none">
                            AZ: {item.localCoordinates.azimuth.toFixed(0)}°
                          </span>
                        </>
                      ) : (
                        <>
                          <span className="text-[11px] text-slate-700 font-bold leading-none">OUT RECV</span>
                          <span className="text-[9px] text-slate-700 font-bold mt-1.5 leading-none">CALIBRATING</span>
                        </>
                      )}
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Auxiliary sensor telemetry lines in footer */}
        <div className="mt-4 pt-3 border-t border-slate-900 flex items-center justify-between font-mono text-[9px] text-slate-500">
          <div className="flex items-center gap-1">
            <Radio className="w-3.5 h-3.5 text-slate-600 animate-pulse" />
            <span>SPECTRAL DECODER FEED</span>
          </div>
          <span className="text-emerald-500/80 uppercase font-bold">● LINK ESTABLISHED</span>
        </div>
      </div>

      {/* 2. Interactive Sliding Side Telemetry Panel */}
      <AnimatePresence>
        {selectedObject && (
          <motion.div
            key={selectedObject.id}
            initial={{ x: '100%', opacity: 0.8 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: '100%', opacity: 0.8 }}
            transition={{ type: 'spring', damping: 28, stiffness: 220 }}
            className="absolute right-0 top-0 h-full w-full md:w-[360px] bg-slate-950/98 border-t md:border-t-0 md:border-l border-slate-800/80 z-20 p-5 flex flex-col justify-between shadow-[-12px_0_30px_rgba(0,0,0,0.7)] backdrop-blur-xl"
            id="sliding-telemetry-side-panel"
          >
            <div>
              {/* Sliding Header */}
              <div className="flex items-center justify-between mb-3 border-b border-slate-905 pb-2">
                <div className="flex items-center gap-2">
                  <Activity className="w-4 h-4 text-emerald-400 animate-pulse" />
                  <span className="text-[10px] font-mono font-bold tracking-widest text-[#10b981] uppercase">
                    Target Lock Identified
                  </span>
                </div>
                <button
                  onClick={() => onSelectObject(null as any)}
                  className="rounded-lg p-1 hover:bg-slate-900 text-slate-500 hover:text-white transition cursor-pointer self-center"
                  id="panel-close-drawer-btn"
                  title="Disconnect telemetry bind"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Title Section */}
              <div className="flex items-start gap-2.5 mb-3">
                <span
                  className="h-3.5 w-3.5 rounded-full block border border-white/20 shadow-md translate-y-1.5"
                  style={{ backgroundColor: selectedObject.color }}
                />
                <div className="flex-1">
                  <h3 className="text-sm font-bold text-slate-100 font-mono tracking-tight leading-snug">
                    {selectedObject.name}
                  </h3>
                  <div className="flex items-center gap-1.5 mt-1 font-mono text-[9px] font-bold text-slate-500 uppercase">
                    <span>ID: {selectedObject.id}</span>
                    <span>•</span>
                    <span className="text-indigo-400">{selectedObject.type}</span>
                  </div>
                </div>
              </div>

              {/* Primary Coordinates Readout Grid / Constellation Myth Detail */}
              {selectedObject.type === 'constellation' ? (
                <div className="space-y-3 flex-1 flex flex-col justify-between" id="constellation-telemetry-block">
                  <div className="space-y-3">
                    {/* Illustration POP-OUT Container with graceful text fallback */}
                    <div className="relative h-28 w-full rounded-lg bg-slate-900/60 border border-slate-800/80 overflow-hidden flex items-center justify-center p-2 group/img">
                      <div className="absolute inset-0 bg-radial-gradient from-transparent to-slate-950/70 pointer-events-none" />
                      
                      {/* Real transparent background image loaded dynamically */}
                      <img
                        src={`/assets/constellations/${selectedObject.id}.png`}
                        alt={`${selectedObject.name} mythological figure representation`}
                        referrerPolicy="no-referrer"
                        className="h-24 w-auto object-contain z-10 filter brightness-90 contrast-110 drop-shadow-[0_0_12px_rgba(34,211,238,0.3)] group-hover/img:scale-105 transition duration-300"
                        onError={(e) => {
                          (e.target as HTMLElement).style.display = 'none';
                          const fallbackDiv = document.getElementById(`fallback-img-block-${selectedObject.id}`);
                          if (fallbackDiv) fallbackDiv.style.display = 'flex';
                        }}
                      />

                      {/* Fallback Vector style text card if illustration is missing */}
                      <div 
                        id={`fallback-img-block-${selectedObject.id}`}
                        className="absolute inset-0 flex flex-col items-center justify-center p-3 text-center border-dashed border-slate-800/50"
                        style={{ display: 'none' }}
                      >
                        <Compass className="w-6 h-6 text-cyan-400 opacity-60 animate-pulse mb-1" />
                        <span className="text-[10px] font-mono text-cyan-300 tracking-wider">
                          [ VECTOR MAP: {selectedObject.abbreviation?.toUpperCase()} ]
                        </span>
                        <span className="text-[8px] text-slate-500 font-mono mt-0.5 uppercase tracking-tight">
                          Illustration Loader Fallback Active
                        </span>
                      </div>
                    </div>

                    {/* Metadata responsive grid layout */}
                    <div className="grid grid-cols-2 gap-2 font-mono">
                      <div className="bg-slate-900/40 border border-slate-900 p-2 rounded-lg flex flex-col justify-between text-left">
                        <span className="text-slate-500 text-[8px] font-bold uppercase tracking-wide block">
                          Abbreviation
                        </span>
                        <span className="text-xs font-bold block mt-1.5 text-cyan-400">
                          {selectedObject.abbreviation || 'N/A'}
                        </span>
                      </div>
                      <div className="bg-slate-900/40 border border-slate-900 p-2 rounded-lg flex flex-col justify-between text-left">
                        <span className="text-slate-500 text-[8px] font-bold uppercase tracking-wide block">
                          Brightest Key Star
                        </span>
                        <span className="text-xs font-bold block mt-1.5 text-emerald-400">
                          {selectedObject.brightestStar || 'N/A'}
                        </span>
                      </div>
                    </div>

                    {/* Technical coordinate standards catalog specs */}
                    <div className="bg-slate-900/40 border border-slate-900 p-2.5 rounded-lg font-mono text-[9px] leading-relaxed">
                      <div className="flex justify-between items-center py-1 border-b border-slate-950">
                        <span className="text-slate-500 uppercase font-bold">Catalog Class</span>
                        <span className="text-slate-300 font-bold">Astronomical Constellation</span>
                      </div>
                      <div className="flex justify-between items-center py-1">
                        <span className="text-slate-500 uppercase font-bold">Hemisphere</span>
                        <span className="text-indigo-400 font-bold">Equatorial & Celestial Northern</span>
                      </div>
                    </div>
                  </div>

                  {/* Description space */}
                  <p className="text-slate-400 text-[10px] leading-relaxed tracking-wide italic font-sans border-l-2 border-cyan-500/50 pl-2.5 py-0.5 mt-3">
                    {selectedObject.description}
                  </p>
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-2.5 mb-3 font-mono">
                    {/* Altitude (Elevation) */}
                    <div className="bg-slate-900/60 border border-slate-900 p-2.5 rounded-lg flex flex-col justify-between">
                      <span className="text-slate-500 text-[8px] font-bold tracking-wide uppercase block">
                        Elevation (ALT)
                      </span>
                      <span className={`text-xs font-bold block mt-1.5 ${(selectedObject.localCoordinates?.altitude || 0) > 0 ? "text-emerald-400" : "text-slate-500"}`}>
                        {selectedObject.localCoordinates?.altitude != null 
                          ? `${selectedObject.localCoordinates.altitude.toFixed(3)}°` 
                          : 'N/A'}
                      </span>
                      <span className="text-[8px] font-semibold text-slate-600 block mt-1">
                        {(selectedObject.localCoordinates?.altitude || 0) > 0 ? "★ OVERHEAD VIEW" : "☁ BACKGROUND (BELOW)"}
                      </span>
                    </div>

                    {/* Azimuth (Bearing) */}
                    <div className="bg-slate-900/60 border border-slate-900 p-2.5 rounded-lg flex flex-col justify-between">
                      <span className="text-slate-500 text-[8px] font-bold tracking-wide uppercase block">
                        Bearing (AZ)
                      </span>
                      <p className="text-xs font-bold text-slate-200 block mt-1.5">
                        {selectedObject.localCoordinates?.azimuth != null 
                          ? `${selectedObject.localCoordinates.azimuth.toFixed(2)}°` 
                          : 'N/A'}
                      </p>
                      <p className="text-[8px] font-bold text-indigo-430 block mt-1 uppercase">
                        DIR: {selectedObject.localCoordinates?.azimuth != null 
                          ? `${getCardinalDirection(selectedObject.localCoordinates.azimuth)}` 
                          : 'N/A'}
                      </p>
                    </div>

                    {/* Velocity Row (Shown if orbital velocity is definable/computable) */}
                    {selectedObject && getVelocity(selectedObject) !== null && (
                      <div className="bg-emerald-950/20 border border-emerald-500/10 p-2.5 rounded-lg col-span-2 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Gauge className="w-4 h-4 text-emerald-400 animate-pulse" />
                          <div className="flex flex-col">
                            <span className="text-slate-500 text-[8px] font-bold tracking-wide uppercase leading-none">
                              Calculated Orbital Velocity
                            </span>
                            <span className="text-slate-400 text-[9px] uppercase font-bold mt-1 tracking-tight leading-none">
                              {getVelocitySubtitle(selectedObject)}
                            </span>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-xs font-bold text-emerald-400">
                            {getVelocity(selectedObject)?.toLocaleString()} km/h
                          </div>
                          <div className="text-[8px] text-slate-500 mt-0.5">
                            ~{((getVelocity(selectedObject) || 0) / 3600).toFixed(2)} km/s
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Dense technical telemetry tabular view */}
                  <div className="border border-slate-800/80 rounded-lg overflow-hidden font-mono text-[9px] mb-3">
                    <div className="bg-slate-900/40 px-2 py-1.5 border-b border-slate-850 flex items-center justify-between">
                      <span className="text-[8.5px] text-indigo-400 font-bold uppercase tracking-wider">TECHNICAL TELEMETRY MATRIX</span>
                      <span className="text-[7.5px] text-slate-500 font-semibold">[SGP4 SOLVER ACTIVE]</span>
                    </div>
                    <table className="w-full text-left border-collapse">
                      <tbody>
                        <tr className="border-b border-slate-900/60 hover:bg-slate-900/15">
                          <td className="px-2.5 py-1.5 text-slate-500 font-bold uppercase w-1/2">Epoch ID / Ref</td>
                          <td className="px-2.5 py-1.5 text-slate-200 font-semibold text-right">
                            {selectedObject.type === 'satellite' ? "UTC 2026-175.12" : "J2000.0 Reference"}
                          </td>
                        </tr>
                        <tr className="border-b border-slate-900/60 hover:bg-slate-900/15">
                          <td className="px-2.5 py-1.5 text-slate-500 font-bold uppercase">Orbital Period</td>
                          <td className="px-2.5 py-1.5 text-slate-200 font-semibold text-right">
                            {selectedObject.type === 'satellite' 
                              ? (selectedObject.id === 'iss' ? "92m 50s" : "98m 12s") 
                              : getPlanetaryPeriod(selectedObject.id)}
                          </td>
                        </tr>
                        <tr className="border-b border-slate-900/60 hover:bg-slate-900/15">
                          <td className="px-2.5 py-1.5 text-slate-500 font-bold uppercase">Semi-Major Axis</td>
                          <td className="px-2.5 py-1.5 text-slate-200 font-semibold text-right">
                            {selectedObject.type === 'satellite' 
                              ? (selectedObject.id === 'iss' ? "6,792 km" : "6,921 km") 
                              : getPlanetaryAxis(selectedObject.id)}
                          </td>
                        </tr>
                        <tr className="border-b border-slate-900/60 hover:bg-slate-900/15">
                          <td className="px-2.5 py-1.5 text-slate-500 font-bold uppercase">Inclination</td>
                          <td className="px-2.5 py-1.5 text-slate-200 font-semibold text-right">
                            {selectedObject.type === 'satellite' 
                              ? (selectedObject.id === 'iss' ? "51.64°" : "97.50°") 
                              : getPlanetaryInclination(selectedObject.id)}
                          </td>
                        </tr>
                        <tr className="hover:bg-slate-900/15">
                          <td className="px-2.5 py-1.5 text-slate-500 font-bold uppercase">Eccentricity</td>
                          <td className="px-2.5 py-1.5 text-slate-200 font-semibold text-right">
                            {selectedObject.type === 'satellite' ? "0.00029 (Circ)" : getPlanetaryEccentricity(selectedObject.id)}
                          </td>
                        </tr>
                        {selectedObject.type === 'satellite' && (
                          <>
                            <tr className="border-t border-slate-900/60 hover:bg-slate-900/15">
                              <td className="px-2.5 py-1.5 text-slate-500 font-bold uppercase">Decay / Re-entry Risk</td>
                              <td className={`px-2.5 py-1.5 font-bold text-right ${getSatelliteDecayInfo(selectedObject).riskColor}`}>
                                {getSatelliteDecayInfo(selectedObject).risk} ({getSatelliteDecayInfo(selectedObject).lifetimeYears})
                              </td>
                            </tr>
                            <tr className="border-t border-slate-900/60 hover:bg-slate-900/15">
                              <td className="px-2.5 py-1.5 text-slate-500 font-bold uppercase">Decay Rate (Drag)</td>
                              <td className="px-2.5 py-1.5 text-slate-200 font-semibold text-right">
                                {getSatelliteDecayInfo(selectedObject).decayRate}
                              </td>
                            </tr>
                          </>
                        )}
                      </tbody>
                    </table>
                  </div>

                  {selectedObject.type === 'satellite' && (
                    <div className="bg-slate-950/80 border border-slate-900 rounded-lg p-2.5 mb-3.5 space-y-1.5">
                      <div className="flex justify-between items-center text-[8.5px] font-mono font-bold uppercase tracking-wider">
                        <span className="text-slate-400">Relative Orbital Lifespan Progress</span>
                        <span className={getSatelliteDecayInfo(selectedObject).riskColor}>{getSatelliteDecayInfo(selectedObject).lifetimeYears} remaining</span>
                      </div>
                      <div className="w-full bg-slate-900 h-2 rounded-full overflow-hidden border border-slate-800">
                        <div 
                          className={`h-full transition-all duration-1000 ${getSatelliteDecayInfo(selectedObject).barColor}`} 
                          style={{ width: `${getSatelliteDecayInfo(selectedObject).remainingPercent}%` }}
                        />
                      </div>
                      <div className="flex justify-between text-[7px] font-mono text-slate-600 font-bold">
                        <span>DECAY ZONE (ENTRY)</span>
                        <span>STABLE LEO TARGET</span>
                      </div>
                    </div>
                  )}

                  {/* Description Block */}
                  <p className="text-slate-400 text-[10px] leading-relaxed tracking-wide italic font-sans border-l border-indigo-500/50 pl-2.5 py-0.5">
                    {selectedObject.description}
                  </p>
                </>
              )}
            </div>

            {/* Quick action button inside drawer to disconnect telemetry */}
            <button
              onClick={() => onSelectObject(null as any)}
              className="w-full bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white transition font-mono text-[9px] py-1.5 rounded border border-slate-800/60 uppercase font-bold tracking-widest cursor-pointer mt-4"
              id="disconnect-feed-action-btn"
            >
              Disconnect Target Feed
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
