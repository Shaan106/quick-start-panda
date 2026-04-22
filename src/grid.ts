import type { Boid } from './boid';

export class SpatialGrid {
  cellSize: number;
  cols: number;
  rows: number;
  private cells: Boid[][];

  constructor(width: number, height: number, cellSize: number) {
    this.cellSize = cellSize;
    this.cols = Math.max(1, Math.ceil(width / cellSize));
    this.rows = Math.max(1, Math.ceil(height / cellSize));
    this.cells = new Array(this.cols * this.rows);
    for (let i = 0; i < this.cells.length; i++) this.cells[i] = [];
  }

  resize(width: number, height: number): void {
    this.cols = Math.max(1, Math.ceil(width / this.cellSize));
    this.rows = Math.max(1, Math.ceil(height / this.cellSize));
    this.cells = new Array(this.cols * this.rows);
    for (let i = 0; i < this.cells.length; i++) this.cells[i] = [];
  }

  clear(): void {
    for (let i = 0; i < this.cells.length; i++) this.cells[i].length = 0;
  }

  insert(boid: Boid): void {
    const c = Math.max(0, Math.min(this.cols - 1, (boid.x / this.cellSize) | 0));
    const r = Math.max(0, Math.min(this.rows - 1, (boid.y / this.cellSize) | 0));
    this.cells[r * this.cols + c].push(boid);
  }

  queryNeighbors(x: number, y: number, out: Boid[]): void {
    out.length = 0;
    const cCenter = (x / this.cellSize) | 0;
    const rCenter = (y / this.cellSize) | 0;
    const cMin = Math.max(0, cCenter - 1);
    const cMax = Math.min(this.cols - 1, cCenter + 1);
    const rMin = Math.max(0, rCenter - 1);
    const rMax = Math.min(this.rows - 1, rCenter + 1);
    for (let r = rMin; r <= rMax; r++) {
      const base = r * this.cols;
      for (let c = cMin; c <= cMax; c++) {
        const cell = this.cells[base + c];
        for (let i = 0; i < cell.length; i++) out.push(cell[i]);
      }
    }
  }
}
