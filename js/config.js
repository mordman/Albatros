import * as THREE from 'three';

export const WIND = { x: 2.0, z: 0.9 };
export const FOG_C  = new THREE.Color('#f8c193');
export const FOG_D  = 0.00075;
export const UNDER_C = new THREE.Color('#0b3742');
export const UNDER_D = 0.0085;
export const SUN_DIR = new THREE.Vector3(0.38, 0.24, 0.89).normalize();

export const BOAT = { draft:0.4, maxF:22, maxB:40, maxR:6 };
export const SUB  = { cruise:7.5, boost:14 };
export const MOTO = { max:38, boost:58, rev:6 };

export const rnd = (a,b)=> a + Math.random()*(b-a);
export const clamp = (v,a,b)=> Math.max(a, Math.min(b, v));
export const smooth01 = k => k*k*(3-2*k);