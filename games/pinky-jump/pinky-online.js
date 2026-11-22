/* Pinky Jump: Firebase global Top 10 and complete single-page phone controller. */
(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const controllerPage = document.body.dataset.pinkyPage === 'controller';
  const urlRoom = (new URLSearchParams(location.search).get('room') || '').trim().toUpperCase();
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
  let remoteBoard = [];
  let remoteOnline = false;
  let globalError = '正在連接全球排行榜…';
  let phoneRoomUnsub = null;
  let controllerConnected = false;
  let controllerPhase = 'ready';
  let currentRoomScore = 0;
  let hostQueue = Promise.resolve();
  let pendingScore = 0;
  let scoreSubmitting = false;
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
    return cloudPromise.catch(err => { cloudPromise = null; throw err; });
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
  function qualifies(score) {
    if (!remoteOnline) return false;
    const board=remoteBoard, value=Math.floor(Number(score));
    return value > 0 && (board.length < 10 || value > board[board.length-1].score);
  }
  function refreshScores() {
    const board = remoteOnline ? remoteBoard : [];
    for (const [listId, statusId] of [
      ['pinky-rank-rows','pinky-rank-origin'],
      ['controller-rank-rows','controller-rank-status']
    ]) {
      const rows = $(listId);
      if (!rows) continue;
      rows.replaceChildren();
      if (remoteOnline && !board.length) {
        const li=document.createElement('li');
        li.className='pinky-empty';
        li.textContent='全球排行榜還沒有任何紀錄，歡迎成為第一位！';
        rows.appendChild(li);
      }
      board.forEach((entry,index)=>{
        const li=document.createElement('li');li.className='pinky-score-row';
        const rank=document.createElement('span');rank.textContent=String(index+1).padStart(2,'0');
        const name=document.createElement('span');name.textContent=entry.name;
        const points=document.createElement('strong');points.textContent=String(entry.score).padStart(6,'0');
        li.append(rank,name,points);rows.appendChild(li);
      });
      setText(statusId,remoteOnline ?
        '🌐 全球共用 Top 10（即時同步）' :
        '⚠️ 全球排行榜未連線：' + globalError);
    }
    if (!controllerPage) {
      setText('hi-score',remoteOnline ? String(board[0]?.score||0).padStart(5,'0') : '-----');
    }
  }
  function showBoard() {
    refreshScores();
    const dialog=$('pinky-rank-dialog');
    if(dialog && !dialog.open)dialog.showModal();
  }
  function hideRecord() {
    $('record-panel')?.classList.add('hidden');
  }
  function newRecord(score) {
    const panel=$('record-panel'),gameover=$('gameover-panel');
    if (!panel || !qualifies(score)) return false;
    pendingScore=Math.floor(score);
    setText('pinky-new-score',String(pendingScore).padStart(6,'0'));
    gameover?.classList.add('hidden');
    panel.classList.remove('hidden');
    // On a paired game, the child enters a name on the phone. Desktop entry
    // is available too, but should not steal keyboard focus from the phone.
    if (!roomRef) {
      const input=$('pinky-player-name');
      if(input){input.value='';input.focus({preventScroll:true});}
    }
    return true;
  }
  function hostSetPhase(phase,runScore=0) {
    if(!roomRef || controllerPage)return;
    hostQueue=hostQueue.catch(()=>{}).then(async()=>{
      const {fs}=await cloud();
      await fs.updateDoc(roomRef,{
        phase,runScore:Math.max(0,Math.floor(Number(runScore)||0)),
        updatedAt:fs.serverTimestamp()
      });
    }).catch(err=>renderRoomStatus(errorText(err)));
  }
  async function saveGlobalScore(nameInput) {
    const name=String(nameInput||'').trim().replace(/\s+/g,' ').slice(0,12)||'PINKY';
    const score=pendingScore;
    if(!score || !remoteOnline){
      renderRoomStatus('全球排行榜未連線，目前無法提交分數');
      if(!controllerPage) setText('pinky-record-message','全球排行榜未連線，請稍後重試。');
      return false;
    }
    if(scoreSubmitting)return false;
    scoreSubmitting=true;
    try {
      const {fs,db,auth}=await cloud();
      await fs.addDoc(fs.collection(db,'pinky_jump_scores'),{
        name,score,owner:auth.currentUser.uid,createdAt:fs.serverTimestamp()
      });
      pendingScore=0;
      hideRecord();
      $('gameover-panel')?.classList.remove('hidden');
      hostSetPhase('submitted',score);
      return true;
    } catch(err) {
      const message=errorText(err);
      setText('pinky-record-message',message);
      renderRoomStatus(message);
      hostSetPhase('record_error',score);
      return false;
    } finally {
      scoreSubmitting=false;
    }
  }
  async function submitScore(event) {
    event.preventDefault();
    const name=$('pinky-player-name')?.value;
    if(await saveGlobalScore(name)) showBoard();
  }
  async function saveFromPhone(name) {
    if (controllerPage) return;
    await saveGlobalScore(name);
  }
  function initSharedScores() {
    refreshScores();
    cloud().then(({db,fs})=>{
      if(scoreUnsub)scoreUnsub();
      scoreUnsub=fs.onSnapshot(
        fs.query(fs.collection(db,'pinky_jump_scores'),fs.orderBy('score','desc'),fs.limit(10)),
        snap=>{
          // A cached snapshot may not reflect scores from other devices.
          if(snap.metadata?.fromCache){
            remoteOnline=false;
            globalError='正在等待 Firebase 伺服器確認全球名次';
          }else{
            remoteBoard=normalizeScores(snap.docs.map(d=>d.data()));
            remoteOnline=true;
            globalError='';
          }
          refreshScores();
        },
        err=>{
          remoteOnline=false;
          globalError=errorText(err);
          refreshScores();
        }
      );
    }).catch(err=>{
      remoteOnline=false;
      globalError=errorText(err);
      refreshScores();
    });
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
    if (!payload || !['jump','start','ready','submit','skip'].includes(payload.action))return;
    if (payload.action === 'ready') {
      renderRoomStatus('✅ 手機已配對，所有遊戲流程都能在手機操作。');
      return;
    }
    if (payload.action === 'start') {
      window.pinkyRemoteStart?.();
      return;
    }
    if (payload.action === 'submit') {
      saveFromPhone(payload.playerName || 'PINKY');
      return;
    }
    if (payload.action === 'skip') {
      const final=pendingScore;
      pendingScore=0;
      hideRecord();
      $('gameover-panel')?.classList.remove('hidden');
      hostSetPhase('submitted',final);
      return;
    }
    const now=Date.now();
    if(now-lastRemoteAt<340)return;
    lastRemoteAt=now;
    window.pinkyRemoteJump?.(Math.max(.05,Math.min(1,Number(payload.power)||.15)));
  }

  async function createRoom() {
    const btn=$('pinky-create-room');
    if(btn)btn.disabled=true;
    const code=makeCode();
    roomCode=code;
    messageSeq=0;
    if(roomUnsub){roomUnsub();roomUnsub=null;}
    roomRef=null;
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
      const ref=fs.doc(db,'pinky_jump_rooms',code);
      await fs.setDoc(ref,{
        host:auth.currentUser.uid,controller:'',action:'waiting',seq:0,power:0,playerName:'',
        phase:'ready',runScore:0,
        createdAt:fs.serverTimestamp(),updatedAt:fs.serverTimestamp()
      });
      roomRef=ref;
      roomUnsub=fs.onSnapshot(ref,snap=>{
        if(!snap.exists())return;
        const data=snap.data();
        if(data.seq<=messageSeq)return;
        messageSeq=data.seq;
        receiveCommand(data);
      },err=>renderRoomStatus(errorText(err)));
      renderRoomStatus('✅ 配對碼已建立。手機連上後就可以操作整個遊戲。');
    } catch(err) {
      renderRoomStatus(errorText(err));
    } finally {if(btn)btn.disabled=false;}
  }
  function updateControllerStatus(text) {
    setText(controllerConnected?'controller-live-status':'controller-status',text);
  }
  function updatePhonePhase(data) {
    if(!controllerConnected)return;
    const phase=String(data.phase||'ready'),score=Math.max(0,Math.floor(Number(data.runScore)||0));
    currentRoomScore=score;
    const phaseChanged=controllerPhase!==phase;
    controllerPhase=phase;
    const playing=phase==='ready'||phase==='playing'||phase==='submitted';
    $('controller-actions').hidden=!playing;
    $('controller-sensor').hidden=!playing;
    $('controller-finish').hidden=phase!=='gameover';
    $('controller-record').hidden=!['record','record_error'].includes(phase);
    setText('controller-final-score',String(score).padStart(6,'0'));
    setText('controller-record-score',String(score).padStart(6,'0'));
    if(phase==='record' && phaseChanged && $('controller-player-name'))
      $('controller-player-name').value='';
    const messages={
      ready:'✅ 已配對！按「開始」或等待電腦開始。',
      playing:'🎮 遊戲進行中，開始跳躍吧！',
      gameover:'💫 遊戲結束，可以直接在手機按「再玩一次」。',
      record:'🏆 進入全球 Top 10！請在手機輸入名字登記。',
      record_error:'⚠️ 成績提交失敗，請重新按「確認登記」。',
      submitted:'✅ 登記完成／結束。可以直接按開始再玩！'
    };
    updateControllerStatus(messages[phase]||'已連線');
  }
  function disconnectPhone(message='已中斷連線。請重新輸入配對碼。') {
    controllerConnected=false;
    roomRef=null;
    if(phoneRoomUnsub){phoneRoomUnsub();phoneRoomUnsub=null;}
    if(channel){channel.close();channel=null;}
    $('controller-setup').hidden=false;
    $('controller-connected').hidden=true;
    setText('controller-status',message);
    if(pulseTimer){clearTimeout(pulseTimer);pulseTimer=null;}
  }
  async function connectPhone() {
    const input=$('controller-room-input');
    const code=(input?.value||'').trim().toUpperCase();
    if(!roomPattern.test(code)){updateControllerStatus('請輸入有效的 6 碼配對碼。');return;}
    const button=$('controller-connect');
    if(button)button.disabled=true;
    setText('controller-status','正在連線…');
    try {
      const {fs,db,auth}=await cloud();
      const ref=fs.doc(db,'pinky_jump_rooms',code);
      const snap=await fs.getDoc(ref);
      if(!snap.exists())throw Error('配對碼不存在，請在電腦重新建立');
      const data=snap.data();
      if(data.createdAt?.toMillis && Date.now()-data.createdAt.toMillis()>3600000)
        throw Error('配對碼已過期');
      if(data.controller && data.controller!==auth.currentUser.uid)
        throw Error('這組配對碼已由另一支手機使用；請重新建立新房間');
      await fs.updateDoc(ref,{
        controller:auth.currentUser.uid,action:'ready',power:0,
        playerName:'',seq:fs.increment(1),updatedAt:fs.serverTimestamp()
      });
      roomCode=code;
      roomRef=ref;
      controllerConnected=true;
      connectChannel(code);
      $('controller-setup').hidden=true;
      $('controller-connected').hidden=false;
      phoneRoomUnsub=fs.onSnapshot(ref,roomSnap=>{
        if(!roomSnap.exists()) {disconnectPhone('配對房間已不存在，請重新連線');return;}
        const data=roomSnap.data();
        if(data.createdAt?.toMillis && Date.now()-data.createdAt.toMillis()>3600000){
          disconnectPhone('配對碼已到期，請在電腦重新建立');return;
        }
        updatePhonePhase(data);
      },err=>disconnectPhone(errorText(err)));
      updatePhonePhase(data);
      if(motionEnabled)resetCalibration();
      if(!remoteOnline)initSharedScores();
    } catch(err) {
      controllerConnected=false;
      roomRef=null;
      setText('controller-status',errorText(err));
      $('controller-setup').hidden=false;
      $('controller-connected').hidden=true;
    } finally {if(button)button.disabled=false;}
  }
  function sendCommand(action,power=.15,name='') {
    if(!controllerConnected||!roomRef){updateControllerStatus('已斷線，請重新配對');return;}
    const message={action,power,playerName:String(name||'').slice(0,12),at:Date.now()};
    // Firebase is the single transport; avoid duplicate submit/start events from local channels.
    if(channel && !roomRef)channel.postMessage(message);
    const ref=roomRef;
    commandQueue=commandQueue.catch(()=>{}).then(async()=>{
      const {fs,auth}=await cloud();
      if(!controllerConnected||roomRef!==ref)return;
      await fs.updateDoc(ref,{
        controller:auth.currentUser.uid,action,power,playerName:message.playerName,
        seq:fs.increment(1),updatedAt:fs.serverTimestamp()
      });
    }).catch(err=>disconnectPhone(errorText(err)));
  }
  // Vertical impulse sensor: conservative by default. No full-height jumps
  // from small shakes or landing bounce. Sensor values are not real jump height.
  let motionEnabled=false;
  let stable=0,gx=0,gy=0,gz=0;
  let sensorEvents=0,lastFire=0,armed=true,quietFrames=0,strongFrames=0;
  let peak=0,pulseTimer=null;
  function resetCalibration() {
    stable=0;gx=0;gy=0;gz=0;
    peak=0;armed=true;quietFrames=0;strongFrames=0;lastFire=0;
    if(pulseTimer){clearTimeout(pulseTimer);pulseTimer=null;}
    setText('controller-meter-fill','');
    updateControllerStatus('請握穩手機約 1 秒，正在校準感應器…');
  }
  function motionFrame(event) {
    if(!controllerConnected||controllerPhase!=='playing')return;
    const withGravity=event.accelerationIncludingGravity;
    const a=withGravity||event.acceleration;
    if(!a||![a.x,a.y,a.z].every(Number.isFinite))return;
    sensorEvents++;
    if(stable<55) {
      const alpha=stable===0?1:.06;
      gx+=alpha*(a.x-gx);gy+=alpha*(a.y-gy);gz+=alpha*(a.z-gz);
      stable++;
      if(stable===55)updateControllerStatus('✅ 感應器已校準。試著明顯向上抬手機。');
      return;
    }
    const dx=a.x-gx,dy=a.y-gy,dz=a.z-gz;
    const gravity=Math.max(1,Math.hypot(gx,gy,gz));
    const along=(dx*gx+dy*gy+dz*gz)/gravity;
    // Use upward acceleration only, not arbitrary 3D shaking.
    const amplitude=withGravity?Math.max(0,along):Math.max(0,Math.hypot(dx,dy,dz)-2);
    // Freeze the baseline during actual movement to avoid false retriggers.
    if(amplitude<2.2){gx+=dx*.008;gy+=dy*.008;gz+=dz*.008;}
    const level=$('controller-sensitivity')?.value||'low';
    const settings={
      low:    {threshold:11.0,cap:.34,range:32,cooldown:1550},
      normal: {threshold:7.2, cap:.55,range:26,cooldown:1250},
      high:   {threshold:4.6, cap:.72,range:22,cooldown:1050}
    };
    const cfg=settings[level]||settings.low;
    const meter=$('controller-meter-fill');
    if(meter)meter.style.width=Math.min(100,amplitude/(cfg.threshold*2.2)*100)+'%';
    const now=performance.now();
    if(!armed) {
      if(amplitude<cfg.threshold*.38)quietFrames++;
      else quietFrames=0;
      if(quietFrames>=10 && now-lastFire>cfg.cooldown){
        armed=true;quietFrames=0;strongFrames=0;
      }
      return;
    }
    if(now-lastFire<cfg.cooldown)return;
    if(amplitude>cfg.threshold) {
      strongFrames++;
      peak=Math.max(peak,amplitude);
      if(strongFrames>=3 && !pulseTimer) {
        pulseTimer=setTimeout(()=>{
          pulseTimer=null;
          if(!controllerConnected||controllerPhase!=='playing')return;
          const power=Math.min(cfg.cap,Math.max(.08,.08+(peak-cfg.threshold)/cfg.range));
          setText('controller-last-power',Math.round(power*100)+'%');
          sendCommand('jump',power);
          lastFire=performance.now();
          armed=false;quietFrames=0;peak=0;strongFrames=0;
        },70);
      }
    } else if(pulseTimer) {
      peak=Math.max(peak,amplitude);
    } else {
      strongFrames=0;peak=0;
    }
  }
  async function enableSensor() {
    if(typeof DeviceMotionEvent==='undefined'){
      updateControllerStatus('這個裝置不支援動作感應，請使用手動跳躍按鈕。');
      return;
    }
    try {
      if(typeof DeviceMotionEvent.requestPermission==='function'){
        const permission=await DeviceMotionEvent.requestPermission();
        if(permission!=='granted')throw Error('沒有動作感應權限');
      }
      if(!motionEnabled)window.addEventListener('devicemotion',motionFrame);
      motionEnabled=true;
      resetCalibration();
      sensorEvents=0;
      setTimeout(()=>{
        if(!sensorEvents&&controllerConnected)
          updateControllerStatus('感應器沒有回應，請檢查瀏覽器權限或改用手動跳躍。');
      },2600);
    }catch(err){
      updateControllerStatus('無法啟用動作感應：'+String(err.message||err));
    }
  }
  function initController() {
    $('controller-room-input').value=roomPattern.test(urlRoom)?urlRoom:'';
    $('controller-connect')?.addEventListener('click',connectPhone);
    $('controller-disconnect')?.addEventListener('click',()=>{
      disconnectPhone('已斷開，請輸入原配對碼或在電腦重新建立配對碼。');
    });
    $('controller-activate-sensor')?.addEventListener('click',enableSensor);
    $('controller-calibrate')?.addEventListener('click',resetCalibration);
    $('controller-start-game')?.addEventListener('click',()=>sendCommand('start',0));
    $('controller-restart')?.addEventListener('click',()=>sendCommand('start',0));
    $('controller-board-toggle')?.addEventListener('click',()=>{
      const board=$('controller-board');
      board.hidden=!board.hidden;
      refreshScores();
      if(!board.hidden)board.scrollIntoView?.({block:'nearest',behavior:'smooth'});
    });
    $('controller-board-close')?.addEventListener('click',()=>{
      $('controller-board').hidden=true;
    });
    $('controller-record-form')?.addEventListener('submit',event=>{
      event.preventDefault();
      if(!controllerConnected)return;
      const name=String($('controller-player-name')?.value||'').trim().slice(0,12)||'PINKY';
      sendCommand('submit',0,name);
      updateControllerStatus('正在把成績送到全球排行榜…');
    });
    $('controller-skip-record')?.addEventListener('click',()=>{
      sendCommand('skip',0);
      updateControllerStatus('正在略過姓名登記…');
    });
    let pressedAt=0;
    $('controller-jump')?.addEventListener('pointerdown',event=>{
      if(!controllerConnected)return;
      pressedAt=performance.now();
      event.currentTarget.setPointerCapture?.(event.pointerId);
    });
    $('controller-jump')?.addEventListener('pointerup',()=>{
      if(!controllerConnected)return;
      const ms=performance.now()-pressedAt;
      const strength=Math.max(.10,Math.min(1,ms/750));
      sendCommand('jump',strength);
      setText('controller-last-power',Math.round(strength*100)+'%');
    });
    $('controller-jump')?.addEventListener('click',event=>{
      if(event.detail===0&&controllerConnected)sendCommand('jump',.28);
    });
    window.addEventListener('offline',()=>{
      if(controllerConnected)
        disconnectPhone('網路連線中斷，請恢復網路後重新連線。');
    });
    initSharedScores();
  }

  function initGame() {
    window.pinkyArcade={
      onStart(){
        hideRecord();pendingScore=0;scoreSubmitting=false;
        hostSetPhase('playing',0);
      },
      onGameOver(score){
        const qualified=newRecord(score);
        hostSetPhase(qualified?'record':'gameover',score);
      },
      submitName:saveFromPhone,
      globalBest(){return remoteOnline?(remoteBoard[0]?.score||0):null;},
      globalConnected(){return remoteOnline;}
    };
    $('pinky-rank-btn')?.addEventListener('click',showBoard);
    $('pinky-hi-open')?.addEventListener('click',showBoard);
    $('pinky-hi-open')?.addEventListener('keydown',event=>{
      if(event.key==='Enter'||event.key===' '){event.preventDefault();showBoard();}
    });
    $('pinky-rank-close')?.addEventListener('click',()=>$('pinky-rank-dialog').close());
    $('pinky-rank-dialog')?.addEventListener('click',event=>{
      if(event.target===$('pinky-rank-dialog'))event.target.close();
    });
    $('pinky-record-form')?.addEventListener('submit',submitScore);
    $('pinky-skip-record')?.addEventListener('click',()=>{
      const final=pendingScore;
      pendingScore=0;
      hideRecord();
      $('gameover-panel')?.classList.remove('hidden');
      hostSetPhase('submitted',final);
    });
    $('pinky-pair-btn')?.addEventListener('click',()=>{
      const modal=$('pinky-pair-dialog');
      if(modal&&!modal.open)modal.showModal();
    });
    $('pinky-create-room')?.addEventListener('click',createRoom);
    $('pinky-pair-close')?.addEventListener('click',()=>$('pinky-pair-dialog').close());
    $('pinky-copy-link')?.addEventListener('click',async()=>{
      const link=$('pinky-room-link')?.value;
      if(!link)return;
      try{
        await navigator.clipboard.writeText(link);
        renderRoomStatus('✅ 已複製網址，傳到手機即可。');
      }catch(_){
        $('pinky-room-link')?.select();
        renderRoomStatus('已選取網址，請手動複製。');
      }
    });
    initSharedScores();
  }
  if(controllerPage)initController();
  else initGame();
})();
