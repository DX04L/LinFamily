/* Pinky Jump Arcade + phone motion controller prototype.
   Firestore is optional: offline Top 10 and same-browser BroadcastChannel continue to work. */
(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const controllerPage = document.body.dataset.pinkyPage === 'controller';
  const urlRoom = (new URLSearchParams(location.search).get('room') || '').trim().toUpperCase();
  const STORE = 'pinky_jump_arcade_top10_v1';
  const sdk = 'https://www.gstatic.com/firebasejs/11.10.0/';
  const firebaseConfig = {
    apiKey: 'AIzaSyBPcURIjgwtEVi_nTaZT569e_nwJb4IsUs',
    authDomain: 'linfamily-31cb6.firebaseapp.com',
    projectId: 'linfamily-31cb6',
    appId: '1:299667187224:web:8df32264698caad761c56d'
  };
  const roomPattern = /^[A-HJ-NP-Z2-9]{6}$/;
  let cloudPromise = null;
  let roomUnsub = null;
  let scoreUnsub = null;
  let channel = null;
  let roomCode = '';
  let roomRef = null;
  let messageSeq = 0;
  let remoteBoard = null;
  let remoteOnline = false;
  let pendingScore = 0;
  let lastRemoteAt = 0;
  let commandQueue = Promise.resolve();

  async function cloud() {
    if (!cloudPromise) {
      cloudPromise = (async () => {
        const [appMod, fs, authMod] = await Promise.all([
          import(sdk + 'firebase-app.js'),
          import(sdk + 'firebase-firestore.js'),
          import(sdk + 'firebase-auth.js')
        ]);
        const name = 'pinky-jump-arcade';
        const app = appMod.getApps().find(a => a.name === name) ||
          appMod.initializeApp(firebaseConfig, name);
        const auth = authMod.getAuth(app);
        if (!auth.currentUser) await authMod.signInAnonymously(auth);
        return {fs, auth, db: fs.getFirestore(app)};
      })();
    }
    return cloudPromise;
  }
  function setText(id, value) { if ($(id)) $(id).textContent = String(value); }
  function errorText(err) {
    const value = String((err && (err.code || err.message)) || err || '連線失敗');
    if (/permission|unauthorized|operation-not-allowed|auth\/admin-restricted-operation/.test(value))
      return 'Firebase 尚未啟用遊戲權限／匿名登入。可先試本機操作；跨裝置要先完成 Firebase 設定。';
    return '無法連線 Firebase（' + value.slice(0,75) + '）。可先試本機模式。';
  }
  function normalizeScores(rows) {
    return (Array.isArray(rows) ? rows : [])
      .filter(x => x && Number.isFinite(Number(x.score)) && Number(x.score) >= 0)
      .map(x => ({name: String(x.name || 'PINKY').slice(0,12),
        score: Math.floor(Number(x.score))}))
      .sort((a,b)=> b.score - a.score)
      .slice(0,10);
  }
  function localScores() {
    try { return normalizeScores(JSON.parse(localStorage.getItem(STORE) || '[]')); }
    catch (_) { return []; }
  }
  function saveLocal(row) {
    const next = normalizeScores([...localScores(), row]);
    try { localStorage.setItem(STORE,JSON.stringify(next)); } catch (_) {}
    return next;
  }
  function currentBoard() { return remoteOnline && remoteBoard ? remoteBoard : localScores(); }
  function qualifies(score) {
    const board=currentBoard(), value=Math.floor(Number(score));
    return value > 0 && (board.length < 10 || value > board[board.length - 1].score);
  }
  function refreshScores() {
    const rows = $('pinky-rank-rows');
    if (!rows) return;
    rows.replaceChildren();
    const board=currentBoard();
    if (!board.length) {
      const item=document.createElement('li');
      item.textContent='還沒有紀錄，第一位挑戰者就是你！';
      item.className='pinky-empty';
      rows.appendChild(item);
    }
    board.forEach((entry,index)=>{
      const row=document.createElement('li'); row.className='pinky-score-row';
      const rank=document.createElement('span'); rank.textContent=String(index+1).padStart(2,'0');
      const name=document.createElement('span'); name.textContent=entry.name;
      const points=document.createElement('strong'); points.textContent=String(entry.score).padStart(6,'0');
      row.append(rank,name,points); rows.appendChild(row);
    });
    setText('pinky-rank-origin',remoteOnline ? '🌐 Firebase 共用排行榜（測試版）' : '📱 本機 Top 10（目前瀏覽器）');
  }
  function showBoard() {
    refreshScores();
    const dialog=$('pinky-rank-dialog');
    if (dialog && !dialog.open) dialog.showModal();
  }
  function hideRecord() {
    const p=$('record-panel'); if(p) p.classList.add('hidden');
  }
  function newRecord(score) {
    const gameover=$('gameover-panel'),panel=$('record-panel');
    if (!panel || !qualifies(score)) return;
    pendingScore=Math.floor(score);
    setText('pinky-new-score',String(pendingScore).padStart(6,'0'));
    if (gameover) gameover.classList.add('hidden');
    panel.classList.remove('hidden');
    const input=$('pinky-player-name');
    if (input) {input.value='';input.focus({preventScroll:true});}
  }
  async function submitScore(event) {
    event.preventDefault();
    const input=$('pinky-player-name');
    const raw=(input && input.value || '').trim().replace(/\s+/g,' ');
    const name=raw.slice(0,12) || 'PINKY';
    const score=pendingScore; if (!score) return;
    pendingScore=0;
    saveLocal({name,score});
    hideRecord();
    const gameover=$('gameover-panel');
    if(gameover) gameover.classList.remove('hidden');
    showBoard();
    try {
      const {fs,db,auth}=await cloud();
      await fs.addDoc(fs.collection(db,'pinky_jump_scores'),{
        name,score,owner:auth.currentUser.uid,createdAt:fs.serverTimestamp()
      });
      // Snapshot refreshes the shared board after the write.
    } catch (err) {
      setText('pinky-rank-origin',errorText(err)+' 目前保留本機成績。');
    }
  }
  function renderRoomStatus(text) { setText(controllerPage?'controller-status':'pinky-pair-status',text); }
  function makeCode() {
    const bytes=new Uint8Array(6);
    crypto.getRandomValues(bytes);
    const alphabet='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    return Array.from(bytes,b=>alphabet[b%alphabet.length]).join('');
  }
  function connectChannel(code) {
    if(channel) channel.close();
    channel=typeof BroadcastChannel === 'function' ?
      new BroadcastChannel('pinky_room_' + code) : null;
    if (channel && !controllerPage) {
      channel.onmessage=event => receiveCommand(event.data);
    }
  }
  function receiveCommand(payload) {
    if(!payload || !['jump','start','ready'].includes(payload.action))return;
    if(payload.action === 'ready') {renderRoomStatus('手機控制器已配對，可以開始跳躍！');return;}
    if(payload.action === 'start') {
      if(typeof window.pinkyRemoteStart==='function') window.pinkyRemoteStart();
      return;
    }
    const now=Date.now();
    if(now-lastRemoteAt<260)return;
    lastRemoteAt=now;
    if(typeof window.pinkyRemoteJump==='function')
      window.pinkyRemoteJump(Math.max(.1,Math.min(1,Number(payload.power)||.6)));
  }
  async function createRoom() {
    const btn=$('pinky-create-room');
    if (btn) btn.disabled=true;
    const code=makeCode();
    roomCode=code;
    messageSeq=0;
    connectChannel(code);
    setText('pinky-room-code',code);
    const link=new URL('controller.html',location.href);
    link.searchParams.set('room',code);
    const field=$('pinky-room-link');
    if(field)field.value=link.href;
    renderRoomStatus('正在建立配對…');
    const dialog=$('pinky-pair-dialog');
    if(dialog && !dialog.open)dialog.showModal();
    try {
      const {db,fs,auth}=await cloud();
      roomRef=fs.doc(db,'pinky_jump_rooms',code);
      await fs.setDoc(roomRef,{
        host:auth.currentUser.uid,controller:'',action:'waiting',seq:0,power:0,
        createdAt:fs.serverTimestamp(),updatedAt:fs.serverTimestamp()
      });
      if(roomUnsub)roomUnsub();
      roomUnsub=fs.onSnapshot(roomRef,snap=>{
        if(!snap.exists())return;
        const data=snap.data();
        if(data.seq<=messageSeq)return;
        messageSeq=data.seq;
        receiveCommand(data);
      },err=>renderRoomStatus(errorText(err)));
      renderRoomStatus('配對碼已建立。用手機開啟連結或輸入代碼。');
    } catch(err) {
      renderRoomStatus(errorText(err)+'（同瀏覽器兩分頁仍可測試）');
    } finally {if(btn)btn.disabled=false;}
  }
  function updateControllerStatus(text) { setText('controller-status',text); }
  async function connectPhone() {
    const input=$('controller-room-input');
    const code=(input ? input.value : '').trim().toUpperCase();
    if(!roomPattern.test(code)) {updateControllerStatus('請輸入 6 碼配對代碼。');return;}
    roomCode=code;
    connectChannel(code);
    const button=$('controller-connect');
    if(button)button.disabled=true;
    updateControllerStatus('正在連線…');
    try {
      const {fs,db,auth}=await cloud();
      const ref=fs.doc(db,'pinky_jump_rooms',code);
      const snap=await fs.getDoc(ref);
      if(!snap.exists())throw Error('配對碼不存在，請從電腦重新建立');
      const data=snap.data();
      if(data.createdAt && data.createdAt.toMillis && Date.now()-data.createdAt.toMillis()>3600000)
        throw Error('配對碼已過期');
      roomRef=ref;
      // Only the first paired controller can send commands.
      await fs.updateDoc(ref,{
        controller:auth.currentUser.uid,action:'ready',power:0,seq:fs.increment(1),
        updatedAt:fs.serverTimestamp()
      });
      updateControllerStatus('✅ 已連線！手機抬起或點跳躍按鈕試試。');
    } catch(err) {
      updateControllerStatus(errorText(err)+' 同一個瀏覽器可使用兩分頁測試。');
    } finally {if(button)button.disabled=false;}
    const area=$('controller-actions');
    if(area)area.hidden=false;
    const sensor=$('controller-sensor');
    if(sensor)sensor.hidden=false;
  }
  function sendCommand(action,power=.6) {
    if(!roomCode) {updateControllerStatus('請先輸入配對碼並連接。');return;}
    const message={action,power,at:Date.now()};
    if(channel)channel.postMessage(message);
    if(!roomRef)return;
    commandQueue=commandQueue.catch(()=>{}).then(async()=>{
      const {fs,auth}=await cloud();
      await fs.updateDoc(roomRef,{
        controller:auth.currentUser.uid,action,power,
        seq:fs.increment(1),updatedAt:fs.serverTimestamp()
      });
    }).catch(err=>updateControllerStatus(errorText(err)));
  }
  // DeviceMotion (accelerometer) with gravity low-pass filtering.
  let motionEnabled=false;
  let stable=0,gx=0,gy=0,gz=0;
  let lastFire=0, peak=0, pulseTimer=null;
  let sensorEvents=0;
  function resetCalibration() {
    stable=0;gx=0;gy=0;gz=0;peak=0;lastFire=0;sensorEvents=0;
    updateControllerStatus('請保持手機穩定約 1 秒，正在校準感應器…');
  }
  function motionFrame(e) {
    const a=e.accelerationIncludingGravity || e.acceleration;
    if(!a || ![a.x,a.y,a.z].every(Number.isFinite))return;
    sensorEvents++;
    if(stable<35) {
      const alpha=stable===0?1:.1;
      gx+=alpha*(a.x-gx);gy+=alpha*(a.y-gy);gz+=alpha*(a.z-gz);
      stable++;
      if(stable===35)updateControllerStatus('感應器已就緒，輕輕向上抬手機測試。');
      return;
    }
    const dx=a.x-gx,dy=a.y-gy,dz=a.z-gz;
    const gravity=Math.max(1,Math.hypot(gx,gy,gz));
    const along=(dx*gx+dy*gy+dz*gz)/gravity;
    const amplitude=Math.max(0,along,Math.hypot(dx,dy,dz)*.52);
    // Slow orientation changes only; do not absorb a real jump immediately.
    gx+=dx*.012;gy+=dy*.012;gz+=dz*.012;
    const level=$('controller-sensitivity')?.value || 'normal';
    const threshold=level==='high'?2.4:level==='low'?5.5:3.6;
    const meter=$('controller-meter-fill');
    if(meter)meter.style.width=Math.min(100,amplitude/13*100)+'%';
    const now=performance.now();
    if(now-lastFire<720)return; // landing bounce suppression
    if(amplitude>threshold && !pulseTimer) {
      peak=amplitude;
      pulseTimer=setTimeout(()=>{
        pulseTimer=null;
        lastFire=performance.now();
        const strength=Math.max(.25,Math.min(1,(peak-threshold)/10+.32));
        setText('controller-last-power',Math.round(strength*100)+'%');
        sendCommand('jump',strength);
        peak=0;
      },90);
    } else if(pulseTimer) peak=Math.max(peak,amplitude);
  }
  async function enableSensor() {
    if(typeof DeviceMotionEvent==='undefined') {
      updateControllerStatus('這個裝置不支援動作感應；可以使用畫面上的跳躍按鈕。');
      return;
    }
    try {
      if(typeof DeviceMotionEvent.requestPermission==='function'){
        const permission=await DeviceMotionEvent.requestPermission();
        if(permission!=='granted')throw Error('未取得動作感應權限');
      }
      if(!motionEnabled)window.addEventListener('devicemotion',motionFrame);
      motionEnabled=true;
      resetCalibration();
      setTimeout(()=>{if(sensorEvents===0)
        updateControllerStatus('沒有收到感應器資料；請確認瀏覽器允許動作感應，或使用手動按鈕。');
      },2500);
    } catch(err){updateControllerStatus('無法使用動作感應：'+String(err.message||err));}
  }
  function initController() {
    $('controller-room-input').value=roomPattern.test(urlRoom)?urlRoom:'';
    $('controller-connect')?.addEventListener('click',connectPhone);
    $('controller-activate-sensor')?.addEventListener('click',enableSensor);
    $('controller-calibrate')?.addEventListener('click',resetCalibration);
    $('controller-start-game')?.addEventListener('click',()=>sendCommand('start',0));
    let pressedAt=0;
    $('controller-jump')?.addEventListener('pointerdown',e=>{
      pressedAt=performance.now(); if(e.currentTarget.setPointerCapture) e.currentTarget.setPointerCapture(e.pointerId);
    });
    $('controller-jump')?.addEventListener('pointerup',()=>{
      const ms=performance.now()-pressedAt;
      sendCommand('jump',Math.max(.25,Math.min(1,ms/600)));
      setText('controller-last-power',Math.round(Math.max(.25,Math.min(1,ms/600))*100)+'%');
    });
    $('controller-jump')?.addEventListener('click',e=>{
      if(e.detail===0)sendCommand('jump',.65); // keyboard accessibility
    });
  }
  function initGame() {
    window.pinkyArcade={
      onStart(){hideRecord();pendingScore=0;},
      onGameOver(score){newRecord(score);},
      localBest(){return localScores()[0]?.score || 0;}
    };
    $('pinky-rank-btn')?.addEventListener('click',showBoard);
    $('pinky-rank-close')?.addEventListener('click',()=>$('pinky-rank-dialog').close());
    $('pinky-rank-dialog')?.addEventListener('click',e=>{
      if(e.target===$('pinky-rank-dialog'))e.target.close();
    });
    $('pinky-record-form')?.addEventListener('submit',submitScore);
    $('pinky-skip-record')?.addEventListener('click',()=>{
      pendingScore=0;hideRecord();$('gameover-panel')?.classList.remove('hidden');
    });
    $('pinky-pair-btn')?.addEventListener('click',()=>{
      const modal=$('pinky-pair-dialog');if(modal && !modal.open)modal.showModal();
    });
    $('pinky-create-room')?.addEventListener('click',createRoom);
    $('pinky-pair-close')?.addEventListener('click',()=>$('pinky-pair-dialog').close());
    $('pinky-copy-link')?.addEventListener('click',async()=>{
      const link=$('pinky-room-link')?.value;
      if(!link)return;
      try{await navigator.clipboard.writeText(link);renderRoomStatus('✅ 已複製連線網址，傳到手機即可。');}
      catch(_) { $('pinky-room-link')?.select();renderRoomStatus('已選取網址，請手動複製。');}
    });
    refreshScores();
    cloud().then(({db,fs})=>{
      scoreUnsub=fs.onSnapshot(
        fs.query(fs.collection(db,'pinky_jump_scores'),fs.orderBy('score','desc'),fs.limit(10)),
        snap=>{
          remoteBoard=normalizeScores(snap.docs.map(d=>d.data()));
          remoteOnline=true;
          refreshScores();
          const best=Math.max(localScores()[0]?.score||0,remoteBoard[0]?.score||0);
          setText('hi-score',String(best).padStart(5,'0'));
        },
        err=>{
          remoteOnline=false;
          refreshScores();
          setText('pinky-rank-origin',errorText(err)+' 本機成績仍可使用。');
        }
      );
    }).catch(()=>{refreshScores();});
  }
  if(controllerPage) initController();
  else initGame();
})();
