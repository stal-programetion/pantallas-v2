import type { IAusenciasService } from '../contracts/IAusenciasService';
import type { Absence } from '../../types';
import { INITIAL_ABSENCES } from '../../mock/initialAbsences';

export class MockAusenciasService implements IAusenciasService {
  private absences: Absence[] = [...INITIAL_ABSENCES];

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
    return newAbsence;
  }

  async updateAbsence(id: string, data: Partial<Absence>): Promise<Absence> {
    const index = this.absences.findIndex((a) => a.id === id);
    if (index === -1) {
      throw new Error(`Ausencia con id ${id} no encontrada`);
    }
    this.absences[index] = { ...this.absences[index], ...data };
    return this.absences[index];
  }

  async deleteAbsence(id: string): Promise<boolean> {
    const initialLength = this.absences.length;
    this.absences = this.absences.filter((a) => a.id !== id);
    return this.absences.length < initialLength;
  }
}
