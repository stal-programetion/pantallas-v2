import type { IAusenciasService } from '../contracts/IAusenciasService';
import type { Absence } from '../../types';
import { INITIAL_ABSENCES } from '../../mock/initialAbsences';
import { loadJSON, saveJSON, STORAGE_KEYS } from './storage';

export class MockAusenciasService implements IAusenciasService {
  private absences: Absence[] = loadJSON<Absence[]>(STORAGE_KEYS.ausencias, [...INITIAL_ABSENCES]);

  private persist(): void {
    saveJSON(STORAGE_KEYS.ausencias, this.absences);
  }

  async getAbsences(): Promise<Absence[]> {
    return [...this.absences];
  }

  async getActiveAbsences(): Promise<Absence[]> {
    return this.absences.filter((a) => a.estado === 'activa');
  }

  async createAbsence(data: Omit<Absence, 'id'>): Promise<Absence> {
    const newAbsence: Absence = {
      ...data,
      id: `abs-${Date.now().toString().slice(-5)}`,
    };
    this.absences.unshift(newAbsence);
    this.persist();
    return newAbsence;
  }

  async updateAbsence(id: string, data: Partial<Absence>): Promise<Absence> {
    const index = this.absences.findIndex((a) => a.id === id);
    if (index === -1) {
      throw new Error(`Ausencia con id ${id} no encontrada`);
    }
    this.absences[index] = { ...this.absences[index], ...data };
    this.persist();
    return this.absences[index];
  }

  async deleteAbsence(id: string): Promise<boolean> {
    const initialLength = this.absences.length;
    this.absences = this.absences.filter((a) => a.id !== id);
    this.persist();
    return this.absences.length < initialLength;
  }
}
