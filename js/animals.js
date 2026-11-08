// The nursery: baby chicks, calves, piglets, lambs and wolf pups.
// They wander, follow you while you hold their favourite treat, eat it to join your nursery,
// pair up for a baby, and each kind has its own habits (calves munch by hay, piglets roll in mud,
// lambs bounce, pups wag their tails).
import { B, SOLID, ITEM_SEEDS, ITEM_WHEAT, ITEM_APPLE, ITEM_CLOVER, ITEM_BONE, TREATS as TREATS_ORDER } from './blocks.js';
import { CS } from './world.js';

const GRAVITY = 20, HOP_V = 6.8;
const MAX_ANIMALS = 500;
const LOVE_TIME = 25, BREED_COOLDOWN = 25, GROW_TIME = 120;

export const SPECIES_ORDER = ['chick', 'calf', 'piglet', 'lamb', 'pup'];
export const SPECIES = {
  chick:  { name: 'chick', plural: 'chicks', treat: ITEM_SEEDS,  half: 0.2,  height: 0.55, walk: 0.9, run: 2.7, shadow: 0.62, wild: 8, group: [3, 5], ground: [B.GRASS] },
  calf:   { name: 'calf', plural: 'calves', treat: ITEM_WHEAT,  half: 0.27, height: 0.95, walk: 0.7, run: 2.4, shadow: 0.9, wild: 3, group: [2, 3], ground: [B.GRASS], likes: B.HAY, legs: true },
  piglet: { name: 'piglet', plural: 'piglets', treat: ITEM_APPLE,  half: 0.24, height: 0.65, walk: 0.8, run: 2.6, shadow: 0.78, wild: 3, group: [2, 3], ground: [B.MUD, B.GRASS], likes: B.MUD, legs: true },
  lamb:   { name: 'lamb', plural: 'lambs', treat: ITEM_CLOVER, half: 0.26, height: 0.95, walk: 0.8, run: 2.5, shadow: 0.84, wild: 3, group: [2, 4], ground: [B.GRASS, B.SNOW], legs: true, bouncy: true },
  pup:    { name: 'wolf pup', plural: 'wolf pups', treat: ITEM_BONE,   half: 0.22, height: 0.85, walk: 1.0, run: 3.0, shadow: 0.72, wild: 2, group: [2, 3], ground: [B.GRASS], legs: true, wags: true },
};
const TREAT_MODEL = { [ITEM_SEEDS]: 'seed', [ITEM_WHEAT]: 'wheat', [ITEM_APPLE]: 'apple', [ITEM_CLOVER]: 'clover', [ITEM_BONE]: 'bone' };
export const isTreat = id => id in TREAT_MODEL;

// Built blocks animals can't hop onto, so a one-block fence keeps them in.
const NO_CLIMB = new Uint8Array(256);
for (const id of [B.PLANKS, B.LOG, B.HAY, B.ROOF, B.CREAM, B.GLASS, B.BRICK, B.COBBLE, B.LAMP, B.CLAY, B.LEAVES, B.FENCE, B.GATE]) NO_CLIMB[id] = 1;

export class Nursery {
  constructor(world) {
    this.world = world;
    this.animals = [];
    this.treats = [];
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

  // players: [{ pos, holding }] for everyone in the world (the first is this device's player).
  // threats: positions of snake heads; night: animals doze off when they have nothing to do.
  update(dt, players, threats = [], night = false) {
    const world = this.world;
    this.updateTreats(dt);
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
      if (!world.getChunk(Math.floor(a.p[0] / CS), Math.floor(a.p[2] / CS))) continue; // frozen until loaded

      // ---- decide where to go ----
      let goal = null, speed = 0;
      a.flee = Math.max(0, (a.flee || 0) - dt);
      let threat = null, td = 4.5 * 4.5;
      for (const t of threats) { const d = dist2(a.p, t); if (d < td && Math.abs(t[1] - a.p[1]) < 4) { td = d; threat = t; } }
      if (threat) { a.flee = Math.max(a.flee, 1.5); a.fleeFrom = threat; }
      const treat = a.flee > 0 ? null : this.nearestTreat(a, 10);
      let cheering = false;
      if (a.flee > 0 && a.fleeFrom) {
        // run away from the snake
        const dx = a.p[0] - a.fleeFrom[0], dz = a.p[2] - a.fleeFrom[2], l = Math.hypot(dx, dz) || 1;
        goal = [a.p[0] + dx / l * 3, a.p[1], a.p[2] + dz / l * 3]; speed = S.run * 0.85;
        a.spot = null; a.enjoy = 0; a.sleep = false;
      } else if (this.gather && a.gatherSlot) {
        // the king is on the throne: line up in front of it and cheer
        const g = a.gatherSlot;
        if (dist2(a.p, g) > 0.35 * 0.35) { goal = g; speed = S.run * 0.9; }
        else { cheering = true; a.spot = null; a.enjoy = 0; a.sleep = false; }
      } else if (treat) {
        goal = treat.p; speed = S.run;
        if (dist2(a.p, treat.p) < (S.half + 0.3) ** 2 && Math.abs(a.p[1] - treat.p[1]) < 0.8) {
          treat.life = 0;
          a.peck = 0.6;
          const wasTame = a.tame;
          a.tame = true;
          if (a.cool === 0) a.love = LOVE_TIME;
          a.spot = null; a.enjoy = 0;
          this.events.push({ type: wasTame ? 'eat' : 'tame', sp: a.sp, p: [...a.p] });
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
      // the nearest player holding this baby's favourite treat
      let lure = null, ld = 14 * 14;
      for (const pl of players) {
        if (pl.holding !== S.treat) continue;
        const d = dist2(a.p, pl.pos);
        if (d < ld) { ld = d; lure = pl; }
      }
      if (!goal && !cheering && lure) {
        const near = 1.4 + S.half * 2;
        if (ld > near * near) { goal = lure.pos; speed = S.run * 0.9; a.spot = null; a.enjoy = 0; }
      }
      // favourite spot: calves munch next to hay, piglets roll in mud
      if (!goal && !cheering && a.spot) {
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
      if (S.bouncy && a.onGround && a.mode !== 'enjoy' && !a.sleep && Math.random() < dt * (a.love > 0 || a.mode === 'goal' ? 1.4 : 0.35)) v[1] = 4.8 + Math.random() * 1.6;

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
  // 14 numbers each: id, species + flags, x, y, z, yaw, vx, vz, hop, squash, peck, wag, age, ground y.
  snapshot(centre, r) {
    const list = this.animals.filter(a => dist2(a.p, centre) < r * r);
    const f = new Float32Array(list.length * 14);
    let i = 0;
    for (const a of list) {
      const flags = (a.onGround ? 1 : 0) | (a.tame ? 2 : 0) | (a.sleep ? 4 : 0) | (a.enjoy > 0 ? 8 : 0) | (a.love > 0 ? 16 : 0) | (a.mode === 'cheer' ? 32 : 0);
      f[i++] = a.id; f[i++] = SPECIES_ORDER.indexOf(a.sp) + flags * 8;
      f[i++] = a.p[0]; f[i++] = a.p[1]; f[i++] = a.p[2]; f[i++] = a.yaw;
      f[i++] = a.v[0]; f[i++] = a.v[2]; f[i++] = a.hop; f[i++] = a.squash; f[i++] = a.peck; f[i++] = a.wag;
      f[i++] = Math.min(9999, a.age); f[i++] = a.gy;
    }
    return Array.from(f, v => Math.round(v * 100) / 100); // plain numbers: JSON travels between any two browsers
  }
  applySnapshot(buf) {
    const f = buf, byId = new Map(this.animals.map(a => [a.id, a]));
    const keep = [];
    for (let i = 0; i < f.length; i += 14) {
      const id = f[i], spf = f[i + 1], spi = spf % 8, flags = Math.floor(spf / 8);
      let a = byId.get(id);
      if (!a) {
        a = this.add(SPECIES_ORDER[spi], f[i + 2], f[i + 3], f[i + 4], false, f[i + 12]);
        if (!a) continue;
        this.animals.pop(); a.id = id; a.yaw = f[i + 5];
      }
      a.tp = [f[i + 2], f[i + 3], f[i + 4]]; a.tyaw = f[i + 5];
      a.v[0] = f[i + 6]; a.v[2] = f[i + 7]; a.hop = f[i + 8]; a.squash = f[i + 9]; a.peck = f[i + 10]; a.wag = f[i + 11];
      a.age = f[i + 12]; a.gy = f[i + 13];
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

  updateTreats(dt) {
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
        } else { s.v[0] *= -0.2; s.v[2] *= -0.2; }
      } else s.p = np;
      if (s.p[1] < -5) s.life = 0;
    }
    this.treats = this.treats.filter(s => s.life > 0);
  }

  nearestTreat(a, r) {
    let best = null, bd = r * r;
    const want = a.S.treat;
    for (const s of this.treats) {
      if (!s.rest || s.item !== want) continue;
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
    for (const sp of SPECIES_ORDER) { need(sp, this.animals.length); cnt[sp] = 0; }
    const sh = need('shadow', this.animals.length);
    let si = 0;
    for (const a of this.animals) {
      if (dist2(a.p, eye) > md2) continue;
      const S = a.S;
      const grow = 0.55 + 0.45 * Math.min(1, a.age / GROW_TIME);
      const pop = a.born > 0 ? 1 - a.born / 0.6 : 1;
      const scale = grow * (pop < 1 ? 0.3 + 0.7 * pop : 1);
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
      const d = buf[a.sp];
      let i = cnt[a.sp]++ * 12;
      d[i++] = a.p[0]; d[i++] = a.p[1]; d[i++] = a.p[2]; d[i++] = yaw;
      d[i++] = scale; d[i++] = hop; d[i++] = flap; d[i++] = squash;
      d[i++] = wag; d[i++] = nod; d[i++] = 0; d[i++] = 0;
      const lift = Math.max(0, a.p[1] - a.gy);
      sh[si++] = a.p[0]; sh[si++] = a.gy + 0.015; sh[si++] = a.p[2]; sh[si++] = 0;
      sh[si++] = scale * S.shadow * Math.max(0.4, 1 - lift * 0.3); sh[si++] = 0; sh[si++] = 0; sh[si++] = 0;
      si += 4;
    }
    const groups = SPECIES_ORDER.map(sp => ({ model: sp, data: buf[sp], count: cnt[sp] }));

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
    return this.animals.filter(a => a.tame).map(a => [SPECIES_ORDER.indexOf(a.sp), +a.p[0].toFixed(2), +a.p[1].toFixed(2), +a.p[2].toFixed(2), Math.min(999, Math.round(a.age))]);
  }
  load(list) {
    for (const [s, x, y, z, age] of list || []) if (SPECIES_ORDER[s]) this.add(SPECIES_ORDER[s], x, y, z, true, age);
  }
  // Saves from before the other animals arrived: [x, y, z, age] chicks.
  loadChicks(list) {
    for (const [x, y, z, age] of list || []) this.add('chick', x, y, z, true, age);
  }
}

function dist2(a, b) { const dx = a[0] - b[0], dz = a[2] - b[2]; return dx * dx + dz * dz; }
