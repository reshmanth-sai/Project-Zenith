import { useState, useEffect } from 'react';
import { Compass, Eye, ShieldAlert, FileText, Send, Sparkles, Database, Loader2, Gauge, HelpCircle, RefreshCw } from 'lucide-react';
import { CelestialObject, Observer, ObsLog } from '../types';

interface ObjectCardProps {
  object: CelestialObject | null;
  observer: Observer;
  onGenerateLog: (object: CelestialObject, logContent: string, genType: 'ai' | 'static_fallback' | 'intel') => void;
  savedLogs: ObsLog[];
  temperature?: number | null;
  humidity?: number | null;
}

function InfoTooltip({ content }: { content: string }) {
  const [open, setOpen] = useState(false);
  return (
    <span className="relative inline-block ml-1 group" id={`tooltip-${content.slice(0, 15).replace(/\s+/g, '-').toLowerCase()}`}>
      <span
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onClick={() => setOpen(!open)}
        className="inline-flex items-center justify-center w-3 h-3 text-[9px] font-mono font-extrabold text-indigo-400 bg-indigo-950/80 border border-indigo-800/40 rounded-full hover:bg-indigo-900 cursor-help transition-all"
        style={{ contentVisibility: 'auto' }}
      >
        ?
      </span>
      {open && (
        <span className="absolute bottom-5 left-1/2 -translate-x-1/2 z-50 w-48 p-2 bg-slate-950 border border-indigo-500/40 text-[9px] font-mono text-slate-300 rounded shadow-2xl leading-normal block normal-case whitespace-normal text-left">
          {content}
          <span className="absolute top-full left-1/2 -translate-x-1/2 border-[4px] border-transparent border-t-slate-950" />
        </span>
      )}
    </span>
  );
}


export default function ObjectCard({ object, observer, onGenerateLog, savedLogs, temperature, humidity }: ObjectCardProps) {
  const [loading, setLoading] = useState(false);
  const [errorStatus, setErrorStatus] = useState<string | null>(null);

  // Find existing logs for this object
  const objectLogs = object ? savedLogs.filter(log => log.objectName === object.name) : [];

  const getAtmosphericScintillation = () => {
    const temp = typeof temperature === 'number' ? temperature : 15;
    const hum = typeof humidity === 'number' ? humidity : 60;
    
    // Scintillation is higher with high temperature and high humidity
    const baseSeeing = 1.2;
    const tempFactor = Math.max(0.1, Math.abs(temp - 10) * 0.04);
    const humFactor = (hum / 100) * 0.8;
    
    // Seeing value in arcseconds
    const seeingArcsec = baseSeeing + tempFactor + humFactor;
    
    // Scintillation frequency / turbulence scale
    const scintillationIndex = (seeingArcsec * 0.22).toFixed(3);
    
    let rating: 'POOR' | 'MODERATE' | 'EXCELLENT' = 'MODERATE';
    let ratingColor = 'text-amber-400';
    let ratingBg = 'bg-amber-950/35 border-amber-500/25';
    let description = 'Moderate thermal turbulence; standard celestial observation conditions.';
    
    if (seeingArcsec < 1.6) {
      rating = 'EXCELLENT';
      ratingColor = 'text-emerald-400';
      ratingBg = 'bg-emerald-950/35 border-emerald-500/25';
      description = 'Superb laminar air flow; ideal for high-magnification planetary tracking.';
    } else if (seeingArcsec > 2.6) {
      rating = 'POOR';
      ratingColor = 'text-rose-400';
      ratingBg = 'bg-rose-950/35 border-rose-500/25';
      description = 'Severe scintillation and twinkling; stellar details will blur rapidly.';
    }
    
    return {
      temp,
      hum,
      seeingArcsec: seeingArcsec.toFixed(2),
      scintillationIndex,
      rating,
      ratingColor,
      ratingBg,
      description
    };
  };

  // Auto-fetch fun fact (telemetry) on selection to directly provide fun fact
  useEffect(() => {
    if (object && objectLogs.length === 0 && !loading) {
      handleRequestTelemetry();
    }
  }, [object?.id, objectLogs.length]);

  // Parse cardinal directions from Azimuth
  const getCardinalDirection = (az: number) => {
    const val = Math.floor((az / 22.5) + 0.5);
    const arr = ["N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE", "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW"];
    return arr[(val % 16)];
  };

  const handleRequestTelemetry = async () => {
    if (!object) return;
    setLoading(true);
    setErrorStatus(null);
    
    try {
      const response = await fetch(`/api/intel?name=${encodeURIComponent(object.name)}`);

      if (!response.ok) {
        onGenerateLog(object, " no jokes for the day ", 'static_fallback');
        return;
      }

      const data = await response.json();
      onGenerateLog(object, data.content, data.generationType || 'intel');
    } catch (err: any) {
      console.error(err);
      onGenerateLog(object, " no jokes for the day ", 'static_fallback');
    } finally {
      setLoading(false);
    }
  };

  if (!object) {
    return (
      <div className="bg-slate-950/40 border border-slate-800/60 rounded-xl p-6 shadow-2xl h-full flex flex-col items-center justify-center text-center text-slate-500 backdrop-blur-md" id="empty-object-card">
        <Compass className="w-10 h-10 text-slate-700 animate-spin-slow mb-3" />
        <p className="text-xs font-mono tracking-widest uppercase font-bold text-slate-400">No Target Selected</p>
        <p className="text-xs text-slate-500 mt-2 max-w-[260px] leading-relaxed">Select any planet, satellite, or the ISS on the Globe or Planisphere to view real-time receiver telemetry and spectroscopic analysis</p>
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
                  className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[9px] font-mono font-bold bg-indigo-950 hover:bg-indigo-900 text-slate-100 transition-all border border-indigo-500/30 shadow-[0_0_8px_rgba(99,102,241,0.2)]"
                  title={`View highly-rated Google images from trusted astronomical sources for ${object.name}`}
                >
                  <span className="text-indigo-400 font-extrabold">G</span> Trusted Imagery
                </a>
              )}
            </div>
            <h2 className="text-lg font-bold text-slate-100 tracking-tight font-serif">{object.name}</h2>
          </div>
          
          <div className={`p-1 px-3 rounded-full text-[10px] font-mono font-bold border ${prevVisibilityColor(isVisible)}`}>
            {isVisible ? "● ABOVE HORIZON" : "○ BELOW HORIZON"}
          </div>
        </div>

        {/* Short static Description */}
        <p className="text-slate-400 text-xs tracking-wide leading-relaxed mb-4 bg-slate-900/40 p-3 rounded-xl border border-slate-850">
          {object.description}
        </p>

        {/* Real-time coordinates telemetry grid */}
        <div className="grid grid-cols-2 gap-3 mb-5 font-mono text-xs">
          <div className="bg-slate-900/40 border border-slate-850 p-2.5 rounded-lg">
            <span className="text-slate-500 text-[9px] font-bold block tracking-wider uppercase">
              LOCAL AZIMUTH (BEARING)
              <InfoTooltip content="The horizontal compass angle measured clockwise from true North (0° to 360°). Shows which direction to face." />
            </span>
            {object.localCoordinates ? (
              <span className="text-slate-200 font-bold block mt-1 text-sm">
                {object.localCoordinates.azimuth}° <span className="text-indigo-400">({getCardinalDirection(object.localCoordinates.azimuth)})</span>
              </span>
            ) : (
              <span className="text-slate-600 block mt-1 font-bold">N/A</span>
            )}
          </div>
          <div className="bg-slate-900/40 border border-slate-850 p-2.5 rounded-lg">
            <span className="text-slate-500 text-[9px] font-bold block tracking-wider uppercase">
              LOCAL ALTITUDE (ELEVATION)
              <InfoTooltip content="The vertical angle measured from your local horizon (0°) up to the Zenith (90°). Values > 0° mean it is currently above your horizon and visible!" />
            </span>
            {object.localCoordinates ? (
              <span className={`font-bold block mt-1 text-sm ${isVisible ? 'text-emerald-400' : 'text-slate-500'}`}>
                {object.localCoordinates.altitude}°
              </span>
            ) : (
              <span className="text-slate-600 block mt-1 font-bold">N/A</span>
            )}
          </div>

          <div className="bg-slate-900/40 border border-slate-850 p-2.5 rounded-lg col-span-2">
            <span className="text-slate-500 text-[9px] font-bold block tracking-wider uppercase">
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
              <div className="flex justify-between items-center mt-1 text-slate-200">
                <span>LAT: <strong className="text-indigo-400">{(object.coordinates.latitude || 0) >= 0 ? `${(object.coordinates.latitude || 0).toFixed(2)}°N` : `${Math.abs(object.coordinates.latitude || 0).toFixed(2)}°S`}</strong></span>
                <span>LNG: <strong className="text-indigo-400">{(object.coordinates.longitude || 0) >= 0 ? `${(object.coordinates.longitude || 0).toFixed(2)}°E` : `${Math.abs(object.coordinates.longitude || 0).toFixed(2)}°W`}</strong></span>
                {object.localCoordinates?.rangeKm && (
                  <span>RANGE: <strong className="text-slate-400">{Math.round(object.localCoordinates.rangeKm)}km</strong></span>
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
              <span className="text-slate-500 text-[9px] font-bold block tracking-wider uppercase">
                ORBITAL VELOCITY
                <InfoTooltip content="The kinetic velocity required to maintain orbital equilibrium. Higher velocities are found closer to gravity sources or in low orbits." />
              </span>
              <span className="text-slate-400 text-[8px] font-mono block mt-1 uppercase leading-none">
                {getVelocitySubtitle()}
              </span>
            </div>
            {getVelocity() !== null ? (
              <div className="text-right">
                <span className="text-emerald-400 font-bold block text-sm">
                  {getVelocity()?.toLocaleString()} km/h
                </span>
                <span className="text-[9px] text-slate-500 block mt-0.5">
                  ~{((getVelocity() || 0) / 3600).toFixed(2)} km/s
                </span>
              </div>
            ) : (
              <span className="text-slate-600 font-bold block mt-1">N/A</span>
            )}
          </div>
        </div>

        {/* Atmospheric Scintillation telemetry block */}
        {object && (() => {
          const sc = getAtmosphericScintillation();
          return (
            <div className="bg-slate-900/30 border border-slate-900 rounded-lg p-3 mt-3.5" id="scintillation-section">
              <span className="text-slate-500 text-[9px] font-bold block tracking-wider uppercase mb-2 flex items-center justify-between font-mono">
                <span className="flex items-center gap-1">
                  <Gauge className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                  ATMOSPHERIC SCINTILLATION / SEEING
                  <InfoTooltip content="Calculates refractive atmospheric scintillation and angular 'seeing' conditions in arcseconds based on ambient temperature, humidity, and micro-thermal air turbulence." />
                </span>
                <span className={`px-1.5 py-0.5 rounded text-[8px] font-extrabold uppercase shrink-0 ${sc.ratingBg} ${sc.ratingColor}`}>
                  SEEING: {sc.rating}
                </span>
              </span>
              
              <div className="grid grid-cols-2 gap-2 text-[10px] font-mono text-slate-300">
                <div className="bg-slate-950/40 p-2 rounded border border-slate-900/60 flex flex-col justify-between">
                  <div>
                    <span className="text-slate-500 text-[8px] font-bold block leading-none uppercase">Angular Seeing</span>
                    <strong className="text-slate-100 text-[11px] mt-1 block leading-none">{sc.seeingArcsec}" arcsec</strong>
                  </div>
                  <span className="text-slate-500 text-[7px] mt-1 block leading-tight">FWHM star profile diameter</span>
                </div>

                <div className="bg-slate-950/40 p-2 rounded border border-slate-900/60 flex flex-col justify-between">
                  <div>
                    <span className="text-slate-500 text-[8px] font-bold block leading-none uppercase">Scintillation Index</span>
                    <strong className="text-slate-100 text-[11px] mt-1 block leading-none">{sc.scintillationIndex} m_idx</strong>
                  </div>
                  <span className="text-slate-500 text-[7px] mt-1 block leading-tight">Twinkle frequency coefficient</span>
                </div>
              </div>

              <div className="mt-2 text-[8.5px] text-slate-400 font-mono italic leading-normal border-l border-indigo-500/30 pl-2">
                {sc.description} <span className="text-[7.5px] text-slate-500 not-italic block mt-0.5">(Calculated with real air variables: {sc.temp}°C, {sc.hum}% humidity)</span>
              </div>
            </div>
          );
        })()}

        {/* Physical specs display in blank space */}
        {getPhysicalSpecs().length > 0 && (
          <div className="bg-slate-900/20 border border-slate-900 rounded-lg p-2.5 mt-3">
            <span className="text-slate-500 text-[9px] font-bold block tracking-wider uppercase mb-1.5 flex items-center gap-1.5 font-mono">
              <Database className="w-3.5 h-3.5 text-indigo-400 animate-pulse" />
              PHYSICAL SPECS & CONSTANTS
            </span>
            <div className="grid grid-cols-2 gap-2 text-[10px] font-mono text-slate-300">
              {getPhysicalSpecs().map((spec, i) => (
                <div key={i} className="bg-slate-950/40 p-2 rounded border border-slate-900/60 flex flex-col justify-between">
                  <div>
                    <span className="text-slate-500 text-[8px] font-bold block leading-tight">{spec.label}</span>
                    <strong className="text-slate-100 text-[10.5px] mt-0.5 block leading-tight">{spec.value}</strong>
                  </div>
                  <span className="text-slate-500 text-[7.5px] mt-1 leading-tight block">{spec.desc}</span>
                </div>
              ))}
            </div>

            {/* Google Highly Rated Images call to action block */}
            <div className="mt-2.5 p-2.5 bg-indigo-950/20 border border-indigo-900/40 rounded flex items-center justify-between gap-3">
              <div className="flex flex-col">
                <span className="text-[8.5px] font-bold text-indigo-400 tracking-wider font-mono uppercase">Google Astronomy Image Engine</span>
                <span className="text-[9.5px] text-slate-300 font-mono mt-0.5 leading-none">Highly-rated views from Hubble, JWST, ESO</span>
              </div>
              <a
                href={`https://www.google.com/search?tbm=isch&q=${encodeURIComponent(object.name + ' astrophotography high resolution hubble webb site:eso.org OR site:hubblesite.org OR site:webbtelescope.org')}`}
                target="_blank"
                rel="noopener noreferrer"
                className="bg-indigo-650 hover:bg-indigo-600 text-white font-mono text-[9px] font-bold py-1 px-2.5 rounded transition-all cursor-pointer flex items-center gap-1 uppercase tracking-wider shadow-[0_0_10px_rgba(99,102,241,0.25)]"
              >
                <span className="text-indigo-300 font-bold">★</span>
                <span>GOOGLE IMAGES</span>
              </a>
            </div>
          </div>
        )}
      </div>

      {/* Observational reports logger module */}
      <div className="border-t border-slate-800/60 pt-4 mt-2">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-1.5 text-slate-300 text-xs font-mono font-bold uppercase tracking-wider">
            <Sparkles className="w-4 h-4 text-indigo-400 animate-pulse" />
            <span>FUN FACT</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleRequestTelemetry}
              disabled={loading}
              className="text-[9px] font-mono font-bold uppercase tracking-wider text-indigo-400 hover:text-indigo-300 transition-all flex items-center gap-1 cursor-pointer bg-slate-900/40 px-2 py-0.5 rounded border border-indigo-500/20 disabled:opacity-50"
              title="Query AI for a new custom fun fact / observation log"
            >
              <RefreshCw className={`w-2.5 h-2.5 ${loading ? 'animate-spin' : ''}`} />
              <span>RE-PROBE SPECTRA</span>
            </button>
            <span className="text-[10px] font-mono text-slate-500 font-bold uppercase">{objectLogs.length} FILED</span>
          </div>
        </div>

        {loading && objectLogs.length === 0 ? (
          <div className="bg-slate-950 border border-indigo-500/20 p-4 rounded-xl flex flex-col items-center justify-center text-center gap-2 mb-4">
            <Loader2 className="w-6 h-6 animate-spin text-indigo-400" />
            <span className="text-[10px] font-mono text-slate-400 tracking-widest uppercase animate-pulse">
              AI SCANNING TARGET SPECTROSCOPY...
            </span>
          </div>
        ) : objectLogs.length > 0 ? (
          <div className="max-h-[160px] overflow-y-auto space-y-3 mb-4 pr-1">
            {objectLogs.map((log) => (
              <div
                key={log.id}
                className={`p-3 rounded-lg text-xs leading-relaxed transition-all ${
                  log.generationType === 'intel'
                    ? 'bg-slate-950 border border-emerald-500/30 shadow-[0_0_10px_rgba(16,185,129,0.05)]'
                    : 'bg-slate-900/60 border border-slate-850'
                }`}
                id={`log-${log.id}`}
              >
                <div className="flex justify-between items-center mb-1 text-[10px] text-slate-500 font-mono border-b border-slate-900 pb-1">
                  <span>{log.timestamp}</span>
                  <span className="flex items-center gap-1">
                    {log.generationType === 'intel' ? (
                      <span className="text-emerald-400 text-[9px] px-1.5 py-0.5 bg-emerald-950/40 border border-emerald-900/30 rounded font-bold uppercase tracking-wider animate-pulse font-mono">PROBE INTEL</span>
                    ) : log.generationType === 'ai' ? (
                      <span className="text-indigo-400 text-[9px] px-1.5 py-0.5 bg-indigo-950/40 border border-indigo-900/30 rounded font-bold uppercase font-bold">AI DECODED</span>
                    ) : (
                      <span className="text-slate-500 text-[9px] px-1.5 py-0.5 bg-slate-900 border border-slate-800 rounded font-bold uppercase font-bold">PRESET DATA</span>
                    )}
                  </span>
                </div>
                <div
                  className={`font-sans tracking-wide leading-relaxed select-text prose prose-invert ${
                    log.generationType === 'intel' ? 'text-emerald-300 font-mono' : 'text-slate-300'
                  }`}
                  style={{ fontSize: '11px' }}
                >
                  {log.generationType === 'intel' && (
                    <div className="text-emerald-500 font-bold mb-1 text-[10px] animate-pulse font-mono">&gt;&gt;&gt; INCOMING SPECTRUM STREAM:</div>
                  )}
                  {log.content.split('\n').map((para, i) => (
                    <p key={i} className="mb-1">{para}</p>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="bg-slate-900/40 border border-slate-850/50 p-4 rounded-xl text-center text-slate-500 text-xs mb-4 font-mono leading-relaxed">
            No fun facts compiled for {object.name}. Click RE-PROBE SPECTRA above.
          </div>
        )}

        {errorStatus && (
          <p className="text-[10px] font-mono text-red-400/90 mt-2 bg-red-950/20 border border-red-900/30 p-2 rounded">
            ERROR: {errorStatus}
          </p>
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
