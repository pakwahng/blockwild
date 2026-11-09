// Tiny synthesized sound effects (no audio files): cheeps, pops, seed tosses and block thuds.
export class Sfx {
  constructor() { this.ctx = null; this.enabled = true; this.master = null; }

  // Must be called from a user gesture (tap/click) for mobile browsers.
  unlock() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.5;
      this.master.connect(this.ctx.destination);
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
  }

  get ready() { return this.enabled && this.ctx && this.ctx.state === 'running'; }

  tone(type, f0, f1, start, dur, vol) {
    const c = this.ctx, o = c.createOscillator(), g = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f0, start);
    o.frequency.exponentialRampToValueAtTime(f1, start + dur);
    g.gain.setValueAtTime(0.0001, start);
    g.gain.exponentialRampToValueAtTime(vol, start + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
    o.connect(g).connect(this.master);
    o.start(start); o.stop(start + dur + 0.02);
  }

  noise(start, dur, vol, freq) {
    const c = this.ctx, len = Math.ceil(c.sampleRate * dur);
    const buf = c.createBuffer(1, len, c.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
    src.buffer = buf; f.type = 'bandpass'; f.frequency.value = freq; f.Q.value = 1.2;
    g.gain.value = vol;
    src.connect(f).connect(g).connect(this.master);
    src.start(start);
  }

  // A soft, steady patter of rain. level 0 is silent; it fades smoothly towards the level you set.
  rain(level) {
    if (!this.ctx) return;
    if (!this.rainGain) {
      if (level <= 0.01) return;
      const c = this.ctx, len = c.sampleRate * 2;
      const buf = c.createBuffer(1, len, c.sampleRate), d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (Math.random() < 0.02 ? 1 : 0.35); // hiss with little taps
      const src = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
      src.buffer = buf; src.loop = true;
      f.type = 'lowpass'; f.frequency.value = 2400;
      g.gain.value = 0;
      src.connect(f).connect(g).connect(this.master);
      src.start();
      this.rainGain = g;
    }
    const want = this.enabled ? Math.max(0, Math.min(1, level)) * 0.16 : 0;
    this.rainGain.gain.setTargetAtTime(want, this.ctx.currentTime, 0.6);
  }

  cheep(vol = 0.3, pitch = 1) {
    if (!this.ready || vol < 0.02) return;
    const t = this.ctx.currentTime + 0.01, p = pitch * (0.9 + Math.random() * 0.25);
    const n = 1 + (Math.random() * 2 | 0);
    for (let k = 0; k < n; k++) this.tone('sine', 2500 * p, 3600 * p, t + k * 0.11, 0.07, vol * 0.5);
  }

  // A filtered voice for the bigger babies: a waveform through a low-pass, with optional wobble.
  voice(type, f0, f1, start, dur, vol, cutoff, vib = 0, vibRate = 0) {
    const c = this.ctx, o = c.createOscillator(), f = c.createBiquadFilter(), g = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f0, start);
    o.frequency.exponentialRampToValueAtTime(f1, start + dur);
    if (vib) {
      const l = c.createOscillator(), lg = c.createGain();
      l.frequency.value = vibRate; lg.gain.value = vib;
      l.connect(lg).connect(o.frequency);
      l.start(start); l.stop(start + dur + 0.02);
    }
    f.type = 'lowpass'; f.frequency.value = cutoff; f.Q.value = 2;
    g.gain.setValueAtTime(0.0001, start);
    g.gain.exponentialRampToValueAtTime(vol, start + Math.min(0.06, dur * 0.25));
    g.gain.setValueAtTime(vol, start + dur * 0.6);
    g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
    o.connect(f).connect(g).connect(this.master);
    o.start(start); o.stop(start + dur + 0.02);
  }

  // Each baby's call: cheep, moo, oink, baa or yip.
  call(sp, vol = 0.3) {
    if (!this.ready || vol < 0.02) return;
    const t = this.ctx.currentTime + 0.01, p = 0.92 + Math.random() * 0.16;
    if (sp === 'chick') return this.cheep(vol);
    if (sp === 'calf') this.voice('sawtooth', 260 * p, 200 * p, t, 0.55, vol * 0.7, 900);
    else if (sp === 'piglet') {
      for (let k = 0; k < 2; k++) this.voice('square', 190 * p, 150 * p, t + k * 0.13, 0.09, vol * 0.55, 700);
    } else if (sp === 'lamb') this.voice('sawtooth', 520 * p, 470 * p, t, 0.45, vol * 0.5, 1800, 28, 11);
    else if (sp === 'pup') {
      const n = 1 + (Math.random() * 2 | 0);
      for (let k = 0; k < n; k++) this.voice('triangle', 900 * p, 1350 * p, t + k * 0.16, 0.1, vol * 0.8, 4000);
    }
  }

  // The fox's sly little yelp and the crow's caw.
  yelp(vol = 0.3) {
    if (!this.ready || vol < 0.02) return;
    const t = this.ctx.currentTime + 0.01;
    this.voice('sawtooth', 700, 1500, t, 0.12, vol * 0.6, 3000);
    this.voice('sawtooth', 1400, 600, t + 0.13, 0.22, vol * 0.5, 2600);
  }
  caw(vol = 0.3) {
    if (!this.ready || vol < 0.02) return;
    const t = this.ctx.currentTime + 0.01;
    for (let k = 0; k < 2; k++) this.voice('sawtooth', 520, 380, t + k * 0.26, 0.2, vol * 0.7, 1400, 40, 30);
  }

  splash() {
    if (!this.ready) return;
    const t = this.ctx.currentTime + 0.01;
    this.noise(t, 0.18, 0.3, 350);
    this.noise(t + 0.08, 0.12, 0.2, 500);
  }

  munch() {
    if (!this.ready) return;
    const t = this.ctx.currentTime + 0.01;
    for (let k = 0; k < 3; k++) this.noise(t + k * 0.14, 0.06, 0.18, 1500);
  }

  hiss(vol = 0.3) {
    if (!this.ready || vol < 0.02) return;
    const c = this.ctx, t = c.currentTime + 0.01, dur = 0.7, len = Math.ceil(c.sampleRate * dur);
    const buf = c.createBuffer(1, len, c.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) { const k = i / len; d[i] = (Math.random() * 2 - 1) * Math.min(1, k * 8) * (1 - k); }
    const src = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
    src.buffer = buf; f.type = 'highpass'; f.frequency.value = 3500; g.gain.value = vol;
    src.connect(f).connect(g).connect(this.master);
    src.start(t);
  }

  bonk() {
    if (!this.ready) return;
    const t = this.ctx.currentTime + 0.01;
    this.tone('sine', 320, 110, t, 0.18, 0.5);
    this.noise(t, 0.06, 0.3, 700);
    this.tone('triangle', 500, 900, t + 0.05, 0.16, 0.18);   // a cartoony boing
  }

  poof() {
    if (!this.ready) return;
    const t = this.ctx.currentTime + 0.01;
    this.noise(t, 0.3, 0.4, 1200);
    [784, 988, 1175, 1568].forEach((f, k) => this.tone('sine', f, f * 1.02, t + 0.06 + k * 0.06, 0.14, 0.18));
  }

  // A little royal trumpet tune for the chicken king.
  royal() {
    if (!this.ready) return;
    const t = this.ctx.currentTime + 0.02;
    const notes = [[392, 0, 0.14], [523, 0.15, 0.14], [659, 0.3, 0.14], [784, 0.45, 0.32], [659, 0.8, 0.14], [784, 0.95, 0.55]];
    for (const [f, at, dur] of notes) {
      this.voice('sawtooth', f, f * 1.003, t + at, dur, 0.22, 2400, 6, 6);
      this.voice('triangle', f / 2, f / 2, t + at, dur, 0.12, 1500);
    }
  }

  whoosh() { if (this.ready) this.noise(this.ctx.currentTime + 0.01, 0.14, 0.2, 2200); }
  // the dinner bell: a bright ding-ding with a long ring
  ding() {
    if (!this.ready) return;
    const t = this.ctx.currentTime + 0.01;
    for (const [at, f] of [[0, 1320], [0.32, 1320], [0.64, 1180]]) {
      this.tone('sine', f, f * 0.995, t + at, 1.1, 0.22); this.tone('sine', f * 2.76, f * 2.7, t + at, 0.5, 0.05); this.tone('triangle', f / 2, f / 2, t + at, 0.7, 0.06);
    }
  }
  // a springy boing off a bouncy pad (k: how hard you bounced)
  boing(k = 1) {
    if (!this.ready) return;
    const t = this.ctx.currentTime + 0.01, f = 180 + 60 * k;
    this.voice('sine', f, f * 2.6, t, 0.32, 0.3, 1800, 18, 22);
  }
  // a tinkly sparkle: catching a firefly, a shooting star, a wish
  twinkle(vol = 0.18) {
    if (!this.ready) return;
    const t = this.ctx.currentTime + 0.01;
    [1568, 2093, 2637, 3136].forEach((f, i) => this.tone('sine', f, f, t + i * 0.07, 0.35, vol * (1 - i * 0.15)));
  }
  // a rocket going up
  rocket(vol = 0.12) { if (this.ready) { const t = this.ctx.currentTime + 0.01; this.tone('sawtooth', 300, 1400, t, 0.9, vol * 0.25); this.noise(t, 0.9, vol, 1800); } }
  // a firework bursting, quieter further away
  bang(vol = 0.4) {
    if (!this.ready || vol < 0.01) return;
    const t = this.ctx.currentTime + 0.01;
    this.noise(t, 0.5, vol, 260); this.tone('sine', 120, 40, t, 0.4, vol * 0.6);
    for (let k = 0; k < 6; k++) this.noise(t + 0.25 + Math.random() * 0.6, 0.04, vol * 0.25, 3000 + Math.random() * 2000); // crackles
  }
  crackle(vol = 0.06) { if (this.ready) { const t = this.ctx.currentTime + 0.01; this.noise(t, 0.03, vol, 2600 + Math.random() * 1800); if (Math.random() < 0.4) this.noise(t + 0.05, 0.02, vol * 0.7, 3200); } }

  nightfall() {
    if (!this.ready) return;
    const t = this.ctx.currentTime + 0.02;
    [392, 311, 262, 196].forEach((f, k) => this.tone('triangle', f, f, t + k * 0.22, 0.5, 0.16));
  }

  hatch() {
    if (!this.ready) return;
    const t = this.ctx.currentTime + 0.01;
    this.tone('triangle', 500, 1100, t, 0.12, 0.35);
    this.tone('sine', 1400, 2200, t + 0.1, 0.12, 0.25);
    this.cheep(0.5, 1.25);
  }

  happy() {
    if (!this.ready) return;
    const t = this.ctx.currentTime + 0.01;
    this.tone('sine', 880, 1320, t, 0.1, 0.2);
    this.tone('sine', 1320, 1760, t + 0.08, 0.12, 0.18);
  }

  // picking up a gift: a bright little "plink plink"
  pickup() {
    if (!this.ready) return;
    const t = this.ctx.currentTime + 0.01;
    this.tone('triangle', 1046, 1046, t, 0.07, 0.22);
    this.tone('triangle', 1568, 1568, t + 0.07, 0.1, 0.2);
  }
  // a baby all grown up: a rising three-note chime
  grown() {
    if (!this.ready) return;
    const t = this.ctx.currentTime + 0.01;
    [523, 659, 784, 1046].forEach((f, k) => this.tone('sine', f, f, t + k * 0.1, 0.16, 0.22));
  }

  // a boom snake's fuse: crackly fizzing that speeds up
  fuse() {
    if (!this.ready) return;
    const t = this.ctx.currentTime + 0.01;
    for (let k = 0; k < 14; k++) this.noise(t + k * 0.13 * (1 - k / 22), 0.05, 0.16, 4200 + Math.random() * 1500);
    this.tone('square', 900, 1800, t + 1.4, 0.3, 0.06);
  }
  // the big BOOM: a deep thump, a rumble and a scatter of pops (vol 0…1 for how far away)
  boom(vol = 1) {
    if (!this.ready || vol < 0.03) return;
    const t = this.ctx.currentTime + 0.01;
    this.tone('sine', 140, 38, t, 0.7, 0.7 * vol);
    this.noise(t, 0.9, 0.7 * vol, 220);
    this.noise(t + 0.05, 0.5, 0.4 * vol, 900);
    for (let k = 0; k < 6; k++) this.tone('triangle', 600 + k * 180, 900 + k * 200, t + 0.25 + k * 0.07, 0.08, 0.1 * vol);
  }

  toss() { if (this.ready) this.noise(this.ctx.currentTime + 0.01, 0.12, 0.25, 3000); }
  place() { if (this.ready) { const t = this.ctx.currentTime + 0.01; this.tone('sine', 220, 120, t, 0.09, 0.35); this.noise(t, 0.05, 0.12, 900); } }
  dig() { if (this.ready) this.noise(this.ctx.currentTime + 0.01, 0.16, 0.35, 600); }
  // a little bird song: a few quick high chirps
  bird(vol = 0.05) {
    if (!this.ready) return;
    const t = this.ctx.currentTime + 0.02, n = 2 + (Math.random() * 4 | 0), f = 2300 + Math.random() * 1400, up = Math.random() < 0.5;
    for (let i = 0; i < n; i++) {
      const g = f * (1 + (Math.random() - 0.5) * 0.15);
      this.tone('sine', up ? g : g * 1.35, up ? g * 1.35 : g, t + i * (0.09 + Math.random() * 0.05), 0.06, vol);
    }
  }
  // crickets at night: a soft trill
  cricket(vol = 0.02) {
    if (!this.ready) return;
    const t = this.ctx.currentTime + 0.02, f = 4000 + Math.random() * 600;
    for (let i = 0; i < 4; i++) this.tone('triangle', f, f * 1.02, t + i * 0.045, 0.028, vol);
  }
  // a working grown-up: tok-tok on a tree, a clack on rock, a scratchy rustle in the grass
  knock(job, vol = 0.3) {
    if (!this.ready) return;
    const t = this.ctx.currentTime + 0.01;
    if (job === 'seeds') { this.noise(t, 0.09, vol * 0.6, 2400); return; }
    const f = job === 'stone' ? 520 : 240;
    this.tone('triangle', f, f * 0.6, t, 0.07, vol);
    this.noise(t, 0.05, vol * 0.5, job === 'stone' ? 1800 : 700);
  }

  fanfare() {
    if (!this.ready) return;
    const t = this.ctx.currentTime + 0.02;
    [523, 659, 784, 1046].forEach((f, k) => this.tone('triangle', f, f * 1.01, t + k * 0.11, 0.22, 0.25));
  }
}
