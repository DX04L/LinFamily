/*
  /api/pinky：LF 留言板 AI 小幫手 @Pinky（Cloudflare Pages Function；Gemini 免費額度，模型滿載自動換下一個）
  需在 Cloudflare Pages（linfamily）→ 設定 → 變數和機密 加入 GEMINI_API_KEY（類型：機密）
*/
const FB_PROJECT = 'linfamily-31cb6';
const MODELS = ['gemini-3.5-flash-lite', 'gemini-3.5-flash', 'gemini-2.5-flash'];

async function handlePinky(request, env) {
  const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } });
  if (request.method !== 'POST') return json({ ok: false, error: 'method' }, 405);
  if (!env.GEMINI_API_KEY) return json({ ok: false, error: '尚未在 Cloudflare 設定 GEMINI_API_KEY' }, 500);
  let p; try { p = await request.json(); } catch (_) { return json({ ok: false, error: '格式錯誤' }, 400); }
  const token = String(p.idToken || '');
  // 用使用者自己的登入憑證讀一筆留言：讀得到 = 已登入且是留言板成員（照 Firestore 規則）
  const chk = await fetch(`https://firestore.googleapis.com/v1/projects/${FB_PROJECT}/databases/(default)/documents/lf_chat_messages?pageSize=1`, { headers: { Authorization: 'Bearer ' + token } });
  if (!chk.ok) return json({ ok: false, error: '沒有權限' }, 403);

  const hist = (Array.isArray(p.history) ? p.history : []).slice(-20).map(m => `${String(m.name || '').slice(0, 20)}：${String(m.text || '').slice(0, 400)}`).join('\n');
  const now = new Date(Date.now() + 8 * 3600e3).toISOString().slice(0, 16).replace('T', ' ');
  const sys = [
    '你是 Pinky，林家家庭群組聊天室裡的 AI 小幫手，個性親切、簡潔、有一點可愛。',
    '一律用台灣繁體中文回答（對方用英文就用英文）。回答要短，適合在手機聊天室閱讀，不用 Markdown 標題或表格，可用簡單條列。',
    '你只能在聊天室裡回覆文字，不能新增待辦、改行事曆或操作網站其他功能；被要求時就直接把內容整理好給大家（例如列出清單），並說明目前只能在聊天室幫忙。',
    '家裡有小孩也會使用，內容要適合全家。現在時間（台灣）：' + now
  ].join('\n');
  const body = JSON.stringify({
    systemInstruction: { parts: [{ text: sys }] },
    contents: [{ role: 'user', parts: [{ text: `最近的聊天紀錄：\n${hist}\n\n${String(p.name || '家人').slice(0, 20)} 剛剛對你說：${String(p.prompt || '').slice(0, 1000)}` }] }],
    generationConfig: { temperature: 0.7, maxOutputTokens: 2048 }
  });
  const errs = [];
  for (const model of MODELS) {
    try {
      const ctrl = new AbortController(), t = setTimeout(() => ctrl.abort(), 25000);
      let r; try {
        r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-goog-api-key': env.GEMINI_API_KEY }, body, signal: ctrl.signal });
      } finally { clearTimeout(t); }
      const d = await r.json();
      if (!r.ok) { errs.push(model + '：' + ((d.error && d.error.message) || r.status).toString().slice(0, 80)); continue; }
      const text = ((d.candidates && d.candidates[0] && d.candidates[0].content && d.candidates[0].content.parts) || []).map(x => x.text || '').join('').trim();
      if (text) return json({ ok: true, text: text.slice(0, 3000), model });
      errs.push(model + '：空白回應');
    } catch (e) { errs.push(model + '：' + (e && e.name === 'AbortError' ? '逾時' : '連線失敗')); }
  }
  return json({ ok: false, error: errs.join('｜') }, 502);
}

export const onRequest = ({ request, env }) => handlePinky(request, env);
