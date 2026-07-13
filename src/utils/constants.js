export const INV_MIN_V = 9.3;
export const INV_MAX_V = 17;

export const OWNER = {
  p_pos: 'panel', p_neg: 'panel',
  c_pv_pos: 'controller', c_pv_neg: 'controller',
  c_bat_pos: 'controller', c_bat_neg: 'controller',
  b_pos: 'battery', b_neg: 'battery',
  i_pos: 'inverter', i_neg: 'inverter'
};

export const GROUP = {
  panel: ['p_pos', 'p_neg'],
  ctrlPv: ['c_pv_pos', 'c_pv_neg'],
  ctrlBat: ['c_bat_pos', 'c_bat_neg'],
  battery: ['b_pos', 'b_neg'],
  inverter: ['i_pos', 'i_neg']
};

export const ZONES = {
  panel: { x: -4.3, z: -3.2, label: 'ROOF · PANEL', w: 3.4, h: 2.6 },
  controller: { x: 4.3, z: -3.2, label: 'WALL · CONTROLLER', w: 3.0, h: 2.4 },
  battery: { x: -3.4, z: 3.3, label: 'FLOOR · BATTERY', w: 2.8, h: 2.4 },
  inverter: { x: 3.4, z: 3.3, label: 'WALL · INVERTER', w: 3.0, h: 2.4 }
};

export const LABEL_MAP = {
  p_pos: "the panel's + wire",
  p_neg: "the panel's − wire",
  c_pv_pos: "the controller's panel-side +",
  c_pv_neg: "the controller's panel-side −",
  c_bat_pos: "the controller's battery-side +",
  c_bat_neg: "the controller's battery-side −",
  b_pos: "the battery's + terminal",
  b_neg: "the battery's − terminal",
  i_pos: "the inverter's + input",
  i_neg: "the inverter's − input"
};

export const NICE_NAMES = {
  panel: 'Solar Panel',
  controller: 'Charge Controller',
  battery: 'Battery',
  inverter: 'Inverter'
};

export const RED = 0xe8503a;
export const BLACK = 0x2c2f28;
