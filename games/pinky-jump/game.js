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
    if (!this.ctx) {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
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
    this.playTone(235,'triangle',.17,95,.13);
    setTimeout(()=>this.playTone(520,'sine',.14,340,.08),70);
  }
  footstep() {
    this.playTone(125,'sine',.035,90,.019);
  }
  hit() {
    // Soft, comical two-part "啾～噗" failure jingle.
    this.playTone(680,'sine',.28,165,.15);
    setTimeout(()=>this.playTone(145,'triangle',.17,70,.085),165);
  }
}

const sfx = new SoundFX();

// Your uploaded SergeQuadrado recording is a looping soundtrack.
// Place its MP3 next to game.js. The rest of the game works if it is missing.
const MUSIC_FILE = 'sergequadrado-humorous-loop-275485.mp3';
const backgroundMusic = typeof Audio === 'function' ? new Audio(MUSIC_FILE) : null;
if (backgroundMusic) {
  backgroundMusic.loop = true;
  backgroundMusic.preload = 'auto';
  backgroundMusic.volume = .28;
}
let useFallbackMusic = !backgroundMusic;
let musicFadeTimer = null;
let footstepDistance = 0;
function beginMusic() {
  if (musicFadeTimer) { clearInterval(musicFadeTimer); musicFadeTimer = null; }
  if (!backgroundMusic || useFallbackMusic || sfx.muted) return;
  backgroundMusic.pause();
  backgroundMusic.currentTime = 0;
  backgroundMusic.playbackRate = 1;
  backgroundMusic.volume = .28;
  const result = backgroundMusic.play();
  if (result && typeof result.catch === 'function') {
    result.catch(() => { useFallbackMusic = true; });
  }
}
if (backgroundMusic) {
  backgroundMusic.addEventListener('error', () => {
    useFallbackMusic = true;
  });
}
function endMusic() {
  if (!backgroundMusic || backgroundMusic.paused) return;
  if (musicFadeTimer) clearInterval(musicFadeTimer);
  let volume = backgroundMusic.volume;
  musicFadeTimer = setInterval(() => {
    volume = Math.max(0, volume - .07);
    backgroundMusic.volume = volume;
    if (volume <= 0) {
      clearInterval(musicFadeTimer); musicFadeTimer = null;
      backgroundMusic.pause();
      backgroundMusic.currentTime = 0;
    }
  }, 35);
}
function updateMusic() {
  if (backgroundMusic && !backgroundMusic.paused)
    backgroundMusic.playbackRate = Math.min(1.07, 1 + Math.max(0, gameSpeed-7)*.007);
  // Backup tune only when the MP3 has not yet been deployed.
  if (useFallbackMusic && !sfx.muted && frameCount % 17 === 0) {
    const notes = [392,494,587,494,523,659,587,440,392,523,659,587,494,440,392,330];
    const index = Math.floor(frameCount / 17) % notes.length;
    sfx.playTone(notes[index], 'triangle', .115, null, .032);
  }
}


// Gameplay state and canvas sizing.
let width = window.innerWidth;
let height = window.innerHeight;
let dpr = Math.min(window.devicePixelRatio || 1, 2);
let gameState = 'START';
let score = 0;
let shield = 0;
let immunity = 0;
const shieldEl = document.getElementById('shield-count');
let gameSpeed = 7;
let frameCount = 0;
let lastMilestone = 0;
let dayNightFactor = 0;
hiScoreEl.textContent = '-----';

function resizeCanvas() {
  width = window.innerWidth;
  height = window.innerHeight;
  dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = width * dpr;
  canvas.height = height * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
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
  if (!backgroundMusic) return;
  if (sfx.muted) backgroundMusic.pause();
  else if (gameState === 'PLAYING') {
    const p = backgroundMusic.play(); if (p && p.catch) p.catch(() => { useFallbackMusic = true; });
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
  return baseGroundY()+(startY+(endY-startY)*ease)*height+
    height*(Math.sin(worldX/290+terrainPhase)*.012+
            Math.sin(worldX/117+terrainPhase*.68)*.005);
}

// The player is separate from SoundFX; jump physics belongs here.
const player = {
  x: 90,
  y: 0,
  vy: 0,
  gravity: 0.78,
  isGrounded: true,
  runCycle: 0,
  blinkTimer: 0,
  hurt: false,
  jumpHeld: false,
  holdFrames: 0,
  jumpCeilingReached: false,

  getScale() {
    return Math.max(0.64, Math.min(1, width / 550, height / 510));
  },
  reset() {
    this.x = Math.max(52, Math.min(110, width * 0.17));
    this.y = getGroundY();
    this.vy = 0;
    this.isGrounded = true;
    this.hurt = false;
    this.jumpHeld = false;
    this.holdFrames = 0;
    this.jumpCeilingReached = false;
  },
  jump() {
    if (!this.isGrounded || gameState !== 'PLAYING') return;
    // Quick tap = a little hop; hold = a much higher jump.
    this.vy = -Math.max(11, Math.min(16.5, height * 0.0205));
    this.isGrounded = false;
    this.jumpHeld = true;
    this.holdFrames = 0;
    this.jumpCeilingReached = false;
    sfx.jump();
    spawnDust(this.x, this.y, '#f784ba', 8);
  },
  releaseJump() {
    this.jumpHeld = false;
    // Releasing early gently cuts the ascent, without an abrupt stop.
    if (!this.isGrounded && this.vy < -4) this.vy *= 0.55;
  },
  update() {
    const groundY = getGroundY(this.x);
    this.gravity = Math.max(0.65, Math.min(0.9, height * 0.00105));
    if (this.isGrounded) {
      // Walk smoothly over the slope instead of running through the hill.
      this.y = groundY;
      this.vy = 0;
    } else {
      if (this.jumpHeld && !this.jumpCeilingReached && this.vy < 0 && this.holdFrames < 58) {
        this.vy -= this.gravity * 1.24;
        this.holdFrames++;
      }
      this.vy += this.gravity;
      this.y += this.vy;
      const s = this.getScale();
      // Landscape: sprite reaches the top; portrait: well above mid-screen.
      const ceiling = cameraY + (width > height
        ? 93 * s
        : Math.max(110 * s, height * 0.31 + 95 * s));
      if (this.y <= ceiling) {
        this.y = ceiling;
        this.vy = 0;
        this.jumpHeld = false;
        this.jumpCeilingReached = true;
      }
      if (this.y >= groundY) {
        this.y = groundY;
        this.vy = 0;
        this.isGrounded = true;
        this.jumpHeld = false;
      }
    }
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
    ctx.translate(this.x, this.y);
    ctx.scale(this.getScale(),this.getScale());

    const bounce = this.isGrounded ? Math.abs(Math.sin(this.runCycle)) * -5 : 0;
    const tilt = !this.isGrounded ? Math.max(-0.22, Math.min(0.22, this.vy * 0.015)) : 0;

    // 地面陰影
    const groundOffset = getGroundY(this.x) - this.y;
    const shadowScale = Math.max(0.4, 1 - groundOffset / 240);
    ctx.fillStyle = 'rgba(214, 40, 114, 0.2)';
    ctx.beginPath();
    ctx.ellipse(0, groundOffset + 2, 28 * shadowScale, 7 * shadowScale, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.translate(0, bounce);
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

    // 4. 大頭與特徵 (微幅點頭)
    ctx.save();
    ctx.translate(2, -62);

    // 左右貓耳朵 (粉白鋸齒 + 頂端雙藍絨球)
    this.drawEar(-18, -16, -0.25, false);
    this.drawEar(18, -16, 0.25, true);

    // 臉部輪廓 (白底 + 兩側毛絨翹角)
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#ff7eb9';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(-26, -10);
    ctx.quadraticCurveTo(-34, 4, -42, 2);   // 左翹毛尖端
    ctx.quadraticCurveTo(-36, 17, -18, 18);
    ctx.lineTo(18, 18);
    ctx.quadraticCurveTo(36, 17, 42, 2);    // 右翹毛尖端
    ctx.quadraticCurveTo(34, 4, 26, -10);
    ctx.arc(0, -4, 27, -0.2, Math.PI + 0.2, true);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // 粉色中分瀏海
    ctx.fillStyle = '#ff7eb9';
    ctx.beginPath();
    ctx.moveTo(-27, -4);
    ctx.arc(0, -5, 27.5, Math.PI, 0, false);
    ctx.quadraticCurveTo(18, 6, 0, -10);
    ctx.quadraticCurveTo(-18, 6, -27, -4);
    ctx.closePath();
    ctx.fill();

    // 額頭中央寶藍色菱形寶石
    ctx.fillStyle = '#0d52e8';
    ctx.beginPath();
    ctx.moveTo(0, -18);
    ctx.lineTo(4.5, -11);
    ctx.lineTo(0, -4);
    ctx.lineTo(-4.5, -11);
    ctx.closePath();
    ctx.fill();

    // 額頭兩側灰色點狀眉飾
    ctx.fillStyle = '#6e737b';
    const leftDots = [[-8, -12], [-13, -13], [-18, -15], [-22, -18]];
    const rightDots = [[8, -12], [13, -13], [18, -15], [22, -18]];
    [...leftDots, ...rightDots].forEach(([dx, dy]) => {
      ctx.beginPath();
      ctx.arc(dx, dy, 1.4, 0, Math.PI * 2);
      ctx.fill();
    });

    // 寶藍色大眼睛 + 玫紅色花邊眼眶
    this.drawEye(-12, 3);
    this.drawEye(13, 3);

    // 桃紅色大圓腮紅 + 兩撇小鬍鬚
    ctx.fillStyle = '#e6197a';
    ctx.beginPath();
    ctx.arc(-23, 11, 5.2, 0, Math.PI * 2);
    ctx.arc(24, 11, 5.2, 0, Math.PI * 2);
    ctx.fill();

    // 粉紅小鼻子與 W 微笑嘴型
    ctx.fillStyle = '#e81e56';
    ctx.beginPath();
    ctx.moveTo(-3.5, 6);
    ctx.lineTo(3.5, 6);
    ctx.lineTo(0, 10);
    ctx.closePath();
    ctx.fill();

    ctx.strokeStyle = '#e81e56';
    ctx.lineWidth = 2.2;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-6, 12);
    ctx.quadraticCurveTo(-3, 16, 0, 11);
    ctx.quadraticCurveTo(3, 16, 6, 12);
    ctx.stroke();

    ctx.restore();
    ctx.restore();
  },

  drawFoot(x, y) {
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#ff7eb9';
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.ellipse(x, y, 8, 6.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // 粉色腳掌肉球
    ctx.fillStyle = '#ff85c0';
    ctx.beginPath();
    ctx.arc(x + 2, y, 4.2, 0, Math.PI * 2);
    ctx.fill();
  },

  drawEar(x, y, angle, isRight) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);

    // 外耳粉紅
    ctx.fillStyle = '#ff7eb9';
    ctx.strokeStyle = '#ff5ca8';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-13, 8);
    ctx.quadraticCurveTo(-12, -16, 0, -24);
    ctx.quadraticCurveTo(12, -16, 13, 8);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // 內耳白色與鋸齒毛邊
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(-7, 6);
    ctx.lineTo(-4, -2);
    ctx.lineTo(0, 2);
    ctx.lineTo(4, -2);
    ctx.lineTo(7, 6);
    ctx.lineTo(0, -17);
    ctx.closePath();
    ctx.fill();

    // 耳尖雙寶藍色絨球
    const pomSide = isRight ? 4 : -4;
    ctx.fillStyle = '#0d52e8';
    ctx.beginPath();
    ctx.arc(pomSide, -23, 3.8, 0, Math.PI * 2);
    ctx.arc(pomSide * 1.3, -17, 3.5, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  },

  drawEye(x, y) {
    // 撞到時顯示 X 眼
    if (this.hurt) {
      ctx.strokeStyle = '#0d52e8';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(x - 4, y - 4);
      ctx.lineTo(x + 4, y + 4);
      ctx.moveTo(x + 4, y - 4);
      ctx.lineTo(x - 4, y + 4);
      ctx.stroke();
      return;
    }

    // 眼白與玫紅色波浪花邊框
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#e81e56';
    ctx.lineWidth = 2.3;
    ctx.beginPath();
    ctx.ellipse(x, y, 7.5, 8.8, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // 寶藍色瞳孔
    ctx.fillStyle = '#0d52e8';
    ctx.beginPath();
    ctx.ellipse(x + 0.8, y, 5.2, 6.8, 0, 0, Math.PI * 2);
    ctx.fill();

    // 白色高光點
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(x - 1, y - 2.5, 1.8, 0, Math.PI * 2);
    ctx.fill();
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
      color: i % 2 === 0 ? '#ffc2e0' : '#ffd9ec'
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
    // Slightly larger than a bird, high up, moving across the screen.
    obstacles.push({
      type:'airplane', x, y:groundY - height*(0.43 + Math.random()*0.13),
      w:62, h:30, flap:0
    });
  } else if (score > 250 && r < 0.51) {
    const gapY = Math.max(82, groundY*0.28);
    const gapH = Math.max(105, Math.min(165, height*0.27));
    obstacles.push({type:'cloudGate',x,y:gapY,w:100,h:gapH});
    coins.push({type:'star',x:x+48,y:gapY+gapH/2,r:13,collected:false,spin:0});
  } else if (score > 90 && r < 0.70) {
    // Mostly small slopes/mountains; only ~6% of mountains reach half-screen.
    const tall = Math.random() < 0.06;
    const ordinary = [48,56,66,78,Math.min(108,height*0.20)];
    const h = tall
      ? Math.max(110, height * .46)
      : ordinary[Math.floor(Math.random()*ordinary.length)];
    const w = tall ? Math.min(136, Math.max(76,h*0.34)) : 64;
    obstacles.push({type:'mountain',x,y:groundY,w,h,tall});
  } else {
    const count=score>460&&Math.random()<.26?2:1;
    obstacles.push({type:'crystal',x,y:groundY,w:count*30,h:45,count});
  }
  if (Math.random() < .85) {
    const roll=Math.random(),type=roll<.11?'heart':roll<.36?'star':'coin';
    const lift = type==='heart'?125:(Math.random()<.5?58:Math.min(180,height*.38));
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

// 繪製背景 (支援白天粉彩與夜間星空平滑過渡)
function drawBackground() {
  // 隨分數切換日夜夢幻色調
  const targetNight = Math.floor(score / 800) % 2 === 1 ? 1 : 0;
  dayNightFactor += (targetNight - dayNightFactor) * 0.015;

  const grad = ctx.createLinearGradient(0, 0, 0, height);
  if (dayNightFactor < 0.5) {
    grad.addColorStop(0, '#ffd1e8');
    grad.addColorStop(0.65, '#fff5fa');
    grad.addColorStop(1, '#dff2ff');
  } else {
    grad.addColorStop(0, '#1e1b4b');
    grad.addColorStop(0.65, '#4c1d95');
    grad.addColorStop(1, '#831843');
  }
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, width, height);

  // 夜間星星閃爍
  if (dayNightFactor > 0.2) {
    ctx.fillStyle = `rgba(255, 245, 180, ${dayNightFactor * 0.85})`;
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
  planes.forEach(p=>{if(gameState==='PLAYING')p.x-=p.speed;if(p.x< -100)p.x=width+130;ctx.save();ctx.translate(p.x,p.y);ctx.fillStyle='#f4a6c9';ctx.beginPath();ctx.moveTo(-32,0);ctx.lineTo(25,-3);ctx.lineTo(38,2);ctx.lineTo(8,8);ctx.lineTo(-2,18);ctx.lineTo(-12,18);ctx.lineTo(-8,7);ctx.lineTo(-32,4);ctx.fill();ctx.restore();});
  // 可愛棉花糖雲朵
  clouds.forEach(c => {
    if (gameState === 'PLAYING') {
      c.x -= c.speed;
      if (c.x < -120) c.x = width + 120;
    }
    ctx.save();
    ctx.translate(c.x, c.y);
    ctx.scale(c.scale, c.scale);
    ctx.fillStyle = dayNightFactor > 0.5 ? 'rgba(255, 214, 238, 0.25)' : 'rgba(255, 255, 255, 0.9)';
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
    if (gameState === 'PLAYING') {
      h.x -= gameSpeed * 0.22;
      if (h.x + h.w < 0) h.x += bgHills.length * 320;
    }
    ctx.fillStyle = dayNightFactor > 0.5 ? 'rgba(131,24,67,.45)' : h.color;
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
  ctx.fillStyle = dayNightFactor > 0.5 ? '#3b0764' : '#ff9ecb';
  ctx.beginPath();
  ctx.moveTo(-12, getGroundY(-12));
  for (let x=0; x<=width+14; x+=12) ctx.lineTo(x,getGroundY(x));
  ctx.lineTo(width+16,height*4);
  ctx.lineTo(-16,height*4);
  ctx.closePath();
  ctx.fill();

  ctx.strokeStyle = '#ff5ca8';
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.moveTo(-12,getGroundY(-12));
  for (let x=0; x<=width+14; x+=12) ctx.lineTo(x,getGroundY(x));
  ctx.stroke();

  // Small flowers/dots remain attached to the moving terrain.
  const scrollOffset = terrainDistance % 80;
  ctx.fillStyle='#ffffff';
  for (let x=-scrollOffset; x<width+40; x+=80) {
    const y=getGroundY(x);
    ctx.beginPath();
    ctx.arc(x+20,y+18,3,0,Math.PI*2);
    ctx.arc(x+55,y+32,2.5,0,Math.PI*2);
    ctx.fill();
  }
  ctx.restore();
}

// 繪製障礙物
function drawObstacles() {
  obstacles.forEach(obs => {
    if(obs.type==='airplane'){
      ctx.save();ctx.translate(obs.x,obs.y+14);ctx.scale(obs.w/70,obs.h/30);ctx.fillStyle='#7bbae5';ctx.beginPath();ctx.moveTo(0,0);ctx.lineTo(57,-7);ctx.lineTo(70,0);ctx.lineTo(53,10);ctx.lineTo(22,10);ctx.lineTo(11,18);ctx.lineTo(3,16);ctx.lineTo(10,8);ctx.closePath();ctx.fill();ctx.fillStyle='#fff';ctx.fillRect(25,0,6,4);ctx.fillRect(36,0,6,4);ctx.restore();
    }else if(obs.type==='mountain'){
      const cx=obs.x+obs.w*.5, peak=obs.y-obs.h;
      ctx.fillStyle=obs.tall?'#a9c8b5':'#9ac6ab';
      ctx.beginPath();
      ctx.moveTo(obs.x,getGroundY(obs.x));
      ctx.lineTo(cx,peak);
      ctx.lineTo(obs.x+obs.w,getGroundY(obs.x+obs.w));
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
      obs.flap += 0.22;
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
function drawCoins() {
  coins.forEach(c => {
    if (c.collected) return;
    c.spin += 0.1;
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

// 繪製粒子特效
function drawParticles() {
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.x += p.vx;
    p.y += p.vy;
    p.vy += 0.15;
    p.life -= 0.03;

    if (p.life <= 0) {
      particles.splice(i, 1);
      continue;
    }

    ctx.globalAlpha = p.life;
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }
}

// 主迴圈更新
function update() {
  frameCount++;
  if (gameState === 'PLAYING') terrainDistance += gameSpeed;
  // Smooth vertical camera follows the road, not each individual jump.
  // Look ahead on downhill roads, placing the road farther up in the frame.
  const roadHere = getGroundY(player.x);
  const roadAhead = getGroundY(player.x + Math.min(width*.78,720));
  const downhillLookAhead = Math.min(height*.39,Math.max(0,roadAhead-roadHere)*.86);
  const desiredCamera = roadHere - baseGroundY() + downhillLookAhead;
  cameraY += (desiredCamera-cameraY)*.16;
  drawBackground();
  ctx.save();
  ctx.translate(0, -cameraY);

  if (gameState === 'PLAYING') {
    // 隨分數漸進加速
    gameSpeed = Math.min(16, 6.6 + score * 0.0022);
    if(immunity>0)immunity--;
    score += gameSpeed * 0.045;
    updateMusic();
    if (player.isGrounded) {
      footstepDistance += gameSpeed;
      if (footstepDistance > 135) {
        footstepDistance = 0;
        if (!sfx.muted) sfx.footstep();
      }
    }
    const displayScore = Math.floor(score);
    currentScoreEl.textContent = String(displayScore).padStart(5, '0');

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
        if(shield>0){shield--;shieldEl.textContent=shield;immunity=90;sfx.shieldHit();spawnDust(player.x,player.y-32,'#ffe27a',16);}
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
          if(c.type==='heart'){shield=Math.min(2,shield+1);shieldEl.textContent=shield;sfx.heart();}
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

  player.update();
  drawCoins();
  drawObstacles();
  player.draw();
  drawParticles();
  ctx.restore();

  requestAnimationFrame(update);
}

function startGame() {
  sfx.init();
  gameState = 'PLAYING';
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
  shield=0;immunity=0;shieldEl.textContent=0;
  player.reset();
  startPanel.classList.add('hidden');
  gameoverPanel.classList.add('hidden');
  window.pinkyArcade?.onStart();
  gameWrapper.focus({preventScroll:true});
}

function triggerGameOver() {
  gameState = 'GAMEOVER';
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

  gameoverPanel.classList.remove('hidden');
  window.pinkyArcade?.onGameOver(finalVal);
}

// Remote jump controls exposed only to this game's paired session.
window.pinkyRemoteStart = function() {
  if (document.getElementById('record-panel')?.classList.contains('hidden') === false) return;
  if (gameState !== 'PLAYING') startGame();
};
window.pinkyRemoteJump = function(strength = .65) {
  if (gameState === 'START') startGame();
  if (gameState !== 'PLAYING' || !player.isGrounded) return;
  player.jump();
  // Conservative motion jumps; only strong manual presses reach high.
  const hold = 35 + Math.round(Math.max(0,Math.min(1,strength)) * 280);
  setTimeout(() => player.releaseJump(),hold);
};

// Capture Space even when the start button still has keyboard focus.
const jumpKeys = ['Space','ArrowUp','KeyW'];
function isJumpKey(event) {
  return jumpKeys.includes(event.code) || event.key === ' ' ||
    event.key === 'Spacebar' || event.key === 'ArrowUp' ||
    (typeof event.key === 'string' && event.key.toLowerCase() === 'w');
}
document.addEventListener('keydown', event => {
  if (!isJumpKey(event)) return;
  const target = event.target;
  if (target && target.closest && target.closest('input,textarea,select,button,[role="button"],[contenteditable="true"],dialog')) return;
  if (document.getElementById('pinky-rank-dialog')?.open ||
      document.getElementById('pinky-pair-dialog')?.open ||
      document.getElementById('pinky-install-dialog')?.open ||
      document.getElementById('record-panel')?.classList.contains('hidden') === false) return;
  event.preventDefault();
  if (event.repeat) return;
  if (gameState === 'START' || gameState === 'GAMEOVER') startGame();
  else if (gameState === 'PLAYING') player.jump();
}, true);
document.addEventListener('keyup', event => {
  if (!isJumpKey(event)) return;
  event.preventDefault();
  player.releaseJump();
}, true);
let jumpPointerId = null;
const gameWrapper = document.getElementById('game-wrapper');
gameWrapper.addEventListener('pointerdown', event => {
  if (gameState !== 'PLAYING' || event.isPrimary === false) return;
  if (event.target.closest('button, a, dialog, .panel')) return;
  event.preventDefault();
  jumpPointerId = event.pointerId;
  player.jump();
});
function endPointerJump(event) {
  if (jumpPointerId === event.pointerId) {
    jumpPointerId = null;
    player.releaseJump();
  }
}
window.addEventListener('pointerup',endPointerJump);
window.addEventListener('pointercancel',endPointerJump);
startBtn.addEventListener('click', startGame);
restartBtn.addEventListener('click', startGame);

// 初始化啟動
resizeCanvas();
initScenery();
player.reset();
requestAnimationFrame(update);
