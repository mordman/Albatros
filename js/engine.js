import * as THREE from 'three';
import { FOG_C, FOG_D, SUN_DIR } from './config.js';

export const renderer = new THREE.WebGLRenderer({ antialias:true });
renderer.setSize(innerWidth, innerHeight);
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.12;
renderer.setClearColor(FOG_C);
renderer.domElement.className = 'webgl';
document.body.appendChild(renderer.domElement);

export const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(FOG_C, FOG_D);

export const camera = new THREE.PerspectiveCamera(62, innerWidth/innerHeight, 0.5, 7000);
camera.position.set(0, 58, -34);
camera.lookAt(0, 50, 30);

const sun = new THREE.DirectionalLight(0xffd9b0, 2.6);
sun.position.copy(SUN_DIR).multiplyScalar(1200);
scene.add(sun);
scene.add(new THREE.HemisphereLight(0xbfd0e8, 0x2e4048, 0.85));