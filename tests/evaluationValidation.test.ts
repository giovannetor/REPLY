import { describe, expect, test } from 'vitest';
import {
  validateAiEvaluationPayload,
  validateEvaluationRequest,
  validateEvaluationResult,
} from '../src/evaluation/validate';
import {
  testRequest,
  testRubric,
  validAiPayload,
  validEvaluationResult,
} from './fixtures/evaluation';

describe('AI evaluation payload validation', () => {
  test('accepts a well-formed payload and rebuilds it without extra fields', () => {
    const result = validateAiEvaluationPayload(validAiPayload, testRubric);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toEqual(validAiPayload);
      expect('evaluator' in result.value).toBe(false);
    }
  });

  test('accepts an uncertain payload only when it asks for clarification', () => {
    const withoutClarification = { ...validAiPayload, verdict: 'uncertain' };
    const rejected = validateAiEvaluationPayload(withoutClarification, testRubric);
    expect(rejected.ok).toBe(false);
    if (!rejected.ok) {
      expect(rejected.errors.join(' ')).toContain('clarificationQuestion');
    }

    const accepted = validateAiEvaluationPayload(
      {
        ...validAiPayload,
        verdict: 'uncertain',
        clarificationQuestion: 'Which way does the terminal shock move?',
      },
      testRubric,
    );
    expect(accepted.ok).toBe(true);
  });

  test('rejects unknown fields instead of trusting AI output', () => {
    const result = validateAiEvaluationPayload(
      { ...validAiPayload, script: 'alert(1)' },
      testRubric,
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.join(' ')).toContain('script is not allowed');
    }
  });

  test('rejects invalid verdicts, reasoning values and confidence ranges', () => {
    expect(
      validateAiEvaluationPayload({ ...validAiPayload, verdict: 'maybe' }, testRubric).ok,
    ).toBe(false);
    expect(
      validateAiEvaluationPayload({ ...validAiPayload, reasoning: 'excellent' }, testRubric)
        .ok,
    ).toBe(false);
    for (const confidence of [1.2, -0.1, Number.NaN, 'high']) {
      expect(
        validateAiEvaluationPayload({ ...validAiPayload, confidence }, testRubric).ok,
      ).toBe(false);
    }
  });

  test('rejects empty or oversized feedback', () => {
    expect(
      validateAiEvaluationPayload({ ...validAiPayload, feedback: '   ' }, testRubric).ok,
    ).toBe(false);
    expect(
      validateAiEvaluationPayload(
        { ...validAiPayload, feedback: 'x'.repeat(1_201) },
        testRubric,
      ).ok,
    ).toBe(false);
  });

  test('rejects unknown, duplicated and overlapping rubric criteria', () => {
    const unknown = validateAiEvaluationPayload(
      { ...validAiPayload, matchedCriteria: ['not-a-criterion'] },
      testRubric,
    );
    expect(unknown.ok).toBe(false);
    if (!unknown.ok) {
      expect(unknown.errors.join(' ')).toContain('unknown rubric criterion');
    }

    expect(
      validateAiEvaluationPayload(
        { ...validAiPayload, matchedCriteria: ['spillage', 'spillage'] },
        testRubric,
      ).ok,
    ).toBe(false);

    const overlap = validateAiEvaluationPayload(
      {
        ...validAiPayload,
        matchedCriteria: ['spillage'],
        missingCriteria: ['spillage'],
      },
      testRubric,
    );
    expect(overlap.ok).toBe(false);
    if (!overlap.ok) {
      expect(overlap.errors.join(' ')).toContain('overlap');
    }
  });

  test('rejects non-object payloads and missing required arrays', () => {
    expect(validateAiEvaluationPayload(null, testRubric).ok).toBe(false);
    expect(validateAiEvaluationPayload('correct', testRubric).ok).toBe(false);
    expect(validateAiEvaluationPayload([], testRubric).ok).toBe(false);
    expect(
      validateAiEvaluationPayload(
        { ...validAiPayload, matchedCriteria: undefined },
        testRubric,
      ).ok,
    ).toBe(false);
  });
});

describe('complete evaluation result validation', () => {
  test('accepts a labelled AI result', () => {
    const result = validateEvaluationResult(validEvaluationResult, testRubric);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.evaluator).toBe('ai');
    }
  });

  test('rejects a result without an evaluator label', () => {
    const result = validateEvaluationResult(validAiPayload, testRubric);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.join(' ')).toContain('evaluator');
    }
  });

  test('requires a reason on a labelled mock fallback', () => {
    const withoutReason = validateEvaluationResult(
      { ...validAiPayload, evaluator: 'mock-fallback' },
      testRubric,
    );
    expect(withoutReason.ok).toBe(false);
    if (!withoutReason.ok) {
      expect(withoutReason.errors.join(' ')).toContain('fallbackReason');
    }

    const withReason = validateEvaluationResult(
      {
        ...validAiPayload,
        evaluator: 'mock-fallback',
        fallbackReason: 'The evaluation API returned HTTP 503.',
      },
      testRubric,
    );
    expect(withReason.ok).toBe(true);
    if (withReason.ok) {
      expect(withReason.value.fallbackReason).toContain('HTTP 503');
    }
  });

  test('rejects unknown evaluator labels and invalid nested payloads', () => {
    expect(
      validateEvaluationResult({ ...validAiPayload, evaluator: 'robot' }, testRubric).ok,
    ).toBe(false);
    expect(
      validateEvaluationResult({ ...validEvaluationResult, confidence: 3 }, testRubric).ok,
    ).toBe(false);
  });
});

describe('evaluation request validation', () => {
  test('accepts a well-formed request and rebuilds only known fields', () => {
    const result = validateEvaluationRequest(testRequest);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.questionId).toBe(testRequest.questionId);
      expect(result.value.options).toEqual(testRequest.options);
      expect(result.value.rubric.id).toBe(testRubric.id);
    }
  });

  test('rejects unknown request fields', () => {
    const result = validateEvaluationRequest({
      ...testRequest,
      execute: 'rm -rf /',
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.join(' ')).toContain('request.execute is not allowed');
    }
  });

  test('rejects a rubric whose concept does not match the request', () => {
    const result = validateEvaluationRequest({
      ...testRequest,
      rubric: { ...testRubric, conceptId: 'C3' },
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.join(' ')).toContain('must match the request conceptId');
    }
  });

  test('rejects option ids that are not present in the option list', () => {
    expect(
      validateEvaluationRequest({ ...testRequest, selectedOptionId: 'missing' }).ok,
    ).toBe(false);
    expect(
      validateEvaluationRequest({ ...testRequest, correctOptionId: 'missing' }).ok,
    ).toBe(false);
  });

  test('rejects duplicate options and malformed ids', () => {
    expect(
      validateEvaluationRequest({
        ...testRequest,
        options: [
          { id: 'first', label: 'Same' },
          { id: 'second', label: 'Same' },
        ],
      }).ok,
    ).toBe(false);
    expect(
      validateEvaluationRequest({ ...testRequest, questionId: 'Not A Valid Id!' }).ok,
    ).toBe(false);
  });

  test('rejects empty explanations and too few options', () => {
    expect(validateEvaluationRequest({ ...testRequest, explanation: '' }).ok).toBe(false);
    expect(
      validateEvaluationRequest({
        ...testRequest,
        options: [{ id: 'only-one', label: 'Only one' }],
      }).ok,
    ).toBe(false);
  });
});
