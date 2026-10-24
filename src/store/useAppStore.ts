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
  digiturnoService,
  ausenciasService,
  turnosService,
  motorService,
} from '../services';
import { INITIAL_OFFICES } from '../mock/officesData';
import { INITIAL_STAFF } from '../mock/staffData';

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

  // Acciones
  init: () => Promise<void>;
  tickSimulation: () => Promise<void>;
  toggleSimulation: (pause?: boolean) => void;
  toggleFortnight: () => Promise<void>;
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

export const useAppStore = create<AppState>((set, get) => ({
  offices: INITIAL_OFFICES,
  staff: INITIAL_STAFF,
  absences: [],
  currentPlan: null,
  alerts: [],
  liveMetrics: [],
  recommendations: [],

  selectedDate: '2026-10-15',
  currentSlotTime: '11:00',
  isFortnight: true, // Quincena activa por defecto para mostrar el comportamiento enriquecido
  isSimulationPaused: false,
  sourceMode: 'mock',
  isLoading: true,
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
    set({ isLoading: true });
    try {
      const absences = await ausenciasService.getAbsences();
      const metrics = await digiturnoService.getLiveMetrics();

      // Generar propuesta de plan del día con el motor
      const plan = await motorService.generateDailyPlan(
        get().selectedDate,
        get().offices,
        get().staff,
        absences,
        4, // Jueves
        get().isFortnight
      );

      await turnosService.saveDayPlan(plan);

      // Evaluar alertas y redistribuciones
      const alerts = await motorService.evaluateAlerts(
        get().offices,
        get().staff,
        absences,
        plan,
        get().currentSlotTime
      );

      const recommendations = await motorService.getRedistributions(
        get().offices,
        get().staff,
        plan,
        get().currentSlotTime,
        4,
        get().isFortnight
      );

      set({
        absences,
        currentPlan: plan,
        liveMetrics: metrics,
        alerts,
        recommendations,
        isLoading: false,
      });
    } catch (err) {
      console.error('Error inicializando estado:', err);
      set({ isLoading: false });
    }
  },

  tickSimulation: async () => {
    if (get().isSimulationPaused) return;

    try {
      // Obtener nuevas métricas en vivo con variación estocástica
      const updatedMetrics = await digiturnoService.getLiveMetrics();
      const plan = get().currentPlan;

      if (plan) {
        const freshAlerts = await motorService.evaluateAlerts(
          get().offices,
          get().staff,
          get().absences,
          plan,
          get().currentSlotTime
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
    set({ isFortnight: nextFortnight, isLoading: true });

    const plan = await motorService.generateDailyPlan(
      get().selectedDate,
      get().offices,
      get().staff,
      get().absences,
      4,
      nextFortnight
    );
    await turnosService.saveDayPlan(plan);

    const alerts = await motorService.evaluateAlerts(
      get().offices,
      get().staff,
      get().absences,
      plan,
      get().currentSlotTime
    );

    const recs = await motorService.getRedistributions(
      get().offices,
      get().staff,
      plan,
      get().currentSlotTime,
      4,
      nextFortnight
    );

    set({
      currentPlan: plan,
      alerts,
      recommendations: recs,
      isLoading: false,
    });

    get().showToast(
      nextFortnight
        ? 'Modo Quincena Activado: Demanda incrementada en +32% para pagos y facturación'
        : 'Modo Día Estándar: Demanda normal de media quincena',
      'warning'
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
    set({ isLoading: true });
    try {
      const newAbsence = await ausenciasService.createAbsence(data);
      const updatedAbsences = await ausenciasService.getAbsences();

      // Regenerar plan y evaluar impacto de la nueva ausencia
      const newPlan = await motorService.generateDailyPlan(
        get().selectedDate,
        get().offices,
        get().staff,
        updatedAbsences,
        4,
        get().isFortnight
      );
      await turnosService.saveDayPlan(newPlan);

      const alerts = await motorService.evaluateAlerts(
        get().offices,
        get().staff,
        updatedAbsences,
        newPlan,
        get().currentSlotTime
      );

      const recommendations = await motorService.getRedistributions(
        get().offices,
        get().staff,
        newPlan,
        get().currentSlotTime,
        4,
        get().isFortnight
      );

      set({
        absences: updatedAbsences,
        currentPlan: newPlan,
        alerts,
        recommendations,
        isLoading: false,
      });

      const staffMember = get().staff.find((s) => s.id === data.colaboradorId);
      get().showToast(
        `Ausencia registrada para ${staffMember?.nombre || 'colaborador'}. Malla de turnos y alertas recalculadas.`,
        'warning'
      );
    } catch (e) {
      console.error('Error creando ausencia:', e);
      set({ isLoading: false });
    }
  },

  removeAbsence: async (id) => {
    set({ isLoading: true });
    try {
      await ausenciasService.deleteAbsence(id);
      const updatedAbsences = await ausenciasService.getAbsences();

      const newPlan = await motorService.generateDailyPlan(
        get().selectedDate,
        get().offices,
        get().staff,
        updatedAbsences,
        4,
        get().isFortnight
      );
      await turnosService.saveDayPlan(newPlan);

      set({
        absences: updatedAbsences,
        currentPlan: newPlan,
        isLoading: false,
      });

      get().showToast('Ausencia eliminada y puestos reintegrados a la malla.', 'info');
    } catch (e) {
      console.error('Error eliminando ausencia:', e);
      set({ isLoading: false });
    }
  },

  acceptRedistribution: async (id) => {
    const rec = get().recommendations.find((r) => r.id === id);
    if (!rec || !get().currentPlan) return;

    // Actualizamos la recomendación a aceptada
    const updatedRecs = get().recommendations.map((r) =>
      r.id === id ? { ...r, estado: 'aceptada' as const } : r
    );

    // Ajustamos la malla: marcamos en la oficina destino como apoyo
    const plan = get().currentPlan!;
    const slots = plan.turnos[rec.colaboradorId]?.slots;
    if (slots) {
      const targetState = rec.modalidad === 'presencial' ? 'apoyo_presencial' : 'apoyo_virtual';
      Object.keys(slots).forEach((franja) => {
        if (franja >= rec.franjaInicio && franja <= rec.franjaFin) {
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

    set({ recommendations: updatedRecs, currentPlan: { ...plan } });
    get().showToast(
      `Traslado aceptado: ${rec.colaboradorNombre} apoyará a ${rec.oficinaDestinoNombre} (${rec.modalidad}).`,
      'success'
    );
  },

  rejectRedistribution: async (id) => {
    const updatedRecs = get().recommendations.map((r) =>
      r.id === id ? { ...r, estado: 'rechazada' as const } : r
    );
    set({ recommendations: updatedRecs });
    get().showToast('Recomendación de redistribución descartada.', 'info');
  },

  dismissAlert: (id) => {
    set({ alerts: get().alerts.filter((a) => a.id !== id) });
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
}));
