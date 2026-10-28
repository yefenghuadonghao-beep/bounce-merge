import { FontFaceSpec, IPlatform } from './IPlatform';
import { assetUrl } from './assets';
import { playSynth, SynthAudioContext } from './synth';

export class WebPlatform implements IPlatform {
  private static audio?: AudioContext;
  private static volume = 0.16;
  private static readonly SOUND_KEY = 'bouncemergegame_sound';
  private storage: Map<string, string> = new Map();
  private soundEnabled = WebPlatform.readSoundSetting();

  private static readSoundSetting(): boolean {
    try {
      return typeof localStorage === 'undefined' || localStorage.getItem(WebPlatform.SOUND_KEY) !== '0';
    } catch {
      return true;
    }
  }

  // localStorage 是唯一数据源；仅在它不可用（隐私模式等）时退回内存。
  async saveData(key: string, value: string): Promise<void> {
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(`bouncemergegame_${key}`, value);
        return;
      }
    } catch (e) {
      console.warn('localStorage not available', e);
    }
    this.storage.set(key, value);
  }

  async loadData(key: string): Promise<string | null> {
    try {
      if (typeof localStorage !== 'undefined') {
        return localStorage.getItem(`bouncemergegame_${key}`);
      }
    } catch (e) {
      console.warn('localStorage not available', e);
    }
    return this.storage.get(key) ?? null;
  }

  getCurrentTime(): number {
    return Date.now();
  }

  async loadFont(family: string, faces: readonly FontFaceSpec[]): Promise<string | null> {
    if (typeof FontFace === 'undefined' || typeof document === 'undefined' || !document.fonts) return null;
    try {
      const loaded = await Promise.all(faces.map((f) =>
        new FontFace(family, `url(${assetUrl(`assets/fonts/${f.file}.woff2`)}) format('woff2')`, { weight: f.weight, display: 'block' }).load()
      ));
      for (const face of loaded) document.fonts.add(face);
      return family;
    } catch (e) {
      console.warn('font load failed, using system fallback', e);
      return null;
    }
  }

  onVisibilityChange(_handler: (visible: boolean) => void): void {
    // 网页里 Phaser 自己监听 document.visibilitychange 暂停/恢复主循环，这里不用重复处理。
  }

  getScreenSize(): { width: number; height: number } {
    return { width: 720, height: 1280 };
  }

  getSafeArea(): { top: number; bottom: number; left: number; right: number } {
    return { top: 0, bottom: 0, left: 0, right: 0 };
  }

  getDevicePixelRatio(): number {
    return typeof window !== 'undefined' && window.devicePixelRatio > 0 ? window.devicePixelRatio : 1;
  }

  getViewportSize(): { width: number; height: number } {
    if (typeof window === 'undefined') return this.getScreenSize();
    return { width: window.innerWidth, height: window.innerHeight };
  }

  playSound(soundId: string): void {
    if (!this.soundEnabled || WebPlatform.volume === 0 || typeof AudioContext === 'undefined') return;
    try {
      const audio = WebPlatform.audio ??= new AudioContext();
      playSynth(audio as unknown as SynthAudioContext, soundId, WebPlatform.volume);
    } catch {
      // 静音或不支持音频的环境仍可正常游玩。
    }
  }

  isSoundEnabled(): boolean {
    return this.soundEnabled;
  }

  setSoundEnabled(enabled: boolean): void {
    this.soundEnabled = enabled;
    try {
      if (typeof localStorage !== 'undefined') localStorage.setItem(WebPlatform.SOUND_KEY, enabled ? '1' : '0');
    } catch {
      // 无持久化存储时仅本次会话生效。
    }
  }

  playMusic(musicId: string): void {
    console.log(`Playing music: ${musicId}`);
  }

  stopMusic(): void {
    console.log('Stopping music');
  }

  setVolume(volume: number): void {
    WebPlatform.volume = Math.max(0, Math.min(1, volume));
  }

  async share(title: string, imageUrl?: string): Promise<boolean> {
    console.log(`Share: ${title}`, imageUrl);
    if (navigator.share) {
      try {
        await navigator.share({ title, url: window.location.href });
        return true;
      } catch (e) {
        return false;
      }
    }
    return false;
  }

  async showAd(): Promise<boolean> {
    console.log('Show ad (web stub)');
    return false;
  }

  async login(): Promise<{ userId: string; nickname: string } | null> {
    console.log('Login (web stub)');
    return { userId: 'web_user', nickname: '玩家' };
  }

  async preloadAssets(assetList: string[]): Promise<void> {
    console.log('Preloading assets:', assetList);
    return Promise.resolve();
  }
}
