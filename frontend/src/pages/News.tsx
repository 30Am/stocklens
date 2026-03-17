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
          className={`px-2.5 py-1 rounded-full text-[10px] font-semibold border transition-all duration-150 ${
            active === f
              ? 'bg-violet-600/30 text-violet-300 border-violet-500/50 shadow-sm'
              : 'text-zinc-500 border-border hover:border-zinc-600 hover:text-zinc-300 hover:bg-surface-2'
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

  const impactConfig = {
    POSITIVE: {
      colors: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30',
      icon: '▲',
      glow: 'shadow-emerald-500/5',
    },
    NEGATIVE: {
      colors: 'text-red-400 bg-red-500/10 border-red-500/30',
      icon: '▼',
      glow: 'shadow-red-500/5',
    },
    NEUTRAL: {
      colors: 'text-zinc-400 bg-zinc-500/10 border-zinc-500/30',
      icon: '●',
      glow: 'shadow-zinc-500/5',
    },
  };

  const cfg = impactConfig[impact.impact] ?? impactConfig.NEUTRAL;
  const magColor =
    impact.magnitude === 'HIGH' ? 'text-orange-400' :
    impact.magnitude === 'MEDIUM' ? 'text-yellow-400' :
    'text-zinc-600';
  const magBg =
    impact.magnitude === 'HIGH' ? 'bg-orange-500/10 border-orange-500/20' :
    impact.magnitude === 'MEDIUM' ? 'bg-yellow-500/10 border-yellow-500/20' :
    'bg-zinc-800 border-zinc-700';

  return (
    <div className={`rounded-xl border border-border bg-surface-1 p-4 space-y-3 shadow-lg ${cfg.glow} hover:border-zinc-600 transition-all duration-150`}>
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <button
            onClick={() => navigate(`/stock/${impact.ticker}`)}
            className="text-sm font-bold text-white hover:text-violet-400 transition-colors font-mono leading-none"
          >
            {impact.ticker.replace('.NS', '').replace('.BO', '')}
          </button>
          <div className="text-[11px] text-zinc-500 mt-1 leading-tight truncate max-w-[140px]">
            {impact.company_name}
          </div>
        </div>
        <div className="flex flex-col items-end gap-1.5 shrink-0">
          <span className={`text-[10px] px-2 py-0.5 rounded-full border font-bold tracking-wide ${cfg.colors}`}>
            {cfg.icon} {impact.impact}
          </span>
          <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded border ${magBg} ${magColor}`}>
            {impact.magnitude}
          </span>
        </div>
      </div>

      {/* Divider */}
      <div className="h-px bg-border" />

      {/* Analysis */}
      <p className="text-[11px] text-zinc-400 leading-relaxed">{impact.analysis}</p>
    </div>
  );
}

// ── Article Reader ────────────────────────────────────────────────────────────
function ArticleReader({
  article,
  analysis,
  loading,
  onBack,
}: {
  article: NewsArticle;
  analysis: NewsAnalysis | null;
  loading: boolean;
  onBack?: () => void;
}) {
  const marketConfig = article.market === 'IN'
    ? { color: 'text-amber-400 bg-amber-500/10 border-amber-500/30', label: '🇮🇳 India' }
    : { color: 'text-blue-400 bg-blue-500/10 border-blue-500/30', label: '🇺🇸 US' };

  function timeStr(iso: string | null) {
    if (!iso) return '';
    return new Date(iso).toLocaleDateString('en-IN', {
      day: 'numeric', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  }

  const fullText = analysis?.full_text || '';
  const paragraphs = fullText ? fullText.split(/\n\n+/).filter(Boolean) : [];

  return (
    <div className="flex flex-col lg:flex-row gap-0 lg:gap-5 h-full">

      {/* ── Article content ── */}
      <div className="flex-1 min-w-0 overflow-y-auto">
        {/* Mobile back button */}
        {onBack && (
          <button
            onClick={onBack}
            className="flex items-center gap-2 text-zinc-400 hover:text-white text-xs mb-4 transition-colors lg:hidden"
          >
            <span className="text-base leading-none">←</span>
            Back to news
          </button>
        )}

        {/* Article card */}
        <div className="bg-surface-1 rounded-2xl border border-border p-5 md:p-6 space-y-4">
          {/* Meta row */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`text-[10px] px-2.5 py-1 rounded-full border font-semibold ${marketConfig.color}`}>
              {marketConfig.label}
            </span>
            {article.source && (
              <span className="text-[10px] text-zinc-500 font-semibold bg-surface-2 px-2 py-0.5 rounded-full border border-border">
                {article.source}
              </span>
            )}
            <span className="text-[10px] text-zinc-600">{timeStr(article.published)}</span>
            {article.sentiment && <SentimentBadge sentiment={article.sentiment} />}
          </div>

          {/* Headline */}
          <h1 className="text-lg md:text-xl font-bold text-white leading-snug">
            {article.headline}
          </h1>

          {/* Tickers from analysis */}
          {analysis?.tickers && analysis.tickers.length > 0 && (
            <div className="flex flex-wrap gap-1.5 pt-1">
              {analysis.tickers.map((t) => (
                <span
                  key={t}
                  className="text-[10px] px-2 py-0.5 bg-amber-500/10 border border-amber-500/20 rounded-md text-amber-400 font-mono"
                >
                  {t}
                </span>
              ))}
            </div>
          )}

          {/* Divider */}
          <div className="h-px bg-gradient-to-r from-border via-zinc-600/30 to-transparent" />

          {/* Full article text */}
          {loading ? (
            <div className="space-y-2.5 animate-pulse pt-1">
              {[...Array(8)].map((_, i) => (
                <div
                  key={i}
                  className={`h-3 bg-zinc-700/60 rounded-full ${
                    i === 7 ? 'w-1/2' : i % 3 === 2 ? 'w-4/5' : 'w-full'
                  }`}
                />
              ))}
            </div>
          ) : paragraphs.length > 0 ? (
            <div className="space-y-4 pt-1">
              {paragraphs.slice(0, 20).map((p, i) => (
                <p key={i} className="text-sm text-zinc-300 leading-relaxed">{p}</p>
              ))}
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-zinc-700 bg-surface-2/50 p-8 text-center space-y-3">
              <div className="text-4xl opacity-60">🔒</div>
              <p className="text-sm text-zinc-400 font-medium">Content behind paywall or JS-rendered</p>
              <p className="text-xs text-zinc-600">Click below to read on the original site</p>
              {article.url && article.url !== '#' && (
                <a
                  href={article.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 text-xs text-violet-400 hover:text-violet-300 bg-violet-500/10 border border-violet-500/30 rounded-lg px-5 py-2.5 transition-all hover:bg-violet-500/15"
                >
                  Read on {article.source || 'source'}
                  <span className="text-[10px]">↗</span>
                </a>
              )}
            </div>
          )}

          {/* External link (when article loaded) */}
          {article.url && article.url !== '#' && paragraphs.length > 0 && (
            <div className="pt-2 border-t border-border">
              <a
                href={article.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-xs text-zinc-500 hover:text-violet-400 transition-colors"
              >
                Read full article on {article.source || 'source'}
                <span className="text-[10px]">↗</span>
              </a>
            </div>
          )}
        </div>

        {/* Mobile AI Impact (shown below article on mobile/tablet) */}
        <div className="lg:hidden mt-4 space-y-3">
          <div className="flex items-center gap-2 px-1">
            <div className="h-px flex-1 bg-border" />
            <span className="text-[10px] font-semibold text-zinc-500 uppercase tracking-widest">AI Market Impact</span>
            {loading && <div className="w-3 h-3 border border-violet-500 border-t-transparent rounded-full animate-spin" />}
            <div className="h-px flex-1 bg-border" />
          </div>
          <AiImpactList analysis={analysis} loading={loading} />
        </div>
      </div>

      {/* ── Right: AI Impact panel (desktop only) ── */}
      <div className="hidden lg:flex w-72 xl:w-80 shrink-0 flex-col gap-3 overflow-y-auto">
        <div className="flex items-center gap-2 sticky top-0 bg-surface-0 pb-3 z-10">
          <div className="w-1.5 h-1.5 rounded-full bg-violet-500 animate-pulse" />
          <h3 className="text-xs font-semibold text-zinc-300 uppercase tracking-widest">AI Market Impact</h3>
          {loading && <div className="w-3 h-3 border border-violet-500 border-t-transparent rounded-full animate-spin ml-auto" />}
        </div>
        <AiImpactList analysis={analysis} loading={loading} />
      </div>
    </div>
  );
}

// ── Shared AI impact list ─────────────────────────────────────────────────────
function AiImpactList({ analysis, loading }: { analysis: NewsAnalysis | null; loading: boolean }) {
  if (loading) {
    return (
      <div className="space-y-3">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="rounded-xl border border-border bg-surface-1 p-4 space-y-2.5 animate-pulse">
            <div className="flex justify-between">
              <div className="h-4 bg-zinc-700 rounded w-1/4" />
              <div className="h-4 bg-zinc-700 rounded w-1/5" />
            </div>
            <div className="h-3 bg-zinc-700 rounded w-2/3" />
            <div className="h-px bg-border" />
            <div className="space-y-1.5">
              <div className="h-2.5 bg-zinc-700/70 rounded w-full" />
              <div className="h-2.5 bg-zinc-700/70 rounded w-4/5" />
              <div className="h-2.5 bg-zinc-700/70 rounded w-3/5" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (analysis?.stock_impacts && analysis.stock_impacts.length > 0) {
    return (
      <div className="space-y-3">
        {analysis.stock_impacts.map((impact, i) => (
          <ImpactCard key={`${impact.ticker}-${i}`} impact={impact} />
        ))}
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-surface-1 p-6 text-center space-y-2">
      <div className="text-3xl opacity-50">🔍</div>
      <p className="text-xs text-zinc-500">No specific stocks identified in this article.</p>
    </div>
  );
}

// ── Empty state ───────────────────────────────────────────────────────────────
function EmptyState() {
  return (
    <div className="h-full flex flex-col items-center justify-center gap-5 text-center px-6">
      <div className="relative">
        <div className="text-6xl opacity-20">📰</div>
        <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-violet-500/20 border border-violet-500/40 rounded-full flex items-center justify-center">
          <span className="text-[10px]">✦</span>
        </div>
      </div>
      <div className="space-y-2">
        <p className="text-zinc-300 font-semibold text-sm">Select an article to read</p>
        <p className="text-zinc-600 text-xs leading-relaxed max-w-[260px]">
          Click any article from the list to read the full story and get AI-powered analysis of how it impacts each company's stock price.
        </p>
      </div>
      <div className="flex items-center gap-3 text-[10px] text-zinc-700">
        <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-amber-400/60" />India news</span>
        <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-blue-400/60" />US news</span>
        <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-violet-400/60" />AI analysis</span>
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
  // Mobile: 'list' or 'article'
  const [mobileView, setMobileView] = useState<'list' | 'article'>('list');

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
    setMobileView('article');
    if (!article.id) return;
    setAnalysisLoading(true);
    getNewsAnalysis(article.id)
      .then(setAnalysis)
      .catch(() => {})
      .finally(() => setAnalysisLoading(false));
  }, []);

  const handleBack = useCallback(() => {
    setMobileView('list');
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
    <div
      className="flex-1 w-full max-w-[1600px] mx-auto overflow-hidden"
      style={{ height: 'calc(100vh - 56px)' }}
    >
      {/* ── Desktop layout (lg+): sidebar + reader side by side ── */}
      <div className="hidden lg:flex h-full gap-4 px-4 py-4">

        {/* Left: News list */}
        <div className="w-72 xl:w-80 shrink-0 flex flex-col gap-0 overflow-hidden rounded-2xl border border-border bg-surface-1">
          {/* Header */}
          <div className="px-4 pt-4 pb-3 border-b border-border space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-white">Market News</h2>
              <span className="text-[10px] text-zinc-600 bg-surface-2 px-2 py-0.5 rounded-full border border-border">
                {visibleNews.length} articles
              </span>
            </div>

            {showIn && (
              <div className="space-y-1.5">
                <div className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" />
                  <span className="text-[10px] font-semibold text-amber-400">India</span>
                  <span className="text-[9px] text-zinc-700">({inNews.length})</span>
                </div>
                <FilterChips filters={IN_FILTERS} active={inFilter} onSelect={setInFilter} />
              </div>
            )}
            {showUs && (
              <div className="space-y-1.5">
                <div className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-400 shrink-0" />
                  <span className="text-[10px] font-semibold text-blue-400">US Markets</span>
                  <span className="text-[9px] text-zinc-700">({usNews.length})</span>
                </div>
                <FilterChips filters={US_FILTERS} active={usFilter} onSelect={setUsFilter} />
              </div>
            )}
          </div>

          {/* Article list */}
          <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
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
              <div className="py-10 text-center space-y-2">
                <div className="text-2xl opacity-30">🗞️</div>
                <p className="text-zinc-600 text-xs">No articles match this filter</p>
              </div>
            )}
          </div>
        </div>

        {/* Right: Article reader */}
        <div className="flex-1 min-w-0 overflow-hidden">
          {selected ? (
            <ArticleReader article={selected} analysis={analysis} loading={analysisLoading} />
          ) : (
            <EmptyState />
          )}
        </div>
      </div>

      {/* ── Mobile / Tablet layout (< lg) ── */}
      <div className="lg:hidden h-full flex flex-col overflow-hidden">

        {/* Mobile: List view */}
        <div className={`flex flex-col h-full transition-all duration-300 ${mobileView === 'list' ? 'flex' : 'hidden'}`}>
          {/* Header */}
          <div className="px-4 pt-4 pb-3 border-b border-border bg-surface-1 space-y-3 shrink-0">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-white">Market News</h2>
              <span className="text-[10px] text-zinc-600 bg-surface-2 px-2 py-0.5 rounded-full border border-border">
                {visibleNews.length} articles
              </span>
            </div>

            {showIn && (
              <div className="space-y-1.5">
                <div className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" />
                  <span className="text-[10px] font-semibold text-amber-400">India</span>
                  <span className="text-[9px] text-zinc-700">({inNews.length})</span>
                </div>
                <FilterChips filters={IN_FILTERS} active={inFilter} onSelect={setInFilter} />
              </div>
            )}
            {showUs && (
              <div className="space-y-1.5">
                <div className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-400 shrink-0" />
                  <span className="text-[10px] font-semibold text-blue-400">US Markets</span>
                  <span className="text-[9px] text-zinc-700">({usNews.length})</span>
                </div>
                <FilterChips filters={US_FILTERS} active={usFilter} onSelect={setUsFilter} />
              </div>
            )}
          </div>

          {/* Article list */}
          <div className="flex-1 overflow-y-auto p-3 space-y-2">
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
              <div className="py-10 text-center space-y-2">
                <div className="text-2xl opacity-30">🗞️</div>
                <p className="text-zinc-600 text-xs">No articles match this filter</p>
              </div>
            )}
          </div>
        </div>

        {/* Mobile: Article view */}
        <div className={`flex-col h-full overflow-y-auto ${mobileView === 'article' ? 'flex' : 'hidden'}`}>
          {selected ? (
            <div className="p-4">
              <ArticleReader
                article={selected}
                analysis={analysis}
                loading={analysisLoading}
                onBack={handleBack}
              />
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
