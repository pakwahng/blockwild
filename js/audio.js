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

  toss() { if (this.ready) this.noise(this.ctx.currentTime + 0.01, 0.12, 0.25, 3000); }
  place() { if (this.ready) { const t = this.ctx.currentTime + 0.01; this.tone('sine', 220, 120, t, 0.09, 0.35); this.noise(t, 0.05, 0.12, 900); } }
  dig() { if (this.ready) this.noise(this.ctx.currentTime + 0.01, 0.16, 0.35, 600); }

  fanfare() {
    if (!this.ready) return;
    const t = this.ctx.currentTime + 0.02;
    [523, 659, 784, 1046].forEach((f, k) => this.tone('triangle', f, f * 1.01, t + k * 0.11, 0.22, 0.25));
  }
}
