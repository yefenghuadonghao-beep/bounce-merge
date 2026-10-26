import { beforeEach, describe, expect, it } from 'vitest';
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
});
