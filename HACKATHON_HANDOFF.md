# BossFight AI hackathon handoff — 7 November 2026

Implementation is on branch `codex/hackathon-ai-content`, prepared for review against main.
No changes have been merged into main. The dungeon scenes, CSS, HTML layout, original boss formats (including the
sequence round), login scope and multiplayer scope are preserved.

## Audit and recovery

- The cloud workspace initially had no checkout. Cloned `https://github.com/giovannetor/REPLY`.
- Starting commit: `bae49240e226a65df6055b177aa7a2b390960272`; clean working tree, no
  pre-existing uncommitted edits. Changes on another machine were not accessible here.
- Before editing, saved a complete Git bundle and source archive:
  `/workspace/work/bossfight-baseline/REPLY.bundle` and `REPLY-baseline.tar`.
- Confirmed baseline: typecheck passed, 116 tests across 12 files passed, build passed.
- Bun was missing from this environment. Installed Bun 1.4.4 under `/workspace/work/bun`
  and installed the existing locked dependencies without changing `bun.lock`.
- Original main remains at the starting commit. To inspect the baseline safely in a
  separate directory, run `git clone /workspace/work/bossfight-baseline/REPLY.bundle /workspace/REPLY-baseline`.
  Avoid resetting the current working tree if you have further edits to preserve.

## Run locally

Requires Bun; the following commands run from the repository root:

```bash
bun install --frozen-lockfile
cp .env.example .env
```

Edit `.env` locally to set `GEMINI_API_KEY`. Keep the default endpoint:
`https://generativelanguage.googleapis.com/v1beta/openai/chat/completions`.
Set `AI_EVALUATION_MODEL` to an enabled model for your Google account; the configured
default is `gemini-2.5-flash`, whose availability has not been live-tested here.
If `AI_EVALUATION_API_KEY` is already set, that compatibility override takes precedence.

```bash
# Terminal 1: backend at http://localhost:8787
bun run server
```

```bash
# Terminal 2: frontend at http://localhost:5173
bun run dev
```

The browser calls `/api/evaluate`; Vite proxies it to the backend. No frontend environment
variable is needed for this local setup. Use `VITE_EVALUATION_API_URL` only for a separate
backend location; it must contain an endpoint URL, never a credential. Restart the backend
when server credentials/model variables change. `.env*` files are ignored except the
credential-free `.env.example` template.

For this cloud checkout, Bun is available by first running:

```bash
export PATH=/workspace/work/bun/bin:$PATH
cd /workspace/REPLY
```

For an offline demo, open `http://localhost:5173/?mockEvaluation=1`.
For the production preview, run `bun run build`, then `bun run preview` (port 4173), while
keeping the backend running. Static production hosting needs the `/api/evaluate` reverse
proxy or an explicit `VITE_EVALUATION_API_URL` set at build time.

## Real AI versus mock

- Default: the backend makes an OpenAI-compatible Gemini chat-completions request using
  the server-only key and selected model. Validated successful output is labelled
  `AI evaluator`.
- Missing key, unavailable backend, provider error, timeout or malformed output:
  `Mock fallback (AI unavailable)`, with the reason shown in diagnostic feedback.
- `?mockEvaluation=1`: `Mock evaluator (not AI)`, with deterministic keyword checks.
- Health reports configuration, not proof of a successful provider request.
- Unit/provider-format tests use explicit test doubles; one production browser test
  injected a simulated valid AI response to verify the UI label and rubric transport.
  Neither constitutes live Gemini verification.

**No Gemini/API credential was available in this environment. No successful external AI
request is claimed.** The exact next checks after setting the key are:

```bash
curl http://localhost:8787/health
bun run verify:ai
```

`verify:ai` sends the actual Q_D2 request directly through the configured server adapter,
validates the response and prints its evaluation and selected route. It never substitutes
a mock and exits unsuccessfully on missing configuration or provider failure. It performs
one provider request, so provider usage charges may apply. Once successful, play the
browser diagnostic and confirm `AI evaluator` in feedback.

## Content and adaptivity

The adapter imports Q_D1, Q_D2, Q_D3, Q_R1, Q_A2, Q_B1, Q_B2 and Q_B3. Q_R2 and Q_A1
are excluded; other `NEEDS_REVIEW` questions are also excluded. Incompatible questions and
duplicate IDs are rejected. If a required import fails, existing authored content remains
available as the playable fallback.

The original IDs, correct answers, distractors, reasoning, misconceptions, every hint,
0/1/2 rubric levels, source document/pages and validation status are retained. The rubric
levels and misconception also pass through request validation into the AI prompt, and are
shown in diagnostic feedback. All imported source references are unverified; `SUPPORTED`
remains a pack claim, and `independentlyVerified` remains false. The original PDF is absent.

The active C2 diagnostic is Q_D2:

| Evidence | Route | Actual challenge |
| --- | --- | --- |
| Correct option + sound reasoning | Advanced | Q_A2 |
| Wrong option | Remedial | Q_R1 |
| Correct option + flawed reasoning | Counterexample | c2-counterexample-shock-position |
| Correct option + unclear reasoning | One clarification, then remedial if still unclear | Q_R1 after unresolved clarification |

The existing counterexample and original boss rounds are deliberately retained to preserve
working content and mechanics. The pack's other compatible questions are available through
the local provider; they do not all appear in one run. Adaptive challenge answers are
checked deterministically, as before; free-text AI evaluation occurs in the diagnostic.
Skill evidence updates after both the diagnostic and the adaptive door.

A deterministic mock example for Q_D2 sound reasoning:

> Lower engine mass flow demand moves the terminal shock upstream outside the cowl.
> Excess air spills. Pressure above ambient produces a pressure imbalance causing positive
> additive drag.

A flawed example:

> The shock moves downstream and there is no spill; pressure below ambient causes negative
> additive drag.

The mock is a keyword demonstration and cannot grade arbitrary prose reliably.

## Validation results

- `bun run typecheck`: passed.
- `bun run test`: 132 tests passed across 15 files.
- `bun run build`: passed. The existing Phaser chunk-size warning remains non-blocking.
- Chromium browser runs exercised actual keyboard movement and door/gate interactions,
  answer submission, all three boss phases, Victory, Results and restart for all three
  adaptive routes. The existing development hook was used only to read/assert state and
  find answer data, never to bypass movement or force scene transitions.
- Missing-key runs made real browser-to-backend requests returning HTTP 503, with the
  labelled fallback visible. Explicit offline mode made no evaluator API requests.
- Production-preview tests verified diagnostic → advanced route → rendered dungeon,
  missing-key fallback, simulated successful AI labelling, original rubric transport and
  absence of the development hook.
- Browser runs reported no uncaught page errors. Evidence is retained under
  `/workspace/work/browser-tests/`, including scripts, JSON reports and screenshots.
- `bun run verify:ai`: explicitly failed with “Live AI NOT tested” because no key was set.
- `git diff --check`: passed; `.env`, `.env.local` and `.env.production` are ignored.

The browser audit found and fixed a real blocker in the original HTTP evaluator: storing
native browser fetch as an unbound method caused `Illegal invocation`, preventing the
request from ever reaching the backend. A regression test now checks the fetch receiver.

## Remaining blockers and limitations

1. **Live AI verification:** supply a valid server credential and confirm model access with
   `bun run verify:ai`. Provider quota, billing and model availability remain unverified.
2. **Course verification:** check the eight imported questions and their cited pages
   against the original PDF before treating them as verified teaching material. Q_R2 and
   Q_A1 remain excluded pending review. C1/C3 and the counterexample/boss retain the existing
   authored-content warnings.
3. **Deployment:** no deployment was performed. For a hosted demo,
   configure the backend/proxy and server-side secret before using the live AI label.
4. Only C2 adapts; C4/C5 remain unassessed, as in the original. The existing 3/3 boss victory
   requirement, no persistence and Phaser bundle-size warning remain unchanged.

## Changed files

| Area | Files | Purpose |
| --- | --- | --- |
| Configuration/docs | `.env.example`, `.gitignore`, `package.json`, `vite.config.ts`, `README.md`, `HACKATHON_HANDOFF.md` | Safe environment template, secret-file exclusion, local proxy, live-check command and launch/handoff docs |
| Backend | `server/config.ts`, `server/index.ts`, `server/aiEvaluationAdapter.ts`, `server/verifyAi.ts` | Gemini defaults, environment overrides, original rubric in prompt, fixed error messages without reflected transport secrets, explicit live verification |
| Content | `src/content/coursePackAdapter.ts`, `src/content/motoriFramework.ts`, `src/content/mockChallenges.ts`, `src/content/mockProvider.ts`, `src/content/course.ts`, `src/content/challenge.schema.json` | Import eight compatible questions, wire Q_D2/Q_A2/Q_R1, retain original content, identify the local provisional archive |
| Domain/app | `src/domain/learning.ts`, `src/domain/challenge.ts`, `src/domain/gameDirector.ts`, `src/main.ts` | Lossless metadata, original pack IDs, wrong-option remedial routing and skill-flow preservation |
| Evaluation/UI | `src/evaluation/providerFactory.ts`, `src/evaluation/httpEvaluator.ts`, `src/evaluation/validate.ts`, `src/ui/DiagnosticPanel.ts`, `src/ui/learningRender.ts` | Default server path, fetch receiver fix, schema checks, pack status/rubric/misconception display |
| Tests | `tests/coursePack.test.ts`, `tests/serverConfig.test.ts`, `tests/evaluationProviderFactory.test.ts`, `tests/serverAdapter.test.ts`, `tests/httpEvaluator.test.ts`, `tests/gameDirector.test.ts`, `tests/motoriContent.test.ts` | Import integrity/exclusions, Q_D2 integration and skill updates, Gemini config, labels, error secrecy and browser fetch regression |

`Content/.../motori_aeromobili_c2_content_pack.json`, `bun.lock`, `index.html`, `src/style.css`,
Phaser scenes and existing assets were not edited.
