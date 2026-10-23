import { createRequire } from 'node:module';
import { GameController } from '../src/core/GameController';
import { ShotQueue } from '../src/core/ShotQueue';
import balls from '../src/config/ballLevels.json';
import levels from '../src/config/levelConfig.json';
import config from '../src/config/gameConfig.json';

const require = createRequire(import.meta.url);
const Engine = require('phaser/src/physics/matter-js/lib/core/Engine') as typeof MatterJS.Engine;
const Bodies = require('phaser/src/physics/matter-js/lib/factory/Bodies') as typeof MatterJS.Bodies;
const Body = require('phaser/src/physics/matter-js/lib/body/Body') as typeof MatterJS.Body;
const Composite = require('phaser/src/physics/matter-js/lib/body/Composite') as typeof MatterJS.Composite;
const Events = require('phaser/src/physics/matter-js/lib/core/Events') as typeof MatterJS.Events;

function simulate(seed: number, level: number) {
  let randomState = seed;
  const random = () => {
    randomState = (randomState * 1664525 + 1013904223) >>> 0;
    return randomState / 4294967296;
  };
  const controller = new GameController(balls, levels, config);
  for (let i = 1; i < level; i++) controller.advanceLevel();
  const target = controller.getLevelConfig().targetBallLevel!;
  const queue = new ShotQueue(Math.max(1, target - 4), target - 1, random);
  const engine = Engine.create({ enableSleeping: true });
  engine.gravity.y = config.physics.gravity;
  const fruit = new Map<MatterJS.Body, number>();
  let merges: [MatterJS.Body, MatterJS.Body][] = [];
  Composite.add(engine.world, [
    Bodies.rectangle(50, 640, 10, 1280, { isStatic: true }),
    Bodies.rectangle(670, 640, 10, 1280, { isStatic: true }),
    Bodies.rectangle(360, 1110, 720, 20, { isStatic: true }),
    Bodies.rectangle(200, 1050, 310, 18, { isStatic: true, angle: 0.24, friction: 0.005 }),
    Bodies.rectangle(520, 1050, 310, 18, { isStatic: true, angle: -0.24, friction: 0.005 }),
    ...config.board.pegPositions.map(({ x, y }) => Bodies.circle(x, y, 14, { isStatic: true, restitution: 0.65 }))
  ]);
  Events.on(engine, 'collisionStart', event => {
    for (let i = 0; i < event.pairs.length; i++) {
      const { bodyA, bodyB } = event.pairs[i];
      if (fruit.has(bodyA) && fruit.has(bodyB) && controller.canMerge(fruit.get(bodyA)!, fruit.get(bodyB)!)) merges.push([bodyA, bodyB]);
    }
  });
  function spawn(x: number, y: number, level: number) {
    const body = Bodies.circle(x, y, balls[level - 1].radius, { ...config.physics });
    fruit.set(body, level);
    Composite.add(engine.world, body);
    return body;
  }
  let shots = 0;
  for (let frame = 0; frame < 3600; frame++) {
    if (frame % 40 === 0 && controller.getGameState().shotsRemaining > 0) {
      const angle = Math.PI / 2 + (random() - 0.5) * 0.6;
      const body = spawn(360, 270, queue.take());
      Body.setVelocity(body, { x: Math.cos(angle) * 12, y: Math.sin(angle) * 12 });
      controller.useShot();
      shots++;
    }
    Engine.update(engine, 1000 / 60);
    const pending = merges;
    merges = [];
    for (let i = 0; i < pending.length; i++) {
      const [a, b] = pending[i];
      if (!fruit.has(a) || !fruit.has(b)) continue;
      const result = controller.processMerge(fruit.get(a)!, frame * 1000 / 60);
      const x = (a.position.x + b.position.x) / 2;
      const y = (a.position.y + b.position.y) / 2;
      fruit.delete(a);
      fruit.delete(b);
      Composite.remove(engine.world, [a, b]);
      spawn(x, y, result.newLevel);
    }
    if (controller.checkLevelComplete() === 'win') return { won: true, shots, seconds: frame / 60 };
  }
  return { won: false, shots, seconds: 60 };
}

for (let level = 1; level <= 3; level++) {
  const runs = Array.from({ length: 100 }, (_, index) => simulate(index + 1, level));
  const wins = runs.filter(run => run.won);
  console.log(JSON.stringify({ level, runs: runs.length, wins: wins.length, meanWinningShots: wins.reduce((sum, run) => sum + run.shots, 0) / wins.length, meanWinningSeconds: wins.reduce((sum, run) => sum + run.seconds, 0) / wins.length }));
}
