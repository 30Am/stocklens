interface Props {
  positive: boolean;
  height?: number;
  bars?: number;
}

// Deterministic pseudo-random based on seed so SSR/hydration matches
function pseudoRandom(seed: number): number {
  const x = Math.sin(seed + 1) * 10000;
  return x - Math.floor(x);
}

export function MiniBarChart({ positive, height = 32, bars = 8 }: Props) {
  const color = positive ? '#22c55e' : '#ef4444';
  const values = Array.from({ length: bars }, (_, i) => 0.25 + pseudoRandom(i * 37) * 0.65);
  const max = Math.max(...values);

  return (
    <svg width="100%" height={height} viewBox={`0 0 ${bars * 7} ${height}`} preserveAspectRatio="none">
      {values.map((v, i) => {
        const barH = Math.max(2, (v / max) * height);
        return (
          <rect
            key={i}
            x={i * 7}
            y={height - barH}
            width={5}
            height={barH}
            rx={1}
            fill={color}
            opacity={0.75 + (i / bars) * 0.25}
          />
        );
      })}
    </svg>
  );
}
