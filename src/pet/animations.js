import gsap from 'gsap';

const activeAnimations = new WeakMap();

export function animatePenguin(penguin) {
  if (activeAnimations.has(penguin)) return activeAnimations.get(penguin);

  const eyes = ['leftEye', 'rightEye'].map((name) => penguin.getObjectByName(name));
  const sleepLayer = penguin.getObjectByName('sleep');
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
  let eyeTransition;
  let poseTransition;
  let tiltTransition;
  let sleeping = false;

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
    eyeTransition?.kill();
    poseTransition?.kill();
    tiltTransition?.kill();
    blinkTimer = undefined;
    blinkTimeline = undefined;
    penguin.scale.y = initial.scaleY;
    penguin.rotation.z = initial.rotationZ;
    penguin.position.y = initial.positionY;
  }

  function updateMotion() {
    stopTweens();
    const eyeTarget = (index) => sleeping ? initial.eyes[index] * 0.08 : initial.eyes[index];
    const poseTarget = sleeping ? -0.11 : 0;
    if (reducedMotion.matches) {
      eyes.forEach((eye, index) => { eye.scale.y = eyeTarget(index); });
      sleepLayer.position.y = poseTarget;
      sleepLayer.rotation.x = sleeping ? 0.09 : 0;
      return;
    }
    eyeTransition = gsap.to(eyes.map((eye) => eye.scale), {
      y: eyeTarget, duration: 0.28, ease: 'sine.inOut'
    });
    poseTransition = gsap.to(sleepLayer.position, { y: poseTarget, duration: 0.45, ease: 'sine.inOut' });
    tiltTransition = gsap.to(sleepLayer.rotation, { x: sleeping ? 0.09 : 0, duration: 0.45, ease: 'sine.inOut' });
    if (sleeping) {
      tweens = [gsap.to(penguin.scale, {
        y: initial.scaleY * 1.012, duration: 3, ease: 'sine.inOut', yoyo: true, repeat: -1
      })];
      return;
    }
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
    eyes.forEach((eye, index) => { eye.scale.y = initial.eyes[index]; });
    sleepLayer.position.y = 0;
    sleepLayer.rotation.x = 0;
    activeAnimations.delete(penguin);
  };
  dispose.setSleeping = (value) => {
    if (sleeping === Boolean(value)) return;
    sleeping = Boolean(value);
    updateMotion();
  };
  activeAnimations.set(penguin, dispose);
  return dispose;
}
