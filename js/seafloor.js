import * as THREE from 'three';
import { scene } from './engine.js';
import { UNDER_C, UNDER_D } from './config.js';
import { world } from './world.js';

export function seafloorY(x, z){
  let y = -102
    + 20*Math.sin(x*0.0019 + z*0.0016 + 1.7)
    + 12*Math.sin(x*0.0041 - z*0.0032 + 0.6)
    +  7*Math.sin(x*0.0093 + z*0.0078 + 3.9)
    +  3*Math.sin(x*0.021  - z*0.017  + 2.2);
  for(const isl of world.islands){
    const ir = (isl.colType === 'city') ? isl.R*0.9 : isl.r;
    const dx = x - isl.point.x, dz = z - isl.point.z;
    const q = (dx*dx + dz*dz)/(ir*ir);
    if(q < 9) y += 88*Math.exp(-q*1.6);
  }
  return y;
}

const SEA_SIZE = 1300, SEA_SEG = 110;
const seafloorGeo = new THREE.PlaneGeometry(SEA_SIZE, SEA_SIZE, SEA_SEG, SEA_SEG);
seafloorGeo.rotateX(-Math.PI/2);
export const seafloorUni = { uTime:{ value:0 }, uFogC:{ value:UNDER_C }, uFogD:{ value:UNDER_D } };
const seafloor = new THREE.Mesh(seafloorGeo, new THREE.ShaderMaterial({
  uniforms: seafloorUni,
  vertexShader:`
    varying vec3 vW;
    void main(){
      vW = (modelMatrix*vec4(position,1.)).xyz;
      gl_Position = projectionMatrix*viewMatrix*vec4(vW,1.);
    }`,
  fragmentShader:`
    uniform vec3 uFogC; uniform float uFogD, uTime;
    varying vec3 vW;
    float hash(vec2 p){ return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453); }
    float vnoise(vec2 p){
      vec2 i=floor(p),f=fract(p); f=f*f*(3.0-2.0*f);
      return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),
                 mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y);
    }
    void main(){
      float n1 = vnoise(vW.xz*0.011);
      float n2 = vnoise(vW.xz*0.045);
      vec3 col = mix(vec3(0.30,0.27,0.21), vec3(0.20,0.22,0.19), n1);
      col = mix(col, vec3(0.15,0.17,0.16), smoothstep(0.6,0.8,n2));
      float c1 = vnoise(vW.xz*0.12 + vec2(uTime*0.20, uTime*0.16));
      float c2 = vnoise(vW.xz*0.12 - vec2(uTime*0.17, -uTime*0.12));
      float ca = pow(max(c1*c2 - 0.15, 0.0), 2.0);
      col += vec3(0.15,0.30,0.30)*ca*2.2;
      float d = distance(cameraPosition, vW);
      float f = 1.0 - exp(-uFogD*uFogD*d*d);
      col = mix(col, uFogC, f);
      gl_FragColor = vec4(col, 1.0);
    }`
}));
scene.add(seafloor);

let seaAnchor = { x:1e9, z:1e9 };
export function resetSeaAnchor(){ seaAnchor = { x:1e9, z:1e9 }; }
export function snapSeafloor(px, pz){
  const ax = Math.round(px/50)*50, az = Math.round(pz/50)*50;
  if(ax === seaAnchor.x && az === seaAnchor.z) return;
  seaAnchor = { x:ax, z:az };
  seafloor.position.set(ax, 0, az);
  const p = seafloorGeo.attributes.position;
  for(let i=0;i<p.count;i++)
    p.setY(i, seafloorY(ax + p.getX(i), az + p.getZ(i)));
  p.needsUpdate = true;
}