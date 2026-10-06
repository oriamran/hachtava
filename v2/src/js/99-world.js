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
  let gl = null, cv = null, progL = null, progS = null, progB = null, running = false, last = 0;
  let mode = 'explore', S = null, cam = {yaw: .7, pitch: .55, dist: 9}, lastPos = null, qual = 1;
  const keys = {}, stick = {x: 0, y: 0, id: null};
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
  /* גבעות בין השערים, כיכר ושטחי שערים שטוחים, וירידה אל המים בקצה האי */
  const smooth = (a, b, v) => { const t = clamp((v - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
  let HILLS = [], PADS = [];
  function prepareTerrain(){
    const n = H.GAMES.length, rnd = rngOf(4242); PADS = []; HILLS = [];
    for(let i = 0; i < n; i++){
      const a = i / n * 6.2832 + .3;
      PADS.push({x: Math.cos(a) * 16, z: Math.sin(a) * 16});
      const m = a + 3.1416 / n, r = 14 + rnd() * 3;
      HILLS.push({x: Math.cos(m) * r, z: Math.sin(m) * r, h: 2.4 + rnd() * 2.6, s: 2.8 + rnd() * 1.8});
    }
  }
  const hgt = (x, z) => {
    const r = Math.hypot(x, z);
    let h = .28 * Math.sin(x * .31) * Math.cos(z * .27) + .14 * Math.sin(x * .7 + z * .55);
    let hill = 0;
    for(let i = 0; i < HILLS.length; i++){ const q = HILLS[i], d2 = ((x - q.x) * (x - q.x) + (z - q.z) * (z - q.z)) / (q.s * q.s); if(d2 < 12) hill += q.h * Math.exp(-d2); }
    let flat = smooth(8, 12, r);
    for(let i = 0; i < PADS.length; i++){ const d = Math.hypot(x - PADS[i].x, z - PADS[i].z); if(d < 6) flat = Math.min(flat, smooth(2.4, 5.8, d)); }
    h += hill * flat;
    const e = Math.max(0, (r - (R - 7)) / 7);
    return h - e * e * 2.4;
  };

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
        'attribute vec3 p;attribute vec3 n;attribute vec3 c;uniform mat4 vp;uniform mat4 m;uniform vec3 tint;uniform vec3 cam;uniform float t;uniform float wv;varying vec3 vc;varying float vd;' +
        'void main(){vec4 w=m*vec4(p,1.);w.y+=wv*(sin(w.x*.33+t*1.1)+sin(w.z*.41+t*.8))*.5;gl_Position=vp*w;vec3 nn=normalize((m*vec4(n,0.)).xyz);' +
        'float l=max(dot(nn,normalize(vec3(.55,.8,.3))),0.);float hemi=.5+.5*nn.y;float ao=.82+.18*clamp((w.y+1.)/5.,0.,1.);' +
        'vc=c*(.30+.34*hemi+.62*l)*ao*tint;vd=length(w.xyz-cam);}',
        'precision mediump float;varying vec3 vc;varying float vd;uniform vec3 fog;void main(){float f=clamp((vd-18.)/92.,0.,1.);f=f*f*(3.-2.*f);gl_FragColor=vec4(mix(vc,fog,f),1.);}');
      progB = compile('attribute vec2 q;varying float y;void main(){y=q.y;gl_Position=vec4(q,.999,1.);}',
        'precision mediump float;varying float y;uniform vec3 hz;uniform vec3 zn;uniform float hy;void main(){float u=clamp((y-hy)/max(.05,1.-hy),0.,1.);u=pow(u,.7);gl_FragColor=vec4(mix(hz,zn,u),1.);}');
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
    return out.slice(0, 40);
  }
  function build(){
    const th = theme(), rnd = rngOf(1234), mesh = new Mesh(rnd), STEP = .75;
    const g = th.ground, rock = [.60, .58, .56];
    const mix3 = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
    const blob = (x, z, r) => {            /* צל עגול על הקרקע */
      const y = hgt(x, z) + .05, c = [g[0] * .55, g[1] * .55, g[2] * .55];
      for(let i = 0; i < 8; i++){ const a = i / 8 * 6.2832, b = (i + 1) / 8 * 6.2832;
        mesh.tri([x, y, z], [x + Math.cos(a) * r, hgt(x + Math.cos(a) * r, z + Math.sin(a) * r) + .05, z + Math.sin(a) * r], [x + Math.cos(b) * r, hgt(x + Math.cos(b) * r, z + Math.sin(b) * r) + .05, z + Math.sin(b) * r], c); }
    };
    /* קרקע: דשא, חול בחוף, סלע בפסגות */
    const N = Math.ceil((2 * R + 4) / STEP);
    for(let i = 0; i < N; i++) for(let j = 0; j < N; j++){
      const gx = -R - 2 + i * STEP, gz = -R - 2 + j * STEP;
      if(Math.hypot(gx + STEP / 2, gz + STEP / 2) > R + 1.5) continue;
      const a = [gx, hgt(gx, gz), gz], b = [gx + STEP, hgt(gx + STEP, gz), gz], c = [gx + STEP, hgt(gx + STEP, gz + STEP), gz + STEP], d = [gx, hgt(gx, gz + STEP), gz + STEP];
      const avg = (a[1] + b[1] + c[1] + d[1]) / 4, rr = Math.hypot(gx + STEP / 2, gz + STEP / 2);
      const jit = .92 + .16 * rnd();
      let col = [g[0] * jit * (1 + Math.max(0, avg) * .05), g[1] * jit * (1 + Math.max(0, avg) * .045), g[2] * jit];
      if(avg > 2.3) col = mix3(col, rock, clamp((avg - 2.3) / 1.2, 0, 1));
      if(rr > R - 6.2 || avg < -.25) col = [.94 * jit, .86 * jit, .62 * jit];
      else if(rr > R - 7.4) col = mix3(col, [.94, .86, .62], .5);
      mesh.tri(a, b, c, col); mesh.tri(a, c, d, col);
    }
    /* כיכר ומגדל המילים במרכז: ציון דרך שרואים מרחוק */
    const cy = hgt(0, 0);
    mesh.cyl(0, cy - .1, 0, 2.4, .4, 16, [.82, .82, .86]);
    mesh.cyl(0, cy + .3, 0, 1.9, .1, 16, [.95, .92, .8]);
    mesh.cyl(0, cy + .4, 0, 1.0, 2.6, 8, [.88, .85, .95]);
    mesh.cyl(0, cy + 2.9, 0, .74, 2.0, 8, [.78, .74, .92]);
    mesh.cyl(0, cy + 4.8, 0, .5, 1.5, 8, [.68, .62, .9]);
    mesh.ball(0, cy + 6.9, 0, .7, [1, .82, .25], 4, 8);
    /* גן: צמח לכל מילה */
    const pl = plantsOf(), plants = [];
    pl.forEach((w, i) => {
      const ang = i * 2.399, rad = 3.9 + Math.sqrt(i) * 1.4, x = Math.cos(ang) * rad, z = Math.sin(ang) * rad, y = hgt(x, z);
      const st = H.stage(w), mastered = H.isEarned(w);
      const hue = hash(H.sk(w)) % 5, blossoms = [[1,.45,.62],[1,.78,.2],[.7,.5,1],[.4,.8,1],[1,.55,.3]][hue];
      blob(x, z, st >= 3 ? 1.1 : .6);
      mesh.ball(x, y + .08, z, .32, [.45, .32, .2], 3, 6);
      if(st >= 1) mesh.cone(x, y + .15, z, .12, .55, 5, [.35, .75, .3]);
      if(st >= 2){ mesh.ball(x - .22, y + .42, z, .14, [.3, .7, .3], 3, 5); mesh.ball(x + .22, y + .48, z, .14, [.3, .7, .3], 3, 5); }
      if(st >= 3){ mesh.cyl(x, y + .1, z, .1, .9, 5, [.5, .34, .2]); mesh.ball(x, y + 1.15, z, .55, th.leaf, 3, 6); }
      if(mastered || st >= 4){
        mesh.ball(x, y + 1.5, z, .62, th.leaf, 3, 6);
        for(let k = 0; k < 6; k++) mesh.ball(x + (rnd() - .5) * 1.0, y + 1.4 + rnd() * .7, z + (rnd() - .5) * 1.0, .17, blossoms, 2, 4);
      }
      plants.push({w, x, z, y, st});
    });
    /* שערים למשחקים */
    const portals = [];
    if(mode === 'explore'){
      const cols = [[1,.45,.55],[1,.7,.25],[.35,.8,.95],[.55,.85,.4],[.75,.55,1],[1,.6,.8],[.4,.9,.8]];
      const n = H.GAMES.length;
      H.GAMES.forEach((gm, i) => {
        const a = i / n * 6.2832 + .3, x = Math.cos(a) * 16, z = Math.sin(a) * 16, y = hgt(x, z), col = cols[i % cols.length];
        const tx = -Math.sin(a), tz = Math.cos(a);
        mesh.cyl(x, y - .05, z, 1.8, .34, 12, [.85, .85, .9]);
        mesh.cyl(x, y + .26, z, 1.4, .06, 12, col);
        for(const sgn of [1, -1]){
          mesh.cyl(x + tx * 1.05 * sgn, y, z + tz * 1.05 * sgn, .22, 2.4, 6, [.95, .93, .85]);
          mesh.cyl(x + tx * 1.05 * sgn, y + 2.4, z + tz * 1.05 * sgn, .3, .18, 6, col);
          mesh.ball(x + tx * 1.05 * sgn, y + 2.75, z + tz * 1.05 * sgn, .3, col, 3, 6);
        }
        portals.push({g: gm, x, z, y});
      });
    }
    const near = (x, z, d) => plants.some(p => Math.hypot(p.x - x, p.z - z) < d) || Math.hypot(x, z) < 3.2 || portals.some(q => Math.hypot(q.x - x, q.z - z) < 3.4);
    /* יער: אורנים גבוהים ועצים עגולים בגדלים שונים, גם על הגבעות */
    for(let i = 0; i < 150; i++){
      const a = rnd() * 6.2832, r = 11 + rnd() * (R - 15), x = Math.cos(a) * r, z = Math.sin(a) * r, y = hgt(x, z);
      if(y < .1 || near(x, z, 2.2)) continue;
      const k = .8 + rnd() * .9, round = rnd() < .35, lc = [th.leaf[0] * (.85 + .3 * rnd()), th.leaf[1] * (.85 + .3 * rnd()), th.leaf[2] * (.85 + .3 * rnd())];
      blob(x + .25, z + .2, 1.0 * k);
      mesh.cyl(x, y - .1, z, .16 * k, .9 * k, 5, [.5, .34, .2]);
      if(round){ mesh.ball(x, y + 1.5 * k, z, .95 * k, lc, 4, 7); mesh.ball(x + .35 * k, y + 1.9 * k, z + .2 * k, .6 * k, lc, 3, 6); }
      else { mesh.cone(x, y + .6 * k, z, 1.0 * k, 1.6 * k, 7, lc); mesh.cone(x, y + 1.5 * k, z, .78 * k, 1.4 * k, 7, lc); mesh.cone(x, y + 2.3 * k, z, .5 * k, 1.2 * k, 7, lc); }
    }
    for(let i = 0; i < 26; i++){
      const a = rnd() * 6.2832, r = 6 + rnd() * (R - 10), x = Math.cos(a) * r, z = Math.sin(a) * r, y = hgt(x, z);
      if(y < .05 || near(x, z, 1.6)) continue;
      const rr = .3 + rnd() * .6; blob(x, z, rr * 1.1);
      mesh.ball(x, y + rr * .35, z, rr, [.62 + .1 * rnd(), .62, .66], 3, 5);
    }
    for(let i = 0; i < 40; i++){      /* שיחים */
      const a = rnd() * 6.2832, r = 5 + rnd() * (R - 9), x = Math.cos(a) * r, z = Math.sin(a) * r, y = hgt(x, z);
      if(y < .08 || near(x, z, 1.4)) continue;
      mesh.ball(x, y + .25, z, .42 + rnd() * .25, [th.leaf[0] * 1.1, th.leaf[1] * 1.15, th.leaf[2] * 1.05], 3, 6);
    }
    for(let i = 0; i < 110; i++){
      const a = rnd() * 6.2832, r = 3 + rnd() * (R - 6), x = Math.cos(a) * r, z = Math.sin(a) * r, y = hgt(x, z);
      if(y < .08 || near(x, z, 1.1)) continue;
      mesh.cyl(x, y, z, .025, .28, 4, [.3, .65, .3]);
      mesh.ball(x, y + .33, z, .09, [[1,.5,.6],[1,.85,.3],[.8,.6,1],[1,1,1]][i % 4], 2, 4);
    }
    /* עומק: הרים רחוקים באובך, ואיים קטנים בתוך המים */
    const haze = th.sky, mt = [haze[0] * .55 + .2, haze[1] * .55 + .22, haze[2] * .5 + .3];
    for(let i = 0; i < 26; i++){
      const a = i / 26 * 6.2832 + rnd() * .2, r = 84 + rnd() * 26, hh = 20 + rnd() * 24;
      mesh.cone(Math.cos(a) * r, -1, Math.sin(a) * r, 15 + rnd() * 12, hh, 6, [mt[0] * (.85 + .3 * rnd()), mt[1] * (.85 + .3 * rnd()), mt[2] * (.9 + .2 * rnd())]);
    }
    for(let i = 0; i < 18; i++){
      const a = i / 18 * 6.2832 + rnd() * .3, r = 62 + rnd() * 14, hh = 7 + rnd() * 9;
      mesh.cone(Math.cos(a) * r, -1, Math.sin(a) * r, 8 + rnd() * 7, hh, 6, [mt[0] * .8, mt[1] * .88, mt[2] * .85]);
    }
    for(let i = 0; i < 6; i++){
      const a = i / 6 * 6.2832 + .5 + rnd() * .5, r = 40 + rnd() * 18, x = Math.cos(a) * r, z = Math.sin(a) * r, rad = 4 + rnd() * 3.5;
      mesh.cyl(x, -.9, z, rad, 1.4, 10, [.94, .86, .62]); mesh.cyl(x, .35, z, rad * .86, .35, 10, g);
      for(let k = 0; k < 3; k++){ const aa = rnd() * 6.2832, rr2 = rnd() * rad * .5; mesh.cone(x + Math.cos(aa) * rr2, .6, z + Math.sin(aa) * rr2, .9, 2.4 + rnd(), 6, th.leaf); }
    }
    return {mesh: mesh.upload(), plants, portals};
  }
  /* מים: טבעות עם צבע שמשתנה מהחוף לעומק, וקצף לבן בגבול האי. הגלים נעים בשכבת הצבע. */
  function buildWater(){
    const th = theme(), m = new Mesh(() => .5), seg = 56, radii = [];
    for(let r = 0; r <= 40; r += 2) radii.push(r);
    for(let r = 48; r <= 150; r += 10) radii.push(r);
    const shallow = [th.water[0] * .75 + .22, th.water[1] * .75 + .24, th.water[2] * .75 + .2], deep = th.water;
    const y = -.5;
    for(let k = 0; k < radii.length - 1; k++){
      const r0 = radii[k], r1 = radii[k + 1], rm = (r0 + r1) / 2;
      let col = [0, 0, 0]; const t = clamp((rm - (R - 6)) / 22, 0, 1);
      col = [shallow[0] + (deep[0] - shallow[0]) * t, shallow[1] + (deep[1] - shallow[1]) * t, shallow[2] + (deep[2] - shallow[2]) * t];
      if(Math.abs(rm - (R - 2.6)) < 1.1) col = [.95, .98, 1];                              /* קצף */
      for(let i = 0; i < seg; i++){
        const a = i / seg * 6.2832, b = (i + 1) / seg * 6.2832, c = col.slice();
        if((i + k) % 2) { c[0] *= .96; c[1] *= .97; }
        m.quad([Math.cos(a) * r0, y, Math.sin(a) * r0], [Math.cos(b) * r0, y, Math.sin(b) * r0], [Math.cos(b) * r1, y, Math.sin(b) * r1], [Math.cos(a) * r1, y, Math.sin(a) * r1], c);
      }
    }
    return m.upload();
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
  function begin(m, keep){
    if(!initGL()) return false;
    mode = m;
    /* בטלפון עומד המסך צר וגבוה, אז המצלמה רחוקה יותר כדי שיראו את האי */
    const portrait = cv.clientWidth / Math.max(1, cv.clientHeight) < .75;
    cam.dist = portrait ? 14 : 10.5; cam.pitch = portrait ? .72 : .6;
    prepareTerrain();
    const b = build();
    S = {mesh: b.mesh, water: buildWater(), plants: b.plants, portals: b.portals, near: null, th: theme(),
         av: {x: keep && lastPos ? lastPos.x : 0, z: keep && lastPos ? lastPos.z : 5, tx: 0, tz: 5, moving: false, ph: 0, face: 1},
         pet: {x: (keep && lastPos ? lastPos.x : 0) + 1.4, z: (keep && lastPos ? lastPos.z : 5) + .6}, items: m === 'explore' ? spawnExplore() : [], wild: [], clouds: [], label: null, t: 0,
         need: [], idx: 0, miss: 0, lastWrong: -9, onDone: null};
    const rnd = rngOf(77);
    for(let i = 0; i < 7; i++) S.wild.push({e: ['🦋','🐝','🦋','🐞','🦋','🐦','🦋'][i], a: rnd() * 6.2832, r: 4 + rnd() * 12, sp: .15 + rnd() * .25, h: 1.2 + rnd() * 1.4, ph: rnd() * 6});
    for(let i = 0; i < 12; i++) S.clouds.push({x: (rnd() - .5) * 150, z: (rnd() - .5) * 150, y: 16 + rnd() * 16, s: 5 + rnd() * 7});
    renderHud(); renderPrompt();
    if(!running){ running = true; last = performance.now(); requestAnimationFrame(frame); }
    return true;
  }
  function end(){ if(S && mode === 'explore') lastPos = {x: S.av.x, z: S.av.z}; running = false; document.body.classList.remove('inworld'); if(H.state.world) H.save(); }

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
    const top = '<div class="wh-top"><button class="wh-exit" id="wexit">✕ יציאה</button>' +
      '<span class="wh-coins">🪙 ' + H.state.coins + '</span>' +
      (mode === 'explore' ? '<button class="wh-topic" id="wtopic">📝 ' + H.esc(H.topic() || 'הכתבה') + ' ▾</button>' : '') + '</div>';
    if(mode === 'hunt' && S){
      box.innerHTML = top + '<div class="wh-word">' + S.need.map((c, i) => '<span class="' + (i < S.idx ? 'got' : (i === S.idx ? 'now' : '')) + '">' + (i < S.idx ? H.esc(c) : '▢') + '</span>').join('') + '</div>' +
        '<div class="wh-sub"><button class="mini" id="wsay">🔊 שמע שוב</button></div>';
      H.$('wsay').onclick = () => H.say(S.word);
    } else {
      const W = daily();
      box.innerHTML = top + '<div class="wh-sub">💎 ' + W.gems + '/' + H.WORLD_GEMS + ' · ' + (W.chest ? '🎁 נפתחה' : '🎁 תיבה מחכה') + ' · 🌱 ' + S.plants.filter(p => p.st >= 3).length + '/' + S.plants.length + '</div>';
    }
    H.$('wexit').onclick = () => { H.sfx.tap(); H.goBack(); };
    const tp = H.$('wtopic'); if(tp) tp.onclick = () => { end(); H.chooseTopic(null); };
  }
  function renderPrompt(){
    const box = H.$('worldgo'); if(!box) return;
    const q = S && S.near;
    if(!q || mode !== 'explore'){ box.style.display = 'none'; return; }
    const g = q.g, ok = !g.canPlay || g.canPlay(H.words().map(H.disp));
    box.style.display = '';
    box.innerHTML = '<div class="wg-t">' + g.e + ' ' + H.esc(g.name) + '</div><div class="wg-d">' + H.esc(g.desc) + '</div>' +
      (ok ? '<button class="go" id="wgo">שחק ▶</button>' : '<div class="wg-d">לא מתאים לנושא הזה</div>');
    if(ok) H.$('wgo').onclick = () => { H.sfx.tap(); go(q.g.id); };
  }
  function go(id){
    if(S) lastPos = {x: S.av.x, z: S.av.z};
    running = false;
    H.startRound(id, undefined, undefined, {origin: 'world'});
  }

  /* ---------- עדכון ---------- */
  function update(dt){
    S.t += dt; const av = S.av;
    /* ג'ויסטיק ומקשים: תנועה ביחס למצלמה */
    let ix = stick.x, iy = stick.y;
    if(keys.ArrowLeft || keys.a) ix -= 1; if(keys.ArrowRight || keys.d) ix += 1;
    if(keys.ArrowUp || keys.w) iy -= 1; if(keys.ArrowDown || keys.s) iy += 1;
    const mag = Math.min(1, Math.hypot(ix, iy));
    if(mag > .12){
      const fx = -Math.sin(cam.yaw), fz = -Math.cos(cam.yaw), rx = Math.cos(cam.yaw), rz = -Math.sin(cam.yaw);
      const dx = (fx * -iy + rx * ix), dz = (fz * -iy + rz * ix), dl = Math.hypot(dx, dz) || 1;
      av.x += dx / dl * 4.8 * mag * dt; av.z += dz / dl * 4.8 * mag * dt; av.moving = false; av.ph += dt * 11;
      if(Math.abs(dx) > .05) av.face = dx > 0 ? 1 : -1;
    }
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
    /* שער קרוב: מציעים לשחק */
    let np = null, pd2 = 2.6;
    S.portals.forEach(q => { const d = Math.hypot(q.x - av.x, q.z - av.z); if(d < pd2){ pd2 = d; np = q; } });
    if(np !== S.near){ S.near = np; renderPrompt(); }
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
    const gy = hgt(av.x, av.z);
    const eye = [av.x + Math.sin(cam.yaw) * cp * cam.dist, gy + ey, av.z + Math.cos(cam.yaw) * cp * cam.dist];
    eye[1] = Math.max(eye[1], hgt(eye[0], eye[2]) + 1.4);                    /* המצלמה לא נכנסת לגבעה */
    /* גבעה בין המצלמה לדמות: מעלים את המצלמה עד שהדמות נראית */
    { const ty = gy + 1; let lift = 0;
      for(let k = 1; k <= 5; k++){ const t = k / 5, px = av.x + (eye[0] - av.x) * t, pz = av.z + (eye[2] - av.z) * t, py = ty + (eye[1] - ty) * t;
        lift = Math.max(lift, (hgt(px, pz) + .9 - py) / t); }
      if(lift > 0) eye[1] += lift; }
    const asp = cv.width / cv.height, proj = M.persp(1.0, asp, .3, 260), look = M.look(eye, [av.x, gy + 1, av.z]);
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
    const dpr = Math.min(window.matchMedia && matchMedia('(pointer:coarse)').matches ? 1.75 : 2, window.devicePixelRatio || 1) * qual;
    const w = Math.max(2, Math.round(cv.clientWidth * dpr)), h = Math.max(2, Math.round(cv.clientHeight * dpr));
    if(cv.width !== w || cv.height !== h){ cv.width = w; cv.height = h; }
    gl.viewport(0, 0, cv.width, cv.height);
    const th = S.th; gl.clearColor(th.sky[0], th.sky[1], th.sky[2], 1); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    const c = camera(); S.cam = c;
    /* שמיים: מעבר צבע מהאופק אל הרום, במקום שהאופק באמת מופיע */
    {
      const e = Math.asin(clamp(c.fwd[1], -1, 1)), hy = clamp(Math.tan(-e) / Math.tan(.5), -1, 1.4);
      gl.useProgram(progB); gl.disable(gl.DEPTH_TEST);
      gl.uniform3fv(gl.getUniformLocation(progB, 'hz'), th.sky);
      gl.uniform3f(gl.getUniformLocation(progB, 'zn'), th.sky[0] * .55, th.sky[1] * .74, Math.min(1, th.sky[2] * 1.05));
      gl.uniform1f(gl.getUniformLocation(progB, 'hy'), hy);
      const ql0 = gl.getAttribLocation(progB, 'q'); gl.bindBuffer(gl.ARRAY_BUFFER, S0.quad); gl.enableVertexAttribArray(ql0); gl.vertexAttribPointer(ql0, 2, gl.FLOAT, false, 0, 0);
      gl.drawArrays(gl.TRIANGLES, 0, 6); gl.enable(gl.DEPTH_TEST);
    }
    gl.useProgram(progL);
    gl.uniformMatrix4fv(gl.getUniformLocation(progL, 'vp'), false, c.vp); gl.uniform3fv(gl.getUniformLocation(progL, 'cam'), c.eye); gl.uniform3fv(gl.getUniformLocation(progL, 'fog'), th.sky);
    /* מים */
    gl.uniform1f(gl.getUniformLocation(progL, 't'), S.t);
    gl.uniform1f(gl.getUniformLocation(progL, 'wv'), .16);
    drawBuf(S.water, ID, new Float32Array(th.tint), progL);
    gl.uniform1f(gl.getUniformLocation(progL, 'wv'), 0);
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
    { const sx = c.eye[0] + 120, sy = c.eye[1] + 95, sz = c.eye[2] - 130; push(dist(sx, sy, sz) + 400, () => sprite(c, emojiTex(H.state.bg === 'night' || H.state.bg === 'space' ? '🌙' : '☀️'), sx, sy, sz, 34, 34)); }
    S.clouds.forEach(cl => push(dist(cl.x, cl.y, cl.z), () => sprite(c, emojiTex('☁️'), cl.x + Math.sin(S.t * .05 + cl.z) * 3, cl.y, cl.z, cl.s * 2, cl.s * 2)));
    S.wild.forEach(wd => { const x = Math.cos(wd.a) * wd.r, z = Math.sin(wd.a) * wd.r, y = hgt(x, z) + wd.h + Math.sin(S.t * 3 + wd.ph) * .15;
      push(dist(x, y, z), () => sprite(c, emojiTex(wd.e), x, y, z, .8, .8)); });
    S.plants.forEach(p => { const y = p.y + (p.st >= 4 || H.isEarned(p.w) ? 2.6 : (p.st >= 3 ? 1.9 : 1.1));
      if(S.label && S.label.p === p) push(dist(p.x, y, p.z) - 3, () => sprite(c, labelTex(H.disp(p.w)), p.x, y, p.z, 2.6, .65)); });
    S.portals.forEach(q => { const d0 = dist(q.x, q.y + 3.3, q.z);
      push(d0, () => sprite(c, emojiTex(q.g.e), q.x, q.y + 3.4 + Math.sin(S.t * 2 + q.x) * .12, q.z, 1.5, 1.5));
      if(d0 > 7 && d0 < 22) push(d0 - 1, () => sprite(c, labelTex(q.g.name), q.x, q.y + 4.5, q.z, 2.6, .65)); });
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
    /* מכשיר איטי: מורידים רזולוציה כדי לשמור על זרימה */
    frame.acc = (frame.acc || 0) + dt; frame.n = (frame.n || 0) + 1;
    if(frame.n >= 60){ const avg = frame.acc / frame.n; if(avg > .034 && qual > .55) qual -= .15; else if(avg < .019 && qual < 1) qual = Math.min(1, qual + .1); frame.acc = 0; frame.n = 0; }
    try{ update(dt); draw(); }catch(e){ console.warn(e); running = false; return; }
    requestAnimationFrame(frame);
  }

  /* ---------- קלט ---------- */
  function groundHit(clientX, clientY){
    const r = cv.getBoundingClientRect(), nx = (clientX - r.left) / r.width * 2 - 1, ny = 1 - (clientY - r.top) / r.height * 2;
    const c = S.cam, t = Math.tan(.5), d = [0, 0, 0];
    for(let i = 0; i < 3; i++) d[i] = c.fwd[i] + c.right[i] * nx * t * c.asp + c.up[i] * ny * t;
    const l = Math.hypot(d[0], d[1], d[2]); d[0] /= l; d[1] /= l; d[2] /= l;
    let t0 = 0, prev = 0;
    for(let k = 0; k < 220; k++){                                   /* צועדים לאורך הקרן עד שפוגעים בקרקע */
      t0 += .5; const x = c.eye[0] + d[0] * t0, y = c.eye[1] + d[1] * t0, z = c.eye[2] + d[2] * t0;
      if(y <= hgt(x, z)){
        let lo = prev, hi = t0;
        for(let j = 0; j < 7; j++){ const mid = (lo + hi) / 2; if(c.eye[1] + d[1] * mid <= hgt(c.eye[0] + d[0] * mid, c.eye[2] + d[2] * mid)) hi = mid; else lo = mid; }
        return [c.eye[0] + d[0] * hi, c.eye[2] + d[2] * hi];
      }
      prev = t0;
      if(t0 > 110) break;
    }
    return null;
  }
  function bind(){
    if(bind.done) return; bind.done = true;
    cv.addEventListener('pointerdown', e => {
      try{ cv.setPointerCapture(e.pointerId); }catch(_){}
      ptr.set(e.pointerId, {x: e.clientX, y: e.clientY});
      tap = ptr.size === 1 ? {x: e.clientX, y: e.clientY, t: performance.now(), moved: false} : null;
      if(ptr.size === 2){ const [a, b] = [...ptr.values()]; pinch = Math.hypot(a.x - b.x, a.y - b.y); }
    });
    cv.addEventListener('pointermove', e => {
      const p = ptr.get(e.pointerId); if(!p) return;
      const dx = e.clientX - p.x, dy = e.clientY - p.y; p.x = e.clientX; p.y = e.clientY;
      if(ptr.size === 2){ const [a, b] = [...ptr.values()], d = Math.hypot(a.x - b.x, a.y - b.y); if(pinch) cam.dist = clamp(cam.dist * pinch / d, 6, 22); pinch = d; return; }
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
    window.addEventListener('keydown', e => { if(H.screen !== 'world') return; const k = e.key.length === 1 ? e.key.toLowerCase() : e.key; keys[k] = true; if(k.startsWith('Arrow')) e.preventDefault(); });
    window.addEventListener('keyup', e => { const k = e.key.length === 1 ? e.key.toLowerCase() : e.key; keys[k] = false; });
    window.addEventListener('blur', () => { for(const k in keys) keys[k] = false; });
    const st = H.$('wstick'), kn = H.$('wknob');
    if(st){
      const setv = (cx, cy) => { const r = st.getBoundingClientRect(), mx = r.left + r.width / 2, my = r.top + r.height / 2, rad = r.width / 2 - 16;
        let dx = cx - mx, dy = cy - my; const l = Math.hypot(dx, dy); if(l > rad){ dx *= rad / l; dy *= rad / l; }
        stick.x = dx / rad; stick.y = dy / rad; kn.style.transform = 'translate(' + dx + 'px,' + dy + 'px)'; };
      st.addEventListener('pointerdown', e => { try{ st.setPointerCapture(e.pointerId); }catch(_){} stick.id = e.pointerId; setv(e.clientX, e.clientY); e.preventDefault(); e.stopPropagation(); });
      st.addEventListener('pointermove', e => { if(stick.id === e.pointerId) setv(e.clientX, e.clientY); });
      const rel = e => { if(stick.id !== e.pointerId) return; stick.id = null; stick.x = stick.y = 0; kn.style.transform = ''; };
      st.addEventListener('pointerup', rel); st.addEventListener('pointercancel', rel);
    }
    cv.addEventListener('wheel', e => { e.preventDefault(); cam.dist = clamp(cam.dist + e.deltaY * .01, 6, 22); }, {passive: false});
  }

  return {
    supported(){ return initGL(); },
    open(m, keep){ if(!initGL()) return false; bind(); document.body.classList.add('inworld'); return begin(m || 'explore', keep); },
    hunt, end, state: () => S, cam: () => cam, mode: () => mode, refresh(){ renderHud(); }
  };
})();

/* ---------- כניסות ---------- */
H.openWorld = function(){
  H.run = {origin: 'home', game: null, word: null, right: 0, wrong: 0, total: 0, queue: []};
  H.show('world');
  if(!H.world.open('explore', true)){ H.toast('הדפדפן הזה לא תומך בתלת־ממד'); H.home(); }
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
