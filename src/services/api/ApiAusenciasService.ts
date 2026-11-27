import type { IAusenciasService } from '../contracts/IAusenciasService';
import type { Absence, Alert, DayPlan, RedistributionRecommendation } from '../../types';
import { apiFetch } from '../httpClient';

export interface AbsenceMutationResponse {
  absence: Absence;
  plan: DayPlan;
  alerts: Alert[];
  recommendations: RedistributionRecommendation[];
}

export interface AbsenceDeleteResponse {
  deleted: boolean;
  plan: DayPlan;
  alerts: Alert[];
  recommendations: RedistributionRecommendation[];
}

export class ApiAusenciasService implements IAusenciasService {
  async getAbsences(): Promise<Absence[]> {
    return apiFetch<Absence[]>('/absences');
  }

  async getActiveAbsences(): Promise<Absence[]> {
    return apiFetch<Absence[]>('/absences?estado=activa');
  }

  async createAbsence(data: Omit<Absence, 'id'>): Promise<Absence> {
    const res = await this.createAbsenceWithRecalc(data);
    return res.absence;
  }

  async createAbsenceWithRecalc(
    data: Omit<Absence, 'id'>,
    fecha: string = '2026-10-15'
  ): Promise<AbsenceMutationResponse> {
    return apiFetch<AbsenceMutationResponse>(`/absences?fecha=${encodeURIComponent(fecha)}`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateAbsence(id: string, data: Partial<Absence>): Promise<Absence> {
    return apiFetch<Absence>(`/absences/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  async deleteAbsence(id: string): Promise<boolean> {
    const res = await this.deleteAbsenceWithRecalc(id);
    return res.deleted;
  }

  async deleteAbsenceWithRecalc(
    id: string,
    fecha: string = '2026-10-15'
  ): Promise<AbsenceDeleteResponse> {
    return apiFetch<AbsenceDeleteResponse>(
      `/absences/${encodeURIComponent(id)}?fecha=${encodeURIComponent(fecha)}`,
      { method: 'DELETE' }
    );
  }

  async importAbsencesExcel(
    file: File,
    fecha: string = '2026-10-15'
  ): Promise<{ inserted: number; totalParsed: number }> {
    const form = new FormData();
    form.append('file', file);
    return apiFetch<{ inserted: number; totalParsed: number }>(
      `/absences/import-excel?fecha=${encodeURIComponent(fecha)}`,
      { method: 'POST', body: form }
    );
  }
}
