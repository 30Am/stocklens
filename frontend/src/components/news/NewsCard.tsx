import { SentimentBadge } from '../common/SentimentBadge';
import type { NewsArticle } from '../../types';

function timeAgo(iso: string | null): string {
  if (!iso) return '';
  const diff = Date.now() - new Date(iso).getTime();
  const h = Math.floor(diff / 3_600_000);
  if (h < 1) return `${Math.floor(diff / 60000)} min`;
  if (h < 24) return `${h} hr${h > 1 ? 's' : ''}`;
  return `${Math.floor(h / 24)}d`;
}

export function NewsCard({ article }: { article: NewsArticle }) {
  return (
    <a
      href={article.url !== '#' ? article.url : undefined}
      target="_blank"
      rel="noopener noreferrer"
      className="card-hover p-4 flex items-start gap-3 animate-fade-in"
    >
      <div className="shrink-0 mt-0.5">
        <SentimentBadge sentiment={article.sentiment} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm text-zinc-100 leading-snug mb-2 line-clamp-2">{article.headline}</p>
        <div className="flex items-center gap-2 flex-wrap">
          {(article.tickers ?? []).slice(0, 4).map((t) => (
            <span key={t} className="text-[10px] px-1.5 py-0.5 bg-amber-500/10 border border-amber-500/20 rounded text-amber-400 font-mono">
              {t}
            </span>
          ))}
          <span className="text-[10px] text-zinc-600 ml-auto shrink-0">
            {article.source && <span className="mr-1.5">{article.source} ·</span>}
            {timeAgo(article.published)}
          </span>
        </div>
      </div>
    </a>
  );
}
