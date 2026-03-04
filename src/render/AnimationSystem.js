export class AnimationSystem {
  constructor() {
    this.shakeTime = 0;
    this.shakeStrength = 0;
    this.lineFalls = [];
    this.lockBounces = [];
    this.fallBlocks = [];
    // Wenn true, laufen alle Auflöse-/Fall-Animationen stark verlangsamt.
    this.debugSlowAnimations = false;
  }

  addShake(strength = 6, duration = 180) {
    this.shakeStrength = Math.max(this.shakeStrength, strength);
    this.shakeTime = Math.max(this.shakeTime, duration);
  }

  update(dt) {
    const scale = this.debugSlowAnimations ? 0.15 : 1;
    const sdt = dt * scale;

    if (this.shakeTime > 0) {
      this.shakeTime -= sdt;
      if (this.shakeTime < 0) this.shakeTime = 0;
      if (this.shakeTime === 0) this.shakeStrength = 0;
    }

    this.lineFalls = this.lineFalls.filter((f) => {
      f.time += sdt;
      return f.time < f.duration;
    });

    this.lockBounces = this.lockBounces.filter((lb) => {
      lb.time += sdt;
      return lb.time < lb.duration;
    });

    this.fallBlocks = this.fallBlocks.filter((b) => {
      b.elapsed += sdt;
      const delay = b.delay ?? 0;
      return b.elapsed < delay + b.duration;
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
      slime: { amplitude: 0.16, duration: 260 },
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
    const baseDuration = 220; // ms, Grunddauer pro Fall-Animation

    // Bewegungen nach Startzeile sortieren (niedrigere Zeilen zuerst),
    // damit die der gelöschten Zeile nächstgelegene Reihe zuerst fällt.
    const sorted = [...moves].sort((a, b) => b.fromY - a.fromY);
    const uniqueRows = [...new Set(sorted.map((m) => m.fromY))];
    uniqueRows.sort((a, b) => b - a); // von unten nach oben

    const rowDelayMs = 90; // Verzögerung zwischen den Reihen

    for (const move of sorted) {
      const dy = move.toY - move.fromY;
      if (dy <= 0) continue;
      const mat = MATERIALS[move.cell?.materialId] || {};
      const g = mat.gravityFactor ?? 1;
      const duration = Math.max(160, Math.min(320, baseDuration / g));

      const rowIndex = uniqueRows.indexOf(move.fromY);
      const delay = Math.max(0, rowIndex) * rowDelayMs;

      this.fallBlocks.push({
        x: move.x,
        fromY: move.fromY,
        toY: move.toY,
        cell: move.cell,
        elapsed: 0,
        duration,
        delay,
      });
    }
  }

  getFallingBlocks() {
    const result = [];
    for (const b of this.fallBlocks) {
      const delay = b.delay ?? 0;
      const raw = b.elapsed - delay;
      if (raw <= 0) {
        // Noch nicht gestartet → Block bleibt optisch an der Startposition.
        result.push({
          x: b.x,
          y: b.fromY,
          toY: b.toY,
          cell: b.cell,
        });
        continue;
      }
      const t = Math.min(1, raw / b.duration);
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

  setDebugSlowAnimations(enabled) {
    this.debugSlowAnimations = !!enabled;
  }
}

