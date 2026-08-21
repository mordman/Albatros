import * as THREE from 'three';
import { WIND, rnd } from './config.js';
import { scene } from './engine.js';
import { mat, M } from './materials.js';
import { colBox } from './helpers.js';
import { world } from './world.js';
import { distToPlayer, placeAhead } from './state.js';
import { waterY } from './environment.js';

const BALLOON_COLORS = [0xc65b3c, 0xe8d9b8, 0x5a7d9c, 0xd9a441];
export function makeBalloon(name){
  const g = new THREE.Group();
  const env = new THREE.Mesh(new THREE.SphereGeometry(5.5,14,11), mat(BALLOON_COLORS[Math.floor(rnd(0,4))]));
  env.scale.y = 1.18; g.add(env);
  const band = new THREE.Mesh(new THREE.TorusGeometry(5.45, 0.12, 5, 18), M.dark);
  band.rotation.x = Math.PI/2; g.add(band);
  const skirt = new THREE.Mesh(new THREE.CylinderGeometry(1.5,2.6,2,10), M.dark);
  skirt.position.y = -6; g.add(skirt);
  const basket = new THREE.Mesh(new THREE.BoxGeometry(1.8,1.4,1.8), M.trunk);
  basket.position.y = -8.6; g.add(basket);
  for(const [sx,sz] of [[-1,-1],[1,-1],[-1,1],[1,1]]){
    const rope = new THREE.Mesh(new THREE.CylinderGeometry(0.03,0.03,3.4,4), M.dark);
    rope.position.set(sx*1.1, -7.2, sz*1.1);
    rope.rotation.z = -sx*0.28; rope.rotation.x = sz*0.28;
    g.add(rope);
  }
  scene.add(g);
  colBox(g, 8, 9, 8, 0, -1, 0);
  const b = { group:g, point:g.position, colType:'balloon', capR:320, phase:rnd(0,20), recycleAt:3400,
    label:()=>`Воздушный шар «${name}» · высота ${Math.round(g.position.y)} м` };
  b.update = (dt,t)=>{
    g.position.x += WIND.x*dt*0.8; g.position.z += WIND.z*dt*0.8;
    g.rotation.z = Math.sin(t*0.4+b.phase)*0.05;
    g.rotation.x = Math.sin(t*0.31+b.phase)*0.04;
    if(distToPlayer(b.point) > b.recycleAt){
      placeAhead(b.point, 900, 2200, 2.6, world.islands);
      g.position.y = rnd(130,330);
    }
  };
  return b;
}

export function makeBuoy(num){
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.ConeGeometry(0.6,1.4,8), M.buoy);
  body.position.y = 0.5; g.add(body);
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.03,0.03,1.2,5), M.dark);
  pole.position.y = 0.9; g.add(pole);
  const flag = new THREE.Mesh(new THREE.PlaneGeometry(0.9,0.5), mat(0xb4432f,{ds:1}));
  flag.position.y = 1.7; g.add(flag);
  scene.add(g);
  const b = { group:g, point:g.position, colType:'buoy', capR:150, phase:rnd(0,10),
    label:`Навигационный буй №${num}` };
  b.update = (dt,t)=>{
    g.position.y = waterY(g.position.x, g.position.z, t) + 0.1;
    g.rotation.z = Math.sin(t*1.1+b.phase)*0.14;
    g.rotation.x = Math.cos(t*0.9+b.phase)*0.12;
    flag.rotation.y = Math.sin(t*4+b.phase)*0.4;
    if(distToPlayer(b.point) > 2400) placeAhead(b.point, 350, 1400, 2.8, world.islands);
  };
  return b;
}

export function makeCloud(){
  const g = new THREE.Group();
  const n = 4 + Math.floor(rnd(0,4));
  for(let i=0;i<n;i++){
    const s = new THREE.Mesh(new THREE.SphereGeometry(rnd(9,20),8,6), M.cloud);
    s.scale.y = 0.45;
    s.position.set(rnd(-26,26), rnd(-3,3), rnd(-12,12));
    g.add(s);
  }
  scene.add(g);
  const c = { group:g, point:g.position };
  c.update = (dt)=>{
    g.position.x += WIND.x*dt*0.6; g.position.z += WIND.z*dt*0.6;
    if(distToPlayer(c.point) > 4600){
      placeAhead(c.point, 800, 3400, 3.2, world.islands);
      g.position.y = rnd(280,650);
    }
  };
  return c;
}