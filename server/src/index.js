/**
 * Nam Quốc Idle — dedicated map server (authoritative position).
 * Chạy: npm start   (port 3847)
 */
import http from 'http';
import { WebSocketServer } from 'ws';
import { Room } from './room.js';
import { authPlayer } from './auth.js';

const PORT = Number(process.env.MP_PORT || 3847);
const rooms = new Map(); // zoneId -> Room

function roomOf(zoneId) {
  const z = String(zoneId || '0');
  let r = rooms.get(z);
  if (!r) { r = new Room(z); rooms.set(z, r); }
  return r;
}

function gcRooms() {
  for (const [z, r] of rooms) {
    if (r.empty()) { r.stop(); rooms.delete(z); }
  }
}
setInterval(gcRooms, 15000);

const server = http.createServer((req, res) => {
  if (req.url === '/health') {
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({
      ok: true,
      rooms: [...rooms.keys()],
      peers: [...rooms.values()].reduce((n, r) => n + r.players.size, 0),
      devOpen: process.env.MP_DEV_OPEN === '1'
    }));
    return;
  }
  res.writeHead(200, { 'content-type': 'text/plain; charset=utf-8' });
  res.end('Nam Quốc MP server — WS trên cùng port. Xem docs/DEDICATED_MP.md\n');
});

const wss = new WebSocketServer({ server });

wss.on('connection', (ws) => {
  let cid = null;
  let zone = null;

  ws.on('message', async (buf) => {
    let msg;
    try { msg = JSON.parse(String(buf)); } catch { return; }
    if (!msg || typeof msg !== 'object') return;

    try {
      if (msg.t === 'join') {
        const user = await authPlayer(msg);
        cid = user.cid;
        zone = String(msg.zone ?? msg.zoneId ?? '2');
        const r = roomOf(zone);
        r.join(ws, {
          cid,
          name: msg.name, fac: msg.fac, sex: msg.sex, lvl: msg.lvl,
          jx: msg.jx, title: msg.title, titleId: msg.titleId, titleCol: msg.titleCol,
          x: msg.x, y: msg.y
        });
        return;
      }

      if (!cid || zone == null) {
        ws.send(JSON.stringify({ t: 'err', msg: 'Chưa join' }));
        return;
      }
      const r = rooms.get(zone);
      if (!r) return;

      if (msg.t === 'in' || msg.t === 'pos') r.onInput(cid, msg);
      else if (msg.t === 'meta') r.onMeta(cid, msg);
      else if (msg.t === 'ping') ws.send(JSON.stringify({ t: 'pong', t0: msg.t0, serverT: Date.now() }));
    } catch (e) {
      try { ws.send(JSON.stringify({ t: 'err', msg: e.message || 'Lỗi' })); } catch (_) {}
    }
  });

  ws.on('close', () => {
    if (cid != null && zone != null) {
      const r = rooms.get(zone);
      if (r) r.leave(cid);
    }
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`[mp-server] ws://0.0.0.0:${PORT}  health http://127.0.0.1:${PORT}/health`);
  console.log(`[mp-server] MP_DEV_OPEN=${process.env.MP_DEV_OPEN === '1' ? '1 (dev cid ok)' : '0 (cần Supabase token)'}`);
});
