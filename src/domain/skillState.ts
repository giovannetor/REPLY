import {
  CONCEPT_IDS,
  type Concept,
  type ConceptId,
  type ReasoningQuality,
  type SkillEvidence,
  type SkillStatus,
  type StudentSkillState,
} from './learning';

export interface SkillEvidenceInput {
  source: SkillEvidence['source'];
  label: string;
  answerCorrect: boolean;
  reasoning: ReasoningQuality | 'not-assessed';
  confidence: number;
  attempts: number;
}

const REASONING_SCORE: Record<ReasoningQuality | 'not-assessed', number> = {
  sound: 0.35,
  flawed: 0.12,
  insufficient: 0.04,
  'not-assessed': 0.12,
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function createEmptySkillState(conceptId: ConceptId): StudentSkillState {
  return {
    conceptId,
    mastery: 0,
    evidenceCount: 0,
    correctCount: 0,
    reasoningCounts: {
      sound: 0,
      flawed: 0,
      insufficient: 0,
      'not-assessed': 0,
    },
    status: 'unknown',
    history: [],
  };
}

export function createSkillStates(
  concepts: readonly Concept[],
): Record<ConceptId, StudentSkillState> {
  const states = {} as Record<ConceptId, StudentSkillState>;
  for (const conceptId of CONCEPT_IDS) {
    states[conceptId] = createEmptySkillState(conceptId);
  }
  for (const concept of concepts) {
    states[concept.id] = createEmptySkillState(concept.id);
  }
  return states;
}

export function scoreSkillEvidence(input: SkillEvidenceInput): number {
  const answerScore = input.answerCorrect ? (input.attempts <= 1 ? 0.45 : 0.28) : 0;
  const reasoningScore = REASONING_SCORE[input.reasoning];
  const confidence = clamp(input.confidence, 0, 1);
  const confidenceFactor = 0.5 + 0.5 * confidence;
  return clamp((answerScore + reasoningScore) * confidenceFactor, 0, 1);
}

/**
 * Applies one piece of evidence to a concept. Mastery is a running average of
 * evidence scores, so a single lucky answer cannot masquerade as mastery.
 * All mastery in this slice remains explicitly provisional in the UI.
 */
export function applySkillEvidence(
  state: StudentSkillState,
  input: SkillEvidenceInput,
): StudentSkillState {
  const score = scoreSkillEvidence(input);
  const evidence: SkillEvidence = {
    sequence: state.history.length + 1,
    source: input.source,
    label: input.label,
    answerCorrect: input.answerCorrect,
    reasoning: input.reasoning,
    confidence: clamp(input.confidence, 0, 1),
    attempts: Math.max(1, Math.floor(input.attempts)),
    score,
  };

  const evidenceCount = state.evidenceCount + 1;
  const mastery = (state.mastery * state.evidenceCount + score) / evidenceCount;
  const reasoningCounts = {
    ...state.reasoningCounts,
    [input.reasoning]: state.reasoningCounts[input.reasoning] + 1,
  };
  const correctCount = state.correctCount + (input.answerCorrect ? 1 : 0);
  const status: SkillStatus =
    mastery >= 0.6 && evidenceCount >= 2 && reasoningCounts.sound >= 1
      ? 'demonstrated'
      : 'provisional';

  return {
    ...state,
    mastery,
    evidenceCount,
    correctCount,
    reasoningCounts,
    status,
    history: [...state.history, evidence],
  };
}

export function formatMastery(state: StudentSkillState): string {
  return `${Math.round(state.mastery * 100)}%`;
}

export function skillStatusLabel(state: StudentSkillState): string {
  if (state.status === 'unknown') {
    return 'Not assessed';
  }
  if (state.status === 'demonstrated') {
    return 'Demonstrated · provisional';
  }
  return 'Provisional';
}
