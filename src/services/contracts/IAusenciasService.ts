import type { Absence } from '../../types';

export interface IAusenciasService {
  getAbsences(): Promise<Absence[]>;
  getActiveAbsences(): Promise<Absence[]>;
  createAbsence(data: Omit<Absence, 'id'>): Promise<Absence>;
  updateAbsence(id: string, data: Partial<Absence>): Promise<Absence>;
  deleteAbsence(id: string): Promise<boolean>;
}
