/* ========== 8. תפוס: אותיות נופלות, הזז את הסל ========== */
H.game({
  id:'catch', e:'🧺', name:'תפוס',
  desc:'תפוס את האותיות לפי הסדר',
  start(){ H.show('catch'); this.bind(); this.next(); },
  bind(){
    if(this.bound) return;
    this.bound = true;
    const field = H.$('catchfield');
    const move = e => {
      const r = field.getBoundingClientRect();
      /* הסל ממוקם ב-inset-inline-start, שב-RTL נמדד מימין */
      const x = Math.max(0, Math.min(1, (r.right - e.clientX) / r.width));
      H.$('basket').style.insetInlineStart = (x * 100) + '%';
      if(H.run) H.run.bx = x;
    };
    field.addEventListener('pointermove', e => { move(e); e.preventDefault(); });
    field.addEventListener('pointerdown', e => { move(e); e.preventDefault(); });
  },
  next(){
    const w = H.nextWord();
    if(!w) return this.stop(), H.endRound();
    const r = H.run;
    r.need = H.clusters(w).filter(c => c !== ' ');
    r.at = 0; r.items = []; r.miss = 0; r.bx = r.bx === undefined ? 0.5 : r.bx;
    r.spawnAt = 0;
    H.$('catchtarget').innerHTML = r.need.map((c, i) =>
      '<span class="bt' + (i === 0 ? ' now' : '') + '">' + c + '</span>').join('');
    H.$('catchfield').querySelectorAll('.falling').forEach(e => e.remove());
    setTimeout(() => H.say(w), 200);
    this.tick();
  },
  tick(){
    const r = H.run, field = H.$('catchfield');
    const step = () => {
      if(H.screen !== 'catch') return;
      const h = field.clientHeight || 300;
      if(--r.spawnAt <= 0){
        r.spawnAt = 46;
        /* מעדיפים את האות המבוקשת, שלא יוצף במסיחים */
        const ch = Math.random() < 0.65 ? r.need[r.at] : H.randTile(true);
        const d = H.el('div', 'falling', ch);
        d.dataset.ch = ch;
        d._x = 0.06 + Math.random()*0.88;
        d._y = -50;
        d._v = 1.1 + Math.random()*0.8;
        d.style.insetInlineStart = (d._x * 100) + '%';
        field.appendChild(d);
        r.items.push(d);
      }
      for(let i = r.items.length - 1; i >= 0; i--){
        const d = r.items[i];
        d._y += d._v;
        d.style.transform = 'translateY(' + d._y + 'px)';
        /* אזור הסל: 40px התחתונים */
        if(d._y > h - 64 && d._y < h - 8 && Math.abs(d._x - r.bx) < 0.12){
          this.caught(d);
          d.remove(); r.items.splice(i, 1);
          continue;
        }
        if(d._y > h + 40){ d.remove(); r.items.splice(i, 1); }
      }
      H.loop = requestAnimationFrame(step);
    };
    if(H.loop) cancelAnimationFrame(H.loop);
    H.loop = requestAnimationFrame(step);
  },
  caught(d){
    const r = H.run;
    if(d.dataset.ch === r.need[r.at]){
      H.sfx.tap(); r.at++;
      const m = H.$('catchtarget').children;
      if(m[r.at-1]) m[r.at-1].classList.add('got');
      if(m[r.at])   m[r.at].classList.add('now');
      if(r.at >= r.need.length){
        /* תפיסה שגויה אחת או שתיים לא פוסלות את המילה */
        if(r.miss <= 2){ H.right(); H.sfx.great(); } else H.wrong();
        setTimeout(() => this.next(), 650);
      }
    } else {
      /* תפיסה שגויה רק מרעידה. המילה נכשלת רק אחרי חמש. */
      r.miss++; H.sfx.bad();
      H.$('basket').classList.add('shake');
      setTimeout(() => H.$('basket').classList.remove('shake'), 340);
      if(r.miss >= 5){ H.wrong(); setTimeout(() => this.next(), 500); }
    }
  },
  stop(){ if(H.loop){ cancelAnimationFrame(H.loop); H.loop = null; } }
});
