// Goals: a short list of things to try, in order, each with a little reward.
// They lead a new player from digging their first block to building a pen and surviving the night.
import { B, ITEM_SEEDS, ITEM_WHEAT, ITEM_APPLE, ITEM_CLOVER, ITEM_BONE, ITEM_STICK, ITEM_EGG, ITEM_MILK, ITEM_HOUSE, ITEM_FISH, FOODS, ITEM_FIREWORK } from './blocks.js';

// stats: { dug: {id: n}, got: {id: n}, made: {id: n}, placed: {id: n}, tamed, hatched, bonked, filled, nights, climbed, chicks, grown, gifts: {id: n} }
const n = (map, id) => (map && map[id]) || 0;
const sum = (map, ids) => ids.reduce((a, id) => a + n(map, id), 0);
const FLOWERS = [B.FLOWER_RED, B.FLOWER_YELLOW, B.FLOWER_WHITE];

// [id, what to do, how many, progress(stats), reward [[item, n], ...]]
export const GOALS = [
  ['dig', 'Dig 5 blocks', 5, s => Object.values(s.dug || {}).reduce((a, b) => a + b, 0), [[ITEM_SEEDS, 5]]],
  ['tame', 'Feed a wild baby to bring it into your nursery', 1, s => s.tamed || 0, [[ITEM_WHEAT, 3]]],
  ['pet', 'Pet a baby in your nursery: tap it (not holding a treat)', 1, s => s.petted || 0, [[ITEM_CLOVER, 3]]],
  ['log', 'Chop a tree to get a log', 1, s => n(s.got, B.LOG), [[ITEM_APPLE, 3]]],
  ['wood', 'Make wood from a log in your bag', 1, s => n(s.made, B.PLANKS), [[ITEM_STICK, 4]]],
  ['table', 'Make a crafting table and place it', 1, s => n(s.placed, B.TABLE), [[B.PLANKS, 4]]],
  ['fence', 'Make some fences at the table', 1, s => n(s.made, B.FENCE), [[ITEM_CLOVER, 3]]],
  ['pen', 'Build a pen: place 12 fences', 12, s => n(s.placed, B.FENCE), [[B.GATE, 1]]],
  ['gate', 'Put a gate in your pen', 1, s => n(s.placed, B.GATE), [[ITEM_BONE, 3]]],
  ['flowers', 'Pick 3 flowers', 3, s => sum(s.got, FLOWERS), [[ITEM_SEEDS, 6]]],
  ['hatch', 'Hatch 3 new babies', 3, s => s.hatched || 0, [[B.HAY, 2]]],
  ['feeder', 'Make a feeder and fill it with treats', 1, s => s.filled || 0, [[ITEM_WHEAT, 5]]],
  ['wheat', 'Grow wheat in a planter box and pick it', 1, s => s.harvested || 0, [[B.PLANTER, 2]]],
  ['bonk', 'Bonk a fox, crow or snake with the sword', 1, s => s.bonked || 0, [[ITEM_BONE, 3]]],
  ['ladder', 'Climb a ladder', 1, s => s.climbed || 0, [[B.LAMP, 2]]],
  ['house', 'Build a house: put down a house kit, or a door in your own walls', 1, s => n(s.placed, ITEM_HOUSE) + n(s.placed, B.DOOR), [[B.GLASS, 2], [ITEM_APPLE, 4]]],
  ['night', 'Keep the nursery safe through a night', 1, s => s.nights || 0, [[B.LAMP, 3]]],
  ['grow', 'Look after a baby until it grows up', 1, s => s.grown || 0, [[ITEM_MILK, 2]]],
  ['gifts', 'Pick up 5 gifts from your grown-ups', 5, s => Object.values(s.gifts || {}).reduce((a, b) => a + b, 0), [[ITEM_EGG, 3]]],
  ['job', 'Teach a grown-up a job: tap it and pick one', 1, s => s.trained || 0, [[ITEM_BONE, 2], [ITEM_SEEDS, 6]]],
  ['sew', 'Sew something new in the Wardrobe (pause menu)', 1, s => s.sewn || 0, [[B.WOOL, 3], [ITEM_APPLE, 3]]],
  ['fish', 'Catch something with a fishing rod: cast into water, tap when the float bobs', 1, s => s.fished || 0, [[ITEM_FISH, 2], [ITEM_BONE, 3]]],
  ['chest', 'Find a treasure chest and open it: look for the gold Treasure tag', 1, s => s.chests || 0, [[ITEM_APPLE, 4], [B.LAMP, 1]]],
  ['hat', 'Put a hat on one of your animals: tap it, then pick a hat', 1, s => s.hatted || 0, [[ITEM_CLOVER, 3], [B.WOOL, 2]]],
  ['sign', 'Make a sign and write on it: tap a sign to change what it says', 1, s => s.signed || 0, [[ITEM_APPLE, 3], [B.FLOWER_YELLOW, 2]]],
  ['sleep', 'Make a bed and sleep in it till morning: tap it when it’s dark', 1, s => s.slept || 0, [[ITEM_MILK, 2], [B.WOOL, 2]]],
  ['cook', 'Make a campfire and cook something on it', 1, s => sum(s.made, FOODS), [[ITEM_WHEAT, 4], [ITEM_EGG, 2]]],
  ['party', 'Throw a party: use a party cake near your babies', 1, s => s.parties || 0, [[ITEM_MILK, 2], [B.FLOWER_RED, 3]]],
  ['trade', 'Swap something with Pip the travelling goose (she visits every other day)', 1, s => s.traded || 0, [[ITEM_APPLE, 4], [ITEM_FISH, 2]]],
  ['scare', 'Make a scarecrow and stand it by your nursery: snakes slow right down near it', 1, s => n(s.placed, B.SCARECROW), [[B.LAMP, 2], [B.HAY, 2]]],
  ['bell', 'Make a dinner bell and ring it: tap it and your animals come running', 1, s => s.rang || 0, [[ITEM_APPLE, 4], [ITEM_CLOVER, 3]]],
  ['firework', 'Launch a firework (they look best at night!)', 1, s => s.fireworks || 0, [[B.FLOWER_RED, 2], [B.FLOWER_YELLOW, 2]]],
  ['streak', 'Keep every baby safe 3 nights in a row', 3, s => s.bestStreak || 0, [[ITEM_FIREWORK, 3], [ITEM_MILK, 2]]],
  ['bounce', 'Make a bouncy pad and bounce on it 5 times (hold jump as you land to go higher)', 5, s => s.bounced || 0, [[B.WOOL_PINK, 2], [ITEM_APPLE, 3]]],
  ['jar', 'Catch a firefly at night: hold glass and tap a firefly to put it in a jar', 1, s => s.jars || 0, [[B.GLASS, 2], [ITEM_CLOVER, 3]]],
  ['wish', 'Spot a shooting star at night and make a wish: look right at it before it goes', 1, s => s.wishes || 0, [[ITEM_FIREWORK, 2], [ITEM_MILK, 1]]],
  ['chicks', 'Grow your nursery to 37 chickens', 37, s => s.chicks || 0, [[B.HAY, 4], [ITEM_APPLE, 5]]],
];
export const GOAL_IDS = GOALS.map(g => g[0]);

export function newStats() { return { dug: {}, got: {}, made: {}, placed: {}, tamed: 0, hatched: 0, bonked: 0, filled: 0, nights: 0, climbed: 0, chicks: 0 }; }
export function bump(stats, key, id, by = 1) {
  if (id === undefined) { stats[key] = (stats[key] || 0) + by; return; }
  const m = stats[key] || (stats[key] = {});
  m[id] = (m[id] || 0) + by;
}
