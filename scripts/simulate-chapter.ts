import { createRequire } from 'node:module';
import { GameController } from '../src/core/GameController';
import { ShotQueue } from '../src/core/ShotQueue';
import { MergeCharge } from '../src/core/MergeCharge';
import balls from '../src/config/ballLevels.json';
import levels from '../src/config/levelConfig.json';
import config from '../src/config/gameConfig.json';
import type { BoardObstacle } from '../src/types';

const require = createRequire(import.meta.url);
const Engine = require('phaser/src/physics/matter-js/lib/core/Engine') as typeof MatterJS.Engine;
const Bodies = require('phaser/src/physics/matter-js/lib/factory/Bodies') as typeof MatterJS.Bodies;
const Body = require('phaser/src/physics/matter-js/lib/body/Body') as typeof MatterJS.Body;
const Composite = require('phaser/src/physics/matter-js/lib/body/Composite') as typeof MatterJS.Composite;
const Sleeping = require('phaser/src/physics/matter-js/lib/core/Sleeping') as typeof MatterJS.Sleeping;
const Events = require('phaser/src/physics/matter-js/lib/core/Events') as { on: (engine: MatterJS.Engine, name: string, callback: (event: { pairs: { bodyA: MatterJS.BodyType; bodyB: MatterJS.BodyType }[] }) => void) => void };

export function simulateStage(stage: number, angles: number[], rescue = false) {
  const level = levels[stage - 1];
  const controller = new GameController(balls, levels, config);
  for (let i = 1; i < stage; i++) controller.advanceLevel();
  const queue = new ShotQueue(1, 9, Math.random, level.shotSequence);
  const engine = Engine.create({ enableSleeping: true }) as MatterJS.Engine & { world: MatterJS.CompositeType; gravity: { y: number } };
  engine.gravity.y = config.physics.gravity;
  const active = new Map<MatterJS.BodyType, number>();
  const charge = new MergeCharge();
  let shakes = level.shakes;
  let pending: [MatterJS.BodyType, MatterJS.BodyType][] = [];
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
  let settledSince: number | null = null;
  let lastShot = 0;
  for (let frame = 0; frame < 2100; frame++) {
    if (frame >= 90 && (frame - 90) % 90 === 0 && shots < angles.length && controller.getGameState().shotsRemaining > 0) {
      const angle = angles[shots];
      const body = spawn(360, 270, queue.take());
      Body.setVelocity(body, { x: Math.cos(angle) * 12, y: Math.sin(angle) * 12 });
      controller.useShot();
      lastShot = frame;
      shots++;
    }
    if (rescue && shakes > 0 && frame === 90 + angles.length * 90 + rescues * 150) {
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
    const merges = pending;
    pending = [];
    for (let i = 0; i < merges.length; i++) {
      const [a, b] = merges[i];
      if (!active.has(a) || !active.has(b)) continue;
      const result = controller.processMerge(active.get(a)!, frame * 1000 / 60);
      if (charge.add(controller.getGameState().combo)) shakes++;
      const x = (a.position.x + b.position.x) / 2;
      const y = (a.position.y + b.position.y) / 2;
      active.delete(a); active.delete(b);
      Composite.remove(engine.world, a);
      Composite.remove(engine.world, b);
      spawn(x, y, result.newLevel);
      settledSince = null;
    }
    if (controller.checkLevelComplete() === 'win') return { won: true, shots, rescues, seconds: frame / 60, merges: controller.getRunSummary().merges, autoWin: shots === 0 && rescues === 0 };
    // 与实际结算一致，最后一球停止后只保留有限救场时间。
    if (controller.getGameState().shotsRemaining === 0) {
      const moving = [...active.keys()].some(b => !b.isSleeping && Math.hypot(b.velocity.x, b.velocity.y) > 0.3);
      if (moving || frame - lastShot < 60) settledSince = null;
      else if (settledSince === null) settledSince = frame;
      if (settledSince !== null && frame - settledSince >= (shakes > 0 ? 150 : 42)) break;
    }
  }
  return { won: false, shots, rescues, seconds: 35, merges: controller.getRunSummary().merges, autoWin: false };
}

if (process.env.RUN_CHAPTER === '1') {
  for (let stage = 1; stage <= 8; stage++) {
    let best: { angles: number[]; result: ReturnType<typeof simulateStage> } | undefined;
    let wins = 0;
    const centered = simulateStage(stage, Array(levels[stage - 1].shots).fill(Math.PI / 2));
    for (let seed = 1; seed <= 60; seed++) {
      let value = (seed * 2654435761) >>> 0;
      const angles = Array.from({ length: levels[stage - 1].shots }, () => { value = (value * 1664525 + 1013904223) >>> 0; return 0.35 + value / 4294967296 * 2.44; });
      const result = simulateStage(stage, angles, true);
      if (result.won) {
        wins++;
        if (!best || result.shots + result.rescues < best.result.shots + best.result.rescues) best = { angles, result };
      }
    }
    console.log(JSON.stringify({ stage, centered, randomWins: wins, runs: 60, best }));
  }
}
