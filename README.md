# IICL – VR office tour (sample)

A walkable three-room office (reception → open workspace → meeting room) in A-Frame / three.js,
with IICL branding on the signs, posters, screens and TV. Made for a phone in a Cardboard-style
headset with a Bluetooth remote. Static site, no build step.

## Run

```bash
python tools/serve.py        # http://127.0.0.1:8080  (add ?debug=1 for fps / input overlay)
```

Deploy: upload the folder as-is to any static HTTPS host (Render, Vercel, Netlify, GitHub Pages).
VR on a phone needs HTTPS. `render.yaml` is included for Render.

## Controls

| Input | Action |
|---|---|
| Head / drag | look (movement follows where you look) |
| Left stick, d-pad, WASD, arrows, on-screen joystick | walk (1.5 m/s, walls and furniture block you) |
| Aim at a ring, then A / Enter / Space / tap | teleport (fade) |
| Phone / mouse: tap a ring, a chair badge or a name | teleport / sit |
| 1–7 or the on-screen chips | jump to a spot |
| Chair badge | sit; push the stick, press A or "Stand up" to get up |
| Bulb badge by the entrance | lights on / off (fades) |
| Play badge above the meeting-room TV | next slide (5 IICL slides) |
| Pencil badge by a whiteboard | draw: drag (touch / mouse) or aim + hold the remote button (headset). Pens and eraser are on the tray |
| Paper badge in the lounge | paper toss: hold THROW (button, Space, remote) to charge, release to throw into the bin |

Badges only show when you are close, and you cannot tap through walls.
`?debug=1` shows fps, draw calls, triangles and every axis/button/key the remote sends.

## Living details

The wall clock shows your real local time, monitors scroll / animate / run a logo screensaver,
plants sway in the wind, clouds drift and a few birds cross the sky outside.

## Files

- `js/tex.js`    procedural PBR textures (colour, normal, roughness) + the bake/load step
- `js/brand.js`  IICL logo, posters, slides, monitor content
- `js/geo.js`    geometry helpers; merges everything into ~35 meshes (one per material)
- `js/shade.js`  shader patches: foliage sway, baked light
- `js/bake.js`   lighting bake (ray tracer) and its loader
- `js/office.js` rooms, furniture, materials, lights, spots, collision boxes
- `js/nav.js`    walk, collide, teleport, sit, hotspots, comfort vignette, HUD
- `js/play.js`   whiteboards and paper toss
- `js/life.js`   clock, monitors, clouds, birds
- `assets/tex/`  baked textures. Regenerate with `?bake=1` on the dev server.
- `assets/bake/` baked lighting. Regenerate with `?lightbake=1` (about 2 minutes; `?lightbake=quick` for a fast draft).
- `assets/brand/` the logo and favicon from iicl.in

## Baked lighting

Sky through the windows, the ceiling and pendant lamps and one to two diffuse bounces are computed once
per vertex (soft occlusion, colour bleed, light falling off away from windows) and stored in `assets/bake/`.
The sun stays live with a static shadow map. The light switch dims the lamp channel. If the geometry
changes, the bake no longer matches and the page falls back to realtime lights: re-run `?lightbake=1`.

## Budget (desktop measurements; confirm on the phone)

About 110k triangles and 60 draw calls, one static sun shadow map, no post-processing. Phones
(auto-detected, or `?q=low`) skip clear-coat and fabric sheen, which desktops (`?q=high`) get.

## Swapping in the real office

Replace the procedural rooms with a scanned GLB (Draco/meshopt + KTX2, baked lighting) and a
separate invisible collision mesh; keep `nav.js`, `play.js`, the spots list and the HUD.
