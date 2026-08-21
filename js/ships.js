import * as THREE from 'three';
import { scene } from './engine.js';
import { WIND, rnd, clamp } from './config.js';
import { M, mat } from './materials.js';
import { makeHull, makeSail, mast, yard, flagMesh, strutBetween, colBox } from './helpers.js';
import { waterY } from './environment.js';
import { particles, explosion, splash, bubbles } from './particles.js';
import { world } from './world.js';
import { player, game, distToPlayer, placeAhead } from './state.js';
import { boomSound } from './audio.js';
import { showCaption } from './hud.js';

const tmpV = new THREE.Vector3();

function makeShip(group, o){
  const s = { group, ...o, point: group.position, colType:'ship', phase: rnd(0,20),
    heading: rnd(0,Math.PI*2), turn: rnd(-0.012,0.012), rx:0, rz:0,
    smokeT:0, wakeT:0, capR:340, recycleAt:3200,
    hp:10, name: o.name || 'Судно', burning:false, sinking:false, sinkT:0, dmgT:0 };
  colBox(group, o.width, o.colH, o.len, 0, o.colH/2, 0);
  // точка повреждений на палубе — от неё огонь и дым
  const dmgAnchor = new THREE.Object3D();
  dmgAnchor.position.set(rnd(-1,1), o.colH*0.55, rnd(-o.len*0.3, o.len*0.3));
  group.add(dmgAnchor);
  s.dmgAnchor = dmgAnchor;

  s.update = (dt,t)=>{

    /* === корабль тонет === */
    if(s.sinking){
      s.sinkT += dt;
      const g = s.group;
      g.position.y -= (0.4 + s.sinkT*0.1)*dt;   // погружение с ускорением
      g.rotation.z += dt*0.1;
      g.rotation.x += dt*0.05;
      const wy = waterY(g.position.x, g.position.z, t);
      s.dmgT -= dt;
      if(g.position.y > wy - 2){
        // ещё над водой — догорает и дымит
        if(s.dmgT <= 0){
          s.dmgT = 0.08;
          dmgAnchor.getWorldPosition(tmpV);
          for(let k=0;k<2;k++)
            particles.spawn(tmpV.x+rnd(-2,2), tmpV.y, tmpV.z+rnd(-2,2), {
              vx:rnd(-1,1), vy:rnd(2,5), vz:rnd(-1,1),
              life:rnd(.3,.7), s0:rnd(1,2), s1:rnd(2,4),
              r:1, g:rnd(.35,.6), b:.1, a:.9, drag:1.5 });
          particles.spawn(tmpV.x, tmpV.y, tmpV.z, {
            vx:WIND.x*0.5+rnd(-.5,.5), vy:rnd(2,4), vz:WIND.z*0.5+rnd(-.5,.5),
            life:rnd(2,4), s0:1.5, s1:8, r:.2, g:.19, b:.21, a:.5 });
        }
      } else if(s.dmgT <= 0){
        // уже под водой — пузыри
        s.dmgT = 0.12;
        bubbles(g.position.x+rnd(-4,4), wy, g.position.z+rnd(-4,4), 3, 1.2);
      }
      // полностью утонул — респавн впереди с полным HP
      if(g.position.y < -85 || s.sinkT > 26){
        s.sinking = false; s.burning = false; s.hp = 10; s.sinkT = 0;
        s.rx = 0; s.rz = 0;
        g.rotation.set(0, s.heading, 0);
        placeAhead(s.point, 1100, 2400, 2.4, world.islands);
      }
      return;
    }

    /* === обычный ход === */
    if(s.wiggle) s.heading += Math.sin(t*0.4+s.phase)*0.25*dt;
    s.heading += s.turn*dt;
    const x = s.point.x + Math.sin(s.heading)*s.speed*dt;
    const z = s.point.z + Math.cos(s.heading)*s.speed*dt;
    s.point.set(x, 0, z);
    const y = waterY(x,z,t) + s.draft;
    const fx=Math.sin(s.heading), fz=Math.cos(s.heading);
    const rx_=Math.atan2(
      waterY(x-fx*s.len*0.38, z-fz*s.len*0.38, t) - waterY(x+fx*s.len*0.38, z+fz*s.len*0.38, t), s.len*0.76);
    const rz_=Math.atan2(
      waterY(x-fz*s.width*0.5, z+fx*s.width*0.5, t) - waterY(x+fz*s.width*0.5, z-fx*s.width*0.5, t), s.width)*0.9;
    s.rx += (clamp(rx_,-0.1,0.1) - s.rx)*Math.min(1,dt*2.2);
    s.rz += (clamp(rz_,-0.14,0.14) - s.rz)*Math.min(1,dt*2.2);
    group.position.y = y;
    group.rotation.order = 'YXZ';
    group.rotation.set(s.rx, s.heading, s.rz);
    if(group.userData.radar) group.userData.radar.rotation.y = t*1.7;
    if(s.flag) s.flag.rotation.y = Math.sin(t*7+s.phase)*0.5;
    if(s.smokeAnchor){
      s.smokeT -= dt;
      if(s.smokeT <= 0){
        s.smokeT = 0.16;
        s.smokeAnchor.getWorldPosition(tmpV);
        particles.spawn(tmpV.x,tmpV.y,tmpV.z, { vx:WIND.x+rnd(-0.4,0.4), vy:rnd(2.6,3.8), vz:WIND.z+rnd(-0.4,0.4),
          life:rnd(2.5,4.5), s0:1.2, s1:7.5, r:0.72,g:0.70,b:0.72, a:0.30 });
      }
    }
    if(s.wakeAnchor){
      s.wakeT += dt;
      while(s.wakeT > 0.07){
        s.wakeT -= 0.07;
        s.wakeAnchor.getWorldPosition(tmpV);
        particles.spawn(tmpV.x+rnd(-1,1), waterY(tmpV.x,tmpV.z,t)+0.25, tmpV.z+rnd(-1,1), {
          life:rnd(1.8,3), s0:1.1, s1:5.5, r:0.92,g:0.96,b:0.96, a:0.42, vy:0.2 });
      }
    }

    /* === пожар после 5 попаданий === */
    if(s.burning){
      s.dmgT -= dt;
      if(s.dmgT <= 0){
        s.dmgT = 0.1;
        dmgAnchor.getWorldPosition(tmpV);
        particles.spawn(tmpV.x, tmpV.y, tmpV.z, {
          vx:rnd(-0.6,0.6), vy:rnd(1.5,3.5), vz:rnd(-0.6,0.6),
          life:rnd(.25,.6), s0:rnd(.8,1.6), s1:rnd(1.5,3),
          r:1, g:rnd(.4,.6), b:.12, a:.85, drag:1.2 });
        particles.spawn(tmpV.x, tmpV.y, tmpV.z, {
          vx:WIND.x*0.6+rnd(-.4,.4), vy:rnd(2.5,4), vz:WIND.z*0.6+rnd(-.4,.4),
          life:rnd(2.5,4.5), s0:1.3, s1:7.5, r:.22, g:.21, b:.23, a:.5 });
      }
    }

    if(distToPlayer(s.point) > s.recycleAt)
      placeAhead(s.point, 1100, 2400, 2.4, world.islands);
  };
  scene.add(group);
  return s;
}

/* попадание пулей: -1 HP; на 5 — пожар; на 0 — взрыв и затопление */
export function damageShip(s, hx, hy, hz){
  if(s.sinking) return;
  s.hp--;
  for(let k=0;k<5;k++)
    particles.spawn(hx, hy, hz, {
      vx:rnd(-6,6), vy:rnd(-1,6), vz:rnd(-6,6),
      life:rnd(.15,.4), s0:rnd(.2,.4), s1:.05,
      r:1, g:.85, b:.4, a:1, grav:-20 });
  if(s.hp === 5 && !s.burning){
    s.burning = true;
    showCaption(`«${s.name}» загорелся · добей его!`, 2.5);
  }
  if(s.hp <= 0){
    s.sinking = true; s.sinkT = 0; s.speed = 0;
    s.group.rotation.order = 'YXZ';
    explosion(s.point.x, s.group.position.y + 3, s.point.z);
    splash(s.point.x, waterY(s.point.x, s.point.z, game.simT), s.point.z, 40, 1.2);
    boomSound();
    showCaption(`«${s.name}» уничтожен`, 3);
  }
}

export function makeSchooner(name){
  const g = new THREE.Group();
  const hull = makeHull(24, 5.5, 3.6, M.wood); hull.position.y = 0.9; g.add(hull);
  const deck = new THREE.Mesh(new THREE.BoxGeometry(2.8,0.3,16), M.deck);
  deck.position.y = 2.55; g.add(deck);
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(3,1.6,4), M.cream);
  cabin.position.set(0,3.3,-6.5); g.add(cabin);
  const cabRoof = new THREE.Mesh(new THREE.BoxGeometry(3.3,0.2,4.3), M.woodDark);
  cabRoof.position.set(0,4.15,-6.5); g.add(cabRoof);
  const hatch = new THREE.Mesh(new THREE.BoxGeometry(2.2,0.5,3.2), M.woodDark);
  hatch.position.set(0,2.9,1.6); g.add(hatch);
  const capstan = new THREE.Mesh(new THREE.CylinderGeometry(0.5,0.6,0.9,10), M.woodDark);
  capstan.position.set(0,3.1,9.2); g.add(capstan);
  for(let i=0;i<3;i++){
    const b = new THREE.Mesh(new THREE.CylinderGeometry(0.48,0.48,1.0,12), M.woodDark);
    b.position.set(rnd(-0.8,0.8), 3.1, 3.2+i*1.4); b.rotation.y = rnd(0,3); g.add(b);
  }
  for(const s of [-1,1]){
    const rail = new THREE.Mesh(new THREE.BoxGeometry(0.09,0.09,15), M.woodDark);
    rail.position.set(s*1.42,3.25,0.5); g.add(rail);
    for(let i=0;i<6;i++){
      const p = new THREE.Mesh(new THREE.CylinderGeometry(0.05,0.05,0.6,5), M.woodDark);
      p.position.set(s*1.42,2.95,-6+i*2.6); g.add(p);
    }
  }
  const shank = new THREE.Mesh(new THREE.BoxGeometry(0.12,1.3,0.12), M.dark);
  shank.position.set(0.9,2.3,11.4); shank.rotation.x = 0.5; g.add(shank);
  const stockA = new THREE.Mesh(new THREE.BoxGeometry(0.9,0.1,0.1), M.dark);
  stockA.position.set(0.9,2.85,11.15); stockA.rotation.x = 0.5; g.add(stockA);
  for(const s of [-1,1]){
    const fl = new THREE.Mesh(new THREE.ConeGeometry(0.18,0.5,5), M.dark);
    fl.position.set(0.9+s*0.22, 1.75, 11.75); fl.rotation.z = s*0.7; g.add(fl);
  }
  const rigs = [ {z:5.5,h:17,sails:[[7.5,9.5],[4.6,4.6]]}, {z:-2.5,h:14,sails:[[8,10],[5,5]]} ];
  for(const r of rigs){
    const m = mast(r.h); m.position.set(0, 2.4+r.h/2, r.z); g.add(m);
    let top = 2.4 + r.h - 0.8;
    for(const [w,h] of r.sails){
      const y = yard(w); y.position.set(0, top, r.z); g.add(y);
      const s = makeSail(w,h); s.position.set(0, top-h/2-0.15, r.z+0.05); g.add(s);
      top -= h + 1.0;
    }
    g.add(strutBetween(0, 2.4+r.h, r.z, 0, 2.6, r.z+7.5, 0.02, M.woodDark));
    g.add(strutBetween(0, 2.4+r.h, r.z, 0, 2.6, r.z-7.5, 0.02, M.woodDark));
  }
  const bowsprit = mast(6); bowsprit.rotation.x = Math.PI/2 - 0.25;
  bowsprit.position.set(0, 3.6, 12.6); g.add(bowsprit);
  const jibGeo = new THREE.BufferGeometry();
  jibGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array([
    0,13.8,15.2,   0,11.8,10.2,   0,3.2,13.4 ]), 3));
  jibGeo.computeVertexNormals();
  g.add(new THREE.Mesh(jibGeo, M.sail));
  const nest = new THREE.Mesh(new THREE.CylinderGeometry(0.55,0.45,0.7,10,1,true), M.woodDark);
  nest.position.set(0, 15.4, 5.5); g.add(nest);
  const flag = flagMesh(); flag.position.set(0, 19.6, 5.5); g.add(flag);
  const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.2,8,6), M.lamp);
  lamp.position.set(0,17.2,-2.5); g.add(lamp);
  return makeShip(g, { len:24, width:5.5, draft:0.5, speed:rnd(3,5), colH:20, name,
    label:`Двухмачтовая шхуна «${name}» · идёт под парусами`, flag });
}

export function makeTrawler(name){
  const g = new THREE.Group();
  const hull = makeHull(30, 7.5, 5, M.navy); hull.position.y = 1.4; g.add(hull);
  const deck = new THREE.Mesh(new THREE.BoxGeometry(4.8,0.3,18), M.deck);
  deck.position.y = 3.75; g.add(deck);
  for(let i=0;i<4;i++) for(const s of [-1,1]){
    const pl = new THREE.Mesh(new THREE.CylinderGeometry(0.16,0.16,0.12,8), M.glass);
    pl.rotation.z = Math.PI/2;
    pl.position.set(s*3.1, 2.4, 7 - i*3.4);
    g.add(pl);
  }
  const house = new THREE.Mesh(new THREE.BoxGeometry(5.2,3.4,6.5), M.white);
  house.position.set(0,5.6,-6.5); g.add(house);
  const bridge = new THREE.Mesh(new THREE.BoxGeometry(6.4,1.6,4.4), M.white);
  bridge.position.set(0,8.1,-6.5); g.add(bridge);
  for(const s of [-1,1]){
    const w = new THREE.Mesh(new THREE.BoxGeometry(0.12,0.7,3.0), M.glass);
    w.position.set(s*3.22,8.35,-6.2); g.add(w);
    const wing = new THREE.Mesh(new THREE.BoxGeometry(1.4,0.12,2.4), M.white);
    wing.position.set(s*3.9,7.85,-6.5); g.add(wing);
    const wr = new THREE.Mesh(new THREE.BoxGeometry(0.06,0.7,0.06), M.dark);
    wr.position.set(s*4.5,8.25,-5.4); g.add(wr);
  }
  const wf = new THREE.Mesh(new THREE.BoxGeometry(4.4,0.9,0.14), M.glass);
  wf.position.set(0,8.3,-4.3); wf.rotation.x = -0.2; g.add(wf);
  const lr = new THREE.Mesh(new THREE.TorusGeometry(0.55,0.14,6,14), mat(0xe9e4d6));
  lr.position.set(2.68,6.3,-3.4); lr.rotation.y = Math.PI/2; g.add(lr);
  const stack = new THREE.Mesh(new THREE.CylinderGeometry(0.8,1.0,3.8,12), M.dark);
  stack.position.set(0,5.8,-11.5); g.add(stack);
  const ring = new THREE.Mesh(new THREE.CylinderGeometry(0.95,0.95,0.55,12), M.red);
  ring.position.set(0,7.6,-11.5); g.add(ring);
  const post = mast(7); post.position.set(0,7.4,6.8); g.add(post);
  const radar = new THREE.Mesh(new THREE.BoxGeometry(0.18,0.9,2.6), M.dark);
  radar.position.set(0,10.5,6.8); g.add(radar);
  g.userData.radar = radar;
  g.add(strutBetween(0,10.9,6.8, 0,4.2,13.8, 0.02, M.dark));
  g.add(strutBetween(0,10.9,6.8, 0,4.2,-12.8, 0.02, M.dark));
  const winch = new THREE.Mesh(new THREE.CylinderGeometry(1.1,1.1,2.4,12), M.dark);
  winch.rotation.z = Math.PI/2; winch.position.set(0,4.6,4.4); g.add(winch);
  const boom = new THREE.Mesh(new THREE.BoxGeometry(0.35,0.35,11), M.dark);
  boom.position.set(0,7.2,1.6); boom.rotation.x = 0.35; g.add(boom);
  for(let i=0;i<3;i++){
    const bx = new THREE.Mesh(new THREE.BoxGeometry(1.4,0.9,1.8), i%2?M.buoy:M.white);
    bx.position.set(rnd(-1.5,1.5), 4.35, rnd(-1.5,1.5)); bx.rotation.y = rnd(0,1);
    g.add(bx);
  }
  for(const s of [-1,1]){
    const boat = new THREE.Mesh(new THREE.CapsuleGeometry(0.55,1.8,4,8), M.buoy);
    boat.rotation.x = Math.PI/2; boat.position.set(s*3.3,4.3,8.6); g.add(boat);
  }
  const flag = flagMesh(); flag.scale.setScalar(0.7); flag.position.set(0,11.5,6.8); g.add(flag);
  const smokeAnchor = new THREE.Object3D(); smokeAnchor.position.set(0,7.9,-11.5); g.add(smokeAnchor);
  return makeShip(g, { len:30, width:7.5, draft:0.9, speed:rnd(4,6.5), colH:12.5, name,
    label:`Рыболовецкий траулер «${name}»`, flag, smokeAnchor });
}

export function makeBoat(name){
  const g = new THREE.Group();
  const hull = makeHull(11, 3.2, 2.2, M.cream); hull.position.y = 0.55; g.add(hull);
  const house = new THREE.Mesh(new THREE.BoxGeometry(2.2,1.4,3.4), M.white);
  house.position.set(0,1.9,0.3); g.add(house);
  const win = new THREE.Mesh(new THREE.BoxGeometry(2.25,0.7,1.1), M.glass);
  win.position.set(0,2.25,2.1); win.rotation.x = -0.25; g.add(win);
  const seat = new THREE.Mesh(new THREE.BoxGeometry(1.4,0.45,0.6), M.planeR);
  seat.position.set(0,1.2,1.4); g.add(seat);
  const ant = new THREE.Mesh(new THREE.CylinderGeometry(0.02,0.02,1.7,5), M.dark);
  ant.position.set(0.7,3.2,-0.6); ant.rotation.z = 0.12; g.add(ant);
  for(const s of [-1,1]) for(let i=0;i<3;i++){
    const p = new THREE.Mesh(new THREE.CylinderGeometry(0.03,0.03,0.55,4), M.dark);
    p.position.set(s*1.45,1.55,3.2+i*0.8); g.add(p);
  }
  const rail = new THREE.Mesh(new THREE.BoxGeometry(0.05,0.05,2.6), M.dark);
  rail.position.set(0,1.83,3.6); g.add(rail);
  const eng = new THREE.Mesh(new THREE.BoxGeometry(1.4,0.9,1.6), M.dark);
  eng.position.set(0,1.3,-4.4); g.add(eng);
  const flag = flagMesh(); flag.scale.setScalar(0.55); flag.position.set(0,3.0,-1.2); g.add(flag);
  const wakeAnchor = new THREE.Object3D(); wakeAnchor.position.set(0,0,-5.2); g.add(wakeAnchor);
  return makeShip(g, { len:11, width:3.2, draft:0.35, speed:rnd(11,15), colH:4, name,
    label:`Береговой катер «${name}» · 14 узлов`, flag, wakeAnchor, wiggle:true });
}

function makeGull(){
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.14,0.5,3,7), M.gullW);
  body.rotation.x = Math.PI/2; g.add(body);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.13,8,6), M.gullW);
  head.position.set(0,0.06,0.42); g.add(head);
  const beak = new THREE.Mesh(new THREE.ConeGeometry(0.05,0.24,6), mat(0xd98a35));
  beak.rotation.x = Math.PI/2; beak.position.set(0,0.04,0.58); g.add(beak);
  const wingGeoL = new THREE.PlaneGeometry(1.5,0.55);
  wingGeoL.translate(0.75,0,0);
  wingGeoL.rotateX(-Math.PI/2);
  const wingGeoR = wingGeoL.clone(); wingGeoR.scale(-1,1,1);
  const wl = new THREE.Mesh(wingGeoL, M.gullG);
  const wr = new THREE.Mesh(wingGeoR, M.gullG);
  wl.position.set(0,0.05,0.05); wr.position.set(0,0.05,0.05);
  g.add(wl); g.add(wr);
  g.userData = { wl, wr };
  g.scale.setScalar(1.35);
  return g;
}

export function makeFlock(n, boundShip){
  const f = { point:new THREE.Vector3(), birds:[], bound:boundShip,
    heading: rnd(0,Math.PI*2), turn: rnd(-0.25,0.25), y0: rnd(26,85), capR:230,
    label:`Стая серебристых чаек · ${n} птиц` };
  for(let i=0;i<n;i++){
    const b = makeGull();
    f.birds.push({ mesh:b, ox:(i-n/2)*2.4+rnd(-0.8,0.8), oy:rnd(-2,3), oz:rnd(-4,2),
      phase:rnd(0,10), flap:rnd(7,10), init:true });
    scene.add(b);
  }
  const tgt = new THREE.Vector3();
  f.update = (dt,t)=>{
    if(f.bound){
      const c = f.bound.point;
      const a = t*0.3 + 1.2;
      f.point.set(c.x+Math.cos(a)*17, f.y0, c.z+Math.sin(a)*17);
      f.heading = a + Math.PI/2;
    } else {
      f.heading += f.turn*dt;
      f.point.x += Math.sin(f.heading)*11*dt + WIND.x*dt*0.4;
      f.point.z += Math.cos(f.heading)*11*dt + WIND.z*dt*0.4;
      f.point.y = f.y0 + Math.sin(t*0.5)*3;
      if(distToPlayer(f.point) > 2400){
        placeAhead(f.point, 500, 1500, 2.8, world.islands);
        f.y0 = clamp(player.pos.y+rnd(-25,25), 22, 160);
      }
    }
    const ch = Math.cos(f.heading), sh = Math.sin(f.heading);
    for(const b of f.birds){
      tgt.set(f.point.x + b.ox*ch + b.oz*sh, f.point.y + b.oy + Math.sin(t*1.7+b.phase)*0.8,
              f.point.z - b.ox*sh + b.oz*ch);
      if(b.init || b.mesh.position.distanceToSquared(tgt) > 640000){
        b.mesh.position.copy(tgt); b.init = false;
      } else {
        b.mesh.position.lerp(tgt, Math.min(1, dt*3.2));
      }
      b.mesh.rotation.y = f.heading;
      b.mesh.rotation.z = Math.sin(t*0.9+b.phase)*0.12;
      const w = Math.sin(t*b.flap + b.phase)*0.8;
      b.mesh.userData.wl.rotation.z = w;
      b.mesh.userData.wr.rotation.z = -w;
    }
  };
  return f;
}