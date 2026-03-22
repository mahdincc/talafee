import type { AxiosRequestConfig } from 'axios';

export interface AuthContext {
  providerId: string;
  correlationId: string;
}

export interface IAuthStrategy {
  readonly strategyName: string;

  authenticate(context: AuthContext): Promise<void>;

  applyAuth(config: AxiosRequestConfig, context: AuthContext): Promise<AxiosRequestConfig>;

  isAuthenticated(context: AuthContext): boolean;

  invalidate(context: AuthContext): void;

  getRequiredHeaders?(context: AuthContext): Promise<Record<string, string>>;
}
