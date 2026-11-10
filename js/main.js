// Baby Chicken Empire: bootstrap, game loop, streaming, interaction, UI and saving.
import { B, T, BLOCKS, SOLID, PLACEABLE, TILE_COUNT, ITEM_SEEDS, ITEM_WHEAT, ITEM_SWORD, ITEM_BONE, ITEM_APPLE, ITEM_CLOVER, ITEM_STICK, ITEM_EGG, ITEM_MILK, ITEM_HOUSE, ITEM_ROD, ITEM_FISH, ITEM_BREAD, ITEM_GRILLED, ITEM_PIE, ITEM_CAKE, ITEM_FIREWORK, ITEM_RING, FOODS, IS_DOOR, DOOR_TOPS, TREATS, ITEM_NAMES, SHAPED, FEEDER_OF, FEEDER_TREAT, IS_FEEDER } from './blocks.js';
import { Snakes, SNAKE_KINDS, K_POISON, K_FLYING, K_DIGGER, K_BOOM } from './snakes.js';
import { Raiders } from './raiders.js';
import { Weather } from './weather.js';
import { Critters, BUTTERFLY_KINDS } from './critters.js';
import { GOALS, newStats, bump } from './goals.js';
import { drops, RECIPES, TABS, TOOLS, STARTER, OLD_SAVE_BAG, TABLE_REACH, FEEDER_FILL } from './crafting.js';
import { STARTER_RECIPES, SEW, patternKey, GOAL_TEACH, goalRecipes, PAGE_CHANCE, unlearned, pickPage, oldWorldRecipes } from './recipes.js';
import { skyAt, CYCLE } from './sky.js';
import { buildTextures, blockIcon } from './textures.js';
import * as M from './models.js';
import { Nursery, SPECIES, SPECIES_ORDER, isTreat, GIFTS, BABY_NAMES, cleanAnimalNick, ANIMAL_HATS } from './animals.js';
import { Sfx } from './audio.js';
import { Music } from './music.js';
import { Fireworks } from './fireworks.js';
import { World, CS, CH, SEA } from './world.js';
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
const settings = Object.assign({ view: coarse ? 5 : 7, sens: 1, autoJump: true, showFps: false, sound: true, music: true, char: 'lachie', nick: '', fits: {} }, store.get(SET_KEY) || {});
// Clothes patterns arrived in v26: a device from before then keeps what it has sewn and what anyone is wearing.
if (!Array.isArray(settings.patterns)) {
  const keep = new Set(settings.sewn || []);
  for (const f of Object.values(settings.fits || {})) if (Array.isArray(f)) for (const s of [0, 2, 4, 7]) if (f[s]) keep.add(s + ':' + f[s]);
  settings.patterns = [...keep];
  settings.sewn = [...keep];
}
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
  for (const k of M.HATTED) for (let h = 1; h <= ANIMAL_HATS; h++) renderer.addModel(k + '~' + h, M.animalHatModel(k, h));
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
  renderer.addModel('bobber', M.bobberModel());
  renderer.addModel('trader', M.traderModel());
  M.SPARK_COLORS.forEach((c, k) => renderer.addModel('spark' + k, M.sparkModel(c)));
  renderer.addModel('rocket', M.rocketModel());
  renderer.addModel('milk', M.milkModel());
  renderer.addModel('woolTuft', M.woolTuftModel());
  renderer.addModel('logChunk', M.logChunkModel());
  renderer.addModel('stoneChunk', M.stoneChunkModel());
  for (let k = 0; k < BUTTERFLY_KINDS; k++) renderer.addModel('butterfly' + k, M.butterflyModel(k));
  renderer.addModel('firefly', M.fireflyModel());
  renderer.addModel('rain', M.rainModel());
  renderer.addModel('snow', M.snowModel());
} catch (err) {
  console.error(err);
  showError('This device or browser cannot run Baby Chicken Empire (WebGL2 is required). ' + err.message);
}

let world = null, player = null, flock = null, snakes = null, raiders = null, weather = null, critters = null, running = false, firsts = [];
let clock = 0.08, nights = 0, swingCool = 0, wasBreaking = false;
let crown = 0, seat = null; // crown: 0 none, 1 gold, 2 ruby, 3 diamond
let streak = 0;              // perfect nights in a row (no baby spooked)
let sleptNight = false;      // slept through tonight: it doesn't count towards a crown
// hotbar: nine slots holding item ids (0 = empty); inv: how many of each item you're carrying
const NEW_HOTBAR = [ITEM_SEEDS, ITEM_SWORD, 0, 0, 0, 0, 0, 0, 0];
let hotbar = [...NEW_HOTBAR];
let inv = { ...STARTER };
let stats = newStats(), goalsDone = [], goalTimer = 0, climbT = 0;
let selected = 0;
let target = null, breakT = { key: '', p: 0 };
let milestone = 0, throwCool = 0, feederTimer = 0;
const sfx = new Sfx();
const music = new Music(sfx);
// the first tap anywhere wakes the sound up, so the theme song can play on the front screen
for (const ev of ['pointerdown', 'keydown']) document.addEventListener(ev, () => { sfx.unlock(); music.unlock(); }, true);

// play together
const net = new Net();
const others = new Map();   // id → another player: { id, char, p, tp, yaw, tyaw, pitch, held, sit, phase, speed }
let myNetId = 0, netTimer = 0, poseTimer = 0, shownOthers = -1, pendingEdits = {}, joining = false, sendAnimals = false;
const netEdits = [], netEvents = [];

const icons = {};
const SHAPE_ICON = { [B.FENCE]: 'fence', [B.GATE]: 'gate', [B.DOOR]: 'door', [B.BED]: 'bed', [B.SIGN]: 'sign', [B.CAMPFIRE]: 'campfire', [B.SCARECROW]: 'scarecrow', [B.BELL]: 'dinner bell', [B.JAR]: 'firefly jar', [B.MUSICBOX]: 'music box', [B.SNOWMAN]: 'snowman', [B.SANDCASTLE]: 'sandcastle', [B.BENCH]: 'bench', [B.FLOWERPOT]: 'pot plant', [B.LAMPPOST]: 'lamp post', [B.PLANTER]: 'planter', [B.TABLE]: 'table', [B.LADDER]: 'ladder', [B.FEEDER]: 'feeder',
  [B.FLOWER_RED]: 'flower-red', [B.FLOWER_YELLOW]: 'flower-yellow', [B.FLOWER_WHITE]: 'flower-white' };
if (textures) for (const id of [...PLACEABLE, B.THRONE]) {
  icons[id] = SHAPED[id] ? M.treatIcon(SHAPE_ICON[id], 64).toDataURL() : blockIcon(BLOCKS[id], textures.tiles, 64).toDataURL();
}
for (const id of [...TREATS, ITEM_SWORD, ITEM_STICK, ITEM_EGG, ITEM_MILK, ITEM_HOUSE, ITEM_ROD, ITEM_FISH, ITEM_FIREWORK, ITEM_RING, ...FOODS]) icons[id] = M.treatIcon(ITEM_NAMES[id].toLowerCase(), 64).toDataURL();
$('#held').src = icons[ITEM_SWORD] || '';
const itemName = id => ITEM_NAMES[id] || BLOCKS[id]?.name || '';
const isItem = id => !!icons[id];
// the order things are listed in your bag
const BAG_ORDER = [...TREATS, ITEM_FISH, ITEM_EGG, ITEM_MILK, ITEM_SWORD, ITEM_ROD, ITEM_STICK, ITEM_HOUSE, ITEM_FIREWORK, ITEM_RING, B.THRONE, ...PLACEABLE];

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
// ---------- learning recipes ----------
// Recipes you know are kept with your bag (stats.known), so they come along when you visit a friend.
const knownList = () => Array.isArray(stats.known) ? stats.known : (stats.known = [...STARTER_RECIPES]);
const knows = r => knownList().includes(r.out);
const knowsPattern = (slot, v) => !sewOf(slot, v) || (settings.patterns || []).includes(patternKey(slot, v));
const foundEver = id => have(id) > 0 || !!(stats.got?.[id] || stats.made?.[id] || stats.gifts?.[id]);
const learnName = u => u.kind === 'r' ? itemName(u.out) : (M[{ 0: 'TOPS', 2: 'BOTTOMS', 4: 'HATS' }[u.slot]] || ['', 'Bag'])[u.v];
// Learn a recipe or pattern. how: 'page' (found one) or 'goal'. Returns its name, or '' if you knew it already.
function learn(u, how) {
  if (!u) return '';
  if (u.kind === 'r') { if (knownList().includes(u.out)) return ''; knownList().push(u.out); }
  else {
    if ((settings.patterns || []).includes(u.key)) return '';
    settings.patterns = [...(settings.patterns || []), u.key];
    store.set(SET_KEY, settings);
  }
  bump(stats, 'learned');
  const name = learnName(u);
  if (how === 'page') {
    const where = u.kind === 'r' ? 'Look in your bag to make it.' : 'Sew it in the Wardrobe (pause menu).';
    toast(`📜 You found a recipe page: ${u.kind === 'r' ? name : name + ' (sewing pattern)'}! ${where}`, 4200);
    sfx.grown(); buzz(20);
  }
  return name;
}
function teachFromGoal(goal) {
  const t = GOAL_TEACH[goal];
  if (t === undefined) return '';
  if (Array.isArray(t)) return t.map(out => learn({ kind: 'r', out }, 'goal')).filter(Boolean).join(' and ');
  if (typeof t === 'number') return learn({ kind: 'r', out: t }, 'goal');
  const [slot, v] = t.split(':').map(Number);
  return learn({ kind: 's', key: t, slot, v }, 'goal');
}
// Digging now and then turns up a recipe page for something you don't know yet.
function maybePage(id) {
  if (Math.random() > (PAGE_CHANCE[id] || 0)) return;
  learn(pickPage(knownList(), settings.patterns || [], foundEver), 'page');
}
// ---------- goals ----------
const goalProgress = g => Math.min(g[2], g[3](stats));
const nextGoal = () => GOALS.find(g => !goalsDone.includes(g[0]));
const rewardText = rw => rw.map(([id, k]) => `${k} ${itemName(id).toLowerCase()}`).join(' and ');
let shownGoal = '';
function checkGoals() {
  if (!world) return;
  let finished = null, taught = '';
  for (const g of GOALS) {
    if (goalsDone.includes(g[0]) || goalProgress(g) < g[2]) continue;
    goalsDone.push(g[0]);
    for (const [id, k] of g[4]) addItem(id, k, true);
    taught = teachFromGoal(g[0]) || taught;
    finished = g;
  }
  if (finished) {
    sfx.fanfare();
    const next = nextGoal();
    toast(`★ Goal done: ${finished[1]}! You got ${rewardText(finished[4])}.` + (taught ? ` 📜 You learned how to make: ${taught}!` : '') + (next ? '' : ' That’s every goal. Chicken king!'), taught ? 4500 : undefined);
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
// Is there a crafting table (or a campfire) close by?
function atTable(block = B.TABLE) {
  if (!world || !player) return false;
  const [x, y, z] = player.pos;
  return world.placedNear(x, z, TABLE_REACH, id => id === block).some(t => Math.abs(t[1] - y) <= 3);
}
const atFire = () => atTable(B.CAMPFIRE);
// Can you make it here? Some things need a table close by, food needs a campfire.
const atPlace = r => !r.table || (r.table === 'fire' ? atFire() : atTable());
function canMake(r) { return knows(r) && timesYouCan(r) > 0 && atPlace(r); }
function craft(r, times = 1) {
  times = Math.min(times, timesYouCan(r));
  if (times <= 0 || !knows(r) || !atPlace(r)) return 0;
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
    // recipes have to be learned since v26; a world from before keeps what it has already made or found
    if (!Array.isArray(stats.known)) stats.known = old ? oldWorldRecipes(save.stats, save.inv, goalsDone) : [...STARTER_RECIPES];
    // and anything a finished goal teaches (goals can learn to teach new things in later versions)
    for (const g of goalsDone) for (const t of goalRecipes(g)) if (!stats.known.includes(t)) stats.known.push(t);
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
  crown = save?.crown === true ? 1 : (save?.crown | 0);
  streak = save?.streak | 0; sleptNight = false;
  loadSigns(save?.signs);
  snackT = 0; boostEl.hidden = true;
  trader.here = false; trader.day = -1; trader.look = 0;
  fireworks.rockets.length = 0; fireworks.sparks.length = 0; fireworks.stars.length = 0; starT = 20; wishStar = null; mapChest = null; boxes = []; seek = null; seekT = 150 + Math.random() * 150;
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
    v: 4, inv, stats, goals: goalsDone, seed: world.seed, clock: +clock.toFixed(4), nights, crown, streak, pos: player.pos.map(v => +v.toFixed(2)), yaw: player.yaw, pitch: player.pitch,
    flying: player.flying, hotbar, selected, edits: world.serializeEdits(),
    animals: flock ? flock.serialize() : [], gifts: flock ? flock.serializeGifts() : [], milestone, firsts,
    signs: signsOut(),
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
  if (shownCounts && n.chick >= 100 && !crown && !net.isGuest) awardCrown(1);
  stats.chicks = Math.max(stats.chicks || 0, n.chick || 0);
  shownCounts = n;
}

// ---------- chicken king: the gold crown and the hay throne ----------
const crownEl = document.createElement('div');
crownEl.className = 'pill crown';
crownEl.setAttribute('aria-label', 'Chicken king crown');
crownEl.innerHTML = `<svg viewBox="0 0 32 32" aria-hidden="true"><path d="M4 11l6 6 6-10 6 10 6-6-2 15H6z" fill="#ffcf3a" stroke="#c98a00" stroke-width="1.6" stroke-linejoin="round"/><rect x="6" y="23" width="20" height="4" rx="1.5" fill="#ffb800"/><circle cx="16" cy="18" r="2.4" fill="#e8443a"/><circle cx="10" cy="20" r="1.6" fill="#4aa8ff"/><circle cx="22" cy="20" r="1.6" fill="#4cc25a"/><circle cx="4" cy="10" r="1.8" fill="#ffcf3a"/><circle cx="16" cy="6" r="1.8" fill="#ffcf3a"/><circle cx="28" cy="10" r="1.8" fill="#ffcf3a"/></svg>`;
nurseryEl.prepend(crownEl);
const streakEl = document.createElement('div');
streakEl.className = 'pill streak'; streakEl.hidden = true;
crownEl.after(streakEl);
{ const br = document.createElement('div'); br.className = 'break'; nurseryEl.append(br, $('#goal')); }
// Crowns get harder: each needs more perfect nights in a row (no baby spooked) and a bigger nursery.
// The snakes grow in number and kind every night too, so a long streak is a real feat.
const CROWNS = [
  null,
  { name: 'gold crown', nights: 3, flock: 8 },
  { name: 'ruby crown', nights: 5, flock: 20 },
  { name: 'diamond crown', nights: 8, flock: 40 },
];
function showStreak() {
  const next = CROWNS[crown + 1];
  streakEl.hidden = !streak;
  streakEl.textContent = next ? `🌙 ${streak}/${next.nights}` : `🌙 ${streak}`;
  streakEl.setAttribute('aria-label', next ? `${streak} perfect ${streak === 1 ? 'night' : 'nights'} in a row, of ${next.nights} for the ${next.name}` : `${streak} perfect nights in a row`);
}
function showCrown() {
  showStreak();
  crownEl.hidden = !crown;
  crownEl.dataset.level = crown;
  crownEl.setAttribute('aria-label', crown ? `Chicken king: ${CROWNS[crown].name}` : 'Chicken king crown');
  crownEl.title = crown ? CROWNS[crown].name[0].toUpperCase() + CROWNS[crown].name.slice(1) : '';
}

function awardCrown(level = crown + 1) {
  level = Math.min(CROWNS.length - 1, Math.max(1, level));
  if (level <= crown) return;
  const first = !crown;
  crown = level;
  showCrown();
  crownEl.classList.remove('bump'); void crownEl.offsetWidth; crownEl.classList.add('bump');
  if (!have(B.THRONE)) addItem(B.THRONE, 1);
  sfx.royal();
  snakes.burst(player.pos, 90 + level * 40, undefined, false);
  if (net.isHost) netEvents.push({ type: 'crown', level });
  const name = CROWNS[level].name;
  toast(first ? `Chicken king! You earned the ${name} and a hay bale throne. Place the throne and tap it to sit.`
    : level < CROWNS.length - 1 ? `Your crown grew into the ${name}! Next: the ${CROWNS[level + 1].name}.`
    : `The ${name}! The grandest crown in the land. Long live the chicken king!`);
  saveGame();
}

// At sunrise: counts the streak and says how close the next crown is.
function crownDawn(spooked, babies) {
  const slept = sleptNight; sleptNight = false;
  if (babies <= 0) return '';                 // nobody to keep safe: the streak waits
  if (slept && !spooked) return CROWNS[crown + 1] ? ' (A night slept through doesn’t count towards a crown: stay up and guard it!)' : '';
  if (spooked) { const lost = streak; streak = 0; showStreak(); return lost >= 2 ? ` That ends your run of ${lost} perfect nights.` : ''; }
  streak++; stats.bestStreak = Math.max(stats.bestStreak || 0, streak); showStreak();
  const next = CROWNS[crown + 1];
  if (!next) return streak > 1 ? ` ${streak} perfect nights in a row!` : '';
  if (streak >= next.nights && babies >= next.flock) { awardCrown(crown + 1); return null; }
  if (streak >= next.nights) return ` ${streak} perfect nights in a row! Grow your nursery to ${next.flock} animals for the ${next.name}.`;
  return ` Perfect night ${streak} of ${next.nights} in a row for the ${next.name}.`;
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
function sitBench(t) {
  seat = { x: t.x, y: t.y, z: t.z, id: B.BENCH, h: 0.45 };
  player.flying = false;
  player.pos = [t.x + 0.5, t.y + 0.45, t.z + 0.5]; player.vel = [0, 0, 0];
  bump(stats, 'benched'); sfx.place(); buzz(8);
  if (!firsts.includes('bench')) { firsts.push('bench'); toast('Ahh, a nice sit down. Walk or jump to stand up.', 3000); }
}
function standUp() { if (seat?.id === B.BENCH) player.pos[1] = seat.y + 1;
  seat = null; flock.endGather(); if (net.isGuest) net.toHost({ t: 'stand' }); }

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
// keep: an important message (a bottle's note, a wish) stays up for its full time, and anything said
// meanwhile waits its turn instead of covering it.
let toastHold = 0, toastQueue = [];
function toast(text, ms = 4200, keep = false) {
  if (!keep && performance.now() < toastHold) { if (toastQueue.length < 3) toastQueue.push([text, ms]); return; }
  const t = $('#toast');
  t.textContent = text;
  t.classList.add('show');
  if (keep) toastHold = performance.now() + ms;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    t.classList.remove('show');
    const next = toastQueue.shift();
    if (next) toastTimer = setTimeout(() => toast(...next), 350);
  }, ms);
}
// "Nugget the lamb", or "Your lamb" / "a lamb" for a baby with no name.
function callName(n, sp, fallback, nick) {
  const nm = nick || BABY_NAMES[n], s = SPECIES[sp] ? SPECIES[sp].name : 'baby';
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
  el.textContent = kind === 'hatch' ? '+1' : kind === 'bonk' ? 'BONK!' : kind === 'grown' ? 'All grown up!' : kind === 'note' ? (Math.random() < 0.5 ? '♪' : '♫') : '';
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
    if (ev.type === 'party') { if (d < 24) { floatFx(ev.p, 'heart'); if (Math.random() < 0.5) floatFx(ev.p, 'heart'); } continue; }
    if (d > 40) continue;
    if (ev.type === 'grown') {
      bump(stats, 'grown');
      sfx.grown(); sfx.call(ev.sp, 0.5); floatFx(ev.p, 'grown'); buzz(25);
      snakes.burst([ev.p[0], ev.p[1] + 0.4, ev.p[2]], 26, [1, 1, 2, 3], false);
      const first = !firsts.includes('grown' + ev.sp);
      if (first) firsts.push('grown' + ev.sp);
      const who = callName(ev.name, ev.sp, 'Your', ev.nick);
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
        sfx.fanfare();
        continue;
      }
      nights++;
      const babies = Object.values(flock.counts()).reduce((a, b) => a + b, 0);
      const more = crownDawn(ev.spooked, babies);
      if (more === null) continue;
      sfx.fanfare();
      toast((ev.spooked ? `Day ${nights + 1}. Sunrise! The snake spooked ${ev.spooked} ${ev.spooked === 1 ? 'baby' : 'babies'}, but the nursery made it.`
        : `Day ${nights + 1}. Sunrise! Every baby made it safely through the night.`) + more);
    } else if (ev.type === 'scared') {
      if (!firsts.includes('scared')) { firsts.push('scared'); toast('Eek! The scarecrow gave the snake a fright. Near a scarecrow it creeps along at under half speed.'); }
    } else if (ev.type === 'hiss') { if (d < 24) sfx.hiss(0.25 * (1 - d / 24)); }
    else if (ev.type === 'spawn') {
      const k = ev.kind | 0;
      if (k && !firsts.includes('snake' + k)) { firsts.push('snake' + k); setTimeout(() => toast(SNAKE_TIPS[k]), 1500); }
    } else if (ev.type === 'spook') {
      sfx.hiss(0.4); sfx.call(ev.sp, 0.5);
      const who = callName(ev.name, ev.sp, 'a', ev.nick);
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
      toast(`The fox spooked ${callName(ev.name, ev.sp, 'a', ev.nick)} out of your nursery! Feed it again to bring it back.`);
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
      if (!firsts.includes('rain') && !weather.snowing) { firsts.push('rain'); toast('It’s raining! Wheat in your planters grows faster in the rain. Stay dry under a roof.'); }
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
function updateHeld() {
  const id = hotbar[selected], el = $('#held');
  el.hidden = !TOOLS.has(id) || !have(id);
  if (!el.hidden && el.dataset.id !== String(id)) { el.src = icons[id]; el.dataset.id = id; }
}

// ---------- treasure chests ----------
// Chests sit out in the open here and there. Inside: a couple of goodies and, most of the time, a recipe page.
const CHEST_LOOT = [[ITEM_APPLE, 3], [ITEM_BONE, 2], [ITEM_CLOVER, 3], [B.WOOL, 2], [ITEM_EGG, 1], [B.GLASS, 2], [B.LAMP, 1], [ITEM_FISH, 2], [ITEM_WHEAT, 3], [B.FLOWER_RED, 2], [ITEM_MILK, 1]];
function lootChest(t) {
  const pool = [...CHEST_LOOT], got = [];
  for (let k = 0; k < 2; k++) got.push(pool.splice(Math.random() * pool.length | 0, 1)[0]);
  for (const [item, n] of got) { addItem(item, n); bump(stats, 'got', item, n); }
  const page = Math.random() < 0.85 ? pickPage(knownList(), settings.patterns || [], foundEver) : null;
  const learnt = page ? learn(page, 'chest') : '';
  bump(stats, 'chests');
  pickupPop(t, got);
  sfx.royal(); buzz(30);
  toast(`✨ Treasure! You found ${rewardText(got)}` + (learnt ? `, and a recipe page: ${learnt}${page.kind === 's' ? ' (sewing pattern)' : ''}!` : '!'), learnt ? 4500 : 3000);
}
function openChest(t) {
  editBlock(t.x, t.y, t.z, B.CHEST_OPEN);
  remeshAround(t.x, t.z);
  lootChest(t);
}
// The nearest chest still shut, within 30 blocks: [x, y, z] or null.
function nearestChest(eye) {
  // a chest from a message in a bottle stays pointed out, however far, till it's opened
  if (mapChest) {
    const [x, y, z] = mapChest;
    if (!world.getChunk(Math.floor(x / CS), Math.floor(z / CS)) || world.getBlock(x, y, z) === B.CHEST) return mapChest;
    mapChest = null;
  }
  const pcx = Math.floor(eye[0] / CS), pcz = Math.floor(eye[2] / CS);
  let best = null, bd = 30 * 30;
  for (let dz = -2; dz <= 2; dz++) for (let dx = -2; dx <= 2; dx++) {
    const c = world.getChunk(pcx + dx, pcz + dz)?.chest;
    if (!c || world.getBlock(c[0], c[1], c[2]) !== B.CHEST) continue;
    const d = (c[0] + 0.5 - eye[0]) ** 2 + (c[2] + 0.5 - eye[2]) ** 2;
    if (d < bd) { bd = d; best = c; }
  }
  return best;
}
let chestEl = null;

// ---------- fishing ----------
// Hold the rod and tap to cast into water. Wait for the float to bob under, then tap straight away to reel it in.
let fishing = null; // { p: where the float sits, wait: time until a bite, bite: time left to catch it, t }
const bobberBuf = new Float32Array(12);
let fishTapAt = 0;
function fishTap() {
  if (performance.now() - fishTapAt < 300) return; // one press can arrive as a dig and a tap
  fishTapAt = performance.now();
  if (fishing) {
    if (fishing.bite > 0) catchFish();
    else { toast('Too soon! Wait for the float to bob under, then tap.', 1800); sfx.whoosh(); }
    fishing = null;
    return;
  }
  // cast: find the first water you're looking at, not too far off
  const e = player.eye(), f = player.forward();
  for (let t = 1; t < 18; t += 0.2) {
    const x = Math.floor(e[0] + f[0] * t), y = Math.floor(e[1] + f[1] * t), z = Math.floor(e[2] + f[2] * t), id = world.getBlock(x, y, z);
    if (id === B.WATER) {
      let top = y;
      while (world.getBlock(x, top + 1, z) === B.WATER && top < y + 4) top++;
      fishing = { p: [e[0] + f[0] * t, top + 0.86, e[2] + f[2] * t], wait: biteWait(), bite: 0, t: 0 };
      sfx.toss(); setTimeout(() => sfx.splash(), 250);
      if (!firsts.includes('fish')) { firsts.push('fish'); toast('Now wait… when the float bobs under, tap quickly to reel it in!', 3500); }
      return;
    }
    if (SOLID[id]) break;
  }
  toast('Aim at a pond, river or the sea to cast your line.', 2000);
}
// Fish bite sooner in the rain and at night.
const biteWait = () => (4 + Math.random() * 9) * (weather.amount > 0.3 ? 0.6 : 1) * (skyAt(clock).night > 0.6 ? 0.8 : 1);
// What's on the hook: mostly fish, sometimes a treat, now and then a soggy recipe page.
function catchFish() {
  // a message in a bottle: rare, but likelier once you've fished a while and never had one
  if (Math.random() < (stats.bottles ? 0.07 : (stats.fished || 0) >= 4 ? 0.3 : 0.05)) { fishBottle(); return; }
  let got;
  const r = Math.random(), page = r < 0.1 ? pickPage(knownList(), settings.patterns || [], foundEver) : null;
  if (page) { learn(page, 'page'); got = []; }
  else if (r < 0.75) got = [[ITEM_FISH, Math.random() < 0.15 ? 2 : 1]];
  else got = [[[ITEM_CLOVER, 2], [ITEM_APPLE, 1], [ITEM_BONE, 1], [ITEM_STICK, 2], [ITEM_SEEDS, 3]][Math.random() * 5 | 0]];
  for (const [item, n] of got) { addItem(item, n); bump(stats, 'got', item, n); }
  bump(stats, 'fished');
  if (got.length) {
    const [item, n] = got[0];
    toast(item === ITEM_FISH ? (n > 1 ? 'Two fish at once!' : 'You caught a fish!') + (firsts.includes('caught') ? '' : ' Any grown-up will take a fish to learn a job.') : `You fished up ${n} ${itemName(item).toLowerCase()}!`, 2600);
    if (!firsts.includes('caught')) firsts.push('caught');
    pickupPop({ x: Math.floor(fishing.p[0]), y: Math.floor(fishing.p[1]), z: Math.floor(fishing.p[2]) }, got);
  }
  sfx.splash(); sfx.pickup(); buzz(15);
}
function fishStep(dt) {
  if (!fishing) return;
  const F = fishing;
  F.t += dt;
  // put the rod away or walk off and the line comes back in
  if (hotbar[selected] !== ITEM_ROD || !have(ITEM_ROD) || Math.hypot(F.p[0] - player.pos[0], F.p[2] - player.pos[2]) > 22) { fishing = null; return; }
  if (F.bite > 0) {
    F.bite -= dt;
    if (F.bite <= 0) F.wait = biteWait(); // missed it: wait for another nibble
  } else if ((F.wait -= dt) <= 0) {
    F.bite = 1.3;
    sfx.splash(); buzz([30, 40, 30]);
  }
}
function bobberGroup() {
  const F = fishing, d = bobberBuf;
  const dip = F.bite > 0 ? -0.16 - 0.06 * Math.sin(F.t * 30) : 0.025 * Math.sin(F.t * 2.4);
  d.set([F.p[0], F.p[1] + dip, F.p[2], F.t * 0.3, 1.8, 0, 0, 0, 0, 0, 0, 0]); // big enough to spot from the bank
  return { model: 'bobber', data: d, count: 1 };
}

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
  if (aimingAtTrader()) { openTrade(); return; }
  if (target && target.id === B.THRONE && !seat) { sit(target.x, target.y, target.z); return; }
  if (target && target.id === B.BENCH && !seat) { sitBench(target); return; }
  if (target && (target.id === B.GATE || target.id === B.GATE_OPEN)) {
    // tap a gate to swing it open or shut
    const open = target.id === B.GATE;
    if (!open && player.intersectsBlock(target.x, target.y, target.z)) return;
    editBlock(target.x, target.y, target.z, open ? B.GATE_OPEN : B.GATE);
    remeshAround(target.x, target.z); sfx.place(); buzz(8);
    return;
  }
  if (target && target.id === B.CHEST) { openChest(target); return; }
  if (target && target.id === B.BED) { sleepInBed(); return; }
  if (target && target.id === B.BELL) { ringBell(target); return; }
  if (target && target.id === B.MUSICBOX) { playBox(target); return; }
  if (target && target.id === B.SIGN) { openSign(target.x, target.y, target.z); return; }
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
  if (id === ITEM_ROD && have(id)) { fishTap(); return; }
  if (id === B.GLASS && have(id) && catchFirefly()) return;
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
  if (id === ITEM_CAKE) { party(); return; }
  if (SNACK[id]) { eat(id); return; }
  if (id === ITEM_FIREWORK) { launchFirework(); return; }
  if (id === ITEM_RING) { toast(player.inWater ? 'Paddle away! Keep holding the ring to float and swim fast.' : 'Hold the swim ring and jump in the water: you float on top and swim fast.', 3000); return; }
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
    if (id === B.SIGN) setTimeout(() => openSign(x, y, z), 120);
    remeshAround(x, z); buzz(8); sfx.place();
  }
}

// Tap a tame baby right in front of you (closer than the block you're pointing at) to pet it.
let lastPat = { id: 0, t: 0 };
let ambientT = 4;
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
  const who = callName(best.name, best.sp, 'Your', best.nick);
  // pat the same baby again straight away to give it a name
  const again = lastPat.id === best.id && performance.now() - lastPat.t < 4000;
  lastPat = { id: best.id, t: performance.now() };
  if (again) { openJobs(best); return true; }
  if (!firsts.includes('pet')) { firsts.push('pet'); toast(`Aww! ${who} loves a pat. Pets help babies grow up a little too. Pat it again to give it a name.`); }
  else toast(`${who} loves that!${stats.named ? '' : ' Pat again to give it a name.'}`, stats.named ? 1600 : 2600);
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
const petName = a => a.nick || BABY_NAMES[a.name] || '';
const grownName = a => petName(a) ? `${petName(a)} the ${ADULT_NAME[a.sp]}` : `Your ${ADULT_NAME[a.sp]}`;
const fetchedWhat = id => id === B.LOG ? 'a log' : id === B.COBBLE ? 'some cobble' : 'some seeds';
let jobAnimal = null;
function openJobs(a) {
  jobAnimal = a;
  running = false; input.enabled = false; input.state.breaking = false;
  if (document.pointerLockElement) { pickerOpenFromLock = true; document.exitPointerLock(); }
  $('#job-name').value = a.nick || '';
  $('#job-name').placeholder = BABY_NAMES[a.name] || 'Name';
  buildJobs();
  $('#jobcard').hidden = false;
}
// Give one of your animals a name of your own (blank goes back to its own name).
function nameAnimal(a, text) {
  const nick = cleanAnimalNick(text);
  if (!a || nick === (a.nick || '')) return;
  if (net.isGuest) net.toHost({ t: 'nick', id: a.id, nick }); else flock.setNick(a.id, nick);
  a.nick = nick;
  bump(stats, 'named');
  sfx.happy();
  if (jobAnimal === a) buildJobs();
}
$('#job-name').addEventListener('change', () => nameAnimal(jobAnimal, $('#job-name').value));
$('#job-name').addEventListener('keydown', e => { if (e.key === 'Enter') $('#job-name').blur(); e.stopPropagation(); });
// Hats for your animals: any hat you've sewn (or got free) in the Wardrobe.
function buildHatChips(a) {
  const box = $('#job-hats');
  box.textContent = '';
  for (let h = 0; h <= ANIMAL_HATS; h++) {
    if (h && !isSewn(4, h)) continue;
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'chip' + ((a.hat || 0) === h ? ' on' : '');
    b.textContent = M.HATS[h];
    b.addEventListener('click', () => setAnimalHat(a, h));
    box.appendChild(b);
  }
  if (box.children.length === 1) {
    const p = document.createElement('span');
    p.className = 'note'; p.textContent = 'Sew a hat in the Wardrobe and your animals can wear one too.';
    box.appendChild(p);
  }
}
function setAnimalHat(a, h) {
  if (!a || (a.hat || 0) === h) return;
  if (net.isGuest) { net.toHost({ t: 'hat', id: a.id, hat: h }); a.hat = h; } else flock.setHat(a.id, h);
  if (h) { bump(stats, 'hatted'); sfx.happy(); sfx.call(a.sp, 0.45); floatFx([a.p[0], a.p[1] + a.S.height * 0.8, a.p[2]], 'heart'); buzz(12); }
  else sfx.place();
  buildHatChips(a);
  saveGame();
}
// A job costs the animal's favourite treat, or a fish if you've none of that (every grown-up likes fish).
const jobPay = a => have(a.S.treat) || !have(ITEM_FISH) ? a.S.treat : ITEM_FISH;
function buildJobs() {
  const a = jobAnimal, nm = petName(a) || `your ${ADULT_NAME[a.sp]}`, fav = a.S.treat, treat = jobPay(a), got = have(treat) > 0;
  const tname = itemName(treat).toLowerCase(), baby = a.grow < 1;
  const list = $('#job-list');
  list.innerHTML = '';
  list.hidden = baby; $('#job-note').hidden = baby;
  buildHatChips(a);
  if (baby) {
    // babies can have a name, but they're too little to work
    $('#job-title').textContent = callName(a.name, a.sp, 'Your', a.nick);
    $('#job-now').textContent = `Too little for a job. When ${nm} grows up, tap it to teach it one.`;
    return;
  }
  $('#job-title').textContent = `Teach ${nm} a job`;
  $('#job-now').textContent = a.job ? `${grownName(a)} is ${JOB_TEXT[a.job].doing}.` : `${grownName(a)} doesn’t have a job yet.`;
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
    ? `Teaching a job costs one ${tname}${treat === fav ? `, ${nm}’s favourite treat` : ''}. Grown-ups work by day, near where they are, and bring what they find straight to you.`
    : `You need 1 ${tname} (${nm}’s favourite treat) or a fish to teach a job. Grown-ups work by day and bring what they find to you.`;
}
function teachJob(job) {
  const a = jobAnimal;
  if (!a || (job && !useItem(jobPay(a)))) return;
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
  nameAnimal(jobAnimal, $('#job-name').value);
  $('#jobcard').hidden = true;
  jobAnimal = null;
  pickerOpenFromLock = false;
  resume();
}
$('#job-close').addEventListener('click', closeJobs);
$('#jobcard').addEventListener('click', e => { if (e.target.id === 'jobcard') closeJobs(); });

function updateBreaking(dt) {
  const ring = $('#crosshair');
  if (hotbar[selected] === ITEM_ROD && have(ITEM_ROD)) {
    // with the rod, a click or press casts (or reels in) instead of digging
    if (input.state.breaking && !wasBreaking && !input.usingTouch) fishTap();
    wasBreaking = input.state.breaking;
    breakT.p = 0; breakT.key = ''; ring.style.setProperty('--p', 0);
    return;
  }
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
    if (target.id === B.CHEST) lootChest(target); else maybePage(target.id);
    if (target.id === B.SIGN) setSign(target.x, target.y, target.z, '');
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
    b.innerHTML = `<kbd class="slot-key">${i + 1}</kbd>` + (id ? `<img alt="" src="${icons[id]}"><span class="n"></span>` : '');
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
  const made = RECIPES.find(r => r.out === id && knows(r));
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
  $('#bag-tip').textContent = input.usingTouch ? 'Tap something to hold it. Dig blocks to collect them, and make new things in the other tabs.'
    : 'Click something to hold it, or point at it and press 1–9 to put it on that hotbar slot. Make new things in the other tabs. Press E to close.';
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
    b.addEventListener('pointerenter', () => { bagHover = id; });
    b.addEventListener('pointerleave', () => { if (bagHover === id) bagHover = null; });
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
  const here = RECIPES.filter(q => q.tab === bagTab);
  if (here.length) {
    const k = here.filter(knows).length, all = RECIPES.filter(knows).length;
    const note = document.createElement('p');
    note.className = 'learn-note';
    note.textContent = k < here.length
      ? `You know ${all} of ${RECIPES.length} recipes. Learn more from recipe pages: they turn up when you dig leaves, grass, stone and sand, and when you finish goals.`
      : `You know every recipe here!`;
    list.appendChild(note);
  }
  // the ones you know first, then the ones still to learn
  // the ones you can make right now first, then the rest you know, then the ones still to learn
  const known = here.filter(knows);
  for (const r of [...known.filter(canMake), ...known.filter(q => !canMake(q)), ...here.filter(q => !knows(q))]) {
    if (!knows(r)) {
      const g = GOALS.find(q => !goalsDone.includes(q[0]) && goalRecipes(q[0]).includes(r.out));
      const how = g ? `Finish the goal “${g[1].split(':')[0]}”, or find a recipe page` : 'Find a recipe page: dig leaves, grass, stone or sand, open chests, or swap with Pip';
      const c = document.createElement('div');
      c.className = 'card unknown';
      c.innerHTML = `<div class="card-out"><img alt="" src="${icons[r.out]}"></div><div class="card-name">${itemName(r.out)}</div>` +
        `<div class="card-learn">📜 Not learned yet<small>${how}</small></div>`;
      c.setAttribute('aria-label', `${itemName(r.out)}: not learned yet. ${how}.`);
      list.appendChild(c);
      continue;
    }
    const c = document.createElement('div');
    c.className = 'card';
    c.innerHTML = `<div class="card-out"><img alt="" src="${icons[r.out]}">${r.n > 1 ? `<b class="times">×${r.n}</b>` : ''}</div>` +
      `<div class="card-name">${itemName(r.out)}</div>` +
      `<div class="card-needs">${r.needs.map(([id, k]) => `<span data-id="${id}" data-k="${k}"><img alt="" src="${icons[id]}"><em></em></span>`).join('')}</div>` +
      (r.table === 'fire' ? `<div class="card-table"><img alt="" src="${icons[B.CAMPFIRE]}">Needs a campfire</div>`
        : r.table ? `<div class="card-table"><img alt="" src="${icons[B.TABLE]}">Needs a table</div>` : `<div class="card-table free">Make it anywhere</div>`) +
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
  const table = atTable(), fire = atFire(), cook = bagTab === 'cook';
  $('#table-note').textContent = cook
    ? (fire ? 'You’re at a campfire: you can cook everything.' : 'Food needs a campfire close by. Make one from 2 logs and 3 cobble and place it.')
    : table ? 'You’re at a crafting table: you can make everything.'
      : 'Some things need a crafting table close by. Make one from 4 wood and place it.';
  $('#table-note').classList.toggle('ok', cook ? fire : table);
  for (const [c, r] of cards) {
    const n = timesYouCan(r), blocked = r.table && !(r.table === 'fire' ? fire : table);
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
  if (!running && !$('#signcard').hidden) { $('#signcard').hidden = true; signAt = null; }
  if (!running && !$('#tradecard').hidden) $('#tradecard').hidden = true;
  if (!running && mapView.open) { mapView.open = false; $('#mapcard').hidden = true; }
  running = false; input.enabled = false;
  input.state.breaking = false;
  saveGame();
  $('#hud').hidden = true;
  $('#menu').hidden = false;
  $('#btn-play').textContent = 'Resume';
  $('#menu').classList.add('paused');
  music.setMode('menu');
  updateBackupUi();
}

function resume() {
  $('#menu').hidden = true;
  $('#new-world').hidden = true;
  $('#hud').hidden = false;
  running = true; input.enabled = true;
  music.setMode('game');
  input.look.dx = input.look.dy = 0;
  if (!input.usingTouch && !coarse) canvas.requestPointerLock?.();
}

// ---------- wardrobe: your name, your character and what you wear ----------
// While it's open the camera swings round to look at you, so you can see your outfit change.
const wardrobe = { open: false, spin: 0, drag: null, idle: 0 };
// Clothes you sew yourself in the Wardrobe (the list is SEW in recipes.js). You need the pattern first, then the bits.
// Patterns you know and clothes you've sewn are kept on this device (settings.patterns, settings.sewn).
const sewOf = (slot, v) => SEW.find(s => s.slot === slot && s.v === v);
const isSewn = (slot, v) => !sewOf(slot, v) || (settings.sewn || []).includes(slot + ':' + v);
const LOCK_SVG = '<svg class="lock" viewBox="0 0 16 16" aria-hidden="true"><path d="M4 7V5a4 4 0 0 1 8 0v2" fill="none" stroke="currentColor" stroke-width="2"/><rect x="2.5" y="7" width="11" height="8" rx="2" fill="currentColor"/></svg>';
function sewBox(slot, v, name) {
  const s = sewOf(slot, v), box = document.createElement('div'), can = s.needs.every(([id, k]) => have(id) >= k);
  box.className = 'sew-box';
  if (!knowsPattern(slot, v)) {
    // no pattern yet: you can see what it'll need, but not sew it
    box.innerHTML = `<b>📜 You need the pattern for ${/^[aeiou]/i.test(name) ? 'an' : 'a'} ${name.toLowerCase()}</b>` +
      `<span class="sew-needs">${s.needs.map(([id, k]) => `<span><img alt="" src="${icons[id]}"><em>${k}</em>${itemName(id)}</span>`).join('')}</span>` +
      `<p class="note">Patterns are on recipe pages. You find them when you dig leaves, grass, stone and sand, and when you finish goals.</p>`;
    return box;
  }
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
        const pattern = knowsPattern(r.style, v);
        if (!pattern) b.classList.add('nopattern');
        b.innerHTML = open ? name : LOCK_SVG + name;
        if (!open) b.setAttribute('aria-label', name + (pattern ? ' (sew it to unlock)' : ' (find its pattern first)'));
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
  const f = [pick(0, M.TOPS.length), r(c), pick(2, M.BOTTOMS.length), r(c), pick(4, M.HATS.length), r(c), r(c), pick(7, 2)];
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
  keepSafe();
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


// ---------- saved games: slots on this device, and backup files ----------
// The world you're playing always lives in SAVE_KEY and saves itself. Slots are copies of it you can go back to.
const SLOT_KEY = 'blockwild.slots.v1', SLOTS = 5, slotKey = n => 'blockwild.slot.' + n;
const slotList = () => { const l = store.get(SLOT_KEY); return Array.isArray(l) ? l.filter(s => s && Number.isInteger(s.n)) : []; };
const saveBusy = () => net.isGuest || net.isHost;
let saveMsgTimer = 0;
function saveMsg(text, bad = false) {
  const el = $('#save-msg');
  el.textContent = text; el.hidden = false; el.classList.toggle('bad', bad);
  clearTimeout(saveMsgTimer); saveMsgTimer = setTimeout(() => { el.hidden = true; }, 6000);
}
// The world as it is right now (saving it first if you're playing).
function currentSave() {
  if (world && player && !net.isGuest) saveGame();
  const s = store.get(SAVE_KEY);
  return s && typeof s.seed === 'number' ? s : null;
}
const savedWhen = t => new Date(t).toLocaleString(undefined, { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });
function buildSlots() {
  const box = $('#save-slots'), list = slotList(), busy = saveBusy();
  $('#save-busy').hidden = !busy;
  for (const id of ['#btn-export', '#btn-import']) $(id).disabled = busy;
  box.textContent = '';
  for (let n = 0; n < SLOTS; n++) {
    const info = list.find(s => s.n === n), row = document.createElement('div');
    row.className = 'save-slot' + (info ? '' : ' empty');
    const text = document.createElement('div');
    text.className = 'save-info';
    const b = document.createElement('b'), small = document.createElement('span');
    b.textContent = info ? info.name : `Slot ${n + 1}: empty`;
    small.textContent = info ? `${savedWhen(info.t)} · ${info.animals} animal${info.animals === 1 ? '' : 's'}` : '';
    text.append(b, small);
    const save = document.createElement('button'), load = document.createElement('button');
    save.type = load.type = 'button';
    save.className = 'secondary'; save.textContent = 'Save here'; save.disabled = busy;
    load.className = 'primary'; load.textContent = 'Load'; load.disabled = busy || !info;
    save.addEventListener('click', () => saveToSlot(n));
    load.addEventListener('click', () => loadSlot(n));
    row.append(text, save, load);
    box.appendChild(row);
  }
}
function saveToSlot(n) {
  if (saveBusy()) return;
  const data = currentSave();
  if (!data) { saveMsg('There’s no world to save yet. Tap Play first.', true); return; }
  const list = slotList(), old = list.find(s => s.n === n);
  const name = $('#save-name').value.trim().slice(0, 20) || old?.name || `My world ${n + 1}`;
  if (old && !confirm(`Save over “${old.name}”? It will be replaced with the world you’re playing now.`)) return;
  if (!store.set(slotKey(n), data)) { saveMsg('There isn’t room on this device to save that. Save over an old slot, or download a backup instead.', true); return; }
  store.set(SLOT_KEY, [...list.filter(s => s.n !== n), { n, name, t: Date.now(), animals: (data.animals || []).length, seed: data.seed }]);
  $('#save-name').value = '';
  buildSlots();
  sfx.pickup();
  saveMsg(`Saved “${name}” in slot ${n + 1}.`);
}
function loadSlot(n) {
  if (saveBusy()) return;
  const info = slotList().find(s => s.n === n), data = store.get(slotKey(n));
  if (!info || !data || typeof data.seed !== 'number') { saveMsg('That slot is empty.', true); return; }
  if (!confirm(`Load “${info.name}”?\n\nThe world you’re playing now will be swapped for it. If you want to keep your world as it is, save it in a slot first.`)) return;
  if (loadSave(data)) saveMsg(`Loaded “${info.name}”. Tap ${world ? 'Resume' : 'Continue'} to play.`);
}
// Makes a saved world the one you're playing. Returns false (and keeps your world) if it won't load.
function loadSave(data) {
  const before = store.get(SAVE_KEY);
  try {
    if (!data || typeof data !== 'object' || typeof data.seed !== 'number' || !Number.isFinite(data.seed)) throw new Error('not a world');
    data = { ...data, inv: cleanBag(data.inv) };
    if (!store.set(SAVE_KEY, data)) throw new Error('no room');
    if (world) { startWorld(data); saveGame(); }
    $('#btn-play').textContent = world ? 'Resume' : 'Continue';
    sfx.grown();
    return true;
  } catch (e) {
    if (before) store.set(SAVE_KEY, before);
    if (world && before) try { startWorld(before); } catch { /* keep going */ }
    saveMsg(e.message === 'no room' ? 'There isn’t room on this device to load that.' : 'That didn’t work: it doesn’t look like a Baby Chicken Empire world.', true);
    return false;
  }
}
// Only things that really are items, in sensible amounts.
function cleanBag(bag) {
  const out = {};
  if (bag && typeof bag === 'object') for (const [k, v] of Object.entries(bag)) if (isItem(+k) && Number.isFinite(v) && v > 0) out[+k] = Math.min(99999, Math.floor(v));
  return out;
}
$('#btn-export').addEventListener('click', () => {
  if (saveBusy()) return;
  const data = currentSave();
  if (!data) { saveMsg('There’s no world to back up yet. Tap Play first.', true); return; }
  const file = { game: 'Baby Chicken Empire', kind: 'world', version: VERSION, saved: new Date().toISOString(), world: data,
    wardrobe: { patterns: settings.patterns || [], sewn: settings.sewn || [] } };
  const url = URL.createObjectURL(new Blob([JSON.stringify(file)], { type: 'application/json' }));
  const a = document.createElement('a');
  a.href = url; a.download = `baby-chicken-empire-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
  settings.lastBackup = Date.now(); store.set(SET_KEY, settings); updateBackupUi();
  saveMsg('Backup downloaded. Keep the file somewhere safe: Load a backup brings it back, on this device or another one.');
});
$('#btn-import').addEventListener('click', () => { if (!saveBusy()) $('#import-file').click(); });
$('#import-file').addEventListener('change', async e => {
  const f = e.target.files?.[0];
  e.target.value = '';
  if (!f) return;
  let file;
  try { file = JSON.parse(await f.text()); } catch { saveMsg('That file isn’t a Baby Chicken Empire backup.', true); return; }
  const data = file?.world ?? file;
  if (!data || typeof data.seed !== 'number') { saveMsg('That file isn’t a Baby Chicken Empire backup.', true); return; }
  const when = file.saved ? ` from ${savedWhen(file.saved)}` : '';
  if (!confirm(`Load the backup${when}?\n\nThe world you’re playing now will be swapped for it. If you want to keep your world as it is, save it in a slot first.`)) return;
  if (!loadSave(data)) return;
  // patterns and clothes sewn on the other device come along too
  const w = file.wardrobe || {}, keys = l => Array.isArray(l) ? l.filter(k => typeof k === 'string' && /^\d:\d$/.test(k)) : [];
  settings.patterns = [...new Set([...(settings.patterns || []), ...keys(w.patterns)])];
  settings.sewn = [...new Set([...(settings.sewn || []), ...keys(w.sewn)])];
  store.set(SET_KEY, settings);
  saveMsg(`Backup loaded. Tap ${world ? 'Resume' : 'Continue'} to play.`);
});
$('#saves').addEventListener('toggle', () => { if ($('#saves').open) { buildSlots(); updateBackupUi(); } });

// ---------- keeping your world safe ----------
// Browsers can clear a website's storage (Safari does after about a week without a visit, unless the game is on
// the Home Screen). So: ask the browser to keep it, and nudge now and then to download a backup file.
const BACKUP_DAYS = 5;
const onIos = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const installed = matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
function keepSafe() {
  navigator.storage?.persisted?.().then(yes => { if (!yes) return navigator.storage.persist(); }).catch(() => {});
}
// Worth backing up: a world you've put some time into.
const worldWorth = () => world && !net.isGuest && ((stats?.tamed || 0) + nights + (goalsDone?.length || 0) >= 4);
function backupDue() {
  return !!worldWorth() && !saveBusy() && (!settings.lastBackup || Date.now() - settings.lastBackup > BACKUP_DAYS * 864e5);
}
function updateBackupUi() {
  $('#backup-nudge').hidden = !backupDue();
  $('#save-last').textContent = settings.lastBackup ? `Last backup: ${savedWhen(settings.lastBackup)}.` : 'You haven’t downloaded a backup yet.';
  $('#save-ios').hidden = !(onIos && !installed);
}
$('#backup-nudge').addEventListener('click', () => {
  $('#saves').open = true;
  $('#saves').scrollIntoView({ behavior: 'smooth', block: 'start' });
});

// ---------- signs ----------
// What's written on each sign, by "x,y,z". Saved with the world; the host shares them with friends who visit.
const SIGN_MAX = 40;
let signs = new Map(), signAt = null;
const signKey = (x, y, z) => x + ',' + y + ',' + z;
const cleanSign = t => typeof t === 'string' ? t.replace(/[\u0000-\u001f\u007f]/g, '').replace(/\s+/g, ' ').trim().slice(0, SIGN_MAX) : '';
function loadSigns(list) {
  signs = new Map();
  if (!list || typeof list !== 'object') return;
  for (const [k, t] of Object.entries(list)) { const text = cleanSign(t); if (text && /^-?\d+,-?\d+,-?\d+$/.test(k)) signs.set(k, text); }
}
const signsOut = () => Object.fromEntries(signs);
// Writes on a sign (blank rubs it out). Returns true if it changed. remote: it came over the network.
function setSign(x, y, z, text, remote = false) {
  if (![x, y, z].every(Number.isInteger)) return false;
  const k = signKey(x, y, z), t = cleanSign(text);
  if ((signs.get(k) || '') === t) return false;
  if (t) signs.set(k, t); else signs.delete(k);
  if (!remote && net.active) {
    const msg = { t: 'sign', at: [x, y, z], text: t };
    if (net.isHost) net.broadcast(msg); else net.toHost(msg);
  }
  return true;
}
function openSign(x, y, z) {
  if (world.getBlock(x, y, z) !== B.SIGN) return;
  signAt = [x, y, z];
  running = false; input.enabled = false; input.state.breaking = false;
  if (document.pointerLockElement) { pickerOpenFromLock = true; document.exitPointerLock(); }
  $('#sign-text').value = signs.get(signKey(x, y, z)) || '';
  $('#signcard').hidden = false;
  setTimeout(() => $('#sign-text').focus(), 50);
}
function closeSign() {
  if (signAt) {
    const [x, y, z] = signAt, text = $('#sign-text').value;
    if (world.getBlock(x, y, z) === B.SIGN && setSign(x, y, z, text) && cleanSign(text)) {
      bump(stats, 'signed'); sfx.place();
      if (!firsts.includes('sign')) { firsts.push('sign'); toast('Your words float over the sign when you’re close by. Tap the sign any time to change them.'); }
    }
  }
  $('#sign-text').blur();
  $('#signcard').hidden = true;
  signAt = null;
  pickerOpenFromLock = false;
  resume();
}
$('#sign-done').addEventListener('click', closeSign);
$('#sign-text').addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); closeSign(); } });
$('#signcard').addEventListener('click', e => { if (e.target.id === 'signcard') closeSign(); });
// The words on signs close by float over them (the nearest few, fading out further away).
const signEls = new Map();
function updateSignTags(box, eye) {
  const near = [];
  for (const [k, t] of signs) {
    const [x, y, z] = k.split(',').map(Number);
    const d = Math.hypot(x + 0.5 - eye[0], y + 0.5 - eye[1], z + 0.5 - eye[2]);
    if (d < 12 && world.getBlock(x, y, z) === B.SIGN) near.push([d, k, t, x, y, z]);
  }
  near.sort((a, b) => a[0] - b[0]);
  if (near.length > 6) near.length = 6;
  const keep = new Set(near.map(s => s[1]));
  for (const [k, el] of signEls) if (!keep.has(k)) { el.remove(); signEls.delete(k); }
  for (const [d, k, t, x, y, z] of near) {
    let el = signEls.get(k);
    if (!el) { el = document.createElement('div'); el.className = 'sign-tag'; box.appendChild(el); signEls.set(k, el); }
    if (el.textContent !== t) el.textContent = t;
    const at = project(x + 0.5, y + 1.15, z + 0.5);
    el.hidden = !at;
    if (at) { el.style.left = at[0] + 'px'; el.style.top = at[1] + 'px'; el.style.opacity = d > 8 ? ((12 - d) / 4).toFixed(2) : ''; }
  }
}

// ---------- the map ----------
// A bird's-eye view around you: the ground you've been to (with your buildings), and the lie of the land beyond
// from the world's own shape. Markers show you, your nursery, signs, beds, campfires, chests, the trader and friends.
const MAP_MARK = { [B.BED]: '🛏️', [B.CAMPFIRE]: '🔥', [B.SCARECROW]: '🎃', [B.BELL]: '🔔' };
const MAP_COL = {
  [B.GRASS]: '#62b04c', [B.DIRT]: '#8a5a35', [B.STONE]: '#8e9196', [B.SAND]: '#e6d49a', [B.LOG]: '#7a5230', [B.LEAVES]: '#3c8a38',
  [B.PLANKS]: '#c08850', [B.GLASS]: '#cfeefa', [B.WATER]: '#3a7bd5', [B.COBBLE]: '#8a8d92', [B.BRICK]: '#b5523b', [B.SNOW]: '#f4f7fb',
  [B.LAMP]: '#ffe08a', [B.CLAY]: '#b9a39a', [B.HAY]: '#e3c25a', [B.ROOF]: '#c94a3a', [B.CREAM]: '#f1e3c4', [B.MUD]: '#6b4a2e',
  [B.THRONE]: '#ffcf3a', [B.WOOL]: '#f4efe3', [B.WOOL_RED]: '#d8443a', [B.WOOL_ORANGE]: '#f08a2a', [B.WOOL_YELLOW]: '#f2cf3a',
  [B.WOOL_PINK]: '#f29ab8', [B.WOOL_GREEN]: '#5cbf4a', [B.CHEST]: '#ffcf3a', [B.CHEST_OPEN]: '#b58a3a', [B.BED]: '#e2443a',
  [B.CAMPFIRE]: '#ff8a2a', [B.SCARECROW]: '#e3c25a', [B.BELL]: '#ffcf3a', [B.JAR]: '#fff6a0', [B.BOUNCE]: '#f7a8c4', [B.MUSICBOX]: '#c98a3a', [B.SNOWMAN]: '#ffffff', [B.SANDCASTLE]: '#e8d08a', [B.STONEBRICK]: '#a9b1ba', [B.WINDOW]: '#c8ebfa', [B.BENCH]: '#c98a4e', [B.FLOWERPOT]: '#d9774a', [B.LAMPPOST]: '#ffe08a', [B.SIGN]: '#d8924e', [B.PLANTER_RIPE]: '#f2c35a',
};
const mapView = { size: 128, open: false };
const SEE_THROUGH = id => id === B.AIR || (SHAPED[id] && !IS_FEEDER(id) && id !== B.TABLE && id !== B.BED && id !== B.CAMPFIRE && id !== B.SIGN && !(id >= B.PLANTER && id <= B.PLANTER_RIPE));
// The block you'd see looking straight down on a column, and how high it is.
function topOf(x, z) {
  const cx = Math.floor(x / CS), cz = Math.floor(z / CS), c = world.getChunk(cx, cz);
  if (c) {
    const lx = x - cx * CS, lz = z - cz * CS;
    for (let y = CH - 1; y > 0; y--) { const id = c.data[lx + lz * CS + y * CS * CS]; if (!SEE_THROUGH(id)) return [id, y]; }
    return [B.BEDROCK, 0];
  }
  const h = world.heightAt(x, z);
  return h < SEA ? [B.WATER, SEA] : [world.surfaceBlock(h), h];
}
function drawMap() {
  const cv = $('#map-canvas'), g = cv.getContext('2d'), W = cv.width, N = mapView.size, px = W / N;
  const ox = Math.floor(player.pos[0]) - N / 2, oz = Math.floor(player.pos[2]) - N / 2;
  const img = g.createImageData(W, W), d = img.data, hs = new Float32Array(N + 1);
  const rgb = c => [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16)];
  const cache = {};
  for (let j = 0; j < N; j++) {
    let west = topOf(ox - 1, oz + j)[1];
    for (let i = 0; i < N; i++) {
      const [id, h] = topOf(ox + i, oz + j);
      const col = cache[id] || (cache[id] = rgb(MAP_COL[id] || '#9a8f80'));
      // light from the west and a little brighter the higher it is, so hills and valleys show
      const k = (id === B.WATER ? 0.85 : 0.82 + (h - SEA) * 0.006) + Math.max(-0.12, Math.min(0.12, (h - west) * 0.06));
      west = h;
      for (let yy = 0; yy < px; yy++) for (let xx = 0; xx < px; xx++) {
        const o = ((Math.floor(j * px) + yy) * W + Math.floor(i * px) + xx) * 4;
        d[o] = Math.min(255, col[0] * k); d[o + 1] = Math.min(255, col[1] * k); d[o + 2] = Math.min(255, col[2] * k); d[o + 3] = 255;
      }
    }
  }
  g.putImageData(img, 0, 0);
  // markers
  const at = (x, z) => [(x - ox) * px, (z - oz) * px];
  const inside = ([sx, sy]) => sx > -10 && sy > -10 && sx < W + 10 && sy < W + 10;
  const emoji = (e, x, z, s = 22) => { const p = at(x, z); if (!inside(p)) return; g.font = `${s}px system-ui, sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(e, p[0], p[1]); };
  const label = (text, x, z, dy = -18) => {
    const p = at(x, z); if (!inside(p)) return;
    g.font = 'bold 14px system-ui, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    const w = g.measureText(text).width + 12;
    g.fillStyle = 'rgba(243, 220, 182, 0.92)'; g.beginPath(); g.roundRect(p[0] - w / 2, p[1] + dy - 10, w, 20, 6); g.fill();
    g.fillStyle = '#4a2e18'; g.fillText(text, p[0], p[1] + dy);
  };
  // your buildings: beds and campfires from the blocks you've put down
  const c0x = Math.floor(ox / CS), c1x = Math.floor((ox + N) / CS), c0z = Math.floor(oz / CS), c1z = Math.floor((oz + N) / CS);
  for (let cz = c0z; cz <= c1z; cz++) for (let cx = c0x; cx <= c1x; cx++) {
    const m = world.edits.get(World.key(cx, cz));
    if (m) for (const [i, id] of m) {
      const mark = MAP_MARK[id];
      if (!mark) continue;
      emoji(mark, cx * CS + (i % CS) + 0.5, cz * CS + (Math.floor(i / CS) % CS) + 0.5, 18);
    }
    const ch = world.getChunk(cx, cz)?.chest;
    if (ch && world.getBlock(ch[0], ch[1], ch[2]) === B.CHEST) emoji('✨', ch[0] + 0.5, ch[2] + 0.5, 20);
  }
  for (const [k, t] of signs) { const [x, , z] = k.split(',').map(Number); emoji('🪧', x + 0.5, z + 0.5, 16); label(t.length > 18 ? t.slice(0, 17) + '…' : t, x + 0.5, z + 0.5, -16); }
  let n = 0, hx = 0, hz = 0;
  for (const a of flock.animals) if (a.tame) { n++; hx += a.p[0]; hz += a.p[2]; }
  if (n) { emoji('🐣', hx / n, hz / n, 26); label('Nursery', hx / n, hz / n, 20); }
  if (trader.here) { emoji('🛒', trader.p[0], trader.p[2], 24); label('Pip’s cart', trader.p[0], trader.p[2], 20); }
  for (const o of others.values()) {
    if (o.id === myNetId) continue;
    const p = at(o.p[0], o.p[2]); if (!inside(p)) continue;
    g.fillStyle = o.char === 'charli' ? '#8fd3c3' : '#d8392b'; g.strokeStyle = '#fff'; g.lineWidth = 3;
    g.beginPath(); g.arc(p[0], p[1], 8, 0, Math.PI * 2); g.fill(); g.stroke();
    label(nameOf(o), o.p[0], o.p[2], -18);
  }
  // you: an arrow pointing the way you're facing
  const [mx, my] = at(player.pos[0], player.pos[2]), f = player.forward(), ang = Math.atan2(f[2], f[0]);
  g.save(); g.translate(mx, my); g.rotate(ang);
  g.fillStyle = '#ffffff'; g.strokeStyle = '#1c1a1a'; g.lineWidth = 3;
  g.beginPath(); g.moveTo(14, 0); g.lineTo(-9, -9); g.lineTo(-4, 0); g.lineTo(-9, 9); g.closePath(); g.stroke(); g.fill();
  g.restore();
  $('#map-zoom').textContent = N === 128 ? 'Zoom out' : 'Zoom in';
  $('#map-where').textContent = `You’re at ${Math.floor(player.pos[0])}, ${Math.floor(player.pos[2])}, ${Math.max(0, Math.floor(player.pos[1]) - SEA)} m above the sea. Up is north.`;
}
function openMap() {
  if (!world || mapView.open) return;
  mapView.open = true;
  running = false; input.enabled = false; input.state.breaking = false;
  if (document.pointerLockElement) { pickerOpenFromLock = true; document.exitPointerLock(); }
  $('#mapcard').hidden = false;
  drawMap();
  bump(stats, 'mapped');
}
function closeMap() {
  if (!mapView.open) return;
  mapView.open = false;
  $('#mapcard').hidden = true;
  pickerOpenFromLock = false;
  resume();
}
$('#btn-map').addEventListener('click', openMap);
$('#map-close').addEventListener('click', closeMap);
$('#map-zoom').addEventListener('click', () => { mapView.size = mapView.size === 128 ? 256 : 128; drawMap(); });
$('#mapcard').addEventListener('click', e => { if (e.target.id === 'mapcard') closeMap(); });
document.addEventListener('keydown', e => {
  if (e.code !== 'KeyM' || e.repeat || e.target.tagName === 'INPUT') return;
  if (mapView.open) closeMap(); else if (running) openMap();
});
// Keyboard for the panels: E or Esc shuts the bag, Esc shuts the others, P takes a photo,
// and in the bag pointing at something and pressing 1–9 puts it on that hotbar slot.
let bagHover = null;
document.addEventListener('keydown', e => {
  if (e.repeat || /^(INPUT|TEXTAREA)$/.test(e.target.tagName)) return;
  const esc = e.code === 'Escape';
  if (!$('#picker').hidden) {
    const d = /^Digit[1-9]$/.test(e.code) ? +e.code.slice(5) - 1 : -1;
    if (d >= 0 && d < hotbar.length && bagHover) {
      const was = hotbar.indexOf(bagHover);
      if (was >= 0 && was !== d) hotbar[was] = hotbar[d];
      hotbar[d] = bagHover; selected = d; buildHotbar(); buildOwned();
      e.stopPropagation(); return;
    }
    if (esc || e.code === 'KeyE') { e.stopPropagation(); closePicker(); }
    return;
  }
  if (!esc) { if (e.code === 'KeyP' && running) $('#btn-photo').click(); return; }
  if (mapView.open) closeMap();
  else if (!$('#tradecard').hidden) closeTrade();
  else if (!$('#jobcard').hidden) closeJobs();
});

// ---------- the travelling trader ----------
// Pip the goose pulls her market cart up near your nursery every other day, from morning till early afternoon.
// The host decides when she's here and where; everyone trades from their own bag. The offers change each visit.
const TRADE_FROM = 0.06, TRADE_TILL = 0.5;
const visitDay = d => d >= 1 && d % 2 === 1;
const trader = { here: false, p: [0, 0, 0], yaw: 0, day: -1, used: {}, look: 0 };
const traderBuf = new Float32Array(12);
// [what you give, what you get ('page' is a recipe page), how many times per visit]
const TRADES = [
  [[[B.WOOL, 4]], 'page', 2],
  [[[B.FLOWER_RED, 2], [B.FLOWER_YELLOW, 2], [B.FLOWER_WHITE, 2]], 'page', 1],
  [[[ITEM_FISH, 2], [ITEM_WHEAT, 2]], 'page', 1],
  [[[ITEM_EGG, 8]], [[ITEM_CAKE, 1]], 1],
  [[[ITEM_FISH, 3]], [[B.LAMP, 2]], 2],
  [[[ITEM_WHEAT, 8]], [[ITEM_APPLE, 4]], 2],
  [[[ITEM_APPLE, 6]], [[ITEM_MILK, 2]], 2],
  [[[ITEM_MILK, 2]], [[ITEM_EGG, 4]], 2],
  [[[ITEM_SEEDS, 12]], [[ITEM_CLOVER, 4]], 2],
  [[[B.COBBLE, 16]], [[B.GLASS, 4]], 2],
  [[[B.LOG, 9], [ITEM_FISH, 3]], [[ITEM_HOUSE, 1]], 1],
  [[[ITEM_BONE, 4]], [[ITEM_BREAD, 2]], 2],
  [[[ITEM_BREAD, 2]], [[B.WOOL, 4]], 2],
  [[[B.SAND, 10]], [[B.CLAY, 6]], 2],
  [[[ITEM_PIE, 1]], [[ITEM_BONE, 6], [ITEM_SEEDS, 10]], 1],
  [[[B.COBBLE, 10]], [[ITEM_GRILLED, 2]], 2],
];
// Five offers for this visit (the same for everyone playing together), always with a recipe page among them.
function todaysTrades() {
  let s = (world.seed ^ Math.imul(trader.day + 1, 2654435761)) >>> 0;
  const rnd = () => { s = (Math.imul(s ^ (s >>> 15), 2246822507) + 0x9e3779b9) >>> 0; return s / 4294967296; };
  const pages = TRADES.map((t, i) => i).filter(i => TRADES[i][1] === 'page'), rest = TRADES.map((t, i) => i).filter(i => TRADES[i][1] !== 'page');
  const pick = list => list.splice(Math.floor(rnd() * list.length), 1)[0];
  return [pick(pages), pick(rest), pick(rest), pick(rest), pick(rest)];
}
// Host: is it a visiting day? Then find a flat spot near the nursery for the cart.
function traderStep(dt) {
  if (net.isGuest || !world) return;
  const want = visitDay(nights) && clock >= TRADE_FROM && clock < TRADE_TILL;
  if (!want) { if (trader.here) traderLeaves(); return; }
  if (trader.here || (trader.look -= dt) > 0) return;
  trader.look = 2;
  const spot = traderSpot();
  if (spot) traderArrives(spot.p, spot.yaw, nights);
}
function traderSpot() {
  // near the nursery if there is one, otherwise (or if it's all water and trees there) near you
  let n = 0, hx = 0, hz = 0;
  for (const a of flock.animals) if (a.tame) { n++; hx += a.p[0]; hz += a.p[2]; }
  const centres = n ? [[hx / n, hz / n], [player.pos[0], player.pos[2]]] : [[player.pos[0], player.pos[2]]];
  for (const [cx, cz] of centres) for (let tries = 0; tries < 80; tries++) {
    const ang = tries * 2.4, r = 5 + (tries % 14) * 0.8;
    const x = Math.floor(cx + Math.cos(ang) * r), z = Math.floor(cz + Math.sin(ang) * r);
    if (!world.getChunk(Math.floor(x / CS), Math.floor(z / CS))) continue;
    // start at the land's own height (under any trees), then step up past anything built on it
    let y = world.heightAt(x, z) + 1;
    while (y < CH - 3 && SOLID[world.getBlock(x, y, z)]) y++;
    while (y > 1 && !SOLID[world.getBlock(x, y - 1, z)]) y--;
    const ground = world.getBlock(x, y - 1, z);
    if (ground === B.LEAVES) continue; // (water is ruled out below: it isn't solid ground)
    let clear = true;
    for (let dx = -1; dx <= 1 && clear; dx++) for (let dz = -1; dz <= 1 && clear; dz++) {
      if (!SOLID[world.getBlock(x + dx, y - 1, z + dz)]) clear = false;
      for (let dy = 0; dy < 2 && clear; dy++) if (world.getBlock(x + dx, y + dy, z + dz) !== B.AIR) clear = false;
    }
    if (!clear) continue;
    return { p: [x + 0.5, y, z + 0.5], yaw: Math.atan2(cx - x - 0.5, cz - z - 0.5) };
  }
  return null;
}
function traderArrives(p, yaw, day) {
  if (trader.day !== day) trader.used = {};
  Object.assign(trader, { here: true, p, yaw, day });
  sfx.happy();
  const first = !firsts.includes('trader');
  if (first) firsts.push('trader');
  toast(first ? 'Honk! Pip the travelling goose has pulled her cart up near your nursery. Follow the 🛒 tag and tap her to swap things. She’s here till early afternoon.'
    : 'Honk! Pip the travelling goose is back with her cart, and some new things to swap.', first ? 7000 : 4200);
}
function traderLeaves() {
  trader.here = false;
  if ($('#tradecard').hidden === false) closeTrade();
  toast('Pip packed up her cart and waddled off. She’ll be back in a couple of days.', 3500);
}
function traderGroup(time) {
  const d = traderBuf;
  d.set([trader.p[0], trader.p[1], trader.p[2], trader.yaw + 0.05 * Math.sin(time * 1.3), 1, 0, 0, 0, 0, 0, 0, 0]);
  return { model: 'trader', data: d, count: 1 };
}
// Tapping Pip (or her cart)?
// A little label under the crosshair saying what tapping (or right clicking) the thing you're looking at does.
const ACT = {
  [B.BENCH]: 'Sit down', [B.GATE]: 'Open the gate', [B.GATE_OPEN]: 'Shut the gate', [B.CHEST]: 'Open the chest',
  [B.BED]: 'Sleep till morning', [B.BELL]: 'Ring the bell', [B.MUSICBOX]: 'Play a tune', [B.SIGN]: 'Write on the sign',
  [B.PLANTER_RIPE]: 'Pick the wheat', [B.DOOR]: 'Open the door', [B.DOOR_TOP]: 'Open the door', [B.DOOR_OPEN]: 'Shut the door', [B.DOOR_OPEN_TOP]: 'Shut the door',
};
let actShown = '';
function actionHint() {
  let what = '', bag = false;
  if (running && !seat) {
    const id = target?.id, held = hotbar[selected];
    if (aimingAtTrader()) what = 'Swap with Pip';
    else if (id === B.THRONE) what = 'Sit on the throne';
    else if (ACT[id]) what = ACT[id];
    else if (id === B.PLANTER && held === ITEM_SEEDS && have(held)) what = 'Plant seeds';
    else if (IS_FEEDER(id) && FEEDER_OF[held] && FEEDER_TREAT[id] !== held) what = 'Fill the feeder';
    else if (id === B.TABLE) { what = 'make things here'; bag = true; }
    else if (id === B.CAMPFIRE) { what = 'cook here'; bag = true; }
  }
  const text = !what ? '' : bag ? (input.usingTouch ? `Open your bag to ${what}` : `Press E to ${what}`)
    : (input.usingTouch ? 'Tap: ' : 'Right click: ') + what;
  if (text === actShown) return;
  actShown = text;
  const el = $('#act-hint');
  el.textContent = text; el.hidden = !text;
}
function aimingAtTrader() {
  if (!trader.here) return false;
  const eye = player.eye(), fwd = player.forward();
  const vx = trader.p[0] - eye[0], vy = trader.p[1] + 0.9 - eye[1], vz = trader.p[2] - eye[2], d = Math.hypot(vx, vy, vz);
  if (d > 4.5) return false;
  if (target && Math.hypot(target.x + 0.5 - eye[0], target.y + 0.5 - eye[1], target.z + 0.5 - eye[2]) < d - 1.2) return false;
  return (vx * fwd[0] + vy * fwd[1] + vz * fwd[2]) / (d || 1) > (d < 1.6 ? 0.4 : 0.8);
}
function openTrade() {
  running = false; input.enabled = false; input.state.breaking = false;
  if (document.pointerLockElement) { pickerOpenFromLock = true; document.exitPointerLock(); }
  buildTrades();
  $('#tradecard').hidden = false;
  sfx.call('chick', 0.3);
}
function closeTrade() {
  $('#tradecard').hidden = true;
  pickerOpenFromLock = false;
  resume();
}
const giveList = list => list.map(([id, k]) => `<span class="tr-item"><img alt="" src="${icons[id]}"><em>${k}</em></span>`).join('');
function buildTrades() {
  const box = $('#trade-list');
  box.textContent = '';
  for (const i of todaysTrades()) {
    const [give, get, times] = TRADES[i], left = times - (trader.used[i] || 0);
    const can = left > 0 && give.every(([id, k]) => have(id) >= k);
    const row = document.createElement('div');
    row.className = 'trade' + (can ? ' ready' : '');
    const getHtml = get === 'page' ? '<span class="tr-item page">📜<em>Recipe page</em></span>' : giveList(get);
    row.innerHTML = `<div class="tr-give">${giveList(give)}</div><span class="tr-arrow" aria-hidden="true">→</span><div class="tr-get">${getHtml}</div>` +
      `<button type="button" class="primary"${can ? '' : ' disabled'}>${left > 0 ? 'Swap' : 'Sold out'}</button>`;
    const words = l => l.map(([id, k]) => { const n = itemName(id).toLowerCase(); return `${k} ${k > 1 && /(egg|apple|log|bone|lamp|kit|cake|pie|flower)$/.test(n) ? n + 's' : n}`; }).join(', ');
    row.querySelector('button').setAttribute('aria-label', `Swap ${words(give)} for ${get === 'page' ? 'a recipe page' : words(get)}. ${left} left.`);
    row.querySelector('button').addEventListener('click', () => doTrade(i));
    box.appendChild(row);
  }
}
function doTrade(i) {
  const [give, get, times] = TRADES[i];
  if ((trader.used[i] || 0) >= times || !give.every(([id, k]) => have(id) >= k)) return;
  for (const [id, k] of give) useItem(id, k);
  trader.used[i] = (trader.used[i] || 0) + 1;
  if (get === 'page') {
    const u = pickPage(knownList(), settings.patterns || [], foundEver);
    if (u) learn(u, 'page');
    else { addItem(ITEM_APPLE, 4); toast('You know every recipe already! Pip gives you 4 apples instead.'); }
  } else for (const [id, k] of get) { addItem(id, k); bump(stats, 'got', id, k); }
  bump(stats, 'traded');
  sfx.pickup(); buzz(10);
  buildTrades();
}
$('#trade-close').addEventListener('click', closeTrade);
$('#tradecard').addEventListener('click', e => { if (e.target.id === 'tradecard') closeTrade(); });

// ---------- cooking: eat a snack for a boost, or throw a party ----------
const SNACK = {
  [ITEM_BREAD]: { boost: 1.5, t: 60, say: 'Yum, fresh bread! Zoomies: you run faster for a minute.' },
  [ITEM_GRILLED]: { spring: 1.35, t: 60, say: 'Tasty grilled fish! Springy: you jump twice as high for a minute.' },
  [ITEM_PIE]: { boost: 1.5, spring: 1.35, t: 90, say: 'Apple pie! Zoomies and springy, for a minute and a half.' },
};
let snackT = 0, snackOf = 0;
const boostEl = document.createElement('div');
boostEl.className = 'pill boost'; boostEl.hidden = true;
$('#nursery').appendChild(boostEl);
function eat(id) {
  const s = SNACK[id];
  useItem(id); bump(stats, 'ate', id);
  player.boost = s.boost || 1; player.spring = s.spring || 1;
  snackT = s.t; snackOf = id;
  boostEl.innerHTML = `<img alt="" src="${icons[id]}"><span></span>`;
  sfx.munch(); buzz(12);
  toast(s.say);
}
function snackStep(dt) {
  if (snackT <= 0) return;
  snackT -= dt;
  if (snackT <= 0) { player.boost = player.spring = 1; boostEl.hidden = true; toast(`Your ${itemName(snackOf).toLowerCase()} has worn off.`, 2500); return; }
  boostEl.hidden = false;
  const left = Math.ceil(snackT) + 's';
  const span = boostEl.querySelector('span');
  if (span.textContent !== left) span.textContent = left;
}
// A campfire close by crackles now and then.
let fireNear = 0, fireLook = 0, fireT = 0;
function campfireCrackle(dt) {
  if (!running || !world) return;
  if ((fireLook -= dt) <= 0) {
    fireLook = 0.6;
    const [x, y, z] = player.pos;
    const f = world.placedNear(x, z, 6, id => id === B.CAMPFIRE).filter(t => Math.abs(t[1] - y) <= 4)
      .map(t => Math.hypot(t[0] + 0.5 - x, t[2] + 0.5 - z));
    fireNear = f.length ? Math.max(0.05, Math.min(...f)) : 0;
  }
  if (!fireNear || (fireT -= dt) > 0) return;
  fireT = 0.15 + Math.random() * 0.5;
  sfx.crackle(0.09 * (1 - fireNear / 7));
}
// A party cake: every tame animal close by comes to the party. Babies grow a good bit.
function party() {
  useItem(ITEM_CAKE); bump(stats, 'parties');
  const p = [...player.pos];
  if (net.isGuest) net.toHost({ t: 'party', p });
  else partyAt(p);
  sfx.fanfare(); buzz(30);
  if (net.isGuest) toast('Party time! Your babies close by get cake, and they grow a little.');
}
function partyAt(p, who) {
  const n = flock.party(p);
  if (who) toast(`${nameOf(who)} threw a party!`, 2500);
  else toast(n ? `Party time! ${n} ${n === 1 ? 'animal came' : 'animals came'} for cake, and the babies grew a little.` : 'Party time! But nobody came… throw a party close to your babies.');
}

// ---------- the dinner bell and fireworks ----------
const okP = p => Array.isArray(p) && p.length === 3 && p.every(Number.isFinite);
function ringBell(t) {
  const p = [t.x, t.y, t.z];
  sfx.ding(); buzz(20); bump(stats, 'rang');
  floatFx([t.x + 0.5, t.y + 0.6, t.z + 0.5], 'heart');
  if (net.isGuest) { net.toHost({ t: 'bell', p }); toast('Ding ding! Dinner time: your animals are on their way.', 3000); return; }
  bellAt(p);
}
function bellAt(p, who, from) {
  const n = flock.callHome(p);
  if (net.isHost) net.broadcast({ t: 'ding', p }, from);
  if (who) { sfx.ding(); toast(`${nameOf(who)} rang the dinner bell!`, 2500); }
  else toast(n ? `Ding ding! Dinner time: ${n} ${n === 1 ? 'animal is' : 'animals are'} on the way to the bell.` : 'Ding ding! Nobody came… tame some babies, then ring it to call them home.', 3500);
}

const fireworks = new Fireworks();
let fwCool = 0;
function launchFirework() {
  if (fwCool > 0) return;
  fwCool = 0.5;
  const f = player.forward(), l = Math.hypot(f[0], f[2]) || 1;
  const p = [player.pos[0] + f[0] / l * 1.6, player.pos[1], player.pos[2] + f[2] / l * 1.6];
  const seed = Math.random() * 1e9 | 0;
  useItem(ITEM_FIREWORK); bump(stats, 'fireworks'); buzz(12);
  fireworks.launch(p, seed);
  if (net.isGuest) net.toHost({ t: 'fw', p, seed }); else if (net.isHost) net.broadcast({ t: 'fw', p, seed });
  if (!firsts.includes('firework')) {
    firsts.push('firework');
    toast(skyAt(clock).night > 0.5 ? 'Whoosh… BANG! Your babies love a firework show.' : 'Whoosh… BANG! Fireworks look even better at night.');
  }
}
function fireworkStep(dt, eye) {
  fwCool = Math.max(0, fwCool - dt);
  fireworks.update(dt);
  for (const ev of fireworks.events) {
    const d = Math.hypot(ev.p[0] - eye[0], ev.p[1] - eye[1], ev.p[2] - eye[2]);
    if (ev.type === 'launch') sfx.rocket(0.12 * Math.max(0, 1 - d / 50));
    else { sfx.bang(0.4 * Math.max(0, 1 - d / 110)); if (!net.isGuest) flock.cheer(ev.p, 18); }
  }
  fireworks.events.length = 0;
}

// ---------- fireflies in jars and shooting stars ----------
// Hold glass and tap a firefly at night: it goes into a jar that glows like a little lamp.
function catchFirefly() {
  const c = critters.catchAt(player.eye(), player.forward());
  if (!c) return false;
  useItem(B.GLASS); addItem(B.JAR, 1, true); bump(stats, 'jars'); bump(stats, 'got', B.JAR);
  sfx.twinkle(); buzz(10);
  pickupPop({ x: c.p[0] - 0.5, y: c.p[1] - 0.8, z: c.p[2] - 0.5 }, [[B.JAR, 1]]);
  if (!firsts.includes('jar')) { firsts.push('jar'); toast('You caught a firefly! Put the jar down and it glows like a little lamp all night.'); }
  return true;
}

// Now and then on a clear night a shooting star streaks across the sky. Look right at it before it
// fades and you make a wish, and a little present turns up in your bag.
const WISHES = [[ITEM_FIREWORK, 2, '2 fireworks'], [ITEM_MILK, 2, '2 bottles of milk'], [ITEM_EGG, 2, '2 eggs'], [ITEM_PIE, 1, 'an apple pie'], [ITEM_CAKE, 1, 'a party cake'], [B.LAMP, 2, '2 lamps'], [ITEM_APPLE, 5, '5 apples'], [B.WOOL_PINK, 3, '3 pink wool']];
let starT = 20, wishStar = null;
function starStep(dt, eye, fwd, far) {
  if (running && skyAt(clock).night > 0.8 && weather.amount < 0.2 && !sleeping) starT -= dt;
  if (starT <= 0) {
    starT = 35 + Math.random() * 50;
    // up in the sky, more or less in front of you, sliding sideways and a little down
    const yaw = Math.atan2(fwd[0], fwd[2]) + (Math.random() - 0.5) * 2.2, el = 0.45 + Math.random() * 0.4, d = Math.min(far * 0.75, 70);
    const p = [eye[0] + Math.sin(yaw) * Math.cos(el) * d, eye[1] + Math.sin(el) * d, eye[2] + Math.cos(yaw) * Math.cos(el) * d];
    const side = Math.random() < 0.5 ? 1 : -1, sp = d * 0.55;
    wishStar = fireworks.star(p, [Math.cos(yaw) * side * sp, -sp * 0.25, -Math.sin(yaw) * side * sp], 1.8);
    sfx.twinkle(0.08);
  }
  if (!wishStar) return;
  if (wishStar.life <= 0) { wishStar = null; return; }
  const dx = wishStar.p[0] - eye[0], dy = wishStar.p[1] - eye[1], dz = wishStar.p[2] - eye[2], l = Math.hypot(dx, dy, dz) || 1;
  if ((dx * fwd[0] + dy * fwd[1] + dz * fwd[2]) / l > 0.965) {
    wishStar.big = 7; wishStar = null;
    const [item, k, what] = WISHES[Math.random() * WISHES.length | 0];
    addItem(item, k, true); bump(stats, 'wishes'); sfx.twinkle(0.3); buzz(15);
    toast(`✨ You made a wish on a shooting star… and got ${what}!`, 4000, true);
  }
}

// ---------- the music box ----------
// Tap it and it plays a little tune; tame animals close by hop and wag along to the beat.
let boxes = []; // tunes playing: { p, t: time left, beat }
function playBox(t) {
  const p = [t.x, t.y, t.z];
  if (boxes.some(b => b.p[0] === p[0] && b.p[1] === p[1] && b.p[2] === p[2])) return; // already playing
  const seed = Math.random() * 1e9 | 0;
  bump(stats, 'tunes'); buzz(10);
  if (net.isGuest) net.toHost({ t: 'tune', p, seed }); else if (net.isHost) net.broadcast({ t: 'tune', p, seed });
  tuneAt(p, seed);
  if (!firsts.includes('tune')) { firsts.push('tune'); toast('♪ Your animals love a tune! Any that are close by dance along. Every play is a different song.', 3500); }
}
function tuneAt(p, seed) {
  const e = player.eye(), d = Math.hypot(p[0] + 0.5 - e[0], p[1] + 0.5 - e[1], p[2] + 0.5 - e[2]);
  const len = d < 40 ? sfx.tune(seed, 0.16 * (1 - d / 40)) : 6;
  boxes.push({ p, t: len, beat: 0 });
}
function boxStep(dt) {
  for (const b of boxes) {
    b.t -= dt; b.beat -= dt;
    if (b.beat <= 0 && b.t > 0.8) {
      b.beat = 0.52;
      const c = [b.p[0] + 0.5, b.p[1] + 0.5, b.p[2] + 0.5];
      if (!net.isGuest) flock.cheer(c, 14);
      floatFx([c[0] + (Math.random() - 0.5) * 0.6, c[1], c[2] + (Math.random() - 0.5) * 0.6], 'note');
    }
  }
  boxes = boxes.filter(b => b.t > 0 && world.getBlock(b.p[0], b.p[1], b.p[2]) === B.MUSICBOX);
}

// ---------- messages in bottles ----------
// Now and then your fishing line brings up a bottle with a note inside. Most lead to a treasure chest
// further off than the Treasure tag usually shows; the tag then points the way till you open it.
let mapChest = null;
const BOTTLE_NOTES = ['“X marks the spot! My treasure is', '“Ahoy! I hid a chest', '“To whoever finds this: there’s treasure'];
function fishBottle() {
  bump(stats, 'bottles'); bump(stats, 'fished');
  sfx.splash(); sfx.twinkle(); buzz(15);
  const e = player.eye(), pcx = Math.floor(e[0] / CS), pcz = Math.floor(e[2] / CS);
  // the nearest shut chest beyond the Treasure tag's usual 30 blocks, or failing that, beyond 12
  let best = null, bd = Infinity, near = null, nd = Infinity;
  for (let dz = -8; dz <= 8; dz++) for (let dx = -8; dx <= 8; dx++) {
    const c = world.getChunk(pcx + dx, pcz + dz)?.chest;
    if (!c || world.getBlock(c[0], c[1], c[2]) !== B.CHEST) continue;
    const d = Math.hypot(c[0] + 0.5 - e[0], c[2] + 0.5 - e[2]);
    if (d > 30 && d < bd) { bd = d; best = c; }
    else if (d > 12 && d < nd) { nd = d; near = c; }
  }
  if (!best && near) { best = near; bd = nd; }
  if (best) {
    mapChest = best;
    const note = BOTTLE_NOTES[Math.random() * BOTTLE_NOTES.length | 0];
    toast(`📜 A message in a bottle! ${note} about ${Math.round(bd)} steps from here.” Follow the gold Treasure tag!`, 6000, true);
  } else {
    const got = [[B.GLASS, 1], [ITEM_APPLE, 3]];
    for (const [item, n] of got) addItem(item, n);
    toast('📜 A message in a bottle! “Hello from far away! Here’s a little present.” (Explore further to find treasure maps.)', 5000, true);
    pickupPop({ x: Math.floor(fishing.p[0]), y: Math.floor(fishing.p[1]), z: Math.floor(fishing.p[2]) }, got);
  }
}

// ---------- hide and seek ----------
// Now and then by day a baby from your nursery asks to play: it runs off to hide somewhere tucked away
// (by a tree, a wall or a bush). Go and find it! It giggles every few seconds, louder as you get close.
// Not found in three minutes (or by dark), it gives up and runs home. The host runs it for everyone's animals.
let seek = null, seekT = 150 + Math.random() * 150;
const SEEK_TIME = 180;
function hidingSpot(from) {
  let best = null, bs = -1;
  for (let k = 0; k < 50; k++) {
    const ang = Math.random() * Math.PI * 2, d = 12 + Math.random() * 12;
    const x = Math.floor(from[0] + Math.cos(ang) * d), z = Math.floor(from[2] + Math.sin(ang) * d);
    if (!world.getChunk(Math.floor(x / CS), Math.floor(z / CS))) continue;
    for (let y = Math.floor(from[1]) + 6; y > from[1] - 8; y--) {
      const below = world.getBlock(x, y - 1, z);
      if (world.getBlock(x, y, z) || world.getBlock(x, y + 1, z) || !SOLID[below]) continue;
      if (below === B.WATER) break;
      // how tucked away it is: walls and trunks beside it, leaves overhead
      let s = 0;
      for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (SOLID[world.getBlock(x + dx, y, z + dz)]) s += 2;
      for (let h = 2; h < 6; h++) if (world.getBlock(x, y + h, z) === B.LEAVES) { s += 2; break; }
      if (s > bs) { bs = s; best = [x + 0.5, y, z + 0.5]; }
      break;
    }
  }
  return best;
}
function startSeek() {
  const kids = flock.animals.filter(a => a.tame && (a.grow || 0) < 1 && !a.called && Math.hypot(a.p[0] - player.pos[0], a.p[2] - player.pos[2]) < 30);
  if (!kids.length) return false;
  const a = kids[Math.random() * kids.length | 0], spot = hidingSpot(a.p);
  if (!spot) return false;
  seek = { a, home: [...(a.home || a.p)], t: SEEK_TIME, hint: 25 };
  a.callTo = spot; a.called = 60; a.hiding = true; a.sleep = false; a.spot = null; a.enjoy = 0;
  toast(`🙈 ${callName(a.name, a.sp, 'Your', a.nick)} wants to play hide and seek! Count to ten… then go and find it. Listen for giggles!`, 6000, true);
  return true;
}
function seekStep(dt) {
  if (net.isGuest || !running || sleeping) return;
  const night = skyAt(clock).night;
  if (!seek) {
    if (night > 0.3) return;
    seekT -= dt;
    if (seekT <= 0) seekT = startSeek() ? 360 + Math.random() * 300 : 60;
    return;
  }
  const a = seek.a, who = callName(a.name, a.sp, 'Your', a.nick);
  if (!flock.animals.includes(a) || !a.tame) { a.hiding = false; seek = null; return; }
  seek.t -= dt;
  const d = Math.hypot(a.p[0] - player.pos[0], a.p[2] - player.pos[2]);
  const runHome = () => { a.hiding = false; a.callTo = seek.home; a.called = 40; a.wag = 1; seek = null; };
  if (seek.t < SEEK_TIME - 6 && d < 2.8 && Math.abs(a.p[1] - player.pos[1]) < 3) {
    const got = [[[ITEM_APPLE, 3], [ITEM_CLOVER, 3], [ITEM_MILK, 1], [ITEM_EGG, 2]][Math.random() * 4 | 0]];
    for (const [item, n] of got) addItem(item, n, true);
    bump(stats, 'found');
    if (a.onGround) a.v[1] = 4.5;
    floatFx([a.p[0], a.p[1] + 0.4, a.p[2]], 'heart'); sfx.happy(); buzz(20);
    pickupPop({ x: Math.floor(a.p[0]), y: Math.floor(a.p[1]), z: Math.floor(a.p[2]) }, got);
    toast(`👀 Found you! ${who} giggles and runs back to the nursery. (Found in ${Math.round(SEEK_TIME - seek.t)} seconds.)`, 4500, true);
    runHome();
    return;
  }
  seek.hint -= dt;
  if (seek.hint <= 0) { seek.hint = 6; sfx.cheep(0.4 * Math.max(0.12, 1 - d / 45), 1.35); setTimeout(() => sfx.cheep(0.3 * Math.max(0.12, 1 - d / 45), 1.5), 160); }
  if (seek.t <= 0 || night > 0.5) { toast(`${who} got tired of hiding and ran home. Better luck next time!`, 3500); runHome(); }
}

// ---------- sleeping ----------
// Tap a bed when it's dark: the screen fades out and you wake up at sunrise.
// Playing together, anyone can sleep: the host moves the clock on for everybody.
const MORNING = 0.985;
let sleeping = false;
function sleepInBed(guest) {
  if (sleeping || !world) return;
  if (skyAt(clock).night < 0.5) {
    if (!guest) toast(skyAt(clock).night > 0.05 ? 'It’s not quite bedtime. Come back when it’s dark to sleep till morning.' : 'It’s daytime! Come back when it’s dark to sleep till morning.');
    return;
  }
  if (!guest) bump(stats, 'slept');
  if (net.isGuest) { net.toHost({ t: 'sleep' }); return; } // the host sends 'slept' back to everyone
  if (net.isHost) net.broadcast({ t: 'slept' });
  if (guest) toast(`${nameOf(guest)} went to bed. Sleeping till morning…`);
  sleptNight = true;
  sleepFade();
  setTimeout(() => { clock = MORNING; }, 900);
}
function sleepFade() {
  if (sleeping) return;
  sleeping = true;
  const el = $('#sleep');
  el.hidden = false;
  setTimeout(() => el.classList.add('on'), 20);
  setTimeout(() => {
    el.classList.remove('on');
    sfx.grown();
    setTimeout(() => { el.hidden = true; sleeping = false; }, 800);
  }, 1800);
}
function hideHintLater() { setTimeout(() => $('#touch-hint').classList.add('gone'), 7000); setTimeout(() => $('#desk-hint').classList.add('gone'), 20000); }

// settings
const sView = $('#set-view'), sSens = $('#set-sens'), sAuto = $('#set-autojump'), sFps = $('#set-fps'), sSound = $('#set-sound');
const sMusic = $('#set-music');
function applySettings() {
  sView.value = settings.view; $('#view-val').textContent = settings.view + ' chunks';
  sSens.value = settings.sens; $('#sens-val').textContent = (+settings.sens).toFixed(1) + '×';
  sAuto.checked = settings.autoJump; sFps.checked = settings.showFps; sSound.checked = settings.sound;
  sfx.enabled = settings.sound;
  sMusic.checked = settings.music; sMusic.disabled = !settings.sound;
  music.enabled = settings.sound && settings.music;
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
sMusic.addEventListener('change', () => { settings.music = sMusic.checked; applySettings(); });
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
  // Treasure: a gold tag points to a shut chest close by.
  const tc = nearestChest(eye);
  if (!chestEl) {
    chestEl = document.createElement('div');
    chestEl.innerHTML = '<span class="arrow" aria-hidden="true"></span><span class="name"></span>';
    box.appendChild(chestEl);
  }
  const td = tc && Math.hypot(tc[0] + 0.5 - eye[0], tc[2] + 0.5 - eye[2]);
  chestEl.hidden = !(td > 2.5);
  if (!chestEl.hidden) {
    const label = `✨ Treasure · ${Math.round(td)} m`;
    if (chestEl.lastName !== label) { chestEl.querySelector('.name').textContent = label; chestEl.lastName = label; }
    pinTag(chestEl, 'tag treasure', tc[0] + 0.5, tc[1] + 1.4, tc[2] + 0.5, W, H, eye, f, r, u);
  }
  updateSignTags(box, eye);
  // The trader: a tag over Pip's cart while she's visiting.
  if (!traderEl) {
    traderEl = document.createElement('div');
    traderEl.innerHTML = '<span class="arrow" aria-hidden="true"></span><span class="name"></span>';
    box.appendChild(traderEl);
  }
  const trd = trader.here && Math.hypot(trader.p[0] - eye[0], trader.p[2] - eye[2]);
  traderEl.hidden = !(trd > 3);
  if (!traderEl.hidden) {
    const label = `🛒 Pip’s cart · ${Math.round(trd)} m`;
    if (traderEl.lastName !== label) { traderEl.querySelector('.name').textContent = label; traderEl.lastName = label; }
    pinTag(traderEl, 'tag trader', trader.p[0], trader.p[1] + 2.4, trader.p[2], W, H, eye, f, r, u);
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
let homeEl = null, traderEl = null;
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
  const common = { t: 's', clock: +clock.toFixed(5), nights, crown, sk: streak, counts: flock.counts(), pl, sn: snakes.snapshot(), rd: raiders.snapshot(), tr: flock.treatSnapshot(), gf: flock.giftSnapshot(), wx: weather.snapshot(), ev,
    td: trader.here ? [...trader.p, +trader.yaw.toFixed(3), trader.day] : 0 };
  for (const [id] of net.conns) {
    const o = others.get(id);
    // animals go every other update (about 4 a second): the copies glide in between
    net.send(id, sendAnimals ? { ...common, a: flock.snapshot(o ? o.tp : player.pos, 64), nk: flock.nickSnapshot(), ht: flock.hatSnapshot() } : common);
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
      net.send(from, { t: 'w', id: from, seed: world.seed, edits: part, clock, nights, crown, pos, yaw: player.yaw + Math.PI, signs: signsOut() });
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
    case 'nick': if (typeof msg.id === 'number') flock.setNick(msg.id, msg.nick); break;
    case 'hat': if (typeof msg.id === 'number') flock.setHat(msg.id, msg.hat); break;
    case 'sign': if (Array.isArray(msg.at)) { const [x, y, z] = msg.at; if (setSign(x, y, z, msg.text, true)) net.broadcast(msg, from); } break;
    case 'sleep': if (o) sleepInBed(o); break;
    case 'bell': if (o && okP(msg.p)) bellAt(msg.p, o, from); break;
    case 'fw': if (okP(msg.p) && Number.isFinite(msg.seed)) { fireworks.launch(msg.p, msg.seed | 0); net.broadcast(msg, from); } break;
    case 'tune': if (okP(msg.p) && Number.isFinite(msg.seed)) { tuneAt(msg.p, msg.seed | 0); net.broadcast(msg, from); } break;
    case 'party': if (o && Array.isArray(msg.p) && msg.p.length === 3 && msg.p.every(Number.isFinite)) partyAt(msg.p, o); break;
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
    case 'sign': if (Array.isArray(msg.at)) { const [x, y, z] = msg.at; setSign(x, y, z, msg.text, true); } break;
    case 'slept': sleepFade(); break;
    case 'ding': sfx.ding(); break;
    case 'fw': if (okP(msg.p) && Number.isFinite(msg.seed)) fireworks.launch(msg.p, msg.seed | 0); break;
    case 'tune': if (okP(msg.p) && Number.isFinite(msg.seed)) tuneAt(msg.p, msg.seed | 0); break;
    case 's': {
      if (Math.abs(msg.clock - clock) > 0.002 && Math.abs(msg.clock - clock) < 0.998) clock = msg.clock;
      nights = msg.nights;
      flock.remoteCounts = msg.counts;
      if (msg.a) { flock.applySnapshot(msg.a); flock.applyNicks(msg.nk); flock.applyHats(msg.ht); }
      flock.applyTreats(msg.tr || []);
      flock.applyGifts(msg.gf || []);
      // events first, so a snake that just poofed is still here to burst into confetti
      for (const ev of msg.ev || []) {
        if (ev.type === 'crown') { if ((ev.level || 1) > crown) awardCrown(ev.level || 1); continue; }
        if (ev.f) flock.events.push(ev);
        else if (ev.w) weather.events.push(ev);
        else if (ev.r) { raiders.remoteEvent(ev); raiders.events.push(ev); }
        else { snakes.remoteEvent(ev); snakes.events.push(ev); }
      }
      snakes.applySnapshot(msg.sn || []);
      raiders.applySnapshot(msg.rd || []);
      weather.applySnapshot(msg.wx);
      if (Array.isArray(msg.td) && msg.td.length === 5 && msg.td.every(Number.isFinite)) { if (!trader.here) traderArrives(msg.td.slice(0, 3), msg.td[3], msg.td[4]); else trader.p = msg.td.slice(0, 3); }
      else if (!msg.td && trader.here) traderLeaves();
      const seen = new Set();
      for (const [id, char, x, y, z, yaw, pitch, held, sit, nick, fit] of msg.pl || []) {
        if (id === myNetId) continue;
        seen.add(id);
        const o = others.get(id) || addOther(id, char);
        setPose(o, [x, y, z], yaw, pitch, held, sit, char, nick, fit);
      }
      for (const id of [...others.keys()]) if (!seen.has(id)) others.delete(id);
      if (others.size !== shownOthers) { shownOthers = others.size; updateRoomUi(); }
      if ((msg.crown | 0) > crown) { crown = msg.crown | 0; showCrown(); }
      if ((msg.sk | 0) !== streak) { streak = msg.sk | 0; showStreak(); }
      break;
    }
  }
}

function startGuestWorld(w) {
  myNetId = w.id;
  startWorld({ v: 3, guest: true, seed: w.seed, edits: w.edits, pos: w.pos, yaw: w.yaw, pitch: 0, clock: w.clock, nights: w.nights, crown: w.crown | 0, signs: w.signs });
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
      if (Math.abs(st.moveX) > 0.2 || Math.abs(st.moveZ) > 0.2 || st.jump || world.getBlock(seat.x, seat.y, seat.z) !== (seat.id ?? B.THRONE)) standUp();
      else { player.pos = [seat.x + 0.5, seat.y + (seat.h ?? 1), seat.z + 0.5]; player.vel = [0, 0, 0]; }
    }
    // poison goo makes your feet sticky and slow
    const gooey = !player.flying && snakes.inGoo(player.pos);
    player.slow = gooey ? 0.4 : 1;
    if (gooey && !firsts.includes('goo')) { firsts.push('goo'); toast('Yuck, poison goo! It makes you slow. Step out of it, it dries up soon.'); }
    player.ring = hotbar[selected] === ITEM_RING && have(ITEM_RING) > 0;
    if (!seat && world.getChunk(Math.floor(player.pos[0] / CS), Math.floor(player.pos[2] / CS))) player.update(dt, input.state, world);
    if (player.ring && player.inWater) {
      stats.swum = (stats.swum || 0) + Math.hypot(player.vel[0], player.vel[2]) * dt;
      if (!firsts.includes('ring')) { firsts.push('ring'); toast('Wheee! With the swim ring you float on top and paddle fast. Jump to hop out onto the bank.'); }
    }
    if (player.pos[1] < -20) { player.pos[1] = CH; player.vel[1] = 0; }
    if (player.bounced) {
      sfx.boing(Math.min(1.4, player.vel[1] / 14)); bump(stats, 'bounced', undefined, player.bounced); player.bounced = 0;
      if (!firsts.includes('boing')) { firsts.push('boing'); toast('Boing! Hold jump just as you land to bounce higher and higher.'); }
    }
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
  $('#loading').hidden = pending === 0 || running || !!document.querySelector('#picker:not([hidden]), #mapcard:not([hidden]), #tradecard:not([hidden]), #jobcard:not([hidden]), #signcard:not([hidden])');

  const cam = wardrobe.open ? selfieCam(dt) : null;
  const eye = cam ? cam.eye : player.eye(), fwd = cam ? cam.fwd : player.forward();
  target = running && !cam ? raycast(world, eye, fwd, REACH) : null;
  if (running) updateBreaking(dt);
  actionHint();

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
  fishStep(dt);
  if (fishing) s.groups.push(bobberGroup());
  if (trader.here) s.groups.push(traderGroup(now / 1000));
  fireworkStep(dt, eye);
  starStep(dt, eye, fwd, far);
  boxStep(dt);
  seekStep(dt);
  s.groups.push(...fireworks.instances(eye, far + 8));
  sfx.rain(running && !underwater && !weather.snowing ? weather.amount : 0);
  music.day = skyAt(clock).night < 0.3;
  if (running) snackStep(dt);
  traderStep(dt);
  campfireCrackle(dt);
  if (weather.snowing && weather.amount > 0.3 && running && !firsts.includes('snow')) { firsts.push('snow'); toast('It’s snowing up here on the mountain! Down in the valley it’s only rain.'); }
  // birds singing by day, crickets at night (only on the surface, away from heavy rain)
  ambientT -= dt;
  if (ambientT <= 0) {
    const nt = skyAt(clock).night, outside = running && !underwater && player.pos[1] > 24;
    if (outside && nt < 0.3 && weather.amount < 0.4) { sfx.bird(0.03 + Math.random() * 0.03); ambientT = 3 + Math.random() * 7; }
    else if (outside && nt > 0.65 && weather.amount < 0.6) { sfx.cricket(0.012 + Math.random() * 0.01); ambientT = 0.6 + Math.random() * 1.6; }
    else ambientT = 2;
  }
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
window.blockwild = { fishTap, get fishing() { return fishing; }, selectSlot, get hotbar() { return hotbar; }, get known() { return knownList(); }, learn, unlearned: () => unlearned(knownList(), settings.patterns || []), get settings() { return settings; }, get world() { return world; }, get player() { return player; }, get target() { return target; }, get flock() { return flock; }, get nursery() { return flock; }, get snakes() { return snakes; }, get raiders() { return raiders; }, get weather() { return weather; }, get critters() { return critters; }, music, trader, openMap, get nights() { return nights; }, set nights(n) { nights = n; }, wardrobe, selfieCam, petBaby, openJobs, get inv() { return inv; }, addItem, RECIPES, craft, input, raycast,
  get clock() { return clock; }, setTime(t) { clock = t; }, swing: () => swing(), catchFirefly: () => catchFirefly(), fishBottle: () => fishBottle(), startSeek: () => startSeek(), get seek() { return seek; }, playBox: t => playBox(t), get mapChest() { return mapChest; }, get boxes() { return boxes; }, get stats() { return stats; }, get goalsDone() { return goalsDone; }, checkGoals: () => checkGoals(), place: () => placeBlock(),
  net, others, get myNetId() { return myNetId; },
  get seat() { return seat; }, awardCrown: l => awardCrown(l), fireworks, get streak() { return streak; }, set streak(v) { streak = v; }, sit: (x, y, z) => sit(x, y, z), standUp: () => standUp(),
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
