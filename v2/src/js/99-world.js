/* ==========================================================
   האי שלי: עולם תלת־ממדי קטן לטיול.
   WebGL ישיר, בלי ספרייה: מבנים פשוטים (קונוסים, תיבות, כדורים) בגוון שטוח,
   והדמות, החבר והתוויות הם ציורים שטוחים שפונים למצלמה.

   למה כאן: כל מילה שנלמדה גדלה לצמח בגן. כך ההתקדמות נראית, ויש סיבה לחזור
   ולטייל. בטיול מוצאים אבני חן (עד 12 ביום) ותיבת אוצר אחת ביום.
   המשחק "ציד אותיות" משתמש באותו עולם: אוספים בהליכה את אותיות המילה לפי הסדר.
   ========================================================== */
H.WORLD_R = 22;
H.WORLD_GEMS = 12;
H.WORLD_THEMES = {
  day:    {sky:[.62,.82,.96], ground:[.46,.78,.36], water:[.32,.62,.86], leaf:[.30,.65,.30], tint:[1,1,1]},
  sunset: {sky:[1,.78,.62],   ground:[.70,.76,.36], water:[.95,.62,.55], leaf:[.55,.65,.25], tint:[1,.92,.85]},
  forest: {sky:[.70,.90,.72], ground:[.30,.66,.32], water:[.28,.62,.60], leaf:[.18,.52,.25], tint:[.95,1,.95]},
  candy:  {sky:[1,.80,.92],   ground:[.92,.62,.84], water:[.62,.74,1],   leaf:[1,.56,.78],   tint:[1,.96,1]},
  ocean:  {sky:[.50,.80,.96], ground:[.40,.78,.62], water:[.18,.52,.88], leaf:[.22,.62,.45], tint:[.95,1,1]},
  night:  {sky:[.28,.30,.62], ground:[.26,.42,.52], water:[.16,.22,.52], leaf:[.20,.40,.45], tint:[.62,.66,.95]},
  space:  {sky:[.12,.10,.30], ground:[.42,.34,.68], water:[.18,.14,.46], leaf:[.50,.32,.70], tint:[.72,.64,1]}
};

H.world = (function(){
  const R = H.WORLD_R;
  let gl = null, cv = null, progL = null, progS = null, running = false, last = 0;
  let mode = 'explore', S = null, cam = {yaw: .7, pitch: .55, dist: 9};
  const texCache = {}, ptr = new Map();
  let tap = null, pinch = 0;

  /* ---------- מתמטיקה ---------- */
  const M = {
    persp(f, a, n, fa){ const t = 1 / Math.tan(f / 2), o = new Float32Array(16);
      o[0] = t / a; o[5] = t; o[10] = (fa + n) / (n - fa); o[11] = -1; o[14] = 2 * fa * n / (n - fa); return o; },
    look(e, c){
      let zx = e[0]-c[0], zy = e[1]-c[1], zz = e[2]-c[2], l = Math.hypot(zx, zy, zz); zx/=l; zy/=l; zz/=l;
      let xx = zz, xy = 0, xz = -zx; l = Math.hypot(xx, xy, xz); xx/=l; xz/=l;          /* up = (0,1,0) */
      const yx = zy*xz - zz*xy, yy = zz*xx - zx*xz, yz = zx*xy - zy*xx;
      return {m: new Float32Array([xx,yx,zx,0, xy,yy,zy,0, xz,yz,zz,0,
        -(xx*e[0]+xy*e[1]+xz*e[2]), -(yx*e[0]+yy*e[1]+yz*e[2]), -(zx*e[0]+zy*e[1]+zz*e[2]), 1]),
        right:[xx,xy,xz], up:[yx,yy,yz], fwd:[-zx,-zy,-zz]};
    },
    mul(a, b){ const o = new Float32Array(16);
      for(let i = 0; i < 4; i++) for(let j = 0; j < 4; j++){ let s = 0; for(let k = 0; k < 4; k++) s += a[k*4+j] * b[i*4+k]; o[i*4+j] = s; }
      return o; },
    model(x, y, z, sx, sy, sz, ry){ const c = Math.cos(ry||0), s = Math.sin(ry||0);
      return new Float32Array([c*sx,0,-s*sx,0, 0,sy,0,0, s*sz,0,c*sz,0, x,y,z,1]); }
  };
  const rngOf = seed => () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  const hash = s => { let h = 2166136261; for(let i = 0; i < s.length; i++){ h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const hgt = (x, z) => { const r = Math.hypot(x, z);
    const e = Math.max(0, (r - (R - 7)) / 7);
    return .35 * Math.sin(x * .31) * Math.cos(z * .27) + .18 * Math.sin(x * .7 + z * .55) - e * e * 2.2; };

  /* ---------- בניית רשת ---------- */
  function Mesh(rnd){ this.p = []; this.n = []; this.c = []; this.rnd = rnd || Math.random; }
  Mesh.prototype.tri = function(a, b, c, col, o){
    const ux = b[0]-a[0], uy = b[1]-a[1], uz = b[2]-a[2], vx = c[0]-a[0], vy = c[1]-a[1], vz = c[2]-a[2];
    let nx = uy*vz-uz*vy, ny = uz*vx-ux*vz, nz = ux*vy-uy*vx; const l = Math.hypot(nx, ny, nz) || 1; nx/=l; ny/=l; nz/=l;
    const cx = (a[0]+b[0]+c[0])/3, cy = (a[1]+b[1]+c[1])/3, cz = (a[2]+b[2]+c[2])/3;
    const out = o ? (nx*(cx-o[0]) + ny*(cy-o[1]) + nz*(cz-o[2])) >= 0 : ny >= 0;     /* בלי origin: הפנים כלפי מעלה */
    if(!out){ nx = -nx; ny = -ny; nz = -nz; }
    const j = .9 + .2 * this.rnd();
    for(const v of [a, b, c]){ this.p.push(v[0], v[1], v[2]); this.n.push(nx, ny, nz); this.c.push(col[0]*j, col[1]*j, col[2]*j); }
  };
  Mesh.prototype.quad = function(a, b, c, d, col, o){ this.tri(a, b, c, col, o); this.tri(a, c, d, col, o); };
  Mesh.prototype.box = function(cx, cy, cz, sx, sy, sz, col){
    const x0 = cx-sx/2, x1 = cx+sx/2, y0 = cy-sy/2, y1 = cy+sy/2, z0 = cz-sz/2, z1 = cz+sz/2, o = [cx, cy, cz];
    const P = [[x0,y0,z0],[x1,y0,z0],[x1,y1,z0],[x0,y1,z0],[x0,y0,z1],[x1,y0,z1],[x1,y1,z1],[x0,y1,z1]];
    [[0,1,2,3],[4,5,6,7],[0,1,5,4],[3,2,6,7],[0,3,7,4],[1,2,6,5]].forEach(f => this.quad(P[f[0]], P[f[1]], P[f[2]], P[f[3]], col, o));
  };
  Mesh.prototype.cone = function(cx, cy, cz, r, h, seg, col){
    const o = [cx, cy + h * .35, cz], top = [cx, cy + h, cz];
    for(let i = 0; i < seg; i++){
      const a = i / seg * 6.2832, b = (i + 1) / seg * 6.2832;
      this.tri([cx + Math.cos(a)*r, cy, cz + Math.sin(a)*r], [cx + Math.cos(b)*r, cy, cz + Math.sin(b)*r], top, col, o);
    }
  };
  Mesh.prototype.cyl = function(cx, cy, cz, r, h, seg, col){
    const o = [cx, cy + h/2, cz];
    for(let i = 0; i < seg; i++){
      const a = i / seg * 6.2832, b = (i + 1) / seg * 6.2832, ca = Math.cos(a)*r, sa = Math.sin(a)*r, cb = Math.cos(b)*r, sb = Math.sin(b)*r;
      this.quad([cx+ca,cy,cz+sa], [cx+cb,cy,cz+sb], [cx+cb,cy+h,cz+sb], [cx+ca,cy+h,cz+sa], col, o);
      this.tri([cx,cy+h,cz], [cx+ca,cy+h,cz+sa], [cx+cb,cy+h,cz+sb], col, o);
    }
  };
  Mesh.prototype.ball = function(cx, cy, cz, r, col, rings, seg){
    rings = rings || 4; seg = seg || 7; const o = [cx, cy, cz];
    const pt = (i, j) => { const v = i / rings * Math.PI, u = j / seg * 6.2832;
      return [cx + r*Math.sin(v)*Math.cos(u), cy + r*Math.cos(v), cz + r*Math.sin(v)*Math.sin(u)]; };
    for(let i = 0; i < rings; i++) for(let j = 0; j < seg; j++){
      const a = pt(i, j), b = pt(i, j+1), c = pt(i+1, j+1), d = pt(i+1, j);
      if(i === 0) this.tri(a, c, d, col, o); else if(i === rings-1) this.tri(a, b, c, col, o); else this.quad(a, b, c, d, col, o);
    }
  };
  Mesh.prototype.upload = function(){
    const mk = arr => { const b = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(arr), gl.STATIC_DRAW); return b; };
    return {p: mk(this.p), n: mk(this.n), c: mk(this.c), count: this.p.length / 3};
  };

  /* ---------- WebGL ---------- */
  function compile(vs, fs){
    const sh = (t, s) => { const o = gl.createShader(t); gl.shaderSource(o, s); gl.compileShader(o);
      if(!gl.getShaderParameter(o, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(o)); return o; };
    const p = gl.createProgram(); gl.attachShader(p, sh(gl.VERTEX_SHADER, vs)); gl.attachShader(p, sh(gl.FRAGMENT_SHADER, fs)); gl.linkProgram(p);
    if(!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
    return p;
  }
  function initGL(){
    if(gl) return true;
    cv = H.$('worldcv');
    gl = cv.getContext('webgl', {antialias: true, alpha: false}) || cv.getContext('experimental-webgl');
    if(!gl) return false;
    try{
      progL = compile(
        'attribute vec3 p;attribute vec3 n;attribute vec3 c;uniform mat4 vp;uniform mat4 m;uniform vec3 tint;uniform vec3 cam;varying vec3 vc;varying float vd;' +
        'void main(){vec4 w=m*vec4(p,1.);gl_Position=vp*w;vec3 nn=normalize((m*vec4(n,0.)).xyz);float l=max(dot(nn,normalize(vec3(.5,1.,.35))),0.);vc=c*(.58+.5*l)*tint;vd=length(w.xyz-cam);}',
        'precision mediump float;varying vec3 vc;varying float vd;uniform vec3 fog;void main(){float f=clamp((vd-26.)/48.,0.,1.);gl_FragColor=vec4(mix(vc,fog,f),1.);}');
      progS = compile(
        'attribute vec2 q;uniform mat4 vp;uniform vec3 ctr;uniform vec2 sz;uniform vec3 rt;uniform vec3 up;varying vec2 uv;' +
        'void main(){uv=vec2(q.x*.5+.5,.5-q.y*.5);vec3 w=ctr+rt*q.x*sz.x+up*q.y*sz.y;gl_Position=vp*vec4(w,1.);}',
        'precision mediump float;varying vec2 uv;uniform sampler2D tx;void main(){vec4 c=texture2D(tx,uv);if(c.a<.06)discard;gl_FragColor=c;}');
    }catch(e){ console.warn(e); gl = null; return false; }
    gl.enable(gl.DEPTH_TEST); gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    S0.quad = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, S0.quad);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 1,-1, 1,1, -1,-1, 1,1, -1,1]), gl.STATIC_DRAW);
    const cube = new Mesh(() => .5); cube.box(0, 0, 0, 1, 1, 1, [1,1,1]); S0.cube = cube.upload();
    const gem = new Mesh(() => .5);
    const T = [0,.7,0], B = [0,-.7,0], ring = [[.5,0,0],[0,0,.5],[-.5,0,0],[0,0,-.5]];
    for(let i = 0; i < 4; i++){ gem.tri(T, ring[i], ring[(i+1)%4], [1,1,1], [0,0,0]); gem.tri(B, ring[(i+1)%4], ring[i], [1,1,1], [0,0,0]); }
    S0.gem = gem.upload();
    const disc = new Mesh(() => .5);
    for(let i = 0; i < 10; i++){ const a = i/10*6.2832, b = (i+1)/10*6.2832; disc.tri([0,0,0], [Math.cos(a),0,Math.sin(a)], [Math.cos(b),0,Math.sin(b)], [1,1,1]); }
    S0.disc = disc.upload();
    return true;
  }
  const S0 = {};

  function texOf(key, w, h, draw){
    if(texCache[key]) return texCache[key];
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    const x = c.getContext('2d'); x.textAlign = 'center'; x.textBaseline = 'middle'; draw(x, w, h);
    const t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, c);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    return texCache[key] = t;
  }
  const emojiTex = e => texOf('e' + e, 128, 128, (x, w, h) => { x.font = '96px serif'; x.fillText(e, w/2, h/2 + 6); });
  const letterTex = ch => texOf('l' + ch, 128, 128, (x, w, h) => {
    x.fillStyle = '#fff'; x.beginPath(); x.arc(64, 64, 58, 0, 6.2832); x.fill();
    x.fillStyle = '#7c5cd6'; x.beginPath(); x.arc(64, 64, 50, 0, 6.2832); x.fill();
    x.fillStyle = '#fff'; x.font = 'bold 78px "Arial Hebrew",Arial,sans-serif'; x.fillText(ch, 64, 70); });
  const labelTex = t => texOf('t' + t, 256, 64, (x, w, h) => {
    x.fillStyle = 'rgba(255,255,255,.95)'; x.beginPath();
    if(x.roundRect) x.roundRect(4, 6, w - 8, h - 12, 22); else x.rect(4, 6, w - 8, h - 12);
    x.fill(); x.fillStyle = '#2b2250'; x.font = 'bold 34px "Arial Hebrew",Arial,sans-serif'; x.fillText(t, w/2, h/2 + 2); });
  const avatarTex = () => {
    const a = (H.AVATARS.find(v => v.id === H.state.avatar) || H.AVATARS[0]).e;
    const hat = (H.HATS.find(v => v.id === H.state.hat) || {}).e || '';
    return texOf('av' + a + hat, 128, 160, (x, w, h) => { x.font = '88px serif'; x.fillText(a, w/2, 100);
      if(hat){ x.font = '50px serif'; x.fillText(hat, w/2, 30); } });
  };

  /* ---------- בניית הסצנה ---------- */
  function theme(){ return H.WORLD_THEMES[H.state.bg] || H.WORLD_THEMES.day; }
  function plantsOf(){
    const seen = new Set(), out = [];
    H.words().forEach(w => { const k = H.sk(w); if(!seen.has(k)){ seen.add(k); out.push(w); } });
    return out.slice(0, 60);
  }
  function build(){
    const th = theme(), rnd = rngOf(1234), mesh = new Mesh(rnd);
    /* קרקע */
    const g = th.ground;
    for(let gx = -R - 2; gx <= R + 1; gx++) for(let gz = -R - 2; gz <= R + 1; gz++){
      if(Math.hypot(gx + .5, gz + .5) > R + 1.5) continue;
      const a = [gx, hgt(gx, gz), gz], b = [gx+1, hgt(gx+1, gz), gz], c = [gx+1, hgt(gx+1, gz+1), gz+1], d = [gx, hgt(gx, gz+1), gz+1];
      const avg = (a[1] + b[1] + c[1] + d[1]) / 4, sand = Math.hypot(gx + .5, gz + .5) > R - 6.2 || avg < -.25;   /* חול רק בחוף */
      const col = sand ? [.94, .86, .62] : [g[0] * (.92 + .16 * rnd()), g[1] * (.92 + .16 * rnd()), g[2] * (.92 + .16 * rnd())];
      mesh.tri(a, b, c, col); mesh.tri(a, c, d, col);
    }
    /* כיכר במרכז */
    mesh.cyl(0, hgt(0, 0) - .1, 0, 2.2, .35, 14, [.82, .82, .86]);
    mesh.cyl(0, hgt(0, 0) + .25, 0, 1.7, .1, 14, [.95, .92, .8]);
    /* גן: צמח לכל מילה */
    const pl = plantsOf(), plants = [];
    pl.forEach((w, i) => {
      const ang = i * 2.399, rad = 3.6 + Math.sqrt(i) * 1.45, x = Math.cos(ang) * rad, z = Math.sin(ang) * rad, y = hgt(x, z);
      const st = H.stage(w), mastered = H.isEarned(w);
      const hue = hash(H.sk(w)) % 5, blossoms = [[1,.45,.62],[1,.78,.2],[.7,.5,1],[.4,.8,1],[1,.55,.3]][hue];
      mesh.ball(x, y + .08, z, .32, [.45, .32, .2], 3, 6);                                   /* תלולית */
      if(st >= 1) mesh.cone(x, y + .15, z, .12, .55, 5, [.35, .75, .3]);
      if(st >= 2){ mesh.ball(x - .22, y + .42, z, .14, [.3, .7, .3], 3, 5); mesh.ball(x + .22, y + .48, z, .14, [.3, .7, .3], 3, 5); }
      if(st >= 3){ mesh.cyl(x, y + .1, z, .1, .9, 5, [.5, .34, .2]); mesh.ball(x, y + 1.15, z, .55, th.leaf, 3, 6); }
      if(mastered || st >= 4){
        mesh.ball(x, y + 1.5, z, .62, th.leaf, 3, 6);
        for(let k = 0; k < 6; k++) mesh.ball(x + (rnd() - .5) * 1.0, y + 1.4 + rnd() * .7, z + (rnd() - .5) * 1.0, .17, blossoms, 2, 4);
      }
      plants.push({w, x, z, y, st});
    });
    /* עצים, סלעים ופרחים */
    const near = (x, z, d) => plants.some(p => Math.hypot(p.x - x, p.z - z) < d) || Math.hypot(x, z) < 3;
    for(let i = 0; i < 90; i++){
      const a = rnd() * 6.2832, r = 12.5 + rnd() * (R - 17), x = Math.cos(a) * r, z = Math.sin(a) * r, y = hgt(x, z);
      if(y < .08 || near(x, z, 2)) continue;
      mesh.cyl(x, y, z, .16, .8, 5, [.5, .34, .2]);
      mesh.cone(x, y + .6, z, .95, 1.5, 7, th.leaf); mesh.cone(x, y + 1.5, z, .7, 1.2, 7, [th.leaf[0]*1.1, th.leaf[1]*1.1, th.leaf[2]*1.1]);
    }
    for(let i = 0; i < 18; i++){
      const a = rnd() * 6.2832, r = 6 + rnd() * (R - 10), x = Math.cos(a) * r, z = Math.sin(a) * r, y = hgt(x, z);
      if(y < .05 || near(x, z, 1.5)) continue;
      mesh.ball(x, y + .1, z, .3 + rnd() * .35, [.62, .62, .66], 3, 5);
    }
    for(let i = 0; i < 70; i++){
      const a = rnd() * 6.2832, r = 3 + rnd() * (R - 6), x = Math.cos(a) * r, z = Math.sin(a) * r, y = hgt(x, z);
      if(y < .08 || near(x, z, 1.1)) continue;
      mesh.cyl(x, y, z, .025, .28, 4, [.3, .65, .3]);
      mesh.ball(x, y + .33, z, .09, [[1,.5,.6],[1,.85,.3],[.8,.6,1],[1,1,1]][i % 4], 2, 4);
    }
    return {mesh: mesh.upload(), plants};
  }

  /* ---------- מצב הסצנה ---------- */
  function daily(){
    const W = H.state.world || (H.state.world = {d: '', gems: 0, chest: false});
    if(W.d !== H.today()){ W.d = H.today(); W.gems = 0; W.chest = false; }
    return W;
  }
  function spawnExplore(){
    const W = daily(), rnd = rngOf(hash(H.today())), items = [];
    for(let i = 0; i < H.WORLD_GEMS; i++){
      const a = rnd() * 6.2832, r = 4 + rnd() * (R - 9);
      if(i >= W.gems) items.push({type: 'gem', x: Math.cos(a) * r, z: Math.sin(a) * r, ph: rnd() * 6});
    }
    if(!W.chest){ const a = rnd() * 6.2832, r = 9 + rnd() * 7; items.push({type: 'chest', x: Math.cos(a) * r, z: Math.sin(a) * r, ph: 0}); }
    return items;
  }
  function begin(m){
    if(!initGL()) return false;
    mode = m;
    const b = build();
    S = {mesh: b.mesh, plants: b.plants, th: theme(), av: {x: 0, z: 5, tx: 0, tz: 5, moving: false, ph: 0, face: 1},
         pet: {x: 1.4, z: 5.6}, items: m === 'explore' ? spawnExplore() : [], wild: [], clouds: [], label: null, t: 0,
         need: [], idx: 0, miss: 0, lastWrong: -9, onDone: null};
    const rnd = rngOf(77);
    for(let i = 0; i < 7; i++) S.wild.push({e: ['🦋','🐝','🦋','🐞','🦋','🐦','🦋'][i], a: rnd() * 6.2832, r: 4 + rnd() * 12, sp: .15 + rnd() * .25, h: 1.2 + rnd() * 1.4, ph: rnd() * 6});
    for(let i = 0; i < 6; i++) S.clouds.push({x: (rnd() - .5) * 60, z: (rnd() - .5) * 60, y: 13 + rnd() * 4, s: 4 + rnd() * 3});
    renderHud();
    if(!running){ running = true; last = performance.now(); requestAnimationFrame(frame); }
    return true;
  }
  function end(){ running = false; if(H.state.world) H.save(); }

  /* ---------- ציד אותיות ---------- */
  function hunt(word, onDone){
    const need = H.clusters(word).filter(c => c !== ' ');
    const extra = []; let guard = 0;
    while(extra.length < 3 && guard++ < 80){ const c = H.randTile(true); if(!need.includes(c) && !extra.includes(c)) extra.push(c); }
    const all = need.concat(extra), spots = [];
    S.items = []; S.need = need; S.idx = 0; S.miss = 0; S.onDone = onDone; S.word = word;
    all.forEach(ch => {
      let x, z, tries = 0;
      do{ const a = Math.random() * 6.2832, r = 5 + Math.random() * (R - 11); x = Math.cos(a) * r; z = Math.sin(a) * r; tries++; }
      while(tries < 60 && (spots.some(s => Math.hypot(s[0] - x, s[1] - z) < 3.4) || Math.hypot(S.av.x - x, S.av.z - z) < 4));
      spots.push([x, z]); S.items.push({type: 'letter', ch, x, z, ph: Math.random() * 6, shake: 0});
    });
    renderHud();
  }
  function renderHud(){
    const box = H.$('worldhud'); if(!box) return;
    if(mode === 'hunt' && S){
      box.innerHTML = '<div class="wh-word">' + S.need.map((c, i) => '<span class="' + (i < S.idx ? 'got' : (i === S.idx ? 'now' : '')) + '">' + (i < S.idx ? H.esc(c) : '▢') + '</span>').join('') + '</div>' +
        '<div class="wh-sub">אסוף את האותיות לפי הסדר · <button class="mini" data-say>🔊 שמע</button></div>';
      box.querySelectorAll('[data-say]').forEach(b => b.onclick = () => H.say(S.word));
    } else {
      const W = daily();
      box.innerHTML = '<div class="wh-sub">💎 ' + W.gems + '/' + H.WORLD_GEMS + ' היום · ' + (W.chest ? '🎁 התיבה נפתחה' : '🎁 תיבת אוצר מחכה באי') + ' · 🌱 ' + S.plants.filter(p => p.st >= 3).length + '/' + S.plants.length + ' גדלו</div>' +
        '<div class="wh-sub">לחץ על האדמה כדי ללכת · גרור כדי להסתובב</div>';
    }
  }

  /* ---------- עדכון ---------- */
  function update(dt){
    S.t += dt; const av = S.av;
    if(av.moving){
      const dx = av.tx - av.x, dz = av.tz - av.z, d = Math.hypot(dx, dz);
      if(d < .08) av.moving = false;
      else { const st = Math.min(d, 4.6 * dt); av.x += dx / d * st; av.z += dz / d * st; av.ph += dt * 11; if(Math.abs(dx) > .05) av.face = dx > 0 ? 1 : -1; }
    }
    const rr = Math.hypot(av.x, av.z), lim = R - 3.6;
    if(rr > lim){ av.x *= lim / rr; av.z *= lim / rr; }
    const pd = Math.hypot(av.x - S.pet.x, av.z - S.pet.z);
    if(pd > 1.5){ const k = Math.min(1, dt * 3.2); S.pet.x += (av.x - S.pet.x) * k * (1 - 1.3 / pd); S.pet.z += (av.z - S.pet.z) * k * (1 - 1.3 / pd); }
    S.wild.forEach(w => { w.a += w.sp * dt; });
    /* קרבה לצמח: תווית עם המילה */
    let near = null, nd = 2.2;
    S.plants.forEach(p => { const d = Math.hypot(p.x - av.x, p.z - av.z); if(d < nd){ nd = d; near = p; } });
    if(near && (!S.label || S.label.p !== near)){ S.label = {p: near}; H.speak(near.w); }
    if(!near) S.label = null;
    /* פריטים */
    for(let i = S.items.length - 1; i >= 0; i--){
      const it = S.items[i], d = Math.hypot(it.x - av.x, it.z - av.z);
      if(it.shake > 0) it.shake -= dt;
      if(it.type === 'gem' && d < 1.1){
        const W = daily();
        if(W.gems < H.WORLD_GEMS){ W.gems++; H.state.coins += 1; H.saveQuiet(); H.paint(); H.toast('💎 +1', 'good'); }
        S.items.splice(i, 1); renderHud();
      } else if(it.type === 'chest' && d < 1.6){
        const W = daily(), bonus = 15 + Math.floor(Math.random() * 26);
        W.chest = true; H.state.coins += bonus; H.save(); H.paint(); H.confetti && H.confetti(40);
        H.toast('🎁 תיבת אוצר: +' + bonus + ' מטבעות!', 'level');
        S.items.splice(i, 1); renderHud();
      } else if(it.type === 'letter' && d < 1.3){
        if(it.ch === S.need[S.idx]){
          S.items.splice(i, 1); S.idx++; renderHud();
          if(S.idx >= S.need.length){ const cb = S.onDone, ok = S.miss <= 2; S.items = []; S.onDone = null; H.speak(S.word); if(cb) setTimeout(() => cb(ok), 900); }
        } else if(S.t - S.lastWrong > .9){ S.lastWrong = S.t; S.miss++; it.shake = .5; }
      }
    }
  }

  /* ---------- ציור ---------- */
  function camera(){
    const av = S.av, cp = Math.cos(cam.pitch), ey = Math.sin(cam.pitch) * cam.dist + 1.2;
    const eye = [av.x + Math.sin(cam.yaw) * cp * cam.dist, ey, av.z + Math.cos(cam.yaw) * cp * cam.dist];
    const asp = cv.width / cv.height, proj = M.persp(1.0, asp, .3, 120), look = M.look(eye, [av.x, 1, av.z]);
    return {eye, vp: M.mul(proj, look.m), right: look.right, up: look.up, fwd: look.fwd, asp};
  }
  function drawBuf(buf, mat, tint, prog){
    const loc = n => gl.getAttribLocation(prog, n);
    [['p', buf.p, 3], ['n', buf.n, 3], ['c', buf.c, 3]].forEach(a => {
      const l = loc(a[0]); gl.bindBuffer(gl.ARRAY_BUFFER, a[1]); gl.enableVertexAttribArray(l); gl.vertexAttribPointer(l, a[2], gl.FLOAT, false, 0, 0); });
    gl.uniformMatrix4fv(gl.getUniformLocation(prog, 'm'), false, mat); gl.uniform3fv(gl.getUniformLocation(prog, 'tint'), tint);
    gl.drawArrays(gl.TRIANGLES, 0, buf.count);
  }
  const ID = M.model(0, 0, 0, 1, 1, 1, 0);
  function sprite(c, tx, x, y, z, w, h){
    gl.uniform3f(gl.getUniformLocation(progS, 'ctr'), x, y, z); gl.uniform2f(gl.getUniformLocation(progS, 'sz'), w / 2, h / 2);
    gl.bindTexture(gl.TEXTURE_2D, tx); gl.drawArrays(gl.TRIANGLES, 0, 6);
  }
  function draw(){
    const w = Math.round(cv.clientWidth * Math.min(2, window.devicePixelRatio || 1)), h = Math.round(cv.clientHeight * Math.min(2, window.devicePixelRatio || 1));
    if(cv.width !== w || cv.height !== h){ cv.width = w; cv.height = h; }
    gl.viewport(0, 0, cv.width, cv.height);
    const th = S.th; gl.clearColor(th.sky[0], th.sky[1], th.sky[2], 1); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    const c = camera(); S.cam = c;
    gl.useProgram(progL);
    gl.uniformMatrix4fv(gl.getUniformLocation(progL, 'vp'), false, c.vp); gl.uniform3fv(gl.getUniformLocation(progL, 'cam'), c.eye); gl.uniform3fv(gl.getUniformLocation(progL, 'fog'), th.sky);
    /* מים */
    const wcol = new Float32Array([th.water[0] * (.95 + .05 * Math.sin(S.t * 1.3)), th.water[1], th.water[2]]);
    drawBuf(S0.disc, M.model(0, -.5, 0, 140, 1, 140, 0), wcol, progL);
    drawBuf(S.mesh, ID, new Float32Array(th.tint), progL);
    /* פריטים תלת־ממדיים */
    const tint = new Float32Array(3);
    S.items.forEach(it => {
      const y = hgt(it.x, it.z), bob = Math.sin(S.t * 2 + it.ph) * .12;
      if(it.type === 'gem'){ tint.set([.35, .9, 1]); drawBuf(S0.gem, M.model(it.x, y + .8 + bob, it.z, .55, .55, .55, S.t * 1.6), tint, progL); }
      else if(it.type === 'letter'){ const sh = it.shake > 0 ? Math.sin(S.t * 60) * .1 : 0; tint.set([1, .82, .25]);
        drawBuf(S0.cube, M.model(it.x + sh, y + .7 + bob, it.z, .9, .9, .9, S.t * .8), tint, progL); }
      else if(it.type === 'chest'){ tint.set([.62, .4, .2]); drawBuf(S0.cube, M.model(it.x, y + .4, it.z, 1.1, .8, .8, 0), tint, progL);
        tint.set([1, .8, .2]); drawBuf(S0.cube, M.model(it.x, y + .95 + bob * .5, it.z, 1.15, .22, .85, 0), tint, progL); }
    });
    /* צל */
    tint.set([th.ground[0] * .55, th.ground[1] * .55, th.ground[2] * .55]);
    drawBuf(S0.disc, M.model(S.av.x, hgt(S.av.x, S.av.z) + .03, S.av.z, .7, 1, .55, 0), tint, progL);
    drawBuf(S0.disc, M.model(S.pet.x, hgt(S.pet.x, S.pet.z) + .03, S.pet.z, .4, 1, .32, 0), tint, progL);
    /* ציורים שטוחים שפונים למצלמה */
    gl.useProgram(progS);
    gl.uniformMatrix4fv(gl.getUniformLocation(progS, 'vp'), false, c.vp);
    gl.uniform3fv(gl.getUniformLocation(progS, 'rt'), c.right); gl.uniform3fv(gl.getUniformLocation(progS, 'up'), c.up);
    const ql = gl.getAttribLocation(progS, 'q'); gl.bindBuffer(gl.ARRAY_BUFFER, S0.quad); gl.enableVertexAttribArray(ql); gl.vertexAttribPointer(ql, 2, gl.FLOAT, false, 0, 0);
    const list = [], push = (d, f) => list.push({d, f});
    const dist = (x, y, z) => Math.hypot(x - c.eye[0], y - c.eye[1], z - c.eye[2]);
    S.clouds.forEach(cl => push(dist(cl.x, cl.y, cl.z), () => sprite(c, emojiTex('☁️'), cl.x + Math.sin(S.t * .05 + cl.z) * 3, cl.y, cl.z, cl.s * 2, cl.s * 2)));
    S.wild.forEach(wd => { const x = Math.cos(wd.a) * wd.r, z = Math.sin(wd.a) * wd.r, y = hgt(x, z) + wd.h + Math.sin(S.t * 3 + wd.ph) * .15;
      push(dist(x, y, z), () => sprite(c, emojiTex(wd.e), x, y, z, .8, .8)); });
    S.plants.forEach(p => { const y = p.y + (p.st >= 4 || H.isEarned(p.w) ? 2.6 : (p.st >= 3 ? 1.9 : 1.1));
      if(S.label && S.label.p === p) push(dist(p.x, y, p.z) - 3, () => sprite(c, labelTex(H.disp(p.w)), p.x, y, p.z, 2.6, .65)); });
    S.items.forEach(it => { const y = hgt(it.x, it.z) + 1.9 + Math.sin(S.t * 2 + it.ph) * .12;
      if(it.type === 'letter') push(dist(it.x, y, it.z) - 1, () => sprite(c, letterTex(it.ch), it.x, y, it.z, 1.15, 1.15));
      if(it.type === 'chest') push(dist(it.x, y, it.z), () => sprite(c, emojiTex('🎁'), it.x, hgt(it.x, it.z) + 1.9, it.z, 1, 1)); });
    const av = S.av, ay = hgt(av.x, av.z) + 1.05 + (av.moving ? Math.abs(Math.sin(av.ph)) * .25 : Math.sin(S.t * 2) * .03);
    push(dist(av.x, ay, av.z), () => sprite(c, avatarTex(), av.x, ay, av.z, 1.6, 2));
    const pet = (H.PETS.find(p => p.id === H.state.pet) || {}).e;
    if(pet) push(dist(S.pet.x, 0, S.pet.z), () => sprite(c, emojiTex(pet), S.pet.x, hgt(S.pet.x, S.pet.z) + .5 + (av.moving ? Math.abs(Math.sin(av.ph + 1)) * .15 : 0), S.pet.z, .9, .9));
    list.sort((a, b) => b.d - a.d).forEach(o => o.f());
  }
  function frame(ts){
    if(!running) return;
    if(H.screen !== 'world'){ running = false; return; }
    const dt = Math.min(.05, (ts - last) / 1000); last = ts;
    try{ update(dt); draw(); }catch(e){ console.warn(e); running = false; return; }
    requestAnimationFrame(frame);
  }

  /* ---------- קלט ---------- */
  function groundHit(clientX, clientY){
    const r = cv.getBoundingClientRect(), nx = (clientX - r.left) / r.width * 2 - 1, ny = 1 - (clientY - r.top) / r.height * 2;
    const c = S.cam, t = Math.tan(.5), d = [0, 0, 0];
    for(let i = 0; i < 3; i++) d[i] = c.fwd[i] + c.right[i] * nx * t * c.asp + c.up[i] * ny * t;
    if(d[1] >= -.01) return null;
    const k = (.15 - c.eye[1]) / d[1];
    return [c.eye[0] + d[0] * k, c.eye[2] + d[2] * k];
  }
  function bind(){
    if(bind.done) return; bind.done = true;
    cv.addEventListener('pointerdown', e => {
      cv.setPointerCapture(e.pointerId); ptr.set(e.pointerId, {x: e.clientX, y: e.clientY});
      tap = ptr.size === 1 ? {x: e.clientX, y: e.clientY, t: performance.now(), moved: false} : null;
      if(ptr.size === 2){ const [a, b] = [...ptr.values()]; pinch = Math.hypot(a.x - b.x, a.y - b.y); }
    });
    cv.addEventListener('pointermove', e => {
      const p = ptr.get(e.pointerId); if(!p) return;
      const dx = e.clientX - p.x, dy = e.clientY - p.y; p.x = e.clientX; p.y = e.clientY;
      if(ptr.size === 2){ const [a, b] = [...ptr.values()], d = Math.hypot(a.x - b.x, a.y - b.y); if(pinch) cam.dist = clamp(cam.dist * pinch / d, 5, 16); pinch = d; return; }
      if(tap && Math.hypot(e.clientX - tap.x, e.clientY - tap.y) > 8) tap.moved = true;
      if(tap && tap.moved){ cam.yaw -= dx * .008; cam.pitch = clamp(cam.pitch + dy * .005, .25, 1.15); }
    });
    const up = e => {
      ptr.delete(e.pointerId); pinch = 0;
      if(tap && !tap.moved && performance.now() - tap.t < 400 && S){
        const hit = groundHit(e.clientX, e.clientY);
        if(hit){ S.av.tx = hit[0]; S.av.tz = hit[1]; S.av.moving = true; }
      }
      tap = null;
    };
    cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
    cv.addEventListener('wheel', e => { e.preventDefault(); cam.dist = clamp(cam.dist + e.deltaY * .01, 5, 16); }, {passive: false});
  }

  return {
    supported(){ return initGL(); },
    open(m){ if(!initGL()) return false; bind(); return begin(m || 'explore'); },
    hunt, end, state: () => S
  };
})();

/* ---------- כניסות ---------- */
H.openWorld = function(){
  H.run = {origin: 'home', game: null, word: null, right: 0, wrong: 0, total: 0, queue: []};
  H.show('world');
  if(!H.world.open('explore')){ H.toast('הדפדפן הזה לא תומך בתלת־ממד'); H.home(); }
};
H.renderWorldBtn = function(){
  const b = H.$('worldbtn'); if(!b) return;
  const W = H.state.world, fresh = !W || W.d !== H.today() || !W.chest;
  b.innerHTML = '<span class="m-e">🏝️</span><b>האי שלי</b><small>' + (fresh ? 'תיבת אוצר מחכה לך 🎁' : 'הגן שלך גדל עם כל מילה') + '</small>';
};

/* משחק: ציד אותיות */
H.game({
  id:'hunt', e:'🏝️', name:'ציד אותיות',
  desc:'טייל באי ואסוף את האותיות',
  start(){
    H.show('world');
    if(!H.world.open('hunt')){ H.toast('הדפדפן הזה לא תומך בתלת־ממד'); return H.home(); }
    this.next();
  },
  next(){
    const w = H.nextWord();
    if(!w){ H.world.end(); return H.endRound(); }
    H.world.hunt(w, ok => { if(ok) H.right(); else H.wrong(); this.next(); });
    setTimeout(() => H.say(w), 300);
  },
  stop(){ H.world.end(); }
});
