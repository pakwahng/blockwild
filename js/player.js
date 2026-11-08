// Player movement, AABB collision against blocks, and block raycasting.
import { SOLID, KIND, B } from './blocks.js';

const HALF = 0.3, HEIGHT = 1.8, EYE = 1.62;
const GRAVITY = 28, JUMP_V = 8.8;

export class Player {
  constructor(x, y, z) {
    this.pos = [x, y, z];
    this.vel = [0, 0, 0];
    this.yaw = 0;
    this.pitch = 0;
    this.onGround = false;
    this.flying = false;
    this.inWater = false;
    this.autoJump = true;
  }

  eye() { return [this.pos[0], this.pos[1] + EYE, this.pos[2]]; }
  forward() {
    const cp = Math.cos(this.pitch);
    return [-Math.sin(this.yaw) * cp, Math.sin(this.pitch), -Math.cos(this.yaw) * cp];
  }

  intersectsBlock(x, y, z) {
    const p = this.pos;
    return p[0] + HALF > x && p[0] - HALF < x + 1 && p[1] + HEIGHT > y && p[1] < y + 1 && p[2] + HALF > z && p[2] - HALF < z + 1;
  }

  update(dt, input, world) {
    const p = this.pos, v = this.vel;
    const feet = world.getBlock(Math.floor(p[0]), Math.floor(p[1] + 0.4), Math.floor(p[2]));
    this.inWater = feet === B.WATER;

    // desired horizontal velocity from input, relative to view yaw
    const sy = Math.sin(this.yaw), cy = Math.cos(this.yaw);
    let mx = input.moveX, mz = input.moveZ;
    const len = Math.hypot(mx, mz);
    if (len > 1) { mx /= len; mz /= len; }
    let speed = this.flying ? (input.sprint ? 16 : 9) : input.sprint ? 5.8 : 4.4;
    if (this.inWater && !this.flying) speed *= 0.55;
    speed *= (this.slow ?? 1) * (this.boost || 1);   // stuck in poison goo; full of bread or pie
    const wx = (-sy * mz + cy * mx) * speed, wz = (-cy * mz - sy * mx) * speed;
    const accel = this.onGround || this.flying ? 14 : this.inWater ? 6 : 3.5;
    const k = 1 - Math.exp(-accel * dt);
    v[0] += (wx - v[0]) * k;
    v[2] += (wz - v[2]) * k;

    // on a ladder: walk into it or press jump to climb, fly-down to go down, otherwise slide slowly
    const onLadder = !this.flying && [0.1, 0.9].some(h => world.getBlock(Math.floor(p[0]), Math.floor(p[1] + h), Math.floor(p[2])) === B.LADDER);
    this.onLadder = onLadder;
    if (onLadder) {
      const up = input.jump || input.moveZ > 0.3;
      v[1] = up ? 3.6 : input.down ? -3.6 : Math.max(v[1] - GRAVITY * dt, -1.6);
    } else if (this.flying) {
      const vy = ((input.jump ? 1 : 0) - (input.down ? 1 : 0)) * (input.sprint ? 12 : 7);
      v[1] += (vy - v[1]) * (1 - Math.exp(-10 * dt));
    } else if (this.inWater) {
      v[1] -= GRAVITY * 0.3 * dt;
      v[1] *= Math.exp(-2.5 * dt);
      if (input.jump) v[1] = Math.min(v[1] + 30 * dt, 3.8);
    } else {
      v[1] = Math.max(v[1] - GRAVITY * dt, -55);
      if (input.jump && this.onGround) v[1] = JUMP_V * (this.spring || 1); // spring: a snack of grilled fish or pie
    }

    // integrate with sub-steps so nothing tunnels through blocks
    const steps = Math.max(1, Math.ceil(Math.max(Math.abs(v[0]), Math.abs(v[1]), Math.abs(v[2])) * dt / 0.35));
    const sdt = dt / steps;
    this.onGround = false;
    let bump = false;
    for (let s = 0; s < steps; s++) {
      bump = this.moveAxis(world, 1, v[1] * sdt) || bump;
      bump = this.moveAxis(world, 0, v[0] * sdt) || bump;
      bump = this.moveAxis(world, 2, v[2] * sdt) || bump;
    }
    const moving = Math.hypot(input.moveX, input.moveZ) > 0.1;
    if (bump && this.autoJump && moving && this.onGround && !this.flying && !this.inWater) v[1] = JUMP_V;
  }

  // Moves along one axis; returns true when a horizontal step-up obstacle was hit.
  moveAxis(world, axis, d) {
    if (!d) return false;
    const p = this.pos;
    p[axis] += d;
    const x0 = Math.floor(p[0] - HALF), x1 = Math.floor(p[0] + HALF - 1e-7);
    const y0 = Math.floor(p[1]), y1 = Math.floor(p[1] + HEIGHT - 1e-7);
    const z0 = Math.floor(p[2] - HALF), z1 = Math.floor(p[2] + HALF - 1e-7);
    let stepUp = false;
    for (let y = y0; y <= y1; y++) for (let z = z0; z <= z1; z++) for (let x = x0; x <= x1; x++) {
      if (!SOLID[world.getBlock(x, y, z)]) continue;
      if (axis === 1) {
        if (d > 0) p[1] = y - HEIGHT - 1e-4;
        else { p[1] = y + 1; this.onGround = true; }
        this.vel[1] = 0;
        return false;
      }
      const b = axis === 0 ? x : z;
      p[axis] = d > 0 ? b - HALF - 1e-4 : b + 1 + HALF + 1e-4;
      this.vel[axis] = 0;
      if (y === y0 && !SOLID[world.getBlock(x, y + 1, z)] && !SOLID[world.getBlock(x, y + 2, z)]) stepUp = true;
      return stepUp;
    }
    return false;
  }
}

// Voxel DDA raycast. Returns the first non-liquid block hit plus the face normal.
export function raycast(world, o, d, maxDist) {
  let x = Math.floor(o[0]), y = Math.floor(o[1]), z = Math.floor(o[2]);
  const sx = Math.sign(d[0]), sy = Math.sign(d[1]), sz = Math.sign(d[2]);
  const tdx = sx ? Math.abs(1 / d[0]) : Infinity, tdy = sy ? Math.abs(1 / d[1]) : Infinity, tdz = sz ? Math.abs(1 / d[2]) : Infinity;
  let tx = sx ? (sx > 0 ? x + 1 - o[0] : o[0] - x) * tdx : Infinity;
  let ty = sy ? (sy > 0 ? y + 1 - o[1] : o[1] - y) * tdy : Infinity;
  let tz = sz ? (sz > 0 ? z + 1 - o[2] : o[2] - z) * tdz : Infinity;
  let nx = 0, ny = 0, nz = 0, t = 0;
  while (t <= maxDist) {
    const id = world.getBlock(x, y, z);
    if (id && KIND[id] !== 3) return { x, y, z, id, nx, ny, nz };
    if (tx < ty && tx < tz) { x += sx; t = tx; tx += tdx; nx = -sx; ny = 0; nz = 0; }
    else if (ty < tz) { y += sy; t = ty; ty += tdy; nx = 0; ny = -sy; nz = 0; }
    else { z += sz; t = tz; tz += tdz; nx = 0; ny = 0; nz = -sz; }
  }
  return null;
}
