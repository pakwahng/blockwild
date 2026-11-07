// Blockwild: bootstrap, game loop, streaming, interaction, UI and saving.
import { B, T, BLOCKS, SOLID, PLACEABLE, TILE_COUNT, DEFAULT_HOTBAR, ITEM_SEEDS, ITEM_SWORD, TREATS, ITEM_NAMES } from './blocks.js';
import { Snakes } from './snakes.js';
import { skyAt, CYCLE } from './sky.js';
import { buildTextures, blockIcon } from './textures.js';
import * as M from './models.js';
import { Nursery, SPECIES, SPECIES_ORDER, isTreat } from './animals.js';
import { Sfx } from './audio.js';
import { World, CS, CH } from './world.js';
import { buildMesh } from './mesher.js';
import { Renderer } from './renderer.js';
import { Player, raycast } from './player.js';
import { Input } from './input.js';

const $ = s => document.querySelector(s);
const SAVE_KEY = 'blockwild.save.v1', SET_KEY = 'blockwild.settings.v1';
const store = {
  get(k) { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch { return false; } },
};

const coarse = matchMedia('(pointer: coarse)').matches;
const settings = Object.assign({ view: coarse ? 5 : 7, sens: 1, autoJump: true, showFps: false, sound: true }, store.get(SET_KEY) || {});
const WATER_FOG = [0.1, 0.24, 0.45];
const REACH = 6;

const canvas = $('#gl');
let textures, renderer;
try {
  textures = buildTextures();
  renderer = new Renderer(canvas, textures, TILE_COUNT);
  renderer.addModel('chick', M.chickModel());
  renderer.addModel('calf', M.calfModel());
  renderer.addModel('piglet', M.pigletModel());
  renderer.addModel('lamb', M.lambModel());
  renderer.addModel('pup', M.pupModel());
  renderer.addModel('seed', M.seedModel());
  renderer.addModel('wheat', M.wheatModel());
  renderer.addModel('apple', M.appleModel());
  renderer.addModel('clover', M.cloverModel());
  renderer.addModel('bone', M.boneModel());
  renderer.addModel('shadow', M.shadowModel());
  renderer.addModel('snakeHead', M.snakeHeadModel());
  renderer.addModel('snakeSeg', M.snakeSegModel());
  M.CONFETTI_COLORS.forEach((c, k) => renderer.addModel('confetti' + k, M.confettiModel(c)));
} catch (err) {
  console.error(err);
  showError('This device or browser cannot run Blockwild (WebGL2 is required). ' + err.message);
}

let world = null, player = null, flock = null, snakes = null, running = false, firsts = [];
let clock = 0.08, nights = 0, swingCool = 0, wasBreaking = false;
let hotbar = [...DEFAULT_HOTBAR];
let selected = 0;
let target = null, breakT = { key: '', p: 0 };
let milestone = 0, throwCool = 0;
const sfx = new Sfx();

const icons = {};
if (textures) for (const id of PLACEABLE) icons[id] = blockIcon(BLOCKS[id], textures.tiles, 64).toDataURL();
for (const id of [...TREATS, ITEM_SWORD]) icons[id] = M.treatIcon(ITEM_NAMES[id].toLowerCase(), 64).toDataURL();
$('#held').src = icons[ITEM_SWORD] || '';
const itemName = id => ITEM_NAMES[id] || BLOCKS[id].name;
const isItem = id => isTreat(id) || id === ITEM_SWORD || !!BLOCKS[id];

// Lines from the song, shown as the nursery grows.
const MILESTONES = [
  [1, 'Your first chick! Feed two of them and a baby hatches.'],
  [10, 'Ten chicks. The nursery is open!'],
  [37, 'Thirty-seven chickens, and they’re all your pride!'],
  [67, 'Sixty-seven chickens! The game’s starting to slide…'],
  [100, 'A hundred deep and wide. Chicken king!'],
];
// The first of each other baby joins with its line from verse two.
const FIRSTS = {
  calf: 'A baby calf! Calves love to munch by the hay.',
  piglet: 'A baby piglet! Piglets love rolling in the mud.',
  lamb: 'A baby lamb, bouncing like a fluffy little stone!',
  pup: 'A wolf pup! Pups wag their tails for a bone.',
};
const EVERYONE = 'Everyone’s invited! Chicks, calves, piglets, lambs and pups.';

// ---------- input ----------
const input = new Input(canvas, {
  stick: $('#stick'), knob: $('#knob'), jump: $('#btn-jump'), down: $('#btn-down'),
  onFly: toggleFly, onPlace: placeBlock, onPicker: openPicker, onPause: pause,
  onHotbarScroll: d => selectSlot((selected + d + 9) % 9),
  onHotbarKey: selectSlot,
});
$('#btn-fly').addEventListener('pointerdown', e => { e.preventDefault(); toggleFly(); });
$('#btn-menu').addEventListener('click', pause);
$('#btn-blocks').addEventListener('click', openPicker);

// ---------- world lifecycle ----------
function freeWorld() {
  if (!world) return;
  for (const c of world.chunks.values()) renderer.free(c);
  world = null;
}

function startWorld(save) {
  freeWorld();
  const seed = save ? save.seed : (Math.random() * 2 ** 31) >>> 0;
  world = new World(seed, World.deserializeEdits(save?.edits));
  let sx = 0.5, sz = 0.5, sy;
  if (save?.pos) [sx, sy, sz] = save.pos;
  else {
    // walk outwards until we find dry land
    outer: for (let r = 0; r < 400; r += 8) for (let a = 0; a < 8; a++) {
      const x = Math.round(Math.cos(a * Math.PI / 4) * r), z = Math.round(Math.sin(a * Math.PI / 4) * r);
      if (world.heightAt(x, z) > 30) { sx = x + 0.5; sz = z + 0.5; break outer; }
    }
  }
  const pcx = Math.floor(sx / CS), pcz = Math.floor(sz / CS);
  for (let dz = -2; dz <= 2; dz++) for (let dx = -2; dx <= 2; dx++) world.generate(pcx + dx, pcz + dz);
  if (sy === undefined) {
    sy = CH - 1;
    while (sy > 1 && !SOLID[world.getBlock(Math.floor(sx), sy - 1, Math.floor(sz))]) sy--;
  }
  player = new Player(sx, sy, sz);
  if (save) { player.yaw = save.yaw || 0; player.pitch = save.pitch || 0; player.flying = !!save.flying; }
  if (save?.hotbar?.length === 9) { hotbar = save.hotbar.filter(isItem); selected = save.selected || 0; }
  if (save && !(save.v >= 2)) {
    // older saves: hand out all the treats at the front of the hotbar
    hotbar = [...TREATS, ...hotbar.filter(id => !isTreat(id))].slice(0, 9);
  }
  if (save && !(save.v >= 3) && !hotbar.includes(ITEM_SWORD)) hotbar[5] = ITEM_SWORD; // the toy sword arrives
  while (hotbar.length < 9) hotbar.push(B.STONE);
  player.autoJump = settings.autoJump;
  document.body.classList.toggle('flying', player.flying);
  $('#btn-fly').classList.toggle('on', player.flying);
  buildHotbar();
  stream(80);

  flock = new Nursery(world);
  if (save?.animals) flock.load(save.animals); else flock.loadChicks(save?.chicks);
  milestone = save?.milestone || 0;
  firsts = save?.firsts || [];
  snakes = new Snakes(world);
  clock = save?.clock ?? 0.08;
  nights = save?.nights || 0;
  // a few wild babies of each kind close by, so there's someone to feed straight away
  for (const sp of SPECIES_ORDER) {
    if (flock.animals.some(a => a.sp === sp)) continue;
    if (sp === 'chick') flock.spawnGroup(sp, sx, sz, 6, 3, 9);
    else flock.spawnGroup(sp, sx, sz, 2, 7, 16);
  }
  shownCounts = null;
  updateNursery();
}

function saveGame() {
  if (!world || !player) return;
  store.set(SAVE_KEY, {
    v: 3, seed: world.seed, clock: +clock.toFixed(4), nights, pos: player.pos.map(v => +v.toFixed(2)), yaw: player.yaw, pitch: player.pitch,
    flying: player.flying, hotbar, selected, edits: world.serializeEdits(),
    animals: flock ? flock.serialize() : [], milestone, firsts,
  });
}

// ---------- nursery: counters, milestones, effects ----------
const nurseryEl = $('#nursery');
const pills = {};
for (const sp of SPECIES_ORDER) {
  const el = document.createElement('div');
  el.className = 'pill';
  el.setAttribute('aria-label', SPECIES[sp].plural + ' in your nursery');
  el.innerHTML = `<svg viewBox="0 0 32 32" aria-hidden="true">${M.FACE_SVG[sp]}</svg><span>0</span>`;
  el.hidden = sp !== 'chick';
  nurseryEl.appendChild(el);
  pills[sp] = el;
}
let shownCounts = null;
function updateNursery() {
  const n = flock ? flock.counts() : {};
  for (const sp of SPECIES_ORDER) {
    const was = shownCounts ? shownCounts[sp] : -1;
    if (n[sp] === was) continue;
    const el = pills[sp];
    el.querySelector('span').textContent = n[sp];
    el.hidden = sp !== 'chick' && !n[sp];
    if (was >= 0 && n[sp] > was) { el.classList.remove('bump'); void el.offsetWidth; el.classList.add('bump'); }
    if (shownCounts && n[sp] > 0 && FIRSTS[sp] && !firsts.includes(sp)) { firsts.push(sp); toast(FIRSTS[sp]); sfx.fanfare(); }
  }
  if (shownCounts && SPECIES_ORDER.every(sp => n[sp] > 0) && !firsts.includes('all')) { firsts.push('all'); toast(EVERYONE); sfx.fanfare(); }
  for (const [at, text] of MILESTONES) {
    if (n.chick >= at && milestone < at) { milestone = at; if (shownCounts) { toast(text); if (at > 1) sfx.fanfare(); } }
  }
  shownCounts = n;
}

let toastTimer = 0;
function toast(text) {
  const t = $('#toast');
  t.textContent = text;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 4200);
}

// Floating hearts and "+1" pops above chicks, positioned by projecting the 3D point to the screen.
function floatFx(p, kind) {
  const m = renderer.mvp;
  if (!m) return;
  const x = p[0], y = p[1] + 0.8, z = p[2];
  const cx = m[0] * x + m[4] * y + m[8] * z + m[12], cy = m[1] * x + m[5] * y + m[9] * z + m[13], cw = m[3] * x + m[7] * y + m[11] * z + m[15];
  if (cw <= 0.1) return;
  const sx = (cx / cw * 0.5 + 0.5) * window.innerWidth, sy = (1 - (cy / cw * 0.5 + 0.5)) * window.innerHeight;
  if (sx < -40 || sy < -40 || sx > window.innerWidth + 40 || sy > window.innerHeight + 40) return;
  const el = document.createElement('div');
  el.className = 'fx ' + kind;
  el.textContent = kind === 'hatch' ? '+1' : kind === 'bonk' ? 'BONK!' : '';
  el.style.left = sx + 'px'; el.style.top = sy + 'px';
  $('#fx').appendChild(el);
  setTimeout(() => el.remove(), 1300);
}

function handleChickEvents() {
  const eye = player.eye();
  for (const ev of flock.events) {
    const d = Math.hypot(ev.p[0] - eye[0], ev.p[1] - eye[1], ev.p[2] - eye[2]);
    if (ev.type === 'call') { if (d < 20) sfx.call(ev.sp, 0.35 * (1 - d / 20)); continue; }
    if (d > 40) continue;
    if (ev.type === 'hatch') { sfx.hatch(); sfx.call(ev.sp, 0.45); floatFx(ev.p, 'hatch'); buzz(20); }
    else if (ev.type === 'splash') { if (d < 16) sfx.splash(); }
    else if (ev.type === 'munch') { if (d < 12) sfx.munch(); }
    else { sfx.happy(); floatFx(ev.p, 'heart'); }
  }
  flock.events.length = 0;

  for (const ev of snakes.events) {
    const d = ev.p ? Math.hypot(ev.p[0] - eye[0], ev.p[1] - eye[1], ev.p[2] - eye[2]) : 0;
    if (ev.type === 'night') {
      sfx.nightfall();
      toast(nights === 0
        ? 'Night falls under the square moon… a block snake is coming for the nursery! Grab your toy sword and guard the gate.'
        : 'Night falls. Watch out for the block snake!');
    } else if (ev.type === 'dawn') {
      nights++;
      sfx.fanfare();
      toast(ev.spooked ? `Sunrise! The snake spooked ${ev.spooked} ${ev.spooked === 1 ? 'baby' : 'babies'}, but the nursery made it.`
        : 'Sunrise! Every baby made it safely through the night.');
    } else if (ev.type === 'hiss') { if (d < 24) sfx.hiss(0.25 * (1 - d / 24)); }
    else if (ev.type === 'spook') {
      sfx.hiss(0.4); sfx.call(ev.sp, 0.5);
      toast(`The snake spooked a ${SPECIES[ev.sp].name} out of your nursery! Feed it again to bring it back.`);
    } else if (ev.type === 'bonk') { sfx.bonk(); floatFx(ev.p, 'bonk'); buzz(30); }
    else if (ev.type === 'poof') {
      sfx.poof(); buzz(60);
      if (!firsts.includes('poof')) { firsts.push('poof'); toast('Swung once, swung twice: bonk! The snake poofed into confetti cubes.'); }
    }
  }
  snakes.events.length = 0;
  updateNursery();
}

// ---------- the toy sword ----------
function swing() {
  if (swingCool > 0) return;
  swingCool = 0.35;
  const held = $('#held');
  held.classList.remove('swing'); void held.offsetWidth; held.classList.add('swing');
  if (!snakes.swing(player.eye(), player.forward())) sfx.whoosh();
}
function updateHeld() { $('#held').hidden = hotbar[selected] !== ITEM_SWORD; }

// ---------- chunk streaming ----------
const OFFSETS = [];
for (let dz = -14; dz <= 14; dz++) for (let dx = -14; dx <= 14; dx++) OFFSETS.push([dx, dz, dx * dx + dz * dz]);
OFFSETS.sort((a, b) => a[2] - b[2]);
let frameNo = 0;

function stream(budgetMs) {
  const t0 = performance.now();
  const pcx = Math.floor(player.pos[0] / CS), pcz = Math.floor(player.pos[2] / CS);
  const R = settings.view, genR2 = (R + 2) ** 2, meshR2 = (R + 0.5) ** 2;
  let pending = 0;
  for (const [dx, dz, d2] of OFFSETS) {
    if (d2 > genR2) break;
    if (world.chunks.has(World.key(pcx + dx, pcz + dz))) continue;
    if (performance.now() - t0 > budgetMs * 0.5) { pending++; break; }
    world.generate(pcx + dx, pcz + dz);
  }
  for (const [dx, dz, d2] of OFFSETS) {
    if (d2 > meshR2) break;
    const c = world.getChunk(pcx + dx, pcz + dz);
    if (!c || !c.dirty || !world.hasNeighbours(c.cx, c.cz)) continue;
    if (performance.now() - t0 > budgetMs) { pending++; break; }
    renderer.upload(c, buildMesh(world, c));
    c.dirty = false;
  }
  if (++frameNo % 60 === 0) {
    const max = R + 3;
    for (const [k, c] of world.chunks) {
      if (Math.abs(c.cx - pcx) > max || Math.abs(c.cz - pcz) > max) { renderer.free(c); world.chunks.delete(k); }
    }
  }
  return pending;
}

function remeshAround(x, z) {
  const cx = Math.floor(x / CS), cz = Math.floor(z / CS);
  for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) {
    const c = world.getChunk(cx + dx, cz + dz);
    if (c && c.dirty && world.hasNeighbours(c.cx, c.cz)) { renderer.upload(c, buildMesh(world, c)); c.dirty = false; }
  }
}

// ---------- interaction ----------
function placeBlock() {
  if (!running) return;
  const id = hotbar[selected];
  if (id === ITEM_SWORD) { swing(); return; }
  if (isTreat(id)) {
    if (throwCool > 0) return;
    throwCool = id === ITEM_SEEDS ? 0.2 : 0.3;
    flock.throwTreat(id, player.eye(), player.forward());
    sfx.toss();
    return;
  }
  if (!target) return;
  const x = target.x + target.nx, y = target.y + target.ny, z = target.z + target.nz;
  const here = world.getBlock(x, y, z);
  if (here !== B.AIR && here !== B.WATER) return;
  if (SOLID[id] && player.intersectsBlock(x, y, z)) return;
  if (world.setBlock(x, y, z, id)) { remeshAround(x, z); buzz(8); sfx.place(); }
}

function updateBreaking(dt) {
  const ring = $('#crosshair');
  if (hotbar[selected] === ITEM_SWORD) {
    // with the sword, a click or press swings instead of digging
    if (input.state.breaking && !wasBreaking) swing();
    wasBreaking = input.state.breaking;
    breakT.p = 0; breakT.key = ''; ring.style.setProperty('--p', 0);
    return;
  }
  wasBreaking = input.state.breaking;
  if (!input.state.breaking || !target) { breakT.p = 0; breakT.key = ''; ring.style.setProperty('--p', 0); return; }
  const key = target.x + ',' + target.y + ',' + target.z;
  if (key !== breakT.key) { breakT.key = key; breakT.p = 0; }
  const hard = BLOCKS[target.id].hard;
  breakT.p += Number.isFinite(hard) ? dt / Math.max(0.05, hard) : 0;
  if (breakT.p >= 1) {
    // let water flow back into a hole next to water
    const nearWater = [[1, 0, 0], [-1, 0, 0], [0, 0, 1], [0, 0, -1], [0, 1, 0]]
      .some(([dx, dy, dz]) => world.getBlock(target.x + dx, target.y + dy, target.z + dz) === B.WATER);
    world.setBlock(target.x, target.y, target.z, nearWater ? B.WATER : B.AIR);
    remeshAround(target.x, target.z);
    buzz(15);
    sfx.dig();
    breakT.p = 0; breakT.key = '';
  }
  ring.style.setProperty('--p', Math.min(1, breakT.p).toFixed(3));
}

function buzz(ms) { if (input.usingTouch) navigator.vibrate?.(ms); }

function toggleFly() {
  if (!player) return;
  player.flying = !player.flying;
  player.vel[1] = 0;
  document.body.classList.toggle('flying', player.flying);
  $('#btn-fly').classList.toggle('on', player.flying);
}

// ---------- hotbar & picker ----------
function buildHotbar() {
  const bar = $('#hotbar');
  bar.innerHTML = '';
  hotbar.forEach((id, i) => {
    const b = document.createElement('button');
    b.className = 'slot' + (i === selected ? ' sel' : '');
    b.setAttribute('aria-label', itemName(id));
    b.innerHTML = `<img alt="" src="${icons[id]}">`;
    b.addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); selectSlot(i); });
    bar.appendChild(b);
  });
  updateHeld();
}
function selectSlot(i) {
  selected = i;
  [...$('#hotbar').children].forEach((el, k) => el.classList.toggle('sel', k === i));
  updateHeld();
}

function openPicker() {
  if (!running) return;
  running = false; input.enabled = false;
  if (document.pointerLockElement) { pickerOpenFromLock = true; document.exitPointerLock(); }
  const grid = $('#picker-grid');
  grid.innerHTML = '';
  for (const id of [...TREATS, ITEM_SWORD, ...PLACEABLE]) {
    const b = document.createElement('button');
    b.className = 'pick' + (hotbar[selected] === id ? ' cur' : '');
    b.innerHTML = `<img alt="" src="${icons[id]}"><span>${itemName(id)}</span>`;
    b.addEventListener('click', () => { hotbar[selected] = id; buildHotbar(); closePicker(); });
    grid.appendChild(b);
  }
  $('#picker').hidden = false;
}
let pickerOpenFromLock = false;
function closePicker() {
  $('#picker').hidden = true;
  pickerOpenFromLock = false;
  resume();
}
$('#picker-close').addEventListener('click', closePicker);
$('#picker').addEventListener('click', e => { if (e.target.id === 'picker') closePicker(); });

// ---------- menu ----------
function pause() {
  if (pickerOpenFromLock) return; // pointer lock was released for the picker, not a pause
  if (!running && !$('#picker').hidden) $('#picker').hidden = true;
  running = false; input.enabled = false;
  input.state.breaking = false;
  saveGame();
  $('#hud').hidden = true;
  $('#menu').hidden = false;
  $('#btn-play').textContent = 'Resume';
}

function resume() {
  $('#menu').hidden = true;
  $('#new-world').hidden = true;
  $('#hud').hidden = false;
  running = true; input.enabled = true;
  input.look.dx = input.look.dy = 0;
  if (!input.usingTouch && !coarse) canvas.requestPointerLock?.();
}

function enterFullscreen() {
  if (!coarse) return;
  const el = document.documentElement;
  const req = el.requestFullscreen || el.webkitRequestFullscreen;
  if (req && !document.fullscreenElement) {
    Promise.resolve(req.call(el)).then(() => screen.orientation?.lock?.('landscape')).catch(() => {});
  }
}

$('#btn-play').addEventListener('click', () => {
  if (!renderer) return;
  sfx.unlock();
  enterFullscreen();
  if (!world) startWorld(store.get(SAVE_KEY));
  if (coarse) input.setTouchMode(true);
  resume();
  hideHintLater();
});
$('#btn-new').addEventListener('click', () => { $('#new-world').hidden = !$('#new-world').hidden; });
$('#btn-create').addEventListener('click', () => {
  if (!renderer) return;
  const raw = $('#seed-input').value.trim();
  let seed;
  if (raw) seed = /^\d+$/.test(raw) ? (+raw >>> 0) : [...raw].reduce((h, ch) => (Math.imul(h, 31) + ch.charCodeAt(0)) >>> 0, 7);
  sfx.unlock();
  enterFullscreen();
  hotbar = [...DEFAULT_HOTBAR]; selected = 0;
  startWorld(seed === undefined ? null : { seed });
  saveGame();
  if (coarse) input.setTouchMode(true);
  resume();
  hideHintLater();
});

function hideHintLater() { setTimeout(() => $('#touch-hint').classList.add('gone'), 7000); }

// settings
const sView = $('#set-view'), sSens = $('#set-sens'), sAuto = $('#set-autojump'), sFps = $('#set-fps'), sSound = $('#set-sound');
function applySettings() {
  sView.value = settings.view; $('#view-val').textContent = settings.view + ' chunks';
  sSens.value = settings.sens; $('#sens-val').textContent = (+settings.sens).toFixed(1) + '×';
  sAuto.checked = settings.autoJump; sFps.checked = settings.showFps; sSound.checked = settings.sound;
  sfx.enabled = settings.sound;
  input.touchSens = input.mouseSens = +settings.sens;
  if (player) player.autoJump = settings.autoJump;
  $('#info').hidden = !settings.showFps;
  store.set(SET_KEY, settings);
}
sView.addEventListener('input', () => { settings.view = +sView.value; applySettings(); });
sSens.addEventListener('input', () => { settings.sens = +sSens.value; applySettings(); });
sAuto.addEventListener('change', () => { settings.autoJump = sAuto.checked; applySettings(); });
sFps.addEventListener('change', () => { settings.showFps = sFps.checked; applySettings(); });
sSound.addEventListener('change', () => { settings.sound = sSound.checked; applySettings(); });
applySettings();

if (store.get(SAVE_KEY)) $('#btn-play').textContent = 'Continue';

function showError(msg) { const e = $('#menu-error'); e.textContent = msg; e.hidden = false; }

document.addEventListener('visibilitychange', () => { if (document.hidden) { saveGame(); if (running) pause(); } });
window.addEventListener('pagehide', saveGame);
setInterval(() => { if (running && world?.editsChanged !== undefined) saveGame(); }, 10000);

// ---------- main loop ----------
let last = performance.now(), fpsAcc = 0, fpsN = 0, fps = 0;
const pixelRatio = Math.min(window.devicePixelRatio || 1, coarse ? 1.5 : 2);

function loop(now) { requestAnimationFrame(loop); frame(now); }
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  fpsAcc += dt; fpsN++;
  if (fpsAcc > 0.5) { fps = Math.round(fpsN / fpsAcc); fpsAcc = 0; fpsN = 0; }
  if (!world || !renderer) return;

  renderer.resize(pixelRatio);
  if (running) {
    const l = input.consumeLook();
    player.yaw -= l.dx;
    player.pitch = Math.max(-1.55, Math.min(1.55, player.pitch - l.dy));
    if (world.getChunk(Math.floor(player.pos[0] / CS), Math.floor(player.pos[2] / CS))) player.update(dt, input.state, world);
    if (player.pos[1] < -20) { player.pos[1] = CH; player.vel[1] = 0; }
    throwCool = Math.max(0, throwCool - dt);
    swingCool = Math.max(0, swingCool - dt);
    clock = (clock + dt / CYCLE) % 1;
    const isNight = skyAt(clock).night > 0.5;
    flock.update(dt, player, hotbar[selected], snakes.heads(), isNight);
    snakes.update(dt, flock, player, isNight, nights);
    handleChickEvents();
  }
  const sky = skyAt(clock);
  const pending = stream(running ? 5 : 10);
  $('#loading').hidden = pending === 0 || running;

  const eye = player.eye(), fwd = player.forward();
  target = running ? raycast(world, eye, fwd, REACH) : null;
  if (running) updateBreaking(dt);

  const underwater = world.getBlock(Math.floor(eye[0]), Math.floor(eye[1]), Math.floor(eye[2])) === B.WATER;
  const far = settings.view * CS - 6;
  const waterFog = WATER_FOG.map((v, i) => v * sky.tint[i]);
  const a = flock.instances(eye, far + 8, now / 1000), s = snakes.instances(eye, far + 8, now / 1000);
  renderer.render({
    eye, forward: fwd, fov: 70 * Math.PI / 180,
    fogColor: underwater ? waterFog : sky.horizon, zenith: underwater ? waterFog : sky.zenith,
    sunDir: sky.sunDir, moonDir: sky.moonDir, night: underwater ? 0 : sky.night, clouds: underwater ? 0 : 1,
    fogNear: underwater ? 0 : far * 0.6, fogFar: underwater ? 22 : far,
    tint: underwater ? [0.6 * sky.tint[0], 0.75 * sky.tint[1], sky.tint[2]] : sky.tint,
    entTint: sky.entTint, glowLayer: T.LAMP,
  }, world.chunks.values(), target, now / 1000, { groups: [...a.groups, ...s.groups], shadowGroups: [...a.shadowGroups, ...s.shadowGroups] });

  if (settings.showFps) {
    const p = player.pos;
    $('#info').textContent = `${fps} fps  ${renderer.stats.chunks} chunks  ${Math.round(renderer.stats.tris / 1000)}k tris\n` +
      `x ${p[0].toFixed(1)}  y ${p[1].toFixed(1)}  z ${p[2].toFixed(1)}${player.flying ? '  flying' : ''}`;
  }
}
requestAnimationFrame(loop);

// handy for debugging from the console
window.blockwild = { get world() { return world; }, get player() { return player; }, get target() { return target; }, get flock() { return flock; }, get nursery() { return flock; }, get snakes() { return snakes; }, input, raycast,
  get clock() { return clock; }, setTime(t) { clock = t; }, swing: () => swing(),
  // advance n frames by hand (useful when the page is in a background tab)
  step(n = 1) { for (let i = 0; i < n; i++) { last = performance.now() - 33; frame(performance.now()); } } };

// Show the world behind the title screen right away.
if (renderer) {
  startWorld(store.get(SAVE_KEY));
  player.pitch = Math.min(player.pitch, -0.05);
}

if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
