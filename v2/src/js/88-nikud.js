/* ==========================================================
   עורך ניקוד בהקשה.
   המקלדת הישנה דרשה למקם סמן אחרי כל אות — בטלפון זה כמעט
   בלתי אפשרי. כאן בוחרים אות, ואז בוחרים לה תנועה.
   ========================================================== */
H.VOWELS = [
  ['ְ','שווא'], ['ַ','פתח'],  ['ָ','קמץ'],
  ['ֵ','צירה'], ['ֶ','סגול'], ['ִ','חיריק'],
  ['ֹ','חולם'],  ['ֻ','קבוץ'],
  ['ֱ','חטף סגול'], ['ֲ','חטף פתח'], ['ֳ','חטף קמץ']
];
H.DAGESH = 'ּ'; H.SHIN = 'ׁ'; H.SIN = 'ׂ';
H.isVowel = c => H.VOWELS.some(v => v[0] === c);

/* פירוק אשכול לחלקיו, ובנייה מחדש בסדר קבוע: אות, דגש, נקודה, תנועה */
H.parseCluster = function(cl){
  const o = {base: cl[0], dagesh:false, shin:false, sin:false, vowel:''};
  for(const c of cl.slice(1)){
    if(c === H.DAGESH) o.dagesh = true;
    else if(c === H.SHIN) o.shin = true;
    else if(c === H.SIN) o.sin = true;
    else if(H.isVowel(c)) o.vowel = c;
  }
  return o;
};
H.buildCluster = o =>
  o.base + (o.dagesh ? H.DAGESH : '') + (o.shin ? H.SHIN : '') + (o.sin ? H.SIN : '') + (o.vowel || '');

H.nk = {word:0, letter:-1};

H.openNikud = function(){
  H.nk = {word:0, letter:-1};
  H.renderPhoto();
  H.renderNikud();
  H.show('nikud');
};
H.renderNikud = function(){
  const words = H.words();
  if(!words.length) return;
  if(H.nk.word >= words.length) H.nk.word = 0;

  /* בחירת המילה */
  const wb = H.$('nk-words'); wb.innerHTML = '';
  words.forEach((w, i) => {
    const el = H.el('button', 'nkword' + (i === H.nk.word ? ' on' : ''), w);
    el.onclick = () => { H.sfx.tap(); H.nk.word = i; H.nk.letter = -1; H.renderNikud(); };
    wb.appendChild(el);
  });

  /* אותיות המילה */
  const word = words[H.nk.word];
  const cl = H.clusters(word);
  const lb = H.$('nk-letters'); lb.innerHTML = '';
  cl.forEach((ch, i) => {
    if(ch === ' '){ lb.appendChild(H.el('span', 'nkspace', '·')); return; }
    const el = H.el('button', 'nkletter' + (i === H.nk.letter ? ' on' : ''), ch);
    el.onclick = () => { H.sfx.tap(); H.nk.letter = (H.nk.letter === i ? -1 : i); H.renderNikud(); };
    lb.appendChild(el);
  });

  /* לוח התנועות — רק אחרי שנבחרה אות */
  const pb = H.$('nk-pad');
  pb.innerHTML = '';
  if(H.nk.letter < 0){
    pb.appendChild(H.el('p', 'note', 'בחר אות למעלה כדי לנקד אותה'));
    H.$('nk-preview').textContent = word;
    return;
  }
  const cur = H.parseCluster(cl[H.nk.letter]);
  const set = (fn) => {
    fn(cur);
    const c2 = H.clusters(H.words()[H.nk.word]);
    c2[H.nk.letter] = H.buildCluster(cur);
    H.pack().list[H.nk.word] = c2.join('');
    H.save(); H.syncStats(); H.renderNikud();
  };

  const row1 = H.el('div', 'nkrow');
  H.VOWELS.forEach(([m, name]) => {
    const on = cur.vowel === m;
    const b = H.el('button', 'nkv' + (on ? ' on' : ''), cur.base + m + '<small>' + name + '</small>');
    b.onclick = () => set(o => { o.vowel = on ? '' : m; });
    row1.appendChild(b);
  });
  pb.appendChild(row1);

  const row2 = H.el('div', 'nkrow');
  [[H.DAGESH, 'דגש', 'dagesh'],
   [H.SHIN,   'שׁין', 'shin'],
   [H.SIN,    'שׂין', 'sin']].forEach(([m, name, key]) => {
    const b = H.el('button', 'nkv mod' + (cur[key] ? ' on' : ''), cur.base + m + '<small>' + name + '</small>');
    b.onclick = () => set(o => {
      o[key] = !o[key];
      if(key === 'shin' && o.shin) o.sin = false;
      if(key === 'sin'   && o.sin) o.shin = false;
    });
    row2.appendChild(b);
  });
  const clr = H.el('button', 'nkv clr', '✖<small>נקה</small>');
  clr.onclick = () => set(o => { o.vowel=''; o.dagesh=false; o.shin=false; o.sin=false; });
  row2.appendChild(clr);
  pb.appendChild(row2);

  H.$('nk-preview').textContent = H.words()[H.nk.word];
};
H.finishNikud = function(){
  H.refresh();
  H.openSettings();
};
