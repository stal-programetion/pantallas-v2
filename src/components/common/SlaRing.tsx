import React from 'react';
import { STATUS_THEME, SlaStatus } from './statusTheme';

interface SlaRingProps {
  value: number; // 0-100
  status: SlaStatus;
  size?: number;
  stroke?: number;
  showLabel?: boolean;
}

/** Anillo de progreso para el SLA: se lee de un vistazo y anima al cambiar. */
export const SlaRing: React.FC<SlaRingProps> = ({
  value,
  status,
  size = 48,
  stroke = 5,
  showLabel = true,
}) => {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const clamped = Math.max(0, Math.min(100, value));
  const theme = STATUS_THEME[status];

  return (
    <div
      className="relative shrink-0"
      style={{ width: size, height: size }}
      role="img"
      aria-label={`SLA ${clamped}% — ${theme.label}`}
    >
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#e8edf4" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={theme.hex}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c - (clamped / 100) * c}
          style={{ transition: 'stroke-dashoffset 600ms cubic-bezier(0.22,1,0.36,1), stroke 300ms' }}
        />
      </svg>
      {showLabel && (
        <span
          className="absolute inset-0 flex items-center justify-center font-bold tabular-nums text-slate-900"
          style={{ fontSize: Math.max(10, size * 0.27) }}
        >
          {clamped}
          <span className="text-slate-400 font-semibold" style={{ fontSize: Math.max(8, size * 0.18) }}>
            %
          </span>
        </span>
      )}
    </div>
  );
};
