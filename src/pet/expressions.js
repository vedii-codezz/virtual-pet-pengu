import * as THREE from 'three';
import gsap from 'gsap';

const priority = { NEUTRAL: 0, HAPPY: 1, CURIOUS: 2, SLEEPY: 3, ANGRY: 4, SHY: 5, YAWNING: 6, SLEEPING: 7 };
const faces = {
  NEUTRAL: [1, 0, 0, '#FFB5BA', 0, 0, 0, 0],
  HAPPY: [0.08, 0.04, 0.02, '#FFC0C7', 0.035, -0.03, 0.025, 0.07],
  CURIOUS: [1.2, -0.04, 0.06, '#FFB5BA', 0, -0.035, 0.045, 0.015],
  SLEEPY: [0.48, 0, -0.08, '#FFB5BA', -0.015, 0.1, 0.025, -0.045],
  ANGRY: [0.74, 0.19, -0.04, '#FF9AAB', -0.045, 0.045, -0.03, -0.045],
  SHY: [0.58, 0.03, -0.06, '#FF7898', -0.015, 0.1, 0.09, -0.025],
  YAWNING: [0.08, 0.02, -0.1, '#FFB5BA', -0.19, -0.16, 0, 0],
  SLEEPING: [0.08, 0, -0.08, '#FFB5BA', 0, 0.08, 0, -0.04]
};

export function createExpressions(penguin) {
  const get = (name) => penguin.getObjectByName(name);
  const eyes = [get('leftEye'), get('rightEye')];
  const smileEyes = [get('leftSmileEye'), get('rightSmileEye')];
  const brows = [get('leftBrow'), get('rightBrow')];
  const lids = [get('leftEyelid'), get('rightEyelid')];
  const cheeks = [get('leftCheek'), get('rightCheek')];
  const beak = get('lowerBeak');
  const mouth = get('mouth');
  const head = get('head');
  const pose = get('reaction');
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  const base = { beak: beak.position.y, mouth: mouth.position.y, pose: pose.position.y,
    lids: lids.map((lid) => lid.position.y), cheeks: cheeks.map((cheek) => cheek.material.color.clone()) };
  let expression = 'NEUTRAL';
  let transition, blinkTimer, blink, expiry;

  function apply() {
    transition?.kill(); blink?.kill();
    const [eye, brow, lid, cheek, beakOffset, headX, headZ, bounce] = faces[expression];
    const duration = reduced.matches ? 0 : expression === 'YAWNING' ? 0.42 : 0.2;
    const color = new THREE.Color(cheek);
    smileEyes.forEach((part) => { part.visible = expression === 'HAPPY'; });
    mouth.visible = expression === 'YAWNING';
    transition = gsap.timeline();
    eyes.forEach((part) => transition.to(part.scale, { y: eye, duration, overwrite: true }, 0));
    brows.forEach((part, index) => transition.to(part.rotation, {
      z: (index ? -1 : 1) * brow, duration, overwrite: true }, 0));
    lids.forEach((part, index) => transition.to(part.position, {
      y: base.lids[index] + lid, duration, overwrite: true }, 0));
    cheeks.forEach((part) => transition.to(part.material.color, {
      r: color.r, g: color.g, b: color.b, duration, overwrite: true }, 0));
    transition.to(beak.position, { y: base.beak + beakOffset, duration, overwrite: true }, 0);
    transition.to(mouth.position, { y: base.mouth + beakOffset * 0.45, duration, overwrite: true }, 0);
    transition.to(mouth.scale, { y: expression === 'YAWNING' ? 2.5 : 1, duration, overwrite: true }, 0);
    transition.to(head.rotation, { x: headX, z: headZ, duration, overwrite: true }, 0);
    transition.to(pose.position, { y: base.pose + bounce, duration, overwrite: true }, 0);
  }

  function setExpression(name, { duration = 0, force = false } = {}) {
    if (!(name in faces) || (!force && priority[name] < priority[expression])) return false;
    expiry?.kill(); expiry = undefined;
    if (expression !== name) { expression = name; apply(); }
    if (duration > 0) expiry = gsap.delayedCall(duration, () => {
      expiry = undefined;
      setExpression('NEUTRAL', { force: true });
    });
    return true;
  }

  function scheduleBlink() {
    blinkTimer = gsap.delayedCall(expression === 'SLEEPY' ? 5 : 3 + Math.random() * 3, () => {
      blinkTimer = undefined;
      if (expression !== 'SLEEPING' && expression !== 'YAWNING' && !reduced.matches) {
        blink = gsap.timeline({ onComplete: () => { blink = undefined; } })
          .to(eyes.map((part) => part.scale), { y: 0.08, duration: 0.08 })
          .to(eyes.map((part) => part.scale), { y: faces[expression][0], duration: 0.14 });
      }
      scheduleBlink();
    });
  }
  scheduleBlink();
  reduced.addEventListener('change', apply);
  return {
    setExpression,
    clearExpression() { setExpression('NEUTRAL', { force: true }); },
    getCurrentExpression() { return expression; },
    dispose() {
      reduced.removeEventListener('change', apply);
      blinkTimer?.kill(); blink?.kill(); transition?.kill(); expiry?.kill();
      eyes.forEach((part) => { part.scale.y = 1; });
      cheeks.forEach((part, index) => part.material.color.copy(base.cheeks[index]));
    }
  };
}
