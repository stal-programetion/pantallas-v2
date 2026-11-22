/**
 * Almacenamiento local para los servicios simulados.
 *
 * Los servicios mock hacen las veces de "backend": guardan sus datos en
 * localStorage para que los cambios (malla editada, plan aprobado, ausencias)
 * sobrevivan a una recarga de la página. Cuando se conecten los servicios
 * reales, este archivo deja de usarse sin tocar las vistas.
 */

const PREFIX = 'surtigas-pantallas:v1:';

export const STORAGE_KEYS = {
  planes: `${PREFIX}planes`,
  propuestas: `${PREFIX}propuestas`,
  ausencias: `${PREFIX}ausencias`,
  app: `${PREFIX}app`,
  auth: `${PREFIX}auth`,
  tema: `${PREFIX}tema`,
} as const;

export function loadJSON<T>(key: string, fallback: T): T {
  try {
    const raw = globalThis.localStorage?.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

export function saveJSON(key: string, value: unknown): void {
  try {
    globalThis.localStorage?.setItem(key, JSON.stringify(value));
  } catch {
    // Almacenamiento lleno o bloqueado (modo privado): se sigue en memoria.
  }
}

/** Borra todos los datos guardados por la app (deja la sesión iniciada y el tema elegido). */
export function clearDemoData(): void {
  try {
    const storage = globalThis.localStorage;
    if (!storage) return;
    Object.keys(storage)
      .filter((k) => k.startsWith(PREFIX) && k !== STORAGE_KEYS.auth && k !== STORAGE_KEYS.tema)
      .forEach((k) => storage.removeItem(k));
  } catch {
    // Ignorar: sin acceso al almacenamiento no hay nada que borrar.
  }
}
