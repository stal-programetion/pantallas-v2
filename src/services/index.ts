import type { IDigiturnoService } from './contracts/IDigiturnoService';
import type { IAusenciasService } from './contracts/IAusenciasService';
import type { ITurnosService } from './contracts/ITurnosService';
import type { IMotorService } from './contracts/IMotorService';

import { ApiDigiturnoService } from './api/ApiDigiturnoService';
import { ApiAusenciasService } from './api/ApiAusenciasService';
import { ApiTurnosService } from './api/ApiTurnosService';
import { ApiMotorService } from './api/ApiMotorService';

export const apiDigiturnoService = new ApiDigiturnoService();
export const apiAusenciasService = new ApiAusenciasService();
export const apiTurnosService = new ApiTurnosService();
export const apiMotorService = new ApiMotorService();

// Instancias activas conectadas al backend FastAPI
export const digiturnoService: IDigiturnoService = apiDigiturnoService;
export const ausenciasService: IAusenciasService = apiAusenciasService;
export const turnosService: ITurnosService = apiTurnosService;
export const motorService: IMotorService = apiMotorService;

export * from './contracts/IDigiturnoService';
export * from './contracts/IAusenciasService';
export * from './contracts/ITurnosService';
export * from './contracts/IMotorService';
export * from './api/ApiAuthService';
export * from './api/ApiCatalogService';
export * from './api/ApiDigiturnoService';
export * from './api/ApiAusenciasService';
export * from './api/ApiTurnosService';
export * from './api/ApiMotorService';
export * from './httpClient';
