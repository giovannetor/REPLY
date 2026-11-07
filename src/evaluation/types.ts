import type {
  ConceptId,
  EvaluationRubric,
  ReasoningQuality,
} from '../domain/learning';

export const EVALUATION_VERDICTS = ['correct', 'incorrect', 'uncertain'] as const;
export type EvaluationVerdict = (typeof EVALUATION_VERDICTS)[number];

export interface EvaluationOption {
  id: string;
  label: string;
}

export interface EvaluationRequest {
  questionId: string;
  conceptId: ConceptId;
  prompt: string;
  options: EvaluationOption[];
  correctOptionId: string;
  selectedOptionId: string;
  explanation: string;
  rubric: EvaluationRubric;
}

export interface AiEvaluationPayload {
  verdict: EvaluationVerdict;
  reasoning: ReasoningQuality;
  confidence: number;
  feedback: string;
  matchedCriteria: string[];
  missingCriteria: string[];
  clarificationQuestion?: string;
}

export type EvaluatorKind = 'ai' | 'mock' | 'mock-fallback';

export interface EvaluationResult extends AiEvaluationPayload {
  evaluator: EvaluatorKind;
  fallbackReason?: string;
}

export interface EvaluationRequestOptions {
  signal?: AbortSignal;
}

export interface EvaluationProvider {
  readonly name: string;
  evaluate(
    request: EvaluationRequest,
    options?: EvaluationRequestOptions,
  ): Promise<EvaluationResult>;
}

export class EvaluationProviderError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = 'EvaluationProviderError';
  }
}

export function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === 'AbortError';
}

export function evaluatorLabel(kind: EvaluatorKind): string {
  switch (kind) {
    case 'ai':
      return 'AI evaluator';
    case 'mock':
      return 'Mock evaluator (not AI)';
    case 'mock-fallback':
      return 'Mock fallback (AI unavailable)';
  }
}
