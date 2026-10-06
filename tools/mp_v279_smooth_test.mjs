import WebSocket from 'ws';
import fs from 'fs';

const WSS = 'wss://arizona-checking-circle-engagement.trycloudflare.com';
const DELAY=0.12, EXTRAP=0.35, BLEND=14, HARD=1400;

async function run(label, burst) {
  const a=new WebSocket(WSS), b=new WebSocket(WSS);
  await Promise.all([
    new Promise((r,j)=>{a.on('open',r);a.on('error',j)}),
    new Promise((r,j)=>{b.on('open',r);b.on('error',j)})
  ]);
  const za = burst ? 91 : 92;
  a.send(JSON.stringify({t:'join',devCid:label+'-a',zone:za,name:'Runner',fac:'shaolin',lvl:20,x:200,y:300}));
  b.send(JSON.stringify({t:'join',devCid:label+'-b',zone:za,name:'Viewer',fac:'wudang',lvl:20,x:400,y:300}));
  await new Promise(r=>setTimeout(r,300));
  const peer={tx:null,ty:null,vx:0,vy:0,rx:null,ry:null,_recvAt:0};
  const q=[];
  b.on('message', buf=>{
    if (!burst) { q.push(buf); return; }
    const delay = Math.random()<0.3 ? 60+Math.random()*100 : Math.random()*35;
    setTimeout(()=>q.push(buf), delay);
  });
  const drain=setInterval(()=>{
    while(q.length){
      const m=JSON.parse(q.shift());
      if(m.t!=='snap') continue;
      const row=(m.peers||[]).find(x=>x.cid===label+'-a');
      if(!row) continue;
      const now=Date.now();
      peer.vx = (peer.vx||0)*0.35 + (+row.vx||0)*0.65;
      peer.vy = (peer.vy||0)*0.35 + (+row.vy||0)*0.65;
      peer.tx=+row.x; peer.ty=+row.y; peer._recvAt=now;
      if(peer.rx==null){peer.rx=peer.tx; peer.ry=peer.ty}
    }
  },5);
  let seq=0, t0=Date.now(), lx=200, ly=300;
  const walk=setInterval(()=>{
    const u=(Date.now()-t0)/1000;
    const vx=-Math.sin(u*2.1)*150, vy=Math.cos(u*2.1)*150;
    lx += vx*0.033; ly += vy*0.033;
    const jx = lx + (burst?(Math.random()-0.5)*1.5:0);
    const jy = ly + (burst?(Math.random()-0.5)*1.5:0);
    const nvx = vx + (burst?(Math.random()-0.5)*20:0);
    const nvy = vy + (burst?(Math.random()-0.5)*20:0);
    seq++;
    a.send(JSON.stringify({t:'in',seq,x:jx,y:jy,vx:nvx,vy:nvy,act:'run'}));
  },33);
  const jumps=[]; let prev=null, tele=0, freeze=0, lastMove=0, frames=0;
  const rend=setInterval(()=>{
    if(peer.tx==null) return;
    const now=Date.now();
    const age=(now-peer._recvAt)/1000 - DELAY;
    const t=Math.max(0, Math.min(EXTRAP, age));
    const spd=Math.hypot(peer.vx,peer.vy);
    const goal = spd<8 ? {x:peer.tx,y:peer.ty} : {x:peer.tx+peer.vx*t, y:peer.ty+peer.vy*t};
    const dist=Math.hypot(goal.x-peer.rx, goal.y-peer.ry);
    const dt=1/60;
    if(dist>HARD){peer.rx=goal.x;peer.ry=goal.y}
    else if(dist>0.04){
      const rate=dist>120?BLEND+8:dist>48?BLEND+3:BLEND;
      const k=1-Math.exp(-dt*rate);
      peer.rx+=(goal.x-peer.rx)*k; peer.ry+=(goal.y-peer.ry)*k;
    }
    frames++;
    if(prev){
      const j=Math.hypot(peer.rx-prev.x, peer.ry-prev.y);
      jumps.push(j);
      if(j>40) tele++;
      if(j>0.3) lastMove=now;
      else if(now-lastMove>180 && spd>40) freeze++;
    }
    prev={x:peer.rx,y:peer.ry};
  },16);
  await new Promise(r=>setTimeout(r,5000));
  clearInterval(walk); clearInterval(rend); clearInterval(drain);
  a.close(); b.close();
  jumps.sort((x,y)=>x-y);
  const pct=p=>+(jumps[Math.min(jumps.length-1,Math.floor(jumps.length*p))]||0).toFixed(2);
  return {
    label, burst, frames,
    jumpPx:{p50:pct(.5),p90:pct(.9),p99:pct(.99),max:pct(1)},
    teleportsOver40px:tele, freezeHits:freeze,
    ok: tele===0 && freeze<10 && pct(.99)<12
  };
}

const tunnel = await run('tun', true);
await new Promise(r=>setTimeout(r,200));
const clean = await run('cln', false);
const out = { at:new Date().toISOString(), wss:WSS, tunnel, clean, ok: tunnel.ok && clean.ok };
console.log(JSON.stringify(out,null,2));
fs.writeFileSync('/opt/cursor/artifacts/mp-smooth-v279.json', JSON.stringify(out,null,2));
process.exit(out.ok?0:1);
