/* ========== 11. האות הקשה ==========
   אחת האסטרטגיות שה-EEF מזכירה היא לזהות את החלקים הקשים במילה וללמוד
   אותם במפורש. כאן הילד לוחץ על האות שנשמעת כמו אות אחרת (ת/ט, כ/ק, א/ע...),
   ואז נאמר לו מה היא. מבוסס על H.trickyParts, שמחשב את זה מהמילה עצמה. */
H.game({
  id:'tricky', e:'🎯', name:'האות הקשה',
  desc:'איזו אות נשמעת כמו אות אחרת?',
  canPlay: words => words.filter(w => H.trickyParts(w).length).length >= 2,
  start(){
    if(!this.canPlay(H.run.queue)){
      H.toast('אין אותיות קשות ברשימה הזאת'); return H.home();
    }
    H.show('tricky'); this.next();
  },
  next(){
    const w = H.nextWord();
    if(!w) return H.endRound();
    const parts = H.trickyParts(w);
    if(!parts.length){ H.run.total--; return this.next(); }   /* אין במילה אות קשה: מדלגים ולא סופרים */
    H.run.parts = parts;
    const box = H.$('trickytiles'); box.innerHTML = '';
    H.clusters(w).forEach((c, i) => {
      if(c === ' '){ box.appendChild(H.el('span', 'nkspace', '·')); return; }
      const b = H.el('button', 'tile big', c);
      b.onclick = () => this.choose(b, i);
      box.appendChild(b);
    });
    H.$('trickyfb').textContent = '';
    setTimeout(() => H.say(w), 250);
  },
  choose(btn, i){
    const r = H.run;
    if(r.picked) return;
    r.picked = true;
    const hit = r.parts.find(p => p.i === i), fb = H.$('trickyfb');
    const tiles = [...H.$('trickytiles').querySelectorAll('.tile')];
    if(hit){
      H.right(); btn.classList.add('right');
      fb.innerHTML = '<span class="ok">🎉 נכון! <b>' + H.esc(hit.ch) + '</b> ' + H.esc(hit.why) + '</span>';
    } else {
      H.wrong(); btn.classList.add('wrongpick');
      const clusters = H.clusters(r.word);
      let k = 0;
      clusters.forEach((c, idx) => { if(c === ' ') return; if(r.parts.some(p => p.i === idx)) tiles[k].classList.add('right'); k++; });
      fb.innerHTML = '<span class="no">' + H.trickyHint(r.word) + '</span>';
    }
    setTimeout(() => { r.picked = false; this.next(); }, hit ? 1500 : 2600);
  }
});
