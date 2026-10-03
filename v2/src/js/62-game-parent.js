/* ========== 9. הכתבה עם הורה: כותבים במחברת, ההורה בודק ==========
   הילד כותב על נייר, וההורה מסתכל ולוחץ נכון או טעות. זה קרוב להכתבה בכיתה,
   מתאים לכתיבה ביד (שנתמכת במחקר), ולא תלוי בזיהוי כתב של האפליקציה. */
H.game({
  id:'parent', e:'👨‍👩‍👧', name:'הכתבה עם הורה',
  desc:'כותבים במחברת, ההורה בודק',
  adult:true,                                    /* צריך מבוגר, לא נכנס לאתגר היומי */
  start(){ H.show('parent'); this.next(); },
  next(){
    const w = H.nextWord();
    if(!w) return H.endRound();
    H.run.revealed = false;
    H.$('parentword').textContent = '';
    H.$('parentword').style.display = 'none';
    H.$('parentmark').style.display = 'none';
    H.$('parentreveal').style.display = '';
    H.$('parentn').textContent = (H.run.total - H.run.queue.length) + ' / ' + H.run.total;
    setTimeout(() => H.say(w), 300);
  },
  reveal(){
    const r = H.run;
    if(!r.word || r.revealed) return;
    r.revealed = true; H.sfx.tap();
    H.$('parentword').textContent = r.word;
    H.$('parentword').style.display = '';
    H.$('parentreveal').style.display = 'none';
    H.$('parentmark').style.display = '';
  },
  mark(ok){
    const r = H.run;
    if(!r.word || !r.revealed) return;
    r.revealed = false;                           /* מונע לחיצה כפולה */
    if(ok) H.right(); else H.wrong();
    setTimeout(() => this.next(), 350);
  }
});
