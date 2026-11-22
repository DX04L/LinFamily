/* Pinky Jump: Firebase global Top 10 and complete single-page phone controller. */
(() => {
  'use strict';
  const $ = id => document.getElementById(id);
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
  let roomRef = null;
  let messageSeq = 0;
  let remoteBoard = [];      // all players, best score per name
  let motionBoard = [];      // motion-only Top 10
  let remoteOnline = false;
  let rankTab = 'motion';
  let pendingMotion = false;
  let superDb = null;        // set when an LF super user is signed in on this browser
  const SUPERS = ['darren710404@gmail.com','darren.lin@twclc.org'];
  const BOARD = 'pinky_jump_board', MOTION_BOARD = 'pinky_jump_motion_board';
  let globalError = '正在連接全球排行榜…';
  let phoneRoomUnsub = null;
  let pairedRoom = null;
  let pairedPhase = 'ready';
  let hostQueue = Promise.resolve();
  let pendingScore = 0;
  let scoreSubmitting = false;
  let lastPhonePress = null;
  let lastRemoteAt = 0;

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
        return {fs, auth, db: fs.getFirestore(app), appMod, authMod};
      })();
    }
    return cloudPromise.catch(err => { cloudPromise = null; throw err; });
  }
  function setText(id, value) { if ($(id)) PinkyLocale.set($(id), value); }
  function errorText(err) {
    const value = String((err && (err.code || err.message)) || err || '連線失敗');
    if (/permission|unauthorized|operation-not-allowed|auth\/admin-restricted-operation/.test(value))
      return 'Firebase 尚未啟用遊戲權限／匿名登入。可先試本機操作；跨裝置要先完成 Firebase 設定。';
    if (PinkyLocale.has(value)) return value;
    return PinkyLocale.message('無法連線 Firebase（{0}）。可先試本機模式。', value.slice(0,75));
  }
  function normalizeScores(rows, limit) {
    return (Array.isArray(rows) ? rows : [])
      .filter(x => x && x.key && Number.isFinite(Number(x.score)) && Number(x.score) >= 0)
      .map(x => ({name: String(x.name).slice(0,12), key: String(x.key),
        score: Math.floor(Number(x.score)), motion: x.motion === true}))
      .sort((a,b)=> b.score - a.score)
      .slice(0,limit);
  }
  function qualifies(score) {
    // Every finished run with points may be registered in the all-players board.
    return remoteOnline && Math.floor(Number(score)) > 0;
  }
  function selectRankTab(tab) {
    rankTab = tab === 'all' ? 'all' : 'motion';
    refreshScores();
  }
  function refreshScores() {
    const motionTab = rankTab === 'motion';
    const board = remoteOnline ? (motionTab ? motionBoard : remoteBoard) : [];
    const tabs=$('pinky-rank-tabs');
    if (tabs) {
      tabs.dataset.pane=rankTab;
      $('pinky-rank-motion-tab').setAttribute('aria-pressed',String(motionTab));
      $('pinky-rank-all-tab').setAttribute('aria-pressed',String(!motionTab));
    }
    const rows=$('pinky-rank-rows');
    rows.replaceChildren();
    if (remoteOnline && !board.length) {
      const li=document.createElement('li');
      li.className='pinky-empty';
      li.textContent=PinkyLocale.translate(motionTab ?
        '還沒有人上榜，成為第一位體感高手！' : '排行榜還沒有任何紀錄，歡迎成為第一位！');
      rows.appendChild(li);
    }
    board.forEach((entry,index)=>{
      const li=document.createElement('li');li.className='pinky-score-row';
      const rank=document.createElement('span');rank.textContent=String(index+1).padStart(2,'0');
      const name=document.createElement('span');name.textContent=entry.name;
      if (!motionTab && entry.motion) {
        const badge=document.createElement('em');
        badge.className='pinky-motion-badge';
        badge.textContent='🤸';
        badge.title=PinkyLocale.translate('體感紀錄');
        name.append(' ',badge);
      }
      const points=document.createElement('strong');points.textContent=String(entry.score).padStart(6,'0');
      li.append(rank,name,points);
      if (superDb) {
        const del=document.createElement('button');
        del.type='button';del.className='pinky-rank-delete';del.textContent='🗑';
        del.title=PinkyLocale.translate('刪除這筆紀錄');
        del.addEventListener('click',()=>deleteEntry(motionTab?MOTION_BOARD:BOARD,entry));
        li.append(del);
      }
      rows.appendChild(li);
    });
    setText('pinky-rank-origin',remoteOnline ?
      (motionTab ? '🤸 只限全程體感跳躍的 Top 10（即時同步）' : '🌐 所有登記的玩家，每個名字一筆最高分（🤸＝體感紀錄）') :
      PinkyLocale.message('⚠️ 全球排行榜未連線：{0}',globalError));
    const tools=$('pinky-rank-admin');
    if (tools) tools.hidden=!superDb;
    setText('hi-score',remoteOnline ? String(remoteBoard[0]?.score||0).padStart(5,'0') : '-----');
  }
  function openGameDialog(dialog) {
    if (!dialog || dialog.open) return;
    setGamePaused(true);
    dialog.showModal();
  }
  function showBoard() {
    rankTab='motion';
    refreshScores();
    const dialog=$('pinky-rank-dialog');
    openGameDialog(dialog);
  }
  function syncOverlayViewport() {
    const viewport=window.visualViewport;
    const settings=$('pinky-pair-dialog');
    if (settings.open && viewport) {
      settings.style.setProperty('--pinky-settings-top',viewport.offsetTop+'px');
      settings.style.setProperty('--pinky-settings-bottom',Math.max(0,window.innerHeight-viewport.offsetTop-viewport.height)+'px');
      settings.style.setProperty('--pinky-settings-height',viewport.height+'px');
    }
    const overlay=$('ui-overlay');
    if (!overlay.classList.contains('pinky-record-open')) return;
    const bounds=overlay.parentElement.getBoundingClientRect();
    const top=Math.max(0,(viewport?.offsetTop ?? 0)-bounds.top);
    const bottom=(viewport?.offsetTop ?? 0)+(viewport?.height ?? window.innerHeight);
    const height=Math.max(0,Math.min(bounds.bottom,bottom)-bounds.top-top);
    overlay.style.setProperty('--pinky-visible-top',top+'px');
    overlay.style.setProperty('--pinky-visible-height',height+'px');
    overlay.classList.toggle('pinky-record-compact',height<=480);
  }
  function hideRecord() {
    $('record-panel')?.classList.add('hidden');
    $('ui-overlay')?.classList.remove('pinky-record-open','pinky-record-compact');
  }
  function newRecord(score) {
    const panel=$('record-panel'),gameover=$('gameover-panel');
    if (!panel || !qualifies(score)) return false;
    pendingScore=Math.floor(score);
    setText('pinky-new-score',String(pendingScore).padStart(6,'0'));
    gameover?.classList.add('hidden');
    panel.classList.remove('hidden');
    panel.scrollTop=0;
    setText('pinky-record-message','');
    $('ui-overlay').classList.add('pinky-record-open');
    syncOverlayViewport();
    const input=$('pinky-player-name');
    input.value='';
    if (!window.matchMedia('(pointer: coarse)').matches) input.focus({preventScroll:true});
    return true;
  }
  function hostSetPhase(phase,runScore=0) {
    if(!roomRef)return;
    const ref=roomRef;
    hostQueue=hostQueue.catch(()=>{}).then(async()=>{
      const {fs}=await cloud();
      if(roomRef!==ref)return;
      await fs.updateDoc(ref,{
        phase,runScore:Math.max(0,Math.floor(Number(runScore)||0)),
        updatedAt:fs.serverTimestamp()
      });
    }).catch(err=>renderRoomStatus(errorText(err)));
  }
  function skipRecord() {
    const final=pendingScore;
    pendingScore=0;
    hideRecord();
    $('gameover-panel')?.classList.remove('hidden');
    hostSetPhase('submitted',final);
  }
  async function saveGlobalScore(nameInput) {
    const problem=PinkyNameFilter.check(nameInput);
    // Empty or default names are not registered.
    if (problem==='empty' || problem==='default') { if(pendingScore && !scoreSubmitting) skipRecord(); return false; }
    if (problem) {
      setText('pinky-record-message','這個名字不能使用，請換一個。');
      if (pendingScore) hostSetPhase('record_error',pendingScore);
      return false;
    }
    const {name,key}=PinkyNameFilter.clean(nameInput);
    const score=pendingScore, motion=pendingMotion;
    if(!score || !remoteOnline){
      renderRoomStatus('全球排行榜未連線，目前無法提交分數');
      setText('pinky-record-message','全球排行榜未連線，請稍後重試。');
      if (score) hostSetPhase('record_error',score);
      return false;
    }
    if(scoreSubmitting)return false;
    scoreSubmitting=true;
    setText('pinky-record-message','正在登記…');
    try {
      const {fs,db,auth}=await cloud();
      await writeBest(fs,db,auth.currentUser.uid,{name,key,score,motion});
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
  // One entry per name (doc id = lowercased name). Keep the best score; the
  // name's spelling follows the latest entry.
  async function writeBest(fs,db,uid,{name,key,score,motion}) {
    const refs=[fs.doc(db,BOARD,key)];
    if (motion) refs.push(fs.doc(db,MOTION_BOARD,key));
    await fs.runTransaction(db,async tx=>{
      const snaps=[];
      for (const ref of refs) snaps.push(await tx.get(ref));
      snaps.forEach((snap,i)=>{
        const old=snap.exists()?snap.data():null;
        const better=!old || score>old.score;
        tx.set(refs[i],{
          name,key,owner:uid,updatedAt:fs.serverTimestamp(),
          score:better?score:old.score,
          motion:i===1 ? true : (better?motion:old.motion===true)
        });
      });
    });
  }
  async function deleteEntry(collection,entry) {
    if (!superDb || !confirm(PinkyLocale.message('確定要刪除「{0}」這筆紀錄嗎？',entry.name))) return;
    try {
      const {fs}=await cloud();
      await fs.deleteDoc(fs.doc(superDb,collection,entry.key));
    } catch(err) { alert(errorText(err)); }
  }
  // Super user only: merge every old pinky_jump_scores entry into the new board.
  async function migrateOldScores() {
    if (!superDb) return;
    const btn=$('pinky-rank-migrate');
    btn.disabled=true;
    try {
      const {fs,auth}=await cloud();
      const mainAuth=superAuth;
      const snap=await fs.getDocs(fs.collection(superDb,'pinky_jump_scores'));
      const best=new Map();
      let skipped=0;
      const rows=snap.docs.map(d=>d.data())
        .sort((a,b)=>(a.createdAt?.toMillis?.()||0)-(b.createdAt?.toMillis?.()||0));
      for (const row of rows) {
        const score=Math.floor(Number(row.score));
        if (PinkyNameFilter.check(row.name) || !(score>0)) { skipped++; continue; }
        const {name,key}=PinkyNameFilter.clean(row.name);
        const prev=best.get(key);
        best.set(key,{name,key,score:Math.max(score,prev?.score||0),motion:false});
      }
      for (const entry of best.values())
        await writeBest(fs,superDb,mainAuth.currentUser.uid,entry);
      alert(PinkyLocale.message('已合併 {0} 個名字，略過 {1} 筆（PINKY、空白或不當名字）。',best.size,skipped));
    } catch(err) {
      alert(errorText(err));
    } finally { btn.disabled=false; }
  }
  let superAuth=null;
  async function detectSuper() {
    try {
      const {appMod,authMod,fs}=await cloud();
      const main=appMod.getApps().find(a=>a.name==='[DEFAULT]') || appMod.initializeApp(firebaseConfig);
      const mainAuth=authMod.getAuth(main);
      await mainAuth.authStateReady();
      const email=String(mainAuth.currentUser?.email||'').toLowerCase();
      if (!SUPERS.includes(email)) return;
      superAuth=mainAuth;
      superDb=fs.getFirestore(main);
      refreshScores();
    } catch(err) {}
  }
  async function submitScore(event) {
    event.preventDefault();
    const name=$('pinky-player-name')?.value;
    if(await saveGlobalScore(name)) showBoard();
  }
  async function saveFromPhone(name) {
    await saveGlobalScore(name);
  }
  function initSharedScores() {
    refreshScores();
    cloud().then(({db,fs})=>{
      if(scoreUnsub)scoreUnsub();
      const motionUnsub=fs.onSnapshot(
        fs.query(fs.collection(db,MOTION_BOARD),fs.orderBy('score','desc'),fs.limit(10)),
        snap=>{
          if(snap.metadata?.fromCache)return;
          motionBoard=normalizeScores(snap.docs.map(d=>d.data()),10);
          refreshScores();
        },
        ()=>{}
      );
      const allUnsub=fs.onSnapshot(
        fs.query(fs.collection(db,BOARD),fs.orderBy('score','desc'),fs.limit(100)),
        snap=>{
          // A cached snapshot may not reflect scores from other devices.
          if(snap.metadata?.fromCache){
            remoteOnline=false;
            globalError='正在等待 Firebase 伺服器確認全球名次';
          }else{
            remoteBoard=normalizeScores(snap.docs.map(d=>d.data()),100);
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
      scoreUnsub=()=>{motionUnsub();allUnsub();};
    }).catch(err=>{
      remoteOnline=false;
      globalError=errorText(err);
      refreshScores();
    });
  }
  function renderRoomStatus(text) { setText('pinky-pair-status',text); }
  function makeCode() {
    const bytes=new Uint8Array(6);
    crypto.getRandomValues(bytes);
    const alphabet='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    return Array.from(bytes,b=>alphabet[b%alphabet.length]).join('');
  }
  function receiveCommand(payload) {
    if (!payload || !['jump','start','ready','submit','skip','leave'].includes(payload.action))return;
    if (payload.action === 'leave') {
      renderRoomStatus('手機已離開，可用其他裝置輸入同一組配對碼。');
      return;
    }
    if (payload.action === 'ready') {
      renderRoomStatus('手機已配對，可從手機開始遊戲。');
      const settings=$('pinky-pair-dialog');
      if (settings.open) settings.close();
      if (gameState==='PLAYING') hostSetPhase('playing');
      if (gameState==='PAUSED') hostSetPhase('ready',Math.floor(score)+1);
      if (gameState==='GAMEOVER') hostSetPhase(pendingScore?'record':'gameover',Math.floor(score));
      return;
    }
    if (payload.action === 'start') {
      window.pinkyRemoteStart?.(payload.power===1);
      return;
    }
    if (payload.action === 'submit') {
      saveFromPhone(payload.playerName || 'PINKY');
      return;
    }
    if (payload.action === 'skip') {
      if(!pendingScore || scoreSubmitting)return;
      const final=pendingScore;
      pendingScore=0;
      hideRecord();
      $('gameover-panel')?.classList.remove('hidden');
      hostSetPhase('submitted',final);
      return;
    }
    const edge=/^([du])([a-z0-9]{1,11})$/.exec(payload.playerName || '');
    if (edge) {
      const input='phone:'+edge[2];
      if (edge[1]==='d') {
        lastPhonePress=input;
        window.pinkyRemoteJump?.(1,input);
      } else {
        const duration=Math.max(0,Math.min(1,Number(payload.power)||0))*500;
        window.pinkyRemoteRelease?.(input,duration,lastPhonePress!==input);
        lastPhonePress=input;
      }
      return;
    }
    const now=Date.now();
    if(now-lastRemoteAt<340)return;
    lastRemoteAt=now;
    window.pinkyRemoteJump?.(Math.max(0,Math.min(1,Number(payload.power)||0)));
  }

  async function createRoom() {
    // Unlock host audio in the local gesture before a phone starts the game.
    sfx.init();
    const btn=$('pinky-create-room');
    if(btn)btn.disabled=true;
    const code=makeCode();
    messageSeq=0;
    lastPhonePress=null;
    if(roomUnsub){roomUnsub();roomUnsub=null;}
    roomRef=null;
    setText('pinky-room-code',code);
    $('pinky-room-code').hidden=false;
    $('pinky-share-room').hidden=false;
    const link=new URL('controller.html',location.href);
    link.searchParams.set('room',code);
    const field=$('pinky-room-link');
    if(field)field.value=link.href;
    renderRoomStatus('正在建立配對…');
    const dialog=$('pinky-pair-dialog');
    openGameDialog(dialog);
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
        if(roomRef!==ref || !snap.exists())return;
        const data=snap.data();
        if(snap.metadata?.fromCache || data.seq<=messageSeq)return;
        messageSeq=data.seq;
        receiveCommand(data);
      },err=>renderRoomStatus(errorText(err)));
      renderRoomStatus('在手機輸入上方配對碼，或直接開啟連結。');
    } catch(err) {
      $('pinky-room-code').hidden=true;
      $('pinky-share-room').hidden=true;
      renderRoomStatus(errorText(err));
    } finally {if(btn)btn.disabled=false;}
  }
  function showSettingsPane(pane) {
    $('pinky-settings-tabs').dataset.pane=pane;
    for (const key of ['general','motion','pair']) {
      const active=key===pane;
      $('pinky-'+key+'-pane').hidden=!active;
      $('pinky-'+key+'-tab').setAttribute('aria-pressed',String(active));
    }
  }
  function selectSettingsPane(pane) {
    showSettingsPane(pane);
    if (pane==='motion') {
      if (!motionEnabled) enableSensor();
    } else {
      motionRequest++;
      setMotionEnabled(false);
    }
  }
  let phoneViewMode='motion', phoneCommandBusy=false;
  function renderPhoneView() {
    const labels={ready:'開始遊戲',playing:'暫停遊戲',paused:'繼續遊戲',gameover:'再玩一次',submitted:'再玩一次'};
    const record=pairedPhase==='record'||pairedPhase==='record_error';
    const primary=$('controller-primary');
    primary.hidden=record;
    PinkyLocale.set(primary,labels[pairedPhase]||labels.ready);
    $('controller-record').hidden=!record;
    $('controller-tabs').hidden=record;
    $('controller-manual').hidden=record||phoneViewMode!=='manual';
    $('controller-motion').hidden=record||phoneViewMode!=='motion';
    $('controller-jump').disabled=pairedPhase!=='playing';
    $('controller-manual-tab').disabled=phoneViewMode==='motion' && pairedPhase==='playing';
    setText('controller-status',pairedPhase==='record_error'?'登記失敗，請重新送出或略過。':'');
  }
  function updatePairedPhase(data) {
    // A ready room starts at score 0. Reserve nonzero ready scores for pause
    // so existing Firestore room rules also work with paused games.
    const phase=data.phase==='ready' && data.runScore>0 ? 'paused' : data.phase;
    const previous=pairedPhase;
    if (phase===previous) return;
    pairedPhase=phase;
    renderPhoneView();
    if (phase==='playing') document.dispatchEvent(new Event('pinky-play-start'));
    if (phase==='record' && previous!=='record_error') {
      const name=$('controller-name');
      name.value='';
      name.focus();
    }
  }
  function selectPhoneMode(mode, permission) {
    // A run started in motion mode stays in motion mode until it ends.
    if (mode==='manual' && phoneViewMode==='motion' && pairedPhase==='playing') return;
    phoneViewMode=mode;
    $('controller-tabs').dataset.pane=mode;
    for (const key of ['manual','motion'])
      $('controller-'+key+'-tab').setAttribute('aria-pressed',String(key===mode));
    renderPhoneView();
    if (mode==='motion') {
      if (!motionEnabled) enableSensor(permission);
    } else {
      motionRequest++;
      setMotionEnabled(false);
    }
  }
  // Release the room so another phone can join right away. Best effort only.
  function releaseRoom() {
    const ref=pairedRoom;
    if(!ref)return;
    cloud().then(({fs})=>fs.updateDoc(ref,{
      controller:'',action:'leave',power:0,playerName:'',
      seq:fs.increment(1),updatedAt:fs.serverTimestamp()
    })).catch(()=>{});
  }
  function disconnectPhone(message, release=false) {
    if(release)releaseRoom();
    motionRequest++;
    pairedRoom=null;
    pairedPhase='ready';
    if(phoneRoomUnsub){phoneRoomUnsub();phoneRoomUnsub=null;}
    setMotionEnabled(false);
    $('pinky-controller').hidden=true;
    $('game-wrapper').hidden=false;
    renderRoomStatus(message);
    showSettingsPane('pair');
    const settings=$('pinky-pair-dialog');
    openGameDialog(settings);
    syncOverlayViewport();
  }
  async function connectPhone(event) {
    event.preventDefault();
    const input=$('controller-room-input');
    const code=input.value.trim().toUpperCase();
    if(!roomPattern.test(code)){renderRoomStatus('請輸入有效的 6 碼配對碼。');return;}
    const button=$('controller-connect');
    if(button.disabled)return;
    button.disabled=true;
    renderRoomStatus('正在連線…');
    // Start the permission request within the submit gesture on iOS.
    const sensorPermission=requestMotionPermission();
    try {
      const {fs,db,auth}=await cloud();
      const ref=fs.doc(db,'pinky_jump_rooms',code);
      const snap=await fs.getDoc(ref);
      if(!snap.exists())throw Error('配對碼不存在，請在電腦重新建立');
      const data=snap.data();
      if(data.host===auth.currentUser.uid)throw Error('請在另一台手機或平板輸入配對碼');
      if(data.createdAt?.toMillis && Date.now()-data.createdAt.toMillis()>3600000)
        throw Error('配對碼已過期');
      const idle=data.updatedAt?.toMillis && Date.now()-data.updatedAt.toMillis()>65000;
      if(data.controller && data.controller!==auth.currentUser.uid && !idle)
        throw Error('這組配對碼已由另一台裝置使用');
      await fs.updateDoc(ref,{
        controller:auth.currentUser.uid,action:'ready',power:0,
        playerName:'',seq:fs.increment(1),updatedAt:fs.serverTimestamp()
      });
      if(phoneRoomUnsub)phoneRoomUnsub();
      pairedRoom=ref;
      $('pinky-pair-dialog').close();
      $('game-wrapper').hidden=true;
      $('pinky-controller').hidden=false;
      selectPhoneMode('motion',sensorPermission);
      updatePairedPhase(data);
      phoneRoomUnsub=fs.onSnapshot(ref,roomSnap=>{
        if(!roomSnap.exists() || roomSnap.data().controller!==auth.currentUser.uid){
          disconnectPhone('配對已中斷，請重新連線。');
          return;
        }
        updatePairedPhase(roomSnap.data());
      },err=>disconnectPhone(errorText(err)));
      renderRoomStatus('已連線');

    } catch(err) {
      renderRoomStatus(errorText(err));
    } finally {button.disabled=false;}
  }
  async function sendPhoneCommand(action, power=0, playerName='') {
    const ref=pairedRoom;
    const jumpEdge=action==='jump' && playerName!=='';
    if (!ref || (phoneCommandBusy && !jumpEdge)) return;
    if (!jumpEdge) phoneCommandBusy=true;
    try {
      const {fs,auth}=await cloud();
      if (pairedRoom!==ref) return;
      if (action==='jump' && pairedPhase!=='playing') return;
      await fs.updateDoc(ref,{
        controller:auth.currentUser.uid,action,power,playerName,
        seq:fs.increment(1),updatedAt:fs.serverTimestamp()
      });
    } catch(err) {
      if(pairedRoom===ref) setText('controller-status',errorText(err));
    } finally {
      if (!jumpEdge) phoneCommandBusy=false;
    }
  }
  function sendPairedJump(power) {
    if(pairedRoom && pairedPhase==='playing') sendPhoneCommand('jump',power);
  }
  function usePhonePrimary() {
    if (pairedPhase==='record'||pairedPhase==='record_error') return;
    // Explicit intent makes repeated start or pause requests idempotent.
    sendPhoneCommand('start',pairedPhase==='playing'?1:0);
  }
  const sensitivities={
    low:{threshold:10,cooldown:950},
    normal:{threshold:7,cooldown:750},
    high:{threshold:4.5,cooldown:600}
  };
  let motionEnabled=false,motionRequest=0;
  let baseline=null,samples=0,previousImpulse=0;
  let motionPeak=0,motionTimer;
  let lastJumpAt=-Infinity,armed=true;
  function setMotionEnabled(enabled) {
    motionEnabled=enabled;
    clearTimeout(motionTimer);
    motionTimer=undefined;
    if (!enabled) $('pinky-touch-lock').hidden=true;
    baseline=null;
    samples=0;
    previousImpulse=0;
    lastJumpAt=-Infinity;
    armed=true;
  }
  async function requestMotionPermission() {
    try {
      if(typeof DeviceMotionEvent==='undefined')return '此裝置不支援體感。';
      if(typeof DeviceMotionEvent.requestPermission==='function' &&
         await DeviceMotionEvent.requestPermission()!=='granted')
        return '需要動作感應權限。';
      return '';
    } catch(_) {
      return '無法取得動作感應權限。';
    }
  }
  async function enableSensor(permission=requestMotionPermission()) {
    const request=++motionRequest;
    const message=await permission;
    if (request!==motionRequest)return;
    setMotionEnabled(!message);
    const fallback=pairedRoom?'可切到「手機控制」跳躍。':'仍可點畫面跳躍。';
    setText(pairedRoom?'controller-motion-status':'pinky-motion-status',message?PinkyLocale.message('{0}{1}',message,fallback):'請先握穩裝置，等待體感校準。');
    if (!message) setTimeout(()=>{
      if(request===motionRequest && motionEnabled && !samples)
        setText(pairedRoom?'controller-motion-status':'pinky-motion-status','未收到感應資料，請確認瀏覽器權限。');
    },2600);
  }
  function motionFrame(event) {
    if(!motionEnabled)return;
    const a=event.accelerationIncludingGravity;
    if(!a||![a.x,a.y,a.z].every(Number.isFinite))return;
    if (!baseline) baseline={x:a.x,y:a.y,z:a.z};
    const dx=a.x-baseline.x,dy=a.y-baseline.y,dz=a.z-baseline.z;
    const length=Math.max(1,Math.hypot(baseline.x,baseline.y,baseline.z));
    const impulse=(dx*baseline.x+dy*baseline.y+dz*baseline.z)/length;
    if (samples<24 || Math.abs(impulse)<2) {
      const weight=samples<24?.12:.025;
      baseline.x+=dx*weight;baseline.y+=dy*weight;baseline.z+=dz*weight;
    }
    if (samples<24) {
      if (++samples===24)setText(pairedRoom?'controller-motion-status':'pinky-motion-status','體感跳躍已就緒。');
      return;
    }
    const cfg=sensitivities[$(pairedRoom?'controller-remote-sensitivity':'controller-sensitivity').value]||sensitivities.normal;
    const now=performance.now();
    if(!armed && Math.abs(impulse)<cfg.threshold*.35 && now-lastJumpAt>=cfg.cooldown)armed=true;
    if(motionTimer!==undefined) motionPeak=Math.max(motionPeak,impulse);
    if(armed && impulse>cfg.threshold && previousImpulse>cfg.threshold*.7 &&
       !document.hidden && !document.querySelector('dialog[open]')){
      armed=false;
      lastJumpAt=now;
      motionPeak=Math.max(impulse,previousImpulse);
      motionTimer=setTimeout(()=>{
        motionTimer=undefined;
        if (!motionEnabled || document.hidden || document.querySelector('dialog[open]')) return;
        const strength=motionPeak/cfg.threshold;
        const power=strength>=1.85?1:strength>=1.4?.45:0;
        if(pairedRoom)sendPairedJump(power);
        else window.pinkyRemoteJump(power);
      },65);
    }
    previousImpulse=impulse;
  }

  function bindSlidingTabs(settingsTabs, select) {
    const panes=Array.from(settingsTabs.querySelectorAll('button'),tab=>tab.dataset.pane);
    let tabSwipe=null, suppressTabClick=false;
    settingsTabs.addEventListener('pointerdown',event=>{
      suppressTabClick=false;
      if(event.isPrimary && event.button===0)
        tabSwipe={id:event.pointerId,x:event.clientX,y:event.clientY};
    });
    settingsTabs.addEventListener('pointercancel',()=>{tabSwipe=null;});
    settingsTabs.addEventListener('pointerup',event=>{
      if(tabSwipe?.id!==event.pointerId)return;
      const dx=event.clientX-tabSwipe.x, dy=event.clientY-tabSwipe.y;
      tabSwipe=null;
      if(Math.abs(dx)<30 || Math.abs(dx)<Math.abs(dy)*1.5)return;
      suppressTabClick=true;
      const current=panes.indexOf(settingsTabs.dataset.pane);
      const next=Math.max(0,Math.min(panes.length-1,current+(dx<0?1:-1)));
      if (next!==current) select(panes[next]);
    });
    settingsTabs.addEventListener('click',event=>{
      if(suppressTabClick && event.detail>0)return;
      const tab=event.target.closest('button');
      if(tab)select(tab.dataset.pane);
    });
  }
  function initGame() {
    window.pinkyArcade={
      onStart(){
        hideRecord();pendingScore=0;scoreSubmitting=false;
        hostSetPhase('playing',0);
      },
      onGameOver(score,motion){
        pendingMotion=motion===true;
        const qualified=newRecord(score);
        hostSetPhase(qualified?'record':'gameover',score);
      },
      onPause(paused,points){hostSetPhase(paused?'ready':'playing',paused?points+1:0);},
      isController:()=>Boolean(pairedRoom),
      isMotionEnabled:()=>motionEnabled,
      isPairedPlaying:()=>Boolean(pairedRoom && pairedPhase==='playing'),
      globalBest(){return remoteOnline?(remoteBoard[0]?.score||0):null;},
      globalConnected(){return remoteOnline;}
    };
    $('pinky-rank-btn')?.addEventListener('click',showBoard);
    bindSlidingTabs($('pinky-rank-tabs'),selectRankTab);
    $('pinky-rank-migrate')?.addEventListener('click',migrateOldScores);
    detectSuper();
    $('pinky-hi-open')?.addEventListener('click',showBoard);
    $('pinky-hi-open')?.addEventListener('keydown',event=>{
      if(event.key==='Enter'||event.key===' '){event.preventDefault();showBoard();}
    });
    $('pinky-rank-close')?.addEventListener('click',()=>$('pinky-rank-dialog').close());
    $('pinky-rank-dialog')?.addEventListener('click',event=>{
      if(event.target===$('pinky-rank-dialog'))event.target.close();
    });
    const recordForm=$('pinky-record-form');
    const recordInput=$('pinky-player-name');
    const confirmRecord=$('pinky-confirm-record');
    const skipRecord=$('pinky-skip-record');
    let composingName=false;
    recordInput.addEventListener('compositionstart',()=>{composingName=true;});
    recordInput.addEventListener('compositionend',()=>{composingName=false;});
    recordForm.addEventListener('submit',event=>{
      if (composingName) {
        event.preventDefault();
        return;
      }
      submitScore(event);
    });
    recordForm.addEventListener('keydown',event=>{
      if (event.isComposing || composingName || event.keyCode===229 ||
          event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
      const {key,target}=event;
      let next;
      if (key==='ArrowDown' && (target===recordInput || target===confirmRecord)) next=skipRecord;
      if (key==='ArrowUp' && target===skipRecord) next=confirmRecord;
      if (key==='ArrowLeft' && target===confirmRecord) next=recordInput;
      if (key==='ArrowRight' && target===skipRecord) next=confirmRecord;
      if (key==='ArrowLeft' && target===skipRecord) next=recordInput;
      if (!next) return;
      event.preventDefault();
      next.focus();
    });
    window.addEventListener('resize',syncOverlayViewport);
    window.visualViewport?.addEventListener('resize',syncOverlayViewport);
    window.visualViewport?.addEventListener('scroll',syncOverlayViewport);
    skipRecord.addEventListener('click',()=>{
      if (scoreSubmitting) return;
      const final=pendingScore;
      pendingScore=0;
      hideRecord();
      $('gameover-panel')?.classList.remove('hidden');
      hostSetPhase('submitted',final);
    });
    const settings=$('pinky-pair-dialog');
    $('pinky-pair-btn').addEventListener('click',()=>{
      openGameDialog(settings);
      syncOverlayViewport();
    });
    bindSlidingTabs($('pinky-settings-tabs'),selectSettingsPane);
    bindSlidingTabs($('controller-tabs'),selectPhoneMode);
    $('controller-primary').addEventListener('click',usePhonePrimary);
    const phoneJump=$('controller-jump');
    let jumpPress=null, jumpSequence=0;
    const pressPrefix=Date.now().toString(36);
    phoneJump.addEventListener('pointerdown',event=>{
      if (!event.isPrimary || event.button!==0 || phoneJump.disabled || jumpPress) return;
      const token=pressPrefix+(++jumpSequence).toString(36);
      jumpPress={id:event.pointerId,token,started:performance.now()};
      phoneJump.setPointerCapture(event.pointerId);
      sendPhoneCommand('jump',1,'d'+token);
    });
    function endPhoneJump(event) {
      if(jumpPress?.id!==event.pointerId)return;
      const {token,started}=jumpPress;
      jumpPress=null;
      const duration=Math.min(500,performance.now()-started);
      sendPhoneCommand('jump',duration/500,'u'+token);
    }
    for (const type of ['pointerup','pointercancel','lostpointercapture'])
      phoneJump.addEventListener(type,endPhoneJump);
    phoneJump.addEventListener('click',event=>{
      // Keyboard activation: send as a button press so it never counts as motion.
      if(event.detail===0 && pairedPhase==='playing')
        sendPhoneCommand('jump',0,'u'+pressPrefix+'k'+(++jumpSequence).toString(36));
    });
    $('controller-record').addEventListener('submit',event=>{
      event.preventDefault();
      sendPhoneCommand('submit',0,$('controller-name').value.trim().slice(0,12));
    });
    $('controller-skip').addEventListener('click',()=>sendPhoneCommand('skip'));
    settings.addEventListener('click',event=>{
      if (event.target===settings) settings.close();
    });
    $('pinky-connect-form').addEventListener('submit',connectPhone);
    $('controller-disconnect').addEventListener('click',()=>disconnectPhone('已中斷配對。',true));
    window.addEventListener('pagehide',releaseRoom);
    const showHelp=visible=>{
      $('pinky-settings-view').hidden=visible;
      $('pinky-help-view').hidden=!visible;
      settings.setAttribute('aria-labelledby',visible?'pinky-help-title':'pinky-pair-title');
      settings.scrollTop=0;
    };
    $('pinky-help-open').addEventListener('click',()=>{
      showHelp(true);
      $('pinky-help-back').focus({preventScroll:true});
    });
    $('pinky-help-back').addEventListener('click',()=>{
      showHelp(false);
      $('pinky-help-open').focus();
    });
    settings.addEventListener('close',()=>showHelp(false));
    window.addEventListener('devicemotion',motionFrame);
    window.addEventListener('offline',()=>{
      if(pairedRoom)disconnectPhone('網路已中斷，請重新配對。');
    });
    if(roomPattern.test(urlRoom)){
      $('controller-room-input').value=urlRoom;
      showSettingsPane('pair');
      openGameDialog(settings);
      syncOverlayViewport();
    }
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
    document.addEventListener('pinky-language-change',refreshScores);
    initSharedScores();
  }
  initGame();
})();
