import { useEffect, useState, useCallback } from 'react';
import { IndexBar } from '../components/dashboard/IndexBar';
import { StockCard, StockCardSkeleton } from '../components/dashboard/StockCard';
import { TopMovers } from '../components/dashboard/TopMovers';
import { SectorHeatmap } from '../components/dashboard/SectorHeatmap';
import { CrossMarketPanel } from '../components/dashboard/CrossMarketPanel';
import { useMarket } from '../context/MarketContext';
import { useWebSocket } from '../hooks/useWebSocket';
import { getTrending, getCrossMarketEvents, getForex } from '../api/client';
import { MOCK_STOCKS, MOCK_CROSS_MARKET } from '../api/mock';
import type { StockSummary, CrossMarketEvent } from '../types';

export function Dashboard() {
  const { market, forex, setForex } = useMarket();
  const [stocks, setStocks] = useState<StockSummary[]>(MOCK_STOCKS);
  const [crossEvents, setCrossEvents] = useState<CrossMarketEvent[]>(MOCK_CROSS_MARKET);
  const [loading, setLoading] = useState(false);

  // Load trending signals from API
  useEffect(() => {
    setLoading(true);
    const apiMarket = market === 'BOTH' ? undefined : market;
    getTrending(apiMarket, 12)
      .then((data: unknown) => {
        if (Array.isArray(data) && data.length > 0) {
          setStocks(data as StockSummary[]);
        }
      })
      .catch((e) => { console.error('[Dashboard] getTrending failed:', e); })
      .finally(() => setLoading(false));
  }, [market]);

  useEffect(() => {
    getCrossMarketEvents(10)
      .then((data: unknown) => { if (Array.isArray(data) && data.length > 0) setCrossEvents(data as CrossMarketEvent[]); })
      .catch((e) => { console.error('[Dashboard] getCrossMarketEvents failed:', e); });
  }, []);

  useEffect(() => {
    getForex()
      .then((data: unknown) => {
        const d = data as { rate?: number; change_pct?: number | null };
        if (d && typeof d.rate === 'number') setForex(d.rate, d.change_pct ?? null);
      })
      .catch(() => { /* keep default */ });
  }, [setForex]);

  // Live price updates via WebSocket
  const handlePriceUpdate = useCallback((data: unknown) => {
    if (!Array.isArray(data)) return;
    const updates = data as Array<{ ticker: string; close: number; change_pct?: number; signal?: string }>;
    setStocks((prev) =>
      prev.map((s) => {
        const u = updates.find((u) => u.ticker === s.ticker);
        if (!u) return s;
        return { ...s, close: u.close, change_pct: u.change_pct ?? s.change_pct };
      }),
    );
  }, []);

  useWebSocket('/ws/prices', handlePriceUpdate);

  const filtered = market === 'BOTH' ? stocks : stocks.filter((s) => s.market === market);

  return (
    <div className="flex-1 flex flex-col">
      <IndexBar forex={forex} />

      <div className="flex-1 max-w-[1600px] w-full mx-auto px-4 py-4 flex flex-col gap-4">
        {/* Main layout: cards + sidebar */}
        <div className="flex gap-4">
          {/* Stock grid */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-zinc-300">
                AI Signals Today
                <span className="ml-2 text-zinc-600 text-xs font-normal">
                  {filtered.length} stocks
                </span>
              </h2>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
              {loading
                ? Array.from({ length: 6 }).map((_, i) => <StockCardSkeleton key={i} />)
                : filtered.map((s) => <StockCard key={s.ticker} stock={s} />)
              }
            </div>
          </div>

          {/* Sidebar */}
          <aside className="hidden lg:flex flex-col gap-4 w-64 xl:w-72 shrink-0">
            <TopMovers stocks={filtered} />
            <CrossMarketPanel events={crossEvents} />
          </aside>
        </div>

        {/* Mobile: TopMovers + CrossMarket below cards */}
        <div className="lg:hidden space-y-4">
          <TopMovers stocks={filtered} />
          <CrossMarketPanel events={crossEvents} />
        </div>

        {/* Heatmap */}
        <SectorHeatmap />
      </div>
    </div>
  );
}
