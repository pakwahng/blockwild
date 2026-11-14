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

Foxes and snakes don't go after grown wolves. A wolf chases no more than about 20 blocks from where it was, then trots back. Growth, gifts lying on the ground and grown-ups all save, and guests see them too.

### Jobs: training grown-ups to help

Tap a grown-up (hen, cow, pig, sheep or wolf) to pet it and open **Teach a job**. Teaching costs one of its favourite treats from your bag; stopping (**Just play**) is free.

| Job | What it does | Brings you |
|---|---|---|
| Fetch wood | Walks to a tree trunk near you and pecks or butts at it | 1 **log** |
| Fetch stone | Finds bare rock out in the open (not down caves) and chips at it | 1 **cobble** |
| Find seeds | Scratches about on a grassy patch | 2 **seeds** |
| Follow me | Trots after you everywhere, day and night, finding a way round things; sits by you when you stop, and catches up if you get far ahead | (a friend!) |

- Workers only work by day. They look for work within about 18 blocks of whoever taught them, find a way there round hills, fences and water, work for a few seconds, then carry the log, cobble or seeds home on their back and drop it at your feet. Then they have a short break and go again.
- The block stays put: they gather from the tree or rock, they don't knock it down.
- If one can't find anything, or can't find a way to it, it tells you. If it can't get any closer to you while carrying something, it leaves it on the ground for you.
- Jobs save. In play together a guest can teach a job too, and that animal brings things to the guest.

## Collecting and crafting

- A new world starts with 10 seeds and the toy sword. Everything else you collect.
- Hold to **dig** a block and it goes in your bag. Grass gives dirt (and sometimes seeds, wheat or clover), stone gives cobble, leaves can drop apples and sticks, and dirt now and then hides a bone.
- The hotbar shows how many you have, and picking a slot shows its name and count above the hotbar for a moment (`#slot-name`). Placing a block or throwing a treat uses one up; the sword is never used up. Things you've run out of go grey.
- Open the **bag** (top right, or E). **Your things** shows what you carry: tap one to put it in the selected hotbar slot. The other tabs (**Wood & tools**, **Farm**, **Building**) show picture cards of what you can make; a yellow dot means a tab has something ready. Each card shows what it needs (have / need).
- Tap **Make** for one batch, **hold** it to keep making, or tap **All** to use up everything you have.
- Things marked * need a **crafting table** within 4 blocks. Make the table from 4 wood and place it.
- Things marked † are food: cook them at a **campfire** within 4 blocks (see Cooking below).
- **Learning recipes:** a new world knows only how to make wood, sticks, the crafting table, fences, seeds and hay. Everything else you learn first:
  - **Recipe pages** turn up now and then when you dig (leaves 3%, clay 3%, stone 2.5%, sand and snow 2%, grass 1.5%, dirt 0.8%). A page teaches something you don't know yet, usually something you've already found all the bits for. It could be a crafting recipe or a sewing pattern.
  - **Treasure chests** and **fishing** turn up recipe pages too.
  - **Goals** teach you what the next goals need: the fence goal teaches the gate, the pen the feeder, hatching the planter box, the feeder the ladder, wheat the door, and so on.
  - Recipes you haven't learned show in the bag as grey **Not learned yet** cards. Known recipes are kept with your bag (`stats.known`), so they come along when you visit a friend. Worlds from before v26 keep every recipe they've made, picked up or placed. Code: `js/recipes.js`.

| Make | From |
|---|---|
| 4 Wood | 1 Log |
| 4 Sticks | 2 Wood |
| Crafting table | 4 Wood |
| Sword * | 2 Wood + 1 Stick |
| 3 Ladders * | 8 Sticks |
| Fishing rod * | 4 Sticks, 2 Wool |
| 2 Red / Yellow wool | 2 Wool, 1 red / yellow flower |
| 2 Orange wool | 2 Wool, 1 red flower, 1 yellow flower |
| 2 Pink wool | 2 Wool, 1 red flower, 1 white flower |
| 2 Green wool | 2 Wool, 1 clover |
| 3 Fence * | 2 Wood + 2 Sticks |
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
| House kit * | 32 Wood + 4 Glass + 2 Lamps |
| Bed * | 4 Wood + 4 Wool |
| 2 Signs * | 2 Wood + 1 Stick |
| Campfire | 2 Logs + 3 Cobble |
| Bread † | 2 Wheat |
| Grilled fish † | 1 Fish |
| Apple pie † | 3 Apples + 1 Wheat + 1 Egg |
| Party cake † | 4 Wheat + 2 Milk + 3 Eggs |
| Water | 2 Snow |
| 2 Mud | 2 Dirt + 1 Water |
| 4 Stone bricks | 4 Cobble |
| 2 Windows * | 2 Glass + 1 Wood |
| Bench * | 4 Wood + 2 Sticks |
| Flower pot | 2 Clay + 1 Dirt + 1 Red flower |
| Lamp post * | 1 Lamp + 1 Log + 1 Cobble |

- **Fences** join up with each other, gates and solid blocks. **Gates** turn to line up with the fence; tap one to open or shut it. Animals and foxes can't get past either.
- **Ladders** lean on the wall beside them. Walk into one (or press jump) to climb; let go to slide down slowly.
- **Feeders:** place one, then hold a treat and tap the feeder to fill it (uses 5). While a baby that likes that treat is nearby, the feeder puts a treat on the ground beside it, until it runs empty (about 8 treats). Crows like feeders too!
- Worlds saved before crafting existed get a generous starter bag.
- A visitor in Play together brings their own bag and takes home what they collected.

## Goals

- The star line under the nursery counters shows your **next goal** (tap it to see them all in the bag's **★ Goals** tab).
- **Today’s job** (`DAILY` in `js/goals.js`, `dailyStep()` in `js/main.js`): after 3 goals, a blue ☀️ line under the goal gives one small job a day (pet, dig, build, make, hatch, tame, fish, gifts, plant, fill), picked from the world seed and day, never the same as yesterday, and only from jobs you can do yet. Finishing it pays a small reward. Stored in `stats.daily`; `stats.dailies` counts how many you have done. Doing it on days in a row builds a run (`stats.dailyRun = { seed, day, n }`, 🔥n on the line); every 3rd day in a row adds 3 fireworks. Milestone days (10, 25, 50, 75, every 100) launch fireworks at sunrise (`milestoneDay()`).
- Goals lead from digging your first blocks to chopping a tree, building a crafting table, penning your babies in with fences and a gate, filling a feeder, climbing a ladder, bonking a raider, keeping the nursery safe for a night, watching a baby grow up, picking up gifts from the grown-ups, teaching a grown-up a job, writing on a sign, sleeping in a bed, popping 3 snakes in one night, bonking 25 raiders, growing to 37 chickens, then 5 daily jobs, 20 fish, 5 treasure chests, 3 parties, 5 safe nights in a row, 67 chickens and finally 100 chickens.
- **Messages** (`toast()` in `js/main.js`): shown above everything, including the bag and menus. Each stays at least 2.5 s before a new one replaces it (others queue, duplicates are dropped), long ones stay longer, and tapping one puts it away.
- **Pause tips** (`TIPS` in `js/main.js`): the pause menu shows a different tip each time (keyboard tips only on a computer).
- **Your story so far** (pause menu, `buildStory()` in `js/main.js`): tiles showing the day, animals in the nursery, babies hatched, safe nights, best run, raiders bonked, most snakes popped in one night (`stats.bestPops`), blocks dug and put down, things made, fish, treasure chests, daily jobs done, goals done, Pip's next visit and your crown (with what the next one needs). Filled in each time you open it.
- Each goal gives a reward (seeds, wheat, apples, bones, wood, a gate, hay or lamps) when you finish it.

## Fishing

- The **fishing rod** is a tool (never used up): 4 sticks and 2 wool at a crafting table, once you've learned it (recipe page, or finishing the sewing goal).
- Hold it and tap (or click) to cast: the line lands on the first water you're looking at, up to about 17 blocks away. After 4–13 seconds (sooner in rain or at night) the float bobs under with a splash. Tap within about 1.3 seconds to catch something. Tap too soon and the line comes back empty. Switch item or walk more than 22 blocks away and it reels itself in.
- A catch is a fish (75%, sometimes two), a treat or sticks, or a recipe page (10%, if there's anything left to learn).
- **Fish** pay for teaching a grown-up a job when you've none of its favourite treat. Code: the fishing section of `js/main.js`, the float is `bobberModel()` in `js/models.js`.

## Treasure chests

- About one chunk in ten gets a treasure chest out in the open, on grass, sand or snow above the sea (placed by the world generator from the seed, so every world has its own; `generate()` in `js/world.js` remembers it as `chunk.chest`).
- When a shut chest is within 30 blocks, a gold **✨ Treasure** tag points to it, like the Nursery tag.
- Tap it to open it (it stays open, with an empty dark inside). You get two different goodies from `CHEST_LOOT` in `js/main.js` and, 85% of the time, a recipe page. Digging a shut chest gives you the treasure too, plus 3 wood.

## Flowers

- Red, yellow and white **wild flowers** grow in clumps on the grass. Dig one to pick it, and place it anywhere to plant it. You can walk through them.

## Planters, pets and photos

- A **planter box** grows wheat: tap it while holding seeds to plant them. The wheat sprouts, grows and turns golden over about two minutes (the host's game grows it). Tap it when it's golden for 2 wheat and 1–2 seeds.
- **Pet** a baby in your nursery by tapping it (not while holding a treat or the sword): hearts, a happy hop, and a small push towards growing up (once every 20 seconds per baby).
- The **camera** button takes a photo of your world with a "Day N" label, and shares it (phones) or downloads it.
- Each sunrise says which day it is.

## Butterflies and fireflies

- By day, butterflies (orange, blue and pink) flutter round wild flowers and over meadows, and sometimes land on a flower. At night, fireflies drift and blink over the grass. They're just for looking at, and each device has its own (`js/critters.js`).
- Firefly tails and snake eyes glow in the dark: in the model shader, part 11 of a model ignores the night tint.

## Names, rain and rainbows

- Every baby gets a name when it's born (from a list of 45 in `js/animals.js`). Toasts use it: "Pudding the lamb grew up into a sheep!", "Jellybean the wolf pup loves that!".
- **Your own names:** pat a baby twice in a row (or tap a grown-up) and type in the **Name** box on its card (up to 14 letters). The name goes into toasts and the save, and the host shares it with everyone playing together (`nk` in the state message). Clear the box to go back to its born name.
- **Animal hats:** the card (pat a baby twice, or tap a grown-up) has a **Hat** row with every hat you've sewn or got free in the Wardrobe. Each species has its own hat spot (`HAT_SPOT` in `js/models.js`); `animalHatModel()` adds the Wardrobe hat to the animal's model as part 10, so it nods with the head. Hatted models are named like `hen~6`. Hats are saved with the animal and shared like names (`ht` in the state message, `'hat'` from guests).
- **Ambient sounds:** birds sing now and then by day and crickets trill at night when you're outside and above water (`bird()` and `cricket()` in `js/audio.js`).
- **Rain** comes now and then (about 1–2 minutes, every 3–8 minutes; the host decides). The sky greys, drops fall and stop on roofs, and planter wheat grows 2.5× faster. When a shower ends by day, a rainbow shows opposite the sun for about 45 seconds. Code: `js/weather.js`.
- **Snow:** when you're high up in the mountains (eye above `SNOW_LINE`, sea level + 20) a shower falls as slow, drifting white snowflakes instead, with no rain sound. Down in the valley the same shower is rain.
- More than 35 m from your tame babies, a **Nursery** tag at the screen edge points the way back.

## Wardrobe: your name and clothes

- **Wardrobe** (front screen or pause menu) sets your name (up to 14 letters; blank uses Lachie or Charli), who you are, and your outfit. The camera swings round so you see yourself; drag to turn, **Photo** takes a portrait, **Surprise me!** picks a random outfit.
- Outfits: top (T-shirt, stripes, hoodie, dress, chick jumper, hero cape), bottoms (shorts, trousers, skirt, dungarees, tutu; hidden with a dress), hat (none, cap, beanie, bow, flower, chick hat, party hat, bunny ears, flower crown), shoe colour and bag on or off, from 12 colours. Each character keeps its own outfit.
- **Patterns and sewing:** only the T-shirt, shorts, no hat and no bag are free. Every other piece needs its **pattern** (from a recipe page, or a goal: picking flowers teaches the flower hat) and then sewing from wool and flowers (`SEW` in `js/recipes.js`). Pieces with a padlock are locked; faded ones still need their pattern. Patterns and sewn clothes are kept on the device (`settings.patterns`, `settings.sewn`). Devices from before v26 keep everything they'd sewn or anyone was wearing.
- An outfit is 8 small numbers (`[top, colour, bottoms, colour, hat, colour, shoes, bag]`, see `DEFAULT_FIT` in `js/models.js`). Each character-and-outfit is built as its own model the first time it's seen. Names and outfits travel with player poses in play together.
- **Sewing:** some pieces have a little padlock. Tap one to see what it needs, then **Sew it!** to unlock it for good on this device. Wool comes from grown-up sheep; flowers grow wild.

| Piece | Sew it from |
|---|---|
| Chick jumper (top, with a chick face) | 3 wool, 1 yellow flower |
| Hero cape (top: white T-shirt and a cape) | 4 wool, 1 red flower |
| Dungarees (bottoms) | 4 wool, 1 stick |
| Tutu (bottoms) | 2 wool, 2 white flowers |
| Chick hat (a chick sits on your head) | 2 wool, 1 egg |
| Party hat | 2 wool, 1 red flower, 1 yellow flower |
| Bunny ears | 2 wool, 1 clover |
| Flower crown | 2 each of red, yellow and white flowers |

- **Surprise me!** only picks pieces you've already got. The list is `SEW` in `js/main.js`; what's sewn is saved with your settings.
- More designs and colours to sew later.

## Saved games

- The world you're playing saves itself (every 10 seconds, and when you pause or switch away) to `blockwild.save.v1` in the browser's storage. **Continue** loads it.
- **Take me home** (pause menu, `takeMeHome()` in `js/main.js`): puts you on the ground 2 blocks from the middle of your tame animals, or at the world's start (0, 0) if you have none. For getting out of holes or finding your way back. Feeders that run empty (`farmNoteT`, at most every 90 s) and wheat turning golden (every 2 min at most) also show a message.
- **Bring back your old world**: tapping Create world first copies the world you had to `blockwild.prev.v1` (one only). Saved games then shows **Bring back the world you had before your new one** (`#btn-undo-new`), which swaps it back in and clears the copy.
- **Saved games** on the menu keeps up to **5 named copies** on the device (`blockwild.slot.0`–`4`, listed in `blockwild.slots.v1` with name, time and number of animals). **Save here** copies the world you're playing into a slot (asking before it saves over one); **Load** swaps it in as the world you're playing (asking first). Loading never deletes a slot.
- **Download a backup** saves a `.json` file with the world and your learned clothes patterns. **Load a backup** reads one back, on any device. Files that aren't a world are turned away and nothing changes; the bag is cleaned on load so only real items come in.
- Saving and loading are off while you play together (host or guest). A save is usually a few KB; if the device runs out of room you're told, and the world you're playing is kept.
- **Keeping it safe:** when you tap Play the game asks the browser to keep its storage (`navigator.storage.persist()`). Once a world has had some play (tamed animals, nights and goals adding up to 4), the menu shows a reminder when there's been no backup for 5 days (`settings.lastBackup`). Saved games shows when you last downloaded one. On an iPhone or iPad that hasn't added the game to the Home Screen, it explains that Safari may clear the world after a week or so without a visit.

## Version and what's new

The front screen shows the version number. Tap it, or open **What’s new**, for the change log. It lives in `js/version.js` (and [CHANGELOG.md](CHANGELOG.md)). To release: bump `VERSION`, add an entry at the top of `CHANGES` and in CHANGELOG.md, and set `CACHE` in `sw.js` to the same number.

## The map

- The **map button** (top right, between the camera and the bag), or **M** on a keyboard, opens a bird's-eye map around you: 128 blocks across, or 256 with **Zoom out**. North is up.
- Ground you've been near is drawn from the real blocks, with your buildings, paths and wool. Further out it's drawn from the world's own shape (`heightAt`), so you can see hills, beaches and the sea before you get there. Higher ground is lighter, and slopes are shaded from the west.
- Markers: a white arrow for you (pointing the way you face), 🐣 your nursery, 🪧 signs with their words, 🛏️ beds and 🔥 campfires you've put down, ✨ shut treasure chests in places you've been, 🛒 Pip's cart, 🐍 snakes and 🦊 foxes, and friends playing with you. Code: `drawMap()` in `js/main.js`.
- **Pins:** tap the map to drop a 📍 pin (`mapView.pin`, world x and z); tap near it again to pick it up. A blue tag (`.tag.pin`) points to it with the distance, and it clears itself with a ding when you get within 3 blocks. Pins aren't saved.
- Tags pinned to the screen edge are nudged 30 px apart when they'd overlap (`spreadEdgeTags()`, run after `updateTags()` each frame).

## Pip the travelling goose

- Every other day (day 2, 4, 6 …), from morning till early afternoon, **Pip** pulls her striped market cart up near your nursery (or near you, if there's no dry ground there). A 🛒 tag points the way.
- Tap Pip or her cart to see five swaps. They change each visit (picked from `TRADES` using the world seed and the day) and are the same for everyone playing together. One is always a **recipe page**. The others swap spare things for handy ones: eggs for a party cake, fish for lamps, wheat for apples, logs and fish for a house kit, cobble for pebbles, apples for confetti poppers, wheat and eggs for fireworks, and so on. Each swap can be made once or twice per visit.
- Playing together, the host decides when Pip comes and where she parks (`td` in the state message); everyone swaps from their own bag. New goal: swap something with Pip.

## Cooking

- The **Cooking** tab in the bag. Make a **campfire** from 2 logs and 3 cobble (learned by finishing the chop-a-tree goal) and put it down: a ring of stones, crossed logs and glowing flames that crackle when you're close by. Food needs a campfire within 4 blocks (`r.table === 'fire'` in `RECIPES`).
- **Bread** (2 wheat; learned from the gate goal): eat it for **zoomies**, running 1.5× faster for 60 seconds.
- **Grilled fish** (1 fish; learned from the fishing goal): eat it to be **springy**, jumping about 2.6 blocks instead of 1.5, for 60 seconds.
- **Apple pie** (3 apples, 1 wheat, 1 egg; learned from the sign goal): both, for 90 seconds.
- **Party cake** (4 wheat, 2 milk, 3 eggs; learned from the sleep goal): use it near your animals to throw a party. Every tame animal within 14 blocks hops for joy with hearts, and babies grow a good bit (60% of a drink of milk). `party()` in `js/animals.js`; a guest's party asks the host (`'party'`).
- Hold the food and tap to eat it. A pill by the nursery counters shows the food and the seconds left. Two new goals: cook something, and throw a party.

## Theme song

- The Baby Chicken Empire song (`audio/theme.m4a`, 2 MB AAC, made from the music video's WAV) plays on the front screen and the pause menu after your first tap. Phones only allow sound after a tap.
- While you play, it comes back quietly now and then by day: 25 seconds after you start, then every 8–12 minutes (`js/music.js`). If you start playing within 30 seconds of it starting on the menu, it carries on softly.
- It goes through the sound effects' audio context so the volume works on iPhones. **Settings → Theme song** turns it off; turning **Sound** off silences it too.
- The service worker leaves `.m4a` files to the network, because phones fetch media in pieces (range requests) that a cached copy can't answer. So the song needs a connection, though the rest of the game works offline.

## Beds and signs

- **Beds** (4 wood and 4 wool at a table; you learn the recipe by finishing the hat goal, or from a recipe page). Put one down: the headboard turns to sit against a wall. You can walk through it. Tap it when it's dark to sleep: the screen fades out and you wake at sunrise. Sunrise ends the night as usual: the snake goes home, and if no baby was spooked it counts for the night goal. Tap it by day and it tells you to come back at bedtime. Playing together, anyone can sleep: a guest's bed asks the host, and the host moves the clock on for everyone (`'sleep'` to the host, `'slept'` back to the guests).
- **Signs** (2 wood and 1 stick make 2, at a table; learned by finishing the treasure chest goal, or from a page). Put one down and a box opens to write on it (up to 40 letters). Tap a sign to change its words; leave the box blank to rub them out. The words float over the sign for the nearest 6 signs within 12 blocks. They're saved with the world as `signs` (`"x,y,z": text`), and the host shares them with friends who visit (in the welcome message, then `'sign'` messages). Digging a sign rubs its words out.

## Doors and houses

- **Doors** are two blocks tall (put one down where there are two blocks of room). Tap either half to open or shut it. Babies, foxes and snakes can't get past a shut door; dig it to pick it back up.
- A **house kit** builds a 5×5 cottage where you put it down, its door facing you: cream walls with log corners, glass windows, a lamp, a plank floor and a red gabled roof. The walls are too tall for the snake, so babies shut in a house are safe at night.

## Day raiders

- **Foxes** sneak up on your tame babies by day. One that reaches a baby spooks it out of the nursery. Babies run from a fox that gets close. Foxes hop up natural ground but can't climb anything you've built, so a fence keeps them out; one that spends ages bumping into fences gives up and goes home. Two sword bonks and a fox poofs, dropping **2 bones** for whoever bonked it.
- **Crows** swoop down on treats lying on the ground, peck for a moment, then fly off with them. One bonk while it pecks and it poofs, dropping **4 seeds**.
- Raiders go home at dusk, when the snake takes over.

## Night and the block snake

A full day lasts 10 minutes: about 6 minutes of daylight, a pink dusk, roughly 3 minutes of night under the square moon, then sunrise.

- At night the babies doze off (sleeping babies near you puff a little "z z z"), and a big green and purple striped **block snake** (taller than the babies) slithers towards your nursery (one snake at first, up to four on later nights).
- If it reaches a baby, the baby is spooked out of your nursery and runs off. Feed it again to bring it back. Babies run from a snake that gets close, and a ❗ pops up over a tame baby when it starts to run (an `eek` flock event).
- Snakes slither over a **one-block fence** but not a **two-block wall**.
- Snakes within 7 blocks of a scarecrow move at 40% speed; within 5 blocks of a lamp post or campfire, at 70% (`GLOW_RANGE`, `GLOW_SLOW` in `js/snakes.js`; a `glow` event gives a first-time tip).
- Pick the **toy sword** and tap (or click) to swing. Three bonks and the snake poofs into confetti cubes (snakes got tougher in v43).
- At sunrise any remaining snakes leave. Lamps stay bright at night.
- A popped snake (after the first one ever) leaves a prize for each player within 16 blocks: one of `SNAKE_PRIZES` in `js/main.js` (pebbles, a bone, apples, a popper or a lamp), shown as floating text.
- **Peaceful** (Settings, `settings.peaceful`): no snakes, foxes or crows. Snakes and raiders get a `peaceful` flag each frame on the host; any already out poof or head home. The host's flag rides on the `night` and `dawn` events, so guests see the right message. Peaceful nights don't count for the night goals, Safe nights or crown streaks, and there is no dusk warning.
- The first two nights are gentler: every snake takes one bonk less (never fewer than 2). Each bonk shows how many more it needs ("BONK! 2 more").
- A clock pill in the top corner shows ☀️ Day, 🌅 Dusk or 🌙 Night with the day number (`clockStep()` in `main.js`). About 20 seconds before dusk a message warns you how many snakes are coming (`snakesTonight()` in `js/snakes.js`), and tells you to swap to the fight hotbar if you're on the build one.
- A red **🐍 Snake** (or **🦊 Fox**) tag with the distance points to the nearest one within 60 blocks, pinned to the screen edge when it's off screen. Snakes and foxes also show on the map.
- At night the clock adds a snake count (`🌙 Night 2 · 🐍 3`), and the sunrise message says how many snakes you popped that night (`nightPops`).
- When a snake spawns (after its kind's first-time tip), a message names it and the side of the nursery it comes from, in eight compass points with north up.
- If a snake gets within 14 blocks of the nursery while you're 25 or more blocks away, a message (once per snake) tells you to hurry back.
- **Kinds of snake** (`SNAKE_KINDS` in `js/snakes.js`). A new kind joins each night, and a newly unlocked kind comes first that night:
  - Night 1: **block snake** (green and purple) and **poison snake** (purple and lime). The poison snake leaves a trail of green goo from its tail that lasts 5 seconds. Babies that step in it run off; it slows you to 40% speed.
  - Night 2: **flying snake** (sky blue, white wings). Flies about 4.5 blocks up over fences and walls, then swoops down when it's close to a baby. Bonk it when it comes low.
  - Night 3: **digger snake** (clay orange, yellow hard hat). Chews a two-high tunnel through any wall in its way instead of going round. Five bonks.
  - Night 4: **boom snake** (red and black, with a fuse). Stops next to a baby (or you) and fizzes for 1.5 seconds, then goes BOOM: blocks within about 3 blocks are blasted away, babies within 8 run off. Four bonks to pop it, and you're blown back. A bonk while it fizzes puts the fuse out.
- Blocks chewed or blasted go through `smashBlock` in `main.js`, so they save and reach other players. Bedrock and water can't be broken.

## Chicken king

- Keep every baby safe for **perfect nights in a row** to earn crowns. Each crown needs a longer run and a bigger nursery:

  | Crown | Perfect nights in a row | Animals in the nursery |
  |---|---|---|
  | Gold | 3 | 8 |
  | Ruby | 5 | 20 |
  | Diamond | 8 | 40 |

- One spooked baby starts the run again, and a night slept through in a bed doesn't count (but doesn't break the run either). Each sunrise says how close you are. Snakes get more numerous and trickier every night, so the later crowns are hard.
- Raising 100 chicks also earns the gold crown. The first crown comes with a **hay bale throne** on your hotbar. The crown shows at top left and changes colour as it grows.
- Place the throne: it builds a red-cushioned seat with a hay back (facing you) and arms.
- Tap the throne to sit. Every baby in your nursery nearby gathers in rows in front of it, hopping and wagging. Walk or jump to stand up.

## Scarecrows, the dinner bell and fireworks

- **Scarecrow** (Farm tab, at a crafting table: 3 hay, 3 sticks, 1 wool): block snakes within 7 blocks of one creep along at under half speed, giving you time to reach them with the sword. Learned from the cooking goal.
- **Dinner bell** (Farm tab, at a crafting table: 4 wood, 3 sticks, 1 lamp): tap it and every tame animal within 70 blocks runs to stand round it. Grown wolves then guard from there. Its bell glows at night. Learned by swapping with Pip.
- **Fireworks** (Wood & tools tab, at a crafting table: 1 stick, 1 sand, 1 red and 1 yellow flower makes 3): hold one and tap to launch it. It whooshes up, trailing sparks, and bursts into a ball or ring of glowing colour. Animals nearby hop about. Learned by throwing a party. Everyone playing together sees the same firework.
- The **🌙 badge** next to your crown counts perfect nights in a row, and how many the next crown needs.
- New goals: make a scarecrow, ring the bell, launch a firework, and keep every baby safe 3 nights in a row.

## Bouncy pads, firefly jars and shooting stars

- **Bouncy pad** (Building tab, at a crafting table: 2 pink wool, 2 wood, 1 hay): land on it and you spring back up. Let go and the bounces die down. Hold jump as you land and each bounce goes higher, up to about 8 blocks. Jumping off one goes higher too. Learned from the scarecrow goal.
- **Firefly jar**: at night, hold glass and tap a firefly to catch it. You get a jar with a firefly inside that glows like a lamp when you put it down.
- **Shooting stars**: on clear nights one streaks across the sky every minute or so. Look right at it before it fades to make a wish and get a small present (fireworks, milk, eggs, a pie, a cake, lamps, apples or pink wool). Each device sees its own stars.
- New goals: bounce on a bouncy pad 10 times, catch 3 fireflies, and wish on a shooting star.

## The music box, messages in bottles and snowmen

- **Music box** (Building tab, at a crafting table: 4 wood, 1 lamp, 2 sticks, 1 yellow flower): tap it to play a short tune, made up fresh each time. Tame animals within 14 blocks hop and wag on the beat, and music notes float up. Everyone playing together hears the same tune. Learned from the firework goal.
- **Message in a bottle**: about one catch in 14 (likelier after a few catches if you've never had one). The note leads to the nearest shut chest more than 30 blocks away (or more than 12 if there isn't one), and the Treasure tag keeps pointing to it, however far, until it's opened. With no chest about, the bottle holds a small present instead.
- **Snowman** (Building tab: 5 snow, 2 sticks, 1 orange wool): a decoration with a carrot nose, coal eyes and buttons, a red scarf and stick arms. Learned from the firefly goal.
- New goals: play the music box, fish up a bottle, and build a snowman.

## Hide and seek, the swim ring and sandcastles

- **Hide and seek**: by day, every 6 to 11 minutes, a tame baby within 30 blocks runs 12 to 24 blocks off to the most tucked-away spot it can find (next to walls or trunks, under leaves). Once there it keeps still (`a.hiding` in `js/animals.js`) and giggles every 6 seconds, louder as you get nearer. Walk within about 3 blocks to find it: you get a small reward (apples, clover, milk or eggs) and it runs back home. After 3 minutes, or at dusk, it gives up and comes home. The host runs it when playing together.
- **Swim ring** (Wood & tools tab, at a crafting table: 2 red wool, 2 wool): while it's the item you're holding, you float at the surface and swim about 2.3 times as fast as without it. Jump to hop out. Learned from the bottle goal.
- **Sandcastle** (Building tab: 6 sand, 1 stick, 1 red flower): a decoration with four towers and a red flag. Learned from the snowman goal.
- New goals: find 2 hiding babies, swim 60 blocks with the ring, and build a sandcastle.

## More to build, and clearer controls

- **Stone bricks** (Building tab: 4 cobble make 4): smart grey castle-wall blocks. Learned from the bonk goal.
- **Windows** (Building tab, at a table: 2 glass and 1 wood make 2): glass in a wooden frame with four panes. Learned from the house goal.
- **Lamp post** (Building tab, at a table: 1 lamp, 1 log, 1 cobble): a post on a stone foot with a lantern that glows at night. Learned from the night goal.
- **Flower pot** (Building tab: 2 clay, 1 dirt, 1 red flower): a terracotta pot with a red flower. Learned from the treasure chest goal. Clay is at the bottom of deep water, and digging sand turns up a lump now and then (about 1 in 12).
- **Bench** (Building tab, at a table: 4 wood, 2 sticks): tap it to sit down (`sitBench`, a lower `seat` than the throne); walk or jump to stand up. A bench next to another along z turns to line up with it.
- Five new goals: place 20 stone bricks, put in 4 windows, put up 3 lamp posts, put out 4 flower pots and sit on a bench.
- **Prompts:** a label under the crosshair says what tapping (or right clicking) does to the thing you're looking at: open a gate, door or chest, sit, sleep, ring, play, write, pick wheat, plant seeds, fill a feeder, swap with Pip. At a crafting table or campfire it tells you to open the bag (press E).
- **Middle click** (`pickBlock()`, via `ui.onPick` in `js/input.js`) puts the kind of block you're looking at in your hand: its own id if it can be placed, otherwise what digging it gives. It switches to the build hotbar if needed.
- **Ctrl+Z / ⌘Z** (`undoPlace()`): takes back the last plain blocks you put down (up to 30, `undoStack`), skipping any already dug or changed, gives each back and takes it off the `placed` stats. Not for house kits, doors, thrones or signs. Cleared when the world changes; ignores key repeat; off while playing together (another player could have dug and rebuilt the spot).
- **Keyboard and mouse:** the top buttons show their keys (P photo, M map, E bag, Esc pause), hotbar slots show 1–9, and a strip of the main controls shows for the first 20 seconds. E or Esc closes the bag; Esc closes the map, Pip's cart and the job card. In the bag, point at something and press 1–9 to put it on that slot. None of this shows on touch screens.
- **Read messages aloud** (Settings, `settings.speak`): every toast is spoken with the browser's `speechSynthesis`, emoji stripped (`sayAloud()` in `js/main.js`). The box is greyed out where the browser has no speech.
- **Brighter nights** (Settings, `settings.brightNights`): each frame the world and model tints are lifted about 45% of the way back to white, scaled by how dark it is. The sky colours and `sky.night` (which the game logic uses) are left alone.
- **Scrolling on phones:** the page blocks touch scrolling (so the game doesn't rubber-band), except inside anything that has more to show (`scrollsInside` in `js/input.js` checks for an overflowing parent), so every panel scrolls on a phone turned sideways. On short screens (under 500px tall) the map shrinks to fit and the bag tabs stay on one swipeable row.
- **Recipe cards:** things you can make right now come first. A card says "Make it anywhere" when no table is needed, and a recipe you haven't learned says which goal teaches it (or to find a recipe page).

## Build and fight hotbars, the slingshot, and tougher snakes

- **Two hotbars:** the button at the end of the hotbar (or **Q**) swaps between the building hotbar and the fighting hotbar (`barMode`, `otherBar` in `js/main.js`). The fighting one starts with the sword, slingshot, pebbles, confetti poppers, bread, grilled fish, apple pie and fireworks. Each keeps its own items and selected slot, and both are saved (`hotbar`/`selected` for building, `fightbar`/`fightSel`, and `barMode`). The hotbar gets a red edge while it's the fighting one.
- **Where new things go:** something you pick up or make that isn't on the showing hotbar goes to the right one: the sword, slingshot, pebbles and poppers to the fighting hotbar, other things to the building one, and snacks and fireworks to whichever is showing (`FIGHT_ITEMS`, `EITHER_ITEMS` in `addItem`). If it's already on the hidden hotbar it stays there. Either way, when it lands on the hidden one the swap button glows (`.bar-swap.got`).
- **Pebbles from stone:** digging stone gives 1–2 pebbles about 3 times in 10 (`drops()` in `js/crafting.js`), so you can top up without the crafting table.
- **Slingshot** (Wood & tools, at a table: 3 sticks, 1 wool; a tool, never used up) and **pebbles** (2 cobble make 6). Hold the slingshot and tap to fling a pebble: it flies fast with a gentle drop and hits the first fox, crow or snake it touches (one hit) or stops at a block. Learned from the grow-up goal.
- **Confetti popper** (Wood & tools, at a table: 1 stick, 2 sand, 1 yellow flower make 2): thrown in a slow arc, it bursts where it lands and gives every fox, crow and snake within 3 blocks a hit. Learned from the firework goal.
- Shots (`shots`, `fling`, `shotStep` in `js/main.js`) fly on each player's own screen. A guest's shot is sent to the host (`'shoot'`), who works out the hits for everyone.
- **Tougher snakes:** block, poison and flying snakes take 3 hits (was 2), diggers 5 (was 3) and boom snakes 4 (was 2). Snakes slither a bit faster (2.0, was 1.7), come every 28 seconds (was 35) and up to 5 a night (was 4). Boom snakes' fuses are shorter (1.5 s) and their blasts bigger (about 3 blocks, spooking babies within 8).
- Two new goals: hit a raider with a slingshot pebble, and catch one in a popper's burst.

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
| ⬆ jump (you can't fly) | Space; Shift climbs down a ladder |
| Hotbar tap, bag button | 1–9, wheel, E |
| Map button | M |

## Code map

| File | What it does |
|---|---|
| `js/main.js` | Boot, game loop, chunk streaming, break/place, menus, saving |
| `js/world.js` | Chunk storage, terrain/caves/trees generation, player edits |
| `js/mesher.js` | Turns chunks into triangles, with rounded block edges and ambient occlusion |
| `js/animals.js` | Baby animal behaviour: species table, wandering, treats, taming, breeding, hay and mud habits, pens, growing up, gifts, wolf guards, jobs (finding work, path-finding round hills and fences, carrying things home) |
| `js/critters.js` | Butterflies by day and fireflies at night, just for looking at |
| `js/fireworks.js` | Fireworks: the rocket, its spark trail and the glowing burst |
| `js/music.js` | The theme song: when it plays on the menu and in the game |
| `js/raiders.js` | Daytime foxes and crows: sneaking, stealing treats, fences, sword hits |
| `js/goals.js` | The goals list, progress and rewards |
| `js/version.js` | Version number and the change log shown in What’s new |
| `js/weather.js` | Rain showers, rain drops and the rainbow |
| `js/crafting.js` | What digging gives you, crafting recipes, starter bag |
| `js/recipes.js` | Learning recipes: starter recipes, sewing patterns (SEW), recipe page chances, what goals teach |
| `js/snakes.js` | The night snakes and their kinds (poison goo, flying, digging, boom): spawning, slithering body, spooking babies, sword hits, confetti |
| `js/sky.js` | Day/night clock: sky colours, light tint, sun and moon |
| `js/net.js` | Play together: room codes, hosting and joining (PeerJS / WebRTC) |
| `js/models.js` | Rounded-box 3D models for the babies, Lachie and Charli in their outfits (clothes list and `kidModel`), and treats (with leg, head and tail rigs), treat icons, counter faces |
| `js/audio.js` | Synthesized cheeps, moos, oinks, baas, yips and sound effects |
| `js/renderer.js` | WebGL2 shaders, texture array, frustum culling, water pass, block outline |
| `js/player.js` | Movement, collision, swimming, ladders, voxel raycast |
| `js/input.js` | Touch joystick/look/tap/hold and keyboard/mouse |
| `js/textures.js` | Procedurally painted 16×16 block textures and hotbar icons |
| `js/blocks.js` | Block definitions |
| `sw.js`, `manifest.webmanifest`, `icons/` | Installable web app (PWA) |

World edits and settings save to `localStorage` on the device.

## Later: app stores

The folder can be wrapped with Capacitor (`npx cap init`, `npx cap add ios/android`) to produce native projects. iOS builds need a Mac with Xcode and an Apple Developer account; Android needs Android Studio and a Play Console account.
