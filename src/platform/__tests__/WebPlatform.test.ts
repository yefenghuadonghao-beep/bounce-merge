import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { WebPlatform } from '../WebPlatform';
import { getPlatform, setPlatform } from '..';

describe('WebPlatform 音效开关', () => {
  beforeEach(() => localStorage.clear());

  it('默认开启', () => {
    expect(new WebPlatform().isSoundEnabled()).toBe(true);
  });

  it('关闭后写入存储，新实例（下次启动）保持关闭', () => {
    const first = new WebPlatform();
    first.setSoundEnabled(false);
    expect(first.isSoundEnabled()).toBe(false);
    expect(localStorage.getItem('bouncemergegame_sound')).toBe('0');
    expect(new WebPlatform().isSoundEnabled()).toBe(false);

    first.setSoundEnabled(true);
    expect(new WebPlatform().isSoundEnabled()).toBe(true);
  });

  it('调音量不会改变开关', () => {
    const platform = new WebPlatform();
    platform.setVolume(0.5);
    expect(platform.isSoundEnabled()).toBe(true);
  });
});

describe('WebPlatform 存储', () => {
  beforeEach(() => localStorage.clear());

  it('同一实例读取的是存储里的最新值，不会被内存缓存挡住', async () => {
    const platform = new WebPlatform();
    await platform.saveData('best_score', '100');
    localStorage.setItem('bouncemergegame_best_score', '50');
    expect(await platform.loadData('best_score')).toBe('50');
    localStorage.clear();
    expect(await platform.loadData('best_score')).toBeNull();
  });
});

describe('平台注册', () => {
  it('setPlatform 后场景拿到同一个实现', () => {
    const platform = new WebPlatform();
    setPlatform(platform);
    expect(getPlatform()).toBe(platform);
  });

  it('未注册时直接报错，不偷偷回退到网页实现', async () => {
    vi.resetModules();
    const fresh = await import('..');
    expect(() => fresh.getPlatform()).toThrow(/setPlatform/);
  });
});

describe('WebPlatform.loadFont', () => {
  const originalFontFace = (globalThis as { FontFace?: unknown }).FontFace;
  const originalFonts = Object.getOwnPropertyDescriptor(document, 'fonts');
  afterEach(() => {
    (globalThis as { FontFace?: unknown }).FontFace = originalFontFace;
    if (originalFonts) Object.defineProperty(document, 'fonts', originalFonts);
    else delete (document as { fonts?: unknown }).fonts;
  });

  function install(fail = false) {
    const created: { family: string; source: string; weight?: string }[] = [];
    const added: unknown[] = [];
    (globalThis as { FontFace?: unknown }).FontFace = class {
      constructor(public family: string, public source: string, public descriptors: { weight?: string }) {
        created.push({ family, source, weight: descriptors.weight });
      }
      load() { return fail ? Promise.reject(new Error('404')) : Promise.resolve(this); }
    };
    Object.defineProperty(document, 'fonts', { configurable: true, value: { add: (f: unknown) => added.push(f) } });
    return { created, added };
  }

  it('每个字重各建一个 woff2 FontFace，全部加载后注册并返回字体名', async () => {
    const { created, added } = install();
    const name = await new WebPlatform().loadFont('MochiRounded', [{ weight: '400', file: 'a' }, { weight: '700', file: 'b' }]);
    expect(name).toBe('MochiRounded');
    expect(created.map((c) => c.weight)).toEqual(['400', '700']);
    expect(created.every((c) => c.family === 'MochiRounded' && c.source.includes('.woff2'))).toBe(true);
    expect(added).toHaveLength(2);
  });

  it('加载失败返回 null，不注册半套字体', async () => {
    const { added } = install(true);
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(await new WebPlatform().loadFont('MochiRounded', [{ weight: '400', file: 'a' }])).toBeNull();
    expect(added).toHaveLength(0);
    warn.mockRestore();
  });

  it('环境不支持 FontFace 时直接返回 null', async () => {
    (globalThis as { FontFace?: unknown }).FontFace = undefined;
    expect(await new WebPlatform().loadFont('X', [{ weight: '400', file: 'a' }])).toBeNull();
  });
});
