import { useEffect, useRef, useCallback, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { INV_MIN_V, INV_MAX_V, OWNER, GROUP, ZONES, RED, BLACK } from '../utils/constants';
import { PANEL_CATALOG, getProductSpecs } from '../utils/panelCatalog';

export function useThreeScene() {
  const canvasRef = useRef(null);
  const sceneRef = useRef(null);
  const cameraRef = useRef(null);
  const rendererRef = useRef(null);
  const controlsRef = useRef(null);
  const modelsRef = useRef({ panel: null, controller: null, battery: null, inverter: null });
  const indicatorsRef = useRef({});
  const terminalRegistryRef = useRef({});
  const wiresGroupRef = useRef(null);
  const fxLayerRef = useRef(null);
  const particlesRef = useRef([]);
  const scorchPlanesRef = useRef([]);
  
  const [badgeText, setBadgeText] = useState('0 / 4 placed');
  const [isEmpty, setIsEmpty] = useState(true);

  // Texture helpers
  const makeGroundTexture = useCallback(() => {
    const W = 1024, H = 768;
    const c = document.createElement('canvas');
    c.width = W;
    c.height = H;
    const ctx = c.getContext('2d');
    
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#2b2f27');
    g.addColorStop(1, '#1a1d16');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    
    ctx.strokeStyle = 'rgba(255,255,255,0.045)';
    ctx.lineWidth = 1;
    for (let x = 0; x <= W; x += 32) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, H);
      ctx.stroke();
    }
    for (let y = 0; y <= H; y += 32) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(W, y);
      ctx.stroke();
    }
    
    function w2c(x, z) {
      return [(x + 8) / 16 * W, (z + 6) / 12 * H];
    }
    
    ctx.font = '600 15px Rajdhani, sans-serif';
    ctx.textAlign = 'center';
    Object.values(ZONES).forEach(z => {
      const [cx, cy] = w2c(z.x, z.z);
      const pw = z.w / 16 * W, ph = z.h / 12 * H;
      ctx.save();
      ctx.setLineDash([9, 7]);
      ctx.strokeStyle = 'rgba(240,168,63,0.4)';
      ctx.lineWidth = 2;
      ctx.strokeRect(cx - pw / 2, cy - ph / 2, pw, ph);
      ctx.restore();
      ctx.fillStyle = 'rgba(240,168,63,0.75)';
      ctx.fillText(z.label, cx, cy - ph / 2 - 10);
    });
    
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }, []);

  const makeScreenTexture = useCallback((text, color) => {
    const c = document.createElement('canvas');
    c.width = 256;
    c.height = 128;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#060907';
    ctx.fillRect(0, 0, 256, 128);
    ctx.font = '700 40px "JetBrains Mono", monospace';
    ctx.fillStyle = color;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = color;
    ctx.shadowBlur = 14;
    ctx.fillText(text, 128, 68);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }, []);

  // Layered panel texture generation
  const makePanelTextures = useCallback((cols, rows) => {
    // Use a higher resolution canvas for better quality
    const SIZE = 1024;
    const cellWidth = SIZE / cols;
    const cellHeight = SIZE / rows;
    
    // === DIFFUSE MAP ===
    const diffuseCanvas = document.createElement('canvas');
    diffuseCanvas.width = SIZE;
    diffuseCanvas.height = SIZE;
    const dctx = diffuseCanvas.getContext('2d');
    
    // Base cell color - dark blue-black as specified
    dctx.fillStyle = '#0a0a0d';
    dctx.fillRect(0, 0, SIZE, SIZE);
    
    // Cell variation - subtle gradient within each cell
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const x = col * cellWidth;
        const y = row * cellHeight;
        
        // Subtle cell-to-cell variation
        const brightness = 0.92 + Math.random() * 0.08;
        const r = Math.floor(10 * brightness);
        const g = Math.floor(10 * brightness);
        const b = Math.floor(13 * brightness);
        
        dctx.fillStyle = `rgb(${r},${g},${b})`;
        dctx.fillRect(x + 1, y + 1, cellWidth - 2, cellHeight - 2);
      }
    }
    
    // Fine busbar lines (very thin, ~1px at this scale) - soft grey
    dctx.strokeStyle = 'rgba(74, 77, 82, 0.4)';
    dctx.lineWidth = 1;
    
    // Vertical busbars (multiple thin lines per cell)
    for (let col = 0; col < cols; col++) {
      const baseX = col * cellWidth;
      for (let i = 1; i <= 11; i++) {
        const x = baseX + (i / 12) * cellWidth;
        dctx.beginPath();
        dctx.moveTo(x, 0);
        dctx.lineTo(x, SIZE);
        dctx.stroke();
      }
    }
    
    // Horizontal busbars
    for (let row = 0; row < rows; row++) {
      const baseY = row * cellHeight;
      for (let i = 1; i <= 3; i++) {
        const y = baseY + (i / 4) * cellHeight;
        dctx.beginPath();
        dctx.moveTo(0, y);
        dctx.lineTo(SIZE, y);
        dctx.stroke();
      }
    }
    
    // Cell gap lines (slightly darker to create separation)
    dctx.strokeStyle = 'rgba(5, 5, 6, 0.8)';
    dctx.lineWidth = 2;
    for (let col = 0; col <= cols; col++) {
      const x = col * cellWidth;
      dctx.beginPath();
      dctx.moveTo(x, 0);
      dctx.lineTo(x, SIZE);
      dctx.stroke();
    }
    for (let row = 0; row <= rows; row++) {
      const y = row * cellHeight;
      dctx.beginPath();
      dctx.moveTo(0, y);
      dctx.lineTo(SIZE, y);
      dctx.stroke();
    }
    
    // Glass reflection gradient (subtle highlight)
    const glassGrad = dctx.createLinearGradient(0, 0, SIZE * 0.3, SIZE * 0.3);
    glassGrad.addColorStop(0, 'rgba(255,255,255,0.12)');
    glassGrad.addColorStop(0.5, 'rgba(255,255,255,0)');
    dctx.fillStyle = glassGrad;
    dctx.fillRect(0, 0, SIZE, SIZE);
    
    const diffuseTex = new THREE.CanvasTexture(diffuseCanvas);
    diffuseTex.colorSpace = THREE.SRGBColorSpace;
    diffuseTex.wrapS = THREE.RepeatWrapping;
    diffuseTex.wrapT = THREE.RepeatWrapping;
    
    // === ROUGHNESS MAP ===
    const roughnessCanvas = document.createElement('canvas');
    roughnessCanvas.width = SIZE;
    roughnessCanvas.height = SIZE;
    const rctx = roughnessCanvas.getContext('2d');
    
    // Base roughness - low (coated glass appearance)
    rctx.fillStyle = 'rgb(30, 30, 30)'; // ~0.12 roughness
    rctx.fillRect(0, 0, SIZE, SIZE);
    
    // Slightly higher roughness at cell gaps
    rctx.strokeStyle = 'rgb(60, 60, 60)'; // ~0.24 roughness at gaps
    rctx.lineWidth = 4;
    for (let col = 0; col <= cols; col++) {
      const x = col * cellWidth;
      rctx.beginPath();
      rctx.moveTo(x, 0);
      rctx.lineTo(x, SIZE);
      rctx.stroke();
    }
    for (let row = 0; row <= rows; row++) {
      const y = row * cellHeight;
      rctx.beginPath();
      rctx.moveTo(0, y);
      rctx.lineTo(SIZE, y);
      rctx.stroke();
    }
    
    const roughnessTex = new THREE.CanvasTexture(roughnessCanvas);
    roughnessTex.wrapS = THREE.RepeatWrapping;
    roughnessTex.wrapT = THREE.RepeatWrapping;
    
    // === BUMP MAP ===
    const bumpCanvas = document.createElement('canvas');
    bumpCanvas.width = SIZE;
    bumpCanvas.height = SIZE;
    const bctx = bumpCanvas.getContext('2d');
    
    // Base bump - neutral
    bctx.fillStyle = 'rgb(128, 128, 128)';
    bctx.fillRect(0, 0, SIZE, SIZE);
    
    // Cell gap grooves (darker = lower = groove)
    bctx.strokeStyle = 'rgb(80, 80, 80)';
    bctx.lineWidth = 3;
    for (let col = 0; col <= cols; col++) {
      const x = col * cellWidth;
      bctx.beginPath();
      bctx.moveTo(x, 0);
      bctx.lineTo(x, SIZE);
      bctx.stroke();
    }
    for (let row = 0; row <= rows; row++) {
      const y = row * cellHeight;
      bctx.beginPath();
      bctx.moveTo(0, y);
      bctx.lineTo(SIZE, y);
      bctx.stroke();
    }
    
    // Busbar ridges (lighter = higher)
    bctx.strokeStyle = 'rgb(160, 160, 160)';
    bctx.lineWidth = 1;
    for (let col = 0; col < cols; col++) {
      const baseX = col * cellWidth;
      for (let i = 1; i <= 11; i++) {
        const x = baseX + (i / 12) * cellWidth;
        bctx.beginPath();
        bctx.moveTo(x, 0);
        bctx.lineTo(x, SIZE);
        bctx.stroke();
      }
    }
    
    const bumpTex = new THREE.CanvasTexture(bumpCanvas);
    bumpTex.wrapS = THREE.RepeatWrapping;
    bumpTex.wrapT = THREE.RepeatWrapping;
    
    return { diffuse: diffuseTex, roughness: roughnessTex, bump: bumpTex };
  }, []);

  const makeBatteryLabel = useCallback(() => {
    const c = document.createElement('canvas');
    c.width = 512;
    c.height = 256;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#e3c23f';
    ctx.fillRect(0, 0, 512, 256);
    ctx.strokeStyle = 'rgba(40,30,10,0.55)';
    ctx.lineWidth = 14;
    for (let i = -2; i < 8; i++) {
      ctx.beginPath();
      ctx.moveTo(i * 80, 256);
      ctx.lineTo(i * 80 + 256, 0);
      ctx.stroke();
    }
    ctx.fillStyle = '#241e08';
    ctx.textAlign = 'center';
    ctx.font = '700 46px Rajdhani, sans-serif';
    ctx.fillText('12V · 100Ah', 256, 120);
    ctx.font = '600 22px "JetBrains Mono", monospace';
    ctx.fillText('AGM DEEP CYCLE', 256, 160);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }, []);

  const makeScorchTexture = useCallback(() => {
    const c = document.createElement('canvas');
    c.width = 256;
    c.height = 256;
    const ctx = c.getContext('2d');
    const g = ctx.createRadialGradient(128, 128, 10, 128, 128, 120);
    g.addColorStop(0, 'rgba(10,6,4,0.9)');
    g.addColorStop(0.6, 'rgba(10,6,4,0.45)');
    g.addColorStop(1, 'rgba(10,6,4,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 256, 256);
    return new THREE.CanvasTexture(c);
  }, []);

  const makeTerminal = useCallback((id, color) => {
    const geo = new THREE.SphereGeometry(0.13, 16, 16);
    const mat = new THREE.MeshStandardMaterial({
      color,
      emissive: color,
      emissiveIntensity: 0.5,
      roughness: 0.4,
      metalness: 0.3
    });
    const m = new THREE.Mesh(geo, mat);
    m.userData = { terminalId: id, baseColor: color };
    m.castShadow = true;
    return m;
  }, []);

  // Model builders
  const buildPanel = useCallback((specs) => {
    const g = new THREE.Group();
    
    // Get dimensions based on specs (in mm, convert to meters)
    // 400W: 1855×1029mm, 550W: 2274×1134mm, 650W: 2382×1134mm
    const width = specs ? specs.dimensions[0] / 1000 : 1.855; // default 400W
    const height = specs ? specs.dimensions[1] / 1000 : 1.029;
    
    // Scale factor to keep consistent visual size
    const scaleX = width / 1.855;
    const scaleY = height / 1.029;
    
    // Frame thickness
    const frameThick = 0.04;
    const frameDepth = 0.03;
    
    // Material colors
    const frameColor = 0xb8bdb8;
    const frameInnerColor = 0x8a8f88;
    
    // === LEGS ===
    const legMat = new THREE.MeshStandardMaterial({ color: 0x8a8f88, roughness: 0.5, metalness: 0.6 });
    const leg1 = new THREE.Mesh(new THREE.BoxGeometry(0.12, 1.4, 0.12), legMat);
    leg1.position.set(-width * 0.35, 0.7, 0.55);
    leg1.rotation.x = -0.35;
    leg1.castShadow = true;
    const leg2 = leg1.clone();
    leg2.position.x = width * 0.35;
    g.add(leg1, leg2);
    
    // === FRAME (outer) ===
    const frameMat = new THREE.MeshStandardMaterial({ 
      color: frameColor, 
      roughness: 0.35, 
      metalness: 0.75 
    });
    
    // Create frame as a hollow box (using multiple planes)
    const frameGroup = new THREE.Group();
    
    // Top frame
    const topFrame = new THREE.Mesh(
      new THREE.BoxGeometry(width + frameThick * 2, frameThick, frameDepth),
      frameMat
    );
    topFrame.position.set(0, height / 2 + frameThick / 2, 0);
    topFrame.castShadow = true;
    frameGroup.add(topFrame);
    
    // Bottom frame
    const bottomFrame = topFrame.clone();
    bottomFrame.position.y = -(height / 2 + frameThick / 2);
    frameGroup.add(bottomFrame);
    
    // Left frame
    const leftFrame = new THREE.Mesh(
      new THREE.BoxGeometry(frameThick, height, frameDepth),
      frameMat
    );
    leftFrame.position.set(-(width / 2 + frameThick / 2), 0, 0);
    leftFrame.castShadow = true;
    frameGroup.add(leftFrame);
    
    // Right frame
    const rightFrame = leftFrame.clone();
    rightFrame.position.x = width / 2 + frameThick / 2;
    frameGroup.add(rightFrame);
    
    // === INNER FRAME (inset line) ===
    const innerFrameMat = new THREE.MeshStandardMaterial({ 
      color: frameInnerColor, 
      roughness: 0.4, 
      metalness: 0.7 
    });
    const innerInset = 0.012; // 12mm inset
    const innerThick = 0.008; // 8mm thick inset line
    
    const innerFrameGroup = new THREE.Group();
    
    // Inner top
    const innerTop = new THREE.Mesh(
      new THREE.BoxGeometry(width - innerInset * 2, innerThick, frameDepth * 0.3),
      innerFrameMat
    );
    innerTop.position.set(0, height / 2 - innerInset - innerThick / 2, frameDepth * 0.15);
    innerFrameGroup.add(innerTop);
    
    // Inner bottom
    const innerBottom = innerTop.clone();
    innerBottom.position.y = -(height / 2 - innerInset - innerThick / 2);
    innerFrameGroup.add(innerBottom);
    
    // Inner left
    const innerLeft = new THREE.Mesh(
      new THREE.BoxGeometry(innerThick, height - innerInset * 2 - innerThick * 2, frameDepth * 0.3),
      innerFrameMat
    );
    innerLeft.position.set(-(width / 2 - innerInset - innerThick / 2), 0, frameDepth * 0.15);
    innerFrameGroup.add(innerLeft);
    
    // Inner right
    const innerRight = innerLeft.clone();
    innerRight.position.x = width / 2 - innerInset - innerThick / 2;
    innerFrameGroup.add(innerRight);
    
    // === CELL SURFACE ===
    // Calculate cell grid based on aspect ratio
    // 400W: ~6×10 cells, 550W/650W: taller aspect ratio
    const cellAspect = width / height;
    let cols, rows;
    if (cellAspect > 1.8) {
      // 550W/650W: wider panels have more columns
      cols = 12;
      rows = Math.round(12 / cellAspect * 1.5);
    } else {
      // 400W: more square
      cols = 10;
      rows = 6;
    }
    
    const textures = makePanelTextures(cols, rows);
    
    const cellMat = new THREE.MeshStandardMaterial({
      map: textures.diffuse,
      roughnessMap: textures.roughness,
      bumpMap: textures.bump,
      bumpScale: 0.02,
      roughness: 0.15,
      metalness: 0.1
    });
    
    const cellSurface = new THREE.Mesh(
      new THREE.PlaneGeometry(width - frameThick * 2, height - frameThick * 2),
      cellMat
    );
    cellSurface.rotation.x = -Math.PI / 2;
    cellSurface.position.y = 0.001; // Just above frame
    cellSurface.receiveShadow = true;
    
    // === CROSSBAR ===
    const crossbarMat = new THREE.MeshStandardMaterial({ 
      color: frameColor, 
      roughness: 0.35, 
      metalness: 0.75 
    });
    const crossbar = new THREE.Mesh(
      new THREE.BoxGeometry(width - frameThick * 2, 0.025, 0.015),
      crossbarMat
    );
    crossbar.position.set(0, 0, frameDepth * 0.5 + 0.008);
    crossbar.castShadow = true;
    
    // === MOUNTING HOLES ===
    const holeMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.8 });
    const holeRadius = 0.015;
    const holePositions = [
      [-width * 0.35, height * 0.35],
      [width * 0.35, height * 0.35],
      [-width * 0.35, -height * 0.35],
      [width * 0.35, -height * 0.35],
    ];
    
    // === ASSEMBLE PANEL GROUP ===
    const panelGroup = new THREE.Group();
    panelGroup.add(frameGroup);
    panelGroup.add(innerFrameGroup);
    panelGroup.add(cellSurface);
    panelGroup.add(crossbar);
    
    // Add mounting holes
    holePositions.forEach(([x, y]) => {
      const hole = new THREE.Mesh(
        new THREE.CylinderGeometry(holeRadius, holeRadius, frameDepth * 1.5, 12),
        holeMat
      );
      hole.rotation.x = Math.PI / 2;
      hole.position.set(x, y, 0);
      panelGroup.add(hole);
    });
    
    // Position and tilt the panel
    panelGroup.position.set(0, height / 2 + 0.4, -0.05);
    panelGroup.rotation.x = -0.5;
    g.add(panelGroup);
    
    // === JUNCTION BOX ===
    const jbox = new THREE.Mesh(
      new THREE.BoxGeometry(0.4, 0.14, 0.14),
      new THREE.MeshStandardMaterial({ color: 0x1c1e19 })
    );
    jbox.position.set(0, height / 2 + 0.1, 0.62);
    g.add(jbox);
    
    // === TERMINALS ===
    const tPos = makeTerminal('p_pos', RED);
    tPos.position.set(-0.16, height / 2 + 0.1, 0.72);
    const tNeg = makeTerminal('p_neg', BLACK);
    tNeg.position.set(0.16, height / 2 + 0.1, 0.72);
    g.add(tPos, tNeg);
    
    g.userData.terminals = { p_pos: tPos, p_neg: tNeg };
    g.userData.paintables = [frameMat, cellMat, legMat];
    g.userData.panelSpecs = specs;
    
    return g;
  }, [makePanelTextures, makeTerminal]);

  const buildController = useCallback(() => {
    const g = new THREE.Group();
    const caseMat = new THREE.MeshStandardMaterial({ color: 0x2a2d26, roughness: 0.6, metalness: 0.25 });
    const body = new THREE.Mesh(new THREE.BoxGeometry(1.3, 1.6, 0.5), caseMat);
    body.position.y = 0.9;
    body.castShadow = true;
    body.receiveShadow = true;
    g.add(body);
    
    const screenMat = new THREE.MeshStandardMaterial({
      map: makeScreenTexture('MPPT', '#5be08a'),
      emissiveMap: makeScreenTexture('MPPT', '#5be08a'),
      emissive: 0xffffff,
      emissiveIntensity: 0.6,
      roughness: 0.3
    });
    const screen = new THREE.Mesh(new THREE.PlaneGeometry(0.85, 0.42), screenMat);
    screen.position.set(0, 1.25, 0.26);
    g.add(screen);
    
    const led = new THREE.Mesh(
      new THREE.SphereGeometry(0.05, 8, 8),
      new THREE.MeshStandardMaterial({ color: 0xff9a3c, emissive: 0xff9a3c, emissiveIntensity: 1 })
    );
    led.position.set(0.45, 1.55, 0.27);
    g.add(led);
    
    for (let i = 0; i < 4; i++) {
      const vent = new THREE.Mesh(
        new THREE.BoxGeometry(0.9, 0.03, 0.02),
        new THREE.MeshStandardMaterial({ color: 0x0e0f0b })
      );
      vent.position.set(0, 0.98 - i * 0.08, 0.26);
      g.add(vent);
    }
    
    const t1 = makeTerminal('c_pv_pos', RED);
    t1.position.set(-0.42, 0.32, 0.28);
    const t2 = makeTerminal('c_pv_neg', BLACK);
    t2.position.set(-0.16, 0.32, 0.28);
    const t3 = makeTerminal('c_bat_pos', RED);
    t3.position.set(0.16, 0.32, 0.28);
    const t4 = makeTerminal('c_bat_neg', BLACK);
    t4.position.set(0.42, 0.32, 0.28);
    g.add(t1, t2, t3, t4);
    
    g.userData.terminals = { c_pv_pos: t1, c_pv_neg: t2, c_bat_pos: t3, c_bat_neg: t4 };
    g.userData.paintables = [caseMat];
    return g;
  }, [makeScreenTexture, makeTerminal]);

  const buildBattery = useCallback(() => {
    const g = new THREE.Group();
    const caseMat = new THREE.MeshStandardMaterial({ color: 0x1e211c, roughness: 0.55, metalness: 0.15 });
    const body = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.85, 0.9), caseMat);
    body.position.y = 0.43;
    body.castShadow = true;
    body.receiveShadow = true;
    g.add(body);
    
    const labelMat = new THREE.MeshStandardMaterial({ map: makeBatteryLabel(), roughness: 0.5 });
    const label = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 0.5), labelMat);
    label.position.set(0, 0.5, 0.46);
    g.add(label);
    
    const postMat = new THREE.MeshStandardMaterial({ color: 0xcfcabb, roughness: 0.4, metalness: 0.6 });
    const post1 = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.12, 12), postMat);
    post1.position.set(-0.55, 0.91, 0);
    post1.castShadow = true;
    const post2 = post1.clone();
    post2.position.x = 0.55;
    g.add(post1, post2);
    
    const t1 = makeTerminal('b_pos', RED);
    t1.position.set(-0.55, 1.02, 0);
    const t2 = makeTerminal('b_neg', BLACK);
    t2.position.set(0.55, 1.02, 0);
    g.add(t1, t2);
    
    g.userData.terminals = { b_pos: t1, b_neg: t2 };
    g.userData.paintables = [caseMat];
    return g;
  }, [makeBatteryLabel, makeTerminal]);

  const buildInverter = useCallback(() => {
    const g = new THREE.Group();
    const caseMat = new THREE.MeshStandardMaterial({ color: 0xa3a89c, roughness: 0.35, metalness: 0.75 });
    const body = new THREE.Mesh(new THREE.BoxGeometry(1.15, 1.7, 0.5), caseMat);
    body.position.y = 0.95;
    body.castShadow = true;
    body.receiveShadow = true;
    g.add(body);
    
    const screenMat = new THREE.MeshStandardMaterial({
      map: makeScreenTexture('120V', '#4ee08a'),
      emissiveMap: makeScreenTexture('120V', '#4ee08a'),
      emissive: 0xffffff,
      emissiveIntensity: 0.6
    });
    const screen = new THREE.Mesh(new THREE.PlaneGeometry(0.75, 0.36), screenMat);
    screen.position.set(0, 1.4, 0.26);
    g.add(screen);
    
    for (let i = 0; i < 6; i++) {
      const vent = new THREE.Mesh(
        new THREE.BoxGeometry(0.03, 0.55, 0.02),
        new THREE.MeshStandardMaterial({ color: 0x2a2d27 })
      );
      vent.position.set(-0.42 + i * 0.16, 0.85, 0.26);
      g.add(vent);
    }
    
    const t1 = makeTerminal('i_pos', RED);
    t1.position.set(-0.2, 0.24, 0.28);
    const t2 = makeTerminal('i_neg', BLACK);
    t2.position.set(0.2, 0.24, 0.28);
    g.add(t1, t2);
    
    g.userData.terminals = { i_pos: t1, i_neg: t2 };
    g.userData.paintables = [caseMat];
    return g;
  }, [makeScreenTexture, makeTerminal]);

  const BUILDERS = { panel: buildPanel, controller: buildController, battery: buildBattery, inverter: buildInverter };

  // Initialize scene
  useEffect(() => {
    if (!canvasRef.current) return;

    const canvas = canvasRef.current;
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0d0f0a);
    scene.fog = new THREE.Fog(0x0d0f0a, 16, 34);
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100);
    camera.position.set(11, 10, 13);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    rendererRef.current = renderer;

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.set(0, 1, 0);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.minDistance = 9;
    controls.maxDistance = 24;
    controls.maxPolarAngle = Math.PI * 0.49;
    controls.minPolarAngle = Math.PI * 0.18;
    controls.enablePan = false;
    controls.update();
    controlsRef.current = controls;

    // Lights (intensities multiplied for Three.js 0.152+ compatibility)
    const hemi = new THREE.HemisphereLight(0x8fa0a8, 0x1a1712, 9);
    scene.add(hemi);
    const sun = new THREE.DirectionalLight(0xfff2d8, 13.5);
    sun.position.set(9, 14, 6);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.left = -12;
    sun.shadow.camera.right = 12;
    sun.shadow.camera.top = 12;
    sun.shadow.camera.bottom = -12;
    sun.shadow.camera.near = 1;
    sun.shadow.camera.far = 40;
    sun.shadow.bias = -0.0018;
    scene.add(sun);
    const fillLight = new THREE.DirectionalLight(0x6a90ff, 1.8);
    fillLight.position.set(-8, 6, -8);
    scene.add(fillLight);

    // Ground
    const groundGeo = new THREE.PlaneGeometry(16, 12, 1, 1);
    const groundMat = new THREE.MeshStandardMaterial({
      map: makeGroundTexture(),
      roughness: 0.95,
      metalness: 0.02
    });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    scene.add(ground);

    // House
    const houseMat = new THREE.MeshStandardMaterial({ color: 0x3a3f35, roughness: 0.9 });
    const houseBody = new THREE.Mesh(new THREE.BoxGeometry(6.2, 2.6, 2.2), houseMat);
    houseBody.position.set(-4.3, 1.3, -5.6);
    houseBody.castShadow = true;
    houseBody.receiveShadow = true;
    scene.add(houseBody);
    
    const roofMat = new THREE.MeshStandardMaterial({ color: 0x5a4133, roughness: 0.85 });
    const roofSlab = new THREE.Mesh(new THREE.BoxGeometry(6.6, 0.25, 3.6), roofMat);
    roofSlab.position.set(-4.3, 2.75, -4.3);
    roofSlab.rotation.x = -0.28;
    roofSlab.castShadow = true;
    roofSlab.receiveShadow = true;
    scene.add(roofSlab);
    
    const wallMat = new THREE.MeshStandardMaterial({ color: 0x33372e, roughness: 0.9 });
    const wallSlab = new THREE.Mesh(new THREE.BoxGeometry(7.4, 3.0, 0.3), wallMat);
    wallSlab.position.set(4.0, 1.5, -4.6);
    wallSlab.castShadow = true;
    wallSlab.receiveShadow = true;
    scene.add(wallSlab);

    // Groups
    const wiresGroup = new THREE.Group();
    scene.add(wiresGroup);
    wiresGroupRef.current = wiresGroup;
    
    const fxLayer = new THREE.Group();
    scene.add(fxLayer);
    fxLayerRef.current = fxLayer;

    // Resize handler
    const resize = () => {
      const rect = canvas.parentElement.getBoundingClientRect();
      camera.aspect = rect.width / rect.height;
      camera.updateProjectionMatrix();
      renderer.setSize(rect.width, rect.height, false);
    };
    window.addEventListener('resize', resize);
    resize();

    // Animation loop
    let animationId;
    const animate = () => {
      animationId = requestAnimationFrame(animate);
      const dt = 0.016;
      
      // Update particles
      particlesRef.current = particlesRef.current.filter(p => {
        p.age += dt;
        if (p.age > p.life) {
          fxLayer.remove(p.mesh);
          return false;
        }
        if (p.smoke) {
          p.mesh.position.addScaledVector(p.vel, dt);
          p.mesh.scale.multiplyScalar(1 + dt * 0.6);
          p.mesh.material.opacity = 0.55 * (1 - p.age / p.life);
        } else {
          p.vel.y -= 4.5 * dt;
          p.mesh.position.addScaledVector(p.vel, dt);
          p.mesh.material.emissiveIntensity = Math.max(0, 1.6 * (1 - p.age / p.life));
          p.mesh.scale.setScalar(Math.max(0.05, 1 - p.age / p.life));
        }
        return true;
      });
      
      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    return () => {
      window.removeEventListener('resize', resize);
      cancelAnimationFrame(animationId);
      renderer.dispose();
    };
  }, [makeGroundTexture]);

  const placeComponent = useCallback((type, x, z, onPlaced, specs) => {
    if (!sceneRef.current) return;
    
    // Pass specs to panel builder
    const group = type === 'panel' && specs 
      ? BUILDERS[type](specs) 
      : BUILDERS[type]();
    
    group.position.set(x, 0, z);
    sceneRef.current.add(group);
    modelsRef.current[type] = group;
    Object.entries(group.userData.terminals).forEach(([id, mesh]) => {
      terminalRegistryRef.current[id] = mesh;
    });

    const ind = new THREE.Mesh(
      new THREE.SphereGeometry(0.09, 10, 10),
      new THREE.MeshStandardMaterial({ color: 0xf0a83f, emissive: 0xf0a83f, emissiveIntensity: 0.9 })
    );
    ind.position.set(x, 2.5, z);
    sceneRef.current.add(ind);
    indicatorsRef.current[type] = ind;

    onPlaced(type);
    
    const count = Object.values(modelsRef.current).filter(Boolean).length;
    setBadgeText(`${count} / 4 placed`);
    setIsEmpty(count === 0);
  }, [BUILDERS]);

  const terminalWorldPos = useCallback((id) => {
    const mesh = terminalRegistryRef.current[id];
    if (!mesh) return null;
    const v = new THREE.Vector3();
    mesh.getWorldPosition(v);
    return v;
  }, []);

  const drawWires = useCallback((connections, destroyed, liveWires, blockedWires) => {
    if (!wiresGroupRef.current) return;
    wiresGroupRef.current.clear();
    const scorchTex = makeScorchTexture();

    connections.forEach(c => {
      const p1 = terminalWorldPos(c.a);
      const p2 = terminalWorldPos(c.b);
      if (!p1 || !p2) return;
      
      const mid = p1.clone().lerp(p2, 0.5);
      mid.y += 0.55;
      const curve = new THREE.QuadraticBezierCurve3(p1, mid, p2);
      
      const touchesDestroyed = destroyed[OWNER[c.a]] || destroyed[OWNER[c.b]];
      const isPos = c.a.endsWith('pos') || c.b.endsWith('pos');
      const key = [c.a, c.b].sort().join('|');
      
      let color = isPos ? RED : 0x3f4338;
      let emissive = 0x000000;
      let intensity = 0;
      
      if (touchesDestroyed) {
        color = 0xff4a1c;
        emissive = 0xff4a1c;
        intensity = 0.9;
      } else if (liveWires.has(key)) {
        color = isPos ? 0xff8a5c : 0x4ee08a;
        emissive = color;
        intensity = 0.7;
      } else if (blockedWires.has(key)) {
        color = 0x555a4e;
      }
      
      const geo = new THREE.TubeGeometry(curve, 24, 0.045, 8, false);
      const mat = new THREE.MeshStandardMaterial({
        color,
        emissive,
        emissiveIntensity: intensity,
        roughness: 0.4,
        metalness: 0.2
      });
      const tube = new THREE.Mesh(geo, mat);
      tube.castShadow = true;
      wiresGroupRef.current.add(tube);
    });
  }, [terminalWorldPos, makeScorchTexture]);

  const spawnBurst = useCallback((center, good) => {
    if (!fxLayerRef.current) return;
    for (let i = 0; i < 16; i++) {
      const geo = new THREE.SphereGeometry(0.045, 6, 6);
      const col = good ? 0x8ef5b4 : 0xffb35a;
      const mat = new THREE.MeshStandardMaterial({ color: col, emissive: col, emissiveIntensity: 1.6 });
      const m = new THREE.Mesh(geo, mat);
      m.position.copy(center);
      const dir = new THREE.Vector3(
        (Math.random() - 0.5),
        (Math.random() * 0.8 + 0.2),
        (Math.random() - 0.5)
      ).normalize();
      const speed = 2.2 + Math.random() * 2.2;
      fxLayerRef.current.add(m);
      particlesRef.current.push({
        mesh: m,
        vel: dir.multiplyScalar(speed),
        life: 0.7 + Math.random() * 0.3,
        age: 0,
        gravity: !good
      });
    }
    
    if (!good) {
      for (let i = 0; i < 8; i++) {
        const geo = new THREE.SphereGeometry(0.22 + Math.random() * 0.12, 8, 8);
        const mat = new THREE.MeshStandardMaterial({
          color: 0x4a4d46,
          transparent: true,
          opacity: 0.55,
          roughness: 1
        });
        const m = new THREE.Mesh(geo, mat);
        m.position.copy(center).add(new THREE.Vector3(
          (Math.random() - 0.5) * 0.4,
          0,
          (Math.random() - 0.5) * 0.4
        ));
        fxLayerRef.current.add(m);
        particlesRef.current.push({
          mesh: m,
          vel: new THREE.Vector3(
            (Math.random() - 0.5) * 0.3,
            1.1 + Math.random() * 0.5,
            (Math.random() - 0.5) * 0.3
          ),
          life: 1.6,
          age: 0,
          smoke: true
        });
      }
    }
  }, []);

  const darkenModel = useCallback((group) => {
    group.userData.paintables.forEach(mat => {
      mat.color.multiplyScalar(0.15);
      if (mat.emissive) mat.emissive.setRGB(0.05, 0.02, 0.01);
    });
  }, []);

  const addScorch = useCallback((pos) => {
    if (!sceneRef.current) return;
    const scorchTex = makeScorchTexture();
    const mat = new THREE.MeshBasicMaterial({
      map: scorchTex,
      transparent: true,
      depthWrite: false
    });
    const plane = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 1.6), mat);
    plane.rotation.x = -Math.PI / 2;
    plane.position.set(pos.x, 0.02, pos.z);
    sceneRef.current.add(plane);
    scorchPlanesRef.current.push(plane);
  }, [makeScorchTexture]);

  const fireExplosion = useCallback((key, onExplosion) => {
    const group = modelsRef.current[key];
    if (group) {
      const center = new THREE.Vector3();
      group.getWorldPosition(center);
      center.y += 0.8;
      spawnBurst(center, false);
      addScorch(group.position);
      darkenModel(group);
      
      const startPos = group.position.clone();
      let t = 0;
      const shake = () => {
        t += 1;
        if (t > 18) {
          group.position.copy(startPos);
          return;
        }
        group.position.set(
          startPos.x + (Math.random() - 0.5) * 0.06,
          startPos.y,
          startPos.z + (Math.random() - 0.5) * 0.06
        );
        requestAnimationFrame(shake);
      };
      shake();
    }
    onExplosion(key);
  }, [spawnBurst, addScorch, darkenModel]);

  const celebrate = useCallback(() => {
    ['panel', 'controller', 'battery', 'inverter'].forEach(k => {
      const group = modelsRef.current[k];
      if (!group) return;
      const center = new THREE.Vector3();
      group.getWorldPosition(center);
      center.y += 1;
      spawnBurst(center, true);
    });
  }, [spawnBurst]);

  const updateIndicators = useCallback((destroyed, fullyCorrect) => {
    Object.keys(indicatorsRef.current).forEach(k => {
      const ind = indicatorsRef.current[k];
      if (!ind) return;
      if (destroyed[k]) {
        ind.material.color.setHex(0x2a1410);
        ind.material.emissiveIntensity = 0;
        return;
      }
      const col = fullyCorrect ? 0x4ee08a : 0xf0a83f;
      ind.material.color.setHex(col);
      ind.material.emissive.setHex(col);
      ind.material.emissiveIntensity = 0.9;
    });
  }, []);

  const fullReset = useCallback((onReset) => {
    Object.keys(modelsRef.current).forEach(k => {
      if (modelsRef.current[k]) {
        sceneRef.current.remove(modelsRef.current[k]);
        modelsRef.current[k] = null;
      }
    });
    Object.keys(indicatorsRef.current).forEach(k => {
      if (indicatorsRef.current[k]) {
        sceneRef.current.remove(indicatorsRef.current[k]);
        delete indicatorsRef.current[k];
      }
    });
    Object.keys(terminalRegistryRef.current).forEach(k => delete terminalRegistryRef.current[k]);
    scorchPlanesRef.current.forEach(o => sceneRef.current.remove(o));
    scorchPlanesRef.current = [];
    particlesRef.current.forEach(p => fxLayerRef.current?.remove(p.mesh));
    particlesRef.current = [];
    if (wiresGroupRef.current) wiresGroupRef.current.clear();
    
    setBadgeText('0 / 4 placed');
    setIsEmpty(true);
    onReset();
  }, []);

  const handleTerminalTap = useCallback((id, onTap) => {
    const mesh = terminalRegistryRef.current[id];
    if (!mesh) return;
    onTap(id, mesh);
  }, []);

  const selectTerminal = useCallback((id) => {
    const mesh = terminalRegistryRef.current[id];
    if (!mesh) return;
    mesh.material.emissiveIntensity = 1.4;
    mesh.scale.setScalar(1.4);
  }, []);

  const deselectTerminal = useCallback((id) => {
    const mesh = terminalRegistryRef.current[id];
    if (!mesh) return;
    mesh.material.emissiveIntensity = 0.5;
    mesh.scale.setScalar(1);
  }, []);

  const resetTerminal = useCallback((id) => {
    const mesh = terminalRegistryRef.current[id];
    if (!mesh) return;
    mesh.material.emissiveIntensity = 0.5;
    mesh.scale.setScalar(1);
  }, []);

  return {
    canvasRef,
    badgeText,
    isEmpty,
    placeComponent,
    terminalWorldPos,
    drawWires,
    fireExplosion,
    celebrate,
    updateIndicators,
    fullReset,
    handleTerminalTap,
    selectTerminal,
    deselectTerminal,
    resetTerminal
  };
}
