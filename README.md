# BossFight AI — Motori per Aeromobili

An adaptive educational dungeon prototype for the **Motori per Aeromobili** assessment
framework. The existing Vite + Phaser BossFight AI game is preserved: the start screen,
top-down dungeon, three doors, challenge panel, boss arena, result screen and
`ChallengeProvider` abstraction still drive the run. This slice adds a learning layer
around them:

- a three-question diagnostic that accepts an answer **and** a written explanation,
- concept-aware adaptive routing for the C2 supersonic-intake path,
- evidence-based, explicitly provisional skill tracking,
- a three-phase boss built from structured `BossRound` data,
- source-status reporting, including missing answer sources,
- an optional server-side AI evaluation adapter with strict validation and a labelled
  mock fallback.

## Content status: provisional and unverified

The only source used for this slice is a **one-page framework summary**
(`Motori per Aeromobili — Course Assessment Framework`, p. 1). It names the C1–C5 concepts,
diagnostic themes and boss-round themes. It does **not** contain verified question text,
answers, rubrics, slide references or citations.

Consequently:

- every diagnostic question, challenge, answer and rubric in this repository is **authored
  prototype content**, not verified course material;
- every rubric is marked `provisional: true`;
- topic references point only to the framework summary and are labelled **topic only**;
- answer-source lists are intentionally empty, and the UI reports **No answer source**;
- mastery values are estimates and are always labelled **provisional** — they are not grades.

Do not present this prototype's content or mastery values as official assessment material.

## Playable path

1. **Diagnostic** — three questions, C1 → C2 → C3. Each requires a selected option and a
   written explanation. An uncertain evaluation may ask one clarification question.
2. **Feedback** — verdict, rubric criteria matched/missing, evaluator label, source status
   and the updated provisional skill state.
3. **C2 adaptive route** — the `GameDirector` chooses an advanced, counterexample or
   remedial challenge on the same concept, or asks for clarification.
4. **Dungeon** — three doors:
   - Streams (C1, fixed challenge),
   - Intake (C2, adaptive challenge selected from the route),
   - Combustor (C3, fixed challenge).
5. **Boss** — three phases using the existing multiple-choice, true/false and sequence
   mechanics.
6. **Result** — outcome, cleared challenges, attempts, XP, boss rounds, final provisional
   skill states and restart.

The boss has 3 HP and 3 rounds; the player also has 3 resolve. A correct answer damages the
boss, a wrong answer costs one resolve, and the encounter ends on KO or after round 3.
Because the boss has 3 HP and only 3 rounds, victory requires all three answers to be correct.

## Concepts and course mapping

| Concept | Title | Assessed in this slice | Where it appears |
| --- | --- | --- | --- |
| C1 | Standard Net Thrust & Stream Force | Yes | Diagnostic, Streams door |
| C2 | Supersonic Intake Operation & Matching | Yes, adaptive | Diagnostic, Intake door, boss phases 1 and 3 |
| C3 | Combustor Air Partitioning & Stability | Yes | Diagnostic, Combustor door, boss phase 2 |
| C4 | Working Line & Component Matching | No | Modeled only; shown as “Not assessed in this slice” |
| C5 | Thermal & Propulsive Efficiencies Trade-off | No | Modeled only; shown as “Not assessed in this slice” |

C4 and C5 exist in the course model so the framework is represented completely, but no
challenge, diagnostic question or adaptive route targets them in this slice. A C2 weakness
is never routed to C5 or any other unrelated concept.

## Adaptive C2 routing

`src/domain/gameDirector.ts` maps the diagnostic evidence to a route:

| Diagnostic evidence | Route | Challenge |
| --- | --- | --- |
| Correct answer + sound reasoning | Advanced | `c2-advanced-intake-matching` |
| Correct answer + flawed reasoning | Counterexample | `c2-counterexample-shock-position` |
| Wrong answer | Remedial | `c2-remedial-mass-flow` |
| Uncertain evaluation | Clarification question | No challenge yet |

If the evaluation is still uncertain after the clarification, the director falls back to the
remedial challenge with `allowClarification: false`, so the run always continues. Every
adaptive bank is checked with `assertBankConsistency`: a bank's challenges must belong to
the bank's concept, and the C2 bank contains all three route kinds.

## Boss phases

| Phase | Concept | Format | Challenge id |
| --- | --- | --- | --- |
| 1 | C2 | Multiple choice — total-pressure recovery vs adiabatic efficiency | `boss-intake-pressure-recovery` |
| 2 | C3 | True/false — combustor air partitioning | `boss-combustor-partitioning` |
| 3 | C2 | Sequence — off-design intake/engine mismatch | `boss-intake-offdesign-mismatch` |

The boss data is structured as `BossRound` records in
`src/content/motoriFramework.ts`; the existing boss arena and challenge panel render the
rounds without knowing about the learning metadata.

## Skill tracking

`src/domain/skillState.ts` applies one evidence record per diagnostic answer, adaptive
challenge and boss round. Mastery is a running average of evidence scores, not a single
answer, so one lucky response cannot masquerade as mastery.

- status `unknown`: no evidence yet;
- status `provisional`: at least one evidence record;
- status `demonstrated`: mastery ≥ 0.6, at least 2 evidence records and at least one
  sound-reasoning record.

The UI always appends a provisional label, including for `demonstrated` states. C4 and C5
show “Not assessed in this slice”.

## Tech stack

- Vite 7 + TypeScript 5.9
- Phaser 3.90
- Plain HTML/CSS overlays
- Vitest for unit tests
- Bun HTTP server for the optional AI evaluation adapter (`Bun.serve`)

No database, accounts, analytics or multiplayer are included. PoliTO login and additional
game genres are explicitly out of scope for this slice.

## Setup and run

The frontend requires Node 20+ **or** Bun 1.2+. The evaluation server requires Bun.
This workspace was verified with Bun 1.3.13.

```bash
# with Bun (recommended in this environment)
bun install
bun run dev
```

```bash
# with npm — frontend only
npm install
npm run dev
```

Open the URL printed by Vite (default: <http://localhost:5173>).

### Commands

| Command | Action |
| --- | --- |
| `bun run dev` | Vite development server |
| `bun run typecheck` | `tsc --noEmit` |
| `bun run test` | `vitest run` |
| `bun run build` | typecheck + production build into `dist/` |
| `bun run preview` | preview the production build |
| `bun run server` | Bun evaluation adapter on port 8787 by default |

## Evaluation adapter

By default the browser uses a **deterministic mock evaluator** that matches rubric keywords
and anti-signals. It is clearly labelled **Mock evaluator (not AI)**. No API key and no
network service are needed for the default game.

To use a real AI evaluator, start the server and point the browser at it:

```bash
# terminal 1 — Bun server
bun run server

# terminal 2 — Vite dev server
bun run dev
```

Create `.env.local` for the frontend:

```env
VITE_EVALUATION_API_URL=http://localhost:8787/evaluate
```

The browser then calls `POST /evaluate`. The server reads the API key from its own
environment; the key is never sent to the browser.

### Server environment variables

| Variable | Default | Purpose |
| --- | --- | --- |
| `AI_EVALUATION_API_KEY` | empty | Provider API key. If empty, `/evaluate` returns HTTP 503 `ai_not_configured` and the browser uses the labelled mock fallback. |
| `AI_EVALUATION_URL` | `https://api.openai.com/v1/chat/completions` | OpenAI-compatible chat-completions endpoint. |
| `AI_EVALUATION_MODEL` | `gpt-4o-mini` | Model name sent to the provider. |
| `AI_EVALUATION_TIMEOUT_MS` | `12000` | Provider request timeout in milliseconds. |
| `PORT` | `8787` | Port for the Bun server. |
| `AI_EVALUATION_ALLOWED_ORIGIN` | `*` | CORS origin allowed to call the adapter. |

PowerShell example for the server:

```powershell
$env:AI_EVALUATION_API_KEY = "your-key"
bun run server
```

The frontend URL still belongs in `.env.local` as shown above, because Vite reads it when
the dev server starts.

### Request and response flow

1. The browser posts an `EvaluationRequest` containing the question, options, selected
   option, explanation and the provisional rubric.
2. The server validates the request before calling the provider. Unknown fields, malformed
   ids, inconsistent rubric concepts and invalid option references are rejected.
3. The server sends a system prompt plus the request to the provider. The student's
   explanation is treated as untrusted data, not instructions.
4. The provider's message content must be a bare JSON object. Markdown fences are not
   repaired; the output is parsed and validated against the rubric. Unknown fields,
   unknown rubric criteria, invalid verdicts/reasoning values, out-of-range confidence,
   overlapping matched/missing criteria and an uncertain verdict without a clarification
   question are rejected.
5. A valid result is returned with `evaluator: "ai"`.
6. On timeout, network failure, provider HTTP error or invalid output, the server returns
   an error. The browser's `FallbackEvaluationProvider` then runs the deterministic mock
   evaluator and labels the result **Mock fallback (AI unavailable)** with the fallback
   reason. The game never stops because the AI service is unavailable.

AI output is handled only as data. There is no `eval`, `new Function`, dynamic script
insertion or execution of AI-generated code; strings are rendered with `textContent`.

### Adapter responses

| Status | Error code | Meaning |
| --- | --- | --- |
| `200` | — | Valid `EvaluationResult` |
| `400` | `invalid_json`, `invalid_request` | Malformed JSON or failed request validation |
| `404` | `not_found` | Unknown path |
| `405` | `method_not_allowed` | `/evaluate` called with a method other than `POST` |
| `413` | `payload_too_large` | Request body exceeds 64,000 characters |
| `502` | `ai_provider_error` | Provider returned a non-OK HTTP status |
| `502` | `ai_unreachable` | Provider could not be reached |
| `502` | `invalid_provider_response` | Provider response had no chat-completion message |
| `502` | `invalid_ai_output` | Message content was not valid JSON or failed schema/rubric validation |
| `503` | `ai_not_configured` | `AI_EVALUATION_API_KEY` is empty |
| `504` | `ai_timeout` | Provider request exceeded the configured timeout |

`GET /health` returns `{ "ok": true, "configured": boolean, "model": string }` and never
exposes the API key.

## Mock vs real behaviour

| Feature | Default run | With `VITE_EVALUATION_API_URL` |
| --- | --- | --- |
| Challenge content | Bundled mock data via `ChallengeProvider` | Same bundled content |
| Answer evaluation | Deterministic mock rubric evaluator, labelled “not AI” | Server AI adapter, or labelled mock fallback |
| API key required | No | Yes, on the server |
| Works offline | Yes | Yes — fallback keeps the game playable |

Query parameters:

- `?mockEvaluation=1` forces the labelled mock evaluator even when an API URL is configured.
- `?simulateError=1` makes the mock challenge provider fail the first request for each
  challenge, exercising the loading, error and retry states.

## Controls

| Input | Action |
| --- | --- |
| `WASD` / arrow keys | Move |
| `E` | Enter a nearby door / boss gate |
| Mouse or keyboard | Choose answers and menu buttons |
| `Esc` | Leave an open door challenge (not available in the boss fight) |

## Project structure

```text
├── index.html                     # Start, diagnostic, challenge, HUD and result markup
├── public/favicon.svg
├── server/
│   ├── aiEvaluationAdapter.ts     # Provider call, prompt, timeout and output validation
│   ├── index.ts                   # Bun HTTP server: /health and /evaluate
│   └── bun.d.ts                   # Minimal Bun typings
├── src/
│   ├── main.ts                    # Diagnostic → C2 route → doors → boss → result
│   ├── style.css
│   ├── content/
│   │   ├── ChallengeProvider.ts   # Provider interface + HTTP implementation
│   │   ├── providerFactory.ts     # Chooses mock or HTTP challenge provider
│   │   ├── mockProvider.ts        # Local provider with latency/error simulation
│   │   ├── mockChallenges.ts      # C1, C2 adaptive, C3 and boss challenges
│   │   ├── motoriFramework.ts     # Concepts, course, rubrics, diagnostics, boss rounds
│   │   ├── course.ts              # Door and boss configuration
│   │   └── challenge.schema.json  # JSON Schema for challenge content
│   ├── domain/
│   │   ├── learning.ts            # Course, Concept, SourceReference, rubric, skill models
│   │   ├── diagnostic.ts          # Diagnostic session state
│   │   ├── gameDirector.ts        # Adaptive routing + same-concept bank checks
│   │   ├── skillState.ts          # Evidence scoring, mastery and status
│   │   ├── sources.ts             # Source-status reporting, including missing sources
│   │   ├── challenge.ts           # Typed Challenge contract + runtime validation
│   │   ├── challengeState.ts      # Pure challenge state machine
│   │   ├── boss.ts                # Pure boss HP/round state
│   │   └── gameSession.ts         # Cleared doors and run state
│   ├── evaluation/
│   │   ├── types.ts               # Evaluation request/result contracts
│   │   ├── validate.ts            # Request, AI output and result validation
│   │   ├── mockEvaluator.ts       # Deterministic keyword/rubric mock evaluator
│   │   ├── httpEvaluator.ts       # Browser client for the server adapter
│   │   ├── fallbackEvaluator.ts   # Labelled mock fallback wrapper
│   │   └── providerFactory.ts     # Mock vs API provider selection
│   ├── game/
│   │   ├── DungeonScene.ts        # Dungeon, movement, doors, gate
│   │   ├── BossScene.ts           # Boss arena and hit/defeat animations
│   │   ├── events.ts              # Typed event bus
│   │   └── textures.ts            # Generated geometric placeholder sprite
│   └── ui/
│       ├── AppUI.ts               # Start, HUD, boss HUD, result, toast
│       ├── DiagnosticPanel.ts     # Diagnostic answer/explanation/clarification flow
│       ├── ChallengePanel.ts      # Loading/error/question/feedback states
│       └── learningRender.ts      # Skill bars, rubric criteria and source rendering
└── tests/
    ├── diagnostic.test.ts
    ├── gameDirector.test.ts
    ├── skillState.test.ts
    ├── evaluationValidation.test.ts
    ├── mockEvaluator.test.ts
    ├── httpEvaluator.test.ts
    ├── fallbackEvaluator.test.ts
    ├── serverAdapter.test.ts
    ├── motoriContent.test.ts
    ├── challengeState.test.ts
    ├── challengeValidation.test.ts
    ├── boss.test.ts
    └── fixtures/evaluation.ts
```

Game logic is separated from educational content:

- `domain/` contains no Phaser or DOM code.
- `content/` supplies data through `ChallengeProvider` plus learning metadata.
- `evaluation/` validates and labels answer evaluations; it never renders content.
- `game/` handles the dungeon and boss presentation.
- `ui/` handles menus, diagnostic and challenge presentation.

## Verification actually performed

Commands run in this workspace:

| Check | Result |
| --- | --- |
| `bun run typecheck` (`tsc --noEmit`) | Passed |
| `bun run test` (`vitest run`) | **116 tests passed across 12 files** |
| `bun run build` (`tsc --noEmit && vite build`) | Passed; produced `dist/` |
| Browser smoke test | Full path completed: 3-question diagnostic → C2 advanced route → all 3 doors → all 3 boss phases → victory → result → restart |
| Live server smoke test | `GET /health` → `{ ok: true, configured: false }`; `POST /evaluate` without a key → HTTP 503 `ai_not_configured` |

The browser smoke test also verified:

- the C2 route note “Advanced challenge” and the adaptive challenge id
  `c2-advanced-intake-matching`;
- missing answer-source warnings in diagnostic and challenge feedback;
- provisional skill updates after diagnostic, doors and boss rounds;
- rubric criteria and source references in the UI;
- the **Mock fallback (AI unavailable)** label with a fallback reason after a simulated
  evaluator outage.

The test suite covers the requested checks directly: different diagnostic answers produce
different routes; skill states update correctly; invalid AI outputs are rejected; missing
sources are reported; and the game remains playable when the evaluation API fails.

The production build reports a chunk-size warning because Phaser is bundled as one large
chunk (~1.57 MB uncompressed, ~365 kB gzip). This is expected for a prototype; code
splitting can come later.

The live AI provider path was **not** exercised against a real external API because no API
key was supplied. The adapter is covered with stubbed provider responses (valid output,
invalid output, HTTP errors, network errors and timeout), and the live server's
unconfigured 503 path was verified.

## Known limitations / out of scope

- All authored questions, answers and rubrics are unverified; answer sources are missing by
  design until real course material is supplied.
- Only C2 has an adaptive challenge bank. C1 and C3 use fixed checks, and C4/C5 are modeled
  but not assessed.
- The boss is limited to three phases (C2, C3, C2) and requires a perfect 3/3 run;
  difficulty tuning is left for a later milestone.
- The default evaluator is a deterministic keyword/rubric mock, not AI. It cannot judge
  free-form reasoning robustly.
- The AI adapter expects an OpenAI-compatible chat-completions response shape; other
  providers need a compatible endpoint or an adapter change.
- No persistence, accounts, leaderboard, analytics or database.
- No PoliTO login, multiplayer or additional game genres — explicitly out of scope.
- No audio, touch controls or gamepad support; placeholder geometric art only.

## Dev-only hook

In development builds, `window.__BOSSFIGHT_DEV__` exposes the app instance for browser smoke
testing (for example, inspecting the active Phaser scene or the current C2 route). It is not
included in production builds.
