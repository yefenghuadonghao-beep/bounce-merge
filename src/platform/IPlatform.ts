export interface IPlatform {
  // Storage
  saveData(key: string, value: string): Promise<void>;
  loadData(key: string): Promise<string | null>;
  
  // Screen & Device
  getScreenSize(): { width: number; height: number };
  getSafeArea(): { top: number; bottom: number; left: number; right: number };
  getDevicePixelRatio(): number;
  
  // Audio (stubs for now, to be implemented)
  playSound(soundId: string): void;
  playMusic(musicId: string): void;
  stopMusic(): void;
  setVolume(volume: number): void;
  /** 音效开关，需持久化，下次启动保持玩家的选择。 */
  isSoundEnabled(): boolean;
  setSoundEnabled(enabled: boolean): void;
  
  // Social (stubs for mini-game APIs)
  share(title: string, imageUrl?: string): Promise<boolean>;
  showAd(): Promise<boolean>;
  login(): Promise<{ userId: string; nickname: string } | null>;
  
  // Resource loading
  preloadAssets(assetList: string[]): Promise<void>;
}
