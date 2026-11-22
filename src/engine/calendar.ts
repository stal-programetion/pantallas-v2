import type { Absence } from '../types';

/**
 * Utilidades de calendario para el motor: día de la semana, quincena y
 * vigencia de ausencias según la fecha que se está planificando.
 * Las fechas se manejan como texto YYYY-MM-DD para evitar desfases de zona horaria.
 */

const toDate = (fecha: string) => new Date(`${fecha}T12:00:00`);

const toIso = (d: Date) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

/** 0 = Domingo, 1 = Lunes, ..., 6 = Sábado */
export function diaSemana(fecha: string): number {
  return toDate(fecha).getDay();
}

/**
 * Días de pago y facturación con mayor afluencia: alrededor de la quincena
 * (13 al 17) y del fin de mes (28 al 2).
 */
export function esQuincena(fecha: string): boolean {
  const dia = toDate(fecha).getDate();
  return (dia >= 13 && dia <= 17) || dia >= 28 || dia <= 2;
}

/** Las oficinas no atienden los domingos. */
export function esDiaHabil(fecha: string): boolean {
  return diaSemana(fecha) !== 0;
}

/** Suma (o resta) días hábiles, saltando los domingos. */
export function moverDiaHabil(fecha: string, pasos: number): string {
  const d = toDate(fecha);
  const dir = pasos >= 0 ? 1 : -1;
  let restantes = Math.abs(pasos);
  while (restantes > 0) {
    d.setDate(d.getDate() + dir);
    if (d.getDay() !== 0) restantes--;
  }
  return toIso(d);
}

/** Si la fecha cae en domingo, la lleva al lunes siguiente. */
export function ajustarADiaHabil(fecha: string): string {
  return esDiaHabil(fecha) ? fecha : moverDiaHabil(fecha, 1);
}

/** Una ausencia afecta la fecha si está dentro de su rango y no está finalizada. */
export function ausenciaAplica(ausencia: Absence, fecha: string): boolean {
  return ausencia.estado !== 'finalizada' && fecha >= ausencia.fechaInicio && fecha <= ausencia.fechaFin;
}

export function ausenciasDelDia(ausencias: Absence[], fecha: string): Absence[] {
  return ausencias.filter((a) => ausenciaAplica(a, fecha));
}

/** "Jueves 15 de octubre de 2026" */
export function formatoFechaLarga(fecha: string): string {
  const txt = toDate(fecha).toLocaleDateString('es-CO', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
  return txt.charAt(0).toUpperCase() + txt.slice(1);
}
