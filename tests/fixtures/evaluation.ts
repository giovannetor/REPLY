import type { EvaluationRubric } from '../../src/domain/learning';
import type {
  AiEvaluationPayload,
  EvaluationRequest,
  EvaluationResult,
} from '../../src/evaluation/types';

export const testRubric: EvaluationRubric = {
  id: 'c2-test-rubric',
  conceptId: 'C2',
  title: 'Intake reasoning test rubric',
  criteria: [
    {
      id: 'shock-motion',
      label: 'Shock motion',
      description: 'Identifies that the terminal shock moves upstream.',
      weight: 0.3,
      signals: ['shock moves upstream', 'terminal shock'],
      antiSignals: ['shock moves downstream'],
    },
    {
      id: 'spillage',
      label: 'Spillage',
      description: 'Explains that the captured stream tube is spilled.',
      weight: 0.3,
      signals: ['spill', 'captured stream tube'],
      antiSignals: ['no spill'],
    },
    {
      id: 'additive-drag',
      label: 'Additive drag',
      description: 'Links spillage to positive additive drag.',
      weight: 0.2,
      signals: ['additive drag'],
    },
    {
      id: 'unstart-risk',
      label: 'Unstart risk',
      description: 'Mentions unstart if the shock is expelled.',
      weight: 0.2,
      signals: ['unstart', 'expelled'],
    },
  ],
  passThreshold: 0.6,
  provisional: true,
  clarificationPrompt:
    'Which way does the terminal shock move, and what happens to the captured stream tube?',
};

export const testRequest: EvaluationRequest = {
  questionId: 'test-c2-question',
  conceptId: 'C2',
  prompt: 'A supersonic intake is throttled below design mass flow. What happens?',
  options: [
    {
      id: 'spill-additive-drag',
      label: 'It spills part of the stream tube and additive drag rises.',
    },
    {
      id: 'recovery-improves',
      label: 'Recovery improves because the shock weakens.',
    },
  ],
  correctOptionId: 'spill-additive-drag',
  selectedOptionId: 'spill-additive-drag',
  explanation:
    'The terminal shock moves upstream, the intake spills part of the captured stream tube, additive drag rises, and the shock can be expelled, causing unstart.',
  rubric: testRubric,
};

export const validAiPayload: AiEvaluationPayload = {
  verdict: 'correct',
  reasoning: 'sound',
  confidence: 0.88,
  feedback: 'The explanation links shock motion, spillage and additive drag.',
  matchedCriteria: ['shock-motion', 'spillage', 'additive-drag'],
  missingCriteria: ['unstart-risk'],
};

export const validEvaluationResult: EvaluationResult = {
  ...validAiPayload,
  evaluator: 'ai',
};

export function chatCompletionBody(content: string): Record<string, unknown> {
  return {
    choices: [
      {
        message: {
          role: 'assistant',
          content,
        },
      },
    ],
  };
}

export function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
