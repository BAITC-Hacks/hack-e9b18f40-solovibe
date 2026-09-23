# Design system

## Purpose
Use this visual specification to build an original product identity, composition and interface for the approved case. It defines material, typography, geometry and behavior, not a prescribed screen or feature set. Read DIRECTION.md for dimensional art construction, UX.md for flows, MOTION.md for interaction and COPY.md for language.

The interface supports ru/kk/en, starts in Russian and retains a persistent language selector. Product-specific hierarchy and user tasks determine layouts. Build the shared primitives once before parallel screen work.

## Color and material
Light porcelain, deep green ink and expressive teal form the palette. Consistent edge thickness, contact shadows and directional light create depth. Text stays primary in work areas.

| Token | Value | Use |
| --- | --- | --- |
| canvas | #EEF3EF | Background plane |
| surface | #FBFDFB | Opaque readable surface |
| inset | #E8EFEB | Recessed control areas |
| ink | #183C39 | Primary text and icons |
| muted | #5B7069 | Secondary text |
| accent | #087F6F | Primary action, selection and focus |
| accent-dark | #08695C | Accent action text |
| accent-soft | #D7EEE5 | Quiet accent background |
| line | #D4DFD9 | Dividers and surface boundaries |
| danger | #B13F39 | Error/destructive action |
| success | #26714C | Success |
| warning | #845319 | Review required |

Controls need a defining border: #7C9186 on #F2F6F2 is a starting pair. The faint decorative line is insufficient for this purpose. A primary button can use #0E8373 → #08796A → #087061 to depict directional light across one material. Use words and optionally icons alongside status color. Check contrast for new combinations, including focus and disabled states.

Porcelain surfaces are almost opaque with a white upper edge and diffuse shadow. Inputs are slightly recessed, with a visible boundary. Teal enamel has dense color and a controlled highlight. Glass belongs to selected floating layers where seeing the background is meaningful; reading areas remain calm. A deep ink section can create a distinct context without implying an entire dark theme.

## Typography
Use locally served Onest Variable with system-ui, sans-serif fallback. Include Latin, Cyrillic and Cyrillic Extended, including Ә Ғ Қ Ң Ө Ұ Ү Һ І. Typical weights are 400, 500, 550 and 600.

| Role | Size / line-height | Weight |
| --- | --- | --- |
| Hero | 38–61px / 1.06 | 600 |
| Section heading | 28–34px / 1.16 | 600 |
| Card heading | 17–20px / 1.2 | 550–600 |
| Reading text | 16px / 26px | 400 |
| Compact shell | 13–15px / 1.5–1.6 | 400–550 |
| Field label | 14px / 20px | 550 |
| Hint | 12–14px / 1.5–1.7 | 400 |

Large headings may use tracking down to -.045em and text-wrap:balance. Body tracking remains normal. Preserve user line breaks and wrap long values. Allow longer Russian/Kazakh labels to expand rather than hiding meaning to force equal heights. Locale changes preserve user content, route and drafts.

## Geometry and responsive composition
Use spacing 4, 8, 12, 16, 20, 24, 32, 40, 48 and 64px. Related controls use 8–12px gaps, groups 16–24px and independent regions 24–40px.

| Element | Starting geometry |
| --- | --- |
| Main surface/card | 28px radius, 24–30px padding |
| Inner surface | 20–22px radius |
| Field | 14px radius, at least 48px height |
| Button | 12–17px radius, at least 44px height |
| Navigation row | At least 48px height, 16px radius |
| Modal | Up to 560px width, 28px radius |
| Side panel | Up to 430px width, 12px viewport inset |
| Popover | Up to 340px width, 20px radius |

Icon targets are at least 44×44px. Labels belong to checkbox/switch targets. Do not fix widths that obstruct translation. Choose navigation according to the domain: a desktop sidebar can become a compact rail and then a mobile drawer, but a sidebar is not mandatory. Preserve all meaningful actions on narrow screens. Use bounded scrolling for long panels and keep actions reachable.

The primary message/action precedes decorative art in reading order. On mobile reduce secondary objects and move the focal art below text rather than shrinking an entire desktop collage. Language selection remains legible and keyboard accessible in every layout.

## Light, depth and transparency
Light falls from upper-left. Keep the bright upper edge, short dense contact shadow and broad weak lower shadow consistent. Suggested CSS shadow values:

- Card: 0 2px 3px #1b453b06, 0 12px 32px -18px #1b453b2e, inset 0 1px 0 #ffffff.
- Floating layer: 0 2px 5px #153e3912, 0 22px 60px -16px #153e3933, inset 0 1px 0 #ffffff.
- Button: 0 2px 2px #123e2e17, 0 5px 10px -4px #123e2e29, inset 0 1px 0 #ffffff.

Give hero objects actual apparent thickness and appropriate contact shadows; do not emboss every work block. Glass may begin at 88% opacity with local blur up to 16px and a light rim. Avoid strong blur behind large reading areas; support an opaque alternative. Use CSS for simple tilted solids/layers, SVG for controlled geometry, and actual rendered artwork or 3D when complex curvature/refraction requires it.

## Functional components
Build semantic, reusable controls with complete normal, hover, focus, pressed, disabled, loading and error states. A disabled action needs an understandable reason where that reason is not obvious. Labels remain visible; invalid input receives field-level feedback and focus when submitting. Pending state prevents duplicate action without losing entered values.

Tabs preserve content/state and communicate selection. Menus handle keyboard navigation, collision and outside dismissal. Dialogs trap focus, support Escape where appropriate, return focus to the trigger and fit small screens. Confirm destructive operations according to their consequence, with clear object names and real cancellation.

Search shows actual results, empty and failure states with removable filters. Toasts are brief secondary feedback, never the only place a critical error or resulting artifact appears. Distinguish selected, disabled, loading and saved states visually and semantically.

AI activity shows actual operations and outcomes, not invented reasoning or percentages. Streaming output remains readable; saved editable results use authoritative current content. On submission, show the user's input immediately and reconcile the server response without duplicates. Use CHAT.md where conversation is appropriate; the product may use a different task-specific interface.

## Motion and performance
Use coordinated transform/opacity motion; a useful ease-out is cubic-bezier(.23,1,.32,1). Starting timings: press 110ms with scale .98 and 1px travel; hover 180ms with 2px lift; popover 180ms in/130ms out from scale .97; dialog 260ms in/180ms out with 14–24px travel; toast 240ms in/160ms out. Tune to actual distances and input, not ceremony.

Keep interactive text and hit targets stable. Pointer tilt belongs only to fine-pointer decorative surfaces, with no React state update per animation frame. Pause ambient loops offscreen and remove them under reduced motion. Reduced motion retains immediate state feedback. Lazy-load heavy visuals, use responsive asset sizes and keep primary content/actions usable before decoration is ready. Performance must not remove functionality or reduce result quality.
