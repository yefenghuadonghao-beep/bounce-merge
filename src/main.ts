import { boot, levelCount } from './boot';
import { WebPlatform } from './platform/WebPlatform';

const platform = new WebPlatform();

async function start() {
  const result = await boot({ platform, layout: 'fit', parent: 'game-container' });
  const { game, gameController, gameConfig, renderScale } = result;
  if (import.meta.env.DEV) {
    // 调试入口仅在开发构建中存在：window 全局、?stage=N 跳关、?scene=upgrade 直达升级页。
    Object.assign(window, { game, gameController, gameConfig, renderScale });
    const urlParams = new URLSearchParams(window.location.search);
    const requestedStage = Number(urlParams.get('stage'));
    const skip = Number.isInteger(requestedStage) && requestedStage >= 1 && requestedStage <= levelCount ? requestedStage - 1 : 0;
    result.startScene(urlParams.get('scene') === 'upgrade' ? 'UpgradeScene' : 'MainScene', skip);
  } else {
    result.startScene('MainScene');
  }
  return game;
}

export const gameReady = start();
export { platform };
