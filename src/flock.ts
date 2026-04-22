import { Boid } from './boid';
import { SpatialGrid } from './grid';
import type { Pen } from './pen';
import { segmentRepulsion, segmentsCross } from './pen';
import type { Player } from './player';

export interface Obstacle {
  x: number; y: number; r: number;
}

export interface FlockParams {
  perception: number;
  separationRadius: number;
  maxSpeed: number;
  minSpeed: number;
  maxForce: number;
  weightSeparation: number;
  weightAlignment: number;
  weightCohesion: number;
  attractStrength: number;
  attractRadius: number;
  repelStrength: number;
  repelRadius: number;
  wallRadius: number;
  wallStrength: number;
  obstacleStrength: number;
}

export const DEFAULT_PARAMS: FlockParams = {
  perception: 58,
  separationRadius: 20,
  maxSpeed: 195,
  minSpeed: 95,
  maxForce: 620,
  weightSeparation: 1.6,
  weightAlignment: 1.0,
  weightCohesion: 0.85,
  attractStrength: 580,
  attractRadius: 320,
  repelStrength: 950,
  repelRadius: 260,
  wallRadius: 22,
  wallStrength: 1600,
  obstacleStrength: 1400,
};

export class Flock {
  boids: Boid[] = [];
  params: FlockParams;
  grid: SpatialGrid;
  width: number;
  height: number;
  obstacles: Obstacle[] = [];

  private neighborBuf: Boid[] = [];
  private segOut = { fx: 0, fy: 0, dist: 0 };

  constructor(width: number, height: number, params: FlockParams = DEFAULT_PARAMS) {
    this.params = params;
    this.width = width;
    this.height = height;
    this.grid = new SpatialGrid(width, height, params.perception);
  }

  populate(count: number, width: number, height: number): void {
    this.boids.length = 0;
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = this.params.minSpeed + Math.random() * (this.params.maxSpeed - this.params.minSpeed);
      // Seed away from the pen center to avoid starting already penned.
      let x = 0, y = 0, tries = 0;
      do {
        x = Math.random() * width;
        y = Math.random() * height;
        tries++;
      } while (tries < 8 && Math.hypot(x - width * 0.62, y - height * 0.52) < Math.min(width, height) * 0.28);
      this.boids.push(new Boid(x, y, Math.cos(angle) * speed, Math.sin(angle) * speed));
    }
  }

  resize(width: number, height: number): void {
    this.width = width;
    this.height = height;
    this.grid.resize(width, height);
  }

  setCount(target: number): void {
    const excludeR = Math.min(this.width, this.height) * 0.28;
    const excludeX = this.width * 0.62;
    const excludeY = this.height * 0.52;
    while (this.boids.length < target) {
      const angle = Math.random() * Math.PI * 2;
      const speed = this.params.minSpeed + Math.random() * (this.params.maxSpeed - this.params.minSpeed);
      let x = 0, y = 0, tries = 0;
      do {
        x = Math.random() * this.width;
        y = Math.random() * this.height;
        tries++;
      } while (tries < 8 && Math.hypot(x - excludeX, y - excludeY) < excludeR);
      this.boids.push(new Boid(x, y, Math.cos(angle) * speed, Math.sin(angle) * speed));
    }
    if (this.boids.length > target) this.boids.length = target;
  }

  update(dt: number, pen: Pen, player: Player): void {
    const p = this.params;
    const sepRadiusSq = p.separationRadius * p.separationRadius;
    const percRadiusSq = p.perception * p.perception;

    // Rebuild grid each frame.
    this.grid.clear();
    for (let i = 0; i < this.boids.length; i++) this.grid.insert(this.boids[i]);

    const px = player.x, py = player.y;
    const attractActive = player.attract;
    const repelActive = player.repel;
    const attractRadSq = p.attractRadius * p.attractRadius;
    const repelRadSq = p.repelRadius * p.repelRadius;

    for (let i = 0; i < this.boids.length; i++) {
      const b = this.boids[i];

      let sepX = 0, sepY = 0, sepCount = 0;
      let aliX = 0, aliY = 0;
      let cohX = 0, cohY = 0;
      let flockCount = 0;

      this.grid.queryNeighbors(b.x, b.y, this.neighborBuf);
      for (let n = 0; n < this.neighborBuf.length; n++) {
        const other = this.neighborBuf[n];
        if (other === b) continue;
        const dx = b.x - other.x;
        const dy = b.y - other.y;
        const dSq = dx * dx + dy * dy;
        if (dSq > percRadiusSq || dSq < 1e-6) continue;
        flockCount++;
        aliX += other.vx;
        aliY += other.vy;
        cohX += other.x;
        cohY += other.y;
        if (dSq < sepRadiusSq) {
          const inv = 1 / Math.sqrt(dSq);
          sepX += dx * inv;
          sepY += dy * inv;
          sepCount++;
        }
      }

      let ax = 0, ay = 0;

      if (sepCount > 0) {
        sepX /= sepCount;
        sepY /= sepCount;
        const mag = Math.hypot(sepX, sepY);
        if (mag > 0) {
          const desiredX = (sepX / mag) * p.maxSpeed;
          const desiredY = (sepY / mag) * p.maxSpeed;
          ax += (desiredX - b.vx) * p.weightSeparation;
          ay += (desiredY - b.vy) * p.weightSeparation;
        }
      }

      if (flockCount > 0) {
        aliX /= flockCount;
        aliY /= flockCount;
        const aliMag = Math.hypot(aliX, aliY);
        if (aliMag > 0) {
          const desiredX = (aliX / aliMag) * p.maxSpeed;
          const desiredY = (aliY / aliMag) * p.maxSpeed;
          ax += (desiredX - b.vx) * p.weightAlignment;
          ay += (desiredY - b.vy) * p.weightAlignment;
        }

        cohX = cohX / flockCount - b.x;
        cohY = cohY / flockCount - b.y;
        const cohMag = Math.hypot(cohX, cohY);
        if (cohMag > 0) {
          const desiredX = (cohX / cohMag) * p.maxSpeed;
          const desiredY = (cohY / cohMag) * p.maxSpeed;
          ax += (desiredX - b.vx) * p.weightCohesion;
          ay += (desiredY - b.vy) * p.weightCohesion;
        }
      }

      // Player forces
      if (player.visible && (attractActive || repelActive)) {
        const dx = px - b.x;
        const dy = py - b.y;
        const dSq = dx * dx + dy * dy;
        if (attractActive && dSq < attractRadSq && dSq > 1e-3) {
          const d = Math.sqrt(dSq);
          const falloff = 1 - d / p.attractRadius;
          ax += (dx / d) * p.attractStrength * falloff;
          ay += (dy / d) * p.attractStrength * falloff;
        }
        if (repelActive && dSq < repelRadSq && dSq > 1e-3) {
          const d = Math.sqrt(dSq);
          const falloff = 1 - d / p.repelRadius;
          ax -= (dx / d) * p.repelStrength * falloff;
          ay -= (dy / d) * p.repelStrength * falloff;
        }
      }

      // Wall repulsion
      for (let w = 0; w < pen.walls.length; w++) {
        const wall = pen.walls[w];
        segmentRepulsion(b.x, b.y, wall.ax, wall.ay, wall.bx, wall.by, p.wallRadius, this.segOut);
        if (this.segOut.dist < p.wallRadius && this.segOut.dist > 0) {
          ax += this.segOut.fx * p.wallStrength;
          ay += this.segOut.fy * p.wallStrength;
        }
      }

      // Obstacle repulsion
      for (let o = 0; o < this.obstacles.length; o++) {
        const obs = this.obstacles[o];
        const dx = b.x - obs.x;
        const dy = b.y - obs.y;
        const influence = obs.r + 24;
        const dSq = dx * dx + dy * dy;
        if (dSq < influence * influence && dSq > 1e-3) {
          const d = Math.sqrt(dSq);
          const falloff = 1 - d / influence;
          ax += (dx / d) * p.obstacleStrength * falloff;
          ay += (dy / d) * p.obstacleStrength * falloff;
        }
      }

      // Clamp force
      const accMag = Math.hypot(ax, ay);
      if (accMag > p.maxForce) {
        const s = p.maxForce / accMag;
        ax *= s;
        ay *= s;
      }

      b.ax = ax;
      b.ay = ay;
    }

    // Integrate + collision handling
    for (let i = 0; i < this.boids.length; i++) {
      const b = this.boids[i];
      b.vx += b.ax * dt;
      b.vy += b.ay * dt;

      const speed = Math.hypot(b.vx, b.vy);
      if (speed > p.maxSpeed) {
        const s = p.maxSpeed / speed;
        b.vx *= s;
        b.vy *= s;
      } else if (speed < p.minSpeed && speed > 1e-4) {
        const s = p.minSpeed / speed;
        b.vx *= s;
        b.vy *= s;
      }

      const prevX = b.x;
      const prevY = b.y;
      let nx = b.x + b.vx * dt;
      let ny = b.y + b.vy * dt;

      // Reflect if the step would cross a wall (fallback for fast boids punching through repulsion).
      for (let w = 0; w < pen.walls.length; w++) {
        const wall = pen.walls[w];
        if (segmentsCross(prevX, prevY, nx, ny, wall.ax, wall.ay, wall.bx, wall.by)) {
          const wx = wall.bx - wall.ax;
          const wy = wall.by - wall.ay;
          const wLen = Math.hypot(wx, wy);
          if (wLen > 0) {
            const nwx = -wy / wLen;
            const nwy = wx / wLen;
            const vDotN = b.vx * nwx + b.vy * nwy;
            b.vx -= 2 * vDotN * nwx;
            b.vy -= 2 * vDotN * nwy;
            // Dampen slightly and revert the step.
            b.vx *= 0.85;
            b.vy *= 0.85;
            nx = prevX + b.vx * dt;
            ny = prevY + b.vy * dt;
            break;
          }
        }
      }

      // Edge wrap
      if (nx < 0) nx += this.width;
      else if (nx >= this.width) nx -= this.width;
      if (ny < 0) ny += this.height;
      else if (ny >= this.height) ny -= this.height;

      b.x = nx;
      b.y = ny;
    }
  }

  draw(ctx: CanvasRenderingContext2D): void {
    ctx.fillStyle = '#fff';
    const size = 3.2;
    const backSpread = 1.6;
    ctx.beginPath();
    for (let i = 0; i < this.boids.length; i++) {
      const b = this.boids[i];
      const speed = Math.hypot(b.vx, b.vy);
      let dx = 1, dy = 0;
      if (speed > 1e-4) { dx = b.vx / speed; dy = b.vy / speed; }
      const nxp = -dy, nyp = dx;
      const tipX = b.x + dx * size * 1.8;
      const tipY = b.y + dy * size * 1.8;
      const leftX = b.x - dx * size * 0.6 + nxp * backSpread;
      const leftY = b.y - dy * size * 0.6 + nyp * backSpread;
      const rightX = b.x - dx * size * 0.6 - nxp * backSpread;
      const rightY = b.y - dy * size * 0.6 - nyp * backSpread;
      ctx.moveTo(tipX, tipY);
      ctx.lineTo(leftX, leftY);
      ctx.lineTo(rightX, rightY);
      ctx.closePath();
    }
    ctx.fill();
  }

  countInside(pen: Pen): number {
    let count = 0;
    for (let i = 0; i < this.boids.length; i++) {
      if (pen.contains(this.boids[i].x, this.boids[i].y)) count++;
    }
    return count;
  }
}
