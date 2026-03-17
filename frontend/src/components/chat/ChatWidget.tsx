import { useState, useRef, useEffect, useCallback } from 'react';
import { ChatMessage } from './ChatMessage';
import { sendChat } from '../../api/client';
import { MOCK_STOCKS } from '../../api/mock';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  tickers?: string[];
}

function fmtStock(s: (typeof MOCK_STOCKS)[0]): string {
  const sym = s.currency === 'INR' ? '₹' : '$';
  const score = (Math.abs(s.score) * 10).toFixed(1);
  const shortTicker = s.ticker.replace('.NS', '').replace('.BO', '');
  return `• ${shortTicker} (${s.name}) — Signal: ${s.signal} | ${sym}${s.close?.toLocaleString()} | AI Score: ${score}/10\n  ${s.reason ?? ''}`;
}

function localFallback(q: string): string {
  const t = q.toLowerCase();

  // 1. Match specific stocks by ticker or company name keywords
  const matched = MOCK_STOCKS.filter((s) => {
    const shortTicker = s.ticker.replace('.NS', '').replace('.BO', '').toLowerCase();
    const nameParts = s.name.toLowerCase().split(' ');
    return (
      t.includes(shortTicker) ||
      t.includes(s.ticker.toLowerCase()) ||
      nameParts.some((word) => word.length > 3 && t.includes(word))
    );
  });

  if (matched.length > 0) {
    const lines = matched.map(fmtStock).join('\n\n');
    return `Based on current AI signals (offline snapshot):\n\n${lines}`;
  }

  // 2. Best / top / recommend → show all BUY signals ranked by score
  if (t.includes('best') || t.includes('top') || t.includes('recommend') || t.includes('should i buy') || t.includes('which stock')) {
    const buys = MOCK_STOCKS.filter((s) => s.signal === 'BUY').sort((a, b) => b.score - a.score);
    return `Top BUY signals right now (offline snapshot):\n\n${buys.map(fmtStock).join('\n\n')}`;
  }

  // 3. Bullish / gainers / up
  if (t.includes('bullish') || t.includes('gainer') || t.includes('going up') || t.includes('rising') || t.includes('positive')) {
    const buys = MOCK_STOCKS.filter((s) => s.signal === 'BUY' && (s.change_pct ?? 0) > 0).sort((a, b) => (b.change_pct ?? 0) - (a.change_pct ?? 0));
    return `Bullish stocks with positive momentum:\n\n${buys.map(fmtStock).join('\n\n')}`;
  }

  // 4. Bearish / losers / sell / avoid
  if (t.includes('bearish') || t.includes('loser') || t.includes('avoid') || t.includes('sell') || t.includes('falling') || t.includes('down')) {
    const sells = MOCK_STOCKS.filter((s) => s.signal === 'SELL').sort((a, b) => (a.change_pct ?? 0) - (b.change_pct ?? 0));
    return `Stocks with SELL signals (bearish):\n\n${sells.map(fmtStock).join('\n\n')}`;
  }

  // 5. Indian / India / NSE / Nifty stocks
  if (t.includes('india') || t.includes('indian') || t.includes('nse') || t.includes('nifty') || t.includes('bse') || t.includes('inr') || t.includes('rupee')) {
    const indian = MOCK_STOCKS.filter((s) => s.market === 'IN');
    return `Indian market stocks (NSE/BSE):\n\n${indian.map(fmtStock).join('\n\n')}`;
  }

  // 6. US / American / NASDAQ / NYSE stocks
  if (t.includes('us ') || t.includes('usa') || t.includes('american') || t.includes('nasdaq') || t.includes('nyse') || t.includes('dollar') || t.includes(' usd')) {
    const us = MOCK_STOCKS.filter((s) => s.market === 'US');
    return `US market stocks (NASDAQ/NYSE):\n\n${us.map(fmtStock).join('\n\n')}`;
  }

  // 7. Sector queries
  const sectors: Record<string, string> = { tech: 'Technology', it: 'IT', bank: 'Banking', energy: 'Energy', metal: 'Metals', auto: 'Consumer Cyclical' };
  for (const [key, sector] of Object.entries(sectors)) {
    if (t.includes(key)) {
      const inSector = MOCK_STOCKS.filter((s) => s.sector?.toLowerCase().includes(sector.toLowerCase()));
      if (inSector.length > 0)
        return `${sector} sector stocks:\n\n${inSector.map(fmtStock).join('\n\n')}`;
    }
  }

  // 8. Macro / Fed / RBI / rate questions
  if (t.includes('fed') || t.includes('rate') || t.includes('rbi') || t.includes('interest') || t.includes('inflation') || t.includes('macro')) {
    return 'Macro context (offline): RBI holds repo rate at 6.5% — positive for Indian banking (HDFCBANK, SBIN). Fed rate hold strengthens the rupee, reduces FII outflows, and supports Indian IT exporters like TCS and INFY. Rising US rates historically pressure Indian equities through FII selling.';
  }

  // 9. Portfolio / watchlist helpers
  if (t.includes('portfolio') || t.includes('diversif') || t.includes('allocat')) {
    const buys = MOCK_STOCKS.filter((s) => s.signal === 'BUY');
    return `For a balanced portfolio, consider spreading across markets and sectors. Current BUY signals:\n\n${buys.map(fmtStock).join('\n\n')}`;
  }

  // 10. Generic fallback with all signals summary
  const buyCount = MOCK_STOCKS.filter((s) => s.signal === 'BUY').length;
  const sellCount = MOCK_STOCKS.filter((s) => s.signal === 'SELL').length;
  const holdCount = MOCK_STOCKS.filter((s) => s.signal === 'HOLD').length;
  return `Market snapshot (offline data):\n• ${buyCount} stocks with BUY signal\n• ${holdCount} stocks with HOLD signal\n• ${sellCount} stocks with SELL signal\n\nTop picks: ${MOCK_STOCKS.filter((s) => s.signal === 'BUY').map((s) => s.ticker.replace('.NS', '').replace('.BO', '')).join(', ')}\n\nAsk about a specific stock, sector, or market for detailed analysis.`;
}

const SUGGESTIONS = [
  'What is the signal for RELIANCE today?',
  'Why is NVIDIA moving up?',
  'How is Fed policy affecting Indian IT stocks?',
  'Which Indian banking stocks look bullish?',
];

const WELCOME: Message = {
  id: 'welcome',
  role: 'assistant',
  text: 'Hi! I\'m StockLens AI. Ask me anything about Indian or US stocks — signals, news, cross-market trends, or market conditions.',
};

export function ChatWidget() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([WELCOME]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
      inputRef.current?.focus();
    }
  }, [messages, open]);

  const send = useCallback(async (text: string) => {
    const q = text.trim();
    if (!q || loading) return;
    setInput('');

    const userMsg: Message = { id: Date.now().toString(), role: 'user', text: q };
    setMessages((prev) => [...prev, userMsg]);
    setLoading(true);

    try {
      const res = await sendChat(q);
      const aiMsg: Message = {
        id: `${Date.now()}-ai`,
        role: 'assistant',
        text: res.reply,
        tickers: res.tickers_mentioned,
      };
      setMessages((prev) => [...prev, aiMsg]);
    } catch {
      setMessages((prev) => [...prev, {
        id: `${Date.now()}-err`,
        role: 'assistant',
        text: localFallback(q),
      }]);
    } finally {
      setLoading(false);
    }
  }, [loading]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    void send(input);
  }

  return (
    <>
      {/* Floating button */}
      <button
        onClick={() => setOpen(!open)}
        className={`fixed bottom-6 right-6 z-40 w-13 h-13 rounded-2xl flex items-center justify-center shadow-2xl transition-all duration-200 ${
          open
            ? 'bg-zinc-700 text-white rotate-45 scale-90'
            : 'bg-gradient-to-br from-violet-600 to-blue-600 text-white hover:scale-110'
        }`}
        style={{ width: 52, height: 52 }}
        title="AI Chat"
      >
        {open ? '✕' : '🤖'}
      </button>

      {/* Chat panel */}
      {open && (
        <div className="fixed bottom-24 right-6 z-40 w-80 sm:w-96 flex flex-col rounded-2xl border border-zinc-700 shadow-2xl bg-surface-1 overflow-hidden animate-slide-up">
          {/* Header */}
          <div className="flex items-center gap-2 px-4 py-3 border-b border-border bg-gradient-to-r from-violet-900/40 to-blue-900/40">
            <span className="text-lg">🤖</span>
            <div>
              <div className="text-sm font-semibold text-white">StockLens AI</div>
              <div className="text-[10px] text-violet-400">GPT-4o-mini · Market context aware</div>
            </div>
            <button
              onClick={() => setMessages([WELCOME])}
              className="ml-auto text-[10px] text-zinc-600 hover:text-zinc-400 transition-colors px-2 py-1 rounded"
              title="Clear chat"
            >
              Clear
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3 max-h-72">
            {messages.map((m) => (
              <ChatMessage key={m.id} role={m.role} text={m.text} tickers={m.tickers} />
            ))}
            {loading && (
              <div className="flex gap-2">
                <div className="w-6 h-6 rounded-full bg-violet-600/30 border border-violet-500/30 flex items-center justify-center text-xs">🤖</div>
                <div className="bg-surface-2 border border-border rounded-xl rounded-tl-none px-3 py-2 flex gap-1 items-center">
                  {[0, 1, 2].map((i) => (
                    <span key={i} className="w-1.5 h-1.5 bg-zinc-500 rounded-full animate-bounce" style={{ animationDelay: `${i * 150}ms` }} />
                  ))}
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Suggestions (only when no messages beyond welcome) */}
          {messages.length === 1 && (
            <div className="px-4 pb-2 flex flex-wrap gap-1.5">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => void send(s)}
                  className="text-[10px] px-2 py-1 bg-surface-2 border border-border rounded-lg text-zinc-400 hover:text-white hover:border-zinc-600 transition-colors text-left"
                >
                  {s}
                </button>
              ))}
            </div>
          )}

          {/* Input */}
          <form onSubmit={handleSubmit} className="flex items-center gap-2 px-3 py-3 border-t border-border">
            <input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask about any stock..."
              disabled={loading}
              className="flex-1 bg-surface-2 border border-border rounded-xl px-3 py-2 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-zinc-600 disabled:opacity-50"
            />
            <button
              type="submit"
              disabled={!input.trim() || loading}
              className="w-9 h-9 rounded-xl bg-violet-600 hover:bg-violet-500 disabled:opacity-30 disabled:cursor-not-allowed text-white flex items-center justify-center transition-colors shrink-0"
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M13 1L1 7l5 2 2 5 5-13z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </form>
        </div>
      )}
    </>
  );
}
