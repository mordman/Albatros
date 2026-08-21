import * as THREE from 'three';
import { renderer, scene, camera } from './engine.js';
import { sky, ocean, oceanUni, waterY, CELL } from './environment.js';
import { clamp, BOAT, SUB, UNDER_C, UNDER_D, FOG_C, FOG_D, rnd } from './config.js';
import { player, state, game } from './state.js';
import { world } from './world.js';
import { M } from './materials.js';
import { particles, partU } from './particles.js';
import { seafloorUni, snapSeafloor, seafloorY } from './seafloor.js';
import { setDebugCols } from './helpers.js';
import './populate.js';
import { updatePlayer, switchVehicle, setVehicle, keys, SG } from './vehicles.js';
import { checkCollisions, updateDebris, respawn, crashPos } from './collisions.js';
import { updateHUD, updateCaptions, showCaption } from './hud.js';
import { initAudio, updateAudio, toggleAudioBtn } from './audio.js';
import { archSpawn } from './arch.js';

/* ===== МЕНЮ / КНОПКИ ===== */
const menu = document.getElementById('menu');
const btnSound = document.getElementById('btnSound');
const btnPause = document.getElementById('btnPause');
const startBtn = document.getElementById('startBtn');

document.querySelectorAll('.vcard').forEach(c=>{
  c.addEventListener('click', ()=>{
    if(state.crashed) return;
    document.querySelectorAll('.vcard').forEach(x=>x.classList.remove('sel'));
    c.classList.add('sel');
    setVehicle(c.dataset.v);
    startBtn.textContent = c.dataset.v === 'plane' ? 'ВЗЛЕТЕТЬ'
      : c.dataset.v === 'boat' ? 'ОТПЛЫТЬ'
      : c.dataset.v === 'sub' ? 'ПОГРУЗИТЬСЯ' : 'ПОКАТИТЬ';
  });
});

function togglePause(force){
  if(!state.started) return;
  state.paused = (force !== undefined) ? force : !state.paused;
  btnPause.classList.toggle('active', state.paused);
}

startBtn.addEventListener('click', ()=>{
  state.started = true;
  state.autopilot = false;
  if(state.vehicle === 'boat'){
    player.speed = 0;
    player.pos.y = waterY(player.pos.x, player.pos.z, game.simT) + BOAT.draft;
  } else if(state.vehicle === 'sub'){
    player.speed = SUB.cruise;
    player.pos.y = clamp(seafloorY(player.pos.x, player.pos.z) + 26, -95, -14);
  } else if(state.vehicle === 'moto'){
    const sp = archSpawn();
    player.pos.set(sp.x, sp.h + 0.5, sp.z);
    player.yaw = sp.yaw;
    player.speed = 10;
  } else {
    player.speed = 44;
  }
  menu.classList.add('hidden');
  document.getElementById('hud').classList.add('on');
  try{ initAudio(); }catch(e){}
});
btnSound.addEventListener('click', ()=> toggleAudioBtn(btnSound));
btnPause.addEventListener('click', ()=> togglePause());

/* ===== ВВОД ===== */
let debugCols = false;
addEventListener('keydown', e=>{
  keys[e.code] = true;
  if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space'].includes(e.code)) e.preventDefault();
  if(e.code === 'Escape' && state.started) togglePause();
  if(e.code === 'KeyB'){ debugCols = !debugCols; setDebugCols(debugCols); }
  if(e.code === 'KeyV') switchVehicle();
});
addEventListener('keyup', e=> keys[e.code] = false);
addEventListener('blur', ()=> { for(const k in keys) keys[k] = false; });
addEventListener('resize', ()=>{
  camera.aspect = innerWidth/innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

/* ===== ГЛАВНЫЙ ЦИКЛ ===== */
const clock = new THREE.Clock();
let camUnder = false, snowT = 0;

function animate(){
  requestAnimationFrame(animate);
  const rawDt = Math.min(clock.getDelta(), 0.05);
  if(game.slowT > 0) game.slowT -= rawDt;
  const ts = game.slowT > 0 ? 0.35 : 1;
  const dt = state.paused ? 0 : rawDt*ts;
  game.simT += dt;
  if(!state.paused && game.birdCD > 0) game.birdCD -= rawDt;

  oceanUni.uTime.value = game.simT;
  seafloorUni.uTime.value = game.simT;
  M.beacon.emissiveIntensity = 1.4 + Math.sin(game.simT*4)*1.2;

  updatePlayer(dt, game.simT);
  for(const e of world.entities) e.update(dt, game.simT);
  particles.update(dt);
  updateDebris(dt, game.simT);
  checkCollisions(game.simT);
  if(state.crashed){
    game.respawnT -= rawDt;
    if(game.respawnT <= 0) respawn();
  }

  // надводный/подводный режим
  camUnder = camera.position.y < waterY(camera.position.x, camera.position.z, game.simT) - 0.25;
  scene.fog.color.copy(camUnder ? UNDER_C : FOG_C);
  scene.fog.density = camUnder ? UNDER_D : FOG_D;
  partU.uFog2.value = (camUnder ? UNDER_D : FOG_D)**2;
  renderer.setClearColor(camUnder ? UNDER_C : FOG_C);
  sky.visible = !camUnder;

  // прожекторы батискафа
  const deep = state.vehicle==='sub' && !state.crashed && player.pos.y < -10;
  const sInt = deep ? 140 : 0;
  SG.spots.forEach(s=>{ s.intensity = sInt; });
  SG.cones.forEach(c=>{ c.visible = deep; });
  SG.lenses.forEach(l=>{ l.material.emissiveIntensity = deep ? 2.2 : 0.4; });

  // «морской снег»
  if(state.vehicle==='sub' && !state.crashed && player.pos.y < -6){
    snowT -= dt;
    if(snowT <= 0){
      snowT = 0.05;
      for(let i=0;i<2;i++){
        const a = rnd(0,6.28), r = rnd(6,42);
        particles.spawn(
          player.pos.x + Math.sin(player.yaw)*rnd(-20,40) + Math.cos(a)*r,
          player.pos.y + rnd(-18,14),
          player.pos.z + Math.cos(player.yaw)*rnd(-20,40) + Math.sin(a)*r,
          { vx:rnd(-0.1,0.1), vy:rnd(-0.4,-0.1), vz:rnd(-0.1,0.1),
            life:rnd(3,6), s0:rnd(0.07,0.16), s1:rnd(0.07,0.16),
            r:0.9, g:0.95, b:0.95, a:0.5 });
      }
    }
  }

  sky.position.copy(camera.position);
  ocean.position.x = Math.round(player.pos.x/CELL)*CELL;
  ocean.position.z = Math.round(player.pos.z/CELL)*CELL;
  snapSeafloor(player.pos.x, player.pos.z);

  if(game.shake > 0){
    game.shake = Math.max(0, game.shake - rawDt*1.2);
    camera.position.x += (Math.random()-0.5)*game.shake*1.8;
    camera.position.y += (Math.random()-0.5)*game.shake*1.3;
    camera.position.z += (Math.random()-0.5)*game.shake*1.8;
  }

  updateHUD(dt, game.simT);
  updateCaptions(dt);
  updateAudio(camUnder);
  renderer.render(scene, camera);
}
animate();