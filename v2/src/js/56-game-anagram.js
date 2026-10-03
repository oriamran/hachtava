/* ========== 7. סדר את האותיות — נגד השעון ========== */
H.game({
  id:'anagram', e:'🔀', name:'ערבוביה',
  desc:'סדר את האותיות לפני שייגמר הזמן',
  get SEC(){ return H.grade().ana; },      /* קבוע לפי הכיתה */
  start(){ H.show('anagram'); this.next(); },
  next(){
    const w = H.nextWord();
    if(!w) return this.stop(), H.endRound();
    const r = H.run;
    /* אותיות המילה בלבד, מעורבבות — בלי מסיחים, הקושי הוא הסדר */
    let tiles = H.clusters(w).map((ch, i) => ({id:i, ch}));
    let mix = H.shuffle(tiles);
    if(mix.map(t => t.ch).join('') === w) mix = H.shuffle(mix);
    r.tiles = mix; r.answer = [];
    H.$('anafb').textContent = '';
    this.render();
    this.startClock();
    setTimeout(() => H.say(w), 200);
  },
  startClock(){
    const r = H.run;
    r.left = this.SEC;
    const bar = H.$('anaclock');
    const tick = () => {
      if(H.screen !== 'anagram') return;
      r.left -= 0.1;
      bar.style.width = Math.max(0, 100 * r.left / this.SEC) + '%';
      bar.classList.toggle('low', r.left < 8);
      if(r.left <= 0){
        H.wrong();
        H.$('anafb').innerHTML = '<span class="no">נגמר הזמן! המילה: <b>' + r.word + '</b></span>';
        clearInterval(r.clock);
        setTimeout(() => this.next(), 1900);
        return;
      }
    };
    clearInterval(r.clock);
    r.clock = setInterval(tick, 100);
  },
  render(){
    const r = H.run, slots = H.$('anaslots'), pool = H.$('anapool');
    slots.innerHTML = ''; pool.innerHTML = '';
    if(!r.answer.length)
      slots.appendChild(H.el('div', 'hint-empty', 'לחץ לפי הסדר הנכון'));
    r.answer.forEach((tid, pos) => {
      const t = r.tiles.find(x => x.id === tid);
      const el = H.el('button', 'tile' + (t.ch === ' ' ? ' space' : ''), t.ch === ' ' ? 'רווח' : t.ch);
      el.onclick = () => { H.sfx.tap(); r.answer.splice(pos, 1); this.render(); };
      slots.appendChild(el);
    });
    r.tiles.forEach(t => {
      const el = H.el('button', 'tile' + (t.ch === ' ' ? ' space' : '') +
                      (r.answer.includes(t.id) ? ' used' : ''), t.ch === ' ' ? 'רווח' : t.ch);
      el.onclick = () => {
        H.sfx.tap(); r.answer.push(t.id); this.render();
        if(r.answer.length === r.tiles.length) this.check();
      };
      pool.appendChild(el);
    });
  },
  check(){
    const r = H.run;
    const got = r.answer.map(id => r.tiles.find(t => t.id === id).ch).join('');
    clearInterval(r.clock);
    if(got === r.word){
      H.right();
      H.$('anafb').innerHTML = '<span class="ok">🎉 נכון!</span>';
      H.speak(r.word);
      setTimeout(() => this.next(), 900);
    } else {
      H.wrong();
      H.$('anafb').innerHTML = '<span class="no">לא בדיוק — <b>' + r.word + '</b></span>';
      setTimeout(() => this.next(), 1800);
    }
  },
  stop(){ if(H.run) clearInterval(H.run.clock); }
});
