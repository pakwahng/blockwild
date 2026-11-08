// Soft "clay toy" block textures, painted procedurally at 32x32.
// Returns a vertical strip canvas (S x S*N) for the WebGL texture array, plus per-tile canvases for UI icons.
import { T, TILE_COUNT } from './blocks.js';
import { makeRng } from './noise.js';

const S = 32;

const hex = c => [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16)];
const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const scale = (c, k) => [c[0] * k, c[1] * k, c[2] * k];
const sstep = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const clamp = v => Math.max(0, Math.min(255, Math.round(v)));

// Soft edge darkening so neighbouring blocks read as separate rounded tiles.
function rim(u, v, width = 0.09, depth = 0.16) {
  const d = Math.min(u, 1 - u, v, 1 - v);
  const k = 1 - depth * (1 - sstep(0, width, d));
  const hi = 1 + 0.06 * (1 - sstep(0.02, 0.2, Math.min(u, v))) * sstep(0, width, d); // faint top-left sheen
  return k * hi;
}

// Rounded blobs (wrapping), like the soft spots on the clay hill blocks.
function blobs(rnd, n, rMin, rMax) {
  const list = [];
  for (let i = 0; i < n; i++) list.push([rnd(), rnd(), rMin + rnd() * (rMax - rMin), 0.6 + rnd() * 0.8, rnd()]);
  return (u, v) => {
    let best = 0, tag = 0;
    for (const [bx, by, r, squash, t] of list) {
      for (let ox = -1; ox <= 1; ox++) for (let oy = -1; oy <= 1; oy++) {
        const dx = u - bx - ox, dy = (v - by - oy) * squash;
        const c = 1 - sstep(r * 0.7, r, Math.hypot(dx, dy));
        if (c > best) { best = c; tag = t; }
      }
    }
    return [best, tag];
  };
}

function woodGrain(rnd, lines, vertical) {
  const ph = [];
  for (let i = 0; i < lines; i++) ph.push([rnd(), 0.5 + rnd() * 1.5, rnd() * 6.28]);
  return (u, v) => {
    const [a, b] = vertical ? [u, v] : [v, u];
    let g = 0;
    for (const [off, amp, p] of ph) {
      const center = off + 0.025 * amp * Math.sin(b * 6.28 * 1.5 + p);
      const d = Math.abs(((a - center + 1.5) % 1) - 0.5);
      g = Math.max(g, 1 - sstep(0.006, 0.02, d));
    }
    return g;
  };
}

const painters = {
  [T.GRASS_TOP]: rnd => {
    const base = hex('#62c24a'), dark = hex('#4fae3e'), light = hex('#7fd35f');
    const spots = blobs(rnd, 7, 0.08, 0.16);
    return (u, v) => {
      const [b, t] = spots(u, v);
      return scale(mix(base, t > 0.5 ? light : dark, b * 0.55), rim(u, v));
    };
  },
  [T.GRASS_SIDE]: rnd => {
    const dirt = painters[T.DIRT](rnd), green = hex('#62c24a');
    const waves = [rnd() * 6.28, rnd() * 6.28];
    return (u, v) => {
      const edge = 0.3 + 0.05 * Math.sin(u * 6.28 * 2 + waves[0]) + 0.03 * Math.sin(u * 6.28 * 3 + waves[1]);
      const g = 1 - sstep(edge - 0.02, edge + 0.02, v);
      const drop = 0.88 + 0.12 * sstep(0, edge, v); // slight shadow under the lip
      return mix(scale(dirt(u, v), v > edge ? 1 : drop), scale(green, rim(u, v)), g);
    };
  },
  [T.DIRT]: rnd => {
    const base = hex('#b0744a'), dark = hex('#99613b'), light = hex('#c08657');
    const spots = blobs(rnd, 6, 0.07, 0.13);
    return (u, v) => { const [b, t] = spots(u, v); return scale(mix(base, t > 0.5 ? light : dark, b * 0.6), rim(u, v)); };
  },
  [T.STONE]: rnd => {
    const base = hex('#a3acb6'), dark = hex('#8e98a3'), light = hex('#b7bfc7');
    const spots = blobs(rnd, 6, 0.09, 0.18);
    return (u, v) => { const [b, t] = spots(u, v); return scale(mix(base, t > 0.5 ? light : dark, b * 0.7), rim(u, v)); };
  },
  [T.SAND]: rnd => {
    const base = hex('#f3dca2'), dark = hex('#e6cb8c');
    const spots = blobs(rnd, 8, 0.04, 0.08);
    return (u, v) => scale(mix(base, dark, spots(u, v)[0] * 0.6), rim(u, v, 0.08, 0.1));
  },
  [T.LOG_SIDE]: rnd => {
    const base = hex('#9a6238'), dark = hex('#7d4c2a');
    const grain = woodGrain(rnd, 5, true);
    return (u, v) => scale(mix(base, dark, grain(u, v) * 0.8), rim(u, v, 0.08, 0.12));
  },
  [T.LOG_TOP]: () => {
    const ring = hex('#e2b06e'), ring2 = hex('#cf9a58'), bark = hex('#8a5631');
    return (u, v) => {
      const d = Math.hypot(u - 0.5, v - 0.5);
      if (d > 0.42) return scale(bark, rim(u, v));
      return mix(ring, ring2, 0.5 + 0.5 * Math.sin(d * 48));
    };
  },
  [T.LEAVES]: rnd => {
    const base = hex('#4caa3c'), dark = hex('#3e9431'), light = hex('#6cc152');
    const spots = blobs(rnd, 6, 0.1, 0.17);
    return (u, v) => {
      const [b, t] = spots(u, v);
      const ring = b > 0.05 && b < 0.6 ? 0.3 : 0; // soft circle outlines like the puffy trees
      return scale(mix(mix(base, t > 0.5 ? light : dark, b * 0.6), dark, ring), rim(u, v, 0.1, 0.1));
    };
  },
  [T.PLANKS]: rnd => {
    const tones = ['#e6a65c', '#f0bd6a', '#d8924e', '#eeb070'].map(hex);
    const base = tones[Math.floor(rnd() * tones.length)], dark = scale(base, 0.82);
    const grain = woodGrain(rnd, 4, false);
    return (u, v) => scale(mix(base, dark, grain(u, v) * 0.7), rim(u, v, 0.1, 0.2));
  },
  [T.GLASS]: () => {
    const frame = hex('#e8f6fb');
    return (u, v) => {
      const d = Math.min(u, 1 - u, v, 1 - v);
      if (d < 0.07) return [...frame, 255];
      const streak = Math.abs((u - v) - 0.25) < 0.05 || Math.abs((u - v) - 0.4) < 0.025;
      return streak ? [255, 255, 255, 140] : [200, 235, 250, 40];
    };
  },
  [T.WATER]: () => {
    const base = hex('#4aa6e6'), light = hex('#7cc4f2');
    return (u, v) => {
      const w = Math.sin((u + v * 0.5) * 12.6) + Math.sin(v * 15 - u * 5);
      return [...mix(base, light, sstep(0.9, 1.4, w)), 170];
    };
  },
  [T.COBBLE]: rnd => {
    const stones = [];
    for (let i = 0; i < 6; i++) stones.push([rnd(), rnd(), mix(hex('#a9b1ba'), hex('#c2c8ce'), rnd())]);
    const mortar = hex('#7d858e');
    return (u, v) => {
      let best = 9, second = 9, col = mortar;
      for (const [x, y, c] of stones) for (let ox = -1; ox <= 1; ox++) for (let oy = -1; oy <= 1; oy++) {
        const d = Math.hypot(u - x - ox, v - y - oy);
        if (d < best) { second = best; best = d; col = c; } else if (d < second) second = d;
      }
      const edge = sstep(0.02, 0.07, second - best);
      return scale(mix(mortar, scale(col, 1.05 - best * 0.4), edge), rim(u, v));
    };
  },
  [T.BRICK]: () => {
    const brick = hex('#d8564a'), mortar = hex('#f0dcc8');
    return (u, v) => {
      const row = Math.floor(v * 4), off = row % 2 ? 0.25 : 0;
      const fu = (u + off) % 0.5 / 0.5, fv = (v * 4) % 1;
      const d = Math.min(fu, 1 - fu, fv, 1 - fv);
      const t = sstep(0.04, 0.12, d);
      return scale(mix(mortar, scale(brick, 0.92 + 0.08 * fv), t), rim(u, v, 0.06, 0.1));
    };
  },
  [T.SNOW]: rnd => {
    const base = hex('#f4f8fb'), dark = hex('#e2ebf2');
    const spots = blobs(rnd, 6, 0.08, 0.14);
    return (u, v) => scale(mix(base, dark, spots(u, v)[0] * 0.6), rim(u, v, 0.09, 0.08));
  },
  [T.SNOW_SIDE]: rnd => {
    const dirt = painters[T.DIRT](rnd), snow = hex('#f4f8fb');
    return (u, v) => {
      const edge = 0.28 + 0.06 * Math.sin(u * 12.6);
      return mix(dirt(u, v), snow, 1 - sstep(edge - 0.02, edge + 0.02, v));
    };
  },
  [T.BEDROCK]: rnd => {
    const spots = blobs(rnd, 8, 0.08, 0.16);
    return (u, v) => { const [b, t] = spots(u, v); return mix(hex('#4a4d55'), t > 0.5 ? hex('#5e626b') : hex('#383a40'), b); };
  },
  [T.LAMP]: () => {
    const core = hex('#fff6d6'), glow = hex('#ffd36b'), frame = hex('#b07a3a');
    return (u, v) => {
      const d = Math.min(u, 1 - u, v, 1 - v);
      if (d < 0.1) return frame;
      return mix(core, glow, sstep(0.05, 0.4, Math.hypot(u - 0.5, v - 0.5)));
    };
  },
  [T.CLAY]: rnd => {
    const base = hex('#b7c0d8'), dark = hex('#a3acc6');
    const spots = blobs(rnd, 6, 0.08, 0.14);
    return (u, v) => scale(mix(base, dark, spots(u, v)[0] * 0.6), rim(u, v));
  },
  [T.HAY_SIDE]: rnd => {
    const base = hex('#f2c35a'), dark = hex('#d9a53e'), band = hex('#b5843a');
    const straws = [];
    for (let i = 0; i < 18; i++) straws.push([rnd(), rnd(), rnd() * 0.3 + 0.1]);
    return (u, v) => {
      let s = 0;
      for (const [x, y, len] of straws) {
        const dy = v - y, dx = u - x;
        if (Math.abs(dy) < 0.012 && dx > 0 && dx < len) s = 1;
      }
      const tie = Math.abs(v - 0.5) < 0.04 ? 1 : 0;
      return scale(mix(mix(base, dark, s * 0.6), band, tie), rim(u, v, 0.1, 0.18));
    };
  },
  [T.HAY_TOP]: rnd => {
    const base = hex('#f6cd68'), dark = hex('#dcae48');
    const straws = [];
    for (let i = 0; i < 22; i++) straws.push([rnd(), rnd(), rnd() * 6.28, rnd() * 0.15 + 0.06]);
    return (u, v) => {
      let s = 0;
      for (const [x, y, a, len] of straws) {
        const dx = u - x, dy = v - y, t = dx * Math.cos(a) + dy * Math.sin(a), n = -dx * Math.sin(a) + dy * Math.cos(a);
        if (t > 0 && t < len && Math.abs(n) < 0.01) s = 1;
      }
      return scale(mix(base, dark, s * 0.6), rim(u, v, 0.1, 0.18));
    };
  },
  [T.ROOF]: () => {
    const red = hex('#e2443a'), light = hex('#f26a5a');
    return (u, v) => {
      const fv = (v * 2) % 1, fu = (u * 2) % 1;
      const d = Math.min(fu, 1 - fu, fv, 1 - fv);
      const c = mix(red, light, 0.3 * (1 - fv));
      return scale(c, (0.82 + 0.18 * sstep(0, 0.1, d)) * rim(u, v, 0.06, 0.1));
    };
  },
  [T.CREAM]: rnd => {
    const base = hex('#f4e4c4'), dark = hex('#e8d3ac');
    const grain = woodGrain(rnd, 3, false);
    return (u, v) => scale(mix(base, dark, grain(u, v) * 0.5), rim(u, v, 0.1, 0.16));
  },
  [T.THRONE_TOP]: () => {
    // red velvet cushion with a gold rim and button tufts
    const red = hex('#d8323f'), deep = hex('#a81e2c'), gold = hex('#ffcf3a'), goldDark = hex('#d99a14');
    return (u, v) => {
      const d = Math.min(u, 1 - u, v, 1 - v);
      if (d < 0.11) return scale(mix(goldDark, gold, sstep(0.0, 0.08, d)), rim(u, v, 0.05, 0.2));
      const cu = u - 0.5, cv = v - 0.5, r = Math.hypot(cu, cv);
      let c = mix(red, deep, sstep(0.15, 0.42, r) * 0.6);
      for (const [bx, by] of [[0.33, 0.33], [0.67, 0.33], [0.33, 0.67], [0.67, 0.67]]) {
        const bd = Math.hypot(u - bx, v - by);
        c = mix(c, deep, 1 - sstep(0.02, 0.06, bd));
        if (bd < 0.025) c = gold;
      }
      return c;
    };
  },
  [T.THRONE_SIDE]: rnd => {
    // a hay bale wrapped with a gold band
    const hay = painters[T.HAY_SIDE](rnd), gold = hex('#ffcf3a'), goldDark = hex('#d99a14');
    return (u, v) => {
      if (v < 0.2) return scale(mix(gold, goldDark, sstep(0.12, 0.2, v)), rim(u, v, 0.06, 0.15));
      return hay(u, v);
    };
  },
  [T.MUD]: rnd => {
    const base = hex('#7a4a2e'), dark = hex('#5f3820'), wet = hex('#9a6a48');
    const puddles = blobs(rnd, 5, 0.1, 0.2), shine = blobs(rnd, 6, 0.03, 0.06);
    return (u, v) => {
      const p = puddles(u, v)[0], s = shine(u, v)[0];
      return scale(mix(mix(base, dark, p * 0.7), wet, s * 0.8), rim(u, v, 0.1, 0.2));
    };
  },
  [T.WOOL]: rnd => {
    // fluffy cream wool: lots of little round curls with soft shadows between them
    const base = hex('#fbf6ec'), shade = hex('#e6dccb');
    const curls = blobs(rnd, 14, 0.09, 0.14);
    return (u, v) => {
      const [b] = curls(u, v);
      return scale(mix(shade, base, sstep(0.05, 0.6, b)), rim(u, v, 0.12, 0.14));
    };
  },
};

function makeTile(i) {
  const paint = painters[i](makeRng(i * 7919 + 13));
  const data = new Uint8ClampedArray(S * S * 4);
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const c = paint((x + 0.5) / S, (y + 0.5) / S);
    const k = (y * S + x) * 4;
    data[k] = clamp(c[0]); data[k + 1] = clamp(c[1]); data[k + 2] = clamp(c[2]); data[k + 3] = c.length > 3 ? c[3] : 255;
  }
  return data;
}

export function buildTextures() {
  const strip = document.createElement('canvas');
  strip.width = S; strip.height = S * TILE_COUNT;
  const ctx = strip.getContext('2d');
  const tiles = [];
  for (let i = 0; i < TILE_COUNT; i++) {
    const img = new ImageData(makeTile(i), S, S);
    ctx.putImageData(img, 0, i * S);
    const c = document.createElement('canvas');
    c.width = S; c.height = S;
    c.getContext('2d').putImageData(img, 0, 0);
    tiles.push(c);
  }
  return { strip, tiles, size: S };
}

// Isometric icon for the hotbar / block picker, with rounded corners to match the blocks.
export function blockIcon(block, tiles, px = 48) {
  const c = document.createElement('canvas');
  c.width = px; c.height = px;
  const g = c.getContext('2d');
  g.imageSmoothingEnabled = true;
  const k = px / 48;
  const face = (tile, m, shade) => {
    let src = tiles[tile];
    if (shade) {
      src = document.createElement('canvas'); src.width = src.height = S;
      const s = src.getContext('2d');
      s.drawImage(tiles[tile], 0, 0);
      s.globalCompositeOperation = 'source-atop';
      s.fillStyle = `rgba(40,20,0,${shade})`; s.fillRect(0, 0, S, S);
    }
    g.setTransform(m[0] * k, m[1] * k, m[2] * k, m[3] * k, m[4] * k, m[5] * k);
    g.drawImage(src, 0, 0, 16, 16);
  };
  const [side, , top] = block.tiles;
  g.save();
  // clip to a soft-cornered hexagon so the icon reads as a rounded block
  g.beginPath();
  const pts = [[24, 3], [44, 13], [44, 35], [24, 45], [4, 35], [4, 13]].map(([x, y]) => [x * k, y * k]);
  const r = 4 * k;
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i], n = pts[(i + 1) % pts.length], pr = pts[(i + pts.length - 1) % pts.length];
    const a = [p[0] + (pr[0] - p[0]) * r / Math.hypot(pr[0] - p[0], pr[1] - p[1]), p[1] + (pr[1] - p[1]) * r / Math.hypot(pr[0] - p[0], pr[1] - p[1])];
    const b = [p[0] + (n[0] - p[0]) * r / Math.hypot(n[0] - p[0], n[1] - p[1]), p[1] + (n[1] - p[1]) * r / Math.hypot(n[0] - p[0], n[1] - p[1])];
    if (i === 0) g.moveTo(a[0], a[1]); else g.lineTo(a[0], a[1]);
    g.quadraticCurveTo(p[0], p[1], b[0], b[1]);
  }
  g.closePath();
  g.clip();
  face(top, [1.25, -0.625, 1.25, 0.625, 4, 13], 0);
  face(side, [1.25, 0.625, 0, 1.375, 4, 13], 0.14);
  face(side, [1.25, -0.625, 0, 1.375, 24, 23], 0.28);
  g.restore();
  return c;
}
