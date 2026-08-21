import * as THREE from 'three';
import { rnd } from './config.js';
import { world } from './world.js';
import { mat } from './materials.js';

const SKINS  = [0xe8b88f, 0xd9a06e, 0xb97a50, 0xf0c8a0];
const SHIRTS = [0xc2564a, 0x4a6f8f, 0x6f8f4a, 0xd9c06a, 0x8a5f9f, 0xcf8f4a, 0x9f4a4a];
const PANTS  = [0x3a4a5a, 0x4a3a2a, 0x555a60, 0x2a3a4a];

function makePerson(){
  const g = new THREE.Group();
  g.rotation.order = 'YXZ';
  const skin  = mat(SKINS[Math.floor(rnd(0,SKINS.length))]);
  const shirt = mat(SHIRTS[Math.floor(rnd(0,SHIRTS.length))]);
  const pants = mat(PANTS[Math.floor(rnd(0,PANTS.length))]);

  const legL = new THREE.Group(); legL.position.set(-0.09, 0.86, 0);
  const legR = new THREE.Group(); legR.position.set( 0.09, 0.86, 0);
  for(const l of [legL, legR]){
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.86, 0.13), pants);
    leg.position.y = -0.43;
    l.add(leg);
    g.add(l);
  }
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.52, 0.2), shirt);
  torso.position.y = 1.12;
  g.add(torso);
  const armL = new THREE.Group(); armL.position.set(-0.22, 1.34, 0);
  const armR = new THREE.Group(); armR.position.set( 0.22, 1.34, 0);
  for(const a of [armL, armR]){
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.5, 0.1), shirt);
    arm.position.y = -0.25;
    a.add(arm);
    const hand = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.1, 0.1), skin);
    hand.position.y = -0.52;
    a.add(hand);
    g.add(a);
  }
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.2, 0.18), skin);
  head.position.y = 1.5;
  g.add(head);
  const hair = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.07, 0.2), mat(0x3a2a1a));
  hair.position.y = 1.62;
  g.add(hair);
  g.userData = { legL, legR, armL, armR };
  return g;
}

function spawnPed(owner, axis, fixed, t, min, max, y0){
  const mesh = makePerson();
  const p = { owner, mesh, axis, fixed, t, min, max, y0,
    dir: Math.random()<0.5 ? 1 : -1,
    speed: rnd(1.1, 2.0), phase: rnd(0, 10), dead:false, deadT:0 };
  mesh.position.set(axis==='x' ? t : fixed, y0, axis==='x' ? fixed : t);
  mesh.rotation.y = (axis==='x' ? Math.PI/2 : 0) + (p.dir<0 ? Math.PI : 0);
  owner.group.add(mesh);
  world.pedestrians.push(p);
  return p;
}

export function spawnCityPedestrians(city, hillPos, Rp, townY){
  for(let i=0;i<8;i++){
    const axis = Math.random()<0.5 ? 'x' : 'z';
    const cx = axis==='x' ? hillPos.x : hillPos.z;
    const fixed = (axis==='x' ? hillPos.z : hillPos.x) + rnd(-2.4, 2.4);
    const half = Rp*0.8;
    spawnPed(city, axis, fixed, cx+rnd(-half, half), cx-half, cx+half, townY+0.1);
  }
}

export function spawnArchPedestrians(arch){
  for(const s of arch.subs){
    for(let i=0;i<7;i++){
      const axis = Math.random()<0.5 ? 'x' : 'z';
      const cx = axis==='x' ? s.dx : s.dz;
      const fixed = (axis==='x' ? s.dz : s.dx) + rnd(-2.6, 2.6);
      const half = s.r*0.52*0.9;
      spawnPed(arch, axis, fixed, cx+rnd(-half, half), cx-half, cx+half, s.ph+0.7);
    }
  }
}

export function pedWorldPos(p, out){
  out.set(p.owner.point.x + p.mesh.position.x,
          p.mesh.position.y,
          p.owner.point.z + p.mesh.position.z);
  return out;
}

export function updatePedestrians(dt){
  for(const p of world.pedestrians){
    const m = p.mesh;
    if(p.dead){
      p.deadT += dt;
      m.rotation.x = -Math.min(p.deadT*5, 1)*Math.PI/2;  // падает
      if(p.deadT > 4.5){                                  // «встаёт» в другом месте
        p.dead = false; p.deadT = 0;
        m.rotation.x = 0;
        p.t = rnd(p.min, p.max);
        p.dir = Math.random()<0.5 ? 1 : -1;
      }
      continue;
    }
    p.t += p.dir*p.speed*dt;
    if(p.t > p.max){ p.t = p.max; p.dir = -1; }
    if(p.t < p.min){ p.t = p.min; p.dir = 1; }
    p.phase += dt*p.speed*4.2;
    if(p.axis === 'x') m.position.set(p.t, p.y0 + Math.abs(Math.sin(p.phase))*0.03, p.fixed);
    else               m.position.set(p.fixed, p.y0 + Math.abs(Math.sin(p.phase))*0.03, p.t);
    m.rotation.y = (p.axis==='x' ? Math.PI/2 : 0) + (p.dir<0 ? Math.PI : 0);
    const u = m.userData;
    const sw = Math.sin(p.phase)*0.55;
    u.legL.rotation.x =  sw;
    u.legR.rotation.x = -sw;
    u.armL.rotation.x = -sw*0.7;
    u.armR.rotation.x =  sw*0.7;
  }
}