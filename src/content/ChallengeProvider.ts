import { ChallengeValidationError, parseChallenge, type Challenge } from '../domain/challenge';

export interface ChallengeRequestOptions {
  signal?: AbortSignal;
}

/**
 * The only contract the game needs from educational content.
 * Swap MockChallengeProvider for HttpChallengeProvider (or any future
 * AI-backed implementation) without touching the dungeon or boss logic.
 */
export interface ChallengeProvider {
  readonly name: string;
  getChallenge(challengeId: string, options?: ChallengeRequestOptions): Promise<Challenge>;
}

export class ChallengeProviderError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = 'ChallengeProviderError';
  }
}

export function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === 'AbortError';
}

export function describeProviderError(error: unknown): string {
  if (error instanceof ChallengeProviderError) {
    return error.message;
  }
  if (error instanceof ChallengeValidationError) {
    const first = error.errors[0] ?? 'unknown validation error';
    return `The archive returned malformed content: ${first}.`;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return 'The archive returned an unknown error.';
}

/**
 * Reference HTTP implementation. It expects:
 *   GET {baseUrl}/challenges/{challengeId} -> Challenge JSON
 *
 * Responses are parsed as data and validated. No response content is executed.
 */
export class HttpChallengeProvider implements ChallengeProvider {
  readonly name = 'Remote challenge API';
  private readonly baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl.replace(/\/+$/, '');
  }

  async getChallenge(
    challengeId: string,
    options: ChallengeRequestOptions = {},
  ): Promise<Challenge> {
    let response: Response;
    try {
      response = await fetch(
        `${this.baseUrl}/challenges/${encodeURIComponent(challengeId)}`,
        {
          signal: options.signal,
          headers: { Accept: 'application/json' },
        },
      );
    } catch (error) {
      if (isAbortError(error)) {
        throw error;
      }
      throw new ChallengeProviderError(
        `Could not reach the challenge API at ${this.baseUrl}.`,
        { cause: error },
      );
    }

    if (!response.ok) {
      throw new ChallengeProviderError(
        `The challenge API returned HTTP ${response.status} for "${challengeId}".`,
      );
    }

    let payload: unknown;
    try {
      payload = await response.json();
    } catch {
      throw new ChallengeProviderError(
        'The challenge API returned a response that was not valid JSON.',
      );
    }

    return parseChallenge(payload);
  }
}
