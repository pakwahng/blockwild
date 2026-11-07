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
