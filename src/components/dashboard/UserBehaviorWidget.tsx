import React from 'react';
import { CreditCard, FileText, Flame, Users } from 'lucide-react';
import { TooltipWhy } from '../common/TooltipWhy';
import { useAppStore } from '../../store/useAppStore';

const COLORS = ['bg-blue-600', 'bg-orange-500', 'bg-emerald-600', 'bg-slate-400'];
const ICONS = [CreditCard, FileText, Flame, Users];

export const UserBehaviorWidget: React.FC<{ bare?: boolean }> = ({ bare = false }) => {
  const { userBehavior } = useAppStore();

  const tramites = (userBehavior?.tramites || []).map((t, idx) => ({
    nombre: t.nombre,
    porcentaje: t.porcentaje,
    color: COLORS[idx % COLORS.length],
    icon: ICONS[idx % ICONS.length],
    tiempoMedio: `${t.tiempoMedioMin.toFixed(1)} min`,
  }));

  const picoMatutino = userBehavior?.picoMatutino || '08:00 - 10:30';
  const tasaAbandono = userBehavior?.tasaAbandonoPorcentaje ?? 7.0;
  const metaAbandono = userBehavior?.metaAbandonoPorcentaje ?? 3.0;

  return (
    <div className={bare ? 'flex flex-col justify-between' : 'bg-white rounded-2xl border border-slate-200 p-5 flex flex-col justify-between'}>
      <div>
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div>
            <h4 className="font-bold text-slate-900 text-sm">Comportamiento de Usuarios</h4>
            <span className="text-[11px] text-slate-500">
              Distribución por tipo de trámite y duración media
            </span>
          </div>

          <TooltipWhy
            explanation="La mezcla de trámites impacta el tiempo de servicio (μ). En la aproximación analítica Erlang C/A se consolida la mezcla observada por sede y franja en Digiturno."
            rule="Teoría de Colas Multitasa"
            align="right"
          />
        </div>

        <div className="mt-4 space-y-3.5">
          {tramites.map((t) => {
            const Icon = t.icon;
            return (
              <div key={t.nombre} className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <Icon size={14} className="text-slate-500 shrink-0" />
                    <span className="font-semibold text-slate-700 truncate max-w-[260px]">
                      {t.nombre}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 font-mono">
                    <span className="text-[11px] text-slate-400">{t.tiempoMedio}</span>
                    <span className="font-bold text-slate-900">{t.porcentaje}%</span>
                  </div>
                </div>

                <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                  <div
                    className={`${t.color} h-full rounded-full transition-all duration-500`}
                    style={{ width: `${t.porcentaje}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="mt-5 pt-3.5 border-t border-slate-100 grid grid-cols-2 gap-2 text-center">
        <div className="p-2 rounded-lg bg-blue-50/60 border border-blue-100">
          <span className="text-[10px] text-blue-700 font-semibold block uppercase tracking-wider">
            Pico Matutino
          </span>
          <span className="text-xs font-bold text-slate-900 mt-0.5 block">{picoMatutino}</span>
        </div>
        <div className="p-2 rounded-lg bg-orange-50/60 border border-orange-100">
          <span className="text-[10px] text-orange-700 font-semibold block uppercase tracking-wider">
            Tasa de Abandono
          </span>
          <span className="text-xs font-bold text-slate-900 mt-0.5 block">
            {tasaAbandono}% (Meta &lt;{metaAbandono}%)
          </span>
        </div>
      </div>
    </div>
  );
};
