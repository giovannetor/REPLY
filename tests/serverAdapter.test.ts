import { describe, expect, test } from 'vitest';
import {
  buildEvaluationPrompt,
  evaluateWithAi,
  type AiEvaluationConfig,
} from '../server/aiEvaluationAdapter';
import {
  chatCompletionBody,
  jsonResponse,
  testRequest,
  validAiPayload,
} from './fixtures/evaluation';

function config(
  fetchImpl: typeof fetch,
  overrides: Partial<AiEvaluationConfig> = {},
): AiEvaluationConfig {
  return {
    apiKey: 'test-secret',
    endpoint: 'https://provider.test/v1/chat/completions',
    model: 'test-model',
    timeoutMs: 1_000,
    fetchImpl,
    ...overrides,
  };
}

function pendingUntilAborted(): typeof fetch {
  return (_input, init) =>
    new Promise<Response>((_resolve, reject) => {
      init?.signal?.addEventListener('abort', () => {
        reject(new DOMException('The operation was aborted.', 'AbortError'));
      });
    });
}

describe('server-side AI evaluation adapter', () => {
  test('returns an explicit 503 when the API key is absent', async () => {
    let called = false;
    const result = await evaluateWithAi(
      testRequest,
      config(
        async () => {
          called = true;
          return jsonResponse({});
        },
        { apiKey: '   ' },
      ),
    );

    expect(result.status).toBe(503);
    expect(result.body.error).toBe('ai_not_configured');
    expect(called).toBe(false);
  });

  test('rejects a malformed request before calling the provider', async () => {
    let called = false;
    const result = await evaluateWithAi(
      { questionId: 'only-a-question-id' },
      config(async () => {
        called = true;
        return jsonResponse({});
      }),
    );

    expect(result.status).toBe(400);
    expect(result.body.error).toBe('invalid_request');
    expect(Array.isArray(result.body.details)).toBe(true);
    expect(called).toBe(false);
  });

  test('accepts a valid provider response and labels it as AI', async () => {
    let capturedInit: RequestInit | undefined;
    const fetchImpl: typeof fetch = async (_input, init) => {
      capturedInit = init;
      return jsonResponse(chatCompletionBody(JSON.stringify(validAiPayload)));
    };

    const result = await evaluateWithAi(testRequest, config(fetchImpl));

    expect(result.status).toBe(200);
    expect(result.body.evaluator).toBe('ai');
    expect(result.body.verdict).toBe('correct');
    expect(result.body.reasoning).toBe('sound');
    expect(JSON.stringify(result.body)).not.toContain('test-secret');

    const headers = new Headers(capturedInit?.headers);
    expect(headers.get('authorization')).toBe('Bearer test-secret');

    const body = JSON.parse(String(capturedInit?.body)) as {
      model: string;
      messages: Array<{ role: string; content: string }>;
    };
    expect(body.model).toBe('test-model');
    expect(body.messages[0]?.role).toBe('system');
    expect(body.messages[1]?.content).toContain(testRequest.explanation);
    expect(body.messages[0]?.content).toContain('untrusted');
  });

  test('rejects AI output with unknown fields as invalid, without executing it', async () => {
    const result = await evaluateWithAi(
      testRequest,
      config(async () =>
        jsonResponse(
          chatCompletionBody(
            JSON.stringify({ ...validAiPayload, script: 'alert(1)' }),
          ),
        ),
      ),
    );

    expect(result.status).toBe(502);
    expect(result.body.error).toBe('invalid_ai_output');
    expect(String(result.body.details)).toContain('script is not allowed');
  });

  test('rejects markdown-fenced AI output instead of trying to repair it', async () => {
    const result = await evaluateWithAi(
      testRequest,
      config(async () =>
        jsonResponse(
          chatCompletionBody(
            `\`\`\`json\n${JSON.stringify(validAiPayload)}\n\`\`\``,
          ),
        ),
      ),
    );

    expect(result.status).toBe(502);
    expect(result.body.error).toBe('invalid_ai_output');
  });

  test('rejects an uncertain AI verdict that omits a clarification question', async () => {
    const result = await evaluateWithAi(
      testRequest,
      config(async () =>
        jsonResponse(
          chatCompletionBody(
            JSON.stringify({ ...validAiPayload, verdict: 'uncertain' }),
          ),
        ),
      ),
    );

    expect(result.status).toBe(502);
    expect(result.body.error).toBe('invalid_ai_output');
    expect(String(result.body.details)).toContain('clarificationQuestion');
  });

  test('accepts an uncertain AI verdict with a clarification question', async () => {
    const result = await evaluateWithAi(
      testRequest,
      config(async () =>
        jsonResponse(
          chatCompletionBody(
            JSON.stringify({
              ...validAiPayload,
              verdict: 'uncertain',
              reasoning: 'insufficient',
              clarificationQuestion: 'Which way does the terminal shock move?',
            }),
          ),
        ),
      ),
    );

    expect(result.status).toBe(200);
    expect(result.body.verdict).toBe('uncertain');
    expect(result.body.clarificationQuestion).toContain('terminal shock');
  });

  test('rejects unknown rubric criteria in AI output', async () => {
    const result = await evaluateWithAi(
      testRequest,
      config(async () =>
        jsonResponse(
          chatCompletionBody(
            JSON.stringify({
              ...validAiPayload,
              matchedCriteria: ['not-a-criterion'],
            }),
          ),
        ),
      ),
    );

    expect(result.status).toBe(502);
    expect(result.body.error).toBe('invalid_ai_output');
  });

  test('reports a provider HTTP error as a 502', async () => {
    const result = await evaluateWithAi(
      testRequest,
      config(async () => jsonResponse({ error: 'boom' }, 500)),
    );

    expect(result.status).toBe(502);
    expect(result.body.error).toBe('ai_provider_error');
  });

  test('reports an unreachable provider as a 502', async () => {
    const result = await evaluateWithAi(
      testRequest,
      config(async () => {
        throw new Error('socket hang up');
      }),
    );

    expect(result.status).toBe(502);
    expect(result.body.error).toBe('ai_unreachable');
    expect(String(result.body.details)).toContain('socket hang up');
  });

  test('reports a provider timeout as a 504', async () => {
    const result = await evaluateWithAi(
      testRequest,
      config(pendingUntilAborted(), { timeoutMs: 10 }),
    );

    expect(result.status).toBe(504);
    expect(result.body.error).toBe('ai_timeout');
  });

  test('rejects a provider response without a chat completion message', async () => {
    const result = await evaluateWithAi(
      testRequest,
      config(async () => jsonResponse({ choices: [] })),
    );

    expect(result.status).toBe(502);
    expect(result.body.error).toBe('invalid_provider_response');
  });

  test('builds a prompt that carries the rubric and untrusted student data', () => {
    const prompt = buildEvaluationPrompt(testRequest);
    expect(prompt).toContain(testRequest.rubric.id);
    expect(prompt).toContain('shock-motion');
    expect(prompt).toContain(testRequest.explanation);
    expect(prompt).toContain('untrusted');
  });
});
