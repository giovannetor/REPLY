import { describe, expect, test } from 'vitest';
import { DIAGNOSTIC_QUESTIONS } from '../src/content/motoriFramework';
import {
  createDiagnosticState,
  currentDiagnosticQuestion,
  diagnosticAnswerFor,
  diagnosticCompletedCount,
  recordDiagnosticAnswer,
  type DiagnosticAnswer,
} from '../src/domain/diagnostic';
import type { DiagnosticQuestion } from '../src/domain/learning';
import { validAiPayload } from './fixtures/evaluation';

function answerFor(
  question: DiagnosticQuestion,
  selectedOptionId = question.correctOptionId,
): DiagnosticAnswer {
  return {
    questionId: question.id,
    conceptId: question.conceptId,
    selectedOptionId,
    explanation: 'A test explanation for the diagnostic state.',
    correct: selectedOptionId === question.correctOptionId,
    evaluation: { ...validAiPayload, evaluator: 'mock' },
  };
}

describe('diagnostic session state', () => {
  test('starts on the first question and is not complete', () => {
    const state = createDiagnosticState(DIAGNOSTIC_QUESTIONS);
    expect(state.index).toBe(0);
    expect(state.complete).toBe(false);
    expect(diagnosticCompletedCount(state)).toBe(0);
    expect(currentDiagnosticQuestion(state, DIAGNOSTIC_QUESTIONS)?.id).toBe(
      DIAGNOSTIC_QUESTIONS[0]?.id,
    );
  });

  test('records answers in order and advances', () => {
    const first = DIAGNOSTIC_QUESTIONS[0]!;
    const second = DIAGNOSTIC_QUESTIONS[1]!;

    const state0 = createDiagnosticState(DIAGNOSTIC_QUESTIONS);
    const state1 = recordDiagnosticAnswer(
      state0,
      DIAGNOSTIC_QUESTIONS,
      answerFor(first),
    );

    expect(state1.index).toBe(1);
    expect(state1.answers).toHaveLength(1);
    expect(state1.complete).toBe(false);
    expect(currentDiagnosticQuestion(state1, DIAGNOSTIC_QUESTIONS)?.id).toBe(second.id);
  });

  test('ignores an answer for a question that is not current', () => {
    const state0 = createDiagnosticState(DIAGNOSTIC_QUESTIONS);
    const state1 = recordDiagnosticAnswer(
      state0,
      DIAGNOSTIC_QUESTIONS,
      answerFor(DIAGNOSTIC_QUESTIONS[0]!),
    );
    const rejected = recordDiagnosticAnswer(
      state1,
      DIAGNOSTIC_QUESTIONS,
      answerFor(DIAGNOSTIC_QUESTIONS[2]!),
    );

    expect(rejected).toBe(state1);
  });

  test('ignores a duplicate answer for an already-recorded question', () => {
    const first = DIAGNOSTIC_QUESTIONS[0]!;
    const state0 = createDiagnosticState(DIAGNOSTIC_QUESTIONS);
    const state1 = recordDiagnosticAnswer(state0, DIAGNOSTIC_QUESTIONS, answerFor(first));
    const duplicate = recordDiagnosticAnswer(
      state1,
      DIAGNOSTIC_QUESTIONS,
      answerFor(first),
    );

    expect(duplicate).toBe(state1);
    expect(diagnosticCompletedCount(duplicate)).toBe(1);
  });

  test('completes after the last question and exposes answers by concept', () => {
    let state = createDiagnosticState(DIAGNOSTIC_QUESTIONS);
    for (const question of DIAGNOSTIC_QUESTIONS) {
      state = recordDiagnosticAnswer(state, DIAGNOSTIC_QUESTIONS, answerFor(question));
    }

    expect(state.complete).toBe(true);
    expect(state.index).toBe(DIAGNOSTIC_QUESTIONS.length);
    expect(diagnosticCompletedCount(state)).toBe(DIAGNOSTIC_QUESTIONS.length);
    expect(currentDiagnosticQuestion(state, DIAGNOSTIC_QUESTIONS)).toBeNull();

    const c2 = diagnosticAnswerFor(state, 'C2');
    expect(c2?.conceptId).toBe('C2');
    expect(c2?.questionId).toBe(
      DIAGNOSTIC_QUESTIONS.find((question) => question.conceptId === 'C2')?.id,
    );
    expect(diagnosticAnswerFor(state, 'C4')).toBeNull();
  });

  test('an empty diagnostic is immediately complete', () => {
    const state = createDiagnosticState([]);
    expect(state.complete).toBe(true);
    expect(currentDiagnosticQuestion(state, [])).toBeNull();
  });
});
