import { BOARD_WIDTH, BOARD_HEIGHT } from '../config/gameConfig.js';
import { getMaterialSkin } from './MaterialSkins.js';

export class BlockRenderer {
  constructor(spriteManager = null) {
    this.spriteManager = spriteManager;
    this.colors = [
      '#35c9ff',
      '#ffe66d',
      '#b388ff',
      '#7bed9f',
      '#ff6b81',
      '#70a1ff',
      '#ffa502',
    ];
  }

  computeCellSize(canvasContext) {
    const { width, height } = canvasContext;
    const cellSize = Math.floor(Math.min(width / BOARD_WIDTH, height / BOARD_HEIGHT));
    const offsetX = Math.floor((width - cellSize * BOARD_WIDTH) / 2);
    const offsetY = Math.floor((height - cellSize * BOARD_HEIGHT) / 2);
    return { cellSize, offsetX, offsetY };
  }

  drawBlock(ctx, x, y, opts, cellSize, offsetX, offsetY) {
    const { colorId = 0, materialId = 'wood', hp = 1, maxHp = 1 } = opts ?? {};
    const px = offsetX + x * cellSize;
    const py = offsetY + y * cellSize;
    const radius = Math.floor(cellSize * 0.22);
    const pieceColor = this.colors[colorId % this.colors.length] || '#ffffff';
    const skin = getMaterialSkin(materialId);
    const hpRatio = Math.max(0, Math.min(1, maxHp ? hp / maxHp : 1));

    // 1) Sprite-Rendering, falls vorhanden
    const spriteKey = `${materialId}_hp${hp}`;
    let img = this.spriteManager?.getSprite(spriteKey);
    if (!img) {
      img = this.spriteManager?.getSprite(materialId);
    }

    if (img) {
      ctx.save();
      this.roundRect(ctx, px + 1, py + 1, cellSize - 2, cellSize - 2, radius);
      ctx.clip();
      ctx.drawImage(img, px + 1, py + 1, cellSize - 2, cellSize - 2);
      ctx.restore();
      ctx.lineWidth = 1;
      ctx.strokeStyle = skin.shadow;
      ctx.stroke();
      this.drawDamageOverlay(ctx, px, py, cellSize, hpRatio);
      return;
    }

    // 2) Fallback: bisheriger Gradient-Renderer
    const base = this.mix(pieceColor, skin.base, materialId === 'glass' ? 0.55 : 0.7);
    const gradient = ctx.createLinearGradient(px, py, px, py + cellSize);
    gradient.addColorStop(0, this.lighten(base, 0.22));
    gradient.addColorStop(0.45, base);
    gradient.addColorStop(1, this.darken(base, 0.28));

    this.roundRect(ctx, px + 1, py + 1, cellSize - 2, cellSize - 2, radius);
    ctx.fillStyle = gradient;
    ctx.fill();

    ctx.lineWidth = 1;
    ctx.strokeStyle = skin.shadow;
    ctx.stroke();

    this.drawMaterialDetails(ctx, px, py, cellSize, materialId, base);
    this.drawDamageOverlay(ctx, px, py, cellSize, hpRatio);

    ctx.beginPath();
    ctx.moveTo(px + 3, py + 4);
    ctx.lineTo(px + cellSize - 4, py + 4);
    ctx.strokeStyle = skin.highlight;
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  drawMaterialDetails(ctx, px, py, cellSize, materialId, base) {
    if (materialId === 'glass') {
      ctx.save();
      ctx.globalAlpha = 0.22;
      const g = ctx.createLinearGradient(px, py, px + cellSize, py + cellSize);
      g.addColorStop(0, '#ffffff');
      g.addColorStop(1, base);
      ctx.fillStyle = g;
      ctx.fillRect(px + 2, py + 2, cellSize - 4, cellSize - 4);
      ctx.restore();
      return;
    }

    if (materialId === 'wood') {
      ctx.save();
      ctx.globalAlpha = 0.25;
      ctx.strokeStyle = this.darken(base, 0.35);
      ctx.lineWidth = 1;
      for (let i = 0; i < 3; i++) {
        const y = py + 6 + i * Math.floor((cellSize - 12) / 2);
        ctx.beginPath();
        ctx.moveTo(px + 4, y);
        ctx.lineTo(px + cellSize - 5, y + 2);
        ctx.stroke();
      }
      ctx.restore();
      return;
    }

    if (materialId === 'stone') {
      ctx.save();
      ctx.globalAlpha = 0.22;
      ctx.fillStyle = this.lighten(base, 0.18);
      for (let i = 0; i < 4; i++) {
        const rx = px + 6 + ((i * 11) % (cellSize - 12));
        const ry = py + 6 + ((i * 7) % (cellSize - 12));
        ctx.fillRect(rx, ry, 2, 2);
      }
      ctx.restore();
      return;
    }

    if (materialId === 'metal') {
      ctx.save();
      ctx.globalAlpha = 0.25;
      ctx.strokeStyle = this.lighten(base, 0.25);
      ctx.lineWidth = 1;
      const x = px + Math.floor(cellSize * 0.55);
      ctx.beginPath();
      ctx.moveTo(x, py + 3);
      ctx.lineTo(x, py + cellSize - 4);
      ctx.stroke();
      ctx.restore();
    }
  }

  drawDamageOverlay(ctx, px, py, cellSize, hpRatio) {
    if (hpRatio >= 1) return;
    const severity = 1 - hpRatio;
    ctx.save();
    ctx.globalAlpha = Math.min(0.65, 0.15 + severity * 0.6);
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(px + 5, py + Math.floor(cellSize * 0.35));
    ctx.lineTo(px + Math.floor(cellSize * 0.55), py + Math.floor(cellSize * 0.55));
    ctx.lineTo(px + Math.floor(cellSize * 0.8), py + Math.floor(cellSize * 0.3));
    ctx.stroke();
    if (severity > 0.55) {
      ctx.globalAlpha = Math.min(0.8, 0.25 + severity * 0.65);
      ctx.strokeStyle = 'rgba(0,0,0,0.35)';
      ctx.beginPath();
      ctx.moveTo(px + Math.floor(cellSize * 0.25), py + Math.floor(cellSize * 0.75));
      ctx.lineTo(px + Math.floor(cellSize * 0.75), py + Math.floor(cellSize * 0.6));
      ctx.stroke();
    }
    ctx.restore();
  }

  roundRect(ctx, x, y, w, h, r) {
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

  lighten(color, amount) {
    return this.adjust(color, amount);
  }

  darken(color, amount) {
    return this.adjust(color, -amount);
  }

  adjust(color, amount) {
    const num = parseInt(color.replace('#', ''), 16);
    let r = (num >> 16) & 0xff;
    let g = (num >> 8) & 0xff;
    let b = num & 0xff;

    r = Math.round(Math.min(255, Math.max(0, r + 255 * amount)));
    g = Math.round(Math.min(255, Math.max(0, g + 255 * amount)));
    b = Math.round(Math.min(255, Math.max(0, b + 255 * amount)));

    const toHex = (v) => Math.round(v).toString(16).padStart(2, '0');
    return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
  }

  mix(a, b, t) {
    const ca = this.hexToRgb(a);
    const cb = this.hexToRgb(b);
    const r = Math.round(ca.r + (cb.r - ca.r) * t);
    const g = Math.round(ca.g + (cb.g - ca.g) * t);
    const bl = Math.round(ca.b + (cb.b - ca.b) * t);
    return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${bl.toString(16).padStart(2, '0')}`;
  }

  hexToRgb(hex) {
    const n = parseInt(hex.replace('#', ''), 16);
    return { r: (n >> 16) & 0xff, g: (n >> 8) & 0xff, b: n & 0xff };
  }
}

