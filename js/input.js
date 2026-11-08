// Touch (virtual stick + drag-to-look + tap/hold) and keyboard/mouse input.

const TAP_MS = 260, HOLD_MS = 300, TAP_SLOP = 14, STICK_R = 56;

export class Input {
  constructor(surface, ui) {
    this.surface = surface;
    this.ui = ui; // { stick, knob, jump, down, fly, onFly, onPlace, onHotbarScroll, onHotbarKey, onPicker, onPause }
    this.state = { moveX: 0, moveZ: 0, jump: false, down: false, sprint: false, breaking: false };
    this.look = { dx: 0, dy: 0 };
    this.touchSens = 1; this.mouseSens = 1;
    this.keys = new Set();
    this.stickId = null; this.lookId = null;
    this.usingTouch = false;
    this.enabled = false;
    this.bindTouch();
    this.bindDesktop();
  }

  consumeLook() { const l = { ...this.look }; this.look.dx = this.look.dy = 0; return l; }

  setTouchMode(on) {
    if (this.usingTouch === on) return;
    this.usingTouch = on;
    document.body.classList.toggle('touch', on);
  }

  bindTouch() {
    const s = this.surface, ui = this.ui;
    s.addEventListener('pointerdown', e => {
      if (!this.enabled) return;
      if (e.pointerType !== 'touch') return;
      e.preventDefault();
      this.setTouchMode(true);
      const leftZone = e.clientX < window.innerWidth * 0.42;
      if (leftZone && this.stickId === null) {
        this.stickId = e.pointerId;
        this.stick = { x: e.clientX, y: e.clientY };
        ui.stick.style.left = e.clientX + 'px'; ui.stick.style.top = e.clientY + 'px';
        ui.stick.classList.add('active');
        ui.knob.style.transform = 'translate(-50%,-50%)';
      } else if (!leftZone && this.lookId === null) {
        this.lookId = e.pointerId;
        this.lookT = { x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY, t: performance.now(), moved: 0 };
        clearTimeout(this.holdTimer);
        this.holdTimer = setTimeout(() => {
          if (this.lookId !== null && this.lookT.moved < TAP_SLOP) this.state.breaking = true;
        }, HOLD_MS);
      }
      try { s.setPointerCapture(e.pointerId); } catch { /* ignore */ }
    }, { passive: false });

    s.addEventListener('pointermove', e => {
      if (e.pointerType !== 'touch') return;
      if (e.pointerId === this.stickId) {
        let dx = e.clientX - this.stick.x, dy = e.clientY - this.stick.y;
        const d = Math.hypot(dx, dy);
        if (d > STICK_R) { dx *= STICK_R / d; dy *= STICK_R / d; }
        ui.knob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
        this.state.moveX = dx / STICK_R;
        this.state.moveZ = -dy / STICK_R;
        this.state.sprint = d > STICK_R * 1.35 && -dy > Math.abs(dx);
      } else if (e.pointerId === this.lookId) {
        const L = this.lookT;
        this.look.dx += (e.clientX - L.x) * 0.0048 * this.touchSens;
        this.look.dy += (e.clientY - L.y) * 0.0048 * this.touchSens;
        L.x = e.clientX; L.y = e.clientY;
        L.moved = Math.max(L.moved, Math.hypot(e.clientX - L.sx, e.clientY - L.sy));
      }
    });

    const end = e => {
      if (e.pointerType !== 'touch') return;
      if (e.pointerId === this.stickId) {
        this.stickId = null;
        this.state.moveX = this.state.moveZ = 0; this.state.sprint = false;
        ui.stick.classList.remove('active');
      } else if (e.pointerId === this.lookId) {
        const L = this.lookT;
        if (e.type === 'pointerup' && !this.state.breaking && performance.now() - L.t < TAP_MS && L.moved < TAP_SLOP) ui.onPlace();
        this.lookId = null;
        this.state.breaking = false;
        clearTimeout(this.holdTimer);
      }
    };
    s.addEventListener('pointerup', end);
    s.addEventListener('pointercancel', end);

    const hold = (el, key) => {
      el.addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); this.setTouchMode(true); this.state[key] = true; el.classList.add('pressed'); });
      const up = () => { this.state[key] = false; el.classList.remove('pressed'); };
      el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up); el.addEventListener('pointerleave', up);
    };
    hold(ui.jump, 'jump');
    hold(ui.down, 'down');

    // stop iOS pinch-zoom / double-tap zoom gestures
    for (const ev of ['gesturestart', 'gesturechange', 'dblclick']) document.addEventListener(ev, e => e.preventDefault(), { passive: false });
    document.addEventListener('touchmove', e => { if (e.target.closest('#bag-body, .menu-scroll, .ward-body')) return; e.preventDefault(); }, { passive: false });
  }

  bindDesktop() {
    const s = this.surface, ui = this.ui;
    s.addEventListener('pointerdown', e => { if (e.pointerType === 'mouse') this.setTouchMode(false); });
    s.addEventListener('mousedown', e => {
      if (!this.enabled || this.usingTouch) return;
      if (document.pointerLockElement !== s) { s.requestPointerLock?.(); return; }
      if (e.button === 0) this.state.breaking = true;
      if (e.button === 2) ui.onPlace();
    });
    window.addEventListener('mouseup', e => { if (e.button === 0) this.state.breaking = false; });
    s.addEventListener('contextmenu', e => e.preventDefault());
    document.addEventListener('mousemove', e => {
      if (document.pointerLockElement !== s) return;
      this.look.dx += e.movementX * 0.0026 * this.mouseSens;
      this.look.dy += e.movementY * 0.0026 * this.mouseSens;
    });
    document.addEventListener('pointerlockchange', () => {
      if (document.pointerLockElement === s) this.setTouchMode(false);
      else if (this.enabled && !this.usingTouch) { this.state.breaking = false; ui.onPause(); }
    });
    s.addEventListener('wheel', e => { if (this.enabled) ui.onHotbarScroll(Math.sign(e.deltaY)); }, { passive: true });

    window.addEventListener('keydown', e => {
      if (!this.enabled || e.target.tagName === 'INPUT') return;
      this.keys.add(e.code);
      this.setTouchMode(false);
      if (e.code === 'KeyF' && !e.repeat) ui.onFly();
      if (e.code === 'KeyE' && !e.repeat) ui.onPicker();
      if (/^Digit[1-9]$/.test(e.code)) ui.onHotbarKey(+e.code.slice(5) - 1);
      if (e.code === 'Space') e.preventDefault();
      this.updateKeys();
    });
    window.addEventListener('keyup', e => { this.keys.delete(e.code); this.updateKeys(); });
    window.addEventListener('blur', () => { this.keys.clear(); this.updateKeys(); this.state.breaking = false; });
  }

  updateKeys() {
    if (this.usingTouch) return;
    const k = this.keys, st = this.state;
    st.moveZ = (k.has('KeyW') || k.has('ArrowUp') ? 1 : 0) - (k.has('KeyS') || k.has('ArrowDown') ? 1 : 0);
    st.moveX = (k.has('KeyD') || k.has('ArrowRight') ? 1 : 0) - (k.has('KeyA') || k.has('ArrowLeft') ? 1 : 0);
    st.jump = k.has('Space');
    st.down = k.has('ShiftLeft') || k.has('ShiftRight');
    st.sprint = k.has('ControlLeft') || k.has('ControlRight');
  }
}
