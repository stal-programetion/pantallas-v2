import { describe, it, expect } from 'vitest';
import { generateDayPlan, validateShiftSlotChange } from './assignmentEngine';
import { INITIAL_OFFICES } from '../mock/officesData';
import { INITIAL_STAFF } from '../mock/staffData';
import { INITIAL_ABSENCES } from '../mock/initialAbsences';
import { generateRedistributionRecommendations } from './redistributionEngine';

describe('Assignment Engine & Redistribution', () => {
  it('should generate a proposed day plan with all staff assigned', () => {
    const plan = generateDayPlan('2026-10-15', INITIAL_OFFICES, INITIAL_STAFF, INITIAL_ABSENCES, 1, false);

    expect(plan.id).toBe('plan-2026-10-15');
    expect(plan.estado).toBe('propuesto');
    expect(plan.tiempoAhorradoMinutos).toBeGreaterThan(60);

    // Verify all 36 staff have shifts
    expect(Object.keys(plan.turnos).length).toBe(36);

    // Verify absent staff has slots set to 'ausente'
    const absentStaffId = 'st-08'; // Lina María Petro
    expect(plan.turnos[absentStaffId].slots['10:00'].estado).toBe('ausente');

    // Verify present staff has attention slots
    const presentStaffId = 'st-01'; // Carlos Mario Mendoza
    expect(plan.turnos[presentStaffId].slots['10:00'].estado).toBe('atencion');

    // Verify justifications are present
    expect(plan.justificaciones.length).toBeGreaterThan(0);
    const hasLunchJustification = plan.justificaciones.some(
      (j) => j.tipo === 'escalonamiento_almuerzo'
    );
    expect(hasLunchJustification).toBe(true);
  });

  it('should detect when manual edit leaves an office without coverage', () => {
    const plan = generateDayPlan('2026-10-15', INITIAL_OFFICES, INITIAL_STAFF, INITIAL_ABSENCES, 1, false);
    // Fundación only has 1 agent (st-36)
    const check = validateShiftSlotChange(plan, 'st-36', '10:00', 'almuerzo', INITIAL_OFFICES, INITIAL_STAFF);
    expect(check.warningMessage).toContain('quedaría sin ningún agente');
  });

  it('should generate intelligent redistribution recommendations', () => {
    const plan = generateDayPlan('2026-10-15', INITIAL_OFFICES, INITIAL_STAFF, INITIAL_ABSENCES, 1, false);
    const redists = generateRedistributionRecommendations(
      INITIAL_OFFICES,
      INITIAL_STAFF,
      plan,
      '11:00',
      1,
      false
    );

    expect(Array.isArray(redists)).toBe(true);
    if (redists.length > 0) {
      const first = redists[0];
      expect(first.impactoEstimado.reduccionEsperaMin).toBeGreaterThanOrEqual(0);
      expect(first.modalidad).toMatch(/presencial|virtual/);
    }
  });
});
