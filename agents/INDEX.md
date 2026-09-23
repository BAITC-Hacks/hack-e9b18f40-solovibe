# Knowledge navigation

Read only what the current task needs. Root AGENTS.md gives the operating rules.

| When | Read |
| --- | --- |
| MAIN starts or resumes | memory/STATE.md; relevant memory/PROJECT.md and active PLAN section |
| Case and concept | knowledge/PRODUCT.md and HACKATHON.md; HARNESS.md for the central AI mechanism |
| Approved concept, plan, assignments, checkpoints | knowledge/WORKFLOW.md |
| Implementation and shared contracts | relevant ENGINEERING.md sections; STACK.md for the prepared code |
| Long task or context recovery | knowledge/MEMORY.md |
| User-reported defects after testable UI exists | agents/TESTING.md at natural integration boundaries; cadence in WORKFLOW.md |
| UI foundation | knowledge/design/README.md, then relevant SYSTEM.md and DIRECTION.md sections |
| Motion or interface text | design/MOTION.md or COPY.md |
| First-session value or a selling landing page | knowledge/PRODUCT.md; design/COPY.md for copy |
| Integrated product complete, before README and demo video | code review/stability stage in knowledge/WORKFLOW.md |
| AI chat and editable outputs | knowledge/CHAT.md |
| Provider API calls, auth, files or database | knowledge/integrations/INDEX.md, then only the needed provider |
| Final README | knowledge/README.md |
| Product video | knowledge/MEDIA.md |

scripts/ contains agent workflow commands; runtime helpers needed by judges remain in runtime/.

knowledge/ holds prepared guidance. memory/ holds current product facts, written only by MAIN. work/ is optional temporary material. Backend workers do not read the design bundle. No recursive loading, skill discovery, repeated event research or independent documentation per agent.
Server/deployment setup details live in agents/ops/SETUP.md and are needed only for deployment changes.
