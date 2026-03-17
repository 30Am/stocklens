import { SentimentBadge } from '../common/SentimentBadge';
import type { NewsArticle } from '../../types';

function timeAgo(iso: string | null): string {
  if (!iso) return '';
  const diff = Date.now() - new Date(iso).getTime();
  const h = Math.floor(diff / 3_600_000);
  if (h < 1) return `${Math.floor(diff / 60000)} min ago`;
  if (h < 24) return `${h} hr${h > 1 ? 's' : ''} ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export function RelatedNews({ articles }: { articles: NewsArticle[] }) {
  if (articles.length === 0) return null;

  return (
    <div className="card p-4">
      <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-3">Related News</h3>
      <div className="space-y-0">
        {articles.map((a, i) => (
          <a
            key={a.id ?? i}
            href={a.url !== '#' ? a.url : undefined}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-start gap-3 py-3 border-b border-border last:border-0 hover:bg-surface-2 -mx-4 px-4 transition-colors cursor-pointer"
          >
            <div className="shrink-0 mt-0.5">
              <SentimentBadge sentiment={a.sentiment} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm text-zinc-200 leading-snug mb-1.5 line-clamp-2">{a.headline}</p>
              <div className="flex items-center gap-2 flex-wrap">
                {(a.tickers ?? []).slice(0, 3).map((t) => (
                  <span key={t} className="text-[10px] px-1.5 py-0.5 bg-amber-500/10 border border-amber-500/20 rounded text-amber-400 font-mono">
                    {t}
                  </span>
                ))}
                <span className="text-[10px] text-zinc-600 ml-auto">
                  {a.source && <span className="mr-2 text-zinc-500">{a.source}</span>}
                  {timeAgo(a.published)}
                </span>
              </div>
            </div>
          </a>
        ))}
      </div>
    </div>
  );
}
