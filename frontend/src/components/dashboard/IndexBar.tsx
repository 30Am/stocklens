import { useEffect, useState } from 'react';
import { useMarket } from '../../context/MarketContext';
import type { IndexData } from '../../types';
import { MOCK_INDICES } from '../../api/mock';
import { getLiveIndices } from '../../api/client';

function IndexItem({ idx }: { idx: IndexData }) {
  const pos = idx.change_pct >= 0;
  return (
    <div className="flex items-center gap-3 shrink-0">
      <div>
        <div className="text-[10px] text-zinc-500 leading-none mb-0.5">{idx.name}</div>
        <div className="flex items-baseline gap-1.5">
          <span className="text-sm font-semibold text-white">
            {idx.value.toLocaleString()}
          </span>
          <span className={`text-xs font-medium ${pos ? 'text-emerald-400' : 'text-red-400'}`}>
            {pos ? '+' : ''}{idx.change_pct.toFixed(2)}%
          </span>
        </div>
      </div>
    </div>
  );
}

export function IndexBar({ forex }: { forex: number }) {
  const { nseOpen, nyseOpen } = useMarket();
  const [indices, setIndices] = useState<IndexData[]>(MOCK_INDICES);

  useEffect(() => {
    getLiveIndices()
      .then((data: unknown) => {
        if (Array.isArray(data) && data.length > 0) setIndices(data as IndexData[]);
      })
      .catch(() => { /* keep mock */ });
  }, []);

  return (
    <div className="bg-surface-1 border-b border-border px-4 py-2">
      <div className="max-w-[1600px] mx-auto flex items-center gap-4 lg:gap-8 overflow-x-auto scrollbar-hide">
        {/* Indices */}
        <div className="flex items-center gap-4 lg:gap-8 flex-nowrap">
          {indices.map((idx) => (
            <IndexItem key={idx.name} idx={idx} />
          ))}
        </div>

        {/* Divider */}
        <div className="w-px h-6 bg-border shrink-0" />

        {/* Forex */}
        <div className="shrink-0">
          <div className="text-[10px] text-zinc-500 leading-none mb-0.5">USD/INR</div>
          <div className="text-sm font-semibold text-white">₹{forex.toFixed(2)}</div>
        </div>

        <div className="flex-1" />

        {/* Market status badges */}
        <div className="hidden sm:flex items-center gap-2 shrink-0">
          <span className={`flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full border ${nseOpen ? 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10' : 'text-red-400 border-red-500/30 bg-red-500/10'}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${nseOpen ? 'bg-emerald-400' : 'bg-red-400'}`} />
            NSE {nseOpen ? 'OPEN' : 'CLOSED'}
          </span>
          <span className={`flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full border ${nyseOpen ? 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10' : 'text-red-400 border-red-500/30 bg-red-500/10'}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${nyseOpen ? 'bg-emerald-400' : 'bg-red-400'}`} />
            NYSE {nyseOpen ? 'OPEN' : 'CLOSED'}
          </span>
        </div>
      </div>
    </div>
  );
}
