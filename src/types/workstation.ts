/**
 * 工位系统类型定义
 */

export type ItemType = 'document' | 'coffee' | 'package' | 'keyboard' | 'mouse' | 'plant';
export type EmployeeType = 'intern' | 'junior' | 'senior' | 'lead' | 'manager';

export interface WorkstationItem {
  id: string;
  type: ItemType;
  level: number;
  createdAt: number;
}

export interface WorkstationEmployee {
  id: string;
  type: EmployeeType;
  level: number;
  producedCoins: number;
  lastCollectTime: number;
}

export interface DeskSlot {
  index: number;
  unlocked: boolean;
  occupied: boolean;
  content: WorkstationItem | WorkstationEmployee | null;
}

export interface BossInspection {
  triggeredAt: number;
  expiresAt: number;
  handled: boolean;
  reward: number;
}

export interface WorkstationState {
  coins: number;
  desks: DeskSlot[];
  inbox: WorkstationItem[];
  lastUpdateTime: number;
  totalItemsPlaced: number;
  totalMerges: number;
  bossInspection: BossInspection | null;
}

export interface WorkstationBonus {
  extraShotsAtStart: number;
  coinMultiplier: number;
}

export interface WorkstationConfig {
  initialDesks: number;
  maxDesks: number;
  deskUnlockCost: number[];
  maxInboxSize: number;
  
  itemLevels: {
    [key in ItemType]: {
      maxLevel: number;
      promotesTo?: EmployeeType;
    };
  };
  
  employeeProduction: {
    [key in EmployeeType]: {
      coinsPerHour: number;
    };
  };
  
  offlineProductionCap: number;
  
  bossInspection: {
    intervalMin: number;
    intervalMax: number;
    windowDuration: number;
    reward: number;
    penalty: number;
  };
  
  bonuses: {
    [key: string]: WorkstationBonus;
  };
}
