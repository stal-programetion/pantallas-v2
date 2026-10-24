export type SlaStatus = 'optimo' | 'alerta' | 'critico';

export interface StatusTheme {
  label: string;
  hex: string;
  text: string;
  soft: string; // fondo suave
  ring: string; // borde suave
  dot: string;
}

export const STATUS_THEME: Record<SlaStatus, StatusTheme> = {
  optimo: {
    label: 'Óptimo',
    hex: '#10b981',
    text: 'text-emerald-700',
    soft: 'bg-emerald-50',
    ring: 'border-emerald-200',
    dot: 'bg-emerald-500',
  },
  alerta: {
    label: 'En riesgo',
    hex: '#f59e0b',
    text: 'text-amber-700',
    soft: 'bg-amber-50',
    ring: 'border-amber-200',
    dot: 'bg-amber-500',
  },
  critico: {
    label: 'Crítico',
    hex: '#ef4444',
    text: 'text-rose-700',
    soft: 'bg-rose-50',
    ring: 'border-rose-200',
    dot: 'bg-rose-500',
  },
};
