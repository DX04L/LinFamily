/*
  /api/tts：國語學習站朗讀用（Cloudflare Pages Function）
  由伺服器向 Google 取中文（台灣）語音再轉給瀏覽器，避免手機沒有中文語音或瀏覽器擋外站。
  用法：GET /api/tts?q=文字&slow=1
*/
export async function onRequestGet({ request }) {
  const u = new URL(request.url);
  const q = (u.searchParams.get('q') || '').trim().slice(0, 180);
  if (!q) return new Response('missing q', { status: 400 });
  const slow = u.searchParams.get('slow') === '1';
  const src = 'https://translate.google.com/translate_tts?ie=UTF-8&tl=zh-TW&client=tw-ob&total=1&idx=0'
    + `&textlen=${q.length}&ttsspeed=${slow ? '0.3' : '1'}&q=${encodeURIComponent(q)}`;
  const r = await fetch(src, { headers: { 'User-Agent': 'Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Mobile Safari/537.36', 'Referer': 'https://translate.google.com/' }, cf: { cacheTtl: 86400, cacheEverything: true } });
  if (!r.ok) return new Response('tts upstream ' + r.status, { status: 502 });
  return new Response(r.body, { headers: { 'content-type': 'audio/mpeg', 'cache-control': 'public, max-age=604800' } });
}
