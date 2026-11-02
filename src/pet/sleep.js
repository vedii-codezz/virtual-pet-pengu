import * as THREE from 'three';
import gsap from 'gsap';

export function createSleepVisual(penguin, camera, canvas, idle) {
  const z = document.createElement('span');
  z.className = 'pengu-z';
  z.textContent = 'z';
  z.setAttribute('aria-hidden', 'true');
  document.querySelector('#app').appendChild(z);
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const point = new THREE.Vector3();
  let sleeping = false;
  let timer;
  let animation;

  function update() {
    if (!sleeping) return;
    point.set(0.72, 4.0, 0);
    penguin.localToWorld(point);
    point.project(camera);
    const bounds = canvas.getBoundingClientRect();
    z.style.left = `${bounds.left + (point.x + 1) * bounds.width / 2}px`;
    z.style.top = `${bounds.top + (1 - point.y) * bounds.height / 2}px`;
  }

  function stopZ() {
    timer?.kill();
    animation?.kill();
    timer = undefined;
    animation = undefined;
    z.style.opacity = '0';
    gsap.set(z, { y: 0 });
  }

  function scheduleZ() {
    timer = gsap.delayedCall(2.5 + Math.random() * 2, () => {
      timer = undefined;
      z.style.opacity = '1';
      gsap.set(z, { y: 0 });
      animation = gsap.timeline({ onComplete: () => {
        z.style.opacity = '0';
        animation = undefined;
        if (sleeping) scheduleZ();
      } });
      animation.to(z, { y: -24, duration: 1.4, ease: 'sine.out' }, 0)
        .to(z, { opacity: 0, duration: 0.5 }, 0.9);
    });
  }

  function setSleeping(value) {
    if (sleeping === Boolean(value)) return;
    sleeping = Boolean(value);
    idle.setSleeping(sleeping);
    stopZ();
    if (!sleeping) return;
    update();
    if (reducedMotion.matches) z.style.opacity = '1';
    else scheduleZ();
  }

  function onMotionChange() {
    if (!sleeping) return;
    stopZ();
    if (reducedMotion.matches) z.style.opacity = '1';
    else scheduleZ();
  }
  reducedMotion.addEventListener('change', onMotionChange);

  return {
    setSleeping,
    update,
    dispose() {
      reducedMotion.removeEventListener('change', onMotionChange);
      stopZ();
      z.remove();
    }
  };
}
