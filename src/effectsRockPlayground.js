const canvas = document.getElementById('rockCanvas');
/** @type {CanvasRenderingContext2D | null} */
const ctx = canvas ? canvas.getContext('2d') : null;

const seedInput = document.getElementById('rockSeed');
const radiusInput = document.getElementById('rockRadius');
const lightnessInput = document.getElementById('rockLightness');
const redrawBtn = document.getElementById('rockRedraw');

// Einstellbarer Faktor für die Crack-Länge (1.0 = Standard)
// Werte < 1.0 = kürzere Risse, > 1.0 = längere Risse.
const CRACK_LENGTH_FACTOR = 1.0;

// Deterministic RNG (Mulberry32)
function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Chaikin corner cutting for closed polygons (rounded look)
function chaikin(points, iterations = 2, ratio = 0.25) {
  let pts = points.slice();
  for (let it = 0; it < iterations; it++) {
    const out = [];
    for (let i = 0; i < pts.length; i++) {
      const p0 = pts[i];
      const p1 = pts[(i + 1) % pts.length];
      const q = {
        x: (1 - ratio) * p0.x + ratio * p1.x,
        y: (1 - ratio) * p0.y + ratio * p1.y,
      };
      const r = {
        x: ratio * p0.x + (1 - ratio) * p1.x,
        y: ratio * p0.y + (1 - ratio) * p1.y,
      };
      out.push(q, r);
    }
    pts = out;
  }
  return pts;
}

function drawPolygon(ctxLocal, pts) {
  if (!pts.length) return;
  ctxLocal.beginPath();
  ctxLocal.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length; i++) ctxLocal.lineTo(pts[i].x, pts[i].y);
  ctxLocal.closePath();
}

// Alias für die neue API-Signatur aus dem Testcode
function pathPoly(ctxLocal, pts) {
  drawPolygon(ctxLocal, pts);
}

function getSeed() {
  if (!seedInput) return 1;
  const v = Number(seedInput.value);
  if (!Number.isFinite(v)) return 1;
  return Math.floor(v) || 1;
}

function getRadius() {
  if (!radiusInput) return 32;
  const v = Number(radiusInput.value) || 32;
  return Math.max(10, Math.min(60, v));
}

function getLightness() {
  if (!lightnessInput) return 42;
  const v = Number(lightnessInput.value) || 42;
  return Math.max(20, Math.min(70, v));
}

function drawComicStone(ctxLocal, cx, cy, R, seed = 1, opt = {}) {
  const rnd = mulberry32(seed);
  const r = (a, b) => a + (b - a) * rnd();
  const ri = (a, b) => Math.floor(r(a, b + 1));
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  // Sammeln aller bereits gezeichneten Crack-Segmente zur Kollisionsprüfung
  /** @type {{x1:number,y1:number,x2:number,y2:number}[]} */
  const crackSegments = [];

  function addSegment(x1, y1, x2, y2) {
    crackSegments.push({ x1, y1, x2, y2 });
  }

  // Ray/Segment-Schnitt: prüft, ob aktuelles Segment irgendeinen vorhandenen
  // Crack schneidet. Gibt ggf. den Schnittpunkt zurück.
  function findIntersection(x1, y1, x2, y2) {
    const EPS = 1e-4;
    for (const seg of crackSegments) {
      const x3 = seg.x1;
      const y3 = seg.y1;
      const x4 = seg.x2;
      const y4 = seg.y2;

      const denom = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4);
      if (Math.abs(denom) < EPS) continue;

      const t =
        ((x1 - x3) * (y3 - y4) - (y1 - y3) * (x3 - x4)) / denom;
      const u =
        -((x1 - x2) * (y1 - y3) - (y1 - y2) * (x1 - x3)) / denom;

      if (t > EPS && t < 1 - EPS && u > EPS && u < 1 - EPS) {
        return {
          x: x1 + t * (x2 - x1),
          y: y1 + t * (y2 - y1),
        };
      }
    }
    return null;
  }

  // Light direction (top-left typical)
  const light = opt.light ?? { x: -0.7, y: -1.0 };
  const ld = (() => {
    const d = Math.hypot(light.x, light.y) || 1;
    return { x: light.x / d, y: light.y / d };
  })();

  // Style: keep it “vector/comic”
  const outlineW = opt.outlineW ?? clamp(R * 0.1, 2, 5);
  const outlineCol = opt.outlineCol ?? 'rgba(0,0,0,0.65)';

  const baseCol = opt.baseCol ?? 'rgb(170,175,180)';
  const shadowCol = opt.shadowCol ?? 'rgba(0,0,0,0.22)';
  const highlightCol = opt.highlightCol ?? 'rgba(255,255,255,0.2)';
  const facetDark = opt.facetDark ?? 'rgba(0,0,0,0.1)';
  const facetLight = opt.facetLight ?? 'rgba(255,255,255,0.1)';

  // 1) Silhouette: coarse polygon -> optionale "Ausbrüche" -> Chaikin
  const n = ri(6, 9);
  const coarse = [];
  for (let i = 0; i < n; i++) {
    const a = (Math.PI * 2 * i) / n + r(-0.25, 0.25);
    const rr = R * r(0.8, 1.05);
    coarse.push({ x: cx + Math.cos(a) * rr, y: cy + Math.sin(a) * rr });
  }

  // Notch-Anker dienen später als potentielle Startpunkte für Cracks
  /** @type {{x:number,y:number}[]} */
  const notchAnchors = [];

  function buildNotched(points) {
    const out = [];
    const len = points.length;
    let notchesLeft = ri(1, 3);
    for (let i = 0; i < len; i++) {
      const p0 = points[i];
      const p1 = points[(i + 1) % len];
      out.push(p0);

      if (notchesLeft > 0 && rnd() < 0.5) {
        const mx = (p0.x + p1.x) * 0.5;
        const my = (p0.y + p1.y) * 0.5;
        // Richtung nach innen (zum Zentrum) definiert die Kerbe.
        let vx = cx - mx;
        let vy = cy - my;
        const vd = Math.hypot(vx, vy) || 1;
        vx /= vd;
        vy /= vd;

        // Basis extrem schmal – nahezu Punkt
        const base0 = {
          x: mx + (p0.x - mx) * 0.1,
          y: my + (p0.y - my) * 0.1,
        };
        const base1 = {
          x: mx + (p1.x - mx) * 0.1,
          y: my + (p1.y - my) * 0.1,
        };

        // Blitzförmige Innenpunkte – lange, schmale "Risse"
        const depth1 = R * r(0.0045, 0.06);
        const depth2 = R * r(0.0075, 0.09);
        const depth3 = R * r(0.005, 0.07);

        function lerpPoint(a, b, t) {
          return { x: a.x * (1 - t) + b.x * t, y: a.y * (1 - t) + b.y * t };
        }

        const m1 = lerpPoint(base0, base1, 0.25);
        const m2 = lerpPoint(base0, base1, 0.6);
        const m3 = lerpPoint(base0, base1, 0.9);

        const pIn1 = {
          x: m1.x + vx * depth1,
          y: m1.y + vy * depth1,
        };
        const pIn2 = {
          x: m2.x + vx * depth2,
          y: m2.y + vy * depth2,
        };
        const pIn3 = {
          x: m3.x + vx * depth3,
          y: m3.y + vy * depth3,
        };

        out.push(base0, pIn1, pIn2, pIn3, base1);
        // Mittlerer Innenpunkt als "Crack-Start" merken
        notchAnchors.push(pIn2);
        notchesLeft--;
      }
    }
    return out;
  }

  const coarseNotched = buildNotched(coarse);
  const pts = chaikin(
    coarseNotched,
    opt.smoothIter ?? 2,
    opt.smoothRatio ?? 0.25,
  );

  // Base fill
  pathPoly(ctxLocal, pts);
  ctxLocal.fillStyle = baseCol;
  ctxLocal.fill();

  // Clip to stone for all inner vector-shapes
  ctxLocal.save();
  pathPoly(ctxLocal, pts);
  ctxLocal.clip();

  // 2) Shadow: offset silhouette entgegen der Licht-Richtung
  const shOff = { x: -ld.x * R * 0.22, y: -ld.y * R * 0.22 };
  const shadowPts = pts.map((p) => ({
    x: p.x + shOff.x + r(-0.8, 0.8),
    y: p.y + shOff.y + r(-0.8, 0.8),
  }));
  pathPoly(ctxLocal, shadowPts);
  ctxLocal.fillStyle = shadowCol;
  ctxLocal.fill();

  // 3) Highlight: Spiegelung der Kontur in Licht-Richtung
  const highlightPts = pts.map((p) => ({
    x: p.x + ld.x * R * 0.18 + r(-0.5, 0.5),
    y: p.y + ld.y * R * 0.18 + r(-0.5, 0.5),
  }));
  pathPoly(ctxLocal, highlightPts);
  ctxLocal.fillStyle = highlightCol;
  ctxLocal.fill();

  // 3) Highlight: hard-edged blob near light
  /*
  const hx = cx + ld.x * R * 0.35;
  const hy = cy + ld.y * R * 0.35;
  ctxLocal.beginPath();
  ctxLocal.ellipse(hx, hy, R * 0.42, R * 0.26, r(-0.6, 0.6), 0, Math.PI * 2);
  ctxLocal.fillStyle = highlightCol;
  ctxLocal.fill();
  */
  // 4) Facets: 3–8 tone-in-tone shapes (gives “interesting shading”)
  /*
  const facetCount = ri(3, 8);
  for (let i = 0; i < facetCount; i++) {
    const fx = cx + r(-R * 0.35, R * 0.35);
    const fy = cy + r(-R * 0.28, R * 0.35);
    const frx = R * r(0.18, 0.5);
    const fry = R * r(0.12, 0.4);
    ctxLocal.beginPath();
    ctxLocal.ellipse(fx, fy, frx, fry, r(-1, 1), 0, Math.PI * 2);
    ctxLocal.fillStyle = rnd() < 0.5 ? facetDark : facetLight;
    ctxLocal.fill();
    
  }
    */

  
  // 5) Cracks: blitzartige Polylinien vom Rand in Richtung Zentrum
  ctxLocal.lineCap = 'round';
  ctxLocal.lineJoin = 'round';

  const crackCount = ri(1, 4);
  for (let i = 0; i < crackCount; i++) {
    // Startpunkt: bevorzugt an einem Notch-Anker, sonst zufällige Kante
    let x;
    let y;
    if (notchAnchors.length && rnd() < 0.7) {
      const aIdx = ri(0, notchAnchors.length - 1);
      x = notchAnchors[aIdx].x;
      y = notchAnchors[aIdx].y;
    } else {
      const a0 = r(0, Math.PI * 2);
      x = cx + Math.cos(a0) * R * 0.95;
      y = cy + Math.sin(a0) * R * 0.95;
    }

    const mainSteps = ri(3, 6);

    const mainNodes = [{ x, y }];
    ctxLocal.strokeStyle = 'rgba(0,0,0,0.45)';
    ctxLocal.lineWidth = clamp(R * 0.035, 0.8, 2.2);
    ctxLocal.beginPath();
    ctxLocal.moveTo(x, y);

    for (let s = 0; s < mainSteps; s++) {
      // Richtung grob zum Zentrum
      let vx = cx - x;
      let vy = cy - y;
      const vd = Math.hypot(vx, vy) || 1;
      vx /= vd;
      vy /= vd;

      // kleiner Zickzack-Winkel links/rechts
      const sign = rnd() < 0.5 ? -1 : 1;
      const zig = r(0.25, 0.65) * sign;
      const ca = Math.cos(zig);
      const sa = Math.sin(zig);
      const zx = vx * ca - vy * sa;
      const zy = vx * sa + vy * ca;

      const stepLen = R * CRACK_LENGTH_FACTOR * r(0.04, 0.09);
      const nx = x + zx * stepLen;
      const ny = y + zy * stepLen;

      const hit = findIntersection(x, y, nx, ny);
      if (hit) {
        ctxLocal.lineTo(hit.x, hit.y);
        addSegment(x, y, hit.x, hit.y);
        mainNodes.push({ x: hit.x, y: hit.y });
        break;
      }

      ctxLocal.lineTo(nx, ny);
      addSegment(x, y, nx, ny);
      x = nx;
      y = ny;
      mainNodes.push({ x, y });
    }
    ctxLocal.stroke();

    // optionale dünnere Verästelung: startet typischerweise im hinteren Drittel
    if (mainNodes.length > 3 && rnd() < 0.6) {
      const startIdxMin = Math.max(1, Math.floor(mainNodes.length * 0.5));
      const startIdxMax = Math.max(startIdxMin + 1, mainNodes.length - 2);
      const idx = ri(startIdxMin, startIdxMax);
      let bx = mainNodes[idx].x;
      let by = mainNodes[idx].y;

      // Richtung grob vom Haupt-Riss weg und weiter ins Steininnere
      let dirx = cx - bx;
      let diry = cy - by;
      const dlen = Math.hypot(dirx, diry) || 1;
      dirx /= dlen;
      diry /= dlen;

      const branchAngle = r(0.5, 1.1) * (rnd() < 0.5 ? -1 : 1);
      const caB = Math.cos(branchAngle);
      const saB = Math.sin(branchAngle);
      const bxDir = dirx * caB - diry * saB;
      const byDir = dirx * saB + diry * caB;

      const branchSteps = ri(2, 4);
      ctxLocal.strokeStyle = 'rgba(0,0,0,0.3)';
      ctxLocal.lineWidth = clamp(R * 0.02, 0.5, 1.4);
      ctxLocal.beginPath();
      ctxLocal.moveTo(bx, by);

      const branchNodes = [{ x: bx, y: by }];
      for (let s = 0; s < branchSteps; s++) {
        const stepLen = R * CRACK_LENGTH_FACTOR * r(0.02, 0.045);
        const nx = bx + bxDir * stepLen;
        const ny = by + byDir * stepLen;

        const hit = findIntersection(bx, by, nx, ny);
        if (hit) {
          ctxLocal.lineTo(hit.x, hit.y);
          addSegment(bx, by, hit.x, hit.y);
          branchNodes.push({ x: hit.x, y: hit.y });
          break;
        }

        ctxLocal.lineTo(nx, ny);
        addSegment(bx, by, nx, ny);
        bx = nx;
        by = ny;
        branchNodes.push({ x: bx, y: by });
      }
      ctxLocal.stroke();

      // sehr kurze, noch dünnere Sub-Verästelung von einem späten Punkt
      if (branchNodes.length > 2 && rnd() < 0.4) {
        const bIdx = ri(
          Math.max(1, Math.floor(branchNodes.length * 0.6)),
          branchNodes.length - 1,
        );
        let sx = branchNodes[bIdx].x;
        let sy = branchNodes[bIdx].y;

        // noch etwas stärker abgedrehte Richtung
        const subAngle = branchAngle + r(0.4, 0.9) * (rnd() < 0.5 ? -1 : 1);
        const caS = Math.cos(subAngle);
        const saS = Math.sin(subAngle);
        const sxDir = dirx * caS - diry * saS;
        const syDir = dirx * saS + diry * caS;

        const subSteps = ri(1, 2);
        ctxLocal.strokeStyle = 'rgba(0,0,0,0.2)';
        ctxLocal.lineWidth = clamp(R * 0.012, 0.4, 1.0);
        ctxLocal.beginPath();
        ctxLocal.moveTo(sx, sy);
        for (let s = 0; s < subSteps; s++) {
          const stepLen = R * CRACK_LENGTH_FACTOR * r(0.015, 0.03);
          const nx = sx + sxDir * stepLen;
          const ny = sy + syDir * stepLen;

          const hit = findIntersection(sx, sy, nx, ny);
          if (hit) {
            ctxLocal.lineTo(hit.x, hit.y);
            addSegment(sx, sy, hit.x, hit.y);
            break;
          }

          ctxLocal.lineTo(nx, ny);
          addSegment(sx, sy, nx, ny);
          sx = nx;
          sy = ny;
        }
        ctxLocal.stroke();
      }
    }
  }

  ctxLocal.restore(); // end clip

  // 6) Outline last
  ctxLocal.lineWidth = outlineW;
  ctxLocal.strokeStyle = outlineCol;
  ctxLocal.lineJoin = 'round';
  ctxLocal.lineCap = 'round';
  pathPoly(ctxLocal, pts);
  ctxLocal.stroke();
  
}

function clearCanvas() {
  if (!canvas || !ctx) return;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = 'rgb(10,12,20)';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
}

function drawScene() {
  if (!canvas || !ctx) return;

  clearCanvas();

  const baseSeed = getSeed();
  const radius = getRadius();
  const baseLight = getLightness();

  // Links: „Felsfeld“ (3x2)
  const cols = 3;
  const rows = 2;
  const spacingX = 96;
  const spacingY = 72;
  const startX = 80;
  const startY = 70;

  const rand = mulberry32(baseSeed);
  const r = (a, b) => a + (b - a) * rand();

  function nextStoneSeed() {
    // erzeugt reproduzierbare 32-bit Seeds aus dem Stream
    return (rand() * 0xffffffff) >>> 0;
  }

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const cx = startX + col * spacingX + r(-8, 8);
      const cy = startY + row * spacingY + r(-6, 6);
      const stoneSeed = nextStoneSeed();
      const l = baseLight + (row - 0.5) * 4;
      const baseCol = `hsl(34, 18%, ${l}%)`;
      drawComicStone(ctx, cx, cy, radius * 0.7, stoneSeed, {
        baseCol,
      });
    }
  }

  // Rechts: Einzel-Fels groß
  const bigCx = canvas.width - 150;
  const bigCy = canvas.height / 2;
  const bigSeed = nextStoneSeed();
  const bigBaseCol = `hsl(34, 18%, ${baseLight}%)`;
  drawComicStone(ctx, bigCx, bigCy, radius, bigSeed, {
    baseCol: bigBaseCol,
  });

  // Labels
  ctx.fillStyle = 'rgba(255,255,255,0.8)';
  ctx.font =
    '11px system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('3×2 Comic-Felsen (Variation)', 18, 26);
  ctx.fillText('Einzelner Comic-Fels', canvas.width - 210, 26);
}

if (redrawBtn) redrawBtn.addEventListener('click', drawScene);
if (seedInput) seedInput.addEventListener('change', drawScene);
if (radiusInput) radiusInput.addEventListener('input', drawScene);
if (lightnessInput) lightnessInput.addEventListener('input', drawScene);

if (canvas && ctx) {
  drawScene();
}

