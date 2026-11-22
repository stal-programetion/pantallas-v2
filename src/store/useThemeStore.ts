import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { STORAGE_KEYS } from '../services/mock/storage';

export type PreferenciaTema = 'claro' | 'oscuro' | 'sistema';

const consultaOscuro = () =>
  typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: dark)').matches;

/** Tema que se ve realmente, resolviendo "sistema" con la preferencia del equipo. */
export const temaEfectivo = (pref: PreferenciaTema): 'claro' | 'oscuro' =>
  pref === 'sistema' ? (consultaOscuro() ? 'oscuro' : 'claro') : pref;

/** Pone o quita la clase `dark` en <html> y ajusta el color de la barra del navegador. */
export function aplicarTema(pref: PreferenciaTema): void {
  if (typeof document === 'undefined') return;
  const oscuro = temaEfectivo(pref) === 'oscuro';
  document.documentElement.classList.toggle('dark', oscuro);
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', oscuro ? '#0a1120' : '#1F2B6B');
}

interface ThemeState {
  preferencia: PreferenciaTema;
  setPreferencia: (p: PreferenciaTema) => void;
  /** Alterna entre claro y oscuro (deja de seguir al sistema). */
  alternar: () => void;
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set, get) => ({
      preferencia: 'sistema',
      setPreferencia: (preferencia) => {
        set({ preferencia });
        aplicarTema(preferencia);
      },
      alternar: () => {
        const siguiente = temaEfectivo(get().preferencia) === 'oscuro' ? 'claro' : 'oscuro';
        get().setPreferencia(siguiente);
      },
    }),
    {
      name: STORAGE_KEYS.tema,
      version: 1,
      onRehydrateStorage: () => (state) => aplicarTema(state?.preferencia ?? 'sistema'),
    }
  )
);

// Si se sigue al sistema, reaccionar cuando el usuario cambia el tema del equipo
if (typeof window !== 'undefined' && window.matchMedia) {
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    if (useThemeStore.getState().preferencia === 'sistema') aplicarTema('sistema');
  });
}
