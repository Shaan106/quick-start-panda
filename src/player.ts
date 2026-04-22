export class Player {
  x = 0;
  y = 0;
  attract = false;
  repel = false;
  visible = false;

  private keysHeld = new Set<string>();
  private activeTouches = new Map<number, { x: number; y: number }>();

  attach(canvas: HTMLCanvasElement): void {
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());

    canvas.addEventListener('pointerdown', (e) => {
      if (e.pointerType === 'touch') return; // touch handled separately
      this.visible = true;
      this.x = e.clientX;
      this.y = e.clientY;
      if (e.button === 2) this.repel = true;
      else this.attract = true;
      canvas.setPointerCapture(e.pointerId);
    });

    canvas.addEventListener('pointermove', (e) => {
      if (e.pointerType === 'touch') return;
      this.visible = true;
      this.x = e.clientX;
      this.y = e.clientY;
    });

    const release = (e: PointerEvent) => {
      if (e.pointerType === 'touch') return;
      if (e.button === 2) this.repel = false;
      else this.attract = false;
    };
    canvas.addEventListener('pointerup', release);
    canvas.addEventListener('pointercancel', release);

    canvas.addEventListener('touchstart', (e) => {
      e.preventDefault();
      for (let i = 0; i < e.changedTouches.length; i++) {
        const t = e.changedTouches[i];
        this.activeTouches.set(t.identifier, { x: t.clientX, y: t.clientY });
      }
      this.updateTouch();
    }, { passive: false });

    canvas.addEventListener('touchmove', (e) => {
      e.preventDefault();
      for (let i = 0; i < e.changedTouches.length; i++) {
        const t = e.changedTouches[i];
        this.activeTouches.set(t.identifier, { x: t.clientX, y: t.clientY });
      }
      this.updateTouch();
    }, { passive: false });

    const touchEnd = (e: TouchEvent) => {
      e.preventDefault();
      for (let i = 0; i < e.changedTouches.length; i++) {
        this.activeTouches.delete(e.changedTouches[i].identifier);
      }
      this.updateTouch();
    };
    canvas.addEventListener('touchend', touchEnd, { passive: false });
    canvas.addEventListener('touchcancel', touchEnd, { passive: false });

    window.addEventListener('keydown', (e) => {
      if (e.code === 'Space') {
        e.preventDefault();
        // Only arm repel if we already have a real cursor position.
        // Otherwise Space would repel from (0,0) before the mouse has moved.
        if (this.visible) this.repel = true;
      }
      this.keysHeld.add(e.code);
    });

    window.addEventListener('keyup', (e) => {
      if (e.code === 'Space') this.repel = false;
      this.keysHeld.delete(e.code);
    });

    window.addEventListener('blur', () => {
      this.attract = false;
      this.repel = false;
      this.keysHeld.clear();
    });
  }

  private updateTouch(): void {
    const count = this.activeTouches.size;
    if (count === 0) {
      this.attract = false;
      this.repel = false;
      return;
    }
    let sx = 0, sy = 0;
    for (const p of this.activeTouches.values()) { sx += p.x; sy += p.y; }
    this.x = sx / count;
    this.y = sy / count;
    this.visible = true;
    if (count >= 2) {
      this.attract = false;
      this.repel = true;
    } else {
      this.attract = true;
      this.repel = false;
    }
  }

  keyPressed(code: string): boolean {
    return this.keysHeld.has(code);
  }
}
