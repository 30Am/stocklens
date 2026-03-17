import type {
  StockSummary,
  StockDetail,
  NewsArticle,
  CrossMarketEvent,
  IndexData,
  SectorData,
  PriceCandle,
} from '../types';

export const MOCK_INDICES: IndexData[] = [
  { name: 'NIFTY 50', value: 22450, change_pct: 0.72 },
  { name: 'SENSEX', value: 73852, change_pct: 0.61 },
  { name: 'S&P 500', value: 5117, change_pct: -0.34 },
  { name: 'NASDAQ', value: 17982, change_pct: -0.51 },
];

export const MOCK_STOCKS: StockSummary[] = [
  { ticker: 'RELIANCE.NS', name: 'Reliance Industries', exchange: 'NSE', sector: 'Energy', market: 'IN', currency: 'INR', close: 2847.5, change_pct: 2.14, signal: 'BUY', score: 0.82, reason: 'Jio 5G rollout + strong Q3 refinery margins' },
  { ticker: 'TCS.NS', name: 'Tata Consultancy Svcs', exchange: 'NSE', sector: 'IT', market: 'IN', currency: 'INR', close: 3920.15, change_pct: 0.03, signal: 'HOLD', score: 0.05, reason: 'Neutral IT sentiment; Fed rate decision pending' },
  { ticker: 'NVDA', name: 'NVIDIA Corporation', exchange: 'NASDAQ', sector: 'Technology', market: 'US', currency: 'USD', close: 875.4, change_pct: 3.82, signal: 'BUY', score: 0.91, reason: 'AI chip demand surge; Blackwell GPU orders +220%' },
  { ticker: 'AAPL', name: 'Apple Inc', exchange: 'NASDAQ', sector: 'Technology', market: 'US', currency: 'USD', close: 171.2, change_pct: -1.43, signal: 'SELL', score: -0.67, reason: 'China sales -13%; US-China tariff escalation' },
  { ticker: 'HDFCBANK.NS', name: 'HDFC Bank Ltd', exchange: 'NSE', sector: 'Banking', market: 'IN', currency: 'INR', close: 1674.3, change_pct: 1.28, signal: 'BUY', score: 0.74, reason: 'RBI holds repo rate; banking sector positive' },
  { ticker: 'TSLA', name: 'Tesla Inc', exchange: 'NASDAQ', sector: 'Consumer Cyclical', market: 'US', currency: 'USD', close: 168.5, change_pct: -2.11, signal: 'SELL', score: -0.78, reason: 'Q1 delivery miss + rising EV competition in China' },
  { ticker: 'INFY.NS', name: 'Infosys Ltd', exchange: 'NSE', sector: 'IT', market: 'IN', currency: 'INR', close: 1842.6, change_pct: 0.94, signal: 'HOLD', score: 0.45, reason: 'Large deal wins surge 40% in Q3; guidance raised' },
  { ticker: 'META', name: 'Meta Platforms Inc', exchange: 'NASDAQ', sector: 'Technology', market: 'US', currency: 'USD', close: 512.3, change_pct: 0.71, signal: 'BUY', score: 0.63, reason: 'AI assistant reaches 1B users; ad revenue +18%' },
  { ticker: 'HCLTECH.NS', name: 'HCL Technologies', exchange: 'NSE', sector: 'IT', market: 'IN', currency: 'INR', close: 1524.8, change_pct: 0.58, signal: 'HOLD', score: 0.32, reason: 'Cloud services division growth steady' },
  { ticker: 'MSFT', name: 'Microsoft Corp', exchange: 'NASDAQ', sector: 'Technology', market: 'US', currency: 'USD', close: 415.2, change_pct: 0.43, signal: 'BUY', score: 0.55, reason: 'Azure AI revenue beats; Copilot adoption accelerates' },
  { ticker: 'TATASTEEL.NS', name: 'Tata Steel Ltd', exchange: 'NSE', sector: 'Metals', market: 'IN', currency: 'INR', close: 152.8, change_pct: -1.2, signal: 'SELL', score: -0.55, reason: 'Iron ore costs rise; guidance cut for FY25' },
  { ticker: 'XOM', name: 'Exxon Mobil Corp', exchange: 'NYSE', sector: 'Energy', market: 'US', currency: 'USD', close: 109.4, change_pct: -0.72, signal: 'HOLD', score: -0.15, reason: 'Oil price range-bound; refinery margins stable' },
];

export const MOCK_NEWS: NewsArticle[] = [
  { id: 1, headline: 'RBI holds repo rate at 6.5%; signals accommodative stance for growth', source: 'Economic Times', url: '#', market: 'IN', published: new Date(Date.now() - 3600000).toISOString(), sentiment: 'POS', tickers: ['HDFCBANK', 'SBIN', 'KOTAKBANK'] },
  { id: 2, headline: 'Jio announces 5G rollout in 50 new cities; subscriber base to hit 500M', source: 'Moneycontrol', url: '#', market: 'IN', published: new Date(Date.now() - 7200000).toISOString(), sentiment: 'POS', tickers: ['RELIANCE'] },
  { id: 3, headline: 'Tata Steel Q3 margins compress as iron ore costs rise; guidance cut for FY25', source: 'LiveMint', url: '#', market: 'IN', published: new Date(Date.now() - 10800000).toISOString(), sentiment: 'NEG', tickers: ['TATASTEEL', 'HINDALCO'] },
  { id: 4, headline: 'SEBI releases new circular on F&O margin requirements effective April 2025', source: 'Business Standard', url: '#', market: 'IN', published: new Date(Date.now() - 14400000).toISOString(), sentiment: 'NEU', tickers: [] },
  { id: 5, headline: 'Infosys large deal wins surge 40% in Q3; management raises revenue guidance', source: 'Economic Times', url: '#', market: 'IN', published: new Date(Date.now() - 18000000).toISOString(), sentiment: 'POS', tickers: ['INFY'] },
  { id: 6, headline: 'NVIDIA Blackwell GPU demand exceeds supply; data center orders up 220% YoY', source: 'Reuters', url: '#', market: 'US', published: new Date(Date.now() - 3600000).toISOString(), sentiment: 'POS', tickers: ['NVDA', 'AMD'] },
  { id: 7, headline: 'Apple China sales drop 13% in Q1 amid Huawei competition and US tariff rise', source: 'CNBC', url: '#', market: 'US', published: new Date(Date.now() - 7200000).toISOString(), sentiment: 'NEG', tickers: ['AAPL'] },
  { id: 8, headline: 'Tesla Q1 deliveries miss estimates by 8%; factory shutdowns cited as key factor', source: 'Reuters', url: '#', market: 'US', published: new Date(Date.now() - 10800000).toISOString(), sentiment: 'NEG', tickers: ['TSLA'] },
  { id: 9, headline: 'Fed minutes signal one rate cut in 2025; market expectations adjust lower', source: 'CNBC', url: '#', market: 'US', published: new Date(Date.now() - 14400000).toISOString(), sentiment: 'NEU', tickers: ['SPY', 'XLF'] },
  { id: 10, headline: 'Meta AI assistant reaches 1B monthly users; ad revenue beats by 18%', source: 'Bloomberg', url: '#', market: 'US', published: new Date(Date.now() - 18000000).toISOString(), sentiment: 'POS', tickers: ['META'] },
];

export const MOCK_CROSS_MARKET: CrossMarketEvent[] = [
  { id: 1, event_type: 'Fed Rate Hold (Expected Thursday)', description: 'Fed pause strengthens rupee; reduces FII outflow. Historically positive for Indian IT exporters and banking sector.', impact_direction: 'POSITIVE', source_market: 'US', target_market: 'IN', affected_tickers: ['TCS', 'INFY', 'WIPRO', 'HDFCBANK'], created_at: new Date().toISOString() },
  { id: 2, event_type: 'NVIDIA AI Boom — Data Center Demand', description: 'Rising US AI infra spend boosts Indian IT service providers with cloud/AI contracts. TCS and Infosys have major deals.', impact_direction: 'POSITIVE', source_market: 'US', target_market: 'IN', affected_tickers: ['TCS', 'INFY', 'HCLTECH'], created_at: new Date().toISOString() },
  { id: 3, event_type: 'US-China Tariff Escalation', description: 'Tariffs on Chinese electronics disrupt supply chains; hurts exporters but positions India as alternative manufacturing hub.', impact_direction: 'MIXED', source_market: 'US', target_market: 'IN', affected_tickers: ['DIXONTECH', 'TATAELXSI'], created_at: new Date().toISOString() },
  { id: 4, event_type: 'RBI Rate Hold — Rupee Stability', description: 'Stable Indian policy reduces currency risk for US multinationals. Positive for Alphabet, Amazon, Microsoft India revenues.', impact_direction: 'POSITIVE', source_market: 'IN', target_market: 'US', affected_tickers: ['GOOGL', 'AMZN', 'MSFT'], created_at: new Date().toISOString() },
  { id: 5, event_type: 'Tata Motors Jaguar Sales Report', description: 'JLR deliveries beat UK/Europe estimates. JLR = 70% of Tata Motors revenue — proxy for global premium auto demand.', impact_direction: 'POSITIVE', source_market: 'IN', target_market: 'US', affected_tickers: ['F', 'GM', 'TATAMOTORS'], created_at: new Date().toISOString() },
];

export const MOCK_NIFTY_SECTORS: SectorData[] = [
  { name: 'NIFTY BANK', change_pct: 1.6 },
  { name: 'NIFTY IT', change_pct: 0.6 },
  { name: 'PHARMA', change_pct: 0.2 },
  { name: 'AUTO', change_pct: 0.0 },
  { name: 'ENERGY', change_pct: 1.1 },
  { name: 'FMCG', change_pct: -0.3 },
  { name: 'METALS', change_pct: -1.2 },
  { name: 'REALTY', change_pct: 0.4 },
];

export const MOCK_SP500_SECTORS: SectorData[] = [
  { name: 'TECH', change_pct: 2.1 },
  { name: 'FINANCIALS', change_pct: -0.4 },
  { name: 'HEALTHCARE', change_pct: 0.1 },
  { name: 'ENERGY', change_pct: -1.5 },
  { name: 'CONSUMER', change_pct: 0.5 },
  { name: 'UTILITIES', change_pct: -0.2 },
  { name: 'COMM SVCS', change_pct: 0.9 },
  { name: 'MATERIALS', change_pct: -1.0 },
];

export function generateCandleData(basePrice: number, count = 90): PriceCandle[] {
  const data: PriceCandle[] = [];
  let price = basePrice * 0.88;
  const now = new Date();
  for (let i = count - 1; i >= 0; i--) {
    const date = new Date(now);
    date.setDate(date.getDate() - i);
    const day = date.getDay();
    if (day === 0 || day === 6) continue; // skip weekends
    const change = (Math.random() - 0.47) * price * 0.018;
    const open = price;
    const close = price + change;
    const wick = Math.random() * price * 0.006;
    data.push({
      time: date.toISOString().split('T')[0],
      open: +open.toFixed(2),
      high: +(Math.max(open, close) + wick).toFixed(2),
      low: +(Math.min(open, close) - wick).toFixed(2),
      close: +close.toFixed(2),
      volume: Math.floor(Math.random() * 6_000_000 + 800_000),
    });
    price = close;
  }
  return data;
}

export function mockStockDetail(ticker: string): StockDetail {
  // Try to find an exact match in mock stocks first
  const known = MOCK_STOCKS.find((s) => s.ticker === ticker);
  if (known) {
    const history = generateCandleData(known.close ?? 1000);
    return {
      ...known,
      open: known.close ? known.close * 0.99 : null,
      high: known.close ? known.close * 1.025 : null,
      low: known.close ? known.close * 0.975 : null,
      volume: 8_400_000,
      week52_high: known.close ? known.close * 1.22 : null,
      week52_low: known.close ? known.close * 0.73 : null,
      market_cap: known.close ? known.close * 1_200_000 : null,
      pe_ratio: 28.4,
      price_history: history,
      related_news: MOCK_NEWS.filter((n) => n.market === known.market).slice(0, 3),
    };
  }

  // Generate a ticker-specific placeholder — never fall back to Reliance
  const isIndian = ticker.endsWith('.NS') || ticker.endsWith('.BO');
  const market = isIndian ? ('IN' as const) : ('US' as const);
  const currency = isIndian ? ('INR' as const) : ('USD' as const);
  const cleanName = ticker.replace('.NS', '').replace('.BO', '');
  const basePrice = isIndian ? 500 : 150;
  const history = generateCandleData(basePrice);
  return {
    ticker,
    name: cleanName,
    exchange: isIndian ? 'NSE' : 'NYSE',
    sector: null,
    market,
    currency,
    close: basePrice,
    change_pct: 0,
    signal: 'HOLD',
    score: 0,
    reason: null,
    open: basePrice * 0.99,
    high: basePrice * 1.025,
    low: basePrice * 0.975,
    volume: null,
    week52_high: null,
    week52_low: null,
    market_cap: null,
    pe_ratio: null,
    price_history: history,
    related_news: MOCK_NEWS.filter((n) => n.market === market).slice(0, 3),
  };
}
