# AI interaction and editable results

Use this when the approved product contains chat. AI can also power dedicated tools, editors, search or workflow actions. Choose the interaction for the actual job; a chat box is not the whole product.

## Conversation behavior
For textual answers, provide streaming Markdown with code, tables and links rendered safely. Use actual arriving deltas, a quiet generation indicator, stop, retry/regenerate, copy and message editing. Save conversations and message relationships; new, rename, delete and history must work when exposed.
On submit, immediately show the user's message with a stable client request ID and a quiet pending response state. Reconcile that message with the server acknowledgement instead of adding a second copy. Do not wait for the first model token to display both messages together. On rejection, retain the message/input with an accurate retry state; reuse the request identity to prevent duplicate submission. Keep send acceptance, first output and completion as separate events.
Editing an earlier user message or regenerating an answer creates a branch with parent IDs and a selected path. Keep alternate answers accessible and send only the selected branch to the model. Cancelling preserves the draft and useful partial response. Mark interrupted output honestly.
Support case-relevant attachments with real validation, upload/processing status and removal. Keep the draft while navigating panels or changing interface language. Enter sends, Shift+Enter adds a line, and IME composition must finish before sending.
Follow streaming at the bottom only while the user is already near the bottom. If they scroll up, keep their position and show a jump-to-latest action. Do not announce every token to screen readers; announce concise state changes.

## Visible work
Show the current real operation in one readable row, for example a domain action and its target. Rows expand for relevant tool inputs/results or provider-supplied reasoning summaries when available.
Use actual tool events with stable IDs and pending/success/error states. Collapse earlier steps, retain errors and useful results, and allow inspection without overwhelming the conversation. Do not fabricate an internal monologue, elapsed work, tool output or provider reasoning.
Match each tool result to its invocation ID, not only its tool name: concurrent or repeated calls may use the same name. Keep provider-supplied reasoning summaries separate from answer text and show them only when available; do not synthesize a transcript of hidden thinking. A tool finishing is not the whole run finishing. Unlock submission and finalize the result only at the run's actual terminal event.
Use a compact activity row, restrained loading motion, smooth expansion and a clear transition to the result. Drive these behaviors with actual execution events, not a timed demonstration or fabricated answers.
Expose retry or correction where it can succeed. A tool name understandable only to developers should be mapped to a clear user action.

## Artifacts and domain tools
For outputs needing refinement, create an editable artifact beside the conversation or in a linked view: document, comparison, schedule, design, table or other domain result. Use an editor suited to the output instead of forcing everything into Markdown.
A tool may return a typed domain result rendered as a custom interactive block. Choose its structure and controls from the approved task; text, images and downloadable files are not the only possible outputs. Render actual saved identifiers/state, not a model-invented path or detached imitation of the result.
Both chat tools and other screens operate on the same authorized records and current artifact version. User edits become input to the next operation. Saving, exporting and downstream actions use the selected/current version, not the original generated text.
For the central artifact, support selecting the relevant part and requesting a change in that context when appropriate to its format. Bind the operation to the selection and current version, preserve unrelated content and edits, and expose useful domain controls alongside natural-language requests. The user should not need to rewrite a whole prompt to adjust one meaningful part.
Artifact header contains the real title, format, save state and useful actions. Offer preview/source/diff or version selection only when relevant. Preserve selection, scroll and unsaved changes across panel transitions; show recoverable save conflicts.
On desktop, navigation, conversation and artifact may form resizable panes. On mobile use a drawer and conversation/artifact tabs or full-screen views, keeping drafts and state intact.

## Implementation boundaries
Validate tools and structured outputs server-side. Authorize every record read/write; the model does not decide permissions. Bound provider time, steps and retries. Use transaction/idempotency where actions can otherwise be duplicated.
Keep chat transport, domain tools and artifact state separate enough to reuse domain operations outside chat. Use the installed AI SDK and OpenAI Responses adapter. Read installed types or targeted official docs for unfamiliar APIs; do not invent event formats.
Reconcile persisted partial output after cancellation or disconnect; clearing the streaming buffer alone must not hide saved work. Apply events only to their matching run and branch so a late response cannot overwrite a newer edit. Check these transitions with a delayed first token, a failure before first output, repeated calls to one tool and cancellation after partial output.
