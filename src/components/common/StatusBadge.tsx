import React from 'react';
import {
  Briefcase,
  Coffee,
  UserX,
  Laptop,
  CheckCircle,
  Clock,
  Building,
} from 'lucide-react';
import { SlotStatus, WorkModality } from '../../types';

interface StatusBadgeProps {
  status: SlotStatus | WorkModality | 'activa' | 'finalizada' | 'programada' | 'abierta' | 'cerrada';
  label?: string;
  size?: 'sm' | 'md';
  className?: string;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({
  status,
  label,
  size = 'md',
  className = '',
}) => {
  const configs: Record<
    string,
    { text: string; bg: string; textCol: string; border: string; icon: React.ElementType }
  > = {
    // Turnos
    atencion: {
      text: 'Atención Presencial',
      bg: 'bg-blue-50',
      textCol: 'text-blue-700',
      border: 'border-blue-200',
      icon: Briefcase,
    },
    almuerzo: {
      text: 'Almuerzo',
      bg: 'bg-amber-50',
      textCol: 'text-amber-700',
      border: 'border-amber-200',
      icon: Coffee,
    },
    pausa: {
      text: 'Pausa Activa',
      bg: 'bg-teal-50',
      textCol: 'text-teal-700',
      border: 'border-teal-200',
      icon: Clock,
    },
    libre: {
      text: 'Libre / Fuera de Turno',
      bg: 'bg-slate-50',
      textCol: 'text-slate-500',
      border: 'border-slate-200',
      icon: Clock,
    },
    ausente: {
      text: 'Ausencia Justificada',
      bg: 'bg-rose-50',
      textCol: 'text-rose-700',
      border: 'border-rose-200',
      icon: UserX,
    },
    apoyo_virtual: {
      text: 'Apoyo Virtual Remoto',
      bg: 'bg-purple-50',
      textCol: 'text-purple-700',
      border: 'border-purple-200',
      icon: Laptop,
    },
    apoyo_presencial: {
      text: 'Apoyo Presencial Traslado',
      bg: 'bg-indigo-50',
      textCol: 'text-indigo-700',
      border: 'border-indigo-200',
      icon: Building,
    },

    // Modalidad
    presencial: {
      text: 'Presencial',
      bg: 'bg-sky-50',
      textCol: 'text-sky-700',
      border: 'border-sky-200',
      icon: Building,
    },
    virtual: {
      text: 'Virtual',
      bg: 'bg-violet-50',
      textCol: 'text-violet-700',
      border: 'border-violet-200',
      icon: Laptop,
    },

    // Ausencias estados
    activa: {
      text: 'Activa Hoy',
      bg: 'bg-rose-50',
      textCol: 'text-rose-700',
      border: 'border-rose-200',
      icon: UserX,
    },
    programada: {
      text: 'Programada',
      bg: 'bg-amber-50',
      textCol: 'text-amber-700',
      border: 'border-amber-200',
      icon: Clock,
    },
    finalizada: {
      text: 'Finalizada',
      bg: 'bg-emerald-50',
      textCol: 'text-emerald-700',
      border: 'border-emerald-200',
      icon: CheckCircle,
    },

    // Oficinas
    abierta: {
      text: 'Abierta',
      bg: 'bg-emerald-50',
      textCol: 'text-emerald-700',
      border: 'border-emerald-200',
      icon: CheckCircle,
    },
    cerrada: {
      text: 'Cerrada',
      bg: 'bg-slate-100',
      textCol: 'text-slate-600',
      border: 'border-slate-300',
      icon: Clock,
    },
  };

  const item = configs[status] || configs.atencion;
  const Icon = item.icon;

  const sizeClass = size === 'sm' ? 'text-[11px] px-2 py-0.5 gap-1' : 'text-xs px-2.5 py-1 gap-1.5';

  return (
    <span
      className={`inline-flex items-center font-medium rounded-md border ${item.bg} ${item.textCol} ${item.border} ${sizeClass} ${className}`}
    >
      <Icon size={size === 'sm' ? 12 : 14} className="shrink-0" />
      <span>{label || item.text}</span>
    </span>
  );
};
