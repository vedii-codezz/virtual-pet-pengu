import { createPenguin } from './pet/penguin.js';
import { animatePenguin } from './pet/animations.js';
import { enablePetting } from './pet/interactions.js';
import * as THREE from 'three';
import './style.css';

// 1. Create the 3D scene
const scene = new THREE.Scene();
scene.background = new THREE.Color('#dceef8');

// 2. Create the camera
const camera = new THREE.PerspectiveCamera(
  45,
  window.innerWidth / window.innerHeight,
  0.1,
  100
);

camera.position.set(5, 4.5, 9);
camera.lookAt(0, 1.8, 0);

// 3. Create the renderer
const renderer = new THREE.WebGLRenderer({
  antialias: true
});

renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(
  Math.min(window.devicePixelRatio, 2)
);

document.querySelector('#app').appendChild(
  renderer.domElement
);

// 4. Add soft ambient lighting
const ambientLight = new THREE.AmbientLight(
  0xffffff,
  2
);
scene.add(ambientLight);

// 5. Add directional lighting
const sunlight = new THREE.DirectionalLight(
  0xffffff,
  3
);

sunlight.position.set(5, 8, 5);
scene.add(sunlight);

// 6. Create an icy platform
const platformGeometry = new THREE.BoxGeometry(
  5, 0.4, 5
);

const platformMaterial = new THREE.MeshStandardMaterial({
  color: '#f5fbff',
  roughness: 0.8
});

const platform = new THREE.Mesh(
  platformGeometry,
  platformMaterial
);

platform.position.y = -0.2;
scene.add(platform);

// Create our voxel penguin
const penguin = createPenguin();

// Add the penguin to the scene
scene.add(penguin);
animatePenguin(penguin);
enablePetting(penguin, camera, renderer);


// 7. Render continuously
function animate() {
  requestAnimationFrame(animate);
  renderer.render(scene, camera);
}

animate();

// 8. Handle browser resizing
window.addEventListener('resize', () => {
  camera.aspect =
    window.innerWidth / window.innerHeight;

  camera.updateProjectionMatrix();

  renderer.setSize(
    window.innerWidth,
    window.innerHeight
  );
});
