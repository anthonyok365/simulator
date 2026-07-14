import * as THREE from 'three';
import { ZONES } from '../utils/constants';

// Reference to currently loaded panel texture (will be set when user provides image)
let panelTextureRef = null;

export function makeGroundTexture() {
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
}

export function makeScreenTexture(text, color) {
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
}

export function loadPanelTexture() {
  if (panelTextureRef) return panelTextureRef;
  
  const loader = new THREE.TextureLoader();
  loader.load(
    '/src/assets/textures/panel-reference.jpg',
    (texture) => {
      panelTextureRef = texture;
      texture.wrapS = THREE.RepeatWrapping;
      texture.wrapT = THREE.RepeatWrapping;
      texture.colorSpace = THREE.SRGBColorSpace;
    },
    undefined,
    () => {
      console.warn('Panel reference image not found, using procedural fallback');
    }
  );
  return null;
}

export function makePanelTexture(cols, rows, panelWidth, panelHeight) {
  const aspect = panelWidth / panelHeight;

  const HEIGHT = 512;
  const WIDTH = Math.floor(HEIGHT * aspect);

  const canvas = document.createElement('canvas');
  canvas.width = WIDTH;
  canvas.height = HEIGHT;
  SIZE = HEIGHT;

  const ctx = canvas.getContext('2d');
  
  ctx.fillStyle = '#0a0a0d';
  ctx.fillRect(0, 0, WIDTH, HEIGHT);
  
  const cellW = WIDTH / cols;
  const cellH = HEIGHT / rows;
  
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const brightness = 0.92 + Math.random() * 0.08;
      ctx.fillStyle = `rgb(${Math.floor(10 * brightness)},${Math.floor(10 * brightness)},${Math.floor(13 * brightness)})`;
      ctx.fillRect(c * cellW + 1, r * cellH + 1, cellW - 2, cellH - 2);
    }
  }
  
  ctx.strokeStyle = 'rgba(74, 77, 82, 0.35)';
  ctx.lineWidth = 0.5;
  
  for (let c = 0; c < cols; c++) {
    for (let i = 1; i <= 11; i++) {
      const x = c * cellW + (i / 12) * cellW;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, HEIGHT);
      ctx.stroke();
    }
  }
  
  for (let r = 0; r < rows; r++) {
    for (let i = 1; i <= 3; i++) {
      const y = r * cellH + (i / 4) * cellH;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(WIDTH, y);
      ctx.stroke();
    }
  }
  
  ctx.strokeStyle = 'rgba(5, 5, 6, 0.8)';
  ctx.lineWidth = 2;
  for (let c = 0; c <= cols; c++) {
    ctx.beginPath();
    ctx.moveTo(c * cellW, 0);
    ctx.lineTo(c * cellW, HEIGHT);
    ctx.stroke();
  }
  for (let r = 0; r <= rows; r++) {
    ctx.beginPath();
    ctx.moveTo(0, r * cellH);
    ctx.lineTo(WIDTH, r * cellH);
    ctx.stroke();
  }
  
  const grad = ctx.createLinearGradient(0, 0, WIDTH * 0.3, HEIGHT * 0.3);
  grad.addColorStop(0, 'rgba(255,255,255,0.1)');
  grad.addColorStop(0.5, 'rgba(255,255,255,0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);
  
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.colorSpace = THREE.SRGBColorSpace;
  
  return texture;
}

export function makeBatteryLabel() {
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
}

export function makeScorchTexture() {
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
}
