interface Props {
  ticker: string;
  reason: string | null;
}

export function AIExplanation({ ticker, reason }: Props) {
  return (
    <div className="card border-violet-500/20 bg-violet-500/5 p-4">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-base">🤖</span>
        <h3 className="text-sm font-semibold text-violet-300">
          Why is {ticker.replace('.NS', '').replace('.BO', '')} moving today?
        </h3>
      </div>
      <p className="text-sm text-zinc-300 leading-relaxed">
        {reason ?? 'No AI explanation available yet. Run the NLP pipeline to generate insights.'}
      </p>
    </div>
  );
}
