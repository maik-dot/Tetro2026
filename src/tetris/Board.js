import { BOARD_WIDTH, BOARD_HEIGHT, MATERIALS } from '../config/gameConfig.js';

export class Board {
  constructor(width = BOARD_WIDTH, height = BOARD_HEIGHT) {
    this.width = width;
    this.height = height;
    this.reset();
  }

  reset() {
    this.grid = [];
    for (let y = 0; y < this.height; y++) {
      const row = [];
      for (let x = 0; x < this.width; x++) {
        row.push(null);
      }
      this.grid.push(row);
    }
  }

  inside(x, y) {
    return x >= 0 && x < this.width && y >= 0 && y < this.height;
  }

  getCell(x, y) {
    if (!this.inside(x, y)) return null;
    return this.grid[y][x];
  }

  setCell(x, y, cell) {
    if (!this.inside(x, y)) return;
    this.grid[y][x] = cell;
  }

  canPlace(piece, offsetX = piece.x, offsetY = piece.y, rotationIndex = piece.rotationIndex) {
    const blocks = piece.getBlocks(rotationIndex);
    for (const b of blocks) {
      const x = offsetX + b.x;
      const y = offsetY + b.y;
      if (!this.inside(x, y) || this.getCell(x, y)) {
        return false;
      }
    }
    return true;
  }

  lockPiece(piece) {
    const blocks = piece.getBlocks();
    const material = MATERIALS[piece.materialId] ?? MATERIALS.wood;
    const maxHp = material?.maxHp ?? 1;
    for (const b of blocks) {
      const x = piece.x + b.x;
      const y = piece.y + b.y;
      if (this.inside(x, y)) {
        this.setCell(x, y, {
          type: piece.type,
          colorId: piece.colorId,
          materialId: piece.materialId,
          hp: maxHp,
          maxHp,
        });
      }
    }
  }

  clearFullLines() {
    const fullRows = [];
    for (let y = 0; y < this.height; y++) {
      const isFull = this.grid[y].every((cell) => cell !== null);
      if (isFull) {
        fullRows.push(y);
      }
    }
    if (fullRows.length === 0) {
      return { count: 0, rows: [], moves: [] };
    }

    // Schaden auf alle Blöcke in vollen Reihen anwenden
    const destroyed = [];
    for (const y of fullRows) {
      for (let x = 0; x < this.width; x++) {
        const cell = this.grid[y][x];
        if (!cell) continue;
        cell.hp = (cell.hp ?? 1) - 1;
        if (cell.hp <= 0) {
          destroyed.push({ x, y, cell });
          this.grid[y][x] = null;
        }
      }
    }
    const moves = [];

    // Schwerkraft: Spalten nach unten „zusammenfallen“ lassen
    for (let x = 0; x < this.width; x++) {
      const stack = [];
      for (let y = 0; y < this.height; y++) {
        const cell = this.grid[y][x];
        if (cell) stack.push({ cell, fromY: y });
      }
      for (let y = this.height - 1; y >= 0; y--) {
        const item = stack.length > 0 ? stack.pop() : null;
        if (item) {
          this.grid[y][x] = item.cell;
          if (item.fromY !== y) {
            moves.push({
              x,
              fromY: item.fromY,
              toY: y,
              cell: item.cell,
            });
          }
        } else {
          this.grid[y][x] = null;
        }
      }
    }

    // Für Scoring und Effekte sowohl Anzahl als auch betroffene Reihen zurückgeben
    return { count: fullRows.length, rows: fullRows, moves, destroyed };
  }
}

