import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { NewsCard } from '../components/news/NewsCard';
import { SentimentBadge } from '../components/common/SentimentBadge';
import { useMarket } from '../context/MarketContext';
import { getNews, getNewsAnalysis } from '../api/client';
import type { NewsAnalysis, StockImpact } from '../api/client';
import { MOCK_NEWS } from '../api/mock';
import type { NewsArticle } from '../types';

// ── Filter config ─────────────────────────────────────────────────────────────
const IN_FILTERS = ['All', 'SEBI', 'RBI', 'IT', 'Banking', 'Energy'] as const;
const US_FILTERS = ['All', 'Fed', 'Earnings', 'Tech', 'Energy', 'Macro'] as const;
type InFilter = (typeof IN_FILTERS)[number];
type UsFilter = (typeof US_FILTERS)[number];

const IN_KEYWORDS: Partial<Record<InFilter, string[]>> = {
  SEBI: ['sebi', 'f&o', 'margin'],
  RBI: ['rbi', 'repo', 'rate'],
  IT: ['infosys', 'tcs', 'wipro', 'hcl', 'tech mahindra', 'it sector'],
  Banking: ['bank', 'hdfc', 'sbi', 'icici', 'axis', 'kotak'],
  Energy: ['reliance', 'ongc', 'oil', 'energy', 'petroleum', 'gas'],
};
const US_KEYWORDS: Partial<Record<UsFilter, string[]>> = {
  Fed: ['fed', 'fomc', 'rate cut', 'rate hike', 'inflation'],
  Earnings: ['earnings', 'revenue', 'quarter', 'eps', 'guidance'],
  Tech: ['nvidia', 'apple', 'microsoft', 'google', 'meta', 'amazon', 'ai', 'chip'],
  Energy: ['oil', 'exxon', 'energy', 'crude'],
  Macro: ['gdp', 'cpi', 'jobs', 'unemployment', 'tariff'],
};

function filterArticles<F extends string>(
  articles: NewsArticle[],
  filter: F,
  keywords: Partial<Record<F, string[]>>,
): NewsArticle[] {
  if (filter === 'All') return articles;
  const kws = keywords[filter] ?? [];
  return articles.filter((a) => kws.some((k) => a.headline.toLowerCase().includes(k)));
}

// ── Filter chips ──────────────────────────────────────────────────────────────
function FilterChips<F extends string>({ filters, active, onSelect }: {
  filters: readonly F[];
  active: F;
  onSelect: (f: F) => void;
}) {
  return (
    <div className="flex gap-1 flex-wrap">
      {filters.map((f) => (
        <button
          key={f}
          onClick={() => onSelect(f)}
          className={`px-2.5 py-1 rounded-full text-[10px] font-medium border transition-all ${
            active === f
              ? 'bg-zinc-700 text-white border-zinc-600'
              : 'text-zinc-500 border-border hover:border-zinc-600 hover:text-zinc-300'
          }`}
        >
          {f}
        </button>
      ))}
    </div>
  );
}

// ── Impact card ───────────────────────────────────────────────────────────────
function ImpactCard({ impact }: { impact: StockImpact }) {
  const navigate = useNavigate();
  const impactColor =
    impact.impact === 'POSITIVE' ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30' :
    impact.impact === 'NEGATIVE' ? 'text-red-400 bg-red-500/10 border-red-500/30' :
    'text-zinc-400 bg-zinc-500/10 border-zinc-500/30';
  const impactIcon = impact.impact === 'POSITIVE' ? '▲' : impact.impact === 'NEGATIVE' ? '▼' : '●';
  const magColor = impact.magnitude === 'HIGH' ? 'text-orange-400' : impact.magnitude === 'MEDIUM' ? 'text-yellow-400' : 'text-zinc-500';

  return (
    <div className="card p-4 space-y-3">
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div>
          <button
            onClick={() => navigate(`/stock/${impact.ticker}`)}
            className="text-sm font-bold text-white hover:text-violet-400 transition-colors font-mono"
          >
            {impact.ticker.replace('.NS','').replace('.BO','')}
          </button>
          <div className="text-[11px] text-zinc-500 mt-0.5">{impact.company_name}</div>
        </div>
        <div className="flex flex-col items-end gap-1 shrink-0">
          <span className={`text-[10px] px-2 py-0.5 rounded-full border font-semibold ${impactColor}`}>
            {impactIcon} {impact.impact}
          </span>
          <span className={`text-[9px] font-medium ${magColor}`}>{impact.magnitude} impact</span>
        </div>
      </div>
      {/* Analysis */}
      <p className="text-[11px] text-zinc-400 leading-relaxed">{impact.analysis}</p>
    </div>
  );
}

// ── Article Reader ────────────────────────────────────────────────────────────
function ArticleReader({ article, analysis, loading }: {
  article: NewsArticle;
  analysis: NewsAnalysis | null;
  loading: boolean;
}) {
  const marketColor = article.market === 'IN' ? 'text-amber-400 bg-amber-500/10 border-amber-500/30' : 'text-blue-400 bg-blue-500/10 border-blue-500/30';
  const marketLabel = article.market === 'IN' ? '🇮🇳 India' : '🇺🇸 US';

  function timeStr(iso: string | null) {
    if (!iso) return '';
    return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  }

  const fullText = analysis?.full_text || '';
  const paragraphs = fullText ? fullText.split(/\n\n+/).filter(Boolean) : [];

  return (
    <div className="flex gap-4 h-full">
      {/* Article content - center */}
      <div className="flex-1 min-w-0 overflow-y-auto space-y-4 pr-2">
        {/* Meta */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`text-[10px] px-2 py-0.5 rounded-full border font-medium ${marketColor}`}>{marketLabel}</span>
          {article.source && <span className="text-[10px] text-zinc-500 font-medium">{article.source}</span>}
          <span className="text-[10px] text-zinc-600">{timeStr(article.published)}</span>
          {article.sentiment && <SentimentBadge sentiment={article.sentiment} />}
        </div>

        {/* Headline */}
        <h1 className="text-xl font-bold text-white leading-snug">{article.headline}</h1>

        {/* Tickers from analysis */}
        {analysis?.tickers && analysis.tickers.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {analysis.tickers.map((t) => (
              <span key={t} className="text-[10px] px-2 py-0.5 bg-amber-500/10 border border-amber-500/20 rounded text-amber-400 font-mono">
                {t}
              </span>
            ))}
          </div>
        )}

        {/* Full article text */}
        {loading ? (
          <div className="space-y-2 animate-pulse">
            {[...Array(6)].map((_, i) => (
              <div key={i} className={`h-3 bg-zinc-700 rounded ${i === 5 ? 'w-2/3' : 'w-full'}`} />
            ))}
          </div>
        ) : paragraphs.length > 0 ? (
          <div className="space-y-3">
            {paragraphs.slice(0, 20).map((p, i) => (
              <p key={i} className="text-sm text-zinc-300 leading-relaxed">{p}</p>
            ))}
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-border p-6 text-center space-y-3">
            <div className="text-3xl">📰</div>
            <p className="text-sm text-zinc-400">Full article content is behind a paywall or requires JavaScript rendering.</p>
            <a
              href={article.url || '#'}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-xs text-violet-400 hover:text-violet-300 border border-violet-500/30 rounded-lg px-4 py-2 transition-colors"
            >
              Read on {article.source || 'source'} ↗
            </a>
          </div>
        )}

        {/* External link */}
        {article.url && article.url !== '#' && paragraphs.length > 0 && (
          <a
            href={article.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-[11px] text-zinc-500 hover:text-violet-400 transition-colors"
          >
            Read full article on {article.source || 'source'} ↗
          </a>
        )}
      </div>

      {/* Right: Company impacts */}
      <div className="w-72 xl:w-80 shrink-0 overflow-y-auto space-y-3">
        <div className="flex items-center gap-2 sticky top-0 bg-surface-0 pb-2">
          <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">AI Market Impact</h3>
          {loading && <div className="w-3 h-3 border border-violet-500 border-t-transparent rounded-full animate-spin" />}
        </div>

        {loading ? (
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="card p-4 space-y-2 animate-pulse">
                <div className="h-4 bg-zinc-700 rounded w-1/3" />
                <div className="h-3 bg-zinc-700 rounded w-2/3" />
                <div className="h-3 bg-zinc-700 rounded w-full" />
                <div className="h-3 bg-zinc-700 rounded w-4/5" />
              </div>
            ))}
          </div>
        ) : analysis?.stock_impacts && analysis.stock_impacts.length > 0 ? (
          <div className="space-y-3">
            {analysis.stock_impacts.map((impact, i) => (
              <ImpactCard key={`${impact.ticker}-${i}`} impact={impact} />
            ))}
          </div>
        ) : !loading ? (
          <div className="card p-4 text-center space-y-2">
            <div className="text-2xl">🔍</div>
            <p className="text-xs text-zinc-500">No specific stocks identified in this article.</p>
          </div>
        ) : null}
      </div>
    </div>
  );
}

// ── Main News page ─────────────────────────────────────────────────────────────
export function News() {
  const { market } = useMarket();
  const [allNews, setAllNews] = useState<NewsArticle[]>(MOCK_NEWS);
  const [selected, setSelected] = useState<NewsArticle | null>(null);
  const [analysis, setAnalysis] = useState<NewsAnalysis | null>(null);
  const [analysisLoading, setAnalysisLoading] = useState(false);
  const [inFilter, setInFilter] = useState<InFilter>('All');
  const [usFilter, setUsFilter] = useState<UsFilter>('All');

  useEffect(() => {
    getNews(undefined, 100)
      .then((data: unknown) => {
        if (Array.isArray(data) && data.length > 0) setAllNews(data as NewsArticle[]);
      })
      .catch(() => {});
  }, []);

  const handleSelectArticle = useCallback((article: NewsArticle) => {
    setSelected(article);
    setAnalysis(null);
    if (!article.id) return;
    setAnalysisLoading(true);
    getNewsAnalysis(article.id)
      .then(setAnalysis)
      .catch(() => {})
      .finally(() => setAnalysisLoading(false));
  }, []);

  const inNews = filterArticles(allNews.filter((a) => a.market === 'IN'), inFilter, IN_KEYWORDS);
  const usNews = filterArticles(allNews.filter((a) => a.market === 'US'), usFilter, US_KEYWORDS);
  const showIn = market === 'IN' || market === 'BOTH';
  const showUs = market === 'US' || market === 'BOTH';
  const visibleNews = [
    ...(showIn ? inNews : []),
    ...(showUs ? usNews : []),
  ].sort((a, b) => (b.published ?? '').localeCompare(a.published ?? ''));

  return (
    <div className="flex-1 max-w-[1600px] w-full mx-auto px-4 py-4 flex gap-4 overflow-hidden" style={{ height: 'calc(100vh - 56px)' }}>

      {/* LEFT: News list */}
      <div className="w-72 xl:w-80 shrink-0 flex flex-col gap-3 overflow-y-auto">
        {/* Market section headers + filters */}
        {showIn && (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-amber-400">🇮🇳 India</span>
              <span className="text-[10px] text-zinc-600">({inNews.length})</span>
            </div>
            <FilterChips filters={IN_FILTERS} active={inFilter} onSelect={setInFilter} />
          </div>
        )}
        {showUs && (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-blue-400">🇺🇸 US</span>
              <span className="text-[10px] text-zinc-600">({usNews.length})</span>
            </div>
            <FilterChips filters={US_FILTERS} active={usFilter} onSelect={setUsFilter} />
          </div>
        )}

        {/* Article list */}
        <div className="space-y-1.5 pt-1">
          {visibleNews.length > 0 ? (
            visibleNews.map((a, i) => (
              <NewsCard
                key={a.id ?? i}
                article={a}
                selected={selected?.id === a.id}
                onClick={handleSelectArticle}
              />
            ))
          ) : (
            <p className="text-zinc-600 text-sm py-4 text-center">No articles match this filter.</p>
          )}
        </div>
      </div>

      {/* RIGHT: Article reader + AI impact (shown when article selected) */}
      <div className="flex-1 min-w-0 overflow-hidden">
        {selected ? (
          <ArticleReader article={selected} analysis={analysis} loading={analysisLoading} />
        ) : (
          <div className="h-full flex flex-col items-center justify-center gap-4 text-center">
            <div className="text-5xl opacity-30">📰</div>
            <div>
              <p className="text-zinc-400 font-medium">Select a news article</p>
              <p className="text-zinc-600 text-sm mt-1">
                Click any article on the left to read the full story<br />
                and see AI-powered analysis of how it affects each company's stock price.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
