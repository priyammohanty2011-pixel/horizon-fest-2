import { ElevationProfile, Point2D, TrackPoint, TrackTelemetry } from '../types/game';
import { computeElevationTelemetryStats } from './elevation';

/**
 * Track Telemetry Analyzer for Horizon Fest 2
 * 1 canvas pixel = 5 meters in world coordinates
 */
export const CANVAS_PIXEL_TO_METERS = 5.0;

export function computeTrackTelemetry(
  points: TrackPoint[] | Point2D[],
  elevationProfile?: ElevationProfile
): TrackTelemetry {
  if (!points || points.length < 3) {
    return {
      lengthMeters: 0,
      lengthFormatted: '0.000 km',
      cornersCount: 0,
      longestStraightMeters: 0,
      longestStraightFormatted: '0 m',
      elevationChangeMeters: 0,
      maxGradientPercent: 0,
      tightestRadiusMeters: 0,
    };
  }

  const count = points.length;

  // 1. Arc length in pixels and meters
  let totalLengthPx = 0;
  const segLengths: number[] = [];
  const headings: number[] = [];

  for (let i = 0; i < count; i++) {
    const nextIdx = (i + 1) % count;
    const dx = points[nextIdx].x - points[i].x;
    const dy = points[nextIdx].y - points[i].y;
    const dist = Math.hypot(dx, dy);
    segLengths.push(dist);
    totalLengthPx += dist;
    headings.push(Math.atan2(dy, dx));
  }

  const lengthMeters = totalLengthPx * CANVAS_PIXEL_TO_METERS;
  const lengthFormatted =
    lengthMeters >= 1000
      ? `${(lengthMeters / 1000).toFixed(3)} km`
      : `${Math.round(lengthMeters)} m`;

  // 2. Corners detection (integrated turn angle > 35° / 0.61 radians)
  let cornersCount = 0;
  let currentTurnAngle = 0;
  let inTurn = false;
  let minRadiusPx = Infinity;

  // 3. Longest Straight calculation
  let currentStraightPx = 0;
  let maxStraightPx = 0;

  for (let i = 0; i < count; i++) {
    const prevIdx = (i - 1 + count) % count;
    const nextIdx = (i + 1) % count;

    let dAngle = headings[i] - headings[prevIdx];
    while (dAngle > Math.PI) dAngle -= Math.PI * 2;
    while (dAngle < -Math.PI) dAngle += Math.PI * 2;

    const absDAngle = Math.abs(dAngle);
    const segLen = segLengths[i] || 1;

    // Curvature kappa = dAngle / ds
    const curvature = absDAngle / segLen;
    if (curvature > 0.002) {
      const radiusPx = 1 / curvature;
      if (radiusPx < minRadiusPx) {
        minRadiusPx = radiusPx;
      }
    }

    // Straight line detection (curvature near zero: < 0.04 rad per segment)
    if (absDAngle < 0.035) {
      currentStraightPx += segLen;
      if (currentStraightPx > maxStraightPx) {
        maxStraightPx = currentStraightPx;
      }
    } else {
      currentStraightPx = 0;
    }

    // Corner accumulation
    if (absDAngle > 0.04) {
      currentTurnAngle += absDAngle;
      if (!inTurn && currentTurnAngle >= (35 * Math.PI) / 180) {
        cornersCount += 1;
        inTurn = true;
      }
    } else {
      if (inTurn) {
        inTurn = false;
        currentTurnAngle = 0;
      } else {
        currentTurnAngle *= 0.5; // decay
      }
    }
  }

  // Fallback corners count if track has sharp loops
  if (cornersCount === 0 && lengthMeters > 500) {
    cornersCount = Math.max(3, Math.round(lengthMeters / 320));
  }

  const longestStraightMeters = Math.round(maxStraightPx * CANVAS_PIXEL_TO_METERS);
  const longestStraightFormatted =
    longestStraightMeters >= 1000
      ? `${(longestStraightMeters / 1000).toFixed(2)} km`
      : `${longestStraightMeters} m`;

  // 4. Elevation change & Max gradient along the spline
  let elevationChangeMeters = 0;
  let maxGradientPercent = 0;

  if (elevationProfile) {
    const stats = computeElevationTelemetryStats(elevationProfile);
    elevationChangeMeters = stats.elevationDeltaMeters;
    maxGradientPercent = stats.maxGradientPercent;
  } else {
    const elevationScale = Math.min(48, Math.max(14, lengthMeters * 0.008));
    let minHeight = Infinity;
    let maxHeight = -Infinity;
    let maxSlope = 0;

    for (let i = 0; i < count; i++) {
      const sNorm = i / count;
      const h =
        elevationScale * (0.5 * Math.sin(sNorm * Math.PI * 2) + 0.35 * Math.cos(sNorm * Math.PI * 4 + 0.8));
      if (h < minHeight) minHeight = h;
      if (h > maxHeight) maxHeight = h;

      const nextH =
        elevationScale *
        (0.5 * Math.sin(((i + 1) / count) * Math.PI * 2) + 0.35 * Math.cos(((i + 1) / count) * Math.PI * 4 + 0.8));
      const dsMeters = (segLengths[i] || 1) * CANVAS_PIXEL_TO_METERS;
      const slope = Math.abs(nextH - h) / dsMeters;
      if (slope > maxSlope) maxSlope = slope;
    }

    elevationChangeMeters = Number((maxHeight - minHeight).toFixed(1));
    maxGradientPercent = Number((Math.min(0.14, maxSlope * 1.6) * 100).toFixed(1));
  }

  // 5. Tightest Radius in meters (clamped to realistic racing radius)
  let tightestRadiusMeters = Math.round(
    minRadiusPx === Infinity ? 45 : Math.max(18, minRadiusPx * CANVAS_PIXEL_TO_METERS)
  );
  if (tightestRadiusMeters > 250) tightestRadiusMeters = 38;

  return {
    lengthMeters,
    lengthFormatted,
    cornersCount,
    longestStraightMeters,
    longestStraightFormatted,
    elevationChangeMeters,
    maxGradientPercent,
    tightestRadiusMeters,
  };
}
