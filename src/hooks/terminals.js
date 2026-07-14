import * as THREE from 'three';

export function makeTerminal(id, color) {
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
}

export function selectTerminal(terminalRegistryRef, id) {
  const mesh = terminalRegistryRef.current[id];
  if (!mesh) return;
  mesh.material.emissiveIntensity = 1.4;
  mesh.scale.setScalar(1.4);
}

export function deselectTerminal(terminalRegistryRef, id) {
  const mesh = terminalRegistryRef.current[id];
  if (!mesh) return;
  mesh.material.emissiveIntensity = 0.5;
  mesh.scale.setScalar(1);
}

export function resetTerminal(terminalRegistryRef, id) {
  const mesh = terminalRegistryRef.current[id];
  if (!mesh) return;
  mesh.material.emissiveIntensity = 0.5;
  mesh.scale.setScalar(1);
}

export function handleTerminalTap(terminalRegistryRef, id, onTap) {
  const mesh = terminalRegistryRef.current[id];
  if (!mesh) return;
  onTap(id, mesh);
}

export function getTerminalWorldPos(terminalRegistryRef, id) {
  const mesh = terminalRegistryRef.current[id];
  if (!mesh) return null;
  const v = new THREE.Vector3();
  mesh.getWorldPosition(v);
  return v;
}
