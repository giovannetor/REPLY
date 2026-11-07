import { describe, expect, test } from 'vitest';
import pack from '../Content/Courses/motori-aeromobili/motori_aeromobili_c2_content_pack.json';
import { C2_CONTENT_PACK, importCoursePack } from '../src/content/coursePackAdapter';
import { ADAPTIVE_BANKS, DIAGNOSTIC_QUESTIONS, getRubric } from '../src/content/motoriFramework';
import { MockChallengeProvider } from '../src/content/mockProvider';
import { parseChallenge } from '../src/domain/challenge';
import { createDiagnosticState, recordDiagnosticAnswer } from '../src/domain/diagnostic';
import { decideRoute } from '../src/domain/gameDirector';
import { applySkillEvidence, createEmptySkillState } from '../src/domain/skillState';
import { evaluateWithMock } from '../src/evaluation/mockEvaluator';
import { validateEvaluationRequest } from '../src/evaluation/validate';
import { buildEvaluationPrompt } from '../server/aiEvaluationAdapter';
import type { EvaluationRequest } from '../src/evaluation/types';

describe('C2 course pack import', () => {
  test('imports all eight compatible IDs and excludes both review questions', () => {
    expect(C2_CONTENT_PACK.errors).toEqual([]);
    expect(C2_CONTENT_PACK.excluded).toEqual(['Q_R2', 'Q_A1']);
    expect(Object.keys(C2_CONTENT_PACK.challenges)).toEqual([
      'Q_D1', 'Q_D2', 'Q_D3', 'Q_R1', 'Q_A2', 'Q_B1', 'Q_B2', 'Q_B3',
    ]);
  });

  test('retains original wording, every distractor, hints, misconception, rubric, pages and status', () => {
    for (const original of pack.questions.filter((q) => q.status === 'SUPPORTED')) {
      const challenge = parseChallenge(C2_CONTENT_PACK.challenges[original.id]);
      const learning = C2_CONTENT_PACK.learning[original.id];
      expect(challenge.id).toBe(original.id);
      expect(challenge.prompt).toBe(original.question);
      expect(challenge.explanation).toBe(original.reasoning);
      expect(challenge.hint).toBe(original.hints.join('\n'));
      if (challenge.type !== 'multiple-choice') throw new Error('Expected multiple choice');
      expect(challenge.options.find((o) => o.id === challenge.correctOptionId)?.label).toBe(original.correct_answer);
      expect(challenge.options.filter((o) => o.id !== challenge.correctOptionId).map((o) => o.label).sort())
        .toEqual([...original.incorrect_answers].sort());
      expect(learning.courseContent?.question).toEqual(original);
      expect(learning.courseContent?.independentlyVerified).toBe(false);
      expect(learning.answerSourceRefs[0]).toMatchObject({
        title: pack.source_document, locator: `pp. ${original.source_pages}`, verified: false,
      });
      expect(getRubric(learning.rubricId)?.scoringGuide).toEqual(original.rubric);
      expect(getRubric(learning.rubricId)?.misconception).toBe(original.misconception);
    }
  });

  test('rejects incompatible questions without removing the remaining usable questions', () => {
    const invalid = structuredClone(pack);
    invalid.questions[0].correct_answer = '';
    const imported = importCoursePack(invalid);
    expect(imported.challenges.Q_D1).toBeUndefined();
    expect(imported.challenges.Q_D2).toBeDefined();
    expect(imported.errors).toHaveLength(1);
    expect(importCoursePack({}).challenges).toEqual({});
    expect(importCoursePack({}).errors).not.toHaveLength(0);
  });

  test('rejects duplicate IDs and review status even on normally usable questions', () => {
    const duplicate = { ...pack, questions: [...pack.questions, pack.questions[0]] };
    expect(importCoursePack(duplicate).challenges.Q_D1).toBeUndefined();
    const review = structuredClone(pack);
    review.questions[0].status = 'NEEDS_REVIEW';
    expect(importCoursePack(review).challenges.Q_D1).toBeUndefined();
  });
});

const sound = 'Lower engine mass flow demand moves the terminal shock upstream outside the cowl. Excess air spills. Pressure above ambient produces a pressure imbalance causing positive additive drag.';
const flawed = 'The shock moves downstream and there is no spill; pressure below ambient causes negative additive drag.';

function requestFor(selectedOptionId: string, explanation: string): EvaluationRequest {
  const question = DIAGNOSTIC_QUESTIONS.find((q) => q.id === 'Q_D2');
  if (!question) throw new Error('Q_D2 is not wired into the actual diagnostic');
  const rubric = getRubric(question.rubricId);
  if (!rubric) throw new Error('Missing rubric');
  return {
    questionId: question.id, conceptId: question.conceptId, prompt: question.prompt,
    options: question.options, correctOptionId: question.correctOptionId,
    selectedOptionId, explanation, rubric,
  };
}

describe('Q_D2 diagnostic → director → challenge → skill evidence', () => {
  test.each([
    ['answer', sound, 'advanced', 'Q_A2', 'sound'],
    ['distractor-1', flawed, 'remedial', 'Q_R1', 'flawed'],
    ['answer', flawed, 'counterexample', 'c2-counterexample-shock-position', 'flawed'],
  ])('%s / %s selects %s', async (selected, explanation, kind, id, reasoning) => {
    const request = requestFor(selected, explanation);
    expect(validateEvaluationRequest(request).ok).toBe(true);
    const evaluation = evaluateWithMock(request);
    expect(evaluation.evaluator).toBe('mock');
    expect(evaluation.reasoning).toBe(reasoning);
    const correct = selected === request.correctOptionId;
    const diagnostic = recordDiagnosticAnswer(createDiagnosticState([DIAGNOSTIC_QUESTIONS[1]]),
      [DIAGNOSTIC_QUESTIONS[1]], {
        questionId: request.questionId, conceptId: 'C2', selectedOptionId: selected,
        explanation, correct, evaluation,
      });
    expect(diagnostic.complete).toBe(true);
    expect(diagnostic.answers[0].questionId).toBe('Q_D2');
    const route = decideRoute({ conceptId: 'C2', answerCorrect: correct, evaluation, bank: ADAPTIVE_BANKS });
    expect(route).toMatchObject({ kind, challengeId: id, conceptId: 'C2' });
    const challenge = await new MockChallengeProvider({ latencyMs: 0 }).getChallenge(id);
    expect(challenge.id).toBe(id);
    const skill = applySkillEvidence(createEmptySkillState('C2'), {
      source: 'diagnostic', label: 'Q_D2', answerCorrect: correct,
      reasoning: evaluation.reasoning, confidence: evaluation.confidence, attempts: 1,
    });
    expect(skill.evidenceCount).toBe(1);
    expect(skill.correctCount).toBe(correct ? 1 : 0);
    expect(skill.reasoningCounts[evaluation.reasoning]).toBe(1);
    expect(skill.mastery).toBeGreaterThan(0);
    expect(skill.status).toBe('provisional');
    const afterChallenge = applySkillEvidence(skill, {
      source: 'adaptive', label: challenge.id, answerCorrect: true,
      reasoning: 'not-assessed', confidence: 0.72, attempts: 1,
    });
    expect(afterChallenge.evidenceCount).toBe(2);
    expect(afterChallenge.mastery).not.toBe(skill.mastery);
    expect(afterChallenge.history[1].label).toBe(id);
  });

  test('a wrong option with a short or uncertain explanation still selects remedial', () => {
    const request = requestFor('distractor-1', 'idk');
    const evaluation = evaluateWithMock(request);
    expect(decideRoute({ conceptId: 'C2', answerCorrect: false, evaluation, bank: ADAPTIVE_BANKS }))
      .toMatchObject({ kind: 'remedial', challengeId: 'Q_R1' });
  });

  test('sound reasoning records stronger skill evidence than flawed or wrong reasoning', () => {
    const mastery = (selected: string, explanation: string) => {
      const request = requestFor(selected, explanation);
      const evaluation = evaluateWithMock(request);
      return applySkillEvidence(createEmptySkillState('C2'), {
        source: 'diagnostic', label: 'Q_D2', answerCorrect: selected === 'answer',
        reasoning: evaluation.reasoning, confidence: evaluation.confidence, attempts: 1,
      }).mastery;
    };
    expect(mastery('answer', sound)).toBeGreaterThan(mastery('answer', flawed));
    expect(mastery('answer', flawed)).toBeGreaterThan(mastery('distractor-1', flawed));
  });

  test('passes the original rubric levels and misconception through validation into the AI prompt', () => {
    const checked = validateEvaluationRequest(requestFor('answer', sound));
    if (!checked.ok) throw new Error(checked.errors.join('; '));
    const prompt = buildEvaluationPrompt(checked.value);
    const original = pack.questions.find((q) => q.id === 'Q_D2')!;
    expect(prompt).toContain(original.rubric['2']);
    expect(prompt).toContain(original.rubric['1']);
    expect(prompt).toContain(original.rubric['0']);
    expect(prompt).toContain(original.misconception);
  });
});
