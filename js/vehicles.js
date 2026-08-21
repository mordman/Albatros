import * as THREE from 'three';
import { camera } from './engine.js';
import { clamp, BOAT, SUB, MOTO } from './config.js';
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
  fender.rotation.y = Math.PI/2; fender.rotation.z