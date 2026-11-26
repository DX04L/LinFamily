// Keep this allowlist aligned with LinFamily's Firestore isSuper() rule.
const superusers = ['darren710404@gmail.com', 'darren.lin@twclc.org'];
const workflow = 'https://api.github.com/repos/DX04L/LinFamily/actions/workflows/daily_qt.yml/dispatches';
const identityLookup = 'https://identitytoolkit.googleapis.com/v1/accounts:lookup';
// Public Firebase web API key for the LinFamily project.
const firebaseKey = 'AIzaSyBPcURIjgwtEVi_nTaZT569e_nwJb4IsUs';

export async function onRequestPost({ request, env }) {
  const reply = status => new Response(null, {
    status, headers: { 'Cache-Control': 'no-store' },
  });
  const token = request.headers.get('Authorization')?.match(/^Bearer (\S+)$/i)?.[1];
  if (!token) return reply(401);
  try {
    const identity = await fetch(identityLookup + '?key=' + firebaseKey, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken: token }),
    });
    if (!identity.ok) return reply(identity.status >= 500 ? 502 : 403);
    const user = (await identity.json()).users?.[0];
    if (user?.emailVerified !== true || !superusers.includes(user.email?.toLowerCase())) return reply(403);
    if (!env.QT_WORKFLOW_TOKEN) return reply(503);

    const date = new Date(Date.now() + 8 * 3600000).toISOString().slice(0, 10);
    const result = await fetch(workflow, {
      method: 'POST',
      headers: {
        Authorization: 'Bearer ' + env.QT_WORKFLOW_TOKEN,
        Accept: 'application/vnd.github+json',
        'Content-Type': 'application/json',
        'User-Agent': 'LinFamily-Daily-QT',
      },
      body: JSON.stringify({ ref: 'main', inputs: { date, retry_if_missing: 'true' } }),
    });
    return reply(result.ok ? 202 : 502);
  } catch {
    return reply(502);
  }
}
