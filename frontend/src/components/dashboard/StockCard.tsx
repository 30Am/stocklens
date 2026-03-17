import { useNavigate } from 'react-router-dom';
import { SignalBadge } from '../common/SignalBadge';
import { MiniBarChart } from '../common/MiniBarChart';
import type { StockSummary } from '../../types';

function formatPrice(v: number, currency: 'INR' | 'USD') {
  const sym = currency === 'INR' ? '₹' : '$';
  return `${sym}${v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

const signalDot: Record<string, string> = {
  BUY: 'bg-emerald-400',
  HOLD: 'bg-amber-400',
  SELL: 'bg-red-400',
};

export function StockCard({ stock }: { stock: StockSummary }) {
  const navigate = useNavigate();
  const pos = (stock.change_pct ?? 0) >= 0;

  return (
    <div
      className="card-hover p-4 flex flex-col gap-3 animate-fade-in"
      onClick={() => navigate(`/stock/${stock.ticker}`)}
    >
      {/* Top row */}
      <div className="flex items-start justify-between">
        <div>
          <div className="font-bold text-white text-sm leading-tight">{stock.ticker}</div>
          <div className="text-zinc-500 text-[11px] mt-0.5 truncate max-w-[140px]">{stock.name}</div>
        </div>
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full shrink-0 ${signalDot[stock.signal] ?? 'bg-zinc-500'}`} />
        </div>
      </div>

      {/* Price row */}
      <div className="flex items-end justify-between">
        <div>
          <div className="text-xl font-bold text-white leading-none">
            {stock.close != null ? formatPrice(stock.close, stock.currency) : '—'}
          </div>
          <div className={`flex items-center gap-0.5 mt-1 text-xs font-medium ${pos ? 'text-emerald-400' : 'text-red-400'}`}>
            {pos ? (
              <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor">
                <path d="M5 2L9 7H1L5 2Z" />
              </svg>
            ) : (
              <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor">
                <path d="M5 8L1 3H9L5 8Z" />
              </svg>
            )}
            {pos ? '+' : ''}{(stock.change_pct ?? 0).toFixed(2)}%
          </div>
        </div>
        <SignalBadge signal={stock.signal} />
      </div>

      {/* Mini chart */}
      <div className="h-8">
        <MiniBarChart positive={pos} />
      </div>

      {/* AI reason */}
      {stock.reason && (
        <p className="text-zinc-500 text-[11px] leading-snug line-clamp-1">
          <span className="text-zinc-600">●</span> {stock.reason}
        </p>
      )}
    </div>
  );
}

export function StockCardSkeleton() {
  return (
    <div className="card p-4 flex flex-col gap-3">
      <div className="skeleton h-4 w-24 rounded" />
      <div className="skeleton h-6 w-32 rounded" />
      <div className="skeleton h-8 w-full rounded" />
      <div className="skeleton h-3 w-40 rounded" />
    </div>
  );
}
