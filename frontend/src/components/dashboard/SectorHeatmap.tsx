import type { SectorData } from '../../types';
import { MOCK_NIFTY_SECTORS, MOCK_SP500_SECTORS } from '../../api/mock';

function sectorColor(pct: number): string {
  if (pct > 1.5) return 'bg-emerald-600 text-white';
  if (pct > 0.5) return 'bg-emerald-700/70 text-emerald-100';
  if (pct > 0) return 'bg-emerald-900/60 text-emerald-300';
  if (pct === 0) return 'bg-surface-2 text-zinc-400';
  if (pct > -0.5) return 'bg-red-900/50 text-red-300';
  if (pct > -1.5) return 'bg-red-700/60 text-red-100';
  return 'bg-red-600 text-white';
}

function SectorGrid({ title, flag, sectors }: { title: string; flag: string; sectors: SectorData[] }) {
  return (
    <div className="flex-1 min-w-0">
      <div className="flex items-center gap-1.5 mb-2">
        <span className="text-sm">{flag}</span>
        <span className="text-xs font-semibold text-zinc-300">{title}</span>
      </div>
      <div className="grid grid-cols-4 gap-1.5">
        {sectors.map((s) => (
          <div
            key={s.name}
            className={`rounded-lg px-2 py-2 text-center transition-transform hover:scale-[1.03] cursor-default ${sectorColor(s.change_pct)}`}
          >
            <div className="text-[9px] font-semibold leading-tight truncate">{s.name}</div>
            <div className="text-[10px] font-bold mt-0.5">
              {s.change_pct > 0 ? '+' : ''}{s.change_pct.toFixed(1)}%
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function SectorHeatmap() {
  return (
    <div className="card p-4">
      <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-4">
        Sector Sentiment Heatmap
      </h3>
      <div className="flex flex-col md:flex-row gap-6">
        <SectorGrid title="NIFTY Sectors" flag="🇮🇳" sectors={MOCK_NIFTY_SECTORS} />
        <div className="hidden md:block w-px bg-border" />
        <SectorGrid title="S&P 500 Sectors" flag="🇺🇸" sectors={MOCK_SP500_SECTORS} />
      </div>
    </div>
  );
}
