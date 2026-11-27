import type { User, UserRole } from '../../types';
import { apiFetch } from '../httpClient';

export interface AuthSessionResponse {
  accessToken: string;
  tokenType: string;
  user: User;
}

export const apiAuthService = {
  async createDemoSession(rol: UserRole): Promise<AuthSessionResponse> {
    return apiFetch<AuthSessionResponse>('/auth/demo-session', {
      method: 'POST',
      body: JSON.stringify({ rol }),
    });
  },

  async getMe(): Promise<User> {
    return apiFetch<User>('/auth/me');
  },
};
