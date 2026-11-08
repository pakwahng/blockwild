// Baby Chicken Empire: bootstrap, game loop, streaming, interaction, UI and saving.
import { B, T, BLOCKS, SOLID, PLACEABLE, TILE_COUNT, ITEM_SEEDS, ITEM_WHEAT, ITEM_SWORD, ITEM_BONE, ITEM_APPLE, ITEM_CLOVER, ITEM_STICK, ITEM_EGG, ITEM_MILK, ITEM_HOUSE, IS_DOOR, DOOR_TOPS, TREATS, ITEM_NAMES, SHAPED, FEEDER_OF, FEEDER_TREAT, IS_FEEDER } from './blocks.js';
import { Snakes, SNAKE_KINDS, K_POISON, K_FLYING, K_DIGGER, K_BOOM } from './snakes.js';
import { Raiders } from './raiders.js';
import { Weather } from './weather.js';
import { Critters, BUTTERFLY_KINDS } from './critters.js';
import { GOALS, newStats, bump } from './goals.js';
import { drops, RECIPES, TABS, TOOLS, STARTER, OLD_SAVE_BAG, TABLE_REACH, FEEDER_FILL } from './crafting.js';
import { skyAt, CYCLE } from './sky.js';
import { buildTextures, blockIcon } from './textures.js';
import * as M from './models.js';
import { Nursery, SPECIES, SPECIES_ORDER, isTreat, GIFTS, BABY_NAMES } from './animals.js';
import { Sfx } from './audio.js';
import { World, CS, CH } from './world.js';
import { buildMesh } from './mesher.js';
import { Renderer } from './renderer.js';
import { Player, raycast } from './player.js';
import { Input } from './input.js';
import { Net, cleanCode } from './net.js';
import { VERSION, RELEASED, CHANGES } from './version.js';

const $ = s => document.querySelector(s);
const SAVE_KEY = 'blockwild.save.v1', SET_KEY = 'blockwild.settings.v1';
const store = {
  get(k) { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch { return false; } },
};

const coarse = matchMedia('(pointer: coarse)').matches;
// iPads report themselves as Macs, so also check for a touch screen
const isIOS = /iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const settings = Object.assign({ view: coarse ? 5 : 7, sens: 1, autoJump: true, showFps: false, sound: true, char: 'lachie', nick: '', fits: {} }, store.get(SET_KEY) || {});
const CHARS = ['lachie', 'charli'], CHAR_NAMES = { lachie: 'Lachie', charli: 'Charli' };
const charOf = c => CHARS.includes(c) ? c : 'lachie';
// Your own name (blank means the character's name) and outfit; other players' names come over the network.
const cleanNick = s => typeof s === 'string' ? s.replace(/[\u0000-\u001f]/g, '').trim().slice(0, 14) : '';
const myName = () => cleanNick(settings.nick) || CHAR_NAMES[settings.char];
const myFit = () => M.cleanFit(settings.fits && settings.fits[settings.char], settings.char);
const nameOf = o => o.nick || CHAR_NAMES[o.char];
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
  SNAKE_KINDS.forEach((_, k) => { renderer.addModel('snakeHead' + k, M.snakeHeadModel(k)); renderer.addModel('snakeSeg' + k, M.snakeSegModel(k)); });
  renderer.addModel('goo', M.gooModel());
  M.CONFETTI_COLORS.forEach((c, k) => renderer.addModel('confetti' + k, M.confettiModel(c)));
  renderer.addModel('fox', M.foxModel());
  renderer.addModel('crow', M.crowModel());
  renderer.addModel('hen', M.henModel());
  renderer.addModel('egg', M.eggModel());
  renderer.addModel('milk', M.milkModel());
  renderer.addModel('woolTuft', M.woolTuftModel());
  renderer.addModel('logChunk', M.logChunkModel());
  renderer.addModel('stoneChunk', M.stoneChunkModel());
  for (let k = 0; k < BUTTERFLY_KINDS; k++) renderer.addModel('butterfly' + k, M.butterflyModel(k));
  renderer.addModel('firefly', M.fireflyModel());
  renderer.addModel('rain', M.rainModel());
} catch (err) {
  console.error(err);
  showError('This device or browser cannot run Baby Chicken Empire (WebGL2 is required). ' + err.message);
}

let world = null, player = null, flock = null, snakes = null, raiders = null, weather = null, critters = null, running = false, firsts = [];
let clock = 0.08, nights = 0, swingCool = 0, wasBreaking = false;
let crown = false, seat = null;
// hotbar: nine slots holding item ids (0 = empty); inv: how many of each item you're carrying
const NEW_HOTBAR = [ITEM_SEEDS, ITEM_SWORD, 0, 0, 0, 0, 0, 0, 0];
let hotbar = [...NEW_HOTBAR];
let inv = { ...STARTER };
let stats = newStats(), goalsDone = [], goalTimer = 0, climbT = 0;
let selected = 0;
let target = null, breakT = { key: '', p: 0 };
let milestone = 0, throwCool = 0, feederTimer = 0;
const sfx = new Sfx();

// play together
const net = new Net();
const others = new Map();   // id → another player: { id, char, p, tp, yaw, tyaw, pitch, held, sit, phase, speed }
let myNetId = 0, netTimer = 0, poseTimer = 0, shownOthers = -1, pendingEdits = {}, joining = false, sendAnimals = false;
const netEdits = [], netEvents = [];

const icons = {};
const SHAPE_ICON = { [B.FENCE]: 'fence', [B.GATE]: 'gate', [B.DOOR]: 'door', [B.PLANTER]: 'planter', [B.TABLE]: 'table', [B.LADDER]: 'ladder', [B.FEEDER]: 'feeder',
  [B.FLOWER_RED]: 'flower-red', [B.FLOWER_YELLOW]: 'flower-yellow', [B.FLOWER_WHITE]: 'flower-white' };
if (textures) for (const id of [...PLACEABLE, B.THRONE]) {
  icons[id] = SHAPED[id] ? M.treatIcon(SHAPE_ICON[id], 64).toDataURL() : blockIcon(BLOCKS[id], textures.tiles, 64).toDataURL();
}
for (const id of [...TREATS, ITEM_SWORD, ITEM_STICK, ITEM_EGG, ITEM_MILK, ITEM_HOUSE]) icons[id] = M.treatIcon(ITEM_NAMES[id].toLowerCase(), 64).toDataURL();
$('#held').src = icons[ITEM_SWORD] || '';
const itemName = id => ITEM_NAMES[id] || BLOCKS[id]?.name || '';
const isItem = id => !!icons[id];
// the order things are listed in your bag
const BAG_ORDER = [...TREATS, ITEM_EGG, ITEM_MILK, ITEM_SWORD, ITEM_STICK, ITEM_HOUSE, B.THRONE, ...PLACEABLE];

// ---------- your bag: collecting and using things up ----------
const have = id => inv[id] || 0;
function addItem(id, n = 1, quiet = false) {
  if (!isItem(id) || n <= 0) return;
  inv[id] = have(id) + n;
  let slot = hotbar.indexOf(id);
  if (slot < 0) {
    // new things go into an empty slot, or one whose item has run out
    slot = hotbar.indexOf(0);
    if (slot < 0) slot = hotbar.findIndex((h, i) => i !== selected && !have(h));
    if (slot >= 0) hotbar[slot] = id;
  }
  buildHotbar();
  if (slot >= 0 && !quiet) { const el = $('#hotbar').children[slot]; el?.classList.remove('got'); void el?.offsetWidth; el?.classList.add('got'); }
}
function useItem(id, n = 1) {
  if (TOOLS.has(id)) return have(id) > 0;
  if (have(id) < n) return false;
  inv[id] -= n;
  if (!inv[id]) delete inv[id];
  updateCounts();
  return true;
}
// ---------- goals ----------
const goalProgress = g => Math.min(g[2], g[3](stats));
const nextGoal = () => GOALS.find(g => !goalsDone.includes(g[0]));
const rewardText = rw => rw.map(([id, k]) => `${k} ${itemName(id).toLowerCase()}`).join(' and ');
let shownGoal = '';
function checkGoals() {
  if (!world) return;
  let finished = null;
  for (const g of GOALS) {
    if (goalsDone.includes(g[0]) || goalProgress(g) < g[2]) continue;
    goalsDone.push(g[0]);
    for (const [id, k] of g[4]) addItem(id, k, true);
    finished = g;
  }
  if (finished) {
    sfx.fanfare();
    const next = nextGoal();
    toast(`★ Goal done: ${finished[1]}! You got ${rewardText(finished[4])}.` + (next ? '' : ' That’s every goal. Chicken king!'));
    const el = $('#goal'); el.classList.remove('done'); void el.offsetWidth; el.classList.add('done');
    saveGame();
  }
  const g = nextGoal(), el = $('#goal');
  const text = g ? `★ ${g[1]}${g[2] > 1 ? ` · ${goalProgress(g)}/${g[2]}` : ''}` : '';
  if (text !== shownGoal) { shownGoal = text; el.querySelector('span').textContent = text; el.hidden = !g; }
}
$('#goal').addEventListener('click', () => { bagTab = 'goals'; openPicker(); });
function buildGoals() {
  const list = $('#goal-list');
  list.innerHTML = '';
  for (const g of GOALS) {
    const done = goalsDone.includes(g[0]), p = goalProgress(g);
    const row = document.createElement('div');
    row.className = 'goal-row' + (done ? ' done' : g === nextGoal() ? ' next' : '');
    row.innerHTML = `<span class="tick" aria-hidden="true">${done ? '✓' : '★'}</span>` +
      `<span class="what">${g[1]}${!done && g[2] > 1 ? ` <em>${p}/${g[2]}</em>` : ''}</span>` +
      `<span class="prize">${g[4].map(([id, k]) => `<img alt="" src="${icons[id]}">${k}`).join(' ')}</span>`;
    row.setAttribute('aria-label', `${g[1]}. ${done ? 'Done.' : `${p} of ${g[2]}.`} Reward: ${rewardText(g[4])}.`);
    list.appendChild(row);
  }
}

// Grown-ups: what each baby becomes, and what it does for you.
const ADULT_NAME = { chick: 'hen', calf: 'cow', piglet: 'pig', lamb: 'sheep', pup: 'wolf' };
const GROWN_TIP = {
  chick: 'Your chick grew up into a hen! Hens lay eggs: pick one up and throw it, and a chick hatches where it lands.',
  calf: 'Your calf grew up into a cow! Cows give milk: throw it near a baby and it drinks it to grow up faster.',
  piglet: 'Your piglet grew up into a pig! Pigs snuffle about and dig up apples for you.',
  lamb: 'Your lamb grew up into a sheep! Sheep leave soft wool you can build with.',
  pup: 'Your wolf pup grew up into a wolf! Grown wolves guard the nursery and chase off foxes and snakes.',
};
const GIFT_TIP = {
  [ITEM_EGG]: 'You picked up an egg! Throw it and a chick hatches where it lands.',
  [ITEM_MILK]: 'You picked up milk! Throw it near a baby in your nursery and it drinks it to grow up faster.',
  [B.WOOL]: 'You picked up wool! It’s a soft block for building.',
  [ITEM_APPLE]: 'Your pig dug up some apples!',
};

// A little "+1 Dirt" that floats up from where you dug.
function pickupPop(at, got) {
  if (!got.length) return;
  const sp = project(at.x + 0.5, at.y + 0.8, at.z + 0.5);
  if (!sp) return;
  got.forEach(([id, k], i) => {
    const el = document.createElement('div');
    el.className = 'fx pick';
    el.innerHTML = `<img alt="" src="${icons[id]}">+${k}`;
    el.style.left = sp[0] + 'px'; el.style.top = (sp[1] - i * 30) + 'px';
    el.style.animationDelay = i * 0.12 + 's';
    $('#fx').appendChild(el);
    setTimeout(() => el.remove(), 1500 + i * 120);
  });
}

// How many times you could make a recipe with what's in your bag.
const timesYouCan = r => Math.min(...r.needs.map(([id, k]) => Math.floor(have(id) / k)));
// Is there a crafting table close by?
function atTable() {
  if (!world || !player) return false;
  const [x, y, z] = player.pos;
  return world.placedNear(x, z, TABLE_REACH, id => id === B.TABLE).some(t => Math.abs(t[1] - y) <= 3);
}
function canMake(r) { return timesYouCan(r) > 0 && (!r.table || atTable()); }
function craft(r, times = 1) {
  times = Math.min(times, timesYouCan(r));
  if (times <= 0 || (r.table && !atTable())) return 0;
  for (const [id, k] of r.needs) useItem(id, k * times);
  addItem(r.out, r.n * times, true);
  bump(stats, 'made', r.out, times);
  sfx.place();
  return times;
}

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
  onPlace: placeBlock, onPicker: openPicker, onPause: pause,
  onHotbarScroll: d => selectSlot((selected + d + 9) % 9),
  onHotbarKey: selectSlot,
});
$('#btn-menu').addEventListener('click', pause);
$('#btn-blocks').addEventListener('click', openPicker);

// ---------- photos ----------
// Draws a fresh frame, copies it with a little label, then shares it (phones) or downloads it.
let photoShot = null;
$('#btn-photo').addEventListener('click', async () => {
  if (!world || !renderer) return;
  photoShot = null;
  frame(performance.now(), true);             // renders and grabs the picture in the same moment
  const shot = photoShot;
  if (!shot) return;
  const fl = $('#flash'); fl.classList.remove('go'); void fl.offsetWidth; fl.classList.add('go');
  sfx.place(); buzz(20);
  const blob = await new Promise(r => shot.toBlob(r, 'image/png'));
  if (!blob) { toast('Couldn’t take a photo on this device.'); return; }
  const name = `baby-chicken-empire-day-${nights + 1}.png`;
  const file = new File([blob], name, { type: 'image/png' });
  bump(stats, 'photos');
  try {
    if (navigator.canShare?.({ files: [file] })) { await navigator.share({ files: [file], title: 'Baby Chicken Empire' }); return; }
  } catch (err) { if (err.name === 'AbortError') return; }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  toast('Photo saved!');
});
function grabPhoto() {
  const c = document.createElement('canvas');
  // in the wardrobe it's a portrait: just the clear part of the screen where you're standing
  let sx = 0, sy = 0, sw = canvas.width, sh = canvas.height;
  if (wardrobe.open) {
    const v = $('#ward-view').getBoundingClientRect(), k = canvas.width / window.innerWidth;
    sx = Math.round(v.left * k); sy = Math.round(v.top * k); sw = Math.round(v.width * k); sh = Math.round(v.height * k);
  }
  c.width = sw; c.height = sh;
  const g = c.getContext('2d');
  g.drawImage(canvas, sx, sy, sw, sh, 0, 0, sw, sh);
  const s = Math.max(1, Math.max(c.height, c.width * 0.6) / 500);
  g.font = `800 ${Math.round(16 * s)}px system-ui, sans-serif`;
  const label = wardrobe.open ? `${myName()} · Baby Chicken Empire` : `Baby Chicken Empire · Day ${nights + 1}`;
  const w = g.measureText(label).width + 22 * s, h = 30 * s, x = 12 * s, y = c.height - h - 12 * s;
  g.fillStyle = 'rgba(20, 26, 34, 0.7)'; g.beginPath(); g.roundRect(x, y, w, h, h / 2); g.fill();
  g.fillStyle = '#fff3b0'; g.textBaseline = 'middle'; g.fillText(label, x + 11 * s, y + h / 2 + s);
  photoShot = c;
}

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
  if (save) { player.yaw = save.yaw || 0; player.pitch = save.pitch || 0; player.flying = false; } // no flying (older saves may have been mid-air: you drop to the ground)
  const guest = !!save?.guest;
  // a guest brings their own bag along on the visit, so it stays as it is
  if (!guest) {
    if (save?.hotbar?.length === 9) { hotbar = save.hotbar.map(id => isItem(id) ? id : 0); selected = save.selected || 0; }
    else { hotbar = [...NEW_HOTBAR]; selected = 0; }
    const old = save?.edits !== undefined; // a real saved world, not just a seed for a new one
    if (old && !(save.v >= 2)) hotbar = [...TREATS, ...hotbar.filter(id => !isTreat(id))].slice(0, 9);
    if (old && !(save.v >= 3) && !hotbar.includes(ITEM_SWORD)) hotbar[5] = ITEM_SWORD; // the toy sword arrives
    stats = Object.assign(newStats(), save?.stats || {}); goalsDone = [...(save?.goals || [])];
    if (save?.inv) inv = { ...save.inv };
    else if (old) {
      // a world from before you had to collect things: a generous bag, plus a stack of what was on the hotbar
      inv = { ...OLD_SAVE_BAG };
      for (const id of hotbar) if (id && !TOOLS.has(id) && id !== B.THRONE) inv[id] = Math.max(have(id), 32);
      if (save.crown) inv[B.THRONE] = Math.max(have(B.THRONE), 1);
    } else inv = { ...STARTER };
  }
  while (hotbar.length < 9) hotbar.push(0);
  player.autoJump = settings.autoJump;
  document.body.classList.toggle('flying', player.flying);
  buildHotbar();
  stream(80);

  flock = new Nursery(world);
  if (guest) flock.remoteCounts = { chick: 0, calf: 0, piglet: 0, lamb: 0, pup: 0 }; // the host's animals arrive over the network
  else if (save?.animals) flock.load(save.animals); else flock.loadChicks(save?.chicks);
  if (!guest) flock.loadGifts(save?.gifts);
  milestone = save?.milestone || 0;
  firsts = save?.firsts || [];
  snakes = new Snakes(world);
  raiders = new Raiders(world, snakes);
  weather = new Weather(world);
  critters = new Critters(world);
  clock = save?.clock ?? 0.08;
  nights = save?.nights || 0;
  crown = !!save?.crown;
  seat = null;
  showCrown();
  // a few wild babies of each kind close by, so there's someone to feed straight away
  if (!guest) for (const sp of SPECIES_ORDER) {
    if (flock.animals.some(a => a.sp === sp)) continue;
    if (sp === 'chick') flock.spawnGroup(sp, sx, sz, 6, 3, 9);
    else flock.spawnGroup(sp, sx, sz, 2, 7, 16);
  }
  shownCounts = null;
  updateNursery();
}

function saveGame() {
  if (!world || !player) return;
  if (net.isGuest) {
    // a guest's own world stays as it was while they visit; only the bag they carry is kept
    const own = store.get(SAVE_KEY);
    if (own?.seed !== undefined) store.set(SAVE_KEY, { ...own, v: 4, inv, hotbar, selected, stats, goals: goalsDone });
    return;
  }
  store.set(SAVE_KEY, {
    v: 4, inv, stats, goals: goalsDone, seed: world.seed, clock: +clock.toFixed(4), nights, crown, pos: player.pos.map(v => +v.toFixed(2)), yaw: player.yaw, pitch: player.pitch,
    flying: player.flying, hotbar, selected, edits: world.serializeEdits(),
    animals: flock ? flock.serialize() : [], gifts: flock ? flock.serializeGifts() : [], milestone, firsts,
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
  if (shownCounts && n.chick >= 100 && !crown && !net.isGuest) awardCrown();
  stats.chicks = Math.max(stats.chicks || 0, n.chick || 0);
  shownCounts = n;
}

// ---------- chicken king: the gold crown and the hay throne ----------
const crownEl = document.createElement('div');
crownEl.className = 'pill crown';
crownEl.setAttribute('aria-label', 'Chicken king crown');
crownEl.innerHTML = `<svg viewBox="0 0 32 32" aria-hidden="true"><path d="M4 11l6 6 6-10 6 10 6-6-2 15H6z" fill="#ffcf3a" stroke="#c98a00" stroke-width="1.6" stroke-linejoin="round"/><rect x="6" y="23" width="20" height="4" rx="1.5" fill="#ffb800"/><circle cx="16" cy="18" r="2.4" fill="#e8443a"/><circle cx="10" cy="20" r="1.6" fill="#4aa8ff"/><circle cx="22" cy="20" r="1.6" fill="#4cc25a"/><circle cx="4" cy="10" r="1.8" fill="#ffcf3a"/><circle cx="16" cy="6" r="1.8" fill="#ffcf3a"/><circle cx="28" cy="10" r="1.8" fill="#ffcf3a"/></svg>`;
nurseryEl.prepend(crownEl);
{ const br = document.createElement('div'); br.className = 'break'; nurseryEl.append(br, $('#goal')); }
function showCrown() { crownEl.hidden = !crown; }

function awardCrown() {
  crown = true;
  showCrown();
  crownEl.classList.remove('bump'); void crownEl.offsetWidth; crownEl.classList.add('bump');
  if (!have(B.THRONE)) addItem(B.THRONE, 1);
  sfx.royal();
  snakes.burst(player.pos, 90, undefined, false);
  if (net.isHost) netEvents.push({ type: 'crown' });
  toast('Chicken king! You earned the gold crown and a hay bale throne. Place the throne and tap it to sit.');
  saveGame();
}

// Places the throne seat with a hay back (away from the player) and hay arms.
function buildThrone(x, y, z) {
  const dx = x + 0.5 - player.pos[0], dz = z + 0.5 - player.pos[2];
  const back = Math.abs(dx) > Math.abs(dz) ? [Math.sign(dx), 0] : [0, Math.sign(dz) || 1];
  const side = [-back[1], back[0]];
  const put = (px, py, pz, id) => { if (world.getBlock(px, py, pz) === B.AIR) editBlock(px, py, pz, id); };
  for (let s = -1; s <= 1; s++) for (let h = 0; h < 2; h++) put(x + back[0] + side[0] * s, y + h, z + back[1] + side[1] * s, B.HAY);
  put(x + back[0], y + 2, z + back[1], B.HAY);                      // a taller middle for the back
  for (const s of [-1, 1]) put(x + side[0] * s, y, z + side[1] * s, B.HAY); // arms
}

// A house kit builds a little cottage: 5×5, cream walls with log corners, windows, a lamp,
// a red roof with gables, and its door at (x, y, z) facing the player.
function buildHouse(x, y, z) {
  const dx = player.pos[0] - (x + 0.5), dz = player.pos[2] - (z + 0.5);
  const F = Math.abs(dx) > Math.abs(dz) ? [Math.sign(dx), 0] : [0, Math.sign(dz) || 1]; // towards the player
  const Rt = [-F[1], F[0]];
  const at = (lx, lz) => [x + Rt[0] * lx - F[0] * lz, z + Rt[1] * lx - F[1] * lz];
  const plan = new Map();
  const set = (lx, ly, lz, id) => plan.set(lx + ',' + ly + ',' + lz, id);
  const edge = (lx, lz) => Math.abs(lx) === 2 || lz === 0 || lz === 4;
  for (let lx = -2; lx <= 2; lx++) for (let lz = 0; lz <= 4; lz++) {
    set(lx, -1, lz, edge(lx, lz) ? B.COBBLE : B.PLANKS);                              // floor
    for (let ly = 0; ly <= 6; ly++) set(lx, ly, lz, B.AIR);                            // room inside
    if (edge(lx, lz)) for (let ly = 0; ly <= 2; ly++) set(lx, ly, lz, B.CREAM);        // walls
    if (lz === 0 || lz === 4) set(lx, 3, lz, B.CREAM);                                 // front and back up to the roof
  }
  for (const lx of [-2, 2]) for (const lz of [0, 4]) for (let ly = 0; ly <= 3; ly++) set(lx, ly, lz, B.LOG); // corner posts
  set(0, 0, 0, B.DOOR); set(0, 1, 0, B.DOOR_TOP);
  for (const [lx, lz] of [[-1, 0], [1, 0], [-2, 2], [2, 2], [0, 4]]) set(lx, 1, lz, B.GLASS);
  set(0, 2, 4, B.LAMP);
  for (let k = 0; k <= 2; k++) {
    for (let lx = -3; lx <= 3; lx++) { set(lx, 3 + k, k - 1, B.ROOF); set(lx, 3 + k, 5 - k, B.ROOF); }
    if (k) for (const lx of [-2, 2]) for (let lz = k; lz <= 4 - k; lz++) set(lx, 3 + k, lz, B.CREAM); // gables
  }
  for (let lx = -3; lx <= 3; lx++) set(lx, 6, 2, B.ROOF);                              // ridge
  for (const [key, id] of plan) {
    const [lx, ly, lz] = key.split(',').map(Number), [wx, wz] = at(lx, lz);
    if (world.getBlock(wx, y + ly, wz) !== B.BEDROCK) editBlock(wx, y + ly, wz, id);
  }
  // fill any gap under the floor so it doesn't float over a dip
  for (let lx = -2; lx <= 2; lx++) for (let lz = 0; lz <= 4; lz++) {
    const [wx, wz] = at(lx, lz);
    for (let ly = -2; ly >= -5 && !SOLID[world.getBlock(wx, y + ly, wz)]; ly--) editBlock(wx, y + ly, wz, B.DIRT);
  }
  // any baby caught in a wall pops up onto the roof rather than getting stuck
  for (const a of flock.animals) {
    const bx = Math.floor(a.p[0]), by = Math.floor(a.p[1]), bz = Math.floor(a.p[2]);
    if (SOLID[world.getBlock(bx, by, bz)]) { let ty = by; while (ty < CH - 1 && SOLID[world.getBlock(bx, ty, bz)]) ty++; a.p[1] = ty; }
  }
  const [cx, cz] = at(0, 2);
  for (const [ox, oz] of [[-4, -4], [4, -4], [-4, 4], [4, 4]]) remeshAround(cx + ox, cz + oz);
  sfx.place(); sfx.fanfare(); buzz(40);
  snakes.burst([x + 0.5, y + 1.5, z + 0.5], 40, undefined, net.isHost);
  if (!firsts.includes('house')) { firsts.push('house'); toast('A cosy cottage! Tap the door to open or shut it. Shut your babies in at night and the snake can’t get them.'); }
}

// The front of a throne faces away from its hay back.
function throneFront(x, y, z) {
  for (const [bx, bz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
    if (world.getBlock(x + bx, y, z + bz) === B.HAY && world.getBlock(x + bx, y + 1, z + bz) === B.HAY) return [-bx, -bz];
  }
  const dx = player.pos[0] - (x + 0.5), dz = player.pos[2] - (z + 0.5), l = Math.hypot(dx, dz) || 1;
  return Math.abs(dx) > Math.abs(dz) ? [Math.sign(dx), 0] : [0, Math.sign(dz) || 1];
}

function sit(x, y, z) {
  const front = throneFront(x, y, z);
  seat = { x, y, z, front };
  player.flying = false;
  player.pos = [x + 0.5, y + 1, z + 0.5]; player.vel = [0, 0, 0];
  player.yaw = Math.atan2(-front[0], -front[1]); player.pitch = -0.42;
  let n = flock.gatherAt([x + 0.5, y, z + 0.5], front);
  if (net.isGuest) { net.toHost({ t: 'sit', seat: [x + 0.5, y, z + 0.5], front }); n = Object.values(flock.counts()).reduce((a, b) => a + b, 0); }
  sfx.royal();
  snakes.burst(player.pos, 50, undefined, net.isHost);
  toast(n ? `Chicken king! ${n} ${n === 1 ? 'baby gathers' : 'babies gather'} round your hay throne. Walk or jump to stand up.`
    : 'You sit on your hay throne. Walk or jump to stand up.');
}
function standUp() { seat = null; flock.endGather(); if (net.isGuest) net.toHost({ t: 'stand' }); }

// The first time each new kind of snake turns up.
const SNAKE_TIPS = [
  '',
  'A poison snake! It leaves a trail of green goo. Babies run from it and it slows you down, but it dries up after 5 seconds.',
  'A flying snake! It flaps right over fences and walls, then swoops down on a baby. Bonk it when it comes low.',
  'A digger snake in a hard hat! Walls won’t stop it: it chews straight through blocks. It takes three bonks.',
  'A boom snake! When it gets near a baby it fizzes, then goes BOOM and blasts the blocks around it. Bonk it while it fizzes to put the fuse out!',
];
// Knocks a block out (a snake chewing or a blast). A door goes with its other half.
function smashBlock(x, y, z) {
  const id = world.getBlock(x, y, z);
  if (id === B.AIR || id === B.WATER || id === B.BEDROCK) return;
  editBlock(x, y, z, B.AIR);
  if (IS_DOOR[id]) for (const dy of [-1, 1]) if (IS_DOOR[world.getBlock(x, y + dy, z)]) editBlock(x, y + dy, z, B.AIR);
  remeshAround(x, z);
}

// Every block change goes through here so other players get it too.
function editBlock(x, y, z, id) {
  if (!world.setBlock(x, y, z, id)) return false;
  if (net.active) netEdits.push([x, y, z, id]);
  return true;
}

let toastTimer = 0;
function toast(text, ms = 4200) {
  const t = $('#toast');
  t.textContent = text;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), ms);
}
// "Nugget the lamb", or "Your lamb" / "a lamb" for a baby with no name.
function callName(n, sp, fallback) {
  const nm = BABY_NAMES[n], s = SPECIES[sp] ? SPECIES[sp].name : 'baby';
  return nm ? `${nm} the ${s}` : `${fallback} ${s}`;
}

// Screen position of a 3D point, or null when it's behind the camera or well off screen.
function project(x, y, z) {
  const m = renderer.mvp;
  if (!m) return null;
  const cx = m[0] * x + m[4] * y + m[8] * z + m[12], cy = m[1] * x + m[5] * y + m[9] * z + m[13], cw = m[3] * x + m[7] * y + m[11] * z + m[15];
  if (cw <= 0.1) return null;
  const sx = (cx / cw * 0.5 + 0.5) * window.innerWidth, sy = (1 - (cy / cw * 0.5 + 0.5)) * window.innerHeight;
  if (sx < -40 || sy < -40 || sx > window.innerWidth + 40 || sy > window.innerHeight + 40) return null;
  return [sx, sy];
}

// Floating hearts and "+1" pops above chicks, positioned by projecting the 3D point to the screen.
function floatFx(p, kind) {
  const at = project(p[0], p[1] + 0.8, p[2]);
  if (!at) return;
  const [sx, sy] = at;
  const el = document.createElement('div');
  el.className = 'fx ' + kind;
  el.textContent = kind === 'hatch' ? '+1' : kind === 'bonk' ? 'BONK!' : kind === 'grown' ? 'All grown up!' : '';
  el.style.left = sx + 'px'; el.style.top = sy + 'px';
  $('#fx').appendChild(el);
  setTimeout(() => el.remove(), kind === 'grown' ? 1800 : 1300);
}

function handleChickEvents() {
  const eye = player.eye();
  if (net.isHost && net.guests) {
    // guests hear and see the same things
    for (const ev of flock.events) netEvents.push({ ...ev, f: 1 });
    for (const ev of snakes.events) netEvents.push(ev);
    for (const ev of raiders.events) netEvents.push({ ...ev, r: 1 });
    for (const ev of weather.events) netEvents.push({ ...ev, w: 1 });
    if (netEvents.length > 120) netEvents.splice(0, netEvents.length - 120);
  }
  for (const ev of flock.events) {
    const d = Math.hypot(ev.p[0] - eye[0], ev.p[1] - eye[1], ev.p[2] - eye[2]);
    if (ev.type === 'call') { if (d < 20) sfx.call(ev.sp, 0.35 * (1 - d / 20)); continue; }
    if (ev.type === 'gift') {
      // whoever walked over a gift gets it
      if (ev.by !== myNetId) continue;
      addItem(ev.item, ev.n);
      bump(stats, 'gifts', ev.item, ev.n);
      pickupPop({ x: ev.p[0] - 0.5, y: ev.p[1] - 0.6, z: ev.p[2] - 0.5 }, [[ev.item, ev.n]]);
      sfx.pickup(); buzz(10);
      if (ev.from) {
        // something a working grown-up fetched for you
        bump(stats, 'fetched', ev.item, ev.n);
        const first = !firsts.includes('fetched');
        if (first) firsts.push('fetched');
        toast(`${grownName(ev.from)} brought you ${fetchedWhat(ev.item)}!${first ? ' It’ll keep bringing more while it’s light.' : ''}`, first ? 4500 : 2200);
      } else if (!firsts.includes('gift' + ev.item)) { firsts.push('gift' + ev.item); toast(GIFT_TIP[ev.item] || `You picked up ${itemName(ev.item).toLowerCase()}.`); }
      continue;
    }
    if (ev.type === 'fetched' || ev.type === 'nowork' || ev.type === 'stuck') {
      // news from a working grown-up, for whoever taught it
      if (ev.type === 'fetched' && d < 14) sfx.call(ev.sp, 0.45 * (1 - d / 14));
      if (ev.by !== myNetId) continue;
      const who = grownName(ev), J = JOB_TEXT[ev.job] || JOB_TEXT.wood;
      if (ev.type === 'fetched') { if (!ev.near) toast(`${who} left ${fetchedWhat(ev.item)} for you on the ground. Go and pick it up!`, 4000); }
      else if (ev.type === 'nowork') toast(`${who} can’t find any ${J.place} near by. Take it somewhere with ${J.place}, or teach it a different job.`, 6000);
      else toast(`${who} can’t find a way to any ${J.place} near by. Try somewhere else, or look for a fence in the way.`, 6000);
      continue;
    }
    if (ev.type === 'work') { if (d < 14) sfx.knock(ev.job, 0.3 * (1 - d / 14)); continue; }
    if (ev.type === 'trained') { if (d < 20) floatFx(ev.p, 'heart'); continue; }
    if (d > 40) continue;
    if (ev.type === 'grown') {
      bump(stats, 'grown');
      sfx.grown(); sfx.call(ev.sp, 0.5); floatFx(ev.p, 'grown'); buzz(25);
      snakes.burst([ev.p[0], ev.p[1] + 0.4, ev.p[2]], 26, [1, 1, 2, 3], false);
      const first = !firsts.includes('grown' + ev.sp);
      if (first) firsts.push('grown' + ev.sp);
      const who = callName(ev.name, ev.sp, 'Your');
      const jobTip = firsts.includes('jobtip') ? '' : ' Tap it to teach it a job, like fetching wood!';
      if (jobTip) firsts.push('jobtip');
      toast((first ? GROWN_TIP[ev.sp].replace(/^Your [a-z ]+ grew up/, `${who} grew up`) : `${who} grew up into a ${ADULT_NAME[ev.sp]}!`) + jobTip, jobTip ? 7000 : 4200);
      continue;
    }
    if (ev.type === 'laid') { if (d < 16) sfx.call(ev.sp, 0.4 * (1 - d / 16)); continue; }
    if (ev.type === 'woof') {
      sfx.call('pup', 0.6); buzz(15);
      if (!firsts.includes('woof')) { firsts.push('woof'); toast(`Woof! Your grown-up wolf is chasing the ${ev.kind} away from the nursery.`); }
      continue;
    }
    if (ev.type === 'milk') { sfx.happy(); floatFx(ev.p, 'heart'); continue; }
    if (ev.type === 'tame') bump(stats, 'tamed');
    if (ev.type === 'hatch') { bump(stats, 'hatched'); sfx.hatch(); sfx.call(ev.sp, 0.45); floatFx(ev.p, 'hatch'); buzz(20); }
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
      if (ev.spooked === 0) bump(stats, 'nights');
      if (net.isGuest) {
        toast(ev.spooked ? `Day ${nights + 1}. Sunrise! The snake spooked ${ev.spooked} ${ev.spooked === 1 ? 'baby' : 'babies'}, but the nursery made it.` : `Day ${nights + 1}. Sunrise! Every baby made it safely through the night.`);
        if (!(ev.spooked === 0 && !crown)) sfx.fanfare();
        continue;
      }
      nights++;
      const babies = Object.values(flock.counts()).reduce((a, b) => a + b, 0);
      if (!ev.spooked && babies > 0 && !crown) { awardCrown(); continue; }
      sfx.fanfare();
      toast(ev.spooked ? `Day ${nights + 1}. Sunrise! The snake spooked ${ev.spooked} ${ev.spooked === 1 ? 'baby' : 'babies'}, but the nursery made it.`
        : `Day ${nights + 1}. Sunrise! Every baby made it safely through the night.`);
    } else if (ev.type === 'hiss') { if (d < 24) sfx.hiss(0.25 * (1 - d / 24)); }
    else if (ev.type === 'spawn') {
      const k = ev.kind | 0;
      if (k && !firsts.includes('snake' + k)) { firsts.push('snake' + k); setTimeout(() => toast(SNAKE_TIPS[k]), 1500); }
    } else if (ev.type === 'spook') {
      sfx.hiss(0.4); sfx.call(ev.sp, 0.5);
      const who = callName(ev.name, ev.sp, 'a');
      toast(ev.why === 'goo' ? `Yuck! ${who[0].toUpperCase() + who.slice(1)} stepped in poison goo and ran out of your nursery! Feed it again to bring it back.`
        : ev.why === 'boom' ? `BOOM! ${who[0].toUpperCase() + who.slice(1)} got a fright and ran out of your nursery! Feed it again to bring it back.`
        : `The snake spooked ${who} out of your nursery! Feed it again to bring it back.`);
    } else if (ev.type === 'fuse') {
      if (d < 40) sfx.fuse();
      if (d < 30 && !firsts.includes('fuse')) { firsts.push('fuse'); toast('The boom snake is fizzing! Bonk it quick to put the fuse out!'); }
    } else if (ev.type === 'chew') {
      if (!net.isGuest && world.getBlock(ev.x, ev.y, ev.z) !== B.AIR) smashBlock(ev.x, ev.y, ev.z);
      if (d < 24) sfx.dig();
    } else if (ev.type === 'boom') {
      if (!net.isGuest) for (const [x, y, z] of ev.blocks || []) smashBlock(x, y, z);
      sfx.boom(d < 50 ? 1 - d / 60 : 0.15);
      if (d < 9 && player && !seat) {
        // blown back a little: away from the blast and up
        const dx = player.pos[0] - ev.p[0], dz = player.pos[2] - ev.p[2], l = Math.hypot(dx, dz) || 1, f = (9 - d) * 1.4;
        player.vel[0] += dx / l * f; player.vel[2] += dz / l * f; player.vel[1] = Math.max(player.vel[1], 4 + f * 0.4);
        buzz(120);
      }
      if (!firsts.includes('boom') && d < 60) { firsts.push('boom'); setTimeout(() => toast('BOOM! The boom snake blew a hole in the ground. Bonk them before they fizz out!'), 800); }
    } else if (ev.type === 'bonk') { sfx.bonk(); floatFx(ev.p, 'bonk'); buzz(30); }
    else if (ev.type === 'poof' && ev.wolf) {
      sfx.poof(); buzz(40);
      if (d < 60) toast('Your grown-up wolf nipped the snake into confetti! Good wolf.');
    } else if (ev.type === 'poof') {
      sfx.poof(); buzz(60); bump(stats, 'bonked');
      if (!firsts.includes('poof')) { firsts.push('poof'); toast('Swung once, swung twice: bonk! The snake poofed into confetti cubes.'); }
    }
  }
  snakes.events.length = 0;

  // the daytime raiders
  for (const ev of raiders.events) {
    const d = ev.p ? Math.hypot(ev.p[0] - eye[0], ev.p[1] - eye[1], ev.p[2] - eye[2]) : 0;
    if (ev.type === 'fox') {
      sfx.yelp(0.35);
      if (!firsts.includes('fox')) { firsts.push('fox'); toast('A sneaky fox is creeping up on your nursery! Bonk it twice with the sword, or build a wooden fence to keep it out.'); }
      else toast('A fox is sneaking up on the nursery!');
    } else if (ev.type === 'crow') {
      sfx.caw(0.3);
      if (!firsts.includes('crow')) { firsts.push('crow'); toast('Caw! A crow is swooping down to pinch a treat. Bonk it before it flies off!'); }
    } else if (ev.type === 'caw') { if (d < 30) sfx.caw(0.3 * (1 - d / 30)); }
    else if (ev.type === 'steal') { if (d < 40) { sfx.caw(0.3); toast('A crow pinched a treat and flew off!'); } }
    else if (ev.type === 'foxSpook') {
      sfx.yelp(0.4); sfx.call(ev.sp, 0.5);
      toast(`The fox spooked ${callName(ev.name, ev.sp, 'a')} out of your nursery! Feed it again to bring it back.`);
    } else if (ev.type === 'foxChased') { sfx.yelp(0.45); if (d < 60) toast('Your grown-up wolf chased the fox away!'); }
    else if (ev.type === 'foxGiveUp') { if (d < 60) toast('The fox couldn’t get past your fence and slunk off home.'); }
    else if (ev.type === 'bonk') { sfx.bonk(); floatFx(ev.p, 'bonk'); buzz(30); }
    else if (ev.type === 'rpoof') {
      sfx.poof(); buzz(60);
      const fox = ev.kind === 0;
      if (ev.by === myNetId) {
        bump(stats, 'bonked');
        // whoever bonked it gets what it dropped
        if (fox) addItem(ITEM_BONE, 2); else addItem(ITEM_SEEDS, 4);
        toast(fox ? 'Bonk, bonk, poof! The fox dropped 2 bones.' : 'Bonk, poof! The crow dropped 4 seeds.');
      }
    }
  }
  raiders.events.length = 0;
  for (const ev of weather.events) {
    if (ev.type === 'rain') {
      if (!firsts.includes('rain')) { firsts.push('rain'); toast('It’s raining! Wheat in your planters grows faster in the rain. Stay dry under a roof.'); }
    } else if (ev.type === 'rainEnd' && ev.rainbow) { sfx.grown(); toast('The rain stopped. Look, a rainbow!'); }
  }
  weather.events.length = 0;
  updateNursery();
}

// ---------- the toy sword ----------
function swing() {
  if (swingCool > 0) return;
  swingCool = 0.35;
  const held = $('#held');
  held.classList.remove('swing'); void held.offsetWidth; held.classList.add('swing');
  if (net.isGuest) { net.toHost({ t: 'swing', eye: player.eye(), fwd: player.forward() }); sfx.whoosh(); return; }
  if (!snakes.swing(player.eye(), player.forward()) && !raiders.swing(player.eye(), player.forward(), myNetId)) sfx.whoosh();
}
function updateHeld() { $('#held').hidden = hotbar[selected] !== ITEM_SWORD || !have(ITEM_SWORD); }

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
  if (target && target.id === B.THRONE && !seat) { sit(target.x, target.y, target.z); return; }
  if (target && (target.id === B.GATE || target.id === B.GATE_OPEN)) {
    // tap a gate to swing it open or shut
    const open = target.id === B.GATE;
    if (!open && player.intersectsBlock(target.x, target.y, target.z)) return;
    editBlock(target.x, target.y, target.z, open ? B.GATE_OPEN : B.GATE);
    remeshAround(target.x, target.z); sfx.place(); buzz(8);
    return;
  }
  if (target && IS_DOOR(target.id)) {
    // tap either half of a door to open or shut the whole thing
    const by = DOOR_TOPS.has(target.id) ? target.y - 1 : target.y;
    const open = world.getBlock(target.x, by, target.z) === B.DOOR;
    if (!open && (player.intersectsBlock(target.x, by, target.z) || player.intersectsBlock(target.x, by + 1, target.z))) return;
    editBlock(target.x, by, target.z, open ? B.DOOR_OPEN : B.DOOR);
    if (IS_DOOR(world.getBlock(target.x, by + 1, target.z))) editBlock(target.x, by + 1, target.z, open ? B.DOOR_OPEN_TOP : B.DOOR_TOP);
    remeshAround(target.x, target.z); sfx.place(); buzz(8);
    return;
  }
  if (!isTreat(id) && id !== ITEM_SWORD && petBaby(!id || id >= 200)) return;
  if (target && target.id === B.PLANTER_RIPE) {
    // pick the golden wheat: some wheat and a few seeds to plant again
    const got = [[ITEM_WHEAT, 2], [ITEM_SEEDS, 1 + (Math.random() * 2 | 0)]];
    for (const [item, n] of got) { addItem(item, n); bump(stats, 'got', item, n); }
    bump(stats, 'harvested');
    pickupPop(target, got);
    editBlock(target.x, target.y, target.z, B.PLANTER);
    remeshAround(target.x, target.z); sfx.munch(); buzz(10);
    return;
  }
  if (target && target.id === B.PLANTER && id === ITEM_SEEDS && have(id)) {
    useItem(id); bump(stats, 'planted');
    editBlock(target.x, target.y, target.z, B.PLANTER_SEEDED);
    remeshAround(target.x, target.z); sfx.place(); buzz(8);
    if (!firsts.includes('planter')) { firsts.push('planter'); toast('Seeds planted! Wheat grows in a couple of minutes. Tap it when it turns golden to pick it.'); }
    return;
  }
  if (target && (target.id === B.PLANTER_SEEDED || target.id === B.PLANTER_GROWING) && id === ITEM_SEEDS) {
    toast('That wheat is still growing. Tap it when it turns golden.');
    return;
  }
  if (target && IS_FEEDER(target.id) && FEEDER_OF[id]) {
    // fill a feeder with the treat you're holding
    if (FEEDER_TREAT[target.id] === id) { toast(`That feeder’s already full of ${itemName(id).toLowerCase()}.`); return; }
    if (have(id) < FEEDER_FILL) { toast(`You need ${FEEDER_FILL} ${itemName(id).toLowerCase()} to fill a feeder.`); return; }
    useItem(id, FEEDER_FILL); bump(stats, 'filled');
    editBlock(target.x, target.y, target.z, FEEDER_OF[id]);
    remeshAround(target.x, target.z); sfx.munch(); buzz(10);
    if (!firsts.includes('feeder')) { firsts.push('feeder'); toast('Feeder filled! It puts treats out when a baby that likes them comes by.'); }
    return;
  }
  if (!id) return;
  if (!have(id)) { emptyHint(id); return; }
  if (id === ITEM_SWORD) { swing(); return; }
  if (isTreat(id)) {
    if (throwCool > 0) return;
    throwCool = id === ITEM_SEEDS ? 0.2 : 0.3;
    useItem(id);
    if (net.isGuest) net.toHost({ t: 'throw', item: id, eye: player.eye(), fwd: player.forward() });
    else flock.throwTreat(id, player.eye(), player.forward());
    sfx.toss();
    return;
  }
  if (!target) return;
  const x = target.x + target.nx, y = target.y + target.ny, z = target.z + target.nz;
  const here = world.getBlock(x, y, z);
  if (here !== B.AIR && here !== B.WATER) return;
  if (id === ITEM_HOUSE) {
    if (target.ny !== 1) { toast('Put the house kit down on top of the ground.'); return; }
    if (player.flying) { toast('Land on the ground first, then put the house kit down in front of you.'); return; }
    useItem(id); bump(stats, 'placed', id);
    buildHouse(x, y, z);
    return;
  }
  if (id === B.DOOR) {
    // a door is two blocks tall: it needs room above
    const up = world.getBlock(x, y + 1, z);
    if (up !== B.AIR && up !== B.WATER) { toast('A door needs two blocks of room.'); return; }
    if (player.intersectsBlock(x, y, z) || player.intersectsBlock(x, y + 1, z)) return;
    if (editBlock(x, y, z, B.DOOR)) {
      editBlock(x, y + 1, z, B.DOOR_TOP);
      useItem(id); bump(stats, 'placed', id);
      remeshAround(x, z); buzz(8); sfx.place();
    }
    return;
  }
  if (SOLID[id] && player.intersectsBlock(x, y, z)) return;
  if (editBlock(x, y, z, id)) {
    useItem(id); bump(stats, 'placed', id);
    if (id === B.THRONE) buildThrone(x, y, z);
    remeshAround(x, z); buzz(8); sfx.place();
  }
}

// Tap a tame baby right in front of you (closer than the block you're pointing at) to pet it.
function petBaby(wildHint) { // wildHint: say so when it's a wild baby (not when you're holding a block to build with)
  const eye = player.eye(), fwd = player.forward();
  let best = null, bd = 3.2;
  for (const a of flock.animals) {
    const h = a.S.height * 0.5;
    const vx = a.p[0] - eye[0], vy = a.p[1] + h - eye[1], vz = a.p[2] - eye[2], d = Math.hypot(vx, vy, vz);
    if (d > bd) continue;
    const dot = (vx * fwd[0] + vy * fwd[1] + vz * fwd[2]) / (d || 1);
    if (dot > (d < 1.2 ? 0.6 : 0.88)) { bd = d; best = a; }
  }
  if (!best) return false;
  if (target && Math.hypot(target.x + 0.5 - eye[0], target.y + 0.5 - eye[1], target.z + 0.5 - eye[2]) < bd - 0.4) return false;
  if (!best.tame) {
    if (!wildHint) return false;
    toast(`That ${SPECIES[best.sp].name} is shy. Give it some ${itemName(best.S.treat).toLowerCase()} first and it’ll join your nursery.`);
    return true;
  }
  if (net.isGuest) net.toHost({ t: 'pet', id: best.id }); else flock.pet(best.id);
  floatFx([best.p[0], best.p[1] + best.S.height * 0.4, best.p[2]], 'heart');
  sfx.call(best.sp, 0.5); sfx.happy(); buzz(12);
  bump(stats, 'petted');
  if (best.grow >= 1) { openJobs(best); return true; } // grown-ups can be taught a job
  const who = callName(best.name, best.sp, 'Your');
  if (!firsts.includes('pet')) { firsts.push('pet'); toast(`Aww! ${who} loves a pat. Pets help babies grow up a little too.`); }
  else toast(`${who} loves that!`, 1600);
  return true;
}

// ---------- teaching a grown-up a job ----------
const JOB_TEXT = {
  wood:  { name: 'Fetch wood',  icon: B.LOG,      learn: 'fetch wood',  doing: 'fetching wood for you',  what: 'Finds a tree and brings you logs.', place: 'trees', spot: 'tree' },
  stone: { name: 'Fetch stone', icon: B.COBBLE,   learn: 'fetch stone', doing: 'fetching stone for you', what: 'Finds bare rock and brings you cobble.', place: 'bare rock', spot: 'rock' },
  seeds: { name: 'Find seeds',  icon: ITEM_SEEDS, learn: 'find seeds',  doing: 'finding seeds for you',  what: 'Scratches about in the grass for seeds.', place: 'grass', spot: 'grass' },
  follow: { name: 'Follow me', learn: 'follow you', doing: 'following you everywhere', what: 'Comes everywhere with you, like a pet.', place: 'you', spot: 'you' },
};
const BALL_SVG = '<svg class="job-play" viewBox="0 0 32 32" aria-hidden="true"><circle cx="16" cy="17" r="11" fill="#e8473a"/><path d="M5 17h22M16 6c-5 4-5 18 0 22" stroke="#fff6e8" stroke-width="2.4" fill="none"/></svg>';
const PAW_SVG = '<svg class="job-play" viewBox="0 0 32 32" aria-hidden="true"><g fill="#f3c9a0"><ellipse cx="16" cy="20" rx="7" ry="6"/><circle cx="8" cy="12" r="3.2"/><circle cx="13.5" cy="7.5" r="3.2"/><circle cx="18.5" cy="7.5" r="3.2"/><circle cx="24" cy="12" r="3.2"/></g></svg>';
const grownName = a => BABY_NAMES[a.name] ? `${BABY_NAMES[a.name]} the ${ADULT_NAME[a.sp]}` : `Your ${ADULT_NAME[a.sp]}`;
const fetchedWhat = id => id === B.LOG ? 'a log' : id === B.COBBLE ? 'some cobble' : 'some seeds';
let jobAnimal = null;
function openJobs(a) {
  jobAnimal = a;
  running = false; input.enabled = false; input.state.breaking = false;
  if (document.pointerLockElement) { pickerOpenFromLock = true; document.exitPointerLock(); }
  buildJobs();
  $('#jobcard').hidden = false;
}
function buildJobs() {
  const a = jobAnimal, nm = BABY_NAMES[a.name] || `your ${ADULT_NAME[a.sp]}`, treat = a.S.treat, got = have(treat) > 0;
  const tname = itemName(treat).toLowerCase();
  $('#job-title').textContent = `Teach ${nm} a job`;
  $('#job-now').textContent = a.job ? `${grownName(a)} is ${JOB_TEXT[a.job].doing}.` : `${grownName(a)} doesn’t have a job yet.`;
  const list = $('#job-list');
  list.innerHTML = '';
  for (const job of ['wood', 'stone', 'seeds', 'follow', null]) {
    const J = job && JOB_TEXT[job], on = (a.job || null) === job, b = document.createElement('button');
    b.type = 'button'; b.className = 'job' + (on ? ' on' : '');
    b.disabled = on || (!!job && !got);
    const tag = on ? '<em>Doing this now</em>' : job ? `<em><img alt="" src="${icons[treat]}">1 ${tname}</em>` : '<em>Free</em>';
    b.innerHTML = job ? `${job === 'follow' ? PAW_SVG : `<img alt="" src="${icons[J.icon]}">`}<b>${J.name}</b><span>${J.what}</span>${tag}`
      : `${BALL_SVG}<b>Just play</b><span>No job: wanders about and plays.</span>${tag}`;
    b.addEventListener('click', () => teachJob(job));
    list.appendChild(b);
  }
  $('#job-note').textContent = got
    ? `Teaching a job costs one ${tname}, ${nm}’s favourite treat. Grown-ups work by day, near where they are, and bring what they find straight to you.`
    : `You need 1 ${tname} (${nm}’s favourite treat) to teach a job. Grown-ups work by day and bring what they find to you.`;
}
function teachJob(job) {
  const a = jobAnimal;
  if (!a || (job && !useItem(a.S.treat))) return;
  if (net.isGuest) { net.toHost({ t: 'train', id: a.id, job }); a.job = job; } else flock.train(a.id, job, myNetId);
  sfx.happy(); sfx.call(a.sp, 0.55); buzz(15);
  floatFx([a.p[0], a.p[1] + a.S.height * 0.6, a.p[2]], 'heart');
  if (job) bump(stats, 'trained');
  const first = job && job !== 'follow' && !firsts.includes('trained');
  if (first) firsts.push('trained');
  toast(!job ? `${grownName(a)} is off to play. No more jobs for now.`
    : job === 'follow' ? `${grownName(a)} will follow you everywhere now! Tap it and pick Just play to let it stay.`
    : first ? `${grownName(a)} learned to ${JOB_TEXT[job].learn}! Each day it finds ${JOB_TEXT[job].place} near by and carries what it gets back to you. Animals don’t work at night.`
      : `${grownName(a)} learned to ${JOB_TEXT[job].learn}!`, first ? 7000 : 3000);
  closeJobs();
}
function closeJobs() {
  $('#jobcard').hidden = true;
  jobAnimal = null;
  pickerOpenFromLock = false;
  resume();
}
$('#job-close').addEventListener('click', closeJobs);
$('#jobcard').addEventListener('click', e => { if (e.target.id === 'jobcard') closeJobs(); });

function updateBreaking(dt) {
  const ring = $('#crosshair');
  if (hotbar[selected] === ITEM_SWORD && have(ITEM_SWORD)) {
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
    bump(stats, 'dug', target.id);
    const got = drops(target.id);
    for (const [item, n] of got) { addItem(item, n); bump(stats, 'got', item, n); }
    pickupPop(target, got);
    // let water flow back into a hole next to water
    const nearWater = [[1, 0, 0], [-1, 0, 0], [0, 0, 1], [0, 0, -1], [0, 1, 0]]
      .some(([dx, dy, dz]) => world.getBlock(target.x + dx, target.y + dy, target.z + dz) === B.WATER);
    editBlock(target.x, target.y, target.z, nearWater ? B.WATER : B.AIR);
    if (IS_DOOR(target.id)) {
      // the other half of the door comes away with it
      const oy = DOOR_TOPS.has(target.id) ? target.y - 1 : target.y + 1;
      if (IS_DOOR(world.getBlock(target.x, oy, target.z))) editBlock(target.x, oy, target.z, B.AIR);
    }
    remeshAround(target.x, target.z);
    buzz(15);
    sfx.dig();
    breakT.p = 0; breakT.key = '';
  }
  ring.style.setProperty('--p', Math.min(1, breakT.p).toFixed(3));
}

function buzz(ms) { if (input.usingTouch) navigator.vibrate?.(ms); }

function buildHotbar() {
  const bar = $('#hotbar');
  bar.innerHTML = '';
  hotbar.forEach((id, i) => {
    const b = document.createElement('button');
    b.className = 'slot' + (i === selected ? ' sel' : '');
    b.innerHTML = id ? `<img alt="" src="${icons[id]}"><span class="n"></span>` : '';
    b.addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); selectSlot(i); });
    bar.appendChild(b);
  });
  updateCounts();
}
// Shows how many of each hotbar item you have; run-out items go grey.
function updateCounts() {
  const slots = $('#hotbar').children;
  hotbar.forEach((id, i) => {
    const el = slots[i];
    if (!el) return;
    const n = have(id);
    el.classList.toggle('none', !!id && !n);
    el.setAttribute('aria-label', id ? `${itemName(id)}${TOOLS.has(id) ? '' : ', ' + n}` : 'Empty slot');
    const c = el.querySelector('.n');
    if (c) c.textContent = !n || TOOLS.has(id) ? '' : n > 999 ? '999+' : n;
  });
  updateHeld();
}
let hintCool = 0;
function emptyHint(id) {
  if (performance.now() < hintCool) return;
  hintCool = performance.now() + 4000;
  const made = RECIPES.find(r => r.out === id);
  toast(made ? `You’re out of ${itemName(id).toLowerCase()}. Open your bag to make more.` : `You’re out of ${itemName(id).toLowerCase()}. Dig or find some more.`);
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
  buildBag();
  $('#picker').hidden = false;
}
function buildBag() { buildOwned(); buildMake(); }
function buildOwned() {
  const grid = $('#picker-grid');
  grid.innerHTML = '';
  const owned = BAG_ORDER.filter(id => have(id) > 0);
  for (const id of owned) {
    const b = document.createElement('button');
    const n = have(id);
    b.className = 'pick' + (hotbar[selected] === id ? ' cur' : '');
    b.innerHTML = `<img alt="" src="${icons[id]}"><span>${itemName(id)}</span>${TOOLS.has(id) ? '' : `<span class="n">${n}</span>`}`;
    b.addEventListener('click', () => {
      // put it in the chosen slot (swapping if it's already elsewhere on the hotbar)
      const was = hotbar.indexOf(id);
      if (was >= 0 && was !== selected) hotbar[was] = hotbar[selected];
      hotbar[selected] = id; buildHotbar(); closePicker();
    });
    grid.appendChild(b);
  }
  if (!owned.length) grid.innerHTML = '<p class="bag-empty">Your bag is empty. Dig some blocks!</p>';
}

// ---- the Make section: picture cards in tabs ----
let bagTab = 'have', cards = [];
const stickName = (id, k) => id === ITEM_STICK && k === 1 ? 'Stick' : itemName(id);
function buildTabs() {
  const tabs = $('#craft-tabs');
  tabs.innerHTML = '';
  for (const [key, label] of [['have', 'Your things'], ...TABS, ['goals', '★ Goals']]) {
    const t = document.createElement('button');
    t.className = 'tab' + (key === bagTab ? ' on' : '');
    t.setAttribute('role', 'tab'); t.setAttribute('aria-selected', key === bagTab);
    const ready = RECIPES.some(r => r.tab === key && canMake(r));
    t.innerHTML = `${label}${ready ? '<i class="dot" aria-label="(you can make something here)"></i>' : ''}`;
    t.addEventListener('click', () => { bagTab = key; buildMake(); });
    tabs.appendChild(t);
  }
}
function buildMake() {
  buildTabs();
  const mine = bagTab === 'have', goals = bagTab === 'goals';
  $('#bag-tip').hidden = $('#picker-grid').hidden = !mine;
  $('#table-note').hidden = $('#craft-list').hidden = mine || goals;
  $('#goal-list').hidden = !goals;
  if (goals) buildGoals();
  const list = $('#craft-list');
  list.innerHTML = '';
  cards = [];
  $('#bag-body').scrollTop = 0;
  for (const r of RECIPES.filter(q => q.tab === bagTab)) {
    const c = document.createElement('div');
    c.className = 'card';
    c.innerHTML = `<div class="card-out"><img alt="" src="${icons[r.out]}">${r.n > 1 ? `<b class="times">×${r.n}</b>` : ''}</div>` +
      `<div class="card-name">${itemName(r.out)}</div>` +
      `<div class="card-needs">${r.needs.map(([id, k]) => `<span data-id="${id}" data-k="${k}"><img alt="" src="${icons[id]}"><em></em></span>`).join('')}</div>` +
      `<div class="card-table"><img alt="" src="${icons[B.TABLE]}">Needs a table</div>` +
      `<div class="card-go"><button class="make">Make</button><button class="all"></button></div>`;
    c.querySelector('.make').setAttribute('aria-label', `Make ${r.n} ${itemName(r.out)} from ${r.needs.map(([id, k]) => k + ' ' + stickName(id, k)).join(' and ')}`);
    holdToRepeat(c.querySelector('.make'), () => makeIt(r, 1));
    c.querySelector('.all').addEventListener('click', () => makeIt(r, Infinity));
    list.appendChild(c);
    cards.push([c, r]);
  }
  refreshMake();
}
// Updates the cards' counts and buttons without rebuilding them (so a held button keeps working).
function refreshMake() {
  const table = atTable();
  $('#table-note').textContent = table ? 'You’re at a crafting table: you can make everything.'
    : 'Some things need a crafting table close by. Make one from 4 wood and place it.';
  $('#table-note').classList.toggle('ok', table);
  for (const [c, r] of cards) {
    const n = timesYouCan(r), blocked = r.table && !table;
    c.classList.toggle('ready', n > 0 && !blocked);
    c.classList.toggle('locked', blocked);
    for (const s of c.querySelectorAll('.card-needs span')) {
      const id = +s.dataset.id, k = +s.dataset.k;
      s.classList.toggle('short', have(id) < k);
      s.querySelector('em').textContent = `${Math.min(have(id), 999)}/${k}`;
      s.title = `${k} ${stickName(id, k)}`;
    }
    c.querySelector('.make').disabled = n <= 0 || blocked;
    const all = c.querySelector('.all');
    all.hidden = n < 2 || blocked;
    all.textContent = `All ×${n}`;
    all.setAttribute('aria-label', `Make ${n * r.n} ${itemName(r.out)}`);
  }
}
function makeIt(r, times) {
  const made = craft(r, times);
  if (!made) return false;
  const card = cards.find(([, q]) => q === r)?.[0];
  card?.classList.remove('pop'); void card?.offsetWidth; card?.classList.add('pop');
  const y = $('#bag-body').scrollTop;
  const grid = $('#picker-grid');
  grid.style.minHeight = grid.offsetHeight + 'px';
  buildOwned();
  grid.style.minHeight = '';
  refreshMake();
  buildTabs();
  $('#bag-body').scrollTop = y;
  if (!firsts.includes('craft')) { firsts.push('craft'); toast('You made something! Tap it in your bag to hold it.'); }
  return true;
}
// Press and hold: makes one straight away, then keeps going while you hold.
function holdToRepeat(btn, fn) {
  let timer = 0;
  const stop = () => { clearTimeout(timer); timer = 0; };
  btn.addEventListener('pointerdown', e => {
    if (btn.disabled) return;
    e.preventDefault();
    fn();
    const again = delay => { timer = setTimeout(() => { if (!btn.disabled && fn()) again(Math.max(70, delay * 0.8)); else stop(); }, delay); };
    again(450);
  });
  for (const ev of ['pointerup', 'pointerleave', 'pointercancel']) btn.addEventListener(ev, stop);
  btn.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fn(); } });
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
  if (!running && !$('#jobcard').hidden) { $('#jobcard').hidden = true; jobAnimal = null; }
  running = false; input.enabled = false;
  input.state.breaking = false;
  saveGame();
  $('#hud').hidden = true;
  $('#menu').hidden = false;
  $('#btn-play').textContent = 'Resume';
  $('#menu').classList.add('paused');
}

function resume() {
  $('#menu').hidden = true;
  $('#new-world').hidden = true;
  $('#hud').hidden = false;
  running = true; input.enabled = true;
  input.look.dx = input.look.dy = 0;
  if (!input.usingTouch && !coarse) canvas.requestPointerLock?.();
}

// ---------- wardrobe: your name, your character and what you wear ----------
// While it's open the camera swings round to look at you, so you can see your outfit change.
const wardrobe = { open: false, spin: 0, drag: null, idle: 0 };
// Clothes you sew yourself in the Wardrobe, from wool (grown-up sheep leave it) and flowers.
// The basics are free; these unlock on this device once you've sewn them.
const SEW = [
  { slot: 0, v: 4, needs: [[B.WOOL, 3], [B.FLOWER_YELLOW, 1]] },                          // chick jumper
  { slot: 0, v: 5, needs: [[B.WOOL, 4], [B.FLOWER_RED, 1]] },                             // hero cape
  { slot: 2, v: 3, needs: [[B.WOOL, 4], [ITEM_STICK, 1]] },                               // dungarees
  { slot: 2, v: 4, needs: [[B.WOOL, 2], [B.FLOWER_WHITE, 2]] },                           // tutu
  { slot: 4, v: 5, needs: [[B.WOOL, 2], [ITEM_EGG, 1]] },                                 // chick hat
  { slot: 4, v: 6, needs: [[B.WOOL, 2], [B.FLOWER_RED, 1], [B.FLOWER_YELLOW, 1]] },       // party hat
  { slot: 4, v: 7, needs: [[B.WOOL, 2], [ITEM_CLOVER, 1]] },                              // bunny ears
  { slot: 4, v: 8, needs: [[B.FLOWER_RED, 2], [B.FLOWER_YELLOW, 2], [B.FLOWER_WHITE, 2]] }, // flower crown
];
const sewOf = (slot, v) => SEW.find(s => s.slot === slot && s.v === v);
const isSewn = (slot, v) => !sewOf(slot, v) || (settings.sewn || []).includes(slot + ':' + v);
const LOCK_SVG = '<svg class="lock" viewBox="0 0 16 16" aria-hidden="true"><path d="M4 7V5a4 4 0 0 1 8 0v2" fill="none" stroke="currentColor" stroke-width="2"/><rect x="2.5" y="7" width="11" height="8" rx="2" fill="currentColor"/></svg>';
function sewBox(slot, v, name) {
  const s = sewOf(slot, v), box = document.createElement('div'), can = s.needs.every(([id, k]) => have(id) >= k);
  box.className = 'sew-box';
  box.innerHTML = `<b>Sew ${/^[aeiou]/i.test(name) ? 'an' : 'a'} ${name.toLowerCase()}</b><span class="sew-needs">${s.needs.map(([id, k]) =>
    `<span class="${have(id) >= k ? '' : 'short'}"><img alt="" src="${icons[id]}"><em>${Math.min(have(id), k)}/${k}</em>${itemName(id)}</span>`).join('')}</span>` +
    `<button type="button" class="primary sew-go"${can ? '' : ' disabled'}>Sew it!</button>` +
    (can ? '' : `<p class="note">${s.needs.some(([id]) => id === B.WOOL) ? 'Grown-up sheep leave wool on the ground. ' : ''}Flowers grow wild in the grass.</p>`);
  box.querySelector('.sew-go').addEventListener('click', () => {
    if (!s.needs.every(([id, k]) => have(id) >= k)) return;
    for (const [id, k] of s.needs) useItem(id, k);
    settings.sewn = [...new Set([...(settings.sewn || []), slot + ':' + v])];
    wardrobe.sewing = null;
    bump(stats, 'sewn');
    saveGame();
    sfx.grown(); buzz(20);
    setFit(slot, v);
  });
  return box;
}
const WARD_ROWS = [
  { label: 'Top', style: 0, opts: M.TOPS, colour: 1 },
  { label: 'Bottoms', style: 2, opts: M.BOTTOMS, colour: 3, hide: f => f[0] === 3 },  // a dress has its own skirt
  { label: 'Hat', style: 4, opts: M.HATS, colour: 5, hideColour: f => f[4] === 0 || M.HAT_FIXED_COLOUR.has(f[4]) },
  { label: 'Shoes', colour: 6 },
  { label: 'Bag', style: 7, opts: ['No bag', 'Bag'] },
];
function setFit(i, v) {
  const f = myFit(); f[i] = v;
  settings.fits = { ...(settings.fits || {}), [settings.char]: f };
  store.set(SET_KEY, settings);
  buildWardrobe();
}
function buildWardrobe() {
  const f = myFit(), body = $('#ward-rows');
  $('#ward-name').placeholder = CHAR_NAMES[settings.char];
  if (document.activeElement !== $('#ward-name')) $('#ward-name').value = cleanNick(settings.nick);
  for (const b of document.querySelectorAll('#ward-char .chip')) b.classList.toggle('on', b.dataset.char === settings.char);
  body.textContent = '';
  for (const r of WARD_ROWS) {
    if (r.hide && r.hide(f)) continue;
    const row = document.createElement('div');
    row.className = 'ward-row';
    row.innerHTML = `<span class="ward-label">${r.label}</span>`;
    if (r.opts) {
      const chips = document.createElement('div'); chips.className = 'chips';
      r.opts.forEach((name, v) => {
        const b = document.createElement('button');
        const open = isSewn(r.style, v), picking = wardrobe.sewing && wardrobe.sewing[0] === r.style && wardrobe.sewing[1] === v;
        b.type = 'button'; b.className = 'chip' + (f[r.style] === v ? ' on' : '') + (open ? '' : ' locked') + (picking ? ' picking' : '');
        b.innerHTML = open ? name : LOCK_SVG + name;
        if (!open) b.setAttribute('aria-label', name + ' (sew it to unlock)');
        b.addEventListener('click', () => { if (open) { wardrobe.sewing = null; setFit(r.style, v); } else { wardrobe.sewing = picking ? null : [r.style, v]; buildWardrobe(); } });
        chips.appendChild(b);
      });
      row.appendChild(chips);
      if (wardrobe.sewing && wardrobe.sewing[0] === r.style) row.appendChild(sewBox(r.style, wardrobe.sewing[1], r.opts[wardrobe.sewing[1]]));
    }
    if (r.colour !== undefined && !(r.hideColour && r.hideColour(f))) {
      const sw = document.createElement('div'); sw.className = 'swatches';
      M.CLOTH_COLORS.forEach((c, v) => {
        const b = document.createElement('button');
        b.type = 'button'; b.className = 'swatch' + (f[r.colour] === v ? ' on' : '');
        b.style.background = c; b.setAttribute('aria-label', `${r.label}: ${M.CLOTH_COLOR_NAMES[v]}`);
        b.addEventListener('click', () => setFit(r.colour, v));
        sw.appendChild(b);
      });
      row.appendChild(sw);
    }
    body.appendChild(row);
  }
}
function openWardrobe() {
  if (!world || !player) return;
  wardrobe.open = true; wardrobe.spin = 0; wardrobe.idle = 0; wardrobe.camAngle = undefined; wardrobe.sewing = null;
  $('#menu').hidden = true;
  $('#wardrobe').hidden = false;
  document.body.classList.add('in-wardrobe');
  buildWardrobe();
}
function closeWardrobe() {
  settings.nick = cleanNick($('#ward-name').value);
  store.set(SET_KEY, settings);
  applySettings();
  wardrobe.open = false;
  $('#wardrobe').hidden = true;
  document.body.classList.remove('in-wardrobe');
  $('#menu').hidden = false;
}
// Camera in front of you looking back, framed so you sit in the clear part of the screen above the wardrobe.
function selfieCam(dt) {
  if (!wardrobe.drag) { wardrobe.idle += dt; if (wardrobe.idle > 2) wardrobe.spin += dt * 0.5; }
  const W = window.innerWidth, H = window.innerHeight, v = $('#ward-view').getBoundingClientRect();
  const tanY = Math.tan(35 * Math.PI / 180), tanX = tanY * W / H;
  const nx = (v.left + v.width / 2) / W * 2 - 1, ny = 1 - (v.top + v.height / 2) / H * 2;
  const show = Math.max(0.2, Math.min(v.height / H, (v.width / W) * (W / H) * 1.25)); // share of the screen the kid can fill
  let dist = Math.max(2.4, Math.min(7.5, 2.55 / (2 * tanY * show))); // room for tall hats and ears
  const p = player.pos, c = [p[0], p[1] + 0.86, p[2]];
  const dirAt = a => { const d = [Math.sin(a), 0.22, Math.cos(a)], l = Math.hypot(...d); return d.map(v => v / l); };
  // how far the camera can go that way before a wall is in the way
  const clear = (dir, max) => {
    for (let t = 0.4; t <= max; t += 0.1)
      if (SOLID[world.getBlock(Math.floor(c[0] + dir[0] * t), Math.floor(c[1] + dir[1] * t), Math.floor(c[2] + dir[2] * t))]) return Math.max(0.9, t - 0.3);
    return max;
  };
  if (wardrobe.camAngle === undefined) {
    // pick where the camera goes once, when the wardrobe opens: in front of you, or the most open way round
    const f = player.forward(), a0 = Math.atan2(f[0], f[2]);
    let best = a0, bestD = -1;
    for (const off of [0, 0.8, -0.8, 1.6, -1.6, 2.4, -2.4, Math.PI]) {
      const d = clear(dirAt(a0 + off), dist);
      if (d > bestD + 0.3) { best = a0 + off; bestD = d; }
      if (d >= dist) break;
    }
    wardrobe.camAngle = best; wardrobe.spin = best - a0;   // still facing the camera
  }
  const dir = dirAt(wardrobe.camAngle);
  dist = clear(dir, dist);
  const eye = c.map((v, i) => v + dir[i] * dist);
  // look at a point beside you so that you show up in the middle of the clear area
  const back = dir.map(v => -v), right = [-back[2], 0, back[0]], rl = Math.hypot(...right) || 1;
  for (let i = 0; i < 3; i++) right[i] /= rl;
  const up = [right[1] * back[2] - right[2] * back[1], right[2] * back[0] - right[0] * back[2], right[0] * back[1] - right[1] * back[0]];
  const aim = c.map((v, i) => v - right[i] * nx * tanX * dist - up[i] * ny * tanY * dist);
  const fd = aim.map((v, i) => v - eye[i]), fl = Math.hypot(...fd);
  return { eye, fwd: fd.map(v => v / fl) };
}
$('#btn-wardrobe').addEventListener('click', openWardrobe);
$('#ward-done').addEventListener('click', closeWardrobe);
$('#ward-name').addEventListener('input', () => { settings.nick = cleanNick($('#ward-name').value); store.set(SET_KEY, settings); });
$('#ward-name').addEventListener('keydown', e => { if (e.key === 'Enter') e.target.blur(); });
for (const b of document.querySelectorAll('#ward-char .chip')) {
  b.querySelector('svg').innerHTML = M.KID_FACE_SVG[b.dataset.char];
  b.addEventListener('click', () => { settings.char = b.dataset.char; applySettings(); buildWardrobe(); });
}
$('#ward-random').addEventListener('click', () => {
  const r = n => Math.random() * n | 0, c = M.CLOTH_COLORS.length;
  const pick = (slot, n) => { const ok = [...Array(n).keys()].filter(v => isSewn(slot, v)); return ok[r(ok.length)]; };
  const f = [pick(0, M.TOPS.length), r(c), pick(2, M.BOTTOMS.length), r(c), pick(4, M.HATS.length), r(c), r(c), r(2)];
  wardrobe.sewing = null;
  settings.fits = { ...(settings.fits || {}), [settings.char]: f };
  store.set(SET_KEY, settings);
  buildWardrobe(); sfx.happy();
});
// drag across yourself to turn round
const wv = $('#ward-view');
wv.addEventListener('pointerdown', e => { wardrobe.drag = { x: e.clientX, spin: wardrobe.spin }; wv.setPointerCapture?.(e.pointerId); });
wv.addEventListener('pointermove', e => { if (wardrobe.drag) wardrobe.spin = wardrobe.drag.spin + (e.clientX - wardrobe.drag.x) * 0.012; });
for (const ev of ['pointerup', 'pointercancel']) wv.addEventListener(ev, () => { wardrobe.drag = null; wardrobe.idle = 0; });
$('#ward-photo').addEventListener('click', () => $('#btn-photo').click());

function enterFullscreen() {
  // iPad Safari's fullscreen mode can drop the HUD layer after a rotation, so iOS stays out of it
  if (!coarse || isIOS) return;
  const el = document.documentElement;
  const req = el.requestFullscreen || el.webkitRequestFullscreen;
  if (req && !document.fullscreenElement) {
    Promise.resolve(req.call(el)).then(() => screen.orientation?.lock?.('landscape')).catch(() => {});
  }
}

// ---------- version and what's new ----------
const esc = s => s.replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
// Players from before version numbers (they have a saved world but no version noted) last saw version 17.
const seenVersion = () => settings.seenVersion || (store.get(SAVE_KEY) ? 17 : 0);
function buildVersion() {
  const seen = seenVersion(), fresh = seen > 0 && seen < VERSION;
  const pill = $('#version');
  pill.innerHTML = `Version <b>${VERSION}</b> · ${RELEASED}`;
  pill.classList.toggle('new', fresh);
  $('#changelog').innerHTML = CHANGES.map(([v, date, head, list], k) =>
    `<section class="${k === 0 ? 'latest' : ''}"><h3>${v}. ${esc(head)}<span>${esc(date)}</span></h3><ul>${list.map(t => `<li>${esc(t)}</li>`).join('')}</ul></section>`).join('');
  if (fresh) $('#whats-new').open = true;
}
buildVersion();
$('#version').addEventListener('click', () => {
  const d = $('#whats-new');
  d.open = true;
  d.scrollIntoView({ behavior: 'smooth', block: 'start' });
});
// After an update, say so once when you start playing.
function noteUpdate() {
  const seen = seenVersion();
  if (seen === VERSION) return;
  if (seen) setTimeout(() => toast(`Updated to version ${VERSION}: ${CHANGES[0][2]}! Open the pause menu and tap What’s new to see everything.`), 1200);
  settings.seenVersion = VERSION;
  store.set(SET_KEY, settings);
  $('#version').classList.remove('new');
}

$('#btn-play').addEventListener('click', () => {
  if (!renderer) return;
  sfx.unlock();
  enterFullscreen();
  if (!world) startWorld(store.get(SAVE_KEY));
  if (coarse) input.setTouchMode(true);
  resume();
  hideHintLater();
  noteUpdate();
});
$('#btn-new').addEventListener('click', () => { $('#new-world').hidden = !$('#new-world').hidden; });
$('#btn-create').addEventListener('click', () => {
  if (!renderer) return;
  const raw = $('#seed-input').value.trim();
  let seed;
  if (raw) seed = /^\d+$/.test(raw) ? (+raw >>> 0) : [...raw].reduce((h, ch) => (Math.imul(h, 31) + ch.charCodeAt(0)) >>> 0, 7);
  sfx.unlock();
  enterFullscreen();
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
  settings.char = charOf(settings.char);
  for (const b of document.querySelectorAll('#set-char .char')) { const on = b.dataset.char === settings.char; b.classList.toggle('on', on); b.setAttribute('aria-checked', on); }
  store.set(SET_KEY, settings);
}
sView.addEventListener('input', () => { settings.view = +sView.value; applySettings(); });
sSens.addEventListener('input', () => { settings.sens = +sSens.value; applySettings(); });
sAuto.addEventListener('change', () => { settings.autoJump = sAuto.checked; applySettings(); });
sFps.addEventListener('change', () => { settings.showFps = sFps.checked; applySettings(); });
sSound.addEventListener('change', () => { settings.sound = sSound.checked; applySettings(); });
for (const b of document.querySelectorAll('#set-char .char')) {
  b.querySelector('svg').innerHTML = M.KID_FACE_SVG[b.dataset.char];
  b.addEventListener('click', () => { settings.char = b.dataset.char; applySettings(); });
}
applySettings();

if (store.get(SAVE_KEY)) $('#btn-play').textContent = 'Continue';

function showError(msg) { const e = $('#menu-error'); e.textContent = msg; e.hidden = false; }

document.addEventListener('visibilitychange', () => { if (document.hidden) { saveGame(); if (running) pause(); } });
window.addEventListener('pagehide', saveGame);
// After a rotation iOS can leave the page scrolled or the HUD layer unpainted: snap back and repaint it
function relayout() {
  window.scrollTo(0, 0);
  const hud = $('#hud');
  if (hud.hidden) return;
  hud.style.display = 'none'; void hud.offsetHeight; hud.style.display = '';
}
window.addEventListener('orientationchange', () => setTimeout(relayout, 300));
window.addEventListener('resize', relayout);
screen.orientation?.addEventListener?.('change', () => setTimeout(relayout, 300));
setInterval(() => { if (running && world?.editsChanged !== undefined) saveGame(); }, 10000);

// ---------- play together ----------

// Other players drawn as Lachie or Charli, walking, looking about, with a name tag overhead.
const tagEls = new Map();
// Each character-and-outfit is its own model, built the first time someone wears it.
const kidModels = new Set();
function kidKey(char, fit) {
  const key = char + ':' + fit.join('.');
  if (!kidModels.has(key)) { kidModels.add(key); renderer.addModel(key, M.kidModel(char, fit)); }
  return key;
}
function kidInstances(dt) {
  const lists = new Map(), shadows = [];
  const add = (key, ...v) => { if (!lists.has(key)) lists.set(key, []); lists.get(key).push(...v); };
  if (wardrobe.open && player) {
    // in the wardrobe you see yourself, standing still and turning slowly so you see your outfit from all sides
    const p = player.pos;
    add(kidKey(settings.char, myFit()), p[0], p[1], p[2], player.yaw + Math.PI + wardrobe.spin, 1, 0, 0, 0, 0, 0, 0, 0);
    shadows.push(p[0], p[1] + 0.015, p[2], 0, 0.75, 0, 0, 0, 0, 0, 0, 0);
  }
  for (const o of others.values()) {
    if (o.id === myNetId) continue;
    const k = Math.min(1, dt * 12);
    const before = [o.p[0], o.p[2]];
    const far = Math.hypot(o.tp[0] - o.p[0], o.tp[1] - o.p[1], o.tp[2] - o.p[2]) > 6;
    for (let i = 0; i < 3; i++) o.p[i] = far ? o.tp[i] : o.p[i] + (o.tp[i] - o.p[i]) * k;
    o.yaw += Math.atan2(Math.sin(o.tyaw - o.yaw), Math.cos(o.tyaw - o.yaw)) * k;
    const sp = dt > 0 ? Math.hypot(o.p[0] - before[0], o.p[2] - before[1]) / dt : 0;
    o.speed += (Math.min(sp, 8) - o.speed) * Math.min(1, dt * 8);
    if (o.speed > 0.3 && !o.sit) o.phase += dt * (4 + o.speed * 1.6);
    else o.phase += (Math.round(o.phase / Math.PI) * Math.PI - o.phase) * Math.min(1, dt * 10);
    const stride = Math.sin(o.phase) * Math.min(0.75, o.speed * 0.22);
    const bob = o.speed > 0.3 && !o.sit ? Math.abs(Math.sin(o.phase)) * 0.04 : 0;
    const nod = Math.max(-0.5, Math.min(0.5, -o.pitch * 0.5));
    add(kidKey(o.char, o.fit), o.p[0], o.p[1], o.p[2], o.yaw + Math.PI, 1, bob, stride, 0, 0, nod, 0, 0);
    shadows.push(o.p[0], o.p[1] + 0.015, o.p[2], 0, 0.75, 0, 0, 0, 0, 0, 0, 0);
  }
  return {
    groups: [...lists].map(([model, v]) => ({ model, data: new Float32Array(v), count: v.length / 12 })),
    shadowGroups: [{ data: new Float32Array(shadows), count: shadows.length / 12 }],
  };
}
// Name tags over other players. Someone off screen (or behind you) gets their tag pinned to the
// screen edge with an arrow pointing their way and how far off they are, so you can always find each other.
function updateTags() {
  const box = $('#tags');
  for (const [id, el] of tagEls) if (!others.has(id) || id === myNetId) { el.remove(); tagEls.delete(id); }
  const W = window.innerWidth, H = window.innerHeight;
  const eye = player.eye(), f = player.forward();
  const r = [Math.cos(player.yaw), 0, -Math.sin(player.yaw)];
  const u = [r[1] * f[2] - r[2] * f[1], r[2] * f[0] - r[0] * f[2], r[0] * f[1] - r[1] * f[0]];
  for (const o of others.values()) {
    if (o.id === myNetId) continue;
    let el = tagEls.get(o.id);
    if (!el) {
      el = document.createElement('div');
      el.innerHTML = '<span class="arrow" aria-hidden="true"></span><span class="name"></span>';
      box.appendChild(el); tagEls.set(o.id, el);
    }
    const tx = o.p[0], ty = o.p[1] + 1.65, tz = o.p[2];
    const d = Math.hypot(tx - eye[0], tz - eye[2]);
    const name = nameOf(o) + (d > 12 ? ` · ${Math.round(d)} m` : '');
    if (el.lastName !== name) { el.querySelector('.name').textContent = name; el.lastName = name; }
    pinTag(el, 'tag ' + o.char, tx, ty, tz, W, H, eye, f, r, u);
  }
  // The home arrow: when you wander far from your tame babies, it points the way back to them.
  let n = 0, hx = 0, hy = 0, hz = 0;
  for (const a of flock.animals) if (a.tame) { n++; hx += a.p[0]; hy += a.p[1]; hz += a.p[2]; }
  const far = n && Math.hypot(hx / n - eye[0], hz / n - eye[2]);
  if (!homeEl) {
    homeEl = document.createElement('div');
    homeEl.innerHTML = '<span class="arrow" aria-hidden="true"></span><span class="name"></span>';
    box.appendChild(homeEl);
  }
  homeEl.hidden = !(far > 35);
  if (homeEl.hidden) return;
  const label = `Nursery · ${Math.round(far)} m`;
  if (homeEl.lastName !== label) { homeEl.querySelector('.name').textContent = label; homeEl.lastName = label; }
  pinTag(homeEl, 'tag home', hx / n, hy / n + 1.2, hz / n, W, H, eye, f, r, u);
}
let homeEl = null;
// Puts a tag over a point, or pins it to the screen edge with an arrow when the point is off screen.
function pinTag(el, cls, tx, ty, tz, W, H, eye, f, r, u) {
    const at = project(tx, ty, tz);
    const onScreen = at && at[0] > 30 && at[0] < W - 30 && at[1] > 50 && at[1] < H - 30;
    el.className = cls + (onScreen ? '' : ' edge');
    if (onScreen) { el.style.left = at[0] + 'px'; el.style.top = at[1] + 'px'; return; }
    // direction on screen towards them: right/up in camera space (behind you counts as "turn this way")
    const rel = [tx - eye[0], ty - eye[1], tz - eye[2]];
    let dx = rel[0] * r[0] + rel[1] * r[1] + rel[2] * r[2];
    let dy = -(rel[0] * u[0] + rel[1] * u[1] + rel[2] * u[2]);
    const dz = rel[0] * f[0] + rel[1] * f[1] + rel[2] * f[2];
    if (dz < 0) dy = Math.max(dy, 0.25 * Math.abs(dx) + 0.01); // behind: keep the tag low on the screen, to the side to turn
    const l = Math.hypot(dx, dy) || 1; dx /= l; dy /= l;
    const hw = W / 2 - 70, hh = H / 2 - 56;
    const t = Math.min(hw / Math.max(Math.abs(dx), 1e-3), hh / Math.max(Math.abs(dy), 1e-3));
    el.style.left = (W / 2 + dx * t) + 'px'; el.style.top = (H / 2 + dy * t) + 'px';
    el.querySelector('.arrow').style.transform = `rotate(${Math.atan2(dy, dx)}rad)`;
}

function addOther(id, char) {
  const o = { id, joined: performance.now(), char: charOf(char), nick: '', fit: M.cleanFit(null, charOf(char)), p: [...player.pos], tp: [...player.pos], yaw: 0, tyaw: 0, pitch: 0, held: null, sit: false, phase: 0, speed: 0 };
  others.set(id, o);
  return o;
}
function setPose(o, p, yaw, pitch, held, sit, char, nick, fit) {
  if (!o.seen) { o.p = [...p]; o.yaw = yaw; o.seen = true; }
  o.tp = p; o.tyaw = yaw; o.pitch = pitch; o.held = held; o.sit = !!sit;
  o.heard = performance.now(); o.warned = false;
  if (char) o.char = charOf(char);
  if (typeof nick === 'string') o.nick = cleanNick(nick);
  if (Array.isArray(fit)) o.fit = M.cleanFit(fit, o.char);
}
function myPose() {
  return [+player.pos[0].toFixed(2), +player.pos[1].toFixed(2), +player.pos[2].toFixed(2), +player.yaw.toFixed(3), +player.pitch.toFixed(2), running ? hotbar[selected] : null, seat ? 1 : 0];
}

// Sends what's changed: block edits straight away, poses and the world state a few times a second.
function netStep(dt) {
  if (!net.active) return;
  if (netEdits.length) {
    const msg = { t: 'e', b: netEdits.splice(0) };
    if (net.isHost) net.broadcast(msg); else net.toHost(msg);
  }
  if (net.isGuest) {
    poseTimer -= dt;
    if (poseTimer <= 0) { poseTimer = 0.1; net.toHost({ t: 'p', pose: myPose(), char: settings.char, nick: myName(), fit: myFit() }); }
    return;
  }
  netTimer -= dt;
  if (netTimer > 0 || !net.guests) return;
  netTimer = 0.12;
  sendAnimals = !sendAnimals;
  for (const o of others.values()) {
    if (!o.warned && performance.now() - (o.heard || o.joined) > 6000) { o.warned = true; toast(`Can’t hear from ${nameOf(o)}’s device. They may need to rejoin.`); }
  }
  const pl = [[0, settings.char, ...myPose(), myName(), myFit()]];
  for (const o of others.values()) pl.push([o.id, o.char, ...o.tp, o.tyaw, o.pitch, o.held, o.sit ? 1 : 0, o.nick, o.fit]);
  const ev = netEvents.splice(0);
  const common = { t: 's', clock: +clock.toFixed(5), nights, crown, counts: flock.counts(), pl, sn: snakes.snapshot(), rd: raiders.snapshot(), tr: flock.treatSnapshot(), gf: flock.giftSnapshot(), wx: weather.snapshot(), ev };
  for (const [id] of net.conns) {
    const o = others.get(id);
    // animals go every other update (about 4 a second): the copies glide in between
    net.send(id, sendAnimals ? { ...common, a: flock.snapshot(o ? o.tp : player.pos, 64) } : common);
  }
}

net.on('message', (from, msg) => {
  if (!msg || typeof msg !== 'object' || !world) return;
  if (net.isHost) hostMessage(from, msg); else guestMessage(msg);
});
net.on('leave', id => {
  const o = others.get(id);
  others.delete(id);
  if (o) toast(`${nameOf(o)} left the game.`);
  updateRoomUi();
});
net.on('lost', () => {
  others.clear(); updateTags();
  backToOwnWorld();
  toast('Lost the connection to the host’s game. You’re back in your own world.');
});

function hostMessage(from, msg) {
  const o = others.get(from);
  switch (msg.t) {
    case 'hello': {
      const n = addOther(from, msg.char);
      setPose(n, n.p, 0, 0, null, 0, msg.char, msg.nick, msg.fit);
      const f = player.forward(), pos = [player.pos[0] + f[0] * 2, player.pos[1] + 0.2, player.pos[2] + f[2] * 2];
      n.p = [...pos]; n.tp = [...pos];
      // the world's block edits go in pieces first: some browsers only take smallish messages
      let part = {}, size = 0;
      for (const [key, arr] of Object.entries(world.serializeEdits())) {
        part[key] = arr; size += arr.length * 6;
        if (size > 20000) { net.send(from, { t: 'we', edits: part }); part = {}; size = 0; }
      }
      net.send(from, { t: 'w', id: from, seed: world.seed, edits: part, clock, nights, crown, pos, yaw: player.yaw + Math.PI });
      toast(`${nameOf(n)} joined your world!`);
      sfx.happy();
      updateRoomUi();
      break;
    }
    case 'p': if (Array.isArray(msg.pose)) {
      const o = others.get(from) || addOther(from, msg.char); const [x, y, z, yaw, pitch, held, sit] = msg.pose; setPose(o, [x, y, z], yaw, pitch, held, sit, msg.char, msg.nick, msg.fit); } break;
    case 'e':
      for (const [x, y, z, id] of msg.b || []) if (BLOCKS[id] || id === B.AIR) { world.applyEdit(x, y, z, id); remeshAround(x, z); }
      net.broadcast(msg, from);
      break;
    case 'throw': if (isTreat(msg.item)) flock.throwTreat(msg.item, msg.eye, msg.fwd); break;
    case 'swing': if (!snakes.swing(msg.eye, msg.fwd)) raiders.swing(msg.eye, msg.fwd, from); break;
    case 'pet': if (typeof msg.id === 'number') flock.pet(msg.id); break;
    case 'train': if (typeof msg.id === 'number' && (msg.job === null || JOB_TEXT[msg.job])) flock.train(msg.id, msg.job, from); break;
    case 'sit': flock.gatherAt(msg.seat, msg.front); break;
    case 'stand': flock.endGather(); break;
  }
}

function guestMessage(msg) {
  switch (msg.t) {
    case 'we': Object.assign(pendingEdits, msg.edits); break;
    case 'w':
      if (myNetId) break; // already in
      msg.edits = Object.assign(pendingEdits, msg.edits); pendingEdits = {};
      startGuestWorld(msg);
      break;
    case 'full': setNetStatus('That game already has four players.', true); net.close(); updateRoomUi(); break;
    case 'bye': net.close(); others.clear(); updateTags(); backToOwnWorld(); toast('The host stopped the game. You’re back in your own world.'); break;
    case 'e': for (const [x, y, z, id] of msg.b || []) { world.applyEdit(x, y, z, id); remeshAround(x, z); } break;
    case 's': {
      if (Math.abs(msg.clock - clock) > 0.002 && Math.abs(msg.clock - clock) < 0.998) clock = msg.clock;
      nights = msg.nights;
      flock.remoteCounts = msg.counts;
      if (msg.a) flock.applySnapshot(msg.a);
      flock.applyTreats(msg.tr || []);
      flock.applyGifts(msg.gf || []);
      // events first, so a snake that just poofed is still here to burst into confetti
      for (const ev of msg.ev || []) {
        if (ev.type === 'crown') { if (!crown) awardCrown(); continue; }
        if (ev.f) flock.events.push(ev);
        else if (ev.w) weather.events.push(ev);
        else if (ev.r) { raiders.remoteEvent(ev); raiders.events.push(ev); }
        else { snakes.remoteEvent(ev); snakes.events.push(ev); }
      }
      snakes.applySnapshot(msg.sn || []);
      raiders.applySnapshot(msg.rd || []);
      weather.applySnapshot(msg.wx);
      const seen = new Set();
      for (const [id, char, x, y, z, yaw, pitch, held, sit, nick, fit] of msg.pl || []) {
        if (id === myNetId) continue;
        seen.add(id);
        const o = others.get(id) || addOther(id, char);
        setPose(o, [x, y, z], yaw, pitch, held, sit, char, nick, fit);
      }
      for (const id of [...others.keys()]) if (!seen.has(id)) others.delete(id);
      if (others.size !== shownOthers) { shownOthers = others.size; updateRoomUi(); }
      if (msg.crown && !crown) { crown = true; showCrown(); }
      break;
    }
  }
}

function startGuestWorld(w) {
  myNetId = w.id;
  startWorld({ v: 3, guest: true, seed: w.seed, edits: w.edits, pos: w.pos, yaw: w.yaw, pitch: 0, clock: w.clock, nights: w.nights, crown: w.crown });
  setNetStatus(`Playing in a friend’s world (room ${net.code}).`);
  updateRoomUi();
  if (coarse) input.setTouchMode(true);
  resume();
  hideHintLater();
  toast('You joined your friend’s world! Their babies are your babies.');
}

function backToOwnWorld() {
  myNetId = 0;
  const bag = { inv, hotbar, selected, stats, goalsDone }; // what you collected on the visit comes home with you
  startWorld(store.get(SAVE_KEY));
  inv = bag.inv; hotbar = bag.hotbar; selected = bag.selected; stats = bag.stats; goalsDone = bag.goalsDone;
  buildHotbar();
  saveGame();
  updateRoomUi();
}

function setNetStatus(text, bad = false) {
  const el = $('#net-status');
  el.textContent = text || ''; el.hidden = !text; el.classList.toggle('bad', bad);
}
function updateRoomUi() {
  const host = net.isHost, guest = net.isGuest;
  $('#host-info').hidden = !host;
  $('#btn-host').hidden = host || guest;
  $('#join-box').hidden = host || guest;
  $('#btn-leave').hidden = !host && !guest;
  $('#btn-leave').textContent = host ? 'Stop hosting' : 'Leave and go back to my world';
  $('#room-code').textContent = net.code || '····';
  const count = 1 + (host ? net.guests : others.size);
  $('#room-count').textContent = host ? (net.guests ? `· ${count} playing` : '· waiting for friends') : '';
  const pill = $('#room-pill');
  pill.hidden = !net.active;
  pill.textContent = `${net.code} · ${count} 🐥`;
  $('#btn-new').hidden = host || guest;
  if (host || guest) $('#new-world').hidden = true;
  $('#footnote').textContent = guest ? 'You’re visiting, so nothing here saves to your device. Your own world is safe.' : 'Your world saves on this device automatically.';
}

$('#btn-host').addEventListener('click', async () => {
  if (!renderer) return;
  setNetStatus('Making a room…');
  try {
    if (!world) startWorld(store.get(SAVE_KEY));
    await net.host();
    myNetId = 0;
    setNetStatus('Tell your friend the room code. They tap Play together → Join on their device.');
  } catch (err) { setNetStatus(err.message, true); }
  updateRoomUi();
});
$('#join-code').addEventListener('input', e => { e.target.value = cleanCode(e.target.value); });
$('#btn-join').addEventListener('click', async () => {
  if (!renderer || joining || net.active) return;
  const code = cleanCode($('#join-code').value);
  if (code.length !== 4) { setNetStatus('Type the four letters from your friend’s screen.', true); return; }
  saveGame(); // keep your own world safe while you visit
  sfx.unlock();
  setNetStatus('Joining…');
  joining = true;
  try {
    await net.join(code);
    net.toHost({ t: 'hello', char: settings.char, nick: myName(), fit: myFit() });
    setNetStatus('Connected! Loading your friend’s world…');
  } catch (err) { setNetStatus(err.message, true); }
  joining = false;
  updateRoomUi();
});
$('#btn-leave').addEventListener('click', () => {
  const wasGuest = net.isGuest;
  if (net.isHost) net.broadcast({ t: 'bye' });
  setTimeout(() => net.close(), 150);
  others.clear(); updateTags();
  net.role = null; // stop sending straight away
  if (wasGuest) backToOwnWorld();
  setNetStatus(wasGuest ? 'You’re back in your own world.' : 'Stopped hosting.');
  updateRoomUi();
});
window.addEventListener('pagehide', () => { if (net.isHost) net.broadcast({ t: 'bye' }); });

// ---------- main loop ----------
let last = performance.now(), fpsAcc = 0, fpsN = 0, fps = 0;
const pixelRatio = Math.min(window.devicePixelRatio || 1, coarse ? 1.5 : 2);

function loop(now) { requestAnimationFrame(loop); frame(now); }
function frame(now, photo = false) {
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
    if (seat) {
      // sitting on the throne: walking or jumping stands you up again
      const st = input.state;
      if (Math.abs(st.moveX) > 0.2 || Math.abs(st.moveZ) > 0.2 || st.jump || world.getBlock(seat.x, seat.y, seat.z) !== B.THRONE) standUp();
      else { player.pos = [seat.x + 0.5, seat.y + 1, seat.z + 0.5]; player.vel = [0, 0, 0]; }
    }
    // poison goo makes your feet sticky and slow
    const gooey = !player.flying && snakes.inGoo(player.pos);
    player.slow = gooey ? 0.4 : 1;
    if (gooey && !firsts.includes('goo')) { firsts.push('goo'); toast('Yuck, poison goo! It makes you slow. Step out of it, it dries up soon.'); }
    if (!seat && world.getChunk(Math.floor(player.pos[0] / CS), Math.floor(player.pos[2] / CS))) player.update(dt, input.state, world);
    if (player.pos[1] < -20) { player.pos[1] = CH; player.vel[1] = 0; }
    if (player.onLadder && player.vel[1] > 1) { climbT += dt; if (climbT > 0.8 && !stats.climbed) stats.climbed = 1; }
    goalTimer -= dt;
    if (goalTimer <= 0) { goalTimer = 0.5; checkGoals(); }
    throwCool = Math.max(0, throwCool - dt);
    swingCool = Math.max(0, swingCool - dt);
  }
  // the host keeps the world going while friends are visiting, even from the pause menu
  if (running || net.isGuest || (net.isHost && net.guests)) {
    clock = (clock + dt / CYCLE) % 1;
    if (net.isGuest) {
      flock.puppetStep(dt);
      snakes.puppetStep(dt);
      raiders.puppetStep(dt);
      weather.step(dt);
    } else {
      const isNight = skyAt(clock).night > 0.5;
      const players = [{ pos: player.pos, holding: running ? hotbar[selected] : null, id: myNetId }];
      for (const o of others.values()) players.push({ pos: o.p, holding: o.held, id: o.id });
      const foes = [...snakes.list.filter(s => !s.gone).map(s => ({ kind: 'snake', p: s.p, ref: s })), ...raiders.foes()];
      flock.update(dt, players, [...snakes.heads(), ...raiders.threats()], isNight, foes);
      // grown wolves that caught up with a fox or a snake
      for (const b of flock.bites) { if (b.kind === 'fox') raiders.scare(b.ref, b.from); else snakes.nip(b.ref, b.from); }
      flock.bites.length = 0;
      raiders.update(dt, flock, players.map(q => q.pos), skyAt(clock).night < 0.3, nights);
      feederTimer -= dt;
      if (feederTimer <= 0) {
        feederTimer = 2;
        const seen = new Set(), feeders = [];
        for (const q of players) for (const f of world.placedNear(q.pos[0], q.pos[2], 40, id => FEEDER_TREAT[id] !== undefined)) {
          const k = f.slice(0, 3).join(); if (!seen.has(k)) { seen.add(k); feeders.push(f); }
        }
        for (const [x, y, z] of flock.feedersStep(feeders, FEEDER_TREAT)) { editBlock(x, y, z, B.FEEDER); remeshAround(x, z); }
        // wheat in the planters grows a stage now and then (about two minutes from seed to golden)
        const grows = new Set();
        for (const q of players) for (const [x, y, z, id] of world.placedNear(q.pos[0], q.pos[2], 48, id => id === B.PLANTER_SEEDED || id === B.PLANTER_GROWING)) {
          const k = x + ',' + y + ',' + z;
          if (grows.has(k) || Math.random() > 0.035 * (1 + 1.5 * weather.amount)) continue;
          grows.add(k);
          editBlock(x, y, z, id + 1); remeshAround(x, z);
        }
      }
      snakes.update(dt, flock, player, isNight, nights);
      weather.update(dt, skyAt(clock).night < 0.3);
    }
    handleChickEvents();
  }
  netStep(dt);
  const sky = weather.shade(skyAt(clock));
  const pending = stream(running ? 5 : 10);
  $('#loading').hidden = pending === 0 || running;

  const cam = wardrobe.open ? selfieCam(dt) : null;
  const eye = cam ? cam.eye : player.eye(), fwd = cam ? cam.fwd : player.forward();
  target = running && !cam ? raycast(world, eye, fwd, REACH) : null;
  if (running) updateBreaking(dt);

  const underwater = world.getBlock(Math.floor(eye[0]), Math.floor(eye[1]), Math.floor(eye[2])) === B.WATER;
  const far = settings.view * CS - 6;
  const waterFog = WATER_FOG.map((v, i) => v * sky.tint[i]);
  const a = flock.instances(eye, far + 8, now / 1000), s = snakes.instances(eye, far + 8, now / 1000);
  const r = raiders.instances(eye, far + 8, now / 1000);
  s.groups.push(...r.groups); s.shadowGroups.push(...r.shadowGroups);
  const k = kidInstances(dt);
  s.groups.push(...k.groups); s.shadowGroups.push(...k.shadowGroups);
  if (weather.amount > 0.01) s.groups.push(weather.instances(eye, dt));
  critters.update(dt, player.pos, skyAt(clock).night, weather.amount);
  s.groups.push(...critters.instances(eye, Math.min(far, 40), now / 1000));
  sfx.rain(running && !underwater ? weather.amount : 0);
  renderer.render({
    eye, forward: fwd, fov: 70 * Math.PI / 180,
    fogColor: underwater ? waterFog : sky.horizon, zenith: underwater ? waterFog : sky.zenith,
    sunDir: sky.sunDir, moonDir: sky.moonDir, night: underwater ? 0 : sky.night, clouds: underwater ? 0 : 1 + weather.amount, rainbow: underwater ? 0 : weather.rainbow,
    fogNear: underwater ? 0 : far * 0.6, fogFar: underwater ? 22 : far,
    tint: underwater ? [0.6 * sky.tint[0], 0.75 * sky.tint[1], sky.tint[2]] : sky.tint,
    entTint: sky.entTint, glowLayer: T.LAMP,
  }, world.chunks.values(), target, now / 1000, { groups: [...a.groups, ...s.groups], shadowGroups: [...a.shadowGroups, ...s.shadowGroups] });
  if (photo) grabPhoto();

  updateTags();
  if (settings.showFps) {
    const p = player.pos;
    $('#info').textContent = `${fps} fps  ${renderer.stats.chunks} chunks  ${Math.round(renderer.stats.tris / 1000)}k tris\n` +
      `x ${p[0].toFixed(1)}  y ${p[1].toFixed(1)}  z ${p[2].toFixed(1)}${player.flying ? '  flying' : ''}`;
  }
}
requestAnimationFrame(loop);

// handy for debugging from the console
window.blockwild = { get world() { return world; }, get player() { return player; }, get target() { return target; }, get flock() { return flock; }, get nursery() { return flock; }, get snakes() { return snakes; }, get raiders() { return raiders; }, get weather() { return weather; }, get critters() { return critters; }, wardrobe, selfieCam, petBaby, openJobs, get inv() { return inv; }, addItem, RECIPES, craft, input, raycast,
  get clock() { return clock; }, setTime(t) { clock = t; }, swing: () => swing(),
  net, others, get myNetId() { return myNetId; },
  get seat() { return seat; }, awardCrown: () => awardCrown(), sit: (x, y, z) => sit(x, y, z), standUp: () => standUp(),
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
