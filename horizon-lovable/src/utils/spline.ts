import { Point2D, Track, TrackPoint } from '../types/game';
import { computeTrackTelemetry } from './trackAnalytics';
import { createDefaultElevationProfile } from './elevation';

/**
 * Catmull-Rom Spline and Track Math for Horizon Fest 2
 */

export function distanceBetween(p1: Point2D, p2: Point2D): number {
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  return Math.sqrt(dx * dx + dy * dy);
}

// Distance from point P to line segment AB
export function distanceToSegment(p: Point2D, a: Point2D, b: Point2D): { distance: number; projection: Point2D; t: number } {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lenSq = dx * dx + dy * dy;

  if (lenSq === 0) {
    return {
      distance: distanceBetween(p, a),
      projection: a,
      t: 0,
    };
  }

  // Projection scalar t on line segment
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / lenSq));
  const projX = a.x + t * dx;
  const projY = a.y + t * dy;

  const dist = distanceBetween(p, { x: projX, y: projY });
  return {
    distance: dist,
    projection: { x: projX, y: projY },
    t,
  };
}

/**
 * Evaluates a point on Catmull-Rom curve with tension 0.5
 */
function catmullRomPoint(p0: Point2D, p1: Point2D, p2: Point2D, p3: Point2D, t: number): Point2D {
  const t2 = t * t;
  const t3 = t2 * t;

  const f0 = -0.5 * t3 + t2 - 0.5 * t;
  const f1 = 1.5 * t3 - 2.5 * t2 + 1.0;
  const f2 = -1.5 * t3 + 2.0 * t2 + 0.5 * t;
  const f3 = 0.5 * t3 - 0.5 * t2;

  return {
    x: p0.x * f0 + p1.x * f1 + p2.x * f2 + p3.x * f3,
    y: p0.y * f0 + p1.y * f1 + p2.y * f2 + p3.y * f3,
  };
}

/**
 * Smooth raw drawn points into uniform track points
 */
export function generateTrackFromRawPoints(
  rawPoints: Point2D[],
  trackWidth: number,
  closeLoop: boolean = true,
  smoothingMode: string = 'Normal'
): Track | null {
  if (rawPoints.length < 5) return null;

  // Clone points and snap closing segment if close to start point
  const inputPts = rawPoints.map((p) => ({ ...p }));
  if (closeLoop && inputPts.length > 6) {
    const startP = inputPts[0];
    const endP = inputPts[inputPts.length - 1];
    const snapRadius = Math.max(35, trackWidth * 1.2);
    if (distanceBetween(startP, endP) < snapRadius) {
      inputPts[inputPts.length - 1] = { ...startP };
    }
  }

  // Filter out points that are too close together
  const minSpacing = smoothingMode === 'Smooth' ? 18 : smoothingMode === 'Raw' ? 12 : 15;
  const filtered: Point2D[] = [inputPts[0]];
  for (let i = 1; i < inputPts.length; i++) {
    if (distanceBetween(filtered[filtered.length - 1], inputPts[i]) >= minSpacing) {
      filtered.push(inputPts[i]);
    }
  }

  // If closing loop, remove the last point if it ended too close to start point
  if (closeLoop && filtered.length > 5) {
    if (distanceBetween(filtered[filtered.length - 1], filtered[0]) < minSpacing) {
      filtered.pop();
    }
  }

  if (filtered.length < 5) return null;

  // Corner smoothing (Chaikin / Laplacian filleting passes to eliminate sharp kinks & swallowtails)
  let smoothedPts = filtered;
  const smoothingPasses = smoothingMode === 'Smooth' ? 2 : smoothingMode === 'Raw' ? 0 : 1;

  if (smoothingPasses > 0 && smoothedPts.length > 5) {
    for (let pass = 0; pass < smoothingPasses; pass++) {
      const nextPts: Point2D[] = [];
      const len = smoothedPts.length;
      for (let i = 0; i < len; i++) {
        if (!closeLoop && (i === 0 || i === len - 1)) {
          nextPts.push({ ...smoothedPts[i] });
          continue;
        }
        const prev = smoothedPts[(i - 1 + len) % len];
        const curr = smoothedPts[i];
        const next = smoothedPts[(i + 1) % len];
        nextPts.push({
          x: 0.25 * prev.x + 0.5 * curr.x + 0.25 * next.x,
          y: 0.25 * prev.y + 0.5 * curr.y + 0.25 * next.y,
        });
      }
      smoothedPts = nextPts;
    }
  }

  const n = smoothedPts.length;
  const interpolated: Point2D[] = [];
  const stepsPerSegment = 10;
  const segCount = closeLoop ? n : n - 1;

  // Generate smooth spline points
  // For closed loop, n segments connect: 0->1, 1->2, ..., (n-1)->0 seamlessly
  for (let i = 0; i < segCount; i++) {
    const p0 = smoothedPts[(i - 1 + n) % n];
    const p1 = smoothedPts[i % n];
    const p2 = smoothedPts[(i + 1) % n];
    const p3 = smoothedPts[(i + 2) % n];

    for (let step = 0; step < stepsPerSegment; step++) {
      const t = step / stepsPerSegment;
      interpolated.push(catmullRomPoint(p0, p1, p2, p3, t));
    }
  }

  if (interpolated.length < 8) return null;

  const m = interpolated.length;
  const targetSpacing = 12;
  const uniformPoints: Point2D[] = [];

  if (closeLoop) {
    // Cumulative arc length around the closed loop
    const cumDists = [0];
    for (let i = 0; i < m - 1; i++) {
      cumDists.push(cumDists[i] + distanceBetween(interpolated[i], interpolated[i + 1]));
    }
    const totalPerimeter = cumDists[m - 1] + distanceBetween(interpolated[m - 1], interpolated[0]);

    const numUniform = Math.max(8, Math.round(totalPerimeter / targetSpacing));
    const stepDist = totalPerimeter / numUniform;

    let polyIdx = 0;
    for (let k = 0; k < numUniform; k++) {
      const targetDist = k * stepDist;
      while (polyIdx < m - 1 && cumDists[polyIdx + 1] < targetDist) {
        polyIdx++;
      }

      const pA = interpolated[polyIdx];
      const pB = interpolated[(polyIdx + 1) % m];
      const distA = cumDists[polyIdx];
      const segLen = polyIdx === m - 1 ? totalPerimeter - distA : cumDists[polyIdx + 1] - distA;

      if (segLen <= 0.0001) {
        uniformPoints.push({ x: pA.x, y: pA.y });
      } else {
        const frac = Math.max(0, Math.min(1, (targetDist - distA) / segLen));
        uniformPoints.push({
          x: pA.x + (pB.x - pA.x) * frac,
          y: pA.y + (pB.y - pA.y) * frac,
        });
      }
    }
  } else {
    // Open path resampling
    uniformPoints.push(interpolated[0]);
    let accumulatedDist = 0;
    for (let i = 1; i < m; i++) {
      const d = distanceBetween(interpolated[i - 1], interpolated[i]);
      accumulatedDist += d;
      if (accumulatedDist >= targetSpacing) {
        uniformPoints.push(interpolated[i]);
        accumulatedDist = 0;
      }
    }
    if (distanceBetween(uniformPoints[uniformPoints.length - 1], interpolated[m - 1]) > 4) {
      uniformPoints.push(interpolated[m - 1]);
    }
  }

  if (uniformPoints.length < 8) return null;

  // Build track points with normals, curbs, and cumulative distance
  const totalCount = uniformPoints.length;
  const trackPoints: TrackPoint[] = [];
  let currentDist = 0;

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (let i = 0; i < totalCount; i++) {
    const prev = uniformPoints[(i - 1 + totalCount) % totalCount];
    const curr = uniformPoints[i];
    const next = uniformPoints[(i + 1) % totalCount];

    // Tangent angle
    const dx = next.x - prev.x;
    const dy = next.y - prev.y;
    const angle = Math.atan2(dy, dx);

    // Normal vector perpendicular to tangent
    const nx = -Math.sin(angle);
    const ny = Math.cos(angle);

    const halfW = trackWidth / 2;

    const leftCurb: Point2D = {
      x: curr.x + nx * halfW,
      y: curr.y + ny * halfW,
    };
    const rightCurb: Point2D = {
      x: curr.x - nx * halfW,
      y: curr.y - ny * halfW,
    };

    if (i > 0) {
      currentDist += distanceBetween(uniformPoints[i - 1], curr);
    }

    minX = Math.min(minX, curr.x - halfW - 20);
    minY = Math.min(minY, curr.y - halfW - 20);
    maxX = Math.max(maxX, curr.x + halfW + 20);
    maxY = Math.max(maxY, curr.y + halfW + 20);

    trackPoints.push({
      x: curr.x,
      y: curr.y,
      angle,
      leftCurb,
      rightCurb,
      distance: currentDist,
    });
  }

  // Distribute 16 checkpoints along the loop
  const numCheckpoints = 16;
  const checkpoints: Point2D[] = [];
  for (let c = 0; c < numCheckpoints; c++) {
    const idx = Math.floor((c / numCheckpoints) * totalCount);
    checkpoints.push({ x: trackPoints[idx].x, y: trackPoints[idx].y });
  }

  // Start position and angle
  const startPoint = { x: trackPoints[0].x, y: trackPoints[0].y };
  const startAngle = trackPoints[0].angle;

  const defaultElevation = createDefaultElevationProfile('rolling', 1.0);

  return {
    rawPoints,
    points: trackPoints,
    width: trackWidth,
    isClosed: closeLoop,
    totalLength: currentDist,
    checkpoints,
    startPoint,
    startAngle,
    bounds: { minX, minY, maxX, maxY },
    elevationProfile: defaultElevation,
    telemetry: computeTrackTelemetry(trackPoints, defaultElevation),
  };
}

/**
 * Checks nearest track segment distance and track info for a car coordinate
 */
export function getCarTrackStatus(
  pos: Point2D,
  track: Track
): {
  distanceToCenter: number;
  boundaryLimit: number;
  isOnTrack: boolean;
  isOnCurb: boolean;
  isOffroad: boolean;
  isHitBoundary: boolean;
  closestPointIndex: number;
  nearestPoint: Point2D;
} {
  let minDistance = Infinity;
  let closestIndex = 0;
  let nearestPoint: Point2D = track.points[0];

  const pts = track.points;
  const count = pts.length;

  for (let i = 0; i < count; i++) {
    const nextIdx = (i + 1) % count;
    const { distance, projection } = distanceToSegment(pos, pts[i], pts[nextIdx]);

    if (distance < minDistance) {
      minDistance = distance;
      closestIndex = i;
      nearestPoint = projection;
    }
  }

  const halfWidth = track.width / 2;
  const curbExtra = 8; // width of curbs
  const boundaryLimit = halfWidth + curbExtra + 4; // Solid boundary wall

  const isOnTrack = minDistance <= halfWidth;
  const isOnCurb = minDistance > halfWidth && minDistance <= halfWidth + curbExtra;
  const isOffroad = minDistance > halfWidth + curbExtra;
  const isHitBoundary = minDistance >= boundaryLimit;

  return {
    distanceToCenter: minDistance,
    boundaryLimit,
    isOnTrack,
    isOnCurb,
    isOffroad,
    isHitBoundary,
    closestPointIndex: closestIndex,
    nearestPoint,
  };
}
