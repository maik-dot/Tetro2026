import { StateMachine } from './StateMachine.js';
import { StandardMode } from '../modes/StandardMode.js';
import { CanvasContext } from '../render/CanvasContext.js';

export class GameCore {
  constructor(canvas, audioManager, spriteManager) {
    this.canvasContext = new CanvasContext(canvas);
    this.stateMachine = new StateMachine();
    this.lastTime = 0;
    this.running = false;

    const standardMode = new StandardMode(this.canvasContext, audioManager, spriteManager);
    this.stateMachine.register('standard', standardMode);
    this.stateMachine.change('standard');
  }

  start() {
    this.running = true;
    this.lastTime = performance.now();
    requestAnimationFrame(this.loop.bind(this));
  }

  loop(timestamp) {
    if (!this.running) return;
    const dt = timestamp - this.lastTime;
    this.lastTime = timestamp;

    this.update(dt);
    this.render();

    requestAnimationFrame(this.loop.bind(this));
  }

  update(dt) {
    this.stateMachine.update(dt);
  }

  render() {
    const ctx = this.canvasContext;
    ctx.clear();
    this.stateMachine.render(ctx);
  }
}

