// 用到的微信小游戏 API 子集（只声明本项目调用的部分，避免引入完整类型包）。
// 参考：https://developers.weixin.qq.com/minigame/dev/api/
import type { SynthAudioContext } from './synth';

export interface WxWindowInfo {
  pixelRatio: number;
  windowWidth: number;
  windowHeight: number;
  screenWidth?: number;
  screenHeight?: number;
  safeArea?: { top: number; bottom: number; left: number; right: number; width?: number; height?: number };
}

export interface WxInnerAudioContext {
  src: string;
  loop: boolean;
  volume: number;
  autoplay?: boolean;
  play(): void;
  stop(): void;
  destroy(): void;
}

export interface WxLike {
  setStorageSync(key: string, data: string): void;
  getStorageSync(key: string): unknown;
  /** 基础库 2.20.1+；旧版本退回 getSystemInfoSync。 */
  getWindowInfo?(): WxWindowInfo;
  getSystemInfoSync(): WxWindowInfo;
  /** 同步返回可用于 canvas font 的字体名，失败返回 null。只支持代码包内的本地路径或网络 URL。 */
  loadFont(path: string): string | null;
  createInnerAudioContext(): WxInnerAudioContext;
  /** 基础库 2.19.0+。 */
  createWebAudioContext?(): SynthAudioContext & { suspend?(): void; close?(): void };
  onShow(cb: (res?: unknown) => void): void;
  onHide(cb: () => void): void;
  showShareMenu?(options: { withShareTicket?: boolean; menus?: string[] }): void;
  onShareAppMessage?(cb: () => { title: string; imageUrl?: string }): void;
  onShareTimeline?(cb: () => { title: string; imageUrl?: string }): void;
  shareAppMessage(options: { title: string; imageUrl?: string }): void;
}
