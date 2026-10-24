import type { IDigiturnoService } from './contracts/IDigiturnoService';
import type { IAusenciasService } from './contracts/IAusenciasService';
import type { ITurnosService } from './contracts/ITurnosService';
import type { IMotorService } from './contracts/IMotorService';

import { MockDigiturnoService } from './mock/MockDigiturnoService';
import { MockAusenciasService } from './mock/MockAusenciasService';
import { MockTurnosService } from './mock/MockTurnosService';
import { MockMotorService } from './mock/MockMotorService';

// Instancias activas de servicios (intercambiables sin alterar vistas)
export const digiturnoService: IDigiturnoService = new MockDigiturnoService();
export const ausenciasService: IAusenciasService = new MockAusenciasService();
export const turnosService: ITurnosService = new MockTurnosService();
export const motorService: IMotorService = new MockMotorService();

// Re-export contratos
export * from './contracts/IDigiturnoService';
export * from './contracts/IAusenciasService';
export * from './contracts/ITurnosService';
export * from './contracts/IMotorService';
