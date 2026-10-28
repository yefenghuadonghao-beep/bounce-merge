/**
 * Global workstation manager - singleton for loading/saving state across scenes
 */
import { WorkstationSystem, type Clock } from './WorkstationSystem';
import type { WorkstationConfig, ItemType } from '../types/workstation';
import type { IPlatform } from '../platform/IPlatform';
import workstationConfig from '../config/workstationConfig.json';

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

    const savedData = await this.platform.loadData(STORAGE_KEY);
    if (savedData) {
      this.system = WorkstationSystem.deserialize(savedData, this.config, this.clock);
    } else {
      this.system = new WorkstationSystem(this.config, this.clock);
    }
    
    this.system.update();
    return this.system;
  }

  async save(): Promise<void> {
    if (!this.system) return;
    const serialized = this.system.serialize();
    await this.platform.saveData(STORAGE_KEY, serialized);
  }

  async addRewardItems(items: { type: ItemType; level: number }[]): Promise<void> {
    const system = await this.getSystem();
    for (const item of items) {
      system.addItemToInbox(item.type, item.level);
    }
    await this.save();
  }
}
