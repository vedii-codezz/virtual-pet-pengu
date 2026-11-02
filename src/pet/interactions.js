import * as THREE from 'three';
import gsap from 'gsap';

const activeInteractions = new WeakMap();

function createHeart() {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 64;
  const context = canvas.getContext('2d');
  context.fillStyle = '#ff6b8a';
  context.beginPath();
  context.moveTo(32, 54);
  context.bezierCurveTo(4, 35, 4, 17, 19, 15);
  context.bezierCurveTo(27, 14, 32, 20, 32, 24);
  context.bezierCurveTo(32, 20, 37, 14, 45, 15);
  context.bezierCurveTo(60, 17, 60, 35, 32, 54);
  context.fill();

  const texture = new THREE.CanvasTexture(canvas);
  const material = new THREE.SpriteMaterial({ map: texture, transparent: true, depthWrite: false });
  const heart = new THREE.Sprite(material);
  heart.position.set(0, 4.1, 0);
  heart.scale.set(0.55, 0.55, 1);
  heart.visible = false;
  return heart;
}

export function enablePetting(penguin, camera, renderer, state, onActiveChange = () => {}) {
  if (activeInteractions.has(penguin)) return activeInteractions.get(penguin);

  const reaction = penguin.getObjectByName('reaction');
  const leftFlipper = penguin.getObjectByName('leftFlipper');
  const rightFlipper = penguin.getObjectByName('rightFlipper');
  if (!reaction || !leftFlipper || !rightFlipper) return () => {};

  const canvas = renderer.domElement;
  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  const heart = createHeart();
  penguin.add(heart);
  const initial = {
    y: reaction.position.y,
    tilt: reaction.rotation.z,
    left: leftFlipper.rotation.z,
    right: rightFlipper.rotation.z,
    heartY: heart.position.y
  };
  let lastPet = -Infinity;
  let timeline;
  let disposed = false;

  function isOverPenguin(event) {
    const rect = canvas.getBoundingClientRect();
    pointer.set(
      ((event.clientX - rect.left) / rect.width) * 2 - 1,
      -((event.clientY - rect.top) / rect.height) * 2 + 1
    );
    raycaster.setFromCamera(pointer, camera);
    return raycaster.intersectObjects(reaction.children, true).length > 0;
  }

  function resetPose() {
    reaction.position.y = initial.y;
    reaction.rotation.z = initial.tilt;
    leftFlipper.rotation.z = initial.left;
    rightFlipper.rotation.z = initial.right;
    heart.position.y = initial.heartY;
    heart.material.opacity = 1;
    heart.visible = false;
    timeline = undefined;
    onActiveChange(false);
  }

  function react(force = false) {
    if (state?.sleeping) return false;
    if (!force && (timeline || performance.now() - lastPet < 800)) return false;
    if (timeline) {
      timeline.kill();
      resetPose();
    }
    lastPet = performance.now();
    heart.visible = true;
    onActiveChange(true);

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      timeline = gsap.delayedCall(0.6, resetPose);
      return true;
    }

    timeline = gsap.timeline({ onComplete: resetPose });
    timeline.to(reaction.position, { y: initial.y + 0.24, duration: 0.22, ease: 'power2.out' }, 0)
      .to(reaction.position, { y: initial.y, duration: 0.35, ease: 'bounce.out' }, 0.22)
      .to(reaction.rotation, { z: initial.tilt + 0.08, duration: 0.16, yoyo: true, repeat: 1 }, 0)
      .to(leftFlipper.rotation, { z: initial.left - 0.3, duration: 0.13, yoyo: true, repeat: 3 }, 0)
      .to(rightFlipper.rotation, { z: initial.right + 0.3, duration: 0.13, yoyo: true, repeat: 3 }, 0)
      .to(heart.position, { y: initial.heartY + 0.55, duration: 0.7, ease: 'power1.out' }, 0)
      .to(heart.material, { opacity: 0, duration: 0.35 }, 0.35);
    return true;
  }

  function onPointerDown(event) {
    if (isOverPenguin(event)) react();
  }

  function onPointerMove(event) {
    canvas.style.cursor = !state?.sleeping && event.pointerType === 'mouse' && isOverPenguin(event) ? 'pointer' : '';
  }

  function onPointerLeave() {
    canvas.style.cursor = '';
  }

  canvas.addEventListener('pointerdown', onPointerDown);
  canvas.addEventListener('pointermove', onPointerMove);
  canvas.addEventListener('pointerleave', onPointerLeave);
  const unsubscribe = state?.subscribeStatus(({ sleeping }) => {
    if (!sleeping) return;
    canvas.style.cursor = '';
    timeline?.kill();
    resetPose();
  });

  const dispose = () => {
    if (disposed) return;
    disposed = true;
    canvas.removeEventListener('pointerdown', onPointerDown);
    canvas.removeEventListener('pointermove', onPointerMove);
    canvas.removeEventListener('pointerleave', onPointerLeave);
    canvas.style.cursor = '';
    unsubscribe?.();
    timeline?.kill();
    resetPose();
    penguin.remove(heart);
    heart.material.map.dispose();
    heart.material.dispose();
    activeInteractions.delete(penguin);
  };
  activeInteractions.set(penguin, dispose);
  dispose.react = react;
  return dispose;
}
