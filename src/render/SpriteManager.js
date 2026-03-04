import {
  generateGrassDirtVariants,
  GRASS_DIRT_TEXTURE_SIZE,
  GRASS_DIRT_PAD,
} from './GrassDirtTexture.js';

export class SpriteManager {
  constructor(basePath = 'assets/blocks/') {
    this.basePath = basePath.replace(/\/?$/, '/');
    this.images = new Map();
    // Liste verfügbarer Block-Varianten pro Material (Sprite-Keys)
    this.blockVariants = new Map();
  }

  async _loadSprite(key, filename) {
    const src = this.basePath + filename;
    if (this.images.has(key)) return;
    await new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        this.images.set(key, img);
        resolve();
      };
      img.onerror = () => resolve();
      img.src = src;
    });
  }

  async loadBlockSprites(materials) {
    const entries = Object.values(materials ?? {});
    const tasks = [];
    const MAX_VARIANTS = 99;
    for (const mat of entries) {
      const id = mat.id || mat;
      tasks.push(
        (async () => {
          const variants = [];

          // Spezieller Pfad für prozedurale Gras-Blöcke:
          // Wir erzeugen 12 Varianten als Canvas-Texturen und speichern sie
          // im Sprite-Cache. Diese werden wie normale Sprites verwendet.
          if (id === 'grass') {
            const COUNT = 12;
            const SIZE = GRASS_DIRT_TEXTURE_SIZE;
            const BASE_SEED = 1337;
            const baseCanvases = generateGrassDirtVariants(COUNT, SIZE, BASE_SEED);

            // Die Playground-Variante enthält einen äußeren transparenten Rand
            // (pad + Rahmen). Für das Spiel croppen wir diesen Bereich weg,
            // so dass die Textur den Block vollständig ausfüllt.
            const pad = GRASS_DIRT_PAD;
            const srcSize = SIZE;
            const cropSize = srcSize - pad * 2;

            baseCanvases.forEach((srcCanvas, index) => {
              const tile = document.createElement('canvas');
              tile.width = SIZE;
              tile.height = SIZE;
              const gctx = tile.getContext('2d');
              if (gctx) {
                gctx.drawImage(
                  srcCanvas,
                  pad,
                  pad,
                  cropSize,
                  cropSize,
                  0,
                  0,
                  SIZE,
                  SIZE,
                );
              }

              const suffix = String(index + 1).padStart(2, '0');
              const key = `${id}_proc_${suffix}`;
              this.images.set(key, tile);
              variants.push(key);
            });

            this.blockVariants.set(id, variants);
            return;
          }

          // Basis-Sprite pro Material: wood.png, glass.png, ...
          await this._loadSprite(id, `${id}.png`);
          if (this.images.has(id)) {
            variants.push(id);
          }

          // Zusätzliche Texturvarianten im Schema material_XX.png
          for (let i = 1; i <= MAX_VARIANTS; i++) {
            const suffix = String(i).padStart(2, '0');
            const key = `${id}_${suffix}`;
            await this._loadSprite(key, `${key}.png`);
            if (this.images.has(key)) {
              variants.push(key);
            } else {
              // Wir gehen von inkrementeller Anlage aus → bei erster Lücke abbrechen.
              break;
            }
          }

          this.blockVariants.set(id, variants);
        })(),
      );
    }
    await Promise.all(tasks);
  }

  /**
   * Liefert ein Sprite für einen Block eines Materials.
   * Wenn mehrere Varianten vorhanden sind, wird anhand eines Seeds
   * deterministisch eine Variante gewählt. Ohne Seed wird zufällig gewählt.
   */
  getVariantSprite(materialId, seed = null) {
    const list = this.blockVariants.get(materialId);
    if (!list || !list.length) {
      const img = this.images.get(materialId);
      return img ?? null;
    }
    let index;
    if (seed == null) {
      index = Math.floor(Math.random() * list.length);
    } else {
      // Einfache deterministische Hash-Funktion auf Basis des Seeds
      let n = seed | 0;
      n = (n ^ (n << 13)) | 0;
      n = (n ^ (n >>> 17)) | 0;
      n = (n ^ (n << 5)) | 0;
      index = Math.abs(n) % list.length;
    }
    const key = list[index];
    return this.images.get(key) || null;
  }

  getSprite(key) {
    return this.images.get(key) || null;
  }
}

