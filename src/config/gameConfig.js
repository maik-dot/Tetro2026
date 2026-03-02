export const BOARD_WIDTH = 10;
export const BOARD_HEIGHT = 20;

export const TICK_RATES = {
  1: 800,
  2: 700,
  3: 600,
  4: 500,
  5: 400,
  6: 350,
  7: 300,
  8: 260,
  9: 220,
  10: 180,
};

export const SCORE_TABLE = {
  single: 100,
  double: 300,
  triple: 500,
  tetris: 800,
};

export const INPUT_CONFIG = {
  das: 150,
  arr: 40,
};

export const MATERIALS = {
  glass: { id: 'glass', name: 'Glas', maxHp: 1, gravityFactor: 0.8 },
  wood: { id: 'wood', name: 'Holz', maxHp: 2, gravityFactor: 1 },
  stone: { id: 'stone', name: 'Stein', maxHp: 3, gravityFactor: 1.2 },
  metal: { id: 'metal', name: 'Metall', maxHp: 4, gravityFactor: 1.4 },
};

export const MATERIAL_DISTRIBUTION = [
  { id: 'glass', weight: 3 },
  { id: 'wood', weight: 4 },
  { id: 'stone', weight: 2 },
  { id: 'metal', weight: 1 },
];

