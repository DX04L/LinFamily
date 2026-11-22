/**
 * 粉紅魔法貓跑酷 (Pink Cat Jump)
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
const touchJump = document.getElementById('touch-jump');
const touchDuck = document.getElementById('touch-duck');

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
    const notes = [523.25, 659.25, 783.99, 1046.5];
    notes.forEach((n, i) => {
      setTimeout(() => this.playTone(n, 'sine', 0.12, null, 0.14), i * 70);
    });
  }
  hit() {
    this.playTone(220, 'sawtooth', 0.28, 70, 0.2);
  }
}

const sfx = new SoundFX();

// 遊戲狀態與參數
let width = window.innerWidth;
let height = window.innerHeight;
let dpr = Math.min(window.devicePixelRatio || 1, 2);

let gameState = 'START'; // START | PLAYING | GAMEOVER
let score = 0;
let hiScore = parseInt(localStorage.getItem('pinkCatHiScore') || '0', 10);
let gameSpeed = 7;
let frameCount = 0;
let lastMilestone = 0;
let dayNightFactor = 0; // 0 = 白天粉彩, 1 = 夢幻星空夜

hiScoreEl.textContent = String(hiScore).padStart(5, '0');

// 調整畫布解析度
function resizeCanvas() {
  width = window.innerWidth;
  height = window.innerHeight;
  dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = width * dpr;
  canvas.height = height * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  checkOrientation();
}

// 檢查手機橫向提示
function checkOrientation() {
  const isTouchDevice = ('ontouchstart' in window) || navigator.maxTouchPoints > 0;
  if (isTouchDevice && height > width) {
    rotateOverlay.classList.remove('hidden');
  } else {
    rotateOverlay.classList.add('hidden');
  }
}

window.addEventListener('resize', resizeCanvas);
window.addEventListener('orientationchange', () => setTimeout(resizeCanvas, 150));

// 全螢幕與橫向鎖定功能
async function enterLandscapeFullscreen() {
  try {
    const elem = document.documentElement;
    if (!document.fullscreenElement && !document.webkitFullscreenElement) {
      if (elem.requestFullscreen) {
        await elem.requestFullscreen();
      } else if (elem.webkitRequestFullscreen) {
        await elem.webkitRequestFullscreen();
      }
    } else {
      if (document.exitFullscreen) {
        await document.exitFullscreen();
      } else if (document.webkitExitFullscreen) {
        await document.webkitExitFullscreen();
      }
    }
    if (screen.orientation && screen.orientation.lock) {
      await screen.orientation.lock('landscape').catch(() => {});
    }
  } catch (err) {
    console.log('Fullscreen/Orientation lock notice:', err);
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
});

// 地面高度計算
function getGroundY() {
  return Math.max(height * 0.78, height - 90);
}

// 角色物件 (粉紅魔法貓)
const player = {
  x: 90,
  y: 0,
  vy: 0,
  gravity: 0.78,
  jumpForce: -15.5,
  isGrounded: true,
  isDucking: false,
  runCycle: 0,
  blinkTimer: 0,
  hurt: false,

  reset() {
    this.x = Math.min(110, width * 0.14);
    this.y = getGroundY();
    this.vy = 0;
    this.isGrounded = true;
    this.isDucking = false;
    this.hurt = false;
  },

  jump() {
    if (this.isGrounded) {
      this.vy = this.jumpForce;
      this.isGrounded = false;
      this.isDucking = false;
      sfx.jump();
      spawnDust(this.x, this.y, '#ff85c0', 8);
    }
  },

  duck(active) {
    if (active && !this.isGrounded) {
      // 空中按蹲下可快速下落
      this.vy += 1.8;
    }
    this.isDucking = active && this.isGrounded;
  },

  update() {
    const groundY = getGroundY();
    this.vy += this.gravity;
    this.y += this.vy;

    if (this.y >= groundY) {
      this.y = groundY;
      this.vy = 0;
      this.isGrounded = true;
    }

    if (this.isGrounded && gameState === 'PLAYING') {
      this.runCycle += gameSpeed * 0.032;
    }

    this.blinkTimer++;
  },

  getHitbox() {
    if (this.isDucking) {
      return {
        x: this.x - 28,
        y: this.y - 44,
        w: 56,
        h: 42
      };
    }
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

    const bounce = this.isGrounded ? Math.abs(Math.sin(this.runCycle)) * -5 : 0;
    const tilt = !this.isGrounded ? Math.max(-0.22, Math.min(0.22, this.vy * 0.015)) : (this.isDucking ? 0.12 : 0);

    // 地面陰影
    const groundOffset = getGroundY() - this.y;
    const shadowScale = Math.max(0.4, 1 - groundOffset / 240);
    ctx.fillStyle = 'rgba(214, 40, 114, 0.2)';
    ctx.beginPath();
    ctx.ellipse(0, groundOffset + 2, 28 * shadowScale, 7 * shadowScale, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.translate(0, bounce);
    ctx.rotate(tilt);

    if (this.isDucking) {
      ctx.scale(1.12, 0.72);
    }

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
  const groundY = getGroundY();
  const rand = Math.random();

  if (score > 250 && rand < 0.32) {
    // 空中飛天惡魔鈴鐺鳥 (可跳過或蹲下閃避)
    const flyHeights = [groundY - 46, groundY - 82];
    const fy = flyHeights[Math.floor(Math.random() * flyHeights.length)];
    obstacles.push({
      type: 'bird',
      x: width + 50,
      y: fy,
      w: 44,
      h: 32,
      flap: 0
    });
  } else {
    // 地面彩色魔法水晶 / 毛線仙人掌群 (1~3個組合)
    const count = score > 400 ? Math.floor(Math.random() * 3) + 1 : (Math.random() < 0.65 ? 1 : 2);
    const totalW = count * 30;
    obstacles.push({
      type: 'crystal',
      x: width + 40,
      y: groundY,
      w: totalW,
      h: 46 + (count === 1 ? 8 : 0),
      count
    });
  }

  // 機率生成金色魔法幣
  if (Math.random() < 0.65) {
    const coinY = rand < 0.32 ? groundY - 25 : groundY - 115;
    for (let i = 0; i < 3; i++) {
      coins.push({
        x: width + 50 + i * 34,
        y: coinY - Math.sin((i / 2) * Math.PI) * 18,
        r: 12,
        collected: false,
        spin: i * 0.5
      });
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
      const sy = (i * 83) % (getGroundY() - 80);
      const r = (i % 3 === 0) ? 2.5 : 1.5;
      ctx.beginPath();
      ctx.arc(sx, sy, r, 0, Math.PI * 2);
      ctx.fill();
    }
  }

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

  // 遠景粉彩山丘
  const groundY = getGroundY();
  bgHills.forEach(h => {
    if (gameState === 'PLAYING') {
      h.x -= gameSpeed * 0.22;
      if (h.x + h.w < 0) h.x += bgHills.length * 320;
    }
    ctx.fillStyle = dayNightFactor > 0.5 ? 'rgba(131, 24, 67, 0.45)' : h.color;
    ctx.beginPath();
    ctx.moveTo(h.x, groundY);
    ctx.quadraticCurveTo(h.x + h.w / 2, groundY - h.h, h.x + h.w, groundY);
    ctx.fill();
  });

  // 彩色草地跑道
  ctx.fillStyle = dayNightFactor > 0.5 ? '#3b0764' : '#ff9ecb';
  ctx.fillRect(0, groundY, width, height - groundY);

  // 跑道上緣亮邊
  ctx.fillStyle = '#ff5ca8';
  ctx.fillRect(0, groundY, width, 6);

  // 跑道裝飾點點與小花
  const scrollOffset = (frameCount * gameSpeed) % 80;
  ctx.fillStyle = '#ffffff';
  for (let x = -scrollOffset; x < width; x += 80) {
    ctx.beginPath();
    ctx.arc(x + 20, groundY + 18, 3, 0, Math.PI * 2);
    ctx.arc(x + 55, groundY + 32, 2.5, 0, Math.PI * 2);
    ctx.fill();
  }
}

// 繪製障礙物
function drawObstacles() {
  obstacles.forEach(obs => {
    if (obs.type === 'crystal') {
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

    ctx.fillStyle = '#ffd426';
    ctx.strokeStyle = '#e08e00';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, c.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

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
  drawBackground();

  if (gameState === 'PLAYING') {
    // 隨分數漸進加速
    gameSpeed = Math.min(18, 7.2 + score * 0.0025);
    score += gameSpeed * 0.045;
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

      const oBox = {
        x: obs.x + 6,
        y: obs.type === 'crystal' ? obs.y - obs.h + 8 : obs.y + 4,
        w: obs.w - 12,
        h: obs.h - 10
      };

      if (checkCollision(pBox, oBox)) {
        triggerGameOver();
      }

      if (obs.x + obs.w < -60) {
        obstacles.splice(i, 1);
      }
    }

    // 更新金幣與吃金幣
    for (let i = coins.length - 1; i >= 0; i--) {
      const c = coins[i];
      c.x -= gameSpeed;
      if (!c.collected) {
        const cBox = { x: c.x - c.r, y: c.y - c.r, w: c.r * 2, h: c.r * 2 };
        if (checkCollision(pBox, cBox)) {
          c.collected = true;
          score += 50;
          sfx.coin();
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

  requestAnimationFrame(update);
}

function startGame() {
  sfx.init();
  gameState = 'PLAYING';
  score = 0;
  lastMilestone = 0;
  gameSpeed = 7.2;
  obstacles = [];
  coins = [];
  particles = [];
  spawnTimer = 120;
  player.reset();
  startPanel.classList.add('hidden');
  gameoverPanel.classList.add('hidden');
}

function triggerGameOver() {
  gameState = 'GAMEOVER';
  player.hurt = true;
  sfx.hit();
  spawnDust(player.x, player.y - 30, '#ff4794', 18);

  const finalVal = Math.floor(score);
  finalScoreEl.textContent = finalVal;

  if (finalVal > hiScore) {
    hiScore = finalVal;
    localStorage.setItem('pinkCatHiScore', hiScore);
    hiScoreEl.textContent = String(hiScore).padStart(5, '0');
    newRecordBadge.classList.remove('hidden');
  } else {
    newRecordBadge.classList.add('hidden');
  }

  gameoverPanel.classList.remove('hidden');
}

// 鍵盤控制
window.addEventListener('keydown', (e) => {
  if (['Space', 'ArrowUp', 'KeyW'].includes(e.code)) {
    e.preventDefault();
    if (gameState === 'START' || gameState === 'GAMEOVER') {
      startGame();
    } else if (gameState === 'PLAYING') {
      player.jump();
    }
  } else if (['ArrowDown', 'KeyS'].includes(e.code)) {
    e.preventDefault();
    if (gameState === 'PLAYING') {
      player.duck(true);
    }
  }
});

window.addEventListener('keyup', (e) => {
  if (['ArrowDown', 'KeyS'].includes(e.code)) {
    player.duck(false);
  }
});

// 觸控與滑鼠控制
touchJump.addEventListener('touchstart', (e) => {
  e.preventDefault();
  if (gameState === 'PLAYING') player.jump();
}, { passive: false });

touchDuck.addEventListener('touchstart', (e) => {
  e.preventDefault();
  if (gameState === 'PLAYING') player.duck(true);
}, { passive: false });

touchDuck.addEventListener('touchend', (e) => {
  e.preventDefault();
  player.duck(false);
});

canvas.addEventListener('mousedown', () => {
  if (gameState === 'PLAYING') player.jump();
});

startBtn.addEventListener('click', startGame);
restartBtn.addEventListener('click', startGame);

// 初始化啟動
resizeCanvas();
initScenery();
player.reset();
requestAnimationFrame(update);
