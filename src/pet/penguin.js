import * as THREE from 'three';
import { createVoxelEllipsoid } from './voxelShape.js';

export function createPenguin() {
  const materials = {
    blue: new THREE.MeshStandardMaterial({ color: '#355C85', roughness: 0.88 }),
    dark: new THREE.MeshStandardMaterial({ color: '#1B304B', roughness: 0.9 }),
    white: new THREE.MeshStandardMaterial({ color: '#FFF8F0', roughness: 0.9 }),
    brown: new THREE.MeshStandardMaterial({ color: '#43251F', roughness: 0.82 }),
    highlight: new THREE.MeshStandardMaterial({ color: '#FFFFFF', roughness: 0.8 }),
    pink: new THREE.MeshStandardMaterial({ color: '#FFB5BA', roughness: 0.88 }),
    yellow: new THREE.MeshStandardMaterial({ color: '#FFCC26', roughness: 0.82 }),
    orange: new THREE.MeshStandardMaterial({ color: '#FF941C', roughness: 0.84 })
  };

  const box = (parent, material, dimensions, position) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(...dimensions), materials[material]);
    mesh.position.set(...position);
    parent.add(mesh);
    return mesh;
  };

  const penguin = new THREE.Group();
  const curiosity = new THREE.Group();
  curiosity.name = 'curiosity';
  const sleep = new THREE.Group();
  sleep.name = 'sleep';
  const reaction = new THREE.Group();
  reaction.name = 'reaction';
  penguin.add(curiosity);
  curiosity.add(sleep);
  sleep.add(reaction);

  const body = createVoxelEllipsoid([1.23, 1.14, 0.91], 0.19, (x, y, z) =>
    z > 0.42 && Math.abs(x) < 0.92 && y > -0.88 && y < 0.82 ? 'white' : 'blue', materials);
  body.position.y = 1.23;
  reaction.add(body);

  const head = new THREE.Group();
  head.name = 'head';
  head.position.y = 2.43;
  const headLook = new THREE.Group();
  headLook.name = 'headLook';
  headLook.position.y = 2.43;
  reaction.add(headLook);
  head.position.y = 0;
  headLook.add(head);
  const headShape = createVoxelEllipsoid([1.1, 0.94, 0.88], 0.18, (x, y, z) => {
    if (z > 0.49 && Math.abs(x) < 0.78 && y > -0.58 && y < 0.56) return 'white';
    return y > 0.72 ? 'dark' : 'blue';
  }, materials);
  head.add(headShape);

  for (const side of [-1, 1]) {
    const eye = new THREE.Group();
    eye.name = side < 0 ? 'leftEye' : 'rightEye';
    eye.position.set(side * 0.46, 0.09, 0.94);
    box(eye, 'brown', [0.34, 0.43, 0.16], [0, 0, 0]);
    box(eye, 'highlight', [0.11, 0.11, 0.05], [-0.07, 0.09, 0.11]);
    head.add(eye);

    const smileEye = new THREE.Group();
    smileEye.name = side < 0 ? 'leftSmileEye' : 'rightSmileEye';
    smileEye.position.set(side * 0.46, 0.09, 1.055);
    box(smileEye, 'brown', [0.12, 0.09, 0.07], [-0.12, 0, 0]);
    box(smileEye, 'brown', [0.13, 0.09, 0.07], [0, 0.07, 0]);
    box(smileEye, 'brown', [0.12, 0.09, 0.07], [0.12, 0, 0]);
    smileEye.visible = false;
    head.add(smileEye);

    const eyelid = box(head, 'blue', [0.38, 0.08, 0.19], [side * 0.46, 0.34, 1.035]);
    eyelid.name = side < 0 ? 'leftEyelid' : 'rightEyelid';
    const brow = box(head, 'dark', [0.41, 0.08, 0.12], [side * 0.46, 0.48, 1.05]);
    brow.name = side < 0 ? 'leftBrow' : 'rightBrow';

    const cheek = box(head, 'pink', [0.27, 0.16, 0.12], [side * 0.76, -0.36, 0.77]);
    cheek.name = side < 0 ? 'leftCheek' : 'rightCheek';
    cheek.material = cheek.material.clone();

    const idleFlipper = new THREE.Group();
    idleFlipper.name = side < 0 ? 'leftIdleFlipper' : 'rightIdleFlipper';
    idleFlipper.position.set(side * 1.13, 1.62, 0);
    reaction.add(idleFlipper);
    const flipper = new THREE.Group();
    flipper.name = side < 0 ? 'leftFlipper' : 'rightFlipper';
    flipper.rotation.z = side * 0.17;
    idleFlipper.add(flipper);
    const fin = createVoxelEllipsoid([0.25, 0.47, 0.32], 0.15, () => 'blue', materials);
    fin.position.set(side * 0.08, -0.34, 0);
    flipper.add(fin);

    const foot = new THREE.Group();
    foot.name = side < 0 ? 'leftFoot' : 'rightFoot';
    foot.position.set(side * 0.57, 0, 0.37);
    reaction.add(foot);
    const footShape = createVoxelEllipsoid([0.28, 0.13, 0.38], 0.13,
      (x, y, z) => z > 0.15 ? 'orange' : 'yellow', materials);
    footShape.position.y = 0.15;
    foot.add(footShape);
  }

  const mouth = box(head, 'brown', [0.32, 0.07, 0.08], [0, -0.46, 1.24]);
  mouth.name = 'mouth';
  mouth.visible = false;
  const upperBeak = box(head, 'yellow', [0.52, 0.2, 0.37], [0, -0.32, 1.04]);
  upperBeak.name = 'upperBeak';
  const lowerBeak = box(head, 'orange', [0.37, 0.12, 0.29], [0, -0.48, 1.03]);
  lowerBeak.name = 'lowerBeak';

  return penguin;
}

export function disposePenguin(penguin) {
  const geometries = new Set();
  const materials = new Set();
  penguin.traverse((object) => {
    if (!object.isMesh) return;
    geometries.add(object.geometry);
    materials.add(object.material);
  });
  geometries.forEach((geometry) => geometry.dispose());
  materials.forEach((material) => material.dispose());
}
