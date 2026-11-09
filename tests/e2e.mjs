/**
 * Golf 112 end-to-end verification.
 *
 * Serves ../../web under /golf-112/ to mirror a GitHub Pages project site,
 * then drives the real game in Chrome.
 *
 *   cd tests && npm install && npm test
 *
 * Chrome is used if installed; otherwise Playwright's bundled Chromium is used
 * (run `npx playwright install chromium` first if necessary).
 */

import http from 'node:http';
import { createReadStream } from 'node:fs';
import { mkdir, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { LEVELS } from '../web/js/levels.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const WEB_ROOT = path.resolve(HERE, '..', 'web');
const ARTIFACTS = path.join(HERE, 'artifacts');
const BASE_PATH = '/golf-112/';
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.mp3': 'audio/mpeg',
  '.json': 'application/json',
  '.ico': 'image/x-icon',
};

const results = [];
let stepNumber = 0;

function test(name, fn) {
  stepNumber += 1;
  return { name, fn, index: stepNumber };
}

async function run({ name, fn }) {
  const started = Date.now();
  process.stdout.write(`\n▸ ${name}\n`);
  try {
    await fn();
    const ms = Date.now() - started;
    results.push({ name, ok: true, ms });
    console.log(`  ✓ passed (${ms} ms)`);
  } catch (err) {
    results.push({ name, ok: false, ms: Date.now() - started, err });
    console.error(`  ✗ FAILED: ${err.message}`);
    throw err;
  }
}

function near(actual, expected, tolerance, label) {
  assert.ok(
    Math.abs(actual - expected) <= tolerance,
    `${label}: expected ${expected} ± ${tolerance}, got ${actual}`,
  );
}

async function startServer() {
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      handleRequest(req, res).catch((err) => {
        console.error('server error', err);
        if (!res.headersSent) res.writeHead(500);
        res.end('Server error');
      });
    });
    server.on('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address();
      resolve({ server, port, url: `http://127.0.0.1:${port}${BASE_PATH}` });
    });
  });
}

async function handleRequest(req, res) {
  const url = new URL(req.url, 'http://localhost');
  let pathname;
  try {
    pathname = decodeURIComponent(url.pathname);
  } catch {
    res.writeHead(400);
    res.end('Bad path');
    return;
  }

  if (pathname === BASE_PATH.slice(0, -1)) {
    res.writeHead(301, { Location: BASE_PATH });
    res.end();
    return;
  }
  if (!pathname.startsWith(BASE_PATH)) {
    res.writeHead(404);
    res.end('Not found');
    return;
  }

  let relative = pathname.slice(BASE_PATH.length);
  if (relative === '' || relative.endsWith('/')) relative += 'index.html';

  const filePath = path.resolve(WEB_ROOT, relative);
  if (!filePath.startsWith(WEB_ROOT + path.sep)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }

  let info;
  try {
    info = await stat(filePath);
  } catch {
    res.writeHead(404);
    res.end('Not found');
    return;
  }
  if (!info.isFile()) {
    res.writeHead(404);
    res.end('Not found');
    return;
  }

  const headers = {
    'Content-Type': MIME[path.extname(filePath).toLowerCase()] || 'application/octet-stream',
    'Cache-Control': 'no-store',
    'Accept-Ranges': 'bytes',
  };

  if (req.method === 'HEAD') {
    headers['Content-Length'] = info.size;
    res.writeHead(200, headers);
    res.end();
    return;
  }

  const range = req.headers.range;
  if (range) {
    const match = /^bytes=(\d*)-(\d*)$/.exec(range);
    if (match) {
      const start = match[1] === '' ? Math.max(0, info.size - Number(match[2])) : Number(match[1]);
      const end = match[1] === '' || match[2] === '' ? info.size - 1 : Number(match[2]);
      if (start <= end && start < info.size) {
        headers['Content-Range'] = `bytes ${start}-${Math.min(end, info.size - 1)}/${info.size}`;
        headers['Content-Length'] = Math.min(end, info.size - 1) - start + 1;
        res.writeHead(206, headers);
        createReadStream(filePath, { start, end: Math.min(end, info.size - 1) }).pipe(res);
        return;
      }
    }
  }

  headers['Content-Length'] = info.size;
  res.writeHead(200, headers);
  if (req.method === 'GET') createReadStream(filePath).pipe(res);
  else res.end();
}

async function launchBrowser() {
  try {
    return await chromium.launch({ channel: 'chrome', headless: true });
  } catch (err) {
    console.warn(
      `  ! Chrome channel unavailable (${err.message.split('\n')[0]}); trying bundled Chromium.`,
    );
    return chromium.launch({ headless: true });
  }
}

function watchPage(page, errors, badResponses) {
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(`console: ${msg.text()}`);
  });
  page.on('pageerror', (err) => errors.push(`pageerror: ${err.message}`));
  page.on('response', (res) => {
    if (res.status() >= 400) badResponses.push(`${res.status()} ${res.url()}`);
  });
}

async function canvasBox(page) {
  const box = await page.locator('#game').boundingBox();
  assert.ok(box, 'canvas has a bounding box');
  return box;
}

function screenPoint(box, x, y) {
  return {
    x: box.x + (x / 400) * box.width,
    y: box.y + (y / 400) * box.height,
  };
}

async function clickWorld(page, x, y) {
  const box = await canvasBox(page);
  const p = screenPoint(box, x, y);
  await page.mouse.click(p.x, p.y);
}

async function state(page) {
  return page.evaluate(() => window.Golf112Debug.state());
}

async function debug(page, fn, ...args) {
  return page.evaluate(
    ([name, values]) => window.Golf112Debug[name](...values),
    [fn, args],
  );
}

async function screenshot(page, name) {
  await page.locator('#game').screenshot({ path: path.join(ARTIFACTS, name) });
}

async function main() {
  await mkdir(ARTIFACTS, { recursive: true });
  const { server, url } = await startServer();
  const browser = await launchBrowser();
  const errors = [];
  const badResponses = [];
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const page = await context.newPage();
  watchPage(page, errors, badResponses);

  console.log('Golf 112 end-to-end verification');
  console.log(`Serving ${WEB_ROOT} at ${url}`);

  try {
    await run(test('Boot + start screen', async () => {
      await page.goto(`${url}?debug=1`, { waitUntil: 'networkidle' });
      await page.waitForFunction(() => Boolean(window.Golf112Debug));
      await page.waitForTimeout(350);

      const s = await state(page);
      assert.equal(s.page, 'startpage');
      assert.equal(s.currentLevel, 1);
      assert.equal(s.strokes, 0);
      assert.equal(s.levelCount, 12);
      assert.equal(s.win, false);
      assert.equal(s.fail, false);
      assert.equal(s.audio.unlocked, false, 'audio waits for a gesture');
      assert.equal(s.audio.bgmPaused, true, 'BGM does not autoplay');

      const box = await canvasBox(page);
      near(box.width, box.height, 1, 'canvas square');
      assert.ok(box.width > 500, 'canvas is desktop-sized');

      const layout = await page.evaluate(() => ({
        scrollWidth: document.documentElement.scrollWidth,
        innerWidth,
        canvasRole: document.querySelector('#game').getAttribute('role'),
        canvasLabel: document.querySelector('#game').getAttribute('aria-label'),
      }));
      assert.ok(layout.scrollWidth <= layout.innerWidth, 'no horizontal overflow');
      assert.equal(layout.canvasRole, 'application');
      assert.ok(layout.canvasLabel.includes('Golf 112'));

      const startBox = await canvasBox(page);
      const startButton = screenPoint(startBox, 200, 260);
      await page.mouse.move(startButton.x, startButton.y);
      const hover = await page.evaluate(() => document.querySelector('#game').style.cursor);
      assert.equal(hover, 'pointer', 'start button shows a pointer cursor');

      await page.screenshot({ path: path.join(ARTIFACTS, 'site-desktop.png') });
      await screenshot(page, 'start.png');
    }));

    await run(test('Navigation and gesture-unlocked audio', async () => {
      await clickWorld(page, 200, 260);
      await page.waitForTimeout(250);
      let s = await state(page);
      assert.equal(s.page, 'levels');
      await screenshot(page, 'levels.png');

      await page.waitForFunction(
        () => window.Golf112Debug.state().audio.decode === 'ready',
        null,
        { timeout: 5000 },
      );
      s = await state(page);
      assert.equal(s.audio.unlocked, true, 'first gesture unlocks audio');
      assert.equal(s.audio.decoded.length, 4, 'all four effects decoded');
      assert.equal(s.audio.bgm, 'playing', 'BGM is looping');

      await clickWorld(page, 60, 365);
      await page.waitForTimeout(150);
      assert.equal((await state(page)).page, 'startpage', 'Back returns to title');

      await clickWorld(page, 200, 260);
      await page.waitForTimeout(150);
      assert.equal((await state(page)).page, 'levels');
    }));

    await run(test('Load level 1, real-time clock, and mouse putt', async () => {
      await clickWorld(page, 95, 130);
      await page.waitForTimeout(400);
      let s = await state(page);
      assert.equal(s.page, 'gamepage');
      assert.equal(s.currentLevel, 1);
      assert.equal(s.strokes, 0);
      assert.equal(s.ballX, 230);
      assert.equal(s.ballY, 310);
      assert.equal(s.timeLimit, 20);
      assert.ok(s.timeLeft > 18.5 && s.timeLeft <= 20, 'timer initialized');
      await screenshot(page, 'gameplay.png');

      const startTime = s.timeLeft;
      await page.waitForTimeout(850);
      s = await state(page);
      assert.ok(s.timeLeft < startTime - 0.5, 'timer runs in real time');

      const box = await canvasBox(page);
      const ball = screenPoint(box, 230, 310);
      const pull = screenPoint(box, 189, 345);
      await page.mouse.move(ball.x, ball.y);
      await page.mouse.down();
      await page.mouse.move(pull.x, pull.y, { steps: 8 });
      await page.waitForTimeout(120);
      assert.equal((await state(page)).dragging, true, 'drag state engages');
      await screenshot(page, 'aiming.png');
      await page.mouse.move(pull.x, pull.y);
      await page.mouse.up();
      await page.waitForTimeout(50);

      s = await state(page);
      assert.equal(s.strokes, 1, 'stroke counted');
      assert.ok(
        s.ballVx > 0 && s.ballVy < 0,
        `ball launches opposite the pull (vx=${s.ballVx}, vy=${s.ballVy}, x=${s.ballX}, y=${s.ballY})`,
      );
      assert.equal(s.audio.playCounts.golfHit, 1, 'golf hit sound triggered');

      await page.waitForTimeout(300);
      s = await state(page);
      assert.ok(s.ballX !== 230 || s.ballY !== 310, 'ball moved');
      assert.ok(s.trailLength > 0 && s.trailLength <= 20, 'trail is populated and capped');
      await screenshot(page, 'after-putt.png');
    }));

    await run(test('Home / Levels / Escape navigation', async () => {
      await clickWorld(page, 50, 342);
      await page.waitForTimeout(150);
      assert.equal((await state(page)).page, 'startpage', 'Home returns to title');

      await clickWorld(page, 200, 260);
      await page.waitForTimeout(100);
      await clickWorld(page, 165, 130); // level 2
      await page.waitForTimeout(200);
      assert.equal((await state(page)).currentLevel, 2);

      await clickWorld(page, 50, 374);
      await page.waitForTimeout(150);
      assert.equal((await state(page)).page, 'levels', 'Levels button works');

      await clickWorld(page, 305, 270); // level 12
      await page.waitForTimeout(200);
      let s = await state(page);
      assert.equal(s.currentLevel, 12);
      assert.equal(s.timeLimit, 50);

      await page.keyboard.press('Escape');
      await page.waitForTimeout(150);
      assert.equal((await state(page)).page, 'levels', 'Escape opens level select');
    }));

    await run(test('Real mouse playthrough: two putts win level 1', async () => {
      // Still on the level-select screen from the previous check.
      await clickWorld(page, 95, 130);
      await page.waitForTimeout(250);
      let s = await state(page);
      assert.equal(s.page, 'gamepage');
      assert.equal(s.currentLevel, 1);

      // First putt: straight up, 28 px of pull. The ball rests around (230, 241).
      const box = await canvasBox(page);
      const ball = screenPoint(box, 230, 310);
      const releaseOne = screenPoint(box, 230, 338);
      await page.mouse.move(ball.x, ball.y);
      await page.mouse.down();
      await page.mouse.move(releaseOne.x, releaseOne.y, { steps: 10 });
      await page.waitForTimeout(80);
      await page.mouse.up();
      await page.waitForFunction(
        () => {
          const st = window.Golf112Debug.state();
          return st.strokes === 1 && st.ballVx === 0 && st.ballVy === 0;
        },
        null,
        { timeout: 7000 },
      );
      s = await state(page);
      near(s.ballX, 230, 0.2, 'first putt line');
      near(s.ballY, 241.23, 0.2, 'first putt rest position');

      // Second putt: full power straight at the hole from the rest position.
      const dx = 300 - s.ballX;
      const dy = 250 - s.ballY;
      const len = Math.hypot(dx, dy);
      const releaseTwo = screenPoint(
        box,
        s.ballX - (dx / len) * 60,
        s.ballY - (dy / len) * 60,
      );
      const ballTwo = screenPoint(box, s.ballX, s.ballY);
      await page.mouse.move(ballTwo.x, ballTwo.y);
      await page.mouse.down();
      await page.mouse.move(releaseTwo.x, releaseTwo.y, { steps: 10 });
      await page.waitForTimeout(80);
      await page.mouse.up();

      await page.waitForFunction(
        () => window.Golf112Debug.state().page === 'winpage',
        null,
        { timeout: 6000 },
      );
      s = await state(page);
      assert.equal(s.win, true, 'level 1 won through mouse input');
      assert.equal(s.strokes, 2, 'two-putt score');
      assert.equal(s.bestScores[1], 2, 'real playthrough recorded a best');
      assert.equal(s.winNewBest, true, 'first completion marks a new best');
      assert.ok(s.timeLeft > 0, 'finished before the clock');
      await screenshot(page, 'win-real-playthrough.png');
    }));

    await run(test('Physics parity: walls, bounce pads, friction, resets', async () => {
      // Level 6: closed 200 x 200 box with a bounce pad in the middle.
      await debug(page, 'loadLevel', 6);
      await debug(page, 'setBall', 110, 200, -4, 0);
      const wallSoundsBefore = (await state(page)).audio.playCounts.wallHit;
      await debug(page, 'advance', 2);
      let s = await state(page);
      near(s.ballX, 107.9648, 1e-6, 'wall-bounce x');
      near(s.ballVx, 3.6864, 1e-6, 'wall-bounce vx');
      assert.equal(s.ballY, 200);
      assert.ok(
        s.audio.playCounts.wallHit > wallSoundsBefore,
        'wall-hit sound triggered',
      );

      // Level 6 bounce pad: contact at x = 145, reflect and boost 1.5x.
      await debug(page, 'loadLevel', 6);
      await debug(page, 'setBall', 140, 200, 4, 0);
      await debug(page, 'advance', 2);
      s = await state(page);
      near(s.ballX, 140.7528, 1e-6, 'bounce-pad x');
      near(s.ballVx, -5.5296, 1e-6, 'bounce-pad reflected vx');
      assert.ok(Math.abs(s.ballVx) > 4, 'bounce pad adds speed');

      // Level 2 inner square wall.
      await debug(page, 'loadLevel', 2);
      await debug(page, 'setBall', 200, 150, 0, 4);
      await debug(page, 'advance', 5);
      s = await state(page);
      near(s.ballY, 161.40261376, 1e-6, 'inner-wall y');
      near(s.ballVy, -3.2614907904, 1e-6, 'inner-wall reflection');

      // Friction eventually brings the ball to rest.
      await debug(page, 'loadLevel', 6);
      await debug(page, 'setBall', 120, 280, 0.5, 0);
      await debug(page, 'advance', 120);
      s = await state(page);
      assert.equal(s.ballVx, 0, 'friction stops the ball');
      assert.equal(s.ballVy, 0);

      // Out-of-bounds resets the ball and the stroke counter (original rule).
      await debug(page, 'loadLevel', 6);
      await debug(page, 'setStrokes', 3);
      await debug(page, 'setBall', 50, 50, 0, 0);
      await debug(page, 'advance', 1);
      s = await state(page);
      assert.equal(s.ballX, 120);
      assert.equal(s.ballY, 280);
      assert.equal(s.strokes, 0, 'stroke count resets with the ball');

      // Trail caps at 20 points.
      await debug(page, 'loadLevel', 6);
      await debug(page, 'setBall', 150, 280, 4, 0);
      await debug(page, 'advance', 8);
      s = await state(page);
      assert.ok(s.trailLength > 0 && s.trailLength <= 20);
    }));

    await run(test('Win flow, scoring, best score, and level 12 guard', async () => {
      const winsBefore = (await state(page)).audio.playCounts.win;
      await debug(page, 'loadLevel', 1);
      await debug(page, 'setStrokes', 2);
      await debug(page, 'setBall', 300, 250, 0, 0);
      await debug(page, 'advance', 1);
      let s = await state(page);
      assert.equal(s.win, true, 'ball in the hole wins');
      assert.equal(s.fadeOpacity, 5, 'white fade starts');
      assert.equal(s.bestScores[1], 2, 'equal score keeps the best');
      assert.equal(s.winNewBest, false, 'equal score is not a new best');
      assert.equal(s.audio.playCounts.win, winsBefore + 1, 'win sound triggered');

      await debug(page, 'advance', 20);
      s = await state(page);
      assert.equal(s.page, 'winpage');
      await screenshot(page, 'win.png');

      // Next Level.
      await clickWorld(page, 200, 230);
      await page.waitForTimeout(150);
      s = await state(page);
      assert.equal(s.page, 'gamepage');
      assert.equal(s.currentLevel, 2);

      // Win level 12; Next Level is disabled.
      await debug(page, 'loadLevel', 12);
      await debug(page, 'setStrokes', 3);
      await debug(page, 'setBall', 280, 120, 0, 0);
      await debug(page, 'advance', 21);
      assert.equal((await state(page)).page, 'winpage');
      await clickWorld(page, 200, 230);
      await page.waitForTimeout(100);
      assert.equal((await state(page)).page, 'winpage', 'level 12 has no next level');
      await clickWorld(page, 200, 280);
      await page.waitForTimeout(100);
      assert.equal((await state(page)).page, 'levels');
    }));

    await run(test('Fail flow: timer expiry, fail sound, retry', async () => {
      const failsBefore = (await state(page)).audio.playCounts.fail;
      await debug(page, 'loadLevel', 6);
      await debug(page, 'setPaused', true);
      await debug(page, 'expireTimer');
      await debug(page, 'advance', 1);
      let s = await state(page);
      assert.equal(s.fail, true, 'timer expiry fails the level');
      assert.equal(s.timeLeft, 0);
      assert.equal(s.audio.playCounts.fail, failsBefore + 1, 'fail sound triggered');
      assert.equal(s.failFade, 5, 'fail fade starts');

      await debug(page, 'advance', 20);
      s = await state(page);
      assert.equal(s.page, 'failpage');
      await screenshot(page, 'fail.png');

      await clickWorld(page, 200, 180);
      await page.waitForTimeout(150);
      s = await state(page);
      assert.equal(s.page, 'gamepage');
      assert.equal(s.currentLevel, 6);
      assert.equal(s.fail, false);

      await page.keyboard.press('r');
      await page.waitForTimeout(100);
      s = await state(page);
      assert.equal(s.strokes, 0, 'R replays the level');
    }));

    await run(test('Best scores and mute preference persist', async () => {
      await page.reload({ waitUntil: 'networkidle' });
      await page.waitForFunction(() => Boolean(window.Golf112Debug));
      let s = await state(page);
      assert.equal(s.bestScores[1], 2, 'best score survives reload');
      assert.equal(s.bestScores[12], 3, 'level 12 best survives reload');
      assert.equal(s.page, 'startpage');

      await page.locator('#soundBtn').click();
      await page.waitForTimeout(150);
      s = await state(page);
      assert.equal(s.audio.muted, true);
      assert.equal(
        await page.locator('#soundBtn').getAttribute('aria-pressed'),
        'false',
      );

      await page.reload({ waitUntil: 'networkidle' });
      await page.waitForFunction(() => Boolean(window.Golf112Debug));
      s = await state(page);
      assert.equal(s.audio.muted, true, 'mute preference survives reload');
      assert.equal(
        await page.locator('#soundBtn [data-sound-label]').textContent(),
        'Sound off',
      );

      await page.locator('#soundBtn').click();
      await page.waitForTimeout(150);
      assert.equal((await state(page)).audio.muted, false, 'unmute works');
    }));

    await run(test('All 12 levels load in the shared 400 x 400 world', async () => {
      for (let level = 1; level <= 12; level += 1) {
        await debug(page, 'loadLevel', level);
        await debug(page, 'advance', 1);
        const s = await state(page);
        const expected = LEVELS[level];
        assert.equal(s.page, 'gamepage');
        assert.equal(s.currentLevel, level);
        assert.deepEqual(s.ballCenter, expected.ballCenter, `L${level} ball start`);
        assert.deepEqual(s.holeCenter, expected.holeCenter, `L${level} hole`);
        assert.equal(s.timeLimit, expected.timeLimit, `L${level} time limit`);
        await screenshot(page, `level-${String(level).padStart(2, '0')}.png`);
      }
    }));

    await run(test('Production build (no debug flag) boots cleanly', async () => {
      await page.goto(url, { waitUntil: 'networkidle' });
      await page.waitForTimeout(300);
      const hasDebug = await page.evaluate(() => 'Golf112Debug' in window);
      assert.equal(hasDebug, false, 'debug API is opt-in');
      assert.equal(await page.evaluate(() => Boolean(window.Golf112)), true);

      await clickWorld(page, 200, 260);
      await page.waitForTimeout(150);
      assert.equal(await page.evaluate(() => window.Golf112.page), 'levels');
      assert.equal(errors.length, 0, `console/page errors: ${errors.join(' | ')}`);
      assert.equal(badResponses.length, 0, `bad responses: ${badResponses.join(' | ')}`);
    }));

    await run(test('Responsive 390 x 844 layout', async () => {
      const mobileContext = await browser.newContext({
        viewport: { width: 390, height: 844 },
        deviceScaleFactor: 2,
        hasTouch: true,
      });
      const mobile = await mobileContext.newPage();
      const mobileErrors = [];
      const mobileBad = [];
      watchPage(mobile, mobileErrors, mobileBad);
      await mobile.goto(`${url}?debug=1`, { waitUntil: 'networkidle' });
      await mobile.waitForFunction(() => Boolean(window.Golf112Debug));
      await mobile.waitForTimeout(300);

      const metrics = await mobile.evaluate(() => ({
        scrollWidth: document.documentElement.scrollWidth,
        innerWidth,
        canvas: (() => {
          const r = document.querySelector('#game').getBoundingClientRect();
          return { w: Math.round(r.width), h: Math.round(r.height) };
        })(),
      }));
      assert.ok(metrics.scrollWidth <= metrics.innerWidth, 'no horizontal overflow');
      assert.ok(metrics.canvas.w > 250, 'game canvas is usable');
      near(metrics.canvas.w, metrics.canvas.h, 1, 'mobile canvas square');
      await mobile.screenshot({ path: path.join(ARTIFACTS, 'site-mobile.png') });

      const mobileBox = await mobile.locator('#game').boundingBox();
      const start = { x: mobileBox.x + 0.5 * mobileBox.width, y: mobileBox.y + 0.65 * mobileBox.height };
      await mobile.mouse.click(start.x, start.y);
      await mobile.waitForTimeout(120);
      assert.equal(await mobile.evaluate(() => window.Golf112.page), 'levels');

      const levelOne = {
        x: mobileBox.x + (95 / 400) * mobileBox.width,
        y: mobileBox.y + (130 / 400) * mobileBox.height,
      };
      await mobile.mouse.click(levelOne.x, levelOne.y);
      await mobile.waitForTimeout(250);
      assert.equal(await mobile.evaluate(() => window.Golf112.page), 'gamepage');
      await mobile.locator('#game').screenshot({ path: path.join(ARTIFACTS, 'gameplay-mobile.png') });
      assert.equal(mobileErrors.length, 0, mobileErrors.join(' | '));
      assert.equal(mobileBad.length, 0, mobileBad.join(' | '));
      await mobileContext.close();
    }));

    const failed = results.filter((r) => !r.ok);
    console.log('\n──────────────────────────────────────────────');
    console.log(`Results: ${results.length - failed.length}/${results.length} checks passed`);
    for (const r of results) {
      console.log(`${r.ok ? '✓' : '✗'} ${r.name} (${r.ms} ms)`);
    }
    if (failed.length) process.exitCode = 1;
  } finally {
    await context.close();
    await browser.close();
    server.close();
  }
}

main().catch((err) => {
  console.error('\nFATAL:', err.stack || err);
  process.exitCode = 1;
});
