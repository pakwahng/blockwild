// Learning recipes: you start out knowing how to make only a few things. The rest you learn from recipe pages
// (found now and then when you dig) and from finishing goals. Clothes work the same way: you need the pattern
// before you can sew them in the Wardrobe, and then the bits to make them.
import { B, ITEM_SEEDS, ITEM_STICK, ITEM_EGG, ITEM_CLOVER, ITEM_SWORD, ITEM_HOUSE, ITEM_ROD, ITEM_BREAD, ITEM_GRILLED, ITEM_PIE, ITEM_CAKE, ITEM_FIREWORK } from './blocks.js';
import { RECIPES } from './crafting.js';

// What a new world knows how to make straight away.
export const STARTER_RECIPES = [B.PLANKS, ITEM_STICK, B.TABLE, B.FENCE, ITEM_SEEDS, B.HAY];

// Clothes you sew, from wool (grown-up sheep leave it) and flowers. Only the T-shirt, shorts, no hat and no bag are free.
// slot: 0 top, 2 bottoms, 4 hat, 7 bag; v: which one in that list (models.js TOPS, BOTTOMS, HATS).
export const SEW = [
  { slot: 0, v: 1, needs: [[B.WOOL, 2], [B.FLOWER_WHITE, 1]] },                           // stripes
  { slot: 0, v: 2, needs: [[B.WOOL, 3]] },                                                // hoodie
  { slot: 0, v: 3, needs: [[B.WOOL, 3], [B.FLOWER_RED, 1]] },                             // dress
  { slot: 0, v: 4, needs: [[B.WOOL, 3], [B.FLOWER_YELLOW, 1]] },                          // chick jumper
  { slot: 0, v: 5, needs: [[B.WOOL, 4], [B.FLOWER_RED, 1]] },                             // hero cape
  { slot: 2, v: 1, needs: [[B.WOOL, 2]] },                                                // trousers
  { slot: 2, v: 2, needs: [[B.WOOL, 2], [B.FLOWER_YELLOW, 1]] },                          // skirt
  { slot: 2, v: 3, needs: [[B.WOOL, 4], [ITEM_STICK, 1]] },                               // dungarees
  { slot: 2, v: 4, needs: [[B.WOOL, 2], [B.FLOWER_WHITE, 2]] },                           // tutu
  { slot: 4, v: 1, needs: [[B.WOOL, 1], [ITEM_STICK, 1]] },                               // cap
  { slot: 4, v: 2, needs: [[B.WOOL, 2]] },                                                // beanie
  { slot: 4, v: 3, needs: [[B.WOOL, 1], [B.FLOWER_RED, 1]] },                             // bow
  { slot: 4, v: 4, needs: [[B.FLOWER_YELLOW, 1], [B.FLOWER_WHITE, 1]] },                  // flower
  { slot: 4, v: 5, needs: [[B.WOOL, 2], [ITEM_EGG, 1]] },                                 // chick hat
  { slot: 4, v: 6, needs: [[B.WOOL, 2], [B.FLOWER_RED, 1], [B.FLOWER_YELLOW, 1]] },       // party hat
  { slot: 4, v: 7, needs: [[B.WOOL, 2], [ITEM_CLOVER, 1]] },                              // bunny ears
  { slot: 4, v: 8, needs: [[B.FLOWER_RED, 2], [B.FLOWER_YELLOW, 2], [B.FLOWER_WHITE, 2]] }, // flower crown
  { slot: 7, v: 1, needs: [[B.WOOL, 2], [ITEM_STICK, 1]] },                               // bag
];
export const patternKey = (slot, v) => slot + ':' + v;

// What finishing each goal teaches you: a recipe (the item it makes) or a pattern ('slot:v').
// Each one is what you'll want for the goals that come after it.
export const GOAL_TEACH = {
  fence: B.GATE, pen: B.FEEDER, flowers: '4:4', hatch: B.PLANTER, feeder: B.LADDER, wheat: B.DOOR,
  bonk: B.GLASS, ladder: B.LAMP, house: B.BRICK, night: B.ROOF, grow: '4:2', gifts: ITEM_HOUSE, job: '0:4', sew: ITEM_ROD,
  chest: B.SIGN, hat: B.BED, log: B.CAMPFIRE, gate: ITEM_BREAD, fish: ITEM_GRILLED, sign: ITEM_PIE, sleep: ITEM_CAKE,
  cook: B.SCARECROW, party: ITEM_FIREWORK, trade: B.BELL, scare: B.BOUNCE, firework: B.MUSICBOX, jar: B.SNOWMAN,
};

// How often digging a block turns up a recipe page.
export const PAGE_CHANCE = {
  [B.LEAVES]: 0.03, [B.GRASS]: 0.015, [B.STONE]: 0.025, [B.SAND]: 0.02, [B.CLAY]: 0.03, [B.SNOW]: 0.02, [B.DIRT]: 0.008,
};

// known: list of recipe outputs you know; patterns: list of 'slot:v' you know.
export const knowsRecipe = (known, r) => known.includes(r.out);

// Everything you could still learn: [{ kind: 'r', out } | { kind: 's', key, slot, v }].
export function unlearned(known, patterns) {
  return [
    ...RECIPES.filter(r => !known.includes(r.out)).map(r => ({ kind: 'r', out: r.out, needs: r.needs })),
    ...SEW.filter(s => !patterns.includes(patternKey(s.slot, s.v))).map(s => ({ kind: 's', key: patternKey(s.slot, s.v), slot: s.slot, v: s.v, needs: s.needs })),
  ];
}

// Which one a recipe page teaches: mostly something you've already found everything for, so you can make it.
// found(id) says whether you've ever had that thing.
export function pickPage(known, patterns, found) {
  const all = unlearned(known, patterns);
  if (!all.length) return null;
  const w = all.map(u => u.needs.every(([id]) => found(id)) ? 4 : 1);
  let r = Math.random() * w.reduce((a, b) => a + b, 0);
  for (let i = 0; i < all.length; i++) if ((r -= w[i]) <= 0) return all[i];
  return all[all.length - 1];
}

// For a world saved before recipes had to be learned: you keep everything you've made or picked up before,
// and whatever the goals you've finished would have taught you.
export function oldWorldRecipes(stats, inv, goalsDone) {
  const known = new Set(STARTER_RECIPES);
  for (const r of RECIPES) if (stats?.made?.[r.out] || stats?.got?.[r.out] || stats?.placed?.[r.out] || inv?.[r.out]) known.add(r.out);
  for (const g of goalsDone || []) if (typeof GOAL_TEACH[g] === 'number') known.add(GOAL_TEACH[g]);
  known.add(ITEM_SWORD); // everyone already has the toy sword
  return [...known];
}
