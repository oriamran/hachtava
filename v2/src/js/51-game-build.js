/* ========== 2. הרכבת מילה מאריחי אות+ניקוד ========== */
H.game({
  id:'build', e:'🔤', name:'הרכבה',
  desc:'בנה את המילה מאותיות',
  start(){ H.show('build'); this.next(); },
  next(){
    const w = H.nextWord();
    if(!w) return H.endRound();
    const letters = H.clusters(w), extra = [];
    let guard = 0;
    while(extra.length < 3 && guard++ < 120){
      const c = H.randTile(true);
      if(!letters.includes(c) && !extra.includes(c)) extra.push(c);
    }
    H.run.tiles  = H.shuffle(letters.concat(extra).map((ch, i) => ({id:i, ch})));
    H.run.answer = [];
    H.$('buildfb').textContent = '';
    this.render();
    setTimeout(() => H.say(w), 250);
  },
  render(){
    const r = H.run, slots = H.$('slots'), pool = H.$('pool');
    slots.innerHTML = ''; pool.innerHTML = '';
    if(!r.answer.length)
      slots.appendChild(H.el('div', 'hint-empty', 'לחץ על האותיות לפי הסדר'));
    r.answer.forEach((tid, pos) => {
      const t = r.tiles.find(x => x.id === tid);
      const el = H.el('button', 'tile' + (t.ch === ' ' ? ' space' : ''), t.ch === ' ' ? 'רווח' : t.ch);
      el.onclick = () => { H.sfx.tap(); r.answer.splice(pos, 1); this.render(); };
      slots.appendChild(el);
    });
    r.tiles.forEach(t => {
      const el = H.el('button', 'tile' + (t.ch === ' ' ? ' space' : '') +
                      (r.answer.includes(t.id) ? ' used' : ''), t.ch === ' ' ? 'רווח' : t.ch);
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
      H.$('buildfb').innerHTML = '<span class="ok">🎉 נכון!</span>';
      H.speak(r.word);
      setTimeout(() => this.next(), 950);
    } else {
      H.wrong();
      H.$('buildfb').innerHTML = '<span class="no">כמעט… ככה זה נבנה:</span><div id="buildseg" class="segbox"></div>';
      if(r.cancelSeg) r.cancelSeg();
      r.cancelSeg = H.segmentShow(r.word, H.$('buildseg'));
      r.answer = []; this.render();
    }
  },
  hint(){
    H.$('buildfb').innerHTML = '<span class="peek">' + H.run.word + '</span>';
    setTimeout(() => { const f = H.$('buildfb'); if(f.querySelector('.peek')) f.textContent = ''; }, 2200);
  }
});
