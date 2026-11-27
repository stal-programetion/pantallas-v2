import type { IMotorService, SimulationParams, SimulationResult } from '../contracts/IMotorService';
import type {
  Absence,
  Alert,
  DayPlan,
  Office,
  RedistributionRecommendation,
  Staff,
} from '../../types';
import { apiFetch } from '../httpClient';

export interface SlotForecastItem {
  franja: string;
  llegadasEsperadas: number;
  tasaLlegadasHora: number;
  icInferior: number;
  icSuperior: number;
  tiempoAtencionPromedioMin: number;
  tasaAbandono: number;
  esPico: boolean;
  tramitePredominante: string;
}

export interface RequiredAgentsResponse {
  operatingSlots: string[];
  requiredByOffice: Record<string, number[]>;
}

export interface PeaksSummaryResponse {
  blocks: Array<{
    titulo: string;
    rango: string;
    descripcion: string;
    recomendacion: string;
    tone: string;
  }>;
  tensionOffices: Array<{
    oficinaId: string;
    nombre: string;
    tasaLlegadasPico: number;
    agentesRequeridos: number;
    ausentes: number;
  }>;
}

export interface ExtendedSimulationResult extends SimulationResult {
  abandonoActualPorcentaje?: number;
  abandonoSimuladoPorcentaje?: number;
  curvaErlang?: Array<{
    agentes: string;
    c: number;
    nivelServicio: number;
    esperaMin: number;
  }>;
}

export class ApiMotorService implements IMotorService {
  async generateDailyPlan(
    date: string,
    _offices: Office[],
    _staff: Staff[],
    _absences: Absence[],
    dayOfWeek: number = 1,
    isFortnight: boolean = true
  ): Promise<DayPlan> {
    return apiFetch<DayPlan>('/plans/generate', {
      method: 'POST',
      body: JSON.stringify({ fecha: date, isFortnight, dayOfWeek }),
    });
  }

  async getRedistributions(
    _offices?: Office[],
    _staff?: Staff[],
    plan?: DayPlan,
    _franja?: string,
    _dayOfWeek?: number,
    _isFortnight?: boolean
  ): Promise<RedistributionRecommendation[]> {
    const qs = plan?.fecha ? `?date=${encodeURIComponent(plan.fecha)}` : '';
    return apiFetch<RedistributionRecommendation[]>(`/redistributions${qs}`);
  }

  async acceptRedistribution(id: string): Promise<RedistributionRecommendation> {
    return apiFetch<RedistributionRecommendation>(`/redistributions/${encodeURIComponent(id)}/accept`, {
      method: 'POST',
    });
  }

  async rejectRedistribution(id: string): Promise<RedistributionRecommendation> {
    return apiFetch<RedistributionRecommendation>(`/redistributions/${encodeURIComponent(id)}/reject`, {
      method: 'POST',
    });
  }

  async editRedistribution(
    id: string,
    data: { modalidad?: 'presencial' | 'virtual'; franjaInicio?: string; franjaFin?: string }
  ): Promise<RedistributionRecommendation> {
    return apiFetch<RedistributionRecommendation>(`/redistributions/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  async evaluateAlerts(): Promise<Alert[]> {
    return apiFetch<Alert[]>('/alerts');
  }

  async dismissAlert(id: string): Promise<Alert> {
    return apiFetch<Alert>(`/alerts/${encodeURIComponent(id)}/dismiss`, {
      method: 'POST',
    });
  }

  async runSimulation(
    params: SimulationParams,
    _offices?: Office[],
    _staff?: Staff[],
    _absences?: Absence[]
  ): Promise<ExtendedSimulationResult> {
    return apiFetch<ExtendedSimulationResult>('/simulation/run', {
      method: 'POST',
      body: JSON.stringify(params),
    });
  }

  async applyScenario(fecha: string, params: SimulationParams): Promise<DayPlan> {
    return apiFetch<DayPlan>('/simulation/apply-scenario', {
      method: 'POST',
      body: JSON.stringify({ fecha, params }),
    });
  }

  async getRequiredAgents(dayOfWeek: number = 4, isFortnight: boolean = true): Promise<RequiredAgentsResponse> {
    return apiFetch<RequiredAgentsResponse>(
      `/forecast/required-agents?dayOfWeek=${dayOfWeek}&isFortnight=${isFortnight}`
    );
  }

  async getOfficeForecast(
    officeId: string,
    dayOfWeek: number = 1,
    isFortnight: boolean = false
  ): Promise<SlotForecastItem[]> {
    return apiFetch<SlotForecastItem[]>(
      `/forecast/office/${encodeURIComponent(officeId)}?dayOfWeek=${dayOfWeek}&isFortnight=${isFortnight}`
    );
  }

  async getHeatmap(officeId: string, isFortnight: boolean = false): Promise<{
    officeId: string;
    operatingSlots: string[];
    rows: Array<{
      dayName: string;
      dayNum: number;
      slots: Array<{ slot: string; demand: number; isPeak: boolean }>;
    }>;
  }> {
    return apiFetch(`/forecast/heatmap/${encodeURIComponent(officeId)}?isFortnight=${isFortnight}`);
  }

  async getFortnightComparison(
    officeId: string,
    dayOfWeek: number = 1
  ): Promise<Array<{ franja: string; diaEstandar: number; diaQuincena: number }>> {
    return apiFetch(`/forecast/compare-fortnight/${encodeURIComponent(officeId)}?dayOfWeek=${dayOfWeek}`);
  }

  async getOfficeComparison(
    officeA: string,
    officeB: string,
    dayOfWeek: number = 1,
    isFortnight: boolean = true
  ): Promise<Array<{ franja: string; officeA: number; officeB: number }>> {
    return apiFetch(
      `/forecast/compare-offices?officeA=${encodeURIComponent(officeA)}&officeB=${encodeURIComponent(officeB)}&dayOfWeek=${dayOfWeek}&isFortnight=${isFortnight}`
    );
  }

  async getPeaksSummary(dayOfWeek: number = 1, isFortnight: boolean = true): Promise<PeaksSummaryResponse> {
    return apiFetch<PeaksSummaryResponse>(
      `/forecast/peaks-summary?dayOfWeek=${dayOfWeek}&isFortnight=${isFortnight}`
    );
  }
}
