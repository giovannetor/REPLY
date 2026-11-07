import { describe, expect, test } from 'vitest';
import { GEMINI_ENDPOINT, readAiConfig } from '../server/config';

describe('Gemini server configuration', () => {
  test('defaults to Google OpenAI compatibility without inventing credentials', () => {
    expect(readAiConfig({})).toEqual({
      apiKey: '', endpoint: GEMINI_ENDPOINT, model: 'gemini-2.5-flash', timeoutMs: 20_000,
    });
  });

  test('reads Gemini credentials and preserves explicit provider overrides', () => {
    expect(readAiConfig({ GEMINI_API_KEY: ' private ', AI_EVALUATION_MODEL: ' gemini-custom ' }))
      .toMatchObject({ apiKey: 'private', model: 'gemini-custom' });
    expect(readAiConfig({ GEMINI_API_KEY: 'secondary', AI_EVALUATION_API_KEY: 'primary',
      AI_EVALUATION_URL: 'https://provider.test/chat/completions', AI_EVALUATION_TIMEOUT_MS: '9000' }))
      .toMatchObject({ apiKey: 'primary', endpoint: 'https://provider.test/chat/completions', timeoutMs: 9000 });
    expect(readAiConfig({ AI_EVALUATION_TIMEOUT_MS: '-5' }).timeoutMs).toBe(20_000);
  });
});
