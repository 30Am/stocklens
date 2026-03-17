import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { SignalBadge } from '../components/common/SignalBadge';
import { CandlestickChart } from '../components/stock/CandlestickChart';
import { AIExplanation } from '../components/stock/AIExplanation';
import { RelatedNews } from '../components/stock/RelatedNews';
import { getStockDetail } from '../api/client';
import { mockStockDetail, MOCK_STOCKS } from '../api/mock';
import { useWatchlist } from '../context/WatchlistContext';
import { useToast } from '../components/common/ToastProvider';
import type { StockDetail as StockDetailType, PriceCandle } from '../types';

const PERIODS = ['1D', '1W', '1M', '3M', '1Y'] as const;
type Period = (typeof PERIODS)[number];


function fmt(v: number | null, currency: 'INR' | 'USD') {
  if (v == null) return '—';
  const sym = currency === 'INR' ? '₹' : '$';
  return `${sym}${v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function fmtBig(v: number | null, currency: 'INR' | 'USD') {
  if (v == null) return '—';
  const sym = currency === 'INR' ? '₹' : '$';
  if (v >= 1e12) return `${sym}${(v / 1e12).toFixed(1)}T`;
  if (v >= 1e9) return `${sym}${(v / 1e9).toFixed(1)}B`;
  if (v >= 1e7) return `${sym}${(v / 1e7).toFixed(1)} Cr`;
  return `${sym}${v.toLocaleString()}`;
}

function fmtVol(v: number | null) {
  if (v == null) return '—';
  if (v >= 1e7) return `${(v / 1e7).toFixed(1)}Cr`;
  if (v >= 1e6) return `${(v / 1e6).toFixed(1)}M`;
  if (v >= 1e3) return `${(v / 1e3).toFixed(1)}K`;
  return v.toString();
}

export function StockDetail() {
  const { ticker } = useParams<{ ticker: string }>();
  const navigate = useNavigate();
  const { isWatched, add, remove: removeFromWatchlist } = useWatchlist();
  const { show } = useToast();
  const [stock, setStock] = useState<StockDetailType | null>(null);
  const [period, setPeriod] = useState<Period>('1W');
  const [showMA20, setShowMA20] = useState(false);
  const [showMA50, setShowMA50] = useState(false);
  const [chartData, setChartData] = useState<PriceCandle[]>([]);

  useEffect(() => {
    if (!ticker) return;
    getStockDetail(ticker)
      .then((data: unknown) => {
        const d = data as StockDetailType;
        // Only use API data if it has price history; otherwise enrich with mock chart data
        const history = d.price_history ?? [];
        // Require both a valid close price AND price history to use API data
        const hasValidData = history.length > 0 && d.close != null && d.close > 0;
        if (hasValidData) {
          setStock(d);
          setChartData(history);
        } else {
          const mock = mockStockDetail(ticker);
          // Prefer live values from API where available, but use mock chart + stats
          const merged: StockDetailType = {
            ...mock,
            close: d.close ?? mock.close,
            change_pct: d.change_pct ?? mock.change_pct,
            signal: d.signal ?? mock.signal,
            score: d.score ?? mock.score,
            reason: d.reason ?? mock.reason,
          };
          setStock(merged);
          setChartData(mock.price_history);
        }
      })
      .catch(() => {
        const mock = mockStockDetail(ticker);
        setStock(mock);
        setChartData(mock.price_history);
      });
  }, [ticker]);

  // Period change: re-fetch or slice mock data
  useEffect(() => {
    if (!stock) return;
    const days = period === '1D' ? 1 : period === '1W' ? 5 : period === '1M' ? 21 : period === '3M' ? 63 : 252;
    setChartData((stock.price_history ?? []).slice(-days));
  }, [period, stock]);

  if (!stock) {
    return (
      <div className="flex-1 max-w-[1600px] mx-auto px-4 py-6 space-y-4">
        <div className="skeleton h-8 w-48 rounded" />
        <div className="skeleton h-40 rounded-xl" />
        <div className="skeleton h-72 rounded-xl" />
      </div>
    );
  }

  const pos = (stock.change_pct ?? 0) >= 0;
  const exchange = stock.ticker.endsWith('.NS') ? 'NSE' : stock.ticker.endsWith('.BO') ? 'BSE' : stock.exchange;

  const stats = [
    { label: 'Price', value: fmt(stock.close, stock.currency) },
    { label: 'Change 1D', value: `${pos ? '+' : ''}${(stock.change_pct ?? 0).toFixed(2)}%`, color: pos ? 'text-emerald-400' : 'text-red-400' },
    { label: '52W High', value: fmt(stock.week52_high, stock.currency) },
    { label: '52W Low', value: fmt(stock.week52_low, stock.currency) },
    { label: 'Volume', value: fmtVol(stock.volume) },
    { label: 'Mkt Cap', value: fmtBig(stock.market_cap, stock.currency) },
    { label: 'P/E', value: stock.pe_ratio != null ? stock.pe_ratio.toFixed(1) + 'x' : '—' },
    { label: 'AI Score', value: stock.score != null ? `${(Math.abs(stock.score) * 10).toFixed(1)} / 10` : '—', color: 'text-violet-400' },
  ];

  // Similar stocks
  const similar = MOCK_STOCKS.filter((s) => s.market === stock.market && s.ticker !== stock.ticker && s.sector === stock.sector).slice(0, 3);

  return (
    <div className="flex-1 max-w-[1600px] w-full mx-auto px-4 py-4">
      <div className="flex gap-4">
        {/* Main */}
        <div className="flex-1 min-w-0 space-y-4">
          {/* Back */}
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-1 text-zinc-500 hover:text-zinc-300 text-sm transition-colors"
          >
            ← Back to Dashboard
          </button>

          {/* Header */}
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-bold text-white">{stock.ticker}</h1>
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium border ${
              stock.market === 'IN' ? 'text-amber-400 border-amber-500/30 bg-amber-500/10' : 'text-blue-400 border-blue-500/30 bg-blue-500/10'
            }`}>
              {exchange}
            </span>
            <SignalBadge signal={stock.signal} size="lg" />
            <p className="w-full text-zinc-400 text-sm">{stock.name}</p>
          </div>

          {/* Stats row */}
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2">
            {stats.map(({ label, value, color }) => (
              <div key={label} className="card px-3 py-2.5">
                <div className="text-[10px] text-zinc-500 mb-1">{label}</div>
                <div className={`text-sm font-semibold ${color ?? 'text-white'}`}>{value}</div>
              </div>
            ))}
          </div>

          {/* Period + MA controls */}
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center bg-surface-2 rounded-lg p-0.5 border border-border">
              {PERIODS.map((p) => (
                <button
                  key={p}
                  onClick={() => setPeriod(p)}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                    period === p ? 'bg-surface-1 text-white border border-border' : 'text-zinc-500 hover:text-zinc-300'
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>
            <button
              onClick={() => setShowMA20(!showMA20)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                showMA20 ? 'text-amber-400 border-amber-500/30 bg-amber-500/10' : 'text-zinc-500 border-border hover:text-zinc-300'
              }`}
            >
              MA 20
            </button>
            <button
              onClick={() => setShowMA50(!showMA50)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                showMA50 ? 'text-violet-400 border-violet-500/30 bg-violet-500/10' : 'text-zinc-500 border-border hover:text-zinc-300'
              }`}
            >
              MA 50
            </button>
          </div>

          {/* Candlestick chart */}
          {chartData.length > 0 && (
            <CandlestickChart
              data={chartData}
              showMA20={showMA20}
              showMA50={showMA50}
              currency={stock.currency}
            />
          )}

          {/* AI Explanation */}
          <AIExplanation ticker={stock.ticker} reason={stock.reason} />

          {/* Related News */}
          <RelatedNews articles={stock.related_news} />
        </div>

        {/* Sidebar */}
        <aside className="hidden lg:flex flex-col gap-4 w-56 xl:w-64 shrink-0">
          {/* Watchlist */}
          <div className="card p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">★ Watchlist</h3>
            </div>
            {MOCK_STOCKS.slice(0, 3).map((s) => (
              <div key={s.ticker} className="flex items-center gap-2 py-2 border-b border-border last:border-0">
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-semibold text-white truncate">{s.ticker.replace('.NS', '').replace('.BO', '')}</div>
                  <div className="text-[11px] text-zinc-500">
                    {s.currency === 'INR' ? '₹' : '$'}{s.close?.toLocaleString()}
                  </div>
                </div>
                <SignalBadge signal={s.signal} size="sm" />
              </div>
            ))}
            <button
              onClick={() => {
                if (!stock) return;
                if (isWatched(stock.ticker)) {
                  removeFromWatchlist(stock.ticker);
                  show(`Removed ${stock.ticker} from watchlist`, 'info');
                } else {
                  add({ ticker: stock.ticker, name: stock.name, currency: stock.currency });
                  show(`Added ${stock.ticker} to watchlist ★`, 'success');
                }
              }}
              className={`mt-3 w-full py-2 rounded-lg text-xs font-medium border transition-all ${
                isWatched(stock.ticker)
                  ? 'border-amber-500/30 bg-amber-500/10 text-amber-400'
                  : 'border-border text-zinc-400 hover:border-zinc-600 hover:text-white'
              }`}
            >
              {isWatched(stock.ticker) ? '★ In Watchlist' : '☆ Add to Watchlist'}
            </button>
          </div>

          {/* Similar stocks */}
          {similar.length > 0 && (
            <div className="card p-4">
              <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-3">Similar Stocks</h3>
              <div className="space-y-2">
                {similar.map((s) => (
                  <button
                    key={s.ticker}
                    className="w-full flex items-center gap-2 hover:bg-surface-2 rounded-lg p-1.5 -mx-1.5 transition-colors"
                    onClick={() => navigate(`/stock/${s.ticker}`)}
                  >
                    <div className="flex-1 text-left min-w-0">
                      <div className="text-xs font-semibold text-white">{s.ticker.replace('.NS', '').replace('.BO', '')}</div>
                      <div className="text-[11px] text-zinc-500">{s.currency === 'INR' ? '₹' : '$'}{s.close?.toLocaleString()}</div>
                    </div>
                    <SignalBadge signal={s.signal} size="sm" />
                  </button>
                ))}
              </div>
            </div>
          )}
        </aside>
      </div>

      {/* Mobile sidebar below */}
      <div className="lg:hidden mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="card p-4">
          <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-3">Period</h3>
          <div className="flex gap-2">
            {PERIODS.map((p) => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={`flex-1 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                  period === p ? 'border-zinc-500 text-white' : 'border-border text-zinc-500'
                }`}
              >
                {p}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

