import * as THREE from 'three';
import { rnd } from './config.js';
import { scene } from './engine.js';
import { M, mat } from './materials.js';
import { colBox, strutBetween, mast, makeHull } from './helpers.js';
import { makeBuilding, makeHouse, makeChurch, makeWaterTower, makeTree, makeLamp,
         hipRoof, rampMesh, makePier, makeMooredBoat, makeWarehouse, makeCrane,
         makeContainerStack } from './citykit.js';
import { makePalm, makeLighthouse } from './nature.js';
import { waterY } from './environment.js';
import { particles } from './particles.js';
import { world } from './world.js';
import { distToPlayer, placeAhead } from './state.js';
import { registerBuildings, bboxFor } from './buildings.js';
import { spawnCityPedestrians } from './pedestrians.js';

const tmpV = new THREE.Vector3();

export function makeCityIsland(name, portA){
  const g = new THREE.Group();
  const R = rnd(105, 150);
  const H = rnd(16, 26);
  if(portA === undefined) portA = rnd(0, Math.PI*2);
  const dir  = { x: Math.sin(portA), z: Math.cos(portA) };
  const perp = { x: dir.z, z: -dir.x };

  const base = new THREE.Mesh(new THREE.CylinderGeometry(R*0.92, R*1.04, 5, 20, 2), M.rock);
  base.position.y = 2.5; g.add(base);
  const beach = new THREE.Mesh(new THREE.CylinderGeometry(R+7, R+13, 2.4, 20), M.sand);
  beach.position.y = 0.5; g.add(beach);

  const townY = 5 + H;
  const hillR = R*0.66;
  const Rp = hillR*0.66;
  const hillPos = { x: -dir.x*R*0.3, z: -dir.z*R*0.3 };
  const hillGeo = new THREE.CylinderGeometry(Rp*0.97, hillR, townY-3.5, 14, 4);
  { const p = hillGeo.attributes.position;
    const s1 = rnd(0,10), s2 = rnd(0,10);
    for(let i=0;i<p.count;i++){
      const a = Math.atan2(p.getZ(i), p.getX(i));
      const k = 1 + Math.sin(a*3+s1)*0.07 + Math.sin(a*6+s2)*0.04;
      p.setX(i, p.getX(i)*k); p.setZ(i, p.getZ(i)*k);
      if(p.getY(i) < 0) p.setY(i, p.getY(i) + Math.sin(a*4+s2)*1.4);
    } hillGeo.computeVertexNormals(); }
  const hill = new THREE.Mesh(hillGeo, M.rock);
  hill.position.set(hillPos.x, 3.5 + (townY-3.5)/2, hillPos.z);
  g.add(hill);
  const townDisc = new THREE.Mesh(new THREE.CylinderGeometry(Rp, Rp*0.88, 1.2, 18), M.townGround);
  townDisc.position.set(hillPos.x, townY - 0.6, hillPos.z);
  g.add(townDisc);

  for(const rot of [0, Math.PI/2]){
    const road = new THREE.Mesh(new THREE.BoxGeometry(4.5, 0.14, Rp*1.8), M.asphalt);
    road.position.set(hillPos.x, townY + 0.09, hillPos.z);
    road.rotation.y = rot;
    g.add(road);
  }
  for(let i=-2;i<=2;i++){
    if(i===0) continue;
    const l1 = makeLamp(); l1.position.set(hillPos.x + 3.2, townY, hillPos.z + i*Rp*0.42); g.add(l1);
    const l2 = makeLamp(); l2.position.set(hillPos.x + i*Rp*0.42, townY, hillPos.z + 3.2); g.add(l2);
  }

  const chA = rnd(0, Math.PI*2);
  const chOff = { x: Math.sin(chA)*Rp*0.7, z: Math.cos(chA)*Rp*0.7 };
  const church = makeChurch();
  church.position.set(hillPos.x + chOff.x, townY, hillPos.z + chOff.z);
  church.rotation.y = rnd(0, Math.PI*2);
  g.add(church);
  const wtOff = { x: -chOff.x*0.9, z: -chOff.z*0.9 };
  const wt = makeWaterTower();
  wt.position.set(hillPos.x + wtOff.x, townY, hillPos.z + wtOff.z);
  g.add(wt);

  let maxBH = 0;
  const blds = [];
  const step = 16;
  for(let gx=-Rp+8; gx<=Rp-8; gx+=step)
    for(let gz=-Rp+8; gz<=Rp-8; gz+=step){
      const rr = Math.hypot(gx, gz)/Rp;
      if(rr > 0.96) continue;
      if(Math.abs(gx) < 7 || Math.abs(gz) < 7) continue;
      if(Math.hypot(gx-chOff.x, gz-chOff.z) < 15) continue;
      if(Math.hypot(gx-wtOff.x, gz-wtOff.z) < 10) continue;
      const central = 1 - rr;
      if(Math.random() > 0.28 + central*0.72) continue;
      const rotY = (Math.abs(gx) > Math.abs(gz) ? 0 : Math.PI/2) + rnd(-0.05, 0.05);
      const px = hillPos.x + gx + rnd(-2.5, 2.5), pz = hillPos.z + gz + rnd(-2.5, 2.5);
      if(central > 0.5 && Math.random() < 0.75){
        const bw = rnd(8, 12), bd = rnd(8, 12);
        const bh = 13 + central*central*rnd(22, 58) + rnd(0, 8);
        maxBH = Math.max(maxBH, bh);
        const b = makeBuilding(bw, bh, bd);
        b.position.set(px, townY + bh/2, pz);
        b.rotation.y = rotY;
        if(bh > 38 && Math.random() < 0.85){
          const ant = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.18, 7, 5), M.dark);
          ant.position.y = bh/2 + 3.5; b.add(ant);
          const bc = new THREE.Mesh(new THREE.SphereGeometry(0.45, 8, 6), M.beacon);
          bc.position.y = bh/2 + 7.2; b.add(bc);
        }
        g.add(b);
        const bb = bboxFor(bw, bd, rotY);
        blds.push({ x:px, z:pz, y0:townY-1, y1:townY+bh, hw:bb.hw+0.4, hd:bb.hd+0.4 });
      } else {
        const bw = rnd(6, 9), bd = rnd(6, 9), bh = rnd(6.5, 11);
        const b = makeHouse(bw, bh, bd);
        b.position.set(px, townY, pz);
        b.rotation.y = rotY;
        g.add(b);
        const bb = bboxFor(bw, bd, rotY);
        blds.push({ x:px, z:pz, y0:townY-1, y1:townY+bh+2.2, hw:bb.hw+0.4, hd:bb.hd+0.4 });
      }
    }
  // церковь и водонапорная башня — тоже твёрдые
  blds.push({ x:hillPos.x+chOff.x, z:hillPos.z+chOff.z, y0:townY-1, y1:townY+27, hw:3.4, hd:8.2 });
  blds.push({ x:hillPos.x+wtOff.x, z:hillPos.z+wtOff.z, y0:townY-1, y1:townY+15, hw:3.2, hd:3.2 });

  {
    const mastG = new THREE.Group();
    const mp = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.22, 32, 8), M.dark);
    mp.position.y = 16; mastG.add(mp);
    for(let i=0;i<3;i++){
      const a = i/3*Math.PI*2;
      mastG.add(strutBetween(0,30,0, Math.cos(a)*9, 0, Math.sin(a)*9, 0.02, M.dark));
    }
    const mbc = new THREE.Mesh(new THREE.SphereGeometry(0.4,8,6), M.beacon);
    mbc.position.y = 32.4; mastG.add(mbc);
    mastG.position.set(hillPos.x - Rp*0.9, townY, hillPos.z + Rp*0.35);
    g.add(mastG);
    maxBH = Math.max(maxBH, 33);
  }

  for(let i=0;i<7;i++){
    const a = rnd(0, Math.PI*2);
    const tr = makeTree();
    tr.position.set(hillPos.x + Math.sin(a)*Rp*rnd(0.82, 0.98), townY, hillPos.z + Math.cos(a)*Rp*rnd(0.82, 0.98));
    g.add(tr);
  }

  {
    const p0x = dir.x*R*0.6, p0z = dir.z*R*0.6;
    const mx = (p0x + hillPos.x)/2 + perp.x*R*0.28;
    const mz = (p0z + hillPos.z)/2 + perp.z*R*0.28;
    const my = (5 + townY)/2;
    const p1x = hillPos.x + dir.x*Rp*0.92, p1z = hillPos.z + dir.z*Rp*0.92;
    g.add(rampMesh(p0x, 5, p0z, mx, my, mz, 6));
    g.add(rampMesh(mx, my, mz, p1x, townY, p1z, 6));
  }

  const px = dir.x*R*0.5, pz = dir.z*R*0.5;
  const pier = makePier(55);
  pier.rotation.y = portA;
  pier.position.set(dir.x*R*0.7, 0, dir.z*R*0.7);
  g.add(pier);
  const boats = [];
  for(let i=0;i<3;i++){
    const side = (i%2 ? 1 : -1);
    const mb = makeMooredBoat(mast, makeHull);
    mb.position.set(side*7.4, 0, 14 + i*13);
    mb.rotation.y = Math.PI + rnd(-0.15, 0.15);
    pier.add(mb);
    boats.push({ mesh: mb, ph: rnd(0, 10) });
  }
  const wh1 = makeWarehouse(); wh1.rotation.y = portA;
  wh1.position.set(px + perp.x*R*0.24, 5, pz + perp.z*R*0.24); g.add(wh1);
  const wh2 = makeWarehouse(); wh2.rotation.y = portA;
  wh2.position.set(px - perp.x*R*0.26, 5, pz - perp.z*R*0.26); g.add(wh2);
  for(let i=0;i<3;i++){
    const st = makeContainerStack(mat);
    st.position.set(px + perp.x*rnd(2,14) - dir.x*rnd(4,12), 5, pz + perp.z*rnd(2,14) - dir.z*rnd(4,12));
    st.rotation.y = portA + rnd(-0.15, 0.15);
    g.add(st);
  }
  const crane = makeCrane();
  crane.rotation.y = portA + rnd(-0.3, 0.3);
  crane.position.set(px - dir.x*R*0.05 + perp.x*R*0.12, 5, pz - dir.z*R*0.05 + perp.z*R*0.12);
  g.add(crane);

  const fact = new THREE.Group();
  {
    const fb = new THREE.Mesh(new THREE.BoxGeometry(9, 6, 11), M.warehouse);
    fb.position.y = 3; fact.add(fb);
    const fr = hipRoof(9.8, 11.8, 2, M.roofTar); fr.position.y = 7; fact.add(fr);
    const chim = new THREE.Mesh(new THREE.CylinderGeometry(0.95, 1.35, 19, 12), M.cream);
    chim.position.set(3.2, 9.5, -3.5); fact.add(chim);
    for(let i=0;i<3;i++){
      const yy = 5 + i*4.5;
      const band = new THREE.Mesh(new THREE.CylinderGeometry(1.1 - i*0.06, 1.14 - i*0.06, 1.1, 12), M.red);
      band.position.set(3.2, yy, -3.5); fact.add(band);
    }
  }
  fact.rotation.y = portA;
  fact.position.set(px + perp.x*R*0.36, 5, pz + perp.z*R*0.36);
  g.add(fact);
  const smokeAnchor = new THREE.Object3D();
  smokeAnchor.position.set(3.2, 19.5, -3.5);
  fact.add(smokeAnchor);

  for(let i=-3;i<=3;i++){
    const a = portA + i*0.16;
    const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(rnd(4, 7)), M.cliff);
    rock.position.set(Math.sin(a)*(R+17), rnd(0.5, 2), Math.cos(a)*(R+17));
    rock.rotation.set(rnd(0, 3), rnd(0, 3), rnd(0, 3));
    g.add(rock);
  }
  let beams = null;
  {
    const lh = makeLighthouse();
    lh.scale.setScalar(0.62);
    const la = portA + 0.48;
    lh.position.set(Math.sin(la)*(R+17), 3, Math.cos(la)*(R+17));
    g.add(lh);
    beams = lh.userData.beams;
  }
  for(let i=0;i<6;i++){
    const a = portA + (i%2 ? 1 : -1)*(Math.PI/2 + rnd(0, 0.9));
    const p = makePalm();
    p.position.set(Math.sin(a)*R*rnd(0.7, 0.88), 4, Math.cos(a)*R*rnd(0.7, 0.88));
    p.rotation.y = rnd(0, 6);
    g.add(p);
  }

  scene.add(g);
  colBox(g, R*1.9, 8, R*1.9, 0, 4, 0);
  const pop = Math.floor(rnd(9, 36));
  const city = { group:g, point:g.position, colType:'city', capR:950, clear:R+300,
    R, Rp, hx:hillPos.x, hz:hillPos.z, topY:townY+Math.max(maxBH,10),
    label:`Порт-город «${name}» · ${pop} тыс. жителей`,
    boats, smokeAnchor, beams, smT:0 };
  city.townY = townY;
  registerBuildings(city, blds);
  spawnCityPedestrians(city, hillPos, Rp, townY);
  city.update = (dt,t)=>{
    for(const b of city.boats){
      b.mesh.getWorldPosition(tmpV);
      const target = waterY(tmpV.x, tmpV.z, t)*0.55 + 0.55;
      b.mesh.position.y += (target - b.mesh.position.y)*Math.min(1, dt*4);
      b.mesh.rotation.z = Math.sin(t*0.8 + b.ph)*0.05;
      b.mesh.rotation.x = Math.cos(t*0.63 + b.ph)*0.04;
    }
    city.smT -= dt;
    if(city.smT <= 0){
      city.smT = 0.13;
      smokeAnchor.getWorldPosition(tmpV);
      particles.spawn(tmpV.x, tmpV.y, tmpV.z, {
        vx: 2.0*0.8 + rnd(-0.5,0.5), vy: rnd(3, 4.6), vz: 0.9*0.8 + rnd(-0.5,0.5),
        life: rnd(3, 5.5), s0: 1.6, s1: 10, r: 0.75, g: 0.73, b: 0.75, a: 0.24 });
    }
    if(city.beams) city.beams.rotation.y = t*0.55;
    if(distToPlayer(city.point) > 4200)
      placeAhead(city.point, 1800, 3200, 2.6, world.islands.filter(o=>o!==city));
  };
  return city;
}