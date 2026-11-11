# Lumen Studio – VR office tour (sample)

A walkable 3-room office (reception → open workspace → meeting room) in A-Frame/three.js.
Made for a phone in a Cardboard-style headset with a Bluetooth remote. Static site, no build step.

## Run

```bash
python tools/serve.py        # http://127.0.0.1:8080  (add ?debug=1 for fps / input overlay)
```

Deploy: upload the folder as-is to any static HTTPS host (Vercel, Netlify, GitHub Pages).
VR on a phone needs HTTPS.

## Controls

| Input | Action |
|---|---|
| Head / drag | look (movement follows where you look) |
| Left stick, d-pad, WASD, arrows | walk (1.5 m/s, walls and furniture block you) |
| Aim at a ring, then A / Enter / Space / tap | teleport (fade-blink) |
| 1–7 or the on-screen chips | jump to a spot |

`?debug=1` shows fps, draw calls, triangles and every axis/button/key the remote sends.
That is how to find out what the Irusu remote reports.

## Files

- `js/tex.js`    procedural PBR textures + the bake/load step
- `js/geo.js`    geometry helpers; merges everything into ~30 meshes (one per material)
- `js/office.js` rooms, furniture, lights, spots, collision boxes
- `js/nav.js`    walk, collide, teleport, comfort vignette, HUD, debug overlay
- `assets/tex/`  baked textures (2.4 MB). Regenerate with `?bake=1` on the dev server.

## Budget (measured on desktop; confirm on the phone)

~78k triangles, ~60 draw calls, 5 lights (3 on mobile), one static 4096/2048 sun shadow map
rendered once, no post-processing. Quality tier follows the user agent; force with `?q=low`.

## Swapping in the real office

Replace the procedural rooms with a scanned GLB (Draco/meshopt + KTX2, baked lighting) and a
separate invisible collision mesh; keep `nav.js`, the spots list and the HUD as they are.
