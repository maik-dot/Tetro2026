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
          pieceId: piece.pieceId ?? null,
          isFragment: false,
          hp: maxHp,
          maxHp,
        });
      }
    }
  }

  /**
   * Spezielle Gravitation für Schleim:
   * Alle Schleim-Zellen in einer Spalte fallen in freie Lücken unter ihnen,
   * andere Materialien bleiben unbewegt und blockieren.
   */
  applySlimeGravity() {
    const moves = [];
    for (let x = 0; x < this.width; x++) {
      for (let y = this.height - 1; y >= 0; y--) {
        if (this.grid[y][x] !== null) continue;
        // freie Zelle → nach oben nach Schleim suchen, der ohne Blocker fallen darf
        for (let k = y - 1; k >= 0; k--) {
          const cell = this.grid[k][x];
          if (!cell) continue;
          if (cell.materialId !== 'slime') {
            // anderer Block stoppt den Schleim darüber
            break;
          }
          this.grid[y][x] = cell;
          this.grid[k][x] = null;
          moves.push({
            x,
            fromY: k,
            toY: y,
            cell,
          });
          break;
        }
      }
    }
    return moves;
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
      return { count: 0, rows: [], moves: [], destroyed: [] };
    }

    // Row-basierte Gravitation im klassischen Tetris-Sinn:
    // Alle vollen Reihen werden entfernt, alle Reihen darüber rücken
    // geschlossen nach unten nach, andere Lücken bleiben erhalten.
    const isFullRow = new Array(this.height).fill(false);
    const destroyed = [];
    for (const y of fullRows) {
      isFullRow[y] = true;
    }

    const moves = [];
    const newGrid = [];
    for (let y = 0; y < this.height; y++) {
      const row = new Array(this.width);
      for (let x = 0; x < this.width; x++) row[x] = null;
      newGrid.push(row);
    }

    let writeY = this.height - 1;
    for (let y = this.height - 1; y >= 0; y--) {
      const row = this.grid[y];
      if (!row) continue;
      if (isFullRow[y]) {
        // Zellen dieser vollen Zeile werden zerstört (für Partikel/SFX).
        for (let x = 0; x < this.width; x++) {
          const cell = row[x];
          if (cell) {
            destroyed.push({ x, y, cell });
          }
        }
        continue;
      }
      if (writeY !== y) {
        for (let x = 0; x < this.width; x++) {
          const cell = row[x];
          newGrid[writeY][x] = cell;
          if (cell) {
            moves.push({
              x,
              fromY: y,
              toY: writeY,
              cell,
            });
          }
        }
      } else {
        // Zeile bleibt an Ort und Stelle
        for (let x = 0; x < this.width; x++) {
          newGrid[writeY][x] = row[x];
        }
      }
      writeY--;
    }

    // Obere, nicht beschriebenen Zeilen bleiben leer (bereits null).
    this.grid = newGrid;

    return {
      count: fullRows.length,
      rows: fullRows,
      moves,
      destroyed,
    };
  }

  /**
   * Klassische Gravitation: jede Spalte wird kompakt nach unten gestapelt.
   * Gibt Bewegungen der Zellen zurück, um Animationen zu ermöglichen.
   */
  applyClassicGravity() {
    const moves = [];
    for (let x = 0; x < this.width; x++) {
      const stack = [];
      for (let y = 0; y < this.height; y++) {
        const cell = this.grid[y][x];
        if (cell) stack.push({ cell, fromY: y });
      }
      for (let y = this.height - 1; y >= 0; y--) {
        // Von unten nach oben befüllen: jeweils das unterste verbleibende
        // Element der Spalte nach unten holen.
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
    return { moves };
  }

  /**
   * Markiert alle Zellen als Fragmente, deren pieceId nicht mehr einem
   * intakten Tetromino entspricht (4 Zellen, zusammenhängend).
   */
  markFragmentsAfterClear() {
    const byPiece = new Map();
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        const cell = this.grid[y][x];
        if (!cell || cell.pieceId == null) continue;
        let list = byPiece.get(cell.pieceId);
        if (!list) {
          list = [];
          byPiece.set(cell.pieceId, list);
        }
        list.push({ x, y, cell });
      }
    }

    for (const [pieceId, cells] of byPiece.entries()) {
      if (!cells.length) continue;
      // Intakt = genau 4 Zellen und alle orthogonal zusammenhängend
      const expectedCount = 4;
      const isCandidateIntact = cells.length === expectedCount;
      let allConnected = false;
      if (isCandidateIntact) {
        const visited = new Set();
        const key = (x, y) => `${x}:${y}`;
        const cellSet = new Set(cells.map((c) => key(c.x, c.y)));
        const stack = [cells[0]];
        visited.add(key(cells[0].x, cells[0].y));
        while (stack.length) {
          const cur = stack.pop();
          const dirs = [
            [1, 0],
            [-1, 0],
            [0, 1],
            [0, -1],
          ];
          for (const [dx, dy] of dirs) {
            const nx = cur.x + dx;
            const ny = cur.y + dy;
            const k = key(nx, ny);
            if (!cellSet.has(k) || visited.has(k)) continue;
            visited.add(k);
            stack.push({ x: nx, y: ny });
          }
        }
        allConnected = visited.size === cells.length;
      }

      const isIntact = isCandidateIntact && allConnected;
      for (const { cell } of cells) {
        cell.isFragment = !isIntact;
      }
    }
  }

  /**
   * Lässt Fragmente ohne Unterstützung nach und nach zerfallen.
   * Gibt zerstörte Zellen und ggf. zusätzliche Bewegungen nach
   * einer klassischen Gravitation zurück.
   */
  applyFragmentDecay() {
    const destroyed = [];
    let anyRemoved = false;

    const hasSupportBelow = (x, y) => {
      if (y === this.height - 1) return true;
      const below = this.getCell(x, y + 1);
      return !!below;
    };

    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        const cell = this.grid[y][x];
        if (!cell || !cell.isFragment) continue;
        if (hasSupportBelow(x, y)) continue;
        cell.hp = (cell.hp ?? cell.maxHp ?? 1) - 1;
        if (cell.hp <= 0) {
          destroyed.push({ x, y, cell });
          this.grid[y][x] = null;
          anyRemoved = true;
        }
      }
    }

    let movesAfterDecay = [];
    if (anyRemoved) {
      const res = this.applyClassicGravity();
      movesAfterDecay = res.moves || [];
    }

    return { destroyed, movesAfterDecay };
  }
}

