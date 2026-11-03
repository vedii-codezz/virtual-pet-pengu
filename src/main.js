import { createPenguin, disposePenguin } from './pet/penguin.js';
import { animatePenguin } from './pet/animations.js';
import { enablePetting } from './pet/interactions.js';
import { createRoaming } from './pet/roaming.js';
import { createSpeech } from './pet/speech.js';
import { createPurrAudio } from './pet/audio.js';
import { createSleepVisual } from './pet/sleep.js';
import { createExpressions } from './pet/expressions.js';
import * as THREE from 'three';
import './style.css';

const scene = new THREE.Scene();
scene.background = new THREE.Color('#0B0B0F');

const aspect = window.innerWidth / window.innerHeight;
const camera = new THREE.PerspectiveCamera(45, aspect, 0.1, 100);
camera.position.set(0, 12.0, 22.5);
camera.lookAt(0, 8.5, 0);

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

const ambientLight = new THREE.AmbientLight(
  0xffffff,
  1.6
);
scene.add(ambientLight);

const sunlight = new THREE.DirectionalLight(
  0xffffff,
  2.4
);

sunlight.position.set(-4, 9, 7);
scene.add(sunlight);

const penguin = createPenguin();
const expressions = createExpressions(penguin);
const stopIdle = animatePenguin(penguin);
const speech = createSpeech(penguin, camera, renderer.domElement);
const audio = createPurrAudio();
const sleep = createSleepVisual(penguin, camera, renderer.domElement, stopIdle);
const roaming = createRoaming(penguin, camera, renderer.domElement, {
  onMessage: (message) => speech.show(message),
  onSleepChange: (sleeping) => sleep.setSleeping(sleeping),
  expressions
});
scene.add(roaming.stage);
const stopPetting = enablePetting(penguin, camera, renderer, {
  onActiveChange: (active) => roaming.setShy(active),
  onPet: () => { speech.show('hehe... ♡', true); audio.purr(); },
  onEmptyTap: (event) => roaming.noticeTap(event.clientX, event.clientY),
  onPointerMove: (event) => roaming.trackPointer(event),
  onPointerLeave: () => roaming.clearPointer(),
  onDirectTap: () => { if (roaming.state === 'SLEEPING') roaming.wakeFromTap(); },
  canPet: () => roaming.state !== 'SLEEPING' && roaming.state !== 'WAKING'
});
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
const onMotionChange = () => roaming.setReducedMotion(reducedMotion.matches);
onMotionChange();
reducedMotion.addEventListener('change', onMotionChange);

if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    cancelAnimationFrame(animationFrame);
    window.removeEventListener('resize', onResize);
    reducedMotion.removeEventListener('change', onMotionChange);
    stopPetting();
    roaming.dispose();
    sleep.dispose();
    speech.dispose();
    audio.dispose();
    stopIdle();
    expressions.dispose();
    disposePenguin(penguin);
    renderer.dispose();
    renderer.domElement.remove();
  });
}


let animationFrame;
let previousFrame = performance.now();
function animate() {
  animationFrame = requestAnimationFrame(animate);
  const now = performance.now();
  roaming.update((now - previousFrame) / 1000);
  previousFrame = now;
  speech.update();
  sleep.update();
  renderer.render(scene, camera);
}

animate();

function onResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();

  renderer.setSize(
    window.innerWidth,
    window.innerHeight
  );
  roaming.resize();
}
window.addEventListener('resize', onResize);
