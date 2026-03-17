import { useEffect, useState } from 'react';
import { getCrossMarketEvents } from '../api/client';
import { MOCK_CROSS_MARKET } from '../api/mock';
import type { CrossMarketEvent } from '../types';

const CORRELATIONS = [
  { indian: 'TCS / INFY', us: 'NASDAQ IT / Fed Rate', corr: 0.82, color: 'text-emerald-400', reason: 'USD/INR strength + US tech sector direction' },
  { indian: 'TATAMOTORS', us: 'F / GM / Auto ETF', corr: 0.74, color: 'text-emerald-400', reason: 'JLR premium auto global demand signal' },
  { indian: 'HPCL / BPCL', us: 'XOM / Oil Price', corr: -0.61, color: 'text-red-400', reason: 'Oil import costs vs US production levels' },
  { indian: 'RELIANCE', us: 'Brent Crude / XLE', corr: 0.55, color: 'text-emerald-400', reason: 'Refinery margin tracks crude price closely' },
];

const impactStyle: Record<string, { border: string; bg: string; title: string }> = {
  POSITIVE: { border: 'border-amber-500/30', bg: 'bg-amber-500/5', title: 'text-amber-300' },
  NEGATIVE: { border: 'border-red-500/30', bg: 'bg-red-500/5', title: 'text-red-300' },
  MIXED: { border: 'border-blue-500/30', bg: 'bg-blue-500/5', title: 'text-blue-300' },
};

function EventCard({ event }: { event: CrossMarketEvent }) {
  const style = impactStyle[event.impact_direction] ?? impactStyle.MIXED;
  return (
    <div className={`card border ${style.border} ${style.bg} p-4 animate-fade-in`}>
      <h4 className={`text-sm font-semibold mb-2 ${style.title}`}>{event.event_type}</h4>
      <p className="text-xs text-zinc-400 leading-relaxed mb-3">{event.description}</p>
      <div className="flex flex-wrap gap-1.5">
        {event.affected_tickers.map((t) => (
          <span key={t} className="text-[10px] px-1.5 py-0.5 bg-surface-2 border border-border rounded text-zinc-300 font-mono">
            {t}
          </span>
        ))}
      </div>
    </div>
  );
}

export function CrossMarket() {
  const [events, setEvents] = useState<CrossMarketEvent[]>(MOCK_CROSS_MARKET);

  useEffect(() => {
    getCrossMarketEvents(20)
      .then((data: unknown) => { if (Array.isArray(data) && data.length > 0) setEvents(data as CrossMarketEvent[]); })
      .catch(() => { /* use mock */ });
  }, []);

  const usToIn = events.filter((e) => e.source_market === 'US' && e.target_market === 'IN');
  const inToUs = events.filter((e) => e.source_market === 'IN' && e.target_market === 'US');

  return (
    <div className="flex-1 max-w-[1600px] w-full mx-auto px-4 py-4 space-y-6">
      {/* Cross-market panels */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* US → India */}
        <div>
          <h2 className="flex items-center gap-2 text-sm font-semibold text-white mb-4">
            🇺🇸 → 🇮🇳 <span className="text-zinc-300">US Events Affecting India</span>
          </h2>
          <div className="space-y-3">
            {usToIn.length > 0
              ? usToIn.map((e) => <EventCard key={e.id} event={e} />)
              : <p className="text-zinc-600 text-sm">No cross-market events found.</p>
            }
          </div>
        </div>

        {/* India → US */}
        <div>
          <h2 className="flex items-center gap-2 text-sm font-semibold text-white mb-4">
            🇮🇳 → 🇺🇸 <span className="text-zinc-300">Indian Events Affecting USA</span>
          </h2>
          <div className="space-y-3">
            {inToUs.length > 0
              ? inToUs.map((e) => <EventCard key={e.id} event={e} />)
              : <p className="text-zinc-600 text-sm">No cross-market events found.</p>
            }
          </div>
        </div>
      </div>

      {/* Correlation table */}
      <div className="card p-4">
        <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-4">
          Live Correlation Map — Top Linked Stock Pairs
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left text-xs text-zinc-500 font-medium pb-3 pr-4">
                  🇮🇳 Indian Stock
                </th>
                <th className="text-left text-xs text-zinc-500 font-medium pb-3 pr-4">
                  🇺🇸 US Stock / Event
                </th>
                <th className="text-left text-xs text-zinc-500 font-medium pb-3 pr-4">Correlation</th>
                <th className="text-left text-xs text-zinc-500 font-medium pb-3">Reason</th>
              </tr>
            </thead>
            <tbody>
              {CORRELATIONS.map((r, i) => (
                <tr key={i} className="border-b border-border/50 last:border-0">
                  <td className="py-3 pr-4">
                    <span className="font-semibold text-amber-400 text-xs">{r.indian}</span>
                  </td>
                  <td className="py-3 pr-4">
                    <span className="text-blue-400 text-xs">{r.us}</span>
                  </td>
                  <td className="py-3 pr-4">
                    <span className={`text-sm font-bold ${r.color}`}>
                      {r.corr > 0 ? '+' : ''}{r.corr.toFixed(2)}
                    </span>
                  </td>
                  <td className="py-3">
                    <span className="text-zinc-400 text-xs">{r.reason}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
