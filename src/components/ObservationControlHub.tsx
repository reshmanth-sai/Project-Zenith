import { useState, useMemo } from 'react';
import { Sparkles, Calendar, ChevronRight, CheckCircle2, AlertCircle, Star } from 'lucide-react';
import { CelestialObject, Observer } from '../types';

interface ObservationControlHubProps {
  currentQuestId: string;
  questCompleted: boolean;
  onNextQuest: () => void;
  questIndex: number;
  questList: string[];
  setTimeOffsetHours: (hours: number) => void;
  selectedObject: CelestialObject | null;
  handleAddNewLog: (object: CelestialObject, content: string, type: 'zenith' | 'static_fallback' | 'intel') => void;
  observer: Observer;
}

const QUEST_METADATA: Record<string, { name: string; targetStar: string; hint: string }> = {
  urmajor: { name: "Ursa Major", targetStar: "Alioth", hint: "Look high in the northern sky grid. Select the Great Bear icon." },
  orion: { name: "Orion", targetStar: "Rigel", hint: "Aligned near the celestial equator, look for the hunter with the three-star belt." },
  cassiopeia: { name: "Cassiopeia", targetStar: "Schedar", hint: "The distinct stellar 'W' pattern located high in the northern quadrant." },
  cygnus: { name: "Cygnus", targetStar: "Deneb", hint: "The stellar cross/swan structure flying along the Milky Way band." },
  leo: { name: "Leo", targetStar: "Regulus", hint: "Look for the stellar lion constellation featuring the bright blue-white Regulus." },
  urminor: { name: "Ursa Minor", targetStar: "Polaris", hint: "Centered close to the northern celestial pole, anchoring the northern rotational sky." },
  pegasus: { name: "Pegasus", targetStar: "Enif", hint: "The grand high-altitude autumn square representing the mythological winged stallion." },
  taurus: { name: "Taurus", targetStar: "Aldebaran", hint: "A prominent winter constellation featuring the bright reddish-orange Aldebaran." }
};

export default function ObservationControlHub({
  currentQuestId,
  questCompleted,
  onNextQuest,
  questIndex,
  questList,
  setTimeOffsetHours,
  selectedObject,
  handleAddNewLog,
  observer
}: ObservationControlHubProps) {
  const [activeTab, setActiveTab] = useState<'quest' | 'events'>('quest');

  const activeQuest = QUEST_METADATA[currentQuestId] || { name: "Unknown", targetStar: "", hint: "" };

  // Continuously generate 3 high-quality location-dependent cosmic events based on map coordinates
  const dynamicEvents = useMemo(() => {
    const { latitude, longitude, name: locName } = observer;
    
    // Event 1: Aurora vs. Equatorial Zodiacal Light
    let event1Name = "Milky Way Galactic Core Peak";
    let event1Desc = "The dense galactic center reaches peak overhead visibility in low-glare twilight.";
    let event1Warp = 3.0;
    
    if (Math.abs(latitude) > 52) {
      const isNorthern = latitude > 0;
      event1Name = isNorthern ? "Aurora Borealis Glow" : "Aurora Australis Glow";
      event1Desc = `Vibrant geomagnetic storms ignite ionization ribbons above ${locName}.`;
      event1Warp = isNorthern ? 6.5 : 7.0;
    } else if (Math.abs(latitude) < 15) {
      event1Name = "Zodiacal Light Column";
      event1Desc = "Interplanetary cosmic dust scatters solar light, forming a distinct dawn/dusk cone.";
      event1Warp = 1.5;
    }

    // Event 2: Constellation Zenith Alignments based on latitude
    let event2Name = "Equatorial Orion Crossing";
    let event2Desc = "The famous cosmic hunter climbs directly overhead, centered perfectly on the local meridian.";
    let event2Warp = 2.0;

    if (latitude > 25) {
      event2Name = "Ursa Major Zenith Transit";
      event2Desc = "The Great Bear constellation reaches apex transit altitude directly over the northern celestial pole.";
      event2Warp = 4.0;
    } else if (latitude < -25) {
      event2Name = "Southern Cross (Crux) Transit";
      event2Desc = "The iconic southern celestial anchor reaches its highest point of meridian visibility.";
      event2Warp = 5.5;
    }

    // Event 3: Dynamic ISS Pass Opportunity (calculated deterministically with coordinates hash)
    const hash = Math.abs(Math.sin(latitude * 0.08 + longitude * 0.03));
    const passOffset = parseFloat((1.0 + hash * 11).toFixed(1));
    const peakElevation = Math.round(35 + hash * 52);
    
    const event3Name = `ISS High-Elevation Crossing`;
    const event3Desc = `Space Station will cut overhead at ${peakElevation}° elevation (superb tracking window for Ground Station).`;
    const event3Warp = passOffset;

    return [
      { id: 'evt-1', name: event1Name, description: event1Desc, warp: event1Warp, label: `+${event1Warp}h` },
      { id: 'evt-2', name: event2Name, description: event2Desc, warp: event2Warp, label: `+${event2Warp}h` },
      { id: 'evt-3', name: event3Name, description: event3Desc, warp: event3Warp, label: `+${event3Warp}h` }
    ];
  }, [observer.latitude, observer.longitude, observer.name]);

  return (
    <div className="flex-1 flex flex-col justify-between" id="obs-control-hub-root">
      {/* Tab Selectors (Dual-column: Quest and Events) */}
      <div className="grid grid-cols-2 gap-1 bg-slate-900/60 p-1 rounded-lg border border-slate-900/80 mb-3.5">
        <button
          onClick={() => setActiveTab('quest')}
          className={`py-1.5 rounded font-mono text-[9px] font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
            activeTab === 'quest'
              ? 'bg-indigo-600/20 text-indigo-300 border border-indigo-500/30 shadow-[0_0_8px_rgba(99,102,241,0.15)]'
              : 'text-slate-500 hover:text-slate-300 border border-transparent'
          }`}
          id="btn-tab-quest"
        >
          <Star className="w-3.5 h-3.5" />
          <span>QUEST CHALLENGE</span>
        </button>
        <button
          onClick={() => setActiveTab('events')}
          className={`py-1.5 rounded font-mono text-[9px] font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
            activeTab === 'events'
              ? 'bg-indigo-600/20 text-indigo-300 border border-indigo-500/30 shadow-[0_0_8px_rgba(99,102,241,0.15)]'
              : 'text-slate-500 hover:text-slate-300 border border-transparent'
          }`}
          id="btn-tab-events"
        >
          <Calendar className="w-3.5 h-3.5" />
          <span>LIVE EVENTS</span>
        </button>
      </div>

      {/* Tab Body */}
      <div className="flex-1 flex flex-col justify-between min-h-[220px]" id="obs-control-hub-body">
        {activeTab === 'quest' && (
          <div className="flex flex-col justify-between flex-1 gap-3" id="quest-tab-view">
            <div className="space-y-2.5">
              <div className="flex items-start gap-2.5 bg-slate-900/30 border border-slate-900 p-3 rounded-lg">
                <div className="p-1.5 rounded bg-indigo-500/10 text-indigo-400 mt-0.5 animate-pulse">
                  <Sparkles className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-[10px] font-mono text-indigo-400 font-bold uppercase tracking-wider">Active Challenge</h4>
                  <p className="text-[11px] text-slate-200 leading-relaxed font-sans">
                    Scan the heavens to locate and click the constellation: <strong className="text-white bg-indigo-950 px-1.5 py-0.5 rounded border border-indigo-500/30">{activeQuest.name}</strong>.
                  </p>
                </div>
              </div>

              <div className="text-[10.5px] font-mono bg-slate-950 p-2.5 rounded-lg border border-slate-900 text-slate-400 space-y-1">
                <div><span className="text-slate-500">BRIGHTEST STAR:</span> <span className="text-slate-300 font-bold">{activeQuest.targetStar}</span></div>
                <div><span className="text-slate-500">NAVIGATION KEY:</span> <span className="text-slate-300">{activeQuest.hint}</span></div>
              </div>
            </div>

            {questCompleted ? (
              <div className="bg-emerald-950/20 border border-emerald-500/30 rounded-xl p-3 flex flex-col items-center text-center gap-2 shadow-[0_0_12px_rgba(16,185,129,0.1)] animate-fade-in">
                <CheckCircle2 className="w-7 h-7 text-emerald-400 animate-bounce" />
                <div>
                  <h5 className="text-[10.5px] font-mono text-emerald-400 font-extrabold uppercase">STATION ACQUIRED!</h5>
                  <p className="text-[10px] text-emerald-300 font-sans">Lock confirmed on {activeQuest.name}. +100 EXP added.</p>
                </div>
                <button
                  onClick={onNextQuest}
                  className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-mono text-[9px] font-extrabold py-1.5 rounded-lg transition-all flex items-center justify-center gap-1 cursor-pointer uppercase tracking-wider shadow-[0_0_8px_rgba(16,185,129,0.2)] mt-1"
                >
                  <span>NEXT STELLAR TARGET</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <div className="bg-slate-950/60 border border-slate-900/80 p-2.5 rounded-lg text-center flex items-center justify-center gap-2">
                <AlertCircle className="w-4 h-4 text-slate-500 animate-pulse shrink-0" />
                <span className="text-[10px] font-mono text-slate-500 uppercase tracking-wider animate-pulse">
                  ACQUIRING TELESCOPIC VECTOR...
                </span>
              </div>
            )}
          </div>
        )}

        {activeTab === 'events' && (
          <div className="space-y-2.5 flex-1 flex flex-col justify-between animate-fade-in" id="events-tab-view">
            <div className="space-y-2">
              <span className="text-[9px] font-mono font-bold uppercase tracking-wider text-slate-500 block">
                LOCATION EVENTS: {observer.name}
              </span>
              
              {dynamicEvents.map((evt) => (
                <div 
                  key={evt.id} 
                  className="bg-slate-950 border border-slate-900 rounded-lg p-2.5 flex items-center justify-between gap-3 hover:border-indigo-500/20 transition-all"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[9.5px] font-mono font-extrabold text-slate-200 truncate uppercase">
                        {evt.name}
                      </span>
                      <span className="text-[8px] font-mono font-bold text-indigo-400 bg-indigo-950/50 border border-indigo-900/40 px-1 rounded">
                        {evt.label}
                      </span>
                    </div>
                    <p className="text-[9px] text-slate-500 leading-normal line-clamp-1 mt-0.5">
                      {evt.description}
                    </p>
                  </div>
                  <button
                    onClick={() => setTimeOffsetHours(evt.warp)}
                    className="shrink-0 bg-slate-900 border border-indigo-500/30 hover:bg-indigo-950 hover:text-indigo-300 text-indigo-400 font-mono text-[9px] font-bold px-2 py-1 rounded cursor-pointer transition-all active:scale-95 shadow-sm"
                  >
                    WARP
                  </button>
                </div>
              ))}
            </div>

            <div className="text-[9px] font-mono text-slate-500 text-center leading-relaxed">
              Events calibrate dynamically for this coordinate. Warp adjusts timeline offset instantly.
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
