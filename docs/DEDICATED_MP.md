# Dedicated server — auth vị trí (hướng dẫn)

Game hiện tại: mỗi client **tự broadcast** vị trí qua Supabase Realtime → người xem bị delay/buffer, và **không ai chặn speedhack**.

Mục tiêu slice này: **server là nguồn đúng** cho vị trí trong bãi luyện công.

```
Client A ──input (vx,vy)──►  MP Server (tick 20Hz) ──snapshot──► Client B
Client B ──input (vx,vy)──►         ▲              ──snapshot──► Client A
                                    │
                              validate tốc độ / teleport
```

## 1. Chạy server local

```bash
cd server
npm install
MP_DEV_OPEN=1 npm start
```

- WS: `ws://127.0.0.1:3847`
- Health: [http://127.0.0.1:3847/health](http://127.0.0.1:3847/health)

`MP_DEV_OPEN=1` = cho phép join bằng `devCid` (không cần JWT) — **chỉ để test máy bạn**.

### Chạy kèm login Supabase (gần production)

```bash
export SUPABASE_URL=https://khwkokiflhzwxuzoilux.supabase.co
export SUPABASE_ANON_KEY='sb_publishable_...'   # anon/publishable key
# tắt dev open
npm start
```

Client gửi `access_token` từ session; server gọi `auth.getUser(token)`.

## 2. Bật client auth mode

Chạy game static như cũ:

```bash
# từ root repo
python3 -m http.server 47291 --bind 127.0.0.1
```

Mở **2 tab** (2 account hoặc 1 account + `MP_DEV_OPEN`):

- [http://127.0.0.1:47291/?mp_auth=1](http://127.0.0.1:47291/?mp_auth=1)

Hoặc cố định:

```js
localStorage.setItem('mp_auth', '1');
localStorage.setItem('mp_auth_url', 'ws://127.0.0.1:3847');
location.reload();
```

Vào **bãi luyện công** cùng map → toast `MP server: đã nối …`.

## 3. Protocol (ngắn)

| Hướng | `t` | Ý nghĩa |
|------|-----|--------|
| C→S | `join` | token + zone + meta (name/fac/jx) + x,y |
| C→S | `in` | seq, vx, vy, x?, y?, face, dir, act |
| C→S | `meta` | đổi đồ / cấp / tên |
| C→S | `ping` | đo RTT |
| S→C | `welcome` | xác nhận phòng |
| S→C | `snap` | tick + danh sách peers (vị trí chuẩn) |
| S→C | `err` | lỗi auth / phòng đầy |

Server mỗi tick:

1. Áp `vx,vy` (clamp `MAX_SPD`)
2. Bỏ predicted `x,y` nếu lệch quá xa (anti-teleport)
3. Broadcast `snap` ~20Hz

## 4. File liên quan

| Path | Vai trò |
|------|--------|
| `server/src/index.js` | HTTP + WebSocket |
| `server/src/room.js` | Phòng / tick / validate |
| `server/src/auth.js` | Supabase JWT / dev open |
| `js/mp_auth.js` | Client nối server, apply snap vào `MP.peers` |
| `js/mp.js` | Vẫn dùng để vẽ peer + (tùy chọn) field/hit qua Realtime |

Khi `mp_auth` bật và đã `ok`, client **không** broadcast `pos` Supabase nữa (tránh 2 nguồn).

## 5. Deploy server (production)

Pages chỉ host static — **phải có máy riêng** cho WS:

1. VPS / Railway / Fly / Render chạy `server/`
2. Mở port WS (hoặc reverse proxy `wss://mp.domain.com`)
3. Set env: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `MP_DEV_OPEN=0`, `MP_PORT=3847`
4. Client:

```js
localStorage.setItem('mp_auth', '1');
localStorage.setItem('mp_auth_url', 'wss://mp.domain-cua-ban.com');
```

Cloudflare: có thể gói lại thành **Durable Object** sau — logic `room.js` giữ nguyên ý tưởng.

## 6. Lộ trình tiếp

1. ✅ Pos authority (slice này)
2. Chuyển **spawn/hit quái** từ host-client → server
3. Rate-limit + ban CID
4. Replay / lag compensation nâng cao

## 7. Smoke test nhanh (không UI)

```bash
# terminal 1
cd server && MP_DEV_OPEN=1 npm start

# terminal 2
node -e "
const WebSocket=require('ws');
const a=new WebSocket('ws://127.0.0.1:3847');
const b=new WebSocket('ws://127.0.0.1:3847');
let snaps=0;
b.on('message',d=>{const m=JSON.parse(d); if(m.t==='snap'){snaps++;
  const p=m.peers.find(x=>x.cid==='dev-a');
  if(p) console.log('B sees A', p.x.toFixed(1), p.y.toFixed(1));
}});
a.on('open',()=>a.send(JSON.stringify({t:'join',devCid:'dev-a',zone:2,name:'A',fac:'shaolin',lvl:10,x:100,y:100})));
b.on('open',()=>b.send(JSON.stringify({t:'join',devCid:'dev-b',zone:2,name:'B',fac:'wudang',lvl:10,x:200,y:100})));
setTimeout(()=>{let i=0; const iv=setInterval(()=>{
  a.send(JSON.stringify({t:'in',seq:++i,vx:120,vy:0,x:100+i*2,y:100,act:'run'}));
  if(i>30){clearInterval(iv); console.log('snaps',snaps); a.close(); b.close(); process.exit(snaps>5?0:1);}
},50);},400);
"
```

Thấy `B sees A` tăng dần theo X → auth server đang chạy đúng.
