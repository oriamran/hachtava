/* ========== 5. בועות: לחץ על האותיות לפי הסדר לפני שיברחו ========== */
H.game({
  id:'bubbles', e:'🫧', name:'בועות',
  desc:'לחץ לפי הסדר לפני שיברחו',
  start(){ H.show('bubbles'); this.next(); },
  next(){
    const w = H.nextWord();
    if(!w) return this.stop(), H.endRound();
    const r = H.run;
    r.need = H.clusters(w).filter(c => c !== ' ');
    r.at = 0; r.bubbles = []; r.miss = 0;
    H.$('bubtarget').innerHTML = r.need.map((c, i) =>
      '<span class="bt' + (i === 0 ? ' now' : '') + '">' + (H.state.hideWord ? '▢' : c) + '</span>').join('');
    const field = H.$('bubfield'); field.innerHTML = '';
    r.spawnAt = 0;
    setTimeout(() => H.say(w), 250);
    this.tick(field);
  },
  tick(field){
    const r = H.run;
    const step = () => {
      if(H.screen !== 'bubbles') return;
      const h = field.clientHeight || 300, wdt = field.clientWidth || 300;
      /* הבועה גדלה עם השדה. גודל קבוע נראה זעיר במסך רחב. */
      const bs = Math.max(64, Math.min(120, Math.round(wdt / 4.6)));
      field.style.setProperty('--bub', bs + 'px');
      /* יצירת בועה חדשה */
      if(--r.spawnAt <= 0){
        r.spawnAt = 34;
        const wanted = Math.random() < 0.6;
        const ch = wanted ? r.need[r.at] : H.randTile(true);
        const b = H.el('button', 'bubble', ch);
        b.style.left = (8 + Math.random()*76) + '%';
        b.style.setProperty('--hue', Math.floor(Math.random()*360));
        b.dataset.ch = ch;
        /* _y = כמה עלתה מתחתית השדה. מתחילה מתחת לקצה ועולה. */
        b._y = -70;
        b._v = 0.9 + Math.random()*0.7;
        b.onclick = e => { e.stopPropagation(); this.pop(b); };
        field.appendChild(b);
        r.bubbles.push(b);
      }
      /* תנועה — רק transform, בלי לגעת ב-bottom */
      for(let i = r.bubbles.length - 1; i >= 0; i--){
        const b = r.bubbles[i];
        b._y += b._v;
        b.style.transform = 'translateY(' + (-b._y) + 'px)';
        if(b._y > h + 80){ b.remove(); r.bubbles.splice(i, 1); }
      }
      H.loop = requestAnimationFrame(step);
    };
    if(H.loop) cancelAnimationFrame(H.loop);
    H.loop = requestAnimationFrame(step);
  },
  pop(b){
    const r = H.run;
    /* בועה שכבר נפוצצה (או לחיצה כפולה מהירה) לא נספרת שוב. אחרת מילה עם אות כפולה התקדמה בשתי אותיות בלחיצה אחת. */
    const now = performance.now();
    if(b._done || now - (r.lastPop || 0) < 220) return;
    r.lastPop = now; b._done = true; b.style.pointerEvents = 'none';
    if(b.dataset.ch === r.need[r.at]){
      H.sfx.tap(); b.classList.add('pop');
      setTimeout(() => b.remove(), 180);
      r.bubbles = r.bubbles.filter(x => x !== b);
      r.at++;
      const marks = H.$('bubtarget').children;
      if(marks[r.at-1]){ marks[r.at-1].classList.remove('now'); marks[r.at-1].classList.add('got'); marks[r.at-1].textContent = r.need[r.at-1]; }
      if(marks[r.at])   marks[r.at].classList.add('now');
      if(r.at >= r.need.length){
        /* לחיצה שגויה אחת או שתיים לא פוסלות את המילה */
        if(r.miss <= 2){ H.right(); H.sfx.great(); } else H.wrong();
        setTimeout(() => this.next(), 650);
      }
    } else {
      r.miss++; H.sfx.bad(); b.classList.add('shake');
      setTimeout(() => { b.classList.remove('shake'); b._done = false; b.style.pointerEvents = ''; }, 350);
      if(r.miss >= 5){ H.wrong(); setTimeout(() => this.next(), 500); }
    }
  },
  stop(){ if(H.loop){ cancelAnimationFrame(H.loop); H.loop = null; } }
});
