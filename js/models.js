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

// ---- the night snake: a goofy head and chunky striped body blocks ----
// Each kind of snake (see SNAKE_KINDS in snakes.js) has its own colours: [body, snout and speckles, stripe, nostrils].
const SNAKE_COLORS = [
  ['#5cb84a', '#74cc5e', '#6a2a6e', '#2a5a22'],   // plain: green with purple stripes
  ['#8a4ad0', '#a86ae6', '#9be04a', '#4a2270'],   // poison: purple with lime stripes
  ['#5ab0f0', '#8fd0ff', '#f6f6f2', '#2a6a9a'],   // flying: sky blue with white stripes
  ['#c8823c', '#e0a060', '#4a3a30', '#6a3a14'],   // digger: clay orange with dark stripes
  ['#d8402c', '#f06a4a', '#2a2a2e', '#7a1a10'],   // boom: red with black stripes
];
export function snakeHeadModel(kind = 0) {
  const m = new ModelBuilder();
  const [SNAKE_GREEN, SNAKE_LIGHT, , NOSE] = SNAKE_COLORS[kind] || SNAKE_COLORS[0];
  m.box([0, 0.24, -0.02], [0.5, 0.4, 0.46], 0.14, SNAKE_GREEN);
  m.box([0, 0.17, 0.25], [0.42, 0.22, 0.2], 0.09, SNAKE_LIGHT);                  // snout
  if (kind === 2) for (const sx of [-1, 1]) {                                      // flapping feathery wings
    const part = sx > 0 ? 1 : 2;
    m.box([sx * 0.45, 0.38, -0.08], [0.42, 0.05, 0.34], 0.024, '#ffffff', part);
    for (let f = 0; f < 3; f++) m.box([sx * (0.36 + f * 0.12), 0.375, -0.27], [0.1, 0.04, 0.12], 0.02, '#e6f2ff', part, false);
  }
  if (kind === 3) {                                                                // yellow hard hat and two big digging teeth
    m.box([0, 0.5, -0.04], [0.48, 0.16, 0.44], 0.08, '#ffd23c');
    m.box([0, 0.43, 0.02], [0.58, 0.035, 0.56], 0.015, '#f2b81c', 0, false);
    m.box([0, 0.6, -0.04], [0.08, 0.04, 0.36], 0.02, '#f2b81c', 0, false);
    for (const sx of [-1, 1]) m.box([sx * 0.05, 0.04, 0.33], [0.07, 0.08, 0.04], 0.015, '#ffffff', 0, false);
  }
  if (kind === 4) {                                                                // a fuse on top with a spark
    m.box([0, 0.5, -0.06], [0.05, 0.16, 0.05], 0.02, '#3a2a20', 0, false);
    m.box([0, 0.6, -0.06], [0.09, 0.09, 0.09], 0.04, '#ffd23c', 0, false);
    m.box([0, 0.62, -0.06], [0.05, 0.05, 0.05], 0.02, '#fff6c0', 0, false);
  }
  for (const sx of [-1, 1]) {
    m.box([sx * 0.07, 0.23, 0.351], [0.04, 0.03, 0.02], 0.012, NOSE, 0, false); // nostrils
    m.box([sx * 0.12, 0.47, 0.1], [0.17, 0.19, 0.1], 0.07, '#ffe23a');              // big yellow eyes
    m.box([sx * 0.11, 0.46, 0.152], [0.08, 0.1, 0.02], 0.03, '#7a2e14', 0, false);
    m.box([sx * 0.11 - 0.02, 0.49, 0.164], [0.03, 0.03, 0.01], 0.01, '#ffffff', 0, false);
    m.box([sx * 0.13, 0.6, 0.1], [0.14, 0.035, 0.05], 0.015, '#2e1a14', 0, false);  // cheeky brows
  }
  m.box([0, 0.09, 0.352], [0.26, 0.035, 0.02], 0.012, '#3a1a2a', 0, false);       // grin
  m.box([0.03, 0.06, 0.4], [0.06, 0.02, 0.14], 0.01, '#f2637a', 8, false);        // flicking tongue
  return m.done({ wing: [0.24, 0.38], leg: [0, 0, 0], head: [0, 0], tail: [0.33] });
}
export function snakeSegModel(kind = 0) {
  const m = new ModelBuilder();
  const [SNAKE_GREEN, SNAKE_LIGHT, SNAKE_PURPLE] = SNAKE_COLORS[kind] || SNAKE_COLORS[0];
  m.box([0, 0.2, 0], [0.42, 0.38, 0.42], 0.1, SNAKE_GREEN);
  m.box([0, 0.2, 0], [0.43, 0.13, 0.43], 0.06, SNAKE_PURPLE, 0, false);
  m.box([0.1, 0.391, 0.08], [0.08, 0.01, 0.06], 0.004, SNAKE_LIGHT, 0, false);   // clay speckles
  m.box([-0.09, 0.391, -0.1], [0.06, 0.01, 0.05], 0.004, SNAKE_LIGHT, 0, false);
  if (kind === 1) m.box([0, 0.02, 0], [0.36, 0.03, 0.36], 0.012, '#9be04a', 0, false); // drippy goo underneath
  return m.done(NO_RIG_SNAKE);
}
// A puddle of poison goo the poison snake leaves behind.
export function gooModel() {
  const m = new ModelBuilder();
  m.box([0, 0.02, 0], [0.9, 0.04, 0.75], 0.02, '#8fdc3a', 0, false);
  m.box([0.18, 0.035, 0.12], [0.36, 0.04, 0.3], 0.02, '#b6f25a', 0, false);
  m.box([-0.22, 0.04, -0.14], [0.14, 0.05, 0.14], 0.03, '#d4ff8a', 0, false);       // little bubbles
  m.box([0.05, 0.04, -0.22], [0.1, 0.045, 0.1], 0.025, '#d4ff8a', 0, false);
  return m.done(NO_RIG_SNAKE);
}
const NO_RIG_SNAKE = { wing: [0, 0], leg: [0, 0, 0], head: [0, 0], tail: [0] };
export const CONFETTI_COLORS = ['#ff5c7a', '#ffd23c', '#4cc25a', '#4aa8ff', '#b05cff'];
export function confettiModel(color) {
  return new ModelBuilder().box([0, 0, 0], [0.13, 0.13, 0.13], 0.03, color, 0, false).done(NO_RIG_SNAKE);
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

// ---- grown-ups and their gifts ----
// A plump hen: what a chick grows up into. Same parts as the chick so it flaps and hops the same way.
export function henModel() {
  const m = new ModelBuilder();
  const white = '#fbf7ee', cream = '#efe4cf', red = '#e8443a', orange = '#ff8a2a';
  m.box([0, 0.32, -0.04], [0.44, 0.38, 0.54], 0.15, white);
  m.box([0, 0.34, 0.17], [0.38, 0.34, 0.22], 0.13, white);                         // round breast
  m.box([0, 0.58, 0.19], [0.26, 0.27, 0.25], 0.1, white);                          // head
  for (const [z, h] of [[0.12, 0.08], [0.19, 0.11], [0.26, 0.08]]) m.box([0, 0.73 + h / 2, z], [0.06, h, 0.07], 0.025, red, 0, false); // comb
  m.box([0, 0.46, 0.33], [0.06, 0.09, 0.04], 0.02, red, 0, false);                 // wattle
  m.box([0, 0.555, 0.335], [0.09, 0.055, 0.08], 0.025, orange, 0, false);          // beak
  for (const sx of [-1, 1]) {
    m.box([sx * 0.075, 0.62, 0.312], [0.06, 0.07, 0.02], 0.02, '#1c1a1a', 0, false);
    m.box([sx * 0.075 - 0.012, 0.635, 0.323], [0.02, 0.02, 0.01], 0.008, '#ffffff', 0, false);
    m.box([sx * 0.11, 0.55, 0.3], [0.05, 0.03, 0.01], 0.012, '#ffb0a8', 0, false);   // cheeks
  }
  m.box([0, 0.5, -0.3], [0.24, 0.24, 0.12], 0.06, cream, 8);                       // tail feathers
  m.box([0, 0.62, -0.33], [0.16, 0.18, 0.09], 0.05, white, 8);
  m.box([0.24, 0.32, -0.05], [0.06, 0.2, 0.3], 0.03, cream, 1, false);
  m.box([-0.24, 0.32, -0.05], [0.06, 0.2, 0.3], 0.03, cream, 2, false);
  for (const sx of [-1, 1]) {
    m.box([sx * 0.09, 0.08, 0.02], [0.04, 0.12, 0.04], 0.015, orange, 3, false);
    m.box([sx * 0.09, 0.015, 0.06], [0.09, 0.03, 0.13], 0.012, orange, 3, false);
  }
  return m.done({ wing: [0.22, 0.4], leg: [0, 0, 0], head: [0, 0], tail: [-0.28] });
}
export function eggModel() {
  const m = new ModelBuilder();
  m.box([0, 0.075, 0], [0.12, 0.15, 0.12], 0.055, '#f6ead2');
  m.box([-0.025, 0.11, 0.045], [0.03, 0.04, 0.02], 0.01, '#fffaf0', 0, false);
  return m.done(NO_RIG);
}
export function milkModel() {
  const m = new ModelBuilder();
  m.box([0, 0.1, 0], [0.13, 0.2, 0.13], 0.045, '#fbfbf7');
  m.box([0, 0.1, 0], [0.135, 0.06, 0.135], 0.02, '#4aa8ff', 0, false);              // label
  m.box([0, 0.225, 0], [0.075, 0.05, 0.075], 0.02, '#4aa8ff', 0, false);            // cap
  return m.done(NO_RIG);
}
export function woolTuftModel() {
  const m = new ModelBuilder();
  for (const [x, y, z, s] of [[0, 0.08, 0, 0.17], [0.07, 0.07, 0.05, 0.12], [-0.07, 0.07, -0.04, 0.12], [0.02, 0.15, -0.02, 0.11]])
    m.box([x, y, z], [s, s * 0.9, s], s * 0.45, '#fbf6ec');
  return m.done(NO_RIG);
}

// A short log a working grown-up brings you: bark round the outside, pale cut ends.
export function logChunkModel() {
  const m = new ModelBuilder();
  m.box([0, 0.09, 0], [0.32, 0.18, 0.18], 0.06, '#8a5a32');
  for (const s of [-1, 1]) m.box([s * 0.158, 0.09, 0], [0.012, 0.145, 0.145], 0.005, '#e6c890');
  m.box([0.04, 0.18, 0.03], [0.1, 0.012, 0.05], 0.005, '#6e4526');
  return m.done(NO_RIG);
}

// A knobbly lump of cobble.
export function stoneChunkModel() {
  const m = new ModelBuilder();
  m.box([0, 0.08, 0], [0.26, 0.16, 0.22], 0.06, '#8f9096');
  m.box([0.05, 0.16, -0.03], [0.14, 0.08, 0.12], 0.035, '#aeafb5');
  m.box([-0.07, 0.12, 0.06], [0.09, 0.07, 0.08], 0.03, '#77787e');
  return m.done(NO_RIG);
}

// A falling rain streak.
export function rainModel() {
  return new ModelBuilder().box([0, 0, 0], [0.035, 0.42, 0.035], 0.012, '#bfe0ff', 0, false).done(NO_RIG);
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
    } else if (kind === 'sticks') {
      for (const [x, a] of [[24, -0.35], [34, 0.1], [42, 0.45]]) {
        g.save(); g.translate(x, 34); g.rotate(a);
        rr(g, -3.5, -22, 7, 44, 3, '#8a5a30'); rr(g, -2, -21, 3, 42, 1.5, '#b07a45');
        g.restore();
      }
    } else if (kind === 'fence') {
      for (const x of [10, 44]) { rr(g, x, 8, 11, 50, 3, '#8f5f34'); rr(g, x + 2, 9, 5, 48, 2, '#c08850'); }
      for (const y of [20, 38]) { rr(g, 6, y, 52, 8, 3, '#9a6a3c'); rr(g, 7, y + 1, 50, 3, 1.5, '#c99558'); }
    } else if (kind === 'table') {
      rr(g, 6, 18, 52, 12, 4, '#c08850'); rr(g, 8, 19, 48, 4, 2, '#dcae74');           // worktop
      for (const x of [10, 44]) rr(g, x, 28, 10, 30, 3, '#8f5f34');
      rr(g, 12, 44, 40, 5, 2, '#9a6a3c');                                              // shelf
      rr(g, 14, 10, 18, 8, 2, '#b8bcc4'); rr(g, 30, 11, 6, 6, 2, '#7e5230');           // little saw
      rr(g, 38, 12, 16, 6, 2, '#e8c890');
    } else if (kind.startsWith('flower')) {
      const [petal, mid] = { 'flower-red': ['#e8443a', '#ffd23c'], 'flower-yellow': ['#ffd23c', '#8a5a30'], 'flower-white': ['#f7f5ef', '#ffd23c'] }[kind];
      rr(g, 29, 26, 6, 34, 3, '#3a9a46');
      rr(g, 35, 40, 14, 6, 3, '#4cc25a'); rr(g, 15, 46, 14, 6, 3, '#4cc25a');
      for (const [x, y] of [[18, 14], [36, 14], [27, 4], [27, 24]]) rr(g, x, y, 14, 14, 6, petal);
      rr(g, 25, 12, 14, 14, 5, mid);
    } else if (kind === 'ladder') {
      for (const x of [14, 42]) rr(g, x, 4, 8, 56, 3, '#8f5f34');
      for (const y of [12, 26, 40, 52]) rr(g, 20, y, 24, 6, 2, '#c08850');
    } else if (kind === 'feeder') {
      rr(g, 6, 28, 52, 24, 5, '#9a6a3c'); rr(g, 10, 24, 44, 10, 4, '#f2c35a');         // wooden trough of treats
      for (const [x, y, c] of [[16, 24, '#e8443a'], [28, 22, '#4cc25a'], [40, 24, '#f4efe3'], [22, 26, '#e9c27b']]) rr(g, x, y, 8, 7, 3, c);
      rr(g, 6, 34, 52, 4, 2, '#c08850');
      for (const x of [10, 46]) rr(g, x, 50, 8, 8, 2, '#7e5230');
    } else if (kind === 'gate') {
      for (const x of [4, 50]) rr(g, x, 6, 10, 52, 3, '#7e5230');
      for (const y of [14, 28, 42]) rr(g, 13, y, 38, 8, 3, '#b07a45');
      g.save(); g.translate(32, 32); g.rotate(-0.62); rr(g, -24, -3.5, 48, 7, 3, '#9a6a3c'); g.restore();
      rr(g, 47, 30, 5, 6, 2, '#3a3a3c');
    } else if (kind === 'sword') {
      // wooden toy sword
      g.translate(32, 32); g.rotate(Math.PI / 4);
      rr(g, -6, -28, 12, 38, 5, '#8f5a2e');
      rr(g, -4.5, -27, 9, 35, 4, '#e8c890');
      rr(g, -1, -24, 2, 28, 1, '#d2a76a');
      rr(g, -14, 9, 28, 7, 3, '#b5763a');
      rr(g, -4, 15, 8, 12, 3, '#7a4a28');
      g.fillStyle = '#e04a3c'; g.beginPath(); g.arc(0, 29, 4.5, 0, Math.PI * 2); g.fill();
    } else if (kind === 'planter') {
      for (const x of [16, 26, 36, 46]) {                                               // golden wheat
        rr(g, x, 10, 3, 26, 1.5, '#d9a53e');
        rr(g, x - 2.5, 4, 8, 12, 3, '#f2c35a');
      }
      rr(g, 6, 32, 52, 26, 4, '#9a6a3c'); rr(g, 9, 30, 46, 8, 3, '#7a4a2e');           // box and soil
      rr(g, 6, 40, 52, 4, 2, '#c08850'); rr(g, 6, 50, 52, 4, 2, '#c08850');
    } else if (kind === 'door') {
      rr(g, 14, 2, 36, 60, 4, '#8f5f34'); rr(g, 17, 5, 30, 55, 3, '#d8924e');
      for (const x of [26, 36]) rr(g, x, 5, 2, 55, 1, '#b8743c');                       // plank lines
      rr(g, 20, 9, 24, 16, 3, '#8f5f34'); rr(g, 22, 11, 20, 12, 2, '#cfeefa');         // window
      rr(g, 31, 11, 2, 12, 1, '#8f5f34');
      rr(g, 17, 32, 30, 5, 2, '#b8743c'); rr(g, 17, 50, 30, 5, 2, '#b8743c');          // braces
      g.fillStyle = '#ffcf3a'; g.beginPath(); g.arc(41, 40, 3.5, 0, Math.PI * 2); g.fill();
    } else if (kind === 'house kit') {
      g.fillStyle = '#e2443a'; g.beginPath(); g.moveTo(4, 30); g.lineTo(32, 6); g.lineTo(60, 30); g.closePath(); g.fill(); // roof
      g.fillStyle = '#f26a5a'; g.beginPath(); g.moveTo(12, 28); g.lineTo(32, 11); g.lineTo(52, 28); g.closePath(); g.fill();
      rr(g, 10, 28, 44, 32, 2, '#f4e4c4');                                             // cream walls
      rr(g, 10, 28, 5, 32, 1, '#9a6238'); rr(g, 49, 28, 5, 32, 1, '#9a6238');          // log corners
      rr(g, 27, 38, 11, 22, 2, '#c08850'); g.fillStyle = '#ffcf3a'; g.beginPath(); g.arc(35, 50, 1.6, 0, Math.PI * 2); g.fill();
      rr(g, 16, 36, 8, 8, 1, '#8f5f34'); rr(g, 17, 37, 6, 6, 1, '#cfeefa');            // windows
      rr(g, 41, 36, 8, 8, 1, '#8f5f34'); rr(g, 42, 37, 6, 6, 1, '#cfeefa');
      rr(g, 42, 10, 6, 12, 1, '#a3acb6');                                              // chimney
    } else if (kind === 'egg') {
      g.fillStyle = '#f6ead2'; g.beginPath(); g.ellipse(32, 35, 17, 22, 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#e3d2b2'; g.beginPath(); g.ellipse(36, 42, 11, 13, 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#f6ead2'; g.beginPath(); g.ellipse(31, 33, 14, 19, 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#fffaf0'; g.beginPath(); g.ellipse(25, 24, 4, 6, -0.4, 0, Math.PI * 2); g.fill();
    } else if (kind === 'milk') {
      rr(g, 16, 20, 32, 40, 9, '#e9eef2'); rr(g, 18, 21, 28, 37, 8, '#fbfbf7');
      rr(g, 23, 6, 18, 16, 4, '#fbfbf7'); rr(g, 22, 4, 20, 7, 3, '#4aa8ff');           // neck and cap
      rr(g, 16, 34, 32, 12, 3, '#4aa8ff');
      g.fillStyle = '#ffffff'; g.beginPath(); g.arc(32, 40, 4, 0, Math.PI * 2); g.fill();
      rr(g, 21, 24, 4, 8, 2, '#ffffff');
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

// ---- the kids: Lachie and Charli, the two players from the video (the cute chibi look) ----
// Parts: 4/5 legs swing from the hip, 6/7 arms swing from the shoulder (opposite the leg on the same side),
// 10 is the big round head, which tilts with where the player is looking.
const SKIN = '#f3c9a6', SKIN_DARK = '#e8ae8c', HAIR = '#1b1818', SOCK = '#f6f4ef';
const HIP = 0.46, SHOULDER = 0.78, NECK = 0.8;

// ---- clothes: what each kid can wear (the wardrobe) ----
export const CLOTH_COLORS = ['#d83a2c', '#f08a3c', '#f2c94c', '#5fae4e', '#7fd0c0', '#4a8fe0', '#2c3e74', '#9b7fd8', '#f28bb3', '#cfa978', '#f1efe8', '#2a2a2e'];
export const CLOTH_COLOR_NAMES = ['Red', 'Orange', 'Yellow', 'Green', 'Mint', 'Blue', 'Navy', 'Purple', 'Pink', 'Sand', 'White', 'Black'];
export const TOPS = ['T-shirt', 'Stripes', 'Hoodie', 'Dress', 'Chick jumper', 'Hero cape'];
export const BOTTOMS = ['Shorts', 'Trousers', 'Skirt', 'Dungarees', 'Tutu'];
export const HATS = ['No hat', 'Cap', 'Beanie', 'Bow', 'Flower', 'Chick hat', 'Party hat', 'Bunny ears', 'Flower crown'];
// Hats that bring their own colours (no colour to pick).
export const HAT_FIXED_COLOUR = new Set([5, 8]);
// An outfit is 8 small numbers: [top, top colour, bottoms, bottoms colour, hat, hat colour, shoe colour, bag (0/1)].
export const DEFAULT_FIT = { lachie: [0, 0, 0, 9, 0, 5, 10, 1], charli: [0, 4, 0, 9, 0, 8, 10, 1] };
const FIT_LIMITS = [TOPS.length, CLOTH_COLORS.length, BOTTOMS.length, CLOTH_COLORS.length, HATS.length, CLOTH_COLORS.length, CLOTH_COLORS.length, 2];
// Any outfit from a save or another player, made safe (bad or missing parts fall back to the default).
export function cleanFit(f, char) {
  const d = DEFAULT_FIT[char] || DEFAULT_FIT.lachie;
  return d.map((v, i) => Array.isArray(f) && Number.isInteger(f[i]) && f[i] >= 0 && f[i] < FIT_LIMITS[i] ? f[i] : v);
}
const shade = (c, k) => '#' + [1, 3, 5].map(i => Math.round(Math.min(255, parseInt(c.slice(i, i + 2), 16) * k)).toString(16).padStart(2, '0')).join('');

function kidBody(m, fit) {
  const legX = 0.085, legW = 0.14, armX = 0.215, armW = 0.1, chest = 0.34, chestD = 0.26;
  const [top, tc, bot, bc, , , sc] = fit;
  const shirt = CLOTH_COLORS[tc], sleeve = shade(shirt, 0.95), pants = CLOTH_COLORS[bc], shoe = CLOTH_COLORS[sc];
  const dress = top === 3, hoodie = top === 2, jumper = top === 4, cape = top === 5;
  const dungarees = bot === 3 && !dress, tutu = bot === 4 && !dress;
  const trousers = (bot === 1 || dungarees) && !dress, skirt = (bot === 2 || tutu) && !dress, longSleeve = hoodie || jumper;
  const tee = cape ? '#f6f4ef' : shirt; // under a cape you wear a plain white T-shirt
  const stripe = tc === 10 ? CLOTH_COLORS[6] : '#f6f4ef';
  for (const [sx, part] of [[1, 4], [-1, 5]]) {
    const x = sx * legX;
    m.box([x, 0.05, 0.03], [legW + 0.035, 0.1, legW + 0.11], 0.045, shoe, part, false);          // chunky sneakers
    m.box([x, 0.095, 0.1], [legW + 0.04, 0.02, 0.03], 0.008, shade(shoe, 0.8), part, false);      // toe stripe
    if (trousers) {
      m.box([x, (0.12 + HIP + 0.03) / 2, 0], [legW + 0.03, HIP + 0.03 - 0.12, legW + 0.03], 0.04, pants, part, false);
      m.box([x, 0.135, 0], [legW + 0.04, 0.04, legW + 0.04], 0.02, shade(pants, 0.85), part, false); // turn-ups
      continue;
    }
    m.box([x, 0.135, 0], [legW + 0.01, 0.08, legW + 0.01], 0.03, SOCK, part, false);              // socks
    m.box([x, 0.27, 0], [legW, 0.2, legW], 0.03, SKIN, part, false);
    if (!dress && !skirt) m.box([x, HIP - 0.07, 0], [legW + 0.035, 0.16, legW + 0.035], 0.04, pants, part, false); // shorts legs
  }
  m.box([0, HIP + 0.02, 0], [legX * 2 + legW + 0.035, 0.1, chestD], 0.04, dress ? shirt : pants);
  if (tutu) {                                                                                      // a puffy, sticking-out tutu
    m.box([0, HIP - 0.03, 0], [0.54, 0.09, chestD + 0.22], 0.045, pants);
    m.box([0, HIP - 0.09, 0], [0.48, 0.06, chestD + 0.16], 0.03, shade(pants, 1.12));
  } else if (skirt) m.box([0, HIP - 0.06, 0], [0.42, 0.2, chestD + 0.1], 0.06, pants);            // flared skirt
  if (dress) {
    m.box([0, HIP - 0.07, 0], [0.45, 0.24, chestD + 0.12], 0.07, shirt);                           // full skirt of the dress
    m.box([0, HIP - 0.18, 0], [0.46, 0.03, chestD + 0.13], 0.012, '#f6f4ef', 0, false);            // white hem
  }
  m.box([0, (HIP + 0.05 + NECK) / 2, 0], [chest, NECK - HIP - 0.05, chestD], 0.07, tee);
  if (jumper) {
    // knitted chick jumper: ribbed hem, a chick face on the front and little wings
    m.box([0, HIP + 0.08, 0], [chest + 0.014, 0.05, chestD + 0.014], 0.02, shade(shirt, 0.88), 0, false);
    for (const sx of [-1, 1]) m.box([sx * 0.065, 0.7, chestD / 2 + 0.006], [0.04, 0.045, 0.01], 0.015, '#2a1e1a', 0, false);
    m.box([0, 0.645, chestD / 2 + 0.01], [0.07, 0.04, 0.02], 0.012, '#f08a3c', 0, false);
    for (const sx of [-1, 1]) m.box([sx * 0.12, 0.58, chestD / 2 + 0.004], [0.06, 0.1, 0.01], 0.02, shade(shirt, 0.86), 0, false);
  }
  if (cape) {
    // a hero cape from the shoulders to the knees, with gold clasps
    m.box([0, (0.3 + NECK) / 2, -chestD / 2 - 0.03], [0.38, NECK - 0.3, 0.025], 0.012, shirt, 0, false);
    m.box([0, 0.33, -chestD / 2 - 0.05], [0.44, 0.1, 0.025], 0.012, shade(shirt, 0.9), 0, false);
    for (const sx of [-1, 1]) m.box([sx * 0.13, NECK - 0.03, chestD / 2 + 0.01], [0.05, 0.05, 0.02], 0.015, '#f2c94c', 0, false);
    m.box([0, NECK - 0.01, -chestD / 2 - 0.02], [0.36, 0.05, 0.05], 0.02, shirt, 0, false);
  }
  if (dungarees) {
    // bib and straps, with yellow buttons
    const bibTop = 0.7;
    m.box([0, (HIP + bibTop) / 2, chestD / 2 + 0.008], [0.24, bibTop - HIP, 0.02], 0.012, pants, 0, false);
    m.box([0, 0.6, chestD / 2 + 0.02], [0.1, 0.06, 0.01], 0.008, shade(pants, 0.85), 0, false);      // pocket
    for (const sx of [-1, 1]) {
      m.box([sx * 0.095, (bibTop + NECK) / 2 + 0.01, chestD / 2 + 0.01], [0.045, NECK - bibTop + 0.04, 0.015], 0.008, pants, 0, false);
      m.box([sx * 0.095, (HIP + NECK) / 2 + 0.06, -chestD / 2 - 0.01], [0.045, NECK - HIP - 0.08, 0.015], 0.008, pants, 0, false);
      m.box([sx * 0.095, bibTop - 0.005, chestD / 2 + 0.022], [0.03, 0.03, 0.01], 0.012, '#f2c94c', 0, false);
    }
  }
  if (top === 1) for (const y of [0.56, 0.65, 0.74]) m.box([0, y, 0], [chest + 0.014, 0.035, chestD + 0.014], 0.02, stripe, 0, false);
  if (hoodie) {
    m.box([0, NECK - 0.03, -chestD / 2 - 0.03], [0.3, 0.16, 0.1], 0.05, sleeve, 0, false);          // hood down at the back
    m.box([0, 0.57, chestD / 2 + 0.01], [0.22, 0.09, 0.02], 0.02, sleeve, 0, false);               // front pocket
    for (const sx of [-1, 1]) m.box([sx * 0.05, 0.72, chestD / 2 + 0.012], [0.015, 0.1, 0.01], 0.005, '#f6f4ef', 0, false); // cords
  }
  for (const [sx, part] of [[1, 6], [-1, 7]]) {
    const x = sx * armX;
    m.box([x, SHOULDER - 0.06, 0], [armW + 0.04, 0.13, armW + 0.04], 0.05, cape ? tee : sleeve, part, false);  // puffy sleeves
    if (top === 1) m.box([x, SHOULDER - 0.07, 0], [armW + 0.05, 0.03, armW + 0.05], 0.012, stripe, part, false);
    m.box([x, 0.56, 0], [armW + (longSleeve ? 0.02 : 0), 0.16, armW + (longSleeve ? 0.02 : 0)], 0.035, longSleeve ? sleeve : SKIN, part, false);
    if (jumper) m.box([x, 0.495, 0], [armW + 0.03, 0.035, armW + 0.03], 0.015, shade(shirt, 0.88), part, false); // ribbed cuffs
    m.box([x, 0.47, 0.01], [armW + 0.015, 0.08, armW + 0.02], 0.04, SKIN, part, false);           // little hands
  }
  return chestD;
}
// Big round head: huge shiny eyes, rosy cheeks and an open happy smile.
function kidHead(m, w, h, d, girl) {
  const H = 10, y0 = NECK, zf = d / 2, cy = y0 + h * 0.42;
  m.box([0, y0 + h / 2, 0], [w, h, d], 0.2, SKIN, H);
  for (const sx of [-1, 1]) {
    m.box([sx * (w / 2 + 0.02), cy, -0.02], [0.07, 0.12, 0.09], 0.035, SKIN, H, false);          // ears
    if (girl) m.box([sx * (w / 2 + 0.03), cy - 0.08, 0], [0.03, 0.03, 0.03], 0.012, '#8d8f96', H, false); // stud earrings
    const ex = sx * w * 0.22, ey = cy + 0.03;
    m.box([ex, ey, zf + 0.004], [0.14, 0.15, 0.02], 0.06, '#ffffff', H, false);                  // whites
    m.box([ex, ey - 0.005, zf + 0.014], [0.12, 0.135, 0.02], 0.055, '#3a1f14', H, false);         // big brown eyes
    m.box([ex, ey - 0.01, zf + 0.022], [0.065, 0.075, 0.01], 0.03, '#140c08', H, false);
    m.box([ex - 0.025, ey + 0.03, zf + 0.03], [0.035, 0.035, 0.01], 0.015, '#ffffff', H, false);  // catchlights
    m.box([ex + 0.03, ey - 0.035, zf + 0.03], [0.016, 0.016, 0.01], 0.007, '#ffffff', H, false);
    if (girl) m.box([ex + sx * 0.065, ey + 0.05, zf + 0.012], [0.04, 0.02, 0.01], 0.008, HAIR, H, false); // lashes
    m.box([ex, ey + 0.115, zf + 0.008], [0.11, 0.028, 0.02], 0.012, HAIR, H, false);              // brows
    m.box([sx * w * 0.33, cy - 0.08, zf + 0.002], [0.1, 0.06, 0.01], 0.028, '#f6a3a0', H, false); // rosy cheeks
  }
  m.box([0, cy - 0.05, zf + 0.02], [0.05, 0.04, 0.04], 0.02, SKIN_DARK, H, false);               // button nose
  m.box([0, cy - 0.14, zf + 0.004], [0.13, 0.07, 0.02], 0.03, '#a8323a', H, false);               // open smile
  m.box([0, cy - 0.12, zf + 0.012], [0.1, 0.022, 0.01], 0.01, '#ffffff', H, false);               // teeth
  m.box([0, cy - 0.155, zf + 0.012], [0.07, 0.025, 0.01], 0.012, '#f07a80', H, false);           // tongue
  return { y0, top: y0 + h };
}
// A hat on top of the head (part 10, so it nods along).
function kidHat(m, fit, w, h, d, top) {
  const H = 10, c = CLOTH_COLORS[fit[5]];
  if (fit[4] === 1) {                                                                              // cap
    m.box([0, top + 0.04, -0.01], [w + 0.08, 0.2, d + 0.08], 0.09, c, H);
    m.box([0, top - 0.04, d / 2 + 0.1], [w * 0.75, 0.035, 0.24], 0.015, c, H, false);              // peak
    m.box([0, top + 0.14, 0], [0.06, 0.03, 0.06], 0.015, shade(c, 0.85), H, false);
  } else if (fit[4] === 2) {                                                                       // woolly beanie with a pompom
    m.box([0, top + 0.03, -0.01], [w + 0.1, 0.26, d + 0.1], 0.12, c, H);
    m.box([0, top - 0.08, -0.01], [w + 0.12, 0.08, d + 0.12], 0.04, shade(c, 0.85), H, false);
    m.box([0, top + 0.19, 0], [0.13, 0.13, 0.13], 0.065, '#f6f4ef', H, false);
  } else if (fit[4] === 3) {                                                                       // big bow
    const x = 0.17, y = top + 0.04, z = 0.04;
    m.box([x, y, z], [0.07, 0.08, 0.07], 0.03, shade(c, 0.85), H, false);
    for (const sx of [-1, 1]) m.box([x + sx * 0.1, y + 0.01, z], [0.13, 0.13, 0.06], 0.05, c, H, false);
  } else if (fit[4] === 4) {                                                                       // a flower behind the ear
    const x = w / 2 - 0.02, y = top - 0.08, z = 0.14, mid = fit[5] === 2 ? '#f08a3c' : '#ffd23c';
    for (const [dy, dz] of [[0.06, 0], [-0.06, 0], [0, 0.06], [0, -0.06]]) m.box([x + 0.02, y + dy, z + dz], [0.05, 0.08, 0.08], 0.035, c, H, false);
    m.box([x + 0.04, y, z], [0.05, 0.06, 0.06], 0.025, mid, H, false);
  } else if (fit[4] === 5) {                                                                       // a little chick sitting on your head
    const Y = '#ffd84a', y = top + 0.04;
    m.box([0, y + 0.1, -0.02], [0.26, 0.2, 0.26], 0.1, Y, H);
    m.box([0, y + 0.25, 0.05], [0.17, 0.16, 0.16], 0.075, Y, H);
    m.box([0, y + 0.24, 0.145], [0.06, 0.04, 0.05], 0.015, '#f08a3c', H, false);
    for (const sx of [-1, 1]) {
      m.box([sx * 0.045, y + 0.28, 0.13], [0.03, 0.035, 0.01], 0.012, '#2a1e1a', H, false);
      m.box([sx * 0.135, y + 0.1, -0.02], [0.04, 0.1, 0.13], 0.03, '#f2c43a', H, false);
    }
    m.box([0, y + 0.35, 0.04], [0.03, 0.05, 0.03], 0.012, Y, H, false);                           // tuft
  } else if (fit[4] === 6) {                                                                       // stripy party hat with a pompom
    for (let k = 0; k < 6; k++) {
      const s = 0.3 - k * 0.048;
      m.box([0.03, top + 0.08 + k * 0.065, 0], [s, 0.07, s], Math.min(0.03, s * 0.3), k % 2 ? '#f6f4ef' : c, H, false);
    }
    m.box([0.03, top + 0.5, 0], [0.1, 0.1, 0.1], 0.05, '#f2c94c', H, false);
  } else if (fit[4] === 7) {                                                                       // bunny ears on a headband
    m.box([0, top + 0.03, 0.02], [w + 0.05, 0.05, 0.09], 0.02, c, H, false);
    for (const sx of [-1, 1]) {
      m.box([sx * 0.12, top + 0.25, 0.02], [0.1, 0.36, 0.06], 0.045, '#f6f4ef', H, false);
      m.box([sx * 0.12, top + 0.25, 0.052], [0.055, 0.27, 0.01], 0.02, '#f6a3b8', H, false);
    }
  } else if (fit[4] === 8) {                                                                       // a crown of flowers and leaves
    const cols = ['#e8473a', '#ffd23c', '#f6f4ef', '#f28bb3'];
    for (let k = 0; k < 10; k++) {
      const a = k / 10 * Math.PI * 2, x = Math.sin(a) * (w / 2 + 0.01), z = Math.cos(a) * (d / 2 + 0.01), y = top - 0.02;
      if (k % 2) { m.box([x, y, z], [0.07, 0.04, 0.07], 0.02, '#5fae4e', H, false); continue; }
      m.box([x, y + 0.01, z], [0.1, 0.07, 0.1], 0.035, cols[(k / 2) % 4], H, false);
      m.box([x, y + 0.05, z], [0.04, 0.03, 0.04], 0.012, '#f08a3c', H, false);
    }
  }
}
// A kid in an outfit. char picks the face and hair (Lachie or Charli); fit is what they're wearing.
export function kidModel(char, fit) {
  const m = new ModelBuilder(), H = 10;
  fit = cleanFit(fit, char);
  const chestD = kidBody(m, fit);
  if (char === 'charli') {
    if (fit[0] === 0) m.box([0, NECK - 0.02, 0], [0.32, 0.06, chestD + 0.02], 0.03, '#d9466e', 0, false); // pink collar
    if (fit[7]) {                                                                                  // little black bag on a thin strap
      for (let k = 0; k < 7; k++) m.box([0.12 - k * 0.04, 0.76 - k * 0.04, chestD / 2 + 0.008], [0.03, 0.04, 0.014], 0.006, '#26252a', 0, false);
      m.box([-0.17, 0.5, chestD / 2 + 0.02], [0.1, 0.12, 0.07], 0.03, '#2a292e', 0, false);
      m.box([-0.17, 0.52, chestD / 2 + 0.058], [0.02, 0.025, 0.01], 0.006, '#9a9aa0', 0, false);
    }
    // round head with smooth hair, a middle part, side strands and a ponytail
    const w = 0.6, h = 0.62, d = 0.56, { y0, top } = kidHead(m, w, h, d, true);
    m.box([0, top - 0.02, -0.02], [w + 0.05, 0.13, d + 0.05], 0.07, HAIR, H);
    m.box([0, y0 + h * 0.55, -d / 2 - 0.02], [w + 0.05, h * 0.9, 0.08], 0.06, HAIR, H, false);
    for (const sx of [-1, 1]) {
      m.box([sx * (w / 2 + 0.018), y0 + h * 0.6, -0.04], [0.05, h * 0.7, d - 0.08], 0.03, HAIR, H, false);
      m.box([sx * 0.15, top - 0.08, d / 2 + 0.015], [0.27, 0.1, 0.05], 0.045, HAIR, H, false);          // swept either side of the part
      m.box([sx * (w / 2 - 0.03), y0 + h * 0.62, d / 2 + 0.01], [0.06, h * 0.42, 0.04], 0.025, HAIR, H, false); // framing strands
    }
    m.box([-0.12, y0 + h * 0.35, -d / 2 - 0.08], [0.1, 0.1, 0.08], 0.04, '#2b2626', H, false);       // hair tie
    m.box([-0.14, y0 + h * 0.05, -d / 2 - 0.07], [0.12, 0.34, 0.1], 0.05, HAIR, H, false);           // ponytail
    kidHat(m, fit, w, h, d, top);
  } else {
    if (fit[7]) {                                                                                  // black bum bag slung across the chest
      for (let k = 0; k < 6; k++) m.box([-0.13 + k * 0.05, 0.77 - k * 0.045, chestD / 2 + 0.008], [0.06, 0.035, 0.016], 0.008, '#1f1f22', 0, false);
      m.box([0.05, 0.56, chestD / 2 + 0.04], [0.21, 0.1, 0.08], 0.045, '#2f3034', 0, false);
      m.box([0.05, 0.58, chestD / 2 + 0.082], [0.17, 0.012, 0.01], 0.004, '#c8c8c8', 0, false);      // zip
    }
    // round head with spiky black hair on top and a choppy fringe
    const w = 0.62, h = 0.6, d = 0.56, { y0, top } = kidHead(m, w, h, d, false);
    m.box([0, top - 0.02, -0.02], [w + 0.06, 0.16, d + 0.06], 0.08, HAIR, H);
    m.box([0, y0 + h * 0.58, -d / 2 - 0.02], [w + 0.05, h * 0.8, 0.08], 0.06, HAIR, H, false);
    for (const sx of [-1, 1]) m.box([sx * (w / 2 + 0.02), y0 + h * 0.74, -0.06], [0.06, h * 0.42, d - 0.1], 0.03, HAIR, H, false);
    for (let k = 0; k < 5; k++) {                                                                   // fringe points
      const x = -0.24 + k * 0.12;
      m.box([x, top - 0.11 - (k % 2) * 0.03, d / 2 + 0.02], [0.13, 0.1 + (k % 2) * 0.04, 0.06], 0.04, HAIR, H, false);
    }
    if (![1, 2, 5, 6].includes(fit[4])) for (const [x, z, s] of [[-0.18, 0.12, 0.1], [0.02, 0.18, 0.12], [0.2, 0.08, 0.1], [-0.08, -0.08, 0.12], [0.14, -0.16, 0.1], [-0.22, -0.18, 0.09]])
      m.box([x, top + 0.07, z], [s, 0.1, s], 0.04, HAIR, H, false);                                  // spikes (tucked under a cap or beanie)
    kidHat(m, fit, w, h, d, top);
  }
  return m.done({ wing: [0, 0], leg: [HIP, 0, 0], head: [NECK, 0], tail: [0], arm: SHOULDER - 0.02 });
}
export const lachieModel = () => kidModel('lachie');
export const charliModel = () => kidModel('charli');
// Little faces for the character choice buttons.
const FACE_EYES = '<circle cx="11" cy="19" r="3.4" fill="#2a160e"/><circle cx="21" cy="19" r="3.4" fill="#2a160e"/><circle cx="10" cy="17.8" r="1.1" fill="#fff"/><circle cx="20" cy="17.8" r="1.1" fill="#fff"/><ellipse cx="7.5" cy="23.5" rx="2.2" ry="1.3" fill="#f6a3a0"/><ellipse cx="24.5" cy="23.5" rx="2.2" ry="1.3" fill="#f6a3a0"/><path d="M13 25q3 3.5 6 0z" fill="#a8323a"/>';
export const KID_FACE_SVG = {
  lachie: '<rect x="3" y="6" width="26" height="24" rx="9" fill="#f3c9a6"/><path d="M2 15q-1-12 14-12t14 12l-3-2-2 3-3-3-3 3-3-3-3 3-3-3-2 3z" fill="#1b1818"/><path d="M8 4l2-3 2 3M15 3l2-3 2 3M22 4l2-2 1 3" fill="#1b1818"/>' + FACE_EYES,
  charli: '<rect x="1" y="12" width="5" height="15" rx="2" fill="#1b1818"/><rect x="3" y="6" width="26" height="24" rx="9" fill="#f3c9a6"/><path d="M3 17q-1-14 13-14t13 14q-2-8-13-10-11 2-13 10z" fill="#1b1818"/><circle cx="3.2" cy="24" r="1" fill="#8d8f96"/><circle cx="28.8" cy="24" r="1" fill="#8d8f96"/>' + FACE_EYES,
};

// ---- daytime raiders ----
// A sneaky orange fox with a white-tipped bushy tail. It's after your babies.
export function foxModel() {
  const m = new ModelBuilder();
  const orange = '#f07a2a', dark = '#c95a16', white = '#fff4e6', black = '#2a1e1a', H = 10;
  m.legs(0.1, 0.15, -0.17, [0.1, 0.24, 0.1], dark, black, 0.09);
  m.box([0, 0.36, -0.02], [0.32, 0.26, 0.54], 0.09, orange);
  m.box([0, 0.27, 0.1], [0.22, 0.1, 0.3], 0.04, white, 0, false);          // pale belly
  m.box([0, 0.36, 0.25], [0.22, 0.2, 0.08], 0.06, white);                  // chest fluff
  // head with a long pointy snout
  m.box([0, 0.6, 0.26], [0.38, 0.3, 0.3], 0.08, orange, H);
  m.box([0, 0.53, 0.46], [0.18, 0.14, 0.16], 0.05, white, H);
  m.box([0, 0.57, 0.545], [0.07, 0.06, 0.04], 0.02, black, H, false);      // nose
  for (const sx of [-1, 1]) {
    m.box([sx * 0.13, 0.55, 0.39], [0.12, 0.12, 0.04], 0.04, white, H, false); // cheeks
    m.box([sx * 0.12, 0.81, 0.22], [0.13, 0.16, 0.07], 0.03, orange, H, false); // tall ears
    m.box([sx * 0.12, 0.92, 0.22], [0.07, 0.08, 0.06], 0.025, black, H, false);
    m.box([sx * 0.12, 0.8, 0.256], [0.07, 0.1, 0.01], 0.01, white, H, false);
    m.box([sx * 0.1, 0.7, 0.405], [0.1, 0.03, 0.01], 0.01, black, H, false); // sly brows
  }
  m.eyes(0.095, 0.65, 0.41, 0.075, 0.07, H);
  // big bushy tail
  m.box([0, 0.42, -0.36], [0.16, 0.16, 0.22], 0.07, orange, 8);
  m.box([0, 0.47, -0.52], [0.2, 0.2, 0.2], 0.09, orange, 8);
  m.box([0, 0.5, -0.66], [0.15, 0.15, 0.12], 0.06, white, 8);
  return m.done({ wing: [0, 0], leg: [0.24, 0.15, -0.17], head: [0.5, 0.14], tail: [-0.3] });
}

// A cheeky black crow that swoops down to pinch treats.
export function crowModel() {
  const m = new ModelBuilder();
  const black = '#26262e', sheen = '#3a3f5c', beak = '#f2a33a';
  m.box([0, 0.3, 0], [0.3, 0.28, 0.42], 0.1, black);
  m.box([0, 0.46, 0.17], [0.26, 0.24, 0.24], 0.09, black);                 // head
  m.box([0, 0.43, 0.33], [0.09, 0.07, 0.14], 0.025, beak, 0, false);
  for (const sx of [-1, 1]) {
    m.box([sx * 0.085, 0.5, 0.29], [0.06, 0.065, 0.02], 0.02, '#ffffff', 0, false);
    m.box([sx * 0.085, 0.5, 0.302], [0.035, 0.04, 0.01], 0.012, '#111111', 0, false);
  }
  m.box([0, 0.3, -0.27], [0.18, 0.05, 0.2], 0.02, sheen, 8, false);        // tail feathers
  m.box([0.19, 0.33, -0.02], [0.3, 0.05, 0.3], 0.02, sheen, 1, false);     // wings stick out to the sides
  m.box([-0.19, 0.33, -0.02], [0.3, 0.05, 0.3], 0.02, sheen, 2, false);
  for (const sx of [-1, 1]) m.box([sx * 0.07, 0.07, 0.04], [0.04, 0.14, 0.04], 0.015, beak, 3, false);
  return m.done({ wing: [0.06, 0.34], leg: [0, 0, 0], head: [0, 0], tail: [-0.2] });
}

// ---- little visitors ----
// A butterfly: two pairs of wings (parts 1 and 2, so they flap) on a thin dark body.
const BUTTERFLY_COLOURS = [['#f2a03a', '#ffd27a', '#3a2a1a'], ['#7fb8f0', '#d8ecff', '#26324a'], ['#f28bb3', '#fff0f6', '#3a2030']];
export function butterflyModel(k) {
  const m = new ModelBuilder(), [wing, spot, body] = BUTTERFLY_COLOURS[k % BUTTERFLY_COLOURS.length];
  m.box([0, 0, 0], [0.03, 0.03, 0.17], 0.012, body, 0, false);
  for (const [sx, part] of [[1, 1], [-1, 2]]) {
    m.box([sx * 0.075, 0, 0.03], [0.13, 0.008, 0.12], 0.004, wing, part, false);
    m.box([sx * 0.06, 0, -0.06], [0.09, 0.008, 0.08], 0.004, wing, part, false);
    m.box([sx * 0.09, 0.006, 0.04], [0.04, 0.006, 0.04], 0.002, spot, part, false);
    m.box([sx * 0.02, 0.012, 0.11], [0.006, 0.006, 0.06], 0.002, body, 0, false); // feelers
  }
  return m.done({ wing: [0.012, 0], leg: [0, 0, 0], head: [0, 0], tail: [0] });
}
// A firefly: a dark little bug with a glowing tail (part 11 glows at night).
export function fireflyModel() {
  const m = new ModelBuilder();
  m.box([0, 0, 0.03], [0.04, 0.035, 0.06], 0.014, '#3a3222', 0, false);
  m.box([0, 0, -0.03], [0.06, 0.055, 0.065], 0.024, '#e4ff70', 11, false);
  for (const [sx, part] of [[1, 1], [-1, 2]]) m.box([sx * 0.035, 0.022, 0.01], [0.05, 0.006, 0.05], 0.003, '#c8d0e0', part, false);
  return m.done({ wing: [0.01, 0.02], leg: [0, 0, 0], head: [0, 0], tail: [0] });
}
