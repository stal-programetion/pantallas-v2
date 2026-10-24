import type { ITurnosService } from '../contracts/ITurnosService';
import type { DayPlan, ShiftSlot } from '../../types';

export class MockTurnosService implements ITurnosService {
  private plans: Map<string, DayPlan> = new Map();
  private originalProposals: Map<string, DayPlan> = new Map();

  async getDayPlan(date: string): Promise<DayPlan | null> {
    return this.plans.get(date) || null;
  }

  async saveDayPlan(plan: DayPlan): Promise<DayPlan> {
    if (!this.originalProposals.has(plan.fecha)) {
      this.originalProposals.set(plan.fecha, JSON.parse(JSON.stringify(plan)));
    }
    this.plans.set(plan.fecha, JSON.parse(JSON.stringify(plan)));
    return plan;
  }

  async approveDayPlan(date: string, approverName: string): Promise<DayPlan> {
    const plan = this.plans.get(date);
    if (!plan) {
      throw new Error(`No existe plan para la fecha ${date}`);
    }

    plan.estado = 'aprobado';
    plan.auditoria = {
      aprobadoPor: approverName,
      aprobadoEn: new Date().toISOString(),
      version: (plan.auditoria?.version || 1) + 1,
      totalCambiosManuales: Object.values(plan.turnos).reduce((acc, staffShift) => {
        return (
          acc +
          Object.values(staffShift.slots).filter((slot) => slot.esModificadoManual).length
        );
      }, 0),
    };

    this.plans.set(date, plan);
    return plan;
  }

  async updateSlot(
    date: string,
    colaboradorId: string,
    franja: string,
    newSlot: Partial<ShiftSlot>
  ): Promise<DayPlan> {
    const plan = this.plans.get(date);
    if (!plan) throw new Error(`Plan ${date} no encontrado`);

    if (plan.turnos[colaboradorId]?.slots[franja]) {
      plan.turnos[colaboradorId].slots[franja] = {
        ...plan.turnos[colaboradorId].slots[franja],
        ...newSlot,
        esModificadoManual: true,
      };
    }

    return plan;
  }

  async resetToProposal(date: string): Promise<DayPlan> {
    const original = this.originalProposals.get(date);
    if (!original) throw new Error(`Propuesta original para ${date} no encontrada`);
    const restored = JSON.parse(JSON.stringify(original));
    this.plans.set(date, restored);
    return restored;
  }
}
