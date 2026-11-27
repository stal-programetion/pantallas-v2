import { create } from 'zustand';
import type { User, UserRole } from '../types';
import { apiAuthService, configureHttpAuth } from '../services';

interface AuthState {
  currentUser: User;
  token: string | null;
  initSession: () => Promise<void>;
  setRole: (role: UserRole) => Promise<void>;
  canViewHealthData: () => boolean;
  canApprovePlan: () => boolean;
  canEditSettings: () => boolean;
  canEditShifts: () => boolean;
}

const ROLES_DATA: Record<UserRole, User> = {
  ADMIN: {
    id: 'usr-admin',
    nombre: 'Ing. Mauricio Beltrán',
    email: 'mbeltran@surtigas.com.co',
    rol: 'ADMIN',
    cargo: 'Gerente de Experiencia al Cliente y Canales',
  },
  COORDINADOR: {
    id: 'usr-coord',
    nombre: 'Liliana María Ramos',
    email: 'lramos@surtigas.com.co',
    rol: 'COORDINADOR',
    cargo: 'Coordinadora de Turnos y Gestión Operativa',
  },
  CONSULTA: {
    id: 'usr-view',
    nombre: 'Carlos Mario Mendoza',
    email: 'cmendoza@surtigas.com.co',
    rol: 'CONSULTA',
    cargo: 'Asesor Integral Surtigas Chambacú',
  },
};

export const useAuthStore = create<AuthState>((set, get) => ({
  currentUser: ROLES_DATA.COORDINADOR,
  token: null,

  initSession: async () => {
    const role = get().currentUser.rol;
    try {
      const session = await apiAuthService.createDemoSession(role);
      set({ currentUser: session.user, token: session.accessToken });
    } catch {
      // Si el backend no tiene demo switch habilitado, mantiene usuario actual
    }
  },

  setRole: async (role: UserRole) => {
    set({ currentUser: ROLES_DATA[role] });
    try {
      const session = await apiAuthService.createDemoSession(role);
      set({ currentUser: session.user, token: session.accessToken });
    } catch {
      // Fallback silencioso
    }
  },

  canViewHealthData: () => {
    const role = get().currentUser.rol;
    return role === 'ADMIN' || role === 'COORDINADOR';
  },

  canApprovePlan: () => {
    const role = get().currentUser.rol;
    return role === 'ADMIN' || role === 'COORDINADOR';
  },

  canEditSettings: () => {
    const role = get().currentUser.rol;
    return role === 'ADMIN';
  },

  canEditShifts: () => {
    const role = get().currentUser.rol;
    return role === 'ADMIN' || role === 'COORDINADOR';
  },
}));

configureHttpAuth(
  () => useAuthStore.getState().token,
  () => useAuthStore.getState().currentUser.rol
);
