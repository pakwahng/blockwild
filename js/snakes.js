// The night snake: a green and purple striped block snake that comes out under the square moon
// and slithers towards your nursery. A baby it reaches gets spooked out of the nursery.
// Bonk it twice with the toy sword and it poofs into confetti cubes.
import { B, SOLID } from './blocks.js';
import { CS } from './world.js';
import { CONFETTI_COLORS } from './models.js';

// SIZE scales the whole snake: its blocks, spacing, body and reach (3 = a big scary snake).
const SIZE = 3;
const SEGMENTS = 9, SPACING = 0.4 * SIZE, SPEED = 1.7, HALF = 0.45, HEIGHT = 0.9, GRAVITY = 20;
export const SCARE_RANGE = 7, SCARE_SLOW = 0.4; // snakes near a scarecrow slow right down
const GROUND = new Set([B.GRASS, B.DIRT, B.SAND, B.MUD, B.SNOW]);
const MAX_SNAKES = 4;

// The kinds of snake. A new kind joins each night, so the first night only has plain and poison snakes.
//  plain:   slithers to a baby and spooks it.
//  poison:  leaves a trail of glowing poison goo that lasts 5 seconds; babies run from it, and it slows you down.
//  flying:  flaps over fences and walls, then swoops down on a baby.
//  digger:  wears a hard hat and chews straight through walls instead of going round.
//  boom:    stops beside a baby, fizzes… and goes BOOM, blasting blocks and spooking every baby nearby.
//           Bonk it while it fizzes to put the fuse out.
export const SNAKE_KINDS = [
  { key: 'plain', name: 'block snake', hp: 2 },
  { key: 'poison', name: 'poison snake', hp: 2 },
  { key: 'flying', name: 'flying snake', hp: 2 },
  { key: 'digger', name: 'digger snake', hp: 3 },
  { key: 'boom', name: 'boom snake', hp: 2 },
];
export const K_PLAIN = 0, K_POISON = 1, K_FLYING = 2, K_DIGGER = 3, K_BOOM = 4;
const GOO_LIFE = 5, GOO_EVERY = 0.3, FLY_HEIGHT = 4.5, FUSE = 1.8, BOOM_RADIUS = 2.4, BOOM_SPOOK = 6;
const UNBREAKABLE = new Set([B.AIR, B.WATER, B.BEDROCK]);

export class Snakes {
  constructor(world) {
    this.world = world;
    this.list = [];
    this.confetti = [];
    this.events = [];
    this.wasNight = false;
    this.spawned = 0;
    this.timer = 0;
    this.spooked = 0;
    this.time = 0;
    this.nextId = 1;
    this.goo = [];        // poison puddles: { p, life }
    this.lastKind = -1;
  }

  // Which kind the next snake is: kinds unlock one a night, and a newly unlocked kind comes first.
  pickKind(nights) {
    const n = Math.min(SNAKE_KINDS.length, 2 + nights);
    if (this.spawned === 0 && nights > 0 && n > 2) return n - 1;
    let k = Math.random() * n | 0;
    if (k === this.lastKind) k = Math.random() * n | 0;
    return k;
  }
  // Is this spot in poison goo? (for slowing the player down)
  inGoo(p) {
    for (const g of this.goo) if (Math.abs(g.p[0] - p[0]) < 1 && Math.abs(g.p[2] - p[2]) < 1 && Math.abs(g.p[1] - p[1]) < 1.2) return true;
    return false;
  }
  stepGoo(dt, nursery) {
    for (const g of this.goo) g.life -= dt;
    this.goo = this.goo.filter(g => g.life > 0);
    if (!nursery) return;
    // babies that step in it get a fright and run off, like a snake had reached them
    for (const a of nursery.animals) {
      if (!a.tame || (a.sp === 'pup' && a.grow >= 1) || a.flee > 0) continue;
      if (this.goo.some(g => Math.abs(g.p[0] - a.p[0]) < 0.9 && Math.abs(g.p[2] - a.p[2]) < 0.9 && Math.abs(g.p[1] - a.p[1]) < 1)) this.spook(a, a.p, 'goo');
    }
  }
  dropGoo(s, dt) {
    s.gooT = (s.gooT || 0) - dt;
    if (s.gooT > 0) return;
    s.gooT = GOO_EVERY;
    const tail = s.segs.length ? s.segs[s.segs.length - 1].p : s.p;   // from the tip of the tail, so you can see it
    const last = this.goo[this.goo.length - 1];
    if (last && last.by === s.id && Math.hypot(last.p[0] - tail[0], last.p[2] - tail[2]) < 0.9) return;
    this.goo.push({ p: [tail[0], tail[1], tail[2]], life: GOO_LIFE, by: s.id, spin: Math.random() * 6.28 });
    if (this.goo.length > 400) this.goo.splice(0, this.goo.length - 400);
  }
  spook(t, from, why) {
    t.tame = false; t.love = 0; t.flee = 6; t.fleeFrom = [...from];
    this.spooked++;
    this.events.push({ type: 'spook', sp: t.sp, name: t.name, nick: t.nick, p: [...t.p], why });
  }

  heads() { return this.list.map(s => s.p); }

  update(dt, nursery, player, night, nights) {
    this.time += dt;
    if (night && !this.wasNight) {
      this.wasNight = true; this.spawned = 0; this.timer = 4; this.spooked = 0;
      this.events.push({ type: 'night' });
    }
    if (!night && this.wasNight) {
      this.wasNight = false;
      for (const s of this.list) this.poof(s, false);
      this.list = [];
      this.goo = [];
      this.events.push({ type: 'dawn', spooked: this.spooked });
    }
    if (night) {
      // one snake on the first nights, more as the nursery survives more of them
      const want = Math.min(MAX_SNAKES, 1 + Math.floor(nights / 2));
      this.timer -= dt;
      if (this.spawned < want && this.timer <= 0) {
        this.timer = 35;
        if (this.spawn(nursery, player, this.pickKind(nights))) this.spawned++;
        else this.timer = 2;
      }
    }

    for (const s of this.list) this.step(s, dt, nursery, player);
    this.list = this.list.filter(s => !s.gone);
    this.stepGoo(dt, nursery);
    this.updateConfetti(dt);
  }

  spawn(nursery, player, kind = 0) {
    // aim for the middle of the nursery (tame babies near the player), or the player
    let cx = 0, cz = 0, n = 0;
    for (const a of nursery.animals) {
      if (!a.tame) continue;
      const dx = a.p[0] - player.pos[0], dz = a.p[2] - player.pos[2];
      if (dx * dx + dz * dz < 64 * 64) { cx += a.p[0]; cz += a.p[2]; n++; }
    }
    const c = n ? [cx / n, cz / n] : [player.pos[0], player.pos[2]];
    for (let k = 0; k < 30; k++) {
      const ang = Math.random() * 6.28, r = 22 + Math.random() * 10;
      const x = Math.floor(c[0] + Math.cos(ang) * r), z = Math.floor(c[1] + Math.sin(ang) * r);
      const y = nursery.surface(x, z);
      if (y < 0 || !GROUND.has(this.world.getBlock(x, y - 1, z))) continue;
      const yaw = Math.atan2(c[0] - x, c[1] - z);
      const s = this.make([x + 0.5, y + (kind === K_FLYING ? FLY_HEIGHT : 0), z + 0.5], yaw, kind);
      this.list.push(s);
      this.lastKind = kind;
      this.events.push({ type: 'spawn', p: [...s.p], kind });
      return true;
    }
    return false;
  }

  make(p, yaw, kind = 0) {
    const y = p[1];
    const s = {
      id: this.nextId++, kind,
      p: [...p], v: [0, 0, 0], yaw, onGround: false,
      hp: SNAKE_KINDS[kind].hp, hit: 0, knock: 0, pause: 0, target: null, retarget: 0, fuse: 0, chew: 0, flap: 0,
      wig: Math.random() * 6, detour: 0, detourDir: 1, hiss: 2, gone: false, trail: [], segs: [],
    };
    for (let d = 0; d <= SEGMENTS * SPACING + 1; d += 0.1) s.trail.push([s.p[0] - Math.sin(yaw) * d, y, s.p[2] - Math.cos(yaw) * d]);
    this.layout(s);
    return s;
  }

  // Records the head's path, which the body follows.
  track(s) {
    const head = s.trail[0];
    if (Math.hypot(s.p[0] - head[0], s.p[1] - head[1], s.p[2] - head[2]) > 0.08) {
      s.trail.unshift([...s.p]);
      if (s.trail.length > 200) s.trail.length = 200;
    }
    this.layout(s);
  }

  // ---- play together: the host sends its snakes, a guest shows copies ----
  snapshot() { return this.list.map(s => [s.id, +s.p[0].toFixed(2), +s.p[1].toFixed(2), +s.p[2].toFixed(2), +s.yaw.toFixed(3), +s.hit.toFixed(2), s.kind, +s.fuse.toFixed(2)]); }
  applySnapshot(list) {
    const byId = new Map(this.list.map(s => [s.id, s]));
    this.list = list.map(([id, x, y, z, yaw, hit, kind, fuse]) => {
      let s = byId.get(id);
      if (!s) { s = this.make([x, y, z], yaw, SNAKE_KINDS[kind] ? kind : 0); s.id = id; }
      s.tp = [x, y, z]; s.tyaw = yaw; s.hit = hit; s.fuse = fuse || 0;
      return s;
    });
  }
  // Guests move their copies towards the host's, and lay their own goo (it only has to look right and slow them down).
  puppetStep(dt) {
    this.time += dt;
    const k = Math.min(1, dt * 12);
    for (const s of this.list) {
      s.hit = Math.max(0, s.hit - dt);
      if (!s.tp) continue;
      for (let i = 0; i < 3; i++) s.p[i] += (s.tp[i] - s.p[i]) * k;
      s.yaw += Math.atan2(Math.sin(s.tyaw - s.yaw), Math.cos(s.tyaw - s.yaw)) * k;
      this.track(s);
      if (s.kind === K_POISON) this.dropGoo(s, dt);
    }
    this.stepGoo(dt, null);
    this.updateConfetti(dt);
  }
  // Snake events from the host that need the copies changed too.
  remoteEvent(ev) {
    if (ev.type === 'poof') {
      const s = this.list.find(q => q.id === ev.id);
      if (s) { this.poof(s, true); this.list = this.list.filter(q => q !== s); }
    } else if (ev.type === 'boom') {
      const s = this.list.find(q => q.id === ev.id);
      if (s) this.list = this.list.filter(q => q !== s);
      this.burst(ev.p, 90, [0, 1, 1, 0, 4], false);
    } else if (ev.type === 'dawn') { for (const s of this.list) this.poof(s, false); this.list = []; this.goo = []; }
    else if (ev.type === 'burst') this.burst(ev.p, ev.n, ev.colors, false);
  }

  step(s, dt, nursery, player) {
    const world = this.world;
    if (!world.getChunk(Math.floor(s.p[0] / CS), Math.floor(s.p[2] / CS))) return;
    s.hit = Math.max(0, s.hit - dt);
    s.knock = Math.max(0, s.knock - dt);
    s.pause = Math.max(0, s.pause - dt);
    s.detour = Math.max(0, s.detour - dt);

    // pick the nearest baby in the nursery
    s.retarget -= dt;
    if (s.retarget <= 0) {
      s.retarget = 1;
      let best = null, bd = 70 * 70;
      for (const a of nursery.animals) {
        if (!a.tame || (a.sp === 'pup' && a.grow >= 1)) continue; // grown wolves guard, they don't get spooked
        const d = dist2(a.p, s.p);
        if (d < bd) { bd = d; best = a; }
      }
      s.target = best;
    }
    const goal = s.target ? s.target.p : player.pos;
    const gdx = goal[0] - s.p[0], gdz = goal[2] - s.p[2], gd = Math.hypot(gdx, gdz);
    const lunge = s.target && gd < 4.5;
    const fast = s.kind === K_FLYING ? 1.35 : 1;
    let speed = s.pause > 0 || s.hit > 0 || s.fuse > 0 ? 0 : (lunge ? SPEED * 1.6 : SPEED) * fast;
    if (!s.target && gd < 3) speed = 0;
    // a scarecrow close by: the snake creeps along, nervous, at under half speed
    s.scareT = (s.scareT || 0) - dt;
    if (s.scareT <= 0) {
      s.scareT = 0.8;
      const was = s.scared;
      s.scared = world.placedNear(s.p[0], s.p[2], SCARE_RANGE, id => id === B.SCARECROW).some(t => Math.abs(t[1] - s.p[1]) < 5);
      if (s.scared && !was) this.events.push({ type: 'scared', p: [...s.p] });
    }
    if (s.scared) speed *= SCARE_SLOW;

    // boom snake: stops next to a baby (or you) and fizzes, then goes BOOM
    if (s.kind === K_BOOM) {
      if (s.fuse > 0) {
        s.fuse -= dt;
        if (s.fuse <= 0) return this.explode(s, nursery);
      } else if (s.hit === 0 && s.pause === 0 && ((s.target && gd < 3.2 && Math.abs(goal[1] - s.p[1]) < 2) || Math.hypot(player.pos[0] - s.p[0], player.pos[2] - s.p[2]) < 2.6)) {
        s.fuse = FUSE;
        this.events.push({ type: 'fuse', p: [...s.p] });
      }
    }

    // slither: steer towards the goal with a side-to-side wiggle (straighter when lunging)
    let want = Math.atan2(gdx, gdz) + (lunge ? 0.15 : 0.5) * Math.sin(this.time * 3.2 + s.wig);
    if (s.detour > 0) want += s.detourDir * 1.4;
    let dy = Math.atan2(Math.sin(want - s.yaw), Math.cos(want - s.yaw));
    s.yaw += Math.max(-3.5 * dt, Math.min(3.5 * dt, dy));

    const v = s.v;
    if (s.knock === 0) {
      const k = 1 - Math.exp(-8 * dt);
      v[0] += (Math.sin(s.yaw) * speed - v[0]) * k;
      v[2] += (Math.cos(s.yaw) * speed - v[2]) * k;
    }
    const inWater = world.getBlock(Math.floor(s.p[0]), Math.floor(s.p[1] + 0.2), Math.floor(s.p[2])) === B.WATER;
    if (s.kind === K_FLYING) {
      // flies high over everything, then swoops down when it's close to a baby
      s.flap = Math.sin(this.time * 13 + s.wig) * 0.7;
      const ground = nursery.surface(Math.floor(s.p[0]), Math.floor(s.p[2]));
      const wantY = lunge ? goal[1] + 0.1 : Math.max(ground, goal[1]) + FLY_HEIGHT;
      if (s.knock === 0) v[1] += (Math.max(-5, Math.min(4, (wantY - s.p[1]) * 2.5)) - v[1]) * Math.min(1, dt * 6);
      else v[1] = Math.max(v[1] - GRAVITY * 0.4 * dt, -6);
    } else if (inWater) v[1] = Math.min(v[1] + 30 * dt, 1.6);
    else v[1] = Math.max(v[1] - GRAVITY * dt, -30);

    s.onGround = false;
    let blocked = 0;
    const steps = Math.max(1, Math.ceil(Math.max(Math.abs(v[0]), Math.abs(v[1]), Math.abs(v[2])) * dt / 0.3));
    for (let i = 0; i < steps; i++) {
      this.moveAxis(s, 1, v[1] * dt / steps);
      blocked = Math.max(blocked, this.moveAxis(s, 0, v[0] * dt / steps), this.moveAxis(s, 2, v[2] * dt / steps));
    }
    // snakes slither over anything one block high (even fences!) but not over taller walls
    if (s.kind === K_FLYING) { if (blocked) v[1] = 5; }
    else if (blocked === 1 && s.onGround && speed > 0) v[1] = 6.8;
    else if (blocked === 2 && s.kind === K_DIGGER && speed > 0) this.chew(s, dt);
    else if (blocked === 2 && s.detour === 0) { s.detour = 1.2; s.detourDir = Math.random() < 0.5 ? -1 : 1; }
    if (s.p[1] < -10) { s.gone = true; return; }
    if (s.kind === K_POISON) this.dropGoo(s, dt);

    // reached a baby: it gets spooked and runs out of the nursery
    const t = s.target;
    if (t && s.kind !== K_BOOM && dist2(t.p, s.p) < (0.45 * SIZE + t.S.half) ** 2 && Math.abs(t.p[1] - s.p[1]) < 1.5) {
      this.spook(t, s.p);
      s.pause = 2.5; s.target = null; s.retarget = 2.6;
    }

    this.track(s);

    s.hiss -= dt;
    if (s.hiss <= 0) { s.hiss = 4 + Math.random() * 5; this.events.push({ type: 'hiss', p: [...s.p] }); }
  }

  // Digger snake: nibbles away the block in front of its nose, one every half a second.
  chew(s, dt) {
    s.chew -= dt;
    if (s.chew > 0) return;
    s.chew = 0.55;
    const fx = Math.sin(s.yaw), fz = Math.cos(s.yaw), y0 = Math.floor(s.p[1]);
    for (const reach of [HALF + 0.3, HALF + 0.7]) {
      const x = Math.floor(s.p[0] + fx * reach), z = Math.floor(s.p[2] + fz * reach);
      // a tunnel two blocks high, big enough for its big head (main.js breaks the blocks, so they save and reach other players)
      const bite = [y0, y0 + 1].filter(y => { const id = this.world.getBlock(x, y, z); return SOLID[id] && !UNBREAKABLE.has(id); });
      if (!bite.length) continue;
      for (const y of bite) this.events.push({ type: 'chew', x, y, z, p: [x + 0.5, y + 0.5, z + 0.5] });
      return;
    }
    s.detour = 1; s.detourDir = Math.random() < 0.5 ? -1 : 1;   // nothing it can chew: go round
  }

  // Boom snake: a big confetti blast that knocks out blocks and sends every baby nearby running.
  explode(s, nursery) {
    const p = [s.p[0], s.p[1] + 0.5, s.p[2]];
    const blocks = [];
    const r = BOOM_RADIUS, cx = Math.floor(p[0]), cy = Math.floor(p[1]), cz = Math.floor(p[2]);
    for (let x = cx - 3; x <= cx + 3; x++) for (let y = cy - 2; y <= cy + 3; y++) for (let z = cz - 3; z <= cz + 3; z++) {
      const d = Math.hypot(x + 0.5 - p[0], (y + 0.5 - p[1]) * 1.2, z + 0.5 - p[2]);
      if (d > r + Math.random() * 0.6) continue;
      const id = this.world.getBlock(x, y, z);
      if (id === B.AIR || UNBREAKABLE.has(id)) continue;
      blocks.push([x, y, z]);
    }
    for (const a of nursery.animals) {
      if (!a.tame || (a.sp === 'pup' && a.grow >= 1)) continue;
      if (Math.hypot(a.p[0] - p[0], a.p[2] - p[2]) < BOOM_SPOOK && Math.abs(a.p[1] - p[1]) < 4) this.spook(a, p, 'boom');
    }
    s.gone = true;
    this.burst(p, 90, [0, 1, 1, 0, 4], false);
    this.events.push({ type: 'boom', p, id: s.id, blocks });
  }

  // Places the body blocks along the path the head has travelled.
  layout(s) {
    const pts = [s.p, ...s.trail];
    s.segs.length = 0;
    let acc = 0, want = SPACING, k = 0;
    for (let i = 1; i < pts.length && s.segs.length < SEGMENTS; i++) {
      const a = pts[i - 1], b = pts[i];
      const len = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
      while (acc + len >= want && s.segs.length < SEGMENTS) {
        const f = len ? (want - acc) / len : 0;
        const p = [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f];
        const prev = s.segs.length ? s.segs[s.segs.length - 1].p : s.p;
        k = s.segs.length;
        s.segs.push({ p, yaw: Math.atan2(prev[0] - p[0], prev[2] - p[2]), scale: 1 - Math.max(0, k - (SEGMENTS - 4)) * 0.14 });
        want += SPACING;
      }
      acc += len;
    }
  }

  // A sword swing from the eye along fwd. Returns true if it bonked a snake.
  swing(eye, fwd) {
    let best = null, bd = Infinity;
    for (const s of this.list) {
      for (const q of [s.p, ...s.segs.map(g => g.p)]) {
        const vx = q[0] - eye[0], vy = q[1] + 0.2 * SIZE - eye[1], vz = q[2] - eye[2], d = Math.hypot(vx, vy, vz);
        if (d > 3.4 + 0.4 * SIZE) continue;
        const dot = (vx * fwd[0] + vy * fwd[1] + vz * fwd[2]) / (d || 1);
        if ((dot > 0.7 || d < 0.6 + 0.4 * SIZE) && d < bd) { bd = d; best = s; }
      }
    }
    if (!best) return false;
    const s = best;
    s.hp--; s.hit = 0.55; s.knock = 0.35; s.fuse = 0; // a bonk puts a boom snake's fuse out
    const l = Math.hypot(fwd[0], fwd[2]) || 1;
    s.v[0] = fwd[0] / l * 4; s.v[2] = fwd[2] / l * 4; s.v[1] = 4;
    this.events.push({ type: 'bonk', p: [...s.p] });
    if (s.hp <= 0) {
      this.poof(s, true);
      s.gone = true;
      this.events.push({ type: 'poof', p: [...s.p], id: s.id });
    }
    return true;
  }

  // A grown wolf from the nursery nips the snake: same as a bonk, knocked away from the wolf.
  nip(s, from) {
    if (s.gone || s.hit > 0) return;
    s.hp--; s.hit = 0.55; s.knock = 0.35; s.fuse = 0; // a bonk puts a boom snake's fuse out
    const dx = s.p[0] - from[0], dz = s.p[2] - from[2], l = Math.hypot(dx, dz) || 1;
    s.v[0] = dx / l * 4.5; s.v[2] = dz / l * 4.5; s.v[1] = 4;
    this.events.push({ type: 'bonk', p: [...s.p] });
    if (s.hp <= 0) {
      this.poof(s, true);
      s.gone = true;
      this.events.push({ type: 'poof', p: [...s.p], id: s.id, wolf: 1 });
    }
  }

  // Bursts a snake into confetti cubes.
  poof(s, big) {
    const parts = [s.p, ...s.segs.map(g => g.p)];
    for (const q of parts) for (let k = 0; k < (big ? 12 : 4); k++) {
      this.confetti.push({
        p: [q[0] + (Math.random() - 0.5) * 0.3 * SIZE, q[1] + (0.2 + Math.random() * 0.2) * SIZE, q[2] + (Math.random() - 0.5) * 0.3 * SIZE],
        v: [(Math.random() - 0.5) * 5, 3 + Math.random() * 4, (Math.random() - 0.5) * 5],
        c: Math.random() * CONFETTI_COLORS.length | 0, yaw: Math.random() * 6.28, spin: (Math.random() - 0.5) * 14,
        life: 1.6 + Math.random() * 1.2, rest: false,
      });
    }
    if (this.confetti.length > 900) this.confetti.splice(0, this.confetti.length - 900);
  }

  // A celebration burst (gold, red and blue by default) around a point.
  burst(p, n = 60, colors = [1, 1, 0, 3], share = true) {
    if (share) this.events.push({ type: 'burst', p: [...p], n, colors });
    for (let k = 0; k < n; k++) {
      const a = Math.random() * 6.28, sp = 1.5 + Math.random() * 3;
      this.confetti.push({
        p: [p[0] + Math.cos(a) * 0.5, p[1] + 1.6 + Math.random() * 0.4, p[2] + Math.sin(a) * 0.5],
        v: [Math.cos(a) * sp, 4 + Math.random() * 4, Math.sin(a) * sp],
        c: colors[Math.random() * colors.length | 0], yaw: Math.random() * 6.28, spin: (Math.random() - 0.5) * 14,
        life: 2 + Math.random() * 1.5, rest: false,
      });
    }
  }

  updateConfetti(dt) {
    const world = this.world;
    for (const c of this.confetti) {
      c.life -= dt;
      if (c.rest) continue;
      c.v[1] -= 14 * dt;
      c.yaw += c.spin * dt;
      const np = [c.p[0] + c.v[0] * dt, c.p[1] + c.v[1] * dt, c.p[2] + c.v[2] * dt];
      if (SOLID[world.getBlock(Math.floor(np[0]), Math.floor(np[1] - 0.065), Math.floor(np[2]))]) {
        if (c.v[1] < 0) { c.p[1] = Math.floor(np[1] - 0.065) + 1.065; c.rest = true; } else c.v[1] = 0;
      } else c.p = np;
    }
    this.confetti = this.confetti.filter(c => c.life > 0);
  }

  // Returns 0 if free, 1 if blocked by a one-block step, 2 if blocked by a taller wall.
  moveAxis(s, axis, d) {
    if (!d) return 0;
    const p = s.p, world = this.world;
    p[axis] += d;
    const x0 = Math.floor(p[0] - HALF), x1 = Math.floor(p[0] + HALF - 1e-7);
    const y0 = Math.floor(p[1]), y1 = Math.floor(p[1] + HEIGHT - 1e-7);
    const z0 = Math.floor(p[2] - HALF), z1 = Math.floor(p[2] + HALF - 1e-7);
    for (let y = y0; y <= y1; y++) for (let z = z0; z <= z1; z++) for (let x = x0; x <= x1; x++) {
      const id = world.getBlock(x, y, z);
      if (!SOLID[id]) continue;
      if (axis === 1) {
        if (d > 0) p[1] = y - HEIGHT - 1e-4; else { p[1] = y + 1; s.onGround = true; }
        s.v[1] = 0;
        return 0;
      }
      const b = axis === 0 ? x : z;
      p[axis] = d > 0 ? b - HALF - 1e-4 : b + 1 + HALF + 1e-4;
      s.v[axis] = 0;
      return y === y0 && !SOLID[world.getBlock(x, y + 1, z)] ? 1 : 2;
    }
    return 0;
  }

  // The ground under a point (for the shadow of a flying snake).
  groundBelow(p) {
    const x = Math.floor(p[0]), z = Math.floor(p[2]);
    for (let y = Math.floor(p[1]); y > p[1] - 14; y--) if (SOLID[this.world.getBlock(x, y, z)]) return y + 1;
    return p[1];
  }

  instances(eye, maxDist, time) {
    const md2 = maxDist * maxDist;
    const buf = this._buf || (this._buf = {});
    const need = (key, n) => (buf[key] && buf[key].length >= n * 12) ? buf[key] : (buf[key] = new Float32Array(n * 12 + 120));
    const nK = SNAKE_KINDS.length;
    const head = [], seg = [], hi = [], gi = [];
    for (let k = 0; k < nK; k++) {
      const n = this.list.filter(s => s.kind === k).length;
      head.push(need('head' + k, n)); seg.push(need('seg' + k, n * SEGMENTS)); hi.push(0); gi.push(0);
    }
    const sh = need('shadow', this.list.length * (SEGMENTS + 1));
    let si = 0;
    const put = (d, i, p, yaw, scale, hop, squash, wag, flap = 0) => {
      d[i++] = p[0]; d[i++] = p[1]; d[i++] = p[2]; d[i++] = yaw;
      d[i++] = scale; d[i++] = hop; d[i++] = flap; d[i++] = squash;
      d[i++] = wag; d[i++] = 0; d[i++] = 0; d[i++] = 0;
    };
    for (const s of this.list) {
      if (dist2(s.p, eye) > md2) continue;
      const k = s.kind;
      let flash = s.hit > 0 ? Math.sin(s.hit / 0.55 * Math.PI) : 0;
      // a fizzing boom snake swells and shrinks faster and faster
      if (s.fuse > 0) flash = Math.max(flash, 0.5 + 0.5 * Math.sin(time * (14 + (FUSE - s.fuse) * 22)));
      const tongue = Math.sin(time * 22) * 0.5 * (Math.sin(time * 1.7 + s.wig) > 0.2 ? 1 : 0);
      const flap = k === K_FLYING ? Math.sin(time * 13 + s.wig) * 0.7 : 0;
      const gy = k === K_FLYING ? this.groundBelow(s.p) : null;
      put(head[k], hi[k], s.p, s.yaw, (1.25 + flash * 0.18) * SIZE, 0.02 * Math.sin(time * 6), -0.25 * flash, tongue, flap); hi[k] += 12;
      put(sh, si, [s.p[0], (gy ?? s.p[1]) + 0.015, s.p[2]], 0, 0.6 * SIZE, 0, 0, 0); si += 12;
      s.segs.forEach((g, j) => {
        put(seg[k], gi[k], g.p, g.yaw, g.scale * SIZE * (1 + flash * 0.1), 0.025 * Math.max(0, Math.sin(time * 6 - j * 0.9)), -0.2 * flash, 0); gi[k] += 12;
        if (gy === null) { put(sh, si, [g.p[0], g.p[1] + 0.015, g.p[2]], 0, 0.5 * SIZE * g.scale, 0, 0, 0); si += 12; }
      });
    }
    const groups = [];
    for (let k = 0; k < nK; k++) groups.push({ model: 'snakeHead' + k, data: head[k], count: hi[k] / 12 }, { model: 'snakeSeg' + k, data: seg[k], count: gi[k] / 12 });
    // poison goo: flat glowing puddles that shrink away as they dry up
    const goo = need('goo', this.goo.length);
    let oi = 0;
    for (const g of this.goo) {
      if (dist2(g.p, eye) > md2) continue;
      put(goo, oi, [g.p[0], g.p[1] + 0.01, g.p[2]], g.spin, 1.5 * Math.min(1, g.life / 1.2) * (1 + 0.04 * Math.sin(time * 5 + g.spin)), 0, 0, 0); oi += 12;
    }
    groups.push({ model: 'goo', data: goo, count: oi / 12 });
    const conf = CONFETTI_COLORS.map((_, k) => need('c' + k, this.confetti.length));
    const cc = CONFETTI_COLORS.map(() => 0);
    for (const c of this.confetti) {
      if (dist2(c.p, eye) > md2) continue;
      const scale = Math.min(1, c.life * 1.5);
      put(conf[c.c], cc[c.c] * 12, c.p, c.yaw, scale, 0, 0, 0); cc[c.c]++;
    }
    CONFETTI_COLORS.forEach((_, k) => groups.push({ model: 'confetti' + k, data: conf[k], count: cc[k] }));
    return { groups, shadowGroups: [{ data: sh, count: si / 12 }] };
  }
}

function dist2(a, b) { const dx = a[0] - b[0], dz = a[2] - b[2]; return dx * dx + dz * dz; }
