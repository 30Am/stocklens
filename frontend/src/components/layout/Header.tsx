import { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useMarket } from '../../context/MarketContext';
import type { MarketFilter } from '../../types';

const NAV = [
  { label: 'Dashboard', to: '/' },
  { label: 'News', to: '/news' },
  { label: 'Cross-Market', to: '/cross-market' },
  { label: 'Watchlist', to: '/watchlist' },
  { label: 'Portfolio', to: '/portfolio' },
];

export function Header() {
  const { market, setMarket } = useMarket();
  const [query, setQuery] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);
  const navigate = useNavigate();

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    const q = query.trim().toUpperCase();
    if (q) {
      navigate(`/stock/${q}`);
      setQuery('');
    }
  }

  const marketBtns: { label: string; value: MarketFilter; flag: string }[] = [
    { label: 'India', value: 'IN', flag: '🇮🇳' },
    { label: 'USA', value: 'US', flag: '🇺🇸' },
    { label: 'Both', value: 'BOTH', flag: '' },
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
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                `relative px-3 py-1.5 text-sm rounded-lg transition-colors ${
                  isActive
                    ? 'text-white bg-surface-2'
                    : 'text-zinc-400 hover:text-white hover:bg-surface-2'
                }`
              }
            >
              {label}
            </NavLink>
          ))}
        </nav>

        <div className="flex-1" />

        {/* Market toggle */}
        <div className="hidden sm:flex items-center gap-1 bg-surface-2 p-1 rounded-lg border border-border">
          {marketBtns.map(({ label, value, flag }) => (
            <button
              key={value}
              onClick={() => setMarket(value)}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium transition-all duration-150 ${
                market === value
                  ? value === 'IN'
                    ? 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
                    : value === 'US'
                    ? 'bg-blue-500/15 text-blue-300 border border-blue-500/30'
                    : 'bg-white/10 text-white border border-white/20'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              {flag && <span>{flag}</span>}
              {label}
              {market === value && value === 'BOTH' && <span className="text-zinc-400">✓</span>}
            </button>
          ))}
        </div>

        {/* Search */}
        <form onSubmit={handleSearch} className="hidden sm:flex">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search ticker..."
            className="w-36 lg:w-44 bg-surface-2 border border-border rounded-lg px-3 py-1.5 text-xs text-zinc-300 placeholder-zinc-600 focus:outline-none focus:border-zinc-600 focus:w-48 transition-all duration-200"
          />
        </form>

        {/* Mobile hamburger */}
        <button
          className="md:hidden text-zinc-400 hover:text-white p-1"
          onClick={() => setMenuOpen(!menuOpen)}
        >
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
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              onClick={() => setMenuOpen(false)}
              className={({ isActive }) =>
                `block px-3 py-2 rounded-lg text-sm ${isActive ? 'bg-surface-2 text-white' : 'text-zinc-400'}`
              }
            >
              {label}
            </NavLink>
          ))}
          <div className="flex gap-1 pt-2">
            {marketBtns.map(({ label, value, flag }) => (
              <button
                key={value}
                onClick={() => { setMarket(value); setMenuOpen(false); }}
                className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  market === value ? 'bg-surface-2 text-white' : 'text-zinc-400'
                }`}
              >
                {flag} {label}
              </button>
            ))}
          </div>
          <form onSubmit={(e) => { handleSearch(e); setMenuOpen(false); }} className="pt-1">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search ticker..."
              className="w-full bg-surface-2 border border-border rounded-lg px-3 py-2 text-sm text-zinc-300 placeholder-zinc-600 focus:outline-none"
            />
          </form>
        </div>
      )}
    </header>
  );
}
