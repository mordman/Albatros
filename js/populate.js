import { rnd } from './config.js';
import { world } from './world.js';
import { placeAhead } from './state.js';
import { seafloorY, snapSeafloor } from './seafloor.js';
import { makeSchooner, makeTrawler, makeBoat, makeFlock } from './ships.js';
import { makeIsland } from './islands.js';
import { makeCityIsland } from './city.js';
import { makeWhale, makeFishSchool, makeJelly, makeTurtle, makeRay, makeCrab,
         makeWreck, makeWeedPatch, makeKelp, makeMegalodon } from './creatures.js';
import { makeBalloon, makeBuoy, makeCloud } from './misc.js';
import { makeArch } from './arch.js';
import { makePedestrianGroup } from './pedestrians.js';

const names = a => { const s=[...a]; return ()=> s.length? s.splice(Math.floor(Math.random()*s.length),1)[0] : a[0]; };
const nextShip = names(['Веста','Заря','Аврора','Морж','Селена','Бриз','Тайфун','Поллукс','Нептун','Чайка']);
const nextIsland = names(['остров Крайний','риф Тюлений','скала Св. Ильи','островок Пустынный','банка Медная','остров Северный','риф Чаек','земля Туманная','остров Кормчий','маяк Фарос']);
const nextBalloon = names(['Стрекоза','Зефир','Пассат','Ласточка','Аргонавт']);
const nextCity = names(['Светлогорск','Старая Гавань','Новый Альбион','Китовая Гавань']);
const nextWreck = names(['Левиафан','Мария','Атлант','Сирена']);

{
  const s = makeSchooner(nextShip());
  s.point.set(-280, 0, 950); s.heading = 2.2;
  world.ships.push(s); world.entities.push(s);
}
{
  const i = makeIsland('маяк Фарос');
  i.group.position.set(620, 0, 2100);
  world.islands.push(i); world.entities.push(i);
}
{
  const c = makeCityIsland('Порт-Ветров', Math.atan2(850, -1650));
  c.group.position.set(-850, 0, 1650);
  world.islands.push(c); world.entities.push(c);
  makePedestrianGroup(c, 15);
}
for(let i=0;i<2;i++){ const s=makeSchooner(nextShip()); placeAhead(s.point,1200,2600,2.4); s.heading=rnd(0,6.28); world.ships.push(s); world.entities.push(s); }
for(let i=0;i<3;i++){ const s=makeTrawler(nextShip()); placeAhead(s.point,1200,2600,2.4); s.heading=rnd(0,6.28); world.ships.push(s); world.entities.push(s); }
for(let i=0;i<2;i++){ const s=makeBoat(nextShip()); placeAhead(s.point,900,2000,2.4); s.heading=rnd(0,6.28); world.ships.push(s); world.entities.push(s); }
for(let i=0;i<5;i++){ const isl=makeIsland(nextIsland()); placeAhead(isl.point,1500,3000,2.6,world.islands); world.islands.push(isl); world.entities.push(isl); }
for(let i=0;i<2;i++){
  const c = makeCityIsland(nextCity());
  placeAhead(c.point, 1800, 3200, 2.6, world.islands);
  world.islands.push(c); world.entities.push(c);
  makePedestrianGroup(c, 12 + Math.floor(rnd(0, 8)));
}
{
  const w = makeWhale(); w.point.set(-420, 0, 700); w.timer = 1.6;
  world.whales.push(w); world.entities.push(w);
}
for(let i=0;i<3;i++){ const w=makeWhale(); placeAhead(w.point,600,1500,2.0,world.islands); w.timer=rnd(3,15); world.whales.push(w); world.entities.push(w); }
{
  const f = makeFlock(7, null); f.point.set(60, 40, 380); f.heading = Math.PI/2;
  world.entities.push(f);
}
world.entities.push(makeFlock(6, world.ships[0]));
world.entities.push(makeFlock(5, world.ships[3]));
for(let i=0;i<2;i++){ const f=makeFlock(5+Math.floor(rnd(0,4)), null); placeAhead(f.point,600,1600,2.8); world.entities.push(f); }
{
  const b = makeBalloon(nextBalloon()); b.group.position.set(350, 230, 1500); world.entities.push(b);
}
for(let i=0;i<3;i++){ const b=makeBalloon(nextBalloon()); placeAhead(b.point,900,2200,2.6); b.group.position.y=rnd(130,330); world.entities.push(b); }
for(let i=0;i<8;i++){ const b=makeBuoy(10+i); placeAhead(b.point,300,1400,2.8,world.islands); world.entities.push(b); }
for(let i=0;i<26;i++){
  const c = makeCloud();
  c.group.position.set(rnd(-2800,2800), rnd(280,650), rnd(-2800,2800));
  world.entities.push(c);
}
for(let i=0;i<4;i++){
  const wr = makeWreck(nextWreck());
  placeAhead(wr.point, 500, 1200, 2.8, world.islands);
  wr.group.position.y = seafloorY(wr.point.x, wr.point.z) + 1.2;
  world.entities.push(wr);
  world.entities.push(makeFishSchool(9 + Math.floor(rnd(0,5)), wr));
}
for(let i=0;i<5;i++){ const f = makeFishSchool(10+Math.floor(rnd(0,6)), null); placeAhead(f.point,300,900,2.8,world.islands); world.entities.push(f); }
for(let i=0;i<10;i++){ const j = makeJelly(); placeAhead(j.point,200,650,2.8,world.islands); world.entities.push(j); }
for(let i=0;i<3;i++){ const tt = makeTurtle(); placeAhead(tt.point,300,800,2.8,world.islands); world.entities.push(tt); }
for(let i=0;i<4;i++){ const r = makeRay(); placeAhead(r.point,350,800,2.8,world.islands); world.entities.push(r); }
for(let i=0;i<5;i++){ const cr = makeCrab(); placeAhead(cr.point,250,600,2.8,world.islands); cr.group.position.y = seafloorY(cr.point.x,cr.point.z)+0.1; world.entities.push(cr); }
for(let i=0;i<14;i++){ const wp = makeWeedPatch(); placeAhead(wp.point,250,750,2.8,world.islands); wp.group.position.y = seafloorY(wp.point.x, wp.point.z)+0.05; world.entities.push(wp); }
for(let i=0;i<7;i++){ const kp = makeKelp(); placeAhead(kp.point,250,700,2.8,world.islands); kp.group.position.y = seafloorY(kp.point.x, kp.point.z); world.entities.push(kp); }
world.entities.push(makeMegalodon());

world.arch = makeArch('Три Сестры');
placeAhead(world.arch.point, 2000, 2600, 2.4, world.islands.filter(o=>!world.arch.virts.includes(o)));
world.arch.sync();

snapSeafloor(0, 0);