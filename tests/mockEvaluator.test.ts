import { describe, expect, test } from 'vitest';
import { evaluateWithMock, MockEvaluationProvider } from '../src/evaluation/mockEvaluator';
import { testRequest } from './fixtures/evaluation';

describe('labelled mock evaluator', () => {
  test('marks a correct answer with rubric evidence as sound reasoning', () => {
    const result = evaluateWithMock(testRequest);
    expect(result.evaluator).toBe('mock');
    expect(result.verdict).toBe('correct');
    expect(result.reasoning).toBe('sound');
    expect(result.confidence).toBeGreaterThan(0.8);
    expect(result.matchedCriteria).toEqual(
      expect.arrayContaining(['shock-motion', 'spillage', 'additive-drag', 'unstart-risk']),
    );
    expect(result.missingCriteria).toHaveLength(0);
  });

  test('keeps a correct answer with weak reasoning at flawed, not sound', () => {
    const result = evaluateWithMock({
      ...testRequest,
      explanation:
        'The terminal shock moves downstream and there is no spill; the flow stays started.',
    });
    expect(result.verdict).toBe('correct');
    expect(result.reasoning).toBe('flawed');
    expect(result.matchedCriteria).not.toContain('shock-motion');
    expect(result.matchedCriteria).not.toContain('spillage');
  });

  test('anti-signals cancel a matching keyword', () => {
    const result = evaluateWithMock({
      ...testRequest,
      explanation: 'The terminal shock moves upstream, but there is no spill at all.',
    });
    expect(result.matchedCriteria).toContain('shock-motion');
    expect(result.matchedCriteria).not.toContain('spillage');
    expect(result.missingCriteria).toContain('spillage');
    expect(result.reasoning).toBe('flawed');
  });

  test('marks a wrong answer as incorrect even when the reasoning matches the rubric', () => {
    const result = evaluateWithMock({
      ...testRequest,
      selectedOptionId: 'recovery-improves',
    });
    expect(result.verdict).toBe('incorrect');
    expect(result.reasoning).toBe('sound');
  });

  test('marks a wrong answer with weak reasoning as incorrect and flawed', () => {
    const result = evaluateWithMock({
      ...testRequest,
      selectedOptionId: 'recovery-improves',
      explanation: 'The shock moves downstream and nothing else changes in the intake.',
    });
    expect(result.verdict).toBe('incorrect');
    expect(result.reasoning).toBe('flawed');
  });

  test('asks for clarification when a correct answer has a too-short explanation', () => {
    const result = evaluateWithMock({
      ...testRequest,
      explanation: 'Too short.',
    });
    expect(result.verdict).toBe('uncertain');
    expect(result.reasoning).toBe('insufficient');
    expect(result.clarificationQuestion).toBe(testRequest.rubric.clarificationPrompt);
  });

  test('does not ask for clarification when the answer is already wrong', () => {
    const result = evaluateWithMock({
      ...testRequest,
      selectedOptionId: 'recovery-improves',
      explanation: 'Nope.',
    });
    expect(result.verdict).toBe('incorrect');
    expect(result.reasoning).toBe('insufficient');
    expect(result.clarificationQuestion).toBeUndefined();
  });

  test('keeps matched and missing criteria disjoint and complete', () => {
    const result = evaluateWithMock({
      ...testRequest,
      explanation: 'The terminal shock moves upstream and the intake spills air.',
    });
    const all = testRequest.rubric.criteria.map((criterion) => criterion.id);
    expect([...result.matchedCriteria, ...result.missingCriteria].sort()).toEqual(
      [...all].sort(),
    );
    expect(
      result.matchedCriteria.filter((id) => result.missingCriteria.includes(id)),
    ).toHaveLength(0);
  });

  test('honours an already-aborted signal before returning a mock result', async () => {
    const provider = new MockEvaluationProvider({ latencyMs: 50 });
    const controller = new AbortController();
    controller.abort();

    await expect(
      provider.evaluate(testRequest, { signal: controller.signal }),
    ).rejects.toMatchObject({ name: 'AbortError' });
  });

  test('returns the deterministic result through the provider wrapper', async () => {
    const provider = new MockEvaluationProvider();
    const result = await provider.evaluate(testRequest);
    expect(result).toEqual(evaluateWithMock(testRequest));
    expect(provider.name).toContain('not AI');
  });
});
