/**
 * Mulberry32: Generador de Números Pseudo-Aleatorios con Semilla Fija
 * Garantiza reproducibilidad absoluta en el prototipo y pruebas.
 */
export class SeededPRNG {
  private state: number;

  constructor(seed: number = 424242) {
    this.state = seed;
  }

  // Genera número flotante en [0, 1)
  next(): number {
    let t = (this.state += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  // Entero en [min, max]
  nextInt(min: number, max: number): number {
    return Math.floor(this.next() * (max - min + 1)) + min;
  }

  // Flotante en [min, max]
  nextFloat(min: number, max: number): number {
    return this.next() * (max - min) + min;
  }

  // Elemento aleatorio de una lista
  choice<T>(array: T[]): T {
    return array[this.nextInt(0, array.length - 1)];
  }
}

export const defaultPRNG = new SeededPRNG(424242);
