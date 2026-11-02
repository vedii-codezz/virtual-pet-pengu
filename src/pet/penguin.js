import * as THREE from 'three';

export function createPenguin() {
  const sphere = new THREE.SphereGeometry(1, 32, 24);
  const materials = {
    blue: new THREE.MeshStandardMaterial({ color: '#355C85', roughness: 0.86 }),
    darkBlue: new THREE.MeshStandardMaterial({ color: '#1B304B', roughness: 0.88 }),
    white: new THREE.MeshStandardMaterial({ color: '#FFF8F0', roughness: 0.9 }),
    brown: new THREE.MeshStandardMaterial({ color: '#43251F', roughness: 0.72 }),
    highlight: new THREE.MeshStandardMaterial({ color: '#FFFFFF', roughness: 0.62 }),
    pink: new THREE.MeshStandardMaterial({ color: '#FFB5BA', roughness: 0.85 }),
    yellow: new THREE.MeshStandardMaterial({ color: '#FFCC26', roughness: 0.78 }),
    orange: new THREE.MeshStandardMaterial({ color: '#FF941C', roughness: 0.8 })
  };

  function oval(parent, material, position, scale) {
    const mesh = new THREE.Mesh(sphere, materials[material]);
    mesh.position.set(...position);
    mesh.scale.set(...scale);
    parent.add(mesh);
    return mesh;
  }

  const penguin = new THREE.Group();
  const reaction = new THREE.Group();
  reaction.name = 'reaction';
  penguin.add(reaction);

  // The chest and face intersect the round body and head to form curved surfaces.
  oval(reaction, 'blue', [0, 1.42, 0], [0.98, 1.3, 0.8]);
  oval(reaction, 'white', [0, 1.4, 0.57], [0.75, 1.04, 0.37]);
  oval(reaction, 'darkBlue', [0, 3.02, 0.02], [1.04, 0.99, 0.88]);
  oval(reaction, 'blue', [0, 3.05, 0.1], [1.02, 0.96, 0.88]);

  // Face patches are independent of the eye pivots, so only the eyes blink.
  oval(reaction, 'white', [-0.38, 3.03, 0.78], [0.48, 0.55, 0.22]);
  oval(reaction, 'white', [0.38, 3.03, 0.78], [0.48, 0.55, 0.22]);
  oval(reaction, 'white', [0, 2.77, 0.82], [0.5, 0.31, 0.2]);

  function addEye(name, x) {
    const eye = new THREE.Group();
    eye.name = name;
    eye.position.set(x, 3.16, 0.98);
    oval(eye, 'brown', [0, 0, 0], [0.17, 0.23, 0.1]);
    oval(eye, 'highlight', [-0.055, 0.08, 0.085], [0.055, 0.065, 0.035]);
    reaction.add(eye);
  }
  addEye('leftEye', -0.42);
  addEye('rightEye', 0.42);

  oval(reaction, 'pink', [-0.79, 2.83, 0.84], [0.16, 0.1, 0.07]);
  oval(reaction, 'pink', [0.79, 2.83, 0.84], [0.16, 0.1, 0.07]);
  oval(reaction, 'yellow', [0, 2.76, 1.06], [0.31, 0.17, 0.32]);
  oval(reaction, 'orange', [0, 2.61, 1.05], [0.23, 0.11, 0.27]);

  for (const side of [-1, 1]) {
    const flipper = new THREE.Group();
    flipper.name = side < 0 ? 'leftFlipper' : 'rightFlipper';
    flipper.position.set(side * 0.9, 1.94, 0.02);
    flipper.rotation.z = side * 0.25;
    oval(flipper, 'blue', [side * 0.13, -0.48, 0], [0.26, 0.72, 0.36]);
    reaction.add(flipper);

    const foot = oval(reaction, 'orange', [side * 0.49, 0.18, 0.43], [0.36, 0.18, 0.52]);
    foot.name = side < 0 ? 'leftFoot' : 'rightFoot';
  }

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
