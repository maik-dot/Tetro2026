export class Piece {
  constructor(type, rotations, colorId) {
    this.type = type;
    this.rotations = rotations;
    this.colorId = colorId;
    this.materialId = 'wood';
    this.rotationIndex = 0;
    this.x = 3;
    this.y = 0;
  }

  clone() {
    const p = new Piece(this.type, this.rotations, this.colorId);
    p.materialId = this.materialId;
    p.rotationIndex = this.rotationIndex;
    p.x = this.x;
    p.y = this.y;
    return p;
  }

  get shape() {
    return this.rotations[this.rotationIndex];
  }

  getBlocks(rotationIndex = this.rotationIndex) {
    const shape = this.rotations[rotationIndex];
    const blocks = [];
    for (let y = 0; y < shape.length; y++) {
      for (let x = 0; x < shape[y].length; x++) {
        if (shape[y][x]) {
          blocks.push({ x, y });
        }
      }
    }
    return blocks;
  }

  rotateCW() {
    this.rotationIndex = (this.rotationIndex + 1) % this.rotations.length;
  }

  rotateCCW() {
    this.rotationIndex = (this.rotationIndex + this.rotations.length - 1) % this.rotations.length;
  }
}

