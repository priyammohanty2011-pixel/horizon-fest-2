import React, { useRef, useState } from 'react';
import { ElevationControlNode, ElevationProfile } from '../types/game';
import {
  ELEVATION_PRESETS,
  computeElevationTelemetryStats,
  getTrackElevationAtProgress,
  updateElevationNodeHeight,
} from '../utils/elevation';
import { sound } from '../utils/audio';
import { ChevronDown, ChevronUp, Mountain, RotateCcw, Sliders, Sparkles } from 'lucide-react';

interface ElevationBoardProps {
  profile: ElevationProfile;
  onChange: (newProfile: ElevationProfile) => void;
  isOpen?: boolean;
  onToggle?: () => void;
}

export const ElevationBoard: React.FC<ElevationBoardProps> = ({
  profile,
  onChange,
  isOpen: externalIsOpen,
  onToggle,
}) => {
  const [internalIsOpen, setInternalIsOpen] = useState(false);
  const isOpen = externalIsOpen !== undefined ? externalIsOpen : internalIsOpen;
  const toggleOpen = () => {
    if (onToggle) {
      onToggle();
    } else {
      setInternalIsOpen(!internalIsOpen);
    }
  };
  const [draggingNodeId, setDraggingNodeId] = useState<string | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);

  const stats = computeElevationTelemetryStats(profile);

  // SVG Graph coordinate mapping
  const graphWidth = 460;
  const graphHeight = 120;
  const paddingY = 16;
  const paddingX = 24;

  const minMeters = -20;
  const maxMeters = 50;
  const rangeMeters = maxMeters - minMeters;

  const metersToY = (meters: number): number => {
    const clamped = Math.max(minMeters, Math.min(maxMeters, meters));
    const ratio = (clamped - minMeters) / rangeMeters;
    return graphHeight - paddingY - ratio * (graphHeight - paddingY * 2);
  };

  const yToMeters = (y: number): number => {
    const ratio = (graphHeight - paddingY - y) / (graphHeight - paddingY * 2);
    const m = minMeters + ratio * rangeMeters;
    return Math.max(minMeters, Math.min(maxMeters, Math.round(m * 10) / 10));
  };

  const progressToX = (prog: number): number => {
    return paddingX + prog * (graphWidth - paddingX * 2);
  };

  const xToProgress = (x: number): number => {
    const ratio = (x - paddingX) / (graphWidth - paddingX * 2);
    return Math.max(0, Math.min(1, ratio));
  };

  // Generate smooth SVG curve path from the profile
  const samplePoints: { x: number; y: number }[] = [];
  const samples = 80;
  for (let s = 0; s <= samples; s++) {
    const prog = s / samples;
    const h = getTrackElevationAtProgress(prog, profile);
    samplePoints.push({
      x: progressToX(prog),
      y: metersToY(h),
    });
  }

  let pathD = `M ${samplePoints[0].x} ${samplePoints[0].y}`;
  for (let i = 1; i < samplePoints.length; i++) {
    pathD += ` L ${samplePoints[i].x} ${samplePoints[i].y}`;
  }

  // Filled area path under curve
  const zeroY = metersToY(0);
  const areaD = `${pathD} L ${samplePoints[samplePoints.length - 1].x} ${zeroY} L ${samplePoints[0].x} ${zeroY} Z`;

  // Drag interaction
  const handlePointerDown = (nodeId: string, e: React.PointerEvent) => {
    e.stopPropagation();
    sound.playClick();
    setDraggingNodeId(nodeId);
    (e.target as Element).setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!draggingNodeId || !svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    const relativeY = ((e.clientY - rect.top) / rect.height) * graphHeight;
    const newH = yToMeters(relativeY);

    const updated = updateElevationNodeHeight(profile, draggingNodeId, newH);
    onChange(updated);
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (draggingNodeId) {
      setDraggingNodeId(null);
      try {
        (e.target as Element).releasePointerCapture(e.pointerId);
      } catch {
        // ignore if already released
      }
    }
  };

  const handleSelectPreset = (presetId: ElevationProfile['preset']) => {
    sound.playClick();
    const preset = ELEVATION_PRESETS.find((p) => p.id === presetId);
    if (!preset) return;

    const newNodes: ElevationControlNode[] = profile.nodes.map((node, i) => ({
      ...node,
      height: preset.nodeHeights[i] ?? 0,
    }));

    onChange({
      ...profile,
      preset: presetId,
      nodes: newNodes,
    });
  };

  const handleMultiplierChange = (newMult: number) => {
    onChange({
      ...profile,
      heightMultiplier: Math.round(newMult * 100) / 100,
    });
  };

  const handleResetToFlat = () => {
    sound.playClick();
    handleSelectPreset('flat');
  };

  if (!isOpen) return null;

  return (
    <div className="absolute top-16 right-4 z-40 w-80 md:w-96 rounded-2xl bg-slate-950/98 border border-slate-800/90 backdrop-blur-xl shadow-2xl text-slate-200 select-none overflow-hidden transition-all duration-200">
      {/* Header bar with toggle */}
      <div className="flex items-center justify-between px-4 py-3 bg-slate-900/90 border-b border-slate-800/80">
        <div className="flex items-center gap-2">
          <Mountain className="w-4 h-4 text-cyan-400" />
          <span className="text-xs font-bold uppercase tracking-wider text-white">
            Elevation & Height Board
          </span>
          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-cyan-950/80 border border-cyan-800/60 text-cyan-400 font-bold">
            Δ {stats.elevationDeltaMeters}m
          </span>
        </div>
        <button
          onClick={toggleOpen}
          className="p-1 rounded-md text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          title="Close Elevation Board"
        >
          <ChevronUp className="w-4 h-4" />
        </button>
      </div>

      {isOpen && (
        <div className="p-3.5 space-y-3.5">
          {/* Preset Buttons */}
          <div>
            <div className="flex items-center justify-between text-[11px] mb-1.5 text-slate-400 font-semibold uppercase tracking-wider">
              <span>Height Presets</span>
              <button
                onClick={handleResetToFlat}
                className="text-[10px] text-slate-400 hover:text-rose-400 flex items-center gap-1 font-mono transition-colors"
                title="Flatten track to 0m"
              >
                <RotateCcw className="w-2.5 h-2.5" /> Reset Flat
              </button>
            </div>
            <div className="grid grid-cols-3 gap-1.5 font-mono text-[11px]">
              {ELEVATION_PRESETS.map((p) => {
                const isActive = profile.preset === p.id;
                return (
                  <button
                    key={p.id}
                    onClick={() => handleSelectPreset(p.id)}
                    className={`px-2 py-1.5 rounded-lg border text-left transition-all flex flex-col items-start ${
                      isActive
                        ? 'bg-cyan-500/20 border-cyan-400 text-cyan-300 font-bold shadow-xs'
                        : 'bg-slate-900 hover:bg-slate-800/80 border-slate-800 text-slate-300'
                    }`}
                  >
                    <span className="text-[10px] text-slate-400">{p.icon}</span>
                    <span className="text-xs truncate w-full">{p.name.split(' ')[0]}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Interactive Elevation Curve Board */}
          <div>
            <div className="flex items-center justify-between text-[10px] text-slate-400 mb-1 font-mono">
              <span className="font-semibold text-slate-300 uppercase tracking-wider">
                Interactive Circuit Altitude Waveform
              </span>
              <span className="text-cyan-400 font-bold">Drag Handles Up/Down</span>
            </div>

            <div className="relative rounded-xl bg-slate-900 border border-slate-800 p-1 overflow-hidden">
              <svg
                ref={svgRef}
                viewBox={`0 0 ${graphWidth} ${graphHeight}`}
                className="w-full h-28 touch-none cursor-ns-resize"
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
              >
                {/* Horizontal reference grid lines */}
                <line
                  x1={paddingX}
                  y1={metersToY(30)}
                  x2={graphWidth - paddingX}
                  y2={metersToY(30)}
                  stroke="#334155"
                  strokeDasharray="3 3"
                  strokeWidth="0.8"
                />
                <line
                  x1={paddingX}
                  y1={zeroY}
                  x2={graphWidth - paddingX}
                  y2={zeroY}
                  stroke="#475569"
                  strokeWidth="1.2"
                />
                <line
                  x1={paddingX}
                  y1={metersToY(-10)}
                  x2={graphWidth - paddingX}
                  y2={metersToY(-10)}
                  stroke="#334155"
                  strokeDasharray="3 3"
                  strokeWidth="0.8"
                />

                {/* Y-Axis Elevation Markers */}
                <text x="6" y={metersToY(30) + 3} fill="#64748b" fontSize="8" fontFamily="monospace">
                  +30m
                </text>
                <text x="6" y={zeroY + 3} fill="#94a3b8" fontSize="8" fontFamily="monospace">
                  0m
                </text>
                <text x="6" y={metersToY(-10) + 3} fill="#64748b" fontSize="8" fontFamily="monospace">
                  -10m
                </text>

                {/* Shaded Area under Curve */}
                <path d={areaD} fill="rgba(6, 182, 212, 0.12)" />

                {/* Main Elevation Curve Line */}
                <path
                  d={pathD}
                  fill="none"
                  stroke="#06b6d4"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />

                {/* Draggable Elevation Handles / Nodes */}
                {profile.nodes.map((node) => {
                  const cx = progressToX(node.progress);
                  const effectiveH = node.height * profile.heightMultiplier;
                  const cy = metersToY(effectiveH);
                  const isDragging = draggingNodeId === node.id;

                  return (
                    <g key={node.id} className="cursor-grab active:cursor-grabbing">
                      {/* Vertical marker stem to 0m line */}
                      <line
                        x1={cx}
                        y1={zeroY}
                        x2={cx}
                        y2={cy}
                        stroke={isDragging ? '#38bdf8' : '#334155'}
                        strokeWidth="1"
                        strokeDasharray="2 2"
                      />

                      {/* Interactive Drag Handle Node */}
                      <circle
                        cx={cx}
                        cy={cy}
                        r={isDragging ? 7.5 : 5.5}
                        fill={isDragging ? '#38bdf8' : '#0284c7'}
                        stroke="#ffffff"
                        strokeWidth="2"
                        className="transition-transform hover:scale-125"
                        onPointerDown={(e) => handlePointerDown(node.id, e)}
                      />

                      {/* Height value badge */}
                      <text
                        x={cx}
                        y={cy > 25 ? cy - 8 : cy + 15}
                        fill={isDragging ? '#38bdf8' : '#cbd5e1'}
                        fontSize="8.5"
                        fontWeight="bold"
                        fontFamily="monospace"
                        textAnchor="middle"
                      >
                        {node.height > 0 ? `+${node.height}m` : `${node.height}m`}
                      </text>
                    </g>
                  );
                })}
              </svg>
            </div>
          </div>

          {/* Elevation Amplitude / Multiplier Slider */}
          <div>
            <div className="flex justify-between text-[11px] mb-1 font-mono">
              <span className="text-slate-300 flex items-center gap-1 font-semibold">
                <Sliders className="w-3 h-3 text-slate-400" /> Height Intensity Multiplier
              </span>
              <span className="text-cyan-400 font-bold font-mono">
                {profile.heightMultiplier.toFixed(2)}x
              </span>
            </div>
            <input
              type="range"
              min="0.0"
              max="2.5"
              step="0.05"
              value={profile.heightMultiplier}
              onChange={(e) => handleMultiplierChange(parseFloat(e.target.value))}
              className="w-full accent-cyan-400 cursor-pointer h-1.5 bg-slate-800 rounded-lg"
            />
            <div className="flex justify-between text-[10px] text-slate-500 font-mono mt-0.5">
              <span>0x (Flat)</span>
              <span>1.0x (Standard)</span>
              <span>2.5x (Extreme Hills)</span>
            </div>
          </div>

          {/* Quick Metrics Bar */}
          <div className="grid grid-cols-2 gap-2 p-2 rounded-xl bg-slate-900/90 border border-slate-800 font-mono text-[11px]">
            <div className="flex items-center justify-between">
              <span className="text-slate-400">Total Lift:</span>
              <span className="text-cyan-300 font-bold">Δ {stats.elevationDeltaMeters} m</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-400">Max Grade:</span>
              <span className="text-rose-400 font-bold">{stats.maxGradientPercent}%</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
