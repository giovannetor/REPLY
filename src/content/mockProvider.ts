import { parseChallenge, type Challenge } from '../domain/challenge';
import {
  ChallengeProviderError,
  type ChallengeProvider,
  type ChallengeRequestOptions,
} from './ChallengeProvider';
import { MOCK_CHALLENGES } from './mockChallenges';

export interface MockChallengeProviderOptions {
  latencyMs?: number;
  failFirstAttempt?: boolean;
}

function wait(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException('The request was aborted.', 'AbortError'));
      return;
    }

    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, ms);

    const onAbort = () => {
      clearTimeout(timer);
      signal?.removeEventListener('abort', onAbort);
      reject(new DOMException('The request was aborted.', 'AbortError'));
    };

    signal?.addEventListener('abort', onAbort, { once: true });
  });
}

/**
 * Local provider used by the prototype. It deliberately simulates latency so
 * loading states are real, and can fail once per challenge to exercise retry.
 */
export class MockChallengeProvider implements ChallengeProvider {
  readonly name = 'Local mock archive';
  private readonly latencyMs: number;
  private readonly failFirstAttempt: boolean;
  private readonly failedOnce = new Set<string>();

  constructor(options: MockChallengeProviderOptions = {}) {
    this.latencyMs = options.latencyMs ?? 650;
    this.failFirstAttempt = options.failFirstAttempt ?? false;
  }

  async getChallenge(
    challengeId: string,
    options: ChallengeRequestOptions = {},
  ): Promise<Challenge> {
    await wait(this.latencyMs, options.signal);

    if (this.failFirstAttempt && !this.failedOnce.has(challengeId)) {
      this.failedOnce.add(challengeId);
      throw new ChallengeProviderError(
        'Simulated timeout: the local archive did not answer. Retry to continue.',
      );
    }

    const raw = MOCK_CHALLENGES[challengeId];
    if (raw === undefined) {
      throw new ChallengeProviderError(
        `The archive does not contain a challenge called "${challengeId}".`,
      );
    }

    return parseChallenge(raw);
  }
}
