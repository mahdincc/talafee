import type { AxiosRequestConfig } from 'axios';
import type { IAuthStrategy, AuthContext } from '../core/interfaces/index.js';

export interface CustomHeadersConfig {
  headers: Record<string, string>;
}

export class CustomHeadersStrategy implements IAuthStrategy {
  readonly strategyName = 'CustomHeaders';
  private headers: Record<string, string>;

  constructor(config: CustomHeadersConfig) {
    this.headers = config.headers;
  }

  async authenticate(_context: AuthContext): Promise<void> {
    // Headers are static, no authentication needed
  }

  async applyAuth(
    config: AxiosRequestConfig,
    _context: AuthContext
  ): Promise<AxiosRequestConfig> {
    return {
      ...config,
      headers: {
        ...config.headers,
        ...this.headers,
      },
    };
  }

  isAuthenticated(_context: AuthContext): boolean {
    return true;
  }

  invalidate(_context: AuthContext): void {
    // Static headers, no state to invalidate
  }

  async getRequiredHeaders(_context: AuthContext): Promise<Record<string, string>> {
    return { ...this.headers };
  }
}
