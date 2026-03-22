import crypto from 'crypto';
import type { AxiosRequestConfig } from 'axios';
import type { IAuthStrategy, AuthContext } from '../core/interfaces/index.js';

export interface SignatureConfig {
  secretKey: string;
  signatureHeader: string;
  timestampHeader: string;
  algorithm: 'sha256' | 'sha512';
  includeBody: boolean;
}

export class SignatureStrategy implements IAuthStrategy {
  readonly strategyName = 'Signature';
  private config: SignatureConfig;

  constructor(config: SignatureConfig) {
    this.config = config;
  }

  async authenticate(_context: AuthContext): Promise<void> {
    // Signature is computed per-request, no pre-authentication needed
  }

  async applyAuth(
    config: AxiosRequestConfig,
    _context: AuthContext
  ): Promise<AxiosRequestConfig> {
    const timestamp = Math.floor(Date.now() / 1000).toString();

    const payload = this.buildPayload(config, timestamp);
    const signature = this.computeSignature(payload);

    return {
      ...config,
      headers: {
        ...config.headers,
        [this.config.timestampHeader]: timestamp,
        [this.config.signatureHeader]: signature,
      },
    };
  }

  isAuthenticated(_context: AuthContext): boolean {
    return true;
  }

  invalidate(_context: AuthContext): void {
    // No state to invalidate, signatures are computed fresh
  }

  async getRequiredHeaders(context: AuthContext): Promise<Record<string, string>> {
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const payload = `${timestamp}`;
    const signature = this.computeSignature(payload);

    return {
      [this.config.timestampHeader]: timestamp,
      [this.config.signatureHeader]: signature,
    };
  }

  private buildPayload(config: AxiosRequestConfig, timestamp: string): string {
    const parts: string[] = [
      config.method?.toUpperCase() ?? 'GET',
      config.url ?? '',
      timestamp,
    ];

    if (this.config.includeBody && config.data) {
      const bodyString =
        typeof config.data === 'string' ? config.data : JSON.stringify(config.data);
      parts.push(bodyString);
    }

    return parts.join('');
  }

  private computeSignature(payload: string): string {
    const hmac = crypto.createHmac(this.config.algorithm, this.config.secretKey);
    hmac.update(payload);
    return hmac.digest('hex');
  }
}
