import * as THREE from 'three';
import gsap from 'gsap';
import { createActivities } from './activities.js';

const random = (min, max) => min + Math.random() * (max - min);
const proximityStates = new Set(['IDLE', 'ROAMING', 'CURIOUS', 'FOLLOWING']);
const phrases = {
  ROAMING: ['tiny waddles!', 'wobble wobble', 'lookieee!', 'pingu pingu~'],
  IDLE: ['brrr... ♡', 'hehehehe', 'huh?', 'pew pew!'],
  CURIOUS: ['hmmmm?', 'wut dis?', 'ooooh!', 'tiny mystery!', 'whatcha doin?'],
  FOLLOWING: ['catch meee!', 'i like you!', 'yippieee!'],
  SHY: ['eep!', 'hehe~', 'no lookie!', 'awww', 'me shy!'],
  SLEEPY: ['eepy...', 'five more mins...', 'so cozyyy'],
  SLEEPING: ['zzzzz', 'honk shooo', 'so cozyyy'],
  HAPPY: ['yayyy!!', 'weeeee~', 'yippieee!', 'zoomies!!'],
  PLAYING: ['pew pew!', 'boing!', 'my ball!!', 'hehe gotcha!'],
  READING: ['hmmm...', 'interesting...', 'big brain!', 'very serious.', 'huh?!'],
  HAPPY_DANCE: ['yayyy!!', 'hehehehe', 'weeeee~'],
  BALL_PLAY: ['my ball!!', 'pew pew!', 'boing!'],
  BLANKET_NAP: ['eepy...', 'so cozyyy', 'yawnnn~'],
  WAKING: ['yayyy!!', 'good morninggg~']
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

export function createRoaming(penguin, camera, canvas, { onMessage: showMessage, onSleepChange, expressions }) {
  const stage = new THREE.Group();
  stage.name = 'penguStage';
  const world = new THREE.Group();
  world.name = 'roamingWorld';
  stage.add(world);
  const propWorld = new THREE.Group();
  propWorld.name = 'propWorld';
  stage.add(propWorld);
  const walk = new THREE.Group();
  walk.name = 'walk';
  world.add(walk);
  const activityPose = new THREE.Group();
  activityPose.name = 'activityPose';
  walk.add(activityPose);
  activityPose.add(penguin);
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
  const tapWorld = new THREE.Vector3();
  const pointerNdc = new THREE.Vector2();
  const headWorld = new THREE.Vector3();
  const lookPoint = new THREE.Vector3();
  const lookPlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
  const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  const headRestY = head.position.y;
  const depthLimit = 0.55;
  const limits = { xLimit: 0, depthLimit };
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
  let circle = null;
  let stumbleTime = 0;
  let scurryCooldown = 0;
  let runTime = 0;
  let runAnticipation = 0;
  let stopWobble = 0;
  let arrivalBounce = 0;
  let followX = 0;
  let idleTiltWait = random(9, 16);
  let idleTiltTime = 0;
  let idleTiltDirection = 1;
  let stompTime = 0;
  let phase = 0;
  let messageWait = random(11, 19);
  let speechCooldown = 0;
  let wiggleWait = random(6, 12);
  let happyWait = random(14, 25);
  let flipperTween;
  let curiosityCooldown = 0;
  let activities;

  function onMessage(message, urgent = false) {
    if (speechCooldown > 0 && !urgent) return false;
    const options = phrases[message];
    const line = options ? options[Math.floor(Math.random() * options.length)] : message;
    if (showMessage(line) === false) return false;
    speechCooldown = urgent ? 3 : random(7, 12);
    return true;
  }

  function resize() {
    camera.updateMatrixWorld();
    const widthAt = (z) => 1 / Math.abs(new THREE.Vector3(1, 1.8, z).project(camera).x);
    xLimit = Math.max(0, Math.min(widthAt(-depthLimit), widthAt(depthLimit)) - modelRadius - 0.35);
    limits.xLimit = xLimit;
    world.position.x = THREE.MathUtils.clamp(world.position.x, -xLimit, xLimit);
    destination.x = THREE.MathUtils.clamp(destination.x, -xLimit, xLimit);
    path.forEach((point) => { point.x = THREE.MathUtils.clamp(point.x, -xLimit, xLimit); });
    if (circle) finishMovement();
    activities?.resize();
  }

  function settle(resetFlippers = true, resetMotion = true) {
    currentSpeed = 0;
    if (resetMotion) {
      walk.rotation.z = 0;
      walk.rotation.x = 0;
      walk.scale.y = 1;
      head.position.y = headRestY;
      feet.forEach((foot) => { foot.position.y = 0; });
    }
    if (resetFlippers) idleFlippers.forEach((flipper) => { flipper.rotation.z = 0; });
  }

  function softenStop(dt) {
    walk.rotation.z = THREE.MathUtils.damp(walk.rotation.z, 0, 9, dt);
    walk.rotation.x = THREE.MathUtils.damp(walk.rotation.x, 0, 9, dt);
    walk.scale.y = THREE.MathUtils.damp(walk.scale.y, 1, 9, dt);
    head.position.y = THREE.MathUtils.damp(head.position.y, headRestY, 9, dt);
    for (const foot of feet) foot.position.y = THREE.MathUtils.damp(foot.position.y, 0, 11, dt);
  }

  function relaxPose(dt) {
    currentSpeed = THREE.MathUtils.damp(currentSpeed, 0, 7, dt);
    stopWobble = Math.max(0, stopWobble - dt);
    arrivalBounce = Math.max(0, arrivalBounce - dt);
    walk.rotation.z = THREE.MathUtils.damp(walk.rotation.z,
      reduced ? 0 : Math.sin(stopWobble * 24) * stopWobble * 0.045, 8, dt);
    walk.rotation.x = THREE.MathUtils.damp(walk.rotation.x, 0, 8, dt);
    walk.scale.y = reduced ? 1 : 1 + Math.sin((0.32 - arrivalBounce) / 0.32 * Math.PI) * arrivalBounce * 0.075;
    head.position.y = THREE.MathUtils.damp(head.position.y, headRestY, 9, dt);
    stompTime = Math.max(0, stompTime - dt);
    for (let index = 0; index < feet.length; index++) {
      const target = index === 0 && stompTime > 0
        ? Math.sin((0.25 - stompTime) / 0.25 * Math.PI) * 0.08 : 0;
      feet[index].position.y = THREE.MathUtils.damp(feet[index].position.y, target, 14, dt);
    }
    if (!flipperTween) for (const flipper of idleFlippers) {
      flipper.rotation.z = THREE.MathUtils.damp(flipper.rotation.z, 0, 6, dt);
    }
  }

  function finishMovement() {
    state = 'IDLE';
    wait = random(0.5, 1.4);
    stopWobble = reduced ? 0 : 0.42;
    path = [];
    pathIndex = 0;
    circle = null;
  }

  function stopFlipperWiggle(reset = true) {
    flipperTween?.kill();
    flipperTween = undefined;
    idleFlippers.forEach((flipper) => gsap.killTweensOf(flipper.rotation));
    if (reset) idleFlippers.forEach((flipper) => { flipper.rotation.z = 0; });
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
    circle = null;
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
    const circleSide = start.x > 0 ? -1 : 1;
    const availableX = circleSide > 0 ? xLimit - start.x : xLimit + start.x;
    const radiusX = Math.min(0.62, availableX / 2 - 0.025);
    const radiusZ = Math.min(0.27, depthLimit - Math.abs(start.y) - 0.025);
    if (choice < 0.22 && radiusX > 0.16 && radiusZ > 0.12) {
      state = 'CIRCULAR_WADDLE';
      circle = {
        x: start.x + circleSide * radiusX,
        z: start.y,
        rx: radiusX,
        rz: radiusZ,
        startAngle: circleSide > 0 ? Math.PI : 0,
        direction: Math.random() < 0.5 ? -1 : 1,
        progress: 0,
        total: Math.random() < 0.5 ? Math.PI * 1.35 : Math.PI * 2
      };
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

  function turnToward(dx, dz, dt, running) {
    const facing = Math.atan2(dx, dz);
    const angle = Math.atan2(Math.sin(facing - world.rotation.y), Math.cos(facing - world.rotation.y));
    world.rotation.y += angle * (1 - Math.exp(-(running ? 7.5 : 4.8) * dt));
  }

  function animateSteps(dt, running) {
    const pace = reduced ? 0 : running ? 16 : 9.1;
    phase += dt * pace * Math.max(0.4, currentSpeed / Math.max(speed, 0.1));
    walk.rotation.z = reduced ? 0 : Math.sin(phase) * (running ? 0.065 : 0.032) + Math.sin(stumbleTime * 18) * 0.025;
    walk.rotation.x = THREE.MathUtils.damp(walk.rotation.x, reduced ? 0 : running ? 0.075 : 0.01, 7, dt);
    walk.scale.y = THREE.MathUtils.damp(walk.scale.y, 1, 9, dt);
    head.position.y = headRestY + (running && !reduced ? Math.sin(phase * 0.5) * 0.025 : 0);
    for (let index = 0; index < feet.length; index++) {
      feet[index].position.y = reduced ? 0 : Math.max(0, Math.sin(phase + index * Math.PI)) * (running ? 0.12 : 0.075);
    }
    for (let index = 0; index < idleFlippers.length && !flipperTween && !activities?.active; index++) {
      const flipper = idleFlippers[index];
      flipper.rotation.z = THREE.MathUtils.damp(flipper.rotation.z,
        running && !reduced ? (index ? 1 : -1) * 0.22 + Math.sin(phase + index * Math.PI) * 0.045 : 0, 8, dt);
    }
  }

  function moveToward(x, z, dt, running = false, slow = true) {
    const dx = x - world.position.x;
    const dz = z - world.position.z;
    const distance = Math.hypot(dx, dz);
    if (distance < (slow ? 0.08 : 0.13)) return true;
    const desiredSpeed = reduced ? Math.min(speed, 0.85) : speed;
    currentSpeed = THREE.MathUtils.damp(currentSpeed, desiredSpeed, running ? 9 : 7, dt);
    const step = Math.min(distance, currentSpeed * dt * (slow ? Math.min(1, distance / 0.36) : 1));
    world.position.x = THREE.MathUtils.clamp(world.position.x + dx / distance * step, -xLimit, xLimit);
    world.position.z = THREE.MathUtils.clamp(world.position.z + dz / distance * step, -depthLimit, depthLimit);
    turnToward(dx, dz, dt, running);
    animateSteps(dt, running);
    return false;
  }

  function updateCircle(dt) {
    const { rx, rz, startAngle, direction, total } = circle;
    const angle = startAngle + direction * circle.progress;
    const tangentLength = Math.max(0.1, Math.hypot(rx * Math.sin(angle), rz * Math.cos(angle)));
    const remaining = total - circle.progress;
    const desired = reduced ? Math.min(speed, 0.85) : speed;
    currentSpeed = THREE.MathUtils.damp(currentSpeed, desired, 7, dt);
    const travel = currentSpeed * Math.min(1, remaining * tangentLength / 0.35) * dt;
    circle.progress = Math.min(total, circle.progress + travel / tangentLength);
    const nextAngle = startAngle + direction * circle.progress;
    world.position.x = THREE.MathUtils.clamp(circle.x + rx * Math.cos(nextAngle), -xLimit, xLimit);
    world.position.z = THREE.MathUtils.clamp(circle.z + rz * Math.sin(nextAngle), -depthLimit, depthLimit);
    turnToward(-direction * rx * Math.sin(nextAngle), direction * rz * Math.cos(nextAngle), dt, false);
    animateSteps(dt, false);
    if (circle.progress >= total - 1e-4) finishMovement();
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
    pointerNdc.set(
      (pointer.x - rect.left) / rect.width * 2 - 1,
      -(pointer.y - rect.top) / rect.height * 2 + 1
    );
    raycaster.setFromCamera(pointerNdc, camera);
    if (!raycaster.ray.intersectPlane(frontPlane, pointerWorld)) return world.position.x;
    return THREE.MathUtils.clamp(pointerWorld.x, -xLimit, xLimit);
  }

  function groundTarget(x, y) {
    const rect = canvas.getBoundingClientRect();
    pointerNdc.set((x - rect.left) / rect.width * 2 - 1,
      -(y - rect.top) / rect.height * 2 + 1);
    raycaster.setFromCamera(pointerNdc, camera);
    const hit = raycaster.ray.intersectPlane(groundPlane, tapWorld);
    if (!hit) return destination.set(world.position.x, world.position.z);
    return destination.set(THREE.MathUtils.clamp(hit.x, -xLimit, xLimit),
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
    if (state === 'SLEEPING' || state === 'YAWNING' || state === 'WAKING' || state === 'SHY') return;
    const interruptedActivity = Boolean(activities.active);
    if (interruptedActivity) activities.interrupt();
    pointer.set(x, y);
    const rect = canvas.getBoundingClientRect();
    if (y >= rect.top + rect.height * 0.65) {
      groundTarget(x, y);
      if (state !== 'RUNNING_TO_TAP') {
        currentSpeed = Math.min(currentSpeed, 0.5);
        runAnticipation = reduced ? 0 : 0.13;
      }
      state = 'RUNNING_TO_TAP';
      runTime = 0;
      tapHold = 0;
      path = [];
      circle = null;
      speed = 2.35;
      stopFlipperWiggle(!interruptedActivity);
      expressions.setExpression('CURIOUS', { force: true });
      if (Math.random() < 0.35) onMessage('wheee!');
      return;
    }
    tapHold = reduced ? 1.5 : 1.5 + Math.random();
    tapBubble = Math.random() < 0.4 ? 0.5 : 0;
    state = 'CURIOUS';
    circle = null;
    settle(!interruptedActivity, !interruptedActivity);
    stopFlipperWiggle(!interruptedActivity);
    expressions.setExpression('CURIOUS', { force: true });
  }
  function wakeFromTap() {
    if (state !== 'SLEEPING') return;
    energy = Math.max(energy, 60);
    if (activities.active === 'BLANKET_NAP') {
      activities.wake();
      return;
    }
    wake();
  }

  function setShy(value) {
    if (value) {
      if (state === 'SLEEPING' || state === 'WAKING') return;
      const interruptedActivity = Boolean(activities.active);
      if (interruptedActivity) activities.interrupt();
      state = 'SHY';
      petCount++;
      tapHold = 0;
      expressions.setExpression('SHY');
      settle(!interruptedActivity, !interruptedActivity);
      stopFlipperWiggle(!interruptedActivity);
    } else if (state === 'SHY') {
      state = 'IDLE';
      wait = random(0.7, 1.6);
      curiosityCooldown = 1.2;
      if (petCount >= 4 && Math.random() < 0.25) {
        petCount = 0;
        expressions.setExpression('ANGRY', { force: true, duration: 0.85 });
        onMessage('hmph!');
        stompTime = reduced ? 0 : 0.25;
      } else {
        expressions.setExpression('HAPPY', { force: true });
        happyTime = 0.9;
      }
    }
  }

  function update(delta) {
    const dt = Math.min(delta, 0.05);
    speechCooldown = Math.max(0, speechCooldown - dt);
    if (state === 'SLEEPING') {
      energy = Math.min(100, energy + dt * 2.2);
      if (energy >= 88 && !activities.active) wake();
    } else {
      energy = Math.max(0, energy - dt * 0.34);
      if (energy <= 18 && state !== 'SHY' && state !== 'YAWNING' && !activities.active) {
        if (Math.random() < 0.7) {
          settle();
          stopFlipperWiggle();
          activities.start('BLANKET_NAP');
        } else beginYawn();
      }
    }

    messageWait -= dt;
    if (messageWait <= 0) {
      onMessage(state in phrases ? state : 'IDLE');
      messageWait = random(13, 22);
    }
    const hadActivity = Boolean(activities.active);
    activities.update(dt);
    if (hadActivity || activities.active) return;
    if (state === 'YAWNING') {
      yawnTime -= dt;
      if (yawnTime <= 0) enterSleep();
      return;
    }
    if (state === 'SHY') {
      softenStop(dt);
      idleFlippers[0].rotation.z = THREE.MathUtils.damp(idleFlippers[0].rotation.z, 0.11, 9, dt);
      idleFlippers[1].rotation.z = THREE.MathUtils.damp(idleFlippers[1].rotation.z, -0.11, 9, dt);
      head.rotation.x = THREE.MathUtils.damp(head.rotation.x, 0, 9, dt);
      head.rotation.y = THREE.MathUtils.damp(head.rotation.y, 0, 9, dt);
      head.rotation.z = THREE.MathUtils.damp(head.rotation.z, 0, 9, dt);
      return;
    }
    if (state === 'SLEEPING') return;
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
    } else if (distance < 165 && curiosityCooldown === 0 &&
      proximityStates.has(state) && state !== 'CURIOUS' && state !== 'FOLLOWING') {
      state = 'CURIOUS';
      expressions.setExpression('CURIOUS', { force: true });
      wait = random(0.65, 1.1);
      settle();
      stopFlipperWiggle();
      onMessage('eep!');
    }

    const looking = state === 'CURIOUS' || state === 'FOLLOWING' ||
      state === 'RUNNING_TO_TAP' || tapHold > 0 || hoverLook > 0;
    if (state === 'IDLE' && !looking && !reduced) {
      idleTiltWait -= dt;
      if (idleTiltWait <= 0 && expressions.getCurrentExpression() === 'NEUTRAL') {
        idleTiltTime = 0.8;
        idleTiltDirection = Math.random() < 0.5 ? -1 : 1;
        idleTiltWait = random(10, 18);
        expressions.setExpression('CURIOUS', { duration: 0.8 });
      }
    } else idleTiltTime = 0;
    idleTiltTime = Math.max(0, idleTiltTime - dt);
    const idleTilt = idleTiltTime > 0
      ? idleTiltDirection * 0.065 * Math.sin((0.8 - idleTiltTime) / 0.8 * Math.PI) : 0;
    const rect = canvas.getBoundingClientRect();
    pointerNdc.set((pointer.x - rect.left) / rect.width * 2 - 1,
      -(pointer.y - rect.top) / rect.height * 2 + 1);
    raycaster.setFromCamera(pointerNdc, camera);
    head.getWorldPosition(headWorld);
    lookPlane.constant = -headWorld.z;
    const localLook = raycaster.ray.intersectPlane(lookPlane, lookPoint)
      ? head.parent.worldToLocal(lookPoint) : null;
    const dx = localLook ? localLook.x - head.position.x : 0;
    const dy = localLook ? localLook.y - head.position.y : 0;
    const headYaw = looking ? THREE.MathUtils.clamp(Math.atan2(dx, 5), -0.25, 0.25) : 0;
    const headPitch = looking ? THREE.MathUtils.clamp(-Math.atan2(dy, 6), -0.16, 0.16) : 0;
    head.rotation.y = THREE.MathUtils.damp(head.rotation.y, headYaw, 11, dt);
    head.rotation.x = THREE.MathUtils.damp(head.rotation.x, headPitch, 11, dt);
    head.rotation.z = THREE.MathUtils.damp(head.rotation.z,
      looking ? THREE.MathUtils.clamp(-dx * 0.025, -0.09, 0.09) : idleTilt, 7, dt);
    curiosity.rotation.y = THREE.MathUtils.damp(curiosity.rotation.y, headYaw * 0.35, 6, dt);
    expressions.updateGaze(headYaw / 0.25, -headPitch / 0.16, dt);

    if (state === 'RUNNING_TO_TAP') {
      if (runAnticipation > 0) {
        runAnticipation = Math.max(0, runAnticipation - dt);
        walk.scale.y = THREE.MathUtils.damp(walk.scale.y, 0.97, 18, dt);
        walk.rotation.x = THREE.MathUtils.damp(walk.rotation.x, 0.025, 12, dt);
        return;
      }
      runTime += dt;
      if (runTime > 0.4 && expressions.getCurrentExpression() === 'CURIOUS') {
        expressions.setExpression('HAPPY', { force: true });
      }
      if (moveToward(destination.x, destination.y, dt, true)) {
        finishMovement();
        hoverLook = 0;
        wait = random(0.8, 1.3);
        arrivalBounce = reduced ? 0 : 0.32;
        curiosityCooldown = 1.5;
        expressions.setExpression('HAPPY', { force: true });
        happyTime = 1.1;
        onMessage("i'm here!");
      }
      return;
    }

    if (state === 'CURIOUS') {
      softenStop(dt);
      idleFlippers[0].rotation.z = THREE.MathUtils.damp(idleFlippers[0].rotation.z,
        reduced ? 0 : -0.16, 7, dt);
      idleFlippers[1].rotation.z = THREE.MathUtils.damp(idleFlippers[1].rotation.z, 0, 7, dt);
      if (tapHold > 0) return;
      wait -= dt;
      if (wait <= 0) {
        if (distance < 165 && Math.random() < 0.7 && !reduced) {
          state = 'FOLLOWING';
          speed = random(0.8, 1.15);
          followX = world.position.x;
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
      followX = THREE.MathUtils.damp(followX, pointerTargetX(), 7, dt);
      if (moveToward(followX, world.position.z, dt)) {
        state = 'CURIOUS';
        wait = random(0.7, 1.2);
      }
      return;
    }

    if (state === 'IDLE') {
      relaxPose(dt);
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
      if (wait <= 0) {
        if (!activities.maybeStart(energy)) {
          if (reduced) wait = random(1.5, 3);
          else chooseDestination();
        }
      }
      return;
    }

    if (state === 'ROAMING' && stumbleTime === 0 && !reduced && Math.random() < dt / 70) {
      stumbleTime = 0.45;
      wiggleFlippers();
      onMessage('oopsie!');
    }
    if (state === 'CIRCULAR_WADDLE') {
      updateCircle(dt);
      return;
    }
    const target = path[pathIndex] || destination;
    const moving = moveToward(target.x, target.y, dt, state === 'PLAYFUL_SCURRY',
      path.length === 0 || pathIndex === path.length - 1);
    if (moving && pathIndex < path.length - 1) {
      pathIndex++;
    } else if (moving) {
      if (state === 'PLAYFUL_SCURRY') onMessage('phew!');
      finishMovement();
    }
  }

  activities = createActivities({
    penguin, world, propWorld, pose: activityPose, expressions, onMessage, onSleepChange,
    onState: (next) => {
      if (next !== 'SLEEPING' && next !== 'WAKING') {
        stopFlipperWiggle();
        settle();
      }
      state = next;
    },
    onDone: (previous) => {
      finishMovement();
      if (previous === 'BLANKET_NAP') energy = Math.max(energy, 60);
      if (previous !== 'HAPPY_DANCE') {
        expressions.setExpression('HAPPY', { force: true });
        happyTime = 1.1;
      } else expressions.clearExpression();
    },
    move: (x, z, dt, running, activitySpeed) => {
      speed = activitySpeed;
      return moveToward(x, z, dt, running);
    },
    getLimits: () => limits,
    getReduced: () => reduced
  });
  resize();
  return {
    stage, world, resize, update, setShy, trackPointer, clearPointer, noticeTap, wakeFromTap,
    get state() { return state; },
    get activity() { return activities.active; },
    setReducedMotion(value) {
      reduced = Boolean(value);
      if (reduced) {
        settle();
        stopFlipperWiggle();
        curiosity.rotation.y = 0;
        if (!activities.active && state !== 'SLEEPING' && state !== 'YAWNING' && state !== 'SHY') state = 'IDLE';
      }
    },
    dispose() {
      activities.dispose();
      stopFlipperWiggle();
      settle();
      shadow.geometry.dispose();
      shadow.material.map.dispose();
      shadow.material.dispose();
    }
  };
}
