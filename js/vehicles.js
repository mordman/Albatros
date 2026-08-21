import * as THREE from 'three';
import { scene, camera } from './engine.js';
import { clamp, BOAT, SUB, MOTO, rnd } from './config.js';
import { player, state, game } from './state.js';
import { M, mat } from './materials.js';
import { makeHull, strutBetween, wingGeo, colBox } from './helpers.js';
import { particles, splash, bubbles } from './particles.js';
import { waterY } from './environment.js';
import { seafloorY } from './seafloor.js';
import { groundAt, archSpawn, ensureArchNear } from './arch.js';
import { crash, crashPos } from './collisions.js';
import { captionNow } from './hud.js';

const tmpV = new THREE.Vector3();
const tmpV2 = new THREE.Vector3();
const camTarget = new THREE.Vector3();
const fwd = new THREE.Vector3();
const rnd2 = (a,b)=> a + Math.random()*(b-a);
let sprayT = 0, siltT = 0, bubT2 = 0, wakeT2 = 0, dustT = 0;

/* ===== ГИДРОПЛАН «ЧАЙКА-07» ===== */
export const planeG = new THREE.Group();
planeG.rotation.order = 'YXZ';
const PG = planeG.userData;
{
  const prof = [[0.05,-3.7],[0.12,-3.3],[0.22,-2.6],[0.34,-1.8],[0.44,-1.0],[0.50,-0.3],
                [0.52,0.3],[0.50,1.0],[0.46,1.6],[0.40,2.1],[0.33,2.5]]
                .map(p=>new THREE.Vector2(p[0],p[1]));
  const fusGeo = new THREE.LatheGeometry(prof, 18);
  fusGeo.rotateX(Math.PI/2);
  const fus = new THREE.Mesh(fusGeo, M.planeA);
  fus.scale.set(0.92, 1.08, 1);
  planeG.add(fus);
  const cowlGeo = new THREE.CylinderGeometry(0.38, 0.46, 0.78, 14);
  cowlGeo.rotateX(Math.PI/2);
  const cowl = new THREE.Mesh(cowlGeo, M.planeR);
  cowl.position.z = 2.85; planeG.add(cowl);
  const lip = new THREE.Mesh(new THREE.TorusGeometry(0.38, 0.045, 6, 16), M.planeD);
  lip.position.z = 3.22; planeG.add(lip);
  for(let i=0;i<7;i++){
    const a = i/7*Math.PI*2;
    const hd = new THREE.Mesh(new THREE.BoxGeometry(0.13,0.16,0.2), M.planeD);
    hd.position.set(Math.cos(a)*0.34, Math.sin(a)*0.34, 3.06);
    hd.rotation.z = a; planeG.add(hd);
  }
  const exh = new THREE.Mesh(new THREE.CylinderGeometry(0.06,0.06,0.55,6), M.planeD);
  exh.position.set(0.46, -0.02, 2.5); exh.rotation.z = 1.1; planeG.add(exh);
  const prop = new THREE.Group(); prop.position.z = 3.3; planeG.add(prop); PG.prop = prop;
  for(let i=0;i<2;i++){
    const hold = new THREE.Group(); hold.rotation.z = i*Math.PI; prop.add(hold);
    const bg = new THREE.BoxGeometry(0.17, 1.5, 0.055, 1, 4, 1);
    const bp = bg.attributes.position;
    for(let j=0;j<bp.count;j++){
      const t = Math.abs(bp.getY(j))/1.5;
      bp.setX(j, bp.getX(j)*(1 - t*0.65));
      bp.setZ(j, bp.getZ(j)*(1 - t*0.4));
    }
    bg.computeVertexNormals();
    const bl = new THREE.Mesh(bg, mat(0x5b3a24,{r:.6}));
    bl.position.y = 0.75; bl.rotation.y = 0.45;
    hold.add(bl);
  }
  const spinGeo = new THREE.ConeGeometry(0.15, 0.45, 12);
  spinGeo.rotateX(Math.PI/2);
  const spin = new THREE.Mesh(spinGeo, M.planeD);
  spin.position.z = 3.52; planeG.add(spin);
  const disc = new THREE.Mesh(new THREE.CircleGeometry(1.55, 24),
    new THREE.MeshBasicMaterial({ color:0x2a2f36, transparent:true, opacity:0.12, side:THREE.DoubleSide }));
  disc.position.z = 0.06; prop.add(disc);
  const wing = new THREE.Mesh(wingGeo(10.4, 1.8, 0.18, 0.42, 0.5, 0.28), M.planeA);
  wing.position.set(0, 1.02, 0.35); planeG.add(wing);
  for(const s of [-1,1]){
    const tip = new THREE.Mesh(new THREE.BoxGeometry(0.55,0.1,1.0), M.planeR);
    tip.position.set(s*5.0, 1.5, 0.95); planeG.add(tip);
  }
  const mkAil = (s)=>{
    const gr = new THREE.Group(); gr.position.set(s*3.9, 1.32, 0.85);
    const m = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.07, 0.45), M.planeR);
    m.position.z = 0.24; gr.add(m);
    planeG.add(gr); return gr;
  };
  PG.ailL = mkAil(-1); PG.ailR = mkAil(1);
  planeG.add(strutBetween(-0.3,0.45,0.85, -0.6,1.0,0.75, 0.04, M.planeD));
  planeG.add(strutBetween( 0.3,0.45,0.85,  0.6,1.0,0.75, 0.04, M.planeD));
  planeG.add(strutBetween(-0.3,0.45,0.1,  -0.6,1.0,0.15, 0.04, M.planeD));
  planeG.add(strutBetween( 0.3,0.45,0.1,   0.6,1.0,0.15, 0.04, M.planeD));
  for(const s of [-1,1]){
    planeG.add(strutBetween(s*0.5,-0.3,0.95, s*2.9,1.18,0.7, 0.045, M.planeD));
    planeG.add(strutBetween(s*0.5,-0.3,0.05, s*2.9,1.18,0.25, 0.045, M.planeD));
    planeG.add(strutBetween(s*5.0,1.45,0.9, s*0.35,0.2,2.3, 0.015, M.planeD));
  }
  const pit = new THREE.Mesh(new THREE.BoxGeometry(0.85,0.22,1.15), M.planeD);
  pit.position.set(0, 0.5, 0.85); planeG.add(pit);
  const glassM = new THREE.MeshStandardMaterial({ color:0x9db8c8, transparent:true, opacity:0.32,
    roughness:0.1, side:THREE.DoubleSide });
  const ws = new THREE.Mesh(new THREE.PlaneGeometry(0.95,0.5), glassM);
  ws.position.set(0, 1.0, 1.18); ws.rotation.x = -0.45; planeG.add(ws);
  const wsT = new THREE.Mesh(new THREE.BoxGeometry(0.98,0.05,0.05), M.planeD);
  wsT.position.set(0, 1.2, 1.28); planeG.add(wsT);
  for(const s of [-1,1]){
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.05,0.6,0.05), M.planeD);
    post.position.set(s*0.46, 1.0, 1.12); post.rotation.z = -s*0.18; planeG.add(post);
  }
  const pb = new THREE.Mesh(new THREE.CapsuleGeometry(0.17,0.28,3,7), mat(0x7a5a3a));
  pb.position.set(0, 0.72, 0.75); planeG.add(pb);
  const ph = new THREE.Mesh(new THREE.SphereGeometry(0.15,9,7), mat(0x9a7a58));
  ph.position.set(0, 0.95, 0.8); planeG.add(ph);
  const cap = new THREE.Mesh(new THREE.SphereGeometry(0.155,9,7), M.planeD);
  cap.scale.y = 0.62; cap.position.set(0, 1.0, 0.8); planeG.add(cap);
  const scarf = new THREE.Mesh(new THREE.PlaneGeometry(0.14,0.55), mat(0xd2543a,{ds:1}));
  scarf.position.set(0.06, 0.78, 0.55); scarf.rotation.x = 1.0;
  planeG.add(scarf); PG.scarf = scarf;
  const stab = new THREE.Mesh(wingGeo(3.3, 0.95, 0.1, 0.35, 0.05, 0.12), M.planeA);
  stab.position.set(0, 0.34, -3.25); planeG.add(stab);
  const elev = new THREE.Group(); elev.position.set(0, 0.34, -3.6);
  planeG.add(elev); PG.elev = elev;
  const em = new THREE.Mesh(new THREE.BoxGeometry(3.0,0.07,0.44), M.planeR);
  em.position.z = -0.23; elev.add(em);
  const finGeo = new THREE.BoxGeometry(0.09, 1.35, 1.05, 1, 4, 2);
  const fp = finGeo.attributes.position;
  for(let i=0;i<fp.count;i++){
    const t = (fp.getY(i)+0.675)/1.35;
    fp.setZ(i, fp.getZ(i)*(1 - t*0.4) - t*t*0.5);
  }
  finGeo.computeVertexNormals();
  const fin = new THREE.Mesh(finGeo, M.planeR);
  fin.position.set(0, 0.95, -3.4); planeG.add(fin);
  const rud = new THREE.Group(); rud.position.set(0, 0.95, -3.85);
  planeG.add(rud); PG.rud = rud;
  const rm = new THREE.Mesh(new THREE.BoxGeometry(0.07,1.15,0.5), M.planeA);
  rm.position.z = -0.25; rud.add(rm);
  planeG.add(strutBetween(0,1.6,-3.55, 0,1.3,1.25, 0.012, M.planeD));
  const rc = document.createElement('canvas'); rc.width = 256; rc.height = 64;
  const rx = rc.getContext('2d');
  rx.fillStyle = '#d2543a'; rx.font = '700 40px monospace';
  rx.textAlign = 'center'; rx.textBaseline = 'middle';
  rx.fillText('ЧАЙКА-07', 128, 34);
  const regT = new THREE.CanvasTexture(rc); regT.colorSpace = THREE.SRGBColorSpace;
  const regM = new THREE.MeshBasicMaterial({ map:regT, transparent:true, side:THREE.DoubleSide });
  for(const s of [-1,1]){
    const d = new THREE.Mesh(new THREE.PlaneGeometry(1.7, 0.42), regM);
    d.position.set(s*0.55, 0.12, -0.5); d.rotation.y = -s*Math.PI/2;
    planeG.add(d);
  }
  const navMat = c => new THREE.MeshStandardMaterial({ color:0x111111, emissive:c, emissiveIntensity:3 });
  PG.nav = [];
  const nl = new THREE.Mesh(new THREE.SphereGeometry(0.09,8,6), navMat(0xff2a1a));
  nl.position.set(-5.05, 1.5, 0.85); planeG.add(nl); PG.nav.push(nl);
  const nr = new THREE.Mesh(new THREE.SphereGeometry(0.09,8,6), navMat(0x2aff5a));
  nr.position.set(5.05, 1.5, 0.85); planeG.add(nr); PG.nav.push(nr);
  const nt = new THREE.Mesh(new THREE.SphereGeometry(0.07,8,6), navMat(0xffffff));
  nt.position.set(0, 1.62, -3.75); nt.userData.steady = true;
  planeG.add(nt); PG.nav.push(nt);
  const bc = new THREE.Mesh(new THREE.SphereGeometry(0.07,8,6), navMat(0xff2a1a));
  bc.position.set(0, 0.62, -0.5); bc.userData.inv = true;
  planeG.add(bc); PG.nav.push(bc);
  for(const s of [-1,1]){
    const fl = makeHull(4.4, 0.9, 1.0, M.planeR);
    fl.position.set(s*2.3, -1.32, 0.8); planeG.add(fl);
    const step = new THREE.Mesh(new THREE.BoxGeometry(0.95,0.16,0.55), M.planeR);
    step.position.set(0, -0.55, -0.55); fl.add(step);
    const wr2 = new THREE.Mesh(new THREE.BoxGeometry(0.05,0.32,0.26), M.planeR);
    wr2.position.set(0, -0.42, -1.95); fl.add(wr2);
    planeG.add(strutBetween(s*2.3,-0.9,1.9, s*0.5,-0.3,1.35, 0.045, M.planeD));
    planeG.add(strutBetween(s*2.3,-0.9,-0.3, s*0.5,-0.3,-0.1, 0.045, M.planeD));
  }
}
scene.add(planeG);

/* ===== КАТЕР «СТРЕЛА» ===== */
export const boatG = new THREE.Group();
boatG.rotation.order = 'YXZ';
const BG = boatG.userData;
{
  const hullRed = mat(0x8a3b26,{r:.4});
  const hull = makeHull(7.6, 2.7, 1.9, hullRed);
  hull.position.y = 0.3; boatG.add(hull);
  const dkGeo = new THREE.BoxGeometry(1.9,0.14,5.4,4,1,10);
  { const p=dkGeo.attributes.position;
    for(let i=0;i<p.count;i++){
      const t=Math.abs(p.getZ(i))/2.7;
      p.setX(i,p.getX(i)*(1-t*t*0.5));
    } dkGeo.computeVertexNormals(); }
  const dk = new THREE.Mesh(dkGeo, M.deck);
  dk.position.set(0,1.2,0.1); boatG.add(dk);
  const bowGeo = new THREE.BoxGeometry(1.6,0.14,1.8,4,1,4);
  { const p=bowGeo.attributes.position;
    for(let i=0;i<p.count;i++){
      const t=(p.getZ(i)+0.9)/1.8;
      p.setX(i,p.getX(i)*(1-t*t*0.85));
    } bowGeo.computeVertexNormals(); }
  const bowD = new THREE.Mesh(bowGeo, M.deck);
  bowD.position.set(0,1.2,2.9); boatG.add(bowD);
  for(const s of [-1,1]){
    const rail = new THREE.Mesh(new THREE.BoxGeometry(0.16,0.09,4.2), M.cream);
    rail.position.set(s*1.18,1.32,-0.6); boatG.add(rail);
    for(const zz of [1.0,-1.8]){
      const cl = new THREE.Mesh(new THREE.CylinderGeometry(0.05,0.05,0.16,6), M.steel);
      cl.position.set(s*1.1,1.32,zz); boatG.add(cl);
    }
  }
  const glassB = new THREE.MeshStandardMaterial({ color:0x9db8c8, transparent:true, opacity:0.35,
    roughness:0.1, side:THREE.DoubleSide });
  for(const s of [-1,1]){
    const gp = new THREE.Mesh(new THREE.PlaneGeometry(0.8,0.6), glassB);
    gp.position.set(s*0.42,1.78,0.95);
    gp.rotation.order='YXZ';
    gp.rotation.y = -s*0.45; gp.rotation.x = -0.35;
    boatG.add(gp);
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.03,0.03,0.62,6), M.steel);
    post.position.set(s*0.78,1.78,0.78); post.rotation.z = -s*0.35; post.rotation.x = -0.3;
    boatG.add(post);
  }
  const cpost = new THREE.Mesh(new THREE.CylinderGeometry(0.03,0.03,0.62,6), M.steel);
  cpost.position.set(0,1.82,1.02); cpost.rotation.x = -0.35; boatG.add(cpost);
  const dash = new THREE.Mesh(new THREE.BoxGeometry(1.5,0.3,0.5), M.planeD);
  dash.position.set(0,1.42,0.85); boatG.add(dash);
  const wheel = new THREE.Group();
  wheel.add(new THREE.Mesh(new THREE.TorusGeometry(0.16,0.024,6,16), mat(0x8a6a44)));
  for(let i=0;i<3;i++){
    const sp = new THREE.Mesh(new THREE.CylinderGeometry(0.013,0.013,0.32,5), M.dark);
    sp.rotation.z = i*Math.PI/3; wheel.add(sp);
  }
  wheel.rotation.x = -0.55;
  wheel.position.set(0,1.62,0.62);
  boatG.add(wheel); BG.wheel = wheel;
  const drvB = new THREE.Mesh(new THREE.CapsuleGeometry(0.16,0.24,3,7), mat(0x7a5a3a));
  drvB.position.set(0,1.72,0.28); boatG.add(drvB);
  const drvH = new THREE.Mesh(new THREE.SphereGeometry(0.14,9,7), mat(0x9a7a58));
  drvH.position.set(0,1.98,0.3); boatG.add(drvH);
  const drvC = new THREE.Mesh(new THREE.SphereGeometry(0.145,9,7), M.planeD);
  drvC.scale.y=0.6; drvC.position.set(0,2.03,0.3); boatG.add(drvC);
  boatG.add(strutBetween(0,1.7,0.42, 0,1.6,0.7, 0.045, mat(0x7a5a3a)));
  const seatBase = new THREE.Mesh(new THREE.BoxGeometry(1.5,0.22,0.55), M.woodDark);
  seatBase.position.set(0,1.31,-1.35); boatG.add(seatBase);
  const seatB = new THREE.Mesh(new THREE.BoxGeometry(1.5,0.18,0.55), M.planeR);
  seatB.position.set(0,1.48,-1.35); boatG.add(seatB);
  const seatBack = new THREE.Mesh(new THREE.BoxGeometry(1.5,0.5,0.14), M.planeR);
  seatBack.position.set(0,1.7,-1.62); seatBack.rotation.x = -0.12; boatG.add(seatBack);
  const engB = new THREE.Mesh(new THREE.BoxGeometry(1.7,0.7,1.6), hullRed);
  engB.position.set(0,1.5,-2.35); boatG.add(engB);
  const engTop = new THREE.Mesh(new THREE.BoxGeometry(1.62,0.28,1.5), hullRed);
  engTop.position.set(0,1.98,-2.35); boatG.add(engTop);
  for(let i=0;i<3;i++) for(const s of [-1,1]){
    const v = new THREE.Mesh(new THREE.BoxGeometry(0.05,0.05,1.1), M.dark);
    v.position.set(s*0.83,1.62+i*0.15,-2.35); boatG.add(v);
  }
  const navMatB = c => new THREE.MeshStandardMaterial({ color:0x111111, emissive:c, emissiveIntensity:3 });
  const nl2 = new THREE.Mesh(new THREE.SphereGeometry(0.06,8,6), navMatB(0xff2a1a));
  nl2.position.set(-0.72,1.42,2.15); boatG.add(nl2);
  const nr2 = new THREE.Mesh(new THREE.SphereGeometry(0.06,8,6), navMatB(0x2aff5a));
  nr2.position.set(0.72,1.42,2.15); boatG.add(nr2);
  const nw2 = new THREE.Mesh(new THREE.SphereGeometry(0.06,8,6), navMatB(0xffffff));
  nw2.position.set(0,2.1,-3.15); boatG.add(nw2);
  const fpole = new THREE.Mesh(new THREE.CylinderGeometry(0.02,0.02,1.0,5), M.steel);
  fpole.position.set(0,1.75,3.35); fpole.rotation.x = -0.35; boatG.add(fpole);
  const bflag = new THREE.Mesh(new THREE.PlaneGeometry(0.6,0.32), mat(0xb4432f,{ds:1}));
  bflag.position.set(0.3,2.12,3.2); boatG.add(bflag); BG.flag = bflag;
  const wakeAnchor = new THREE.Object3D();
  wakeAnchor.position.set(0,-0.1,-3.5); boatG.add(wakeAnchor);
  BG.wakeAnchor = wakeAnchor; BG.wakeT = 0; BG.sprayT = 0;
}
scene.add(boatG);

/* ===== БАТИСКАФ «ОРЛАН» ===== */
export const subG = new THREE.Group();
subG.rotation.order = 'YXZ';
export const SG = subG.userData;
{
  const orange  = mat(0xd95f2b,{r:.5,m:.15});
  const orangeD = mat(0xb54a1f,{r:.55,m:.15});
  const steelB  = mat(0x9aa5ad,{r:.35,m:.6});
  const steelBD = mat(0x6e787f,{r:.5,m:.5});
  const glassB = new THREE.MeshStandardMaterial({ color:0x9db8c8, transparent:true, opacity:0.45,
    roughness:0.1, metalness:0.2, side:THREE.DoubleSide });
  const floatM = new THREE.Mesh(new THREE.SphereGeometry(2.05,20,14), orange);
  floatM.scale.set(1,0.72,1.12);
  floatM.position.y = 3.35;
  subG.add(floatM);
  for(const dy of [3.05, 3.65]){
    const belt = new THREE.Mesh(new THREE.TorusGeometry(2.0,0.075,7,26), steelBD);
    belt.rotation.x = Math.PI/2;
    belt.scale.z = 1.12;
    belt.position.y = dy;
    subG.add(belt);
  }
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.5,0.62,0.9,12), steelBD);
  neck.position.y = 1.85; subG.add(neck);
  const hatch = new THREE.Mesh(new THREE.CylinderGeometry(0.42,0.5,0.34,12), orangeD);
  hatch.position.y = 4.85; subG.add(hatch);
  const hatchCap = new THREE.Mesh(new THREE.CylinderGeometry(0.2,0.24,0.18,10), steelBD);
  hatchCap.position.y = 5.08; subG.add(hatchCap);
  const ant = new THREE.Mesh(new THREE.CylinderGeometry(0.022,0.022,1.3,6), steelBD);
  ant.position.set(0.75,5.35,-0.45); subG.add(ant);
  const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.09,8,6),
    mat(0x551512,{e:0xff4530,ei:2.5}));
  beacon.position.set(0.75,6.0,-0.45); subG.add(beacon);
  SG.beacon = beacon;
  const gondola = new THREE.Mesh(new THREE.SphereGeometry(1.6,22,16), steelB);
  subG.add(gondola);
  const gBelt = new THREE.Mesh(new THREE.TorusGeometry(1.61,0.055,6,30), steelBD);
  gBelt.rotation.x = Math.PI/2; subG.add(gBelt);
  const portHole = new THREE.Mesh(new THREE.TorusGeometry(0.78,0.1,8,22), steelBD);
  portHole.position.set(0,0.1,1.38); subG.add(portHole);
  const portGlass = new THREE.Mesh(new THREE.CircleGeometry(0.74,22), glassB);
  portGlass.position.set(0,0.1,1.39); subG.add(portGlass);
  for(let i=0;i<8;i++){
    const a = i/8*Math.PI*2;
    const bolt = new THREE.Mesh(new THREE.SphereGeometry(0.045,6,5), steelBD);
    bolt.position.set(Math.cos(a)*0.88, 0.1+Math.sin(a)*0.88, 1.33);
    subG.add(bolt);
  }
  for(const s of [-1,1]){
    const p2 = new THREE.Mesh(new THREE.TorusGeometry(0.3,0.05,6,16), steelBD);
    p2.rotation.y = s*Math.PI/2;
    p2.position.set(s*1.56,0.35,0.35);
    subG.add(p2);
    const g2 = new THREE.Mesh(new THREE.CircleGeometry(0.27,16), glassB);
    g2.rotation.y = s*Math.PI/2;
    g2.position.set(s*1.57,0.35,0.35);
    subG.add(g2);
  }
  SG.cones = []; SG.spots = []; SG.lenses = [];
  for(const s of [-1,1]){
    const hous = new THREE.Mesh(new THREE.CylinderGeometry(0.2,0.24,0.4,12), steelBD);
    hous.rotation.x = Math.PI/2;
    hous.position.set(s*0.85,-0.35,1.45);
    subG.add(hous);
    const lens = new THREE.Mesh(new THREE.SphereGeometry(0.17,10,8),
      mat(0x2a2415,{e:0xffe9b0,ei:0.4}));
    lens.position.set(s*0.85,-0.35,1.68);
    subG.add(lens);
    const spot = new THREE.SpotLight(0xffe9c0, 0, 300, 0.5, 0.6, 1.1);
    spot.position.set(s*0.85,-0.35,1.6);
    const tgt = new THREE.Object3D();
    tgt.position.set(s*2.2,-2.6,42);
    subG.add(tgt);
    spot.target = tgt;
    subG.add(spot);
    const coneGeo = new THREE.ConeGeometry(7,46,12,1,true);
    coneGeo.rotateX(-Math.PI/2);
    coneGeo.translate(0,0,23);
    const cone = new THREE.Mesh(coneGeo, new THREE.MeshBasicMaterial({
      color:0xfff2cc, transparent:true, opacity:0.05,
      blending:THREE.AdditiveBlending, depthWrite:false, fog:false, side:THREE.DoubleSide }));
    cone.position.set(s*0.85,-0.35,1.7);
    cone.rotation.x = -0.06; cone.rotation.y = -s*0.05;
    cone.visible = false;
    subG.add(cone);
    SG.cones.push(cone); SG.spots.push(spot); SG.lenses.push(lens);
  }
  SG.props = [];
  for(const s of [-1,1]){
    const duct = new THREE.Mesh(new THREE.TorusGeometry(0.5,0.09,8,20), orangeD);
    duct.position.set(s*1.12,0,-1.2);
    subG.add(duct);
    const pr = new THREE.Group();
    pr.position.copy(duct.position);
    for(let i=0;i<3;i++){
      const hold = new THREE.Group(); hold.rotation.z = i*(Math.PI*2/3);
      const bl = new THREE.Mesh(new THREE.BoxGeometry(0.07,0.36,0.05), steelBD);
      bl.position.y = 0.22;
      hold.add(bl); pr.add(hold);
    }
    subG.add(pr); SG.props.push(pr);
  }
  for(const s of [-1,1]){
    const rail = new THREE.Mesh(new THREE.BoxGeometry(0.2,0.2,2.7), steelBD);
    rail.position.set(s*0.85,-1.85,0.1);
    subG.add(rail);
    for(let i=0;i<2;i++)
      subG.add(strutBetween(s*0.85,-1.75,-0.7+i*1.6, s*1.05,-1.15,-0.7+i*1.6, 0.05, steelBD));
    for(let i=0;i<3;i++){
      const w = new THREE.Mesh(new THREE.BoxGeometry(0.42,0.5,0.62), steelB);
      w.position.set(s*0.85,-1.5,-0.7+i*0.85);
      subG.add(w);
    }
  }
  const rc2 = document.createElement('canvas'); rc2.width=256; rc2.height=64;
  const rx2 = rc2.getContext('2d');
  rx2.fillStyle = '#20262b'; rx2.font='700 44px monospace';
  rx2.textAlign='center'; rx2.textBaseline='middle';
  rx2.fillText('ОРЛАН',128,34);
  const regT2 = new THREE.CanvasTexture(rc2); regT2.colorSpace = THREE.SRGBColorSpace;
  const regM2 = new THREE.MeshBasicMaterial({ map:regT2, transparent:true, side:THREE.DoubleSide });
  for(const s of [-1,1]){
    const d = new THREE.Mesh(new THREE.PlaneGeometry(2.0,0.5), regM2);
    d.position.set(s*2.08,3.35,0); d.rotation.y = -s*Math.PI/2;
    subG.add(d);
  }
}
scene.add(subG);

/* ===== МОТОЦИКЛ «СТРИЖ» ===== */
export const motoG = new THREE.Group();
motoG.rotation.order = 'YXZ';
export const MG = motoG.userData;
{
  const wheel = ()=>{
    const w = new THREE.Group();
    w.add(new THREE.Mesh(new THREE.TorusGeometry(0.30, 0.09, 8, 20), M.rubber));
    w.add(new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.03, 6, 16), M.motoChrome));
    for(let i=0;i<4;i++){
      const sp = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.42, 0.02), M.motoChrome);
      sp.rotation.z = i*Math.PI/4;
      w.add(sp);
    }
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.05,0.05,0.14,8), M.motoChrome);
    hub.rotation.z = Math.PI/2;
    w.add(hub);
    return w;
  };
  MG.wheelR = wheel(); MG.wheelR.position.set(0, 0.33, -0.72); motoG.add(MG.wheelR);
  const front = new THREE.Group();
  front.position.set(0, 0.95, 0.45);
  for(const s of [-1,1])
    front.add(strutBetween(s*0.09, 0.05, 0, s*0.09, -0.62, 0.28, 0.035, M.motoChrome));
  MG.wheelF = wheel(); MG.wheelF.position.set(0, -0.62, 0.28); front.add(MG.wheelF);
  const fender = new THREE.Mesh(new THREE.TorusGeometry(0.4, 0.05, 6, 12, Math.PI*0.8), M.motoRed);
  fender.rotation.y = Math.PI/2; fender.rotation.z = -0.4;
  fender.position.set(0, -0.6, 0.28); front.add(fender);
  const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.022,0.022,0.62,6), M.motoChrome);
  bar.rotation.z = Math.PI/2; bar.position.set(0, 0.16, -0.02); front.add(bar);
  for(const s of [-1,1]){
    const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.032,0.032,0.14,6), M.rubber);
    grip.rotation.z = Math.PI/2; grip.position.set(s*0.3, 0.16, -0.02); front.add(grip);
    const mirror = new THREE.Mesh(new THREE.SphereGeometry(0.05,6,5), M.motoChrome);
    mirror.position.set(s*0.26, 0.3, -0.05); front.add(mirror);
  }
  const light = new THREE.Mesh(new THREE.SphereGeometry(0.09,8,6),
    mat(0x333022,{e:0xffedb0,ei:1.6}));
  light.position.set(0, -0.02, 0.12); front.add(light);
  motoG.add(front); MG.front = front;
  const tank = new THREE.Mesh(new THREE.SphereGeometry(0.24,10,8), M.motoRed);
  tank.scale.set(1, 0.75, 1.7); tank.position.set(0, 0.82, 0.12); motoG.add(tank);
  const frame = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.14, 1.0), M.motoChrome);
  frame.position.set(0, 0.55, -0.1); frame.rotation.x = 0.25; motoG.add(frame);
  for(const s of [-1,1])
    motoG.add(strutBetween(s*0.07, 0.86, 0.3, s*0.1, 0.33, -0.68, 0.028, M.motoChrome));
  const seat = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.1, 0.62), M.rubber);
  seat.position.set(0, 0.86, -0.42); motoG.add(seat);
  const tail = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.12, 0.34), M.motoRed);
  tail.position.set(0, 0.92, -0.78); tail.rotation.x = 0.18; motoG.add(tail);
  const engine = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.32, 0.5), M.dark);
  engine.position.set(0, 0.5, -0.05); motoG.add(engine);
  for(const s of [-1,1]){
    const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.045,0.055,0.9,7), M.motoChrome);
    pipe.rotation.x = Math.PI/2 - 0.08;
    pipe.position.set(s*0.17, 0.38, -0.32); motoG.add(pipe);
    const peg = new THREE.Mesh(new THREE.CylinderGeometry(0.025,0.025,0.2,6), M.motoChrome);
    peg.rotation.z = Math.PI/2; peg.position.set(s*0.2, 0.36, -0.15); motoG.add(peg);
  }
  const rearFender = new THREE.Mesh(new THREE.TorusGeometry(0.4, 0.045, 6, 12, Math.PI*0.6), M.motoRed);
  rearFender.rotation.y = Math.PI/2; rearFender.rotation.z = Math.PI + 0.5;
  rearFender.position.set(0, 0.33, -0.72); motoG.add(rearFender);
  const rider = new THREE.Group(); rider.position.set(0, 0.9, -0.3); motoG.add(rider); MG.rider = rider;
  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.14, 0.3, 3, 7), mat(0x3a4650));
  torso.rotation.x = 0.65; torso.position.set(0, 0.18, 0.1); rider.add(torso);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.13, 10, 8), M.helmet);
  head.position.set(0, 0.42, 0.28); rider.add(head);
  const visor = new THREE.Mesh(new THREE.SphereGeometry(0.115, 8, 6, 0, Math.PI), M.glass);
  visor.rotation.y = Math.PI/2; visor.position.set(0, 0.42, 0.3); rider.add(visor);
  for(const s of [-1,1]){
    rider.add(strutBetween(s*0.12, 0.28, 0.2, s*0.3, -0.7, 0.78, 0.04, mat(0x3a4650)));
    rider.add(strutBetween(s*0.1, 0.05, -0.05, s*0.2, -0.5, -0.12, 0.05, mat(0x2c3540)));
    rider.add(strutBetween(s*0.2, -0.5, -0.12, s*0.2, -0.62, 0.05, 0.04, mat(0x2c3540)));
  }
}
scene.add(motoG);

/* запоминание сборки для пересборки после аварии */
function rememberParts(g){
  g.userData.parts = [...g.children];
  g.children.forEach(c=>{
    c.userData._lp = c.position.clone();
    c.userData._lq = c.quaternion.clone();
    c.userData._ls = c.scale.clone();
  });
}
rememberParts(planeG); rememberParts(boatG); rememberParts(subG); rememberParts(motoG);
colBox(planeG, 10.6, 1.8, 7.4, 0, 0.4, 0);
colBox(boatG, 2.8, 2.2, 7.8, 0, 1.1, 0);
colBox(subG, 4.6, 7.2, 4.6, 0, 1.5, 0);
colBox(motoG, 1.4, 1.8, 2.2, 0, 0.9, 0);

export function applyVehicleVisibility(){
  planeG.visible = state.vehicle === 'plane' && !state.crashed;
  boatG.visible  = state.vehicle === 'boat'  && !state.crashed;
  subG.visible   = state.vehicle === 'sub'   && !state.crashed;
  motoG.visible  = state.vehicle === 'moto'  && !state.crashed;
}
export function activeVehicleGroup(){
  return state.vehicle==='sub' ? subG
    : state.vehicle==='boat' ? boatG
    : state.vehicle==='moto' ? motoG : planeG;
}
applyVehicleVisibility();

/* ===== ФИЗИКА ===== */
export function updatePlayer(dt, t){
  if(state.crashed){
    const a = t*0.22;
    camTarget.set(crashPos.x + Math.sin(a)*55, crashPos.y + 26, crashPos.z + Math.cos(a)*55);
    camera.position.lerp(camTarget, 1 - Math.exp(-dt*2));
    camera.lookAt(crashPos);
    return;
  }
  if(state.vehicle === 'boat') updateBoat(dt, t);
  else if(state.vehicle === 'sub') updateSub(dt, t);
  else if(state.vehicle === 'moto') updateMoto(dt, t);
  else updatePlane(dt, t);
}

function updatePlane(dt, t){
  let steer = 0, lift = 0, boost = false;
  if(!state.autopilot){
    steer = ((keys.KeyA||keys.ArrowLeft)?1:0) - ((keys.KeyD||keys.ArrowRight)?1:0);
    lift  = ((keys.KeyW||keys.ArrowUp)?1:0) - ((keys.KeyS||keys.ArrowDown)?1:0);
    boost = !!(keys.ShiftLeft||keys.ShiftRight);
  } else {
    steer = 0.18;
    player.pitch = Math.sin(t*0.3)*0.06;
  }
  player.boost = boost;
  const targetSpeed = boost ? 92 : 44;
  player.speed += (targetSpeed - player.speed)*Math.min(1, dt*1.6);
  if(!state.autopilot){
    player.pitch += lift*dt*0.9;
    player.pitch = clamp(player.pitch, -0.55, 0.65);
    if(!lift) player.pitch *= (1 - Math.min(1, dt*0.8));
  }
  player.yaw += steer*dt*0.9;
  player.bank += (-steer*0.6 - player.bank)*Math.min(1, dt*3);
  player.steerVis += (steer - player.steerVis)*Math.min(1, dt*5);
  const v = player.speed;
  player.pos.x += Math.sin(player.yaw)*Math.cos(player.pitch)*v*dt;
  player.pos.z += Math.cos(player.yaw)*Math.cos(player.pitch)*v*dt;
  player.pos.y += player.pitch*v*dt;
  player.odometer += v*dt;
  const surf = waterY(player.pos.x, player.pos.z, t) + 1.3;
  if(player.pos.y < surf && player.pitch < -0.38 && state.started){
    player.pos.y = surf;
    return crash('жёсткая приводнение');
  }
  const wy = waterY(player.pos.x, player.pos.z, t) + 2.6;
  if(player.pos.y < wy){
    player.pos.y = wy;
    if(player.pitch < 0) player.pitch = 0;
  }
  player.pos.y = Math.min(player.pos.y, 600);
  sprayT -= dt;
  if(player.pos.y - wy < 5 && sprayT <= 0){
    sprayT = 0.06;
    const bx = player.pos.x - Math.sin(player.yaw)*5;
    const bz = player.pos.z - Math.cos(player.yaw)*5;
    splash(bx, waterY(bx,bz,t)+0.3, bz, 3, 0.5);
  }
  planeG.position.copy(player.pos);
  planeG.position.y += Math.sin(t*2.2)*0.1 + Math.sin(t*43)*0.02*(player.speed/92);
  planeG.rotation.set(-player.pitch, player.yaw, player.bank + Math.sin(t*1.7)*0.02);
  PG.prop.rotation.z += dt*(9 + player.speed*0.55);
  PG.ailL.rotation.x = -player.steerVis*0.45;
  PG.ailR.rotation.x =  player.steerVis*0.45;
  PG.elev.rotation.x =  player.pitch*0.45;
  PG.rud.rotation.y  =  player.steerVis*0.5;
  PG.scarf.rotation.y = Math.sin(t*13)*0.35;
  const bl = (t % 1.2) < 0.12;
  PG.nav.forEach(m=>{ m.visible = m.userData.steady ? true : (bl !== m.userData.inv); });
  fwd.set(Math.sin(player.yaw), 0, Math.cos(player.yaw));
  camTarget.copy(player.pos).addScaledVector(fwd, -(13 + player.speed*0.07));
  camTarget.y += 4.2 + player.pitch*4;
  camera.position.lerp(camTarget, 1 - Math.exp(-dt*4));
  camera.lookAt(player.pos.x + fwd.x*10, player.pos.y + 1 + player.pitch*6, player.pos.z + fwd.z*10);
  camera.rotateZ(player.bank*0.22);
  const tFov = boost ? 70 : 62;
  camera.fov += (tFov - camera.fov)*Math.min(1, dt*3);
  camera.updateProjectionMatrix();
}

function updateBoat(dt, t){
  let steer = 0, thrIn = 0, boost = false;
  if(!state.autopilot){
    steer  = ((keys.KeyA||keys.ArrowLeft)?1:0) - ((keys.KeyD||keys.ArrowRight)?1:0);
    thrIn  = ((keys.KeyW||keys.ArrowUp)?1:0) - ((keys.KeyS||keys.ArrowDown)?1:0);
    boost  = !!(keys.ShiftLeft||keys.ShiftRight);
  } else {
    steer = 0.15; thrIn = 0.7;
  }
  player.boost = boost;
  player.steerVis += (steer - player.steerVis)*Math.min(1, dt*5);
  const maxSpd = boost ? BOAT.maxB : BOAT.maxF;
  let target = 0;
  if(thrIn > 0) target = maxSpd;
  else if(thrIn < 0) target = (player.speed > 1) ? 0 : -BOAT.maxR;
  const rate = thrIn === 0 ? 0.4 : 0.55;
  player.speed += (target - player.speed)*Math.min(1, dt*rate);
  if(Math.abs(player.speed) < 0.05 && thrIn === 0) player.speed = 0;
  const spd01 = clamp(Math.abs(player.speed)/BOAT.maxB, 0, 1);
  const dir = player.speed >= 0 ? 1 : -1;
  if(spd01 > 0.02 || thrIn !== 0)
    player.yaw += steer*dir*(0.06 + 0.62*Math.pow(spd01, 0.7))*dt;
  player.bank += (steer*dir*spd01*0.16 - player.bank)*Math.min(1, dt*2.5);
  player.pos.x += Math.sin(player.yaw)*player.speed*dt;
  player.pos.z += Math.cos(player.yaw)*player.speed*dt;
  player.odometer += Math.abs(player.speed)*dt;
  const x = player.pos.x, z = player.pos.z;
  const fx = Math.sin(player.yaw), fz = Math.cos(player.yaw);
  const wy = waterY(x, z, t);
  player.pos.y += (wy + BOAT.draft - player.pos.y)*Math.min(1, dt*8);
  const hF = waterY(x+fx*2.6, z+fz*2.6, t), hB = waterY(x-fx*2.6, z-fz*2.6, t);
  const hPort = waterY(x-fz*1.2, z+fx*1.2, t), hStar = waterY(x+fz*1.2, z-fx*1.2, t);
  const tPitch = Math.atan2(hB-hF, 5.2)*0.8 - 0.045*spd01;
  player.pitch += (tPitch - player.pitch)*Math.min(1, dt*3);
  const tRoll = Math.atan2(hPort-hStar, 2.4)*0.8;
  boatG.position.copy(player.pos);
  boatG.rotation.set(player.pitch, player.yaw, player.bank*0.55 + tRoll + Math.sin(t*1.9)*0.015);
  BG.wheel.rotation.z = player.steerVis*2.3;
  if(BG.flag) BG.flag.rotation.y = 0.35 + Math.sin(t*9)*0.35;
  BG.wakeT += dt;
  if(Math.abs(player.speed) > 3.5){
    while(BG.wakeT > 0.05){
      BG.wakeT -= 0.05;
      BG.wakeAnchor.getWorldPosition(tmpV);
      const sp = 1 + Math.abs(player.speed)*0.07;
      particles.spawn(tmpV.x+rnd2(-sp,sp), waterY(tmpV.x,tmpV.z,t)+0.12, tmpV.z+rnd2(-sp,sp),
        { life:1.6+Math.random()*1.8, s0:1.0, s1:4.5+Math.abs(player.speed)*0.09,
          r:0.92, g:0.96, b:0.96, a:0.5, vy:0.15 });
    }
  } else BG.wakeT = 0;
  if(player.speed > 13){
    BG.sprayT -= dt;
    if(BG.sprayT <= 0){
      BG.sprayT = 0.06;
      for(const s of [-1,1]){
        tmpV2.set(s*0.85, 0.7, 2.55);
        boatG.localToWorld(tmpV2);
        const k = (2+Math.random()*3)*spd01;
        particles.spawn(tmpV2.x, tmpV2.y, tmpV2.z, {
          vx: -fz*s*k + fx*player.speed*0.15,
          vz:  fx*s*k + fz*player.speed*0.15,
          vy: (3+Math.random()*5)*spd01, life:0.5+Math.random()*0.6, s0:0.8+Math.random()*0.8, s1:0.3,
          r:0.95, g:0.98, b:0.97, a:0.85, grav:-24, drag:0.4 });
      }
    }
  }
  fwd.set(fx, 0, fz);
  camTarget.copy(player.pos).addScaledVector(fwd, -(8.5 + player.speed*0.1));
  camTarget.y = Math.max(player.pos.y + 3.2, waterY(camTarget.x, camTarget.z, t) + 1.8);
  camera.position.lerp(camTarget, 1 - Math.exp(-dt*4));
  camera.lookAt(player.pos.x + fx*8, player.pos.y + 1.7, player.pos.z + fz*8);
  camera.rotateZ(player.bank*0.35);
  const tFov = boost ? 68 : 60;
  camera.fov += (tFov - camera.fov)*Math.min(1, dt*3);
  camera.updateProjectionMatrix();
}

function updateSub(dt, t){
  let steer = 0, lift = 0, boost = false;
  if(!state.autopilot){
    steer = ((keys.KeyA||keys.ArrowLeft)?1:0) - ((keys.KeyD||keys.ArrowRight)?1:0);
    lift  = ((keys.KeyW||keys.ArrowUp)?1:0) - ((keys.KeyS||keys.ArrowDown)?1:0);
    boost = !!(keys.ShiftLeft||keys.ShiftRight);
  } else {
    steer = 0.1;
    lift = Math.sin(t*0.14)*0.55;
  }
  player.boost = boost;
  player.steerVis += (steer - player.steerVis)*Math.min(1, dt*4);
  const target = boost ? SUB.boost : SUB.cruise;
  player.speed += (target - player.speed)*Math.min(1, dt*0.5);
  player.pitch += lift*dt*0.38;
  player.pitch = clamp(player.pitch, -0.42, 0.42);
  if(!lift) player.pitch *= (1 - Math.min(1, dt*1.3));
  player.yaw += steer*dt*(0.3 + player.speed*0.03);
  player.bank += (-steer*0.28 - player.bank)*Math.min(1, dt*1.8);
  const v = player.speed;
  player.pos.x += Math.sin(player.yaw)*Math.cos(player.pitch)*v*dt;
  player.pos.z += Math.cos(player.yaw)*Math.cos(player.pitch)*v*dt;
  player.pos.y += player.pitch*v*dt;
  player.odometer += v*dt;
  const x = player.pos.x, z = player.pos.z;
  const fx = Math.sin(player.yaw), fz = Math.cos(player.yaw);
  const surfY = waterY(x, z, t) + 0.6;
  const atSurface = player.pos.y > surfY - 1.2;
  if(player.pos.y > surfY){
    player.pos.y = surfY;
    if(player.pitch > 0) player.pitch = 0;
  }
  const fy = seafloorY(x, z) + 2.3;
  let onFloor = false;
  if(player.pos.y < fy){
    player.pos.y = fy;
    onFloor = true;
    if(player.pitch < 0) player.pitch *= 0.4;
  }
  player.onFloor = onFloor;
  subG.position.copy(player.pos);
  subG.position.y += atSurface ? Math.sin(t*1.3)*0.1 : Math.sin(t*0.6)*0.03;
  subG.rotation.set(-player.pitch, player.yaw, player.bank + Math.sin(t*0.5)*0.01);
  const pr = dt*(1 + v*0.9);
  SG.props.forEach(p=>{ p.rotation.z += pr; });
  SG.beacon.visible = (t % 1.6) < 0.14;
  if(onFloor && v > 0.8){
    siltT -= dt;
    if(siltT <= 0){
      siltT = 0.07;
      for(let i=0;i<3;i++)
        particles.spawn(x+rnd2(-1.6,1.6), seafloorY(x,z)+0.1+Math.random()*0.7, z+rnd2(-1.6,1.6),
          { vx:rnd2(-0.7,0.7)+fx*v*0.2, vy:0.6+Math.random()*1.2, vz:rnd2(-0.7,0.7)+fz*v*0.2,
            life:2.5+Math.random()*2, s0:1.4+Math.random(), s1:3.5+Math.random()*3,
            r:0.40, g:0.36, b:0.28, a:0.38, drag:0.5 });
    }
  }
  if(player.pos.y < waterY(x,z,t)-2 && v > 1.5){
    bubT2 -= dt;
    if(bubT2 <= 0){
      bubT2 = 0.14;
      for(const s of [-1,1]){
        tmpV2.set(s*1.12, 0, -1.25);
        subG.localToWorld(tmpV2);
        bubbles(tmpV2.x, tmpV2.y, tmpV2.z, 1, 0.7);
      }
    }
  }
  if(atSurface && v > 2){
    wakeT2 -= dt;
    if(wakeT2 <= 0){
      wakeT2 = 0.09;
      tmpV.set(0,-0.5,-2.2);
      subG.localToWorld(tmpV);
      particles.spawn(tmpV.x+rnd2(-1,1), waterY(tmpV.x,tmpV.z,t)+0.12, tmpV.z+rnd2(-1,1),
        { life:1.5+Math.random()*1.5, s0:0.9, s1:3.6, r:0.92, g:0.96, b:0.96, a:0.4, vy:0.12 });
    }
  }
  fwd.set(fx, 0, fz);
  camTarget.copy(player.pos).addScaledVector(fwd, -(10 + v*0.25));
  camTarget.y += 2.6;
  const fyc = seafloorY(camTarget.x, camTarget.z) + 1.4;
  if(camTarget.y < fyc) camTarget.y = fyc;
  camera.position.lerp(camTarget, 1 - Math.exp(-dt*3.5));
  camera.lookAt(player.pos.x + fx*8, player.pos.y + player.pitch*7, player.pos.z + fz*8);
  camera.rotateZ(player.bank*0.3);
  const tFov = boost ? 62 : 56;
  camera.fov += (tFov - camera.fov)*Math.min(1, dt*3);
  camera.updateProjectionMatrix();
}

function updateMoto(dt, t){
  let steer = 0, thr = 0, boost = false;
  if(!state.autopilot){
    steer = ((keys.KeyA||keys.ArrowLeft)?1:0) - ((keys.KeyD||keys.ArrowRight)?1:0);
    thr   = ((keys.KeyW||keys.ArrowUp)?1:0) - ((keys.KeyS||keys.ArrowDown)?1:0);
    boost = !!(keys.ShiftLeft||keys.ShiftRight);
  } else {
    thr = 0.55; steer = Math.sin(t*0.17)*0.4;
  }
  player.boost = boost;
  player.steerVis += (steer - player.steerVis)*Math.min(1, dt*6);
  const maxSpd = boost ? MOTO.boost : MOTO.max;
  let target = 0;
  if(thr > 0) target = maxSpd;
  else if(thr < 0) target = (player.speed > 0.8) ? 0 : -MOTO.rev;
  player.speed += (target - player.speed)*Math.min(1, dt*(thr===0 ? 0.5 : 0.75));
  if(Math.abs(player.speed) < 0.05 && thr === 0) player.speed = 0;
  const spd01 = clamp(Math.abs(player.speed)/MOTO.boost, 0, 1);
  const dir = player.speed >= 0 ? 1 : -1;
  player.yaw += steer*dir*(0.25 + 2.0*Math.pow(spd01, 0.75))*dt;
  player.bank += (-steer*dir*Math.min(spd01*1.4, 0.62) - player.bank)*Math.min(1, dt*5);
  player.pos.x += Math.sin(player.yaw)*player.speed*dt;
  player.pos.z += Math.cos(player.yaw)*player.speed*dt;
  player.odometer += Math.abs(player.speed)*dt;
  const x = player.pos.x, z = player.pos.z;
  const fx = Math.sin(player.yaw), fz = Math.cos(player.yaw);
  const gnd = groundAt(x, z);
  if(gnd){
    player.airborne = false;
    player.vy = 0;
    const ty = gnd.h + 0.36;
    player.pos.y += (ty - player.pos.y)*Math.min(1, dt*12);
    player.onRoad = gnd.road;
    if(!gnd.road) player.speed *= (1 - Math.min(1, dt*0.55));
    const gA = groundAt(x+fx*2.4, z+fz*2.4);
    const slope = gA ? Math.atan2(gA.h - gnd.h, 2.4) : 0;
    const tPitch = slope*0.9 - (thr>0 ? 0.05 : 0)*spd01 + (thr<0 ? 0.04 : 0)*spd01;
    player.pitch += (tPitch - player.pitch)*Math.min(1, dt*7);
    player.bank += (-player.bank)*Math.min(1, dt*2);
    if(Math.abs(player.speed) > 6){
      dustT -= dt;
      if(dustT <= 0){
        dustT = 0.07;
        tmpV.set(0, 0.1, -0.75);
        motoG.localToWorld(tmpV);
        const dusty = !gnd.road;
        particles.spawn(tmpV.x, tmpV.y, tmpV.z, {
          vx:-fx*player.speed*0.25+rnd2(-1,1), vy:0.5+Math.random()*1.1, vz:-fz*player.speed*0.25+rnd2(-1,1),
          life:0.7+Math.random()*0.9, s0:0.5+Math.random()*0.4, s1:1.6+Math.random()*1.2,
          r:dusty?0.75:0.62, g:dusty?0.68:0.60, b:dusty?0.55:0.58, a:dusty?0.4:0.22, drag:1.2 });
      }
    }
  } else {
    player.airborne = true;
    player.onRoad = false;
    player.vy -= 26*dt;
    player.pos.y += player.vy*dt;
    player.pitch += (-0.3 - player.pitch)*Math.min(1, dt*1.6);
    if(player.pos.y < waterY(x,z,t)+0.3)
      return crash('упал в море');
  }
  motoG.position.copy(player.pos);
  motoG.rotation.set(player.pitch, player.yaw, player.bank);
  const wrot = player.speed*dt/0.30;
  MG.wheelF.rotation.x += wrot;
  MG.wheelR.rotation.x += wrot;
  MG.front.rotation.y = player.steerVis*0.45;
  MG.rider.rotation.z = -player.bank*0.55;
  fwd.set(fx, 0, fz);
  camTarget.copy(player.pos).addScaledVector(fwd, -(6.5 + Math.abs(player.speed)*0.08));
  camTarget.y = player.pos.y + 2.4;
  camera.position.lerp(camTarget, 1 - Math.exp(-dt*5));
  camera.lookAt(player.pos.x + fx*9, player.pos.y + 1.2 + player.pitch*4, player.pos.z + fz*9);
  camera.rotateZ(player.bank*0.55);
  const tFov = boost ? 68 : 60;
  camera.fov += (tFov - camera.fov)*Math.min(1, dt*3);
  camera.updateProjectionMatrix();
}

export const keys = {};

const VEH_ORDER = ['plane','boat','sub','moto'];
export function setVehicle(v){
  if(state.crashed) return;
  state.vehicle = v;
  applyVehicleVisibility();
  if(state.autopilot){
    if(v === 'boat'){
      player.pos.y = waterY(player.pos.x, player.pos.z, game.simT) + BOAT.draft;
      player.speed = 14;
    } else if(v === 'sub'){
      player.pos.y = -30;
      player.speed = SUB.cruise;
    } else if(v === 'moto'){
      const sp = archSpawn();
      player.pos.set(sp.x, sp.h+0.5, sp.z);
      player.yaw = sp.yaw;
      player.speed = 12;
    } else {
      player.pos.y = 52; player.speed = 30;
    }
  }
}
export function switchVehicle(){
  if(!state.started || state.crashed) return;
  const i = VEH_ORDER.indexOf(state.vehicle);
  const next = VEH_ORDER[(i+1)%VEH_ORDER.length];
  setVehicle(next);
  const wy = waterY(player.pos.x, player.pos.z, game.simT);
  if(next === 'boat'){
    player.pitch = 0; player.bank = 0;
    player.pos.y = wy + BOAT.draft;
    player.speed = Math.min(Math.abs(player.speed), 18);
    captionNow('ПЕРЕСАДКА · КАТЕР «СТРЕЛА» · W ГАЗ, S ТОРМОЗ/РЕВЕРС');
  } else if(next === 'sub'){
    player.pitch = 0; player.bank = 0;
    player.pos.y = Math.min(player.pos.y, wy - 16);
    player.speed = SUB.cruise;
    captionNow('ПЕРЕСАДКА · БАТИСКАФ «ОРЛАН» · W ВСПЛЫТИЕ · S ПОГРУЖЕНИЕ');
  } else if(next === 'moto'){
    ensureArchNear();
    const sp = archSpawn();
    player.pos.set(sp.x, sp.h+0.5, sp.z);
    player.yaw = sp.yaw;
    player.pitch = 0; player.bank = 0; player.vy = 0;
    player.speed = 10;
    captionNow('ПЕРЕСАДКА · МОТОЦИКЛ «СТРИЖ» · ЕХАЙ К МОСТУ');
  } else {
    player.pitch = 0.08;
    player.pos.y = Math.max(player.pos.y, wy + 50);
    player.speed = Math.max(Math.abs(player.speed), 42);
    captionNow('ПЕРЕСАДКА · ГИДРОПЛАН «ЧАЙКА-07»');
  }
}