/* ==========================================================
   מסך ראשון: שם ודמות. רץ פעם אחת, לפני שהילד רואה משהו אחר.
   ========================================================== */
H.needsOnboard = () => !H.state.onboarded;

H.renderOnboard = function(){
  const box = H.$('ob-avatars');
  box.innerHTML = '';
  H.AVATARS.filter(a => a.cost === 0).forEach(a => {
    const el = H.el('button', 'obav' + (H.state.avatar === a.id ? ' on' : ''),
                    '<span class="obav-e">' + a.e + '</span><b>' + a.name + '</b>');
    el.onclick = () => { H.sfx.tap(); H.state.avatar = a.id; H.renderOnboard(); H.paint(); };
    box.appendChild(el);
  });
  const rings = H.$('ob-rings');
  rings.innerHTML = '';
  H.RINGS.filter(r => r.cost === 0).forEach(r => {
    const el = H.el('button', 'obring' + (H.state.ring === r.id ? ' on' : ''));
    el.style.background = r.css;
    el.onclick = () => { H.sfx.tap(); H.state.ring = r.id; H.renderOnboard(); H.paint(); };
    rings.appendChild(el);
  });
};
H.startOnboard = function(){
  H.renderOnboard();
  H.$('ob-name').value = H.state.name || '';
  H.show('onboard');
  H.$('backbtn').classList.remove('on');     /* אין לאן לחזור */
};
H.finishOnboard = function(){
  H.state.name = H.$('ob-name').value.trim();
  H.state.onboarded = true;
  H.save();
  H.sfx.great(); H.confetti(28);
  H.refresh(); H.show('home');
};
