import { SCORE_TABLE } from '../config/gameConfig.js';

export class Scoring {
  constructor() {
    this.score = 0;
    this.lines = 0;
    this.level = 1;
  }

  addLines(cleared) {
    if (cleared <= 0) return;
    let key = 'single';
    if (cleared === 2) key = 'double';
    else if (cleared === 3) key = 'triple';
    else if (cleared >= 4) key = 'tetris';

    const base = SCORE_TABLE[key] ?? 0;
    const gained = base * this.level;
    this.score += gained;
    this.lines += cleared;
    this.level = 1 + Math.floor(this.lines / 10);
  }
}

