import pack from '../../Content/Courses/motori-aeromobili/motori_aeromobili_c2_content_pack.json';
import { parseChallenge, type Challenge } from '../domain/challenge';
import type {
  CoursePackQuestion, DiagnosticQuestion, EvaluationRubric, LearningChallenge, SourceReference,
} from '../domain/learning';
import { validateEvaluationRequest } from '../evaluation/validate';

const EXCLUDED_IDS = new Set(['Q_R2', 'Q_A1']);
const TIERS = ['Diagnostic', 'Remedial', 'Advanced', 'Boss'];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isText(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0 && value.length <= 2_000;
}

function isTextArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.length > 0 && value.every(isText);
}

function isQuestion(value: unknown): value is CoursePackQuestion {
  if (!isRecord(value)) return false;
  const rubric = value.rubric;
  return ['id', 'question', 'correct_answer', 'reasoning', 'misconception', 'source_pages']
    .every((key) => isText(value[key])) &&
    TIERS.includes(String(value.tier)) &&
    typeof value.difficulty === 'number' && Number.isInteger(value.difficulty) &&
    value.difficulty >= 1 && value.difficulty <= 3 &&
    (value.status === 'SUPPORTED' || value.status === 'NEEDS_REVIEW') &&
    isTextArray(value.incorrect_answers) && isTextArray(value.hints) &&
    isRecord(rubric) && ['0', '1', '2'].every((key) => isText(rubric[key]));
}

export interface ImportedCoursePack {
  challenges: Record<string, Challenge>;
  learning: Record<string, LearningChallenge>;
  rubrics: Record<string, EvaluationRubric>;
  diagnostics: Record<string, DiagnosticQuestion>;
  excluded: string[];
  errors: string[];
}

/** Import only compatible, supported data. Status SUPPORTED is a pack claim,
 * never evidence that we checked the original course document. */
export function importCoursePack(input: unknown): ImportedCoursePack {
  const result: ImportedCoursePack = {
    challenges: {}, learning: {}, rubrics: {}, diagnostics: {}, excluded: [], errors: [],
  };
  if (!isRecord(input) || input.concept_id !== 'C2' ||
      !isText(input.source_document) || !Array.isArray(input.questions)) {
    result.errors.push('Invalid C2 course pack header.');
    return result;
  }
  const seen = new Set<string>();
  for (const raw of input.questions) {
    if (isRecord(raw) && typeof raw.id === 'string' &&
        (EXCLUDED_IDS.has(raw.id) || raw.status === 'NEEDS_REVIEW')) {
      result.excluded.push(raw.id);
      continue;
    }
    if (!isQuestion(raw) || raw.status !== 'SUPPORTED' || raw.source_pages === 'NEEDS_REVIEW') {
      result.errors.push(`Incompatible question: ${isRecord(raw) ? String(raw.id) : 'unknown'}`);
      continue;
    }
    if (seen.has(raw.id)) {
      // Reject the ID entirely: duplicate content must not silently replace it.
      delete result.challenges[raw.id];
      delete result.learning[raw.id];
      delete result.diagnostics[raw.id];
      delete result.rubrics[`${raw.id}-rubric`];
      result.errors.push(`Duplicate question: ${raw.id}`);
      continue;
    }
    seen.add(raw.id);
    try {
      // Copy the original fields to retain every hint, distractor and rubric level.
      const question: CoursePackQuestion = structuredClone(raw);
      const sourceRefs: SourceReference[] = [{
        id: `${question.id}-source`, kind: 'lecture-slide', title: input.source_document,
        locator: `pp. ${question.source_pages}`, verified: false,
        note: `Gemini content pack status: ${question.status}. Provisional; not independently verified against the original course material.`,
      }];
      const options = [
        { id: 'answer', label: question.correct_answer },
        ...question.incorrect_answers.map((label, index) => ({ id: `distractor-${index + 1}`, label })),
      ];
      // Stable rotation avoids presenting the correct answer first every time.
      const offset = question.difficulty % options.length;
      const rotated = [...options.slice(offset), ...options.slice(0, offset)];
      const challenge = parseChallenge({
        id: question.id, type: 'multiple-choice', topic: question.tier === 'Boss' ? 'boss' : 'order',
        title: `${question.id} · ${question.tier} intake challenge`, prompt: question.question,
        options: rotated, correctOptionId: 'answer', explanation: question.reasoning,
        hint: question.hints.join('\n'), xp: 80 + question.difficulty * 20,
      });
      const rubric: EvaluationRubric = {
        id: `${question.id}-rubric`, conceptId: 'C2', title: `${question.id} · provisional pack rubric`,
        criteria: [
          { id: 'mechanism', label: 'Physical mechanism', description: question.rubric['2'],
            weight: 0.5, signals: [question.correct_answer.slice(0, 70)] },
          { id: 'causal-link', label: 'Causal explanation', description: question.reasoning,
            weight: 0.5, signals: [question.reasoning.slice(0, 70)] },
        ],
        passThreshold: 0.6, provisional: true,
        clarificationPrompt: 'Explain the physical mechanism and its consequences in your own words.',
        scoringGuide: question.rubric, misconception: question.misconception,
      };
      if (question.id === 'Q_D2') {
        // These keywords serve only the labelled deterministic fallback.
        rubric.criteria = [
          { id: 'shock-motion', label: 'Shock moves outside',
            description: 'The terminal normal shock moves upstream, outside the cowl.', weight: 0.3,
            signals: ['upstream', 'outside', 'forward'],
            antiSignals: ['shock moves downstream', 'shock moves deeper', 'shock is swallowed'] },
          { id: 'spillage', label: 'Excess air spills',
            description: 'Lower engine corrected mass-flow demand causes spillage.', weight: 0.3,
            signals: ['spill', 'rejected', 'excess air'], antiSignals: ['no spill', 'never spills'] },
          { id: 'pressure-drag', label: 'Pressure imbalance causes drag',
            description: 'Pressure above ambient on the pre-entry boundaries causes positive additive drag.',
            weight: 0.4, signals: ['pressure imbalance', 'pressure buildup', 'pressure above ambient',
              'pressures greater than ambient', 'p > p_0', 'p > p0'],
            antiSignals: ['pressure below ambient', 'negative additive drag'] },
        ];
        rubric.passThreshold = 1;
        rubric.clarificationPrompt = 'Where does the shock move, why does air spill, and how does the pressure imbalance cause positive additive drag?';
      }
      const checked = validateEvaluationRequest({
        questionId: question.id, conceptId: 'C2', prompt: question.question, options: rotated,
        correctOptionId: 'answer', selectedOptionId: 'answer', explanation: question.reasoning, rubric,
      });
      if (!checked.ok) throw new Error(checked.errors.join('; '));
      const learning: LearningChallenge = {
        challengeId: question.id, conceptId: 'C2',
        kind: question.tier.toLowerCase() as LearningChallenge['kind'],
        rubricId: rubric.id, learningObjective: question.reasoning, requiresExplanation: false,
        sourceRefs, answerSourceRefs: sourceRefs,
        courseContent: { sourceDocument: input.source_document, question, independentlyVerified: false },
      };
      result.challenges[question.id] = challenge;
      result.learning[question.id] = learning;
      result.rubrics[rubric.id] = rubric;
      if (question.tier === 'Diagnostic') {
        result.diagnostics[question.id] = {
          id: question.id, conceptId: 'C2', order: 2, prompt: question.question,
          options: rotated, correctOptionId: 'answer', rubricId: rubric.id,
          explanationPrompt: rubric.clarificationPrompt, explanationHint: question.hints.join('\n'),
          sourceRefs, answerSourceRefs: sourceRefs, courseContent: learning.courseContent,
        };
      }
    } catch (error) {
      result.errors.push(`${raw.id}: ${error instanceof Error ? error.message : 'invalid content'}`);
    }
  }
  return result;
}

export const C2_CONTENT_PACK = importCoursePack(pack);
