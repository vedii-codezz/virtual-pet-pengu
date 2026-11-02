import gsap from 'gsap';

const activeAnimations = new WeakMap();

export function animatePenguin(penguin) {
  if (activeAnimations.has(penguin)) return activeAnimations.get(penguin);

  const eyes = ['leftEye', 'rightEye'].map((name) => penguin.getObjectByName(name));
  const initial = {
    scaleY: penguin.scale.y,
    rotationZ: penguin.rotation.z,
    positionY: penguin.position.y,
    eyes: eyes.map((eye) => eye.scale.y)
  };
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  let tweens = [];
  let blinkTimer;
  let blinkTimeline;

  function scheduleBlink() {
    blinkTimer = gsap.delayedCall(3 + Math.random() * 3, () => {
      blinkTimer = undefined;
      blinkTimeline = gsap.timeline({ onComplete: scheduleBlink });
      const count = Math.random() < 0.25 ? 2 : 1;
      for (let blink = 0; blink < count; blink++) {
        if (blink) blinkTimeline.to({}, { duration: 0.12 });
        blinkTimeline.to(eyes.map((eye) => eye.scale), {
          y: (index) => initial.eyes[index] * 0.08,
          duration: 0.09,
          ease: 'power2.in'
        });
        blinkTimeline.to(eyes.map((eye) => eye.scale), {
          y: (index) => initial.eyes[index],
          duration: 0.14,
          ease: 'power2.out'
        });
      }
    });
  }

  function stopTweens() {
    tweens.forEach((tween) => tween.kill());
    tweens = [];
    blinkTimer?.kill();
    blinkTimeline?.kill();
    blinkTimer = undefined;
    blinkTimeline = undefined;
    penguin.scale.y = initial.scaleY;
    penguin.rotation.z = initial.rotationZ;
    penguin.position.y = initial.positionY;
    eyes.forEach((eye, index) => { eye.scale.y = initial.eyes[index]; });
  }

  function updateMotion() {
    stopTweens();
    if (reducedMotion.matches) return;
    tweens = [
      gsap.to(penguin.scale, {
        y: initial.scaleY * 1.025, duration: 1.5, ease: 'sine.inOut', yoyo: true, repeat: -1
      }),
      gsap.fromTo(penguin.rotation,
        { z: initial.rotationZ - 0.025 },
        { z: initial.rotationZ + 0.025, duration: 2, ease: 'sine.inOut', yoyo: true, repeat: -1 }
      ),
      gsap.to(penguin.position, {
        y: initial.positionY + 0.035, duration: 1.8, ease: 'sine.inOut', yoyo: true, repeat: -1
      })
    ];
    scheduleBlink();
  }

  updateMotion();
  reducedMotion.addEventListener('change', updateMotion);
  const dispose = () => {
    reducedMotion.removeEventListener('change', updateMotion);
    stopTweens();
    activeAnimations.delete(penguin);
  };
  activeAnimations.set(penguin, dispose);
  return dispose;
}
