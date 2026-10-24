import { ErlangCResult } from '../types';

/**
 * Cálculo numéricamente estable de Erlang C (M/M/c)
 * A = lambda / mu (Intensidad de tráfico en Erlangs)
 * c = Número de servidores/agentes
 */

/**
 * Calcula la probabilidad de espera P(W > 0) = C(c, A) de forma estable
 */
export function calculateErlangCProbability(c: number, A: number): number {
  if (A <= 0) return 0;
  if (c <= 0) return 1;
  if (c <= A) return 1; // Sistema saturado o inestable

  // Usamos la relación iterativa para calcular la suma de Poisson:
  // sum_{k=0}^{c-1} (A^k / k!) y el último término (A^c / c!)
  let sum = 1.0;
  let term = 1.0;

  for (let k = 1; k < c; k++) {
    term = term * (A / k);
    sum += term;
  }

  // Último término para k = c
  const termC = term * (A / c);
  const queueComponent = termC * (c / (c - A));
  const denominator = sum + queueComponent;

  if (denominator <= 0) return 1;
  const pw = queueComponent / denominator;
  return Math.min(Math.max(pw, 0), 1);
}

/**
 * Evalúa los KPIs del sistema Erlang C para una tasa de llegada y número de agentes
 * @param lambda - Tasa de llegadas por hora (ej. 12 clientes/hora)
 * @param avgServiceTimeMinutes - Tiempo medio de atención en minutos (ej. 8 minutos)
 * @param agents - Número de agentes en atención (c)
 * @param targetWaitMinutes - Umbral de tiempo objetivo para SLA (ej. 10 minutos)
 */
export function evaluateErlangC(
  lambda: number,
  avgServiceTimeMinutes: number,
  agents: number,
  targetWaitMinutes: number = 10
): ErlangCResult {
  if (lambda <= 0) {
    return {
      tasaLlegadasHora: 0,
      tiempoAtencionMinutos: avgServiceTimeMinutes,
      intensidadTrafico: 0,
      agentesAsignados: agents,
      probabilidadEspera: 0,
      nivelServicio: 1,
      tiempoEsperaPromedioMin: 0,
      esEstable: true,
    };
  }

  const mu = 60 / avgServiceTimeMinutes; // Tasa de servicio por hora por agente
  const A = lambda / mu; // Intensidad de tráfico (Erlangs)

  if (agents <= A) {
    // Sobrecargado / cola infinita teórica
    return {
      tasaLlegadasHora: lambda,
      tiempoAtencionMinutos: avgServiceTimeMinutes,
      intensidadTrafico: Number(A.toFixed(2)),
      agentesAsignados: agents,
      probabilidadEspera: 1,
      nivelServicio: 0.05,
      tiempoEsperaPromedioMin: 45, // Indicador de colapso
      esEstable: false,
    };
  }

  const pw = calculateErlangCProbability(agents, A);
  const excessCapacity = agents * mu - lambda; // en llegadas/hora

  // Tiempo de espera medio en la cola (horas convertidas a minutos)
  const wqHours = pw / excessCapacity;
  const wqMinutes = wqHours * 60;

  // Nivel de servicio: P(Espera <= targetWaitHours)
  const targetWaitHours = targetWaitMinutes / 60;
  const exponent = -excessCapacity * targetWaitHours;
  const sl = 1 - pw * Math.exp(exponent);

  return {
    tasaLlegadasHora: Number(lambda.toFixed(2)),
    tiempoAtencionMinutos: Number(avgServiceTimeMinutes.toFixed(1)),
    intensidadTrafico: Number(A.toFixed(2)),
    agentesAsignados: agents,
    probabilidadEspera: Number(pw.toFixed(4)),
    nivelServicio: Number(Math.min(Math.max(sl, 0), 1).toFixed(4)),
    tiempoEsperaPromedioMin: Number(Math.max(wqMinutes, 0).toFixed(2)),
    esEstable: true,
  };
}

/**
 * Calcula el número mínimo de agentes requeridos para cumplir un SLA objetivo
 * @param lambda - Tasa de llegadas por hora
 * @param avgServiceTimeMinutes - Tiempo medio de atención en minutos
 * @param targetSla - Objetivo de nivel de servicio (ej. 0.80 para 80%)
 * @param targetWaitMinutes - Umbral de espera en minutos (ej. 10 min)
 * @param maxCapacity - Capacidad física máxima de la oficina (puestos)
 */
export function calculateRequiredAgents(
  lambda: number,
  avgServiceTimeMinutes: number,
  targetSla: number = 0.8,
  targetWaitMinutes: number = 10,
  maxCapacity: number = 10
): { requiredAgents: number; result: ErlangCResult } {
  if (lambda <= 0) {
    const res = evaluateErlangC(0, avgServiceTimeMinutes, 1, targetWaitMinutes);
    return { requiredAgents: 1, result: res };
  }

  const mu = 60 / avgServiceTimeMinutes;
  const A = lambda / mu;
  const minAgents = Math.max(1, Math.floor(A) + 1);

  let bestResult = evaluateErlangC(lambda, avgServiceTimeMinutes, minAgents, targetWaitMinutes);
  if (bestResult.nivelServicio >= targetSla) {
    return { requiredAgents: minAgents, result: bestResult };
  }

  for (let c = minAgents; c <= Math.max(maxCapacity + 2, minAgents + 5); c++) {
    const evalRes = evaluateErlangC(lambda, avgServiceTimeMinutes, c, targetWaitMinutes);
    if (evalRes.nivelServicio >= targetSla) {
      return { requiredAgents: c, result: evalRes };
    }
    bestResult = evalRes;
  }

  // Si ni con agentes adicionales llega, devuelve la mejor aproximación
  return { requiredAgents: Math.max(minAgents, maxCapacity), result: bestResult };
}
