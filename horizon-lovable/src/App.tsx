import { useEffect, useState, useCallback, useRef } from 'react';
import { Camera3DMode, ElevationProfile, EnvironmentType, GameMode, LapStats, Track } from './types/game';
import { CAR_CONFIGS, ControlInputs } from './utils/physics';
import { PRESET_TRACKS } from './utils/presets';
import { generateTrackFromRawPoints } from './utils/spline';
import { computeTrackTelemetry } from './utils/trackAnalytics';
import { createDefaultElevationProfile } from './utils/elevation';
import { sound } from './utils/audio';
import { Game3DViewport } from './components/Game3DViewport';
import { ErrorBoundary } from './components/ErrorBoundary';
import { HUD } from './components/HUD';
import { ElevationBoard } from './components/ElevationBoard';
import { TouchControls } from './components/TouchControls';

const initialElevation = createDefaultElevationProfile('rolling', 1.0);
const defaultPreset = PRESET_TRACKS[0]; // Grand Prix preset
const defaultPoints = defaultPreset.generatePoints(2400, 1400);
const defaultTrack = generateTrackFromRawPoints(defaultPoints, defaultPreset.width, true);
if (defaultTrack) {
  defaultTrack.elevationProfile = initialElevation;
}

export default function App() {
  // Start in 'DRAW' mode matching the Horizon Fest 2 track manager page shown in the screenshot
  const [mode, setMode] = useState<GameMode>('DRAW');
  const [brushWidth, setBrushWidth] = useState<number>(48);
  const [barrierDistance, setBarrierDistance] = useState<number>(8.5);
  const [trackLengthScale, setTrackLengthScale] = useState<number>(1.0);
  const [trackBreadthScale, setTrackBreadthScale] = useState<number>(1.0);
  const [linkDimensions, setLinkDimensions] = useState<boolean>(true);
  const [drawMethod, setDrawMethod] = useState<'freehand' | 'dots'>('freehand');
  const [smoothingMode, setSmoothingMode] = useState<string>('Normal');
  const [isHillsOpen, setIsHillsOpen] = useState<boolean>(false);
  const [environment, setEnvironment] = useState<EnvironmentType>('pacific_coast');

  const [track, setTrack] = useState<Track | null>(defaultTrack);
  const [elevationProfile, setElevationProfile] = useState<ElevationProfile>(initialElevation);
  const [carConfig, setCarConfig] = useState(CAR_CONFIGS[0]); // Apex F1
  const [camera3DMode, setCamera3DMode] = useState<Camera3DMode>('chase');
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [showTouchControls, setShowTouchControls] = useState<boolean>(false);

  // Live Telemetry
  const [speed, setSpeed] = useState<number>(0);
  const [rpm, setRpm] = useState<number>(0.15);
  const [isDrifting, setIsDrifting] = useState<boolean>(false);
  const [isOffroad, setIsOffroad] = useState<boolean>(false);
  const [gear, setGear] = useState<number>(1);
  const [driftScore, setDriftScore] = useState<number>(0);
  const [driftMultiplier, setDriftMultiplier] = useState<number>(1.0);
  const [turboBoost, setTurboBoost] = useState<number>(0);

  // Lap stats
  const [lapStats, setLapStats] = useState<LapStats>({
    currentLap: 1,
    totalLaps: 3,
    currentLapTime: 0,
    bestLapTime: null,
    lastLapTime: null,
    lapTimes: [],
    checkpointsHit: new Set<number>(),
    deltaToBest: null,
  });

  // Physical keyboard input state
  const [inputs, setInputs] = useState<ControlInputs>({
    throttle: 0,
    brake: 0,
    steer: 0,
    handbrake: false,
  });

  // Track active keys map
  const activeKeys = useRef<{ [key: string]: boolean }>({});

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      activeKeys.current[e.key.toLowerCase()] = true;
      activeKeys.current[e.code.toLowerCase()] = true;
      updateInputsFromKeys();
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      activeKeys.current[e.key.toLowerCase()] = false;
      activeKeys.current[e.code.toLowerCase()] = false;
      updateInputsFromKeys();
    };

    const updateInputsFromKeys = () => {
      const keys = activeKeys.current;
      const throttle = keys['arrowup'] || keys['keyw'] || keys['w'] ? 1 : 0;
      const brake = keys['arrowdown'] || keys['keys'] || keys['s'] ? 1 : 0;
      let steer = 0;
      if (keys['arrowleft'] || keys['keya'] || keys['a']) steer -= 1;
      if (keys['arrowright'] || keys['keyd'] || keys['d']) steer += 1;
      const handbrake = Boolean(keys['space'] || keys[' ']);

      setInputs({ throttle, brake, steer, handbrake });
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  const handleToggleMute = useCallback(() => {
    setIsMuted((prev) => {
      const next = !prev;
      sound.setMuted(next);
      return next;
    });
  }, []);

  const handleToggleCamera = useCallback(() => {
    setCamera3DMode((prev) => {
      if (prev === 'chase') return 'cockpit';
      if (prev === 'cockpit') return 'drone';
      return 'chase';
    });
  }, []);

  const handleSpeedChanged = useCallback(
    (
      newSpeed: number,
      newRpm: number,
      drifting: boolean,
      offroad: boolean,
      newGear: number = 1,
      newDriftScore: number = 0,
      newDriftMult: number = 1.0,
      newBoost: number = 0
    ) => {
      setSpeed(newSpeed);
      setRpm(newRpm);
      setIsDrifting(drifting);
      setIsOffroad(offroad);
      setGear(newGear);
      setDriftScore(newDriftScore);
      setDriftMultiplier(newDriftMult);
      setTurboBoost(newBoost);
    },
    []
  );

  const handleTrackChanged = useCallback((newTrack: Track | null) => {
    setTrack(newTrack);
  }, []);

  const handleLapStatsChanged = useCallback((stats: LapStats) => {
    setLapStats(stats);
  }, []);

  const handleCountdownStatus = useCallback((_count: number | null) => {}, []);

  const handleElevationChange = useCallback((newProfile: ElevationProfile) => {
    setElevationProfile(newProfile);
    setTrack((prev) => {
      if (!prev) return null;
      return {
        ...prev,
        elevationProfile: newProfile,
        telemetry: computeTrackTelemetry(prev.points, newProfile),
      };
    });
    window.dispatchEvent(
      new CustomEvent('APEX_ELEVATION_UPDATE', { detail: { profile: newProfile } })
    );
  }, []);

  const handleTrackLengthScaleChange = useCallback(
    (newScale: number) => {
      setTrackLengthScale(newScale);
      if (linkDimensions) {
        setTrackBreadthScale(newScale);
        window.dispatchEvent(
          new CustomEvent('APEX_SCALE_TRACK', {
            detail: { scaleX: newScale, scaleY: newScale, scale: newScale },
          })
        );
      } else {
        window.dispatchEvent(
          new CustomEvent('APEX_SCALE_TRACK', {
            detail: { scaleX: newScale, scaleY: trackBreadthScale },
          })
        );
      }
    },
    [linkDimensions, trackBreadthScale]
  );

  const handleTrackBreadthScaleChange = useCallback(
    (newScale: number) => {
      setTrackBreadthScale(newScale);
      if (linkDimensions) {
        setTrackLengthScale(newScale);
        window.dispatchEvent(
          new CustomEvent('APEX_SCALE_TRACK', {
            detail: { scaleX: newScale, scaleY: newScale, scale: newScale },
          })
        );
      } else {
        window.dispatchEvent(
          new CustomEvent('APEX_SCALE_TRACK', {
            detail: { scaleX: trackLengthScale, scaleY: newScale },
          })
        );
      }
    },
    [linkDimensions, trackLengthScale]
  );

  return (
    <main className="relative w-screen h-screen overflow-hidden bg-slate-950 font-sans select-none">
      {/* 3D WebGL Three.js Track Drawer & Racing Engine */}
      <ErrorBoundary>
        <Game3DViewport
          mode={mode}
          brushWidth={brushWidth}
          barrierDistance={barrierDistance}
          smoothingMode={smoothingMode}
          carConfig={carConfig}
          camera3DMode={camera3DMode}
          isMuted={isMuted}
          inputs={inputs}
          initialTrack={track}
          environment={environment}
          onTrackChanged={handleTrackChanged}
          onLapStatsChanged={handleLapStatsChanged}
          onSpeedChanged={handleSpeedChanged}
          onCountdownStatus={handleCountdownStatus}
        />
      </ErrorBoundary>

      {/* Interactive Elevation & Height Board (Triggered by HILLS & JUMPS) */}
      <ElevationBoard
        profile={elevationProfile}
        onChange={handleElevationChange}
        isOpen={isHillsOpen}
        onToggle={() => setIsHillsOpen((prev) => !prev)}
      />

      {/* Horizon Fest 2 Full UI Overlay (Manager Board & Telemetry HUD) */}
      <HUD
        mode={mode}
        onSetMode={setMode}
        track={track}
        brushWidth={brushWidth}
        onBrushWidthChange={setBrushWidth}
        barrierDistance={barrierDistance}
        onBarrierDistanceChange={setBarrierDistance}
        trackLengthScale={trackLengthScale}
        onTrackLengthScaleChange={handleTrackLengthScaleChange}
        trackBreadthScale={trackBreadthScale}
        onTrackBreadthScaleChange={handleTrackBreadthScaleChange}
        linkDimensions={linkDimensions}
        onToggleLinkDimensions={() => setLinkDimensions((prev) => !prev)}
        drawMethod={drawMethod}
        onDrawMethodChange={setDrawMethod}
        smoothingMode={smoothingMode}
        onSmoothingModeChange={setSmoothingMode}
        carConfig={carConfig}
        onCarConfigChange={setCarConfig}
        cameraMode={camera3DMode}
        onToggleCamera={handleToggleCamera}
        speed={speed}
        rpm={rpm}
        isDrifting={isDrifting}
        isOffroad={isOffroad}
        gear={gear}
        driftScore={driftScore}
        driftMultiplier={driftMultiplier}
        turboBoost={turboBoost}
        lapStats={lapStats}
        isMuted={isMuted}
        onToggleMute={handleToggleMute}
        showTouchControls={showTouchControls}
        onToggleTouchControls={() => setShowTouchControls((prev) => !prev)}
        onToggleHills={() => setIsHillsOpen((prev) => !prev)}
        isHillsOpen={isHillsOpen}
        environment={environment}
        onEnvironmentChange={setEnvironment}
      />

      {/* Mobile / Tablet Touch Pedals & Steering (In Race Mode) */}
      {mode === 'RACE' && showTouchControls && (
        <TouchControls onInputsChange={setInputs} />
      )}
    </main>
  );
}
