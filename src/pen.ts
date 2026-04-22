export interface Segment {
  ax: number; ay: number;
  bx: number; by: number;
}

export class Pen {
  vertices: Array<{ x: number; y: number }> = [];
  walls: Segment[] = [];
  private width = 0;
  private height = 0;

  constructor(width: number, height: number) {
    this.rebuild(width, height);
  }

  rebuild(width: number, height: number): void {
    this.width = width;
    this.height = height;
    // Irregular heptagon, center-ish but nudged off-center so it doesn't read trivially.
    const norm = [
      [0.54, 0.30],
      [0.78, 0.34],
      [0.86, 0.54],
      [0.75, 0.74],
      [0.50, 0.76],
      [0.38, 0.60],
      [0.44, 0.38],
    ];
    this.vertices = norm.map(([nx, ny]) => ({ x: nx * width, y: ny * height }));

    // Openings: edge indices to skip. Two openings on non-adjacent sides.
    // Edge i goes from vertices[i] → vertices[(i+1) % N].
    const openings = new Set<number>([1, 4]); // right-side + lower-left
    this.walls = [];
    const n = this.vertices.length;
    for (let i = 0; i < n; i++) {
      if (openings.has(i)) continue;
      const a = this.vertices[i];
      const b = this.vertices[(i + 1) % n];
      this.walls.push({ ax: a.x, ay: a.y, bx: b.x, by: b.y });
    }
  }

  contains(px: number, py: number): boolean {
    // Ray casting point-in-polygon using the full closed outline (openings ignored for containment).
    const verts = this.vertices;
    let inside = false;
    for (let i = 0, j = verts.length - 1; i < verts.length; j = i++) {
      const xi = verts[i].x, yi = verts[i].y;
      const xj = verts[j].x, yj = verts[j].y;
      const intersect = (yi > py) !== (yj > py) &&
        px < ((xj - xi) * (py - yi)) / (yj - yi + 1e-12) + xi;
      if (intersect) inside = !inside;
    }
    return inside;
  }

  drawOutline(ctx: CanvasRenderingContext2D): void {
    ctx.save();
    ctx.strokeStyle = 'rgba(255,255,255,0.55)';
    ctx.lineWidth = 1.5;
    ctx.lineCap = 'round';
    ctx.setLineDash([8, 6]);
    for (const w of this.walls) {
      ctx.beginPath();
      ctx.moveTo(w.ax, w.ay);
      ctx.lineTo(w.bx, w.by);
      ctx.stroke();
    }
    ctx.restore();
  }

  drawProgressFill(ctx: CanvasRenderingContext2D, progress: number): void {
    if (progress <= 0) return;
    const alpha = Math.min(0.28, 0.05 + progress * 0.23);
    ctx.save();
    ctx.fillStyle = `rgba(255,255,255,${alpha})`;
    ctx.beginPath();
    const verts = this.vertices;
    ctx.moveTo(verts[0].x, verts[0].y);
    for (let i = 1; i < verts.length; i++) ctx.lineTo(verts[i].x, verts[i].y);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  get size(): { width: number; height: number } {
    return { width: this.width, height: this.height };
  }
}

// Closest point on segment AB to point P (also returns signed distance and normal).
export function segmentRepulsion(
  px: number, py: number,
  ax: number, ay: number,
  bx: number, by: number,
  radius: number,
  out: { fx: number; fy: number; dist: number },
): void {
  const abx = bx - ax;
  const aby = by - ay;
  const apx = px - ax;
  const apy = py - ay;
  const abLenSq = abx * abx + aby * aby;
  let t = abLenSq > 0 ? (apx * abx + apy * aby) / abLenSq : 0;
  if (t < 0) t = 0;
  else if (t > 1) t = 1;
  const cx = ax + abx * t;
  const cy = ay + aby * t;
  const dx = px - cx;
  const dy = py - cy;
  const d = Math.hypot(dx, dy);
  out.dist = d;
  if (d < radius && d > 1e-4) {
    const falloff = 1 - d / radius;
    const inv = 1 / d;
    out.fx = dx * inv * falloff;
    out.fy = dy * inv * falloff;
  } else {
    out.fx = 0;
    out.fy = 0;
  }
}

// Segment-segment intersection: does AB cross CD? If yes, returns true and writes the normal of CD.
export function segmentsCross(
  ax: number, ay: number, bx: number, by: number,
  cx: number, cy: number, dx: number, dy: number,
): boolean {
  const rx = bx - ax, ry = by - ay;
  const sx = dx - cx, sy = dy - cy;
  const denom = rx * sy - ry * sx;
  if (Math.abs(denom) < 1e-9) return false;
  const t = ((cx - ax) * sy - (cy - ay) * sx) / denom;
  const u = ((cx - ax) * ry - (cy - ay) * rx) / denom;
  return t >= 0 && t <= 1 && u >= 0 && u <= 1;
}
