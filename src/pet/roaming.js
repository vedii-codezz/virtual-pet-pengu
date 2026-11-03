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

export function createRoaming(penguin, camera, canvas, { onMessage, onSleepChange, expressions }) {
  const world = new THREE.Group();
  world.name = 'roamingWorld';
  const walk = new THREE.Group();
  walk.name = 'walk';
  world.add(walk);
  walk.add(penguin);
  const shadow = createContactShadow();
  world.add(shadow);

  const curiosity = penguin.getObjectByName('curiosity');
  const head = penguin.getObjectByName('headLook');
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
  let tapHold = 0;
  let tapBubble = 0;
  let hoverLook = 0;
  let yawnTime = 0;
  let happyTime = 0;
  let petCount = 0;
  let xLimit = 0;
  let state = 'IDLE';
  let energy = 80;
  let reduced = false;
  let wait = random(0.5, 1.3);
  let speed = 0.6;
  let currentSpeed = 0;
  let phase = 0;
  let targetYaw = 0;
  let messageWait = random(11, 19);
  let wiggleWait = random(6, 12);
  let happyWait = random(14, 25);
  let flipperTween;
  let curiosityCooldown = 0;

  function resize() {
    const nearDepth = camera.position.distanceTo(new THREE.Vector3(0, 1.8, 0.45));
    const halfWidth = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * nearDepth * camera.aspect;
    xLimit = Math.max(0, halfWidth - modelRadius - 0.45);
    world.position.x = THREE.MathUtils.clamp(world.position.x, -xLimit, xLimit);
    destination.x = THREE.MathUtils.clamp(destination.x, -xLimit, xLimit);
  }

  function settle() {
    currentSpeed = 0;
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
    head.rotation.set(0, 0, 0);
    expressions.setExpression('SLEEPING');
    onSleepChange(true);
    onMessage('so sleepy...');
  }

  function beginYawn() {
    state = 'YAWNING';
    yawnTime = 1.35;
    settle();
    stopFlipperWiggle();
    gsap.to(idleFlippers[0].rotation, { z: -0.32, duration: 0.35, overwrite: true });
    gsap.to(idleFlippers[1].rotation, { z: 0.32, duration: 0.35, overwrite: true });
    expressions.setExpression('YAWNING', { force: true });
    onMessage('yaaawn...');
  }

  function wake() {
    state = 'IDLE';
    wait = random(0.5, 1.1);
    expressions.setExpression('HAPPY', { force: true });
    happyTime = 1.2;
    onSleepChange(false);
    onMessage('pingu pingu~');
  }

  function chooseDestination() {
    let nextX = random(-xLimit, xLimit);
    if (xLimit > 0.8 && Math.abs(nextX - world.position.x) < 0.8) {
      nextX = world.position.x > 0 ? -random(0, xLimit) : random(0, xLimit);
    }
    destination.set(nextX, random(-0.3, 0.3));
    speed = random(0.82, 1.34);
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
    currentSpeed = THREE.MathUtils.damp(currentSpeed, speed, 8, dt);
    const step = Math.min(distance, currentSpeed * dt * Math.min(1, distance / 0.25));
    world.position.x = THREE.MathUtils.clamp(world.position.x + dx / distance * step, -xLimit, xLimit);
    world.position.z = THREE.MathUtils.clamp(world.position.z + dz / distance * step, -0.35, 0.35);
    phase += dt * 9.1;
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

  function trackPointer(event) {
    if (event.pointerType !== 'mouse') return;
    pointer.set(event.clientX, event.clientY);
    hasMouse = true;
    if (state !== 'SLEEPING') hoverLook = 0.65;
  }
  function clearPointer() { hasMouse = false; hoverLook = 0; }
  function noticeTap(x, y) {
    if (state === 'SLEEPING' || state === 'SHY') return;
    pointer.set(x, y);
    tapHold = reduced ? 1.5 : 1.5 + Math.random();
    tapBubble = Math.random() < 0.4 ? 0.5 : 0;
    state = 'CURIOUS';
    settle();
    expressions.setExpression('CURIOUS', { force: true });
  }
  function wakeFromTap() { if (state === 'SLEEPING') wake(); }

  function setShy(value) {
    if (value) {
      if (state === 'SLEEPING') return;
      state = 'SHY';
      petCount++;
      tapHold = 0;
      expressions.setExpression('SHY');
      settle();
      stopFlipperWiggle();
    } else if (state === 'SHY') {
      state = 'IDLE';
      wait = random(0.7, 1.6);
      curiosityCooldown = 1.2;
      if (petCount >= 4 && Math.random() < 0.25) {
        petCount = 0;
        expressions.setExpression('ANGRY', { force: true, duration: 0.85 });
        onMessage('hmph!');
        feet[0].position.y = 0.08;
        gsap.to(feet[0].position, { y: 0, duration: 0.22, overwrite: true });
      } else {
        expressions.setExpression('HAPPY', { force: true });
        happyTime = 0.9;
      }
    }
  }

  function update(delta) {
    const dt = Math.min(delta, 0.05);
    if (state === 'SLEEPING') {
      energy = Math.min(100, energy + dt * 2.2);
      if (energy >= 88) wake();
    } else {
      energy = Math.max(0, energy - dt * 0.34);
      if (energy <= 18 && state !== 'SHY' && state !== 'YAWNING') beginYawn();
    }

    messageWait -= dt;
    if (messageWait <= 0) {
      const options = phrases[state] || phrases.IDLE;
      onMessage(options[Math.floor(Math.random() * options.length)]);
      messageWait = random(13, 22);
    }
    if (state === 'YAWNING') {
      yawnTime -= dt;
      if (yawnTime <= 0) enterSleep();
      return;
    }
    if (state === 'SLEEPING' || state === 'SHY') return;
    hoverLook = Math.max(0, hoverLook - dt);
    if (happyTime > 0) {
      happyTime -= dt;
      if (happyTime <= 0 && expressions.getCurrentExpression() === 'HAPPY') expressions.clearExpression();
    }
    if (energy < 25 && energy > 18 && state === 'IDLE') expressions.setExpression('SLEEPY');

    if (tapHold > 0) {
      tapHold -= dt;
      if (tapBubble > 0) {
        tapBubble -= dt;
        if (tapBubble <= 0) onMessage(Math.random() < 0.5 ? 'hmm?' : "what's that?");
      }
      if (tapHold <= 0) {
        state = 'IDLE'; wait = random(0.4, 1);
        expressions.clearExpression();
      }
    }

    curiosityCooldown = Math.max(0, curiosityCooldown - dt);
    const distance = pointerDistance();
    if (tapHold <= 0 && ((state === 'FOLLOWING' && distance > 185) ||
      (state === 'CURIOUS' && distance > 240))) {
      state = 'IDLE';
      expressions.clearExpression();
      wait = random(0.8, 1.6);
      curiosityCooldown = 2;
      settle();
    } else if (distance < 165 && curiosityCooldown === 0 && state !== 'CURIOUS' && state !== 'FOLLOWING') {
      state = 'CURIOUS';
      expressions.setExpression('CURIOUS', { force: true });
      wait = random(0.65, 1.1);
      settle();
      onMessage('eep!');
    }

    const looking = state === 'CURIOUS' || state === 'FOLLOWING' || tapHold > 0 || hoverLook > 0;
    const rect = canvas.getBoundingClientRect();
    const ndc = new THREE.Vector2((pointer.x - rect.left) / rect.width * 2 - 1,
      -(pointer.y - rect.top) / rect.height * 2 + 1);
    raycaster.setFromCamera(ndc, camera);
    const headWorld = head.getWorldPosition(new THREE.Vector3());
    const lookPlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), -headWorld.z);
    const lookPoint = raycaster.ray.intersectPlane(lookPlane, new THREE.Vector3());
    const localLook = lookPoint ? head.parent.worldToLocal(lookPoint) : null;
    const dx = localLook ? localLook.x - head.position.x : 0;
    const dy = localLook ? localLook.y - head.position.y : 0;
    const headYaw = looking ? THREE.MathUtils.clamp(Math.atan2(dx, 5), -0.25, 0.25) : 0;
    const headPitch = looking ? THREE.MathUtils.clamp(-Math.atan2(dy, 6), -0.16, 0.16) : 0;
    head.rotation.y = THREE.MathUtils.damp(head.rotation.y, headYaw, 11, dt);
    head.rotation.x = THREE.MathUtils.damp(head.rotation.x, headPitch, 11, dt);
    head.rotation.z = THREE.MathUtils.damp(head.rotation.z,
      looking ? THREE.MathUtils.clamp(-dx * 0.025, -0.09, 0.09) : 0, 7, dt);
    curiosity.rotation.y = THREE.MathUtils.damp(curiosity.rotation.y, headYaw * 0.35, 6, dt);

    if (state === 'CURIOUS') {
      if (tapHold > 0) return;
      wait -= dt;
      if (wait <= 0) {
        if (distance < 165 && Math.random() < 0.7 && !reduced) {
          state = 'FOLLOWING';
          speed = random(0.5, 0.8);
        } else {
          state = 'IDLE';
          expressions.clearExpression();
          wait = random(1.1, 2.2);
          curiosityCooldown = 2;
        }
      }
      return;
    }

    if (state === 'FOLLOWING') {
      if (reduced) { state = 'IDLE'; expressions.clearExpression(); return; }
      const x = pointerTargetX();
      targetYaw = x > world.position.x ? 0.35 : -0.35;
      world.rotation.y = THREE.MathUtils.damp(world.rotation.y, targetYaw, 4.8, dt);
      if (moveToward(x, world.position.z, dt)) {
        state = 'CURIOUS';
        wait = random(0.7, 1.2);
      }
      return;
    }

    if (state === 'IDLE') {
      wait -= dt;
      happyWait -= dt;
      if (happyWait <= 0 && energy > 30 && expressions.getCurrentExpression() === 'NEUTRAL') {
        expressions.setExpression('HAPPY', { duration: 1.15 });
        happyWait = random(16, 28);
      }
      phase += dt;
      world.rotation.y = THREE.MathUtils.damp(world.rotation.y, Math.sin(phase) * 0.12, 2, dt);
      wiggleWait -= dt;
      if (wiggleWait <= 0) {
        wiggleFlippers();
        wiggleWait = random(8, 15);
      }
      if (wait <= 0 && !reduced) chooseDestination();
      return;
    }

    world.rotation.y = THREE.MathUtils.damp(world.rotation.y, targetYaw, 4.8, dt);
    if (moveToward(destination.x, destination.y, dt)) {
      state = 'IDLE';
      wait = random(0.5, 1.6);
    }
  }

  resize();
  return {
    world, resize, update, setShy, trackPointer, clearPointer, noticeTap, wakeFromTap,
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
      stopFlipperWiggle();
      settle();
      shadow.geometry.dispose();
      shadow.material.map.dispose();
      shadow.material.dispose();
    }
  };
}
