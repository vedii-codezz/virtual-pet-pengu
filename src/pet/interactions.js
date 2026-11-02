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
  heart.position.set(0, 4.02, 0);
  heart.scale.set(0.55, 0.55, 1);
  heart.visible = false;
  return heart;
}

export function enablePetting(penguin, camera, renderer, {
  onActiveChange = () => {},
  onPet = () => {},
  canPet = () => true
} = {}) {
  if (activeInteractions.has(penguin)) return activeInteractions.get(penguin);

  const reaction = penguin.getObjectByName('reaction');
  const leftFlipper = penguin.getObjectByName('leftFlipper');
  const rightFlipper = penguin.getObjectByName('rightFlipper');
  const head = penguin.getObjectByName('head');
  const cheek = penguin.getObjectByName('leftCheek')?.material;
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
    head: head.rotation.z,
    blush: cheek.color.clone(),
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
    head.rotation.z = initial.head;
    cheek.color.copy(initial.blush);
    heart.position.y = initial.heartY;
    heart.material.opacity = 1;
    heart.visible = false;
    timeline = undefined;
    onActiveChange(false);
  }

  function react() {
    if (timeline || performance.now() - lastPet < 800) return false;
    lastPet = performance.now();
    heart.visible = true;
    onActiveChange(true);
    onPet();

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      cheek.color.set('#FF8FA4');
      timeline = gsap.delayedCall(0.6, resetPose);
      return true;
    }

    timeline = gsap.timeline({ onComplete: resetPose });
    timeline.to(reaction.position, { y: initial.y + 0.17, duration: 0.18, ease: 'power2.out' }, 0)
      .to(reaction.position, { y: initial.y, duration: 0.32, ease: 'bounce.out' }, 0.18)
      .to(reaction.rotation, { z: initial.tilt + 0.045, duration: 0.2, yoyo: true, repeat: 1 }, 0)
      .to(head.rotation, { z: initial.head + 0.09, duration: 0.22, ease: 'sine.out' }, 0.05)
      .to(head.rotation, { z: initial.head, duration: 0.35, ease: 'sine.inOut' }, 0.35)
      .to(cheek.color, { r: new THREE.Color('#FF8FA4').r, g: new THREE.Color('#FF8FA4').g, b: new THREE.Color('#FF8FA4').b, duration: 0.28 }, 0)
      .to(cheek.color, { r: initial.blush.r, g: initial.blush.g, b: initial.blush.b, duration: 0.45 }, 0.4)
      .to(leftFlipper.rotation, { z: initial.left - 0.3, duration: 0.13, yoyo: true, repeat: 3 }, 0)
      .to(rightFlipper.rotation, { z: initial.right + 0.3, duration: 0.13, yoyo: true, repeat: 3 }, 0)
      .to(heart.position, { y: initial.heartY + 0.55, duration: 0.7, ease: 'power1.out' }, 0)
      .to(heart.material, { opacity: 0, duration: 0.35 }, 0.35);
    return true;
  }

  function onPointerDown(event) {
    if (canPet() && isOverPenguin(event)) react();
  }

  function onPointerMove(event) {
    canvas.style.cursor = event.pointerType === 'mouse' && isOverPenguin(event) ? 'pointer' : '';
  }

  function onPointerLeave() {
    canvas.style.cursor = '';
  }

  canvas.addEventListener('pointerdown', onPointerDown);
  canvas.addEventListener('pointermove', onPointerMove);
  canvas.addEventListener('pointerleave', onPointerLeave);

  const dispose = () => {
    if (disposed) return;
    disposed = true;
    canvas.removeEventListener('pointerdown', onPointerDown);
    canvas.removeEventListener('pointermove', onPointerMove);
    canvas.removeEventListener('pointerleave', onPointerLeave);
    canvas.style.cursor = '';
    timeline?.kill();
    resetPose();
    penguin.remove(heart);
    heart.material.map.dispose();
    heart.material.dispose();
    activeInteractions.delete(penguin);
  };
  activeInteractions.set(penguin, dispose);
  return dispose;
}
