import { describe, expect, test } from 'vitest';
import { HttpEvaluationProvider } from '../src/evaluation/httpEvaluator';
import { EvaluationProviderError } from '../src/evaluation/types';
import {
  jsonResponse,
  testRequest,
  validEvaluationResult,
} from './fixtures/evaluation';

function pendingUntilAborted(): typeof fetch {
  return (_input, init) =>
    new Promise<Response>((_resolve, reject) => {
      init?.signal?.addEventListener('abort', () => {
        reject(new DOMException('The operation was aborted.', 'AbortError'));
      });
    });
}

describe('HTTP evaluation provider', () => {
  test('posts the request and validates a labelled server response', async () => {
    let capturedUrl = '';
    let capturedInit: RequestInit | undefined;
    const fetchImpl: typeof fetch = async (input, init) => {
      capturedUrl = String(input);
      capturedInit = init;
      return jsonResponse(validEvaluationResult);
    };

    const provider = new HttpEvaluationProvider({
      endpoint: 'https://evaluation.test/evaluate',
      fetchImpl,
    });
    const result = await provider.evaluate(testRequest);

    expect(result).toEqual(validEvaluationResult);
    expect(capturedUrl).toBe('https://evaluation.test/evaluate');
    expect(capturedInit?.method).toBe('POST');
    expect(JSON.parse(String(capturedInit?.body))).toEqual(testRequest);
    const headers = new Headers(capturedInit?.headers);
    expect(headers.get('content-type')).toContain('application/json');
    expect(headers.get('authorization')).toBeNull();
  });

  test('rejects malformed responses instead of trusting them', async () => {
    const provider = new HttpEvaluationProvider({
      endpoint: 'https://evaluation.test/evaluate',
      fetchImpl: async () =>
        jsonResponse({ ...validEvaluationResult, confidence: 3 }),
    });

    await expect(provider.evaluate(testRequest)).rejects.toThrow(
      /malformed data/,
    );
  });

  test('rejects an unknown evaluator label', async () => {
    const provider = new HttpEvaluationProvider({
      endpoint: 'https://evaluation.test/evaluate',
      fetchImpl: async () =>
        jsonResponse({ ...validEvaluationResult, evaluator: 'robot' }),
    });

    await expect(provider.evaluate(testRequest)).rejects.toBeInstanceOf(
      EvaluationProviderError,
    );
  });

  test('reports a non-OK HTTP status as an evaluation provider error', async () => {
    const provider = new HttpEvaluationProvider({
      endpoint: 'https://evaluation.test/evaluate',
      fetchImpl: async () => jsonResponse({ error: 'unavailable' }, 503),
    });

    await expect(provider.evaluate(testRequest)).rejects.toThrow(/HTTP 503/);
  });

  test('rejects a response that is not valid JSON', async () => {
    const provider = new HttpEvaluationProvider({
      endpoint: 'https://evaluation.test/evaluate',
      fetchImpl: async () => new Response('not json', { status: 200 }),
    });

    await expect(provider.evaluate(testRequest)).rejects.toThrow(/not valid JSON/);
  });

  test('wraps a network failure in an evaluation provider error', async () => {
    const provider = new HttpEvaluationProvider({
      endpoint: 'https://evaluation.test/evaluate',
      fetchImpl: async () => {
        throw new TypeError('network down');
      },
    });

    await expect(provider.evaluate(testRequest)).rejects.toThrow(
      /Could not reach the evaluation API/,
    );
  });

  test('times out and reports the timeout', async () => {
    const provider = new HttpEvaluationProvider({
      endpoint: 'https://evaluation.test/evaluate',
      timeoutMs: 10,
      fetchImpl: pendingUntilAborted(),
    });

    await expect(provider.evaluate(testRequest)).rejects.toThrow(/timed out/);
  });

  test('propagates an abort requested before the call', async () => {
    const provider = new HttpEvaluationProvider({
      endpoint: 'https://evaluation.test/evaluate',
      fetchImpl: pendingUntilAborted(),
    });
    const controller = new AbortController();
    controller.abort();

    await expect(
      provider.evaluate(testRequest, { signal: controller.signal }),
    ).rejects.toMatchObject({ name: 'AbortError' });
  });

  test('propagates an abort requested during the call', async () => {
    const provider = new HttpEvaluationProvider({
      endpoint: 'https://evaluation.test/evaluate',
      timeoutMs: 5_000,
      fetchImpl: pendingUntilAborted(),
    });
    const controller = new AbortController();
    const promise = provider.evaluate(testRequest, { signal: controller.signal });
    controller.abort();

    await expect(promise).rejects.toMatchObject({ name: 'AbortError' });
  });
});
