# Product UX
## Organize around the job
The first screen tells the user what they can accomplish and gives them an obvious starting action. Prefer a useful input/action area over an empty dashboard. The distinctive capability must be easy to reach in a fresh session.
Build navigation around the approved suite's actual tools and tasks. Keep shared project/context visible as users move between them; pass results into the next capability without asking users to re-enter the same data. Give meaningful functions their own view when helpful, and group secondary controls so breadth stays understandable.
Keep one primary action in each local decision area. Secondary actions have quieter visual weight. Preserve the input/context near the result so users can understand what changed and refine it.

## Complete states
For the core screen, implement empty, entered, pending, success and likely failure states as one component flow.
Empty state explains what to enter and why. An example input is allowed if it is clearly an example and goes through the same real processing; a canned successful output is not.
Keep visible labels and concise format hints. Validate near the relevant field. Preserve input on failure and provide the actual next action or retry.
During a real request, prevent duplicate submission, retain context and show readable pending feedback. Report real phases only when available. Do not invent progress percentages or wait artificially for an animation. Cancellation is useful when the underlying operation can actually be cancelled.
On success, emphasize the useful result and its next action. Save/export/copy must operate on that actual result. Avoid a celebration overlay that hides it.
For AI output, expose source material, uncertainty or editable suggestions where the task needs them. A polished interface must not imply more certainty than the data provides.

## Interaction and layout
Offer a visible language selector using «Русский», «Қазақша» and «English». Switching language preserves the current task and data. Translate every screen and interaction state; allow text to wrap/grow naturally in all three languages. AI follows the user's language and request; interface switching preserves existing content.
Use semantic buttons, links, labels and native or established accessible controls. Visible keyboard focus and readable names for icon-only actions are part of the component, not a separate audit.
Aim for comfortable 44px hit areas and 16px body text on small screens. Hover enriches feedback; it never reveals the only way to perform an essential action.
Keep primary text readable over its actual background, including glass/light. Reserve space for images and asynchronously loaded content so the page does not jump.
On a narrow screen, preserve the journey order and important action. Stack input/result clearly, reduce ornament, and keep menus/overlays within the viewport. Do not hide required functionality to make the layout fit.
Use tables for real comparisons, lists for scanable sequences and cards for distinct objects/actions. Avoid putting every sentence into a box or forcing functional data into a carousel.
An interactive chart needs real data and readable units/labels. A thematic 3D illustration is artwork, not a fake product dashboard.

## Finish the journey
A focused pass follows the actual user path: understand, enter, act, wait, use result, recover from error. Fix friction you observe. Do this after a coherent screen or feature, not after every style edit.
