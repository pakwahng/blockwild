// World data: chunked block storage, terrain generation, player edits and meshing.
import { B } from './blocks.js';
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
    return f > 0.15 ? 0.4 : f > -0.1 ? 0.07 : 0.025;
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
      let top = this.surfaceBlock(h);
      // muddy patches in the lowlands, where piglets like to roll
      if (top === B.GRASS && h <= SEA + 5 && n2.perlin2(wx / 13 + 100.5, wz / 13 - 40.5) > 0.3) top = B.MUD;
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

    // wild flowers dotted about the grass, in little clumps
    for (let lz = 0; lz < CS; lz++) for (let lx = 0; lx < CS; lx++) {
      const wx = x0 + lx, wz = z0 + lz, h = heights[lx + lz * CS];
      if (h + 1 >= CH || data[index(lx, h, lz)] !== B.GRASS || data[index(lx, h + 1, lz)] !== B.AIR) continue;
      const clump = n2.perlin2(wx / 9 + 33.3, wz / 9 - 71.7);
      if (clump < 0.25 || hash3(wx, 7, wz, this.seed) > 0.12) continue;
      const kind = n.perlin2(wx / 23 - 5.5, wz / 23 + 9.1);
      data[index(lx, h + 1, lz)] = kind < -0.15 ? B.FLOWER_RED : kind < 0.15 ? B.FLOWER_YELLOW : B.FLOWER_WHITE;
    }

    // now and then a treasure chest sits out in the open (about one every 8 chunks), on grass, sand or snow
    let chest = null;
    if (hash3(cx, 11, cz, this.seed) < 0.13) {
      const lx = 2 + Math.floor(hash3(cx, 12, cz, this.seed) * (CS - 4)), lz = 2 + Math.floor(hash3(cx, 13, cz, this.seed) * (CS - 4));
      const h = heights[lx + lz * CS], ground = data[index(lx, h, lz)];
      if (h >= SEA && h + 2 < CH && (ground === B.GRASS || ground === B.SAND || ground === B.SNOW) && data[index(lx, h + 2, lz)] === B.AIR
        && (data[index(lx, h + 1, lz)] === B.AIR || (data[index(lx, h + 1, lz)] >= B.FLOWER_RED && data[index(lx, h + 1, lz)] <= B.FLOWER_WHITE))) {
        data[index(lx, h + 1, lz)] = B.CHEST;
        chest = [x0 + lx, h + 1, z0 + lz];
      }
    }

    const chunk = { cx, cz, data, dirty: true, gpu: null, chest };
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
    // round, puffy canopy like the trees in the video
    const topY = by + trunk;
    const R = r < 0.4 ? 1.75 : 2.35, R2 = R * R;
    for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) for (let dz = -2; dz <= 2; dz++) {
      if (dx * dx + dz * dz + dy * dy * 1.25 > R2) continue;
      put(tx + dx, topY + dy, tz + dz, B.LEAVES, true);
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

  // An edit from another player: applied now if the chunk is loaded, otherwise kept for when it generates.
  applyEdit(x, y, z, id) {
    if (y < 1 || y >= CH) return false;
    const cx = Math.floor(x / CS), cz = Math.floor(z / CS), key = World.key(cx, cz);
    if (this.chunks.has(key)) return this.setBlock(x, y, z, id);
    let e = this.edits.get(key);
    if (!e) { e = new Map(); this.edits.set(key, e); }
    e.set(index(x - cx * CS, y, z - cz * CS), id);
    return false;
  }

  // Blocks the players have placed within r of (x, z) that pass test(id): [[x, y, z, id], ...]
  placedNear(x, z, r, test) {
    const out = [], c0x = Math.floor((x - r) / CS), c1x = Math.floor((x + r) / CS), c0z = Math.floor((z - r) / CS), c1z = Math.floor((z + r) / CS);
    for (let cz = c0z; cz <= c1z; cz++) for (let cx = c0x; cx <= c1x; cx++) {
      const m = this.edits.get(World.key(cx, cz));
      if (!m || !this.chunks.has(World.key(cx, cz))) continue;
      for (const [i, id] of m) {
        if (!test(id)) continue;
        const bx = cx * CS + (i % CS), bz = cz * CS + (Math.floor(i / CS) % CS), by = Math.floor(i / (CS * CS));
        if ((bx - x) ** 2 + (bz - z) ** 2 <= r * r) out.push([bx, by, bz, id]);
      }
    }
    return out;
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
