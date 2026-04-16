import type { AuthResult } from '@/types/report';

export interface IAuthService {
  authenticate(): Promise<AuthResult>;
}
