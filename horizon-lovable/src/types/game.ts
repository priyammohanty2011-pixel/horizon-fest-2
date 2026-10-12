export type GameMode = 'DRAW' | 'RACE';

export type Camera3DMode = 'chase' | 'cockpit' | 'isometric' | 'drone';

export type { EnvironmentType } from '../utils/environments';

export interface Point2D {
  x: number;
  y: number;
}

export interface TrackPoint extends Point2D {
  angle: number;       // Tangent angle in radians
  leftCurb: Point2D;   // Left curb position
  rightCurb: Point2D;  // Right curb position
  distance: number;    // Cumulative distance along track
}

export interface Track {
  rawPoints: Point2D[];
  points: TrackPoint[];
  width: number;
  isClosed: boolean;
  totalLength: number;
  checkpoints: Point2D[];
  startPoint: Point2D;
  startAngle: number;
  bounds: {
    minX: number;
    minY: number;
    maxX: number;
    maxY: number;
  };
  telemetry?: TrackTelemetry;
  elevationProfile?: ElevationProfile;
}

export interface ElevationControlNode {
  id: string;
  progress: number; // 0.0 to 1.0 along track
  label: string;
  height: number;   // in meters (-15m to +45m)
}

export interface ElevationProfile {
  preset: 'flat' | 'rolling' | 'mountain' | 'rollercoaster' | 'eaurouge' | 'custom';
  heightMultiplier: number;
  nodes: ElevationControlNode[];
}

export interface TrackTelemetry {
  lengthMeters: number;
  lengthFormatted: string; // e.g. "3.233 km"
  cornersCount: number;    // inflection points > 35°
  longestStraightMeters: number;
  longestStraightFormatted: string;
  elevationChangeMeters: number; // e.g. 24.5 m
  maxGradientPercent: number;    // e.g. 6.2%
  tightestRadiusMeters: number;  // e.g. 32 m
}

export interface CarConfig {
  id: string;
  name: string;
  category: string;
  color: string;
  accentColor: string;
  topSpeed: number;     // px/s
  accel: number;        // px/s^2
  brakeForce: number;   // px/s^2
  handling: number;     // radians/s turning rate
  driftGrip: number;    // 0 to 1 (lower = more slide)
  offroadPenalty: number;// speed multiplier off track (e.g. 0.35)
  downforce?: number;    // aero stability factor
  counterSteerAssist?: number; // drift stabilization factor
}

export interface CarState {
  x: number;
  y: number;
  vx: number;
  vy: number;
  angle: number;
  angularVelocity: number;
  speed: number;
  lateralSlip: number;
  isDrifting: boolean;
  isOffroad: boolean;
  steerAngle: number;
  rpm: number;
  throttle: number;
  brake: number;
  bodyRoll?: number;     // dynamic chassis roll in radians
  bodyPitch?: number;    // dynamic chassis squat/dive pitch in radians
  gear?: number;         // 1 to 6, 0 = N, -1 = R
  driftScore?: number;   // active accumulated drift points
  driftMultiplier?: number; // combo multiplier (1.0 to 4.0)
  exhaustFlame?: boolean;// backfire flame active
  turboBoost?: number;   // 0 to 1
  brakeGlow?: number;    // 0 to 1 rotor heat glow
}

export interface SkidMark {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  alpha: number;
  width: number;
}

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  color: string;
  type: 'smoke' | 'grass' | 'exhaust' | 'spark';
}

export interface GhostFrame {
  time: number;
  x: number;
  y: number;
  angle: number;
}

export interface GhostData {
  lapTime: number;
  frames: GhostFrame[];
}

export interface LapStats {
  currentLap: number;
  totalLaps: number;
  currentLapTime: number;
  bestLapTime: number | null;
  lastLapTime: number | null;
  lapTimes: number[];
  checkpointsHit: Set<number>;
  deltaToBest: number | null;
}
