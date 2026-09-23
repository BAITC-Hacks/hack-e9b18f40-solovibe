# Product agent harness

The user wants AI to perform a central share of the product's work, with broad useful capabilities inside the project. Apply this to the approved domain and its supplied criteria rather than building an unrelated general agent platform.

The coding-team workflow in AGENTS/WORKFLOW/MEMORY helps us build the product. The product harness is a separate runtime for end users: model, context, tools, persistent execution state, outputs and user control. Our existing provider wrapper is preparation, not a completed harness.

## A closed execution loop

User intent and relevant workspace state → model chooses a next operation → typed domain tool runs → its actual result is observed and saved → model continues, asks a necessary question or finishes with a usable artifact/action. The next operation depends on observed results. A fixed chain of prompts with a final answer is insufficient when the approved job needs adaptive work.

The primary object should represent the domain job and its durable results; chat can initiate, guide and refine it. User-facing language should use the domain's natural terms rather than exposing harness internals. Let the user inspect what changed, edit an output, and continue working from that state.
Support different independently initiated jobs over the same materials when the case calls for a broad product. Operations must be composable rather than locked into one universal step sequence. The agent decides which tools and procedures are relevant and completes the intermediate work. Exposing seven steps as seven pages does not create seven capabilities. The user should receive the finished useful result in the workspace with the controls needed to refine it.
Prefer doing the user's substantive work over generating preparation documents around it, unless those documents are the selected case's real deliverable. For creative work, concrete execution could involve rendering, editing, assembling or adapting actual material; these are illustrations, not an approved creative-industry scope. An artifact ID or a downloaded text file alone does not establish that depth.

## Minimum contracts to settle in the approved plan
Work backward from PRODUCT.md's first-session outcome. Choose the smallest necessary input and orchestrate preparation internally so the user receives something substantial within five minutes. Budget actual upload, model, tool and rendering latency; run independent useful operations concurrently where safe and persist usable intermediate results. Progressive output must already be useful, not decorative progress. The harness itself is not the product value proposition and should not dominate the landing page or demo video.

| Concern | Concrete contract |
| --- | --- |
| Work identity | A durable run/job ID, workspace/user owner, objective, selected input versions and execution status. Domain names may replace generic names. |
| Context | Relevant current records and artifacts, instructions for the selected capability, tool results, unresolved questions and a compact continuation state. The transcript alone is not the database. |
| Tool | Stable name, purpose, validated input/output schema, required authority, cancellation behavior, execution function and mutation/retry semantics. Reuse the same domain service as normal UI actions. |
| Observations | Ordered events with run ID, sequence, step/tool identifier, status and output/artifact references. Render actual work rather than a fabricated progress timer. |
| Result | A persisted typed artifact or real domain change, with owner, sources/inputs, version and operations for refinement/export/follow-through. Text is one possible format, not the universal output. |
| Recovery | Persist completed steps/results; distinguish waiting for user, retryable failure, cancelled and completed. Resume deliberately without repeating already committed side effects. |
| Completion | Validate task-specific success against stored state/tool evidence and the actual result's domain-specific quality. A successful API call, valid schema or saved file does not prove usefulness. Inspect the artifact against the approved observable properties and repair deficient output with bounded retries while preserving useful work. |

Use prepared AI SDK tool calling and the existing database first. Add a job worker when work must survive a disconnected browser or outlast a request. If using PostgreSQL jobs, specify claim/lease, heartbeat, retry and idempotency rather than starting an untracked background promise. Do not promise durable execution merely because the UI can reconnect to a stream.

## Broad useful tool coverage

Domain prompting and evaluation follow integrations/AI.md; provider wiring alone is not a completed AI capability.


AI should be able to operate the relevant project capabilities: find/read source material, inspect structured state, perform domain calculations through code, create/edit artifacts, compare alternatives, apply approved changes and carry results into downstream actions. Select the actual tool set from the case. Avoid an AI panel that can only describe work the user must then repeat manually elsewhere.

A product skill is a reusable domain procedure: when to use it, required inputs, tool subset, expected artifact and checks. Load only the useful procedure and source material for the task. These product skills are unrelated to the coding-agent ban on loading Codex skill catalogs. The ban remains in force for our development workflow.
The product runtime may delegate a bounded independent operation to a specialist agent when it materially helps. Give it relevant artifacts, an output contract, permitted tools and a budget; the coordinator integrates and verifies its result. This product-runtime choice is separate from the development rule that SUBAGENT cannot create agents. Do not add a cast of agent personas or nested calls purely for presentation. Deterministic transformations should remain efficient tools where a model is unnecessary.

Keep authority attached to the authenticated user/workspace. Tool executors enforce ownership and validate inputs independently of model text. Ordinary authorized project edits can proceed fluidly; consequential external actions follow the product's explicit intent/confirmation. Arbitrary machine access is not what makes the product deep. If code execution is essential to the case, use an isolated execution environment and return bounded artifacts/results.

## Behavior that demonstrates depth

- The same task can take different tool paths when inputs differ; a failed lookup or missing field leads to a useful next step.
- A real result carries its evidence and can be acted on. The user can identify which input led to an important claim or change.
- The user can change a constraint or part of an artifact and rerun the affected work using current saved state, retaining valid earlier work where the domain permits it.
- Track the input versions behind dependent results. A changed source or constraint identifies affected derivatives; preserve unaffected work and user edits. Update the affected result or clearly mark it as needing a working refresh before downstream use. Do not present an outdated derivative as current.
- Refreshing the interface does not erase completed outputs. A retry does not duplicate a publication, file or domain mutation.
- Finishing leads to a useful next operation such as export, execution, assignment, comparison or further editing, chosen for the actual job.

These are design tests, not a mandatory feature menu. Choose mechanisms that strengthen the approved outcome. Avoid adding generic dashboards, many agent personas or irrelevant integrations merely to signal complexity.

## Five-hour execution advantage

The user's anticipated implementation window is about five hours; it is not an official event deadline until confirmed. Preserve the existing efficient MAIN/worker/state workflow. Improve what those agents build rather than adding more orchestration ceremonies.

At concept selection, identify the non-obvious mechanism and the specific input→operation→result path that would prove it. Confirm data/tool access early. Choose an ambitious connected scope whose critical path, integration and one-minute demo video can fit the actual window. Reserve a finishing block; do not hide unavailable core dependencies until the end.

After the case is known, prepare a small real/reproducible scenario set alongside implementation: a normal job, an imperfect input/recovery, and a user revision/follow-through. Each records the input and expected observable properties, not a canned model answer. The same scenarios support focused verification, a quick-start example and the demo video. Never fake output by replacing the provider response with a fixture.
In the revision scenario, change a meaningful input so the correct result must change, then carry it across connected capabilities on the same saved domain object and inspect the reopened/exported result. Verify the expected changed properties and preserved unrelated edits, not exact model phrasing. This tests whether inputs actually affect the work and whether the suite shares current state, beyond separately working create/edit/export functions. Name concrete domain-quality properties in the existing PLAN acceptance criteria; do not create a separate scoring system.

The first connected mechanism is an internal checkpoint. Then finish the approved suite and integration. Use actual artifacts and one visible before/after change to make the difficult work immediately understandable to judges. Let requirements map to concrete proof in the existing PLAN; avoid a separate evaluation bureaucracy.

Implementation starting point: integrations/AI.md, DATABASE.md, STORAGE.md and CHAT.md, read only as needed. References for deeper investigation: [agent harness and evaluation terminology](https://www.anthropic.com/engineering/demystifying-evals-for-ai-agents), [continuation and environment state](https://www.anthropic.com/engineering/effective-harnesses-for-long-running-agents). These are optional background, not additional workflow instructions.
