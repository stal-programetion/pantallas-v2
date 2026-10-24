import type { IDigiturnoService, DigiturnoConnectionStatus } from '../contracts/IDigiturnoService';
import type { OfficeRealtimeMetrics, HistoricalTicketSummary } from '../../types';
import { INITIAL_OFFICES } from '../../mock/officesData';
import { HISTORICAL_SUMMARIES } from '../../mock/historicalData';
import { evaluateErlangC } from '../../engine/erlangC';
import { predictArrivals } from '../../engine/forecast';
import { SeededPRNG } from '../../mock/seed';

const prng = new SeededPRNG(13579);

export class MockDigiturnoService implements IDigiturnoService {
  private sourceMode: 'mock' | 'real' = 'mock';

  setSourceMode(mode: 'mock' | 'real'): void {
    this.sourceMode = mode;
  }

  getSourceMode(): 'mock' | 'real' {
    return this.sourceMode;
  }

  async getLiveMetrics(): Promise<OfficeRealtimeMetrics[]> {
    return INITIAL_OFFICES.map((office) => {
      const forecast = predictArrivals(office.id, 1, '11:00', false);
      // Simulación de variación viva
      const jitter = prng.nextFloat(-1.5, 2.0);
      const activeAgents = Math.max(1, office.capacidadPuestos - (office.id === 'monteria-centro' ? 1 : 0));
      const lambdaLive = Math.max(1, forecast.tasaLlegadasHora + jitter);

      const erlang = evaluateErlangC(
        lambdaLive,
        forecast.tiempoAtencionPromedioMin,
        activeAgents,
        office.tiempoEsperaMaxMin
      );

      const queueLength = Math.max(0, Math.round((erlang.tiempoEsperaPromedioMin * lambdaLive) / 60) + prng.nextInt(1, 4));

      let estadoSla: 'optimo' | 'alerta' | 'critico' = 'optimo';
      if (erlang.nivelServicio < 0.70) {
        estadoSla = 'critico';
      } else if (erlang.nivelServicio < office.slaObjetivo) {
        estadoSla = 'alerta';
      }

      return {
        oficinaId: office.id,
        clientesEnFila: queueLength,
        esperaPromedioMin: erlang.tiempoEsperaPromedioMin,
        slaActual: erlang.nivelServicio,
        agentesActivos: activeAgents,
        agentesRequeridos: office.capacidadPuestos,
        capacidadUtilizada: Math.min(100, Math.round((activeAgents / office.capacidadPuestos) * 100)),
        estadoSla,
        tendencia: erlang.nivelServicio < 0.75 ? 'bajando' : 'estable',
      };
    });
  }

  async getOfficeLiveStatus(officeId: string): Promise<OfficeRealtimeMetrics | null> {
    const all = await this.getLiveMetrics();
    return all.find((m) => m.oficinaId === officeId) || null;
  }

  async getHistoricalDemand(officeId?: string, isFortnight?: boolean): Promise<HistoricalTicketSummary[]> {
    let result = HISTORICAL_SUMMARIES;
    if (officeId) {
      result = result.filter((h) => h.oficinaId === officeId);
    }
    if (isFortnight !== undefined) {
      result = result.filter((h) => h.esQuincena === isFortnight);
    }
    return result;
  }

  async testConnection(): Promise<DigiturnoConnectionStatus> {
    // Simula latencia de red de 240 ms
    await new Promise((resolve) => setTimeout(resolve, 240));

    if (this.sourceMode === 'real') {
      return {
        connected: false,
        latencyMs: 0,
        endpointUrl: 'https://api-digiturno.surtigas.com.co/v2/queues',
        version: 'v2.4.1-rc',
        lastSync: new Date().toISOString(),
        message: 'Endpoint de producción configurado (en espera de credenciales OAuth2 corporativas). Modo Mock activo como fallback.',
      };
    }

    return {
      connected: true,
      latencyMs: 42,
      endpointUrl: 'mock://surtigas-digiturno-simulated-engine',
      version: 'v2.4-simulated',
      lastSync: new Date().toISOString(),
      message: 'Conexión simulada activa. 14 oficinas sincronizadas con temporizador de 5 segundos.',
    };
  }
}
