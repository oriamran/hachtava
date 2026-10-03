/* ==========================================================
   הדגמה מפורקת: מדגישים את המילה בלוקים של אות+ניקוד, אחד אחרי השני,
   ומקריאים כל בלוק. אחרי זה המילה השלמה.

   למה: במחקר על משחק איות דיגיטלי בעברית (Elimelech & Aram, 2019, גן חובה),
   המשוב שעזר הכי הרבה היה פירוק המילה לצלילים לפי הכתיב העברי וחיבור כל צליל
   לאות שלו. הבלוק של אות עם תנועה הוא יחידת ההוראה המקובלת בעברית.
   המחקר בגיל צעיר יותר מזה של המשחק, ובלי קול עברי במכשיר נשאר רק החלק החזותי.
   ========================================================== */
H.SEG_MS = 650;
H.segmentMs = w => H.clusters(w).filter(c => c !== ' ').length * H.SEG_MS + 700;

/* box: אלמנט שבו מציגים. מחזיר פונקציית ביטול. */
H.segmentShow = function(word, box){
  const parts = H.clusters(word).filter(c => c !== ' ');
  box.innerHTML = '<span class="seg">' + parts.map(c => '<b>' + H.esc(c) + '</b>').join('') + '</span>';
  const els = box.querySelectorAll('.seg b');
  let i = 0, timers = [];
  const step = () => {
    els.forEach((e, k) => e.classList.toggle('on', k === i));
    if(i < parts.length){
      H.speak(parts[i]);
      i++;
      timers.push(setTimeout(step, H.SEG_MS));
    } else {
      els.forEach(e => e.classList.add('on'));
      H.speak(word);
    }
  };
  timers.push(setTimeout(step, 250));
  return () => timers.forEach(clearTimeout);
};
