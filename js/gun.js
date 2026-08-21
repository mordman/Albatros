import * as THREE from 'three';
import { scene } from './engine.js';
import { rnd } from './config.js';
import { player, state } from './state.js';
import { world } from './world.js';
import { keys, PG } from './vehicles.js';
import { particles, splash } from './particles.js';
import { waterY } from './environment.js';
import { gunSound } from './audio.js';
import { checkBuildingHit } from './buildings.js';
import { pedWorldPos } from './pedestrians.js';
import { damageShip } from './ships.js';

const B_MAX = 48;
const bullets = [];
const tracers = [];
const tracerMat = new THREE.MeshBasicMaterial({ color:0xffe9a0 });
for(let i=0;i<B_MAX;i++){
  const m = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.07, 1.3), tracerMat);
  m.visible = false;
  scene.add(m);
  tracers.push(m);
  bullets.push({ life:0, pos:new THREE.Vector3(), prev:new THREE.Vector3(), vel:new THREE.Vector3() });
}

let fireT = 0, flashT = 0, cursor = 0, shot = 0, kills = 0;
const elKills = document.getElementById('vKills');
const tmpP = new THREE.Vector3();
const tmpD = new THREE.Vector3();

function fireOne(){
  const b = bullets[cursor]; const tr = tracers[cursor];
  cursor = (cursor+1)%B_MAX;
  const yaw = player.yaw, pitch = player.pitch;
  const cy = Math.cos(yaw), sy = Math.sin(yaw);
  const cp = Math.cos(pitch), sp = Math.sin(pitch);
  const side = (shot++ % 2) ? 1 : -1;
  const lx = side*0.30, ly = 0.62, lz = 3.05;   // дуло в системе самолёта
  b.pos.set(
    player.pos.x + lx*cy + lz*sy,
    player.pos.y + ly + lz*sp*0.6,
    player.pos.z - lx*sy + lz*cy);
  b.prev.copy(b.pos);
  const speed = 170 + player.speed;
  b.vel.set(sy*cp*speed, sp*speed, cy*cp*speed);
  b.life = 1.3;
  tr.visible = true;
  flashT = 0.05;
  PG.muzzles.forEach(m=>{ m.visible = true; m.scale.setScalar(rnd(0.8,1.3)); });
  gunSound();
}

function killBullet(i){ bullets[i].life = 0; tracers[i].visible = false; }

// расстояние² от точки до отрезка a→b (защита от «прошивания» на скорости)
function segDist2(ax,ay,az, bx,by,bz, px,py,pz){
  const abx=bx-ax, aby=by-ay, abz=bz-az;
  const apx=px-ax, apy=py-ay, apz=pz-az;
  const L = abx*abx+aby*aby+abz*abz;
  let s = L>0 ? (apx*abx+apy*aby+apz*abz)/L : 0;
  s = s<0?0:(s>1?1:s);
  const dx = apx-abx*s, dy = apy-aby*s, dz = apz-abz*s;
  return dx*dx+dy*dy+dz*dz;
}

// человечек взрывается красными «осколками»
function killPed(p, pos){
  p.dead = true; p.deadT = 0;
  p.mesh.visible = false;
  kills++;
  if(elKills) elKills.textContent = kills;
  for(let k=0;k<14;k++)
    particles.spawn(pos.x, pos.y, pos.z, {
      vx:rnd(-5,5), vy:rnd(2,10), vz:rnd(-5,5),
      life:rnd(.3,.8), s0:rnd(.2,.4), s1:.08,
      r:.62, g:.1, b:.1, a:.95, grav:-18, drag:.6 });
  for(let k=0;k<5;k++)  // «кусочки» одежды
    particles.spawn(pos.x, pos.y, pos.z, {
      vx:rnd(-4,4), vy:rnd(3,8), vz:rnd(-4,4),
      life:rnd(.5,1), s0:rnd(.35,.55), s1:.15,
      r:.45, g:.35, b:.3, a:.9, grav:-22, drag:.5 });
}

export function updateGun(dt, t){
  fireT -= dt;
  if(keys.Space && state.vehicle==='plane' && state.started && !state.crashed && fireT <= 0){
    fireT = 0.09;
    fireOne();
  }
  if(flashT > 0){
    flashT -= dt;
    if(flashT <= 0) PG.muzzles.forEach(m=> m.visible = false);
  }
  for(let i=0;i<B_MAX;i++){
    const b = bullets[i];
    if(b.life <= 0) continue;
    b.life -= dt;
    b.prev.copy(b.pos);
    b.pos.addScaledVector(b.vel, dt);
    if(b.life <= 0){ killBullet(i); continue; }
    // вода
    const wy = waterY(b.pos.x, b.pos.z, t);
    if(b.pos.y < wy){
      splash(b.pos.x, wy, b.pos.z, 2, 0.25);
      killBullet(i); continue;
    }
    // здания — искры
    if(checkBuildingHit(b.pos.x, b.pos.y, b.pos.z, 0.15)){
      for(let k=0;k<4;k++)
        particles.spawn(b.pos.x, b.pos.y, b.pos.z, {
          vx:rnd(-6,6), vy:rnd(-2,6), vz:rnd(-6,6),
          life:rnd(.15,.35), s0:rnd(.2,.35), s1:.05,
          r:1, g:0.85, b:0.4, a:1, grav:-20 });
      killBullet(i); continue;
    }
    // суда: -1 HP за попадание, 5 — пожар, 10 — взрыв
    let hitShip = false;
    for(const e of world.entities){
      if(e.colType !== 'ship' || e.sinking) continue;
      const dx = b.pos.x - e.point.x, dz = b.pos.z - e.point.z;
      if(dx*dx + dz*dz > 900) continue;
      if(b.pos.y > e.group.position.y + e.colH || b.pos.y < e.group.position.y - 3) continue;
      const c = Math.cos(e.heading), sn = Math.sin(e.heading);
      const lx = dx*c - dz*sn, lz = dx*sn + dz*c;
      if(Math.abs(lx) < e.width/2 + 0.4 && Math.abs(lz) < e.len/2 + 0.4){
        damageShip(e, b.pos.x, b.pos.y, b.pos.z);
        killBullet(i);
        hitShip = true;
        break;
      }
    }
    if(hitShip) continue;
    // пешеходы (проверка по отрезку prev→pos)
    let hit = false;
    for(const p of world.pedestrians){
      if(p.dead) continue;
      pedWorldPos(p, tmpP);
      tmpP.y += 0.9;
      if(segDist2(b.prev.x,b.prev.y,b.prev.z, b.pos.x,b.pos.y,b.pos.z,
                  tmpP.x,tmpP.y,tmpP.z) < 1.44){
        killPed(p, tmpP);
        killBullet(i);
        hit = true;
        break;
      }
    }
    if(hit) continue;
    tracers[i].position.copy(b.pos);
    tracers[i].lookAt(tmpD.copy(b.pos).add(b.vel));
  }
}