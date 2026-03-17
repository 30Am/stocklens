import { useState, useEffect, useRef, useCallback } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useMarket } from '../../context/MarketContext';
import { searchStocks } from '../../api/client';
import type { StockSearchResult } from '../../api/client';
import type { MarketFilter } from '../../types';

const NAV = [
  { label: 'Dashboard', to: '/' },
  { label: 'News', to: '/news' },
  { label: 'Cross-Market', to: '/cross-market' },
  { label: 'Watchlist', to: '/watchlist' },
  { label: 'Portfolio', to: '/portfolio' },
];

function SuggestionDropdown({
  suggestions,
  activeIdx,
  onSelect,
}: {
  suggestions: StockSearchResult[];
  activeIdx: number;
  onSelect: (ticker: string) => void;
}) {
  if (suggestions.length === 0) return null;
  return (
    <div className="absolute top-full left-0 mt-1 w-72 bg-surface-1 border border-border rounded-xl shadow-2xl z-[60] overflow-hidden animate-fade-in">
      {suggestions.map((s, i) => (
        <button
          key={s.ticker}
          onMouseDown={(e) => { e.preventDefault(); onSelect(s.ticker); }}
          className={`w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors ${
            i === activeIdx ? 'bg-surface-2' : 'hover:bg-surface-2'
          } ${i > 0 ? 'border-t border-border/50' : ''}`}
        >
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-xs font-bold text-white font-mono">{s.ticker}</span>
              <span className={`text-[9px] px-1.5 py-0.5 rounded font-medium border ${
                s.market === 'IN'
                  ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                  : 'bg-blue-500/10 text-blue-400 border-blue-500/20'
              }`}>
                {s.market === 'IN' ? '🇮🇳' : '🇺🇸'} {s.exchange}
              </span>
            </div>
            <div className="text-[11px] text-zinc-500 truncate mt-0.5">{s.name}</div>
          </div>
          <span className="text-zinc-600 text-xs shrink-0">↵</span>
        </button>
      ))}
      <div className="px-3 py-1.5 border-t border-border bg-surface-2/40">
        <span className="text-[10px] text-zinc-600">↑↓ navigate · Enter to open · Esc to close</span>
      </div>
    </div>
  );
}

export function Header() {
  const { market, setMarket } = useMarket();
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<StockSearchResult[]>([]);
  const [showDrop, setShowDrop] = useState(false);
  const [activeIdx, setActiveIdx] = useState(-1);
  const [menuOpen, setMenuOpen] = useState(false);
  const navigate = useNavigate();
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchWrapRef = useRef<HTMLDivElement>(null);

  // Debounced autocomplete
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const q = query.trim();
    if (q.length < 1) { setSuggestions([]); setShowDrop(false); return; }
    debounceRef.current = setTimeout(async () => {
      try {
        const data = await searchStocks(q);
        setSuggestions(data);
        setShowDrop(data.length > 0);
        setActiveIdx(-1);
      } catch {
        setSuggestions([]); setShowDrop(false);
      }
    }, 280);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query]);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (searchWrapRef.current && !searchWrapRef.current.contains(e.target as Node)) {
        setShowDrop(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const goToStock = useCallback((ticker: string) => {
    navigate(`/stock/${encodeURIComponent(ticker)}`);
    setQuery(''); setSuggestions([]); setShowDrop(false); setActiveIdx(-1);
  }, [navigate]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (activeIdx >= 0 && suggestions[activeIdx]) { goToStock(suggestions[activeIdx].ticker); return; }
    const q = query.trim().toUpperCase();
    if (q) goToStock(q);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (!showDrop || suggestions.length === 0) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); setActiveIdx((i) => Math.min(i + 1, suggestions.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActiveIdx((i) => Math.max(i - 1, -1)); }
    else if (e.key === 'Escape') { setShowDrop(false); setActiveIdx(-1); }
  }

  const marketBtns: { label: string; value: MarketFilter; flag: string }[] = [
    { label: 'India', value: 'IN', flag: '🇮🇳' },
    { label: 'USA',   value: 'US', flag: '🇺🇸' },
    { label: 'Both',  value: 'BOTH', flag: '' },
  ];

  return (
    <header className="sticky top-0 z-50 bg-surface-0 border-b border-border">
      <div className="flex items-center gap-4 px-4 h-14 max-w-[1600px] mx-auto">

        {/* Logo */}
        <NavLink to="/" className="flex items-center gap-2 shrink-0">
          <div className="w-7 h-7 bg-blue-500/15 border border-blue-500/30 rounded-lg flex items-center justify-center">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M1 10 L4 6 L7 8 L10 3 L13 5" stroke="#60a5fa" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <span className="font-semibold text-white text-sm tracking-tight hidden sm:block">StockLens</span>
        </NavLink>

        {/* Desktop nav */}
        <nav className="hidden md:flex items-center gap-1 ml-2">
          {NAV.map(({ label, to }) => (
            <NavLink key={to} to={to} end={to === '/'}
              className={({ isActive }) =>
                `px-3 py-1.5 text-sm rounded-lg transition-colors ${
                  isActive ? 'text-white bg-surface-2' : 'text-zinc-400 hover:text-white hover:bg-surface-2'
                }`}
            >{label}</NavLink>
          ))}
        </nav>

        <div className="flex-1" />

        {/* Market toggle */}
        <div className="hidden sm:flex items-center gap-1 bg-surface-2 p-1 rounded-lg border border-border">
          {marketBtns.map(({ label, value, flag }) => (
            <button key={value} onClick={() => setMarket(value)}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium transition-all duration-150 ${
                market === value
                  ? value === 'IN' ? 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
                  : value === 'US' ? 'bg-blue-500/15 text-blue-300 border border-blue-500/30'
                  : 'bg-white/10 text-white border border-white/20'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              {flag && <span>{flag}</span>}
              {label}
              {market === value && value === 'BOTH' && <span className="text-zinc-400 ml-0.5">✓</span>}
            </button>
          ))}
        </div>

        {/* Desktop search */}
        <div className="hidden sm:block relative" ref={searchWrapRef}>
          <form onSubmit={handleSubmit}>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              onFocus={() => suggestions.length > 0 && setShowDrop(true)}
              placeholder="Search ticker or company…"
              autoComplete="off"
              className="w-40 lg:w-52 focus:w-64 bg-surface-2 border border-border rounded-lg px-3 py-1.5 text-xs text-zinc-300 placeholder-zinc-600 focus:outline-none focus:border-zinc-500 transition-all duration-200"
            />
          </form>
          {showDrop && (
            <SuggestionDropdown suggestions={suggestions} activeIdx={activeIdx} onSelect={goToStock} />
          )}
        </div>

        {/* Mobile hamburger */}
        <button className="md:hidden text-zinc-400 hover:text-white p-1" onClick={() => setMenuOpen(!menuOpen)}>
          <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
            {menuOpen
              ? <path fillRule="evenodd" clipRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" />
              : <path fillRule="evenodd" clipRule="evenodd" d="M3 5a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 5a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 5a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" />
            }
          </svg>
        </button>
      </div>

      {/* Mobile menu */}
      {menuOpen && (
        <div className="md:hidden border-t border-border bg-surface-1 px-4 py-3 space-y-1 animate-fade-in">
          {NAV.map(({ label, to }) => (
            <NavLink key={to} to={to} end={to === '/'} onClick={() => setMenuOpen(false)}
              className={({ isActive }) =>
                `block px-3 py-2 rounded-lg text-sm ${isActive ? 'bg-surface-2 text-white' : 'text-zinc-400'}`}
            >{label}</NavLink>
          ))}
          <div className="flex gap-1 pt-2">
            {marketBtns.map(({ label, value, flag }) => (
              <button key={value} onClick={() => { setMarket(value); setMenuOpen(false); }}
                className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  market === value ? 'bg-surface-2 text-white' : 'text-zinc-400'
                }`}
              >{flag} {label}</button>
            ))}
          </div>
          {/* Mobile search */}
          <div className="pt-1 relative">
            <form onSubmit={(e) => { handleSubmit(e); if (!suggestions[activeIdx]) setMenuOpen(false); }}>
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={handleKeyDown}
                onFocus={() => suggestions.length > 0 && setShowDrop(true)}
                placeholder="Search ticker or company…"
                autoComplete="off"
                className="w-full bg-surface-2 border border-border rounded-lg px-3 py-2 text-sm text-zinc-300 placeholder-zinc-600 focus:outline-none focus:border-zinc-500"
              />
            </form>
            {showDrop && (
              <SuggestionDropdown suggestions={suggestions} activeIdx={activeIdx} onSelect={(t) => { goToStock(t); setMenuOpen(false); }} />
            )}
          </div>
        </div>
      )}
    </header>
  );
}
