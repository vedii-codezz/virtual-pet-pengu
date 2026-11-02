import { createPenguin } from './pet/penguin.js';
import { animatePenguin } from './pet/animations.js';
import { enablePetting } from './pet/interactions.js';
import { createPetState } from './pet/petState.js';
import { enableFeeding } from './pet/feeding.js';
import { enableSleep } from './pet/sleep.js';
import { createRoaming } from './pet/roaming.js';
import * as THREE from 'three';
import './style.css';

// 1. Create the 3D scene
const scene = new THREE.Scene();
scene.background = new THREE.Color('#0B0B0F');

// 2. Create the camera
const viewHeight = 18;
const aspect = window.innerWidth / window.innerHeight;
const camera = new THREE.OrthographicCamera(
  -viewHeight * aspect / 2,
  viewHeight * aspect / 2,
  viewHeight / 2,
  -viewHeight / 2,
  0.1,
  100
);
camera.position.set(0, 0, 12);
camera.lookAt(0, 0, 0);

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

// Create our voxel penguin
const penguin = createPenguin();
penguin.position.y = -2;
const roaming = createRoaming(penguin, camera);

// Add the penguin to the scene
scene.add(roaming.world);
const stopIdle = animatePenguin(penguin);
const petState = createPetState();
const stopPetting = enablePetting(penguin, camera, renderer, petState,
  (active) => roaming.setPaused('petting', active));
const stopFeeding = enableFeeding({
  scene, penguin, state: petState,
  onFed: () => stopPetting.react(true),
  onFeedingChange: (active) => roaming.setPaused('feeding', active)
});
const stopSleep = enableSleep(penguin, petState, stopIdle);
const stopRoamingOnSleep = petState.subscribeStatus(({ sleeping }) => roaming.setPaused('sleep', sleeping));
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
const onMotionChange = () => roaming.setPaused('motion', reducedMotion.matches);
onMotionChange();
reducedMotion.addEventListener('change', onMotionChange);

if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    cancelAnimationFrame(animationFrame);
    window.removeEventListener('resize', onResize);
    stopFeeding();
    stopSleep();
    stopRoamingOnSleep();
    reducedMotion.removeEventListener('change', onMotionChange);
    roaming.dispose();
    petState.dispose();
    stopPetting();
    stopIdle();
    renderer.dispose();
    renderer.domElement.remove();
  });
}


// 7. Render continuously
let animationFrame;
const clock = new THREE.Clock();
function animate() {
  animationFrame = requestAnimationFrame(animate);
  roaming.update(clock.getDelta());
  renderer.render(scene, camera);
}

animate();

// 8. Handle browser resizing
function onResize() {
  const aspect = window.innerWidth / window.innerHeight;
  camera.left = -viewHeight * aspect / 2;
  camera.right = viewHeight * aspect / 2;
  camera.updateProjectionMatrix();

  renderer.setSize(
    window.innerWidth,
    window.innerHeight
  );
  roaming.resize();
}
window.addEventListener('resize', onResize);
