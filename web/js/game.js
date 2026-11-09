/**
 * Golf 112 — browser edition.
 *
 * This is a faithful Canvas reimplementation of the CMU 15-112 Python game in
 * src/main.py. The coordinate system, level data, drawing order, state
 * machine, input handling, collision resolution, friction, scoring and audio
 * cues all follow the original. The original `onStep` runs at 30 steps/second,
 * so physics here is driven by a fixed 30 Hz accumulator while rendering runs
 * at the display refresh rate.
 */

import { LEVELS, LEVEL_COUNT, UNLOCKED_LEVELS } from './levels.js';
import { AudioEngine } from './audio.js';

const WIDTH = 400;
const HEIGHT = 400;
const STEP_MS = 1000 / 30;

const BALL_RADIUS = 5;
const HOLE_RADIUS = 7;
const MAX_DRAG_DISTANCE = 60;
const POWER = 0.1;
const FRICTION = 0.96;
const SUBSTEPS = 50;
const TRAIL_INTERVAL = 20;
const TRAIL_LENGTH = 20;

const COLORS = {
  silver: '#c0c0c0',
  green: '#008000',
  darkGreen: '#006400',
  white: '#ffffff',
  black: '#000000',
  lightBlue: '#add8e6',
  lightGray: '#d3d3d3',
  steelBlue: '#4682b4',
  khaki: '#f0e68c',
  gray: '#808080',
  ink: '#10231a',
  cream: '#f7f3e8',
  gold: '#d9a520',
};

const BEST_KEY = 'golf112.best.v1';
const LEVEL_ROWS = 3;
const LEVEL_COLS = 4;
const LEVEL_BUTTON = 50;
const LEVEL_GAP = 20;

class GolfGame {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.audio = new AudioEngine();

    // Page / navigation state (app.page).
    this.page = 'startpage';
    this.currentLevel = 1;
    this.unlockedLevels = UNLOCKED_LEVELS;
    this.levels = Array.from({ length: LEVEL_ROWS }, (_, r) =>
      Array.from({ length: LEVEL_COLS }, (_, c) => r * LEVEL_COLS + c + 1),
    );

    // Input state.
    this.mouse = { x: 0, y: 0, inside: false };
    this.dragging = false;
    this.dragStart = null;
    this.activePointerId = null;

    // Game state (set by loadLevel).
    this.courseMap = LEVELS[1].courseMap;
    this.innerWalls = LEVELS[1].innerWalls;
    this.ballCenter = LEVELS[1].ballCenter;
    this.holeCenter = LEVELS[1].holeCenter;
    this.timeLimit = null;
    this.timeLeft = null;
    this.levelStartTime = null;
    this.strokes = 0;

    // Ball state.
    this.ballX = this.ballCenter[0];
    this.ballY = this.ballCenter[1];
    this.ballVx = 0;
    this.ballVy = 0;
    this.trailCounter = 0;
    this.ballTrail = [];

    // Win / fail state.
    this.win = false;
    this.fail = false;
    this.fadeOpacity = 0;
    this.failFade = 0;
    this.winSoundPlayed = false;
    this.winNewBest = false;

    this.bestScores = loadBestScores();
    this.paused = false;
    this.lastFrame = performance.now();
    this.accumulator = 0;
    this.scale = 1;

    // Image for the start screen.
    this.picture = new Image();
    this.picture.addEventListener('load', () => {
      this.draw();
    });
    this.picture.src = new URL('../assets/Picture.jpg', import.meta.url).href;

    this.bindEvents();
    this.setupResize();
    this.updateProgressUI();
    this.updateSoundButton();
    this.announce('Golf 112 start screen. Drag the ball to putt.');

    if (new URLSearchParams(window.location.search).has('debug')) {
      this.installDebugAPI();
    }

    requestAnimationFrame((t) => this.loop(t));
  }

  // ---------------------------------------------------------------------
  // Lifecycle
  // ---------------------------------------------------------------------

  loop(now) {
    const dt = Math.min(now - this.lastFrame, 250);
    this.lastFrame = now;
    this.accumulator += dt;

    let steps = 0;
    while (this.accumulator >= STEP_MS && steps < 8) {
      this.update(now);
      this.accumulator -= STEP_MS;
      steps += 1;
    }
    if (steps === 8) this.accumulator = 0;

    this.draw();
    requestAnimationFrame((t) => this.loop(t));
  }

  update(now) {
    if (this.page === 'gamepage' && !this.win && !this.fail && !this.paused) {
      this.stepPhysics(now);
    }
    this.updateFades();
  }

  loadLevel(levelNum) {
    const info = LEVELS[levelNum];
    if (!info) return;

    this.currentLevel = levelNum;
    this.courseMap = info.courseMap;
    this.innerWalls = info.innerWalls || [];
    this.ballCenter = info.ballCenter;
    this.holeCenter = info.holeCenter;
    this.timeLimit = info.timeLimit ?? null;
    this.timeLeft = this.timeLimit;
    this.levelStartTime = performance.now();
    this.ballTrail = [];
    this.trailCounter = 0;

    this.resetBall();
    this.win = false;
    this.fail = false;
    this.fadeOpacity = 0;
    this.failFade = 0;
    this.winNewBest = false;

    this.announce(
      `Level ${levelNum}, ${info.name}. ${this.timeLimit} seconds. Drag the ball to putt.`,
    );
  }

  playLevel(levelNum) {
    this.loadLevel(levelNum);
    this.page = 'gamepage';
    this.refreshCursor();
  }

  /** Equivalent of resetBall(app) in the Python source. */
  resetBall() {
    this.ballX = this.ballCenter[0];
    this.ballY = this.ballCenter[1];
    this.ballVx = 0;
    this.ballVy = 0;
    this.strokes = 0;
    this.winSoundPlayed = false;
    this.dragging = false;
    this.dragStart = null;
    this.fadeOpacity = 0;
    this.failFade = 0;
  }

  replayLevel() {
    this.loadLevel(this.currentLevel);
    this.page = 'gamepage';
    this.refreshCursor();
  }

  showLevels() {
    this.page = 'levels';
    this.win = false;
    this.fail = false;
    this.dragging = false;
    this.dragStart = null;
    this.fadeOpacity = 0;
    this.failFade = 0;
    this.refreshCursor();
    this.announce('Level selection. All twelve courses are unlocked.');
  }

  showStart() {
    this.page = 'startpage';
    this.win = false;
    this.fail = false;
    this.dragging = false;
    this.dragStart = null;
    this.fadeOpacity = 0;
    this.failFade = 0;
    this.refreshCursor();
    this.announce('Golf 112 start screen.');
  }

  // ---------------------------------------------------------------------
  // Physics — direct port of the Python onStep / collision functions
  // ---------------------------------------------------------------------

  stepPhysics(now = performance.now()) {
    for (let i = 0; i < SUBSTEPS; i += 1) {
      this.ballX += this.ballVx / SUBSTEPS;
      this.ballY += this.ballVy / SUBSTEPS;

      this.trailCounter += 1;
      if (this.trailCounter % TRAIL_INTERVAL === 0) {
        this.ballTrail.push([this.ballX, this.ballY]);
        if (this.ballTrail.length > TRAIL_LENGTH) this.ballTrail.shift();
      }

      this.checkBallCollision();
      this.clampBallInMap();
      this.checkBounceCircleCollision();
    }

    this.ballVx *= FRICTION;
    this.ballVy *= FRICTION;

    if (Math.abs(this.ballVx) < 0.05 && Math.abs(this.ballVy) < 0.05) {
      this.ballVx = 0;
      this.ballVy = 0;
    }

    if (!isPointInPolygon(this.ballX, this.ballY, this.courseMap)) {
      this.resetBall();
    }

    if (this.checkBallInHole()) {
      this.win = true;
      if (!this.winSoundPlayed) {
        this.audio.play('win');
        this.winSoundPlayed = true;
      }
      if (
        this.currentLevel === this.unlockedLevels &&
        this.unlockedLevels < LEVEL_COUNT
      ) {
        this.unlockedLevels += 1;
      }
      this.recordBestScore();
      this.announce(
        `Level ${this.currentLevel} complete in ${this.strokes} strokes.`,
      );
    }

    if (this.timeLimit !== null && !this.win) {
      this.timeLeft = this.timeLimit - (now - this.levelStartTime) / 1000;
      if (this.timeLeft <= 0) {
        this.fail = true;
        this.timeLeft = 0;
        this.audio.play('fail');
        this.announce("Time's up. Try again.");
      }
    }
  }

  /**
   * Port of checkBallCollision. The original flips the horizontal or vertical
   * velocity component depending on the wall's dominant axis and pushes the
   * ball out along the contact normal. Five passes handle corners where the
   * ball touches more than one segment.
   */
  checkBallCollision() {
    const walls = [];
    for (let i = 0; i < this.courseMap.length; i += 1) {
      const [x1, y1] = this.courseMap[i];
      const [x2, y2] = this.courseMap[(i + 1) % this.courseMap.length];
      walls.push([x1, y1, x2, y2]);
    }
    walls.push(...this.innerWalls);

    for (let pass = 0; pass < 5; pass += 1) {
      for (const [x1, y1, x2, y2] of walls) {
        let wallDx = x2 - x1;
        let wallDy = y2 - y1;
        const px = this.ballX;
        const py = this.ballY;
        const length = Math.hypot(wallDx, wallDy);
        if (length === 0) continue;

        wallDx /= length;
        wallDy /= length;

        const toBallX = px - x1;
        const toBallY = py - y1;

        let projLength = toBallX * wallDx + toBallY * wallDy;
        projLength = Math.max(0, Math.min(length, projLength));

        const closestX = x1 + wallDx * projLength;
        const closestY = y1 + wallDy * projLength;

        const dx = px - closestX;
        const dy = py - closestY;
        const distance = Math.hypot(dx, dy);

        if (distance < BALL_RADIUS) {
          this.audio.play('wallHit');

          if (Math.abs(wallDx) > Math.abs(wallDy)) {
            this.ballVy = -this.ballVy;
          } else {
            this.ballVx = -this.ballVx;
          }

          const overlap = BALL_RADIUS - distance + 0.2;
          const norm = Math.hypot(dx, dy);
          if (norm !== 0) {
            this.ballX += (dx / norm) * overlap;
            this.ballY += (dy / norm) * overlap;
          }
        }
      }
    }
  }

  clampBallInMap() {
    const r = BALL_RADIUS + 1;
    this.ballX = Math.min(Math.max(this.ballX, r), WIDTH - r);
    this.ballY = Math.min(Math.max(this.ballY, r), HEIGHT - r);
  }

  checkBallInHole() {
    const dx = this.ballX - this.holeCenter[0];
    const dy = this.ballY - this.holeCenter[1];
    return Math.hypot(dx, dy) <= HOLE_RADIUS - BALL_RADIUS;
  }

  /** Port of checkBounceCircleCollision: elastic reflection + 1.5x speed. */
  checkBounceCircleCollision() {
    const level = LEVELS[this.currentLevel];
    if (!level || !Object.hasOwn(level, 'bounceCircle')) return;

    let bounces = level.bounceCircle;
    if (!Array.isArray(bounces)) bounces = [bounces];

    for (const b of bounces) {
      const [cx, cy] = b.center;
      const r = b.radius;

      const dx = this.ballX - cx;
      const dy = this.ballY - cy;
      const distance = Math.hypot(dx, dy);

      if (distance < r + BALL_RADIUS) {
        if (distance === 0) return;
        const nx = dx / distance;
        const ny = dy / distance;

        const dot = this.ballVx * nx + this.ballVy * ny;
        this.ballVx -= 2 * dot * nx;
        this.ballVy -= 2 * dot * ny;

        this.audio.play('wallHit');

        this.ballVx *= 1.5;
        this.ballVy *= 1.5;

        const overlap = r + BALL_RADIUS - distance + 0.1;
        this.ballX += nx * overlap;
        this.ballY += ny * overlap;
      }
    }
  }

  updateFades() {
    if (this.page !== 'gamepage') return;

    if (this.win && this.fadeOpacity < 120) {
      this.fadeOpacity = Math.min(this.fadeOpacity + 5, 100);
      if (this.fadeOpacity >= 100) {
        this.page = 'winpage';
        this.refreshCursor();
      }
    }

    if (this.fail && this.failFade < 120) {
      this.failFade = Math.min(this.failFade + 5, 100);
      if (this.failFade >= 100) {
        this.page = 'failpage';
        this.refreshCursor();
      }
    }
  }

  recordBestScore() {
    const previous = this.bestScores[this.currentLevel];
    const strokes = this.strokes;
    if (typeof previous !== 'number' || strokes < previous) {
      this.bestScores[this.currentLevel] = strokes;
      this.winNewBest = true;
      saveBestScores(this.bestScores);
      this.updateProgressUI();
    } else {
      this.winNewBest = false;
    }
  }

  // ---------------------------------------------------------------------
  // Input
  // ---------------------------------------------------------------------

  bindEvents() {
    this.canvas.addEventListener('pointerdown', (e) => this.onPointerDown(e));
    this.canvas.addEventListener('pointermove', (e) => this.onPointerMove(e));
    this.canvas.addEventListener('pointerup', (e) => this.onPointerUp(e));
    this.canvas.addEventListener('pointercancel', () => this.cancelDrag());
    this.canvas.addEventListener('pointerleave', () => {
      if (!this.dragging) {
        this.mouse.inside = false;
        this.refreshCursor();
      }
    });
    this.canvas.addEventListener('contextmenu', (e) => e.preventDefault());

    window.addEventListener('blur', () => {
      if (this.dragging) this.cancelDrag();
    });
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) {
        this.lastFrame = performance.now();
        this.accumulator = 0;
      }
    });

    window.addEventListener('keydown', (e) => this.onKeyDown(e));

    const soundBtn = document.getElementById('soundBtn');
    if (soundBtn) {
      soundBtn.addEventListener('click', () => {
        const willUnmute = this.audio.muted;
        if (willUnmute) this.audio.unlock();
        this.audio.toggleMuted();
        this.updateSoundButton();
        this.showToast(this.audio.muted ? 'Sound muted' : 'Sound on');
        if (willUnmute) this.audio.startBgm();
      });
    }

    const coursesBtn = document.getElementById('coursesBtn');
    if (coursesBtn) {
      coursesBtn.addEventListener('click', () => {
        if (this.page !== 'levels') this.showLevels();
      });
    }
  }

  onKeyDown(e) {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    const key = e.key.toLowerCase();

    if (key === 'm') {
      const soundBtn = document.getElementById('soundBtn');
      if (soundBtn) soundBtn.click();
      return;
    }

    if (key === 'r') {
      if (this.page === 'gamepage' || this.page === 'winpage' || this.page === 'failpage') {
        this.replayLevel();
      }
      return;
    }

    if (key === 'escape') {
      if (this.page === 'gamepage') this.showLevels();
      else if (this.page === 'levels' || this.page === 'winpage' || this.page === 'failpage') {
        this.showStart();
      }
      return;
    }

    // Primary action for keyboard users starting on the title screen.
    if ((key === 'enter' || key === ' ') && this.page === 'startpage') {
      e.preventDefault();
      this.audio.unlock();
      this.page = 'levels';
      this.refreshCursor();
    }
  }

  pointerWorld(e) {
    const rect = this.canvas.getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) / rect.width) * WIDTH,
      y: ((e.clientY - rect.top) / rect.height) * HEIGHT,
    };
  }

  onPointerDown(e) {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    const p = this.pointerWorld(e);
    this.mouse = { x: p.x, y: p.y, inside: true };
    this.audio.unlock();

    if (this.page === 'startpage') {
      if (this.inStartButton(p.x, p.y)) {
        this.page = 'levels';
        this.announce('Level selection. All twelve courses are unlocked.');
      }
      this.refreshCursor();
      return;
    }

    if (this.page === 'levels') {
      const hit = this.levelAt(p.x, p.y);
      if (hit !== null && hit <= this.unlockedLevels) {
        this.playLevel(hit);
        return;
      }
      if (this.inBackButton(p.x, p.y)) {
        this.showStart();
        return;
      }
      this.refreshCursor();
      return;
    }

    if (this.page === 'gamepage') {
      if (this.inGameNav(p.x, p.y, 'home')) {
        this.showStart();
        return;
      }
      if (this.inGameNav(p.x, p.y, 'levels')) {
        this.showLevels();
        return;
      }

      if (
        this.ballVx === 0 &&
        this.ballVy === 0 &&
        distance(p.x, p.y, this.ballX, this.ballY) <= BALL_RADIUS
      ) {
        this.dragging = true;
        this.dragStart = { x: p.x, y: p.y };
        this.activePointerId = e.pointerId;
        try {
          this.canvas.setPointerCapture(e.pointerId);
        } catch {
          /* Pointer capture is a progressive enhancement. */
        }
        this.refreshCursor();
      }
      return;
    }

    if (this.page === 'winpage') {
      if (this.inWinButton(p.x, p.y, 'replay')) {
        this.replayLevel();
      } else if (this.inWinButton(p.x, p.y, 'next')) {
        const next = this.currentLevel + 1;
        if (next in LEVELS) this.playLevel(next);
      } else if (this.inWinButton(p.x, p.y, 'levels')) {
        this.showLevels();
      }
      this.refreshCursor();
      return;
    }

    if (this.page === 'failpage') {
      if (this.inFailButton(p.x, p.y, 'retry')) {
        this.replayLevel();
      } else if (this.inFailButton(p.x, p.y, 'levels')) {
        this.showLevels();
      }
      this.refreshCursor();
    }
  }

  onPointerMove(e) {
    const p = this.pointerWorld(e);
    this.mouse = { x: p.x, y: p.y, inside: true };
    this.refreshCursor();
  }

  onPointerUp(e) {
    if (!this.dragging) return;
    const p = this.pointerWorld(e);
    this.mouse = { x: p.x, y: p.y, inside: true };

    let dx = this.dragStart.x - p.x;
    let dy = this.dragStart.y - p.y;
    const distance = Math.hypot(dx, dy);

    if (distance > MAX_DRAG_DISTANCE) {
      const scale = MAX_DRAG_DISTANCE / distance;
      dx *= scale;
      dy *= scale;
    }

    this.ballVx = dx * POWER;
    this.ballVy = dy * POWER;

    const releasedDistance = Math.min(distance, MAX_DRAG_DISTANCE);
    this.dragging = false;
    this.dragStart = null;

    if (releasedDistance > MAX_DRAG_DISTANCE * 0.01) {
      this.strokes += 1;
      this.audio.play('golfHit');
    }

    if (this.activePointerId !== null) {
      try {
        this.canvas.releasePointerCapture(this.activePointerId);
      } catch {
        /* Already released. */
      }
      this.activePointerId = null;
    }
    this.refreshCursor();
  }

  cancelDrag() {
    this.dragging = false;
    this.dragStart = null;
    if (this.activePointerId !== null) {
      try {
        this.canvas.releasePointerCapture(this.activePointerId);
      } catch {
        /* Already released. */
      }
      this.activePointerId = null;
    }
    this.refreshCursor();
  }

  // ---------------------------------------------------------------------
  // Hit tests
  // ---------------------------------------------------------------------

  inStartButton(x, y) {
    const w = 140;
    const h = 60;
    return (
      x >= WIDTH / 2 - w / 2 &&
      x <= WIDTH / 2 + w / 2 &&
      y >= HEIGHT / 2 + 60 - h / 2 &&
      y <= HEIGHT / 2 + 60 + h / 2
    );
  }

  levelGridOrigin() {
    const gridWidth = LEVEL_COLS * LEVEL_BUTTON + (LEVEL_COLS - 1) * LEVEL_GAP;
    const gridHeight = LEVEL_ROWS * LEVEL_BUTTON + (LEVEL_ROWS - 1) * LEVEL_GAP;
    return {
      x: (WIDTH - gridWidth) / 2,
      y: (HEIGHT - gridHeight) / 2,
    };
  }

  levelCell(level) {
    const index = level - 1;
    const row = Math.floor(index / LEVEL_COLS);
    const col = index % LEVEL_COLS;
    const origin = this.levelGridOrigin();
    return {
      x: origin.x + col * (LEVEL_BUTTON + LEVEL_GAP),
      y: origin.y + row * (LEVEL_BUTTON + LEVEL_GAP),
      w: LEVEL_BUTTON,
      h: LEVEL_BUTTON,
    };
  }

  levelAt(x, y) {
    for (let i = 1; i <= LEVEL_COUNT; i += 1) {
      const cell = this.levelCell(i);
      if (x >= cell.x && x <= cell.x + cell.w && y >= cell.y && y <= cell.y + cell.h) {
        return i;
      }
    }
    return null;
  }

  inBackButton(x, y) {
    return x >= 15 && x <= 105 && y >= 345 && y <= 385;
  }

  inGameNav(x, y, which) {
    const cx = 50;
    const cy = which === 'home' ? 342 : 374;
    return x >= cx - 30 && x <= cx + 30 && y >= cy - 12.5 && y <= cy + 12.5;
  }

  inWinButton(x, y, which) {
    const yRanges = { replay: [160, 200], next: [210, 250], levels: [260, 300] };
    const range = yRanges[which];
    return x >= WIDTH / 2 - 60 && x <= WIDTH / 2 + 60 && y >= range[0] && y <= range[1];
  }

  inFailButton(x, y, which) {
    const yRanges = { retry: [160, 200], levels: [210, 250] };
    const range = yRanges[which];
    return x >= WIDTH / 2 - 60 && x <= WIDTH / 2 + 60 && y >= range[0] && y <= range[1];
  }

  // ---------------------------------------------------------------------
  // Cursor / chrome
  // ---------------------------------------------------------------------

  refreshCursor() {
    let cursor = 'default';
    const { x, y, inside } = this.mouse;

    if (this.dragging) {
      cursor = 'grabbing';
    } else if (inside) {
      if (this.page === 'startpage' && this.inStartButton(x, y)) {
        cursor = 'pointer';
      } else if (this.page === 'levels') {
        if (this.inBackButton(x, y) || this.levelAt(x, y) !== null) cursor = 'pointer';
      } else if (this.page === 'gamepage') {
        if (this.inGameNav(x, y, 'home') || this.inGameNav(x, y, 'levels')) {
          cursor = 'pointer';
        } else if (
          this.ballVx === 0 &&
          this.ballVy === 0 &&
          distance(x, y, this.ballX, this.ballY) <= BALL_RADIUS
        ) {
          cursor = 'grab';
        }
      } else if (this.page === 'winpage') {
        if (
          this.inWinButton(x, y, 'replay') ||
          this.inWinButton(x, y, 'levels') ||
          (this.inWinButton(x, y, 'next') && this.currentLevel + 1 in LEVELS)
        ) {
          cursor = 'pointer';
        }
      } else if (this.page === 'failpage') {
        if (this.inFailButton(x, y, 'retry') || this.inFailButton(x, y, 'levels')) {
          cursor = 'pointer';
        }
      }
    }

    this.canvas.style.cursor = cursor;
  }

  updateSoundButton() {
    const btn = document.getElementById('soundBtn');
    if (!btn) return;
    const muted = this.audio.muted;
    btn.setAttribute('aria-pressed', String(!muted));
    btn.setAttribute('aria-label', muted ? 'Turn sound on' : 'Turn sound off');
    btn.dataset.muted = String(muted);
    const label = btn.querySelector('[data-sound-label]');
    if (label) label.textContent = muted ? 'Sound off' : 'Sound on';
  }

  updateProgressUI() {
    const el = document.querySelector('[data-progress]');
    if (!el) return;
    const done = Object.keys(this.bestScores).length;
    el.textContent = `${done} / ${LEVEL_COUNT}`;
  }

  showToast(message) {
    const toast = document.getElementById('toast');
    if (!toast) return;
    toast.textContent = message;
    toast.classList.add('is-visible');
    clearTimeout(this._toastTimer);
    this._toastTimer = setTimeout(() => toast.classList.remove('is-visible'), 1800);
  }

  announce(message) {
    const el = document.getElementById('sr-status');
    if (!el) return;
    el.textContent = message;
  }

  // ---------------------------------------------------------------------
  // Resize / drawing
  // ---------------------------------------------------------------------

  setupResize() {
    const resize = () => {
      const rect = this.canvas.getBoundingClientRect();
      const cssSize = Math.max(1, rect.width || 400);
      const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
      this.scale = (cssSize / WIDTH) * dpr;
      this.canvas.width = Math.round(cssSize * dpr);
      this.canvas.height = Math.round(cssSize * dpr);
      this.draw();
    };
    if (typeof ResizeObserver !== 'undefined') {
      new ResizeObserver(resize).observe(this.canvas);
    }
    window.addEventListener('resize', resize);
    resize();
  }

  draw() {
    const ctx = this.ctx;
    ctx.setTransform(this.scale, 0, 0, this.scale, 0, 0);
    ctx.clearRect(0, 0, WIDTH, HEIGHT);
    ctx.textBaseline = 'middle';
    ctx.imageSmoothingEnabled = true;

    if (this.page === 'startpage') this.drawStartPage(ctx);
    else if (this.page === 'levels') this.drawLevelsPage(ctx);
    else if (this.page === 'gamepage') {
      this.drawGamePage(ctx);
      if (this.win) this.drawWhiteFade(ctx, this.fadeOpacity);
      if (this.fail) this.drawWhiteFade(ctx, this.failFade);
    } else if (this.page === 'winpage') this.drawWinPage(ctx);
    else if (this.page === 'failpage') this.drawFailPage(ctx);
  }

  drawStartPage(ctx) {
    const gradient = ctx.createLinearGradient(0, 0, 0, HEIGHT);
    gradient.addColorStop(0, '#1f6b3a');
    gradient.addColorStop(1, '#0a2b18');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);

    if (this.picture.complete && this.picture.naturalWidth > 0) {
      ctx.drawImage(this.picture, 0, 0, WIDTH, HEIGHT);
    }

    const shade = ctx.createLinearGradient(0, 0, 0, HEIGHT);
    shade.addColorStop(0, 'rgba(5, 22, 13, 0.45)');
    shade.addColorStop(0.36, 'rgba(5, 22, 13, 0.12)');
    shade.addColorStop(0.64, 'rgba(5, 22, 13, 0.55)');
    shade.addColorStop(1, 'rgba(5, 22, 13, 0.92)');
    ctx.fillStyle = shade;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);

    // Small course badge.
    ctx.save();
    ctx.fillStyle = 'rgba(247, 243, 232, 0.16)';
    ctx.strokeStyle = 'rgba(247, 243, 232, 0.35)';
    ctx.lineWidth = 1;
    roundedRect(ctx, 120, 18, 160, 22, 11);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = 'rgba(247, 243, 232, 0.9)';
    ctx.font = 'bold 8px Arial, Helvetica, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('CMU 15-112  ·  TERM PROJECT', 200, 30);
    ctx.restore();

    ctx.save();
    ctx.textAlign = 'center';
    ctx.font = 'bold 60px Arial, Helvetica, sans-serif';
    ctx.lineWidth = 5;
    ctx.strokeStyle = 'rgba(4, 18, 10, 0.9)';
    ctx.strokeText('Golf 112!', 200, 108);
    ctx.fillStyle = '#fffdf5';
    ctx.shadowColor = 'rgba(0,0,0,0.45)';
    ctx.shadowBlur = 18;
    ctx.shadowOffsetY = 4;
    ctx.fillText('Golf 112!', 200, 108);
    ctx.restore();

    ctx.save();
    ctx.textAlign = 'center';
    ctx.font = 'italic 14px Georgia, "Times New Roman", serif';
    ctx.fillStyle = 'rgba(247, 243, 232, 0.96)';
    ctx.shadowColor = 'rgba(0,0,0,0.7)';
    ctx.shadowBlur = 8;
    ctx.fillText('A browser remake of the original Python game', 200, 148);
    ctx.restore();

    const hovering = this.mouse.inside && this.inStartButton(this.mouse.x, this.mouse.y);
    const w = hovering ? 140 : 120;
    const h = hovering ? 60 : 50;
    const x = WIDTH / 2 - w / 2;
    const y = HEIGHT / 2 + 60 - h / 2;

    ctx.save();
    ctx.shadowColor = hovering ? 'rgba(0,0,0,0.5)' : 'rgba(0,0,0,0.35)';
    ctx.shadowBlur = hovering ? 18 : 10;
    ctx.shadowOffsetY = hovering ? 7 : 4;
    ctx.fillStyle = hovering ? '#c9ecf9' : COLORS.lightBlue;
    ctx.strokeStyle = '#0d1f17';
    ctx.lineWidth = 3;
    roundedRect(ctx, x, y, w, h, 12);
    ctx.fill();
    ctx.stroke();
    ctx.restore();

    ctx.save();
    ctx.textAlign = 'center';
    ctx.font = 'bold 24px Arial, Helvetica, sans-serif';
    ctx.fillStyle = COLORS.ink;
    ctx.fillText('Levels', 200, 260);
    ctx.restore();

    ctx.save();
    ctx.textAlign = 'center';
    ctx.font = 'bold 10px Arial, Helvetica, sans-serif';
    ctx.fillStyle = 'rgba(247, 243, 232, 0.82)';
    ctx.fillText('12 COURSES  ·  ALL UNLOCKED', 200, 298);
    ctx.font = '11px Arial, Helvetica, sans-serif';
    ctx.fillStyle = 'rgba(247, 243, 232, 0.92)';
    ctx.fillText('Drag from the ball  ·  aim  ·  release to putt', 200, 342);
    ctx.fillStyle = 'rgba(247, 243, 232, 0.55)';
    ctx.font = '9px Arial, Helvetica, sans-serif';
    ctx.fillText('Sink it before the clock runs out', 200, 362);
    ctx.restore();
  }

  drawLevelsPage(ctx) {
    const bg = ctx.createRadialGradient(200, 120, 40, 200, 200, 380);
    bg.addColorStop(0, '#5b9bc9');
    bg.addColorStop(1, '#35678e');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);

    // Faint fairway striping for texture.
    ctx.save();
    ctx.globalAlpha = 0.05;
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 10;
    for (let x = -120; x < 460; x += 26) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x + 120, HEIGHT);
      ctx.stroke();
    }
    ctx.restore();

    ctx.save();
    ctx.textAlign = 'center';
    ctx.font = 'bold 40px Arial, Helvetica, sans-serif';
    ctx.lineWidth = 4;
    ctx.strokeStyle = 'rgba(11, 31, 23, 0.85)';
    ctx.strokeText('Level Selection', 200, 40);
    ctx.fillStyle = '#ffffff';
    ctx.fillText('Level Selection', 200, 40);
    ctx.restore();

    ctx.save();
    ctx.textAlign = 'center';
    ctx.font = '10px Arial, Helvetica, sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.78)';
    ctx.fillText('Choose a course — every level is unlocked', 200, 72);
    ctx.restore();

    for (let row = 0; row < LEVEL_ROWS; row += 1) {
      for (let col = 0; col < LEVEL_COLS; col += 1) {
        const level = this.levels[row][col];
        const cell = this.levelCell(level);
        const hovered =
          this.mouse.inside &&
          this.mouse.x >= cell.x &&
          this.mouse.x <= cell.x + cell.w &&
          this.mouse.y >= cell.y &&
          this.mouse.y <= cell.y + cell.h;

        ctx.save();
        if (hovered) {
          ctx.shadowColor = 'rgba(0,0,0,0.3)';
          ctx.shadowBlur = 10;
          ctx.shadowOffsetY = 4;
        }
        ctx.fillStyle = hovered ? '#c9ecf9' : COLORS.lightBlue;
        ctx.strokeStyle = hovered ? '#0d1f17' : 'rgba(255,255,255,0.55)';
        ctx.lineWidth = hovered ? 3 : 1.5;
        roundedRect(ctx, cell.x, cell.y, cell.w, cell.h, 8);
        ctx.fill();
        ctx.stroke();
        ctx.restore();

        const unlocked = level <= this.unlockedLevels;
        ctx.save();
        ctx.textAlign = 'center';
        ctx.font = 'bold 25px Arial, Helvetica, sans-serif';
        ctx.fillStyle = unlocked ? '#000000' : '#808080';
        ctx.fillText(String(level), cell.x + cell.w / 2, cell.y + cell.h / 2 + 1);
        ctx.restore();

        if (this.bestScores[level] !== undefined) {
          drawCheckBadge(ctx, cell.x + cell.w - 8, cell.y + 8, 7);
          ctx.save();
          ctx.textAlign = 'center';
          ctx.font = 'bold 7px Arial, Helvetica, sans-serif';
          ctx.fillStyle = 'rgba(14, 60, 36, 0.85)';
          ctx.fillText(`BEST ${this.bestScores[level]}`, cell.x + cell.w / 2, cell.y + cell.h - 7);
          ctx.restore();
        }
      }
    }

    const backHover = this.mouse.inside && this.inBackButton(this.mouse.x, this.mouse.y);
    ctx.save();
    if (backHover) {
      ctx.shadowColor = 'rgba(0,0,0,0.3)';
      ctx.shadowBlur = 10;
      ctx.shadowOffsetY = 4;
    }
    ctx.fillStyle = backHover ? COLORS.lightBlue : COLORS.lightGray;
    ctx.strokeStyle = '#0d1f17';
    ctx.lineWidth = 3;
    roundedRect(ctx, 15, 345, 90, 40, 9);
    ctx.fill();
    ctx.stroke();
    ctx.restore();

    ctx.save();
    ctx.textAlign = 'center';
    ctx.font = 'bold 20px Arial, Helvetica, sans-serif';
    ctx.fillStyle = '#000000';
    ctx.fillText('Back', 60, 365);
    ctx.restore();

    ctx.save();
    ctx.textAlign = 'right';
    ctx.font = '10px Arial, Helvetica, sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.fillText(`${Object.keys(this.bestScores).length} / ${LEVEL_COUNT} completed`, 380, 365);
    ctx.restore();
  }

  drawGamePage(ctx) {
    const bg = ctx.createLinearGradient(0, 0, 0, HEIGHT);
    bg.addColorStop(0, '#cbcbcb');
    bg.addColorStop(1, '#b4b4b4');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);

    // Level name is a subtle addition to the original HUD.
    ctx.save();
    ctx.textAlign = 'left';
    ctx.font = 'bold 13px Arial, Helvetica, sans-serif';
    ctx.fillStyle = '#000000';
    ctx.fillText(`Level: ${this.currentLevel}`, 20, 20);
    ctx.fillText(`Strokes: ${this.strokes}`, 20, 40);
    ctx.font = '10px Arial, Helvetica, sans-serif';
    ctx.fillStyle = 'rgba(16, 35, 26, 0.55)';
    ctx.fillText(LEVELS[this.currentLevel].name.toUpperCase(), 20, 55);
    ctx.restore();

    if (this.timeLeft !== null) {
      const display = Math.max(0, Math.floor(this.timeLeft));
      const urgent = display <= 5;
      ctx.save();
      ctx.textAlign = 'right';
      ctx.font = 'bold 13px Arial, Helvetica, sans-serif';
      ctx.fillStyle = urgent ? '#a61b1b' : '#000000';
      ctx.fillText(`Time: ${display}s`, 380, 20);
      if (urgent) {
        ctx.beginPath();
        ctx.arc(388, 20, 3, 0, Math.PI * 2);
        ctx.fillStyle = '#a61b1b';
        ctx.fill();
      }
      ctx.restore();
    }

    // Course polygon (even-odd matches Tk's self-intersecting fill on level 9).
    ctx.save();
    polygonPath(ctx, this.courseMap);
    ctx.shadowColor = 'rgba(0,0,0,0.18)';
    ctx.shadowBlur = 10;
    ctx.shadowOffsetY = 4;
    ctx.fillStyle = COLORS.green;
    ctx.fill('evenodd');
    ctx.restore();

    ctx.save();
    polygonPath(ctx, this.courseMap);
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 3;
    ctx.lineJoin = 'miter';
    ctx.stroke();
    ctx.restore();

    // Inner walls.
    ctx.save();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    for (const [x1, y1, x2, y2] of this.innerWalls) {
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
    }
    ctx.restore();

    // Hole.
    ctx.save();
    ctx.beginPath();
    ctx.arc(this.holeCenter[0], this.holeCenter[1], HOLE_RADIUS, 0, Math.PI * 2);
    ctx.fillStyle = '#000000';
    ctx.shadowColor = 'rgba(0,0,0,0.35)';
    ctx.shadowBlur = 5;
    ctx.fill();
    ctx.restore();

    // Bounce pads (drawn under ball / trail so the ball stays readable).
    const level = LEVELS[this.currentLevel];
    if (Object.hasOwn(level, 'bounceCircle')) {
      let bounces = level.bounceCircle;
      if (!Array.isArray(bounces)) bounces = [bounces];
      for (const b of bounces) {
        const [cx, cy] = b.center;
        const r = b.radius;
        ctx.save();
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.fillStyle = b.color || 'khaki';
        ctx.fill();
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 1.5;
        ctx.stroke();
        ctx.restore();

        const arrowLength = r * 0.5;
        ctx.save();
        drawDoubleArrow(
          ctx,
          cx - arrowLength,
          cy - arrowLength,
          cx + arrowLength,
          cy + arrowLength,
          COLORS.gray,
          2,
          Math.max(4, r * 0.12),
        );
        drawDoubleArrow(
          ctx,
          cx + arrowLength,
          cy - arrowLength,
          cx - arrowLength,
          cy + arrowLength,
          COLORS.gray,
          2,
          Math.max(4, r * 0.12),
        );
        ctx.restore();
      }
    }

    // Trail.
    ctx.save();
    for (let i = 0; i < this.ballTrail.length; i += 1) {
      const [x, y] = this.ballTrail[i];
      ctx.globalAlpha = i / TRAIL_LENGTH;
      ctx.beginPath();
      ctx.arc(x, y, BALL_RADIUS - 1, 0, Math.PI * 2);
      ctx.fillStyle = COLORS.darkGreen;
      ctx.fill();
    }
    ctx.restore();

    // Ball.
    ctx.save();
    ctx.beginPath();
    ctx.arc(this.ballX, this.ballY, BALL_RADIUS, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff';
    ctx.shadowColor = 'rgba(0,0,0,0.35)';
    ctx.shadowBlur = 4;
    ctx.shadowOffsetY = 1.5;
    ctx.fill();
    ctx.shadowColor = 'transparent';
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 1.2;
    ctx.stroke();
    ctx.restore();

    // Aim line + power ratio.
    const launch = this.dragging && this.dragStart
      ? clampVector(this.dragStart.x - this.mouse.x, this.dragStart.y - this.mouse.y, MAX_DRAG_DISTANCE)
      : null;
    const powerRatio = launch ? Math.hypot(launch.x, launch.y) / MAX_DRAG_DISTANCE : 0;

    if (launch && (launch.x !== 0 || launch.y !== 0)) {
      ctx.save();
      ctx.lineCap = 'round';
      ctx.shadowColor = 'rgba(0,0,0,0.35)';
      ctx.shadowBlur = 4;
      drawArrow(
        ctx,
        this.ballX,
        this.ballY,
        this.ballX + launch.x,
        this.ballY + launch.y,
        '#ffffff',
        2,
        7,
      );
      ctx.restore();
    }

    this.drawPowerBar(ctx, powerRatio);
    this.drawGameButtons(ctx);

    if (this.strokes === 0 && !this.dragging && this.ballVx === 0 && this.ballVy === 0) {
      ctx.save();
      ctx.textAlign = 'right';
      ctx.font = '9px Arial, Helvetica, sans-serif';
      ctx.fillStyle = 'rgba(16, 35, 26, 0.55)';
      ctx.fillText('Drag the ball to putt', 380, 391);
      ctx.restore();
    }
  }

  drawPowerBar(ctx, powerRatio) {
    const x = 30;
    const y = 140;
    const w = 20;
    const h = 120;

    ctx.save();
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 1.5;
    roundedRect(ctx, x, y, w, h, 4);
    ctx.fill();
    ctx.stroke();
    ctx.restore();

    const filledHeight = h * powerRatio;
    if (filledHeight > 0) {
      ctx.save();
      roundedRect(ctx, x, y, w, h, 4);
      ctx.clip();
      const red = 255;
      const green = Math.round(255 * (1 - powerRatio));
      const blue = Math.round(255 * (1 - powerRatio));
      ctx.fillStyle = `rgb(${red}, ${green}, ${blue})`;
      ctx.fillRect(x, y + h - filledHeight, w, filledHeight);
      ctx.restore();
    }

    ctx.save();
    ctx.textAlign = 'center';
    ctx.font = 'bold 10px Arial, Helvetica, sans-serif';
    ctx.fillStyle = '#000000';
    ctx.fillText('Power:', x + w / 2, y - 15);
    const percent = Math.round(powerRatio * 100);
    ctx.font = 'bold 10px Arial, Helvetica, sans-serif';
    ctx.fillText(`${percent}%`, x + w / 2, y + h + 15);
    ctx.restore();
  }

  drawGameButtons(ctx) {
    const homeHover = this.mouse.inside && this.inGameNav(this.mouse.x, this.mouse.y, 'home');
    const levelsHover = this.mouse.inside && this.inGameNav(this.mouse.x, this.mouse.y, 'levels');

    for (const [label, cy, hovered] of [
      ['Home', 342, homeHover],
      ['Levels', 374, levelsHover],
    ]) {
      ctx.save();
      ctx.fillStyle = hovered ? COLORS.lightBlue : COLORS.lightGray;
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 2;
      roundedRect(ctx, 20, cy - 12.5, 60, 25, 4);
      ctx.fill();
      ctx.stroke();
      ctx.textAlign = 'center';
      ctx.font = 'bold 12px Arial, Helvetica, sans-serif';
      ctx.fillStyle = '#000000';
      ctx.fillText(label, 50, cy);
      ctx.restore();
    }
  }

  drawWinPage(ctx) {
    this.drawResultBackground(ctx);

    ctx.save();
    ctx.textAlign = 'center';
    ctx.font = 'bold 9px Arial, Helvetica, sans-serif';
    ctx.fillStyle = 'rgba(20, 60, 38, 0.66)';
    ctx.fillText(`LEVEL ${this.currentLevel}  ·  ${LEVELS[this.currentLevel].name.toUpperCase()}`, 200, 66);
    ctx.restore();

    drawFlagMark(ctx, 200, 34);

    ctx.save();
    ctx.textAlign = 'center';
    ctx.font = 'bold 20px Arial, Helvetica, sans-serif';
    ctx.fillStyle = '#10231a';
    ctx.fillText(`Completed Level in ${this.strokes} strokes!`, 200, 100);
    ctx.restore();

    ctx.save();
    ctx.textAlign = 'center';
    ctx.font = 'bold 10px Arial, Helvetica, sans-serif';
    if (this.winNewBest) {
      ctx.fillStyle = '#9a6b00';
      ctx.fillText('NEW BEST SCORE', 200, 128);
    } else {
      const best = this.bestScores[this.currentLevel];
      ctx.fillStyle = 'rgba(16, 35, 26, 0.55)';
      ctx.fillText(`BEST: ${best ?? this.strokes} STROKES`, 200, 128);
    }
    ctx.restore();

    const canAdvance = this.currentLevel + 1 in LEVELS;
    const buttons = [
      { label: 'Replay', y: 180, hover: this.mouse.inside && this.inWinButton(this.mouse.x, this.mouse.y, 'replay'), disabled: false },
      { label: 'Next Level', y: 230, hover: this.mouse.inside && this.inWinButton(this.mouse.x, this.mouse.y, 'next') && canAdvance, disabled: !canAdvance },
      { label: 'Levels', y: 280, hover: this.mouse.inside && this.inWinButton(this.mouse.x, this.mouse.y, 'levels'), disabled: false },
    ];
    for (const b of buttons) this.drawResultButton(ctx, b);

    if (!canAdvance) {
      ctx.save();
      ctx.textAlign = 'center';
      ctx.font = 'italic 11px Georgia, "Times New Roman", serif';
      ctx.fillStyle = 'rgba(16, 35, 26, 0.55)';
      ctx.fillText('That’s all 12 courses — thanks for playing!', 200, 326);
      ctx.restore();
    }
  }

  drawFailPage(ctx) {
    this.drawResultBackground(ctx);

    drawClockMark(ctx, 200, 34);

    ctx.save();
    ctx.textAlign = 'center';
    ctx.font = 'bold 20px Arial, Helvetica, sans-serif';
    ctx.fillStyle = '#10231a';
    ctx.fillText('Time’s up! Try again.', 200, 100);
    ctx.restore();

    ctx.save();
    ctx.textAlign = 'center';
    ctx.font = 'italic 11px Georgia, "Times New Roman", serif';
    ctx.fillStyle = 'rgba(16, 35, 26, 0.6)';
    ctx.fillText('The clock beat you to the hole.', 200, 128);
    ctx.restore();

    const buttons = [
      { label: 'Retry', y: 180, hover: this.mouse.inside && this.inFailButton(this.mouse.x, this.mouse.y, 'retry'), disabled: false },
      { label: 'Levels', y: 230, hover: this.mouse.inside && this.inFailButton(this.mouse.x, this.mouse.y, 'levels'), disabled: false },
    ];
    for (const b of buttons) this.drawResultButton(ctx, b);
  }

  drawResultBackground(ctx) {
    const bg = ctx.createRadialGradient(200, 120, 30, 200, 200, 360);
    bg.addColorStop(0, '#ffffff');
    bg.addColorStop(1, '#f1eee4');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);

    ctx.save();
    ctx.globalAlpha = 0.05;
    ctx.strokeStyle = '#0e3c24';
    for (let x = 20; x < WIDTH; x += 24) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, HEIGHT);
      ctx.stroke();
    }
    ctx.restore();
  }

  drawResultButton(ctx, button) {
    const x = WIDTH / 2 - 60;
    const y = button.y - 20;
    ctx.save();
    if (button.hover) {
      ctx.shadowColor = 'rgba(0,0,0,0.2)';
      ctx.shadowBlur = 10;
      ctx.shadowOffsetY = 3;
    }
    ctx.fillStyle = button.disabled
      ? '#e8e5dc'
      : button.hover
        ? COLORS.lightBlue
        : COLORS.lightGray;
    ctx.strokeStyle = button.disabled ? '#b9b5aa' : '#0d1f17';
    ctx.lineWidth = 2;
    roundedRect(ctx, x, y, 120, 40, 8);
    ctx.fill();
    ctx.stroke();
    ctx.restore();

    ctx.save();
    ctx.textAlign = 'center';
    ctx.font = 'bold 13px Arial, Helvetica, sans-serif';
    ctx.fillStyle = button.disabled ? '#9d998e' : '#000000';
    ctx.fillText(button.label, WIDTH / 2, button.y);
    ctx.restore();
  }

  drawWhiteFade(ctx, opacity) {
    ctx.save();
    ctx.globalAlpha = Math.max(0, Math.min(1, opacity / 100));
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
    ctx.restore();
  }

  // ---------------------------------------------------------------------
  // Test-only API (available at ?debug=1)
  // ---------------------------------------------------------------------

  installDebugAPI() {
    window.Golf112Debug = {
      state: () => ({
        page: this.page,
        currentLevel: this.currentLevel,
        strokes: this.strokes,
        ballX: this.ballX,
        ballY: this.ballY,
        ballVx: this.ballVx,
        ballVy: this.ballVy,
        ballCenter: [...this.ballCenter],
        holeCenter: [...this.holeCenter],
        timeLeft: this.timeLeft,
        timeLimit: this.timeLimit,
        win: this.win,
        fail: this.fail,
        fadeOpacity: this.fadeOpacity,
        failFade: this.failFade,
        dragStart: this.dragStart ? { ...this.dragStart } : null,
        dragging: this.dragging,
        trailLength: this.ballTrail.length,
        bestScores: { ...this.bestScores },
        winNewBest: this.winNewBest,
        audio: this.audio.status(),
        levelCount: LEVEL_COUNT,
      }),
      loadLevel: (n) => {
        this.loadLevel(n);
        this.page = 'gamepage';
        this.paused = true;
      },
      setBall: (x, y, vx = 0, vy = 0) => {
        this.ballX = x;
        this.ballY = y;
        this.ballVx = vx;
        this.ballVy = vy;
      },
      setStrokes: (n) => {
        this.strokes = n;
      },
      setPaused: (paused) => {
        this.paused = Boolean(paused);
      },
      advance: (steps = 1) => {
        for (let i = 0; i < steps; i += 1) {
          if (this.page === 'gamepage' && !this.win && !this.fail) {
            this.stepPhysics(performance.now());
          }
          this.updateFades();
        }
      },
      expireTimer: () => {
        if (this.timeLimit !== null) {
          this.levelStartTime = performance.now() - (this.timeLimit + 1) * 1000;
        }
      },
      clearBest: () => {
        this.bestScores = {};
        saveBestScores(this.bestScores);
        this.updateProgressUI();
      },
      audioUnlock: () => this.audio.unlock(),
    };
  }
}

// ---------------------------------------------------------------------------
// Math / drawing helpers
// ---------------------------------------------------------------------------

function distance(x1, y1, x2, y2) {
  return Math.hypot(x2 - x1, y2 - y1);
}

function clampVector(dx, dy, max) {
  const length = Math.hypot(dx, dy);
  if (length > max) {
    const scale = max / length;
    return { x: dx * scale, y: dy * scale };
  }
  return { x: dx, y: dy };
}

function isPointInPolygon(px, py, polygon) {
  let inside = false;
  const n = polygon.length;
  let j = n - 1;
  for (let i = 0; i < n; i += 1) {
    const [xi, yi] = polygon[i];
    const [xj, yj] = polygon[j];
    if (
      yi > py !== yj > py &&
      px < ((xj - xi) * (py - yi)) / (yj - yi + 1e-10) + xi
    ) {
      inside = !inside;
    }
    j = i;
  }
  return inside;
}

function polygonPath(ctx, points) {
  ctx.beginPath();
  ctx.moveTo(points[0][0], points[0][1]);
  for (let i = 1; i < points.length; i += 1) {
    ctx.lineTo(points[i][0], points[i][1]);
  }
  ctx.closePath();
}

function roundedRect(ctx, x, y, w, h, r) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + w - radius, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
  ctx.lineTo(x + w, y + h - radius);
  ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
  ctx.lineTo(x + radius, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

function drawArrow(ctx, x1, y1, x2, y2, color, width, headSize) {
  const angle = Math.atan2(y2 - y1, x2 - x1);
  const shaftEndX = x2 - Math.cos(angle) * headSize * 0.65;
  const shaftEndY = y2 - Math.sin(angle) * headSize * 0.65;

  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = width;
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(shaftEndX, shaftEndY);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(x2, y2);
  ctx.lineTo(
    x2 - Math.cos(angle - Math.PI / 6) * headSize,
    y2 - Math.sin(angle - Math.PI / 6) * headSize,
  );
  ctx.lineTo(
    x2 - Math.cos(angle + Math.PI / 6) * headSize,
    y2 - Math.sin(angle + Math.PI / 6) * headSize,
  );
  ctx.closePath();
  ctx.fill();
}

function drawDoubleArrow(ctx, x1, y1, x2, y2, color, width, headSize) {
  drawArrow(ctx, x1, y1, x2, y2, color, width, headSize);
  drawArrow(ctx, x2, y2, x1, y1, color, width, headSize);
}

function drawCheckBadge(ctx, x, y, r) {
  ctx.save();
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fillStyle = '#0e3c24';
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.85)';
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(x - 3, y);
  ctx.lineTo(x - 0.8, y + 2.2);
  ctx.lineTo(x + 3.2, y - 2.2);
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 1.4;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.stroke();
  ctx.restore();
}

function drawFlagMark(ctx, x, y) {
  ctx.save();
  ctx.beginPath();
  ctx.arc(x, y, 17, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(14, 60, 36, 0.08)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(14, 60, 36, 0.22)';
  ctx.lineWidth = 1;
  ctx.stroke();

  ctx.strokeStyle = '#0e3c24';
  ctx.lineWidth = 2;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(x + 4, y + 9);
  ctx.lineTo(x + 4, y - 9);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(x + 4, y - 9);
  ctx.lineTo(x - 8, y - 5);
  ctx.lineTo(x + 4, y - 1);
  ctx.closePath();
  ctx.fillStyle = '#c9372c';
  ctx.fill();

  ctx.beginPath();
  ctx.ellipse(x + 1, y + 10, 9, 2.5, 0, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(14, 60, 36, 0.12)';
  ctx.fill();
  ctx.restore();
}

function drawClockMark(ctx, x, y) {
  ctx.save();
  ctx.beginPath();
  ctx.arc(x, y, 17, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(14, 60, 36, 0.08)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(14, 60, 36, 0.3)';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(x, y, 9, 0, Math.PI * 2);
  ctx.strokeStyle = '#0e3c24';
  ctx.lineWidth = 1.8;
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(x, y - 5);
  ctx.lineTo(x, y);
  ctx.lineTo(x + 4, y + 2);
  ctx.strokeStyle = '#0e3c24';
  ctx.lineWidth = 1.6;
  ctx.lineCap = 'round';
  ctx.stroke();
  ctx.restore();
}

// ---------------------------------------------------------------------------
// Best-score persistence
// ---------------------------------------------------------------------------

function loadBestScores() {
  try {
    const raw = localStorage.getItem(BEST_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    const clean = {};
    for (const [key, value] of Object.entries(parsed)) {
      const level = Number(key);
      if (
        Number.isInteger(level) &&
        level >= 1 &&
        level <= LEVEL_COUNT &&
        typeof value === 'number' &&
        Number.isFinite(value) &&
        value >= 0
      ) {
        clean[level] = value;
      }
    }
    return clean;
  } catch {
    return {};
  }
}

function saveBestScores(scores) {
  try {
    localStorage.setItem(BEST_KEY, JSON.stringify(scores));
  } catch {
    /* Private browsing / disabled storage is fine. */
  }
}

// ---------------------------------------------------------------------------
// Boot
// ---------------------------------------------------------------------------

const canvas = document.getElementById('game');
if (canvas) {
  const game = new GolfGame(canvas);
  // Handy for console exploration and for the Playwright suite.
  window.Golf112 = game;
}
