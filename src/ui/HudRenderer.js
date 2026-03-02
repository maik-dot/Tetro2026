export class HudRenderer {
  constructor() {
    this.scoreEl = document.getElementById('scoreValue');
    this.levelEl = document.getElementById('levelValue');
    this.linesEl = document.getElementById('linesValue');
  }

  updateFromGame(game) {
    if (!game) return;
    if (this.scoreEl) this.scoreEl.textContent = String(game.score);
    if (this.levelEl) this.levelEl.textContent = String(game.level);
    if (this.linesEl) this.linesEl.textContent = String(game.lines);
  }
}

