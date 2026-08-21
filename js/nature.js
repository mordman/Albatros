import * as THREE from 'three';
import { M } from './materials.js';
import { rnd } from './config.js';

export function makePalm(){
  const g = new THREE.Group();
  const bend = rnd(0.6, 1.4), dirA = rnd(0, Math.PI*2);
  const bx = Math.cos(dirA), bz = Math.sin(dirA);
  const trunkGeo = new THREE.CylinderGeometry(0.13, 0.3, 6.2, 7, 6);
  { const p = trunkGeo.attributes.position;
    for(let i=0;i<p.count;i++){
      const y = p.getY(i), k = Math.pow((y+3.1)/6.2, 2);
      p.setX(i, p.getX(i) + bx*k*bend);
      p.setZ(i, p.getZ(i) + bz*k*bend);
    }
    trunkGeo.computeVertexNormals(); }
  const trunk = new THREE.Mesh(trunkGeo, M.trunk);
  trunk.position.y = 3.1; g.add(trunk);
  const crown = new THREE.Group();
  crown.position.set(bx*bend, 6.2, bz*bend); g.add(crown);
  const leafGeo = new THREE.PlaneGeometry(0.95, 3.4, 2, 6);
  { const pp = leafGeo.attributes.position;
    for(let i=0;i<pp.count;i++){ const y = pp.getY(i);
      pp.setZ(i, -Math.pow((y+1.7)/3.4, 2)*1.6); }
    leafGeo.computeVertexNormals();
    leafGeo.translate(0, 1.7, 0);
    leafGeo.rotateX(-Math.PI/2); }
  for(let i=0;i<7;i++){
    const leaf = new THREE.Mesh(leafGeo, M.leaf);
    leaf.rotation.order = 'YXZ';
    leaf.rotation.y = i*(Math.PI*2/7) + rnd(-0.2,0.2);
    leaf.rotation.z = rnd(-0.1,0.3);
    crown.add(leaf);
  }
  for(let i=0;i<3;i++){
    const c = new THREE.Mesh(new THREE.SphereGeometry(0.18,6,5), M.trunk);
    c.position.set(rnd(-0.3,0.3), -0.15, rnd(-0.3,0.3));
    crown.add(c);
  }
  g.userData = { crown };
  return g;
}

export function makeLighthouse(){
  const g = new THREE.Group();
  const tower = new THREE.Mesh(new THREE.CylinderGeometry(1.5,2.1,9,14), M.white);
  tower.position.y = 4.5; g.add(tower);
  for(const y of [2.3, 6.3]){
    const band = new THREE.Mesh(new THREE.CylinderGeometry(2.0-y*0.03,2.1-y*0.03,1.8,14), M.red);
    band.position.y = y; g.add(band);
  }
  const gal = new THREE.Mesh(new THREE.CylinderGeometry(1.9,1.9,0.35,14), M.dark);
  gal.position.y = 9.2; g.add(gal);
  const rail = new THREE.Mesh(new THREE.TorusGeometry(1.75, 0.05, 5, 16), M.dark);
  rail.rotation.x = Math.PI/2; rail.position.y = 9.9; g.add(rail);
  for(let i=0;i<8;i++){
    const a = i/8*Math.PI*2;
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.04,0.04,0.8,4), M.dark);
    post.position.set(Math.cos(a)*1.7, 9.55, Math.sin(a)*1.7);
    g.add(post);
  }
  const cage = new THREE.Mesh(new THREE.CylinderGeometry(1.05,1.05,1.5,10), M.dark);
  cage.position.y = 10.1; g.add(cage);
  const lampM = new THREE.Mesh(new THREE.CylinderGeometry(0.75,0.75,1.3,10), M.lamp);
  lampM.position.y = 10.1; g.add(lampM);
  const roof = new THREE.Mesh(new THREE.ConeGeometry(1.35,1.0,10), M.dark);
  roof.position.y = 11.3; g.add(roof);
  const beams = new THREE.Group(); beams.position.y = 10.1; g.add(beams);
  const beamGeo = new THREE.ConeGeometry(2.6,420,10,1,true);
  beamGeo.translate(0,-210,0);
  const beamMat = new THREE.MeshBasicMaterial({ color:0xffe9b0, transparent:true, opacity:0.09,
    blending:THREE.AdditiveBlending, depthWrite:false, fog:false, side:THREE.DoubleSide });
  for(const a of [0, Math.PI]){
    const b = new THREE.Mesh(beamGeo, beamMat);
    b.rotation.order = 'YXZ';
    b.rotation.z = Math.PI/2;
    b.rotation.y = a;
    beams.add(b);
  }
  g.userData = { beams };
  return g;
}