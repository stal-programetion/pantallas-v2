import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  X,
  MapPin,
  Phone,
  Clock,
  Users,
  UserCheck,
  ArrowRight,
  Check,
  Monitor,
  Building2,
  ExternalLink,
} from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';
import { SlaRing } from '../common/SlaRing';
import { STATUS_THEME } from '../common/statusTheme';
import { AlertItem } from '../alerts/AlertItem';

interface OfficeDrawerProps {
  officeId: string | null;
  onClose: () => void;
}

/** Panel lateral: el detalle de una oficina sin salir del centro de control. */
export const OfficeDrawer: React.FC<OfficeDrawerProps> = ({ officeId, onClose }) => {
  const navigate = useNavigate();
  const { offices, liveMetrics, alerts, recommendations, acceptRedistribution, rejectRedistribution } =
    useAppStore();

  useEffect(() => {
    if (!officeId) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [officeId, onClose]);

  const office = offices.find((o) => o.id === officeId);
  if (!officeId || !office) return null;

  const metrics = liveMetrics.find((m) => m.oficinaId === office.id);
  const status = metrics?.estadoSla ?? 'optimo';
  const theme = STATUS_THEME[status];
  const sla = metrics ? Math.round(metrics.slaActual * 100) : 80;
  const officeAlerts = alerts.filter((a) => a.oficinaId === office.id);
  const officeRecs = recommendations.filter(
    (r) =>
      r.estado === 'pendiente' &&
      (r.oficinaDestinoId === office.id || r.oficinaOrigenId === office.id)
  );
  const agents = metrics?.agentesActivos ?? 0;
  const needed = metrics?.agentesRequeridos ?? office.capacidadPuestos;
  const gap = needed - agents;

  return (
    <div className="fixed inset-0 z-50 flex justify-end" role="dialog" aria-modal="true" aria-label={`Detalle de ${office.nombre}`}>
      <div className="absolute inset-0 bg-slate-900/35 backdrop-blur-[1px] anim-fade" onClick={onClose} />

      <aside className="relative w-full max-w-[440px] h-full bg-white shadow-2xl flex flex-col anim-slide-right">
        {/* Encabezado */}
        <div className="flex items-start justify-between gap-4 p-6 border-b border-slate-100">
          <div className="flex items-center gap-4 min-w-0">
            <SlaRing value={sla} status={status} size={64} stroke={6} />
            <div className="min-w-0">
              <h2 className="text-lg font-semibold text-slate-900 truncate">{office.nombre}</h2>
              <p className="text-sm text-slate-500 truncate">
                {office.ciudad}, {office.departamento}
              </p>
              <span className={`mt-1.5 inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium ${theme.soft} ${theme.text}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${theme.dot}`} />
                {theme.label}
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Cerrar panel"
            className="p-2 -mr-2 -mt-1 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Métricas */}
          <section className="grid grid-cols-3 gap-3">
            <Stat icon={Users} label="En fila" value={metrics?.clientesEnFila ?? 0} />
            <Stat icon={Clock} label="Espera" value={`${Math.round(metrics?.esperaPromedioMin ?? 0)} min`} />
            <Stat
              icon={UserCheck}
              label="Agentes"
              value={`${agents}/${needed}`}
              tone={gap > 0 ? 'bad' : 'ok'}
            />
          </section>

          {gap > 0 && (
            <p className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
              Faltan <strong>{gap}</strong> {gap === 1 ? 'agente' : 'agentes'} para cubrir la demanda de esta franja.
            </p>
          )}

          {/* Traslados sugeridos: acciones directas */}
          {officeRecs.length > 0 && (
            <section>
              <h3 className="text-sm font-semibold text-slate-900 mb-3">
                Traslados sugeridos <span className="text-slate-400 font-normal">({officeRecs.length})</span>
              </h3>
              <div className="space-y-3">
                {officeRecs.map((r) => {
                  const incoming = r.oficinaDestinoId === office.id;
                  return (
                    <div key={r.id} className="rounded-2xl border border-slate-200 p-4 space-y-3 anim-up">
                      <div className="flex items-start gap-3">
                        <span className="mt-0.5 w-8 h-8 rounded-lg bg-blue-50 text-blue-700 flex items-center justify-center shrink-0">
                          {r.modalidad === 'virtual' ? <Monitor size={16} /> : <Building2 size={16} />}
                        </span>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-slate-900">
                            {incoming ? 'Recibe apoyo de' : 'Presta apoyo a'}{' '}
                            {incoming ? r.oficinaOrigenNombre : r.oficinaDestinoNombre}
                          </p>
                          <p className="text-xs text-slate-500">
                            {r.colaboradorNombre} · {r.franjaInicio}–{r.franjaFin} · {r.modalidad}
                            {r.esIntermunicipal ? ` · ${r.distanciaKm} km` : ''}
                          </p>
                        </div>
                      </div>
                      <p className="text-xs text-slate-600">
                        Reduce la espera en <strong>{r.impactoEstimado.reduccionEsperaMin} min</strong>; el SLA proyectado
                        del destino sube a <strong>{Math.round(r.impactoEstimado.slaProyectadoDestino * 100)}%</strong>.
                      </p>
                      <div className="flex gap-2">
                        <button
                          onClick={() => acceptRedistribution(r.id)}
                          className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-[#1F2B6B] text-white text-sm font-medium hover:bg-[#161F52] active:scale-[0.98] transition-all"
                        >
                          <Check size={15} /> Aceptar
                        </button>
                        <button
                          onClick={() => rejectRedistribution(r.id)}
                          className="px-3 py-2 rounded-xl border border-slate-200 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors"
                        >
                          Descartar
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {/* Alertas de la oficina */}
          {officeAlerts.length > 0 && (
            <section>
              <h3 className="text-sm font-semibold text-slate-900 mb-3">
                Alertas activas <span className="text-slate-400 font-normal">({officeAlerts.length})</span>
              </h3>
              <div className="space-y-3">
                {officeAlerts.map((a) => (
                  <AlertItem key={a.id} alert={a} onCloseDrawer={onClose} />
                ))}
              </div>
            </section>
          )}

          {officeAlerts.length === 0 && officeRecs.length === 0 && (
            <div className="text-center py-6 rounded-2xl bg-slate-50 border border-dashed border-slate-200">
              <p className="text-sm font-medium text-slate-700">Sin alertas ni traslados pendientes</p>
              <p className="text-xs text-slate-500 mt-1">Esta oficina opera con normalidad.</p>
            </div>
          )}

          {/* Datos de contacto */}
          <section className="space-y-2.5 text-sm text-slate-600">
            <h3 className="text-sm font-semibold text-slate-900">Información</h3>
            <p className="flex items-start gap-2.5">
              <MapPin size={15} className="mt-0.5 text-slate-400 shrink-0" /> {office.direccion}
            </p>
            <p className="flex items-center gap-2.5">
              <Clock size={15} className="text-slate-400 shrink-0" />
              {office.horarioAtencion.inicio} – {office.horarioAtencion.fin}
            </p>
            <p className="flex items-center gap-2.5">
              <Phone size={15} className="text-slate-400 shrink-0" /> {office.telefono}
            </p>
          </section>
        </div>

        {/* Pie */}
        <div className="p-4 border-t border-slate-100 flex gap-3">
          <button
            onClick={() => {
              onClose();
              navigate(`/oficina/${office.id}`);
            }}
            className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-[#1F2B6B] text-white text-sm font-medium hover:bg-[#161F52] active:scale-[0.98] transition-all"
          >
            Ver análisis completo <ExternalLink size={15} />
          </button>
          <button
            onClick={() => {
              onClose();
              navigate('/malla');
            }}
            className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-slate-200 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
          >
            Malla <ArrowRight size={14} />
          </button>
        </div>
      </aside>
    </div>
  );
};

const Stat: React.FC<{
  icon: React.ElementType;
  label: string;
  value: React.ReactNode;
  tone?: 'ok' | 'bad';
}> = ({ icon: Icon, label, value, tone = 'ok' }) => (
  <div className="rounded-2xl bg-slate-50 p-3.5">
    <div className="flex items-center gap-1.5 text-xs text-slate-500">
      <Icon size={13} /> {label}
    </div>
    <div className={`mt-1 text-lg font-semibold tabular-nums ${tone === 'bad' ? 'text-rose-600' : 'text-slate-900'}`}>
      {value}
    </div>
  </div>
);
