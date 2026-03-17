import { SentimentBadge } from '../common/SentimentBadge';
import type { NewsArticle } from '../../types';

function timeAgo(iso: string | null): string {
  if (!iso) return '';
  const diff = Date.now() - new Date(iso).getTime();
  const h = Math.floor(diff / 3_600_000);
  if (h < 1) return `${Math.floor(diff / 60000)}m`;
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}

interface Props {
  article: NewsArticle;
  selected?: boolean;
  onClick: (article: NewsArticle) => void;
}

export function NewsCard({ article, selected = false, onClick }: Props) {
  return (
    <button
      onClick={() => onClick(article)}
      className={`w-full text-left p-3 rounded-xl border transition-all duration-150 animate-fade-in ${
        selected
          ? 'bg-violet-500/10 border-violet-500/40 shadow-sm'
          : 'bg-surface-1 border-border hover:bg-surface-2 hover:border-zinc-600'
      }`}
    >
      <div className="flex items-start gap-2.5">
        <div className="shrink-0 mt-0.5">
          <SentimentBadge sentiment={article.sentiment} />
        </div>
        <div className="flex-1 min-w-0">
          <p className={`text-xs leading-snug mb-1.5 line-clamp-2 ${selected ? 'text-white font-medium' : 'text-zinc-200'}`}>
            {article.headline}
          </p>
          <div className="flex items-center gap-1.5 flex-wrap">
            {(article.tickers ?? []).slice(0, 3).map((t) => (
              <span key={t} className="text-[9px] px-1 py-0.5 bg-amber-500/10 border border-amber-500/20 rounded text-amber-400 font-mono">
                {t.replace('.NS','').replace('.BO','')}
              </span>
            ))}
            <span className="text-[9px] text-zinc-600 ml-auto shrink-0">
              {article.source && <span className="mr-1">{article.source} ·</span>}
              {timeAgo(article.published)}
            </span>
          </div>
        </div>
      </div>
    </button>
  );
}
