import { boot, levelCount } from './boot';
import { WebPlatform } from './platform/WebPlatform';
import { MainScene } from './scenes/MainScene';
import { WorkstationManager } from './core/WorkstationManager';

const platform = new WebPlatform();

async function start() {
  const result = await boot({ platform, layout: 'fit', parent: 'game-container' });
  const { game, gameController, gameConfig, renderScale } = result;
  const urlParams = new URLSearchParams(window.location.search);
  const afterimageMode = urlParams.get('mode') === 'afterimage';

  if (import.meta.env.DEV) {
    Object.assign(window, {
      game,
      gameController,
      gameConfig,
      renderScale,
      __bm: {
        seedWorkstation,
        fire: (angle: number = Math.PI / 2) => {
          const scene = game.scene.getScene('MainScene');
          if (scene instanceof MainScene && scene.scene.isActive()) scene.debugFire(angle);
        }
      }
    });
    const requestedStage = Number(urlParams.get('stage'));
    const skip = Number.isInteger(requestedStage) && requestedStage >= 1 && requestedStage <= levelCount ? requestedStage - 1 : 0;

    // 开发入口保留跳关、战术页和残影模式。
    if (urlParams.get('scene') === 'upgrade') {
      result.startScene('UpgradeScene', skip, afterimageMode);
    } else if (afterimageMode || urlParams.has('stage')) {
      result.startScene('MainScene', skip, afterimageMode);
    } else {
      result.startScene('HomeScene');
    }
  } else {
    result.startScene('HomeScene');
  }
  return game;
}

export const gameReady = start();
export { platform };

// Dev utility for seeding workstation state
async function seedWorkstation() {
  const manager = WorkstationManager.getInstance(platform);
  const system = await manager.getSystem();

  // Add varied items
  system.addItemToInbox('document', 1);
  system.addItemToInbox('document', 3);
  system.addItemToInbox('coffee', 2);
  system.addItemToInbox('package', 1);
  system.addItemToInbox('keyboard', 2);

  // Place some items on desks
  const state = system.getState();
  if (state.inbox.length > 0) {
    system.placeItemOnDesk(state.inbox[0].id, 0);
  }
  if (state.inbox.length > 1) {
    system.placeItemOnDesk(state.inbox[0].id, 1);
  }
  if (state.inbox.length > 2) {
    system.placeItemOnDesk(state.inbox[0].id, 2);
  }

  // Create employees by merging high-level items
  system.addItemToInbox('document', 5);
  system.addItemToInbox('document', 5);
  if (state.inbox.length >= 2) {
    const item1 = state.inbox[0].id;
    const item2 = state.inbox[1].id;
    system.placeItemOnDesk(item1, 3);
    system.placeItemOnDesk(item2, 4);
    system.mergeItems(3, 4); // Creates intern
  }

  system.addItemToInbox('coffee', 5);
  system.addItemToInbox('coffee', 5);
  if (state.inbox.length >= 2) {
    const item1 = state.inbox[0].id;
    const item2 = state.inbox[1].id;
    system.placeItemOnDesk(item1, 5);
    system.placeItemOnDesk(item2, 3);
    system.mergeItems(5, 3); // Creates junior
  }

  // Give some coins
  state.coins = 250;

  await manager.save();
  console.log('Workstation seeded! Refresh to see changes.');
}
