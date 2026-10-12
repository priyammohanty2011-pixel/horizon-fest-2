import { Point2D } from '../types/game';

/**
 * Official Horizon Fest 2 Preset Circuits
 */

export interface PresetTrackDef {
  id: string;
  name: string;
  description: string;
  width: number;
  generatePoints: (width: number, height: number) => Point2D[];
}

export const PRESET_TRACKS: PresetTrackDef[] = [
  {
    id: 'grandprix',
    name: 'Grand Prix',
    description: 'FIA Grade 1 style circuit with chicane, hairpin, and high-speed sweepers',
    width: 48,
    generatePoints: (w: number, h: number) => {
      const cx = w / 2;
      const cy = h / 2;
      const scaleX = w / 1400;
      const scaleY = h / 850;

      const baseCoords: [number, number][] = [
        [320, 680],
        [500, 680],
        [720, 680],
        [940, 670],
        [1100, 640],
        [1160, 540],
        [1180, 400],
        [1060, 340],
        [1140, 240],
        [1040, 160],
        [840, 160],
        [660, 190],
        [540, 260],
        [460, 180],
        [320, 190],
        [220, 280],
        [190, 420],
        [240, 530],
        [320, 580],
        [230, 640],
      ];

      return baseCoords.map(([x, y]) => ({
        x: cx + (x - 680) * scaleX,
        y: cy + (y - 425) * scaleY,
      }));
    },
  },
  {
    id: 'flowing',
    name: 'Flowing',
    description: 'High-momentum sweeping curves and rhythm transitions (Spa / Suzuka style)',
    width: 46,
    generatePoints: (w: number, h: number) => {
      const cx = w / 2;
      const cy = h / 2;
      const scaleX = w / 1400;
      const scaleY = h / 850;

      const baseCoords: [number, number][] = [
        [300, 640],
        [600, 660],
        [880, 630],
        [1120, 560],
        [1180, 420],
        [1060, 320],
        [940, 380],
        [820, 300],
        [880, 180],
        [720, 160],
        [540, 220],
        [420, 180],
        [260, 240],
        [220, 380],
        [320, 480],
        [240, 580],
      ];

      return baseCoords.map(([x, y]) => ({
        x: cx + (x - 700) * scaleX,
        y: cy + (y - 425) * scaleY,
      }));
    },
  },
  {
    id: 'technical',
    name: 'Technical',
    description: 'Tight hairpins, double-apexes, and heavy braking zones',
    width: 44,
    generatePoints: (w: number, h: number) => {
      const cx = w / 2;
      const cy = h / 2;
      const scaleX = w / 1400;
      const scaleY = h / 850;

      const baseCoords: [number, number][] = [
        [320, 660],
        [580, 660],
        [780, 620],
        [940, 540],
        [860, 440],
        [700, 480],
        [580, 420],
        [660, 320],
        [840, 310],
        [1020, 260],
        [1120, 180],
        [980, 150],
        [780, 160],
        [580, 200],
        [420, 220],
        [280, 280],
        [340, 400],
        [440, 480],
        [340, 560],
      ];

      return baseCoords.map(([x, y]) => ({
        x: cx + (x - 700) * scaleX,
        y: cy + (y - 425) * scaleY,
      }));
    },
  },
  {
    id: 'street',
    name: 'Street',
    description: 'Monaco / Baku style geometric 90-degree corners and barrier-lined straights',
    width: 42,
    generatePoints: (w: number, h: number) => {
      const cx = w / 2;
      const cy = h / 2;
      const scaleX = w / 1400;
      const scaleY = h / 850;

      const baseCoords: [number, number][] = [
        [280, 660],
        [720, 660],
        [1040, 660],
        [1140, 560],
        [1140, 360],
        [1000, 360],
        [1000, 240],
        [820, 240],
        [820, 160],
        [480, 160],
        [480, 260],
        [320, 260],
        [240, 340],
        [240, 520],
      ];

      return baseCoords.map(([x, y]) => ({
        x: cx + (x - 690) * scaleX,
        y: cy + (y - 410) * scaleY,
      }));
    },
  },
  {
    id: 'oval',
    name: 'Oval',
    description: 'High-speed classic two-turn superspeedway oval',
    width: 52,
    generatePoints: (w: number, h: number) => {
      const cx = w / 2;
      const cy = h / 2;
      const rx = w * 0.38;
      const ry = h * 0.30;
      const points: Point2D[] = [];
      const numPts = 32;

      for (let i = 0; i < numPts; i++) {
        const theta = (i / numPts) * Math.PI * 2;
        const cosT = Math.cos(theta);
        const sinT = Math.sin(theta);
        const x = cx + rx * Math.sign(cosT) * Math.pow(Math.abs(cosT), 0.85);
        const y = cy + ry * Math.sign(sinT) * Math.pow(Math.abs(sinT), 1.15);
        points.push({ x, y });
      }
      return points;
    },
  },
  {
    id: 'kart',
    name: 'Kart',
    description: 'Compact high-G indoor / outdoor karting arena track',
    width: 38,
    generatePoints: (w: number, h: number) => {
      const cx = w / 2;
      const cy = h / 2;
      const scaleX = w / 1400;
      const scaleY = h / 850;

      const baseCoords: [number, number][] = [
        [360, 620],
        [540, 620],
        [720, 580],
        [880, 620],
        [1020, 560],
        [1060, 440],
        [940, 360],
        [820, 420],
        [740, 320],
        [860, 220],
        [740, 180],
        [560, 220],
        [480, 320],
        [380, 240],
        [280, 340],
        [360, 460],
        [260, 540],
      ];

      return baseCoords.map(([x, y]) => ({
        x: cx + (x - 660) * scaleX,
        y: cy + (y - 400) * scaleY,
      }));
    },
  },
];
