import { clamp, BOAT, SUB } from './config.js';
import { state, player } from './state.js';

let audio = null, audioOn = true;

export function isAudioOn(){ return audioOn; }
export function toggleAudioBtn(btn){
  audioOn = !audioOn;
  btn.classList.toggle('muted', !audioOn);
}

export function initAudio(){
  if(audio) return;
  const ctx = new (window.AudioContext || window.webkitAudioContext)();
  const len = ctx.sampleRate*2;
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const data = buf.getChannelData(0);
  let last = 0;
  for(let i=0;i<len;i++){
    const w = Math.random()*2-1;
    last = (last + 0.02*w)/1.02;
    data[i] = last*3.0;
  }
  const src = ctx.createBufferSource(); src.buffer = buf; src.loop = true;
  const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 420;
  const wind = ctx.createGain(); wind.gain.value = 0;
  src.connect(lp); lp.connect(wind);
  const osc = ctx.createOscillator(); osc.type = 'sawtooth'; osc.frequency.value = 55;
  const og = ctx.createGain(); og.gain.value = 0;
  osc.connect(og);
  const comp = ctx.createDynamicsCompressor();
  const master = ctx.createGain(); master.gain.value = 1;
  wind.connect(comp); og.connect(comp); comp.connect(master); master.connect(ctx.destination);
  src.start(); osc.start();
  ctx.resume();
  audio = { ctx, wind, osc, og, lp };
}

export function boomSound(){
  if(!audio) return;
  const ctx = audio.ctx;
  const len = Math.floor(ctx.sampleRate*0.9);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for(let i=0;i<len;i++) d[i] = (Math.random()*2-1)*Math.pow(1 - i/len, 2.2);
  const src = ctx.createBufferSource(); src.buffer = buf;
  const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 260;
  const g = ctx.createGain(); g.gain.value = 1.4;
  src.connect(f); f.connect(g); g.connect(ctx.destination);
  src.start();
}

export function updateAudio(camUnder){
  if(!audio) return;
  const on = audioOn && !state.paused;
  const now = audio.ctx.currentTime;
  const g = on ? clamp(0.04 + (Math.abs(player.speed)/92)*0.16 + Math.max(0,10-player.pos.y)*0.01, 0, 0.3) : 0;
  audio.wind.gain.setTargetAtTime(camUnder ? g*0.7 : g, now, 0.2);
  audio.lp.frequency.setTargetAtTime(camUnder ? 150 : 420, now, 0.25);
  if(state.vehicle === 'boat'){
    const thr = clamp(Math.abs(player.speed)/BOAT.maxB, 0, 1);
    audio.osc.frequency.setTargetAtTime(26 + thr*74, now, 0.12);
    audio.og.gain.setTargetAtTime(state.started && on && !state.crashed ? 0.02 + thr*0.03 : 0, now, 0.15);
  } else if(state.vehicle === 'sub'){
    const thr = clamp(player.speed/SUB.boost, 0, 1);
    audio.osc.frequency.setTargetAtTime(22 + thr*18, now, 0.2);
    audio.og.gain.setTargetAtTime(state.started && on && !state.crashed ? 0.015 + thr*0.015 : 0, now, 0.2);
  } else if(state.vehicle === 'moto'){
    const thr = clamp(Math.abs(player.speed)/58, 0, 1);
    audio.osc.frequency.setTargetAtTime(30 + thr*95, now, 0.08);
    audio.og.gain.setTargetAtTime(state.started && on && !state.crashed ? 0.015 + thr*0.03 : 0, now, 0.1);
  } else {
    audio.osc.frequency.setTargetAtTime(38 + player.speed*0.75, now, 0.15);
    audio.og.gain.setTargetAtTime(state.started && on && !state.crashed ? 0.012 + player.speed*0.00016 : 0, now, 0.2);
  }
}