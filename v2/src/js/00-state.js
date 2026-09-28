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
H.DEFAULT_TOPIC = "חגי תשרי";
H.DEFAULT_PRIZE = "חטיף MARS 🍫";

H.MASTER_AT = 3;          /* כמה פעמים נכון ברצף עד שמילה נחשבת נלמדה */

/* חיות לבחירה. הראשונות פתוחות, השאר נקנות במטבעות */
H.AVATARS = [
  {id:'fox',    e:'🦊', name:'שועל',   cost:0},
  {id:'panda',  e:'🐼', name:'פנדה',   cost:0},
  {id:'frog',   e:'🐸', name:'צפרדע', cost:0},
  {id:'cat',    e:'🐱', name:'חתול',   cost:0},
  {id:'koala',  e:'🐨', name:'קואלה', cost:40},
  {id:'lion',   e:'🦁', name:'אריה',   cost:60},
  {id:'owl',    e:'🦉', name:'ינשוף', cost:80},
  {id:'octo',   e:'🐙', name:'תמנון', cost:100},
  {id:'dragon', e:'🐉', name:'דרקון', cost:150},
  {id:'uni',    e:'🦄', name:'חד־קרן', cost:200}
];
H.HATS = [
  {id:'none',   e:'',        name:'בלי',        cost:0},
  {id:'crown',  e:'👑', name:'כתר',      cost:50},
  {id:'party',  e:'🎉', name:'מסיבה',  cost:30},
  {id:'cap',    e:'🧢', name:'כובע',    cost:25},
  {id:'star',   e:'⭐',      name:'כוכב',    cost:70},
  {id:'rocket', e:'🚀', name:'חללית', cost:120}
];
H.RINGS = [
  {id:'sun',   name:'שמש',   css:'linear-gradient(135deg,#ffd84d,#ff9f1c)', cost:0},
  {id:'mint',  name:'מנטה',  css:'linear-gradient(135deg,#7ef0c4,#2ec4b6)', cost:0},
  {id:'berry', name:'פטל',   css:'linear-gradient(135deg,#ff9ebb,#ff5d8f)', cost:35},
  {id:'sky',   name:'שמיים', css:'linear-gradient(135deg,#9bd7ff,#3a86ff)', cost:35},
  {id:'plum',  name:'חציל', css:'linear-gradient(135deg,#c9a7ff,#7c5cd6)', cost:60},
  {id:'rain',  name:'קשת',   css:'linear-gradient(135deg,#ff8fab,#ffd84d,#7ef0c4,#9bd7ff)', cost:150}
];

H.blank = () => ({
  name: '',
  avatar: 'fox', hat: 'none', ring: 'sun',
  owned: ['fox','panda','frog','cat','none','sun','mint'],
  xp: 0, coins: 0,
  packs: [{id:'p1', topic: H.DEFAULT_TOPIC, list: H.DEFAULT_WORDS.slice(), prize: H.DEFAULT_PRIZE}],
  pack: 'p1',
  stats: {},
  log: {},                   /* לכל יום: {sec, right, wrong} — לדוח ההורים */
  stars: {},                 /* לכל תחנה במפה: 0..3 כוכבים */
  album: [],                 /* מילים שנכבשו */
  daily: {last: '', streak: 0},
  wins: 0
});

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
  H.syncStats();
  H.checkDaily();
};
H.save = function(){
  try { localStorage.setItem(H.KEY, JSON.stringify(H.state)); } catch(e){}
};
H.syncStats = function(){
  const st = H.state.stats;
  H.words().forEach(w => { if(!st[w]) st[w] = {ok:0, bad:0, run:0}; });
  Object.keys(st).forEach(w => { if(!H.words().includes(w)) delete st[w]; });
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
H.checkDaily = function(){
  const today = new Date().toDateString();
  const d = H.state.daily;
  if(d.last === today) return false;
  const yday = new Date(Date.now() - 864e5).toDateString();
  d.streak = (d.last === yday) ? d.streak + 1 : 1;
  d.last = today;
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
H.hit = function(word){
  const s = H.state.stats[word]; if(!s) return;
  s.ok++; s.run++;
  if(s.run >= H.MASTER_AT && !H.state.album.includes(word)) H.state.album.push(word);
  H.save();
};
H.miss = function(word){
  const s = H.state.stats[word]; if(!s) return;
  s.bad++; s.run = 0; H.save();
};
/* יומן תרגול לדוח ההורים */
H.today = () => new Date().toISOString().slice(0,10);
H.logStart = function(){ H._t0 = Date.now(); };
H.logEnd = function(right, wrong){
  const d = H.today();
  const e = H.state.log[d] || (H.state.log[d] = {sec:0, right:0, wrong:0, rounds:0});
  if(H._t0){ e.sec += Math.min(900, Math.round((Date.now() - H._t0)/1000)); H._t0 = 0; }
  e.right += right; e.wrong += wrong; e.rounds++;
  H.save();
};

H.mastered = () => H.words().filter(w => (H.state.stats[w]||{}).run >= H.MASTER_AT).length;

/* בחירה משוקללת — מילים חלשות חוזרות יותר */
H.pickWords = function(n){
  const pool = H.words().slice(), out = [];
  const weight = w => {
    const s = H.state.stats[w] || {bad:0, run:0};
    return 1 + s.bad*3 + Math.max(0, H.MASTER_AT - s.run)*2;
  };
  n = Math.min(n, pool.length);
  while(out.length < n && pool.length){
    let r = Math.random() * pool.reduce((a,w) => a + weight(w), 0);
    for(let i = 0; i < pool.length; i++){
      r -= weight(pool[i]);
      if(r <= 0){ out.push(pool.splice(i,1)[0]); break; }
    }
  }
  return out;
};
