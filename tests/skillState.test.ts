import { describe, expect, test } from 'vitest';
import {
  applySkillEvidence,
  createEmptySkillState,
  formatMastery,
  scoreSkillEvidence,
} from '../src/domain/skillState';

describe('student skill state', () => {
  test('starts unknown with no evidence', () => {
    const state = createEmptySkillState('C2');
    expect(state.conceptId).toBe('C2');
    expect(state.mastery).toBe(0);
    expect(state.evidenceCount).toBe(0);
    expect(state.status).toBe('unknown');
    expect(state.history).toHaveLength(0);
    expect(formatMastery(state)).toBe('0%');
  });

  test('one sound diagnostic answer becomes provisional evidence', () => {
    const state = applySkillEvidence(createEmptySkillState('C2'), {
      source: 'diagnostic',
      label: 'C2 diagnostic',
      answerCorrect: true,
      reasoning: 'sound',
      confidence: 0.82,
      attempts: 1,
    });
    expect(state.evidenceCount).toBe(1);
    expect(state.correctCount).toBe(1);
    expect(state.reasoningCounts.sound).toBe(1);
    expect(state.mastery).toBeGreaterThan(0.6);
    expect(state.status).toBe('provisional');
    expect(state.history[0]?.source).toBe('diagnostic');
  });

  test('a second strong piece of evidence can demonstrate the skill provisionally', () => {
    const first = applySkillEvidence(createEmptySkillState('C2'), {
      source: 'diagnostic',
      label: 'C2 diagnostic',
      answerCorrect: true,
      reasoning: 'sound',
      confidence: 0.82,
      attempts: 1,
    });
    const second = applySkillEvidence(first, {
      source: 'adaptive',
      label: 'C2 advanced challenge',
      answerCorrect: true,
      reasoning: 'not-assessed',
      confidence: 0.72,
      attempts: 1,
    });
    expect(second.evidenceCount).toBe(2);
    expect(second.status).toBe('demonstrated');
  });

  test('an incorrect answer lowers mastery and does not count as correct', () => {
    const correct = applySkillEvidence(createEmptySkillState('C3'), {
      source: 'diagnostic',
      label: 'C3 diagnostic',
      answerCorrect: true,
      reasoning: 'sound',
      confidence: 0.8,
      attempts: 1,
    });
    const wrong = applySkillEvidence(correct, {
      source: 'boss',
      label: 'C3 boss',
      answerCorrect: false,
      reasoning: 'flawed',
      confidence: 0.8,
      attempts: 1,
    });
    expect(wrong.correctCount).toBe(1);
    expect(wrong.mastery).toBeLessThan(correct.mastery);
    expect(wrong.status).toBe('provisional');
  });

  test('mastery is the running average of evidence scores', () => {
    const first = applySkillEvidence(createEmptySkillState('C1'), {
      source: 'diagnostic',
      label: 'first',
      answerCorrect: true,
      reasoning: 'sound',
      confidence: 0.9,
      attempts: 1,
    });
    const second = applySkillEvidence(first, {
      source: 'concept-check',
      label: 'second',
      answerCorrect: false,
      reasoning: 'insufficient',
      confidence: 0.4,
      attempts: 2,
    });
    const expected = (first.history[0]!.score + second.history[1]!.score) / 2;
    expect(second.mastery).toBeCloseTo(expected, 10);
  });

  test('evidence scores stay inside 0..1 even with out-of-range confidence', () => {
    const high = scoreSkillEvidence({
      source: 'diagnostic',
      label: 'high',
      answerCorrect: true,
      reasoning: 'sound',
      confidence: 9,
      attempts: 1,
    });
    const low = scoreSkillEvidence({
      source: 'diagnostic',
      label: 'low',
      answerCorrect: false,
      reasoning: 'insufficient',
      confidence: -9,
      attempts: 1,
    });
    expect(high).toBeLessThanOrEqual(1);
    expect(high).toBeGreaterThan(0);
    expect(low).toBeGreaterThanOrEqual(0);
  });
});
