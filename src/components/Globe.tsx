import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMapEvents, useMap, Polyline, Circle } from 'react-leaflet';
import L from 'leaflet';
import { Globe as GlobeIcon, Map as MapIcon, Compass, Lock, Unlock } from 'lucide-react';
import { Observer, CelestialObject } from '../types';
import { getIssFuturePath } from '../lib/satellite';

import 'leaflet/dist/leaflet.css';

interface GlobeProps {
  observer: Observer;
  iss: CelestialObject | null;
  satellites: CelestialObject[];
  onSelectCoordinates: (lat: number, lng: number) => void;
  currentTime: number;
  selectedObjectId?: string | null;
  timeMultiplier: number;
  onSelectObject: (obj: CelestialObject | null) => void;
}

// Math helpers for selected satellite path projection on Globe
function getSatellitePosition(inclination: number, period: number, altitude: number, seed: number, timestampMs: number, baseTimestampMs?: number) {
  const angleSpeedRad = (2 * Math.PI) / period;
  const seconds = ((timestampMs / 1000) + seed * 100) % period;
  const u = angleSpeedRad * seconds; // Orbit argument
  
  const incRad = (inclination * Math.PI) / 180;
  const x = Math.cos(u);
  const y = Math.sin(u) * Math.cos(incRad);
  const z = Math.sin(u) * Math.sin(incRad);
  
  const latRad = Math.asin(z);
  let rawLngRad = Math.atan2(y, x);
  
  // Drifting due to Earth rotation (frozen at baseTimestampMs if provided)
  const earthRateRad = (2 * Math.PI) / 86400;
  const driftTimeMs = baseTimestampMs !== undefined ? baseTimestampMs : timestampMs;
  const driftRad = (driftTimeMs / 1000) * earthRateRad;
  let lngRad = rawLngRad - driftRad + (seed * 0.77);
  lngRad = ((lngRad + Math.PI) % (2 * Math.PI));
  if (lngRad < 0) lngRad += 2 * Math.PI;
  lngRad -= Math.PI;
  
  return {
    latitude: (latRad * 180) / Math.PI,
    longitude: (lngRad * 180) / Math.PI,
  };
}

// Helper function to split orbital paths crossing the International Date Line
function splitPathAtDateLine(rawPath: [number, number][]): [number, number][][] {
  if (rawPath.length === 0) return [];
  const segments: [number, number][][] = [];
  let currentSegment: [number, number][] = [];

  for (let i = 0; i < rawPath.length; i++) {
    const current = rawPath[i];
    if (i === 0) {
      currentSegment.push(current);
      continue;
    }
    const prev = rawPath[i - 1];
    const [lat1, lng1] = prev;
    const [lat2, lng2] = current;
    const diffLng = Math.abs(lng2 - lng1);

    if (diffLng > 180) {
      let t: number;
      let latAt180: number;

      if (lng1 > 0 && lng2 < 0) {
        // Crossing East to West (+180 to -180)
        const lng2Adjusted = lng2 + 360;
        t = (180 - lng1) / (lng2Adjusted - lng1);
        latAt180 = lat1 + t * (lat2 - lat1);

        currentSegment.push([latAt180, 180]);
        segments.push(currentSegment);
        currentSegment = [[latAt180, -180], current];
      } else if (lng1 < 0 && lng2 > 0) {
        // Crossing West to East (-180 to +180)
        const lng2Adjusted = lng2 - 360;
        t = (-180 - lng1) / (lng2Adjusted - lng1);
        latAt180 = lat1 + t * (lat2 - lat1);

        currentSegment.push([latAt180, -180]);
        segments.push(currentSegment);
        currentSegment = [[latAt180, 180], current];
      } else {
        segments.push(currentSegment);
        currentSegment = [current];
      }
    } else {
      currentSegment.push(current);
    }
  }

  if (currentSegment.length > 0) {
    segments.push(currentSegment);
  }
  return segments;
}

// ----------------------------------------------------------------------------
// Custom Division Icons (pure CSS and SVG components to avoid image URL bundler breakages)
// ----------------------------------------------------------------------------
const createCustomIcon = (htmlContent: string, className: string, size: [number, number]) => {
  return L.divIcon({
    html: htmlContent,
    className: className,
    iconSize: size,
    iconAnchor: [size[0] / 2, size[1] / 2],
    popupAnchor: [0, -size[1] / 2]
  });
};

const observerIcon = createCustomIcon(`
  <div class="relative flex items-center justify-center">
    <span class="animate-ping absolute inline-flex h-8 w-8 rounded-full bg-indigo-400 opacity-25"></span>
    <span class="relative inline-flex rounded-full h-4 w-4 bg-indigo-500 border-2 border-white shadow-[0_0_12px_rgba(99,102,241,0.7)]"></span>
  </div>
`, 'custom-observer-pin', [32, 32]);

const issIcon = createCustomIcon(`
  <div class="relative flex items-center justify-center">
    <span class="animate-ping absolute inline-flex h-8 w-8 rounded-full bg-red-400 opacity-25"></span>
    <div class="relative flex items-center justify-center p-0.5 bg-slate-950/80 rounded-md border border-red-500/40 shadow-[0_0_10px_rgba(239,68,68,0.5)]">
      <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="#ef4444" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="drop-shadow-[0_0_4px_rgba(239,68,68,0.6)]">
        <!-- Solar Arrays Left -->
        <path d="M 2 7 L 8 7 M 2 12 L 8 12 M 2 17 L 8 17 M 2 7 L 2 17 M 8 7 L 8 17" stroke-width="1" />
        <!-- Solar Arrays Right -->
        <path d="M 16 7 L 22 7 M 16 12 L 22 12 M 16 17 L 22 17 M 16 7 L 16 17 M 22 7 L 22 17" stroke-width="1" />
        <!-- Central Truss & Habitation Modules -->
        <line x1="8" y1="12" x2="16" y2="12" />
        <circle cx="12" cy="12" r="2.5" fill="#020617" stroke="#ef4444" stroke-width="2" />
      </svg>
    </div>
  </div>
`, 'custom-iss-pin', [44, 32]);

const satIconCache: Record<string, L.DivIcon> = {};
const getSatIcon = (color: string) => {
  const hexColor = color || '#10b981';
  if (!satIconCache[hexColor]) {
    satIconCache[hexColor] = createCustomIcon(`
      <div class="relative flex items-center justify-center">
        <span class="animate-pulse absolute inline-flex h-5 w-5 rounded-full" style="background-color: ${hexColor}; opacity: 0.2"></span>
        <span class="relative inline-flex rounded-full h-3.5 w-3.5 border-1.5 border-white shadow-[0_0_6px_${hexColor}]" style="background-color: ${hexColor}"></span>
      </div>
    `, `custom-sat-pin-${hexColor.replace('#', '')}`, [20, 20]);
  }
  return satIconCache[hexColor];
};

// ----------------------------------------------------------------------------
// Sub-components inside MapContainer supporting Leaflet events and control
// ----------------------------------------------------------------------------
function MapEventsHandler({ onMapClick }: { onMapClick: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(e) {
      onMapClick(e.latlng.lat, e.latlng.lng);
    }
  });
  return null;
}

interface FlyToConfig {
  coords: [number, number];
  type: 'flyTo' | 'panTo';
  timestamp: number;
}

// Zoom/Pan animation controller
function MapViewController({ flyToCoords, timeMultiplier, cameraLocked, cameraLockedRef, programmaticFlyRef }: { flyToCoords: FlyToConfig | null; timeMultiplier: number; cameraLocked: boolean; cameraLockedRef: React.RefObject<boolean>; programmaticFlyRef: React.MutableRefObject<boolean> }) {
  const map = useMap();
  const lastCenterRef = useRef<[number, number] | null>(null);
  const targetCoordsRef = useRef<[number, number] | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  useEffect(() => {
    if (!map) return;
    
    // Invalidate map size immediately to adjust to parent containers
    map.invalidateSize();
    
    const container = map.getContainer();
    if (!container) return;
    
    // Use ResizeObserver to auto-update Leaflet size on container size shifts
    const resizeObserver = new ResizeObserver(() => {
      map.invalidateSize();
    });
    
    resizeObserver.observe(container);
    
    // Fallback timer just in case of delayed transitions
    const timer = setTimeout(() => {
      map.invalidateSize();
    }, 250);
    
    return () => {
      resizeObserver.disconnect();
      clearTimeout(timer);
    };
  }, [map]);

  // Restart the rAF loop (used after a flyTo animation finishes)
  const startRafLoop = useCallback(() => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }
    const tick = () => {
      if (!cameraLockedRef.current) {
        if (animationFrameRef.current) {
          cancelAnimationFrame(animationFrameRef.current);
          animationFrameRef.current = null;
        }
        return;
      }
      if (targetCoordsRef.current && map) {
        const [targetLat, targetLng] = targetCoordsRef.current;
        const currentCenter = map.getCenter();
        if (!lastCenterRef.current) {
          lastCenterRef.current = [currentCenter.lat, currentCenter.lng];
        }
        const [lastLat, lastLng] = lastCenterRef.current;
        let diffLng = targetLng - lastLng;
        if (diffLng > 180) diffLng -= 360;
        else if (diffLng < -180) diffLng += 360;
        const baseAlpha = timeMultiplier > 1 ? 0.05 : 0.15;
        const smoothedLat = lastLat + baseAlpha * (targetLat - lastLat);
        const smoothedLng = lastLng + baseAlpha * diffLng;
        lastCenterRef.current = [smoothedLat, smoothedLng];
        let normLng = ((smoothedLng + 180) % 360);
        if (normLng < 0) normLng += 360;
        normLng -= 180;
        const latChange = Math.abs(smoothedLat - currentCenter.lat);
        const lngChange = Math.abs(normLng - currentCenter.lng);
        if (latChange > 0.0001 || lngChange > 0.0001) {
          map.setView([smoothedLat, normLng], map.getZoom(), { animate: false });
        }
      }
      animationFrameRef.current = requestAnimationFrame(tick);
    };
    animationFrameRef.current = requestAnimationFrame(tick);
  }, [map, timeMultiplier, cameraLockedRef]);

  // Update target when flyToCoords changes
  useEffect(() => {
    if (flyToCoords && Array.isArray(flyToCoords.coords)) {
      const [lat, lng] = flyToCoords.coords;
      if (typeof lat === 'number' && typeof lng === 'number' && !isNaN(lat) && !isNaN(lng)) {
        if (flyToCoords.type === 'flyTo') {
          // Cancel any running requestAnimationFrame to let flyTo run cleanly
          if (animationFrameRef.current) {
            cancelAnimationFrame(animationFrameRef.current);
            animationFrameRef.current = null;
          }
          lastCenterRef.current = [lat, lng];
          targetCoordsRef.current = [lat, lng];
          // Set programmatic flag to prevent CenterTracker from interpreting this as user drag
          programmaticFlyRef.current = true;
          map.flyTo([lat, lng], 5, {
            animate: true,
            duration: 1.2,
            easeLinearity: 0.25
          });
          // When flyTo finishes, clear the flag and restart the rAF loop if still locked
          const onMoveEnd = () => {
            programmaticFlyRef.current = false;
            map.off('moveend', onMoveEnd);
            if (cameraLockedRef.current) {
              startRafLoop();
            }
          };
          map.on('moveend', onMoveEnd);
        } else {
          // It's a panTo tracking target update
          targetCoordsRef.current = [lat, lng];
        }
      }
    }
  }, [flyToCoords, map, startRafLoop]);

  // RequestAnimationFrame loop for smooth interpolation at screen refresh rate
  useEffect(() => {
    if (!cameraLocked) {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
      map.stop(); // Stop ongoing Leaflet animations (flyTo/panTo)
      lastCenterRef.current = null;
      targetCoordsRef.current = null;
      return;
    }

    // Only start rAF if no programmatic flyTo is in progress
    // (the flyTo onMoveEnd handler will start rAF when it finishes)
    if (!programmaticFlyRef.current) {
      startRafLoop();
    }

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [cameraLocked, map, timeMultiplier, startRafLoop]);
  return null;
}

function CenterTracker({ setViewCenter, onUserInteraction, programmaticFlyRef }: { setViewCenter: (center: [number, number]) => void; onUserInteraction: () => void; programmaticFlyRef: React.MutableRefObject<boolean> }) {
  const map = useMap();
  useMapEvents({
    move() {
      const center = map.getCenter();
      setViewCenter([center.lat, center.lng]);
    },
    dragstart() {
      // User drag should always unlock the camera and stop any active flyTo/panTo
      onUserInteraction();
    },
    zoomstart() {
      // Only treat as user interaction if NOT a programmatic flyTo
      if (!programmaticFlyRef.current) {
        onUserInteraction();
      }
    }
  });
  return null;
}

export default function Globe({ observer, iss, satellites, onSelectCoordinates, currentTime, selectedObjectId, timeMultiplier, onSelectObject }: GlobeProps) {
  // Mauna Kea (Lat: 19.8206, Lon: -155.4681) as default center on start to sync perfectly
  const DEFAULT_CENTER: [number, number] = [19.8206, -155.4681];
  
  const [flyToCoords, setFlyToCoords] = useState<FlyToConfig | null>(null);
  const [viewCenter, setViewCenter] = useState<[number, number]>(DEFAULT_CENTER);
  const [cameraLocked, _setCameraLocked] = useState<boolean>(true);
  const cameraLockedRef = useRef<boolean>(true);
  const setCameraLocked = useCallback((val: boolean) => {
    cameraLockedRef.current = val;
    _setCameraLocked(val);
  }, []);
  const [mapTheme, setMapTheme] = useState<'dark' | 'satellite'>('satellite');
  const prevSelectedIdRef = useRef<string | null>(null);
  const programmaticFlyRef = useRef<boolean>(false);

  // Throttle heavy path calculations to once every 5 seconds
  const roundedTime = useMemo(() => Math.floor(currentTime / 5000) * 5000, [currentTime]);

  const rawIssPath = useMemo(() => {
    try {
      return getIssFuturePath(roundedTime);
    } catch (e) {
      console.error("Error calculating raw ISS path:", e);
      return [];
    }
  }, [roundedTime]);

  // Generate 90-minute projected track for the ISS centered at current position
  const futurePathSegments = useMemo(() => {
    if (rawIssPath.length === 0 || !iss || !iss.coordinates) return [];
    const pathCopy = [...rawIssPath];
    const midIdx = Math.floor(pathCopy.length / 2);
    if (midIdx >= 0 && midIdx < pathCopy.length) {
      pathCopy[midIdx] = [iss.coordinates.latitude, iss.coordinates.longitude];
    }
    if (pathCopy.length > 0) {
      pathCopy.push(pathCopy[0]);
    }
    return splitPathAtDateLine(pathCopy);
  }, [rawIssPath, iss?.coordinates?.latitude, iss?.coordinates?.longitude]);

  const rawSatellitePath = useMemo(() => {
    if (!selectedObjectId || selectedObjectId === 'iss') return [];
    
    const selectedSat = satellites.find(s => s.id === selectedObjectId);
    if (!selectedSat || selectedSat.inclination === undefined || selectedSat.period === undefined || selectedSat.altitude === undefined) {
      return [];
    }

    try {
      const satIndex = satellites.findIndex(s => s.id === selectedObjectId);
      const seed = satIndex !== -1 ? satIndex + 1 : 1;
      
      const rawPath: [number, number][] = [];
      const periodSec = selectedSat.period;
      const steps = 60;
      const stepSizeMs = (periodSec * 1000) / steps;

      for (let i = -30; i <= 30; i++) {
        const futureTimeMs = roundedTime + i * stepSizeMs;
        const pos = getSatellitePosition(
          selectedSat.inclination,
          selectedSat.period,
          selectedSat.altitude,
          seed,
          futureTimeMs,
          roundedTime
        );
        rawPath.push([pos.latitude, pos.longitude]);
      }
      return rawPath;
    } catch (err) {
      console.error("Error setting up satellite path:", err);
      return [];
    }
  }, [selectedObjectId, satellites, roundedTime]);

  // Generate projected track for the selected satellite (complete orbital period, centered on satellite)
  const satellitePathSegments = useMemo(() => {
    if (rawSatellitePath.length === 0 || !selectedObjectId) return [];
    
    // Find live coords
    let liveCoords: [number, number] | null = null;
    const selectedSat = satellites.find(s => s.id === selectedObjectId);
    if (selectedSat) {
      const lat = selectedSat.coordinates ? selectedSat.coordinates.latitude : selectedSat.latitude;
      const lng = selectedSat.coordinates ? selectedSat.coordinates.longitude : selectedSat.longitude;
      if (typeof lat === 'number' && typeof lng === 'number' && !isNaN(lat) && !isNaN(lng)) {
        liveCoords = [lat, lng];
      }
    }
    
    const pathCopy = [...rawSatellitePath];
    const midIdx = Math.floor(pathCopy.length / 2);
    if (liveCoords && pathCopy.length > 0 && midIdx >= 0 && midIdx < pathCopy.length) {
      pathCopy[midIdx] = liveCoords;
    }
    if (pathCopy.length > 0) {
      pathCopy.push(pathCopy[0]);
    }
    return splitPathAtDateLine(pathCopy);
  }, [rawSatellitePath, selectedObjectId, satellites]);

  // Automatically fly/pan viewport when the observer coordinates shift
  useEffect(() => {
    if (observer && typeof observer.latitude === 'number' && typeof observer.longitude === 'number' && !isNaN(observer.latitude) && !isNaN(observer.longitude)) {
      setFlyToCoords({ coords: [observer.latitude, observer.longitude], type: 'flyTo', timestamp: Date.now() });
    }
  }, [observer.latitude, observer.longitude]);

  // Smoothly fly to selected satellite or ISS once on selection change
  useEffect(() => {
    if (!selectedObjectId) {
      prevSelectedIdRef.current = null;
      return;
    }

    if (selectedObjectId !== prevSelectedIdRef.current) {
      prevSelectedIdRef.current = selectedObjectId;
      
      let coords: [number, number] | null = null;
      if (selectedObjectId === 'iss') {
        if (iss && iss.coordinates && typeof iss.coordinates.latitude === 'number' && typeof iss.coordinates.longitude === 'number') {
          coords = [iss.coordinates.latitude, iss.coordinates.longitude];
        }
      } else {
        const sat = satellites.find(s => s.id === selectedObjectId);
        if (sat && typeof sat.latitude === 'number' && typeof sat.longitude === 'number') {
          coords = [sat.latitude, sat.longitude];
        }
      }

      if (coords) {
        setFlyToCoords({ coords, type: 'flyTo', timestamp: Date.now() });
        setCameraLocked(true); // Automatically re-engage tracking on fresh selection
      }
    }
  }, [selectedObjectId, satellites, iss]);

  const selectedSatCoords = useMemo(() => {
    if (!selectedObjectId || selectedObjectId === 'iss') return null;
    const sat = satellites.find(s => s.id === selectedObjectId);
    if (!sat) return null;
    const lat = sat.coordinates ? sat.coordinates.latitude : sat.latitude;
    const lng = sat.coordinates ? sat.coordinates.longitude : sat.longitude;
    if (typeof lat === 'number' && typeof lng === 'number' && !isNaN(lat) && !isNaN(lng)) {
      return [lat, lng] as [number, number];
    }
    return null;
  }, [selectedObjectId, satellites]);

  const selectedSatLat = selectedSatCoords ? selectedSatCoords[0] : null;
  const selectedSatLng = selectedSatCoords ? selectedSatCoords[1] : null;

  // Smoothly follow the moving target on updates if cameraLocked is enabled
  useEffect(() => {
    if (!cameraLocked || !selectedObjectId) return;

    let coords: [number, number] | null = null;
    if (selectedObjectId === 'iss') {
      if (iss && iss.coordinates && typeof iss.coordinates.latitude === 'number' && typeof iss.coordinates.longitude === 'number') {
        coords = [iss.coordinates.latitude, iss.coordinates.longitude];
      }
    } else if (selectedSatCoords) {
      coords = selectedSatCoords;
    }

    if (coords) {
      setFlyToCoords({ coords, type: 'panTo', timestamp: Date.now() });
    }
  }, [cameraLocked, selectedObjectId, iss?.coordinates?.latitude, iss?.coordinates?.longitude, selectedSatLat, selectedSatLng]);



  // Focus action triggered from the panel header
  const handleFocusStation = () => {
    if (observer && typeof observer.latitude === 'number' && typeof observer.longitude === 'number' && !isNaN(observer.latitude) && !isNaN(observer.longitude)) {
      setCameraLocked(false);
      setFlyToCoords({ coords: [observer.latitude, observer.longitude], type: 'flyTo', timestamp: Date.now() });
    }
  };

  const handleFocusLiveLocation = () => {
    setCameraLocked(false);
    if (typeof window !== 'undefined' && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords;
          onSelectCoordinates(latitude, longitude);
        },
        (error) => {
          console.warn("Geolocation access denied or failed:", error);
          alert("Could not acquire live location. Please check browser location permissions.");
        },
        { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
      );
    } else {
      alert("Geolocation is not supported by this browser.");
    }
  };

  const handleMapClick = (lat: number, lng: number) => {
    // Standardize longitude between [-180, 180]
    let normalLng = ((lng + 180) % 360);
    if (normalLng < 0) normalLng += 360;
    normalLng -= 180;

    // Standardize latitude between [-90, 90]
    const normalLat = Math.max(-90, Math.min(90, lat));

    setCameraLocked(false);
    onSelectCoordinates(normalLat, normalLng);
  };

  return (
    <div className="bg-slate-950/40 border border-slate-800/60 rounded-xl p-5 shadow-2xl h-full flex flex-col justify-between backdrop-blur-md" id="earth-globe-panel">
      {/* Panel Header */}
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-3 mb-4 border-b border-slate-900 pb-2.5">
        <div className="flex items-center gap-2">
          <GlobeIcon className="w-5 h-5 text-indigo-400 shrink-0" />
          <h2 className="text-sm font-bold uppercase tracking-widest text-slate-300 font-serif">Geocentric Tracker</h2>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          {/* Map Theme Toggle */}
          <button
            onClick={() => setMapTheme(mapTheme === 'dark' ? 'satellite' : 'dark')}
            className={`p-1 px-2.5 rounded-lg border text-xs font-mono transition flex items-center gap-1 cursor-pointer ${
              mapTheme === 'satellite'
                ? 'border-emerald-500/30 bg-emerald-950/15 text-emerald-400 hover:text-emerald-300'
                : 'border-slate-800 bg-slate-900/60 text-slate-400 hover:text-white hover:border-slate-700'
            }`}
            title="Switch Map theme (Tactical Dark / Satellite Imagery)"
            id="map-theme-toggle-btn"
          >
            <GlobeIcon className={`w-2.5 h-2.5 ${mapTheme === 'satellite' ? 'text-emerald-400 animate-pulse' : 'text-indigo-400'}`} />
            <span>{mapTheme === 'dark' ? 'DARK MAP' : 'SATELLITE'}</span>
          </button>

          {/* Camera Lock Toggle */}
          <button
            onClick={() => {
              const newLocked = !cameraLocked;
              setCameraLocked(newLocked);
              if (newLocked && selectedObjectId) {
                // Focus on the selected object immediately when re-locking
                let coords: [number, number] | null = null;
                if (selectedObjectId === 'iss') {
                  if (iss && iss.coordinates) coords = [iss.coordinates.latitude, iss.coordinates.longitude];
                } else {
                  const sat = satellites.find(s => s.id === selectedObjectId);
                  if (sat) {
                    const lat = sat.coordinates ? sat.coordinates.latitude : sat.latitude;
                    const lng = sat.coordinates ? sat.coordinates.longitude : sat.longitude;
                    if (typeof lat === 'number' && typeof lng === 'number') {
                      coords = [lat, lng];
                    }
                  }
                }
                if (coords) {
                  setFlyToCoords({ coords, type: 'flyTo', timestamp: Date.now() });
                }
              }
            }}
            className={`p-1 px-2.5 rounded-lg border text-xs font-mono transition flex items-center gap-1 cursor-pointer ${
              cameraLocked
                ? 'border-indigo-500/40 bg-indigo-500/10 text-indigo-300 shadow-[0_0_8px_rgba(99,102,241,0.15)] font-bold'
                : 'border-slate-800 bg-slate-900/60 text-slate-400 hover:text-white hover:border-slate-700'
            }`}
            title={cameraLocked ? "Camera locked on active target (Manual map drag/zoom will unlock)" : "Camera tracking unlocked (Free Cam)"}
            id="camera-lock-toggle-btn"
          >
            {cameraLocked ? (
              <Lock className="w-2.5 h-2.5 text-indigo-400 animate-pulse" />
            ) : (
              <Unlock className="w-2.5 h-2.5 text-slate-500" />
            )}
            <span>{cameraLocked ? 'TRACKING' : 'FREE CAM'}</span>
          </button>

          <div className="h-3 w-[1px] bg-slate-800 hidden xl:block" />

          <button
            onClick={handleFocusStation}
            className="p-1 px-2.5 rounded-lg border border-slate-800 bg-slate-900/60 text-xs text-slate-400 hover:text-white transition flex items-center gap-1 font-mono hover:border-indigo-500/50 cursor-pointer"
            title="Focus map on Station observer location"
            id="snap-focus-btn"
          >
            <MapIcon className="w-2.5 h-2.5 text-indigo-400" />
            <span>STATION</span>
          </button>
          <button
            onClick={handleFocusLiveLocation}
            className="p-1 px-2.5 rounded-lg border border-slate-800 bg-slate-900/60 text-xs text-slate-400 hover:text-white transition flex items-center gap-1 font-mono hover:border-indigo-500/50 cursor-pointer"
            title="Acquire and focus map on your live browser location"
            id="snap-live-loc-btn"
          >
            <Compass className="w-2.5 h-2.5 text-emerald-400" />
            <span>LIVE LOC</span>
          </button>
        </div>
      </div>

      {/* Full-width, responsive container */}
      <div className="relative flex-1 min-h-[300px] w-full rounded-xl overflow-hidden border border-slate-800/60 bg-slate-950/90 shadow-inner flex items-center justify-center" id="globe-viewport-wrapper">
        <div className="relative w-full h-full" id="leaflet-map-wrapper">
            <style>{`
              .leaflet-tile {
                filter: brightness(0.9) contrast(1.15) saturate(0.95);
                transition: opacity 0.5s ease-in-out;
              }
              .leaflet-container {
                background: #020617 !important;
              }
              /* Smooth animations for zooming and panning */
              .leaflet-zoom-animated {
                transition: transform 0.2s cubic-bezier(0.25, 1, 0.5, 1) !important;
              }
              /* Custom styled Leaflet zoom buttons for elite glassmorphism */
              .leaflet-bar {
                border: 1px solid rgba(99, 102, 241, 0.2) !important;
                box-shadow: 0 4px 14px rgba(0, 0, 0, 0.6) !important;
                border-radius: 8px !important;
                overflow: hidden;
                backdrop-filter: blur(8px);
              }
              .leaflet-bar a {
                background-color: rgba(15, 23, 42, 0.85) !important;
                color: #94a3b8 !important;
                border-bottom: 1px solid rgba(99, 102, 241, 0.1) !important;
                transition: all 0.2s ease;
              }
              .leaflet-bar a:hover {
                background-color: rgba(99, 102, 241, 0.3) !important;
                color: #ffffff !important;
              }
              /* Custom styled Leaflet popups for premium dark theme contrast */
              .leaflet-popup-content-wrapper {
                background: rgba(15, 23, 42, 0.95) !important;
                color: #f1f5f9 !important;
                border: 1px solid rgba(99, 102, 241, 0.25) !important;
                box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.7), 0 8px 10px -6px rgba(0, 0, 0, 0.7) !important;
                border-radius: 10px !important;
                backdrop-filter: blur(8px);
              }
              .leaflet-popup-tip {
                background: rgba(15, 23, 42, 0.95) !important;
                border-left: 1px solid rgba(99, 102, 241, 0.25) !important;
                border-bottom: 1px solid rgba(99, 102, 241, 0.25) !important;
                box-shadow: none !important;
              }
              .leaflet-popup-close-button {
                color: #94a3b8 !important;
                font-weight: bold;
                padding: 4px 6px 0 0 !important;
              }
              .leaflet-popup-close-button:hover {
                color: #ffffff !important;
                background: transparent !important;
              }
            `}</style>

            <MapContainer
              center={DEFAULT_CENTER}
              zoom={3}
              style={{ height: '100%', width: '100%' }}
              minZoom={3}
              maxZoom={12}
              zoomControl={true}
              attributionControl={false}
              maxBounds={[[-85, -180], [85, 180]]}
              maxBoundsViscosity={1.0}
              className="z-10"
            >
              {/* Conditional rendering of map themes */}
              {mapTheme === 'dark' ? (
                <>
                  <TileLayer
                    key="dark-base"
                    url="https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}"
                    attribution='&copy; Esri, HERE, Garmin, NGA, USGS'
                    keepBuffer={2}
                    updateWhenIdle={true}
                    updateWhenZooming={false}
                  />
                  <TileLayer
                    key="dark-reference"
                    url="https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Reference/MapServer/tile/{z}/{y}/{x}"
                    attribution='&copy; Esri, HERE, Garmin, NGA, USGS'
                    keepBuffer={2}
                    updateWhenIdle={true}
                    updateWhenZooming={false}
                  />
                </>
              ) : (
                <>
                  <TileLayer
                    key="satellite-base"
                    url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
                    attribution='&copy; Esri, Maxar, Earthstar Geographics, USDA FSA, USGS'
                    keepBuffer={2}
                    updateWhenIdle={true}
                    updateWhenZooming={false}
                  />
                  <TileLayer
                    key="satellite-reference"
                    url="https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}"
                    attribution='&copy; Esri, HERE, Garmin, NGA, USGS'
                    keepBuffer={2}
                    updateWhenIdle={true}
                    updateWhenZooming={false}
                  />
                </>
              )}

              {/* Click observer to update parent state */}
              <MapEventsHandler onMapClick={handleMapClick} />
              
              {/* Zoom/Pan animation controller */}
              <MapViewController flyToCoords={flyToCoords} timeMultiplier={timeMultiplier} cameraLocked={cameraLocked} cameraLockedRef={cameraLockedRef} programmaticFlyRef={programmaticFlyRef} />

              {/* Map view center tracker with auto-unlock interaction trigger */}
              <CenterTracker setViewCenter={setViewCenter} onUserInteraction={() => setCameraLocked(false)} programmaticFlyRef={programmaticFlyRef} />

              {/* Future orbital path of the ISS (glowing trailing line) */}
              {iss && futurePathSegments && futurePathSegments.map((segment, idx) => {
                if (!segment) return null;
                const validSegment = segment.filter(pt => 
                  Array.isArray(pt) && 
                  pt.length === 2 && 
                  typeof pt[0] === 'number' && 
                  typeof pt[1] === 'number' && 
                  !isNaN(pt[0]) && 
                  !isNaN(pt[1]) && 
                  isFinite(pt[0]) && 
                  isFinite(pt[1])
                );
                if (validSegment.length < 2) return null;

                return [
                  /* Outer core glow (thick, semi-transparent red) */
                  <Polyline
                    key={`iss-path-glow-outer-${idx}`}
                    positions={validSegment}
                    pathOptions={{
                      color: '#f87171',
                      weight: 6,
                      opacity: 0.35,
                      lineCap: 'round',
                      lineJoin: 'round',
                    }}
                  />,
                  /* Inner bright core (thin, high contrast dashed white-pink) */
                  <Polyline
                    key={`iss-path-glow-inner-${idx}`}
                    positions={validSegment}
                    pathOptions={{
                      color: '#ffffff',
                      weight: 2,
                      opacity: 0.9,
                      lineCap: 'round',
                      lineJoin: 'round',
                      dashArray: '6, 6',
                    }}
                  />
                ];
              })}

              {/* Future orbital path of selected Satellite (glowing trailing line) */}
              {selectedObjectId && selectedObjectId !== 'iss' && satellitePathSegments && satellitePathSegments.map((segment, idx) => {
                if (!segment) return null;
                const validSegment = segment.filter(pt => 
                  Array.isArray(pt) && 
                  pt.length === 2 && 
                  typeof pt[0] === 'number' && 
                  typeof pt[1] === 'number' && 
                  !isNaN(pt[0]) && 
                  !isNaN(pt[1]) && 
                  isFinite(pt[0]) && 
                  isFinite(pt[1])
                );
                if (validSegment.length < 2) return null;

                const selectedSat = satellites.find(s => s.id === selectedObjectId);
                const satColor = selectedSat?.color || '#10b981';

                return [
                  /* Outer core glow (thick, semi-transparent satellite color) */
                  <Polyline
                    key={`sat-path-glow-outer-${idx}`}
                    positions={validSegment}
                    pathOptions={{
                      color: satColor,
                      weight: 6,
                      opacity: 0.35,
                      lineCap: 'round',
                      lineJoin: 'round',
                    }}
                  />,
                  /* Inner bright core (thin, high contrast dashed white-color) */
                  <Polyline
                    key={`sat-path-glow-inner-${idx}`}
                    positions={validSegment}
                    pathOptions={{
                      color: '#ffffff',
                      weight: 1.8,
                      opacity: 0.9,
                      lineCap: 'round',
                      lineJoin: 'round',
                      dashArray: '5, 5',
                    }}
                  />
                ];
              })}

              {/* Observer Station Marker */}
              {observer && typeof observer.latitude === 'number' && typeof observer.longitude === 'number' && !isNaN(observer.latitude) && !isNaN(observer.longitude) && (
                <Marker position={[observer.latitude, observer.longitude]} icon={observerIcon}>
                  <Popup className="custom-leaflet-popup">
                    <div className="p-1 text-slate-100 font-mono text-xs">
                      <p className="font-bold border-b border-slate-800 pb-1 text-indigo-400">ACTIVE OBS STATION</p>
                      <p className="mt-1 font-sans">{observer.name}</p>
                      <p className="mt-1 font-bold">LAT: {observer.latitude.toFixed(4)}°</p>
                      <p>LNG: {observer.longitude.toFixed(4)}°</p>
                    </div>
                  </Popup>
                </Marker>
              )}

              {/* Orbiting ISS satellite marker */}
              {iss && (
                (() => {
                  const pos = iss.coordinates ? [iss.coordinates.latitude, iss.coordinates.longitude] as [number, number] : null;
                  if (pos && typeof pos[0] === 'number' && typeof pos[1] === 'number' && !isNaN(pos[0]) && !isNaN(pos[1])) {
                    const isSelected = selectedObjectId === 'iss';
                    return (
                      <React.Fragment>
                        <Marker 
                          position={pos as [number, number]} 
                          icon={issIcon}
                          bubblingMouseEvents={false}
                          eventHandlers={{
                            click: (e) => {
                              if (e.originalEvent) {
                                e.originalEvent.stopPropagation();
                              }
                              onSelectObject(iss);
                            }
                          }}
                        >
                          <Popup>
                            <div className="p-1 text-slate-100 font-mono text-xs">
                              <p className="font-bold border-b border-red-900 pb-1 text-red-100 uppercase">ISS (SPACE STATION)</p>
                              <p className="mt-1 font-sans">{iss.description}</p>
                              <p className="mt-1">LAT: {pos[0].toFixed(4)}°</p>
                              <p>LNG: {pos[1].toFixed(4)}°</p>
                            </div>
                          </Popup>
                        </Marker>
                        {isSelected && (
                          <Circle
                            center={pos as [number, number]}
                            radius={2200000} // ~2200 km footprint radius
                            pathOptions={{
                              color: '#ef4444',
                              fillColor: '#ef4444',
                              fillOpacity: 0.04,
                              weight: 1,
                              dashArray: '4, 8'
                            }}
                          />
                        )}
                      </React.Fragment>
                    );
                  }
                  return null;
                })()
              )}

              {/* General orbiting instruments */}
              {satellites.map((sat) => {
                const lat = sat.coordinates ? sat.coordinates.latitude : sat.latitude;
                const lng = sat.coordinates ? sat.coordinates.longitude : sat.longitude;
                
                if (typeof lat === 'number' && typeof lng === 'number' && !isNaN(lat) && !isNaN(lng)) {
                  const isSelected = selectedObjectId === sat.id;
                  return (
                    <React.Fragment key={sat.id}>
                      <Marker 
                        position={[lat, lng]} 
                        icon={getSatIcon(sat.color)}
                        bubblingMouseEvents={false}
                        eventHandlers={{
                          click: (e) => {
                            if (e.originalEvent) {
                              e.originalEvent.stopPropagation();
                            }
                            onSelectObject(sat);
                          }
                        }}
                      >
                        <Popup>
                          <div className="p-1 text-slate-100 font-mono text-xs">
                            <p className="font-bold border-b border-slate-800 pb-1 text-emerald-400 uppercase">{sat.name}</p>
                            <p className="mt-1 font-sans">{sat.description}</p>
                            <p className="mt-1">LAT: {lat.toFixed(4)}°</p>
                            <p>LNG: {lng.toFixed(4)}°</p>
                          </div>
                        </Popup>
                      </Marker>
                      {isSelected && (
                        <Circle
                          center={[lat, lng]}
                          radius={1800000} // ~1800 km footprint radius
                          pathOptions={{
                            color: sat.color || '#10b981',
                            fillColor: sat.color || '#10b981',
                            fillOpacity: 0.04,
                            weight: 1,
                            dashArray: '4, 8'
                          }}
                        />
                      )}
                    </React.Fragment>
                  );
                }
                return null;
              })}
            </MapContainer>
            
            {/* Helper overlay showing instructions */}
            <div className="absolute bottom-2 left-2 z-[1000] text-xs font-mono text-slate-400 bg-slate-950/80 px-2 py-1 rounded-md border border-slate-800/80 pointer-events-none uppercase">
              Click map area to relocate Ground Station
            </div>
          </div>
      </div>

      {/* Grid Coordinates Footer Info */}
      <div className="bg-slate-900/40 border border-slate-850 rounded-xl p-2 px-3 flex items-center justify-between text-sm font-mono text-slate-400 mt-2">
        <div className="flex items-center gap-1">
          <Compass className="w-3.5 h-3.5 text-slate-500" />
          <span>VIEWPORT CENTRE:</span>
        </div>
        <div className="space-x-3 text-right">
          <span>LAT: <strong className="text-slate-200">{viewCenter[0] >= 0 ? `${viewCenter[0].toFixed(1)}°N` : `${Math.abs(viewCenter[0]).toFixed(1)}°S`}</strong></span>
          <span>LNG: <strong className="text-slate-200">{viewCenter[1] >= 0 ? `${viewCenter[1].toFixed(1)}°E` : `${Math.abs(((viewCenter[1] + 180) % 360) - 180).toFixed(1)}°W`}</strong></span>
        </div>
      </div>
    </div>
  );
}
