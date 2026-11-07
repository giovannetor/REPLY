/** Server-only configuration. Never import this module from src/. */
export const GEMINI_ENDPOINT =
  'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions';

export function positiveNumber(raw: string | undefined, fallback: number): number {
  const value = Number(raw);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

export function readAiConfig(env: Record<string, string | undefined>) {
  return {
    apiKey: env.AI_EVALUATION_API_KEY?.trim() || env.GEMINI_API_KEY?.trim() || '',
    endpoint: env.AI_EVALUATION_URL?.trim() || GEMINI_ENDPOINT,
    model: env.AI_EVALUATION_MODEL?.trim() || 'gemini-2.5-flash',
    timeoutMs: positiveNumber(env.AI_EVALUATION_TIMEOUT_MS, 20_000),
  };
}
