export interface BallLevel {
  level: number;
  radius: number;
  color: number;
  score: number;
}

export interface LevelConfig {
  level: number;
  targetScore: number;
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
  pegRows: number;
  pegColumns: number;
  pegRadius: number;
  pegColor: number;
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
