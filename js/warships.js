import * as THREE from 'three';
import { scene } from './engine.js';
import { WIND, WARSHIP, rnd, clamp } from './config.js';
import { mat } from './materials.js';
import { makeHull, strutBetween, colBox } from './helpers.js';
import { waterY } from './environment.js';
import { particles, explosion, splash, bubbles } from './particles.js';
import { world } from './world.js';
import { game, distToPlayer, placeAhead } from './state.js';
import { boomSound } from './audio.js';
import { showCaption } from './hud.js';

const tmpV = new THREE.Vector3();
const warGray = mat(0x707a80, {r:.6, m:.25});
const warDeck = mat(0x4a545c, {r:.85});
const warDark = mat(0x2f363b, {r:.5, m:.3});

// башня: главная (большие стволы) или зенитная (маленькая, крутится за игроком)
function makeTurret(main){
  const t = new THREE.Group();
  const base = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 1.9, 0.7, 10), warDark);
  base.position.y = 0.35; t.add(base);
  const box = new THREE.Mesh(new THREE.BoxGeometry(3.4, 1.6, 4.2), warGray);
  box.position.y = 1.5; t.add(box);
  const bl = main ? 8 : 3.4;
  const br = main ? 0.22 : 0.07;
  const off = main ? 0.6 : 0.18;
  for(const s of [-1,1]){
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(br, br, bl, 6), warDark);
    barrel.rotation.x = Math.PI/2;
    barrel.position.set(s*off, 1.6, 2.1 + bl/2);
    t.add(barrel);
  }
  if(!main) t.scale.setScalar(0.85);
  return t;
}

export function makeWarship(name){
  const g = new THREE.Group();
  const L = WARSHIP.len, W = WARSHIP.width, H = 7;

  const hull = makeHull(L, W, H, warGray); hull.position.y = 2; g.add(hull);
  const deck = new THREE.Mesh(new THREE.BoxGeometry(W*0.62, 0.4, L*0.78), warDeck);
  deck.position.y = 5.4; g.add(deck);

  // башни главного калира — нос и корма
  const bow = makeTurret(true); bow.position.set(0, 5.4, L*0.30); g.add(bow);
  const stern = makeTurret(true); stern.position.set(0, 5.4, -L*0.30); stern.rotation.y = Math.PI; g.add(stern);

  // надстройка
  const sup1 = new THREE.Mesh(new THREE.BoxGeometry(8, 4.5, 18), warGray);
  sup1.position.set(0, 7.6, 4); g.add(sup1);
  const sup2 = new THREE.Mesh(new THREE.BoxGeometry(6.5, 3, 12), warGray);
  sup2.position.set(0, 11.3, 5); g.add(sup2);
  const bridge = new THREE.Mesh(new THREE.BoxGeometry(7, 1.8, 5), warDark);
  bridge.position.set(0, 13.6, 6); g.add(bridge);
  for(let i=0;i<4;i++){
    const win = new THREE.Mesh(new THREE.BoxGeometry(7.1, 0.5, 0.2), mat(0x16202a,{r:.25}));
    win.position.set(0, 13.4 + (i%2)*0.6, 8.4 + Math.floor(i/2)*1.4);
    g.add(win);
  }
  // труба
  const funnel = new THREE.Mesh(new THREE.CylinderGeometry(1.7, 2.0, 6.5, 12), warDark);
  funnel.position.set(0, 10.8, -8); funnel.rotation.x = -0.06; g.add(funnel);
  const funnelCap = new THREE.Mesh(new THREE.CylinderGeometry(1.9, 1.9, 0.5, 12), warGray);
  funnelCap.position.set(0, 13.9, -8.2); g.add(funnelCap);
  const smokeAnchor = new THREE.Object3D();
  smokeAnchor.position.set(0, 14.2, -8.2); g.add(smokeAnchor);
  // мачта с радаром
  const mastG = new THREE.Group(); mastG.position.set(0, 13, -1); g.add(mastG);
  const mastPole = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.24, 12, 8), warDark);
  mastPole.position.y = 6; mastG.add(mastPole);
  for(let i=0;i<3;i++){
    const bar = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.12, 0.12), warDark);
    bar.position.y = 3 + i*2.6; mastG.add(bar);
  }
  const radar = new THREE.Mesh(new THREE.BoxGeometry(0.2, 1.0, 3.2), warDark);
  radar.position.y = 12.2; mastG.add(radar);
  g.userData.radar = radar;

  // торпедные аппараты по бортам
  for(const s of [-1,1]){
    const tt = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 6, 8), warDark);
    tt.rotation.z = Math.PI/2; tt.rotation.y = s*0.5;
    tt.position.set(s*3.6, 5.9, -18); g.add(tt);
  }
  // якорная цепь / детали носа
  const capstan = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 0.9, 1.2, 10), warDark);
  capstan.position.set(0, 6.1, L*0.36); g.add(capstan);

  // зенитные установки
  const mounts = [];
  const mp = [
    [-W*0.36, 5.6,  L*0.12],
    [ W*0.36, 5.6,  L*0.12],
    [-W*0.36, 5.6, -L*0.14],
    [ W*0.36, 5.6, -L*0.14],
  ];
  for(let i=0;i<Math.min(WARSHIP.gunCount, mp.length);i++){
    const t = makeTurret(false);
    t.position.set(mp[i][0], mp[i][1], mp[i][2]);
    g.add(t);
    mounts.push({ turret:t, timer:rnd(0.5, 2.5), burst:WARSHIP.burst });
  }

  const flag = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 0.8), mat(0xb4432f,{ds:1}));
  flag.position.set(0, 25.4, -1); g.add(flag);

  scene.add(g);
  colBox(g, W, WARSHIP.colH, L, 0, WARSHIP.colH/2, 0);

  // точка повреждений — с неё дым и огонь
  const dmgAnchor = new THREE.Object3D();
  dmgAnchor.position.set(0, 12, 0); g.add(dmgAnchor);

  const s = { group:g, point:g.position, colType:'warship', name,
    hp: WARSHIP.hp, heading: rnd(0,Math.PI*2), turn: rnd(-0.008,0.008),
    rx:0, rz:0, len:L, width:W, colH:WARSHIP.colH,
    capR: 700, recycleAt: 4600, mounts,
    smoking:false, burning:false, sinking:false, sinkT:0, dmgT:0, smT:0,
    label: ()=> `Эсминец «${name}» · прочность ${Math.max(0, Math.round(100*s.hp/WARSHIP.hp))}%` };

  s.update = (dt,t)=>{
    if(s.sinking){
      s.sinkT += dt;
      g.position.y -= (0.25 + s.sinkT*0.05)*dt;
      g.rotation.z += dt*0.06;
      g.rotation.x += dt*0.03;
      const wy = waterY(g.position.x, g.position.z, t);
      s.dmgT -= dt;
      if(g.position.y > wy - 2){
        if(s.dmgT <= 0){
          s.dmgT = 0.09;
          dmgAnchor.getWorldPosition(tmpV);
          for(let k=0;k<2;k++)
            particles.spawn(tmpV.x+rnd(-3,3), tmpV.y, tmpV.z+rnd(-3,3), {
              vx:rnd(-1,1), vy:rnd(2,5), vz:rnd(-1,1),
              life:rnd(.3,.7), s0:rnd(1.5,2.5), s1:rnd(2.5,4.5),
              r:1, g:rnd(.35,.6), b:.1, a:.9, drag:1.5 });
          particles.spawn(tmpV.x, tmpV.y, tmpV.z, {
            vx:WIND.x*0.5+rnd(-.5,.5), vy:rnd(2,4), vz:WIND.z*0.5+rnd(-.5,.5),
            life:rnd(2,4), s0:2, s1:10, r:.2, g:.19, b:.21, a:.5 });
        }
      } else if(s.dmgT <= 0){
        s.dmgT = 0.15;
        bubbles(g.position.x+rnd(-6,6), wy, g.position.z+rnd(-6,6), 4, 1.2);
      }
      if(g.position.y < -95 || s.sinkT > 40){
        s.sinking = false; s.hp = WARSHIP.hp;
        s.smoking = false; s.burning = false; s.sinkT = 0;
        s.rx = 0; s.rz = 0; g.rotation.set(0, s.heading, 0);
        placeAhead(s.point, 1600, 3000, 2.6, world.islands);
      }
      return;
    }

    // ход и качка
    s.heading += s.turn*dt;
    const x = s.point.x + Math.sin(s.heading)*s.speed*dt;
    const z = s.point.z + Math.cos(s.heading)*s.speed*dt;
    s.point.set(x, 0, z);
    const y = waterY(x,z,t) + 2.4;
    const fx=Math.sin(s.heading), fz=Math.cos(s.heading);
    const rx_=Math.atan2(
      waterY(x-fx*s.len*0.38, z-fz*s.len*0.38, t) - waterY(x+fx*s.len*0.38, z+fz*s.len*0.38, t), s.len*0.76);
    const rz_=Math.atan2(
      waterY(x-fz*s.width*0.5, z+fx*s.width*0.5, t) - waterY(x+fz*s.width*0.5, z-fx*s.width*0.5, t), s.width)*0.9;
    s.rx += (clamp(rx_,-0.08,0.08) - s.rx)*Math.min(1,dt*2);
    s.rz += (clamp(rz_,-0.1,0.1) - s.rz)*Math.min(1,dt*2);
    group_set(g, y, s);
    g.userData.radar.rotation.y = t*2.2;
    flag.rotation.y = Math.sin(t*6)*0.5;

    // дым из трубы
    s.smT -= dt;
    if(s.smT <= 0){
      s.smT = 0.2;
      smokeAnchor.getWorldPosition(tmpV);
      particles.spawn(tmpV.x,tmpV.y,tmpV.z, { vx:WIND.x*0.7+rnd(-.4,.4), vy:rnd(3,5), vz:WIND.z*0.7+rnd(-.4,.4),
        life:rnd(3,5), s0:1.6, s1:9, r:0.5,g:0.48,b:0.5, a:0.32 });
    }
    // повреждения
    s.dmgT -= dt;
    if(s.dmgT <= 0 && (s.smoking || s.burning)){
      s.dmgT = 0.1;
      dmgAnchor.getWorldPosition(tmpV);
      if(s.burning){
        particles.spawn(tmpV.x, tmpV.y, tmpV.z, {
          vx:rnd(-.8,.8), vy:rnd(2,4.5), vz:rnd(-.8,.8),
          life:rnd(.25,.6), s0:rnd(1.2,2.2), s1:rnd(2,4),
          r:1, g:rnd(.4,.6), b:.12, a:.85, drag:1.2 });
      }
      particles.spawn(tmpV.x, tmpV.y, tmpV.z, {
        vx:WIND.x*0.6+rnd(-.5,.5), vy:rnd(2.5,4.5), vz:WIND.z*0.6+rnd(-.5,.5),
        life:rnd(2.5,4.5), s0:1.6, s1:9, r:.22, g:.21, b:.23, a:.5 });
    }

    if(distToPlayer(s.point) > s.recycleAt){
      placeAhead(s.point, 1600, 3000, 2.6, world.islands);
      s.hp = WARSHIP.hp; s.smoking = false; s.burning = false;
    }
  };

  function group_set(g, y, s){
    g.position.y = y;
    g.rotation.order = 'YXZ';
    g.rotation.set(s.rx, s.heading, s.rz);
  }

  return s;
}

/* попадание из пулемёта игрока: -1 HP; пороги из настроек; 0 — взрыв и затопление */
export function damageWarship(s, hx, hy, hz){
  if(s.sinking) return;
  s.hp--;
  for(let k=0;k<5;k++)
    particles.spawn(hx, hy, hz, {
      vx:rnd(-6,6), vy:rnd(-1,6), vz:rnd(-6,6),
      life:rnd(.15,.4), s0:rnd(.2,.4), s1:.05,
      r:1, g:.85, b:.4, a:1, grav:-20 });
  if(!s.smoking && s.hp <= WARSHIP.hp*WARSHIP.smokePct/100){
    s.smoking = true;
    showCaption(`«${s.name}» задымился`, 2.5);
  }
  if(!s.burning && s.hp <= WARSHIP.hp*WARSHIP.firePct/100){
    s.burning = true;
    showCaption(`«${s.name}» горит! Добей его!`, 3);
  }
  if(s.hp <= 0){
    s.sinking = true; s.sinkT = 0; s.speed = 0;
    s.group.rotation.order = 'YXZ';
    explosion(s.point.x, s.group.position.y + 6, s.point.z);
    explosion(s.point.x + rnd(-8,8), s.group.position.y + 10, s.point.z + rnd(-8,8));
    splash(s.point.x, waterY(s.point.x, s.point.z, game.simT), s.point.z, 50, 1.4);
    boomSound();
    showCaption(`Эсминец «${s.name}» уничтожен!`, 3.5);
  }
}