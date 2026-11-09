// Fireworks: a rocket whooshes up from where you launch it, trailing sparks, then bursts into a ball of
// glowing colour that drifts down and fades. Everyone in a shared world sees the same rocket.
import { SPARK_COLORS } from './models.js';

const RISE = 14, FUSE = [1.1, 1.5], SPARKS = 90, MAX_SPARKS = 1400;

export class Fireworks {
  constructor() { this.rockets = []; this.sparks = []; this.events = []; this.buf = {}; }

  // p: where it starts; seed picks its colours and shape (so everyone sees the same one)
  launch(p, seed = Math.random() * 1e9 | 0) {
    const r = rnd(seed);
    const main = r() * 5 | 0, second = r() < 0.5 ? 5 : (main + 1 + (r() * 4 | 0)) % 5;
    this.rockets.push({ p: [p[0], p[1] + 0.3, p[2]], v: [(r() - 0.5) * 1.2, RISE, (r() - 0.5) * 1.2], t: FUSE[0] + r() * (FUSE[1] - FUSE[0]),
      colors: [main, second], ring: r() < 0.35, trail: 0 });
    this.events.push({ type: 'launch', p: [...p] });
  }

  update(dt) {
    for (const k of this.rockets) {
      k.t -= dt;
      k.v[1] -= 4 * dt;
      for (let a = 0; a < 3; a++) k.p[a] += k.v[a] * dt;
      k.trail -= dt;
      if (k.trail <= 0) {
        k.trail = 0.03;
        this.sparks.push({ p: [...k.p], v: [(Math.random() - 0.5) * 0.6, -1.5, (Math.random() - 0.5) * 0.6], c: 1, life: 0.5, max: 0.5, drag: 1 });
      }
      if (k.t <= 0) this.pop(k);
    }
    this.rockets = this.rockets.filter(k => k.t > 0);
    for (const s of this.sparks) {
      s.life -= dt;
      const d = Math.exp(-s.drag * dt);
      s.v[0] *= d; s.v[2] *= d; s.v[1] = s.v[1] * d - 3 * dt;
      for (let a = 0; a < 3; a++) s.p[a] += s.v[a] * dt;
    }
    this.sparks = this.sparks.filter(s => s.life > 0);
    if (this.sparks.length > MAX_SPARKS) this.sparks.splice(0, this.sparks.length - MAX_SPARKS);
  }

  pop(k) {
    this.events.push({ type: 'pop', p: [...k.p] });
    for (let i = 0; i < SPARKS; i++) {
      // evenly round a sphere (or a flat ring), with a little wobble
      const u = (i + 0.5) / SPARKS, th = i * 2.39996, y = k.ring ? (Math.random() - 0.5) * 0.15 : 1 - 2 * u, rr = Math.sqrt(Math.max(0, 1 - y * y));
      const sp = 9 + Math.random() * 1.5, life = 1.4 + Math.random() * 0.7;
      this.sparks.push({ p: [...k.p], v: [Math.cos(th) * rr * sp, y * sp + 1, Math.sin(th) * rr * sp], c: k.colors[i % 3 === 0 ? 1 : 0], life, max: life, drag: 1.6 });
    }
  }

  instances(eye, far) {
    const need = (key, n) => (this.buf[key] && this.buf[key].length >= n * 12) ? this.buf[key] : (this.buf[key] = new Float32Array(n * 12 + 120));
    const groups = [], f2 = far * far;
    const data = SPARK_COLORS.map((_, k) => need('s' + k, this.sparks.length)), count = SPARK_COLORS.map(() => 0);
    for (const s of this.sparks) {
      const dx = s.p[0] - eye[0], dz = s.p[2] - eye[2];
      if (dx * dx + dz * dz > f2) continue;
      const d = data[s.c], i = count[s.c]++ * 12, sc = Math.min(1, s.life / s.max * 1.6) * (s.drag === 1 ? 0.7 : 1);
      d.set([s.p[0], s.p[1], s.p[2], s.life * 7, sc, 0, 0, 0, 0, 0, 0, 0], i);
    }
    SPARK_COLORS.forEach((_, k) => { if (count[k]) groups.push({ model: 'spark' + k, data: data[k], count: count[k] }); });
    if (this.rockets.length) {
      const d = need('r', this.rockets.length);
      this.rockets.forEach((k, i) => d.set([k.p[0], k.p[1], k.p[2], 0, 1, 0, 0, 0, 0, 0, 0, 0], i * 12));
      groups.push({ model: 'rocket', data: d, count: this.rockets.length });
    }
    return groups;
  }
}

function rnd(seed) { let s = seed >>> 0 || 1; return () => ((s = Math.imul(s ^ (s >>> 15), 0x2c1b3c6d) + 0x6d2b79f5 >>> 0) / 4294967296); }
