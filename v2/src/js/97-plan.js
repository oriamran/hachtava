/* ==========================================================
   התרגול של היום: מסלול קצר, מובנה, עם בחירה בתוכו.

   מבוסס על מה שנמצא בסקירת המחקר:
   - הוראה מפורשת: כל מילה חדשה נפתחת בכרטיס הצגה (EEF, Shanahan).
   - בוחן פתיחה לפני הלימוד (Graham/Gentry): מילה שהילד כבר מזהה מדלגת.
   - שליפה וחזרה מרווחת: מילים שנלמדו חוזרות ונכתבות מהזיכרון.
   - מבנה לצד בחירה: המסלול נקבע, והילד בוחן משחק בתוך השלב.
   - סיום ברור: שלושה סבבים וזהו.

   סולם השלבים (H.stage): 0 חדשה, 1 הוכרה, 2 זוהתה, 3 הורכבה, 4 נכתבה.
   ========================================================== */
H.PLAN_STEPS = 3;
H.PLAN_GROUPS = {recog:['pick','memory','bubbles','tricky','search'], assemble:['build','missing','anagram','proof','flash'], write:['write','parent']};
H.GROUP_TITLE = {recog:'מכירים את המילים', assemble:'מרכיבים את המילים', write:'כותבים מהזיכרון', review:'חוזרים על מה שלמדנו'};
H.PLAN_PREFS = [
  ['recog', 'assemble', 'write', 'review'],
  ['assemble', 'recog', 'write', 'review'],
  ['write', 'assemble', 'recog', 'review']
];
H.disp = w => H.nikudOn() ? w : H.strip(w);

H.plan = function(){
  const p = H.state.plan;
  if(p.d !== H.today()){ p.d = H.today(); p.n = 0; }   /* יום חדש, תוכנית חדשה */
  return p;
};

/* חלוקת מילות החבילה לפי שלב. מילה שנכבשה ונכשלה בחזרה יורדת שלב ולכן חוזרת. */
H.planBuckets = function(){
  const b = {nw:[], recog:[], assemble:[], write:[], review:[]}, seen = new Set();
  H.words().forEach(w => {
    const k = H.sk(w);
    if(seen.has(k)) return; seen.add(k);                /* שתי גרסאות ניקוד הן מילה אחת */
    const s = H.state.stats[k] || {bad:0, run:0}, st = H.stage(w);
    if(st >= 4 && s.run >= H.MASTER_AT){ if(H.isDue(s)) b.review.push(w); return; }
    if(st === 0) b.nw.push(w);
    else if(st === 1) b.recog.push(w);
    else if(st === 2) b.assemble.push(w);
    else b.write.push(w);
  });
  /* אלה שטעו בהן יותר קודם */
  const bad = w => (H.state.stats[H.sk(w)] || {bad:0}).bad;
  Object.keys(b).forEach(g => b[g].sort((x, y) => bad(y) - bad(x)));
  return b;
};

/* השלב הבא לפי המשבצת (0, 1, 2). מחושב ברגע האחרון, אחרי שהשלבים התעדכנו. */
H.planStep = function(slot, b){
  b = b || H.planBuckets();
  const R = H.roundSize();
  for(const g of H.PLAN_PREFS[slot]){
    let ws = b[g] || [];
    if(g === 'write') ws = ws.concat(b.review);          /* חזרה מרווחת יושבת בשלב הכתיבה */
    if(!ws.length) continue;
    const grp = g === 'review' ? 'write' : g;
    const words = ws.slice(0, R).map(H.disp);
    /* משחק שאין לו מה לעשות עם המילים האלה (למשל אות קשה) לא מוצע */
    const options = H.PLAN_GROUPS[grp].filter(id => { const gm = H.byId(id); return gm && (!gm.canPlay || gm.canPlay(words)); });
    return {group: g, words, options};
  }
  return null;
};

H.planNeed = function(){
  const p = H.plan(), b = H.planBuckets();
  const total = H.words().length;
  if(!p.pre[H.state.pack] && b.nw.length >= 4 && b.nw.length === new Set(H.words().map(H.sk)).size)
    return {kind:'pretest', words: b.nw.slice(0, 8).map(H.disp), b};
  const step = H.planStep(Math.min(p.n, 2), b);
  if(b.nw.length && (p.intro !== H.today() || !step))
    return {kind:'intro', words: b.nw.slice(0, 4).map(H.disp), b};
  if(!step) return {kind:'empty', b};
  return {kind:'step', step, b};
};

/* ---------- מסך התוכנית ---------- */
H.openPlan = function(){
  H.renderPlan(); H.show('plan');
};
H.planChoice = null;
H.renderPlan = function(){
  const p = H.plan(), box = H.$('planbody'), N = H.PLAN_STEPS;
  H.$('plandots').innerHTML = Array.from({length:N}, (_, i) => '<i class="' + (i < p.n ? 'done' : (i === p.n ? 'on' : '')) + '"></i>').join('');
  box.innerHTML = '';
  if(p.n >= N){
    box.innerHTML = '<div class="plancard"><div class="plan-e">🌙</div><h2>סיימת להיום</h2><p>זה מספיק לעכשיו. נתראה מחר!</p></div>';
    return;
  }
  const need = H.planNeed();
  const card = H.el('div', 'plancard');
  if(need.kind === 'empty'){
    card.innerHTML = '<div class="plan-e">🏆</div><h2>אין מה לתרגל כרגע</h2><p>כל המילים נכבשו. אפשר להוסיף רשימה חדשה, או לשחק חופשי.</p>';
    const b1 = H.el('button', 'go', '➕ רשימה חדשה'); b1.onclick = () => H.openSettings();
    card.appendChild(b1);
  } else if(need.kind === 'pretest'){
    card.innerHTML = '<div class="plan-e">🔎</div><h2>בוחן פתיחה</h2><p>רשימה חדשה! נבדוק אילו מילים אתה כבר מכיר, ונתרגל רק את השאר. אין ציון.</p>' +
      '<div class="planwords">' + need.words.map(w => '<span>' + H.esc(w) + '</span>').join('') + '</div>';
    const go = H.el('button', 'go', 'בוא נתחיל 🚀'); go.onclick = () => H.startPretest(need.words);
    const sk = H.el('button', 'mini', 'דלג'); sk.onclick = () => { H.state.plan.pre[H.state.pack] = true; H.save(); H.renderPlan(); };
    card.appendChild(go); card.appendChild(sk);
  } else if(need.kind === 'intro'){
    card.innerHTML = '<div class="plan-e">🌱</div><h2>' + need.words.length + ' מילים חדשות</h2><p>נכיר אותן לפני שמשחקים: רואים, שומעים, ושמים לב לחלק הקשה.</p>' +
      '<div class="planwords">' + need.words.map(w => '<span>' + H.esc(w) + '</span>').join('') + '</div>';
    const go = H.el('button', 'go', 'להכיר ➜'); go.onclick = () => H.startIntro(need.words);
    card.appendChild(go);
  } else {
    const st = need.step, ch = (H.planChoice && st.options.includes(H.planChoice)) ? H.planChoice : st.options[0];
    H.planChoice = ch;
    card.innerHTML = '<div class="plan-e">' + H.byId(ch).e + '</div><h2>' + H.GROUP_TITLE[st.group] + '</h2>' +
      '<p>' + st.words.length + ' מילים · שלב ' + (p.n + 1) + ' מתוך ' + H.PLAN_STEPS + '</p>';
    if(st.options.length > 1){
      const row = H.el('div', 'planchips');
      st.options.forEach(id => {
        const g = H.byId(id), b = H.el('button', 'lvchip' + (id === ch ? ' on' : ''), g.e + ' ' + g.name);
        b.onclick = () => { H.sfx.tap(); H.planChoice = id; H.renderPlan(); };
        row.appendChild(b);
      });
      card.appendChild(H.el('p', 'note', 'בחר משחק:')); card.appendChild(row);
    }
    const go = H.el('button', 'go', 'התחל ▶'); go.onclick = () => { H.sfx.tap(); H.startPlanStep(ch, st.words); };
    card.appendChild(go);
  }
  box.appendChild(card);
};
H.startPlanStep = function(gameId, words){
  H.planChoice = null;
  H.startRound(gameId, undefined, words, {plan:true});
};
H.startPretest = function(words){
  H.startRound('pick', undefined, words, {plan:true, pretest:true});
};

/* ---------- כרטיס הצגה ---------- */
H.introState = {words:[], i:0};
H.startIntro = function(words){
  H.introState = {words: words.slice(), i: 0};
  H.renderIntro(); H.show('intro');
};
H.renderIntro = function(){
  const s = H.introState, w = s.words[s.i];
  H.$('intro-n').textContent = (s.i + 1) + ' / ' + s.words.length;
  H.$('intro-w').textContent = w;
  const hint = H.trickyHint(w);
  H.$('intro-hint').innerHTML = hint || 'שמע את המילה ועבור עליה באצבע';
  H.$('intro-next').textContent = s.i === s.words.length - 1 ? 'סיימתי להכיר ✓' : 'הבא ➜';
  setTimeout(() => H.say(w), 250);
};
H.introSay = () => H.say(H.introState.words[H.introState.i]);
H.introNext = function(){
  const s = H.introState;
  H.sfx.tap();
  if(H.stage(s.words[s.i]) < 1) H.setStage(s.words[s.i], 1);
  if(s.i < s.words.length - 1){ s.i++; H.renderIntro(); return; }
  H.state.plan.intro = H.today(); H.save();
  H.openPlan();
};

/* ---------- סוף סבב בתוכנית ---------- */
H.planRoundDone = function(){
  const r = H.run, p = H.plan();
  if(r.pretest){
    p.pre[H.state.pack] = true; H.save();
    H.finish({emoji:'🔎', title:'בוחן הפתיחה הסתיים',
      text: r.right ? 'כבר הכרת ' + r.right + ' מתוך ' + r.total + '. את השאר נלמד יחד.' : 'כולן חדשות, וזה בסדר. נלמד יחד.',
      stars: 0, onAgain: () => H.openPlan(), againLabel: '➡️ להמשך'});
    return;
  }
  p.n++;
  const stars = H.stars(), perfect = r.wrong === 0;
  if(p.n >= H.PLAN_STEPS){
    /* הפתעה שלא הובטחה מראש: פרס שלא צפוי לא פוגע במוטיבציה (Deci ואחרים) */
    const bonus = 10 + Math.floor(Math.random() * 21);
    H.state.coins += bonus; H.save();
    H.finish({emoji:'🌙', title:'סיימת את התרגול של היום!',
      text:'זה מספיק להיום. נתראה מחר!<br>🎁 הפתעה: ' + bonus + ' מטבעות', stars,
      xp: 20 + r.right * 6 + (perfect ? 20 : 0)});
    H.confetti(50);
    return;
  }
  H.save();
  H.finish({emoji: perfect ? '🌟' : '👍', title: perfect ? 'מושלם!' : 'כל הכבוד!',
    text:'נכון ' + r.right + ' מתוך ' + r.total + (r.wrong ? ' · טעויות: ' + r.wrong : ''),
    stars, xp: 15 + r.right * 6 + (perfect ? 15 : 0),
    onAgain: () => H.openPlan(), againLabel: '➡️ השלב הבא'});
};

/* ---------- כפתור במסך הראשי ---------- */
H.renderPlanBtn = function(){
  const b = H.$('planbtn'); if(!b) return;
  const p = H.plan(), done = p.n >= H.PLAN_STEPS, bk = H.planBuckets();
  b.classList.toggle('done', done);
  b.innerHTML = '<span class="m-e">' + (done ? '✅' : '📅') + '</span><b>' + (done ? 'התרגול של היום הושלם' : 'התרגול של היום') + '</b>' +
    '<small>' + (done ? 'נתראה מחר' : '3 שלבים · כ־10 דקות' + (bk.nw.length ? ' · ' + bk.nw.length + ' מילים חדשות' : '')) + '</small>';
};
