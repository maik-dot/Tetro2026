export class CanvasContext {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.width = canvas.width;
    this.height = canvas.height;
  }

  clear() {
    this.ctx.clearRect(0, 0, this.width, this.height);
  }
}

