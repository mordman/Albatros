import * as THREE from 'three';
import { M, mat } from './materials.js';

export const colHelpers = [];
export function setDebugCols(on){ for(const h of colHelpers) h.visible = on; }

export function colBox(parent, w, h, l, x=0, y=0, z=0){
  const m = new THREE.LineSegments(
    new THREE.EdgesGeometry(new THREE.BoxGeometry(w,h,l)),
    new THREE.LineBasicMaterial({ color:0x44ff88, transparent:true, opacity:.75 }));
  m.position.set(x,y,z); m.visible = false;
  parent.add(m); colHelpers.push(m);
  return m;
}

export function strutBetween(ax,ay,az,bx,by,bz,r,mm){
  const d = new THREE.Vector3(bx-ax,by-ay,bz-az), len = d.length();
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r,r,len,5), mm);
  m.position.set((ax+bx)/2,(ay+by)/2,(az+bz)/2);
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0), d.normalize());
  return m;
}

export function wingGeo(span, chord, th, taper, dih, sweep){
  const g = new THREE.BoxGeometry(span, th, chord, 10, 1, 3);
  const p = g.attributes.position;
  for(let i=0;i<p.count;i++){
    const t = Math.abs(p.getX(i))/(span/2);
    p.setZ(i, p.getZ(i)*(1 - t*t*taper) + t*t*sweep);
    p.setY(i, p.getY(i)*(1 - t*0.45) + t*t*dih);
  }
  g.computeVertexNormals();
  return g;
}

export function makeHull(L, Wd, H, material){
  const g = new THREE.BoxGeometry(Wd, H, L, 8, 4, 18);
  const p = g.attributes.position;
  for(let i=0;i<p.count;i++){
    let x = p.getX(i), y = p.getY(i);
    const z = p.getZ(i);
    const t = Math.abs(z)/(L/2);
    const bow = z > 0;
    const taper = 1 - (bow ? 0.88 : 0.5)*Math.pow(t, 2.8);
    let keel = 1;
    if(bow) keel = 1 - 0.85*Math.pow(Math.max(t-0.35,0)/0.65, 2);
    else    keel = 1 - 0.5 *Math.pow(Math.max(t-0.6, 0)/0.4, 2);
    x *= taper;
    if(y < 0){
      const d = -y/(H/2);
      x *= 1 - d*d*0.62*keel;
      y *= keel;
    }
    if(y > 0) y += Math.pow(t, 2.2)*H*(bow ? 0.30 : 0.16);
    if(bow && t > 0.55) y += Math.pow((t-0.55)/0.45, 2)*H*0.5;
    p.setX(i, x); p.setY(i, y);
  }
  g.computeVertexNormals();
  return new THREE.Mesh(g, material);
}

export function makeSail(w, h){
  const g = new THREE.PlaneGeometry(w, h, 12, 6);
  const p = g.attributes.position;
  for(let i=0;i<p.count;i++){
    const x = p.getX(i), y = p.getY(i);
    const u = x/w + 0.5, v = y/h + 0.5;
    p.setZ(i, Math.sin(u*Math.PI) * w*0.15 * (0.3 + 0.7*Math.sin(v*Math.PI*0.85 + 0.15)));
  }
  g.computeVertexNormals();
  return new THREE.Mesh(g, M.sail);
}

export const mast = (h)=> new THREE.Mesh(new THREE.CylinderGeometry(0.14,0.2,h,10), M.woodDark);
export const yard = (w)=>{ const y = new THREE.Mesh(new THREE.CylinderGeometry(0.08,0.08,w,8), M.woodDark);
  y.rotation.z = Math.PI/2; return y; };
export const flagMesh = ()=> new THREE.Mesh(new THREE.PlaneGeometry(1.5,0.8), mat(0xb4432f,{ds:1}));