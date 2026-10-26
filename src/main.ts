import Phaser from 'phaser';
import { MainScene } from './scenes/MainScene';
import { UpgradeScene } from './scenes/UpgradeScene';
import { GameOverScene } from './scenes/GameOverScene';
import { GameController } from './core/GameController';
import { WebPlatform } from './platform/WebPlatform';
import { IPlatform } from './platform/IPlatform';
import { setPlatform } from './platform';
import { GameConfig } from './types';
import { FONT_FACES, FONT_NAME } from './ui/theme';
import { setRenderScale } from './ui/hidpi';
import { computeRenderScale } from './core/renderScale';

import ballLevels from './config/ballLevels.json';
import levelConfigs from './config/levelConfig.json';
import gameConfigData from './config/gameConfig.json';

const platform: IPlatform = new WebPlatform();
setPlatform(platform);
const screenSize = platform.getScreenSize();
// 画布像素按高清倍率放大，逻辑坐标仍是 screenSize（各场景的主相机同倍缩放）。
const renderScale = computeRenderScale(platform.getDevicePixelRatio(), platform.getViewportSize(), screenSize);
setRenderScale(renderScale);
const gameConfig: GameConfig = gameConfigData as GameConfig;

const gameController = new GameController(ballLevels, levelConfigs, gameConfig);

const phaserConfig: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  width: Math.round(screenSize.width * renderScale),
  height: Math.round(screenSize.height * renderScale),
  parent: 'game-container',
  backgroundColor: '#1a1a2e',
  physics: {
    default: 'matter',
    matter: {
      gravity: { x: 0, y: gameConfig.physics.gravity },
      enableSleeping: true,
      debug: false
    }
  },
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH
  }
};

// 字体就绪后再创建游戏，避免首帧先用 Courier/系统字体排版再跳变；最多等 3 秒，失败时用系统字体兜底。
const FONT_TIMEOUT_MS = 3000;
async function boot() {
  await Promise.race([
    platform.loadFont(FONT_NAME, FONT_FACES),
    new Promise((resolve) => setTimeout(resolve, FONT_TIMEOUT_MS))
  ]);

  const game = new Phaser.Game(phaserConfig);
  // 手动注册且不自动启动：放进 config.scene 时第一个场景会在没有 data 的情况下先启动。
  game.scene.add('MainScene', MainScene, false);
  game.scene.add('UpgradeScene', UpgradeScene, false);
  game.scene.add('GameOverScene', GameOverScene, false);

  const sceneData = { gameController, gameConfig };
  if (import.meta.env.DEV) {
    // 调试入口仅在开发构建中存在：window 全局、?stage=N 跳关、?scene=upgrade 直达升级页。
    Object.assign(window, { game, gameController, gameConfig, renderScale });
    const urlParams = new URLSearchParams(window.location.search);
    const requestedStage = Number(urlParams.get('stage'));
    if (Number.isInteger(requestedStage) && requestedStage >= 1 && requestedStage <= levelConfigs.length) {
      for (let i = 1; i < requestedStage; i++) gameController.advanceLevel();
    }
    game.scene.start(urlParams.get('scene') === 'upgrade' ? 'UpgradeScene' : 'MainScene', sceneData);
  } else {
    game.scene.start('MainScene', sceneData);
  }
  return game;
}

export const gameReady = boot();
export { platform, gameController };
