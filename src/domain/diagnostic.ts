import type { ConceptId, DiagnosticQuestion } from './learning';
import type { EvaluationResult } from '../evaluation/types';

export interface DiagnosticAnswer {
  questionId: string;
  conceptId: ConceptId;
  selectedOptionId: string;
  explanation: string;
  correct: boolean;
  evaluation: EvaluationResult;
}

export interface DiagnosticState {
  index: number;
  answers: DiagnosticAnswer[];
  complete: boolean;
}

export function createDiagnosticState(
  questions: readonly DiagnosticQuestion[],
): DiagnosticState {
  return {
    index: 0,
    answers: [],
    complete: questions.length === 0,
  };
}

export function currentDiagnosticQuestion(
  state: DiagnosticState,
  questions: readonly DiagnosticQuestion[],
): DiagnosticQuestion | null {
  if (state.complete) {
    return null;
  }
  return questions[state.index] ?? null;
}

export function recordDiagnosticAnswer(
  state: DiagnosticState,
  questions: readonly DiagnosticQuestion[],
  answer: DiagnosticAnswer,
): DiagnosticState {
  const question = currentDiagnosticQuestion(state, questions);
  if (!question || question.id !== answer.questionId) {
    return state;
  }
  if (state.answers.some((entry) => entry.questionId === answer.questionId)) {
    return state;
  }
  const answers = [...state.answers, answer];
  const index = state.index + 1;
  return {
    index,
    answers,
    complete: index >= questions.length,
  };
}

export function diagnosticAnswerFor(
  state: DiagnosticState,
  conceptId: ConceptId,
): DiagnosticAnswer | null {
  return state.answers.find((answer) => answer.conceptId === conceptId) ?? null;
}

export function diagnosticCompletedCount(state: DiagnosticState): number {
  return state.answers.length;
}
