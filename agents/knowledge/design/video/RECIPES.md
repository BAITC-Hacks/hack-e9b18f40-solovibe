# Deterministic motion construction

Use the mechanisms that express the product action. These are construction examples, not a mandatory shot sequence. Read ANALYSIS.md for direction and ../../MEDIA.md for production and delivery.

## Camera and target geometry

For a 1920×1080 composition, let C=(960,540). With one world wrapper whose transform origin is C and transform is translate(Tx,Ty) scale(s), a world point P appears at S=C+T+s(P-C). To put P at screen anchor A, use T=A-C-s(P-C). Different transform order or nested wrappers changes the mapping; keep one pose writer and do not mix formulas. Animate the camera proxy, then apply its transform once.

Measure actual target rectangles after fonts load and the relevant layout state is settled, including wrapping and expanded panels. Bake geometry for each meaningful state; do not read DOM layout on every frame. Put cursor and targets in the same world where possible. Define cursor hotspot at its tip, not at the center of the icon. Verify the rendered tip is inside the visible control at contact, including camera, panel lift and press transforms. At maximum zoom the necessary label and result must remain within the frame.

An approach can take about 0.55s with power2.inOut, followed by a short settled contact, a 0.12s press to scale .96 and a 0.28s restrained recovery. These are starting values, not mandatory delays. Contact, state change and click transient share a timeline boundary. A cursor animation without a corresponding real state change explains nothing.

## Seek-safe state

Register a paused GSAP timeline synchronously. Use explicit initial states and fromTo tweens; later fromTo segments need immediateRender:false where early initialization would overwrite earlier shots. Every frame must be reconstructible by seeking directly to its time. No wall-clock timers, unseeded randomness, infinite CSS animations, onComplete-only DOM mutations or forward-play-only state. Prebuild layers and schedule visibility/state on the timeline. Test both forward and backward seeks across every handoff.

## Typing with a following camera

Split text into graphemes and measure prefix advances in the actual font, including kerning. Keep the line origin fixed. Let p be continuous typing progress, n=floor(p), and w=advance[n]+(advance[min(n+1,N)]-advance[n])*(p-n). This interpolates camera movement even when characters reveal discretely. A caret can remain ahead of the final visible glyph while the camera smoothly follows the typing frontier.

For the camera convention above, to start the line at screen x=600, use baseX=600-960-s*(textX-960). The projected caret is 960+baseX+s*(textX+w-960). Keep cameraX=baseX-max(0,caretScreen-1280); cameraY=600-540-s*(textY-540). Adapt anchors to the actual composition. The camera begins following only after the caret reaches its anchor; it must not jump on every letter. Finish by revealing the complete useful phrase or carry its final word/capsule into the next surface.

## Hover lift, press and layered depth

Keep the source interface and its slot visible. Separate placement, elevation, press and shadow into nested wrappers so transforms do not compete. For lift progress q, a useful starting pose is scale=1+.12q and dy=-18q. Increase the diffuse shadow as separation grows while retaining a softer contact cue. Do not blur the selected text.

For a lifted box and normalized contact u,v, contactX=box.x+box.w/2+(u-.5)*box.w*scale; contactY=box.y+box.h/2+(v-.5)*box.h*scale+dy. Put press transform-origin at that same u,v so the target does not slide away from the cursor. A one-shot ripple or brief compression reinforces contact; the meaningful response is the changed result that follows.

## Panels and results

Create the expanded sheet at final size, reveal it through a mask and move following content with the same progress. For example, translate sheet and dependent content from -280px to 0 over roughly .48s with power3.out. Avoid stretching text or animating layout width/height continuously. If a surface must scale, inverse-scale content from the same progress or reveal the full-size content under a mask.

The control and its consequence use one authoritative progress/state table: a changed filter changes the shown records, an edit changes the artifact, a selection changes the comparison. Show the specific result, not a generic success badge in place of output.

## Drag and selected-object extraction

Object and cursor share progress and a fixed grab offset. The destination makes room; neighbors move when the dragged center crosses the reorder threshold. Do not move the cursor independently and hope it aligns.

A flight copy starts with matching world rectangle, content, crop, radius and shadow. Exchange source/copy opacity at a scheduled boundary, without callback reparenting. A flight might travel x=240,y=-120, scale=1.6, rotation=-5 over .8s; derive the actual pose from its destination. Before replacing the copy with the destination component, match position, scale, rotation, crop and velocity. Preserve aspect ratio with masks rather than squashing content. The object should visibly retain identity throughout.

## Parallax unzoom

Begin with one readable focal result filling the frame; reveal that it occupies an off-center slot in a larger useful arrangement. For a final box center (cx,cy), with aspect ratio matched to the frame, startScale=1920/box.width. For p from 0 to 1, transform it with translate((960-cx)*(1-p),(540-cy)*(1-p)) scale(1+(startScale-1)*(1-p)). Transform origin is the box center.

Neighbor layers use their own authored offsets dx*(1-p),dy*(1-p), scale .8+.2p and opacity p. Keep the focal layer opaque above them until the composition resolves; avoid fading away the result being explained. Verify endpoints and midpoint. As the larger arrangement becomes readable, a selected object can start the next action. Depth comes from unequal travel and occlusion, not merely zooming out a flat screenshot.

## Perspective flight and joins

Use a fixed-perspective outer wrapper and a preserve-3d world with one translate3d/rotateX/rotateY pose. A restrained dive might reach rotateX(12deg), rotateY(-16deg), then flatten for reading. Avoid opacity, filters and clipping on the preserve-3d ancestor because they can flatten its descendants. Clip on an outer frame and apply filters to leaves.

For travel progress p, smoothstep q=p*p*(3-2*p) is useful for a complete rest-to-rest move. A continuous seam must preserve position and velocity instead of easing both halves to a stop. Directional blur can peak at 4*p*(1-p)*strength and vanish at rest; keep readable content sharp during comprehension. Synchronize an airy travel accent to the fastest part, not simply the start of the file.

## Typography and connecting surfaces

- A changing word uses a stable grid sized for the widest word, with a capsule background and masked vertical exchange. Keep fixed prefix/suffix stable; the final capsule can become a control in the next shot.
- A type match transition preserves a word or split phrase while its surrounding surface grows into the next composition. Separate a quick transformation from the reading hold.
- A typographic wall can occlude the whole frame; exchange the underlying scene only while fully covered, then reveal the continuing object. A dissolve between unrelated layouts is not equivalent.
- A perspective marquee separates the rotated perspective wrapper from its translating strip. Use it to communicate breadth, not decorative filler.
- A layered fan should reveal distinct useful states/results, rather than merely display devices.
- An outro can combine a readable action capsule, a restrained press/ripple and a crisp product mark. If text dissolves into particles, use seeded glyph samples and finish on readable content rather than an empty frame.
- An accent word or highlighted phrase can be typographically effective without applying a stagger entrance to every line.

## Passage and export checks

An illustrative connected passage: establish context, approach a specific control, type/press, expand the response, reveal output, refine it, lift the selected result, then carry it into the next context. Overlap supporting motion while preserving cause and effect. Do not apply fixed timings to all products.

Inspect start, contact, maximum zoom, expansion, extraction seam and end in both seek directions. Then watch at normal speed with sound. Verify readable encoded text, correct cursor contact, useful result, retained spatial context and clean joins. A correct timeline or attractive still frame is not proof that the exported movement communicates the product.
