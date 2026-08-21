import * as THREE from 'three';
import { PLAYER_HP } from './config.js';

export const player = {
  pos: new THREE.Vector3(0, 52, 0),
  yaw: 0, pitch: 0, bank: 0, steerVis: 0, vy: 0,
  speed: 30, odometer: 0, boost: false,
  onFloor:false, onRoad:false, airborne:false,
  hp: PLAYER_HP.max, hpMax: PLAYER_HP.max,
};
export const state = { started:false, autopilot:true, paused:false, crashed:false, vehicle:'plane' };
export const game = { simT:0, shake:0, slowT:0, respawnT:0, birdCD:0 };

export const distToPlayer = p => Math.hypot(p.x-player.pos.x, p.z-player.pos.z);

export function placeAhead(p, minD, maxD, spread, avoid){
  for(let k=0;k<30;k++){
    const a = player.yaw + (Math.random()-0.5)*spread;
    const d = minD + Math.random()*(maxD-minD);
    const x = player.pos.x + Math.sin(a)*d;
    const z = player.pos.z + Math.cos(a)*d;
    if(!avoid || avoid.every(o=>{
      const dx=o.point.x-x, dz=o.point.z-z; return dx*dx+dz*dz > o.clear*o.clear; })){
      p.x=x; p.z=z; return;
    }
  }
  p.x = player.pos.x + Math.sin(player.yaw)*maxD;
  p.z = player.pos.z + Math.cos(player.yaw)*maxD;
}