# Execution, context and ownership

## Entry and baseline
MAIN owns the project outcome and also implements code. SUBAGENT is a bounded worker, not another project leader. Workers never spawn workers.
Each implementation MAIN starts and finishes with a clean code tree, preserving the existing origin and checkout. Unexpected changes require identifying their owner, never deleting or silently including them. Reuse valid verification evidence.
Await the actual case and approve the product, name, slogan, description, logo direction and scope once. Reuse the prepared stack and infrastructure. Read-only checks may resolve consequential feasibility questions before proposing the product.

## One executable whole-product plan
Use the configured services to define the approved product's real data, tool and storage flows. Specify each integration's concrete role, contracts and failure behavior alongside the feature that uses it.

After approval, the concept/planning MAIN writes memory/PLAN.md in one focused planning pass. The user then opens implementation chats for its first-level stages; the planning chat hands off without starting all stages. The plan must let a capable engineer implement an assigned block without guessing the product behavior. It is the execution reference, not a paragraph of intentions or a second copy of the code.

Start with the approved outcome, substantial user scenarios and the chosen architecture. Name the authoritative entities, relationships, provider calls, artifacts and integration contracts. Explain the difficult input-to-result path. Resolve its critical uncertainty early.
Read the supplied case rubric in HACKATHON.md when it arrives and map its requirements to concrete operations/artifacts and focused proof inside this plan. For the central product AI, settle the relevant HARNESS.md contracts. Preserve this existing planning/ownership workflow; these additions improve the implemented mechanism, not the number of planning ceremonies.

Divide the whole suite into coherent delivery blocks with concrete substeps. Each block states:
- Outcome: what a user will now be able to finish, including useful variations.
- Entry points: exact files/directories to create or modify and shared contracts to consume.
- Dependencies and owner: what must exist before this block can integrate; which files one worker may write.
- Behavior: inputs, validation, operations, saved state, resulting UI, downstream use, loading and likely failures. Include permissions, ru/kk/en labels and narrow-screen behavior where affected.
- Execution order: concrete changes in dependency order. A key function signature or payload example can remove ambiguity; do not prewrite entire implementations.
- Acceptance: a representative real input, expected usable result, important recovery path and the focused command/manual check that establishes it.
- Integration/checkpoint: which related block it connects to and when the complete package becomes a Git milestone.

Include the shared UI foundation, all approved capabilities, integration/refinement, a dedicated code review/stability stage, and then the final README/media stage. Include a fresh-user first-session acceptance scenario from PRODUCT.md: minimal setup, meaningful result within five minutes, a useful refinement and saved output. Establish semantic tokens and reusable components before multiple workers build screens. Use agents/knowledge/design/README.md and SYSTEM.md as a rough visual study; define an original product logo, visuals and composition before implementing shared primitives; record the chosen product-specific visual direction once in PROJECT and code tokens.
Order work to expose the main AI/data/integration risk first. The first connected slice is an internal checkpoint; keep building the full approved package. Include review/repairs, the complete Russian README and then the product demo video as real work in the plan, without speculative calculations of stage duration. The demo video requires its own scenario, shot construction and iterative animation work.
Review this plan once for missing dependencies, disconnected capabilities and acceptance criteria that fail to prove real behavior. Then execute. No additional plan approval, separate PRDs, per-worker plans or repeated planning reviews.

PLAN stores intended actions and dependencies. PROJECT stores feature status and durable decisions. STATE stores the current step, partial progress, workers/processes and next executable action. Update only affected plan steps when evidence or user steering changes the approach.

## Useful parallelism
Delegate an independent feature or substantial investigation when its result can advance alongside MAIN's work or contain bulky raw context. Short reads, simple edits and already-understood decisions stay local.
Usually two or three ready assignments are enough. Zero is appropriate while establishing a tightly coupled dependency. Worker count follows actual independent work, not a quota. Do not split by file, locale or checklist item just to distribute tasks.
Use fresh context, explicitly fork_turns: none where supported. A full-history fork carries the conversation; use it only when that history is necessary. File access is shared, so point workers at exact relevant paths rather than copying the entire base.
The user chooses MAIN's model and reasoning level in the app; preserve that choice. Workers use medium reasoning: GPT-5.6-Sol for bounded straightforward implementation or research, GPT-6-Astra for difficult domain logic or complex integration. Use default service tier, never Fast/priority.
Reuse a worker for closely related follow-up. MAIN works on another useful dependency while a worker owns its task, then integrates the returned result. Do not independently solve or reread the worker's whole investigation.

## Task packet
Begin every assignment with: "You are SUBAGENT, not MAIN. Do not create agents."
Include:
1. Exact result and why it matters, with the relevant approved product facts.
2. Existing stack, what is already implemented, exact code and knowledge sections to read.
3. Exclusive writable implementation paths; agents/ is read-only; MAIN owns Git, dependency installs and migrations.
4. Authoritative contracts, IDs, inputs/results/failures and dependency owners.
5. Behavior and acceptance conditions, including UI localization and relevant design tokens.
6. Return format: completed behavior, changed paths, focused check/result and any integration dependency. No console dumps.

A worker must understand the job from the packet and named files. Assume strong programming ability, not knowledge of MAIN's conversation. Give enough domain detail to prevent a technically correct but wrong feature.

## One shared checkout
MAIN owns manifests, lockfile, routes/entry points, shared schema/types, migrations and global tokens. It may explicitly lend one of these areas to one worker; that is exclusive ownership.
Assign whole feature paths once. Ownership stays valid until handover or reassignment; no repeated repository-wide collision checks or commentary about unrelated changes.
Workers request a shared change with the exact need, then continue independent work. MAIN batches compatible shared changes and supplies the resulting contract. Nobody creates a competing type/provider adapter to bypass coordination.
A finished worker returns its package and stops editing those paths. MAIN connects the returned interfaces and checks the combined behavior. Reuse the worker's successful scoped evidence.
Before taking over unfinished work, interrupt the owner and establish that it stopped. A missing response or stale context is not permission for two writers.

## Verification and checkpoints
Use existing type/lint/build conventions. Workers own focused behavior checks; MAIN owns the global build and integrated journey. Read only the relevant error excerpt; full logs stay in .checks/logs.
- Cosmetic change: inspect the affected UI in context; no test suite.
- Capability: check its important logic/service path and likely failure; verify saved results and follow-up use.
- Commit/push: node agents/scripts/checkpoint.mjs "Concrete change" -- ready/path another/path. It runs typecheck, lint and build, stages the named package, commits, pushes and deploys locally and remotely, then reports the result. It stops on a failed check. A failed push keeps the local commit.
Pass "." only when the entire working tree is a finished owned package and every writer has handed over. Explicit paths must likewise cover the complete intended checkpoint and leave no uncommitted work, because deployment requires a clean tree. Finish the active writing batch before checkpoint; do not push a partial package while other writers continue. MAIN checks the index/ownership once for the checkpoint, not after each edit. No commits by workers.
Commit integrated capability blocks and final delivery; batch minor fixes. Use concise, specific commit messages naming delivered behavior or the defect fixed, such as "Preserve draft edits after a failed save"; avoid abstract messages such as "Updates" or "Complete stage". Reuse valid verification evidence.
The checkpoint command deploys after its push; after a standalone push, MAIN runs the manual deployment command in agents/ops/SETUP.md. The command updates local Docker and the SSH server concurrently and waits for both outcomes. Local checks precede the push; the server builds, migrates and health-checks that exact pushed SHA. Verify the public health revision. A deployment failure leaves the Git commit intact and must be repaired explicitly.
Reuse successful checks until related code, dependencies or environment changes. Do not launch reviewer agents or repeat every criterion after an edit. A substantial bug gets a focused regression check when it prevents recurrence.
For a failure, identify the failing boundary and reproduce its smallest meaningful case. Compare the relevant working path, test a concrete cause and fix it there. Do not stack unrelated speculative fixes or write a separate debugging report.

## Continuation and delivery
After implementing and integrating the approved suite, run a separate first-level **Code review and stability** stage before the final delivery stage. Include it in the original PLAN, with time reserved for fixing findings. This is the user's requested product-wide review, not a review after every edit. MAIN reviews the actual integrated code and fixes confirmed problems; no automatic reviewer swarm or additional approval ceremony is required.

Trace the main journeys from real input through domain operations, database/provider boundaries and returned UI state. Test the weakest link in the product promise: relevant input changes must change the promised outcome, a provider adapter must be reached by the real user path, and a generated explanation must agree with its evidence. Judge benefit against the user's original task, not only an internal model score. Focus on plausible defects: permission/ownership checks, input validation, lost or duplicated operations, interrupted AI jobs, missing durable state, provider failures/timeouts, stale results after edits, artifact access/export and misleading success states. Check the first-five-minutes scenario with actual timing and a usable output. Read agents/TESTING.md and reconcile relevant unresolved defects. Use a bounded findings list in the existing stage plan with the affected path, reproduction and fix evidence, rather than creating another reporting system.

Fix reproducible defects before handoff. Run the focused regression/integration checks justified by those changes and the existing final type/lint/build commands; confirm core journeys and recovery against actual saved state. Reuse valid earlier evidence. User-owned visual testing remains in place; do not introduce routine browser audits. Unresolved issues that break the core promise or stability block the media handoff. State external blockers and untested boundaries precisely. A review cannot certify that no bugs exist, and a passing build alone is insufficient.

Checkpoint partial progress inside long tasks: what is established, which function/file is next, and any running process handle. Do not wait until a whole multihour task finishes. MEMORY.md defines recovery.
A running server, passing build or completed worker does not establish whole-product completion. Within the assigned stage, complete its acceptance conditions and hand off. Across the full plan, the approved suite must work together with useful branches, recovery and consistent UI across sizes and locales before final delivery.
Implementation agents focus on the product and record necessary facts in existing memory; do not draft or maintain the final README during development. The final delivery agent writes the Russian README after code review and stability work, then produces the video according to the relevant guides. Reuse the prepared SSH delivery. Record actual delivery blockers in the current handoff state.
Apply agreements quietly. "Отчет" gets one short paragraph from current knowledge, then work continues. No fresh tool calls solely to make a report current to the second.

## User testing without blocking development
The user tests the interface, follows progress and already has access. Do not issue routine ready-block announcements, testing invitations or repeated URLs. A committed/pushed change is not automatically deployed; when reporting delivery, use the verified public revision or say deployment is pending.
The user can write `- [ ]` issues in agents/TESTING.md instead of sending a chat message. MAIN starts reading it only after usable product UI exists; no checks during concept work or early foundation setup. Thereafter check at meaningful integration/commit/handoff boundaries, ordinarily no more often than about once per 15 minutes of active work. An explicit user report that the file changed can justify an earlier read. Do not create a scheduler, watcher, background loop, wake-up prompt or extra task to poll it. No checking after each tool call.
Read the current unchecked entries, distinguish defects from unfinished planned work and delegate independent fixes with the relevant issue text. MAIN owns shared changes and the checklist. Workers return implementation and verification results, not checkbox edits. Before marking an item, reread the relevant current text so simultaneous user additions survive; apply a narrow edit from `[ ]` to `[x]` with a short verification/result note. Assigned, implemented-but-unverified and externally blocked items remain unchecked, with a concise status only when useful. Do not delete or rewrite the user's issue description. The user can reopen an item by unchecking it. Keep unrelated implementation moving. This file is an issue inbox, not a new planning or reporting system.
Do not dispatch browser reviewers, routine Playwright runs or repeated screenshots. Keep type/lint/build and focused domain, data and integration checks. User testing complements that evidence and does not prove invisible server rules.
Record only a material confirmed defect or acceptance result, not every testing exchange. On a report request, use current knowledge immediately instead of querying the repository, workers or CI.

## Plan hierarchy and separate chats
First-level stages are user-opened chats, not subagent roles. Group work by a substantial outcome and shared context, rather than making a chat per small feature or arbitrarily limiting message count. Keep tightly coupled design/data/API work in one stage where separation would cause re-discovery or repeated integration.

The concept/planning chat defines the complete product architecture and ordered stage index in PLAN.md. Detailed stage files live in memory/stages/<stage-id>.md. Each contains the necessary requirements, exact contracts and second-level commit blocks with concrete third-level tasks. Write these details once; implementation MAIN reads its own stage plus the small shared index and relevant PROJECT facts. It executes that existing stage plan, rather than generating another competing plan.

For every first-level stage define:
- The integrated outcome and why it is a useful chat boundary.
- Dependencies, entry files and stable cross-stage contracts.
- Second-level commit blocks with implementation tasks and focused acceptance evidence.
- What the next stage can rely on, and any explicitly deferred work.

For every second-level block retain the behavior, state, failure handling, localization, owners and acceptance detail specified above. A commit should contain an integrated capability. Minor related fixes can join its block; new evidence can justify a focused repair commit without restructuring the whole plan.

At a stage boundary, finish or stop that MAIN's workers and reconcile their partial results before handing off. Save STATE once with delivered blocks, relevant verification, commit/push state, next stage and exact next action. Document any still-running server's command/address and ownership. Do not leave background file writers active for the next MAIN. No automatic chat creation or browser opening.

An implementation MAIN completes its assigned stage, not all later stages. If an acceptance condition is unmet, finish or record its actual blocker; a fresh chat is not a substitute for resolving defects. Partial handoff is allowed when the user requests a switch: identify the exact unfinished substep and its existing changes.

The stage order is full product implementation/integration → code review, repairs and stability verification → final Russian README → product demo video → landing integration of the finished demo. The final delivery MAIN completes README before starting video, then adds the video with a poster, lazy loading and accessible playback controls, without autoplay sound. The final delivery chats read implemented capabilities and evidence from PROJECT and the relevant code. They do not invent claims from the original plan. Product-wide integration and recovery must be working before documentation or video declares completion.
