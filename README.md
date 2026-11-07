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

## The nursery

Based on the music video *Baby Chicken Empire*: build a nursery for baby animals.

| Baby | Favourite treat | Habit |
|---|---|---|
| Chick | Seeds | Pecks about, flaps when excited |
| Calf | Wheat | Munches beside **hay** blocks |
| Piglet | Apple | Rolls in **mud** (lowland mud patches, or place the Mud block) |
| Lamb | Clover | Bounces like a fluffy little stone |
| Wolf pup | Bone | Wags its tail when you're near or holding a bone |

- Pick a treat on the hotbar. Babies of that kind within ~14 blocks follow you while you hold it.
- **Tap** (right click on desktop) to throw it. A baby that eats its treat joins your nursery (the counters at top left).
- Two fed babies of the same kind pair up and **make a new baby**. Each needs about 25 seconds before it can do that again.
- Animals hop up natural steps, but can't climb **wood, logs, hay, walls, roof, glass or brick**. A one-block fence keeps them in.
- Milestones at 10, 37, 67 and 100 chicks, the first of each other baby, and a full set of all five quote the song.

## Night and the block snake

A full day lasts 10 minutes: about 6 minutes of daylight, a pink dusk, roughly 3 minutes of night under the square moon, then sunrise.

- At night the babies doze off, and a green and purple striped **block snake** slithers towards your nursery (one snake at first, up to four on later nights).
- If it reaches a baby, the baby is spooked out of your nursery and runs off. Feed it again to bring it back. Babies run from a snake that gets close.
- Snakes slither over a **one-block fence** but not a **two-block wall**.
- Pick the **toy sword** and tap (or click) to swing. Two bonks and the snake poofs into confetti cubes.
- At sunrise any remaining snakes leave. Lamps stay bright at night.

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
| `js/animals.js` | Baby animal behaviour: species table, wandering, treats, taming, breeding, hay and mud habits, pens |
| `js/snakes.js` | The night snake: spawning, slithering body, spooking babies, sword hits, confetti |
| `js/sky.js` | Day/night clock: sky colours, light tint, sun and moon |
| `js/models.js` | Rounded-box 3D models for the babies and treats (with leg, head and tail rigs), treat icons, counter faces |
| `js/audio.js` | Synthesized cheeps, moos, oinks, baas, yips and sound effects |
| `js/renderer.js` | WebGL2 shaders, texture array, frustum culling, water pass, block outline |
| `js/player.js` | Movement, collision, swimming, flying, voxel raycast |
| `js/input.js` | Touch joystick/look/tap/hold and keyboard/mouse |
| `js/textures.js` | Procedurally painted 16×16 block textures and hotbar icons |
| `js/blocks.js` | Block definitions |
| `sw.js`, `manifest.webmanifest`, `icons/` | Installable web app (PWA) |

World edits and settings save to `localStorage` on the device.

## Later: app stores

The folder can be wrapped with Capacitor (`npx cap init`, `npx cap add ios/android`) to produce native projects. iOS builds need a Mac with Xcode and an Apple Developer account; Android needs Android Studio and a Play Console account.
