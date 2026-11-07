import { describe, expect, test } from 'vitest';
import { FallbackEvaluationProvider } from '../src/evaluation/fallbackEvaluator';
import { HttpEvaluationProvider } from '../src/evaluation/httpEvaluator';
import { MockEvaluationProvider } from '../src/evaluation/mockEvaluator';
import { createEvaluationProvider } from '../src/evaluation/providerFactory';
import type {
  EvaluationProvider,
  EvaluationRequest,
  EvaluationResult,
} from '../src/evaluation/types';
import { testRequest, validEvaluationResult } from './fixtures/evaluation';

class FixedProvider implements EvaluationProvider {
  readonly name = 'Fixed provider';

  async evaluate(): Promise<EvaluationResult> {
    return validEvaluationResult;
  }
}

class FailingProvider implements EvaluationProvider {
  readonly name = 'Failing provider';

  constructor(private readonly message: string) {}

  async evaluate(): Promise<EvaluationResult> {
    throw new Error(this.message);
  }

}

class AbortProvider implements EvaluationProvider {
  readonly name = 'Abort provider';

  async evaluate(): Promise<EvaluationResult> {
    throw new DOMException('The evaluation was aborted.', 'AbortError');
  }
}

describe('labelled mock fallback', () => {
  test('returns the primary result unchanged when the primary succeeds', async () => {
    const provider = new FallbackEvaluationProvider(
      new FixedProvider(),
      new MockEvaluationProvider(),
    );
    const result = await provider.evaluate(testRequest);
    expect(result).toEqual(validEvaluationResult);
    expect(result.evaluator).toBe('ai');
  });

  test('labels the mock result when the primary throws', async () => {
    const provider = new FallbackEvaluationProvider(
      new FailingProvider('The evaluation API returned HTTP 503.'),
      new MockEvaluationProvider(),
    );
    const result = await provider.evaluate(testRequest);
    expect(result.evaluator).toBe('mock-fallback');
    expect(result.fallbackReason).toBe('The evaluation API returned HTTP 503.');
    expect(result.verdict).toBe('correct');
    expect(result.reasoning).toBe('sound');
  });

  test('falls back when a real HTTP provider cannot reach the server', async () => {
    const failingHttp = new HttpEvaluationProvider({
      endpoint: 'https://evaluation.test/evaluate',
      timeoutMs: 50,
      fetchImpl: async () => {
        throw new TypeError('network down');
      },
    });
    const provider = new FallbackEvaluationProvider(
      failingHttp,
      new MockEvaluationProvider(),
    );
    const result = await provider.evaluate(testRequest);
    expect(result.evaluator).toBe('mock-fallback');
    expect(result.fallbackReason).toContain('Could not reach the evaluation API');
  });

  test('does not swallow an external abort', async () => {
    const provider = new FallbackEvaluationProvider(
      new AbortProvider(),
      new MockEvaluationProvider(),
    );
    const controller = new AbortController();
    controller.abort();

    await expect(
      provider.evaluate(testRequest, { signal: controller.signal }),
    ).rejects.toMatchObject({ name: 'AbortError' });
  });

  test('truncates a very long primary error message', async () => {
    const provider = new FallbackEvaluationProvider(
      new FailingProvider('x'.repeat(2_000)),
      new MockEvaluationProvider(),
    );
    const result = await provider.evaluate(testRequest);
    expect(result.fallbackReason).toHaveLength(500);
  });

  test('the factory forces the clearly-labelled mock mode when requested', () => {
    const setup = createEvaluationProvider('?mockEvaluation=1');
    expect(setup.mode).toBe('mock');
    expect(setup.provider.name).toContain('not AI');
    expect(setup.note).toContain('Mock rubric evaluator');
  });

  test('the factory exposes a fallback-wrapped provider when an API URL is configured', () => {
    const previous = import.meta.env.VITE_EVALUATION_API_URL;
    import.meta.env.VITE_EVALUATION_API_URL = 'https://evaluation.test/evaluate';
    try {
      const setup = createEvaluationProvider('');
      expect(setup.mode).toBe('api');
      expect(setup.provider).toBeInstanceOf(FallbackEvaluationProvider);
      expect(setup.note).toContain('fall back');
    } finally {
      import.meta.env.VITE_EVALUATION_API_URL = previous;
    }
  });
});

describe('fallback request type compatibility', () => {
  test('the mock fallback receives the same request object', async () => {
    const requests: EvaluationRequest[] = [];
    const spy: EvaluationProvider = {
      name: 'Spy',
      async evaluate(request) {
        requests.push(request);
        return validEvaluationResult;
      },
    };
    const provider = new FallbackEvaluationProvider(
      new FailingProvider('primary failed'),
      spy,
    );
    await provider.evaluate(testRequest);
    expect(requests).toEqual([testRequest]);
  });
});
