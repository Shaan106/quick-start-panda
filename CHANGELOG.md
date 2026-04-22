# Changelog

All notable changes to Flock Shepherd are documented here.
Format based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [1.0.0.0] - 2026-04-21

First public release. Boids herding game shipped to GitHub Pages.

### Added
- Boids flock simulation with cohesion / alignment / separation and perception-radius neighbor search (`src/flock.ts`).
- Mouse / pen / touch controls: hold to attract, Space or right-click to repel, tap to attract, two-finger to repel. Pinch-zoom locked.
- Win condition: 60% of the flock inside the pen for 2.0s triggers a "PENNED" banner and unlocks sandbox mode.
- Sandbox mode: 50–300 boid slider, click-to-place obstacles, clear, reset.
- Keybinds: `R` restart, `O` drop obstacle (sandbox only).
- GitHub Pages deployment via `.github/workflows/deploy.yml`, base `./` so the bundle works under the `/quick-start-panda/` subpath.

### Fixed
QA pass 1 (`73a3b1d`):
- Restart-during-banner `setTimeout` leak that could pop the sandbox panel over a fresh play session.
- Space-before-pointer phantom repel from `(0,0)` on fresh load.
- Space-held-during-blur leaving repel stuck on after alt-tab.
- Sandbox `setCount` ignoring pen-exclusion seeding so the slider could spawn boids inside the pen.

QA pass 2 (`12f54fa`):
- Vertex double-wall-crossing fallthrough — reflection now loops up to 4 iterations so a fast boid crossing two walls near a corner can't end up on the wrong side.
- Space `keyup` clearing right-mouse repel when RMB was still held. Space and RMB now track repel state independently.
- Blur handler leaving `visible=true` so Space after alt-tab repelled from a stale cursor position.
- Removed unused `winTime` field.

### Known issues
- Resize asymmetry (BUG-009) deferred as polish.

### Not in v1 (per plan)
Predators, multi-level progression, menus, sound, WebGL renderer.

### Unverified on hardware
Two QA passes were static-code-only. Before a high-profile demo, human playtest on M1 Chrome + one iOS device is recommended to confirm:
- 250 boids @ 60fps (DevTools Performance).
- Tap-attract / two-finger-repel / pinch-zoom lock on real iOS Safari.
- Trail readability (`TRAIL_FADE_ALPHA = 0.10` in `src/game.ts`, tune 0.08–0.14 if off).
- Flock tuning (`DEFAULT_PARAMS` in `src/flock.ts`): `attractStrength` 580→700 if weak, `weightCohesion` 0.85→0.65 if stringy, bump `minSpeed` if boids pile up static.
- Restart under live mode transitions (R during play / sandbox / banner).

## QA provenance
Full QA report committed at `.gstack/qa-reports/qa-report-flock-shepherd-2026-04-21.md`.
