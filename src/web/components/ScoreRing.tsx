import type { DecisionStatus } from '../../core/types.js';

export function ScoreRing({
  value,
  status,
  label,
  size = 148,
}: {
  value: number;
  status: DecisionStatus;
  label: string;
  size?: number;
}) {
  const stroke = 10;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.max(0, Math.min(1, value));
  const offset = circumference * (1 - clamped);
  const tone =
    status === 'pass' ? 'pass' : status === 'retry' ? 'retry' : status === 'redo' ? 'redo' : 'provisional';

  return (
    <div className={`score-ring tone-${tone}`} style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={`${label}: ${Math.round(clamped * 100)}%`}>
        <circle className="ring-track" cx={size / 2} cy={size / 2} r={radius} strokeWidth={stroke} fill="none" />
        <circle
          className="ring-value"
          cx={size / 2}
          cy={size / 2}
          r={radius}
          strokeWidth={stroke}
          fill="none"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          strokeLinecap="round"
        />
      </svg>
      <div className="ring-center">
        <strong>{Math.round(clamped * 100)}</strong>
        <span>{label}</span>
      </div>
    </div>
  );
}
