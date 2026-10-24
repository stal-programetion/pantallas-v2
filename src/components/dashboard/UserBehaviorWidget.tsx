import React from 'react';
import { CreditCard, FileText, Flame, Users, Zap, Award } from 'lucide-react';
import { TooltipWhy } from '../common/TooltipWhy';

export const UserBehaviorWidget: React.FC<{ bare?: boolean }> = ({ bare = false }) => {
  const tramites = [
    {
      nombre: 'Facturación y Acuerdos de Pago',
      porcentaje: 47,
      color: 'bg-blue-600',
      icon: CreditCard,
      tiempoMedio: '6.5 min',
    },
    {
      nombre: 'Peticiones, Quejas y Reclamos (PQR)',
      porcentaje: 28,
      color: 'bg-orange-500',
      icon: FileText,
      tiempoMedio: '11.0 min',
    },
    {
      nombre: 'Financiación Brilla & Conexiones',
      porcentaje: 19,
      color: 'bg-emerald-600',
      icon: Flame,
      tiempoMedio: '13.5 min',
    },
    {
      nombre: 'Otros y Duplicados',
      porcentaje: 6,
      color: 'bg-slate-400',
      icon: Users,
      tiempoMedio: '4.0 min',
    },
  ];

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
            explanation="La mezcla de trámites impacta el tiempo de servicio (mu). En quincena, Facturación y Acuerdos de Pago domina el 47% de los turnos, lo que agiliza la atención media a 7.8 minutos por usuario."
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
          <span className="text-xs font-bold text-slate-900 mt-0.5 block">09:30 - 11:30</span>
        </div>
        <div className="p-2 rounded-lg bg-orange-50/60 border border-orange-100">
          <span className="text-[10px] text-orange-700 font-semibold block uppercase tracking-wider">
            Tasa de Abandono
          </span>
          <span className="text-xs font-bold text-slate-900 mt-0.5 block">1.3% (Meta &lt;3%)</span>
        </div>
      </div>
    </div>
  );
};
