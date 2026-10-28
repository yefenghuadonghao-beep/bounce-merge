import { beforeEach, describe, expect, it, vi } from 'vitest';
import EventEmitter from 'eventemitter3';
import type Phaser from 'phaser';
import { WorkstationScene } from '../WorkstationScene';
import { HomeScene } from '../HomeScene';
import { WorkstationManager } from '../../core/WorkstationManager';
import { GameController } from '../../core/GameController';
import { WebPlatform } from '../../platform/WebPlatform';
import { setPlatform } from '../../platform';
import { setupHiDpi } from '../../ui/hidpi';
import ballLevels from '../../config/ballLevels.json';
import levelConfigs from '../../config/levelConfig.json';
import gameConfig from '../../config/gameConfig.json';

vi.mock('phaser', () => ({ default: {
  Scene: class {},
  Scenes: { Events: { SHUTDOWN: 'shutdown' } },
  Core: { Events: { BLUR: 'blur' } }
} }));
vi.mock('../../ui/hidpi', () => ({ setupHiDpi: vi.fn() }));
vi.mock('../../ui/theme', async importOriginal => ({
  ...await importOriginal<typeof import('../../ui/theme')>(),
  paper: vi.fn()
}));

describe('workstation input lifecycle', () => {
  let scene: WorkstationScene;
  let controller: GameController;
  let input: EventEmitter;
  let events: EventEmitter;
  let gameEvents: EventEmitter;

  beforeEach(async () => {
    localStorage.clear();
    WorkstationManager['instance'] = null;
    setPlatform(new WebPlatform());
    controller = new GameController(ballLevels, levelConfigs, gameConfig);
    scene = new WorkstationScene();
    scene.init({ gameController: controller, gameConfig });
    input = new EventEmitter();
    events = new EventEmitter();
    gameEvents = new EventEmitter();
    scene.input = input as unknown as Phaser.Input.InputPlugin;
    scene.events = events as unknown as Phaser.Events.EventEmitter;
    scene.game = { events: gameEvents } as unknown as Phaser.Game;
    scene.time = { addEvent: vi.fn() } as unknown as Phaser.Time.Clock;
    scene.cameras = { main: {
      getWorldPoint: (x: number, y: number) => ({ x: x / 2, y: (y - 100) / 2 })
    } } as unknown as Phaser.Cameras.Scene2D.CameraManager;
    scene['createHeader'] = vi.fn();
    scene['createTutorial'] = vi.fn();
    scene['createDesks'] = vi.fn();
    scene['createInbox'] = vi.fn();
    scene['createButtons'] = vi.fn();
    scene['updateUI'] = vi.fn();
    scene['showMergeAnimation'] = vi.fn();
    await scene.create();
  });

  function dragInboxItem() {
    const preview = { setPosition: vi.fn(), destroy: vi.fn() };
    const item = scene['system'].getState().inbox[0];
    scene['draggedContent'] = { source: 'inbox', index: 0, content: item };
    scene['dragPreview'] = preview as unknown as Phaser.GameObjects.Container;
    scene['deskGraphics'].set(0, { getBounds: () => ({ contains: (x: number, y: number) => x === 150 && y === 230 }) } as unknown as Phaser.GameObjects.Container);
    return preview;
  }

  it('initializes the high-DPI camera and drops outside the original inbox icon in world coordinates', () => {
    expect(setupHiDpi).toHaveBeenCalledWith(scene);
    const preview = dragInboxItem();
    input.emit('pointermove', { x: 300, y: 560 });
    expect(preview.setPosition).toHaveBeenCalledWith(150, 230);
    input.emit('pointerup', { x: 300, y: 560 });

    expect(scene['system'].getState().desks[0].content).toMatchObject({ type: 'document' });
    expect(scene['system'].getState().inbox).toHaveLength(2);
    expect(preview.destroy).toHaveBeenCalledOnce();
    expect(scene['draggedContent']).toBeNull();
  });

  it('keeps a click on an occupied desk unchanged and places a merge on the destination desk', () => {
    const system = scene['system'];
    system.placeItemOnDesk(system.getState().inbox[0].id, 0);
    system.placeItemOnDesk(system.getState().inbox[0].id, 1);
    const saved = system.serialize();
    scene['draggedContent'] = { source: 'desk', index: 0, content: system.getState().desks[0].content! };
    scene['handleDrop'](0);
    expect(system.serialize()).toBe(saved);
    scene['handleDrop'](1);
    expect(system.getState().desks[0].occupied).toBe(false);
    expect(system.getState().desks[1].content).toMatchObject({ type: 'document', level: 2 });
  });

  it.each(['pointerupoutside', 'blur'])('cancels a drag on %s without consuming the item', event => {
    const preview = dragInboxItem();
    const saved = scene['system'].serialize();
    if (event === 'blur') gameEvents.emit(event);
    else input.emit(event);
    expect(scene['system'].serialize()).toBe(saved);
    expect(preview.destroy).toHaveBeenCalledOnce();
    expect(scene['draggedContent']).toBeNull();
  });

  it('removes input listeners and saves on shutdown, then resets UI references on reentry', () => {
    dragInboxItem();
    const save = vi.spyOn(scene['manager'], 'save');
    events.emit('shutdown');
    expect(input.listenerCount('pointermove')).toBe(0);
    expect(input.listenerCount('pointerup')).toBe(0);
    expect(input.listenerCount('pointerupoutside')).toBe(0);
    expect(gameEvents.listenerCount('blur')).toBe(0);
    expect(save).toHaveBeenCalledOnce();
    scene.init({ gameController: controller, gameConfig });
    expect(scene['deskGraphics'].size).toBe(0);
    expect(scene['dragPreview']).toBeNull();
    expect(scene['bossInspectionUI']).toBeUndefined();
  });

  it('passes the game context into the workstation', () => {
    const home = new HomeScene();
    home.init({ gameController: controller, gameConfig });
    home.scene = { start: vi.fn() } as unknown as Phaser.Scenes.ScenePlugin;
    home['goToWorkstation']();
    expect(home.scene.start).toHaveBeenCalledWith('WorkstationScene', { gameController: controller, gameConfig });
  });
});
