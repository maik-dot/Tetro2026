import { SCORE_TABLE, BOARD_WIDTH, BOARD_HEIGHT } from '../config/gameConfig.js';

const MAX_FLYOUTS = 12;
const MAX_SCORE_PARTICLES = 80;
const FLYOUT_DURATION_MS = 800;
const PARTICLE_DURATION_MS = 250;

// Style-Konstanten – können bei Bedarf feinjustiert werden
const SCORE_OUTLINE_WIDTH = 4;
const SCORE_BOX_HEIGHT = 28;
const SCORE_PADDING_X = 14;
const SCORE_GLOW_RADIUS = 34;
const SCORE_GLOW_MAX_ALPHA = 0.55;

const BANNER_OUTLINE_WIDTH = 4;
const BANNER_HEIGHT = 52;

// Easing-Funktionen
function clamp01(v) {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function easeOutQuad(t) {
  return 1 - (1 - t) * (1 - t);
}

function easeInQuad(t) {
  return t * t;
}

function easeOutBack(t, overshoot = 1.70158) {
  const s = overshoot;
  t -= 1;
  return t * t * ((s + 1) * t + s) + 1;
}

function randRange(min, max) {
  return min + Math.random() * (max - min);
}

// Hilfsfunktionen für Zeichnung
function roundRectPath(ctx, x, y, w, h, r) {
  const radius = Math.min(r, w / 2, h / 2);
  const x0 = x;
  const y0 = y;
  const x1 = x + w;
  const y1 = y + h;
  ctx.beginPath();
  ctx.moveTo(x0 + radius, y0);
  ctx.lineTo(x1 - radius, y0);
  ctx.quadraticCurveTo(x1, y0, x1, y0 + radius);
  ctx.lineTo(x1, y1 - radius);
  ctx.quadraticCurveTo(x1, y1, x1 - radius, y1);
  ctx.lineTo(x0 + radius, y1);
  ctx.quadraticCurveTo(x0, y1, x0, y1 - radius);
  ctx.lineTo(x0, y0 + radius);
  ctx.quadraticCurveTo(x0, y0, x0 + radius, y0);
  ctx.closePath();
}

function drawGlowRadial(ctx, x, y, radius, innerColor, outerColor, alpha) {
  if (alpha <= 0) return;
  const g = ctx.createRadialGradient(x, y, 0, x, y, radius);
  g.addColorStop(0, `rgba(${innerColor.r},${innerColor.g},${innerColor.b},${alpha})`);
  g.addColorStop(1, `rgba(${outerColor.r},${outerColor.g},${outerColor.b},0)`);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fill();
}

function drawStar(ctx, x, y, rOuter, rInner, points, rotation) {
  const step = (Math.PI * 2) / points;
  ctx.beginPath();
  for (let i = 0; i <= points; i++) {
    const ang = rotation + i * step;
    const rx = x + Math.cos(ang) * rOuter;
    const ry = y + Math.sin(ang) * rOuter;
    const ix = x + Math.cos(ang + step / 2) * rInner;
    const iy = y + Math.sin(ang + step / 2) * rInner;
    if (i === 0) {
      ctx.moveTo(rx, ry);
    } else {
      ctx.lineTo(rx, ry);
    }
    ctx.lineTo(ix, iy);
  }
  ctx.closePath();
}

export class FloatingFxManager {
  constructor() {
    this.scoreFlyouts = new Array(MAX_FLYOUTS);
    for (let i = 0; i < MAX_FLYOUTS; i++) {
      this.scoreFlyouts[i] = {
        active: false,
        x: 0,
        y: 0,
        startX: 0,
        startY: 0,
        endX: 0,
        endY: 0,
        rot: 0,
        baseScale: 1,
        ageMs: 0,
        durationMs: FLYOUT_DURATION_MS,
        alpha: 0,
        text: '',
      };
    }

    this.scoreParticles = new Array(MAX_SCORE_PARTICLES);
    for (let i = 0; i < MAX_SCORE_PARTICLES; i++) {
      this.scoreParticles[i] = {
        active: false,
        x: 0,
        y: 0,
        vx: 0,
        vy: 0,
        ageMs: 0,
        durationMs: PARTICLE_DURATION_MS,
      };
    }

    this.levelBanner = {
      active: false,
      ageMs: 0,
      durationMs: 1500,
      level: 1,
      subtitle: '',
    };
    this.bannerQueue = [];
  }

  update(dtMs) {
    const dt = dtMs;
    // Score-Flyouts
    for (let i = 0; i < MAX_FLYOUTS; i++) {
      const f = this.scoreFlyouts[i];
      if (!f.active) continue;
      f.ageMs += dt;
      if (f.ageMs >= f.durationMs) {
        f.active = false;
        continue;
      }
    }

    // Score-Partikel
    for (let i = 0; i < MAX_SCORE_PARTICLES; i++) {
      const p = this.scoreParticles[i];
      if (!p.active) continue;
      p.ageMs += dt;
      if (p.ageMs >= p.durationMs) {
        p.active = false;
        continue;
      }
      const dtSec = dt / 1000;
      p.x += p.vx * dtSec;
      p.y += p.vy * dtSec;
    }

    // Level-Banner
    const b = this.levelBanner;
    if (b.active) {
      b.ageMs += dt;
      if (b.ageMs >= b.durationMs) {
        b.active = false;
        if (this.bannerQueue.length) {
          const next = this.bannerQueue.shift();
          this._activateBanner(next.level, next.subtitle);
        }
      }
    }
  }

  draw(ctx) {
    if (!ctx) return;
    // SCORE FLYOUTS
    for (let i = 0; i < MAX_FLYOUTS; i++) {
      const f = this.scoreFlyouts[i];
      if (!f.active) continue;
      const t = clamp01(f.ageMs / f.durationMs);

      // Position
      const yOffset = lerp(0, -28, t);
      const xOffset = lerp(0, f.endX - f.startX, t);

      // Scale: 0.85 -> 1.05 -> 1.0
      let scale;
      if (t < 0.25) {
        const tt = t / 0.25;
        scale = lerp(0.85, 1.05, easeOutBack(tt, 1.4));
      } else {
        const tt = (t - 0.25) / 0.75;
        scale = lerp(1.05, 1.0, easeOutQuad(tt));
      }

      // Alpha: Fade-in 0-0.08, dann halten, letzte 0.2s ausblenden
      let alpha;
      const fadeInEnd = 0.08;
      const fadeOutDuration = 0.2;
      if (t < fadeInEnd) {
        alpha = easeOutQuad(t / fadeInEnd);
      } else if (t > 1 - fadeOutDuration) {
        const tt = (t - (1 - fadeOutDuration)) / fadeOutDuration;
        alpha = 1 - easeInQuad(tt);
      } else {
        alpha = 1;
      }

      const x = f.startX + xOffset;
      const y = f.startY + yOffset;

      // kurzer Glow hinter dem Flyout
      if (t < 0.4) {
        const glowAlpha = SCORE_GLOW_MAX_ALPHA * (1 - t / 0.4);
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        drawGlowRadial(
          ctx,
          x,
          y,
          SCORE_GLOW_RADIUS * scale,
          { r: 255, g: 220, b: 128 },
          { r: 255, g: 160, b: 72 },
          glowAlpha,
        );
        ctx.restore();
      }

      // Nur Text (kein Backplate-Background), aber mit Outline + Gradient-Fill
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(f.rot);
      ctx.scale(scale, scale);
      ctx.globalAlpha = alpha;

      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = 'bold 18px system-ui, sans-serif';
      ctx.lineWidth = 6;
      ctx.strokeStyle = 'rgba(30,15,8,0.9)';
      ctx.strokeText(f.text, 0, 1);
      const textGrad = ctx.createLinearGradient(0, -6, 0, 10);
      textGrad.addColorStop(0, '#ffffff');
      textGrad.addColorStop(1, '#ffe3a3');
      ctx.fillStyle = textGrad;
      ctx.fillText(f.text, 0, 1);

      ctx.restore();
    }

    // SCORE-PARTIKEL (Ticks + Sterne, additive Blend)
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < MAX_SCORE_PARTICLES; i++) {
      const p = this.scoreParticles[i];
      if (!p.active) continue;
      const t = clamp01(p.ageMs / p.durationMs);
      const alpha = (1 - t) * 0.9;

      const r = Math.round(255 - t * 40);
      const g = Math.round(230 - t * 80);
      const b = Math.round(140 + t * 40);
      ctx.strokeStyle = `rgba(${r},${g},${b},${alpha})`;
      ctx.fillStyle = `rgba(${r},${g},${b},${alpha})`;

      if (i % 7 === 0) {
        // Mini-Star
        ctx.save();
        const rOuter = 4;
        const rInner = 2;
        const rot = (i * 0.7 + t * 4) % (Math.PI * 2);
        drawStar(ctx, p.x, p.y, rOuter, rInner, 5, rot);
        ctx.fill();
        ctx.restore();
      } else {
        // Tick/Streak
        ctx.save();
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        const len = 6 + (1 - t) * 8;
        const mag = Math.hypot(p.vx, p.vy) || 1;
        const dx = (p.vx / mag) * len;
        const dy = (p.vy / mag) * len;
        ctx.lineTo(p.x + dx, p.y + dy);
        ctx.stroke();
        ctx.restore();
      }
    }
    ctx.restore();

    // LEVEL-UP BANNER
    const b = this.levelBanner;
    if (b.active) {
      const t = clamp01(b.ageMs / b.durationMs);
      const width = ctx.canvas.width;
      const hudTop = 32;

      // Phasen: In (0-0.3), Hold (0.3-1.1), Out (1.1-1.5)
      let yOffset = 0;
      let scale = 1;
      let alpha = 1;

      if (t < 0.3) {
        const tt = t / 0.3;
        yOffset = lerp(-20, 0, easeOutBack(tt, 1.4));
        scale = lerp(0.95, 1.02, easeOutBack(tt, 1.4));
      } else if (t < 1.1 / 1.5) {
        const tt = (t - 0.3) / ((1.1 / 1.5) - 0.3);
        scale = 1 + Math.sin(tt * Math.PI * 2) * 0.015;
      } else {
        const start = 1.1 / 1.5;
        const tt = (t - start) / (1 - start);
        const eased = easeInQuad(tt);
        yOffset = lerp(0, 40, eased);
        alpha = 1 - eased;
      }

      const centerX = width / 2;
      const baseY = hudTop;

      ctx.save();
      ctx.translate(centerX, baseY + yOffset);
      ctx.scale(scale, scale);
      ctx.globalAlpha = alpha;

      const paddingX = 24;
      const title = 'LEVEL UP';
      const subtitle = b.subtitle ? `Level ${b.level} – ${b.subtitle}` : `Level ${b.level}`;

      ctx.font = 'bold 20px system-ui, sans-serif';
      const titleWidth = ctx.measureText(title).width;

      ctx.font = 'normal 14px system-ui, sans-serif';
      const subWidth = ctx.measureText(subtitle).width;
      const contentWidth = Math.max(titleWidth, subWidth);
      const boxWidth = contentWidth + paddingX * 2;
      const boxHeight = BANNER_HEIGHT;
      const boxX = -boxWidth / 2;
      const boxY = -boxHeight / 2;

      // Panel mit Outline und blauem Verlauf
      const radius = 14;
      roundRectPath(ctx, boxX, boxY, boxWidth, boxHeight, radius);
      ctx.lineWidth = BANNER_OUTLINE_WIDTH;
      ctx.strokeStyle = 'rgba(15,23,42,0.95)';
      ctx.stroke();

      const bodyGrad = ctx.createLinearGradient(0, boxY, 0, boxY + boxHeight);
      bodyGrad.addColorStop(0, 'rgba(59,130,246,0.2)');
      bodyGrad.addColorStop(0.5, 'rgba(37,99,235,0.2)');
      bodyGrad.addColorStop(1, 'rgba(15,23,42,0.2)');
      ctx.fillStyle = bodyGrad;
      ctx.fill();

      // Ribbon-Flaps links/rechts
      ctx.save();
      ctx.fillStyle = '#1e40af';
      const flapW = 18;
      const flapH = boxHeight * 0.55;
      // links
      ctx.beginPath();
      ctx.moveTo(boxX, 0);
      ctx.lineTo(boxX - flapW, -flapH / 2);
      ctx.lineTo(boxX - flapW * 0.6, 0);
      ctx.lineTo(boxX - flapW, flapH / 2);
      ctx.closePath();
      ctx.fill();
      // rechts
      ctx.beginPath();
      ctx.moveTo(boxX + boxWidth, 0);
      ctx.lineTo(boxX + boxWidth + flapW, -flapH / 2);
      ctx.lineTo(boxX + boxWidth + flapW * 0.6, 0);
      ctx.lineTo(boxX + boxWidth + flapW, flapH / 2);
      ctx.closePath();
      ctx.fill();
      ctx.restore();

      // Gloss/Top-Highlight
      ctx.save();
      ctx.globalAlpha = 0.18;
      const glossHeight = boxHeight * 0.45;
      roundRectPath(ctx, boxX + 2, boxY + 2, boxWidth - 4, glossHeight, radius * 0.9);
      const glossGrad = ctx.createLinearGradient(0, boxY + 2, 0, boxY + 2 + glossHeight);
      glossGrad.addColorStop(0, 'rgba(255,255,255,0.9)');
      glossGrad.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = glossGrad;
      ctx.fill();
      ctx.restore();

      // Shine-Sweep während In-Phase
      if (t < 0.25) {
        ctx.save();
        roundRectPath(ctx, boxX, boxY, boxWidth, boxHeight, radius);
        ctx.clip();
        ctx.globalAlpha = 0.3;
        ctx.globalCompositeOperation = 'lighter';
        const sweepT = t / 0.25;
        const sweepX = lerp(boxX - boxWidth * 0.6, boxX + boxWidth * 0.6, sweepT);
        const sweepW = boxWidth * 0.4;
        const sweepH = boxHeight * 1.8;
        const sweepGrad = ctx.createLinearGradient(
          sweepX,
          boxY,
          sweepX + sweepW,
          boxY + sweepH,
        );
        sweepGrad.addColorStop(0, 'rgba(255,255,255,0)');
        sweepGrad.addColorStop(0.5, 'rgba(255,255,255,0.9)');
        sweepGrad.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = sweepGrad;
        ctx.rotate((25 * Math.PI) / 180);
        ctx.fillRect(sweepX, boxY - boxHeight, sweepW, sweepH);
        ctx.restore();
      }

      // Sparklies um das Badge (In + frühe Hold-Phase)
      if (t < 0.6) {
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        const sparkCount = 10;
        for (let i = 0; i < sparkCount; i++) {
          const phase = (i / sparkCount) * Math.PI * 2;
          const rBase = boxHeight * 0.7;
          const rVar = 8 * Math.sin(phase * 2 + t * 6);
          const sx = Math.cos(phase) * (rBase + rVar);
          const sy = Math.sin(phase) * (rBase + rVar * 0.5);
          const lifeFade = 1 - t / 0.6;
          const alphaSpark = 0.4 * lifeFade;
          ctx.fillStyle = `rgba(191,219,254,${alphaSpark})`;
          if (i % 3 === 0) {
            const rOuter = 4;
            const rInner = 2;
            drawStar(ctx, sx, sy, rOuter, rInner, 5, phase + t * 4);
            ctx.fill();
          } else {
            ctx.beginPath();
            ctx.arc(sx, sy, 2, 0, Math.PI * 2);
            ctx.fill();
          }
        }
        ctx.restore();
      }

      // Text: Titel + Subline
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      ctx.font = '900 22px system-ui, sans-serif';
      ctx.lineWidth = 4;
      ctx.strokeStyle = 'rgba(15,23,42,0.95)';
      ctx.strokeText(title, 0, -8);
      const titleGrad = ctx.createLinearGradient(0, -18, 0, 2);
      titleGrad.addColorStop(0, '#ffffff');
      titleGrad.addColorStop(1, '#e5e7eb');
      ctx.fillStyle = titleGrad;
      ctx.fillText(title, 0, -8);

      ctx.font = 'normal 14px system-ui, sans-serif';
      ctx.fillStyle = '#bbf7d0';
      ctx.fillText(subtitle, 0, 13);

      ctx.restore();
    }
  }

  spawnScoreFlyout({ x, y, points, linesClearedCount = 1, comboIndex = 0 }) {
    let idx = -1;
    for (let i = 0; i < MAX_FLYOUTS; i++) {
      if (!this.scoreFlyouts[i].active) {
        idx = i;
        break;
      }
    }
    if (idx === -1) return;

    const f = this.scoreFlyouts[idx];
    f.active = true;
    f.ageMs = 0;
    f.durationMs = FLYOUT_DURATION_MS;
    f.startX = x + randRange(-10, 10);
    f.startY = y + randRange(-6, 6);
    f.endX = f.startX + randRange(-10, 10);
    f.endY = f.startY - 28;
    f.rot = (randRange(-6, 6) * Math.PI) / 180;
    f.text = points != null ? `+${points}` : '+';

    // optionale Mini-Partikel
    const minP = 6;
    const maxP = 10;
    const count = Math.floor(randRange(minP, maxP + 1));
    for (let p = 0; p < count; p++) {
      let pIdx = -1;
      for (let j = 0; j < MAX_SCORE_PARTICLES; j++) {
        if (!this.scoreParticles[j].active) {
          pIdx = j;
          break;
        }
      }
      if (pIdx === -1) break;
      const part = this.scoreParticles[pIdx];
      part.active = true;
      part.ageMs = 0;
      part.durationMs = PARTICLE_DURATION_MS;
      part.x = f.startX;
      part.y = f.startY;
      const ang = randRange(-Math.PI / 2 - 0.6, -Math.PI / 2 + 0.6);
      const speed = randRange(40, 110);
      part.vx = Math.cos(ang) * speed;
      part.vy = Math.sin(ang) * speed;
    }
  }

  spawnLevelUp({ level, subtitle }) {
    const payload = { level: level ?? 1, subtitle: subtitle || '' };
    if (!this.levelBanner.active) {
      this._activateBanner(payload.level, payload.subtitle);
    } else {
      if (this.bannerQueue.length < 2) {
        this.bannerQueue.push(payload);
      } else {
        this.bannerQueue[this.bannerQueue.length - 1] = payload;
      }
    }
  }

  _activateBanner(level, subtitle) {
    this.levelBanner.active = true;
    this.levelBanner.ageMs = 0;
    this.levelBanner.durationMs = 1500;
    this.levelBanner.level = level ?? 1;
    this.levelBanner.subtitle = subtitle || '';
  }

  /**
   * Hilfsfunktion für StandardMode, um aus Lines-Cleared-Infos
   * automatisch einen Score-Flyout zu erzeugen.
   */
  spawnScoreForLines(ctx, rows, level) {
    if (!rows || !rows.length || !ctx) return;
    const cleared = rows.length;
    let key = 'single';
    if (cleared === 2) key = 'double';
    else if (cleared === 3) key = 'triple';
    else if (cleared >= 4) key = 'tetris';
    const base = SCORE_TABLE[key] ?? 0;
    const points = base * (level || 1);

    // Spielfeld-Geometrie aus Canvas ableiten
    const width = ctx.canvas.width;
    const height = ctx.canvas.height;
    const cellSize = Math.floor(Math.min(width / BOARD_WIDTH, height / BOARD_HEIGHT));
    const offsetX = Math.floor((width - cellSize * BOARD_WIDTH) / 2);
    const offsetY = Math.floor((height - cellSize * BOARD_HEIGHT) / 2);

    const minRow = Math.min(...rows);
    const maxRow = Math.max(...rows);
    const midRow = (minRow + maxRow) / 2;

    const px = offsetX + (BOARD_WIDTH / 2) * cellSize;
    const py = offsetY + (midRow + 0.5) * cellSize;

    this.spawnScoreFlyout({
      x: px,
      y: py,
      points,
      linesClearedCount: cleared,
      comboIndex: 0,
    });
  }
}

