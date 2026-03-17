import { useNavigate } from 'react-router-dom';
import type { CrossMarketEvent } from '../../types';

const impactColor: Record<string, string> = {
  POSITIVE: 'border-amber-500/40 bg-amber-500/5 text-amber-300',
  NEGATIVE: 'border-red-500/40 bg-red-500/5 text-red-300',
  MIXED: 'border-blue-500/40 bg-blue-500/5 text-blue-300',
};

export function CrossMarketPanel({ events }: { events: CrossMarketEvent[] }) {
  const navigate = useNavigate();
  const latest = events.slice(0, 1)[0];

  if (!latest) return null;

  const colorCls = impactColor[latest.impact_direction] ?? impactColor.MIXED;

  return (
    <div className="card p-4">
      <div className="flex items-center gap-1.5 mb-3">
        <span className="text-amber-400 text-sm">⚡</span>
        <h3 className="text-xs font-semibold text-zinc-300 uppercase tracking-wider">Cross-Market</h3>
      </div>
      <div
        className={`border rounded-lg p-3 cursor-pointer transition-opacity hover:opacity-80 ${colorCls}`}
        onClick={() => navigate('/cross-market')}
      >
        <div className="text-[11px] font-semibold mb-1.5 leading-snug">{latest.event_type}</div>
        <p className="text-[10px] text-zinc-400 leading-relaxed line-clamp-2">{latest.description}</p>
        <div className="flex flex-wrap gap-1 mt-2">
          {latest.affected_tickers.slice(0, 4).map((t) => (
            <span key={t} className="text-[9px] px-1.5 py-0.5 bg-surface-2 border border-border rounded text-zinc-300 font-mono">
              {t}
            </span>
          ))}
        </div>
      </div>
      {events.length > 1 && (
        <button
          className="mt-2 w-full text-[10px] text-zinc-500 hover:text-zinc-300 transition-colors py-1"
          onClick={() => navigate('/cross-market')}
        >
          +{events.length - 1} more events →
        </button>
      )}
    </div>
  );
}
