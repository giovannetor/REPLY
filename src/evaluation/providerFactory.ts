import { FallbackEvaluationProvider } from './fallbackEvaluator';
import { HttpEvaluationProvider } from './httpEvaluator';
import { MockEvaluationProvider } from './mockEvaluator';
import type { EvaluationProvider } from './types';

export interface EvaluationSetup {
  provider: EvaluationProvider;
  mode: 'mock' | 'api';
  note: string;
}

export function createEvaluationProvider(
  search = window.location.search,
): EvaluationSetup {
  const apiUrl = import.meta.env.VITE_EVALUATION_API_URL?.trim();
  const forceMock = new URLSearchParams(search).get('mockEvaluation') === '1';

  if (apiUrl && !forceMock) {
    return {
      provider: new FallbackEvaluationProvider(
        new HttpEvaluationProvider({ endpoint: apiUrl, timeoutMs: 8_000 }),
        new MockEvaluationProvider({ latencyMs: 150 }),
      ),
      mode: 'api',
      note: 'AI evaluation endpoint configured. Timeouts, invalid outputs and network errors fall back to the labelled mock evaluator.',
    };
  }

  return {
    provider: new MockEvaluationProvider({ latencyMs: 350 }),
    mode: 'mock',
    note: 'Mock rubric evaluator (not AI). Set VITE_EVALUATION_API_URL to use the server adapter; the game still works if it fails.',
  };
}
