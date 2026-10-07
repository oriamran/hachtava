/* ==========================================================
   אתגר היום. פעם ביום, שלוש מילים, ומשחק אחד שמשתנה כל יום.
   הסיבה לקיומו היא לא תרגול נוסף אלא סיבה לחזור מחר.
   ========================================================== */
H.CHALLENGE_WORDS = 3;

H.challengeDone = () => H.state.daily.chal === H.today();
/* אותו משחק לכל המכשירים באותו יום, ומשתנה מיום ליום */
H.challengeGame = function(){
  const d = H.today();
  let h = 0;
  for(let i = 0; i < d.length; i++) h = (h * 31 + d.charCodeAt(i)) >>> 0;
  const ws = H.words().map(H.disp);
  const pool = H.GAMES.filter(g => !g.adult && !g.letters && (!g.canPlay || g.canPlay(ws)));
  return pool[h % pool.length];
};
H.startChallenge = function(){
  if(H.challengeDone()) return H.toast('אתגר היום כבר הושלם — חזור מחר 🌞');
  if(H.needWords()) return;
  const g = H.challengeGame();
  H.run = {game:g, station:undefined, challenge:true,
           queue:H.pickWords(H.CHALLENGE_WORDS), total:0, right:0, wrong:0, word:null};
  H.run.total = H.run.queue.length;
  H.logStart();
  g.start();
};
H.finishChallenge = function(){
  const r = H.run, stars = H.stars(), perfect = r.wrong === 0;
  H.state.daily.chal = H.today();
  H.save();
  H.finish({
    emoji: perfect ? '🏆' : '🎯',
    title: perfect ? 'אתגר היום הושלם!' : 'סיימת את אתגר היום',
    text: 'נכון ' + r.right + ' מתוך ' + r.total +
          '<br>חזור מחר לאתגר חדש 🌞',
    stars,
    xp: 60 + r.right * 10 + (perfect ? 40 : 0)
  });
  H.confetti(50);
};
H.renderChallenge = function(){
  const b = H.$('chalbtn');
  if(!b) return;
  const done = H.challengeDone(), g = H.challengeGame();
  b.classList.toggle('done', done);
  b.innerHTML = '<span class="m-e">' + (done ? '✅' : '🎯') + '</span>' +
    '<b>' + (done ? 'אתגר היום הושלם' : 'אתגר היום') + '</b>' +
    '<small>' + (done
      ? 'חזור מחר למשחק אחר'
      : g.e + ' ' + g.name + ' · ' + H.CHALLENGE_WORDS + ' מילים · בונוס גדול') + '</small>';
};
