// The Baby Chicken Empire theme song. It plays on the front screen and the pause menu, and now and then
// (quietly, by day) while you play. It goes through the sound effects' audio context so the volume
// can be set on phones too (iPhones ignore an audio element's own volume).
const SRC = 'audio/theme.m4a';
const MENU_VOL = 0.55, GAME_VOL = 0.2;
const FIRST_WAIT = 25, GAP = [480, 720]; // seconds before the song plays in the game, and between plays

export class Music {
  constructor(sfx) {
    this.sfx = sfx;
    this.el = null; this.gain = null;
    this.enabled = true;
    this.mode = 'menu';   // 'menu' | 'game'
    this.day = true;      // the song only starts in the game by day
    this.inGame = false;  // the song is playing as part of the game (not the menu)
    this.nextAt = 0;      // when it may next play in the game (performance.now() seconds)
    this.vol = 0;
    setInterval(() => this.tick(0.25), 250);
    document.addEventListener('visibilitychange', () => { if (document.hidden && this.el) this.el.pause(); });
  }

  // From a tap: makes the audio element and lets it play (phones only allow that from a tap).
  unlock() {
    if (this.el || !this.sfx.ctx) return;
    const el = this.el = new Audio(SRC);
    el.preload = 'auto';
    el.addEventListener('ended', () => { this.inGame = false; this.later(); });
    el.addEventListener('error', () => { this.el = null; }); // no music offline before it's been cached: just go quiet
    try {
      const ctx = this.sfx.ctx, src = ctx.createMediaElementSource(el);
      this.gain = ctx.createGain(); this.gain.gain.value = 0;
      src.connect(this.gain).connect(ctx.destination);
    } catch { this.gain = null; el.volume = 0; }
    this.nextAt = now() + FIRST_WAIT;
    if (this.want()) el.play().catch(() => {});
    else el.play().then(() => { if (!this.want()) el.pause(); }).catch(() => {});
  }

  later() { this.nextAt = now() + GAP[0] + Math.random() * (GAP[1] - GAP[0]); }

  // Should the song be playing right now?
  want() {
    if (!this.enabled || document.hidden) return false;
    if (this.mode === 'menu') return true;
    if (this.inGame) return true;
    return this.day && now() >= this.nextAt;
  }

  tick(dt) {
    const el = this.el;
    if (!el) return;
    const want = this.want();
    if (want && this.mode === 'game' && !this.inGame && el.paused) { this.inGame = true; el.currentTime = 0; }
    const target = want ? (this.mode === 'menu' ? MENU_VOL : GAME_VOL) * (this.level ?? 1) : 0; // level: the Volume setting
    this.vol += Math.sign(target - this.vol) * Math.min(Math.abs(target - this.vol), dt * 0.5);
    if (this.gain) this.gain.gain.value = this.vol; else el.volume = Math.min(1, this.vol);
    if (want && el.paused) el.play().catch(() => {});
    if (!want && this.vol <= 0.001 && !el.paused) {
      el.pause();
      if (this.mode === 'game' && this.inGame && !this.enabled) this.inGame = false;
    }
  }

  // Going into the game (or back to the menu).
  setMode(mode) {
    if (mode === this.mode) return;
    // leaving the menu: let the song finish quietly in the game only if it's near the start
    if (mode === 'game') {
      this.inGame = !!this.el && !this.el.paused && this.el.currentTime < 30;
      if (!this.inGame && this.el?.currentTime > 0) this.later(); // you've just heard it on the menu
    }
    this.mode = mode;
  }
}

const now = () => performance.now() / 1000;
