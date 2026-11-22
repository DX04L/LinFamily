/* Pinky Jump: leaderboard name rules (shared word list; firestore.rules carries the same list). */
(() => {
  'use strict';
  // Substring matches, checked after removing spaces/._- and undoing common digit swaps.
  const WORDS = [
    'fuck','fuk','fck','phuck','shit','bitch','biatch','cunt','pussy','asshole','bastard',
    'slut','whore','nigger','nigga','faggot','retard','porn','penis','vagina','boob','tits',
    'dildo','hitler','nazi','motherf','wtf','stfu','nmsl','wcnm','cnm','tmd','nmd','mlgb','sohai',
    '幹你','幹妳','干你','干妳','幹林','幹拎','操你','操妳','肏','靠北','靠杯','靠腰','靠么',
    '雞掰','机掰','鸡掰','雞巴','鸡巴','机巴','屌','婊','賤','贱','妓','淫','屄','傻逼','傻屄','煞筆','傻b',
    '白癡','白痴','智障','腦殘','脑残','弱智','去死','死全家','王八','混蛋','垃圾','廢物','废物',
    '他媽','他妈','你媽','你妈','媽的','妈的','尼瑪','尼玛','草泥馬','草泥马','幹恁','三小',
    '屁眼','陰莖','阴茎','陰道','阴道','色情','做愛','做爱','性交','強姦','强奸','強暴','强暴',
    '希特勒','納粹','纳粹','畜生','畜牲','人渣','狗娘','賤人','贱人','滾蛋','滚蛋'
  ];
  // Whole-name matches for short abbreviations that are fine inside longer names.
  const EXACT = ['sb','2b','kys','fu','ass','fag','sex','cum','dick','cock','rape','dicks','cocks'];
  const DEFAULTS = ['pinky'];
  const LEET = {'0':'o','1':'i','3':'e','4':'a','5':'s','@':'a','$':'s'};

  function clean(input) {
    const name = String(input || '').normalize('NFKC').trim().replace(/\s+/g, ' ').slice(0, 12);
    return {name, key: name.toLowerCase()};
  }
  function squash(key) {
    return key.replace(/[\s._\-]/g, '').replace(/[0134@$5]/g, c => LEET[c]);
  }
  // Returns '' when fine, otherwise a reason code: 'empty' | 'default' | 'chars' | 'blocked'.
  function check(input) {
    const {name, key} = clean(input);
    if (!name) return 'empty';
    if (DEFAULTS.includes(key)) return 'default';
    if (/[\/\\]/.test(name) || /^__.*__$/.test(key) || key === '.' || key === '..') return 'chars';
    const k = squash(key);
    if (EXACT.includes(k) || WORDS.some(w => k.includes(w))) return 'blocked';
    return '';
  }
  window.PinkyNameFilter = {clean, check, WORDS, EXACT};
})();
