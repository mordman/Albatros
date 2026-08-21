import * as THREE from 'three';
import { renderer, scene } from './engine.js';
import { FOG_D, WIND, rnd } from './config.js';

export class ParticlePool {
  constructor(max){
    this.max = max; this.cursor = 0;
    this.pos = new Float32Array(max*3);
    this.col = new Float32Array(max*4);
    this.size = new Float32Array(max);
    this.data = Array.from({length:max}, ()=>({life:0}));
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    g.setAttribute('aColor',   new THREE.BufferAttribute(this.col, 4));
    g.setAttribute('aSize',    new THREE.BufferAttribute(this.size, 1));
    this.points = new THREE.Points(g, new THREE.ShaderMaterial({
      transparent:true, depthWrite:false,
      uniforms:{ uPR:{ value: renderer.getPixelRatio() }, uFog2:{ value: FOG_D*FOG_D } },
      vertexShader:`
        attribute float aSize; attribute vec4 aColor;
        uniform float uPR,uFog2; varying vec4 vC; varying float vF;
        void main(){ vC=aColor;
          vec4 mv=modelViewMatrix*vec4(position,1.);
          vF=1.0-exp(-uFog2*mv.z*mv.z);
          float ps=aSize*(420.0/max(1.0,-mv.z));
          gl_PointSize=min(ps*uPR,260.0);
          gl_Position=projectionMatrix*mv; }`,
      fragmentShader:`
        varying vec4 vC; varying float vF;
        void main(){ vec2 u=gl_PointCoord*2.0-1.0; float d=dot(u,u);
          if(d>1.0) discard;
          gl_FragColor=vec4(vC.rgb,vC.a*smoothstep(1.0,0.45,d)*(1.0-vF)); }`
    }));
    this.points.frustumCulled = false;
    scene.add(this.points);
  }
  spawn(x,y,z,o){
    const i = this.cursor; this.cursor = (this.cursor+1)%this.max;
    const d = this.data[i];
    d.life = d.maxLife = o.life;
    d.x=x; d.y=y; d.z=z; d.vx=o.vx||0; d.vy=o.vy||0; d.vz=o.vz||0;
    d.s0=o.s0; d.s1=o.s1; d.r=o.r; d.g=o.g; d.b=o.b; d.a=o.a??1;
    d.grav=o.grav||0; d.drag=o.drag||0;
  }
  update(dt){
    for(let i=0;i<this.max;i++){
      const d = this.data[i];
      if(d.life > 0){
        d.life -= dt;
        d.vy += d.grav*dt;
        if(d.drag){ const k = Math.max(0, 1-d.drag*dt); d.vx*=k; d.vy*=k; d.vz*=k; }
        d.x += d.vx*dt; d.y += d.vy*dt; d.z += d.vz*dt;
        const k = 1 - Math.max(d.life,0)/d.maxLife;
        const fade = Math.min(k/0.12, 1) * (1-k);
        this.pos[i*3]=d.x; this.pos[i*3+1]=d.y; this.pos[i*3+2]=d.z;
        this.col[i*4]=d.r; this.col[i*4+1]=d.g; this.col[i*4+2]=d.b; this.col[i*4+3]=d.a*fade;
        this.size[i] = d.s0 + (d.s1-d.s0)*k;
      } else this.size[i] = 0;
    }
    const at = this.points.geometry.attributes;
    at.position.needsUpdate = at.aColor.needsUpdate = at.aSize.needsUpdate = true;
  }
}
export const particles = new ParticlePool(1800);
export const partU = particles.points.material.uniforms;

export function splash(x,y,z,n,power){
  for(let i=0;i<n;i++){
    const a = Math.random()*Math.PI*2, sp = rnd(3,9)*power;
    particles.spawn(x+rnd(-2,2), y, z+rnd(-2,2), {
      vx:Math.cos(a)*sp, vz:Math.sin(a)*sp, vy:rnd(8,20)*power,
      life:rnd(0.8,1.7), s0:rnd(1.5,3.2), s1:0.4,
      r:0.95, g:0.98, b:0.97, a:0.85, grav:-26, drag:0.5 });
  }
}
export function bubbles(x,y,z,n,sp){
  for(let i=0;i<n;i++)
    particles.spawn(x+rnd(-0.6,0.6), y+rnd(0,1), z+rnd(-0.6,0.6), {
      vx:rnd(-0.3,0.3), vy:rnd(0.8,2.2)*sp, vz:rnd(-0.3,0.3),
      life:rnd(1.5,3.5), s0:rnd(0.2,0.45), s1:rnd(0.3,0.6),
      r:0.85, g:0.93, b:0.97, a:0.5, drag:0.4 });
}
export function feathers(p){
  for(let i=0;i<9;i++)
    particles.spawn(p.x,p.y,p.z,{ vx:rnd(-3,3), vy:rnd(-1,2), vz:rnd(-3,3),
      life:rnd(1,2.2), s0:rnd(.4,.6), s1:rnd(.8,1.1),
      r:.95, g:.94, b:.88, a:.9, grav:-1.5, drag:1.2 });
}
export function explosion(x,y,z){
  particles.spawn(x,y,z,{ life:.2, s0:16, s1:24, r:1, g:.95, b:.85, a:.95 });
  for(let i=0;i<46;i++){
    const a=rnd(0,6.28), b=rnd(-1,1), sp=rnd(4,20), q=Math.sqrt(1-b*b);
    particles.spawn(x,y,z,{ vx:Math.cos(a)*sp*q, vy:b*sp, vz:Math.sin(a)*sp*q,
      life:rnd(.35,1), s0:rnd(1.5,3.5), s1:rnd(4,7),
      r:1, g:rnd(.4,.65), b:.12, a:.9, drag:2.5 });
  }
  for(let i=0;i<26;i++)
    particles.spawn(x+rnd(-2,2),y+rnd(-1,2),z+rnd(-2,2),{
      vx:WIND.x+rnd(-1,1), vy:rnd(2,6), vz:WIND.z+rnd(-1,1),
      life:rnd(2,4), s0:rnd(1.5,2.5), s1:12, r:.22, g:.21, b:.23, a:.55 });
  for(let i=0;i<18;i++){
    const a=rnd(0,6.28), sp=rnd(22,38);
    particles.spawn(x,y,z,{ vx:Math.cos(a)*sp, vy:rnd(4,26), vz:Math.sin(a)*sp,
      life:rnd(.5,1.1), s0:.5, s1:.15, r:1, g:.85, b:.3, a:1, grav:-28 });
  }
}