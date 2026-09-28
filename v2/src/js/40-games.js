/* ==========================================================
   מרשם המיני־משחקים. כולם רצים על אותה רשימת מילים.
   ========================================================== */
H.GAMES = [];
H.game = function(g){ H.GAMES.push(g); return g; };
H.byId = id => H.GAMES.find(g => g.id === id);

H.ROUND = 5;              /* מילים בסיבוב */
H.run = null;             /* הסיבוב הנוכחי */

H.startRound = function(gameId, station){
  const g = H.byId(gameId);
  H.run = {
    game: g, station,
    queue: H.pickWords(H.ROUND),
    total: 0, right: 0, wrong: 0,
    word: null
  };
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
  r.right++; H.hit(r.word); H.sfx.good();
  if(xp) { H.state.xp += 0; }
};
H.wrong = function(){
  const r = H.run;
  r.wrong++; H.miss(r.word); H.sfx.bad();
};
/* כוכבים לפי דיוק: 3 = בלי טעויות */
H.stars = function(){
  const r = H.run;
  if(r.wrong === 0) return 3;
  if(r.wrong <= Math.ceil(r.total / 3)) return 2;
  return 1;
};
H.endRound = function(){
  const r = H.run, stars = H.stars();
  H.logEnd(r.right, r.wrong);
  const xp = 20 + r.right * 8 + (stars === 3 ? 25 : 0);
  const perfect = r.wrong === 0;
  H.finish({
    emoji: perfect ? '🌟' : '👍',
    title: perfect ? 'מושלם!' : 'כל הכבוד!',
    text: 'נכון ' + r.right + ' מתוך ' + r.total +
          (r.wrong ? ' · טעויות: ' + r.wrong : ''),
    stars, xp, station: r.station,
    onAgain: () => H.startRound(r.game.id, r.station)
  });
};

/* ---------- וריאציות שגויות של מילה, לבחירה מרובה ---------- */
H.variants = function(word, n){
  const out = new Set();
  const cl = H.clusters(word);
  let guard = 0;
  while(out.size < n && guard++ < 200){
    const c = cl.slice();
    const mode = Math.floor(Math.random()*4);
    const i = Math.floor(Math.random()*c.length);
    if(c[i] === ' ') continue;
    if(mode === 0){                                   /* תנועה אחרת */
      const base = c[i][0];
      const v = H.VOW[Math.floor(Math.random()*H.VOW.length)];
      c[i] = base + (c[i].includes('ּ') ? 'ּ' : '') +
             (c[i].includes('ׁ') ? 'ׁ' : '') +
             (c[i].includes('ׂ') ? 'ׂ' : '') + v;
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
