import { IPlatform } from './IPlatform';

export class WebPlatform implements IPlatform {
  private static audio?: AudioContext;
  private static volume = 0.16;
  private storage: Map<string, string> = new Map();

  async saveData(key: string, value: string): Promise<void> {
    this.storage.set(key, value);
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(`bouncemergegame_${key}`, value);
      }
    } catch (e) {
      console.warn('localStorage not available', e);
    }
  }

  async loadData(key: string): Promise<string | null> {
    if (this.storage.has(key)) {
      return this.storage.get(key) || null;
    }
    
    try {
      if (typeof localStorage !== 'undefined') {
        const value = localStorage.getItem(`bouncemergegame_${key}`);
        if (value) {
          this.storage.set(key, value);
          return value;
        }
      }
    } catch (e) {
      console.warn('localStorage not available', e);
    }
    
    return null;
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
    if (WebPlatform.volume === 0 || typeof AudioContext === 'undefined') return;
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

  toggleSound(): boolean {
    WebPlatform.volume = WebPlatform.volume > 0 ? 0 : 0.16;
    return WebPlatform.volume > 0;
  }

  isSoundEnabled(): boolean {
    return WebPlatform.volume > 0;
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
