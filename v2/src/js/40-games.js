/* ==========================================================
   מרשם המיני־משחקים. כולם רצים על אותה רשימת מילים.
   ========================================================== */
H.GAMES = [];
H.game = function(g){ H.GAMES.push(g); return g; };
H.byId = id => H.GAMES.find(g => g.id === id);

H.ROUND = 5;              /* מילים בסיבוב */
H.run = null;             /* הסיבוב הנוכחי */

/* סבב בלי מילים נגמר מיד עם "0 מתוך 0" ושלושה כוכבים. לכן לא מתחילים אותו. */
H.hasWords = () => H.words().some(w => String(w).trim());
/* אין מילים בנושא הנוכחי: עוברים לנושא אחר שיש בו מילים. רק אם אין בכלל, מציעים נושא מהמאגר.
   (פעם זה שלח את הילד למסך ההורים, וזה לא המקום שלו.) */
H.needWords = function(){
  if(H.hasWords()) return false;
  const other = H.state.packs.find(p => p.list.some(w => String(w).trim()));
  if(other){
    H.state.pack = other.id; H.syncStats(); H.save(); H.refresh();
    H.toast('עברנו לנושא: ' + (other.topic || 'הכתבה'));
    return false;
  }
  H.toast('אין מילים עדיין. בחר נושא מהמאגר');
  H.openLibrary();
  return true;
};
H.startRound = function(gameId, station, words, extra){
  const g = H.byId(gameId);
  if(!g.letters && !(words && words.length) && H.needWords()) return;
  /* מאיפה באנו, כדי שכפתור החזרה יחזיר לרשימת המשחקים או למפה ולא תמיד לבית */
  const origin = (extra && extra.origin) || (['play', 'map', 'plan'].includes(H.screen) ? H.screen : 'home');
  H.run = Object.assign({
    game: g, station, origin,
    queue: words ? words.slice() : H.pickWords(H.roundSize()),
    total: 0, right: 0, wrong: 0,
    word: null
  }, extra || {});
  H.run.total = H.run.queue.length;
  H.logStart();
  g.start();
};
H.nextWord = function(){
  const r = H.run;
  if(!r.queue.length) return null;
  r.word = r.queue.shift();
  return r.word;
};
H.right = function(xp){
  const r = H.run;
  r.right++;
  if(r.pretest) H.setStage(r.word, 2);        /* בוחן פתיחה: מילה שהוכרה מדלגת, בלי לספור כרצף */
  else H.hit(r.word, r.game && r.game.id);
  H.sfx.good();
  H.limEarn(30);
  if(xp) { H.state.xp += 0; }
};
H.wrong = function(){
  const r = H.run;
  r.wrong++;
  if(!r.pretest) H.miss(r.word);
  H.sfx.bad();
};
/* כוכבים לפי דיוק: 3 = בלי טעויות */
H.stars = function(){
  const r = H.run;
  if(r.wrong === 0) return 3;
  if(r.wrong <= Math.ceil(r.total / 3)) return 2;
  return 1;
};
H.endRound = function(){
  const r = H.run;
  /* משחק שדילג על כל המילים (למשל "האות הקשה" ברשימה בלי אותיות כאלה) לא נותן כוכבים */
  if(r.right + r.wrong === 0){ H.toast('לא היה מה לתרגל כאן עם המילים האלה'); return H.home(); }
  const stars = H.stars();
  if(stars === 3 && !(r.game && r.game.letters)) H.limEarn(120);
  if(r.earn) H.toast('⏱️ הרווחת ' + H.limMin(r.earn) + ' זמן משחק', 'good');
  H.logEnd(r.right, r.wrong, r.game && r.game.id);
  if(r.plan) return H.planRoundDone();
  if(r.challenge) return H.finishChallenge();
  const xp = 20 + r.right * 8 + (stars === 3 ? 25 : 0);
  const perfect = r.wrong === 0;
  H.finish({
    emoji: perfect ? '🌟' : '👍',
    title: perfect ? 'מושלם!' : 'כל הכבוד!',
    text: 'נכון ' + r.right + ' מתוך ' + r.total +
          (r.wrong ? ' · טעויות: ' + r.wrong : ''),
    stars, xp, station: r.station,
    onAgain: () => H.startRound(r.game.id, r.station, undefined, {origin: r.origin})
  });
};

/* ---------- וריאציות שגויות של מילה, לבחירה מרובה ---------- */
/* אותיות שנשמעות אותו דבר. מחקרי איות בעברית מראים שרוב הטעויות מרוכזות
   בזוגות כאלה (ת/ט, כ/ק, א/ע, ו/ב, ס/שׂ), ולכן הן הכתיב השגוי הכי
   שימושי לתרגל מולו — הרבה יותר מאות חסרה או אותיות הפוכות. */
H.HOMO = {'ת':'ט','ט':'ת','כ':'ק','ק':'כ','א':'ע','ע':'א',
          'ו':'ב','ב':'ו','ס':'שׂ','שׂ':'ס'};
/* מחליף אשכול אחד בחבר ההומופוני שלו, ושומר על התנועה. null אם אין לו חבר. */
H.homophone = function(cl){
  const o = H.parseCluster(cl);
  let key = o.base;
  if(o.base === 'ש' && o.sin) key = 'שׂ';          /* שׂ */
  /* ההחלפה נכונה רק כשהאות באמת נשמעת כמו חברה:
     ו עם חולם או דגש היא אות תנועה ולא עיצור; ב עם דגש היא b ולא v;
     כ בלי דגש נשמעת כמו ח, לא כמו ק. */
  if(o.base === 'ו' && (o.vowel === '\u05b9' || o.dagesh)) return null;
  if(o.base === 'ב' && o.dagesh) return null;
  if(o.base === 'כ' && !o.dagesh) return null;
  const to = H.HOMO[key];
  if(!to) return null;
  if(to === 'ס'){ o.base = 'ס'; o.sin = false; o.shin = false; }
  else if(to === 'שׂ'){ o.base = 'ש'; o.sin = true; o.shin = false; }
  else o.base = to;
  /* דגש קל שייך רק לבג"ד כפ"ת. אחרי ההחלפה הוא לא יושב על אות אחרת. */
  if(o.dagesh && 'בגדכפת'.indexOf(o.base) < 0) o.dagesh = false;
  if(to === 'כ') o.dagesh = true;           /* ק נשמעת כמו כּ, לא כמו כ */
  return H.buildCluster(o);
};

H.variants = function(word, n){
  const out = new Set();
  const cl = H.clusters(word);
  /* אילו מקומות במילה אפשר להחליף בהומופון */
  const homo = [];
  cl.forEach((c, i) => { if(c !== ' ' && H.homophone(c)) homo.push(i); });
  let guard = 0;
  while(out.size < n && guard++ < 200){
    const c = cl.slice();
    let mode = Math.floor(Math.random()*4);
    /* כשיש במילה אות עם חבר הומופוני, זו הטעות המועדפת */
    if(homo.length && Math.random() < H.grade().homo) mode = 4;
    const i = (mode === 4) ? homo[Math.floor(Math.random()*homo.length)] : Math.floor(Math.random()*c.length);
    if(c[i] === ' ') continue;
    if(mode === 4){                                   /* אות דומה בצליל */
      c[i] = H.homophone(c[i]);
    } else if(mode === 0){                            /* תנועה אחרת */
      const o = H.parseCluster(c[i]);
      o.vowel = H.VOW[Math.floor(Math.random()*H.VOW.length)];
      c[i] = H.buildCluster(o);
    } else if(mode === 1){                            /* אות חסרה */
      if(c.length < 4) continue;
      c.splice(i, 1);
    } else if(mode === 2){                            /* אותיות מוחלפות */
      const j = i + 1;
      if(j >= c.length || c[j] === ' ') continue;
      [c[i], c[j]] = [c[j], c[i]];
    } else {                                          /* אות כפולה */
      c.splice(i, 0, c[i]);
    }
    const s = c.join('');
    if(s !== word) out.add(s);
  }
  return [...out].slice(0, n);
};
