import type { IDigiturnoService, DigiturnoConnectionStatus } from '../contracts/IDigiturnoService';
import type { HistoricalTicketSummary, OfficeRealtimeMetrics } from '../../types';
import { apiFetch } from '../httpClient';

export interface NetworkLoadPoint {
  franja: string;
  demandaPronosticada: number;
  llegadasDigiturno: number | null;
  capacidadOperativa: number;
}

export interface NetworkLoadResponse {
  isFortnight: boolean;
  currentSlot: string;
  series: NetworkLoadPoint[];
}

export interface UserBehaviorResponse {
  picoMatutino: string;
  tasaAbandonoPorcentaje: number;
  metaAbandonoPorcentaje: number;
  tramites: Array<{
    nombre: string;
    porcentaje: number;
    tiempoMedioMin: number;
  }>;
}

export interface OfficeDailyActivityPoint {
  franja: string;
  atendidos: number;
  enEspera: number;
}

export class ApiDigiturnoService implements IDigiturnoService {
  private sourceMode: 'mock' | 'real' = 'mock';

  setSourceMode(mode: 'mock' | 'real'): void {
    this.sourceMode = mode;
    void apiFetch<DigiturnoConnectionStatus>('/digiturno/source-mode', {
      method: 'PUT',
      body: JSON.stringify({ mode }),
    }).catch((err) => console.error('Error actualizando sourceMode:', err));
  }

  getSourceMode(): 'mock' | 'real' {
    return this.sourceMode;
  }

  async getLiveMetrics(isFortnight: boolean = true): Promise<OfficeRealtimeMetrics[]> {
    return apiFetch<OfficeRealtimeMetrics[]>(`/digiturno/live-metrics?isFortnight=${isFortnight}`);
  }

  async getOfficeLiveStatus(officeId: string): Promise<OfficeRealtimeMetrics | null> {
    return apiFetch<OfficeRealtimeMetrics>(`/digiturno/live-metrics/${encodeURIComponent(officeId)}`);
  }

  async getHistoricalDemand(
    officeId?: string,
    isFortnight?: boolean
  ): Promise<HistoricalTicketSummary[]> {
    const params = new URLSearchParams();
    if (officeId) params.set('officeId', officeId);
    if (isFortnight !== undefined) params.set('isFortnight', String(isFortnight));
    const qs = params.toString();
    return apiFetch<HistoricalTicketSummary[]>(`/digiturno/historical${qs ? `?${qs}` : ''}`);
  }

  async testConnection(): Promise<DigiturnoConnectionStatus> {
    return apiFetch<DigiturnoConnectionStatus>('/digiturno/test-connection', {
      method: 'POST',
    });
  }

  async getNetworkLoad(isFortnight: boolean, currentSlot: string): Promise<NetworkLoadResponse> {
    return apiFetch<NetworkLoadResponse>(
      `/digiturno/network-load?isFortnight=${isFortnight}&currentSlot=${encodeURIComponent(currentSlot)}`
    );
  }

  async getUserBehavior(): Promise<UserBehaviorResponse> {
    return apiFetch<UserBehaviorResponse>('/digiturno/user-behavior');
  }

  async getOfficeDailyActivity(
    officeId: string,
    currentSlot: string,
    isFortnight: boolean
  ): Promise<OfficeDailyActivityPoint[]> {
    return apiFetch<OfficeDailyActivityPoint[]>(
      `/digiturno/office-daily-activity/${encodeURIComponent(officeId)}?currentSlot=${encodeURIComponent(currentSlot)}&isFortnight=${isFortnight}`
    );
  }
}
