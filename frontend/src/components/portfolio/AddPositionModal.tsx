import { useState } from 'react';
import { MOCK_STOCKS } from '../../api/mock';
import type { Position } from '../../context/PortfolioContext';

interface Props {
  onAdd: (p: Omit<Position, 'id' | 'addedAt'>) => void;
  onClose: () => void;
}

export function AddPositionModal({ onAdd, onClose }: Props) {
  const [tickerQuery, setTickerQuery] = useState('');
  const [selected, setSelected] = useState<typeof MOCK_STOCKS[0] | null>(null);
  const [qty, setQty] = useState('');
  const [buyPrice, setBuyPrice] = useState('');

  const suggestions = tickerQuery.length >= 1
    ? MOCK_STOCKS.filter(
        (s) =>
          s.ticker.toLowerCase().includes(tickerQuery.toLowerCase()) ||
          s.name.toLowerCase().includes(tickerQuery.toLowerCase()),
      ).slice(0, 5)
    : [];

  function selectStock(s: typeof MOCK_STOCKS[0]) {
    setSelected(s);
    setTickerQuery(s.ticker);
    setBuyPrice(s.close?.toFixed(2) ?? '');
  }

  function handleAdd() {
    if (!selected || !qty || !buyPrice) return;
    onAdd({
      ticker: selected.ticker,
      name: selected.name,
      currency: selected.currency,
      qty: parseFloat(qty),
      buyPrice: parseFloat(buyPrice),
    });
    onClose();
  }

  const sym = selected?.currency === 'INR' ? '₹' : '$';
  const canAdd = selected && parseFloat(qty) > 0 && parseFloat(buyPrice) > 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div
        className="relative card border-zinc-700 p-6 w-full max-w-sm animate-slide-up"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-base font-semibold text-white mb-4">Add Position</h3>

        {/* Ticker search */}
        <div className="mb-3 relative">
          <label className="text-xs text-zinc-400 mb-1 block">Stock / Ticker</label>
          <input
            autoFocus
            value={tickerQuery}
            onChange={(e) => { setTickerQuery(e.target.value); setSelected(null); }}
            placeholder="Search e.g. RELIANCE or NVDA..."
            className="w-full bg-surface-2 border border-border rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-zinc-600"
          />
          {suggestions.length > 0 && !selected && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-surface-2 border border-border rounded-xl overflow-hidden z-10 shadow-xl">
              {suggestions.map((s) => (
                <button
                  key={s.ticker}
                  onClick={() => selectStock(s)}
                  className="w-full flex items-center gap-3 px-3 py-2 hover:bg-surface-3 transition-colors text-left"
                >
                  <div>
                    <div className="text-sm font-semibold text-white">{s.ticker}</div>
                    <div className="text-[11px] text-zinc-500">{s.name}</div>
                  </div>
                  <div className="ml-auto text-xs text-zinc-400">
                    {s.currency === 'INR' ? '₹' : '$'}{s.close?.toLocaleString()}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Qty + Buy price */}
        <div className="grid grid-cols-2 gap-3 mb-5">
          <div>
            <label className="text-xs text-zinc-400 mb-1 block">Quantity (shares)</label>
            <input
              type="number"
              value={qty}
              onChange={(e) => setQty(e.target.value)}
              placeholder="10"
              min="0.001"
              step="0.001"
              className="w-full bg-surface-2 border border-border rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-zinc-600"
            />
          </div>
          <div>
            <label className="text-xs text-zinc-400 mb-1 block">Buy price ({sym})</label>
            <input
              type="number"
              value={buyPrice}
              onChange={(e) => setBuyPrice(e.target.value)}
              placeholder="0.00"
              min="0"
              step="0.01"
              className="w-full bg-surface-2 border border-border rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-zinc-600"
            />
          </div>
        </div>

        {/* Preview */}
        {canAdd && (
          <div className="bg-surface-2 rounded-lg px-3 py-2 mb-4 text-xs text-zinc-400">
            Cost basis: <span className="text-white font-semibold">{sym}{(parseFloat(qty) * parseFloat(buyPrice)).toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
          </div>
        )}

        <div className="flex gap-2">
          <button onClick={onClose} className="flex-1 py-2 rounded-lg border border-border text-zinc-400 text-sm hover:text-white transition-colors">
            Cancel
          </button>
          <button
            onClick={handleAdd}
            disabled={!canAdd}
            className="flex-1 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-medium transition-colors"
          >
            Add Position
          </button>
        </div>
      </div>
    </div>
  );
}
