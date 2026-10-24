import React from 'react';
import { Users, Clock, UserCheck, ChevronRight } from 'lucide-react';
import { Office, OfficeRealtimeMetrics } from '../../types';
import { SlaRing } from '../common/SlaRing';
import { STATUS_THEME } from '../common/statusTheme';

interface OfficeCardProps {
  office: Office;
  metrics?: OfficeRealtimeMetrics;
  variant?: 'card' | 'row';
  selected?: boolean;
  onSelect: (officeId: string) => void;
}

export const OfficeCard: React.FC<OfficeCardProps> = ({
  office,
  metrics,
  variant = 'card',
  selected = false,
  onSelect,
}) => {
  const status = metrics?.estadoSla ?? 'optimo';
  const theme = STATUS_THEME[status];
  const sla = metrics ? Math.round(metrics.slaActual * 100) : 80;
  const wait = metrics ? Math.round(metrics.esperaPromedioMin) : 0;
  const queue = metrics?.clientesEnFila ?? 0;
  const agents = metrics?.agentesActivos ?? office.capacidadPuestos;
  const needed = metrics?.agentesRequeridos ?? office.capacidadPuestos;
  const coverage = needed > 0 ? Math.min(100, Math.round((agents / needed) * 100)) : 100;
  const understaffed = agents < needed;

  if (variant === 'row') {
    return (
      <button
        onClick={() => onSelect(office.id)}
        aria-label={`Ver ${office.nombre}`}
        className={`group w-full grid grid-cols-[1fr_auto] md:grid-cols-[2fr_1fr_1fr_1fr_1fr_auto] items-center gap-4 px-4 py-3 text-left border-b border-slate-100 last:border-0 transition-colors hover:bg-slate-50 ${
          selected ? 'bg-blue-50/60' : ''
        }`}
      >
        <div className="flex items-center gap-3 min-w-0">
          <span className={`w-2 h-2 rounded-full shrink-0 ${theme.dot} ${status === 'critico' ? 'anim-soft-pulse' : ''}`} />
          <div className="min-w-0">
            <div className="text-sm font-semibold text-slate-900 truncate">{office.nombre}</div>
            <div className="text-xs text-slate-500 truncate">
              {office.ciudad}, {office.departamento}
            </div>
          </div>
        </div>
        <div className="hidden md:block">
          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${theme.soft} ${theme.text}`}>
            {theme.label} · {sla}%
          </span>
        </div>
        <div className="hidden md:block text-sm tabular-nums text-slate-700">{queue} en fila</div>
        <div className="hidden md:block text-sm tabular-nums text-slate-700">{wait} min</div>
        <div className={`hidden md:block text-sm tabular-nums ${understaffed ? 'text-rose-600 font-medium' : 'text-slate-700'}`}>
          {agents}/{needed} agentes
        </div>
        <ChevronRight size={16} className="text-slate-300 group-hover:text-slate-500 group-hover:translate-x-0.5 transition-all" />
      </button>
    );
  }

  return (
    <button
      onClick={() => onSelect(office.id)}
      aria-label={`Ver ${office.nombre}`}
      className={`group relative text-left bg-white rounded-2xl border p-4 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-slate-200/70 ${
        selected ? 'border-blue-400 ring-2 ring-blue-100' : 'border-slate-200 hover:border-slate-300'
      }`}
    >
      {status === 'critico' && (
        <span className="absolute top-3 right-3 w-2 h-2 rounded-full bg-rose-500 anim-soft-pulse" aria-hidden="true" />
      )}

      <div className="flex items-center gap-3">
        <SlaRing value={sla} status={status} size={52} />
        <div className="min-w-0 flex-1">
          <h4 className="font-semibold text-slate-900 text-sm truncate group-hover:text-blue-700 transition-colors">
            {office.nombre}
          </h4>
          <p className="text-xs text-slate-500 truncate">
            {office.ciudad}, {office.departamento}
          </p>
          <span className={`mt-1 inline-block text-[11px] font-medium ${theme.text}`}>{theme.label}</span>
        </div>
      </div>

      <dl className="mt-4 flex items-center justify-between text-sm">
        <div className="flex items-center gap-1.5" title="Clientes en fila">
          <Users size={14} className="text-slate-400" />
          <dt className="sr-only">En fila</dt>
          <dd className="font-semibold tabular-nums text-slate-800">{queue}</dd>
        </div>
        <div className="flex items-center gap-1.5" title="Espera promedio">
          <Clock size={14} className="text-slate-400" />
          <dt className="sr-only">Espera</dt>
          <dd className="font-semibold tabular-nums text-slate-800">{wait} min</dd>
        </div>
        <div className="flex items-center gap-1.5" title="Agentes activos / requeridos">
          <UserCheck size={14} className={understaffed ? 'text-rose-500' : 'text-slate-400'} />
          <dt className="sr-only">Agentes</dt>
          <dd className={`font-semibold tabular-nums ${understaffed ? 'text-rose-600' : 'text-slate-800'}`}>
            {agents}/{needed}
          </dd>
        </div>
      </dl>

      <div className="mt-3 h-1 rounded-full bg-slate-100 overflow-hidden" aria-hidden="true">
        <div
          className="h-full rounded-full transition-[width] duration-500"
          style={{ width: `${coverage}%`, backgroundColor: understaffed ? '#f59e0b' : '#10b981' }}
        />
      </div>
    </button>
  );
};
