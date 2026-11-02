import * as THREE from 'three';

const rand = (min, max) => min + Math.random() * (max - min);

export function createRoaming(penguin, camera) {
  const world = new THREE.Group();
  world.name = 'roamingWorld';
  const waddle = new THREE.Group();
  waddle.name = 'waddle';
  world.add(waddle);
  waddle.add(penguin);

  const feet = [
    ['leftFoot', 'leftFootTip'],
    ['rightFoot', 'rightFootTip']
  ].map((names) => names.map((name) => penguin.getObjectByName(name)));
  const footY = feet.map((pair) => pair.map((foot) => foot?.position.y ?? 0));
  const modelBounds = new THREE.Box3().setFromObject(world);
  const margins = 0.32;
  const limits = { minX: 0, maxX: 0, minY: 0, maxY: 0 };
  const destination = new THREE.Vector2();
  const paused = new Set();
  let state = 'IDLE';
  let wait = rand(0.8, 2);
  let speed = 0.6;
  let phase = 0;
  let desiredYaw = 0;

  function clampToScreen() {
    world.position.x = THREE.MathUtils.clamp(world.position.x, limits.minX, limits.maxX);
    world.position.y = THREE.MathUtils.clamp(world.position.y, limits.minY, limits.maxY);
    destination.x = THREE.MathUtils.clamp(destination.x, limits.minX, limits.maxX);
    destination.y = THREE.MathUtils.clamp(destination.y, limits.minY, limits.maxY);
  }

  function resize() {
    // The model bounds include its height and width, so its whole silhouette stays visible.
    const left = camera.left + margins - modelBounds.min.x;
    const right = camera.right - margins - modelBounds.max.x;
    const bottom = camera.bottom + margins - modelBounds.min.y;
    const top = camera.top - margins - modelBounds.max.y;
    limits.minX = Math.min(left, right);
    limits.maxX = Math.max(left, right);
    limits.minY = Math.min(bottom, top);
    limits.maxY = Math.max(bottom, top);
    clampToScreen();
  }

  function settle() {
    waddle.rotation.z = 0;
    feet.forEach((pair, side) => pair.forEach((foot, part) => {
      if (foot) foot.position.y = footY[side][part];
    }));
  }

  function chooseDestination() {
    destination.set(rand(limits.minX, limits.maxX), rand(limits.minY, limits.maxY));
    speed = rand(0.55, 0.95);
    const dx = destination.x - world.position.x;
    const dy = destination.y - world.position.y;
    desiredYaw = THREE.MathUtils.clamp(Math.atan2(dx, Math.abs(dy) + 1) * 0.28, -0.35, 0.35);
    state = 'TURNING';
    wait = rand(0.2, 0.5);
  }

  function setPaused(reason, value) {
    if (paused.has(reason) === Boolean(value)) return;
    if (value) paused.add(reason);
    else paused.delete(reason);
    if (paused.size) {
      state = paused.has('sleep') ? 'SLEEPING' : 'IDLE';
      settle();
    } else {
      state = 'IDLE';
      wait = rand(0.5, 1.4);
    }
  }

  function update(delta) {
    const dt = Math.min(delta, 0.05);
    if (paused.size) return;

    if (state === 'IDLE') {
      wait -= dt;
      world.rotation.y = THREE.MathUtils.damp(world.rotation.y, Math.sin(phase) * 0.08, 3, dt);
      phase += dt;
      if (wait <= 0) chooseDestination();
      return;
    }

    world.rotation.y = THREE.MathUtils.damp(world.rotation.y, desiredYaw, 4, dt);
    if (state === 'TURNING') {
      wait -= dt;
      if (wait <= 0) state = 'WALKING';
      return;
    }

    const dx = destination.x - world.position.x;
    const dy = destination.y - world.position.y;
    const distance = Math.hypot(dx, dy);
    if (distance < 0.06) {
      state = 'IDLE';
      wait = rand(1.2, 3.5);
      settle();
      return;
    }

    const step = Math.min(distance, speed * dt);
    world.position.x += (dx / distance) * step;
    world.position.y += (dy / distance) * step;
    phase += dt * 8;
    waddle.rotation.z = Math.sin(phase) * 0.035;
    feet.forEach((pair, side) => pair.forEach((foot, part) => {
      if (foot) foot.position.y = footY[side][part] + Math.max(0, Math.sin(phase + side * Math.PI)) * 0.07;
    }));
  }

  resize();
  return {
    world,
    resize,
    update,
    setPaused,
    dispose() { settle(); paused.clear(); }
  };
}
