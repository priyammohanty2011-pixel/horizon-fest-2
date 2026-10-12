import { CarConfig, CarState, Particle, Point2D, SkidMark, Track } from '../types/game';
import { getCarTrackStatus } from './spline';
import { sound } from './audio';

export const CAR_CONFIGS: CarConfig[] = [
  {
    id: 'formula',
    name: 'Horizon F1',
    category: 'Formula Single-Seater',
    color: '#06b6d4', // Cyan
    accentColor: '#38bdf8',
    topSpeed: 400, // 400 KM/H Racing Speed Limit
    accel: 165,    // Punchy 1000HP formula acceleration
    brakeForce: 290, // Carbon-ceramic race brakes
    handling: 4.0, // Ultra-responsive apex carving
    driftGrip: 0.94,
    offroadPenalty: 0.35,
  },
  {
    id: 'gt',
    name: 'GT Sprint',
    category: 'Super GT Coupe',
    color: '#ef4444', // Crimson Red
    accentColor: '#f97316',
    topSpeed: 400, // 400 KM/H Super GT Speed Limit
    accel: 150,    // Twin-turbo V8 race burst
    brakeForce: 260, // Competition Brembo brakes
    handling: 3.8, // Agile, balanced sports car
    driftGrip: 0.89,
    offroadPenalty: 0.4,
  },
  {
    id: 'drift',
    name: 'Drift Spec-R',
    category: 'Tuner Drift Machine',
    color: '#a855f7', // Electric Violet
    accentColor: '#ec4899',
    topSpeed: 395, // 395 KM/H High-power drift setup
    accel: 145,    // High boost torque
    brakeForce: 250,
    handling: 4.2, // Sharp flick turn-in
    driftGrip: 0.82, // Slides easily with Space
    offroadPenalty: 0.45,
  },
  {
    id: 'hyper',
    name: 'Hyper Velocity',
    category: 'Prototype Le Mans',
    color: '#eab308', // Neon Gold
    accentColor: '#fbbf24',
    topSpeed: 405, // 405 KM/H Le Mans Hypercar
    accel: 175,    // Quad-turbo hybrid sprint
    brakeForce: 300,
    handling: 3.6, // High speed aero stability
    driftGrip: 0.92,
    offroadPenalty: 0.32,
  },
];

export interface ControlInputs {
  throttle: number; // 0 to 1
  brake: number;    // 0 to 1
  steer: number;    // -1 (left) to 1 (right)
  handbrake: boolean;
}

export function createInitialCarState(startPoint: Point2D, startAngle: number): CarState {
  return {
    x: startPoint.x,
    y: startPoint.y,
    vx: 0,
    vy: 0,
    angle: startAngle,
    angularVelocity: 0,
    speed: 0,
    lateralSlip: 0,
    isDrifting: false,
    isOffroad: false,
    steerAngle: 0,
    rpm: 0.15,
    throttle: 0,
    brake: 0,
    bodyRoll: 0,
    bodyPitch: 0,
    gear: 1,
    driftScore: 0,
    driftMultiplier: 1.0,
    exhaustFlame: false,
    turboBoost: 0,
    brakeGlow: 0,
  };
}

export function updateCarPhysics(
  car: CarState,
  inputs: ControlInputs,
  config: CarConfig,
  track: Track | null,
  dt: number,
  skidMarks: SkidMark[],
  particles: Particle[]
): CarState {
  const clampedDt = Math.min(dt, 0.05);

  // 1. Surface check (Tarmac vs Kerb vs Grass)
  let isOffroad = false;
  let isOnCurb = false;
  if (track) {
    const status = getCarTrackStatus({ x: car.x, y: car.y }, track);
    isOffroad = status.isOffroad;
    isOnCurb = status.isOnCurb;
  }

  // Decompose current velocity into forward and lateral vectors
  const forwardX = Math.cos(car.angle);
  const forwardY = Math.sin(car.angle);
  const lateralX = -Math.sin(car.angle);
  const lateralY = Math.cos(car.angle);

  let forwardSpeed = car.vx * forwardX + car.vy * forwardY;
  let lateralSpeed = car.vx * lateralX + car.vy * lateralY;
  const currentSpeed = Math.hypot(forwardSpeed, lateralSpeed);

  // ---------------------------------------------------------------------------
  // 2. STEERING & TURNING ANIMATION
  // ---------------------------------------------------------------------------
  // Full, prominent steering lock for crisp visible wheel turning animation (~26 degrees)
  const maxSteerLock = 0.45;
  const targetSteerAngle = inputs.steer * maxSteerLock;

  // Steering rack smoothing: snappy build-up and instant self-centering
  const rackSpeed = inputs.steer !== 0 ? 14.0 : 18.0;
  const steerAngle = car.steerAngle + (targetSteerAngle - car.steerAngle) * Math.min(1.0, rackSpeed * clampedDt);

  // Direct, agile turning rate tailored for custom user-drawn circuits
  // When car is at a standstill without throttle/brake, lock yawing so it doesn't spin in place.
  // As soon as the car moves or is given throttle/brake, give immediate, nimble turning authority.
  let speedScaling = 0;
  if (currentSpeed > 1.0 || inputs.throttle > 0 || inputs.brake > 0) {
    speedScaling = Math.min(1.0, Math.max(0.60, currentSpeed / 22.0));
  }
  const highSpeedFactor = Math.max(0.75, 1.0 - (currentSpeed / (config.topSpeed * 1.3)) * 0.25);

  let turnRate = inputs.steer * config.handling * speedScaling * highSpeedFactor;

  // Handbrake enables sharp rotation for hairpins and drift initiation
  if (inputs.handbrake && currentSpeed > 25) {
    turnRate *= 1.40;
  }

  // Invert steering when reversing
  if (forwardSpeed < -5) {
    turnRate = -turnRate;
  }

  car.angle += turnRate * clampedDt;

  // ---------------------------------------------------------------------------
  // 3. ACCELERATION & THROTTLE
  // ---------------------------------------------------------------------------
  let maxForwardSpeed = config.topSpeed;
  let accelRate = config.accel;

  if (isOffroad) {
    maxForwardSpeed *= config.offroadPenalty;
    accelRate *= 0.55;
  } else if (isOnCurb) {
    maxForwardSpeed *= 0.96;
  }

  if (inputs.throttle > 0) {
    forwardSpeed += inputs.throttle * accelRate * clampedDt;
    if (forwardSpeed > maxForwardSpeed) {
      forwardSpeed = Math.max(maxForwardSpeed, forwardSpeed - 45 * clampedDt);
    }
  }

  // ---------------------------------------------------------------------------
  // 4. BRAKING & REVERSE
  // ---------------------------------------------------------------------------
  if (inputs.brake > 0) {
    if (forwardSpeed > 15) {
      forwardSpeed -= inputs.brake * config.brakeForce * clampedDt;
      if (forwardSpeed < 0) forwardSpeed = 0;
    } else {
      // Reverse gear (max ~65 km/h)
      const maxReverse = 65;
      forwardSpeed -= inputs.brake * (config.accel * 0.6) * clampedDt;
      if (forwardSpeed < -maxReverse) forwardSpeed = -maxReverse;
    }
  }

  // Handbrake friction
  if (inputs.handbrake) {
    forwardSpeed *= Math.pow(0.92, clampedDt * 60);
  }

  // Rolling resistance
  const rollingFriction = isOffroad ? 0.92 : isOnCurb ? 0.985 : 0.994;
  forwardSpeed *= Math.pow(rollingFriction, clampedDt * 60);

  // ---------------------------------------------------------------------------
  // 5. LATERAL TIRE GRIP & DRIFTING
  // ---------------------------------------------------------------------------
  // Solid track grip so the car stays planted through corners
  let lateralRetention = config.driftGrip;

  // Handbrake allows breaking rear traction for fun, controlled slides
  if (inputs.handbrake) {
    lateralRetention *= 0.70;
  }

  const lateralSlip = Math.abs(lateralSpeed);
  const isDrifting = (lateralSlip > 30 || inputs.handbrake) && currentSpeed > 35;

  if (isDrifting) {
    lateralRetention = Math.max(0.76, lateralRetention * 0.90);
  }

  lateralSpeed *= Math.pow(lateralRetention, clampedDt * 60);

  // Reconstruct world velocity (calibrated in real KM/H)
  let finalVx = forwardSpeed * Math.cos(car.angle) + lateralSpeed * (-Math.sin(car.angle));
  let finalVy = forwardSpeed * Math.sin(car.angle) + lateralSpeed * Math.cos(car.angle);

  // Scale to canvas pixels: 2.4 px/s per km/h for exhilarating real-racing speed feel
  const KMH_TO_CANVAS_SPEED = 2.4;
  const worldVx = finalVx * KMH_TO_CANVAS_SPEED;
  const worldVy = finalVy * KMH_TO_CANVAS_SPEED;

  const prevX = car.x;
  const prevY = car.y;
  let newX = car.x + worldVx * clampedDt;
  let newY = car.y + worldVy * clampedDt;

  // ---------------------------------------------------------------------------
  // 6. BOUNDARY WALL DEFLECTION
  // ---------------------------------------------------------------------------
  if (track) {
    const postStatus = getCarTrackStatus({ x: newX, y: newY }, track);
    if (postStatus.isHitBoundary) {
      const near = postStatus.nearestPoint;
      const dx = near.x - newX;
      const dy = near.y - newY;
      const dLen = Math.hypot(dx, dy) || 1;
      const nx = dx / dLen;
      const ny = dy / dLen;

      newX = near.x - nx * (postStatus.boundaryLimit - 0.4);
      newY = near.y - ny * (postStatus.boundaryLimit - 0.4);

      const vDot = finalVx * nx + finalVy * ny;
      if (vDot < 0) {
        const vNormalX = vDot * nx;
        const vNormalY = vDot * ny;
        const vTangentX = finalVx - vNormalX;
        const vTangentY = finalVy - vNormalY;

        // Smooth deflection along the barrier wall without sticky dead stops
        finalVx = vTangentX * 0.84 - vNormalX * 0.32;
        finalVy = vTangentY * 0.84 - vNormalY * 0.32;

        const impactSpeed = Math.abs(vDot);
        if (impactSpeed > 20) {
          sound.playWallImpact(Math.min(1.0, impactSpeed / 140));
          for (let s = 0; s < 4; s++) {
            particles.push({
              x: newX,
              y: newY,
              vx: (Math.random() - 0.5) * 100 + nx * 50,
              vy: (Math.random() - 0.5) * 100 + ny * 50,
              life: 0.25,
              maxLife: 0.25,
              size: 2.6,
              color: '#f59e0b',
              type: 'spark',
            });
          }
        }
      }
    }
  }

  const updatedSpeed = Math.hypot(finalVx, finalVy);

  // ---------------------------------------------------------------------------
  // 7. CHASSIS BODY ROLL & PITCH ANIMATION
  // ---------------------------------------------------------------------------
  // Chassis leans outward dynamically into turns based on steering and speed
  const lateralG = (forwardSpeed * turnRate) / 600;
  const targetRoll = Math.max(-0.08, Math.min(0.08, lateralG * 0.08));
  const bodyRoll = (car.bodyRoll || 0) + (targetRoll - (car.bodyRoll || 0)) * Math.min(1.0, 12.0 * clampedDt);

  // Longitudinal squat on throttle, dive on braking
  const targetPitch = inputs.throttle > 0 ? 0.022 * inputs.throttle : inputs.brake > 0 ? -0.040 * inputs.brake : 0;
  const bodyPitch = (car.bodyPitch || 0) + (targetPitch - (car.bodyPitch || 0)) * Math.min(1.0, 8.0 * clampedDt);

  // ---------------------------------------------------------------------------
  // 8. TIRE SKID MARKS & PARTICLES
  // ---------------------------------------------------------------------------
  if (isDrifting && updatedSpeed > 40) {
    const rearDist = -16;
    const halfTrackWidth = 10;
    const carCos = Math.cos(car.angle);
    const carSin = Math.sin(car.angle);

    const leftWheelX1 = prevX + rearDist * carCos - halfTrackWidth * carSin;
    const leftWheelY1 = prevY + rearDist * carSin + halfTrackWidth * carCos;
    const leftWheelX2 = newX + rearDist * carCos - halfTrackWidth * carSin;
    const leftWheelY2 = newY + rearDist * carSin + halfTrackWidth * carCos;

    const rightWheelX1 = prevX + rearDist * carCos + halfTrackWidth * carSin;
    const rightWheelY1 = prevY + rearDist * carSin - halfTrackWidth * carCos;
    const rightWheelX2 = newX + rearDist * carCos + halfTrackWidth * carSin;
    const rightWheelY2 = newY + rearDist * carSin - halfTrackWidth * carCos;

    const skidAlpha = Math.min(0.55, (lateralSlip / 120) * 0.45 + (inputs.handbrake ? 0.3 : 0.1));

    skidMarks.push({
      x1: leftWheelX1,
      y1: leftWheelY1,
      x2: leftWheelX2,
      y2: leftWheelY2,
      alpha: skidAlpha,
      width: 4,
    });

    skidMarks.push({
      x1: rightWheelX1,
      y1: rightWheelY1,
      x2: rightWheelX2,
      y2: rightWheelY2,
      alpha: skidAlpha,
      width: 4,
    });

    // Tire smoke particles
    if (Math.random() < 0.65) {
      particles.push({
        x: (leftWheelX2 + rightWheelX2) / 2 + (Math.random() - 0.5) * 6,
        y: (leftWheelY2 + rightWheelY2) / 2 + (Math.random() - 0.5) * 6,
        vx: (Math.random() - 0.5) * 25 - worldVx * 0.15,
        vy: (Math.random() - 0.5) * 25 - worldVy * 0.15,
        life: 0.45,
        maxLife: 0.45,
        size: 3.2 + Math.random() * 4.8,
        color: 'rgba(230, 235, 245, 0.45)',
        type: 'smoke',
      });
    }
  }

  // Off-road grass particles
  if (isOffroad && updatedSpeed > 30 && Math.random() < 0.7) {
    particles.push({
      x: car.x + (Math.random() - 0.5) * 16,
      y: car.y + (Math.random() - 0.5) * 16,
      vx: (Math.random() - 0.5) * 60 - worldVx * 0.25,
      vy: (Math.random() - 0.5) * 60 - worldVy * 0.25,
      life: 0.5,
      maxLife: 0.5,
      size: 2.5 + Math.random() * 3.5,
      color: Math.random() > 0.4 ? 'rgba(52, 120, 58, 0.7)' : 'rgba(140, 110, 65, 0.7)',
      type: 'grass',
    });
  }

  // Exhaust particles on hard acceleration
  if (inputs.throttle > 0.7 && updatedSpeed > 25 && Math.random() < 0.4) {
    const exhaustX = newX - 18 * Math.cos(car.angle);
    const exhaustY = newY - 18 * Math.sin(car.angle);
    particles.push({
      x: exhaustX,
      y: exhaustY,
      vx: -Math.cos(car.angle) * 45 + (Math.random() - 0.5) * 10,
      vy: -Math.sin(car.angle) * 45 + (Math.random() - 0.5) * 10,
      life: 0.25,
      maxLife: 0.25,
      size: 2 + Math.random() * 3,
      color: Math.random() > 0.3 ? 'rgba(249, 115, 22, 0.85)' : 'rgba(234, 179, 8, 0.85)',
      type: 'exhaust',
    });
  }

  // ---------------------------------------------------------------------------
  // 9. 6-SPEED TRANSMISSION, GEARS & RACING RPM SIMULATION
  // ---------------------------------------------------------------------------
  // Authentic 6-Speed Racing Transmission (Calibrated for 400 KM/H)
  const gearSpeeds = [
    { min: 0,   max: 90 },                      // Gear 1: 0 - 90 km/h (violent launch)
    { min: 68,  max: 165 },                     // Gear 2: 68 - 165 km/h (hairpins)
    { min: 140, max: 240 },                     // Gear 3: 140 - 240 km/h (mid corners)
    { min: 215, max: 310 },                     // Gear 4: 215 - 310 km/h (fast sweepers)
    { min: 285, max: 365 },                     // Gear 5: 285 - 365 km/h (straight buildup)
    { min: 345, max: config.topSpeed },        // Gear 6: 345 - 400+ km/h (screaming top speed)
  ];

  let currentGear = car.gear || 1;
  const isReverse = forwardSpeed < -2;

  if (isReverse) {
    currentGear = -1; // Reverse gear
  } else {
    if (currentGear === -1) currentGear = 1;

    // Check automatic upshift
    if (currentGear < 6 && forwardSpeed > gearSpeeds[currentGear - 1].max * 0.94) {
      currentGear++;
      sound.playShiftPop();
    }
    // Check automatic downshift with rev match
    else if (currentGear > 1 && forwardSpeed < gearSpeeds[currentGear - 1].min * 0.88) {
      currentGear--;
    }
  }

  // Calculate dynamic RPM in current gear
  let targetRpm = 0.20; // ~1,800 RPM idle rumble
  if (isReverse) {
    const revRatio = Math.min(1.0, Math.abs(forwardSpeed) / 65);
    targetRpm = 0.25 + revRatio * 0.65;
  } else if (currentSpeed < 4.0 && inputs.throttle > 0) {
    // Launch control / standstill burnout free revving
    targetRpm = 0.62 + inputs.throttle * 0.30 + (Math.sin(Date.now() * 0.03) * 0.04);
  } else {
    const curGearInfo = gearSpeeds[Math.max(0, Math.min(5, currentGear - 1))];
    const gearSpan = curGearInfo.max - curGearInfo.min || 1;
    const gearProgress = Math.max(0, Math.min(1, (forwardSpeed - curGearInfo.min) / gearSpan));
    targetRpm = 0.25 + gearProgress * 0.70;
    if (inputs.throttle > 0.8 && gearProgress > 0.92) {
      targetRpm = Math.min(0.98, targetRpm + 0.04);
    }
  }

  // Smooth RPM response
  const rpmSpeed = inputs.throttle > 0 ? 14.0 : 8.0;
  const rpm = (car.rpm || 0.20) + (targetRpm - (car.rpm || 0.20)) * Math.min(1.0, rpmSpeed * clampedDt);

  // Exhaust backfire flame active on hard upshift or lift-off at high RPM
  const isShiftFlame = currentGear > (car.gear || 1);
  const isDecelPop = inputs.throttle === 0 && car.throttle > 0.6 && (car.rpm || 0) > 0.68;
  const exhaustFlame = isShiftFlame || isDecelPop;
  if (isDecelPop && Math.random() < 0.25) {
    sound.playShiftPop();
  }

  // Dynamic brake rotor heat glow
  let brakeGlow = (car.brakeGlow || 0);
  if (inputs.brake > 0 && updatedSpeed > 25) {
    brakeGlow = Math.min(1.0, brakeGlow + inputs.brake * 1.8 * clampedDt);
  } else {
    brakeGlow = Math.max(0.0, brakeGlow - 0.75 * clampedDt); // Cools down
  }

  // Drift Score Accumulation
  let driftScore = car.driftScore || 0;
  let driftMultiplier = car.driftMultiplier || 1.0;
  if (isDrifting && updatedSpeed > 35) {
    driftMultiplier = Math.min(4.0, driftMultiplier + 0.35 * clampedDt);
    driftScore += Math.round(lateralSlip * 18 * clampedDt * driftMultiplier);
  } else if (!isDrifting && !inputs.handbrake && lateralSlip < 15) {
    // Reset multiplier when exiting drift cleanly
    driftMultiplier = 1.0;
  }

  return {
    x: newX,
    y: newY,
    vx: finalVx,
    vy: finalVy,
    angle: car.angle,
    angularVelocity: turnRate,
    speed: updatedSpeed,
    lateralSlip,
    isDrifting,
    isOffroad,
    steerAngle, // Prominent, responsive steering angle (~0.45 rad) for clear turning animation
    rpm,
    throttle: inputs.throttle,
    brake: inputs.brake,
    bodyRoll,
    bodyPitch,
    gear: currentGear,
    driftScore,
    driftMultiplier,
    exhaustFlame,
    turboBoost: Math.min(1.0, inputs.throttle * (rpm / 0.9)),
    brakeGlow,
  };
}
