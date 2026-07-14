import * as THREE from 'three';

export function buildResidentialBackdrop(scene) {
  const group = new THREE.Group();
  
  // House body

  // Pitched roof


  // Back wall


  scene.add(group);
  return group;
}

export function buildCommercialBackdrop(scene) {
  const group = new THREE.Group();
  
  // Ground (gravel/concrete pad)
  const padMat = new THREE.MeshStandardMaterial({ color: 0x4a4a42, roughness: 0.95 });
  const pad = new THREE.Mesh(new THREE.PlaneGeometry(30, 20), padMat);
  pad.rotation.x = -Math.PI / 2;
  pad.position.y = 0.01;
  pad.receiveShadow = true;
  group.add(pad);
  
  // Chain-link fence outline
  const fenceMat = new THREE.MeshStandardMaterial({ color: 0x3a3a32, roughness: 0.7, metalness: 0.5 });
  
  // Fence posts
  for (let i = -12; i <= 12; i += 2) {
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.08, 2.0, 0.08), fenceMat);
    post.position.set(i, 1.0, -10);
    post.castShadow = true;
    group.add(post);
  }
  
  // Equipment shed
  const shedMat = new THREE.MeshStandardMaterial({ color: 0x2a2d28, roughness: 0.8 });
  const shed = new THREE.Mesh(new THREE.BoxGeometry(5, 3, 4), shedMat);
  shed.position.set(-8, 1.5, -8);
  shed.castShadow = true;
  shed.receiveShadow = true;
  group.add(shed);
  
  // Shed roof
  const shedRoof = new THREE.Mesh(new THREE.BoxGeometry(5.4, 0.2, 4.4), fenceMat);
  shedRoof.position.set(-8, 3.1, -8);
  shedRoof.castShadow = true;
  group.add(shedRoof);
  
  scene.add(group);
  return group;
}

export function buildUtilityBackdrop(scene) {
  const group = new THREE.Group();
  
  // Open field ground
  const fieldMat = new THREE.MeshStandardMaterial({ color: 0x2d3028, roughness: 1.0 });
  const field = new THREE.Mesh(new THREE.PlaneGeometry(100, 80), fieldMat);
  field.rotation.x = -Math.PI / 2;
  field.receiveShadow = true;
  group.add(field);
  
  // Tree line silhouette (horizon)
  const treeMat = new THREE.MeshStandardMaterial({ color: 0x1a1a18, roughness: 1.0 });
  for (let x = -40; x <= 40; x += 2) {
    const height = 3 + Math.random() * 4;
    const tree = new THREE.Mesh(new THREE.ConeGeometry(1.5, height, 6), treeMat);
    tree.position.set(x + Math.random() * 0.5, height / 2, -35);
    group.add(tree);
  }
  
  // Gravel access road
  const roadMat = new THREE.MeshStandardMaterial({ color: 0x3a3a32, roughness: 0.9 });
  const road = new THREE.Mesh(new THREE.PlaneGeometry(6, 60), roadMat);
  road.rotation.x = -Math.PI / 2;
  road.position.set(20, 0.02, 0);
  road.receiveShadow = true;
  group.add(road);
  
  scene.add(group);
  return group;
}
