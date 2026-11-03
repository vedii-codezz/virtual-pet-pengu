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
  const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  const headRestY = head.position.y;
  const depthLimit = 0.55;
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
  let path = [];
  let pathIndex = 0;
  let stumbleTime = 0;
  let scurryCooldown = 0;
  let runTime = 0;
  let phase = 0;
  let messageWait = random(11, 19);
  let wiggleWait = random(6, 12);
  let happyWait = random(14, 25);
  let flipperTween;
  let curiosityCooldown = 0;

  function resize() {
    camera.updateMatrixWorld();
    const widthAt = (z) => 1 / Math.abs(new THREE.Vector3(1, 1.8, z).project(camera).x);
    xLimit = Math.max(0, Math.min(widthAt(-depthLimit), widthAt(depthLimit)) - modelRadius - 0.35);
    world.position.x = THREE.MathUtils.clamp(world.position.x, -xLimit, xLimit);
    destination.x = THREE.MathUtils.clamp(destination.x, -xLimit, xLimit);
    path.forEach((point) => { point.x = THREE.MathUtils.clamp(point.x, -xLimit, xLimit); });
  }

  function settle() {
    currentSpeed = 0;
    walk.rotation.z = 0;
    walk.rotation.x = 0;
    head.position.y = headRestY;
    feet.forEach((foot) => { foot.position.y = 0; });
    idleFlippers.forEach((flipper) => { flipper.rotation.z = 0; });
  }

  function stopFlipperWiggle() {
    flipperTween?.kill();
    flipperTween = undefined;
    idleFlippers.forEach((flipper) => gsap.killTweensOf(flipper.rotation));
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
    stopFlipperWiggle();
    path = [];
    pathIndex = 0;
    const start = new THREE.Vector2(world.position.x, world.position.z);
    const next = new THREE.Vector2(random(-xLimit, xLimit), random(-depthLimit, depthLimit));
    const choice = Math.random();
    if (choice < 0.09 && scurryCooldown <= 0 && !reduced) {
      state = 'PLAYFUL_SCURRY';
      destination.set(THREE.MathUtils.clamp(start.x + random(-1.5, 1.5), -xLimit, xLimit),
        THREE.MathUtils.clamp(start.y + random(-0.45, 0.45), -depthLimit, depthLimit));
      speed = random(2.05, 2.65);
      scurryCooldown = random(13, 22);
      if (Math.random() < 0.35) onMessage('wheee!');
      return;
    }
    speed = random(0.82, 1.34);
    if (choice < 0.22 && xLimit > 0.65) {
      state = 'CIRCULAR_WADDLE';
      const rx = Math.min(0.62, xLimit * 0.42);
      const rz = 0.27;
      const cx = THREE.MathUtils.clamp(start.x - rx, -xLimit + rx, xLimit - rx);
      const cz = THREE.MathUtils.clamp(start.y, -depthLimit + rz, depthLimit - rz);
      const total = Math.random() < 0.5 ? 14 : 25;
      const direction = Math.random() < 0.5 ? -1 : 1;
      for (let i = 1; i <= total; i++) {
        const angle = direction * i * Math.PI / 12;
        path.push(new THREE.Vector2(cx + Math.cos(angle) * rx, cz + Math.sin(angle) * rz));
      }
      if (Math.random() < 0.3) onMessage('hehe~');
    } else if (choice < 0.35) {
      state = 'ROAMING';
      const turns = 2 + Math.floor(Math.random() * 2);
      for (let i = 1; i <= turns; i++) {
        path.push(new THREE.Vector2(
          THREE.MathUtils.clamp(start.x + (next.x - start.x) * i / turns + (i % 2 ? 0.28 : -0.28), -xLimit, xLimit),
          THREE.MathUtils.clamp(start.y + (next.y - start.y) * i / turns, -depthLimit, depthLimit)));
      }
    } else if (choice < 0.6) {
      state = 'ROAMING';
      const control = new THREE.Vector2((start.x + next.x) / 2,
        THREE.MathUtils.clamp((start.y + next.y) / 2 + random(-0.45, 0.45), -depthLimit, depthLimit));
      for (let i = 1; i <= 12; i++) {
        const t = i / 12;
        path.push(new THREE.Vector2(
          (1 - t) ** 2 * start.x + 2 * (1 - t) * t * control.x + t ** 2 * next.x,
          (1 - t) ** 2 * start.y + 2 * (1 - t) * t * control.y + t ** 2 * next.y));
      }
    } else {
      state = 'ROAMING';
      destination.copy(next);
    }
  }

  function moveToward(x, z, dt, { running = false, slow = true } = {}) {
    const dx = x - world.position.x;
    const dz = z - world.position.z;
    const distance = Math.hypot(dx, dz);
    if (distance < (slow ? 0.08 : 0.13)) return true;
    const desiredSpeed = reduced ? Math.min(speed, 0.85) : speed;
    currentSpeed = THREE.MathUtils.damp(currentSpeed, desiredSpeed, running ? 9 : 7, dt);
    const step = Math.min(distance, currentSpeed * dt * (slow ? Math.min(1, distance / 0.36) : 1));
    world.position.x = THREE.MathUtils.clamp(world.position.x + dx / distance * step, -xLimit, xLimit);
    world.position.z = THREE.MathUtils.clamp(world.position.z + dz / distance * step, -depthLimit, depthLimit);
    const facing = Math.atan2(dx, dz);
    const angle = Math.atan2(Math.sin(facing - world.rotation.y), Math.cos(facing - world.rotation.y));
    world.rotation.y += angle * (1 - Math.exp(-(running ? 7.5 : 4.8) * dt));
    phase += dt * (running ? 16 : 9.1) * Math.max(0.4, currentSpeed / desiredSpeed);
    walk.rotation.z = reduced ? 0 : Math.sin(phase) * (running ? 0.065 : 0.032) + Math.sin(stumbleTime * 18) * 0.025;
    walk.rotation.x = THREE.MathUtils.damp(walk.rotation.x, reduced ? 0 : running ? 0.075 : 0.01, 7, dt);
    head.position.y = headRestY + (running && !reduced ? Math.sin(phase * 0.5) * 0.025 : 0);
    feet.forEach((foot, index) => {
      foot.position.y = reduced ? 0 : Math.max(0, Math.sin(phase + index * Math.PI)) * (running ? 0.12 : 0.075);
    });
    if (running) idleFlippers.forEach((flipper, index) => {
      flipper.rotation.z = THREE.MathUtils.damp(flipper.rotation.z, (index ? 1 : -1) * 0.22, 8, dt);
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

  function groundTarget(x, y) {
    const rect = canvas.getBoundingClientRect();
    const ndc = new THREE.Vector2((x - rect.left) / rect.width * 2 - 1,
      -(y - rect.top) / rect.height * 2 + 1);
    raycaster.setFromCamera(ndc, camera);
    const hit = raycaster.ray.intersectPlane(groundPlane, pointerWorld);
    if (!hit) return destination.set(world.position.x, world.position.z);
    const frontHit = raycaster.ray.intersectPlane(frontPlane, new THREE.Vector3());
    return destination.set(THREE.MathUtils.clamp(frontHit?.x ?? hit.x, -xLimit, xLimit),
      THREE.MathUtils.clamp(hit.z, -depthLimit, depthLimit));
  }

  function trackPointer(event) {
    if (event.pointerType !== 'mouse') return;
    pointer.set(event.clientX, event.clientY);
    hasMouse = true;
    if (state !== 'SLEEPING') hoverLook = 0.65;
  }
  function clearPointer() { hasMouse = false; hoverLook = 0; }
  function noticeTap(x, y) {
    if (state === 'SLEEPING' || state === 'YAWNING' || state === 'SHY') return;
    pointer.set(x, y);
    const rect = canvas.getBoundingClientRect();
    if (y >= rect.top + rect.height * 0.65) {
      groundTarget(x, y);
      if (state !== 'RUNNING_TO_TAP') currentSpeed = Math.min(currentSpeed, 0.5);
      state = 'RUNNING_TO_TAP';
      runTime = 0;
      tapHold = 0;
      path = [];
      speed = 2.35;
      stopFlipperWiggle();
      expressions.setExpression('CURIOUS', { force: true });
      if (Math.random() < 0.35) onMessage('wheee!');
      return;
    }
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
    scurryCooldown = Math.max(0, scurryCooldown - dt);
    stumbleTime = Math.max(0, stumbleTime - dt);
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
    } else if (distance < 165 && curiosityCooldown === 0 && state !== 'CURIOUS' &&
      state !== 'FOLLOWING' && state !== 'RUNNING_TO_TAP') {
      state = 'CURIOUS';
      expressions.setExpression('CURIOUS', { force: true });
      wait = random(0.65, 1.1);
      settle();
      onMessage('eep!');
    }

    const looking = state === 'CURIOUS' || state === 'FOLLOWING' ||
      state === 'RUNNING_TO_TAP' || tapHold > 0 || hoverLook > 0;
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

    if (state === 'RUNNING_TO_TAP') {
      runTime += dt;
      if (runTime > 0.4 && expressions.getCurrentExpression() === 'CURIOUS') {
        expressions.setExpression('HAPPY', { force: true });
      }
      if (moveToward(destination.x, destination.y, dt, { running: true })) {
        settle();
        state = 'IDLE';
        hoverLook = 0;
        wait = random(0.8, 1.3);
        curiosityCooldown = 1.5;
        expressions.setExpression('HAPPY', { force: true });
        happyTime = 1.1;
        onMessage("i'm here!");
      }
      return;
    }

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

    if (state === 'ROAMING' && stumbleTime === 0 && !reduced && Math.random() < dt / 70) {
      stumbleTime = 0.45;
      wiggleFlippers();
      onMessage('oopsie!');
    }
    const target = path[pathIndex] || destination;
    const moving = moveToward(target.x, target.y, dt, {
      running: state === 'PLAYFUL_SCURRY', slow: path.length === 0 || pathIndex === path.length - 1
    });
    if (moving && pathIndex < path.length - 1) {
      pathIndex++;
    } else if (moving) {
      if (state === 'PLAYFUL_SCURRY') onMessage('phew!');
      settle();
      path = [];
      pathIndex = 0;
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
        if (state !== 'SLEEPING' && state !== 'YAWNING' && state !== 'SHY') state = 'IDLE';
      }
    },
    dispose() {
      stopFlipperWiggle();
      feet.forEach((foot) => gsap.killTweensOf(foot.position));
      settle();
      shadow.geometry.dispose();
      shadow.material.map.dispose();
      shadow.material.dispose();
    }
  };
}
