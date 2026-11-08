// Little visitors, just for looking at: butterflies flutter round flowers and over meadows by day,
// fireflies drift and blink over the grass at night. Each device makes its own (they aren't shared in play together).
import { B, SOLID } from './blocks.js';
import { CS } from './world.js';

const FLOWERS = new Set([B.FLOWER_RED, B.FLOWER_YELLOW, B.FLOWER_WHITE]);
export const BUTTERFLY_KINDS = 3;
const MAX_BUTTERFLIES = 10, MAX_FIREFLIES = 22, RANGE = 22;

export class Critters {
  constructor(world) {
    this.world = world;
    this.list = [];
    this.spawnT = 0;
    this.buf = {};
  }

  // Ground height at a column near (x, z), or -1 if it's not loaded or it's water.
  ground(x, z) {
    const w = this.world;
    if (!w.getChunk(Math.floor(x / CS), Math.floor(z / CS))) return -1;
    for (let y = 70; y > 1; y--) {
      const id = w.getBlock(x, y - 1, z);
      if (id === B.WATER) return -1;
      if (SOLID[id]) return y;
    }
    return -1;
  }

  // centre: where the player is; night: 0 (day) to 1 (night); rain: 0 to 1.
  update(dt, centre, night, rain = 0) {
    const day = night < 0.35 && rain < 0.3, dark = night > 0.6;
    this.spawnT -= dt;
    if (this.spawnT <= 0) {
      this.spawnT = 0.4;
      const bf = this.list.filter(c => c.kind === 'b' && !c.leaving).length, ff = this.list.filter(c => c.kind === 'f' && !c.leaving).length;
      if (day && bf < MAX_BUTTERFLIES) this.trySpawn('b', centre);
      if (dark && ff < MAX_FIREFLIES) this.trySpawn('f', centre);
    }
    for (const c of this.list) {
      c.t += dt;
      if ((c.kind === 'b' && !day) || (c.kind === 'f' && !dark)) c.leaving = true;
      const dx = c.p[0] - centre[0], dz = c.p[2] - centre[2];
      if (dx * dx + dz * dz > (RANGE + 10) ** 2) c.gone = true;
      if (c.leaving) {
        // butterflies flutter up and away, fireflies fade out
        c.fade = Math.max(0, (c.fade ?? 1) - dt * 0.6);
        if (c.kind === 'b') c.p[1] += dt * 1.2;
        if (c.fade === 0) c.gone = true;
      } else c.fade = Math.min(1, (c.fade ?? 0) + dt * 0.8);
      if (c.kind === 'b') this.stepButterfly(c, dt); else this.stepFirefly(c, dt);
    }
    this.list = this.list.filter(c => !c.gone);
  }

  trySpawn(kind, centre) {
    for (let k = 0; k < 6; k++) {
      const x = Math.floor(centre[0] + (Math.random() * 2 - 1) * RANGE), z = Math.floor(centre[2] + (Math.random() * 2 - 1) * RANGE);
      const y = this.ground(x, z);
      if (y < 0) continue;
      const top = this.world.getBlock(x, y, z), under = this.world.getBlock(x, y - 1, z);
      if (kind === 'b') {
        // mostly by flowers, now and then over a meadow
        const flower = FLOWERS.has(top);
        if (!flower && (under !== B.GRASS || Math.random() > 0.15)) continue;
        const home = [x + 0.5, y, z + 0.5];
        this.list.push({ kind, home, p: [home[0], y + 0.8 + Math.random(), home[2]], aim: null, rest: 0, t: Math.random() * 9, look: BUTTERFLY_KINDS * Math.random() | 0, yaw: Math.random() * 6.28, flower });
        return;
      }
      if (under !== B.GRASS && !FLOWERS.has(top)) continue;
      this.list.push({ kind, home: [x + 0.5, y, z + 0.5], p: [x + 0.5, y + 0.5 + Math.random() * 1.5, z + 0.5], v: [0, 0, 0], t: Math.random() * 9, blink: Math.random() * 4, yaw: 0 });
      return;
    }
  }

  stepButterfly(c, dt) {
    if (c.rest > 0) {
      // sitting on the flower with its wings slowly opening and closing
      c.rest -= dt;
      return;
    }
    if (!c.aim || Math.hypot(c.aim[0] - c.p[0], c.aim[1] - c.p[1], c.aim[2] - c.p[2]) < 0.25) {
      if (c.flower && Math.random() < 0.25 && !c.leaving) {
        c.aim = [c.home[0], c.home[1] + 0.32, c.home[2]];
        c.landing = true;
      } else {
        const a = Math.random() * 6.28, r = Math.random() * 3;
        c.aim = [c.home[0] + Math.cos(a) * r, c.home[1] + 0.5 + Math.random() * 1.6, c.home[2] + Math.sin(a) * r];
        c.landing = false;
      }
    }
    const dx = c.aim[0] - c.p[0], dy = c.aim[1] - c.p[1], dz = c.aim[2] - c.p[2], l = Math.hypot(dx, dy, dz) || 1;
    const sp = 1.1 * Math.min(1, l * 2);
    c.p[0] += dx / l * sp * dt; c.p[2] += dz / l * sp * dt;
    c.p[1] += (dy / l * sp + Math.sin(c.t * 7) * 0.6) * dt; // bobbing flight
    const ty = Math.atan2(dx, dz);
    c.yaw += Math.atan2(Math.sin(ty - c.yaw), Math.cos(ty - c.yaw)) * Math.min(1, dt * 6);
    if (c.landing && l < 0.3) { c.rest = 2 + Math.random() * 4; c.p = [...c.aim]; c.aim = null; }
  }

  stepFirefly(c, dt) {
    c.blink -= dt;
    if (c.blink < -0.9) c.blink = 1 + Math.random() * 3.5;
    // a slow, wandering drift that stays near where it started
    c.v[0] += ((Math.random() * 2 - 1) * 1.2 + (c.home[0] - c.p[0]) * 0.15) * dt;
    c.v[2] += ((Math.random() * 2 - 1) * 1.2 + (c.home[2] - c.p[2]) * 0.15) * dt;
    c.v[1] += ((Math.random() * 2 - 1) * 0.8 + (c.home[1] + 1.1 - c.p[1]) * 0.4) * dt;
    for (let i = 0; i < 3; i++) { c.v[i] *= 1 - Math.min(1, dt * 0.8); c.p[i] += c.v[i] * dt; }
    if (c.p[1] < c.home[1] + 0.2) { c.p[1] = c.home[1] + 0.2; c.v[1] = Math.abs(c.v[1]); }
    c.yaw = Math.atan2(c.v[0], c.v[2]);
  }

  // Per-instance data for the renderer, in the same layout as the animals.
  instances(eye, maxDist, time) {
    const groups = [];
    const counts = {}, md2 = maxDist * maxDist;
    const need = (key, n) => (this.buf[key] && this.buf[key].length >= n * 12) ? this.buf[key] : (this.buf[key] = new Float32Array(n * 12 + 120));
    const keys = [...Array(BUTTERFLY_KINDS).keys()].map(k => 'butterfly' + k).concat('firefly');
    for (const k of keys) { need(k, this.list.length); counts[k] = 0; }
    for (const c of this.list) {
      const dx = c.p[0] - eye[0], dz = c.p[2] - eye[2];
      if (dx * dx + dz * dz > md2) continue;
      let key, scale, flap;
      if (c.kind === 'b') {
        key = 'butterfly' + c.look;
        scale = 1.15 * (c.fade ?? 1);
        flap = c.rest > 0 ? 0.9 + 0.5 * Math.sin(time * 2 + c.t) : 0.15 + 0.85 * Math.abs(Math.sin(c.t * 16));
      } else {
        key = 'firefly';
        const on = c.blink > 0 ? Math.min(1, c.blink * 3) : 0;
        scale = (0.35 + 0.95 * on) * (c.fade ?? 1);
        if (scale < 0.05) continue;
        flap = 0.3 * Math.sin(c.t * 30);
      }
      const d = this.buf[key];
      let i = counts[key]++ * 12;
      d[i++] = c.p[0]; d[i++] = c.p[1]; d[i++] = c.p[2]; d[i++] = c.yaw;
      d[i++] = scale; d[i++] = 0; d[i++] = flap; d[i++] = 0;
      d[i++] = 0; d[i++] = 0; d[i++] = 0; d[i++] = 0;
    }
    for (const k of keys) groups.push({ model: k, data: this.buf[k], count: counts[k] });
    return groups;
  }
}
