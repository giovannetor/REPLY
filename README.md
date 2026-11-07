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
- a server-side Gemini evaluation adapter with strict validation and a labelled
  mock fallback.

## Content status: provisional and unverified

The C2 content pack is imported from
`Content/Courses/motori-aeromobili/motori_aeromobili_c2_content_pack.json` through
`src/content/coursePackAdapter.ts`. Eight compatible questions retain their original IDs,
answer/distractor text, misconceptions, all hints, rubric levels, source pages and pack status.
`Q_R2` and `Q_A1` are excluded because they need review.

The pack's `SUPPORTED` status is **a Gemini-generated claim**, not independent verification.
All imported source references have `verified: false`, all rubrics remain provisional, and
metadata retains `independentlyVerified: false`. The original PDF is not in this repository.
C1/C3 and the retained counterexample remain authored prototype content with missing answer
sources. The framework summary supports topic names only. Mastery estimates are provisional,
not official grades.

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

`src/domain/gameDirector.ts` maps the diagnostic **Q_D2** evidence to a route:

| Diagnostic evidence | Route | Challenge |
| --- | --- | --- |
| Correct answer + sound reasoning | Advanced | `Q_A2` |
| Correct answer + flawed reasoning | Counterexample | `c2-counterexample-shock-position` |
| Wrong answer | Remedial | `Q_R1` |
| Correct option + uncertain evaluation | Clarification question | No challenge yet |

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

The original boss formats and questions are retained, including the sequence round. Pack
boss questions are imported and available through the provider, but do not replace this demo.

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
This workspace was verified with Bun 1.4.4 and Node 24.22.1.

```bash
# with Bun (recommended in this environment)
bun install --frozen-lockfile
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
| `bun run verify:ai` | Verify one real provider response; fails explicitly without a key |

## Evaluation adapter

The browser calls `/api/evaluate` by default. Vite dev and preview proxy that path to
`http://localhost:8787/evaluate`. The Bun server calls Google's OpenAI-compatible Gemini
endpoint; no credential is sent to the browser. Only a validated successful provider
response receives **AI evaluator**. A missing key, stopped backend, timeout or invalid output
produces **Mock fallback (AI unavailable)** with a reason. For explicit offline mode open
<http://localhost:5173/?mockEvaluation=1>, labelled **Mock evaluator (not AI)**.

From the repository root:

```bash
bun install --frozen-lockfile
cp .env.example .env
# Edit the gitignored .env locally: set GEMINI_API_KEY to your Google AI Studio key.
# Set AI_EVALUATION_MODEL to a Gemini model enabled for that key/account.
```

```bash
# terminal 1 — backend, port 8787
bun run server
```

```bash
# terminal 2 — frontend, port 5173
bun run dev
```

Open <http://localhost:5173>. After changing server variables, restart `bun run server`.
Never put keys in `VITE_` variables, source code, Git or chat. If
`AI_EVALUATION_API_KEY` is already set, it takes precedence over `GEMINI_API_KEY`.

Check configuration and verify a real response separately:

```bash
curl http://localhost:8787/health
bun run verify:ai
```

Health reports configuration only. `verify:ai` sends Q_D2 to the actual configured provider,
validates its response, prints the resulting route and exits unsuccessfully if the key is
missing or the provider fails. It does not silently substitute a mock. A successful live
request still does not verify the educational correctness of the pack.

### Server environment variables

| Variable | Default | Purpose |
| --- | --- | --- |
| `GEMINI_API_KEY` | empty | Server-only Google AI Studio credential. |
| `AI_EVALUATION_API_KEY` | empty | Optional credential override, retained for compatibility. |
| `AI_EVALUATION_URL` | `https://generativelanguage.googleapis.com/v1beta/openai/chat/completions` | OpenAI-compatible endpoint. |
| `AI_EVALUATION_MODEL` | `gemini-2.5-flash` | Select an available model for your account. Availability has not been live-tested here. |
| `AI_EVALUATION_TIMEOUT_MS` | `20000` | Provider timeout; default browser deadline is 25000 ms. |
| `PORT` | `8787` | Backend port. If changed, adjust the frontend URL/proxy. |
| `AI_EVALUATION_ALLOWED_ORIGIN` | `*` | CORS origin; `.env.example` uses `http://localhost:5173`. |

For separately hosted frontends, set public `VITE_EVALUATION_API_URL` to the backend's
`/evaluate` URL and rebuild/restart Vite. Static production hosting needs a reverse proxy
for `/api/evaluate` or this explicit URL. `bun run preview` is a local build preview.

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
| `503` | `ai_not_configured` | Neither server credential variable is set |
| `504` | `ai_timeout` | Provider request exceeded the configured timeout |

`GET /health` returns `ok`, `configured`, `model` and an explanatory `note`; it never
exposes the API key or claims that a live provider request succeeded.

## Mock vs real behaviour

| Feature | Default run | `?mockEvaluation=1` |
| --- | --- | --- |
| Challenge content | Bundled provisional pack + retained prototype questions | Same content |
| Answer evaluation | Gemini server adapter; labelled mock fallback on failure | Deterministic mock, labelled “not AI” |
| API key required | For live AI only, server side | No |
| Works without provider access | Yes, through labelled fallback | Yes |

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
│   ├── config.ts                  # Server-only Gemini endpoint/key/model configuration
│   ├── verifyAi.ts                # Real-provider smoke check; no mock fallback
│   ├── index.ts                   # Bun HTTP server: /health and /evaluate
│   └── bun.d.ts                   # Minimal Bun typings
├── src/
│   ├── main.ts                    # Diagnostic → C2 route → doors → boss → result
│   ├── style.css
│   ├── content/
│   │   ├── ChallengeProvider.ts   # Provider interface + HTTP implementation
│   │   ├── providerFactory.ts     # Chooses mock or HTTP challenge provider
│   │   ├── mockProvider.ts        # Local provider with latency/error simulation
│   │   ├── coursePackAdapter.ts   # Validated C2 pack import with original metadata
│   │   ├── mockChallenges.ts      # Imported pack + retained prototype challenges
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

The Poliquest UI refresh passed typecheck, 144 tests and a production build. A real
`bun run verify:ai` call with `gemini-3.5-flash-lite` evaluated Q_D2 as correct/sound and
selected Q_A2. An isolated Chromium run exercised course creation with an actual file,
reload persistence, three live diagnostic evaluations, Q_A2, all three doors and all
three boss phases through Victory with no page errors. Desktop and 390px mobile
screenshots were inspected. Hit/counterattack state and safe math rendering also have
component tests. Earlier prototype checks are recorded in `HACKATHON_HANDOFF.md`.

## Known limitations / out of scope

- Course questions, answers and rubrics remain unverified. Imported C2 questions have
  page citations, but the original PDF must still be checked; other authored questions
  retain missing answer-source warnings.
- Only C2 has an adaptive challenge bank. C1 and C3 use fixed checks, and C4/C5 are modeled
  but not assessed.
- The boss is limited to three phases (C2, C3, C2) and requires a perfect 3/3 run;
  difficulty tuning is left for a later milestone.
- Without a valid server key, evaluation uses the labelled deterministic mock fallback.
  Its keyword checks cannot judge arbitrary free-form reasoning robustly.
- The AI adapter expects an OpenAI-compatible chat-completions response shape; other
  providers need a compatible endpoint or an adapter change.
- Course drafts and uploaded materials persist in browser IndexedDB only. Run progress, accounts, leaderboards and analytics are not persisted. Clearing site data removes the local library.
- No PoliTO login, multiplayer or additional game genres — explicitly out of scope.
- Local pixel-style astronaut and guardian art; no audio, touch movement or gamepad support. The course menus and combat cards have responsive layouts, but dungeon movement still requires a keyboard.

## Dev-only hook

In development builds, `window.__BOSSFIGHT_DEV__` exposes the app instance for browser smoke
testing (for example, inspecting the active Phaser scene or the current C2 route). It is not
included in production builds.


## Poliquest interface and local course library

The home screen opens the course hangar. **Motori per Aeromobili** is the seeded playable
mission: launch it to use the existing diagnostic → adaptive dungeon → three-phase boss flow.
New courses can be saved with a title, description, optional institution/professor and up to
10 documents (20 MB total; PDF, TXT, MD, PPT/PPTX, DOC/DOCX). Actual files and metadata are
saved atomically in IndexedDB on this browser/device. They are not uploaded to a server,
parsed or sent to AI. Cards show **Draft** or **Materials uploaded**; only the seeded course
is **Playable**. No generation or content-pack approval pipeline is implemented.

Questions retain hints, status, identifiers, rubric signals and source references. Expand
**Sources & verification** to read the secondary citation details. `src/ui/math.ts` renders
explicit inline TeX (`\(…\)` or `$…$`) and block TeX (`\[…\]` or `$$…$$`) with bundled
KaTeX and local fonts. Common legacy variables are also recognized. Ordinary prose is
inserted as text, KaTeX trust is disabled, and malformed TeX falls back to readable text.

During combat, a dedicated guardian panel stays beside the question on desktop and above
it on small screens. Its HP, resolve and hit/counterattack feedback follow the existing
boss state/events; it does not decide correctness, damage, routing or victory. Animations
respect reduced-motion preferences. The existing labelled AI fallback is unchanged.
