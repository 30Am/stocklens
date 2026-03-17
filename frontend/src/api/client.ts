import axios from 'axios';

const BASE_URL = (import.meta.env.VITE_API_URL as string | undefined) ?? 'http://localhost:8000';

const api = axios.create({ baseURL: BASE_URL, timeout: 12_000 });

api.interceptors.response.use(
  (r) => r,
  (err: unknown) => {
    if (axios.isAxiosError(err)) {
      console.warn('[API]', err.message);
    }
    return Promise.reject(err);
  },
);

export const getStocks = (market?: string, limit = 60) =>
  api.get<unknown>('/stocks', { params: { market, limit } }).then((r) => r.data);

export const getStockDetail = (ticker: string) =>
  api.get<unknown>(`/stocks/${encodeURIComponent(ticker)}`).then((r) => r.data);

export const getStockPrices = (ticker: string, period = '1mo') =>
  api.get<unknown>(`/stocks/${encodeURIComponent(ticker)}/prices`, { params: { period } }).then((r) => r.data);

export const getTrending = (market?: string, limit = 12) =>
  api.get<unknown>('/trending', { params: { market, limit } }).then((r) => r.data);

export const getNews = (market?: string, limit = 60) =>
  api.get<unknown>('/news', { params: { market, limit } }).then((r) => r.data);

export const getForex = () =>
  api.get<unknown>('/forex').then((r) => r.data);

export const getCrossMarketEvents = (limit = 20) =>
  api.get<unknown>('/cross-market-events', { params: { limit } }).then((r) => r.data);

export interface ChatResult {
  reply: string;
  tickers_mentioned: string[];
  signals: Array<{ ticker: string; signal: string; score: number; reason: string }>;
}

export const sendChat = (message: string, tickers?: string[]) =>
  api.post<ChatResult>('/chat', { message, tickers }).then((r) => r.data);

export const WS_BASE = (import.meta.env.VITE_WS_URL as string | undefined) ?? 'ws://localhost:8000';

export default api;
