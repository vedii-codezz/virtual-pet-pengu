import * as THREE from 'three';
import gsap from 'gsap';

const random = (min, max) => min + Math.random() * (max - min);
const phrases = {
  ROAMING: ['tiny waddles!', 'pingu pingu~'],
  IDLE: ['brrr... ♡', 'hehe...'],
  CURIOUS: ['stay with me?', 'eep!'],
  FOLLOWING: ['i like you!', 'tiny waddles!'],
  SHY: ['hehe...', 'i like you!'],
  SLEEPING: ['zzz...', 'so sleepy...']
};

function createContactShadow() {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 64;
  const context = canvas.getContext('2d');
  const fade = context.createRadialGradient(32, 32, 2, 32, 32, 31);
  fade.addColorStop(0, 'rgba(53, 92, 133, 0.24)');
  fade.addColorStop(1, 'rgba(53, 92, 133, 0)');
  context.fillStyle = fade;
  context.fillRect(0, 0, 64, 64);
  const texture = new THREE.CanvasTexture(canvas);
  const material = new THREE.MeshBasicMaterial({ map: texture, transparent: true, depthWrite: false });
  const shadow = new THREE.Mesh(new THREE.PlaneGeometry(2.8, 1.7), material);
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.set(0, 0.015, 0.1);
  shadow.renderOrder = -1;
  return shadow;
}

export function createRoaming(penguin, camera, canvas, { onMessage, onSleepChange }) {
  const world = new THREE.Group();
  world.name = 'roamingWorld';
  const walk = new THREE.Group();
  walk.name = 'walk';
  world.add(walk);
  walk.add(penguin);
  const shadow = createContactShadow();
  world.add(shadow);

  const curiosity = penguin.getObjectByName('curiosity');
  const feet = ['leftFoot', 'rightFoot'].map((name) => penguin.getObjectByName(name));
  const idleFlippers = ['leftIdleFlipper', 'rightIdleFlipper']
    .map((name) => penguin.getObjectByName(name));
  const modelBounds = new THREE.Box3().setFromObject(walk);
  const modelRadius = Math.max(Math.abs(modelBounds.min.x), Math.abs(modelBounds.max.x));
  const destination = new THREE.Vector2(); // x and z
  const screenPoint = new THREE.Vector3();
  const pointer = new THREE.Vector2();
  const raycaster = new THREE.Raycaster();
  const frontPlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
  const pointerWorld = new THREE.Vector3();
  let hasMouse = false;
  let xLimit = 0;
  let state = 'IDLE';
  let energy = 80;
  let reduced = false;
  let wait = random(1, 2.5);
  let speed = 0.6;
  let phase = 0;
  let targetYaw = 0;
  let messageWait = random(11, 19);
  let wiggleWait = random(6, 12);
  let flipperTween;
  let curiosityCooldown = 0;
  let penguinScreenX = 0;

  function resize() {
    const nearDepth = camera.position.distanceTo(new THREE.Vector3(0, 1.8, 0.45));
    const halfWidth = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * nearDepth * camera.aspect;
    xLimit = Math.max(0, halfWidth - modelRadius - 0.45);
    world.position.x = THREE.MathUtils.clamp(world.position.x, -xLimit, xLimit);
    destination.x = THREE.MathUtils.clamp(destination.x, -xLimit, xLimit);
  }

  function settle() {
    walk.rotation.z = 0;
    feet.forEach((foot) => { foot.position.y = 0; });
  }

  function stopFlipperWiggle() {
    flipperTween?.kill();
    flipperTween = undefined;
    idleFlippers.forEach((flipper) => { flipper.rotation.z = 0; });
  }

  function wiggleFlippers() {
    stopFlipperWiggle();
    flipperTween = gsap.timeline({ onComplete: () => { flipperTween = undefined; } });
    flipperTween.to(idleFlippers[0].rotation, { z: -0.2, duration: 0.17, yoyo: true, repeat: 1 }, 0)
      .to(idleFlippers[1].rotation, { z: 0.2, duration: 0.17, yoyo: true, repeat: 1 }, 0);
  }

  function enterSleep() {
    state = 'SLEEPING';
    settle();
    stopFlipperWiggle();
    curiosity.rotation.y = 0;
    onSleepChange(true);
    onMessage('so sleepy...');
  }

  function wake() {
    state = 'IDLE';
    wait = random(1, 2);
    onSleepChange(false);
    onMessage('pingu pingu~');
  }

  function chooseDestination() {
    let nextX = random(-xLimit, xLimit);
    if (xLimit > 0.8 && Math.abs(nextX - world.position.x) < 0.8) {
      nextX = world.position.x > 0 ? -random(0, xLimit) : random(0, xLimit);
    }
    destination.set(nextX, random(-0.3, 0.3));
    speed = random(0.5, 0.82);
    targetYaw = nextX >= world.position.x ? 0.52 : -0.52;
    state = 'ROAMING';
  }

  function moveToward(x, z, dt) {
    const dx = x - world.position.x;
    const dz = z - world.position.z;
    const distance = Math.hypot(dx, dz);
    if (distance < 0.08) {
      settle();
      return true;
    }
    const step = Math.min(distance, speed * dt);
    world.position.x = THREE.MathUtils.clamp(world.position.x + dx / distance * step, -xLimit, xLimit);
    world.position.z = THREE.MathUtils.clamp(world.position.z + dz / distance * step, -0.35, 0.35);
    phase += dt * 7;
    walk.rotation.z = Math.sin(phase) * 0.032;
    feet.forEach((foot, index) => {
      foot.position.y = Math.max(0, Math.sin(phase + index * Math.PI)) * 0.075;
    });
    return false;
  }

  function pointerDistance() {
    if (!hasMouse) return Infinity;
    screenPoint.set(0, 1.8, 0);
    penguin.localToWorld(screenPoint);
    screenPoint.project(camera);
    const rect = canvas.getBoundingClientRect();
    const x = rect.left + (screenPoint.x + 1) * rect.width / 2;
    penguinScreenX = x;
    const y = rect.top + (1 - screenPoint.y) * rect.height / 2;
    return Math.hypot(pointer.x - x, pointer.y - y);
  }

  function pointerTargetX() {
    const rect = canvas.getBoundingClientRect();
    const ndc = new THREE.Vector2(
      (pointer.x - rect.left) / rect.width * 2 - 1,
      -(pointer.y - rect.top) / rect.height * 2 + 1
    );
    raycaster.setFromCamera(ndc, camera);
    if (!raycaster.ray.intersectPlane(frontPlane, pointerWorld)) return world.position.x;
    return THREE.MathUtils.clamp(pointerWorld.x, -xLimit, xLimit);
  }

  function onPointerMove(event) {
    if (event.pointerType !== 'mouse') return;
    pointer.set(event.clientX, event.clientY);
    hasMouse = true;
  }
  function onPointerLeave() { hasMouse = false; }
  canvas.addEventListener('pointermove', onPointerMove);
  canvas.addEventListener('pointerleave', onPointerLeave);

  function setShy(value) {
    if (value) {
      if (state === 'SLEEPING') return;
      state = 'SHY';
      settle();
      stopFlipperWiggle();
    } else if (state === 'SHY') {
      state = 'IDLE';
      wait = random(0.7, 1.6);
      curiosityCooldown = 1.2;
    }
  }

  function update(delta) {
    const dt = Math.min(delta, 0.05);
    if (state === 'SLEEPING') {
      energy = Math.min(100, energy + dt * 2.2);
      if (energy >= 88) wake();
    } else {
      energy = Math.max(0, energy - dt * 0.34);
      if (energy <= 18 && state !== 'SHY') enterSleep();
    }

    messageWait -= dt;
    if (messageWait <= 0) {
      const options = phrases[state] || phrases.IDLE;
      onMessage(options[Math.floor(Math.random() * options.length)]);
      messageWait = random(13, 22);
    }
    if (state === 'SLEEPING' || state === 'SHY' || reduced) return;

    curiosityCooldown = Math.max(0, curiosityCooldown - dt);
    const distance = pointerDistance();
    if ((state === 'CURIOUS' || state === 'FOLLOWING') && distance > 240) {
      state = 'IDLE';
      wait = random(0.8, 1.6);
      curiosityCooldown = 2;
      settle();
    } else if (distance < 165 && curiosityCooldown === 0 && state !== 'CURIOUS' && state !== 'FOLLOWING') {
      state = 'CURIOUS';
      wait = random(0.65, 1.1);
      settle();
      onMessage('eep!');
    }

    const curiosityTarget = state === 'CURIOUS' || state === 'FOLLOWING'
      ? THREE.MathUtils.clamp((pointer.x - penguinScreenX) * 0.004, -0.28, 0.28)
      : 0;
    curiosity.rotation.y = THREE.MathUtils.damp(curiosity.rotation.y, curiosityTarget, 3, dt);

    if (state === 'CURIOUS') {
      wait -= dt;
      if (wait <= 0) {
        if (Math.random() < 0.7) {
          state = 'FOLLOWING';
          speed = random(0.35, 0.55);
        } else {
          state = 'IDLE';
          wait = random(1.1, 2.2);
          curiosityCooldown = 2;
        }
      }
      return;
    }

    if (state === 'FOLLOWING') {
      const x = pointerTargetX();
      targetYaw = x > world.position.x ? 0.35 : -0.35;
      world.rotation.y = THREE.MathUtils.damp(world.rotation.y, targetYaw, 3, dt);
      if (moveToward(x, world.position.z, dt)) {
        state = 'CURIOUS';
        wait = random(0.7, 1.2);
      }
      return;
    }

    if (state === 'IDLE') {
      wait -= dt;
      phase += dt;
      world.rotation.y = THREE.MathUtils.damp(world.rotation.y, Math.sin(phase) * 0.12, 2, dt);
      wiggleWait -= dt;
      if (wiggleWait <= 0) {
        wiggleFlippers();
        wiggleWait = random(8, 15);
      }
      if (wait <= 0) chooseDestination();
      return;
    }

    world.rotation.y = THREE.MathUtils.damp(world.rotation.y, targetYaw, 3, dt);
    if (moveToward(destination.x, destination.y, dt)) {
      state = 'IDLE';
      wait = random(1.2, 3.5);
    }
  }

  resize();
  return {
    world, resize, update, setShy,
    get state() { return state; },
    setReducedMotion(value) {
      reduced = Boolean(value);
      if (reduced) {
        settle();
        stopFlipperWiggle();
        curiosity.rotation.y = 0;
        if (state !== 'SLEEPING' && state !== 'SHY') state = 'IDLE';
      }
    },
    dispose() {
      canvas.removeEventListener('pointermove', onPointerMove);
      canvas.removeEventListener('pointerleave', onPointerLeave);
      stopFlipperWiggle();
      settle();
      shadow.geometry.dispose();
      shadow.material.map.dispose();
      shadow.material.dispose();
    }
  };
}
