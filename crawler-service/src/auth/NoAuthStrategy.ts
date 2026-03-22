import type { AxiosRequestConfig } from 'axios';
import type { IAuthStrategy, AuthContext } from '../core/interfaces/index.js';

export class NoAuthStrategy implements IAuthStrategy {
  readonly strategyName = 'NoAuth';

  async authenticate(_context: AuthContext): Promise<void> {
    // No authentication needed
  }

  async applyAuth(
    config: AxiosRequestConfig,
    _context: AuthContext
  ): Promise<AxiosRequestConfig> {
    return config;
  }

  isAuthenticated(_context: AuthContext): boolean {
    return true;
  }

  invalidate(_context: AuthContext): void {
    // No state to invalidate
  }
}
