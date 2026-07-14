import * as THREE from 'three';
import { RED, BLACK } from '../utils/constants';
import { makeScreenTexture, makeBatteryLabel, loadPanelTexture } from './textures';
import { makeTerminal } from './terminals';

// Real dimensions only. If the photo texture fails to load, log it loudly rather
// than silently falling back to a procedural grid — that fallback is what caused
// the "toy" look in the first place, so it should never be the default path.
function getPanelTexture() {
  const tex = loadPanelTexture();
  if (!tex) {
    console.error('[panels] Real panel photo failed to load — check the texture path. Rendering will look wrong without it.');
  }
  return tex;
}

const railMat = new THREE.MeshStandardMaterial({ color: 0x9aa0a0, roughness: 0.55, metalness: 0.65 });
const groundWireMat = new THREE.MeshStandardMaterial({ color: 0xc9a24a, roughness: 0.4, metalness: 0.7 });

// A single panel: real photo on the face, a thin backing for edge thickness,
// terminal markers. No procedural frame geometry — the photo already has a frame in it.
export function buildSinglePanel(specs, texture) {
  const width = specs ? specs.dimensions[0] / 1000 : 1.029;
  const height = specs ? specs.dimensions[1] / 1000 : 1.855;

  const g = new THREE.Group();

  const backingMat = new THREE.MeshStandardMaterial({ color: 0xb9bdb8, roughness: 0.45, metalness: 0.55 });
  const backing = new THREE.Mesh(new THREE.BoxGeometry(width, height, 0.03), backingMat);
  backing.position.y = height / 2;
  backing.castShadow = true;
  backing.receiveShadow = true;
  g.add(backing);

  const faceMat = new THREE.MeshStandardMaterial({ map: texture, roughness: 0.22, metalness: 0.12 });
  const face = new THREE.Mesh(new THREE.PlaneGeometry(width * 0.97, height * 0.97), faceMat);
  face.position.set(0, height / 2, 0.019);
  face.castShadow = true;
  g.add(face);

  const tPos = makeTerminal('p_pos', RED);
  tPos.position.set(-width * 0.28, 0.05, 0.05);
  const tNeg = makeTerminal('p_neg', BLACK);
  tNeg.position.set(width * 0.28, 0.05, 0.05);
  g.add(tPos, tNeg);
  g.userData.terminals = { pos: tPos, neg: tNeg };

  return g;
}

export function makeJumperCable(startPos, endPos, isPositive) {
  const cableGroup = new THREE.Group();
  const cableMat = new THREE.MeshStandardMaterial({
    color: isPositive ? 0xe8503a : 0x2c2f28,
    roughness: 0.6,
    metalness: 0.2
  });

  const mid = new THREE.Vector3().lerpVectors(startPos, endPos, 0.5);
  mid.y += 0.1;
  const cableGeo = new THREE.TubeGeometry(
    new THREE.QuadraticBezierCurve3(startPos, mid, endPos),
    20, 0.02, 8, false
  );
  const cable = new THREE.Mesh(cableGeo, cableMat);
  cable.castShadow = true;
  cableGroup.add(cable);

  const connMat = new THREE.MeshStandardMaterial({ color: 0x4a4a42, roughness: 0.5, metalness: 0.4 });
  [startPos, endPos].forEach(pos => {
    const conn = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.06, 8), connMat);
    conn.position.copy(pos);
    conn.rotation.x = Math.PI / 2;
    cableGroup.add(conn);
  });

  return cableGroup;
}

// Only called when parallelCount >= 3 — see buildPanel. Fuse count matches string count.
export function makeCombinerBox(position, stringCount = 3) {
  const g = new THREE.Group();
  const boxMat = new THREE.MeshStandardMaterial({ color: 0x2a2d28, roughness: 0.7, metalness: 0.3 });
  const box = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.34, 0.22), boxMat);
  box.position.copy(position);
  box.castShadow = true;
  g.add(box);

  for (let i = 0; i < stringCount; i++) {
    const fuse = new THREE.Mesh(
      new THREE.CylinderGeometry(0.025, 0.025, 0.09, 8),
      new THREE.MeshStandardMaterial({ color: 0xe8503a, emissive: 0xe8503a, emissiveIntensity: 0.35 })
    );
    fuse.rotation.z = Math.PI / 2;
    const spread = stringCount > 1 ? 0.32 / (stringCount - 1) : 0;
    fuse.position.set(
      position.x - 0.16 + i * spread,
      position.y + 0.15,
      position.z + 0.12
    );
    g.add(fuse);
  }
  return g;
}

export function makeGroundRod() {
  const g = new THREE.Group();
  const rod = new THREE.Mesh(
    new THREE.CylinderGeometry(0.025, 0.025, 0.9, 8),
    new THREE.MeshStandardMaterial({ color: 0x6a6f66, roughness: 0.5, metalness: 0.6 })
  );
  rod.position.y = 0.15;
  rod.castShadow = true;
  const clamp = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.06, 0.08), groundWireMat);
  clamp.position.y = 0.5;
  g.add(rod, clamp);
  return g;
}

// One physical row: shared rails on driven posts with bracing, a bare grounding
// conductor bonding every post, and panels clamped onto the rails — not standalone legs.
function buildRackRow(specs, texture, seriesCount, tiltDeg, gap) {
  const width = specs ? specs.dimensions[0] / 1000 : 1.029;
  const height = specs ? specs.dimensions[1] / 1000 : 1.855;
  const tiltRad = (tiltDeg * Math.PI) / 180;

  const row = new THREE.Group();
  const rowDepth = height * Math.cos(tiltRad);
  const rise = height * Math.sin(tiltRad);
  const frontH = 0.55, backH = frontH + rise;
  const rowLength = seriesCount * width + (seriesCount - 1) * gap;

  const frontRail = new THREE.Mesh(new THREE.BoxGeometry(rowLength, 0.08, 0.08), railMat);
  frontRail.position.set(0, frontH, 0);
  frontRail.castShadow = true;
  const backRail = new THREE.Mesh(new THREE.BoxGeometry(rowLength, 0.08, 0.08), railMat);
  backRail.position.set(0, backH, rowDepth);
  backRail.castShadow = true;
  row.add(frontRail, backRail);

  const postEvery = width + gap;
  const postCount = seriesCount + 1;
  const groundWirePts = [];
  for (let p = 0; p < postCount; p++) {
    const x = -rowLength / 2 + p * postEvery;
    const fp = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.055, frontH, 8), railMat);
    fp.position.set(x, frontH / 2, 0);
    fp.castShadow = true;
    row.add(fp);
    const bp = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.055, backH, 8), railMat);
    bp.position.set(x, backH / 2, rowDepth);
    bp.castShadow = true;
    row.add(bp);
    const brace = new THREE.Mesh(
      new THREE.CylinderGeometry(0.02, 0.02, Math.hypot(rowDepth, rise) * 1.02, 6), railMat
    );
    brace.position.set(x, (frontH + backH) / 2 - 0.05, rowDepth / 2);
    brace.rotation.x = Math.atan2(rowDepth, backH - frontH);
    row.add(brace);
    groundWirePts.push(new THREE.Vector3(x, 0.06, -0.15));
  }

  const gWire = new THREE.Mesh(
    new THREE.TubeGeometry(new THREE.CatmullRomCurve3(groundWirePts), Math.max(8, postCount * 2), 0.012, 6, false),
    groundWireMat
  );
  row.add(gWire);

  let prevPanel = null;
  let firstNeg = null, lastPos = null;
  for (let s = 0; s < seriesCount; s++) {
    const x = -rowLength / 2 + width / 2 + s * (width + gap);
    const panel = buildSinglePanel(specs, texture);
    panel.position.set(x, frontH, 0);
    panel.rotation.x = -tiltRad;
    row.add(panel);

    const worldPos = mesh => { const v = new THREE.Vector3(); mesh.getWorldPosition(v); return v; };
    if (prevPanel) {
      row.add(makeJumperCable(worldPos(prevPanel.userData.terminals.pos), worldPos(panel.userData.terminals.neg), false));
    } else {
      firstNeg = worldPos(panel.userData.terminals.neg);
    }
    if (s === seriesCount - 1) lastPos = worldPos(panel.userData.terminals.pos);
    prevPanel = panel;
  }

  return { group: row, rowLength, firstNeg, lastPos };
}

export function buildPanel(specs, seriesCount = 1, parallelCount = 1) {
  const g = new THREE.Group();
  const texture = getPanelTexture();
  const gap = 0.02;
  const tiltDeg = 15;

  const rowFirstNeg = [];
  const rowLastPos = [];
  let rowLength = 0;

  for (let r = 0; r < parallelCount; r++) {
    const built = buildRackRow(specs, texture, seriesCount, tiltDeg, gap);
    rowLength = built.rowLength;
    const rowPitch = (specs ? specs.dimensions[1] / 1000 : 1.855) * Math.cos((tiltDeg * Math.PI) / 180) + 1.3;
    built.group.position.set(0, 0, r * rowPitch);
    g.add(built.group);
    rowFirstNeg.push(built.firstNeg);
    rowLastPos.push(built.lastPos);
  }

  const rod = makeGroundRod();
  rod.position.set(-rowLength / 2 - 0.6, 0, -0.6);
  g.add(rod);

  // The wiring engine expects exactly one external p_pos/p_neg pair for the whole
  // panel component — this is also electrically correct: only after combination
  // does the array present a single + and − to the charge controller.
  let terminals = {};

  if (parallelCount === 1) {
    const tPos = makeTerminal('p_pos', RED);
    tPos.position.copy(rowLastPos[0]);
    const tNeg = makeTerminal('p_neg', BLACK);
    tNeg.position.copy(rowFirstNeg[0]);
    g.add(tPos, tNeg);
    terminals = { p_pos: tPos, p_neg: tNeg };
  } else if (parallelCount === 2) {
    // Two strings join directly — no combiner box required below 3 strings.
    const joinX = -rowLength / 2 - 0.6;
    const joinPos = new THREE.Vector3(joinX, 0.55, (rowFirstNeg[0].z + rowFirstNeg[1].z) / 2);
    rowLastPos.forEach(p => g.add(makeJumperCable(p, joinPos, true)));
    rowFirstNeg.forEach(p => g.add(makeJumperCable(p, joinPos.clone().setY(0.45), false)));
    const tPos = makeTerminal('p_pos', RED);
    tPos.position.copy(joinPos);
    const tNeg = makeTerminal('p_neg', BLACK);
    tNeg.position.copy(joinPos.clone().setY(0.45));
    g.add(tPos, tNeg);
    terminals = { p_pos: tPos, p_neg: tNeg };
  } else {
    // 3+ parallel strings — combiner box with one fuse per string is required.
    const combinerX = -rowLength / 2 - 1.0;
    const combinerZ = (rowFirstNeg[0].z + rowFirstNeg[rowFirstNeg.length - 1].z) / 2;
    const combinerPos = new THREE.Vector3(combinerX, 0.55, combinerZ);
    g.add(makeCombinerBox(combinerPos, parallelCount));
    rowLastPos.forEach((p, i) => {
      const target = new THREE.Vector3(combinerX, 0.6, rowFirstNeg[i].z);
      g.add(makeJumperCable(p, target, true));
    });
    rowFirstNeg.forEach((p, i) => {
      const target = new THREE.Vector3(combinerX, 0.5, p.z);
      g.add(makeJumperCable(p.clone().setY(p.y - 0.02), target, false));
    });
    const stubPos = new THREE.Vector3(combinerX - 1.0, 0.55, combinerZ);
    g.add(makeJumperCable(new THREE.Vector3(combinerX, 0.6, combinerZ), stubPos, true));
    const tPos = makeTerminal('p_pos', RED);
    tPos.position.copy(stubPos);
    const tNeg = makeTerminal('p_neg', BLACK);
    tNeg.position.copy(stubPos.clone().setY(stubPos.y - 0.1));
    g.add(tPos, tNeg);
    terminals = { p_pos: tPos, p_neg: tNeg };
  }

  g.userData.seriesCount = seriesCount;
  g.userData.parallelCount = parallelCount;
  g.userData.terminals = terminals;
  g.userData.panelSpecs = specs;

  return g;
}

// buildController, buildBattery, buildInverter, and BUILDERS are unchanged —
// this task only touched the panel/array system.
