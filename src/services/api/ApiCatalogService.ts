import type { Office, RedistributionRecommendation, Staff } from '../../types';
import { apiFetch } from '../httpClient';

export interface SystemRules {
  targetSla: number;
  maxWaitMin: number;
  maxPresencialKm: number;
  lunchDurationMin: number;
  fortnightMultiplier: number;
  minAgentsOpenOffice: number;
  sourceMode: 'mock' | 'real';
}

export interface ReportSummaryResponse {
  range: string;
  slaRedPct: number;
  esperaMediaMin: number;
  utilizacionPct: number;
  tiempoAhorradoMinDia: number;
  horasMesAhorradas: number;
  tasaAbandonoPct: number;
  oficinas: Array<{
    oficinaId: string;
    nombre: string;
    ciudad: string;
    departamento: string;
    capacidadPuestos: number;
    clientesEnFila: number;
    esperaPromedioMin: number;
    slaActual: number;
    estadoSla: 'optimo' | 'alerta' | 'critico';
    tasaAbandonoPct: number;
  }>;
}

export const apiCatalogService = {
  async getOffices(): Promise<Office[]> {
    return apiFetch<Office[]>('/offices');
  },

  async updateOffice(officeId: string, data: Partial<Office>): Promise<Office> {
    return apiFetch<Office>(`/offices/${encodeURIComponent(officeId)}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  },

  async getStaff(): Promise<Staff[]> {
    return apiFetch<Staff[]>('/staff');
  },

  async getRules(): Promise<SystemRules> {
    return apiFetch<SystemRules>('/settings/rules');
  },

  async updateRules(data: Partial<SystemRules>): Promise<SystemRules> {
    return apiFetch<SystemRules>('/settings/rules', {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  async requestSupport(officeId: string): Promise<RedistributionRecommendation> {
    return apiFetch<RedistributionRecommendation>(
      `/offices/${encodeURIComponent(officeId)}/request-support`,
      { method: 'POST' }
    );
  },

  async releaseStaff(officeId: string): Promise<{ status: string; officeId: string; message: string }> {
    return apiFetch(`/offices/${encodeURIComponent(officeId)}/release-staff`, {
      method: 'POST',
    });
  },

  async getReportSummary(range: string = '30d'): Promise<ReportSummaryResponse> {
    return apiFetch<ReportSummaryResponse>(`/reports/summary?range=${encodeURIComponent(range)}`);
  },

  async importDigiturnoExcel(file: File): Promise<{
    id: number;
    filename: string;
    totalRows: number;
    insertedRows: number;
    skippedDuplicates: number;
    invalidRows: number;
    cleanedServiceOutliers: number;
    officesCount: number;
    operatorsCount: number;
    warnings: string[];
  }> {
    const form = new FormData();
    form.append('file', file);
    return apiFetch('/etl/digiturno/import', {
      method: 'POST',
      body: form,
    });
  },
};
