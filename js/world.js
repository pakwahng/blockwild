// World data: chunked block storage, terrain generation, player edits and meshing.
import { B, BLOCKS, OPAQUE, KIND } from './blocks.js';
import { makeNoise, hash3 } from './noise.js';

export const CS = 16;   // chunk size (x/z)
export const CH = 80;   // world height
export const SEA = 28;  // sea level

const AREA = CS * CS;
export const index = (x, y, z) => x + z * CS + y * AREA;

export class World {
  constructor(seed, edits = new Map()) {
    this.seed = seed >>> 0;
    this.n = makeNoise(this.seed);
    this.n2 = makeNoise(this.seed ^ 0x5bd1e995);
    this.chunks = new Map();
    this.edits = edits;           // chunk key -> Map(blockIndex -> blockId)
    this.editsChanged = false;
  }

  static key(cx, cz) { return cx + ',' + cz; }
  getChunk(cx, cz) { return this.chunks.get(World.key(cx, cz)); }

  // ---- terrain shape ----
  heightAt(x, z) {
    const n = this.n;
    const cont = n.fbm2(x / 256, z / 256, 4);
    const hills = n.fbm2(x / 64 + 31.7, z / 64 - 17.3, 3);
    let m = n.perlin2(x / 180 - 50.1, z / 180 + 80.3);
    m = m > 0 ? m * m * 2.4 : 0;
    const h = SEA + 3 + cont * 22 + hills * 6 + m * 34;
    return Math.max(4, Math.min(CH - 12, Math.floor(h)));
  }

  surfaceBlock(h) {
    if (h <= SEA + 1) return B.SAND;
    if (h >= SEA + 26) return B.SNOW;
    return B.GRASS;
  }

  forestDensity(x, z) {
    const f = this.n2.perlin2(x / 90, z / 90);
    return f > 0.08 ? 0.6 : f > -0.15 ? 0.12 : 0.03;
  }

  generate(cx, cz) {
    const data = new Uint8Array(AREA * CH);
    const x0 = cx * CS, z0 = cz * CS;
    const n = this.n, n2 = this.n2;
    const heights = new Int16Array(AREA);

    for (let lz = 0; lz < CS; lz++) for (let lx = 0; lx < CS; lx++) {
      const wx = x0 + lx, wz = z0 + lz;
      const h = this.heightAt(wx, wz);
      heights[lx + lz * CS] = h;
      const top = this.surfaceBlock(h);
      const under = top === B.SAND ? B.SAND : B.DIRT;
      const shallow = h <= SEA + 2;
      for (let y = 0; y <= Math.max(h, SEA); y++) {
        let id;
        if (y === 0) id = B.BEDROCK;
        else if (y < h - 3) id = B.STONE;
        else if (y < h) id = under;
        else if (y === h) id = h < SEA ? (h < SEA - 5 ? B.CLAY : B.SAND) : top;
        else id = B.WATER; // y in (h, SEA]
        // caves: intersection of two noise "sheets" carves winding tunnels
        if (id !== B.WATER && y > 1 && y <= h && !(shallow && y > h - 6)) {
          const a = n.perlin3(wx / 26, y / 15, wz / 26);
          const b = n2.perlin3(wx / 26, y / 15, wz / 26);
          if (a * a + b * b < 0.0065) id = B.AIR;
        }
        data[index(lx, y, lz)] = id;
      }
    }

    // trees: one candidate per 5x5 cell, including cells whose canopy spills into this chunk
    const CELL = 5;
    for (let gz = Math.floor((z0 - 3) / CELL); gz <= Math.floor((z0 + CS + 2) / CELL); gz++) {
      for (let gx = Math.floor((x0 - 3) / CELL); gx <= Math.floor((x0 + CS + 2) / CELL); gx++) {
        const tx = gx * CELL + Math.floor(hash3(gx, 1, gz, this.seed) * (CELL - 1));
        const tz = gz * CELL + Math.floor(hash3(gx, 2, gz, this.seed) * (CELL - 1));
        if (hash3(gx, 3, gz, this.seed) > this.forestDensity(tx, tz)) continue;
        const h = this.heightAt(tx, tz);
        if (this.surfaceBlock(h) !== B.GRASS) continue;
        // skip trees whose base was carved away by a cave
        const a = n.perlin3(tx / 26, h / 15, tz / 26), b = n2.perlin3(tx / 26, h / 15, tz / 26);
        if (a * a + b * b < 0.0065) continue;
        this.placeTree(data, x0, z0, tx, h + 1, tz, hash3(gx, 4, gz, this.seed));
      }
    }

    const chunk = { cx, cz, data, dirty: true, gpu: null };
    const edits = this.edits.get(World.key(cx, cz));
    if (edits) for (const [i, id] of edits) data[i] = id;
    this.chunks.set(World.key(cx, cz), chunk);
    return chunk;
  }

  placeTree(data, x0, z0, tx, by, tz, r) {
    const trunk = 4 + Math.floor(r * 3);
    const put = (x, y, z, id, onlyAir) => {
      const lx = x - x0, lz = z - z0;
      if (lx < 0 || lz < 0 || lx >= CS || lz >= CS || y < 0 || y >= CH) return;
      const i = index(lx, y, lz);
      if (onlyAir && data[i] !== B.AIR) return;
      data[i] = id;
    };
    const topY = by + trunk;
    for (let dy = -2; dy <= 1; dy++) {
      const rad = dy <= -1 ? 2 : 1;
      for (let dx = -rad; dx <= rad; dx++) for (let dz = -rad; dz <= rad; dz++) {
        const corner = Math.abs(dx) === rad && Math.abs(dz) === rad;
        if (corner && (rad === 1 ? dy === 1 : hash3(tx + dx, topY + dy, tz + dz, this.seed) < 0.5)) continue;
        put(tx + dx, topY + dy, tz + dz, B.LEAVES, true);
      }
    }
    for (let y = by; y < topY; y++) put(tx, y, tz, B.LOG, false);
  }

  // ---- block access ----
  getBlock(x, y, z) {
    if (y < 0) return B.BEDROCK;
    if (y >= CH) return B.AIR;
    const cx = Math.floor(x / CS), cz = Math.floor(z / CS);
    const c = this.chunks.get(World.key(cx, cz));
    if (!c) return B.AIR;
    return c.data[index(x - cx * CS, y, z - cz * CS)];
  }

  setBlock(x, y, z, id) {
    if (y < 1 || y >= CH) return false;
    const cx = Math.floor(x / CS), cz = Math.floor(z / CS);
    const key = World.key(cx, cz);
    const c = this.chunks.get(key);
    if (!c) return false;
    const lx = x - cx * CS, lz = z - cz * CS, i = index(lx, y, lz);
    if (c.data[i] === id) return false;
    c.data[i] = id;
    let e = this.edits.get(key);
    if (!e) { e = new Map(); this.edits.set(key, e); }
    e.set(i, id);
    this.editsChanged = true;
    for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) {
      if ((dx === -1 && lx !== 0) || (dx === 1 && lx !== CS - 1)) continue;
      if ((dz === -1 && lz !== 0) || (dz === 1 && lz !== CS - 1)) continue;
      const nc = this.chunks.get(World.key(cx + dx, cz + dz));
      if (nc) nc.dirty = true;
    }
    return true;
  }

  hasNeighbours(cx, cz) {
    for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++)
      if (!this.chunks.has(World.key(cx + dx, cz + dz))) return false;
    return true;
  }

  serializeEdits() {
    const out = {};
    for (const [k, m] of this.edits) {
      if (!m.size) continue;
      const arr = [];
      for (const [i, id] of m) arr.push(i, id);
      out[k] = arr;
    }
    return out;
  }
  static deserializeEdits(obj) {
    const edits = new Map();
    for (const k in obj || {}) {
      const m = new Map(), a = obj[k];
      for (let i = 0; i < a.length; i += 2) m.set(a[i], a[i + 1]);
      edits.set(k, m);
    }
    return edits;
  }
}

// ---------------- meshing ----------------
const PX = CS + 2, PA = PX * PX;
const pidx = (x, y, z) => (x + 1) + (z + 1) * PX + (y + 1) * PA;
const padded = new Uint8Array(PA * (CH + 2));

// Faces: +x -x +y -y +z -z. Corners wound counter-clockwise seen from outside.
const FACES = [
  { n: [1, 0, 0], c: [[1, 0, 0], [1, 1, 0], [1, 1, 1], [1, 0, 1]], shade: 0.8, uv: c => [1 - c[2], 1 - c[1]] },
  { n: [-1, 0, 0], c: [[0, 0, 1], [0, 1, 1], [0, 1, 0], [0, 0, 0]], shade: 0.8, uv: c => [c[2], 1 - c[1]] },
  { n: [0, 1, 0], c: [[0, 1, 1], [1, 1, 1], [1, 1, 0], [0, 1, 0]], shade: 1.0, uv: c => [c[0], c[2]] },
  { n: [0, -1, 0], c: [[0, 0, 0], [1, 0, 0], [1, 0, 1], [0, 0, 1]], shade: 0.55, uv: c => [c[0], 1 - c[2]] },
  { n: [0, 0, 1], c: [[1, 0, 1], [1, 1, 1], [0, 1, 1], [0, 0, 1]], shade: 0.68, uv: c => [c[0], 1 - c[1]] },
  { n: [0, 0, -1], c: [[0, 0, 0], [0, 1, 0], [1, 1, 0], [1, 0, 0]], shade: 0.68, uv: c => [1 - c[0], 1 - c[1]] },
];
const pd = (x, y, z) => x + z * PX + y * PA; // padded index delta
for (const f of FACES) {
  const axis = f.n.findIndex(v => v !== 0);
  const [t1, t2] = [0, 1, 2].filter(a => a !== axis);
  f.nd = pd(f.n[0], f.n[1], f.n[2]);
  f.uvs = f.c.map(f.uv);
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

class MeshBuf {
  constructor() { this.v = new Float32Array(1 << 16); this.i = new Uint32Array(1 << 15); this.reset(); }
  reset() { this.vn = 0; this.in = 0; this.vc = 0; }
  reserve() {
    if (this.vn + 28 > this.v.length) { const n = new Float32Array(this.v.length * 2); n.set(this.v); this.v = n; }
    if (this.in + 6 > this.i.length) { const n = new Uint32Array(this.i.length * 2); n.set(this.i); this.i = n; }
  }
  out() { return { verts: this.v.slice(0, this.vn), idx: this.i.slice(0, this.in) }; }
}
const opaqueBuf = new MeshBuf(), liquidBuf = new MeshBuf();

export function buildMesh(world, chunk) {
  const { cx, cz } = chunk;
  // copy chunk + border from neighbours into the padded array
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
  for (let y = 0; y < CH; y++) for (let z = 0; z < CS; z++) for (let x = 0; x < CS; x++) {
    const p = pidx(x, y, z);
    const id = padded[p];
    if (id === B.AIR) continue;
    const kind = KIND[id];
    const blk = BLOCKS[id];
    const liquid = kind === 3;
    const buf = liquid ? liquidBuf : opaqueBuf;
    const lowerTop = liquid && padded[p + PA] !== B.WATER ? 0.12 : 0;
    for (let f = 0; f < 6; f++) {
      const F = FACES[f];
      const nb = padded[p + F.nd];
      if (OPAQUE[nb] || nb === id) continue;
      buf.reserve();
      const layer = blk.tiles[f];
      const ao = [3, 3, 3, 3];
      if (!liquid && !blk.glow) {
        for (let k = 0; k < 4; k++) {
          const [a, b, d] = F.ao[k];
          const s1 = OPAQUE[padded[p + a]], s2 = OPAQUE[padded[p + b]], cr = OPAQUE[padded[p + d]];
          ao[k] = s1 && s2 ? 0 : 3 - (s1 + s2 + cr);
        }
      }
      const base = blk.glow ? 1.0 : F.shade;
      const v = buf.v;
      for (let k = 0; k < 4; k++) {
        const c = F.c[k], uv = F.uvs[k];
        let o = buf.vn;
        v[o++] = ox + x + c[0];
        v[o++] = y + c[1] - (c[1] ? lowerTop : 0);
        v[o++] = oz + z + c[2];
        v[o++] = uv[0]; v[o++] = uv[1]; v[o++] = layer;
        v[o++] = blk.glow ? 1.0 : base * AO[ao[k]];
        buf.vn = o;
      }
      const s = buf.vc, I = buf.i;
      if (ao[0] + ao[2] < ao[1] + ao[3]) {
        I[buf.in++] = s + 1; I[buf.in++] = s + 2; I[buf.in++] = s + 3;
        I[buf.in++] = s + 1; I[buf.in++] = s + 3; I[buf.in++] = s;
      } else {
        I[buf.in++] = s; I[buf.in++] = s + 1; I[buf.in++] = s + 2;
        I[buf.in++] = s; I[buf.in++] = s + 2; I[buf.in++] = s + 3;
      }
      buf.vc += 4;
    }
  }
  return { opaque: opaqueBuf.out(), liquid: liquidBuf.out() };
}
