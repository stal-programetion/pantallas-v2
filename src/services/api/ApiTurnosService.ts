import type { ITurnosService } from '../contracts/ITurnosService';
import type { DayPlan, ShiftSlot } from '../../types';
import { apiFetch } from '../httpClient';

export interface SlotValidationResponse {
  isValid: boolean;
  warningMessage?: string | null;
  before: number;
  after: number;
  required: number;
}

export class ApiTurnosService implements ITurnosService {
  async getDayPlan(date: string): Promise<DayPlan | null> {
    return apiFetch<DayPlan>(`/plans/${encodeURIComponent(date)}`);
  }

  async saveDayPlan(plan: DayPlan): Promise<DayPlan> {
    return apiFetch<DayPlan>(`/plans/${encodeURIComponent(plan.fecha)}`);
  }

  async generateDayPlan(
    fecha: string,
    isFortnight: boolean = true,
    dayOfWeek: number = 1
  ): Promise<DayPlan> {
    return apiFetch<DayPlan>('/plans/generate', {
      method: 'POST',
      body: JSON.stringify({ fecha, isFortnight, dayOfWeek }),
    });
  }

  async approveDayPlan(date: string, approverName: string): Promise<DayPlan> {
    return apiFetch<DayPlan>(`/plans/${encodeURIComponent(date)}/approve`, {
      method: 'POST',
      body: JSON.stringify({ approverName }),
    });
  }

  async validateSlot(
    date: string,
    colaboradorId: string,
    franja: string,
    estado: ShiftSlot['estado']
  ): Promise<SlotValidationResponse> {
    return apiFetch<SlotValidationResponse>(`/plans/${encodeURIComponent(date)}/slots/validate`, {
      method: 'POST',
      body: JSON.stringify({ colaboradorId, franja, estado }),
    });
  }

  async updateSlot(
    date: string,
    colaboradorId: string,
    franja: string,
    newSlot: Partial<ShiftSlot>
  ): Promise<DayPlan> {
    return apiFetch<DayPlan>(`/plans/${encodeURIComponent(date)}/slots`, {
      method: 'PATCH',
      body: JSON.stringify({
        colaboradorId,
        franja,
        estado: newSlot.estado,
        oficinaAsignadaId: newSlot.oficinaAsignadaId,
        nota: newSlot.nota,
      }),
    });
  }

  async resetToProposal(date: string): Promise<DayPlan> {
    return apiFetch<DayPlan>(`/plans/${encodeURIComponent(date)}/reset`, {
      method: 'POST',
    });
  }

  async importDayPlanExcel(date: string, file: File): Promise<DayPlan> {
    const form = new FormData();
    form.append('file', file);
    return apiFetch<DayPlan>(`/plans/${encodeURIComponent(date)}/import-excel`, {
      method: 'POST',
      body: form,
    });
  }
}
