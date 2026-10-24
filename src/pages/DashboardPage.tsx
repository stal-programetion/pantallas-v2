import React, { useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Users,
  Clock,
  Gauge,
  UserCheck,
  ArrowRight,
  Search,
  LayoutGrid,
  List,
  CheckCircle2,
  Check,
  ChevronDown,
  AlertOctagon,
  AlertTriangle,
  Info,
  X,
  CalendarCheck,
  ArrowLeftRight,
} from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
import { useAuthStore } from '../store/useAuthStore';
import { OfficeCard } from '../components/dashboard/OfficeCard';
import { OfficeDrawer } from '../components/dashboard/OfficeDrawer';
import { LiveQueueChart } from '../components/dashboard/LiveQueueChart';
import { UserBehaviorWidget } from '../components/dashboard/UserBehaviorWidget';
import { STATUS_THEME, SlaStatus } from '../components/common/statusTheme';
import type { Alert } from '../types';

type StatusFilter = 'todos' | SlaStatus;
type SortKey = 'estado' | 'fila' | 'espera' | 'sla' | 'cobertura' | 'nombre';

const SORT_LABELS: Record<SortKey, string> = {
  estado: 'Más urgentes primero',
  fila: 'Más clientes en fila',
  espera: 'Mayor espera',
  sla: 'Menor SLA',
  cobertura: 'Menor cobertura',
  nombre: 'Nombre (A–Z)',
};

const SEVERITY_ORDER: Record<Alert['severidad'], number> = { critica: 0, advertencia: 1, info: 2 };
const STATUS_ORDER: Record<SlaStatus, number> = { critico: 0, alerta: 1, optimo: 2 };

const greeting = () => {
  const h = new Date().getHours();
  if (h < 12) return 'Buenos días';
  if (h < 19) return 'Buenas tardes';
  return 'Buenas noches';
};

export const DashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const { offices, liveMetrics, alerts, recommendations, currentPlan, getGlobalKpis, dismissAlert, isLoading } =
    useAppStore();
  const { currentUser } = useAuthStore();

  const [status, setStatus] = useState<StatusFilter>('todos');
  const [dept, setDept] = useState<string>('todos');
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<SortKey>('estado');
  const [view, setView] = useState<'grid' | 'list'>('grid');
  const [selectedOffice, setSelectedOffice] = useState<string | null>(null);
  const [showAllAlerts, setShowAllAlerts] = useState(false);
  const [insightTab, setInsightTab] = useState<'carga' | 'tramites'>('carga');
  const officesRef = useRef<HTMLElement>(null);

  const kpis = getGlobalKpis();
  const metricsById = useMemo(() => new Map(liveMetrics.map((m) => [m.oficinaId, m])), [liveMetrics]);

  const counts = useMemo(() => {
    const c: Record<SlaStatus, number> = { critico: 0, alerta: 0, optimo: 0 };
    offices.forEach((o) => {
      c[metricsById.get(o.id)?.estadoSla ?? 'optimo']++;
    });
    return c;
  }, [offices, metricsById]);

  const departments = useMemo(() => Array.from(new Set(offices.map((o) => o.departamento))), [offices]);
  const pendingRecs = recommendations.filter((r) => r.estado === 'pendiente').length;
  const planApproved = currentPlan?.estado === 'aprobado';

  // ----- Oficinas: filtro + búsqueda + orden -----
  const visibleOffices = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = offices.filter((o) => {
      const m = metricsById.get(o.id);
      const okStatus = status === 'todos' || (m?.estadoSla ?? 'optimo') === status;
      const okDept = dept === 'todos' || o.departamento === dept;
      const okQuery = !q || `${o.nombre} ${o.ciudad} ${o.departamento}`.toLowerCase().includes(q);
      return okStatus && okDept && okQuery;
    });
    const coverage = (id: string) => {
      const m = metricsById.get(id);
      return m && m.agentesRequeridos > 0 ? m.agentesActivos / m.agentesRequeridos : 1;
    };
    return [...list].sort((a, b) => {
      const ma = metricsById.get(a.id);
      const mb = metricsById.get(b.id);
      switch (sort) {
        case 'fila':
          return (mb?.clientesEnFila ?? 0) - (ma?.clientesEnFila ?? 0);
        case 'espera':
          return (mb?.esperaPromedioMin ?? 0) - (ma?.esperaPromedioMin ?? 0);
        case 'sla':
          return (ma?.slaActual ?? 1) - (mb?.slaActual ?? 1);
        case 'cobertura':
          return coverage(a.id) - coverage(b.id);
        case 'nombre':
          return a.nombre.localeCompare(b.nombre);
        default:
          return (
            STATUS_ORDER[ma?.estadoSla ?? 'optimo'] - STATUS_ORDER[mb?.estadoSla ?? 'optimo'] ||
            (ma?.slaActual ?? 1) - (mb?.slaActual ?? 1)
          );
      }
    });
  }, [offices, metricsById, status, dept, query, sort]);

  const filtersActive = status !== 'todos' || dept !== 'todos' || query !== '';
  const clearFilters = () => {
    setStatus('todos');
    setDept('todos');
    setQuery('');
  };

  const focusOffices = (nextSort: SortKey, nextStatus: StatusFilter = 'todos') => {
    setSort(nextSort);
    setStatus(nextStatus);
    officesRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  // ----- Mensaje principal -----
  const headline =
    counts.critico > 0
      ? {
          tone: 'critico' as const,
          title: `${counts.critico} ${counts.critico === 1 ? 'oficina necesita' : 'oficinas necesitan'} atención ahora`,
          text:
            pendingRecs > 0
              ? `Hay ${pendingRecs} ${pendingRecs === 1 ? 'traslado sugerido' : 'traslados sugeridos'} que podrían aliviar la carga.`
              : 'Revisa las alertas y ajusta la malla para recuperar el nivel de servicio.',
        }
      : counts.alerta > 0
        ? {
            tone: 'alerta' as const,
            title: `${counts.alerta} ${counts.alerta === 1 ? 'oficina en riesgo' : 'oficinas en riesgo'}`,
            text: 'Todavía estás a tiempo de actuar antes de que el SLA caiga.',
          }
        : {
            tone: 'optimo' as const,
            title: 'Toda la red opera dentro de meta',
            text: 'No hay oficinas en alerta en este momento.',
          };

  // ----- Alertas priorizadas -----
  const sortedAlerts = useMemo(
    () => [...alerts].sort((a, b) => SEVERITY_ORDER[a.severidad] - SEVERITY_ORDER[b.severidad]),
    [alerts]
  );
  const shownAlerts = showAllAlerts ? sortedAlerts : sortedAlerts.slice(0, 3);

  const alertAction = (a: Alert) => {
    if (a.accionTipo === 'redistribuir') navigate('/redistribucion');
    else if (a.accionTipo === 'ajustar_almuerzo') navigate('/malla');
    else if (a.accionTipo === 'cubrir_ausencia') navigate('/ausencias');
    else setSelectedOffice(a.oficinaId);
  };

  if (isLoading && liveMetrics.length === 0) {
    return (
      <div className="space-y-6" aria-busy="true">
        <div className="h-40 rounded-3xl bg-slate-200/60 animate-pulse" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-28 rounded-2xl bg-slate-200/60 animate-pulse" />
          ))}
        </div>
        <div className="h-72 rounded-2xl bg-slate-200/60 animate-pulse" />
      </div>
    );
  }

  const heroTone = {
    critico: 'from-[#2a1015] via-[#4a1520] to-[#161F52]',
    alerta: 'from-[#2a2010] via-[#3a2f12] to-[#161F52]',
    optimo: 'from-[#161F52] via-[#1F2B6B] to-[#2D79AD]',
  }[headline.tone];

  return (
    <div className="space-y-6">
      {/* ===== 1. Resumen: qué pasa y qué hacer ===== */}
      <section
        className={`relative overflow-hidden rounded-3xl bg-gradient-to-br ${heroTone} text-white p-6 sm:p-8`}
        aria-live="polite"
      >
        <div className="absolute -right-16 -top-16 w-64 h-64 rounded-full bg-orange-500/10 blur-2xl" aria-hidden="true" />
        <div className="relative flex flex-col lg:flex-row lg:items-end justify-between gap-6">
          <div className="max-w-2xl">
            <p className="text-sm text-white/60">
              {greeting()}, {currentUser.nombre.split(' ')[0]}
            </p>
            <h2 className="mt-1 text-2xl sm:text-3xl font-semibold tracking-tight text-balance">{headline.title}</h2>
            <p className="mt-2 text-sm sm:text-base text-white/70">{headline.text}</p>

            {/* Barra de estado de la red: clic para filtrar */}
            <div className="mt-5 max-w-md">
              <div className="flex h-2.5 rounded-full overflow-hidden bg-white/10 gap-0.5">
                {(['critico', 'alerta', 'optimo'] as SlaStatus[]).map(
                  (s) =>
                    counts[s] > 0 && (
                      <button
                        key={s}
                        onClick={() => focusOffices('estado', s)}
                        title={`${counts[s]} ${STATUS_THEME[s].label.toLowerCase()}`}
                        aria-label={`Ver ${counts[s]} oficinas en estado ${STATUS_THEME[s].label}`}
                        className="h-full transition-opacity hover:opacity-80"
                        style={{ flexGrow: counts[s], backgroundColor: STATUS_THEME[s].hex }}
                      />
                    )
                )}
              </div>
              <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-white/70">
                {(['critico', 'alerta', 'optimo'] as SlaStatus[]).map((s) => (
                  <span key={s} className="inline-flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: STATUS_THEME[s].hex }} />
                    <strong className="text-white tabular-nums">{counts[s]}</strong> {STATUS_THEME[s].label.toLowerCase()}
                  </span>
                ))}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            {pendingRecs > 0 && (
              <button
                onClick={() => navigate('/redistribucion')}
                className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-orange-500 hover:bg-orange-400 active:scale-[0.98] text-white text-sm font-semibold shadow-lg shadow-orange-900/30 transition-all group"
              >
                <ArrowLeftRight size={16} />
                Revisar {pendingRecs} {pendingRecs === 1 ? 'traslado' : 'traslados'}
                <ArrowRight size={15} className="group-hover:translate-x-0.5 transition-transform" />
              </button>
            )}
            <button
              onClick={() => navigate('/plan-dia')}
              className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-white/10 hover:bg-white/20 border border-white/15 text-white text-sm font-semibold transition-colors"
            >
              <CalendarCheck size={16} />
              Plan del día
              <span
                className={`text-xs px-2 py-0.5 rounded-full ${planApproved ? 'bg-emerald-400/20 text-emerald-200' : 'bg-orange-400/20 text-orange-200'}`}
              >
                {planApproved ? 'Aprobado' : 'Por aprobar'}
              </span>
            </button>
          </div>
        </div>
      </section>

      {/* ===== 2. Indicadores clave (4, clicables) ===== */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 stagger" aria-label="Indicadores clave">
        <Kpi
          icon={Gauge}
          label="Nivel de servicio"
          value={`${Math.round(kpis.slaGlobal * 100)}%`}
          hint="Meta: 80% en ≤ 10 min"
          tone={kpis.slaGlobal >= 0.8 ? 'optimo' : kpis.slaGlobal >= 0.7 ? 'alerta' : 'critico'}
          why="Porcentaje de clientes atendidos en menos de 10 minutos (SLA CREG / Surtigas)."
          onClick={() => focusOffices('sla')}
        />
        <Kpi
          icon={Clock}
          label="Espera promedio"
          value={`${kpis.esperaPromedioMin} min`}
          hint={kpis.esperaPromedioMin > 10 ? 'Por encima de la meta' : 'Dentro de la meta (≤ 10 min)'}
          tone={kpis.esperaPromedioMin <= 10 ? 'optimo' : 'alerta'}
          why="Tiempo medio de espera según el modelo Erlang C (Wq)."
          onClick={() => focusOffices('espera')}
        />
        <Kpi
          icon={Users}
          label="Clientes en fila"
          value={kpis.totalClientesEnFila}
          hint={`en ${offices.length} oficinas`}
          tone="neutral"
          why="Tickets en estado “esperando llamada” en todos los digiturnos de la red."
          onClick={() => focusOffices('fila')}
        />
        <Kpi
          icon={UserCheck}
          label="Cobertura de personal"
          value={`${kpis.personalActivo}/${kpis.personalRequerido}`}
          hint={`${kpis.personalRequerido > 0 ? Math.round((kpis.personalActivo / kpis.personalRequerido) * 100) : 100}% de lo requerido`}
          tone={kpis.personalActivo >= kpis.personalRequerido ? 'optimo' : 'alerta'}
          why="Colaboradores activos frente al requerimiento calculado por el motor."
          onClick={() => focusOffices('cobertura')}
        />
      </section>

      {/* ===== 3. Atención + Análisis ===== */}
      <section className="grid grid-cols-1 xl:grid-cols-5 gap-6">
        {/* Requiere atención */}
        <div className="xl:col-span-2 bg-white rounded-2xl border border-slate-200 p-5 flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-slate-900">Requiere atención</h3>
            {sortedAlerts.length > 0 && (
              <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 tabular-nums">
                {sortedAlerts.length}
              </span>
            )}
          </div>

          {sortedAlerts.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center py-10">
              <span className="w-12 h-12 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center">
                <CheckCircle2 size={24} />
              </span>
              <p className="mt-3 text-sm font-medium text-slate-900">Todo bajo control</p>
              <p className="text-xs text-slate-500 mt-1">No hay alertas pendientes.</p>
            </div>
          ) : (
            <>
              <ul className="space-y-2.5 stagger">
                {shownAlerts.map((a) => (
                  <AlertRow key={a.id} alert={a} onAct={() => alertAction(a)} onDismiss={() => dismissAlert(a.id)} />
                ))}
              </ul>
              {sortedAlerts.length > 3 && (
                <button
                  onClick={() => setShowAllAlerts((v) => !v)}
                  className="mt-3 inline-flex items-center justify-center gap-1.5 py-2 text-sm font-medium text-blue-700 hover:text-blue-900 transition-colors"
                  aria-expanded={showAllAlerts}
                >
                  {showAllAlerts ? 'Mostrar menos' : `Ver las ${sortedAlerts.length - 3} restantes`}
                  <ChevronDown size={15} className={`transition-transform ${showAllAlerts ? 'rotate-180' : ''}`} />
                </button>
              )}
            </>
          )}
        </div>

        {/* Carga / trámites en pestañas */}
        <div className="xl:col-span-3 bg-white rounded-2xl border border-slate-200 p-5">
          <div role="tablist" aria-label="Análisis" className="inline-flex p-1 rounded-xl bg-slate-100 mb-4">
            {([
              ['carga', 'Carga operativa'],
              ['tramites', 'Tipos de trámite'],
            ] as const).map(([key, label]) => (
              <button
                key={key}
                role="tab"
                aria-selected={insightTab === key}
                onClick={() => setInsightTab(key)}
                className={`px-3.5 py-1.5 rounded-lg text-sm font-medium transition-all ${
                  insightTab === key ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          <div key={insightTab} className="anim-fade">
            {insightTab === 'carga' ? <LiveQueueChart bare /> : <UserBehaviorWidget bare />}
          </div>
        </div>
      </section>

      {/* ===== 4. Oficinas ===== */}
      <section ref={officesRef} className="scroll-mt-4 space-y-4" aria-label="Oficinas">
        <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-3">
          <div className="flex items-baseline gap-2">
            <h3 className="text-lg font-semibold text-slate-900">Oficinas</h3>
            <span className="text-sm text-slate-500 tabular-nums">
              {visibleOffices.length} de {offices.length}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <label className="relative">
              <span className="sr-only">Buscar oficina</span>
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Buscar oficina o ciudad"
                className="w-56 pl-9 pr-8 py-2 rounded-xl border border-slate-200 bg-white text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-300 transition-shadow"
              />
              {query && (
                <button
                  onClick={() => setQuery('')}
                  aria-label="Limpiar búsqueda"
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 rounded text-slate-400 hover:text-slate-700"
                >
                  <X size={14} />
                </button>
              )}
            </label>

            <label>
              <span className="sr-only">Ordenar por</span>
              <select
                value={sort}
                onChange={(e) => setSort(e.target.value as SortKey)}
                className="py-2 pl-3 pr-8 rounded-xl border border-slate-200 bg-white text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-200"
              >
                {(Object.keys(SORT_LABELS) as SortKey[]).map((k) => (
                  <option key={k} value={k}>
                    {SORT_LABELS[k]}
                  </option>
                ))}
              </select>
            </label>

            <div className="inline-flex p-1 rounded-xl bg-slate-100" role="group" aria-label="Tipo de vista">
              {([
                ['grid', LayoutGrid, 'Vista de tarjetas'],
                ['list', List, 'Vista de lista'],
              ] as const).map(([key, Icon, label]) => (
                <button
                  key={key}
                  onClick={() => setView(key)}
                  aria-label={label}
                  aria-pressed={view === key}
                  title={label}
                  className={`p-1.5 rounded-lg transition-all ${
                    view === key ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  <Icon size={16} />
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Filtros rápidos tipo chip */}
        <div className="flex flex-wrap items-center gap-2">
          {([
            ['todos', 'Todas', offices.length],
            ['critico', 'Críticas', counts.critico],
            ['alerta', 'En riesgo', counts.alerta],
            ['optimo', 'Óptimas', counts.optimo],
          ] as Array<[StatusFilter, string, number]>).map(([key, label, n]) => {
            const active = status === key;
            return (
              <button
                key={key}
                onClick={() => setStatus(key)}
                aria-pressed={active}
                className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-sm font-medium border transition-all ${
                  active
                    ? 'bg-[#1F2B6B] text-white border-[#1F2B6B]'
                    : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300 hover:text-slate-900'
                }`}
              >
                {key !== 'todos' && <span className={`w-2 h-2 rounded-full ${STATUS_THEME[key].dot}`} />}
                {label}
                <span className={`text-xs tabular-nums ${active ? 'text-white/70' : 'text-slate-400'}`}>{n}</span>
              </button>
            );
          })}

          <span className="hidden sm:block w-px h-5 bg-slate-200 mx-1" />

          {['todos', ...departments].map((d) => {
            const active = dept === d;
            return (
              <button
                key={d}
                onClick={() => setDept(d)}
                aria-pressed={active}
                className={`px-3 py-1.5 rounded-full text-sm transition-all ${
                  active ? 'bg-blue-50 text-blue-800 font-medium' : 'text-slate-500 hover:bg-slate-100 hover:text-slate-800'
                }`}
              >
                {d === 'todos' ? 'Todos los deptos.' : d}
              </button>
            );
          })}
        </div>

        {visibleOffices.length === 0 ? (
          <div className="bg-white rounded-2xl border border-dashed border-slate-300 py-14 text-center">
            <p className="text-sm font-medium text-slate-900">Ninguna oficina coincide con los filtros</p>
            <button
              onClick={clearFilters}
              className="mt-3 px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-sm font-medium text-slate-700 transition-colors"
            >
              Limpiar filtros
            </button>
          </div>
        ) : view === 'grid' ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-4 stagger">
            {visibleOffices.map((o) => (
              <OfficeCard
                key={o.id}
                office={o}
                metrics={metricsById.get(o.id)}
                selected={selectedOffice === o.id}
                onSelect={setSelectedOffice}
              />
            ))}
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
            <div className="hidden md:grid grid-cols-[2fr_1fr_1fr_1fr_1fr_auto] gap-4 px-4 py-2.5 text-xs font-medium uppercase tracking-wider text-slate-400 bg-slate-50 border-b border-slate-100">
              <span>Oficina</span>
              <span>Estado</span>
              <span>Fila</span>
              <span>Espera</span>
              <span>Agentes</span>
              <span className="w-4" />
            </div>
            {visibleOffices.map((o) => (
              <OfficeCard
                key={o.id}
                variant="row"
                office={o}
                metrics={metricsById.get(o.id)}
                selected={selectedOffice === o.id}
                onSelect={setSelectedOffice}
              />
            ))}
          </div>
        )}
      </section>

      <OfficeDrawer officeId={selectedOffice} onClose={() => setSelectedOffice(null)} />
    </div>
  );
};

/* ---------- Subcomponentes locales ---------- */

const KPI_TONE: Record<'optimo' | 'alerta' | 'critico' | 'neutral', string> = {
  optimo: 'bg-emerald-500',
  alerta: 'bg-amber-500',
  critico: 'bg-rose-500',
  neutral: 'bg-blue-500',
};

const Kpi: React.FC<{
  icon: React.ElementType;
  label: string;
  value: React.ReactNode;
  hint: string;
  tone: 'optimo' | 'alerta' | 'critico' | 'neutral';
  why: string;
  onClick: () => void;
}> = ({ icon: Icon, label, value, hint, tone, why, onClick }) => (
  <button
    onClick={onClick}
    title={`${why} — Clic para ordenar las oficinas por este indicador.`}
    className="group relative text-left bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 transition-all hover:-translate-y-0.5 hover:shadow-lg hover:shadow-slate-200/70 hover:border-slate-300"
  >
    <span className={`absolute left-5 top-0 h-1 w-10 rounded-b-full ${KPI_TONE[tone]}`} aria-hidden="true" />
    <div className="flex items-center justify-between text-slate-500">
      <span className="text-sm font-medium">{label}</span>
      <Icon size={17} className="text-slate-300 group-hover:text-slate-500 transition-colors" />
    </div>
    <div className="mt-2 text-3xl font-semibold tracking-tight text-slate-900 tabular-nums">{value}</div>
    <p className="mt-1 text-xs text-slate-500">{hint}</p>
  </button>
);

const ALERT_STYLE = {
  critica: { icon: AlertOctagon, wrap: 'bg-rose-50/70 border-rose-100', iconColor: 'text-rose-600' },
  advertencia: { icon: AlertTriangle, wrap: 'bg-amber-50/70 border-amber-100', iconColor: 'text-amber-600' },
  info: { icon: Info, wrap: 'bg-blue-50/70 border-blue-100', iconColor: 'text-blue-600' },
} as const;

const AlertRow: React.FC<{ alert: Alert; onAct: () => void; onDismiss: () => void }> = ({
  alert,
  onAct,
  onDismiss,
}) => {
  const s = ALERT_STYLE[alert.severidad] ?? ALERT_STYLE.info;
  const Icon = s.icon;
  return (
    <li className={`rounded-xl border p-3.5 ${s.wrap}`}>
      <div className="flex items-start gap-3">
        <Icon size={18} className={`mt-0.5 shrink-0 ${s.iconColor}`} />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-slate-900 leading-snug">{alert.titulo}</p>
          <p className="text-xs text-slate-500 mt-0.5">
            {alert.oficinaNombre}
            {alert.franja ? ` · ${alert.franja}` : ''}
          </p>
          <p className="text-xs text-slate-600 mt-1.5 line-clamp-2">{alert.accionSugerida || alert.mensaje}</p>
          <div className="mt-2.5 flex items-center gap-2">
            <button
              onClick={onAct}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-700 active:scale-[0.97] text-white text-xs font-medium transition-all"
            >
              Resolver <ArrowRight size={12} />
            </button>
            <button
              onClick={onDismiss}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium text-slate-500 hover:bg-white hover:text-slate-800 transition-colors"
              aria-label={`Descartar alerta: ${alert.titulo}`}
            >
              <Check size={13} /> Descartar
            </button>
          </div>
        </div>
      </div>
    </li>
  );
};
