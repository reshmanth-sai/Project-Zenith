import { useState, useEffect, useRef, useMemo } from 'react';
import { 
  Compass, 
  Eye, 
  Orbit, 
  Globe as GlobeIcon, 
  Play, 
  Pause, 
  FastForward, 
  Check, 
  Sparkles, 
  BookOpen, 
  Calendar, 
  MapPin, 
  Maximize2,
  ShieldAlert,
  Volume2,
  VolumeX
} from 'lucide-react';

import SearchBar from './components/SearchBar';
import Globe from './components/Globe';
import SkyView from './components/SkyView';
import ObjectPanel from './components/ObjectPanel';
import ObjectCard from './components/ObjectCard';
import ObservationControlHub from './components/ObservationControlHub';
import AtmosphericSuitability from './components/AtmosphericSuitability';
import FunFactPanel from './components/FunFactPanel';
import { synth } from './lib/synth';

import { Observer, CelestialObject, ObsLog } from './types';
import { useObserver } from './context/ObserverContext';
import { getIssPositionAtTime } from './lib/satellite';
import { getSunriseSunset } from './lib/astronomy';

// Pre-populated sample log to look pristine out of the box
const DEFAULT_LOGS: ObsLog[] = [
  {
    id: "sample-log-1",
    objectName: "Venus",
    timestamp: new Date().toLocaleDateString() + " 21:04 UTC",
    latitude: 19.8206,
    longitude: -155.4681,
    content: "**Astronomic Class & Coordinates**: Terrestrial Planet (Inferior) | Magnitude -4.4\n\n**Current Viewing Status**: Visible at 28.4° altitude on bearing 272° W. Standing out spectacularly in the early dusk, well clear of the horizon haze.\n\n**Cosmic Insight**: Covered in dense, reflective carbon dioxide clouds, Venus reflects 70% of sunlight. It spins retrogradely, meaning the sun rises in the west.\n\n**Astronomer's Note**: Retained superb crescent detail tonight. Atmosphere is exceptionally steady at high levels, showing crisp termination bounds.",
    generationType: "static_fallback"
  }
];

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
  
  const dSq = rObs * rObs + rSat * rSat - 2 * rObs * rSat * cosTheta;
  const d = Math.sqrt(dSq);
  
  const numElev = rSat * cosTheta - rObs;
  const denElev = rSat * Math.sin(theta);
  const elevRad = Math.atan2(numElev, Math.max(0.0001, denElev));
  const altitude = (elevRad * 180) / Math.PI;
  
  return {
    altitude: parseFloat(altitude.toFixed(2)),
    azimuth: parseFloat(azimuth.toFixed(2)),
    rangeKm: parseFloat(d.toFixed(1))
  };
}

export default function App() {
  const { globalObserverLocation, setGlobalObserverLocation } = useObserver();

  // Map globalObserverLocation from context to target Observer format smoothly
  const observer: Observer = {
    name: globalObserverLocation.name,
    latitude: globalObserverLocation.lat,
    longitude: globalObserverLocation.lng,
    elevationM: globalObserverLocation.elevationM
  };

  const setObserver = (newObs: Observer) => {
    setGlobalObserverLocation({
      name: newObs.name,
      lat: newObs.latitude,
      lng: newObs.longitude,
      elevationM: newObs.elevationM
    });
  };

  // Time machine values
  const [currentTime, setCurrentTime] = useState<number>(Date.now());
  const [timeOffsetHours, setTimeOffsetHours] = useState<number>(0);

  // Computed active warped simulation time
  const activeTime = useMemo(() => {
    return currentTime + (timeOffsetHours * 3600 * 1000);
  }, [currentTime, timeOffsetHours]);

  // Calculate sunrise/sunset for current location and date
  const { sunrise, sunset } = useMemo(() => {
    const dateStr = new Date(activeTime).toDateString();
    return getSunriseSunset(observer.latitude, observer.longitude, dateStr);
  }, [observer.latitude, observer.longitude, activeTime]);

  const [timeMultiplier, setTimeMultiplier] = useState<number>(1); // 1 = Realtime, 10 = Fast, 300 = Warp
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Telemetries spectrum state
  const [planets, setPlanets] = useState<CelestialObject[]>([]);
  const [satellites, setSatellites] = useState<CelestialObject[]>([]);
  const [iss, setIss] = useState<CelestialObject | null>(null);
  
  // Selections
  const [selectedObject, setSelectedObject] = useState<CelestialObject | null>(null);
  const selectedObjectIdRef = useRef<string | null>(null);
  const hasSetInitialSelectionRef = useRef(false);

  useEffect(() => {
    selectedObjectIdRef.current = selectedObject?.id || null;
  }, [selectedObject]);

  const [activeFilter, setActiveFilter] = useState<'all' | 'planets' | 'constellations' | 'satellites'>('all');
  
  // Custom States for 4 New Features:
  const [bortleScale, setBortleScale] = useState<number>(3); // Feature 1: Bortle Light Pollution scale (Class 1 to 9)
  const [nightVision, setNightVision] = useState<boolean>(false); // Night Vision mode state
  const [soundEnabled, setSoundEnabled] = useState<boolean>(false);

  // Play sonar lock chime on sound-enabled target selections
  useEffect(() => {
    if (soundEnabled && selectedObject) {
      synth.playSonarLock();
    }
  }, [selectedObject?.id, soundEnabled]);

  const prevVisibleRef = useRef<boolean | null>(null);

  // Play chimes when the selected object crosses the local horizon
  useEffect(() => {
    if (!soundEnabled || !selectedObject || !selectedObject.localCoordinates) {
      prevVisibleRef.current = null;
      return;
    }
    const isCurrentlyVisible = selectedObject.localCoordinates.altitude > 0;
    if (prevVisibleRef.current !== null && isCurrentlyVisible !== prevVisibleRef.current) {
      synth.playHorizonChirp(isCurrentlyVisible);
    }
    prevVisibleRef.current = isCurrentlyVisible;
  }, [selectedObject?.localCoordinates?.altitude, soundEnabled, selectedObject?.id]);
  
  // Feature 2: Stargazing Quest (Find Constellation Challenge)
  const questList = useMemo(() => ["urmajor", "orion", "cassiopeia", "cygnus", "leo", "urminor", "pegasus", "taurus"], []);
  const [questIndex, setQuestIndex] = useState<number>(0);
  const [questScore, setQuestScore] = useState<number>(0);
  const [questCompleted, setQuestCompleted] = useState<boolean>(false);
  const currentQuestId = questList[questIndex];
  
  // Check if selected object completes the quest
  useEffect(() => {
    if (selectedObject && selectedObject.type === 'constellation' && selectedObject.id === currentQuestId) {
      if (!questCompleted) {
        setQuestCompleted(true);
        setQuestScore(prev => prev + 100);
        // Play acoustic chime
        try {
          const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
          if (AudioCtxClass) {
            const ctx = new AudioCtxClass();
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.frequency.setValueAtTime(880, ctx.currentTime);
            gain.gain.setValueAtTime(0.05, ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.3);
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start();
            osc.stop(ctx.currentTime + 0.3);
          }
        } catch (e) {}
      }
    }
  }, [selectedObject?.id, currentQuestId, questCompleted]);

  // Logs & Tabs swaps
  const [savedLogs, setSavedLogs] = useState<ObsLog[]>(DEFAULT_LOGS);

  // Weather query state
  const [cloudCover, setCloudCover] = useState<number | null>(null);
  const [temperature, setTemperature] = useState<number | null>(null);
  const [humidity, setHumidity] = useState<number | null>(null);

  // Fetch current cloud cover when the globalObserverLocation coordinates shift
  useEffect(() => {
    if (
      typeof globalObserverLocation.lat !== 'number' || 
      typeof globalObserverLocation.lng !== 'number' || 
      isNaN(globalObserverLocation.lat) || 
      isNaN(globalObserverLocation.lng)
    ) {
      return;
    }
    let active = true;
    const fetchWeather = async () => {
      try {
        const res = await fetch(`/api/weather?lat=${globalObserverLocation.lat}&lng=${globalObserverLocation.lng}`);
        if (res.ok && active) {
          const data = await res.json();
          if (typeof data.cloudCover === 'number') {
            setCloudCover(data.cloudCover);
          }
          if (typeof data.temperature === 'number') {
            setTemperature(data.temperature);
          }
          if (typeof data.humidity === 'number') {
            setHumidity(data.humidity);
          }
        }
      } catch (err) {
        console.error("Failed to fetch location weather:", err);
      }
    };
    fetchWeather();
    return () => {
      active = false;
    };
  }, [globalObserverLocation.lat, globalObserverLocation.lng]);

  // Ground station calendar clock incrementer
  useEffect(() => {
    if (timeMultiplier === 0) return; // Paused

    const intervalMs = 50; // Update 20 times per second for smooth gliding
    const multiplier = timeMultiplier === 300 ? 600 : timeMultiplier;
    const stepMs = intervalMs * multiplier;

    timerRef.current = setInterval(() => {
      setCurrentTime((prev) => prev + stepMs);
    }, intervalMs);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [timeMultiplier]);

  // Main telemetry fetching mechanism
  useEffect(() => {
    // High performance mode: if time is running, compute positions locally
    // in 20fps instead of saturating the network with repetitive back-to-back requests.
    if (timeMultiplier !== 0) {
      executeLocalBackupTelemetry(activeTime);
      return;
    }

    const fetchTelemetry = async () => {
      try {
        const queryParams = `?t=${activeTime}&lat=${observer.latitude}&lng=${observer.longitude}`;
        
        const [planetsRes, satellitesRes, issRes] = await Promise.all([
          fetch(`/api/planets${queryParams}`).then(r => r.json()),
          fetch(`/api/satellites${queryParams}`).then(r => r.json()),
          fetch(`/api/iss${queryParams}`).then(r => r.json())
        ]);

        if (planetsRes?.planets) {
          setPlanets(planetsRes.planets);
        }
        if (satellitesRes?.satellites) {
          setSatellites(satellitesRes.satellites);
        }
        if (issRes) {
          setIss(issRes);
        }

        // Keep current selected object updated with live recalculations
        const latestSelectedId = selectedObjectIdRef.current;
        if (latestSelectedId) {
          if (latestSelectedId === 'iss' && issRes) {
            setSelectedObject(issRes);
          } else if (planetsRes?.planets && planetsRes.planets.some((p: any) => p.id === latestSelectedId)) {
            const updated = planetsRes.planets.find((p: any) => p.id === latestSelectedId);
            if (updated) setSelectedObject(updated);
          } else if (satellitesRes?.satellites && satellitesRes.satellites.some((s: any) => s.id === latestSelectedId)) {
            const updated = satellitesRes.satellites.find((s: any) => s.id === latestSelectedId);
            if (updated) setSelectedObject(updated);
          } else {
            // If it's a constellation, do not overwrite it with null
          }
          hasSetInitialSelectionRef.current = true;
        } else if (issRes && !hasSetInitialSelectionRef.current) {
          // Default to ISS initially
          setSelectedObject(issRes);
          selectedObjectIdRef.current = 'iss';
          hasSetInitialSelectionRef.current = true;
        }

      } catch (err) {
        console.warn("Express server endpoints loading. Executing local telemetry calculation backup...", err);
        // Robust Client-Side calculation fallback in case of connection or boot delay
        executeLocalBackupTelemetry(activeTime);
      }
    };

    const debounceTimer = setTimeout(() => {
      fetchTelemetry();
    }, 150);

    return () => clearTimeout(debounceTimer);
  }, [activeTime, observer.latitude, observer.longitude]);

  // Real-time ISS tracking background poll mechanism (triggered every 5 seconds)
  useEffect(() => {
    // Disabled background poll during time ticks to prevent duplicate server queries, network flooding,
    // and telemetry state conflicts. Client-side SGP4 recalculations handle this cleanly at 20fps.
    return;
  }, []);

  // Client-side math calculators as a bulletproof loading backup
  const executeLocalBackupTelemetry = (time: number = activeTime) => {
    // Planets ra/dec estimations
    const mockPlanets = [
      { id: "sun", name: "Sun", type: "star" as const, color: "#FDB813", size: 12, ra: 45, dec: 15, magnitude: -26.74, description: "The star at the center of the Solar System." },
      { id: "moon", name: "Moon", type: "satellite" as const, color: "#E6E6FA", size: 8, ra: 120, dec: 5, magnitude: -12.74, description: "Earth's only natural satellite in synchronous rotation." },
      { id: "mars", name: "Mars", type: "planet" as const, color: "#E27B58", size: 5, ra: 210, dec: -10, magnitude: -1.5, description: "The dusty, cold desert world with a thin atmospheric shell." },
      { id: "venus", name: "Venus", type: "planet" as const, color: "#E3BB76", size: 6, ra: 85, dec: 22, magnitude: -4.4, description: "The hottest world in our solar matrix, shrouded in thick yellow clouds." },
      { id: "jupiter", name: "Jupiter", type: "planet" as const, color: "#D4A373", size: 10, ra: 315, dec: -15, magnitude: -2.7, description: "The massive gas giant star system, famous for its Galilean moons." }
    ].map(p => {
      const altAz = calculateLocalAltAz(observer.latitude, observer.longitude, p.ra, p.dec, time);
      return { ...p, localCoordinates: altAz };
    });

    setPlanets(mockPlanets);

    // ISS Orbit tracking
    const issPos = getIssPositionAtTime(time);
    const issAltAz = calculateSatelliteAltAz(
      observer.latitude,
      observer.longitude,
      issPos.latitude,
      issPos.longitude,
      issPos.altitude || 418.5
    );

    const mockIss: CelestialObject = {
      id: "iss",
      name: "ISS (International Space Station)",
      type: "satellite",
      color: "#ef4444",
      size: 7,
      coordinates: issPos,
      localCoordinates: issAltAz,
      description: "Joint human orbital structure flying at 418km height.",
      magnitude: -2.0,
      inclination: 51.64,
      period: 5560,
      altitude: 418.5
    };

    setIss(mockIss);

    // Mock Satellites
    const mockSats = [
      { id: "mangalyaan", name: "Mangalyaan (Mars Orbiter)", color: "#f87171", lat: 10, lng: -45, magnitude: 3.8, description: "India's landmark Mars Orbiter Mission (MOM).", inclination: 19.2, period: 5520, altitude: 430 },
      { id: "aditya-l1", name: "Aditya-L1 Solar Probe", color: "#fbbf24", lat: -15, lng: 30, magnitude: 4.2, description: "India's first space-based observatory probing solar wind.", inclination: 7.3, period: 6100, altitude: 950 },
      { id: "cartosat-3", name: "Cartosat-3", color: "#38bdf8", lat: 45, lng: 110, magnitude: 2.5, description: "Advanced Indian earth observation satellite carrying high-precision optical mapping sensors.", inclination: 97.9, period: 5820, altitude: 509 },
      { id: "aryabhata", name: "Aryabhata", color: "#ae78ff", lat: 25, lng: 75, magnitude: 4.5, description: "India's historic first satellite launched in 1975.", inclination: 50.7, period: 5780, altitude: 560 },
      { id: "hst", name: "Hubble Space Telescope", color: "#93C5FD", lat: 20, lng: -140, magnitude: 1.5, description: "Fabulous cosmic observatory orbiting Earth since 1990.", inclination: 28.47, period: 5760, altitude: 540 },
      { id: "starlink-1", name: "Starlink Tracker-A", color: "#A7F3D0", lat: 51, lng: -10, magnitude: 2.8, description: "SpaceX telecommunication satellite constellation component.", inclination: 53.0, period: 5400, altitude: 550 },
      { id: "starlink-2", name: "Starlink Tracker-B", color: "#A7F3D0", lat: 51.5, lng: -12, magnitude: 3.0, description: "SpaceX telecommunication satellite constellation component.", inclination: 53.0, period: 5400, altitude: 545 },
      { id: "noaa-19", name: "NOAA-19 Weather", color: "#FDE68A", lat: -35, lng: 120, magnitude: 3.5, description: "Polar-orbiting environmental weather tracking satellite.", inclination: 99.2, period: 5940, altitude: 860 },
      { id: "envisat", name: "Envisat Spacecraft", color: "#F3A7F2", lat: -60, lng: 15, magnitude: 2.1, description: "Large active research spacecraft monitoring climate change parameters.", inclination: 98.54, period: 6000, altitude: 790 },
      { id: "tiangong", name: "Tiangong Space Station", color: "#f43f5e", lat: 39, lng: 116, magnitude: 1.5, description: "China's multi-module space station in low Earth orbit, active since 2021.", inclination: 41.5, period: 5500, altitude: 389 },
      { id: "jwst", name: "James Webb Telescope", color: "#fb7185", lat: -2, lng: -60, magnitude: 5.5, description: "NASA/ESA/CSA premier infrared cosmic observatory.", inclination: 39.0, period: 6300, altitude: 1500 },
      { id: "iridium-180", name: "Iridium-180 Link", color: "#eab308", lat: 70, lng: -80, magnitude: 2.9, description: "Active communications satellite in low Earth orbit.", inclination: 86.4, period: 6010, altitude: 780 },
      { id: "aqua", name: "Aqua satellite", color: "#22c55e", lat: -50, lng: -120, magnitude: 3.2, description: "NASA scientific research satellite tracking global water cycles.", inclination: 98.2, period: 5930, altitude: 705 },
      { id: "terra", name: "Terra satellite", color: "#10b981", lat: 35, lng: -100, magnitude: 3.1, description: "NASA flagship Earth observation satellite monitoring land cover.", inclination: 98.3, period: 5940, altitude: 713 },
      { id: "meteosat-11", name: "Meteosat-11", color: "#06b6d4", lat: 0, lng: 0, magnitude: 4.8, description: "EUMETSAT high-orbit weather satellite providing continuous scans.", inclination: 1.3, period: 5120, altitude: 3578 }
    ].map((s, idx) => {
      // Calculate dynamic positions based on a simple orbit calculation to make it smooth and realistic!
      const orbitalOffset = (time / 100000) * (idx + 1) * 0.2;
      const inclinationRad = s.inclination * Math.PI / 180;
      const angle = orbitalOffset + s.lat;
      const calcLat = Math.asin(Math.sin(inclinationRad) * Math.sin(angle)) * 180 / Math.PI;
      const calcLng = ((s.lng + (time / 300000) * 360) % 360) - 180;

      const localCoords = calculateSatelliteAltAz(
        observer.latitude,
        observer.longitude,
        calcLat,
        calcLng,
        s.altitude
      );

      return {
        id: s.id,
        name: s.name,
        type: "satellite" as const,
        color: s.color,
        size: s.id === 'tiangong' ? 6 : 4,
        coordinates: { latitude: parseFloat(calcLat.toFixed(4)), longitude: parseFloat(calcLng.toFixed(4)) },
        localCoordinates: localCoords,
        description: s.description,
        magnitude: s.magnitude,
        inclination: s.inclination,
        period: s.period,
        altitude: s.altitude
      };
    });

    setSatellites(mockSats);

    // Set Selection
    const latestSelectedId = selectedObjectIdRef.current;
    let newSelectedObj: CelestialObject | null = null;
    if (latestSelectedId === 'iss') {
      newSelectedObj = mockIss;
    } else if (latestSelectedId) {
      newSelectedObj = mockSats.find(s => s.id === latestSelectedId) || 
                       mockPlanets.find(p => p.id === latestSelectedId) || 
                       null;
    }

    if (newSelectedObj) {
      setSelectedObject(newSelectedObj);
    } else if (!selectedObject && !hasSetInitialSelectionRef.current) {
      setSelectedObject(mockIss);
      selectedObjectIdRef.current = "iss";
    }
    hasSetInitialSelectionRef.current = true;
  };

  const calculateLocalAltAz = (lat: number, lng: number, ra: number, dec: number, time: number) => {
    const timeHr = (time / 3600000) % 24;
    const localSider = (timeHr * 15 + lng + 180) % 360;
    let ha = localSider - ra;
    if (ha < 0) ha += 360;
    
    const latRad = (lat * Math.PI) / 180;
    const decRad = (dec * Math.PI) / 180;
    const haRad = (ha * Math.PI) / 180;

    const sinAlt = Math.sin(latRad) * Math.sin(decRad) + Math.cos(latRad) * Math.cos(decRad) * Math.cos(haRad);
    const alt = Math.asin(sinAlt) * 180 / Math.PI;

    return {
      altitude: parseFloat(alt.toFixed(1)),
      azimuth: parseFloat((ha % 360).toFixed(1))
    };
  };

  // Add observation log triggered by ObjectCard (Gemini)
  const handleAddNewLog = (object: CelestialObject, logContent: string, genType: 'zenith' | 'static_fallback' | 'intel') => {
    const newLog: ObsLog = {
      id: `log-${Date.now()}`,
      objectName: object.name,
      timestamp: new Date().toLocaleDateString() + " " + new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' }) + " UTC",
      latitude: observer.latitude,
      longitude: observer.longitude,
      content: logContent,
      generationType: genType
    };

    setSavedLogs(prev => [newLog, ...prev]);
  };

  // Handles clicking any node on Star map, Globe, or Lists
  const handleSelectObject = (obj: CelestialObject | null) => {
    if (obj && selectedObject && selectedObject.id === obj.id) {
      setSelectedObject(null);
      selectedObjectIdRef.current = null;
    } else {
      setSelectedObject(obj);
      selectedObjectIdRef.current = obj?.id || null;
    }
  };

  // Fluctuating Signal Strength simulation based on active time & weather (cloudCover)
  const signalStrength = useMemo(() => {
    const weatherImpact = cloudCover ? cloudCover * 0.4 : 10;
    const timeFactor = Math.sin(activeTime / 15000) * 12 + Math.cos(activeTime / 45000) * 8;
    const base = 85 - weatherImpact + timeFactor;
    return Math.max(15, Math.min(100, Math.round(base)));
  }, [activeTime, cloudCover]);

  const barsActive = useMemo(() => {
    if (signalStrength > 80) return 5;
    if (signalStrength > 60) return 4;
    if (signalStrength > 40) return 3;
    if (signalStrength > 20) return 2;
    return 1;
  }, [signalStrength]);

  return (
    <div className={`min-h-screen flex flex-col justify-between font-sans selection:bg-indigo-500/30 selection:text-white ${nightVision ? 'night-vision' : ''}`} id="zenith-app-root">
      {/* 1. Header Banner */}
      <header className="border-b border-white/10 bg-slate-950/55 backdrop-blur-xl px-4 md:px-8 py-3.5 md:py-4 sticky top-0 z-50 shadow-[inset_0_1px_1px_rgba(255,255,255,0.07),0_10px_30px_-10px_rgba(0,0,0,0.5)]">
        <div className="max-w-[1920px] mx-auto w-full flex flex-col lg:flex-row items-center justify-between gap-3.5">
          <div className="flex flex-col sm:flex-row items-center justify-between w-full lg:w-auto gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full border border-indigo-500/30 flex items-center justify-center bg-indigo-500/10 shadow-[0_0_12px_rgba(129,140,248,0.2)] shrink-0">
                <div className="w-5 h-5 rounded-full bg-indigo-400 shadow-[0_0_10px_rgba(129,140,248,0.8)] animate-pulse flex items-center justify-center">
                  <Orbit className="w-3 h-3 text-slate-950 animate-spin-slow" />
                </div>
              </div>
              <div className="flex flex-col">
                <div className="flex items-center gap-1.5">
                  <h1 className="text-lg md:text-xl font-serif tracking-[0.18em] text-slate-50 leading-none">ZENITH</h1>
                  <span className="text-[10px] md:text-xs font-mono font-bold bg-indigo-950/80 text-indigo-400 border border-indigo-500/25 px-1.5 py-0.5 rounded uppercase leading-none">V1.4</span>
                </div>
                <p className="text-[10px] font-mono tracking-wider text-slate-500 uppercase mt-0.5 hidden sm:block">Horizontal Satellite & Planet Mapping Interface</p>
              </div>
            </div>

            {/* Night Vision Toggle Group */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => setNightVision(!nightVision)}
                className={`flex items-center gap-1.5 border shadow-sm backdrop-blur-md rounded-xl py-2 px-3.5 transition-all duration-300 cursor-pointer active:scale-95 text-[11px] ${
                  nightVision
                    ? 'bg-red-950/50 border-red-500/50 text-red-400 shadow-[0_0_12px_rgba(239,68,68,0.25)] font-extrabold animate-pulse'
                    : 'bg-white/[0.03] border-white/10 hover:border-white/20 text-slate-400 hover:text-slate-200'
                }`}
                id="night-vision-toggle-btn"
                title="Toggle monochromatic deep red night vision mode for field observation"
              >
                <div className={`w-1.5 h-1.5 rounded-full ${nightVision ? 'bg-red-500 animate-ping' : 'bg-slate-500'}`} />
                <span className="font-bold font-mono uppercase tracking-wider">NIGHT VISION</span>
              </button>
            </div>
          </div>

          {/* Dark-Sky Alert when light pollution is high */}
          {bortleScale >= 5 && (
            <div className="flex flex-col sm:flex-row items-center gap-3 bg-amber-950/40 border border-amber-500/30 rounded-xl p-2.5 px-4 shadow-[0_0_12px_rgba(245,158,11,0.06)] animate-pulse w-full lg:w-auto" id="dark-sky-alert-prompt">
              <div className="flex items-center gap-2 w-full">
                <ShieldAlert className="w-4 h-4 text-amber-400 shrink-0 animate-bounce" />
                <div className="flex flex-col text-left">
                  <span className="text-[10px] font-bold text-amber-400 font-mono tracking-wider uppercase leading-none">DARK-SKY ALERT</span>
                  <span className="text-[10px] text-amber-200 font-mono mt-0.5 leading-tight">
                    High glare (Bortle Class {bortleScale}) detected! Relocate to pristine dark skies for optimal observation.
                  </span>
                </div>
              </div>
              <button
                onClick={() => {
                  setObserver({
                    name: "Mauna Kea Dark Sky Reserve (Bortle Class 1)",
                    latitude: 19.8206,
                    longitude: -155.4681,
                    elevationM: 4205
                  });
                  setBortleScale(1);
                }}
                className="w-full sm:w-auto p-1 px-2.5 rounded bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold font-mono text-[10px] uppercase tracking-wider cursor-pointer shadow-md transition-all active:scale-95 shrink-0"
              >
                Shift Coordinates
              </button>
            </div>
          )}

          {/* Header Node Location and Fluctuating Signal Strength Indicator */}
          <div className="hidden lg:flex items-center gap-4 bg-white/[0.03] border border-white/10 shadow-[inset_0_1px_1px_rgba(255,255,255,0.04)] backdrop-blur-md rounded-xl p-2 px-4" id="header-signal-station">
            <div className="flex flex-col text-left">
              <span className="text-[10px] font-bold text-slate-500 font-mono block leading-none uppercase tracking-wider">NODE LOCATORS</span>
              <span className="text-xs md:text-sm font-bold text-indigo-300 mt-1 block font-mono">
                {observer.latitude >= 0 ? '+' : ''}{observer.latitude.toFixed(4)}°N, {observer.longitude >= 0 ? '+' : ''}{observer.longitude.toFixed(4)}°E
              </span>
            </div>
            <div className="h-6 w-[1px] bg-slate-800/80" />
            <div className="flex items-center gap-2.5">
              <div className="flex flex-col text-right">
                <span className="text-[10px] font-bold text-slate-500 font-mono block leading-none tracking-wider">TELEMETRY LINK</span>
                <span className={`text-[11px] font-bold font-mono mt-1 block uppercase leading-none ${
                  signalStrength > 60 ? 'text-emerald-400' : signalStrength > 30 ? 'text-amber-400' : 'text-red-400 animate-pulse'
                }`}>
                  {signalStrength > 80 ? 'EXCELLENT' : signalStrength > 60 ? 'GOOD' : signalStrength > 30 ? 'FAIR' : 'MARGINAL'} ({signalStrength}%)
                </span>
              </div>
              <div className="flex items-end gap-[3px] h-3.5" title={`Signal strength: ${signalStrength}%`}>
                {[1, 2, 3, 4, 5].map((bar) => (
                  <div
                     key={bar}
                     className={`w-[3px] rounded-t-sm transition-all duration-300 ${
                       bar <= barsActive 
                         ? (signalStrength > 60 ? 'bg-emerald-400 shadow-[0_0_4px_rgba(52,211,153,0.4)]' : signalStrength > 30 ? 'bg-amber-400' : 'bg-red-500 animate-pulse') 
                         : 'bg-slate-800/80'
                     }`}
                     style={{ height: `${bar * 20}%` }}
                   />
                ))}
              </div>
            </div>
          </div>

          {/* Calendar Clock & Warp Speed Rig */}
          <div className="flex flex-wrap items-center justify-center gap-3 bg-white/[0.03] border border-white/10 shadow-[inset_0_1px_1px_rgba(255,255,255,0.04)] backdrop-blur-md rounded-xl p-2 px-3.5 w-full lg:w-auto text-xs" id="simulator-chronostat">
            <div className="flex items-center gap-2 min-w-max">
              <Calendar className="w-4 h-4 text-slate-500" />
              <div className="text-left font-mono">
                <span className="text-[9px] font-semibold text-slate-500 block leading-none uppercase tracking-wider">STATION COORD TIME</span>
                <span className="text-xs md:text-sm font-bold text-slate-200 mt-0.5 block">
                  {new Date(activeTime).toUTCString().replace("GMT", "UTC")}
                </span>
              </div>
            </div>

            <div className="hidden sm:block h-6 w-[1px] bg-slate-800" />

            {/* Sunrise & Sunset Indicators */}
            <div className="flex items-center gap-2.5 min-w-max">
              <div className="text-right font-mono">
                <span className="text-[9px] font-bold text-amber-500 block leading-none tracking-wider">☀ RISE</span>
                <span className="text-[10px] font-semibold text-slate-300 mt-0.5 block font-bold">
                  {sunrise}
                </span>
              </div>
              <div className="h-5 w-[1px] bg-slate-800/60" />
              <div className="text-right font-mono">
                <span className="text-[9px] font-bold text-indigo-400 block leading-none tracking-wider">☽ SET</span>
                <span className="text-[10px] font-semibold text-slate-300 mt-0.5 block font-bold">
                  {sunset}
                </span>
              </div>
            </div>

            <div className="hidden sm:block h-6 w-[1px] bg-slate-800" />

            {/* Time speed multiplier */}
            <div className="flex items-center gap-1 min-w-max">
              <button
                onClick={() => setTimeMultiplier(0)}
                className={`p-1.5 rounded transition cursor-pointer ${timeMultiplier === 0 ? 'bg-slate-800 text-indigo-400' : 'text-slate-500 hover:text-white'}`}
                title="Pause celestial drift"
                id="pause-sim-btn"
              >
                <Pause className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setTimeMultiplier(1)}
                className={`p-1.5 rounded transition cursor-pointer ${timeMultiplier === 1 ? 'bg-slate-800 text-indigo-400' : 'text-slate-500 hover:text-white'}`}
                title="Real-time motion"
                id="realtime-sim-btn"
              >
                <Play className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setTimeMultiplier(10)}
                className={`p-1.5 rounded transition cursor-pointer ${timeMultiplier === 10 ? 'bg-slate-800 text-indigo-400' : 'text-slate-500 hover:text-white'}`}
                title="10x Sidereal speed"
                id="fast-sim-btn-1"
              >
                <FastForward className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setTimeMultiplier(300)}
                className={`p-1 px-2.5 rounded transition cursor-pointer text-[10px] font-mono font-bold ${timeMultiplier === 300 ? 'bg-slate-800 text-indigo-400' : 'text-slate-500 hover:text-white border border-indigo-500/20'}`}
                title="300x Orbit warp"
                id="fast-sim-btn-2"
              >
                WARP
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Weather Warning Banner */}
      {cloudCover !== null && cloudCover > 60 && (
        <div className="bg-red-950/40 border-b border-red-500/20 px-6 md:px-8 lg:px-12 py-2.5 text-red-500 font-mono text-sm transition-all" id="weather-cloud-warning">
          <div className="max-w-[1920px] mx-auto w-full flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse animate-duration-1000" />
              <span className="font-bold">WARNING: Visual Observation Compromised – Heavy Cloud Cover Detected</span>
            </div>
            <span className="text-xs opacity-75 hidden sm:inline-block">CLOUD COVER: {cloudCover}%</span>
          </div>
        </div>
      )}

      {/* 2. Main Dashboard Interface */}
      <main className="flex-1 p-6 lg:p-8 max-w-[1920px] mx-auto w-full grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-6" id="dashboard-main-grid">
        {/* Left Hand: Controls & Earth Globe View (Size: 4 cols) */}
        <div className="md:col-span-1 lg:col-span-4 flex flex-col gap-6" id="left-column-deck">
          <div className="h-auto lg:h-[280px]">
            <SearchBar onLocationChange={setObserver} currentObserver={observer} />
          </div>
          <div className="flex-1 min-h-[300px] sm:min-h-[400px] lg:min-h-[460px]">
            <Globe 
              observer={observer} 
              iss={iss} 
              satellites={satellites}
              currentTime={activeTime}
              selectedObjectId={selectedObject?.id || null}
              onSelectCoordinates={(lat, lng) => setObserver({
                name: `Calibrated Node (${lat.toFixed(2)}, ${lng.toFixed(2)})`,
                latitude: lat,
                longitude: lng,
                elevationM: 100
              })}
              timeMultiplier={timeMultiplier}
              onSelectObject={handleSelectObject}
            />
          </div>
          <FunFactPanel object={selectedObject} savedLogs={savedLogs} onGenerateLog={handleAddNewLog} />
        </div>

        {/* Center: Cosmic Horizon Planisphere Map (Size: 4 cols) */}
        <div className="md:col-span-1 lg:col-span-4 flex flex-col" id="center-column-deck">
          <SkyView
            observer={observer}
            planets={planets}
            satellites={satellites}
            iss={iss}
            selectedObjectId={selectedObject?.id || null}
            onSelectObject={handleSelectObject}
            currentTime={activeTime}
            bortleScale={bortleScale}
            setBortleScale={setBortleScale}
            timeMultiplier={timeMultiplier}
          />
        </div>

        {/* Right Hand: Core telemetry info (Size: 4 cols) */}
        <div className="md:col-span-2 lg:col-span-4 flex flex-col gap-4" id="right-column-deck">
          <div className="flex-1 flex flex-col" id="swapped-right-content-frame">
            <ObjectCard 
              object={selectedObject} 
              observer={observer}
              onGenerateLog={handleAddNewLog}
              savedLogs={savedLogs}
              temperature={temperature}
              humidity={humidity}
              currentTime={activeTime}
              bortleScale={bortleScale}
            />
          </div>
          <AtmosphericSuitability bortleScale={bortleScale} temperature={temperature} humidity={humidity} />
        </div>

        {/* Secondary section: Bento grid holding Target lists (col 8) & Observation Hub (col 4) */}
        <div className="md:col-span-2 lg:col-span-12 grid grid-cols-1 lg:grid-cols-12 gap-6" id="bottom-list-telescope-spectrum">
          {/* Target List Catalog (8 columns) */}
          <div className="lg:col-span-8 flex flex-col">
            <ObjectPanel
              planets={planets}
              satellites={satellites}
              iss={iss}
              selectedObjectId={selectedObject?.id || null}
              onSelectObject={handleSelectObject}
              activeFilter={activeFilter}
              setActiveFilter={setActiveFilter}
            />
          </div>

          {/* Interactive Stargazing Command Deck (4 columns) */}
          <div className="lg:col-span-4 flex flex-col bg-slate-950/40 border border-slate-800/60 rounded-xl p-5 shadow-2xl backdrop-blur-md" id="stargazing-quest-hub">
            <div className="flex items-center justify-between border-b border-slate-900 pb-2 mb-3">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-indigo-400 animate-pulse" />
                <h2 className="text-sm font-bold uppercase tracking-widest text-slate-300 font-mono">Observation Command</h2>
              </div>
              <div className="text-xs text-emerald-400 font-mono font-bold uppercase tracking-wider bg-emerald-950/30 px-2 py-0.5 rounded border border-emerald-900/30 animate-pulse">
                XP: {questScore}
              </div>
            </div>

            <ObservationControlHub
              currentQuestId={currentQuestId}
              questCompleted={questCompleted}
              onNextQuest={() => {
                setQuestIndex((prev) => (prev + 1) % questList.length);
                setQuestCompleted(false);
              }}
              questIndex={questIndex}
              questList={questList}
              setTimeOffsetHours={setTimeOffsetHours}
              selectedObject={selectedObject}
              handleAddNewLog={handleAddNewLog}
              observer={observer}
            />
          </div>
        </div>
      </main>

      {/* 4. Temporal Warp Slider (Time-Travel Control) */}
      <div className="bg-slate-950 border-t border-slate-900/60 px-6 md:px-8 lg:px-12 py-4 select-none" id="temporal-warp-panel">
        <div className="max-w-[1920px] mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded bg-indigo-500/10 border border-indigo-500/20 text-indigo-400">
              <Compass className="w-5 h-5 animate-spin-slow" />
            </div>
            <div>
              <span className="text-xs font-mono text-indigo-400 font-bold uppercase tracking-wider block">TEMPORAL WARP HARNESS</span>
              <h3 className="text-sm font-mono font-extrabold text-slate-100 uppercase tracking-tight">Sky Shift: {timeOffsetHours === 0 ? "REAL-TIME" : `${timeOffsetHours > 0 ? '+' : ''}${timeOffsetHours.toFixed(1)} HOURS`}</h3>
            </div>
          </div>

          <div className="flex-1 w-full max-w-2xl px-4 flex flex-col gap-1.5">
            <div className="flex items-center justify-between text-xs font-mono text-slate-500 font-bold uppercase tracking-widest px-1">
              <span>-12h (PAST)</span>
              <span>-6h</span>
              <span className={timeOffsetHours === 0 ? "text-emerald-400 font-bold" : "text-slate-500"}>NOW (0h)</span>
              <span>+6h</span>
              <span>+12h (FUTURE)</span>
            </div>
            <input
              type="range"
              min="-12"
              max="12"
              step="0.1"
              value={timeOffsetHours}
              onChange={(e) => setTimeOffsetHours(parseFloat(e.target.value))}
              className="w-full h-1.5 bg-slate-900 rounded-lg appearance-none cursor-pointer accent-indigo-500 hover:accent-indigo-400 focus:outline-none border border-slate-800"
              id="time-warp-slider"
            />
            <div className="flex items-center justify-between text-xs font-mono text-slate-500">
              <span>{new Date(currentTime - 12 * 3600 * 1000).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
              <span className={timeOffsetHours !== 0 ? "text-indigo-400 animate-pulse font-bold" : "text-emerald-400 font-bold"}>
                TARGET VIEW TIME: {new Date(activeTime).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit', second: '2-digit'})}
              </span>
              <span>{new Date(currentTime + 12 * 3600 * 1000).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setTimeOffsetHours(0)}
              disabled={timeOffsetHours === 0}
              className={`px-3 py-1.5 rounded font-mono text-xs font-extrabold transition cursor-pointer border ${
                timeOffsetHours === 0
                  ? 'border-slate-900 bg-slate-950/20 text-slate-600 cursor-not-allowed'
                  : 'border-emerald-500/30 bg-emerald-950/10 text-emerald-400 hover:bg-emerald-950/20 shadow-[0_0_8px_rgba(16,185,129,0.1)]'
              }`}
              title="Reset warp offset to live time"
              id="reset-warp-btn"
            >
              RESET TO LIVE
            </button>
          </div>
        </div>
      </div>

      {/* 3. Footer credits */}
      <footer className="h-12 bg-slate-950 border-t border-slate-800/50 px-6 md:px-8 lg:px-12 text-xs tracking-widest text-[#64748b] uppercase font-bold">
        <div className="max-w-[1920px] mx-auto w-full h-full flex items-center justify-between">
          <div>Observatory: {observer.name} Offset</div>
          <div className="flex items-center gap-4">
            <span>System Lat: {observer.latitude.toFixed(4)}° {observer.latitude >= 0 ? "N" : "S"}</span>
            <span>System Lon: {observer.longitude.toFixed(4)}° {observer.longitude >= 0 ? "E" : "W"}</span>
            <span className="text-indigo-400">Link Stable</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
