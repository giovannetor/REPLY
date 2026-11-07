import { C2_CONTENT_PACK } from '../src/content/coursePackAdapter';
import { decideRoute } from '../src/domain/gameDirector';
import { ADAPTIVE_BANKS } from '../src/content/motoriFramework';
import { evaluateWithAi } from './aiEvaluationAdapter';
import { readAiConfig } from './config';
import { validateEvaluationResult } from '../src/evaluation/validate';

const config = readAiConfig(Bun.env);
if (!config.apiKey) {
  throw new Error('Live AI NOT tested: set GEMINI_API_KEY in the gitignored .env file or server environment, then rerun bun run verify:ai. Never paste keys into chat or VITE_ variables.');
}
const question = C2_CONTENT_PACK.diagnostics.Q_D2;
if (!question) throw new Error('Q_D2 could not be imported.');
const rubric = C2_CONTENT_PACK.rubrics[question.rubricId];
const result = await evaluateWithAi({
  questionId: question.id, conceptId: question.conceptId, prompt: question.prompt,
  options: question.options, correctOptionId: question.correctOptionId,
  selectedOptionId: question.correctOptionId,
  explanation: 'Lower engine mass flow demand moves the terminal shock upstream outside the cowl. Excess air spills. Pressure above ambient creates a pressure imbalance causing positive additive drag.',
  rubric,
}, config);
if (result.status !== 200) {
  // Provider errors contain fixed messages only, never raw provider bodies or credentials.
  throw new Error(`Live AI verification failed: HTTP ${result.status}, ${String(result.body.error)}. ${String(result.body.message)}`);
}
const checked = validateEvaluationResult(result.body, rubric);
if (!checked.ok || checked.value.evaluator !== 'ai') {
  throw new Error('Live AI response failed validation or was not labelled AI.');
}
const route = decideRoute({
  conceptId: 'C2', answerCorrect: true, evaluation: checked.value, bank: ADAPTIVE_BANKS,
});
console.log(JSON.stringify({
  liveAiVerified: true, model: config.model, questionId: question.id,
  evaluation: checked.value, route,
  note: 'This confirms a live provider response, not independent verification of the course content.',
}, null, 2));
