import type { OfficeRealtimeMetrics, HistoricalTicketSummary } from '../../types';

export interface DigiturnoConnectionStatus {
  connected: boolean;
  latencyMs: number;
  endpointUrl: string;
  version: string;
  lastSync: string;
  message: string;
}

export interface IDigiturnoService {
  getLiveMetrics(): Promise<OfficeRealtimeMetrics[]>;
  getOfficeLiveStatus(officeId: string): Promise<OfficeRealtimeMetrics | null>;
  getHistoricalDemand(officeId?: string, isFortnight?: boolean): Promise<HistoricalTicketSummary[]>;
  testConnection(): Promise<DigiturnoConnectionStatus>;
  setSourceMode(mode: 'mock' | 'real'): void;
  getSourceMode(): 'mock' | 'real';
}
