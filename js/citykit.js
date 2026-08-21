import * as THREE from 'three';
import { M, CITY_MATS, CITY_ROOF } from './materials.js';

export function makeBuilding(w, h, d, plainMat){
  const g = new THREE.BoxGeometry(w, h, d);
  const uv = g.attributes.uv;
  const dims = [[d,h],[d,h],[w,d],[w,d],[w,h],[w,h]];
  for(let f=0; f<6; f++){
    const [su, sv] = dims[f];
    const ru = Math.max(1, Math.round(su/12));
    const rv = Math.max(1, Math.round(sv/12));
    for(let i=f*4; i<f*4+4; i++)
      uv.setXY(i, uv.getX(i)*ru, uv.getY(i)*rv);
  }
  const side = plainMat || CITY_MATS[Math.floor(Math.random()*CITY_MATS.length)];
  return new THREE.Mesh(g, [side, side, CITY_ROOF, CITY_ROOF, side, side]);
}
export function hipRoof(w, d, h, m){
  const geo = new THREE.ConeGeometry(1, 1, 4);
  geo.rotateY(Math.PI/4);
  const r = new THREE.Mesh(geo, m);
  r.scale.set(w*0.78, h, d*0.78);
  return r;
}
export function makeHouse(w, h, d){
  const g = new THREE.Group();
  const b = makeBuilding(w, h, d);
  b.position.y = h/2; g.add(b);
  const rh = h*0.55;
  const roof = hipRoof(w, d, rh, M.roofTile);
  roof.position.y = h + rh/2 - 0.1; g.add(roof);
  const chim = new THREE.Mesh(new THREE.BoxGeometry(0.7,1.6,0.7), M.cream);
  chim.position.set(w*0.28, h + 0.7, d*0.2); g.add(chim);
  return g;
}
export function makeChurch(){
  const g = new THREE.Group();
  const nave = makeBuilding(6, 7.5, 14, M.cream);
  nave.position.y = 3.75; g.add(nave);
  const roof = hipRoof(6.6, 14.6, 3, M.roofTile); roof.position.y = 9; g.add(roof);
  for(const s of [-1,1]){
    const strip = new THREE.Mesh(new THREE.BoxGeometry(0.15, 3.2, 9), M.glass);
    strip.position.set(s*3.05, 4.6, 0); g.add(strip);
  }
  const tower = new THREE.Mesh(new THREE.BoxGeometry(4.4,18,4.4), M.cream);
  tower.position.set(0, 9, 8.5); g.add(tower);
  const clock = new THREE.Mesh(new THREE.CircleGeometry(1.1, 16), M.clockFace);
  clock.position.set(0, 15, 10.74); g.add(clock);
  const spire = hipRoof(4.6, 4.6, 6, M.roofTile); spire.position.set(0, 21, 8.5); g.add(spire);
  const crossV = new THREE.Mesh(new THREE.BoxGeometry(0.22,2.2,0.22), M.dark);
  crossV.position.set(0, 25.2, 8.5); g.add(crossV);
  const crossH = new THREE.Mesh(new THREE.BoxGeometry(1.2,0.22,0.22), M.dark);
  crossH.position.set(0, 25.6, 8.5); g.add(crossH);
  return g;
}
export function makeWaterTower(){
  const g = new THREE.Group();
  for(const [sx,sz] of [[-1,-1],[1,-1],[-1,1],[1,1]]){
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.16,0.22,10,7), M.dark);
    leg.position.set(sx*1.5, 5, sz*1.5);
    leg.rotation.z = -sx*0.12; leg.rotation.x = sz*0.12;
    g.add(leg);
  }
  const tank = new THREE.Mesh(new THREE.CylinderGeometry(2.6,2.6,3.4,14), M.steel);
  tank.position.y = 11.5; g.add(tank);
  const cap = hipRoof(5.4, 5.4, 1.8, M.roofTile); cap.position.y = 14.1; g.add(cap);
  return g;
}
export function makeTree(){
  const g = new THREE.Group();
  const t = new THREE.Mesh(new THREE.CylinderGeometry(0.22,0.34,2.2,7), M.trunk);
  t.position.y = 1.1; g.add(t);
  const c1 = new THREE.Mesh(new THREE.ConeGeometry(2.0,4.4,8), M.pine);
  c1.position.y = 4.0; g.add(c1);
  const c2 = new THREE.Mesh(new THREE.ConeGeometry(1.5,3.2,8), M.pine);
  c2.position.y = 6.0; g.add(c2);
  return g;
}
export function makeLamp(){
  const g = new THREE.Group();
  const p = new THREE.Mesh(new THREE.CylinderGeometry(0.09,0.14,4.5,7), M.dark);
  p.position.y = 2.25; g.add(p);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.3,8,6), M.lampGlow);
  head.position.y = 4.6; g.add(head);
  return g;
}
export function rampMesh(ax,ay,az, bx,by,bz, w){
  const dx=bx-ax, dz=bz-az, dy=by-ay;
  const dh=Math.hypot(dx,dz), len=Math.hypot(dh,dy);
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, 0.4, len), M.asphalt);
  m.position.set((ax+bx)/2, (ay+by)/2, (az+bz)/2);
  m.rotation.order = 'YXZ';
  m.rotation.y = Math.atan2(dx, dz);
  m.rotation.x = -Math.atan2(dy, dh);
  return m;
}
export function makePier(len){
  const g = new THREE.Group();
  const deck = new THREE.Mesh(new THREE.BoxGeometry(7, 0.5, len), M.deck);
  deck.position.set(0, 4.3, len/2); g.add(deck);
  const n = Math.round(len/10);
  for(let i=0;i<=n;i++) for(const s of [-1,1]){
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.32,0.42,8,7), M.woodDark);
    post.position.set(s*2.7, 0.6, i*(len/n));
    g.add(post);
  }
  for(let i=1;i<n;i+=2) for(const s of [-1,1]){
    const k = new THREE.Mesh(new THREE.CylinderGeometry(0.18,0.22,0.8,6), M.dark);
    k.position.set(s*2.7, 4.95, i*(len/n)); g.add(k);
  }
  for(let i=0;i<=n;i+=2){
    const l = makeLamp(); l.scale.setScalar(0.8);
    l.position.set(3.1, 4.55, i*(len/n));
    g.add(l);
  }
  return g;
}
export function makeMooredBoat(mastFn, makeHullFn){
  const g = new THREE.Group();
  const hull = makeHullFn(9, 2.8, 1.8, M.white); hull.position.y = 0.55; g.add(hull);
  const cab = new THREE.Mesh(new THREE.BoxGeometry(2,1.3,3), M.cream);
  cab.position.set(0,1.6,-0.8); g.add(cab);
  const m = mastFn(3); m.position.set(0,2.8,1.8); g.add(m);
  return g;
}
export function makeWarehouse(){
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(11, 5.5, 17), M.warehouse);
  body.position.y = 2.75; g.add(body);
  const roof = hipRoof(12, 18.2, 2.6, M.roofTar); roof.position.y = 6.8; g.add(roof);
  const door = new THREE.Mesh(new THREE.BoxGeometry(4.5, 3.6, 0.25), M.dark);
  door.position.set(0, 1.8, 8.6); g.add(door);
  return g;
}
export function makeCrane(){
  const g = new THREE.Group();
  const base = new THREE.Mesh(new THREE.BoxGeometry(2.6, 1.4, 2.6), M.dark);
  base.position.y = 0.7; g.add(base);
  const tower = new THREE.Mesh(new THREE.BoxGeometry(1.3, 15, 1.3), M.craneY);
  tower.position.y = 8.2; g.add(tower);
  const cab = new THREE.Mesh(new THREE.BoxGeometry(1.8, 1.6, 2.2), M.dark);
  cab.position.set(0, 14.2, 1.2); g.add(cab);
  const jib = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.8, 13), M.craneY);
  jib.position.set(0, 15.8, 4.5); jib.rotation.x = 0.18; g.add(jib);
  const counter = new THREE.Mesh(new THREE.BoxGeometry(2.4, 1.4, 2.2), M.dark);
  counter.position.set(0, 15.6, -2.6); g.add(counter);
  const cable = new THREE.Mesh(new THREE.CylinderGeometry(0.04,0.04,7,4), M.dark);
  cable.position.set(0, 11.4, 10.4); g.add(cable);
  const hook = new THREE.Mesh(new THREE.BoxGeometry(0.7,0.5,0.7), M.red);
  hook.position.set(0, 7.6, 10.4); g.add(hook);
  return g;
}
const CONTAINER_COLORS = [0xb4432f, 0x3f6f8f, 0xd9a441, 0x4d7a4a, 0x8a8f96];
export function makeContainerStack(matFn){
  const g = new THREE.Group();
  const n = 2 + Math.floor(Math.random()*2);
  for(let i=0;i<n;i++){
    const c = new THREE.Mesh(new THREE.BoxGeometry(2.5, 2.2, 6.2),
      matFn(CONTAINER_COLORS[Math.floor(Math.random()*5)]));
    c.position.set((Math.random()-0.5)*0.6, 1.1 + i*2.25, (Math.random()-0.5)*0.8);
    c.rotation.y = (Math.random()-0.5)*0.1;
    g.add(c);
  }
  return g;
}