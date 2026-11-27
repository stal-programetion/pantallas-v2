import { create } from 'zustand';
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
  apiAusenciasService,
  apiCatalogService,
  apiDigiturnoService,
  apiMotorService,
  apiTurnosService,
  buildApiUrl,
  type NetworkLoadPoint,
  type PeaksSummaryResponse,
  type SystemRules,
  type UserBehaviorResponse,
} from '../services';
import { useAuthStore } from './useAuthStore';

const DEFAULT_SLOTS = [
  '07:00', '07:30', '08:00', '08:30', '09:00', '09:30',
  '10:00', '10:30', '11:00', '11:30', '12:00', '12:30',
  '13:00', '13:30', '14:00', '14:30', '15:00', '15:30', '16:00',
];

let sseSource: EventSource | null = null;

interface AppState {
  offices: Office[];
  staff: Staff[];
  absences: Absence[];
  currentPlan: (DayPlan & { slaProyectadoRed?: number }) | null;
  alerts: Alert[];
  liveMetrics: OfficeRealtimeMetrics[];
  recommendations: RedistributionRecommendation[];

  operatingSlots: string[];
  requiredAgentsByOffice: Record<string, number[]>;
  networkLoad: NetworkLoadPoint[];
  userBehavior: UserBehaviorResponse | null;
  peaksSummary: PeaksSummaryResponse | null;
  systemRules: SystemRules | null;

  selectedDate: string;
  currentSlotTime: string;
  isFortnight: boolean;
  isSimulationPaused: boolean;
  sourceMode: 'mock' | 'real';
  isLoading: boolean;
  error: string | null;
  lastTickTimestamp: number;
  toastMessage: { text: string; type: 'success' | 'warning' | 'info' | 'error' } | null;

  init: () => Promise<void>;
  connectRealtime: () => void;
  disconnectRealtime: () => void;
  tickSimulation: () => Promise<void>;
  toggleSimulation: (pause?: boolean) => void;
  toggleFortnight: () => Promise<void>;
  setSourceMode: (mode: 'mock' | 'real') => void;
  clearToast: () => void;
  showToast: (text: string, type?: 'success' | 'warning' | 'info' | 'error') => void;

  approvePlan: (approverName: string) => Promise<void>;
  updateSlot: (colaboradorId: string, franja: string, newEstado: ShiftSlot['estado']) => Promise<void>;
  resetPlanToProposal: () => Promise<void>;

  reloadAbsences: () => Promise<void>;
  createAbsence: (absence: Omit<Absence, 'id'>) => Promise<void>;
  removeAbsence: (id: string) => Promise<void>;

  acceptRedistribution: (id: string) => Promise<void>;
  rejectRedistribution: (id: string) => Promise<void>;
  editRedistribution: (
    id: string,
    data: { modalidad?: 'presencial' | 'virtual'; franjaInicio?: string; franjaFin?: string }
  ) => Promise<void>;
  requestOfficeSupport: (officeId: string) => Promise<void>;
  releaseOfficeStaff: (officeId: string) => Promise<void>;

  updateOffice: (officeId: string, data: Partial<Office>) => Promise<void>;
  updateRules: (data: Partial<SystemRules>) => Promise<void>;
  dismissAlert: (id: string) => Promise<void>;

  getGlobalKpis: () => {
    totalClientesEnFila: number;
    esperaPromedioMin: number;
    slaGlobal: number;
    personalActivo: number;
    personalRequerido: number;
    oficinasCriticas: number;
  };
}

export const useAppStore = create<AppState>((set, get) => ({
  offices: [],
  staff: [],
  absences: [],
  currentPlan: null,
  alerts: [],
  liveMetrics: [],
  recommendations: [],

  operatingSlots: DEFAULT_SLOTS,
  requiredAgentsByOffice: {},
  networkLoad: [],
  userBehavior: null,
  peaksSummary: null,
  systemRules: null,

  selectedDate: '2026-10-15',
  currentSlotTime: '10:00',
  isFortnight: true,
  isSimulationPaused: false,
  sourceMode: 'mock',
  isLoading: true,
  error: null,
  lastTickTimestamp: Date.now(),
  toastMessage: null,

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
    set({ isLoading: true, error: null });
    try {
      await useAuthStore.getState().initSession();
      const fecha = get().selectedDate;
      const isFortnight = get().isFortnight;
      const currentSlot = get().currentSlotTime;

      const [
        offices,
        staff,
        absences,
        plan,
        metrics,
        alerts,
        recommendations,
        reqMatrix,
        netLoad,
        behavior,
        peaks,
        rules,
      ] = await Promise.all([
        apiCatalogService.getOffices(),
        apiCatalogService.getStaff(),
        apiAusenciasService.getAbsences(),
        apiTurnosService.getDayPlan(fecha),
        apiDigiturnoService.getLiveMetrics(isFortnight),
        apiMotorService.evaluateAlerts(),
        apiMotorService.getRedistributions(undefined, undefined, { fecha } as DayPlan),
        apiMotorService.getRequiredAgents(4, isFortnight),
        apiDigiturnoService.getNetworkLoad(isFortnight, currentSlot),
        apiDigiturnoService.getUserBehavior(),
        apiMotorService.getPeaksSummary(1, isFortnight),
        apiCatalogService.getRules(),
      ]);

      set({
        offices,
        staff,
        absences,
        currentPlan: plan,
        liveMetrics: metrics,
        alerts,
        recommendations,
        operatingSlots: reqMatrix.operatingSlots.length ? reqMatrix.operatingSlots : DEFAULT_SLOTS,
        requiredAgentsByOffice: reqMatrix.requiredByOffice,
        networkLoad: netLoad.series,
        userBehavior: behavior,
        peaksSummary: peaks,
        systemRules: rules,
        sourceMode: rules.sourceMode,
        isLoading: false,
        lastTickTimestamp: Date.now(),
      });

      get().connectRealtime();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error conectando con el backend Surtigas';
      console.error('Error inicializando estado:', err);
      set({ isLoading: false, error: msg });
    }
  },

  connectRealtime: () => {
    if (sseSource) {
      sseSource.close();
      sseSource = null;
    }
    try {
      const source = new EventSource(buildApiUrl('/realtime/stream'));
      source.onmessage = (evt) => {
        if (get().isSimulationPaused) return;
        try {
          const payload = JSON.parse(evt.data);
          if (payload.type === 'metrics_update') {
            set({
              liveMetrics: payload.liveMetrics ?? get().liveMetrics,
              alerts: payload.alerts ?? get().alerts,
              lastTickTimestamp: Date.now(),
            });
          }
        } catch {
          // Ignorar heartbeats malformados
        }
      };
      sseSource = source;
    } catch {
      // Fallback sin SSE
    }
  },

  disconnectRealtime: () => {
    if (sseSource) {
      sseSource.close();
      sseSource = null;
    }
  },

  tickSimulation: async () => {
    if (get().isSimulationPaused) return;
    try {
      const [updatedMetrics, freshAlerts] = await Promise.all([
        apiDigiturnoService.getLiveMetrics(get().isFortnight),
        apiMotorService.evaluateAlerts(),
      ]);
      set({
        liveMetrics: updatedMetrics,
        alerts: freshAlerts,
        lastTickTimestamp: Date.now(),
      });
    } catch (error) {
      console.error('Error en actualización en vivo:', error);
    }
  },

  toggleSimulation: (pause?: boolean) => {
    const isPaused = pause !== undefined ? pause : !get().isSimulationPaused;
    set({ isSimulationPaused: isPaused });
    get().showToast(
      isPaused ? 'Actualización en vivo pausada' : 'Actualización en vivo reanudada (SSE activo)',
      'info'
    );
  },

  toggleFortnight: async () => {
    const nextFortnight = !get().isFortnight;
    const fecha = get().selectedDate;
    set({ isFortnight: nextFortnight, isLoading: true });
    try {
      const plan = await apiTurnosService.generateDayPlan(fecha, nextFortnight, 1);
      const [alerts, recs, reqMatrix, netLoad, peaks, metrics] = await Promise.all([
        apiMotorService.evaluateAlerts(),
        apiMotorService.getRedistributions(undefined, undefined, plan),
        apiMotorService.getRequiredAgents(4, nextFortnight),
        apiDigiturnoService.getNetworkLoad(nextFortnight, get().currentSlotTime),
        apiMotorService.getPeaksSummary(1, nextFortnight),
        apiDigiturnoService.getLiveMetrics(nextFortnight),
      ]);

      set({
        currentPlan: plan,
        alerts,
        recommendations: recs,
        requiredAgentsByOffice: reqMatrix.requiredByOffice,
        networkLoad: netLoad.series,
        peaksSummary: peaks,
        liveMetrics: metrics,
        isLoading: false,
      });

      get().showToast(
        nextFortnight
          ? 'Modo Quincena Activado: Demanda ajustada para días de cobro y facturación'
          : 'Modo Día Estándar: Demanda normal de media quincena',
        'warning'
      );
    } catch (err) {
      set({ isLoading: false });
      get().showToast(err instanceof Error ? err.message : 'Error al recalcular modo quincena', 'error');
    }
  },

  setSourceMode: (mode) => {
    apiDigiturnoService.setSourceMode(mode);
    set({ sourceMode: mode });
    get().showToast(
      mode === 'mock'
        ? 'Conexión a Digiturno: SimulatedLiveSource Activo'
        : 'Conexión a Digiturno: Fuente Histórica Excel Activa',
      'info'
    );
  },

  approvePlan: async (approverName: string) => {
    const plan = get().currentPlan;
    if (!plan) return;
    try {
      const approved = await apiTurnosService.approveDayPlan(plan.fecha, approverName);
      set({ currentPlan: approved });
      get().showToast(`Plan del día ${plan.fecha} aprobado exitosamente por ${approverName}`, 'success');
    } catch (e) {
      get().showToast(e instanceof Error ? e.message : 'Error al aprobar el plan', 'error');
    }
  },

  updateSlot: async (colaboradorId, franja, newEstado) => {
    const plan = get().currentPlan;
    if (!plan) return;
    try {
      const updated = await apiTurnosService.updateSlot(plan.fecha, colaboradorId, franja, {
        estado: newEstado,
      });
      set({ currentPlan: updated });
    } catch (e) {
      get().showToast(e instanceof Error ? e.message : 'Error actualizando casilla', 'error');
    }
  },

  resetPlanToProposal: async () => {
    const plan = get().currentPlan;
    if (!plan) return;
    try {
      const reset = await apiTurnosService.resetToProposal(plan.fecha);
      set({ currentPlan: reset });
      get().showToast('Malla restaurada a la propuesta algorítmica original del motor', 'info');
    } catch (e) {
      get().showToast(e instanceof Error ? e.message : 'Error restaurando propuesta', 'error');
    }
  },

  reloadAbsences: async () => {
    try {
      const [absences, staff] = await Promise.all([
        apiAusenciasService.getAbsences(),
        apiCatalogService.getStaff(),
      ]);
      set({ absences, staff });
    } catch {
      // ignore
    }
  },

  createAbsence: async (data) => {
    set({ isLoading: true });
    try {
      const res = await apiAusenciasService.createAbsenceWithRecalc(data, get().selectedDate);
      const [updatedAbsences, peaks, metrics] = await Promise.all([
        apiAusenciasService.getAbsences(),
        apiMotorService.getPeaksSummary(1, get().isFortnight),
        apiDigiturnoService.getLiveMetrics(get().isFortnight),
      ]);

      set({
        absences: updatedAbsences,
        currentPlan: res.plan,
        alerts: res.alerts,
        recommendations: res.recommendations,
        peaksSummary: peaks,
        liveMetrics: metrics,
        isLoading: false,
      });

      const staffMember = get().staff.find((s) => s.id === data.colaboradorId);
      get().showToast(
        `Ausencia registrada para ${staffMember?.nombre || 'colaborador'}. Malla de turnos y alertas recalculadas.`,
        'warning'
      );
    } catch (e) {
      set({ isLoading: false });
      get().showToast(e instanceof Error ? e.message : 'Error registrando ausencia', 'error');
    }
  },

  removeAbsence: async (id) => {
    set({ isLoading: true });
    try {
      const res = await apiAusenciasService.deleteAbsenceWithRecalc(id, get().selectedDate);
      const [updatedAbsences, peaks, metrics] = await Promise.all([
        apiAusenciasService.getAbsences(),
        apiMotorService.getPeaksSummary(1, get().isFortnight),
        apiDigiturnoService.getLiveMetrics(get().isFortnight),
      ]);

      set({
        absences: updatedAbsences,
        currentPlan: res.plan,
        alerts: res.alerts,
        recommendations: res.recommendations,
        peaksSummary: peaks,
        liveMetrics: metrics,
        isLoading: false,
      });

      get().showToast('Ausencia eliminada y puestos reintegrados a la malla.', 'info');
    } catch (e) {
      set({ isLoading: false });
      get().showToast(e instanceof Error ? e.message : 'Error eliminando ausencia', 'error');
    }
  },

  acceptRedistribution: async (id) => {
    try {
      const updatedRec = await apiMotorService.acceptRedistribution(id);
      const freshPlan = await apiTurnosService.getDayPlan(get().selectedDate);
      set({
        recommendations: get().recommendations.map((r) => (r.id === id ? updatedRec : r)),
        currentPlan: freshPlan,
      });
      get().showToast(
        `Traslado aceptado: ${updatedRec.colaboradorNombre} apoyará a ${updatedRec.oficinaDestinoNombre} (${updatedRec.modalidad}).`,
        'success'
      );
    } catch (e) {
      get().showToast(e instanceof Error ? e.message : 'Error aceptando redistribución', 'error');
    }
  },

  rejectRedistribution: async (id) => {
    try {
      const updatedRec = await apiMotorService.rejectRedistribution(id);
      set({
        recommendations: get().recommendations.map((r) => (r.id === id ? updatedRec : r)),
      });
      get().showToast('Recomendación de redistribución descartada y auditada.', 'info');
    } catch (e) {
      get().showToast(e instanceof Error ? e.message : 'Error rechazando redistribución', 'error');
    }
  },

  editRedistribution: async (id, data) => {
    try {
      const updatedRec = await apiMotorService.editRedistribution(id, data);
      set({
        recommendations: get().recommendations.map((r) => (r.id === id ? updatedRec : r)),
      });
      get().showToast('Propuesta de redistribución actualizada y registrada en auditoría.', 'success');
    } catch (e) {
      get().showToast(e instanceof Error ? e.message : 'Error editando redistribución', 'error');
    }
  },

  requestOfficeSupport: async (officeId) => {
    try {
      const newRec = await apiCatalogService.requestSupport(officeId);
      const exists = get().recommendations.some((r) => r.id === newRec.id);
      set({
        recommendations: exists
          ? get().recommendations.map((r) => (r.id === newRec.id ? newRec : r))
          : [newRec, ...get().recommendations],
      });
      get().showToast(
        `Refuerzo ${newRec.modalidad} generado para ${newRec.oficinaDestinoNombre}.`,
        'info'
      );
    } catch (e) {
      get().showToast(e instanceof Error ? e.message : 'Error solicitando refuerzo', 'error');
    }
  },

  releaseOfficeStaff: async (officeId) => {
    try {
      const res = await apiCatalogService.releaseStaff(officeId);
      get().showToast(res.message, 'success');
    } catch (e) {
      get().showToast(e instanceof Error ? e.message : 'Error liberando personal', 'error');
    }
  },

  updateOffice: async (officeId, data) => {
    try {
      const updated = await apiCatalogService.updateOffice(officeId, data);
      set({
        offices: get().offices.map((o) => (o.id === officeId ? updated : o)),
      });
      get().showToast(`Oficina ${updated.nombre} actualizada correctamente`, 'success');
    } catch (e) {
      get().showToast(e instanceof Error ? e.message : 'Error actualizando oficina', 'error');
    }
  },

  updateRules: async (data) => {
    try {
      const updated = await apiCatalogService.updateRules(data);
      set({ systemRules: updated });
      get().showToast('Reglas laborales y umbrales SLA guardados en base de datos', 'success');
    } catch (e) {
      get().showToast(e instanceof Error ? e.message : 'Error guardando reglas', 'error');
    }
  },

  dismissAlert: async (id) => {
    set({ alerts: get().alerts.filter((a) => a.id !== id) });
    try {
      await apiMotorService.dismissAlert(id);
    } catch {
      // ignore if already dismissed
    }
  },

  getGlobalKpis: () => {
    const metrics = get().liveMetrics;
    if (!metrics || metrics.length === 0) {
      return {
        totalClientesEnFila: 0,
        esperaPromedioMin: 0,
        slaGlobal: 0.8,
        personalActivo: 0,
        personalRequerido: 0,
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
}));
