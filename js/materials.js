import * as THREE from 'three';

export const mat = (c,o={}) => new THREE.MeshStandardMaterial({ color:c, roughness:o.r??0.85, metalness:o.m??0,
  flatShading:!!o.f, side:o.ds?THREE.DoubleSide:THREE.FrontSide,
  emissive:o.e??0x000000, emissiveIntensity:o.ei??1 });

export const M = {
  wood:mat(0x7a4a2e), woodDark:mat(0x5b3a24), deck:mat(0xc09a66), cream:mat(0xefe6d2),
  sail:mat(0xf5ead3,{ds:1,r:.95}), navy:mat(0x2c4a63), white:mat(0xe9e4d6),
  dark:mat(0x2e3a42), red:mat(0xb4432f), glass:mat(0x16202a,{r:.25}),
  rock:mat(0x5f7057,{f:1}), cliff:mat(0x6b675f,{f:1}), sand:mat(0xdcc08e),
  trunk:mat(0x8a6a44), leaf:mat(0x4d8f45,{ds:1}), pine:mat(0x3f6e42),
  gullW:mat(0xeef1f2,{ds:1}), gullG:mat(0xbfc9cf,{ds:1}),
  whale:mat(0x39505c,{r:.35,m:.05}), cloud:mat(0xfdf4e6,{r:1,f:1}), buoy:mat(0xd97a35),
  planeA:mat(0xf2e8d5,{r:.55}), planeR:mat(0xd2543a,{r:.55}), planeD:mat(0x2a2f36,{r:.5}),
  lamp:mat(0x111111,{e:0xffd98a,ei:2.4}),
  roofTile:mat(0x96503c), roofTar:mat(0x4d5258), asphalt:mat(0x3c4046,{r:.95}),
  townGround:mat(0x8e9678), warehouse:mat(0x9c6b52), steel:mat(0x99a3ab,{r:.45,m:.5}),
  craneY:mat(0xd9a441), clockFace:mat(0xf5eeda,{e:0xfff2cc,ei:.8}),
  beacon:mat(0x551512,{e:0xff4530,ei:2}), lampGlow:mat(0x8a7a60,{e:0xffd9a0,ei:2.2}),
  wreck:mat(0x5c4a3a,{r:.98}), wreckD:mat(0x453729,{r:.98}),
  weed:mat(0x2e6b4f,{ds:1,r:1}), weed2:mat(0x3f7a3a,{ds:1,r:1}),
  fish1:mat(0xc46a2e,{r:.6}), fish2:mat(0x9fb2bd,{r:.5,m:.2}), fish3:mat(0x6f93a8,{r:.6}),
  turtle:mat(0x5d6b3c,{r:.9}), turtleS:mat(0x7a8656,{r:.9}),
  motoRed:mat(0xc23b2e,{r:.35,m:.25}), motoChrome:mat(0xc8ccd0,{r:.2,m:.8}),
  rubber:mat(0x1c1e20,{r:.95}), helmet:mat(0xe8e2d5,{r:.25}),
  jelly: new THREE.MeshStandardMaterial({ color:0x8fd8e8, transparent:true, opacity:0.5,
    emissive:0x2a7a8a, emissiveIntensity:0.9, roughness:0.3, side:THREE.DoubleSide }),
};
export const CITY_ROOF = mat(0x4a4038);

function makeWindowMaterials(){
  const walls = ['#c9b8a0','#b7a58c','#a8b0b8','#c2a68a','#9fa8a4','#b8927a'];
  return walls.map(w=>{
    const cA = document.createElement('canvas'); cA.width=64; cA.height=64;
    const cE = document.createElement('canvas'); cE.width=64; cE.height=64;
    const a = cA.getContext('2d'), e = cE.getContext('2d');
    a.fillStyle = w; a.fillRect(0,0,64,64);
    e.fillStyle = '#000'; e.fillRect(0,0,64,64);
    for(let ix=0; ix<4; ix++) for(let iy=0; iy<4; iy++){
      const x = 6+ix*14, y = 8+iy*14;
      a.fillStyle = '#3a4148'; a.fillRect(x, y, 9, 8);
      if(Math.random() < 0.55){
        e.fillStyle = Math.random() < 0.8 ? '#ffd28a' : '#bfd6e8';
        e.fillRect(x, y, 9, 8);
      }
    }
    const ta = new THREE.CanvasTexture(cA), te = new THREE.CanvasTexture(cE);
    ta.colorSpace = te.colorSpace = THREE.SRGBColorSpace;
    ta.wrapS = ta.wrapT = te.wrapS = te.wrapT = THREE.RepeatWrapping;
    return new THREE.MeshStandardMaterial({
      map: ta, emissiveMap: te, emissive: 0xffffff, emissiveIntensity: 1.25, roughness: 0.9 });
  });
}
export const CITY_MATS = makeWindowMaterials();