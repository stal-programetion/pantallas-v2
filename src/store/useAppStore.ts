import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type {
  Office,
  Staff,
  Absence,
  DayPlan,
  Alert,
  OfficeRealtimeMetrics,
  RedistributionRecommendation,
  ShiftSlot,
} from '../types';
import {
  digiturnoService,
  ausenciasService,
  turnosService,
  motorService,
} from '../services';
import { INITIAL_OFFICES } from '../mock/officesData';
import { INITIAL_STAFF } from '../mock/staffData';
import { clearDemoData, STORAGE_KEYS } from '../services/mock/storage';
import { ajustarADiaHabil, ausenciasDelDia, diaSemana, esQuincena, formatoFechaLarga } from '../engine/calendar';
import { aplicarReglas, normalizarReglas, REGLAS_POR_DEFECTO, type ReglasLaborales } from '../engine/reglas';

type EstadoDecision = RedistributionRecommendation['estado'];

const tieneCambiosManuales = (plan: DayPlan) =>
  Object.values(plan.turnos).some((t) => Object.values(t.slots).some((s) => s.esModificadoManual));

/** Fecha base del piloto: el histórico simulado y las ausencias iniciales giran alrededor de este día. */
export const FECHA_BASE = '2026-10-15';

interface AppState {
  // Datos principales
  offices: Office[];
  staff: Staff[];
  absences: Absence[];
  currentPlan: DayPlan | null;
  alerts: Alert[];
  liveMetrics: OfficeRealtimeMetrics[];
  recommendations: RedistributionRecommendation[];

  // Estado operativo y simulación
  selectedDate: string; // YYYY-MM-DD
  currentSlotTime: string; // "11:00"
  isFortnight: boolean;
  isSimulationPaused: boolean;
  sourceMode: 'mock' | 'real';
  isLoading: boolean;
  lastTickTimestamp: number;
  toastMessage: { text: string; type: 'success' | 'warning' | 'info' | 'error' } | null;

  // Reglas laborales que alimentan al motor
  reglas: ReglasLaborales;
  // Decisiones sobre recomendaciones de traslado, por fecha: "YYYY-MM-DD|id" → estado
  decisionesTraslado: Record<string, EstadoDecision>;

  // Acciones
  init: () => Promise<void>;
  tickSimulation: () => Promise<void>;
  toggleSimulation: (pause?: boolean) => void;
  toggleFortnight: () => Promise<void>;
  setSelectedDate: (date: string) => Promise<void>;
  updateReglas: (reglas: ReglasLaborales) => Promise<void>;
  setSourceMode: (mode: 'mock' | 'real') => void;
  clearToast: () => void;
  showToast: (text: string, type?: 'success' | 'warning' | 'info' | 'error') => void;

  // Acciones de Malla y Plan
  approvePlan: (approverName: string) => Promise<void>;
  updateSlot: (colaboradorId: string, franja: string, newEstado: ShiftSlot['estado']) => Promise<void>;
  resetPlanToProposal: () => Promise<void>;

  // Acciones de Ausencias
  createAbsence: (absence: Omit<Absence, 'id'>) => Promise<void>;
  removeAbsence: (id: string) => Promise<void>;

  // Acciones de Redistribución
  acceptRedistribution: (id: string) => Promise<void>;
  rejectRedistribution: (id: string) => Promise<void>;

  // Alertas
  dismissAlert: (id: string) => void;

  // Datos de demostración
  resetDemoData: () => void;

  // Métricas agregadas
  getGlobalKpis: () => {
    totalClientesEnFila: number;
    esperaPromedioMin: number;
    slaGlobal: number;
    personalActivo: number;
    personalRequerido: number;
    oficinasCriticas: number;
  };
}

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => {
      /** Parámetros del motor para la fecha seleccionada y las reglas vigentes. */
      const contexto = () => {
        const { selectedDate, absences, reglas, isFortnight } = get();
        return {
          fecha: selectedDate,
          dia: diaSemana(selectedDate),
          isFortnight,
          ausenciasDia: ausenciasDelDia(absences, selectedDate),
          opciones: {
            duracionAlmuerzoMin: reglas.duracionAlmuerzoMin,
            distanciaMaxPresencialKm: reglas.distanciaMaxPresencialKm,
          },
        };
      };

      /**
       * Recalcula plan, alertas y traslados de la fecha seleccionada.
       * regenerar = true descarta el plan guardado y pide una propuesta nueva al motor
       * (al cambiar reglas, quincena o ausencias); false reutiliza el plan guardado si existe.
       */
      const recalcular = async (regenerar: boolean) => {
        const absences = await ausenciasService.getAbsences();
        set({ absences });
        const ctx = contexto();
        const { offices, staff, currentSlotTime } = get();

        let plan = regenerar ? null : await turnosService.getDayPlan(ctx.fecha);

        // Un plan guardado con otras reglas se regenera, salvo que ya tenga trabajo humano encima
        if (plan && plan.estado !== 'aprobado' && !tieneCambiosManuales(plan)) {
          const firma = JSON.stringify(plan.reglasAplicadas ?? REGLAS_POR_DEFECTO);
          if (firma !== JSON.stringify(get().reglas)) plan = null;
        }

        if (!plan) {
          plan = await motorService.generateDailyPlan(
            ctx.fecha,
            offices,
            staff,
            ctx.ausenciasDia,
            ctx.dia,
            ctx.isFortnight,
            ctx.opciones
          );
          plan.reglasAplicadas = { ...get().reglas };
          await turnosService.saveDayPlan(plan);
        }

        const alerts = await motorService.evaluateAlerts(
          offices,
          staff,
          ctx.ausenciasDia,
          plan,
          currentSlotTime,
          ctx.dia,
          ctx.isFortnight
        );

        const freshRecs = await motorService.getRedistributions(
          offices,
          staff,
          plan,
          currentSlotTime,
          ctx.dia,
          ctx.isFortnight,
          ctx.opciones
        );

        // Conservar las decisiones ya tomadas (aceptada / rechazada) para esta fecha
        const decisiones = get().decisionesTraslado;
        const recommendations = freshRecs.map((r) => ({
          ...r,
          estado: decisiones[`${ctx.fecha}|${r.id}`] ?? r.estado,
        }));

        set({ currentPlan: plan, alerts, recommendations });
      };

      /** Ejecuta un recálculo mostrando el indicador de carga y registrando errores. */
      const conCarga = async (etiqueta: string, tarea: () => Promise<void>) => {
        set({ isLoading: true });
        try {
          await tarea();
        } catch (e) {
          console.error(`Error ${etiqueta}:`, e);
          get().showToast(`No se pudo completar: ${etiqueta}`, 'error');
        } finally {
          set({ isLoading: false });
        }
      };

      const decidirTraslado = (id: string, estado: EstadoDecision) => {
        const fecha = get().selectedDate;
        set({
          recommendations: get().recommendations.map((r) => (r.id === id ? { ...r, estado } : r)),
          decisionesTraslado: { ...get().decisionesTraslado, [`${fecha}|${id}`]: estado },
        });
      };

      return {
        offices: aplicarReglas(INITIAL_OFFICES, REGLAS_POR_DEFECTO),
        staff: INITIAL_STAFF,
        absences: [],
        currentPlan: null,
        alerts: [],
        liveMetrics: [],
        recommendations: [],

        selectedDate: FECHA_BASE,
        currentSlotTime: '11:00',
        isFortnight: esQuincena(FECHA_BASE),
        isSimulationPaused: false,
        sourceMode: 'mock',
        isLoading: true,
        lastTickTimestamp: Date.now(),
        toastMessage: null,

        reglas: REGLAS_POR_DEFECTO,
        decisionesTraslado: {},

        showToast: (text, type = 'info') => {
          set({ toastMessage: { text, type } });
          setTimeout(() => {
            if (get().toastMessage?.text === text) {
              set({ toastMessage: null });
            }
          }, 4500);
        },

        clearToast: () => set({ toastMessage: null }),

        init: async () => {
          // Restaurar la fuente de datos y las reglas guardadas antes de calcular
          digiturnoService.setSourceMode(get().sourceMode);
          set({ offices: aplicarReglas(INITIAL_OFFICES, get().reglas) });

          await conCarga('inicializando el estado', async () => {
            const metrics = await digiturnoService.getLiveMetrics();
            set({ liveMetrics: metrics });
            await recalcular(false);
          });
        },

        tickSimulation: async () => {
          if (get().isSimulationPaused) return;

          try {
            // Obtener nuevas métricas en vivo con variación estocástica
            const updatedMetrics = await digiturnoService.getLiveMetrics();
            const plan = get().currentPlan;

            if (plan) {
              const ctx = contexto();
              const freshAlerts = await motorService.evaluateAlerts(
                get().offices,
                get().staff,
                ctx.ausenciasDia,
                plan,
                get().currentSlotTime,
                ctx.dia,
                ctx.isFortnight
              );

              set({
                liveMetrics: updatedMetrics,
                alerts: freshAlerts,
                lastTickTimestamp: Date.now(),
              });
            } else {
              set({
                liveMetrics: updatedMetrics,
                lastTickTimestamp: Date.now(),
              });
            }
          } catch (error) {
            console.error('Error en tick de simulación:', error);
          }
        },

        toggleSimulation: (pause?: boolean) => {
          const isPaused = pause !== undefined ? pause : !get().isSimulationPaused;
          set({ isSimulationPaused: isPaused });
          get().showToast(
            isPaused ? 'Simulación en vivo pausada' : 'Simulación en vivo reanudada (actualización cada 5 s)',
            'info'
          );
        },

        toggleFortnight: async () => {
          const nextFortnight = !get().isFortnight;
          set({ isFortnight: nextFortnight });
          await conCarga('cambiando el modo quincena', () => recalcular(true));
          get().showToast(
            nextFortnight
              ? 'Modo Quincena Activado: Demanda incrementada en +32% para pagos y facturación'
              : 'Modo Día Estándar: Demanda normal de media quincena',
            'warning'
          );
        },

        setSelectedDate: async (date: string) => {
          const fecha = ajustarADiaHabil(date);
          if (fecha === get().selectedDate) return;
          // La quincena se sugiere según la fecha; el usuario puede cambiarla después
          set({ selectedDate: fecha, isFortnight: esQuincena(fecha) });
          await conCarga('cambiando de día', () => recalcular(false));
          if (fecha !== date) {
            get().showToast('Las oficinas no atienden los domingos: se muestra el lunes siguiente.', 'info');
          }
        },

        updateReglas: async (nuevas: ReglasLaborales) => {
          const reglas = normalizarReglas(nuevas);
          set({ reglas, offices: aplicarReglas(INITIAL_OFFICES, reglas) });
          await conCarga('aplicando las reglas', () => recalcular(true));
          get().showToast(
            `Reglas aplicadas: la malla del ${formatoFechaLarga(get().selectedDate)} se recalculó con SLA ${Math.round(
              reglas.slaObjetivo * 100
            )}% y almuerzo de ${reglas.duracionAlmuerzoMin} min.`,
            'success'
          );
        },

        setSourceMode: (mode) => {
          digiturnoService.setSourceMode(mode);
          set({ sourceMode: mode });
          get().showToast(
            mode === 'mock'
              ? 'Conexión a Digiturno: Modo Simulado Activo'
              : 'Conexión a Digiturno: Modo API Real Configurado',
            'info'
          );
        },

        approvePlan: async (approverName: string) => {
          const plan = get().currentPlan;
          if (!plan) return;

          try {
            const approved = await turnosService.approveDayPlan(plan.fecha, approverName);
            set({ currentPlan: approved });
            get().showToast(
              `Plan del día ${plan.fecha} aprobado exitosamente por ${approverName}`,
              'success'
            );
          } catch (e) {
            console.error('Error aprobando plan:', e);
            get().showToast('Error al registrar la aprobación del plan', 'error');
          }
        },

        updateSlot: async (colaboradorId, franja, newEstado) => {
          const plan = get().currentPlan;
          if (!plan) return;

          try {
            const updated = await turnosService.updateSlot(plan.fecha, colaboradorId, franja, {
              estado: newEstado,
            });
            set({ currentPlan: updated });
          } catch (e) {
            console.error('Error actualizando slot:', e);
          }
        },

        resetPlanToProposal: async () => {
          const plan = get().currentPlan;
          if (!plan) return;

          try {
            const reset = await turnosService.resetToProposal(plan.fecha);
            set({ currentPlan: reset });
            get().showToast('Malla restaurada a la propuesta algorítmica original del motor', 'info');
          } catch (e) {
            console.error('Error restaurando propuesta:', e);
          }
        },

        createAbsence: async (data) => {
          await conCarga('registrando la ausencia', async () => {
            await ausenciasService.createAbsence(data);
            // Regenerar plan y evaluar impacto de la nueva ausencia
            await recalcular(true);
            const staffMember = get().staff.find((s) => s.id === data.colaboradorId);
            get().showToast(
              `Ausencia registrada para ${staffMember?.nombre || 'colaborador'}. Malla de turnos y alertas recalculadas.`,
              'warning'
            );
          });
        },

        removeAbsence: async (id) => {
          await conCarga('eliminando la ausencia', async () => {
            await ausenciasService.deleteAbsence(id);
            await recalcular(true);
            get().showToast('Ausencia eliminada y puestos reintegrados a la malla.', 'info');
          });
        },

        acceptRedistribution: async (id) => {
          const rec = get().recommendations.find((r) => r.id === id);
          if (!rec || !get().currentPlan) return;

          // Ajustamos la malla (sobre una copia): marcamos en la oficina destino como apoyo
          const plan: DayPlan = JSON.parse(JSON.stringify(get().currentPlan));
          const slots = plan.turnos[rec.colaboradorId]?.slots;
          if (slots) {
            const targetState = rec.modalidad === 'presencial' ? 'apoyo_presencial' : 'apoyo_virtual';
            Object.keys(slots).forEach((franja) => {
              // Solo se reasignan las franjas en que atiende: se respetan su almuerzo y pausas
              if (franja >= rec.franjaInicio && franja <= rec.franjaFin && slots[franja].estado === 'atencion') {
                slots[franja] = {
                  franja,
                  estado: targetState,
                  oficinaAsignadaId: rec.oficinaDestinoId,
                  esModificadoManual: true,
                  nota: `Redistribución aprobada: apoyo a ${rec.oficinaDestinoNombre}`,
                };
              }
            });
          }

          await turnosService.saveDayPlan(plan, { esPropuesta: false });
          set({ currentPlan: plan });
          decidirTraslado(id, 'aceptada');
          get().showToast(
            `Traslado aceptado: ${rec.colaboradorNombre} apoyará a ${rec.oficinaDestinoNombre} (${rec.modalidad}).`,
            'success'
          );
        },

        rejectRedistribution: async (id) => {
          decidirTraslado(id, 'rechazada');
          get().showToast('Recomendación de redistribución descartada.', 'info');
        },

        dismissAlert: (id) => {
          set({ alerts: get().alerts.filter((a) => a.id !== id) });
        },

        resetDemoData: () => {
          clearDemoData();
          // Recargar para que los servicios vuelvan a los datos iniciales
          window.location.reload();
        },

        getGlobalKpis: () => {
          const metrics = get().liveMetrics;
          if (!metrics || metrics.length === 0) {
            return {
              totalClientesEnFila: 0,
              esperaPromedioMin: 0,
              slaGlobal: 0.8,
              personalActivo: 32,
              personalRequerido: 34,
              oficinasCriticas: 0,
            };
          }

          const totalFila = metrics.reduce((acc, m) => acc + m.clientesEnFila, 0);
          const avgWait = metrics.reduce((acc, m) => acc + m.esperaPromedioMin, 0) / metrics.length;
          const avgSla = metrics.reduce((acc, m) => acc + m.slaActual, 0) / metrics.length;
          const totalActivos = metrics.reduce((acc, m) => acc + m.agentesActivos, 0);
          const totalReq = metrics.reduce((acc, m) => acc + m.agentesRequeridos, 0);
          const criticas = metrics.filter((m) => m.estadoSla === 'critico').length;

          return {
            totalClientesEnFila: totalFila,
            esperaPromedioMin: Number(avgWait.toFixed(1)),
            slaGlobal: Number(avgSla.toFixed(3)),
            personalActivo: totalActivos,
            personalRequerido: totalReq,
            oficinasCriticas: criticas,
          };
        },
      };
    },
    {
      name: STORAGE_KEYS.app,
      version: 2,
      // Solo se guardan preferencias, reglas y decisiones; el plan y las ausencias los guardan los servicios
      partialize: (state) => ({
        selectedDate: state.selectedDate,
        isFortnight: state.isFortnight,
        isSimulationPaused: state.isSimulationPaused,
        sourceMode: state.sourceMode,
        reglas: state.reglas,
        decisionesTraslado: state.decisionesTraslado,
      }),
      // La versión 1 guardaba la lista de recomendaciones; se descarta sin perder lo demás
      migrate: (persisted) => {
        const { recommendations: _descartadas, ...resto } = (persisted ?? {}) as Record<string, unknown>;
        return resto as unknown as Pick<
          AppState,
          'selectedDate' | 'isFortnight' | 'isSimulationPaused' | 'sourceMode' | 'reglas' | 'decisionesTraslado'
        >;
      },
    }
  )
);
