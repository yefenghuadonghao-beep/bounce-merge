import Phaser from 'phaser';
import { WorkstationSystem, type Clock } from '../core/WorkstationSystem';
import type { WorkstationConfig, WorkstationItem, WorkstationEmployee } from '../types/workstation';
import workstationConfig from '../config/workstationConfig.json';
import { getPlatform } from '../platform';
import { FONT_FAMILY, ink, panel, paper } from '../ui/theme';

const STORAGE_KEY = 'workstation_state';

class PlatformClock implements Clock {
  constructor(private platform: ReturnType<typeof getPlatform>) {}
  now(): number {
    return this.platform.getCurrentTime();
  }
}

export class WorkstationScene extends Phaser.Scene {
  private system!: WorkstationSystem;
  private config!: WorkstationConfig;
  private platform = getPlatform();
  private clock = new PlatformClock(this.platform);
  
  private deskGraphics: Map<number, Phaser.GameObjects.Container> = new Map();
  private inboxGraphics: Phaser.GameObjects.Container[] = [];
  private coinsText!: Phaser.GameObjects.Text;
  private unlockButton?: Phaser.GameObjects.Container;
  private bossInspectionUI?: Phaser.GameObjects.Container;
  
  private draggedItem: { itemId: string; graphics: Phaser.GameObjects.Container } | null = null;

  constructor() {
    super({ key: 'WorkstationScene' });
  }

  async create() {
    this.config = workstationConfig as WorkstationConfig;
    
    // Load saved state
    const savedData = await this.platform.loadData(STORAGE_KEY);
    if (savedData) {
      this.system = WorkstationSystem.deserialize(savedData, this.config, this.clock);
    } else {
      this.system = new WorkstationSystem(this.config, this.clock);
    }
    
    // Update idle production
    this.system.update();
    
    // Setup UI
    paper(this);
    this.createHeader();
    this.createDesks();
    this.createInbox();
    this.createButtons();
    
    // Auto-save every 5 seconds
    this.time.addEvent({
      delay: 5000,
      callback: this.saveState,
      callbackScope: this,
      loop: true
    });
    
    // Update every second
    this.time.addEvent({
      delay: 1000,
      callback: this.updateProduction,
      callbackScope: this,
      loop: true
    });
  }

  private createHeader() {
    this.add.text(360, 50, '工位麻薯', {
      fontFamily: FONT_FAMILY,
      fontSize: '42px',
      color: ink,
      fontStyle: 'bold'
    }).setOrigin(0.5);
    
    panel(this, 40, 100, 640, 80);
    
    this.coinsText = this.add.text(360, 140, '', {
      fontFamily: FONT_FAMILY,
      fontSize: '28px',
      color: ink
    }).setOrigin(0.5);
    
    this.updateCoinsDisplay();
    
    // Back button
    const backBtn = this.add.text(50, 50, '← 返回', {
      fontFamily: FONT_FAMILY,
      fontSize: '24px',
      color: ink
    }).setInteractive({ useHandCursor: true });
    
    backBtn.on('pointerdown', () => {
      this.saveState();
      this.scene.start('HomeScene');
    });
  }

  private createDesks() {
    const state = this.system.getState();
    const cols = 3;
    const startY = 220;
    const spacing = 200;
    const slotWidth = 180;
    const slotHeight = 180;
    
    for (let i = 0; i < state.desks.length; i++) {
      const row = Math.floor(i / cols);
      const col = i % cols;
      const x = 90 + col * spacing;
      const y = startY + row * spacing;
      
      const container = this.add.container(x, y);
      
      const desk = state.desks[i];
      const bgColor = desk.unlocked ? 0xf5ecd7 : 0xd5cbb9;
      const bg = this.add.rectangle(0, 0, slotWidth, slotHeight, bgColor, 1)
        .setStrokeStyle(3, 0x8b7c64);
      container.add(bg);
      
      if (desk.unlocked) {
        bg.setInteractive({ useHandCursor: true, dropZone: true });
        bg.on('pointerdown', () => this.onDeskClick(i));
      } else {
      const lockText = this.add.text(0, 0, '🔒', {
        fontFamily: FONT_FAMILY,
        fontSize: '48px'
      }).setOrigin(0.5);
        container.add(lockText);
      }
      
      this.deskGraphics.set(i, container);
    }
    
    this.renderDesks();
  }

  private renderDesks() {
    const state = this.system.getState();
    
    for (let i = 0; i < state.desks.length; i++) {
      const container = this.deskGraphics.get(i);
      if (!container) continue;
      
      // Remove old content (keep background)
      while (container.length > 1) {
        container.remove(container.list[1], true);
      }
      
      const desk = state.desks[i];
      if (desk.occupied && desk.content) {
        if ('producedCoins' in desk.content) {
          this.renderEmployee(container, desk.content as WorkstationEmployee);
        } else {
          this.renderItem(container, desk.content as WorkstationItem);
        }
      }
    }
  }

  private renderItem(container: Phaser.GameObjects.Container, item: WorkstationItem) {
    const icons: Record<string, string> = {
      document: '📄',
      coffee: '☕',
      package: '📦',
      keyboard: '⌨️',
      mouse: '🖱️',
      plant: '🌱'
    };
    
    const icon = this.add.text(0, -20, icons[item.type] || '📦', {
      fontFamily: FONT_FAMILY,
      fontSize: '48px'
    }).setOrigin(0.5);
    
    const levelText = this.add.text(0, 30, `Lv.${item.level}`, {
      fontFamily: FONT_FAMILY,
      fontSize: '18px',
      color: ink
    }).setOrigin(0.5);
    
    container.add([icon, levelText]);
  }

  private renderEmployee(container: Phaser.GameObjects.Container, employee: WorkstationEmployee) {
    const names: Record<string, string> = {
      intern: '实习生',
      junior: '初级',
      senior: '高级',
      lead: '主管',
      manager: '经理'
    };
    
    const nameText = this.add.text(0, -30, names[employee.type] || employee.type, {
      fontFamily: FONT_FAMILY,
      fontSize: '16px',
      color: ink,
      fontStyle: 'bold'
    }).setOrigin(0.5);
    
    const coinsText = this.add.text(0, 0, `💰 ${Math.floor(employee.producedCoins)}`, {
      fontFamily: FONT_FAMILY,
      fontSize: '18px',
      color: '#d4af37'
    }).setOrigin(0.5);
    
    const collectBtn = this.add.text(0, 30, '收取', {
      fontFamily: FONT_FAMILY,
      fontSize: '16px',
      color: '#ffffff',
      backgroundColor: '#4a9d5f',
      padding: { x: 12, y: 6 }
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    
    const deskIndex = this.findDeskByContent(employee);
    if (deskIndex !== -1) {
      collectBtn.on('pointerdown', () => {
        this.collectFromDesk(deskIndex);
      });
    }
    
    container.add([nameText, coinsText, collectBtn]);
  }

  private findDeskByContent(content: any): number {
    const state = this.system.getState();
    return state.desks.findIndex(d => d.content === content);
  }

  private createInbox() {
    this.add.text(360, 920, '收件箱', {
      fontFamily: FONT_FAMILY,
      fontSize: '24px',
      color: ink,
      fontStyle: 'bold'
    }).setOrigin(0.5);
    
    panel(this, 40, 960, 640, 240);
    this.renderInbox();
  }

  private renderInbox() {
    // Clear old
    this.inboxGraphics.forEach(g => g.destroy());
    this.inboxGraphics = [];
    
    const state = this.system.getState();
    const startX = 80;
    const startY = 1000;
    const spacing = 100;
    
    for (let i = 0; i < Math.min(state.inbox.length, 6); i++) {
      const item = state.inbox[i];
      const x = startX + (i % 6) * spacing;
      const y = startY + Math.floor(i / 6) * 100;
      
      const container = this.add.container(x, y);
      
      const icons: Record<string, string> = {
        document: '📄',
        coffee: '☕',
        package: '📦',
        keyboard: '⌨️',
        mouse: '🖱️',
        plant: '🌱'
      };
      
      const icon = this.add.text(0, 0, icons[item.type] || '📦', {
        fontFamily: FONT_FAMILY,
        fontSize: '36px'
      }).setOrigin(0.5).setInteractive({ useHandCursor: true, draggable: true });
      
      const levelText = this.add.text(0, 25, `${item.level}`, {
        fontFamily: FONT_FAMILY,
        fontSize: '14px',
        color: ink
      }).setOrigin(0.5);
      
      container.add([icon, levelText]);
      this.inboxGraphics.push(container);
      
      icon.on('pointerdown', () => this.startDrag(item.id, container));
      icon.on('pointerup', () => this.endDrag());
    }
    
    if (state.inbox.length > 6) {
      this.add.text(650, 1080, `+${state.inbox.length - 6}`, {
        fontFamily: FONT_FAMILY,
        fontSize: '18px',
        color: ink
      }).setOrigin(1, 0.5);
    }
  }

  private createButtons() {
    const state = this.system.getState();
    const nextCost = this.system.getNextUnlockCost();
    
    if (nextCost !== null) {
      const btnX = 540;
      const btnY = 140;
      
      const container = this.add.container(btnX, btnY);
      
      const btn = this.add.text(0, 0, `解锁 ${nextCost}💰`, {
        fontFamily: FONT_FAMILY,
        fontSize: '18px',
        color: '#ffffff',
        backgroundColor: state.coins >= nextCost ? '#4a9d5f' : '#8b7c64',
        padding: { x: 12, y: 8 }
      }).setOrigin(0.5).setInteractive({ useHandCursor: true });
      
      btn.on('pointerdown', () => this.unlockNextDesk());
      
      container.add(btn);
      this.unlockButton = container;
    }
    
    // Collect all button
    const collectAllBtn = this.add.text(540, 100, '全部收取', {
      fontFamily: FONT_FAMILY,
      fontSize: '18px',
      color: '#ffffff',
      backgroundColor: '#4a9d5f',
      padding: { x: 12, y: 8 }
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    
    collectAllBtn.on('pointerdown', () => {
      const collected = this.system.collectAllCoins();
      if (collected > 0) {
        this.updateUI();
      }
    });
  }

  private onDeskClick(index: number) {
    const state = this.system.getState();
    const desk = state.desks[index];
    
    if (!desk.occupied) return;
    
    // Show context menu or merge UI
    // For now, allow removal
    this.system.removeFromDesk(index);
    this.renderDesks();
  }

  private startDrag(itemId: string, graphics: Phaser.GameObjects.Container) {
    this.draggedItem = { itemId, graphics };
  }

  private endDrag() {
    if (!this.draggedItem) return;
    
    const pointer = this.input.activePointer;
    
    // Find which desk we're over
    for (const [index, container] of this.deskGraphics) {
      const bounds = container.getBounds();
      if (bounds.contains(pointer.x, pointer.y)) {
        const success = this.system.placeItemOnDesk(this.draggedItem.itemId, index);
        if (success) {
          this.renderInbox();
          this.renderDesks();
        }
        break;
      }
    }
    
    this.draggedItem = null;
  }

  private collectFromDesk(index: number) {
    const collected = this.system.collectCoins(index);
    if (collected > 0) {
      this.renderDesks();
      this.updateCoinsDisplay();
    }
  }

  private unlockNextDesk() {
    const success = this.system.unlockDesk();
    if (success) {
      this.updateUI();
    }
  }

  private updateProduction() {
    this.system.update();
    this.renderDesks();
    this.updateCoinsDisplay();
    this.checkBossInspection();
  }

  private checkBossInspection() {
    const state = this.system.getState();
    
    if (state.bossInspection && !state.bossInspection.handled && !this.bossInspectionUI) {
      this.showBossInspection();
    } else if (!state.bossInspection && this.bossInspectionUI) {
      this.bossInspectionUI.destroy();
      this.bossInspectionUI = undefined;
    }
  }

  private showBossInspection() {
    const container = this.add.container(360, 500).setDepth(100);
    
    const bg = this.add.rectangle(0, 0, 500, 200, 0xfff9e7, 1)
      .setStrokeStyle(4, 0x785d42);
    
    const title = this.add.text(0, -50, '老板巡查！', {
      fontFamily: FONT_FAMILY,
      fontSize: '32px',
      color: ink,
      fontStyle: 'bold'
    }).setOrigin(0.5);
    
    const hint = this.add.text(0, 0, '快速点击应对', {
      fontFamily: FONT_FAMILY,
      fontSize: '20px',
      color: ink
    }).setOrigin(0.5);
    
    const btn = this.add.text(0, 50, '应对', {
      fontFamily: FONT_FAMILY,
      fontSize: '24px',
      color: '#ffffff',
      backgroundColor: '#d9534f',
      padding: { x: 20, y: 10 }
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    
    btn.on('pointerdown', () => {
      const success = this.system.handleBossInspection();
      if (success) {
        container.destroy();
        this.bossInspectionUI = undefined;
        this.updateCoinsDisplay();
      }
    });
    
    container.add([bg, title, hint, btn]);
    this.bossInspectionUI = container;
  }

  private updateUI() {
    this.renderDesks();
    this.renderInbox();
    this.updateCoinsDisplay();
    
    // Update unlock button
    if (this.unlockButton) {
      this.unlockButton.destroy();
      this.unlockButton = undefined;
    }
    this.createButtons();
  }

  private updateCoinsDisplay() {
    const state = this.system.getState();
    this.coinsText.setText(`💰 麻薯币: ${state.coins}`);
  }

  private async saveState() {
    const serialized = this.system.serialize();
    await this.platform.saveData(STORAGE_KEY, serialized);
  }

  shutdown() {
    this.saveState();
  }
}
