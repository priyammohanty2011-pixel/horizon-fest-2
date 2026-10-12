import * as THREE from 'three';
import { EnvironmentConfig } from './environments';

/**
 * Procedural textures and materials for Horizon Fest 2 3D World
 * 100% self-contained, no external CDN dependencies
 */

// Road tarmac texture with edge lines and center dashed line
export function createRoadTexture(width: number = 512, height: number = 512): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;

  // Dark charcoal asphalt
  ctx.fillStyle = '#1c212a';
  ctx.fillRect(0, 0, width, height);

  // Subtle tarmac noise/grain
  const imgData = ctx.getImageData(0, 0, width, height);
  const data = imgData.data;
  for (let i = 0; i < data.length; i += 4) {
    const noise = (Math.random() - 0.5) * 14;
    data[i] = Math.min(255, Math.max(0, data[i] + noise));
    data[i + 1] = Math.min(255, Math.max(0, data[i + 1] + noise));
    data[i + 2] = Math.min(255, Math.max(0, data[i + 2] + noise));
  }
  ctx.putImageData(imgData, 0, 0);

  // Rubber racing groove (darker center paths)
  ctx.fillStyle = 'rgba(15, 18, 24, 0.45)';
  ctx.fillRect(width * 0.18, 0, width * 0.64, height);

  // Outer solid white boundary lines
  ctx.fillStyle = '#f8fafc';
  ctx.fillRect(width * 0.04, 0, 8, height);
  ctx.fillRect(width * 0.96 - 8, 0, 8, height);

  // Center dashed white line
  ctx.fillStyle = 'rgba(255, 255, 255, 0.45)';
  const dashH = 48;
  const gapH = 36;
  const dashW = 6;
  const centerX = width / 2 - dashW / 2;
  for (let y = 0; y < height; y += dashH + gapH) {
    ctx.fillRect(centerX, y, dashW, dashH);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  return texture;
}

// Red and white curbs (kerbs) texture
export function createKerbTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;

  const halfH = canvas.height / 2;
  // Red top half
  ctx.fillStyle = '#ef4444';
  ctx.fillRect(0, 0, canvas.width, halfH);
  // White bottom half
  ctx.fillStyle = '#f8fafc';
  ctx.fillRect(0, halfH, canvas.width, halfH);

  // Subtle diagonal kerb bevel lines
  ctx.strokeStyle = 'rgba(0,0,0,0.15)';
  ctx.lineWidth = 4;
  for (let y = -50; y < canvas.height + 50; y += 30) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(canvas.width, y + 40);
    ctx.stroke();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  return texture;
}

// Track boundary safety barriers / HORIZON Motorsport circuit crash wall texture
export function createBarrierTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;

  const panelW = 512; // 2 distinct 512px panels: Obsidian Cyan HORIZON & Racing Red HORIZON

  // -------------------------------------------------------------------------
  // 1. PANEL 1 (X: 0 - 512): Obsidian Carbon & Electric Cyan HORIZON
  // -------------------------------------------------------------------------
  // Dark carbon base gradient
  const carbonGrad = ctx.createLinearGradient(0, 0, 0, canvas.height);
  carbonGrad.addColorStop(0, '#090d16');
  carbonGrad.addColorStop(0.5, '#0f172a');
  carbonGrad.addColorStop(1, '#060911');
  ctx.fillStyle = carbonGrad;
  ctx.fillRect(0, 0, panelW, canvas.height);

  // Diagonal carbon fiber weave pattern
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.04)';
  ctx.lineWidth = 2;
  for (let x = -canvas.height; x < panelW + canvas.height; x += 14) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x + canvas.height, canvas.height);
    ctx.stroke();
  }

  // Neon racing accent guide stripes
  ctx.fillStyle = '#06b6d4'; // Electric Cyan top pin-stripe
  ctx.fillRect(0, 36, panelW, 4);
  ctx.fillStyle = '#f97316'; // Sunset Orange bottom pin-stripe
  ctx.fillRect(0, 214, panelW, 4);

  // Forward-pointing speed arrows >>> (pointing right in race direction)
  const drawForwardArrows = (startX: number, y: number, color: string, count: number = 3) => {
    ctx.fillStyle = color;
    for (let c = 0; c < count; c++) {
      const cx = startX + c * 16;
      ctx.beginPath();
      ctx.moveTo(cx, y - 22);
      ctx.lineTo(cx + 10, y - 22);
      ctx.lineTo(cx + 18, y);
      ctx.lineTo(cx + 10, y + 22);
      ctx.lineTo(cx, y + 22);
      ctx.lineTo(cx + 8, y);
      ctx.closePath();
      ctx.fill();
    }
  };

  // Left & Right Arrows for Panel 1
  drawForwardArrows(24, 126, '#06b6d4', 3);
  drawForwardArrows(panelW - 68, 126, '#f97316', 3);

  // Big Bold Italic "HORIZON" Brand Typography (Panel 1)
  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  // 3D Extrusion Shadow
  ctx.font = 'italic 900 78px "Impact", "Arial Black", "Montserrat", sans-serif';
  ctx.fillStyle = 'rgba(0, 0, 0, 0.95)';
  ctx.fillText('HORIZON', 256 + 3, 124 + 4);

  // Outer Neon Cyan Glow Outline
  ctx.lineWidth = 7;
  ctx.strokeStyle = '#0891b2';
  ctx.strokeText('HORIZON', 256, 124);

  // Crisp Core Fill with Cyan Specular Sheen
  const p1TextGrad = ctx.createLinearGradient(0, 88, 0, 160);
  p1TextGrad.addColorStop(0, '#ffffff');
  p1TextGrad.addColorStop(0.55, '#f0fdff');
  p1TextGrad.addColorStop(1, '#a5f3fc');
  ctx.fillStyle = p1TextGrad;
  ctx.fillText('HORIZON', 256, 124);

  // Subtitle motorsport badge
  ctx.font = '900 13px system-ui, -apple-system, sans-serif';
  ctx.letterSpacing = '5px';
  ctx.fillStyle = '#38bdf8';
  ctx.fillText('• FESTIVAL RACING •', 256, 178);
  ctx.letterSpacing = '0px';
  ctx.restore();

  // -------------------------------------------------------------------------
  // 2. PANEL 2 (X: 512 - 1024): Vibrant Racing Red & Alpine White HORIZON
  // -------------------------------------------------------------------------
  const redGrad = ctx.createLinearGradient(panelW, 0, panelW, canvas.height);
  redGrad.addColorStop(0, '#991b1b');
  redGrad.addColorStop(0.25, '#dc2626');
  redGrad.addColorStop(0.75, '#ef4444');
  redGrad.addColorStop(1, '#7f1d1d');
  ctx.fillStyle = redGrad;
  ctx.fillRect(panelW, 0, panelW, canvas.height);

  // Speed-striping background
  ctx.fillStyle = 'rgba(0, 0, 0, 0.15)';
  for (let x = panelW; x < canvas.width; x += 32) {
    ctx.fillRect(x, 36, 16, 178);
  }

  // Accent pin-stripes
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(panelW, 36, panelW, 4);
  ctx.fillStyle = '#fde047'; // Racing Gold bottom stripe
  ctx.fillRect(panelW, 214, panelW, 4);

  // Forward Arrows for Panel 2
  drawForwardArrows(panelW + 24, 126, '#ffffff', 3);
  drawForwardArrows(canvas.width - 68, 126, '#fde047', 3);

  // Big Bold Italic "HORIZON" Brand Typography (Panel 2)
  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  // 3D Shadow
  ctx.font = 'italic 900 78px "Impact", "Arial Black", "Montserrat", sans-serif';
  ctx.fillStyle = 'rgba(0, 0, 0, 0.95)';
  ctx.fillText('HORIZON', panelW + 256 + 3, 124 + 4);

  // Heavy Black Border for Maximum Punch against Red
  ctx.lineWidth = 8;
  ctx.strokeStyle = '#0f172a';
  ctx.strokeText('HORIZON', panelW + 256, 124);

  // Crisp Alpine White Core Fill
  const p2TextGrad = ctx.createLinearGradient(0, 88, 0, 160);
  p2TextGrad.addColorStop(0, '#ffffff');
  p2TextGrad.addColorStop(0.65, '#ffffff');
  p2TextGrad.addColorStop(1, '#e2e8f0');
  ctx.fillStyle = p2TextGrad;
  ctx.fillText('HORIZON', panelW + 256, 124);

  // Subtitle motorsport badge
  ctx.font = '900 13px system-ui, -apple-system, sans-serif';
  ctx.letterSpacing = '5px';
  ctx.fillStyle = '#fde047'; // Bright gold
  ctx.fillText('• MOTORSPORT •', panelW + 256, 178);
  ctx.letterSpacing = '0px';
  ctx.restore();

  // -------------------------------------------------------------------------
  // 3. TOP RAIL / CAP (Y: 0 - 36) - Glowing Red Speed-Striped Directional Rail
  // -------------------------------------------------------------------------
  // Glowing race red base with specular edge
  const topCapGrad = ctx.createLinearGradient(0, 0, 0, 36);
  topCapGrad.addColorStop(0, '#ff2e4d');
  topCapGrad.addColorStop(0.3, '#ff0520');
  topCapGrad.addColorStop(0.7, '#e11d48');
  topCapGrad.addColorStop(1, '#991b1b');
  ctx.fillStyle = topCapGrad;
  ctx.fillRect(0, 0, canvas.width, 36);

  // High-visibility black directional chevrons (> > >) along top rail
  ctx.fillStyle = '#060911';
  for (let x = -20; x < canvas.width + 40; x += 48) {
    ctx.beginPath();
    ctx.moveTo(x + 24, 18);
    ctx.lineTo(x, 4);
    ctx.lineTo(x - 12, 4);
    ctx.lineTo(x + 10, 18);
    ctx.lineTo(x - 12, 32);
    ctx.lineTo(x, 32);
    ctx.closePath();
    ctx.fill();
  }

  // Horizontal speed accent pin-stripes
  ctx.fillStyle = 'rgba(255, 255, 255, 0.45)';
  ctx.fillRect(0, 2, canvas.width, 2);
  ctx.fillStyle = 'rgba(255, 30, 60, 0.9)';
  ctx.fillRect(0, 32, canvas.width, 2.5);

  // -------------------------------------------------------------------------
  // 4. CORRUGATED 3D ARMCO PROFILES (Horizontal Shading across entire width)
  // -------------------------------------------------------------------------
  // Upper Ridge specular wave (Y: 36 - 116)
  const upperWaveGrad = ctx.createLinearGradient(0, 36, 0, 116);
  upperWaveGrad.addColorStop(0, 'rgba(255, 255, 255, 0.25)');
  upperWaveGrad.addColorStop(0.2, 'rgba(255, 255, 255, 0.1)');
  upperWaveGrad.addColorStop(0.7, 'rgba(0, 0, 0, 0.05)');
  upperWaveGrad.addColorStop(1, 'rgba(0, 0, 0, 0.3)');
  ctx.fillStyle = upperWaveGrad;
  ctx.fillRect(0, 36, canvas.width, 80);

  // Upper Wave highlight crest
  ctx.fillStyle = 'rgba(255, 255, 255, 0.25)';
  ctx.fillRect(0, 52, canvas.width, 4);

  // Center Recessed Crease / Armco Groove (Y: 116 - 144)
  const creaseGrad = ctx.createLinearGradient(0, 116, 0, 144);
  creaseGrad.addColorStop(0, 'rgba(0, 0, 0, 0.35)');
  creaseGrad.addColorStop(0.45, 'rgba(0, 0, 0, 0.65)');
  creaseGrad.addColorStop(0.55, 'rgba(0, 0, 0, 0.65)');
  creaseGrad.addColorStop(0.85, 'rgba(255, 255, 255, 0.15)');
  creaseGrad.addColorStop(1, 'rgba(0, 0, 0, 0.1)');
  ctx.fillStyle = creaseGrad;
  ctx.fillRect(0, 116, canvas.width, 28);

  // Sharp dark shadow crease line
  ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
  ctx.fillRect(0, 128, canvas.width, 3);

  // Lower Ridge specular wave (Y: 144 - 216)
  const lowerWaveGrad = ctx.createLinearGradient(0, 144, 0, 216);
  lowerWaveGrad.addColorStop(0, 'rgba(255, 255, 255, 0.2)');
  lowerWaveGrad.addColorStop(0.25, 'rgba(255, 255, 255, 0.08)');
  lowerWaveGrad.addColorStop(0.75, 'rgba(0, 0, 0, 0.12)');
  lowerWaveGrad.addColorStop(1, 'rgba(0, 0, 0, 0.4)');
  ctx.fillStyle = lowerWaveGrad;
  ctx.fillRect(0, 144, canvas.width, 72);

  // Lower Wave highlight crest
  ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
  ctx.fillRect(0, 162, canvas.width, 3);

  // Ground Contact / Base Shadow (Y: 216 - 256)
  const groundShadowGrad = ctx.createLinearGradient(0, 216, 0, 256);
  groundShadowGrad.addColorStop(0, 'rgba(0, 0, 0, 0.3)');
  groundShadowGrad.addColorStop(0.5, 'rgba(15, 23, 42, 0.7)');
  groundShadowGrad.addColorStop(1, '#050811');
  ctx.fillStyle = groundShadowGrad;
  ctx.fillRect(0, 216, canvas.width, 40);

  // Tire rubber scuff marks at base
  ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
  for (let x = 10; x < canvas.width; x += 45) {
    ctx.fillRect(x, 240, 25, 12);
  }

  // -------------------------------------------------------------------------
  // 5. VERTICAL SEGMENT SEAMS & MECHANICAL BOLTS
  // -------------------------------------------------------------------------
  const drawVerticalSeam = (x: number) => {
    // Deep dark vertical joint slot
    ctx.fillStyle = 'rgba(0, 0, 0, 0.9)';
    ctx.fillRect(x - 3, 0, 6, canvas.height);
    // Bevel highlight right edge
    ctx.fillStyle = 'rgba(255, 255, 255, 0.45)';
    ctx.fillRect(x + 3, 0, 2, canvas.height);

    // Fastener hex bolts near joints
    const boltOffsets = [14, -14];
    boltOffsets.forEach((bo) => {
      const bx = x + bo;
      if (bx >= 0 && bx < canvas.width) {
        [72, 184].forEach((by) => {
          // Dark bolt ring
          ctx.beginPath();
          ctx.arc(bx, by, 5, 0, Math.PI * 2);
          ctx.fillStyle = '#0f172a';
          ctx.fill();
          // Steel bolt head
          ctx.beginPath();
          ctx.arc(bx - 0.5, by - 0.5, 3.5, 0, Math.PI * 2);
          ctx.fillStyle = '#94a3b8';
          ctx.fill();
          // Specular glint
          ctx.beginPath();
          ctx.arc(bx - 1.5, by - 1.5, 1.2, 0, Math.PI * 2);
          ctx.fillStyle = '#ffffff';
          ctx.fill();
        });
      }
    });
  };

  drawVerticalSeam(0);
  drawVerticalSeam(panelW);
  drawVerticalSeam(canvas.width - 1);

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.generateMipmaps = true;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  return texture;
}

// Glowing Directional Chevron Arrow Rail Texture (Matching HORIZON Touge reference)
export function createBarrierChevronTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;

  // Deep dark carbon / obsidian backing
  ctx.fillStyle = '#060911';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Subtle carbon fiber weave pattern
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.025)';
  ctx.lineWidth = 2;
  for (let x = -canvas.height; x < canvas.width + canvas.height; x += 14) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x + canvas.height, canvas.height);
    ctx.stroke();
  }

  // 2 repeating modular 512px panels along the barrier rail
  const panelW = 512;
  for (let p = 0; p < 2; p++) {
    const offsetX = p * panelW;

    // 1. Glowing Racing Red Background Bar (Y: 34 to 166)
    ctx.save();
    ctx.shadowColor = '#ff1744';
    ctx.shadowBlur = 24;

    // Rich saturated race-red gradient
    const redGrad = ctx.createLinearGradient(0, 34, 0, 166);
    redGrad.addColorStop(0, '#ff2e4f');
    redGrad.addColorStop(0.35, '#ff0520');
    redGrad.addColorStop(0.7, '#e11d48');
    redGrad.addColorStop(1, '#ff1a38');
    ctx.fillStyle = redGrad;

    // Parallelogram shape slanted in race direction
    ctx.beginPath();
    ctx.moveTo(offsetX + 12, 34);
    ctx.lineTo(offsetX + panelW - 54, 34);
    ctx.lineTo(offsetX + panelW + 28, 166);
    ctx.lineTo(offsetX + 94, 166);
    ctx.closePath();
    ctx.fill();

    // Specular inner neon reflection line
    ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.fillRect(offsetX + 28, 48, panelW - 80, 5);
    ctx.restore();

    // 2. Horizontal Red Speed Lines below the red bar (Y: 172 to 244)
    ctx.save();
    ctx.shadowColor = '#ff1744';
    ctx.shadowBlur = 14;
    const lineCount = 7;
    for (let l = 0; l < lineCount; l++) {
      const ly = 174 + l * 10;
      const slantShift = l * 9;
      const alpha = 0.95 - (l / lineCount) * 0.35;
      ctx.fillStyle = `rgba(255, 24, 48, ${alpha})`;
      ctx.fillRect(
        offsetX + 84 + slantShift,
        ly,
        panelW - 80,
        4.5
      );
    }
    ctx.restore();

    // 3. Bold Black Directional Chevron Arrows
    // In direction of travel (pointing right in texture -> forward on track)
    // Chevrons span from Y: 16 to Y: 240 (height 224px, spanning entire rail!)
    const chevronCount = 5;
    const startX = offsetX + 52;
    const stepX = 86;

    for (let c = 0; c < chevronCount; c++) {
      const cx = startX + c * stepX;

      // Drop shadow underneath chevron on the red backing
      ctx.save();
      ctx.shadowColor = 'rgba(0, 0, 0, 0.9)';
      ctx.shadowBlur = 10;
      ctx.shadowOffsetX = -4;
      ctx.shadowOffsetY = 3;

      // Chevron Polygon pointing RIGHT (>):
      // Outer tip: (cx + 48, 128)
      // Outer top: (cx - 36, 16)
      // Flat top: (cx - 80, 16)
      // Inner cleft: (cx + 4, 128)
      // Flat bottom: (cx - 80, 240)
      // Outer bottom: (cx - 36, 240)
      ctx.fillStyle = '#070a10';
      ctx.beginPath();
      ctx.moveTo(cx + 48, 128);
      ctx.lineTo(cx - 36, 16);
      ctx.lineTo(cx - 80, 16);
      ctx.lineTo(cx + 4, 128);
      ctx.lineTo(cx - 80, 240);
      ctx.lineTo(cx - 36, 240);
      ctx.closePath();
      ctx.fill();
      ctx.restore();

      // Leading white accent highlight on the first chevron (matching user reference image)
      if (c === 0) {
        ctx.save();
        ctx.fillStyle = '#ffffff';
        ctx.shadowColor = '#ffffff';
        ctx.shadowBlur = 14;
        ctx.beginPath();
        ctx.moveTo(cx - 80, 16);
        ctx.lineTo(cx - 68, 16);
        ctx.lineTo(cx + 16, 128);
        ctx.lineTo(cx - 68, 240);
        ctx.lineTo(cx - 80, 240);
        ctx.lineTo(cx + 4, 128);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      }
    }
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.generateMipmaps = true;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  return texture;
}

// Glowing Turn Warning Arrow Sign Face Texture (Matching User Turn Sign Reference)
export function createTurnSignTexture(pointingLeft: boolean): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;

  const w = canvas.width;
  const h = canvas.height;

  // 1. Rich Radiant Ruby / Burgundy / Wine Gradient Base (matching reference image)
  const bgGrad = ctx.createLinearGradient(0, 0, 0, h);
  bgGrad.addColorStop(0, '#be123c'); // Bright crimson top
  bgGrad.addColorStop(0.2, '#e11d48'); // Vibrant race red
  bgGrad.addColorStop(0.5, '#dc2626'); // Rich luminous core
  bgGrad.addColorStop(0.75, '#991b1b'); // Deep ruby
  bgGrad.addColorStop(1, '#4c0519'); // Dark wine bottom edge
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, w, h);

  // 2. High-intensity Central Illumination Hotspot
  const radialX = pointingLeft ? w * 0.35 : w * 0.65;
  const radialY = h * 0.52;
  const radialGlow = ctx.createRadialGradient(radialX, radialY, 30, radialX, radialY, w * 0.55);
  radialGlow.addColorStop(0, 'rgba(255, 60, 90, 0.65)');
  radialGlow.addColorStop(0.5, 'rgba(225, 29, 72, 0.35)');
  radialGlow.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = radialGlow;
  ctx.fillRect(0, 0, w, h);

  // 3. Subtle High-speed Horizontal Scanlines (Motorsport LED backlighting texture)
  ctx.fillStyle = 'rgba(0, 0, 0, 0.08)';
  for (let y = 0; y < h; y += 6) {
    ctx.fillRect(0, y, w, 3);
  }

  // 4. Directional Speed Chevrons (Translucent radiant white chevrons pointing in turn direction)
  ctx.save();
  const chevronCount = 3;
  const spacing = 160;
  // When pointingLeft is true, tip is at canvas left (maps to driver's LEFT)
  const startX = pointingLeft ? w * 0.68 : w * 0.32;

  for (let c = 0; c < chevronCount; c++) {
    const cx = pointingLeft ? startX - c * spacing : startX + c * spacing;
    const cy = h * 0.5;
    const tipDelta = pointingLeft ? -68 : 68;
    const armW = pointingLeft ? 48 : -48;
    const armH = 100;
    const thickness = pointingLeft ? 42 : -42;

    // Outer soft glow for chevron
    ctx.shadowColor = 'rgba(255, 255, 255, 0.95)';
    ctx.shadowBlur = 24;

    const chevGrad = ctx.createLinearGradient(0, cy - armH, 0, cy + armH);
    chevGrad.addColorStop(0, 'rgba(255, 255, 255, 0.92)');
    chevGrad.addColorStop(0.5, 'rgba(255, 255, 255, 1.0)');
    chevGrad.addColorStop(1, 'rgba(255, 220, 230, 0.92)');
    ctx.fillStyle = chevGrad;

    ctx.beginPath();
    ctx.moveTo(cx + tipDelta, cy);
    ctx.lineTo(cx + armW, cy - armH);
    ctx.lineTo(cx + armW + thickness, cy - armH);
    ctx.lineTo(cx + tipDelta + thickness, cy);
    ctx.lineTo(cx + armW + thickness, cy + armH);
    ctx.lineTo(cx + armW, cy + armH);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();

  // 5. Glossy Specular Glass Curved Reflection (The signature acrylic glass sheen in user reference image!)
  ctx.save();
  const glossGrad = ctx.createLinearGradient(0, 0, 0, h * 0.58);
  glossGrad.addColorStop(0, 'rgba(255, 255, 255, 0.65)'); // Crisp white top reflection
  glossGrad.addColorStop(0.3, 'rgba(230, 240, 255, 0.32)'); // Sky tint
  glossGrad.addColorStop(0.75, 'rgba(255, 255, 255, 0.08)');
  glossGrad.addColorStop(1, 'rgba(255, 255, 255, 0)');
  ctx.fillStyle = glossGrad;

  // Curved glass ellipse highlight across top
  ctx.beginPath();
  ctx.ellipse(w * 0.5, h * 0.18, w * 0.52, h * 0.38, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // 6. Recessed Bevel Inset Shadow along the frame edges
  ctx.save();
  // Top bevel highlight
  const topBevelGrad = ctx.createLinearGradient(0, 0, 0, 24);
  topBevelGrad.addColorStop(0, 'rgba(255, 255, 255, 0.5)');
  topBevelGrad.addColorStop(1, 'rgba(255, 255, 255, 0)');
  ctx.fillStyle = topBevelGrad;
  ctx.fillRect(0, 0, w, 24);

  // Bottom recessed shadow
  const btmBevelGrad = ctx.createLinearGradient(0, h - 28, 0, h);
  btmBevelGrad.addColorStop(0, 'rgba(0, 0, 0, 0)');
  btmBevelGrad.addColorStop(1, 'rgba(0, 0, 0, 0.6)');
  ctx.fillStyle = btmBevelGrad;
  ctx.fillRect(0, h - 28, w, 28);

  // Perimeter Neon Ruby Glow Border
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.7)';
  ctx.lineWidth = 6;
  ctx.strokeRect(6, 6, w - 12, h - 12);
  ctx.restore();

  const texture = new THREE.CanvasTexture(canvas);
  texture.generateMipmaps = true;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  return texture;
}

// Checkered start/finish line texture
export function createCheckeredTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 64;
  const ctx = canvas.getContext('2d')!;

  const cols = 16;
  const rows = 4;
  const cw = canvas.width / cols;
  const ch = canvas.height / rows;

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      ctx.fillStyle = (r + c) % 2 === 0 ? '#ffffff' : '#0a0d14';
      ctx.fillRect(c * cw, r * ch, cw, ch);
    }
  }

  const texture = new THREE.CanvasTexture(canvas);
  return texture;
}

// Grass terrain texture
export function createGrassTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;

  // Deep lawn green
  ctx.fillStyle = '#143821';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Mowed stripes
  ctx.fillStyle = 'rgba(16, 56, 32, 0.4)';
  const stripeW = 64;
  for (let x = 0; x < canvas.width; x += stripeW * 2) {
    ctx.fillRect(x, 0, stripeW, canvas.height);
  }

  // Subtle organic speckles
  for (let i = 0; i < 400; i++) {
    ctx.fillStyle = Math.random() > 0.5 ? 'rgba(34, 197, 94, 0.12)' : 'rgba(6, 78, 59, 0.2)';
    ctx.beginPath();
    ctx.arc(
      Math.random() * canvas.width,
      Math.random() * canvas.height,
      Math.random() * 3 + 1,
      0,
      Math.PI * 2
    );
    ctx.fill();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(40, 40);
  return texture;
}

// Tire smoke particle sprite
export function createSmokeTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext('2d')!;

  const grad = ctx.createRadialGradient(32, 32, 4, 32, 32, 30);
  grad.addColorStop(0, 'rgba(240, 245, 255, 0.85)');
  grad.addColorStop(0.5, 'rgba(200, 215, 235, 0.35)');
  grad.addColorStop(1, 'rgba(200, 215, 235, 0)');

  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(32, 32, 30, 0, Math.PI * 2);
  ctx.fill();

  return new THREE.CanvasTexture(canvas);
}

// Overhead Gantry Sponsor / Start Banner Texture
export function createGantryBannerTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;

  // High-tech dark carbon gradient background
  const bgGrad = ctx.createLinearGradient(0, 0, 0, canvas.height);
  bgGrad.addColorStop(0, '#090d16');
  bgGrad.addColorStop(0.5, '#111827');
  bgGrad.addColorStop(1, '#090d16');
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Top and bottom vibrant racing neon accent borders
  ctx.fillStyle = '#f59e0b'; // Amber Gold
  ctx.fillRect(0, 0, canvas.width, 10);
  ctx.fillRect(0, canvas.height - 10, canvas.width, 10);

  ctx.fillStyle = '#06b6d4'; // Cyan neon accent
  ctx.fillRect(0, 10, canvas.width, 4);
  ctx.fillRect(0, canvas.height - 14, canvas.width, 4);

  // Left & right checkered flag panels
  const checkW = 120;
  const checkCols = 6;
  const checkRows = 5;
  const cellW = checkW / checkCols;
  const cellH = (canvas.height - 28) / checkRows;

  for (let r = 0; r < checkRows; r++) {
    for (let c = 0; c < checkCols; c++) {
      ctx.fillStyle = (r + c) % 2 === 0 ? '#f8fafc' : 'rgba(15, 23, 42, 0.8)';
      ctx.fillRect(20 + c * cellW, 14 + r * cellH, cellW, cellH);
      ctx.fillRect(canvas.width - 20 - checkW + c * cellW, 14 + r * cellH, cellW, cellH);
    }
  }

  // Main bold "START / FINISH" Typography
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  // Subtitle badge
  ctx.font = 'bold 24px system-ui, -apple-system, sans-serif';
  ctx.fillStyle = '#06b6d4';
  ctx.fillText('• HORIZON GRAND PRIX SPEEDWAY •', canvas.width / 2, 60);

  // Primary Title
  ctx.font = '900 82px system-ui, -apple-system, sans-serif';
  ctx.fillStyle = '#ffffff';
  ctx.shadowColor = 'rgba(6, 182, 212, 0.85)';
  ctx.shadowBlur = 18;
  ctx.fillText('START / FINISH', canvas.width / 2, 140);
  ctx.shadowBlur = 0;

  // Bottom subtitle
  ctx.font = 'bold 22px system-ui, -apple-system, sans-serif';
  ctx.fillStyle = '#94a3b8';
  ctx.fillText('OFFICIAL TIMING & SCORING', canvas.width / 2, 208);

  const texture = new THREE.CanvasTexture(canvas);
  return texture;
}

// Biome-specific ground terrain texture
export function createBiomeGroundTexture(env: EnvironmentConfig): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = env.ground.baseColor;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Mowed / terrain stripes
  ctx.fillStyle = env.ground.stripeColor;
  const stripeW = 64;
  for (let x = 0; x < canvas.width; x += stripeW * 2) {
    ctx.fillRect(x, 0, stripeW, canvas.height);
  }

  // Organic speckles & particles
  for (let i = 0; i < 400; i++) {
    ctx.fillStyle = Math.random() > 0.5 ? env.ground.speckle1 : env.ground.speckle2;
    ctx.beginPath();
    ctx.arc(
      Math.random() * canvas.width,
      Math.random() * canvas.height,
      Math.random() * 3 + 1,
      0,
      Math.PI * 2
    );
    ctx.fill();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(40, 40);
  return texture;
}

// Procedural Forza Horizon 6 360-degree Sky Dome
export function createSkyDome(env: EnvironmentConfig): THREE.Mesh {
  const geom = new THREE.SphereGeometry(2200, 32, 20);
  const material = new THREE.ShaderMaterial({
    uniforms: {
      topColor: { value: new THREE.Color(env.sky.topColor) },
      midColor: { value: new THREE.Color(env.sky.midColor) },
      bottomColor: { value: new THREE.Color(env.sky.bottomColor) },
      sunPosition: { value: new THREE.Vector3(...env.sky.sunPosition) },
      sunColor: { value: new THREE.Color(env.sky.sunColor) },
      sunIntensity: { value: env.sky.sunIntensity },
      sunGlowSize: { value: env.sky.sunGlowSize },
      lightningFlash: { value: 0.0 },
    },
    vertexShader: `
      varying vec3 vWorldPosition;
      void main() {
        vec4 worldPos = modelMatrix * vec4(position, 1.0);
        vWorldPosition = worldPos.xyz;
        gl_Position = projectionMatrix * viewMatrix * worldPos;
      }
    `,
    fragmentShader: `
      varying vec3 vWorldPosition;
      uniform vec3 topColor;
      uniform vec3 midColor;
      uniform vec3 bottomColor;
      uniform vec3 sunPosition;
      uniform vec3 sunColor;
      uniform float sunIntensity;
      uniform float sunGlowSize;
      uniform float lightningFlash;

      void main() {
        vec3 dir = normalize(vWorldPosition);
        float h = clamp(dir.y, -0.1, 1.0);
        
        // Multi-tier atmospheric gradient for authentic Forza Horizon sky
        vec3 sky;
        if (h < 0.22) {
          float t = clamp((h + 0.1) / 0.32, 0.0, 1.0);
          sky = mix(bottomColor, midColor, smoothstep(0.0, 1.0, t));
        } else {
          float t = clamp((h - 0.22) / 0.78, 0.0, 1.0);
          sky = mix(midColor, topColor, smoothstep(0.0, 1.0, t));
        }

        // Sun / Moon disc and atmospheric glare
        vec3 sDir = normalize(sunPosition);
        float sunDot = max(0.0, dot(dir, sDir));
        float discThresh = 0.9988 - (sunGlowSize - 1.0) * 0.0005;
        float sunDisc = smoothstep(discThresh, 0.9998, sunDot) * 3.5;
        float sunHalo = pow(sunDot, 14.0 / max(0.2, sunGlowSize)) * 0.85;
        float wideHaze = pow(sunDot, 3.5) * 0.35;
        
        vec3 sunContribution = sunColor * (sunDisc + sunHalo + wideHaze) * (sunIntensity * 0.75);
        sky += sunContribution;

        // Dynamic lightning flash
        if (lightningFlash > 0.0) {
          sky = mix(sky, vec3(0.92, 0.96, 1.0), lightningFlash * 0.95);
        }

        gl_FragColor = vec4(sky, 1.0);
      }
    `,
    side: THREE.BackSide,
    depthWrite: false,
  });

  const mesh = new THREE.Mesh(geom, material);
  return mesh;
}

export function updateSkyDome(
  mesh: THREE.Mesh,
  env: EnvironmentConfig,
  lightningFlash: number = 0.0
) {
  const mat = mesh.material as THREE.ShaderMaterial;
  if (!mat || !mat.uniforms) return;
  mat.uniforms.topColor.value.setHex(env.sky.topColor);
  mat.uniforms.midColor.value.setHex(env.sky.midColor);
  mat.uniforms.bottomColor.value.setHex(env.sky.bottomColor);
  mat.uniforms.sunPosition.value.set(...env.sky.sunPosition);
  mat.uniforms.sunColor.value.setHex(env.sky.sunColor);
  mat.uniforms.sunIntensity.value = env.sky.sunIntensity;
  mat.uniforms.sunGlowSize.value = env.sky.sunGlowSize;
  mat.uniforms.lightningFlash.value = lightningFlash;
}

// Sakura Cherry Blossom Petal Particle Sprite (High-visibility 128x128 with authentic petal notch)
export function createPetalTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d')!;

  ctx.save();
  ctx.translate(64, 64);
  ctx.rotate(Math.PI / 8);

  // Outer petal path with realistic notched tip
  ctx.beginPath();
  ctx.moveTo(0, 52); // base stem
  ctx.bezierCurveTo(-38, 30, -48, -15, -28, -46); // left flank
  ctx.lineTo(-6, -38); // left tip into notch
  ctx.lineTo(0, -48);  // notch indentation
  ctx.lineTo(6, -38);  // right tip of notch
  ctx.bezierCurveTo(28, -46, 48, -15, 38, 30); // right flank
  ctx.closePath();

  // Vibrant gradient from soft creamy white blush to rich sakura pink
  const grad = ctx.createRadialGradient(0, 10, 4, 0, 0, 56);
  grad.addColorStop(0, '#ffffff');
  grad.addColorStop(0.25, '#fce7f3');
  grad.addColorStop(0.65, '#f472b6');
  grad.addColorStop(0.92, '#ec4899');
  grad.addColorStop(1, '#db2777');

  ctx.fillStyle = grad;
  ctx.shadowColor = 'rgba(236, 72, 153, 0.7)';
  ctx.shadowBlur = 10;
  ctx.fill();

  // Subtle central vein
  ctx.shadowBlur = 0;
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.65)';
  ctx.lineWidth = 1.8;
  ctx.beginPath();
  ctx.moveTo(0, 48);
  ctx.lineTo(0, -36);
  ctx.stroke();

  // Crisp rim highlight
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
  ctx.lineWidth = 1.2;
  ctx.stroke();

  ctx.restore();

  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  return texture;
}

// Kyoto Autumn Maple Leaf Particle Sprite (High-visibility 128x128 Momiji leaf)
export function createLeafTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d')!;

  ctx.save();
  ctx.translate(64, 68);

  // 5-lobed Japanese Momiji Maple leaf outline
  ctx.beginPath();
  ctx.moveTo(0, 46); // base stem
  // Bottom left lobe
  ctx.quadraticCurveTo(-22, 32, -44, 22);
  ctx.lineTo(-32, 12);
  // Mid left lobe
  ctx.quadraticCurveTo(-38, 2, -54, -12);
  ctx.lineTo(-36, -16);
  // Upper left lobe
  ctx.quadraticCurveTo(-38, -32, -32, -48);
  ctx.lineTo(-18, -36);
  // Center tip
  ctx.quadraticCurveTo(-8, -50, 0, -60);
  ctx.quadraticCurveTo(8, -50, 18, -36);
  // Upper right lobe
  ctx.lineTo(32, -48);
  ctx.quadraticCurveTo(38, -32, 36, -16);
  // Mid right lobe
  ctx.lineTo(54, -12);
  ctx.quadraticCurveTo(38, 2, 32, 12);
  // Bottom right lobe
  ctx.lineTo(44, 22);
  ctx.quadraticCurveTo(22, 32, 0, 46);
  ctx.closePath();

  // Fiery gradient: golden yellow center to flaming orange and scarlet ruby tips
  const grad = ctx.createRadialGradient(0, 0, 4, 0, -10, 58);
  grad.addColorStop(0, '#fef08a');
  grad.addColorStop(0.3, '#f59e0b');
  grad.addColorStop(0.65, '#ea580c');
  grad.addColorStop(0.88, '#dc2626');
  grad.addColorStop(1, '#991b1b');

  ctx.fillStyle = grad;
  ctx.shadowColor = 'rgba(234, 88, 12, 0.8)';
  ctx.shadowBlur = 12;
  ctx.fill();

  // Radiating golden leaf veins
  ctx.shadowBlur = 0;
  ctx.strokeStyle = 'rgba(254, 240, 138, 0.75)';
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.moveTo(0, 44);
  ctx.lineTo(0, -56); // main vein
  ctx.moveTo(0, 12);
  ctx.lineTo(-30, -42);
  ctx.moveTo(0, 12);
  ctx.lineTo(30, -42);
  ctx.moveTo(0, 24);
  ctx.lineTo(-46, -10);
  ctx.moveTo(0, 24);
  ctx.lineTo(46, -10);
  ctx.stroke();

  // Stem
  ctx.strokeStyle = '#78350f';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(0, 44);
  ctx.lineTo(0, 58);
  ctx.stroke();

  ctx.restore();

  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  return texture;
}

// Coastal Sparkle / Sea Breeze Sun Particle Sprite (High-visibility 128x128 Brilliant Diamond Flare)
export function createSparkleTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d')!;

  const cx = 64;
  const cy = 64;

  // 1. Soft glowing corona aura
  const auraGrad = ctx.createRadialGradient(cx, cy, 2, cx, cy, 60);
  auraGrad.addColorStop(0, 'rgba(255, 255, 255, 0.95)');
  auraGrad.addColorStop(0.2, 'rgba(253, 224, 71, 0.75)');
  auraGrad.addColorStop(0.5, 'rgba(56, 189, 248, 0.55)');
  auraGrad.addColorStop(0.85, 'rgba(2, 132, 199, 0.15)');
  auraGrad.addColorStop(1, 'rgba(2, 132, 199, 0)');

  ctx.fillStyle = auraGrad;
  ctx.beginPath();
  ctx.arc(cx, cy, 60, 0, Math.PI * 2);
  ctx.fill();

  // 2. Primary 4-point diamond star flare
  ctx.fillStyle = '#ffffff';
  ctx.shadowColor = 'rgba(56, 189, 248, 0.9)';
  ctx.shadowBlur = 14;

  ctx.beginPath();
  ctx.moveTo(cx, cy - 58);
  ctx.quadraticCurveTo(cx, cy, cx + 58, cy);
  ctx.quadraticCurveTo(cx, cy, cx, cy + 58);
  ctx.quadraticCurveTo(cx, cy, cx - 58, cy);
  ctx.quadraticCurveTo(cx, cy, cx, cy - 58);
  ctx.fill();

  // 3. Secondary diagonal star spikes
  ctx.beginPath();
  ctx.moveTo(cx, cy - 36);
  ctx.quadraticCurveTo(cx, cy, cx + 36, cy);
  ctx.quadraticCurveTo(cx, cy, cx, cy + 36);
  ctx.quadraticCurveTo(cx, cy, cx - 36, cy);
  ctx.quadraticCurveTo(cx, cy, cx, cy - 36);
  ctx.fillStyle = '#fef08a';
  ctx.shadowBlur = 8;
  ctx.fill();

  // 4. Brilliant center core
  ctx.shadowBlur = 0;
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(cx, cy, 7, 0, Math.PI * 2);
  ctx.fill();

  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  return texture;
}
