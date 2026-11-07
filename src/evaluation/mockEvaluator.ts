import type {
  EvaluationProvider,
  EvaluationRequest,
  EvaluationRequestOptions,
  EvaluationResult,
} from './types';

const MIN_EXPLANATION_LENGTH = 20;

function normalize(text: string): string {
  return text.toLowerCase().replace(/\s+/g, ' ').trim();
}

function matchesAny(text: string, signals: readonly string[]): boolean {
  return signals.some((signal) => text.includes(signal.toLowerCase()));
}

function wait(ms: number, signal?: AbortSignal): Promise<void> {
  if (ms <= 0) {
    return signal?.aborted
      ? Promise.reject(new DOMException('The evaluation was aborted.', 'AbortError'))
      : Promise.resolve();
  }
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException('The evaluation was aborted.', 'AbortError'));
      return;
    }
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(timer);
      signal?.removeEventListener('abort', onAbort);
      reject(new DOMException('The evaluation was aborted.', 'AbortError'));
    };
    signal?.addEventListener('abort', onAbort, { once: true });
  });
}

/**
 * Deterministic, clearly-labelled mock evaluator. It checks the selected answer
 * against the correct option and looks for rubric keywords in the explanation.
 * It is a prototype fallback, not a real AI or a validated grading rubric.
 */
export function evaluateWithMock(request: EvaluationRequest): EvaluationResult {
  const explanation = normalize(request.explanation);
  const correct = request.selectedOptionId === request.correctOptionId;
  const criteria = request.rubric.criteria;

  const matched = criteria.filter((criterion) => {
    const hasSignal = matchesAny(explanation, criterion.signals);
    const hasAntiSignal =
      criterion.antiSignals !== undefined &&
      matchesAny(explanation, criterion.antiSignals);
    return hasSignal && !hasAntiSignal;
  });
  const matchedIds = matched.map((criterion) => criterion.id);
  const missingIds = criteria
    .filter((criterion) => !matchedIds.includes(criterion.id))
    .map((criterion) => criterion.id);

  if (explanation.length < MIN_EXPLANATION_LENGTH) {
    return {
      verdict: correct ? 'uncertain' : 'incorrect',
      reasoning: 'insufficient',
      confidence: 0.35,
      feedback: correct
        ? 'Mock rubric check: the selected answer is correct, but the explanation is too short to judge the reasoning. Please clarify the physical mechanism.'
        : 'Mock rubric check: the selected answer is incorrect and the explanation is too short to identify the reasoning. A remedial challenge will rebuild the concept.',
      matchedCriteria: matchedIds,
      missingCriteria: missingIds,
      ...(correct
        ? { clarificationQuestion: request.rubric.clarificationPrompt }
        : {}),
      evaluator: 'mock',
    };
  }

  const matchedWeight = matched.reduce((sum, criterion) => sum + criterion.weight, 0);
  const sound = matched.length >= 2 && matchedWeight >= request.rubric.passThreshold;
  if (sound) {
    return {
      verdict: correct ? 'correct' : 'incorrect',
      reasoning: 'sound',
      confidence: 0.82,
      feedback: correct
        ? 'Mock rubric check: the answer is correct and the explanation names the key mechanisms in the rubric.'
        : 'Mock rubric check: the reasoning matches the rubric, but the selected answer is wrong. A remedial challenge targets the same concept.',
      matchedCriteria: matchedIds,
      missingCriteria: missingIds,
      evaluator: 'mock',
    };
  }

  return {
    verdict: correct ? 'correct' : 'incorrect',
    reasoning: 'flawed',
    confidence: 0.62,
    feedback: correct
      ? 'Mock rubric check: the answer is correct, but the explanation misses or contradicts at least one key rubric idea. A counterexample will test the reasoning.'
      : 'Mock rubric check: the answer is incorrect and the explanation does not yet match the rubric. A remedial challenge targets the same concept.',
    matchedCriteria: matchedIds,
    missingCriteria: missingIds,
    evaluator: 'mock',
  };
}

export interface MockEvaluationProviderOptions {
  latencyMs?: number;
}

export class MockEvaluationProvider implements EvaluationProvider {
  readonly name = 'Mock rubric evaluator (not AI)';
  private readonly latencyMs: number;

  constructor(options: MockEvaluationProviderOptions = {}) {
    this.latencyMs = options.latencyMs ?? 0;
  }

  async evaluate(
    request: EvaluationRequest,
    options: EvaluationRequestOptions = {},
  ): Promise<EvaluationResult> {
    await wait(this.latencyMs, options.signal);
    return evaluateWithMock(request);
  }
}
