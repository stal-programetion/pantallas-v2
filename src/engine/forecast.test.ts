import { describe, it, expect } from 'vitest';
import { predictArrivals, predictDayArrivals, OPERATING_SLOTS } from './forecast';

describe('Digiturno Forecast Engine', () => {
  it('should generate forecast for all operating slots', () => {
    const dayForecast = predictDayArrivals('cartagena-chambacu', 1, false);
    expect(dayForecast.length).toBe(OPERATING_SLOTS.length);
    expect(dayForecast[0].franja).toBe('08:00');
  });

  it('should show morning peak higher than opening slot', () => {
    const opening = predictArrivals('monteria-centro', 1, '08:00', false);
    const morningPeak = predictArrivals('monteria-centro', 1, '10:00', false);

    expect(morningPeak.tasaLlegadasHora).toBeGreaterThan(opening.tasaLlegadasHora);
    expect(morningPeak.esPico).toBe(true);
  });

  it('should apply fortnight multiplier correctly', () => {
    const normal = predictArrivals('sincelejo-la-palma', 1, '10:00', false);
    const fortnight = predictArrivals('sincelejo-la-palma', 1, '10:00', true);

    expect(fortnight.tasaLlegadasHora).toBeGreaterThan(normal.tasaLlegadasHora);
    expect(fortnight.llegadasEsperadas).toBeGreaterThan(normal.llegadasEsperadas);
  });
});
