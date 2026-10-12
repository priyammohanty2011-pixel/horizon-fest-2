import React, { useState, useRef, useEffect } from 'react';
import { Camera3DMode, CarConfig, GameMode, LapStats, Track } from '../types/game';
import { ENVIRONMENT_LIST, ENVIRONMENTS, EnvironmentType } from '../utils/environments';
import { CAR_CONFIGS } from '../utils/physics';
import { PRESET_TRACKS } from '../utils/presets';
import { sound } from '../utils/audio';
import {
  ArrowLeftRight,
  Box,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Compass,
  Copy,
  Eye,
  HelpCircle,
  Home,
  Image,
  Info,
  Link2,
  Maximize,
  Maximize2,
  Minimize,
  Mountain,
  Move,
  Play,
  RotateCcw,
  Sliders,
  Sparkles,
  Trash2,
  Undo2,
  Unlink,
  Upload,
  Volume2,
  VolumeX,
  Zap,
} from 'lucide-react';

interface HUDProps {
  mode: GameMode;
  onSetMode: (mode: GameMode) => void;
  track: Track | null;
  brushWidth: number;
  onBrushWidthChange: (width: number) => void;
  barrierDistance: number;
  onBarrierDistanceChange: (dist: number) => void;
  trackLengthScale: number;
  onTrackLengthScaleChange: (scale: number) => void;
  trackBreadthScale?: number;
  onTrackBreadthScaleChange?: (scale: number) => void;
  linkDimensions?: boolean;
  onToggleLinkDimensions?: () => void;
  drawMethod: 'freehand' | 'dots';
  onDrawMethodChange: (method: 'freehand' | 'dots') => void;
  smoothingMode: string;
  onSmoothingModeChange: (mode: string) => void;
  carConfig: CarConfig;
  onCarConfigChange: (config: CarConfig) => void;
  cameraMode: Camera3DMode;
  onToggleCamera: () => void;
  speed: number;
  rpm: number;
  isDrifting: boolean;
  isOffroad: boolean;
  gear?: number;
  driftScore?: number;
  driftMultiplier?: number;
  turboBoost?: number;
  lapStats: LapStats;
  isMuted: boolean;
  onToggleMute: () => void;
  showTouchControls: boolean;
  onToggleTouchControls: () => void;
  onToggleHills: () => void;
  isHillsOpen: boolean;
  environment?: EnvironmentType;
  onEnvironmentChange?: (env: EnvironmentType) => void;
}

export const HUD: React.FC<HUDProps> = ({
  mode,
  onSetMode,
  track,
  brushWidth,
  onBrushWidthChange,
  barrierDistance,
  onBarrierDistanceChange,
  trackLengthScale,
  onTrackLengthScaleChange,
  trackBreadthScale = 1.0,
  onTrackBreadthScaleChange,
  linkDimensions = true,
  onToggleLinkDimensions,
  drawMethod,
  onDrawMethodChange,
  smoothingMode,
  onSmoothingModeChange,
  carConfig,
  onCarConfigChange,
  cameraMode,
  onToggleCamera,
  speed,
  rpm,
  isDrifting,
  isOffroad,
  gear = 1,
  driftScore = 0,
  driftMultiplier = 1.0,
  turboBoost = 0,
  lapStats,
  isMuted,
  onToggleMute,
  showTouchControls,
  onToggleTouchControls,
  onToggleHills,
  isHillsOpen,
  environment = 'pacific_coast',
  onEnvironmentChange,
}) => {
  const [showTracksDropdown, setShowTracksDropdown] = useState(false);
  const [showEnvDropdown, setShowEnvDropdown] = useState(false);
  const [showMoreSettings, setShowMoreSettings] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [shareCopied, setShareCopied] = useState(false);
  const [zoomPercent, setZoomPercent] = useState(100);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isPanToolActive, setIsPanToolActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const currentEnvConfig = ENVIRONMENTS[environment] || ENVIRONMENTS.pacific_coast;

  // Sync zoom percentage when zooming with mouse wheel on canvas
  useEffect(() => {
    const handleZoomSync = (e: Event) => {
      const custom = e as CustomEvent;
      if (custom.detail?.zoomPercent !== undefined) {
        setZoomPercent(Math.round(custom.detail.zoomPercent));
      }
    };
    window.addEventListener('APEX_CANVAS_ZOOM_SYNC', handleZoomSync);
    return () => window.removeEventListener('APEX_CANVAS_ZOOM_SYNC', handleZoomSync);
  }, []);

  // Fallback telemetry
  const telemetry = track?.telemetry || {
    lengthFormatted: '2.893 km',
    cornersCount: 12,
    longestStraightFormatted: '680 m',
    elevationChangeMeters: 24.5,
    maxGradientPercent: 6.2,
    tightestRadiusMeters: 38,
  };

  const handleStartRace = () => {
    sound.playClick();
    onSetMode('RACE');
  };

  const handleClear = () => {
    sound.playClick();
    onTrackLengthScaleChange(1.0);
    onTrackBreadthScaleChange?.(1.0);
    window.dispatchEvent(new CustomEvent('APEX_CLEAR_TRACK'));
  };

  const handleUndo = () => {
    sound.playClick();
    window.dispatchEvent(new CustomEvent('APEX_UNDO_POINT'));
  };

  const handleReverse = () => {
    sound.playClick();
    window.dispatchEvent(new CustomEvent('APEX_REVERSE_TRACK'));
  };

  const handleLoadPreset = (presetId: string) => {
    sound.playClick();
    setShowTracksDropdown(false);
    onTrackLengthScaleChange(1.0);
    onTrackBreadthScaleChange?.(1.0);
    window.dispatchEvent(
      new CustomEvent('APEX_LOAD_PRESET', { detail: { presetId } })
    );
  };

  const handleFitCircuitToBoard = () => {
    sound.playClick();
    onTrackLengthScaleChange(1.0);
    onTrackBreadthScaleChange?.(1.0);
    window.dispatchEvent(new CustomEvent('APEX_NORMALIZE_TRACK_TO_BOARD'));
  };

  const handleShare = () => {
    sound.playClick();
    navigator.clipboard?.writeText(window.location.href);
    setShareCopied(true);
    setTimeout(() => setShareCopied(false), 2000);
  };

  const handleTraceImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const url = event.target?.result as string;
        window.dispatchEvent(
          new CustomEvent('APEX_SET_TRACE_IMAGE', { detail: { url } })
        );
      };
      reader.readAsDataURL(file);
    }
  };

  return (
    <>
      {/* ========================================================================= */}
      {/* TOP HEADER BAR (Exact ApexDrawn v4.0 Layout) */}
      {/* ========================================================================= */}
      <header className="absolute top-0 inset-x-0 z-30 h-13 px-4 flex items-center justify-between bg-slate-950/95 border-b border-slate-800/90 backdrop-blur-md select-none">
        {/* Left Zone: Brand Logo & Home */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 font-sans font-black tracking-wider text-base whitespace-nowrap shrink-0">
            <span className="text-amber-500">HORIZON</span>
            <span className="text-white">FEST 2</span>
          </div>

          <button
            onClick={() => {
              sound.playClick();
              onSetMode('DRAW');
            }}
            className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-md border border-slate-700/80 bg-slate-900/80 hover:bg-slate-800 text-slate-300 transition-colors"
            title="Return to Main Board"
          >
            <Home className="w-3.5 h-3.5 text-amber-400" />
            <span>Home</span>
          </button>

          <span className="text-[11px] font-mono text-slate-500">v4.0</span>
        </div>

        {/* Center Zone: Mode & Tool Controls */}
        <div className="flex items-center gap-1.5 sm:gap-2">
          {/* PLAN button */}
          <button
            onClick={() => {
              sound.playClick();
              onSetMode('DRAW');
            }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold font-mono transition-all uppercase tracking-wider ${
              mode === 'DRAW'
                ? 'bg-amber-400 text-slate-950 shadow-md scale-102 font-black'
                : 'text-slate-400 hover:text-white hover:bg-slate-900'
            }`}
          >
            <Compass className="w-3.5 h-3.5" />
            PLAN
          </button>

          {/* 3D button */}
          <button
            onClick={() => {
              sound.playClick();
              onSetMode('RACE');
            }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold font-mono transition-all uppercase tracking-wider ${
              mode === 'RACE'
                ? 'bg-amber-400 text-slate-950 shadow-md scale-102 font-black'
                : 'text-slate-400 hover:text-white hover:bg-slate-900'
            }`}
          >
            <Box className="w-3.5 h-3.5" />
            3D
          </button>

          {/* Divider */}
          <div className="h-4 w-px bg-slate-800 mx-1" />

          {/* UNDO */}
          <button
            onClick={handleUndo}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs font-mono font-semibold text-slate-400 hover:text-white hover:bg-slate-900 transition-colors"
            title="Undo last stroke"
          >
            <Undo2 className="w-3.5 h-3.5" />
            <span className="hidden md:inline">UNDO</span>
          </button>

          {/* CLEAR */}
          <button
            onClick={handleClear}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs font-mono font-semibold text-slate-400 hover:text-rose-400 hover:bg-slate-900 transition-colors"
            title="Clear current track"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span className="hidden md:inline">CLEAR</span>
          </button>

          {/* REVERSE */}
          <button
            onClick={handleReverse}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs font-mono font-semibold text-slate-400 hover:text-amber-400 hover:bg-slate-900 transition-colors"
            title="Reverse track driving direction"
          >
            <ArrowLeftRight className="w-3.5 h-3.5" />
            <span className="hidden md:inline">REVERSE</span>
          </button>

          {/* HILLS & JUMPS (Highlighted Yellow Pill Button) */}
          <button
            onClick={() => {
              sound.playClick();
              onToggleHills();
            }}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-md text-xs font-black font-mono transition-all uppercase tracking-wide ${
              isHillsOpen
                ? 'bg-amber-500 text-slate-950 shadow-md ring-2 ring-amber-300'
                : 'bg-amber-400 text-slate-950 hover:bg-amber-300 shadow-sm'
            }`}
            title="Adjust Elevation & Hills Profile"
          >
            <Mountain className="w-3.5 h-3.5" />
            HILLS & JUMPS
          </button>

          {/* SHARE */}
          <button
            onClick={handleShare}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs font-mono font-semibold text-slate-400 hover:text-white hover:bg-slate-900 transition-colors"
            title="Share track"
          >
            {shareCopied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            <span className="hidden lg:inline">{shareCopied ? 'COPIED!' : 'SHARE'}</span>
          </button>
        </div>

        {/* Right Zone: Environment Switcher, Tracks Dropdown & Audio */}
        <div className="flex items-center gap-2">
          {/* Forza Horizon 6 Environment Switcher Dropdown */}
          <div className="relative">
            <button
              onClick={() => {
                sound.playClick();
                setShowEnvDropdown(!showEnvDropdown);
                setShowTracksDropdown(false);
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold font-mono bg-gradient-to-r from-slate-900 to-slate-800 border border-slate-700/80 hover:border-amber-400/70 text-slate-200 hover:text-white transition-all shadow-sm"
              title="Change Forza Horizon 6 Environment"
            >
              <div
                className={`w-2.5 h-2.5 rounded-full bg-gradient-to-tr ${currentEnvConfig.badgeGradient} shadow-sm ring-1 ring-white/40 shrink-0`}
              />
              <span className="hidden xl:inline text-slate-400 font-medium">ENV:</span>
              <span className="text-amber-400 font-black truncate max-w-[120px] md:max-w-none">
                {currentEnvConfig.name}
              </span>
              <ChevronDown
                className={`w-3.5 h-3.5 text-slate-400 transition-transform ${
                  showEnvDropdown ? 'rotate-180' : ''
                }`}
              />
            </button>

            {showEnvDropdown && (
              <div className="absolute right-0 mt-2 w-80 sm:w-92 rounded-2xl bg-slate-950/95 border border-slate-700/90 shadow-[0_20px_60px_rgba(0,0,0,0.9)] backdrop-blur-2xl p-2.5 z-50 animate-in fade-in zoom-in-95 duration-150">
                <div className="px-3 py-2 flex items-center justify-between border-b border-slate-800/80 mb-2">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-3.5 h-3.5 text-amber-400 animate-pulse" />
                    <span className="text-[11px] font-mono font-black text-amber-400 uppercase tracking-wider">
                      FORZA HORIZON 6 BIOMES
                    </span>
                  </div>
                  <span className="text-[10px] font-mono text-slate-400 bg-slate-900 px-2 py-0.5 rounded-full border border-slate-800">
                    3 Biomes
                  </span>
                </div>

                <div className="max-h-[380px] overflow-y-auto space-y-1.5 pr-1 custom-scrollbar">
                  {ENVIRONMENT_LIST.map((env) => {
                    const isActive = env.id === environment;
                    return (
                      <button
                        key={env.id}
                        onClick={() => {
                          sound.playBiomeSwitch();
                          onEnvironmentChange?.(env.id);
                          setShowEnvDropdown(false);
                        }}
                        className={`w-full text-left p-2.5 rounded-xl transition-all flex items-center gap-3 border ${
                          isActive
                            ? 'bg-amber-400/15 border-amber-400/60 shadow-lg ring-1 ring-amber-400/40 text-white'
                            : 'bg-slate-900/60 border-slate-800/70 hover:bg-slate-850 hover:border-slate-700 text-slate-300'
                        }`}
                      >
                        {/* Vibrant Biome Color Indicator */}
                        <div
                          className={`w-10 h-10 rounded-xl bg-gradient-to-tr ${env.badgeGradient} flex items-center justify-center shadow-md ring-1 ring-white/20 shrink-0`}
                        >
                          <div className="w-3 h-3 rounded-full bg-white/90 shadow-sm" />
                        </div>

                        {/* Text Info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <div
                              className={`text-xs font-bold font-sans truncate ${
                                isActive ? 'text-amber-400' : 'text-slate-200'
                              }`}
                            >
                              {env.name}
                            </div>
                            {isActive && (
                              <span className="flex items-center gap-1 text-[10px] font-mono font-bold text-amber-400 bg-amber-400/20 px-1.5 py-0.5 rounded-md shrink-0">
                                <Check className="w-3 h-3" />
                                ACTIVE
                              </span>
                            )}
                          </div>
                          <div className="text-[10px] font-mono text-slate-400 truncate mt-0.5">
                            {env.subtitle}
                          </div>
                          <div className="text-[9px] text-slate-500 truncate">
                            {env.tagline}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Audio Mute */}
          <button
            onClick={onToggleMute}
            className="p-1.5 rounded-md bg-slate-900 border border-slate-800 text-slate-400 hover:text-white transition-colors"
            title={isMuted ? 'Unmute Sound' : 'Mute Sound'}
          >
            {isMuted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
          </button>

          {/* Tracks Dropdown Button */}
          <div className="relative">
            <button
              onClick={() => {
                setShowTracksDropdown(!showTracksDropdown);
                setShowEnvDropdown(false);
              }}
              className="px-3 py-1.5 text-xs font-bold rounded-md bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-200 transition-colors flex items-center gap-1.5"
            >
              <span>Tracks</span>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
            </button>

            {showTracksDropdown && (
              <div className="absolute right-0 mt-1 w-48 rounded-xl bg-slate-900 border border-slate-800 shadow-2xl p-1 z-50">
                <div className="px-2.5 py-1 text-[10px] font-mono font-bold text-slate-500 uppercase">
                  Preset Circuits
                </div>
                {PRESET_TRACKS.map((preset) => (
                  <button
                    key={preset.id}
                    onClick={() => handleLoadPreset(preset.id)}
                    className="w-full text-left px-2.5 py-1.5 text-xs rounded-lg hover:bg-slate-800 text-slate-200 hover:text-amber-400 transition-colors flex items-center justify-between"
                  >
                    <span>{preset.name}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </header>

      {/* ========================================================================= */}
      {/* MODE 1: 2D "PLAN" MODE (LEFT SIDEBAR & BOARD CONTROLS) */}
      {/* ========================================================================= */}
      {mode === 'DRAW' && (
        <>
          {/* Toggle Sidebar Collapse / Full Drawing Canvas Button */}
          <button
            onClick={() => {
              sound.playClick();
              setIsSidebarCollapsed((prev) => !prev);
            }}
            className={`absolute top-15 z-25 flex items-center gap-1.5 px-3 py-1.5 rounded-r-xl bg-slate-900/95 hover:bg-slate-800 text-slate-300 hover:text-amber-400 border border-l-0 border-slate-700/80 shadow-2xl transition-all duration-300 font-mono text-xs font-bold cursor-pointer ${
              isSidebarCollapsed ? 'left-0' : 'left-72 md:left-80'
            }`}
            title={isSidebarCollapsed ? "Show Controls Panel" : "Collapse Panel for Full-Width Canvas"}
          >
            {isSidebarCollapsed ? (
              <>
                <ChevronRight className="w-4 h-4 text-amber-400 animate-pulse" />
                <span className="hidden sm:inline">Show Tools</span>
              </>
            ) : (
              <>
                <ChevronLeft className="w-4 h-4 text-slate-400" />
                <span className="hidden sm:inline">Full Canvas</span>
              </>
            )}
          </button>

          {/* LEFT SIDEBAR MANAGEMENT PANEL */}
          <aside
            className={`absolute top-13 bottom-14 left-0 w-72 md:w-80 z-20 p-4 bg-slate-950/95 border-r border-slate-800/90 backdrop-blur-md overflow-y-auto select-none space-y-4 shadow-2xl transition-transform duration-300 ease-in-out ${
              isSidebarCollapsed ? '-translate-x-full pointer-events-none' : 'translate-x-0'
            }`}
          >
            {/* Top Tagline */}
            <p className="text-xs text-slate-400 leading-relaxed">
              Drag a closed loop on the board. The way you draw it is the way you race it.
            </p>

            {/* CIRCUIT BUILD: Freehand vs Dots */}
            <div>
              <span className="text-[10px] font-mono font-bold text-slate-500 uppercase tracking-wider block mb-2">
                CIRCUIT BUILD
              </span>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => onDrawMethodChange('freehand')}
                  className={`py-1.5 px-3 rounded-lg text-xs font-bold transition-all text-center ${
                    drawMethod === 'freehand'
                      ? 'border border-amber-500/80 bg-amber-500/10 text-amber-400 shadow-sm'
                      : 'border border-slate-800 bg-slate-900 text-slate-400 hover:text-white'
                  }`}
                >
                  Freehand
                </button>
                <button
                  onClick={() => onDrawMethodChange('dots')}
                  className={`py-1.5 px-3 rounded-lg text-xs font-bold transition-all text-center ${
                    drawMethod === 'dots'
                      ? 'border border-amber-500/80 bg-amber-500/10 text-amber-400 shadow-sm'
                      : 'border border-slate-800 bg-slate-900 text-slate-400 hover:text-white'
                  }`}
                >
                  Dots
                </button>
              </div>
            </div>

            {/* OR GENERATE ONE: 6 Presets (Grand Prix, Flowing, Technical, Street, Oval, Kart) */}
            <div>
              <span className="text-xs text-slate-400 font-medium block mb-2">
                Or generate one
              </span>
              <div className="grid grid-cols-3 gap-1.5">
                {PRESET_TRACKS.map((preset) => (
                  <button
                    key={preset.id}
                    onClick={() => handleLoadPreset(preset.id)}
                    className="py-1.5 px-1.5 rounded-lg border border-slate-800 bg-slate-900/90 hover:bg-slate-800 hover:border-slate-700 text-slate-300 hover:text-white text-xs font-medium text-center truncate transition-colors"
                  >
                    {preset.name}
                  </button>
                ))}
              </div>
            </div>

            {/* TRACE AN IMAGE */}
            <div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleTraceImageUpload}
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                className="w-full py-2 px-3 rounded-lg border border-slate-800 bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white text-xs font-semibold text-center transition-colors flex items-center justify-center gap-1.5"
              >
                <Image className="w-3.5 h-3.5 text-slate-400" />
                Trace an image
              </button>
              <p className="text-[10px] text-slate-500 mt-1.5 leading-snug">
                Your picture stays on this device. It isn&apos;t uploaded, saved or shared.
              </p>
            </div>

            {/* SLIDERS SECTION */}
            <div className="space-y-3.5 pt-1 border-t border-slate-850">
              {/* Circuit Dimensions (Length & Breadth) */}
              <div className="space-y-2.5">
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-1.5">
                    <span className="text-slate-200 font-semibold">Circuit Dimensions</span>
                    <span className="text-[10px] px-1.5 py-0.2 rounded bg-amber-400/10 text-amber-300 font-mono font-bold border border-amber-400/20">
                      {telemetry.lengthFormatted}
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    {/* Link / Unlink toggle */}
                    <button
                      onClick={() => {
                        sound.playClick();
                        onToggleLinkDimensions?.();
                      }}
                      className={`px-1.5 py-0.5 rounded text-[10px] font-mono flex items-center gap-1 border transition-colors cursor-pointer ${
                        linkDimensions
                          ? 'bg-amber-400/15 border-amber-400/40 text-amber-300 hover:bg-amber-400/25'
                          : 'bg-slate-900 border-slate-700 text-slate-400 hover:text-white hover:bg-slate-800'
                      }`}
                      title={linkDimensions ? 'Aspect ratio linked (uniform scale)' : 'Aspect ratio unlinked (stretch length and breadth independently)'}
                    >
                      {linkDimensions ? <Link2 className="w-3 h-3 text-amber-400" /> : <Unlink className="w-3 h-3 text-slate-400" />}
                      <span>{linkDimensions ? 'Linked' : 'Free'}</span>
                    </button>

                    {/* Fit to board button */}
                    <button
                      onClick={handleFitCircuitToBoard}
                      className="px-1.5 py-0.5 rounded text-[10px] font-mono flex items-center gap-1 bg-slate-900 border border-slate-700 text-slate-300 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
                      title="Normalize and Fit Circuit to Drafting Board"
                    >
                      <Maximize2 className="w-3 h-3 text-sky-400" />
                      <span>Fit Board</span>
                    </button>
                  </div>
                </div>

                {/* 1. Track Length (Horizontal / X Dimension) */}
                <div className="p-2 rounded-lg bg-slate-900/60 border border-slate-800/80">
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="text-slate-300 font-medium flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                      Length (Horizontal)
                    </span>
                    <span className="font-mono text-xs text-amber-400 font-bold">
                      {trackLengthScale.toFixed(2)}×
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => {
                        sound.playClick();
                        onTrackLengthScaleChange(Math.max(0.4, Number((trackLengthScale - 0.2).toFixed(2))));
                      }}
                      className="w-6 h-6 flex items-center justify-center rounded bg-slate-900 border border-slate-800 text-slate-300 hover:text-white hover:bg-slate-800 text-xs font-bold transition-colors cursor-pointer shrink-0"
                      title="Shorten Length (-0.2×)"
                    >
                      -
                    </button>
                    <input
                      type="range"
                      min="0.4"
                      max="4.0"
                      step="0.05"
                      value={trackLengthScale}
                      onChange={(e) => onTrackLengthScaleChange(parseFloat(e.target.value))}
                      className="w-full accent-amber-400 cursor-pointer h-1.5 bg-slate-800 rounded-lg"
                    />
                    <button
                      onClick={() => {
                        sound.playClick();
                        onTrackLengthScaleChange(Math.min(4.0, Number((trackLengthScale + 0.2).toFixed(2))));
                      }}
                      className="w-6 h-6 flex items-center justify-center rounded bg-slate-900 border border-slate-800 text-slate-300 hover:text-white hover:bg-slate-800 text-xs font-bold transition-colors cursor-pointer shrink-0"
                      title="Lengthen (+0.2×)"
                    >
                      +
                    </button>
                  </div>

                  <div className="grid grid-cols-5 gap-1 mt-1.5">
                    {[
                      { label: '0.75×', val: 0.75 },
                      { label: '1.0×', val: 1.0 },
                      { label: '1.5×', val: 1.5 },
                      { label: '2.0×', val: 2.0 },
                      { label: '3.0×', val: 3.0 },
                    ].map((btn) => (
                      <button
                        key={btn.val}
                        onClick={() => {
                          sound.playClick();
                          onTrackLengthScaleChange(btn.val);
                        }}
                        className={`py-0.5 text-[9.5px] font-mono font-bold rounded border transition-all cursor-pointer ${
                          Math.abs(trackLengthScale - btn.val) < 0.05
                            ? 'bg-amber-400 text-slate-950 border-amber-300 shadow-xs'
                            : 'bg-slate-900/90 text-slate-400 hover:text-white hover:bg-slate-800 border-slate-800'
                        }`}
                      >
                        {btn.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* 2. Track Breadth (Vertical / Y Dimension) */}
                <div className="p-2 rounded-lg bg-slate-900/60 border border-slate-800/80">
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="text-slate-300 font-medium flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
                      Breadth (Vertical)
                    </span>
                    <span className="font-mono text-xs text-cyan-400 font-bold">
                      {(trackBreadthScale ?? 1.0).toFixed(2)}×
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => {
                        sound.playClick();
                        onTrackBreadthScaleChange?.(Math.max(0.4, Number(((trackBreadthScale ?? 1.0) - 0.2).toFixed(2))));
                      }}
                      className="w-6 h-6 flex items-center justify-center rounded bg-slate-900 border border-slate-800 text-slate-300 hover:text-white hover:bg-slate-800 text-xs font-bold transition-colors cursor-pointer shrink-0"
                      title="Narrow Breadth (-0.2×)"
                    >
                      -
                    </button>
                    <input
                      type="range"
                      min="0.4"
                      max="4.0"
                      step="0.05"
                      value={trackBreadthScale ?? 1.0}
                      onChange={(e) => onTrackBreadthScaleChange?.(parseFloat(e.target.value))}
                      className="w-full accent-cyan-400 cursor-pointer h-1.5 bg-slate-800 rounded-lg"
                    />
                    <button
                      onClick={() => {
                        sound.playClick();
                        onTrackBreadthScaleChange?.(Math.min(4.0, Number(((trackBreadthScale ?? 1.0) + 0.2).toFixed(2))));
                      }}
                      className="w-6 h-6 flex items-center justify-center rounded bg-slate-900 border border-slate-800 text-slate-300 hover:text-white hover:bg-slate-800 text-xs font-bold transition-colors cursor-pointer shrink-0"
                      title="Widen Breadth (+0.2×)"
                    >
                      +
                    </button>
                  </div>

                  <div className="grid grid-cols-5 gap-1 mt-1.5">
                    {[
                      { label: '0.75×', val: 0.75 },
                      { label: '1.0×', val: 1.0 },
                      { label: '1.5×', val: 1.5 },
                      { label: '2.0×', val: 2.0 },
                      { label: '3.0×', val: 3.0 },
                    ].map((btn) => (
                      <button
                        key={btn.val}
                        onClick={() => {
                          sound.playClick();
                          onTrackBreadthScaleChange?.(btn.val);
                        }}
                        className={`py-0.5 text-[9.5px] font-mono font-bold rounded border transition-all cursor-pointer ${
                          Math.abs((trackBreadthScale ?? 1.0) - btn.val) < 0.05
                            ? 'bg-cyan-400 text-slate-950 border-cyan-300 shadow-xs'
                            : 'bg-slate-900/90 text-slate-400 hover:text-white hover:bg-slate-800 border-slate-800'
                        }`}
                      >
                        {btn.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Track width */}
              <div>
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="text-slate-300 font-medium">Track width</span>
                  <div className="flex items-center gap-1.5 font-mono text-xs">
                    <span className="text-amber-400 font-bold">
                      {(brushWidth * 0.22).toFixed(1)} m
                    </span>
                  </div>
                </div>

                {/* Slider with fine-tune - / + buttons */}
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      sound.playClick();
                      onBrushWidthChange(Math.max(20, brushWidth - 5));
                    }}
                    className="w-6 h-6 flex items-center justify-center rounded bg-slate-900 border border-slate-800 text-slate-300 hover:text-white hover:bg-slate-800 text-xs font-bold transition-colors cursor-pointer shrink-0"
                    title="Narrower (-1m)"
                  >
                    -
                  </button>
                  <input
                    type="range"
                    min="20"
                    max="140"
                    step="2"
                    value={brushWidth}
                    onChange={(e) => onBrushWidthChange(Number(e.target.value))}
                    className="w-full accent-amber-400 cursor-pointer h-1.5 bg-slate-800 rounded-lg"
                  />
                  <button
                    onClick={() => {
                      sound.playClick();
                      onBrushWidthChange(Math.min(140, brushWidth + 5));
                    }}
                    className="w-6 h-6 flex items-center justify-center rounded bg-slate-900 border border-slate-800 text-slate-300 hover:text-white hover:bg-slate-800 text-xs font-bold transition-colors cursor-pointer shrink-0"
                    title="A Little Wider (+1m)"
                  >
                    +
                  </button>
                </div>

                {/* Quick Width Presets */}
                <div className="grid grid-cols-4 gap-1 mt-1.5">
                  {[
                    { label: 'Standard', width: 48, meters: '10.5m' },
                    { label: 'Little Wide', width: 68, meters: '15.0m' },
                    { label: 'Wide', width: 92, meters: '20.2m' },
                    { label: 'Super Wide', width: 125, meters: '27.5m' },
                  ].map((preset) => (
                    <button
                      key={preset.width}
                      onClick={() => {
                        sound.playClick();
                        onBrushWidthChange(preset.width);
                      }}
                      className={`py-1 px-0.5 text-[9.5px] font-sans font-bold rounded border transition-all text-center truncate cursor-pointer ${
                        Math.abs(brushWidth - preset.width) <= 4
                          ? 'bg-amber-400 text-slate-950 border-amber-300 shadow-xs'
                          : 'bg-slate-900/90 text-slate-400 hover:text-white hover:bg-slate-800 border-slate-800'
                      }`}
                      title={`${preset.label} (${preset.meters})`}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Barrier distance */}
              <div>
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="text-slate-300 font-medium">Barrier distance</span>
                  <span className="font-mono text-amber-400 font-bold">
                    {barrierDistance.toFixed(1)} m
                  </span>
                </div>
                <input
                  type="range"
                  min="3.0"
                  max="20.0"
                  step="0.5"
                  value={barrierDistance}
                  onChange={(e) => onBarrierDistanceChange(parseFloat(e.target.value))}
                  className="w-full accent-amber-400 cursor-pointer h-1.5 bg-slate-800 rounded-lg"
                />
              </div>

              {/* Corner smoothing */}
              <div>
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="text-slate-300 font-medium">Corner smoothing</span>
                  <span className="font-mono text-amber-400 font-bold">
                    {smoothingMode}
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-1">
                  {['Raw', 'Normal', 'Smooth'].map((sm) => (
                    <button
                      key={sm}
                      onClick={() => onSmoothingModeChange(sm)}
                      className={`py-1 text-[11px] rounded font-mono font-medium border ${
                        smoothingMode === sm
                          ? 'bg-amber-500/20 border-amber-500 text-amber-300 font-bold'
                          : 'border-slate-800 bg-slate-900 text-slate-400 hover:text-white'
                      }`}
                    >
                      {sm}
                    </button>
                  ))}
                </div>
              </div>

              {/* MORE SETTINGS TOGGLE */}
              <div>
                <button
                  onClick={() => setShowMoreSettings(!showMoreSettings)}
                  className="w-full py-1.5 px-3 rounded-lg border border-slate-800 bg-slate-900/80 hover:bg-slate-800 text-slate-400 hover:text-white text-xs font-mono font-semibold flex items-center justify-center gap-1 transition-colors"
                >
                  MORE SETTINGS
                  {showMoreSettings ? (
                    <ChevronUp className="w-3.5 h-3.5" />
                  ) : (
                    <ChevronDown className="w-3.5 h-3.5" />
                  )}
                </button>

                {showMoreSettings && (
                  <div className="p-3 mt-1.5 rounded-xl bg-slate-900 border border-slate-800 space-y-3 text-xs">
                    <div>
                      <div className="text-[10px] font-mono font-bold text-slate-400 uppercase mb-1.5">
                        Vehicle & Physics Profile
                      </div>
                      <div className="grid grid-cols-2 gap-1.5">
                        {CAR_CONFIGS.map((cfg) => {
                          const isSelected = cfg.id === carConfig.id;
                          return (
                            <button
                              key={cfg.id}
                              onClick={() => {
                                sound.playClick();
                                onCarConfigChange(cfg);
                              }}
                              className={`p-2 rounded-lg text-left border transition-all ${
                                isSelected
                                  ? 'bg-amber-400/20 border-amber-400 text-amber-300 font-bold ring-1 ring-amber-400/30'
                                  : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:text-white hover:bg-slate-850'
                              }`}
                            >
                              <div className="flex items-center justify-between text-xs">
                                <span>{cfg.name}</span>
                                <div
                                  className="w-2.5 h-2.5 rounded-full"
                                  style={{ backgroundColor: cfg.color }}
                                />
                              </div>
                              <div className="text-[9px] text-slate-500 font-mono mt-0.5 truncate">
                                {cfg.category}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div className="pt-1 border-t border-slate-800/80 space-y-1 text-[11px]">
                      <div className="flex justify-between items-center text-slate-400">
                        <span>Speed-Sensitive Steering:</span>
                        <span className="text-emerald-400 font-mono font-bold">Active</span>
                      </div>
                      <div className="flex justify-between items-center text-slate-400">
                        <span>Forza Drift Assist:</span>
                        <span className="text-amber-400 font-mono font-bold">Active</span>
                      </div>
                      <div className="flex justify-between items-center text-slate-400">
                        <span>ABS & Trail-Braking:</span>
                        <span className="text-cyan-400 font-mono font-bold">Active</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* BIG PRIMARY "NEXT" BUTTON */}
            <div className="pt-2">
              <button
                onClick={handleStartRace}
                className="w-full py-3 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-sm uppercase tracking-wider transition-all shadow-lg active:scale-98 flex items-center justify-center gap-2"
              >
                NEXT
              </button>
              <p className="text-center text-[10px] text-slate-500 mt-2">
                No account. Nothing to install.
              </p>
            </div>
          </aside>

          {/* BOTTOM-LEFT CANVAS ZOOM / PAN CONTROLS WIDGET */}
          <div
            className={`absolute bottom-18 ${
              isSidebarCollapsed ? 'left-4' : 'left-76 md:left-86'
            } z-20 flex items-center bg-slate-950/95 border border-slate-800 rounded-lg p-0.5 shadow-2xl font-mono text-xs text-slate-300 select-none transition-all duration-300`}
          >
            <button
              onClick={() => {
                sound.playClick();
                const next = Math.max(35, zoomPercent - 15);
                setZoomPercent(next);
                window.dispatchEvent(
                  new CustomEvent('APEX_SET_CANVAS_ZOOM', { detail: { zoom: next / 100 } })
                );
              }}
              className="px-2.5 py-1 hover:text-white hover:bg-slate-800 rounded transition-colors font-bold text-sm cursor-pointer"
              title="Zoom Out (Enlarge Drawing Area)"
            >
              -
            </button>
            <span className="px-2 py-1 text-[11px] font-bold text-amber-400 min-w-[42px] text-center">
              {zoomPercent}%
            </span>
            <button
              onClick={() => {
                sound.playClick();
                const next = Math.min(250, zoomPercent + 15);
                setZoomPercent(next);
                window.dispatchEvent(
                  new CustomEvent('APEX_SET_CANVAS_ZOOM', { detail: { zoom: next / 100 } })
                );
              }}
              className="px-2.5 py-1 hover:text-white hover:bg-slate-800 rounded transition-colors font-bold text-sm cursor-pointer"
              title="Zoom In"
            >
              +
            </button>
            <div className="h-4 w-px bg-slate-800 mx-1" />
            <button
              onClick={() => {
                sound.playClick();
                const next = !isPanToolActive;
                setIsPanToolActive(next);
                window.dispatchEvent(
                  new CustomEvent('APEX_SET_PAN_MODE', { detail: { active: next } })
                );
              }}
              className={`p-1.5 rounded transition-colors cursor-pointer ${
                isPanToolActive
                  ? 'bg-amber-400 text-slate-950 font-bold'
                  : 'hover:text-white hover:bg-slate-800'
              }`}
              title={
                isPanToolActive
                  ? 'Pan Mode Active (Click to switch back to Draw)'
                  : 'Pan Mode (Drag canvas to move around)'
              }
            >
              <Move className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => {
                sound.playClick();
                window.dispatchEvent(new CustomEvent('APEX_FIT_TRACK_VIEW'));
              }}
              className="px-2 py-1 hover:text-white hover:bg-slate-800 rounded transition-colors flex items-center gap-1 text-[11px] cursor-pointer"
              title="Fit Entire Track into Screen"
            >
              <Maximize2 className="w-3.5 h-3.5 text-slate-400" />
              <span>Fit</span>
            </button>
            <button
              onClick={() => {
                sound.playClick();
                setZoomPercent(100);
                window.dispatchEvent(new CustomEvent('APEX_RESET_CANVAS_VIEW'));
              }}
              className="px-2 py-1 hover:text-white hover:bg-slate-800 rounded transition-colors flex items-center gap-1 text-[11px] cursor-pointer"
              title="Reset Zoom & Pan to 100%"
            >
              <RotateCcw className="w-3.5 h-3.5 text-slate-400" />
              <span>Reset</span>
            </button>
          </div>
        </>
      )}

      {/* ========================================================================= */}
      {/* MODE 2: 3D "RACE" MODE (3D DRIVING OVERLAY) */}
      {/* ========================================================================= */}
      {mode === 'RACE' && (
        <>
          {/* Top Return to Board Button & Camera Switcher */}
          <div className="absolute top-16 left-4 z-20 flex items-center gap-2">
            <button
              onClick={() => {
                sound.playClick();
                onSetMode('DRAW');
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-xs font-mono shadow-xl transition-all"
            >
              <Compass className="w-3.5 h-3.5" />
              ← Edit Circuit (PLAN)
            </button>

            <button
              onClick={onToggleCamera}
              className="px-3 py-1.5 rounded-lg bg-slate-900/90 border border-slate-800 text-amber-400 hover:text-white font-mono text-xs font-bold shadow-xl transition-colors"
            >
              CAM: {cameraMode.toUpperCase()}
            </button>

            <button
              onClick={() => {
                sound.playClick();
                window.dispatchEvent(new CustomEvent('APEX_RESET_CAR'));
              }}
              className="px-3 py-1.5 rounded-lg bg-slate-900/90 border border-slate-800 text-slate-300 hover:text-white font-mono text-xs font-bold shadow-xl transition-colors"
            >
              RESET CAR
            </button>

            {/* Quick Vehicle Switcher in 3D Mode */}
            <button
              onClick={() => {
                sound.playClick();
                const curIdx = CAR_CONFIGS.findIndex((c) => c.id === carConfig.id);
                const nextCar = CAR_CONFIGS[(curIdx + 1) % CAR_CONFIGS.length];
                onCarConfigChange(nextCar);
              }}
              className="px-3 py-1.5 rounded-lg bg-slate-900/90 border border-slate-800 text-slate-200 hover:text-white font-mono text-xs font-bold shadow-xl transition-all flex items-center gap-1.5"
              title="Switch Car & Handling Model"
            >
              <div
                className="w-2.5 h-2.5 rounded-full"
                style={{ backgroundColor: carConfig.color }}
              />
              <span>CAR: {carConfig.name} ↻</span>
            </button>

            {/* Quick Environment Cycler in 3D Mode */}
            <button
              id="quick-cycle-env-btn"
              onClick={() => {
                sound.playBiomeSwitch();
                const ids = ENVIRONMENT_LIST.map((e) => e.id);
                const curIdx = ids.indexOf(environment);
                const nextId = ids[(curIdx + 1) % ids.length];
                onEnvironmentChange?.(nextId);
              }}
              className="px-3 py-1.5 rounded-lg bg-gradient-to-r from-slate-900 to-slate-800 border border-slate-700/80 text-amber-400 hover:text-white font-mono text-xs font-bold shadow-xl transition-all flex items-center gap-1.5"
              title="Cycle to next Forza Horizon 6 Environment"
            >
              <div
                className={`w-2 h-2 rounded-full bg-gradient-to-tr ${currentEnvConfig.badgeGradient}`}
              />
              <span>ENV: {currentEnvConfig.name.split(' ')[0]} ↻</span>
            </button>
          </div>

          {/* Forza Horizon Drift / Skill Chain Banner (Top Center) */}
          {(isDrifting || driftScore > 0) && (
            <div className="absolute top-16 left-1/2 -translate-x-1/2 z-20 pointer-events-none flex flex-col items-center animate-pulse">
              <div className="px-5 py-2.5 rounded-2xl bg-slate-950/90 border border-amber-500/70 shadow-[0_0_35px_rgba(245,158,11,0.4)] backdrop-blur-md flex items-center gap-3">
                <span className="text-amber-400 font-black tracking-wider text-xs md:text-sm flex items-center gap-1.5 font-sans">
                  {driftScore < 500 ? 'DRIFT 🌟' : driftScore < 1500 ? 'GREAT DRIFT 🔥' : driftScore < 3000 ? 'AWESOME DRIFT ⚡' : 'DRIFT KING 👑'}
                </span>
                <span className="text-white font-mono font-black text-base md:text-lg">
                  +{driftScore.toLocaleString()} PTS
                </span>
                <span className="px-2 py-0.5 rounded-lg bg-gradient-to-r from-amber-500 to-rose-500 text-slate-950 font-black text-xs font-mono shadow-md">
                  x{driftMultiplier.toFixed(1)}
                </span>
              </div>
            </div>
          )}

          {/* Top-Right Circuit Timing & Lap Box */}
          <div className="absolute top-16 right-4 z-20 flex flex-col items-end gap-2 pointer-events-none font-mono">
            <div className="px-4 py-2.5 rounded-xl bg-slate-950/90 border border-slate-800/90 backdrop-blur-md shadow-2xl text-right text-xs space-y-1">
              <div className="text-slate-400 flex items-center justify-end gap-2">
                <span className="text-[10px] uppercase font-bold text-slate-500 font-sans tracking-wider">CIRCUIT</span>
                <span className="text-white font-bold">LAP {lapStats.currentLap} / {lapStats.totalLaps}</span>
              </div>
              <div className="text-xl font-black text-emerald-400 tracking-tight">
                {lapStats.currentLapTime.toFixed(2)}s
              </div>
              {lapStats.bestLapTime && (
                <div className="text-[11px] text-purple-400 font-bold flex items-center justify-end gap-1.5">
                  <span className="text-[9px] text-slate-400 uppercase font-sans">BEST</span>
                  <span>{lapStats.bestLapTime.toFixed(2)}s</span>
                </div>
              )}
            </div>
          </div>

          {/* High-Speed Racing Edge Vignette (>220 KM/H up to 400 KM/H) - Clean, no white rays behind car */}
          {speed > 220 && (
            <div
              className="absolute inset-0 pointer-events-none z-10 transition-opacity duration-300 overflow-hidden"
              style={{
                opacity: Math.min(0.65, ((speed - 220) / 180) * 0.65),
              }}
            >
              {/* Clean Dark Vignette at outer screen edges */}
              <div
                className="absolute inset-0"
                style={{
                  background:
                    'radial-gradient(circle at 50% 55%, transparent 60%, rgba(2, 6, 23, 0.45) 85%, rgba(2, 6, 23, 0.75) 100%)',
                }}
              />
            </div>
          )}

          {/* ========================================================================= */}
          {/* MINIMAL RACING SPEEDOMETER (Exact Match to 2nd Image: 0 KMPH)             */}
          {/* ========================================================================= */}
          <div className="absolute bottom-6 right-8 z-20 pointer-events-none select-none flex items-baseline font-mono drop-shadow-[0_2px_8px_rgba(0,0,0,0.95)]">
            <span className="text-4xl sm:text-5xl md:text-6xl font-black text-white tracking-tight drop-shadow-[0_2px_4px_rgba(0,0,0,0.9)]">
              {Math.round(speed)}
            </span>
            <span className="text-2xl sm:text-3xl md:text-4xl font-black text-[#38bdf8] tracking-wider ml-2 drop-shadow-[0_2px_4px_rgba(0,0,0,0.9)]">
              KMPH
            </span>
          </div>
        </>
      )}

      {/* ========================================================================= */}
      {/* PINNED BOTTOM TELEMETRY HUD BAR (Shown only in DRAW / Drafting mode) */}
      {/* ========================================================================= */}
      {mode === 'DRAW' && (
        <footer className="absolute bottom-0 inset-x-0 z-30 h-14 px-4 md:px-6 flex items-center justify-between bg-[#0a0f18]/98 border-t border-slate-800/90 backdrop-blur-md select-none font-mono text-xs overflow-x-auto shadow-2xl">
          {/* Left Telemetry Columns */}
          <div className="flex items-center gap-4 md:gap-7 divide-x divide-slate-800/80 shrink-0">
            {/* LENGTH */}
            <div>
              <div className="text-[10px] text-slate-500 font-sans font-bold uppercase tracking-wider">
                LENGTH
              </div>
              <div className="text-sm font-black text-white">
                {telemetry.lengthFormatted}
              </div>
            </div>

            {/* CORNERS */}
            <div className="pl-4 md:pl-7">
              <div className="text-[10px] text-slate-500 font-sans font-bold uppercase tracking-wider">
                CORNERS
              </div>
              <div className="text-sm font-black text-white">
                {telemetry.cornersCount}
              </div>
            </div>

            {/* LONGEST STRAIGHT */}
            <div className="pl-4 md:pl-7">
              <div className="text-[10px] text-slate-500 font-sans font-bold uppercase tracking-wider">
                LONGEST STRAIGHT
              </div>
              <div className="text-sm font-black text-white">
                {telemetry.longestStraightFormatted}
              </div>
            </div>

            {/* MAX GRADIENT */}
            <div className="pl-4 md:pl-7">
              <div className="text-[10px] text-slate-500 font-sans font-bold uppercase tracking-wider">
                MAX GRADIENT
              </div>
              <div className="text-sm font-black text-white">
                {telemetry.maxGradientPercent}%
              </div>
            </div>

            {/* ELEVATION CHANGE */}
            <div className="pl-4 md:pl-7">
              <div className="text-[10px] text-slate-500 font-sans font-bold uppercase tracking-wider">
                ELEVATION CHANGE
              </div>
              <div className="text-sm font-black text-white">
                {Math.round(telemetry.elevationChangeMeters)} m
              </div>
            </div>

            {/* TIGHTEST RADIUS */}
            <div className="pl-4 md:pl-7">
              <div className="text-[10px] text-slate-500 font-sans font-bold uppercase tracking-wider">
                TIGHTEST RADIUS
              </div>
              <div className="text-sm font-black text-white">
                {telemetry.tightestRadiusMeters} m
              </div>
            </div>
          </div>

          {/* Right Action: Big EXPORT Button matching image.png */}
          <div className="shrink-0 ml-4">
            <button
              onClick={handleStartRace}
              className="px-6 md:px-8 py-2 rounded-lg border-2 border-amber-600/90 bg-amber-950/80 hover:bg-amber-500 hover:text-slate-950 text-amber-400 font-black text-sm uppercase tracking-wider transition-all shadow-xl active:scale-95 flex items-center gap-1.5"
              title="Export circuit & Launch 3D Game"
            >
              Export
            </button>
          </div>
        </footer>
      )}
    </>
  );
};
