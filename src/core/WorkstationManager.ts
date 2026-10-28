/**
 * Global workstation manager - singleton for loading/saving state across scenes
 */
import { WorkstationSystem, type Clock } from './WorkstationSystem';
import type { WorkstationConfig, ItemType } from '../types/workstation';
import type { IPlatform } from '../platform/IPlatform';
import workstationConfig from '../config/workstationConfig.json';
import { completeJourneyStage, ensureJourney, type StageCompletion, type StageReward } from './JourneyProgress';

const STORAGE_KEY = 'workstation_state';

class PlatformClock implements Clock {
  constructor(private platform: IPlatform) {}
  now(): number {
    return this.platform.getCurrentTime();
  }
}

export class WorkstationManager {
  private static instance: WorkstationManager | null = null;
  private system: WorkstationSystem | null = null;
  private platform: IPlatform;
  private clock: Clock;
  private config: WorkstationConfig;
  private loading?: Promise<WorkstationSystem>;
  private operations: Promise<unknown> = Promise.resolve();

  private constructor(platform: IPlatform) {
    this.platform = platform;
    this.clock = new PlatformClock(platform);
    this.config = workstationConfig as WorkstationConfig;
  }

  static getInstance(platform: IPlatform): WorkstationManager {
    if (!WorkstationManager.instance) {
      WorkstationManager.instance = new WorkstationManager(platform);
    }
    return WorkstationManager.instance;
  }

  async getSystem(): Promise<WorkstationSystem> {
    if (this.system) {
      this.system.update();
      return this.system;
    }

    this.loading ??= this.loadSystem();
    try {
      return await this.loading;
    } finally {
      this.loading = undefined;
    }
  }

  private async loadSystem(): Promise<WorkstationSystem> {
    const savedData = await this.platform.loadData(STORAGE_KEY);
    if (savedData) {
      this.system = WorkstationSystem.deserialize(savedData, this.config, this.clock);
    } else {
      this.system = new WorkstationSystem(this.config, this.clock);
      // Give new players starter items
      this.addStarterItems();
    }
    
    ensureJourney(this.system.getState());
    this.system.update();
    return this.system;
  }
  
  private addStarterItems() {
    if (!this.system) return;
    // Give new players a starter set to demonstrate the system
    this.system.addItemToInbox('document', 1);
    this.system.addItemToInbox('document', 1);
    this.system.addItemToInbox('coffee', 1);
  }

  async save(): Promise<void> {
    return this.enqueue(async () => {
      if (!this.system) return;
      await this.platform.saveData(STORAGE_KEY, this.system.serialize());
    });
  }

  async addRewardItems(items: { type: ItemType; level: number }[]): Promise<void> {
    return this.changeAndSave(system => {
      for (let i = 0; i < items.length; i++) system.addItemToInbox(items[i].type, items[i].level);
    });
  }

  completeStage(completion: StageCompletion): Promise<StageReward> {
    return this.changeAndSave(system => completeJourneyStage(system.getState(), completion));
  }

  claimStageRewards(): Promise<{ claimed: number; remaining: number }> {
    return this.changeAndSave(system => {
      const journey = ensureJourney(system.getState());
      let claimed = 0;
      let remaining = 0;
      const pending = journey.pendingRewards;
      for (let i = 0; i < pending.length; i++) {
        const items = pending[i].items;
        let transferred = 0;
        while (transferred < items.length && system.addItemToInbox(items[transferred].type, items[transferred].level)) transferred++;
        items.splice(0, transferred);
        claimed += transferred;
        remaining += items.length;
      }
      journey.pendingRewards = pending.filter(reward => reward.items.length > 0);
      return { claimed, remaining };
    });
  }

  // 奖励、领取和普通保存排队写入，避免快速切场景时旧快照覆盖新奖励。
  private enqueue<T>(operation: () => Promise<T>): Promise<T> {
    const result = this.operations.then(operation);
    this.operations = result.catch(() => undefined);
    return result;
  }

  private changeAndSave<T>(change: (system: WorkstationSystem) => T): Promise<T> {
    return this.enqueue(async () => {
      const system = await this.getSystem();
      const snapshot = system.serialize();
      try {
        const result = change(system);
        await this.platform.saveData(STORAGE_KEY, system.serialize());
        return result;
      } catch (error) {
        const restored = WorkstationSystem.deserialize(snapshot, this.config, this.clock);
        Object.assign(system.getState(), restored.getState());
        throw error;
      }
    });
  }
}
