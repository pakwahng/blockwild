// Chunk mesher: turns block data into triangles. Blocks get soft rounded edges and
// corners wherever two or three visible faces meet, giving the clay-toy look.
import { B, BLOCKS, OPAQUE, KIND, SHAPED, JOINS } from './blocks.js';
import { CS, CH, index } from './world.js';

const PX = CS + 2, PA = PX * PX;
const pidx = (x, y, z) => (x + 1) + (z + 1) * PX + (y + 1) * PA;
const padded = new Uint8Array(PA * (CH + 2));

// Faces: +x -x +y -y +z -z. Corners wound counter-clockwise seen from outside.
const FACES = [
  { n: [1, 0, 0], c: [[1, 0, 0], [1, 1, 0], [1, 1, 1], [1, 0, 1]], shade: 0.8 },
  { n: [-1, 0, 0], c: [[0, 0, 1], [0, 1, 1], [0, 1, 0], [0, 0, 0]], shade: 0.8 },
  { n: [0, 1, 0], c: [[0, 1, 1], [1, 1, 1], [1, 1, 0], [0, 1, 0]], shade: 1.0 },
  { n: [0, -1, 0], c: [[0, 0, 0], [1, 0, 0], [1, 0, 1], [0, 0, 1]], shade: 0.55 },
  { n: [0, 0, 1], c: [[1, 0, 1], [1, 1, 1], [0, 1, 1], [0, 0, 1]], shade: 0.68 },
  { n: [0, 0, -1], c: [[0, 0, 0], [0, 1, 0], [1, 1, 0], [1, 0, 0]], shade: 0.68 },
];
const pd = (x, y, z) => x + z * PX + y * PA; // padded index delta
const AXIS_D = [1, PA, PX];                  // padded index step along x, y, z
for (const f of FACES) {
  const axis = f.n.findIndex(v => v !== 0);
  const [t1, t2] = [0, 1, 2].filter(a => a !== axis);
  f.nd = pd(f.n[0], f.n[1], f.n[2]);
  f.ao = f.c.map(c => {
    const s1 = [0, 0, 0], s2 = [0, 0, 0];
    s1[t1] = c[t1] ? 1 : -1; s2[t2] = c[t2] ? 1 : -1;
    const a = [f.n[0] + s1[0], f.n[1] + s1[1], f.n[2] + s1[2]];
    const b = [f.n[0] + s2[0], f.n[1] + s2[1], f.n[2] + s2[2]];
    const d = [f.n[0] + s1[0] + s2[0], f.n[1] + s1[1] + s2[1], f.n[2] + s1[2] + s2[2]];
    return [pd(...a), pd(...b), pd(...d)];
  });
}
const AO = [0.5, 0.68, 0.84, 1.0];
const SEG = 3; // segments per rounded edge

// Light for any normal, blended from the flat face shades (top 1, bottom .55, x .8, z .68).
const shadeN = (nx, ny, nz) => nx * nx * 0.8 + nz * nz * 0.68 + ny * ny * (ny > 0 ? 1.0 : 0.55);

// UV of a point (local block coords) projected onto face f's texture.
function faceUV(f, x, y, z) {
  switch (f) {
    case 0: return [1 - z, 1 - y];
    case 1: return [z, 1 - y];
    case 2: return [x, z];
    case 3: return [x, 1 - z];
    case 4: return [x, 1 - y];
    default: return [1 - x, 1 - y];
  }
}

// Arc directions from axis B to axis A, spaced like the corner caps so edges and corners meet without cracks.
const ARC = [];
for (let k = 0; k <= SEG; k++) { const l = Math.hypot(k, SEG - k); ARC.push([k / l, (SEG - k) / l]); }
const CAP = [];
for (let i = 0; i <= SEG; i++) for (let j = 0; j <= SEG - i; j++) {
  const l = Math.hypot(i, j, SEG - i - j);
  CAP.push([i / l, j / l, (SEG - i - j) / l]);
}
const capIndex = (i, j) => { let n = 0; for (let a = 0; a < i; a++) n += SEG - a + 1; return n + j; };

class MeshBuf {
  constructor() { this.v = new Float32Array(1 << 17); this.i = new Uint32Array(1 << 16); this.reset(); }
  reset() { this.vn = 0; this.in = 0; this.vc = 0; }
  reserve(nv, ni) {
    while (this.vn + nv * 7 > this.v.length) { const n = new Float32Array(this.v.length * 2); n.set(this.v); this.v = n; }
    while (this.in + ni > this.i.length) { const n = new Uint32Array(this.i.length * 2); n.set(this.i); this.i = n; }
  }
  vert(x, y, z, u, v, layer, shade) {
    const a = this.v; let o = this.vn;
    a[o++] = x; a[o++] = y; a[o++] = z; a[o++] = u; a[o++] = v; a[o++] = layer; a[o++] = shade;
    this.vn = o;
    return this.vc++;
  }
  // Adds a triangle wound counter-clockwise as seen from the direction (ox, oy, oz).
  tri(a, b, c, ox, oy, oz) {
    const v = this.v, A = a * 7, Bi = b * 7, C = c * 7;
    const e1x = v[Bi] - v[A], e1y = v[Bi + 1] - v[A + 1], e1z = v[Bi + 2] - v[A + 2];
    const e2x = v[C] - v[A], e2y = v[C + 1] - v[A + 1], e2z = v[C + 2] - v[A + 2];
    const nx = e1y * e2z - e1z * e2y, ny = e1z * e2x - e1x * e2z, nz = e1x * e2y - e1y * e2x;
    const I = this.i;
    I[this.in++] = a;
    if (nx * ox + ny * oy + nz * oz >= 0) { I[this.in++] = b; I[this.in++] = c; }
    else { I[this.in++] = c; I[this.in++] = b; }
  }
  out() { return { verts: this.v.slice(0, this.vn), idx: this.i.slice(0, this.in) }; }
}
const opaqueBuf = new MeshBuf(), liquidBuf = new MeshBuf();

export function buildMesh(world, chunk) {
  const { cx, cz } = chunk;
  for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) {
    const src = world.getChunk(cx + dx, cz + dz).data;
    const xs = dx === -1 ? CS - 1 : 0, xe = dx === 1 ? 0 : CS - 1;
    const zs = dz === -1 ? CS - 1 : 0, ze = dz === 1 ? 0 : CS - 1;
    for (let y = 0; y < CH; y++) for (let z = zs; z <= ze; z++) for (let x = xs; x <= xe; x++)
      padded[pidx(x + dx * CS, y, z + dz * CS)] = src[index(x, y, z)];
  }
  padded.fill(B.STONE, 0, PA);                      // below the world
  padded.fill(B.AIR, (CH + 1) * PA, (CH + 2) * PA); // above the world

  opaqueBuf.reset(); liquidBuf.reset();
  const ox = cx * CS, oz = cz * CS;
  const vis = [0, 0, 0, 0, 0, 0], lo = [0, 0, 0], hi = [0, 0, 0], pos = [0, 0, 0], n = [0, 0, 0];

  for (let y = 0; y < CH; y++) for (let z = 0; z < CS; z++) for (let x = 0; x < CS; x++) {
    const p = pidx(x, y, z);
    const id = padded[p];
    if (id === B.AIR) continue;
    if (SHAPED[id]) { shapeMesh(opaqueBuf, id, p, ox + x, y, oz + z); continue; }
    let any = 0;
    for (let f = 0; f < 6; f++) {
      const nb = padded[p + FACES[f].nd];
      vis[f] = OPAQUE[nb] || nb === id ? 0 : 1;
      any |= vis[f];
    }
    if (!any) continue;

    const blk = BLOCKS[id];
    const liquid = KIND[id] === 3;
    const buf = liquid ? liquidBuf : opaqueBuf;
    const wx = ox + x, wz = oz + z;
    const r = liquid ? 0 : blk.round;
    const lowerTop = liquid && padded[p + PA] !== B.WATER ? 0.12 : 0;
    const glow = !!blk.glow;
    // each face is pulled in by r on every side where it meets another visible face
    for (let a = 0; a < 3; a++) { lo[a] = vis[a * 2 + 1] ? r : 0; hi[a] = vis[a * 2] ? 1 - r : 1; }

    // ---- flat faces ----
    for (let f = 0; f < 6; f++) {
      if (!vis[f]) continue;
      const F = FACES[f], axis = f >> 1, layer = blk.tiles[f];
      buf.reserve(4, 6);
      const ao = [3, 3, 3, 3];
      if (!liquid && !glow) {
        for (let k = 0; k < 4; k++) {
          const [na, nb, nd] = F.ao[k];
          const s1 = OPAQUE[padded[p + na]], s2 = OPAQUE[padded[p + nb]], cr = OPAQUE[padded[p + nd]];
          ao[k] = s1 && s2 ? 0 : 3 - (s1 + s2 + cr);
        }
      }
      const s = buf.vc;
      for (let k = 0; k < 4; k++) {
        const c = F.c[k];
        for (let a = 0; a < 3; a++) pos[a] = a === axis ? c[a] : c[a] ? hi[a] : lo[a];
        if (lowerTop && c[1] === 1) pos[1] -= lowerTop;
        const uv = faceUV(f, pos[0], pos[1], pos[2]);
        buf.vert(wx + pos[0], y + pos[1], wz + pos[2], uv[0], uv[1], layer, glow ? 1 : F.shade * AO[ao[k]]);
      }
      const I = buf.i;
      if (ao[0] + ao[2] < ao[1] + ao[3]) {
        I[buf.in++] = s + 1; I[buf.in++] = s + 2; I[buf.in++] = s + 3;
        I[buf.in++] = s + 1; I[buf.in++] = s + 3; I[buf.in++] = s;
      } else {
        I[buf.in++] = s; I[buf.in++] = s + 1; I[buf.in++] = s + 2;
        I[buf.in++] = s; I[buf.in++] = s + 2; I[buf.in++] = s + 3;
      }
    }
    if (!r) continue;

    // ---- rounded edges where two visible faces meet ----
    for (let a = 0; a < 3; a++) for (let b = a + 1; b < 3; b++) for (let sa = 0; sa < 2; sa++) for (let sb = 0; sb < 2; sb++) {
      const fa = a * 2 + sa, fb = b * 2 + sb;
      if (!vis[fa] || !vis[fb]) continue;
      const e = 3 - a - b;
      const dirA = sa ? -1 : 1, dirB = sb ? -1 : 1;
      const ca = sa ? r : 1 - r, cb = sb ? r : 1 - r;
      const tf = b === 1 ? fb : fa; // texture: the top/bottom face if one is involved, else the side
      const layer = blk.tiles[tf];
      buf.reserve((SEG + 1) * 2, SEG * 6);
      const first = buf.vc;
      for (let k = 0; k <= SEG; k++) {
        const da = ARC[k][0] * dirA, db = ARC[k][1] * dirB;
        n[0] = n[1] = n[2] = 0; n[a] = da; n[b] = db;
        const sh = glow ? 1 : shadeN(n[0], n[1], n[2]);
        pos[a] = ca + r * da; pos[b] = cb + r * db;
        for (let end = 0; end < 2; end++) {
          pos[e] = end ? hi[e] : lo[e];
          const uv = faceUV(tf, pos[0], pos[1], pos[2]);
          buf.vert(wx + pos[0], y + pos[1], wz + pos[2], uv[0], uv[1], layer, sh);
        }
      }
      for (let k = 0; k < SEG; k++) {
        const v0 = first + k * 2;
        n[0] = n[1] = n[2] = 0;
        n[a] = (ARC[k][0] + ARC[k + 1][0]) * dirA; n[b] = (ARC[k][1] + ARC[k + 1][1]) * dirB;
        buf.tri(v0, v0 + 2, v0 + 3, n[0], n[1], n[2]);
        buf.tri(v0, v0 + 3, v0 + 1, n[0], n[1], n[2]);
      }
      // Where this edge runs into a neighbour that doesn't carry the same rounded edge on,
      // fill the little gap between the curve and the neighbour's square corner.
      for (let end = 0; end < 2; end++) {
        if (vis[e * 2 + (end ? 0 : 1)]) continue; // that end already finishes in a corner cap
        const pN = p + AXIS_D[e] * (end ? 1 : -1), N = padded[pN];
        if (OPAQUE[N] && BLOCKS[N].round === r) {
          const na = padded[pN + AXIS_D[a] * dirA], nb2 = padded[pN + AXIS_D[b] * dirB];
          if (!(OPAQUE[na] || na === N) && !(OPAQUE[nb2] || nb2 === N)) continue; // edge continues smoothly
        }
        buf.reserve(1, SEG * 3);
        pos[a] = sa ? 0 : 1; pos[b] = sb ? 0 : 1; pos[e] = end ? 1 : 0;
        const uv = faceUV(tf, pos[0], pos[1], pos[2]);
        const cv = buf.vert(wx + pos[0], y + pos[1], wz + pos[2], uv[0], uv[1], layer, glow ? 1 : FACES[fa].shade);
        n[0] = n[1] = n[2] = 0; n[e] = end ? -1 : 1;
        for (let k = 0; k < SEG; k++) buf.tri(cv, first + k * 2 + end, first + (k + 1) * 2 + end, n[0], n[1], n[2]);
      }
    }

    // ---- rounded corners where three visible faces meet ----
    for (let sx = 0; sx < 2; sx++) for (let sy = 0; sy < 2; sy++) for (let sz = 0; sz < 2; sz++) {
      if (!vis[sx] || !vis[2 + sy] || !vis[4 + sz]) continue;
      const dx = sx ? -1 : 1, dy = sy ? -1 : 1, dz = sz ? -1 : 1;
      const cxl = sx ? r : 1 - r, cyl = sy ? r : 1 - r, czl = sz ? r : 1 - r;
      const tf = 2 + sy, layer = blk.tiles[tf];
      buf.reserve(CAP.length, SEG * SEG * 3);
      const first = buf.vc;
      for (const [ux, uy, uz] of CAP) {
        const nx = ux * dx, ny = uy * dy, nz = uz * dz;
        const px = cxl + r * nx, py = cyl + r * ny, pz = czl + r * nz;
        const uv = faceUV(tf, px, py, pz);
        buf.vert(wx + px, y + py, wz + pz, uv[0], uv[1], layer, glow ? 1 : shadeN(nx, ny, nz));
      }
      for (let i = 0; i < SEG; i++) for (let j = 0; j < SEG - i; j++) {
        const A = first + capIndex(i, j), Bv = first + capIndex(i + 1, j), C = first + capIndex(i, j + 1);
        buf.tri(A, Bv, C, dx, dy, dz);
        if (i + j < SEG - 1) buf.tri(Bv, first + capIndex(i + 1, j + 1), C, dx, dy, dz);
      }
    }
  }
  return { opaque: opaqueBuf.out(), liquid: liquidBuf.out() };
}

// ---- fences and gates: little posts, rails and boards instead of a full cube ----
// An axis-aligned box from (x0,y0,z0) to (x1,y1,z1) in block-local coordinates; swap exchanges x and z.
function shapeBox(buf, wx, wy, wz, layer, x0, y0, z0, x1, y1, z1, swap) {
  if (swap) { [x0, z0] = [z0, x0]; [x1, z1] = [z1, x1]; }
  const lo = [x0, y0, z0], hi = [x1, y1, z1], pos = [0, 0, 0];
  for (let f = 0; f < 6; f++) {
    const F = FACES[f], axis = f >> 1;
    buf.reserve(4, 6);
    const s = buf.vc;
    for (let k = 0; k < 4; k++) {
      const c = F.c[k];
      for (let a = 0; a < 3; a++) pos[a] = c[a] ? hi[a] : lo[a];
      const uv = faceUV(f, pos[0], pos[1], pos[2]);
      buf.vert(wx + pos[0], wy + pos[1], wz + pos[2], uv[0], uv[1], layer, F.shade * (f === 3 ? 0.9 : 1));
    }
    const I = buf.i;
    I[buf.in++] = s; I[buf.in++] = s + 1; I[buf.in++] = s + 2;
    I[buf.in++] = s; I[buf.in++] = s + 2; I[buf.in++] = s + 3;
  }
}

function shapeMesh(buf, id, p, wx, wy, wz) {
  const layer = BLOCKS[id].tiles[0];
  const box = (...a) => shapeBox(buf, wx, wy, wz, layer, ...a);
  const px = JOINS(padded[p + 1]), nx = JOINS(padded[p - 1]), pz = JOINS(padded[p + PX]), nz = JOINS(padded[p - PX]);
  if (id === B.FENCE) {
    box(0.375, 0, 0.375, 0.625, 1, 0.625);                                    // post
    for (const [y0, y1] of [[0.36, 0.5], [0.7, 0.84]]) {                       // two rails towards each neighbour
      if (px) box(0.625, y0, 0.44, 1, y1, 0.56);
      if (nx) box(0, y0, 0.44, 0.375, y1, 0.56);
      if (pz) box(0.44, y0, 0.625, 0.56, y1, 1);
      if (nz) box(0.44, y0, 0, 0.56, y1, 0.375);
    }
    return;
  }
  if (id === B.TABLE) {
    box(0.02, 0.8, 0.02, 0.98, 1, 0.98);                                       // worktop
    for (const [x, z] of [[0.08, 0.08], [0.78, 0.08], [0.08, 0.78], [0.78, 0.78]]) box(x, 0, z, x + 0.14, 0.8, z + 0.14);
    box(0.1, 0.24, 0.1, 0.9, 0.32, 0.9);                                       // low shelf
    box(0.12, 1, 0.14, 0.42, 1.04, 0.3);                                       // a saw and a little plank on top
    box(0.55, 1, 0.55, 0.85, 1.08, 0.8);
    return;
  }
  if (id === B.LADDER) {
    // leans on the first solid wall beside it (drawn here for a wall on the -z side, then turned)
    const side = OPAQUE[padded[p - PX]] ? 0 : OPAQUE[padded[p + PX]] ? 1 : OPAQUE[padded[p - 1]] ? 2 : OPAQUE[padded[p + 1]] ? 3 : 0;
    const lb = (x0, y0, z0, x1, y1, z1) => {
      if (side === 1) [z0, z1] = [1 - z1, 1 - z0];
      if (side >= 2) { [x0, z0, x1, z1] = [z0, x0, z1, x1]; if (side === 3) [x0, x1] = [1 - x1, 1 - x0]; }
      shapeBox(buf, wx, wy, wz, layer, x0, y0, z0, x1, y1, z1, false);
    };
    lb(0.12, 0, 0.02, 0.22, 1, 0.13); lb(0.78, 0, 0.02, 0.88, 1, 0.13);        // rails
    for (const y of [0.12, 0.37, 0.62, 0.87]) lb(0.22, y, 0.04, 0.78, y + 0.08, 0.11); // rungs
    return;
  }
  if (BLOCKS[id].shape === 'flower') {
    const { petal, middle } = BLOCKS[id];
    const pb = (l, ...a) => shapeBox(buf, wx, wy, wz, l, ...a, false);
    box(0.46, 0, 0.46, 0.54, 0.6, 0.54);                                       // stem
    box(0.54, 0.2, 0.47, 0.74, 0.27, 0.53); box(0.26, 0.32, 0.47, 0.46, 0.39, 0.53); // leaves
    pb(petal, 0.24, 0.58, 0.41, 0.43, 0.72, 0.59); pb(petal, 0.57, 0.58, 0.41, 0.76, 0.72, 0.59);
    pb(petal, 0.41, 0.58, 0.24, 0.59, 0.72, 0.43); pb(petal, 0.41, 0.58, 0.57, 0.59, 0.72, 0.76);
    pb(middle, 0.42, 0.6, 0.42, 0.58, 0.76, 0.58);
    return;
  }
  if (BLOCKS[id].shape === 'feeder') {
    box(0.05, 0, 0.2, 0.95, 0.1, 0.8);                                         // floor
    box(0.05, 0.1, 0.2, 0.95, 0.46, 0.28); box(0.05, 0.1, 0.72, 0.95, 0.46, 0.8); // long sides
    box(0.05, 0.1, 0.28, 0.13, 0.5, 0.72); box(0.87, 0.1, 0.28, 0.95, 0.5, 0.72); // ends
    const fill = BLOCKS[id].fill;
    if (fill !== undefined) shapeBox(buf, wx, wy, wz, fill, 0.13, 0.1, 0.28, 0.87, 0.4, 0.72, false);
    return;
  }
  // gates and doors run between the fences or walls beside them: along x unless the neighbours are along z
  const swap = !(px || nx) && (pz || nz);
  if (BLOCKS[id].shape === 'door') {
    const { knob, pane } = BLOCKS[id], open = id === B.DOOR_OPEN || id === B.DOOR_OPEN_TOP, top = id === B.DOOR_TOP || id === B.DOOR_OPEN_TOP;
    // drawn shut across the doorway; an open door is the same thing swung back against its hinge side
    const db = (l, x0, y0, z0, x1, y1, z1) => {
      if (open) [x0, x1, z0, z1] = [z0 - 0.42, z1 - 0.42, 0.42 + x0 * 0.58, 0.42 + x1 * 0.58];
      shapeBox(buf, wx, wy, wz, l, x0, y0, z0, x1, y1, z1, swap);
    };
    if (!top) {
      db(layer, 0, 0, 0.43, 1, 1, 0.57);                                        // the planks
      db(layer, 0.08, 0.14, 0.41, 0.92, 0.24, 0.59);                            // cross braces
      db(layer, 0.08, 0.72, 0.41, 0.92, 0.82, 0.59);
      db(knob, 0.78, 0.92, 0.36, 0.88, 1.02, 0.64);                             // round gold handle
    } else {
      db(layer, 0, 0, 0.43, 0.16, 1, 0.57); db(layer, 0.84, 0, 0.43, 1, 1, 0.57); // frame
      db(layer, 0.16, 0, 0.43, 0.84, 0.3, 0.57); db(layer, 0.16, 0.86, 0.43, 0.84, 1, 0.57);
      db(pane, 0.16, 0.3, 0.48, 0.84, 0.86, 0.52);                              // little window
      db(layer, 0.47, 0.3, 0.45, 0.53, 0.86, 0.55);
    }
    return;
  }
  box(0, 0, 0.42, 0.14, 1, 0.58, swap);                                        // hinge post
  box(0.86, 0, 0.42, 1, 1, 0.58, swap);                                        // latch post
  const bands = [[0.2, 0.34], [0.48, 0.62], [0.76, 0.9]];
  if (id === B.GATE) {
    for (const [y0, y1] of bands) box(0.14, y0, 0.45, 0.86, y1, 0.55, swap);
    box(0.45, 0.2, 0.44, 0.55, 0.9, 0.56, swap);                               // middle slat
  } else {
    // open: two halves swung back against the posts
    for (const [y0, y1] of bands) {
      box(0.14, y0, 0.58, 0.24, y1, 0.96, swap);
      box(0.76, y0, 0.58, 0.86, y1, 0.96, swap);
    }
  }
}
