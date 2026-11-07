// Baby chicks: wandering, following the seed pouch, eating thrown seeds and hatching new babies.
import { B, SOLID } from './blocks.js';
import { CS } from './world.js';

const HALF = 0.2, HEIGHT = 0.55, GRAVITY = 20, HOP_V = 6.8;
const MAX_CHICKS = 400;
const LOVE_TIME = 25, BREED_COOLDOWN = 25;

// Built blocks chicks can't hop onto, so a one-block fence keeps them in.
const NO_CLIMB = new Uint8Array(256);
for (const id of [B.PLANKS, B.LOG, B.HAY, B.ROOF, B.CREAM, B.GLASS, B.BRICK, B.COBBLE, B.LAMP, B.CLAY, B.LEAVES]) NO_CLIMB[id] = 1;

export class Flock {
  constructor(world) {
    this.world = world;
    this.chicks = [];
    this.seeds = [];
    this.events = [];
    this.spawnTimer = 3;
    this.grid = new Map();
  }

  get tameCount() { let n = 0; for (const c of this.chicks) if (c.tame) n++; return n; }

  add(x, y, z, tame = false, age = 999) {
    if (this.chicks.length >= MAX_CHICKS) return null;
    const c = {
      p: [x, y, z], v: [0, 0, 0], yaw: Math.random() * 6.28, onGround: false, gy: y,
      mode: 'wander', t: Math.random() * 2, dir: [0, 0], speed: 0,
      hop: Math.random() * 6, flap: 0, squash: 0, peck: 0, love: 0, cool: 0,
      tame, age, cheep: 2 + Math.random() * 8, born: 0,
    };
    this.chicks.push(c);
    return c;
  }

  // A small flock of wild chicks on grass around (x, z).
  spawnGroup(x, z, n, minR = 2, maxR = 7) {
    let made = 0;
    for (let tries = 0; tries < n * 6 && made < n; tries++) {
      const a = Math.random() * 6.28, r = minR + Math.random() * (maxR - minR);
      const px = Math.floor(x + Math.cos(a) * r), pz = Math.floor(z + Math.sin(a) * r);
      const y = this.surface(px, pz);
      if (y < 0 || this.world.getBlock(px, y - 1, pz) !== B.GRASS) continue;
      this.add(px + 0.5, y, pz + 0.5, false);
      made++;
    }
    return made;
  }

  // y of the first air block above the ground at this column (or -1 if the chunk isn't loaded).
  surface(x, z) {
    if (!this.world.getChunk(Math.floor(x / CS), Math.floor(z / CS))) return -1;
    for (let y = 70; y > 1; y--) if (SOLID[this.world.getBlock(x, y - 1, z)] || this.world.getBlock(x, y - 1, z) === B.WATER) {
      return this.world.getBlock(x, y - 1, z) === B.WATER ? -1 : y;
    }
    return -1;
  }

  throwSeeds(eye, fwd) {
    for (let k = 0; k < 3; k++) {
      const spread = (k - 1) * 0.9;
      const rx = -fwd[2], rz = fwd[0];
      const sp = 5.5 + Math.random() * 1.5;
      this.seeds.push({
        p: [eye[0] + fwd[0] * 0.4, eye[1] - 0.25, eye[2] + fwd[2] * 0.4],
        v: [fwd[0] * sp + rx * spread, fwd[1] * sp + 2.5, fwd[2] * sp + rz * spread],
        rest: false, life: 90, yaw: Math.random() * 6.28,
      });
    }
    if (this.seeds.length > 120) this.seeds.splice(0, this.seeds.length - 120);
  }

  update(dt, player, holdingSeeds) {
    const world = this.world;
    this.updateSeeds(dt);

    // keep some wild chicks around the player
    this.spawnTimer -= dt;
    if (this.spawnTimer <= 0) {
      this.spawnTimer = 8;
      let wildNear = 0;
      for (const c of this.chicks) if (!c.tame && dist2(c.p, player.pos) < 64 * 64) wildNear++;
      if (wildNear < 8) {
        const a = Math.random() * 6.28, r = 26 + Math.random() * 18;
        this.spawnGroup(player.pos[0] + Math.cos(a) * r, player.pos[2] + Math.sin(a) * r, 3 + (Math.random() * 2 | 0), 0, 3);
      }
      // wild chicks far away wander off for good
      this.chicks = this.chicks.filter(c => c.tame || dist2(c.p, player.pos) < 96 * 96);
    }

    // spatial grid for neighbour checks
    const grid = this.grid;
    grid.clear();
    for (const c of this.chicks) {
      const k = Math.floor(c.p[0]) * 73856093 ^ Math.floor(c.p[2]) * 19349663;
      let list = grid.get(k);
      if (!list) grid.set(k, list = []);
      list.push(c);
    }

    const babies = [];
    for (const c of this.chicks) {
      c.age += dt;
      c.born = Math.max(0, c.born - dt);
      c.cool = Math.max(0, c.cool - dt);
      if (c.love > 0) c.love = Math.max(0, c.love - dt);
      if (!world.getChunk(Math.floor(c.p[0] / CS), Math.floor(c.p[2] / CS))) continue; // frozen until loaded

      // ---- decide where to go ----
      let goal = null, speed = 0;
      const seed = this.nearestSeed(c, 10);
      if (seed) {
        goal = seed.p; speed = 2.7;
        if (dist2(c.p, seed.p) < 0.5 * 0.5 && Math.abs(c.p[1] - seed.p[1]) < 0.8) {
          seed.life = 0;
          c.peck = 0.35;
          const wasTame = c.tame;
          c.tame = true;
          if (c.cool === 0) c.love = LOVE_TIME;
          this.events.push({ type: wasTame ? 'eat' : 'tame', p: [...c.p] });
        }
      } else if (c.love > 0 && c.cool === 0) {
        const mate = this.nearestMate(c, 9);
        if (mate) {
          goal = mate.p; speed = 2.2;
          if (dist2(c.p, mate.p) < 0.75 * 0.75) {
            c.love = mate.love = 0;
            c.cool = mate.cool = BREED_COOLDOWN;
            babies.push([(c.p[0] + mate.p[0]) / 2, Math.max(c.p[1], mate.p[1]) + 0.3, (c.p[2] + mate.p[2]) / 2]);
          }
        }
      }
      if (!goal && holdingSeeds) {
        const d2 = dist2(c.p, player.pos);
        if (d2 < 14 * 14 && d2 > 1.8 * 1.8) { goal = player.pos; speed = 2.4; }
      }

      if (goal) {
        const dx = goal[0] - c.p[0], dz = goal[2] - c.p[2], l = Math.hypot(dx, dz) || 1;
        c.dir[0] = dx / l; c.dir[1] = dz / l; c.speed = l < 0.3 ? 0 : speed;
        c.mode = 'goal';
      } else {
        if (c.mode === 'goal') c.t = 0;
        c.mode = 'wander';
        c.t -= dt;
        if (c.t <= 0) {
          if (Math.random() < 0.4) { c.speed = 0; c.t = 1 + Math.random() * 2.5; if (Math.random() < 0.6) c.peck = 0.5; }
          else {
            const a = Math.random() * 6.28;
            c.dir[0] = Math.cos(a); c.dir[1] = Math.sin(a); c.speed = 0.9 + Math.random() * 0.6; c.t = 1.5 + Math.random() * 3;
          }
        }
        // don't wander into water or off big drops
        if (c.speed > 0 && c.onGround) {
          const ax = Math.floor(c.p[0] + c.dir[0] * 0.6), az = Math.floor(c.p[2] + c.dir[1] * 0.6), fy = Math.floor(c.p[1] + 0.05);
          const ahead = world.getBlock(ax, fy - 1, az), ahead2 = world.getBlock(ax, fy - 2, az);
          if (ahead === B.WATER || (!SOLID[ahead] && !SOLID[ahead2] && !SOLID[world.getBlock(ax, fy - 3, az)])) { c.dir[0] *= -1; c.dir[1] *= -1; }
        }
      }

      // ---- physics ----
      const v = c.v;
      const k = 1 - Math.exp(-(c.onGround ? 10 : 3) * dt);
      v[0] += (c.dir[0] * c.speed - v[0]) * k;
      v[2] += (c.dir[1] * c.speed - v[2]) * k;
      const inWater = world.getBlock(Math.floor(c.p[0]), Math.floor(c.p[1] + 0.25), Math.floor(c.p[2])) === B.WATER;
      if (inWater) v[1] = Math.min(v[1] + 30 * dt, 1.6);
      else v[1] = Math.max(v[1] - GRAVITY * dt, -30);

      // separation from close neighbours
      const gx = Math.floor(c.p[0]), gz = Math.floor(c.p[2]);
      for (let ox = -1; ox <= 1; ox++) for (let oz = -1; oz <= 1; oz++) {
        const list = grid.get((gx + ox) * 73856093 ^ (gz + oz) * 19349663);
        if (!list) continue;
        for (const o of list) {
          if (o === c) continue;
          const dx = c.p[0] - o.p[0], dz = c.p[2] - o.p[2], d = Math.hypot(dx, dz);
          if (d < 0.42 && d > 1e-4 && Math.abs(c.p[1] - o.p[1]) < 0.5) { v[0] += dx / d * 3 * dt * 6; v[2] += dz / d * 3 * dt * 6; }
        }
      }

      const wasGround = c.onGround;
      c.onGround = false;
      let blocked = 0;
      const steps = Math.max(1, Math.ceil(Math.max(Math.abs(v[0]), Math.abs(v[1]), Math.abs(v[2])) * dt / 0.3));
      for (let s = 0; s < steps; s++) {
        this.moveAxis(c, 1, v[1] * dt / steps);
        blocked = Math.max(blocked, this.moveAxis(c, 0, v[0] * dt / steps), this.moveAxis(c, 2, v[2] * dt / steps));
      }
      if (blocked === 1 && c.onGround && c.speed > 0) v[1] = HOP_V;          // hop up natural steps
      else if (blocked === 2 && c.mode === 'wander') c.t = 0;                 // fence: turn around
      if (c.onGround) c.gy = c.p[1];
      if (c.onGround && !wasGround) c.squash = -0.14;
      if (c.p[1] < -10) { const s = this.surface(Math.floor(c.p[0]), Math.floor(c.p[2])); c.p[1] = s > 0 ? s : 40; v[1] = 0; }

      // ---- animation ----
      const hs = Math.hypot(v[0], v[2]);
      const ty = hs > 0.15 ? Math.atan2(v[0], v[2]) : c.yaw;
      let dy = ty - c.yaw;
      dy = Math.atan2(Math.sin(dy), Math.cos(dy));
      c.yaw += dy * Math.min(1, dt * 10);
      if (hs > 0.2 && c.onGround) c.hop += dt * (8 + hs * 4);
      c.squash += (0 - c.squash) * Math.min(1, dt * 10);
      c.peck = Math.max(0, c.peck - dt);
      c.cheep -= dt;
      if (c.cheep <= 0) { c.cheep = 3 + Math.random() * 10; this.events.push({ type: 'cheep', p: [...c.p] }); }
    }

    for (const p of babies) {
      const b = this.add(p[0], p[1], p[2], true, 0);
      if (b) { b.born = 0.6; b.v[1] = 3; this.events.push({ type: 'hatch', p }); }
    }
  }

  // Returns 0 if free, 1 if blocked by a climbable step, 2 if blocked by a fence or wall.
  moveAxis(c, axis, d) {
    if (!d) return 0;
    const p = c.p, world = this.world;
    p[axis] += d;
    const x0 = Math.floor(p[0] - HALF), x1 = Math.floor(p[0] + HALF - 1e-7);
    const y0 = Math.floor(p[1]), y1 = Math.floor(p[1] + HEIGHT - 1e-7);
    const z0 = Math.floor(p[2] - HALF), z1 = Math.floor(p[2] + HALF - 1e-7);
    for (let y = y0; y <= y1; y++) for (let z = z0; z <= z1; z++) for (let x = x0; x <= x1; x++) {
      const id = world.getBlock(x, y, z);
      if (!SOLID[id]) continue;
      if (axis === 1) {
        if (d > 0) p[1] = y - HEIGHT - 1e-4; else { p[1] = y + 1; c.onGround = true; }
        c.v[1] = 0;
        return 0;
      }
      const b = axis === 0 ? x : z;
      p[axis] = d > 0 ? b - HALF - 1e-4 : b + 1 + HALF + 1e-4;
      c.v[axis] = 0;
      if (NO_CLIMB[id]) return 2;
      const free = !SOLID[world.getBlock(x, y + 1, z)] && !SOLID[world.getBlock(x, y + 2, z)];
      return y === y0 && free ? 1 : 2;
    }
    return 0;
  }

  updateSeeds(dt) {
    const world = this.world;
    for (const s of this.seeds) {
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
    this.seeds = this.seeds.filter(s => s.life > 0);
  }

  nearestSeed(c, r) {
    let best = null, bd = r * r;
    for (const s of this.seeds) {
      if (!s.rest) continue;
      const d = dist2(c.p, s.p);
      if (d < bd && Math.abs(s.p[1] - c.p[1]) < 3) { bd = d; best = s; }
    }
    return best;
  }

  nearestMate(c, r) {
    let best = null, bd = r * r;
    for (const o of this.chicks) {
      if (o === c || o.love <= 0 || o.cool > 0) continue;
      const d = dist2(c.p, o.p);
      if (d < bd) { bd = d; best = o; }
    }
    return best;
  }

  // Per-instance data for the renderer: [x, y, z, yaw] [scale, hop, flap, squash].
  instances(eye, maxDist, time) {
    const md2 = maxDist * maxDist;
    const n = this.chicks.length;
    if (!this._chick || this._chick.length < n * 8) { this._chick = new Float32Array(n * 8 + 64); this._shadow = new Float32Array(n * 8 + 64 + 1024); }
    const ch = this._chick, sh = this._shadow;
    let ci = 0, si = 0;
    for (const c of this.chicks) {
      if (dist2(c.p, eye) > md2) continue;
      const grow = 0.55 + 0.45 * Math.min(1, c.age / 120);
      const pop = c.born > 0 ? 1 - c.born / 0.6 : 1;
      const scale = grow * (pop < 1 ? 0.3 + 0.7 * pop : 1);
      const moving = Math.hypot(c.v[0], c.v[2]) > 0.2 && c.onGround;
      const hop = moving ? Math.abs(Math.sin(c.hop)) * 0.08 : 0;
      const excited = c.love > 0 || !c.onGround;
      const flap = excited ? 0.5 + 0.45 * Math.sin(time * 28 + c.hop) : 0.06 * Math.sin(time * 3 + c.hop);
      const peck = c.peck > 0 ? -0.1 * Math.sin(c.peck * 30) ** 2 : 0;
      const squash = c.squash + (moving ? -0.05 * Math.cos(c.hop * 2) : 0) + peck;
      ch[ci++] = c.p[0]; ch[ci++] = c.p[1]; ch[ci++] = c.p[2]; ch[ci++] = c.yaw;
      ch[ci++] = scale; ch[ci++] = hop; ch[ci++] = flap; ch[ci++] = squash;
      const lift = Math.max(0, c.p[1] - c.gy);
      sh[si++] = c.p[0]; sh[si++] = c.gy + 0.015; sh[si++] = c.p[2]; sh[si++] = 0;
      sh[si++] = scale * 0.62 * Math.max(0.4, 1 - lift * 0.3); sh[si++] = 0; sh[si++] = 0; sh[si++] = 0;
    }
    const seeds = this._seeds && this._seeds.length >= this.seeds.length * 8 ? this._seeds : (this._seeds = new Float32Array(this.seeds.length * 8 + 64));
    let k = 0;
    for (const s of this.seeds) {
      if (dist2(s.p, eye) > md2) continue;
      seeds[k++] = s.p[0]; seeds[k++] = s.p[1]; seeds[k++] = s.p[2]; seeds[k++] = s.yaw;
      seeds[k++] = 1; seeds[k++] = 0; seeds[k++] = 0; seeds[k++] = 0;
    }
    return { chicks: ch, chickCount: ci / 8, shadows: sh, shadowCount: si / 8, seeds, seedCount: k / 8 };
  }

  serialize() {
    return this.chicks.filter(c => c.tame).map(c => [+c.p[0].toFixed(2), +c.p[1].toFixed(2), +c.p[2].toFixed(2), Math.min(999, Math.round(c.age))]);
  }
  load(list) {
    for (const [x, y, z, age] of list || []) this.add(x, y, z, true, age);
  }
}

function dist2(a, b) { const dx = a[0] - b[0], dz = a[2] - b[2]; return dx * dx + dz * dz; }
