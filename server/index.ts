import { evaluateWithAi } from './aiEvaluationAdapter';

function envNumber(name: string, fallback: number): number {
  const raw = Bun.env[name];
  if (!raw) {
    return fallback;
  }
  const value = Number(raw);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

const config = {
  apiKey: Bun.env.AI_EVALUATION_API_KEY ?? '',
  endpoint:
    Bun.env.AI_EVALUATION_URL?.trim() || 'https://api.openai.com/v1/chat/completions',
  model: Bun.env.AI_EVALUATION_MODEL?.trim() || 'gpt-4o-mini',
  timeoutMs: envNumber('AI_EVALUATION_TIMEOUT_MS', 12_000),
};

const allowedOrigin = Bun.env.AI_EVALUATION_ALLOWED_ORIGIN?.trim() || '*';

function withCors(response: Response): Response {
  response.headers.set('Access-Control-Allow-Origin', allowedOrigin);
  response.headers.set('Access-Control-Allow-Headers', 'Content-Type');
  response.headers.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  response.headers.set('Vary', 'Origin');
  return response;
}

function json(status: number, body: unknown): Response {
  return withCors(
    new Response(JSON.stringify(body), {
      status,
      headers: { 'Content-Type': 'application/json' },
    }),
  );
}

async function handleRequest(request: Request): Promise<Response> {
  const url = new URL(request.url);

  if (request.method === 'OPTIONS') {
    return withCors(new Response(null, { status: 204 }));
  }

  if (url.pathname === '/health') {
    return json(200, {
      ok: true,
      configured: config.apiKey.trim().length > 0,
      model: config.model,
    });
  }

  if (url.pathname !== '/evaluate') {
    return json(404, { error: 'not_found' });
  }

  if (request.method !== 'POST') {
    return json(405, { error: 'method_not_allowed' });
  }

  const raw = await request.text();
  if (raw.length > 64_000) {
    return json(413, { error: 'payload_too_large' });
  }

  let body: unknown;
  try {
    body = JSON.parse(raw) as unknown;
  } catch {
    return json(400, { error: 'invalid_json' });
  }

  const result = await evaluateWithAi(body, config);
  return json(result.status, result.body);
}

const server = Bun.serve({
  port: envNumber('PORT', 8787),
  fetch: handleRequest,
});

console.log(
  `BossFight AI evaluation adapter listening on http://localhost:${server.port} (configured: ${
    config.apiKey.trim().length > 0 ? 'yes' : 'no — mock fallback expected'
  })`,
);
