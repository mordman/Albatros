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

/* ================= БОЕВЫЕ НАСТРОЙКИ — всё регулируется здесь ================= */

// прочность игрока
export const PLAYER_HP = {
  max: 10,        // максимум HP
  smokeAt: 5,     // hp, при котором самолёт начинает дымить
  flakDamage: 1,  // урон одного зенитного снаряда
};

// гражданские суда (шхуны, траулеры, катера)
export const CIVIL_SHIP = {
  hp: 10,         // попаданий до взрыва
  fireAt: 5,      // hp, при котором начинается пожар
};

// боевые корабли (эсминцы)
export const WARSHIP = {
  hp: 100,            // попаданий из пулемёта до взрыва
  smokePct: 60,       // % прочности, ниже — идёт дым
  firePct: 30,        // % прочности, ниже — пожар
  len: 92, width: 12, colH: 22,
  speed: [6, 9],      // диапазон скорости хода
  gunCount: 4,        // зениток на борту
  burst: 4,           // выстрелов в очереди
  burstGap: 0.12,     // пауза между выстрелами очереди, с
  reload: [1.8, 3.2], // пауза между очередями, с (мин, макс)
  shellSpeed: 130,    // скорость зенитного снаряда
  spread: 0.06,       // разброс прицела: доля дистанции (низкая точность)
  leadErr: [0.85, 1.15], // ошибка упреждения (множитель)
  burstRadius: 12,    // радиус поражения разрыва снаряда
  range: 950,         // дальность открытия огня
  minRange: 60,       // ближе — не стреляют (не дотягиваются)
  targetPlaneOnly: true, // стреляют только по летящему самолёту
};

export const rnd = (a,b)=> a + Math.random()*(b-a);
export const clamp = (v,a,b)=> Math.max(a, Math.min(b, v));
export const smooth01 = k => k*k*(3-2*k);