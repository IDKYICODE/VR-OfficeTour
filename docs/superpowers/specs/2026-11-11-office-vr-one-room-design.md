# Office VR Tour: Slice 1, One Room

Date: 2026-11-11. Status: DRAFT, awaiting approval. Nothing built yet.

## Intent and why

Build a walkable VR tour of a real office that feels like standing in it, not like a game level. Viewers use a phone in a Cardboard-style headset with a Bluetooth remote, on a public website. The earlier Gurukul VR classroom/theater (A-Frame, flat-color primitives) proved the input and delivery stack but looked like a prototype. This project keeps that stack and raises the visual quality to "recognisably the real room".

Slice 1 is ONE room. It proves the whole pipeline (capture, model, compress, collide, teleport, deploy). More rooms are repeats of the same pipeline.

## Goals

- Real room, recognisable: real textures and baked lighting, not flat colors.
- Free-walk with the remote stick, plus teleport to named spots (e.g. "Door", "Desk area", "Window").
- Walls and furniture stop you. You never leave the room or fall through the floor.
- Comfortable in a headset: steady frame rate, no judder, gaze-relative movement.
- Deployed as a static website over HTTPS, opened in Chrome on the phone.
- Also usable without a headset (desktop WASD + mouse) so the builder can test without wearing it.

## Non-goals (for slice 1)

Multiple rooms, multiplayer/avatars, voice, AI, live data, doors that open, a minimap, iPhone support (no WebXR immersive mode in Safari), a build pipeline or framework.

## Anti-goals (failure even if it technically works)

- Looks like low-poly placeholder art.
- Stutters in stereo on the target phone, or takes more than a few seconds to start on mobile data.
- Movement that causes nausea (acceleration spikes, forced camera rotation).
- Only works on the builder's machine.

## Constraints

- Target: Nothing phone (Chrome, Android) in Irusu Monster headset, Bluetooth remote.
- Static hosting with HTTPS (Vercel/Netlify/GitHub Pages). No server.
- Download size: aim for 25 MB or less for the room; hard ceiling 50 MB.
- Render budget (guideline, tune on the real phone): about 300k triangles, 4-6 textures at 2048px or smaller, KTX2/Basis compressed textures, Draco or meshopt geometry.
- Lighting is baked into textures. Few or no real-time lights.
- Free tools only.

## Decided by the user

- Both free-walk (stick) and teleport points.
- Start with one room, then expand.
- Deployed as a website. Real-time/live features are out for now.
- Hardware: Irusu Monster headset + remote, Nothing phone.

## My calls (user can overrule)

- **Engine:** A-Frame on three.js, plain HTML + a few JS files, no bundler. Reuses the user's existing gamepad component pattern.
- **Room source:** scan the real room with a free phone app (Scaniverse, Polycam or Luma; check current free export limits) and export GLB. Fallback if the scan is poor: model the room in Blender from measurements and photos, and use photos as textures.
- **Collision:** a separate simplified invisible mesh (floor + walls + big furniture boxes). Movement is raycast against it. The visual scan is never used for collision.
- **Turning:** by head only (the user physically turns). The stick moves relative to where the head faces. No stick rotation, no snap-turn in slice 1.
- **Comfort:** constant walking speed (about 1.4 m/s), short vignette while moving, fade-blink on teleport, fixed eye height.
- **Teleport:** spots are a small JSON list (name, x, y, z, facing). Gaze at a floor marker and press the confirm button.
- **Hosting:** Vercel (user already uses it).

## Open: the remote

Unknown whether the Irusu remote reports as a gamepad (`navigator.getGamepads()`) or as keyboard/media keys. Many cheap Cardboard remotes do the latter. First deliverable is a single-file input tester that prints every gamepad axis/button and every key event. The button map (move, confirm, back) is a small config table filled in from that result. If the remote only sends keys or a screen tap, movement falls back to gaze-and-click teleport and confirm-to-step.

## Inputs needed from the user

1. The room: a slow walk-around scan with a free scanning app, GLB exported, and a few plain photos from the doorway, desk, and window for reference. A tape measure reading of room length and width helps check scale.
2. Exact remote model name, or the tester output once built.
3. Which spot names to use for teleport.

## Layout

```
office-vr/
  index.html          scene, teleport spots (data in the file)
  js/input.js         remote/gamepad + keyboard movement, button map
  js/walk.js          gaze-relative movement + collision raycast
  js/teleport.js      markers + fade-blink
  tools/input-test.html   remote tester (built first)
  assets/room.glb     visual room (compressed)
  assets/room-nav.glb collision-only mesh
  docs/superpowers/specs/ (this file)
```

## Done means (acceptance)

1. Tester page identifies the remote's input mode on the real phone.
2. Deployed URL opens in Chrome on the phone, Enter VR splits the screen, room is recognisable.
3. Stick walks; every wall and big object stops you; no falling.
4. At least three teleport spots work with a fade.
5. Stays smooth in stereo on the phone (target the screen's native refresh rate or 60 fps) and loads under the size budget.
6. Works on desktop with WASD + mouse.

## Left to the builder

File internals, exact vignette and fade values, how marker visuals look, optimisation order, compression command lines.
