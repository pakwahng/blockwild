// The game's version and what changed in each one. Shown on the front screen ("What's new")
// and in CHANGELOG.md. When you release: bump VERSION, add an entry at the top of CHANGES,
// and set the same number in sw.js (CACHE = 'blockwild-v<VERSION>') so phones pick it up.
export const VERSION = 24;
export const RELEASED = '8 Nov 2026';

// [version, date, headline, [details]]
export const CHANGES = [
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
