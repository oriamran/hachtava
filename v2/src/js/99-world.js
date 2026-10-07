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
  let HILLS = [], PADS = [], LMS = [];
  function prepareTerrain(){
    const n = H.GAMES.length, rnd = rngOf(4242); PADS = []; HILLS = []; LMS = [];
    /* ציוני דרך (מודלים מבלנדר): במקומות קבועים, על קרקע שטוחה */
    [['windmill', .95, 13.2], ['cottage', 2.55, 12.8], ['cottage', 3.35, 13.4], ['camp', 4.5, 12.6], ['lighthouse', 5.6, 17.6]]
      .forEach(l => LMS.push({name: l[0], a: l[1], x: Math.cos(l[1]) * l[2], z: Math.sin(l[1]) * l[2]}));
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
    for(let i = 0; i < LMS.length; i++){ const d = Math.hypot(x - LMS[i].x, z - LMS[i].z); if(d < 6) flat = Math.min(flat, smooth(2.2, 5.2, d)); }
    h += hill * flat;
    const e = Math.max(0, (r - (R - 7)) / 7);
    return h - e * e * 2.4;
  };

  /* ---------- מודלים מ-Blender ---------- */
  const MOD = {};
  (function(){
    const b64 = t => { const bin = atob(t), a = new Uint8Array(bin.length); for(let i = 0; i < bin.length; i++) a[i] = bin.charCodeAt(i); return a; };
    Object.keys(H.MODELS || {}).forEach(k => {
      const m = H.MODELS[k], raw = b64(m.v), i16 = new Int16Array(raw.buffer.slice(raw.byteOffset, raw.byteOffset + raw.length));
      const f = new Float32Array(i16.length); for(let i = 0; i < i16.length; i++) f[i] = i16[i] / 256;
      /* נורמלים רכים: ממצעים בין משולשים שחולקים קודקוד, אבל רק כשהזווית ביניהם קטנה (קצוות חדים נשארים חדים) */
      const n = m.n, tn = new Float32Array(n * 3), key = new Map(), kf = (i, k2) => Math.round(f[i*9+k2*3]*50) + ',' + Math.round(f[i*9+k2*3+1]*50) + ',' + Math.round(f[i*9+k2*3+2]*50);
      for(let i = 0; i < n; i++){
        const ax = f[i*9], ay = f[i*9+1], az = f[i*9+2], ux = f[i*9+3]-ax, uy = f[i*9+4]-ay, uz = f[i*9+5]-az, vx = f[i*9+6]-ax, vy = f[i*9+7]-ay, vz = f[i*9+8]-az;
        const nx = uy*vz-uz*vy, ny = uz*vx-ux*vz, nz = ux*vy-uy*vx, l = Math.hypot(nx, ny, nz) || 1; tn[i*3] = nx/l; tn[i*3+1] = ny/l; tn[i*3+2] = nz/l;
        for(let k2 = 0; k2 < 3; k2++){ const kk = kf(i, k2); if(!key.has(kk)) key.set(kk, []); key.get(kk).push(i); }
      }
      const vn = new Float32Array(n * 9);
      for(let i = 0; i < n; i++) for(let k2 = 0; k2 < 3; k2++){
        let sx = 0, sy = 0, sz = 0;
        key.get(kf(i, k2)).forEach(j => { const d = tn[i*3]*tn[j*3] + tn[i*3+1]*tn[j*3+1] + tn[i*3+2]*tn[j*3+2]; if(d > .5){ sx += tn[j*3]; sy += tn[j*3+1]; sz += tn[j*3+2]; } });
        const l = Math.hypot(sx, sy, sz) || 1; vn[i*9+k2*3] = sx / l; vn[i*9+k2*3+1] = sy / l; vn[i*9+k2*3+2] = sz / l;
      }
      MOD[k] = {n: m.n, v: f, c: b64(m.c), vn};
    });
  })();
  /* סיבוב סביב Y, ואז סביב Z (ללהבי טחנת הרוח), ואז הזזה */
  M.modelZ = (x, y, z, s, ry, rz) => { const cy = Math.cos(ry), sy = Math.sin(ry), cz = Math.cos(rz), sz = Math.sin(rz);
    return new Float32Array([s*(cy*cz), s*sz, s*(-sy*cz), 0,  s*(-cy*sz), s*cz, s*(sy*sz), 0,  s*sy, 0, s*cy, 0,  x, y, z, 1]); };
  /* פנים אל מרכז האי מהזווית a */
  const faceCenter = a => Math.atan2(-Math.cos(a), -Math.sin(a));

  /* ---------- בניית רשת ---------- */
  function Mesh(rnd){ this.p = []; this.n = []; this.c = []; this.rnd = rnd || Math.random; }
  /* משולש עם נורמל וצבע לכל קודקוד: הצללה רכה בלי "משבצות" */
  Mesh.prototype.triV = function(a, b, c, na, nb, nc, ca, cb, cc){
    this.p.push(a[0], a[1], a[2], b[0], b[1], b[2], c[0], c[1], c[2]);
    this.n.push(na[0], na[1], na[2], nb[0], nb[1], nb[2], nc[0], nc[1], nc[2]);
    this.c.push(ca[0], ca[1], ca[2], cb[0], cb[1], cb[2], cc[0], cc[1], cc[2]);
  };
  Mesh.prototype.tri = function(a, b, c, col, o){
    const ux = b[0]-a[0], uy = b[1]-a[1], uz = b[2]-a[2], vx = c[0]-a[0], vy = c[1]-a[1], vz = c[2]-a[2];
    let nx = uy*vz-uz*vy, ny = uz*vx-ux*vz, nz = ux*vy-uy*vx; const l = Math.hypot(nx, ny, nz) || 1; nx/=l; ny/=l; nz/=l;
    const cx = (a[0]+b[0]+c[0])/3, cy = (a[1]+b[1]+c[1])/3, cz = (a[2]+b[2]+c[2])/3;
    const out = o ? (nx*(cx-o[0]) + ny*(cy-o[1]) + nz*(cz-o[2])) >= 0 : ny >= 0;     /* בלי origin: הפנים כלפי מעלה */
    if(!out){ nx = -nx; ny = -ny; nz = -nz; }
    const j = .965 + .07 * this.rnd();
    for(const v of [a, b, c]){ this.p.push(v[0], v[1], v[2]); this.n.push(nx, ny, nz); this.c.push(col[0]*j, col[1]*j, col[2]*j); }
  };
  /* משולש עם כיוון לפי הסדר, בלי היפוך (למודלים מבלנדר) */
  Mesh.prototype.tri3 = function(a, b, c, col){
    const ux = b[0]-a[0], uy = b[1]-a[1], uz = b[2]-a[2], vx = c[0]-a[0], vy = c[1]-a[1], vz = c[2]-a[2];
    let nx = uy*vz-uz*vy, ny = uz*vx-ux*vz, nz = ux*vy-uy*vx; const l = Math.hypot(nx, ny, nz) || 1; nx/=l; ny/=l; nz/=l;
    const j = .96 + .08 * this.rnd();
    for(const v of [a, b, c]){ this.p.push(v[0], v[1], v[2]); this.n.push(nx, ny, nz); this.c.push(col[0]*j, col[1]*j, col[2]*j); }
  };
  Mesh.prototype.model = function(name, x, y, z, s, ry, tint){
    const m = MOD[name]; if(!m) return;
    const c = Math.cos(ry || 0), sn = Math.sin(ry || 0), t = tint || [1, 1, 1];
    for(let i = 0; i < m.n; i++){
      const P = [], Nn = [], col = [m.c[i*3] / 255 * t[0], m.c[i*3+1] / 255 * t[1], m.c[i*3+2] / 255 * t[2]];
      for(let k = 0; k < 3; k++){
        const ox = m.v[i*9+k*3] * s, oy = m.v[i*9+k*3+1] * s, oz = m.v[i*9+k*3+2] * s; P.push([x + ox*c + oz*sn, y + oy, z - ox*sn + oz*c]);
        const nx = m.vn[i*9+k*3], ny = m.vn[i*9+k*3+1], nz = m.vn[i*9+k*3+2]; Nn.push([nx*c + nz*sn, ny, -nx*sn + nz*c]);
      }
      this.triV(P[0], P[1], P[2], Nn[0], Nn[1], Nn[2], col, col, col);
    }
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
  Mesh.prototype.ball = function(cx, cy, cz, r, col, rings, seg, flat){
    rings = rings || 4; seg = seg || 7; const o = [cx, cy, cz];
    if(!flat){                                  /* כדור חלק: נורמל לפי המרכז */
      const pt = (i, j) => { const v = i / rings * Math.PI, u = j / seg * 6.2832, nx = Math.sin(v) * Math.cos(u), ny = Math.cos(v), nz = Math.sin(v) * Math.sin(u);
        return {p: [cx + r * nx, cy + r * ny, cz + r * nz], n: [nx, ny, nz]}; };
      const sh = [col[0] * (.97 + .06 * this.rnd()), col[1] * (.97 + .06 * this.rnd()), col[2] * (.97 + .06 * this.rnd())];
      for(let i = 0; i < rings; i++) for(let j = 0; j < seg; j++){
        const a = pt(i, j), b = pt(i, j + 1), c = pt(i + 1, j + 1), d = pt(i + 1, j);
        this.triV(a.p, c.p, b.p, a.n, c.n, b.n, sh, sh, sh); this.triV(a.p, d.p, c.p, a.n, d.n, c.n, sh, sh, sh);
      }
      return;
    }
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
    S0.mod = {};
    ['chest', 'crystal', 'blades'].forEach(k => { const mm = new Mesh(() => .5); mm.model(k, 0, 0, 0, 1, 0); S0.mod[k] = mm.upload(); });
    return true;
  }
  const S0 = {};

  function texOf(key, w, h, draw){
    if(texCache[key]) return texCache[key];
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    const x = c.getContext('2d'); x.direction = 'rtl'; x.textAlign = 'center'; x.textBaseline = 'middle'; draw(x, w, h);
    const t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, c);
    gl.generateMipmap(gl.TEXTURE_2D);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    return texCache[key] = t;
  }
  const emojiTex = e => texOf('e' + e, 256, 256, (x, w, h) => { x.font = '190px serif'; x.fillText(e, w/2, h/2 + 12); });
  const fontFam = () => H.scriptNow && H.scriptNow() === 'ktav' ? '"KtavYad","Arial Hebrew",Arial,sans-serif' : '"Arial Hebrew",Arial,sans-serif';
  const letterTex = ch => texOf('l' + H.scriptNow() + ch, 256, 256, (x, w, h) => {
    x.fillStyle = '#fff'; x.beginPath(); x.arc(128, 128, 116, 0, 6.2832); x.fill();
    x.fillStyle = '#7c5cd6'; x.beginPath(); x.arc(128, 128, 100, 0, 6.2832); x.fill();
    x.fillStyle = '#fff'; x.font = (H.scriptNow() === 'ktav' ? '' : 'bold ') + '156px ' + fontFam(); x.fillText(ch, 128, 140); });
  const labelTex = t => texOf('t' + H.scriptNow() + t, 512, 128, (x, w, h) => {
    x.fillStyle = 'rgba(255,255,255,.95)'; x.beginPath();
    if(x.roundRect) x.roundRect(8, 12, w - 16, h - 24, 44); else x.rect(8, 12, w - 16, h - 24);
    x.fill(); x.fillStyle = '#2b2250'; x.font = (H.scriptNow() === 'ktav' ? '' : 'bold ') + '72px ' + fontFam(); x.fillText(t, w/2, h/2 + 4); });
  const avatarTex = () => {
    const a = (H.AVATARS.find(v => v.id === H.state.avatar) || H.AVATARS[0]).e;
    const hat = (H.HATS.find(v => v.id === H.state.hat) || {}).e || '';
    return texOf('av' + a + hat, 256, 256, (x, w, h) => { x.font = '170px serif'; x.fillText(a, w/2, 156);
      if(hat){ x.font = '100px serif'; x.fillText(hat, w/2, 46); } });
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
    /* קרקע: נורמל וצבע לכל קודקוד, כדי שההצללה תהיה רכה וצבע משתנה בהדרגה (בלי "משבצות") */
    const sand = [.94, .86, .62];
    const nz2 = (x, z) => .5 + .5 * Math.sin(x * .55 + 1.3) * Math.sin(z * .47 + .4);
    const vcol = (x, z, h) => {
      const rr = Math.hypot(x, z), n = nz2(x, z);
      let col = [g[0] * (.94 + .1 * n) * (1 + Math.max(0, h) * .05), g[1] * (.94 + .1 * n) * (1 + Math.max(0, h) * .045), g[2] * (.94 + .1 * n)];
      col = mix3(col, rock, smooth(2.2, 3.5, h));
      return mix3(col, sand, Math.max(smooth(R - 8, R - 6.2, rr), smooth(-.1, -.45, h)));
    };
    const vnorm = (x, z) => { const e = .4, dx = (hgt(x + e, z) - hgt(x - e, z)) / (2 * e), dz = (hgt(x, z + e) - hgt(x, z - e)) / (2 * e), l = Math.hypot(dx, 1, dz); return [-dx / l, 1 / l, -dz / l]; };
    const N = Math.ceil((2 * R + 4) / STEP), V = [];
    for(let i = 0; i <= N; i++){ V[i] = []; for(let j = 0; j <= N; j++){ const x = -R - 2 + i * STEP, z = -R - 2 + j * STEP, h = hgt(x, z); V[i][j] = {p: [x, h, z], n: vnorm(x, z), c: vcol(x, z, h)}; } }
    for(let i = 0; i < N; i++) for(let j = 0; j < N; j++){
      const A = V[i][j], B = V[i+1][j], C = V[i+1][j+1], D = V[i][j+1];
      if(Math.hypot(A.p[0] + STEP / 2, A.p[2] + STEP / 2) > R + 1.5) continue;
      mesh.triV(A.p, B.p, C.p, A.n, B.n, C.n, A.c, B.c, C.c); mesh.triV(A.p, C.p, D.p, A.n, C.n, D.n, A.c, C.c, D.c);
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
        mesh.cyl(x, y + .02, z, 1.45, .08, 12, col);                              /* משטח צבעוני לכל משחק */
        mesh.model('arch', x, y, z, 1, Math.atan2(-tz, tx));
        portals.push({g: gm, x, z, y, col});
      });
    }
    S0.blades = null; const blades = [];
    LMS.forEach(l => {
      const y = hgt(l.x, l.z), ry = faceCenter(l.a);
      blob(l.x, l.z, l.name === 'lighthouse' ? 2.3 : 2.1);
      mesh.model(l.name, l.x, y, l.z, l.name === 'lighthouse' ? 1.25 : 1, ry);
      if(l.name === 'windmill'){ const c = Math.cos(ry), sn = Math.sin(ry), ox = 0, oz = 1.18; blades.push({x: l.x + ox * c + oz * sn, y: y + 3.65, z: l.z - ox * sn + oz * c, ry}); }
    });
    /* מזח וסירה בחוף, שלט, דגלים וכד' */
    { const a = 1.75, r0 = 16.4, y0 = -.05, ry = Math.atan2(-Math.cos(a), -Math.sin(a)) + 3.1416;
      mesh.model('pier', Math.cos(a) * r0, y0, Math.sin(a) * r0, 1, ry + 3.1416);
      mesh.model('boat', Math.cos(a + .12) * (R - .5), -.38, Math.sin(a + .12) * (R - .5), 1.1, a); }
    mesh.model('sign', 2.9, hgt(2.9, 2.2), 2.2, 1, .6);
    [[0, 1], [3.1416, 1], [1.57, 1], [4.71, 1]].forEach(f => { const x = Math.cos(f[0]) * 3.6, z = Math.sin(f[0]) * 3.6; mesh.model('flag', x, hgt(x, z), z, .9, f[0]); });
    const lmNear = (x, z, d) => LMS.some(l => Math.hypot(l.x - x, l.z - z) < d);
    const near = (x, z, d) => plants.some(p => Math.hypot(p.x - x, p.z - z) < d) || Math.hypot(x, z) < 3.2 || portals.some(q => Math.hypot(q.x - x, q.z - z) < 3.4) || lmNear(x, z, 3.6);
    /* יער: אורנים גבוהים ועצים עגולים בגדלים שונים, גם על הגבעות */
    for(let i = 0; i < 150; i++){
      const a = rnd() * 6.2832, r = 11 + rnd() * (R - 15), x = Math.cos(a) * r, z = Math.sin(a) * r, y = hgt(x, z);
      if(y < .1 || near(x, z, 2.2)) continue;
      const k = .8 + rnd() * .9, round = rnd() < .35, lc = [th.leaf[0] * (.85 + .3 * rnd()), th.leaf[1] * (.85 + .3 * rnd()), th.leaf[2] * (.85 + .3 * rnd())];
      blob(x + .25, z + .2, 1.0 * k);
      mesh.cyl(x, y - .1, z, .16 * k, .9 * k, 5, [.5, .34, .2]);
      const tt = [.85 + .3 * rnd(), .85 + .3 * rnd(), .85 + .3 * rnd()], tn = [th.leaf[0] / .30 * .9, th.leaf[1] / .65 * .9, th.leaf[2] / .30 * .9];
      const tinted = [Math.min(1.4, tt[0] * (.7 + tn[0] * .3)), Math.min(1.4, tt[1] * (.7 + tn[1] * .3)), Math.min(1.4, tt[2] * (.7 + tn[2] * .3))];
      mesh.model(round ? 'roundtree' : 'pine', x, y - .1, z, k * .9, rnd() * 6.2832, tinted);
    }
    for(let i = 0; i < 16; i++){                  /* פטריות */
      const a = rnd() * 6.2832, r = 8 + rnd() * (R - 12), x = Math.cos(a) * r, z = Math.sin(a) * r, y = hgt(x, z);
      if(y < .1 || near(x, z, 2)) continue;
      blob(x, z, .6); mesh.model('mushroom', x, y, z, .55 + rnd() * .6, rnd() * 6.2832);
    }
    for(let i = 0; i < 26; i++){
      const a = rnd() * 6.2832, r = 6 + rnd() * (R - 10), x = Math.cos(a) * r, z = Math.sin(a) * r, y = hgt(x, z);
      if(y < .05 || near(x, z, 1.6)) continue;
      const rr = .3 + rnd() * .6; blob(x, z, rr * 1.1);
      mesh.ball(x, y + rr * .35, z, rr, [.62 + .1 * rnd(), .62, .66], 3, 5, true);
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
    S0.blades = blades;
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
    /* רק האותיות של המילה, ועוד אות אחת לא קשורה (לא אות שכבר במילה, גם לא עם ניקוד אחר) */
    const bases = need.map(c => H.strip(c)), extra = []; let guard = 0;
    while(extra.length < 1 && guard++ < 80){ const c = H.randTile(true); if(!bases.includes(H.strip(c))) extra.push(c); }
    const all = need.concat(extra);
    S.items = []; S.need = need; S.idx = 0; S.miss = 0; S.onDone = onDone; S.word = word;
    /* האותיות מפוזרות במעגל סביב מרכז האי, על הדשא הפתוח: בלי יער, בלי גבעות, ותמיד בטווח ראייה */
    const ang0 = Math.random() * 6.2832, n = all.length, order = all.map((_, i) => i).sort(() => Math.random() - .5);
    order.forEach((i, k) => {
      const a = ang0 + k / n * 6.2832 + (Math.random() - .5) * .35, r = 5.2 + Math.random() * 3.6;
      S.items.push({type: 'letter', ch: all[i], x: Math.cos(a) * r, z: Math.sin(a) * r, ph: Math.random() * 6, shake: 0});
    });
    S.av.x = 0; S.av.z = 0; S.av.moving = false;
    renderHud();
  }
  function renderHud(){
    const box = H.$('worldhud'); if(!box) return;
    const top = '<div class="wh-top"><button class="wh-exit" id="wexit">✕ יציאה</button>' +
      '<span class="wh-coins">🪙 ' + H.state.coins + '</span><button class="wh-bug" id="wbug" aria-label="דווח על בעיה">🐞</button>' +
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
    H.$('wbug').onclick = () => H.openReport();
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
    const dpr = Math.min(window.matchMedia && matchMedia('(pointer:coarse)').matches ? 2.5 : 2, window.devicePixelRatio || 1) * qual;
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
      else if(it.type === 'chest'){ tint.set([1, 1, 1]); drawBuf(S0.mod.chest, M.model(it.x, y, it.z, 1.4, 1.4, 1.4, S.t * .3), tint, progL); }
    });
    /* גבישים מעל השערים (בצבע המשחק) ולהבי הטחנה שמסתובבים */
    S.portals.forEach(q => { tint.set(q.col); drawBuf(S0.mod.crystal, M.model(q.x, q.y + 4.35 + Math.sin(S.t * 2 + q.x) * .12, q.z, 1.1, 1.1, 1.1, S.t * 1.2), tint, progL); });
    tint.set([1, 1, 1]); (S0.blades || []).forEach(b => drawBuf(S0.mod.blades, M.modelZ(b.x, b.y, b.z, 1, b.ry, S.t * .8), tint, progL));
    /* צל */
    tint.set([th.ground[0] * .55, th.ground[1] * .55, th.ground[2] * .55]);
    drawBuf(S0.disc, M.model(S.av.x, hgt(S.av.x, S.av.z) + .03, S.av.z, .7, 1, .55, 0), tint, progL);
    drawBuf(S0.disc, M.model(S.pet.x, hgt(S.pet.x, S.pet.z) + .03, S.pet.z, .4, 1, .32, 0), tint, progL);
    /* ציורים שטוחים שפונים למצלמה */
    gl.useProgram(progS);
    gl.uniformMatrix4fv(gl.getUniformLocation(progS, 'vp'), false, c.vp);
    gl.uniform3fv(gl.getUniformLocation(progS, 'rt'), c.right); gl.uniform3fv(gl.getUniformLocation(progS, 'up'), c.up);
    const ql = gl.getAttribLocation(progS, 'q'); gl.bindBuffer(gl.ARRAY_BUFFER, S0.quad); gl.enableVertexAttribArray(ql); gl.vertexAttribPointer(ql, 2, gl.FLOAT, false, 0, 0);
    const list = [], labels = [], push = (d, f) => list.push({d, f});
    const dist = (x, y, z) => Math.hypot(x - c.eye[0], y - c.eye[1], z - c.eye[2]);
    { const sx = c.eye[0] + 120, sy = c.eye[1] + 95, sz = c.eye[2] - 130; push(dist(sx, sy, sz) + 400, () => sprite(c, emojiTex(H.state.bg === 'night' || H.state.bg === 'space' ? '🌙' : '☀️'), sx, sy, sz, 34, 34)); }
    S.clouds.forEach(cl => push(dist(cl.x, cl.y, cl.z), () => sprite(c, emojiTex('☁️'), cl.x + Math.sin(S.t * .05 + cl.z) * 3, cl.y, cl.z, cl.s * 2, cl.s * 2)));
    S.wild.forEach(wd => { const x = Math.cos(wd.a) * wd.r, z = Math.sin(wd.a) * wd.r, y = hgt(x, z) + wd.h + Math.sin(S.t * 3 + wd.ph) * .15;
      push(dist(x, y, z), () => sprite(c, emojiTex(wd.e), x, y, z, .8, .8)); });
    S.plants.forEach(p => { const y = p.y + (p.st >= 4 || H.isEarned(p.w) ? 2.6 : (p.st >= 3 ? 1.9 : 1.1));
      if(S.label && S.label.p === p) push(dist(p.x, y, p.z) - 3, () => sprite(c, labelTex(H.disp(p.w)), p.x, y, p.z, 2.6, .65)); });
    S.portals.forEach(q => { const d0 = dist(q.x, q.y + 3.3, q.z);
      push(d0, () => sprite(c, emojiTex(q.g.e), q.x, q.y + 3.4 + Math.sin(S.t * 2 + q.x) * .12, q.z, 1.5, 1.5));
      if(d0 < 46) labels.push({d: d0, f: () => { const k = clamp(d0 / 11, .8, 2.6), t = q === S.near ? 0 : 1; if(t) sprite(c, labelTex(q.g.name), q.x, q.y + 4.7 + k * .12, q.z, 2.6 * k, .65 * k); }}); });
    S.items.forEach(it => { const y = hgt(it.x, it.z) + 1.9 + Math.sin(S.t * 2 + it.ph) * .12;
      if(it.type === 'letter'){ const d1 = dist(it.x, y, it.z); labels.push({d: d1, f: () => { const k = clamp(d1 / 9, 1, 2.2); sprite(c, letterTex(it.ch), it.x, y, it.z, 1.25 * k, 1.25 * k); }}); }
      if(it.type === 'chest') push(dist(it.x, y, it.z), () => sprite(c, emojiTex('🎁'), it.x, hgt(it.x, it.z) + 1.9, it.z, 1, 1)); });
    const av = S.av, ay = hgt(av.x, av.z) + 1.05 + (av.moving ? Math.abs(Math.sin(av.ph)) * .25 : Math.sin(S.t * 2) * .03);
    push(dist(av.x, ay, av.z), () => sprite(c, avatarTex(), av.x, ay + .1, av.z, 2.1, 2.1));
    const pet = (H.PETS.find(p => p.id === H.state.pet) || {}).e;
    if(pet) push(dist(S.pet.x, 0, S.pet.z), () => sprite(c, emojiTex(pet), S.pet.x, hgt(S.pet.x, S.pet.z) + .5 + (av.moving ? Math.abs(Math.sin(av.ph + 1)) * .15 : 0), S.pet.z, .9, .9));
    list.sort((a, b) => b.d - a.d).forEach(o => o.f());
    /* שמות המשחקים מעל השערים: תמיד קריאים, גם מרחוק ומאחורי גבעה */
    gl.disable(gl.DEPTH_TEST); labels.sort((a, b) => b.d - a.d).forEach(o => o.f()); gl.enable(gl.DEPTH_TEST);
  }
  function frame(ts){
    if(!running) return;
    if(H.screen !== 'world'){ running = false; return; }
    const dt = Math.min(.05, (ts - last) / 1000); last = ts;
    /* מכשיר איטי: מורידים רזולוציה כדי לשמור על זרימה */
    frame.acc = (frame.acc || 0) + dt; frame.n = (frame.n || 0) + 1;
    if(frame.n >= 60){ const avg = frame.acc / frame.n; if(avg > .042 && qual > .7) qual -= .1; else if(avg < .019 && qual < 1) qual = Math.min(1, qual + .1); frame.acc = 0; frame.n = 0; }
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
  /* איזה שער נמצא מתחת לאצבע: מטילים את מרכז הקשת והסמל למסך */
  function portalAtTap(cx, cy){
    if(!S || mode !== 'explore' || !S.cam) return null;
    const r = cv.getBoundingClientRect(), vp = S.cam.vp, lim = Math.max(46, Math.min(r.width, r.height) * .08);
    let best = null, bd = 1e9;
    S.portals.forEach(q => [1.6, 3.4].forEach(dy => {
      const x = q.x, y = q.y + dy, z = q.z, w = vp[3]*x + vp[7]*y + vp[11]*z + vp[15];
      if(w <= .5) return;
      const nx = (vp[0]*x + vp[4]*y + vp[8]*z + vp[12]) / w, ny = (vp[1]*x + vp[5]*y + vp[9]*z + vp[13]) / w;
      const sx = r.left + (nx * .5 + .5) * r.width, sy = r.top + (1 - (ny * .5 + .5)) * r.height, d = Math.hypot(sx - cx, sy - cy);
      const scale = clamp(30 / w, .6, 2.2);                    /* שער קרוב גדול יותר */
      if(d < lim * scale && d < bd){ bd = d; best = q; }
    }));
    return best;
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
        /* לחיצה על שער (הסמל, הקשת או התווית) פותחת ישר את המשחק */
        const q = portalAtTap(e.clientX, e.clientY);
        if(q){
          const ok = !q.g.canPlay || q.g.canPlay(H.words().map(H.disp));
          if(ok){ H.sfx.tap(); tap = null; return go(q.g.id); }
          H.toast('המשחק הזה לא מתאים לנושא'); tap = null; return;
        }
        const hit = groundHit(e.clientX, e.clientY);
        if(hit){ S.av.tx = hit[0]; S.av.tz = hit[1]; S.av.moving = true; }
      }
      tap = null;
    };
    cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
    window.addEventListener('keydown', e => { if(H.screen !== 'world') return; if(e.target && /^(INPUT|TEXTAREA)$/.test(e.target.tagName)) return; const k = e.key.length === 1 ? e.key.toLowerCase() : e.key; keys[k] = true; if(k.startsWith('Arrow')) e.preventDefault(); });
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
    diag: () => ({wmode: mode, wqual: +qual.toFixed(2), items: S ? S.items.length : 0, plants: S ? S.plants.length : 0}),
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
