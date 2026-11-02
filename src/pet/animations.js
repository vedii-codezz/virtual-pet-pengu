import gsap from 'gsap';

const activeAnimations = new WeakMap();

export function animatePenguin(penguin) {
  if (activeAnimations.has(penguin)) return activeAnimations.get(penguin);

  const eyes = [penguin.getObjectByName('leftEye'), penguin.getObjectByName('rightEye')]
    .filter(Boolean);
  const eyeScales = eyes.map((eye) => eye.scale.y);
  const sleepLayer = penguin.getObjectByName('sleep');
  const initialSleepTilt = sleepLayer?.rotation.x ?? 0;
  const initial = {
    scaleY: penguin.scale.y,
    rotationZ: penguin.rotation.z,
    positionY: penguin.position.y
  };
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  let tweens = [];
  let blinkTimer;
  let blinkTimeline;
  let transitions = [];
  let sleeping = false;

  function scheduleBlink() {
    blinkTimer = gsap.delayedCall(3 + Math.random() * 3, () => {
      blinkTimer = undefined;
      const doubleBlink = Math.random() < 0.25;
      blinkTimeline = gsap.timeline({ onComplete: scheduleBlink });

      for (let blink = 0; blink < (doubleBlink ? 2 : 1); blink++) {
        if (blink) blinkTimeline.to({}, { duration: 0.12 });
        blinkTimeline.to(eyes.map((eye) => eye.scale), {
          y: (index) => eyeScales[index] * 0.08,
          duration: 0.09,
          ease: 'power2.in'
        });
        blinkTimeline.to(eyes.map((eye) => eye.scale), {
          y: (index) => eyeScales[index],
          duration: 0.14,
          ease: 'power2.out'
        });
      }
    });
  }

  function updateAnimation() {
    tweens.forEach((tween) => tween.kill());
    tweens = [];
    blinkTimer?.kill();
    blinkTimeline?.kill();
    blinkTimer = undefined;
    blinkTimeline = undefined;
    transitions.forEach((tween) => tween.kill());
    transitions = [];

    penguin.scale.y = initial.scaleY;
    penguin.rotation.z = initial.rotationZ;
    penguin.position.y = initial.positionY;
    if (reducedMotion.matches) {
      eyes.forEach((eye, index) => { eye.scale.y = sleeping ? eyeScales[index] * 0.08 : eyeScales[index]; });
      if (sleepLayer) sleepLayer.rotation.x = sleeping ? initialSleepTilt + 0.12 : initialSleepTilt;
      return;
    }

    transitions.push(gsap.to(eyes.map((eye) => eye.scale), {
      y: (index) => sleeping ? eyeScales[index] * 0.08 : eyeScales[index],
      duration: 0.3,
      ease: 'sine.inOut'
    }));
    if (sleepLayer) transitions.push(gsap.to(sleepLayer.rotation, {
      x: sleeping ? initialSleepTilt + 0.12 : initialSleepTilt,
      duration: 0.45,
      ease: 'sine.inOut'
    }));

    if (sleeping) {
      tweens = [gsap.fromTo(penguin.scale,
        { y: initial.scaleY },
        { y: initial.scaleY * 1.012, duration: 3, ease: 'sine.inOut', yoyo: true, repeat: -1 }
      )];
      return;
    }

    tweens = [
      gsap.fromTo(penguin.scale,
        { y: initial.scaleY },
        { y: initial.scaleY * 1.025, duration: 1.5, ease: 'sine.inOut', yoyo: true, repeat: -1 }
      ),
      gsap.fromTo(penguin.rotation,
        { z: initial.rotationZ - 0.025 },
        { z: initial.rotationZ + 0.025, duration: 2, ease: 'sine.inOut', yoyo: true, repeat: -1 }
      ),
      gsap.fromTo(penguin.position,
        { y: initial.positionY },
        { y: initial.positionY + 0.035, duration: 1.8, ease: 'sine.inOut', yoyo: true, repeat: -1 }
      )
    ];
    if (eyes.length === 2) scheduleBlink();
  }

  updateAnimation();
  reducedMotion.addEventListener('change', updateAnimation);

  const stop = () => {
    reducedMotion.removeEventListener('change', updateAnimation);
    tweens.forEach((tween) => tween.kill());
    blinkTimer?.kill();
    blinkTimeline?.kill();
    transitions.forEach((tween) => tween.kill());
    penguin.scale.y = initial.scaleY;
    penguin.rotation.z = initial.rotationZ;
    penguin.position.y = initial.positionY;
    eyes.forEach((eye, index) => { eye.scale.y = eyeScales[index]; });
    if (sleepLayer) sleepLayer.rotation.x = initialSleepTilt;
    activeAnimations.delete(penguin);
  };
  stop.setSleeping = (value) => {
    if (sleeping === Boolean(value)) return;
    sleeping = Boolean(value);
    updateAnimation();
  };
  activeAnimations.set(penguin, stop);
  return stop;
}
