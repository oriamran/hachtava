/* ========== 10. תפוס את הטעות ==========
   ארבע מילים, אחת כתובה עם אות דומה בצליל. ללמוד לזהות כתיב שגוי הוא
   בדיקה עצמית, והטעות היא מהסוג שבאמת נפוצה (ת/ט, כ/ק, א/ע...). */
H.game({
  id:'proof', e:'🔍', name:'תפוס את הטעות',
  desc:'איזו מילה כתובה לא נכון?',
  start(){ H.show('proof'); this.next(); },
  next(){
    const w = H.nextWord();
    if(!w) return H.endRound();
    const bad = H.variants(w, 1)[0];
    if(!bad) return this.next();                  /* אין לה גרסה שגויה הגיונית, מדלגים */
    const seen = new Set([H.sk(w)]), others = [];
    H.shuffle(H.words().map(H.disp)).forEach(x => {
      if(others.length < 3 && !seen.has(H.sk(x))){ seen.add(H.sk(x)); others.push(x); }
    });
    const opts = H.shuffle([{t: bad, wrong: true}].concat(others.map(t => ({t, wrong: false}))));
    const box = H.$('proofopts'); box.innerHTML = '';
    opts.forEach(o => {
      const b = H.el('button', 'bigword', o.t);
      b.onclick = () => this.choose(b, o.wrong);
      box.appendChild(b);
    });
    H.run.bad = bad;
    H.$('prooffb').textContent = '';
  },
  choose(btn, isWrong){
    const r = H.run;
    if(r.picked) return;
    r.picked = true;
    const fb = H.$('prooffb');
    if(isWrong){
      H.right(); btn.classList.add('right');
      fb.innerHTML = '<span class="ok">🎉 תפסת! הכתיב הנכון: <b>' + H.esc(r.word) + '</b></span>';
    } else {
      H.wrong(); btn.classList.add('wrongpick');
      [...H.$('proofopts').children].forEach(b => { if(b.textContent === r.bad) b.classList.add('right'); });
      fb.innerHTML = '<span class="no">הטעות הייתה כאן 👆 הכתיב הנכון: <b>' + H.esc(r.word) + '</b></span>';
    }
    setTimeout(() => { r.picked = false; this.next(); }, isWrong ? 1500 : 2600);
  }
});
