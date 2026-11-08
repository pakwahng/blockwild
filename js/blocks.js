// Block definitions. Tile numbers index layers of the texture array (see textures.js).

export const T = {
  GRASS_TOP: 0, GRASS_SIDE: 1, DIRT: 2, STONE: 3, SAND: 4, LOG_SIDE: 5, LOG_TOP: 6,
  LEAVES: 7, PLANKS: 8, GLASS: 9, WATER: 10, COBBLE: 11, BRICK: 12, SNOW: 13,
  SNOW_SIDE: 14, BEDROCK: 15, LAMP: 16, CLAY: 17, HAY_SIDE: 18, HAY_TOP: 19, ROOF: 20, CREAM: 21, MUD: 22, THRONE_TOP: 23, THRONE_SIDE: 24, WOOL: 25,
  CHEST_SIDE: 26, CHEST_TOP: 27, CHEST_OPEN: 28,
  WOOL_RED: 29, WOOL_ORANGE: 30, WOOL_YELLOW: 31, WOOL_PINK: 32, WOOL_GREEN: 33,
};
export const TILE_COUNT = 34;

export const B = {
  AIR: 0, GRASS: 1, DIRT: 2, STONE: 3, SAND: 4, LOG: 5, LEAVES: 6, PLANKS: 7,
  GLASS: 8, WATER: 9, COBBLE: 10, BRICK: 11, SNOW: 12, BEDROCK: 13, LAMP: 14, CLAY: 15,
  HAY: 16, ROOF: 17, CREAM: 18, MUD: 19, THRONE: 20, FENCE: 21, GATE: 22, GATE_OPEN: 23,
  TABLE: 24, LADDER: 25, FEEDER: 26, FEEDER_SEEDS: 27, FEEDER_WHEAT: 28, FEEDER_APPLE: 29, FEEDER_CLOVER: 30, FEEDER_BONE: 31,
  FLOWER_RED: 32, FLOWER_YELLOW: 33, FLOWER_WHITE: 34, WOOL: 35,
  DOOR: 36, DOOR_TOP: 37, DOOR_OPEN: 38, DOOR_OPEN_TOP: 39,
  PLANTER: 40, PLANTER_SEEDED: 41, PLANTER_GROWING: 42, PLANTER_RIPE: 43,
  CHEST: 44, CHEST_OPEN: 45,
  WOOL_RED: 46, WOOL_ORANGE: 47, WOOL_YELLOW: 48, WOOL_PINK: 49, WOOL_GREEN: 50,
  BED: 51, SIGN: 52, CAMPFIRE: 53,
};

// kind: 'opaque' | 'cutout' (alpha-tested, e.g. leaves) | 'liquid' (translucent pass)
const defs = [
  { id: B.AIR, name: 'Air', kind: 'air' },
  { id: B.GRASS, name: 'Grass', kind: 'opaque', top: T.GRASS_TOP, side: T.GRASS_SIDE, bottom: T.DIRT, hard: 0.45 },
  { id: B.DIRT, name: 'Dirt', kind: 'opaque', all: T.DIRT, hard: 0.4 },
  { id: B.STONE, name: 'Stone', kind: 'opaque', all: T.STONE, hard: 0.9 },
  { id: B.SAND, name: 'Sand', kind: 'opaque', all: T.SAND, hard: 0.35 },
  { id: B.LOG, name: 'Log', kind: 'opaque', top: T.LOG_TOP, side: T.LOG_SIDE, bottom: T.LOG_TOP, hard: 0.7 },
  { id: B.LEAVES, name: 'Leaves', kind: 'opaque', all: T.LEAVES, hard: 0.2, round: 0.34 },
  { id: B.PLANKS, name: 'Wood', kind: 'opaque', all: T.PLANKS, hard: 0.6 },
  { id: B.GLASS, name: 'Glass', kind: 'cutout', all: T.GLASS, hard: 0.25, round: 0.06 },
  { id: B.WATER, name: 'Water', kind: 'liquid', all: T.WATER, hard: 0, round: 0 },
  { id: B.COBBLE, name: 'Cobble', kind: 'opaque', all: T.COBBLE, hard: 0.9 },
  { id: B.BRICK, name: 'Brick', kind: 'opaque', all: T.BRICK, hard: 0.9 },
  { id: B.SNOW, name: 'Snow', kind: 'opaque', top: T.SNOW, side: T.SNOW_SIDE, bottom: T.DIRT, hard: 0.35 },
  { id: B.BEDROCK, name: 'Bedrock', kind: 'opaque', all: T.BEDROCK, hard: Infinity },
  { id: B.LAMP, name: 'Lamp', kind: 'opaque', all: T.LAMP, hard: 0.4, glow: true },
  { id: B.CLAY, name: 'Clay', kind: 'opaque', all: T.CLAY, hard: 0.5 },
  { id: B.HAY, name: 'Hay', kind: 'opaque', top: T.HAY_TOP, side: T.HAY_SIDE, bottom: T.HAY_TOP, hard: 0.3, round: 0.15 },
  { id: B.ROOF, name: 'Roof', kind: 'opaque', all: T.ROOF, hard: 0.6, round: 0.16 },
  { id: B.CREAM, name: 'Wall', kind: 'opaque', all: T.CREAM, hard: 0.6 },
  { id: B.THRONE, name: 'Throne', kind: 'opaque', top: T.THRONE_TOP, side: T.THRONE_SIDE, bottom: T.HAY_TOP, hard: 0.5, round: 0.16 },
  { id: B.MUD, name: 'Mud', kind: 'opaque', top: T.MUD, side: T.DIRT, bottom: T.DIRT, hard: 0.35, round: 0.2 },
  // wooden fences and gates: drawn as posts and rails (shape), see mesher.js
  { id: B.FENCE, name: 'Fence', kind: 'cutout', all: T.PLANKS, hard: 0.45, shape: 'fence' },
  { id: B.GATE, name: 'Gate', kind: 'cutout', all: T.PLANKS, hard: 0.45, shape: 'gate' },
  { id: B.GATE_OPEN, name: 'Gate', kind: 'cutout', all: T.PLANKS, hard: 0.45, shape: 'gateOpen', passable: true },
  // the crafting table: a wooden workbench you make fences, gates and tools at
  { id: B.TABLE, name: 'Crafting table', kind: 'cutout', all: T.PLANKS, hard: 0.6, shape: 'table' },
  // ladders lean on the wall beside them and you can climb them
  { id: B.LADDER, name: 'Ladder', kind: 'cutout', all: T.PLANKS, hard: 0.3, shape: 'ladder', passable: true },
  // a wooden feeder; filled with a treat it keeps putting out food for that kind of baby
  { id: B.FEEDER, name: 'Feeder', kind: 'cutout', all: T.PLANKS, hard: 0.45, shape: 'feeder' },
  { id: B.FEEDER_SEEDS, name: 'Feeder', kind: 'cutout', all: T.PLANKS, fill: T.SAND, hard: 0.45, shape: 'feeder' },
  { id: B.FEEDER_WHEAT, name: 'Feeder', kind: 'cutout', all: T.PLANKS, fill: T.HAY_TOP, hard: 0.45, shape: 'feeder' },
  { id: B.FEEDER_APPLE, name: 'Feeder', kind: 'cutout', all: T.PLANKS, fill: T.THRONE_TOP, hard: 0.45, shape: 'feeder' },
  { id: B.FEEDER_CLOVER, name: 'Feeder', kind: 'cutout', all: T.PLANKS, fill: T.LEAVES, hard: 0.45, shape: 'feeder' },
  { id: B.FEEDER_BONE, name: 'Feeder', kind: 'cutout', all: T.PLANKS, fill: T.SNOW, hard: 0.45, shape: 'feeder' },
  // wild flowers: little blocky blooms you can pick and plant (walk straight through them)
  { id: B.FLOWER_RED, name: 'Red flower', kind: 'cutout', all: T.LEAVES, petal: T.THRONE_TOP, middle: T.SAND, hard: 0.05, shape: 'flower', passable: true },
  { id: B.FLOWER_YELLOW, name: 'Yellow flower', kind: 'cutout', all: T.LEAVES, petal: T.SAND, middle: T.DIRT, hard: 0.05, shape: 'flower', passable: true },
  { id: B.FLOWER_WHITE, name: 'White flower', kind: 'cutout', all: T.LEAVES, petal: T.SNOW, middle: T.SAND, hard: 0.05, shape: 'flower', passable: true },
  // soft wool from your grown-up sheep
  { id: B.WOOL, name: 'Wool', kind: 'opaque', all: T.WOOL, hard: 0.25, round: 0.22 },
  // wooden doors: two blocks tall (a bottom and a top half), tap to open or shut
  { id: B.DOOR, name: 'Door', kind: 'cutout', all: T.PLANKS, knob: T.THRONE_TOP, pane: T.GLASS, hard: 0.5, shape: 'door' },
  { id: B.DOOR_TOP, name: 'Door', kind: 'cutout', all: T.PLANKS, knob: T.THRONE_TOP, pane: T.GLASS, hard: 0.5, shape: 'door' },
  { id: B.DOOR_OPEN, name: 'Door', kind: 'cutout', all: T.PLANKS, knob: T.THRONE_TOP, pane: T.GLASS, hard: 0.5, shape: 'door', passable: true },
  { id: B.DOOR_OPEN_TOP, name: 'Door', kind: 'cutout', all: T.PLANKS, knob: T.THRONE_TOP, pane: T.GLASS, hard: 0.5, shape: 'door', passable: true },
  // planter boxes: plant seeds in one and wheat grows (sprout → growing → ripe and golden)
  { id: B.PLANTER, name: 'Planter', kind: 'cutout', all: T.PLANKS, soil: T.DIRT, stalk: T.LEAVES, ear: T.HAY_TOP, stage: 0, hard: 0.45, shape: 'planter' },
  { id: B.PLANTER_SEEDED, name: 'Planter', kind: 'cutout', all: T.PLANKS, soil: T.DIRT, stalk: T.LEAVES, ear: T.HAY_TOP, stage: 1, hard: 0.45, shape: 'planter' },
  { id: B.PLANTER_GROWING, name: 'Planter', kind: 'cutout', all: T.PLANKS, soil: T.DIRT, stalk: T.LEAVES, ear: T.HAY_TOP, stage: 2, hard: 0.45, shape: 'planter' },
  { id: B.PLANTER_RIPE, name: 'Planter', kind: 'cutout', all: T.PLANKS, soil: T.DIRT, stalk: T.HAY_SIDE, ear: T.HAY_TOP, stage: 3, hard: 0.45, shape: 'planter' },
  // treasure chests hidden about the world: tap one to open it and see what's inside
  { id: B.CHEST, name: 'Treasure chest', kind: 'opaque', top: T.CHEST_TOP, side: T.CHEST_SIDE, bottom: T.PLANKS, hard: 0.7, round: 0.14 },
  { id: B.CHEST_OPEN, name: 'Treasure chest', kind: 'opaque', top: T.CHEST_OPEN, side: T.CHEST_SIDE, bottom: T.PLANKS, hard: 0.7, round: 0.14 },
  // wool dyed with flowers and clover, for colourful building
  { id: B.WOOL_RED, name: 'Red wool', kind: 'opaque', all: T.WOOL_RED, hard: 0.25, round: 0.22 },
  { id: B.WOOL_ORANGE, name: 'Orange wool', kind: 'opaque', all: T.WOOL_ORANGE, hard: 0.25, round: 0.22 },
  { id: B.WOOL_YELLOW, name: 'Yellow wool', kind: 'opaque', all: T.WOOL_YELLOW, hard: 0.25, round: 0.22 },
  { id: B.WOOL_PINK, name: 'Pink wool', kind: 'opaque', all: T.WOOL_PINK, hard: 0.25, round: 0.22 },
  { id: B.WOOL_GREEN, name: 'Green wool', kind: 'opaque', all: T.WOOL_GREEN, hard: 0.25, round: 0.22 },
  // a cosy bed: tap it at night to sleep till morning
  { id: B.BED, name: 'Bed', kind: 'cutout', all: T.PLANKS, sheet: T.WOOL, blanket: T.WOOL_RED, pillow: T.SNOW, hard: 0.4, shape: 'bed', passable: true },
  // a wooden sign: write something on it and the words float above it for everyone to read
  { id: B.SIGN, name: 'Sign', kind: 'cutout', all: T.PLANKS, post: T.LOG_SIDE, hard: 0.3, shape: 'sign', passable: true },
  // a campfire ringed with stones: cook food on it (its flames glow like a lamp)
  { id: B.CAMPFIRE, name: 'Campfire', kind: 'cutout', all: T.COBBLE, log: T.LOG_SIDE, flame: T.LAMP, hard: 0.5, shape: 'campfire' },
];

export const BLOCKS = [];
for (const d of defs) {
  const top = d.top ?? d.all, side = d.side ?? d.all, bottom = d.bottom ?? d.all;
  // round: bevel radius used by the mesher for the soft, toy-like edges
  BLOCKS[d.id] = { round: 0.12, ...d, tiles: [side, side, top, bottom, side, side] }; // +x -x +y -y +z -z
}

// Fast lookup tables for the mesher and physics.
export const OPAQUE = new Uint8Array(256);   // hides neighbour faces, casts AO
export const SOLID = new Uint8Array(256);    // collides with the player
export const KIND = new Uint8Array(256);     // 0 air, 1 opaque, 2 cutout, 3 liquid
for (const b of BLOCKS) {
  if (!b) continue;
  OPAQUE[b.id] = b.kind === 'opaque' ? 1 : 0;
  SOLID[b.id] = (b.kind === 'opaque' || b.kind === 'cutout') && !b.passable ? 1 : 0;
  KIND[b.id] = { air: 0, opaque: 1, cutout: 2, liquid: 3 }[b.kind];
}

export const PLACEABLE = [B.FENCE, B.GATE, B.DOOR, B.BED, B.SIGN, B.PLANTER, B.TABLE, B.CAMPFIRE, B.LADDER, B.FEEDER, B.FLOWER_RED, B.FLOWER_YELLOW, B.FLOWER_WHITE, B.GRASS, B.DIRT, B.PLANKS, B.WOOL, B.WOOL_RED, B.WOOL_ORANGE, B.WOOL_YELLOW, B.WOOL_PINK, B.WOOL_GREEN, B.LOG, B.HAY, B.MUD, B.ROOF, B.CREAM, B.BRICK,
  B.STONE, B.COBBLE, B.GLASS, B.LEAVES, B.SAND, B.SNOW, B.CLAY, B.LAMP, B.WATER];
// Non-block items (animal treats) share the hotbar with blocks; their ids sit above the block range.
export const ITEM_SEEDS = 200, ITEM_WHEAT = 201, ITEM_APPLE = 202, ITEM_CLOVER = 203, ITEM_BONE = 204;
export const TREATS = [ITEM_SEEDS, ITEM_WHEAT, ITEM_APPLE, ITEM_CLOVER, ITEM_BONE];
export const ITEM_SWORD = 205;
export const ITEM_NAMES = { [ITEM_SEEDS]: 'Seeds', [ITEM_WHEAT]: 'Wheat', [ITEM_APPLE]: 'Apple', [ITEM_CLOVER]: 'Clover', [ITEM_BONE]: 'Bone', [ITEM_SWORD]: 'Sword' };
export const DEFAULT_HOTBAR = [ITEM_SEEDS, ITEM_WHEAT, ITEM_APPLE, ITEM_CLOVER, ITEM_BONE, ITEM_SWORD, B.PLANKS, B.HAY, B.MUD];
export const ITEM_STICK = 206;
ITEM_NAMES[ITEM_STICK] = 'Sticks';
// Gifts from the grown-ups: throw an egg and it hatches a chick, throw milk and a baby drinks it to grow faster.
export const ITEM_EGG = 207, ITEM_MILK = 208;
ITEM_NAMES[ITEM_EGG] = 'Egg'; ITEM_NAMES[ITEM_MILK] = 'Milk';
// A house kit: place it and a little cottage builds itself, its door facing you.
export const ITEM_HOUSE = 209;
ITEM_NAMES[ITEM_HOUSE] = 'House kit';
// Fishing: a rod you cast into water, and the fish you catch with it.
export const ITEM_ROD = 210, ITEM_FISH = 211;
ITEM_NAMES[ITEM_ROD] = 'Fishing rod'; ITEM_NAMES[ITEM_FISH] = 'Fish';
// The two halves of a door, open or shut.
export const IS_DOOR = id => id >= B.DOOR && id <= B.DOOR_OPEN_TOP;
export const DOOR_TOPS = new Set([B.DOOR_TOP, B.DOOR_OPEN_TOP]);
export const THROWN =[...TREATS, ITEM_EGG, ITEM_MILK]; // everything you can throw, in the order they travel over the network
export const SHAPED = new Uint8Array(256); // fences and gates: thin shapes, not full cubes
for (const b of BLOCKS) if (b?.shape) SHAPED[b.id] = 1;
// Fences and gates join up with each other and with solid full blocks.
export const JOINS = id => id === B.FENCE || id === B.GATE || id === B.GATE_OPEN || OPAQUE[id];
// Feeders filled with each treat, and the other way round.
export const FEEDER_OF = { [ITEM_SEEDS]: B.FEEDER_SEEDS, [ITEM_WHEAT]: B.FEEDER_WHEAT, [ITEM_APPLE]: B.FEEDER_APPLE, [ITEM_CLOVER]: B.FEEDER_CLOVER, [ITEM_BONE]: B.FEEDER_BONE };
export const FEEDER_TREAT = {};
for (const k in FEEDER_OF) FEEDER_TREAT[FEEDER_OF[k]] = +k;
export const IS_FEEDER = id => id === B.FEEDER || FEEDER_TREAT[id] !== undefined;
// Food you cook at a campfire. Eat bread, fish or pie for a boost; a party cake throws a party for your babies.
export const ITEM_BREAD = 212, ITEM_GRILLED = 213, ITEM_PIE = 214, ITEM_CAKE = 215;
ITEM_NAMES[ITEM_BREAD] = 'Bread'; ITEM_NAMES[ITEM_GRILLED] = 'Grilled fish'; ITEM_NAMES[ITEM_PIE] = 'Apple pie'; ITEM_NAMES[ITEM_CAKE] = 'Party cake';
export const FOODS = [ITEM_BREAD, ITEM_GRILLED, ITEM_PIE, ITEM_CAKE];
