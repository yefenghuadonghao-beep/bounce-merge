import { describe, expect, it, vi } from 'vitest';
import { WeChatPlatform } from '../WeChatPlatform';
import type { WxLike, WxWindowInfo } from '../wx';
import { WorkstationManager } from '../../core/WorkstationManager';

function fakeAudioParam() {
  return { setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() };
}

function createFakeWx(overrides: Partial<WxLike> = {}, info?: Partial<WxWindowInfo>) {
  const storage = new Map<string, string>();
  const show: Array<() => void> = [];
  const hide: Array<() => void> = [];
  const oscillators: unknown[] = [];
  const audio = {
    currentTime: 0,
    destination: {},
    state: 'running',
    resume: vi.fn(async () => {}),
    suspend: vi.fn(),
    createOscillator: vi.fn(() => {
      const osc = { type: '', frequency: fakeAudioParam(), connect: vi.fn(), start: vi.fn(), stop: vi.fn(), disconnect: vi.fn(), onended: null };
      oscillators.push(osc);
      return osc;
    }),
    createGain: vi.fn(() => ({ gain: fakeAudioParam(), connect: vi.fn(), disconnect: vi.fn() }))
  };
  const inner = { src: '', loop: false, volume: 1, play: vi.fn(), stop: vi.fn(), destroy: vi.fn() };
  const windowInfo: WxWindowInfo = {
    pixelRatio: 3, windowWidth: 390, windowHeight: 844,
    safeArea: { top: 47, bottom: 810, left: 0, right: 390 }, ...info
  };
  const wx = {
    setStorageSync: vi.fn((k: string, v: string) => void storage.set(k, v)),
    getStorageSync: vi.fn((k: string) => storage.get(k) ?? ''),
    getWindowInfo: vi.fn(() => windowInfo),
    getSystemInfoSync: vi.fn(() => windowInfo),
    loadFont: vi.fn((path: string) => (path.endsWith('.ttf') ? 'Resource Han Rounded CN' : null)),
    createInnerAudioContext: vi.fn(() => inner),
    createWebAudioContext: vi.fn(() => audio),
    onShow: vi.fn((cb: () => void) => void show.push(cb)),
    onHide: vi.fn((cb: () => void) => void hide.push(cb)),
    showShareMenu: vi.fn(),
    onShareAppMessage: vi.fn(),
    onShareTimeline: vi.fn(),
    shareAppMessage: vi.fn(),
    ...overrides
  };
  return { wx, storage, audio, inner, oscillators, fireShow: () => show.forEach((f) => f()), fireHide: () => hide.forEach((f) => f()) };
}

describe('WeChatPlatform 存储', () => {
  it('用 wx.setStorageSync / getStorageSync，key 与网页版同前缀', async () => {
    const { wx, storage } = createFakeWx();
    const platform = new WeChatPlatform(wx);
    await platform.saveData('best_score', '120');
    expect(storage.get('bouncemergegame_best_score')).toBe('120');
    expect(await platform.loadData('best_score')).toBe('120');
  });

  it('不存在的 key 读成 null，读取异常向业务层传递', async () => {
    const { wx } = createFakeWx();
    const platform = new WeChatPlatform(wx);
    expect(await platform.loadData('missing')).toBeNull();
    vi.mocked(wx.getStorageSync).mockImplementation(() => { throw new Error('boom'); });
    await expect(platform.loadData('best_score')).rejects.toThrow('boom');
    expect(new WeChatPlatform(wx).isSoundEnabled()).toBe(true);
  });

  it('音效开关持久化，下次启动保持', () => {
    const { wx, storage } = createFakeWx();
    const first = new WeChatPlatform(wx);
    expect(first.isSoundEnabled()).toBe(true);
    first.setSoundEnabled(false);
    expect(storage.get('bouncemergegame_sound')).toBe('0');
    expect(new WeChatPlatform(wx).isSoundEnabled()).toBe(false);
  });

  it('写入失败向业务层抛出，让奖励和领取可以原样重试', async () => {
    const { wx } = createFakeWx();
    const platform = new WeChatPlatform(wx);
    WorkstationManager['instance'] = null;
    const manager = WorkstationManager.getInstance(platform);
    const completion = { id: 'wx-stage-1', mode: 'classic' as const, level: 1, score: 25, bestCombo: 1, shotsUsed: 1 };
    vi.mocked(wx.setStorageSync).mockImplementationOnce(() => { throw new Error('storage full'); });
    await expect(manager.completeStage(completion)).rejects.toThrow('storage full');
    const state = (await manager.getSystem()).getState();
    expect(state.coins).toBe(0);
    expect(state.journey?.records).toEqual({});
    const reward = await manager.completeStage(completion);
    expect(state.coins).toBe(35);
    expect(reward.items).toHaveLength(2);

    vi.mocked(wx.setStorageSync).mockImplementationOnce(() => { throw new Error('storage full'); });
    await expect(manager.claimStageRewards()).rejects.toThrow('storage full');
    expect(state.inbox).toHaveLength(3);
    expect(state.journey?.pendingRewards[0].items).toHaveLength(2);
    expect(await manager.claimStageRewards()).toEqual({ claimed: 2, remaining: 0 });
    expect(await manager.completeStage(completion)).toEqual(reward);

    WorkstationManager['instance'] = null;
    const restored = (await WorkstationManager.getInstance(platform).getSystem()).getState();
    expect(restored.coins).toBe(35);
    expect(restored.inbox).toHaveLength(5);
    expect(restored.journey?.pendingRewards).toEqual([]);
    expect(restored.journey?.records['classic:1'].clears).toBe(1);
    WorkstationManager['instance'] = null;
  });

  it('读档失败不创建新档覆盖资产，重试仍恢复原有工位', async () => {
    const { wx, storage } = createFakeWx();
    const platform = new WeChatPlatform(wx);
    WorkstationManager['instance'] = null;
    const manager = WorkstationManager.getInstance(platform);
    const system = await manager.getSystem();
    system.getState().coins = 88;
    system.placeItemOnDesk(system.getState().inbox[0].id, 0);
    await manager.save();
    const saved = storage.get('bouncemergegame_workstation_state');

    WorkstationManager['instance'] = null;
    const restored = WorkstationManager.getInstance(platform);
    const completion = { id: 'wx-retry-read', mode: 'classic' as const, level: 1, score: 25, bestCombo: 1, shotsUsed: 1 };
    vi.mocked(wx.getStorageSync).mockImplementationOnce(() => { throw new Error('storage temporarily unreadable'); });
    await expect(restored.completeStage(completion)).rejects.toThrow('storage temporarily unreadable');
    expect(storage.get('bouncemergegame_workstation_state')).toBe(saved);
    await restored.completeStage(completion);
    const state = (await restored.getSystem()).getState();
    expect(state.coins).toBe(123);
    expect(state.inbox).toHaveLength(2);
    expect(state.desks[0].content).toMatchObject({ type: 'document', level: 1 });
    expect(state.journey?.records['classic:1'].clears).toBe(1);
    WorkstationManager['instance'] = null;
  });
});

describe('WeChatPlatform 设备信息', () => {
  it('像素比和视口来自 getWindowInfo，逻辑尺寸固定 720×1280', () => {
    const { wx } = createFakeWx();
    const platform = new WeChatPlatform(wx);
    expect(platform.getDevicePixelRatio()).toBe(3);
    expect(platform.getViewportSize()).toEqual({ width: 390, height: 844 });
    expect(platform.getScreenSize()).toEqual({ width: 720, height: 1280 });
  });

  it('安全区矩形换算成四边内缩', () => {
    const { wx } = createFakeWx();
    expect(new WeChatPlatform(wx).getSafeArea()).toEqual({ top: 47, bottom: 34, left: 0, right: 0 });
  });

  it('旧基础库没有 getWindowInfo 时退回 getSystemInfoSync', () => {
    const { wx } = createFakeWx({ getWindowInfo: undefined }, { pixelRatio: 2 });
    expect(new WeChatPlatform(wx).getDevicePixelRatio()).toBe(2);
    expect(wx.getSystemInfoSync).toHaveBeenCalled();
  });
});

describe('WeChatPlatform 字体', () => {
  it('用 wx.loadFont 加载包内 ttf，返回 ttf 里的实际字体名', async () => {
    const { wx } = createFakeWx();
    const platform = new WeChatPlatform(wx);
    const family = await platform.loadFont('MochiRounded', [
      { weight: '400', file: 'mochi-rounded-regular' },
      { weight: '700', file: 'mochi-rounded-bold' }
    ]);
    expect(family).toBe('Resource Han Rounded CN');
    expect(wx.loadFont).toHaveBeenCalledWith('assets/fonts/mochi-rounded-regular.ttf');
    expect(wx.loadFont).toHaveBeenCalledWith('assets/fonts/mochi-rounded-bold.ttf');
  });

  it('加载失败返回 null（调用方用系统字体）', async () => {
    const { wx } = createFakeWx({ loadFont: vi.fn(() => null) });
    expect(await new WeChatPlatform(wx).loadFont('MochiRounded', [{ weight: '400', file: 'x' }])).toBeNull();
  });
});

describe('WeChatPlatform 音频', () => {
  it('音效用 WebAudioContext 合成，关闭后不再出声', () => {
    const { wx, oscillators } = createFakeWx();
    const platform = new WeChatPlatform(wx);
    platform.playSound('shot');
    expect(oscillators).toHaveLength(1);
    platform.playSound('merge_3_4'); // 高连合 3 个音
    expect(oscillators).toHaveLength(4);
    platform.setSoundEnabled(false);
    platform.playSound('shot');
    expect(oscillators).toHaveLength(4);
  });

  it('没有 createWebAudioContext 的旧基础库静默跳过', () => {
    const { wx } = createFakeWx({ createWebAudioContext: undefined });
    expect(() => new WeChatPlatform(wx).playSound('shot')).not.toThrow();
  });

  it('背景音乐用 InnerAudioContext 循环播放，停止时销毁', () => {
    const { wx, inner } = createFakeWx();
    const platform = new WeChatPlatform(wx);
    platform.playMusic('bgm');
    expect(inner).toMatchObject({ src: 'assets/audio/bgm.mp3', loop: true });
    expect(inner.play).toHaveBeenCalled();
    platform.stopMusic();
    expect(inner.stop).toHaveBeenCalled();
    expect(inner.destroy).toHaveBeenCalled();
  });
});

describe('WeChatPlatform 生命周期与分享', () => {
  it('onHide/onShow 通知游戏并挂起/恢复音频', () => {
    const { wx, audio, fireHide, fireShow } = createFakeWx();
    const platform = new WeChatPlatform(wx);
    const handler = vi.fn();
    platform.onVisibilityChange(handler);
    platform.playSound('shot'); // 创建音频上下文
    fireHide();
    expect(handler).toHaveBeenLastCalledWith(false);
    expect(audio.suspend).toHaveBeenCalled();
    audio.state = 'suspended';
    fireShow();
    expect(handler).toHaveBeenLastCalledWith(true);
    expect(audio.resume).toHaveBeenCalled();
  });

  it('打开右上角转发菜单并注册默认分享文案', async () => {
    const { wx } = createFakeWx();
    const platform = new WeChatPlatform(wx, { shareTitle: '一起下班' });
    expect(wx.showShareMenu).toHaveBeenCalledWith({ withShareTicket: false, menus: ['shareAppMessage', 'shareTimeline'] });
    const provider = vi.mocked(wx.onShareAppMessage!).mock.calls[0][0];
    expect(provider().title).toBe('一起下班');
    expect(await platform.share('我合出了下班大王', 'share.png')).toBe(true);
    expect(wx.shareAppMessage).toHaveBeenCalledWith({ title: '我合出了下班大王', imageUrl: 'share.png' });
  });
});
