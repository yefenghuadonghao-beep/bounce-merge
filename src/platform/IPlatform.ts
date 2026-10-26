export interface FontFaceSpec {
  /** CSS 字重，如 '400' / '700'。 */
  weight: string;
  /** assets/fonts 下的文件名（不带扩展名）；Web 用 .woff2，小游戏用 .ttf。 */
  file: string;
}

export interface IPlatform {
  // Storage
  saveData(key: string, value: string): Promise<void>;
  loadData(key: string): Promise<string | null>;
  
  // Screen & Device
  getScreenSize(): { width: number; height: number };
  getSafeArea(): { top: number; bottom: number; left: number; right: number };
  getDevicePixelRatio(): number;
  /** 可用于显示游戏的窗口大小（CSS 像素 / 小游戏逻辑像素），用来算高清渲染倍率。 */
  getViewportSize(): { width: number; height: number };
  
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
  /**
   * 加载自定义字体，全部字重就绪后返回可用于 font-family 的名字；失败返回 null，调用方用系统字体兜底。
   * Web：FontFace + document.fonts；微信小游戏：wx.loadFont(ttf 路径)，返回值是实际可用的字体名。
   */
  loadFont(family: string, faces: readonly FontFaceSpec[]): Promise<string | null>;
  preloadAssets(assetList: string[]): Promise<void>;
}
