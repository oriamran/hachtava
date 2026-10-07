/* ==========================================================
   אותיות: משחק שמלמד אות אחר אות ופותח אותה בעולם הבנייה.
   לכל אות: כרטיס הכרות (שם האות ומילה שמתחילה בה), שאלה על המילה
   ושאלה על השם. רק ארבע אותיות על המסך לכל היותר: בלי הסחות דעת.
   אות נפתחת רק כששתי השאלות נענו נכון.
   ========================================================== */
/* שם האות (מנוקד, להקראה) · מילה לדוגמה (מנוקדת) · אימוג'י */
H.LETTER_INFO = {
  'א': ['אָלֶף', 'אַרְיֵה', '🦁'], 'ב': ['בֵּית', 'בָּלוֹן', '🎈'], 'ג': ['גִּימֶל', 'גָּמָל', '🐫'], 'ד': ['דָּלֶת', 'דָּג', '🐟'],
  'ה': ['הֵא', 'הַר', '⛰️'], 'ו': ['וָו', 'וֶרֶד', '🌹'], 'ז': ['זַיִן', 'זֶבְּרָה', '🦓'], 'ח': ['חֵית', 'חָתוּל', '🐱'],
  'ט': ['טֵית', 'טֶלֶפוֹן', '📞'], 'י': ['יוֹד', 'יָד', '✋'], 'כ': ['כָּף', 'כֶּלֶב', '🐶'], 'ל': ['לָמֶד', 'לֵב', '❤️'],
  'מ': ['מֵם', 'מַיִם', '💧'], 'נ': ['נוּן', 'נָחָשׁ', '🐍'], 'ס': ['סָמֶךְ', 'סוּס', '🐴'], 'ע': ['עַיִן', 'עֵץ', '🌳'],
  'פ': ['פֵּא', 'פִּיל', '🐘'], 'צ': ['צָדִי', 'צָב', '🐢'], 'ק': ['קוֹף', 'קוֹף', '🐒'], 'ר': ['רֵישׁ', 'רַכֶּבֶת', '🚆'],
  'ש': ['שִׁין', 'שֶׁמֶשׁ', '☀️'], 'ת': ['תָּו', 'תַּפּוּחַ', '🍎']
};
H.LETTER_BASE = 'אבגדהוזחטיכלמנסעפצקרשת';
/* אותיות שדומות למראה או לצליל: משמשות כמסיחים, כדי שהשאלה תהיה הוגנת אבל לא רנדומלית */
H.LETTER_LOOKALIKE = {'ב': 'כ', 'כ': 'ב', 'ד': 'ר', 'ר': 'ד', 'ה': 'ח', 'ח': 'ה', 'ת': 'ח', 'ו': 'ז', 'ז': 'ו', 'ט': 'ס', 'ס': 'ט', 'מ': 'ס', 'ג': 'נ', 'נ': 'ג', 'ע': 'צ', 'צ': 'ע', 'ק': 'ר', 'פ': 'ס', 'י': 'ו', 'ל': 'ט', 'א': 'ע', 'ש': 'ת'};

H.letterSet = function(){ const b = H.state.build || (H.state.build = {e: '', hot: [], l: ''}); return b.l || ''; };
/* אות פתוחה אם נלמדה במשחק, או שהופיעה במילה שהילד שלט בה (האלבום) */
H.letterLearned = function(ch){
  const base = H.VOX_FINAL[ch] || ch;
  return H.letterSet().includes(base);
};
H.learnLetter = function(ch){
  const base = H.VOX_FINAL[ch] || ch, b = H.state.build || (H.state.build = {e: '', hot: [], l: ''});
  if(!b.l) b.l = '';
  if(!b.l.includes(base)) b.l += base;
  H.save();
};
/* האם האות פתוחה בעולם הבנייה (כל דרך) */
H.letterOpenAny = function(ch){
  const base = H.VOX_FINAL[ch] || ch;
  if(H.letterLearned(base)) return true;
  return H.state.album.some(w => String(w).includes(base) || String(w).includes(ch));
};
H.lockedLetters = () => [...H.LETTER_BASE].filter(c => !H.letterOpenAny(c));

/* אילו אותיות ללמוד עכשיו: קודם אלה שבמילים של הנושא הנוכחי, אחר כך לפי סדר האלפבית */
H.letterQueue = function(n){
  const locked = H.lockedLetters();
  if(!locked.length) return H.shuffle([...H.LETTER_BASE]).slice(0, n);       /* הכול פתוח: חזרה */
  const inTopic = new Set(); H.words().forEach(w => { for(const c of H.strip(String(w))) inTopic.add(H.VOX_FINAL[c] || c); });
  const first = locked.filter(c => inTopic.has(c)), rest = locked.filter(c => !inTopic.has(c));
  return first.concat(rest).slice(0, n);
};
H.letterOptions = function(ch, n){
  const pool = [...H.LETTER_BASE].filter(c => c !== ch), out = [ch], la = H.LETTER_LOOKALIKE[ch];
  if(la) out.push(la);
  H.shuffle(pool).forEach(c => { if(out.length < n && !out.includes(c)) out.push(c); });
  return H.shuffle(out);
};

H.game({
  id: 'letters', e: '🔤', name: 'אותיות',
  desc: 'למד אות ופתח אותה בעולם הבנייה',
  letters: true,
  start(){
    const r = H.run, q = H.letterQueue(5);
    r.queue = q.slice(); r.total = q.length; r.opened = [];
    H.show('letters'); this.next();
  },
  next(){
    const r = H.run;
    if(!r.queue.length){
      const n = r.opened.length;
      if(n) H.toast('🔓 נפתחו: ' + r.opened.join(' ') + ' בעולם הבנייה', 'level');
      return H.endRound();
    }
    r.letter = r.queue.shift(); r.step = 0; r.okA = false; r.okB = false;
    this.intro();
  },
  /* כרטיס הכרות: שם האות ומילה שמתחילה בה */
  intro(){
    const ch = H.run.letter, info = H.LETTER_INFO[ch];
    H.$('ltq').textContent = 'האות החדשה';
    H.$('ltbody').innerHTML = '<div class="lt-card"><div class="lt-big">' + H.esc(ch) + '</div><div class="lt-name">' + H.esc(info[0]) + '</div>' +
      '<div class="lt-ex"><span>' + info[2] + '</span> ' + H.esc(info[1]) + '</div><button class="go" id="ltgo">הבנתי ▶</button></div>';
    H.$('ltgo').onclick = () => { H.sfx.tap(); this.askA(); };
    setTimeout(() => H.speak(info[0] + '. ' + info[1]), 250);
  },
  /* שאלה א: באיזו אות מתחילה המילה (המילה מוצגת עם התמונה) */
  askA(){
    const ch = H.run.letter, info = H.LETTER_INFO[ch];
    H.$('ltq').textContent = 'באיזו אות מתחילה המילה?';
    this.options('<div class="lt-card"><div class="lt-emoji">' + info[2] + '</div><div class="lt-word">' + H.esc(info[1]) + '</div><button class="mini" id="ltsay">🔊</button></div>', ok => { H.run.okA = ok; this.askB(); });
    H.$('ltsay').onclick = () => H.speak(info[1]);
    setTimeout(() => H.speak(info[1]), 250);
  },
  /* שאלה ב: שומעים את שם האות ובוחרים אותה */
  askB(){
    const ch = H.run.letter, info = H.LETTER_INFO[ch];
    H.$('ltq').textContent = 'איזו אות שמעת?';
    this.options('<div class="lt-card"><button class="lt-ear" id="ltsay">🔊</button></div>', ok => { H.run.okB = ok; this.done(); });
    H.$('ltsay').onclick = () => H.speak(info[0]);
    setTimeout(() => H.speak(info[0]), 250);
  },
  options(head, cb){
    const ch = H.run.letter, opts = H.letterOptions(ch, 3);
    H.$('ltbody').innerHTML = head + '<div class="lt-opts" id="ltopts"></div><div class="fb" id="ltfb"></div>';
    let locked = false;
    opts.forEach(o => {
      const b = H.el('button', 'lt-opt', o);
      b.onclick = () => {
        if(locked) return; locked = true;
        const ok = o === ch;
        if(ok){ b.classList.add('right'); H.sfx.good(); H.$('ltfb').innerHTML = '<span class="ok">🎉 נכון!</span>'; }
        else { b.classList.add('wrongpick'); H.sfx.bad(); [...H.$('ltopts').children].forEach(x => { if(x.textContent === ch) x.classList.add('right'); }); H.$('ltfb').innerHTML = '<span class="no">זו האות הנכונה 👆</span>'; }
        setTimeout(() => cb(ok), ok ? 800 : 1700);
      };
      H.$('ltopts').appendChild(b);
    });
  },
  done(){
    const r = H.run, ch = r.letter, ok = r.okA && r.okB;
    if(ok){
      r.right++; H.limEarn(30);
      if(!H.letterOpenAny(ch)){ H.learnLetter(ch); r.opened.push(ch); H.confetti && H.confetti(30); }
      H.sfx.great && H.sfx.great();
    } else r.wrong++;
    this.next();
  },
  stop(){}
});
