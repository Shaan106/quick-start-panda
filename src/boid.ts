export class Boid {
  x: number;
  y: number;
  vx: number;
  vy: number;
  ax: number = 0;
  ay: number = 0;

  constructor(x: number, y: number, vx: number = 0, vy: number = 0) {
    this.x = x;
    this.y = y;
    this.vx = vx;
    this.vy = vy;
  }
}
