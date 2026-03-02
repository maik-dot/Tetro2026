const BAG_TYPES = ['I', 'O', 'T', 'S', 'Z', 'J', 'L'];

function shuffle(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

export class BagRandomizer {
  constructor() {
    this.queue = [];
  }

  refill() {
    const bag = shuffle(BAG_TYPES.slice());
    this.queue.push(...bag);
  }

  next() {
    if (this.queue.length === 0) {
      this.refill();
    }
    return this.queue.shift();
  }
}

