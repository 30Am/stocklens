import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import type { ReactNode } from 'react';

export interface WatchlistItem {
  ticker: string;
  name: string;
  currency: 'INR' | 'USD';
  alertAbove?: number;
  alertBelow?: number;
}

interface WatchlistContextValue {
  items: WatchlistItem[];
  isWatched: (ticker: string) => boolean;
  add: (item: WatchlistItem) => void;
  remove: (ticker: string) => void;
  setAlert: (ticker: string, above?: number, below?: number) => void;
}

const WatchlistContext = createContext<WatchlistContextValue>({
  items: [],
  isWatched: () => false,
  add: () => undefined,
  remove: () => undefined,
  setAlert: () => undefined,
});

const STORAGE_KEY = 'stocklens_watchlist';

function load(): WatchlistItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as WatchlistItem[]) : [];
  } catch {
    return [];
  }
}

function save(items: WatchlistItem[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
}

export function WatchlistProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<WatchlistItem[]>(load);

  useEffect(() => { save(items); }, [items]);

  const isWatched = useCallback((ticker: string) => items.some((i) => i.ticker === ticker), [items]);

  const add = useCallback((item: WatchlistItem) => {
    setItems((prev) => prev.some((i) => i.ticker === item.ticker) ? prev : [...prev, item]);
  }, []);

  const remove = useCallback((ticker: string) => {
    setItems((prev) => prev.filter((i) => i.ticker !== ticker));
  }, []);

  const setAlert = useCallback((ticker: string, above?: number, below?: number) => {
    setItems((prev) =>
      prev.map((i) => i.ticker === ticker ? { ...i, alertAbove: above, alertBelow: below } : i),
    );
  }, []);

  return (
    <WatchlistContext.Provider value={{ items, isWatched, add, remove, setAlert }}>
      {children}
    </WatchlistContext.Provider>
  );
}

export const useWatchlist = () => useContext(WatchlistContext);
