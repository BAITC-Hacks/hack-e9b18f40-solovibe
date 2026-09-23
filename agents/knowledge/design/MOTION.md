# Motion and response
Use movement to reveal depth, acknowledge input, explain transformation and connect states. It should feel soft and responsive without delaying the task.

## Useful defaults
| Interaction | Starting behavior |
| --- | --- |
| Press | About 100 to 140ms; subtle compression near scale .98, immediate action |
| Hover | About 160 to 220ms; material/light response, optional lift up to 2px |
| Small popover | About 150 to 200ms; opacity plus scale .97 to 1, origin at its trigger |
| Dialog/drawer | About 220 to 280ms; short travel/fade, stable focus and scroll behavior |
| Result replacement | Brief fade/layout continuity, preserving the user's reading position |
| Ambient scene | About 12 to 20 seconds for a calm coordinated light/object cycle |

A useful general easing is cubic-bezier(.23,1,.32,1). Use a gentle spring for interruptible gesture/tilt where appropriate. Exit can be faster when that makes the interface feel responsive. The values are defaults, not mandatory ceilings.

## Distinctive hover recipes
Choose a small family of responses and reuse it:
- A tactile button compresses, its upper highlight becomes quieter and its icon moves a few pixels along the action direction.
- An interactive object card keeps its text and hit target stable while the illustration tilts slightly and its light edge shifts.
- A segmented selector moves its selected background beneath stable labels instead of making every label bounce.
Use hover effects only on genuinely interactive elements. An illustration may react subtly to the pointer within its scene without pretending to be a button.
Gate ornamental pointer hover to fine pointers with hover support. Keyboard focus remains clear and actions remain immediate. Touch gets reliable press feedback, not sticky hover.

## Implementation
Use CSS transitions for reversible hover/open/press states; specify properties instead of transition: all. Start visible content normally so a failed animation cannot hide it.
Prefer transform and opacity for continuous movement. Small local color/shadow transitions are fine. For moving light, animate a bounded pre-rendered/pseudo-element layer rather than repainting huge blur filters every frame.
Use the existing Motion stack for dynamic layout/gestures, CSS for predetermined movement, GSAP only when its timeline solves a real need. One motion library is usually enough.
No window.addEventListener('scroll'), including equivalent raw window scroll listeners. Use IntersectionObserver, CSS scroll-driven animations, Motion useScroll or GSAP ScrollTrigger.
Keep decorative layers pointer-events:none. Pause ambient work outside the viewport; remove travel/parallax/loops under reduced motion while preserving usable state feedback.
Large 3D/assets should load without blocking the first usable action. A static material render is the fallback, not an empty hole. Avoid per-frame component state updates and blanket will-change.
When motion stutters, simplify the largest moving/blurred layer first. Do not perform a full performance investigation after every small effect.

## Stateful interfaces
Frequent interactions should remain quick and subtle. Reserve larger movement for meaningful transitions. Interruptible transitions continue from their current state rather than jumping back to the start.
For a popover, animate from its trigger/collision-aware transform origin. Start near full size rather than scale zero. Use layout animation only on the dimension that changes; scroll containers may need Motion layoutScroll. Keep labels and hit targets stable.
Use motion values for pointer/scroll-driven coordinates rather than React state every frame. Reuse one small family of springs/easings. Avoid perpetual motion on every card or every streamed token.
For overlays, motion and focus/scroll behavior work together. Opening/closing must remain operable with keyboard, touch and reduced motion. A transparent fallback can become opaque when reduced transparency or contrast requires it.