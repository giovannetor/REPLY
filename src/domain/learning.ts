/**
 * Learning-domain models for the Motori per Aeromobili slice.
 *
 * The source framework is a one-page summary. Questions, answers and rubrics
 * authored for this prototype are provisional and unverified; the models carry
 * explicit source references so the UI can report missing evidence.
 */

export const CONCEPT_IDS = ['C1', 'C2', 'C3', 'C4', 'C5'] as const;
export type ConceptId = (typeof CONCEPT_IDS)[number];

export type SourceKind =
  | 'framework-summary'
  | 'lecture-slide'
  | 'textbook'
  | 'other';

export interface SourceReference {
  id: string;
  kind: SourceKind;
  title: string;
  locator: string;
  verified: boolean;
  note?: string;
}

export interface Concept {
  id: ConceptId;
  title: string;
  shortTitle: string;
  summary: string;
  focus: string;
  sourceRefs: SourceReference[];
  assessedInThisSlice: boolean;
}

export interface Course {
  id: string;
  name: string;
  code: string;
  institution: string;
  description: string;
  concepts: Concept[];
}

export interface DiagnosticOption {
  id: string;
  label: string;
}

export interface DiagnosticQuestion {
  id: string;
  conceptId: ConceptId;
  order: number;
  prompt: string;
  options: DiagnosticOption[];
  correctOptionId: string;
  explanationPrompt: string;
  explanationHint?: string;
  rubricId: string;
  sourceRefs: SourceReference[];
  answerSourceRefs: SourceReference[];
}

export type ReasoningQuality = 'sound' | 'flawed' | 'insufficient';
export type SkillStatus = 'unknown' | 'provisional' | 'demonstrated';
export type SkillEvidenceSource =
  | 'diagnostic'
  | 'adaptive'
  | 'concept-check'
  | 'boss';

export interface EvaluationCriterion {
  id: string;
  label: string;
  description: string;
  weight: number;
  /** Keywords used only by the clearly-labelled mock evaluator. */
  signals: string[];
  /** Phrases that indicate a flawed explanation in the mock evaluator. */
  antiSignals?: string[];
}

export interface EvaluationRubric {
  id: string;
  conceptId: ConceptId;
  title: string;
  criteria: EvaluationCriterion[];
  passThreshold: number;
  provisional: boolean;
  clarificationPrompt: string;
}

export interface SkillEvidence {
  sequence: number;
  source: SkillEvidenceSource;
  label: string;
  answerCorrect: boolean;
  reasoning: ReasoningQuality | 'not-assessed';
  confidence: number;
  attempts: number;
  score: number;
}

export interface StudentSkillState {
  conceptId: ConceptId;
  mastery: number;
  evidenceCount: number;
  correctCount: number;
  reasoningCounts: Record<ReasoningQuality | 'not-assessed', number>;
  status: SkillStatus;
  history: SkillEvidence[];
}

export type BossPhase = 1 | 2 | 3;

export interface BossRound {
  id: string;
  phase: BossPhase;
  conceptId: ConceptId;
  challengeId: string;
  title: string;
  difficulty: 1 | 2 | 3;
  focus: string;
  sourceRefs: SourceReference[];
}

export type ChallengeKind =
  | 'diagnostic'
  | 'remedial'
  | 'advanced'
  | 'counterexample'
  | 'concept-check'
  | 'boss';

/**
 * Metadata that connects a provider-supplied Challenge to the learning layer.
 * The challenge content itself stays in the existing validated Challenge model.
 */
export interface LearningChallenge {
  challengeId: string;
  conceptId: ConceptId;
  kind: ChallengeKind;
  rubricId: string;
  learningObjective: string;
  requiresExplanation: boolean;
  sourceRefs: SourceReference[];
  answerSourceRefs: SourceReference[];
}
