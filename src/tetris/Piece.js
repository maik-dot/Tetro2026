export class Piece {
  constructor(type, rotations, colorId) {
    this.type = type;
    this.rotations = rotations;
    this.colorId = colorId;
    // Wird von TetrisGame beim Spawn gesetzt, um Blöcke auf dem Board
    // einem Tetromino zuordnen zu können (Fragment-Tracking).
    this.pieceId = null;
    this.materialId = 'wood';
    this.rotationIndex = 0;
    this.x = 3;
    this.y = 0;
    // Basis-Shape (Rotation 0) als Referenz für Textur-Seeds.
    this._baseShape = this.rotations[0];

    // Seed-Grid für Texturvarianten im Basis-Shape.
    const baseShape = this._baseShape;
    this._variantSeeds = baseShape.map((row) =>
      row.map(() => Math.floor(Math.random() * 0x7fffffff)),
    );

    // Visuelle Drehphase für Texturen (0–3, also 0°, 90°, 180°, 270°).
    this._texturePhase = 0;

    // Vorausberechnete Seed-Grids pro Rotation, passend zu den
    // vorgegebenen Rotationsmatrizen (inkl. eventueller Offsets).
    this._seedGrids = this._buildSeedGrids();
  }

  clone() {
    const p = new Piece(this.type, this.rotations, this.colorId);
    p.materialId = this.materialId;
    p.pieceId = this.pieceId;
    p.rotationIndex = this.rotationIndex;
    p.x = this.x;
    p.y = this.y;
    p._baseShape = this._baseShape;
    p._texturePhase = this._texturePhase;
    if (this._variantSeeds) {
      p._variantSeeds = this._variantSeeds.map((row) => row.slice());
    }
    if (this._seedGrids) {
      p._seedGrids = this._seedGrids.map((grid) =>
        grid.map((row) => row.slice()),
      );
    }
    return p;
  }

  get shape() {
    return this.rotations[this.rotationIndex];
  }

  getBlocks(rotationIndex = this.rotationIndex) {
    const shape = this.rotations[rotationIndex];
    const blocks = [];
    for (let y = 0; y < shape.length; y++) {
      for (let x = 0; x < shape[y].length; x++) {
        if (shape[y][x]) {
          blocks.push({ x, y });
        }
      }
    }
    return blocks;
  }

  /**
   * Wie getBlocks, liefert aber zusätzlich den Seed pro Block.
   * Die Seeds sind so vorab berechnet, dass sie den in PieceFactory
   * definierten Rotationen (inkl. Offsets) folgen.
   */
  getBlocksWithSeeds(rotationIndex = this.rotationIndex) {
    const shape = this.rotations[this.rotationIndex];
    const grid =
      this._seedGrids?.[this._texturePhase] ??
      this._seedGrids?.[this.rotationIndex];
    const blocks = [];
    for (let y = 0; y < shape.length; y++) {
      for (let x = 0; x < shape[y].length; x++) {
        if (!shape[y][x]) continue;
        const seed = grid?.[y]?.[x] ?? null;
        blocks.push({ x, y, seed });
      }
    }
    return blocks;
  }

  rotateCW() {
    this.rotationIndex = (this.rotationIndex + 1) % this.rotations.length;
    this._texturePhase = (this._texturePhase + 1) % 4;
  }

  rotateCCW() {
    this.rotationIndex =
      (this.rotationIndex + this.rotations.length - 1) %
      this.rotations.length;
    this._texturePhase = (this._texturePhase + 3) % 4;
  }

  getVariantSeed(localX, localY) {
    const grid =
      this._seedGrids?.[this._texturePhase] ??
      this._seedGrids?.[this.rotationIndex];
    return grid?.[localY]?.[localX] ?? null;
  }

  // --- interne Hilfsfunktion ---
  _buildSeedGrids() {
    const rotations = this.rotations;
    const base = this._baseShape;
    const N = base.length;

    // Alle Block-Positionen im Basis-Shape (Rotation 0)
    const baseBlocks = [];
    for (let y = 0; y < N; y++) {
      for (let x = 0; x < N; x++) {
        if (base[y][x]) {
          baseBlocks.push({ x, y });
        }
      }
    }

    const seedGrids = [];

    // Rotation 0 (Phase 0): direkte Zuordnung
    const grid0 = Array.from({ length: N }, () => Array(N).fill(null));
    for (const { x, y } of baseBlocks) {
      grid0[y][x] = this._variantSeeds?.[y]?.[x] ?? null;
    }
    seedGrids[0] = grid0;

    const rotateCoordCW = ({ x, y }) => ({
      x: N - 1 - y,
      y: x,
    });

    const forwardRotate = (coord, steps) => {
      let c = { x: coord.x, y: coord.y };
      for (let i = 0; i < steps; i++) {
        c = rotateCoordCW(c);
      }
      return c;
    };

    // Wir bauen bis zu 4 Phasen (0°, 90°, 180°, 270°) auf.
    for (let r = 1; r < 4; r++) {
      const targetShape = rotations[r % rotations.length];
      const grid = Array.from({ length: N }, () => Array(N).fill(null));

      const targetSet = new Set();
      const targetBlocks = [];
      for (let y = 0; y < targetShape.length; y++) {
        for (let x = 0; x < targetShape[y].length; x++) {
          if (targetShape[y][x]) {
            const key = `${x}:${y}`;
            targetSet.add(key);
            targetBlocks.push({ x, y });
          }
        }
      }

      let found = false;

      // dx/dy kompensieren eventuelle Offsets zwischen Basis- und Ziel-Shape
      outer: for (let dx = -2; dx <= 2; dx++) {
        for (let dy = -2; dy <= 2; dy++) {
          const used = new Set();
          let ok = true;
          const mappings = [];

          for (const baseCoord of baseBlocks) {
            const rotCoord = forwardRotate(baseCoord, r);
            const x2 = rotCoord.x + dx;
            const y2 = rotCoord.y + dy;
            const key = `${x2}:${y2}`;

            if (
              x2 < 0 ||
              x2 >= N ||
              y2 < 0 ||
              y2 >= N ||
              !targetSet.has(key) ||
              used.has(key)
            ) {
              ok = false;
              break;
            }
            used.add(key);
            mappings.push({ from: baseCoord, to: { x: x2, y: y2 } });
          }

          if (ok && mappings.length === baseBlocks.length) {
            // Seeds gemäß Mapping eintragen
            for (const m of mappings) {
              const seed = this._variantSeeds?.[m.from.y]?.[m.from.x] ?? null;
              grid[m.to.y][m.to.x] = seed;
            }
            found = true;
            break outer;
          }
        }
      }

      // Fallback: 1:1 in Block-Listen-Reihenfolge, falls kein sauberes Mapping gefunden wird
      if (!found) {
        const limit = Math.min(baseBlocks.length, targetBlocks.length);
        for (let i = 0; i < limit; i++) {
          const from = baseBlocks[i];
          const to = targetBlocks[i];
          const seed = this._variantSeeds?.[from.y]?.[from.x] ?? null;
          grid[to.y][to.x] = seed;
        }
      }

      seedGrids[r] = grid;
    }

    return seedGrids;
  }
}

