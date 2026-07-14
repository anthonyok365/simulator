import { useEffect, useRef, useCallback, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

import { makeGroundTexture } from './textures';
import { buildResidentialBackdrop } from './backgrounds';
import { BUILDERS } from './models';
import { fireExplosion, celebrate } from './effects';
import { selectTerminal, deselectTerminal, resetTerminal, handleTerminalTap } from './terminals';
// Alias to avoid naming conflict
import { handleTerminalTap as doTerminalTap } from './terminals';
import { drawWires, updateIndicators, setBackground, fullResetScene } from './sceneUtils';

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
  const backgroundGroupRef = useRef(null);
  const currentBackdropRef = useRef('residential');
  const backdropObjectsRef = useRef([]);
  const particlesRef = useRef([]);
  const scorchPlanesRef = useRef([]);

  const [badgeText, setBadgeText] = useState('0 / 4 placed');
  const [isEmpty, setIsEmpty] = useState(true);

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

    // Lights
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

    // Background management
    const backgroundGroup = new THREE.Group();
    scene.add(backgroundGroup);
    backgroundGroupRef.current = backgroundGroup;

    // Default to residential backdrop
    buildResidentialBackdrop(scene);
    currentBackdropRef.current = 'residential';

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
  }, []);

  const placeComponent = useCallback((type, x, z, onPlaced, specs, seriesCount, parallelCount) => {
    if (!sceneRef.current) return;

    const group = type === 'panel' && specs
      ? BUILDERS[type](specs, seriesCount, parallelCount)
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
  }, []);

  const terminalWorldPos = useCallback((id) => {
    const mesh = terminalRegistryRef.current[id];
    if (!mesh) return null;
    const v = new THREE.Vector3();
    mesh.getWorldPosition(v);
    return v;
  }, []);

  const handleDrawWires = useCallback((connections, destroyed, liveWires, blockedWires) => {
    drawWires(wiresGroupRef, terminalRegistryRef, connections, destroyed, liveWires, blockedWires);
  }, []);

  const handleFireExplosion = useCallback((key, onExplosion) => {
    fireExplosion(modelsRef, fxLayerRef, particlesRef, scorchPlanesRef, sceneRef, key, onExplosion);
  }, []);

  const handleCelebrate = useCallback(() => {
    celebrate(modelsRef, fxLayerRef, particlesRef);
  }, []);

  const handleUpdateIndicators = useCallback((destroyed, fullyCorrect) => {
    updateIndicators(indicatorsRef, destroyed, fullyCorrect);
  }, []);

  const handleFullReset = useCallback((onReset) => {
    fullResetScene(sceneRef, modelsRef, indicatorsRef, terminalRegistryRef, scorchPlanesRef, particlesRef, fxLayerRef, wiresGroupRef, setBadgeText, setIsEmpty, onReset);
  }, []);

  const handleTerminalSelect = useCallback((id) => {
    selectTerminal(terminalRegistryRef, id);
  }, []);

  const handleTerminalDeselect = useCallback((id) => {
    deselectTerminal(terminalRegistryRef, id);
  }, []);

  const handleTerminalReset = useCallback((id) => {
    resetTerminal(terminalRegistryRef, id);
  }, []);

  const handleTerminalTap = useCallback((id, onTap) => {
    doTerminalTap(terminalRegistryRef, id, onTap);
  }, []);

  const handleSetBackground = useCallback((panelCount, arrayWidth, arrayDepth) => {
    setBackground(sceneRef, cameraRef, controlsRef, backdropObjectsRef, currentBackdropRef, panelCount, arrayWidth, arrayDepth);
  }, []);

  return {
    canvasRef,
    badgeText,
    isEmpty,
    placeComponent,
    terminalWorldPos,
    drawWires: handleDrawWires,
    fireExplosion: handleFireExplosion,
    celebrate: handleCelebrate,
    updateIndicators: handleUpdateIndicators,
    fullReset: handleFullReset,
    handleTerminalTap,
    selectTerminal: handleTerminalSelect,
    deselectTerminal: handleTerminalDeselect,
    resetTerminal: handleTerminalReset,
    setBackground: handleSetBackground
  };
}
