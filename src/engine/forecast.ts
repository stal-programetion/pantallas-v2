/**
 * Motor de Pronóstico de Llegadas (Digiturno Forecast)
 * Calcula la demanda esperada por oficina, día de la semana y franja de 30 minutos
 * incorporando factores estacionales (quincenas, fin de mes, patrones de trámites).
 */

// Franjas de atención habituales en oficinas de Surtigas (08:00 a 16:30)
export const OPERATING_SLOTS = [
  '08:00', '08:30', '09:00', '09:30', '10:00', '10:30',
  '11:00', '11:30', '12:00', '12:30', '13:00', '13:30',
  '14:00', '14:30', '15:00', '15:30', '16:00'
];

// Curva base intradiaria típica (multiplicador relativo sobre la media del día)
const INTRADAY_WEIGHTS: Record<string, number> = {
  '08:00': 0.65, // Apertura y fila inicial
  '08:30': 0.85,
  '09:00': 1.15,
  '09:30': 1.40, // Pico matutino
  '10:00': 1.45, // Pico matutino máximo
  '10:30': 1.35,
  '11:00': 1.25,
  '11:30': 1.15,
  '12:00': 1.20, // Hora de almuerzo de usuarios
  '12:30': 1.25, // Pico mediodía
  '13:00': 1.10,
  '13:30': 0.95,
  '14:00': 0.90,
  '14:30': 1.05, // Pico vespertino
  '15:00': 1.10,
  '15:30': 0.80,
  '16:00': 0.45, // Cierre
};

// Ponderación por día de la semana (1 = Lunes, ..., 5 = Viernes, 6 = Sábado)
const DAY_WEIGHTS: Record<number, number> = {
  1: 1.25, // Lunes: acumulación fin de semana
  2: 1.05, // Martes: tráfico estándar
  3: 1.00, // Miércoles: tráfico estándar
  4: 1.10, // Jueves: moderado
  5: 1.20, // Viernes: alto
  6: 0.60, // Sábado: media jornada
  0: 0.00, // Domingo: cerrado
};

// Factor de escala base por tipo/tamaño de oficina (llegadas base/hora)
const OFFICE_BASE_DEMAND: Record<string, number> = {
  'cartagena-chambacu': 26, // Sede principal
  'monteria-centro': 22,
  'sincelejo-la-palma': 19,
  'santa-marta-rodadero': 17,
  'magangue': 13,
  'apartado': 12,
  'caucasia': 11,
  'cienaga': 9,
  'lorica': 8,
  'corozal': 8,
  'sahagun': 7,
  'el-carmen-de-bolivar': 6,
  'san-marcos': 5,
  'fundacion': 5,
};

export interface SlotForecast {
  franja: string;
  llegadasEsperadas: number;      // Clientes en la franja de 30 min
  tasaLlegadasHora: number;       // lambda equivalente por hora
  tiempoAtencionPromedioMin: number;
  esPico: boolean;
  tramitePredominante: string;
}

/**
 * Predice la demanda para una franja específica
 */
export function predictArrivals(
  officeId: string,
  dayOfWeek: number = 1, // Lunes por defecto
  slot: string = '10:00',
  isFortnight: boolean = false
): SlotForecast {
  const baseRate = OFFICE_BASE_DEMAND[officeId] || 10;
  const dayFactor = DAY_WEIGHTS[dayOfWeek] ?? 1.0;
  const slotFactor = INTRADAY_WEIGHTS[slot] ?? 1.0;
  const fortnightFactor = isFortnight ? 1.32 : 1.0; // 32% más demanda en quincena

  // Tasa de llegadas por hora (lambda)
  const lambda = baseRate * dayFactor * slotFactor * fortnightFactor;
  // Llegadas en la franja de 30 minutos
  const arrivalsInSlot = Number((lambda * 0.5).toFixed(1));

  // Trámites según hora
  let tramite = 'Facturación y Pagos';
  if (['09:00', '09:30', '10:00', '10:30'].includes(slot)) {
    tramite = 'Peticiones, Quejas y Reclamos (PQR)';
  } else if (['11:00', '11:30', '14:30', '15:00'].includes(slot)) {
    tramite = 'Nuevas Conexiones y Financiación';
  } else if (isFortnight) {
    tramite = 'Facturación y Acuerdos de Pago';
  }

  // Tiempo de atención promedio en minutos según oficina y trámite
  let avgServiceTime = 8.5;
  if (tramite.includes('PQR')) avgServiceTime = 11.0;
  if (tramite.includes('Conexiones')) avgServiceTime = 13.5;
  if (tramite.includes('Facturación')) avgServiceTime = 6.5;

  const esPico = slotFactor >= 1.25 || (isFortnight && slotFactor >= 1.1);

  return {
    franja: slot,
    llegadasEsperadas: arrivalsInSlot,
    tasaLlegadasHora: Number(lambda.toFixed(2)),
    tiempoAtencionPromedioMin: avgServiceTime,
    esPico,
    tramitePredominante: tramite,
  };
}

/**
 * Genera el pronóstico de todo el día para una oficina
 */
export function predictDayArrivals(
  officeId: string,
  dayOfWeek: number = 1,
  isFortnight: boolean = false
): SlotForecast[] {
  return OPERATING_SLOTS.map((slot) => predictArrivals(officeId, dayOfWeek, slot, isFortnight));
}
