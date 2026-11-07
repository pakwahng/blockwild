// The night snake: a green and purple striped block snake that comes out under the square moon
// and slithers towards your nursery. A baby it reaches gets spooked out of the nursery.
// Bonk it twice with the toy sword and it poofs into confetti cubes.
import { B, SOLID } from './blocks.js';
import { CS } from './world.js';
import { CONFETTI_COLORS } from './models.js';

const SEGMENTS = 9, SPACING = 0.4, SPEED = 1.7, HALF = 0.22, HEIGHT = 0.45, GRAVITY = 20;
const GROUND = new Set([B.GRASS, B.DIRT, B.SAND, B.MUD, B.SNOW]);
const MAX_SNAKES = 4;

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
      this.events.push({ type: 'dawn', spooked: this.spooked });
    }
    if (night) {
      // one snake on the first nights, more as the nursery survives more of them
      const want = Math.min(MAX_SNAKES, 1 + Math.floor(nights / 2));
      this.timer -= dt;
      if (this.spawned < want && this.timer <= 0) {
        this.timer = 35;
        if (this.spawn(nursery, player)) this.spawned++;
        else this.timer = 2;
      }
    }

    for (const s of this.list) this.step(s, dt, nursery, player);
    this.list = this.list.filter(s => !s.gone);
    this.updateConfetti(dt);
  }

  spawn(nursery, player) {
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
      const s = {
        p: [x + 0.5, y, z + 0.5], v: [0, 0, 0], yaw, onGround: false,
        hp: 2, hit: 0, knock: 0, pause: 0, target: null, retarget: 0,
        wig: Math.random() * 6, detour: 0, detourDir: 1, hiss: 2, gone: false, trail: [], segs: [],
      };
      for (let d = 0; d <= SEGMENTS * SPACING + 1; d += 0.1) s.trail.push([s.p[0] - Math.sin(yaw) * d, y, s.p[2] - Math.cos(yaw) * d]);
      this.layout(s);
      this.list.push(s);
      this.events.push({ type: 'spawn', p: [...s.p] });
      return true;
    }
    return false;
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
        if (!a.tame) continue;
        const d = dist2(a.p, s.p);
        if (d < bd) { bd = d; best = a; }
      }
      s.target = best;
    }
    const goal = s.target ? s.target.p : player.pos;
    const gdx = goal[0] - s.p[0], gdz = goal[2] - s.p[2], gd = Math.hypot(gdx, gdz);
    const lunge = s.target && gd < 3.5;
    let speed = s.pause > 0 || s.hit > 0 ? 0 : lunge ? SPEED * 1.6 : SPEED;
    if (!s.target && gd < 3) speed = 0;

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
    if (inWater) v[1] = Math.min(v[1] + 30 * dt, 1.6);
    else v[1] = Math.max(v[1] - GRAVITY * dt, -30);

    s.onGround = false;
    let blocked = 0;
    const steps = Math.max(1, Math.ceil(Math.max(Math.abs(v[0]), Math.abs(v[1]), Math.abs(v[2])) * dt / 0.3));
    for (let i = 0; i < steps; i++) {
      this.moveAxis(s, 1, v[1] * dt / steps);
      blocked = Math.max(blocked, this.moveAxis(s, 0, v[0] * dt / steps), this.moveAxis(s, 2, v[2] * dt / steps));
    }
    // snakes slither over anything one block high (even fences!) but not over taller walls
    if (blocked === 1 && s.onGround && speed > 0) v[1] = 6.8;
    else if (blocked === 2 && s.detour === 0) { s.detour = 1.2; s.detourDir = Math.random() < 0.5 ? -1 : 1; }
    if (s.p[1] < -10) { s.gone = true; return; }

    // reached a baby: it gets spooked and runs out of the nursery
    const t = s.target;
    if (t && dist2(t.p, s.p) < (0.45 + t.S.half) ** 2 && Math.abs(t.p[1] - s.p[1]) < 1) {
      t.tame = false; t.love = 0; t.flee = 6; t.fleeFrom = [...s.p];
      s.pause = 2.5; s.target = null; s.retarget = 2.6;
      this.spooked++;
      this.events.push({ type: 'spook', sp: t.sp, p: [...t.p] });
    }

    const head = s.trail[0];
    if (Math.hypot(s.p[0] - head[0], s.p[1] - head[1], s.p[2] - head[2]) > 0.08) {
      s.trail.unshift([...s.p]);
      if (s.trail.length > 120) s.trail.length = 120;
    }
    this.layout(s);

    s.hiss -= dt;
    if (s.hiss <= 0) { s.hiss = 4 + Math.random() * 5; this.events.push({ type: 'hiss', p: [...s.p] }); }
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
        const vx = q[0] - eye[0], vy = q[1] + 0.2 - eye[1], vz = q[2] - eye[2], d = Math.hypot(vx, vy, vz);
        if (d > 3.8) continue;
        const dot = (vx * fwd[0] + vy * fwd[1] + vz * fwd[2]) / (d || 1);
        if ((dot > 0.7 || d < 1.1) && d < bd) { bd = d; best = s; }
      }
    }
    if (!best) return false;
    const s = best;
    s.hp--; s.hit = 0.55; s.knock = 0.35;
    const l = Math.hypot(fwd[0], fwd[2]) || 1;
    s.v[0] = fwd[0] / l * 4; s.v[2] = fwd[2] / l * 4; s.v[1] = 4;
    this.events.push({ type: 'bonk', p: [...s.p] });
    if (s.hp <= 0) {
      this.poof(s, true);
      s.gone = true;
      this.events.push({ type: 'poof', p: [...s.p] });
    }
    return true;
  }

  // Bursts a snake into confetti cubes.
  poof(s, big) {
    const parts = [s.p, ...s.segs.map(g => g.p)];
    for (const q of parts) for (let k = 0; k < (big ? 5 : 2); k++) {
      this.confetti.push({
        p: [q[0] + (Math.random() - 0.5) * 0.3, q[1] + 0.2 + Math.random() * 0.2, q[2] + (Math.random() - 0.5) * 0.3],
        v: [(Math.random() - 0.5) * 5, 3 + Math.random() * 4, (Math.random() - 0.5) * 5],
        c: Math.random() * CONFETTI_COLORS.length | 0, yaw: Math.random() * 6.28, spin: (Math.random() - 0.5) * 14,
        life: 1.6 + Math.random() * 1.2, rest: false,
      });
    }
    if (this.confetti.length > 600) this.confetti.splice(0, this.confetti.length - 600);
  }

  // A celebration burst (gold, red and blue by default) around a point.
  burst(p, n = 60, colors = [1, 1, 0, 3]) {
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

  instances(eye, maxDist, time) {
    const md2 = maxDist * maxDist;
    const buf = this._buf || (this._buf = {});
    const need = (key, n) => (buf[key] && buf[key].length >= n * 12) ? buf[key] : (buf[key] = new Float32Array(n * 12 + 120));
    const nSeg = this.list.length * SEGMENTS;
    const head = need('head', this.list.length), seg = need('seg', nSeg), sh = need('shadow', nSeg + this.list.length);
    let hi = 0, gi = 0, si = 0;
    const put = (d, i, p, yaw, scale, hop, squash, wag) => {
      d[i++] = p[0]; d[i++] = p[1]; d[i++] = p[2]; d[i++] = yaw;
      d[i++] = scale; d[i++] = hop; d[i++] = 0; d[i++] = squash;
      d[i++] = wag; d[i++] = 0; d[i++] = 0; d[i++] = 0;
    };
    for (const s of this.list) {
      if (dist2(s.p, eye) > md2) continue;
      const flash = s.hit > 0 ? Math.sin(s.hit / 0.55 * Math.PI) : 0;
      const tongue = Math.sin(time * 22) * 0.5 * (Math.sin(time * 1.7 + s.wig) > 0.2 ? 1 : 0);
      put(head, hi, s.p, s.yaw, 1.25 + flash * 0.18, 0.02 * Math.sin(time * 6), -0.25 * flash, tongue); hi += 12;
      put(sh, si, [s.p[0], s.p[1] + 0.015, s.p[2]], 0, 0.6, 0, 0, 0); si += 12;
      s.segs.forEach((g, k) => {
        put(seg, gi, g.p, g.yaw, g.scale * (1 + flash * 0.1), 0.025 * Math.max(0, Math.sin(time * 6 - k * 0.9)), -0.2 * flash, 0); gi += 12;
        put(sh, si, [g.p[0], g.p[1] + 0.015, g.p[2]], 0, 0.5 * g.scale, 0, 0, 0); si += 12;
      });
    }
    const groups = [{ model: 'snakeHead', data: head, count: hi / 12 }, { model: 'snakeSeg', data: seg, count: gi / 12 }];
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
