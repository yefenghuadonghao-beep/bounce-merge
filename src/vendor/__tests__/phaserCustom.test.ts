import { readFileSync, readdirSync, statSync } from 'node:fs';
import Module from 'node:module';
import { join } from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';

// jsdom 没有 2D canvas；Phaser 在 import 时会探测 canvas 特性，这里给一个够用的假 context。
function fakeContext(): unknown {
  const data = new Uint8ClampedArray(4);
  return new Proxy({}, {
    get: (_t, key) => (key === 'getImageData' || key === 'createImageData' ? () => ({ data }) : () => undefined),
    set: () => true
  });
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let PhaserCustom: any;
beforeAll(async () => {
  HTMLCanvasElement.prototype.getContext = (() => fakeContext()) as never;
  // 测试里没有构建期开关替换，`typeof WEBGL_DEBUG` 恒为真，会去 require 可选依赖 spector；给个空壳。
  const mod = Module as unknown as { _load: (request: string, ...rest: unknown[]) => unknown };
  const load = mod._load;
  mod._load = (request, ...rest) => (request === 'phaser3spectorjs' ? {} : load(request, ...rest));
  // @ts-expect-error 纯 JS 入口，只给正式构建用
  PhaserCustom = (await import('../phaser-custom.js')).default;
});

const SRC = join(__dirname, '..', '..');

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) return name === '__tests__' || name === 'vendor' ? [] : sourceFiles(p);
    return p.endsWith('.ts') && !p.endsWith('.d.ts') ? [p] : [];
  });
}

const code = sourceFiles(SRC).map((f) => readFileSync(f, 'utf8')).join('\n');

describe('精简版 Phaser 覆盖游戏用到的 API', () => {
  it('包含所有 add.xxx 工厂', () => {
    const used = new Set([...code.matchAll(/\b(?:this|scene)\.add\.([a-zA-Z]+)\(/g)].map((m) => m[1]));
    expect(used.size).toBeGreaterThan(3);
    const proto = PhaserCustom.GameObjects.GameObjectFactory.prototype;
    for (const name of used) expect(typeof proto[name], `add.${name}`).toBe('function');
  });

  it('包含所有运行时用到的 Phaser.* 值', () => {
    // 去掉类型位置的引用（`: Phaser.X`、`as Phaser.X`、`<Phaser.X>`、`Phaser.Types.*`），只检查运行时值。
    const runtime = code
      .replace(/(?:[:<|&,]\s*|\bas\s+|\bimplements\s+|\bextends\s+(?=Phaser\.Types))Phaser\.[A-Za-z.]+/g, '')
      .replace(/Phaser\.Types\.[A-Za-z.]+/g, '');
    const paths = new Set([...runtime.matchAll(/\bPhaser\.([A-Za-z_]+(?:\.[A-Za-z_]+)*)/g)].map((m) => m[1]));
    expect(paths.size).toBeGreaterThan(3);
    for (const path of paths) {
      const value = path.split('.').reduce<unknown>((o, k) => (o as Record<string, unknown> | undefined)?.[k], PhaserCustom);
      expect(value, `Phaser.${path}`).toBeDefined();
    }
  });

  it('包含 Matter 物理插件', () => {
    expect(PhaserCustom.Physics.Matter.MatterPhysics).toBeDefined();
  });
});
