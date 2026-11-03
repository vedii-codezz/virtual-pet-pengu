import * as THREE from 'three';
import { createVoxelEllipsoid } from './voxelShape.js';

export function createProps(penguin, world) {
  const head = penguin.getObjectByName('head');
  const reaction = penguin.getObjectByName('reaction');
  const leftFlipper = penguin.getObjectByName('leftFlipper');
  const gold = new THREE.MeshStandardMaterial({ color: '#B89B66', roughness: 0.8 });
  const paperMaterial = new THREE.MeshStandardMaterial({ color: '#FFF4D8', roughness: 0.95 });
  const lavender = new THREE.MeshStandardMaterial({ color: '#B7A8E8', roughness: 0.95 });
  const trim = new THREE.MeshStandardMaterial({ color: '#D8D0FA', roughness: 0.95 });
  const dark = new THREE.MeshStandardMaterial({ color: '#483E56', roughness: 0.9 });
  const ballMaterials = {
    pink: new THREE.MeshStandardMaterial({ color: '#FF9EB9', roughness: 0.85 }),
    blue: new THREE.MeshStandardMaterial({ color: '#7AC8E9', roughness: 0.85 }),
    yellow: new THREE.MeshStandardMaterial({ color: '#FFD879', roughness: 0.85 })
  };
  const roots = [];
  const add = (parent, object) => { parent.add(object); roots.push(object); return object; };
  const box = (parent, size, position, material) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), material);
    mesh.position.set(...position);
    parent.add(mesh);
    return mesh;
  };

  const spectacles = add(head, new THREE.Group());
  spectacles.name = 'spectacles';
  spectacles.position.set(0, 0.08, 1.17);
  const lensGeometry = new THREE.TorusGeometry(0.235, 0.035, 4, 12);
  for (const side of [-1, 1]) {
    const lens = new THREE.Mesh(lensGeometry, gold);
    lens.position.x = side * 0.46;
    spectacles.add(lens);
    box(spectacles, [0.18, 0.035, 0.035], [side * 0.83, 0.07, -0.02], gold);
  }
  box(spectacles, [0.21, 0.04, 0.05], [0, 0.045, 0], gold);
  spectacles.visible = false;
  spectacles.scale.setScalar(0.01);

  const newspaper = add(leftFlipper, new THREE.Group());
  newspaper.name = 'newspaper';
  newspaper.position.set(1.12, -0.19, 1.08);
  newspaper.rotation.x = -0.13;
  box(newspaper, [1.5, 0.82, 0.06], [0, 0, 0], paperMaterial);
  const paperCanvas = document.createElement('canvas');
  paperCanvas.width = 256;
  paperCanvas.height = 144;
  const ink = paperCanvas.getContext('2d');
  ink.fillStyle = '#FFF4D8'; ink.fillRect(0, 0, 256, 144);
  ink.fillStyle = '#483E56'; ink.font = 'bold 26px monospace';
  ink.fillText('PENGU TIMES', 14, 31);
  ink.fillStyle = '#B89B66'; ink.fillRect(14, 41, 226, 4);
  ink.fillStyle = '#8C857D';
  for (let row = 0; row < 5; row++) {
    ink.fillRect(14, 57 + row * 15, row % 2 ? 94 : 105, 3);
    ink.fillRect(130, 57 + row * 15, row % 2 ? 109 : 96, 3);
  }
  const printTexture = new THREE.CanvasTexture(paperCanvas);
  const printMaterial = new THREE.MeshBasicMaterial({ map: printTexture, transparent: true, depthWrite: false });
  const print = new THREE.Mesh(new THREE.PlaneGeometry(1.44, 0.77), printMaterial);
  print.position.z = 0.036;
  newspaper.add(print);
  const page = new THREE.Group();
  page.position.set(-0.02, 0, 0.075);
  newspaper.add(page);
  box(page, [0.66, 0.77, 0.025], [0.33, 0, 0], paperMaterial);
  for (let row = 0; row < 4; row++) box(page, [0.43, 0.012, 0.008],
    [0.33, 0.2 - row * 0.13, 0.02], dark);
  newspaper.visible = false;
  newspaper.scale.setScalar(0.01);

  const blanket = add(reaction, new THREE.Group());
  blanket.name = 'blanket';
  blanket.position.set(0, 0.95, 1.01);
  box(blanket, [2.24, 1.1, 0.12], [0, 0, 0], lavender);
  box(blanket, [2.3, 0.105, 0.15], [0, 0.52, 0.035], trim);
  box(blanket, [2.26, 0.08, 0.14], [0, -0.5, 0.025], trim);
  for (const x of [-0.55, 0.52]) box(blanket, [0.045, 0.86, 0.025], [x, 0, 0.075], trim);
  blanket.visible = false;
  blanket.scale.set(0.01, 0.01, 1);

  const ball = add(world, new THREE.Group());
  ball.name = 'toyBall';
  const ballShape = createVoxelEllipsoid([0.25, 0.25, 0.25], 0.09,
    (x, y) => y > 0.08 ? 'yellow' : x > 0 ? 'pink' : 'blue', ballMaterials);
  ballShape.position.y = 0.26;
  ball.add(ballShape);
  const ballShadow = add(world, new THREE.Mesh(
    new THREE.PlaneGeometry(0.68, 0.45),
    new THREE.MeshBasicMaterial({ color: '#24405B', transparent: true, opacity: 0.3, depthWrite: false })
  ));
  ballShadow.name = 'toyBallShadow';
  ballShadow.rotation.x = -Math.PI / 2;
  ballShadow.position.y = 0.018;
  ball.visible = false;
  ballShadow.visible = false;
  ball.scale.setScalar(0.01);

  return {
    spectacles, newspaper, page, blanket, ball, ballShadow,
    dispose() {
      const geometries = new Set();
      const materials = new Set();
      for (const root of roots) {
        root.traverse((object) => {
          if (!object.isMesh) return;
          geometries.add(object.geometry);
          if (Array.isArray(object.material)) object.material.forEach((material) => materials.add(material));
          else materials.add(object.material);
        });
        root.parent?.remove(root);
      }
      geometries.forEach((geometry) => geometry.dispose());
      materials.forEach((material) => material.dispose());
      printTexture.dispose();
    }
  };
}
