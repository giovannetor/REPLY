import type { ConceptId, ReasoningQuality } from './learning';

export type AdaptiveRouteKind =
  | 'advanced'
  | 'counterexample'
  | 'remedial'
  | 'clarification';

export interface AdaptiveChallengeRef {
  challengeId: string;
  conceptId: ConceptId;
  kind: 'advanced' | 'counterexample' | 'remedial';
}

export type AdaptiveChallengeBank = Partial<
  Record<ConceptId, readonly AdaptiveChallengeRef[]>
>;

export interface DirectorEvaluation {
  verdict: 'correct' | 'incorrect' | 'uncertain';
  reasoning: ReasoningQuality;
  confidence: number;
  clarificationQuestion?: string;
}

export interface ChallengeRoute {
  kind: 'advanced' | 'counterexample' | 'remedial';
  conceptId: ConceptId;
  challengeId: string;
  reason: string;
}

export interface ClarificationRoute {
  kind: 'clarification';
  conceptId: ConceptId;
  prompt: string;
  reason: string;
}

export type AdaptiveRoute = ChallengeRoute | ClarificationRoute;

export interface DecideRouteInput {
  conceptId: ConceptId;
  answerCorrect: boolean;
  evaluation: DirectorEvaluation;
  bank: AdaptiveChallengeBank;
  /** Set to false after a clarification attempt to avoid an endless loop. */
  allowClarification?: boolean;
}

const UNCERTAIN_CONFIDENCE = 0.55;

/**
 * Enforces the core adaptive rule: a route may only select a challenge that
 * belongs to the same concept that was just assessed.
 */
export function assertBankConsistency(bank: AdaptiveChallengeBank): void {
  for (const [conceptId, refs] of Object.entries(bank)) {
    for (const ref of refs ?? []) {
      if (ref.conceptId !== conceptId) {
        throw new Error(
          `Adaptive bank for ${conceptId} contains a ${ref.conceptId} challenge (${ref.challengeId}).`,
        );
      }
    }
  }
}

function selectChallenge(
  conceptId: ConceptId,
  candidates: readonly AdaptiveChallengeRef[],
  kind: 'advanced' | 'counterexample' | 'remedial',
  reason: string,
): ChallengeRoute {
  const match = candidates.find(
    (candidate) => candidate.kind === kind && candidate.conceptId === conceptId,
  );
  if (!match) {
    throw new Error(`No ${kind} challenge is available for concept ${conceptId}.`);
  }
  return {
    kind,
    conceptId,
    challengeId: match.challengeId,
    reason,
  };
}

export function decideRoute(input: DecideRouteInput): AdaptiveRoute {
  assertBankConsistency(input.bank);

  const candidates = input.bank[input.conceptId] ?? [];
  if (candidates.length === 0) {
    throw new Error(`No adaptive challenge bank exists for concept ${input.conceptId}.`);
  }

  // Option correctness is deterministic; uncertain reasoning cannot turn a
  // known wrong selection into a clarification or advanced challenge.
  if (!input.answerCorrect) {
    return selectChallenge(input.conceptId, candidates, 'remedial',
      'The answer was incorrect, so the director selects a remedial challenge on the same concept.');
  }

  const inconsistentVerdict =
    (input.evaluation.verdict === 'correct' && !input.answerCorrect) ||
    (input.evaluation.verdict === 'incorrect' && input.answerCorrect);
  const uncertain =
    input.evaluation.verdict === 'uncertain' ||
    input.evaluation.confidence < UNCERTAIN_CONFIDENCE ||
    inconsistentVerdict;

  if (uncertain) {
    if (input.allowClarification !== false) {
      return {
        kind: 'clarification',
        conceptId: input.conceptId,
        prompt:
          input.evaluation.clarificationQuestion ??
          `Clarify your reasoning for ${input.conceptId} in one or two sentences.`,
        reason:
          'The evaluator could not confidently separate sound reasoning from a lucky answer.',
      };
    }
    return selectChallenge(
      input.conceptId,
      candidates,
      'remedial',
      'The evaluation remained uncertain, so the director selects a remedial challenge on the same concept.',
    );
  }

  if (!input.answerCorrect || input.evaluation.verdict === 'incorrect') {
    return selectChallenge(
      input.conceptId,
      candidates,
      'remedial',
      'The answer was incorrect, so the director selects a remedial challenge on the same concept.',
    );
  }

  if (input.evaluation.reasoning === 'sound') {
    return selectChallenge(
      input.conceptId,
      candidates,
      'advanced',
      'The answer and reasoning are both sound, so the director selects an advanced challenge on the same concept.',
    );
  }

  return selectChallenge(
    input.conceptId,
    candidates,
    'counterexample',
    'The answer is correct but the reasoning is flawed or incomplete, so the director selects a counterexample on the same concept.',
  );
}

export function routeLabel(route: AdaptiveRoute): string {
  switch (route.kind) {
    case 'advanced':
      return 'Advanced challenge';
    case 'counterexample':
      return 'Counterexample challenge';
    case 'remedial':
      return 'Remedial challenge';
    case 'clarification':
      return 'Clarification needed';
  }
}

export function routeChallengeId(route: AdaptiveRoute): string | null {
  return route.kind === 'clarification' ? null : route.challengeId;
}
