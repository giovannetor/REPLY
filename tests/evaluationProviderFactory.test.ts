import { afterEach, expect, test, vi } from 'vitest';
import { createEvaluationProvider } from '../src/evaluation/providerFactory';

afterEach(() => vi.unstubAllEnvs());

test('uses the server adapter by default, with a labelled fallback', () => {
  vi.stubEnv('VITE_EVALUATION_API_URL', '');
  const setup = createEvaluationProvider('');
  expect(setup.mode).toBe('api');
  expect(setup.provider.name).toContain('labelled mock fallback');
});

test('allows explicit offline mock mode', () => {
  const setup = createEvaluationProvider('?mockEvaluation=1');
  expect(setup.mode).toBe('mock');
  expect(setup.provider.name).toContain('not AI');
});
