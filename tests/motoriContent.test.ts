import { describe, expect, test } from 'vitest';
import {
  ADAPTIVE_BANKS,
  BOSS_ROUNDS,
  DIAGNOSTIC_QUESTIONS,
  FRAMEWORK_SOURCE,
  LEARNING_CHALLENGES,
  MOTORI_CONCEPTS,
  MOTORI_COURSE,
  MOTORI_RUBRICS,
  getLearningChallenge,
  getRubric,
} from '../src/content/motoriFramework';
import { BOSS, DOORS } from '../src/content/course';
import { MOCK_CHALLENGES } from '../src/content/mockChallenges';
import { validateChallenge } from '../src/domain/challenge';
import {
  assertBankConsistency,
  decideRoute,
  routeChallengeId,
} from '../src/domain/gameDirector';
import { describeSourceStatus } from '../src/domain/sources';
import { evaluateWithMock } from '../src/evaluation/mockEvaluator';
import type { EvaluationRequest } from '../src/evaluation/types';

describe('Motori content consistency', () => {
  test('every door points at validated content with matching learning metadata', () => {
    expect(DOORS).toHaveLength(3);
    expect(DOORS.map((door) => door.id)).toEqual(['logic', 'order', 'truth']);

    for (const door of DOORS) {
      expect(validateChallenge(MOCK_CHALLENGES[door.challengeId]).ok).toBe(true);
      const learning = getLearningChallenge(door.challengeId);
      expect(learning).toBeDefined();
      expect(learning?.conceptId).toBe(door.conceptId);
    }

    const intake = DOORS.find((door) => door.conceptId === 'C2');
    expect(intake?.adaptive).toBe(true);
    expect(DOORS.filter((door) => door.conceptId !== 'C2').every((door) => !door.adaptive)).toBe(
      true,
    );
  });

  test('boss phases follow the framework order and point at validated content', () => {
    expect(BOSS_ROUNDS).toHaveLength(3);
    expect(BOSS_ROUNDS.map((round) => round.phase)).toEqual([1, 2, 3]);
    expect(BOSS_ROUNDS.map((round) => round.difficulty)).toEqual([1, 2, 3]);
    expect(BOSS_ROUNDS.map((round) => round.conceptId)).toEqual(['C2', 'C3', 'C2']);
    expect(BOSS.roundIds).toEqual(BOSS_ROUNDS.map((round) => round.challengeId));

    for (const round of BOSS_ROUNDS) {
      expect(validateChallenge(MOCK_CHALLENGES[round.challengeId]).ok).toBe(true);
      const learning = getLearningChallenge(round.challengeId);
      expect(learning?.kind).toBe('boss');
      expect(learning?.conceptId).toBe(round.conceptId);
      expect(round.sourceRefs.map((ref) => ref.id)).toContain(FRAMEWORK_SOURCE.id);
    }
  });

  test('the C2 adaptive bank covers every route and never leaves C2', () => {
    expect(() => assertBankConsistency(ADAPTIVE_BANKS)).not.toThrow();

    const c2 = ADAPTIVE_BANKS.C2 ?? [];
    expect(c2.map((ref) => ref.kind).sort()).toEqual([
      'advanced',
      'counterexample',
      'remedial',
    ]);

    for (const ref of c2) {
      expect(ref.conceptId).toBe('C2');
      expect(getLearningChallenge(ref.challengeId)?.conceptId).toBe('C2');
      expect(validateChallenge(MOCK_CHALLENGES[ref.challengeId]).ok).toBe(true);
      const learning = getLearningChallenge(ref.challengeId);
      expect(learning?.kind).toBe(ref.kind);
      expect(learning?.conceptId).toBe('C2');
    }

    expect(ADAPTIVE_BANKS.C1).toBeUndefined();
    expect(ADAPTIVE_BANKS.C3).toBeUndefined();
    expect(ADAPTIVE_BANKS.C4).toBeUndefined();
    expect(ADAPTIVE_BANKS.C5).toBeUndefined();
  });

  test('diagnostics cover C1-C3 with provisional rubrics and honest source status', () => {
    expect(DIAGNOSTIC_QUESTIONS).toHaveLength(3);
    expect(DIAGNOSTIC_QUESTIONS.map((question) => question.conceptId)).toEqual([
      'C1',
      'C2',
      'C3',
    ]);
    expect(DIAGNOSTIC_QUESTIONS.map((question) => question.order)).toEqual([1, 2, 3]);

    const ids = new Set<string>();
    for (const question of DIAGNOSTIC_QUESTIONS) {
      expect(ids.has(question.id)).toBe(false);
      ids.add(question.id);

      expect(question.options.length).toBeGreaterThanOrEqual(2);
      expect(question.options.some((option) => option.id === question.correctOptionId)).toBe(
        true,
      );
      const optionIds = new Set(question.options.map((option) => option.id));
      expect(optionIds.size).toBe(question.options.length);

      const rubric = getRubric(question.rubricId);
      expect(rubric).toBeDefined();
      expect(rubric?.conceptId).toBe(question.conceptId);

      if (question.courseContent) {
        expect(question.id).toBe('Q_D2');
        expect(question.courseContent.independentlyVerified).toBe(false);
        expect(describeSourceStatus(question.answerSourceRefs, 'answer').tone).toBe('unverified');
      } else {
        expect(question.sourceRefs.map((ref) => ref.id)).toContain(FRAMEWORK_SOURCE.id);
        expect(question.answerSourceRefs).toHaveLength(0);
      }
    }
  });

  test('every rubric is provisional, weighted and internally consistent', () => {
    for (const rubric of Object.values(MOTORI_RUBRICS)) {
      expect(rubric.provisional).toBe(true);
      expect(rubric.passThreshold).toBe(rubric.id === 'Q_D2-rubric' ? 1 : 0.6);
      expect(rubric.clarificationPrompt.length).toBeGreaterThan(0);
      expect(rubric.criteria.length).toBeGreaterThan(0);

      const ids = new Set<string>();
      let totalWeight = 0;
      for (const criterion of rubric.criteria) {
        expect(ids.has(criterion.id)).toBe(false);
        ids.add(criterion.id);
        expect(criterion.signals.length).toBeGreaterThan(0);
        expect(criterion.weight).toBeGreaterThan(0);
        totalWeight += criterion.weight;
      }
      expect(totalWeight).toBeCloseTo(1, 6);
    }
  });

  test('C4 and C5 are modeled but explicitly not assessed in this slice', () => {
    expect(MOTORI_CONCEPTS.map((concept) => concept.id)).toEqual([
      'C1',
      'C2',
      'C3',
      'C4',
      'C5',
    ]);
    expect(
      MOTORI_CONCEPTS.filter((concept) => concept.assessedInThisSlice).map(
        (concept) => concept.id,
      ),
    ).toEqual(['C1', 'C2', 'C3']);

    for (const concept of MOTORI_CONCEPTS) {
      expect(concept.summary.length).toBeGreaterThan(0);
      expect(concept.focus.length).toBeGreaterThan(0);
      expect(concept.sourceRefs.map((ref) => ref.id)).toContain(FRAMEWORK_SOURCE.id);
    }
    expect(MOTORI_COURSE.concepts).toEqual(MOTORI_CONCEPTS);
  });

  test('every learning challenge maps to validated content and a matching rubric', () => {
    const mockIds = Object.keys(MOCK_CHALLENGES).sort();
    expect(Object.keys(LEARNING_CHALLENGES).sort()).toEqual(mockIds);

    for (const [id, learning] of Object.entries(LEARNING_CHALLENGES)) {
      expect(learning.challengeId).toBe(id);
      expect(validateChallenge(MOCK_CHALLENGES[id]).ok).toBe(true);

      const rubric = getRubric(learning.rubricId);
      expect(rubric).toBeDefined();
      expect(rubric?.conceptId).toBe(learning.conceptId);

      if (learning.courseContent) {
        expect(learning.courseContent.independentlyVerified).toBe(false);
        expect(describeSourceStatus(learning.answerSourceRefs, 'answer').tone).toBe('unverified');
      } else {
        expect(learning.sourceRefs.map((ref) => ref.id)).toContain(FRAMEWORK_SOURCE.id);
        expect(learning.answerSourceRefs).toHaveLength(0);
        expect(describeSourceStatus(learning.answerSourceRefs, 'answer').tone).toBe('missing');
      }
      expect(['C4', 'C5']).not.toContain(learning.conceptId);
    }
  });

  test('the framework summary is reported as a verified topic source only', () => {
    const topic = describeSourceStatus([FRAMEWORK_SOURCE], 'topic');
    expect(topic.tone).toBe('verified');
    expect(topic.isMissing).toBe(false);
    expect(topic.detail).toContain('topic only');

    const missing = describeSourceStatus([], 'topic');
    expect(missing.tone).toBe('missing');
    expect(missing.isMissing).toBe(true);
  });
});

describe('C2 adaptive flow with the authored content', () => {
  function c2Request(overrides: Partial<EvaluationRequest> = {}): EvaluationRequest {
    const question = DIAGNOSTIC_QUESTIONS.find(
      (entry) => entry.conceptId === 'C2',
    );
    if (!question) {
      throw new Error('The C2 diagnostic question is missing.');
    }
    const rubric = getRubric(question.rubricId);
    if (!rubric) {
      throw new Error('The C2 diagnostic rubric is missing.');
    }

    return {
      questionId: question.id,
      conceptId: question.conceptId,
      prompt: question.prompt,
      options: question.options,
      correctOptionId: question.correctOptionId,
      selectedOptionId: question.correctOptionId,
      explanation:
        'The terminal shock moves upstream outside the cowl as engine demand falls. Excess air spills, and pressure above ambient creates a pressure imbalance causing positive additive drag.',
      rubric,
      ...overrides,
    };
  }

  function routeFor(
    request: EvaluationRequest,
    allowClarification?: boolean,
  ) {
    const evaluation = evaluateWithMock(request);
    const route = decideRoute({
      conceptId: request.conceptId,
      answerCorrect: request.selectedOptionId === request.correctOptionId,
      evaluation,
      bank: ADAPTIVE_BANKS,
      ...(allowClarification === undefined ? {} : { allowClarification }),
    });
    return { evaluation, route };
  }

  test('correct answer plus sound reasoning routes to the advanced C2 challenge', () => {
    const { evaluation, route } = routeFor(c2Request());
    expect(evaluation.verdict).toBe('correct');
    expect(evaluation.reasoning).toBe('sound');
    expect(route.kind).toBe('advanced');
    expect(route.conceptId).toBe('C2');
    expect(routeChallengeId(route)).toBe('Q_A2');
  });

  test('correct answer plus flawed reasoning routes to the C2 counterexample', () => {
    const { evaluation, route } = routeFor(
      c2Request({
        explanation:
          'The terminal shock moves downstream and there is no spill; the flow simply stays started.',
      }),
    );
    expect(evaluation.verdict).toBe('correct');
    expect(evaluation.reasoning).toBe('flawed');
    expect(route.kind).toBe('counterexample');
    expect(route.conceptId).toBe('C2');
    expect(routeChallengeId(route)).toBe('c2-counterexample-shock-position');
  });

  test('wrong answer routes to the C2 remedial challenge', () => {
    const { evaluation, route } = routeFor(
      c2Request({ selectedOptionId: 'distractor-1' }),
    );
    expect(evaluation.verdict).toBe('incorrect');
    expect(route.kind).toBe('remedial');
    expect(route.conceptId).toBe('C2');
    expect(routeChallengeId(route)).toBe('Q_R1');
  });

  test('an unclear answer asks for clarification, then falls back to remedial', () => {
    const unclear = routeFor(c2Request({ explanation: 'idk' }));
    expect(unclear.evaluation.verdict).toBe('uncertain');
    expect(unclear.route.kind).toBe('clarification');
    expect(routeChallengeId(unclear.route)).toBeNull();

    const afterClarification = routeFor(c2Request({ explanation: 'idk' }), false);
    expect(afterClarification.route.kind).toBe('remedial');
    expect(afterClarification.route.conceptId).toBe('C2');
  });
});
