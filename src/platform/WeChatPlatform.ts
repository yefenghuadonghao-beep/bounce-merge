import { FontFaceSpec, IPlatform } from './IPlatform';
import { playSynth, SynthAudioContext } from './synth';
import { WxInnerAudioContext, WxLike, WxWindowInfo } from './wx';

const STORAGE_PREFIX = 'bouncemergegame_';
const SOUND_KEY = `${STORAGE_PREFIX}sound`;
const DESIGN_SIZE = { width: 720, height: 1280 };

export interface WeChatPlatformOptions {
  /** 代码包内资源根目录（相对 game.js）。 */
  assetRoot?: string;
  /** 默认分享文案（右上角菜单转发 / 朋友圈）。 */
  shareTitle?: string;
  shareImageUrl?: string;
}

/**
 * 微信小游戏平台实现。wx 由构造函数注入，单元测试用假对象；正式运行时传全局 wx。
 * 存储 key 与网页版一致（bouncemergegame_ 前缀），音效开关同样持久化。
 */
export class WeChatPlatform implements IPlatform {
  private readonly wx: WxLike;
  private readonly assetRoot: string;
  private soundEnabled: boolean;
  private volume = 0.16;
  private webAudio?: ReturnType<NonNullable<WxLike['createWebAudioContext']>> | null;
  private music?: WxInnerAudioContext;
  private windowInfo?: WxWindowInfo;
  private readonly visibilityHandlers: Array<(visible: boolean) => void> = [];

  constructor(wx: WxLike, options: WeChatPlatformOptions = {}) {
    this.wx = wx;
    this.assetRoot = (options.assetRoot ?? 'assets').replace(/\/$/, '');
    this.soundEnabled = this.readStorage(SOUND_KEY) !== '0';

    wx.onShow(() => {
      this.resumeAudio();
      this.visibilityHandlers.forEach((handler) => handler(true));
    });
    wx.onHide(() => {
      this.suspendAudio();
      this.visibilityHandlers.forEach((handler) => handler(false));
    });

    const share = () => ({ title: options.shareTitle ?? '下班团子 · 碰掉坏情绪', imageUrl: options.shareImageUrl });
    wx.showShareMenu?.({ withShareTicket: false, menus: ['shareAppMessage', 'shareTimeline'] });
    wx.onShareAppMessage?.(share);
    wx.onShareTimeline?.(share);
  }

  private readStorage(key: string): string | null {
    try {
      const value = this.wx.getStorageSync(key);
      // 不存在的 key 返回空字符串
      return typeof value === 'string' && value !== '' ? value : null;
    } catch {
      return null;
    }
  }

  async saveData(key: string, value: string): Promise<void> {
    try {
      this.wx.setStorageSync(`${STORAGE_PREFIX}${key}`, value);
    } catch (e) {
      console.warn('wx.setStorageSync failed', e);
    }
  }

  async loadData(key: string): Promise<string | null> {
    return this.readStorage(`${STORAGE_PREFIX}${key}`);
  }

  private info(): WxWindowInfo {
    return this.windowInfo ??= this.wx.getWindowInfo ? this.wx.getWindowInfo() : this.wx.getSystemInfoSync();
  }

  getScreenSize(): { width: number; height: number } {
    // 游戏逻辑统一使用设计分辨率，真实屏幕尺寸见 getViewportSize。
    return { ...DESIGN_SIZE };
  }

  getSafeArea(): { top: number; bottom: number; left: number; right: number } {
    const info = this.info();
    const area = info.safeArea;
    if (!area) return { top: 0, bottom: 0, left: 0, right: 0 };
    // 微信给的是安全区矩形，这里换成四边的内缩距离（窗口逻辑像素）。
    return {
      top: Math.max(0, area.top),
      bottom: Math.max(0, info.windowHeight - area.bottom),
      left: Math.max(0, area.left),
      right: Math.max(0, info.windowWidth - area.right)
    };
  }

  getDevicePixelRatio(): number {
    const ratio = this.info().pixelRatio;
    return Number.isFinite(ratio) && ratio > 0 ? ratio : 1;
  }

  getViewportSize(): { width: number; height: number } {
    const info = this.info();
    return { width: info.windowWidth, height: info.windowHeight };
  }

  onVisibilityChange(handler: (visible: boolean) => void): void {
    this.visibilityHandlers.push(handler);
  }

  async loadFont(_family: string, faces: readonly FontFaceSpec[]): Promise<string | null> {
    // wx.loadFont 不能指定字体名和字重，返回值是 ttf 里的 family 名；两个字重同名时 canvas 按 bold 选字面。
    let family: string | null = null;
    for (const face of faces) {
      try {
        const name = this.wx.loadFont(`${this.assetRoot}/fonts/${face.file}.ttf`);
        if (name && (face.weight === '400' || !family)) family = name;
      } catch (e) {
        console.warn('wx.loadFont failed', face.file, e);
      }
    }
    return family;
  }

  private audioContext() {
    if (this.webAudio === undefined) {
      try {
        this.webAudio = this.wx.createWebAudioContext?.() ?? null;
      } catch {
        this.webAudio = null;
      }
    }
    return this.webAudio;
  }

  private resumeAudio(): void {
    const audio = this.webAudio;
    if (audio?.state === 'suspended' && audio.resume) void Promise.resolve(audio.resume()).catch(() => {});
  }

  private suspendAudio(): void {
    try {
      this.webAudio?.suspend?.();
    } catch {
      // 忽略
    }
  }

  playSound(soundId: string): void {
    if (!this.soundEnabled || this.volume === 0) return;
    const audio = this.audioContext();
    if (!audio) return;
    try {
      playSynth(audio as SynthAudioContext, soundId, this.volume);
    } catch {
      // 音频失败不影响游戏
    }
  }

  /** 背景音乐走 InnerAudioContext（适合长音频文件）；文件放在 assets/audio/<id>.mp3。 */
  playMusic(musicId: string): void {
    this.stopMusic();
    if (!this.soundEnabled) return;
    const music = this.wx.createInnerAudioContext();
    music.src = `${this.assetRoot}/audio/${musicId}.mp3`;
    music.loop = true;
    music.volume = this.volume;
    music.play();
    this.music = music;
  }

  stopMusic(): void {
    if (!this.music) return;
    this.music.stop();
    this.music.destroy();
    this.music = undefined;
  }

  setVolume(volume: number): void {
    this.volume = Math.max(0, Math.min(1, volume));
    if (this.music) this.music.volume = this.volume;
  }

  isSoundEnabled(): boolean {
    return this.soundEnabled;
  }

  setSoundEnabled(enabled: boolean): void {
    this.soundEnabled = enabled;
    if (!enabled) this.stopMusic();
    try {
      this.wx.setStorageSync(SOUND_KEY, enabled ? '1' : '0');
    } catch {
      // 仅本次生效
    }
  }

  async share(title: string, imageUrl?: string): Promise<boolean> {
    try {
      // 小游戏的 shareAppMessage 没有回调告知是否真的分享成功，调起即视为成功。
      this.wx.shareAppMessage({ title, imageUrl });
      return true;
    } catch {
      return false;
    }
  }

  async showAd(): Promise<boolean> {
    // 激励视频需要在 mp 后台申请 adUnitId 后用 wx.createRewardedVideoAd 实现，目前未接入。
    return false;
  }

  async login(): Promise<{ userId: string; nickname: string } | null> {
    // wx.login 只给 code，需后端换 openid；未接后端前返回 null。
    return null;
  }

  async preloadAssets(_assetList: string[]): Promise<void> {
    // 主包资源随包下发；分包资源用 wx.loadSubpackage（见 docs/wechat-subpackages.md）。
  }
}
