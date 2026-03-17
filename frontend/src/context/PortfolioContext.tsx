import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import type { ReactNode } from 'react';

export interface Position {
  id: string;
  ticker: string;
  name: string;
  currency: 'INR' | 'USD';
  qty: number;
  buyPrice: number;
  addedAt: string;
}

interface PortfolioContextValue {
  positions: Position[];
  addPosition: (p: Omit<Position, 'id' | 'addedAt'>) => void;
  removePosition: (id: string) => void;
  updatePosition: (id: string, qty: number, buyPrice: number) => void;
}

const PortfolioContext = createContext<PortfolioContextValue>({
  positions: [],
  addPosition: () => undefined,
  removePosition: () => undefined,
  updatePosition: () => undefined,
});

const STORAGE_KEY = 'stocklens_portfolio';

function load(): Position[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Position[]) : [];
  } catch {
    return [];
  }
}

export function PortfolioProvider({ children }: { children: ReactNode }) {
  const [positions, setPositions] = useState<Position[]>(load);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(positions));
  }, [positions]);

  const addPosition = useCallback((p: Omit<Position, 'id' | 'addedAt'>) => {
    const id = `${p.ticker}-${Date.now()}`;
    setPositions((prev) => [...prev, { ...p, id, addedAt: new Date().toISOString() }]);
  }, []);

  const removePosition = useCallback((id: string) => {
    setPositions((prev) => prev.filter((p) => p.id !== id));
  }, []);

  const updatePosition = useCallback((id: string, qty: number, buyPrice: number) => {
    setPositions((prev) => prev.map((p) => p.id === id ? { ...p, qty, buyPrice } : p));
  }, []);

  return (
    <PortfolioContext.Provider value={{ positions, addPosition, removePosition, updatePosition }}>
      {children}
    </PortfolioContext.Provider>
  );
}

export const usePortfolio = () => useContext(PortfolioContext);
