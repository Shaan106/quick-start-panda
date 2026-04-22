import { Flock, DEFAULT_PARAMS } from './flock';
import { Pen } from './pen';
import { Player } from './player';

const INITIAL_BOIDS = 150;
const WIN_THRESHOLD = 0.60;
const WIN_HOLD_SECONDS = 2.0;
const TRAIL_FADE_ALPHA = 0.10;

type Mode = 'play' | 'won' | 'sandbox';

export class Game {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  width = 0;
  height = 0;

  flock: Flock;
  pen: Pen;
  player = new Player();

  mode: Mode = 'play';
  elapsed = 0;
  holdTimer = 0;
  winTime = 0;
  pendingObstacle = false;

  private hudTimer: HTMLElement;
  private hudProgress: HTMLElement;
  private sandboxPanel: HTMLElement;
  private sandboxSlider: HTMLInputElement;
  private sandboxCount: HTMLElement;
  private sandboxClear: HTMLButtonElement;
  private sandboxReset: HTMLButtonElement;
  private bannerEl: HTMLElement;
  private bannerTitle: HTMLElement;
  private bannerSub: HTMLElement;

  private lastT = 0;
  private placeObstacleBtn: HTMLButtonElement | null = null;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) throw new Error('2D context unavailable');
    this.ctx = ctx;

    this.resize();
    this.pen = new Pen(this.width, this.height);
    this.flock = new Flock(this.width, this.height, { ...DEFAULT_PARAMS });
    this.flock.populate(INITIAL_BOIDS, this.width, this.height);

    this.hudTimer = document.getElementById('hud-timer')!;
    this.hudProgress = document.getElementById('hud-progress')!;
    this.sandboxPanel = document.getElementById('sandbox')!;
    this.sandboxSlider = document.getElementById('sandbox-slider') as HTMLInputElement;
    this.sandboxCount = document.getElementById('sandbox-count')!;
    this.sandboxClear = document.getElementById('sandbox-clear') as HTMLButtonElement;
    this.sandboxReset = document.getElementById('sandbox-reset') as HTMLButtonElement;
    this.bannerEl = document.getElementById('banner')!;
    this.bannerTitle = document.getElementById('banner-title')!;
    this.bannerSub = document.getElementById('banner-sub')!;

    this.setupUI();
    this.player.attach(canvas);

    window.addEventListener('resize', () => this.resize(true));
    window.addEventListener('keydown', (e) => {
      if (e.code === 'KeyR') this.restart();
      if (e.code === 'KeyO' && this.mode === 'sandbox') this.placeObstacleAtPlayer();
    });

    // Sandbox: click to place obstacle after arming the button
    canvas.addEventListener('click', (e) => {
      if (this.mode === 'sandbox' && this.pendingObstacle) {
        this.flock.obstacles.push({ x: e.clientX, y: e.clientY, r: 22 + Math.random() * 10 });
        this.pendingObstacle = false;
        this.updatePlaceButton();
      }
    });
  }

  private setupUI(): void {
    // Inject "+ obstacle" button before clear button
    const placeBtn = document.createElement('button');
    placeBtn.id = 'sandbox-place';
    placeBtn.textContent = '+ obstacle';
    this.sandboxClear.parentElement!.insertBefore(placeBtn, this.sandboxClear);
    this.placeObstacleBtn = placeBtn;
    placeBtn.addEventListener('click', () => {
      this.pendingObstacle = !this.pendingObstacle;
      this.updatePlaceButton();
    });

    this.sandboxSlider.addEventListener('input', () => {
      const n = parseInt(this.sandboxSlider.value, 10);
      this.sandboxCount.textContent = String(n);
      this.flock.setCount(n);
    });
    this.sandboxClear.addEventListener('click', () => {
      this.flock.obstacles.length = 0;
    });
    this.sandboxReset.addEventListener('click', () => this.restart());
  }

  private updatePlaceButton(): void {
    if (!this.placeObstacleBtn) return;
    if (this.pendingObstacle) {
      this.placeObstacleBtn.style.borderColor = 'rgba(255,255,255,0.9)';
      this.placeObstacleBtn.style.color = '#fff';
      this.placeObstacleBtn.textContent = 'click canvas…';
    } else {
      this.placeObstacleBtn.style.borderColor = '';
      this.placeObstacleBtn.style.color = '';
      this.placeObstacleBtn.textContent = '+ obstacle';
    }
  }

  private placeObstacleAtPlayer(): void {
    if (!this.player.visible) return;
    this.flock.obstacles.push({ x: this.player.x, y: this.player.y, r: 22 + Math.random() * 10 });
  }

  private resize(preservePositions = false): void {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.canvas.width = Math.floor(w * dpr);
    this.canvas.height = Math.floor(h * dpr);
    this.canvas.style.width = w + 'px';
    this.canvas.style.height = h + 'px';
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    if (!preservePositions) {
      this.width = w;
      this.height = h;
      return;
    }

    const sx = w / this.width;
    const sy = h / this.height;
    this.width = w;
    this.height = h;
    if (this.flock) {
      this.flock.resize(w, h);
      for (const b of this.flock.boids) {
        b.x *= sx;
        b.y *= sy;
      }
      for (const o of this.flock.obstacles) {
        o.x *= sx;
        o.y *= sy;
      }
    }
    if (this.pen) this.pen.rebuild(w, h);
  }

  restart(): void {
    this.mode = 'play';
    this.elapsed = 0;
    this.holdTimer = 0;
    this.winTime = 0;
    this.flock.obstacles.length = 0;
    this.sandboxSlider.value = String(INITIAL_BOIDS);
    this.sandboxCount.textContent = String(INITIAL_BOIDS);
    this.flock.populate(INITIAL_BOIDS, this.width, this.height);
    this.sandboxPanel.classList.remove('show');
    this.bannerEl.classList.remove('show');
    this.pendingObstacle = false;
    this.updatePlaceButton();
  }

  private enterWon(): void {
    this.mode = 'won';
    this.winTime = this.elapsed;
    this.bannerTitle.textContent = 'PENNED';
    this.bannerSub.textContent = `${this.elapsed.toFixed(1)}s · sandbox unlocked · press R to reset`;
    this.bannerEl.classList.add('show');
    setTimeout(() => {
      this.bannerEl.classList.remove('show');
      this.mode = 'sandbox';
      this.sandboxPanel.classList.add('show');
    }, 1800);
  }

  start(): void {
    this.lastT = performance.now();
    const frame = (t: number) => {
      let dt = (t - this.lastT) / 1000;
      this.lastT = t;
      if (dt > 1 / 30) dt = 1 / 30;
      this.tick(dt);
      requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  }

  private tick(dt: number): void {
    if (this.mode === 'play') this.elapsed += dt;

    this.flock.update(dt, this.pen, this.player);

    const inside = this.flock.countInside(this.pen);
    const total = this.flock.boids.length;
    const ratio = total > 0 ? inside / total : 0;

    if (this.mode === 'play') {
      if (ratio >= WIN_THRESHOLD) {
        this.holdTimer = Math.min(WIN_HOLD_SECONDS, this.holdTimer + dt);
      } else {
        this.holdTimer = Math.max(0, this.holdTimer - dt * 1.25);
      }
      if (this.holdTimer >= WIN_HOLD_SECONDS) this.enterWon();
    }

    this.render(ratio);
    this.updateHUD(inside, total);
  }

  private render(ratio: number): void {
    const ctx = this.ctx;

    // Motion-trail fade (draws a translucent black over everything so boid trails persist).
    ctx.fillStyle = `rgba(0,0,0,${TRAIL_FADE_ALPHA})`;
    ctx.fillRect(0, 0, this.width, this.height);

    // Pen progress fill (fresh every frame so it doesn't leave trails).
    const progress = this.mode === 'play'
      ? this.holdTimer / WIN_HOLD_SECONDS
      : this.mode === 'won' ? 1 : Math.min(1, ratio);
    this.pen.drawProgressFill(ctx, progress);

    // Pen outline.
    this.pen.drawOutline(ctx);

    // Obstacles.
    if (this.flock.obstacles.length > 0) {
      ctx.save();
      ctx.strokeStyle = 'rgba(255,255,255,0.45)';
      ctx.fillStyle = 'rgba(255,255,255,0.06)';
      ctx.lineWidth = 1.2;
      for (const o of this.flock.obstacles) {
        ctx.beginPath();
        ctx.arc(o.x, o.y, o.r, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      }
      ctx.restore();
    }

    // Boids.
    this.flock.draw(ctx);

    // Player cursor indicator.
    if (this.player.visible && (this.player.attract || this.player.repel)) {
      ctx.save();
      ctx.strokeStyle = this.player.attract
        ? 'rgba(255,255,255,0.55)'
        : 'rgba(255,255,255,0.35)';
      ctx.lineWidth = 1;
      const radius = this.player.attract ? 18 : 24;
      ctx.beginPath();
      ctx.arc(this.player.x, this.player.y, radius, 0, Math.PI * 2);
      ctx.stroke();
      if (this.player.repel) {
        ctx.beginPath();
        ctx.arc(this.player.x, this.player.y, radius + 10, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.restore();
    }
  }

  private updateHUD(inside: number, total: number): void {
    this.hudTimer.textContent = `${this.elapsed.toFixed(1)}s`;
    const pct = total > 0 ? Math.round((inside / total) * 100) : 0;
    this.hudProgress.textContent = `${inside} / ${total} penned · ${pct}%`;
  }
}
