const canvas = document.getElementById('shadingCanvas');
/** @type {CanvasRenderingContext2D | null} */
const ctx = canvas ? canvas.getContext('2d') : null;

const modeSelect = document.getElementById('shadingMode');
const materialSelect = document.getElementById('shadingMaterial');
const intensityInput = document.getElementById('shadingIntensity');

const BLOCK_SIZE = 48;
const PADDING = 12;

const MATERIAL_COLORS = {
  wood: { r: 180, g: 120, b: 60 },
  stone: { r: 150, g: 150, b: 160 },
  metal: { r: 190, g: 200, b: 210 },
  glass: { r: 170, g: 210, b: 230 },
  grass: { r: 140, g: 190, b: 70 },
  slime: { r: 80, g: 210, b: 130 },
  default: { r: 180, g: 180, b: 180 },
};

const textureImages = new Map();

function getCurrentMode() {
  return modeSelect?.value || 'texture';
}

function getCurrentMaterial() {
  return materialSelect?.value || 'grass';
}

function getIntensity() {
  if (!intensityInput) return 0.65;
  const v = Number(intensityInput.value) || 0;
  return Math.min(1, Math.max(0, v / 100));
}

function loadTexture(materialId) {
  if (textureImages.has(materialId)) return textureImages.get(materialId);
  const img = new Image();
  // Wir nehmen die erste Variante, falls vorhanden; ansonsten wird einfach nichts gezeichnet.
  const url = new URL(`../assets/blocks/${materialId}_01.png`, import.meta.url).href;
  img.src = url;
  img.decoding = 'async';
  img.onload = () => {
    drawScene();
  };
  img.onerror = () => {
    // Wenn die Datei nicht existiert, rendern wir einfach nur prozedural.
  };
  textureImages.set(materialId, img);
  return img;
}

function roundRect(ctx, x, y, w, h, r) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + w - radius, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
  ctx.lineTo(x + w, y + h - radius);
  ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
  ctx.lineTo(x + radius, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

function clamp01(v) {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function colorToCss({ r, g, b }, mul = 1, add = 0) {
  const rr = Math.round(clamp01(r / 255 * mul + add) * 255);
  const gg = Math.round(clamp01(g / 255 * mul + add) * 255);
  const bb = Math.round(clamp01(b / 255 * mul + add) * 255);
  return `rgb(${rr},${gg},${bb})`;
}

function drawTextureBlock(x, y, size, material) {
  if (!ctx) return;
  const baseColor = MATERIAL_COLORS[material] || MATERIAL_COLORS.default;
  const radius = Math.floor(size * 0.22);

  const img = loadTexture(material);
  ctx.save();

  roundRect(ctx, x + 1, y + 1, size - 2, size - 2, radius);
  ctx.clip();

  if (img && img.complete && img.naturalWidth > 0) {
    ctx.drawImage(img, x + 1, y + 1, size - 2, size - 2);
  } else {
    // Fallback: einfacher Farbverlauf
    const g = ctx.createLinearGradient(x, y, x, y + size);
    g.addColorStop(0, colorToCss(baseColor, 1.1, 0.1));
    g.addColorStop(0.6, colorToCss(baseColor, 1.0, 0.0));
    g.addColorStop(1, colorToCss(baseColor, 0.8, -0.05));
    ctx.fillStyle = g;
    ctx.fillRect(x + 1, y + 1, size - 2, size - 2);
  }

  ctx.restore();

  // Rahmen
  ctx.lineWidth = 1;
  ctx.strokeStyle = 'rgba(0,0,0,0.55)';
  roundRect(ctx, x + 1, y + 1, size - 2, size - 2, radius);
  ctx.stroke();

  // Glas-Overlay (ähnlich wie im eigentlichen Renderer)
  drawGlassOverlay(x, y, size);
}

function drawGlassOverlay(x, y, size) {
  if (!ctx) return;
  const r = Math.floor(size * 0.22);
  ctx.save();
  roundRect(ctx, x + 1, y + 1, size - 2, size - 2, r);
  ctx.clip();

  let grad = ctx.createLinearGradient(x, y + 1, x, y + size * 0.55);
  grad.addColorStop(0, 'rgba(255,255,255,0.35)');
  grad.addColorStop(0.4, 'rgba(255,255,255,0.18)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = grad;
  ctx.fillRect(x + 1, y + 1, size - 2, size * 0.55);

  grad = ctx.createLinearGradient(x + 1, y + 1, x + size * 0.45, y + size - 2);
  grad.addColorStop(0, 'rgba(255,255,255,0.18)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = grad;
  ctx.fillRect(x + 1, y + 1, size * 0.45, size - 2);

  ctx.restore();
}

function drawProceduralBlock(x, y, size, material, intensity) {
  if (!ctx) return;
  const base = MATERIAL_COLORS[material] || MATERIAL_COLORS.default;
  const radius = Math.floor(size * 0.22);
  const i = clamp01(intensity);

  // Grundkörper mit „Licht von links oben“
  const grad = ctx.createLinearGradient(x, y, x, y + size);
  grad.addColorStop(0, colorToCss(base, lerp(1.0, 1.25, i), 0.05 * i));
  grad.addColorStop(0.5, colorToCss(base, 1.0, 0.0));
  grad.addColorStop(1, colorToCss(base, lerp(0.9, 0.65, i), -0.05 * i));

  ctx.save();
  roundRect(ctx, x + 1, y + 1, size - 2, size - 2, radius);
  ctx.clip();
  ctx.fillStyle = grad;
  ctx.fillRect(x + 1, y + 1, size - 2, size - 2);

  // Ambient Occlusion-Ecke unten rechts
  const ao = ctx.createLinearGradient(
    x + size * 0.35,
    y + size * 0.4,
    x + size - 2,
    y + size - 2,
  );
  ao.addColorStop(0, 'rgba(0,0,0,0)');
  ao.addColorStop(1, `rgba(0,0,0,${0.35 * i})`);
  ctx.fillStyle = ao;
  ctx.fillRect(x + 1, y + 1, size - 2, size - 2);

  // leichtes Noise-Banding horizontal, um Oberfläche „unruhiger“ zu machen
  const bandCount = 6;
  const bandAlpha = 0.08 * i;
  for (let b = 0; b < bandCount; b++) {
    const yy = y + 2 + ((size - 4) / bandCount) * b;
    ctx.fillStyle = `rgba(255,255,255,${bandAlpha * (Math.random() * 0.6 + 0.4)})`;
    ctx.fillRect(x + 2, yy, size - 4, 1);
  }

  ctx.restore();

  // Kanten: heller oben/links, dunkler unten/rechts
  const edgeLight = `rgba(255,255,255,${0.5 * i})`;
  const edgeDark = `rgba(0,0,0,${0.45 * i})`;

  ctx.save();
  ctx.lineWidth = 1;

  // Oben
  ctx.strokeStyle = edgeLight;
  ctx.beginPath();
  ctx.moveTo(x + 2, y + 1.5);
  ctx.lineTo(x + size - 2, y + 1.5);
  ctx.stroke();

  // Links
  ctx.beginPath();
  ctx.moveTo(x + 1.5, y + 2);
  ctx.lineTo(x + 1.5, y + size - 2);
  ctx.stroke();

  // Unten
  ctx.strokeStyle = edgeDark;
  ctx.beginPath();
  ctx.moveTo(x + 2, y + size - 1.5);
  ctx.lineTo(x + size - 2, y + size - 1.5);
  ctx.stroke();

  // Rechts
  ctx.beginPath();
  ctx.moveTo(x + size - 1.5, y + 2);
  ctx.lineTo(x + size - 1.5, y + size - 2);
  ctx.stroke();

  ctx.restore();

  // Glas-Overlay als rein visueller Effekt (nicht rotiert)
  drawGlassOverlay(x, y, size);
}

function clear() {
  if (!ctx || !canvas) return;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  // Hintergrund leicht abdunkeln, damit Glanz besser wirkt
  ctx.fillStyle = 'rgb(10,12,20)';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Raster wie im Spiel
  ctx.strokeStyle = 'rgba(255,255,255,0.04)';
  ctx.lineWidth = 1;
  const grid = 24;
  for (let x = 0; x < canvas.width; x += grid) {
    ctx.beginPath();
    ctx.moveTo(x + 0.5, 0);
    ctx.lineTo(x + 0.5, canvas.height);
    ctx.stroke();
  }
  for (let y = 0; y < canvas.height; y += grid) {
    ctx.beginPath();
    ctx.moveTo(0, y + 0.5);
    ctx.lineTo(canvas.width, y + 0.5);
    ctx.stroke();
  }
}

function drawGridTexture(material) {
  if (!ctx) return;
  const cols = 4;
  const rows = 2;
  const totalWidth = cols * BLOCK_SIZE + (cols - 1) * PADDING;
  const totalHeight = rows * BLOCK_SIZE + (rows - 1) * PADDING;
  const startX = Math.floor((canvas.width - totalWidth) / 2);
  const startY = Math.floor((canvas.height - totalHeight) / 2);

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const x = startX + c * (BLOCK_SIZE + PADDING);
      const y = startY + r * (BLOCK_SIZE + PADDING);
      drawTextureBlock(x, y, BLOCK_SIZE, material);
    }
  }
}

function drawGridProcedural(material, intensity) {
  if (!ctx) return;
  const cols = 4;
  const rows = 2;
  const totalWidth = cols * BLOCK_SIZE + (cols - 1) * PADDING;
  const totalHeight = rows * BLOCK_SIZE + (rows - 1) * PADDING;
  const startX = Math.floor((canvas.width - totalWidth) / 2);
  const startY = Math.floor((canvas.height - totalHeight) / 2);

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const x = startX + c * (BLOCK_SIZE + PADDING);
      const y = startY + r * (BLOCK_SIZE + PADDING);
      drawProceduralBlock(x, y, BLOCK_SIZE, material, intensity);
    }
  }
}

function drawGridCompare(material, intensity) {
  if (!ctx) return;
  const cols = 4;
  const rows = 2;
  const gap = 32;

  const totalWidth =
    2 * (cols * BLOCK_SIZE + (cols - 1) * PADDING) + gap;
  const totalHeight = rows * BLOCK_SIZE + (rows - 1) * PADDING;

  const startX = Math.floor((canvas.width - totalWidth) / 2);
  const startY = Math.floor((canvas.height - totalHeight) / 2);

  // Linke Hälfte: Textur
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const x = startX + c * (BLOCK_SIZE + PADDING);
      const y = startY + r * (BLOCK_SIZE + PADDING);
      drawTextureBlock(x, y, BLOCK_SIZE, material);
    }
  }

  // Rechte Hälfte: prozedural
  const startXRight =
    startX + (cols * BLOCK_SIZE + (cols - 1) * PADDING) + gap;

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const x = startXRight + c * (BLOCK_SIZE + PADDING);
      const y = startY + r * (BLOCK_SIZE + PADDING);
      drawProceduralBlock(x, y, BLOCK_SIZE, material, intensity);
    }
  }

  // Kleine Beschriftung
  ctx.fillStyle = 'rgba(255,255,255,0.7)';
  ctx.font = '11px system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(
    'Textur + Glas',
    startX + (cols * BLOCK_SIZE + (cols - 1) * PADDING) / 2,
    startY - 10,
  );
  ctx.fillText(
    'Prozedural',
    startXRight + (cols * BLOCK_SIZE + (cols - 1) * PADDING) / 2,
    startY - 10,
  );
}

function drawScene() {
  if (!ctx || !canvas) return;
  clear();
  const mode = getCurrentMode();
  const material = getCurrentMaterial();
  const intensity = getIntensity();

  if (mode === 'procedural') {
    drawGridProcedural(material, intensity);
  } else if (mode === 'compare') {
    drawGridCompare(material, intensity);
  } else {
    drawGridTexture(material);
  }
}

if (modeSelect) modeSelect.addEventListener('change', drawScene);
if (materialSelect) materialSelect.addEventListener('change', drawScene);
if (intensityInput) intensityInput.addEventListener('input', drawScene);

if (canvas && ctx) {
  drawScene();
}

