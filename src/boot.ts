import Phaser from 'phaser';
import { HomeScene } from './scenes/HomeScene';
import { MainScene } from './scenes/MainScene';
import { UpgradeScene } from './scenes/UpgradeScene';
import { GameOverScene } from './scenes/GameOverScene';
import { GameController } from './core/GameController';
import { IPlatform } from './platform/IPlatform';
import { setPlatform } from './platform';
import { GameConfig } from './types';
import { FONT_FACES, FONT_NAME, setFontFamily } from './ui/theme';
import { setRenderScale } from './ui/hidpi';
import { computeFillLayout, computeRenderScale } from './core/renderScale';

import ballLevels from './config/ballLevels.json';
import levelConfigs from './config/levelConfig.json';
import afterimageLevels from './config/afterimageLevels.json';
import gameConfigData from './config/gameConfig.json';

export interface BootOptions {
  platform: IPlatform;
  /**
   * fit：网页，画布 = 设计尺寸 × 高清倍率，由 Phaser Scale.FIT 用 CSS 缩放留边。
   * fill：小游戏，主屏 canvas 会被拉伸到整个屏幕，画布按屏幕比例铺满，相机把设计内容居中放进去。
   */
  layout: 'fit' | 'fill';
  /** 网页的容器元素 id。 */
  parent?: string;
  /** 小游戏传入 weapp-adapter 创建的主屏 canvas。 */
  canvas?: HTMLCanvasElement;
  /** 画布底色（fill 模式下就是屏幕两边留边的颜色）。 */
  backgroundColor?: string;
}

export interface BootResult {
  game: Phaser.Game;
  gameController: GameController;
  gameConfig: GameConfig;
  renderScale: number;
  startScene(key: 'HomeScene' | 'MainScene' | 'UpgradeScene', advanceLevels?: number, afterimageMode?: boolean): void;
}

// 字体就绪后再创建游戏，避免首帧先用 Courier/系统字体排版再跳变；最多等 3 秒，失败时用系统字体兜底。
const FONT_TIMEOUT_MS = 3000;

export async function boot(options: BootOptions): Promise<BootResult> {
  const { platform } = options;
  setPlatform(platform);
  const screenSize = platform.getScreenSize();
  const gameConfig = gameConfigData as GameConfig;
  const gameController = new GameController(ballLevels, levelConfigs, gameConfig);

  let width: number;
  let height: number;
  let renderScale: number;
  if (options.layout === 'fill') {
    const layout = computeFillLayout(platform.getDevicePixelRatio(), platform.getViewportSize(), screenSize);
    ({ canvasWidth: width, canvasHeight: height, zoom: renderScale } = layout);
  } else {
    // 画布像素按高清倍率放大，逻辑坐标仍是 screenSize（各场景的主相机同倍缩放）。
    renderScale = computeRenderScale(platform.getDevicePixelRatio(), platform.getViewportSize(), screenSize);
    width = Math.round(screenSize.width * renderScale);
    height = Math.round(screenSize.height * renderScale);
  }
  setRenderScale(renderScale);

  const family = await Promise.race([
    platform.loadFont(FONT_NAME, FONT_FACES),
    new Promise<null>((resolve) => setTimeout(() => resolve(null), FONT_TIMEOUT_MS))
  ]);
  if (family && family !== FONT_NAME) setFontFamily(family);

  const phaserConfig: Phaser.Types.Core.GameConfig = {
    type: options.canvas ? Phaser.WEBGL : Phaser.AUTO,
    width,
    height,
    parent: options.parent,
    canvas: options.canvas,
    backgroundColor: options.backgroundColor ?? '#1a1a2e',
    physics: {
      default: 'matter',
      matter: {
        gravity: { x: 0, y: gameConfig.physics.gravity },
        enableSleeping: true,
        debug: false
      }
    },
    // 小游戏没有 Blob URL，图片要走 Image 元素加载（weapp-adapter 映射到 wx.createImage）。
    loader: options.layout === 'fill' ? { imageLoadType: 'HTMLImageElement' } : undefined,
    scale: options.layout === 'fill'
      ? { mode: Phaser.Scale.NONE }
      : { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH }
  };

  const game = new Phaser.Game(phaserConfig);
  // 手动注册且不自动启动：放进 config.scene 时第一个场景会在没有 data 的情况下先启动。
  game.scene.add('HomeScene', HomeScene, false);
  game.scene.add('MainScene', MainScene, false);
  game.scene.add('UpgradeScene', UpgradeScene, false);
  game.scene.add('GameOverScene', GameOverScene, false);

  platform.onVisibilityChange((visible) => (visible ? game.resume() : game.pause()));

  const sceneData = { gameController, gameConfig };
  return {
    game,
    gameController,
    gameConfig,
    renderScale,
    startScene(key, advanceLevels = 0, afterimageMode = false) {
      if (afterimageMode) gameController.startRun(afterimageLevels);
      for (let i = 0; i < Math.min(advanceLevels, gameController.getLevelCount() - 1); i++) gameController.advanceLevel();
      game.scene.start(key, { ...sceneData, afterimageMode });
    }
  };
}

export const levelCount = levelConfigs.length;
