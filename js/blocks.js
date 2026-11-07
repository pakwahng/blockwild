// Block definitions. Tile numbers index layers of the texture array (see textures.js).

export const T = {
  GRASS_TOP: 0, GRASS_SIDE: 1, DIRT: 2, STONE: 3, SAND: 4, LOG_SIDE: 5, LOG_TOP: 6,
  LEAVES: 7, PLANKS: 8, GLASS: 9, WATER: 10, COBBLE: 11, BRICK: 12, SNOW: 13,
  SNOW_SIDE: 14, BEDROCK: 15, LAMP: 16, CLAY: 17, HAY_SIDE: 18, HAY_TOP: 19, ROOF: 20, CREAM: 21,
};
export const TILE_COUNT = 22;

export const B = {
  AIR: 0, GRASS: 1, DIRT: 2, STONE: 3, SAND: 4, LOG: 5, LEAVES: 6, PLANKS: 7,
  GLASS: 8, WATER: 9, COBBLE: 10, BRICK: 11, SNOW: 12, BEDROCK: 13, LAMP: 14, CLAY: 15,
  HAY: 16, ROOF: 17, CREAM: 18,
};

// kind: 'opaque' | 'cutout' (alpha-tested, e.g. leaves) | 'liquid' (translucent pass)
const defs = [
  { id: B.AIR, name: 'Air', kind: 'air' },
  { id: B.GRASS, name: 'Grass', kind: 'opaque', top: T.GRASS_TOP, side: T.GRASS_SIDE, bottom: T.DIRT, hard: 0.45 },
  { id: B.DIRT, name: 'Dirt', kind: 'opaque', all: T.DIRT, hard: 0.4 },
  { id: B.STONE, name: 'Stone', kind: 'opaque', all: T.STONE, hard: 0.9 },
  { id: B.SAND, name: 'Sand', kind: 'opaque', all: T.SAND, hard: 0.35 },
  { id: B.LOG, name: 'Log', kind: 'opaque', top: T.LOG_TOP, side: T.LOG_SIDE, bottom: T.LOG_TOP, hard: 0.7 },
  { id: B.LEAVES, name: 'Leaves', kind: 'opaque', all: T.LEAVES, hard: 0.2, round: 0.34 },
  { id: B.PLANKS, name: 'Wood', kind: 'opaque', all: T.PLANKS, hard: 0.6 },
  { id: B.GLASS, name: 'Glass', kind: 'cutout', all: T.GLASS, hard: 0.25, round: 0.06 },
  { id: B.WATER, name: 'Water', kind: 'liquid', all: T.WATER, hard: 0, round: 0 },
  { id: B.COBBLE, name: 'Cobble', kind: 'opaque', all: T.COBBLE, hard: 0.9 },
  { id: B.BRICK, name: 'Brick', kind: 'opaque', all: T.BRICK, hard: 0.9 },
  { id: B.SNOW, name: 'Snow', kind: 'opaque', top: T.SNOW, side: T.SNOW_SIDE, bottom: T.DIRT, hard: 0.35 },
  { id: B.BEDROCK, name: 'Bedrock', kind: 'opaque', all: T.BEDROCK, hard: Infinity },
  { id: B.LAMP, name: 'Lamp', kind: 'opaque', all: T.LAMP, hard: 0.4, glow: true },
  { id: B.CLAY, name: 'Clay', kind: 'opaque', all: T.CLAY, hard: 0.5 },
  { id: B.HAY, name: 'Hay', kind: 'opaque', top: T.HAY_TOP, side: T.HAY_SIDE, bottom: T.HAY_TOP, hard: 0.3, round: 0.15 },
  { id: B.ROOF, name: 'Roof', kind: 'opaque', all: T.ROOF, hard: 0.6, round: 0.16 },
  { id: B.CREAM, name: 'Wall', kind: 'opaque', all: T.CREAM, hard: 0.6 },
];

export const BLOCKS = [];
for (const d of defs) {
  const top = d.top ?? d.all, side = d.side ?? d.all, bottom = d.bottom ?? d.all;
  // round: bevel radius used by the mesher for the soft, toy-like edges
  BLOCKS[d.id] = { round: 0.12, ...d, tiles: [side, side, top, bottom, side, side] }; // +x -x +y -y +z -z
}

// Fast lookup tables for the mesher and physics.
export const OPAQUE = new Uint8Array(256);   // hides neighbour faces, casts AO
export const SOLID = new Uint8Array(256);    // collides with the player
export const KIND = new Uint8Array(256);     // 0 air, 1 opaque, 2 cutout, 3 liquid
for (const b of BLOCKS) {
  if (!b) continue;
  OPAQUE[b.id] = b.kind === 'opaque' ? 1 : 0;
  SOLID[b.id] = b.kind === 'opaque' || b.kind === 'cutout' ? 1 : 0;
  KIND[b.id] = { air: 0, opaque: 1, cutout: 2, liquid: 3 }[b.kind];
}

export const PLACEABLE = [B.GRASS, B.DIRT, B.PLANKS, B.LOG, B.HAY, B.ROOF, B.CREAM, B.BRICK,
  B.STONE, B.COBBLE, B.GLASS, B.LEAVES, B.SAND, B.SNOW, B.CLAY, B.LAMP, B.WATER];
export const DEFAULT_HOTBAR = [B.GRASS, B.DIRT, B.PLANKS, B.LOG, B.HAY, B.ROOF, B.CREAM, B.GLASS, B.LAMP];
