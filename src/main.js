import { GameCore } from './core/GameCore.js';
import { AudioManager } from './audio/AudioManager.js';
import { SpriteManager } from './render/SpriteManager.js';
import { MATERIALS } from './config/gameConfig.js';

const canvas = document.getElementById('gameCanvas');
const loadingOverlay = document.getElementById('loadingOverlay');
const loadingBarFill = document.getElementById('loadingBarFill');
const loadingText = document.getElementById('loadingText');
const loadingStartBtn = document.getElementById('loadingStartBtn');

const audio = new AudioManager();
const sprites = new SpriteManager();
let gameStarted = false;

function setLoadingProgress(progress, text) {
  if (loadingBarFill) {
    loadingBarFill.style.width = `${Math.round(progress * 100)}%`;
  }
  if (loadingText && text) {
    loadingText.textContent = text;
  }
}

async function preloadAudio() {
  setLoadingProgress(0.05, 'Lade Soundeffekte …');
  try {
    await audio.loadSfx();
  } catch (e) {
    // leise scheitern
  }
  setLoadingProgress(0.4, 'Lade Musik …');
  try {
    await audio.loadMusicPlaylist();
  } catch (e) {
    // leise scheitern
  }
  setLoadingProgress(0.75, 'Lade Grafiken …');
  try {
    await sprites.loadBlockSprites(MATERIALS);
  } catch (e) {
    // leise scheitern
  }
  setLoadingProgress(1, 'Bereit. Drücke „Starten“.');
  if (loadingStartBtn) {
    loadingStartBtn.classList.remove('hidden');
  }
}

preloadAudio();

if (loadingStartBtn) {
  loadingStartBtn.addEventListener('click', async () => {
    if (gameStarted) return;
    gameStarted = true;
    loadingStartBtn.disabled = true;
    await audio.unlock().catch(() => {});
    if (loadingOverlay) {
      loadingOverlay.classList.add('hidden');
    }
    const game = new GameCore(canvas, audio, sprites);
    game.start();
  });
}
