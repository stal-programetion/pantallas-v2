import { describe, expect, it } from 'vitest';
import { ajustarADiaHabil, ausenciaAplica, diaSemana, esQuincena, moverDiaHabil } from './calendar';
import type { Absence } from '../types';

describe('calendario del motor', () => {
  it('calcula el día de la semana real', () => {
    expect(diaSemana('2026-10-15')).toBe(4); // jueves
    expect(diaSemana('2026-10-19')).toBe(1); // lunes
  });

  it('salta los domingos al navegar', () => {
    expect(moverDiaHabil('2026-10-17', 1)).toBe('2026-10-19'); // sábado → lunes
    expect(moverDiaHabil('2026-10-19', -1)).toBe('2026-10-17'); // lunes → sábado
    expect(ajustarADiaHabil('2026-10-18')).toBe('2026-10-19'); // domingo → lunes
  });

  it('marca la quincena y el fin de mes', () => {
    expect(esQuincena('2026-10-15')).toBe(true);
    expect(esQuincena('2026-10-30')).toBe(true);
    expect(esQuincena('2026-11-01')).toBe(true);
    expect(esQuincena('2026-10-21')).toBe(false);
  });

  it('aplica una ausencia solo dentro de su rango de fechas', () => {
    const a = { fechaInicio: '2026-10-15', fechaFin: '2026-10-16', estado: 'activa' } as Absence;
    expect(ausenciaAplica(a, '2026-10-15')).toBe(true);
    expect(ausenciaAplica(a, '2026-10-17')).toBe(false);
    expect(ausenciaAplica({ ...a, estado: 'finalizada' }, '2026-10-15')).toBe(false);
  });
});
