// Goals: a short list of things to try, in order, each with a little reward.
// They lead a new player from digging their first block to building a pen and surviving the night.
import { B, ITEM_SEEDS, ITEM_WHEAT, ITEM_APPLE, ITEM_CLOVER, ITEM_BONE, ITEM_STICK, ITEM_EGG, ITEM_MILK } from './blocks.js';

// stats: { dug: {id: n}, got: {id: n}, made: {id: n}, placed: {id: n}, tamed, hatched, bonked, filled, nights, climbed, chicks, grown, gifts: {id: n} }
const n = (map, id) => (map && map[id]) || 0;
const sum = (map, ids) => ids.reduce((a, id) => a + n(map, id), 0);
const FLOWERS = [B.FLOWER_RED, B.FLOWER_YELLOW, B.FLOWER_WHITE];

// [id, what to do, how many, progress(stats), reward [[item, n], ...]]
export const GOALS = [
  ['dig', 'Dig 5 blocks', 5, s => Object.values(s.dug || {}).reduce((a, b) => a + b, 0), [[ITEM_SEEDS, 5]]],
  ['tame', 'Feed a wild baby to bring it into your nursery', 1, s => s.tamed || 0, [[ITEM_WHEAT, 3]]],
  ['log', 'Chop a tree to get a log', 1, s => n(s.got, B.LOG), [[ITEM_APPLE, 3]]],
  ['wood', 'Make wood from a log in your bag', 1, s => n(s.made, B.PLANKS), [[ITEM_STICK, 4]]],
  ['table', 'Make a crafting table and place it', 1, s => n(s.placed, B.TABLE), [[B.PLANKS, 4]]],
  ['fence', 'Make some fences at the table', 1, s => n(s.made, B.FENCE), [[ITEM_CLOVER, 3]]],
  ['pen', 'Build a pen: place 12 fences', 12, s => n(s.placed, B.FENCE), [[B.GATE, 1]]],
  ['gate', 'Put a gate in your pen', 1, s => n(s.placed, B.GATE), [[ITEM_BONE, 3]]],
  ['flowers', 'Pick 3 flowers', 3, s => sum(s.got, FLOWERS), [[ITEM_SEEDS, 6]]],
  ['hatch', 'Hatch 3 new babies', 3, s => s.hatched || 0, [[B.HAY, 2]]],
  ['feeder', 'Make a feeder and fill it with treats', 1, s => s.filled || 0, [[ITEM_WHEAT, 5]]],
  ['bonk', 'Bonk a fox, crow or snake with the sword', 1, s => s.bonked || 0, [[ITEM_BONE, 3]]],
  ['ladder', 'Climb a ladder', 1, s => s.climbed || 0, [[B.LAMP, 2]]],
  ['night', 'Keep the nursery safe through a night', 1, s => s.nights || 0, [[B.LAMP, 3]]],
  ['grow', 'Look after a baby until it grows up', 1, s => s.grown || 0, [[ITEM_MILK, 2]]],
  ['gifts', 'Pick up 5 gifts from your grown-ups', 5, s => Object.values(s.gifts || {}).reduce((a, b) => a + b, 0), [[ITEM_EGG, 3]]],
  ['chicks', 'Grow your nursery to 37 chickens', 37, s => s.chicks || 0, [[B.HAY, 4], [ITEM_APPLE, 5]]],
];
export const GOAL_IDS = GOALS.map(g => g[0]);

export function newStats() { return { dug: {}, got: {}, made: {}, placed: {}, tamed: 0, hatched: 0, bonked: 0, filled: 0, nights: 0, climbed: 0, chicks: 0 }; }
export function bump(stats, key, id, by = 1) {
  if (id === undefined) { stats[key] = (stats[key] || 0) + by; return; }
  const m = stats[key] || (stats[key] = {});
  m[id] = (m[id] || 0) + by;
}
