import { MATERIALS } from '../config/gameConfig.js';

export class DurabilitySystem {
  getMaterial(materialId) {
    return MATERIALS[materialId] ?? MATERIALS.wood;
  }

  getMaxHp(materialId) {
    return this.getMaterial(materialId).maxHp ?? 1;
  }
}

