import { describe, expect, test } from 'vitest';
import { parseChallenge } from '../src/domain/challenge';
import {
  completeChallenge,
  initialChallengeState,
  isAnswerReady,
  loadFailed,
  loadSucceeded,
  resetSequence,
  retryAnswer,
  selectOption,
  startLoading,
  submitAnswer,
  toggleSequenceItem,
  type ChallengeState,
} from '../src/domain/challengeState';

const mcChallenge = parseChallenge({
  id: 'test-mc',
  type: 'multiple-choice',
  topic: 'logic',
  title: 'Multiple choice',
  prompt: 'Pick B.',
  explanation: 'B is correct.',
  xp: 10,
  options: [
    { id: 'a', label: 'A' },
    { id: 'b', label: 'B' },
  ],
  correctOptionId: 'b',
});

const tfChallenge = parseChallenge({
  id: 'test-tf',
  type: 'true-false',
  topic: 'truth',
  title: 'True or false',
  prompt: 'This statement is false.',
  explanation: 'False is correct.',
  xp: 10,
  correctAnswer: false,
});

const sequenceChallenge = parseChallenge({
  id: 'test-sequence',
  type: 'sequence',
  topic: 'order',
  title: 'Order the steps',
  prompt: 'Put these in order.',
  explanation: 'First, second, third.',
  xp: 10,
  items: [
    { id: 'first', label: 'First' },
    { id: 'second', label: 'Second' },
    { id: 'third', label: 'Third' },
  ],
  correctOrder: ['first', 'second', 'third'],
});

function readyState(challenge: typeof mcChallenge): ChallengeState {
  return loadSucceeded(startLoading(initialChallengeState()), challenge);
}

describe('challenge state machine', () => {
  test('starts idle and moves through loading to ready', () => {
    const idle = initialChallengeState();
    expect(idle.phase).toBe('idle');

    const loading = startLoading(idle);
    expect(loading.phase).toBe('loading');

    const ready = loadSucceeded(loading, mcChallenge);
    expect(ready.phase).toBe('ready');
    expect(ready.challenge?.id).toBe('test-mc');
    expect(ready.attempts).toBe(0);
  });

  test('records a load error and retries from error', () => {
    const loading = startLoading(initialChallengeState());
    const failed = loadFailed(loading, 'Archive offline');
    expect(failed.phase).toBe('error');
    expect(failed.error).toBe('Archive offline');

    const retrying = startLoading(failed);
    expect(retrying.phase).toBe('loading');
    expect(retrying.error).toBeNull();
  });

  test('ignores invalid transitions instead of corrupting state', () => {
    const idle = initialChallengeState();
    expect(loadSucceeded(idle, mcChallenge)).toBe(idle);
    expect(selectOption(idle, 'a')).toBe(idle);

    const loading = startLoading(idle);
    expect(selectOption(loading, 'a')).toBe(loading);
    expect(submitAnswer(loading)).toBe(loading);

    const ready = readyState(mcChallenge);
    expect(submitAnswer(ready)).toBe(ready);
    expect(retryAnswer(ready)).toBe(ready);
    expect(completeChallenge(ready)).toBe(ready);
  });

  test('submits a correct multiple-choice answer once', () => {
    let state = readyState(mcChallenge);
    state = selectOption(state, 'b');
    expect(state.selectedOptionId).toBe('b');
    expect(isAnswerReady(state)).toBe(true);

    state = submitAnswer(state);
    expect(state.phase).toBe('feedback');
    expect(state.result).toBe('correct');
    expect(state.attempts).toBe(1);

    state = completeChallenge(state);
    expect(state.phase).toBe('completed');
  });

  test('rejects an unknown option id and a second completion', () => {
    let state = readyState(mcChallenge);
    state = selectOption(state, 'not-an-option');
    expect(state.selectedOptionId).toBeNull();

    state = selectOption(state, 'b');
    state = submitAnswer(state);
    state = completeChallenge(state);
    expect(completeChallenge(state)).toBe(state);
  });

  test('allows a wrong answer to be retried with attempts preserved', () => {
    let state = readyState(mcChallenge);
    state = selectOption(state, 'a');
    state = submitAnswer(state);
    expect(state.phase).toBe('feedback');
    expect(state.result).toBe('incorrect');
    expect(state.attempts).toBe(1);

    state = retryAnswer(state);
    expect(state.phase).toBe('ready');
    expect(state.selectedOptionId).toBeNull();
    expect(state.attempts).toBe(1);

    state = selectOption(state, 'b');
    state = submitAnswer(state);
    expect(state.result).toBe('correct');
    expect(state.attempts).toBe(2);
  });

  test('evaluates true/false selections', () => {
    let state = readyState(tfChallenge);
    state = selectOption(state, 'true');
    state = submitAnswer(state);
    expect(state.result).toBe('incorrect');

    state = retryAnswer(state);
    state = selectOption(state, 'false');
    state = submitAnswer(state);
    expect(state.result).toBe('correct');
  });

  test('builds a sequence selection without duplicates', () => {
    let state = readyState(sequenceChallenge);
    state = toggleSequenceItem(state, 'second');
    state = toggleSequenceItem(state, 'first');
    state = toggleSequenceItem(state, 'second');
    state = toggleSequenceItem(state, 'missing');
    expect(state.sequenceSelection).toEqual(['second', 'first']);
    expect(isAnswerReady(state)).toBe(false);

    state = toggleSequenceItem(state, 'third');
    expect(isAnswerReady(state)).toBe(true);

    state = resetSequence(state);
    expect(state.sequenceSelection).toEqual([]);
    expect(isAnswerReady(state)).toBe(false);
  });

  test('evaluates sequence order and retries after a wrong order', () => {
    let state = readyState(sequenceChallenge);
    state = toggleSequenceItem(state, 'second');
    state = toggleSequenceItem(state, 'first');
    state = toggleSequenceItem(state, 'third');
    state = submitAnswer(state);
    expect(state.result).toBe('incorrect');
    expect(state.attempts).toBe(1);

    state = retryAnswer(state);
    state = toggleSequenceItem(state, 'first');
    state = toggleSequenceItem(state, 'second');
    state = toggleSequenceItem(state, 'third');
    state = submitAnswer(state);
    expect(state.result).toBe('correct');
    expect(state.attempts).toBe(2);
  });
});
