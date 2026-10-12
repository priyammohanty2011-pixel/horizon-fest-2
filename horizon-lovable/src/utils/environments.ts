import * as THREE from 'three';

export type EnvironmentType =
  | 'pacific_coast'
  | 'kyoto_autumn'
  | 'fuji_sakura';

export interface EnvironmentConfig {
  id: EnvironmentType;
  name: string;
  subtitle: string;
  tagline: string;
  badgeGradient: string;
  accentColor: string;
  sky: {
    topColor: number;      // Zenith color
    midColor: number;      // Middle atmospheric color
    bottomColor: number;   // Horizon haze color
    sunColor: number;      // Sun / Moon color
    sunPosition: [number, number, number]; // [x, y, z]
    sunIntensity: number;
    sunGlowSize: number;
  };
  ambient: {
    color: number;
    intensity: number;
  };
  fog: {
    color: number;
    density: number;
  };
  ground: {
    baseColor: string;
    stripeColor: string;
    speckle1: string;
    speckle2: string;
    roughness: number;
    metalness: number;
  };
  foliage: {
    trunkColor: number;
    foliageColors: number[];
    moundColor: number;
  };
  effects: {
    hasSkyLasers?: boolean;
    laserColors?: number[];
    hasPetals?: boolean;
    petalColor?: number;
    hasLeaves?: boolean;
    leafColors?: number[];
    hasSparkles?: boolean;
    sparkleColors?: number[];
    hasLightning?: boolean;
    hasCyberGlow?: boolean;
  };
}

export const ENVIRONMENTS: Record<EnvironmentType, EnvironmentConfig> = {
  pacific_coast: {
    id: 'pacific_coast',
    name: 'Pacific Coastal Highway',
    subtitle: 'Tropical Summer High Noon',
    tagline: 'Radiant tropical azure skies, sparkling ocean sunshine & bright coastal palms',
    badgeGradient: 'from-sky-500 via-cyan-400 to-emerald-400',
    accentColor: '#0284c7',
    sky: {
      topColor: 0x0284c7,      // Vivid tropical blue
      midColor: 0x38bdf8,      // Crisp ocean turquoise
      bottomColor: 0xe0f2fe,   // Crystal sea-spray horizon
      sunColor: 0xffffff,      // Blazing midday sun
      sunPosition: [80, 170, 60],
      sunIntensity: 2.6,
      sunGlowSize: 1.4,
    },
    ambient: {
      color: 0xbae6fd,
      intensity: 0.95,
    },
    fog: {
      color: 0xa5f3fc,
      density: 0.0009,         // Crystal clear long draw distance
    },
    ground: {
      baseColor: '#166534',    // Sun-drenched coastal lawn
      stripeColor: 'rgba(22, 101, 52, 0.35)',
      speckle1: 'rgba(253, 224, 71, 0.12)', // Sandy undertone
      speckle2: 'rgba(34, 197, 94, 0.18)',
      roughness: 0.85,
      metalness: 0.02,
    },
    foliage: {
      trunkColor: 0x543d2b,
      foliageColors: [0x16a34a, 0x22c55e, 0x15803d, 0x4ade80], // Bright vibrant tropical green
      moundColor: 0x1e5a2e,
    },
    effects: {
      hasSparkles: true,
      sparkleColors: [0x38bdf8, 0xfde047, 0xffffff],
    },
  },

  kyoto_autumn: {
    id: 'kyoto_autumn',
    name: 'Kyoto Autumn Touge',
    subtitle: 'Maple Fall Mountain Pass',
    tagline: 'Blazing scarlet & amber Japanese maple trees with golden afternoon haze',
    badgeGradient: 'from-red-600 via-orange-500 to-amber-400',
    accentColor: '#ea580c',
    sky: {
      topColor: 0x7c2d12,      // Deep warm amber zenith
      midColor: 0xc2410c,      // Rich fiery orange
      bottomColor: 0xfde047,   // Glowing harvest gold horizon
      sunColor: 0xffe082,      // Warm amber sun
      sunPosition: [140, 65, -90],
      sunIntensity: 2.4,
      sunGlowSize: 1.3,
    },
    ambient: {
      color: 0xf59e0b,
      intensity: 0.82,
    },
    fog: {
      color: 0x9a3412,
      density: 0.0017,
    },
    ground: {
      baseColor: '#362112',    // Rich autumn soil & fallen leaves
      stripeColor: 'rgba(56, 32, 16, 0.45)',
      speckle1: 'rgba(234, 88, 12, 0.25)', // Fallen maple leaves
      speckle2: 'rgba(245, 158, 11, 0.22)',
      roughness: 0.9,
      metalness: 0.04,
    },
    foliage: {
      trunkColor: 0x331f13,
      foliageColors: [0xdc2626, 0xb91c1c, 0xea580c, 0xf59e0b], // Fiery scarlet, flame orange, and golden maple
      moundColor: 0x452311,
    },
    effects: {
      hasLeaves: true,
      leafColors: [0xdc2626, 0xea580c, 0xf59e0b],
    },
  },

  fuji_sakura: {
    id: 'fuji_sakura',
    name: 'Mount Fuji Sakura Touge',
    subtitle: 'Japanese Spring Morning',
    tagline: 'Crisp alpine air, majestic blooming cherry blossoms & drifting petals',
    badgeGradient: 'from-pink-400 via-rose-300 to-sky-400',
    accentColor: '#f472b6',
    sky: {
      topColor: 0x0284c7,      // Crisp alpine blue zenith
      midColor: 0x7dd3fc,      // Soft azure morning sky
      bottomColor: 0xfce7f3,   // Rose pastel dawn horizon
      sunColor: 0xfffbeb,      // Pure crisp morning sunlight
      sunPosition: [110, 120, 80],
      sunIntensity: 2.1,
      sunGlowSize: 1.0,
    },
    ambient: {
      color: 0xbae6fd,
      intensity: 0.88,
    },
    fog: {
      color: 0xdbeafe,
      density: 0.0013,
    },
    ground: {
      baseColor: '#15803d',
      stripeColor: 'rgba(22, 101, 52, 0.4)',
      speckle1: 'rgba(244, 114, 182, 0.22)', // Scattered pink petals on lawn
      speckle2: 'rgba(74, 222, 128, 0.15)',
      roughness: 0.85,
      metalness: 0.02,
    },
    foliage: {
      trunkColor: 0x3d271d,    // Dark Japanese cherry wood
      foliageColors: [0xf472b6, 0xfbcfe8, 0xec4899, 0xfda4af], // Gorgeous pink cherry blossoms
      moundColor: 0x166534,
    },
    effects: {
      hasPetals: true,
      petalColor: 0xf472b6,
    },
  },
};

export const DEFAULT_ENVIRONMENT: EnvironmentType = 'pacific_coast';
export const ENVIRONMENT_LIST = Object.values(ENVIRONMENTS);
