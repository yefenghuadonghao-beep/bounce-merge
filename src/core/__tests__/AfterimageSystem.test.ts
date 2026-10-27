import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AfterimageSystem, AfterimageSystemEvents } from '../AfterimageSystem';
import { AfterimageConfig } from '../../types';

describe('AfterimageSystem', () => {
  let config: AfterimageConfig;
  let events: AfterimageSystemEvents;
  let system: AfterimageSystem;

  beforeEach(() => {
    config = {
      enabled: true,
      maxTracks: 5,
      fadeAfterShots: 3,
      segmentInterval: 10,
      segmentThickness: 4,
      baseOpacity: 0.5,
      magnetRadius: 50,
      magnetRadiusMultipliers: { 1: 1.0, 2: 1.2, 3: 1.5 },
      mergeCheckInterval: 100
    };
    events = {
      onMerge: vi.fn(),
      onFade: vi.fn()
    };
    system = new AfterimageSystem(config, events);
  });

  describe('startTracking', () => {
    it('should create a new track', () => {
      const trackId = system.startTracking(1);
      expect(trackId).toBe(1);
      expect(system.getTracks().size).toBe(1);
    });

    it('should increment track IDs', () => {
      const id1 = system.startTracking(1);
      const id2 = system.startTracking(2);
      expect(id1).toBe(1);
      expect(id2).toBe(2);
    });

    it('should store ball level', () => {
      const trackId = system.startTracking(3);
      const track = system.getTrack(trackId);
      expect(track?.ballLevel).toBe(3);
    });
  });

  describe('addSegment', () => {
    it('should add first segment immediately', () => {
      const trackId = system.startTracking(1);
      system.addSegment(trackId, 100, 200, 0);
      const track = system.getTrack(trackId);
      expect(track?.segments.length).toBe(1);
      expect(track?.segments[0]).toEqual({ x: 100, y: 200, timestamp: 0 });
    });

    it('should add segment when distance exceeds interval', () => {
      const trackId = system.startTracking(1);
      system.addSegment(trackId, 100, 200, 0);
      system.addSegment(trackId, 111, 200, 50);
      const track = system.getTrack(trackId);
      expect(track?.segments.length).toBe(2);
    });

    it('should not add segment when distance is too small', () => {
      const trackId = system.startTracking(1);
      system.addSegment(trackId, 100, 200, 0);
      system.addSegment(trackId, 101, 200, 50);
      const track = system.getTrack(trackId);
      expect(track?.segments.length).toBe(1);
    });

    it('should ignore invalid track ID', () => {
      system.addSegment(999, 100, 200, 0);
      expect(system.getTracks().size).toBe(0);
    });
  });

  describe('finalizeTrack', () => {
    it('should delete track with less than 2 segments', () => {
      const trackId = system.startTracking(1);
      system.addSegment(trackId, 100, 200, 0);
      system.finalizeTrack(trackId);
      expect(system.getTracks().size).toBe(0);
    });

    it('should keep track with 2+ segments', () => {
      const trackId = system.startTracking(1);
      system.addSegment(trackId, 100, 200, 0);
      system.addSegment(trackId, 120, 200, 50);
      system.finalizeTrack(trackId);
      expect(system.getTracks().size).toBe(1);
    });

    it('should only count actual launches', () => {
      const trackId = system.startTracking(1);
      system.addSegment(trackId, 100, 200, 0);
      system.addSegment(trackId, 120, 200, 50);
      expect(system.getShotCount()).toBe(0);
      system.finalizeTrack(trackId);
      expect(system.finalizeTrack(trackId)).toBe(false);
      expect(system.getShotCount()).toBe(0);
      system.advanceShot();
      expect(system.getShotCount()).toBe(1);
    });
  });

  describe('fadeOldTracks', () => {
    it('should fade tracks based on age', () => {
      const id1 = system.startTracking(1);
      system.addSegment(id1, 100, 200, 0);
      system.addSegment(id1, 120, 200, 50);
      system.finalizeTrack(id1);

      const id2 = system.startTracking(2);
      system.addSegment(id2, 200, 300, 0);
      system.addSegment(id2, 220, 300, 50);
      system.finalizeTrack(id2);

      system.advanceShot();
      const track1 = system.getTrack(id1);
      expect(track1?.opacity).toBeLessThan(config.baseOpacity);
    });

    it('should remove tracks after fadeAfterShots', () => {
      const trackIds: number[] = [];
      for (let i = 0; i < 4; i++) {
        system.advanceShot();
        const id = system.startTracking(1);
        system.addSegment(id, 100 + i * 50, 200, 0);
        system.addSegment(id, 120 + i * 50, 200, 50);
        system.finalizeTrack(id);
        trackIds.push(id);
      }

      expect(system.getTrack(trackIds[0])).toBeUndefined();
      expect(system.getTrack(trackIds[3])).toBeDefined();
      expect(events.onFade).toHaveBeenCalled();
    });
  });

  describe('capTracks', () => {
    it('should remove oldest tracks when exceeding maxTracks', () => {
      const trackIds: number[] = [];
      for (let i = 0; i < 7; i++) {
        const id = system.startTracking(1);
        system.addSegment(id, 100 + i * 100, 200, 0);
        system.addSegment(id, 120 + i * 100, 200, 50);
        system.finalizeTrack(id);
        trackIds.push(id);
      }

      expect(system.getTracks().size).toBeLessThanOrEqual(config.maxTracks);
      expect(system.getTrack(trackIds[0])).toBeUndefined();
      expect(system.getTrack(trackIds[trackIds.length - 1])).toBeDefined();
    });
  });

  describe('checkMerges', () => {
    it('should detect merges between same-level tracks', () => {
      const id1 = system.startTracking(2);
      system.addSegment(id1, 100, 200, 0);
      system.addSegment(id1, 120, 200, 50);
      system.finalizeTrack(id1);

      const id2 = system.startTracking(2);
      system.addSegment(id2, 130, 200, 0);
      system.addSegment(id2, 150, 200, 50);
      system.finalizeTrack(id2);

      const merges = system.checkMerges();
      expect(merges.length).toBe(1);
      expect(merges[0].track1Id).toBe(id1);
      expect(merges[0].track2Id).toBe(id2);
      expect(merges[0].newLevel).toBe(3);
    });

    it('should not merge different-level tracks', () => {
      const id1 = system.startTracking(1);
      system.addSegment(id1, 100, 200, 0);
      system.addSegment(id1, 120, 200, 50);
      system.finalizeTrack(id1);

      const id2 = system.startTracking(2);
      system.addSegment(id2, 130, 200, 0);
      system.addSegment(id2, 150, 200, 50);
      system.finalizeTrack(id2);

      const merges = system.checkMerges();
      expect(merges.length).toBe(0);
    });

    it('should not merge tracks that are too far apart', () => {
      const id1 = system.startTracking(1);
      system.addSegment(id1, 100, 200, 0);
      system.addSegment(id1, 120, 200, 50);
      system.finalizeTrack(id1);

      const id2 = system.startTracking(1);
      system.addSegment(id2, 300, 200, 0);
      system.addSegment(id2, 320, 200, 50);
      system.finalizeTrack(id2);

      const merges = system.checkMerges();
      expect(merges.length).toBe(0);
    });

    it('should use level-specific magnet radius', () => {
      const id1 = system.startTracking(3);
      system.addSegment(id1, 100, 200, 0);
      system.addSegment(id1, 120, 200, 50);
      system.finalizeTrack(id1);

      const id2 = system.startTracking(3);
      system.addSegment(id2, 160, 200, 0);
      system.addSegment(id2, 180, 200, 50);
      system.finalizeTrack(id2);

      const merges = system.checkMerges();
      expect(merges.length).toBe(1);
    });
  });

  describe('processMerge', () => {
    it('should remove merged tracks and create new one', () => {
      const id1 = system.startTracking(2);
      system.addSegment(id1, 100, 200, 0);
      system.addSegment(id1, 120, 200, 50);
      system.finalizeTrack(id1);

      const id2 = system.startTracking(2);
      system.addSegment(id2, 130, 200, 0);
      system.addSegment(id2, 150, 200, 50);
      system.finalizeTrack(id2);

      system.processMerge(id1, id2, 3, 125, 200);

      expect(system.getTrack(id1)).toBeUndefined();
      expect(system.getTrack(id2)).toBeUndefined();
      
      const tracks = Array.from(system.getTracks().values());
      const newTrack = tracks.find(t => t.ballLevel === 3);
      expect(newTrack).toBeDefined();
      expect(events.onMerge).toHaveBeenCalledWith(id1, id2, 3, 125, 200, newTrack?.id);
    });
  });

  describe('reset', () => {
    it('should clear all tracks and reset counters', () => {
      const id = system.startTracking(1);
      system.addSegment(id, 100, 200, 0);
      system.addSegment(id, 120, 200, 50);
      system.finalizeTrack(id);

      system.reset();

      expect(system.getTracks().size).toBe(0);
      expect(system.getShotCount()).toBe(0);
    });
  });
  function track(level: number, x = 100, finalized = true) {
    const id = system.startTracking(level);
    system.addSegment(id, x, 200, 0);
    system.addSegment(id, x + 100, 200, 50);
    if (finalized) system.finalizeTrack(id);
    return id;
  }

  it('does not merge a path that is still being recorded', () => {
    track(1);
    track(1, 100, false);
    expect(system.checkMerges()).toEqual([]);
  });

  it('consumes each track once and rejects stale merge requests', () => {
    const a = track(1);
    const b = track(1);
    track(1);
    expect(system.checkMerges()).toHaveLength(1);
    system.processMerge(a, b, 2, 100, 200);
    system.processMerge(a, b, 2, 100, 200);
    expect(events.onMerge).toHaveBeenCalledTimes(1);
    expect(system.getTracks().size).toBe(2);
  });

  it('merges crossing segments at their intersection', () => {
    track(1);
    const b = system.startTracking(1);
    system.addSegment(b, 150, 0, 0);
    system.addSegment(b, 150, 1000, 50);
    system.finalizeTrack(b);
    expect(system.checkMerges()[0]).toMatchObject({ x: 150, y: 200 });
  });

  it('keeps a fused core eligible for the next merge', () => {
    const a = track(1);
    const b = track(1);
    const id = system.processMerge(a, b, 2, 100, 200)!;
    expect(system.getTrack(id)).toMatchObject({ finalized: true, ballLevel: 2 });
    expect(system.getTrack(id)?.segments).toHaveLength(1);
    track(2);
    expect(system.checkMerges()[0].newLevel).toBe(3);
  });

  it('rejects invalid levels and stops at the highest character', () => {
    const a = track(10);
    const b = track(10);
    expect(system.checkMerges()).toEqual([]);
    expect(system.processMerge(a, b, 11, 100, 200)).toBeUndefined();
    expect(system.processMerge(a, b, 4, 100, 200)).toBeUndefined();
    expect(events.onMerge).not.toHaveBeenCalled();
  });

  it('clears settled obstacles without cancelling the flying ball', () => {
    const settled = track(1);
    const active = track(1, 100, false);
    system.clearSettledTracks();
    expect(system.getTrack(settled)).toBeUndefined();
    expect(system.getTrack(active)).toBeDefined();
    expect(events.onFade).toHaveBeenCalledWith(settled);
  });

  it('bounds recording size even on a long bouncing path', () => {
    config.maxSegments = 8;
    const id = system.startTracking(1);
    for (let i = 0; i < 200; i++) system.addSegment(id, i * 20, 200, i);
    expect(system.getTrack(id)?.segments.length).toBeLessThanOrEqual(8);
  });

});
