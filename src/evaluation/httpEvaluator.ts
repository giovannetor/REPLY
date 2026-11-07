import {
  EvaluationProviderError,
  isAbortError,
  type EvaluationProvider,
  type EvaluationRequest,
  type EvaluationRequestOptions,
  type EvaluationResult,
} from './types';
import { validateEvaluationResult } from './validate';

export interface HttpEvaluationProviderOptions {
  endpoint: string;
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
}

/**
 * Client for the server-side AI evaluation adapter. The API key never reaches
 * this module: the browser only calls the configured evaluation endpoint.
 * Every response is parsed as data and validated before use.
 */
export class HttpEvaluationProvider implements EvaluationProvider {
  readonly name = 'AI evaluation endpoint';
  private readonly endpoint: string;
  private readonly timeoutMs: number;
  private readonly fetchImpl: typeof fetch;

  constructor(options: HttpEvaluationProviderOptions) {
    this.endpoint = options.endpoint;
    this.timeoutMs = options.timeoutMs ?? 8_000;
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  async evaluate(
    request: EvaluationRequest,
    options: EvaluationRequestOptions = {},
  ): Promise<EvaluationResult> {
    if (options.signal?.aborted) {
      throw new DOMException('The evaluation was aborted.', 'AbortError');
    }

    const controller = new AbortController();
    let timedOut = false;
    const onExternalAbort = () => controller.abort();
    options.signal?.addEventListener('abort', onExternalAbort, { once: true });

    let timeoutHandle: ReturnType<typeof setTimeout> | undefined;
    const timeoutPromise = new Promise<never>((_, reject) => {
      timeoutHandle = setTimeout(() => {
        timedOut = true;
        controller.abort();
        reject(new EvaluationProviderError('The evaluation API timed out.'));
      }, this.timeoutMs);
    });

    try {
      const fetchPromise = this.fetchImpl(this.endpoint, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(request),
        signal: controller.signal,
      });
      const response = await Promise.race([fetchPromise, timeoutPromise]);

      if (!response.ok) {
        throw new EvaluationProviderError(
          `The evaluation API returned HTTP ${response.status}.`,
        );
      }

      let payload: unknown;
      try {
        payload = await response.json();
      } catch {
        throw new EvaluationProviderError(
          'The evaluation API returned a response that was not valid JSON.',
        );
      }

      const validated = validateEvaluationResult(payload, request.rubric);
      if (!validated.ok) {
        throw new EvaluationProviderError(
          `The evaluation API returned malformed data: ${validated.errors[0] ?? 'unknown validation error'}.`,
        );
      }
      return validated.value;
    } catch (error) {
      if (isAbortError(error)) {
        if (options.signal?.aborted) {
          throw error;
        }
        throw new EvaluationProviderError(
          timedOut
            ? 'The evaluation API timed out.'
            : 'The evaluation request was aborted.',
          { cause: error },
        );
      }
      if (error instanceof EvaluationProviderError) {
        throw error;
      }
      throw new EvaluationProviderError('Could not reach the evaluation API.', {
        cause: error,
      });
    } finally {
      if (timeoutHandle !== undefined) {
        clearTimeout(timeoutHandle);
      }
      options.signal?.removeEventListener('abort', onExternalAbort);
    }
  }
}
