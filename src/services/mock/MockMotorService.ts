import type {
  IMotorService,
  SimulationParams,
  SimulationResult,
} from '../contracts/IMotorService';
import type {
  DayPlan,
  RedistributionRecommendation,
  Alert,
  Office,
  Staff,
  Absence,
} from '../../types';
import { generateDayPlan } from '../../engine/assignmentEngine';
import { generateRedistributionRecommendations } from '../../engine/redistributionEngine';
import { evaluateSystemAlerts } from '../../engine/alertEngine';
import { predictArrivals } from '../../engine/forecast';
import { evaluateErlangC, calculateRequiredAgents } from '../../engine/erlangC';

export class MockMotorService implements IMotorService {
  async generateDailyPlan(
    date: string,
    offices: Office[],
    staff: Staff[],
    absences: Absence[],
    dayOfWeek: number = 1,
    isFortnight: boolean = false
  ): Promise<DayPlan> {
    return generateDayPlan(date, offices, staff, absences, dayOfWeek, isFortnight);
  }

  async getRedistributions(
    offices: Office[],
    staff: Staff[],
    plan: DayPlan,
    franja: string = '11:00',
    dayOfWeek: number = 1,
    isFortnight: boolean = false
  ): Promise<RedistributionRecommendation[]> {
    return generateRedistributionRecommendations(offices, staff, plan, franja, dayOfWeek, isFortnight);
  }

  async evaluateAlerts(
    offices: Office[],
    staff: Staff[],
    absences: Absence[],
    plan: DayPlan,
    currentSlot: string = '11:00'
  ): Promise<Alert[]> {
    return evaluateSystemAlerts(offices, staff, absences, plan, currentSlot);
  }

  async runSimulation(
    params: SimulationParams,
    offices: Office[],
    staff: Staff[],
    absences: Absence[]
  ): Promise<SimulationResult> {
    const officesToSimulate = params.officeIdFilter
      ? offices.filter((o) => o.id === params.officeIdFilter)
      : offices;

    let totalWaitActual = 0;
    let totalWaitSim = 0;
    let totalSlaActual = 0;
    let totalSlaSim = 0;
    let totalAgentsActual = 0;
    let totalAgentsSim = 0;

    const officesData = officesToSimulate.map((office) => {
      const forecast = predictArrivals(office.id, 1, '11:00', false);
      const simulatedLambda = forecast.tasaLlegadasHora * params.demandMultiplier;

      // Agentes base activos
      const staffInOffice = staff.filter(
        (s) =>
          s.oficinaBaseId === office.id &&
          !absences.some((a) => a.colaboradorId === s.id && a.estado === 'activa')
      );
      const agentesActuales = Math.max(1, staffInOffice.length);

      // Evaluación actual
      const evalActual = evaluateErlangC(
        forecast.tasaLlegadasHora,
        forecast.tiempoAtencionPromedioMin,
        agentesActuales,
        office.tiempoEsperaMaxMin
      );

      // Agentes simulados (con posibles ausencias adicionales o override manual)
      let agentesSimulados = params.agentsOverride?.[office.id] ?? agentesActuales;
      if (params.additionalAbsences > 0 && office.id === 'cartagena-chambacu') {
        agentesSimulados = Math.max(1, agentesSimulados - params.additionalAbsences);
      }

      // Requeridos según Erlang C para el nuevo targetSla
      const erlangSim = calculateRequiredAgents(
        simulatedLambda,
        forecast.tiempoAtencionPromedioMin,
        params.targetSla,
        office.tiempoEsperaMaxMin,
        office.capacidadPuestos + 3
      );

      const evalSim = evaluateErlangC(
        simulatedLambda,
        forecast.tiempoAtencionPromedioMin,
        agentesSimulados,
        office.tiempoEsperaMaxMin
      );

      totalWaitActual += evalActual.tiempoEsperaPromedioMin;
      totalWaitSim += evalSim.tiempoEsperaPromedioMin;
      totalSlaActual += evalActual.nivelServicio;
      totalSlaSim += evalSim.nivelServicio;
      totalAgentsActual += agentesActuales;
      totalAgentsSim += erlangSim.requiredAgents;

      return {
        oficinaId: office.id,
        oficinaNombre: office.nombre,
        slaActual: evalActual.nivelServicio,
        slaSimulado: evalSim.nivelServicio,
        esperaActualMin: evalActual.tiempoEsperaPromedioMin,
        esperaSimuladaMin: evalSim.tiempoEsperaPromedioMin,
        agentesActuales,
        agentesSimulados: erlangSim.requiredAgents,
      };
    });

    const count = Math.max(1, officesToSimulate.length);

    return {
      params,
      totalAgentesActuales: totalAgentsActual,
      totalAgentesSimulados: totalAgentsSim,
      slaActualPonderado: Number((totalSlaActual / count).toFixed(3)),
      slaSimuladoPonderado: Number((totalSlaSim / count).toFixed(3)),
      esperaActualMin: Number((totalWaitActual / count).toFixed(1)),
      esperaSimuladaMin: Number((totalWaitSim / count).toFixed(1)),
      oficinasAfectadas: officesData,
    };
  }
}
