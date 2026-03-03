import { Board } from './Board.js';
import { PieceFactory } from './PieceFactory.js';
import { BagRandomizer } from './BagRandomizer.js';
import { Scoring } from './Scoring.js';
import { TICK_RATES, MATERIAL_DISTRIBUTION, HARD_DROP_GRAVITY } from '../config/gameConfig.js';
import { DurabilitySystem } from './DurabilitySystem.js';

export class TetrisGame {
  constructor() {
    this.init();
  }

  get level() {
    return this.scoring.level;
  }

  get score() {
    return this.scoring.score;
  }

  get lines() {
    return this.scoring.lines;
  }

  get baseDropInterval() {
    const fromTable = TICK_RATES[this.level];
    if (fromTable) return fromTable;
    const maxLevel = Math.max(...Object.keys(TICK_RATES).map((n) => parseInt(n, 10)));
    return TICK_RATES[maxLevel];
  }

  get dropInterval() {
    return this.baseDropInterval;
  }

  get dropProgress() {
    if (!this.currentPiece || this.gameOver || this.paused) return 0;
    if (!this.dropInterval) return 0;
    return Math.max(0, Math.min(1, this.dropTimer / this.dropInterval));
  }

  init() {
    this.board = new Board();
    this.randomizer = new BagRandomizer();
    this.scoring = new Scoring();
    this.durability = new DurabilitySystem();

    this.currentPiece = null;
    this.nextPieceType = this.randomizer.next();
    this.dropTimer = 0;
    this.gameOver = false;
    this.paused = false;

    this.events = [];
    this.resolvingLines = false;
    this.lineResolveTimer = 0;
    this.pendingSpawn = false;
    this.hardDropAnim = null;

    this.spawnPiece();
  }

  reset() {
    this.init();
  }

  spawnPiece() {
    const type = this.nextPieceType;
    this.currentPiece = PieceFactory.create(type);
    this.currentPiece.x = 3;
    this.currentPiece.y = 0;
    this.currentPiece.materialId = this.randomMaterialId();
    this.nextPieceType = this.randomizer.next();

    if (!this.board.canPlace(this.currentPiece)) {
      this.gameOver = true;
      this.currentPiece = null;
      this.emitEvent({ type: 'gameOver' });
    }
  }

  randomMaterialId() {
    const total = MATERIAL_DISTRIBUTION.reduce((sum, m) => sum + m.weight, 0);
    let r = Math.random() * total;
    for (const entry of MATERIAL_DISTRIBUTION) {
      r -= entry.weight;
      if (r <= 0) return entry.id;
    }
    return MATERIAL_DISTRIBUTION[0]?.id ?? 'wood';
  }

  togglePause() {
    if (this.gameOver) return;
    this.paused = !this.paused;
  }

  update(dt) {
    if (this.gameOver || this.paused) return;
    if (this.hardDropAnim) {
      this.updateHardDrop(dt);
      return;
    }
    if (this.resolvingLines) {
      this.updateLineResolution(dt);
      return;
    }

    this.dropTimer += dt;
    if (this.dropTimer >= this.dropInterval) {
      this.dropTimer = 0;
      this.stepDown();
    }
  }

  stepDown(impactType = 'normal') {
    if (this.gameOver || this.paused) return;
    if (!this.currentPiece) return;
    const testPiece = this.currentPiece.clone();
    testPiece.y += 1;
    if (this.board.canPlace(testPiece)) {
      this.currentPiece = testPiece;
      return;
    }

    const lockedPiece = this.currentPiece.clone();
    const lockedCells = lockedPiece.getBlocks().map((b) => ({
      x: lockedPiece.x + b.x,
      y: lockedPiece.y + b.y,
    }));
    this.board.lockPiece(this.currentPiece);
    this.currentPiece = null;

    const firstResult = this.board.clearFullLines();
    let totalCleared = 0;
    if (firstResult.count) {
      totalCleared += firstResult.count;
      this.scoring.addLines(firstResult.count);
      this.emitEvent({
        type: 'linesCleared',
        rows: firstResult.rows,
        moves: firstResult.moves,
        destroyed: firstResult.destroyed,
      });
      this.resolvingLines = true;
      this.lineResolveTimer = 0;
      this.pendingSpawn = true;
    } else {
      this.spawnPiece();
    }

    this.dropTimer = 0;

    this.emitEvent({
      type: 'pieceLocked',
      piece: lockedPiece,
      clearedLines: totalCleared,
      impactType,
      lockedCells,
    });
  }

  updateLineResolution(dt) {
    if (!this.resolvingLines) return;
    this.lineResolveTimer += dt;
    const RESOLVE_DELAY = 220;
    if (this.lineResolveTimer < RESOLVE_DELAY) return;
    this.lineResolveTimer = 0;

    const result = this.board.clearFullLines();
    if (result.count) {
      this.scoring.addLines(result.count);
      this.emitEvent({
        type: 'linesCleared',
        rows: result.rows,
        moves: result.moves,
        destroyed: result.destroyed,
      });
      return;
    }

    this.resolvingLines = false;
    if (this.pendingSpawn) {
      this.pendingSpawn = false;
      this.spawnPiece();
    }
  }

  softDropStep() {
    if (this.gameOver || this.paused || this.hardDropAnim) return;
    this.dropTimer = 0;
    this.stepDown('soft');
  }

  emitEvent(evt) {
    this.events.push(evt);
  }

  consumeEvents() {
    const evts = this.events;
    this.events = [];
    return evts;
  }

  hardDrop() {
    if (this.gameOver || this.paused || this.hardDropAnim) return;
    if (!this.currentPiece) return;
    // Startposition inkl. aktueller Zwischenposition aus dropProgress,
    // damit der Block nicht sichtbar „nach oben springt“.
    const startY = this.currentPiece.y + (this.dropProgress || 0);
    const p = this.currentPiece.clone();
    while (true) {
      p.y += 1;
      if (!this.board.canPlace(p)) {
        p.y -= 1;
        break;
      }
    }
    const targetY = p.y;
    if (targetY <= startY) {
      // Kein echter Fall nötig → direkt locken
      this.stepDown('hard');
      return;
    }
    // Block visuell auf die exakte Startposition setzen
    this.currentPiece.y = startY;
    this.hardDropAnim = {
      fromY: startY,
      toY: targetY,
      vy: 0,
    };
    // Basis-Fall-Timer einfrieren, solange die Hard-Drop-Animation läuft
    this.dropTimer = 0;
  }

  move(dx) {
    if (this.gameOver || this.paused || this.hardDropAnim) return;
    if (!this.currentPiece) return;

    const snappedDown = this.dropProgress > 0;
    const p = this.currentPiece.clone();

    if (snappedDown) {
      p.y += 1;
    }

    p.x += dx;

    if (this.board.canPlace(p)) {
      this.currentPiece = p;
      if (snappedDown) {
        this.dropTimer = 0;
      }
    }
  }

  rotateCW() {
    if (this.gameOver || this.paused || this.hardDropAnim) return;
    const p = this.currentPiece.clone();
    p.rotateCW();
    if (this.board.canPlace(p, p.x, p.y, p.rotationIndex)) {
      this.currentPiece = p;
    }
  }

  updateHardDrop(dt) {
    const anim = this.hardDropAnim;
    if (!anim || !this.currentPiece) {
      // Fallback: Animation abgebrochen → normalen Hard-Drop-Lock ausführen, falls möglich
      this.hardDropAnim = null;
      if (this.currentPiece) {
        this.stepDown('hard');
      }
      return;
    }

    const dtSec = dt / 1000;
    const g = HARD_DROP_GRAVITY || 90;

    // Geschwindigkeit und Position im freien Fall aktualisieren
    anim.vy = (anim.vy || 0) + g * dtSec;
    const nextY = this.currentPiece.y + anim.vy * dtSec;

    if (nextY >= anim.toY) {
      // Einschlag erreicht oder überschritten → exakt einrasten und locken
      this.currentPiece.y = anim.toY;
      this.hardDropAnim = null;
      this.stepDown('hard');
    } else {
      this.currentPiece.y = nextY;
    }
  }
}

