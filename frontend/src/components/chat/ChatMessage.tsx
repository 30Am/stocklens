interface Props {
  role: 'user' | 'assistant';
  text: string;
  tickers?: string[];
}

/** Render a small subset of markdown: **bold**, bullet lines, and line breaks. */
function MarkdownText({ text }: { text: string }) {
  const lines = text.split('\n');

  return (
    <span className="space-y-0.5 block">
      {lines.map((line, li) => {
        if (!line.trim()) return <br key={li} />;

        // Detect bullet line (starts with - or •)
        const isBullet = /^[\-•]\s/.test(line.trim());
        const content = isBullet ? line.replace(/^[\-•]\s*/, '') : line;

        // Split on **bold** markers
        const parts = content.split(/(\*\*[^*]+\*\*)/g);
        const rendered = parts.map((part, pi) => {
          if (part.startsWith('**') && part.endsWith('**')) {
            return <strong key={pi} className="text-white font-semibold">{part.slice(2, -2)}</strong>;
          }
          return <span key={pi}>{part}</span>;
        });

        if (isBullet) {
          return (
            <div key={li} className="flex gap-1.5 items-start">
              <span className="text-violet-400 mt-0.5 shrink-0">•</span>
              <span>{rendered}</span>
            </div>
          );
        }

        // Heading lines (## or starts with uppercase word + colon)
        if (line.startsWith('## ')) {
          return (
            <div key={li} className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider mt-1.5 mb-0.5">
              {line.replace('## ', '')}
            </div>
          );
        }

        return <div key={li}>{rendered}</div>;
      })}
    </span>
  );
}

export function ChatMessage({ role, text, tickers }: Props) {
  const isUser = role === 'user';
  return (
    <div className={`flex gap-2 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
      {/* Avatar */}
      <div className={`w-6 h-6 rounded-full shrink-0 flex items-center justify-center text-xs font-bold mt-0.5 ${
        isUser ? 'bg-blue-600 text-white' : 'bg-violet-600/30 text-violet-300 border border-violet-500/30'
      }`}>
        {isUser ? 'U' : '🤖'}
      </div>

      {/* Bubble */}
      <div className={`max-w-[85%] ${isUser ? 'items-end' : 'items-start'} flex flex-col gap-1`}>
        <div className={`px-3 py-2 rounded-xl text-sm leading-relaxed ${
          isUser
            ? 'bg-blue-600/20 border border-blue-500/20 text-blue-100 rounded-tr-none'
            : 'bg-surface-2 border border-border text-zinc-300 rounded-tl-none'
        }`}>
          {isUser ? text : <MarkdownText text={text} />}
        </div>
        {!isUser && tickers && tickers.length > 0 && (
          <div className="flex flex-wrap gap-1 px-1">
            {tickers.map((t) => (
              <span key={t} className="text-[10px] px-1.5 py-0.5 bg-amber-500/10 border border-amber-500/20 rounded text-amber-400 font-mono">
                {t}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
