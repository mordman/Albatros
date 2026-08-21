import * as THREE from 'three';
import { scene } from './engine.js';
import { rnd, clamp, smooth01 } from './config.js';
import { M } from './materials.js';
import { colBox } from './helpers.js';
import { makeBuilding, makeHouse, makeWaterTower, makeChurch, makeTree, makeLamp } from './citykit.js';
import { makePalm } from './nature.js';
import { world } from './world.js';
import { state, distToPlayer, placeAhead } from './state.js';
import { resetSeaAnchor } from './seafloor.js';
import { registerBuildings, bboxFor } from './buildings.js';
import { spawnArchPedestrians } from './pedestrians.js';

export function makeArch(name){
  const g = new THREE.Group();
  const subs = [
    {dx:0,   dz:0,    r:300, ph:22},
    {dx:760, dz:-430, r:250, ph:18},
    {dx:880, dz:430,  r:220, ph:16},
  ];
  const bridges = [];
  const blds = [];
  for(let si=0; si<subs.length; si++){
    const s = subs[si];
    const N = 10, pts = [];
    for(let k=0;k<=N;k++){
      const r = (s.r+14)*k/N;
      let h;
      if(r < s.r*0.55) h = s.ph;
      else if(r < s.r) h = s.ph + (2.5-s.ph)*smooth01((r/s.r-0.55)/0.45);
      else h = 2.5 - 11.5*((r-s.r)/14);
      pts.push(new THREE.Vector2(Math.max(r,0.01), h));
    }
    const geo = new THREE.LatheGeometry(pts, 44);
    { const p = geo.attributes.position;
      for(let v=0;v<p.count;v++){
        const x=p.getX(v), z=p.getZ(v), rr=Math.hypot(x,z);
        if(rr>s.r*0.55 && rr<s.r+1){
          const a = Math.atan2(z,x);
          p.setY(v, p.getY(v) + Math.sin(a*7+s.dx)*0.7 + Math.sin(a*3+s.dz)*0.9);
        }
      }
      geo.computeVertexNormals(); }
    const isl = new THREE.Mesh(geo, M.rock);
    isl.position.set(s.dx, 0, s.dz); g.add(isl);
    const beach = new THREE.Mesh(new THREE.CylinderGeometry(s.r+7, s.r+16, 3, 36), M.sand);
    beach.position.set(s.dx, 1.2, s.dz); g.add(beach);
    const Rp = s.r*0.52;
    const disc = new THREE.Mesh(new THREE.CylinderGeometry(Rp+6, Rp+10, 0.8, 32), M.townGround);
    disc.position.set(s.dx, s.ph+0.2, s.dz); g.add(disc);
    const c1 = new THREE.Mesh(new THREE.BoxGeometry(8, 0.2, Rp*2), M.asphalt);
    c1.position.set(s.dx, s.ph+0.68, s.dz); g.add(c1);
    const c2 = c1.clone(); c2.rotation.y = Math.PI/2; g.add(c2);
    const ring = new THREE.Mesh(new THREE.RingGeometry(Rp*0.55, Rp*0.62, 32), M.asphalt);
    ring.rotation.x = -Math.PI/2; ring.position.set(s.dx, s.ph+0.7, s.dz); g.add(ring);
    for(let k=0;k<8;k++){
      const a = rnd(0,6.28);
      const pm = makePalm();
      pm.position.set(s.dx+Math.cos(a)*s.r*rnd(0.8,0.95), 3, s.dz+Math.sin(a)*s.r*rnd(0.8,0.95));
      g.add(pm);
    }
    for(let k=0;k<6;k++){
      const a = rnd(0,6.28);
      const tr = makeTree();
      tr.position.set(s.dx+Math.cos(a)*Rp*rnd(0.8,0.95), s.ph+0.6, s.dz+Math.sin(a)*Rp*rnd(0.8,0.95));
      g.add(tr);
    }
    const step = 30;
    for(let gx=-Rp+14; gx<=Rp-14; gx+=step)
      for(let gz=-Rp+14; gz<=Rp-14; gz+=step){
        const rr = Math.hypot(gx,gz);
        if(rr > Rp-12) continue;
        if(Math.abs(gx) < 9 || Math.abs(gz) < 9) continue;
        if(rr < Rp*0.62 && rr > Rp*0.5) continue;
        if(Math.random() > (si===0 ? 0.85 : 0.6)) continue;
        const central = 1 - rr/Rp;
        const px = s.dx+gx+rnd(-4,4), pz = s.dz+gz+rnd(-4,4);
        const rotY = (Math.abs(gx)>Math.abs(gz)?0:Math.PI/2)+rnd(-0.06,0.06);
        if(central > 0.45 && Math.random() < 0.8){
          const bw = rnd(12,17), bd = rnd(12,17);
          const bh = 14 + central*central*rnd(30, si===0 ? 110 : 70) + rnd(0,10);
          const b = makeBuilding(bw, bh, bd);
          b.position.set(px, s.ph+0.6+bh/2, pz);
          b.rotation.y = rotY;
          if(bh > 60){
            const ant = new THREE.Mesh(new THREE.CylinderGeometry(0.12,0.22,9,5), M.dark);
            ant.position.y = bh/2+4.5; b.add(ant);
            const bc = new THREE.Mesh(new THREE.SphereGeometry(0.5,8,6), M.beacon);
            bc.position.y = bh/2+9.2; b.add(bc);
          }
          g.add(b);
          const bb = bboxFor(bw, bd, rotY);
          blds.push({ x:px, z:pz, y0:s.ph-1, y1:s.ph+bh+1, hw:bb.hw+0.4, hd:bb.hd+0.4 });
        } else {
          const bw = rnd(9,13), bd = rnd(9,13), bh = rnd(9,15);
          const hh = makeHouse(bw, bh, bd);
          hh.position.set(px, s.ph+0.6, pz);
          hh.rotation.y = rotY;
          g.add(hh);
          const bb = bboxFor(bw, bd, rotY);
          blds.push({ x:px, z:pz, y0:s.ph-1, y1:s.ph+bh+3, hw:bb.hw+0.4, hd:bb.hd+0.4 });
        }
      }
    if(si===0){
      const wt = makeWaterTower(); wt.position.set(s.dx-Rp*0.5, s.ph+0.6, s.dz-Rp*0.5); g.add(wt);
      const ch = makeChurch(); ch.position.set(s.dx+Rp*0.45, s.ph+0.6, s.dz-Rp*0.45); ch.rotation.y = rnd(0,3); g.add(ch);
      blds.push({ x:s.dx+Rp*0.45, z:s.dz-Rp*0.45, y0:s.ph-1, y1:s.ph+28, hw:3.4, hd:8.2 });
      blds.push({ x:s.dx-Rp*0.5,  z:s.dz-Rp*0.5,  y0:s.ph-1, y1:s.ph+16, hw:3.2, hd:3.2 });
    }
    colBox(g, s.r*1.4, s.ph, s.r*1.4, s.dx, s.ph/2, s.dz);
  }

  function buildBridge(i, j){
    const A = subs[i], B = subs[j];
    const ddx = B.dx-A.dx, ddz = B.dz-A.dz;
    const L0 = Math.hypot(ddx,ddz);
    const ux = ddx/L0, uz = ddz/L0;
    const ax = A.dx+ux*A.r*0.98, az = A.dz+uz*A.r*0.98;
    const bx = B.dx-ux*B.r*0.98, bz = B.dz-uz*B.r*0.98;
    const mx = (ax+bx)/2, mz = (az+bz)/2;
    const len = Math.hypot(bx-ax, bz-az);
    const ang = Math.atan2(bx-ax, bz-az);
    const deckH = 15, ramp = 45, hw = 5.5;
    const prof = s=>{
      const r = ramp/len;
      if(s < r) return 3 + (deckH-3)*smooth01(s/r);
      if(s > 1-r) return deckH + (3-deckH)*smooth01((s-(1-r))/r);
      return deckH;
    };
    const bg = new THREE.Group();
    bg.position.set(mx, 0, mz); bg.rotation.y = ang;
    const n = 9;
    for(let k=0;k<n;k++){
      const s0 = k/n, s1 = (k+1)/n;
      const y0 = prof(s0), y1 = prof(s1), segLen = len/n;
      const piece = new THREE.Group();
      piece.position.set(0, (y0+y1)/2, (s0-0.5)*len+segLen/2);
      piece.rotation.x = -Math.atan2(y1-y0, segLen);
      piece.add(new THREE.Mesh(new THREE.BoxGeometry(hw*2, 0.8, segLen+0.3), M.asphalt));
      for(const sd of [-1,1]){
        const rail = new THREE.Mesh(new THREE.BoxGeometry(0.3, 1.1, segLen+0.3), M.steel);
        rail.position.set(sd*hw, 0.9, 0); piece.add(rail);
      }
      if(k%2===0){
        const lp = makeLamp(); lp.scale.setScalar(0.9);
        lp.position.set(hw-0.7, 0.6, -segLen/2+2); piece.add(lp);
      }
      bg.add(piece);
    }
    for(const st of [0.32, 0.68]){
      const zl = (st-0.5)*len;
      for(const sd of [-1,1]){
        const col = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.5, deckH+34, 10), M.white);
        col.position.set(sd*(hw-0.6), (deckH+14)/2 - 3, zl);
        bg.add(col);
      }
      const bar = new THREE.Mesh(new THREE.BoxGeometry(hw*2+1, 1.2, 1.2), M.dark);
      bar.position.set(0, deckH+14, zl); bg.add(bar);
    }
    for(const sd of [-1,1]){
      const cx = sd*(hw-0.9);
      const curve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(cx, deckH+1, -len/2+2),
        new THREE.Vector3(cx, deckH+13.5, (0.32-0.5)*len),
        new THREE.Vector3(cx, deckH+5, 0),
        new THREE.Vector3(cx, deckH+13.5, (0.68-0.5)*len),
        new THREE.Vector3(cx, deckH+1, len/2-2),
      ]);
      bg.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 36, 0.28, 6, false), M.dark));
      for(let k=1;k<8;k++){
        const p = curve.getPoint(k/8);
        if(p.y > deckH+1.2){
          const h = p.y - (deckH+0.9);
          const hg = new THREE.Mesh(new THREE.CylinderGeometry(0.05,0.05,h,4), M.dark);
          hg.position.set(cx, deckH+0.9+h/2, p.z);
          bg.add(hg);
        }
      }
    }
    colBox(bg, hw*2, 3, len, 0, deckH, 0);
    g.add(bg);
    bridges.push({ax, az, bx, bz, hw, deckH, ramp, len, ux, uz});
  }
  buildBridge(0,1); buildBridge(0,2); buildBridge(1,2);
  scene.add(g);
  const virts = subs.map(s=>{
    const v = { point:new THREE.Vector3(s.dx,0,s.dz), r:s.r*0.92, ph:s.ph,
      colType:'arch', clear:s.r+280 };
    world.islands.push(v);
    return v;
  });
  const arch = { group:g, point:g.position, colType:'arch', capR:1600, subs, bridges, virts,
    label:`Архипелаг «${name}» · три города · подвесные мосты` };
  arch.sync = ()=>{
    virts.forEach((v,i)=> v.point.set(g.position.x+subs[i].dx, 0, g.position.z+subs[i].dz));
    resetSeaAnchor();
  };
  arch.update = (dt,t)=>{
    if(distToPlayer(arch.point) > 3800 && state.vehicle!=='moto' && !state.crashed){
      placeAhead(arch.point, 1800, 3000, 2.4, world.islands.filter(o=>!virts.includes(o)));
      arch.sync();
    }
  };
  arch.sync();
  registerBuildings(arch, blds);
  spawnArchPedestrians(arch);
  world.entities.push(arch);
  return arch;
}

export function groundAt(x, z){
  const a = world.arch;
  if(!a) return null;
  const lx = x - a.point.x, lz = z - a.point.z;
  let best = null;
  for(const s of a.subs){
    const d = Math.hypot(lx-s.dx, lz-s.dz);
    if(d < s.r+12){
      let h, road;
      if(d < s.r*0.55){ h = s.ph; road = true; }
      else if(d < s.r){ h = s.ph + (2.5-s.ph)*smooth01((d/s.r-0.55)/0.45); road = false; }
      else { h = 2.5 - 11.5*((d-s.r)/12); road = false; }
      if(!best || h > best.h) best = { h, road };
    }
  }
  for(const b of a.bridges){
    const vx = lx-b.ax, vz = lz-b.az;
    const along = vx*b.ux + vz*b.uz;
    const side = vx*b.uz - vz*b.ux;
    if(along > -4 && along < b.len+4 && Math.abs(side) < b.hw+1.2){
      const s = clamp(along/b.len, 0, 1), r = b.ramp/b.len;
      let h;
      if(s < r) h = 3 + (b.deckH-3)*smooth01(s/r);
      else if(s > 1-r) h = b.deckH + (3-b.deckH)*smooth01((s-(1-r))/r);
      else h = b.deckH;
      if(!best || h > best.h) best = { h, road:true };
    }
  }
  return best;
}
export function archSpawn(){
  const a = world.arch;
  const s = a.subs[0];
  return { x: a.point.x+s.dx, z: a.point.z+s.dz-40, h: s.ph, yaw: Math.PI };
}
export function ensureArchNear(){
  const a = world.arch;
  if(distToPlayer(a.point) > 2400){
    placeAhead(a.point, 700, 1200, 2.2, world.islands.filter(o=>!a.virts.includes(o)));
    a.sync();
  }
}