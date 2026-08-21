import * as THREE from 'three';
import { scene } from './engine.js';
import { SUN_DIR, FOG_C, FOG_D, UNDER_C, UNDER_D } from './config.js';

export const sky = new THREE.Mesh(
  new THREE.SphereGeometry(4600, 32, 16),
  new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite:false, fog:false,
    uniforms:{
      uSun:{ value: SUN_DIR },
      cTop:{ value: new THREE.Color(0.13,0.28,0.52) },
      cMid:{ value: new THREE.Color(0.93,0.55,0.34) },
      cHor:{ value: new THREE.Color(1.00,0.82,0.62) },
      cSun:{ value: new THREE.Color(1.00,0.87,0.65) },
    },
    vertexShader:`varying vec3 vW;
      void main(){ vW=(modelMatrix*vec4(position,1.)).xyz;
        gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }`,
    fragmentShader:`uniform vec3 uSun,cTop,cMid,cHor,cSun; varying vec3 vW;
      void main(){
        vec3 d=normalize(vW-cameraPosition); float h=d.y;
        vec3 col=mix(cHor,cMid,smoothstep(0.02,0.16,h));
        col=mix(col,cTop,smoothstep(0.12,0.58,h));
        col=mix(col,cHor*0.7,smoothstep(0.02,-0.25,h));
        float s=max(dot(d,uSun),0.0);
        col+=cSun*(pow(s,1400.0)*3.0+pow(s,80.0)*0.5+pow(s,6.0)*0.16);
        gl_FragColor=vec4(col,1.0);
      }`
  })
);
sky.renderOrder = -2;
scene.add(sky);

export function waterY(x, z, t){
  let h = 0;
  h += 1.05*Math.sin( 0.016*x + 0.008*z + 0.90*t);
  h += 0.62*Math.sin(-0.011*x + 0.014*z + 1.22*t);
  h += 0.34*Math.sin( 0.026*x - 0.019*z + 1.70*t);
  h += 0.18*Math.sin(-0.043*x - 0.031*z + 2.30*t);
  h += 0.09*Math.sin( 0.061*x + 0.052*z + 2.90*t);
  h += 0.05*Math.sin( 0.055*x + 0.048*z + 3.30*t);
  return h;
}

export const OCEAN_SIZE = 5200, OCEAN_SEG = 256, CELL = OCEAN_SIZE/OCEAN_SEG;
const oceanGeo = new THREE.PlaneGeometry(OCEAN_SIZE, OCEAN_SIZE, OCEAN_SEG, OCEAN_SEG);
oceanGeo.rotateX(-Math.PI/2);
export const oceanUni = {
  uTime:{ value:0 }, uSun:{ value:SUN_DIR }, uFog:{ value:FOG_D }, uFogC:{ value:FOG_C },
  uFogU:{ value:UNDER_D }, uUnderC:{ value:UNDER_C },
  uDeep:{ value:new THREE.Color('#0d3547') }, uCrest:{ value:new THREE.Color('#2e8f85') },
  uFoam:{ value:new THREE.Color(0.93,0.97,0.95) }, uSkyRef:{ value:new THREE.Color(0.58,0.56,0.53) },
  uSpec:{ value:new THREE.Color(1.0,0.84,0.58) },
};
export const ocean = new THREE.Mesh(oceanGeo, new THREE.ShaderMaterial({
  uniforms: oceanUni, side: THREE.DoubleSide,
  vertexShader:`
    uniform float uTime;
    varying vec3 vW; varying vec3 vN;
    float wH(vec2 p){
      float h=0.0;
      h+=1.05*sin(dot(p,vec2( 0.016, 0.008))+0.90*uTime);
      h+=0.62*sin(dot(p,vec2(-0.011, 0.014))+1.22*uTime);
      h+=0.34*sin(dot(p,vec2( 0.026,-0.019))+1.70*uTime);
      h+=0.18*sin(dot(p,vec2(-0.043,-0.031))+2.30*uTime);
      h+=0.09*sin(dot(p,vec2( 0.061, 0.052))+2.90*uTime);
      h+=0.05*sin(dot(p,vec2( 0.055, 0.048))+3.30*uTime);
      return h;
    }
    void main(){
      vec3 wp=(modelMatrix*vec4(position,1.)).xyz;
      wp.y+=wH(wp.xz);
      float e=2.2;
      float hx=wH(wp.xz+vec2(e,0.))-wH(wp.xz-vec2(e,0.));
      float hz=wH(wp.xz+vec2(0.,e))-wH(wp.xz-vec2(0.,e));
      vN=normalize(vec3(-hx,2.0*e,-hz));
      vW=wp;
      gl_Position=projectionMatrix*viewMatrix*vec4(wp,1.);
    }`,
  fragmentShader:`
    uniform vec3 uSun,uDeep,uCrest,uFoam,uFogC,uSkyRef,uSpec,uUnderC;
    uniform float uTime,uFog,uFogU;
    varying vec3 vW; varying vec3 vN;
    float hash(vec2 p){ return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453); }
    float vnoise(vec2 p){
      vec2 i=floor(p),f=fract(p); f=f*f*(3.0-2.0*f);
      return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),
                 mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y);
    }
    void main(){
      if(!gl_FrontFacing){
        vec3 col=mix(vec3(0.03,0.16,0.20),vec3(0.10,0.40,0.48),clamp(vW.y/2.2*0.5+0.5,0.0,1.0));
        vec3 V=normalize(cameraPosition-vW);
        float sunUp=max(dot(-V,uSun),0.0);
        col+=uSpec*pow(sunUp,50.0)*0.55;
        float d=distance(cameraPosition,vW);
        float f=1.0-exp(-uFogU*uFogU*d*d);
        col=mix(col,uUnderC,f);
        gl_FragColor=vec4(col,1.0);
        return;
      }
      vec3 N=normalize(vN);
      vec3 V=normalize(cameraPosition-vW);
      float fres=pow(1.0-max(dot(N,V),0.0),3.0);
      float hN=clamp(vW.y/2.2*0.5+0.5,0.0,1.0);
      vec3 col=mix(uDeep,uCrest,smoothstep(0.45,0.95,hN));
      col=mix(col,uSkyRef,fres*0.55);
      vec3 H=normalize(uSun+V);
      float ndh=max(dot(N,H),0.0);
      col+=uSpec*(pow(ndh,260.0)*2.4+pow(ndh,48.0)*0.35);
      float crest=vW.y+(vnoise(vW.xz*0.18+vec2(uTime*0.15))-0.5)*1.1;
      float foam=smoothstep(1.25,1.9,crest)*(0.5+0.5*vnoise(vW.xz*0.6-vec2(uTime*0.35)));
      col=mix(col,uFoam,clamp(foam,0.0,0.85));
      float d=distance(cameraPosition,vW);
      float f=1.0-exp(-uFog*uFog*d*d);
      col=mix(col,uFogC,f);
      gl_FragColor=vec4(col,1.0);
    }`
}));
scene.add(ocean);