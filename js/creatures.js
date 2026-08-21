import * as THREE from 'three';
import { rnd, clamp } from './config.js';
import { scene } from './engine.js';
import { M, mat } from './materials.js';
import { mast, colBox } from './helpers.js';
import { makeHull } from './helpers.js';
import { waterY } from './environment.js';
import { seafloorY } from './seafloor.js';
import { particles, splash, bubbles } from './particles.js';
import { world } from './world.js';
import { state, player, distToPlayer, placeAhead } from './state.js';

const tmpV = new THREE.Vector3();

export function makeWhale(){
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.SphereGeometry(1.6,16,12), M.whale);
  body.scale.set(1.15,0.95,3.2); g.add(body);
  const fluke = new THREE.Mesh(new THREE.BoxGeometry(4.4,0.28,1.7), M.whale);
  fluke.position.set(0,0.15,-5); g.add(fluke);
  for(const s of [-1,1]){
    const fin = new THREE.Mesh(new THREE.BoxGeometry(2.1,0.2,0.9), M.whale);
    fin.position.set(s*1.9,-0.5,1.4); fin.rotation.z = s*-0.35; g.add(fin);
  }
  const dorsal = new THREE.Mesh(new THREE.ConeGeometry(0.5,1.1,5), M.whale);
  dorsal.scale.set(0.3,1,1.6); dorsal.position.set(0,1.35,-1.2); g.add(dorsal);
  g.position.y = -45;
  scene.add(g);
  colBox(g, 4.5, 3.5, 10);
  const w = { group:g, fluke, point:new THREE.Vector3(), colType:'whale', capR:300,
    state:'idle', timer:rnd(4,12), p:0, dir:0, s1:false, s2:false, blow:false, phase:rnd(0,10),
    label:()=> w.state==='breach' ? 'Горбатый кит · breaching'
      : (state.vehicle==='sub' && distToPlayer(w.point) < 220 ? 'Горбатый кит · проходит рядом' : null) };
  w.update = (dt,t)=>{
    if(w.state === 'idle'){
      const a = t*0.08 + w.phase;
      const cx = w.point.x + Math.cos(a)*26;
      const cz = w.point.z + Math.sin(a)*26;
      const ty = -45 + Math.sin(t*0.25+w.phase)*5;
      g.position.x += (cx-g.position.x)*Math.min(1,dt*2);
      g.position.z += (cz-g.position.z)*Math.min(1,dt*2);
      g.position.y += (ty-g.position.y)*Math.min(1,dt*2);
      g.rotation.order = 'YXZ';
      g.rotation.set(Math.sin(t*0.5)*0.04, -a, 0);
      w.fluke.rotation.x = Math.sin(t*0.8+w.phase)*0.18;
      w.timer -= dt;
      if(w.timer <= 0){ w.state='breach'; w.p=0; w.s1=w.s2=false; w.blow=false; w.dir=rnd(0,Math.PI*2); }
    } else {
      w.p += dt/2.6;
      const s = Math.min(w.p, 1);
      g.position.set(
        w.point.x + Math.sin(w.dir)*22*s,
        -45 + 66*Math.sin(Math.PI*s),
        w.point.z + Math.cos(w.dir)*22*s);
      g.rotation.order = 'YXZ';
      g.rotation.set((s-0.5)*2.1, w.dir, 0);
      w.fluke.rotation.x = 0;
      const wy = waterY(g.position.x, g.position.z, t);
      if(!w.s1 && s > 0.22){ w.s1=true; splash(g.position.x, wy, g.position.z, 40, 1.0); }
      if(!w.blow && s > 0.5){
        w.blow = true;
        const hx = g.position.x + Math.sin(w.dir)*3.5, hz = g.position.z + Math.cos(w.dir)*3.5;
        for(let i=0;i<14;i++)
          particles.spawn(hx+rnd(-1,1), g.position.y+1, hz+rnd(-1,1),
            { vx:rnd(-1,1), vy:rnd(12,20), vz:rnd(-1,1), life:rnd(.5,.9),
              s0:.8, s1:2.8, r:.95, g:.97, b:.97, a:.8, drag:.8 });
      }
      if(!w.s2 && s > 0.94){ w.s2=true; splash(g.position.x, wy, g.position.z, 55, 1.25); }
      if(w.p >= 1){ w.state='idle'; w.timer=rnd(7,18); }
    }
    if(distToPlayer(w.point) > 1800) placeAhead(w.point, 400, 1500, 1.9, world.islands);
  };
  return w;
}

const FISH_MATS = [M.fish1, M.fish2, M.fish3];
function makeFish(){
  const g = new THREE.Group();
  const mm = FISH_MATS[Math.floor(rnd(0,3))];
  const bodyGeo = new THREE.ConeGeometry(0.13, 0.55, 6);
  bodyGeo.rotateX(Math.PI/2);
  const body = new THREE.Mesh(bodyGeo, mm);
  body.scale.x = 0.5;
  g.add(body);
  const tail = new THREE.Mesh(new THREE.PlaneGeometry(0.2,0.16), mm);
  tail.position.z = -0.32;
  g.add(tail);
  g.userData = { tail };
  return g;
}
export function makeFishSchool(n, bound){
  const f = { point:new THREE.Vector3(), fishes:[], bound, heading:rnd(0,6.28),
    turn: rnd(-0.3,0.3), y0: rnd(-55,-25), spd: rnd(3.5,6) };
  for(let i=0;i<n;i++){
    const m = makeFish();
    m.scale.setScalar(rnd(0.8,1.5));
    f.fishes.push({ mesh:m, ox:rnd(-7,7), oy:rnd(-3,3), oz:rnd(-7,7),
      phase:rnd(0,10), init:true });
    scene.add(m);
  }
  const tgt = new THREE.Vector3();
  f.update = (dt,t)=>{
    if(f.bound){
      const a = t*0.35 + f.turn*10;
      f.point.set(f.bound.point.x+Math.cos(a)*16, f.bound.group.position.y + 6 + Math.sin(t*0.4)*3,
                  f.bound.point.z+Math.sin(a)*16);
      f.heading = -a;
    } else {
      f.heading += f.turn*dt;
      f.point.x += Math.sin(f.heading)*f.spd*dt;
      f.point.z += Math.cos(f.heading)*f.spd*dt;
      f.point.y = f.y0 + Math.sin(t*0.4)*4;
      if(distToPlayer(f.point) > 1300){
        placeAhead(f.point, 400, 900, 2.8, world.islands);
        f.y0 = rnd(-60,-20);
      }
    }
    const ch = Math.cos(f.heading), sh = Math.sin(f.heading);
    for(const b of f.fishes){
      tgt.set(f.point.x + b.ox*ch + b.oz*sh, f.point.y + b.oy + Math.sin(t*1.5+b.phase)*0.5,
              f.point.z - b.ox*sh + b.oz*ch);
      if(b.init || b.mesh.position.distanceToSquared(tgt) > 400000){
        b.mesh.position.copy(tgt); b.init = false;
      } else b.mesh.position.lerp(tgt, Math.min(1, dt*2.5));
      b.mesh.rotation.y = f.heading;
      b.mesh.userData.tail.rotation.y = Math.sin(t*9+b.phase)*0.6;
    }
  };
  return f;
}

export function makeJelly(){
  const g = new THREE.Group();
  const bell = new THREE.Mesh(new THREE.SphereGeometry(1.0, 12, 8, 0, Math.PI*2, 0, Math.PI/2), M.jelly);
  g.add(bell);
  for(let i=0;i<5;i++){
    const tn = new THREE.Mesh(new THREE.PlaneGeometry(0.08, rnd(1.8,2.8)), M.jelly);
    const a = i/5*Math.PI*2;
    tn.position.set(Math.cos(a)*0.5, -1.2, Math.sin(a)*0.5);
    g.add(tn);
  }
  scene.add(g);
  const j = { group:g, bell, point:g.position, y0:rnd(-38,-14), ph:rnd(0,10) };
  j.update = (dt,t)=>{
    g.position.x += 2.0*dt*0.15;
    g.position.z += 0.9*dt*0.15;
    g.position.y = j.y0 + Math.sin(t*0.22+j.ph)*7 + Math.sin(t*2+j.ph)*0.3;
    const puls = 1 + 0.14*Math.sin(t*2+j.ph);
    g.scale.set(puls, 2-puls, puls);
    g.rotation.y = t*0.1+j.ph;
    if(distToPlayer(j.point) > 1000){
      placeAhead(j.point, 250, 700, 2.8, world.islands);
      j.y0 = rnd(-38,-14);
    }
  };
  return j;
}

export function makeTurtle(){
  const g = new THREE.Group();
  const shell = new THREE.Mesh(new THREE.SphereGeometry(0.9, 10, 8), M.turtle);
  shell.scale.set(1.2, 0.55, 1.5); g.add(shell);
  const belly = new THREE.Mesh(new THREE.SphereGeometry(0.85, 10, 6), M.turtleS);
  belly.scale.set(1.1, 0.35, 1.4); belly.position.y = -0.12; g.add(belly);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.22, 8, 6), M.turtleS);
  head.position.set(0, 0.05, 1.55); g.add(head);
  const flippers = [];
  for(const [sx,sz,rr] of [[-1,0.9,0.5],[1,0.9,0.5],[-1,-0.9,-0.4],[1,-0.9,-0.4]]){
    const fp = new THREE.Mesh(new THREE.BoxGeometry(0.7,0.08,0.35), M.turtleS);
    fp.position.set(sx*1.1, 0, sz);
    fp.rotation.z = sx*rr;
    g.add(fp); flippers.push({ m:fp, ph:rnd(0,6) });
  }
  scene.add(g);
  const tt = { group:g, point:g.position, heading:rnd(0,6.28), turn:rnd(-0.1,0.1), y0:rnd(-30,-12), ph:rnd(0,10) };
  tt.update = (dt,t)=>{
    tt.heading += tt.turn*dt;
    g.position.x += Math.sin(tt.heading)*2.2*dt;
    g.position.z += Math.cos(tt.heading)*2.2*dt;
    g.position.y = tt.y0 + Math.sin(t*0.3+tt.ph)*3;
    g.rotation.set(0, tt.heading, Math.sin(t*0.5+tt.ph)*0.08);
    for(const f of flippers) f.m.rotation.x = Math.sin(t*2.6+f.ph)*0.5;
    if(distToPlayer(tt.point) > 1200){
      placeAhead(tt.point, 350, 800, 2.8, world.islands);
      tt.y0 = rnd(-30,-12);
    }
  };
  return tt;
}

export function makeRay(){
  const g = new THREE.Group();
  const skin = mat(0x4a5a66,{r:.85,ds:1});
  const body = new THREE.Mesh(new THREE.SphereGeometry(1,12,8), skin);
  body.scale.set(1.1,0.22,1.5); g.add(body);
  const tail = new THREE.Mesh(new THREE.CylinderGeometry(0.03,0.06,2.6,6), skin);
  tail.rotation.x = Math.PI/2; tail.position.set(0,0.05,-2.4); g.add(tail);
  const wings = [];
  for(const s of [-1,1]){
    const w = new THREE.Group();
    const geo = new THREE.PlaneGeometry(2.4,1.8,4,2);
    const p = geo.attributes.position;
    for(let i=0;i<p.count;i++){
      const t = Math.abs(p.getX(i))/1.2;
      p.setY(i, p.getY(i)*(1-t*0.55));
    }
    geo.computeVertexNormals();
    const wg = new THREE.Mesh(geo, skin);
    wg.rotation.x = -Math.PI/2;
    wg.position.x = s*1.6;
    w.add(wg);
    g.add(w); wings.push({ m:w, s });
  }
  for(const s of [-1,1]){
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.07,6,5), M.dark);
    eye.position.set(s*0.35,0.15,1.25); g.add(eye);
  }
  scene.add(g);
  const r = { group:g, point:g.position, heading:rnd(0,6.28), turn:rnd(-0.15,0.15),
    y0:rnd(-50,-18), ph:rnd(0,10), wings };
  r.update = (dt,t)=>{
    r.heading += r.turn*dt;
    g.position.x += Math.sin(r.heading)*3.2*dt;
    g.position.z += Math.cos(r.heading)*3.2*dt;
    g.position.y = r.y0 + Math.sin(t*0.3+r.ph)*6;
    g.rotation.set(Math.sin(t*0.4+r.ph)*0.08, r.heading, 0);
    for(const w of r.wings) w.m.rotation.z = Math.sin(t*1.8+r.ph)*0.45*w.s;
    if(distToPlayer(r.point) > 1200){
      placeAhead(r.point, 350, 800, 2.8, world.islands);
      r.y0 = rnd(-50,-18);
    }
  };
  return r;
}

export function makeCrab(){
  const g = new THREE.Group();
  const shell = mat(0xa8452c,{r:.9,f:1});
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.5,10,8), shell);
  body.scale.set(1.25,0.6,1.0); body.position.y = 0.32; g.add(body);
  const legs = [], arms = [];
  for(const s of [-1,1]){
    const arm = new THREE.Group();
    arm.position.set(s*0.6,0.32,0.35);
    const armM = new THREE.Mesh(new THREE.CylinderGeometry(0.05,0.05,0.5,6), shell);
    armM.rotation.x = Math.PI/2; armM.position.z = 0.25; arm.add(armM);
    const claw = new THREE.Mesh(new THREE.ConeGeometry(0.14,0.4,6), shell);
    claw.rotation.x = Math.PI/2; claw.position.z = 0.62; arm.add(claw);
    g.add(arm); arms.push(arm);
    for(let i=0;i<3;i++){
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.025,0.025,0.5,5), shell);
      leg.position.set(s*0.62,0.18,-0.25+i*0.28);
      leg.rotation.z = s*1.1;
      g.add(leg); legs.push({ m:leg, ph:rnd(0,6) });
    }
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.05,6,5), M.dark);
    eye.position.set(s*0.14,0.62,0.42); g.add(eye);
  }
  scene.add(g);
  const cr = { group:g, point:g.position, heading:rnd(0,6.28), legs, arms, ph:rnd(0,10) };
  cr.update = (dt,t)=>{
    cr.heading += Math.sin(t*0.2+cr.ph)*0.3*dt;
    const sp = 1.1 + 0.5*Math.sin(t*0.13+cr.ph);
    g.position.x += Math.sin(cr.heading)*sp*dt;
    g.position.z += Math.cos(cr.heading)*sp*dt;
    g.position.y = seafloorY(g.position.x, g.position.z) + 0.1;
    g.rotation.y = cr.heading;
    for(const l of cr.legs) l.m.rotation.x = Math.sin(t*6+l.ph)*0.35;
    for(let i=0;i<cr.arms.length;i++) cr.arms[i].rotation.y = Math.sin(t*1.5+i*2)*0.3;
    if(distToPlayer(cr.point) > 900){
      placeAhead(cr.point, 250, 600, 2.8, world.islands);
      g.position.y = seafloorY(g.position.x, g.position.z) + 0.1;
    }
  };
  return cr;
}

export function makeWreck(name){
  const g = new THREE.Group();
  const hull = makeHull(26, 6.5, 5, M.wreck);
  hull.rotation.z = 0.38; hull.rotation.x = 0.05;
  g.add(hull);
  const deck = new THREE.Mesh(new THREE.BoxGeometry(3,0.3,15), M.wreckD);
  deck.rotation.z = 0.38; deck.position.y = 1.2; g.add(deck);
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(3.2,2.2,4), M.wreckD);
  cabin.position.set(-1.2, 2.4, -5); cabin.rotation.z = 0.38; g.add(cabin);
  const mast1 = mast(9); mast1.rotation.set(1.1, 0, 0.5); mast1.position.set(0.5, 2.5, 3); g.add(mast1);
  const mast2 = mast(6); mast2.rotation.set(1.35, 0.4, -0.3); mast2.position.set(1.5, 1.8, -3); g.add(mast2);
  const winch = new THREE.Mesh(new THREE.CylinderGeometry(0.9,0.9,2,10), M.wreckD);
  winch.rotation.z = Math.PI/2 + 0.38; winch.position.set(0, 2.2, 6); g.add(winch);
  const weeds = [];
  for(let i=0;i<11;i++){
    const w = new THREE.Mesh(new THREE.PlaneGeometry(rnd(0.4,0.7), rnd(2,4.5)), i%2?M.weed:M.weed2);
    const a = rnd(0,6.28), rr = rnd(0,3.4);
    w.position.set(Math.cos(a)*rr, rnd(0.5,3), Math.sin(a)*rr + rnd(-10,10));
    w.rotation.y = rnd(0,6);
    w.userData.ph = rnd(0,10);
    g.add(w); weeds.push(w);
  }
  const bubAnchor = new THREE.Object3D();
  bubAnchor.position.set(0, 3, -2); g.add(bubAnchor);
  scene.add(g);
  colBox(g, 7, 7, 26, 0, 2.5, 0);
  const wr = { group:g, point:g.position, colType:'wreck', capR:450,
    len:26, width:7, colH:7, heading: rnd(0,6.28), weeds, bubAnchor, bubT:0,
    label:()=>`Затонувшее судно «${name}» · глубина ${Math.round(-g.position.y)} м` };
  wr.update = (dt,t)=>{
    for(const w of weeds) w.rotation.x = Math.sin(t*0.8 + w.userData.ph)*0.16;
    if(distToPlayer(wr.point) < 1200){
      wr.bubT -= dt;
      if(wr.bubT <= 0){
        wr.bubT = 0.5;
        wr.bubAnchor.getWorldPosition(tmpV);
        bubbles(tmpV.x, tmpV.y, tmpV.z, 3, 1);
      }
    }
    if(distToPlayer(wr.point) > 1600){
      placeAhead(wr.point, 600, 1300, 2.6, world.islands);
      g.position.y = seafloorY(g.position.x, g.position.z) + 1.2;
    }
  };
  return wr;
}

function makeStarfish(){
  const g = new THREE.Group();
  const m = mat(0xc2763f,{r:1,f:1});
  const c = new THREE.Mesh(new THREE.SphereGeometry(0.16,8,6), m);
  c.scale.y = 0.5; g.add(c);
  for(let i=0;i<5;i++){
    const hold = new THREE.Group();
    hold.rotation.y = i*(Math.PI*2/5);
    const arm = new THREE.Mesh(new THREE.ConeGeometry(0.13,0.6,5), m);
    arm.rotation.z = -Math.PI/2;
    arm.position.x = 0.38;
    hold.add(arm);
    g.add(hold);
  }
  return g;
}

export function makeWeedPatch(){
  const g = new THREE.Group();
  const weeds = [];
  const n = 4 + Math.floor(rnd(0,3));
  for(let i=0;i<n;i++){
    const h = rnd(2.5,5);
    const w = new THREE.Mesh(new THREE.PlaneGeometry(rnd(0.5,0.9), h), i%2?M.weed:M.weed2);
    w.position.set(rnd(-4,4), h/2, rnd(-4,4));
    w.rotation.y = rnd(0,6);
    w.userData.ph = rnd(0,10);
    g.add(w); weeds.push(w);
  }
  if(Math.random() < 0.7){
    const sf = makeStarfish();
    sf.position.set(rnd(-4,4), 0.02, rnd(-4,4));
    sf.rotation.y = rnd(0,6);
    g.add(sf);
  }
  scene.add(g);
  const wp = { group:g, point:g.position, weeds };
  wp.update = (dt,t)=>{
    for(const w of weeds) w.rotation.x = Math.sin(t*0.85 + w.userData.ph)*0.2;
    if(distToPlayer(wp.point) > 1100){
      placeAhead(wp.point, 300, 800, 2.8, world.islands);
      g.position.y = seafloorY(g.position.x, g.position.z) + 0.05;
    }
  };
  return wp;
}

export function makeKelp(){
  const g = new THREE.Group();
  const stalks = [];
  const n = 3 + Math.floor(rnd(0,4));
  for(let i=0;i<n;i++){
    const h = rnd(7,13);
    const st = new THREE.Group();
    const geo = new THREE.PlaneGeometry(0.38, h, 1, 5);
    const p = geo.attributes.position;
    const bend = rnd(0.5,1.6), dir = rnd(0, Math.PI*2);
    const bx = Math.cos(dir), bz = Math.sin(dir);
    for(let j=0;j<p.count;j++){
      const k = (p.getY(j)+h/2)/h;
      p.setX(j, p.getX(j)*(1-k*0.5) + bx*k*k*bend);
      p.setZ(j, p.getZ(j) + bz*k*k*bend);
    }
    geo.computeVertexNormals();
    const leaf = new THREE.Mesh(geo, i%2?M.weed:M.weed2);
    leaf.position.y = h/2;
    st.add(leaf);
    st.position.set(rnd(-5,5), 0, rnd(-5,5));
    st.rotation.y = rnd(0,6);
    st.userData.ph = rnd(0,10);
    g.add(st); stalks.push(st);
  }
  scene.add(g);
  const kp = { group:g, point:g.position, stalks };
  kp.update = (dt,t)=>{
    for(const s of stalks) s.rotation.z = Math.sin(t*0.6+s.userData.ph)*0.08;
    if(distToPlayer(kp.point) > 1000){
      placeAhead(kp.point, 250, 700, 2.8, world.islands);
      g.position.y = seafloorY(g.position.x, g.position.z);
    }
  };
  return kp;
}

export function makeMegalodon(){
  const g = new THREE.Group();
  const skin = mat(0x59686f,{r:.6});
  const bellyM = mat(0xc4cbd0,{r:.7});
  const darkM = mat(0x2f3a40,{r:.8});
  const body = new THREE.Mesh(new THREE.SphereGeometry(1.6,18,12), skin);
  body.scale.set(1.22,1.05,4.4); g.add(body);
  const belly = new THREE.Mesh(
    new THREE.SphereGeometry(1.56,18,10,0,Math.PI*2,Math.PI*0.55,Math.PI*0.45), bellyM);
  belly.scale.set(1.18,0.98,4.3); belly.position.y = -0.1; g.add(belly);
  const snout = new THREE.Mesh(new THREE.ConeGeometry(1.25,3.4,12), skin);
  snout.rotation.x = Math.PI/2;
  snout.position.set(0,-0.05,8.4); g.add(snout);
  const jaw = new THREE.Mesh(new THREE.SphereGeometry(1.15,12,8), mat(0x43302c));
  jaw.scale.set(1.0,0.5,1.5); jaw.position.set(0,-0.62,7.0); g.add(jaw);
  const toothM = mat(0xe8e4d8,{r:.4});
  for(let i=0;i<9;i++){
    const a = -1.05 + i*0.26;
    const tx = Math.sin(a)*1.0, tz = 7.0 + Math.cos(a)*1.35;
    for(const yy of [-0.35,-0.95]){
      const tGeo = new THREE.ConeGeometry(0.09,0.34,5);
      if(yy < -0.6) tGeo.rotateX(Math.PI);
      const th = new THREE.Mesh(tGeo, toothM);
      th.position.set(tx, yy, tz);
      g.add(th);
    }
  }
  const eyeM = mat(0x101418,{r:.3});
  for(const s of [-1,1]){
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.16,8,6), eyeM);
    eye.position.set(s*1.45,0.35,6.3); g.add(eye);
    for(let i=0;i<3;i++){
      const gill = new THREE.Mesh(new THREE.BoxGeometry(0.06,0.85,0.16), darkM);
      gill.position.set(s*1.62,0,4.6-i*0.65);
      gill.rotation.z = s*0.28;
      g.add(gill);
    }
  }
  const dorsal = new THREE.Mesh(new THREE.ConeGeometry(1.0,2.6,4), skin);
  dorsal.scale.set(0.22,1,1.0);
  dorsal.position.set(0,1.9,1.8); g.add(dorsal);
  for(const s of [-1,1]){
    const pectoral = new THREE.Mesh(new THREE.ConeGeometry(1.05,2.6,4), skin);
    pectoral.scale.set(0.16,1,0.9);
    pectoral.position.set(s*2.5,-0.5,4.2);
    pectoral.rotation.z = s*-1.15;
    g.add(pectoral);
  }
  const tail = new THREE.Group(); tail.position.set(0,0,-6.6); g.add(tail);
  const peduncle = new THREE.Mesh(new THREE.CylinderGeometry(0.55,0.3,1.6,8), skin);
  peduncle.rotation.x = Math.PI/2; peduncle.position.z = -0.6; tail.add(peduncle);
  const upLobe = new THREE.Mesh(new THREE.ConeGeometry(0.95,2.9,4), skin);
  upLobe.scale.set(0.2,1,0.95);
  upLobe.position.set(0,0.75,-2.0);
  upLobe.rotation.x = -0.5;
  tail.add(upLobe);
  const loLobe = new THREE.Mesh(new THREE.ConeGeometry(0.7,1.9,4), skin);
  loLobe.scale.set(0.18,1,0.8);
  loLobe.position.set(0,-0.55,-1.5);
  loLobe.rotation.x = -2.55;
  tail.add(loLobe);
  g.rotation.order = 'YXZ';
  scene.add(g);
  colBox(g, 4.2, 3.4, 17, 0, 0, 0);
  const mega = { group:g, tail, point:g.position, colType:'mega', capR:600,
    state:'roam', timer:rnd(18,35), heading:rnd(0,6.28),
    passT:0, passLen:760, from:new THREE.Vector3(), to:new THREE.Vector3(),
    label:()=> distToPlayer(mega.point) < 520 ? 'МЕГАЛОДОН · 16 МЕТРОВ · ОН ВЫСЛЕЖИВАЕТ ВАС' : null };
  placeAhead(mega.point, 700, 1100, 3.2, world.islands);
  mega.point.y = -46;
  mega.update = (dt,t)=>{
    if(mega.state === 'roam'){
      mega.timer -= dt;
      mega.heading += Math.sin(t*0.1)*0.1*dt;
      mega.point.x += Math.sin(mega.heading)*4.5*dt;
      mega.point.z += Math.cos(mega.heading)*4.5*dt;
      const ty = clamp(seafloorY(mega.point.x, mega.point.z)+12, -80, -10);
      mega.point.y += (ty - mega.point.y)*Math.min(1, dt*0.5);
      if(distToPlayer(mega.point) < 350) mega.heading += dt*0.6;
      if(mega.timer <= 0){
        const dirA = rnd(0, Math.PI*2);
        const dx = Math.sin(dirA), dz = Math.cos(dirA);
        const px = dz, pz = -dx;
        const off = rnd(20,60)*(Math.random()<0.5?-1:1);
        const yTgt = player.pos.y > -5 ? rnd(-4.4,-3.2)
          : clamp(player.pos.y+rnd(-30,20), -85, -16);
        const mx = player.pos.x + px*off;
        const mz = player.pos.z + pz*off;
        mega.from.set(mx - dx*380, yTgt, mz - dz*380);
        mega.to.set(mx + dx*380, yTgt + rnd(-10,10), mz + dz*380);
        mega.point.copy(mega.from);
        mega.state = 'pass'; mega.passT = 0;
      }
    } else {
      mega.passT += 11*dt;
      const k = clamp(mega.passT/mega.passLen, 0, 1);
      mega.point.lerpVectors(mega.from, mega.to, k);
      mega.point.y = Math.max(mega.point.y, seafloorY(mega.point.x, mega.point.z)+9);
      if(k >= 1){ mega.state='roam'; mega.timer=rnd(35,70); mega.heading=rnd(0,6.28); }
    }
    g.rotation.y = mega.state==='pass'
      ? Math.atan2(mega.to.x-mega.from.x, mega.to.z-mega.from.z) : mega.heading;
    const wig = Math.sin(t*(mega.state==='pass'?2.0:1.2));
    tail.rotation.y = wig*0.35;
    g.rotation.z = wig*0.06;
    g.rotation.x = Math.sin(t*0.4)*0.03;
  };
  return mega;
}