import type { DayPlan, ShiftSlot } from '../../types';

export interface ITurnosService {
  getDayPlan(date: string): Promise<DayPlan | null>;
  saveDayPlan(plan: DayPlan): Promise<DayPlan>;
  approveDayPlan(date: string, approverName: string): Promise<DayPlan>;
  updateSlot(
    date: string,
    colaboradorId: string,
    franja: string,
    newSlot: Partial<ShiftSlot>
  ): Promise<DayPlan>;
  resetToProposal(date: string): Promise<DayPlan>;
}
