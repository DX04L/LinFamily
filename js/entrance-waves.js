/* LinFamily 入口動畫：抽象海岸浪潮（線條＋粒子，Canvas 即時繪製，不用影片）。
 * 來源：Darren 提供的「抽象海岸浪潮」範例，拿掉控制列與外部字型／Tailwind，改成滿版背景。
 * - 直式畫面海陸交界在右側約 1/3（62%），橫式 55%。
 * - 分頁在背景、或已登入（入口頁隱藏）時停止；prefers-reduced-motion 只畫一張靜止畫面。
 * - 點擊交給 #lfWelcome（登入），canvas 不攔截。
 */
(function () {
  const wrap = document.getElementById('lfWelcome');
  const canvas = wrap && wrap.querySelector('.lf-ent-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  let SHORE = 0.55, running = false, rafId = 0;
  const TILT = -12; // 整個畫面轉斜的角度（負＝逆時針）
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
            const PALETTE = { // 取自海灘空拍照的鮮豔色（線條風格不變）
      deepTeal: ['#006B73', '#00747C'],             // 深海青（後方細線）
      turquoise: ['#4CE0D8', '#7EEAE3', '#B5F5F0'], // 亮松石
      foam: ['#FFFFFF', '#F2FCFC', '#D8F5F5'],      // 浪花白
      sand: ['#E8A88C', '#DE9478', '#F0B49C']       // 沙灘蜜桃（比底色深，線才看得到）
    };

  const config = {
      speedMultiplier: 0.6, // 放慢，海浪流動比較平靜
      densityMultiplier: 1.0,
      paperMode: false // false: 深海分界基底 | true: 纯净暗调基底
  };

  let width = 1280;
  let height = 720;
  let dpr = Math.min(window.devicePixelRatio || 1, 2);

  // 动态实体集合
  let waveFronts = [];      // 由多根平行丝线组成的推进波浪前锋
  let traceLines = [];      // 冲刷后留在沙滩上的渐隐潮痕虚线
  let seaParticles = [];    // 左侧海域由左向右流动的青绿/松石粒子流
  let foamParticles = [];   // 浪峰前缘迸发的白色海沫粒子
  let sandParticles = [];   // 右侧沙滩区域的暖蜜桃粉色漂浮微粒
  let globalTime = 0;

  const rand = (min, max) => Math.random() * (max - min) + min;
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

  /**
   * 自适应 16:9 画布尺寸
   */
  function resizeCanvas() {
      SHORE = innerHeight > innerWidth ? 0.62 : 0.55;
      try {
          // 斜的：畫布轉 TILT 度，並放大到轉了之後四角仍蓋滿畫面（直接用大畫布繪製，不靠 CSS 放大，線條才清楚）
          const W = wrap.clientWidth || innerWidth, H = wrap.clientHeight || innerHeight;
          const t = Math.abs(TILT) * Math.PI / 180, z = Math.cos(t) + Math.max(W / H, H / W) * Math.sin(t);
          width = Math.max(320, Math.round(W * z));
          height = Math.max(180, Math.round(H * z));
          Object.assign(canvas.style, { width: width + 'px', height: height + 'px', left: (W - width) / 2 + 'px', top: (H - height) / 2 + 'px', transform: 'rotate(' + TILT + 'deg)' });
          dpr = Math.min(window.devicePixelRatio || 1, 2);

          canvas.width = Math.round(width * dpr);
          canvas.height = Math.round(height * dpr);
          ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

          initAmbientParticles();
      } catch (err) {
          console.error('Canvas resize error:', err);
      }
  }

  /**
   * 获取画面中间偏右（约 55% 处）的抽象海岸分界线 X 坐标
   */
  function getShorelineX(yRatio, time) {
      const centerRatio = SHORE;
      const drift =
          Math.sin(yRatio * Math.PI * 2.2 + time * 0.35) * 0.034 +
          Math.cos(yRatio * Math.PI * 4.1 - time * 0.24) * 0.022 +
          Math.sin(yRatio * Math.PI * 7.0 + time * 0.42) * 0.012 + Math.sin(yRatio * Math.PI * 1.3 - time * 0.17) * 0.02;
      return (centerRatio + drift) * width;
  }

  /**
   * 生成随机正弦谐波组合，赋予每道浪线独特的抽象形态
   */
  function createHarmonics() {
      const harmonics = [];
      const count = 4;
      for (let i = 0; i < count; i++) {
          harmonics.push({
              freq: (i + 1) * rand(1.1, 1.95),
              amp: rand(0.022, 0.06) / (i * 0.45 + 1), // 加大，浪線比較不規則
              phase: rand(0, Math.PI * 2),
              speed: rand(-1.4, 1.4)
          });
      }
      return harmonics;
  }

  /**
   * 计算给定纵向比例 yRatio (0..1) 处的波浪曲线 X 坐标
   */
  function evaluateWaveX(baseRatio, yRatio, harmonics, time, focusY = null, focusBoost = 0) {
      let offset = 0;
      for (let i = 0; i < harmonics.length; i++) {
          const h = harmonics[i];
          offset += Math.sin(yRatio * Math.PI * 2 * h.freq + h.phase + time * h.speed) * h.amp;
      }
      offset += Math.sin(yRatio * Math.PI) * 0.02;

      if (focusY !== null && focusBoost > 0) {
          const dist = Math.abs(yRatio - focusY);
          offset += Math.exp(-(dist * dist) / 0.024) * focusBoost;
      }

      return (baseRatio + offset) * width;
  }

  /**
   * 初始化左右两侧的环境流场粒子（左侧青绿海洋粒子流 + 右侧蜜桃粉沙滩微粒）
   */
  function initAmbientParticles() {
      seaParticles = [];
      sandParticles = [];

      const seaCount = Math.floor(260 * config.densityMultiplier);
      for (let i = 0; i < seaCount; i++) {
          seaParticles.push(createSeaParticle(rand(0, SHORE + 0.01)));
      }

      const sandCount = Math.floor(220 * config.densityMultiplier);
      for (let i = 0; i < sandCount; i++) {
          sandParticles.push(createSandParticle(rand(SHORE - 0.01, 0.99)));
      }
  }

  function createSeaParticle(nx = rand(0, 0.08)) {
      const isTurquoise = Math.random() > 0.35;
      return {
          nx: nx,
          ny: Math.random(),
          vx: rand(0.025, 0.075),
          vy: rand(-0.008, 0.008),
          size: rand(1.1, 2.7),
          trailLen: rand(8, 26),
          color: isTurquoise ? pick(PALETTE.turquoise) : pick(PALETTE.deepTeal),
          alpha: rand(0.35, 0.85),
          phase: rand(0, Math.PI * 2)
      };
  }

  function createSandParticle(nx = rand(0.55, 0.99)) {
      return {
          nx: nx,
          ny: Math.random(),
          vx: rand(-0.004, 0.004),
          vy: rand(-0.005, 0.005),
          size: rand(0.9, 2.3),
          color: pick(PALETTE.sand),
          alpha: rand(0.32, 0.78),
          phase: rand(0, Math.PI * 2)
      };
  }

  /**
   * 抽象波浪线束类（由多根平行谐波细线 + 浪锋白线 + 粒子群构成）
   */
  class LineWaveFront {
      constructor(initialProgress = 0, focusY = null) {
          this.progress = initialProgress;
          this.duration = rand(6.2, 8.6);
          this.startRatio = rand(0.10, 0.26); // 左侧深海起点
          this.peakRatio = rand(SHORE + 0.04, Math.min(0.95, SHORE + 0.2));  // 越过 55% 海岸交界线深入沙滩
          this.harmonics = createHarmonics();
          this.strandCount = Math.floor(rand(7, 13)); // 平行细线根数
          this.strandSpacing = rand(0.008, 0.015);
          this.hasLeftTrace = initialProgress > 0.5;
          this.focusY = focusY;
          this.focusBoost = focusY !== null ? rand(0.055, 0.09) : 0;
          this.seed = rand(0, 100);
      }

      getCurrentBaseRatio() {
          const p = this.progress;
          let envelope;
          if (p < 0.5) {
              const t = p / 0.5;
              envelope = 1 - Math.pow(1 - t, 2.5);
          } else {
              const t = (p - 0.5) / 0.5;
              envelope = Math.cos(t * Math.PI * 0.5);
          }
          return this.startRatio + (this.peakRatio - this.startRatio) * envelope;
      }

      update(dt) {
          const prev = this.progress;
          this.progress += (dt * config.speedMultiplier) / this.duration;
          const currentBase = this.getCurrentBaseRatio();

          // 抵达最高点开始退潮时，在右侧粉色沙滩留下多层渐隐虚线潮痕
          if (!this.hasLeftTrace && prev < 0.5 && this.progress >= 0.5) {
              this.hasLeftTrace = true;
              traceLines.push({
                  reach: this.peakRatio,
                  harmonics: this.harmonics,
                  timeSnapshot: globalTime,
                  focusY: this.focusY,
                  focusBoost: this.focusBoost,
                  life: 1.0,
                  decay: rand(0.14, 0.22)
              });
          }

          // 沿波浪前缘持续散发出白色与松石青浪花粒子
          const isAdvancing = this.progress < 0.55;
          const nearMiddleBoost = currentBase > 0.46 ? 1.6 : 0.8;
          const spawnRate = (isAdvancing ? 0.9 : 0.4) * nearMiddleBoost * config.densityMultiplier;

          if (Math.random() < spawnRate && foamParticles.length < 480) {
              const burst = Math.ceil(rand(2, 5) * config.densityMultiplier);
              for (let i = 0; i < burst; i++) {
                  const yRatio = this.focusY !== null && Math.random() < 0.55
                      ? Math.min(0.98, Math.max(0.02, this.focusY + rand(-0.15, 0.15)))
                      : rand(0.01, 0.99);
                  const fx = evaluateWaveX(
                      currentBase,
                      yRatio,
                      this.harmonics,
                      globalTime,
                      this.focusY,
                      this.focusBoost
                  );
                  const onBeach = fx > getShorelineX(yRatio, globalTime);
                  foamParticles.push({
                      x: fx + rand(-14, 6),
                      y: yRatio * height + rand(-5, 5),
                      vx: isAdvancing ? rand(14, 46) : rand(-28, -6),
                      vy: rand(-12, 12),
                      size: rand(1.0, 3.0),
                      color: onBeach
                          ? (Math.random() > 0.25 ? PALETTE.foam[0] : PALETTE.sand[0])
                          : (Math.random() > 0.4 ? PALETTE.foam[1] : PALETTE.turquoise[2]),
                      life: 1.0,
                      decay: rand(0.45, 1.0)
                  });
              }
          }
      }

      draw(ctx) {
          const baseRatio = this.getCurrentBaseRatio();
          const lifeFade = Math.sin(Math.min(1, Math.max(0, this.progress)) * Math.PI);
          const masterAlpha = Math.pow(lifeFade, 0.4);
          if (masterAlpha <= 0.01) return;

          const steps = 96;
          const totalLines = Math.max(4, Math.round(this.strandCount * config.densityMultiplier));

          ctx.save();
          ctx.lineCap = 'round';
          ctx.lineJoin = 'round';

          // 从后方深海细线（s = totalLines - 1）绘制到最前缘浪白主线（s = 0）
          for (let s = totalLines - 1; s >= 0; s--) {
              const ratioPos = s / Math.max(1, totalLines - 1); // 0 = 最前缘, 1 = 尾部
              const lag = s * this.strandSpacing * width;

              ctx.beginPath();
              for (let i = 0; i <= steps; i++) {
                  const yRatio = i / steps;
                  const frontX = evaluateWaveX(
                      baseRatio,
                      yRatio,
                      this.harmonics,
                      globalTime,
                      this.focusY,
                      this.focusBoost
                  );
                  // 后方丝线增加轻微次级谐波相位差，形成细腻的拓扑等高线干涉美感
                  const harmonicRipple =
                      Math.sin(yRatio * Math.PI * (4 + s * 0.6) + globalTime * 1.3 + s * 0.7) *
                      (width * 0.0045 * ratioPos);
                  const x = Math.max(0, frontX - lag + harmonicRipple);
                  const y = yRatio * height;

                  if (i === 0) ctx.moveTo(x, y);
                  else ctx.lineTo(x, y);
              }

              if (s === 0) {
                  // 最前缘：亮白色浪峰主线
                  ctx.strokeStyle = PALETTE.foam[0];
                  ctx.lineWidth = 2.4;
                  ctx.globalAlpha = 0.95 * masterAlpha;
              } else if (s <= 2) {
                  // 次前缘：薄荷青与柔白过渡细线
                  ctx.strokeStyle = s === 1 ? PALETTE.foam[2] : PALETTE.turquoise[2];
                  ctx.lineWidth = 1.45;
                  ctx.globalAlpha = (0.78 - s * 0.14) * masterAlpha;
              } else {
                  // 尾部并行流线：松石蓝 -> 深海青绿
                  ctx.strokeStyle = ratioPos < 0.6 ? PALETTE.turquoise[1] : PALETTE.deepTeal[1];
                  ctx.lineWidth = 1.05;
                  ctx.globalAlpha = (1 - ratioPos * 0.72) * 0.55 * masterAlpha;
              }

              ctx.stroke();

              // 在前缘线旁每隔一段距离点缀高亮粒子节点
              if (s === 0 || s === 2) {
                  ctx.fillStyle = s === 0 ? PALETTE.foam[0] : PALETTE.turquoise[2];
                  ctx.globalAlpha = (s === 0 ? 0.9 : 0.6) * masterAlpha;
                  const stepSkip = s === 0 ? 4 : 7;
                  for (let i = 2; i < steps; i += stepSkip) {
                      const yRatio = i / steps;
                      const fx = evaluateWaveX(
                          baseRatio,
                          yRatio,
                          this.harmonics,
                          globalTime,
                          this.focusY,
                          this.focusBoost
                      ) - lag;
                      if (fx > 0 && fx < width) {
                          ctx.beginPath();
                          ctx.arc(fx, yRatio * height, s === 0 ? 1.8 : 1.2, 0, Math.PI * 2);
                          ctx.fill();
                      }
                  }
              }
          }

          ctx.restore();
      }
  }

  /**
   * 绘制纯极简分界基底与左右两侧静态/缓动背景等高线网络
   */
  function drawLineAndParticleBackdrop() {
      // 1. 极简深色分割基底，突出高对比度的线条与粒子色彩
      const bgGrad = ctx.createLinearGradient(0, 0, width, 0);
      if (!config.paperMode) {
          bgGrad.addColorStop(0, '#02878F');   // 照片深海
          bgGrad.addColorStop(SHORE - 0.03, '#02A8AB');   // 照片淺海
          bgGrad.addColorStop(SHORE + 0.03, '#F8C4B4'); // 照片近岸沙
          bgGrad.addColorStop(1, '#F5CCBD');  // 照片沙灘
      } else {
          bgGrad.addColorStop(0, '#072226');
          bgGrad.addColorStop(1, '#0D1E21');
      }
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, width, height);

      const steps = 90;

      // 2. 左侧深海区（0% ~ 55%）流动水平/波纹流线丝网
      ctx.save();
      const horizontalStreams = Math.round(28 * config.densityMultiplier);
      for (let j = 0; j < horizontalStreams; j++) {
          const baseY = ((j + 0.5) / horizontalStreams) * height;
          ctx.beginPath();
          for (let x = 0; x <= width * (SHORE + 0.01); x += 18) {
              const nx = x / width;
              const shoreX = getShorelineX(baseY / height, globalTime);
              if (x > shoreX) break;
              const dy =
                  Math.sin(nx * 14 - globalTime * 1.4 + j * 0.6) * 5 +
                  Math.cos(nx * 7 + globalTime * 0.8 - j) * 3;
              if (x === 0) ctx.moveTo(x, baseY + dy);
              else ctx.lineTo(x, baseY + dy);
          }
          ctx.strokeStyle = j % 3 === 0 ? PALETTE.turquoise[0] : PALETTE.deepTeal[0];
          ctx.lineWidth = 0.85;
          ctx.globalAlpha = 0.24;
          ctx.stroke();
      }
      ctx.restore();

      // 3. 右侧暖蜜桃粉色沙滩区（55% ~ 100%）抽象地形等高线
      ctx.save();
      const beachContours = Math.round(18 * config.densityMultiplier);
      for (let c = 0; c < beachContours; c++) {
          const t = c / Math.max(1, beachContours - 1); // 0 = 海岸线, 1 = 最右侧沙丘
          ctx.beginPath();
          for (let i = 0; i <= steps; i++) {
              const yRatio = i / steps;
              const shoreX = getShorelineX(yRatio, globalTime);
              const remainWidth = width - shoreX;
              const duneWave =
                  Math.sin(yRatio * Math.PI * (2.5 + c * 0.35) + c * 1.1 + globalTime * 0.12) *
                  (width * 0.014 * Math.sin(t * Math.PI));
              const x = shoreX + t * remainWidth + duneWave;
              const y = yRatio * height;
              if (i === 0) ctx.moveTo(x, y);
              else ctx.lineTo(x, y);
          }

          if (c === 0) {
              // 中间约 55% 处的海岸分界基准线
              ctx.strokeStyle = PALETTE.sand[0];
              ctx.lineWidth = 1.6;
              ctx.globalAlpha = 0.65;
          } else {
              ctx.strokeStyle = PALETTE.sand[c % PALETTE.sand.length];
              ctx.lineWidth = 0.95;
              ctx.globalAlpha = 0.16 + t * 0.18;
          }
          ctx.stroke();
      }
      ctx.restore();
  }

  /**
   * 绘制留在粉色沙滩上的渐隐潮痕虚线
   */
  function drawTideTraces(dt) {
      for (let i = traceLines.length - 1; i >= 0; i--) {
          const tr = traceLines[i];
          tr.life -= dt * tr.decay * config.speedMultiplier;
          if (tr.life <= 0) {
              traceLines.splice(i, 1);
              continue;
          }

          const steps = 84;
          ctx.save();
          ctx.setLineDash([4, 6]);
          ctx.lineCap = 'round';

          // 绘制两道细微的退潮水线痕迹
          for (let layer = 0; layer < 2; layer++) {
              ctx.beginPath();
              for (let s = 0; s <= steps; s++) {
                  const yRatio = s / steps;
                  const shoreX = getShorelineX(yRatio, globalTime);
                  const wx =
                      evaluateWaveX(
                          tr.reach,
                          yRatio,
                          tr.harmonics,
                          tr.timeSnapshot,
                          tr.focusY,
                          tr.focusBoost
                      ) -
                      layer * width * 0.015;
                  const x = Math.max(shoreX, wx);
                  if (s === 0) ctx.moveTo(x, 0);
                  else ctx.lineTo(x, yRatio * height);
              }
              ctx.strokeStyle = layer === 0 ? PALETTE.foam[1] : PALETTE.sand[0];
              ctx.lineWidth = layer === 0 ? 1.3 : 1.0;
              ctx.globalAlpha = tr.life * (layer === 0 ? 0.55 : 0.4);
              ctx.stroke();
          }

          ctx.restore();
      }
  }

  /**
   * 更新并绘制所有粒子（左侧海洋流线粒子 + 右侧粉色沙滩微粒 + 浪花迸发粒子）
   */
  function updateAndDrawAllParticles(dt) {
      // 1. 左侧海洋由左向右流动的带尾迹粒子
      ctx.save();
      ctx.lineCap = 'round';
      for (let i = 0; i < seaParticles.length; i++) {
          const p = seaParticles[i];
          p.nx += p.vx * dt * config.speedMultiplier;
          p.ny += (p.vy + Math.sin(globalTime * 1.5 + p.phase) * 0.006) * dt * config.speedMultiplier;

          if (p.ny < 0) p.ny += 1;
          if (p.ny > 1) p.ny -= 1;

          const shoreRatio = getShorelineX(p.ny, globalTime) / width;
          if (p.nx > shoreRatio + 0.03) {
              Object.assign(p, createSeaParticle(rand(0, 0.04)));
          }

          const px = p.nx * width;
          const py = p.ny * height;
          const tailX = Math.max(0, px - p.trailLen * config.speedMultiplier);

          ctx.strokeStyle = p.color;
          ctx.lineWidth = p.size * 0.75;
          ctx.globalAlpha = p.alpha * 0.55;
          ctx.beginPath();
          ctx.moveTo(tailX, py);
          ctx.lineTo(px, py);
          ctx.stroke();

          ctx.fillStyle = p.color;
          ctx.globalAlpha = p.alpha;
          ctx.beginPath();
          ctx.arc(px, py, p.size * 0.7, 0, Math.PI * 2);
          ctx.fill();
      }
      ctx.restore();

      // 2. 右侧暖蜜桃粉色沙滩静态微颤粒子
      ctx.save();
      for (let i = 0; i < sandParticles.length; i++) {
          const p = sandParticles[i];
          p.nx += p.vx * dt * 0.4;
          p.ny += p.vy * dt * 0.4;

          const shoreRatio = getShorelineX(p.ny, globalTime) / width;
          if (p.nx < shoreRatio) p.nx = shoreRatio + rand(0.01, 0.42);
          if (p.nx > 0.995) p.nx = shoreRatio + rand(0.02, 0.4);
          if (p.ny < 0) p.ny += 1;
          if (p.ny > 1) p.ny -= 1;

          const twinkle = 0.65 + 0.35 * Math.sin(globalTime * 1.8 + p.phase);
          ctx.fillStyle = p.color;
          ctx.globalAlpha = p.alpha * twinkle;
          ctx.beginPath();
          ctx.arc(p.nx * width, p.ny * height, p.size, 0, Math.PI * 2);
          ctx.fill();
      }
      ctx.restore();

      // 3. 浪峰前缘迸发的白色/松石浪花粒子
      ctx.save();
      for (let i = foamParticles.length - 1; i >= 0; i--) {
          const fp = foamParticles[i];
          fp.x += fp.vx * dt * config.speedMultiplier;
          fp.y += fp.vy * dt * config.speedMultiplier;
          fp.vx *= 0.97;
          fp.life -= dt * fp.decay * config.speedMultiplier;

          if (fp.life <= 0) {
              foamParticles.splice(i, 1);
              continue;
          }

          ctx.fillStyle = fp.color;
          ctx.globalAlpha = Math.sin(fp.life * Math.PI) * 0.92;
          ctx.beginPath();
          ctx.arc(fp.x, fp.y, fp.size * (0.4 + 0.6 * fp.life), 0, Math.PI * 2);
          ctx.fill();
      }
      ctx.restore();
  }

  /**
   * 初始化多道错开相位的线条海浪
   */
  function initWaves() {
      waveFronts = [];
      traceLines = [];
      foamParticles = [];
      waveFronts.push(new LineWaveFront(0.74));
      waveFronts.push(new LineWaveFront(0.48));
      waveFronts.push(new LineWaveFront(0.24));
      waveFronts.push(new LineWaveFront(0.02));
  }

  // 主动画循环
  let lastTime = 0;
  function animate(timestamp) {
      if (!lastTime) lastTime = timestamp;
      const dt = Math.min((timestamp - lastTime) / 1000, 0.05);
      lastTime = timestamp;

      globalTime += dt * config.speedMultiplier;

      // 1. 绘制分界基底与左右背景流线/沙丘等高线
      drawLineAndParticleBackdrop();

      // 2. 绘制沙滩上的渐隐潮痕虚线
      drawTideTraces(dt);

      // 3. 持续保持多道抽象波浪线束从左向右涌动
      if (waveFronts.length < 4) {
          const minProgress = waveFronts.reduce((min, w) => Math.min(min, w.progress), 1);
          if (minProgress > 0.22) {
              waveFronts.push(new LineWaveFront(0));
          }
      }

      waveFronts.sort((a, b) => b.progress - a.progress);
      for (let i = waveFronts.length - 1; i >= 0; i--) {
          const wf = waveFronts[i];
          wf.update(dt);
          if (wf.progress >= 1) {
              waveFronts.splice(i, 1);
          } else {
              wf.draw(ctx);
          }
      }

      // 4. 更新与绘制所有粒子
      updateAndDrawAllParticles(dt);

      if (running) rafId = requestAnimationFrame(animate);
  }


  function start() {
    if (running || reduced) return;
    running = true; lastTime = 0; rafId = requestAnimationFrame(animate);
  }
  function stop() { running = false; cancelAnimationFrame(rafId); }
  function sync() { if (!wrap.hidden) resizeCanvas(); (!wrap.hidden && !document.hidden) ? start() : stop(); } // 重新出現時（例如登出後）重算大小
  resizeCanvas(); initWaves();
  if (reduced) { for (let i = 0; i < 90; i++) { globalTime += 0.05; waveFronts.forEach(w => w.update(0.05)); } running = false; drawLineAndParticleBackdrop(); waveFronts.forEach(w => w.draw(ctx)); updateAndDrawAllParticles(0); }
  addEventListener('resize', () => { resizeCanvas(); if (reduced) { drawLineAndParticleBackdrop(); waveFronts.forEach(w => w.draw(ctx)); } });
  document.addEventListener('visibilitychange', sync);
  new MutationObserver(sync).observe(wrap, { attributes: true, attributeFilter: ['hidden'] });
  sync();
})();
