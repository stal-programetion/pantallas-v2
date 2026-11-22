import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { STORAGE_KEYS } from '../services/mock/storage';
import type { User, UserRole } from '../types';

interface AuthState {
  currentUser: User;
  isAuthenticated: boolean;
  login: (role: UserRole) => void;
  logout: () => void;
  setRole: (role: UserRole) => void;
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

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      currentUser: ROLES_DATA.COORDINADOR, // Rol operativo por defecto
      isAuthenticated: false,

      login: (role: UserRole) => {
        set({ currentUser: ROLES_DATA[role], isAuthenticated: true });
      },

      logout: () => {
        set({ isAuthenticated: false });
      },

      setRole: (role: UserRole) => {
        set({ currentUser: ROLES_DATA[role] });
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
    }),
    {
      name: STORAGE_KEYS.auth,
      version: 1,
      partialize: (state) => ({
        currentUser: state.currentUser,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);
