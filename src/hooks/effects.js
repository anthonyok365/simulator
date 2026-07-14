import * as THREE from 'three';
import { makeScorchTexture } from './textures';

export function spawnBurst(fxLayerRef, particlesRef, center, good) {
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
}

export function darkenModel(group) {
  group.userData.paintables.forEach(mat => {
    mat.color.multiplyScalar(0.15);
    if (mat.emissive) mat.emissive.setRGB(0.05, 0.02, 0.01);
  });
}

export function addScorch(sceneRef, scorchPlanesRef, pos) {
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
}

export function fireExplosion(modelsRef, fxLayerRef, particlesRef, scorchPlanesRef, sceneRef, key, onExplosion) {
  const group = modelsRef.current[key];
  if (group) {
    const center = new THREE.Vector3();
    group.getWorldPosition(center);
    center.y += 0.8;
    spawnBurst(fxLayerRef, particlesRef, center, false);
    addScorch(sceneRef, scorchPlanesRef, group.position);
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
}

export function celebrate(modelsRef, fxLayerRef, particlesRef) {
  ['panel', 'controller', 'battery', 'inverter'].forEach(k => {
    const group = modelsRef.current[k];
    if (!group) return;
    const center = new THREE.Vector3();
    group.getWorldPosition(center);
    center.y += 1;
    spawnBurst(fxLayerRef, particlesRef, center, true);
  });
}
