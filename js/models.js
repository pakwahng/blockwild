// Small 3D models built from rounded boxes: the baby chick, a seed and a soft ground shadow.
// Vertex layout: position(3) normal(3) colour(3) part(1) = 10 floats.
// Model space: feet at y=0, facing +Z.

const hex = c => [parseInt(c.slice(1, 3), 16) / 255, parseInt(c.slice(3, 5), 16) / 255, parseInt(c.slice(5, 7), 16) / 255];

class ModelBuilder {
  constructor() { this.v = []; this.i = []; }

  // Rounded box centred at c with full size s, corner radius r.
  box(c, s, r, color, part = 0, smooth = true) {
    const col = hex(color);
    const h = [s[0] / 2, s[1] / 2, s[2] / 2];
    r = Math.min(r, h[0], h[1], h[2]);
    const inner = h.map(v => v - r);
    const steps = hv => {
      const t = smooth ? [-hv, -hv + r * 0.3, -hv + r, hv - r, hv - r * 0.3, hv] : [-hv, -hv + r, hv - r, hv];
      return t.filter((v, k) => k === 0 || v > t[k - 1] + 1e-6);
    };
    for (let a = 0; a < 3; a++) for (const sign of [1, -1]) {
      const [u, w] = [0, 1, 2].filter(k => k !== a);
      const us = steps(h[u]), ws = steps(h[w]);
      const base = this.v.length / 10;
      for (const U of us) for (const W of ws) {
        const q = [0, 0, 0]; q[a] = sign * h[a]; q[u] = U; q[w] = W;
        const cl = q.map((v, k) => Math.max(-inner[k], Math.min(inner[k], v)));
        const d = q.map((v, k) => v - cl[k]);
        const len = Math.hypot(...d) || 1;
        const n = d.map(v => v / len);
        const p = cl.map((v, k) => v + n[k] * r);
        this.v.push(c[0] + p[0], c[1] + p[1], c[2] + p[2], n[0], n[1], n[2], col[0], col[1], col[2], part);
      }
      const nw = ws.length;
      for (let x = 0; x < us.length - 1; x++) for (let y = 0; y < nw - 1; y++) {
        const A = base + x * nw + y, Bv = A + nw, C = Bv + 1, D = A + 1;
        this.tri(A, Bv, C); this.tri(A, C, D);
      }
    }
    return this;
  }

  // Adds a triangle facing the same way as its vertex normals.
  tri(a, b, c) {
    const v = this.v, P = k => [v[k * 10], v[k * 10 + 1], v[k * 10 + 2]];
    const [pa, pb, pc] = [P(a), P(b), P(c)];
    const e1 = [pb[0] - pa[0], pb[1] - pa[1], pb[2] - pa[2]], e2 = [pc[0] - pa[0], pc[1] - pa[1], pc[2] - pa[2]];
    const n = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]];
    let dot = 0;
    for (const k of [a, b, c]) dot += n[0] * v[k * 10 + 3] + n[1] * v[k * 10 + 4] + n[2] * v[k * 10 + 5];
    if (dot >= 0) this.i.push(a, b, c); else this.i.push(a, c, b);
  }

  disc(radius, segs, color, part) {
    const col = hex(color), base = this.v.length / 10;
    this.v.push(0, 0, 0, 0, 1, 0, ...col, part);
    for (let k = 0; k <= segs; k++) {
      const a = k / segs * Math.PI * 2;
      this.v.push(Math.cos(a) * radius, 0, Math.sin(a) * radius, 0, 1, 0, ...col, part);
    }
    for (let k = 0; k < segs; k++) this.tri(base, base + 1 + k, base + 2 + k);
    return this;
  }

  done() { return { verts: new Float32Array(this.v), idx: new Uint16Array(this.i) }; }
}

// Parts: 0 body, 1 right wing, 2 left wing (both flap), 3 feet, 9 shadow.
export function chickModel() {
  const m = new ModelBuilder();
  const yellow = '#ffe46a', wing = '#ffd84e', orange = '#ff8a2a', black = '#1c1a1a';
  m.box([0, 0.31, 0], [0.5, 0.5, 0.46], 0.17, yellow);
  // tuft
  m.box([0, 0.6, -0.02], [0.07, 0.14, 0.07], 0.03, '#ffd23c', 0, false);
  m.box([-0.06, 0.585, 0.01], [0.06, 0.1, 0.06], 0.03, '#ffd23c', 0, false);
  m.box([0.06, 0.585, -0.04], [0.06, 0.1, 0.06], 0.03, '#ffd23c', 0, false);
  // eyes with highlights
  for (const sx of [-1, 1]) {
    m.box([sx * 0.11, 0.37, 0.228], [0.085, 0.095, 0.03], 0.03, black, 0, false);
    m.box([sx * 0.11 - 0.015, 0.39, 0.245], [0.028, 0.028, 0.01], 0.01, '#ffffff', 0, false);
    m.box([sx * 0.17, 0.28, 0.226], [0.08, 0.045, 0.012], 0.02, '#ffa0a0', 0, false); // cheeks
  }
  m.box([0, 0.3, 0.25], [0.13, 0.075, 0.09], 0.03, orange, 0, false); // beak
  m.box([0.265, 0.27, -0.01], [0.06, 0.18, 0.22], 0.03, wing, 1, false);
  m.box([-0.265, 0.27, -0.01], [0.06, 0.18, 0.22], 0.03, wing, 2, false);
  for (const sx of [-1, 1]) m.box([sx * 0.1, 0.03, 0.05], [0.08, 0.06, 0.13], 0.025, orange, 3, false);
  return m.done();
}

export function seedModel() {
  return new ModelBuilder().box([0, 0.03, 0], [0.09, 0.06, 0.12], 0.03, '#e9c27b', 0, false).done();
}

export function shadowModel() {
  return new ModelBuilder().disc(0.5, 14, '#000000', 9).done();
}

// Hotbar icon for the seed pouch.
export function seedIcon(px = 64) {
  const c = document.createElement('canvas');
  c.width = c.height = px;
  const g = c.getContext('2d'), k = px / 64;
  g.scale(k, k);
  g.fillStyle = '#c9925a';
  g.beginPath(); g.moveTo(14, 26); g.quadraticCurveTo(8, 56, 32, 58); g.quadraticCurveTo(56, 56, 50, 26); g.closePath(); g.fill();
  g.fillStyle = '#a8743f';
  g.beginPath(); g.ellipse(32, 26, 19, 7, 0, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#e04a3c'; g.fillRect(16, 23, 32, 4);
  g.fillStyle = '#f2cf86';
  for (const [x, y] of [[26, 18], [33, 15], [39, 19], [30, 22], [37, 24], [22, 22]]) {
    g.beginPath(); g.ellipse(x, y, 3.2, 2.2, 0.5, 0, Math.PI * 2); g.fill();
  }
  return c;
}
