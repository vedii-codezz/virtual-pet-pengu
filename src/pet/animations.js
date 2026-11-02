import gsap from 'gsap';

export function animatePenguin(penguin) {
  const initial = {
    scaleY: penguin.scale.y,
    rotationZ: penguin.rotation.z,
    positionY: penguin.position.y
  };
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  let tweens = [];

  function updateAnimation() {
    tweens.forEach((tween) => tween.kill());
    tweens = [];

    penguin.scale.y = initial.scaleY;
    penguin.rotation.z = initial.rotationZ;
    penguin.position.y = initial.positionY;

    if (reducedMotion.matches) return;

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
  }

  updateAnimation();
  reducedMotion.addEventListener('change', updateAnimation);
}
