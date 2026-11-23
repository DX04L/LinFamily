/**
 * Pinky Jump
 * 還原角色設計細節：
 * - 粉白雙色毛絨貓耳 + 尖端寶藍色雙絨球
 * - 粉色瀏海 + 額頭寶藍菱形寶石 + 兩側灰點眉飾
 * - 寶藍大眼 + 玫紅花邊眼眶 + 桃紅圓腮紅 + 雙側白色翹毛
 * - 寶藍項圈 + 金黃紅菱形鈴鐺徽章
 */

const canvas = document.getElementById('game-canvas');
const ctx = canvas.getContext('2d');

// UI 元素
const startPanel = document.getElementById('start-panel');
const gameoverPanel = document.getElementById('gameover-panel');
const startBtn = document.getElementById('start-btn');
const restartBtn = document.getElementById('restart-btn');
const fullscreenBtn = document.getElementById('fullscreen-btn');
const forceFullscreenBtn = document.getElementById('force-fullscreen-btn');
const muteBtn = document.getElementById('mute-btn');
const rotateOverlay = document.getElementById('rotate-overlay');
const currentScoreEl = document.getElementById('current-score');
const hiScoreEl = document.getElementById('hi-score');
const finalScoreEl = document.getElementById('final-score');
const newRecordBadge = document.getElementById('new-record-badge');

// 音效合成器 (Web Audio API，無需外部音檔即可發出可愛 8-bit 音效)
class SoundFX {
  constructor() {
    this.ctx = null;
    this.muted = false;
  }
  init() {
    if (!this.ctx || this.ctx.state === 'closed') {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    }
    // iPad/iPhone can leave the context 'suspended' or 'interrupted' after other
    // audio, a notification or switching apps; resume it whenever it isn't running.
    if (this.ctx.state !== 'running') this.ctx.resume().catch(() => {});
  }
  // Called from real taps/keys: iOS only lets audio restart inside a user gesture.
  unlock() {
    if (!this.ctx || this.muted) return;
    if (this.ctx.state !== 'running') {
      this.ctx.resume().catch(() => {});
      const src = this.ctx.createBufferSource();
      src.buffer = this.ctx.createBuffer(1, 1, 22050);
      src.connect(this.ctx.destination);
      src.start(0);
    }
  }
  playTone(freq, type, duration, slideTo = null, vol = 0.15) {
    if (this.muted) return;
    this.init();
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);
    if (slideTo) {
      osc.frequency.exponentialRampToValueAtTime(slideTo, now + duration);
    }
    gain.gain.setValueAtTime(vol, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + duration);
  }
  jump() {
    this.playTone(360, 'sine', 0.18, 720, 0.18);
  }
  coin() {
    this.playTone(880, 'triangle', 0.08, 1320, 0.15);
    setTimeout(() => this.playTone(1320, 'triangle', 0.12, 1760, 0.12), 60);
  }
  milestone() {
    [523.25, 659.25, 783.99, 1046.5].forEach((note, i) =>
      setTimeout(() => this.playTone(note, 'sine', 0.12, null, 0.14), i * 70)
    );
  }
  star() {
    [880,1174,1568].forEach((note,i)=>
      setTimeout(()=>this.playTone(note,'sine',.11,note*1.05,.085),i*56));
  }
  heart() {
    this.playTone(420,'sine',.18,680,.12);
    setTimeout(()=>this.playTone(780,'sine',.16,980,.07),100);
  }
  shieldHit() {
    // Small, light "叮" so it reads clearly apart from the game-over sound.
    this.playTone(880,'sine',.09,660,.05);
    setTimeout(()=>this.playTone(620,'triangle',.08,520,.035),60);
  }
  footstep() {
    this.playTone(125,'sine',.035,90,.019);
  }
  hit() {
    // Soft, comical two-part "啾～噗" failure jingle.
    // Stronger three-part descending game-over sound.
    this.playTone(520,'square',.22,260,.16);
    setTimeout(()=>this.playTone(330,'sawtooth',.26,140,.14),180);
    setTimeout(()=>this.playTone(150,'triangle',.45,55,.2),400);
  }
}

const sfx = new SoundFX();

// Original user-provided soundtrack, renamed and tagged "Pinky Jump Music".
const MUSIC_FILE = 'pinky-jump-music.mp3';
const MUSIC_TITLE = 'Pinky Jump Music';
const MUSIC_VOLUME = .16;
const backgroundMusic = typeof Audio === 'function' ? new Audio(MUSIC_FILE) : null;
if (backgroundMusic) {
  backgroundMusic.title = MUSIC_TITLE;
  backgroundMusic.loop = true;
  backgroundMusic.preload = 'auto';
  backgroundMusic.volume = MUSIC_VOLUME;
}
let musicGain = null;
let musicFadeTimer = null;
function setMusicVolume(volume) {
  if (musicGain) musicGain.gain.value = volume;
  else backgroundMusic.volume = volume;
}
function prepareMusicAudio() {
  if (musicGain) return;
  try {
    sfx.init();
    const shelf = sfx.ctx.createBiquadFilter();
    shelf.type = 'highshelf';
    shelf.frequency.value = 3000;
    shelf.gain.value = -5;
    const gain = sfx.ctx.createGain();
    gain.gain.value = MUSIC_VOLUME;
    shelf.connect(gain);
    gain.connect(sfx.ctx.destination);
    // Only the background track goes through this EQ.
    sfx.ctx.createMediaElementSource(backgroundMusic).connect(shelf);
    backgroundMusic.volume = 1;
    musicGain = gain;
  } catch (error) {
    console.warn('Pinky Jump Music EQ unavailable:', error);
  }
}
let footstepDistance = 0;
function updateMediaSession(state) {
  if (typeof navigator === 'undefined' || !navigator.mediaSession) return;
  try {
    if (typeof MediaMetadata === 'function') {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: MUSIC_TITLE,
        artist: 'Pinky Jump',
        album: 'Pinky Jump',
        artwork: [{src: new URL('pinky-icon.png?v=3', window.location.href).href,
                   sizes: '128x128', type: 'image/png'}]
      });
    }
    navigator.mediaSession.playbackState = state;
  } catch (error) { console.warn('Pinky Jump media metadata:', error); }
}
function beginMusic() {
  if (musicFadeTimer) { clearInterval(musicFadeTimer); musicFadeTimer = null; }
  if (!backgroundMusic || sfx.muted) return;
  backgroundMusic.pause();
  backgroundMusic.currentTime = 0;
  backgroundMusic.playbackRate = 1;
  prepareMusicAudio();
  setMusicVolume(MUSIC_VOLUME);
  updateMediaSession('playing');
  const result = backgroundMusic.play();
  if (result && typeof result.catch === 'function') {
    result.catch(error => {
      updateMediaSession('paused');
      console.warn('Pinky Jump Music could not play:', error);
    });
  }
}
if (backgroundMusic) {
  backgroundMusic.addEventListener('error', () => {
    updateMediaSession('paused');
    console.warn('Pinky Jump Music file unavailable:', MUSIC_FILE);
  });
}
function endMusic() {
  if (!backgroundMusic || backgroundMusic.paused) {
    updateMediaSession('paused');
    return;
  }
  if (musicFadeTimer) clearInterval(musicFadeTimer);
  let volume = musicGain ? musicGain.gain.value : backgroundMusic.volume;
  musicFadeTimer = setInterval(() => {
    volume = Math.max(0, volume - MUSIC_VOLUME / 4);
    setMusicVolume(volume);
    if (volume <= 0) {
      clearInterval(musicFadeTimer);
      musicFadeTimer = null;
      backgroundMusic.pause();
      backgroundMusic.currentTime = 0;
      updateMediaSession('paused');
    }
  }, 35);
}
function updateMusic() {
  if (backgroundMusic && !backgroundMusic.paused) {
    backgroundMusic.playbackRate = Math.min(1.07, 1 + Math.max(0, gameSpeed - 7) * .007);
  }
}

// Gameplay state and canvas sizing.
// World units: the game world is designed for a desktop landscape screen (WORLD_H tall) and every
// device shows the same world, scaled to fit. Taller screens just show more sky; shorter screens
// shrink everything. MIN_WORLD_W keeps enough road visible ahead on narrow portrait phones.
const WORLD_H = 800;
const MIN_WORLD_W = 720;
// Highest jump keeps the cat's head about half a cat below the HUD (cat ≈ 68 world px).
const CAT_HEIGHT = 68;
const MAX_RISE = 520;
function jumpTopMargin() { return hudClearance + CAT_HEIGHT * 1.5; }
let viewScale = 1;
let viewZoom = 1;
let hudClearance = 64;
let width = window.innerWidth;
let height = window.innerHeight;
let dpr = Math.min(window.devicePixelRatio || 1, 2);
let gameState = 'START';
let score = 0;
let shield = 0;
let immunity = 0;
let shieldShake = 0;
// Jump sources this run. A run counts as Motion only when every jump came from motion.
let runJumps = {motion:0, manual:0};
function bumpShieldIcon() {
  const box = document.querySelector('.shield-box');
  if (!box) return;
  box.classList.remove('shield-hit');
  void box.offsetWidth;
  box.classList.add('shield-hit');
}
const shieldEl = document.getElementById('shield-hearts');
const MAX_HEARTS = 5;
// Show collected hearts as filled red hearts out of 5 slots.
function renderHearts() {
  shieldEl.querySelectorAll('i').forEach((el, i) => {
    const on = i < shield;
    el.classList.toggle('on', on);
    el.textContent = on ? '♥' : '♡';
  });
  shieldEl.setAttribute('aria-label', shield + ' / ' + MAX_HEARTS);
}
// Cheat: tap the hearts box 5 times in a row before a run → start with 5 hearts.
// That run is never logged to the leaderboard; the next run is normal again.
let cheatRun = false, cheatTaps = 0, cheatLastTap = 0;
// Fast taps count too: every finger counts (no isPrimary check) and the box blocks zoom/selection.
document.querySelector('.shield-box').addEventListener('pointerdown', event => {
  const ready = gameState === 'START' || (gameState === 'GAMEOVER' && performance.now() - gameOverAt > 700);
  if (!ready || !document.getElementById('record-panel').classList.contains('hidden')) return;
  event.preventDefault();
  const now = performance.now();
  cheatTaps = now - cheatLastTap < 800 ? cheatTaps + 1 : 1;
  cheatLastTap = now;
  if (cheatTaps >= MAX_HEARTS) startGame(true);
});
let gameSpeed = 7;
let frameCount = 0;
let lastMilestone = 0;
const SIMULATION_STEP = 1000 / 60;
const MAX_CATCH_UP = 4 * SIMULATION_STEP;
let lastFrameTime = null;
let frameTimeRemaining = 0;
let needsPaint = true;
hiScoreEl.textContent = '-----';

// Previous physics step, for render interpolation (see paintFrame).
const prevState = {valid:false, camY:0, px:0, py:0, dist:0, speed:0};
function resizeCanvas() {
  prevState.valid = false;
  const screenW = window.innerWidth, screenH = window.innerHeight;
  // Phones zoom in ×1.3 so the cat isn't tiny (rules stay in world units). In landscape the camera
  // follows the cat up near the top of a jump (Super Mario style).
  const phone = Math.min(screenW, screenH) < 600;
  viewZoom = phone ? 1.3 : 1;
  viewScale = Math.min(screenW / MIN_WORLD_W, screenH / WORLD_H) * viewZoom;
  width = screenW / viewScale;
  height = screenH / viewScale;
  dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = screenW * dpr;
  canvas.height = screenH * dpr;
  ctx.setTransform(dpr * viewScale, 0, 0, dpr * viewScale, 0, 0);
  const hud = document.getElementById('hud')?.getBoundingClientRect();
  hudClearance = ((hud && hud.bottom > 0 ? hud.bottom : 64) / viewScale);
  needsPaint = true;
  checkOrientation();
}
function checkOrientation() {
  // Both portrait and landscape are supported.
  rotateOverlay.classList.add('hidden');
}
window.addEventListener('resize', resizeCanvas);
window.addEventListener('orientationchange', () => setTimeout(resizeCanvas, 150));

async function enterLandscapeFullscreen() {
  try {
    const element = document.documentElement;
    if (!document.fullscreenElement && !document.webkitFullscreenElement) {
      if (element.requestFullscreen) await element.requestFullscreen();
      else if (element.webkitRequestFullscreen) await element.webkitRequestFullscreen();
    } else if (document.exitFullscreen) await document.exitFullscreen();
    else if (document.webkitExitFullscreen) await document.webkitExitFullscreen();
    // Rotation lock is best-effort, not required for the game.
    if (screen.orientation && screen.orientation.lock)
      await screen.orientation.lock('landscape').catch(() => {});
  } catch (error) {
    console.info('Fullscreen is unavailable:', error);
  }
}
fullscreenBtn.addEventListener('click', enterLandscapeFullscreen);
forceFullscreenBtn.addEventListener('click', async () => {
  await enterLandscapeFullscreen();
  rotateOverlay.classList.add('hidden');
});
muteBtn.addEventListener('click', () => {
  sfx.muted = !sfx.muted;
  muteBtn.textContent = sfx.muted ? '🔇' : '🔊';
  muteBtn.setAttribute('aria-pressed', String(!sfx.muted));
  if (!backgroundMusic) return;
  if (sfx.muted) {
    backgroundMusic.pause();
    updateMediaSession('paused');
  } else if (gameState === 'PLAYING') {
    prepareMusicAudio();
    setMusicVolume(MUSIC_VOLUME);
    updateMediaSession('playing');
    const result = backgroundMusic.play();
    if (result && typeof result.catch === 'function') {
      result.catch(error => {
        updateMediaSession('paused');
        console.warn('Pinky Jump Music could not resume:', error);
      });
    }
  }
});
// Mild, occasional rolling terrain. The shape is shared by rendering and physics.
let terrainDistance = 0;
let cameraY = 0;
// Build a different endless road at the start of every run.
let terrainRoute = [[0,0],[900,0]];
let terrainPhase = 0;
function extendTerrainTo(worldX) {
  while (terrainRoute[terrainRoute.length - 1][0] < worldX) {
    const [lastX,lastY] = terrainRoute[terrainRoute.length-1];
    const roll=Math.random();
    let nextY,length;
    if (lastY < -.5) {
      if (roll < .42) { nextY=lastY; length=500+Math.random()*850; }
      else { nextY=Math.random()*.43; length=1400+Math.random()*1100; }
    } else if (lastY > .24) {
      if (roll < .4) { nextY=lastY; length=520+Math.random()*800; }
      else { nextY=Math.random()<.3?-.72:0; length=1050+Math.random()*850; }
    } else if (roll < .15) {
      nextY=-.78-Math.random()*.44; length=1450+Math.random()*1100;
    } else if (roll < .27) {
      nextY=.29+Math.random()*.16; length=1150+Math.random()*900;
    } else if (roll < .52) {
      nextY=(Math.random()-.5)*.18; length=550+Math.random()*850;
    } else { nextY=lastY; length=600+Math.random()*950; }
    terrainRoute.push([lastX+length,nextY]);
  }
}
function baseGroundY() { return Math.max(height*.78,height-90); }
function getGroundY(x=width*.17) {
  const worldX=Math.max(0,terrainDistance+x);
  extendTerrainTo(worldX+width+100);
  let left=1,right=terrainRoute.length-1;
  while(left<right) {
    const mid=Math.floor((left+right)/2);
    if(worldX<=terrainRoute[mid][0])right=mid;else left=mid+1;
  }
  const [startX,startY]=terrainRoute[left-1];
  const [endX,endY]=terrainRoute[left];
  const t=Math.max(0,Math.min(1,(worldX-startX)/(endX-startX)));
  const ease=t*t*(3-2*t);
  return baseGroundY()+(startY+(endY-startY)*ease)*WORLD_H+
    WORLD_H*(Math.sin(worldX/290+terrainPhase)*.012+
            Math.sin(worldX/117+terrainPhase*.68)*.005);
}

// The player is separate from SoundFX; jump physics belongs here.
const SHORT_JUMP_RISE = 42;
const LUNGE_MAX = 38;
const player = {
  x: 90,
  baseX: 90,
  lunge: 0, // Forward push on screen during a jump (world px); eases back after landing.
  lungeV: 0,
  tilt: 0,
  squash: 0, // >0 stretch (taller), <0 squash (flatter); visual only
  squashV: 0,
  y: 0,
  vy: 0,
  gravity: 0.78,
  isGrounded: true,
  jumpCameraLimit: Infinity,
  jumpInput: null,
  launchY: 0,
  launchVelocity: 0,
  runCycle: 0,
  blinkTimer: 0,
  hurt: false,

  getScale() {
    return Math.max(0.64, Math.min(1, width / 550, height / 510));
  },
  reset() {
    this.baseX = Math.max(52, Math.min(110, width * 0.17));
    this.lunge = this.lungeV = this.tilt = this.squash = this.squashV = 0;
    this.x = this.baseX;
    this.y = getGroundY();
    this.vy = 0;
    this.isGrounded = true;
    this.jumpInput = null;
    this.hurt = false;
  },
  jump(input = null, power = 1) {
    if (!this.isGrounded || gameState !== 'PLAYING') return;
    // Keyboard and canvas input can trim an ascent; remote input supplies the chosen power.
    // Full jump: the same height in world units on every device (desktop landscape reference),
    // ascent always 25 frames. The camera rises if needed so the head stays half a cat below the HUD.
    let rise = MAX_RISE;
    this.gravity = 2 * rise / (25 * 25);
    const shortRise = Math.min(SHORT_JUMP_RISE,rise);
    rise = shortRise + (rise - shortRise) * power;
    this.jumpCameraLimit = this.y - rise - jumpTopMargin();
    this.vy = -Math.sqrt(2 * this.gravity * rise) - this.gravity / 2;
    this.isGrounded = false;
    this.jumpInput = input;
    this.launchY = this.y;
    this.launchVelocity = this.vy;
    this.squashV += 0.05 + 0.05 * power; // stretch upward on takeoff (visual only)
    sfx.jump();
    spawnDust(this.x, this.y, '#f784ba', 8);
  },
  update() {
    // Test: the cat surges forward while airborne, then drifts back to its spot after landing.
    // Hitbox follows the drawn cat, so the jump really carries it a little further.
    // Critically damped spring: starts and stops smoothly (no jolt on takeoff or landing).
    const lungeTarget = this.isGrounded ? 0 : LUNGE_MAX;
    const k = this.isGrounded ? 0.004 : 0.014;
    this.lungeV += (lungeTarget - this.lunge) * k - this.lungeV * 2 * Math.sqrt(k);
    this.lunge += this.lungeV;
    this.x = this.baseX + this.lunge;
    const groundY = getGroundY(this.x);
    if (this.isGrounded) {
      // Walk smoothly over the slope instead of running through the hill.
      this.y = groundY;
      this.vy = 0;
    } else {
      this.vy += this.gravity;
      this.y += this.vy;
      if (this.y >= groundY) {
        this.squashV -= Math.min(0.09, 0.02 + this.vy * 0.004); // squash on landing (visual only)
        this.y = groundY;
        this.vy = 0;
        this.isGrounded = true;
      }
    }
    const tiltTarget = !this.isGrounded ? Math.max(-0.22, Math.min(0.22, this.vy * 0.015)) : 0;
    this.tilt += (tiltTarget - this.tilt) * 0.2;
    this.squashV += -this.squash * 0.22 - this.squashV * 0.32;
    this.squash = Math.max(-0.22, Math.min(0.22, this.squash + this.squashV));
    if (this.isGrounded && gameState === 'PLAYING') this.runCycle += gameSpeed * 0.032;
    this.blinkTimer++;
  },

  getHitbox() {
    return {
      x: this.x - 22,
      y: this.y - 68,
      w: 44,
      h: 66
    };
  },

  draw() {
    ctx.save();
    // Brief shake after the shield absorbs a hit.
    const shake = shieldShake > 0 ? Math.sin(shieldShake * 1.9) * shieldShake * .45 : 0;
    // Blink during the 1.5s of invincibility after losing a shield.
    if (immunity > 0 && Math.floor(immunity / 6) % 2) ctx.globalAlpha = .35;
    ctx.translate(this.x + shake, this.y);
    ctx.scale(this.getScale(),this.getScale());

    const bounce = this.isGrounded ? Math.abs(Math.sin(this.runCycle)) * -5 : 0;
    const tilt = this.tilt;

    // 地面陰影
    const groundOffset = getGroundY(this.x) - this.y;
    const shadowScale = Math.max(0.4, 1 - groundOffset / 240);
    ctx.fillStyle = 'rgba(214, 40, 114, 0.2)';
    ctx.beginPath();
    ctx.ellipse(0, groundOffset + 2, 28 * shadowScale, 7 * shadowScale, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.translate(0, bounce);
    ctx.scale(1 - this.squash * 0.6, 1 + this.squash);
    ctx.rotate(tilt);

    // 1. 粉白尾巴 (擺動)
    const tailWag = Math.sin(this.runCycle * 1.2) * 0.35;
    ctx.save();
    ctx.translate(-18, -22);
    ctx.rotate(tailWag - 0.4);
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#ff6eb4';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.ellipse(-10, 0, 14, 8, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#ff7eb9';
    ctx.beginPath();
    ctx.arc(-18, 0, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // 2. 身體與小腳丫 (奔跑擺動)
    const legSwing = this.isGrounded ? Math.sin(this.runCycle) * 8 : 5;

    // 後腳
    this.drawFoot(-10 - legSwing, -8);
    // 身體
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#f5a3c7';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.ellipse(0, -24, 19, 20, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // 身體粉色斑點
    ctx.fillStyle = '#ff8cc3';
    ctx.beginPath();
    ctx.arc(-10, -22, 6, 0, Math.PI * 2);
    ctx.arc(10, -20, 5.5, 0, Math.PI * 2);
    ctx.fill();

    // 前腳
    this.drawFoot(10 + legSwing, -7);

    // 前手：跑步時擺動、跳躍時舉高、撞到時張開
    let armL, armR;
    if (this.hurt) { armL = 1.2; armR = -1.2; }
    else if (!this.isGrounded) { armL = 1.95; armR = -1.95; }
    else { const swing = Math.sin(this.runCycle) * 0.55; armL = 0.35 + swing; armR = -0.35 + swing; }
    this.drawArm(-15, -37, armL);
    this.drawArm(15, -37, armR);

    // 3. 寶藍色項圈與金黃紅菱形徽章
    ctx.fillStyle = '#0d52e8';
    ctx.strokeStyle = '#0836a3';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(-17, -42, 34, 9, 5);
    ctx.fill();
    ctx.stroke();

    // 金色圓形吊墜
    ctx.fillStyle = '#ffd426';
    ctx.strokeStyle = '#e09b00';
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.arc(4, -35, 7.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // 吊墜中央紅色菱形
    ctx.fillStyle = '#e81e4a';
    ctx.beginPath();
    ctx.moveTo(4, -40);
    ctx.lineTo(8, -35);
    ctx.lineTo(4, -30);
    ctx.lineTo(0, -35);
    ctx.closePath();
    ctx.fill();

    // 4. 大頭與特徵（參考毛絨原稿）
    ctx.save();
    ctx.translate(2, -62);

    // 左右貓耳朵
    this.drawEar(-18, -20, -0.3, false);
    this.drawEar(18, -20, 0.3, true);

    // 頭形：圓頂 + 兩側外翹的毛絨翼
    const head = new Path2D();
    head.moveTo(-27, -6);
    head.quadraticCurveTo(-36, 0, -45, -5);
    head.quadraticCurveTo(-40, 17, -20, 19);
    head.quadraticCurveTo(0, 25, 20, 19);
    head.quadraticCurveTo(40, 17, 45, -5);
    head.quadraticCurveTo(36, 0, 27, -6);
    head.arc(0, -6, 27.5, 0, Math.PI, true);
    head.closePath();
    ctx.fillStyle = '#ff7eb9';
    ctx.fill(head);

    // 白色臉部：從額頭寶石往下展開到兩側翼尖
    ctx.save();
    ctx.clip(head);
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(-48, -2);
    ctx.quadraticCurveTo(-32, 3, -25, -4);
    ctx.quadraticCurveTo(-10, -7, -2.5, -13);
    ctx.lineTo(0, -16);
    ctx.lineTo(2.5, -13);
    ctx.quadraticCurveTo(10, -7, 25, -4);
    ctx.quadraticCurveTo(32, 3, 48, -2);
    ctx.lineTo(48, 24);
    ctx.lineTo(-48, 24);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    ctx.strokeStyle = '#f0559e';
    ctx.lineWidth = 2.4;
    ctx.stroke(head);

    // 額頭寶藍色菱形
    ctx.fillStyle = '#1d3fb8';
    ctx.beginPath();
    ctx.moveTo(0, -24);
    ctx.lineTo(3.6, -18.5);
    ctx.lineTo(0, -13);
    ctx.lineTo(-3.6, -18.5);
    ctx.closePath();
    ctx.fill();

    // 灰色點狀眉飾（從寶石往兩側微微上揚）
    ctx.fillStyle = '#6e737b';
    for (const [dx, dy] of [[7, -21], [11, -22.5], [15, -23.6], [19, -24.2], [23, -24.2]]) {
      ctx.beginPath();
      ctx.arc(dx, dy, 1.25, 0, Math.PI * 2);
      ctx.arc(-dx, dy, 1.25, 0, Math.PI * 2);
      ctx.fill();
    }

    // 粉紅細鬍鬚
    ctx.strokeStyle = '#ff9cc9';
    ctx.lineWidth = 1.1;
    ctx.beginPath();
    for (const side of [-1, 1]) {
      ctx.moveTo(side * 31, 8); ctx.lineTo(side * 41, 5.5);
      ctx.moveTo(side * 31, 11); ctx.lineTo(side * 41, 10.5);
    }
    ctx.stroke();

    // 大眼睛：寶藍虹膜 + 紅色花瓣眼眶
    this.drawEye(-14, 2.5, -1);
    this.drawEye(14, 2.5, 1);

    // 桃紅色圓腮紅
    ctx.fillStyle = '#e0187a';
    ctx.beginPath();
    ctx.arc(-24, 11, 4.6, 0, Math.PI * 2);
    ctx.arc(24, 11, 4.6, 0, Math.PI * 2);
    ctx.fill();

    // 紅色三角鼻
    ctx.fillStyle = '#e8253f';
    ctx.beginPath();
    ctx.moveTo(-3.8, 7.5);
    ctx.lineTo(3.8, 7.5);
    ctx.lineTo(0, 11.5);
    ctx.closePath();
    ctx.fill();

    // ω 形嘴巴
    ctx.strokeStyle = '#e8253f';
    ctx.lineWidth = 1.9;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-8.5, 12.5);
    ctx.quadraticCurveTo(-7.5, 17, -4, 16.6);
    ctx.quadraticCurveTo(-0.6, 16.2, 0, 12.8);
    ctx.quadraticCurveTo(0.6, 16.2, 4, 16.6);
    ctx.quadraticCurveTo(7.5, 17, 8.5, 12.5);
    ctx.stroke();

    ctx.restore();
    ctx.restore();
  },

  drawArm(x, y, angle) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#f5a3c7';
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.ellipse(0, 7, 5.6, 9, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#ff8cc3';
    ctx.beginPath();
    ctx.ellipse(0, 11.5, 3.6, 3.2, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  },

  drawFoot(x, y) {
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#ff7eb9';
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.ellipse(x, y, 8.5, 6.8, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // 粉色大腳掌
    ctx.fillStyle = '#ff74b5';
    ctx.beginPath();
    ctx.ellipse(x + 3, y, 4.6, 5.2, 0, 0, Math.PI * 2);
    ctx.fill();
  },

  drawEar(x, y, angle, isRight) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);

    // 外耳粉紅
    ctx.fillStyle = '#ff7eb9';
    ctx.strokeStyle = '#f0559e';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-13, 8);
    ctx.quadraticCurveTo(-12, -16, 0, -25);
    ctx.quadraticCurveTo(12, -16, 13, 8);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // 內耳白色長條（靠臉內側）
    const inner = isRight ? -1 : 1;
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(inner * -1, -20);
    ctx.quadraticCurveTo(inner * 9, -9, inner * 10, 6);
    ctx.lineTo(inner * 1, 6);
    ctx.quadraticCurveTo(inner * -2, -8, inner * -1, -20);
    ctx.fill();

    // 耳根白色鋸齒星形
    ctx.beginPath();
    ctx.moveTo(-10, 7);
    ctx.lineTo(-8, 1);
    ctx.lineTo(-5, 4);
    ctx.lineTo(-2, -1);
    ctx.lineTo(1, 4);
    ctx.lineTo(4, 0);
    ctx.lineTo(6, 5);
    ctx.lineTo(10, 7);
    ctx.closePath();
    ctx.fill();

    // 耳尖三顆寶藍色絨球
    const out = isRight ? 1 : -1;
    ctx.fillStyle = '#1550e0';
    ctx.beginPath();
    ctx.arc(out * 1, -26, 2.7, 0, Math.PI * 2);
    ctx.arc(out * 4.2, -21.5, 2.4, 0, Math.PI * 2);
    ctx.arc(out * 5.2, -17, 2.3, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  },

  drawEye(x, y, side) {
    // 撞到時顯示 X 眼
    if (this.hurt) {
      ctx.strokeStyle = '#1d3fb8';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(x - 4, y - 4);
      ctx.lineTo(x + 4, y + 4);
      ctx.moveTo(x + 4, y - 4);
      ctx.lineTo(x - 4, y + 4);
      ctx.stroke();
      return;
    }
    ctx.save();
    ctx.translate(x, y);

    // 紅色花瓣邊（在眼睛外上方）
    ctx.fillStyle = '#e8253f';
    for (let i = 0; i < 5; i++) {
      const a = -Math.PI / 2 + side * (0.1 + i * 0.34);
      ctx.beginPath();
      ctx.arc(Math.cos(a) * 9.8, Math.sin(a) * 11.2, 2.5, 0, Math.PI * 2);
      ctx.fill();
    }

    // 眼白 + 紅色眼眶
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#e8253f';
    ctx.lineWidth = 1.9;
    ctx.beginPath();
    ctx.ellipse(0, 0, 9.4, 10.8, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // 寶藍虹膜（偏向臉內側，外側露出眼白）
    ctx.fillStyle = '#1b2f9c';
    ctx.beginPath();
    ctx.ellipse(-side * 1.6, 0.8, 7.1, 9, 0, 0, Math.PI * 2);
    ctx.fill();

    // 白色小高光
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(-side * 1.5 + 2, -3.6, 1.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
};

// 障礙物與金幣管理
let obstacles = [];
let coins = [];
let particles = [];
let clouds = [];
let bgHills = [];
let spawnTimer = 0;
let planes=[];

function initScenery() {
  clouds = [];
  for (let i = 0; i < 6; i++) {
    clouds.push({
      x: Math.random() * width,
      y: 50 + Math.random() * (height * 0.35),
      scale: 0.6 + Math.random() * 0.7,
      speed: 0.4 + Math.random() * 0.6
    });
  }
  planes=[]; // Airplanes are flying obstacles, not static scenery.
  bgHills = [];
  for (let i = 0; i < 5; i++) {
    bgHills.push({
      x: i * 320,
      w: 360,
      h: 70 + (i % 3) * 35,
      color: i % 2 === 0 ? [255,194,224] : [255,217,236]
    });
  }
}

function spawnDust(x, y, color, count = 6) {
  for (let i = 0; i < count; i++) {
    particles.push({
      x,
      y: y - 4,
      vx: (Math.random() - 0.5) * 5,
      vy: -Math.random() * 4 - 1,
      size: 3 + Math.random() * 4,
      color,
      life: 1
    });
  }
}

function spawnEntity() {
  const x = width + 60;
  const groundY = getGroundY(x);
  const r = Math.random();
  if (score > 90 && r < 0.20) {
    // Birds fly lower than airplanes, entering from the right.
    const kinds = ['robin','chick','butterfly'];
    obstacles.push({
      type:'bird', kind:kinds[Math.floor(Math.random()*kinds.length)],
      x, y:groundY-(62+Math.random()*110),
      w:44, h:32, flap:0
    });
  } else if (score > 150 && r < 0.36) {
    // Random size: from the original 62×30 up to 2.5×.
    const size = 1 + Math.random() * 1.5;
    obstacles.push({
      type:'airplane', x, y:groundY - WORLD_H*(0.43 + Math.random()*0.13),
      w:62*size, h:30*size, flap:0
    });
  } else if (score > 250 && r < 0.51) {
    const shift = baseGroundY() - Math.max(WORLD_H*.78, WORLD_H-90);
    const gapY = Math.max(82, (groundY - shift)*0.28) + shift;
    const gapH = Math.max(105, Math.min(165, WORLD_H*0.27));
    obstacles.push({type:'cloudGate',x,y:gapY,w:100,h:gapH});
    coins.push({type:'star',x:x+48,y:gapY+gapH/2,r:13,collected:false,spin:0});
  } else if (score > 90 && r < 0.70) {
    // A few slightly higher mountains; rare tall peaks remain jumpable with one tap.
    const tall = Math.random() < 0.06;
    const ordinary = [48,56,66,78,Math.min(108,WORLD_H*0.20),Math.min(122,WORLD_H*0.235)];
    const h = tall
      ? Math.min(285, Math.max(125, WORLD_H * 0.29))
      : ordinary[Math.floor(Math.random()*ordinary.length)];
    const w = tall ? Math.min(136, Math.max(76,h*0.34)) : 64;
    obstacles.push({type:'mountain',x,y:groundY,w,h,tall});
  } else {
    const count=score>460&&Math.random()<.26?2:1;
    obstacles.push({type:'crystal',x,y:groundY,w:count*30,h:45,count});
  }
  if (Math.random() < .85) {
    const roll=Math.random(),type=roll<.11?'heart':roll<.36?'star':'coin';
    const lift = type==='heart'?125:(Math.random()<.5?58:Math.min(180,WORLD_H*.38));
    for(let i=0;i<(type==='coin'?3:1);i++) {
      const cx=x+70+i*34;
      coins.push({type,x:cx,y:getGroundY(cx)-lift-Math.sin(i*Math.PI/2)*15,
        lift:lift+Math.sin(i*Math.PI/2)*15,r:12,collected:false,spin:i*.6});
    }
  }
}

// 碰撞偵測 (AABB 寬容判定)
function checkCollision(a, b) {
  return (
    a.x < b.x + b.w &&
    a.x + a.w > b.x &&
    a.y < b.y + b.h &&
    a.y + a.h > b.y
  );
}

// Each phase covers one stretch of the course, with a blend at the end.
const SCENE_LENGTH = 4500;
const scenes = [
  {sky:[[139,162,226],[255,181,179],[255,232,175]], ground:[245,145,169], edge:[230,80,125], sun:1, sunY:.46, night:0},
  {sky:[[108,184,244],[204,237,255],[253,248,249]], ground:[247,164,202], edge:[243,86,158], sun:.9, sunY:.22, night:0},
  {sky:[[103,89,177],[242,139,164],[255,210,153]], ground:[213,115,159], edge:[223,73,134], sun:1, sunY:.52, night:0},
  {sky:[[23,24,67],[65,37,112],[116,53,118]], ground:[66,28,101], edge:[193,99,184], sun:0, sunY:.62, night:1}
];
const lerp = (a,b,t) => a + (b-a)*t;
function sceneColor(from, to, blend) {
  return 'rgb('+from.map((channel,i)=>Math.round(lerp(channel,to[i],blend))).join(',')+')';
}
function sceneAt(distance) {
  const progress = distance / SCENE_LENGTH;
  const index = Math.floor(progress) % scenes.length;
  const t = Math.max(0, ((progress % 1)-.66)/.34);
  return {current:scenes[index], next:scenes[(index+1)%scenes.length], blend:t*t*(3-2*t)};
}
function drawSky(colors, opacity) {
  ctx.save();
  ctx.globalAlpha = opacity;
  const gradient = ctx.createLinearGradient(0,0,0,height);
  for (const [i,stop] of [0,.65,1].entries())
    gradient.addColorStop(stop,sceneColor(colors[i],colors[i],0));
  ctx.fillStyle = gradient;
  ctx.fillRect(0,0,width,height);
  ctx.restore();
}
function drawBackground() {
  const {current,next,blend} = sceneAt(terrainDistance);
  const darkness = lerp(current.night,next.night,blend);
  drawSky(current.sky,1);
  if (blend > 0) drawSky(next.sky,blend);

  const sun = lerp(current.sun,next.sun,blend);
  const radius = Math.max(14,Math.min(38,height*.08));
  if (sun > 0) {
    ctx.fillStyle = `rgba(255,244,190,${sun*.85})`;
    ctx.beginPath();
    ctx.arc(width*.78,height*lerp(current.sunY,next.sunY,blend),radius,0,Math.PI*2);
    ctx.fill();
  }
  if (darkness > 0) {
    ctx.fillStyle = `rgba(246,239,255,${darkness*.88})`;
    ctx.beginPath();
    ctx.arc(width*.78,height*.22,radius*.7,0,Math.PI*2);
    ctx.fill();
  }

  // 夜間星星閃爍
  if (darkness > 0) {
    ctx.fillStyle = `rgba(255, 245, 180, ${darkness * 0.85})`;
    for (let i = 0; i < 24; i++) {
      const sx = ((i * 197 + frameCount * 0.1) % width);
      const sy = (i * 83) % (height * 0.63);
      const r = (i % 3 === 0) ? 2.5 : 1.5;
      ctx.beginPath();
      ctx.arc(sx, sy, r, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // 背景飛機（純裝飾，不碰撞）
  planes.forEach(p=>{ctx.save();ctx.translate(p.x,p.y);ctx.scale(-1,1);ctx.fillStyle='#f4a6c9';ctx.beginPath();ctx.moveTo(-32,0);ctx.lineTo(25,-3);ctx.lineTo(38,2);ctx.lineTo(8,8);ctx.lineTo(-2,18);ctx.lineTo(-12,18);ctx.lineTo(-8,7);ctx.lineTo(-32,4);ctx.fill();ctx.restore();});
  // 可愛棉花糖雲朵
  clouds.forEach(c => {
    ctx.save();
    ctx.translate(c.x, c.y);
    ctx.scale(c.scale, c.scale);
    ctx.fillStyle = `rgba(255, ${255-41*darkness}, ${255-17*darkness}, ${.9-.65*darkness})`;
    ctx.beginPath();
    ctx.arc(0, 0, 24, 0, Math.PI * 2);
    ctx.arc(22, -6, 28, 0, Math.PI * 2);
    ctx.arc(46, 0, 22, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  });

  // Scenic hills follow the camera more slowly than the actual road.
  ctx.save();
  ctx.translate(0, -cameraY * 0.35);
  const horizon = baseGroundY();
  bgHills.forEach(h => {
    ctx.fillStyle = sceneColor(h.color,[114,68,131],darkness);
    ctx.beginPath();
    ctx.moveTo(h.x, horizon);
    ctx.quadraticCurveTo(h.x+h.w/2, horizon-h.h, h.x+h.w, horizon);
    ctx.fill();
  });
  ctx.restore();

  // Terrain is drawn in world coordinates and shifted by the camera.
  ctx.save();
  ctx.translate(0, -cameraY);
  // The ground itself curves up and down; ground physics uses this same curve.
  ctx.fillStyle = sceneColor(current.ground,next.ground,blend);
  const road = new Path2D();
  road.moveTo(-12,getGroundY(-12));
  for (let x=0; x<=width+14; x+=12) road.lineTo(x,getGroundY(x));
  const ground = new Path2D(road);
  ground.lineTo(width+16,height*4);
  ground.lineTo(-16,height*4);
  ground.closePath();
  ctx.fill(ground);

  ctx.strokeStyle = sceneColor(current.edge,next.edge,blend);
  ctx.lineWidth = 6;
  ctx.stroke(road);

  // Small flowers/dots remain attached to the moving terrain.
  const scrollOffset = terrainDistance % 80;
  ctx.fillStyle='#ffffff';
  ctx.beginPath();
  for (let x=-scrollOffset; x<width+40; x+=80) {
    const y=getGroundY(x);
    ctx.moveTo(x+23,y+18);
    ctx.arc(x+20,y+18,3,0,Math.PI*2);
    ctx.moveTo(x+57.5,y+32);
    ctx.arc(x+55,y+32,2.5,0,Math.PI*2);
  }
  ctx.fill();
  ctx.restore();
}

// 繪製障礙物
function drawObstacles(ctx, objects, groundAt = getGroundY) {
  objects.forEach(obs => {
    if(obs.type==='airplane'){
      ctx.save();ctx.translate(obs.x+obs.w,obs.y+14);ctx.scale(-obs.w/70,obs.h/30); // nose points left, toward the cat
      ctx.fillStyle='#7bbae5';ctx.beginPath();ctx.moveTo(0,0);ctx.lineTo(57,-7);ctx.lineTo(70,0);ctx.lineTo(53,10);ctx.lineTo(22,10);ctx.lineTo(11,18);ctx.lineTo(3,16);ctx.lineTo(10,8);ctx.closePath();ctx.fill();ctx.fillStyle='#fff';ctx.fillRect(25,0,6,4);ctx.fillRect(36,0,6,4);ctx.restore();
    }else if(obs.type==='mountain'){
      const cx=obs.x+obs.w*.5, peak=obs.y-obs.h;
      ctx.fillStyle=obs.tall?'#a9c8b5':'#9ac6ab';
      ctx.beginPath();
      ctx.moveTo(obs.x,groundAt(obs.x));
      ctx.lineTo(cx,peak);
      ctx.lineTo(obs.x+obs.w,groundAt(obs.x+obs.w));
      ctx.closePath();ctx.fill();
      ctx.fillStyle='#fff5f9';ctx.beginPath();
      ctx.moveTo(cx-obs.w*.15,peak+obs.h*.28);
      ctx.lineTo(cx,peak);ctx.lineTo(cx+obs.w*.15,peak+obs.h*.28);ctx.fill();
    }else if(obs.type==='cloudGate'){
      const cloud=(cy)=>{ctx.fillStyle='#fff';for(let j=0;j<4;j++){ctx.beginPath();ctx.arc(obs.x+17+j*23,cy+(j%2)*6,20,0,Math.PI*2);ctx.fill();}};
      cloud(obs.y-15);cloud(obs.y+obs.h+15);
    }else if (obs.type === 'crystal') {
      // 寶藍與洋紅魔法水晶柱 (呼應角色配色)
      for (let i = 0; i < obs.count; i++) {
        const cx = obs.x + i * 28 + 14;
        const ch = obs.h - (i % 2) * 8;
        const isBlue = i % 2 === 0;

        ctx.fillStyle = isBlue ? '#1d5cff' : '#e6197a';
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;

        ctx.beginPath();
        ctx.moveTo(cx - 12, obs.y);
        ctx.lineTo(cx - 9, obs.y - ch + 12);
        ctx.lineTo(cx, obs.y - ch);
        ctx.lineTo(cx + 9, obs.y - ch + 12);
        ctx.lineTo(cx + 12, obs.y);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // 水晶亮面
        ctx.fillStyle = 'rgba(255,255,255,0.35)';
        ctx.beginPath();
        ctx.moveTo(cx, obs.y - ch);
        ctx.lineTo(cx - 5, obs.y - ch + 12);
        ctx.lineTo(cx, obs.y - 6);
        ctx.closePath();
        ctx.fill();
      }
    } else if (obs.type === 'bird') {
      // 飛天小惡魔翼球
      const wingY = Math.sin(obs.flap) * 10;

      ctx.save();
      ctx.translate(obs.x + 22, obs.y + 16);

      // 翅膀
      ctx.fillStyle = '#0d52e8';
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.quadraticCurveTo(10, -18 + wingY, 22, -6 + wingY);
      ctx.quadraticCurveTo(10, 4, 0, 2);
      ctx.fill();

      // 圓球身體
      ctx.fillStyle = '#ff4794';
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, 0, 14, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // 眼睛與尖嘴
      ctx.fillStyle = '#ffd426';
      ctx.beginPath();
      ctx.moveTo(-14, -2);
      ctx.lineTo(-22, 2);
      ctx.lineTo(-14, 5);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(-6, -3, 3.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#111';
      ctx.beginPath();
      ctx.arc(-7, -3, 1.8, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();
    }
  });
}

// 繪製金色魔法幣
function drawCoins(ctx, items) {
  items.forEach(c => {
    if (c.collected) return;
    const scaleX = Math.max(0.25, Math.abs(Math.cos(c.spin)));

    ctx.save();
    ctx.translate(c.x, c.y);
    ctx.scale(scaleX, 1);

    ctx.fillStyle = c.type==='heart'?'#ff65a1':c.type==='star'?'#ffe27a':'#ffd426';
    ctx.strokeStyle = c.type==='heart'?'#c82c68':'#e08e00';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, c.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // 收集物圖樣：金幣／星星／愛心
    if(c.type==='star'){ctx.fillStyle='#fff';ctx.font='20px sans-serif';ctx.textAlign='center';ctx.fillText('★',0,7);ctx.restore();return;}
    if(c.type==='heart'){ctx.fillStyle='#fff';ctx.font='20px sans-serif';ctx.textAlign='center';ctx.fillText('♥',0,7);ctx.restore();return;}
    // 內嵌紅寶石菱形 (呼應角色項圈鈴鐺)
    ctx.fillStyle = '#e81e4a';
    ctx.beginPath();
    ctx.moveTo(0, -6);
    ctx.lineTo(5, 0);
    ctx.lineTo(0, 6);
    ctx.lineTo(-5, 0);
    ctx.closePath();
    ctx.fill();

    ctx.restore();
  });
}

// Reuse the game artwork for the guide without touching the active obstacles.
const guideObstacles = {
  mountain: {x:24,y:51,w:52,h:43},
  crystal: {x:22,y:51,h:42,count:2},
  bird: {x:28,y:14,flap:0},
  airplane: {x:17,y:12,w:66,h:30},
  cloudGate: {x:0,y:38,h:44}
};
for (const icon of document.querySelectorAll('[data-game-icon]')) {
  const iconContext = icon.getContext('2d');
  const type = icon.dataset.gameIcon;
  const obstacle = guideObstacles[type];
  if (obstacle) {
    if (type === 'cloudGate') iconContext.scale(.99,.46);
    drawObstacles(iconContext, [{type,...obstacle}], () => obstacle.y);
  } else {
    drawCoins(iconContext, [{type,x:50,y:30,r:19,spin:0}]);
  }
}

function updateEffects() {
  for (const obs of obstacles) {
    if (obs.type==='bird') obs.flap+=.22;
  }
  for (const coin of coins) coin.spin+=.1;
  for (let i=particles.length-1;i>=0;i--) {
    const p=particles[i];
    p.x+=p.vx;
    p.y+=p.vy;
    p.vy+=.15;
    p.life-=.03;
    if (p.life<=0) particles.splice(i,1);
  }
}
function drawParticles() {
  for (const p of particles) {
    ctx.globalAlpha = p.life;
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x,p.y,p.size,0,Math.PI*2);
    ctx.fill();
  }
  ctx.globalAlpha=1;
}

function updateScenery() {
  for (const plane of planes) {
    plane.x-=plane.speed;
    if (plane.x<-100) plane.x=width+130;
  }
  for (const cloud of clouds) {
    cloud.x-=cloud.speed;
    if (cloud.x<-120) cloud.x=width+120;
  }
  for (const hill of bgHills) {
    hill.x-=gameSpeed*.22;
    if (hill.x+hill.w<0) hill.x+=bgHills.length*320;
  }
}

// Render interpolation: physics stays at 60 Hz; on 90/120/144 Hz screens each painted frame
// blends the previous and current physics step, so motion is smooth on every refresh rate.
function snapshotState() {
  prevState.valid = true;
  prevState.camY = cameraY; prevState.px = player.x; prevState.py = player.y;
  prevState.dist = terrainDistance; prevState.speed = gameState === 'PLAYING' ? gameSpeed : 0;
}
function simulateFrame() {
  snapshotState();
  frameCount++;
  if (gameState === 'PLAYING') {
    terrainDistance += gameSpeed;
    updateScenery();
  }
  player.update();
  // Smooth vertical camera follows the road, not each individual jump.
  // Look ahead on downhill roads, placing the road farther up in the frame.
  const roadHere = getGroundY(player.x);
  const roadAhead = getGroundY(player.x + Math.min(width*.78,720));
  const downhillLookAhead = Math.min(WORLD_H*.39,Math.max(0,roadAhead-roadHere)*.92);
  const desiredCamera = roadHere - baseGroundY() + downhillLookAhead;
  // Hold the highest useful camera position through the arc, without tracking the cat.
  // Airborne: the camera follows the cat up only when its head reaches the HUD margin (Mario style);
  // otherwise it eases back to the road.
  const followTarget = player.y - jumpTopMargin();
  const cameraTarget = player.isGrounded ? desiredCamera : Math.min(desiredCamera, followTarget);
  cameraY += (cameraTarget-cameraY)*.16;
  if (!player.isGrounded) cameraY = Math.min(cameraY, followTarget); // never let the head slide under the HUD
  if (gameState === 'PLAYING') {
    // 隨分數漸進加速
    gameSpeed = Math.min(16, 6.6 + score * 0.0022);
    if(immunity>0)immunity--;
    if(shieldShake>0)shieldShake--;
    score += gameSpeed * 0.045;
    if (player.isGrounded) {
      footstepDistance += gameSpeed;
      if (footstepDistance > 135) {
        footstepDistance = 0;
        if (!sfx.muted) sfx.footstep();
      }
    }
    const displayScore = Math.floor(score);

    // 每 500 分里程碑音效
    if (Math.floor(displayScore / 500) > lastMilestone) {
      lastMilestone = Math.floor(displayScore / 500);
      sfx.milestone();
      spawnDust(player.x, player.y - 40, '#ffd426', 14);
    }

    // 生成障礙物
    spawnTimer -= gameSpeed;
    if (spawnTimer <= 0) {
      spawnEntity();
      spawnTimer = 360 + Math.random() * 260;
    }

    // 更新障礙物與碰撞檢查
    const pBox = player.getHitbox();
    for (let i = obstacles.length - 1; i >= 0; i--) {
      const obs = obstacles[i];
      obs.x -= gameSpeed;
      if (obs.type === 'mountain' || obs.type === 'crystal')
        obs.y = getGroundY(obs.x + obs.w * 0.5);

      const oBox = {
        x: obs.x + 6,
        y: (obs.type === 'crystal'||obs.type==='mountain') ? obs.y - obs.h + 8 : obs.y + 4,
        w: obs.w - 12,
        h: obs.h - 10
      };

      if(obs.type!=='cloudGate' && immunity===0 && checkCollision(pBox,oBox)){
        if(shield>0){shield--;renderHearts();immunity=90;shieldShake=18;sfx.shieldHit();bumpShieldIcon();spawnDust(player.x,player.y-32,'#ffe27a',16);}
        else triggerGameOver();
      }

      if (obs.x + obs.w < -60) {
        obstacles.splice(i, 1);
      }
    }

    // 更新金幣與吃金幣
    for (let i = coins.length - 1; i >= 0; i--) {
      const c = coins[i];
      c.x -= gameSpeed;
      if (typeof c.lift === 'number') c.y = getGroundY(c.x) - c.lift;
      if (!c.collected) {
        const cBox = { x: c.x - c.r, y: c.y - c.r, w: c.r * 2, h: c.r * 2 };
        if (checkCollision(pBox, cBox)) {
          c.collected = true;
          if(c.type==='heart'){shield=Math.min(MAX_HEARTS,shield+1);renderHearts();sfx.heart();}
          else if(c.type==='star'){score+=100;sfx.star();}
          else {score+=50;sfx.coin();}
          spawnDust(c.x, c.y, '#ffd426', 10);
        }
      }
      if (c.x < -40 || c.collected) {
        coins.splice(i, 1);
      }
    }
  }

  updateEffects();
}

function paintFrame(alpha = 1) {
  // Temporarily move everything to the in-between position, paint, then restore.
  const back = prevState.valid ? 1 - Math.max(0, Math.min(1, alpha)) : 0;
  const saved = {camY:cameraY, px:player.x, py:player.y, dist:terrainDistance};
  const shift = (terrainDistance - prevState.dist) * back; // world scrolled this step
  if (back > 0) {
    cameraY = lerp(prevState.camY, cameraY, 1 - back);
    player.x = lerp(prevState.px, player.x, 1 - back);
    player.y = lerp(prevState.py, player.y, 1 - back);
    terrainDistance -= shift;
  }
  try { paintScene(shift); }
  finally {
    cameraY = saved.camY; player.x = saved.px; player.y = saved.py; terrainDistance = saved.dist;
  }
  needsPaint=false;
}
function paintScene(shift) {
  ctx.save();
  // Light screen shake while the shield breaks.
  if (shieldShake > 0) ctx.translate(Math.sin(shieldShake*2.3)*shieldShake*.3, Math.cos(shieldShake*1.7)*shieldShake*.2);
  drawBackground();
  ctx.save();
  ctx.translate(0,-cameraY);
  ctx.save();
  ctx.translate(shift,0); // obstacles and coins were this much further right a moment ago
  drawCoins(ctx,coins);
  drawObstacles(ctx,obstacles);
  drawIncomingHints();
  ctx.restore();
  player.draw();
  drawParticles();
  ctx.restore();
  ctx.restore();
}

// Zoomed-in portrait phones see less road ahead: a small "!" at the right edge marks an obstacle
// that is about to enter the screen (shown for up to ~0.6 s before it appears).
function drawIncomingHints() {
  if (viewZoom <= 1 || height < width || gameState !== 'PLAYING') return; // portrait phones only
  for (const o of obstacles) {
    const lead = o.x - width;
    if (lead <= 0 || lead > gameSpeed * 36) continue;
    const midY = o.type === 'mountain' || o.type === 'crystal' ? o.y - Math.min(o.h, 120) / 2 : o.type === 'cloudGate' ? o.y + o.h / 2 : o.y;
    const x = width - 22, alpha = 1 - lead / (gameSpeed * 36) * .6;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = '#e2558f';
    ctx.beginPath(); ctx.arc(x, midY, 15, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.font = '700 20px system-ui, sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('!', x, midY + 1);
    ctx.restore();
  }
}

function update(timestamp = performance.now()) {
  requestAnimationFrame(update);
  if (gameState==='PAUSED' || gameWrapper.hidden || document.hidden) {
    lastFrameTime=null;
    frameTimeRemaining=0;
    if (needsPaint && !gameWrapper.hidden && !document.hidden) paintFrame();
    return;
  }

  // Use 60 Hz physics at any display refresh rate. Drop excess time after a
  // long stall so the game never advances several seconds in a single frame.
  const elapsed=lastFrameTime===null ? SIMULATION_STEP : Math.max(0,timestamp-lastFrameTime);
  lastFrameTime=timestamp;
  frameTimeRemaining=Math.min(MAX_CATCH_UP,frameTimeRemaining+elapsed);
  let stepped=false;
  while (frameTimeRemaining+1e-6>=SIMULATION_STEP) {
    frameTimeRemaining=Math.max(0,frameTimeRemaining-SIMULATION_STEP);
    simulateFrame();
    stepped=true;
    if (gameState==='GAMEOVER') {
      frameTimeRemaining=0;
      break;
    }
  }
  // While playing, paint every display frame (interpolated) even without a new physics step.
  if (!stepped && !needsPaint && gameState!=='PLAYING') return;
  if (stepped) {
    if (gameState==='PLAYING') updateMusic();
    const renderedScore=String(Math.floor(score)).padStart(5,'0');
    if (currentScoreEl.textContent!==renderedScore) currentScoreEl.textContent=renderedScore;
  }
  paintFrame(gameState==='PLAYING' ? frameTimeRemaining/SIMULATION_STEP : 1);
}

function startGame(cheat) {
  sfx.init();
  cheatRun = cheat === true;
  cheatTaps = 0;
  gameState = 'PLAYING';
  lastFrameTime=null;
  frameTimeRemaining=0;
  syncPauseControl();
  document.dispatchEvent(new Event('pinky-play-start'));
  footstepDistance = 0;
  beginMusic();
  score = 0;
  lastMilestone = 0;
  gameSpeed = 7.2;
  obstacles = [];
  coins = [];
  particles = [];
  spawnTimer = 120;
  terrainDistance = 0;
  cameraY = 0;
  terrainRoute = [[0,0],[900,0]];
  terrainPhase = Math.random()*Math.PI*2;
  extendTerrainTo(width*2);
  shield=cheatRun?MAX_HEARTS:0;immunity=0;shieldShake=0;renderHearts();
  runJumps = {motion:0, manual:0};
  player.reset();
  prevState.valid = false;
  pinkyUI.screen(null);
  window.pinkyArcade?.onStart();
  gameWrapper.focus({preventScroll:true});
}

let gameOverAt = 0;
function triggerGameOver() {
  gameState = 'GAMEOVER';
  gameOverAt = performance.now();
  syncPauseControl();
  player.hurt = true;
  endMusic();
  sfx.hit();
  spawnDust(player.x, player.y - 30, '#ff4794', 18);

  const finalVal = Math.floor(score);
  finalScoreEl.textContent = finalVal;

  // HI is the Firebase global score, never a device-local fallback.
  const globalBest=window.pinkyArcade?.globalBest?.();
  if(globalBest!==null && globalBest!==undefined && finalVal>globalBest) {
    newRecordBadge.classList.remove('hidden');
  } else {
    newRecordBadge.classList.add('hidden');
  }

  pinkyUI.screen('gameover');
  window.pinkyArcade?.onGameOver(finalVal, runJumps.motion > 0 && runJumps.manual === 0, cheatRun);
}

const pauseControl = document.getElementById('pinky-pause');
function syncPauseControl() {
  const paused = gameState === 'PAUSED';
  pauseControl.hidden = gameState !== 'PLAYING';
  document.getElementById('pinky-paused').hidden = !paused;
}
function setGamePaused(paused) {
  if (paused ? gameState !== 'PLAYING' : gameState !== 'PAUSED') return;
  if (!paused && (document.hidden || document.querySelector('dialog[open]'))) return;
  gameState = paused ? 'PAUSED' : 'PLAYING';
  lastFrameTime=null;
  frameTimeRemaining=0;
  syncPauseControl();
  if (paused) {
    document.getElementById('pinky-paused').focus({preventScroll:true});
    backgroundMusic?.pause();
    updateMediaSession('paused');
  } else {
    gameWrapper.focus({preventScroll:true});
    document.dispatchEvent(new Event('pinky-play-start'));
    if (!sfx.muted) {
      prepareMusicAudio();
      backgroundMusic?.play()?.then(()=>updateMediaSession('playing'),()=>{});
    }
  }
  window.pinkyArcade?.onPause(paused, Math.floor(score));
}
pauseControl.addEventListener('click', () => setGamePaused(true));
document.getElementById('pinky-paused').addEventListener('click', () => setGamePaused(false));
document.addEventListener('visibilitychange', () => {
  if (document.hidden) setGamePaused(true);
});
window.addEventListener('pagehide', () => setGamePaused(true));

window.pinkyRemoteStart = function(pause = false) {
  if (!document.getElementById('record-panel').classList.contains('hidden')) return;
  if (pause) setGamePaused(true);
  else if (gameState === 'PAUSED') setGamePaused(false);
  else if (gameState !== 'PLAYING') startGame();
};
window.pinkyRemoteJump = function(power = 0, input = null) {
  if (gameState !== 'PLAYING' || document.querySelector('dialog[open]')) return;
  // Phone button presses carry an input id; motion jumps (tablet or phone) do not.
  if (input) runJumps.manual++; else runJumps.motion++;
  player.jump(input,power);
};

// Capture Space even when the start button still has keyboard focus.
const jumpKeys = ['Space','ArrowUp','KeyW'];
function isJumpKey(event) {
  return jumpKeys.includes(event.code) || event.key === ' ' ||
    event.key === 'Spacebar' || event.key === 'ArrowUp' ||
    (typeof event.key === 'string' && event.key.toLowerCase() === 'w');
}
document.addEventListener('keydown', event => {
  if (!isJumpKey(event) || window.pinkyArcade?.isController()) return;
  const target = event.target;
  if (target?.closest?.('input,textarea,select,[contenteditable="true"],dialog,[role="menu"]')) return;
  if (target === pauseControl || gameState === 'PAUSED') return;
  // Allow Space to start while the start/restart button is focused.
  if (gameState === 'PLAYING' && target?.closest?.('button,a,[role="button"]')) return;
  if (document.getElementById('pinky-rank-dialog')?.open ||
      document.getElementById('pinky-pair-dialog')?.open ||
      document.getElementById('pinky-install-dialog')?.open ||
      document.getElementById('record-panel')?.classList.contains('hidden') === false) return;
  event.preventDefault();
  if (event.repeat) return;
  if (gameState === 'START' || gameState === 'GAMEOVER') startGame();
  else if (gameState === 'PLAYING') {
    // Motion runs are locked to motion until game over.
    if (window.pinkyArcade?.isMotionEnabled()) { showTouchLock(); return; }
    runJumps.manual++;
    player.jump(event.code || event.key);
  }
}, true);
function releaseJump(input, heldMs) {
  if (input !== player.jumpInput) return;
  player.jumpInput = null;
  if (player.isGrounded || player.vy >= 0) return;
  // Release trims the remaining ascent. Holding a key preserves the full arc.
  let remainingRise = SHORT_JUMP_RISE;
  if (heldMs !== undefined) {
    // Use the time held on the phone instead of the time between packets on the host.
    const frames = Math.min(30,Math.round(heldMs * .06));
    const positionAtRelease = player.launchY + frames * player.launchVelocity
      + player.gravity * frames * (frames + 1) / 2;
    remainingRise = Math.max(0,player.y - positionAtRelease + SHORT_JUMP_RISE);
  }
  player.vy = Math.max(player.vy, -Math.sqrt(2 * player.gravity * remainingRise));
  const ascent = player.vy ** 2 / (2 * player.gravity);
  player.jumpCameraLimit = player.y - ascent - jumpTopMargin();
}
window.pinkyRemoteRelease = function(input, heldMs, missingPress) {
  if (gameState !== 'PLAYING' || document.querySelector('dialog[open]')) return;
  if (missingPress && player.isGrounded) { runJumps.manual++; player.jump(input); }
  releaseJump(input,heldMs);
};
document.addEventListener('keyup', event => releaseJump(event.code || event.key));
for (const type of ['pointerup','pointercancel'])
  document.addEventListener(type, event => releaseJump(event.pointerId));
const gameWrapper = document.getElementById('game-wrapper');
const touchLock = document.getElementById('pinky-touch-lock');
let touchLockTimer;
function showTouchLock() {
  touchLock.hidden = false;
  clearTimeout(touchLockTimer);
  touchLockTimer = setTimeout(() => { touchLock.hidden = true; }, 2000);
}
gameWrapper.addEventListener('pointerdown', event => {
  if (event.isPrimary === false || event.button !== 0) return;
  // The entire game canvas responds; HUD actions and dialogs are excluded.
  if (event.target.closest('button, a, dialog, .panel, #hud, input, textarea, select, [role="button"]')) return;
  if (gameState === 'PAUSED') {
    event.preventDefault();
    setGamePaused(false);
    return;
  }
  // Tap anywhere to start or play again (not while the name entry is open,
  // and not in the first moment after a crash so a jump tap doesn't restart).
  if (gameState === 'START' || gameState === 'GAMEOVER') {
    const recordOpen = !document.getElementById('record-panel').classList.contains('hidden');
    if (recordOpen || (gameState === 'GAMEOVER' && performance.now() - gameOverAt < 700)) return;
    event.preventDefault();
    startGame();
    return;
  }
  if (window.pinkyArcade?.isMotionEnabled()) {
    event.preventDefault();
    showTouchLock();
    return;
  }
  if (gameState !== 'PLAYING') return;
  event.preventDefault();
  runJumps.manual++;
  player.jump(event.pointerId);
});
startBtn.addEventListener('click', startGame);
restartBtn.addEventListener('click', startGame);

// 初始化啟動
resizeCanvas();
initScenery();
player.reset();
window.addEventListener('load', () => {
  if (document.activeElement === document.body) {
    gameWrapper.focus({preventScroll:true});
  }
});
requestAnimationFrame(update);

// Re-arm game audio on every tap/key, so sound comes back after iOS interrupts it.
for (const type of ['pointerdown', 'touchend', 'keydown']) {
  document.addEventListener(type, () => {
    sfx.unlock();
    if (backgroundMusic && backgroundMusic.paused && gameState === 'PLAYING' && !sfx.muted)
      backgroundMusic.play()?.catch(() => {});
  }, {capture: true, passive: true});
}
