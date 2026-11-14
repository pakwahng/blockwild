// Daytime raiders. The night has its block snake; the day has these two:
//  · the fox sneaks up on your tame babies and spooks one out of the nursery. Foxes can hop up a
//    natural step of ground but can't climb anything you've built, so a fence keeps them out.
//    Bonk a fox twice with the toy sword and it poofs, leaving a bone.
//  · crows swoop down on treats lying on the ground and fly off with them. One bonk and a crow
//    poofs, dropping some seeds.
import { B, SOLID } from './blocks.js';
import { CS } from './world.js';

const FOX = 0, CROW = 1;
export const RAIDER_NAMES = ['fox', 'crow'];
const CLIMB = new Uint8Array(256); // natural ground a fox can hop up
for (const id of [B.GRASS, B.DIRT, B.SAND, B.STONE, B.SNOW, B.MUD, B.CLAY]) CLIMB[id] = 1;
const FOX_HALF = 0.22, FOX_H = 0.8, FOX_SPEED = 2.2, GRAVITY = 20;
const FOX_COLORS = [1, 1, 0, 1], CROW_COLORS = [3, 4, 3, 1];

export class Raiders {
  constructor(world, snakes) {
    this.world = world;
    this.snakes = snakes; // poofs use the snakes' confetti so they look the same
    this.list = [];
    this.events = [];
    this.foxTimer = 40;
    this.crowTimer = 15;
    this.nextId = 1;
    this.time = 0;
  }

  // Positions babies run away from.
  threats() { return this.list.filter(r => r.kind === FOX && !r.leaving).map(r => r.p); }

  update(dt, nursery, players, day, nights) {
    this.time += dt;
    const me = players[0];
    if (!day) {
      // the sun's going down: everyone scarpers home
      for (const r of this.list) if (!r.leaving) this.leave(r);
    } else {
      const tame = nursery.animals.filter(a => a.tame && dist2(a.p, me) < 64 * 64);
      this.foxTimer -= dt;
      const foxes = this.list.filter(r => r.kind === FOX).length;
      if (this.foxTimer <= 0) {
        this.foxTimer = 50 + Math.random() * 40;
        if (tame.length && foxes < (nights >= 3 ? 2 : 1) && !this.spawnFox(nursery, tame)) this.foxTimer = 3;
      }
      this.crowTimer -= dt;
      if (this.crowTimer <= 0) {
        this.crowTimer = 18 + Math.random() * 20;
        const lying = nursery.treats.filter(t => t.rest && players.some(p => dist2(t.p, p) < 40 * 40));
        if (lying.length && this.list.filter(r => r.kind === CROW).length < 2) this.spawnCrow(lying[Math.random() * lying.length | 0]);
      }
    }
    for (const r of this.list) {
      if (!this.world.getChunk(Math.floor(r.p[0] / CS), Math.floor(r.p[2] / CS))) { r.gone = true; continue; }
      if (r.kind === FOX) this.stepFox(r, dt, nursery); else this.stepCrow(r, dt, nursery);
    }
    this.list = this.list.filter(r => !r.gone);
  }

  make(kind, p, yaw) {
    return {
      id: this.nextId++, kind, p: [...p], v: [0, 0, 0], yaw, hp: kind === FOX ? 2 : 1, hit: 0, knock: 0,
      target: null, retarget: 0, detour: 0, detourDir: 1, phase: 0, speed: 0, life: 0, leaving: false,
      stuck: 0, peck: 0, gone: false, onGround: false, flap: 0,
    };
  }

  spawnFox(nursery, tame) {
    let cx = 0, cz = 0;
    for (const a of tame) { cx += a.p[0]; cz += a.p[2]; }
    cx /= tame.length; cz /= tame.length;
    for (let k = 0; k < 30; k++) {
      const ang = Math.random() * 6.28, r = 24 + Math.random() * 10;
      const x = Math.floor(cx + Math.cos(ang) * r), z = Math.floor(cz + Math.sin(ang) * r);
      const y = nursery.surface(x, z);
      if (y < 0 || !CLIMB[this.world.getBlock(x, y - 1, z)]) continue;
      const f = this.make(FOX, [x + 0.5, y, z + 0.5], Math.atan2(cx - x, cz - z));
      this.list.push(f);
      this.events.push({ type: 'fox', p: [...f.p] });
      return true;
    }
    return false;
  }

  spawnCrow(treat) {
    const ang = Math.random() * 6.28;
    const p = [treat.p[0] + Math.cos(ang) * 22, treat.p[1] + 14, treat.p[2] + Math.sin(ang) * 22];
    const c = this.make(CROW, p, Math.atan2(treat.p[0] - p[0], treat.p[2] - p[2]));
    c.target = treat;
    this.list.push(c);
    this.events.push({ type: 'crow', p: [...c.p] });
  }

  leave(r) {
    r.leaving = true; r.target = null; r.life = 0;
  }

  // Foxes still on the hunt, for the nursery's grown wolves to chase.
  foes() { return this.list.filter(r => r.kind === FOX && !r.leaving && !r.gone).map(r => ({ kind: 'fox', p: r.p, ref: r })); }
  // A grown wolf caught up with a fox: it yelps and runs off home the other way.
  scare(f, from) {
    if (f.leaving || f.gone) return;
    this.leave(f);
    f.yaw = Math.atan2(f.p[0] - from[0], f.p[2] - from[2]);
    f.hit = 0.4; f.knock = 0.3;
    f.v[0] = Math.sin(f.yaw) * 5; f.v[2] = Math.cos(f.yaw) * 5; f.v[1] = 4.5;
    this.events.push({ type: 'foxChased', p: [...f.p] });
  }

  stepFox(f, dt, nursery) {
    f.life += dt;
    f.hit = Math.max(0, f.hit - dt);
    f.knock = Math.max(0, f.knock - dt);
    f.detour = Math.max(0, f.detour - dt);
    f.retarget -= dt;
    // it picks one baby and sticks with it while it can
    const keep = f.target && f.target.tame && Math.abs(f.target.p[1] - f.p[1]) <= 3 && f.retarget > -8;
    if (!f.leaving && f.retarget <= 0 && !keep) {
      f.retarget = 1.5;
      let best = null, bd = 60 * 60;
      for (const a of nursery.animals) {
        if (!a.tame || (a.sp === 'pup' && a.grow >= 1)) continue; // grown wolves guard, they don't get spooked
        if (Math.abs(a.p[1] - f.p[1]) > 3) continue; // babies down a hole or up a cliff are out of reach
        const d = dist2(a.p, f.p);
        if (d < bd) { bd = d; best = a; }
      }
      f.target = best;
      if (!best) this.leave(f);
    }
    if (!f.leaving && !f.target) this.leave(f);
    let goal, speed;
    if (f.leaving) {
      // trot off away from where it came in, then vanish into the long grass
      goal = [f.p[0] + Math.sin(f.yaw) * 5, 0, f.p[2] + Math.cos(f.yaw) * 5];
      speed = FOX_SPEED * 1.5;
      if (f.life > 9) f.gone = true;
    } else {
      goal = f.target.p;
      const d = Math.hypot(goal[0] - f.p[0], goal[2] - f.p[2]);
      speed = d < 6 ? FOX_SPEED * 1.85 : FOX_SPEED; // pounce!
      // a fox only hunts for so long; one that spent it bumping into your fences goes home grumpy
      f.stuck += dt;
      if (f.stuck > 40) { this.leave(f); if (f.walled > 4) this.events.push({ type: 'foxGiveUp', p: [...f.p] }); }
    }
    if (f.hit > 0) speed = 0;
    let want = Math.atan2(goal[0] - f.p[0], goal[2] - f.p[2]);
    if (f.detour > 0) want += f.detourDir * 1.5;
    if (!f.leaving || f.detour > 0) {
      const dy = Math.atan2(Math.sin(want - f.yaw), Math.cos(want - f.yaw));
      f.yaw += Math.max(-5 * dt, Math.min(5 * dt, dy));
    }
    const v = f.v;
    if (f.knock === 0) {
      const k = 1 - Math.exp(-8 * dt);
      v[0] += (Math.sin(f.yaw) * speed - v[0]) * k;
      v[2] += (Math.cos(f.yaw) * speed - v[2]) * k;
    }
    const inWater = this.world.getBlock(Math.floor(f.p[0]), Math.floor(f.p[1] + 0.2), Math.floor(f.p[2])) === B.WATER;
    if (inWater) v[1] = Math.min(v[1] + 30 * dt, 1.4); else v[1] = Math.max(v[1] - GRAVITY * dt, -30);
    f.onGround = false;
    let blocked = 0;
    const steps = Math.max(1, Math.ceil(Math.max(Math.abs(v[0]), Math.abs(v[1]), Math.abs(v[2])) * dt / 0.25));
    for (let i = 0; i < steps; i++) {
      this.moveAxis(f, 1, v[1] * dt / steps);
      blocked = Math.max(blocked, this.moveAxis(f, 0, v[0] * dt / steps), this.moveAxis(f, 2, v[2] * dt / steps));
    }
    if (blocked === 1 && f.onGround && speed > 0) {
      // hop up the step, keeping its speed so it lands on top
      v[1] = 7.4; v[0] = Math.sin(f.yaw) * Math.max(speed, 2); v[2] = Math.cos(f.yaw) * Math.max(speed, 2);
    }
    if (blocked === 2) f.walled = (f.walled || 0) + dt;
    if (blocked === 2 && f.detour === 0) { f.detour = 1 + Math.random(); f.detourDir = Math.random() < 0.5 ? -1 : 1; }
    if (f.p[1] < -10) { f.gone = true; return; }
    const sp = Math.hypot(v[0], v[2]);
    f.speed = sp;
    f.phase += dt * (5 + sp * 2.2);

    const t = f.target;
    if (!f.leaving && t && dist2(t.p, f.p) < (0.5 + t.S.half) ** 2 && Math.abs(t.p[1] - f.p[1]) < 1.2) {
      t.tame = false; t.love = 0; t.flee = 6; t.fleeFrom = [...f.p];
      this.events.push({ type: 'foxSpook', sp: t.sp, name: t.name, nick: t.nick, p: [...t.p] });
      this.leave(f);
      f.yaw += Math.PI; // turn tail and run
    }
  }

  stepCrow(c, dt, nursery) {
    c.life += dt;
    c.hit = Math.max(0, c.hit - dt);
    c.flap += dt * (c.peck > 0 ? 3 : 16);
    if (c.leaving) {
      // flap up and away
      c.p[0] += Math.sin(c.yaw) * 6 * dt; c.p[2] += Math.cos(c.yaw) * 6 * dt; c.p[1] += 3 * dt;
      if (c.life > 7) c.gone = true;
      return;
    }
    const t = c.target;
    if (!t || t.life <= 0 || !nursery.treats.includes(t)) {
      // someone else ate it: look for another treat close by, or give up
      const next = nursery.treats.find(s => s.rest && dist2(s.p, c.p) < 20 * 20);
      if (next) c.target = next; else { this.leave(c); return; }
      return;
    }
    if (c.peck > 0) {
      // on the ground pecking at it: this is your chance to bonk it!
      c.peck -= dt;
      if (c.hit > 0) c.peck += dt;
      if (c.peck <= 0) {
        t.life = 0;
        this.events.push({ type: 'steal', item: t.item, p: [...c.p] });
        this.leave(c);
        c.yaw = Math.random() * 6.28;
      }
      return;
    }
    const dx = t.p[0] - c.p[0], dy = t.p[1] - c.p[1], dz = t.p[2] - c.p[2], d = Math.hypot(dx, dy, dz);
    if (d < 0.35) { c.p = [t.p[0], t.p[1] - 0.005, t.p[2]]; c.peck = 2.2; this.events.push({ type: 'caw', p: [...c.p] }); return; }
    const sp = Math.min(d, (d > 4 ? 7 : 3.5) * dt);
    c.p[0] += dx / d * sp; c.p[1] += dy / d * sp; c.p[2] += dz / d * sp;
    c.yaw = Math.atan2(dx, dz);
  }

  // A sword swing from the eye along fwd, by player `by`. Returns true if it bonked a raider.
  swing(eye, fwd, by = 0) {
    let best = null, bd = Infinity;
    for (const r of this.list) {
      const vx = r.p[0] - eye[0], vy = r.p[1] + 0.3 - eye[1], vz = r.p[2] - eye[2], d = Math.hypot(vx, vy, vz);
      if (d > 4) continue;
      const dot = (vx * fwd[0] + vy * fwd[1] + vz * fwd[2]) / (d || 1);
      if ((dot > 0.75 || d < 1) && d < bd) { bd = d; best = r; }
    }
    if (!best) return false;
    this.hurt(best, fwd, by);
    return true;
  }
  // Every fox or crow within r of p (for pebbles and poppers).
  near(p, r) { return this.list.filter(q => !q.gone && Math.hypot(q.p[0] - p[0], q.p[1] + 0.3 - p[1], q.p[2] - p[2]) < r); }
  // A hit from a sword, a pebble or a popper, pushing it along dir.
  hurt(r, dir, by = 0) {
    if (r.gone) return;
    r.hp--; r.hit = 0.5; r.knock = 0.35;
    const l = Math.hypot(dir[0], dir[2]) || 1;
    r.v[0] = dir[0] / l * 5; r.v[2] = dir[2] / l * 5; r.v[1] = 4.5;
    if (r.kind === CROW) r.p[1] += 0.2;
    this.events.push({ type: 'bonk', p: [...r.p], left: Math.max(0, r.hp) });
    if (r.hp <= 0) {
      this.poof(r);
      r.gone = true;
      this.events.push({ type: 'rpoof', kind: r.kind, p: [...r.p], id: r.id, by });
    } else if (r.kind === FOX && !r.leaving) {
      // a bonk makes it think twice
      r.stuck += 6;
    }
    return true;
  }

  poof(r) {
    const colors = r.kind === FOX ? FOX_COLORS : CROW_COLORS;
    for (let k = 0; k < 28; k++) {
      this.snakes.confetti.push({
        p: [r.p[0] + (Math.random() - 0.5) * 0.4, r.p[1] + 0.2 + Math.random() * 0.4, r.p[2] + (Math.random() - 0.5) * 0.4],
        v: [(Math.random() - 0.5) * 5, 3 + Math.random() * 4, (Math.random() - 0.5) * 5],
        c: colors[Math.random() * colors.length | 0], yaw: Math.random() * 6.28, spin: (Math.random() - 0.5) * 14,
        life: 1.6 + Math.random() * 1.2, rest: false,
      });
    }
  }

  // Returns 0 if free, 1 if blocked by a natural one-block step, 2 if blocked by anything else.
  moveAxis(f, axis, d) {
    if (!d) return 0;
    const p = f.p, world = this.world;
    p[axis] += d;
    const x0 = Math.floor(p[0] - FOX_HALF), x1 = Math.floor(p[0] + FOX_HALF - 1e-7);
    const y0 = Math.floor(p[1]), y1 = Math.floor(p[1] + FOX_H - 1e-7);
    const z0 = Math.floor(p[2] - FOX_HALF), z1 = Math.floor(p[2] + FOX_HALF - 1e-7);
    for (let y = y0; y <= y1; y++) for (let z = z0; z <= z1; z++) for (let x = x0; x <= x1; x++) {
      const id = world.getBlock(x, y, z);
      if (!SOLID[id]) continue;
      if (axis === 1) {
        if (d > 0) p[1] = y - FOX_H - 1e-4; else { p[1] = y + 1; f.onGround = true; }
        f.v[1] = 0;
        return 0;
      }
      const b = axis === 0 ? x : z;
      p[axis] = d > 0 ? b - FOX_HALF - 1e-4 : b + 1 + FOX_HALF + 1e-4;
      f.v[axis] = 0;
      if (!CLIMB[id]) return 2;
      return y === y0 && !SOLID[world.getBlock(x, y + 1, z)] && !SOLID[world.getBlock(x, y + 2, z)] ? 1 : 2;
    }
    return 0;
  }

  // ---- play together: the host sends its raiders, a guest shows copies ----
  snapshot() {
    return this.list.map(r => [r.id, r.kind, +r.p[0].toFixed(2), +r.p[1].toFixed(2), +r.p[2].toFixed(2), +r.yaw.toFixed(2), +r.hit.toFixed(2), r.peck > 0 ? 1 : 0, +r.speed.toFixed(1)]);
  }
  applySnapshot(list) {
    const byId = new Map(this.list.map(r => [r.id, r]));
    this.list = list.map(([id, kind, x, y, z, yaw, hit, peck, speed]) => {
      let r = byId.get(id);
      if (!r) { r = this.make(kind, [x, y, z], yaw); r.id = id; }
      r.tp = [x, y, z]; r.tyaw = yaw; r.hit = hit; r.peck = peck; r.speed = speed;
      return r;
    });
  }
  puppetStep(dt) {
    const k = Math.min(1, dt * 12);
    for (const r of this.list) {
      r.hit = Math.max(0, r.hit - dt);
      r.flap += dt * (r.peck > 0 ? 3 : 16);
      r.phase += dt * (5 + r.speed * 2.2);
      if (!r.tp) continue;
      for (let i = 0; i < 3; i++) r.p[i] += (r.tp[i] - r.p[i]) * k;
      r.yaw += Math.atan2(Math.sin(r.tyaw - r.yaw), Math.cos(r.tyaw - r.yaw)) * k;
    }
  }
  remoteEvent(ev) {
    if (ev.type !== 'rpoof') return;
    const r = this.list.find(q => q.id === ev.id);
    if (r) { this.poof(r); this.list = this.list.filter(q => q !== r); }
  }

  instances(eye, maxDist, time) {
    const md2 = maxDist * maxDist;
    const buf = this._buf || (this._buf = {});
    const need = (key, n) => (buf[key] && buf[key].length >= n * 12) ? buf[key] : (buf[key] = new Float32Array(n * 12 + 48));
    const fox = need('fox', this.list.length), crow = need('crow', this.list.length), sh = need('sh', this.list.length);
    let fi = 0, ci = 0, si = 0;
    const put = (d, i, p, yaw, scale, hop, flap, squash, wag, nod) => {
      d[i++] = p[0]; d[i++] = p[1]; d[i++] = p[2]; d[i++] = yaw;
      d[i++] = scale; d[i++] = hop; d[i++] = flap; d[i++] = squash;
      d[i++] = wag; d[i++] = nod; d[i++] = 0; d[i++] = 0;
    };
    for (const r of this.list) {
      if (dist2(r.p, eye) > md2) continue;
      const flash = r.hit > 0 ? Math.sin(r.hit / 0.5 * Math.PI) : 0;
      if (r.kind === FOX) {
        const moving = r.speed > 0.3;
        const stride = moving ? Math.sin(r.phase) * Math.min(0.8, r.speed * 0.25) : 0;
        const hop = moving ? Math.abs(Math.sin(r.phase)) * 0.04 : 0;
        put(fox, fi, r.p, r.yaw, 1.15, hop, stride, -0.25 * flash, Math.sin(time * 3 + r.id) * 0.35, moving ? 0.1 : 0.25 * Math.sin(time * 2)); fi += 12;
        put(sh, si, [r.p[0], r.p[1] + 0.015, r.p[2]], 0, 0.85, 0, 0, 0, 0, 0); si += 12;
      } else {
        const flying = r.peck <= 0;
        const flap = flying ? Math.sin(r.flap) * 0.9 : -1.25 + 0.08 * Math.sin(r.flap); // wings tucked in while it pecks
        put(crow, ci, r.p, r.yaw, 1.2, flying ? 0 : Math.abs(Math.sin(time * 9)) * 0.03, flap, -0.25 * flash + (flying ? 0 : Math.max(0, Math.sin(time * 9)) * 0.08), 0, 0); ci += 12;
        if (!flying) { put(sh, si, [r.p[0], r.p[1] + 0.015, r.p[2]], 0, 0.5, 0, 0, 0, 0, 0); si += 12; }
      }
    }
    return {
      groups: [{ model: 'fox', data: fox, count: fi / 12 }, { model: 'crow', data: crow, count: ci / 12 }],
      shadowGroups: [{ data: sh, count: si / 12 }],
    };
  }
}

function dist2(a, b) { const dx = a[0] - b[0], dz = a[2] - b[2]; return dx * dx + dz * dz; }
