import Phaser from 'phaser';
import { MainScene } from './scenes/MainScene';
import { UpgradeScene } from './scenes/UpgradeScene';
import { GameOverScene } from './scenes/GameOverScene';
import { GameController } from './core/GameController';
import { WebPlatform } from './platform/WebPlatform';
import { IPlatform } from './platform/IPlatform';
import { setPlatform } from './platform';
import { GameConfig } from './types';

import ballLevels from './config/ballLevels.json';
import levelConfigs from './config/levelConfig.json';
import gameConfigData from './config/gameConfig.json';

const platform: IPlatform = new WebPlatform();
setPlatform(platform);
const screenSize = platform.getScreenSize();
const gameConfig: GameConfig = gameConfigData as GameConfig;

const gameController = new GameController(ballLevels, levelConfigs, gameConfig);

const phaserConfig: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  width: screenSize.width,
  height: screenSize.height,
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

const game = new Phaser.Game(phaserConfig);
// 手动注册且不自动启动：放进 config.scene 时第一个场景会在没有 data 的情况下先启动。
game.scene.add('MainScene', MainScene, false);
game.scene.add('UpgradeScene', UpgradeScene, false);
game.scene.add('GameOverScene', GameOverScene, false);

const sceneData = { gameController, gameConfig };
if (import.meta.env.DEV) {
  // 调试入口仅在开发构建中存在：window 全局、?stage=N 跳关、?scene=upgrade 直达升级页。
  Object.assign(window, { game, gameController, gameConfig });
  const urlParams = new URLSearchParams(window.location.search);
  const requestedStage = Number(urlParams.get('stage'));
  if (Number.isInteger(requestedStage) && requestedStage >= 1 && requestedStage <= levelConfigs.length) {
    for (let i = 1; i < requestedStage; i++) gameController.advanceLevel();
  }
  game.scene.start(urlParams.get('scene') === 'upgrade' ? 'UpgradeScene' : 'MainScene', sceneData);
} else {
  game.scene.start('MainScene', sceneData);
}

export { game, platform, gameController };
