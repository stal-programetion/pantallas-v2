import React, { useState } from 'react';
import confetti from 'canvas-confetti';
import {
  CalendarCheck,
  UserX,
  TrendingUp,
  Sparkles,
  ArrowLeftRight,
  CheckCircle2,
  Clock,
  ShieldCheck,
  FileSpreadsheet,
  AlertCircle,
  ArrowRight,
  ArrowLeft,
  Info,
  Check,
  Calendar,
} from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
import { useAuthStore } from '../store/useAuthStore';
import { TooltipWhy } from '../components/common/TooltipWhy';
import { StatusBadge } from '../components/common/StatusBadge';
import { TrafficLight } from '../components/common/TrafficLight';
import { RecommendationCard } from '../components/redistribution/RecommendationCard';

export const DayPlanPage: React.FC = () => {
  const {
    currentPlan,
    absences,
    offices,
    staff,
    recommendations,
    approvePlan,
    acceptRedistribution,
    rejectRedistribution,
    isFortnight,
  } = useAppStore();

  const { currentUser, canApprovePlan, canViewHealthData } = useAuthStore();
  const [currentStep, setCurrentStep] = useState<number>(1);
  const [isApproving, setIsApproving] = useState<boolean>(false);

  const steps = [
    { num: 1, title: 'Ausencias del Día', icon: UserX },
    { num: 2, title: 'Picos Previstos', icon: TrendingUp },
    { num: 3, title: 'Propuesta de Malla', icon: Sparkles },
    { num: 4, title: 'Redistribuciones', icon: ArrowLeftRight },
    { num: 5, title: 'Aprobación Final', icon: CheckCircle2 },
  ];

  const handleApprove = async () => {
    setIsApproving(true);
    await approvePlan(currentUser.nombre);
    setIsApproving(false);

    // Explosión de confetti corporativo (azul y naranja)
    try {
      confetti({
        particleCount: 80,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#1F2B6B', '#8BBF3F', '#2D79AD', '#3DB4E6'],
      });
    } catch {
      // no-op if confetti unavailable
    }
  };

  const isApproved = currentPlan?.estado === 'aprobado';
  const activeAbsences = absences.filter((a) => a.estado === 'activa');

  return (
    <div className="space-y-6">
      {/* Top Banner: Reemplazo del ritual matutino de Excel */}
      <div className="bg-gradient-to-r from-slate-900 via-blue-950 to-slate-900 rounded-2xl p-6 text-white shadow-md relative overflow-hidden border border-slate-800">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-lg bg-orange-500/20 text-orange-400 border border-orange-500/30">
                <CalendarCheck size={18} />
              </span>
              <h1 className="text-xl font-extrabold tracking-tight">
                Plan Operativo del Día — {currentPlan?.fecha || '2026-10-15'}
              </h1>
              {isApproved && (
                <span className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 text-[11px] font-bold px-2.5 py-0.5 rounded-full flex items-center gap-1">
                  <CheckCircle2 size={12} /> Aprobado y Oficial
                </span>
              )}
            </div>
            <p className="text-xs text-slate-300 mt-1 max-w-2xl leading-relaxed">
              Flujo guiado de 5 pasos para la estructuración y validación matutina de turnos. Reemplaza las 1.5 horas
              manuales en Excel con optimización matemática Erlang C y mitigación de ausencias.
            </p>
          </div>

          {/* Time Saved Metric Pill */}
          <div className="bg-white/10 backdrop-blur-md rounded-xl p-3 border border-white/15 flex items-center gap-3 shrink-0">
            <div className="w-10 h-10 rounded-lg bg-orange-500 text-white flex items-center justify-center font-bold text-lg shadow-sm">
              <Clock size={20} />
            </div>
            <div>
              <span className="text-[10px] text-slate-300 uppercase tracking-wider block font-semibold">
                Tiempo Ahorrado Hoy
              </span>
              <div className="text-base font-extrabold text-white">
                {currentPlan?.tiempoAhorradoMinutos || 82} minutos
                <span className="text-xs font-normal text-slate-300 ml-1">vs Excel</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Stepper Navigation */}
      <div className="bg-white p-3.5 rounded-xl border border-slate-200/90 shadow-2xs">
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
          {steps.map((s) => {
            const Icon = s.icon;
            const isCurrent = currentStep === s.num;
            const isCompleted = s.num < currentStep || isApproved;

            return (
              <button
                key={s.num}
                onClick={() => setCurrentStep(s.num)}
                className={`flex items-center gap-2 p-2.5 rounded-lg text-xs font-semibold transition-all cursor-pointer text-left ${
                  isCurrent
                    ? 'bg-blue-800 text-white shadow-xs'
                    : isCompleted
                    ? 'bg-slate-100 text-slate-800 hover:bg-slate-200/70'
                    : 'text-slate-400 hover:text-slate-600 hover:bg-slate-50'
                }`}
              >
                <div
                  className={`w-6 h-6 rounded-md flex items-center justify-center text-xs shrink-0 font-bold ${
                    isCurrent
                      ? 'bg-white text-blue-900'
                      : isCompleted
                      ? 'bg-emerald-500 text-white'
                      : 'bg-slate-200 text-slate-600'
                  }`}
                >
                  {isCompleted ? <Check size={13} /> : s.num}
                </div>
                <span className="truncate">{s.title}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Step Content Container */}
      <div className="bg-white rounded-2xl border border-slate-200/90 p-6 shadow-xs min-h-[420px] flex flex-col justify-between">
        {/* STEP 1: Ausencias del Día */}
        {currentStep === 1 && (
          <div className="space-y-4">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <UserX size={18} className="text-rose-600" />
                  Paso 1: Ausencias Activas Reportadas Hoy ({activeAbsences.length})
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Incapacidades médicas, permisos laborales y licencias registradas en Gestión Humana que restan capacidad de ventanilla.
                </p>
              </div>

              <TooltipWhy
                explanation="El motor descuenta automáticamente las horas de los colaboradores ausentes de la oferta de la oficina y evalúa si el nivel de servicio resultante baja de la meta del 80%."
                rule="Regla de Descuento de Capacidad"
              />
            </div>

            <div className="overflow-x-auto rounded-xl border border-slate-200">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-500 border-b border-slate-200">
                  <tr>
                    <th className="p-3">Colaborador</th>
                    <th className="p-3">Oficina Base</th>
                    <th className="p-3">Tipo de Ausencia</th>
                    <th className="p-3">Período</th>
                    <th className="p-3">Diagnóstico / Motivo</th>
                    <th className="p-3">Déficit Generado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {activeAbsences.map((abs) => {
                    const st = staff.find((s) => s.id === abs.colaboradorId);
                    const off = offices.find((o) => o.id === st?.oficinaBaseId);

                    return (
                      <tr key={abs.id} className="hover:bg-slate-50/80">
                        <td className="p-3 font-semibold text-slate-900">
                          {st?.nombre || 'Colaborador'}
                          <div className="text-[10px] text-slate-400 font-normal">
                            Doc: {st?.documento}
                          </div>
                        </td>
                        <td className="p-3 font-medium text-slate-700">
                          {off?.nombre || st?.oficinaBaseId}
                        </td>
                        <td className="p-3">
                          <StatusBadge status="ausente" label={abs.tipo.replace('_', ' ')} size="sm" />
                        </td>
                        <td className="p-3 text-slate-600 font-mono">
                          {abs.fechaInicio} al {abs.fechaFin}
                        </td>
                        <td className="p-3">
                          {canViewHealthData() ? (
                            <span className="text-slate-800 font-medium">
                              {abs.diagnosticoSalud || abs.motivoDetalle}
                            </span>
                          ) : (
                            <span className="text-slate-400 italic flex items-center gap-1">
                              <ShieldCheck size={12} className="text-slate-400" />
                              Información médica restringida por rol
                            </span>
                          )}
                        </td>
                        <td className="p-3 font-bold text-rose-600">
                          -{abs.impactoEstimado?.deficitHoras || 7.5} h atención
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="p-3.5 bg-rose-50/70 rounded-xl border border-rose-200 text-xs text-rose-900 flex items-center justify-between">
              <span className="flex items-center gap-2">
                <AlertCircle size={16} className="text-rose-600 shrink-0" />
                <span>
                  <strong>Impacto total:</strong> 4 ausencias concentran déficit crítico en Montería Centro, Caucasia y Sincelejo La Palma.
                </span>
              </span>
              <span className="font-semibold text-rose-700">El motor activará traslados sugeridos en el Paso 4</span>
            </div>
          </div>
        )}

        {/* STEP 2: Horas Pico Previstas */}
        {currentStep === 2 && (
          <div className="space-y-4">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <TrendingUp size={18} className="text-orange-600" />
                  Paso 2: Comportamiento y Franjas Pico Proyectadas
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Demanda esperada por oficina calculada con los últimos 3 meses de Digiturno y ponderación de {isFortnight ? 'quincena (+32%)' : 'semana estándar'}.
                </p>
              </div>

              <TooltipWhy
                explanation="El pronóstico identifica las horas del día donde la afluencia supera 1.25x la media. Durante estas ventanas se restringen los almuerzos y se concentran los puestos de atención."
                rule="Detección de Picos Intradiarios"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 space-y-2">
                <span className="text-[11px] font-bold text-blue-800 uppercase tracking-wider block">
                  Pico Matutino (Máxima Afluencia)
                </span>
                <div className="text-xl font-extrabold text-slate-900">09:30 - 11:30</div>
                <p className="text-xs text-slate-600">
                  Concentración de reclamos de facturación y PQR. Tasa de llegadas promedio: <strong>24.5 clientes/h</strong> en sedes principales.
                </p>
                <div className="pt-2 text-[11px] text-emerald-700 font-semibold flex items-center gap-1">
                  <Check size={12} /> 100% de agentes en ventanilla requerido
                </div>
              </div>

              <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 space-y-2">
                <span className="text-[11px] font-bold text-orange-700 uppercase tracking-wider block">
                  Pico Mediodía (Pagos Rápidos)
                </span>
                <div className="text-xl font-extrabold text-slate-900">12:00 - 13:30</div>
                <p className="text-xs text-slate-600">
                  Usuarios aprovechan descanso laboral para cancelar facturas. Coincide con la ventana de almuerzo de colaboradores.
                </p>
                <div className="pt-2 text-[11px] text-orange-700 font-semibold flex items-center gap-1">
                  <AlertCircle size={12} /> Requiere almuerzos escalonados estrictos
                </div>
              </div>

              <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 space-y-2">
                <span className="text-[11px] font-bold text-indigo-700 uppercase tracking-wider block">
                  Pico Vespertino (Financiación)
                </span>
                <div className="text-xl font-extrabold text-slate-900">14:30 - 15:30</div>
                <p className="text-xs text-slate-600">
                  Trámites de crédito Brilla y contratos de conexión nueva con tiempos de servicio mayores (13.5 min/cliente).
                </p>
                <div className="pt-2 text-[11px] text-indigo-700 font-semibold flex items-center gap-1">
                  <Check size={12} /> Malla completa reincorporada
                </div>
              </div>
            </div>

            <div className="p-4 rounded-xl border border-slate-200 bg-white">
              <h4 className="text-xs font-bold text-slate-900 mb-2">
                Oficinas con mayor tensión operativa pronosticada para hoy:
              </h4>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-100">
                  <span className="font-bold text-slate-800">Sede Chambacú</span>
                  <div className="text-slate-500 text-[11px]">28.6 cli/h en pico</div>
                  <div className="text-blue-700 font-bold mt-1">Requiere 5 agentes</div>
                </div>
                <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-100">
                  <span className="font-bold text-slate-800">Montería Centro</span>
                  <div className="text-slate-500 text-[11px]">24.2 cli/h en pico</div>
                  <div className="text-orange-700 font-bold mt-1">Requiere 4 agentes (1 ausente)</div>
                </div>
                <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-100">
                  <span className="font-bold text-slate-800">Sincelejo La Palma</span>
                  <div className="text-slate-500 text-[11px]">20.9 cli/h en pico</div>
                  <div className="text-blue-700 font-bold mt-1">Requiere 4 agentes</div>
                </div>
                <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-100">
                  <span className="font-bold text-slate-800">Santa Marta Rodadero</span>
                  <div className="text-slate-500 text-[11px]">18.7 cli/h en pico</div>
                  <div className="text-blue-700 font-bold mt-1">Requiere 3 agentes</div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* STEP 3: Propuesta del Motor con Justificaciones */}
        {currentStep === 3 && (
          <div className="space-y-4">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <Sparkles size={18} className="text-blue-600" />
                  Paso 3: Propuesta Generada por el Motor con Justificaciones Legibles
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  El algoritmo asignó 36 colaboradores garantizando escalonamiento de almuerzos y cumplimiento de la meta CREG del 80%.
                </p>
              </div>

              <TooltipWhy
                explanation="Cada línea de decisión fue validada contra las restricciones: no dejar oficinas con 0 agentes, respetar 60 min de almuerzo y calcular agentes con Erlang C."
                rule="Motor de Asignación v2.4"
              />
            </div>

            <div className="space-y-2.5 max-h-[300px] overflow-y-auto pr-1">
              {currentPlan?.justificaciones.map((just) => (
                <div
                  key={just.id}
                  className="p-3 rounded-xl border border-slate-200 bg-slate-50/80 hover:bg-white transition-colors flex items-start justify-between gap-3 text-xs"
                >
                  <div className="flex items-start gap-2.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-600 mt-1.5 shrink-0" />
                    <div>
                      <span className="font-bold text-slate-900">
                        {offices.find((o) => o.id === just.oficinaId)?.nombre}
                      </span>
                      <span className="text-slate-400 font-mono ml-2">
                        [{just.franja}]
                      </span>
                      <p className="text-slate-700 mt-0.5">{just.razon}</p>
                    </div>
                  </div>

                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-white border border-slate-200 text-slate-600 shrink-0">
                    {just.regla}
                  </span>
                </div>
              ))}
            </div>

            <div className="p-3 bg-blue-50/70 rounded-xl border border-blue-200 text-xs text-blue-900 flex items-center justify-between">
              <span>
                <strong>Regla de Continuidad Operativa:</strong> Ninguna de las 14 sedes cerrará durante la ventana de almuerzo (12:00 a 14:30).
              </span>
              <button
                onClick={() => (window.location.href = '/malla')}
                className="text-blue-800 hover:text-blue-950 font-bold underline cursor-pointer"
              >
                Ver en Malla Interactiva
              </button>
            </div>
          </div>
        )}

        {/* STEP 4: Redistribuciones Sugeridas */}
        {currentStep === 4 && (
          <div className="space-y-4">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <ArrowLeftRight size={18} className="text-purple-600" />
                  Paso 4: Recomendaciones de Redistribución (Presencial y Virtual)
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Detección de déficit y superávit por cercanía geográfica. Acepta o rechaza las propuestas antes de oficializar el plan.
                </p>
              </div>

              <TooltipWhy
                explanation="Para distancias menores a 45 km (ej. Sincelejo - Corozal: 15 km), el motor sugiere traslado presencial. Para distancias mayores o sedes lejanas, asigna ventanilla remota virtual Digiturno."
                rule="Heurística de Asignación Geográfica Haversine"
              />
            </div>

            <div className="space-y-3">
              {recommendations.length === 0 ? (
                <div className="p-8 text-center text-slate-400">
                  No hay redistribuciones requeridas para hoy. La oferta base cubre el SLA.
                </div>
              ) : (
                recommendations.map((rec) => (
                  <RecommendationCard
                    key={rec.id}
                    recommendation={rec}
                    onAccept={() => acceptRedistribution(rec.id)}
                    onReject={() => rejectRedistribution(rec.id)}
                  />
                ))
              )}
            </div>
          </div>
        )}

        {/* STEP 5: Aprobación y Auditoría */}
        {currentStep === 5 && (
          <div className="space-y-5">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <CheckCircle2 size={18} className="text-emerald-600" />
                  Paso 5: Resumen Ejecutivo y Aprobación del Plan del Día
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Registro de auditoría conforme a políticas operativas de Surtigas S.A. E.S.P.
                </p>
              </div>
            </div>

            {/* Audit Status Box */}
            <div className="p-5 rounded-2xl border border-slate-200 bg-slate-50/60 space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
                <div>
                  <span className="text-slate-500 font-medium">Estado del Plan:</span>
                  <div className="font-bold text-slate-900 mt-0.5 text-sm">
                    {isApproved ? (
                      <span className="text-emerald-600 flex items-center gap-1">
                        <CheckCircle2 size={15} /> APROBADO Y OFICIAL
                      </span>
                    ) : (
                      <span className="text-amber-600 flex items-center gap-1">
                        <Clock size={15} /> PROPUESTA PENDIENTE
                      </span>
                    )}
                  </div>
                </div>

                <div>
                  <span className="text-slate-500 font-medium">Responsable / Rol:</span>
                  <div className="font-bold text-slate-900 mt-0.5">
                    {currentPlan?.auditoria?.aprobadoPor || currentUser.nombre}
                    <span className="text-[10px] text-slate-500 block font-normal">
                      ({currentUser.cargo})
                    </span>
                  </div>
                </div>

                <div>
                  <span className="text-slate-500 font-medium">Fecha y Hora de Aprobación:</span>
                  <div className="font-bold text-slate-900 mt-0.5 font-mono text-[11px]">
                    {currentPlan?.auditoria?.aprobadoEn
                      ? new Date(currentPlan.auditoria.aprobadoEn).toLocaleString('es-CO')
                      : 'Pendiente de firma digital'}
                  </div>
                </div>

                <div>
                  <span className="text-slate-500 font-medium">Versión de Malla:</span>
                  <div className="font-bold text-slate-900 mt-0.5">
                    v{currentPlan?.auditoria?.version || 1}.0{' '}
                    <span className="text-[10px] text-slate-500 font-normal">
                      ({currentPlan?.auditoria?.totalCambiosManuales || 0} ajustes manuales)
                    </span>
                  </div>
                </div>
              </div>

              <div className="pt-3 border-t border-slate-200 flex items-center justify-between text-xs text-slate-600">
                <span className="flex items-center gap-1.5">
                  <ShieldCheck size={15} className="text-blue-700" />
                  Garantía de cumplimiento CREG: SLA ponderado proyectado de red: <strong>83.4%</strong>.
                </span>
                <span className="font-mono text-slate-400 text-[11px]">ID: {currentPlan?.id}</span>
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-2">
              <div className="text-xs text-slate-500">
                {!canApprovePlan() ? (
                  <span className="text-rose-600 font-semibold">
                    * Tu rol actual ({currentUser.rol}) es de solo lectura. Cambia a Administrador o Coordinador para aprobar.
                  </span>
                ) : (
                  <span>
                    Al aprobar el plan, los turnos se sincronizan con las ventanillas Digiturno y el tablero en vivo.
                  </span>
                )}
              </div>

              {canApprovePlan() && (
                <button
                  onClick={handleApprove}
                  disabled={isApproved || isApproving}
                  className={`px-6 py-2.5 rounded-xl text-xs font-bold shadow-md transition-all cursor-pointer flex items-center gap-2 ${
                    isApproved
                      ? 'bg-emerald-600 text-white cursor-default'
                      : 'bg-gradient-to-r from-orange-600 to-orange-500 hover:from-orange-700 hover:to-orange-600 text-white shadow-orange-500/20'
                  }`}
                >
                  <CheckCircle2 size={16} />
                  <span>
                    {isApproved
                      ? 'Plan Oficialmente Aprobado'
                      : isApproving
                      ? 'Registrando Aprobación...'
                      : 'Aprobar Plan del Día'}
                  </span>
                </button>
              )}
            </div>
          </div>
        )}

        {/* Stepper Footer Controls */}
        <div className="pt-6 mt-6 border-t border-slate-100 flex items-center justify-between">
          <button
            onClick={() => setCurrentStep((prev) => Math.max(1, prev - 1))}
            disabled={currentStep === 1}
            className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold transition-colors ${
              currentStep === 1
                ? 'text-slate-300 cursor-not-allowed'
                : 'text-slate-700 hover:bg-slate-100 cursor-pointer'
            }`}
          >
            <ArrowLeft size={14} />
            <span>Paso Anterior</span>
          </button>

          <div className="text-xs font-mono text-slate-400">
            Paso {currentStep} de 5
          </div>

          <button
            onClick={() => setCurrentStep((prev) => Math.min(5, prev + 1))}
            disabled={currentStep === 5}
            className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold transition-colors ${
              currentStep === 5
                ? 'text-slate-300 cursor-not-allowed'
                : 'bg-slate-900 hover:bg-slate-800 text-white cursor-pointer shadow-xs'
            }`}
          >
            <span>Siguiente Paso</span>
            <ArrowRight size={14} />
          </button>
        </div>
      </div>
    </div>
  );
};
