import * as THREE from 'three';
import { OWNER, RED } from '../utils/constants';
import { getTerminalWorldPos } from './terminals';
import { buildResidentialBackdrop, buildCommercialBackdrop, buildUtilityBackdrop } from './backgrounds';

export function drawWires(wiresGroupRef, terminalRegistryRef, connections, destroyed, liveWires, blockedWires) {
  if (!wiresGroupRef.current) return;
  wiresGroupRef.current.clear();

  connections.forEach(c => {
    const p1 = getTerminalWorldPos(terminalRegistryRef, c.a);
    const p2 = getTerminalWorldPos(terminalRegistryRef, c.b);
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
}

export function updateIndicators(indicatorsRef, destroyed, fullyCorrect) {
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
}

export function fitCameraToArray(camera, controls, width, depth, tier) {
  let distance, targetY;

  if (tier === 'residential') {
    distance = 18;
    targetY = 2;
  } else if (tier === 'commercial') {
    distance = 30;
    targetY = 3;
  } else {
    distance = 60;
    targetY = 5;
  }

  const startPos = camera.position.clone();
  const endPos = new THREE.Vector3(distance * 0.7, distance * 0.5, distance);
  const duration = 1000;
  const startTime = Date.now();

  const animateCamera = () => {
    const elapsed = Date.now() - startTime;
    const t = Math.min(elapsed / duration, 1);
    const ease = 1 - Math.pow(1 - t, 3);

    camera.position.lerpVectors(startPos, endPos, ease);
    controls.target.set(0, targetY, 0);
    controls.update();

    if (t < 1) requestAnimationFrame(animateCamera);
  };

  animateCamera();
}

export function setBackground(sceneRef, cameraRef, controlsRef, backdropObjectsRef, currentBackdropRef, panelCount, arrayWidth, arrayDepth) {
  const scene = sceneRef.current;
  const camera = cameraRef.current;
  const controls = controlsRef.current;
  if (!scene || !camera || !controls) return;

  let tier;
  if (panelCount <= 10) tier = 'residential';
  else if (panelCount <= 50) tier = 'commercial';
  else tier = 'utility';

  if (currentBackdropRef.current === tier) {
    fitCameraToArray(camera, controls, arrayWidth, arrayDepth, tier);
    return;
  }

  backdropObjectsRef.current.forEach(obj => scene.remove(obj));
  backdropObjectsRef.current = [];

  if (tier === 'residential') {
    buildResidentialBackdrop(scene);
  } else if (tier === 'commercial') {
    buildCommercialBackdrop(scene);
  } else {
    buildUtilityBackdrop(scene);
  }

  currentBackdropRef.current = tier;
  fitCameraToArray(camera, controls, arrayWidth, arrayDepth, tier);
}

export function fullResetScene(sceneRef, modelsRef, indicatorsRef, terminalRegistryRef, scorchPlanesRef, particlesRef, fxLayerRef, wiresGroupRef, setBadgeText, setIsEmpty, onReset) {
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
}
