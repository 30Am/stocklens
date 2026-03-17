import { useNavigate } from 'react-router-dom';
import type { StockSummary } from '../../types';

interface MoverRowProps {
  stock: StockSummary;
  rank: number;
}

function MoverRow({ stock, rank }: MoverRowProps) {
  const navigate = useNavigate();
  const pos = (stock.change_pct ?? 0) >= 0;
  const abs = Math.abs(stock.change_pct ?? 0);
  const barWidth = Math.min(100, abs * 20); // scale: 5% change = 100% bar

  return (
    <button
      onClick={() => navigate(`/stock/${stock.ticker}`)}
      className="w-full flex items-center gap-2 py-1.5 group text-left"
    >
      <span className="text-zinc-600 text-[10px] w-3 shrink-0">{rank}</span>
      <span className="text-xs font-medium text-white group-hover:text-blue-400 transition-colors truncate min-w-0 flex-1">
        {stock.ticker.replace('.NS', '').replace('.BO', '')}
      </span>
      <div className="w-16 bg-surface-2 rounded-full h-1 shrink-0">
        <div
          className={`h-1 rounded-full transition-all ${pos ? 'bg-emerald-500' : 'bg-red-500'}`}
          style={{ width: `${barWidth}%` }}
        />
      </div>
      <span className={`text-[11px] font-semibold w-12 text-right shrink-0 ${pos ? 'text-emerald-400' : 'text-red-400'}`}>
        {pos ? '+' : ''}{(stock.change_pct ?? 0).toFixed(2)}%
      </span>
    </button>
  );
}

export function TopMovers({ stocks }: { stocks: StockSummary[] }) {
  const gainers = [...stocks].filter((s) => (s.change_pct ?? 0) > 0).sort((a, b) => (b.change_pct ?? 0) - (a.change_pct ?? 0)).slice(0, 5);
  const losers = [...stocks].filter((s) => (s.change_pct ?? 0) < 0).sort((a, b) => (a.change_pct ?? 0) - (b.change_pct ?? 0)).slice(0, 5);

  return (
    <div className="space-y-4">
      {/* Gainers */}
      <div className="card p-4">
        <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-3">Top Gainers</h3>
        <div className="space-y-0.5">
          {gainers.map((s, i) => (
            <MoverRow key={s.ticker} stock={s} rank={i + 1} />
          ))}
          {gainers.length === 0 && <p className="text-zinc-600 text-xs">No data</p>}
        </div>
      </div>

      {/* Losers */}
      <div className="card p-4">
        <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-3">Top Losers</h3>
        <div className="space-y-0.5">
          {losers.map((s, i) => (
            <MoverRow key={s.ticker} stock={s} rank={i + 1} />
          ))}
          {losers.length === 0 && <p className="text-zinc-600 text-xs">No data</p>}
        </div>
      </div>
    </div>
  );
}
