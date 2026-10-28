import type {
  WorkstationState,
  WorkstationConfig,
  WorkstationItem,
  WorkstationEmployee,
  DeskSlot,
  WorkstationBonus,
  ItemType,
  EmployeeType
} from '../types/workstation';

export interface Clock {
  now(): number;
}

export class WorkstationSystem {
  private state: WorkstationState;
  private config: WorkstationConfig;
  private clock: Clock;
  private nextBossInspectionTime: number = 0;

  constructor(config: WorkstationConfig, clock: Clock, initialState?: WorkstationState) {
    this.config = config;
    this.clock = clock;
    
    if (initialState) {
      this.state = initialState;
    } else {
      const desks: DeskSlot[] = [];
      for (let i = 0; i < config.maxDesks; i++) {
        desks.push({
          index: i,
          unlocked: i < config.initialDesks,
          occupied: false,
          content: null
        });
      }
      
      this.state = {
        coins: 0,
        desks,
        inbox: [],
        lastUpdateTime: clock.now(),
        totalItemsPlaced: 0,
        totalMerges: 0,
        bossInspection: null
      };
      
      this.scheduleNextBossInspection();
    }
  }

  getState(): WorkstationState {
    return this.state;
  }

  serialize(): string {
    return JSON.stringify({
      state: this.state,
      nextBossInspectionTime: this.nextBossInspectionTime
    });
  }

  static deserialize(data: string, config: WorkstationConfig, clock: Clock): WorkstationSystem {
    const parsed = JSON.parse(data);
    const system = new WorkstationSystem(config, clock, parsed.state);
    system.nextBossInspectionTime = parsed.nextBossInspectionTime || 0;
    return system;
  }

  update(): void {
    const now = this.clock.now();
    const deltaMs = now - this.state.lastUpdateTime;
    
    if (deltaMs <= 0) return;
    
    // Cap offline production
    const productionDelta = Math.min(deltaMs, this.config.offlineProductionCap);
    
    // Calculate production from all employees
    let totalProduced = 0;
    for (const desk of this.state.desks) {
      if (desk.occupied && desk.content && 'producedCoins' in desk.content) {
        const employee = desk.content as WorkstationEmployee;
        const production = this.config.employeeProduction[employee.type];
        if (production) {
          const produced = (production.coinsPerHour / 3600000) * productionDelta;
          employee.producedCoins += produced;
          totalProduced += produced;
        }
      }
    }
    
    this.state.lastUpdateTime = now;
    
    // Check for boss inspection
    if (!this.state.bossInspection && now >= this.nextBossInspectionTime) {
      this.triggerBossInspection();
    } else if (this.state.bossInspection && now > this.state.bossInspection.expiresAt && !this.state.bossInspection.handled) {
      // Inspection expired
      this.state.coins = Math.max(0, this.state.coins + this.config.bossInspection.penalty);
      this.state.bossInspection = null;
      this.scheduleNextBossInspection();
    }
  }

  private scheduleNextBossInspection(): void {
    const now = this.clock.now();
    const min = this.config.bossInspection.intervalMin;
    const max = this.config.bossInspection.intervalMax;
    const interval = min + Math.random() * (max - min);
    this.nextBossInspectionTime = now + interval;
  }

  private triggerBossInspection(): void {
    const now = this.clock.now();
    this.state.bossInspection = {
      triggeredAt: now,
      expiresAt: now + this.config.bossInspection.windowDuration,
      handled: false,
      reward: this.config.bossInspection.reward
    };
  }

  handleBossInspection(): boolean {
    if (!this.state.bossInspection || this.state.bossInspection.handled) {
      return false;
    }
    
    const now = this.clock.now();
    if (now > this.state.bossInspection.expiresAt) {
      return false;
    }
    
    this.state.coins += this.state.bossInspection.reward;
    this.state.bossInspection.handled = true;
    this.state.bossInspection = null;
    this.scheduleNextBossInspection();
    return true;
  }

  addItemToInbox(type: ItemType, level: number = 1): boolean {
    if (this.state.inbox.length >= this.config.maxInboxSize) {
      return false;
    }
    
    const item: WorkstationItem = {
      id: `item_${Date.now()}_${Math.random()}`,
      type,
      level,
      createdAt: this.clock.now()
    };
    
    this.state.inbox.push(item);
    return true;
  }

  placeItemOnDesk(itemId: string, deskIndex: number): boolean {
    const desk = this.state.desks[deskIndex];
    if (!desk || !desk.unlocked || desk.occupied) {
      return false;
    }
    
    const itemIndex = this.state.inbox.findIndex(i => i.id === itemId);
    if (itemIndex === -1) {
      return false;
    }
    
    const item = this.state.inbox[itemIndex];
    this.state.inbox.splice(itemIndex, 1);
    
    desk.content = item;
    desk.occupied = true;
    this.state.totalItemsPlaced++;
    
    return true;
  }

  mergeItems(deskIndex1: number, deskIndex2: number): boolean {
    const desk1 = this.state.desks[deskIndex1];
    const desk2 = this.state.desks[deskIndex2];
    
    if (!desk1 || !desk2 || !desk1.occupied || !desk2.occupied) {
      return false;
    }
    
    const item1 = desk1.content as WorkstationItem;
    const item2 = desk2.content as WorkstationItem;
    
    // Can only merge items (not employees) of same type and level
    if (!item1 || !item2 || 'producedCoins' in item1 || 'producedCoins' in item2) {
      return false;
    }
    
    if (item1.type !== item2.type || item1.level !== item2.level) {
      return false;
    }
    
    const itemConfig = this.config.itemLevels[item1.type];
    if (!itemConfig) {
      return false;
    }
    
    // Check if this is max level and should promote to employee
    if (item1.level >= itemConfig.maxLevel && itemConfig.promotesTo) {
      const employee: WorkstationEmployee = {
        id: `emp_${Date.now()}_${Math.random()}`,
        type: itemConfig.promotesTo,
        level: 1,
        producedCoins: 0,
        lastCollectTime: this.clock.now()
      };
      
      desk1.content = employee;
      desk2.content = null;
      desk2.occupied = false;
    } else if (item1.level < itemConfig.maxLevel) {
      // Merge to next level
      item1.level++;
      desk2.content = null;
      desk2.occupied = false;
    } else {
      return false;
    }
    
    this.state.totalMerges++;
    return true;
  }

  removeFromDesk(deskIndex: number): boolean {
    const desk = this.state.desks[deskIndex];
    if (!desk || !desk.occupied) {
      return false;
    }
    
    desk.content = null;
    desk.occupied = false;
    return true;
  }

  collectCoins(deskIndex: number): number {
    const desk = this.state.desks[deskIndex];
    if (!desk || !desk.occupied || !desk.content) {
      return 0;
    }
    
    if (!('producedCoins' in desk.content)) {
      return 0;
    }
    
    const employee = desk.content as WorkstationEmployee;
    const coins = Math.floor(employee.producedCoins);
    
    if (coins > 0) {
      this.state.coins += coins;
      employee.producedCoins = 0;
      employee.lastCollectTime = this.clock.now();
    }
    
    return coins;
  }

  collectAllCoins(): number {
    let total = 0;
    for (let i = 0; i < this.state.desks.length; i++) {
      total += this.collectCoins(i);
    }
    return total;
  }

  unlockDesk(): boolean {
    const nextLockedIndex = this.state.desks.findIndex(d => !d.unlocked);
    if (nextLockedIndex === -1) {
      return false;
    }
    
    const costIndex = nextLockedIndex - this.config.initialDesks;
    const cost = this.config.deskUnlockCost[costIndex];
    
    if (!cost || this.state.coins < cost) {
      return false;
    }
    
    this.state.coins -= cost;
    this.state.desks[nextLockedIndex].unlocked = true;
    return true;
  }

  getNextUnlockCost(): number | null {
    const nextLockedIndex = this.state.desks.findIndex(d => !d.unlocked);
    if (nextLockedIndex === -1) {
      return null;
    }
    
    const costIndex = nextLockedIndex - this.config.initialDesks;
    return this.config.deskUnlockCost[costIndex] || null;
  }

  calculateBonuses(): WorkstationBonus {
    const bonus: WorkstationBonus = {
      extraShotsAtStart: 0,
      coinMultiplier: 1.0
    };
    
    const employeeTypes = new Set<EmployeeType>();
    for (const desk of this.state.desks) {
      if (desk.occupied && desk.content && 'producedCoins' in desk.content) {
        const employee = desk.content as WorkstationEmployee;
        employeeTypes.add(employee.type);
      }
    }
    
    // Apply highest tier bonus
    const tiers: EmployeeType[] = ['manager', 'lead', 'senior', 'junior', 'intern'];
    for (const tier of tiers) {
      if (employeeTypes.has(tier)) {
        const key = `has${tier.charAt(0).toUpperCase() + tier.slice(1)}` as keyof typeof this.config.bonuses;
        const tierBonus = this.config.bonuses[key];
        if (tierBonus) {
          bonus.extraShotsAtStart = Math.max(bonus.extraShotsAtStart, tierBonus.extraShotsAtStart);
          bonus.coinMultiplier = Math.max(bonus.coinMultiplier, tierBonus.coinMultiplier);
        }
        break;
      }
    }
    
    return bonus;
  }

  hasFullDesks(): boolean {
    return this.state.desks.every(d => !d.unlocked || d.occupied);
  }

  getAvailableDesks(): number {
    return this.state.desks.filter(d => d.unlocked && !d.occupied).length;
  }
}
