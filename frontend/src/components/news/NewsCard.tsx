import { SentimentBadge } from '../common/SentimentBadge';
import type { NewsArticle } from '../../types';

function timeAgo(iso: string | null): string {
  if (!iso) return '';
  const diff = Date.now() - new Date(iso).getTime();
  const h = Math.floor(diff / 3_600_000);
  if (h < 1) return `${Math.floor(diff / 60000)}m ago`;
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

const marketDot: Record<string, string> = {
  IN: 'bg-amber-400',
  US: 'bg-blue-400',
};

interface Props {
  article: NewsArticle;
  selected?: boolean;
  onClick: (article: NewsArticle) => void;
}

export function NewsCard({ article, selected = false, onClick }: Props) {
  return (
    <button
      onClick={() => onClick(article)}
      className={`group w-full text-left rounded-xl border transition-all duration-200 ${
        selected
          ? 'bg-violet-500/10 border-violet-500/40 shadow-lg shadow-violet-500/5'
          : 'bg-surface-1 border-border hover:bg-surface-2 hover:border-zinc-600 hover:shadow-md hover:shadow-black/20'
      }`}
    >
      <div className="p-3">
        {/* Top row: source + time + market dot */}
        <div className="flex items-center gap-1.5 mb-2">
          {article.market && (
            <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${marketDot[article.market] ?? 'bg-zinc-500'}`} />
          )}
          {article.source && (
            <span className="text-[10px] text-zinc-500 font-medium truncate">{article.source}</span>
          )}
          <span className="text-[10px] text-zinc-700 ml-auto shrink-0">{timeAgo(article.published)}</span>
        </div>

        {/* Headline */}
        <p className={`text-xs leading-snug mb-2.5 line-clamp-2 transition-colors ${
          selected ? 'text-white font-medium' : 'text-zinc-200 group-hover:text-white'
        }`}>
          {article.headline}
        </p>

        {/* Bottom row: sentiment + tickers */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <SentimentBadge sentiment={article.sentiment} />
          {(article.tickers ?? []).slice(0, 3).map((t) => (
            <span
              key={t}
              className="text-[9px] px-1.5 py-0.5 bg-amber-500/10 border border-amber-500/20 rounded-md text-amber-400 font-mono"
            >
              {t.replace('.NS', '').replace('.BO', '')}
            </span>
          ))}
          {(article.tickers ?? []).length > 3 && (
            <span className="text-[9px] text-zinc-600">+{(article.tickers ?? []).length - 3}</span>
          )}
        </div>
      </div>

      {/* Selected indicator bar */}
      {selected && (
        <div className="h-0.5 w-full bg-gradient-to-r from-violet-500 to-purple-500 rounded-b-xl" />
      )}
    </button>
  );
}
