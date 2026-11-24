/* Pinky Jump characters: the roster plus a natural idle motion for ears and eyes.
   Idle motion plays ONE action at a time, at random intervals (Darren: two at once looks busy). */
const PinkyCharacters = [
  {id:'pinky', name:'Pinky', color:'#bc317a',
    zh:'粉紅魔法貓，額頭有藍寶石，最愛在棉花雲上奔跑。'},
  {id:'blues', name:'Bluezi', color:'#1f45a8',
    zh:'戴竹蜻蜓帽的藍兔子，肚子上有最愛的紅蘿蔔。'} // English text lives in locale.js
];

const PinkyIdle = (() => {
  // Weighted actions; each returns ear/eye offsets for progress p (0→1).
  const actions = [
    {kind:'blink', weight:30, dur:[8,11]},
    {kind:'doubleBlink', weight:10, dur:[20,24]},
    {kind:'earL', weight:13, dur:[22,30]},
    {kind:'earR', weight:13, dur:[22,30]},
    {kind:'ears', weight:14, dur:[26,34]},
    {kind:'look', weight:20, dur:[70,110]},
    // Character-only actions.
    {kind:'prop', weight:12, dur:[55,75], only:'blues'},  // propeller spins up and slows down
    {kind:'shine', weight:12, dur:[38,50], only:'pinky'}  // light sweeps across the forehead chain
  ];
  const rand = (a,b) => a + Math.random()*(b-a);

  function create() {
    return {kind:null, t:0, dur:0, wait:rand(40,140), side:1, last:0,
      out:{earL:0, earR:0, blink:0, lookX:0, prop:0, shine:-1}};
  }
  function pick(s, id) {
    const pool = actions.filter(a => !a.only || a.only === id);
    let roll = Math.random() * pool.reduce((sum,a)=>sum+a.weight,0);
    const action = pool.find(a => (roll -= a.weight) < 0) || pool[0];
    s.kind = action.kind;
    s.t = 0;
    s.dur = rand(action.dur[0], action.dur[1]);
    s.side = Math.random() < .5 ? -1 : 1;
  }
  // Damped wiggle: a quick flick that settles, like a real ear.
  const flick = p => Math.sin(p*Math.PI*3) * (1-p) * .32;
  // Advance by real time so it looks the same at 60/120/144Hz; call once per painted frame.
  function tick(s, id, now = performance.now()) {
    const frames = s.last ? Math.min(4, (now - s.last) / 16.67) : 1;
    s.last = now;
    const o = s.out;
    o.earL = o.earR = o.blink = o.prop = 0;
    o.shine = -1;
    let lookTarget = 0;
    if (!s.kind) {
      s.wait -= frames;
      if (s.wait <= 0) pick(s, id);
    }
    if (s.kind) {
      s.t += frames;
      const p = Math.min(1, s.t / s.dur);
      switch (s.kind) {
        case 'blink': o.blink = Math.sin(p*Math.PI); break;
        case 'doubleBlink': o.blink = Math.abs(Math.sin(p*Math.PI*2)); break;
        case 'earL': o.earL = flick(p); break;
        case 'earR': o.earR = flick(p); break;
        case 'ears': o.earL = o.earR = Math.sin(p*Math.PI) * .2; break;
        case 'look': lookTarget = s.side * Math.min(1, Math.sin(p*Math.PI) * 1.8); break;
        // Ease in/out spin: about 7 turns, fast in the middle.
        case 'prop': o.prop = (p - Math.sin(p*Math.PI*2)/(Math.PI*2)) * Math.PI * 14; break;
        case 'shine': o.shine = p; break;
      }
      if (p >= 1) { s.kind = null; s.wait = rand(80, 300); }
    }
    o.lookX += (lookTarget - o.lookX) * Math.min(1, .25 * frames);
    return o;
  }
  return {create, tick};
})();
