import * as THREE from 'three';
import { scene } from './engine.js';
import { rnd, WARSHIP, PLAYER_HP } from './config.js';
import { player, state, game } from './state.js';
import { world } from './world.js';
import { particles, splash } from './particles.js';
import { waterY } from './environment.js';
import { flakSound, hitSound } from './audio.js';
import { crash } from './collisions.js';
import { showCaption } from './hud.js';

const S_MAX = 90;
const shells = [];
const shellMeshes = [];
const shellMat = new THREE.MeshBasicMaterial({ color:0xffb268 });
for(let i=0;i<S_MAX;i++){
  const m = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.14, 2.2), shellMat);
  m.visible = false; scene.add(m);
  shellMeshes.push(m);
  shells.push({ life:0, pos:new THREE.Vector3(), prev:new THREE.Vector3(), vel:new THREE.Vector3() });
}
let cursor = 0;
const tmpA = new THREE.Vector3();
const tmpB = new THREE.Vector3();
const tmpC = new THREE.Vector3();
const prevPlayer = new THREE.Vector3();
const playerVel = new THREE.Vector3();
let velInit = false;
let smokeT = 0, warned = false;

function spawnShell(from, aim){
  const sh = shells[cursor]; const m = shellMeshes[cursor];
  cursor = (cursor+1)%S_MAX;
  sh.pos.copy(from); sh.prev.copy(from);
  const dist = from.distanceTo(aim);
  sh.vel.copy(aim).sub(from).normalize().multiplyScalar(WARSHIP.shellSpeed);
  sh.life = dist/WARSHIP.shellSpeed + rnd(0, 0.12); // рвётся около точки прицеливания
  m.visible = true;
}
function killShell(i){ shells[i].life = 0; shellMeshes[i].visible = false; }

// разрыв снаряда
function burst(i){
  const s = shells[i];
  particles.spawn(s.pos.x, s.pos.y, s.pos.z, { life:.18, s0:2.4, s1:4, r:1, g:.8, b:.5, a:.9 });
  for(let k=0;k<3;k++)
    particles.spawn(s.pos.x, s.pos.y, s.pos.z, {
      vx:rnd(-3,3), vy:rnd(-3,3), vz:rnd(-3,3),
      life:rnd(.5,1.2), s0:rnd(.8,1.4), s1:rnd(2.5,4.5),
      r:.35, g:.33, b:.34, a:.5 });
  if(state.vehicle==='plane' && !state.crashed){
    const d = s.pos.distanceTo(player.pos);
    if(d < WARSHIP.burstRadius) hitPlayer();
    else if(d < WARSHIP.burstRadius*2.2) game.shake = Math.max(game.shake, 0.35);
  }
}

function hitPlayer(){
  player.hp -= PLAYER_HP.flakDamage;
  game.shake = Math.max(game.shake, 0.8);
  hitSound();
  for(let k=0;k<8;k++)
    particles.spawn(player.pos.x, player.pos.y, player.pos.z, {
      vx:rnd(-6,6), vy:rnd(-3,6), vz:rnd(-6,6),
      life:rnd(.2,.5), s0:rnd(.3,.5), s1:.1,
      r:1, g:.7, b:.3, a:1, grav:-15 });
  if(player.hp <= 0){
    crash('сбит зенитным огнём');
  } else if(player.hp <= PLAYER_HP.smokeAt && !warned){
    warned = true;
    showCaption('САМОЛЁТ ДЫМИТ — УХОДИ ОТ ОГНЯ!', 3);
  }
}

// расстояние² от точки до отрезка (защита от прошивания)
function segDist2(ax,ay,az, bx,by,bz, px,py,pz){
  const abx=bx-ax, aby=by-ay, abz=bz-az;
  const apx=px-ax, apy=py-ay, apz=pz-az;
  const L = abx*abx+aby*aby+abz*abz;
  let s = L>0 ? (apx*abx+apy*aby+apz*abz)/L : 0;
  s = s<0?0:(s>1?1:s);
  const dx = apx-abx*s, dy = apy-aby*s, dz = apz-abz*s;
  return dx*dx+dy*dy+dz*dz;
}

export function updateFlak(dt, t){
  // скорость игрока — для упреждения
  if(dt > 0){
    if(!velInit){ prevPlayer.copy(player.pos); velInit = true; }
    playerVel.copy(player.pos).sub(prevPlayer).divideScalar(dt);
    if(playerVel.lengthSq() > 250000) playerVel.set(0,0,0); // защита от телепорта
    prevPlayer.copy(player.pos);
  }
  const planeTarget = state.vehicle==='plane' && state.started && !state.crashed;

  // зенитки кораблей
  for(const e of world.entities){
    if(e.colType !== 'warship' || e.sinking) continue;
    const dist = e.group.position.distanceTo(player.pos);
    const canFire = planeTarget
      && dist < WARSHIP.range && dist > WARSHIP.minRange;
    for(const m of e.mounts){
      if(canFire){
        m.turret.lookAt(player.pos.x, player.pos.y + 1, player.pos.z);
        m.timer -= dt;
        if(m.timer <= 0){
          m.turret.getWorldPosition(tmpA);
          // упреждение с ошибкой + низкая точность (разброс от дистанции)
          const lead = dist/WARSHIP.shellSpeed * rnd(WARSHIP.leadErr[0], WARSHIP.leadErr[1]);
          tmpB.copy(player.pos).addScaledVector(playerVel, lead);
          const sp = dist * WARSHIP.spread;
          tmpB.x += rnd(-sp, sp);
          tmpB.y += rnd(-sp, sp)*0.55;
          tmpB.z += rnd(-sp, sp);
          spawnShell(tmpA, tmpB);
          flakSound();
          particles.spawn(tmpA.x, tmpA.y, tmpA.z, { life:.1, s0:1.3, s1:2.2, r:1, g:.85, b:.5, a:.9 });
          m.burst--;
          if(m.burst <= 0){
            m.burst = WARSHIP.burst;
            m.timer = rnd(WARSHIP.reload[0], WARSHIP.reload[1]);
          } else {
            m.timer = WARSHIP.burstGap;
          }
        }
      } else {
        m.timer = Math.max(m.timer, 0.4);
      }
    }
  }

  // полёт снарядов
  for(let i=0;i<S_MAX;i++){
    const s = shells[i];
    if(s.life <= 0) continue;
    s.life -= dt;
    s.prev.copy(s.pos);
    s.pos.addScaledVector(s.vel, dt);
    if(s.life <= 0){
      if(s.pos.y < waterY(s.pos.x, s.pos.z, t))
        splash(s.pos.x, waterY(s.pos.x, s.pos.z, t), s.pos.z, 2, 0.3);
      else burst(i);
      killShell(i);
      continue;
    }
    if(s.pos.y < waterY(s.pos.x, s.pos.z, t)){
      splash(s.pos.x, waterY(s.pos.x, s.pos.z, t), s.pos.z, 2, 0.3);
      killShell(i);
      continue;
    }
    // прямое попадание в самолёт
    if(planeTarget && segDist2(s.prev.x,s.prev.y,s.prev.z, s.pos.x,s.pos.y,s.pos.z,
                               player.pos.x,player.pos.y,player.pos.z) < 16){
      burst(i);
      killShell(i);
      continue;
    }
    const m = shellMeshes[i];
    m.position.copy(s.pos);
    m.lookAt(tmpC.copy(s.pos).add(s.vel));
  }

  // дым подбитого самолёта
  if(state.vehicle==='plane' && !state.crashed && player.hp <= PLAYER_HP.smokeAt){
    smokeT -= dt;
    if(smokeT <= 0){
      smokeT = 0.06;
      const bx = player.pos.x - Math.sin(player.yaw)*3.5;
      const bz = player.pos.z - Math.cos(player.yaw)*3.5;
      particles.spawn(bx, player.pos.y, bz, {
        vx:rnd(-1,1), vy:rnd(1,2.5), vz:rnd(-1,1),
        life:rnd(1.5,3), s0:rnd(.8,1.4), s1:rnd(4,7),
        r:.25, g:.23, b:.25, a:.55 });
      if(player.hp <= 2){
        particles.spawn(bx, player.pos.y, bz, {
          vx:rnd(-.5,.5), vy:rnd(.5,1.5), vz:rnd(-.5,.5),
          life:rnd(.2,.5), s0:rnd(.6,1.2), s1:rnd(1.2,2),
          r:1, g:rnd(.35,.55), b:.1, a:.85 });
      }
    }
  }
  if(player.hp > PLAYER_HP.smokeAt) warned = false;
}