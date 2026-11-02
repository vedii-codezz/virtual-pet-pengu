import * as THREE from 'three';
import gsap from 'gsap';

function createFish() {
  const fish = new THREE.Group();
  const blue = new THREE.MeshStandardMaterial({ color: '#79b9dc', roughness: 0.75, flatShading: true });
  const dark = new THREE.MeshStandardMaterial({ color: '#355c85', roughness: 0.75, flatShading: true });

  function cube(width, height, depth, material, x, y, z) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), material);
    mesh.position.set(x, y, z);
    fish.add(mesh);
  }

  cube(0.36, 0.2, 0.16, blue, 0, 0, 0);
  cube(0.14, 0.3, 0.12, blue, -0.25, 0, 0);
  cube(0.05, 0.05, 0.03, dark, 0.11, 0.04, 0.095);
  return fish;
}

export function enableFeeding({ scene, penguin, state, onFed }) {
  const panel = document.createElement('div');
  panel.className = 'pet-panel';
  panel.innerHTML = `
    <div class="pet-panel__label"><span>Hunger</span><strong class="pet-panel__value"></strong></div>
    <div class="pet-panel__track" role="progressbar" aria-label="Hunger" aria-valuemin="0" aria-valuemax="100"><div class="pet-panel__fill"></div></div>
    <div class="pet-panel__label pet-panel__label--energy"><span>Energy</span><strong class="pet-panel__energy-value"></strong></div>
    <div class="pet-panel__track" role="progressbar" aria-label="Energy" aria-valuemin="0" aria-valuemax="100"><div class="pet-panel__fill pet-panel__energy-fill"></div></div>
    <button class="pet-panel__feed" type="button">🐟 Feed</button>
    <button class="pet-panel__sleep" type="button" aria-pressed="false">🌙 Sleep</button>
    <p class="pet-panel__hint" aria-live="polite"></p>
  `;
  document.querySelector('#app').appendChild(panel);
  const button = panel.querySelector('button');
  const value = panel.querySelector('.pet-panel__value');
  const track = panel.querySelector('.pet-panel__track');
  const fill = panel.querySelector('.pet-panel__fill');
  const energyValue = panel.querySelector('.pet-panel__energy-value');
  const energyTrack = panel.querySelector('[aria-label="Energy"]');
  const energyFill = panel.querySelector('.pet-panel__energy-fill');
  const sleepButton = panel.querySelector('.pet-panel__sleep');
  const hint = panel.querySelector('.pet-panel__hint');
  let fish;
  let timeline;
  let disposed = false;
  const unsubscribe = state.subscribe((hunger) => {
    value.textContent = `${hunger}%`;
    track.setAttribute('aria-valuenow', String(hunger));
    fill.style.width = `${hunger}%`;
  });

  const unsubscribeStatus = state.subscribeStatus(({ energy, sleeping }) => {
    energyValue.textContent = `${energy}%`;
    energyTrack.setAttribute('aria-valuenow', String(energy));
    energyFill.style.width = `${energy}%`;
    button.disabled = sleeping || Boolean(timeline);
    button.title = sleeping ? 'Wake Pengu to feed' : '';
    sleepButton.disabled = Boolean(timeline);
    sleepButton.textContent = sleeping ? '☀️ Wake' : '🌙 Sleep';
    sleepButton.setAttribute('aria-pressed', String(sleeping));
    hint.textContent = sleeping ? 'Pengu is resting. Wake to feed or pet.' : '';
  });

  function removeFish() {
    if (!fish) return;
    scene.remove(fish);
    fish.traverse((object) => { if (object.isMesh) object.geometry.dispose(); });
    fish.children[0].material.dispose();
    fish.children[2].material.dispose();
    fish = undefined;
  }

  function finishFeed() {
    removeFish();
    timeline = undefined;
    button.disabled = state.sleeping;
    sleepButton.disabled = false;
    if (disposed) return;
    state.feed();
    onFed();
  }

  function feed() {
    if (timeline || disposed || state.sleeping) return;
    button.disabled = true;
    sleepButton.disabled = true;
    fish = createFish();
    scene.add(fish);
    const beak = penguin.localToWorld(new THREE.Vector3(0, 2.42, 1.3));
    fish.position.set(beak.x - 2.1, beak.y - 0.65, beak.z + 0.7);

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      fish.position.copy(beak);
      timeline = gsap.delayedCall(0.3, finishFeed);
      return;
    }

    timeline = gsap.timeline({ onComplete: finishFeed });
    timeline.to(fish.position, {
      x: beak.x,
      y: beak.y,
      z: beak.z,
      duration: 0.85,
      ease: 'power2.inOut'
    }).to(fish.scale, { x: 0.1, y: 0.1, z: 0.1, duration: 0.12 });
  }

  button.addEventListener('click', feed);
  const toggleSleep = () => {
    if (!timeline) state.setSleeping(!state.sleeping);
  };
  sleepButton.addEventListener('click', toggleSleep);

  return () => {
    if (disposed) return;
    disposed = true;
    button.removeEventListener('click', feed);
    sleepButton.removeEventListener('click', toggleSleep);
    timeline?.kill();
    removeFish();
    unsubscribe();
    unsubscribeStatus();
    panel.remove();
  };
}
