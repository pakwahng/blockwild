// Procedurally painted 16x16 pixel-art tiles. Returns a vertical strip canvas
// (16 x 16*N) for the WebGL texture array, plus per-tile canvases for UI icons.
import { T, TILE_COUNT } from './blocks.js';
import { makeRng } from './noise.js';

const S = 16;

function hex(c) {
  return [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16)];
}
const clamp = v => Math.max(0, Math.min(255, v | 0));

function makeTile(painter, seed) {
  const data = new Uint8ClampedArray(S * S * 4);
  const rnd = makeRng(seed * 7919 + 13);
  const set = (x, y, rgb, a = 255, jitter = 0) => {
    const j = jitter ? (rnd() - 0.5) * jitter : 0;
    const i = (y * S + x) * 4;
    data[i] = clamp(rgb[0] + j); data[i + 1] = clamp(rgb[1] + j); data[i + 2] = clamp(rgb[2] + j); data[i + 3] = a;
  };
  painter(set, rnd);
  return data;
}

function fill(set, rnd, base, jitter) {
  const c = hex(base);
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) set(x, y, c, 255, jitter);
}
function speckle(set, rnd, color, chance, jitter = 10) {
  const c = hex(color);
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) if (rnd() < chance) set(x, y, c, 255, jitter);
}

const dirt = (set, rnd) => { fill(set, rnd, '#8a5f3c', 26); speckle(set, rnd, '#6a4429', 0.12); speckle(set, rnd, '#a37750', 0.06); };

function grassSide(topColor, jitter) {
  return (set, rnd) => {
    dirt(set, rnd);
    const c = hex(topColor);
    for (let x = 0; x < S; x++) {
      const depth = 2 + Math.floor(rnd() * 3) + (rnd() < 0.2 ? 2 : 0);
      for (let y = 0; y < depth; y++) set(x, y, c, 255, jitter);
    }
  };
}

function cells(set, rnd, palette, mortar, n) {
  const pts = [];
  for (let i = 0; i < n; i++) pts.push([rnd() * S, rnd() * S, hex(palette[i % palette.length])]);
  const m = hex(mortar);
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    let best = 1e9, second = 1e9, col = null;
    for (const [px, py, c] of pts) {
      for (let ox = -S; ox <= S; ox += S) for (let oy = -S; oy <= S; oy += S) {
        const d = (x + 0.5 - px - ox) ** 2 + (y + 0.5 - py - oy) ** 2;
        if (d < best) { second = best; best = d; col = c; } else if (d < second) second = d;
      }
    }
    if (Math.sqrt(second) - Math.sqrt(best) < 1.0) set(x, y, m, 255, 12);
    else set(x, y, col, 255, 18);
  }
}

const painters = {
  [T.GRASS_TOP]: (set, rnd) => { fill(set, rnd, '#5c9e3c', 30); speckle(set, rnd, '#4a8630', 0.18); speckle(set, rnd, '#79b852', 0.1); },
  [T.GRASS_SIDE]: grassSide('#5c9e3c', 28),
  [T.DIRT]: dirt,
  [T.STONE]: (set, rnd) => {
    fill(set, rnd, '#86888c', 18);
    speckle(set, rnd, '#6f7175', 0.14); speckle(set, rnd, '#9a9ca0', 0.08);
    const d = hex('#65676b');
    for (let k = 0; k < 4; k++) { // short cracks
      let x = Math.floor(rnd() * S), y = Math.floor(rnd() * S);
      for (let i = 0; i < 3; i++) { set(x & 15, y & 15, d, 255, 8); x += rnd() < 0.5 ? 1 : 0; y += 1; }
    }
  },
  [T.SAND]: (set, rnd) => { fill(set, rnd, '#e0d29a', 16); speckle(set, rnd, '#cbbb82', 0.15, 8); speckle(set, rnd, '#efe3b4', 0.08, 6); },
  [T.LOG_SIDE]: (set, rnd) => {
    const base = hex('#6e4b2c'), dark = hex('#523720');
    for (let x = 0; x < S; x++) {
      const stripe = rnd() < 0.35;
      for (let y = 0; y < S; y++) set(x, y, stripe ? dark : base, 255, 18);
    }
    speckle(set, rnd, '#866038', 0.05);
  },
  [T.LOG_TOP]: (set, rnd) => {
    const ringA = hex('#b8915a'), ringB = hex('#9c7646'), bark = hex('#5e4026');
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
      const dx = x - 7.5, dy = y - 7.5, d = Math.max(Math.abs(dx), Math.abs(dy));
      if (d > 6.6) set(x, y, bark, 255, 16);
      else set(x, y, Math.floor(Math.hypot(dx, dy) + 0.3) % 2 ? ringA : ringB, 255, 10);
    }
  },
  [T.LEAVES]: (set, rnd) => {
    const cs = ['#3b7a2a', '#2f6622', '#4a8f33', '#356f27'].map(hex);
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
      if (rnd() < 0.16) set(x, y, [0, 0, 0], 0);
      else set(x, y, cs[Math.floor(rnd() * cs.length)], 255, 14);
    }
  },
  [T.PLANKS]: (set, rnd) => {
    const base = hex('#b88a52'), seam = hex('#7f5a32');
    for (let row = 0; row < 4; row++) {
      const offset = Math.floor(rnd() * 16), shade = (rnd() - 0.5) * 22;
      for (let y = row * 4; y < row * 4 + 4; y++) for (let x = 0; x < S; x++) {
        if (y === row * 4 + 3 || (x === offset && y !== row * 4 + 3)) set(x, y, seam, 255, 8);
        else set(x, y, [base[0] + shade, base[1] + shade, base[2] + shade], 255, 12);
      }
    }
  },
  [T.GLASS]: (set) => {
    const frame = hex('#d9eef5'), shine = hex('#ffffff');
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
      if (x === 0 || y === 0 || x === 15 || y === 15) set(x, y, frame, 255, 0);
      else if ((x === y + 3 && x < 8) || (x === y + 5 && x < 9) || (x === y - 6 && x > 8 && x < 12)) set(x, y, shine, 255, 0);
      else set(x, y, [0, 0, 0], 0);
    }
  },
  [T.WATER]: (set, rnd) => {
    const base = hex('#3768c9'), light = hex('#5487e0');
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
      const wave = Math.sin((x + y * 0.5) * 0.9) + Math.sin(y * 1.3 - x * 0.4);
      set(x, y, wave > 1.1 ? light : base, 175, 10);
    }
  },
  [T.COBBLE]: (set, rnd) => cells(set, rnd, ['#8f9195', '#7a7c80', '#a2a4a7', '#6d6f73'], '#55575b', 9),
  [T.BRICK]: (set, rnd) => {
    const brick = hex('#a24b38'), mortar = hex('#c9c0b2');
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
      const row = Math.floor(y / 4), off = row % 2 ? 4 : 0;
      if (y % 4 === 3 || (x + off) % 8 === 7) set(x, y, mortar, 255, 10);
      else set(x, y, brick, 255, 24);
    }
  },
  [T.SNOW]: (set, rnd) => { fill(set, rnd, '#eef3f7', 10); speckle(set, rnd, '#dbe5ee', 0.15, 6); },
  [T.SNOW_SIDE]: grassSide('#eef3f7', 10),
  [T.BEDROCK]: (set, rnd) => cells(set, rnd, ['#3a3a3d', '#545458', '#2a2a2c', '#66666a'], '#1d1d1f', 12),
  [T.LAMP]: (set, rnd) => {
    const glow = hex('#ffd77a'), core = hex('#fff1c4'), frame = hex('#8a6a3a');
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
      const edge = x < 2 || y < 2 || x > 13 || y > 13;
      const d = Math.hypot(x - 7.5, y - 7.5);
      set(x, y, edge ? frame : d < 3.5 ? core : glow, 255, edge ? 12 : 16);
    }
  },
  [T.CLAY]: (set, rnd) => { fill(set, rnd, '#9aa3b1', 12); speckle(set, rnd, '#8a93a1', 0.12, 6); },
};

export function buildTextures() {
  const strip = document.createElement('canvas');
  strip.width = S; strip.height = S * TILE_COUNT;
  const ctx = strip.getContext('2d');
  const tiles = [];
  for (let i = 0; i < TILE_COUNT; i++) {
    const img = new ImageData(makeTile(painters[i], i + 1), S, S);
    ctx.putImageData(img, 0, i * S);
    const c = document.createElement('canvas');
    c.width = S; c.height = S;
    c.getContext('2d').putImageData(img, 0, 0);
    tiles.push(c);
  }
  return { strip, tiles, size: S };
}

// Small isometric cube icon for the hotbar / block picker.
export function blockIcon(block, tiles, px = 48) {
  const c = document.createElement('canvas');
  c.width = px; c.height = px;
  const g = c.getContext('2d');
  g.imageSmoothingEnabled = false;
  const k = px / 48;
  const face = (tile, m, shade) => {
    g.setTransform(m[0] * k, m[1] * k, m[2] * k, m[3] * k, m[4] * k, m[5] * k);
    let src = tiles[tile];
    if (shade) {
      src = document.createElement('canvas'); src.width = src.height = 16;
      const s = src.getContext('2d');
      s.drawImage(tiles[tile], 0, 0);
      s.globalCompositeOperation = 'source-atop';
      s.fillStyle = `rgba(0,0,0,${shade})`; s.fillRect(0, 0, 16, 16);
    }
    g.drawImage(src, 0, 0);
  };
  const [side, , top] = block.tiles;
  face(top, [1.25, -0.625, 1.25, 0.625, 4, 13], 0);
  face(side, [1.25, 0.625, 0, 1.375, 4, 13], 0.18);
  face(side, [1.25, -0.625, 0, 1.375, 24, 23], 0.34);
  g.setTransform(1, 0, 0, 1, 0, 0);
  return c;
}
