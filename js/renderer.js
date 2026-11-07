// WebGL2 renderer: texture array, chunk buffers, frustum culling, block outline.
import { CS, CH } from './world.js';

const VS = `#version 300 es
layout(location=0) in vec3 aPos;
layout(location=1) in vec3 aUV;
layout(location=2) in float aShade;
uniform mat4 uMVP;
uniform vec3 uCam;
uniform float uFogNear, uFogFar, uTime;
uniform int uPass;
out vec3 vUV;
out float vShade;
out float vFog;
void main() {
  gl_Position = uMVP * vec4(aPos, 1.0);
  vUV = aUV;
  if (uPass == 1) vUV.xy += vec2(uTime * 0.03, uTime * 0.017);
  vShade = aShade;
  float d = length(aPos - uCam);
  vFog = clamp((d - uFogNear) / (uFogFar - uFogNear), 0.0, 1.0);
}`;

const FS = `#version 300 es
precision mediump float;
precision highp int;
precision mediump sampler2DArray;
uniform sampler2DArray uTex;
uniform vec3 uFogColor;
uniform vec3 uTint;
uniform int uPass;
in vec3 vUV;
in float vShade;
in float vFog;
out vec4 outColor;
void main() {
  vec4 c = texture(uTex, vUV);
  if (uPass == 0 && c.a < 0.5) discard;
  vec3 col = c.rgb * vShade * uTint;
  col = mix(col, uFogColor, vFog);
  outColor = vec4(col, uPass == 0 ? 1.0 : c.a);
}`;

// Full-screen sky: vertical gradient, warm glow toward the sun and soft drifting clouds.
const SKY_VS = `#version 300 es
out vec2 vNdc;
void main() {
  vec2 p = vec2((gl_VertexID << 1) & 2, gl_VertexID & 2) * 2.0 - 1.0;
  vNdc = p;
  gl_Position = vec4(p, 0.9999, 1.0);
}`;
const SKY_FS = `#version 300 es
precision highp float;
uniform vec3 uRight, uUp, uFwd, uZenith, uHorizon, uSunDir;
uniform vec2 uTan;
uniform float uTime, uClouds;
in vec2 vNdc;
out vec4 outColor;
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float vnoise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x), u.y);
}
void main() {
  vec3 d = normalize(uFwd + vNdc.x * uTan.x * uRight + vNdc.y * uTan.y * uUp);
  float h = clamp(d.y, 0.0, 1.0);
  vec3 col = mix(uHorizon, uZenith, smoothstep(0.0, 0.55, h));
  float sun = max(dot(d, uSunDir), 0.0);
  col += vec3(1.0, 0.85, 0.6) * pow(sun, 12.0) * 0.25;
  if (d.y > 0.0 && uClouds > 0.0) {
    vec2 p = d.xz / (d.y + 0.12) * 1.6 + vec2(uTime * 0.02, uTime * 0.006);
    float n = vnoise(p) * 0.55 + vnoise(p * 2.1 + 3.7) * 0.3 + vnoise(p * 4.3 - 1.3) * 0.15;
    float c = smoothstep(0.52, 0.66, n) * smoothstep(0.02, 0.2, d.y);
    float shade = smoothstep(0.52, 0.8, n);
    vec3 cloud = mix(vec3(0.86, 0.9, 0.97), vec3(1.0), shade);
    col = mix(col, cloud, c * 0.92 * uClouds);
  }
  outColor = vec4(col, 1.0);
}`;

// Instanced models (chicks, seeds, blob shadows) with soft "fuzzy" rim light.
const ENT_VS = `#version 300 es
layout(location=0) in vec3 aPos;
layout(location=1) in vec3 aNormal;
layout(location=2) in vec3 aColor;
layout(location=3) in float aPart;
layout(location=4) in vec4 iPosYaw;
layout(location=5) in vec4 iAnim; // scale, hop, flap, squash
uniform mat4 uMVP;
uniform vec3 uCam;
uniform float uFogNear, uFogFar;
out vec3 vColor;
out float vFog;
vec2 rot(vec2 v, float a) { float c = cos(a), s = sin(a); return vec2(c * v.x - s * v.y, s * v.x + c * v.y); }
void main() {
  vec3 p = aPos, n = aNormal;
  if (aPart > 0.5 && aPart < 2.5) {           // wings flap around their top edge
    float side = aPart < 1.5 ? 1.0 : -1.0;
    vec2 piv = vec2(side * 0.24, 0.36);
    float a = iAnim.z * side;
    p.xy = piv + rot(p.xy - piv, a);
    n.xy = rot(n.xy, a);
  }
  float sq = iAnim.w;
  if (aPart < 2.5) { p.y *= 1.0 + sq; p.xz *= 1.0 - sq * 0.6; }
  p *= iAnim.x;
  float c = cos(iPosYaw.w), s = sin(iPosYaw.w);
  p = vec3(p.x * c + p.z * s, p.y, -p.x * s + p.z * c);
  n = vec3(n.x * c + n.z * s, n.y, -n.x * s + n.z * c);
  p += iPosYaw.xyz + vec3(0.0, iAnim.y, 0.0);
  gl_Position = uMVP * vec4(p, 1.0);
  vec3 L = normalize(vec3(0.45, 0.85, 0.35));
  float diff = max(dot(n, L), 0.0);
  float hemi = 0.5 + 0.5 * n.y;
  vec3 V = normalize(uCam - p);
  float rim = pow(1.0 - max(dot(n, V), 0.0), 2.2);
  vColor = aColor * (0.5 + 0.35 * diff + 0.2 * hemi) + rim * 0.28 * vec3(1.0, 0.97, 0.85);
  vFog = clamp((length(p - uCam) - uFogNear) / (uFogFar - uFogNear), 0.0, 1.0);
}`;
const ENT_FS = `#version 300 es
precision mediump float;
uniform vec3 uFogColor;
uniform float uShadow;
in vec3 vColor;
in float vFog;
out vec4 outColor;
void main() {
  if (uShadow > 0.5) { outColor = vec4(0.0, 0.0, 0.0, 0.22 * (1.0 - vFog)); return; }
  outColor = vec4(mix(vColor, uFogColor, vFog), 1.0);
}`;

const LINE_VS = `#version 300 es
layout(location=0) in vec3 aPos;
uniform mat4 uMVP;
void main() { gl_Position = uMVP * vec4(aPos, 1.0); }`;
const LINE_FS = `#version 300 es
precision mediump float;
uniform vec4 uColor;
out vec4 outColor;
void main() { outColor = uColor; }`;

function compile(gl, vs, fs) {
  const mk = (type, src) => {
    const s = gl.createShader(type);
    gl.shaderSource(s, src); gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
    return s;
  };
  const p = gl.createProgram();
  gl.attachShader(p, mk(gl.VERTEX_SHADER, vs));
  gl.attachShader(p, mk(gl.FRAGMENT_SHADER, fs));
  gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
  const u = {};
  const n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
  for (let i = 0; i < n; i++) { const info = gl.getActiveUniform(p, i); u[info.name] = gl.getUniformLocation(p, info.name); }
  return { p, u };
}

// ---- tiny matrix helpers (column-major) ----
export function perspective(fovy, aspect, near, far) {
  const f = 1 / Math.tan(fovy / 2), nf = 1 / (near - far);
  return new Float32Array([f / aspect, 0, 0, 0, 0, f, 0, 0, 0, 0, (far + near) * nf, -1, 0, 0, 2 * far * near * nf, 0]);
}
export function lookDir(eye, fwd) {
  // right = fwd x up, up' = right x fwd
  let rx = -fwd[2], rz = fwd[0];
  const rl = Math.hypot(rx, rz) || 1; rx /= rl; rz /= rl;
  const ux = -rz * fwd[1], uy = rz * fwd[0] - rx * fwd[2], uz = rx * fwd[1];
  return new Float32Array([
    rx, ux, -fwd[0], 0,
    0, uy, -fwd[1], 0,
    rz, uz, -fwd[2], 0,
    -(rx * eye[0] + rz * eye[2]), -(ux * eye[0] + uy * eye[1] + uz * eye[2]), fwd[0] * eye[0] + fwd[1] * eye[1] + fwd[2] * eye[2], 1,
  ]);
}
export function mul(a, b) {
  const o = new Float32Array(16);
  for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) {
    let s = 0;
    for (let k = 0; k < 4; k++) s += a[k * 4 + r] * b[c * 4 + k];
    o[c * 4 + r] = s;
  }
  return o;
}
function frustumPlanes(m) {
  const planes = [];
  const row = r => [m[r], m[4 + r], m[8 + r], m[12 + r]];
  const r0 = row(0), r1 = row(1), r2 = row(2), r3 = row(3);
  for (const [a, s] of [[r0, 1], [r0, -1], [r1, 1], [r1, -1], [r2, 1], [r2, -1]])
    planes.push([r3[0] + s * a[0], r3[1] + s * a[1], r3[2] + s * a[2], r3[3] + s * a[3]]);
  return planes;
}
function boxVisible(planes, x0, y0, z0, x1, y1, z1) {
  for (const p of planes) {
    const x = p[0] > 0 ? x1 : x0, y = p[1] > 0 ? y1 : y0, z = p[2] > 0 ? z1 : z0;
    if (p[0] * x + p[1] * y + p[2] * z + p[3] < 0) return false;
  }
  return true;
}

export class Renderer {
  constructor(canvas, textures, tileCount) {
    const gl = canvas.getContext('webgl2', { antialias: false, alpha: false, powerPreference: 'high-performance' });
    if (!gl) throw new Error('WebGL2 is not available on this device.');
    this.gl = gl;
    this.canvas = canvas;
    this.prog = compile(gl, VS, FS);
    this.line = compile(gl, LINE_VS, LINE_FS);

    const tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D_ARRAY, tex);
    gl.texImage3D(gl.TEXTURE_2D_ARRAY, 0, gl.RGBA, textures.size, textures.size, tileCount, 0, gl.RGBA, gl.UNSIGNED_BYTE, textures.strip);
    gl.generateMipmap(gl.TEXTURE_2D_ARRAY);
    gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_MAX_LEVEL, 4);
    this.tex = tex;

    this.sky = compile(gl, SKY_VS, SKY_FS);
    this.skyVao = gl.createVertexArray();
    this.ent = compile(gl, ENT_VS, ENT_FS);
    this.models = {};

    // block outline (12 edges, slightly inflated)
    const e = 0.004, a = -e, b = 1 + e;
    const P = [[a, a, a], [b, a, a], [b, b, a], [a, b, a], [a, a, b], [b, a, b], [b, b, b], [a, b, b]];
    const E = [0, 1, 1, 2, 2, 3, 3, 0, 4, 5, 5, 6, 6, 7, 7, 4, 0, 4, 1, 5, 2, 6, 3, 7];
    const lines = new Float32Array(E.flatMap(i => P[i]));
    this.lineVao = gl.createVertexArray();
    gl.bindVertexArray(this.lineVao);
    const lb = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, lb);
    gl.bufferData(gl.ARRAY_BUFFER, lines, gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 0, 0);
    gl.bindVertexArray(null);

    gl.enable(gl.DEPTH_TEST);
    gl.enable(gl.CULL_FACE);
    gl.cullFace(gl.BACK);
    gl.frontFace(gl.CCW);
    this.stats = { chunks: 0, tris: 0 };
  }

  // Registers a model ({verts, idx} from models.js) for instanced drawing.
  addModel(name, mesh) {
    const gl = this.gl;
    const vao = gl.createVertexArray();
    gl.bindVertexArray(vao);
    const vb = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vb);
    gl.bufferData(gl.ARRAY_BUFFER, mesh.verts, gl.STATIC_DRAW);
    const stride = 40;
    gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 3, gl.FLOAT, false, stride, 0);
    gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1, 3, gl.FLOAT, false, stride, 12);
    gl.enableVertexAttribArray(2); gl.vertexAttribPointer(2, 3, gl.FLOAT, false, stride, 24);
    gl.enableVertexAttribArray(3); gl.vertexAttribPointer(3, 1, gl.FLOAT, false, stride, 36);
    const ib = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ib);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, mesh.idx, gl.STATIC_DRAW);
    const inst = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, inst);
    gl.bufferData(gl.ARRAY_BUFFER, 4096, gl.DYNAMIC_DRAW);
    gl.enableVertexAttribArray(4); gl.vertexAttribPointer(4, 4, gl.FLOAT, false, 32, 0); gl.vertexAttribDivisor(4, 1);
    gl.enableVertexAttribArray(5); gl.vertexAttribPointer(5, 4, gl.FLOAT, false, 32, 16); gl.vertexAttribDivisor(5, 1);
    gl.bindVertexArray(null);
    this.models[name] = { vao, inst, instSize: 4096, count: mesh.idx.length };
  }

  drawModel(name, data, n) {
    if (!n) return;
    const gl = this.gl, m = this.models[name];
    gl.bindVertexArray(m.vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, m.inst);
    const bytes = n * 32;
    if (bytes > m.instSize) { m.instSize = bytes * 2; gl.bufferData(gl.ARRAY_BUFFER, m.instSize, gl.DYNAMIC_DRAW); }
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, data, 0, n * 8);
    gl.drawElementsInstanced(gl.TRIANGLES, m.count, gl.UNSIGNED_SHORT, 0, n);
  }

  resize(pixelRatio) {
    const c = this.canvas;
    const w = Math.round(c.clientWidth * pixelRatio), h = Math.round(c.clientHeight * pixelRatio);
    if (c.width !== w || c.height !== h) { c.width = w; c.height = h; }
  }

  makePart(mesh) {
    if (!mesh.idx.length) return null;
    const gl = this.gl;
    const vao = gl.createVertexArray();
    gl.bindVertexArray(vao);
    const vb = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vb);
    gl.bufferData(gl.ARRAY_BUFFER, mesh.verts, gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 28, 0);
    gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1, 3, gl.FLOAT, false, 28, 12);
    gl.enableVertexAttribArray(2); gl.vertexAttribPointer(2, 1, gl.FLOAT, false, 28, 24);
    const ib = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ib);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, mesh.idx, gl.STATIC_DRAW);
    gl.bindVertexArray(null);
    return { vao, vb, ib, count: mesh.idx.length };
  }

  freePart(part) {
    if (!part) return;
    const gl = this.gl;
    gl.deleteVertexArray(part.vao); gl.deleteBuffer(part.vb); gl.deleteBuffer(part.ib);
  }

  upload(chunk, mesh) {
    this.free(chunk);
    chunk.gpu = { opaque: this.makePart(mesh.opaque), liquid: this.makePart(mesh.liquid) };
  }

  free(chunk) {
    if (!chunk.gpu) return;
    this.freePart(chunk.gpu.opaque); this.freePart(chunk.gpu.liquid);
    chunk.gpu = null;
  }

  render(view, chunks, target, time, ents = null) {
    const gl = this.gl, { prog } = this;
    gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    const fog = view.fogColor;
    gl.clearColor(fog[0], fog[1], fog[2], 1);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    const aspect = this.canvas.width / this.canvas.height;
    const proj = perspective(view.fov, aspect, 0.08, view.fogFar + 32);
    const viewM = lookDir(view.eye, view.forward);
    const mvp = mul(proj, viewM);
    const planes = frustumPlanes(mvp);

    // sky
    const sk = this.sky;
    gl.useProgram(sk.p);
    gl.disable(gl.DEPTH_TEST);
    gl.uniform3f(sk.u.uRight, viewM[0], viewM[4], viewM[8]);
    gl.uniform3f(sk.u.uUp, viewM[1], viewM[5], viewM[9]);
    gl.uniform3fv(sk.u.uFwd, view.forward);
    const ty = Math.tan(view.fov / 2);
    gl.uniform2f(sk.u.uTan, ty * aspect, ty);
    gl.uniform3fv(sk.u.uZenith, view.zenith);
    gl.uniform3fv(sk.u.uHorizon, fog);
    gl.uniform3fv(sk.u.uSunDir, view.sunDir);
    gl.uniform1f(sk.u.uTime, time);
    gl.uniform1f(sk.u.uClouds, view.clouds);
    gl.bindVertexArray(this.skyVao);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.enable(gl.DEPTH_TEST);

    const visible = [];
    for (const c of chunks) {
      if (!c.gpu) continue;
      const x0 = c.cx * CS, z0 = c.cz * CS;
      const dx = x0 + CS / 2 - view.eye[0], dz = z0 + CS / 2 - view.eye[2];
      const d2 = dx * dx + dz * dz;
      if (d2 > (view.fogFar + CS) ** 2) continue;
      if (!boxVisible(planes, x0, 0, z0, x0 + CS, CH, z0 + CS)) continue;
      visible.push({ c, d2 });
    }
    visible.sort((a, b) => a.d2 - b.d2);

    gl.useProgram(prog.p);
    gl.uniformMatrix4fv(prog.u.uMVP, false, mvp);
    gl.uniform3fv(prog.u.uCam, view.eye);
    gl.uniform1f(prog.u.uFogNear, view.fogNear);
    gl.uniform1f(prog.u.uFogFar, view.fogFar);
    gl.uniform1f(prog.u.uTime, time);
    gl.uniform3fv(prog.u.uFogColor, fog);
    gl.uniform3fv(prog.u.uTint, view.tint);
    gl.uniform1i(prog.u.uTex, 0);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D_ARRAY, this.tex);

    let tris = 0;
    gl.uniform1i(prog.u.uPass, 0);
    for (const { c } of visible) {
      const part = c.gpu.opaque;
      if (!part) continue;
      gl.bindVertexArray(part.vao);
      gl.drawElements(gl.TRIANGLES, part.count, gl.UNSIGNED_INT, 0);
      tris += part.count / 3;
    }

    // block outline
    if (target) {
      gl.useProgram(this.line.p);
      const t = new Float32Array(16); t[0] = t[5] = t[10] = t[15] = 1;
      t[12] = target.x; t[13] = target.y; t[14] = target.z;
      gl.uniformMatrix4fv(this.line.u.uMVP, false, mul(mvp, t));
      gl.uniform4f(this.line.u.uColor, 0.05, 0.05, 0.08, 1);
      gl.bindVertexArray(this.lineVao);
      gl.drawArrays(gl.LINES, 0, 24);
      gl.useProgram(prog.p);
    }

    // chicks, seeds and their soft shadows
    if (ents) {
      const e = this.ent;
      gl.useProgram(e.p);
      gl.uniformMatrix4fv(e.u.uMVP, false, mvp);
      gl.uniform3fv(e.u.uCam, view.eye);
      gl.uniform1f(e.u.uFogNear, view.fogNear);
      gl.uniform1f(e.u.uFogFar, view.fogFar);
      gl.uniform3fv(e.u.uFogColor, fog);
      gl.uniform1f(e.u.uShadow, 0);
      this.drawModel('chick', ents.chicks, ents.chickCount);
      this.drawModel('seed', ents.seeds, ents.seedCount);
      gl.uniform1f(e.u.uShadow, 1);
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
      gl.depthMask(false);
      gl.enable(gl.POLYGON_OFFSET_FILL);
      gl.polygonOffset(-2, -2);
      gl.disable(gl.CULL_FACE);
      this.drawModel('shadow', ents.shadows, ents.shadowCount);
      gl.enable(gl.CULL_FACE);
      gl.disable(gl.POLYGON_OFFSET_FILL);
      gl.depthMask(true);
      gl.disable(gl.BLEND);
      gl.useProgram(prog.p);
    }
    this.mvp = mvp;

    // translucent water, back to front
    gl.uniform1i(prog.u.uPass, 1);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.depthMask(false);
    gl.disable(gl.CULL_FACE);
    for (let i = visible.length - 1; i >= 0; i--) {
      const part = visible[i].c.gpu.liquid;
      if (!part) continue;
      gl.bindVertexArray(part.vao);
      gl.drawElements(gl.TRIANGLES, part.count, gl.UNSIGNED_INT, 0);
      tris += part.count / 3;
    }
    gl.enable(gl.CULL_FACE);
    gl.depthMask(true);
    gl.disable(gl.BLEND);
    gl.bindVertexArray(null);
    this.stats.chunks = visible.length;
    this.stats.tris = tris;
  }
}
