import { describe, expect, test } from 'vitest';
import schema from '../src/content/challenge.schema.json';
import { MOCK_CHALLENGES } from '../src/content/mockChallenges';
import {
  ChallengeValidationError,
  parseChallenge,
  validateChallenge,
} from '../src/domain/challenge';

const validMultipleChoice = {
  id: 'validation-mc',
  type: 'multiple-choice',
  topic: 'logic',
  title: 'A valid question',
  prompt: 'Pick the correct option.',
  explanation: 'The first option is correct.',
  xp: 25,
  options: [
    { id: 'first', label: 'First' },
    { id: 'second', label: 'Second' },
  ],
  correctOptionId: 'first',
};

const validSequence = {
  id: 'validation-sequence',
  type: 'sequence',
  topic: 'order',
  title: 'A valid sequence',
  prompt: 'Order the entries.',
  explanation: 'One then two.',
  xp: 25,
  items: [
    { id: 'one', label: 'One' },
    { id: 'two', label: 'Two' },
  ],
  correctOrder: ['one', 'two'],
};

const validTrueFalse = {
  id: 'validation-tf',
  type: 'true-false',
  topic: 'truth',
  title: 'A valid true/false',
  prompt: 'True or false?',
  explanation: 'It is true.',
  xp: 25,
  correctAnswer: true,
};

describe('challenge validation', () => {
  test('accepts all bundled mock challenges', () => {
    const ids = new Set<string>();
    for (const raw of Object.values(MOCK_CHALLENGES)) {
      const result = validateChallenge(raw);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(ids.has(result.challenge.id)).toBe(false);
        ids.add(result.challenge.id);
      }
    }
    expect(ids.size).toBe(Object.keys(MOCK_CHALLENGES).length);
  });

  test('accepts the three valid challenge shapes', () => {
    expect(validateChallenge(validMultipleChoice).ok).toBe(true);
    expect(validateChallenge(validSequence).ok).toBe(true);
    expect(validateChallenge(validTrueFalse).ok).toBe(true);
  });

  test('rejects non-objects and missing required fields', () => {
    expect(validateChallenge(null).ok).toBe(false);
    expect(validateChallenge('challenge').ok).toBe(false);
    expect(validateChallenge([]).ok).toBe(false);
    expect(validateChallenge({ ...validMultipleChoice, title: undefined }).ok).toBe(false);
    expect(validateChallenge({ ...validMultipleChoice, id: '' }).ok).toBe(false);
  });

  test('rejects unknown and type-inappropriate fields', () => {
    expect(validateChallenge({ ...validMultipleChoice, script: 'alert(1)' }).ok).toBe(false);
    expect(validateChallenge({ ...validMultipleChoice, items: [] }).ok).toBe(false);
    expect(validateChallenge({ ...validSequence, correctAnswer: true }).ok).toBe(false);
    expect(validateChallenge({ ...validTrueFalse, options: [] }).ok).toBe(false);
  });

  test('rejects malformed multiple-choice options', () => {
    expect(
      validateChallenge({
        ...validMultipleChoice,
        options: [
          { id: 'same', label: 'A' },
          { id: 'same', label: 'B' },
        ],
      }).ok,
    ).toBe(false);
    expect(
      validateChallenge({
        ...validMultipleChoice,
        options: [
          { id: 'a', label: 'Same' },
          { id: 'b', label: 'Same' },
        ],
      }).ok,
    ).toBe(false);
    expect(
      validateChallenge({ ...validMultipleChoice, correctOptionId: 'missing' }).ok,
    ).toBe(false);
    expect(
      validateChallenge({ ...validMultipleChoice, options: [{ id: 'only-one', label: 'One' }] }).ok,
    ).toBe(false);
  });

  test('rejects malformed sequence orders', () => {
    expect(
      validateChallenge({ ...validSequence, correctOrder: ['one'] }).ok,
    ).toBe(false);
    expect(
      validateChallenge({ ...validSequence, correctOrder: ['one', 'one'] }).ok,
    ).toBe(false);
    expect(
      validateChallenge({ ...validSequence, correctOrder: ['one', 'missing'] }).ok,
    ).toBe(false);
    expect(
      validateChallenge({ ...validSequence, items: [{ id: 'one', label: 'One' }] }).ok,
    ).toBe(false);
  });

  test('rejects invalid scalar values', () => {
    expect(validateChallenge({ ...validTrueFalse, correctAnswer: 'true' }).ok).toBe(false);
    expect(validateChallenge({ ...validMultipleChoice, xp: 0 }).ok).toBe(false);
    expect(validateChallenge({ ...validMultipleChoice, xp: 1.5 }).ok).toBe(false);
    expect(validateChallenge({ ...validMultipleChoice, title: 'x'.repeat(121) }).ok).toBe(false);
    expect(validateChallenge({ ...validMultipleChoice, topic: 'unknown' }).ok).toBe(false);
    expect(validateChallenge({ ...validMultipleChoice, type: 'essay' }).ok).toBe(false);
  });

  test('parseChallenge throws a typed error for malformed content', () => {
    expect(() => parseChallenge({ ...validMultipleChoice, correctOptionId: 'missing' })).toThrow(
      ChallengeValidationError,
    );
    expect(parseChallenge(validMultipleChoice).id).toBe('validation-mc');
  });

  test('ships a JSON Schema that declares the three variants', () => {
    const document = schema as { oneOf?: unknown[]; $defs?: Record<string, unknown> };
    expect(document.oneOf).toHaveLength(3);
    expect(document.$defs?.multipleChoiceChallenge).toBeDefined();
    expect(document.$defs?.sequenceChallenge).toBeDefined();
    expect(document.$defs?.trueFalseChallenge).toBeDefined();
  });
});
