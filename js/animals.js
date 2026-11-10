// The nursery: baby chicks, calves, piglets, lambs and wolf pups.
// They wander, follow you while you hold their favourite treat, eat it to join your nursery,
// pair up for a baby, and each kind has its own habits (calves munch by hay, piglets roll in mud,
// lambs bounce, pups wag their tails).
import { B, SOLID, ITEM_SEEDS, ITEM_WHEAT, ITEM_APPLE, ITEM_CLOVER, ITEM_BONE, ITEM_EGG, ITEM_MILK, THROWN as TREATS_ORDER } from './blocks.js';
import { CS } from './world.js';

const GRAVITY = 20, HOP_V = 6.8;
const MAX_ANIMALS = 500;
const LOVE_TIME = 25, BREED_COOLDOWN = 25, GROW_TIME = 120;
// Tame babies grow up over ADULT_TIME seconds in your nursery (milk speeds it up) and end up ADULT_SCALE times as big.
export const ADULT_TIME = 420, ADULT_SCALE = 1.45, MILK_GROW = 0.25;
// What each grown-up leaves on the ground for you now and then: [item, how many]. Grown wolves guard instead.
export const GIFTS = { chick: [ITEM_EGG, 1], calf: [ITEM_MILK, 1], lamb: [B.WOOL, 2], piglet: [ITEM_APPLE, 2] };
const GIFT_TIME = [60, 120], MAX_GIFTS = 60, GUARD_RANGE = 14, CHASE_LIMIT = 20;
const GIFT_MODEL = { [ITEM_EGG]: 'egg', [ITEM_MILK]: 'milk', [B.WOOL]: 'woolTuft', [ITEM_APPLE]: 'apple', [B.LOG]: 'logChunk', [B.COBBLE]: 'stoneChunk', [ITEM_SEEDS]: 'seed' };
const ease = t => t * t * (3 - 2 * t);
// Jobs a tame grown-up can learn. It finds a tree, a rock or a grassy patch near by, works at it for a bit
// (the block stays put: it gathers from it), then carries what it got back to whoever taught it.
export const JOBS = [null, 'wood', 'stone', 'seeds', 'follow'];
export const JOB_INFO = {
  wood:  { blocks: [B.LOG], item: B.LOG, n: 1, work: 4 },
  stone: { blocks: [B.STONE, B.COBBLE], item: B.COBBLE, n: 1, work: 4.5 },
  seeds: { blocks: [B.GRASS], item: ITEM_SEEDS, n: 2, work: 3 },
  follow: { follow: true }, // not work: it comes everywhere with you, like a pet
};
const JOB_RANGE = 18, SIDES = [[1, 0], [-1, 0], [0, 1], [0, -1]];
// Every baby gets a name (an index into this list, so it travels and saves as a number).
export const BABY_NAMES = ['Nugget', 'Peep', 'Biscuit', 'Pudding', 'Pip', 'Waffles', 'Mochi', 'Pickle', 'Dumpling', 'Sprout',
  'Button', 'Pebble', 'Muffin', 'Noodle', 'Tofu', 'Bean', 'Sunny', 'Daisy', 'Honey', 'Maple', 'Poppy', 'Toffee', 'Bubbles',
  'Cupcake', 'Jellybean', 'Popcorn', 'Snowy', 'Fluffy', 'Ziggy', 'Coco', 'Peanut', 'Marshmallow', 'Pancake', 'Teacup',
  'Nibbles', 'Squeak', 'Wiggles', 'Dot', 'Cookie', 'Sesame', 'Custard', 'Jelly', 'Bramble', 'Clementine', 'Pom-pom'];
export const babyName = a => a.nick || BABY_NAMES[a.name | 0] || 'Baby';
// A name typed by a player: no control characters, at most 14 letters.
export const cleanAnimalNick = s => typeof s === 'string' ? s.replace(/[\u0000-\u001f]/g, '').trim().slice(0, 14) : '';
export const ANIMAL_HATS = 8; // hats 1..8 from the Wardrobe can go on animals too
const cleanHat = h => Number.isInteger(h) && h > 0 && h <= ANIMAL_HATS ? h : 0;

export const SPECIES_ORDER = ['chick', 'calf', 'piglet', 'lamb', 'pup'];
export const SPECIES = {
  chick:  { name: 'chick', plural: 'chicks', treat: ITEM_SEEDS,  half: 0.2,  height: 0.55, walk: 0.9, run: 2.7, shadow: 0.62, wild: 8, group: [3, 5], ground: [B.GRASS] },
  calf:   { name: 'calf', plural: 'calves', treat: ITEM_WHEAT,  half: 0.27, height: 0.95, walk: 0.7, run: 2.4, shadow: 0.9, wild: 3, group: [2, 3], ground: [B.GRASS], likes: B.HAY, legs: true },
  piglet: { name: 'piglet', plural: 'piglets', treat: ITEM_APPLE,  half: 0.24, height: 0.65, walk: 0.8, run: 2.6, shadow: 0.78, wild: 3, group: [2, 3], ground: [B.MUD, B.GRASS], likes: B.MUD, legs: true },
  lamb:   { name: 'lamb', plural: 'lambs', treat: ITEM_CLOVER, half: 0.26, height: 0.95, walk: 0.8, run: 2.5, shadow: 0.84, wild: 3, group: [2, 4], ground: [B.GRASS, B.SNOW], legs: true, bouncy: true },
  pup:    { name: 'wolf pup', plural: 'wolf pups', treat: ITEM_BONE,   half: 0.22, height: 0.85, walk: 1.0, run: 3.0, shadow: 0.72, wild: 2, group: [2, 3], ground: [B.GRASS], legs: true, wags: true },
};
const TREAT_MODEL = { [ITEM_SEEDS]: 'seed', [ITEM_WHEAT]: 'wheat', [ITEM_APPLE]: 'apple', [ITEM_CLOVER]: 'clover', [ITEM_BONE]: 'bone', [ITEM_EGG]: 'egg', [ITEM_MILK]: 'milk' };
export const isTreat = id => id in TREAT_MODEL;

// Built blocks animals can't hop onto, so a one-block fence keeps them in.
const NO_CLIMB = new Uint8Array(256);
for (const id of [B.PLANKS, B.LOG, B.HAY, B.ROOF, B.CREAM, B.GLASS, B.BRICK, B.COBBLE, B.LAMP, B.CLAY, B.LEAVES, B.FENCE, B.GATE, B.TABLE, B.FEEDER, B.FEEDER_SEEDS, B.FEEDER_WHEAT, B.FEEDER_APPLE, B.FEEDER_CLOVER, B.FEEDER_BONE, B.WOOL, B.DOOR, B.DOOR_TOP, B.PLANTER, B.PLANTER_SEEDED, B.PLANTER_GROWING, B.PLANTER_RIPE]) NO_CLIMB[id] = 1;

export class Nursery {
  constructor(world) {
    this.world = world;
    this.animals = [];
    this.treats = [];
    this.gifts = [];   // eggs, milk, wool and apples the grown-ups left lying about: walk over them to pick them up
    this.bites = [];   // foxes and snakes a grown wolf caught this update: [{ kind, ref, from }]
    this.events = [];
    this.spawnTimer = 3;
    this.grid = new Map();
    this.nextId = 1;
    this.remoteCounts = null; // on a guest: the host's nursery tally
  }

  counts() {
    if (this.remoteCounts) return this.remoteCounts;
    const n = { chick: 0, calf: 0, piglet: 0, lamb: 0, pup: 0 };
    for (const a of this.animals) if (a.tame) n[a.sp]++;
    return n;
  }

  add(sp, x, y, z, tame = false, age = 999) {
    if (this.animals.length >= MAX_ANIMALS) return null;
    const S = SPECIES[sp];
    const a = {
      id: this.nextId++, sp, S, p: [x, y, z], v: [0, 0, 0], yaw: Math.random() * 6.28, onGround: false, gy: y,
      mode: 'wander', t: Math.random() * 2, dir: [0, 0], speed: 0,
      hop: Math.random() * 6, squash: 0, peck: 0, love: 0, cool: 0, wag: 0, wagT: Math.random() * 6,
      spot: null, enjoy: 0, look: Math.random() * 3,
      tame, age, call: 2 + Math.random() * 10, born: 0,
      grow: 0, name: Math.random() * BABY_NAMES.length | 0, gift: GIFT_TIME[0] * Math.random(), bite: 0,
      job: null, trainer: 0, task: null, carry: 0, fails: 0, lost: 0, nick: '', hat: 0,
    };
    this.animals.push(a);
    return a;
  }

  // A small wild group of one species on suitable ground around (x, z).
  spawnGroup(sp, x, z, n, minR = 2, maxR = 7) {
    const S = SPECIES[sp];
    let made = 0;
    for (let tries = 0; tries < n * 8 && made < n; tries++) {
      const ang = Math.random() * 6.28, r = minR + Math.random() * (maxR - minR);
      const px = Math.floor(x + Math.cos(ang) * r), pz = Math.floor(z + Math.sin(ang) * r);
      const y = this.surface(px, pz);
      if (y < 0 || !S.ground.includes(this.world.getBlock(px, y - 1, pz))) continue;
      this.add(sp, px + 0.5, y, pz + 0.5, false);
      made++;
    }
    return made;
  }

  // y of the first air block above the ground at this column (or -1 if unloaded or water).
  surface(x, z) {
    if (!this.world.getChunk(Math.floor(x / CS), Math.floor(z / CS))) return -1;
    for (let y = 70; y > 1; y--) {
      const id = this.world.getBlock(x, y - 1, z);
      if (id === B.WATER) return -1;
      if (SOLID[id]) return y;
    }
    return -1;
  }

  // Filled feeders spill a treat onto the ground beside them now and then, when a baby that likes it is near.
  // Returns the feeders that ran empty.
  feedersStep(feeders, treatOf) {
    const empty = [];
    for (const [x, y, z, id] of feeders) {
      const item = treatOf[id];
      if (item === undefined) continue;
      const c = [x + 0.5, y, z + 0.5];
      if (this.treats.some(s => s.item === item && dist2(s.p, c) < 2.5 * 2.5 && Math.abs(s.p[1] - y) < 2)) continue;
      if (!this.animals.some(a => a.S.treat === item && dist2(a.p, c) < 12 * 12 && Math.abs(a.p[1] - y) < 4)) continue;
      const spots = [[1, 0], [-1, 0], [0, 1], [0, -1]].filter(([dx, dz]) =>
        !SOLID[this.world.getBlock(x + dx, y, z + dz)] && this.world.getBlock(x + dx, y, z + dz) !== B.WATER && SOLID[this.world.getBlock(x + dx, y - 1, z + dz)]);
      if (!spots.length) continue;
      const [dx, dz] = spots[Math.random() * spots.length | 0];
      this.treats.push({ item, p: [x + dx + 0.3 + Math.random() * 0.4, y + 0.005, z + dz + 0.3 + Math.random() * 0.4], v: [0, 0, 0], rest: true, life: 60, yaw: Math.random() * 6.28 });
      if (Math.random() < 1 / 8) empty.push([x, y, z]);
    }
    return empty;
  }

  throwTreat(item, eye, fwd) {
    const pieces = item === ITEM_SEEDS ? 3 : 1;
    for (let k = 0; k < pieces; k++) {
      const spread = pieces > 1 ? (k - 1) * 0.9 : 0;
      const rx = -fwd[2], rz = fwd[0];
      const sp = 5.5 + Math.random() * 1.5;
      this.treats.push({
        item, p: [eye[0] + fwd[0] * 0.4, eye[1] - 0.25, eye[2] + fwd[2] * 0.4],
        v: [fwd[0] * sp + rx * spread, fwd[1] * sp + 2.5, fwd[2] * sp + rz * spread],
        rest: false, life: 90, yaw: Math.random() * 6.28,
      });
    }
    if (this.treats.length > 150) this.treats.splice(0, this.treats.length - 150);
  }

  // A baby in the nursery grows up a bit (by a fraction of the way). Tells everyone when it's all grown.
  // A party cake: every tame animal close by joins in. Babies grow a good bit, everyone gets hearts and a happy hop.
  party(p, r = 14) {
    let n = 0;
    for (const a of this.animals) {
      if (!a.tame || dist2(a.p, p) > r * r || Math.abs(a.p[1] - p[1]) > 6) continue;
      n++;
      if (a.grow < 1) this.growBy(a, MILK_GROW * 0.6);
      a.wag = 1; a.peck = 0.6; a.sleep = false;
      if (a.onGround) a.v[1] = 4.5 + Math.random() * 1.5;
      this.events.push({ type: 'party', sp: a.sp, p: [...a.p] });
    }
    return n;
  }
  // A firework bursting overhead: tame animals close by look up, hop and wag (no growing, unlike a party).
  cheer(p, r = 18) {
    for (const a of this.animals) {
      if (!a.tame || dist2(a.p, p) > r * r || Math.random() < 0.3) continue;
      a.wag = 1; a.sleep = false;
      if (a.onGround) a.v[1] = 3 + Math.random() * 2;
      if (Math.random() < 0.35) this.events.push({ type: 'party', sp: a.sp, p: [...a.p] });
    }
  }
  // The dinner bell: every tame animal within r comes running to stand round it (for up to half a minute).
  callHome(p, r = 70) {
    let n = 0;
    for (const a of this.animals) {
      if (!a.tame || dist2(a.p, p) > r * r) continue;
      const ang = Math.random() * Math.PI * 2, d = 1.6 + Math.random() * 2.4;
      a.callTo = [p[0] + 0.5 + Math.cos(ang) * d, p[1], p[2] + 0.5 + Math.sin(ang) * d];
      a.called = 30; a.sleep = false; a.spot = null; a.enjoy = 0; a.wag = 1;
      n++;
    }
    return n;
  }
  growBy(a, f) {
    if (a.grow >= 1) return;
    a.grow = Math.min(1, a.grow + f);
    if (a.grow === 1) { a.gift = GIFT_TIME[0] * (0.3 + Math.random() * 0.4); this.events.push({ type: 'grown', sp: a.sp, name: a.name, nick: a.nick, p: [...a.p] }); }
  }

  // A pat from a player: a happy hop and a wag, and now and then a little push towards growing up.
  pet(id) {
    const a = this.animals.find(q => q.id === id);
    if (!a || !a.tame) return false;
    a.wag = 1; a.peck = 0.6; a.enjoy = 0; a.sleep = false;
    if (a.onGround) a.v[1] = 3.2;
    if (!(a.petCool > this.clock)) { a.petCool = (this.clock || 0) + 20; this.growBy(a, 0.02); }
    return true;
  }

  // A name a player typed for one of their animals ('' goes back to its own name from the list).
  setNick(id, nick) {
    const a = this.animals.find(q => q.id === id);
    if (!a || !a.tame) return false;
    a.nick = cleanAnimalNick(nick);
    return true;
  }
  nickSnapshot() { return this.animals.filter(a => a.nick).map(a => [a.id, a.nick]); }
  applyNicks(list) {
    const m = new Map(Array.isArray(list) ? list : []);
    for (const a of this.animals) a.nick = cleanAnimalNick(m.get(a.id));
  }
  // Hats: 0 none, or a hat from the Wardrobe list (models.js HATS). Shared like names.
  setHat(id, hat) {
    const a = this.animals.find(q => q.id === id);
    if (!a || !a.tame) return false;
    a.hat = cleanHat(hat);
    return true;
  }
  hatSnapshot() { return this.animals.filter(a => a.hat).map(a => [a.id, a.hat]); }
  applyHats(list) {
    const m = new Map(Array.isArray(list) ? list : []);
    for (const a of this.animals) a.hat = cleanHat(m.get(a.id));
  }

  // A player teaches a tame grown-up a job (or null to let it stop and play). by: who taught it, who it brings things to.
  train(id, job, by = 0) {
    const a = this.animals.find(q => q.id === id);
    if (!a || !a.tame || a.grow < 1) return false;
    a.job = JOB_INFO[job] ? job : null; a.trainer = by; a.task = null; a.carry = 0; a.fails = a.lost = 0; a.avoid = null;
    a.wag = 1; a.peck = 0.6; a.sleep = false; a.spot = null; a.enjoy = 0;
    if (a.onGround) a.v[1] = 3.6;
    this.events.push({ type: 'trained', sp: a.sp, name: a.name, nick: a.nick, job: a.job, by, p: [...a.p] });
    return true;
  }

  // Places to work, nearest first: tree trunks or bits of bare rock with somewhere to stand beside them,
  // or grassy spots to scratch about on. [{ b: block, at: where to stand }], up to 8 of them.
  findWork(a, job, centre = a.p) {
    const world = this.world, J = JOB_INFO[job];
    const bx = Math.floor(centre[0]), by = Math.floor(centre[1] + 0.2), bz = Math.floor(centre[2]);
    const out = [];
    if (job === 'seeds') {
      for (let k = 0; k < 60 && out.length < 8; k++) {
        const ang = Math.random() * 6.28, r = 3 + Math.random() * 11;
        const x = Math.floor(centre[0] + Math.cos(ang) * r), z = Math.floor(centre[2] + Math.sin(ang) * r), y = this.surface(x, z);
        if (y > 0 && Math.abs(y - by) <= 4 && world.getBlock(x, y - 1, z) === B.GRASS && this.standable(x, y, z) && !a.avoid?.includes(x + ',' + z))
          out.push({ b: [x, y - 1, z], at: [x + 0.5, y, z + 0.5], d: r });
      }
    } else {
      const seen = new Set();
      for (let dy = -5; dy <= 5; dy++) for (let dz = -JOB_RANGE; dz <= JOB_RANGE; dz++) for (let dx = -JOB_RANGE; dx <= JOB_RANGE; dx++) {
        const x = bx + dx, y = by + dy, z = bz + dz, key = x + ',' + z;
        if (seen.has(key) || !J.blocks.includes(world.getBlock(x, y, z)) || a.avoid?.includes(key)) continue;
        const d = dx * dx + dz * dz + dy * dy * 3;
        if (job === 'stone' && world.getBlock(x, y, z) === B.STONE && this.standable(x, y + 1, z) && this.surface(x, z) === y + 1) { seen.add(key); out.push({ b: [x, y, z], at: [x + 0.5, y + 1, z + 0.5], d, top: true }); continue; } // chip at the rock it stands on
        for (const [sx, sz] of SIDES) {
          if (!this.standable(x + sx, y, z + sz) || (job === 'stone' && this.surface(x + sx, z + sz) !== y)) continue; // rock out in the open, not down a cave
          seen.add(key);
          out.push({ b: [x, y, z], at: [x + sx + 0.5, y, z + sz + 0.5], d });
          break;
        }
      }
    }
    return out.sort((p, q) => p.d - q.d).slice(0, 8);
  }

  // Somewhere an animal can stand: solid ground under it, no water, and room for its head.
  standable(x, y, z) {
    const w = this.world, id = w.getBlock(x, y, z);
    return !SOLID[id] && id !== B.WATER && !SOLID[w.getBlock(x, y + 1, z)] && SOLID[w.getBlock(x, y - 1, z)];
  }

  // A walk from where the animal is to the nearest of some spots, round hills, fences and water: { path: cell centres
  // to head for, i: which spot } or null if it can't get to any. near: how close counts as there (in blocks).
  // It can hop up one block (not onto fences and walls) and drop down three.
  findPath(a, spots, near = 0, maxNodes = 2500) {
    const w = this.world;
    const sx = Math.floor(a.p[0]), sz = Math.floor(a.p[2]);
    let sy = Math.floor(a.p[1] + 0.2);
    if (!this.standable(sx, sy, sz) && this.standable(sx, sy + 1, sz)) sy++;
    const goals = spots.map(p => [Math.floor(p[0]), Math.floor(p[1] + 0.2), Math.floor(p[2])]);
    const key = (x, y, z) => x + ',' + y + ',' + z;
    const from = new Map([[key(sx, sy, sz), null]]);
    let q = [[sx, sy, sz]], found = null, hit = -1, n = 0;
    while (q.length && !found && n < maxNodes) {
      const next = [];
      for (const c of q) {
        n++;
        hit = goals.findIndex(g => Math.abs(c[0] - g[0]) + Math.abs(c[2] - g[2]) <= near && Math.abs(c[1] - g[1]) <= 1);
        if (hit >= 0) { found = c; break; }
        for (const [dx, dz] of SIDES) {
          const nx = c[0] + dx, nz = c[2] + dz;
          if (Math.abs(nx - sx) > 40 || Math.abs(nz - sz) > 40) continue;
          let ny = null;
          const wall = w.getBlock(nx, c[1], nz);
          if (SOLID[wall]) {
            // a step up: only natural ground, and room to hop
            if (!NO_CLIMB[wall] && !SOLID[w.getBlock(c[0], c[1] + 2, c[2])] && this.standable(nx, c[1] + 1, nz)) ny = c[1] + 1;
          } else if (!SOLID[w.getBlock(nx, c[1] + 1, nz)] && wall !== B.WATER) {
            for (let y = c[1]; y >= c[1] - 3; y--) {
              if (this.standable(nx, y, nz)) { ny = y; break; }
              const id = w.getBlock(nx, y - 1, nz);
              if (SOLID[id] || id === B.WATER) break;
            }
          }
          if (ny === null) continue;
          const k = key(nx, ny, nz);
          if (from.has(k)) continue;
          from.set(k, c);
          next.push([nx, ny, nz]);
        }
      }
      q = next;
    }
    if (!found) return null;
    const path = [];
    for (let c = found; c; c = from.get(key(c[0], c[1], c[2]))) path.push([c[0] + 0.5, c[1], c[2] + 0.5]);
    path.reverse();
    path.shift(); // the cell it's standing in
    return { path, i: hit };
  }

  // Head along a path; returns the next spot to aim for, or null when it's got to the end.
  followPath(a, T) {
    while (T.i < T.path.length) {
      const c = T.path[T.i];
      if (dist2(a.p, c) < 0.4 * 0.4 && Math.abs(a.p[1] - c[1]) < 1.3) { T.i++; T.prog = 4; continue; }
      return c;
    }
    return null;
  }

  // A grown-up taught to follow trots after whoever taught it, finding a way round things, and sits by them
  // when they stop. If it gets left far behind it catches up (it pops up near them).
  followStep(a, dt, pl, T, night) {
    if (!pl) return null;
    const d = dist2(a.p, pl.pos);
    if (d > 40 * 40) {
      for (let k = 0; k < 8; k++) {
        const ang = Math.random() * 6.28, x = pl.pos[0] + Math.cos(ang) * 2.5, z = pl.pos[2] + Math.sin(ang) * 2.5;
        const y = this.surface(Math.floor(x), Math.floor(z));
        if (y > 0 && Math.abs(y - pl.pos[1]) < 3) { a.p = [x, y + 0.05, z]; a.v = [0, 0, 0]; a.gy = y; T.path = null; a.born = 0.6; break; }
      }
      return null;
    }
    if (d < 2.4 * 2.4) T.on = false;
    else if (d > 4.5 * 4.5) T.on = true;
    if (!T.on) return night ? null : { heel: pl.pos }; // close by: sit and look up at you (or doze at night)
    T.re = (T.re || 0) - dt;
    const end = T.path && T.path[T.path.length - 1];
    if (!this._looked && T.re <= 0 && (!T.path || dist2(end, pl.pos) > 2 * 2)) {
      this._looked = true;
      T.path = this.findPath(a, [pl.pos], 2, 1500)?.path || null; T.i = 0; T.re = 1;
    }
    const next = T.path ? this.followPath(a, T) : null;
    return { goal: next || pl.pos, speed: a.S.run * (d > 9 * 9 ? 1.3 : 1) };
  }

  // One step of a working grown-up's day. Returns { goal, speed }, { work: true } while it's busy at a tree or rock,
  // or null when it's having a break between trips (and does the usual wandering about).
  jobStep(a, dt, players, night = false) {
    const J = JOB_INFO[a.job], world = this.world, S = a.S;
    const T = a.task || (a.task = { ph: a.carry ? 'carry' : 'rest', t: 1 + Math.random() * 2 });
    T.t -= dt;
    // whoever taught it (or the host, if they've gone): it works near them and brings things to them
    const pl = players.find(q => (q.id || 0) === a.trainer) || players[0];
    if (J.follow) return this.followStep(a, dt, pl, T, night);
    if (T.ph === 'rest') {
      const far = pl ? dist2(a.p, pl.pos) : 0;
      if (far > 16 * 16 && far < 64 * 64 && T.t > -15) return { goal: pl.pos, speed: S.run * 0.7 }; // wandered off: head back towards you
      if (T.t > 0 || this._looked) return null;
      this._looked = true; // one look round per update keeps things smooth
      const spots = this.findWork(a, a.job, pl && far < 48 * 48 ? pl.pos : a.p);
      const way = spots.length ? this.findPath(a, spots.map(s => s.at)) : null;
      if (!way) {
        T.t = 10;
        if (spots.length) { if (++a.fails === 2) this.events.push({ type: 'stuck', sp: a.sp, name: a.name, nick: a.nick, job: a.job, by: a.trainer, p: [...a.p] }); }
        else if (++a.lost === 2) this.events.push({ type: 'nowork', sp: a.sp, name: a.name, nick: a.nick, job: a.job, by: a.trainer, p: [...a.p] });
        return null;
      }
      const spot = spots[way.i];
      Object.assign(T, { ph: 'go', t: 40, b: spot.b, at: spot.at, top: !!spot.top, path: way.path, i: 0, prog: 4 });
    }
    if (T.ph === 'go') {
      if (!J.blocks.includes(world.getBlock(T.b[0], T.b[1], T.b[2]))) { T.ph = 'rest'; T.t = 0.5; return null; }
      const next = this.followPath(a, T);
      if (!next) { T.ph = 'work'; T.t = J.work; T.knock = 0; }
      else if (T.t <= 0 || (T.prog -= dt) <= 0) {
        // got stuck on the way: try somewhere else in a bit
        (a.avoid || (a.avoid = [])).push(T.b[0] + ',' + T.b[2]);
        if (a.avoid.length > 8) a.avoid.shift();
        T.ph = 'rest'; T.t = 2;
        return null;
      } else return { goal: next, speed: S.run * 0.75 };
    }
    if (T.ph === 'work') {
      T.knock -= dt;
      if (T.knock <= 0) { T.knock = 0.75; a.peck = 0.6; this.events.push({ type: 'work', sp: a.sp, job: a.job, p: [...a.p] }); }
      if (T.t <= 0) { Object.assign(T, { ph: 'carry', t: 60, path: null, i: 0, prog: 6, re: 0 }); a.carry = J.item; a.fails = a.lost = 0; a.avoid = null; a.v[1] = 3; }
      return { work: true };
    }
    // carrying it home: find a way to you (again if you've moved on), then follow it
    if (!pl) return null;
    const d = dist2(a.p, pl.pos);
    if (d > 64 * 64) return null; // you've gone far away: it waits with it
    T.re -= dt;
    const end = T.path && T.path[T.path.length - 1];
    if (!this._looked && T.re <= 0 && (!T.path || dist2(end, pl.pos) > 2.5 * 2.5)) {
      this._looked = true;
      T.path = this.findPath(a, [pl.pos], 1)?.path || null; T.i = 0; T.re = 2; T.prog = 6;
    }
    const next = T.path ? this.followPath(a, T) : null;
    if (!T.path && d < T.best - 0.25) { T.best = d; T.prog = 6; }
    // hand it over, or leave it on the ground if it can't get any closer to you
    if ((d < 1.7 * 1.7 && Math.abs(a.p[1] - pl.pos[1]) < 2) || T.t <= 0 || (T.prog -= dt) <= 0) {
      const near = d < 3 * 3, f = near ? 0.35 : 1;
      const p = near ? [pl.pos[0] + (a.p[0] - pl.pos[0]) * f, a.gy + 0.01, pl.pos[2] + (a.p[2] - pl.pos[2]) * f] : [a.p[0], a.gy + 0.01, a.p[2]];
      if (this.gifts.length < MAX_GIFTS + 20) this.gifts.push({ item: J.item, n: J.n, p, yaw: Math.random() * 6.28, life: 600, t: 0, from: { sp: a.sp, name: a.name, nick: a.nick } });
      this.events.push({ type: 'fetched', sp: a.sp, name: a.name, nick: a.nick, item: J.item, n: J.n, by: a.trainer, near, p: [...a.p] });
      a.carry = 0; a.wag = 1; T.ph = 'rest'; T.t = 8 + Math.random() * 6;
      return null;
    }
    return { goal: next || pl.pos, speed: S.run * 0.85 };
  }

  // Grown-ups' gifts: anyone who walks over one picks it up.
  updateGifts(dt, players) {
    for (const g of this.gifts) {
      g.life -= dt; g.t += dt;
      for (const pl of players) {
        const dx = pl.pos[0] - g.p[0], dz = pl.pos[2] - g.p[2], dy = g.p[1] - pl.pos[1];
        if (dx * dx + dz * dz < 1.1 * 1.1 && dy > -0.6 && dy < 1.8 && g.t > 0.6) {
          g.life = 0;
          this.events.push({ type: 'gift', item: g.item, n: g.n, by: pl.id || 0, from: g.from, p: [...g.p] });
          break;
        }
      }
    }
    this.gifts = this.gifts.filter(g => g.life > 0);
  }

  // players: [{ pos, holding, id }] for everyone in the world (the first is this device's player).
  // threats: positions of snake heads and foxes; night: animals doze off when they have nothing to do.
  // foes: [{ kind, p, ref }] foxes and snakes, for grown wolves to chase off.
  update(dt, players, threats = [], night = false, foes = []) {
    const world = this.world;
    this.clock = (this.clock || 0) + dt;
    this._looked = false;
    this.updateTreats(dt, true);
    this.updateGifts(dt, players);
    this.spawnWild(dt, players);

    // spatial grid for neighbour checks
    const grid = this.grid;
    grid.clear();
    for (const a of this.animals) {
      const k = Math.floor(a.p[0]) * 73856093 ^ Math.floor(a.p[2]) * 19349663;
      let list = grid.get(k);
      if (!list) grid.set(k, list = []);
      list.push(a);
    }

    const babies = [];
    for (const a of this.animals) {
      const S = a.S;
      a.age += dt;
      a.born = Math.max(0, a.born - dt);
      a.cool = Math.max(0, a.cool - dt);
      if (a.love > 0) a.love = Math.max(0, a.love - dt);
      a.bite = Math.max(0, a.bite - dt);
      if (!world.getChunk(Math.floor(a.p[0] / CS), Math.floor(a.p[2] / CS))) continue; // frozen until loaded
      if (a.tame) this.growBy(a, dt / ADULT_TIME);
      const adult = a.grow >= 1, guard = adult && a.tame && a.sp === 'pup';

      // grown-ups leave a gift on the ground now and then
      const gift = adult && a.tame && GIFTS[a.sp];
      if (gift && a.onGround && !a.sleep) {
        a.gift -= dt;
        if (a.gift <= 0) {
          a.gift = GIFT_TIME[0] + Math.random() * (GIFT_TIME[1] - GIFT_TIME[0]);
          if (this.gifts.length < MAX_GIFTS) {
            const back = a.sp === 'piglet' ? -0.45 : -0.3; // eggs and wool land behind, a pig snuffles an apple out in front
            const s = a.sp === 'piglet' ? -1 : 1;
            this.gifts.push({ item: gift[0], n: gift[1], p: [a.p[0] + Math.sin(a.yaw) * back * s, a.gy + 0.01, a.p[2] + Math.cos(a.yaw) * back * s], yaw: Math.random() * 6.28, life: 600, t: 0 });
            this.events.push({ type: 'laid', sp: a.sp, item: gift[0], p: [...a.p] });
          }
        }
      }

      // ---- decide where to go ----
      let goal = null, speed = 0;
      a.flee = Math.max(0, (a.flee || 0) - dt);
      let threat = null, td = 4.5 * 4.5;
      if (!guard) for (const t of threats) { const d = dist2(a.p, t); if (d < td && Math.abs(t[1] - a.p[1]) < 4) { td = d; threat = t; } }
      if (threat) { a.flee = Math.max(a.flee, 1.5); a.fleeFrom = threat; }
      // a grown wolf chases off foxes and snakes that come near the nursery
      let foe = null;
      let homeward = false;
      if (guard) {
        // it chases from where it was standing, but no further than CHASE_LIMIT, then trots back
        a.guardBack = Math.max(0, (a.guardBack || 0) - dt);
        if (!a.home) a.home = [...a.p];
        if (a.guardBack === 0) {
          let fd = GUARD_RANGE * GUARD_RANGE;
          for (const f of foes) { const d = dist2(a.p, f.p); if (d < fd && Math.abs(f.p[1] - a.p[1]) < 4 && dist2(f.p, a.home) < CHASE_LIMIT * CHASE_LIMIT) { fd = d; foe = f; } }
          if (foe && dist2(a.p, a.home) > CHASE_LIMIT * CHASE_LIMIT) { foe = null; a.guardBack = 10; }
          if (!foe) a.home = [...a.p];
        } else if (dist2(a.p, a.home) > 2 * 2) homeward = true;
      }
      const treat = a.flee > 0 || foe ? null : this.nearestTreat(a, 10);
      let cheering = false;
      if (homeward) {
        goal = a.home; speed = S.walk * 1.6;
      } else if (foe) {
        goal = foe.p; speed = S.run * 1.25;
        a.spot = null; a.enjoy = 0; a.sleep = false; a.wag = 1;
        if (dist2(a.p, foe.p) < 1.7 * 1.7 && a.bite === 0) {
          a.bite = 1.4; a.peck = 0.6; a.v[1] = 4;
          this.bites.push({ kind: foe.kind, ref: foe.ref, from: [...a.p] });
          this.events.push({ type: 'woof', sp: a.sp, kind: foe.kind, p: [...a.p] });
        }
      } else if (a.flee > 0 && a.fleeFrom) {
        // run away from the snake
        const dx = a.p[0] - a.fleeFrom[0], dz = a.p[2] - a.fleeFrom[2], l = Math.hypot(dx, dz) || 1;
        goal = [a.p[0] + dx / l * 3, a.p[1], a.p[2] + dz / l * 3]; speed = S.run * 0.85;
        a.spot = null; a.enjoy = 0; a.sleep = false;
      } else if (this.gather && a.gatherSlot) {
        // the king is on the throne: line up in front of it and cheer
        const g = a.gatherSlot;
        if (dist2(a.p, g) > 0.35 * 0.35) { goal = g; speed = S.run * 0.9; }
        else { cheering = true; a.spot = null; a.enjoy = 0; a.sleep = false; }
      } else if (a.called > 0 && a.callTo) {
        // the dinner bell rang: run to it, then a happy hop on arrival
        a.called -= dt;
        if (dist2(a.p, a.callTo) > 0.6 * 0.6) { goal = a.callTo; speed = S.run; }
        else { a.called = 0; a.home = [...a.callTo]; a.wag = 1; if (!a.hiding) { if (a.onGround) a.v[1] = 4; this.events.push({ type: 'party', sp: a.sp, p: [...a.p] }); } }
      } else if (treat) {
        goal = treat.p; speed = S.run;
        if (dist2(a.p, treat.p) < (S.half + 0.3) ** 2 && Math.abs(a.p[1] - treat.p[1]) < 0.8) {
          treat.life = 0;
          a.peck = 0.6;
          if (treat.item === ITEM_MILK) {
            // a drink of milk: a big step towards growing up
            this.growBy(a, MILK_GROW);
            a.spot = null; a.enjoy = 0;
            this.events.push({ type: 'milk', sp: a.sp, p: [...a.p] });
          } else {
            const wasTame = a.tame;
            a.tame = true;
            if (a.cool === 0) a.love = LOVE_TIME;
            a.spot = null; a.enjoy = 0;
            this.events.push({ type: wasTame ? 'eat' : 'tame', sp: a.sp, p: [...a.p] });
          }
        }
      } else if (a.love > 0 && a.cool === 0) {
        const mate = this.nearestMate(a, 9);
        if (mate) {
          goal = mate.p; speed = S.run * 0.8;
          if (dist2(a.p, mate.p) < (S.half * 2 + 0.35) ** 2) {
            a.love = mate.love = 0;
            a.cool = mate.cool = BREED_COOLDOWN;
            babies.push([a.sp, (a.p[0] + mate.p[0]) / 2, Math.max(a.p[1], mate.p[1]) + 0.3, (a.p[2] + mate.p[2]) / 2]);
          }
        }
      }
      // a grown-up with a job goes off to fetch wood, stone or seeds by day
      let working = false, heeling = null;
      if (!goal && !cheering && a.job && a.tame && adult && (!night || a.job === 'follow')) {
        const r = this.jobStep(a, dt, players, night);
        if (r && r.goal) { goal = r.goal; speed = r.speed; a.spot = null; a.enjoy = 0; }
        else if (r && r.work) { working = true; a.spot = null; a.enjoy = 0; }
        else if (r && r.heel) { heeling = r.heel; a.spot = null; a.enjoy = 0; }
      }
      // the nearest player holding this baby's favourite treat
      let lure = null, ld = 14 * 14;
      for (const pl of players) {
        if (pl.holding !== S.treat && !(pl.holding === ITEM_MILK && a.tame && !adult)) continue;
        const d = dist2(a.p, pl.pos);
        if (d < ld) { ld = d; lure = pl; }
      }
      if (!goal && !cheering && !working && !heeling && lure && !foe) {
        const near = 1.4 + S.half * 2;
        if (ld > near * near) { goal = lure.pos; speed = S.run * 0.9; a.spot = null; a.enjoy = 0; }
      }
      // favourite spot: calves munch next to hay, piglets roll in mud
      if (!goal && !cheering && !working && !heeling && a.spot) {
        const sx = a.spot[0] + 0.5, sz = a.spot[2] + 0.5;
        const reach = S.likes === B.HAY ? 1.05 + S.half : 0.35;
        if (dist2(a.p, [sx, 0, sz]) > reach * reach && a.enjoy === 0) { goal = [sx, a.spot[1], sz]; speed = S.walk * 1.2; }
        else if (a.enjoy === 0) {
          a.enjoy = 4 + Math.random() * 5;
          if (S.likes === B.HAY) a.yaw = Math.atan2(sx - a.p[0], sz - a.p[2]);
          this.events.push({ type: S.likes === B.MUD ? 'splash' : 'munch', sp: a.sp, p: [...a.p] });
        }
        if (world.getBlock(a.spot[0], a.spot[1], a.spot[2]) !== S.likes) { a.spot = null; a.enjoy = 0; }
      }
      if (a.enjoy > 0) {
        a.enjoy = Math.max(0, a.enjoy - dt);
        if (a.enjoy === 0) { a.spot = null; a.t = 2 + Math.random() * 3; a.speed = 0; }
      }

      if (goal) a.sleep = false;
      if (goal) {
        const dx = goal[0] - a.p[0], dz = goal[2] - a.p[2], l = Math.hypot(dx, dz) || 1;
        a.dir[0] = dx / l; a.dir[1] = dz / l; a.speed = l < 0.3 ? 0 : speed;
        a.mode = 'goal';
      } else if (cheering) {
        a.speed = 0; a.mode = 'cheer';
        if (a.onGround && Math.random() < dt * 0.9) a.v[1] = 3 + Math.random() * 1.5;   // little hops of joy
      } else if (working) {
        a.speed = 0; a.mode = 'work';
      } else if (heeling) {
        a.speed = 0; a.mode = 'heel';
      } else if (a.hiding) {
        a.speed = 0; a.mode = 'enjoy'; // playing hide and seek: keep still and quiet
      } else if (night && a.enjoy === 0) {
        // night time: curl up and doze
        a.speed = 0; a.mode = 'sleep'; a.sleep = true; a.spot = null;
      } else if (a.enjoy > 0) {
        a.speed = 0; a.mode = 'enjoy';
      } else {
        if (a.mode !== 'wander') a.t = 0;
        a.mode = 'wander';
        a.t -= dt;
        if (a.t <= 0) {
          const spot = S.likes && Math.random() < 0.45 ? this.findNearby(a, S.likes, 7) : null;
          if (spot) a.spot = spot;
          else if (Math.random() < 0.4) { a.speed = 0; a.t = 1 + Math.random() * 2.5; if (Math.random() < 0.6) a.peck = 0.5; }
          else {
            const ang = Math.random() * 6.28;
            a.dir[0] = Math.cos(ang); a.dir[1] = Math.sin(ang); a.speed = S.walk + Math.random() * 0.6; a.t = 1.5 + Math.random() * 3;
          }
        }
        // don't wander into water or off big drops
        if (a.speed > 0 && a.onGround) {
          const ax = Math.floor(a.p[0] + a.dir[0] * (0.4 + S.half)), az = Math.floor(a.p[2] + a.dir[1] * (0.4 + S.half)), fy = Math.floor(a.p[1] + 0.05);
          const ahead = world.getBlock(ax, fy - 1, az), ahead2 = world.getBlock(ax, fy - 2, az);
          if (ahead === B.WATER || (!SOLID[ahead] && !SOLID[ahead2] && !SOLID[world.getBlock(ax, fy - 3, az)])) { a.dir[0] *= -1; a.dir[1] *= -1; }
        }
      }

      // ---- physics ----
      const v = a.v;
      const k = 1 - Math.exp(-(a.onGround ? 10 : 3) * dt);
      v[0] += (a.dir[0] * a.speed - v[0]) * k;
      v[2] += (a.dir[1] * a.speed - v[2]) * k;
      const inWater = world.getBlock(Math.floor(a.p[0]), Math.floor(a.p[1] + 0.25), Math.floor(a.p[2])) === B.WATER;
      if (inWater) v[1] = Math.min(v[1] + 30 * dt, 1.6);
      else v[1] = Math.max(v[1] - GRAVITY * dt, -30);

      // lambs bounce like fluffy little stones
      if (S.bouncy && !adult && a.onGround && a.mode !== 'enjoy' && !a.sleep && Math.random() < dt * (a.love > 0 || a.mode === 'goal' ? 1.4 : 0.35)) v[1] = 4.8 + Math.random() * 1.6;

      // separation from close neighbours
      const gx = Math.floor(a.p[0]), gz = Math.floor(a.p[2]);
      for (let ox = -1; ox <= 1; ox++) for (let oz = -1; oz <= 1; oz++) {
        const list = grid.get((gx + ox) * 73856093 ^ (gz + oz) * 19349663);
        if (!list) continue;
        for (const o of list) {
          if (o === a) continue;
          const dx = a.p[0] - o.p[0], dz = a.p[2] - o.p[2], d = Math.hypot(dx, dz), min = (S.half + o.S.half) * 1.05;
          if (d < min && d > 1e-4 && Math.abs(a.p[1] - o.p[1]) < 0.6) { v[0] += dx / d * 18 * dt; v[2] += dz / d * 18 * dt; }
        }
      }

      const wasGround = a.onGround;
      a.onGround = false;
      let blocked = 0;
      const steps = Math.max(1, Math.ceil(Math.max(Math.abs(v[0]), Math.abs(v[1]), Math.abs(v[2])) * dt / 0.3));
      for (let s = 0; s < steps; s++) {
        this.moveAxis(a, 1, v[1] * dt / steps);
        blocked = Math.max(blocked, this.moveAxis(a, 0, v[0] * dt / steps), this.moveAxis(a, 2, v[2] * dt / steps));
      }
      if (blocked === 1 && a.onGround && a.speed > 0) v[1] = HOP_V;          // hop up natural steps
      else if (blocked === 2 && a.mode === 'wander') a.t = 0;                 // fence: turn around
      if (a.onGround) a.gy = a.p[1];
      if (a.onGround && !wasGround) a.squash = S.bouncy ? -0.2 : -0.14;
      if (a.p[1] < -10) { const s = this.surface(Math.floor(a.p[0]), Math.floor(a.p[2])); a.p[1] = s > 0 ? s : 40; v[1] = 0; }

      // a piglet that finds itself on mud has a roll anyway
      if (S.likes === B.MUD && a.mode === 'wander' && a.onGround && a.speed === 0 && a.enjoy === 0 &&
          world.getBlock(Math.floor(a.p[0]), Math.floor(a.p[1] - 0.5), Math.floor(a.p[2])) === B.MUD && Math.random() < dt * 0.5) {
        a.enjoy = 3 + Math.random() * 4;
        this.events.push({ type: 'splash', sp: a.sp, p: [...a.p] });
      }

      // ---- animation ----
      const hs = Math.hypot(v[0], v[2]);
      let ty = hs > 0.15 ? Math.atan2(v[0], v[2]) : a.yaw;
      if (a.mode === 'goal' && lure && hs <= 0.15) ty = Math.atan2(lure.pos[0] - a.p[0], lure.pos[2] - a.p[2]);
      if (a.mode === 'work' && a.job !== 'seeds' && !a.task.top) ty = Math.atan2(a.task.b[0] + 0.5 - a.p[0], a.task.b[2] + 0.5 - a.p[2]);
      if (a.mode === 'heel' && heeling) ty = Math.atan2(heeling[0] - a.p[0], heeling[2] - a.p[2]);
      if (a.mode === 'cheer') ty = Math.atan2(this.gather.seat[0] - a.p[0], this.gather.seat[2] - a.p[2]);
      let dy = ty - a.yaw;
      dy = Math.atan2(Math.sin(dy), Math.cos(dy));
      a.yaw += dy * Math.min(1, dt * 10);
      if (hs > 0.2 && a.onGround) a.hop += dt * (S.legs ? 5 + hs * 4 : 8 + hs * 4);
      a.squash += (0 - a.squash) * Math.min(1, dt * 10);
      a.peck = Math.max(0, a.peck - dt);
      a.look -= dt;
      if (a.look <= 0) a.look = 2 + Math.random() * 5;

      if (S.wags) {
        let pd2 = Infinity;
        for (const pl of players) pd2 = Math.min(pd2, dist2(a.p, pl.pos));
        const target = lure || a.mode === 'cheer' ? 1 : a.tame && pd2 < 6 * 6 ? 0.6 : a.love > 0 ? 0.8 : 0.12;
        a.wag += (target - a.wag) * Math.min(1, dt * 3);
      } else a.wag += ((a.love > 0 || a.mode === 'goal' ? 0.5 : 0.15) - a.wag) * Math.min(1, dt * 3);
      a.wagT += dt * (4 + a.wag * 14);

      if (!night) a.sleep = false;
      a.call -= a.sleep ? dt * 0.15 : dt;
      if (a.call <= 0) { a.call = (a.sp === 'chick' ? 3 : 6) + Math.random() * 10; this.events.push({ type: 'call', sp: a.sp, p: [...a.p] }); }
    }

    for (const [sp, x, y, z] of babies) {
      const b = this.add(sp, x, y, z, true, 0);
      if (b) { b.born = 0.6; b.v[1] = 3; this.events.push({ type: 'hatch', sp, p: [x, y, z] }); }
    }
  }

  // Every tame baby nearby gathers in curved rows in front of the throne. Returns how many come.
  gatherAt(seat, front) {
    const list = this.animals.filter(a => a.tame && dist2(a.p, seat) < 32 * 32).sort((a, b) => dist2(a.p, seat) - dist2(b.p, seat));
    const rx = -front[1], rz = front[0];
    let i = 0;
    for (let row = 0; i < list.length; row++) {
      const radius = 3.2 + row * 0.95, cap = 6 + row * 3;
      for (let k = 0; k < cap && i < list.length; k++, i++) {
        const ang = (k / (cap - 1) - 0.5) * 2.4;
        const fx = front[0] * Math.cos(ang) + rx * Math.sin(ang), fz = front[1] * Math.cos(ang) + rz * Math.sin(ang);
        list[i].gatherSlot = [seat[0] + fx * radius, seat[1], seat[2] + fz * radius];
      }
    }
    this.gather = { seat };
    return list.length;
  }
  endGather() { this.gather = null; for (const a of this.animals) a.gatherSlot = null; }

  // Keep a few wild animals of each kind around the player; far-off wild ones wander away.
  spawnWild(dt, players) {
    this.spawnTimer -= dt;
    if (this.spawnTimer > 0) return;
    this.spawnTimer = 6;
    // take turns topping up the wild animals around each player
    const player = players[(this.spawnTurn = ((this.spawnTurn || 0) + 1) % players.length)];
    const near = { chick: 0, calf: 0, piglet: 0, lamb: 0, pup: 0 };
    for (const a of this.animals) if (!a.tame && dist2(a.p, player.pos) < 64 * 64) near[a.sp]++;
    const want = SPECIES_ORDER.filter(sp => near[sp] < SPECIES[sp].wild);
    if (want.length) {
      const sp = want[Math.random() * want.length | 0], S = SPECIES[sp];
      const ang = Math.random() * 6.28, r = 26 + Math.random() * 18;
      let x = player.pos[0] + Math.cos(ang) * r, z = player.pos[2] + Math.sin(ang) * r;
      if (S.likes === B.MUD) { const m = this.findMudNear(x, z, 10); if (m) { x = m[0]; z = m[1]; } }
      this.spawnGroup(sp, x, z, S.group[0] + (Math.random() * (S.group[1] - S.group[0] + 1) | 0), 0, 3);
    }
    this.animals = this.animals.filter(a => a.tame || players.some(pl => dist2(a.p, pl.pos) < 96 * 96));
  }

  // ---- play together: the host sends its animals, a guest shows copies of them ----
  // 18 numbers each: id, species + flags, x, y, z, yaw, vx, vz, hop, squash, peck, wag, age, ground y, grown-up, name, job, what it carries.
  snapshot(centre, r) {
    const list = this.animals.filter(a => dist2(a.p, centre) < r * r);
    const f = new Float32Array(list.length * 18);
    let i = 0;
    for (const a of list) {
      const flags = (a.onGround ? 1 : 0) | (a.tame ? 2 : 0) | (a.sleep ? 4 : 0) | (a.enjoy > 0 ? 8 : 0) | (a.love > 0 ? 16 : 0) | (a.mode === 'cheer' ? 32 : 0);
      f[i++] = a.id; f[i++] = SPECIES_ORDER.indexOf(a.sp) + flags * 8;
      f[i++] = a.p[0]; f[i++] = a.p[1]; f[i++] = a.p[2]; f[i++] = a.yaw;
      f[i++] = a.v[0]; f[i++] = a.v[2]; f[i++] = a.hop; f[i++] = a.squash; f[i++] = a.peck; f[i++] = a.wag;
      f[i++] = Math.min(9999, a.age); f[i++] = a.gy; f[i++] = a.grow; f[i++] = a.name; f[i++] = a.job ? JOBS.indexOf(a.job) : 0; f[i++] = a.carry || 0;
    }
    return Array.from(f, v => Math.round(v * 100) / 100); // plain numbers: JSON travels between any two browsers
  }
  applySnapshot(buf) {
    const f = buf, byId = new Map(this.animals.map(a => [a.id, a]));
    const keep = [];
    for (let i = 0; i < f.length; i += 18) {
      const id = f[i], spf = f[i + 1], spi = spf % 8, flags = Math.floor(spf / 8);
      let a = byId.get(id);
      if (!a) {
        a = this.add(SPECIES_ORDER[spi], f[i + 2], f[i + 3], f[i + 4], false, f[i + 12]);
        if (!a) continue;
        this.animals.pop(); a.id = id; a.yaw = f[i + 5];
      }
      a.tp = [f[i + 2], f[i + 3], f[i + 4]]; a.tyaw = f[i + 5];
      a.v[0] = f[i + 6]; a.v[2] = f[i + 7]; a.hop = f[i + 8]; a.squash = f[i + 9]; a.peck = f[i + 10]; a.wag = f[i + 11];
      a.age = f[i + 12]; a.gy = f[i + 13]; a.grow = f[i + 14]; a.name = f[i + 15]; a.job = JOBS[f[i + 16]] || null; a.carry = f[i + 17];
      a.onGround = !!(flags & 1); a.tame = !!(flags & 2); a.sleep = !!(flags & 4); a.enjoy = flags & 8 ? 1 : 0;
      a.love = flags & 16 ? 1 : 0; a.mode = flags & 32 ? 'cheer' : 'wander';
      a.born = Math.max(0, 0.6 - a.age);
      keep.push(a);
    }
    this.animals = keep;
  }
  // Between snapshots: glide the copies towards where the host last saw them and keep them animated.
  puppetStep(dt) {
    const k = Math.min(1, dt * 12);
    for (const a of this.animals) {
      if (!a.tp) continue;
      a.tp[0] += a.v[0] * dt; a.tp[2] += a.v[2] * dt; // keep walking the way they were going until the next update
      const dx = a.tp[0] - a.p[0], dy = a.tp[1] - a.p[1], dz = a.tp[2] - a.p[2];
      if (dx * dx + dy * dy + dz * dz > 16) a.p = [...a.tp];
      else { a.p[0] += dx * k; a.p[1] += dy * k; a.p[2] += dz * k; }
      const dyaw = Math.atan2(Math.sin(a.tyaw - a.yaw), Math.cos(a.tyaw - a.yaw));
      a.yaw += dyaw * k;
      const hs = Math.hypot(a.v[0], a.v[2]);
      if (hs > 0.2 && a.onGround) a.hop += dt * (a.S.legs ? 5 + hs * 4 : 8 + hs * 4);
      a.wagT += dt * (4 + a.wag * 14);
      a.age += dt; a.born = Math.max(0, a.born - dt);
      a.look -= dt;
      if (a.look <= 0) a.look = 2 + Math.random() * 5;
    }
    this.updateTreats(dt);
    for (const g of this.gifts) g.t += dt;
  }
  giftSnapshot() { return this.gifts.map(g => [g.item, g.n, +g.p[0].toFixed(2), +g.p[1].toFixed(2), +g.p[2].toFixed(2), +g.yaw.toFixed(2)]); }
  applyGifts(list) {
    const old = this.gifts;
    this.gifts = list.map(([item, n, x, y, z, yaw]) => {
      const was = old.find(g => g.item === item && Math.abs(g.p[0] - x) < 0.01 && Math.abs(g.p[2] - z) < 0.01);
      return { item, n, p: [x, y, z], yaw, life: 5, t: was ? was.t : 0 };
    });
  }
  treatSnapshot() { return this.treats.map(s => [TREATS_ORDER.indexOf(s.item), +s.p[0].toFixed(2), +s.p[1].toFixed(2), +s.p[2].toFixed(2), +s.yaw.toFixed(2), s.rest ? 1 : 0, +s.v[0].toFixed(2), +s.v[1].toFixed(2), +s.v[2].toFixed(2)]); }
  applyTreats(list) {
    this.treats = list.map(([t, x, y, z, yaw, rest, vx, vy, vz]) => ({ item: TREATS_ORDER[t], p: [x, y, z], v: [vx, vy, vz], yaw, rest: !!rest, life: 5 }));
  }

  findMudNear(x, z, r) {
    for (let k = 0; k < 40; k++) {
      const px = Math.floor(x + (Math.random() * 2 - 1) * r), pz = Math.floor(z + (Math.random() * 2 - 1) * r);
      const y = this.surface(px, pz);
      if (y > 0 && this.world.getBlock(px, y - 1, pz) === B.MUD) return [px + 0.5, pz + 0.5];
    }
    return null;
  }

  // Nearest block of this kind the animal can walk to: hay to stand beside, mud to stand on.
  findNearby(a, id, r) {
    const world = this.world, bx = Math.floor(a.p[0]), by = Math.floor(a.p[1]), bz = Math.floor(a.p[2]);
    let best = null, bd = Infinity;
    for (let dy = -2; dy <= 1; dy++) for (let dz = -r; dz <= r; dz++) for (let dx = -r; dx <= r; dx++) {
      const x = bx + dx, y = by + dy, z = bz + dz;
      if (world.getBlock(x, y, z) !== id) continue;
      if (id === B.MUD && SOLID[world.getBlock(x, y + 1, z)]) continue;
      if (id === B.HAY && dy < -1) continue;
      const d = dx * dx + dz * dz + dy * dy * 2;
      if (d < bd) { bd = d; best = [x, y, z]; }
    }
    return best;
  }

  // Returns 0 if free, 1 if blocked by a climbable step, 2 if blocked by a fence or wall.
  moveAxis(a, axis, d) {
    if (!d) return 0;
    const p = a.p, world = this.world, half = a.S.half, height = a.S.height;
    p[axis] += d;
    const x0 = Math.floor(p[0] - half), x1 = Math.floor(p[0] + half - 1e-7);
    const y0 = Math.floor(p[1]), y1 = Math.floor(p[1] + height - 1e-7);
    const z0 = Math.floor(p[2] - half), z1 = Math.floor(p[2] + half - 1e-7);
    for (let y = y0; y <= y1; y++) for (let z = z0; z <= z1; z++) for (let x = x0; x <= x1; x++) {
      const id = world.getBlock(x, y, z);
      if (!SOLID[id]) continue;
      if (axis === 1) {
        if (d > 0) p[1] = y - height - 1e-4; else { p[1] = y + 1; a.onGround = true; }
        a.v[1] = 0;
        return 0;
      }
      const b = axis === 0 ? x : z;
      p[axis] = d > 0 ? b - half - 1e-4 : b + 1 + half + 1e-4;
      a.v[axis] = 0;
      if (NO_CLIMB[id]) return 2;
      const free = !SOLID[world.getBlock(x, y + 1, z)] && !SOLID[world.getBlock(x, y + 2, z)];
      return y === y0 && free ? 1 : 2;
    }
    return 0;
  }

  // live: this device runs the nursery (not a guest's copy), so a thrown egg that lands hatches here.
  updateTreats(dt, live = false) {
    const world = this.world;
    for (const s of this.treats) {
      s.life -= dt;
      if (s.rest) continue;
      s.v[1] -= 18 * dt;
      const np = [s.p[0] + s.v[0] * dt, s.p[1] + s.v[1] * dt, s.p[2] + s.v[2] * dt];
      const id = world.getBlock(Math.floor(np[0]), Math.floor(np[1]), Math.floor(np[2]));
      if (SOLID[id] || id === B.WATER) {
        if (Math.floor(np[1]) < Math.floor(s.p[1]) && s.v[1] < 0) {
          if (id === B.WATER) { s.life = 0; continue; }
          s.p = [np[0], Math.floor(np[1]) + 1.005, np[2]];
          s.rest = true;
          if (s.item === ITEM_EGG && live) {
            // crack! out pops a chick, already part of your nursery
            s.life = 0;
            const b = this.add('chick', s.p[0], s.p[1], s.p[2], true, 0);
            if (b) { b.born = 0.6; b.v[1] = 3; this.events.push({ type: 'hatch', sp: 'chick', egg: 1, p: [...s.p] }); }
          }
        } else { s.v[0] *= -0.2; s.v[2] *= -0.2; }
      } else s.p = np;
      if (s.p[1] < -5) s.life = 0;
    }
    this.treats = this.treats.filter(s => s.life > 0);
  }

  nearestTreat(a, r) {
    let best = null, bd = r * r;
    const want = a.S.treat, milk = a.tame && a.grow < 1;
    for (const s of this.treats) {
      if (!s.rest || (s.item !== want && !(milk && s.item === ITEM_MILK))) continue;
      const d = dist2(a.p, s.p);
      if (d < bd && Math.abs(s.p[1] - a.p[1]) < 3) { bd = d; best = s; }
    }
    return best;
  }

  nearestMate(a, r) {
    let best = null, bd = r * r;
    for (const o of this.animals) {
      if (o === a || o.sp !== a.sp || o.love <= 0 || o.cool > 0) continue;
      const d = dist2(a.p, o.p);
      if (d < bd) { bd = d; best = o; }
    }
    return best;
  }

  // Per-instance data for the renderer: [x, y, z, yaw] [scale, hop, flap/stride, squash] [wag, nod, 0, 0].
  instances(eye, maxDist, time) {
    const md2 = maxDist * maxDist;
    const buf = this._buf || (this._buf = {});
    const need = (key, n) => (buf[key] && buf[key].length >= n * 12) ? buf[key] : (buf[key] = new Float32Array(n * 12 + 240));
    const cnt = {};
    for (const sp of [...SPECIES_ORDER, 'hen']) { need(sp, this.animals.length); cnt[sp] = 0; }
    const sh = need('shadow', this.animals.length + this.gifts.length);
    let si = 0;
    for (const a of this.animals) {
      if (dist2(a.p, eye) > md2) continue;
      const S = a.S;
      // newborns fill out over their first couple of minutes, then grow up slowly in the nursery
      const grow = (0.55 + 0.45 * Math.min(1, a.age / GROW_TIME)) * (1 + (ADULT_SCALE - 1) * ease(a.grow || 0));
      const pop = a.born > 0 ? 1 - a.born / 0.6 : 1;
      const scale = grow * (pop < 1 ? 0.3 + 0.7 * pop : 1);
      a._sc = scale;
      const model = (a.sp === 'chick' && a.grow >= 1 ? 'hen' : a.sp) + (a.hat ? '~' + a.hat : '');
      if (!buf[model] || buf[model].length < this.animals.length * 12) need(model, this.animals.length);
      if (cnt[model] === undefined) cnt[model] = 0;
      const hs = Math.hypot(a.v[0], a.v[2]);
      const moving = hs > 0.2 && a.onGround;
      let hop, flap, squash, nod = 0;
      const enjoy = a.enjoy > 0;
      if (S.legs) {
        hop = moving ? Math.abs(Math.sin(a.hop)) * 0.035 : 0;
        flap = moving ? Math.sin(a.hop) * Math.min(0.75, 0.25 + hs * 0.25) : 0;
        squash = a.squash + (moving ? -0.025 * Math.cos(a.hop * 2) : 0);
        if (a.peck > 0) nod = 0.55 * Math.sin(Math.min(1, a.peck / 0.6) * Math.PI);
        else if (enjoy && S.likes === B.HAY) nod = 0.45 + 0.12 * Math.sin(time * 9 + a.wagT);       // munching hay
        else if (!moving && a.look < 1) nod = 0.3 * Math.sin(a.look * Math.PI);                      // sniffing the grass
        if (enjoy && S.likes === B.MUD) {                                                            // rolling in the mud
          squash = -0.12 + 0.08 * Math.sin(time * 7 + a.wagT);
          hop = -0.08;
        }
      } else {
        hop = moving ? Math.abs(Math.sin(a.hop)) * 0.08 : 0;
        const excited = a.love > 0 || !a.onGround;
        flap = excited ? 0.5 + 0.45 * Math.sin(time * 28 + a.hop) : 0.06 * Math.sin(time * 3 + a.hop);
        const peck = a.peck > 0 ? -0.1 * Math.sin(a.peck * 30) ** 2 : 0;
        squash = a.squash + (moving ? -0.05 * Math.cos(a.hop * 2) : 0) + peck;
      }
      if (a.sleep && a.onGround) {
        // dozing: settle down low, head drooping, slow breathing
        squash = -0.13 + 0.025 * Math.sin(time * 1.6 + a.wagT);
        hop = S.legs ? -0.06 : 0;
        nod = S.legs ? 0.4 : 0;
        if (!S.legs) flap = 0;
      }
      const wag = a.sleep ? 0 : Math.sin(a.wagT) * (S.wags ? 0.75 : 0.35) * a.wag;
      let yaw = a.yaw;
      if (enjoy && S.likes === B.MUD) yaw += 0.35 * Math.sin(time * 3.5 + a.wagT);
      const d = buf[model];
      let i = cnt[model]++ * 12;
      d[i++] = a.p[0]; d[i++] = a.p[1]; d[i++] = a.p[2]; d[i++] = yaw;
      d[i++] = scale; d[i++] = hop; d[i++] = flap; d[i++] = squash;
      d[i++] = wag; d[i++] = nod; d[i++] = 0; d[i++] = 0;
      const lift = Math.max(0, a.p[1] - a.gy);
      sh[si++] = a.p[0]; sh[si++] = a.gy + 0.015; sh[si++] = a.p[2]; sh[si++] = 0;
      sh[si++] = scale * S.shadow * Math.max(0.4, 1 - lift * 0.3); sh[si++] = 0; sh[si++] = 0; sh[si++] = 0;
      si += 4;
    }
    const groups = Object.keys(cnt).map(m => ({ model: m, data: buf[m], count: cnt[m] }));

    // the grown-ups' gifts: bob gently and turn so they catch your eye
    const gcnt = {};
    for (const m of Object.values(GIFT_MODEL)) { need('g_' + m, this.gifts.length + this.animals.length); gcnt[m] = 0; }
    for (const g of this.gifts) {
      if (dist2(g.p, eye) > md2) continue;
      const m = GIFT_MODEL[g.item];
      if (!m) continue;
      const d = buf['g_' + m], pop = Math.min(1, g.t / 0.35), s = 1.25 * (0.4 + 0.6 * pop);
      let i = gcnt[m]++ * 12;
      d[i++] = g.p[0]; d[i++] = g.p[1] + 0.04 + 0.04 * Math.sin(time * 2.6 + g.yaw); d[i++] = g.p[2]; d[i++] = g.yaw + time * 0.8;
      d[i++] = s; d[i++] = 0; d[i++] = 0; d[i++] = 0; d[i++] = 0; d[i++] = 0; d[i++] = 0; d[i++] = 0;
      sh[si++] = g.p[0]; sh[si++] = g.p[1] + 0.005; sh[si++] = g.p[2]; sh[si++] = 0;
      sh[si++] = 0.3 * s; sh[si++] = 0; sh[si++] = 0; sh[si++] = 0;
      si += 4;
    }
    // a working grown-up carries what it found home on its back
    for (const a of this.animals) {
      const m = a.carry && GIFT_MODEL[a.carry];
      if (!m || dist2(a.p, eye) > md2) continue;
      const d = buf['g_' + m], sc = a._sc || 1, back = -0.06 * sc, bob = Math.abs(Math.sin(a.hop)) * 0.03;
      let i = gcnt[m]++ * 12;
      d[i++] = a.p[0] + Math.sin(a.yaw) * back; d[i++] = a.p[1] + a.S.height * sc * (a.sp === 'chick' ? 0.85 : 0.78) + bob; d[i++] = a.p[2] + Math.cos(a.yaw) * back; d[i++] = a.yaw + Math.PI / 2;
      d[i++] = a.carry === ITEM_SEEDS ? 2 : 0.95; d[i++] = 0; d[i++] = 0; d[i++] = 0; d[i++] = 0; d[i++] = 0; d[i++] = 0; d[i++] = 0;
    }
    for (const m of Object.values(GIFT_MODEL)) groups.push({ model: m, data: buf['g_' + m], count: gcnt[m] });

    const tcnt = {};
    for (const m of Object.values(TREAT_MODEL)) { need('t_' + m, this.treats.length); tcnt[m] = 0; }
    for (const s of this.treats) {
      if (dist2(s.p, eye) > md2) continue;
      const m = TREAT_MODEL[s.item], d = buf['t_' + m];
      let i = tcnt[m]++ * 12;
      d[i++] = s.p[0]; d[i++] = s.p[1]; d[i++] = s.p[2]; d[i++] = s.yaw;
      d[i++] = 1; d[i++] = 0; d[i++] = 0; d[i++] = 0; d[i++] = 0; d[i++] = 0; d[i++] = 0; d[i++] = 0;
    }
    for (const m of Object.values(TREAT_MODEL)) groups.push({ model: m, data: buf['t_' + m], count: tcnt[m] });
    return { groups, shadowGroups: [{ data: sh, count: si / 12 }] };
  }

  serialize() {
    return this.animals.filter(a => a.tame).map(a => [SPECIES_ORDER.indexOf(a.sp), +a.p[0].toFixed(2), +a.p[1].toFixed(2), +a.p[2].toFixed(2), Math.min(999, Math.round(a.age)), +a.grow.toFixed(4), a.name, a.job ? JOBS.indexOf(a.job) : 0, a.nick || 0, a.hat || 0]);
  }
  load(list) {
    for (const [s, x, y, z, age, grow, name, job, nick, hat] of list || []) {
      const a = SPECIES_ORDER[s] && this.add(SPECIES_ORDER[s], x, y, z, true, age);
      if (a) { a.grow = Math.max(0, Math.min(1, grow || 0)); if (BABY_NAMES[name]) a.name = name; if (a.grow >= 1) a.job = JOBS[job] || null; a.nick = cleanAnimalNick(nick); a.hat = cleanHat(hat); }
    }
  }
  serializeGifts() { return this.gifts.map(g => [g.item, g.n, +g.p[0].toFixed(2), +g.p[1].toFixed(2), +g.p[2].toFixed(2)]); }
  loadGifts(list) {
    this.gifts = (list || []).slice(0, MAX_GIFTS).map(([item, n, x, y, z]) => ({ item, n, p: [x, y, z], yaw: Math.random() * 6.28, life: 600, t: 1 }));
  }
  // Saves from before the other animals arrived: [x, y, z, age] chicks.
  loadChicks(list) {
    for (const [x, y, z, age] of list || []) this.add('chick', x, y, z, true, age);
  }
}

function dist2(a, b) { const dx = a[0] - b[0], dz = a[2] - b[2]; return dx * dx + dz * dz; }
