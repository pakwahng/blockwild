// Collecting and crafting: what each block gives you when you dig it, and what you can make.
import { B, ITEM_SEEDS, ITEM_WHEAT, ITEM_APPLE, ITEM_CLOVER, ITEM_BONE, ITEM_SWORD, ITEM_STICK, ITEM_HOUSE, ITEM_ROD, ITEM_FISH, ITEM_EGG, ITEM_MILK, ITEM_BREAD, ITEM_GRILLED, ITEM_PIE, ITEM_CAKE, ITEM_FIREWORK, ITEM_RING, ITEM_SLING, ITEM_PEBBLE, ITEM_POPPER } from './blocks.js';

// What you get for digging a block. Extra treats turn up now and then.
export function drops(id) {
  const out = [];
  const add = (item, n = 1) => out.push([item, n]);
  const chance = p => Math.random() < p;
  switch (id) {
    case B.GRASS:
      add(B.DIRT);
      if (chance(0.35)) add(ITEM_SEEDS, 1 + (Math.random() * 3 | 0));
      if (chance(0.12)) add(ITEM_WHEAT);
      if (chance(0.12)) add(ITEM_CLOVER);
      break;
    case B.DIRT: add(B.DIRT); if (chance(0.04)) add(ITEM_BONE); break;
    case B.STONE: add(B.COBBLE); if (chance(0.3)) add(ITEM_PEBBLE, 1 + (Math.random() * 2 | 0)); if (chance(0.03)) add(ITEM_BONE); break;
    case B.SAND: add(B.SAND); if (chance(0.08)) add(B.CLAY); break;
    case B.LEAVES: add(B.LEAVES); if (chance(0.22)) add(ITEM_APPLE); if (chance(0.15)) add(ITEM_STICK); break;
    case B.GATE_OPEN: add(B.GATE); break;
    case B.DOOR: case B.DOOR_TOP: case B.DOOR_OPEN: case B.DOOR_OPEN_TOP: add(B.DOOR); break;
    case B.PLANTER_SEEDED: case B.PLANTER_GROWING: add(B.PLANTER); break;
    case B.PLANTER_RIPE: add(B.PLANTER); add(ITEM_WHEAT, 2); break;
    case B.FEEDER_SEEDS: case B.FEEDER_WHEAT: case B.FEEDER_APPLE: case B.FEEDER_CLOVER: case B.FEEDER_BONE: add(B.FEEDER); break;
    case B.CHEST: case B.CHEST_OPEN: add(B.PLANKS, 3); break; // the treasure inside is handled where you dig it
    case B.BEDROCK: case B.WATER: case B.AIR: break;
    default: add(id);
  }
  return out;
}

// Each recipe: what it makes, how many, what it needs, which tab of the bag it's on,
// and whether you have to be standing at a crafting table to make it.
// table: true needs a crafting table close by, 'fire' needs a campfire.
const R = (out, n, needs, tab, table = false) => ({ out, n, needs, tab, table });
export const TABS = [['wood', 'Wood & tools'], ['farm', 'Farm'], ['build', 'Building'], ['cook', 'Cooking']];
export const RECIPES = [
  R(B.PLANKS, 4, [[B.LOG, 1]], 'wood'),
  R(ITEM_STICK, 4, [[B.PLANKS, 2]], 'wood'),
  R(B.TABLE, 1, [[B.PLANKS, 4]], 'wood'),
  R(B.LADDER, 3, [[ITEM_STICK, 8]], 'wood', true),
  R(ITEM_ROD, 1, [[ITEM_STICK, 4], [B.WOOL, 2]], 'wood', true),
  R(ITEM_FIREWORK, 3, [[ITEM_STICK, 1], [B.SAND, 1], [B.FLOWER_RED, 1], [B.FLOWER_YELLOW, 1]], 'wood', true),
  R(ITEM_SLING, 1, [[ITEM_STICK, 3], [B.WOOL, 1]], 'wood', true),
  R(ITEM_PEBBLE, 6, [[B.COBBLE, 2]], 'wood'),
  R(ITEM_POPPER, 2, [[ITEM_STICK, 1], [B.SAND, 2], [B.FLOWER_YELLOW, 1]], 'wood', true),
  R(B.FENCE, 3, [[B.PLANKS, 2], [ITEM_STICK, 2]], 'farm', true),
  R(B.GATE, 1, [[B.PLANKS, 2], [ITEM_STICK, 4]], 'farm', true),
  R(B.FEEDER, 1, [[B.PLANKS, 3]], 'farm', true),
  R(B.HAY, 1, [[ITEM_WHEAT, 4]], 'farm'),
  R(ITEM_SEEDS, 3, [[ITEM_WHEAT, 1]], 'farm'),
  R(B.PLANTER, 1, [[B.PLANKS, 3], [B.DIRT, 2]], 'farm', true),
  R(B.SCARECROW, 1, [[B.HAY, 3], [ITEM_STICK, 3], [B.WOOL, 1]], 'farm', true),
  R(B.BELL, 1, [[B.PLANKS, 4], [ITEM_STICK, 3], [B.LAMP, 1]], 'farm', true),
  R(B.BOUNCE, 1, [[B.WOOL_PINK, 2], [B.PLANKS, 2], [B.HAY, 1]], 'build', true),
  R(B.MUSICBOX, 1, [[B.PLANKS, 4], [B.LAMP, 1], [ITEM_STICK, 2], [B.FLOWER_YELLOW, 1]], 'build', true),
  R(B.SNOWMAN, 1, [[B.SNOW, 5], [ITEM_STICK, 2], [B.WOOL_ORANGE, 1]], 'build'),
  R(B.SANDCASTLE, 1, [[B.SAND, 6], [ITEM_STICK, 1], [B.FLOWER_RED, 1]], 'build'),
  R(ITEM_RING, 1, [[B.WOOL_RED, 2], [B.WOOL, 2]], 'wood', true),
  R(B.GLASS, 1, [[B.SAND, 2]], 'build'),
  R(B.STONEBRICK, 4, [[B.COBBLE, 4]], 'build'),
  R(B.WINDOW, 2, [[B.GLASS, 2], [B.PLANKS, 1]], 'build', true),
  R(B.BENCH, 1, [[B.PLANKS, 4], [ITEM_STICK, 2]], 'build', true),
  R(B.FLOWERPOT, 1, [[B.CLAY, 2], [B.DIRT, 1], [B.FLOWER_RED, 1]], 'build'),
  R(B.LAMPPOST, 1, [[B.LAMP, 1], [B.LOG, 1], [B.COBBLE, 1]], 'build', true),
  R(B.BRICK, 1, [[B.CLAY, 2]], 'build'),
  R(B.CREAM, 2, [[B.SAND, 1], [B.CLAY, 1]], 'build'),
  R(B.ROOF, 2, [[B.BRICK, 1], [B.PLANKS, 1]], 'build'),
  R(B.LAMP, 1, [[B.GLASS, 1], [ITEM_STICK, 1], [ITEM_APPLE, 1]], 'build', true),
  R(B.DOOR, 1, [[B.PLANKS, 3], [ITEM_STICK, 1]], 'build', true),
  R(B.BED, 1, [[B.PLANKS, 4], [B.WOOL, 4]], 'build', true),
  R(B.SIGN, 2, [[B.PLANKS, 2], [ITEM_STICK, 1]], 'build', true),
  R(ITEM_HOUSE, 1, [[B.PLANKS, 32], [B.GLASS, 4], [B.LAMP, 2]], 'build', true),
  R(B.WATER, 1, [[B.SNOW, 2]], 'build'),
  R(B.MUD, 2, [[B.DIRT, 2], [B.WATER, 1]], 'build'),
  // dyed wool: two wool and a flower (or clover) makes two coloured blocks
  R(B.WOOL_RED, 2, [[B.WOOL, 2], [B.FLOWER_RED, 1]], 'build'),
  R(B.WOOL_ORANGE, 2, [[B.WOOL, 2], [B.FLOWER_RED, 1], [B.FLOWER_YELLOW, 1]], 'build'),
  R(B.WOOL_YELLOW, 2, [[B.WOOL, 2], [B.FLOWER_YELLOW, 1]], 'build'),
  R(B.WOOL_PINK, 2, [[B.WOOL, 2], [B.FLOWER_RED, 1], [B.FLOWER_WHITE, 1]], 'build'),
  R(B.WOOL_GREEN, 2, [[B.WOOL, 2], [ITEM_CLOVER, 1]], 'build'),
  // cooking: make a campfire, then cook on it
  R(B.CAMPFIRE, 1, [[B.LOG, 2], [B.COBBLE, 3]], 'cook'),
  R(ITEM_BREAD, 1, [[ITEM_WHEAT, 2]], 'cook', 'fire'),
  R(ITEM_GRILLED, 1, [[ITEM_FISH, 1]], 'cook', 'fire'),
  R(ITEM_PIE, 1, [[ITEM_APPLE, 3], [ITEM_WHEAT, 1], [ITEM_EGG, 1]], 'cook', 'fire'),
  R(ITEM_CAKE, 1, [[ITEM_WHEAT, 4], [ITEM_MILK, 2], [ITEM_EGG, 3]], 'cook', 'fire'),
];
// How close (in blocks) you need to be to a crafting table.
export const TABLE_REACH = 4;
// Treats you put into a feeder in one go.
export const FEEDER_FILL = 5;

// Tools are kept, not used up.
export const TOOLS = new Set([ITEM_SWORD, ITEM_ROD, ITEM_SLING]);

// A new world starts with a handful of seeds and the toy sword; the rest you find.
export const STARTER = { [ITEM_SEEDS]: 10, [ITEM_SWORD]: 1 };
// Worlds from before crafting existed get a generous bag so nothing they had feels lost.
export const OLD_SAVE_BAG = {
  [ITEM_SEEDS]: 30, [ITEM_WHEAT]: 15, [ITEM_APPLE]: 15, [ITEM_CLOVER]: 15, [ITEM_BONE]: 10, [ITEM_SWORD]: 1,
  [B.PLANKS]: 32, [ITEM_STICK]: 16, [B.FENCE]: 16, [B.GATE]: 2, [B.HAY]: 8, [B.MUD]: 8,
};
