import { describe, it, expect, beforeEach } from 'vitest';
import { WorkstationSystem, type Clock } from '../WorkstationSystem';
import type { WorkstationConfig } from '../../types/workstation';
import workstationConfig from '../../config/workstationConfig.json';

class MockClock implements Clock {
  private time = 0;

  now(): number {
    return this.time;
  }

  advance(ms: number): void {
    this.time += ms;
  }

  setTime(time: number): void {
    this.time = time;
  }
}

describe('WorkstationSystem', () => {
  let system: WorkstationSystem;
  let clock: MockClock;
  let config: WorkstationConfig;

  beforeEach(() => {
    clock = new MockClock();
    config = workstationConfig as WorkstationConfig;
    system = new WorkstationSystem(config, clock);
  });

  describe('initialization', () => {
    it('should initialize with correct desk count', () => {
      const state = system.getState();
      expect(state.desks.length).toBe(config.maxDesks);
      expect(state.desks.filter(d => d.unlocked).length).toBe(config.initialDesks);
    });

    it('should start with zero coins and empty inbox', () => {
      const state = system.getState();
      expect(state.coins).toBe(0);
      expect(state.inbox).toEqual([]);
    });
  });

  describe('item management', () => {
    it('should add items to inbox', () => {
      const success = system.addItemToInbox('document', 1);
      expect(success).toBe(true);
      expect(system.getState().inbox.length).toBe(1);
      expect(system.getState().inbox[0].type).toBe('document');
    });

    it('should reject items when inbox is full', () => {
      for (let i = 0; i < config.maxInboxSize; i++) {
        system.addItemToInbox('document', 1);
      }
      const overflow = system.addItemToInbox('document', 1);
      expect(overflow).toBe(false);
      expect(system.getState().inbox.length).toBe(config.maxInboxSize);
    });

    it('should place items from inbox onto desks', () => {
      system.addItemToInbox('document', 1);
      const itemId = system.getState().inbox[0].id;
      
      const success = system.placeItemOnDesk(itemId, 0);
      expect(success).toBe(true);
      expect(system.getState().inbox.length).toBe(0);
      expect(system.getState().desks[0].occupied).toBe(true);
    });

    it('should reject placement on locked desks', () => {
      system.addItemToInbox('document', 1);
      const itemId = system.getState().inbox[0].id;
      
      const lockedIndex = config.initialDesks;
      const success = system.placeItemOnDesk(itemId, lockedIndex);
      expect(success).toBe(false);
    });

    it('should reject placement on occupied desks', () => {
      system.addItemToInbox('document', 1);
      system.addItemToInbox('coffee', 1);
      
      const item1Id = system.getState().inbox[0].id;
      const item2Id = system.getState().inbox[0].id;
      
      system.placeItemOnDesk(item1Id, 0);
      const success = system.placeItemOnDesk(item2Id, 0);
      expect(success).toBe(false);
    });
  });

  describe('merging', () => {
    it('merges from the inbox even when every unlocked desk is occupied', () => {
      for (let i = 0; i < config.initialDesks; i++) {
        system.addItemToInbox('document', 1);
        system.placeItemOnDesk(system.getState().inbox[0].id, i);
      }
      system.addItemToInbox('document', 1);
      const itemId = system.getState().inbox[0].id;

      expect(system.mergeItemFromInbox(itemId, 0)).toBe(true);
      expect(system.getState().inbox).toEqual([]);
      expect(system.getState().desks[0].content).toMatchObject({ type: 'document', level: 2 });
      expect(system.getAvailableDesks()).toBe(0);
      expect(system.getState().totalMerges).toBe(1);
    });

    it('promotes an inbox item on the destination desk', () => {
      system.addItemToInbox('coffee', 5);
      system.placeItemOnDesk(system.getState().inbox[0].id, 0);
      system.addItemToInbox('coffee', 5);

      expect(system.mergeItemFromInbox(system.getState().inbox[0].id, 0)).toBe(true);
      expect(system.getState().desks[0].content).toMatchObject({ type: 'junior', producedCoins: 0 });
      expect(system.getState().inbox).toEqual([]);
    });

    it('preserves both items when an inbox merge is incompatible or locked', () => {
      system.addItemToInbox('document', 1);
      system.placeItemOnDesk(system.getState().inbox[0].id, 0);
      system.addItemToInbox('coffee', 1);
      const itemId = system.getState().inbox[0].id;
      const saved = system.serialize();

      expect(system.mergeItemFromInbox(itemId, 0)).toBe(false);
      expect(system.mergeItemFromInbox(itemId, config.initialDesks)).toBe(false);
      expect(system.mergeItemFromInbox('missing', 0)).toBe(false);
      expect(system.serialize()).toBe(saved);
    });

    it('rejects merging a desk with itself without changing its item', () => {
      system.addItemToInbox('document', 1);
      system.placeItemOnDesk(system.getState().inbox[0].id, 0);
      const saved = system.serialize();

      expect(system.mergeItems(0, 0)).toBe(false);
      expect(system.serialize()).toBe(saved);
    });

    it('should merge two identical items of same level', () => {
      system.addItemToInbox('document', 1);
      system.addItemToInbox('document', 1);
      
      const item1Id = system.getState().inbox[0].id;
      const item2Id = system.getState().inbox[1].id;
      
      system.placeItemOnDesk(item1Id, 0);
      system.placeItemOnDesk(item2Id, 1);
      
      const success = system.mergeItems(0, 1);
      expect(success).toBe(true);
      
      const state = system.getState();
      expect(state.desks[0].occupied).toBe(true);
      expect(state.desks[1].occupied).toBe(false);
      expect((state.desks[0].content as any).level).toBe(2);
      expect(state.totalMerges).toBe(1);
    });

    it('should reject merging different types', () => {
      system.addItemToInbox('document', 1);
      system.addItemToInbox('coffee', 1);
      
      const item1Id = system.getState().inbox[0].id;
      const item2Id = system.getState().inbox[1].id;
      
      system.placeItemOnDesk(item1Id, 0);
      system.placeItemOnDesk(item2Id, 1);
      
      const success = system.mergeItems(0, 1);
      expect(success).toBe(false);
    });

    it('should reject merging different levels', () => {
      system.addItemToInbox('document', 1);
      system.addItemToInbox('document', 2);
      
      const item1Id = system.getState().inbox[0].id;
      const item2Id = system.getState().inbox[1].id;
      
      system.placeItemOnDesk(item1Id, 0);
      system.placeItemOnDesk(item2Id, 1);
      
      const success = system.mergeItems(0, 1);
      expect(success).toBe(false);
    });

    it('should promote max-level items to employees', () => {
      system.addItemToInbox('document', 5);
      system.addItemToInbox('document', 5);
      
      const item1Id = system.getState().inbox[0].id;
      const item2Id = system.getState().inbox[1].id;
      
      system.placeItemOnDesk(item1Id, 0);
      system.placeItemOnDesk(item2Id, 1);
      
      const success = system.mergeItems(0, 1);
      expect(success).toBe(true);
      
      const state = system.getState();
      const content = state.desks[0].content as any;
      expect('producedCoins' in content).toBe(true);
      expect(content.type).toBe('intern');
    });
  });

  describe('employee production', () => {
    it('preserves fractional production when collecting whole coins', () => {
      system.addItemToInbox('document', 5);
      system.addItemToInbox('document', 5);
      system.placeItemOnDesk(system.getState().inbox[0].id, 0);
      system.mergeItemFromInbox(system.getState().inbox[0].id, 0);
      clock.advance(540000); // 实习生 9 分钟产出 1.5 币。
      system.update();
      expect(system.collectCoins(0)).toBe(1);
      const employee = system.getState().desks[0].content;
      if (!employee || !('producedCoins' in employee)) throw new Error('Missing employee');
      expect(employee.producedCoins).toBeCloseTo(0.5);
      clock.advance(180000);
      system.update();
      expect(system.collectCoins(0)).toBe(1);
      expect(employee.producedCoins).toBeCloseTo(0);
    });

    it('should produce coins over time', () => {
      system.addItemToInbox('document', 5);
      system.addItemToInbox('document', 5);
      
      const item1Id = system.getState().inbox[0].id;
      const item2Id = system.getState().inbox[1].id;
      
      system.placeItemOnDesk(item1Id, 0);
      system.placeItemOnDesk(item2Id, 1);
      system.mergeItems(0, 1);
      
      clock.advance(3600000); // 1 hour
      system.update();
      
      const employee = system.getState().desks[0].content as any;
      expect(employee.producedCoins).toBeGreaterThan(0);
    });

    it('should cap offline production', () => {
      system.addItemToInbox('document', 5);
      system.addItemToInbox('document', 5);
      
      const item1Id = system.getState().inbox[0].id;
      const item2Id = system.getState().inbox[1].id;
      
      system.placeItemOnDesk(item1Id, 0);
      system.placeItemOnDesk(item2Id, 1);
      system.mergeItems(0, 1);
      
      clock.advance(86400000); // 24 hours
      system.update();
      
      const employee = system.getState().desks[0].content as any;
      const maxProduction = (config.employeeProduction.intern.coinsPerHour / 3600000) * config.offlineProductionCap;
      expect(employee.producedCoins).toBeLessThanOrEqual(maxProduction * 1.1);
    });

    it('should collect coins from employee', () => {
      system.addItemToInbox('document', 5);
      system.addItemToInbox('document', 5);
      
      const item1Id = system.getState().inbox[0].id;
      const item2Id = system.getState().inbox[1].id;
      
      system.placeItemOnDesk(item1Id, 0);
      system.placeItemOnDesk(item2Id, 1);
      system.mergeItems(0, 1);
      
      clock.advance(3600000);
      system.update();
      
      const collected = system.collectCoins(0);
      expect(collected).toBeGreaterThan(0);
      expect(system.getState().coins).toBe(collected);
      
      const employee = system.getState().desks[0].content as any;
      expect(employee.producedCoins).toBe(0);
    });
  });

  describe('desk unlocking', () => {
    it('should unlock next desk for coins', () => {
      const cost = system.getNextUnlockCost();
      expect(cost).toBe(config.deskUnlockCost[0]);
      
      system.getState().coins = cost!;
      const success = system.unlockDesk();
      
      expect(success).toBe(true);
      expect(system.getState().desks[config.initialDesks].unlocked).toBe(true);
      expect(system.getState().coins).toBe(0);
    });

    it('should reject unlock without enough coins', () => {
      system.getState().coins = 10;
      const success = system.unlockDesk();
      expect(success).toBe(false);
    });

    it('should return null cost when all desks unlocked', () => {
      for (let i = 0; i < config.maxDesks; i++) {
        system.getState().desks[i].unlocked = true;
      }
      
      const cost = system.getNextUnlockCost();
      expect(cost).toBeNull();
    });
  });

  describe('boss inspection', () => {
    it('should handle boss inspection within window', () => {
      clock.advance(config.bossInspection.intervalMax + 300000);
      system.update();
      
      expect(system.getState().bossInspection).not.toBeNull();
      
      const success = system.handleBossInspection();
      expect(success).toBe(true);
      expect(system.getState().coins).toBe(config.bossInspection.reward);
      expect(system.getState().bossInspection).toBeNull();
    });

    it('should reject handling outside window', () => {
      clock.advance(config.bossInspection.intervalMax + 300000);
      system.update();

      expect(system.getState().bossInspection).not.toBeNull();
      
      clock.advance(config.bossInspection.windowDuration + 1000);
      
      const success = system.handleBossInspection();
      expect(success).toBe(false);
    });
  });

  describe('bonuses', () => {
    it('should calculate bonuses from employees', () => {
      system.addItemToInbox('coffee', 5);
      system.addItemToInbox('coffee', 5);
      
      const item1Id = system.getState().inbox[0].id;
      const item2Id = system.getState().inbox[1].id;
      
      system.placeItemOnDesk(item1Id, 0);
      system.placeItemOnDesk(item2Id, 1);
      system.mergeItems(0, 1);
      
      const bonus = system.calculateBonuses();
      expect(bonus.extraShotsAtStart).toBeGreaterThan(0);
      expect(bonus.coinMultiplier).toBeGreaterThan(1.0);
    });

    it('should return base bonus with no employees', () => {
      const bonus = system.calculateBonuses();
      expect(bonus.extraShotsAtStart).toBe(0);
      expect(bonus.coinMultiplier).toBe(1.0);
    });
  });

  describe('serialization', () => {
    it('should serialize and deserialize state', () => {
      system.addItemToInbox('document', 1);
      system.getState().coins = 100;
      
      const serialized = system.serialize();
      const restored = WorkstationSystem.deserialize(serialized, config, clock);
      
      expect(restored.getState().coins).toBe(100);
      expect(restored.getState().inbox.length).toBe(1);
    });
  });

  describe('utility methods', () => {
    it('should detect full desks', () => {
      for (let i = 0; i < config.initialDesks; i++) {
        system.addItemToInbox('document', 1);
        const itemId = system.getState().inbox[0].id;
        system.placeItemOnDesk(itemId, i);
      }
      
      expect(system.hasFullDesks()).toBe(true);
    });

    it('should count available desks', () => {
      const available = system.getAvailableDesks();
      expect(available).toBe(config.initialDesks);
      
      system.addItemToInbox('document', 1);
      const itemId = system.getState().inbox[0].id;
      system.placeItemOnDesk(itemId, 0);
      
      expect(system.getAvailableDesks()).toBe(config.initialDesks - 1);
    });

    it('should remove items from desk', () => {
      system.addItemToInbox('document', 1);
      const itemId = system.getState().inbox[0].id;
      system.placeItemOnDesk(itemId, 0);
      
      const success = system.removeFromDesk(0);
      expect(success).toBe(true);
      expect(system.getState().desks[0].occupied).toBe(false);
    });
  });
});
