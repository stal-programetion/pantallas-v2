import type {
  DayPlan,
  RedistributionRecommendation,
  Alert,
  Office,
  Staff,
  Absence,
} from '../../types';

export interface SimulationParams {
  additionalAbsences: number;
  demandMultiplier: number; // 0.8 to 1.5
  targetSla: number;        // e.g. 0.80
  officeIdFilter?: string;
  agentsOverride?: Record<string, number>;
}

export interface SimulationResult {
  params: SimulationParams;
  totalAgentesActuales: number;
  totalAgentesSimulados: number;
  slaActualPonderado: number;
  slaSimuladoPonderado: number;
  esperaActualMin: number;
  esperaSimuladaMin: number;
  oficinasAfectadas: Array<{
    oficinaId: string;
    oficinaNombre: string;
    slaActual: number;
    slaSimulado: number;
    esperaActualMin: number;
    esperaSimuladaMin: number;
    agentesActuales: number;
    agentesSimulados: number;
  }>;
}

export interface IMotorService {
  generateDailyPlan(
    date: string,
    offices: Office[],
    staff: Staff[],
    absences: Absence[],
    dayOfWeek?: number,
    isFortnight?: boolean
  ): Promise<DayPlan>;

  getRedistributions(
    offices: Office[],
    staff: Staff[],
    plan: DayPlan,
    franja?: string,
    dayOfWeek?: number,
    isFortnight?: boolean
  ): Promise<RedistributionRecommendation[]>;

  evaluateAlerts(
    offices: Office[],
    staff: Staff[],
    absences: Absence[],
    plan: DayPlan,
    currentSlot?: string
  ): Promise<Alert[]>;

  runSimulation(
    params: SimulationParams,
    offices: Office[],
    staff: Staff[],
    absences: Absence[]
  ): Promise<SimulationResult>;
}
