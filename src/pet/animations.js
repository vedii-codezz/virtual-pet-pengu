import gsap from 'gsap';

const activeAnimations = new WeakMap();

export function animatePenguin(penguin) {
  if (activeAnimations.has(penguin)) return activeAnimations.get(penguin);

  const sleepLayer = penguin.getObjectByName('sleep');
  const initial = {
    scaleY: penguin.scale.y,
    rotationZ: penguin.rotation.z,
    positionY: penguin.position.y,
  };
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  let tweens = [];
  let poseTransition;
  let tiltTransition;
  let sleeping = false;

  function stopTweens() {
    tweens.forEach((tween) => tween.kill());
    tweens = [];
    poseTransition?.kill();
    tiltTransition?.kill();
    penguin.scale.y = initial.scaleY;
    penguin.rotation.z = initial.rotationZ;
    penguin.position.y = initial.positionY;
  }

  function updateMotion() {
    stopTweens();
    const poseTarget = sleeping ? -0.11 : 0;
    if (reducedMotion.matches) {
      sleepLayer.position.y = poseTarget;
      sleepLayer.rotation.x = sleeping ? 0.09 : 0;
      return;
    }
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
  }

  updateMotion();
  reducedMotion.addEventListener('change', updateMotion);
  const dispose = () => {
    reducedMotion.removeEventListener('change', updateMotion);
    stopTweens();
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
