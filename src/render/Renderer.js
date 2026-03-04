import { BlockRenderer } from './BlockRenderer.js';
import { BOARD_WIDTH, BOARD_HEIGHT } from '../config/gameConfig.js';

export class Renderer {
  constructor(spriteManager = null) {
    this.blockRenderer = new BlockRenderer(spriteManager);
  }

  render(canvasContext, game, particleSystem, animationSystem) {
    const { ctx } = canvasContext;
    const { cellSize, offsetX, offsetY } = this.blockRenderer.computeCellSize(canvasContext);

    ctx.save();
    if (animationSystem) {
      const offset = animationSystem.getOffset();
      ctx.translate(offset.x, offset.y);
    }
    this.drawBackground(ctx, canvasContext);
    this.drawGrid(ctx, cellSize, offsetX, offsetY);
    this.drawBoard(ctx, game, cellSize, offsetX, offsetY, animationSystem);
    this.drawCurrentPiece(ctx, game, cellSize, offsetX, offsetY);
    if (particleSystem) {
      this.drawParticles(ctx, particleSystem, cellSize, offsetX, offsetY);
    }
    this.drawOverlay(ctx, game, canvasContext);
    ctx.restore();
  }

  drawBackground(ctx, canvasContext) {
    const { width, height } = canvasContext;
    const gradient = ctx.createLinearGradient(0, 0, 0, height);
    gradient.addColorStop(0, '#050608');
    gradient.addColorStop(1, '#101322');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);
  }

  drawGrid(ctx, cellSize, offsetX, offsetY) {
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.06)';
    ctx.lineWidth = 1;
    for (let x = 0; x <= BOARD_WIDTH; x++) {
      const px = offsetX + x * cellSize;
      ctx.beginPath();
      ctx.moveTo(px, offsetY);
      ctx.lineTo(px, offsetY + BOARD_HEIGHT * cellSize);
      ctx.stroke();
    }
    for (let y = 0; y <= BOARD_HEIGHT; y++) {
      const py = offsetY + y * cellSize;
      ctx.beginPath();
      ctx.moveTo(offsetX, py);
      ctx.lineTo(offsetX + BOARD_WIDTH * cellSize, py);
      ctx.stroke();
    }
  }

  drawBoard(ctx, game, cellSize, offsetX, offsetY, animationSystem) {
    const board = game.board;
    const falling = animationSystem?.getFallingBlocks?.() ?? [];
    const fallingMap = new Map();
    const occupiedTargets = new Set();
    for (const fb of falling) {
      const key = `${fb.x}:${fb.toY}`;
      fallingMap.set(`${fb.x}:${fb.y}`, fb);
      occupiedTargets.add(key);
    }
    for (let y = 0; y < board.height; y++) {
      for (let x = 0; x < board.width; x++) {
        const cell = board.getCell(x, y);
        if (cell) {
          const targetKey = `${x}:${y}`;
          if (occupiedTargets.has(targetKey)) {
            continue;
          }
          const fallOffset = animationSystem?.getFallOffsetForRow(y, cell.materialId) ?? 0;
          const bounceOffset = animationSystem?.getLockBounceOffset(x, y) ?? 0;
          this.blockRenderer.drawBlock(
            ctx,
            x,
            y + fallOffset - bounceOffset,
            {
              colorId: cell.colorId,
              materialId: cell.materialId,
              hp: cell.hp,
              maxHp: cell.maxHp,
            },
            cellSize,
            offsetX,
            offsetY,
          );
        }
      }
    }

    // fallende Blöcke zeichnen
    for (const fb of falling) {
      const cell = fb.cell;
      this.blockRenderer.drawBlock(
        ctx,
        fb.x,
        fb.y,
        {
          colorId: cell.colorId,
          materialId: cell.materialId,
          hp: cell.hp,
          maxHp: cell.maxHp,
        },
        cellSize,
        offsetX,
        offsetY,
      );
    }
  }

  drawCurrentPiece(ctx, game, cellSize, offsetX, offsetY) {
    const piece = game.currentPiece;
    if (!piece) return;
    const hardDropActive = !!game.hardDropAnim;
    if (this._lastPieceRef !== piece) {
      this._lastPieceRef = piece;
      this._visualPieceX = piece.x;
      this._visualPieceY = piece.y;
      this._lastPieceY = piece.y;
    } else {
      if (this._visualPieceX == null) this._visualPieceX = piece.x;
      if (this._visualPieceY == null) this._visualPieceY = piece.y;
      if (this._lastPieceY == null) this._lastPieceY = piece.y;
    }
    const lerpFactor = 0.35;
    this._visualPieceX = this._visualPieceX + (piece.x - this._visualPieceX) * lerpFactor;
    if (hardDropActive) {
      // Beim Hard-Drop vertikale Position nicht weich interpolieren,
      // damit es keinen optischen „Rücksprung“ gibt.
      this._visualPieceY = piece.y;
    } else {
      this._visualPieceY = this._visualPieceY + (piece.y - this._visualPieceY) * lerpFactor;
    }
    this._lastPieceY = piece.y;

    // Beim Hard-Drop wird die vertikale Animation explizit in TetrisGame gesteuert.
    // In dieser Phase kann piece.y nicht-integer sein → dann KEINE Kollisionsabfrage
    // mit dem Board durchführen, um Index-Fehler zu vermeiden.
    let fallOffset = 0;
    if (!game.hardDropAnim) {
      fallOffset = game.dropProgress ?? 0;
      const testPiece = piece.clone();
      testPiece.y += 1;
      const canFall = game.board?.canPlace(
        testPiece,
        testPiece.x,
        testPiece.y,
        testPiece.rotationIndex,
      );
      if (!canFall) fallOffset = 0;
    }
    const blocks = piece.getBlocks();
    for (const b of blocks) {
      const x = this._visualPieceX + b.x;
      const y = this._visualPieceY + b.y + fallOffset;
      const maxHp = game.durability?.getMaxHp(piece.materialId) ?? 1;
      this.blockRenderer.drawBlock(
        ctx,
        x,
        y,
        { colorId: piece.colorId, materialId: piece.materialId, hp: maxHp, maxHp },
        cellSize,
        offsetX,
        offsetY,
      );
    }
  }

  drawParticles(ctx, particleSystem, cellSize, offsetX, offsetY) {
    const list = particleSystem.particles;
    for (const p of list) {
      const px = offsetX + p.x * cellSize;
      const py = offsetY + p.y * cellSize;
      const t = Math.max(0, Math.min(1, p.age / p.life));

      let r;
      let g;
      let b;
      let alpha = 1 - t;

      ctx.save();
      if (p.type === 'spark') {
        // Temperaturbasierte Farb- und Intensitätsverteilung für Funken
        const temp = Math.max(0, Math.min(1.1, p.temp ?? 1 - t));
        let u = temp;
        if (u > 0.7) {
          // weiß ↔ gelb
          const k = (u - 0.7) / 0.4;
          r = 255;
          g = Math.round(230 + (255 - 230) * k);
          b = Math.round(180 + (235 - 180) * k);
        } else if (u > 0.4) {
          // gelb ↔ orange
          const k = (u - 0.4) / 0.3;
          r = 255;
          g = Math.round(170 + (230 - 170) * k);
          b = Math.round(60 + (180 - 60) * k);
        } else {
          // orange ↔ rot/dunkelrot
          const k = u / 0.4;
          r = Math.round(160 + (255 - 160) * k);
          g = Math.round(30 + (80 - 30) * k);
          b = Math.round(20 + (40 - 20) * k);
        }

        // Blitz-Peak zu Beginn
        const flash = Math.max(0, 1 - p.age / 50);
        // Flicker: stärker bei hoher Temperatur
        const flicker = 0.8 + 0.3 * Math.random() * (0.3 + temp);
        alpha = (0.7 + 0.3 * temp) * flicker + flash * 0.5;

        ctx.globalCompositeOperation = 'lighter';

        const sizeBase = p.sizePx ?? 1;
        const speed = Math.hypot(p.vx ?? 0, p.vy ?? 0);
        const stretch = 1 + Math.min(2.5, (speed / 18) * 2);
        const lengthPx = sizeBase * stretch;
        const thicknessPx = Math.max(1, sizeBase - 0.3);
        const angle = Math.atan2(p.vy ?? 0, p.vx ?? 0);

        ctx.translate(px, py);
        if (speed > 0.1) ctx.rotate(angle);
        ctx.fillStyle = `rgba(${r},${g},${b},${alpha})`;
        // Kern
        ctx.fillRect(0, -thicknessPx * 0.5, lengthPx, thicknessPx);

        // leichter Glow
        const glowAlpha = alpha * 0.35;
        ctx.fillStyle = `rgba(${r},${g},${b},${glowAlpha})`;
        ctx.fillRect(0, -thicknessPx, lengthPx * 1.4, thicknessPx * 2);
      } else if (
        (p.type === 'smoke' || p.type === 'slimeDrop' || p.type === 'slimeTiny') &&
        p.radiusCell
      ) {
        const start = p.startColor || { r: 255, g: 255, b: 255 };
        const end = p.endColor || start;
        r = Math.round(start.r + (end.r - start.r) * t);
        g = Math.round(start.g + (end.g - start.g) * t);
        b = Math.round(start.b + (end.b - start.b) * t);
        const radiusPx = p.radiusCell * cellSize * (1 + 0.3 * t);
        const grad = ctx.createRadialGradient(px, py, 0, px, py, radiusPx);
        grad.addColorStop(0, `rgba(${r},${g},${b},${alpha * 0.6})`);
        grad.addColorStop(1, `rgba(${r},${g},${b},0)`);
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(px, py, radiusPx, 0, Math.PI * 2);
        ctx.fill();
      } else {
        const start = p.startColor || { r: 255, g: 255, b: 255 };
        const end = p.endColor || start;
        r = Math.round(start.r + (end.r - start.r) * t);
        g = Math.round(start.g + (end.g - start.g) * t);
        b = Math.round(start.b + (end.b - start.b) * t);
        const sizePx = p.sizePx ?? 1;
        ctx.fillStyle = `rgba(${r},${g},${b},${alpha})`;

        if (
          p.type === 'stoneChunk' ||
          p.type === 'woodFine' ||
          p.type === 'woodChunk' ||
          p.type === 'glassChip' ||
          p.type === 'glassChunk' ||
          p.type === 'grassBlade' ||
          p.type === 'dirtChunk'
        ) {
          // längliche / kantige Fragmente als gedrehte Rechtecke
          let w = sizePx;
          let h = sizePx;
          if (p.type === 'woodFine') {
            w = sizePx * 2.2;
            h = sizePx * 0.7;
          } else if (p.type === 'woodChunk') {
            w = sizePx * 1.8;
            h = sizePx * 0.9;
          } else if (p.type === 'glassChip') {
            w = sizePx * 1.6;
            h = sizePx * 0.9;
          } else if (p.type === 'glassChunk') {
            w = sizePx * 1.9;
            h = sizePx * 1.1;
          } else if (p.type === 'stoneChunk') {
            w = sizePx * 1.3;
            h = sizePx;
          } else if (p.type === 'grassBlade') {
            w = sizePx * 2.0;
            h = sizePx * 0.5;
          } else if (p.type === 'dirtChunk') {
            w = sizePx * 1.0;
            h = sizePx * 1.0;
          }
          ctx.translate(px, py);
          ctx.rotate(p.angle ?? 0);
          ctx.fillRect(-w / 2, -h / 2, w, h);
        } else {
          // Standard: kleine Chips ohne Emission
          ctx.fillRect(px, py, sizePx, sizePx);
        }
      }
      ctx.restore();
    }
  }

  drawOverlay(ctx, game, canvasContext) {
    if (!game.gameOver && !game.paused) return;
    const { width, height } = canvasContext;
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.fillRect(0, 0, width, height);

    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = 'bold 32px system-ui, sans-serif';

    const text = game.gameOver ? 'Game Over' : 'Pause';
    ctx.fillText(text, width / 2, height / 2);
  }
}

