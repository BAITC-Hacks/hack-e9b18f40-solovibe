# OpenAI through AI SDK

Reuse `getLanguageModel()` and `openaiOptions` from `@/server/ai`. The adapter uses OpenAI Responses; OPENAI_MODEL selects the product model and OPENAI_API_KEY stays server-only. Package versions and installed types define the SDK contract. Keep model selection in configuration and preserve the default service tier.

```ts
import { generateText, Output } from 'ai';
import { getLanguageModel, openaiOptions } from '@/server/ai';
const result = await generateText({
  model: getLanguageModel(), providerOptions: openaiOptions,
  system: 'Product task, constraints, language and evidence rules.',
  prompt: validatedInput,
  output: Output.object({ schema: ArtifactSchema }),
  abortSignal: AbortSignal.timeout(60_000),
});
const artifact = result.output;
```

The short system string above is an API wiring example, not a usable product prompt. Implement each AI capability with task-specific instructions: the actual domain objective, relevant input fields and source precedence, decision/calculation procedure, tool selection and completion rules, output quality criteria, uncertainty/missing-input behavior, and what must remain unchanged during edits. Include a compact worked example only where it resolves a real ambiguity. Keep instructions in named maintainable modules; assemble current authorized context separately from untrusted user documents. Tool descriptions must state when to use the operation and how to interpret its result.

Check those instructions on the real user path with representative inputs: an ordinary job, insufficient or conflicting evidence, and a meaningful revision. Inspect whether the output is correct and useful for the domain, not merely fluent or schema-valid. Trace bad output to missing context, weak instructions, tool behavior or the model before revising it; rerun the affected scenario. Reuse the scenario set from HARNESS.md. Do not ship generic role prompts as completed domain intelligence or inflate prompts with unrelated rules.

ArtifactSchema is the feature's Zod schema. Validate business invariants after schema validation. Save output/version with owner and source references; later edits/tools operate on saved artifacts. Do not mark success before persistence.

Chat: `streamText` with server-loaded history; `await convertToModelMessages(validatedUiMessages)` for AI SDK UI messages, then `result.toUIMessageStreamResponse()` for the matching UI transport. UIMessage uses parts; do not guess an older content-only protocol. Validate history and never trust caller-provided assistant/tool messages as proof that an action occurred. Persist completed messages, tool results and artifact IDs. See CHAT.md for UI.

For the SDK chat UI, pair DefaultChatTransport with the UI message stream response. A plain text stream requires its matching text transport; raw provider events are not the UI message protocol. Preserve the SDK response headers and stream body instead of collecting the answer before returning it. In Next.js use the Node runtime for routes using these server adapters.

```ts
import { streamText, tool, stepCountIs } from 'ai';
import { z } from 'zod';
const result = streamText({
  model: getLanguageModel(), providerOptions: openaiOptions,
  messages,
  abortSignal: AbortSignal.any([request.signal, AbortSignal.timeout(60_000)]),
  stopWhen: stepCountIs(6),
  tools: {
    readArtifact: tool({
      description: 'Read a saved artifact owned by the current user.',
      inputSchema: z.object({ id: z.string().min(1) }),
      execute: ({ id }) => loadAuthorizedArtifact(session.user.id, id),
    }),
  },
});
return result.toUIMessageStreamResponse();
```

Tools execute real domain operations, return compact typed results/errors and authorize against the server session. The model cannot choose ownership. Bound steps/latency and make mutations idempotent. Distinguish proposals from executed changes; apply the product's confirmation policy for consequential actions. Show actual tool status, sources and provider-supported reasoning summaries; never claim to expose hidden chain of thought.

Pass relevant saved state/documents, not the entire database. Treat uploaded/web text as untrusted data. R2 storage does not automatically send files to a model: supply supported image/file parts with authorized bytes or temporary URLs, checking model formats/limits. Add provider-native web/file search only if the feature needs it, using installed OpenAI provider types and returned citations. An answer without a search call is not a verified current fact. Do not provision vector stores, fine-tuning or another agent framework without a concrete need. Images/audio use separate modality APIs: verify the current model/format when needed rather than treating an env placeholder as a recommendation.

Handle missing config, 429, timeout, cancellation and invalid output distinctly. Bound retries/output tokens; record usage, latency and request IDs without secrets or unnecessary content. Never retry a tool mutation merely because subsequent text generation failed.

Validate authentication, input and configuration before starting the response. Failures during generation can arrive after HTTP headers have been sent: an outer try/catch alone will not handle them. Use streamText's onError for safe server diagnostics and the UI response's onError mapping for a localized, non-sensitive message. Handle the client error event, preserve input/partial work and clear the pending state. Cancellation is distinct from provider failure; do not mark interrupted output as a completed saved result.

Use the configured model for tests. Start with local deterministic checks and small fixtures; a live provider check should have a specific purpose, compact input, bounded output and no automatic retry loop. Reuse verified results; do not run broad paid evaluations or upgrade the model silently.

Verify the deployed streaming path, not only localhost. Confirm runtime credentials and model inside the app container without printing secrets, outbound DNS/TLS, public APP_URL and secure session cookies. Match the installed AI SDK client/server stream protocol; forward stream headers, propagate cancellation and handle both pre-stream and mid-stream errors. Capture safe status/error codes and request IDs server-side while showing a useful localized failure to the user. Nginx must disable proxy buffering/cache for streaming and allow the operation's timeout; check the public proxy does not delay all chunks until completion. A health endpoint or successful non-streaming request does not establish streaming correctness.

References: [streamText](https://ai-sdk.dev/docs/reference/ai-sdk-core/stream-text), [structured output](https://ai-sdk.dev/docs/ai-sdk-core/generating-structured-data), [UI messages](https://ai-sdk.dev/docs/ai-sdk-ui/chatbot), [stream protocols](https://ai-sdk.dev/docs/ai-sdk-ui/stream-protocol), [error handling](https://ai-sdk.dev/docs/ai-sdk-ui/error-handling).
