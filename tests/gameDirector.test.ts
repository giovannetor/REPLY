import { describe, expect, test } from 'vitest';
import { ADAPTIVE_BANKS } from '../src/content/motoriFramework';
import {
  assertBankConsistency,
  decideRoute,
  type AdaptiveChallengeBank,
  type DirectorEvaluation,
} from '../src/domain/gameDirector';

function route(
  evaluation: DirectorEvaluation,
  answerCorrect = true,
  allowClarification?: boolean,
) {
  return decideRoute({
    conceptId: 'C2',
    answerCorrect,
    evaluation,
    bank: ADAPTIVE_BANKS,
    ...(allowClarification === undefined ? {} : { allowClarification }),
  });
}

describe('GameDirector adaptive routing', () => {
  test('sound reasoning on a correct answer routes to the advanced C2 challenge', () => {
    const result = route({
      verdict: 'correct',
      reasoning: 'sound',
      confidence: 0.9,
    });
    expect(result.kind).toBe('advanced');
    expect(result.conceptId).toBe('C2');
    if (result.kind !== 'clarification') {
      expect(result.challengeId).toBe('Q_A2');
    }
  });

  test('correct answer with flawed reasoning routes to a C2 counterexample', () => {
    const result = route({
      verdict: 'correct',
      reasoning: 'flawed',
      confidence: 0.8,
    });
    expect(result.kind).toBe('counterexample');
    expect(result.conceptId).toBe('C2');
    if (result.kind !== 'clarification') {
      expect(result.challengeId).toBe('c2-counterexample-shock-position');
    }
  });

  test('wrong answer routes to a remedial C2 challenge', () => {
    const result = route(
      { verdict: 'incorrect', reasoning: 'flawed', confidence: 0.8 },
      false,
    );
    expect(result.kind).toBe('remedial');
    expect(result.conceptId).toBe('C2');
    if (result.kind !== 'clarification') {
      expect(result.challengeId).toBe('Q_R1');
    }
  });

  test('uncertain evaluation asks for clarification first', () => {
    const result = route({
      verdict: 'uncertain',
      reasoning: 'insufficient',
      confidence: 0.35,
      clarificationQuestion: 'Which way does the shock move?',
    });
    expect(result.kind).toBe('clarification');
    if (result.kind === 'clarification') {
      expect(result.prompt).toBe('Which way does the shock move?');
    }
  });

  test('uncertainty after clarification falls back to remedial, not an endless loop', () => {
    const result = route(
      {
        verdict: 'uncertain',
        reasoning: 'insufficient',
        confidence: 0.35,
        clarificationQuestion: 'Try again.',
      },
      true,
      false,
    );
    expect(result.kind).toBe('remedial');
    expect(result.conceptId).toBe('C2');
  });

  test('an inconsistent verdict is treated as uncertain', () => {
    const result = route({
      verdict: 'incorrect',
      reasoning: 'sound',
      confidence: 0.95,
    });
    expect(result.kind).toBe('clarification');
  });

  test('low confidence triggers clarification even when the verdict is correct', () => {
    const result = route({
      verdict: 'correct',
      reasoning: 'sound',
      confidence: 0.4,
    });
    expect(result.kind).toBe('clarification');
  });

  test('every C2 route stays on C2 and never selects C5 content', () => {
    const evaluations: DirectorEvaluation[] = [
      { verdict: 'correct', reasoning: 'sound', confidence: 0.9 },
      { verdict: 'correct', reasoning: 'flawed', confidence: 0.8 },
      { verdict: 'incorrect', reasoning: 'flawed', confidence: 0.8 },
    ];
    for (const evaluation of evaluations) {
      const result = route(evaluation, evaluation.verdict === 'correct');
      expect(result.conceptId).toBe('C2');
      if (result.kind !== 'clarification') {
        expect(ADAPTIVE_BANKS.C2?.find((ref) => ref.challengeId === result.challengeId)?.conceptId).toBe('C2');
      }
    }
  });

  test('a bank that mixes concepts is rejected', () => {
    const badBank: AdaptiveChallengeBank = {
      C2: [
        {
          challengeId: 'c5-advanced-efficiency',
          conceptId: 'C5',
          kind: 'advanced',
        },
      ],
    };
    expect(() => assertBankConsistency(badBank)).toThrow(/C2.*C5/);
  });

  test('a missing concept bank is rejected', () => {
    expect(() =>
      decideRoute({
        conceptId: 'C5',
        answerCorrect: false,
        evaluation: { verdict: 'incorrect', reasoning: 'flawed', confidence: 0.8 },
        bank: ADAPTIVE_BANKS,
      }),
    ).toThrow(/No adaptive challenge bank/);
  });
});
