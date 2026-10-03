/* ========== 13. חיפוש מילים ==========
   תשבץ אותיות: מילות הסבב מוסתרות ברשת, בשורות (מימין לשמאל) או בעמודות
   (מלמעלה למטה). הילד לוחץ על האות הראשונה ואז על האחרונה. סריקה של אותיות
   מחזקת את סדר האותיות בכל מילה, אבל זה שלב הכרה ולא כתיבה. */
H.SEARCH_N = 7;
H.game({
  id:'search', e:'🔎', name:'חיפוש מילים',
  desc:'מצא את המילים ברשת האותיות',
  /* מילים בלי ניקוד וללא רווחים, עד 7 אותיות */
  clean: w => H.strip(w).replace(/\s+/g, ''),
  canPlay(words){ return words.filter(w => { const n = H.strip(w).replace(/\s+/g, '').length; return n >= 2 && n <= H.SEARCH_N; }).length >= 2; },
  start(){
    const r = H.run, N = H.SEARCH_N;
    const items = r.queue.map(w => ({w, s: this.clean(w)}))
      .filter(x => x.s.length >= 2 && x.s.length <= N).sort((a, b) => b.s.length - a.s.length);
    const grid = Array.from({length: N * N}, () => '');
    const placed = [];
    items.forEach(it => {
      for(let t = 0; t < 250; t++){
        const vert = Math.random() < .5, row = Math.floor(Math.random() * N), col = Math.floor(Math.random() * N);
        const cells = [];
        for(let k = 0; k < it.s.length; k++){
          const rr = vert ? row + k : row, cc = vert ? col : col + k;
          if(rr >= N || cc >= N){ cells.length = 0; break; }
          cells.push(rr * N + cc);
        }
        if(!cells.length) continue;
        if(cells.every((ci, k) => !grid[ci] || grid[ci] === it.s[k])){
          cells.forEach((ci, k) => grid[ci] = it.s[k]);
          placed.push({w: it.w, s: it.s, cells, found: false});
          break;
        }
      }
    });
    if(placed.length < 2){ H.toast('אין מספיק מילים קצרות לחיפוש'); return H.home(); }
    const abc = 'אבגדהוזחטיכלמנסעפצקרשת';
    for(let i = 0; i < grid.length; i++) if(!grid[i]) grid[i] = abc[Math.floor(Math.random() * abc.length)];
    r.grid = grid; r.placed = placed; r.first = -1; r.queue = []; r.total = placed.length;
    H.show('search'); this.render();
  },
  render(){
    const r = H.run, box = H.$('searchgrid'), N = H.SEARCH_N;
    box.style.gridTemplateColumns = 'repeat(' + N + ',1fr)';
    box.innerHTML = '';
    const foundCells = new Set();
    r.placed.forEach(p => { if(p.found) p.cells.forEach(c => foundCells.add(c)); });
    r.grid.forEach((ch, i) => {
      const b = H.el('button', 'scell' + (foundCells.has(i) ? ' found' : '') + (r.first === i ? ' first' : ''), ch);
      b.onclick = () => this.tap(i);
      box.appendChild(b);
    });
    H.$('searchlist').innerHTML = r.placed.map(p => '<span class="' + (p.found ? 'done' : '') + '">' + H.esc(p.found ? p.w : '▢'.repeat(Math.min(p.s.length, 7))) + '</span>').join('');
  },
  tap(i){
    const r = H.run, N = H.SEARCH_N;
    H.sfx.tap();
    if(r.first < 0){ r.first = i; return this.render(); }
    let a = r.first, b = i; r.first = -1;
    const sameRow = Math.floor(a / N) === Math.floor(b / N), sameCol = a % N === b % N;
    if(a !== b && (sameRow || sameCol)){
      if(a > b){ const t = a; a = b; b = t; }              /* סדר הקריאה: עולה */
      const step = sameRow ? 1 : N, cells = [];
      for(let c = a; c <= b; c += step) cells.push(c);
      const s = cells.map(c => r.grid[c]).join('');
      const hit = r.placed.find(p => !p.found && p.s === s);
      if(hit){
        hit.found = true; r.word = hit.w; H.right();
        H.toast('🎉 ' + hit.w, 'good');
        this.render();
        if(r.placed.every(p => p.found)) setTimeout(() => H.endRound(), 700);
        return;
      }
    }
    r.wrong++; H.sfx.bad();                                   /* בלי לייחס לטעות מילה מסוימת */
    this.render();
  },
  hint(){
    const p = H.run.placed.find(x => !x.found); if(!p) return;
    H.run.first = p.cells[0]; this.render();
  }
});
