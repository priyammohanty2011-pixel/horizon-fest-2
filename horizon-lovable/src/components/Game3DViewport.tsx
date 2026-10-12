import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import {
  Camera3DMode,
  CarConfig,
  CarState,
  GameMode,
  GhostData,
  GhostFrame,
  LapStats,
  Point2D,
  Track,
} from '../types/game';
import { ControlInputs, createInitialCarState, updateCarPhysics } from '../utils/physics';
import { distanceBetween, generateTrackFromRawPoints, getCarTrackStatus } from '../utils/spline';
import { PRESET_TRACKS } from '../utils/presets';
import { sound } from '../utils/audio';
import { build3DCar, Car3DInstance } from '../utils/threeCar';
import { build3DTrack, getElevationAtRatio, TRACK_3D_SCALE, Track3DResult } from '../utils/threeTrack';
import {
  createBiomeGroundTexture,
  createGrassTexture,
  createLeafTexture,
  createPetalTexture,
  createSkyDome,
  createSmokeTexture,
  createSparkleTexture,
  updateSkyDome,
} from '../utils/threeAssets';
import { ENVIRONMENTS, EnvironmentType } from '../utils/environments';
import { computeTrackTelemetry } from '../utils/trackAnalytics';
import { getTrackElevationAtProgress } from '../utils/elevation';

interface Game3DViewportProps {
  mode: GameMode;
  brushWidth: number;
  barrierDistance?: number;
  smoothingMode?: string;
  carConfig: CarConfig;
  camera3DMode: Camera3DMode;
  isMuted: boolean;
  inputs: ControlInputs;
  initialTrack?: Track | null;
  environment?: EnvironmentType;
  onTrackChanged: (track: Track | null) => void;
  onLapStatsChanged: (stats: LapStats) => void;
  onSpeedChanged: (
    speed: number,
    rpm: number,
    isDrifting: boolean,
    isOffroad: boolean,
    gear?: number,
    driftScore?: number,
    driftMultiplier?: number,
    turboBoost?: number
  ) => void;
  onCountdownStatus: (count: number | null) => void;
}

// High-resolution drafting board dimensions (optimized for smooth lag-free performance)
const DRAFTING_WIDTH = 2400;
const DRAFTING_HEIGHT = 1400;

export function normalizePointsToBoard(
  pts: Point2D[],
  targetW: number = 1500,
  targetH: number = 850
): Point2D[] {
  if (pts.length < 2) return pts;
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  pts.forEach((p) => {
    if (p.x < minX) minX = p.x;
    if (p.x > maxX) maxX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.y > maxY) maxY = p.y;
  });
  const spanW = maxX - minX || 1;
  const spanH = maxY - minY || 1;
  const fitScale = Math.min(targetW / spanW, targetH / spanH);
  const cx0 = (minX + maxX) / 2;
  const cy0 = (minY + maxY) / 2;
  const bCx = DRAFTING_WIDTH / 2;
  const bCy = DRAFTING_HEIGHT / 2;
  return pts.map((p) => ({
    x: bCx + (p.x - cx0) * fitScale,
    y: bCy + (p.y - cy0) * fitScale,
  }));
}

export const Game3DViewport: React.FC<Game3DViewportProps> = ({
  mode,
  brushWidth,
  barrierDistance = 8.5,
  smoothingMode = 'Normal',
  carConfig,
  camera3DMode,
  isMuted,
  inputs,
  initialTrack,
  environment = 'pacific_coast',
  onTrackChanged,
  onLapStatsChanged,
  onSpeedChanged,
  onCountdownStatus,
}) => {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const drawCanvasRef = useRef<HTMLCanvasElement | null>(null);

  // 2D Drawing refs (auto-rescue from oversized state if points span > 2800px)
  const initialRaw = initialTrack?.rawPoints || [];
  let sanitizedRaw = initialRaw;
  if (sanitizedRaw.length >= 6) {
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    sanitizedRaw.forEach((p) => {
      if (p.x < minX) minX = p.x;
      if (p.x > maxX) maxX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.y > maxY) maxY = p.y;
    });
    if (maxX - minX > 2800 || maxY - minY > 1800) {
      sanitizedRaw = normalizePointsToBoard(sanitizedRaw);
    }
  }

  const isDrawingRef = useRef<boolean>(false);
  const rawPointsRef = useRef<Point2D[]>(sanitizedRaw.map((p) => ({ ...p })));
  const baseRawPointsRef = useRef<Point2D[]>(sanitizedRaw.map((p) => ({ ...p })));
  const trackRef = useRef<Track | null>(initialTrack || null);

  // 2D Canvas Zoom & Pan system for drawing massive circuits
  const canvasZoomRef = useRef<number>(1.0);
  const canvasPanRef = useRef<Point2D>({ x: 0, y: 0 });
  const isPanningRef = useRef<boolean>(false);
  const panStartRef = useRef<Point2D>({ x: 0, y: 0 });
  const panStartOffsetRef = useRef<Point2D>({ x: 0, y: 0 });
  const isSpacePressedRef = useRef<boolean>(false);
  const isPanToolActiveRef = useRef<boolean>(false);

  // 3D Scene refs
  const sceneRef = useRef<THREE.Scene | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const car3DRef = useRef<Car3DInstance | null>(null);
  const ghost3DRef = useRef<Car3DInstance | null>(null);
  const track3DResultRef = useRef<Track3DResult | null>(null);
  const dirLightRef = useRef<THREE.DirectionalLight | null>(null);
  const ambientLightRef = useRef<THREE.AmbientLight | null>(null);
  const groundMeshRef = useRef<THREE.Mesh | null>(null);
  const pitchAngleRef = useRef<number>(0);

  // Environment & Atmospheric Effects
  const environmentRef = useRef<EnvironmentType>(environment);
  const skyDomeRef = useRef<THREE.Mesh | null>(null);
  const skyLasersGroupRef = useRef<THREE.Group | null>(null);
  const ambientParticlesMeshRef = useRef<THREE.InstancedMesh | null>(null);
  const ambientParticlesDataRef = useRef<
    {
      x: number;
      y: number;
      z: number;
      vx: number;
      vy: number;
      vz: number;
      rotZ: number;
      rotSpeedZ: number;
      wobblePhase: number;
      wobbleSpeed: number;
      scale: number;
    }[]
  >([]);
  const dummyParticleRef = useRef<THREE.Object3D>(new THREE.Object3D());
  const lightningRef = useRef<{
    nextFlashTime: number;
    flashActive: boolean;
    flashIntensity: number;
  }>({
    nextFlashTime: 4000,
    flashActive: false,
    flashIntensity: 0,
  });
  const minimapCanvasRef = useRef<HTMLCanvasElement | null>(null);

  // 3D Skid marks & smoke
  const skidRibbonGroupRef = useRef<THREE.Group>(new THREE.Group());
  const smokeParticlesRef = useRef<THREE.Sprite[]>([]);
  const smokeTextureRef = useRef<THREE.CanvasTexture | null>(null);

  // Physics state (runs in 2D coordinate space, mapped to 3D)
  const carStateRef = useRef<CarState>(
    createInitialCarState(
      initialTrack ? initialTrack.startPoint : { x: 0, y: 0 },
      initialTrack ? initialTrack.startAngle : 0
    )
  );
  const cumulativeDistanceRef = useRef<number>(0);

  // Lap & Timing
  const lapStatsRef = useRef<LapStats>({
    currentLap: 1,
    totalLaps: 3,
    currentLapTime: 0,
    bestLapTime: null,
    lastLapTime: null,
    lapTimes: [],
    checkpointsHit: new Set<number>(),
    deltaToBest: null,
  });

  // Ghost recording
  const currentLapFramesRef = useRef<GhostFrame[]>([]);
  const bestGhostRef = useRef<GhostData | null>(null);

  // Countdown & Race Lock - false initially so player can drive immediately
  const [countdown, setCountdown] = useState<number | null>(null);
  const isRacingLockedRef = useRef<boolean>(false);

  // Input refs for animation loop
  const inputsRef = useRef<ControlInputs>(inputs);
  inputsRef.current = inputs;

  const modeRef = useRef<GameMode>(mode);
  modeRef.current = mode;
  const traceImageRef = useRef<HTMLImageElement | null>(null);

  const carConfigRef = useRef<CarConfig>(carConfig);
  carConfigRef.current = carConfig;

  const cameraModeRef = useRef<Camera3DMode>(camera3DMode);
  cameraModeRef.current = camera3DMode;

  const smoothingModeRef = useRef<string>(smoothingMode || 'Normal');
  smoothingModeRef.current = smoothingMode || 'Normal';

  // Callback refs to completely prevent circular re-render loops
  const onTrackChangedRef = useRef(onTrackChanged);
  onTrackChangedRef.current = onTrackChanged;

  const onLapStatsChangedRef = useRef(onLapStatsChanged);
  onLapStatsChangedRef.current = onLapStatsChanged;

  const onSpeedChangedRef = useRef(onSpeedChanged);
  onSpeedChangedRef.current = onSpeedChanged;

  const onCountdownStatusRef = useRef(onCountdownStatus);
  onCountdownStatusRef.current = onCountdownStatus;

  const lastTelemetryTimeRef = useRef<number>(0);

  const resetCarToStart = useCallback((track: Track, notifyParent: boolean = true) => {
    if (!track) return;
    const startPt = track.startPoint;
    const startAng = track.startAngle;
    carStateRef.current = createInitialCarState(startPt, startAng);
    cumulativeDistanceRef.current = 0;

    // Reset 3D skids
    if (skidRibbonGroupRef.current) {
      while (skidRibbonGroupRef.current.children.length > 0) {
        const obj = skidRibbonGroupRef.current.children[0];
        skidRibbonGroupRef.current.remove(obj);
      }
    }

    lapStatsRef.current = {
      currentLap: 1,
      totalLaps: 3,
      currentLapTime: 0,
      bestLapTime: lapStatsRef.current.bestLapTime,
      lastLapTime: null,
      lapTimes: [],
      checkpointsHit: new Set<number>(),
      deltaToBest: null,
    };
    currentLapFramesRef.current = [];
    if (notifyParent) {
      onLapStatsChangedRef.current?.({ ...lapStatsRef.current });
    }

    // Position 3D car and camera right on top of the starting grid with road pitch alignment
    if (car3DRef.current && track3DResultRef.current) {
      const start3D = track3DResultRef.current.start3DPos;
      const startPitch = track3DResultRef.current.start3DPitch || 0;
      pitchAngleRef.current = startPitch;
      const angle = -startAng + Math.PI / 2;
      car3DRef.current.group.position.set(start3D.x, start3D.y, start3D.z);
      car3DRef.current.group.rotation.set(-startPitch, angle, 0, 'YXZ');

      if (cameraRef.current) {
        const camera = cameraRef.current;
        const cosP = Math.cos(startPitch);
        const sinP = Math.sin(startPitch);
        const sinH = Math.sin(angle);
        const cosH = Math.cos(angle);

        const fwdX = sinH * cosP;
        const fwdY = sinP;
        const fwdZ = cosH * cosP;

        const upX = -sinH * sinP;
        const upY = cosP;
        const upZ = -cosH * sinP;

        const chaseDist = 11.5;
        const chaseHeight = 4.3;
        const camX = start3D.x - fwdX * chaseDist + upX * chaseHeight;
        const camY = start3D.y - fwdY * chaseDist + upY * chaseHeight;
        const camZ = start3D.z - fwdZ * chaseDist + upZ * chaseHeight;

        const lookDist = 8.5;
        const lookHeight = 1.1;
        const lookX = start3D.x + fwdX * lookDist + upX * lookHeight;
        const lookY = start3D.y + fwdY * lookDist + upY * lookHeight;
        const lookZ = start3D.z + fwdZ * lookDist + upZ * lookHeight;

        camera.position.set(camX, camY, camZ);
        camera.up.set(upX, upY, upZ);
        camera.lookAt(lookX, lookY, lookZ);
      }
    }
  }, []);

  const startCountdown = useCallback(() => {
    isRacingLockedRef.current = true;
    setCountdown(3);
    onCountdownStatusRef.current?.(3);
    sound.playCountdownBeep(false);

    let count = 3;
    const interval = setInterval(() => {
      count -= 1;
      if (count > 0) {
        setCountdown(count);
        onCountdownStatusRef.current?.(count);
        sound.playCountdownBeep(false);
      } else if (count === 0) {
        setCountdown(0);
        onCountdownStatusRef.current?.(0);
        sound.playCountdownBeep(true);
        isRacingLockedRef.current = false;
      } else {
        clearInterval(interval);
        setCountdown(null);
        onCountdownStatusRef.current?.(null);
      }
    }, 900);
  }, []);

  // Handle Mode transitions (only when mode actually shifts, never on mount)
  const prevModeRef = useRef<GameMode>(mode);
  useEffect(() => {
    if (prevModeRef.current !== mode) {
      prevModeRef.current = mode;
      if (mode === 'RACE') {
        if (trackRef.current) {
          resetCarToStart(trackRef.current, true);
          startCountdown();
        }
      } else {
        sound.stopEngine();
      }
    }
  }, [mode, resetCarToStart, startCountdown]);

  // Update Car Color in 3D when carConfig changes
  useEffect(() => {
    if (car3DRef.current) {
      car3DRef.current.updateColor(carConfig);
    }
  }, [carConfig]);

  // Dedicated helper to instantiate/re-instantiate ambient biome particles (Sakura petals, Kyoto leaves, Coastal sparkles)
  const setupAmbientParticles = useCallback((scene: THREE.Scene, envType: EnvironmentType) => {
    const envConfig = ENVIRONMENTS[envType] || ENVIRONMENTS.pacific_coast;

    // Clean up existing mesh if present
    if (ambientParticlesMeshRef.current) {
      scene.remove(ambientParticlesMeshRef.current);
      ambientParticlesMeshRef.current.geometry.dispose();
      if (Array.isArray(ambientParticlesMeshRef.current.material)) {
        ambientParticlesMeshRef.current.material.forEach((m) => m.dispose());
      } else {
        ambientParticlesMeshRef.current.material.dispose();
      }
      ambientParticlesMeshRef.current = null;
      ambientParticlesDataRef.current = [];
    }

    const hasPetals = Boolean(envConfig.effects.hasPetals);
    const hasLeaves = Boolean(envConfig.effects.hasLeaves);
    const hasSparkles = Boolean(envConfig.effects.hasSparkles);

    if (!hasPetals && !hasLeaves && !hasSparkles) return;

    const pCount = 220; // Medium particle density (balanced atmospheric presence without overcrowding)
    const isSparkle = hasSparkles;
    const baseSize = isSparkle ? 0.55 : 0.48;
    const pGeom = new THREE.PlaneGeometry(baseSize, baseSize);
    const pTex = hasPetals
      ? createPetalTexture()
      : hasLeaves
      ? createLeafTexture()
      : createSparkleTexture();

    const pMat = new THREE.MeshBasicMaterial({
      map: pTex,
      transparent: true,
      opacity: isSparkle ? 0.95 : 0.92,
      side: THREE.DoubleSide,
      depthWrite: false,
      blending: isSparkle ? THREE.AdditiveBlending : THREE.NormalBlending,
    });

    const pMesh = new THREE.InstancedMesh(pGeom, pMat, pCount);
    pMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    pMesh.frustumCulled = false; // CRITICAL: Never let Three.js frustum-cull ambient particles when looking around!

    const pData: {
      x: number;
      y: number;
      z: number;
      vx: number;
      vy: number;
      vz: number;
      rotZ: number;
      rotSpeedZ: number;
      wobblePhase: number;
      wobbleSpeed: number;
      scale: number;
    }[] = [];

    const dummy = new THREE.Object3D();
    const carX = car3DRef.current ? car3DRef.current.group.position.x : 0;
    const carY = car3DRef.current ? car3DRef.current.group.position.y : 0;
    const carZ = car3DRef.current ? car3DRef.current.group.position.z : 0;

    for (let i = 0; i < pCount; i++) {
      const x = carX + (Math.random() - 0.5) * 110;
      const y = carY + 0.6 + Math.random() * 14;
      const z = carZ + (Math.random() - 0.5) * 110;

      const scale = 0.85 + Math.random() * 0.3; // Natural subtle variation around 1.0 (normal size)

      pData.push({
        x,
        y,
        z,
        vx: (Math.random() - 0.5) * 1.6 + (hasPetals ? 0.85 : hasLeaves ? 1.2 : 0.5),
        vy: isSparkle ? (Math.random() - 0.5) * 0.4 + 0.12 : -0.35 - Math.random() * 0.45,
        vz: (Math.random() - 0.5) * 1.6 + (isSparkle ? 0.6 : 0.35),
        rotZ: Math.random() * Math.PI * 2,
        rotSpeedZ: (Math.random() - 0.5) * 2.2,
        wobblePhase: Math.random() * Math.PI * 2,
        wobbleSpeed: 1.5 + Math.random() * 2.5,
        scale,
      });

      dummy.position.set(x, y, z);
      dummy.scale.set(scale, scale, scale);
      dummy.updateMatrix();
      pMesh.setMatrixAt(i, dummy.matrix);
    }

    pMesh.instanceMatrix.needsUpdate = true;
    scene.add(pMesh);
    ambientParticlesMeshRef.current = pMesh;
    ambientParticlesDataRef.current = pData;
  }, []);

  // Update 3D Track Mesh when track changes
  const rebuild3DTrackMesh = useCallback((track: Track | null) => {
    if (!sceneRef.current) return;
    const scene = sceneRef.current;

    // Remove old track mesh if exists
    if (track3DResultRef.current) {
      scene.remove(track3DResultRef.current.trackGroup);
      track3DResultRef.current = null;
    }

    if (!track) {
      if (groundMeshRef.current) {
        groundMeshRef.current.position.y = 0;
      }
      return;
    }

    const result = build3DTrack(track, barrierDistance, environmentRef.current);
    scene.add(result.trackGroup);
    track3DResultRef.current = result;

    // Ensure ambient particles are active and attached to the scene
    if (!ambientParticlesMeshRef.current || !scene.children.includes(ambientParticlesMeshRef.current)) {
      setupAmbientParticles(scene, environmentRef.current);
    }

    // Position background ground plane lower than lowest track point so it never clips
    if (groundMeshRef.current) {
      groundMeshRef.current.position.y = result.baseGroundY - 0.4;
    }

    // Position car immediately on starting grid with road pitch
    if (car3DRef.current) {
      const car = carStateRef.current;
      const car3DPos = result.worldTo3D(car.x, car.y);
      const startY = result.start3DPos.y;
      const startPitch = result.start3DPitch || 0;
      pitchAngleRef.current = startPitch;
      const angle = -car.angle + Math.PI / 2;
      car3DRef.current.group.position.set(car3DPos.x, startY, car3DPos.z);
      car3DRef.current.group.rotation.set(-startPitch, angle, 0, 'YXZ');

      // Position camera behind the car immediately
      if (cameraRef.current && modeRef.current === 'RACE') {
        const camera = cameraRef.current;
        const cosP = Math.cos(startPitch);
        const sinP = Math.sin(startPitch);
        const sinH = Math.sin(angle);
        const cosH = Math.cos(angle);

        const fwdX = sinH * cosP;
        const fwdY = sinP;
        const fwdZ = cosH * cosP;

        const upX = -sinH * sinP;
        const upY = cosP;
        const upZ = -cosH * sinP;

        const chaseDist = 13.5;
        const chaseHeight = 4.6;
        const camX = car3DPos.x - fwdX * chaseDist + upX * chaseHeight;
        const camY = startY - fwdY * chaseDist + upY * chaseHeight;
        const camZ = car3DPos.z - fwdZ * chaseDist + upZ * chaseHeight;

        const lookDist = 9.0;
        const lookHeight = 1.3;
        const lookX = car3DPos.x + fwdX * lookDist + upX * lookHeight;
        const lookY = startY + fwdY * lookDist + upY * lookHeight;
        const lookZ = car3DPos.z + fwdZ * lookDist + upZ * lookHeight;

        camera.position.set(camX, camY, camZ);
        camera.up.set(upX, upY, upZ);
        camera.lookAt(lookX, lookY, lookZ);
      }
    }
  }, [barrierDistance, setupAmbientParticles]);

  // Initialize Three.js Scene
  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    // 1. Scene & Atmospheric Fog
    const envConfig = ENVIRONMENTS[environmentRef.current] || ENVIRONMENTS.pacific_coast;
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(envConfig.sky.topColor);
    scene.fog = new THREE.FogExp2(envConfig.fog.color, envConfig.fog.density);
    sceneRef.current = scene;

    // 2. Camera
    const camera = new THREE.PerspectiveCamera(
      62,
      container.clientWidth / container.clientHeight,
      0.1,
      3500
    );
    camera.position.set(0, 15, 25);
    cameraRef.current = camera;

    // 3. Renderer with soft shadows
    const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.1;
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // 4. Procedural Forza Horizon 6 Sky Dome
    const skyDome = createSkyDome(envConfig);
    scene.add(skyDome);
    skyDomeRef.current = skyDome;

    // 5. Lighting (Sun & Ambient)
    const ambientLight = new THREE.AmbientLight(envConfig.ambient.color, envConfig.ambient.intensity);
    scene.add(ambientLight);
    ambientLightRef.current = ambientLight;

    const dirLight = new THREE.DirectionalLight(envConfig.sky.sunColor, envConfig.sky.sunIntensity);
    dirLight.position.set(...envConfig.sky.sunPosition);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.width = 2048;
    dirLight.shadow.mapSize.height = 2048;
    dirLight.shadow.camera.near = 10;
    dirLight.shadow.camera.far = 400;
    const d = 120;
    dirLight.shadow.camera.left = -d;
    dirLight.shadow.camera.right = d;
    dirLight.shadow.camera.top = d;
    dirLight.shadow.camera.bottom = -d;
    dirLight.shadow.bias = -0.0005;
    scene.add(dirLight);
    dirLightRef.current = dirLight;

    // 6. Terrain Ground Plane
    const groundTex = createBiomeGroundTexture(envConfig);
    const groundGeom = new THREE.PlaneGeometry(8000, 8000);
    groundGeom.rotateX(-Math.PI / 2);
    const groundMat = new THREE.MeshStandardMaterial({
      map: groundTex,
      roughness: envConfig.ground.roughness,
      metalness: envConfig.ground.metalness,
    });
    const groundMesh = new THREE.Mesh(groundGeom, groundMat);
    groundMesh.receiveShadow = true;
    groundMesh.position.y = -10; // lower initially until track is constructed
    scene.add(groundMesh);
    groundMeshRef.current = groundMesh;

    // 6. Skid ribbon group
    scene.add(skidRibbonGroupRef.current);

    // 7. Smoke sprite texture
    smokeTextureRef.current = createSmokeTexture();

    // 8. 3D Player Car
    const playerCar = build3DCar(carConfigRef.current, false);
    scene.add(playerCar.group);
    car3DRef.current = playerCar;

    // 9. 3D Ghost Car (Hologram)
    const ghostCar = build3DCar(carConfigRef.current, true);
    ghostCar.group.visible = false;
    scene.add(ghostCar.group);
    ghost3DRef.current = ghostCar;

    // 10. Ambient Biome Atmospheric Particles
    setupAmbientParticles(scene, environmentRef.current);

    // Build initial track if available
    if (trackRef.current) {
      rebuild3DTrackMesh(trackRef.current);
    }

    // Window Resize Listener
    const handleResize = () => {
      if (!container || !renderer || !camera) return;
      camera.aspect = container.clientWidth / container.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(container.clientWidth, container.clientHeight);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      renderer.dispose();
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    };
  }, [rebuild3DTrackMesh, setupAmbientParticles]);

  // Dynamically update environment (Sky, Fog, Lights, Ground & Biome Props)
  useEffect(() => {
    environmentRef.current = environment;
    const envConfig = ENVIRONMENTS[environment] || ENVIRONMENTS.pacific_coast;
    const scene = sceneRef.current;
    if (!scene) return;

    // 1. Scene Fog & Background
    if (scene.fog && scene.fog instanceof THREE.FogExp2) {
      scene.fog.color.setHex(envConfig.fog.color);
      scene.fog.density = envConfig.fog.density;
    }
    scene.background = new THREE.Color(envConfig.sky.topColor);

    // 2. Sky Dome
    if (skyDomeRef.current) {
      updateSkyDome(skyDomeRef.current, envConfig, 0);
    }

    // 3. Directional Sun/Moon Light
    if (dirLightRef.current) {
      dirLightRef.current.color.setHex(envConfig.sky.sunColor);
      dirLightRef.current.intensity = envConfig.sky.sunIntensity;
      dirLightRef.current.position.set(...envConfig.sky.sunPosition);
    }

    // 4. Ambient Light
    if (ambientLightRef.current) {
      ambientLightRef.current.color.setHex(envConfig.ambient.color);
      ambientLightRef.current.intensity = envConfig.ambient.intensity;
    }

    // 5. Ground Terrain Texture
    if (groundMeshRef.current) {
      const newGroundTex = createBiomeGroundTexture(envConfig);
      const groundMat = groundMeshRef.current.material as THREE.MeshStandardMaterial;
      if (groundMat) {
        if (groundMat.map) groundMat.map.dispose();
        groundMat.map = newGroundTex;
        groundMat.roughness = envConfig.ground.roughness;
        groundMat.metalness = envConfig.ground.metalness;
        groundMat.needsUpdate = true;
      }
    }

    // 6. Sky Lasers (Festival & Neon Tokyo)
    if (skyLasersGroupRef.current) {
      scene.remove(skyLasersGroupRef.current);
      skyLasersGroupRef.current = null;
    }
    if (envConfig.effects.hasSkyLasers && envConfig.effects.laserColors) {
      const laserGroup = new THREE.Group();
      const colors = envConfig.effects.laserColors;
      const beamGeom = new THREE.CylinderGeometry(0.4, 4.2, 340, 10);
      beamGeom.translate(0, 170, 0);

      const count = 8;
      const radius = 95;
      for (let i = 0; i < count; i++) {
        const angle = (i / count) * Math.PI * 2;
        const color = colors[i % colors.length];
        const beamMat = new THREE.MeshBasicMaterial({
          color: color,
          transparent: true,
          opacity: 0.42,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
          side: THREE.DoubleSide,
        });
        const beamMesh = new THREE.Mesh(beamGeom, beamMat);
        const bx = Math.cos(angle) * (radius + (i % 2) * 25);
        const bz = Math.sin(angle) * (radius + (i % 2) * 25);
        beamMesh.position.set(bx, (groundMeshRef.current?.position.y || 0) + 0.2, bz);
        beamMesh.rotation.x = Math.sin(i * 1.5) * 0.18;
        beamMesh.rotation.z = Math.cos(i * 1.5) * 0.18;
        laserGroup.add(beamMesh);
      }
      scene.add(laserGroup);
      skyLasersGroupRef.current = laserGroup;
    }

    // 7. Ambient Drifting Atmospheric Particles (Petals / Leaves / Coastal Sparkles)
    setupAmbientParticles(scene, environment);

    // 8. Rebuild track trees with new biome foliage colors
    if (trackRef.current) {
      rebuild3DTrackMesh(trackRef.current);
    }
  }, [environment, rebuild3DTrackMesh, setupAmbientParticles]);

  // Main 3D Animation & Physics Loop
  useEffect(() => {
    let animationFrameId: number;
    let lastTime = performance.now();

    const loop = (timestamp: number) => {
      const dt = Math.min((timestamp - lastTime) / 1000, 0.05);
      lastTime = timestamp;

      // 1. UPDATE PHYSICS (Race Mode)
      if (modeRef.current === 'RACE' && trackRef.current) {
        const effectiveInputs = isRacingLockedRef.current
          ? { throttle: 0, brake: 0, steer: 0, handbrake: false }
          : inputsRef.current;

        const updatedCar = updateCarPhysics(
          carStateRef.current,
          effectiveInputs,
          carConfigRef.current,
          trackRef.current,
          dt,
          [], // 2D skids not needed here, handled in 3D
          []
        );
        carStateRef.current = updatedCar;
        const forwardSign = (updatedCar.vx * Math.cos(updatedCar.angle) + updatedCar.vy * Math.sin(updatedCar.angle)) >= 0 ? 1 : -1;
        cumulativeDistanceRef.current += forwardSign * updatedCar.speed * 2.4 * dt * TRACK_3D_SCALE;

        // Throttled Telemetry callback (~15 updates/sec) to keep React UI performant and responsive
        if (timestamp - lastTelemetryTimeRef.current > 66) {
          lastTelemetryTimeRef.current = timestamp;
          onSpeedChangedRef.current?.(
            updatedCar.speed,
            updatedCar.rpm,
            updatedCar.isDrifting,
            updatedCar.isOffroad,
            updatedCar.gear || 1,
            updatedCar.driftScore || 0,
            updatedCar.driftMultiplier || 1.0,
            updatedCar.turboBoost || 0
          );
        }

        // Sound update
        if (!isRacingLockedRef.current && !isMuted) {
          sound.updateEngine(
            updatedCar.rpm,
            effectiveInputs.throttle,
            updatedCar.speed,
            updatedCar.isDrifting,
            updatedCar.isOffroad
          );
        }

        // Lap & Checkpoints logic
        if (!isRacingLockedRef.current) {
          const stats = lapStatsRef.current;
          stats.currentLapTime += dt;

          // Record ghost frame
          currentLapFramesRef.current.push({
            time: stats.currentLapTime,
            x: updatedCar.x,
            y: updatedCar.y,
            angle: updatedCar.angle,
          });

          // Checkpoints
          const track = trackRef.current;
          track.checkpoints.forEach((cp, idx) => {
            const dist = distanceBetween({ x: updatedCar.x, y: updatedCar.y }, cp);
            if (dist < track.width * 0.9) {
              stats.checkpointsHit.add(idx);
            }
          });

          // Start / Finish Line Crossing
          const distToStart = distanceBetween({ x: updatedCar.x, y: updatedCar.y }, track.startPoint);
          if (distToStart < track.width * 0.8 && stats.currentLapTime > 4.0) {
            const requiredHits = Math.floor(track.checkpoints.length * 0.7);
            if (stats.checkpointsHit.size >= requiredHits) {
              const finishedLapTime = stats.currentLapTime;
              stats.lastLapTime = finishedLapTime;
              stats.lapTimes.push(finishedLapTime);

              const isBest = stats.bestLapTime === null || finishedLapTime < stats.bestLapTime;
              if (isBest) {
                stats.bestLapTime = finishedLapTime;
                bestGhostRef.current = {
                  lapTime: finishedLapTime,
                  frames: [...currentLapFramesRef.current],
                };
              }

              sound.playLapChime();

              stats.currentLap += 1;
              stats.currentLapTime = 0;
              stats.checkpointsHit = new Set<number>();
              currentLapFramesRef.current = [];

              onLapStatsChangedRef.current?.({ ...stats });
            }
          }

          // Ghost Delta
          if (bestGhostRef.current && bestGhostRef.current.frames.length > 0) {
            const gFrames = bestGhostRef.current.frames;
            const ghostFrameAtTime = gFrames.find((f) => f.time >= stats.currentLapTime);
            if (ghostFrameAtTime) {
              const carDistToGhost = distanceBetween(
                { x: updatedCar.x, y: updatedCar.y },
                { x: ghostFrameAtTime.x, y: ghostFrameAtTime.y }
              );
              const sign = updatedCar.speed > 0 ? (carDistToGhost > 30 ? 1 : -1) : 0;
              stats.deltaToBest = (carDistToGhost / 450) * sign;
            }
          }
        }
      }

      // 2. UPDATE 3D CAR INSTANCE
      if (car3DRef.current && track3DResultRef.current) {
        const car = carStateRef.current;
        const result = track3DResultRef.current;
        const car3DPos = result.worldTo3D(car.x, car.y);

        // Update Car Group Position & Rotation
        // In 2D: angle 0 = +X, Math.PI/2 = +Y.
        // In Three.js: angle in XZ plane around Y axis.
        // Heading direction vector: (+cos(angle), +sin(angle)) in 2D maps to (+cos(angle), +sin(angle)) in XZ.
        // Three.js angle around Y: Math.atan2(Math.sin(angle), Math.cos(angle)) = angle.
        // Adjust for car model forward direction (+Z):
        const heading3D = -car.angle + Math.PI / 2;

        let carElevY = 0.05;
        let pitchAngle = 0;
        if (trackRef.current && trackRef.current.points.length > 0) {
          const status = getCarTrackStatus({ x: car.x, y: car.y }, trackRef.current);
          const count = trackRef.current.points.length;
          const idx = status.closestPointIndex;
          const pA = trackRef.current.points[idx];
          const pB = trackRef.current.points[(idx + 1) % count];
          const segDx = pB.x - pA.x;
          const segDy = pB.y - pA.y;
          const segLenSq = segDx * segDx + segDy * segDy || 1;
          const segT = Math.max(
            0,
            Math.min(1, ((car.x - pA.x) * segDx + (car.y - pA.y) * segDy) / segLenSq)
          );
          const sRatio = (idx + segT) / count;
          carElevY = getElevationAtRatio(sRatio, trackRef.current.elevationProfile) + 0.05;

          const travelSign = (Math.cos(car.angle) * segDx + Math.sin(car.angle) * segDy) >= 0 ? 1 : -1;
          const hA = getElevationAtRatio(idx / count, trackRef.current.elevationProfile);
          const hB = getElevationAtRatio(((idx + 1) % count) / count, trackRef.current.elevationProfile);
          const dy3D = (hB - hA) * travelSign;
          const dHoriz = Math.hypot(segDx * TRACK_3D_SCALE, segDy * TRACK_3D_SCALE) || 1;
          const rawPitch = Math.max(-0.6, Math.min(0.6, Math.atan2(dy3D, dHoriz)));
          pitchAngleRef.current += (rawPitch - pitchAngleRef.current) * 0.22;
          pitchAngle = pitchAngleRef.current;
        }

        const totalPitch = -pitchAngle + (car.bodyPitch || 0);
        const totalRoll = car.bodyRoll || 0;
        car3DRef.current.group.position.set(car3DPos.x, carElevY, car3DPos.z);
        car3DRef.current.group.rotation.set(totalPitch, heading3D, totalRoll, 'YXZ');

        // Animate front wheel steering & spinning
        car3DRef.current.updateWheels(car.steerAngle, cumulativeDistanceRef.current);
        car3DRef.current.setBraking(car.brake > 0, car.brakeGlow || 0);
        car3DRef.current.setExhaustFlame(Boolean(car.exhaustFlame));

        // Update Directional Light position to follow car and track elevation
        if (dirLightRef.current) {
          dirLightRef.current.position.set(car3DPos.x + 80, carElevY + 140, car3DPos.z + 60);
          dirLightRef.current.target.position.set(car3DPos.x, carElevY, car3DPos.z);
          dirLightRef.current.target.updateMatrixWorld();
        }

        // 3D Skid Marks when Drifting
        if (car.isDrifting && car.speed > 40 && skidRibbonGroupRef.current) {
          const skidMat = new THREE.MeshBasicMaterial({
            color: 0x0a0d14,
            transparent: true,
            opacity: 0.45,
          });
          const skidGeom = new THREE.PlaneGeometry(0.38, 1.2);
          skidGeom.rotateX(-Math.PI / 2);
          const skidMesh = new THREE.Mesh(skidGeom, skidMat);
          skidMesh.position.set(car3DPos.x, carElevY + 0.012, car3DPos.z);
          skidMesh.rotation.y = heading3D;
          skidRibbonGroupRef.current.add(skidMesh);

          // Spawn tire smoke sprite
          if (smokeTextureRef.current && sceneRef.current && Math.random() < 0.4) {
            const smokeMat = new THREE.SpriteMaterial({
              map: smokeTextureRef.current,
              transparent: true,
              opacity: 0.55,
              depthWrite: false,
            });
            const smoke = new THREE.Sprite(smokeMat);
            smoke.position.set(
              car3DPos.x + (Math.random() - 0.5) * 1.5,
              carElevY + 0.35 + Math.random() * 0.2,
              car3DPos.z + (Math.random() - 0.5) * 1.5
            );
            smoke.scale.set(1.5, 1.5, 1.5);
            sceneRef.current.add(smoke);
            smokeParticlesRef.current.push(smoke);
          }
        }
      }

      // 3. UPDATE 3D GHOST CAR
      if (ghost3DRef.current && track3DResultRef.current) {
        if (bestGhostRef.current && modeRef.current === 'RACE') {
          ghost3DRef.current.group.visible = true;
          const frames = bestGhostRef.current.frames;
          const curTime = lapStatsRef.current.currentLapTime;

          let targetF = frames[frames.length - 1];
          for (let i = 0; i < frames.length - 1; i++) {
            if (frames[i].time <= curTime && frames[i + 1].time >= curTime) {
              const t = (curTime - frames[i].time) / (frames[i + 1].time - frames[i].time);
              targetF = {
                time: curTime,
                x: frames[i].x + (frames[i + 1].x - frames[i].x) * t,
                y: frames[i].y + (frames[i + 1].y - frames[i].y) * t,
                angle: frames[i].angle + (frames[i + 1].angle - frames[i].angle) * t,
              };
              break;
            }
          }

          const gPos = track3DResultRef.current.worldTo3D(targetF.x, targetF.y);
          let gElevY = 0.05;
          if (trackRef.current && trackRef.current.points.length > 0) {
            const gStatus = getCarTrackStatus({ x: targetF.x, y: targetF.y }, trackRef.current);
            const count = trackRef.current.points.length;
            const idx = gStatus.closestPointIndex;
            const pA = trackRef.current.points[idx];
            const pB = trackRef.current.points[(idx + 1) % count];
            const segDx = pB.x - pA.x;
            const segDy = pB.y - pA.y;
            const segLenSq = segDx * segDx + segDy * segDy || 1;
            const segT = Math.max(
              0,
              Math.min(1, ((targetF.x - pA.x) * segDx + (targetF.y - pA.y) * segDy) / segLenSq)
            );
            const gSRatio = (idx + segT) / count;
            gElevY = getElevationAtRatio(gSRatio, trackRef.current.elevationProfile) + 0.05;
          }
          ghost3DRef.current.group.position.set(gPos.x, gElevY, gPos.z);
          ghost3DRef.current.group.rotation.y = -targetF.angle + Math.PI / 2;
        } else {
          ghost3DRef.current.group.visible = false;
        }
      }

      // Update Smoke Particles
      const smokeList = smokeParticlesRef.current;
      for (let i = smokeList.length - 1; i >= 0; i--) {
        const s = smokeList[i];
        s.position.y += 0.8 * dt;
        s.scale.multiplyScalar(1.0 + 1.2 * dt);
        s.material.opacity -= 0.6 * dt;
        if (s.material.opacity <= 0.02) {
          if (sceneRef.current) sceneRef.current.remove(s);
          smokeList.splice(i, 1);
        }
      }

      // Trim skid marks if too many
      if (skidRibbonGroupRef.current && skidRibbonGroupRef.current.children.length > 500) {
        const removeCount = 40;
        for (let r = 0; r < removeCount; r++) {
          skidRibbonGroupRef.current.remove(skidRibbonGroupRef.current.children[0]);
        }
      }

      // 4. CAMERA CHOREOGRAPHY
      if (cameraRef.current && car3DRef.current) {
        const camera = cameraRef.current;
        const car = car3DRef.current.group;
        const carSpeed = carStateRef.current.speed;

        // Dynamic FOV with speed (widens for intense racing sensation from 60 to 88 degrees at 400 km/h)
        const targetFOV = 60 + Math.min(28, (carSpeed / 400) * 28);
        camera.fov += (targetFOV - camera.fov) * 0.12;
        camera.updateProjectionMatrix();

        // In DRAW mode, pull camera up to show complete circuit overview
        if (modeRef.current === 'DRAW') {
          let targetCamY = 130;
          let targetCamZ = 85;
          if (trackRef.current) {
            const b = trackRef.current.bounds;
            const spanX = (b.maxX - b.minX) * TRACK_3D_SCALE;
            const spanZ = (b.maxY - b.minY) * TRACK_3D_SCALE;
            const maxSpan = Math.max(spanX, spanZ);
            targetCamY = Math.max(130, maxSpan * 0.95);
            targetCamZ = targetCamY * 0.65;
          }
          camera.position.x += (0 - camera.position.x) * 0.08;
          camera.position.y += (targetCamY - camera.position.y) * 0.08;
          camera.position.z += (targetCamZ - camera.position.z) * 0.08;
          camera.up.set(0, 1, 0);
          camera.lookAt(0, 0, 0);
        } else if (cameraModeRef.current === 'chase') {
          // Dynamic third-person chase camera with Forza Horizon drift look-ahead & inertia
          const rawHeading = -carStateRef.current.angle + Math.PI / 2;
          const pitch = pitchAngleRef.current;

          // Calculate slip angle for dynamic camera drift centering
          const fwdXDir = Math.cos(carStateRef.current.angle);
          const fwdYDir = Math.sin(carStateRef.current.angle);
          const latXDir = -Math.sin(carStateRef.current.angle);
          const latYDir = Math.cos(carStateRef.current.angle);
          const vFwd = carStateRef.current.vx * fwdXDir + carStateRef.current.vy * fwdYDir;
          const vLat = carStateRef.current.vx * latXDir + carStateRef.current.vy * latYDir;
          const slipAngle = Math.atan2(vLat, Math.abs(vFwd) + 12);

          // Camera smoothly leads into drifts and apexes
          const camHeading = rawHeading - Math.max(-0.25, Math.min(0.25, slipAngle * 0.45));

          const cosP = Math.cos(pitch);
          const sinP = Math.sin(pitch);
          const sinH = Math.sin(camHeading);
          const cosH = Math.cos(camHeading);

          // Unit Forward vector: (+sinH*cosP, +sinP, +cosH*cosP)
          const fwdX = sinH * cosP;
          const fwdY = sinP;
          const fwdZ = cosH * cosP;

          // Unit Up vector: (-sinH*sinP, +cosP, -cosH*sinP)
          const upX = -sinH * sinP;
          const upY = cosP;
          const upZ = -cosH * sinP;

          // Inertia dynamics: pulls back under high-horsepower acceleration, pushes in under heavy braking
          const throttlePull = (inputsRef.current.throttle || 0) * 2.4;
          const brakePush = (inputsRef.current.brake || 0) * 1.8;
          const chaseDist = 11.0 + throttlePull - brakePush;
          const chaseHeight = 4.1;

          // Camera position behind the rear of the car along road incline
          const targetCamX = car.position.x - fwdX * chaseDist + upX * chaseHeight;
          const targetCamY = car.position.y - fwdY * chaseDist + upY * chaseHeight;
          const targetCamZ = car.position.z - fwdZ * chaseDist + upZ * chaseHeight;

          camera.position.x += (targetCamX - camera.position.x) * 0.16;
          camera.position.y += (targetCamY - camera.position.y) * 0.16;
          camera.position.z += (targetCamZ - camera.position.z) * 0.16;

          // High-speed camera road vibration (intense supercar jitter scaling up to 400 km/h)
          if (carSpeed > 180) {
            const highSpeedJitter = ((carSpeed - 180) / 220) * 0.12;
            camera.position.x += (Math.random() - 0.5) * highSpeedJitter;
            camera.position.y += (Math.random() - 0.5) * highSpeedJitter;
          }

          // Off-road camera rumble
          if (carStateRef.current.isOffroad && carSpeed > 45) {
            camera.position.x += (Math.random() - 0.5) * 0.15;
            camera.position.y += (Math.random() - 0.5) * 0.15;
            camera.position.z += (Math.random() - 0.5) * 0.15;
          }

          // Look ahead along car's trajectory into corner
          const lookHeading = rawHeading - Math.max(-0.35, Math.min(0.35, slipAngle * 0.65));
          const lookSinH = Math.sin(lookHeading);
          const lookCosH = Math.cos(lookHeading);
          const lookFwdX = lookSinH * cosP;
          const lookFwdY = sinP;
          const lookFwdZ = lookCosH * cosP;

          const lookAheadDist = 8.5;
          const lookHeight = 1.1;
          const lookX = car.position.x + lookFwdX * lookAheadDist + upX * lookHeight;
          const lookY = car.position.y + lookFwdY * lookAheadDist + upY * lookHeight;
          const lookZ = car.position.z + lookFwdZ * lookAheadDist + upZ * lookHeight;

          // Camera UP matches road surface normal - completely prevents gimbal lock and sideways camera roll
          camera.up.set(upX, upY, upZ);
          camera.lookAt(lookX, lookY, lookZ);
        } else if (cameraModeRef.current === 'cockpit') {
          // Low hood / cockpit camera right above nose looking forward
          const heading = -carStateRef.current.angle + Math.PI / 2;
          const pitch = pitchAngleRef.current;
          const cosP = Math.cos(pitch);
          const sinP = Math.sin(pitch);
          const sinH = Math.sin(heading);
          const cosH = Math.cos(heading);

          const fwdX = sinH * cosP;
          const fwdY = sinP;
          const fwdZ = cosH * cosP;

          const upX = -sinH * sinP;
          const upY = cosP;
          const upZ = -cosH * sinP;

          const camX = car.position.x + fwdX * 0.7 + upX * 1.15;
          const camY = car.position.y + fwdY * 0.7 + upY * 1.15;
          const camZ = car.position.z + fwdZ * 0.7 + upZ * 1.15;

          camera.position.set(camX, camY, camZ);

          const lookDist = 35;
          const lookX = car.position.x + fwdX * lookDist + upX * 0.9;
          const lookY = car.position.y + fwdY * lookDist + upY * 0.9;
          const lookZ = car.position.z + fwdZ * lookDist + upZ * 0.9;

          camera.up.set(upX, upY, upZ);
          camera.lookAt(lookX, lookY, lookZ);
        } else if (cameraModeRef.current === 'isometric') {
          // Drone / high angle perspective tracking from behind and above
          const heading = -carStateRef.current.angle + Math.PI / 2;
          const targetCamX = car.position.x - Math.sin(heading) * 18;
          const targetCamZ = car.position.z - Math.cos(heading) * 18;
          const targetCamY = car.position.y + 28.0;

          camera.position.x += (targetCamX - camera.position.x) * 0.12;
          camera.position.y += (targetCamY - camera.position.y) * 0.12;
          camera.position.z += (targetCamZ - camera.position.z) * 0.12;

          camera.up.set(0, 1, 0);
          camera.lookAt(
            car.position.x + Math.sin(heading) * 4,
            car.position.y + 0.5,
            car.position.z + Math.cos(heading) * 4
          );
        } else {
          // 'drone' or overview of entire circuit
          let targetCamY = 115;
          let targetCamZ = 75;
          if (trackRef.current) {
            const b = trackRef.current.bounds;
            const spanX = (b.maxX - b.minX) * TRACK_3D_SCALE;
            const spanZ = (b.maxY - b.minY) * TRACK_3D_SCALE;
            const maxSpan = Math.max(spanX, spanZ);
            targetCamY = Math.max(115, maxSpan * 0.9);
            targetCamZ = targetCamY * 0.65;
          }
          camera.position.x += (0 - camera.position.x) * 0.08;
          camera.position.y += (targetCamY - camera.position.y) * 0.08;
          camera.position.z += (targetCamZ - camera.position.z) * 0.08;
          camera.up.set(0, 1, 0);
          camera.lookAt(0, 0, 0);
        }
      }

      // Keep sky dome centered on camera to eliminate any clipping
      if (skyDomeRef.current && cameraRef.current) {
        skyDomeRef.current.position.copy(cameraRef.current.position);
      }

      // Sky Lasers rotation & swaying
      if (skyLasersGroupRef.current) {
        skyLasersGroupRef.current.rotation.y += 0.0025;
        skyLasersGroupRef.current.children.forEach((beam, idx) => {
          beam.rotation.x = Math.sin(timestamp * 0.0008 + idx * 0.8) * 0.2;
          beam.rotation.z = Math.cos(timestamp * 0.0009 + idx * 0.8) * 0.2;
        });
      }

      // Drifting Petals / Leaves / Coastal Sparkles animation (always active across the track)
      if (
        ambientParticlesMeshRef.current &&
        ambientParticlesDataRef.current.length > 0 &&
        cameraRef.current
      ) {
        const pMesh = ambientParticlesMeshRef.current;
        const pData = ambientParticlesDataRef.current;
        const dummy = dummyParticleRef.current;
        const camera = cameraRef.current;
        const camQuat = camera.quaternion;

        const isSparkle = Boolean(ENVIRONMENTS[environmentRef.current]?.effects.hasSparkles);
        const isDrawMode = modeRef.current === 'DRAW';
        const isRacing = modeRef.current === 'RACE' && Boolean(car3DRef.current);

        let focusX = 0;
        let focusY = 0;
        let focusZ = 0;
        let fwdX = 0;
        let fwdZ = 1;

        if (isRacing && car3DRef.current) {
          const carPos = car3DRef.current.group.position;
          focusX = carPos.x;
          focusY = carPos.y;
          focusZ = carPos.z;
          const carRotY = car3DRef.current.group.rotation.y;
          // In 3D: car forward heading vector is (+sin(carRotY), +cos(carRotY))
          fwdX = Math.sin(carRotY);
          fwdZ = Math.cos(carRotY);
        } else {
          focusX = camera.position.x;
          focusY = track3DResultRef.current ? track3DResultRef.current.baseGroundY + 1.5 : 0;
          focusZ = camera.position.z;
          const camDir = new THREE.Vector3();
          camera.getWorldDirection(camDir);
          const hLen = Math.hypot(camDir.x, camDir.z);
          if (hLen > 0.05) {
            fwdX = camDir.x / hLen;
            fwdZ = camDir.z / hLen;
          }
        }

        const perpX = -fwdZ;
        const perpZ = fwdX;

        for (let i = 0; i < pData.length; i++) {
          const p = pData[i];
          p.x += p.vx * dt * 2.8;
          p.y += p.vy * dt * 2.8;
          p.z += p.vz * dt * 2.8;
          p.rotZ += p.rotSpeedZ * dt;
          p.wobblePhase += p.wobbleSpeed * dt;

          const distToFocus = Math.hypot(p.x - focusX, p.z - focusZ);
          const maxDist = isDrawMode ? 140.0 : 65.0;
          const minY = focusY - 1.5;
          const maxY = focusY + 16.0;

          if (p.y < minY || p.y > maxY || distToFocus > maxDist) {
            if (isRacing) {
              // Lead ahead along the car's driving heading so the player continuously drives through the effect
              const forwardLead = 6.0 + Math.random() * 45.0;
              const sideOffset = (Math.random() - 0.5) * 42.0;
              p.x = focusX + fwdX * forwardLead + perpX * sideOffset;
              p.z = focusZ + fwdZ * forwardLead + perpZ * sideOffset;
              p.y = focusY + 0.6 + Math.random() * 11.5;
            } else {
              const radius = Math.random() * 110.0;
              const angle = Math.random() * Math.PI * 2;
              p.x = focusX + Math.cos(angle) * radius;
              p.z = focusZ + Math.sin(angle) * radius;
              p.y = focusY + 0.8 + Math.random() * 14.0;
            }
          }

          dummy.position.set(p.x, p.y, p.z);
          dummy.quaternion.copy(camQuat);

          if (isSparkle) {
            // Coastal Sparkles: Face camera directly, spin diamond star rays, subtle twinkle
            dummy.rotateZ(p.rotZ);
            const twinkle = p.scale * (0.88 + 0.22 * Math.sin(p.wobblePhase));
            dummy.scale.set(twinkle, twinkle, twinkle);
          } else {
            // Petals & Leaves: Billboard with subtle organic wind flutter (never turns edge-on)
            dummy.rotateZ(p.rotZ);
            dummy.rotateX(Math.sin(p.wobblePhase) * 0.38);
            dummy.rotateY(Math.cos(p.wobblePhase * 0.7) * 0.28);
            dummy.scale.set(p.scale, p.scale, p.scale);
          }

          dummy.updateMatrix();
          pMesh.setMatrixAt(i, dummy.matrix);
        }
        pMesh.instanceMatrix.needsUpdate = true;
      }

      // Storm Lightning Flashes
      const curEnv = ENVIRONMENTS[environmentRef.current] || ENVIRONMENTS.pacific_coast;
      if (curEnv.effects.hasLightning) {
        const l = lightningRef.current;
        if (!l.flashActive && timestamp > l.nextFlashTime) {
          l.flashActive = true;
          l.flashIntensity = 1.0;
          l.nextFlashTime = timestamp + 5000 + Math.random() * 6000;
          if (!isMuted) {
            sound.playThunder();
          }
        }

        if (l.flashActive) {
          l.flashIntensity = Math.max(0, l.flashIntensity - dt * 4.2);
          if (l.flashIntensity <= 0) {
            l.flashActive = false;
          }

          if (skyDomeRef.current) {
            updateSkyDome(skyDomeRef.current, curEnv, l.flashIntensity);
          }
          if (dirLightRef.current) {
            dirLightRef.current.intensity = curEnv.sky.sunIntensity + l.flashIntensity * 4.0;
            dirLightRef.current.color.setHex(l.flashIntensity > 0.4 ? 0xe2e8f0 : curEnv.sky.sunColor);
          }
        }
      }

      // Dynamic Electronic Glow Pulse for Barrier Directional Chevron Rails
      if (track3DResultRef.current?.trackGroup) {
        const chevronPulse = 1.45 + 0.35 * Math.sin(performance.now() * 0.0035);
        track3DResultRef.current.trackGroup.traverse((child: THREE.Object3D) => {
          if (child.name === 'chevronRailMesh' || child.name === 'turnArrowSignMesh') {
            const m = (child as THREE.Mesh).material as THREE.MeshStandardMaterial;
            if (m && m.emissive) {
              m.emissiveIntensity = child.name === 'turnArrowSignMesh' ? chevronPulse * 1.35 : chevronPulse;
            }
          }
        });
      }

      // 5. RENDER THREE.JS SCENE
      if (rendererRef.current && sceneRef.current && cameraRef.current) {
        rendererRef.current.render(sceneRef.current, cameraRef.current);
      }

      // 6. RENDER REAL-TIME TRACK MINIMAP IN RACE MODE (60 FPS)
      if (modeRef.current === 'RACE' && trackRef.current && minimapCanvasRef.current) {
        renderMiniMap(minimapCanvasRef.current, trackRef.current, carStateRef.current);
      }

      animationFrameId = requestAnimationFrame(loop);
    };

    animationFrameId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animationFrameId);
  }, [isMuted]);

  // Handle Custom Events from HUD (Clear, Finish, Presets, Reset)
  useEffect(() => {
    const handleEvents = (e: Event) => {
      const custom = e as CustomEvent;
      if (custom.type === 'APEX_CLEAR_TRACK') {
        rawPointsRef.current = [];
        baseRawPointsRef.current = [];
        trackRef.current = null;
        onTrackChanged(null);
        rebuild3DTrackMesh(null);
      } else if (custom.type === 'APEX_FINISH_TRACK') {
        if (rawPointsRef.current.length >= 6) {
          baseRawPointsRef.current = rawPointsRef.current.map((p) => ({ ...p }));
          const generated = generateTrackFromRawPoints(rawPointsRef.current, brushWidth, true, smoothingModeRef.current);
          if (generated) {
            trackRef.current = generated;
            onTrackChanged(generated);
            rebuild3DTrackMesh(generated);
            resetCarToStart(generated);
          }
        }
      } else if (custom.type === 'APEX_LOAD_PRESET') {
        const presetId = custom.detail?.presetId;
        const preset = PRESET_TRACKS.find((p) => p.id === presetId) || PRESET_TRACKS[0];
        const pts = preset.generatePoints(DRAFTING_WIDTH, DRAFTING_HEIGHT);
        rawPointsRef.current = pts;
        baseRawPointsRef.current = pts.map((p) => ({ ...p }));
        const generated = generateTrackFromRawPoints(pts, preset.width, true, smoothingModeRef.current);
        if (generated) {
          trackRef.current = generated;
          onTrackChanged(generated);
          rebuild3DTrackMesh(generated);
          resetCarToStart(generated);
        }
        drawDraftingCanvas();
      } else if (custom.type === 'APEX_RESET_CAR') {
        if (trackRef.current) {
          resetCarToStart(trackRef.current);
          startCountdown();
        }
      } else if (custom.type === 'APEX_ELEVATION_UPDATE') {
        if (trackRef.current) {
          trackRef.current.elevationProfile = custom.detail?.profile;
          rebuild3DTrackMesh(trackRef.current);
        }
      } else if (custom.type === 'APEX_UNDO_POINT') {
        if (rawPointsRef.current.length > 6) {
          rawPointsRef.current.splice(-4);
          baseRawPointsRef.current = rawPointsRef.current.map((p) => ({ ...p }));
          const generated = generateTrackFromRawPoints(rawPointsRef.current, brushWidth, true, smoothingModeRef.current);
          if (generated) {
            trackRef.current = generated;
            onTrackChanged(generated);
            rebuild3DTrackMesh(generated);
            resetCarToStart(generated);
          }
        } else {
          rawPointsRef.current = [];
          baseRawPointsRef.current = [];
          trackRef.current = null;
          onTrackChanged(null);
          rebuild3DTrackMesh(null);
        }
        drawDraftingCanvas();
      } else if (custom.type === 'APEX_REVERSE_TRACK') {
        if (rawPointsRef.current.length >= 6) {
          rawPointsRef.current.reverse();
          baseRawPointsRef.current = rawPointsRef.current.map((p) => ({ ...p }));
          const generated = generateTrackFromRawPoints(rawPointsRef.current, brushWidth, true, smoothingModeRef.current);
          if (generated) {
            trackRef.current = generated;
            onTrackChanged(generated);
            rebuild3DTrackMesh(generated);
            resetCarToStart(generated);
          }
        }
        drawDraftingCanvas();
      } else if (custom.type === 'APEX_SCALE_TRACK') {
        const scaleX = custom.detail?.scaleX ?? custom.detail?.scale ?? 1.0;
        const scaleY = custom.detail?.scaleY ?? custom.detail?.scale ?? 1.0;
        // Ensure base points are stored from current points if not yet initialized
        if (baseRawPointsRef.current.length < 6 && rawPointsRef.current.length >= 6) {
          baseRawPointsRef.current = rawPointsRef.current.map((p) => ({ ...p }));
        }
        let basePts = baseRawPointsRef.current;
        if (basePts.length >= 6) {
          // Auto-rescue check: if base points are blown up from previous compounding (>2800px)
          let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
          basePts.forEach((p) => {
            if (p.x < minX) minX = p.x;
            if (p.x > maxX) maxX = p.x;
            if (p.y < minY) minY = p.y;
            if (p.y > maxY) maxY = p.y;
          });
          if (maxX - minX > 2800 || maxY - minY > 1800) {
            basePts = normalizePointsToBoard(basePts);
            baseRawPointsRef.current = basePts;
          }

          let cx = 0, cy = 0;
          basePts.forEach((p) => { cx += p.x; cy += p.y; });
          cx /= basePts.length;
          cy /= basePts.length;
          const scaled = basePts.map((p) => ({
            x: cx + (p.x - cx) * scaleX,
            y: cy + (p.y - cy) * scaleY,
          }));
          rawPointsRef.current = scaled;
          const generated = generateTrackFromRawPoints(scaled, brushWidth, true, smoothingModeRef.current);
          if (generated) {
            trackRef.current = generated;
            onTrackChangedRef.current?.(generated);
            rebuild3DTrackMesh(generated);
            resetCarToStart(generated);
          }
          drawDraftingCanvas();
        }
      } else if (custom.type === 'APEX_NORMALIZE_TRACK_TO_BOARD') {
        const pts = rawPointsRef.current.length >= 6 ? rawPointsRef.current : baseRawPointsRef.current;
        if (pts.length >= 6) {
          const normalized = normalizePointsToBoard(pts);
          baseRawPointsRef.current = normalized.map((p) => ({ ...p }));
          rawPointsRef.current = normalized;
          const generated = generateTrackFromRawPoints(normalized, brushWidth, true, smoothingModeRef.current);
          if (generated) {
            trackRef.current = generated;
            onTrackChangedRef.current?.(generated);
            rebuild3DTrackMesh(generated);
            resetCarToStart(generated);
          }
          canvasZoomRef.current = 1.0;
          canvasPanRef.current = { x: 0, y: 0 };
          window.dispatchEvent(
            new CustomEvent('APEX_CANVAS_ZOOM_SYNC', { detail: { zoomPercent: 100 } })
          );
          drawDraftingCanvas();
        }
      } else if (custom.type === 'APEX_SET_TRACE_IMAGE') {
        const img = new window.Image();
        img.src = custom.detail?.url;
        img.onload = () => {
          traceImageRef.current = img;
          drawDraftingCanvas();
        };
      } else if (custom.type === 'APEX_SET_CANVAS_ZOOM') {
        const targetZoom = custom.detail?.zoom ?? 1.0;
        canvasZoomRef.current = Math.min(2.5, Math.max(0.35, targetZoom));
        drawDraftingCanvas();
      } else if (custom.type === 'APEX_RESET_CANVAS_VIEW') {
        canvasZoomRef.current = 1.0;
        canvasPanRef.current = { x: 0, y: 0 };
        window.dispatchEvent(
          new CustomEvent('APEX_CANVAS_ZOOM_SYNC', { detail: { zoomPercent: 100 } })
        );
        drawDraftingCanvas();
      } else if (custom.type === 'APEX_SET_PAN_MODE') {
        isPanToolActiveRef.current = !!custom.detail?.active;
      } else if (custom.type === 'APEX_FIT_TRACK_VIEW') {
        const pts = rawPointsRef.current;
        const canvas = drawCanvasRef.current;
        if (pts.length > 1 && canvas) {
          let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
          for (let i = 0; i < pts.length; i++) {
            const p = pts[i];
            if (p.x < minX) minX = p.x;
            if (p.x > maxX) maxX = p.x;
            if (p.y < minY) minY = p.y;
            if (p.y > maxY) maxY = p.y;
          }
          const spanW = maxX - minX || 1;
          const spanH = maxY - minY || 1;
          const pad = brushWidth + 140;
          const availW = canvas.width - pad * 2;
          const availH = canvas.height - pad * 2;
          const fitZoom = Math.min(2.0, Math.max(0.35, Math.min(availW / spanW, availH / spanH)));
          const midX = (minX + maxX) / 2;
          const midY = (minY + maxY) / 2;
          const cx = canvas.width / 2;
          const cy = canvas.height / 2;

          canvasZoomRef.current = fitZoom;
          canvasPanRef.current = {
            x: -(midX - cx) * fitZoom,
            y: -(midY - cy) * fitZoom,
          };
          window.dispatchEvent(
            new CustomEvent('APEX_CANVAS_ZOOM_SYNC', {
              detail: { zoomPercent: Math.round(fitZoom * 100) },
            })
          );
          drawDraftingCanvas();
        }
      }
    };

    window.addEventListener('APEX_CLEAR_TRACK', handleEvents);
    window.addEventListener('APEX_FINISH_TRACK', handleEvents);
    window.addEventListener('APEX_LOAD_PRESET', handleEvents);
    window.addEventListener('APEX_RESET_CAR', handleEvents);
    window.addEventListener('APEX_ELEVATION_UPDATE', handleEvents);
    window.addEventListener('APEX_UNDO_POINT', handleEvents);
    window.addEventListener('APEX_REVERSE_TRACK', handleEvents);
    window.addEventListener('APEX_SCALE_TRACK', handleEvents);
    window.addEventListener('APEX_NORMALIZE_TRACK_TO_BOARD', handleEvents);
    window.addEventListener('APEX_SET_TRACE_IMAGE', handleEvents);
    window.addEventListener('APEX_SET_CANVAS_ZOOM', handleEvents);
    window.addEventListener('APEX_RESET_CANVAS_VIEW', handleEvents);
    window.addEventListener('APEX_SET_PAN_MODE', handleEvents);
    window.addEventListener('APEX_FIT_TRACK_VIEW', handleEvents);

    return () => {
      window.removeEventListener('APEX_CLEAR_TRACK', handleEvents);
      window.removeEventListener('APEX_FINISH_TRACK', handleEvents);
      window.removeEventListener('APEX_LOAD_PRESET', handleEvents);
      window.removeEventListener('APEX_RESET_CAR', handleEvents);
      window.removeEventListener('APEX_ELEVATION_UPDATE', handleEvents);
      window.removeEventListener('APEX_UNDO_POINT', handleEvents);
      window.removeEventListener('APEX_REVERSE_TRACK', handleEvents);
      window.removeEventListener('APEX_SCALE_TRACK', handleEvents);
      window.removeEventListener('APEX_NORMALIZE_TRACK_TO_BOARD', handleEvents);
      window.removeEventListener('APEX_SET_TRACE_IMAGE', handleEvents);
      window.removeEventListener('APEX_SET_CANVAS_ZOOM', handleEvents);
      window.removeEventListener('APEX_RESET_CANVAS_VIEW', handleEvents);
      window.removeEventListener('APEX_SET_PAN_MODE', handleEvents);
      window.removeEventListener('APEX_FIT_TRACK_VIEW', handleEvents);
    };
  }, [brushWidth, onTrackChanged, rebuild3DTrackMesh, resetCarToStart, startCountdown]);

  // Spacebar pan navigation listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (modeRef.current === 'DRAW' && e.code === 'Space' && !e.repeat) {
        const tag = (e.target as HTMLElement)?.tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA') return;
        e.preventDefault();
        isSpacePressedRef.current = true;
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        isSpacePressedRef.current = false;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  // ==================== 2D DRAWING OVERLAY FOR "DRAW TRACK" MODE ====================
  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (mode !== 'DRAW') return;
    const canvas = drawCanvasRef.current;
    if (!canvas) return;

    // Check if user is panning: middle click, right click, space+drag, or Pan Mode tool
    const isPanAction =
      e.button === 1 ||
      e.button === 2 ||
      isSpacePressedRef.current ||
      isPanToolActiveRef.current;

    if (isPanAction) {
      canvas.setPointerCapture(e.pointerId);
      isPanningRef.current = true;
      panStartRef.current = { x: e.clientX, y: e.clientY };
      panStartOffsetRef.current = { ...canvasPanRef.current };
      return;
    }

    if (e.button !== 0) return; // Only left button draws

    sound.init();
    canvas.setPointerCapture(e.pointerId);
    isDrawingRef.current = true;

    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const screenX = (e.clientX - rect.left) * scaleX;
    const screenY = (e.clientY - rect.top) * scaleY;

    const cx = canvas.width / 2;
    const cy = canvas.height / 2;
    const zoom = canvasZoomRef.current;
    const pan = canvasPanRef.current;

    // Invert zoom & pan transform to get precise world coordinates
    const worldX = cx + (screenX - (cx + pan.x)) / zoom;
    const worldY = cy + (screenY - (cy + pan.y)) / zoom;

    rawPointsRef.current = [{ x: worldX, y: worldY }];
    baseRawPointsRef.current = [{ x: worldX, y: worldY }];
    trackRef.current = null;
    onTrackChanged(null);
    rebuild3DTrackMesh(null);
    drawDraftingCanvas();
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (mode !== 'DRAW') return;
    const canvas = drawCanvasRef.current;
    if (!canvas) return;

    if (isPanningRef.current) {
      const rect = canvas.getBoundingClientRect();
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;
      const dx = (e.clientX - panStartRef.current.x) * scaleX;
      const dy = (e.clientY - panStartRef.current.y) * scaleY;
      canvasPanRef.current = {
        x: panStartOffsetRef.current.x + dx,
        y: panStartOffsetRef.current.y + dy,
      };
      drawDraftingCanvas();
      return;
    }

    if (!isDrawingRef.current) return;

    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const screenX = (e.clientX - rect.left) * scaleX;
    const screenY = (e.clientY - rect.top) * scaleY;

    const cx = canvas.width / 2;
    const cy = canvas.height / 2;
    const zoom = canvasZoomRef.current;
    const pan = canvasPanRef.current;

    // Invert zoom & pan transform
    const worldX = cx + (screenX - (cx + pan.x)) / zoom;
    const worldY = cy + (screenY - (cy + pan.y)) / zoom;

    const pts = rawPointsRef.current;
    const last = pts[pts.length - 1];

    if (!last || distanceBetween(last, { x: worldX, y: worldY }) > 8) {
      pts.push({ x: worldX, y: worldY });
      drawDraftingCanvas();

      // Real-time telemetry calculation while drawing
      if (pts.length >= 4 && pts.length % 4 === 0) {
        const liveTele = computeTrackTelemetry(pts);
        if (trackRef.current) {
          onTrackChangedRef.current?.({ ...trackRef.current, telemetry: liveTele });
        }
      }
    }
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (mode !== 'DRAW') return;
    const canvas = drawCanvasRef.current;
    if (canvas && canvas.hasPointerCapture(e.pointerId)) {
      canvas.releasePointerCapture(e.pointerId);
    }

    if (isPanningRef.current) {
      isPanningRef.current = false;
      return;
    }

    if (!isDrawingRef.current) return;
    isDrawingRef.current = false;

    if (rawPointsRef.current.length >= 6) {
      baseRawPointsRef.current = rawPointsRef.current.map((p) => ({ ...p }));
      const generated = generateTrackFromRawPoints(rawPointsRef.current, brushWidth, true, smoothingModeRef.current);
      if (generated) {
        trackRef.current = generated;
        onTrackChanged(generated);
        rebuild3DTrackMesh(generated);
        resetCarToStart(generated);
      }
    }
    drawDraftingCanvas();
  };

  const drawDraftingCanvas = useCallback(() => {
    const canvas = drawCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // 1. Blueprint background tinted by active environment
    const curEnv = ENVIRONMENTS[environmentRef.current] || ENVIRONMENTS.pacific_coast;
    const envBgColors: Record<string, string> = {
      pacific_coast: '#061726',
      kyoto_autumn: '#1b0e08',
      fuji_sakura: '#081324',
    };
    ctx.fillStyle = envBgColors[curEnv.id] || '#061726';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.save();
    const cx = canvas.width / 2;
    const cy = canvas.height / 2;
    const zoom = canvasZoomRef.current;
    const pan = canvasPanRef.current;

    // Apply viewport zoom & pan around canvas center
    ctx.translate(cx + pan.x, cy + pan.y);
    ctx.scale(zoom, zoom);
    ctx.translate(-cx, -cy);

    // Calculate visible world viewport boundaries
    const worldLeft = cx + (0 - (cx + pan.x)) / zoom - 200;
    const worldRight = cx + (canvas.width - (cx + pan.x)) / zoom + 200;
    const worldTop = cy + (0 - (cy + pan.y)) / zoom - 200;
    const worldBottom = cy + (canvas.height - (cy + pan.y)) / zoom + 200;

    // Minor grid lines every 25 world units (125m)
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.04)';
    ctx.lineWidth = Math.max(0.5, 0.8 / zoom);
    const minorStep = 25;
    const startMinorX = Math.floor(worldLeft / minorStep) * minorStep;
    const endMinorX = Math.ceil(worldRight / minorStep) * minorStep;
    const startMinorY = Math.floor(worldTop / minorStep) * minorStep;
    const endMinorY = Math.ceil(worldBottom / minorStep) * minorStep;

    ctx.beginPath();
    for (let x = startMinorX; x <= endMinorX; x += minorStep) {
      ctx.moveTo(x, worldTop);
      ctx.lineTo(x, worldBottom);
    }
    for (let y = startMinorY; y <= endMinorY; y += minorStep) {
      ctx.moveTo(worldLeft, y);
      ctx.lineTo(worldRight, y);
    }
    ctx.stroke();

    // Major grid lines every 100 world units (500m)
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.15)';
    ctx.lineWidth = Math.max(0.75, 1.2 / zoom);
    const majorStep = 100;
    const startMajorX = Math.floor(worldLeft / majorStep) * majorStep;
    const endMajorX = Math.ceil(worldRight / majorStep) * majorStep;
    const startMajorY = Math.floor(worldTop / majorStep) * majorStep;
    const endMajorY = Math.ceil(worldBottom / majorStep) * majorStep;

    ctx.beginPath();
    for (let x = startMajorX; x <= endMajorX; x += majorStep) {
      ctx.moveTo(x, worldTop);
      ctx.lineTo(x, worldBottom);
    }
    for (let y = startMajorY; y <= endMajorY; y += majorStep) {
      ctx.moveTo(worldLeft, y);
      ctx.lineTo(worldRight, y);
    }
    ctx.stroke();

    // Distance labels along grid (meters) - spaced appropriately for scale
    ctx.fillStyle = 'rgba(148, 163, 184, 0.45)';
    ctx.font = `${Math.max(9, Math.round(11 / zoom))}px monospace`;
    // Distance labels along grid (meters)
    ctx.fillStyle = 'rgba(148, 163, 184, 0.45)';
    ctx.font = `${Math.max(9, Math.round(11 / zoom))}px monospace`;
    ctx.textAlign = 'left';
    for (let x = startMajorX; x <= endMajorX; x += majorStep * 2) {
      ctx.fillText(`${x * 5}m`, x + 4 / zoom, cy + 16 / zoom);
    }
    for (let y = startMajorY; y <= endMajorY; y += majorStep * 2) {
      ctx.fillText(`${y * 5}m`, cx + 4 / zoom, y - 4 / zoom);
    }

    // Primary Canvas Boundary Outline (DRAFTING_WIDTH x DRAFTING_HEIGHT)
    ctx.strokeStyle = 'rgba(245, 158, 11, 0.35)';
    ctx.lineWidth = Math.max(1, 1.5 / zoom);
    ctx.setLineDash([8 / zoom, 8 / zoom]);
    ctx.strokeRect(0, 0, canvas.width, canvas.height);
    ctx.setLineDash([]);

    // Origin center marker
    ctx.fillStyle = '#f59e0b';
    ctx.beginPath();
    ctx.arc(cx, cy, Math.max(2.5, 3.5 / zoom), 0, Math.PI * 2);
    ctx.fill();

    // Optional user trace image
    if (traceImageRef.current) {
      ctx.drawImage(traceImageRef.current, 0, 0, canvas.width, canvas.height);
    }

    // Render Track Points
    const pts = rawPointsRef.current;
    if (pts.length > 1) {
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      // 0. Solid Boundary Crash Walls
      ctx.lineWidth = brushWidth + 24;
      ctx.strokeStyle = '#334155';
      ctx.beginPath();
      ctx.moveTo(pts[0].x, pts[0].y);
      for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
      ctx.stroke();

      // Outer safety barrier trim
      ctx.lineWidth = brushWidth + 20;
      ctx.strokeStyle = '#ef4444';
      ctx.stroke();

      // 1. Red & White Curbs outline
      ctx.lineWidth = brushWidth + 12;
      ctx.strokeStyle = '#b91c1c';
      ctx.stroke();

      // 2. Asphalt stroke
      ctx.lineWidth = brushWidth;
      ctx.strokeStyle = '#1e293b';
      ctx.stroke();

      // 3. Center dashed guide
      ctx.lineWidth = Math.max(1.5, 2.5 / zoom);
      ctx.setLineDash([12 / zoom, 14 / zoom]);
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.45)';
      ctx.stroke();
      ctx.setLineDash([]);

      // 4. White borders
      ctx.lineWidth = Math.max(1, 1.5 / zoom);
      ctx.strokeStyle = '#f8fafc';
      ctx.stroke();

      // 5. Start circle marker & direction
      ctx.fillStyle = '#10b981';
      ctx.beginPath();
      ctx.arc(pts[0].x, pts[0].y, Math.max(10, brushWidth * 0.45), 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#ffffff';
      ctx.font = `bold ${Math.max(9, Math.round(12 / zoom))}px monospace`;
      ctx.textAlign = 'center';
      ctx.fillText('START', pts[0].x, pts[0].y + 4 / zoom);
    }

    ctx.restore();

    // Bottom-right canvas interaction hint
    ctx.fillStyle = 'rgba(15, 23, 42, 0.75)';
    ctx.strokeStyle = 'rgba(51, 65, 85, 0.8)';
    ctx.lineWidth = 1;
    const hintW = 390;
    const hintH = 26;
    const hintX = canvas.width - hintW - 16;
    const hintY = canvas.height - hintH - 16;
    ctx.fillRect(hintX, hintY, hintW, hintH);
    ctx.strokeRect(hintX, hintY, hintW, hintH);

    ctx.fillStyle = '#94a3b8';
    ctx.font = '10px monospace';
    ctx.textAlign = 'left';
    ctx.fillText(
      `DRAW: Left-Drag • PAN: Right/Mid-Drag or Space • ZOOM: Wheel (${Math.round(zoom * 100)}%)`,
      hintX + 10,
      hintY + 17
    );
  }, [brushWidth]);

  // Native smooth wheel zoom handler attached directly to canvas
  useEffect(() => {
    const canvas = drawCanvasRef.current;
    if (!canvas || mode !== 'DRAW') return;

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = canvas.getBoundingClientRect();
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;
      const screenX = (e.clientX - rect.left) * scaleX;
      const screenY = (e.clientY - rect.top) * scaleY;

      const cx = canvas.width / 2;
      const cy = canvas.height / 2;
      const oldZoom = canvasZoomRef.current;
      const oldPan = canvasPanRef.current;

      const worldX = cx + (screenX - (cx + oldPan.x)) / oldZoom;
      const worldY = cy + (screenY - (cy + oldPan.y)) / oldZoom;

      const zoomFactor = e.deltaY < 0 ? 1.14 : 0.88;
      const newZoom = Math.min(2.5, Math.max(0.35, oldZoom * zoomFactor));

      const newPanX = screenX - cx - (worldX - cx) * newZoom;
      const newPanY = screenY - cy - (worldY - cy) * newZoom;

      canvasZoomRef.current = newZoom;
      canvasPanRef.current = { x: newPanX, y: newPanY };

      window.dispatchEvent(
        new CustomEvent('APEX_CANVAS_ZOOM_SYNC', {
          detail: { zoomPercent: Math.round(newZoom * 100) },
        })
      );

      drawDraftingCanvas();
    };

    canvas.addEventListener('wheel', onWheel, { passive: false });
    return () => {
      canvas.removeEventListener('wheel', onWheel);
    };
  }, [mode, drawDraftingCanvas]);

  // Reactively rebuild 2D & 3D track mesh whenever track width is adjusted
  const prevBrushWidthRef = useRef<number>(brushWidth);
  useEffect(() => {
    if (prevBrushWidthRef.current !== brushWidth) {
      prevBrushWidthRef.current = brushWidth;
      if (rawPointsRef.current.length >= 6) {
        const generated = generateTrackFromRawPoints(rawPointsRef.current, brushWidth, true, smoothingModeRef.current);
        if (generated) {
          trackRef.current = generated;
          onTrackChangedRef.current?.(generated);
          rebuild3DTrackMesh(generated);
          resetCarToStart(generated);
        }
      }
      drawDraftingCanvas();
    }
  }, [brushWidth, rebuild3DTrackMesh, resetCarToStart, drawDraftingCanvas]);

  // Reactively re-smooth and rebuild track whenever smoothing mode is changed
  const prevSmoothingModeRef = useRef<string>(smoothingMode || 'Normal');
  useEffect(() => {
    smoothingModeRef.current = smoothingMode || 'Normal';
    if (prevSmoothingModeRef.current !== (smoothingMode || 'Normal')) {
      prevSmoothingModeRef.current = smoothingMode || 'Normal';
      if (rawPointsRef.current.length >= 6) {
        const generated = generateTrackFromRawPoints(
          rawPointsRef.current,
          brushWidth,
          true,
          smoothingMode || 'Normal'
        );
        if (generated) {
          trackRef.current = generated;
          onTrackChangedRef.current?.(generated);
          rebuild3DTrackMesh(generated);
          resetCarToStart(generated);
        }
      }
      drawDraftingCanvas();
    }
  }, [smoothingMode, brushWidth, rebuild3DTrackMesh, resetCarToStart, drawDraftingCanvas]);

  // Sync 3D track whenever barrierDistance changes
  const prevBarrierDistRef = useRef<number>(barrierDistance);
  useEffect(() => {
    if (prevBarrierDistRef.current !== barrierDistance) {
      prevBarrierDistRef.current = barrierDistance;
      if (trackRef.current) {
        rebuild3DTrackMesh(trackRef.current);
      }
    }
  }, [barrierDistance, rebuild3DTrackMesh]);

  // Keep rawPoints and 3D track mesh synced when initialTrack changes from outside
  const prevInitialTrackRef = useRef<Track | null>(initialTrack || null);
  useEffect(() => {
    if (initialTrack && initialTrack !== prevInitialTrackRef.current) {
      const isInternal = initialTrack === trackRef.current;
      prevInitialTrackRef.current = initialTrack;
      if (!isInternal) {
        trackRef.current = initialTrack;
        if (initialTrack.rawPoints && initialTrack.rawPoints.length >= 5) {
          let pts = initialTrack.rawPoints;
          let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
          pts.forEach((p) => {
            if (p.x < minX) minX = p.x;
            if (p.x > maxX) maxX = p.x;
            if (p.y < minY) minY = p.y;
            if (p.y > maxY) maxY = p.y;
          });
          if (maxX - minX > 2800 || maxY - minY > 1800) {
            pts = normalizePointsToBoard(pts);
          }
          rawPointsRef.current = pts.map((p) => ({ ...p }));
          baseRawPointsRef.current = pts.map((p) => ({ ...p }));
        }
        rebuild3DTrackMesh(initialTrack);
        drawDraftingCanvas();
      }
    }
  }, [initialTrack, rebuild3DTrackMesh, drawDraftingCanvas]);

  useEffect(() => {
    if (mode === 'DRAW') {
      drawDraftingCanvas();
    }
  }, [mode, drawDraftingCanvas]);

  return (
    <div className="relative w-full h-full overflow-hidden bg-slate-950 select-none">
      {/* 3D WebGL Three.js Container */}
      <div ref={mountRef} className="w-full h-full block" />

      {/* 2D Freehand Drawing Overlay (Active in 'DRAW' Mode) */}
      {mode === 'DRAW' && (
        <canvas
          ref={drawCanvasRef}
          width={DRAFTING_WIDTH}
          height={DRAFTING_HEIGHT}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onContextMenu={(e) => e.preventDefault()}
          className="absolute inset-0 w-full h-full block cursor-crosshair touch-none z-10"
        />
      )}

      {/* 3D Starting Lights & Countdown Overlay */}
      {countdown !== null && (
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none bg-black/45 backdrop-blur-xs z-30 transition-opacity">
          <div className="flex items-center gap-3 px-6 py-4 rounded-2xl bg-slate-900/90 border border-slate-700 shadow-2xl">
            {[1, 2, 3].map((num) => {
              const isLit = countdown === 0 ? false : countdown <= 4 - num;
              return (
                <div
                  key={num}
                  className={`w-12 h-12 rounded-full border-2 border-slate-700 flex items-center justify-center transition-all ${
                    isLit
                      ? 'bg-rose-600 shadow-[0_0_25px_rgba(225,29,72,0.95)] scale-105'
                      : countdown === 0
                      ? 'bg-emerald-500 shadow-[0_0_30px_rgba(16,185,129,0.95)]'
                      : 'bg-slate-950'
                  }`}
                />
              );
            })}
          </div>
          <div
            className={`mt-4 text-6xl font-black tracking-wider uppercase font-mono ${
              countdown === 0 ? 'text-emerald-400 scale-125' : 'text-white'
            }`}
          >
            {countdown === 0 ? 'GO!' : countdown}
          </div>
        </div>
      )}

      {/* Small Track Map in Race Mode */}
      {mode === 'RACE' && trackRef.current && (
        <div className="absolute bottom-6 left-6 z-20 w-48 sm:w-52 h-36 sm:h-40 rounded-2xl bg-slate-950/85 border border-slate-700/80 backdrop-blur-md p-2.5 shadow-[0_12px_40px_rgba(0,0,0,0.85)] pointer-events-none select-none flex flex-col">
          <div className="flex items-center justify-between px-1 mb-1 shrink-0">
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
              <span className="text-[10px] font-mono font-bold tracking-wider text-slate-300 uppercase">
                TRACK MAP
              </span>
            </div>
            <span className="text-[9px] font-mono text-cyan-400 font-bold px-1.5 py-0.5 rounded bg-cyan-950/60 border border-cyan-800/60">
              LIVE
            </span>
          </div>
          <div className="relative flex-1 w-full h-full min-h-0">
            <canvas
              ref={minimapCanvasRef}
              width={200}
              height={130}
              className="w-full h-full block"
            />
          </div>
        </div>
      )}
    </div>
  );
};

// 60 FPS Canvas-rendered Mini-Map
function renderMiniMap(canvas: HTMLCanvasElement, track: Track, carState: CarState) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const w = canvas.width;
  const h = canvas.height;
  ctx.clearRect(0, 0, w, h);

  if (!track || !track.points || track.points.length < 3) return;

  const b = track.bounds;
  const pad = 26;
  const trackW = Math.max(10, b.maxX - b.minX + pad * 2);
  const trackH = Math.max(10, b.maxY - b.minY + pad * 2);

  const scale = Math.min((w - 18) / trackW, (h - 18) / trackH);
  const offsetX = (w - trackW * scale) / 2 - (b.minX - pad) * scale;
  const offsetY = (h - trackH * scale) / 2 - (b.minY - pad) * scale;

  // 1. Dark outer road base
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.lineWidth = 6;
  ctx.strokeStyle = '#090d16';
  ctx.beginPath();
  track.points.forEach((pt, i) => {
    const x = pt.x * scale + offsetX;
    const y = pt.y * scale + offsetY;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.closePath();
  ctx.stroke();

  // 2. Asphalt track path
  ctx.lineWidth = 3.5;
  ctx.strokeStyle = '#334155';
  ctx.stroke();

  // 3. Center line guideline
  ctx.lineWidth = 1;
  ctx.strokeStyle = '#64748b';
  ctx.setLineDash([3, 4]);
  ctx.stroke();
  ctx.setLineDash([]);

  // 4. Start / Finish Line
  const sX = track.startPoint.x * scale + offsetX;
  const sY = track.startPoint.y * scale + offsetY;
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(sX, sY, 3.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#0284c7';
  ctx.lineWidth = 1.2;
  ctx.stroke();

  // 5. Player Car Directional Arrowhead
  const cX = carState.x * scale + offsetX;
  const cY = carState.y * scale + offsetY;

  // Cyan glowing aura
  ctx.fillStyle = 'rgba(6, 182, 212, 0.4)';
  ctx.beginPath();
  ctx.arc(cX, cY, 8.5, 0, Math.PI * 2);
  ctx.fill();

  // Directional arrowhead pointing along car angle
  ctx.save();
  ctx.translate(cX, cY);
  ctx.rotate(carState.angle);

  ctx.beginPath();
  ctx.moveTo(7.5, 0);       // nose
  ctx.lineTo(-5.5, -4.5);   // left tail
  ctx.lineTo(-3, 0);        // rear notch
  ctx.lineTo(-5.5, 4.5);    // right tail
  ctx.closePath();

  ctx.fillStyle = '#06b6d4'; // Cyan core
  ctx.shadowColor = '#06b6d4';
  ctx.shadowBlur = 6;
  ctx.fill();

  ctx.shadowBlur = 0;
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 1.2;
  ctx.stroke();

  ctx.restore();
}
