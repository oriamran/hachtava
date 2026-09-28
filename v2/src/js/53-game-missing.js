/* ========== 4. איזו אות חסרה ========== */
H.game({
  id:'missing', e:'🕵️', name:'מה חסר',
  desc:'השלם את האות החסרה',
  start(){ H.show('missing'); this.next(); },
  next(){
    const w = H.nextWord();
    if(!w) return H.endRound();
    const cl = H.clusters(w);
    const idx = [];
    cl.forEach((c, i) => { if(c !== ' ') idx.push(i); });
    const gap = idx[Math.floor(Math.random()*idx.length)];
    H.run.answer = cl[gap];
    H.$('misword').innerHTML = cl.map((c, i) =>
      i === gap ? '<span class="gap">?</span>' : '<span>' + (c === ' ' ? '&nbsp;' : c) + '</span>').join('');
    /* מסיחים: אותה אות עם תנועה אחרת, ואות אחרת עם אותה תנועה */
    const base = H.run.answer[0], marks = H.run.answer.slice(1);
    const wrong = new Set();
    let guard = 0;
    while(wrong.size < 3 && guard++ < 120){
      const pick = Math.random() < 0.6
        ? base + marks.replace(/[ְ-ֻ]/g, '') + H.VOW[Math.floor(Math.random()*H.VOW.length)]
        : H.randTile(true);
      if(pick !== H.run.answer) wrong.add(pick);
    }
    const box = H.$('misopts'); box.innerHTML = '';
    H.shuffle([H.run.answer, ...wrong]).forEach(o => {
      const b = H.el('button', 'tile big', o);
      b.onclick = () => this.choose(b, o === H.run.answer);
      box.appendChild(b);
    });
    H.$('misfb').textContent = '';
    setTimeout(() => H.speak(w), 300);
  },
  choose(btn, ok){
    if(H.run.picked) return;
    H.run.picked = true;
    if(ok){
      H.right(); btn.classList.add('right');
      H.$('misword').querySelector('.gap').outerHTML = '<span>' + H.run.answer + '</span>';
      H.$('misfb').innerHTML = '<span class="ok">🎉 יפה!</span>';
    } else {
      H.wrong(); btn.classList.add('wrongpick');
      H.$('misfb').innerHTML = '<span class="no">לא… הנכונה היא ' + H.run.answer + '</span>';
    }
    setTimeout(() => { H.run.picked = false; this.next(); }, ok ? 850 : 1800);
  }
});
