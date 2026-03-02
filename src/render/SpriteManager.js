export class SpriteManager {
  constructor(basePath = 'assets/blocks/') {
    this.basePath = basePath.replace(/\/?$/, '/');
    this.images = new Map();
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
    for (const mat of entries) {
      const id = mat.id || mat;
      // Basis-Sprite pro Material: wood.png, glass.png, ...
      tasks.push(this._loadSprite(id, `${id}.png`));
      const maxHp = mat.maxHp ?? 1;
      for (let hp = 1; hp <= maxHp; hp++) {
        const key = `${id}_hp${hp}`;
        tasks.push(this._loadSprite(key, `${key}.png`));
      }
    }
    await Promise.all(tasks);
  }

  getSprite(key) {
    return this.images.get(key) || null;
  }
}

