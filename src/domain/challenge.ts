export const DOOR_IDS = ['logic', 'order', 'truth'] as const;
export type DoorId = (typeof DOOR_IDS)[number];

export const CHALLENGE_TOPICS = [...DOOR_IDS, 'boss'] as const;
export type ChallengeTopic = (typeof CHALLENGE_TOPICS)[number];

export const CHALLENGE_TYPES = ['multiple-choice', 'sequence', 'true-false'] as const;
export type ChallengeType = (typeof CHALLENGE_TYPES)[number];

export interface ChallengeOption {
  id: string;
  label: string;
}

export interface SequenceItem {
  id: string;
  label: string;
}

interface BaseChallenge {
  id: string;
  type: ChallengeType;
  topic: ChallengeTopic;
  title: string;
  prompt: string;
  explanation: string;
  hint?: string;
  xp: number;
}

export interface MultipleChoiceChallenge extends BaseChallenge {
  type: 'multiple-choice';
  options: ChallengeOption[];
  correctOptionId: string;
}

export interface SequenceChallenge extends BaseChallenge {
  type: 'sequence';
  items: SequenceItem[];
  correctOrder: string[];
}

export interface TrueFalseChallenge extends BaseChallenge {
  type: 'true-false';
  correctAnswer: boolean;
}

export type Challenge = MultipleChoiceChallenge | SequenceChallenge | TrueFalseChallenge;

export type ValidationResult =
  | { ok: true; challenge: Challenge }
  | { ok: false; errors: string[] };

export class ChallengeValidationError extends Error {
  readonly errors: string[];

  constructor(errors: string[]) {
    super(`Invalid challenge content: ${errors.join('; ')}`);
    this.name = 'ChallengeValidationError';
    this.errors = errors;
  }
}

const ID_PATTERN = /^[a-z0-9][a-z0-9-]{0,63}$/;
const MAX_TITLE = 120;
const MAX_PROMPT = 2_000;
const MAX_EXPLANATION = 2_000;
const MAX_HINT = 500;
const MAX_LABEL = 500;
const MAX_XP = 1_000;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isOneOf<T extends string>(value: unknown, values: readonly T[]): value is T {
  return typeof value === 'string' && (values as readonly string[]).includes(value);
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

function readLabels<T extends { id: string; label: string }>(
  value: unknown,
  key: 'options' | 'items',
  path: string,
  errors: string[],
  min: number,
  max: number,
): T[] | undefined {
  if (!Array.isArray(value)) {
    errors.push(`${path}.${key} must be an array`);
    return undefined;
  }
  if (value.length < min || value.length > max) {
    errors.push(`${path}.${key} must contain between ${min} and ${max} entries`);
    return undefined;
  }

  const entries: T[] = [];
  const seenIds = new Set<string>();
  const seenLabels = new Set<string>();

  value.forEach((entry, index) => {
    const entryPath = `${path}.${key}[${index}]`;
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
    if (seenIds.has(id)) {
      errors.push(`${entryPath}.id "${id}" is duplicated`);
      return;
    }
    if (seenLabels.has(label)) {
      errors.push(`${entryPath}.label "${label}" is duplicated`);
      return;
    }
    seenIds.add(id);
    seenLabels.add(label);
    entries.push({ id, label } as T);
  });

  return entries;
}

const COMMON_KEYS = [
  'id',
  'type',
  'topic',
  'title',
  'prompt',
  'explanation',
  'hint',
  'xp',
] as const;

const TYPE_KEYS: Record<ChallengeType, readonly string[]> = {
  'multiple-choice': ['options', 'correctOptionId'],
  sequence: ['items', 'correctOrder'],
  'true-false': ['correctAnswer'],
};

function validateCommon(
  record: Record<string, unknown>,
  errors: string[],
): Omit<BaseChallenge, 'type'> & { type: ChallengeType } | undefined {
  const type = record.type;
  if (!isOneOf(type, CHALLENGE_TYPES)) {
    errors.push(`challenge.type must be one of: ${CHALLENGE_TYPES.join(', ')}`);
    return undefined;
  }
  rejectUnknownKeys(record, [...COMMON_KEYS, ...TYPE_KEYS[type]], 'challenge', errors);

  const id = readId(record, 'id', 'challenge', errors);
  const topic = record.topic;
  if (!isOneOf(topic, CHALLENGE_TOPICS)) {
    errors.push(`challenge.topic must be one of: ${CHALLENGE_TOPICS.join(', ')}`);
    return undefined;
  }
  const title = readString(record, 'title', 'challenge', errors, { max: MAX_TITLE });
  const prompt = readString(record, 'prompt', 'challenge', errors, { max: MAX_PROMPT });
  const explanation = readString(record, 'explanation', 'challenge', errors, {
    max: MAX_EXPLANATION,
  });
  const hint = readString(record, 'hint', 'challenge', errors, {
    required: false,
    max: MAX_HINT,
  });
  const xpValue = record.xp;
  let xp: number | undefined;
  if (typeof xpValue !== 'number' || !Number.isInteger(xpValue) || xpValue < 1 || xpValue > MAX_XP) {
    errors.push(`challenge.xp must be an integer between 1 and ${MAX_XP}`);
  } else {
    xp = xpValue;
  }

  if (!id || !title || !prompt || !explanation || xp === undefined) {
    return undefined;
  }

  const base: Omit<BaseChallenge, 'type'> & { type: ChallengeType } = {
    id,
    type,
    topic,
    title,
    prompt,
    explanation,
    xp,
  };
  if (hint !== undefined) {
    base.hint = hint;
  }
  return base;
}

/**
 * Validates untrusted JSON and rebuilds a clean object containing only known fields.
 * This is intentionally data-only: nothing from the payload is evaluated or rendered as HTML.
 */
export function validateChallenge(input: unknown): ValidationResult {
  if (!isRecord(input)) {
    return { ok: false, errors: ['challenge must be an object'] };
  }

  const errors: string[] = [];
  const base = validateCommon(input, errors);
  if (!base) {
    return { ok: false, errors };
  }

  if (base.type === 'multiple-choice') {
    const options = readLabels<ChallengeOption>(input.options, 'options', 'challenge', errors, 2, 6);
    const correctOptionId = readId(input, 'correctOptionId', 'challenge', errors);
    if (options && correctOptionId && !options.some((option) => option.id === correctOptionId)) {
      errors.push('challenge.correctOptionId must match one of the option ids');
    }
    if (errors.length > 0 || !options || !correctOptionId) {
      return { ok: false, errors };
    }
    return {
      ok: true,
      challenge: {
        ...base,
        type: 'multiple-choice',
        options,
        correctOptionId,
      },
    };
  }

  if (base.type === 'sequence') {
    const items = readLabels<SequenceItem>(input.items, 'items', 'challenge', errors, 2, 8);
    const rawOrder = input.correctOrder;
    let correctOrder: string[] | undefined;
    if (!Array.isArray(rawOrder)) {
      errors.push('challenge.correctOrder must be an array');
    } else if (items) {
      const itemIds = new Set(items.map((item) => item.id));
      const seen = new Set<string>();
      const order: string[] = [];
      rawOrder.forEach((value, index) => {
        if (typeof value !== 'string' || !ID_PATTERN.test(value)) {
          errors.push(`challenge.correctOrder[${index}] must be a valid item id`);
          return;
        }
        if (!itemIds.has(value)) {
          errors.push(`challenge.correctOrder[${index}] references an unknown item`);
          return;
        }
        if (seen.has(value)) {
          errors.push(`challenge.correctOrder[${index}] is duplicated`);
          return;
        }
        seen.add(value);
        order.push(value);
      });
      if (order.length !== items.length) {
        errors.push('challenge.correctOrder must contain every item exactly once');
      } else {
        correctOrder = order;
      }
    }
    if (errors.length > 0 || !items || !correctOrder) {
      return { ok: false, errors };
    }
    return {
      ok: true,
      challenge: {
        ...base,
        type: 'sequence',
        items,
        correctOrder,
      },
    };
  }

  const correctAnswer = input.correctAnswer;
  if (typeof correctAnswer !== 'boolean') {
    errors.push('challenge.correctAnswer must be a boolean');
    return { ok: false, errors };
  }
  if (errors.length > 0) {
    return { ok: false, errors };
  }
  return {
    ok: true,
    challenge: {
      ...base,
      type: 'true-false',
      correctAnswer,
    },
  };
}

export function parseChallenge(input: unknown): Challenge {
  const result = validateChallenge(input);
  if (!result.ok) {
    throw new ChallengeValidationError(result.errors);
  }
  return result.challenge;
}

export function isDoorId(value: string): value is DoorId {
  return (DOOR_IDS as readonly string[]).includes(value);
}

export function formatCorrectAnswer(challenge: Challenge): string {
  if (challenge.type === 'true-false') {
    return challenge.correctAnswer ? 'True' : 'False';
  }
  if (challenge.type === 'multiple-choice') {
    const option = challenge.options.find((entry) => entry.id === challenge.correctOptionId);
    return option?.label ?? challenge.correctOptionId;
  }
  return challenge.correctOrder
    .map((id, index) => {
      const item = challenge.items.find((entry) => entry.id === id);
      return `${index + 1}. ${item?.label ?? id}`;
    })
    .join('\n');
}
