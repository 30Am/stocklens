export type SignalType = 'BUY' | 'HOLD' | 'SELL';
export type SentimentType = 'POS' | 'NEG' | 'NEU';
export type MarketFilter = 'IN' | 'US' | 'BOTH';

export interface StockSummary {
  ticker: string;
  name: string;
  exchange: string;
  sector: string | null;
  market: 'IN' | 'US';
  currency: 'INR' | 'USD';
  close: number | null;
  change_pct: number | null;
  signal: SignalType;
  score: number;
  reason: string | null;
}

export interface PriceCandle {
  time: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface StockDetail extends StockSummary {
  open: number | null;
  high: number | null;
  low: number | null;
  volume: number | null;
  week52_high: number | null;
  week52_low: number | null;
  market_cap: number | null;
  pe_ratio: number | null;
  price_history: PriceCandle[];
  related_news: NewsArticle[];
}

export interface NewsArticle {
  id?: number;
  headline: string;
  source: string | null;
  url: string;
  market: string | null;
  published: string | null;
  raw_text?: string;
  sentiment?: SentimentType | null;
  tickers?: string[];
}

export interface SignalRecord {
  ticker: string;
  name: string | null;
  signal: SignalType;
  score: number;
  reason: string;
  market: string | null;
  sector: string | null;
  created_at: string | null;
}

export interface CrossMarketEvent {
  id: number;
  // Frontend mock fields
  event_type?: string;
  description?: string;
  impact_direction?: string;
  source_market?: string;
  target_market?: string;
  affected_tickers?: string[];
  // Backend DB fields (different schema)
  event?: string;
  impact?: string;
  in_ticker?: string | null;
  us_ticker?: string | null;
  created_at: string;
}

export interface ForexRate {
  pair: string;
  rate: number;
  updated_at: string | null;
}

export interface IndexData {
  name: string;
  value: number;
  change_pct: number;
}

export interface SectorData {
  name: string;
  change_pct: number;
}
