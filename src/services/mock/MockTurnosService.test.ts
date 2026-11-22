import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { DayPlan } from '../../types';

// localStorage mínimo en memoria para el entorno de pruebas (Node)
class MemoryStorage {
  private data = new Map<string, string>();
  getItem(k: string) { return this.data.get(k) ?? null; }
  setItem(k: string, v: string) { this.data.set(k, v); }
  removeItem(k: string) { this.data.delete(k); }
  clear() { this.data.clear(); }
}

const plan = (estado: DayPlan['estado'] = 'propuesto'): DayPlan => ({
  id: 'plan-1',
  fecha: '2026-10-15',
  estado,
  tiempoAhorradoMinutos: 80,
  justificaciones: [],
  turnos: {
    'st-01': {
      colaboradorId: 'st-01',
      slots: { '08:00': { franja: '08:00', estado: 'atencion', esModificadoManual: false } },
    },
  } as unknown as DayPlan['turnos'],
});

async function freshService() {
  vi.resetModules();
  const { MockTurnosService } = await import('./MockTurnosService');
  return new MockTurnosService();
}

describe('MockTurnosService (persistencia)', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', new MemoryStorage());
  });

  it('conserva las ediciones de la malla tras "recargar"', async () => {
    const a = await freshService();
    await a.saveDayPlan(plan());
    await a.updateSlot('2026-10-15', 'st-01', '08:00', { estado: 'almuerzo' });

    const b = await freshService(); // nueva instancia = página recargada
    const restored = await b.getDayPlan('2026-10-15');
    expect(restored?.turnos['st-01'].slots['08:00'].estado).toBe('almuerzo');
    expect(restored?.turnos['st-01'].slots['08:00'].esModificadoManual).toBe(true);
  });

  it('devuelve un objeto nuevo en cada cambio para que React lo detecte', async () => {
    const s = await freshService();
    await s.saveDayPlan(plan());
    const p1 = await s.updateSlot('2026-10-15', 'st-01', '08:00', { estado: 'almuerzo' });
    const p2 = await s.updateSlot('2026-10-15', 'st-01', '08:00', { estado: 'atencion' });
    expect(p1).not.toBe(p2);
  });

  it('un plan nuevo del motor reemplaza la propuesta original; un ajuste no', async () => {
    const s = await freshService();
    await s.saveDayPlan(plan());
    await s.saveDayPlan({ ...plan(), id: 'plan-quincena' });
    await s.saveDayPlan({ ...plan(), id: 'ajuste' }, { esPropuesta: false });
    const reset = await s.resetToProposal('2026-10-15');
    expect(reset.id).toBe('plan-quincena');
  });
});
