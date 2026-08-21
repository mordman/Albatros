import { player, state, game, distToPlayer } from './state.js';
import { world } from './world.js';
import { waterY } from './environment.js';
import { clamp } from './config.js';

const elSpd = document.getElementById('vSpd');
const elAlt = document.getElementById('vAlt');
const elOdo = document.getElementById('vOdo');
const elSt  = document.getElementById('status');
const elCap = document.getElementById('caption');
const elLAlt = document.getElementById('lAlt');
const elHpFill = document.getElementById('hpFill');
const cctx = document.getElementById('compass').getContext('2d');
const CARD = {0:'С',45:'СВ',90:'В',135:'ЮВ',180:'Ю',225:'ЮЗ',270:'З',315:'СЗ'};

let capTimer = 0, capCooldown = 0;

export function showCaption(txt, secs=3.2){
  elCap.textContent = txt;
  elCap.classList.add('show');
  capTimer = secs;
}
export const captionNow = showCaption;

function drawCompass(){
  cctx.clearRect(0,0,600,68);
  const heading = ((-player.yaw*180/Math.PI)%360+360)%360;
  cctx.strokeStyle='rgba(246,233,210,.28)';
  cctx.fillStyle='rgba(246,233,210,.55)';
  cctx.font='600 12px monospace';
  cctx.textAlign='center';
  for(let d=-60; d<=60; d+=5){
    const deg = ((Math.round((heading+d)/5)*5)%360+360)%360;
    let rel = deg - heading;
    if(rel>180) rel-=360; if(rel<-180) rel+=360;
    const x = 300 + rel*5;
    if(x<6 || x>594) continue;
    const major = deg%45===0;
    cctx.beginPath();
    cctx.moveTo(x, major?30:38); cctx.lineTo(x,48);
    cctx.stroke();
    if(major) cctx.fillText(CARD[deg] ?? deg, x, 22);
  }
  cctx.fillStyle='#ff9c5b';
  cctx.beginPath(); cctx.moveTo(300,30); cctx.lineTo(294,19); cctx.lineTo(306,19); cctx.closePath(); cctx.fill();
  cctx.fillStyle='#f6e9d2'; cctx.font='600 14px monospace';
  cctx.fillText(String(Math.round(heading)).padStart(3,'0')+'°', 300, 64);
}

function updateHPBar(){
  if(!elHpFill) return;
  const k = clamp(player.hp/player.hpMax, 0, 1);
  elHpFill.style.width = (k*100)+'%';
  elHpFill.style.background = k > 0.6 ? '#7ac74f' : k > 0.3 ? '#e8b13c' : '#e0533c';
}

export function updateHUD(dt, t){
  elSpd.textContent = Math.round(Math.abs(player.speed)*3.6);
  const subUnder = state.vehicle==='sub' && player.pos.y < waterY(player.pos.x, player.pos.z, t) - 1;
  if(subUnder){
    elLAlt.textContent = 'ГЛУБИНА';
    elAlt.textContent = Math.round(-player.pos.y);
  } else {
    elLAlt.textContent = 'ВЫСОТА';
    elAlt.textContent = Math.max(0, Math.round(player.pos.y));
  }
  elOdo.textContent = (player.odometer/1000).toFixed(1);
  updateHPBar();
  drawCompass();
  let txt = '';
  if(state.crashed) txt = 'АВАРИЯ';
  else if(state.paused) txt = 'ПАУЗА';
  else if(state.started){
    if(state.vehicle === 'boat'){
      if(player.boost && player.speed > 30) txt = 'ФОРСАЖ';
      else if(player.speed > 17) txt = 'ПОЛНЫЙ ХОД';
      else if(player.speed > 3) txt = 'МАЛЫЙ ХОД';
    } else if(state.vehicle === 'sub'){
      if(player.onFloor) txt = 'СКЛЬЗИТ ПО ГРУНТУ';
      else if(subUnder) txt = player.boost ? 'ФОРСАЖ ПОД ВОДОЙ' : 'ПОДВОДНЫЙ ХОД';
      else txt = 'НА ПОВЕРХНОСТИ';
    } else if(state.vehicle === 'moto'){
      if(player.airborne) txt = 'ПОЛЁТ!';
      else if(player.onRoad && player.pos.y > 10) txt = 'ПЕРЕЛЁТ ПО МОСТУ';
      else if(player.onRoad) txt = 'ТРАССА';
      else txt = 'ПЛЯЖ';
      if(player.boost && Math.abs(player.speed) > 40) txt = 'ФОРСАЖ';
    } else {
      if(player.hp <= 5 && player.hp > 0) txt = 'ПОВРЕЖДЁН';
      else if(player.pos.y - waterY(player.pos.x, player.pos.z, t) < 8) txt = 'БРЕЮЩИЙ ПОЛЁТ';
      else if(player.boost) txt = 'ФОРСАЖ';
    }
  }
  if(txt){ elSt.textContent = txt; elSt.classList.add('on'); }
  else elSt.classList.remove('on');
}

export function updateCaptions(dt){
  capTimer -= dt; capCooldown -= dt;
  if(capTimer > 0) return;
  if(capCooldown <= 0){
    let best = null, bd = 1e9;
    for(const e of world.entities){
      if(!e.label || !e.point || !e.capR || e.capDone) continue;
      const d = distToPlayer(e.point);
      if(d < e.capR && d < bd){ bd = d; best = e; }
    }
    if(best){
      const txt = typeof best.label === 'function' ? best.label() : best.label;
      if(txt){
        elCap.textContent = txt;
        elCap.classList.add('show');
        capTimer = 4.5; capCooldown = 1;
        best.capDone = true;
        return;
      }
    }
  }
  elCap.classList.remove('show');
  for(const e of world.entities){
    if(e.capDone && e.capR && distToPlayer(e.point) > e.capR*1.6) e.capDone = false;
  }
}