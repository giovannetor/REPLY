import { type Challenge, formatCorrectAnswer } from './challenge';

export const CHALLENGE_PHASES = [
  'idle',
  'loading',
  'ready',
  'feedback',
  'completed',
  'error',
] as const;

export type ChallengePhase = (typeof CHALLENGE_PHASES)[number];
export type AnswerResult = 'correct' | 'incorrect';

export interface ChallengeState {
  phase: ChallengePhase;
  challenge: Challenge | null;
  selectedOptionId: string | null;
  sequenceSelection: string[];
  attempts: number;
  result: AnswerResult | null;
  error: string | null;
}

export function initialChallengeState(): ChallengeState {
  return {
    phase: 'idle',
    challenge: null,
    selectedOptionId: null,
    sequenceSelection: [],
    attempts: 0,
    result: null,
    error: null,
  };
}

export function startLoading(state: ChallengeState): ChallengeState {
  if (state.phase !== 'idle' && state.phase !== 'error') {
    return state;
  }
  return {
    ...initialChallengeState(),
    phase: 'loading',
  };
}

export function loadSucceeded(state: ChallengeState, challenge: Challenge): ChallengeState {
  if (state.phase !== 'loading') {
    return state;
  }
  return {
    ...initialChallengeState(),
    phase: 'ready',
    challenge,
  };
}

export function loadFailed(state: ChallengeState, message: string): ChallengeState {
  if (state.phase !== 'loading') {
    return state;
  }
  return {
    ...state,
    phase: 'error',
    challenge: null,
    error: message,
  };
}

export function selectOption(state: ChallengeState, optionId: string): ChallengeState {
  if (state.phase !== 'ready' || !state.challenge) {
    return state;
  }
  const challenge = state.challenge;
  const isValid =
    challenge.type === 'multiple-choice'
      ? challenge.options.some((option) => option.id === optionId)
      : challenge.type === 'true-false'
        ? optionId === 'true' || optionId === 'false'
        : false;
  if (!isValid) {
    return state;
  }
  return {
    ...state,
    selectedOptionId: optionId,
  };
}

export function toggleSequenceItem(state: ChallengeState, itemId: string): ChallengeState {
  const challenge = state.challenge;
  if (state.phase !== 'ready' || !challenge || challenge.type !== 'sequence') {
    return state;
  }
  if (!challenge.items.some((item) => item.id === itemId)) {
    return state;
  }
  if (state.sequenceSelection.includes(itemId)) {
    return state;
  }
  return {
    ...state,
    sequenceSelection: [...state.sequenceSelection, itemId],
  };
}

export function resetSequence(state: ChallengeState): ChallengeState {
  const challenge = state.challenge;
  if (state.phase !== 'ready' || !challenge || challenge.type !== 'sequence') {
    return state;
  }
  return {
    ...state,
    sequenceSelection: [],
  };
}

export function isAnswerReady(state: ChallengeState): boolean {
  if (state.phase !== 'ready' || !state.challenge) {
    return false;
  }
  if (state.challenge.type === 'sequence') {
    return state.sequenceSelection.length === state.challenge.items.length;
  }
  return state.selectedOptionId !== null;
}

function evaluateAnswer(state: ChallengeState): AnswerResult {
  const challenge = state.challenge;
  if (!challenge) {
    return 'incorrect';
  }
  if (challenge.type === 'multiple-choice') {
    return state.selectedOptionId === challenge.correctOptionId ? 'correct' : 'incorrect';
  }
  if (challenge.type === 'true-false') {
    const pickedTrue = state.selectedOptionId === 'true';
    return pickedTrue === challenge.correctAnswer ? 'correct' : 'incorrect';
  }
  return state.sequenceSelection.length === challenge.correctOrder.length &&
    state.sequenceSelection.every((id, index) => id === challenge.correctOrder[index])
    ? 'correct'
    : 'incorrect';
}

export function submitAnswer(state: ChallengeState): ChallengeState {
  if (!isAnswerReady(state)) {
    return state;
  }
  return {
    ...state,
    phase: 'feedback',
    attempts: state.attempts + 1,
    result: evaluateAnswer(state),
    error: null,
  };
}

export function retryAnswer(state: ChallengeState): ChallengeState {
  if (state.phase !== 'feedback' || state.result !== 'incorrect') {
    return state;
  }
  return {
    ...state,
    phase: 'ready',
    selectedOptionId: null,
    sequenceSelection: [],
    result: null,
  };
}

export function completeChallenge(state: ChallengeState): ChallengeState {
  if (state.phase !== 'feedback' || state.result !== 'correct') {
    return state;
  }
  return {
    ...state,
    phase: 'completed',
  };
}

export function correctAnswerText(state: ChallengeState): string {
  if (!state.challenge) {
    return '';
  }
  return formatCorrectAnswer(state.challenge);
}
