import { AfterimageTrack, AfterimageConfig } from '../types';

export interface AfterimageSystemEvents {
  onMerge?: (track1Id: number, track2Id: number, newLevel: number, x: number, y: number) => void;
  onFade?: (trackId: number) => void;
}

export class AfterimageSystem {
  private tracks: Map<number, AfterimageTrack> = new Map();
  private nextTrackId = 1;
  private config: AfterimageConfig;
  private shotCount = 0;
  private events: AfterimageSystemEvents;

  constructor(config: AfterimageConfig, events: AfterimageSystemEvents = {}) {
    this.config = config;
    this.events = events;
  }

  startTracking(ballLevel: number): number {
    const trackId = this.nextTrackId++;
    const track: AfterimageTrack = {
      id: trackId,
      ballLevel,
      segments: [],
      createdAt: this.shotCount,
      opacity: this.config.baseOpacity
    };
    this.tracks.set(trackId, track);
    return trackId;
  }

  addSegment(trackId: number, x: number, y: number, timestamp: number): void {
    const track = this.tracks.get(trackId);
    if (!track) return;

    if (track.segments.length === 0) {
      track.segments.push({ x, y, timestamp });
      return;
    }

    const lastSegment = track.segments[track.segments.length - 1];
    const dx = x - lastSegment.x;
    const dy = y - lastSegment.y;
    const distance = Math.sqrt(dx * dx + dy * dy);

    if (distance >= this.config.segmentInterval) {
      track.segments.push({ x, y, timestamp });
    }
  }

  finalizeTrack(trackId: number): boolean {
    const track = this.tracks.get(trackId);
    if (!track) return false;
    
    if (track.segments.length < 2) {
      this.tracks.delete(trackId);
      return false;
    }

    this.shotCount++;
    this.fadeOldTracks();
    this.capTracks();
    return true;
  }

  private fadeOldTracks(): void {
    const tracksToRemove: number[] = [];
    
    for (const track of this.tracks.values()) {
      const age = this.shotCount - track.createdAt;
      if (age >= this.config.fadeAfterShots) {
        tracksToRemove.push(track.id);
        if (this.events.onFade) {
          this.events.onFade(track.id);
        }
      } else {
        const fadeRatio = age / this.config.fadeAfterShots;
        track.opacity = this.config.baseOpacity * (1 - fadeRatio * 0.5);
      }
    }

    for (const id of tracksToRemove) {
      this.tracks.delete(id);
    }
  }

  private capTracks(): void {
    if (this.tracks.size <= this.config.maxTracks) return;

    const sortedTracks = Array.from(this.tracks.values())
      .sort((a, b) => a.createdAt - b.createdAt);

    const toRemove = sortedTracks.slice(0, this.tracks.size - this.config.maxTracks);
    for (const track of toRemove) {
      this.tracks.delete(track.id);
      if (this.events.onFade) {
        this.events.onFade(track.id);
      }
    }
  }

  checkMerges(): Array<{ track1Id: number; track2Id: number; newLevel: number; x: number; y: number }> {
    const merges: Array<{ track1Id: number; track2Id: number; newLevel: number; x: number; y: number }> = [];
    const trackList = Array.from(this.tracks.values());

    for (let i = 0; i < trackList.length; i++) {
      const track1 = trackList[i];
      const center1 = this.getTrackCenter(track1);
      if (!center1) continue;

      for (let j = i + 1; j < trackList.length; j++) {
        const track2 = trackList[j];
        
        if (track1.ballLevel !== track2.ballLevel) continue;

        const center2 = this.getTrackCenter(track2);
        if (!center2) continue;

        const dx = center2.x - center1.x;
        const dy = center2.y - center1.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        const magnetRadius = this.getMagnetRadius(track1.ballLevel);
        
        if (distance <= magnetRadius) {
          const mergeX = (center1.x + center2.x) / 2;
          const mergeY = (center1.y + center2.y) / 2;
          merges.push({
            track1Id: track1.id,
            track2Id: track2.id,
            newLevel: track1.ballLevel + 1,
            x: mergeX,
            y: mergeY
          });
        }
      }
    }

    return merges;
  }

  processMerge(track1Id: number, track2Id: number, newLevel: number, x: number, y: number): void {
    this.tracks.delete(track1Id);
    this.tracks.delete(track2Id);

    const newTrackId = this.nextTrackId++;
    const newTrack: AfterimageTrack = {
      id: newTrackId,
      ballLevel: newLevel,
      segments: [{ x, y, timestamp: Date.now() }],
      createdAt: this.shotCount,
      opacity: this.config.baseOpacity
    };
    this.tracks.set(newTrackId, newTrack);

    if (this.events.onMerge) {
      this.events.onMerge(track1Id, track2Id, newLevel, x, y);
    }
  }

  private getTrackCenter(track: AfterimageTrack): { x: number; y: number } | null {
    if (track.segments.length === 0) return null;

    let sumX = 0;
    let sumY = 0;
    for (const segment of track.segments) {
      sumX += segment.x;
      sumY += segment.y;
    }

    return {
      x: sumX / track.segments.length,
      y: sumY / track.segments.length
    };
  }

  private getMagnetRadius(ballLevel: number): number {
    const multiplier = this.config.magnetRadiusMultipliers[ballLevel] ?? 1.0;
    return this.config.magnetRadius * multiplier;
  }

  getTracks(): Map<number, AfterimageTrack> {
    return new Map(this.tracks);
  }

  getTrack(trackId: number): AfterimageTrack | undefined {
    return this.tracks.get(trackId);
  }

  getShotCount(): number {
    return this.shotCount;
  }

  reset(): void {
    this.tracks.clear();
    this.nextTrackId = 1;
    this.shotCount = 0;
  }
}
