import { useState } from 'react';
import { Gauge } from 'lucide-react';

interface AtmosphericSuitabilityProps {
  bortleScale: number;
  temperature: number | null;
  humidity: number | null;
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

export default function AtmosphericSuitability({ bortleScale, temperature, humidity }: AtmosphericSuitabilityProps) {
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

  const bScale = bortleScale || 3;
  const nelm = (6.5 - 0.5 * (bScale - 1)).toFixed(1);
  const transparencyScore = Math.max(10, Math.min(100, Math.round(100 - (bScale * 6) - (hum * 0.22))));
  
  let transText = 'OPTIMAL';
  let transColor = 'text-emerald-400 border-emerald-950/80 bg-emerald-950/20';
  if (transparencyScore < 45) {
    transText = 'POOR OBS';
    transColor = 'text-rose-400 border-rose-950/80 bg-rose-950/20';
  } else if (transparencyScore < 70) {
    transText = 'MODERATE';
    transColor = 'text-amber-400 border-amber-950/80 bg-amber-950/20';
  }

  return (
    <div className="bg-slate-950/60 border border-slate-900 rounded-xl p-5 shadow-2xl font-mono backdrop-blur-md" id="suitability-section">
      <span className="text-slate-500 text-xs font-bold block tracking-wider uppercase mb-2.5 flex items-center justify-between">
        <span className="flex items-center gap-1">
          <Gauge className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
          ATMOSPHERIC SUITABILITY INDEX
          <InfoTooltip content="Observatory conditions forecast assessing seeing quality, Bortle scale glare, limiting magnitude, and sky transparency." />
        </span>
        <span className={`px-1.5 py-0.5 rounded text-xs font-extrabold uppercase border ${transColor}`}>
          SUITABILITY: {transText} ({transparencyScore}%)
        </span>
      </span>
      
      <div className="grid grid-cols-2 gap-2 text-xs text-slate-300">
        <div className="bg-slate-900/40 p-2 rounded border border-slate-850/60 flex flex-col justify-between">
          <div>
            <span className="text-slate-500 text-xs font-bold block leading-none uppercase">Angular Seeing</span>
            <strong className="text-slate-100 text-sm mt-1.5 block leading-none font-bold">{seeingArcsec.toFixed(2)}" arcsec</strong>
          </div>
          <span className="text-xs mt-1.5 block leading-tight text-indigo-400 uppercase font-semibold">SEEING: {rating}</span>
        </div>

        <div className="bg-slate-900/40 p-2 rounded border border-slate-850/60 flex flex-col justify-between">
          <div>
            <span className="text-slate-500 text-xs font-bold block leading-none uppercase">Bortle Light Pollution</span>
            <strong className="text-slate-100 text-sm mt-1.5 block leading-none font-bold">Class {bScale}</strong>
          </div>
          <div className="w-full bg-slate-950/85 h-1.5 rounded-full overflow-hidden mt-1.5 flex border border-slate-900/40">
            <div 
              className={`h-full rounded-full ${bScale <= 3 ? 'bg-emerald-400' : bScale <= 6 ? 'bg-amber-400' : 'bg-red-500'}`}
              style={{ width: `${(bScale / 9) * 100}%` }}
            />
          </div>
        </div>

        <div className="bg-slate-900/40 p-2 rounded border border-slate-850/60 flex flex-col justify-between">
          <div>
            <span className="text-slate-500 text-xs font-bold block leading-none uppercase">Limiting Magnitude</span>
            <strong className="text-slate-100 text-sm mt-1.5 block leading-none font-bold">+{nelm} mag</strong>
          </div>
          <span className="text-slate-500 text-xs mt-1.5 block leading-tight">Faintest naked-eye stars</span>
        </div>

        <div className="bg-slate-900/40 p-2 rounded border border-slate-850/60 flex flex-col justify-between">
          <div>
            <span className="text-slate-500 text-xs font-bold block leading-none uppercase">Scintillation Index</span>
            <strong className="text-slate-100 text-sm mt-1.5 block leading-none font-bold">{scintillationIndex} m_idx</strong>
          </div>
          <span className="text-slate-500 text-xs mt-1.5 block leading-tight">Twinkle freq variance</span>
        </div>
      </div>

      <div className="mt-2.5 text-xs text-slate-400 italic leading-normal border-l border-indigo-500/30 pl-2">
        {description} <span className="text-xs text-slate-500 not-italic block mt-0.5">(Calculated with real air variables: {temp}°C, {hum}% RH, Bortle {bScale})</span>
      </div>
    </div>
  );
}
