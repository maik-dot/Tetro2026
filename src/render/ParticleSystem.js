// Lokale Hilfsfunktion (vereinfachtes lerp) für Partikeleffekte
function lerp(a, b, t) {
  return a + (b - a) * t;
}

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
      } else if (p.type === 'stoneChip' || p.type === 'stoneChunk') {
        // StoneDebrisUpdate: Stein-Splitter & -Brocken
        if (!p.sleep) {
          const g = p.ay ?? 18;
          p.vy += g * t;

          const dragLin = p.dragLin ?? 0;
          if (dragLin > 0) {
            // linearer Luftwiderstand
            p.vx -= p.vx * dragLin * t;
            p.vy -= p.vy * dragLin * t;
          }

          p.x += p.vx * t;
          p.y += p.vy * t;

          const groundY = this.groundY ?? 20;
          if (p.y >= groundY) {
            p.y = groundY;
            const e = p.bounceE ?? 0.12;
            const mu = p.friction ?? 0.85;
            const contactDamping = p.contactDamping ?? 0.6;

            // sehr inelastischer Bounce und starke Reibung
            p.vy = -e * p.vy;
            p.vx = (1 - mu) * p.vx;

            p.vx *= contactDamping;
            p.vy *= contactDamping;

            // große Brocken: beim ersten Kontakt leichtes "Kippen"
            if (p.type === 'stoneChunk' && !p.touchedGround) {
              p.touchedGround = true;
              const dir = p.vx >= 0 ? 1 : -1;
              const impulse = 0.4 + Math.random() * 0.3;
              p.angVel = (p.angVel ?? 0) + dir * impulse;
            }
          }

          const speed = Math.hypot(p.vx, p.vy);
          const sleepThreshold = p.sleepThreshold ?? 1.0;
          if (speed < sleepThreshold && p.y >= (this.groundY ?? 20) - 0.001) {
            p.vx = 0;
            p.vy = 0;
            p.sleep = true;
          }
        }

        // Rotation / „Balancieren“ für große Brocken
        if (p.type === 'stoneChunk' && (p.angVel ?? 0) !== 0) {
          p.angle = (p.angle ?? 0) + p.angVel * t;
          const damping = p.angularDamping ?? 0.82;
          p.angVel *= damping;
          if (Math.abs(p.angVel) < 0.02) {
            p.angVel = 0;
          }
        }
      } else if (p.type === 'woodFine' || p.type === 'woodChunk') {
        const dtSec = t;
        const g = p.ay ?? 16;
        if (!p.sleep) {
          // Gravitation
          p.vy += g * dtSec;

          // Quadratischer Luftwiderstand
          let vx = p.vx;
          let vy = p.vy;
          let speed = Math.hypot(vx, vy);
          if (speed > 0.0001) {
            const dragK = p.dragK ?? (p.type === 'woodFine' ? 4.0 : 2.0);
            let dragAcc = dragK * speed;
            const maxAcc = speed / dtSec;
            if (dragAcc > maxAcc) dragAcc = maxAcc;
            const axDrag = (vx / speed) * dragAcc;
            const ayDrag = (vy / speed) * dragAcc;
            p.vx -= axDrag * dtSec;
            p.vy -= ayDrag * dtSec;
          }

          // Leichter "Flutter"-Effekt für feine Späne
          if (p.type === 'woodFine') {
            const strength = p.flutterStrength ?? 6;
            const speedPhase = p.flutterSpeed ?? 12;
            p.flutterPhase = (p.flutterPhase ?? 0) + speedPhase * dtSec;
            const flutterX = Math.sin(p.flutterPhase) * strength * dtSec;
            const flutterY = -Math.cos(p.flutterPhase) * (strength * 0.15) * dtSec;
            p.vx += flutterX;
            p.vy += flutterY;
          }

          p.x += p.vx * dtSec;
          p.y += p.vy * dtSec;

          const ground = this.groundY ?? 20;
          if (p.y >= ground) {
            p.y = ground;
            const e = p.bounceE ?? 0.12;
            const mu = p.friction ?? 0.7;
            const contactDamping = p.contactDamping ?? 0.5;

            // Weicher, stark gedämpfter Bounce
            p.vy = -e * p.vy;
            p.vx = (1 - mu) * p.vx;

            p.vx *= contactDamping;
            p.vy *= contactDamping;

            // Rotation beim Kontakt stark dämpfen
            if (p.angVel != null) {
              const ad = p.angularDampingOnContact ?? 0.3;
              p.angVel *= ad;
            }
          }

          const speedNow = Math.hypot(p.vx, p.vy);
          const sleepV = p.sleepThreshold ?? (p.type === 'woodFine' ? 0.8 : 0.9);
          const sleepW = p.sleepAngularThreshold ?? 0.8;
          const angVelAbs = Math.abs(p.angVel ?? 0);

          if (speedNow < sleepV && angVelAbs < sleepW && p.y >= (this.groundY ?? 20) - 0.001) {
            p.vx = 0;
            p.vy = 0;
            p.angVel = 0;
            p.sleep = true;
          }
        }

        // Rotation weiterführen und dämpfen
        if (p.angVel != null && p.angVel !== 0) {
          p.angle = (p.angle ?? 0) + p.angVel * dtSec;
          const damping = p.angularDamping ?? 0.88;
          p.angVel *= damping;
          if (Math.abs(p.angVel) < 0.05) {
            p.angVel = 0;
          }
        }
      } else if (p.type === 'glassChip' || p.type === 'glassChunk') {
        const dtSec = t;
        if (!p.sleep) {
          const g = p.ay ?? 18;
          p.vy += g * dtSec;

          // Moderater quadratischer Drag
          let vx = p.vx;
          let vy = p.vy;
          let speed = Math.hypot(vx, vy);
          if (speed > 0.0001) {
            const dragK = p.dragK ?? (p.type === 'glassChip' ? 3.2 : 2.4);
            let dragAcc = dragK * speed;
            const maxAcc = speed / dtSec;
            if (dragAcc > maxAcc) dragAcc = maxAcc;
            const axDrag = (vx / speed) * dragAcc;
            const ayDrag = (vy / speed) * dragAcc;
            p.vx -= axDrag * dtSec;
            p.vy -= ayDrag * dtSec;
          }

          p.x += p.vx * dtSec;
          p.y += p.vy * dtSec;

          const ground = this.groundY ?? 20;
          if (p.y >= ground) {
            p.y = ground;
            const e = p.bounceE ?? (p.type === 'glassChip' ? 0.38 : 0.32);
            const mu = p.friction ?? 0.28;
            const contactDamping = p.contactDamping ?? 0.72;

            p.vy = -e * p.vy;
            p.vx = (1 - mu) * p.vx;

            p.vx *= contactDamping;
            p.vy *= contactDamping;
          }

          const speedNow = Math.hypot(p.vx, p.vy);
          const sleepV = p.sleepThreshold ?? 1.2;
          const sleepW = p.sleepAngularThreshold ?? 0.9;
          const angVelAbs = Math.abs(p.angVel ?? 0);

          if (speedNow < sleepV && angVelAbs < sleepW && p.y >= (this.groundY ?? 20) - 0.001) {
            p.vx = 0;
            p.vy = 0;
            p.angVel = 0;
            p.sleep = true;
          }
        }

        // Rotation und langsame Dämpfung, damit Scherben sichtbar drehen
        if (p.angVel != null && p.angVel !== 0) {
          p.angle = (p.angle ?? 0) + p.angVel * dt;
          const damping = p.angularDamping ?? 0.9;
          p.angVel *= damping;
          if (Math.abs(p.angVel) < 0.03) {
            p.angVel = 0;
          }
        }
      } else if (p.type === 'grassBlade' || p.type === 'dirtChunk') {
        const dtSec = t;
        const g = p.ay ?? 17;
        if (!p.sleep) {
          // Gravitation
          p.vy += g * dtSec;

          // Luftwiderstand abhängig vom Typ
          let vx = p.vx;
          let vy = p.vy;
          let speed = Math.hypot(vx, vy);
          if (speed > 0.0001) {
            const dragK =
              p.dragK ??
              (p.type === 'grassBlade'
                ? 4.6 // Gras: sehr hoher Drag, windanfällig
                : 2.2); // Erde: moderater Drag
            let dragAcc = dragK * speed;
            const maxAcc = speed / dtSec;
            if (dragAcc > maxAcc) dragAcc = maxAcc;
            const axDrag = (vx / speed) * dragAcc;
            const ayDrag = (vy / speed) * dragAcc;
            p.vx -= axDrag * dtSec;
            p.vy -= ayDrag * dtSec;
          }

          // Wind / Noise vor allem für Gras
          if (p.type === 'grassBlade') {
            const windStrength = p.windStrength ?? 10;
            const windSpeed = p.windSpeed ?? 6;
            p.windPhase = (p.windPhase ?? 0) + windSpeed * dtSec;
            const wx = Math.sin(p.windPhase) * windStrength * dtSec;
            const wy = -Math.cos(p.windPhase) * (windStrength * 0.2) * dtSec;
            p.vx += wx;
            p.vy += wy;
          }

          p.x += p.vx * dtSec;
          p.y += p.vy * dtSec;

          const ground = this.groundY ?? 20;
          if (p.y >= ground) {
            p.y = ground;
            const e = p.bounceE ?? (p.type === 'dirtChunk' ? 0.18 : 0.04);
            const mu = p.friction ?? 0.8;
            const contactDamping = p.contactDamping ?? 0.6;

            // Erde: kleiner Bounce, Gras: fast kein Bounce
            p.vy = -e * p.vy;
            p.vx = (1 - mu) * p.vx;

            p.vx *= contactDamping;
            p.vy *= contactDamping;

            // Rotation stark dämpfen beim Kontakt
            if (p.angVel != null) {
              const ad = p.angularDampingOnContact ?? 0.35;
              p.angVel *= ad;
            }
          }

          const speedNow = Math.hypot(p.vx, p.vy);
          const sleepV = p.sleepThreshold ?? (p.type === 'grassBlade' ? 0.7 : 0.9);
          const sleepW = p.sleepAngularThreshold ?? 0.8;
          const angVelAbs = Math.abs(p.angVel ?? 0);

          if (speedNow < sleepV && angVelAbs < sleepW && p.y >= (this.groundY ?? 20) - 0.001) {
            p.vx = 0;
            p.vy = 0;
            p.angVel = 0;
            p.sleep = true;
          }
        }

        // Rotation weiterführen und dämpfen
        if (p.angVel != null && p.angVel !== 0) {
          p.angle = (p.angle ?? 0) + p.angVel * dt;
          const damping = p.angularDamping ?? 0.9;
          p.angVel *= damping;
          if (Math.abs(p.angVel) < 0.04) {
            p.angVel = 0;
          }
        }
      } else if (p.type === 'slimeDrop' || p.type === 'slimeTiny') {
        const dtSec = t;
        const g = p.ay ?? 18;
        if (!p.sleep) {
          // Gravitation
          p.vy += g * dtSec;

          // Quadratischer Luftwiderstand
          let vx = p.vx;
          let vy = p.vy;
          let speed = Math.hypot(vx, vy);
          if (speed > 0.0001) {
            const dragK = p.dragK ?? 2.6;
            let dragAcc = dragK * speed;
            const maxAcc = speed / dtSec;
            if (dragAcc > maxAcc) dragAcc = maxAcc;
            const axDrag = (vx / speed) * dragAcc;
            const ayDrag = (vy / speed) * dragAcc;
            p.vx -= axDrag * dtSec;
            p.vy -= ayDrag * dtSec;
          }

          // Viskositäts-Dämpfung (zäher Schleim)
          const visc = p.viscosity ?? 4.0;
          const viscFactor = Math.max(0, 1 - visc * dtSec);
          p.vx *= viscFactor;
          p.vy *= viscFactor;

          p.x += p.vx * dtSec;
          p.y += p.vy * dtSec;

          const ground = this.groundY ?? 20;
          if (p.y >= ground) {
            p.y = ground;
            const e = p.bounceE ?? 0.05;
            const mu = p.friction ?? 0.85;
            const contactDamping = p.contactDamping ?? 0.5;

            // Sehr geringer Bounce, stark gedämpft
            p.vy = -e * p.vy;
            p.vx = (1 - mu) * p.vx;
            p.vx *= contactDamping;
            p.vy *= contactDamping;

            if (!p.squashed) {
              // Erster Aufprall → „Plattdrücken“
              p.squashed = true;
              p.squashTimer = 0;
              p.stretchX = (p.stretchX ?? 1) * 1.6;
              p.stretchY = (p.stretchY ?? 1) * 0.6;
            }
          }

          if (p.squashed) {
            p.squashTimer += dt;
            const dur = p.squashDuration ?? 220;
            const k = Math.min(1, p.squashTimer / dur);
            // langsam zum Ruhezustand zurück interpolieren
            p.stretchX = lerp(p.stretchX ?? 1.2, 1, k);
            p.stretchY = lerp(p.stretchY ?? 0.7, 1, k);
          }
        }

        const speedNow = Math.hypot(p.vx, p.vy);
        const sleepV = p.sleepThreshold ?? 0.6;
        if (speedNow < sleepV && p.y >= (this.groundY ?? 20) - 0.001) {
          p.vx = 0;
          p.vy = 0;
          p.sleep = true;
        }
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
        case 'grass':
          // Zerstörung: 50 % mehr Volumen + brauner Staub
          this._spawnGrassDirt(x, y, { intensity: 1.5, smokeIntensity: 1.0 });
          break;
        case 'slime':
          this._spawnSlimeSplats(x, y);
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
    const chipCount = 28;
    const shardCount = 6;

    // Viele kleine Splitter
    for (let i = 0; i < chipCount; i++) {
      // volle 360°-Streuung, damit links/rechts gleichverteilt sind
      const angle = Math.random() * Math.PI * 2;
      const speed = 7 + Math.random() * 9;
      this.particles.push({
        type: 'glassChip',
        x: x + (Math.random() - 0.5) * 0.5,
        y: y + (Math.random() - 0.5) * 0.3,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        ay: 18,
        dragK: 3.2,
        bounceE: 0.4,
        friction: 0.25,
        contactDamping: 0.8,
        sleepThreshold: 1.4,
        sleepAngularThreshold: 1.2,
        life: 280 + Math.random() * 720,
        age: 0,
        sizePx: 2 + Math.floor(Math.random() * 2),
        angle: Math.random() * Math.PI * 2,
        angVel: (Math.random() - 0.5) * 14,
        angularDamping: 0.9,
        startColor: {
          r: 190 + Math.random() * 40,
          g: 230 + Math.random() * 25,
          b: 255,
        },
        endColor: {
          r: 150 + Math.random() * 25,
          g: 210 + Math.random() * 25,
          b: 245,
        },
      });
    }

    // Größere Scherben
    for (let i = 0; i < shardCount; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 4 + Math.random() * 5;
      const size = 4 + Math.floor(Math.random() * 3);
      this.particles.push({
        type: 'glassChunk',
        x: x + (Math.random() - 0.5) * 0.4,
        y: y + (Math.random() - 0.5) * 0.25,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        ay: 18,
        dragK: 2.4,
        bounceE: 0.32,
        friction: 0.32,
        contactDamping: 0.78,
        sleepThreshold: 1.2,
        sleepAngularThreshold: 0.9,
        life: 520 + Math.random() * 1280,
        age: 0,
        sizePx: size,
        angle: Math.random() * Math.PI * 2,
        angVel: (Math.random() - 0.5) * 8,
        angularDamping: 0.92,
        startColor: {
          r: 185 + Math.random() * 25,
          g: 225 + Math.random() * 20,
          b: 255,
        },
        endColor: {
          r: 150 + Math.random() * 20,
          g: 205 + Math.random() * 20,
          b: 245,
        },
      });
    }
  }

  _spawnGrassDirt(x, y, options = {}) {
    // Gemischter Auswurf: überwiegend Gras, etwas Erde
    const intensity = options.intensity ?? 1;
    const smokeIntensity = options.smokeIntensity ?? 0;
    const baseTotal = 26;
    const total = Math.max(1, Math.round(baseTotal * intensity));
    const grassCount = Math.round(total * 0.7);
    const dirtCount = total - grassCount;

    // Gras-Halme
    for (let i = 0; i < grassCount; i++) {
      const bandR = Math.random();
      let baseAngle;
      if (bandR < 1 / 3) baseAngle = (-3 * Math.PI) / 4;
      else if (bandR < 2 / 3) baseAngle = -Math.PI / 2;
      else baseAngle = -Math.PI / 4;
      const spread = Math.PI / 8;
      const ang = baseAngle + (Math.random() - 0.5) * spread;
      const speed = 2.2 + Math.random() * 2.4;
      const size = 2 + Math.floor(Math.random() * 2);

      this.particles.push({
        type: 'grassBlade',
        x: x + (Math.random() - 0.5) * 0.6,
        y: y + (Math.random() - 0.5) * 0.3,
        vx: Math.cos(ang) * speed,
        vy: Math.sin(ang) * speed,
        ay: 17,
        dragK: 4.8,
        bounceE: 0.04,
        friction: 0.85,
        contactDamping: 0.7,
        sleepThreshold: 0.7,
        sleepAngularThreshold: 0.8,
        life: 220 + Math.random() * 380,
        age: 0,
        sizePx: size,
        angle: (Math.random() - 0.5) * 0.9,
        angVel: (Math.random() - 0.5) * 7,
        angularDamping: 0.9,
        angularDampingOnContact: 0.35,
        windStrength: 9,
        windSpeed: 9,
        startColor: {
          r: 90 + Math.random() * 20,
          g: 150 + Math.random() * 40,
          b: 70 + Math.random() * 25,
        },
        endColor: {
          r: 70 + Math.random() * 15,
          g: 120 + Math.random() * 30,
          b: 60 + Math.random() * 20,
        },
      });
    }

    // Erdkrümel
    for (let i = 0; i < dirtCount; i++) {
      const bandR = Math.random();
      let baseAngle;
      if (bandR < 0.5) baseAngle = (-3 * Math.PI) / 4;
      else baseAngle = -Math.PI / 4;
      const spread = Math.PI / 12;
      const ang = baseAngle + (Math.random() - 0.5) * spread;
      const speed = 2.6 + Math.random() * 2.6;
      const size = 2 + Math.floor(Math.random() * 2);

      this.particles.push({
        type: 'dirtChunk',
        x: x + (Math.random() - 0.5) * 0.5,
        y: y + (Math.random() - 0.5) * 0.25,
        vx: Math.cos(ang) * speed,
        vy: Math.sin(ang) * speed,
        ay: 18,
        dragK: 2.3,
        bounceE: 0.2,
        friction: 0.88,
        contactDamping: 0.65,
        sleepThreshold: 0.9,
        sleepAngularThreshold: 1.0,
        life: 360 + Math.random() * 520,
        age: 0,
        sizePx: size,
        angle: 0,
        angVel: (Math.random() - 0.5) * 4,
        angularDamping: 0.9,
        angularDampingOnContact: 0.5,
        startColor: {
          r: 90 + Math.random() * 25,
          g: 70 + Math.random() * 20,
          b: 45 + Math.random() * 20,
        },
        endColor: {
          r: 70 + Math.random() * 20,
          g: 55 + Math.random() * 15,
          b: 35 + Math.random() * 15,
        },
      });
    }

    // Brauner Staub / Rauch (nur für starke Zerstörung sinnvoll)
    if (smokeIntensity > 0) {
      const baseSmoke = 10;
      const smokeCount = Math.round(baseSmoke * smokeIntensity);
      for (let i = 0; i < smokeCount; i++) {
        const speed = 0.6 + Math.random() * 1.0;
        const ang = (-Math.PI / 2) + (Math.random() - 0.5) * (Math.PI / 4);
        this.particles.push({
          type: 'smoke',
          x: x + (Math.random() - 0.5) * 0.6,
          y: y + 0.1 + (Math.random() - 0.5) * 0.3,
          vx: Math.cos(ang) * speed * 0.8,
          vy: Math.sin(ang) * speed * 0.6,
          ax: 0,
          ay: -1.8,
          drag: 1.3,
          life: 360 + Math.random() * 320,
          age: 0,
          sizePx: 1,
          radiusCell: 0.35 + Math.random() * 0.25,
          startColor: { r: 120, g: 90, b: 60 },
          endColor: { r: 80, g: 60, b: 40 },
        });
      }
    }
  }

  /**
   * Gras-Impact-Emitter: Gras-/Erd-Splitter bei Aufprall eines Grasblocks.
   * Nutzt dieselben Partikeltypen wie grassBreak, aber ohne zusätzlichen Rauch
   * und mit normaler Intensität.
   */
  spawnGrassImpactDebris(x, y, matA, matB) {
    if (!matA || !matB) return;
    if (matA !== 'grass' && matB !== 'grass') return;
    this._spawnGrassDirt(x, y, { intensity: 1.0, smokeIntensity: 0 });
  }

  _spawnWoodSplinters(x, y) {
    const fineCount = 26;
    const chunkCount = 5;

    // Feine Späne / Splitter – symmetrisch links / oben / rechts
    for (let i = 0; i < fineCount; i++) {
      const bandR = Math.random();
      let baseAngle;
      if (bandR < 1 / 3) baseAngle = (-3 * Math.PI) / 4; // links-oben
      else if (bandR < 2 / 3) baseAngle = -Math.PI / 2; // gerade nach oben
      else baseAngle = -Math.PI / 4; // rechts-oben
      const spread = Math.PI / 10;
      const ang = baseAngle + (Math.random() - 0.5) * spread;
      const speed = 3.5 + Math.random() * 3.5;
      const size = 3 + Math.floor(Math.random() * 2);
      this.particles.push({
        type: 'woodFine',
        x: x + (Math.random() - 0.5) * 0.5,
        y: y + (Math.random() - 0.5) * 0.3,
        vx: Math.cos(ang) * speed,
        vy: Math.sin(ang) * speed,
        ay: 16,
        dragK: 4.0,
        bounceE: 0.12,
        friction: 0.7,
        contactDamping: 0.55,
        sleepThreshold: 0.9,
        sleepAngularThreshold: 1.0,
        life: 240 + Math.random() * 520,
        age: 0,
        sizePx: size,
        angle: ang,
        angVel: (Math.random() - 0.5) * 10,
        angularDamping: 0.88,
        angularDampingOnContact: 0.35,
        flutterStrength: 6,
        flutterSpeed: 12,
        startColor: {
          r: 175 + Math.random() * 35,
          g: 130 + Math.random() * 25,
          b: 80 + Math.random() * 20,
        },
        endColor: {
          r: 125 + Math.random() * 20,
          g: 95 + Math.random() * 20,
          b: 65 + Math.random() * 15,
        },
      });
    }

    // Größere Holzstücke
    for (let i = 0; i < chunkCount; i++) {
      const side = Math.random() < 0.5 ? -1 : 1;
      const speedX = (0.6 + Math.random() * 0.8) * side;
      const speedY = 1.6 + Math.random() * 1.6;
      const size = 5 + Math.floor(Math.random() * 3);
      this.particles.push({
        type: 'woodChunk',
        x: x + (Math.random() - 0.5) * 0.4,
        y: y + (Math.random() - 0.5) * 0.25,
        vx: speedX,
        vy: speedY,
        ay: 16,
        dragK: 2.0,
        bounceE: 0.09,
        friction: 0.75,
        contactDamping: 0.5,
        sleepThreshold: 0.9,
        sleepAngularThreshold: 0.8,
        life: 600 + Math.random() * 1200,
        age: 0,
        sizePx: size,
        angle: (Math.random() - 0.5) * 0.6,
        angVel: (Math.random() - 0.5) * 5,
        angularDamping: 0.9,
        angularDampingOnContact: 0.4,
        startColor: {
          r: 170 + Math.random() * 25,
          g: 130 + Math.random() * 20,
          b: 82 + Math.random() * 20,
        },
        endColor: {
          r: 120 + Math.random() * 15,
          g: 95 + Math.random() * 15,
          b: 70 + Math.random() * 15,
        },
      });
    }
  }

  _spawnStoneDebris(x, y) {
    // StoneDebrisEmitter: viele kleine Splitter + größere Brocken.
    // Intensität/Menge und Lebensdauer sind hier bewusst hoch,
    // damit das Zerbrechen eines Steinblocks wie ein voller Geröllkollaps wirkt.
    const chipCount = 36; // doppelte Menge
    const chunkCount = 6; // doppelte Menge

    // Kleine Splitter
    for (let i = 0; i < chipCount; i++) {
      // Bänder für links / Mitte / rechts im oberen Halbraum
      const bandR = Math.random();
      let baseAngle;
      if (bandR < 1 / 3) baseAngle = (-3 * Math.PI) / 4; // links-oben
      else if (bandR < 2 / 3) baseAngle = -Math.PI / 2; // gerade nach oben
      else baseAngle = -Math.PI / 4; // rechts-oben
      const spread = Math.PI / 8;
      const angle = baseAngle + (Math.random() - 0.5) * spread;
      const speed = 3.5 + Math.random() * 4.5;
      this.particles.push({
        type: 'stoneChip',
        x: x + (Math.random() - 0.5) * 0.5,
        y: y + (Math.random() - 0.5) * 0.3,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        ay: 18,
        dragLin: 4.0,
        bounceE: 0.18,
        friction: 0.8,
        contactDamping: 0.6,
        sleepThreshold: 1.2,
        life: 520 + Math.random() * 1440, // doppelte Haltbarkeit
        age: 0,
        sizePx: 3 + Math.floor(Math.random() * 2),
        startColor: {
          r: 150 + Math.random() * 25,
          g: 155 + Math.random() * 25,
          b: 165 + Math.random() * 25,
        },
        endColor: {
          r: 95 + Math.random() * 20,
          g: 100 + Math.random() * 20,
          b: 110 + Math.random() * 20,
        },
      });
    }

    // Große Brocken
    for (let i = 0; i < chunkCount; i++) {
      const side = Math.random() < 0.5 ? -1 : 1;
      const speedX = (0.35 + Math.random() * 0.55) * side;
      const speedY = 1.2 + Math.random() * 1.4;
      const size = 6 + Math.floor(Math.random() * 3);
      this.particles.push({
        type: 'stoneChunk',
        x: x + (Math.random() - 0.5) * 0.4,
        y: y + (Math.random() - 0.5) * 0.2,
        vx: speedX,
        vy: speedY,
        ay: 18,
        dragLin: 1.5,
        bounceE: 0.08,
        friction: 0.9,
        contactDamping: 0.5,
        sleepThreshold: 0.8,
        life: 1800 + Math.random() * 2800, // doppelte Haltbarkeit
        age: 0,
        sizePx: size,
        angle: (Math.random() - 0.5) * 0.6,
        angVel: 0,
        angularDamping: 0.82,
        startColor: {
          r: 145 + Math.random() * 20,
          g: 150 + Math.random() * 20,
          b: 160 + Math.random() * 20,
        },
        endColor: {
          r: 95 + Math.random() * 15,
          g: 100 + Math.random() * 15,
          b: 105 + Math.random() * 15,
        },
      });
    }
  }

  /**
   * Stein-Impact-Emitter: kleine Bruchstücke + Staub bei Zusammenstößen.
   *
   * - stone + stone → sehr viele Bruchstücke, viel Staub
   * - stone + metal → mittlere Menge, etwa 1/2 von stone+stone
   * - stone + glass → wenige Bruchstücke & Staub
   * - stone + wood  → sehr wenige Bruchstücke, kein Staub
   */
  spawnStoneImpactDebris(x, y, matA, matB) {
    if (!matA || !matB) return;
    if (matA !== 'stone' && matB !== 'stone') return;

    const other = matA === 'stone' ? matB : matA;
    let chipFactor = 0;
    let smokeFactor = 0;

    switch (other) {
      case 'stone':
        chipFactor = 1.0;
        smokeFactor = 1.0;
        break;
      case 'metal':
        chipFactor = 0.5;
        smokeFactor = 0.5;
        break;
      case 'glass':
        chipFactor = 0.3;
        smokeFactor = 0.3;
        break;
      case 'wood':
        chipFactor = 0.15;
        smokeFactor = 0;
        break;
      default:
        return;
    }

    this._spawnStoneImpact(x, y, chipFactor, smokeFactor);
  }

  /**
   * Glas-Impact-Emitter: Splitter/Scherben bei Zusammenstößen.
   *
   * - glass + stone → viele Splitter, mittlere Scherbenmenge, eher seitlich
   * - glass + metal → viele Splitter, mittlere Scherbenmenge, leicht nach oben
   * - glass + glass → mittlere Splitter/Scherben
   * - glass + wood  → weniger Splitter/Scherben, eher seitlich
   *
   * Kein Rauch – nur Glas-Splitter.
   */
  spawnGlassImpactDebris(x, y, matA, matB) {
    if (!matA || !matB) return;
    if (matA !== 'glass' && matB !== 'glass') return;

    const other = matA === 'glass' ? matB : matA;
    let chipFactor = 0;
    let chunkFactor = 0;
    let upwardBias = 0.3; // 0 = stark seitlich, 1 = stark nach oben

    switch (other) {
      case 'stone':
        chipFactor = 1.0;
        chunkFactor = 0.5;
        upwardBias = 0.25;
        break;
      case 'metal':
        chipFactor = 0.9;
        chunkFactor = 0.5;
        upwardBias = 0.45;
        break;
      case 'glass':
        chipFactor = 0.7;
        chunkFactor = 0.4;
        upwardBias = 0.35;
        break;
      case 'wood':
        chipFactor = 0.45;
        chunkFactor = 0.25;
        upwardBias = 0.25;
        break;
      default:
        return;
    }

    this._spawnGlassImpact(x, y, chipFactor, chunkFactor, upwardBias);
  }

  /**
   * Holz-Impact-Emitter: feine, längliche Späne + dezente Rauchfahne.
   *
   * - wood + stone → viele Splitter, viel Rauch, eher seitlich
   * - wood + metal → viele Splitter, mittlerer Rauch, leicht nach oben
   * - wood + glass → wenige Splitter & wenig Rauch
   * - wood + wood  → viele Splitter, etwas Rauch, eher seitlich
   */
  spawnWoodImpactDebris(x, y, matA, matB) {
    if (!matA || !matB) return;
    if (matA !== 'wood' && matB !== 'wood') return;

    const other = matA === 'wood' ? matB : matA;
    let chipFactor = 0;
    let smokeFactor = 0;
    let upwardBias = 0; // 0 = seitlich, 1 = eher nach oben

    switch (other) {
      case 'stone':
        chipFactor = 1.0;
        smokeFactor = 1.0;
        upwardBias = 0.3;
        break;
      case 'metal':
        chipFactor = 1.0;
        smokeFactor = 0.7;
        upwardBias = 0.7;
        break;
      case 'glass':
        chipFactor = 0.35;
        smokeFactor = 0.35;
        upwardBias = 0.5;
        break;
      case 'wood':
        chipFactor = 0.9;
        smokeFactor = 0.5;
        upwardBias = 0.2;
        break;
      default:
        return;
    }

    this._spawnWoodImpact(x, y, chipFactor, smokeFactor, upwardBias);
  }

  _spawnWoodImpact(x, y, chipFactor, smokeFactor, upwardBias) {
    const baseChips = 18;
    const baseSmoke = 8;
    const chipCount = Math.round(baseChips * chipFactor);
    const smokeCount = Math.round(baseSmoke * smokeFactor);

    // Feine, längliche Späne
    for (let i = 0; i < chipCount; i++) {
      const bandR = Math.random();
      let baseAngle;
      if (bandR < 0.5) {
        // seitlich links/rechts
        baseAngle = bandR < 0.25 ? Math.PI : 0;
      } else {
        baseAngle = -Math.PI / 2;
      }
      const spread = Math.PI / 10;
      let ang = baseAngle + (Math.random() - 0.5) * spread;
      // Bias nach oben abhängig vom Ziel (andere Materialien)
      ang = lerp(ang, -Math.PI / 2, upwardBias * 0.5);
      const speed = 2.8 + Math.random() * 3.2;
      const size = 3 + Math.floor(Math.random() * 2);
      this.particles.push({
        type: 'woodFine',
        x: x + (Math.random() - 0.5) * 0.4,
        y: y + (Math.random() - 0.3) * 0.3,
        vx: Math.cos(ang) * speed,
        vy: Math.sin(ang) * speed,
        ay: 16,
        dragK: 4.0,
        bounceE: 0.08,
        friction: 0.7,
        contactDamping: 0.6,
        sleepThreshold: 0.8,
        sleepAngularThreshold: 1.0,
        life: 180 + Math.random() * 420,
        age: 0,
        sizePx: size,
        angle: ang,
        angVel: (Math.random() - 0.5) * 9,
        angularDamping: 0.88,
        angularDampingOnContact: 0.35,
        flutterStrength: 5,
        flutterSpeed: 11,
        startColor: {
          r: 175 + Math.random() * 35,
          g: 130 + Math.random() * 25,
          b: 80 + Math.random() * 20,
        },
        endColor: {
          r: 125 + Math.random() * 20,
          g: 95 + Math.random() * 20,
          b: 65 + Math.random() * 15,
        },
      });
    }

    // Rauchwolke in Holzfarbe
    for (let i = 0; i < smokeCount; i++) {
      const speed = 0.6 + Math.random() * 1.2;
      const angBase = upwardBias > 0.5 ? -Math.PI / 2 : (Math.random() - 0.5) * (Math.PI / 3);
      const ang = angBase + (Math.random() - 0.5) * 0.4;
      this.particles.push({
        type: 'smoke',
        x: x + (Math.random() - 0.5) * 0.5,
        y: y + 0.1 + (Math.random() - 0.5) * 0.2,
        vx: Math.cos(ang) * speed,
        vy: Math.sin(ang) * speed * 0.6,
        ax: 0,
        ay: -2.0,
        drag: 1.4,
        life: 320 + Math.random() * 300,
        age: 0,
        sizePx: 1,
        radiusCell: 0.35 + Math.random() * 0.25,
        startColor: { r: 150, g: 120, b: 90 },
        endColor: { r: 90, g: 75, b: 65 },
      });
    }
  }

  _spawnStoneImpact(x, y, chipFactor, smokeFactor) {
    const baseChips = 14;
    const baseSmoke = 9;
    const chipCount = Math.round(baseChips * chipFactor);
    const smokeCount = Math.round(baseSmoke * smokeFactor);

    // kleine Bruchstücke
    for (let i = 0; i < chipCount; i++) {
      const bandR = Math.random();
      let baseAngle;
      if (bandR < 1 / 3) baseAngle = (-3 * Math.PI) / 4;
      else if (bandR < 2 / 3) baseAngle = -Math.PI / 2;
      else baseAngle = -Math.PI / 4;
      const spread = Math.PI / 10;
      const angle = baseAngle + (Math.random() - 0.5) * spread;
      const speed = 2.5 + Math.random() * 3;
      this.particles.push({
        type: 'stoneChip',
        x: x + (Math.random() - 0.5) * 0.4,
        y: y + (Math.random() - 0.2) * 0.3,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        ay: 18,
        dragLin: 3.5,
        bounceE: 0.12,
        friction: 0.85,
        contactDamping: 0.65,
        sleepThreshold: 1.3,
        life: 180 + Math.random() * 520,
        age: 0,
        sizePx: 2 + Math.floor(Math.random() * 2),
        startColor: {
          r: 148 + Math.random() * 18,
          g: 150 + Math.random() * 18,
          b: 155 + Math.random() * 18,
        },
        endColor: {
          r: 95 + Math.random() * 15,
          g: 98 + Math.random() * 15,
          b: 102 + Math.random() * 15,
        },
      });
    }

    // dezente Staubfahne für harte Impacts (kein Staub bei Holz)
    for (let i = 0; i < smokeCount; i++) {
      const speed = 1 + Math.random() * 1.5;
      this.particles.push({
        type: 'smoke',
        x: x + (Math.random() - 0.5) * 0.5,
        y: y - 0.1 + Math.random() * 0.2,
        vx: (Math.random() - 0.5) * speed,
        vy: -Math.random() * 1.4,
        ax: 0,
        ay: -2.5,
        drag: 1.4,
        life: 420 + Math.random() * 360,
        age: 0,
        sizePx: 1,
        radiusCell: 0.35 + Math.random() * 0.35,
        startColor: { r: 135, g: 135, b: 140 },
        endColor: { r: 90, g: 90, b: 95 },
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

  _spawnGlassImpact(x, y, chipFactor, chunkFactor, upwardBias) {
    const baseChips = 18;
    const baseChunks = 4;
    const chipCount = Math.round(baseChips * chipFactor);
    const chunkCount = Math.round(baseChunks * chunkFactor);

    // Kleine, harte Splitter (fast nur Glas-Chips)
    for (let i = 0; i < chipCount; i++) {
      const bandR = Math.random();
      let baseAngle;
      // Bänder für links / rechts im oberen Halbraum, mit seltenem reinen "nach oben"
      if (bandR < 0.4) baseAngle = (-3 * Math.PI) / 4; // links-oben
      else if (bandR < 0.8) baseAngle = -Math.PI / 4; // rechts-oben
      else baseAngle = -Math.PI / 2; // direkt nach oben

      const spread = Math.PI / 10;
      let ang = baseAngle + (Math.random() - 0.5) * spread;
      // Leichter Bias Richtung oben je nach Paar
      ang = lerp(ang, -Math.PI / 2, upwardBias * 0.6);

      const speed = 4.8 + Math.random() * 4.5;
      const size = 2 + Math.floor(Math.random() * 2);

      this.particles.push({
        type: 'glassChip',
        x: x + (Math.random() - 0.5) * 0.4,
        y: y + (Math.random() - 0.5) * 0.25,
        vx: Math.cos(ang) * speed,
        vy: Math.sin(ang) * speed,
        ay: 18,
        dragK: 3.1,
        bounceE: 0.4,
        friction: 0.26,
        contactDamping: 0.8,
        sleepThreshold: 1.3,
        sleepAngularThreshold: 1.0,
        life: 260 + Math.random() * 620,
        age: 0,
        sizePx: size,
        angle: Math.random() * Math.PI * 2,
        angVel: (Math.random() - 0.5) * 14,
        angularDamping: 0.9,
        startColor: {
          r: 188 + Math.random() * 35,
          g: 228 + Math.random() * 28,
          b: 255,
        },
        endColor: {
          r: 150 + Math.random() * 25,
          g: 210 + Math.random() * 25,
          b: 245,
        },
      });
    }

    // Ein paar größere Scherben für harte Impacts
    for (let i = 0; i < chunkCount; i++) {
      const bandR = Math.random();
      let baseAngle;
      if (bandR < 0.5) baseAngle = (-3 * Math.PI) / 4;
      else baseAngle = -Math.PI / 4;
      const spread = Math.PI / 12;
      let ang = baseAngle + (Math.random() - 0.5) * spread;
      ang = lerp(ang, -Math.PI / 2, upwardBias * 0.4);

      const speed = 3.2 + Math.random() * 3.3;
      const size = 3 + Math.floor(Math.random() * 2);

      this.particles.push({
        type: 'glassChunk',
        x: x + (Math.random() - 0.5) * 0.35,
        y: y + (Math.random() - 0.5) * 0.22,
        vx: Math.cos(ang) * speed,
        vy: Math.sin(ang) * speed,
        ay: 18,
        dragK: 2.5,
        bounceE: 0.34,
        friction: 0.3,
        contactDamping: 0.78,
        sleepThreshold: 1.1,
        sleepAngularThreshold: 0.9,
        life: 420 + Math.random() * 960,
        age: 0,
        sizePx: size,
        angle: Math.random() * Math.PI * 2,
        angVel: (Math.random() - 0.5) * 9,
        angularDamping: 0.92,
        startColor: {
          r: 185 + Math.random() * 25,
          g: 225 + Math.random() * 20,
          b: 255,
        },
        endColor: {
          r: 150 + Math.random() * 20,
          g: 205 + Math.random() * 20,
          b: 245,
        },
      });
    }
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

  _spawnSlimeSplats(x, y) {
    // Deutlich sichtbarer Splash: mehrere getrennte Tropfen
    const mainCount = 8;
    const tinyCount = 20;

    // Größere Haupt-Tropfen
    for (let i = 0; i < mainCount; i++) {
      const angle = (-Math.PI / 2) + (Math.random() - 0.5) * (Math.PI / 2.2);
      const speed = 3.2 + Math.random() * 2.6;
      const radiusCell = 0.25 + Math.random() * 0.12;

      this.particles.push({
        type: 'slimeDrop',
        x: x + (Math.random() - 0.5) * 1.4,
        y: y + (Math.random() - 0.5) * 0.4,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        ay: 18,
        dragK: 2.6,
        viscosity: 4.2,
        bounceE: 0.05,
        friction: 0.9,
        contactDamping: 0.55,
        sleepThreshold: 0.6,
        life: 600 + Math.random() * 900,
        age: 0,
        sizePx: 4 + Math.floor(Math.random() * 2),
        radiusCell,
        stretchX: 1.2,
        stretchY: 0.9,
        squashDuration: 220,
        startColor: {
          r: 80 + Math.random() * 25,
          g: 210 + Math.random() * 35,
          b: 140 + Math.random() * 30,
        },
        endColor: {
          r: 60 + Math.random() * 20,
          g: 180 + Math.random() * 30,
          b: 110 + Math.random() * 25,
        },
      });
    }

    // Kleine Sekundär-Tropfen
    for (let i = 0; i < tinyCount; i++) {
      const angle = (-Math.PI / 2) + (Math.random() - 0.5) * (Math.PI / 1.3);
      const speed = 2.4 + Math.random() * 2.4;
      const radiusCell = 0.18 + Math.random() * 0.10;

      this.particles.push({
        type: 'slimeTiny',
        x: x + (Math.random() - 0.5) * 1.8,
        y: y + (Math.random() - 0.5) * 0.6,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        ay: 18,
        dragK: 2.8,
        viscosity: 4.5,
        bounceE: 0.04,
        friction: 0.9,
        contactDamping: 0.55,
        sleepThreshold: 0.7,
        life: 380 + Math.random() * 520,
        age: 0,
        sizePx: 2,
        radiusCell,
        stretchX: 1.1,
        stretchY: 0.95,
        squashDuration: 160,
        startColor: {
          r: 85 + Math.random() * 20,
          g: 215 + Math.random() * 30,
          b: 145 + Math.random() * 25,
        },
        endColor: {
          r: 65 + Math.random() * 20,
          g: 185 + Math.random() * 25,
          b: 120 + Math.random() * 20,
        },
      });
    }
  }

  spawnSlimeImpactForMoves(moves) {
    if (!moves || !moves.length) return;
    for (const m of moves) {
      this._spawnSlimeSplats(m.x, m.toY);
    }
  }
}

