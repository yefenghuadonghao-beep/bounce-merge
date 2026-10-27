import { AfterimageTrack, AfterimageConfig, AfterimageSegment } from '../types';

type Merge = { track1Id: number; track2Id: number; newLevel: number; x: number; y: number };
type Point = Pick<AfterimageSegment, 'x' | 'y'>;

export interface AfterimageSystemEvents {
  onMerge?: (track1Id: number, track2Id: number, newLevel: number, x: number, y: number, newTrackId: number) => void;
  onFade?: (trackId: number) => void;
}

// 先检查线段相交，再比较端点投影，交叉与擦边都按实际轨迹距离判定。
function closestSegments(a: Point, b: Point, c: Point, d: Point) {
  const ux = b.x - a.x;
  const uy = b.y - a.y;
  const vx = d.x - c.x;
  const vy = d.y - c.y;
  const cross = ux * vy - uy * vx;
  if (Math.abs(cross) > 0.0001) {
    const t = ((c.x - a.x) * vy - (c.y - a.y) * vx) / cross;
    const s = ((c.x - a.x) * uy - (c.y - a.y) * ux) / cross;
    if (t >= 0 && t <= 1 && s >= 0 && s <= 1) return { distance: 0, x: a.x + t * ux, y: a.y + t * uy };
  }
  const candidates = [[a, c, d], [b, c, d], [c, a, b], [d, a, b]];
  let best = { distance: Infinity, x: 0, y: 0 };
  for (let i = 0; i < candidates.length; i++) {
    const [p, start, end] = candidates[i];
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const lengthSquared = dx * dx + dy * dy;
    const t = lengthSquared === 0 ? 0 : Math.max(0, Math.min(1, ((p.x - start.x) * dx + (p.y - start.y) * dy) / lengthSquared));
    const x = start.x + t * dx;
    const y = start.y + t * dy;
    const distance = Math.hypot(x - p.x, y - p.y);
    if (distance < best.distance) best = { distance, x: (x + p.x) / 2, y: (y + p.y) / 2 };
  }
  return best;
}

export class AfterimageSystem {
  private tracks = new Map<number, AfterimageTrack>();
  private nextTrackId = 1;
  private shotCount = 0;

  constructor(private config: AfterimageConfig, private events: AfterimageSystemEvents = {}, private maxLevel = 10) {}

  // 残影寿命只由玩家发射推进，预摆、抱团、落地和合成不会凭空增加次数。
  advanceShot(): void {
    this.shotCount++;
    const tracks = Array.from(this.tracks.values());
    for (let i = 0; i < tracks.length; i++) {
      const track = tracks[i];
      if (!track.finalized) continue;
      const age = this.shotCount - track.createdAt;
      if (age >= this.config.fadeAfterShots) this.removeTrack(track.id);
      else track.opacity = this.config.baseOpacity * (1 - age / this.config.fadeAfterShots * 0.6);
    }
  }

  startTracking(ballLevel: number): number {
    const id = this.nextTrackId++;
    this.tracks.set(id, { id, ballLevel, segments: [], createdAt: this.shotCount, opacity: this.config.baseOpacity, finalized: false });
    this.capTracks();
    return id;
  }

  addSegment(trackId: number, x: number, y: number, timestamp: number): void {
    const track = this.tracks.get(trackId);
    if (!track || track.finalized || !Number.isFinite(x) || !Number.isFinite(y)) return;
    const segments = track.segments;
    const last = segments[segments.length - 1];
    if (last && Math.hypot(x - last.x, y - last.y) < this.config.segmentInterval) return;
    if (segments.length >= (this.config.maxSegments ?? 48)) return;
    segments.push({ x, y, timestamp });
  }

  finalizeTrack(trackId: number): boolean {
    const track = this.tracks.get(trackId);
    if (!track || track.finalized) return false;
    if (track.segments.length < 2) {
      this.removeTrack(trackId);
      return false;
    }
    track.finalized = true;
    track.createdAt = this.shotCount;
    return true;
  }

  private capTracks() {
    const tracks = Array.from(this.tracks.values()).sort((a, b) => a.id - b.id);
    const count = tracks.length - this.config.maxTracks;
    for (let i = 0; i < count; i++) this.removeTrack(tracks[i].id);
  }

  private removeTrack(id: number) {
    if (!this.tracks.delete(id)) return;
    this.events.onFade?.(id);
  }

  clearSettledTracks(preserveCores = false): void {
    const tracks = Array.from(this.tracks.values());
    for (let i = 0; i < tracks.length; i++) if (tracks[i].finalized && (!preserveCores || tracks[i].segments.length > 1)) this.removeTrack(tracks[i].id);
  }

  private match(first: AfterimageTrack, second: AfterimageTrack) {
    if (!first.finalized || !second.finalized || first.id === second.id || first.ballLevel !== second.ballLevel || first.ballLevel >= this.maxLevel) return null;
    if (first.segments.length === 0 || second.segments.length === 0) return null;
    const radius = this.config.magnetRadius * (this.config.magnetRadiusMultipliers[first.ballLevel] ?? 1);
    let best = { distance: Infinity, x: 0, y: 0 };
    for (let i = 0; i < Math.max(1, first.segments.length - 1); i++) {
      const a = first.segments[i];
      const b = first.segments[i + 1] ?? a;
      for (let j = 0; j < Math.max(1, second.segments.length - 1); j++) {
        const c = second.segments[j];
        const d = second.segments[j + 1] ?? c;
        const candidate = closestSegments(a, b, c, d);
        if (candidate.distance < best.distance) best = candidate;
      }
    }
    return best.distance <= radius ? best : null;
  }

  checkMerges(): Merge[] {
    const merges: Merge[] = [];
    const tracks = Array.from(this.tracks.values());
    const reserved = new Set<number>();
    for (let i = 0; i < tracks.length; i++) {
      const first = tracks[i];
      if (reserved.has(first.id)) continue;
      for (let j = i + 1; j < tracks.length; j++) {
        const second = tracks[j];
        if (reserved.has(second.id)) continue;
        const match = this.match(first, second);
        if (!match) continue;
        merges.push({ track1Id: first.id, track2Id: second.id, newLevel: first.ballLevel + 1, x: match.x, y: match.y });
        reserved.add(first.id);
        reserved.add(second.id);
        break;
      }
    }
    return merges;
  }

  processMerge(track1Id: number, track2Id: number, newLevel: number, _x: number, _y: number): number | undefined {
    const first = this.tracks.get(track1Id);
    const second = this.tracks.get(track2Id);
    if (!first || !second || newLevel !== first.ballLevel + 1) return;
    const match = this.match(first, second);
    if (!match) return;
    this.tracks.delete(track1Id);
    this.tracks.delete(track2Id);
    const id = this.nextTrackId++;
    this.tracks.set(id, { id, ballLevel: newLevel, segments: [{ x: match.x, y: match.y, timestamp: 0 }], createdAt: this.shotCount, opacity: this.config.baseOpacity, finalized: true });
    this.events.onMerge?.(track1Id, track2Id, newLevel, match.x, match.y, id);
    return id;
  }

  getTracks(): Map<number, AfterimageTrack> { return new Map(this.tracks); }
  getTrack(id: number): AfterimageTrack | undefined { return this.tracks.get(id); }
  getShotCount(): number { return this.shotCount; }

  reset(): void {
    const ids = Array.from(this.tracks.keys());
    for (let i = 0; i < ids.length; i++) this.removeTrack(ids[i]);
    this.nextTrackId = 1;
    this.shotCount = 0;
  }
}
