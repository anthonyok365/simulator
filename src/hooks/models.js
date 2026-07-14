import * as THREE from 'three';
import { RED, BLACK } from '../utils/constants';
import { makeScreenTexture, makeBatteryLabel, makePanelTexture, loadPanelTexture } from './textures';
import { makeTerminal } from './terminals';

// Get or create panel texture
function getPanelTexture() {
  const loadedTexture = loadPanelTexture();
  if (loadedTexture) return loadedTexture;
  return makePanelTexture(10, 6);
}

export function buildSinglePanel(specs, texture, cols, rows) {
  const width = specs ? specs.dimensions[0] / 1000 : 1.029;
  const height = specs ? specs.dimensions[1] / 1000 : 1.855;

  const frameThick = 0.04;
  const frameDepth = 0.03;
  const frameColor = 0xb8bdb8;
  const frameInnerColor = 0x8a8f88;

  const panelGroup = new THREE.Group();

  const frameMat = new THREE.MeshStandardMaterial({ color: frameColor, roughness: 0.35, metalness: 0.75 });

  const topFrame = new THREE.Mesh(new THREE.BoxGeometry(width + frameThick * 2, frameThick, frameDepth), frameMat);
  topFrame.position.set(0, height / 2 + frameThick / 2, 0);
  topFrame.castShadow = true;
  panelGroup.add(topFrame);

  const bottomFrame = topFrame.clone();
  bottomFrame.position.y = -(height / 2 + frameThick / 2);
  panelGroup.add(bottomFrame);

  const leftFrame = new THREE.Mesh(new THREE.BoxGeometry(frameThick, height, frameDepth), frameMat);
  leftFrame.position.set(-(width / 2 + frameThick / 2), 0, 0);
  leftFrame.castShadow = true;
  panelGroup.add(leftFrame);

  const rightFrame = leftFrame.clone();
  rightFrame.position.x = width / 2 + frameThick / 2;
  panelGroup.add(rightFrame);

  const innerFrameMat = new THREE.MeshStandardMaterial({ color: frameInnerColor, roughness: 0.4, metalness: 0.7 });
  const innerInset = 0.012;
  const innerThick = 0.008;

  const innerTop = new THREE.Mesh(
    new THREE.BoxGeometry(width - innerInset * 2, innerThick, frameDepth * 0.3), innerFrameMat);
  innerTop.position.set(0, height / 2 - innerInset - innerThick / 2, frameDepth * 0.15);
  panelGroup.add(innerTop);
  innerTop.clone().position.y = -(height / 2 - innerInset - innerThick / 2);
  panelGroup.add(innerTop.clone());

  const innerLeft = new THREE.Mesh(
    new THREE.BoxGeometry(innerThick, height - innerInset * 2 - innerThick * 2, frameDepth * 0.3), innerFrameMat);
  innerLeft.position.set(-(width / 2 - innerInset - innerThick / 2), 0, frameDepth * 0.15);
  panelGroup.add(innerLeft);
  innerLeft.clone().position.x = width / 2 - innerInset - innerThick / 2;
  panelGroup.add(innerLeft.clone());

  const cellMat = new THREE.MeshStandardMaterial({
    map: texture,
    roughness: 0.15,
    metalness: 0.1
  });
  texture.repeat.set(cols, rows);

  const cellSurface = new THREE.Mesh(
    new THREE.PlaneGeometry(width - frameThick * 2, height - frameThick * 2),
    cellMat
  );
  cellSurface.rotation.x = -Math.PI / 2;
  cellSurface.position.y = 0.001;
  cellSurface.receiveShadow = true;
  panelGroup.add(cellSurface);

  const crossbarMat = new THREE.MeshStandardMaterial({ color: frameColor, roughness: 0.35, metalness: 0.75 });
  const crossbar = new THREE.Mesh(
    new THREE.BoxGeometry(width - frameThick * 2, 0.025, 0.015),
    crossbarMat
  );
  crossbar.position.set(0, 0, frameDepth * 0.5 + 0.008);
  crossbar.castShadow = true;
  panelGroup.add(crossbar);

  const holeMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.8 });
  [[-1, 1], [1, 1], [-1, -1], [1, -1]].forEach(([sx, sy]) => {
    const hole = new THREE.Mesh(
      new THREE.CylinderGeometry(0.015, 0.015, frameDepth * 1.5, 12), holeMat);
    hole.rotation.x = Math.PI / 2;
    hole.position.set(sx * width * 0.35, sy * height * 0.35, 0);
    panelGroup.add(hole);
  });

  panelGroup.rotation.x = -0.5;
  return panelGroup;
}

export function makeJumperCable(startPos, endPos, isPositive) {
  const cableGroup = new THREE.Group();

  const cableMat = new THREE.MeshStandardMaterial({
    color: isPositive ? 0xe8503a : 0x1a1a1a,
    roughness: 0.6,
    metalness: 0.2
  });

  const midX = (startPos.x + endPos.x) / 2;
  const midZ = (startPos.z + endPos.z) / 2 - 0.3;
  const cableGeo = new THREE.TubeGeometry(
    new THREE.CatmullRomCurve3([
      new THREE.Vector3(startPos.x, startPos.y, startPos.z),
      new THREE.Vector3(midX, startPos.y + 0.1, midZ),
      new THREE.Vector3(endPos.x, endPos.y, endPos.z)
    ]),
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

export function makeCombinerBox(position) {
  const boxGroup = new THREE.Group();

  const boxMat = new THREE.MeshStandardMaterial({ color: 0x2a2d28, roughness: 0.7, metalness: 0.3 });
  const box = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.3, 0.2), boxMat);
  box.position.copy(position);
  box.castShadow = true;
  boxGroup.add(box);

  const termMat = new THREE.MeshStandardMaterial({ color: 0x1a1a18, roughness: 0.8 });
  const termBlock = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.1, 0.05), termMat);
  termBlock.position.set(position.x, position.y, position.z + 0.13);
  boxGroup.add(termBlock);

  return boxGroup;
}

export function buildPanel(specs, seriesCount = 1, parallelCount = 1) {
  const g = new THREE.Group();

  const width = specs ? specs.dimensions[0] / 1000 : 1.855;
  const height = specs ? specs.dimensions[1] / 1000 : 1.029;
  const frameGap = 0.02;

  const texture = getPanelTexture();

  const cellAspect = width / height;
  let cols, rows;
  if (cellAspect > 1.8) {
    cols = 12;
    rows = Math.round(12 / cellAspect * 1.5);
  } else {
    cols = 10;
    rows = 6;
  }

  const arrayWidth = seriesCount * (width + frameGap);

  const legMat = new THREE.MeshStandardMaterial({ color: 0x8a8f88, roughness: 0.5, metalness: 0.6 });
  const legHeight = 1.2;

  const leg1 = new THREE.Mesh(new THREE.BoxGeometry(0.15, legHeight, 0.15), legMat);
  leg1.position.set(-arrayWidth / 2 + 0.2, legHeight / 2, 0.8);
  leg1.castShadow = true;
  g.add(leg1);

  const leg2 = leg1.clone();
  leg2.position.x = arrayWidth / 2 - 0.2;
  g.add(leg2);

  const panelPositions = [];
  const terminals = {};
  const cables = [];

  for (let p = 0; p < parallelCount; p++) {
    for (let s = 0; s < seriesCount; s++) {
      const x = s * (width + frameGap) - arrayWidth / 2 + width / 2;
      const z = p * (height * Math.cos(0.5) + frameGap) + 0.3;

      const panel = buildSinglePanel(specs, texture, cols, rows);
      panel.position.set(x, height / 2 + 0.4, z);
      g.add(panel);

      panelPositions.push({ x, z, panel });

      if (s === 0) {
        const tPos = makeTerminal('p_pos', RED);
        tPos.position.set(x - width / 2 - 0.1, height / 2 + 0.5, z + 0.35);
        g.add(tPos);
        terminals.p_pos = tPos;
      }

      if (s === seriesCount - 1) {
        const tNeg = makeTerminal('p_neg', BLACK);
        tNeg.position.set(x + width / 2 + 0.1, height / 2 + 0.5, z + 0.35);
        g.add(tNeg);
        terminals.p_neg = tNeg;
      }

      if (s > 0) {
        const prevX = (s - 1) * (width + frameGap) - arrayWidth / 2 + width / 2;
        cables.push({
          start: { x: prevX + width / 2, y: height / 2 + 0.45, z: z + 0.1 },
          end: { x: x - width / 2, y: height / 2 + 0.45, z: z + 0.1 },
          isPositive: false
        });
      }
    }
  }

  cables.forEach(c => {
    const cable = makeJumperCable(
      new THREE.Vector3(c.start.x, c.start.y, c.start.z),
      new THREE.Vector3(c.end.x, c.end.y, c.end.z),
      c.isPositive
    );
    g.add(cable);
  });

  const combinerPos = new THREE.Vector3(
    arrayWidth / 2 + 0.5,
    height / 2 + 0.6,
    0
  );
  const combiner = makeCombinerBox(combinerPos);
  g.add(combiner);

  panelPositions.forEach((pos, idx) => {
    const isLastInRow = (idx + 1) % seriesCount === 0;
    if (isLastInRow) {
      const cable = makeJumperCable(
        new THREE.Vector3(pos.x + width / 2, height / 2 + 0.45, pos.z + 0.1),
        new THREE.Vector3(combinerPos.x - 0.2, combinerPos.y, combinerPos.z),
        false
      );
      g.add(cable);
    }
  });

  g.userData.seriesCount = seriesCount;
  g.userData.parallelCount = parallelCount;
  g.userData.terminals = terminals;
  g.userData.panelSpecs = specs;

  return g;
}

export function buildController() {
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
}

export function buildBattery() {
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
}

export function buildInverter() {
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
}

export const BUILDERS = {
  panel: buildPanel,
  controller: buildController,
  battery: buildBattery,
  inverter: buildInverter
};
