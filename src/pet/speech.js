import * as THREE from 'three';
import gsap from 'gsap';

export function createSpeech(penguin, camera, canvas) {
  const bubble = document.createElement('div');
  bubble.className = 'pengu-speech';
  bubble.setAttribute('role', 'status');
  bubble.setAttribute('aria-live', 'polite');
  document.querySelector('#app').appendChild(bubble);
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const point = new THREE.Vector3();
  let animation;
  let active = false;

  function update() {
    if (!active) return;
    point.set(0, 4.05, 0);
    penguin.localToWorld(point);
    point.project(camera);
    const bounds = canvas.getBoundingClientRect();
    const screenX = bounds.left + (point.x + 1) * bounds.width / 2;
    bubble.style.left = `${Math.max(bounds.left + 96, Math.min(bounds.right - 96, screenX))}px`;
    bubble.style.top = `${bounds.top + (1 - point.y) * bounds.height / 2}px`;
  }

  function show(message, replace = false) {
    if (active && !replace) return false;
    animation?.kill();
    bubble.textContent = message;
    bubble.style.opacity = '1';
    bubble.style.transform = 'translate(-50%, -100%)';
    gsap.set(bubble, { y: 0 });
    active = true;
    update();
    animation = gsap.timeline({ onComplete: () => {
      active = false;
      bubble.style.opacity = '0';
      animation = undefined;
    } });
    if (reducedMotion.matches) animation.to({}, { duration: 2.2 });
    else animation.to({}, { duration: 1.8 })
      .to(bubble, { opacity: 0, y: -12, duration: 0.6, ease: 'sine.inOut' });
    return true;
  }

  return {
    show,
    update,
    dispose() {
      animation?.kill();
      bubble.remove();
    }
  };
}
