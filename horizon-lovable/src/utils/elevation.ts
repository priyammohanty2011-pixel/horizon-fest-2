import { ElevationControlNode, ElevationProfile } from '../types/game';

export const ELEVATION_PRESETS: {
  id: ElevationProfile['preset'];
  name: string;
  description: string;
  icon: string;
  nodeHeights: number[]; // heights in meters for 8 canonical nodes
}[] = [
  {
    id: 'flat',
    name: 'Flat Circuit',
    description: 'Level ground, minimal gradient (Silverstone / Monza)',
    icon: '—',
    nodeHeights: [0, 0, 0, 0, 0, 0, 0, 0],
  },
  {
    id: 'rolling',
    name: 'Rolling Countryside',
    description: 'Gentle natural crests & dips (Brands Hatch / Road America)',
    icon: '∿',
    nodeHeights: [0, 6, 14, 8, -4, 12, 5, 0],
  },
  {
    id: 'mountain',
    name: 'Mountain Pass',
    description: 'Dramatic vertical climbs & plunging dropoffs (Bathurst / Pikes Peak)',
    icon: '▲',
    nodeHeights: [0, 15, 38, 44, 22, -8, 18, 0],
  },
  {
    id: 'eaurouge',
    name: 'Eau Rouge Crest',
    description: 'Uphill downhill valley into a blind compression (Spa-Francorchamps)',
    icon: '⚡',
    nodeHeights: [0, -6, 26, 28, 12, 4, 10, 0],
  },
  {
    id: 'rollercoaster',
    name: 'Rollercoaster',
    description: 'Continuous technical undulations and camber shifts (Nürburgring)',
    icon: '🎢',
    nodeHeights: [0, 18, -10, 24, -12, 20, -5, 0],
  },
];

const DEFAULT_NODE_PROGRESS = [0.0, 0.14, 0.28, 0.42, 0.57, 0.71, 0.85, 1.0];
const DEFAULT_NODE_LABELS = [
  'Start / Finish',
  'Sector 1',
  'Turn 2 / Hillside',
  'Apex Crest',
  'Back Straight Dip',
  'Downhill Sweep',
  'Final Chicane',
  'Start / Finish',
];

export function createDefaultElevationProfile(
  presetId: ElevationProfile['preset'] = 'rolling',
  multiplier: number = 1.0
): ElevationProfile {
  const presetConfig =
    ELEVATION_PRESETS.find((p) => p.id === presetId) || ELEVATION_PRESETS[1];

  const nodes: ElevationControlNode[] = DEFAULT_NODE_PROGRESS.map((prog, idx) => ({
    id: `node-${idx}`,
    progress: prog,
    label: DEFAULT_NODE_LABELS[idx],
    height: (presetConfig.nodeHeights[idx] ?? 0) * multiplier,
  }));

  return {
    preset: presetId,
    heightMultiplier: multiplier,
    nodes,
  };
}

/**
 * Evaluates smooth interpolated elevation height in meters at normalized progress [0, 1]
 */
export function getTrackElevationAtProgress(
  progress: number,
  profile?: ElevationProfile
): number {
  if (!profile || profile.preset === 'flat' || profile.heightMultiplier === 0) {
    return 0;
  }

  const nodes = profile.nodes;
  if (!nodes || nodes.length < 2) return 0;

  // Normalize progress to [0, 1]
  const pNorm = ((progress % 1) + 1) % 1;
  const numNodes = nodes.length - 1; // last node is loop closure of first node

  // Find surrounding nodes
  let idx = 0;
  for (let i = 0; i < nodes.length - 1; i++) {
    if (pNorm >= nodes[i].progress && pNorm <= nodes[i + 1].progress) {
      idx = i;
      break;
    }
  }

  const n0 = nodes[(idx - 1 + numNodes) % numNodes];
  const n1 = nodes[idx];
  const n2 = nodes[(idx + 1) % nodes.length];
  const n3 = nodes[(idx + 2) % nodes.length];

  const segRange = n2.progress - n1.progress;
  const t = segRange > 0 ? (pNorm - n1.progress) / segRange : 0;

  // Catmull-Rom cubic interpolation for ultra-smooth elevation transitions
  const t2 = t * t;
  const t3 = t2 * t;

  const y0 = n0.height;
  const y1 = n1.height;
  const y2 = n2.height;
  const y3 = n3.height;

  const heightMeters =
    0.5 *
    (2 * y1 +
      (-y0 + y2) * t +
      (2 * y0 - 5 * y1 + 4 * y2 - y3) * t2 +
      (-y0 + 3 * y1 - 3 * y2 + y3) * t3);

  return heightMeters * profile.heightMultiplier;
}

/**
 * Updates a single node height on the profile
 */
export function updateElevationNodeHeight(
  profile: ElevationProfile,
  nodeId: string,
  newHeight: number
): ElevationProfile {
  const updatedNodes = profile.nodes.map((node) => {
    if (node.id === nodeId) {
      return { ...node, height: Math.round(newHeight * 10) / 10 };
    }
    return node;
  });

  // Keep first and last nodes in sync for closed circuits
  if (nodeId === 'node-0') {
    const lastIdx = updatedNodes.length - 1;
    updatedNodes[lastIdx] = { ...updatedNodes[lastIdx], height: updatedNodes[0].height };
  } else if (nodeId === `node-${updatedNodes.length - 1}`) {
    updatedNodes[0] = { ...updatedNodes[0], height: updatedNodes[updatedNodes.length - 1].height };
  }

  return {
    ...profile,
    preset: 'custom',
    nodes: updatedNodes,
  };
}

/**
 * Calculates elevation delta and maximum slope gradient for telemetry
 */
export function computeElevationTelemetryStats(profile: ElevationProfile): {
  elevationDeltaMeters: number;
  maxGradientPercent: number;
} {
  let minH = Infinity;
  let maxH = -Infinity;
  let maxSlope = 0;

  const samples = 120;
  for (let s = 0; s < samples; s++) {
    const p1 = s / samples;
    const p2 = (s + 1) / samples;
    const h1 = getTrackElevationAtProgress(p1, profile);
    const h2 = getTrackElevationAtProgress(p2, profile);

    if (h1 < minH) minH = h1;
    if (h1 > maxH) maxH = h1;

    const slope = Math.abs(h2 - h1);
    if (slope > maxSlope) maxSlope = slope;
  }

  const delta = Number((maxH - minH).toFixed(1));
  const gradient = Number((Math.min(18.5, maxSlope * 2.8)).toFixed(1));

  return {
    elevationDeltaMeters: Math.max(0, delta),
    maxGradientPercent: gradient,
  };
}
