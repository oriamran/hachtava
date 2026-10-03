/* ========== 12. הבזק ==========
   המילה מופיעה לכמה שניות ונעלמת, והילד מרכיב אותה מאריחים. זה גשר בין
   הרכבה (המילה לפניך) לכתיבה מהזיכרון (אין כלום), ונשען על
   "הסתכל, כסה, כתוב, בדוק". ההוכחות על השיטה מעורבות, ולכן היא רק שלב אחד בסולם. */
H.game({
  id:'flash', e:'⚡', name:'הבזק',
  desc:'מסתכלים ומרכיבים מהזיכרון',
  start(){ H.show('flash'); this.next(); },
  next(){
    const w = H.nextWord();
    if(!w) return H.endRound();
    const letters = H.clusters(w), extra = [];
    let guard = 0;
    while(extra.length < 3 && guard++ < 120){
      const c = H.randTile(true);
      if(!letters.includes(c) && !extra.includes(c)) extra.push(c);
    }
    H.run.tiles = H.shuffle(letters.concat(extra).map((ch, i) => ({id:i, ch})));
    H.run.answer = [];
    H.$('flashfb').textContent = '';
    this.flash(w, Math.min(4500, 1800 + w.length * 300));
    setTimeout(() => H.say(w), 250);
  },
  /* מציג את המילה, ואז מסתיר אותה ופותח את האריחים */
  flash(w, ms){
    const r = H.run;
    H.$('flashword').textContent = w;
    H.$('flashword').style.visibility = 'visible';
    H.$('flasharea').style.display = 'none';
    const bar = H.$('flashbar'); bar.style.transition = 'none'; bar.style.width = '100%';
    requestAnimationFrame(() => requestAnimationFrame(() => { bar.style.transition = 'width ' + ms + 'ms linear'; bar.style.width = '0'; }));
    clearTimeout(r.ft);
    r.ft = setTimeout(() => {
      if(H.run !== r || r.word !== w) return;       /* יצא מהמשחק או עבר מילה */
      H.$('flashword').style.visibility = 'hidden';
      H.$('flasharea').style.display = '';
      this.render();
    }, ms);
  },
  render(){
    const r = H.run, slots = H.$('flslots'), pool = H.$('flpool');
    slots.innerHTML = ''; pool.innerHTML = '';
    if(!r.answer.length) slots.appendChild(H.el('div', 'hint-empty', 'הרכב את המילה שראית'));
    r.answer.forEach((tid, pos) => {
      const t = r.tiles.find(x => x.id === tid);
      const el = H.el('button', 'tile' + (t.ch === ' ' ? ' space' : ''), t.ch === ' ' ? 'רווח' : t.ch);
      el.onclick = () => { H.sfx.tap(); r.answer.splice(pos, 1); this.render(); };
      slots.appendChild(el);
    });
    r.tiles.forEach(t => {
      const el = H.el('button', 'tile' + (t.ch === ' ' ? ' space' : '') + (r.answer.includes(t.id) ? ' used' : ''), t.ch === ' ' ? 'רווח' : t.ch);
      el.onclick = () => { H.sfx.tap(); r.answer.push(t.id); this.render(); };
      pool.appendChild(el);
    });
  },
  check(){
    const r = H.run;
    if(!r.answer.length) return;
    const got = r.answer.map(id => r.tiles.find(t => t.id === id).ch).join('');
    if(got === r.word){
      H.right();
      H.$('flashfb').innerHTML = '<span class="ok">🎉 זכרת!</span>';
      H.speak(r.word);
      setTimeout(() => this.next(), 950);
    } else {
      H.wrong();
      H.$('flashfb').innerHTML = '<span class="no">כמעט… הנה שוב</span>';
      r.answer = [];
      this.flash(r.word, Math.min(4500, 2200 + r.word.length * 300));   /* מבזיקים שוב, ומנסים עוד פעם */
    }
  },
  peek(){
    const r = H.run; if(!r.word) return;
    this.flash(r.word, 1500);
  }
});
