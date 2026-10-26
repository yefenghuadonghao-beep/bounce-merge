// 微信小游戏入口：game.js 先 require weapp-adapter（提供 window/document/canvas/Image 等），再加载本包。
import { boot } from '../boot';
import { WeChatPlatform } from '../platform/WeChatPlatform';
import type { WxLike } from '../platform/wx';
import { letterboxColor } from '../ui/theme';

declare const wx: WxLike & { createCanvas(): HTMLCanvasElement };

// weapp-adapter 会创建主屏 canvas 并挂到 GameGlobal.canvas / window.canvas；没有时自己建（第一个 canvas 即主屏）。
const screenCanvas: HTMLCanvasElement = (globalThis as { canvas?: HTMLCanvasElement }).canvas ?? wx.createCanvas();

const platform = new WeChatPlatform(wx);

boot({ platform, layout: 'fill', canvas: screenCanvas, backgroundColor: letterboxColor })
  .then((result) => result.startScene('MainScene'))
  .catch((e) => console.error('boot failed', e));
