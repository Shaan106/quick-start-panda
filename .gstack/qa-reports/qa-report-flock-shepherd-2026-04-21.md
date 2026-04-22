# QA Report — Flock Shepherd v1

**Date:** 2026-04-21
**Target:** https://shaan106.github.io/quick-start-panda/
**Commit:** `73a3b1d` (includes prior QA pass fixes BUG-001..004)
**Tier:** Standard (code review + static verification; headless browser unavailable)
**Tester:** QA (Pentagon agent)

## Summary

Deploy is healthy. Bundle on live URL is byte-identical to local `dist/` build of HEAD. `tsc && vite build` is clean (0 errors, 0 warnings, 16.1 kB JS / 5.5 kB gzip). Prior QA pass already fixed 4 input/restart bugs.

Code review surfaced 5 additional findings. None are demo-blocking. One is worth fixing for robustness (wall corner tunneling); others are polish.

**Demo ship verdict: GO.**

## What I could verify

- ✅ Live URL returns 200, HTML renders full markup (canvas, HUD, sandbox, banner, hint)
- ✅ JS bundle returns 200, byte-equal to local build (deploy is not stale)
- ✅ `tsc && vite build` clean, 10 modules transformed
- ✅ Viewport is locked: `maximum-scale=1.0, user-scalable=no` (pinch-zoom blocked)
- ✅ Canvas has `touch-action: none` (pan/zoom gestures suppressed)
- ✅ Pen opening indices 1 and 4 map to the right-side and lower-left sides as specified
- ✅ Win loop gated by `mode === 'play'`, restart clears `winTimer` before enterWon can resolve (BUG-001 fix verified in code)
- ✅ Space arming guarded by `player.visible` (BUG-002 fix verified in code)
- ✅ Blur clears attract/repel/keysHeld (BUG-003 fix verified in code)
- ✅ `setCount` uses the pen-exclusion seeding loop (BUG-004 fix verified in code)

## What I could NOT verify

Headless browser (browse) not installed in this session; no GUI display available. The following need real-browser validation before the "whoa moment" is real:

- ❌ **Perf:** 60fps @ 250 boids on M1 Chrome. Algorithmic complexity looks fine (O(n·k) per frame with 3×3 spatial-hash lookups, k≈10–15; 250 triangle draws; one full-canvas trail-fade fillRect). Should hit 60fps comfortably but needs measurement.
- ❌ **Touch:** tap = attract, two-finger = repel, pinch-zoom blocked. Code is correct (`count >= 2 ⇒ repel`) but needs a real iPad/phone.
- ❌ **Herding feel / tuning:** attractStrength, cohesion stringiness, win flow. Staff Engineer already flagged this as theoretical.
- ❌ **Visual regression:** trail readability, banner timing, progress fill aesthetics.

## Findings

### BUG-005 — Wall reflection can tunnel through pen corners · HIGH priority to fix, LOW probability in practice

**File:** `src/flock.ts:264-284`

Fast-boid fallback reflection handles only the *first* crossed wall, then `break`s. If a trajectory crosses two walls at a vertex (pen corner), only the first is reflected. The post-reflection position may still cross the second wall.

Max step under current params: `maxSpeed (195) × dtClamp (1/30) = 6.5 px`. Pen vertex spacing is much larger, so corner-tunneling is unlikely in normal play. But the reflection code exists specifically as a fallback for the worst case — and tab-return after a long dt spike is one of the scenarios Staff Engineer explicitly asked about (tick 6 in the test plan).

**Repro (theoretical):** Alt-tab with boids at high velocity near a pen vertex; on return, dt-clamp triggers, some boids may cross the vertex neighborhood in one step.

**Fix sketch:**
```ts
// After reflection, re-check against remaining walls, OR loop until no crossings:
let reflected = true;
let guard = 0;
while (reflected && guard++ < 4) {
  reflected = false;
  for (const wall of pen.walls) {
    if (segmentsCross(prevX, prevY, nx, ny, wall.ax, wall.ay, wall.bx, wall.by)) {
      // reflect, recompute nx/ny, set reflected = true, break inner
    }
  }
}
```

### BUG-006 — Space + right-click coupling · MEDIUM

**File:** `src/player.ts:77-80`

```ts
window.addEventListener('keyup', (e) => {
  if (e.code === 'Space') this.repel = false;
  ...
});
```

Repel is set by either Space *or* right-click (pointerdown with `button === 2`). On Space release, `repel` is unconditionally cleared — even if right-click is still held. User sees repel turn off despite still holding RMB.

**Repro:** Hold RMB (repel on), then press and release Space. Repel turns off while RMB still held.

**Fix:** Track two flags (`repelFromSpace`, `repelFromRMB`) and OR them, or only unset if RMB isn't active.

### BUG-007 — Blur leaves `visible = true` with stale cursor position · LOW

**File:** `src/player.ts:82-86`

Blur clears `attract`, `repel`, `keysHeld` but leaves `visible = true` and stale `x`, `y`. After alt-tab, if user hits Space before moving the mouse, `if (this.visible) this.repel = true;` arms repel from the last pre-blur cursor position — which may no longer be meaningful.

**Fix:** `this.visible = false` in the blur handler. Space repel then re-arms only after the user moves the mouse (restoring `visible`).

### BUG-008 — Dead member `winTime` · LOW (cleanup)

**File:** `src/game.ts:25, 177`

`winTime` is assigned on enterWon but never read. Safe to remove.

### BUG-009 — Resize scales boids but pen uses fresh geometry · LOW

**File:** `src/game.ts:141-157`

On resize, boids are scaled by `(sx, sy) = (newW/oldW, newH/oldH)` while `pen.rebuild(w, h)` regenerates the heptagon from normalized coords (same proportions). Both scale proportionally, so relative positions are preserved in practice — but the transformation isn't symmetric (boids multiplied by `sx`, pen computed from `w * 0.54`, etc.). An asymmetric window resize could drift boid-vs-pen relationships very slightly. Almost certainly imperceptible; flag as polish.

## Health score

| Category | Score | Notes |
|---|---|---|
| Console | — | Not measured (no real browser) |
| Links | 100 | Only one page |
| Visual | — | Not measured |
| Functional | 78 | BUG-005 (-15), BUG-006 (-8) |
| UX | 92 | BUG-007 (-3) |
| Performance | — | Not measured |
| Content | 100 | — |
| Accessibility | 85 | Canvas-only game; no ARIA, no keyboard-only path beyond R. Acceptable for this product. |

**Weighted score (categories measured only): ~85 / 100.**

## Top 3 to fix

1. **BUG-005** — wall corner tunneling (loop reflection until no crossings)
2. **BUG-006** — Space + RMB repel coupling
3. **BUG-007** — clear `visible` on blur

## Ship recommendation

Demo is GO. None of the findings block the demo path. Consider BUG-005 before any high-profile play session (tab-return is a plausible user action). BUG-006 / BUG-007 are edge cases; fix when convenient.

Honest gap: I can't prove 60fps @ 250 boids or verify touch on a real device from this session. Someone needs to play it. If the feel is off, DEFAULT_PARAMS is where to tune.
