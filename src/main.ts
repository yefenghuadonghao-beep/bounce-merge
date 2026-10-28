import './boot';

// Dev utility for seeding workstation state
if (import.meta.env.DEV) {
  (window as any).__bm = {
    async seedWorkstation() {
      const { WorkstationManager } = await import('./core/WorkstationManager');
      const { getPlatform } = await import('./platform');
      const manager = WorkstationManager.getInstance(getPlatform());
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
  };
}
