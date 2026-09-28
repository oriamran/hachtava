/* ==========================================================
   קול: הקראה בעברית + אפקטים מסונתזים (בלי קבצים)
   ========================================================== */
H.voice = null;
H.useAudio = true;

H.initVoice = function(){
  const vs = speechSynthesis.getVoices();
  H.voice = vs.find(v => /^he/i.test(v.lang)) || null;
  if(!H.voice && vs.length) H.useAudio = false;
};
speechSynthesis.onvoiceschanged = H.initVoice;

H.speak = function(t){
  if(!H.useAudio || !t) return;
  try{
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(t);
    u.lang = 'he-IL'; u.rate = .8; u.pitch = 1.05;
    if(H.voice) u.voice = H.voice;
    speechSynthesis.speak(u);
  }catch(e){}
};

/* ---- אפקטים ---- */
H.actx = null;
H.ac = function(){
  if(!H.actx){
    try{ H.actx = new (window.AudioContext || window.webkitAudioContext)(); }catch(e){}
  }
  if(H.actx && H.actx.state === 'suspended') H.actx.resume();
  return H.actx;
};
H.tone = function(freq, dur, type, vol, delay){
  const c = H.ac(); if(!c) return;
  const t0 = c.currentTime + (delay || 0);
  const o = c.createOscillator(), g = c.createGain();
  o.type = type || 'sine'; o.frequency.setValueAtTime(freq, t0);
  g.gain.setValueAtTime(0, t0);
  g.gain.linearRampToValueAtTime(vol || 0.18, t0 + 0.015);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.connect(g); g.connect(c.destination);
  o.start(t0); o.stop(t0 + dur + 0.02);
};
H.sfx = {
  tap:   () => H.tone(520, .07, 'triangle', .10),
  good:  () => { H.tone(660, .12, 'sine', .16, 0); H.tone(880, .16, 'sine', .14, .09); },
  great: () => [523,659,784,1047].forEach((f,i) => H.tone(f, .18, 'sine', .15, i*0.075)),
  bad:   () => { H.tone(220, .18, 'sawtooth', .10); H.tone(165, .22, 'sawtooth', .08, .08); },
  coin:  () => { H.tone(988, .07, 'square', .10); H.tone(1319, .12, 'square', .09, .06); },
  level: () => [392,523,659,784,1047].forEach((f,i) => H.tone(f, .22, 'triangle', .16, i*0.09))
};
