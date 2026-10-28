import { describe, expect, it } from 'vitest';
import { WorkstationSystem } from '../WorkstationSystem';
import { canMergeWorkstationContent, findWorkstationMerge, selectedWorkstationAction } from '../WorkstationActions';
import data from '../../config/workstationConfig.json';
import type { WorkstationConfig } from '../../types/workstation';

const config = data as WorkstationConfig;

function create() { return new WorkstationSystem(config, { now: () => 1000 }); }

describe('workstation deliberate organization', () => {
  it('finds an inbox pair only if a real desk is available, without mutating assets', () => {
    const system = create();
    for (let i = 0; i < 6; i++) {
      system.addItemToInbox('plant', 3);
      system.placeItemOnDesk(system.getState().inbox[0].id, i);
    }
    system.addItemToInbox('document', 1);
    system.addItemToInbox('document', 1);
    const snapshot = system.serialize();
    expect(findWorkstationMerge(system.getState(), config)).toBeUndefined();
    expect(system.serialize()).toBe(snapshot);
    expect(system.returnItemToInbox(0)).toBe(true);
    expect(findWorkstationMerge(system.getState(), config)).toMatchObject({ target: 0, prepare: { type: 'document' } });
  });

  it('follows the selected coffee pair even when a document pair appears earlier', () => {
    const system = create();
    system.addItemToInbox('document', 1);
    system.addItemToInbox('document', 1);
    system.addItemToInbox('coffee', 1);
    system.addItemToInbox('coffee', 1);
    const state = system.getState();
    const selected = { source: 'inbox' as const, index: 2, content: state.inbox[2] };
    expect(selectedWorkstationAction(state, config, selected)).toMatchObject({ kind: 'merge', prepare: { type: 'coffee' }, source: { content: { type: 'coffee' } } });
    state.inbox.splice(2, 1);
    expect(selectedWorkstationAction(state, config, selected)).toBeUndefined();
  });

  it('offers placement when the selected material has no match, never an unrelated merge', () => {
    const system = create();
    system.addItemToInbox('document', 1);
    system.addItemToInbox('document', 1);
    system.addItemToInbox('plant', 3);
    const state = system.getState();
    expect(selectedWorkstationAction(state, config, { source: 'inbox', index: 2, content: state.inbox[2] })).toMatchObject({ kind: 'place', source: { content: { type: 'plant', level: 3 } } });
  });

  it('a returned item survives save/reload with the same id and level', () => {
    const system = create();
    system.addItemToInbox('document', 4);
    const item = system.getState().inbox[0];
    system.placeItemOnDesk(item.id, 0);
    expect(system.returnItemToInbox(0)).toBe(true);
    const restored = WorkstationSystem.deserialize(system.serialize(), config, { now: () => 1000 });
    expect(restored.getState().inbox).toEqual([item]);
    expect(restored.getState().desks[0].occupied).toBe(false);
  });

  it('full-level decoration and top-tier employees are never suggested as merges', () => {
    const system = create();
    system.addItemToInbox('plant', 3);
    system.addItemToInbox('plant', 3);
    const items = system.getState().inbox;
    expect(canMergeWorkstationContent(items[0], items[1], config)).toBe(false);
    const employee = { id: 'a', type: 'manager' as const, level: 1, producedCoins: 8.5, lastCollectTime: 1000 };
    expect(canMergeWorkstationContent(employee, { ...employee, id: 'b' }, config)).toBe(false);
    system.getState().desks[0].content = employee;
    system.getState().desks[0].occupied = true;
    expect(system.returnItemToInbox(0)).toBe(false);
    expect(system.getState().desks[0].content).toEqual(employee);
  });
});
