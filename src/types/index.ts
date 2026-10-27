export interface BallLevel {
  level: number;
  radius: number;
  color: number;
  score: number;
  sprite?: string;
}

export interface BoardObstacle {
  x: number;
  y: number;
  radius?: number;
  width?: number;
  height?: number;
  angle?: number;
}

export interface LevelConfig {
  title?: string;
  hint?: string;
  obstacles?: BoardObstacle[];
  presetBalls?: { x: number; y: number; level: number }[];
  shotSequence?: number[];
  shakes?: number;
  swaps?: number;
  chapterEnd?: boolean;
  level: number;
  targetScore: number;
  targetBallLevel?: number;
  shots: number;
}

export interface Upgrade {
  id: string;
  name: string;
  description: string;
  type: 'stat' | 'multiplier' | 'passive';
  value: number;
}

export interface GameState {
  currentLevel: number;
  score: number;
  highestBallLevel: number;
  shotsRemaining: number;
  combo: number;
  comboTimer: number;
  upgrades: Upgrade[];
  scoreMultiplier: number;
  startingBallLevel: number;
  wallBounceScore: number;
  mergeChainBonus: number;
  ballSizeMultiplier: number;
}

export interface GameConfig {
  width: number;
  height: number;
  background?: string;
  physics: PhysicsConfig;
  board: BoardConfig;
  launcher: LauncherConfig;
  scoring: ScoringConfig;
}

export interface PhysicsConfig {
  gravity: number;
  restitution: number;
  friction: number;
  frictionAir: number;
  density: number;
}

export interface BoardConfig {
  pegPositions?: { x: number; y: number }[];
  pegRows: number;
  pegColumns: number;
  pegRadius: number;
  pegColor: number;
  pegStrokeColor?: number;
  pegStrokeWidth?: number;
  startY: number;
  endY: number;
  spacing: number;
}

export interface LauncherConfig {
  startX: number;
  startY: number;
  aimLineLength: number;
  launchForce: number;
}

export interface ScoringConfig {
  comboDecayTime: number;
  comboMultiplier: number;
}

export interface AfterimageTrack {
  finalized: boolean;
  id: number;
  ballLevel: number;
  segments: AfterimageSegment[];
  createdAt: number;
  opacity: number;
}

export interface AfterimageSegment {
  x: number;
  y: number;
  timestamp: number;
}

export interface AfterimageConfig {
  maxSegments?: number;
  enabled: boolean;
  maxTracks: number;
  fadeAfterShots: number;
  segmentInterval: number;
  segmentThickness: number;
  baseOpacity: number;
  magnetRadius: number;
  magnetRadiusMultipliers: { [level: number]: number };
  mergeCheckInterval: number;
}
