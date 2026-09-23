# Final product README

Write `README.md` in Russian near completion, after functionality and code review are verified. Do not maintain it during implementation.

Treat the README opening as the product pitch. Within 5–10 seconds of scanning the first visible block, a judge should understand who has the problem, its concrete consequence, the useful result delivered and the strongest credible reason to prefer this solution. Put the product name, a concise problem-to-outcome statement and visible proof of the distinctive mechanism first; use a legible real result image when it communicates faster than prose. Keep the live app and demo easy to reach. Do not lead with a technology badge wall, setup commands, generic AI claims or “why we should win” assertions. The rest of the README substantiates this opening with actual scenarios, engineering and reproducible checks; a strong pitch does not replace technical documentation.

## Required content

1. Project name and a concrete opening: the problem and its consequence, the intended user, the difficult work the product completes, its inputs and usable outputs. Explain the advantage through an actual scenario and observable output, rather than adjectives or a list of technologies.
2. A prominent deployed app link near the top, and again before local setup. Never claim a link is live without verification.
3. A visible slot for the finished inline demo video.
4. The real problem, setting and connection to the selected case.
5. Implemented capabilities shown through real scenarios, including editing, saving, reuse, export and follow-through where supported.
6. AI mechanism, tools, persisted state and component architecture. Explain how the implementation produces its result: trace the main input through the relevant components, AI/tools, validation, persistence and user actions. Describe the genuinely non-obvious engineering decisions, why they were needed and their practical trade-offs. Identify what external services provide and what the project itself implements. Use actual module names or a compact architecture diagram where they clarify the explanation.
7. Reproducible startup. List supported OS/runtime versions, Docker Engine/Compose requirements, dependencies and ports. Include repository checkout, environment creation with safe example values, required credentials and any initial data. After `.env` setup, the primary quick start is `pnpm local:up`; PostgreSQL must become healthy, migrations must complete successfully and the app must become healthy. Explain every environment variable, whether it is required, how to obtain it and behavior when absent. R2 may use persistent local storage. A missing OpenAI key must produce an actionable error only for AI requests. Give local and server deployment instructions separately. Verify the localhost quick start from a clean environment without private configuration, pre-existing database content or access to the author's server.
8. A repeatable jury scenario with concrete input, actions, result and a useful refinement.
9. Data and integrations: actual sources, models, APIs and external services, with required credits. Include the materials attribution defined below.
10. Honest limitations of the current version.
11. Current deployed link, if one exists.

Use concise Russian, screenshots, an accurate technology badge row and no invented users, metrics, testimonials or capabilities. Cover common and case-specific criteria through substantive proof, not a scoring form. Make every paragraph carry a concrete fact, explanation or reproducible instruction. Avoid generic claims such as “scalable architecture” without explaining the mechanism and its limits. Cover practical advantages, extension paths and known limitations in the relevant sections without repeating the feature list.

## Materials attribution

Add a section titled "Используемые материалы" with a concrete description, adapted to what was actually used:

> Для организации разработки использовались личная конфигурация среды Codex (`.codex/config.toml`) и текстовая база знаний (`AGENTS.md`, `agents/knowledge/`). Конфигурация задаёт параметры работы агентов. База содержит инженерные и дизайн-рекомендации, справочные материалы по интеграциям, требования к качеству и критерии хакатона. Критерии конкретного кейса, план разработки и рабочие заметки добавляются в базу уже после старта хакатона.
>
> В базе также описан рабочий процесс: обсуждение концепции, составление плана, разделение работы на этапы, распределение задач между агентами, согласование общих интерфейсов, проверка результатов и передача контекста следующему исполнителю. Это текстовые инструкции по организации работы. Концепция, предметная модель, пользовательские сценарии и план реализации выбранного кейса формируются отдельно после получения задания; инструкции сами по себе не реализуют эти функции продукта.

Distinguish these instructions from executable preparation also present in the workspace. Describe the actual reused technical foundation, workflow scripts and third-party libraries separately, to the extent used in the final product. Do not call the whole workspace text-only, claim all code was created during the event, or claim compliance with an organizer's rule without its exact wording. State facts plainly; this section is an attribution, not an argument about eligibility.

Complete README before video production. The final clip should be uploaded as a GitHub video attachment when possible; never label a local file as a published embed. Keep a single insertion slot until upload. Then integrate the finished demo elegantly into the landing with a useful poster, lazy loading and accessible user-controlled playback, without autoplay sound or delaying the primary action. Include reproducible standalone server deployment, persistent volumes, migrations, public origin and health verification using repository files. Explain concrete practical development potential without invented impact figures.
