interface ThrottleState {
  semaphore: number;
  maxConcurrent: number;
  lastRequestAt: number;
  minDelayMs: number;
  waiting: Array<() => void>;
}

export class Throttle {
  private states: Map<string, ThrottleState> = new Map();

  constructor(
    private defaultMaxConcurrent: number = 1,
    private defaultMinDelayMs: number = 1000
  ) {}

  async acquire(
    key: string,
    options?: { maxConcurrent?: number; minDelayMs?: number }
  ): Promise<ThrottleLease> {
    let state = this.states.get(key);

    if (!state) {
      state = {
        semaphore: 0,
        maxConcurrent: options?.maxConcurrent ?? this.defaultMaxConcurrent,
        lastRequestAt: 0,
        minDelayMs: options?.minDelayMs ?? this.defaultMinDelayMs,
        waiting: [],
      };
      this.states.set(key, state);
    }

    await this.waitForSlot(state);

    const now = Date.now();
    const timeSinceLastRequest = now - state.lastRequestAt;
    const waitTime = Math.max(0, state.minDelayMs - timeSinceLastRequest);

    if (waitTime > 0) {
      await new Promise((resolve) => setTimeout(resolve, waitTime));
    }

    state.semaphore++;
    state.lastRequestAt = Date.now();

    return new ThrottleLease(state, () => this.release(state!));
  }

  private waitForSlot(state: ThrottleState): Promise<void> {
    if (state.semaphore < state.maxConcurrent) {
      return Promise.resolve();
    }

    return new Promise<void>((resolve) => {
      state.waiting.push(resolve);
    });
  }

  private release(state: ThrottleState): void {
    state.semaphore--;

    const next = state.waiting.shift();
    if (next) {
      next();
    }
  }

  getStats(key: string): { active: number; waiting: number } | undefined {
    const state = this.states.get(key);
    if (!state) return undefined;

    return {
      active: state.semaphore,
      waiting: state.waiting.length,
    };
  }
}

export class ThrottleLease {
  private released = false;

  constructor(
    private state: ThrottleState,
    private releaseCallback: () => void
  ) {}

  release(): void {
    if (this.released) return;
    this.released = true;
    this.releaseCallback();
  }

  [Symbol.dispose](): void {
    this.release();
  }
}

export const globalThrottle = new Throttle();
