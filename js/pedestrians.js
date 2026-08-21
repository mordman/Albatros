import * as THREE from 'three';
import { rnd } from './config.js';
import { scene } from './engine.js';
import { M, mat } from './materials.js';
import { world } from './world.js';
import { distToPlayer, placeAhead } from './state.js';
import { bloodSplatter } from './particles.js';

const PED_COLORS = [0x3498db, 0xe74c3c, 0x2ecc71, 0xf39c12, 0x9b59b6, 0x1abc9c, 0xe67e22, 0x95a5a6];
const tmpV = new THREE.Vector3();

export function makePedestrian(){
  const g = new THREE.Group();
  const color = PED_COLORS[Math.floor(rnd(0, PED_COLORS.length))];
  const bodyMat = mat(color, {r:0.8, ds:1});
  
  // Body
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.3, 0.9, 8), bodyMat);
  body.position.y = 0.9;
  g.add(body);
  
  // Head
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.22, 8, 6), mat(0xffdbac, {r:0.9}));
  head.position.y = 1.55;
  g.add(head);
  
  // Legs
  const legs = [];
  for(const s of [-1, 1]){
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.55, 6), mat(0x2c3e50, {r:0.7}));
    leg.position.set(s*0.15, 0.27, 0);
    g.add(leg);
    legs.push({ m: leg, ph: rnd(0, 10) });
  }
  
  // Arms
  const arms = [];
  for(const s of [-1, 1]){
    const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.5, 6), bodyMat);
    arm.position.set(s*0.4, 1.1, 0);
    arm.rotation.z = s * 0.3;
    g.add(arm);
    arms.push({ m: arm, s, ph: rnd(0, 10) });
  }
  
  scene.add(g);
  
  const p = { 
    group: g, 
    point: g.position, 
    heading: rnd(0, Math.PI*2), 
    turn: rnd(-0.5, 0.5), 
    speed: rnd(0.8, 1.4),
    walkPhase: rnd(0, 10),
    target: null,
    waitTime: 0,
    state: 'walk',
    alive: true,
    ragdoll: null
  };
  
  p.update = (dt, t, cityCenter, cityRp) => {
    if(!p.alive) return;
    
    if(p.waitTime > 0){
      p.waitTime -= dt;
      if(p.waitTime <= 0){
        p.state = 'walk';
        p.heading = rnd(0, Math.PI*2);
      }
      return;
    }
    
    // Change direction occasionally
    if(Math.random() < 0.02){
      p.turn = rnd(-1, 1);
    }
    if(Math.random() < 0.01){
      p.state = Math.random() < 0.3 ? 'stop' : 'walk';
      if(p.state === 'stop'){
        p.waitTime = rnd(1, 4);
      }
    }
    
    if(p.state === 'walk'){
      p.heading += p.turn * dt;
      
      // Keep within city bounds
      const dx = p.point.x - cityCenter.x;
      const dz = p.point.z - cityCenter.z;
      const dist = Math.hypot(dx, dz);
      if(dist > cityRp * 0.85){
        // Turn back toward center
        const angleToCenter = Math.atan2(-dx, -dz);
        p.heading = angleToCenter + rnd(-0.5, 0.5);
      }
      
      const vx = Math.sin(p.heading) * p.speed;
      const vz = Math.cos(p.heading) * p.speed;
      
      g.position.x += vx * dt;
      g.position.z += vz * dt;
      
      // Animate walking
      const walkSpeed = 5;
      for(const l of legs){
        l.m.rotation.x = Math.sin(t * walkSpeed + l.ph) * 0.5;
      }
      for(const a of arms){
        a.m.rotation.x = Math.sin(t * walkSpeed + a.ph) * 0.4 * a.s;
      }
      
      g.rotation.y = p.heading;
    }
    
    if(distToPlayer(p.point) > 800){
      placeAhead(p.point, 200, 500, 2.8, world.islands);
    }
  };
  
  p.hit = function(bulletPos, bulletVel){
    if(!p.alive) return false;
    const dist = p.group.position.distanceTo(bulletPos);
    if(dist < 1.2){
      p.alive = false;
      bloodSplatter(p.group.position.x, p.group.position.y + 0.9, p.group.position.z, 1.0);
      // Launch ragdoll
      g.visible = false;
      p.ragdoll = createRagdoll(g.position, bulletVel);
      return true;
    }
    return false;
  };
  
  return p;
}

// Create ragdoll pieces for dead pedestrian
function createRagdoll(pos, impulse){
  const pieces = [];
  const parts = [
    { geo: new THREE.CylinderGeometry(0.25, 0.3, 0.9, 8), y: 0.9, color: 0x3498db },
    { geo: new THREE.SphereGeometry(0.22, 8, 6), y: 1.55, color: 0xffdbac },
    { geo: new THREE.CylinderGeometry(0.1, 0.1, 0.55, 6), y: 0.27, x: -0.15, color: 0x2c3e50 },
    { geo: new THREE.CylinderGeometry(0.1, 0.1, 0.55, 6), y: 0.27, x: 0.15, color: 0x2c3e50 },
    { geo: new THREE.CylinderGeometry(0.08, 0.08, 0.5, 6), y: 1.1, x: -0.4, color: 0x3498db },
    { geo: new THREE.CylinderGeometry(0.08, 0.08, 0.5, 6), y: 1.1, x: 0.4, color: 0x3498db }
  ];
  
  for(const part of parts){
    const mesh = new THREE.Mesh(part.geo, mat(part.color, {r:0.8}));
    mesh.position.copy(pos);
    mesh.position.y += part.y;
    if(part.x) mesh.position.x += part.x;
    scene.add(mesh);
    pieces.push({
      mesh,
      v: new THREE.Vector3(impulse.x * rnd(0.3, 0.7), impulse.y * rnd(0.5, 1.2) + rnd(2, 5), impulse.z * rnd(0.3, 0.7)),
      rot: new THREE.Vector3(rnd(-5, 5), rnd(-5, 5), rnd(-5, 5))
    });
  }
  
  return pieces;
}

export function updateRagdolls(dt){
  for(const e of world.entities || []){
    if(e.colType === 'pedestrian' && e.ragdoll){
      for(const piece of e.ragdoll){
        piece.v.y -= 18 * dt;
        piece.mesh.position.addScaledVector(piece.v, dt);
        piece.mesh.rotation.x += piece.rot.x * dt;
        piece.mesh.rotation.y += piece.rot.y * dt;
        piece.mesh.rotation.z += piece.rot.z * dt;
        
        const groundY = piece.mesh.position.y < 0.1 ? 0.1 : piece.mesh.position.y;
        if(piece.mesh.position.y < groundY){
          piece.mesh.position.y = groundY;
          piece.v.multiplyScalar(0.4);
          piece.rot.multiplyScalar(0.7);
        }
      }
    }
  }
}

export function makePedestrianGroup(city, count){
  const pedestrians = [];
  const cityCenter = { x: city.hx, z: city.hz };
  const townY = city.topY - 30;
  
  for(let i = 0; i < count; i++){
    const ped = makePedestrian();
    const angle = rnd(0, Math.PI*2);
    const radius = rnd(15, city.Rp * 0.85);
    ped.group.position.set(
      cityCenter.x + Math.cos(angle) * radius,
      townY,
      cityCenter.z + Math.sin(angle) * radius
    );
    pedestrians.push(ped);
    world.entities.push({
      ...ped,
      colType: 'pedestrian',
      label: () => null,
      update: (dt, t) => ped.update(dt, t, cityCenter, city.Rp),
      hit: (pos, vel) => ped.hit(pos, vel),
      ragdoll: null
    });
  }
  
  return pedestrians;
}
