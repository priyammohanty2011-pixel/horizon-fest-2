import * as THREE from 'three';
import { CarConfig } from '../types/game';

export interface Car3DInstance {
  group: THREE.Group;
  frontLeftWheel: THREE.Group;
  frontRightWheel: THREE.Group;
  rearLeftWheel: THREE.Mesh | THREE.Group;
  rearRightWheel: THREE.Mesh | THREE.Group;
  bodyMesh: THREE.Mesh;
  accentMesh: THREE.Mesh;
  brakeLightMat: THREE.MeshStandardMaterial;
  brakeLightLeft: THREE.Mesh;
  brakeLightRight: THREE.Mesh;
  headlightBeamL: THREE.SpotLight;
  headlightBeamR: THREE.SpotLight;
  flameMeshL: THREE.Mesh;
  flameMeshR: THREE.Mesh;
  flameLight: THREE.PointLight;
  rotorMats: THREE.MeshStandardMaterial[];
  updateWheels: (steerAngle: number, distanceTraveled: number) => void;
  setBraking: (isBraking: boolean, brakeGlow?: number) => void;
  setExhaustFlame: (active: boolean) => void;
  updateColor: (config: CarConfig) => void;
}

export function build3DCar(config: CarConfig, isGhost: boolean = false): Car3DInstance {
  const group = new THREE.Group();

  // Materials
  const bodyMaterial = isGhost
    ? new THREE.MeshBasicMaterial({
        color: 0x06b6d4,
        transparent: true,
        opacity: 0.42,
        wireframe: false,
      })
    : new THREE.MeshStandardMaterial({
        color: new THREE.Color(config.color),
        roughness: 0.25,
        metalness: 0.7,
      });

  const accentMaterial = isGhost
    ? new THREE.MeshBasicMaterial({
        color: 0x67e8f9,
        transparent: true,
        opacity: 0.55,
      })
    : new THREE.MeshStandardMaterial({
        color: new THREE.Color(config.accentColor),
        roughness: 0.3,
        metalness: 0.5,
      });

  const carbonMaterial = new THREE.MeshStandardMaterial({
    color: 0x111622,
    roughness: 0.5,
    metalness: 0.3,
  });

  const chromeMaterial = new THREE.MeshStandardMaterial({
    color: 0xd1d5db,
    roughness: 0.15,
    metalness: 0.95,
  });

  const glassMaterial = isGhost
    ? new THREE.MeshBasicMaterial({
        color: 0x22d3ee,
        transparent: true,
        opacity: 0.3,
      })
    : new THREE.MeshStandardMaterial({
        color: 0x090d16,
        roughness: 0.05,
        metalness: 0.95,
      });

  const tireMaterial = new THREE.MeshStandardMaterial({
    color: isGhost ? 0x0891b2 : 0x141416,
    roughness: 0.9,
    metalness: 0.05,
    transparent: isGhost,
    opacity: isGhost ? 0.3 : 1.0,
  });

  const rimMaterial = new THREE.MeshStandardMaterial({
    color: isGhost ? 0x67e8f9 : 0x94a3b8,
    roughness: 0.2,
    metalness: 0.85,
  });

  const caliperMaterial = new THREE.MeshStandardMaterial({
    color: 0xef4444, // Red Brembo style racing caliper
    roughness: 0.3,
    metalness: 0.6,
  });

  const brakeLightMat = new THREE.MeshStandardMaterial({
    color: 0x550000,
    emissive: 0x330000,
    roughness: 0.2,
  });

  // Rotor materials for dynamic heat glow under braking
  const rotorMats: THREE.MeshStandardMaterial[] = [];
  const createRotorMat = () => {
    const mat = new THREE.MeshStandardMaterial({
      color: 0x64748b,
      metalness: 0.9,
      roughness: 0.25,
      emissive: 0x000000,
    });
    rotorMats.push(mat);
    return mat;
  };

  // 1. CHASSIS / LOWER BODY (Sleek sports coupe wedge)
  const bodyGeom = new THREE.BoxGeometry(1.82, 0.44, 3.8);
  const bodyMesh = new THREE.Mesh(bodyGeom, bodyMaterial);
  bodyMesh.position.y = 0.44;
  bodyMesh.castShadow = !isGhost;
  bodyMesh.receiveShadow = !isGhost;
  group.add(bodyMesh);

  // 2. AERODYNAMIC SLOPING NOSE CONE & HOOD
  const noseGeom = new THREE.ConeGeometry(0.88, 1.5, 4);
  const noseMesh = new THREE.Mesh(noseGeom, bodyMaterial);
  noseMesh.rotation.x = Math.PI / 2;
  noseMesh.rotation.y = Math.PI / 4;
  noseMesh.position.set(0, 0.38, 2.22);
  noseMesh.scale.set(1.08, 1, 0.42);
  noseMesh.castShadow = !isGhost;
  group.add(noseMesh);

  // Hood air extraction scoop
  const hoodScoopGeom = new THREE.BoxGeometry(0.65, 0.05, 0.8);
  const hoodScoop = new THREE.Mesh(hoodScoopGeom, carbonMaterial);
  hoodScoop.position.set(0, 0.58, 1.3);
  group.add(hoodScoop);

  // 3. FRONT CARBON SPLITTER & CANARDS
  const splitterGeom = new THREE.BoxGeometry(2.14, 0.08, 0.75);
  const splitterMesh = new THREE.Mesh(splitterGeom, carbonMaterial);
  splitterMesh.position.set(0, 0.20, 2.32);
  group.add(splitterMesh);

  // Front dive planes / canards
  const canardL = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.03, 0.3), carbonMaterial);
  canardL.position.set(-1.05, 0.35, 2.1);
  canardL.rotation.z = -0.25;
  group.add(canardL);

  const canardR = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.03, 0.3), carbonMaterial);
  canardR.position.set(1.05, 0.35, 2.1);
  canardR.rotation.z = 0.25;
  group.add(canardR);

  // 4. COCKPIT GREENHOUSE CANOPY
  const cockpitGeom = new THREE.BoxGeometry(1.22, 0.45, 1.7);
  const cockpitMesh = new THREE.Mesh(cockpitGeom, glassMaterial);
  cockpitMesh.position.set(0, 0.82, -0.15);
  cockpitMesh.castShadow = !isGhost;
  group.add(cockpitMesh);

  // Windscreen A-pillar accents
  const roofLineGeom = new THREE.BoxGeometry(1.24, 0.04, 1.72);
  const roofLine = new THREE.Mesh(roofLineGeom, carbonMaterial);
  roofLine.position.set(0, 1.05, -0.15);
  group.add(roofLine);

  // Accent racing center roof stripe
  const accentGeom = new THREE.BoxGeometry(0.38, 0.03, 3.6);
  const accentMesh = new THREE.Mesh(accentGeom, accentMaterial);
  accentMesh.position.set(0, 0.74, 0.1);
  group.add(accentMesh);

  // 5. SIDE AIR INTAKE PODS
  const podGeom = new THREE.BoxGeometry(0.2, 0.34, 1.2);
  const podL = new THREE.Mesh(podGeom, carbonMaterial);
  podL.position.set(-0.95, 0.44, 0.1);
  group.add(podL);

  const podR = new THREE.Mesh(podGeom, carbonMaterial);
  podR.position.set(0.95, 0.44, 0.1);
  group.add(podR);

  // 6. REAR CARBON DIFFUSER & FINS
  const diffuserPlate = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.06, 0.9), carbonMaterial);
  diffuserPlate.position.set(0, 0.18, -1.75);
  diffuserPlate.rotation.x = -0.15;
  group.add(diffuserPlate);

  for (let finIdx = -2; finIdx <= 2; finIdx++) {
    const fin = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.22, 0.6), carbonMaterial);
    fin.position.set(finIdx * 0.38, 0.22, -1.82);
    fin.rotation.x = -0.15;
    group.add(fin);
  }

  // 7. REAR GT WING / SPOILER
  const wingPylonL = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.42, 0.32), carbonMaterial);
  wingPylonL.position.set(-0.55, 0.85, -1.7);
  group.add(wingPylonL);

  const wingPylonR = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.42, 0.32), carbonMaterial);
  wingPylonR.position.set(0.55, 0.85, -1.7);
  group.add(wingPylonR);

  const wingBlade = new THREE.Mesh(new THREE.BoxGeometry(2.26, 0.08, 0.52), bodyMaterial);
  wingBlade.position.set(0, 1.08, -1.75);
  wingBlade.rotation.x = -0.09;
  wingBlade.castShadow = !isGhost;
  group.add(wingBlade);

  // Wing Endplates
  const endplateL = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.38, 0.62), accentMaterial);
  endplateL.position.set(-1.13, 1.08, -1.75);
  group.add(endplateL);
  const endplateR = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.38, 0.62), accentMaterial);
  endplateR.position.set(1.13, 1.08, -1.75);
  group.add(endplateR);

  // 8. TWIN CHROME EXHAUST TIPS & 3D BACKFIRE FLAMES
  const exhaustGeom = new THREE.CylinderGeometry(0.09, 0.09, 0.35, 12);
  exhaustGeom.rotateX(Math.PI / 2);

  const exhaustTipL = new THREE.Mesh(exhaustGeom, chromeMaterial);
  exhaustTipL.position.set(-0.42, 0.36, -1.92);
  group.add(exhaustTipL);

  const exhaustTipR = new THREE.Mesh(exhaustGeom, chromeMaterial);
  exhaustTipR.position.set(0.42, 0.36, -1.92);
  group.add(exhaustTipR);

  // Backfire flame meshes (bursts during shift / redline)
  const flameGeom = new THREE.ConeGeometry(0.14, 0.75, 8);
  flameGeom.rotateX(-Math.PI / 2);
  const flameMat = new THREE.MeshBasicMaterial({
    color: 0x38bdf8,
    transparent: true,
    opacity: 0,
  });

  const flameMeshL = new THREE.Mesh(flameGeom, flameMat.clone());
  flameMeshL.position.set(-0.42, 0.36, -2.35);
  group.add(flameMeshL);

  const flameMeshR = new THREE.Mesh(flameGeom, flameMat.clone());
  flameMeshR.position.set(0.42, 0.36, -2.35);
  group.add(flameMeshR);

  const flameLight = new THREE.PointLight(0x38bdf8, 0, 12, 1.8);
  flameLight.position.set(0, 0.4, -2.3);
  group.add(flameLight);

  // 9. HIGH-PERFORMANCE WHEELS (With Brembo Calipers & Rotors)
  const wheelGeom = new THREE.CylinderGeometry(0.38, 0.38, 0.34, 16);
  wheelGeom.rotateZ(Math.PI / 2);

  const rimGeom = new THREE.CylinderGeometry(0.24, 0.24, 0.35, 10);
  rimGeom.rotateZ(Math.PI / 2);

  const rotorGeom = new THREE.CylinderGeometry(0.27, 0.27, 0.06, 12);
  rotorGeom.rotateZ(Math.PI / 2);

  const caliperGeom = new THREE.BoxGeometry(0.12, 0.16, 0.14);

  const createDetailedWheel = () => {
    const wGroup = new THREE.Group();
    const tire = new THREE.Mesh(wheelGeom, tireMaterial);
    tire.castShadow = !isGhost;
    const rim = new THREE.Mesh(rimGeom, rimMaterial);
    wGroup.add(tire);
    wGroup.add(rim);

    // Metal brake rotor
    const rotorMat = createRotorMat();
    const rotor = new THREE.Mesh(rotorGeom, rotorMat);
    wGroup.add(rotor);

    // Brembo Red Brake Caliper
    const caliper = new THREE.Mesh(caliperGeom, caliperMaterial);
    caliper.position.set(0, 0.18, 0.12);
    wGroup.add(caliper);

    return wGroup;
  };

  // Front Left Wheel (with steer pivot)
  const frontLeftPivot = new THREE.Group();
  frontLeftPivot.position.set(-1.14, 0.38, 1.4);
  const flMesh = createDetailedWheel();
  frontLeftPivot.add(flMesh);
  group.add(frontLeftPivot);

  // Front Right Wheel (with steer pivot)
  const frontRightPivot = new THREE.Group();
  frontRightPivot.position.set(1.14, 0.38, 1.4);
  const frMesh = createDetailedWheel();
  frontRightPivot.add(frMesh);
  group.add(frontRightPivot);

  // Rear Left Wheel
  const rearLeftMesh = createDetailedWheel();
  rearLeftMesh.position.set(-1.10, 0.38, -1.3);
  group.add(rearLeftMesh);

  // Rear Right Wheel
  const rearRightMesh = createDetailedWheel();
  rearRightMesh.position.set(1.10, 0.38, -1.3);
  group.add(rearRightMesh);

  // 10. REAR HORIZON OLED TAILLIGHT BLADE
  const bladeGeom = new THREE.BoxGeometry(1.65, 0.07, 0.07);
  const brakeLightLeft = new THREE.Mesh(bladeGeom, brakeLightMat);
  brakeLightLeft.position.set(0, 0.54, -1.91);
  group.add(brakeLightLeft);
  const brakeLightRight = brakeLightLeft; // Unified full-width light blade

  // 11. FRONT LED HEADLIGHTS & LIGHT BEAMS
  const hlBladeGeom = new THREE.BoxGeometry(0.40, 0.08, 0.12);
  const hlMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    emissive: 0x67e8f9,
    roughness: 0.1,
  });
  const hlL = new THREE.Mesh(hlBladeGeom, hlMat);
  hlL.position.set(-0.68, 0.40, 2.42);
  hlL.rotation.y = -0.15;
  group.add(hlL);

  const hlR = new THREE.Mesh(hlBladeGeom, hlMat);
  hlR.position.set(0.68, 0.40, 2.42);
  hlR.rotation.y = 0.15;
  group.add(hlR);

  // Forward Spotlights
  const headlightBeamL = new THREE.SpotLight(0xf8fafc, 1.4, 60, Math.PI / 6.5, 0.4, 1.2);
  headlightBeamL.position.set(-0.68, 0.45, 2.4);
  headlightBeamL.target.position.set(-0.68, 0, 32);
  group.add(headlightBeamL);
  group.add(headlightBeamL.target);

  const headlightBeamR = new THREE.SpotLight(0xf8fafc, 1.4, 60, Math.PI / 6.5, 0.4, 1.2);
  headlightBeamR.position.set(0.68, 0.45, 2.4);
  headlightBeamR.target.position.set(0.68, 0, 32);
  group.add(headlightBeamR);
  group.add(headlightBeamR.target);

  if (isGhost) {
    headlightBeamL.intensity = 0;
    headlightBeamR.intensity = 0;
  }

  // Underbody contact shadow plane
  if (!isGhost) {
    const shadowGeom = new THREE.PlaneGeometry(2.5, 4.5);
    shadowGeom.rotateX(-Math.PI / 2);
    const shadowMat = new THREE.MeshBasicMaterial({
      color: 0x000000,
      transparent: true,
      opacity: 0.5,
    });
    const shadowMesh = new THREE.Mesh(shadowGeom, shadowMat);
    shadowMesh.position.y = 0.03;
    group.add(shadowMesh);
  }

  // Animation helper
  const updateWheels = (steerAngle: number, distanceTraveled: number) => {
    // Steer front wheel pivots smoothly in steer direction
    frontLeftPivot.rotation.y = steerAngle;
    frontRightPivot.rotation.y = steerAngle;

    // Spin wheels according to distance
    const wheelRot = distanceTraveled / 0.38;
    flMesh.rotation.x = wheelRot;
    frMesh.rotation.x = wheelRot;
    rearLeftMesh.rotation.x = wheelRot;
    rearRightMesh.rotation.x = wheelRot;
  };

  const setBraking = (isBraking: boolean, brakeGlow: number = 0) => {
    if (isGhost) return;
    if (isBraking) {
      brakeLightMat.color.setHex(0xff0022);
      brakeLightMat.emissive.setHex(0xff0022);
    } else {
      brakeLightMat.color.setHex(0x550000);
      brakeLightMat.emissive.setHex(0x220000);
    }

    // Dynamic glowing hot brake rotors under heavy braking
    if (brakeGlow > 0.05) {
      rotorMats.forEach((mat) => {
        mat.emissive.setHex(0xff3300);
        mat.emissiveIntensity = brakeGlow * 2.2;
      });
    } else {
      rotorMats.forEach((mat) => {
        mat.emissive.setHex(0x000000);
        mat.emissiveIntensity = 0;
      });
    }
  };

  const setExhaustFlame = (active: boolean) => {
    if (isGhost) return;
    const matL = flameMeshL.material as THREE.MeshBasicMaterial;
    const matR = flameMeshR.material as THREE.MeshBasicMaterial;
    if (active) {
      const isElectricBlue = Math.random() > 0.5;
      const flameColor = isElectricBlue ? 0x38bdf8 : 0xf97316;
      matL.color.setHex(flameColor);
      matR.color.setHex(flameColor);
      matL.opacity = 0.85;
      matR.opacity = 0.85;
      flameLight.color.setHex(flameColor);
      flameLight.intensity = 3.5;
      const stretch = 0.8 + Math.random() * 0.5;
      flameMeshL.scale.set(1, stretch, 1);
      flameMeshR.scale.set(1, stretch, 1);
    } else {
      matL.opacity = 0;
      matR.opacity = 0;
      flameLight.intensity = 0;
    }
  };

  const updateColor = (newConfig: CarConfig) => {
    if (isGhost) return;
    (bodyMesh.material as THREE.MeshStandardMaterial).color.set(newConfig.color);
    wingBlade.material = bodyMesh.material;
    (accentMesh.material as THREE.MeshStandardMaterial).color.set(newConfig.accentColor);
    endplateL.material = accentMesh.material;
    endplateR.material = accentMesh.material;
  };

  return {
    group,
    frontLeftWheel: frontLeftPivot,
    frontRightWheel: frontRightPivot,
    rearLeftWheel: rearLeftMesh,
    rearRightWheel: rearRightMesh,
    bodyMesh,
    accentMesh,
    brakeLightMat,
    brakeLightLeft,
    brakeLightRight,
    headlightBeamL,
    headlightBeamR,
    flameMeshL,
    flameMeshR,
    flameLight,
    rotorMats,
    updateWheels,
    setBraking,
    setExhaustFlame,
    updateColor,
  };
}
