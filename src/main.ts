import Phaser from 'phaser';
import { MainScene } from './scenes/MainScene';
import { UpgradeScene } from './scenes/UpgradeScene';
import { GameOverScene } from './scenes/GameOverScene';
import { GameController } from './core/GameController';
import { WebPlatform } from './platform/WebPlatform';
import { IPlatform } from './platform/IPlatform';
import { GameConfig } from './types';

import ballLevels from './config/ballLevels.json';
import levelConfigs from './config/levelConfig.json';
import gameConfigData from './config/gameConfig.json';

const platform: IPlatform = new WebPlatform();
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
  scene: [MainScene, UpgradeScene, GameOverScene],
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH
  }
};

const game = new Phaser.Game(phaserConfig);

// Expose game globally for debug purposes
Object.assign(window, { game, gameController, gameConfig });

// Check for debug parameters
const urlParams = new URLSearchParams(window.location.search);
const debugScene = urlParams.get('scene');

if (debugScene === 'upgrade') {
  game.scene.start('UpgradeScene', { gameController, gameConfig });
} else {
  game.scene.start('MainScene', { gameController, gameConfig });
}

export { game, platform, gameController };
