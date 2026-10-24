import React from 'react';
import { CheckCircle2, AlertTriangle, AlertOctagon } from 'lucide-react';

interface TrafficLightProps {
  status: 'optimo' | 'alerta' | 'critico';
  value?: string | number;
  label?: string;
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
  className?: string;
}

export const TrafficLight: React.FC<TrafficLightProps> = ({
  status,
  value,
  label,
  size = 'md',
  showLabel = true,
  className = '',
}) => {
  const config = {
    optimo: {
      color: 'text-emerald-700 bg-emerald-50 border-emerald-300',
      dotColor: 'bg-emerald-500',
      icon: CheckCircle2,
      defaultText: 'Óptimo',
      ariaLabel: 'Estado óptimo: cumple con el nivel de servicio objetivo',
    },
    alerta: {
      color: 'text-amber-800 bg-amber-50 border-amber-300',
      dotColor: 'bg-amber-500',
      icon: AlertTriangle,
      defaultText: 'En Riesgo',
      ariaLabel: 'Estado de alerta: nivel de servicio en riesgo de incumplimiento',
    },
    critico: {
      color: 'text-rose-800 bg-rose-50 border-rose-300',
      dotColor: 'bg-rose-500',
      icon: AlertOctagon,
      defaultText: 'Crítico',
      ariaLabel: 'Estado crítico: nivel de servicio por debajo del umbral mínimo',
    },
  };

  const current = config[status] || config.optimo;
  const Icon = current.icon;

  const sizeClasses = {
    sm: 'text-xs px-2 py-0.5 gap-1.5',
    md: 'text-sm px-2.5 py-1 gap-2',
    lg: 'text-base px-3.5 py-1.5 gap-2.5',
  };

  const iconSizes = {
    sm: 13,
    md: 16,
    lg: 19,
  };

  const textToDisplay = label || (value !== undefined ? `${value}%` : current.defaultText);

  return (
    <div
      role="status"
      aria-label={current.ariaLabel}
      className={`inline-flex items-center font-medium rounded-full border shadow-2xs transition-colors duration-200 ${current.color} ${sizeClasses[size]} ${className}`}
    >
      <Icon size={iconSizes[size]} aria-hidden="true" className="shrink-0" />
      {showLabel && (
        <span className="font-semibold tracking-tight">
          {textToDisplay}
        </span>
      )}
    </div>
  );
};
