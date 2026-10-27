import { boot, levelCount } from './boot';
import { WebPlatform } from './platform/WebPlatform';

const platform = new WebPlatform();

async function start() {
  const result = await boot({ platform, layout: 'fit', parent: 'game-container' });
  const { game, gameController, gameConfig, renderScale } = result;
  const urlParams = new URLSearchParams(window.location.search);
  const afterimageMode = urlParams.get('mode') === 'afterimage';
  
  if (import.meta.env.DEV) {
    // 调试入口仅在开发构建中存在：window 全局、?stage=N 跳关、?scene=upgrade 直达升级页、?mode=afterimage 残影模式。
    Object.assign(window, { 
      game, 
      gameController, 
      gameConfig, 
      renderScale,
      __bm: {
        fire: (angle: number = Math.PI / 2) => {
          const scene = game.scene.scenes.find((s: any) => s.scene.key === 'MainScene' && s.scene.isActive());
          console.log('[__bm.fire] scene=', scene?.scene?.key, ', hasDebugFire=', typeof (scene as any)?.debugFire);
          if (scene && typeof (scene as any).debugFire === 'function') {
            (scene as any).debugFire(angle);
          } else {
            console.log('[__bm.fire] No active MainScene or debugFire not found');
          }
        }
      }
    });
    const requestedStage = Number(urlParams.get('stage'));
    const skip = Number.isInteger(requestedStage) && requestedStage >= 1 && requestedStage <= levelCount ? requestedStage - 1 : 0;
    
    // URL参数优先级：?scene > ?mode > ?stage，默认主屏幕
    if (urlParams.get('scene') === 'upgrade') {
      console.log('[DEV] Starting UpgradeScene, afterimage=', afterimageMode);
      result.startScene('UpgradeScene', skip, afterimageMode);
    } else if (afterimageMode || urlParams.has('stage')) {
      // ?mode=afterimage 或 ?stage=N 直接进入游戏
      console.log('[DEV] Starting MainScene, afterimageMode=', afterimageMode, ', skip=', skip);
      result.startScene('MainScene', skip, afterimageMode);
    } else {
      console.log('[DEV] Starting HomeScene');
      result.startScene('HomeScene');
    }
  } else {
    // 生产环境：默认主屏幕
    result.startScene('HomeScene');
  }
  return game;
}

export const gameReady = start();
export { platform };
