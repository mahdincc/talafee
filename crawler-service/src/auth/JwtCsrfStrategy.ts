import axios, { type AxiosRequestConfig } from 'axios';
import type { IAuthStrategy, AuthContext } from '../core/interfaces/index.js';
import { logger } from '../utils/logger.js';

export interface JwtCsrfConfig {
  loginUrl?: string;
  csrfTokenHeader: string;
  jwtCookieName: string;
  platformHeader?: string;
  channelHeader?: string;
  clientVersionHeader?: string;
}

interface TokenState {
  jwtToken?: string;
  csrfToken?: string;
  expiresAt?: Date;
}

export class JwtCsrfStrategy implements IAuthStrategy {
  readonly strategyName = 'JwtCsrf';
  private tokenStates: Map<string, TokenState> = new Map();
  private config: JwtCsrfConfig;

  constructor(config: JwtCsrfConfig) {
    this.config = config;
  }

  async authenticate(context: AuthContext): Promise<void> {
    const state = this.tokenStates.get(context.providerId) ?? {};

    if (this.isTokenValid(state)) {
      return;
    }

    if (this.config.loginUrl) {
      try {
        const response = await axios.get(this.config.loginUrl, {
          headers: this.getBaseHeaders(),
        });

        const cookies = response.headers['set-cookie'];
        if (cookies) {
          const jwtCookie = cookies.find((c: string) =>
            c.startsWith(`${this.config.jwtCookieName}=`)
          );
          if (jwtCookie) {
            const match = jwtCookie.match(/=([^;]+)/);
            if (match?.[1]) {
              state.jwtToken = match[1];
            }
          }
        }

        const csrfToken = response.headers[this.config.csrfTokenHeader.toLowerCase()];
        if (csrfToken) {
          state.csrfToken = csrfToken as string;
        }

        state.expiresAt = new Date(Date.now() + 30 * 60 * 1000);
        this.tokenStates.set(context.providerId, state);

        logger.info(`JWT/CSRF authentication successful`, {
          providerId: context.providerId,
          correlationId: context.correlationId,
        });
      } catch (error) {
        logger.error(`JWT/CSRF authentication failed`, {
          providerId: context.providerId,
          correlationId: context.correlationId,
          error: error instanceof Error ? error.message : String(error),
        });
        throw error;
      }
    }
  }

  async applyAuth(
    config: AxiosRequestConfig,
    context: AuthContext
  ): Promise<AxiosRequestConfig> {
    const state = this.tokenStates.get(context.providerId);

    const headers: Record<string, string> = {
      ...this.getBaseHeaders(),
      ...(config.headers as Record<string, string>),
    };

    if (state?.csrfToken) {
      headers[this.config.csrfTokenHeader] = state.csrfToken;
    }

    if (state?.jwtToken) {
      headers['Cookie'] = `${this.config.jwtCookieName}=${state.jwtToken}`;
    }

    return {
      ...config,
      headers,
    };
  }

  isAuthenticated(context: AuthContext): boolean {
    const state = this.tokenStates.get(context.providerId);
    return this.isTokenValid(state);
  }

  invalidate(context: AuthContext): void {
    this.tokenStates.delete(context.providerId);
    logger.info(`JWT/CSRF tokens invalidated`, {
      providerId: context.providerId,
    });
  }

  async getRequiredHeaders(context: AuthContext): Promise<Record<string, string>> {
    const state = this.tokenStates.get(context.providerId);
    const headers = this.getBaseHeaders();

    if (state?.csrfToken) {
      headers[this.config.csrfTokenHeader] = state.csrfToken;
    }

    return headers;
  }

  private getBaseHeaders(): Record<string, string> {
    const headers: Record<string, string> = {};

    if (this.config.platformHeader) {
      headers['X-Platform'] = this.config.platformHeader;
    }

    if (this.config.channelHeader) {
      headers['X-Channel'] = this.config.channelHeader;
    }

    if (this.config.clientVersionHeader) {
      headers['X-Client-Version'] = this.config.clientVersionHeader;
    }

    return headers;
  }

  private isTokenValid(state?: TokenState): boolean {
    if (!state?.expiresAt) return false;
    return state.expiresAt > new Date();
  }
}
