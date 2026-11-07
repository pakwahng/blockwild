# Blockwild

An original voxel sandbox for phones (iOS and Android) and desktop browsers. Plain WebGL2 + ES modules, no build step, no dependencies.

## Run locally

```bash
powershell -NoProfile -ExecutionPolicy Bypass -File tools/serve.ps1
```

Then open http://localhost:8080. (In Claude Code the `blockwild` entry in `.claude/launch.json` does the same.)

## Play on a phone

The service worker and "Add to Home Screen" install need **HTTPS**, so the easiest route is to host the folder on any static host (GitHub Pages, Netlify, Cloudflare Pages) and open the URL on the phone:

- **iPhone (Safari):** Share → Add to Home Screen. It opens full screen like an app.
- **Android (Chrome):** menu → Install app.

## The nursery (chicks)

Based on the music video *Baby Chicken Empire*: build a nursery for baby chicks.

- Pick the **seed pouch** (first hotbar slot). Chicks within ~14 blocks follow you while you hold it.
- **Tap** (right click on desktop) to throw seeds. A chick that eats a seed joins your nursery (the counter at top left).
- Two fed chicks find each other and **hatch a baby chick**. Each chick needs about 25 seconds before it can do that again.
- Chicks hop up natural steps, but can't climb **wood, logs, hay, walls, roof, glass or brick**. A one-block fence keeps them in.
- Milestones at 10, 37, 67 and 100 chicks quote the song.

## Controls

| Phone | Keyboard / mouse |
|---|---|
| Drag left side: walk (push far to sprint) | WASD, Ctrl to sprint |
| Drag right side: look | Mouse (click to capture) |
| Tap: place block · Hold: break | Right click: place · Left hold: break |
| ⬆ jump / fly up, ⬇ fly down, **Fly** toggle | Space, Shift, F |
| Hotbar tap, ▦ for all blocks | 1–9, wheel, E |

## Code map

| File | What it does |
|---|---|
| `js/main.js` | Boot, game loop, chunk streaming, break/place, menus, saving |
| `js/world.js` | Chunk storage, terrain/caves/trees generation, player edits |
| `js/mesher.js` | Turns chunks into triangles, with rounded block edges and ambient occlusion |
| `js/chicks.js` | Chick behaviour: wandering, following seeds, eating, hatching, pens |
| `js/models.js` | Rounded-box 3D models for chicks and seeds, seed pouch icon |
| `js/audio.js` | Synthesized cheeps and sound effects |
| `js/renderer.js` | WebGL2 shaders, texture array, frustum culling, water pass, block outline |
| `js/player.js` | Movement, collision, swimming, flying, voxel raycast |
| `js/input.js` | Touch joystick/look/tap/hold and keyboard/mouse |
| `js/textures.js` | Procedurally painted 16×16 block textures and hotbar icons |
| `js/blocks.js` | Block definitions |
| `sw.js`, `manifest.webmanifest`, `icons/` | Installable web app (PWA) |

World edits and settings save to `localStorage` on the device.

## Later: app stores

The folder can be wrapped with Capacitor (`npx cap init`, `npx cap add ios/android`) to produce native projects. iOS builds need a Mac with Xcode and an Apple Developer account; Android needs Android Studio and a Play Console account.
