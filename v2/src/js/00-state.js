/* ==========================================================
   מצב המשחק — הכול נשמר במכשיר, שום דבר לא עוזב אותו
   ========================================================== */
const H = (window.H = {});

H.KEY = 'hachtava_v2_profile';

H.DEFAULT_WORDS = [
  "רֹאשׁ הַשָּׁנָה",
  "שׁוֹפָר",
  "דְּבַשׁ",
  "יוֹם כִּיפּוּר",
  "תְּפִילָּה",
  "סְלִיחוֹת",
  "סֻכּוֹת",
  "סְכָךְ",
  "לוּלָב",
  "חַג שָׂמֵחַ"
];
H.BUILD = '__BUILD__';          /* חותמת בנייה: זמן ועוגן גיט. נכנסת לדיווחי בעיות */
H.DEFAULT_TOPIC = "חגי תשרי";
H.DEFAULT_PRIZE = "חטיף MARS 🍫";

H.MASTER_AT = 3;          /* כמה פעמים נכון ברצף עד שמילה נחשבת נלמדה */

/* חיות לבחירה. הראשונות פתוחות, השאר נקנות במטבעות */
H.AVATARS = [
  {id:'fox',    e:'🦊', name:'שועל',   cost:0},
  {id:'panda',  e:'🐼', name:'פנדה',   cost:0},
  {id:'frog',   e:'🐸', name:'צפרדע', cost:0},
  {id:'cat',    e:'🐱', name:'חתול',   cost:0},
  {id:'bunny',  e:'🐰', name:'ארנב',   cost:30},
  {id:'koala',  e:'🐨', name:'קואלה', cost:40},
  {id:'tiger',  e:'🐯', name:'נמר',     cost:50},
  {id:'monkey', e:'🐵', name:'קוף',     cost:50},
  {id:'lion',   e:'🦁', name:'אריה',   cost:60},
  {id:'turtle', e:'🐢', name:'צב',       cost:60},
  {id:'pengu',  e:'🐧', name:'פינגווין', cost:70},
  {id:'owl',    e:'🦉', name:'ינשוף', cost:80},
  {id:'dolphin',e:'🐬', name:'דולפין', cost:90},
  {id:'eleph',  e:'🐘', name:'פיל',     cost:90},
  {id:'octo',   e:'🐙', name:'תמנון', cost:100},
  {id:'wolf',   e:'🐺', name:'זאב',     cost:110},
  {id:'shark',  e:'🦈', name:'כריש',   cost:130},
  {id:'dragon', e:'🐉', name:'דרקון', cost:150},
  {id:'robot',  e:'🤖', name:'רובוט', cost:160},
  {id:'alien',  e:'👽', name:'חייזר', cost:180},
  {id:'uni',    e:'🦄', name:'חד־קרן', cost:200},
  {id:'wizard', e:'🧙', name:'קוסם',   cost:220},
  {id:'trex',   e:'🦖', name:'דינוזאור', cost:250}
];
H.HATS = [
  {id:'none',   e:'',   name:'בלי',        cost:0},
  {id:'flower', e:'🌸', name:'פרח',        cost:20},
  {id:'cap',    e:'🧢', name:'כובע',    cost:25},
  {id:'party',  e:'🎉', name:'מסיבה',  cost:30},
  {id:'sun',    e:'👒', name:'כובע שמש', cost:35},
  {id:'tophat', e:'🎩', name:'צילינדר', cost:40},
  {id:'crown',  e:'👑', name:'כתר',      cost:50},
  {id:'grad',   e:'🎓', name:'בוגר',      cost:60},
  {id:'shades', e:'😎', name:'משקפי שמש', cost:60},
  {id:'star',   e:'⭐',  name:'כוכב',    cost:70},
  {id:'helmet', e:'🪖', name:'קסדה',    cost:70},
  {id:'phones', e:'🎧', name:'אוזניות', cost:80},
  {id:'rocket', e:'🚀', name:'חללית', cost:120}
];
H.RINGS = [
  {id:'sun',   name:'שמש',   css:'linear-gradient(135deg,#ffd84d,#ff9f1c)', cost:0},
  {id:'mint',  name:'מנטה',  css:'linear-gradient(135deg,#7ef0c4,#2ec4b6)', cost:0},
  {id:'berry', name:'פטל',   css:'linear-gradient(135deg,#ff9ebb,#ff5d8f)', cost:35},
  {id:'sky',   name:'שמיים', css:'linear-gradient(135deg,#9bd7ff,#3a86ff)', cost:35},
  {id:'lime',  name:'ליים',   css:'linear-gradient(135deg,#d9f99d,#65a30d)', cost:40},
  {id:'plum',  name:'חציל', css:'linear-gradient(135deg,#c9a7ff,#7c5cd6)', cost:60},
  {id:'lava',  name:'לבה',   css:'linear-gradient(135deg,#ffb36b,#e11d48)', cost:70},
  {id:'ocean', name:'אוקיינוס', css:'linear-gradient(135deg,#67e8f9,#1d4ed8)', cost:80},
  {id:'gold',  name:'זהב',   css:'linear-gradient(135deg,#fff3a3,#eab308,#b45309)', cost:120},
  {id:'rain',  name:'קשת',   css:'linear-gradient(135deg,#ff8fab,#ffd84d,#7ef0c4,#9bd7ff)', cost:150}
];
/* רקע כללי של המשחק. ה-css כאן הוא התצוגה בחנות, והרקע עצמו מוגדר ב-app.css לפי data-bg */
H.BGS = [
  {id:'day',    name:'יום',       css:'linear-gradient(170deg,#7cc6f0,#bfe9f5,#a8e6c9)', cost:0},
  {id:'sunset', name:'שקיעה',   css:'linear-gradient(170deg,#ffb88c,#ffd6a5,#fde2e4)', cost:80},
  {id:'forest', name:'יער',       css:'linear-gradient(170deg,#9be7a5,#c8f2c2,#e9f7c9)', cost:80},
  {id:'candy',  name:'סוכריות', css:'linear-gradient(170deg,#ffc2e2,#d9c2ff,#c2e9ff)', cost:100},
  {id:'ocean',  name:'ים',         css:'linear-gradient(170deg,#4fc3f7,#81d4fa,#b2ebf2)', cost:100},
  {id:'night',  name:'לילה',     css:'linear-gradient(170deg,#3b3b8f,#5a5ac7,#7e8ae8)', cost:120},
  {id:'space',  name:'חלל',       css:'linear-gradient(170deg,#1a1a40,#3a2a7a,#6a3fb5)', cost:160}
];
/* חבר שמלווה את הדמות */
H.PETS = [
  {id:'none',  e:'',   name:'בלי',    cost:0},
  {id:'chick', e:'🐥', name:'אפרוח', cost:30},
  {id:'dog',   e:'🐶', name:'כלב',    cost:40},
  {id:'fish',  e:'🐠', name:'דג',      cost:40},
  {id:'bee',   e:'🐝', name:'דבורה', cost:50},
  {id:'ladyb', e:'🐞', name:'פרת משה', cost:50},
  {id:'butter',e:'🦋', name:'פרפר',   cost:60},
  {id:'bunnyp',e:'🐇', name:'ארנבון', cost:70},
  {id:'lizard',e:'🦎', name:'לטאה',   cost:80},
  {id:'ghost', e:'👻', name:'רוח רפאים', cost:100}
];

H.blank = () => ({
  name: '', onboarded: false, peekAlways: false, hideWord: false,
  level: 'a2', nikud: 'auto', tour: false,
  usage: {first: 0, last: 0, visits: 0, activeSec: 0, games: {}, hist: {}},
  avatar: 'fox', hat: 'none', ring: 'sun', bg: 'day', pet: 'none',
  owned: ['fox','panda','frog','cat','none','sun','mint'],
  xp: 0, coins: 0,
  packs: [{id:'p1', topic: H.DEFAULT_TOPIC, list: H.DEFAULT_WORDS.slice(), prize: H.DEFAULT_PRIZE}],
  pack: 'p1',
  stats: {},
  log: {},                   /* לכל יום: {sec, right, wrong} — לדוח ההורים */
  stars: {},                 /* לכל תחנה במפה: 0..3 כוכבים */
  album: [],                 /* מילים שנכבשו */
  daily: {last: '', streak: 0},
  plan: {d: '', n: 0, intro: '', pre: {}},   /* התרגול של היום */
  world: {d: '', gems: 0, chest: false},     /* האי: אבני חן ותיבה ליום */
  build: {e: '', hot: []},                   /* עולם הבנייה: שינויים שנשמרו (בסיס64) ושורת הבלוקים */
  wins: 0
});

/* בדיקה אמיתית ולא רק קיום המפתח: ב-data: URL ובגלישה פרטית
   הגישה זורקת, ואז אין טעם להבטיח לילד שההתקדמות נשמרת. */
H.storageOK = (function(){
  try{
    const k = '__t'; localStorage.setItem(k, '1');
    const ok = localStorage.getItem(k) === '1';
    localStorage.removeItem(k); return ok;
  }catch(e){ return false; }
})();

H.load = function(){
  let s = null;
  try { s = JSON.parse(localStorage.getItem(H.KEY) || 'null'); } catch(e){}
  const base = H.blank();
  H.state = s ? Object.assign(base, s) : base;
  /* גרסה ישנה החזיקה רשימה אחת בשדה words — מעבירים אותה לחבילה */
  if(H.state.words && Array.isArray(H.state.words.list) && H.state.words.list.length && !s.packs){
    H.state.packs = [{id:'p1', topic:H.state.words.topic, list:H.state.words.list, prize:H.state.words.prize}];
    H.state.pack = 'p1';
  }
  delete H.state.words;
  if(!Array.isArray(H.state.packs) || !H.state.packs.length) H.state.packs = base.packs;
  if(!H.pack()) H.state.pack = H.state.packs[0].id;
  H.state = H.cleanState(H.state);          /* מה שנקרא מהאחסון אינו מובטח */
  H.syncStats();
  H.checkDaily();
};
/* fromServer: שחזור מהשרת שומר את החותמת המקורית, אחרת הוא היה "נכתב עכשיו" */
/* שמירה מקומית בלבד, בלי חותמת זמן ובלי דחיפה לשרת. למעקב זמן שימוש, שנעשה כל    חמש שניות — אחרת המכסה של השרת הייתה נגמרת בשעה. */
H.saveQuiet = function(){ try { localStorage.setItem(H.KEY, JSON.stringify(H.state)); } catch(e){} };
H.usage = () => H.state.usage || (H.state.usage = {first:0, last:0, visits:0, activeSec:0});

H.save = function(fromServer){
  if(fromServer !== true) H.state.updatedAt = Date.now();
  try { localStorage.setItem(H.KEY, JSON.stringify(H.state)); } catch(e){}
  if(H.pushSoon) H.pushSoon();
};
/* התקדמות שמורה לפי המילה בלי ניקוד, כך שמעבר בין מצב עם ניקוד לבלי
   לא מאפס כלום. (מורה ומורה היו שתי מילים; במצב בלי ניקוד הן אחת.) */
H.sk = w => H.strip(w);
H.syncStats = function(){
  const st = H.state.stats;
  H.words().forEach(w => { const k = H.sk(w); if(!st[k]) st[k] = {ok:0, bad:0, run:0}; });
  /* בלי מחיקה. הגרסה הקודמת מחקה התקדמות של כל מילה שלא בחבילה הפעילה, כלומר
     החלפת חבילה איפסה את החזרה המרווחת של הקודמת. */
};
H.pack  = () => H.state.packs.find(p => p.id === H.state.pack);
H.words = () => (H.pack() || H.state.packs[0]).list;
H.prize = () => (H.pack() || H.state.packs[0]).prize;
H.topic = () => (H.pack() || H.state.packs[0]).topic;
H.newPackId = () => 'p' + (Date.now().toString(36));
H.addPack = function(topic, list, prize){
  const p = {id: H.newPackId(), topic: topic || '\u05d4\u05db\u05ea\u05d1\u05d4 \u05d7\u05d3\u05e9\u05d4',
             list: list || [], prize: prize || ''};
  H.state.packs.push(p); H.state.pack = p.id; H.save(); return p;
};
H.delPack = function(id){
  if(H.state.packs.length < 2) return false;
  H.state.packs = H.state.packs.filter(p => p.id !== id);
  if(!H.pack()) H.state.pack = H.state.packs[0].id;
  H.syncStats(); H.save(); return true;
};

/* ---------- רצף ימים ---------- */
/* מטבעות בונוס בקפיצות של רצף. מקבלים פעם אחת בכל רצף, ביום שמגיעים אליו */
H.STREAK_BONUS = {3: 30, 7: 70, 14: 150};
H.streakBonus = 0;                       /* נקבע ביום חדש, וההודעה מוצגת בכניסה */
H.checkDaily = function(){
  const today = new Date().toDateString();
  const d = H.state.daily;
  if(d.last === today) return false;
  const yday = new Date(Date.now() - 864e5).toDateString();
  d.streak = (d.last === yday) ? d.streak + 1 : 1;
  d.last = today;
  H.streakBonus = H.STREAK_BONUS[d.streak] || 0;
  if(H.streakBonus) H.state.coins += H.streakBonus;
  H.save();
  return true;                 /* יום חדש */
};

/* ---------- XP ורמות ---------- */
H.LEVEL_STEP = 120;
H.level  = () => Math.floor(H.state.xp / H.LEVEL_STEP) + 1;
H.inLevel = () => H.state.xp % H.LEVEL_STEP;
H.addXp = function(n){
  const before = H.level();
  H.state.xp += n;
  H.state.coins += n;
  H.save();
  const after = H.level();
  return after > before ? after : 0;    /* מחזיר את הרמה החדשה אם עלה */
};
H.spend = function(n){
  if(H.state.coins < n) return false;
  H.state.coins -= n; H.save(); return true;
};
H.owns = id => H.state.owned.includes(id);
H.buy = function(id, cost){
  if(H.owns(id)) return true;
  if(!H.spend(cost)) return false;
  H.state.owned.push(id); H.save(); return true;
};

/* ---------- התקדמות במילים ---------- */
/* חזרה מרווחת: מילה שנלמדה חוזרת אחרי כמה ימים, ובכל פעם שעונים נכון
   כשהיא "בשלה" הרווח גדל. מדבקה שכבר באלבום לא נלקחת בחזרה. */
H.IVL_DAYS = [1, 3, 7, 14, 30];
H.dueMs = s => H.IVL_DAYS[Math.min(s.lv || 0, H.IVL_DAYS.length - 1)] * 864e5;
H.isDue = function(s){
  if(!s || s.run < H.MASTER_AT) return false;
  /* שמירה ישנה בלי תאריך: מתייחסים אליה כבשלה */
  return !s.last || Date.now() - s.last >= H.dueMs(s);
};
/* סולם שלבים לכל מילה: 0 חדשה, 1 הוכרה, 2 זוהתה, 3 הורכבה, 4 נכתבה מהזיכרון.
   מילה בלי שלב שמור (התקדמות ישנה) מוסקת מהנתונים שיש. */
H.STAGE_GROUPS = {pick:'recog', memory:'recog', bubbles:'recog',
                  build:'assemble', anagram:'assemble', missing:'assemble', 'catch':'assemble',
                  proof:'assemble', flash:'assemble', tricky:'recog', search:'recog', hunt:'assemble', blocks:'assemble', write:'write', selfcheck:'write'};
H.STAGE_TARGET = {recog: 2, assemble: 3, write: 4};
H.stage = function(word){
  const s = H.state.stats[H.sk(word)];
  if(!s) return 0;
  if(typeof s.st === 'number') return s.st;
  return s.run >= H.MASTER_AT ? 4 : (s.ok > 0 ? 2 : 0);
};
H.setStage = function(word, n){
  const k = H.sk(word);
  const s = H.state.stats[k] || (H.state.stats[k] = {ok:0, bad:0, run:0});
  s.st = Math.max(0, Math.min(4, n));
};
H.hit = function(word, gameId){
  const k = H.sk(word);
  const cur = H.stage(word);
  const s = H.state.stats[k] || (H.state.stats[k] = {ok:0, bad:0, run:0});
  const target = H.STAGE_TARGET[H.STAGE_GROUPS[gameId]] || cur;
  s.st = Math.max(cur, target);               /* עולים בסולם, לא יורדים בהצלחה */
  const wasMastered = s.run >= H.MASTER_AT, wasDue = H.isDue(s);
  s.ok++; s.run++;
  /* הרווח גדל רק כשענו נכון על מילה שהגיע זמנה — לא על כל פגיעה באותו יום */
  if(wasMastered){ if(wasDue){ s.lv = (s.lv || 0) + 1; s.last = Date.now(); } }
  else { s.lv = 0; s.last = Date.now(); }
  if(s.run >= H.MASTER_AT && !H.state.album.includes(k)) H.state.album.push(k);
  H.save();
};
H.miss = function(word){
  const k = H.sk(word);
  const s = H.state.stats[k] || (H.state.stats[k] = {ok:0, bad:0, run:0});
  const cur = H.stage(word);
  s.bad++; s.run = 0; s.lv = 0; s.last = Date.now();
  if(cur >= 2) s.st = cur - 1;                /* טעות מורידה שלב אחד, לא מחזירה להתחלה */
  else s.st = cur;
  H.save();
};
/* יומן תרגול לדוח ההורים */
H.today = () => new Date().toISOString().slice(0,10);
H.logStart = function(){ H._t0 = Date.now(); };
/* בסוף כל סבב: יומן יומי לדוח ההורים, פירוט לפי משחק (כמה זמן, כמה סבבים,
   כמה נכון וכמה לא), וצילום יומי של ההתקדמות לגרף. מינימלי: זה מה שנשלח לשרת. */
H.logEnd = function(right, wrong, gameId){
  const d = H.today();
  const e = H.state.log[d] || (H.state.log[d] = {sec:0, right:0, wrong:0, rounds:0});
  let dt = 0;
  if(H._t0){ dt = Math.min(900, Math.round((Date.now() - H._t0)/1000)); e.sec += dt; H._t0 = 0; }
  e.right += right; e.wrong += wrong; e.rounds++;

  const u = H.usage();
  u.games = u.games || {}; u.hist = u.hist || {};
  if(gameId){
    const g = u.games[gameId] || (u.games[gameId] = {sec:0, rounds:0, right:0, wrong:0});
    g.sec += dt; g.rounds++; g.right += right; g.wrong += wrong;
  }
  u.hist[d] = {xp: H.state.xp, e: H.mastered()};
  const ks = Object.keys(u.hist).sort();
  if(ks.length > 120) ks.slice(0, ks.length - 120).forEach(k => delete u.hist[k]);
  H.save();
};

/* נכבשה = נענתה נכון פעם אחת לפחות MASTER_AT ברצף. טעות בחזרה מאפסת את הרצף
   הנוכחי, אבל לא לוקחת מהילד מדבקה שרכש. */
H.isEarned = w => { const k = H.sk(w); return H.state.album.includes(k) || ((H.state.stats[k]||{}).run >= H.MASTER_AT); };
H.mastered = () => H.words().filter(H.isEarned).length;

/* בחירה משוקללת — מילים חלשות חוזרות יותר */
H.pickWords = function(n){
  let pool = H.words().slice(), out = [];
  /* בלי ניקוד שתי מילים שנבדלות רק בניקוד הן אחת, ואסור שתיהן באותו סיבוב */
  if(!H.nikudOn()){ const seen = new Set(); pool = pool.filter(w => { const k = H.sk(w); if(seen.has(k)) return false; seen.add(k); return true; }); }
  const weight = w => {
    const s = H.state.stats[H.sk(w)] || {bad:0, run:0};
    return 1 + s.bad*3 + Math.max(0, H.MASTER_AT - s.run)*2
             + (H.isDue(s) ? 6 : 0);          /* הגיע הזמן לחזור עליה */
  };
  n = Math.min(n, pool.length);
  while(out.length < n && pool.length){
    let r = Math.random() * pool.reduce((a,w) => a + weight(w), 0);
    for(let i = 0; i < pool.length; i++){
      r -= weight(pool[i]);
      if(r <= 0){ out.push(pool.splice(i,1)[0]); break; }
    }
  }
  return H.nikudOn() ? out : out.map(H.strip);
};
