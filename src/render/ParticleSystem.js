export class ParticleSystem {
  constructor(groundY = 20) {
    this.particles = [];
    this.groundY = groundY;
  }

  spawnLineClear(rows, boardWidth) {
    const intensity = 10;
    for (const row of rows) {
      for (let i = 0; i < intensity; i++) {
        const x = Math.random() * boardWidth;
        const y = row + Math.random();
        const angle = (Math.random() - 0.5) * Math.PI;
        const speed = 5 + Math.random() * 4;
        this.particles.push({
          type: 'line',
          x,
          y,
          vx: Math.cos(angle) * speed,
          vy: -Math.abs(Math.sin(angle) * speed),
          ax: 0,
          ay: 9, // leichte Gravitation
          drag: 1.4,
          life: 450 + Math.random() * 250,
          age: 0,
          sizePx: 1,
          startColor: { r: 255, g: 255, b: 255 },
          endColor: { r: 180, g: 200, b: 255 },
        });
      }
    }
  }

  update(dt) {
    if (!this.particles.length) return;

    const t = dt / 1000;
    const groundY = this.groundY ?? 20;

    this.particles = this.particles.filter((p) => {
      p.age += dt;
      if (p.age > p.life) return false;

      if (p.type === 'spark') {
        // Erweiterte Funken-Physik (Metall schleifen/schneiden)
        const g = p.ay ?? 22;
        // Gravitation (semi-implizit)
        p.vy += g * t;

        // Quadratischer Luftwiderstand: a_d = -k * |v| * v
        let vx = p.vx;
        let vy = p.vy;
        let speed = Math.hypot(vx, vy);
        if (speed > 0.0001) {
          const dragK = p.dragK ?? 4.5;
          let dragAcc = dragK * speed;
          const maxAcc = speed / t;
          if (dragAcc > maxAcc) dragAcc = maxAcc;
          const axDrag = (vx / speed) * dragAcc;
          const ayDrag = (vy / speed) * dragAcc;
          p.vx -= axDrag * t;
          p.vy -= ayDrag * t;
          vx = p.vx;
          vy = p.vy;
          speed = Math.hypot(vx, vy);
        }

        // Positionsintegration
        p.x += p.vx * t;
        p.y += p.vy * t;

        // Boden-Kollision (y = groundY)
        if (p.y >= groundY) {
          p.y = groundY;
          const e = 0.35; // Rückprall
          const mu = 0.6; // Reibung

          // Normal (y) & Tangente (x)
          p.vy = -e * p.vy;
          p.vx = (1 - mu) * p.vx;

          // Energie-/Temperaturverlust beim Aufprall
          p.temp = (p.temp ?? 1) * 0.8;

          const postSpeed = Math.hypot(p.vx, p.vy);
          if (postSpeed < 1.4) {
            // roll/slide → sehr kurze Restlebensdauer
            p.life = Math.min(p.life, p.age + 80);
          }
        }

        // Temperatur-/Energie-Modell: dE/dt = -c1 - c2 * |v|^2
        const speedNow = Math.hypot(p.vx, p.vy);
        const normSpeed = Math.min(1.5, speedNow / 20);
        const c1 = 1.4;
        const c2 = 1.1;
        const tempLoss = (c1 + c2 * normSpeed * normSpeed) * t;
        p.temp = (p.temp ?? 1) - tempLoss;

        if (p.temp <= 0 && p.age > 40) return false;
      } else {
        // Standard-Partikel (Rauch, Splitter, etc.)
        const drag = p.drag ?? 0;
        p.vx += (p.ax ?? 0) * t;
        p.vy += (p.ay ?? 0) * t;
        const dragFactor = Math.max(0, 1 - drag * t);
        p.vx *= dragFactor;
        p.vy *= dragFactor;

        p.x += p.vx * t;
        p.y += p.vy * t;
      }

      // Unterhalb des Spielfelds verwerfen (Performance-Guard)
      if (p.y > groundY + 10) return false;

      return true;
    });
  }

  spawnDestroyBlocks(destroyedBlocks) {
    if (!destroyedBlocks || !destroyedBlocks.length) return;
    for (const { x, y, cell } of destroyedBlocks) {
      const mat = cell?.materialId || 'wood';
      switch (mat) {
        case 'glass':
          this._spawnGlassShards(x, y);
          break;
        case 'wood':
          this._spawnWoodSplinters(x, y);
          break;
        case 'stone':
          this._spawnStoneDebris(x, y);
          break;
        case 'metal':
          this._spawnMetalSparks(x, y);
          break;
        default:
          this._spawnWoodSplinters(x, y);
      }
    }
  }

  _spawnGlassShards(x, y) {
    const count = 22;
    for (let i = 0; i < count; i++) {
      const angle = (Math.random() - 0.5) * Math.PI;
      const speed = 6 + Math.random() * 6;
      this.particles.push({
        type: 'glassShard',
        x: x + (Math.random() - 0.5) * 0.5,
        y: y + (Math.random() - 0.5) * 0.3,
        vx: Math.cos(angle) * speed,
        vy: -Math.abs(Math.sin(angle) * speed),
        ax: 0,
        ay: 12,
        drag: 1.1,
        life: 320 + Math.random() * 220,
        age: 0,
        sizePx: 1 + Math.floor(Math.random() * 2),
        startColor: { r: 200 + Math.random() * 40, g: 240, b: 255 },
        endColor: { r: 130, g: 200, b: 255 },
      });
    }
  }

  _spawnWoodSplinters(x, y) {
    const count = 14;
    for (let i = 0; i < count; i++) {
      const angle = (Math.random() - 0.5) * (Math.PI / 1.4);
      const speed = 4 + Math.random() * 4;
      this.particles.push({
        type: 'woodChip',
        x: x + (Math.random() - 0.5) * 0.4,
        y: y + (Math.random() - 0.5) * 0.3,
        vx: Math.cos(angle) * speed,
        vy: -Math.abs(Math.sin(angle) * speed) * 0.6,
        ax: 0,
        ay: 13,
        drag: 1.8,
        life: 420 + Math.random() * 260,
        age: 0,
        sizePx: 1 + Math.floor(Math.random() * 2),
        startColor: { r: 180 + Math.random() * 30, g: 130 + Math.random() * 25, b: 80 },
        endColor: { r: 120, g: 90, b: 60 },
      });
    }
    // Staub
    for (let i = 0; i < 8; i++) {
      const speed = 2 + Math.random() * 2;
      this.particles.push({
        type: 'smoke',
        x: x + (Math.random() - 0.5) * 0.6,
        y: y + 0.2,
        vx: (Math.random() - 0.5) * speed,
        vy: -Math.random() * 1.5,
        ax: 0,
        ay: -4,
        drag: 1.5,
        life: 520 + Math.random() * 420,
        age: 0,
        sizePx: 1,
        radiusCell: 0.4 + Math.random() * 0.4,
        startColor: { r: 140, g: 110, b: 80 },
        endColor: { r: 80, g: 70, b: 60 },
      });
    }
  }

  _spawnStoneDebris(x, y) {
    const count = 14;
    for (let i = 0; i < count; i++) {
      const angle = (Math.random() - 0.5) * (Math.PI / 1.8);
      const speed = 3 + Math.random() * 3;
      this.particles.push({
        type: 'stoneChip',
        x: x + (Math.random() - 0.5) * 0.4,
        y: y + (Math.random() - 0.5) * 0.3,
        vx: Math.cos(angle) * speed,
        vy: -Math.abs(Math.sin(angle) * speed) * 0.7,
        ax: 0,
        ay: 14,
        drag: 1.6,
        life: 520 + Math.random() * 380,
        age: 0,
        sizePx: 1 + Math.floor(Math.random() * 2),
        startColor: { r: 160 + Math.random() * 20, g: 170 + Math.random() * 20, b: 180 + Math.random() * 20 },
        endColor: { r: 110, g: 115, b: 120 },
      });
    }
    // Staubwolke
    for (let i = 0; i < 10; i++) {
      const speed = 1.5 + Math.random() * 1.5;
      this.particles.push({
        type: 'smoke',
        x: x + (Math.random() - 0.5) * 0.8,
        y: y + 0.3,
        vx: (Math.random() - 0.5) * speed,
        vy: -Math.random() * 1.2,
        ax: 0,
        ay: -3,
        drag: 1.7,
        life: 650 + Math.random() * 520,
        age: 0,
        sizePx: 1,
        radiusCell: 0.5 + Math.random() * 0.5,
        startColor: { r: 130, g: 135, b: 140 },
        endColor: { r: 90, g: 95, b: 100 },
      });
    }
  }

  /**
   * Funken bei Metallkontakt (z.B. Block fällt auf Metallblock).
   * Die Intensität und Lebensdauer hängt von den Material-Paaren ab.
   *
   * - metal + metal  → starke Intensität, Ziel-Lebensdauer ~3200 ms
   * - stone + metal  → mittlere Intensität, Ziel-Lebensdauer ~1600 ms
   * - glass + metal  → geringe Intensität, Ziel-Lebensdauer ~800 ms
   * - wood + metal   → keine Funken
   */
  spawnMetalContactSparks(x, y, matA, matB) {
    if (!matA || !matB) return;
    const a = matA;
    const b = matB;
    const aIsMetal = a === 'metal';
    const bIsMetal = b === 'metal';
    if (!aIsMetal && !bIsMetal) return;

    let other = aIsMetal ? b : a;
    if (!other) return;

    let baseLife = 0;
    let intensity = 0;

    if (aIsMetal && bIsMetal) {
      // Metall auf Metall
      baseLife = 3200;
      intensity = 1.0;
    } else if (other === 'stone') {
      // Stein auf Metall
      baseLife = 1600;
      intensity = 0.65;
    } else if (other === 'glass') {
      // Glas auf Metall
      baseLife = 800;
      intensity = 0.35;
    } else if (other === 'wood') {
      // Holz auf Metall → keine Funken
      return;
    } else {
      // andere Kombinationen ignorieren
      return;
    }

    this._spawnMetalSparks(x, y, { baseLife, intensity });
  }

  _spawnMetalSparks(x, y, options = {}) {
    const baseCount = 26;
    const intensity = options.intensity ?? 1;
    const count = Math.max(1, Math.round(baseCount * intensity));
    const baseLife = options.baseLife ?? 1200; // mittlere Lebensdauer für Standard-Metallbrüche
    const lifeJitter = options.lifeJitter ?? 0.6; // ±30 % Streuung

    for (let i = 0; i < count; i++) {
      const spread = Math.PI / 5; // Fächeröffnung
      const toRight = Math.random() < 0.5;
      const baseAngle = toRight ? 0 : Math.PI; // 0 = rechts, PI = links
      // leicht zentrierte Verteilung um den Basiswinkel
      const u = (Math.random() + Math.random()) / 2 - 0.5; // peaked around 0
      let angle = baseAngle + u * spread;
      // wenige Ausreißer nach oben
      if (Math.random() < 0.12) {
        angle = -Math.PI / 2 + (Math.random() - 0.5) * (Math.PI / 6);
      }
      const speed = 10 + Math.random() * 10;
      const lifeFactor = 1 - lifeJitter / 2 + Math.random() * lifeJitter;
      this.particles.push({
        type: 'spark',
        x: x + (Math.random() - 0.5) * 0.3,
        y: y + (Math.random() - 0.5) * 0.2,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        // Physik-Parameter
        mass: 1,
        dragK: 4.5, // quadratischer Luftwiderstand
        ay: 22,
        life: baseLife * lifeFactor,
        age: 0,
        sizePx: 1 + Math.floor(Math.random() * 3),
        temp: 1.1 + Math.random() * 0.4, // 1 = sehr heiß
      });
    }
  }
}

