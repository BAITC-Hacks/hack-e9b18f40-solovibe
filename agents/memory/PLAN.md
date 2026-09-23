# CityBalance execution plan

Approved identity: **CityBalance**, **«Решайте, каким станет город.»** Concept, identity and six-capability scope are approved. This is the single executable plan. By explicit user assignment, stages02–04 run in one MAIN chat with independent SUBAGENT packages in a shared checkout; stage01 precedes it, stages05 and06 remain separate user-opened chats. Second-level blocks retain their original numbers and are integrated commits. This combined assignment finishes02.1–02.3,03.1–03.3 and04.1–04.2, then hands off to05.1. PROJECT and STATE record verified progress.

## Depth and visible advantage
The finite dataset can be solved once by a maximizer; a score dashboard and fluent explanation would be shallow. CityBalance completes a constrained decision: preserve commitments, find feasible substitutions, expose beneficiaries and disadvantages, test a visible assumption, and carry the chosen version into an editable reproducible brief. Better Score is a model outcome, not measured social benefit.

First-viewport proof: a real budget transformation from the unconstrained best plan (98 units, Score57.236735, direct measures only in Nura) to the best with direct measures in at least two districts (100 units, Score56.997700). The control «Вложения хотя бы в два района» changes allocations and highlights Nura/Yesil. M3/Nura, M8/Nura and M14/city stay; M2/city and M9/Nura become M7/Nura and M11/Yesil. Price of the condition:0.239035, displayed0.24. Production evaluator supplies every number; completed exhaustive search supplies any optimality claim. One legible resting composition communicates the tradeoff within five seconds, including reduced motion. This is functional proof, not a fake AI conversation or a slogan claiming superiority.

The complete scope stays connected: board, constrained AI planning, comparison/versions, cost/delay sensitivity and repair, editable brief/exports, revocable team comparison. No pricing, real-city prediction, arbitrary external scraping, live multiplayer or generic agent platform. Versioned calibrated catalogues and a larger-search adapter are concrete extension paths, not promised implemented modules.

## Stage index
| Stage / assignment | Outcome | Commit blocks | Dependency |
| --- | --- | --- | --- |
| [01 Core and first real AI result](stages/01-core.md) | Exact model/search, original primitives, owned board, live saved AI alternative | 01.1 domain; 01.2 board; 01.3 AI | Prepared foundation |
| [02 Decision workshop](stages/02-workshop.md) | Full evidence/editing, priorities/versions/comparison, stress repair | 02.1 evidence; 02.2 alternatives; 02.3 stress | 01 |
| [03 Decision delivery](stages/03-delivery.md) | Editable brief, persistent files, shared team snapshots | 03.1 brief; 03.2 exports; 03.3 sharing | 02 |
| [04 Integration and presentation](stages/04-integration.md) | Original outcome-led landing and complete responsive localized suite | 04.1 landing; 04.2 integration | 03 |
| [05 Code review and stability](stages/05-stability.md) | Actual integrated review, fixes and verified release | 05.1 review/fix; 05.2 release | 04 |
| [06 README, video and final delivery](stages/06-final.md) | Russian README, authored video, landing integration | 06.1 README; 06.2 video; 06.3 integration | 05; README before video |

Read this index/contracts, PROJECT and the assigned stages02–04. Start independent04.1 visual/component work alongside02; start03 packages as their checked02 inputs become ready. Final04.2 integration follows all02/03 functions. MAIN owns shared types/schema/routes/dependencies/translations/Git; lend whole independent feature areas only after contracts exist. Workers follow WORKFLOW packets, never write agents/, mutate Git or delegate. Finish all writers in each checkpoint package. No additional plan approval or competing plan.

## Shared contracts
Behavior below is binding; clear internal organization and library choices remain implementer judgment. Exported Zod/types in `src/features/city/contracts.ts` become exact code authority. Proposed paths are creation targets, not claims that code exists.

### C1 Domain and source
- Runtime data: `src/features/city/data/akim-v1.ts` plus jury-readable original under `data/`; runtime never reads agents/. Dataset ID `akim-v1`, canonical hash, rules `akim-rules-v1`, evaluator version. Deterministic migration/startup seed never overwrites an old version.
- District IDs: yesil, almaty, saryarka, baikonur, nura. Directions: transport, ecology, social, safety, services. Indicators and measures retain T1..C2/M1..M14 IDs. Human labels are localized.
- `Decision={measureId,districtId:DistrictId|null}`; city measures require null. Canonical order by measure ID; order does not affect results. Exactly5 distinct measures, <=2/direction, budget100 and dataset exclusions on server.
- Drafts accept0..5 otherwise valid choices. Accepted selections never exceed budget or contain duplicates/conflicts. Invalid attempted selections receive inline reasons, not a new active selection. Only5 valid choices get an official Score; incomplete drafts persist with no official Score. Baseline reference is separately labelled.
- `evaluate(dataset,decisions,assumptions?)` returns issues, cost/remaining, direction counts, direct-investment and affected district IDs, all50 before/after indicators, district scores, population mean, weakest districts including ties, critical pairs, score components and stable evidence IDs. Each result binds source hash/revision and evaluator version; kind is official, sensitivity or baseline-reference.
- Apply exact supplied lag, synergy, clipping, weights and strict<40 threshold. No intermediate rounding. Private subset evaluation supports attribution, never invalid submission. All indicators are higher-is-better. No invented quarter-by-quarter trajectory.

### C2 Conditions, search and stress
`Constraints`: locked Decision[], excludedMeasureIds[], optional requiredDirections[], minDirectDistricts0..5, optional maxCriticalPairs0..50, optional districtFloors[{districtId,minScore0..100}], optional indicatorFloors[{districtId,indicatorId,minValue0..100}], maxSpend0..100(default100), objective(maxScore|minCost|protectDistrict), priorityDistrictId for protectDistrict. Locks bind ID and target. maxScore ranks Score then lower cost; minCost ranks cost then higher Score; protectDistrict ranks that district then Score; canonical IDs resolve ties.

User conditions restrict search, never alter official rules/Score. Preserve raw objective and normalized chips. Unsupported conditions need one clarification or an explicit limit; never pretend they were enforced.
`searchPlans({datasetVersion,constraints,assumptions?,limit<=3})` returns distinct plans, complete/incomplete status, evaluated count, objective, input hash and best value/certificate when exhaustive. Cache keyed by all input versions/constraints/assumptions; private data stays owner-scoped. No full optimizer per keystroke. Default deadline10s; incomplete searches cannot claim an optimum.
Price-of-condition compares best-before/best-after under identical other conditions and objective. Only maxScore pairs have a Score optimality gap. Honest ties/no-improvement are valid. Infeasible results include verified conflict evidence. Test simple contradictions first; bounded one-condition relaxations can suggest an explicitly different request, never silently loosen it or claim a minimal conflict without proof.

`StressAssumption={measureId,costIncreasePct:0..50,extraLagQuarters:0..4}`, one measure/experiment, zero means baseline. Effective lag<=8; cost integer hundredths, budget10000. Same override follows the measure into repair candidates; weights/effects/fixed synergies otherwise remain the supplied model. Persist separately. Over-budget stress has no valid sensitivity Score; ordinary team comparisons exclude stress variants. Compare original and repaired plans under the SAME assumptions; disclose unchanged synergy simplification.

### C3 Ownership and persistence
Tables introduced by delivering blocks: city_datasets, city_owners, city_scenarios, city_revisions, city_evaluations, city_searches, city_stress_tests, city_runs, city_run_events, city_tool_receipts, city_analyses, city_jobs, city_briefs, city_artifacts, city_shares, and needed worker/rate/deletion bookkeeping. Relational ownership/status/source fields plus bounded typed JSON payloads; foreign keys, owner/list indexes, unique revision/run sequence/idempotency constraints. city_jobs is the common lease queue (analysis/search/export/delete/retention); city_runs is the user-visible AI execution and city_analyses stores its checked evidence-linked result. Do not make a running job wait for a nested queued tool job in the same limited pool: tools execute shared services directly within the job's budget.

Server resolves guest or Better Auth principal. Guest token>=256 random bits, hashed in DB, HttpOnly SameSite=Lax cookie, Secure on HTTPS;30-day sliding inactivity expiry. No token localStorage. Guest work needs no signup; disclose retention in library. Atomic authenticated claim maps the stable guest ownerId to account and revokes guest token; no file moving. An account can own multiple principal rows. Existing auth takes precedence over creating a guest.

Scenario has owner/dataset/rules/title/current revision/deletedAt. Immutable revisions record parent/source, decisions, constraints, intent and cause. Atomic expectedRevisionId compare-and-swap for active changes. Alternatives are owned branches; apply/restore creates a new active revision, never rewrites history. Every derivative binds exact revision/assumptions; old run results stay accessible but cannot overwrite new edits. Brief has separate version CAS.

Defaults:10 live guest scenarios,100/account; library pages20. Accounts retained until deletion; guests expire after30 inactive days with queued cleanup. Deleted scenarios revoke links/cancel runs and tombstone objects until cleanup finishes. Seed data never deleted. Configurable limits are not paid gates.

### C4 Routes, consistency and errors
Private API prefix `/api/city`; server ownership, same-origin/CSRF mutation checks, strict schemas, body<=64KiB, IDs never grant access. Safe error shape `{code,messageKey,params?,fieldIssues?,retryAfterSeconds?,requestId}`. Codes: INVALID_PLAN, CONSTRAINT_CONFLICT, STALE_REVISION, NOT_FOUND, SESSION_EXPIRED, RATE_LIMITED, AI_UNAVAILABLE, PROVIDER_TIMEOUT, INVALID_AI_RESULT, STORAGE_UNAVAILABLE; proper400/401/404/409/413/429/503. Cross-owner lookup404.

Core endpoints: POST /scenarios {source:example|blank|proof,proofVariant?,clientMutationId}; GET /scenarios?cursor; GET/PATCH/DELETE /scenarios/:id; POST /scenarios/:id/revisions {expectedRevisionId,decisions,constraints,clientMutationId}; POST /scenarios/:id/forks; POST /scenarios/:id/apply; POST /searches; POST /stress-tests; POST /runs; GET /runs/:id; GET /runs/:id/events?after=seq; POST /runs/:id/cancel; POST /owners/claim. Brief/artifact/share payloads in stage03. SSR/UI/tools share services, not self-HTTP.

Mutation replies include canonical changed records/current revision/affected derivative statuses. One scenario store or equivalent coordinated invalidation updates board, tray, library, compare, brief and run panels. Immediate feedback, saved only after ack, preserve/retry failed edits, discard stale responses. Other tabs can receive a no-secrets invalidation signal then authorized refetch. Locale/navigation/sign-in preserve context; logout/account change clears private caches and late responses. Explicit AI edit requests may mutate current plan with CAS; suggestion requests save branches only.

### C5 AI execution
Prepared OpenAI Responses adapter/configured model/default tier; no unrelated API or extra agent framework.
Run={id,ownerId,scenarioId,inputRevisionId,procedure,objective,inputHash,status,continuation,usage,resultRefs}.
Event={runId,seq,toolCallId?,kind,status,payloadRefs}.
PostgreSQL lease worker is a separate process using same image/services. Lease30s, heartbeat10s, fencing token and max2 attempts within the same120s run deadline allow recovery before the deadline. Tool receipts, observations and artifacts are durable authority. No untracked Next background promise. Stage01 defines tools/procedures, extended by02/03. Numeric claims are evidence references rendered from saved evaluations. Quality checks precede completed status; preserve usable partials.

Defaults:1 active run/owner,2 global execution slots,8 tool steps/run,<=3 searches, provider timeout60s,total deadline120s, output<=4000 tokens, bounded relevant input. Guests10 AI runs/hour,accounts30/hour; coarse guest-creation AI abuse ceiling60/hour/IP configurable for shared networks, no IP gating manual calculations. One transient retry honoring Retry-After plus at most one quality repair, within same budget/deadline. Missing key affects AI action only; self-hosted error guidance names OPENAI_API_KEY. Human-readable retry time, no secret leakage or model upgrade.

### C6 Files and shares
R2/local objects: HTML brief,JSON scenario,CSV measures at `owners/{ownerId}/scenarios/{scenarioId}/revisions/{revisionId}/exports/{artifactId}.{ext}`. Metadata: owner,backend,key,source revision/brief version,locale,kind,MIME,size,sha256,state,timestamps. Server generates keys/bytes using prepared put/read/head/delete adapter. Absent R2→persistent local volume; partial config/error explicit; never switch backend on R2 outage. If an operator changes backend later, existing objects require an explicit migration; metadata/backend mismatch must produce a useful unavailable-file error, never read/delete a same-named object in the wrong backend. A migration UI is outside this scope.

Authorize every download through app route, including shares; no signed GET where immediate revocation is promised. Private no-store caching, attachment HTML, escaped output/CSP/sandbox previews, no scripts/external fetches. CSV text neutralizes formula prefixes. Limit10MiB. Idempotency by revision/brief/locale/kind; pending→ready only after verified bytes/metadata. Delete first revokes, then retries object cleanup; tombstone retains backend/key. Worker cleans abandoned pending objects after24h by tracked IDs only.

Shares:>=256bit token, only hash stored,30-day expiry, explicit revoke, immutable revision+brief version+permitted ready files snapshot. Token returned once as link, not logged. Later edits/exports are not automatically published. No public indexing or leaderboard. Data/snapshot/download requests recheck active token; cached URLs cannot bypass revoke.

### C7 Interface
Routes: /{locale} landing; /{locale}/city/:id workspace; /city/:id/brief; /city/:id/present; /scenarios library; /share/:token; localized sign-in/sign-up. Use existing next-intl conventions. Catalogue/priorities/comparison/AI are contextual, not an obligatory wizard.

Original logo/primitives in01; polished functional UI in every stage. Read design SYSTEM/DIRECTION/UX/COPY. Onest, porcelain/ink/teal; crafted five-piece city schematic never implies actual geography. On mobile use legible district list and reachable decision tray. All labels/states/errors ru/kk/en with persistent native-language selector; preserve generated/user content language.
Targets to measure: selection feedback/calculation<=100ms, no optimizer in render, SSR meaningful proof/action, reserved asset dimensions, responsive lightweight artwork, lazy detailed panels/video, reduced motion. Seek LCP<=2.5s/CLS<=0.1 on a documented representative setup if measurable without routine browser audits; never claim unmeasured performance. User owns visual testing; MAIN retains focused domain/service/static checks.

### C8 Shared acceptance set
Create fixtures under `src/features/city/__tests__/fixtures.ts` and focused runtime checks. No canned AI output. Introduce `pnpm test:domain`, `pnpm test:integration`, `pnpm verify:ai`, `pnpm verify:release` with their blocks (not currently existing commands). Existing tsx/Node test is sufficient; equivalent scripts allowed if recorded. Live paid checks are small and purposeful.

| ID | Input → observable outcome |
| --- | --- |
| V1 formula | Baseline52.557680; source example95/56.543070/Ncrit0; exact40 not critical; M11 negative effect, city scope, synergy, exclusions, rounding |
| V2 search | Exhaustive694395/max57.236735; all-five68200/max56.344510/Ncrit1; minDirectDistricts2 max56.997700; certificate matches all inputs |
| V3 first session | Fresh guest example→preserve M7/Nura and improve→saved feasible alternative/evidence→reopen/refine, measured<=5min including provider |
| V4 infeasible | All five directions AND zero critical pairs→no feasible plan; evidence that Nura needs two social measures; explicit relaxation, no silent edits |
| V5 revision chain | M7/Nura lock + minDirectDistricts2→alternative→user edits brief→M3 cost+20% stress→infeasible budget recognized→repair under same assumptions or proven no solution; reopen/export preserves source/user text |
| V6 recovery | Missing key/429/timeout/bad evidence/cancel/reconnect/worker restart preserve data; no duplicate tools or stale overwrite |
| V7 privacy/files | Two owners denied cross-access incl AI/export/delete; guest claim retains files; revoke denies link/download; local bytes survive replacement; R2 path actually read/written when configured |
| V8 visible proof | First viewport exposes actual two-district substitutions,0.24 price, functional toggle/start; no AI wait or long explanation required |
| V9 reproducibility | Isolated clean Compose project/volumes: env setup then pnpm local:up starts DB/migrations/seed/app/worker; manual app works without keys; real AI with key; no agents/private host dependency |

### C9 Criteria mapping
| Case criterion | Points | Operation/proof |
| --- | ---: | --- |
| Fit/functionality |25| Equal immutable100, five directions/exactly5 decisions/server budget gate, changed outcomes and AI explanation; V1/V3/V4,01–02 |
| Technical |25| Shared evaluator, exact constrained search, adaptive evidence-linked tools, durable versions/jobs/rights/files; V2/V5/V6/V7,01–05 |
| README/reproducibility |25| Verified Russian architecture/env/setup/limits/attribution, isolated Docker+PostgreSQL+worker/local files; V9,06 |
| Value/applicability |15| Priority→feasible changed portfolio→inspectable compromise→editable reusable brief; V3/V4/V5/V8,02–04; no invented ROI |
| Potential/originality |10| Visible condition price, feasibility proof and sensitivity follow-through, versioned data→calibration path; V2/V5/V8,02–06 |

Separate preserved general rubric: fit20→V1/V3; technical25→V2/V5/V6; README20→06.1; reproducibility20→V9; reliability/security15→V6/V7/05. Do not combine weights. Optional suggestions implemented: team comparison, district changes, recommendations, explicit cost/delay stress, compact presentation. Do not market stress as a stochastic city-event simulator.

## Checkpoints/handoff
All six stages are implemented. The user expanded the shared02–04 MAIN assignment to05 backend review and06 final delivery under a deadline. Confirmed findings and verification are in the stage files and STATE; no alternate plan was created.

Each block: finish all writers, meaningful focused checks, then `node agents/scripts/checkpoint.mjs "Concrete delivered behavior" -- <all finished owned paths>`. It performs static/build, commit/push and local/remote deploy. Verify returned revision and worker readiness. Retry only failed deploy via existing manual-deploy. Preserve SSH source-build, PostgreSQL/private R2/Brev HTTPS/unbuffered streams;01.3 must include worker in local/remote/rollback deployment. No browser auto-opening or routine ready announcements.

At useful boundaries update PROJECT status and STATE exact cursor. No per-edit audits, early README, extra PRDs or reviewer agents. Read TESTING only after testable UI, at natural boundaries roughly15min apart or explicit user update. Stage exit: no active file writers, integrated checkpoint/evidence/blockers, next stage entry. Planning hands off to01.1 in a separate user-opened chat.
