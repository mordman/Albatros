import * as THREE from 'three';
import { rnd } from './config.js';
import { scene } from './engine.js';
import { M } from './materials.js';
import { colBox } from './helpers.js';
import { makePalm, makeLighthouse } from './nature.js';
import { world } from './world.js';
import { distToPlayer, placeAhead } from './state.js';

export function makeIsland(name){
  const g = new THREE.Group();
  const r = rnd(42,90), h = rnd(26,50);
  const rockGeo = new THREE.CylinderGeometry(r*0.32, r, h, 14, 5);
  { const p = rockGeo.attributes.position;
    for(let i=0;i<p.count;i++){
      p.setX(i, p.getX(i)+rnd(-r*0.08,r*0.08));
      p.setZ(i, p.getZ(i)+rnd(-r*0.08,r*0.08));
      p.setY(i, p.getY(i)+rnd(-h*0.05,h*0.05));
    } rockGeo.computeVertexNormals(); }
  const rock = new THREE.Mesh(rockGeo, M.rock);
  rock.position.y = h/2 - 3; g.add(rock);
  const peak = new THREE.Mesh(new THREE.ConeGeometry(r*0.3, h*0.55, 9, 3), M.cliff);
  peak.position.set(rnd(-r*0.2,r*0.2), h*0.6, rnd(-r*0.2,r*0.2));
  peak.rotation.y = rnd(0,3); g.add(peak);
  const beach = new THREE.Mesh(new THREE.CylinderGeometry(r+5,r+10,2.2,14), M.sand);
  beach.position.y = 0.5; g.add(beach);
  for(let i=0;i<4;i++){
    const c = new THREE.Mesh(new THREE.DodecahedronGeometry(rnd(3,6)), M.cliff);
    const a = rnd(0,Math.PI*2);
    c.position.set(Math.cos(a)*(r+4), 1.5, Math.sin(a)*(r+4));
    c.rotation.set(rnd(0,3),rnd(0,3),rnd(0,3)); g.add(c);
  }
  const palms = [];
  const np = 3 + Math.floor(rnd(0,3));
  for(let i=0;i<np;i++){
    const p = makePalm(); palms.push(p);
    const a = rnd(0,Math.PI*2), rr = r*rnd(0.72,0.95);
    p.position.set(Math.cos(a)*rr, rnd(1,4), Math.sin(a)*rr);
    p.rotation.y = rnd(0,6); g.add(p);
  }
  const hasLH = Math.random() < 0.45;
  if(hasLH){
    const lh = makeLighthouse();
    lh.position.set(rnd(-r*0.15,r*0.15), h-3, rnd(-r*0.15,r*0.15));
    g.add(lh);
    g.userData.beams = lh.userData.beams;
  }
  scene.add(g);
  colBox(g, r*1.6, h, r*1.6, 0, h/2, 0);
  const isl = { group:g, point:g.position, colType:'isle', capR:700, clear:r+220,
    r, h, label:`${name} · ${hasLH?'действующий маяк':'песок и пальмы'}` };
  isl.update = (dt,t)=>{
    if(g.userData.beams) g.userData.beams.rotation.y = t*0.7;
    for(const p of palms) p.userData.crown.rotation.x = Math.sin(t*1.2+p.position.x)*0.04;
    if(distToPlayer(isl.point) > 3600)
      placeAhead(isl.point, 1500, 3000, 2.6, world.islands.filter(o=>o!==isl));
  };
  return isl;
}