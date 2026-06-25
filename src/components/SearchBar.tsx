import React, { useState } from 'react';
import { Search, MapPin, Compass, Navigation } from 'lucide-react';
import { Observer } from '../types';

interface SearchBarProps {
  onLocationChange: (loc: Observer) => void;
  currentObserver: Observer;
}

const PRESET_OBSERVATORIES: Observer[] = [
  { name: "Mauna Kea Observatory, Hawaii", latitude: 19.8206, longitude: -155.4681, elevationM: 4207 },
  { name: "Paranal Observatory, Chile", latitude: -24.6275, longitude: -70.4042, elevationM: 2635 },
  { name: "Royal Observatory Greenwich, UK", latitude: 51.4769, longitude: -0.0005, elevationM: 46 },
  { name: "Siding Spring Observatory, Australia", latitude: -31.2749, longitude: 149.0685, elevationM: 1165 },
  { name: "Tokyo National Astronomical Obs, Japan", latitude: 35.6762, longitude: 139.5441, elevationM: 58 },
  { name: "Roque de los Muchachos, Spain", latitude: 28.7636, longitude: -17.8947, elevationM: 2396 },
  { name: "Cairo Historic Citadel, Egypt", latitude: 30.0299, longitude: 31.2611, elevationM: 75 },
];

export default function SearchBar({ onLocationChange, currentObserver }: SearchBarProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [customLat, setCustomLat] = useState(currentObserver.latitude.toFixed(4));
  const [customLng, setCustomLng] = useState(currentObserver.longitude.toFixed(4));
  const [customName, setCustomName] = useState(currentObserver.name);

  // Synchronize input fields when observer details are updated by the system or parent context
  React.useEffect(() => {
    setCustomLat(currentObserver.latitude.toFixed(4));
    setCustomLng(currentObserver.longitude.toFixed(4));
    setCustomName(currentObserver.name);
  }, [currentObserver.latitude, currentObserver.longitude, currentObserver.name]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery) return;

    // Search inside presets
    const found = PRESET_OBSERVATORIES.find(obs => 
      obs.name.toLowerCase().includes(searchQuery.toLowerCase())
    );

    if (found) {
      onLocationChange(found);
      setCustomLat(found.latitude.toFixed(4));
      setCustomLng(found.longitude.toFixed(4));
      setCustomName(found.name);
      setSearchQuery("");
      return;
    }

    // fallback direct simple name-to-coord lookup
    const commonPlaces: Record<string, { lat: number; lng: number; el: number }> = {
      "new york": { lat: 40.7128, lng: -74.0060, el: 10 },
      "london": { lat: 51.5074, lng: -0.1278, el: 11 },
      "paris": { lat: 48.8566, lng: 2.3522, el: 35 },
      "tokyo": { lat: 35.6762, lng: 139.6503, el: 40 },
      "sydney": { lat: -33.8688, lng: 151.2093, el: 19 },
      "cairo": { lat: 30.0444, lng: 31.2357, el: 23 },
      "rio de janeiro": { lat: -22.9068, lng: -43.1729, el: 5 },
      "moscow": { lat: 55.7558, lng: 37.6173, el: 156 },
      "mumbai": { lat: 19.0760, lng: 72.8777, el: 14 },
      "cape town": { lat: -33.9249, lng: 18.4241, el: 42 },
      "reykjavik": { lat: 64.1466, lng: -21.9426, el: 15 },
      "north pole": { lat: 90.0000, lng: 0.0000, el: 1 },
      "south pole": { lat: -90.0000, lng: 0.0000, el: 2835 },
    };

    const cleaned = searchQuery.trim().toLowerCase();
    if (commonPlaces[cleaned]) {
      const place = commonPlaces[cleaned];
      const name = searchQuery.charAt(0).toUpperCase() + searchQuery.slice(1);
      const newObs: Observer = {
        name: `${name} Observer Coordinates`,
        latitude: place.lat,
        longitude: place.lng,
        elevationM: place.el
      };
      onLocationChange(newObs);
      setCustomLat(place.lat.toFixed(4));
      setCustomLng(place.lng.toFixed(4));
      setCustomName(newObs.name);
      setSearchQuery("");
    } else {
      // Create user coordinates from searching if looks like numbers e.g. "45, -73"
      const pair = searchQuery.split(/[\s,]+/);
      if (pair.length >= 2) {
        const latVal = parseFloat(pair[0]);
        const lngVal = parseFloat(pair[1]);
        if (!isNaN(latVal) && !isNaN(lngVal) && latVal >= -90 && latVal <= 90 && lngVal >= -180 && lngVal <= 180) {
          const newObs: Observer = {
            name: `Manual Coordinates Grid Point`,
            latitude: latVal,
            longitude: lngVal,
            elevationM: 100
          };
          onLocationChange(newObs);
          setCustomLat(latVal.toFixed(4));
          setCustomLng(lngVal.toFixed(4));
          setCustomName(newObs.name);
          setSearchQuery("");
        }
      }
    }
  };

  const handleCustomApply = (e: React.FormEvent) => {
    e.preventDefault();
    const lat = parseFloat(customLat);
    const lng = parseFloat(customLng);
    if (!isNaN(lat) && !isNaN(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
      onLocationChange({
        name: customName || `Station Lat:${lat.toFixed(2)} Lng:${lng.toFixed(2)}`,
        latitude: lat,
        longitude: lng,
        elevationM: 150
      });
    }
  };

  return (
    <div className="bg-slate-950/60 border border-slate-900 rounded-xl p-5 shadow-2xl h-full flex flex-col justify-between backdrop-blur-md font-sans" id="search-bar-panel">
      <div>
        <div className="flex items-center gap-2 mb-4 border-b border-slate-900/60 pb-2">
          <Compass className="w-5 h-5 text-indigo-400 animate-spin-slow" />
          <h2 className="text-sm font-bold uppercase tracking-widest text-slate-400 font-mono">Observer Ground Station</h2>
        </div>

        {/* Current Active Location Display */}
        <div className="bg-slate-900/10 border border-indigo-500/10 rounded-xl p-4 mb-4 relative overflow-hidden shadow-[inset_0_1px_3px_rgba(99,102,241,0.05)] border-l-2 border-l-indigo-500/80" id="active-location-display">
          <div className="flex items-start gap-3">
            <div className="rounded-full bg-indigo-500/10 p-2 mt-0.5 border border-indigo-500/20 shadow-[0_0_10px_rgba(99,102,241,0.15)]">
              <MapPin className="w-4 h-4 text-indigo-400 animate-pulse" />
            </div>
            <div className="flex-1">
              <p className="text-slate-100 text-sm font-semibold tracking-wide leading-snug font-mono">{currentObserver.name}</p>
              <div className="mt-2.5 grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm font-mono text-slate-400">
                <div className="flex justify-between border-b border-slate-900/40 pb-1">
                  <span className="text-slate-500 font-semibold">LAT:</span>
                  <span className="text-indigo-400 font-bold">{currentObserver.latitude >= 0 ? `${currentObserver.latitude.toFixed(4)}°N` : `${Math.abs(currentObserver.latitude).toFixed(4)}°S`}</span>
                </div>
                <div className="flex justify-between border-b border-slate-900/40 pb-1">
                  <span className="text-slate-500 font-semibold">LNG:</span>
                  <span className="text-indigo-400 font-bold">{currentObserver.longitude >= 0 ? `${currentObserver.longitude.toFixed(4)}°E` : `${Math.abs(currentObserver.longitude).toFixed(4)}°W`}</span>
                </div>
                <div className="flex justify-between pb-0.5">
                  <span className="text-slate-500 font-semibold">ELEVATION:</span>
                  <span className="text-slate-200 font-medium">{currentObserver.elevationM} m</span>
                </div>
                <div className="flex justify-between pb-0.5">
                  <span className="text-slate-500 font-semibold">OBS ZONE:</span>
                  <span className="text-slate-200 font-medium">UTC {currentObserver.longitude >= 0 ? `+` : ``}{Math.round(currentObserver.longitude / 15)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Station Presets Selector */}
        <div className="mb-4">
          <span className="text-xs font-bold text-slate-500 font-mono block mb-2 tracking-wider">FAMOUS OBSERVATORIES:</span>
          <div className="max-h-[84px] overflow-y-auto space-y-1 pr-1 border border-slate-900/60 bg-slate-950/40 p-1.5 rounded-lg custom-scrollbar">
            {PRESET_OBSERVATORIES.map((obs) => {
              const isActive = currentObserver.name === obs.name;
              return (
                <button
                  key={obs.name}
                  onClick={() => {
                    onLocationChange(obs);
                    setCustomLat(obs.latitude.toFixed(4));
                    setCustomLng(obs.longitude.toFixed(4));
                    setCustomName(obs.name);
                  }}
                  className={`w-full text-left py-1.5 text-sm px-2.5 rounded transition-all flex items-center justify-between font-mono cursor-pointer border ${
                    isActive 
                      ? 'text-indigo-300 bg-indigo-500/10 border-indigo-500/25 font-bold shadow-[inset_0_1px_1px_rgba(99,102,241,0.05)]' 
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/40 border-transparent'
                  }`}
                  id={`preset-btn-${obs.name.split(',')[0].toLowerCase().replace(/\s+/g, '-')}`}
                >
                  <div className="flex items-center gap-2">
                    <span className={`w-1.5 h-1.5 rounded-full ${
                      isActive ? 'bg-indigo-400 shadow-[0_0_6px_#6366f1]' : 'bg-slate-800'
                    }`} />
                    <span>{obs.name.split(',')[0]}</span>
                  </div>
                  <span className={`text-xs ${isActive ? 'text-indigo-400' : 'text-slate-500'}`}>
                    {obs.latitude > 0 ? `${Math.round(obs.latitude)}°N` : `${Math.round(Math.abs(obs.latitude))}°S`}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Manual Coord adjustments / Free Form Search */}
      <div className="space-y-4 border-t border-slate-800/60 pt-4">
        {/* Simple City Search */}
        <form onSubmit={handleSearch} className="relative">
          <input
            type="text"
            placeholder="Search coordinates (e.g. London, 45, -73)"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-950/80 border border-slate-800 rounded-full py-2 pl-3 pr-10 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-indigo-500/40 focus:ring-1 focus:ring-indigo-500/20 focus:shadow-[0_0_10px_rgba(99,102,241,0.1)] transition-all font-mono"
            id="station-search-input"
          />
          <button
            type="submit"
            className="absolute right-1.5 top-1 text-slate-500 hover:text-indigo-400 p-1 rounded transition"
            id="station-search-btn"
          >
            <Search className="w-4 h-4" />
          </button>
        </form>

        {/* Fine Coordinate Adjustment */}
        <div>
          <span className="text-xs font-bold text-slate-500 font-mono block mb-2 tracking-wider">MANUAL POSITION GRID:</span>
          <form onSubmit={handleCustomApply} className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs text-slate-500 font-mono block mb-1 uppercase font-bold">LATITUDE (-90 : 90)</label>
              <input
                type="number"
                step="any"
                min="-90"
                max="90"
                value={customLat}
                onChange={(e) => setCustomLat(e.target.value)}
                className="w-full bg-slate-950/80 border border-slate-800 rounded px-2.5 py-1.5 text-sm font-mono text-slate-300 focus:outline-none focus:border-indigo-500/40 focus:ring-1 focus:ring-indigo-500/20 transition-all"
                id="custom-lat-input"
              />
            </div>
            <div>
              <label className="text-xs text-slate-500 font-mono block mb-1 uppercase font-bold">LONGITUDE (-180 : 180)</label>
              <input
                type="number"
                step="any"
                min="-180"
                max="180"
                value={customLng}
                onChange={(e) => setCustomLng(e.target.value)}
                className="w-full bg-slate-950/80 border border-slate-800 rounded px-2.5 py-1.5 text-sm font-mono text-slate-300 focus:outline-none focus:border-indigo-500/40 focus:ring-1 focus:ring-indigo-500/20 transition-all"
                id="custom-lng-input"
              />
            </div>
            <div className="col-span-2">
              <button
                type="submit"
                className="w-full mt-1 bg-indigo-950/40 border border-indigo-500/20 hover:border-indigo-500/50 hover:bg-indigo-600/20 text-indigo-300 hover:text-indigo-100 font-mono text-sm py-2 rounded-lg transition-all flex items-center justify-center gap-1.5 font-bold uppercase tracking-wider shadow-[0_0_8px_rgba(99,102,241,0.05)] cursor-pointer"
                id="apply-coordinates-btn"
              >
                <Navigation className="w-3.5 h-3.5" />
                <span>Calibrate Ground Station</span>
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
