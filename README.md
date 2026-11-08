# Baby Chicken Empire

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

### Growing up

Babies in your nursery slowly grow up (about seven minutes of being tame), getting bigger as they go. Grown-ups leave **gifts** on the ground now and then; walk over one to pick it up.

| Baby | Grows into | Gift |
|---|---|---|
| Chick | Hen | **Egg**: throw it and a tame chick hatches where it lands |
| Calf | Cow | **Milk**: throw it near a baby in your nursery; it drinks it and grows a quarter of the way up |
| Piglet | Pig | Digs up 2 **apples** |
| Lamb | Sheep | 2 **wool**, a soft building block |
| Wolf pup | Wolf | Guards the nursery: chases off foxes and nips snakes into confetti (two nips) |

Foxes and snakes don't go after grown wolves. Growth, gifts lying on the ground and grown-ups all save, and guests see them too.

## Collecting and crafting

- A new world starts with 10 seeds and the toy sword. Everything else you collect.
- Hold to **dig** a block and it goes in your bag. Grass gives dirt (and sometimes seeds, wheat or clover), stone gives cobble, leaves can drop apples and sticks, and dirt now and then hides a bone.
- The hotbar shows how many you have. Placing a block or throwing a treat uses one up; the sword is never used up. Things you've run out of go grey.
- Open the **bag** (top right, or E). **Your things** shows what you carry: tap one to put it in the selected hotbar slot. The other tabs (**Wood & tools**, **Farm**, **Building**) show picture cards of what you can make; a yellow dot means a tab has something ready. Each card shows what it needs (have / need).
- Tap **Make** for one batch, **hold** it to keep making, or tap **All** to use up everything you have.
- Things marked * need a **crafting table** within 4 blocks. Make the table from 4 wood and place it.

| Make | From |
|---|---|
| 4 Wood | 1 Log |
| 4 Sticks | 2 Wood |
| Crafting table | 4 Wood |
| Sword * | 2 Wood + 1 Stick |
| 3 Ladders * | 7 Sticks |
| 4 Fence * | 2 Wood + 2 Sticks |
| 1 Gate * | 2 Wood + 4 Sticks |
| Feeder * | 3 Wood |
| Hay | 4 Wheat |
| 3 Seeds | 1 Wheat |
| Glass | 2 Sand |
| Brick | 2 Clay |
| 2 Wall | 1 Sand + 1 Clay |
| 2 Roof | 1 Brick + 1 Wood |
| Lamp * | 1 Glass + 1 Stick + 1 Apple |
| Planter * | 3 Wood + 2 Dirt |
| Door * | 3 Wood + 1 Stick |
| House kit * | 20 Wood + 2 Glass + 1 Lamp |
| Water | 2 Snow |
| 2 Mud | 2 Dirt + 1 Water |

- **Fences** join up with each other, gates and solid blocks. **Gates** turn to line up with the fence; tap one to open or shut it. Animals and foxes can't get past either.
- **Ladders** lean on the wall beside them. Walk into one (or press jump) to climb; let go to slide down slowly.
- **Feeders:** place one, then hold a treat and tap the feeder to fill it (uses 5). While a baby that likes that treat is nearby, the feeder puts a treat on the ground beside it, until it runs empty (about 8 treats). Crows like feeders too!
- Worlds saved before crafting existed get a generous starter bag.
- A visitor in Play together brings their own bag and takes home what they collected.

## Goals

- The star line under the nursery counters shows your **next goal** (tap it to see them all in the bag's **★ Goals** tab).
- Goals lead from digging your first blocks to chopping a tree, building a crafting table, penning your babies in with fences and a gate, filling a feeder, climbing a ladder, bonking a raider, keeping the nursery safe for a night, watching a baby grow up, picking up gifts from the grown-ups and growing to 37 chickens.
- Each goal gives a reward (seeds, wheat, apples, bones, wood, a gate, hay or lamps) when you finish it.

## Flowers

- Red, yellow and white **wild flowers** grow in clumps on the grass. Dig one to pick it, and place it anywhere to plant it. You can walk through them.

## Planters, pets and photos

- A **planter box** grows wheat: tap it while holding seeds to plant them. The wheat sprouts, grows and turns golden over about two minutes (the host's game grows it). Tap it when it's golden for 2 wheat and 1–2 seeds.
- **Pet** a baby in your nursery by tapping it (not while holding a treat or the sword): hearts, a happy hop, and a small push towards growing up (once every 20 seconds per baby).
- The **camera** button takes a photo of your world with a "Day N" label, and shares it (phones) or downloads it.
- Each sunrise says which day it is.

## Names, rain and rainbows

- Every baby gets a name when it's born (from a list of 45 in `js/animals.js`). Toasts use it: "Pudding the lamb grew up into a sheep!", "Jellybean the wolf pup loves that!".
- **Rain** comes now and then (about 1–2 minutes, every 3–8 minutes; the host decides). The sky greys, drops fall and stop on roofs, and planter wheat grows 2.5× faster. When a shower ends by day, a rainbow shows opposite the sun for about 45 seconds. Code: `js/weather.js`.
- More than 35 m from your tame babies, a **Nursery** tag at the screen edge points the way back.

## Wardrobe: your name and clothes

- **Wardrobe** (front screen or pause menu) sets your name (up to 14 letters; blank uses Lachie or Charli), who you are, and your outfit. The camera swings round so you see yourself; drag to turn, **Photo** takes a portrait, **Surprise me!** picks a random outfit.
- Outfits: top (T-shirt, stripes, hoodie, dress), bottoms (shorts, trousers, skirt; hidden with a dress), hat (none, cap, beanie, bow, flower), shoe colour and bag on or off, from 12 colours. Each character keeps its own outfit.
- An outfit is 8 small numbers (`[top, colour, bottoms, colour, hat, colour, shoes, bag]`, see `DEFAULT_FIT` in `js/models.js`). Each character-and-outfit is built as its own model the first time it's seen. Names and outfits travel with player poses in play together.
- Later: clothes to craft, in more designs.

## Version and what's new

The front screen shows the version number. Tap it, or open **What’s new**, for the change log. It lives in `js/version.js` (and [CHANGELOG.md](CHANGELOG.md)). To release: bump `VERSION`, add an entry at the top of `CHANGES` and in CHANGELOG.md, and set `CACHE` in `sw.js` to the same number.

## Doors and houses

- **Doors** are two blocks tall (put one down where there are two blocks of room). Tap either half to open or shut it. Babies, foxes and snakes can't get past a shut door; dig it to pick it back up.
- A **house kit** builds a 5×5 cottage where you put it down, its door facing you: cream walls with log corners, glass windows, a lamp, a plank floor and a red gabled roof. The walls are too tall for the snake, so babies shut in a house are safe at night.

## Day raiders

- **Foxes** sneak up on your tame babies by day. One that reaches a baby spooks it out of the nursery. Babies run from a fox that gets close. Foxes hop up natural ground but can't climb anything you've built, so a fence keeps them out; one that spends ages bumping into fences gives up and goes home. Two sword bonks and a fox poofs, dropping **2 bones** for whoever bonked it.
- **Crows** swoop down on treats lying on the ground, peck for a moment, then fly off with them. One bonk while it pecks and it poofs, dropping **4 seeds**.
- Raiders go home at dusk, when the snake takes over.

## Night and the block snake

A full day lasts 10 minutes: about 6 minutes of daylight, a pink dusk, roughly 3 minutes of night under the square moon, then sunrise.

- At night the babies doze off, and a big green and purple striped **block snake** (taller than the babies) slithers towards your nursery (one snake at first, up to four on later nights).
- If it reaches a baby, the baby is spooked out of your nursery and runs off. Feed it again to bring it back. Babies run from a snake that gets close.
- Snakes slither over a **one-block fence** but not a **two-block wall**.
- Pick the **toy sword** and tap (or click) to swing. Two bonks and the snake poofs into confetti cubes.
- At sunrise any remaining snakes leave. Lamps stay bright at night.
- **Kinds of snake** (`SNAKE_KINDS` in `js/snakes.js`). A new kind joins each night, and a newly unlocked kind comes first that night:
  - Night 1: **block snake** (green and purple) and **poison snake** (purple and lime). The poison snake leaves a trail of green goo from its tail that lasts 5 seconds. Babies that step in it run off; it slows you to 40% speed.
  - Night 2: **flying snake** (sky blue, white wings). Flies about 4.5 blocks up over fences and walls, then swoops down when it's close to a baby. Bonk it when it comes low.
  - Night 3: **digger snake** (clay orange, yellow hard hat). Chews a two-high tunnel through any wall in its way instead of going round. Three bonks.
  - Night 4: **boom snake** (red and black, with a fuse). Stops next to a baby (or you) and fizzes for 1.8 seconds, then goes BOOM: blocks within about 2.5 blocks are blasted away, babies within 6 run off, and you're blown back. A bonk while it fizzes puts the fuse out.
- Blocks chewed or blasted go through `smashBlock` in `main.js`, so they save and reach other players. Bedrock and water can't be broken.

## Chicken king

- Keep every baby safe through a whole night (or raise 100 chicks) and at sunrise you earn the **gold crown** (shown at top left) and a **hay bale throne** on your hotbar.
- Place the throne: it builds a red-cushioned seat with a hay back (facing you) and arms.
- Tap the throne to sit. Every baby in your nursery nearby gathers in rows in front of it, hopping and wagging. Walk or jump to stand up.

## Play together

- Pick **Lachie** or **Charli**, your name and your clothes in the **Wardrobe** (front screen or pause menu). That's how other players see you.
- One player opens **Play together** and taps **Host my world** to get a four-letter room code.
- Friends (up to three) type the code and tap **Join**. They arrive in the host's world, next to the host.
- When another player is off screen, their name tag sits at the screen edge with an arrow pointing their way and how far off they are.
- Everyone shares the nursery, treats, blocks, day and night, and the snakes. The host's device runs the animals and snakes, so the host keeps the game open.
- A visitor's own world isn't touched; **Leave** takes them back to it.
- Needs the internet: the free PeerJS service introduces the devices, then game data goes directly between them (WebRTC).

## Controls

| Phone | Keyboard / mouse |
|---|---|
| Drag left side: walk (push far to sprint) | WASD, Ctrl to sprint |
| Drag right side: look | Mouse (click to capture) |
| Tap: place block / open gate · Hold: dig | Right click: place · Left hold: break |
| ⬆ jump / fly up, ⬇ fly down, **Fly** toggle | Space, Shift, F |
| Hotbar tap, bag button | 1–9, wheel, E |

## Code map

| File | What it does |
|---|---|
| `js/main.js` | Boot, game loop, chunk streaming, break/place, menus, saving |
| `js/world.js` | Chunk storage, terrain/caves/trees generation, player edits |
| `js/mesher.js` | Turns chunks into triangles, with rounded block edges and ambient occlusion |
| `js/animals.js` | Baby animal behaviour: species table, wandering, treats, taming, breeding, hay and mud habits, pens, growing up, gifts, wolf guards |
| `js/raiders.js` | Daytime foxes and crows: sneaking, stealing treats, fences, sword hits |
| `js/goals.js` | The goals list, progress and rewards |
| `js/version.js` | Version number and the change log shown in What’s new |
| `js/weather.js` | Rain showers, rain drops and the rainbow |
| `js/crafting.js` | What digging gives you, crafting recipes, starter bag |
| `js/snakes.js` | The night snakes and their kinds (poison goo, flying, digging, boom): spawning, slithering body, spooking babies, sword hits, confetti |
| `js/sky.js` | Day/night clock: sky colours, light tint, sun and moon |
| `js/net.js` | Play together: room codes, hosting and joining (PeerJS / WebRTC) |
| `js/models.js` | Rounded-box 3D models for the babies, Lachie and Charli in their outfits (clothes list and `kidModel`), and treats (with leg, head and tail rigs), treat icons, counter faces |
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
