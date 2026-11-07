// Small 3D models built from rounded boxes: the baby animals, their treats and a soft ground shadow.
// Vertex layout: position(3) normal(3) colour(3) part(1) = 10 floats.
// Model space: feet at y=0, facing +Z.
//
// Parts (animated in the entity shader):
//   0 body · 1/2 right/left wing (flap) · 3 feet (no squash) · 4/5 front legs · 6/7 back legs
//   8 tail (wags) · 9 shadow · 10 head (nods)
// Each model carries a rig with the pivots: wing [x, y], leg [hipY, frontZ, backZ], head [y, z], tail [z].

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

  // Shiny round toy eyes on a front face at depth z.
  eyes(x, y, z, w, h, part = 0) {
    for (const sx of [-1, 1]) {
      this.box([sx * x, y, z], [w, h, 0.03], Math.min(w, h) * 0.4, '#1c1a1a', part, false);
      this.box([sx * x - w * 0.18, y + h * 0.2, z + 0.017], [w * 0.34, w * 0.34, 0.01], w * 0.12, '#ffffff', part, false);
    }
    return this;
  }

  // Four legs: x offset, front z, back z, size, colour, hoof/paw colour and height.
  legs(x, fz, bz, s, color, foot, footH) {
    const parts = [[x, fz, 4], [-x, fz, 5], [x, bz, 6], [-x, bz, 7]];
    for (const [lx, lz, part] of parts) {
      this.box([lx, s[1] / 2, lz], s, 0.035, color, part, false);
      this.box([lx, footH / 2, lz + 0.005], [s[0] + 0.012, footH, s[2] + 0.012], 0.03, foot, part, false);
    }
    return this;
  }

  done(rig) { return { verts: new Float32Array(this.v), idx: new Uint16Array(this.i), rig }; }
}

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
  return m.done({ wing: [0.24, 0.36], leg: [0, 0, 0], head: [0, 0], tail: [0] });
}

// Cream calf with chocolate patches, pink snout and little horns.
export function calfModel() {
  const m = new ModelBuilder();
  const cream = '#f4ecdc', brown = '#7a3b1e', pink = '#f4a090', H = 10;
  m.legs(0.12, 0.16, -0.2, [0.15, 0.32, 0.15], cream, '#6b3219', 0.08);
  m.box([0.12, 0.2, 0.236], [0.07, 0.07, 0.01], 0.02, brown, 4, false);       // spot on a leg
  m.box([0, 0.47, -0.02], [0.4, 0.32, 0.58], 0.08, cream);
  m.box([0.201, 0.5, -0.12], [0.02, 0.16, 0.2], 0.01, brown, 0, false);
  m.box([-0.201, 0.43, 0.06], [0.02, 0.13, 0.14], 0.01, brown, 0, false);
  m.box([0.06, 0.631, -0.17], [0.2, 0.02, 0.18], 0.01, brown, 0, false);
  m.box([-0.04, 0.5, -0.311], [0.24, 0.18, 0.02], 0.01, brown, 0, false);
  // head
  m.box([0, 0.7, 0.3], [0.42, 0.38, 0.34], 0.08, cream, H);
  m.box([0.12, 0.74, 0.471], [0.17, 0.2, 0.02], 0.02, brown, H, false);       // eye patch
  m.eyes(0.1, 0.74, 0.48, 0.085, 0.095, H);
  m.box([0, 0.6, 0.5], [0.3, 0.15, 0.1], 0.05, pink, H);
  for (const sx of [-1, 1]) {
    m.box([sx * 0.07, 0.6, 0.552], [0.03, 0.05, 0.02], 0.01, '#9a4a40', H, false);
    m.box([sx * 0.27, 0.76, 0.27], [0.14, 0.09, 0.07], 0.03, cream, H, false);   // ears
    m.box([sx * 0.28, 0.76, 0.305], [0.08, 0.05, 0.02], 0.01, pink, H, false);
    m.box([sx * 0.11, 0.93, 0.26], [0.07, 0.12, 0.07], 0.03, '#f3e2b0', H, false); // horns
  }
  m.box([0, 0.45, -0.33], [0.05, 0.22, 0.05], 0.02, cream, 8, false);
  m.box([0, 0.33, -0.33], [0.075, 0.08, 0.075], 0.03, brown, 8, false);
  return m.done({ wing: [0, 0], leg: [0.32, 0.16, -0.2], head: [0.6, 0.15], tail: [-0.31] });
}

// Pink piglet with a round snout, floppy ears and a curly tail.
export function pigletModel() {
  const m = new ModelBuilder();
  const pink = '#f7a8ad', dark = '#ec8a92', deep = '#d9707b', H = 10;
  m.legs(0.11, 0.15, -0.16, [0.13, 0.2, 0.13], pink, deep, 0.06);
  m.box([0, 0.34, -0.02], [0.38, 0.3, 0.5], 0.09, pink);
  for (const [x, y, z] of [[0.191, 0.38, -0.1], [0.191, 0.3, -0.18], [-0.191, 0.36, 0.02], [-0.191, 0.28, -0.14]])
    m.box([x, y, z], [0.01, 0.04, 0.04], 0.01, dark, 0, false);
  // head
  m.box([0, 0.46, 0.27], [0.38, 0.34, 0.3], 0.09, pink, H);
  m.eyes(0.1, 0.52, 0.425, 0.08, 0.09, H);
  m.box([0, 0.4, 0.45], [0.2, 0.14, 0.08], 0.06, dark, H);
  for (const sx of [-1, 1]) {
    m.box([sx * 0.045, 0.4, 0.492], [0.04, 0.06, 0.02], 0.015, '#9c3f4b', H, false);
    m.box([sx * 0.15, 0.37, 0.424], [0.06, 0.035, 0.01], 0.012, deep, H, false);   // cheeks
    m.box([sx * 0.13, 0.65, 0.34], [0.13, 0.04, 0.13], 0.02, dark, H, false);      // ears
    m.box([sx * 0.13, 0.62, 0.41], [0.12, 0.06, 0.03], 0.015, dark, H, false);     // ear tips flop forward
  }
  m.box([0, 0.4, -0.3], [0.05, 0.05, 0.08], 0.02, dark, 8, false);
  m.box([0, 0.45, -0.34], [0.05, 0.09, 0.05], 0.02, dark, 8, false);
  m.box([0, 0.49, -0.3], [0.05, 0.05, 0.07], 0.02, dark, 8, false);
  return m.done({ wing: [0, 0], leg: [0.2, 0.15, -0.16], head: [0.4, 0.14], tail: [-0.27] });
}

// Fluffy lamb: a cloud of wool with a soft taupe face and legs.
export function lambModel() {
  const m = new ModelBuilder();
  const wool = '#fbf8f2', face = '#d6c6c3', leg = '#c9b8b5', H = 10;
  m.legs(0.11, 0.15, -0.17, [0.11, 0.28, 0.11], leg, '#7d6e6e', 0.07);
  m.box([0, 0.46, -0.02], [0.42, 0.36, 0.54], 0.17, wool);
  const lumps = [[0.17, 0.5, -0.18], [0.18, 0.44, 0.02], [0.16, 0.5, 0.18], [-0.17, 0.46, -0.16], [-0.18, 0.5, 0.04], [-0.16, 0.44, 0.17],
    [0.08, 0.62, -0.16], [-0.07, 0.63, 0.0], [0.07, 0.62, 0.15], [-0.09, 0.6, -0.2], [0, 0.4, -0.27]];
  for (const [x, y, z] of lumps) m.box([x, y, z], [0.19, 0.18, 0.2], 0.085, wool);
  // head
  m.box([0, 0.67, 0.36], [0.32, 0.3, 0.2], 0.07, face, H);
  m.box([0, 0.86, 0.29], [0.38, 0.15, 0.28], 0.07, wool, H);
  m.box([0.03, 0.94, 0.27], [0.22, 0.1, 0.2], 0.05, wool, H);
  m.box([-0.14, 0.84, 0.39], [0.12, 0.1, 0.08], 0.045, wool, H);
  m.box([0.1, 0.85, 0.4], [0.14, 0.09, 0.08], 0.04, wool, H);
  m.eyes(0.08, 0.69, 0.465, 0.085, 0.1, H);
  m.box([-0.012, 0.585, 0.462], [0.035, 0.015, 0.01], 0.006, '#4a3434', H, false);
  m.box([0.012, 0.585, 0.462], [0.035, 0.015, 0.01], 0.006, '#4a3434', H, false);
  for (const sx of [-1, 1]) m.box([sx * 0.22, 0.72, 0.32], [0.17, 0.07, 0.1], 0.03, face, H, false);
  m.box([0, 0.55, -0.32], [0.14, 0.14, 0.12], 0.06, wool, 8);
  return m.done({ wing: [0, 0], leg: [0.28, 0.15, -0.17], head: [0.6, 0.22], tail: [-0.28] });
}

// Grey wolf pup with cream mask, pointy ears and a fluffy wagging tail.
export function pupModel() {
  const m = new ModelBuilder();
  const grey = '#8d7f78', dark = '#6f625c', cream = '#f2e0cc', H = 10;
  m.legs(0.1, 0.13, -0.15, [0.12, 0.22, 0.12], grey, cream, 0.07);
  m.box([0, 0.33, -0.02], [0.32, 0.26, 0.46], 0.08, grey);
  m.box([0, 0.205, 0], [0.24, 0.02, 0.3], 0.01, cream, 0, false);
  m.box([0, 0.33, 0.2], [0.2, 0.2, 0.08], 0.06, cream);                     // chest fluff
  // head
  m.box([0, 0.62, 0.22], [0.42, 0.36, 0.34], 0.08, grey, H);
  m.box([0, 0.53, 0.384], [0.34, 0.14, 0.02], 0.02, cream, H, false);
  for (const sx of [-1, 1]) {
    m.box([sx * 0.1, 0.735, 0.391], [0.12, 0.05, 0.01], 0.015, cream, H, false); // brows
    m.box([sx * 0.12, 0.84, 0.17], [0.13, 0.12, 0.07], 0.03, dark, H, false);    // ears
    m.box([sx * 0.12, 0.93, 0.17], [0.07, 0.08, 0.06], 0.025, dark, H, false);
    m.box([sx * 0.12, 0.85, 0.206], [0.07, 0.08, 0.01], 0.01, cream, H, false);
    m.box([sx * 0.22, 0.56, 0.22], [0.04, 0.12, 0.1], 0.02, dark, H, false);     // cheek fluff
  }
  m.eyes(0.1, 0.66, 0.395, 0.08, 0.09, H);
  m.box([0, 0.54, 0.43], [0.2, 0.14, 0.12], 0.05, cream, H);
  m.box([0, 0.6, 0.49], [0.08, 0.06, 0.05], 0.02, '#1d1a1a', H, false);
  m.box([0.03, 0.46, 0.47], [0.06, 0.05, 0.06], 0.02, '#f27f8c', H, false);  // tongue
  m.box([0, 0.42, -0.27], [0.1, 0.12, 0.12], 0.04, grey, 8);
  m.box([0, 0.53, -0.32], [0.13, 0.14, 0.13], 0.05, dark, 8);
  m.box([0, 0.64, -0.33], [0.1, 0.1, 0.1], 0.04, cream, 8);
  return m.done({ wing: [0, 0], leg: [0.22, 0.13, -0.15], head: [0.48, 0.12], tail: [-0.24] });
}

// ---- treats ----
const NO_RIG = { wing: [0, 0], leg: [0, 0, 0], head: [0, 0], tail: [0] };
export function seedModel() {
  return new ModelBuilder().box([0, 0.03, 0], [0.09, 0.06, 0.12], 0.03, '#e9c27b', 0, false).done(NO_RIG);
}
export function wheatModel() {
  const m = new ModelBuilder();
  m.box([0, 0.04, -0.02], [0.1, 0.07, 0.24], 0.03, '#e8c35a', 0, false);
  m.box([0, 0.05, 0.12], [0.15, 0.09, 0.1], 0.04, '#d9a53e', 0, false);
  m.box([0, 0.045, -0.02], [0.12, 0.08, 0.03], 0.01, '#c9473b', 0, false);
  return m.done(NO_RIG);
}
export function appleModel() {
  const m = new ModelBuilder();
  m.box([0, 0.08, 0], [0.17, 0.16, 0.17], 0.07, '#e8443a');
  m.box([0, 0.18, 0], [0.025, 0.06, 0.025], 0.01, '#6b4226', 0, false);
  m.box([0.035, 0.19, 0], [0.06, 0.015, 0.035], 0.007, '#4cc25a', 0, false);
  return m.done(NO_RIG);
}
export function cloverModel() {
  const m = new ModelBuilder();
  for (const [x, z] of [[0, 0.05], [-0.05, -0.03], [0.05, -0.03]]) m.box([x, 0.04, z], [0.085, 0.025, 0.085], 0.035, '#4cc25a', 0, false);
  m.box([0, 0.02, -0.08], [0.02, 0.02, 0.1], 0.008, '#3a9a46', 0, false);
  return m.done(NO_RIG);
}
export function boneModel() {
  const m = new ModelBuilder();
  m.box([0, 0.035, 0], [0.05, 0.05, 0.2], 0.02, '#f4efe3', 0, false);
  for (const sz of [-1, 1]) for (const sx of [-1, 1]) m.box([sx * 0.03, 0.04, sz * 0.1], [0.06, 0.065, 0.06], 0.028, '#f4efe3', 0, false);
  return m.done(NO_RIG);
}

export function shadowModel() {
  return new ModelBuilder().disc(0.5, 14, '#000000', 9).done(NO_RIG);
}

// ---- 2D icons for the hotbar (treats) ----
function canvas64(px, draw) {
  const c = document.createElement('canvas');
  c.width = c.height = px;
  const g = c.getContext('2d');
  g.scale(px / 64, px / 64);
  draw(g);
  return c;
}
const rr = (g, x, y, w, h, r, fill) => { g.fillStyle = fill; g.beginPath(); g.roundRect(x, y, w, h, r); g.fill(); };

export function treatIcon(kind, px = 64) {
  return canvas64(px, g => {
    if (kind === 'seeds') {
      g.fillStyle = '#c9925a';
      g.beginPath(); g.moveTo(14, 26); g.quadraticCurveTo(8, 56, 32, 58); g.quadraticCurveTo(56, 56, 50, 26); g.closePath(); g.fill();
      g.fillStyle = '#a8743f';
      g.beginPath(); g.ellipse(32, 26, 19, 7, 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#e04a3c'; g.fillRect(16, 23, 32, 4);
      g.fillStyle = '#f2cf86';
      for (const [x, y] of [[26, 18], [33, 15], [39, 19], [30, 22], [37, 24], [22, 22]]) {
        g.beginPath(); g.ellipse(x, y, 3.2, 2.2, 0.5, 0, Math.PI * 2); g.fill();
      }
    } else if (kind === 'wheat') {
      g.translate(32, 34); g.rotate(-0.5);
      for (const dx of [-7, 0, 7]) rr(g, dx - 2, -6, 4, 30, 2, '#d9a53e');
      for (const dx of [-8, 0, 8]) for (let k = 0; k < 4; k++) {
        rr(g, dx - 4, -24 + k * 5, 4, 6, 2, '#f2c35a'); rr(g, dx, -22 + k * 5, 4, 6, 2, '#e8b445');
      }
      rr(g, -12, 6, 24, 5, 2, '#c9473b');
    } else if (kind === 'apple') {
      rr(g, 12, 18, 40, 38, 16, '#e8443a');
      rr(g, 18, 22, 9, 12, 4, '#ff8a7a');
      rr(g, 30, 8, 5, 14, 2, '#6b4226');
      g.fillStyle = '#4cc25a'; g.beginPath(); g.ellipse(42, 13, 9, 5, -0.4, 0, Math.PI * 2); g.fill();
    } else if (kind === 'clover') {
      rr(g, 30, 34, 5, 24, 2, '#3a9a46');
      for (const [x, y] of [[32, 18], [20, 32], [44, 32]]) {
        g.fillStyle = '#4cc25a'; g.beginPath(); g.arc(x - 5, y, 9, 0, Math.PI * 2); g.arc(x + 5, y, 9, 0, Math.PI * 2); g.fill();
      }
      g.fillStyle = '#7fe08a'; g.beginPath(); g.arc(32, 28, 4, 0, Math.PI * 2); g.fill();
    } else if (kind === 'bone') {
      g.translate(32, 32); g.rotate(-0.7);
      rr(g, -18, -6, 36, 12, 5, '#f4efe3');
      for (const sx of [-1, 1]) for (const sy of [-1, 1]) { g.fillStyle = '#f4efe3'; g.beginPath(); g.arc(sx * 19, sy * 7, 8, 0, Math.PI * 2); g.fill(); }
      g.fillStyle = '#d8cfbd'; g.fillRect(-16, 2, 32, 4);
    }
  });
}

// Small SVG faces for the nursery counters.
export const FACE_SVG = {
  chick: `<rect x="5" y="7" width="22" height="21" rx="8" fill="#ffe46a"/><path d="M13 4c1 2 1 3 0 4M16 3c1 2 1 3 0 5M19 4c1 2 1 3 0 4" stroke="#ffd23c" stroke-width="2.4" stroke-linecap="round" fill="none"/><rect x="10" y="13" width="3.5" height="4" rx="1.6" fill="#1c1a1a"/><rect x="18.5" y="13" width="3.5" height="4" rx="1.6" fill="#1c1a1a"/><rect x="13.5" y="18" width="5" height="3" rx="1.4" fill="#ff8a2a"/><rect x="7" y="19" width="3.5" height="2" rx="1" fill="#ffa0a0"/><rect x="21.5" y="19" width="3.5" height="2" rx="1" fill="#ffa0a0"/>`,
  calf: `<rect x="1" y="9" width="7" height="5" rx="2" fill="#f4ecdc"/><rect x="24" y="9" width="7" height="5" rx="2" fill="#f4ecdc"/><rect x="9" y="3" width="3" height="5" rx="1.5" fill="#f3e2b0"/><rect x="20" y="3" width="3" height="5" rx="1.5" fill="#f3e2b0"/><rect x="6" y="6" width="20" height="22" rx="5" fill="#f4ecdc"/><rect x="17" y="8" width="8" height="10" rx="2" fill="#7a3b1e"/><rect x="10" y="12" width="3.5" height="4" rx="1.6" fill="#1c1a1a"/><rect x="18.5" y="12" width="3.5" height="4" rx="1.6" fill="#1c1a1a"/><rect x="8" y="19" width="16" height="8" rx="3" fill="#f4a090"/><rect x="11.5" y="22" width="2" height="3" rx="1" fill="#9a4a40"/><rect x="18.5" y="22" width="2" height="3" rx="1" fill="#9a4a40"/>`,
  piglet: `<path d="M6 10L8 3l7 5zM26 10l-2-7-7 5z" fill="#ec8a92"/><rect x="5" y="6" width="22" height="21" rx="6" fill="#f7a8ad"/><rect x="9.5" y="11" width="3.5" height="4" rx="1.6" fill="#1c1a1a"/><rect x="19" y="11" width="3.5" height="4" rx="1.6" fill="#1c1a1a"/><rect x="10" y="17" width="12" height="8" rx="4" fill="#ec8a92"/><rect x="13" y="19.5" width="2" height="3" rx="1" fill="#9c3f4b"/><rect x="17" y="19.5" width="2" height="3" rx="1" fill="#9c3f4b"/>`,
  lamb: `<rect x="1" y="12" width="8" height="4" rx="2" fill="#d6c6c3"/><rect x="23" y="12" width="8" height="4" rx="2" fill="#d6c6c3"/><rect x="9" y="9" width="14" height="19" rx="5" fill="#d6c6c3"/><circle cx="10" cy="8" r="5" fill="#fbf8f2"/><circle cx="16" cy="6" r="5.5" fill="#fbf8f2"/><circle cx="22" cy="8" r="5" fill="#fbf8f2"/><rect x="10.5" y="15" width="3.5" height="4.5" rx="1.6" fill="#1c1a1a"/><rect x="18" y="15" width="3.5" height="4.5" rx="1.6" fill="#1c1a1a"/><path d="M14 24q2 1.6 4 0" stroke="#4a3434" stroke-width="1.3" fill="none" stroke-linecap="round"/>`,
  pup: `<path d="M6 12V2l8 6zM26 12V2l-8 6z" fill="#6f625c"/><rect x="4" y="7" width="24" height="20" rx="5" fill="#8d7f78"/><rect x="9" y="18" width="14" height="9" rx="3" fill="#f2e0cc"/><rect x="9.5" y="12" width="3.5" height="4" rx="1.6" fill="#1c1a1a"/><rect x="19" y="12" width="3.5" height="4" rx="1.6" fill="#1c1a1a"/><rect x="13.5" y="17.5" width="5" height="3.5" rx="1.5" fill="#1d1a1a"/><rect x="16" y="23" width="3" height="4" rx="1.4" fill="#f27f8c"/>`,
};
