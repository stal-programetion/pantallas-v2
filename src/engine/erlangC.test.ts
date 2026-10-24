import { describe, it, expect } from 'vitest';
import { calculateErlangCProbability, evaluateErlangC, calculateRequiredAgents } from './erlangC';

describe('Erlang C Queuing Engine (M/M/c)', () => {
  it('should return 0 probability of waiting when traffic intensity is 0', () => {
    const pw = calculateErlangCProbability(2, 0);
    expect(pw).toBe(0);
  });

  it('should return 1 when agents <= traffic intensity (unstable/saturated)', () => {
    const pw = calculateErlangCProbability(2, 2.5);
    expect(pw).toBe(1);

    const res = evaluateErlangC(15, 10, 2); // A = 15 / (60/10) = 2.5. Agents = 2 < 2.5
    expect(res.esEstable).toBe(false);
    expect(res.probabilidadEspera).toBe(1);
  });

  it('should calculate realistic wait time and service level for stable system', () => {
    // lambda = 12 cli/h, avg service time = 8 min (mu = 7.5 cli/h)
    // A = 12 / 7.5 = 1.6 Erlangs.
    // If c = 3 agents:
    const res = evaluateErlangC(12, 8, 3, 10);
    expect(res.esEstable).toBe(true);
    expect(res.probabilidadEspera).toBeGreaterThan(0);
    expect(res.probabilidadEspera).toBeLessThan(1);
    expect(res.nivelServicio).toBeGreaterThan(0.70);
    expect(res.tiempoEsperaPromedioMin).toBeLessThan(10);
  });

  it('should optimize required agents to achieve >= 80% SLA', () => {
    const lambda = 18; // 18 clients / hour
    const avgServiceTime = 10; // 10 minutes service time (mu = 6 / hour)
    // Traffic intensity A = 18 / 6 = 3.0 Erlangs. Needs at least 4 agents to be stable.
    const { requiredAgents, result } = calculateRequiredAgents(lambda, avgServiceTime, 0.80, 10, 8);

    expect(requiredAgents).toBeGreaterThanOrEqual(4);
    expect(result.nivelServicio).toBeGreaterThanOrEqual(0.80);
    expect(result.esEstable).toBe(true);
  });
});
