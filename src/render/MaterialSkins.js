export const MaterialSkins = {
  glass: {
    id: 'glass',
    base: '#8be9ff',
    highlight: 'rgba(255,255,255,0.6)',
    shadow: 'rgba(0,0,0,0.25)',
  },
  wood: {
    id: 'wood',
    base: '#c08a3c',
    highlight: 'rgba(255,255,255,0.35)',
    shadow: 'rgba(0,0,0,0.35)',
  },
  stone: {
    id: 'stone',
    base: '#9aa3ad',
    highlight: 'rgba(255,255,255,0.25)',
    shadow: 'rgba(0,0,0,0.4)',
  },
  metal: {
    id: 'metal',
    base: '#8fa6b8',
    highlight: 'rgba(255,255,255,0.3)',
    shadow: 'rgba(0,0,0,0.45)',
  },
};

export function getMaterialSkin(materialId) {
  return MaterialSkins[materialId] ?? MaterialSkins.wood;
}

