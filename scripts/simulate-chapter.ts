import { createRequire } from 'node:module';
import { GameController } from '../src/core/GameController';
import { ShotQueue } from '../src/core/ShotQueue';
import { battlePlanEffects, battlePlans } from '../src/core/BattlePlan';
import { MergeCharge } from '../src/core/MergeCharge';
import balls from '../src/config/ballLevels.json';
import classicLevels from '../src/config/levelConfig.json';
import shadowLevels from '../src/config/afterimageLevels.json';
import shadowConfig from '../src/config/afterimageConfig.json';
import { AfterimageSystem } from '../src/core/AfterimageSystem';
import config from '../src/config/gameConfig.json';
import type { BoardObstacle } from '../src/types';

const require = createRequire(import.meta.url);
const Engine = require('phaser/src/physics/matter-js/lib/core/Engine') as typeof MatterJS.Engine;
const Bodies = require('phaser/src/physics/matter-js/lib/factory/Bodies') as typeof MatterJS.Bodies;
const Body = require('phaser/src/physics/matter-js/lib/body/Body') as typeof MatterJS.Body;
const Composite = require('phaser/src/physics/matter-js/lib/body/Composite') as typeof MatterJS.Composite;
const Sleeping = require('phaser/src/physics/matter-js/lib/core/Sleeping') as typeof MatterJS.Sleeping;
const Events = require('phaser/src/physics/matter-js/lib/core/Events') as { on: (engine: MatterJS.Engine, name: string, callback: (event: { pairs: { bodyA: MatterJS.BodyType; bodyB: MatterJS.BodyType }[] }) => void) => void };

export interface PlayActions {
  swaps?: number[];
  pickSlots?: number[];
  rescueAfterShots?: number[];
}

export function simulateStage(stage: number, angles: number[], rescue = false, afterimage = false, planId = '', actions: PlayActions = {}) {
  const levels = afterimage ? shadowLevels : classicLevels;
  const level = levels[stage - 1];
  const controller = new GameController(balls, levels, config);
  for (let i = 1; i < stage; i++) {
    if (i === stage - 1) {
      const plan = battlePlans().find(card => card.id === planId);
      if (plan) controller.applyUpgrade(plan);
    }
    controller.advanceLevel();
  }
  const effects = battlePlanEffects(controller.getGameState().activePlan, level);
  const queue = new ShotQueue(1, 9, Math.random, level.shotSequence);
  const engine = Engine.create({ enableSleeping: true }) as MatterJS.Engine & { world: MatterJS.CompositeType; gravity: { y: number } };
  engine.gravity.y = config.physics.gravity;
  const active = new Map<MatterJS.BodyType, number>();
  const charge = new MergeCharge(effects.chargeThreshold, effects.chargeLimit);
  let shakes = level.shakes + effects.shakes;
  let pending: [MatterJS.BodyType, MatterJS.BodyType][] = [];
  let shadowMerges = 0;
  let now = 0;
  let lastMergeCheck = 0;
  const recordings = new Map<MatterJS.BodyType, { id: number; started: number }>();
  const paths = new Map<number, MatterJS.BodyType[]>();
  function removePath(id: number) {
    const bodies = paths.get(id) ?? [];
    for (let i = 0; i < bodies.length; i++) Composite.remove(engine.world, bodies[i]);
    paths.delete(id);
  }
  const shadows = new AfterimageSystem(shadowConfig, {
    onFade: removePath,
    onMerge: (a, b, level, _x, _y, id) => {
      removePath(a);
      removePath(b);
      createPath(id);
      shadowMerges++;
      controller.processMerge(level - 1, now);
      if (charge.add(controller.getGameState().combo)) {
        shakes++;
        if (effects.refundSwapOnCharge && charge.rewards === 1) swaps++;
      }
    }
  });
  function createPath(id: number) {
    const track = shadows.getTrack(id)!;
    const nodes = track.segments;
    const bodies: MatterJS.BodyType[] = [];
    const options = { isStatic: true, restitution: 0.6, collisionFilter: { group: -id, category: 1, mask: 0xffffffff } };
    for (let i = 0; i < nodes.length - 1; i++) {
      const a = nodes[i];
      const b = nodes[i + 1];
      bodies.push(Bodies.rectangle((a.x + b.x) / 2, (a.y + b.y) / 2, Math.hypot(b.x - a.x, b.y - a.y), shadowConfig.segmentThickness,
        { ...options, angle: Math.atan2(b.y - a.y, b.x - a.x) }));
    }
    if (nodes.length === 1) bodies.push(Bodies.circle(nodes[0].x, nodes[0].y, 18, options));
    for (let i = 0; i < bodies.length; i++) Composite.add(engine.world, bodies[i]);
    paths.set(id, bodies);
  }
  function finalize(body: MatterJS.BodyType) {
    const recording = recordings.get(body);
    if (!recording) return;
    if (shadows.finalizeTrack(recording.id)) createPath(recording.id);
    recordings.delete(body);
  }
  const obstacles = level.obstacles as BoardObstacle[];
  const staticBodies = [
    Bodies.rectangle(50, 640, 10, 1280, { isStatic: true, restitution: 0.8 }),
    Bodies.rectangle(670, 640, 10, 1280, { isStatic: true, restitution: 0.8 }),
    Bodies.rectangle(360, 1110, 720, 20, { isStatic: true, restitution: 0.3 }),
    ...obstacles.map(o => o.radius ? Bodies.circle(o.x, o.y, o.radius, { isStatic: true, restitution: 0.65 }) : Bodies.rectangle(o.x, o.y, o.width!, o.height!, { isStatic: true, angle: o.angle ?? 0, restitution: 0.2, friction: 0.005 }))
  ];
  for (let i = 0; i < staticBodies.length; i++) Composite.add(engine.world, staticBodies[i]);
  function spawn(x: number, y: number, level: number) {
    const body = Bodies.circle(x, y, balls[level - 1].radius, { restitution: config.physics.restitution, friction: config.physics.friction, frictionAir: config.physics.frictionAir, density: config.physics.density });
    active.set(body, level);
    Composite.add(engine.world, body);
    return body;
  }
  for (let i = 0; i < level.presetBalls.length; i++) {
    const seed = level.presetBalls[i];
    spawn(seed.x, seed.y, seed.level);
  }
  Events.on(engine, 'collisionStart', event => {
    for (let i = 0; i < event.pairs.length; i++) {
      const { bodyA, bodyB } = event.pairs[i];
      if (active.has(bodyA) && active.has(bodyB) && controller.canMerge(active.get(bodyA)!, active.get(bodyB)!)) pending.push([bodyA, bodyB]);
    }
  });
  let shots = 0;
  let rescues = 0;
  let lateRescues = 0;
  let swaps = level.swaps + effects.swaps;
  let swapsUsed = 0;
  let settledSince: number | null = null;
  let lastShot = 0;
  for (let frame = 0; frame < 2100; frame++) {
    now = frame * 1000 / 60;
    if (frame >= 90 && (frame - 90) % 90 === 0 && shots < angles.length && controller.getGameState().shotsRemaining > 0) {
      const slot = actions.pickSlots?.[shots] ?? 0;
      const selectable = slot === 1 || (slot === 2 && effects.rotateQueue);
      if (selectable && swaps > 0 && queue.at(0) !== queue.at(slot)) {
        queue.swap(slot);
        swaps--;
        swapsUsed++;
      }
      const turns = actions.swaps?.[shots] ?? 0;
      for (let turn = 0; turn < turns && swaps > 0; turn++) {
        const samePair = queue.at(0) === queue.at(1);
        if (samePair && (!effects.rotateQueue || queue.at(0) === queue.at(2))) break;
        if (effects.rotateQueue) queue.rotate();
        else queue.swap();
        swaps--;
        swapsUsed++;
      }
      const angle = angles[shots];
      const body = spawn(360, 270, queue.take());
      Body.setVelocity(body, { x: Math.cos(angle) * 12, y: Math.sin(angle) * 12 });
      if (afterimage) {
        shadows.advanceShot();
        const id = shadows.startTracking(active.get(body)!);
        body.collisionFilter.group = -id;
        recordings.set(body, { id, started: now });
      }
      controller.useShot();
      lastShot = frame;
      shots++;
    }
    const midRescue = frame === 90 + (shots - 1) * 90 + 45 && (actions.rescueAfterShots ?? []).includes(shots);
    const finalRescue = rescue && frame === 90 + angles.length * 90 + lateRescues * 150;
    if (shakes > 0 && (midRescue || finalRescue)) {
      if (finalRescue) lateRescues++;
      if (afterimage) shadows.clearSettledTracks(effects.preserveCores);
      const bodies = [...active.keys()];
      for (let i = 0; i < bodies.length; i++) {
        Sleeping.set(bodies[i], false);
        Body.setVelocity(bodies[i], { x: (360 - bodies[i].position.x) * 0.025, y: -7 });
      }
      shakes--;
      rescues++;
      lastShot = frame;
      settledSince = null;
    }
    Engine.update(engine, 1000 / 60);
    if (afterimage) {
      const records = Array.from(recordings.entries());
      for (let i = 0; i < records.length; i++) {
        const [body, record] = records[i];
        const { x, y } = body.position;
        if (y >= 520 && y <= 1000) shadows.addSegment(record.id, x, y, now);
        if (body.isSleeping || Math.hypot(body.velocity.x, body.velocity.y) <= 0.5 || now - record.started >= 1500) finalize(body);
      }
      if (now - lastMergeCheck > shadowConfig.mergeCheckInterval) {
        lastMergeCheck = now;
        const matches = shadows.checkMerges();
        for (let i = 0; i < matches.length; i++) {
          const m = matches[i];
          shadows.processMerge(m.track1Id, m.track2Id, m.newLevel, m.x, m.y);
        }
      }
    }
    const merges = pending;
    pending = [];
    for (let i = 0; i < merges.length; i++) {
      const [a, b] = merges[i];
      if (!active.has(a) || !active.has(b)) continue;
      const result = controller.processMerge(active.get(a)!, frame * 1000 / 60);
      if (charge.add(controller.getGameState().combo)) {
        shakes++;
        if (effects.refundSwapOnCharge && charge.rewards === 1) swaps++;
      }
      const x = (a.position.x + b.position.x) / 2;
      const y = (a.position.y + b.position.y) / 2;
      finalize(a);
      finalize(b);
      active.delete(a); active.delete(b);
      Composite.remove(engine.world, a);
      Composite.remove(engine.world, b);
      spawn(x, y, result.newLevel);
      settledSince = null;
    }
    const shadowGoal = !afterimage || shadowMerges >= shadowLevels[stage - 1].requiredAfterimageMerges;
    if (controller.checkLevelComplete() === 'win' && shadowGoal) return { won: true, shots, rescues, swapsUsed, shadowMerges, seconds: frame / 60, merges: controller.getRunSummary().merges, autoWin: shots === 0 && rescues === 0 };
    // 与实际结算一致，最后一球停止后只保留有限救场时间。
    if (controller.getGameState().shotsRemaining === 0) {
      const moving = [...active.keys()].some(b => !b.isSleeping && Math.hypot(b.velocity.x, b.velocity.y) > 0.3);
      if (moving || frame - lastShot < (afterimage ? 114 : 60)) settledSince = null;
      else if (settledSince === null) settledSince = frame;
      if (settledSince !== null && frame - settledSince >= (shakes > 0 ? 150 : 42)) break;
    }
  }
  return { won: false, shots, rescues, swapsUsed, shadowMerges, seconds: 35, merges: controller.getRunSummary().merges, autoWin: false };
}

if (process.env.RUN_CHAPTER === '1') {
  const afterimage = process.env.AFTERIMAGE === '1';
  const planId = process.env.PLAN ?? '';
  const plan = battlePlans().find(card => card.id === planId);
  const levels = afterimage ? shadowLevels : classicLevels;
  for (let stage = 1; stage <= levels.length; stage++) {
    let best: { angles: number[]; result: ReturnType<typeof simulateStage> } | undefined;
    let wins = 0;
    const shotCount = levels[stage - 1].shots + battlePlanEffects(stage > 1 ? plan : undefined, levels[stage - 1]).shots;
    const centered = simulateStage(stage, Array(shotCount).fill(Math.PI / 2), false, afterimage, planId);
    for (let seed = 1; seed <= 60; seed++) {
      let value = (seed * 2654435761) >>> 0;
      const angles = Array.from({ length: shotCount }, () => { value = (value * 1664525 + 1013904223) >>> 0; return 0.35 + value / 4294967296 * 2.44; });
      const result = simulateStage(stage, angles, true, afterimage, planId);
      if (result.won) {
        wins++;
        if (!best || result.shots + result.rescues < best.result.shots + best.result.rescues) best = { angles, result };
      }
    }
    console.log(JSON.stringify({ stage, centered, randomWins: wins, runs: 60, best }));
  }
}
