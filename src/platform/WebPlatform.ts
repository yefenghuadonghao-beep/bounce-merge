import { IPlatform } from './IPlatform';

export class WebPlatform implements IPlatform {
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
    // Stub for web - to be implemented with Howler.js or Web Audio API
    console.log(`Playing sound: ${soundId}`);
  }

  playMusic(musicId: string): void {
    console.log(`Playing music: ${musicId}`);
  }

  stopMusic(): void {
    console.log('Stopping music');
  }

  setVolume(volume: number): void {
    console.log(`Setting volume: ${volume}`);
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
