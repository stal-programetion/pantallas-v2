import type { UserRole } from '../types';

const rawBase = import.meta.env.VITE_API_BASE_URL ?? '';
export const API_BASE_URL = rawBase.replace(/\/$/, '');

let tokenGetter: () => string | null = () => null;
let roleGetter: () => UserRole = () => 'COORDINADOR';

export function configureHttpAuth(
  getToken: () => string | null,
  getRole: () => UserRole
): void {
  tokenGetter = getToken;
  roleGetter = getRole;
}

export function buildApiUrl(path: string): string {
  const normalized = path.startsWith('/') ? path : `/${path}`;
  return `${API_BASE_URL}/api/v1${normalized}`;
}

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  if (!headers.has('Content-Type') && !(init.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }
  const token = tokenGetter();
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }
  headers.set('X-Demo-Role', roleGetter());

  const response = await fetch(buildApiUrl(path), {
    ...init,
    headers,
  });

  if (!response.ok) {
    let detail = `Error HTTP ${response.status}`;
    try {
      const data = await response.json();
      if (typeof data?.detail === 'string') {
        detail = data.detail;
      }
    } catch {
      // ignore json parse error
    }
    throw new ApiError(response.status, detail);
  }

  if (response.status === 204) {
    return undefined as T;
  }
  return (await response.json()) as T;
}

export async function apiDownload(path: string, filename: string): Promise<void> {
  const headers = new Headers();
  const token = tokenGetter();
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }
  headers.set('X-Demo-Role', roleGetter());

  const response = await fetch(buildApiUrl(path), { headers });
  if (!response.ok) {
    throw new ApiError(response.status, `No se pudo descargar ${filename}`);
  }
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
