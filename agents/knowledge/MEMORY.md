# Project memory
MAIN is the only writer. Preserve useful state, not a transcript of work. Integrate requirements and corrections into their relevant sections, replacing obsolete wording and merging duplicates. Do not append dated updates, change histories or “latest requirements” blocks. Keep only current facts, decisions, verification scope and the next action. Dates that are actual domain data or technical identifiers retain their meaning.

STATE.md is a compact recovery cursor, normally about 15–25 short lines. Do not fill it with the stack, provider instructions, standing collaboration rules or a history of passed checks; those belong in their existing guides and PROJECT. Include only what changes the next action:
- Active objective, stage and product/name/scope approval; distinguish a proposal awaiting approval from authorized implementation.
- What now works, what is in progress and the exact next executable action.
- Current work batch: what was already done inside it and where to continue, so an unfinished feature does not look like an unstarted one.
- Current PLAN step and next useful step references, worker IDs/owned paths/status and ready packages.
- Running command/session IDs, last useful check, last commit/push and actual blockers.
PROJECT.md holds durable facts: approved product name/scope, user/pain, connected feature package, AI/tool roles, workflows, chosen stack, key code locations, contracts, real services/data, verified commands and decisions with short reasons. Usually under 100 lines. Link to the prepared knowledge instead of repeating it.
PLAN.md holds the detailed implementation steps, dependencies, assignment boundaries and acceptance conditions written after approval. It is amended only when the approach changes. PROJECT holds the feature map/status and durable facts; STATE holds the current cursor, live assignments and execution results. Keep one authoritative location per fact and reference it. The code remains authoritative for exact APIs and implementation details.
agents/TESTING.md is the user's issue inbox, separate from these MAIN-owned memory files. MAIN checks it only at the cadence in WORKFLOW.md once testable UI exists, and marks verified fixes. Do not duplicate the checklist into memory; reference an active issue only when needed to recover ongoing work. No scheduled messages or file-watching process.

Update STATE when a coherent capability is integrated, an assignment changes, a durable blocker appears or you finish a work batch. Record a long-running process immediately after launch. Fold tiny edits into the next checkpoint.
Update PROJECT only when a fact or decision changes. Replace obsolete entries. Store a command's result and scope, not its output dump. Keep secrets, general advice and moment-by-moment reasoning out.
When main begins a substantial task, make the next-action line name the task and its entry file/function. This makes interrupted work recoverable without a long diary.
Advance that line at a meaningful step inside long work, such as a working service path, a completed screen flow or an isolated cause of failure. Record what that step established and the next edit/check. One or two lines are enough; do not wait for the whole multi-hour task to finish.
Record user corrections, material decisions and dispatch/process handles when they happen. Ordinary status questions do not replace the active objective. Use work boundaries for checkpoints instead of relying on a warning that context is about to be compressed.
Load code through targeted searches and relevant functions. Request compact tool output, returning only the useful error excerpt for failures. Bulky investigation belongs in a scoped worker when it can be delegated; main keeps its conclusion, evidence scope and next action. Optional agents/work/ material is written only by main and linked only if it will actually help resume; it is not another journal.

After compaction:
1. Read STATE, necessary PROJECT sections and the active PLAN section once implementation has started. Preserve the original objective, approved product/name/scope and latest user steering. Do not re-request an approval or regenerate the existing plan.
2. Check named workers/processes before duplicating them. In a genuinely new chat their handles may be unavailable; reconcile that task's files/results and ownership before assigning another writer. An unavailable chat handle does not prove that a running process stopped.
3. Continue the recorded next action, reading only the relevant code. If the checkpoint is one step behind, inspect that step's named entry/result and advance it; do not rediscover the repository or repeat all earlier work.
4. If state and files disagree, reconcile that capability and update the checkpoint. Do not restart the project or rerun all successful checks.

When reporting completion, record the actual delivered state and remove stale in-progress assignments so the next context can distinguish completion from an interruption.

## Handoff to a new MAIN chat
Use the same STATE file; do not create a second handoff report or copy the transcript.
At the end of a first-level stage record: stage/block IDs completed, exact next stage/substep, changed contracts or unresolved decisions, relevant successful checks, commit/push status, and any running service's address/ownership.
Stop or finish all writing workers before the next MAIN takes over. Keep the preview server running if useful, with its role and port recorded. Server continuity is separate from writer ownership.
The new MAIN reads root rules, INDEX, STATE, necessary PROJECT facts and its named stage file. It reuses the approved design, product and plan, checks only discrepancies that affect its task, and continues from the named entry point.
Do not auto-open a browser at startup, after a ready block, or at completion. The user normally has the local site open already.
