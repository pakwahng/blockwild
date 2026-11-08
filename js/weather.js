// Rain showers now and then, and a rainbow afterwards on a sunny day.
// The host decides when it rains; guests get the same weather over the network.
import { SOLID, B } from './blocks.js';

const DROPS = 360, AREA = 18, FALL = 16;

export class Weather {
  constructor(world) {
    this.world = world;
    this.raining = false;   // what the sky is heading towards
    this.amount = 0;        // 0 clear … 1 full rain (eases in and out)
    this.rainbow = 0;       // 0 … 1, after a shower ends by day
    this.timer = 150 + Math.random() * 200; // seconds until the weather next changes
    this.events = [];
    this.drops = [];
    this._buf = new Float32Array(DROPS * 12);
  }

  // Host only: start and stop showers. day: true while the sun is up.
  update(dt, day) {
    this.timer -= dt;
    if (this.timer <= 0) {
      if (this.raining) { this.raining = false; this.timer = 200 + Math.random() * 260; this.events.push({ type: 'rainEnd', rainbow: day }); if (day) this.rainbowT = 45; }
      else { this.raining = true; this.timer = 60 + Math.random() * 70; this.events.push({ type: 'rain' }); }
    }
    this.step(dt);
  }
  // Both: ease the rain and the rainbow in and out.
  step(dt) {
    this.amount += ((this.raining ? 1 : 0) - this.amount) * Math.min(1, dt * 0.35);
    if (this.rainbowT > 0) this.rainbowT -= dt;
    const want = this.rainbowT > 0 && !this.raining ? 1 : 0;
    this.rainbow += (want - this.rainbow) * Math.min(1, dt * 0.4);
  }
  snapshot() { return [this.raining ? 1 : 0, Math.max(0, Math.round(this.rainbowT || 0))]; }
  applySnapshot(s) {
    if (!Array.isArray(s)) return;
    this.raining = !!s[0]; this.rainbowT = s[1] || 0;
  }

  // Rain drops falling around the eye; they stop on roofs, so it stays dry indoors.
  instances(eye, dt) {
    const n = Math.round(DROPS * this.amount), w = this.world, d = this._buf;
    while (this.drops.length < n) this.drops.push(this.newDrop(eye, true));
    if (this.drops.length > n) this.drops.length = n;
    let k = 0;
    for (let i = 0; i < this.drops.length; i++) {
      const p = this.drops[i];
      p[1] -= FALL * dt; p[0] += 1.2 * dt;
      const far = Math.abs(p[0] - eye[0]) > AREA || Math.abs(p[2] - eye[2]) > AREA;
      const id = w.getBlock(Math.floor(p[0]), Math.floor(p[1]), Math.floor(p[2]));
      if (far || p[1] < eye[1] - 10 || SOLID[id] || id === B.WATER) { this.drops[i] = this.newDrop(eye, false); continue; }
      d[k++] = p[0]; d[k++] = p[1]; d[k++] = p[2]; d[k++] = 0;
      d[k++] = 1; d[k++] = 0; d[k++] = 0; d[k++] = 0; d[k++] = 0; d[k++] = 0; d[k++] = 0; d[k++] = 0;
    }
    return { model: 'rain', data: d, count: k / 12 };
  }
  newDrop(eye, anywhere) {
    return [eye[0] + (Math.random() * 2 - 1) * AREA, eye[1] + (anywhere ? Math.random() * 18 - 6 : 10 + Math.random() * 4), eye[2] + (Math.random() * 2 - 1) * AREA];
  }

  // Greys the sky while it rains.
  shade(sky) {
    const a = this.amount * 0.55, grey = [0.55, 0.6, 0.66];
    const mix = (c, g, t) => c.map((v, i) => v + (g[i] - v) * t);
    return {
      ...sky,
      horizon: mix(sky.horizon, grey.map(v => v * (1 - 0.7 * sky.night)), a),
      zenith: mix(sky.zenith, grey.map(v => v * 0.9 * (1 - 0.75 * sky.night)), a),
      tint: sky.tint.map(v => v * (1 - 0.22 * this.amount)),
      entTint: sky.entTint.map(v => v * (1 - 0.18 * this.amount)),
    };
  }
}
