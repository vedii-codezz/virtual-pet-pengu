import * as THREE from 'three';
import { createProps } from './props.js';

const random = (min, max) => min + Math.random() * (max - min);
const approach = (current, target, dt, rate = 7) => THREE.MathUtils.damp(current, target, rate, dt);

// Activity poses and props have one owner. Roaming owns travel and resumes it only after interrupt/done.
export function createActivities({ penguin, world, propWorld, pose, expressions, onMessage,
  onState, onSleepChange, onDone, move, getLimits, getReduced }) {
  const props = createProps(penguin, propWorld);
  const head = penguin.getObjectByName('headLook');
  const flippers = ['leftIdleFlipper', 'rightIdleFlipper'].map((name) => penguin.getObjectByName(name));
  const flipperRest = flippers.map((flipper) => flipper.position.clone());
  let active = null;
  let phase = '';
  let time = 0;
  let duration = 0;
  let cooldown = random(16, 27);
  let napSpotX = 0;
  let napSpotZ = 0;
  let napSide = 1;
  let ballDirection = 1;
  let ballVelocityX = 0;
  let ballVelocityZ = 0;
  let ballKicks = 0;
  let surprise = false;

  function setPhase(next, length = 0) {
    phase = next;
    time = 0;
    duration = length;
  }

  function setFlippers(left, right, dt) {
    flippers[0].rotation.z = approach(flippers[0].rotation.z, left, dt);
    flippers[1].rotation.z = approach(flippers[1].rotation.z, right, dt);
  }

  function restoreFlipperPosition(dt) {
    for (let index = 0; index < flippers.length; index++) {
      flippers[index].position.x = approach(flippers[index].position.x, flipperRest[index].x, dt);
      flippers[index].position.y = approach(flippers[index].position.y, flipperRest[index].y, dt);
    }
  }

  function hideProps() {
    for (const prop of [props.spectacles, props.newspaper, props.blanket, props.ball, props.ballShadow]) {
      prop.visible = false;
    }
    props.spectacles.scale.setScalar(0.01);
    props.newspaper.scale.setScalar(0.01);
    props.blanket.scale.set(0.01, 0.01, 1);
    props.ball.scale.setScalar(0.01);
    props.page.rotation.y = 0;
    props.ball.rotation.set(0, 0, 0);
  }

  function interrupt() {
    if (!active) return;
    if (active === 'BLANKET_NAP' && phase === 'SLEEP') onSleepChange(false);
    active = null;
    setPhase('');
    hideProps();
    expressions.clearExpression();
    cooldown = Math.max(cooldown, random(14, 23));
  }

  function finish() {
    const previous = active;
    active = null;
    setPhase('');
    hideProps();
    cooldown = random(22, 38);
    onDone(previous);
  }

  function start(kind) {
    if (active) interrupt();
    active = kind;
    surprise = false;
    ballKicks = 0;
    onState(kind);
    if (kind === 'READING') {
      props.spectacles.visible = true;
      props.newspaper.visible = true;
      expressions.setExpression('CURIOUS', { force: true });
      setPhase('INTRO', getReduced() ? 0.25 : 1.1);
    } else if (kind === 'BALL_PLAY') {
      const { xLimit, depthLimit } = getLimits();
      ballDirection = world.position.x > xLimit * 0.45 ? -1 : world.position.x < -xLimit * 0.45 ? 1 : Math.random() < 0.5 ? -1 : 1;
      props.ball.position.set(THREE.MathUtils.clamp(world.position.x + ballDirection * 1.35, -xLimit + 0.3, xLimit - 0.3),
        0, THREE.MathUtils.clamp(world.position.z + random(-0.2, 0.2), -depthLimit + 0.15, depthLimit - 0.15));
      props.ballShadow.position.set(props.ball.position.x, 0.018, props.ball.position.z);
      props.ball.visible = true;
      props.ballShadow.visible = true;
      ballVelocityX = 0;
      ballVelocityZ = 0;
      expressions.setExpression('CURIOUS', { force: true });
      setPhase('DISCOVER', getReduced() ? 0.4 : 0.9);
      onMessage('CURIOUS');
    } else if (kind === 'HAPPY_DANCE') {
      expressions.setExpression('HAPPY', { force: true });
      setPhase('DANCE', getReduced() ? 0.8 : random(1.3, 2.4));
      onMessage('HAPPY');
    } else if (kind === 'BLANKET_NAP') {
      const { xLimit, depthLimit } = getLimits();
      napSide = world.position.x > 0 ? 1 : -1;
      napSpotX = THREE.MathUtils.clamp(world.position.x + random(-0.75, 0.75),
        -Math.max(0, xLimit - 1.15), Math.max(0, xLimit - 1.15));
      napSpotZ = THREE.MathUtils.clamp(world.position.z + random(-0.2, 0.2), -depthLimit, depthLimit);
      expressions.setExpression('SLEEPY', { force: true });
      setPhase('LOOK', getReduced() ? 0.35 : 0.8);
      onMessage('SLEEPY');
    }
    return true;
  }

  function maybeStart(energy) {
    if (active || cooldown > 0 || energy < 31) return false;
    const choice = Math.random();
    if (choice < 0.12) return start('READING');
    if (choice < 0.24) return start('BALL_PLAY');
    if (choice < 0.34) return start('HAPPY_DANCE');
    cooldown = random(6, 12);
    return false;
  }

  function rollBall(dt) {
    if (!ballVelocityX && !ballVelocityZ) return;
    const { xLimit, depthLimit } = getLimits();
    const ball = props.ball;
    ball.position.x += ballVelocityX * dt;
    ball.position.z += ballVelocityZ * dt;
    const edgeX = Math.max(0, xLimit - 0.27);
    const edgeZ = depthLimit - 0.26;
    if (Math.abs(ball.position.x) > edgeX) {
      ball.position.x = THREE.MathUtils.clamp(ball.position.x, -edgeX, edgeX);
      ballVelocityX *= -0.65;
    }
    if (Math.abs(ball.position.z) > edgeZ) {
      ball.position.z = THREE.MathUtils.clamp(ball.position.z, -edgeZ, edgeZ);
      ballVelocityZ *= -0.65;
    }
    const gap = ball.position.x - world.position.x;
    if (Math.abs(gap) < 0.52 && Math.abs(ball.position.z - world.position.z) < 0.4) {
      const away = gap >= 0 ? 1 : -1;
      ball.position.x = THREE.MathUtils.clamp(world.position.x + away * 0.52, -edgeX, edgeX);
      ballVelocityX = away * Math.max(0.5, Math.abs(ballVelocityX));
    }
    ball.rotation.z -= ballVelocityX * dt / 0.25;
    ball.rotation.x += ballVelocityZ * dt / 0.25;
    ballVelocityX *= Math.exp(-1.25 * dt);
    ballVelocityZ *= Math.exp(-1.25 * dt);
    if (Math.abs(ballVelocityX) < 0.04) ballVelocityX = 0;
    if (Math.abs(ballVelocityZ) < 0.04) ballVelocityZ = 0;
    props.ballShadow.position.x = ball.position.x;
    props.ballShadow.position.z = ball.position.z;
  }

  function kickBall() {
    ballKicks++;
    ballDirection = props.ball.position.x >= world.position.x ? 1 : -1;
    ballVelocityX = ballDirection * random(1.35, 1.8);
    ballVelocityZ = random(-0.2, 0.2);
    expressions.setExpression('HAPPY', { force: true });
    onMessage('PLAYING');
    setPhase('CHASE', getReduced() ? 1.5 : random(2.1, 3.1));
  }

  function wake() {
    if (active !== 'BLANKET_NAP' || phase !== 'SLEEP') return false;
    onSleepChange(false);
    onState('WAKING');
    expressions.setExpression('SLEEPY', { force: true });
    setPhase('WAKE', getReduced() ? 0.75 : 2.1);
    return true;
  }

  function update(dt) {
    cooldown = Math.max(0, cooldown - dt);
    if (!active) {
      pose.position.y = approach(pose.position.y, 0, dt, 8);
      pose.rotation.z = approach(pose.rotation.z, 0, dt, 8);
      pose.rotation.x = approach(pose.rotation.x, 0, dt, 8);
      restoreFlipperPosition(dt);
      return;
    }
    time += dt;
    const reduced = getReduced();
    if (active === 'HAPPY_DANCE') {
      const beat = reduced ? 0 : Math.sin(time * 15);
      setFlippers(-0.15 - beat * 0.18, 0.15 + beat * 0.18, dt);
      pose.rotation.z = approach(pose.rotation.z, reduced ? 0 : beat * 0.045, dt, 12);
      pose.position.y = approach(pose.position.y, reduced ? 0 : Math.max(0, beat) * 0.04, dt, 10);
      if (time >= duration) finish();
      return;
    }
    if (active === 'READING') {
      setFlippers(0.23, -0.23, dt);
      restoreFlipperPosition(dt);
      head.rotation.x = approach(head.rotation.x, 0.12, dt);
      head.rotation.z = approach(head.rotation.z, reduced ? 0 : Math.sin(time * 1.2) * 0.035, dt);
      const showing = phase !== 'OUTRO';
      props.spectacles.scale.setScalar(approach(props.spectacles.scale.x, showing ? 1 : 0.01, dt, 8));
      props.newspaper.scale.setScalar(approach(props.newspaper.scale.x, showing ? 1 : 0.01, dt, 7));
      props.page.rotation.y = approach(props.page.rotation.y,
        phase === 'READ' && !reduced ? -Math.max(0, 1 - Math.abs((time % 4) - 2) / 0.5) * 1.05 : 0, dt, 12);
      if (phase === 'INTRO' && time >= duration) {
        setPhase('READ', random(8, 15));
        expressions.clearExpression();
        onMessage('READING');
      } else if (phase === 'READ') {
        if (!surprise && time > duration * 0.62) {
          surprise = true;
          expressions.setExpression('CURIOUS', { force: true });
          onMessage('huh?!');
        }
        if (time >= duration) setPhase('OUTRO', reduced ? 0.3 : 1.1);
      } else if (phase === 'OUTRO' && time >= duration) finish();
      return;
    }
    if (active === 'BALL_PLAY') {
      rollBall(dt);
      const ball = props.ball;
      const shown = phase !== 'OUTRO';
      ball.scale.setScalar(approach(ball.scale.x, shown ? 1 : 0.01, dt, 9));
      props.ballShadow.scale.setScalar(ball.scale.x);
      if (phase === 'DISCOVER') {
        setFlippers(-0.14, 0.08, dt);
        head.rotation.z = approach(head.rotation.z, ballDirection * 0.08, dt);
        if (time >= duration) setPhase('APPROACH', 3);
      } else if (phase === 'APPROACH') {
        setFlippers(ballDirection > 0 ? 0.05 : 0.25, ballDirection > 0 ? -0.25 : -0.05, dt);
        const reached = move(ball.position.x - ballDirection * 0.55, ball.position.z, dt, false, 0.92);
        if (reached || time >= duration) kickBall();
      } else if (phase === 'CHASE') {
        const balance = reduced ? 0 : Math.sin(time * 15) * 0.045;
        setFlippers(-0.22 + balance, 0.22 - balance, dt);
        const side = ball.position.x >= world.position.x ? 1 : -1;
        const reached = move(ball.position.x - side * 0.55, ball.position.z, dt, true, reduced ? 0.85 : 1.9);
        if ((reached && time > 0.8) || time >= duration) {
          if (ballKicks < 2 && !reduced && Math.random() < 0.55) kickBall();
          else { setPhase('REST', 1.3); onMessage('phew!'); }
        }
      } else if (phase === 'REST') {
        setFlippers(0, 0, dt);
        ballVelocityX *= Math.exp(-5 * dt);
        ballVelocityZ *= Math.exp(-5 * dt);
        pose.position.y = approach(pose.position.y, -0.07, dt);
        if (time >= duration) setPhase('OUTRO', reduced ? 0.25 : 0.8);
      } else if (phase === 'OUTRO' && time >= duration) finish();
      return;
    }
    if (active !== 'BLANKET_NAP') return;
    if (phase === 'LOOK') {
      setFlippers(-0.05, 0.05, dt);
      head.rotation.y = approach(head.rotation.y, reduced ? 0 : Math.sin(time * 5) * 0.11, dt);
      if (time >= duration) setPhase('RUB', reduced ? 0.25 : 0.75);
    } else if (phase === 'RUB') {
      flippers[0].position.x = approach(flippers[0].position.x, -0.67, dt, 10);
      flippers[0].position.y = approach(flippers[0].position.y, 2.38 + (reduced ? 0 : Math.sin(time * 18) * 0.045), dt, 10);
      setFlippers(0.25, 0.08, dt);
      if (time >= duration) {
        restoreFlipperPosition(dt);
        expressions.setExpression('YAWNING', { force: true });
        onMessage('yawnnn~');
        setPhase('YAWN', reduced ? 0.5 : 1.5);
      }
    } else if (phase === 'YAWN') {
      restoreFlipperPosition(dt);
      setFlippers(-0.3, 0.3, dt);
      if (time >= duration) {
        expressions.setExpression('SLEEPY', { force: true });
        props.blanket.visible = true;
        props.blanket.position.set(-0.9, 0.58, 0.78);
        props.blanket.scale.set(0.01, 0.01, 1);
        setPhase('WALK', 3.5);
      }
    } else if (phase === 'WALK') {
      restoreFlipperPosition(dt);
      setFlippers(-0.12, 0.12, dt);
      props.blanket.scale.x = approach(props.blanket.scale.x, 0.45, dt, 5);
      props.blanket.scale.y = approach(props.blanket.scale.y, 0.55, dt, 5);
      const reached = move(napSpotX, napSpotZ, dt, false, reduced ? 0.65 : 0.72);
      if (reached || time >= duration) setPhase('LOWER', reduced ? 0.4 : 1.8);
    } else if (phase === 'LOWER') {
      setFlippers(-0.07, 0.07, dt);
      pose.rotation.z = approach(pose.rotation.z, napSide * (reduced ? 0.42 : 0.72), dt, reduced ? 7 : 2.8);
      pose.position.y = approach(pose.position.y, reduced ? 0.26 : 0.55, dt, reduced ? 7 : 2.8);
      pose.rotation.x = approach(pose.rotation.x, reduced ? 0 : 0.12, dt, 3);
      props.blanket.position.x = approach(props.blanket.position.x, 0, dt, 3);
      props.blanket.position.y = approach(props.blanket.position.y, 0.95, dt, 3);
      props.blanket.position.z = approach(props.blanket.position.z, 1.02, dt, 3);
      props.blanket.scale.x = approach(props.blanket.scale.x, 1, dt, 3);
      props.blanket.scale.y = approach(props.blanket.scale.y, 1, dt, 3);
      if (time >= duration) {
        onSleepChange(true);
        onState('SLEEPING');
        expressions.setExpression('SLEEPING', { force: true });
        setPhase('SLEEP', random(15, 30));
        onMessage('SLEEPY');
      }
    } else if (phase === 'SLEEP') {
      pose.rotation.z = napSide * (reduced ? 0.42 : 0.72) + (reduced ? 0 : Math.sin(time * 0.9) * 0.012);
      if (time >= duration) wake();
    } else if (phase === 'WAKE') {
      if (!surprise && time > 0.45) {
        surprise = true;
        expressions.wakeBlink();
        onMessage(Math.random() < 0.5 ? 'yayyy!!' : 'good morninggg~');
      }
      props.blanket.scale.x = approach(props.blanket.scale.x, 0.01, dt, 3.5);
      props.blanket.scale.y = approach(props.blanket.scale.y, 0.01, dt, 3.5);
      props.blanket.position.x = approach(props.blanket.position.x, -1.05, dt, 3);
      pose.rotation.z = approach(pose.rotation.z, 0, dt, 3);
      pose.rotation.x = approach(pose.rotation.x, 0, dt, 3);
      pose.position.y = approach(pose.position.y, 0, dt, 3);
      setFlippers(-0.29, 0.29, dt);
      if (time > duration * 0.62) expressions.setExpression('HAPPY', { force: true });
      if (time >= duration) finish();
    }
  }

  return {
    start, maybeStart, update, interrupt, wake,
    get active() { return active; },
    get phase() { return phase; },
    resize() {
      const { xLimit, depthLimit } = getLimits();
      napSpotX = THREE.MathUtils.clamp(napSpotX, -Math.max(0, xLimit - 1.15), Math.max(0, xLimit - 1.15));
      napSpotZ = THREE.MathUtils.clamp(napSpotZ, -depthLimit, depthLimit);
      if (props.ball.visible) {
        props.ball.position.x = THREE.MathUtils.clamp(props.ball.position.x, -Math.max(0, xLimit - 0.27), Math.max(0, xLimit - 0.27));
        props.ball.position.z = THREE.MathUtils.clamp(props.ball.position.z, -depthLimit + 0.26, depthLimit - 0.26);
        props.ballShadow.position.x = props.ball.position.x;
        props.ballShadow.position.z = props.ball.position.z;
      }
    },
    dispose() {
      interrupt();
      pose.position.set(0, 0, 0);
      pose.rotation.set(0, 0, 0);
      flippers.forEach((flipper, index) => flipper.position.copy(flipperRest[index]));
      props.dispose();
    }
  };
}
