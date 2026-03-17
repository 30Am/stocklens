import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePortfolio } from '../context/PortfolioContext';
import { useToast } from '../components/common/ToastProvider';
import { useWebSocket } from '../hooks/useWebSocket';
import { AddPositionModal } from '../components/portfolio/AddPositionModal';
import { SignalBadge } from '../components/common/SignalBadge';
import { MOCK_STOCKS } from '../api/mock';
import { useMarket } from '../context/MarketContext';

interface LivePrice { ticker: string; close: number; signal?: string }

function formatCurrency(v: number, currency: 'INR' | 'USD') {
  const sym = currency === 'INR' ? '₹' : '$';
  if (Math.abs(v) >= 1e7) return `${sym}${(v / 1e7).toFixed(2)} Cr`;
  if (Math.abs(v) >= 1e5) return `${sym}${(v / 1e5).toFixed(2)} L`;
  return `${sym}${v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function Portfolio() {
  const navigate = useNavigate();
  const { positions, addPosition, removePosition } = usePortfolio();
  const { show } = useToast();
  const { forex } = useMarket();
  const [showAdd, setShowAdd] = useState(false);
  const [livePrices, setLivePrices] = useState<Record<string, number>>({});
  const [liveSignals, setLiveSignals] = useState<Record<string, string>>({});

  const handlePrices = useCallback((data: unknown) => {
    if (!Array.isArray(data)) return;
    const updates = data as LivePrice[];
    setLivePrices((prev) => {
      const next = { ...prev };
      for (const u of updates) next[u.ticker] = u.close;
      return next;
    });
    setLiveSignals((prev) => {
      const next = { ...prev };
      for (const u of updates) if (u.signal) next[u.ticker] = u.signal;
      return next;
    });
  }, []);

  useWebSocket('/ws/prices', handlePrices);

  // Enrich positions with live/mock prices
  const enriched = positions.map((p) => {
    const mock = MOCK_STOCKS.find((s) => s.ticker === p.ticker);
    const currentPrice = livePrices[p.ticker] ?? mock?.close ?? p.buyPrice;
    const signal = liveSignals[p.ticker] ?? mock?.signal ?? 'HOLD';
    const currentValue = currentPrice * p.qty;
    const costBasis = p.buyPrice * p.qty;
    const pnl = currentValue - costBasis;
    const pnlPct = costBasis > 0 ? (pnl / costBasis) * 100 : 0;
    return { ...p, currentPrice, signal, currentValue, costBasis, pnl, pnlPct };
  });

  // Portfolio totals — split by currency for accuracy
  const inrPositions = enriched.filter((p) => p.currency === 'INR');
  const usdPositions = enriched.filter((p) => p.currency === 'USD');
  const totalInrValue = inrPositions.reduce((s, p) => s + p.currentValue, 0);
  const totalUsdValue = usdPositions.reduce((s, p) => s + p.currentValue, 0);
  const totalInrPnl = inrPositions.reduce((s, p) => s + p.pnl, 0);
  const totalUsdPnl = usdPositions.reduce((s, p) => s + p.pnl, 0);
  const totalInrCost = inrPositions.reduce((s, p) => s + p.costBasis, 0);
  const totalUsdCost = usdPositions.reduce((s, p) => s + p.costBasis, 0);
  const overallPnlPct = totalInrCost + totalUsdCost > 0
    ? ((totalInrPnl + totalUsdPnl * forex) / ((totalInrCost + totalUsdCost * forex))) * 100
    : 0;

  return (
    <div className="flex-1 max-w-[1600px] w-full mx-auto px-4 py-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-lg font-semibold text-white">📈 Portfolio Simulator</h1>
          <p className="text-xs text-zinc-500 mt-0.5">{positions.length} positions · virtual P&amp;L tracking</p>
        </div>
        <button
          onClick={() => setShowAdd(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-lg transition-colors"
        >
          + Add Position
        </button>
      </div>

      {positions.length === 0 ? (
        <div className="card p-12 text-center">
          <div className="text-4xl mb-3">📊</div>
          <p className="text-zinc-400 text-sm mb-2">No positions yet</p>
          <p className="text-zinc-600 text-xs mb-4">Add virtual positions to track P&amp;L in real time</p>
          <button onClick={() => setShowAdd(true)} className="px-6 py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-sm rounded-lg transition-colors">
            Add your first position
          </button>
        </div>
      ) : (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
            {totalInrValue > 0 && (
              <>
                <div className="card p-4">
                  <div className="text-[10px] text-zinc-500 mb-1">🇮🇳 India Portfolio</div>
                  <div className="text-lg font-bold text-white">₹{totalInrValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
                  <div className={`text-xs font-medium mt-0.5 ${totalInrPnl >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                    {totalInrPnl >= 0 ? '+' : ''}₹{Math.abs(totalInrPnl).toLocaleString(undefined, { maximumFractionDigits: 0 })} P&amp;L
                  </div>
                </div>
              </>
            )}
            {totalUsdValue > 0 && (
              <div className="card p-4">
                <div className="text-[10px] text-zinc-500 mb-1">🇺🇸 US Portfolio</div>
                <div className="text-lg font-bold text-white">${totalUsdValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
                <div className={`text-xs font-medium mt-0.5 ${totalUsdPnl >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                  {totalUsdPnl >= 0 ? '+' : ''}${Math.abs(totalUsdPnl).toLocaleString(undefined, { maximumFractionDigits: 0 })} P&amp;L
                </div>
              </div>
            )}
            <div className="card p-4">
              <div className="text-[10px] text-zinc-500 mb-1">Overall Return</div>
              <div className={`text-2xl font-bold ${overallPnlPct >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                {overallPnlPct >= 0 ? '+' : ''}{overallPnlPct.toFixed(2)}%
              </div>
              <div className="text-[10px] text-zinc-600 mt-0.5">across all positions</div>
            </div>
            <div className="card p-4">
              <div className="text-[10px] text-zinc-500 mb-1">Positions</div>
              <div className="text-2xl font-bold text-white">{positions.length}</div>
              <div className="text-[10px] text-zinc-600 mt-0.5">
                {enriched.filter((p) => p.pnl >= 0).length} winning · {enriched.filter((p) => p.pnl < 0).length} losing
              </div>
            </div>
          </div>

          {/* Positions table */}
          <div className="card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    {['Stock', 'Qty', 'Avg Buy', 'Current', 'Value', 'P&L', 'P&L %', 'Signal', ''].map((h) => (
                      <th key={h} className="text-left text-[10px] text-zinc-500 font-medium px-4 py-3">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {enriched.map((p) => {
                    const sym = p.currency === 'INR' ? '₹' : '$';
                    const pos = p.pnl >= 0;
                    return (
                      <tr
                        key={p.id}
                        className="border-b border-border/50 last:border-0 hover:bg-surface-2 transition-colors cursor-pointer"
                        onClick={() => navigate(`/stock/${p.ticker}`)}
                      >
                        <td className="px-4 py-3">
                          <div className="font-semibold text-white">{p.ticker}</div>
                          <div className="text-[11px] text-zinc-500 truncate max-w-[120px]">{p.name}</div>
                        </td>
                        <td className="px-4 py-3 text-zinc-300">{p.qty.toLocaleString()}</td>
                        <td className="px-4 py-3 text-zinc-300">{sym}{p.buyPrice.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                        <td className="px-4 py-3 text-white font-medium">{sym}{p.currentPrice.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                        <td className="px-4 py-3 text-white">{formatCurrency(p.currentValue, p.currency)}</td>
                        <td className={`px-4 py-3 font-semibold ${pos ? 'text-emerald-400' : 'text-red-400'}`}>
                          {pos ? '+' : ''}{formatCurrency(p.pnl, p.currency)}
                        </td>
                        <td className={`px-4 py-3 font-bold ${pos ? 'text-emerald-400' : 'text-red-400'}`}>
                          {pos ? '+' : ''}{p.pnlPct.toFixed(2)}%
                        </td>
                        <td className="px-4 py-3">
                          <SignalBadge signal={p.signal as 'BUY' | 'HOLD' | 'SELL'} size="sm" />
                        </td>
                        <td className="px-4 py-3">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              removePosition(p.id);
                              show(`Removed ${p.ticker} from portfolio`, 'info');
                            }}
                            className="text-zinc-700 hover:text-red-400 transition-colors text-xs"
                          >
                            ✕
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {showAdd && (
        <AddPositionModal
          onAdd={(p) => { addPosition(p); show(`Added ${p.ticker} to portfolio 📈`, 'success'); }}
          onClose={() => setShowAdd(false)}
        />
      )}
    </div>
  );
}
