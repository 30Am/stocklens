import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { SignalBadge } from '../components/common/SignalBadge';
import { MiniBarChart } from '../components/common/MiniBarChart';
import { AlertModal } from '../components/watchlist/AlertModal';
import { useWatchlist } from '../context/WatchlistContext';
import { useToast } from '../components/common/ToastProvider';
import { useWebSocket } from '../hooks/useWebSocket';
import { MOCK_STOCKS } from '../api/mock';
import type { WatchlistItem } from '../context/WatchlistContext';

interface LivePrice { ticker: string; close: number; change_pct?: number; signal?: string }

export function Watchlist() {
  const navigate = useNavigate();
  const { items, remove, setAlert } = useWatchlist();
  const { show } = useToast();
  const [search, setSearch] = useState('');
  const [alertTarget, setAlertTarget] = useState<WatchlistItem | null>(null);
  const [livePrices, setLivePrices] = useState<Record<string, number>>({});

  // Live price updates + alert checking
  const handlePrices = useCallback((data: unknown) => {
    if (!Array.isArray(data)) return;
    const updates = data as LivePrice[];
    setLivePrices((prev) => {
      const next = { ...prev };
      for (const u of updates) next[u.ticker] = u.close;
      return next;
    });
    // Check alerts
    for (const u of updates) {
      const item = items.find((i) => i.ticker === u.ticker);
      if (!item) continue;
      const sym = item.currency === 'INR' ? '₹' : '$';
      if (item.alertAbove && u.close >= item.alertAbove) {
        show(`🔔 ${u.ticker} crossed above ${sym}${item.alertAbove.toLocaleString()}! Now at ${sym}${u.close.toLocaleString()}`, 'success');
      }
      if (item.alertBelow && u.close <= item.alertBelow) {
        show(`🔔 ${u.ticker} dropped below ${sym}${item.alertBelow.toLocaleString()}! Now at ${sym}${u.close.toLocaleString()}`, 'warning');
      }
    }
  }, [items, show]);

  useWebSocket('/ws/prices', handlePrices);

  // Merge watchlist with mock data for display
  const displayItems = items.map((wi) => {
    const mock = MOCK_STOCKS.find((s) => s.ticker === wi.ticker);
    const close = livePrices[wi.ticker] ?? mock?.close ?? null;
    const change_pct = mock?.change_pct ?? null;
    const signal = mock?.signal ?? 'HOLD';
    return { ...wi, close, change_pct, signal };
  });

  const filtered = displayItems.filter(
    (s) => s.ticker.toLowerCase().includes(search.toLowerCase()) || s.name.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div className="flex-1 max-w-[1600px] w-full mx-auto px-4 py-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-lg font-semibold text-white">★ Watchlist</h1>
          <p className="text-xs text-zinc-500 mt-0.5">{items.length} stocks · alerts active on {items.filter((i) => i.alertAbove || i.alertBelow).length}</p>
        </div>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Filter watchlist..."
          className="bg-surface-2 border border-border rounded-lg px-3 py-1.5 text-sm text-zinc-300 placeholder-zinc-600 focus:outline-none focus:border-zinc-600 w-48"
        />
      </div>

      {items.length === 0 ? (
        <div className="card p-12 text-center">
          <div className="text-4xl mb-3">☆</div>
          <p className="text-zinc-400 text-sm mb-2">Your watchlist is empty</p>
          <p className="text-zinc-600 text-xs">Open any stock detail page and click "Add to Watchlist"</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((stock) => {
            const pos = (stock.change_pct ?? 0) >= 0;
            const hasAlert = stock.alertAbove || stock.alertBelow;
            const sym = stock.currency === 'INR' ? '₹' : '$';
            return (
              <div
                key={stock.ticker}
                className="card-hover p-4 flex items-center gap-3 sm:gap-4 group"
                onClick={() => navigate(`/stock/${stock.ticker}`)}
              >
                {/* Name */}
                <div className="w-32 sm:w-40 shrink-0">
                  <div className="font-semibold text-white text-sm">{stock.ticker}</div>
                  <div className="text-zinc-500 text-[11px] truncate">{stock.name}</div>
                </div>

                {/* Price */}
                <div className="min-w-[90px] sm:min-w-[110px] shrink-0">
                  <div className="text-base font-bold text-white">
                    {stock.close != null ? `${sym}${stock.close.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '—'}
                  </div>
                  <div className={`text-xs font-medium ${pos ? 'text-emerald-400' : 'text-red-400'}`}>
                    {pos ? '+' : ''}{(stock.change_pct ?? 0).toFixed(2)}%
                  </div>
                </div>

                {/* Mini chart */}
                <div className="flex-1 min-w-0 h-8 hidden sm:block">
                  <MiniBarChart positive={pos} />
                </div>

                {/* Alert badge */}
                <button
                  onClick={(e) => { e.stopPropagation(); setAlertTarget(stock); }}
                  className={`shrink-0 flex items-center gap-1 px-2.5 py-1 rounded-lg border text-xs font-medium transition-all ${
                    hasAlert
                      ? 'border-amber-500/40 bg-amber-500/10 text-amber-400'
                      : 'border-border text-zinc-600 hover:border-zinc-600 hover:text-zinc-400'
                  }`}
                  title="Set price alert"
                >
                  🔔{hasAlert ? (
                    <span>
                      {stock.alertAbove && `↑${sym}${stock.alertAbove.toLocaleString()}`}
                      {stock.alertAbove && stock.alertBelow && ' '}
                      {stock.alertBelow && `↓${sym}${stock.alertBelow.toLocaleString()}`}
                    </span>
                  ) : <span className="hidden sm:inline">Alert</span>}
                </button>

                {/* Signal + remove */}
                <div className="flex items-center gap-2 shrink-0">
                  <SignalBadge signal={stock.signal as 'BUY' | 'HOLD' | 'SELL'} />
                  <button
                    onClick={(e) => { e.stopPropagation(); remove(stock.ticker); show(`Removed ${stock.ticker} from watchlist`, 'info'); }}
                    className="text-zinc-700 hover:text-red-400 transition-colors text-sm ml-1 opacity-0 group-hover:opacity-100"
                  >
                    ✕
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Alert modal */}
      {alertTarget && (
        <AlertModal
          item={alertTarget}
          currentPrice={livePrices[alertTarget.ticker] ?? MOCK_STOCKS.find((s) => s.ticker === alertTarget.ticker)?.close ?? null}
          onSave={(a, b) => { setAlert(alertTarget.ticker, a, b); show(`Alert saved for ${alertTarget.ticker}`, 'success'); }}
          onClose={() => setAlertTarget(null)}
        />
      )}
    </div>
  );
}
