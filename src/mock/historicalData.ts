import { HistoricalTicketSummary } from '../types';
import { INITIAL_OFFICES } from './officesData';
import { OPERATING_SLOTS, predictArrivals } from '../engine/forecast';
import { SeededPRNG } from './seed';

const prng = new SeededPRNG(98765);

/**
 * Genera el histórico agregado de aproximadamente 3 meses de Digiturno
 */
export function generateHistoricalTicketSummaries(): HistoricalTicketSummary[] {
  const summaries: HistoricalTicketSummary[] = [];

  INITIAL_OFFICES.forEach((office) => {
    // Para días de semana: 1 = Lunes a 5 = Viernes
    for (let day = 1; day <= 5; day++) {
      // Días estándar y días de quincena
      [false, true].forEach((isFortnight) => {
        OPERATING_SLOTS.forEach((slot) => {
          const forecast = predictArrivals(office.id, day, slot, isFortnight);
          const noise = prng.nextFloat(0.92, 1.08);
          const arrivals = Math.round(forecast.llegadasEsperadas * noise);

          // Tiempos promedio en segundos
          const waitTimeSec = Math.round(
            (forecast.esPico ? prng.nextFloat(350, 680) : prng.nextFloat(180, 360)) * (isFortnight ? 1.2 : 1.0)
          );
          const serviceTimeSec = Math.round(forecast.tiempoAtencionPromedioMin * 60 * prng.nextFloat(0.95, 1.05));

          summaries.push({
            franja: slot,
            diaSemana: day,
            oficinaId: office.id,
            llegadasPromedio: arrivals,
            tiempoEsperaPromedioSeg: waitTimeSec,
            tiempoAtencionPromedioMin: Number((serviceTimeSec / 60).toFixed(1)),
            tiempoAtencionPromedioSeg: serviceTimeSec,
            tramitePrincipal: forecast.tramitePredominante,
            esQuincena: isFortnight,
          } as HistoricalTicketSummary);
        });
      });
    }
  });

  return summaries;
}

export const HISTORICAL_SUMMARIES = generateHistoricalTicketSummaries();
