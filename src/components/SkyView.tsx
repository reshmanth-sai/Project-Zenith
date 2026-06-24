import { useState, useEffect, useMemo, useRef } from 'react';
import { Eye, Radio, Orbit, Crosshair, Compass, Zap, Sparkles, Volume2, VolumeX, EyeOff } from 'lucide-react';
import { CelestialObject, Observer } from '../types';
import * as AstronomyModule from 'astronomy-engine';
import { DEFAULT_STAR_CATALOG } from '../lib/starCatalog';
import { getLookAngles, ISS_TLE } from '../lib/satellite';

const Astronomy: any = (AstronomyModule as any).default || AstronomyModule;
const { Observer: AstroObserver, Horizon: AstroHorizon } = Astronomy;

interface SkyViewProps {
  observer: Observer;
  planets: CelestialObject[];
  satellites: CelestialObject[];
  satelliteData?: CelestialObject[]; // dynamic satellite prop support
  iss: CelestialObject | null;
  selectedObjectId: string | null;
  onSelectObject: (obj: CelestialObject) => void;
  currentTime: number;
  starCatalogData?: typeof DEFAULT_STAR_CATALOG; // customizable star/constellation data
  bortleScale: number;
  setBortleScale: (val: number) => void;
  timeMultiplier?: number;
}

// Math helpers for selected satellite path projection
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
  
  // Drifting due to Earth rotation
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

function calculateSatelliteAltAz(
  obsLat: number,
  obsLng: number,
  satLat: number,
  satLng: number,
  satAltKm: number
) {
  const rEarth = 6371;
  const rObs = rEarth;
  const rSat = rEarth + satAltKm;
  
  const lat1Rad = (obsLat * Math.PI) / 180;
  const lng1Rad = (obsLng * Math.PI) / 180;
  const lat2Rad = (satLat * Math.PI) / 180;
  const lng2Rad = (satLng * Math.PI) / 180;
  
  const cosTheta = Math.sin(lat1Rad) * Math.sin(lat2Rad) + 
                    Math.cos(lat1Rad) * Math.cos(lat2Rad) * Math.cos(lng2Rad - lng1Rad);
  const theta = Math.acos(Math.max(-1, Math.min(1, cosTheta)));
  
  const y = Math.sin(lng2Rad - lng1Rad) * Math.cos(lat2Rad);
  const x = Math.cos(lat1Rad) * Math.sin(lat2Rad) - Math.sin(lat1Rad) * Math.cos(lat2Rad) * Math.cos(lng2Rad - lng1Rad);
  
  let bearingRad = Math.atan2(y, x);
  if (bearingRad < 0) bearingRad += 2 * Math.PI;
  const azimuth = (bearingRad * 180) / Math.PI;
  
  const numElev = rSat * cosTheta - rObs;
  const denElev = rSat * Math.sin(theta);
  const elevRad = Math.atan2(numElev, Math.max(0.0001, denElev));
  const altitude = (elevRad * 180) / Math.PI;
  
  return { altitude, azimuth };
}

let audioCtx: AudioContext | null = null;

function playRadarPing(altitude: number, magnitude: number, objectType: string) {
  try {
    const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtxClass) return;
    if (!audioCtx) {
      audioCtx = new AudioCtxClass();
    }
    if (audioCtx.state === 'suspended') {
      audioCtx.resume();
    }
    const now = audioCtx.currentTime;

    // Pitch: altitude near 90 (Zenith) -> 1300Hz, near 0 (horizon) -> 350Hz
    const altPct = Math.max(0, Math.min(90, altitude)) / 90;
    const freq = 350 + 950 * altPct;

    // Volume: magnitude near -5 -> louder, near 4 -> quiet
    const clampedMag = Math.max(-5, Math.min(4, magnitude));
    const magPct = 1 - (clampedMag - (-5)) / (4 - (-5)); // 1.0 is bright, 0.0 is dim
    const vol = Math.max(0.015, Math.min(0.20, 0.015 + magPct * 0.185));

    const osc = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();

    if (objectType === 'satellite' || objectType === 'station') {
      osc.type = 'triangle';
    } else {
      osc.type = 'sine';
    }

    osc.frequency.setValueAtTime(freq, now);

    gainNode.gain.setValueAtTime(0, now);
    gainNode.gain.linearRampToValueAtTime(vol, now + 0.008); // attack
    gainNode.gain.exponentialRampToValueAtTime(0.0001, now + 0.45); // decay

    const filter = audioCtx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(freq, now);
    filter.Q.setValueAtTime(4, now);

    osc.connect(filter);
    filter.connect(gainNode);
    gainNode.connect(audioCtx.destination);

    osc.start(now);
    osc.stop(now + 0.5);
  } catch (err) {
    // Fail silently
  }
}

function isAngleBetween(target: number, start: number, end: number) {
  if (start <= end) {
    return target >= start && target < end;
  } else {
    return target >= start || target < end;
  }
}

export default function SkyView({
  observer,
  planets,
  satellites,
  satelliteData,
  iss,
  selectedObjectId,
  onSelectObject,
  currentTime,
  starCatalogData,
  bortleScale,
  setBortleScale,
  timeMultiplier
}: SkyViewProps) {
  const radius = 160;
  const [hoveredObject, setHoveredObject] = useState<any>(null);

  const maxMagnitude = useMemo(() => {
    return Math.max(1.0, 4.5 - (bortleScale - 1) * 0.4);
  }, [bortleScale]);

  const getSkyDomeColors = () => {
    if (bortleScale <= 2) return ["#03050a", "#010205", "#000001"];
    if (bortleScale <= 4) return ["#080c14", "#03040a", "#010103"];
    if (bortleScale <= 6) return ["#0d1326", "#060914", "#020308"];
    if (bortleScale <= 8) return ["#151b36", "#090c1f", "#03040c"];
    return ["#1e2247", "#0c102b", "#040614"]; // Class 9: Urban light pollution haze
  };
  const [skyCenterColor, skyMidColor, skyEdgeColor] = getSkyDomeColors();

  const [sweepAngle, setSweepAngle] = useState(0);
  const [showDeepSpaceMap, setShowDeepSpaceMap] = useState<boolean>(true);
  const [showStars, setShowStars] = useState<boolean>(true);
  const [showConstellations, setShowConstellations] = useState<boolean>(true);
  const [showPlanets, setShowPlanets] = useState<boolean>(true);
  const [showSatellites, setShowSatellites] = useState<boolean>(true);
  
  const cityLightsFilter = bortleScale >= 7;
  const [showAudioPings, setShowAudioPings] = useState<boolean>(false);

  const showAudioPingsRef = useRef<boolean>(false);
  useEffect(() => {
    showAudioPingsRef.current = showAudioPings;
  }, [showAudioPings]);

  const visibleObjectsRef = useRef<Array<{ id: string; name: string; altitude: number; azimuth: number; magnitude: number; type: string }>>([]);

  const deepSpaceBgStars = useMemo(() => {
    const stars = [];
    const random = (seed: number) => {
      const x = Math.sin(seed) * 10000;
      return x - Math.floor(x);
    };
    for (let i = 0; i < 45; i++) {
      const r = random(i + 12.3) * radius;
      const theta = random(i + 45.6) * 2 * Math.PI;
      stars.push({
        cx: r * Math.cos(theta),
        cy: r * Math.sin(theta),
        r: 0.4 + random(i + 78.9) * 0.9,
        opacity: 0.15 + random(i + 99.1) * 0.45,
        color: ['#93c5fd', '#fde68a', '#c084fc', '#ffffff', '#a5f3fc'][Math.floor(random(i + 13.5) * 5)]
      });
    }
    return stars;
  }, [radius]);

  const prevSweepAngleRef = useRef<number>(0);

  useEffect(() => {
    let animId: number;
    let lastTime = performance.now();
    const tick = (now: number) => {
      const elapsed = now - lastTime;
      lastTime = now;
      
      setSweepAngle((prev) => {
        const mult = typeof timeMultiplier === 'number' ? timeMultiplier : 10;
        let speedFactor = 1.0;
        if (mult === 0) speedFactor = 0.5;
        else if (mult === 1) speedFactor = 1.0;
        else if (mult === 10) speedFactor = 3.0;
        else if (mult === 300) speedFactor = 15.0;
        
        const nextAngle = (prev + elapsed * 0.03 * speedFactor) % 360;
        
        // Trigger audio pings if enabled
        if (showAudioPingsRef.current) {
          const prevAngle = prevSweepAngleRef.current;
          visibleObjectsRef.current.forEach((obj) => {
            if (isAngleBetween(obj.azimuth, prevAngle, nextAngle)) {
              playRadarPing(obj.altitude, obj.magnitude, obj.type);
            }
          });
        }
        
        prevSweepAngleRef.current = nextAngle;
        return nextAngle;
      });
      
      animId = requestAnimationFrame(tick);
    };
    animId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animId);
  }, [timeMultiplier]);

  // Use props input fallback to internal lists gracefully
  const activeSats = satelliteData || satellites || [];
  const starsList = useMemo(() => {
    const magLimit = cityLightsFilter ? 2.2 : maxMagnitude;
    return (starCatalogData?.stars || DEFAULT_STAR_CATALOG.stars)
      .filter(star => star.magnitude <= magLimit);
  }, [starCatalogData, maxMagnitude, cityLightsFilter]);

  const constellationsList = starCatalogData?.constellations || DEFAULT_STAR_CATALOG.constellations;

  // Map planets/satellites altitude/azimuth positions inside 2D circular projection polar grid
  // Altitude 90 (Zenith) -> center of circle (r=0)
  // Altitude 0 (Horizon) -> edge of circle (r=radius)
  const getDomeCoords = (alt: number, az: number) => {
    if (alt <= 0) return null; // Below horizon
    
    // Scale radius: 90 deg -> radius 0, 0 deg -> radius
    const r = radius * (1 - alt / 90);
    // Convert azimuth to radians (measuring clockwise from North/12 o'clock)
    const azRad = (az * Math.PI) / 180;
    
    const centerX = 0;
    const centerY = 0;
    const x = centerX + r * Math.sin(azRad);
    const y = centerY - r * Math.cos(azRad); // Screen Y goes down
    
    return { x, y };
  };

  // Setup Astronomy-Engine Observer & Date
  const astroObs = new AstroObserver(observer.latitude, observer.longitude, observer.elevationM || 0);
  const dateObj = new Date(currentTime);

  // Compute Alt/Az coordinate mappings for the main stars using astronomy-engine
  const starsMap = new Map<string, {
    id: string;
    name: string;
    ra: number;
    dec: number;
    magnitude: number;
    constellationId?: string;
    x: number;
    y: number;
    altitude: number;
    azimuth: number;
  }>();

  starsList.forEach((star) => {
    try {
      // Calculate Alt/Az coordinates for this star at observer latitude/longitude and simulation time
      const hor = AstroHorizon(dateObj, astroObs, star.ra, star.dec, 'normal');
      
      // Filter out stars below the horizon (Altitude < 0°)
      if (hor.altitude > 0) {
        // Project onto 2D polar mapping coordinate
        const pt = getDomeCoords(hor.altitude, hor.azimuth);
        if (pt) {
          starsMap.set(star.id, {
            ...star,
            altitude: hor.altitude,
            azimuth: hor.azimuth,
            x: pt.x,
            y: pt.y
          });
        }
      }
    } catch (err) {
      console.warn("Failed to trace astronomy-engine coordinate for star id:", star.id, err);
    }
  });

  // Track if a constellation is currently selected
  const isAnyConstSelected = constellationsList.some(c => c.id === selectedObjectId);

  // Compile other visible overhead targets (planets, satellites, ISS)
  // Add 1.5 magnitude headroom to retain planets when dimming starlight
  const filteredPlanets = planets.filter(p => p.magnitude === undefined || p.magnitude <= (cityLightsFilter ? 4.5 : maxMagnitude + 1.5));
  const filteredSatellites = activeSats.filter(s => {
    if (cityLightsFilter) {
      // Satellites are generally very faint, hide them under city glare unless extremely bright
      return s.magnitude !== undefined && s.magnitude <= 1.5;
    }
    return s.magnitude === undefined || s.magnitude <= maxMagnitude + 1.5;
  });
  const filteredIss = iss && (!cityLightsFilter || iss.magnitude === undefined || iss.magnitude <= 1.5) ? iss : null;

  const visiblePlanets = filteredPlanets.filter(p => p.localCoordinates !== undefined && p.localCoordinates !== null && p.localCoordinates.altitude > 0);
  const visibleSatellites = filteredSatellites.filter(s => s.localCoordinates !== undefined && s.localCoordinates !== null && s.localCoordinates.altitude > 0);
  const visibleIss = filteredIss && filteredIss.localCoordinates !== undefined && filteredIss.localCoordinates !== null && filteredIss.localCoordinates.altitude > 0 ? {
    ...filteredIss,
    localCoordinates: filteredIss.localCoordinates
  } : null;

  // Compile all currently visible, toggled targets for the radar sound sweeper
  useEffect(() => {
    const list: Array<{ id: string; name: string; altitude: number; azimuth: number; magnitude: number; type: string }> = [];
    if (showPlanets) {
      visiblePlanets.forEach(p => {
        list.push({
          id: p.id,
          name: p.name,
          altitude: p.localCoordinates?.altitude || 0,
          azimuth: p.localCoordinates?.azimuth || 0,
          magnitude: p.magnitude ?? 1.5,
          type: 'planet'
        });
      });
    }
    if (showSatellites) {
      visibleSatellites.forEach(s => {
        list.push({
          id: s.id,
          name: s.name,
          altitude: s.localCoordinates?.altitude || 0,
          azimuth: s.localCoordinates?.azimuth || 0,
          magnitude: s.magnitude ?? 3.0,
          type: 'satellite'
        });
      });
      if (visibleIss) {
        list.push({
          id: 'iss',
          name: 'ISS',
          altitude: visibleIss.localCoordinates?.altitude || 0,
          azimuth: visibleIss.localCoordinates?.azimuth || 0,
          magnitude: visibleIss.magnitude ?? -2.5,
          type: 'station'
        });
      }
    }
    if (showStars) {
      // Only include the top brightest stars (magnitude <= 2.2) to prevent sound clutter
      Array.from(starsMap.values()).forEach(star => {
        if (star.magnitude <= 2.2) {
          list.push({
            id: star.id,
            name: star.name,
            altitude: star.altitude,
            azimuth: star.azimuth,
            magnitude: star.magnitude,
            type: 'star'
          });
        }
      });
    }
    visibleObjectsRef.current = list;
  }, [visiblePlanets, visibleSatellites, visibleIss, starsMap, showPlanets, showSatellites, showStars, cityLightsFilter]);

  // Calculate orbital path projection coordinates
  const orbitalPathPoints = useMemo(() => {
    if (!selectedObjectId) return [];
    
    const points: { x: number; y: number; altitude: number; azimuth: number }[] = [];
    const observerLoc = { latitude: observer.latitude, longitude: observer.longitude, elevationM: observer.elevationM };
    
    if (selectedObjectId === 'iss') {
      for (let i = 0; i <= 60; i++) {
        const futureTime = new Date(currentTime + i * 1.5 * 60 * 1000);
        const look = getLookAngles(ISS_TLE, observerLoc, futureTime);
        if (look && look.altitude > 0) {
          const pt = getDomeCoords(look.altitude, look.azimuth);
          if (pt) {
            points.push({ ...pt, altitude: look.altitude, azimuth: look.azimuth });
          }
        }
      }
    } else {
      const selectedSat = activeSats.find(s => s.id === selectedObjectId);
      if (selectedSat && selectedSat.inclination !== undefined && selectedSat.period !== undefined && selectedSat.altitude !== undefined) {
        const satIndex = activeSats.findIndex(s => s.id === selectedObjectId);
        const seed = satIndex !== -1 ? satIndex + 1 : 1;
        const periodSec = selectedSat.period;
        
        const steps = 60;
        const stepSizeMs = (periodSec * 1000) / steps;
        
        for (let i = 0; i <= steps; i++) {
          const futureTimeMs = currentTime + i * stepSizeMs;
          const pos = getSatellitePosition(
            selectedSat.inclination,
            selectedSat.period,
            selectedSat.altitude,
            seed,
            futureTimeMs
          );
          const look = calculateSatelliteAltAz(
            observer.latitude,
            observer.longitude,
            pos.latitude,
            pos.longitude,
            selectedSat.altitude
          );
          if (look.altitude > 0) {
            const pt = getDomeCoords(look.altitude, look.azimuth);
            if (pt) {
              points.push({ ...pt, altitude: look.altitude, azimuth: look.azimuth });
            }
          }
        }
      }
    }
    return points;
  }, [selectedObjectId, currentTime, observer.latitude, observer.longitude, activeSats]);
  
  const totalOverhead = visiblePlanets.length + visibleSatellites.length + (visibleIss ? 1 : 0);

  // High-fidelity azimuth tick marks (every 10 degrees)
  const tickMarks = [];
  const centerX = 0;
  const centerY = 0;
  for (let deg = 0; deg < 360; deg += 10) {
    const rad = (deg * Math.PI) / 180;
    const isMajor = deg % 30 === 0;
    const tickLen = isMajor ? 6 : 3;
    const x1 = centerX + radius * Math.sin(rad);
    const y1 = centerY - radius * Math.cos(rad);
    const x2 = centerX + (radius - tickLen) * Math.sin(rad);
    const y2 = centerY - (radius - tickLen) * Math.cos(rad);
    tickMarks.push({ x1, y1, x2, y2, isMajor, deg });
  }

  // Faint outer degrees labels next to extreme ticks
  const degreeLabels = [30, 60, 120, 150, 210, 240, 300, 330].map(deg => {
    const rad = (deg * Math.PI) / 180;
    const dist = radius + 9;
    const x = centerX + dist * Math.sin(rad);
    const y = centerY - dist * Math.cos(rad);
    return { x, y, deg };
  });

  // Calculate sweep path wedge (roughly 45 degrees broad for radar vibe)
  const sweepArcX = radius * Math.sin(Math.PI / 4);
  const sweepArcY = -radius * Math.cos(Math.PI / 4);

  // Active highlighted target details
  const activeObj = hoveredObject || 
    planets.find(p => p.id === selectedObjectId) || 
    activeSats.find(s => s.id === selectedObjectId) || 
    (iss && selectedObjectId === 'iss' ? iss : null) ||
    constellationsList.find(c => c.id === selectedObjectId);

  return (
    <div className="bg-slate-950/40 border border-slate-800/60 rounded-xl p-5 shadow-2xl h-full flex flex-col justify-between backdrop-blur-md" id="skyview-observatory-dome">
      {/* Header */}
      <div className="flex items-center justify-between mb-4 border-b border-slate-900 pb-2">
        <div className="flex items-center gap-2">
          <Crosshair className="w-5 h-5 text-emerald-400 animate-pulse" />
          <h2 className="text-xs font-bold uppercase tracking-widest text-slate-300 font-mono">Scope Radar Planisphere</h2>
        </div>
        <div className="bg-slate-900/80 border border-emerald-500/20 rounded-lg px-2.5 py-1 text-[10px] font-mono flex items-center gap-2 text-slate-400">
          <span className="flex h-1.5 w-1.5 relative">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500"></span>
          </span>
          <span>RADAR FEED: <strong className="text-emerald-400 font-bold">{totalOverhead} ACTIVE</strong></span>
        </div>
      </div>

      {/* Bortle Scale Light Pollution Selector & Deep-Space Toggle */}
      <div className="bg-slate-900/40 border border-slate-800/60 rounded-lg p-2.5 mb-3 flex flex-col gap-2.5" id="bortle-darkness-controls">
        <div className="flex items-center justify-between">
          <span className="text-[10px] uppercase font-mono tracking-wider text-slate-400 font-semibold flex items-center gap-1">
            <Radio className="w-3.5 h-3.5 text-indigo-400 animate-pulse" />
            Bortle Sky Darkness Scale
          </span>
          <span className="text-[9px] font-mono font-bold text-indigo-300 bg-indigo-950/60 border border-indigo-800/40 px-2 py-0.5 rounded uppercase">
            Class {bortleScale}: {
              bortleScale <= 2 ? "PRISTINE" :
              bortleScale <= 4 ? "RURAL" :
              bortleScale <= 6 ? "SUBURBAN" :
              bortleScale <= 8 ? "URBAN" : "INNER-CITY"
            }
          </span>
        </div>
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center gap-3">
            <span className="text-[9px] font-mono text-emerald-400 font-bold">DARK (1)</span>
            <input
              type="range"
              min="1"
              max="9"
              step="1"
              value={bortleScale}
              onChange={(e) => setBortleScale(parseInt(e.target.value))}
              className="flex-1 accent-indigo-500 h-1 bg-slate-950 rounded-lg appearance-none cursor-pointer"
              id="bortle-slider"
            />
            <span className="text-[9px] font-mono text-amber-500 font-bold">GLARE (9)</span>
          </div>
          <span className="text-[8.5px] font-mono text-slate-400 leading-normal block">
            {bortleScale <= 2 ? "Excellent dark sky. Star clusters, nebulae, and faint satellites are fully detectable (Limiting Mag 4.5)." :
             bortleScale <= 4 ? "Rural/semi-suburban. Good visibility, faint star formations visible in clear atmospheric patches (Limiting Mag 3.7)." :
             bortleScale <= 6 ? "Standard Suburban. Medium light pollution. Faint deep space objects shielded by airglow (Limiting Mag 2.9)." :
             bortleScale <= 8 ? "Bright Urban transition. Heavy light pollution. Only major stars and planetary bodies resolved (Limiting Mag 2.1)." :
             "Extreme Inner-city sky. Severe luminous glare. Only the Moon and major solar planets cut through the haze (Limiting Mag 1.3)."}
          </span>
        </div>

        <div className="h-[1px] bg-slate-800/30 my-0.5" />

        <div className="flex items-center justify-between">
          <span className="text-[10px] uppercase font-mono tracking-wider text-slate-400 font-semibold flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
            Deep-Space Star Map Overlay
          </span>
          <button
            type="button"
            onClick={() => setShowDeepSpaceMap(!showDeepSpaceMap)}
            className={`px-3 py-1 rounded text-[9px] font-mono font-bold transition-all cursor-pointer border ${
              showDeepSpaceMap 
                ? 'bg-indigo-600/20 text-indigo-300 border-indigo-500/50 shadow-[0_0_8px_rgba(99,102,241,0.25)]' 
                : 'bg-slate-950/50 text-slate-500 border-slate-800 hover:text-slate-300'
            }`}
          >
            {showDeepSpaceMap ? '[ ACTIVE ]' : '[ DISABLED ]'}
          </button>
        </div>

        <div className="h-[1px] bg-slate-800/30 my-0.5" />

        <div>
          <span className="text-[10px] uppercase font-mono tracking-wider text-slate-400 font-semibold flex items-center gap-1.5 mb-2">
            <Orbit className="w-3.5 h-3.5 text-indigo-400" />
            Planisphere Display Layers
          </span>
          <div className="grid grid-cols-2 gap-1.5">
            <button
              type="button"
              onClick={() => setShowStars(!showStars)}
              className={`py-1 px-2 rounded text-[9px] font-mono font-bold transition-all cursor-pointer border flex items-center justify-between ${
                showStars 
                  ? 'bg-slate-800/80 text-emerald-400 border-emerald-500/20' 
                  : 'bg-slate-950 text-slate-600 border-slate-900'
              }`}
            >
              <span>⭐ STARS</span>
              <span>{showStars ? 'ON' : 'OFF'}</span>
            </button>
            <button
              type="button"
              onClick={() => setShowConstellations(!showConstellations)}
              className={`py-1 px-2 rounded text-[9px] font-mono font-bold transition-all cursor-pointer border flex items-center justify-between ${
                showConstellations 
                  ? 'bg-slate-800/80 text-cyan-400 border-cyan-500/20' 
                  : 'bg-slate-950 text-slate-600 border-slate-900'
              }`}
            >
              <span>🌌 CONSTELL</span>
              <span>{showConstellations ? 'ON' : 'OFF'}</span>
            </button>
            <button
              type="button"
              onClick={() => setShowPlanets(!showPlanets)}
              className={`py-1 px-2 rounded text-[9px] font-mono font-bold transition-all cursor-pointer border flex items-center justify-between ${
                showPlanets 
                  ? 'bg-slate-800/80 text-indigo-300 border-indigo-500/20' 
                  : 'bg-slate-950 text-slate-600 border-slate-900'
              }`}
            >
              <span>🪐 PLANETS</span>
              <span>{showPlanets ? 'ON' : 'OFF'}</span>
            </button>
            <button
              type="button"
              onClick={() => setShowSatellites(!showSatellites)}
              className={`py-1 px-2 rounded text-[9px] font-mono font-bold transition-all cursor-pointer border flex items-center justify-between ${
                showSatellites 
                  ? 'bg-slate-800/80 text-emerald-400 border-emerald-500/20 animate-pulse' 
                  : 'bg-slate-950 text-slate-600 border-slate-900'
              }`}
            >
              <span>📡 SATELLITES</span>
              <span>{showSatellites ? 'ON' : 'OFF'}</span>
            </button>
          </div>
        </div>

        <div className="h-[1px] bg-slate-800/30 my-1.5" />

        <div>
          <span className="text-[10px] uppercase font-mono tracking-wider text-slate-400 font-semibold flex items-center gap-1.5 mb-2">
            <Radio className="w-3.5 h-3.5 text-emerald-400" />
            Environmental & Acoustic Overrides
          </span>
          <div className="grid grid-cols-2 gap-1.5">
            <div
              className={`py-1.5 px-2 rounded text-[9px] font-mono font-bold border flex items-center justify-between bg-indigo-950/20 border-indigo-500/20`}
              title="Current Bortle Atmosphere calibration status"
              id="city-glare-display-btn"
            >
              <span className="flex items-center gap-1 text-indigo-300">🌆 ATMOS FILTER</span>
              <span className={cityLightsFilter ? "text-amber-400 animate-pulse font-bold" : "text-emerald-400 font-bold"}>
                {cityLightsFilter ? 'GLARE ON' : 'GLARE OFF'}
              </span>
            </div>
            <button
              type="button"
              onClick={() => {
                setShowAudioPings(!showAudioPings);
                if (audioCtx && audioCtx.state === 'suspended') {
                  audioCtx.resume();
                }
              }}
              className={`py-1.5 px-2 rounded text-[9px] font-mono font-bold transition-all cursor-pointer border flex items-center justify-between ${
                showAudioPings 
                  ? 'bg-emerald-950/30 text-emerald-400 border-emerald-500/30 shadow-[0_0_8px_rgba(16,185,129,0.15)] animate-pulse' 
                  : 'bg-slate-950 text-slate-500 border-slate-900 hover:text-slate-300'
              }`}
              title="Acoustic sonification beeps when radar sweep crosses visible objects"
              id="sonar-audio-toggle-btn"
            >
              <span className="flex items-center gap-1">
                {showAudioPings ? <Volume2 className="w-3 h-3" /> : <VolumeX className="w-3 h-3" />}
                SONAR PING
              </span>
              <span>{showAudioPings ? 'LIVE' : 'MUTED'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* City Glare Active Warning Overlay */}
      {cityLightsFilter && (
        <div className="mx-2.5 bg-amber-950/35 border border-amber-500/25 rounded-lg p-2 text-[9px] font-mono text-amber-500 flex items-center gap-2 select-none pointer-events-none uppercase tracking-wide leading-tight">
          <EyeOff className="w-3.5 h-3.5 text-amber-400 shrink-0" />
          <span>Bortle Class 8: High city lights active. Faint stars and satellites shielded from sensor feed.</span>
        </div>
      )}

      {/* Dome drawing frame */}
      <div 
         className="relative flex-1 flex items-center justify-center min-h-[310px] select-none py-2"
         id="sky-dome-display-frame"
      >
        <svg
          width="100%"
          height="100%"
          viewBox={`-${radius + 35} -${radius + 35} ${radius * 2 + 70} ${radius * 2 + 70}`}
          className="max-w-[390px] max-h-[390px] w-full h-auto aspect-square overflow-visible"
        >
          <defs>
            <radialGradient id="sky-dome-grad" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor={skyCenterColor} />
              <stop offset="70%" stopColor={skyMidColor} />
              <stop offset="100%" stopColor={skyEdgeColor} />
            </radialGradient>
            
            <radialGradient id="nebula-cloud-1" cx="30%" cy="30%" r="50%">
              <stop offset="0%" stopColor="#312e81" stopOpacity="0.25" />
              <stop offset="50%" stopColor="#1e1b4b" stopOpacity="0.12" />
              <stop offset="100%" stopColor="#030712" stopOpacity="0" />
            </radialGradient>
            
            <radialGradient id="nebula-cloud-2" cx="70%" cy="60%" r="45%">
              <stop offset="0%" stopColor="#581c87" stopOpacity="0.22" />
              <stop offset="60%" stopColor="#3b0764" stopOpacity="0.08" />
              <stop offset="100%" stopColor="#030712" stopOpacity="0" />
            </radialGradient>

            <linearGradient id="radar-sweep-grad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#10b981" stopOpacity="0.18" />
              <stop offset="100%" stopColor="#10b981" stopOpacity="0.0" />
            </linearGradient>

            <filter id="neon-green" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {/* Radar background base */}
          <circle r={radius} fill="url(#sky-dome-grad)" stroke="#1e293b" strokeWidth="2" />
          
          {/* Deep space nebulae & faint stars overlays */}
          {showDeepSpaceMap && (
            <>
              <g id="deep-space-nebulae" className="pointer-events-none transition-all duration-700">
                <circle cx={-radius * 0.4} cy={-radius * 0.3} r={radius * 0.75} fill="url(#nebula-cloud-1)" />
                <circle cx={radius * 0.3} cy={radius * 0.4} r={radius * 0.7} fill="url(#nebula-cloud-2)" />
              </g>
              <g id="deep-space-faint-stars" className="pointer-events-none transition-all duration-700">
                {deepSpaceBgStars.map((s, idx) => (
                  <circle key={`bg-star-${idx}`} cx={s.cx} cy={s.cy} r={s.r} fill={s.color} opacity={s.opacity * 0.85} />
                ))}
              </g>
            </>
          )}

          <circle r={radius + 4} fill="none" stroke="#334155" strokeWidth="0.5" opacity="0.4" />

          {/* Azimuth tick marks (radar scale) */}
          {tickMarks.map((tick, idx) => (
            <line
              key={`tick-${idx}`}
              x1={tick.x1}
              y1={tick.y1}
              x2={tick.x2}
              y2={tick.y2}
              stroke={tick.isMajor ? '#475569' : '#1e293b'}
              strokeWidth={tick.isMajor ? '1.2' : '0.8'}
            />
          ))}

          {/* Compass labels around outer edge */}
          <g className="font-mono text-[9px] font-bold fill-slate-500">
            {degreeLabels.map((lbl, idx) => (
              <text
                key={`lbl-${idx}`}
                x={lbl.x}
                y={lbl.y + 3}
                textAnchor="middle"
                opacity="0.6"
              >
                {lbl.deg}
              </text>
            ))}
          </g>

          {/* Elevation Rings (Altitude) */}
          <circle r={radius * 0.167} fill="none" stroke="#1e293b" strokeWidth="0.5" strokeDasharray="2 3" opacity="0.4" />
          <circle r={radius * 0.333} fill="none" stroke="#0f172a" strokeWidth="1" strokeDasharray="3 3" />
          <circle r={radius * 0.333} fill="none" stroke="#334155" strokeWidth="0.5" opacity="0.4" />
          <circle r={radius * 0.5} fill="none" stroke="#1e293b" strokeWidth="0.5" strokeDasharray="2 3" opacity="0.3" />
          <circle r={radius * 0.667} fill="none" stroke="#0f172a" strokeWidth="1" strokeDasharray="3 3" />
          <circle r={radius * 0.667} fill="none" stroke="#334155" strokeWidth="0.5" opacity="0.4" />
          <circle r={radius * 0.833} fill="none" stroke="#1e293b" strokeWidth="0.5" strokeDasharray="2 3" opacity="0.3" />

          {/* Elevation Labels along the vertical line */}
          <g className="font-mono text-[7px] font-bold fill-slate-600 select-none">
            <text x="5" y={-radius * 0.833 + 3}>15°</text>
            <text x="5" y={-radius * 0.667 + 3} className="fill-emerald-600/80">30°</text>
            <text x="5" y={-radius * 0.5 + 3}>45°</text>
            <text x="5" y={-radius * 0.333 + 3} className="fill-emerald-600/80">60°</text>
            <text x="5" y={-radius * 0.167 + 3}>75°</text>
          </g>

          {/* Cardinal direction axis spokes */}
          <line x1="0" y1={-radius} x2="0" y2={radius} stroke="#1e293b" strokeWidth="0.75" />
          <line x1={-radius} y1="0" x2={radius} y2="0" stroke="#1e293b" strokeWidth="0.75" />

          {/* Cardinal Compass Directions */}
          <g className="font-mono text-[10px] font-bold fill-emerald-500/80">
            <text x="0" y={-radius - 8} textAnchor="middle">N</text>
            <text x={radius + 12} y="3" textAnchor="middle">E</text>
            <text x="0" y={radius + 16} textAnchor="middle">S</text>
            <text x={-radius - 12} y="3" textAnchor="middle">W</text>
          </g>

          {/* Active sweeping radar line overlay */}
          <g className="pointer-events-none" style={{ transformOrigin: '0px 0px' }}>
            <g transform={`rotate(${sweepAngle})`} style={{ transformOrigin: '0px 0px' }}>
              <path
                d={`M 0 0 L 0 -${radius} A ${radius} ${radius} 0 0 1 ${sweepArcX} ${sweepArcY} Z`}
                fill="url(#radar-sweep-grad)"
              />
              <line x1="0" y1="0" x2="0" y2={-radius} stroke="#10b981" strokeWidth="1.2" opacity="0.6" filter="url(#neon-green)" />
            </g>
          </g>

          {/* Zenith pointer crosshair center */}
          <circle r="4" fill="none" stroke="#475569" strokeWidth="0.7" />
          <circle r="1" fill="#10b981" />

          {/* Layer 0.5: Satellite orbital path trajectory */}
          {showSatellites && orbitalPathPoints.length > 1 && (
            <g id="satellite-orbital-projection">
              {/* Glow backdrop line */}
              <path
                d={`M ${orbitalPathPoints.map(p => `${p.x} ${p.y}`).join(' L ')}`}
                fill="none"
                stroke={
                  activeSats.find(s => s.id === selectedObjectId)?.color || 
                  (selectedObjectId === 'iss' ? '#ef4444' : '#10b981')
                }
                strokeWidth="3.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                opacity="0.18"
                className="pointer-events-none"
              />
              {/* Sharp dash-array core trajectory line */}
              <path
                d={`M ${orbitalPathPoints.map(p => `${p.x} ${p.y}`).join(' L ')}`}
                fill="none"
                stroke={
                  activeSats.find(s => s.id === selectedObjectId)?.color || 
                  (selectedObjectId === 'iss' ? '#f87171' : '#34d399')
                }
                strokeWidth="1.2"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeDasharray="4 4"
                opacity="0.8"
                className="pointer-events-none"
              />
              {/* Projected path start indicator */}
            </g>
          )}

          {/* Layer 1: Constellation Connections */}
          <g id="radar-constellation-lines">
            {showConstellations && constellationsList.map((constellation) => {
              const isSelected = selectedObjectId === constellation.id;
              const isHovered = hoveredObject?.id === constellation.id;

              // Filter links connecting visible stars
              const visibleTies = constellation.connections
                .map(([s1, s2]) => {
                  const p1 = starsMap.get(s1);
                  const p2 = starsMap.get(s2);
                  if (p1 && p2) return { p1, p2 };
                  return null;
                })
                .filter((tie): tie is { p1: any; p2: any } => tie !== null);

              if (visibleTies.length === 0) return null;

              return (
                <g
                  key={constellation.id}
                  onClick={() => onSelectObject({
                    id: constellation.id,
                    name: constellation.name,
                    type: 'constellation',
                    color: constellation.color || '#22d3ee',
                    size: 5,
                    description: constellation.description,
                    abbreviation: constellation.abbreviation,
                    brightestStar: constellation.brightestStar
                  })}
                  onMouseEnter={() => setHoveredObject({ ...constellation, type: 'constellation' })}
                  onMouseLeave={() => setHoveredObject(null)}
                  className="cursor-pointer group select-none"
                >
                  {/* Invisible thicker lines to make clicking very easy */}
                  {visibleTies.map((tie, idx) => (
                    <line
                      key={`hit-${idx}`}
                      x1={tie.p1.x}
                      y1={tie.p1.y}
                      x2={tie.p2.x}
                      y2={tie.p2.y}
                      stroke="transparent"
                      strokeWidth="10"
                      className="cursor-pointer"
                    />
                  ))}

                  {/* Aesthetic visual constellation lines */}
                  {visibleTies.map((tie, idx) => (
                    <line
                      key={`line-${idx}`}
                      x1={tie.p1.x}
                      y1={tie.p1.y}
                      x2={tie.p2.x}
                      y2={tie.p2.y}
                      stroke={isSelected ? '#22d3ee' : isHovered ? '#38bdf8' : '#334155'}
                      strokeWidth={isSelected ? '2.5' : isHovered ? '1.5' : '0.8'}
                      opacity={isSelected ? '0.9' : isHovered ? '0.7' : '0.35'}
                      strokeDasharray={isSelected ? undefined : "3 3"}
                      className="transition-all duration-300 pointer-events-none"
                    />
                  ))}
                </g>
              );
            })}
          </g>

          {/* Layer 2: Main Stars Plotting */}
          <g id="radar-celestial-stars">
            {showStars && Array.from(starsMap.values()).map((star) => {
              const isSelectedConstStar = selectedObjectId ? star.constellationId === selectedObjectId : false;
              const isHovered = hoveredObject?.id === star.id;
              const isDimmed = isAnyConstSelected && !isSelectedConstStar;

              // Size and opacity scaling based on star brightness magnitude
              const starRadius = Math.max(0.8, Math.min(3.5, 3.2 - 0.5 * star.magnitude));
              const starOpacity = Math.max(0.2, Math.min(0.9, 1.0 - 0.15 * star.magnitude));

              return (
                <g 
                  key={star.id} 
                  className="transition-all duration-300"
                  onMouseEnter={() => setHoveredObject({ ...star, type: 'star', id: star.id, localCoordinates: { altitude: star.altitude, azimuth: star.azimuth }, description: `A major star in the stellar sphere. Magnitude: ${star.magnitude}` })}
                  onMouseLeave={() => setHoveredObject(null)}
                >
                  {/* Glowing halo for selected constellation stars */}
                  {isSelectedConstStar && (
                    <circle
                      cx={star.x}
                      cy={star.y}
                      r={starRadius + 3}
                      fill="none"
                      stroke="#22d3ee"
                      strokeWidth="0.5"
                      opacity="0.8"
                      className="animate-pulse pointer-events-none"
                    />
                  )}
                  {/* Subtle ping animation/glow pulse on hover */}
                  {isHovered && (
                    <circle
                      cx={star.x}
                      cy={star.y}
                      r={starRadius + 6}
                      fill="none"
                      stroke="#22d3ee"
                      strokeWidth="0.75"
                      opacity="0.8"
                      className="animate-ping pointer-events-none"
                    />
                  )}
                  {/* Core Star Sphere */}
                  <circle
                    cx={star.x}
                    cy={star.y}
                    r={starRadius}
                    fill={isDimmed ? "#1e293b" : "#ffffff"}
                    opacity={isDimmed ? 0.15 : starOpacity}
                    className="transition-all duration-300 cursor-help"
                  />
                  {/* Optional tiny key star label */}
                  {!isDimmed && star.magnitude <= 1.8 && radius > 115 && (
                    <text
                      x={star.x}
                      y={star.y + starRadius + 7}
                      fill="#94a3b8"
                      textAnchor="middle"
                      className="font-mono text-[6px] tracking-tighter opacity-70 pointer-events-none"
                    >
                      {star.name}
                    </text>
                  )}
                </g>
              );
            })}
          </g>

          {/* Layer 3: Plotted Planets Group */}
          <g id="radar-planets">
            {showPlanets && visiblePlanets.map((planet) => {
              const pt = getDomeCoords(planet.localCoordinates?.altitude || 0, planet.localCoordinates?.azimuth || 0);
              if (!pt) return null;

              const isSelected = selectedObjectId === planet.id;
              const isHovered = hoveredObject?.id === planet.id;
              const isDimmed = isAnyConstSelected && selectedObjectId !== planet.id;

              return (
                <g
                  key={planet.id}
                  transform={`translate(${pt.x}, ${pt.y})`}
                  onClick={() => onSelectObject(planet)}
                  onMouseEnter={() => setHoveredObject(planet)}
                  onMouseLeave={() => setHoveredObject(null)}
                  className={`cursor-pointer group transition-all duration-300 ${isDimmed ? 'opacity-30' : ''}`}
                  id={`skyview-planet-${planet.id}`}
                >
                  {/* Neon pulsing ring for selected/hovered item */}
                  {(isSelected || isHovered) && (
                    <g className="pointer-events-none" transform={`rotate(${sweepAngle * 0.3})`}>
                      <circle r="12" fill="none" stroke={planet.color} strokeWidth="1" strokeDasharray="3 3" />
                      <path d="M -7 -4 L -7 -7 L -4 -7" fill="none" stroke={planet.color} strokeWidth="0.85" />
                      <path d="M 7 -4 L 7 -7 L 4 -7" fill="none" stroke={planet.color} strokeWidth="0.85" />
                      <path d="M -7 4 L -7 7 L -4 7" fill="none" stroke={planet.color} strokeWidth="0.85" />
                      <path d="M 7 4 L 7 7 L 4 7" fill="none" stroke={planet.color} strokeWidth="0.85" />
                    </g>
                  )}
                  {/* Aura glowing background */}
                  <circle r="9" fill={planet.color} opacity={isSelected ? 0.25 : 0.08} className="group-hover:scale-130 transition duration-150 pointer-events-none" />
                  
                  {/* Additional ping wave outer ring on hover/selected */}
                  {(isSelected || isHovered) && (
                    <circle r="15" fill="none" stroke={planet.color} strokeWidth="0.5" className="animate-ping pointer-events-none" opacity="0.45" />
                  )}
                  
                  {/* Inner signal core point */}
                  <circle r={planet.size * 0.75} fill={planet.color} stroke="#020617" strokeWidth="1.2" className="pointer-events-none" />

                  {/* label tag text display */}
                  {radius > 115 && (
                    <text
                      y="14"
                      fill={(isSelected || isHovered) ? "#ffffff" : "#94a3b8"}
                      textAnchor="middle"
                      className="font-mono text-[8px] font-bold tracking-tight pointer-events-none transition-colors"
                    >
                      {planet.name}
                    </text>
                  )}

                  {/* Invisible hover helper hit focus point */}
                  <circle r="15" fill="transparent" className="cursor-pointer pointer-events-auto" />
                </g>
              );
            })}
          </g>

          {/* Layer 4: Plotted Satellites & ISS Group */}
          <g id="radar-satellites">
            {showSatellites && visibleSatellites.map((sat) => {
              const pt = getDomeCoords(sat.localCoordinates?.altitude || 0, sat.localCoordinates?.azimuth || 0);
              if (!pt) return null;

              const isSelected = selectedObjectId === sat.id;
              const isHovered = hoveredObject?.id === sat.id;
              const isDimmed = isAnyConstSelected && selectedObjectId !== sat.id;

              return (
                <g
                  key={sat.id}
                  transform={`translate(${pt.x}, ${pt.y})`}
                  onClick={() => onSelectObject(sat)}
                  onMouseEnter={() => setHoveredObject(sat)}
                  onMouseLeave={() => setHoveredObject(null)}
                  className={`cursor-pointer group transition-all duration-300 ${isDimmed ? 'opacity-30' : ''}`}
                  id={`skyview-sat-${sat.id}`}
                >
                  {/* Cross reticle target locked wrapper */}
                  {(isSelected || isHovered) ? (
                    <g className="pointer-events-none">
                      <polygon points="0,-8 7,5 -7,5" fill="none" stroke={sat.color || "#10b981"} strokeWidth="1" className="animate-pulse" />
                      <path d="M -6 -3 L -6 -6 L -3 -6" fill="none" stroke={sat.color} strokeWidth="0.85" />
                      <path d="M 6 -3 L 6 -6 L 3 -6" fill="none" stroke={sat.color} strokeWidth="0.85" />
                      <path d="M -6 3 L -6 6 L -3 6" fill="none" stroke={sat.color} strokeWidth="0.85" />
                      <path d="M 6 3 L 6 6 L 3 6" fill="none" stroke={sat.color} strokeWidth="0.85" />
                      {/* CSS ping pulse ring on hover */}
                      <circle r="12" fill="none" stroke={sat.color || "#10b981"} strokeWidth="0.5" className="animate-ping" opacity="0.5" />
                    </g>
                  ) : (
                    <g className="pointer-events-none">
                      <circle r="6" fill={sat.color || "#10b981"} opacity="0.08" className="group-hover:scale-130 transition" />
                      {/* CSS pulse ring */}
                      <circle r="7" fill="none" stroke={sat.color || "#10b981"} strokeWidth="0.5" className="animate-ping" opacity="0.4" />
                    </g>
                  )}

                  {/* Satellite symbol node */}
                  <rect x="-1.5" y="-1.5" width="3" height="3" fill={sat.color} className="pointer-events-none animate-pulse" />
                  <line x1="-3.5" y1="0" x2="3.5" y2="0" stroke={sat.color} strokeWidth="0.8" className="pointer-events-none" />
                  <line x1="0" y1="-3.5" x2="0" y2="3.5" stroke={sat.color} strokeWidth="0.8" className="pointer-events-none" />

                  {/* label display */}
                  {radius > 115 && (
                    <text
                      y="-7"
                      fill={(isSelected || isHovered) ? "#ffffff" : "#64748b"}
                      textAnchor="middle"
                      className="font-mono text-[7px] font-medium pointer-events-none transition-colors"
                    >
                      {sat.name.split(" ")[0]}
                    </text>
                  )}

                  {/* Invisible hover helper hit focus point */}
                  <circle r="12" fill="transparent" className="cursor-pointer pointer-events-auto" />
                </g>
              );
            })}

            {/* Visible International Space Station (ISS) */}
            {showSatellites && visibleIss && (() => {
              const pt = getDomeCoords(visibleIss.localCoordinates?.altitude || 0, visibleIss.localCoordinates?.azimuth || 0);
              if (!pt) return null;

              const isSelected = selectedObjectId === "iss";
              const isHovered = hoveredObject?.id === "iss";
              const isDimmed = isAnyConstSelected && selectedObjectId !== "iss";

              return (
                <g
                  transform={`translate(${pt.x}, ${pt.y})`}
                  onClick={() => onSelectObject(visibleIss)}
                  onMouseEnter={() => setHoveredObject(visibleIss)}
                  onMouseLeave={() => setHoveredObject(null)}
                  className={`cursor-pointer group transition-all duration-300 ${isDimmed ? 'opacity-30' : ''}`}
                  id="skyview-iss-tracker"
                >
                  {/* Heavy telemetry tracking frame */}
                  {(isSelected || isHovered) ? (
                    <g className="pointer-events-none" transform={`rotate(${-sweepAngle * 0.4})`}>
                      <rect x="-9" y="-9" width="18" height="18" fill="none" stroke="#ef4444" strokeWidth="1" />
                      <path d="M -10 -5 L -10 -10 L -5 -10" fill="none" stroke="#ef4444" strokeWidth="1" />
                      <path d="M 10 -5 L 10 -10 L 5 -10" fill="none" stroke="#ef4444" strokeWidth="1" />
                      <path d="M -10 5 L -10 10 L -5 10" fill="none" stroke="#ef4444" strokeWidth="1" />
                      <path d="M 10 5 L 10 10 L 5 10" fill="none" stroke="#ef4444" strokeWidth="1" />
                    </g>
                  ) : (
                    <circle r="12" fill="none" stroke="#ef4444" strokeWidth="0.5" strokeDasharray="3 3" opacity="0.6" className="group-hover:scale-125 transition pointer-events-none" />
                  )}
                  
                  {/* ISS icon design */}
                  <rect x="-4" y="-1.5" width="8" height="3" fill="#ef4444" rx="0.5" className="pointer-events-none" />
                  <rect x="-1" y="-4" width="2" height="8" fill="#ef4444" rx="0.5" className="pointer-events-none" />
                  <circle r="1.5" fill="#ffffff" className="pointer-events-none" />

                  {radius > 115 && (
                    <text
                      y="13"
                      fill="#f87171"
                      textAnchor="middle"
                      className="font-mono text-[8px] font-bold tracking-widest uppercase pointer-events-none"
                    >
                      ISS
                    </text>
                  )}

                  {/* Invisible hover helper hit focus point */}
                  <circle r="16" fill="transparent" className="cursor-pointer pointer-events-auto" />
                </g>
              );
            })()}
          </g>
        </svg>

        {/* Small floating HUD helper top-left */}
        <div className="absolute top-2 left-2 text-[9px] font-mono text-slate-400 bg-slate-950/80 px-2.5 py-1 rounded border border-slate-800/50 flex items-center gap-1.5 pointer-events-none shadow-[0_4px_12px_rgba(0,0,0,0.5)]">
          <Eye className="w-3 h-3 text-emerald-400 animate-pulse" />
          <span>POLAR HORIZON: R=90-ALT | AZ=CW</span>
        </div>
      </div>

      {/* Embedded Real-time Telemetry HUD readout panel */}
      <div className="bg-slate-950/85 border border-emerald-500/20 rounded-lg p-3 font-mono text-[11px] leading-relaxed text-emerald-400 shadow-[inset_0_0_12px_rgba(16,185,129,0.04)] mb-4">
        <div className="flex items-center justify-between border-b border-emerald-500/10 pb-1.5 mb-1.5">
          <div className="flex items-center gap-1.5 font-bold uppercase tracking-wider text-emerald-300">
            <Radio className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
            <span>Scope Telemetry Receiver</span>
          </div>
          <div className="flex items-center gap-1 text-[9px] text-emerald-500 font-bold">
            <Zap className="w-2.5 h-2.5 animate-bounce text-amber-400" />
            <span>FEED ACTIVE</span>
          </div>
        </div>
        
        {activeObj ? (
          <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[11px]">
            <div>TARGET: <span className="text-white font-bold uppercase tracking-wide">{activeObj.name}</span></div>
            <div>STATUS: <span className="font-bold text-emerald-400 uppercase">LOCKED</span></div>
            <div>ELEVATION: <span className="text-amber-400 font-bold">{activeObj.localCoordinates?.altitude != null ? `${activeObj.localCoordinates.altitude.toFixed(3)}°` : (activeObj.altitude != null ? `${activeObj.altitude.toFixed(3)}°` : 'N/A')}</span></div>
            <div>AZIMUTH: <span className="text-amber-400 font-bold">{activeObj.localCoordinates?.azimuth != null ? `${activeObj.localCoordinates.azimuth.toFixed(3)}°` : (activeObj.azimuth != null ? `${activeObj.azimuth.toFixed(3)}°` : 'N/A')}</span></div>
            {activeObj.localCoordinates?.rangeKm != null && (
              <div className="col-span-2">DISTANCE: <span className="text-emerald-300 font-semibold">{activeObj.localCoordinates.rangeKm.toLocaleString()} km</span></div>
            )}
            {activeObj.abbreviation != null && (
              <div className="col-span-2">CONST ABBR: <span className="text-cyan-400 font-bold">{activeObj.abbreviation} (Brightest: {activeObj.brightestStar})</span></div>
            )}
            {activeObj.description && (
              <div className="col-span-2 text-slate-400 text-[10px] mt-1.5 italic border-t border-emerald-500/5 pt-1 text-left leading-relaxed">
                {activeObj.description}
              </div>
            )}
          </div>
        ) : (
          <div className="text-slate-500 italic text-center py-2 h-[42px] flex items-center justify-center text-[10px]">
            Hover or click any celestial object or constellation on the radar grid to bind telemetry feed.
          </div>
        )}
      </div>

      {/* Planisphere details legend block */}
      <div className="border-t border-slate-900 pt-3">
        <span className="text-[9px] font-semibold text-slate-500 font-mono tracking-wider block mb-2 uppercase">LOCKED FEED SIGNATURES:</span>
        <div className="grid grid-cols-4 gap-1 text-[9px] font-mono text-slate-400">
          <div className="flex items-center gap-1 bg-slate-900/30 p-1 rounded border border-slate-900 justify-center">
            <span className="h-1.5 w-1.5 rounded-full bg-white" />
            <span>STARS</span>
          </div>
          <div className="flex items-center gap-1 bg-slate-900/30 p-1 rounded border border-slate-900 justify-center">
            <span className="h-1.5 w-1.5 rounded-full bg-cyan-400" />
            <span>CONSTELL</span>
          </div>
          <div className="flex items-center gap-1 bg-slate-900/30 p-1 rounded border border-slate-900 justify-center">
            <span className="h-1.5 w-1.5 rounded-full bg-indigo-400" />
            <span>PLANETS</span>
          </div>
          <div className="flex items-center gap-1 bg-slate-900/30 p-1 rounded border border-slate-900 justify-center">
            <span className="h-2 text-emerald-400 font-bold block" style={{ transform: 'translateY(-1px)' }}>+</span>
            <span>SATELL</span>
          </div>
        </div>
      </div>
    </div>
  );
}
