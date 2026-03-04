// Procedural Gras-Erde-Blocktexturen für das Spiel.
// Diese Logik ist aus dem Playground extrahiert und leicht bereinigt,
// so dass sie unabhängig nutzbar ist.

export const GRASS_DIRT_TEXTURE_SIZE = 128;
export const GRASS_DIRT_PAD = 0;

/**
 * Erzeugt eine einzelne Gras-Erde-Kachel als Canvas.
 * Gibt immer ein Canvas zurück (zur Sicherheit auch, wenn kein Context verfügbar ist).
 */
export function generateGrassDirtTexture(size = GRASS_DIRT_TEXTURE_SIZE, opt = {}) {
  return generateGrassDirtBlock(size, opt);
}

/**
 * Erzeugt mehrere Varianten der Gras-Erde-Textur.
 * Die Seeds werden aus einem Basis-Seed abgeleitet, so dass die Varianten
 * visuell konsistent, aber unterscheidbar sind.
 */
export function generateGrassDirtVariants(
  count = 16,
  size = GRASS_DIRT_TEXTURE_SIZE,
  baseSeed = 1337,
  opt = {},
) {
  const textures = [];
  for (let i = 0; i < count; i++) {
    const seed = (baseSeed + i * 1013) >>> 0;
    textures.push(generateGrassDirtBlock(size, { ...opt, seed }));
  }
  return textures;
}

// ------------------------------------------------------------
// Interne Implementierung (aus effectsGrassDirtPlayground extrahiert)
// ------------------------------------------------------------

function makeGrassPath(w, h) {
  const p = new Path2D();
  const baseY = h * 0.7;
  const bottomY = h * 1.0;
  const topBlades = 10; // wenige, breite Blades oben
  const bottomBlades = 10; // kurze Blades unten
  const step = (w * 1.2) / (topBlades - 1);

  // Start etwas links außen, damit Gras visuell über den Block hinausreicht
  let x = -step * 0.6;
  p.moveTo(x, bottomY);
  p.lineTo(x, baseY);

  // Obere Kante: breite, geneigte Grashalme
  for (let i = 0; i < topBlades; i++) {
    const nextBaseX = -step * 0.6 + (i + 1) * step;
    const midBaseX = (x + nextBaseX) * 0.5;

    const lean = (Math.random() * 2 - 1) * step * 0.8;
    const tipX = midBaseX + lean;
    const tipY = h - 0.1 * (0.05 + 0.05 * Math.random());
    const baseYOffsetRight = h * 0.035 * (Math.random() - 0.5);

    p.quadraticCurveTo(
      tipX,
      tipY,
      nextBaseX,
      baseY + baseYOffsetRight,
    );

    x = nextBaseX;
  }

  // Rechte Seite leicht nach unten zur Unterkante
  const rightX = w + step * 0.4;
  p.lineTo(rightX, baseY + h * 0.09);
  p.lineTo(rightX, bottomY);

  // Untere Kante: kurze Blades nach unten (etwa halb so lang wie oben)
  const bottomStep = rightX / (bottomBlades - 1);
  const downDepth = h * 0.245;
  let bx = rightX;
  for (let i = bottomBlades - 1; i >= 0; i--) {
    const nextBx = i * bottomStep;
    const midBx = (bx + nextBx) * 0.5;
    const lean = (Math.random() * 2 - 1) * bottomStep * 0.4;
    const tipX = midBx + lean;
    const tipY = bottomY + downDepth * (0.6 + 0.4 * Math.random());
    const baseYOffset = h * 0.012 * (Math.random() - 0.5);

    p.quadraticCurveTo(
      tipX,
      tipY,
      nextBx,
      bottomY + baseYOffset,
    );

    bx = nextBx;
  }

  // Linke Seite schließen
  p.closePath();
  return p;
}

function generateGrassDirtBlock(size = 128, opt = {}) {
  const {
    seed = 1337,
    borderRadius = 12,
    borderW = 6,
    // grassH aktuell ungenutzt, Dirt füllt die gesamte Box; behalten für spätere Tweaks
    grassH = 32, // eslint-disable-line no-unused-vars
    smallStoneCount = 420,
    bigStoneCount = 10,
  } = opt;

  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx2 = c.getContext('2d');
  if (!ctx2) return c;

  // ---------- RNG ----------
  let s = seed >>> 0;
  const rand = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
  const r = (a, b) => a + (b - a) * rand();
  const ri = (a, b) => Math.floor(r(a, b + 1));
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const hsl = (h, sVal, l, a = 1) => `hsla(${h},${sVal}%,${l}%,${a})`;

  // ---------- Geometry helpers ----------
  function roundedRectPath(x, y, w, h, rad) {
    ctx2.beginPath();
    ctx2.moveTo(x + rad, y);
    ctx2.arcTo(x + w, y, x + w, y + h, rad);
    ctx2.arcTo(x + w, y + h, x, y + h, rad);
    ctx2.arcTo(x, y + h, x, y, rad);
    ctx2.arcTo(x, y, x + w, y, rad);
    ctx2.closePath();
  }

  function pathPoly(ctxLocal, pts) {
    if (!pts.length) return;
    ctxLocal.beginPath();
    ctxLocal.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) ctxLocal.lineTo(pts[i].x, pts[i].y);
    ctxLocal.closePath();
  }

  // ---------- Comic-Stein-Generator (vereinfacht aus effectsRockPlayground) ----------

  function mulberry32Stone(seedLocal) {
    let a = seedLocal >>> 0;
    return function () {
      a |= 0;
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function chaikin(points, iterations = 2, ratio = 0.25) {
    let pts = points.slice();
    for (let it = 0; it < iterations; it++) {
      const out = [];
      for (let i = 0; i < pts.length; i++) {
        const p0 = pts[i];
        const p1 = pts[(i + 1) % pts.length];
        out.push({
          x: (1 - ratio) * p0.x + ratio * p1.x,
          y: (1 - ratio) * p0.y + ratio * p1.y,
        });
        out.push({
          x: ratio * p0.x + (1 - ratio) * p1.x,
          y: ratio * p0.y + (1 - ratio) * p1.y,
        });
      }
      pts = out;
    }
    return pts;
  }

  function drawDirtStone(ctxLocal, cx, cy, R, seedStone, optStone = {}) {
    const rndStone = mulberry32Stone(seedStone);
    const rr = (a, b) => a + (b - a) * rndStone();
    const riLocal = (a, b) => Math.floor(rr(a, b + 1));
    const clampStone = (v, a, b) => Math.max(a, Math.min(b, v));

    const light = optStone.light ?? { x: -0.7, y: -1.0 };
    const ld = (() => {
      const d = Math.hypot(light.x, light.y) || 1;
      return { x: light.x / d, y: light.y / d };
    })();

    const outlineW = optStone.outlineW ?? clampStone(R * 0.1, 0.8, 2.0);
    const outlineCol = optStone.outlineCol ?? 'rgba(0,0,0,0.55)';

    const baseCol = optStone.baseCol ?? 'rgb(150,145,140)';
    const shadowCol = optStone.shadowCol ?? 'rgba(0,0,0,0.22)';
    const highlightCol = optStone.highlightCol ?? 'rgba(255,255,255,0.18)';

    // 1) Grund-Silhouette mit optionalen „Ausbrüchen“
    const n = riLocal(6, 8);
    const coarse = [];
    for (let i = 0; i < n; i++) {
      const a = (Math.PI * 2 * i) / n + rr(-0.25, 0.25);
      const rad = R * rr(0.75, 1.05);
      coarse.push({ x: cx + Math.cos(a) * rad, y: cy + Math.sin(a) * rad });
    }

    function buildNotched(points) {
      const out = [];
      const len = points.length;
      let notchesLeft = riLocal(0, 2);
      for (let i = 0; i < len; i++) {
        const p0 = points[i];
        const p1 = points[(i + 1) % len];
        out.push(p0);
        if (notchesLeft > 0 && rndStone() < 0.4) {
          const mx = (p0.x + p1.x) * 0.5;
          const my = (p0.y + p1.y) * 0.5;
          let vx = cx - mx;
          let vy = cy - my;
          const vd = Math.hypot(vx, vy) || 1;
          vx /= vd;
          vy /= vd;
          const depth = R * rr(0.2, 0.45);
          const tip = { x: mx + vx * depth, y: my + vy * depth };
          out.push(
            { x: mx + (p0.x - mx) * 0.2, y: my + (p0.y - my) * 0.2 },
            tip,
            { x: mx + (p1.x - mx) * 0.2, y: my + (p1.y - my) * 0.2 },
          );
          notchesLeft--;
        }
      }
      return out;
    }

    const coarseNotched = buildNotched(coarse);
    const pts = chaikin(coarseNotched, 2, 0.25);

    // 0) Drop-Shadow unter dem Stein (außerhalb des Steinkörpers)
    const dropAlpha =
      optStone.dropShadowAlpha ?? clampStone((R - 1.0) / 6.0, 0.04, 0.24);
    if (dropAlpha > 0.01) {
      const sx = cx - ld.x * R * 0.08;
      const sy = cy - ld.y * R * 0.08;
      ctxLocal.save();
      ctxLocal.globalAlpha = dropAlpha;
      ctxLocal.fillStyle = 'rgba(0, 0, 0, 0.9)';
      ctxLocal.filter = 'blur(1.5px)';
      ctxLocal.beginPath();
      ctxLocal.ellipse(
        sx,
        sy,
        R * 1.05,
        R * 0.7,
        0,
        0,
        Math.PI * 2,
      );
      ctxLocal.fill();
      ctxLocal.filter = 'none';
      ctxLocal.restore();
    }

    // Basisfläche
    pathPoly(ctxLocal, pts);
    ctxLocal.fillStyle = baseCol;
    ctxLocal.fill();

    // Clip auf Stein
    ctxLocal.save();
    pathPoly(ctxLocal, pts);
    ctxLocal.clip();

    // 2) Schattenkontur, entgegen der Lichtrichtung versetzt
    const shOff = { x: -ld.x * R * 0.52, y: -ld.y * R * 0.82 };
    const shadowPts = pts.map((p) => ({
      x: p.x + shOff.x + rr(-0.4, 0.4),
      y: p.y + shOff.y + rr(-0.4, 0.4),
    }));
    pathPoly(ctxLocal, shadowPts);
    ctxLocal.fillStyle = shadowCol;
    ctxLocal.fill();

    // 3) Highlightkontur, in Lichtrichtung versetzt
    const hiPts = pts.map((p) => ({
      x: p.x + ld.x * R * 0.36 + rr(-0.3, 0.3),
      y: p.y + ld.y * R * 0.36 + rr(-0.3, 0.3),
    }));
    pathPoly(ctxLocal, hiPts);
    ctxLocal.fillStyle = highlightCol;
    ctxLocal.fill();

    ctxLocal.restore(); // Ende Clip

    // Outline zuletzt
    ctxLocal.lineWidth = outlineW;
    ctxLocal.strokeStyle = outlineCol;
    ctxLocal.lineJoin = 'round';
    ctxLocal.lineCap = 'round';
    pathPoly(ctxLocal, pts);
    ctxLocal.stroke();
  }

  // ---------- Base clear ----------
  ctx2.clearRect(0, 0, size, size);

  // ---------- Block frame ----------
  const pad = GRASS_DIRT_PAD;
  const bx = pad;
  const by = pad;
  const bw = size - pad * 2;
  const bh = size - pad * 2;

  // outer outline
  roundedRectPath(bx, by, bw, bh, borderRadius);
  ctx2.lineWidth = borderW;
  ctx2.strokeStyle = 'rgba(0,0,0,0.9)';
  ctx2.stroke();

  // inner clip area
  const inset = borderW * 0.6;
  const ix = bx + inset;
  const iy = by + inset;
  const iw = bw - inset * 2;
  const ih = bh - inset * 2;

  ctx2.save();
  roundedRectPath(ix, iy, iw, ih, borderRadius - 3);
  ctx2.clip();

  // ---------- Dirt-Farb-Helfer (für Steine, damit sie mit dem Boden verschmelzen) ----------
  function lerp(a, b, t) {
    return a + (b - a) * t;
  }

  function sampleDirtColor(t) {
    const tt = Math.max(0, Math.min(1, t));
    const top = { h: 32, s: 88, l: 48 };
    const mid = { h: 30, s: 90, l: 40 };
    const bot = { h: 28, s: 90, l: 28 };
    if (tt <= 0.5) {
      const k = tt / 0.5;
      return {
        h: lerp(top.h, mid.h, k),
        s: lerp(top.s, mid.s, k),
        l: lerp(top.l, mid.l, k),
      };
    }
    const k = (tt - 0.5) / 0.5;
    return {
      h: lerp(mid.h, bot.h, k),
      s: lerp(mid.s, bot.s, k),
      l: lerp(mid.l, bot.l, k),
    };
  }

  // ---------- Dirt base (painted, brown family) ----------
  const BOX_MARGIN_X = 2;
  const BOX_MARGIN_TOP = 10;

  const boxX = ix + BOX_MARGIN_X;
  const boxY = iy + BOX_MARGIN_TOP;
  const boxW = iw - BOX_MARGIN_X * 2;
  const boxH = ih - BOX_MARGIN_TOP;

  const dirtTop = boxY;

  {
    const g = ctx2.createLinearGradient(0, dirtTop, 0, boxY + boxH);
    g.addColorStop(0, hsl(32, 88, 48));
    g.addColorStop(0.5, hsl(30, 90, 40));
    g.addColorStop(1, hsl(28, 90, 28));
    ctx2.fillStyle = g;
    ctx2.fillRect(boxX, dirtTop, boxW, boxH);
  }

  // subtle painted mottling (no harsh noise)
  for (let i = 0; i < 240; i++) {
    const x = boxX + rand() * boxW;
    const y = dirtTop + rand() * boxH;
    const rad = r(6, 18);
    ctx2.globalAlpha = r(0.03, 0.07);
    ctx2.fillStyle = hsl(r(26, 34), r(55, 85), r(18, 30));
    ctx2.beginPath();
    ctx2.ellipse(
      x,
      y,
      rad * r(0.8, 1.4),
      rad * r(0.6, 1.2),
      r(0, Math.PI),
      0,
      Math.PI * 2,
    );
    ctx2.fill();
  }
  ctx2.globalAlpha = 1;

  // ---------- Stein-Layer ----------
  const bgCount = Math.floor(smallStoneCount * 1.0);
  const midCount = Math.floor(smallStoneCount * 0.1);
  const fgCount = bigStoneCount;

  const STONE_MARGIN_X = 2;
  const STONE_MARGIN_TOP = 3;
  const stoneMinX = boxX + STONE_MARGIN_X;
  const stoneMaxX = boxX + boxW - STONE_MARGIN_X;
  const stoneMinY = dirtTop + STONE_MARGIN_TOP;
  const stoneMaxY = boxY + boxH;

  function sampleNonOverlappingCenters(count, minDist) {
    const result = [];
    const minDistSq = minDist * minDist;
    const maxAttempts = 40;
    for (let i = 0; i < count; i++) {
      let placed = false;
      let attempts = 0;
      while (!placed && attempts < maxAttempts) {
        attempts++;
        const x = stoneMinX + rand() * (stoneMaxX - stoneMinX);
        const y = stoneMinY + rand() * (stoneMaxY - stoneMinY);
        let ok = true;
        for (const p of result) {
          const dx = p.x - x;
          const dy = p.y - y;
          if (dx * dx + dy * dy < minDistSq) {
            ok = false;
            break;
          }
        }
        if (ok) {
          result.push({ x, y });
          placed = true;
        }
      }
      if (!placed && result.length) {
        const base = result[Math.floor(rand() * result.length)];
        result.push({
          x: base.x + r(-minDist * 0.25, minDist * 0.25),
          y: base.y + r(-minDist * 0.25, minDist * 0.25),
        });
      }
    }
    return result;
  }

  // Hintergrund-Layer: viele sehr kleine, dunklere Steine
  ctx2.save();
  ctx2.globalAlpha = 0.7;
  for (let i = 0; i < bgCount; i++) {
    const x = stoneMinX + rand() * (stoneMaxX - stoneMinX);
    const y = stoneMinY + rand() * (stoneMaxY - stoneMinY);
    const depth01 = (y - dirtTop) / (stoneMaxY - dirtTop);
    const radius = r(0.7, 1.6) * (0.7 + depth01 * 0.5);
    const seedStone = (rand() * 0xffffffff) >>> 0;
    const baseSample = sampleDirtColor(depth01 + r(-0.08, 0.06));
    const hBg = baseSample.h + r(-1.5, 1.5);
    const sBg = baseSample.s + r(-6, 4);
    const lBg = baseSample.l + r(-4, 2);
    const baseCol = hsl(hBg, sBg, lBg);
    const outlineCol = hsl(hBg, sBg, Math.max(4, lBg - 14), 0.9);
    drawDirtStone(ctx2, x, y, radius, seedStone, {
      baseCol,
      shadowCol: 'rgba(0,0,0,0.22)',
      highlightCol: 'rgba(255,255,255,0.12)',
      outlineCol,
      outlineW: Math.max(0.3, radius * 0.06),
    });
  }
  ctx2.restore();

  // Mittel-Layer: mittel viele mittelgroße Steine (weit verteilt)
  const midCenters = sampleNonOverlappingCenters(midCount, Math.max(6, iw / 8));
  ctx2.save();
  ctx2.globalAlpha = 0.9;
  for (let i = 0; i < midCenters.length; i++) {
    const { x, y } = midCenters[i];
    const depth01 = (y - dirtTop) / (stoneMaxY - dirtTop);
    const radius = r(1.8, 3.4) * (0.9 + depth01 * 0.75);
    const seedStone = (rand() * 0xffffffff) >>> 0;
    const baseSample = sampleDirtColor(depth01 + r(-0.04, 0.04));
    const hMid = baseSample.h + r(-1, 1);
    const sMid = baseSample.s + r(-4, 4);
    const lMid = baseSample.l + r(-2, 3);
    const baseCol = hsl(hMid, sMid, lMid);
    const outlineCol = hsl(hMid, sMid, Math.max(6, lMid - 14), 0.95);
    drawDirtStone(ctx2, x, y, radius, seedStone, {
      baseCol,
      shadowCol: 'rgba(0,0,0,0.28)',
      highlightCol: 'rgba(255,255,255,0.23)',
      outlineCol,
      outlineW: Math.max(0.7, radius * 0.11),
    });
  }
  ctx2.restore();

  // Vordergrund-Layer: sehr wenige größere Steine als Akzente (stark verteilt)
  const fgCenters = sampleNonOverlappingCenters(fgCount, Math.max(10, iw / 5));
  ctx2.save();
  ctx2.globalAlpha = 1;
  for (let i = 0; i < fgCenters.length; i++) {
    const { x, y } = fgCenters[i];
    const depth01 = (y - dirtTop) / (stoneMaxY - dirtTop);
    const radius = r(4.0, 7.2) * (0.95 + depth01 * 0.85);
    const seedStone = (rand() * 0xffffffff) >>> 0;
    const baseSample = sampleDirtColor(depth01 + r(-0.02, 0.03));
    const hFg = baseSample.h + r(-1, 1.5);
    const sFg = baseSample.s + r(-2, 6);
    const lFg = baseSample.l + r(4, 8);
    const baseCol = hsl(hFg, sFg, lFg);
    const outlineCol = hsl(hFg, sFg, Math.max(10, lFg - 22), 1.0);
    drawDirtStone(ctx2, x, y, radius, seedStone, {
      baseCol,
      shadowCol: 'rgba(0,0,0,0.32)',
      highlightCol: 'rgba(255,255,255,0.34)',
      outlineCol,
      outlineW: Math.max(1.8, radius * 0.17),
    });
  }
  ctx2.restore();

  // ---------- Globaler 3D-Overlay (Highlight + Shadow) ----------
  ctx2.save();
  roundedRectPath(ix + 1, iy + 1, iw - 2, ih - 2, borderRadius - 4);
  ctx2.clip();

  let gOv = ctx2.createLinearGradient(ix, iy, ix, iy + ih * 0.055);
  gOv.addColorStop(0, 'rgba(255,255,255,0.28)');
  gOv.addColorStop(0.4, 'rgba(255,255,255,0.14)');
  gOv.addColorStop(1, 'rgba(255,255,255,0.0)');
  ctx2.fillStyle = gOv;
  ctx2.fillRect(ix, iy, iw, ih * 0.55);

  gOv = ctx2.createLinearGradient(ix, iy + ih, ix, iy + ih * 0.035);
  gOv.addColorStop(0, 'rgba(0,0,0,0.22)');
  gOv.addColorStop(0.4, 'rgba(0,0,0,0.10)');
  gOv.addColorStop(1, 'rgba(0,0,0,0.0)');
  ctx2.fillStyle = gOv;
  ctx2.fillRect(ix, iy + ih * 0.35, iw, ih * 0.65);
  ctx2.restore();

  // ---------- Gras-Layer oben ----------
  ctx2.save();
  // Gras leicht nach oben schieben, damit es die Box sichtbar überragt
  ctx2.translate(ix, iy - 40);

  const grassHeight = ih * 0.56;
  const grassPath = makeGrassPath(iw, grassHeight);

  // Drop-Shadow unterhalb des Gras-Saums mit identischer Silhouette
  ctx2.save();
  ctx2.translate(0, 5);
  ctx2.globalAlpha = 1;
  ctx2.fillStyle = 'rgba(0,0,0,0.5)';
  ctx2.filter = 'blur(4px)';
  ctx2.fill(grassPath);
  ctx2.filter = 'none';
  ctx2.restore();

  // Grundfüllung Gras
  let gGrass = ctx2.createLinearGradient(0, 0, 0, grassHeight);
  gGrass.addColorStop(0, 'hsl(100, 80%, 68%)');
  gGrass.addColorStop(0.4, 'hsl(104, 82%, 55%)');
  gGrass.addColorStop(1, 'hsl(110, 78%, 40%)');
  ctx2.fillStyle = gGrass;
  ctx2.fill(grassPath);

  // Oberes Highlight auf dem Gras
  let gGrassHi = ctx2.createLinearGradient(0, 0, 0, grassHeight * 0.6);
  gGrassHi.addColorStop(0, 'rgba(255,255,255,0.55)');
  gGrassHi.addColorStop(0.5, 'rgba(255,255,255,0.18)');
  gGrassHi.addColorStop(1, 'rgba(255,255,255,0.0)');
  ctx2.fillStyle = gGrassHi;
  ctx2.fill(grassPath);

  // Dünner, dunkler Rand wie bei einer Vektor-Kachel
  ctx2.lineWidth = 2.2;
  ctx2.strokeStyle = 'rgba(10,35,8,0.95)';
  ctx2.stroke(grassPath);

  // Zweite, kleinere helle Gras-Silhouette (Highlight-Layer 1)
  const scaledW1 = iw * 0.82;
  const scaledH1 = grassHeight * 0.6;
  const offsetX1 = (iw - scaledW1) * 0.5;
  const offsetY1 = grassHeight * 0.06 +12;
  const grassPath1 = makeGrassPath(scaledW1, scaledH1);

  ctx2.save();
  ctx2.translate(offsetX1, offsetY1);
  let gGrass1 = ctx2.createLinearGradient(0, 0, 0, scaledH1);
  gGrass1.addColorStop(0, 'hsl(95, 90%, 78%)');
  gGrass1.addColorStop(0.5, 'hsl(98, 92%, 68%)');
  gGrass1.addColorStop(1, 'hsl(102, 88%, 55%)');
  ctx2.fillStyle = gGrass1;
  ctx2.globalAlpha = 0.9;
  ctx2.fill(grassPath1);
  ctx2.restore();

   // Drop-Shadow unterhalb des Gras-Saums mit identischer Silhouette
 ctx2.save();
 ctx2.translate(-10, 0); // leicht nach unten versetzt
 ctx2.globalAlpha = 1;
 ctx2.fillStyle = 'rgba(0,0,0,0.4)';
 ctx2.filter = 'blur(1px)';
 ctx2.fill(grassPath);
 ctx2.filter = 'none';
 ctx2.restore();
  
/*
  // Dritte, noch kleinere, sehr helle Gras-Silhouette (Highlight-Layer 2)
  const scaledW2 = iw * 0.6;
  const scaledH2 = grassHeight * 0.6;
  const offsetX2 = (iw - scaledW2) * 0.5;
  const offsetY2 = grassHeight * 0.12;
  const grassPath2 = makeGrassPath(scaledW2, scaledH2);

  ctx2.save();
  ctx2.translate(offsetX2, offsetY2);
  let gGrass2 = ctx2.createLinearGradient(0, 0, 0, scaledH2);
  gGrass2.addColorStop(0, 'hsl(90, 95%, 85%)');
  gGrass2.addColorStop(0.5, 'hsl(94, 96%, 76%)');
  gGrass2.addColorStop(1, 'hsl(98, 92%, 62%)');
  ctx2.fillStyle = gGrass2;
  ctx2.globalAlpha = 0.85;
  ctx2.fill(grassPath2);
  ctx2.restore();
*/
  ctx2.restore(); // restore nach translate(ix, iy-6)
  ctx2.restore(); // clip inner block

  return c;
}

