// Play together: one player hosts their world and friends join it with a four-letter room code.
// Uses PeerJS (WebRTC), loaded only when someone hosts or joins. The free PeerJS server just
// introduces the devices to each other; after that the game data goes directly between them.
const PEER_SRC = 'https://cdn.jsdelivr.net/npm/peerjs@1.5.4/dist/peerjs.min.js';
const PREFIX = 'babychickenempire-';
const LETTERS = 'BCDFGHJKLMNPQRSTVWXZ';
export const MAX_GUESTS = 3;

let loading = null;
function loadPeer() {
  if (window.Peer) return Promise.resolve();
  if (!loading) loading = new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = PEER_SRC;
    s.onload = () => resolve();
    s.onerror = () => { loading = null; reject(new Error('Couldn’t reach the internet to start playing together.')); };
    document.head.appendChild(s);
  });
  return loading;
}

const randomCode = () => Array.from({ length: 4 }, () => LETTERS[Math.random() * LETTERS.length | 0]).join('');
export const cleanCode = s => (s || '').toUpperCase().replace(/[^A-Z]/g, '').slice(0, 4);

export class Net {
  constructor() { this.reset(); this.handlers = {}; }
  reset() { this.role = null; this.peer = null; this.conns = new Map(); this.code = ''; this.nextId = 0; }
  get active() { return !!this.role; }
  get isHost() { return this.role === 'host'; }
  get isGuest() { return this.role === 'guest'; }
  get guests() { return this.isHost ? this.conns.size : 0; }
  on(type, fn) { this.handlers[type] = fn; }
  emit(type, ...args) { this.handlers[type]?.(...args); }

  async host() {
    await loadPeer();
    for (let tries = 0; tries < 5; tries++) {
      const code = randomCode();
      const peer = new window.Peer(PREFIX + code);
      const ok = await new Promise(resolve => {
        peer.on('open', () => resolve(true));
        peer.on('error', err => resolve(err.type === 'unavailable-id' ? false : err));
      });
      if (ok === false) { peer.destroy(); continue; }
      if (ok !== true) { peer.destroy(); throw new Error(friendly(ok)); }
      this.peer = peer; this.code = code; this.role = 'host';
      peer.on('connection', conn => this.accept(conn));
      peer.on('disconnected', () => { if (!peer.destroyed) peer.reconnect(); }); // lost the introducer, guests stay connected
      return code;
    }
    throw new Error('Couldn’t make a room code. Try again.');
  }

  accept(conn) {
    if (this.conns.size >= MAX_GUESTS) {
      conn.on('open', () => { conn.send({ t: 'full' }); setTimeout(() => conn.close(), 800); });
      return;
    }
    const id = ++this.nextId;
    const gone = () => { if (this.conns.delete(id)) this.emit('leave', id); };
    conn.on('open', () => { this.conns.set(id, conn); });
    conn.on('data', msg => this.emit('message', id, msg));
    conn.on('close', gone);
    conn.on('error', gone);
  }

  async join(rawCode) {
    const code = cleanCode(rawCode);
    if (code.length !== 4) throw new Error('Room codes have four letters.');
    await loadPeer();
    const peer = new window.Peer();
    this.peer = peer;
    try {
      await new Promise((resolve, reject) => { peer.on('open', resolve); peer.on('error', reject); });
      // JSON rather than PeerJS's binary packing, which doesn't get on between Safari and other browsers
      const conn = peer.connect(PREFIX + code, { reliable: true, serialization: 'json' });
      await new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject({ type: 'timeout' }), 15000);
        conn.on('open', () => { clearTimeout(timer); resolve(); });
        conn.on('error', reject);
        peer.on('error', reject);
      });
      this.role = 'guest'; this.code = code;
      this.conns.set(0, conn);
      conn.on('data', msg => this.emit('message', 0, msg));
      const lost = () => { if (this.role === 'guest') { this.close(); this.emit('lost'); } };
      conn.on('close', lost);
      conn.on('error', lost);
      peer.on('disconnected', () => { if (!peer.destroyed) peer.reconnect(); });
    } catch (err) {
      peer.destroy(); this.reset();
      throw new Error(friendly(err));
    }
  }

  send(id, msg) { const c = this.conns.get(id); if (c?.open) c.send(msg); }
  toHost(msg) { this.send(0, msg); }
  broadcast(msg, except) { for (const [id, c] of this.conns) if (id !== except && c.open) c.send(msg); }

  close() {
    const peer = this.peer;
    this.reset();
    try { peer?.destroy(); } catch { /* already gone */ }
  }
}

function friendly(err) {
  const type = err?.type || '';
  if (type === 'peer-unavailable') return 'No game with that code. Check the letters, and that your friend is still hosting.';
  if (type === 'timeout') return 'Couldn’t connect to that game. Try again, or try on the same Wi-Fi.';
  if (type === 'network' || type === 'server-error' || type === 'socket-error' || type === 'socket-closed') return 'Couldn’t reach the internet to start playing together.';
  if (type === 'browser-incompatible') return 'This browser can’t play together.';
  return err?.message || 'Something went wrong connecting.';
}
