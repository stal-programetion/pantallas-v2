import { describe, expect, it } from 'vitest';
import { normalizarReglas, aplicarReglas, REGLAS_POR_DEFECTO } from './reglas';
import { generateDayPlan, ventanasAlmuerzo } from './assignmentEngine';
import { INITIAL_OFFICES } from '../mock/officesData';
import { INITIAL_STAFF } from '../mock/staffData';

describe('reglas laborales', () => {
  it('corrige valores fuera de rango', () => {
    const r = normalizarReglas({ slaObjetivo: 1.5, tiempoEsperaMaxMin: 2, distanciaMaxPresencialKm: 500, duracionAlmuerzoMin: 50 });
    expect(r).toEqual({ slaObjetivo: 0.99, tiempoEsperaMaxMin: 5, distanciaMaxPresencialKm: 100, duracionAlmuerzoMin: 60 });
  });

  it('aplica la meta de SLA a todas las oficinas', () => {
    const offices = aplicarReglas(INITIAL_OFFICES, { ...REGLAS_POR_DEFECTO, slaObjetivo: 0.9 });
    expect(offices.every((o) => o.slaObjetivo === 0.9)).toBe(true);
  });

  it('la duración del almuerzo cambia las franjas y las horas de la jornada', () => {
    expect(ventanasAlmuerzo(90)[0]).toEqual(['12:00', '12:30', '13:00']);
    const plan30 = generateDayPlan('2026-10-15', INITIAL_OFFICES, INITIAL_STAFF, [], 4, false, { duracionAlmuerzoMin: 30 });
    const plan90 = generateDayPlan('2026-10-15', INITIAL_OFFICES, INITIAL_STAFF, [], 4, false, { duracionAlmuerzoMin: 90 });
    const turno30 = Object.values(plan30.turnos)[0];
    const turno90 = Object.values(plan90.turnos)[0];
    const almuerzos = (t: typeof turno30) => Object.values(t.slots).filter((s) => s.estado === 'almuerzo').length;
    expect(almuerzos(turno30)).toBe(1);
    expect(almuerzos(turno90)).toBe(3);
    expect(turno30.horasTotales).toBeGreaterThan(turno90.horasTotales);
  });
});
