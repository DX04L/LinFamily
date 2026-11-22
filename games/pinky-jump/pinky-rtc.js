/* pinky-rtc.js — WebRTC direct link between the phone controller and the game.
 * Pairing stays on Firebase (6-character room). After pairing, the phone sends an offer and the game
 * answers through pinky_jump_rooms/{code}/rtc/{offer|answer}; then commands go phone → game directly.
 * On the same Wi-Fi (or a phone hotspot) traffic never leaves the local network.
 * If the direct link can't open (AP isolation, strict mobile network, rules not published) or drops,
 * commands automatically go through Firebase as before.
 * Status dot: green = direct (WebRTC), orange = through the internet (Firebase).
 */
(function () {
  const ICE = [{ urls: 'stun:stun.l.google.com:19302' }];
  const GATHER_MS = 2500;
  const HEARTBEAT_MS = 25000;
  let pc = null, channel = null, unsub = null, heartbeat = null, mode = null, role = null, token = 0;

  const zh = () => document.documentElement.lang !== 'en';
  function label(m) {
    if (m === 'rtc') return zh() ? '直連（WebRTC，同一個 Wi-Fi 最快）' : 'Direct link (WebRTC, fastest on the same Wi-Fi)';
    return zh() ? '透過網路連線' : 'Connected through the internet';
  }
  function dot(id, parent, before) {
    let el = document.getElementById(id);
    if (!el && parent) {
      el = document.createElement('span');
      el.id = id;
      el.className = 'pinky-link-dot';
      el.setAttribute('role', 'img');
      el.hidden = true;
      parent.insertBefore(el, before || null);
    }
    return el;
  }
  function render() {
    const host = dot('pinky-link-dot', document.getElementById('pinky-pair-btn'));
    const heading = document.querySelector('#pinky-controller .pinky-controller-heading h1');
    const phone = dot('controller-link-dot', heading);
    for (const [el, show] of [[host, role === 'host'], [phone, role === 'phone']]) {
      if (!el) continue;
      el.hidden = !(show && mode);
      el.dataset.mode = mode || '';
      if (mode) { el.title = label(mode); el.setAttribute('aria-label', label(mode)); }
    }
  }
  function setMode(next) { mode = next; render(); }
  document.addEventListener('pinky-language-change', render);

  function stop() {
    token++;
    if (unsub) { unsub(); unsub = null; }
    if (heartbeat) { clearInterval(heartbeat); heartbeat = null; }
    try { channel?.close(); } catch (_) {}
    try { pc?.close(); } catch (_) {}
    pc = channel = null;
    role = null;
    setMode(null);
  }

  function gathered(conn) {
    return new Promise(resolve => {
      if (conn.iceGatheringState === 'complete') return resolve();
      const done = () => { if (conn.iceGatheringState === 'complete') resolve(); };
      conn.addEventListener('icegatheringstatechange', done);
      setTimeout(resolve, GATHER_MS);
    });
  }
  function newPeer(my) {
    const conn = new RTCPeerConnection({ iceServers: ICE });
    conn.addEventListener('connectionstatechange', () => {
      if (my !== token) return;
      if (['failed', 'closed', 'disconnected'].includes(conn.connectionState) && mode === 'rtc') setMode('cloud');
    });
    return conn;
  }
  function useChannel(ch, my, onMessage) {
    ch.onopen = () => { if (my === token) setMode('rtc'); };
    ch.onclose = () => { if (my === token && mode === 'rtc') setMode('cloud'); };
    if (onMessage) ch.onmessage = event => {
      if (my !== token) return;
      try { onMessage(JSON.parse(event.data)); } catch (_) {}
    };
    channel = ch;
  }

  /** Game side: answer offers from the paired phone; commands arrive through onCommand. */
  function host({ fs, db, code, roomRef, onCommand }) {
    stop();
    if (!window.RTCPeerConnection) return;
    role = 'host';
    const my = token;
    let lastSdp = '';
    const offerRef = fs.doc(db, 'pinky_jump_rooms', code, 'rtc', 'offer');
    const answerRef = fs.doc(db, 'pinky_jump_rooms', code, 'rtc', 'answer');
    unsub = fs.onSnapshot(offerRef, async snap => {
      const data = snap.exists() ? snap.data() : null;
      if (my !== token || !data?.sdp || data.sdp === lastSdp) return;
      lastSdp = data.sdp;
      try { pc?.close(); } catch (_) {}
      const conn = pc = newPeer(my);
      conn.ondatachannel = event => useChannel(event.channel, my, onCommand);
      try {
        await conn.setRemoteDescription({ type: 'offer', sdp: data.sdp });
        await conn.setLocalDescription(await conn.createAnswer());
        await gathered(conn);
        if (my !== token || pc !== conn) return;
        await fs.setDoc(answerRef, { sdp: conn.localDescription.sdp, by: data.by || '', nonce: data.nonce || '', at: fs.serverTimestamp() });
      } catch (_) { /* stay on cloud */ }
    }, () => {});
    // While the direct link is up, keep the room "active" so another phone can't take it over.
    heartbeat = setInterval(() => {
      if (mode === 'rtc') fs.updateDoc(roomRef, { updatedAt: fs.serverTimestamp() }).catch(() => {});
    }, HEARTBEAT_MS);
  }
  /** Game side: a phone paired / left (Firebase "ready" / "leave"). */
  function hostPeer(connected) {
    if (role !== 'host') return;
    if (!connected) { try { pc?.close(); } catch (_) {} pc = channel = null; setMode(null); return; }
    if (mode !== 'rtc') setMode('cloud');
  }

  /** Phone side: open the direct link after the room is claimed. */
  async function phone({ fs, db, code, uid }) {
    stop();
    role = 'phone';
    setMode('cloud');
    if (!window.RTCPeerConnection) return;
    const my = token;
    const conn = pc = newPeer(my);
    useChannel(conn.createDataChannel('pinky', { ordered: true }), my, null);
    try {
      await conn.setLocalDescription(await conn.createOffer());
      await gathered(conn);
      if (my !== token) return;
      const sdp = conn.localDescription.sdp;
      const nonce = Math.random().toString(36).slice(2, 12);
      const answerRef = fs.doc(db, 'pinky_jump_rooms', code, 'rtc', 'answer');
      unsub = fs.onSnapshot(answerRef, snap => {
        const data = snap.exists() ? snap.data() : null;
        if (my !== token || !data?.sdp || data.by !== uid || data.nonce !== nonce || conn.remoteDescription) return;
        conn.setRemoteDescription({ type: 'answer', sdp: data.sdp }).catch(() => {});
      }, () => {});
      await fs.setDoc(fs.doc(db, 'pinky_jump_rooms', code, 'rtc', 'offer'), { sdp, by: uid, nonce, at: fs.serverTimestamp() });
    } catch (_) { /* stay on cloud */ }
  }
  /** Phone side: returns true when the command went over the direct link. */
  function send(payload) {
    if (role !== 'phone' || mode !== 'rtc' || channel?.readyState !== 'open') return false;
    try { channel.send(JSON.stringify(payload)); return true; } catch (_) { return false; }
  }

  window.PinkyRTC = { host, hostPeer, phone, send, stop, mode: () => mode };
})();
