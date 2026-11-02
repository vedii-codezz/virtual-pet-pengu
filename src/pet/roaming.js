import * as THREE from 'three';

const random = (min, max) => min + Math.random() * (max - min);

function createContactShadow() {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 64;
  const context = canvas.getContext('2d');
  const fade = context.createRadialGradient(32, 32, 2, 32, 32, 31);
  fade.addColorStop(0, 'rgba(53, 92, 133, 0.22)');
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

export function createRoaming(penguin, camera) {
  const world = new THREE.Group();
  world.name = 'roamingWorld';
  const walk = new THREE.Group();
  walk.name = 'walk';
  world.add(walk);
  walk.add(penguin);
  const shadow = createContactShadow();
  world.add(shadow);

  const feet = ['leftFoot', 'rightFoot'].map((name) => penguin.getObjectByName(name));
  const footY = feet.map((foot) => foot.position.y);
  const modelBounds = new THREE.Box3().setFromObject(walk);
  const modelRadius = Math.max(Math.abs(modelBounds.min.x), Math.abs(modelBounds.max.x));
  const destination = new THREE.Vector2(); // x and z, never y
  const paused = new Set();
  let xLimit = 0;
  let state = 'IDLE';
  let wait = random(1, 2.5);
  let speed = 0.6;
  let phase = 0;
  let targetYaw = 0;

  function resize() {
    // Use the narrowest visible width across the allowed depth range.
    const nearDepth = camera.position.distanceTo(new THREE.Vector3(0, 1.8, 0.55));
    const halfWidth = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * nearDepth * camera.aspect;
    xLimit = Math.max(0, halfWidth - modelRadius - 0.45);
    world.position.x = THREE.MathUtils.clamp(world.position.x, -xLimit, xLimit);
    destination.x = THREE.MathUtils.clamp(destination.x, -xLimit, xLimit);
  }

  function settle() {
    walk.rotation.z = 0;
    feet.forEach((foot, index) => { foot.position.y = footY[index]; });
  }

  function chooseDestination() {
    let nextX = random(-xLimit, xLimit);
    if (xLimit > 0.8 && Math.abs(nextX - world.position.x) < 0.8) {
      nextX = world.position.x > 0 ? -random(0, xLimit) : random(0, xLimit);
    }
    destination.set(nextX, random(-0.55, 0.55));
    speed = random(0.5, 0.85);
    targetYaw = nextX >= world.position.x ? 0.55 : -0.55;
    state = 'TURNING';
    wait = random(0.25, 0.5);
  }

  function setPaused(reason, value) {
    if (paused.has(reason) === Boolean(value)) return;
    if (value) paused.add(reason);
    else paused.delete(reason);
    settle();
    state = 'IDLE';
    if (!paused.size) wait = random(0.5, 1.3);
  }

  function update(delta) {
    const dt = Math.min(delta, 0.05);
    if (paused.size) return;

    if (state === 'IDLE') {
      wait -= dt;
      phase += dt;
      world.rotation.y = THREE.MathUtils.damp(world.rotation.y, Math.sin(phase) * 0.12, 2, dt);
      if (wait <= 0) chooseDestination();
      return;
    }

    world.rotation.y = THREE.MathUtils.damp(world.rotation.y, targetYaw, 4, dt);
    if (state === 'TURNING') {
      wait -= dt;
      if (wait <= 0) state = 'WALKING';
      return;
    }

    const dx = destination.x - world.position.x;
    const dz = destination.y - world.position.z;
    const distance = Math.hypot(dx, dz);
    if (distance < 0.06) {
      state = 'IDLE';
      wait = random(1.3, 3.2);
      settle();
      return;
    }

    const step = Math.min(distance, speed * dt);
    world.position.x += (dx / distance) * step;
    world.position.z += (dz / distance) * step;
    phase += dt * 7;
    walk.rotation.z = Math.sin(phase) * 0.03;
    feet.forEach((foot, index) => {
      foot.position.y = footY[index] + Math.max(0, Math.sin(phase + index * Math.PI)) * 0.075;
    });
  }

  resize();
  return {
    world,
    resize,
    update,
    setPaused,
    dispose() {
      settle();
      shadow.geometry.dispose();
      shadow.material.map.dispose();
      shadow.material.dispose();
      paused.clear();
    }
  };
}
