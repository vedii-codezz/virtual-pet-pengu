import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createPenguin } from '../src/pet/penguin.js';
import { createExpressions } from '../src/pet/expressions.js';
import { createRoaming } from '../src/pet/roaming.js';
import { enablePetting } from '../src/pet/interactions.js';

test('tap destinations, movement priority, and circular starts', () => {
  const originalRandom = Math.random;
  const originalWindow = globalThis.window;
  const originalDocument = globalThis.document;
  Math.random = () => 0.15; // Select circular roaming after a tap finishes.
  globalThis.window = { matchMedia: () => ({ matches: false, addEventListener() {}, removeEventListener() {} }) };
  globalThis.document = { createElement: () => ({
    width: 64, height: 64,
    getContext: () => ({ fillRect() {}, fillText() {}, beginPath() {}, moveTo() {}, bezierCurveTo() {}, fill() {},
      createRadialGradient: () => ({ addColorStop() {} }) })
  }) };

  let roaming;
  let expressions;
  let stopPetting;
  try {
    const camera = new THREE.PerspectiveCamera(45, 800 / 600, 0.1, 100);
    camera.position.set(0, 12, 22.5);
    camera.lookAt(0, 8.5, 0);
    const listeners = {};
    const viewport = { width: 800, height: 600 };
    const canvas = { style: {},
      getBoundingClientRect: () => ({ left: 0, top: 0, ...viewport }),
      addEventListener(name, handler) { listeners[name] = handler; },
      removeEventListener(name) { delete listeners[name]; }
    };
    const penguin = createPenguin();
    expressions = createExpressions(penguin);
    roaming = createRoaming(penguin, camera, canvas, {
      onMessage() {}, onSleepChange() {}, expressions
    });
    const tick = (count) => { for (let i = 0; i < count; i++) roaming.update(1 / 60); };

    const model = new THREE.Box3().setFromObject(penguin);
    assert(model.max.y < 3.5 && model.max.y > 3.1);

    const nearby = new THREE.Vector3(0, 1.8, 0);
    penguin.localToWorld(nearby);
    nearby.project(camera);
    roaming.trackPointer({ pointerType: 'mouse', clientX: (nearby.x + 1) * 400 + 100,
      clientY: (1 - nearby.y) * 300 });
    tick(50);
    assert.equal(roaming.state, 'FOLLOWING', 'nearby cursor can start following');

    roaming.noticeTap(80, 550);
    assert.equal(roaming.state, 'RUNNING_TO_TAP');
    assert.equal(expressions.getCurrentExpression(), 'CURIOUS', 'tap run overrides following');
    tick(60);
    assert(roaming.world.position.x < -0.1, 'lower-left tap moves left');
    const leftX = roaming.world.position.x;

    const projected = new THREE.Vector3(0, 1.8, 0);
    penguin.localToWorld(projected);
    projected.project(camera);
    roaming.trackPointer({ pointerType: 'mouse', clientX: (projected.x + 1) * 400,
      clientY: (1 - projected.y) * 300 });
    tick(1);
    assert.equal(roaming.state, 'RUNNING_TO_TAP', 'cursor proximity does not interrupt a tap run');

    roaming.noticeTap(720, 550);
    tick(100);
    assert(roaming.world.position.x > leftX + 0.4, 'new tap smoothly replaces the run destination');

    roaming.noticeTap(400, 100);
    assert.equal(roaming.state, 'CURIOUS');
    const before = roaming.world.position.clone();
    tick(30);
    assert(before.distanceTo(roaming.world.position) < 1e-6, 'upper tap only draws attention');

    roaming.clearPointer();
    roaming.noticeTap(40, 550);
    for (let i = 0; i < 500 && roaming.state !== 'IDLE'; i++) roaming.update(1 / 60);
    assert.equal(roaming.state, 'IDLE', 'tap run arrives');
    for (let i = 0; i < 150 && roaming.state !== 'CIRCULAR_WADDLE'; i++) roaming.update(1 / 60);
    assert.equal(roaming.state, 'CIRCULAR_WADDLE');
    const circleStart = roaming.world.position.clone();
    roaming.update(1 / 60);
    assert(circleStart.distanceTo(roaming.world.position) < 0.08, 'circle starts without a jump');
    roaming.trackPointer({ pointerType: 'mouse', clientX: 400, clientY: 500 });
    tick(10);
    assert.equal(roaming.state, 'CIRCULAR_WADDLE', 'cursor proximity does not interrupt a circle');

    roaming.clearPointer();
    Math.random = () => 0.05; // Select a short scurry next.
    for (let i = 0; i < 400 && roaming.state !== 'PLAYFUL_SCURRY'; i++) roaming.update(1 / 60);
    assert.equal(roaming.state, 'PLAYFUL_SCURRY');
    const scurryPoint = new THREE.Vector3(0, 1.8, 0);
    penguin.localToWorld(scurryPoint);
    scurryPoint.project(camera);
    roaming.trackPointer({ pointerType: 'mouse', clientX: (scurryPoint.x + 1) * 400,
      clientY: (1 - scurryPoint.y) * 300 });
    tick(1);
    assert.equal(roaming.state, 'PLAYFUL_SCURRY', 'cursor proximity does not interrupt a scurry');

    roaming.setReducedMotion(true);
    assert.equal(roaming.state, 'IDLE');
    roaming.noticeTap(720, 550);
    tick(5);
    const walk = roaming.world.getObjectByName('walk');
    assert.equal(walk.rotation.z, 0, 'reduced motion suppresses running wobble');
    assert.equal(penguin.getObjectByName('leftFoot').position.y, 0);
    for (let i = 0; i < 4200 && roaming.state !== 'SLEEPING'; i++) roaming.update(0.05);
    assert.equal(roaming.state, 'SLEEPING');
    assert.equal(roaming.activity, 'BLANKET_NAP');
    assert.equal(penguin.getObjectByName('blanket').visible, true);
    roaming.noticeTap(200, 550);
    assert.equal(roaming.state, 'SLEEPING', 'empty tap does not wake Pengu');
    roaming.clearPointer();
    roaming.wakeFromTap();
    assert.equal(roaming.state, 'WAKING', 'direct wake begins the standing sequence');
    tick(60);
    assert.equal(roaming.state, 'IDLE', 'Pengu completes the standing sequence');
    assert.equal(penguin.getObjectByName('blanket').visible, false);

    viewport.width = 390;
    viewport.height = 844;
    camera.aspect = viewport.width / viewport.height;
    camera.updateProjectionMatrix();
    roaming.resize();
    roaming.noticeTap(380, 800);
    tick(120);
    const mobileBounds = new THREE.Box3().setFromObject(roaming.world);
    for (const x of [mobileBounds.min.x, mobileBounds.max.x]) {
      for (const y of [mobileBounds.min.y, mobileBounds.max.y]) {
        for (const z of [mobileBounds.min.z, mobileBounds.max.z]) {
          const projectedCorner = new THREE.Vector3(x, y, z).project(camera);
          assert(Math.abs(projectedCorner.x) <= 1.01, 'Pengu stays within mobile horizontal bounds');
          assert(Math.abs(projectedCorner.y) <= 1.01, 'Pengu stays within mobile vertical bounds');
        }
      }
    }
    viewport.width = 800;
    viewport.height = 600;
    camera.aspect = viewport.width / viewport.height;
    camera.updateProjectionMatrix();
    roaming.resize();

    let pets = 0;
    let emptyTaps = 0;
    stopPetting = enablePetting(penguin, camera, { domElement: canvas }, {
      onActiveChange: (active) => roaming.setShy(active),
      onPet: () => { pets++; },
      onEmptyTap: () => { emptyTaps++; }
    });
    roaming.world.updateMatrixWorld(true);
    const petPoint = new THREE.Vector3(0, 1.3, 0.65);
    penguin.localToWorld(petPoint);
    petPoint.project(camera);
    listeners.pointerdown({ clientX: (petPoint.x + 1) * 400, clientY: (1 - petPoint.y) * 300 });
    assert.equal(pets, 1, 'direct pet triggers the affectionate reaction');
    assert.equal(emptyTaps, 0, 'direct pet does not trigger empty-screen curiosity');
    assert.equal(roaming.state, 'SHY');

    stopPetting();
    stopPetting = undefined;
    roaming.dispose();
    roaming = undefined;
    expressions.dispose();
    expressions = undefined;

    for (const [randomValue, kind] of [[0.05, 'READING'], [0.18, 'BALL_PLAY']]) {
      Math.random = () => randomValue;
      const activityPenguin = createPenguin();
      const activityExpressions = createExpressions(activityPenguin);
      const activityRoaming = createRoaming(activityPenguin, camera, canvas, {
        onMessage() {}, onSleepChange() {}, expressions: activityExpressions
      });
      try {
        for (let i = 0; i < 2700 && activityRoaming.activity !== kind; i++) activityRoaming.update(1 / 60);
        assert.equal(activityRoaming.activity, kind, `${kind} starts autonomously`);
        if (kind === 'READING') {
          assert.equal(activityPenguin.getObjectByName('spectacles').visible, true);
          assert.equal(activityPenguin.getObjectByName('newspaper').visible, true);
          for (let i = 0; i < 1200 && activityRoaming.activity; i++) activityRoaming.update(1 / 60);
          assert.equal(activityRoaming.activity, null, 'reading finishes naturally');
          assert.equal(activityPenguin.getObjectByName('newspaper').visible, false);
          assert.equal(activityPenguin.getObjectByName('spectacles').visible, false);
          for (let i = 0; i < 2500 && activityRoaming.activity !== 'READING'; i++) activityRoaming.update(1 / 60);
          assert.equal(activityRoaming.activity, 'READING');
          activityRoaming.noticeTap(80, 550);
          assert.equal(activityRoaming.state, 'RUNNING_TO_TAP');
          assert.equal(activityPenguin.getObjectByName('newspaper').visible, false,
            'tap running cleans up the reading props');
        } else {
          const ball = activityRoaming.stage.getObjectByName('toyBall');
          assert.equal(ball.visible, true);
          const firstX = ball.position.x;
          for (let i = 0; i < 220; i++) activityRoaming.update(1 / 60);
          assert(ball.position.x !== firstX || ball.rotation.z !== 0, 'ball rolls during play');
          for (let i = 0; i < 1200 && activityRoaming.activity; i++) activityRoaming.update(1 / 60);
          assert.equal(activityRoaming.activity, null, 'ball play finishes naturally');
          assert.equal(ball.visible, false, 'ball is stored after play');
          for (let i = 0; i < 2600 && activityRoaming.activity !== 'BALL_PLAY'; i++) activityRoaming.update(1 / 60);
          assert.equal(activityRoaming.activity, 'BALL_PLAY');
          activityRoaming.setShy(true);
          assert.equal(ball.visible, false, 'petting cleans up the ball');
        }
      } finally {
        activityRoaming.dispose();
        activityExpressions.dispose();
      }
    }

    Math.random = () => 0.95;
    const plainPenguin = createPenguin();
    const plainExpressions = createExpressions(plainPenguin);
    const plainRoaming = createRoaming(plainPenguin, camera, canvas, {
      onMessage() {}, onSleepChange() {}, expressions: plainExpressions
    });
    try {
      plainRoaming.setReducedMotion(true);
      for (let i = 0; i < 4200 && plainRoaming.state !== 'SLEEPING'; i++) plainRoaming.update(0.05);
      assert.equal(plainRoaming.state, 'SLEEPING', 'original autonomous sleep remains available');
      assert.equal(plainRoaming.activity, null);
      plainRoaming.wakeFromTap();
      assert.equal(plainRoaming.state, 'IDLE');
    } finally {
      plainRoaming.dispose();
      plainExpressions.dispose();
    }
  } finally {
    stopPetting?.();
    roaming?.dispose();
    expressions?.dispose();
    Math.random = originalRandom;
    globalThis.window = originalWindow;
    globalThis.document = originalDocument;
  }
});
