import { createContext, useContext, useState } from 'react';
import type { ReactNode } from 'react';
import type { MarketFilter } from '../types';

interface MarketContextValue {
  market: MarketFilter;
  setMarket: (m: MarketFilter) => void;
  forex: number;
  forexChangePct: number | null;
  setForex: (r: number, changePct?: number | null) => void;
  nseOpen: boolean;
  nyseOpen: boolean;
}

const MarketContext = createContext<MarketContextValue>({
  market: 'BOTH',
  setMarket: () => undefined,
  forex: 86.0,
  forexChangePct: null,
  setForex: () => undefined,
  nseOpen: false,
  nyseOpen: false,
});

function isNSEOpen(): boolean {
  const now = new Date();
  const ist = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
  const h = ist.getHours();
  const m = ist.getMinutes();
  const mins = h * 60 + m;
  const day = ist.getDay();
  return day >= 1 && day <= 5 && mins >= 555 && mins < 930; // 9:15–15:30 IST
}

function isNYSEOpen(): boolean {
  const now = new Date();
  const est = new Date(now.toLocaleString('en-US', { timeZone: 'America/New_York' }));
  const h = est.getHours();
  const m = est.getMinutes();
  const mins = h * 60 + m;
  const day = est.getDay();
  return day >= 1 && day <= 5 && mins >= 570 && mins < 960; // 9:30–16:00 EST
}

export function MarketProvider({ children }: { children: ReactNode }) {
  const [market, setMarket] = useState<MarketFilter>('BOTH');
  const [forex, setForexRate] = useState(86.0);
  const [forexChangePct, setForexChangePct] = useState<number | null>(null);

  const setForex = (r: number, changePct?: number | null) => {
    setForexRate(r);
    if (changePct !== undefined) setForexChangePct(changePct ?? null);
  };

  return (
    <MarketContext.Provider value={{ market, setMarket, forex, forexChangePct, setForex, nseOpen: isNSEOpen(), nyseOpen: isNYSEOpen() }}>
      {children}
    </MarketContext.Provider>
  );
}

export const useMarket = () => useContext(MarketContext);
