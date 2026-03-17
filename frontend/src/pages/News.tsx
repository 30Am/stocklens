import { useEffect, useState } from 'react';
import { NewsCard } from '../components/news/NewsCard';
import { useMarket } from '../context/MarketContext';
import { getNews } from '../api/client';
import { MOCK_NEWS } from '../api/mock';
import type { NewsArticle } from '../types';

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

function FilterChips<F extends string>({ filters, active, onSelect }: { filters: readonly F[]; active: F; onSelect: (f: F) => void }) {
  return (
    <div className="flex gap-1.5 flex-wrap mb-4">
      {filters.map((f) => (
        <button
          key={f}
          onClick={() => onSelect(f)}
          className={`px-3 py-1 rounded-full text-xs font-medium border transition-all ${
            active === f
              ? 'bg-zinc-700 text-white border-zinc-600'
              : 'text-zinc-400 border-border hover:border-zinc-600 hover:text-white'
          }`}
        >
          {f}
        </button>
      ))}
    </div>
  );
}

export function News() {
  const { market } = useMarket();
  const [allNews, setAllNews] = useState<NewsArticle[]>(MOCK_NEWS);
  const [inFilter, setInFilter] = useState<InFilter>('All');
  const [usFilter, setUsFilter] = useState<UsFilter>('All');

  useEffect(() => {
    getNews(undefined, 100)
      .then((data: unknown) => { if (Array.isArray(data) && data.length > 0) setAllNews(data as NewsArticle[]); })
      .catch(() => { /* use mock */ });
  }, []);

  const inNews = filterArticles(allNews.filter((a) => a.market === 'IN'), inFilter, IN_KEYWORDS);
  const usNews = filterArticles(allNews.filter((a) => a.market === 'US'), usFilter, US_KEYWORDS);

  const showIn = market === 'IN' || market === 'BOTH';
  const showUs = market === 'US' || market === 'BOTH';

  return (
    <div className="flex-1 max-w-[1600px] w-full mx-auto px-4 py-4">
      <div className={`grid gap-6 ${showIn && showUs ? 'grid-cols-1 lg:grid-cols-2' : 'grid-cols-1'}`}>
        {/* Indian news */}
        {showIn && (
          <div>
            <h2 className="flex items-center gap-2 text-sm font-semibold text-amber-400 mb-4">
              🇮🇳 Indian Market News
            </h2>
            <FilterChips filters={IN_FILTERS} active={inFilter} onSelect={setInFilter} />
            <div className="space-y-2">
              {inNews.length > 0
                ? inNews.map((a, i) => <NewsCard key={a.id ?? i} article={a} />)
                : <p className="text-zinc-600 text-sm py-4">No articles match this filter.</p>
              }
            </div>
          </div>
        )}

        {/* US news */}
        {showUs && (
          <div>
            <h2 className="flex items-center gap-2 text-sm font-semibold text-blue-400 mb-4">
              🇺🇸 US Market News
            </h2>
            <FilterChips filters={US_FILTERS} active={usFilter} onSelect={setUsFilter} />
            <div className="space-y-2">
              {usNews.length > 0
                ? usNews.map((a, i) => <NewsCard key={a.id ?? i} article={a} />)
                : <p className="text-zinc-600 text-sm py-4">No articles match this filter.</p>
              }
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
