import type { Office } from '../types';

/**
 * Reglas laborales y de servicio que alimentan al motor de optimización.
 * Se editan en Configuración › Reglas Laborales y SLA.
 */
export interface ReglasLaborales {
  /** Nivel de servicio objetivo (0.6 – 0.99): % de clientes atendidos antes del tiempo máximo */
  slaObjetivo: number;
  /** Tiempo máximo de espera en fila, en minutos */
  tiempoEsperaMaxMin: number;
  /** Distancia máxima para un traslado presencial; más lejos se asigna apoyo virtual */
  distanciaMaxPresencialKm: number;
  /** Duración del almuerzo en minutos (múltiplo de 30) */
  duracionAlmuerzoMin: number;
}

export const REGLAS_POR_DEFECTO: ReglasLaborales = {
  slaObjetivo: 0.8,
  tiempoEsperaMaxMin: 10,
  distanciaMaxPresencialKm: 45,
  duracionAlmuerzoMin: 60,
};

export const LIMITES_REGLAS = {
  slaPct: { min: 60, max: 99 },
  tiempoEsperaMaxMin: { min: 5, max: 30 },
  distanciaMaxPresencialKm: { min: 10, max: 100 },
  duracionAlmuerzoMin: { min: 30, max: 90, paso: 30 },
} as const;

const limitar = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

/** Corrige valores fuera de rango (p. ej. un campo vacío o escrito a mano). */
export function normalizarReglas(r: ReglasLaborales): ReglasLaborales {
  const L = LIMITES_REGLAS;
  const almuerzo = Math.round(r.duracionAlmuerzoMin / L.duracionAlmuerzoMin.paso) * L.duracionAlmuerzoMin.paso;
  return {
    slaObjetivo: limitar(Number(r.slaObjetivo) || REGLAS_POR_DEFECTO.slaObjetivo, L.slaPct.min / 100, L.slaPct.max / 100),
    tiempoEsperaMaxMin: limitar(
      Math.round(Number(r.tiempoEsperaMaxMin) || REGLAS_POR_DEFECTO.tiempoEsperaMaxMin),
      L.tiempoEsperaMaxMin.min,
      L.tiempoEsperaMaxMin.max
    ),
    distanciaMaxPresencialKm: limitar(
      Math.round(Number(r.distanciaMaxPresencialKm) || REGLAS_POR_DEFECTO.distanciaMaxPresencialKm),
      L.distanciaMaxPresencialKm.min,
      L.distanciaMaxPresencialKm.max
    ),
    duracionAlmuerzoMin: limitar(
      almuerzo || REGLAS_POR_DEFECTO.duracionAlmuerzoMin,
      L.duracionAlmuerzoMin.min,
      L.duracionAlmuerzoMin.max
    ),
  };
}

/** Aplica la meta de SLA y el tiempo máximo de espera a todas las oficinas. */
export function aplicarReglas(offices: Office[], reglas: ReglasLaborales): Office[] {
  return offices.map((o) => ({
    ...o,
    slaObjetivo: reglas.slaObjetivo,
    tiempoEsperaMaxMin: reglas.tiempoEsperaMaxMin,
  }));
}
