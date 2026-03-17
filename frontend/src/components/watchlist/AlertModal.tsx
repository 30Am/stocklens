import { useState } from 'react';
import type { WatchlistItem } from '../../context/WatchlistContext';

interface Props {
  item: WatchlistItem;
  currentPrice: number | null;
  onSave: (above?: number, below?: number) => void;
  onClose: () => void;
}

export function AlertModal({ item, currentPrice, onSave, onClose }: Props) {
  const [above, setAbove] = useState(item.alertAbove?.toString() ?? '');
  const [below, setBelow] = useState(item.alertBelow?.toString() ?? '');
  const sym = item.currency === 'INR' ? '₹' : '$';

  function handleSave() {
    const a = above.trim() ? parseFloat(above) : undefined;
    const b = below.trim() ? parseFloat(below) : undefined;
    onSave(a, b);
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div
        className="relative card border-zinc-700 p-6 w-full max-w-sm animate-slide-up"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-base font-semibold text-white mb-1">Set Price Alert</h3>
        <p className="text-xs text-zinc-500 mb-4">
          {item.ticker} · {currentPrice != null ? `Current: ${sym}${currentPrice.toLocaleString()}` : ''}
        </p>

        <div className="space-y-3">
          <div>
            <label className="text-xs text-zinc-400 mb-1 block">Alert when price goes <span className="text-emerald-400">above</span></label>
            <div className="flex items-center bg-surface-2 border border-border rounded-lg overflow-hidden">
              <span className="px-3 text-zinc-500 text-sm">{sym}</span>
              <input
                type="number"
                value={above}
                onChange={(e) => setAbove(e.target.value)}
                placeholder="e.g. 3000"
                className="flex-1 bg-transparent py-2 pr-3 text-sm text-white focus:outline-none placeholder-zinc-600"
              />
            </div>
          </div>

          <div>
            <label className="text-xs text-zinc-400 mb-1 block">Alert when price goes <span className="text-red-400">below</span></label>
            <div className="flex items-center bg-surface-2 border border-border rounded-lg overflow-hidden">
              <span className="px-3 text-zinc-500 text-sm">{sym}</span>
              <input
                type="number"
                value={below}
                onChange={(e) => setBelow(e.target.value)}
                placeholder="e.g. 2500"
                className="flex-1 bg-transparent py-2 pr-3 text-sm text-white focus:outline-none placeholder-zinc-600"
              />
            </div>
          </div>
        </div>

        <div className="flex gap-2 mt-5">
          <button
            onClick={onClose}
            className="flex-1 py-2 rounded-lg border border-border text-zinc-400 text-sm hover:text-white hover:border-zinc-600 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="flex-1 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium transition-colors"
          >
            Save Alert
          </button>
        </div>

        {(item.alertAbove || item.alertBelow) && (
          <button
            onClick={() => { onSave(undefined, undefined); onClose(); }}
            className="w-full mt-2 py-1.5 text-xs text-zinc-600 hover:text-red-400 transition-colors"
          >
            Clear alerts
          </button>
        )}
      </div>
    </div>
  );
}
