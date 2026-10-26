import { FontFaceSpec, IPlatform } from './IPlatform';
import { assetUrl } from './assets';

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

  getScreenSize(): { width: number; height: number } {
    return { width: 720, height: 1280 };
  }

  getSafeArea(): { top: number; bottom: number; left: number; right: number } {
    return { top: 0, bottom: 0, left: 0, right: 0 };
  }

  getDevicePixelRatio(): number {
    return 1;
  }

  playSound(soundId: string): void {
    if (!this.soundEnabled || WebPlatform.volume === 0 || typeof AudioContext === 'undefined') return;
    try {
      const audio = WebPlatform.audio ??= new AudioContext();
      if (audio.state === 'suspended') void audio.resume().catch(() => {});
      const parts = soundId.split('_');
      const level = Number(parts[1]) || 1;
      const combo = Math.min(6, Number(parts[2]) || 1);
      const merge = soundId.startsWith('merge');
      const frequency = merge ? 330 * Math.pow(1.12, level) * Math.pow(1.06, combo - 1) : 240;
      // 连合逐渐升调，高连合使用短琶音，音量按音符数收敛。
      const notes = merge && combo >= 3 ? [1, 1.25, 1.5] : [1];
      for (let i = 0; i < notes.length; i++) {
        const start = audio.currentTime + i * 0.055;
        const oscillator = audio.createOscillator();
        const gain = audio.createGain();
        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(frequency * notes[i], start);
        oscillator.frequency.exponentialRampToValueAtTime(frequency * notes[i] * 1.25, start + 0.12);
        gain.gain.setValueAtTime(0.001, audio.currentTime);
        gain.gain.setValueAtTime(WebPlatform.volume / notes.length, start);
        gain.gain.exponentialRampToValueAtTime(0.001, start + 0.18);
        oscillator.connect(gain).connect(audio.destination);
        oscillator.start(start);
        oscillator.stop(start + 0.2);
        oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); };
      }
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
