/* ========== 1. משחק זיכרון: מילה מול הצליל שלה ========== */
H.game({
  id:'memory', e:'🃏', name:'זיכרון',
  desc:'מצא את הזוגות',
  start(){
    const r = H.run, cards = [];
    r.queue.forEach(w => { cards.push({w, k:'text'}); cards.push({w, k:'pair'}); });
    r.cards = H.shuffle(cards);
    r.open = []; r.lock = false; r.found = 0;
    const b = H.$('board'); b.innerHTML = '';
    r.cards.forEach((c, i) => {
      const face = c.k === 'text' ? c.w : (H.useAudio ? '🔊' : H.masked(c.w));
      const cls  = (c.k === 'pair' && H.useAudio) ? 'face front sound' : 'face front';
      const el = H.el('div', 'cell');
      el.innerHTML = '<div class="inner"><div class="face back">❓</div>' +
                     '<div class="' + cls + '">' + face + '</div></div>';
      el.onclick = () => this.flip(i);
      b.appendChild(el);
    });
    H.$('memnote').textContent = H.useAudio
      ? 'לחץ על קלף ומצא את הזוג שלו 🔊'
      : 'מילה שלמה מול מילה חסרה';
    H.show('memory');
  },
  flip(i){
    const r = H.run, cells = H.$('board').children, el = cells[i], c = r.cards[i];
    if(r.lock || el.classList.contains('done') || el.classList.contains('flip')) return;
    el.classList.add('flip'); H.sfx.tap(); H.speak(c.w);
    r.open.push(i);
    if(r.open.length < 2) return;
    r.lock = true;
    const [a, b] = r.open;
    if(r.cards[a].w === r.cards[b].w && a !== b){
      setTimeout(() => {
        cells[a].classList.add('done'); cells[b].classList.add('done');
        r.open = []; r.lock = false; r.found++;
        r.word = r.cards[a].w; H.right(); 
        if(r.found === r.total) setTimeout(H.endRound, 600);
      }, 400);
    } else {
      setTimeout(() => {
        cells[a].classList.remove('flip'); cells[b].classList.remove('flip');
        r.open = []; r.lock = false;
      }, 900);
    }
  }
});
