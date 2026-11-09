# Verification report

Golf 112 — Browser Edition
Tested 2026-11-09 on macOS 27.0.1 with Google Chrome 156.0.8078.80.

## How to reproduce

```bash
cd tests
npm install
npm test
```

The suite starts its own static file server with the site mounted at
`/golf-112/`, mirroring the subpath of a GitHub Pages project site. It uses the
system Chrome channel when available and falls back to Playwright Chromium.
Screenshots are written to `tests/artifacts/`.

Chrome was the automated target for the full suite. WebKit/Safari and Firefox
were not part of the automated run; the mobile layout check uses Chrome's mobile
emulation rather than a physical phone.

## Result

**12 / 12 checks passed.** The suite was run three consecutive times after the
final timing-sensitive assertion was tightened; all runs passed 12/12.

```text
Golf 112 end-to-end verification
Serving .../web at http://127.0.0.1:52166/golf-112/

▸ Boot + start screen                                ✓
▸ Navigation and gesture-unlocked audio              ✓
▸ Load level 1, real-time clock, and mouse putt      ✓
▸ Home / Levels / Escape navigation                  ✓
▸ Real mouse playthrough: two putts win level 1      ✓
▸ Physics parity: walls, bounce pads, friction, ...  ✓
▸ Win flow, scoring, best score, and level 12 guard  ✓
▸ Fail flow: timer expiry, fail sound, retry         ✓
▸ Best scores and mute preference persist            ✓
▸ All 12 levels load in the shared 400 x 400 world   ✓
▸ Production build (no debug flag) boots cleanly     ✓
▸ Responsive 390 x 844 layout                        ✓
```

No uncaught page errors, console errors, failed requests, or 4xx responses were
recorded.

## Automated checks

| Area | What was actually verified |
| --- | --- |
| Boot | Start page state, level count, canvas is square, no horizontal overflow, canvas role/label, pointer cursor over the Levels button. |
| Level data | All 12 courses load; ball start, hole position, and time limit match `web/js/levels.js`; the JS data was separately compared field-for-field with `src/main.py` and matched exactly. |
| Navigation | Start → levels → game; Back; Home; Levels; Escape; win → Next Level; level 12 Next Level disabled; result-screen Levels. |
| Input | Real mouse drag from the ball, drag state, launch direction opposite the pull, stroke increments, golf-hit audio trigger. |
| Full victory | Level 1 completed in two real mouse putts: straight up with 46.7% power, then full power into the hole. The win fade, win page, two-stroke score, new-best flag, and remaining timer are all asserted. No teleporting or state injection is used for the shots. |
| Clock | `timeLeft` initializes from the course limit and visibly decreases in real time. |
| Physics | 50-substep frame; wall reflection; bounce-pad reflection and 1.5× speed; five-pass inner-wall collision; 0.96 friction and stop threshold; out-of-bounds reset of ball and strokes. Numerical parity to a Python reference is shown below. |
| Scoring | Win when the ball reaches the hole; best score written to `localStorage`; new-best flag; best score survives reload. |
| Fail | `expireTimer` produces `fail`, `timeLeft = 0`, fail sound, fade, fail page, retry. |
| Audio | BGM is paused before the first gesture and playing afterward; all four effects decode; play counters prove golf/wall/win/fail triggers; mute toggles and persists. |
| Persistence | Best scores and mute preference survive a full page reload. |
| All courses | Levels 1–12 rendered to screenshots with the expected metadata. |
| Production | Loading without `?debug=1` exposes no debug API and still navigates and runs. |
| Responsive | 390 × 844 emulation: no horizontal overflow, usable square canvas, start → levels → game navigation; a canvas screenshot of mobile gameplay is captured. |

## Physics parity evidence

The browser output was compared with a direct Python translation of
`app.onStep` / `checkBallCollision` / `checkBounceCircleCollision`. Starting
states and the resulting values are identical to floating-point precision.

| Scenario | Python reference | Browser |
| --- | --- | --- |
| Level 6 wall hit, start `(110, 200)`, `v=(-4, 0)`, 2 steps | `x=107.9648`, `vx=3.6864` | `x=107.9648`, `vx=3.6864` |
| Level 6 bounce pad, start `(140, 200)`, `v=(4, 0)`, 2 steps | `x=140.7528`, `vx=-5.5296` | `x=140.7528`, `vx=-5.5296` |
| Level 2 inner wall, start `(200, 150)`, `v=(0, 4)`, 5 steps | `y=161.40261376`, `vy=-3.2614907904` | `y=161.40261376`, `vy=-3.2614907904` |

A separate comparison script parsed `app.levelData` from `src/main.py` with
Python's `ast` module and compared every level field against `web/js/levels.js`:
**all 12 levels matched exactly**, including all polygon vertices, wall
segments, bounce pads, ball/hole positions, and time limits.

## Real playthrough evidence

The full-victory check performs two physical mouse drags on level 1:

1. Press the ball at `(230, 310)`, release at `(230, 338)` — a 28 px pull
   straight down, launching the ball upward at 46.7% power. It comes to rest at
   `(230.00, 241.23)`.
2. Press the resting ball, pull to `(170.47, 233.77)` — 60 px away opposite the
   hole — and release. The ball rolls in.

Observed result: `page = winpage`, `strokes = 2`, `bestScores[1] = 2`,
`winNewBest = true`, with 15.28 s left on the clock. This proves the port is
winnable through the original controls, not only via test hooks.

## Feature status

Legend: **A** = automated browser test, **V** = visually inspected screenshot,
**M** = requires manual testing.

| Feature | Status |
| --- | --- |
| Start screen, Levels button, hover expansion | A, V |
| Level select grid, Back, hover states | A, V |
| All 12 original layouts / walls / pads | A, V |
| Slingshot drag, aim arrow, power bar | A, V |
| Ball launch, friction, stopping | A |
| Wall and inner-wall collisions | A (numeric parity) |
| Bounce-pad reflection and speed boost | A (numeric parity) |
| Out-of-fairway ball/stroke reset | A |
| Hole detection and win | A |
| Stroke counting and best score | A, V |
| Countdown timer and fail | A |
| Win/fail fades and result screens | A, V |
| Replay / Next Level / Levels / Retry | A |
| BGM starts after gesture, loops, mute | A (state), **M** (audible) |
| Golf / wall / win / fail sound triggers | A (counters), **M** (audible) |
| High-DPI rendering | V |
| Responsive 390 × 844 layout | A, V |
| Physical touch drag | **M** |
| Safari / Firefox | **M** |
| Subjective timing/feel vs. original | **M** |

## Manual test checklist

1. **Audio.** Load the site, click Levels, and confirm BGM starts and loops.
   Putt, hit a wall, sink a level, and let one time out; each cue should be
   audible at a comfortable volume. Toggle Sound off/on.
2. **Touch.** On a phone or tablet, tap the level grid and try to drag the ball.
   The preserved 5 px ball target is small at phone sizes; this is intentional
   fidelity, not a hidden larger hit area.
3. **Browsers.** Open the deployed URL in Safari and Firefox. The code uses
   standard Canvas/Pointer Events/Web Audio, but these engines were not part of
   the automated run.
4. **Original comparison.** Run `src/main.py` with `cmu_graphics` or watch the
   [demo video](https://youtu.be/7o2HCYIfmC8) and compare shot feel, timing, and
   level routes. Physics values are exact; wall-hit audio is deliberately
   throttled/mixed lower.

## Known non-gameplay differences

These are documented in the README: browser-gesture-gated BGM, throttled/mixed
SFX, localStorage best scores, trail clearing on level load, win-over-timeout on
the same frame, disabled Next Level on level 12, corrected hitboxes, and the
new responsive shell/instructions.
