// The game's version and what changed in each one. Shown on the front screen ("What's new")
// and in CHANGELOG.md. When you release: bump VERSION, add an entry at the top of CHANGES,
// and set the same number in sw.js (CACHE = 'blockwild-v<VERSION>') so phones pick it up.
export const VERSION = 34;
export const RELEASED = '9 Nov 2026';

// [version, date, headline, [details]]
export const CHANGES = [
  [34, '9 Nov 2026', 'Crowns you have to earn', [
    'The gold crown is harder now: keep every baby safe for 3 nights in a row, with at least 8 animals in your nursery (raising 100 chicks still works too).',
    'Keep the run going for two new crowns: the ruby crown (5 nights in a row, 20 animals) and the diamond crown (8 nights, 40 animals). Your crown changes colour as it grows.',
    'One spooked baby starts the run again, and a night slept through in bed doesn’t count. Every sunrise tells you how close the next crown is.',
    'Crowns you already earned stay yours.',
  ]],
  [33, '9 Nov 2026', 'A map, and Pip the travelling goose', [
    'New map button (top right, or press M): see the land around you from above, with your nursery, signs, beds, campfires, treasure chests and friends marked on it. Zoom out to see further.',
    'Every other day, Pip the travelling goose pulls her market cart up near your nursery. Follow the 🛒 tag and tap her to swap things.',
    'Pip has five swaps each visit, always including a recipe page: eggs for a party cake, fish for lamps, logs for a house kit and more. She leaves in the early afternoon.',
    'A new goal: swap something with Pip.',
  ]],
  [32, '8 Nov 2026', 'Cooking, the theme song, and keeping your world safe', [
    'Cooking! Make a campfire from 2 logs and 3 cobble, then cook in the bag’s new Cooking tab: bread, grilled fish, apple pie and a party cake.',
    'Eat bread to run faster, grilled fish to jump twice as high, or apple pie for both. A little timer shows how long it lasts.',
    'A party cake throws a party: your animals close by hop about with hearts, and the babies grow a good bit.',
    'The Baby Chicken Empire song now plays on the menu, and now and then while you play. Switch it off in Settings (Theme song).',
    'Keeping your world safe: the game asks your browser not to clear it, and the menu reminds you to download a backup now and then.',
  ]],
  [31, '8 Nov 2026', 'Beds, signs and mountain snow', [
    'Make a bed from 3 wood and 3 wool. Tap it when it’s dark to sleep till morning. Playing together, anyone can go to bed and everyone wakes up at sunrise.',
    'Put down a sign and write on it. Your words float over it when you’re close by, so you can name your farm, your pens and your house. Tap a sign to change what it says.',
    'Up high in the snowy mountains, showers fall as gentle snowflakes instead of rain.',
    'Learn the sign by opening a treasure chest and the bed by putting a hat on an animal (or find their recipe pages). Two new goals go with them.',
  ]],
  [30, '8 Nov 2026', 'Save and load, and coloured wool', [
    'New on the menu: Saved games. Save the world you’re playing in one of 5 slots, give it a name, and load it again any time.',
    'Download a backup to keep your world safe in a file, or to move it to another phone or computer. Load a backup brings it back (with the clothes patterns you’ve learned too).',
    'Your world still saves itself as you play, and loading always asks first, so nothing gets lost by accident.',
    'Dye wool to build in colour: red, orange, yellow, pink and green wool, made from 2 wool and a flower (or clover). Learn each one from a recipe page.',
  ]],
  [29, '8 Nov 2026', 'Hats for your animals', [
    'Your animals can wear hats now! Tap one of your babies twice, or a grown-up once, and pick a hat on its card.',
    'Any hat you’ve sewn in the Wardrobe can go on any animal: a party hat on a hen, a flower crown on a cow, bunny ears on a wolf…',
    'Everyone playing together sees the hats, and they’re kept in your save.',
    'New goal: put a hat on one of your animals.',
  ]],
  [28, '8 Nov 2026', 'Treasure chests', [
    'Treasure chests are hidden about the world, out on the grass, sand and snow. When one is close by, a gold Treasure tag shows you the way.',
    'Tap a chest to open it: inside are two goodies (apples, wool, eggs, fish, a lamp…) and, most of the time, a recipe page.',
    'New goal: find a treasure chest and open it.',
  ]],
  [27, '8 Nov 2026', 'Gone fishing', [
    'New: the fishing rod. Learn it from a recipe page (or the sewing goal), then make it at a crafting table from 3 sticks and 1 wool.',
    'Hold the rod and tap to cast into a pond, river or the sea. When the float bobs under, tap quickly to reel it in!',
    'You mostly catch fish, sometimes a treat or some sticks, and now and then a soggy recipe page. Fish bite sooner in the rain and at night.',
    'Any grown-up will take a fish to learn a job, if you’ve none of its favourite treat.',
    'New goal: catch something with a fishing rod.',
  ]],
  [26, '8 Nov 2026', 'Learn recipes and patterns', [
    'You don’t know how to make everything any more. A new world starts with just wood, sticks, the crafting table, fences, seeds and hay.',
    'Learn more from recipe pages. They turn up now and then when you dig leaves, grass, stone, sand, clay and snow, and many goals teach you something new when you finish them.',
    'Recipes you haven’t learned show in your bag as grey cards marked “Not learned yet”.',
    'Clothes need a pattern too. Only the T-shirt, shorts, no hat and no bag are free; for the rest, find the pattern on a recipe page, then sew it in the Wardrobe from wool and flowers.',
    'Your saved world keeps every recipe you’ve already used, and you keep any clothes you’ve sewn or are wearing.',
  ]],
  [25, '8 Nov 2026', 'Name your animals', [
    'Give any baby or grown-up your own name for it. Pat a baby twice to open its card, or tap a grown-up, then type in the Name box.',
    'Its new name shows in all the messages, is kept in your save, and everyone playing together sees it.',
    'Birds sing by day and crickets chirp at night when you’re outside.',
  ]],
  [24, '8 Nov 2026', 'Pets, butterflies and fireflies', [
    'New job: Follow me. A grown-up you teach it to trots after you everywhere, day and night, and sits by you when you stop. If you run far ahead it catches up.',
    'Butterflies flutter round the wild flowers by day, and sometimes land on one.',
    'Fireflies drift and blink over the grass at night, with glowing tails.',
  ]],
  [23, '8 Nov 2026', 'Sew your own clothes', [
    'New clothes to sew in the Wardrobe: a chick jumper, a hero cape, dungarees, a tutu, a chick hat (a little chick sits on your head!), a party hat, bunny ears and a flower crown.',
    'Tap a piece with a padlock to see what it needs, then tap Sew it! Wool comes from grown-up sheep, and flowers grow wild.',
    'Once you’ve sewn something it’s yours to wear any time, in any colour.',
    'New goal: sew something new in the Wardrobe.',
    'The Wardrobe camera steps back a little so tall hats and ears fit.',
  ]],
  [22.1, '8 Nov 2026', 'Wolf and job fixes', [
    'Fixed: a grown wolf chasing a fox could follow it a very long way from home. It now gives up after about 20 blocks and trots back.',
    'New goal: teach a grown-up a job.',
    'When your first baby grows up, you’re told you can tap it to teach it a job.',
  ]],
  [22, '8 Nov 2026', 'Working animals', [
    'Teach your grown-ups a job! Tap a hen, cow, pig, sheep or wolf and pick Fetch wood, Fetch stone or Find seeds. It costs one of its favourite treats.',
    'By day a worker finds a tree, bare rock or grass near you, works at it, then carries a log, some cobble or seeds back on its back and drops it at your feet.',
    'Workers find their way round hills, fences and water. If one can’t find anything to do, it tells you.',
    'Pick Just play to give it a day off. Jobs save, and friends you play with can teach jobs too.',
  ]],
  [21.1, '8 Nov 2026', 'No more flying', [
    'You can’t fly any more: the Fly button and the F key are gone. Walk, jump, swim and climb ladders instead.',
    'If you were up in the air, you drop back down to the ground.',
  ]],
  [21, '8 Nov 2026', 'New kinds of snake', [
    'A new kind of snake joins each night.',
    'Poison snake: leaves a trail of green poison goo that lasts 5 seconds. Babies run from it, and it makes you slow.',
    'Flying snake: flaps over fences and walls, then swoops down on a baby.',
    'Digger snake: wears a hard hat and chews straight through walls. It takes three bonks.',
    'Boom snake: fizzes next to a baby, then goes BOOM and blasts the blocks around it. Bonk it while it fizzes to put the fuse out!',
  ]],
  [20, '8 Nov 2026', 'Wardrobe: your name and clothes', [
    'Open the Wardrobe from the front screen or the pause menu to give yourself a name and change your clothes.',
    'T-shirts, stripes, hoodies and dresses; shorts, trousers and skirts; caps, beanies, bows and flowers, in 12 colours. Pick your shoe colour and whether you carry your bag.',
    'You can see yourself while you dress up: drag to turn round, or tap Photo for a picture of your outfit. Tap Surprise me! for a random outfit.',
    'Friends you play with see your name over your head and the clothes you picked.',
    'Lachie or Charli is now picked in the Wardrobe too.',
    'The pause menu says Paused, and shows the version and What’s new.',
    'Fixed: an open door looked squashed with its handle sticking out. It now swings flat against the side of the doorway.',
  ]],
  [19.1, '8 Nov 2026', 'Bag scrolling fix', [
    'Fixed: on some Android phones (like Xiaomi) the bag and crafting lists ran off the bottom of the screen and wouldn’t scroll. They now fit the screen and scroll.',
  ]],
  [19, '8 Nov 2026', 'Names, rain and rainbows', [
    'Every baby has its own name, like Nugget or Pudding. You’ll see it when you pet one or when it grows up.',
    'Rain showers now and then: the sky turns grey and it stays dry under a roof. Wheat grows faster in the rain.',
    'When a shower ends on a sunny day, look away from the sun for a rainbow.',
    'Wander far from your nursery and an arrow at the edge of the screen points the way home.',
    'The front screen is a little wider.',
  ]],
  [18, '8 Nov 2026', 'Planters, petting and photos', [
    'The version number is on the front screen, with this list of what’s new.',
    'Planter boxes: fill one with seeds and wheat grows in it. Tap it when it’s golden to pick it.',
    'Pet your babies: tap one in your nursery (not holding a treat or the sword). Pats help them grow a little.',
    'Take a photo of your world with the camera button.',
    'Each sunrise tells you which day it is.',
  ]],
  [17, '8 Nov 2026', 'Doors and houses', [
    'Two-tall wooden doors you tap to open and shut.',
    'A house kit builds a cosy cottage. Babies shut inside are safe from the night snake.',
  ]],
  [16, '8 Nov 2026', 'Babies grow up', [
    'Tame babies grow up into hens, cows, pigs, sheep and wolves.',
    'Grown-ups leave gifts: eggs that hatch chicks, milk that helps babies grow, wool and apples.',
    'Grown wolves guard the nursery from foxes and snakes.',
  ]],
  [15, '8 Nov 2026', 'Goals and flowers', [
    'A goal list with rewards to lead you through the game.',
    'Wild flowers to pick and plant, and little pop-ups when you collect things.',
  ]],
  [14, '8 Nov 2026', 'Better crafting', [
    'Picture cards in tabs, make lots at once, a crafting table, ladders and feeders.',
  ]],
  [13, '8 Nov 2026', 'Fences, crafting and day raiders', [
    'Wooden fences and gates, collecting things by digging, and crafting.',
    'Sneaky foxes and treat-pinching crows by day.',
  ]],
  [12, '8 Nov 2026', 'Installs as an app', ['Install it to your home screen as its own app, on any phone.']],
  [11, '8 Nov 2026', 'Play together fixes', ['Guests see all the animals, and arrows point to friends off screen.']],
  [10, '8 Nov 2026', 'Smoother play together', ['Friends no longer look frozen to the host.']],
  [9, '8 Nov 2026', 'Play together', ['Host your world with a room code. Play as Lachie or Charli.']],
  [8, '8 Nov 2026', 'Baby Chicken Empire', ['The game gets its name, the snake gets three times bigger, and the iPad controls are fixed.']],
  [7, '7 Nov 2026', 'Chicken king', ['Earn the gold crown and sit on your hay bale throne while the babies cheer.']],
  [6, '7 Nov 2026', 'The night', ['The square moon, the block snake and the toy sword.']],
  [5, '7 Nov 2026', 'More babies', ['Calves, piglets, lambs and wolf pups join the nursery.']],
  [4, '7 Nov 2026', 'Faster updates', ['New versions reach phones straight away.']],
  [3, '7 Nov 2026', 'Baby chicks', ['Seeds, taming, hatching and the nursery counter.']],
  [2, '7 Nov 2026', 'Clay toy look', ['Soft, rounded blocks like the music video.']],
  [1, '7 Nov 2026', 'First version', ['A block world to explore and build in, on your phone.']],
];
