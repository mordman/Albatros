import * as THREE from 'three';
import { scene, camera } from './engine.js';
import { rnd, clamp, BOAT, SUB } from './config.js';
import { player, state, game, distToPlayer } from './state.js';
import { world } from './world.js';
import { planeG, boatG, subG, motoG, activeVehicleGroup, applyVehicleVisibility } from './vehicles.js';
import { waterY } from './environment.js';
import { seafloorY } from './seafloor.js';
import { explosion, splash, bubbles, feathers } from './particles.js';
import { boomSound } from './audio.js';
import { showCaption } from './hud.js';
import { archSpawn } from './arch.js';

export const debris = [];
export const crashPos = new THREE.Vector3();
let crashCount = 0;
const fwdV = new THREE.Vector3();

function detachVehicle(vx,vy,vz){
  debris.length = 0;
  const vg = activeVehicleGroup();
  const wp = new THREE.Vector3(), wq = new THREE.Quaternion();
  for(const c of [...vg.userData.parts]){
    c.getWorldPosition(wp); c.getWorldQuaternion(wq);
    vg.remove(c);
    c.position.copy(wp); c.quaternion.copy(wq);
    scene.add(c);
    debris.push({ o:c,
      v:new THREE.Vector3(vx*0.45+rnd(-13,13), vy*0.45+rnd(3,15), vz*0.45+rnd(-13,13)),
      a:new THREE.Vector3(rnd(-3.5,3.5), rnd(-3.5,3.5), rnd(-3.5,3.5)), wet:false });
  }
  planeG.visible = false; boatG.visible = false; subG.visible = false; motoG.visible = false;
}

export function updateDebris(dt, t){
  for(const d of debris){
    const wy = waterY(d.o.position.x, d.o.position.z, t);
    const underwater = d.o.position.y < wy;
    d.v.y -= (underwater ? 3 : 22)*dt;
    if(underwater) d.v.multiplyScalar(Math.max(0, 1 - 0.8*dt));
    d.o.position.addScaledVector(d.v, dt);
    d.o.rotation.x += d.a.x*dt; d.o.rotation.y += d.a.y*dt; d.o.rotation.z += d.a.z*dt;
    const rest = underwater ? seafloorY(d.o.position.x, d.o.position.z) + 0.2 : wy + 0.15;
    if(d.o.position.y < rest){
      if(!d.wet){ d.wet = true; if(!underwater) splash(d.o.position.x, wy, d.o.position.z, 7, 0.5); }
      d.v.set(0, -0.4, 0);
      d.a.multiplyScalar(0.92);
    }
  }
}

function respawnVehicle(){
  const vg = activeVehicleGroup();
  for(const d of debris){
    scene.remove(d.o);
    vg.add(d.o);
    d.o.position.copy(d.o.userData._lp);
    d.o.quaternion.copy(d.o.userData._lq);
    d.o.scale.copy(d.o.userData._ls);
  }
  debris.length = 0;
}

export function crash(reason){
  if(state.crashed) return;
  state.crashed = true;
  crashCount++;
  const elCr = document.getElementById('vCrash');
  if(elCr) elCr.textContent = crashCount;
  crashPos.copy(player.pos);
  const vx = Math.sin(player.yaw)*Math.cos(player.pitch)*player.speed;
  const vy = Math.sin(player.pitch)*player.speed;
  const vz = Math.cos(player.yaw)*Math.cos(player.pitch)*player.speed;
  explosion(player.pos.x, player.pos.y, player.pos.z);
  if(player.pos.y < waterY(player.pos.x, player.pos.z, game.simT))
    bubbles(player.pos.x, player.pos.y, player.pos.z, 30, 1.4);
  else if(reason.indexOf('вод') >= 0 || reason.indexOf('море') >= 0 || state.vehicle==='boat')
    splash(player.pos.x, waterY(player.pos.x, player.pos.z, game.simT), player.pos.z, 50, 1.3);
  detachVehicle(vx, vy, vz);
  game.slowT = 1.15; game.shake = 1.3; game.respawnT = 3.4;
  showCaption(`АВАРИЯ · ${reason}`, 4);
  const fd = document.getElementById('fade');
  fd.classList.remove('flash','dark'); void fd.offsetWidth; fd.classList.add('flash');
  boomSound();
}

export function respawn(){
  state.crashed = false;
  respawnVehicle();
  applyVehicleVisibility();
  if(state.vehicle === 'moto'){
    const sp = archSpawn();
    player.pos.set(sp.x, sp.h + 0.5, sp.z);
    player.yaw = sp.yaw;
    player.pitch = 0; player.speed = 8; player.vy = 0;
  } else {
    player.pos.x += Math.sin(player.yaw)*430;
    player.pos.z += Math.cos(player.yaw)*430;
    if(state.vehicle === 'boat'){
      player.pos.y = waterY(player.pos.x, player.pos.z, game.simT) + BOAT.draft;
      player.pitch = 0; player.speed = 0;
    } else if(state.vehicle === 'sub'){
      player.pos.y = clamp(seafloorY(player.pos.x, player.pos.z) + 26, -95, -14);
      player.pitch = 0; player.speed = SUB.cruise;
    } else {
      player.pos.y = Math.max(waterY(player.pos.x, player.pos.z, game.simT) + 60, 80);
      player.pitch = 0; player.speed = 44;
    }
  }
  player.bank = 0;
  fwdV.set(Math.sin(player.yaw), 0, Math.cos(player.yaw));
  camera.position.copy(player.pos).addScaledVector(fwdV, -16);
  camera.position.y += state.vehicle==='plane' ? 6 : 3.5;
  camera.lookAt(player.pos);
  const fd = document.getElementById('fade');
  fd.classList.remove('flash','dark'); void fd.offsetWidth; fd.classList.add('dark');
  showCaption(state.vehicle==='boat' ? 'КАТЕР ВОССТАНОВЛЕН'
    : state.vehicle==='sub' ? 'БАТИСКАФ ВОССТАНОВЛЕН'
    : state.vehicle==='moto' ? 'МОТОЦИКЛ ВОССТАНОВЛЕН' : 'ГИДРОПЛАН ВОССТАНОВЛЕН', 3);
}

function islandCollision(P, PR){
  if(state.vehicle === 'moto') return null; // мото едет по groundAt
  for(const isl of world.islands){
    if(isl.colType === 'city'){
      if(distToPlayer(isl.point) < isl.R*0.95 && P.y < 7)
        return state.vehicle==='sub' ? 'врезался в основание порта' : 'сел на мель';
      const hx = P.x - (isl.point.x + isl.hx), hz = P.z - (isl.point.z + isl.hz);
      if(Math.hypot(hx,hz) < isl.Rp + PR && P.y < isl.topY)
        return 'столкновение с городом';
    } else if(isl.colType === 'arch'){
      const d = distToPlayer(isl.point);
      if(d < isl.r + PR && P.y < isl.ph + 4){
        if(P.y < isl.ph*Math.max(0, 1 - d/(isl.r*0.98)) + 2.5)
          return state.vehicle==='plane' ? 'столкновение с городом-островом' : 'наскочил на остров';
      }
    } else {
      const d = distToPlayer(isl.point);
      if(d < isl.r + PR && P.y < isl.h + 4){
        if(P.y < isl.h*Math.max(0, 1 - d/isl.r) + 2.5)
          return state.vehicle!=='plane' ? 'наскочил на рифы' : 'столкновение с островом';
      }
    }
  }
  // Проверка коллизий со зданиями и объектами города
  for(const b of world.buildings || []){
    if(!b.box) continue;
    const dx = Math.abs(P.x - b.box.cx);
    const dz = Math.abs(P.z - b.box.cz);
    const dy = Math.abs(P.y - b.box.cy);
    if(dx < b.box.hw + PR && dz < b.box.hd + PR && dy < b.box.hh + PR)
      return 'столкновение со зданием';
  }
  return null;
}

export function checkCollisions(t){
  if(!state.started || state.crashed) return;
  const P = player.pos, PR = state.vehicle==='boat' ? 2.7 : 3.2;
  const terr = islandCollision(P, PR);
  if(terr) return crash(terr);
  for(const e of world.entities){
    switch(e.colType){
      case 'ship':{
        const dx = P.x - e.point.x, dz = P.z - e.point.z;
        if(dx*dx + dz*dz > 900) break;
        const c = Math.cos(e.heading), s = Math.sin(e.heading);
        const lx = dx*c - dz*s, lz = dx*s + dz*c;
        if(Math.abs(lx) < e.width/2 + PR && Math.abs(lz) < e.len/2 + PR &&
           P.y < e.group.position.y + e.colH && P.y > e.group.position.y - 3)
          return crash('столкновение с судном');
        break;
      }
      case 'wreck':{
        if(state.vehicle !== 'sub') break;
        const dx = P.x - e.point.x, dz = P.z - e.point.z;
        if(dx*dx + dz*dz > 900) break;
        if(Math.abs(dx) < e.width/2 + PR && Math.abs(dz) < e.len/2 + PR &&
           P.y < e.group.position.y + e.colH && P.y > e.group.position.y - 4)
          return crash('налетел на затонувшее судно');
        break;
      }
      case 'mega':{
        const dx = P.x - e.point.x, dz = P.z - e.point.z;
        if(dx*dx + dz*dz > 625) break;
        const hy = e.group.rotation.y;
        const hx = Math.sin(hy), hz = Math.cos(hy);
        const along = dx*hx + dz*hz, side = dx*hz - dz*hx;
        if(Math.abs(along) < 10 && Math.abs(side) < 3.2 && Math.abs(P.y - e.point.y) < 3.4)
          return crash('атака мегалодона');
        break;
      }
      case 'whale':{
        if(state.vehicle === 'sub'){
          if(P.y < -4 && P.distanceTo(e.group.position) < 6.5)
            return crash('столкновение с китом');
        } else if(e.state === 'breach' && P.distanceTo(e.group.position) < 5.5)
          return crash('столкновение с китом');
        break;
      }
      case 'balloon':{
        if(distToPlayer(e.point) < 7 && P.y > e.point.y - 10 && P.y < e.point.y + 6)
          return crash('столкновение с аэростатом');
        break;
      }
      case 'buoy':{
        if(distToPlayer(e.point) < 3.0 && P.y < waterY(P.x,P.z,t) + 2.5)
          return crash('наскочил на буй');
        break;
      }
    }
    if(e.birds && !e.bound && game.birdCD <= 0 && distToPlayer(e.point) < 70){
      for(const b of e.birds){
        if(b.mesh.position.distanceToSquared(P) < 6){
          game.birdCD = 2.5;
          feathers(b.mesh.position);
          b.mesh.position.y += 4;
          showCaption('СТУК О ЧАЙКУ — ЦЕЛЫ', 2);
          break;
        }
      }
    }
  }
}