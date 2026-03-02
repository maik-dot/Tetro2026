export class AnimationSystem {
  constructor() {
    this.shakeTime = 0;
    this.shakeStrength = 0;
    this.lineFalls = [];
    this.lockBounces = [];
    this.fallBlocks = [];
  }

  addShake(strength = 6, duration = 180) {
    this.shakeStrength = Math.max(this.shakeStrength, strength);
    this.shakeTime = Math.max(this.shakeTime, duration);
  }

  update(dt) {
    if (this.shakeTime > 0) {
      this.shakeTime -= dt;
      if (this.shakeTime < 0) this.shakeTime = 0;
      if (this.shakeTime === 0) this.shakeStrength = 0;
    }

    this.lineFalls = this.lineFalls.filter((f) => {
      f.time += dt;
      return f.time < f.duration;
    });

    this.lockBounces = this.lockBounces.filter((lb) => {
      lb.time += dt;
      return lb.time < lb.duration;
    });

    this.fallBlocks = this.fallBlocks.filter((b) => {
      b.elapsed += dt;
      return b.elapsed < b.duration;
    });
  }

  getOffset() {
    if (this.shakeTime <= 0 || this.shakeStrength <= 0) {
      return { x: 0, y: 0 };
    }
    const factor = this.shakeTime / 180;
    const strength = this.shakeStrength * factor;
    const x = (Math.random() - 0.5) * strength;
    const y = (Math.random() - 0.5) * strength;
    return { x, y };
  }

  addLineFall(minRow, duration = 220) {
    this.lineFalls.push({ minRow, time: 0, duration });
  }

  getFallOffsetForRow(row, materialId) {
    let offset = 0;
    for (const f of this.lineFalls) {
      if (row < f.minRow) {
        const t = Math.min(1, f.time / f.duration);
        const s = Math.sin(t * Math.PI); // 0 -> 1 -> 0
        let amplitude = 0.18;
        if (materialId === 'glass') amplitude = 0.22;
        else if (materialId === 'wood') amplitude = 0.18;
        else if (materialId === 'stone') amplitude = 0.14;
        else if (materialId === 'metal') amplitude = 0.1;
        offset += -amplitude * s;
      }
    }
    return offset;
  }

  addLockBounce(cells, impactType = 'normal') {
    const config = {
      normal: { amplitude: 0.06, duration: 140 },
      soft: { amplitude: 0.12, duration: 180 },
      hard: { amplitude: 0.2, duration: 220 },
    };
    const { amplitude, duration } = config[impactType] ?? config.normal;
    this.lockBounces.push({
      cells: cells.map((c) => ({ x: c.x, y: c.y })),
      time: 0,
      duration,
      amplitude,
    });
  }

  getLockBounceOffset(x, y) {
    let offset = 0;
    for (const lb of this.lockBounces) {
      const inCell = lb.cells.some((c) => c.x === x && c.y === y);
      if (!inCell) continue;
      const t = Math.min(1, lb.time / lb.duration);
      const s = Math.sin(t * Math.PI);
      offset += lb.amplitude * s;
    }
    return offset;
  }

  addBlockFalls(moves, materials) {
    if (!moves || !moves.length) return;
    const MATERIALS = materials ?? {};
    const baseDuration = 200; // ms, Grunddauer pro Fall-Animation
    for (const move of moves) {
      const dy = move.toY - move.fromY;
      if (dy <= 0) continue;
      const mat = MATERIALS[move.cell?.materialId] || {};
      const g = mat.gravityFactor ?? 1;
      const duration = Math.max(120, Math.min(240, baseDuration / g));
      this.fallBlocks.push({
        x: move.x,
        fromY: move.fromY,
        toY: move.toY,
        cell: move.cell,
        elapsed: 0,
        duration,
      });
    }
  }

  getFallingBlocks() {
    const result = [];
    for (const b of this.fallBlocks) {
      const t = Math.min(1, b.elapsed / b.duration);
      const eased = t * t; // Beschleunigung (Gravitationseffekt)
      const y = b.fromY + (b.toY - b.fromY) * eased;
      result.push({
        x: b.x,
        y,
        toY: b.toY,
        cell: b.cell,
      });
    }
    return result;
  }
}

