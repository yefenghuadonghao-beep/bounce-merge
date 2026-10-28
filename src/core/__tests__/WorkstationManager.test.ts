import { beforeEach, describe, expect, it, vi } from 'vitest';
import { WorkstationManager } from '../WorkstationManager';
import { WebPlatform } from '../../platform/WebPlatform';

beforeEach(() => {
  localStorage.clear();
  WorkstationManager['instance'] = null;
});

describe('workstation rewards and persistence', () => {
  it('gives starter items once and restores earned rewards after a reload', async () => {
    const platform = new WebPlatform();
    const manager = WorkstationManager.getInstance(platform);
    const system = await manager.getSystem();
    expect(system.getState().inbox.map(item => item.type)).toEqual(['document', 'document', 'coffee']);

    await manager.addRewardItems([{ type: 'package', level: 3 }]);
    WorkstationManager['instance'] = null;
    const restored = await WorkstationManager.getInstance(platform).getSystem();
    expect(restored.getState().inbox).toHaveLength(4);
    expect(restored.getState().inbox[3]).toMatchObject({ type: 'package', level: 3 });
  });

  it('does not overwrite a previously empty inbox with starter items', async () => {
    const platform = new WebPlatform();
    const manager = WorkstationManager.getInstance(platform);
    const system = await manager.getSystem();
    system.getState().inbox = [];
    await manager.save();
    WorkstationManager['instance'] = null;

    expect((await WorkstationManager.getInstance(platform).getSystem()).getState().inbox).toEqual([]);
  });

  it('uses platform time for new saves', async () => {
    const platform = new WebPlatform();
    vi.spyOn(platform, 'getCurrentTime').mockReturnValue(12345);
    const system = await WorkstationManager.getInstance(platform).getSystem();
    expect(system.getState().lastUpdateTime).toBe(12345);
  });
});
