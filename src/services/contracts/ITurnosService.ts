import type { DayPlan, ShiftSlot } from '../../types';

export interface SaveDayPlanOptions {
  /**
   * true (por defecto): el plan viene del motor y reemplaza la propuesta original.
   * false: es un ajuste sobre el plan vigente (p. ej. una redistribución aceptada).
   */
  esPropuesta?: boolean;
}

export interface ITurnosService {
  getDayPlan(date: string): Promise<DayPlan | null>;
  saveDayPlan(plan: DayPlan, options?: SaveDayPlanOptions): Promise<DayPlan>;
  approveDayPlan(date: string, approverName: string): Promise<DayPlan>;
  updateSlot(
    date: string,
    colaboradorId: string,
    franja: string,
    newSlot: Partial<ShiftSlot>
  ): Promise<DayPlan>;
  resetToProposal(date: string): Promise<DayPlan>;
}
