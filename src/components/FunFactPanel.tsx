import { useState, useEffect } from 'react';
import { Sparkles, RefreshCw, Loader2, Database } from 'lucide-react';
import { CelestialObject, ObsLog } from '../types';

interface FunFactPanelProps {
  object: CelestialObject | null;
  savedLogs: ObsLog[];
  onGenerateLog: (object: CelestialObject, logContent: string, genType: 'zenith' | 'static_fallback' | 'intel') => void;
}

function getScientificFallbackFact(name: string): string {
  const n = name.toLowerCase();
  if (n.includes('sun')) {
    return "The Sun is a nearly perfect sphere of hot plasma, heated to incandescence by nuclear fusion reactions in its core. It radiates energy mainly as visible light, ultraviolet, and infrared radiation, providing the primary energy source for life on Earth.";
  }
  if (n.includes('moon')) {
    return "Earth's Moon is in synchronous rotation, meaning it always shows the same face to us. The dark plains are volcanic maria, while the lighter highlands represent the ancient lunar crust. It is crucial in stabilizing Earth's axial tilt and driving tidal currents.";
  }
  if (n.includes('venus')) {
    return "Venus is covered by an extremely dense atmosphere of carbon dioxide and sulfuric acid, causing a runaway greenhouse effect that makes it the hottest planet in the Solar System. It rotates retrogradely and extremely slowly.";
  }
  if (n.includes('mars')) {
    return "Mars is a cold desert world with a thin carbon dioxide atmosphere. It hosts Olympus Mons, the largest volcano in the Solar System, and Valles Marineris, a canyon system dwarfing the Grand Canyon. Iron oxide dust gives its surface its signature reddish tint.";
  }
  if (n.includes('jupiter')) {
    return "Jupiter is a massive gas giant over twice as massive as all other planets combined. It features a prominent storm system called the Great Red Spot, which has raged for centuries, and possesses dozens of moons, including the volcanically active Io and icy Europa.";
  }
  if (n.includes('iss') || n.includes('international space station')) {
    return "The International Space Station serves as a microgravity and space environment research laboratory in low Earth orbit. It orbits Earth roughly every 90 minutes at an altitude of 420 kilometers, hosting international scientific collaborations.";
  }
  if (n.includes('hubble') || n.includes('hst')) {
    return "The Hubble Space Telescope has been orbiting Earth since 1990, capturing ultra-deep optical, ultraviolet, and near-infrared views of the cosmos, free from atmospheric distortions. It has helped determine the rate of expansion of the universe.";
  }
  if (n.includes('mangalyaan')) {
    return "India's Mars Orbiter Mission (MOM), also called Mangalyaan, was launched in 2013 by ISRO. It made India the first nation to reach Martian orbit on its maiden attempt, studying the Martian atmosphere and surface morphology.";
  }
  if (n.includes('aditya')) {
    return "Aditya-L1 is India's first dedicated space mission to study the Sun. Positioned at the Lagrange Point 1 (L1), it provides continuous, unobstructed views of the solar corona, chromosphere, and solar wind particles.";
  }
  if (n.includes('cartosat')) {
    return "Cartosat-3 is an advanced earth observation satellite built by ISRO. It features a high spatial resolution of 25 cm, providing critical imagery for urban planning, infrastructure development, and disaster management.";
  }
  if (n.includes('aryabhata')) {
    return "Aryabhata was India's historic first satellite, launched in 1975. Named after the legendary 5th-century Indian astronomer, it conducted experiments in X-ray astronomy, aeronomy, and solar physics.";
  }
  if (n.includes('starlink')) {
    return "Starlink is a satellite constellation operated by SpaceX, providing global high-speed, low-latency broadband internet. Utilizing optical laser links in low Earth orbit, it aims to connect remote and underserved regions.";
  }
  return `Spectroscopic telemetry for ${name} shows stable albedo reflectance signatures. Thermal emission levels are within nominal parameters. Ground station reception remains clear.`;
}

export default function FunFactPanel({ object, savedLogs, onGenerateLog }: FunFactPanelProps) {
  const [loading, setLoading] = useState(false);
  const [errorStatus, setErrorStatus] = useState<string | null>(null);

  // Find existing logs for this object
  const objectLogs = object ? savedLogs.filter(log => log.objectName === object.name) : [];

  const handleRequestTelemetry = async () => {
    if (!object) return;
    setLoading(true);
    setErrorStatus(null);
    
    try {
      const response = await fetch(`/api/intel?name=${encodeURIComponent(object.name)}`);

      if (!response.ok) {
        onGenerateLog(object, getScientificFallbackFact(object.name), 'static_fallback');
        return;
      }

      const data = await response.json();
      onGenerateLog(object, data.content, data.generationType || 'intel');
    } catch (err: any) {
      console.error(err);
      onGenerateLog(object, getScientificFallbackFact(object.name), 'static_fallback');
    } finally {
      setLoading(false);
    }
  };

  // Auto-fetch fun fact (telemetry) on selection to directly provide fun fact
  useEffect(() => {
    if (object && objectLogs.length === 0 && !loading) {
      handleRequestTelemetry();
    }
  }, [object?.id, objectLogs.length]);

  if (!object) {
    return (
      <div className="bg-slate-950/60 border border-slate-900 rounded-xl p-5 shadow-2xl font-mono text-center text-slate-500 backdrop-blur-md h-[180px] flex flex-col items-center justify-center" id="empty-fun-fact-panel">
        <Sparkles className="w-8 h-8 text-slate-700 animate-pulse mb-2" />
        <p className="text-xs font-bold uppercase tracking-widest text-slate-400">Telemetry Decoder Idle</p>
        <p className="text-[11px] text-slate-500 mt-1 max-w-[280px] leading-relaxed">Select a target to initialize spectroscopic analysis and decodable telemetry stream logs.</p>
      </div>
    );
  }

  return (
    <div className="bg-slate-950/60 border border-slate-900 rounded-xl p-5 shadow-2xl font-mono backdrop-blur-md" id="fun-fact-panel">
      <div className="flex items-center justify-between mb-3 border-b border-slate-900/60 pb-2">
        <div className="flex items-center gap-1.5 text-slate-300 text-sm font-bold uppercase tracking-wider">
          <Sparkles className="w-4 h-4 text-indigo-400 animate-pulse" />
          <span>SPECTRAL INTEL & FUN FACT</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleRequestTelemetry}
            disabled={loading}
            className="text-xs font-mono font-bold uppercase tracking-wider text-indigo-400 hover:text-indigo-300 transition-all flex items-center gap-1 cursor-pointer bg-slate-900/40 px-2 py-0.5 rounded border border-indigo-500/20 disabled:opacity-50"
            title="Query Zenith for a new custom fun fact / observation log"
          >
            <RefreshCw className={`w-2.5 h-2.5 ${loading ? 'animate-spin' : ''}`} />
            <span>RE-PROBE</span>
          </button>
          <span className="text-xs text-slate-500 font-bold uppercase">{objectLogs.length} FILED</span>
        </div>
      </div>

      {loading && objectLogs.length === 0 ? (
        <div className="bg-slate-950/80 border border-indigo-500/20 p-4 rounded-xl flex flex-col items-center justify-center text-center gap-2 h-[120px]">
          <Loader2 className="w-6 h-6 animate-spin text-indigo-400" />
          <span className="text-xs text-slate-400 tracking-widest uppercase animate-pulse">
            ZENITH SPECTRAL TUNING...
          </span>
        </div>
      ) : objectLogs.length > 0 ? (
        <div className="max-h-[160px] overflow-y-auto space-y-3 pr-1 custom-scrollbar">
          {objectLogs.map((log) => (
            <div
              key={log.id}
              className={`p-3 rounded-lg text-xs leading-relaxed transition-all ${
                log.generationType === 'intel'
                  ? 'bg-slate-900/40 border border-emerald-500/30 shadow-[0_0_10px_rgba(16,185,129,0.05)]'
                  : 'bg-slate-900/20 border border-slate-850'
              }`}
              id={`log-${log.id}`}
            >
              <div className="flex justify-between items-center mb-1 text-xs text-slate-500 font-mono border-b border-slate-900/40 pb-1">
                <span>{log.timestamp}</span>
                <span className="flex items-center gap-1">
                  {log.generationType === 'intel' ? (
                    <span className="text-emerald-400 text-xs px-1.5 py-0.5 bg-emerald-950/40 border border-emerald-900/30 rounded font-bold uppercase tracking-wider animate-pulse font-mono">PROBE INTEL</span>
                  ) : log.generationType === 'zenith' ? (
                    <span className="text-indigo-400 text-xs px-1.5 py-0.5 bg-indigo-950/40 border border-indigo-900/30 rounded font-bold uppercase">ZENITH DECODED</span>
                  ) : (
                    <span className="text-slate-500 text-xs px-1.5 py-0.5 bg-slate-900 border border-slate-800 rounded font-bold uppercase">PRESET DATA</span>
                  )}
                </span>
              </div>
              <div
                className={`font-sans tracking-wide leading-relaxed select-text prose prose-invert ${
                  log.generationType === 'intel' ? 'text-emerald-300 font-mono' : 'text-slate-300'
                }`}
                style={{ fontSize: '12.5px' }}
              >
                {log.generationType === 'intel' && (
                  <div className="text-emerald-500 font-bold mb-1 text-xs animate-pulse font-mono">&gt;&gt;&gt; INCOMING DECODED STREAM:</div>
                )}
                {log.content.split('\n').map((para, i) => (
                  <p key={i} className="mb-1">{para}</p>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-slate-900/20 border border-slate-850/50 p-4 rounded-xl text-center text-slate-500 text-xs font-mono leading-relaxed h-[120px] flex items-center justify-center">
          No logs compiled for {object.name}. Click RE-PROBE above.
        </div>
      )}

      {errorStatus && (
        <p className="text-xs font-mono text-red-400/90 mt-2 bg-red-950/20 border border-red-900/30 p-2 rounded">
          ERROR: {errorStatus}
        </p>
      )}
    </div>
  );
}
