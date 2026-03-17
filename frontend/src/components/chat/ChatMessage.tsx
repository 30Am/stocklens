interface Props {
  role: 'user' | 'assistant';
  text: string;
  tickers?: string[];
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
      <div className={`max-w-[80%] ${isUser ? 'items-end' : 'items-start'} flex flex-col gap-1`}>
        <div className={`px-3 py-2 rounded-xl text-sm leading-relaxed ${
          isUser
            ? 'bg-blue-600/20 border border-blue-500/20 text-blue-100 rounded-tr-none'
            : 'bg-surface-2 border border-border text-zinc-200 rounded-tl-none'
        }`}>
          {text}
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
