import type { SignalType } from '../../types';

interface Props {
  signal: SignalType;
  size?: 'sm' | 'md' | 'lg';
}

const cls: Record<SignalType, string> = {
  BUY: 'badge-buy',
  SELL: 'badge-sell',
  HOLD: 'badge-hold',
};

const sizes = {
  sm: 'text-[10px] px-1.5 py-0.5',
  md: '',
  lg: 'text-sm px-3 py-1',
};

export function SignalBadge({ signal, size = 'md' }: Props) {
  return (
    <span className={`${cls[signal]} ${sizes[size]}`}>
      {signal}
    </span>
  );
}
