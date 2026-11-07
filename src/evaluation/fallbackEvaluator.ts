import {
  isAbortError,
  type EvaluationProvider,
  type EvaluationRequest,
  type EvaluationRequestOptions,
  type EvaluationResult,
} from './types';

const MAX_FALLBACK_REASON = 500;

/**
 * Wraps a primary evaluator and falls back to the labelled mock evaluator on
 * timeout, network error or invalid output. The game never stops because the
 * AI service is unavailable.
 */
export class FallbackEvaluationProvider implements EvaluationProvider {
  readonly name: string;

  constructor(
    private readonly primary: EvaluationProvider,
    private readonly fallback: EvaluationProvider,
  ) {
    this.name = `${primary.name} + labelled mock fallback`;
  }

  async evaluate(
    request: EvaluationRequest,
    options: EvaluationRequestOptions = {},
  ): Promise<EvaluationResult> {
    try {
      return await this.primary.evaluate(request, options);
    } catch (error) {
      if (isAbortError(error) && options.signal?.aborted) {
        throw error;
      }
      const mock = await this.fallback.evaluate(request, options);
      const reason =
        error instanceof Error
          ? error.message
          : 'The primary evaluator returned an unknown error.';
      return {
        ...mock,
        evaluator: 'mock-fallback',
        fallbackReason: reason.slice(0, MAX_FALLBACK_REASON),
      };
    }
  }
}
