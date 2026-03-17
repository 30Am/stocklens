import type { SentimentType } from '../../types';

const cls: Record<string, string> = {
  POS: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/25',
  NEG: 'bg-red-500/15 text-red-400 border-red-500/25',
  NEU: 'bg-zinc-500/15 text-zinc-400 border-zinc-500/25',
};

export function SentimentBadge({ sentiment }: { sentiment?: SentimentType | null }) {
  const key = sentiment ?? 'NEU';
  return (
    <span className={`inline-flex items-center rounded text-[10px] px-1.5 py-0.5 font-bold border tracking-wider ${cls[key] ?? cls.NEU}`}>
      {key}
    </span>
  );
}
