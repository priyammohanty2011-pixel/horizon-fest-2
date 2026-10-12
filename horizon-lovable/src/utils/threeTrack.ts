import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { ElevationProfile, Point2D, Track } from '../types/game';
import { ENVIRONMENTS, EnvironmentType } from './environments';
import {
  createBarrierChevronTexture,
  createBarrierTexture,
  createCheckeredTexture,
  createGantryBannerTexture,
  createGrassTexture,
  createKerbTexture,
  createRoadTexture,
  createTurnSignTexture,
} from './threeAssets';
import { getCarTrackStatus } from './spline';
import { getTrackElevationAtProgress } from './elevation';

export const TRACK_3D_SCALE = 0.22;

export function getElevationAtRatio(sRatio: number, profile?: ElevationProfile): number {
  if (profile) {
    return getTrackElevationAtProgress(sRatio, profile) * 0.22;
  }
  return 0;
}

// 2D Ray-casting point-in-polygon test for detecting track infield
export function isPointInsidePolygon(px: number, py: number, polygon: Point2D[]): boolean {
  let inside = false;
  const count = polygon.length;
  for (let i = 0, j = count - 1; i < count; j = i++) {
    const xi = polygon[i].x;
    const yi = polygon[i].y;
    const xj = polygon[j].x;
    const yj = polygon[j].y;
    const intersect =
      yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi;
    if (intersect) {
      inside = !inside;
    }
  }
  return inside;
}

// 3D Tree Foliage Archetype Geometries (Crafted with base anchored at y = 0)
function createPineFoliageGeometry(): THREE.BufferGeometry {
  const g1 = new THREE.ConeGeometry(2.4, 2.8, 7);
  g1.translate(0, 2.5, 0);
  const g2 = new THREE.ConeGeometry(1.9, 2.4, 7);
  g2.translate(0, 4.0, 0);
  const g3 = new THREE.ConeGeometry(1.3, 2.0, 7);
  g3.translate(0, 5.3, 0);
  const merged = mergeGeometries([g1, g2, g3]);
  if (merged) {
    merged.computeVertexNormals();
    return merged;
  }
  const fallback = new THREE.ConeGeometry(2.3, 5.2, 7);
  fallback.translate(0, 3.8, 0);
  return fallback;
}

function createDeciduousFoliageGeometry(): THREE.BufferGeometry {
  const g1 = new THREE.DodecahedronGeometry(2.3, 1);
  g1.translate(0, 4.2, 0);
  const g2 = new THREE.DodecahedronGeometry(1.65, 1);
  g2.translate(1.0, 3.8, 0.4);
  const g3 = new THREE.DodecahedronGeometry(1.55, 1);
  g3.translate(-0.9, 3.9, -0.4);
  const g4 = new THREE.DodecahedronGeometry(1.35, 1);
  g4.translate(0.2, 5.3, -0.2);
  const merged = mergeGeometries([g1, g2, g3, g4]);
  if (merged) {
    merged.computeVertexNormals();
    return merged;
  }
  const fallback = new THREE.SphereGeometry(2.5, 8, 8);
  fallback.translate(0, 4.2, 0);
  return fallback;
}

function createCypressFoliageGeometry(): THREE.BufferGeometry {
  const g1 = new THREE.ConeGeometry(1.35, 5.2, 7);
  g1.translate(0, 4.4, 0);
  const g2 = new THREE.CylinderGeometry(1.05, 1.35, 2.6, 7);
  g2.translate(0, 2.7, 0);
  const merged = mergeGeometries([g1, g2]);
  if (merged) {
    merged.computeVertexNormals();
    return merged;
  }
  const fallback = new THREE.ConeGeometry(1.4, 5.8, 7);
  fallback.translate(0, 4.0, 0);
  return fallback;
}

export interface Track3DResult {
  trackGroup: THREE.Group;
  centerX: number;
  centerZ: number;
  worldTo3D: (x: number, y: number) => { x: number; z: number };
  start3DPos: { x: number; y: number; z: number };
  start3DAngle: number;
  start3DPitch: number;
  baseGroundY: number;
}

export function build3DTrack(
  track: Track,
  userBarrierDistance?: number,
  environment: EnvironmentType = 'pacific_coast'
): Track3DResult {
  const trackGroup = new THREE.Group();

  const b = track.bounds;
  const centerX = (b.minX + b.maxX) / 2;
  const centerY = (b.minY + b.maxY) / 2;

  const worldTo3D = (x: number, y: number) => ({
    x: (x - centerX) * TRACK_3D_SCALE,
    z: (y - centerY) * TRACK_3D_SCALE,
  });

  const pts = track.points;
  const count = pts.length;
  if (count < 4) {
    return {
      trackGroup,
      centerX,
      centerZ: centerY,
      worldTo3D,
      start3DPos: { x: 0, y: 0, z: 0 },
      start3DAngle: 0,
      start3DPitch: 0,
      baseGroundY: 0,
    };
  }

  const roadHalfW = (track.width * TRACK_3D_SCALE) / 2;
  const curbW = 1.6;
  const barrierOffset = 0.2; // directly outside curb
  const barrierHeight = 1.05; // realistic touge / circuit safety barrier height
  const barrierThickness = 0.35; // solid 3D barrier channel width with top rail
  const shoulderW = 2.4; // compact grass shoulder outside barrier

  // Track elevation profile
  const getElevation = (sRatio: number): number => {
    return getElevationAtRatio(sRatio, track.elevationProfile);
  };

  // Find exact min/max elevation across the entire circuit
  let minTrackElev = Infinity;
  let maxTrackElev = -Infinity;
  for (let i = 0; i <= count; i++) {
    const el = getElevation(i / count);
    if (el < minTrackElev) minTrackElev = el;
    if (el > maxTrackElev) maxTrackElev = el;
  }
  // Base ground is placed safely below the lowest dip so it NEVER intersects any track section
  const baseGroundY = Math.min(0, minTrackElev - 0.5);

  // 1. ROAD ASPHALT GEOMETRY
  const roadVerts: number[] = [];
  const roadNorms: number[] = [];
  const roadUvs: number[] = [];
  const roadIndices: number[] = [];

  // 2. CURBS GEOMETRY
  const leftCurbVerts: number[] = [];
  const leftCurbUvs: number[] = [];
  const leftCurbIndices: number[] = [];

  const rightCurbVerts: number[] = [];
  const rightCurbUvs: number[] = [];
  const rightCurbIndices: number[] = [];

  // 3. ARMCO BOUNDARY BARRIERS
  const leftBarrierVerts: number[] = [];
  const leftBarrierUvs: number[] = [];
  const leftBarrierIndices: number[] = [];

  const rightBarrierVerts: number[] = [];
  const rightBarrierUvs: number[] = [];
  const rightBarrierIndices: number[] = [];

  // 3b. GLOWING DIRECTIONAL CHEVRON ARROW RAILS (Mounted on top of every barrier)
  const leftChevronVerts: number[] = [];
  const leftChevronUvs: number[] = [];
  const leftChevronIndices: number[] = [];

  const rightChevronVerts: number[] = [];
  const rightChevronUvs: number[] = [];
  const rightChevronIndices: number[] = [];

  // 4. GRASS SHOULDERS OUTSIDE BARRIERS
  const shoulderVerts: number[] = [];
  const shoulderUvs: number[] = [];
  const shoulderIndices: number[] = [];

  // 5. VERTICAL EMBANKMENT SKIRT WALLS (Connecting track shoulders down to base ground)
  const skirtVerts: number[] = [];
  const skirtUvs: number[] = [];
  const skirtIndices: number[] = [];

  const stanchionPositions: { x: number; y: number; z: number; rotY: number }[] = [];
  const segmentElevations: number[] = [];

  // 6. TURN WARNING SIGNS SAMPLES (For placing elevated directional arrow signposts at curves)
  const turnSampleData: {
    idx: number;
    cross: number;
    turnAngle: number;
    dist: number;
    center: { x: number; y: number; z: number };
    tNorm: { x: number; z: number };
    inLb: { x: number; z: number };
    outLb: { x: number; z: number };
    inRb: { x: number; z: number };
    outRb: { x: number; z: number };
    isLbSafe: boolean;
    isRbSafe: boolean;
    elevY: number;
  }[] = [];

  let accumulatedDist = 0;

  // Pre-calculate 3D road center coordinates for spatial proximity queries
  const roadCenters: { x: number; z: number }[] = [];
  for (let c = 0; c < count; c++) {
    roadCenters.push(worldTo3D(pts[c].x, pts[c].y));
  }

  // Fast distance from point P to road segment AB
  const distToSeg = (px: number, pz: number, ax: number, az: number, bx: number, bz: number): number => {
    const dx = bx - ax;
    const dz = bz - az;
    const lSq = dx * dx + dz * dz;
    if (lSq === 0) return Math.hypot(px - ax, pz - az);
    const t = Math.max(0, Math.min(1, ((px - ax) * dx + (pz - az) * dz) / lSq));
    return Math.hypot(px - (ax + t * dx), pz - (az + t * dz));
  };

  // Check if a point falls within another (non-adjacent) road segment surface
  const isInsideOtherRoad = (px: number, pz: number, selfIdx: number, buffer: number = 0): boolean => {
    const ignoreRadius = 8;
    for (let j = 0; j < count; j++) {
      const diff = Math.min(Math.abs(j - selfIdx), count - Math.abs(j - selfIdx));
      if (diff <= ignoreRadius) continue;
      const a = roadCenters[j];
      const b = roadCenters[(j + 1) % count];
      if (distToSeg(px, pz, a.x, a.z, b.x, b.z) < roadHalfW + buffer) {
        return true;
      }
    }
    return false;
  };

  const leftBarrierActive: boolean[] = [];
  const rightBarrierActive: boolean[] = [];
  const leftCurbActive: boolean[] = [];
  const rightCurbActive: boolean[] = [];
  const leftBarrierPos: { x: number; z: number }[] = [];
  const rightBarrierPos: { x: number; z: number }[] = [];
  const leftCurbPos: { x: number; z: number }[] = [];
  const rightCurbPos: { x: number; z: number }[] = [];

  for (let i = 0; i <= count; i++) {
    const idx = i % count;
    const prevIdx = (idx - 1 + count) % count;
    const nextIdx = (idx + 1) % count;

    const curr2D = pts[idx];
    const prev2D = pts[prevIdx];
    const next2D = pts[nextIdx];

    const curr3D = worldTo3D(curr2D.x, curr2D.y);
    const prev3D = worldTo3D(prev2D.x, prev2D.y);
    const next3D = worldTo3D(next2D.x, next2D.y);

    const sRatio = i / count;
    const elevY = getElevation(sRatio);
    segmentElevations.push(elevY);

    // Tangent in XZ plane
    const tx = next3D.x - prev3D.x;
    const tz = next3D.z - prev3D.z;
    const tLen = Math.hypot(tx, tz) || 1;
    const tNormX = tx / tLen;
    const tNormZ = tz / tLen;

    // Normal perpendicular to tangent in XZ plane (points to the left)
    const nx = -tNormZ;
    const nz = tNormX;

    // Curvature & turning direction to clamp inner offset and prevent swallowtail fold-overs
    const tx1 = curr3D.x - prev3D.x;
    const tz1 = curr3D.z - prev3D.z;
    const len1 = Math.hypot(tx1, tz1) || 1;
    const t1x = tx1 / len1;
    const t1z = tz1 / len1;

    const tx2 = next3D.x - curr3D.x;
    const tz2 = next3D.z - curr3D.z;
    const len2 = Math.hypot(tx2, tz2) || 1;
    const t2x = tx2 / len2;
    const t2z = tz2 / len2;

    const cross = t1x * t2z - t1z * t2x;
    const dot = Math.max(-1, Math.min(1, t1x * t2x + t1z * t2z));
    const turnAngle = Math.acos(dot);
    const ds = (len1 + len2) / 2;
    const radius = turnAngle > 0.001 ? ds / turnAngle : Infinity;

    // Maximum safe inner offset before self-intersection occurs:
    const maxInnerD = Math.max(1.8, radius * 0.85);

    // If cross > 0: turning left (left side is inner apex)
    // If cross < 0: turning right (right side is inner apex)
    const nominalBarrierD = userBarrierDistance !== undefined
      ? Math.max(roadHalfW + curbW + 0.1, userBarrierDistance)
      : (roadHalfW + curbW + barrierOffset);
    const effLeftD = cross > 0 ? Math.min(nominalBarrierD, maxInnerD) : nominalBarrierD;
    const effRightD = cross < 0 ? Math.min(nominalBarrierD, maxInnerD) : nominalBarrierD;
    const effLeftCurbW = cross > 0 ? Math.min(curbW, Math.max(0.4, effLeftD - roadHalfW)) : curbW;
    const effRightCurbW = cross < 0 ? Math.min(curbW, Math.max(0.4, effRightD - roadHalfW)) : curbW;

    if (i > 0) {
      accumulatedDist += Math.hypot(curr3D.x - prev3D.x, curr3D.z - prev3D.z);
    }

    // Road edges
    const lX = curr3D.x + nx * roadHalfW;
    const lZ = curr3D.z + nz * roadHalfW;
    const rX = curr3D.x - nx * roadHalfW;
    const rZ = curr3D.z - nz * roadHalfW;

    // Road Vertices (elevY + 0.04)
    roadVerts.push(lX, elevY + 0.04, lZ);
    roadVerts.push(rX, elevY + 0.04, rZ);
    roadNorms.push(0, 1, 0, 0, 1, 0);

    const vCoord = accumulatedDist / (roadHalfW * 2);
    roadUvs.push(0, vCoord, 1, vCoord);

    // Curbs
    const lcOuterX = curr3D.x + nx * (roadHalfW + effLeftCurbW);
    const lcOuterZ = curr3D.z + nz * (roadHalfW + effLeftCurbW);
    leftCurbVerts.push(lX, elevY + 0.05, lZ);
    leftCurbVerts.push(lcOuterX, elevY + 0.14, lcOuterZ);

    const rcOuterX = curr3D.x - nx * (roadHalfW + effRightCurbW);
    const rcOuterZ = curr3D.z - nz * (roadHalfW + effRightCurbW);
    rightCurbVerts.push(rcOuterX, elevY + 0.14, rcOuterZ);
    rightCurbVerts.push(rX, elevY + 0.05, rZ);

    const curbV = accumulatedDist / 3.0;
    leftCurbUvs.push(0, curbV, 1, curbV);
    rightCurbUvs.push(0, curbV, 1, curbV);

    // 3D Touge / Armco Barriers (Front Face, Top Cap, Back Face)
    // Left Barrier: inner edge facing track, outer edge outward
    const inLbX = curr3D.x + nx * effLeftD;
    const inLbZ = curr3D.z + nz * effLeftD;
    const outLbX = curr3D.x + nx * (effLeftD + barrierThickness);
    const outLbZ = curr3D.z + nz * (effLeftD + barrierThickness);

    // 6 vertices per cross-section:
    // 0: Front Inner Bottom
    // 1: Front Inner Top
    // 2: Top Cap Inner Top
    // 3: Top Cap Outer Top
    // 4: Back Face Outer Top
    // 5: Back Face Outer Bottom
    leftBarrierVerts.push(inLbX, elevY + 0.04, inLbZ);
    leftBarrierVerts.push(inLbX, elevY + barrierHeight, inLbZ);
    leftBarrierVerts.push(inLbX, elevY + barrierHeight, inLbZ);
    leftBarrierVerts.push(outLbX, elevY + barrierHeight, outLbZ);
    leftBarrierVerts.push(outLbX, elevY + barrierHeight, outLbZ);
    leftBarrierVerts.push(outLbX, elevY + 0.04, outLbZ);

    // Right Barrier: inner edge facing track, outer edge outward
    const inRbX = curr3D.x - nx * effRightD;
    const inRbZ = curr3D.z - nz * effRightD;
    const outRbX = curr3D.x - nx * (effRightD + barrierThickness);
    const outRbZ = curr3D.z - nz * (effRightD + barrierThickness);

    rightBarrierVerts.push(inRbX, elevY + 0.04, inRbZ);
    rightBarrierVerts.push(inRbX, elevY + barrierHeight, inRbZ);
    rightBarrierVerts.push(inRbX, elevY + barrierHeight, inRbZ);
    rightBarrierVerts.push(outRbX, elevY + barrierHeight, outRbZ);
    rightBarrierVerts.push(outRbX, elevY + barrierHeight, outRbZ);
    rightBarrierVerts.push(outRbX, elevY + 0.04, outRbZ);

    // UVs: barrierU cycles every 7.2m (3.6m Obsidian HORIZON + 3.6m Racing Red HORIZON)
    const barrierU = accumulatedDist / 7.2;
    // Front face: V 0.05 (bottom) to 0.82 (top)
    // Top cap: V 0.82 (inner) to 0.98 (outer)
    // Back face: V 0.98 (outer top) to 0.05 (outer bottom)
    // U coordinate orientation so HORIZON reads left-to-right from driver perspective
    const leftBarrierU = -barrierU;
    leftBarrierUvs.push(
      leftBarrierU, 0.05,
      leftBarrierU, 0.82,
      leftBarrierU, 0.82,
      leftBarrierU, 0.98,
      leftBarrierU, 0.98,
      leftBarrierU, 0.05
    );

    const rightBarrierU = barrierU;
    rightBarrierUvs.push(
      rightBarrierU, 0.05,
      rightBarrierU, 0.82,
      rightBarrierU, 0.82,
      rightBarrierU, 0.98,
      rightBarrierU, 0.98,
      rightBarrierU, 0.05
    );

    // 3D Glowing Chevron Arrow Guide Rails on Top of Barriers
    const chevronRailH = 0.38;
    const bTopY = elevY + barrierHeight;

    // Left Chevron Rail: 6 vertices (Front Face, Top Cap, Back Face)
    leftChevronVerts.push(inLbX, bTopY + 0.01, inLbZ);
    leftChevronVerts.push(inLbX - nx * 0.04, bTopY + chevronRailH, inLbZ - nz * 0.04);
    leftChevronVerts.push(inLbX - nx * 0.04, bTopY + chevronRailH, inLbZ - nz * 0.04);
    leftChevronVerts.push(outLbX, bTopY + chevronRailH, outLbZ);
    leftChevronVerts.push(outLbX, bTopY + chevronRailH, outLbZ);
    leftChevronVerts.push(outLbX, bTopY + 0.01, outLbZ);

    // Right Chevron Rail: 6 vertices (Front Face, Top Cap, Back Face)
    rightChevronVerts.push(inRbX, bTopY + 0.01, inRbZ);
    rightChevronVerts.push(inRbX + nx * 0.04, bTopY + chevronRailH, inRbZ + nz * 0.04);
    rightChevronVerts.push(inRbX + nx * 0.04, bTopY + chevronRailH, inRbZ + nz * 0.04);
    rightChevronVerts.push(outRbX, bTopY + chevronRailH, outRbZ);
    rightChevronVerts.push(outRbX, bTopY + chevronRailH, outRbZ);
    rightChevronVerts.push(outRbX, bTopY + 0.01, outRbZ);

    // UVs: cycles every 3.6m (5 bold chevrons per panel, pointing forward in race direction)
    const chevronU = accumulatedDist / 3.6;
    const leftChevronU = chevronU; // Both left and right barriers point forward along track
    leftChevronUvs.push(
      leftChevronU, 0.0,
      leftChevronU, 1.0,
      leftChevronU, 0.0,
      leftChevronU, 1.0,
      leftChevronU, 1.0,
      leftChevronU, 0.0
    );

    const rightChevronU = chevronU;
    rightChevronUvs.push(
      rightChevronU, 0.0,
      rightChevronU, 1.0,
      rightChevronU, 0.0,
      rightChevronU, 1.0,
      rightChevronU, 1.0,
      rightChevronU, 0.0
    );

    // Track Positions and check if falls inside any non-adjacent road surface
    leftBarrierPos.push({ x: inLbX, z: inLbZ });
    rightBarrierPos.push({ x: inRbX, z: inRbZ });
    leftCurbPos.push({ x: lcOuterX, z: lcOuterZ });
    rightCurbPos.push({ x: rcOuterX, z: rcOuterZ });

    const isLbSafe = !isInsideOtherRoad(inLbX, inLbZ, idx, 0.2);
    const isRbSafe = !isInsideOtherRoad(inRbX, inRbZ, idx, 0.2);
    const isLcSafe = !isInsideOtherRoad(lcOuterX, lcOuterZ, idx, 0.05);
    const isRcSafe = !isInsideOtherRoad(rcOuterX, rcOuterZ, idx, 0.05);

    leftBarrierActive.push(isLbSafe);
    rightBarrierActive.push(isRbSafe);
    leftCurbActive.push(isLcSafe);
    rightCurbActive.push(isRcSafe);

    if (i < count) {
      turnSampleData.push({
        idx: i,
        cross,
        turnAngle,
        dist: accumulatedDist,
        center: { x: curr3D.x, y: elevY, z: curr3D.z },
        tNorm: { x: tNormX, z: tNormZ },
        inLb: { x: inLbX, z: inLbZ },
        outLb: { x: outLbX, z: outLbZ },
        inRb: { x: inRbX, z: inRbZ },
        outRb: { x: outRbX, z: outRbZ },
        isLbSafe,
        isRbSafe,
        elevY,
      });
    }

    // Shoulders: compact grass strip seamlessly attached to outside edge of barriers
    const lsX = curr3D.x + nx * (effLeftD + barrierThickness + shoulderW);
    const lsZ = curr3D.z + nz * (effLeftD + barrierThickness + shoulderW);
    const rsX = curr3D.x - nx * (effRightD + barrierThickness + shoulderW);
    const rsZ = curr3D.z - nz * (effRightD + barrierThickness + shoulderW);

    // Left shoulder quad: inner at outLb, outer at ls
    // Right shoulder quad: inner at outRb, outer at rs
    const shoulderV = accumulatedDist / 6.0;
    shoulderVerts.push(outLbX, elevY + 0.03, outLbZ);
    shoulderVerts.push(lsX, elevY + 0.01, lsZ);
    shoulderVerts.push(outRbX, elevY + 0.03, outRbZ);
    shoulderVerts.push(rsX, elevY + 0.01, rsZ);
    shoulderUvs.push(0, shoulderV, 1, shoulderV, 0, shoulderV, 1, shoulderV);

    // Embankment Skirt Wall Vertices (drops from shoulder outer edge down to baseGroundY)
    const skirtBottomY = baseGroundY;
    const skirtV = accumulatedDist / 10.0;

    // Sloped embankment foundation: spreads outward gracefully on hills
    const slopeOutDist = Math.min(8.0, Math.max(1.5, (elevY - baseGroundY) * 1.2));
    const lsBottomX = curr3D.x + nx * (effLeftD + barrierThickness + shoulderW + slopeOutDist);
    const lsBottomZ = curr3D.z + nz * (effLeftD + barrierThickness + shoulderW + slopeOutDist);
    const rsBottomX = curr3D.x - nx * (effRightD + barrierThickness + shoulderW + slopeOutDist);
    const rsBottomZ = curr3D.z - nz * (effRightD + barrierThickness + shoulderW + slopeOutDist);

    const actualLsBottomX = !isInsideOtherRoad(lsBottomX, lsBottomZ, idx, 0.4) ? lsBottomX : lsX;
    const actualLsBottomZ = !isInsideOtherRoad(lsBottomX, lsBottomZ, idx, 0.4) ? lsBottomZ : lsZ;
    const actualRsBottomX = !isInsideOtherRoad(rsBottomX, rsBottomZ, idx, 0.4) ? rsBottomX : rsX;
    const actualRsBottomZ = !isInsideOtherRoad(rsBottomX, rsBottomZ, idx, 0.4) ? rsBottomZ : rsZ;

    skirtVerts.push(lsX, elevY + 0.01, lsZ);
    skirtVerts.push(actualLsBottomX, skirtBottomY, actualLsBottomZ);
    skirtVerts.push(rsX, elevY + 0.01, rsZ);
    skirtVerts.push(actualRsBottomX, skirtBottomY, actualRsBottomZ);
    skirtUvs.push(0, skirtV, 1, skirtV, 0, skirtV, 1, skirtV);

    // Support posts every 2 segments (~4.5m spacing, centered through barrier channel)
    if (i % 2 === 0 && i < count) {
      if (isLbSafe) {
        const midPostX = (inLbX + outLbX) * 0.5;
        const midPostZ = (inLbZ + outLbZ) * 0.5;
        stanchionPositions.push({
          x: midPostX,
          y: elevY + (barrierHeight + 0.08) * 0.5,
          z: midPostZ,
          rotY: Math.atan2(tx, tz),
        });
      }
      if (isRbSafe) {
        const midPostX = (inRbX + outRbX) * 0.5;
        const midPostZ = (inRbZ + outRbZ) * 0.5;
        stanchionPositions.push({
          x: midPostX,
          y: elevY + (barrierHeight + 0.08) * 0.5,
          z: midPostZ,
          rotY: Math.atan2(tx, tz),
        });
      }
    }
  }

  // 2. MESH TOPOLOGY & INDEX GENERATION
  // In this pass, all vertex coordinates and active flags are fully populated, so Active[i + 1] is guaranteed defined.
  for (let i = 0; i < count; i++) {
    const idx = i % count;
    const base2 = i * 2;
    // Road indices (continuous manifold road surface)
    roadIndices.push(base2, base2 + 2, base2 + 1);
    roadIndices.push(base2 + 1, base2 + 2, base2 + 3);

    // Curbs indices (only where neither endpoint nor edge midpoint penetrates another road)
    if (leftCurbActive[i] && leftCurbActive[i + 1]) {
      const midCurbX = (leftCurbPos[i].x + leftCurbPos[i + 1].x) * 0.5;
      const midCurbZ = (leftCurbPos[i].z + leftCurbPos[i + 1].z) * 0.5;
      if (!isInsideOtherRoad(midCurbX, midCurbZ, idx, 0.05)) {
        leftCurbIndices.push(base2, base2 + 2, base2 + 1);
        leftCurbIndices.push(base2 + 1, base2 + 2, base2 + 3);
      }
    }

    if (rightCurbActive[i] && rightCurbActive[i + 1]) {
      const midCurbX = (rightCurbPos[i].x + rightCurbPos[i + 1].x) * 0.5;
      const midCurbZ = (rightCurbPos[i].z + rightCurbPos[i + 1].z) * 0.5;
      if (!isInsideOtherRoad(midCurbX, midCurbZ, idx, 0.05)) {
        rightCurbIndices.push(base2, base2 + 2, base2 + 1);
        rightCurbIndices.push(base2 + 1, base2 + 2, base2 + 3);
      }
    }

    // Barrier walls and shoulder/skirt indices (suppressed when traversing another road surface)
    const bBase = i * 6;
    const bNext = (i + 1) * 6;
    const sBase = i * 4;
    const skBase = i * 4;

    if (leftBarrierActive[i] && leftBarrierActive[i + 1]) {
      const midBx = (leftBarrierPos[i].x + leftBarrierPos[i + 1].x) * 0.5;
      const midBz = (leftBarrierPos[i].z + leftBarrierPos[i + 1].z) * 0.5;
      if (!isInsideOtherRoad(midBx, midBz, idx, 0.2)) {
        // Left Barrier Front Face Quad
        leftBarrierIndices.push(bBase + 0, bNext + 0, bBase + 1);
        leftBarrierIndices.push(bBase + 1, bNext + 0, bNext + 1);
        // Left Barrier Top Cap Quad
        leftBarrierIndices.push(bBase + 2, bNext + 2, bBase + 3);
        leftBarrierIndices.push(bBase + 3, bNext + 2, bNext + 3);
        // Left Barrier Back Face Quad
        leftBarrierIndices.push(bBase + 4, bNext + 4, bBase + 5);
        leftBarrierIndices.push(bBase + 5, bNext + 4, bNext + 5);

        // Left Glowing Chevron Arrow Rail Quads (Mounted on top of left barrier)
        leftChevronIndices.push(bBase + 0, bNext + 0, bBase + 1);
        leftChevronIndices.push(bBase + 1, bNext + 0, bNext + 1);
        leftChevronIndices.push(bBase + 2, bNext + 2, bBase + 3);
        leftChevronIndices.push(bBase + 3, bNext + 2, bNext + 3);
        leftChevronIndices.push(bBase + 4, bNext + 4, bBase + 5);
        leftChevronIndices.push(bBase + 5, bNext + 4, bNext + 5);

        // Left shoulder quad
        shoulderIndices.push(sBase, sBase + 4, sBase + 1);
        shoulderIndices.push(sBase + 1, sBase + 4, sBase + 5);
        // Left vertical skirt wall
        skirtIndices.push(skBase, skBase + 1, skBase + 4);
        skirtIndices.push(skBase + 1, skBase + 5, skBase + 4);
      }
    }

    if (rightBarrierActive[i] && rightBarrierActive[i + 1]) {
      const midBx = (rightBarrierPos[i].x + rightBarrierPos[i + 1].x) * 0.5;
      const midBz = (rightBarrierPos[i].z + rightBarrierPos[i + 1].z) * 0.5;
      if (!isInsideOtherRoad(midBx, midBz, idx, 0.2)) {
        // Right Barrier Front Face Quad
        rightBarrierIndices.push(bBase + 0, bNext + 0, bBase + 1);
        rightBarrierIndices.push(bBase + 1, bNext + 0, bNext + 1);
        // Right Barrier Top Cap Quad
        rightBarrierIndices.push(bBase + 2, bNext + 2, bBase + 3);
        rightBarrierIndices.push(bBase + 3, bNext + 2, bNext + 3);
        // Right Barrier Back Face Quad
        rightBarrierIndices.push(bBase + 4, bNext + 4, bBase + 5);
        rightBarrierIndices.push(bBase + 5, bNext + 4, bNext + 5);

        // Right Glowing Chevron Arrow Rail Quads (Mounted on top of right barrier)
        rightChevronIndices.push(bBase + 0, bNext + 0, bBase + 1);
        rightChevronIndices.push(bBase + 1, bNext + 0, bNext + 1);
        rightChevronIndices.push(bBase + 2, bNext + 2, bBase + 3);
        rightChevronIndices.push(bBase + 3, bNext + 2, bNext + 3);
        rightChevronIndices.push(bBase + 4, bNext + 4, bBase + 5);
        rightChevronIndices.push(bBase + 5, bNext + 4, bNext + 5);

        // Right shoulder quad
        shoulderIndices.push(sBase + 2, sBase + 3, sBase + 6);
        shoulderIndices.push(sBase + 3, sBase + 7, sBase + 6);
        // Right vertical skirt wall
        skirtIndices.push(skBase + 2, skBase + 6, skBase + 3);
        skirtIndices.push(skBase + 3, skBase + 6, skBase + 7);
      }
    }
  }

  // Build Road Mesh
  const roadGeom = new THREE.BufferGeometry();
  roadGeom.setAttribute('position', new THREE.Float32BufferAttribute(roadVerts, 3));
  roadGeom.setAttribute('uv', new THREE.Float32BufferAttribute(roadUvs, 2));
  roadGeom.setIndex(roadIndices);
  roadGeom.computeVertexNormals();

  const roadTex = createRoadTexture();
  const roadMat = new THREE.MeshStandardMaterial({
    map: roadTex,
    roughness: 0.8,
    metalness: 0.1,
    side: THREE.DoubleSide,
  });
  const roadMesh = new THREE.Mesh(roadGeom, roadMat);
  roadMesh.receiveShadow = true;
  trackGroup.add(roadMesh);

  // Build Curbs Mesh
  const kerbTex = createKerbTexture();
  const kerbMat = new THREE.MeshStandardMaterial({
    map: kerbTex,
    roughness: 0.7,
    metalness: 0.15,
    side: THREE.DoubleSide,
  });

  const leftCurbGeom = new THREE.BufferGeometry();
  leftCurbGeom.setAttribute('position', new THREE.Float32BufferAttribute(leftCurbVerts, 3));
  leftCurbGeom.setAttribute('uv', new THREE.Float32BufferAttribute(leftCurbUvs, 2));
  leftCurbGeom.setIndex(leftCurbIndices);
  leftCurbGeom.computeVertexNormals();
  const leftCurbMesh = new THREE.Mesh(leftCurbGeom, kerbMat);
  leftCurbMesh.receiveShadow = true;
  leftCurbMesh.castShadow = true;
  trackGroup.add(leftCurbMesh);

  const rightCurbGeom = new THREE.BufferGeometry();
  rightCurbGeom.setAttribute('position', new THREE.Float32BufferAttribute(rightCurbVerts, 3));
  rightCurbGeom.setAttribute('uv', new THREE.Float32BufferAttribute(rightCurbUvs, 2));
  rightCurbGeom.setIndex(rightCurbIndices);
  rightCurbGeom.computeVertexNormals();
  const rightCurbMesh = new THREE.Mesh(rightCurbGeom, kerbMat);
  rightCurbMesh.receiveShadow = true;
  rightCurbMesh.castShadow = true;
  trackGroup.add(rightCurbMesh);

  // Build Armco / Touge Circuit Barriers (Alternating Red and White Blocks)
  const barrierTex = createBarrierTexture();
  const barrierMat = new THREE.MeshStandardMaterial({
    map: barrierTex,
    roughness: 0.35,
    metalness: 0.12,
    side: THREE.DoubleSide,
  });

  const leftBarrierGeom = new THREE.BufferGeometry();
  leftBarrierGeom.setAttribute('position', new THREE.Float32BufferAttribute(leftBarrierVerts, 3));
  leftBarrierGeom.setAttribute('uv', new THREE.Float32BufferAttribute(leftBarrierUvs, 2));
  leftBarrierGeom.setIndex(leftBarrierIndices);
  leftBarrierGeom.computeVertexNormals();
  const leftBarrierMesh = new THREE.Mesh(leftBarrierGeom, barrierMat);
  leftBarrierMesh.castShadow = true;
  leftBarrierMesh.receiveShadow = true;
  trackGroup.add(leftBarrierMesh);

  const rightBarrierGeom = new THREE.BufferGeometry();
  rightBarrierGeom.setAttribute('position', new THREE.Float32BufferAttribute(rightBarrierVerts, 3));
  rightBarrierGeom.setAttribute('uv', new THREE.Float32BufferAttribute(rightBarrierUvs, 2));
  rightBarrierGeom.setIndex(rightBarrierIndices);
  rightBarrierGeom.computeVertexNormals();
  const rightBarrierMesh = new THREE.Mesh(rightBarrierGeom, barrierMat);
  rightBarrierMesh.castShadow = true;
  rightBarrierMesh.receiveShadow = true;
  trackGroup.add(rightBarrierMesh);

  // Build Glowing Directional Chevron Arrow Rails (Mounted on top of every barrier)
  const chevronTex = createBarrierChevronTexture();
  const chevronMat = new THREE.MeshStandardMaterial({
    map: chevronTex,
    emissiveMap: chevronTex,
    emissive: new THREE.Color(0xff1828),
    emissiveIntensity: 1.6,
    roughness: 0.18,
    metalness: 0.05,
    side: THREE.DoubleSide,
  });

  const leftChevronGeom = new THREE.BufferGeometry();
  leftChevronGeom.setAttribute('position', new THREE.Float32BufferAttribute(leftChevronVerts, 3));
  leftChevronGeom.setAttribute('uv', new THREE.Float32BufferAttribute(leftChevronUvs, 2));
  leftChevronGeom.setIndex(leftChevronIndices);
  leftChevronGeom.computeVertexNormals();
  const leftChevronMesh = new THREE.Mesh(leftChevronGeom, chevronMat);
  leftChevronMesh.name = 'chevronRailMesh';
  leftChevronMesh.castShadow = true;
  leftChevronMesh.receiveShadow = false;
  trackGroup.add(leftChevronMesh);

  const rightChevronGeom = new THREE.BufferGeometry();
  rightChevronGeom.setAttribute('position', new THREE.Float32BufferAttribute(rightChevronVerts, 3));
  rightChevronGeom.setAttribute('uv', new THREE.Float32BufferAttribute(rightChevronUvs, 2));
  rightChevronGeom.setIndex(rightChevronIndices);
  rightChevronGeom.computeVertexNormals();
  const rightChevronMesh = new THREE.Mesh(rightChevronGeom, chevronMat);
  rightChevronMesh.name = 'chevronRailMesh';
  rightChevronMesh.castShadow = true;
  rightChevronMesh.receiveShadow = false;
  trackGroup.add(rightChevronMesh);

  // Build Track Shoulders (Grass verge along outer edge of barriers)
  const grassTex = createGrassTexture();
  const shoulderMat = new THREE.MeshStandardMaterial({
    map: grassTex,
    roughness: 0.9,
    metalness: 0.05,
    side: THREE.DoubleSide,
  });

  const shoulderGeom = new THREE.BufferGeometry();
  shoulderGeom.setAttribute('position', new THREE.Float32BufferAttribute(shoulderVerts, 3));
  shoulderGeom.setAttribute('uv', new THREE.Float32BufferAttribute(shoulderUvs, 2));
  shoulderGeom.setIndex(shoulderIndices);
  shoulderGeom.computeVertexNormals();
  const shoulderMesh = new THREE.Mesh(shoulderGeom, shoulderMat);
  shoulderMesh.receiveShadow = true;
  trackGroup.add(shoulderMesh);

  // Build Foundation Skirt Walls (Drops vertically from shoulders to base ground)
  const skirtMat = new THREE.MeshStandardMaterial({
    color: 0x142b1a, // rich dark embankment turf / stone foundation
    roughness: 0.95,
    metalness: 0.05,
    side: THREE.DoubleSide,
  });
  const skirtGeom = new THREE.BufferGeometry();
  skirtGeom.setAttribute('position', new THREE.Float32BufferAttribute(skirtVerts, 3));
  skirtGeom.setAttribute('uv', new THREE.Float32BufferAttribute(skirtUvs, 2));
  skirtGeom.setIndex(skirtIndices);
  skirtGeom.computeVertexNormals();
  const skirtMesh = new THREE.Mesh(skirtGeom, skirtMat);
  skirtMesh.receiveShadow = true;
  trackGroup.add(skirtMesh);

  // Build Expansive Base Ground Plane (safely at baseGroundY, NEVER intersects road)
  const baseGroundGeom = new THREE.PlaneGeometry(6500, 6500);
  baseGroundGeom.rotateX(-Math.PI / 2);
  const baseGroundMesh = new THREE.Mesh(baseGroundGeom, shoulderMat);
  baseGroundMesh.position.set(0, baseGroundY, 0);
  baseGroundMesh.receiveShadow = true;
  trackGroup.add(baseGroundMesh);

  // Add boundary stanchion posts along barriers
  const stanchionMat = new THREE.MeshStandardMaterial({
    color: 0x1e293b,
    metalness: 0.85,
    roughness: 0.35,
  });
  const stanchionGeom = new THREE.BoxGeometry(0.18, barrierHeight + 0.1, 0.18);
  stanchionPositions.forEach((pos) => {
    const post = new THREE.Mesh(stanchionGeom, stanchionMat);
    post.position.set(pos.x, pos.y, pos.z);
    post.rotation.y = pos.rotY;
    post.castShadow = true;
    trackGroup.add(post);
  });

  // START / FINISH LINE DECAL & GANTRY ARCH
  const startP2D = pts[0];
  const startP3D = worldTo3D(startP2D.x, startP2D.y);

  const nextP3D = worldTo3D(pts[1].x, pts[1].y);
  const startAngle = Math.atan2(nextP3D.x - startP3D.x, nextP3D.z - startP3D.z);
  const startElevY = getElevation(0);
  const nextElevY = getElevation(1 / count);
  const dHorizStart = Math.hypot(nextP3D.x - startP3D.x, nextP3D.z - startP3D.z) || 1;
  const startPitch = Math.atan2(nextElevY - startElevY, dHorizStart);

  // Checkered start/finish decal adhering to track pitch and angle
  const startLineGroup = new THREE.Group();
  startLineGroup.position.set(startP3D.x, startElevY + 0.05, startP3D.z);
  startLineGroup.rotation.set(-startPitch, startAngle, 0, 'YXZ');

  const checkTex = createCheckeredTexture();
  const checkGeom = new THREE.PlaneGeometry(roadHalfW * 2 - 0.2, 3.2);
  checkGeom.rotateX(-Math.PI / 2);
  const checkMat = new THREE.MeshStandardMaterial({
    map: checkTex,
    roughness: 0.5,
    polygonOffset: true,
    polygonOffsetFactor: -1.0,
    polygonOffsetUnits: -4.0,
  });
  const checkMesh = new THREE.Mesh(checkGeom, checkMat);
  startLineGroup.add(checkMesh);
  trackGroup.add(startLineGroup);

  // OVERHEAD 3D TRUSS GANTRY ARCH (Professional motorsport spec)
  const gantryGroup = new THREE.Group();
  gantryGroup.position.set(startP3D.x, startElevY, startP3D.z);
  gantryGroup.rotation.set(-startPitch, startAngle, 0, 'YXZ');

  const archW = roadHalfW * 2 + 5.5;
  const archH = 7.8; // Realistic high clearance: does not block camera or screen

  const trussMat = new THREE.MeshStandardMaterial({
    color: 0x64748b,
    metalness: 0.85,
    roughness: 0.25,
  });
  const gantryBannerTex = createGantryBannerTexture();
  const bannerMat = new THREE.MeshStandardMaterial({
    map: gantryBannerTex,
    roughness: 0.3,
    metalness: 0.2,
    emissive: 0x1e293b,
    emissiveIntensity: 0.3,
    side: THREE.DoubleSide,
  });

  // Dual lattice pillars
  const pillarGeom = new THREE.BoxGeometry(0.55, archH, 0.55);
  const pillarL = new THREE.Mesh(pillarGeom, trussMat);
  pillarL.position.set(-archW / 2, archH / 2, 0);
  pillarL.castShadow = true;
  gantryGroup.add(pillarL);

  const pillarR = new THREE.Mesh(pillarGeom, trussMat);
  pillarR.position.set(archW / 2, archH / 2, 0);
  pillarR.castShadow = true;
  gantryGroup.add(pillarR);

  // Overhead primary and secondary truss beams
  const beamGeom = new THREE.BoxGeometry(archW, 0.45, 0.45);
  const beamMeshTop = new THREE.Mesh(beamGeom, trussMat);
  beamMeshTop.position.set(0, archH, 0);
  beamMeshTop.castShadow = true;
  gantryGroup.add(beamMeshTop);

  const beamMeshBot = new THREE.Mesh(beamGeom, trussMat);
  beamMeshBot.position.set(0, archH - 1.8, 0);
  beamMeshBot.castShadow = true;
  gantryGroup.add(beamMeshBot);

  // High-def sponsor / start banner framed between truss beams
  const bannerGeom = new THREE.BoxGeometry(archW * 0.78, 1.45, 0.18);
  const bannerMesh = new THREE.Mesh(bannerGeom, bannerMat);
  bannerMesh.position.set(0, archH - 0.9, 0);
  gantryGroup.add(bannerMesh);

  // Start lights housing & glowing lenses
  const lightHousing = new THREE.Mesh(
    new THREE.BoxGeometry(archW * 0.36, 0.55, 0.25),
    new THREE.MeshStandardMaterial({ color: 0x090d16, roughness: 0.5 })
  );
  lightHousing.position.set(0, archH - 2.1, 0);
  gantryGroup.add(lightHousing);

  for (let l = -2; l <= 2; l++) {
    const lightLens = new THREE.Mesh(
      new THREE.CylinderGeometry(0.16, 0.16, 0.12, 16),
      new THREE.MeshStandardMaterial({
        color: 0xef4444,
        emissive: 0xef4444,
        emissiveIntensity: 0.9,
      })
    );
    lightLens.rotation.x = Math.PI / 2;
    lightLens.position.set(l * 0.65, archH - 2.1, 0.12);
    gantryGroup.add(lightLens);
  }

  trackGroup.add(gantryGroup);

  // -------------------------------------------------------------------------
  // 3D ELEVATED TURN WARNING ARROW SIGNPOSTS (Showing Turns from Far Away)
  // -------------------------------------------------------------------------
  // 1. Arrow shape helper function (high-visibility motorsport warning sign, 4.8m x 2.5m)
  function createTurnArrowShape(pointingLeft: boolean, inset: number = 0): THREE.Shape {
    const shape = new THREE.Shape();
    const halfW = 2.4 - inset;
    const barbX = 0.45 - inset * 0.4;
    const halfH = 1.25 - inset;
    const shaftH = 0.65 - inset * 0.7;

    if (pointingLeft) {
      // Tip points to local -X (which faces driver's LEFT on screen)
      shape.moveTo(-halfW, 0);
      shape.lineTo(-barbX, halfH);
      shape.lineTo(-barbX, shaftH);
      shape.lineTo(halfW, shaftH);
      shape.lineTo(halfW, -shaftH);
      shape.lineTo(-barbX, -shaftH);
      shape.lineTo(-barbX, -halfH);
      shape.closePath();
    } else {
      // Tip points to local +X (which faces driver's RIGHT on screen)
      shape.moveTo(halfW, 0);
      shape.lineTo(barbX, halfH);
      shape.lineTo(barbX, shaftH);
      shape.lineTo(-halfW, shaftH);
      shape.lineTo(-halfW, -shaftH);
      shape.lineTo(barbX, -shaftH);
      shape.lineTo(barbX, -halfH);
      shape.closePath();
    }
    return shape;
  }

  // 2. Geometries
  const leftOuterShape = createTurnArrowShape(true, 0.0);
  const leftChromeBoxGeom = new THREE.ExtrudeGeometry(leftOuterShape, {
    depth: 0.18,
    bevelEnabled: true,
    bevelThickness: 0.04,
    bevelSize: 0.03,
    bevelSegments: 3,
  });
  leftChromeBoxGeom.center();

  const rightOuterShape = createTurnArrowShape(false, 0.0);
  const rightChromeBoxGeom = new THREE.ExtrudeGeometry(rightOuterShape, {
    depth: 0.18,
    bevelEnabled: true,
    bevelThickness: 0.04,
    bevelSize: 0.03,
    bevelSegments: 3,
  });
  rightChromeBoxGeom.center();

  const leftInnerShape = createTurnArrowShape(true, 0.12);
  const leftFaceGeom = new THREE.ShapeGeometry(leftInnerShape);
  leftFaceGeom.center();

  const rightInnerShape = createTurnArrowShape(false, 0.12);
  const rightFaceGeom = new THREE.ShapeGeometry(rightInnerShape);
  rightFaceGeom.center();

  const signPoleH = 2.85;
  const poleGeom = new THREE.CylinderGeometry(0.1, 0.1, signPoleH, 20);
  const capGeom = new THREE.CylinderGeometry(0.13, 0.13, 0.2, 20);

  // 3. Materials
  // Bright metallic chrome / brushed aluminum frame matching user reference image
  const chromeMat = new THREE.MeshStandardMaterial({
    color: 0xf1f5f9,
    metalness: 0.5,
    roughness: 0.2,
  });

  const turnSignLeftTex = createTurnSignTexture(true);
  const turnSignRightTex = createTurnSignTexture(false);

  const turnSignLeftMat = new THREE.MeshStandardMaterial({
    map: turnSignLeftTex,
    emissiveMap: turnSignLeftTex,
    emissive: new THREE.Color(0xff1836),
    emissiveIntensity: 2.5,
    roughness: 0.12,
    metalness: 0.05,
    side: THREE.DoubleSide,
  });

  const turnSignRightMat = new THREE.MeshStandardMaterial({
    map: turnSignRightTex,
    emissiveMap: turnSignRightTex,
    emissive: new THREE.Color(0xff1836),
    emissiveIntensity: 2.5,
    roughness: 0.12,
    metalness: 0.05,
    side: THREE.DoubleSide,
  });

  // 4. Smooth curvature calculation across 5-sample window to detect true curves
  if (turnSampleData.length >= 6) {
    const smoothedCross: number[] = [];
    for (let i = 0; i < count; i++) {
      let sum = 0;
      for (let k = -2; k <= 2; k++) {
        const idx = (i + k + count) % count;
        sum += turnSampleData[idx].cross;
      }
      smoothedCross.push(sum / 5);
    }

    interface TurnCluster {
      dir: 'LEFT' | 'RIGHT';
      indices: number[];
      apexIdx: number;
      maxCross: number;
    }

    const clusters: TurnCluster[] = [];
    let curCluster: { dir: 'LEFT' | 'RIGHT'; indices: number[] } | null = null;

    const makeCluster = (c: { dir: 'LEFT' | 'RIGHT'; indices: number[] }): TurnCluster => {
      let apexIdx = c.indices[0];
      let maxC = 0;
      for (const idx of c.indices) {
        const mag = Math.abs(smoothedCross[idx]);
        if (mag > maxC) {
          maxC = mag;
          apexIdx = idx;
        }
      }
      return { dir: c.dir, indices: c.indices, apexIdx, maxCross: maxC };
    };

    // Threshold 0.026 rad (~1.5 deg per segment): detects all true curves
    for (let i = 0; i < count; i++) {
      const sc = smoothedCross[i];
      const isLeft = sc > 0.026;
      const isRight = sc < -0.026;
      const turnDir = isLeft ? 'LEFT' : isRight ? 'RIGHT' : null;

      if (turnDir) {
        if (!curCluster) {
          curCluster = { dir: turnDir, indices: [i] };
        } else if (curCluster.dir === turnDir) {
          curCluster.indices.push(i);
        } else {
          if (curCluster.indices.length >= 3) {
            clusters.push(makeCluster(curCluster));
          }
          curCluster = { dir: turnDir, indices: [i] };
        }
      } else {
        if (curCluster) {
          if (curCluster.indices.length >= 3) {
            clusters.push(makeCluster(curCluster));
          }
          curCluster = null;
        }
      }
    }
    if (curCluster && curCluster.indices.length >= 3) {
      clusters.push(makeCluster(curCluster));
    }

    // Place signs on outside barriers for each detected curve
    let placedSignsCount = 0;
    for (const cluster of clusters) {
      if (cluster.maxCross < 0.032) continue; // Skip straightaways

      const n = cluster.indices.length;
      const selectedIndices: number[] = [];

      // 1. Advance warning sign placed 5-8 segments BEFORE the curve entry
      // This is visible from far away down the straight, warning oncoming drivers early!
      const leadDist = Math.min(8, Math.max(4, Math.floor(count * 0.022)));
      const advanceIdx = (cluster.indices[0] - leadDist + count) % count;
      selectedIndices.push(advanceIdx);

      // 2. Signs along the curve (entry, apex, midpoints, exit)
      if (n <= 8) {
        selectedIndices.push(cluster.indices[0], cluster.apexIdx);
      } else if (n <= 16) {
        selectedIndices.push(
          cluster.indices[0],
          cluster.apexIdx,
          cluster.indices[n - 1]
        );
      } else {
        const signCount = Math.min(5, Math.max(3, Math.floor(n / 5)));
        for (let s = 0; s < signCount; s++) {
          const stepIdx = Math.floor((s / (signCount - 1)) * (n - 1));
          selectedIndices.push(cluster.indices[stepIdx]);
        }
      }

      for (const sIdx of selectedIndices) {
        // Do not place warning signs directly on the start grid / start gantry straight
        if (sIdx < 8 || sIdx > count - 6) continue;

        const sample = turnSampleData[sIdx];
        if (!sample) continue;
        const pointingLeft = cluster.dir === 'LEFT';
        const isRightBarrier = pointingLeft;

        const posX = isRightBarrier
          ? (sample.inRb.x + sample.outRb.x) * 0.5
          : (sample.inLb.x + sample.outLb.x) * 0.5;
        const posZ = isRightBarrier
          ? (sample.inRb.z + sample.outRb.z) * 0.5
          : (sample.inLb.z + sample.outLb.z) * 0.5;
        const posY = sample.elevY + barrierHeight;

        // Facing direction: directly facing oncoming traffic approaching down the track
        const lookback = Math.min(8, Math.floor(count * 0.04));
        const prevIdx = (sIdx - lookback + count) % count;
        const prevSample = turnSampleData[prevIdx];
        const appX = sample.center.x - prevSample.center.x;
        const appZ = sample.center.z - prevSample.center.z;
        const appAngle = Math.atan2(appX, appZ);
        // Cant slightly inward toward track center for optimal windshield visibility
        const cantAngle = isRightBarrier ? 0.16 : -0.16;
        const rotY = appAngle + Math.PI + cantAngle;

        const signGroup = new THREE.Group();
        signGroup.position.set(posX, posY, posZ);
        signGroup.rotation.y = rotY;

        // Pole positioned under center of rectangular shaft
        // When pointingLeft is true, tip is at -X, shaft extends to +X
        const poleX = pointingLeft ? 0.98 : -0.98;

        // Chrome Pole extending from barrier top up to top of arrow shaft
        const poleMesh = new THREE.Mesh(poleGeom, chromeMat);
        poleMesh.position.set(poleX, signPoleH * 0.5, 0);
        poleMesh.castShadow = true;
        signGroup.add(poleMesh);

        // Chrome Top Cap / Bolt protruding above top frame (matching reference image)
        const capMesh = new THREE.Mesh(capGeom, chromeMat);
        capMesh.position.set(poleX, 2.85 + 0.1, 0);
        signGroup.add(capMesh);

        // Outer Chrome Arrow Box (Beveled metallic frame matching user reference image)
        const boxGeom = pointingLeft ? leftChromeBoxGeom : rightChromeBoxGeom;
        const boxMesh = new THREE.Mesh(boxGeom, chromeMat);
        boxMesh.position.set(0, 2.2, 0);
        boxMesh.castShadow = true;
        signGroup.add(boxMesh);

        // Front Glowing Ruby Arrow Face (z = +0.135, cleanly set inside front bevel)
        const faceGeom = pointingLeft ? leftFaceGeom : rightFaceGeom;
        const faceMat = pointingLeft ? turnSignLeftMat : turnSignRightMat;
        const frontFace = new THREE.Mesh(faceGeom, faceMat);
        frontFace.position.set(0, 2.2, 0.135);
        frontFace.name = 'turnArrowSignMesh';
        signGroup.add(frontFace);

        // Back Glowing Ruby Arrow Face (z = -0.135, cleanly set inside back bevel)
        const backFace = new THREE.Mesh(faceGeom, faceMat);
        backFace.position.set(0, 2.2, -0.135);
        backFace.rotation.y = Math.PI;
        backFace.name = 'turnArrowSignMesh';
        signGroup.add(backFace);

        trackGroup.add(signGroup);
        placedSignsCount++;
      }
    }
    console.log(`[TurnSigns] Total signs placed on track: ${placedSignsCount}`);
  }

  // SURROUNDING 3D ENVIRONMENT TREES & NATURAL MOUNDS
  const envConfig = ENVIRONMENTS[environment] || ENVIRONMENTS.pacific_coast;
  const envGroup = new THREE.Group();
  const trunkMat = new THREE.MeshStandardMaterial({
    color: envConfig.foliage.trunkColor,
    roughness: 0.9,
    metalness: 0.05,
  });
  const foliageMat = new THREE.MeshStandardMaterial({
    roughness: 0.68,
    metalness: 0.02,
  });
  const moundMat = new THREE.MeshStandardMaterial({
    color: envConfig.foliage.moundColor,
    roughness: 0.88,
    metalness: 0.04,
  });

  // Base geometries anchored at root y = 0
  const trunkGeom = new THREE.CylinderGeometry(0.28, 0.52, 2.8, 7);
  trunkGeom.translate(0, 1.4, 0);
  trunkGeom.computeVertexNormals();

  const pineFoliageGeom = createPineFoliageGeometry();
  const deciduousFoliageGeom = createDeciduousFoliageGeometry();
  const cypressFoliageGeom = createCypressFoliageGeometry();
  const moundGeom = new THREE.SphereGeometry(6.0, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2);

  const outerBarrierDist = roadHalfW + curbW + barrierOffset + barrierThickness;
  const minClearance3D = outerBarrierDist + 0.6; // 100% outside crash barrier

  // Verifies a coordinate is outside all track segments & provides distance and nearest segment elevation
  const isLocationClearOfTrack = (
    x3D: number,
    z3D: number,
    extraBuffer: number = 0
  ): { isClear: boolean; dist3D: number; segElev: number } => {
    const x2D = x3D / TRACK_3D_SCALE + centerX;
    const y2D = z3D / TRACK_3D_SCALE + centerY;
    const status = getCarTrackStatus({ x: x2D, y: y2D }, track);
    const dist3D = status.distanceToCenter * TRACK_3D_SCALE;
    const segElev = segmentElevations[status.closestPointIndex] ?? baseGroundY;
    if (dist3D < minClearance3D + extraBuffer) {
      return { isClear: false, dist3D, segElev };
    }
    return { isClear: true, dist3D, segElev };
  };

  // Calculates smooth ground height adapting to road shoulders and natural hillside slopes
  const getGroundY = (dist3D: number, nearestSegElev: number): number => {
    const shoulderEdgeDist = outerBarrierDist + shoulderW;
    if (dist3D <= shoulderEdgeDist + 0.8) {
      return nearestSegElev + 0.02;
    }
    const distBeyond = dist3D - shoulderEdgeDist;
    const slopeWidth = Math.max(10.0, Math.abs(nearestSegElev - baseGroundY) * 2.2);
    const blend = Math.max(0, Math.min(1, distBeyond / slopeWidth));
    const smoothBlend = 0.5 - 0.5 * Math.cos(blend * Math.PI);
    return Math.max(baseGroundY, nearestSegElev * (1 - smoothBlend) + baseGroundY * smoothBlend);
  };

  interface TreeInstance {
    x: number;
    y: number;
    z: number;
    scale: number;
    rotY: number;
    type: number; // 0 = Pine, 1 = Deciduous, 2 = Cypress
    paletteOffset: number;
  }

  const allTrees: TreeInstance[] = [];
  const pineInstances: TreeInstance[] = [];
  const deciduousInstances: TreeInstance[] = [];
  const cypressInstances: TreeInstance[] = [];
  const moundInstances: { x: number; y: number; z: number; scaleY: number; scaleXZ: number }[] = [];

  // Fast O(1) Spatial Hash Grid to prevent clumping
  const treeSpatialGrid = new Map<string, { x: number; z: number }[]>();
  const SPATIAL_CELL = 7.0;

  const isTooCloseToTree = (x: number, z: number, minDist: number): boolean => {
    const cx = Math.floor(x / SPATIAL_CELL);
    const cz = Math.floor(z / SPATIAL_CELL);
    const minDistSq = minDist * minDist;

    for (let dx = -1; dx <= 1; dx++) {
      for (let dz = -1; dz <= 1; dz++) {
        const key = `${cx + dx},${cz + dz}`;
        const bucket = treeSpatialGrid.get(key);
        if (bucket) {
          for (let b = 0; b < bucket.length; b++) {
            const ot = bucket[b];
            const distSq = (ot.x - x) * (ot.x - x) + (ot.z - z) * (ot.z - z);
            if (distSq < minDistSq) {
              return true;
            }
          }
        }
      }
    }
    return false;
  };

  const registerTree = (x: number, z: number) => {
    const cx = Math.floor(x / SPATIAL_CELL);
    const cz = Math.floor(z / SPATIAL_CELL);
    const key = `${cx},${cz}`;
    let bucket = treeSpatialGrid.get(key);
    if (!bucket) {
      bucket = [];
      treeSpatialGrid.set(key, bucket);
    }
    bucket.push({ x, z });
  };

  const addTree = (
    x: number,
    y: number,
    z: number,
    scale: number,
    rotY: number,
    type: number,
    paletteOffset: number
  ) => {
    const tree: TreeInstance = { x, y, z, scale, rotY, type, paletteOffset };
    allTrees.push(tree);
    if (type === 0) pineInstances.push(tree);
    else if (type === 1) deciduousInstances.push(tree);
    else cypressInstances.push(tree);
  };

  const palette = envConfig.foliage.foliageColors.map((c) => new THREE.Color(c));

  // 1. IMMEDIATE TRACKSIDE TREES (BOTH LEFT & RIGHT SIDES ALONG THE ENTIRE CIRCUIT)
  // Lining the track on roadside verges and grass shoulders
  for (let i = 0; i < count; i++) {
    // Keep a clean opening around the start / finish gantry arch
    if (i < 3 || i > count - 3) continue;

    const pt = worldTo3D(pts[i].x, pts[i].y);
    const nextPt = worldTo3D(pts[(i + 1) % count].x, pts[(i + 1) % count].y);

    const tx = nextPt.x - pt.x;
    const tz = nextPt.z - pt.z;
    const len = Math.hypot(tx, tz) || 1;
    const nx = -tz / len;
    const nz = tx / len;

    for (const side of [1, -1]) {
      // Row 1: Right along the crash barriers on the grass verge / shoulder
      const row1Dist = outerBarrierDist + 1.2 + ((i * 7) % 5) * 0.35;
      const jx1 = Math.sin(i * 3.7 + side) * 0.9;
      const jz1 = Math.cos(i * 3.7 + side) * 0.9;
      const c1X = pt.x + nx * row1Dist * side + jx1;
      const c1Z = pt.z + nz * row1Dist * side + jz1;

      const clear1 = isLocationClearOfTrack(c1X, c1Z, 0.2);
      if (clear1.isClear && !isTooCloseToTree(c1X, c1Z, 4.2)) {
        const treeY = getGroundY(clear1.dist3D, clear1.segElev);
        const species = (i + (side === 1 ? 0 : 2)) % 3;
        const scale = 0.85 + ((i * 13) % 7) * 0.05;
        const rotY = (i * 0.8 + side) % (Math.PI * 2);

        addTree(c1X, treeY, c1Z, scale, rotY, species, (i * 3 + side) % palette.length);
        registerTree(c1X, c1Z);
      }

      // Row 2: Secondary tree line creating layered forest depth along the roadside
      if (i % 2 === 0) {
        const row2Dist = outerBarrierDist + 4.8 + ((i * 11) % 6) * 0.6;
        const jx2 = Math.sin(i * 5.1 + side) * 1.5;
        const jz2 = Math.cos(i * 5.1 + side) * 1.5;
        const c2X = pt.x + nx * row2Dist * side + jx2;
        const c2Z = pt.z + nz * row2Dist * side + jz2;

        const clear2 = isLocationClearOfTrack(c2X, c2Z, 0.4);
        if (clear2.isClear && !isTooCloseToTree(c2X, c2Z, 4.8)) {
          const treeY = getGroundY(clear2.dist3D, clear2.segElev);
          const species = ((i * 2) + (side === 1 ? 1 : 0)) % 3;
          const scale = 0.9 + ((i * 17) % 6) * 0.06;
          const rotY = (i * 1.3) % (Math.PI * 2);

          addTree(c2X, treeY, c2Z, scale, rotY, species, (i * 5) % palette.length);
          registerTree(c2X, c2Z);
        }
      }

      // Row 3: Rich forest groves along the track perimeter
      if (i % 4 === 0) {
        const row3Dist = outerBarrierDist + 11.0 + ((i * 13) % 7) * 0.9;
        const c3X = pt.x + nx * row3Dist * side;
        const c3Z = pt.z + nz * row3Dist * side;

        const clear3 = isLocationClearOfTrack(c3X, c3Z, 0.6);
        if (clear3.isClear && !isTooCloseToTree(c3X, c3Z, 5.5)) {
          const treeY = getGroundY(clear3.dist3D, clear3.segElev);
          const species = (i + 1) % 3;
          const scale = 1.05 + ((i * 7) % 5) * 0.08;
          const rotY = (i * 0.5) % (Math.PI * 2);

          addTree(c3X, treeY, c3Z, scale, rotY, species, (i * 2) % palette.length);
          registerTree(c3X, c3Z);
        }
      }
    }
  }

  // 2. INFIELD POPULATION (INSIDE THE TRACK LOOP)
  // Fills the interior infield of the circuit with lush trees, copses, and natural groves
  let minX2D = Infinity, maxX2D = -Infinity, minY2D = Infinity, maxY2D = -Infinity;
  for (let p = 0; p < count; p++) {
    const pt2D = pts[p];
    if (pt2D.x < minX2D) minX2D = pt2D.x;
    if (pt2D.x > maxX2D) maxX2D = pt2D.x;
    if (pt2D.y < minY2D) minY2D = pt2D.y;
    if (pt2D.y > maxY2D) maxY2D = pt2D.y;
  }

  const min3D = worldTo3D(minX2D, minY2D);
  const max3D = worldTo3D(maxX2D, maxY2D);
  const bboxMinX = Math.min(min3D.x, max3D.x);
  const bboxMaxX = Math.max(min3D.x, max3D.x);
  const bboxMinZ = Math.min(min3D.z, max3D.z);
  const bboxMaxZ = Math.max(min3D.z, max3D.z);

  const infieldStep = 10.0;
  for (let gx = bboxMinX; gx <= bboxMaxX; gx += infieldStep) {
    for (let gz = bboxMinZ; gz <= bboxMaxZ; gz += infieldStep) {
      const jx = gx + Math.sin(gx * 3.3 + gz * 4.7) * 3.2;
      const jz = gz + Math.cos(gz * 5.1 + gx * 2.3) * 3.2;

      const x2D = jx / TRACK_3D_SCALE + centerX;
      const y2D = jz / TRACK_3D_SCALE + centerY;

      // Strictly test if point is INSIDE the track loop polygon
      if (isPointInsidePolygon(x2D, y2D, pts)) {
        const clear = isLocationClearOfTrack(jx, jz, 0.6);
        if (clear.isClear && !isTooCloseToTree(jx, jz, 5.0)) {
          const treeY = getGroundY(clear.dist3D, clear.segElev);
          const species = Math.abs(Math.floor(gx + gz)) % 3;
          const scale = 0.88 + (Math.abs(Math.floor(gx * gz)) % 7) * 0.06;
          const rotY = (gx + gz) * 0.4;

          addTree(jx, treeY, jz, scale, rotY, species, Math.abs(Math.floor(gx + gz * 3)) % palette.length);
          registerTree(jx, jz);
        }
      }
    }
  }

  // 3. OUTFIELD FOREST CLUSTERS (BROAD LANDSCAPE SURROUNDING CIRCUIT)
  const terrainExtent = 190;
  const outfieldStep = 13.5;
  for (let gx = -terrainExtent; gx <= terrainExtent; gx += outfieldStep) {
    for (let gz = -terrainExtent; gz <= terrainExtent; gz += outfieldStep) {
      const jx = gx + Math.sin(gx * 4.1 + gz * 3.7) * 5.0;
      const jz = gz + Math.cos(gz * 3.9 + gx * 4.3) * 5.0;

      const x2D = jx / TRACK_3D_SCALE + centerX;
      const y2D = jz / TRACK_3D_SCALE + centerY;

      if (!isPointInsidePolygon(x2D, y2D, pts)) {
        const clear = isLocationClearOfTrack(jx, jz, 1.8);
        if (clear.isClear && !isTooCloseToTree(jx, jz, 5.8)) {
          const treeY = getGroundY(clear.dist3D, clear.segElev);
          const species = Math.abs(Math.floor(gx * 2 + gz)) % 3;
          const scale = 0.9 + (Math.abs(Math.floor(gx * gz)) % 8) * 0.05;
          const rotY = (gx + gz) * 0.6;

          addTree(jx, treeY, jz, scale, rotY, species, Math.abs(Math.floor(gx * 2 + gz)) % palette.length);
          registerTree(jx, jz);
        }
      }
    }
  }

  // 4. ROLLING LANDSCAPE MOUNDS
  for (let i = 0; i < count; i += 5) {
    const pt = worldTo3D(pts[i].x, pts[i].y);
    const nextPt = worldTo3D(pts[(i + 1) % count].x, pts[(i + 1) % count].y);

    const tx = nextPt.x - pt.x;
    const tz = nextPt.z - pt.z;
    const len = Math.hypot(tx, tz) || 1;
    const nx = -tz / len;
    const nz = tx / len;

    const mSide = i % 10 === 0 ? 1 : -1;
    const moundDist = outerBarrierDist + 16.0 + ((i * 7) % 5) * 2.5;
    const mX = pt.x + nx * moundDist * mSide;
    const mZ = pt.z + nz * moundDist * mSide;

    const clear = isLocationClearOfTrack(mX, mZ, 4.5);
    if (clear.isClear) {
      moundInstances.push({
        x: mX,
        y: baseGroundY,
        z: mZ,
        scaleY: 0.65 + ((i * 5) % 6) * 0.12,
        scaleXZ: 1.2 + ((i * 11) % 5) * 0.16,
      });
    }
  }

  // Build Instanced Meshes for Tree Trunks & Foliage
  if (allTrees.length > 0) {
    const dummy = new THREE.Object3D();

    // 1. Trunks for all tree instances
    const trunkInstanced = new THREE.InstancedMesh(trunkGeom, trunkMat, allTrees.length);
    trunkInstanced.castShadow = true;
    trunkInstanced.receiveShadow = true;

    for (let idx = 0; idx < allTrees.length; idx++) {
      const t = allTrees[idx];
      dummy.position.set(t.x, t.y, t.z);
      dummy.scale.set(t.scale, t.scale, t.scale);
      dummy.rotation.set(0, t.rotY, 0);
      dummy.updateMatrix();
      trunkInstanced.setMatrixAt(idx, dummy.matrix);
    }
    trunkInstanced.instanceMatrix.needsUpdate = true;
    envGroup.add(trunkInstanced);

    // 2. Conifer / Touge Pine Foliage
    if (pineInstances.length > 0) {
      const pineInstanced = new THREE.InstancedMesh(pineFoliageGeom, foliageMat, pineInstances.length);
      pineInstanced.castShadow = true;
      pineInstanced.receiveShadow = true;
      for (let idx = 0; idx < pineInstances.length; idx++) {
        const t = pineInstances[idx];
        dummy.position.set(t.x, t.y, t.z);
        dummy.scale.set(t.scale, t.scale, t.scale);
        dummy.rotation.set(0, t.rotY, 0);
        dummy.updateMatrix();
        pineInstanced.setMatrixAt(idx, dummy.matrix);
        pineInstanced.setColorAt(idx, palette[t.paletteOffset % palette.length]);
      }
      pineInstanced.instanceMatrix.needsUpdate = true;
      if (pineInstanced.instanceColor) {
        pineInstanced.instanceColor.needsUpdate = true;
      }
      envGroup.add(pineInstanced);
    }

    // 3. Broadleaf / Sakura / Autumn Maple Foliage
    if (deciduousInstances.length > 0) {
      const deciduousInstanced = new THREE.InstancedMesh(deciduousFoliageGeom, foliageMat, deciduousInstances.length);
      deciduousInstanced.castShadow = true;
      deciduousInstanced.receiveShadow = true;
      for (let idx = 0; idx < deciduousInstances.length; idx++) {
        const t = deciduousInstances[idx];
        dummy.position.set(t.x, t.y, t.z);
        dummy.scale.set(t.scale, t.scale, t.scale);
        dummy.rotation.set(0, t.rotY, 0);
        dummy.updateMatrix();
        deciduousInstanced.setMatrixAt(idx, dummy.matrix);
        deciduousInstanced.setColorAt(idx, palette[t.paletteOffset % palette.length]);
      }
      deciduousInstanced.instanceMatrix.needsUpdate = true;
      if (deciduousInstanced.instanceColor) {
        deciduousInstanced.instanceColor.needsUpdate = true;
      }
      envGroup.add(deciduousInstanced);
    }

    // 4. Slender Cypress / Cedar Foliage
    if (cypressInstances.length > 0) {
      const cypressInstanced = new THREE.InstancedMesh(cypressFoliageGeom, foliageMat, cypressInstances.length);
      cypressInstanced.castShadow = true;
      cypressInstanced.receiveShadow = true;
      for (let idx = 0; idx < cypressInstances.length; idx++) {
        const t = cypressInstances[idx];
        dummy.position.set(t.x, t.y, t.z);
        dummy.scale.set(t.scale, t.scale, t.scale);
        dummy.rotation.set(0, t.rotY, 0);
        dummy.updateMatrix();
        cypressInstanced.setMatrixAt(idx, dummy.matrix);
        cypressInstanced.setColorAt(idx, palette[t.paletteOffset % palette.length]);
      }
      cypressInstanced.instanceMatrix.needsUpdate = true;
      if (cypressInstanced.instanceColor) {
        cypressInstanced.instanceColor.needsUpdate = true;
      }
      envGroup.add(cypressInstanced);
    }
  }

  // Build Instanced Mesh for Rolling Elevation Mounds
  if (moundInstances.length > 0) {
    const moundDummy = new THREE.Object3D();
    const moundInstanced = new THREE.InstancedMesh(moundGeom, moundMat, moundInstances.length);
    moundInstanced.receiveShadow = true;
    moundInstanced.castShadow = true;

    for (let m = 0; m < moundInstances.length; m++) {
      const inst = moundInstances[m];
      moundDummy.position.set(inst.x, inst.y, inst.z);
      moundDummy.scale.set(inst.scaleXZ, inst.scaleY, inst.scaleXZ);
      moundDummy.rotation.set(0, 0, 0);
      moundDummy.updateMatrix();
      moundInstanced.setMatrixAt(m, moundDummy.matrix);
    }
    moundInstanced.instanceMatrix.needsUpdate = true;
    envGroup.add(moundInstanced);
  }

  trackGroup.add(envGroup);

  return {
    trackGroup,
    centerX,
    centerZ: centerY,
    worldTo3D,
    start3DPos: { x: startP3D.x, y: startElevY + 0.1, z: startP3D.z },
    start3DAngle: startAngle,
    start3DPitch: startPitch,
    baseGroundY,
  };
}
