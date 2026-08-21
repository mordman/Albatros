import { world } from './world.js';

// эффективные полуразмеры AABB с учётом поворота (дома стоят вдоль осей ± джиттер)
export function bboxFor(w, d, rotY){
  const swap = Math.abs(Math.sin(rotY)) > 0.5;
  return { hw:(swap?d:w)/2, hd:(swap?w:d)/2 };
}

export function registerBuildings(owner, list){
  for(const b of list) world.buildings.push({ owner, ...b });
}

export function checkBuildingHit(x, y, z, pad){
  for(const b of world.buildings){
    const dx = x - (b.owner.point.x + b.x);
    if(dx > 30 || dx < -30) continue;
    const dz = z - (b.owner.point.z + b.z);
    if(dz > 30 || dz < -30) continue;
    if(y < b.y0 || y > b.y1) continue;
    if(Math.abs(dx) < b.hw+pad && Math.abs(dz) < b.hd+pad) return b;
  }
  return null;
}