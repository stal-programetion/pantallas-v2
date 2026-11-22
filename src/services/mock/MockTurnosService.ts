import type { ITurnosService, SaveDayPlanOptions } from '../contracts/ITurnosService';
import type { DayPlan, ShiftSlot } from '../../types';
import { loadJSON, saveJSON, STORAGE_KEYS } from './storage';

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value));

export class MockTurnosService implements ITurnosService {
  private plans: Map<string, DayPlan> = new Map(
    Object.entries(loadJSON<Record<string, DayPlan>>(STORAGE_KEYS.planes, {}))
  );
  private originalProposals: Map<string, DayPlan> = new Map(
    Object.entries(loadJSON<Record<string, DayPlan>>(STORAGE_KEYS.propuestas, {}))
  );

  private persist(): void {
    saveJSON(STORAGE_KEYS.planes, Object.fromEntries(this.plans));
    saveJSON(STORAGE_KEYS.propuestas, Object.fromEntries(this.originalProposals));
  }

  async getDayPlan(date: string): Promise<DayPlan | null> {
    const plan = this.plans.get(date);
    return plan ? clone(plan) : null;
  }

  async saveDayPlan(plan: DayPlan, options: SaveDayPlanOptions = {}): Promise<DayPlan> {
    const { esPropuesta = true } = options;
    // Un plan recién generado por el motor pasa a ser la nueva propuesta original,
    // así "Restaurar propuesta" vuelve a la última versión del motor (p. ej. tras cambiar a quincena).
    if (esPropuesta || !this.originalProposals.has(plan.fecha)) {
      this.originalProposals.set(plan.fecha, clone(plan));
    }
    this.plans.set(plan.fecha, clone(plan));
    this.persist();
    return clone(plan);
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
    this.persist();
    return clone(plan);
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

    this.persist();
    // Se devuelve una copia nueva para que React detecte el cambio y recalcule la cobertura.
    return clone(plan);
  }

  async resetToProposal(date: string): Promise<DayPlan> {
    const original = this.originalProposals.get(date);
    if (!original) throw new Error(`Propuesta original para ${date} no encontrada`);
    this.plans.set(date, clone(original));
    this.persist();
    return clone(original);
  }
}
