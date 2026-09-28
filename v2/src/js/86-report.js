/* ==========================================================
   דוח הורים: מה נתקע, כמה תורגל, מה השתפר
   ========================================================== */
H.renderReport = function(){
  const st = H.state.stats, words = H.words();

  /* --- מילים לפי מצב --- */
  const rank = words.map(w => {
    const s = st[w] || {ok:0, bad:0, run:0};
    const tries = s.ok + s.bad;
    return {w, s, tries, rate: tries ? s.ok / tries : 0, done: s.run >= H.MASTER_AT};
  });
  const stuck = rank.filter(r => !r.done && r.s.bad > 0).sort((a,b) => b.s.bad - a.s.bad);
  const done  = rank.filter(r => r.done);
  const fresh = rank.filter(r => !r.done && r.tries === 0);

  const list = (arr, empty, cls) => arr.length
    ? arr.map(r =>
        '<div class="rrow ' + cls + '"><span class="rw">' + r.w + '</span>' +
        '<span class="rnum">' + (r.tries ? r.s.ok + '/' + r.tries : '—') + '</span></div>').join('')
    : '<p class="rempty">' + empty + '</p>';

  H.$('rep-stuck').innerHTML = list(stuck,
    'אין מילים תקועות כרגע 👍', 'bad');
  H.$('rep-done').innerHTML  = list(done,
    'עדיין אף מילה לא נכבשה', 'ok');
  H.$('rep-fresh').innerHTML = list(fresh,
    'כל המילים כבר תורגלו', '');

  /* --- שבעת הימים האחרונים --- */
  const days = [];
  for(let i = 6; i >= 0; i--){
    const d = new Date(Date.now() - i*864e5).toISOString().slice(0,10);
    days.push({d, e: H.state.log[d] || {sec:0, right:0, wrong:0, rounds:0}});
  }
  const max = Math.max(60, ...days.map(x => x.e.sec));
  const names = ['א','ב','ג','ד','ה','ו','ש'];
  H.$('rep-chart').innerHTML = days.map(x => {
    const h = Math.round(100 * x.e.sec / max);
    const dow = names[new Date(x.d + 'T12:00').getDay()];
    return '<div class="bar"><span class="barval">' + (x.e.sec ? Math.round(x.e.sec/60) + '׳' : '') + '</span>' +
           '<i style="height:' + Math.max(3, h) + '%"></i><span class="barlbl">' + dow + '</span></div>';
  }).join('');

  const tot = days.reduce((a,x) => ({sec:a.sec+x.e.sec, right:a.right+x.e.right, wrong:a.wrong+x.e.wrong}),
                          {sec:0, right:0, wrong:0});
  const acc = (tot.right + tot.wrong) ? Math.round(100*tot.right/(tot.right+tot.wrong)) : 0;
  H.$('rep-sum').innerHTML =
    '<div class="statbox"><b>' + Math.round(tot.sec/60) + '</b><small>דקות השבוע</small></div>' +
    '<div class="statbox"><b>' + acc + '%</b><small>דיוק</small></div>' +
    '<div class="statbox"><b>' + done.length + '/' + words.length + '</b><small>נכבשו</small></div>' +
    '<div class="statbox"><b>' + H.state.daily.streak + '</b><small>רצף ימים</small></div>';

  /* אותיות שקשות לו — זה מה שהכתבה רגילה לא מגלה */
  const hard = H.hardLetters(8);
  H.$('rep-letters').innerHTML = hard.length
    ? '<div class="letgrid">' + hard.map(l =>
        '<div class="letcell"><span class="lw">' + l.ch + '</span>' +
        '<span class="lr">' + Math.round(l.rate*100) + '%</span>' +
        '<span class="ln">' + l.ok + '/' + l.tries + '</span></div>').join('') + '</div>'
    : '<p class="rempty">\u05e2\u05d3\u05d9\u05d9\u05df \u05d0\u05d9\u05df \u05de\u05e1\u05e4\u05d9\u05e7 \u05db\u05ea\u05d9\u05d1\u05d4 \u05db\u05d3\u05d9 \u05dc\u05d6\u05d4\u05d5\u05ea \u05d0\u05d5\u05ea\u05d9\u05d5\u05ea \u05d1\u05e2\u05d9\u05d9\u05ea\u05d9\u05d5\u05ea</p>';

  /* כמה המערכת כבר מכירה את הכתב שלו */
  const hs = H.handStats();
  H.$('rep-hand').innerHTML = hs.ready
    ? '<div class="handbox"><b>' + hs.ready + '</b> \u05d0\u05d5\u05ea\u05d9\u05d5\u05ea \u05e0\u05dc\u05de\u05d3\u05d5 \u05de\u05d4\u05db\u05ea\u05d1 \u05e9\u05dc\u05d5' +
      '<small>' + hs.samples + ' \u05d3\u05d2\u05d9\u05de\u05d5\u05ea. \u05db\u05db\u05dc \u05e9\u05d9\u05e8\u05d1\u05d4 \u05dc\u05db\u05ea\u05d5\u05d1, \u05d4\u05d1\u05d3\u05d9\u05e7ה \u05de\u05d3\u05d5\u05d9\u05e7\u05ea \u05d9\u05d5\u05ea\u05e8</small></div>'
    : '<p class="rempty">\u05e2\u05d5\u05d3 \u05de\u05e2\u05d8 \u05db\u05ea\u05d9\u05d1\u05d4 \u05d5\u05d4\u05de\u05e2\u05e8\u05db\u05ea \u05ea\u05ea\u05d7\u05d9\u05dc \u05dc\u05d4\u05db\u05d9\u05e8 \u05d0\u05ea \u05d4\u05db\u05ea\u05d1 \u05e9\u05dc\u05d5</p>';

  H.$('rep-topic').textContent = H.topic();
};
