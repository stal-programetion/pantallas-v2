import { create } from 'zustand';
import type { User, UserRole } from '../types';

interface AuthState {
  currentUser: User;
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

export const useAuthStore = create<AuthState>((set, get) => ({
  currentUser: ROLES_DATA.COORDINADOR, // Rol operativo por defecto

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
}));
