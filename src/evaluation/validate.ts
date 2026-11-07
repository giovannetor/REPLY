import {
  CONCEPT_IDS,
  type ConceptId,
  type EvaluationCriterion,
  type EvaluationRubric,
  type ReasoningQuality,
} from '../domain/learning';
import {
  EVALUATION_VERDICTS,
  type AiEvaluationPayload,
  type EvaluationRequest,
  type EvaluationResult,
  type EvaluatorKind,
  type EvaluationVerdict,
} from './types';

export type ValidationResult<T> =
  | { ok: true; value: T }
  | { ok: false; errors: string[] };

const ID_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,63}$/;
const REASONING_VALUES: readonly ReasoningQuality[] = [
  'sound',
  'flawed',
  'insufficient',
];
const EVALUATOR_VALUES: readonly EvaluatorKind[] = ['ai', 'mock', 'mock-fallback'];
const MAX_FEEDBACK = 1_200;
const MAX_QUESTION = 2_000;
const MAX_EXPLANATION = 4_000;
const MAX_LABEL = 500;
const MAX_OPTIONS = 6;
const MAX_CRITERIA = 8;
const MAX_SIGNALS = 10;
const MAX_SIGNAL_LENGTH = 80;
const MAX_CLARIFICATION = 500;
const MAX_FALLBACK_REASON = 500;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isOneOf<T extends string>(value: unknown, values: readonly T[]): value is T {
  return typeof value === 'string' && (values as readonly string[]).includes(value);
}

function rejectUnknownKeys(
  record: Record<string, unknown>,
  allowed: readonly string[],
  path: string,
  errors: string[],
): void {
  for (const key of Object.keys(record)) {
    if (!allowed.includes(key)) {
      errors.push(`${path}.${key} is not allowed`);
    }
  }
}

function readString(
  record: Record<string, unknown>,
  key: string,
  path: string,
  errors: string[],
  options: { required?: boolean; max: number; pattern?: RegExp },
): string | undefined {
  const value = record[key];
  if (value === undefined) {
    if (options.required !== false) {
      errors.push(`${path}.${key} is required`);
    }
    return undefined;
  }
  if (typeof value !== 'string') {
    errors.push(`${path}.${key} must be a string`);
    return undefined;
  }
  if (value.trim().length === 0) {
    errors.push(`${path}.${key} must not be empty`);
    return undefined;
  }
  if (value.length > options.max) {
    errors.push(`${path}.${key} must be at most ${options.max} characters`);
    return undefined;
  }
  if (options.pattern && !options.pattern.test(value)) {
    errors.push(`${path}.${key} must match ${options.pattern}`);
    return undefined;
  }
  return value;
}

function readId(
  record: Record<string, unknown>,
  key: string,
  path: string,
  errors: string[],
): string | undefined {
  return readString(record, key, path, errors, {
    max: 64,
    pattern: ID_PATTERN,
  });
}

function readNumber(
  record: Record<string, unknown>,
  key: string,
  path: string,
  errors: string[],
  min: number,
  max: number,
): number | undefined {
  const value = record[key];
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    errors.push(`${path}.${key} must be a finite number`);
    return undefined;
  }
  if (value < min || value > max) {
    errors.push(`${path}.${key} must be between ${min} and ${max}`);
    return undefined;
  }
  return value;
}

function readBoolean(
  record: Record<string, unknown>,
  key: string,
  path: string,
  errors: string[],
): boolean | undefined {
  const value = record[key];
  if (typeof value !== 'boolean') {
    errors.push(`${path}.${key} must be a boolean`);
    return undefined;
  }
  return value;
}

function readStringArray(
  value: unknown,
  path: string,
  errors: string[],
  options: { required?: boolean; min: number; max: number; maxLength: number },
): string[] | undefined {
  if (value === undefined) {
    if (options.required !== false) {
      errors.push(`${path} is required`);
    }
    return undefined;
  }
  if (!Array.isArray(value)) {
    errors.push(`${path} must be an array`);
    return undefined;
  }
  if (value.length < options.min || value.length > options.max) {
    errors.push(`${path} must contain between ${options.min} and ${options.max} entries`);
    return undefined;
  }

  const entries: string[] = [];
  const seen = new Set<string>();
  value.forEach((entry, index) => {
    if (typeof entry !== 'string' || entry.trim().length === 0) {
      errors.push(`${path}[${index}] must be a non-empty string`);
      return;
    }
    if (entry.length > options.maxLength) {
      errors.push(`${path}[${index}] must be at most ${options.maxLength} characters`);
      return;
    }
    const normalized = entry.toLowerCase();
    if (seen.has(normalized)) {
      errors.push(`${path}[${index}] is duplicated`);
      return;
    }
    seen.add(normalized);
    entries.push(entry);
  });
  return entries;
}

function validateRubric(
  input: unknown,
  expectedConceptId: ConceptId,
  errors: string[],
): EvaluationRubric | undefined {
  if (!isRecord(input)) {
    errors.push('rubric must be an object');
    return undefined;
  }
  rejectUnknownKeys(
    input,
    [
      'id',
      'conceptId',
      'title',
      'criteria',
      'passThreshold',
      'provisional',
      'clarificationPrompt',
      'scoringGuide',
      'misconception',
    ],
    'rubric',
    errors,
  );

  const id = readId(input, 'id', 'rubric', errors);
  const conceptId = input.conceptId;
  if (!isOneOf(conceptId, CONCEPT_IDS)) {
    errors.push(`rubric.conceptId must be one of: ${CONCEPT_IDS.join(', ')}`);
  } else if (conceptId !== expectedConceptId) {
    errors.push('rubric.conceptId must match the request conceptId');
  }
  const title = readString(input, 'title', 'rubric', errors, { max: 120 });
  const passThreshold = readNumber(input, 'passThreshold', 'rubric', errors, 0, 1);
  const provisional = readBoolean(input, 'provisional', 'rubric', errors);
  const clarificationPrompt = readString(input, 'clarificationPrompt', 'rubric', errors, {
    max: MAX_CLARIFICATION,
  });
  const misconception = readString(input, 'misconception', 'rubric', errors, {
    required: false, max: 1_000,
  });
  let scoringGuide: EvaluationRubric['scoringGuide'];
  if (input.scoringGuide !== undefined) {
    if (!isRecord(input.scoringGuide)) {
      errors.push('rubric.scoringGuide must be an object');
    } else {
      rejectUnknownKeys(input.scoringGuide, ['0', '1', '2'], 'rubric.scoringGuide', errors);
      const zero = readString(input.scoringGuide, '0', 'rubric.scoringGuide', errors, { max: 1_000 });
      const one = readString(input.scoringGuide, '1', 'rubric.scoringGuide', errors, { max: 1_000 });
      const two = readString(input.scoringGuide, '2', 'rubric.scoringGuide', errors, { max: 1_000 });
      if (zero && one && two) scoringGuide = { '0': zero, '1': one, '2': two };
    }
  }

  const rawCriteria = input.criteria;
  const criteria: EvaluationCriterion[] = [];
  if (!Array.isArray(rawCriteria)) {
    errors.push('rubric.criteria must be an array');
  } else if (rawCriteria.length < 1 || rawCriteria.length > MAX_CRITERIA) {
    errors.push(`rubric.criteria must contain between 1 and ${MAX_CRITERIA} entries`);
  } else {
    const seenIds = new Set<string>();
    rawCriteria.forEach((entry, index) => {
      const entryPath = `rubric.criteria[${index}]`;
      if (!isRecord(entry)) {
        errors.push(`${entryPath} must be an object`);
        return;
      }
      rejectUnknownKeys(
        entry,
        ['id', 'label', 'description', 'weight', 'signals', 'antiSignals'],
        entryPath,
        errors,
      );
      const criterionId = readId(entry, 'id', entryPath, errors);
      const label = readString(entry, 'label', entryPath, errors, { max: MAX_LABEL });
      const description = readString(entry, 'description', entryPath, errors, {
        max: MAX_LABEL,
      });
      const weight = readNumber(entry, 'weight', entryPath, errors, 0, 1);
      const signals = readStringArray(entry.signals, `${entryPath}.signals`, errors, {
        min: 1,
        max: MAX_SIGNALS,
        maxLength: MAX_SIGNAL_LENGTH,
      });
      const antiSignals = readStringArray(
        entry.antiSignals,
        `${entryPath}.antiSignals`,
        errors,
        {
          required: false,
          min: 0,
          max: MAX_SIGNALS,
          maxLength: MAX_SIGNAL_LENGTH,
        },
      );
      if (!criterionId || !label || !description || weight === undefined || !signals) {
        return;
      }
      if (seenIds.has(criterionId)) {
        errors.push(`${entryPath}.id "${criterionId}" is duplicated`);
        return;
      }
      seenIds.add(criterionId);
      const criterion: EvaluationCriterion = {
        id: criterionId,
        label,
        description,
        weight,
        signals,
      };
      if (antiSignals !== undefined) {
        criterion.antiSignals = antiSignals;
      }
      criteria.push(criterion);
    });
  }

  if (
    !id ||
    !isOneOf(conceptId, CONCEPT_IDS) ||
    !title ||
    passThreshold === undefined ||
    provisional === undefined ||
    !clarificationPrompt ||
    criteria.length === 0
  ) {
    return undefined;
  }

  return {
    id,
    conceptId,
    title,
    criteria,
    passThreshold,
    provisional,
    clarificationPrompt,
    ...(scoringGuide ? { scoringGuide } : {}),
    ...(misconception ? { misconception } : {}),
  };
}

function validateCriteriaIds(
  value: unknown,
  key: 'matchedCriteria' | 'missingCriteria',
  rubric: EvaluationRubric,
  errors: string[],
): string[] | undefined {
  const ids = readStringArray(value, `evaluation.${key}`, errors, {
    min: 0,
    max: rubric.criteria.length,
    maxLength: 64,
  });
  if (!ids) {
    return undefined;
  }
  const known = new Set(rubric.criteria.map((criterion) => criterion.id));
  ids.forEach((id, index) => {
    if (!known.has(id)) {
      errors.push(`evaluation.${key}[${index}] references an unknown rubric criterion`);
    }
  });
  return ids;
}

/**
 * Validates the untrusted JSON an AI evaluator returns. It rebuilds a clean
 * object containing only known fields. Nothing in the payload is executed.
 */
export function validateAiEvaluationPayload(
  input: unknown,
  rubric: EvaluationRubric,
): ValidationResult<AiEvaluationPayload> {
  if (!isRecord(input)) {
    return { ok: false, errors: ['evaluation must be an object'] };
  }

  const errors: string[] = [];
  rejectUnknownKeys(
    input,
    [
      'verdict',
      'reasoning',
      'confidence',
      'feedback',
      'matchedCriteria',
      'missingCriteria',
      'clarificationQuestion',
    ],
    'evaluation',
    errors,
  );

  const verdict = input.verdict;
  if (!isOneOf(verdict, EVALUATION_VERDICTS)) {
    errors.push(`evaluation.verdict must be one of: ${EVALUATION_VERDICTS.join(', ')}`);
  }
  const reasoning = input.reasoning;
  if (!isOneOf(reasoning, REASONING_VALUES)) {
    errors.push(`evaluation.reasoning must be one of: ${REASONING_VALUES.join(', ')}`);
  }
  const confidence = readNumber(input, 'confidence', 'evaluation', errors, 0, 1);
  const feedback = readString(input, 'feedback', 'evaluation', errors, {
    max: MAX_FEEDBACK,
  });
  const matchedCriteria = validateCriteriaIds(
    input.matchedCriteria,
    'matchedCriteria',
    rubric,
    errors,
  );
  const missingCriteria = validateCriteriaIds(
    input.missingCriteria,
    'missingCriteria',
    rubric,
    errors,
  );
  const clarificationQuestion = readString(
    input,
    'clarificationQuestion',
    'evaluation',
    errors,
    { required: false, max: MAX_CLARIFICATION },
  );

  if (matchedCriteria && missingCriteria) {
    const overlap = matchedCriteria.filter((id) => missingCriteria.includes(id));
    if (overlap.length > 0) {
      errors.push(
        `evaluation.matchedCriteria and evaluation.missingCriteria overlap: ${overlap.join(', ')}`,
      );
    }
  }
  if (verdict === 'uncertain' && !clarificationQuestion) {
    errors.push('evaluation.clarificationQuestion is required when verdict is uncertain');
  }

  if (
    errors.length > 0 ||
    !isOneOf(verdict, EVALUATION_VERDICTS) ||
    !isOneOf(reasoning, REASONING_VALUES) ||
    confidence === undefined ||
    !feedback ||
    !matchedCriteria ||
    !missingCriteria
  ) {
    return { ok: false, errors };
  }

  const payload: AiEvaluationPayload = {
    verdict: verdict as EvaluationVerdict,
    reasoning,
    confidence,
    feedback,
    matchedCriteria,
    missingCriteria,
  };
  if (clarificationQuestion !== undefined) {
    payload.clarificationQuestion = clarificationQuestion;
  }
  return { ok: true, value: payload };
}

/**
 * Validates a complete evaluator response, including the evaluator label the
 * server or fallback wrapper adds.
 */
export function validateEvaluationResult(
  input: unknown,
  rubric: EvaluationRubric,
): ValidationResult<EvaluationResult> {
  if (!isRecord(input)) {
    return { ok: false, errors: ['evaluation result must be an object'] };
  }

  const errors: string[] = [];
  const evaluator = input.evaluator;
  if (!isOneOf(evaluator, EVALUATOR_VALUES)) {
    errors.push(`evaluation.evaluator must be one of: ${EVALUATOR_VALUES.join(', ')}`);
  }
  const fallbackReason = readString(input, 'fallbackReason', 'evaluation', errors, {
    required: false,
    max: MAX_FALLBACK_REASON,
  });
  if (evaluator === 'mock-fallback' && !fallbackReason) {
    errors.push('evaluation.fallbackReason is required for a mock fallback');
  }

  const payloadInput: Record<string, unknown> = { ...input };
  delete payloadInput.evaluator;
  delete payloadInput.fallbackReason;
  const payload = validateAiEvaluationPayload(payloadInput, rubric);
  if (!payload.ok) {
    return { ok: false, errors: [...errors, ...payload.errors] };
  }
  if (errors.length > 0 || !isOneOf(evaluator, EVALUATOR_VALUES)) {
    return { ok: false, errors };
  }

  const result: EvaluationResult = {
    ...payload.value,
    evaluator,
  };
  if (fallbackReason !== undefined) {
    result.fallbackReason = fallbackReason;
  }
  return { ok: true, value: result };
}

/**
 * Validates an evaluation request on the server. The request is rebuilt from
 * known fields before it is placed into an AI prompt.
 */
export function validateEvaluationRequest(
  input: unknown,
): ValidationResult<EvaluationRequest> {
  if (!isRecord(input)) {
    return { ok: false, errors: ['request must be an object'] };
  }

  const errors: string[] = [];
  rejectUnknownKeys(
    input,
    [
      'questionId',
      'conceptId',
      'prompt',
      'options',
      'correctOptionId',
      'selectedOptionId',
      'explanation',
      'rubric',
    ],
    'request',
    errors,
  );

  const questionId = readId(input, 'questionId', 'request', errors);
  const conceptId = input.conceptId;
  if (!isOneOf(conceptId, CONCEPT_IDS)) {
    errors.push(`request.conceptId must be one of: ${CONCEPT_IDS.join(', ')}`);
  }
  const prompt = readString(input, 'prompt', 'request', errors, { max: MAX_QUESTION });
  const selectedOptionId = readId(input, 'selectedOptionId', 'request', errors);
  const correctOptionId = readId(input, 'correctOptionId', 'request', errors);
  const explanation = readString(input, 'explanation', 'request', errors, {
    max: MAX_EXPLANATION,
  });

  const rawOptions = input.options;
  const options: Array<{ id: string; label: string }> = [];
  if (!Array.isArray(rawOptions)) {
    errors.push('request.options must be an array');
  } else if (rawOptions.length < 2 || rawOptions.length > MAX_OPTIONS) {
    errors.push(`request.options must contain between 2 and ${MAX_OPTIONS} entries`);
  } else {
    const seenIds = new Set<string>();
    const seenLabels = new Set<string>();
    rawOptions.forEach((entry, index) => {
      const entryPath = `request.options[${index}]`;
      if (!isRecord(entry)) {
        errors.push(`${entryPath} must be an object`);
        return;
      }
      rejectUnknownKeys(entry, ['id', 'label'], entryPath, errors);
      const id = readId(entry, 'id', entryPath, errors);
      const label = readString(entry, 'label', entryPath, errors, { max: MAX_LABEL });
      if (!id || !label) {
        return;
      }
      if (seenIds.has(id) || seenLabels.has(label)) {
        errors.push(`${entryPath} is duplicated`);
        return;
      }
      seenIds.add(id);
      seenLabels.add(label);
      options.push({ id, label });
    });
  }

  if (selectedOptionId && !options.some((option) => option.id === selectedOptionId)) {
    errors.push('request.selectedOptionId must match one of the option ids');
  }
  if (correctOptionId && !options.some((option) => option.id === correctOptionId)) {
    errors.push('request.correctOptionId must match one of the option ids');
  }

  const rubric = isOneOf(conceptId, CONCEPT_IDS)
    ? validateRubric(input.rubric, conceptId, errors)
    : undefined;

  if (
    errors.length > 0 ||
    !questionId ||
    !isOneOf(conceptId, CONCEPT_IDS) ||
    !prompt ||
    !selectedOptionId ||
    !correctOptionId ||
    !explanation ||
    options.length === 0 ||
    !rubric
  ) {
    return { ok: false, errors };
  }

  return {
    ok: true,
    value: {
      questionId,
      conceptId,
      prompt,
      options,
      correctOptionId,
      selectedOptionId,
      explanation,
      rubric,
    },
  };
}
