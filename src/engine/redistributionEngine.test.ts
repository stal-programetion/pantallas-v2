import { describe, expect, it } from 'vitest';
import { generateDayPlan } from './assignmentEngine';
import { analyzeOfficeBalances, esperaEstimadaMin, generateRedistributionRecommendations } from './redistributionEngine';
import { INITIAL_OFFICES } from '../mock/officesData';
import { INITIAL_STAFF } from '../mock/staffData';
import { INITIAL_ABSENCES } from '../mock/initialAbsences';

const plan = generateDayPlan('2026-10-15', INITIAL_OFFICES, INITIAL_STAFF, INITIAL_ABSENCES, 4, true);

describe('motor de redistribución', () => {
  it('propone traslados aunque todas las oficinas estén en déficit (día de quincena)', () => {
    const recs = generateRedistributionRecommendations(INITIAL_OFFICES, INITIAL_STAFF, plan, '11:00', 4, true);
    expect(recs.length).toBeGreaterThan(0);
    recs.forEach((r) => {
      expect(r.oficinaOrigenId).not.toBe(r.oficinaDestinoId);
      expect(r.impactoEstimado.reduccionEsperaMin).toBeGreaterThan(0);
    });
  });

  it('no usa a la misma persona dos veces ni deja una oficina sin nadie', () => {
    const recs = generateRedistributionRecommendations(INITIAL_OFFICES, INITIAL_STAFF, plan, '11:00', 4, true);
    const personas = recs.map((r) => r.colaboradorId);
    expect(new Set(personas).size).toBe(personas.length);

    const balances = analyzeOfficeBalances(INITIAL_OFFICES, INITIAL_STAFF, plan, '11:00', 4, true);
    balances.forEach((b) => {
      const salen = recs.filter((r) => r.oficinaOrigenId === b.oficina.id).length;
      if (salen > 0) expect(b.agentesAsignados - salen).toBeGreaterThanOrEqual(1);
    });
  });

  it('respeta la distancia máxima para traslados presenciales', () => {
    const recs = generateRedistributionRecommendations(INITIAL_OFFICES, INITIAL_STAFF, plan, '11:00', 4, true, 500);
    const sinLimite = generateRedistributionRecommendations(INITIAL_OFFICES, INITIAL_STAFF, plan, '11:00', 4, true, 0);
    expect(sinLimite.every((r) => r.modalidad === 'virtual')).toBe(true);
    recs.filter((r) => r.modalidad === 'presencial').forEach((r) => expect(r.distanciaKm).toBeLessThanOrEqual(500));
  });

  it('más personal siempre reduce la espera estimada, incluso con la oficina saturada', () => {
    const [b] = analyzeOfficeBalances(INITIAL_OFFICES, INITIAL_STAFF, plan, '11:00', 4, true);
    const esperas = [1, 2, 3, 4, 5, 6, 8, 10, 14].map((c) => esperaEstimadaMin(b, c));
    esperas.slice(1).forEach((w, i) => expect(w).toBeLessThanOrEqual(esperas[i]));
  });
});
