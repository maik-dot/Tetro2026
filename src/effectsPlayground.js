import { CanvasContext } from './render/CanvasContext.js';
import { Renderer } from './render/Renderer.js';
import { ParticleSystem } from './render/ParticleSystem.js';
import { AnimationSystem } from './render/AnimationSystem.js';
import { AudioManager } from './audio/AudioManager.js';
import { BOARD_WIDTH, BOARD_HEIGHT } from './config/gameConfig.js';

class DummyBoard {
  constructor() {
    this.width = BOARD_WIDTH;
    this.height = BOARD_HEIGHT;
  }

  getCell() {
    return null;
  }
}

class DummyGame {
  constructor() {
    this.board = new DummyBoard();
    this.currentPiece = null;
    this.gameOver = false;
    this.paused = false;
    this.dropProgress = 0;
  }
}

const canvas = document.getElementById('effectsCanvas');
const listEl = document.getElementById('effectsTestList');
const clearBtn = document.getElementById('effectsClearBtn');

const canvasContext = new CanvasContext(canvas);
const renderer = new Renderer();
const particles = new ParticleSystem(BOARD_HEIGHT);
const animation = new AnimationSystem();
const audio = new AudioManager();
audio.loadSfx().catch(() => {});
const game = new DummyGame();

const centerCell = Math.floor(BOARD_WIDTH / 2);
const contactRow = BOARD_HEIGHT - 4;
const cx = centerCell + 0.5;
const cy = contactRow + 1;

// Zentrale Definition aller Tests, damit später leicht neue ergänzt werden können.
const TESTS = [
  {
    id: 'metal-metal-sparks',
    label: 'Funken: Metall auf Metall',
    sfx: 'metalImpactHeavy',
    run() {
      particles.spawnMetalContactSparks(cx, cy, 'metal', 'metal');
    },
  },
  {
    id: 'stone-metal-sparks',
    label: 'Funken: Stein auf Metall',
    sfx: 'metalImpactMedium',
    run() {
      particles.spawnMetalContactSparks(cx, cy, 'stone', 'metal');
    },
  },
  {
    id: 'glass-metal-sparks',
    label: 'Funken: Glas auf Metall',
    sfx: 'metalImpactLight',
    run() {
      particles.spawnMetalContactSparks(cx, cy, 'glass', 'metal');
    },
  },
  {
    id: 'stone-break',
    label: 'Steinblock zerbricht (Geröll)',
    sfx: 'stoneBreak',
    run() {
      particles.spawnDestroyBlocks([
        {
          x: centerCell,
          y: contactRow,
          cell: { materialId: 'stone' },
        },
      ]);
    },
  },
  {
    id: 'wood-break',
    label: 'Holzblock zerbricht (Späne)',
    sfx: 'woodBreak',
    run() {
      particles.spawnDestroyBlocks([
        {
          x: centerCell,
          y: contactRow,
          cell: { materialId: 'wood' },
        },
      ]);
    },
  },
  {
    id: 'glass-break',
    label: 'Glasblock zerbricht (Scherben)',
    sfx: 'glassBreak',
    run() {
      particles.spawnDestroyBlocks([
        {
          x: centerCell,
          y: contactRow,
          cell: { materialId: 'glass' },
        },
      ]);
    },
  },
  {
    id: 'grass-break',
    label: 'Grasblock zerbricht (Gras + Erde)',
    sfx: 'grassBreak',
    run() {
      particles.spawnDestroyBlocks([
        {
          x: centerCell,
          y: contactRow,
          cell: { materialId: 'grass' },
        },
      ]);
    },
  },
  {
    id: 'slime-break',
    label: 'Schleimblock zerplatzt',
    sfx: 'slimeBreak',
    run() {
      particles.spawnDestroyBlocks([
        {
          x: centerCell,
          y: contactRow,
          cell: { materialId: 'slime' },
        },
      ]);
    },
  },
  {
    id: 'slime-impact',
    label: 'Impact: Schleim fällt in Lücke',
    sfx: 'slimeImpact',
    run() {
      const moves = [
        {
          x: centerCell,
          fromY: contactRow - 6,
          toY: contactRow,
          cell: { materialId: 'slime', colorId: 0, hp: 1, maxHp: 1 },
        },
      ];
      particles.spawnSlimeImpactForMoves(moves);
    },
  },
  {
    id: 'grass-impact',
    label: 'Impact: Grasblock-Aufprall',
    sfx: 'grassImpact',
    run() {
      // Simulierter Aufprall eines Grasblocks auf den Untergrund
      particles.spawnGrassImpactDebris(cx, cy, 'grass', 'stone');
    },
  },
  {
    id: 'impact-stone-stone',
    label: 'Impact: Stein auf Stein',
    sfx: 'stoneImpactStone',
    run() {
      particles.spawnStoneImpactDebris(cx, cy, 'stone', 'stone');
    },
  },
  {
    id: 'impact-stone-metal',
    label: 'Impact: Stein auf Metall',
    sfx: 'stoneImpactMetal',
    run() {
      particles.spawnStoneImpactDebris(cx, cy, 'stone', 'metal');
    },
  },
  {
    id: 'impact-stone-glass',
    label: 'Impact: Stein auf Glas',
    sfx: 'stoneImpactGlass',
    run() {
      particles.spawnStoneImpactDebris(cx, cy, 'stone', 'glass');
    },
  },
  {
    id: 'impact-stone-wood',
    label: 'Impact: Stein auf Holz',
    sfx: 'stoneImpactWood',
    run() {
      particles.spawnStoneImpactDebris(cx, cy, 'stone', 'wood');
    },
  },
  {
    id: 'impact-wood-stone',
    label: 'Impact: Holz auf Stein',
    // nutzt denselben SFX wie Stein auf Holz
    sfx: 'stoneImpactWood',
    run() {
      particles.spawnWoodImpactDebris(cx, cy, 'wood', 'stone');
    },
  },
  {
    id: 'impact-wood-metal',
    label: 'Impact: Holz auf Metall',
    // nutzt denselben SFX wie Stein auf Metall (mittlere Härte)
    sfx: 'metalImpactMedium',
    run() {
      particles.spawnWoodImpactDebris(cx, cy, 'wood', 'metal');
    },
  },
  {
    id: 'impact-wood-glass',
    label: 'Impact: Holz auf Glas',
    sfx: 'woodImpactGlass',
    run() {
      particles.spawnWoodImpactDebris(cx, cy, 'wood', 'glass');
    },
  },
  {
    id: 'impact-wood-wood',
    label: 'Impact: Holz auf Holz',
    sfx: 'woodImpactWood',
    run() {
      particles.spawnWoodImpactDebris(cx, cy, 'wood', 'wood');
    },
  },
  {
    id: 'impact-glass-stone',
    label: 'Impact: Glas auf Stein',
    // nutzt denselben SFX wie Stein auf Glas
    sfx: 'stoneImpactGlass',
    run() {
      particles.spawnGlassImpactDebris(cx, cy, 'glass', 'stone');
    },
  },
  {
    id: 'impact-glass-metal',
    label: 'Impact: Glas auf Metall',
    // nutzt den leichten Metall-Impact für Glas
    sfx: 'metalImpactLight',
    run() {
      particles.spawnGlassImpactDebris(cx, cy, 'glass', 'metal');
    },
  },
  {
    id: 'impact-glass-glass',
    label: 'Impact: Glas auf Glas',
    sfx: 'glassImpactGlass',
    run() {
      particles.spawnGlassImpactDebris(cx, cy, 'glass', 'glass');
    },
  },
  {
    id: 'impact-glass-wood',
    label: 'Impact: Glas auf Holz',
    // nutzt denselben SFX wie Holz auf Glas
    sfx: 'woodImpactGlass',
    run() {
      particles.spawnGlassImpactDebris(cx, cy, 'glass', 'wood');
    },
  },
];

function buildTestList() {
  if (!listEl) return;
  listEl.innerHTML = '';
  for (const test of TESTS) {
    const li = document.createElement('li');
    const btn = document.createElement('button');
    btn.textContent = test.label;
    btn.style.display = 'block';
    btn.style.width = '100%';
    btn.style.marginTop = '4px';
    btn.style.fontSize = '0.8rem';
    btn.addEventListener('click', async () => {
      await audio.unlock().catch(() => {});
      if (test.sfx) {
        audio.playSfx(test.sfx);
      }
      test.run();
    });
    li.appendChild(btn);
    listEl.appendChild(li);
  }
}

if (clearBtn) {
  clearBtn.addEventListener('click', () => {
    particles.particles = [];
  });
}

buildTestList();

let lastTime = performance.now();
function loop(now) {
  const dt = now - lastTime;
  lastTime = now;

  particles.update(dt);
  animation.update(dt);

  canvasContext.clear();
  renderer.render(canvasContext, game, particles, animation);

  requestAnimationFrame(loop);
}

requestAnimationFrame(loop);

