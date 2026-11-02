import * as THREE from 'three';
import gsap from 'gsap';

function createZ() {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 64;
  const context = canvas.getContext('2d');
  context.fillStyle = '#355c85';
  context.font = 'bold 52px system-ui';
  context.textAlign = 'center';
  context.fillText('Z', 32, 51);
  const texture = new THREE.CanvasTexture(canvas);
  const material = new THREE.SpriteMaterial({ map: texture, transparent: true, depthWrite: false });
  const sprite = new THREE.Sprite(material);
  sprite.scale.set(0.45, 0.45, 1);
  sprite.position.set(0.65, 4.05, 0);
  sprite.visible = false;
  return sprite;
}

export function enableSleep(penguin, state, idle) {
  const z = createZ();
  penguin.add(z);
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const originY = z.position.y;
  let timer;
  let floatTween;
  let disposed = false;
  let wasSleeping;
  let wasReduced;

  function stopZ() {
    timer?.kill();
    floatTween?.kill();
    timer = undefined;
    floatTween = undefined;
    z.position.y = originY;
    z.material.opacity = 1;
    z.visible = false;
  }

  function scheduleZ() {
    timer = gsap.delayedCall(2.5 + Math.random() * 2, () => {
      timer = undefined;
      z.visible = true;
      z.position.y = originY;
      z.material.opacity = 1;
      floatTween = gsap.timeline({ onComplete: () => {
        z.visible = false;
        floatTween = undefined;
        scheduleZ();
      } });
      floatTween.to(z.position, { y: originY + 0.55, duration: 1.2, ease: 'power1.out' }, 0)
        .to(z.material, { opacity: 0, duration: 0.6 }, 0.6);
    });
  }

  function update({ sleeping }) {
    if (sleeping === wasSleeping && reducedMotion.matches === wasReduced) return;
    wasSleeping = sleeping;
    wasReduced = reducedMotion.matches;
    idle.setSleeping(sleeping);
    stopZ();
    if (!sleeping) return;
    if (reducedMotion.matches) z.visible = true;
    else scheduleZ();
  }

  const unsubscribe = state.subscribeStatus(update);
  const onMotionChange = () => update({ sleeping: state.sleeping });
  reducedMotion.addEventListener('change', onMotionChange);

  return () => {
    if (disposed) return;
    disposed = true;
    unsubscribe();
    reducedMotion.removeEventListener('change', onMotionChange);
    stopZ();
    penguin.remove(z);
    z.material.map.dispose();
    z.material.dispose();
  };
}
