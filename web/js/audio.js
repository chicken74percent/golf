/**
 * Audio for Golf 112.
 *
 * The original cmu_graphics game uses five MP3 assets:
 *   BGM (looped, volume 0.6), GolfHit, WallHit, WinSound (0.6), Fail.
 *
 * Browser autoplay rules mean the background track cannot start until the
 * first user gesture. We therefore stream BGM through an <audio> element and
 * decode the short effects with the Web Audio API (low latency, overlapping
 * voices). A short throttle on WallHit avoids the machine-gun stacking that
 * happens when the physics loop reports many wall contacts in one frame.
 */

const SFX = {
  golfHit: { file: 'GolfHit.mp3', volume: 0.85, minInterval: 30 },
  wallHit: { file: 'WallHit.mp3', volume: 0.55, minInterval: 55 },
  win: { file: 'WinSound.mp3', volume: 0.6, minInterval: 0 },
  fail: { file: 'Fail.mp3', volume: 0.8, minInterval: 0 },
};

const MUTE_KEY = 'golf112.muted.v1';

export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.unlocked = false;
    this.startedBgm = false;
    this.muted = readMuted();
    this.buffers = new Map();
    this.raw = new Map();
    this.lastPlayed = new Map();
    this.playCounts = { golfHit: 0, wallHit: 0, win: 0, fail: 0 };
    this.decodeState = 'idle';
    this.bgmState = 'idle';

    this.bgm = new Audio(resolveAsset('BGM.mp3'));
    this.bgm.loop = true;
    this.bgm.preload = 'auto';
    this.bgm.volume = 0.6;
    this.bgm.muted = this.muted;
    this.bgm.addEventListener('error', () => {
      this.bgmState = 'error';
    });
    this.bgm.addEventListener('playing', () => {
      this.bgmState = 'playing';
    });

    // Fetch the effects immediately; decoding waits for the first gesture.
    for (const entry of Object.values(SFX)) {
      fetch(resolveAsset(entry.file))
        .then((res) => {
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          return res.arrayBuffer();
        })
        .then((buf) => {
          this.raw.set(entry.file, buf);
          if (this.ctx) this.decode(entry.file, buf);
        })
        .catch((err) => {
          console.warn(`[golf112] Could not load ${entry.file}:`, err.message);
        });
    }
  }

  /** Must be called from a user gesture (pointerdown / keydown / button click). */
  async unlock() {
    this.unlocked = true;
    if (!this.ctx) {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (Ctx) {
        try {
          this.ctx = new Ctx();
          this.master = this.ctx.createGain();
          this.master.gain.value = this.muted ? 0 : 1;
          this.master.connect(this.ctx.destination);
          this.decodeState = 'decoding';
          for (const [file, buf] of this.raw) this.decode(file, buf);
        } catch (err) {
          console.warn('[golf112] Web Audio unavailable:', err.message);
          this.ctx = null;
        }
      }
    }
    // Start the <audio> element synchronously inside the gesture so Safari's
    // stricter autoplay policy sees a direct user activation. AudioContext
    // resumption can happen afterward.
    if (!this.muted) this.startBgm();

    if (this.ctx && this.ctx.state === 'suspended') {
      try {
        await this.ctx.resume();
      } catch {
        /* Browser may refuse if this was not a real gesture. */
      }
    }
  }

  startBgm() {
    if (!this.muted && this.bgm.paused) {
      this.bgm.volume = 0.6;
      this.bgm.muted = false;
      const attempt = this.bgm.play();
      if (attempt && typeof attempt.catch === 'function') {
        attempt
          .then(() => {
            this.startedBgm = true;
            this.bgmState = 'playing';
          })
          .catch(() => {
            // Autoplay was blocked; the next gesture will try again.
            this.bgmState = 'blocked';
          });
      }
    }
  }

  decode(file, arrayBuffer) {
    if (!this.ctx || this.buffers.has(file)) return;
    // decodeAudioData consumes the buffer, so keep a copy for retries.
    const copy = arrayBuffer.slice(0);
    this.ctx
      .decodeAudioData(copy)
      .then((decoded) => {
        this.buffers.set(file, decoded);
        if (this.buffers.size === Object.keys(SFX).length) {
          this.decodeState = 'ready';
        }
      })
      .catch((err) => {
        console.warn(`[golf112] Could not decode ${file}:`, err.message);
        this.decodeState = 'error';
      });
  }

  play(name) {
    if (this.muted || !this.unlocked || !this.ctx || !this.master) return;
    const entry = SFX[name];
    if (!entry) return;
    const buffer = this.buffers.get(entry.file);
    if (!buffer) return;

    const now = this.ctx.currentTime * 1000;
    const last = this.lastPlayed.get(name) || -Infinity;
    if (now - last < entry.minInterval) return;
    this.lastPlayed.set(name, now);

    const source = this.ctx.createBufferSource();
    source.buffer = buffer;
    const gain = this.ctx.createGain();
    gain.gain.value = entry.volume;
    source.connect(gain);
    gain.connect(this.master);
    source.start();
    this.playCounts[name] = (this.playCounts[name] || 0) + 1;
  }

  setMuted(muted) {
    this.muted = muted;
    try {
      localStorage.setItem(MUTE_KEY, muted ? '1' : '0');
    } catch {
      /* Storage may be disabled; the in-memory value still works. */
    }
    if (this.master) {
      this.master.gain.setTargetAtTime(
        muted ? 0 : 1,
        this.ctx.currentTime,
        0.015,
      );
    }
    this.bgm.muted = muted;
    if (!muted && this.unlocked) {
      this.startBgm();
    }
  }

  toggleMuted() {
    this.setMuted(!this.muted);
    return this.muted;
  }

  status() {
    return {
      muted: this.muted,
      unlocked: this.unlocked,
      context: this.ctx ? this.ctx.state : 'none',
      decode: this.decodeState,
      decoded: [...this.buffers.keys()],
      bgm: this.bgmState,
      bgmPaused: this.bgm.paused,
      playCounts: { ...this.playCounts },
    };
  }
}

function resolveAsset(file) {
  return new URL(`../assets/${file}`, import.meta.url).href;
}

function readMuted() {
  try {
    return localStorage.getItem(MUTE_KEY) === '1';
  } catch {
    return false;
  }
}
