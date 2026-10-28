import { boot } from './boot';
import { WebPlatform } from './platform/WebPlatform';

const platform = new WebPlatform();

async function start() {
  const result = await boot({ platform, layout: 'fit', parent: 'game-container' });
  const urlParams = new URLSearchParams(window.location.search);
  
  if (import.meta.env.DEV) {
    // Dev utilities
    Object.assign(window, { 
      game: result.game, 
      gameController: result.gameController, 
      gameConfig: result.gameConfig, 
      renderScale: result.renderScale,
      __bm: {
        async seedWorkstation() {
          const { WorkstationManager } = await import('./core/WorkstationManager');
          const { getPlatform } = await import('./platform');
          const manager = WorkstationManager.getInstance(getPlatform());
          const system = await manager.getSystem();
          
          system.addItemToInbox('document', 1);
          system.addItemToInbox('document', 3);
          system.addItemToInbox('coffee', 2);
          system.addItemToInbox('package', 1);
          system.addItemToInbox('keyboard', 2);
          
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
          
          system.addItemToInbox('document', 5);
          system.addItemToInbox('document', 5);
          if (state.inbox.length >= 2) {
            const item1 = state.inbox[0].id;
            const item2 = state.inbox[1].id;
            system.placeItemOnDesk(item1, 3);
            system.placeItemOnDesk(item2, 4);
            system.mergeItems(3, 4);
          }
          
          system.addItemToInbox('coffee', 5);
          system.addItemToInbox('coffee', 5);
          if (state.inbox.length >= 2) {
            const item1 = state.inbox[0].id;
            const item2 = state.inbox[1].id;
            system.placeItemOnDesk(item1, 5);
            system.placeItemOnDesk(item2, 3);
            system.mergeItems(5, 3);
          }
          
          state.coins = 250;
          await manager.save();
          console.log('Workstation seeded! Refresh to see changes.');
        }
      }
    });
  }
  
  // Start with HomeScene  
  result.startScene('HomeScene');
}

start();
