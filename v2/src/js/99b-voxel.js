/* ==========================================================
   עולם הבנייה: עולם בלוקים בסגנון מיינקראפט.
   WebGL ישיר בלי ספרייה. מרקמי פיקסלים נוצרים בקוד (בלי קבצים),
   פנים מוסתרות לא מצוירות, והצללה בפינות (AO) נותנת עומק.

   אפשר להניח ולשבור בלוקים. בלוקים מיוחדים נקנים במטבעות, ובלוקי
   אותיות נפתחים אחרי שלומדים מילה עם האות. המשחק "בונים מילה" מבקש
   להציב את אותיות המילה בשורה.
   ========================================================== */
H.VOX = {NX: 80, NZ: 80, NY: 40, SEA: 9, CH: 16};
H.VOX_BLOCKS = [
  /* id, מפתח, שם, מרקם(top/side/bottom), מחיר (0 = חינם) */
  {id: 1,  k: 'grass',  n: 'דשא',     t: ['grass_top', 'grass_side', 'dirt'], cost: 0},
  {id: 2,  k: 'dirt',   n: 'אדמה',    t: ['dirt'], cost: 0},
  {id: 3,  k: 'stone',  n: 'אבן',     t: ['stone'], cost: 0},
  {id: 4,  k: 'sand',   n: 'חול',     t: ['sand'], cost: 0},
  {id: 5,  k: 'log',    n: 'גזע',     t: ['log_top', 'log_side', 'log_top'], cost: 0},
  {id: 6,  k: 'leaves', n: 'עלים',    t: ['leaves'], cost: 0},
  {id: 7,  k: 'planks', n: 'קרשים',   t: ['planks'], cost: 0},
  {id: 8,  k: 'brick',  n: 'לבנים',   t: ['brick'], cost: 0},
  {id: 9,  k: 'glass',  n: 'זכוכית',  t: ['glass'], cost: 25},
  {id: 11, k: 'red',    n: 'צמר אדום',   t: ['wool_red'], cost: 0},
  {id: 12, k: 'orange', n: 'צמר כתום',   t: ['wool_orange'], cost: 0},
  {id: 13, k: 'yellow', n: 'צמר צהוב',   t: ['wool_yellow'], cost: 0},
  {id: 14, k: 'green',  n: 'צמר ירוק',   t: ['wool_green'], cost: 0},
  {id: 15, k: 'blue',   n: 'צמר כחול',   t: ['wool_blue'], cost: 0},
  {id: 16, k: 'purple', n: 'צמר סגול',   t: ['wool_purple'], cost: 0},
  {id: 17, k: 'pink',   n: 'צמר ורוד',   t: ['wool_pink'], cost: 0},
  {id: 18, k: 'white',  n: 'צמר לבן',    t: ['wool_white'], cost: 0},
  {id: 19, k: 'black',  n: 'שחור',    t: ['black'], cost: 20},
  {id: 20, k: 'gold',   n: 'זהב',     t: ['gold'], cost: 60},
  {id: 21, k: 'lamp',   n: 'מנורה',   t: ['lamp'], cost: 40},
  {id: 30, k: 'tallgrass', n: 'עשב',      t: ['tallgrass'], cost: 0},
  {id: 31, k: 'flower_red', n: 'פרח אדום',  t: ['flower_red'], cost: 0},
  {id: 32, k: 'flower_yellow', n: 'פרח צהוב', t: ['flower_yellow'], cost: 0},
  {id: 33, k: 'flower_blue', n: 'פרח כחול',  t: ['flower_blue'], cost: 0},
  {id: 34, k: 'mushroom', n: 'פטרייה',   t: ['mushroom'], cost: 0}
];
H.VOX_LETTERS = 'אבגדהוזחטיכלמנסעפצקרשתךםןףץ';
H.VOX_FINAL = {'ך': 'כ', 'ם': 'מ', 'ן': 'נ', 'ף': 'פ', 'ץ': 'צ'};

H.vox = (function(){
  const {NX, NZ, NY, SEA, CH} = H.VOX;
  const AIR = 0, WATER = 10, LET0 = 64, TS = 32, COLS = 16;
  let gl = null, cv = null, progE = null, progM = null, progS = null, progB = null, running = false, last = 0;
  let blocks = null, S = null, mode = 'free', editMode = 'build', challenge = null, edits = new Map(), undo = [], dirtyT = 0, grp = null, pendingMesh = null;
  const cam = {yaw: .6, pitch: .5, dist: 8};
  const keys = {}, stick = {x: 0, y: 0, id: null}, ptr = new Map();
  let tap = null, pinch = 0, atlas = null, atlasTex = null, tileUrl = {};
  const chunks = {}, texS = {};
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const idx = (x, y, z) => (y * NZ + z) * NX + x;
  const rngOf = seed => () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };

  /* ---------- מרקמים ---------- */
  const TILES = ['grass_top','grass_side','dirt','stone','sand','log_side','log_top','leaves','planks','brick','glass','water',
    'wool_red','wool_orange','wool_yellow','wool_green','wool_blue','wool_purple','wool_pink','wool_white','black','gold','lamp',
    'tallgrass','flower_red','flower_yellow','flower_blue','mushroom'];
  const TI = {}; TILES.forEach((t, i) => TI[t] = i);
  const WOOL = {wool_red:[214,60,60], wool_orange:[240,140,40], wool_yellow:[245,210,60], wool_green:[80,180,70], wool_blue:[60,110,220], wool_purple:[140,90,210], wool_pink:[245,130,180], wool_white:[240,240,240]};
  function makeAtlas(){
    const W = COLS * TS, Hh = 8 * TS, c = document.createElement('canvas'); c.width = W; c.height = Hh;
    const x = c.getContext('2d'); x.imageSmoothingEnabled = false;
    const rgb = (a, f) => 'rgb(' + Math.round(clamp(a[0] * f, 0, 255)) + ',' + Math.round(clamp(a[1] * f, 0, 255)) + ',' + Math.round(clamp(a[2] * f, 0, 255)) + ')';
    TILES.forEach((name, ti) => {
      const ox = (ti % COLS) * TS, oy = Math.floor(ti / COLS) * TS, r = rngOf(ti * 977 + 13);
      const px = (i, j, col, a) => { x.globalAlpha = a === undefined ? 1 : a; x.fillStyle = col; x.fillRect(ox + i * 2, oy + j * 2, 2, 2); x.globalAlpha = 1; };
      const noise = (base, amp) => { for(let j = 0; j < 16; j++) for(let i = 0; i < 16; i++) px(i, j, rgb(base, 1 + (r() - .5) * amp)); };
      if(name === 'grass_top') noise([92, 176, 56], .32);
      else if(name === 'dirt') noise([134, 96, 60], .3);
      else if(name === 'grass_side'){ noise([134, 96, 60], .3);
        for(let i = 0; i < 16; i++){ const h = 3 + (r() < .5 ? 1 : 0) + (r() < .25 ? 1 : 0); for(let j = 0; j < h; j++) px(i, j, rgb([92, 176, 56], 1 + (r() - .5) * .32)); } }
      else if(name === 'stone'){ noise([125, 125, 130], .22); for(let k = 0; k < 18; k++) px(Math.floor(r() * 16), Math.floor(r() * 16), rgb([95, 95, 100], 1 + (r() - .5) * .2)); }
      else if(name === 'sand') noise([232, 214, 150], .16);
      else if(name === 'log_side'){ for(let i = 0; i < 16; i++){ const f = (i % 4 === 0) ? .78 : (i % 4 === 2 ? 1.08 : 1); for(let j = 0; j < 16; j++) px(i, j, rgb([110, 78, 44], f * (1 + (r() - .5) * .12))); } }
      else if(name === 'log_top'){ for(let j = 0; j < 16; j++) for(let i = 0; i < 16; i++){ const d = Math.max(Math.abs(i - 7.5), Math.abs(j - 7.5)); px(i, j, rgb(d > 6.5 ? [110, 78, 44] : [188, 150, 96], (Math.floor(d) % 2 ? .9 : 1.05) * (1 + (r() - .5) * .1))); } }
      else if(name === 'leaves'){ for(let j = 0; j < 16; j++) for(let i = 0; i < 16; i++){ if(r() < .18) continue; px(i, j, rgb([60, 150, 55], 1 + (r() - .5) * .55)); } }
      else if(name === 'planks'){ for(let j = 0; j < 16; j++) for(let i = 0; i < 16; i++){ const edge = (j % 4 === 3); px(i, j, rgb([184, 140, 82], (edge ? .72 : 1) * (1 + (r() - .5) * .12))); } }
      else if(name === 'brick'){ for(let j = 0; j < 16; j++) for(let i = 0; i < 16; i++){ const row = Math.floor(j / 4), off = (row % 2) * 4, mortar = (j % 4 === 3) || ((i + off) % 8 === 7); px(i, j, mortar ? rgb([190, 185, 175], 1 + (r() - .5) * .1) : rgb([168, 70, 52], 1 + (r() - .5) * .25)); } }
      else if(name === 'glass'){ for(let j = 0; j < 16; j++) for(let i = 0; i < 16; i++){ const e = (i === 0 || j === 0 || i === 15 || j === 15); const sh = (i - j === 3 || i - j === 4 || i - j === 8) && !e; px(i, j, sh ? 'rgb(255,255,255)' : (e ? 'rgb(190,230,245)' : 'rgb(180,225,245)'), e ? 1 : (sh ? .55 : .28)); } }
      else if(name === 'water'){ for(let j = 0; j < 16; j++) for(let i = 0; i < 16; i++) px(i, j, rgb([50, 110, 220], 1 + (r() - .5) * .2), .7); }
      else if(WOOL[name]) noise(WOOL[name], .14);
      else if(name === 'black') noise([40, 40, 48], .25);
      else if(name === 'gold'){ for(let j = 0; j < 16; j++) for(let i = 0; i < 16; i++){ const e = (i === 0 || j === 0 || i === 15 || j === 15); px(i, j, rgb(e ? [200, 150, 30] : [255, 215, 70], 1 + (r() - .5) * .18)); } for(let k = 0; k < 4; k++) px(3 + k, 3 + k, 'rgb(255,250,200)'); }
      else if(name === 'tallgrass'){ for(let i = 1; i < 16; i += 2){ const h = 5 + Math.floor(r() * 8), sw = (r() - .5) * 2; for(let j = 0; j < h; j++) px(i + (r() < .2 ? 1 : 0) + Math.round(sw * j / 8), 15 - j, rgb([70 + r() * 30, 170 + r() * 40, 50], 1 - j * .02)); } }
      else if(name.startsWith('flower_')){ const pc = name === 'flower_red' ? [225, 60, 70] : name === 'flower_yellow' ? [250, 215, 60] : [90, 130, 240];
        for(let j = 7; j < 16; j++) px(7, j, rgb([60, 150, 55], 1)), px(8, j, rgb([60, 150, 55], .9));
        px(4, 11, rgb([60, 150, 55], 1)); px(5, 12, rgb([60, 150, 55], 1)); px(10, 10, rgb([60, 150, 55], 1)); px(11, 11, rgb([60, 150, 55], 1));
        for(const [dx, dy] of [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]]) px(7 + dx + (dx > 0 ? 1 : 0), 5 + dy, rgb(pc, (dx || dy) ? 1 : 0.8));
        px(7, 5, rgb([255, 235, 120], 1)); px(8, 5, rgb([255, 235, 120], 1)); }
      else if(name === 'mushroom'){ for(let j = 9; j < 16; j++) for(let i = 6; i < 10; i++) px(i, j, rgb([235, 225, 205], 1 + (r() - .5) * .1));
        for(let j = 4; j < 10; j++) for(let i = 3; i < 13; i++){ if((j - 4) < 2 && (i < 5 || i > 10)) continue; px(i, j, rgb([210, 50, 50], 1 + (r() - .5) * .1)); }
        px(5, 6, 'rgb(255,255,255)'); px(9, 5, 'rgb(255,255,255)'); px(11, 7, 'rgb(255,255,255)'); }
      else if(name === 'lamp'){ for(let j = 0; j < 16; j++) for(let i = 0; i < 16; i++){ const bar = (i === 7 || i === 8 || j === 7 || j === 8); px(i, j, rgb(bar ? [200, 140, 50] : [255, 236, 150], 1 + (r() - .5) * .12)); } }
    });
    /* אריחי אותיות: רקע בהיר ומסגרת, האות בסגול */
    for(let li = 0; li < H.VOX_LETTERS.length; li++){
      const ti = LET0 + li, ox = (ti % COLS) * TS, oy = Math.floor(ti / COLS) * TS;
      x.fillStyle = '#9a6a30'; x.fillRect(ox, oy, TS, TS); x.fillStyle = '#f3e3b0'; x.fillRect(ox + 2, oy + 2, TS - 4, TS - 4);
      x.fillStyle = '#4a2f9c'; x.font = 'bold 26px "Arial Hebrew",Arial,sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(H.VOX_LETTERS[li], ox + TS / 2, oy + TS / 2 + 2);
    }
    return c;
  }
  const tileDataUrl = ti => {
    if(tileUrl[ti]) return tileUrl[ti];
    const c = document.createElement('canvas'); c.width = c.height = TS; c.getContext('2d').drawImage(atlas, (ti % COLS) * TS, Math.floor(ti / COLS) * TS, TS, TS, 0, 0, TS, TS);
    return tileUrl[ti] = c.toDataURL();
  };
  const BDEF = {}; H.VOX_BLOCKS.forEach(b => BDEF[b.id] = b);
  /* כל id -> אריחים לפאה עליונה/צדדית/תחתונה */
  function faceTiles(id){
    if(id >= LET0){ const t = LET0 + (id - LET0); return [t, t, t]; }
    if(id === WATER) return [TI.water, TI.water, TI.water];
    const b = BDEF[id]; if(!b) return [TI.stone, TI.stone, TI.stone];
    const t = b.t.map(n => TI[n]); return [t[0], t[1] === undefined ? t[0] : t[1], t[2] === undefined ? t[0] : t[2]];
  }
  const PLANT = id => id >= 30 && id < 40;
  const TRANSPARENT = id => id === AIR || id === 6 || id === 9 || id === WATER || PLANT(id);
  const SOLID = id => id !== AIR && id !== WATER && !PLANT(id);    /* אפשר לעמוד עליו / להתנגש בו */
  const AOSOLID = id => id !== AIR && id !== WATER && id !== 9 && !PLANT(id);
  const LIGHTBLOCK = id => id !== AIR && id !== WATER && id !== 9 && !PLANT(id);

  /* ---------- יצירת העולם ---------- */
  function noise2(seed){
    const hs = (x, z) => { let h = Math.imul(x * 374761393 + z * 668265263 + seed, 1274126177); h = Math.imul(h ^ h >>> 13, 1274126177); return ((h ^ h >>> 16) >>> 0) / 4294967296; };
    const sm = t => t * t * (3 - 2 * t);
    return (x, z) => { const xi = Math.floor(x), zi = Math.floor(z), fx = sm(x - xi), fz = sm(z - zi);
      const a = hs(xi, zi), b = hs(xi + 1, zi), c = hs(xi, zi + 1), d = hs(xi + 1, zi + 1);
      return (a + (b - a) * fx) * (1 - fz) + (c + (d - c) * fx) * fz; };
  }
  function generate(){
    blocks = new Uint8Array(NX * NY * NZ);
    const n1 = noise2(1337), cx = NX / 2, cz = NZ / 2, heights = new Int16Array(NX * NZ), rnd = rngOf(99);
    for(let z = 0; z < NZ; z++) for(let x = 0; x < NX; x++){
      const d = Math.hypot(x - cx, z - cz) / (NX * .5), f = n1(x / 16, z / 16) * .6 + n1(x / 8, z / 8) * .28 + n1(x / 4, z / 4) * .12;
      let h = Math.round(SEA - 5 + f * 15 - d * d * 11);
      const dc = Math.hypot(x - cx, z - cz); if(dc < 7) h = Math.round(h + (SEA + 2 - h) * (1 - dc / 7) * 1.0);   /* מישור לבנייה במרכז */
      h = clamp(h, 2, NY - 8); heights[z * NX + x] = h;
      for(let y = 0; y <= h; y++){
        let id = 3;
        if(y === h) id = (h <= SEA + 1) ? 4 : 1; else if(y >= h - 3) id = (h <= SEA + 1) ? 4 : 2;
        blocks[idx(x, y, z)] = id;
      }
      for(let y = h + 1; y <= SEA; y++) blocks[idx(x, y, z)] = WATER;
    }
    /* עצים */
    for(let k = 0; k < 90; k++){
      const x = 3 + Math.floor(rnd() * (NX - 6)), z = 3 + Math.floor(rnd() * (NZ - 6)), h = heights[z * NX + x];
      if(h <= SEA + 1 || Math.hypot(x - cx, z - cz) < 9 || blocks[idx(x, h, z)] !== 1) continue;
      const th = 4 + Math.floor(rnd() * 2);
      for(let y = 1; y <= th; y++) blocks[idx(x, h + y, z)] = 5;
      for(let dy = th - 1; dy <= th + 2; dy++){ const r = dy >= th + 1 ? 1 : 2;
        for(let dx = -r; dx <= r; dx++) for(let dz = -r; dz <= r; dz++){
          if(Math.abs(dx) === r && Math.abs(dz) === r && (dy === th + 2 || rnd() < .5)) continue;
          const xx = x + dx, zz = z + dz, yy = h + dy; if(xx < 0 || zz < 0 || xx >= NX || zz >= NZ || yy >= NY) continue;
          if(blocks[idx(xx, yy, zz)] === AIR) blocks[idx(xx, yy, zz)] = 6; } }
    }
    /* עשב ופרחים על הדשא */
    const pr = rngOf(555);
    for(let z = 1; z < NZ - 1; z++) for(let x = 1; x < NX - 1; x++){
      const h = heights[z * NX + x]; if(blocks[idx(x, h, z)] !== 1 || blocks[idx(x, h + 1, z)] !== AIR) continue;
      const q = pr(); if(q < .10) blocks[idx(x, h + 1, z)] = 30; else if(q < .125) blocks[idx(x, h + 1, z)] = 31 + Math.floor(pr() * 3); else if(q < .131) blocks[idx(x, h + 1, z)] = 34;
    }
    S0.spawn = {x: cx + .5, y: heights[Math.floor(cz) * NX + Math.floor(cx)] + 1.01, z: cz + .5};
    edits.forEach((id, i) => { blocks[i] = id; });
    computeLight();
  }

  /* ---------- תאורה: אור שמיים לפי גובה העמודה, ואור ממנורות ---------- */
  let topY = new Int16Array(NX * NZ), lamps = [];
  function updateTop(x, z){ let y = NY - 1; while(y > 0 && !LIGHTBLOCK(blocks[idx(x, y, z)])) y--; topY[z * NX + x] = y; }
  function computeLight(){
    for(let z = 0; z < NZ; z++) for(let x = 0; x < NX; x++) updateTop(x, z);
    lamps = []; for(let i = 0; i < blocks.length; i++) if(blocks[i] === 21){ const r = i % (NX * NZ); lamps.push([r % NX + .5, Math.floor(i / (NX * NZ)) + .5, Math.floor(r / NX) + .5]); }
  }
  const skyLit = (x, y, z) => (x < 0 || z < 0 || x >= NX || z >= NZ) ? 1 : (y > topY[z * NX + x] ? 1 : .36);
  function lampAt(px, py, pz){
    let m = 0;
    for(let k = 0; k < lamps.length; k++){ const l = lamps[k], dx = l[0] - px; if(dx > 8 || dx < -8) continue; const dz = l[2] - pz; if(dz > 8 || dz < -8) continue;
      const d = Math.hypot(dx, l[1] - py, dz); if(d < 8){ const v = 1 - d / 8; if(v > m) m = v; } }
    return m * (.6 + .4 * m);
  }

  /* ---------- בניית רשת (AO והסתרת פאות) ---------- */
  const get = (x, y, z) => (x < 0 || z < 0 || x >= NX || z >= NZ || y >= NY) ? AIR : (y < 0 ? 3 : blocks[idx(x, y, z)]);
  const AXU = [[2, 1], [0, 2], [0, 1]];                           /* לכל ציר פאה: צירי u,v */
  const FSHADE = [.80, 1.0, .68], AOF = [.5, .68, .84, 1];
  function buildChunk(cx, cz){
    const o = [], t = [];
    const x0 = cx * CH, z0 = cz * CH;
    const emit = (arr, x, y, z, a, s, ti, water) => {
      const [u, v] = a === 0 ? [2, 1] : (a === 1 ? [0, 2] : [0, 1]);
      const pos = [x, y, z], ao = [], P = [], sky = [], blk = [];
      for(let c = 0; c < 4; c++){
        const cu = c === 1 || c === 2 ? 1 : 0, cvv = c >= 2 ? 1 : 0;
        const q = pos.slice(); q[a] += s > 0 ? 1 : 0; q[u] += cu; q[v] += cvv;
        if(water && a === 1 && s > 0) q[1] -= .12;
        P.push(q);
        const nb = pos.slice(); nb[a] += s;
        const su = cu ? 1 : -1, sv = cvv ? 1 : -1;
        const s1 = nb.slice(), s2 = nb.slice(), cc = nb.slice(); s1[u] += su; s2[v] += sv; cc[u] += su; cc[v] += sv;
        const i1 = get(s1[0], s1[1], s1[2]), i2 = get(s2[0], s2[1], s2[2]), ic = get(cc[0], cc[1], cc[2]);
        const A = AOSOLID(i1) ? 1 : 0, B2 = AOSOLID(i2) ? 1 : 0, C = AOSOLID(ic) ? 1 : 0;
        ao.push(A && B2 ? 0 : 3 - (A + B2 + C));
        /* אור שמיים: ממוצע של התאים הפנויים סביב הקודקוד, כדי שהצל יתמזג בהדרגה */
        let sv2 = skyLit(nb[0], nb[1], nb[2]), cnt = 1;
        if(!AOSOLID(i1)){ sv2 += skyLit(s1[0], s1[1], s1[2]); cnt++; }
        if(!AOSOLID(i2)){ sv2 += skyLit(s2[0], s2[1], s2[2]); cnt++; }
        if(!AOSOLID(ic)){ sv2 += skyLit(cc[0], cc[1], cc[2]); cnt++; }
        sky.push(sv2 / cnt);
        blk.push(lamps.length ? lampAt(q[0] + (a === 0 ? s * .3 : 0), q[1] + (a === 1 ? s * .3 : 0), q[2] + (a === 2 ? s * .3 : 0)) : 0);
      }
      const tx = (ti % COLS) * TS, ty = Math.floor(ti / COLS) * TS, e = .35;
      const u0 = (tx + e) / (COLS * TS), u1 = (tx + TS - e) / (COLS * TS), v0 = (ty + e) / (8 * TS), v1 = (ty + TS - e) / (8 * TS);
      const flip = a === 0 ? s > 0 : (a === 2 ? s < 0 : false);
      const uv = [];
      for(let c = 0; c < 4; c++){
        const cu = c === 1 || c === 2 ? 1 : 0, cvv = c >= 2 ? 1 : 0;
        const uu = (flip ? 1 - cu : cu), vv = 1 - cvv;
        uv.push([u0 + (u1 - u0) * uu, v0 + (v1 - v0) * vv]);
      }
      const fs = a === 1 ? (s > 0 ? FSHADE[1] : .55) : FSHADE[a === 0 ? 0 : 2];
      const sh = ao.map(k => fs * AOF[k]);
      const order = (ao[0] + ao[2] > ao[1] + ao[3]) ? [1, 2, 3, 1, 3, 0] : [0, 1, 2, 0, 2, 3];
      order.forEach(c => arr.push(P[c][0], P[c][1], P[c][2], uv[c][0], uv[c][1], sh[c] * sky[c], sh[c] * blk[c]));
    };
    /* צמחים: שני מישורים אלכסוניים עם שקיפות */
    const cross = (arr, x, y, z, ti) => {
      const tx = (ti % COLS) * TS, ty = Math.floor(ti / COLS) * TS, e = .35;
      const u0 = (tx + e) / (COLS * TS), u1 = (tx + TS - e) / (COLS * TS), v0 = (ty + e) / (8 * TS), v1 = (ty + TS - e) / (8 * TS);
      const sk = skyLit(x, y, z) * .95, bl = lamps.length ? lampAt(x + .5, y + .5, z + .5) * .95 : 0;
      for(const [ax, az, bx, bz] of [[0.1, 0.1, 0.9, 0.9], [0.1, 0.9, 0.9, 0.1]]){
        const A = [x + ax, y, z + az], B = [x + bx, y, z + bz], C = [x + bx, y + 1, z + bz], D = [x + ax, y + 1, z + az];
        [[A, u0, v1], [B, u1, v1], [C, u1, v0], [A, u0, v1], [C, u1, v0], [D, u0, v0]].forEach(q => arr.push(q[0][0], q[0][1], q[0][2], q[1], q[2], sk, bl));
      }
    };
    for(let y = 0; y < NY; y++) for(let z = z0; z < z0 + CH; z++) for(let x = x0; x < x0 + CH; x++){
      const id = blocks[idx(x, y, z)]; if(id === AIR) continue;
      if(PLANT(id)){ cross(o, x, y, z, faceTiles(id)[1]); continue; }
      const ft = faceTiles(id), isW = id === WATER, trans = isW || id === 9, arr = trans ? t : o;
      for(let a = 0; a < 3; a++) for(const s of [1, -1]){
        const n = [x, y, z]; n[a] += s;
        const nid = (n[1] < 0) ? 3 : get(n[0], n[1], n[2]);
        let vis;
        if(isW) vis = nid === AIR || PLANT(nid);
        else if(id === 9) vis = nid === AIR || nid === WATER || PLANT(nid);
        else if(id === 6) vis = TRANSPARENT(nid) && nid !== 6;
        else vis = TRANSPARENT(nid);
        if(!vis) continue;
        const ti = a === 1 ? (s > 0 ? ft[0] : ft[2]) : ft[1];
        emit(arr, x, y, z, a, s, ti, isW);
      }
    }
    return {o: new Float32Array(o), t: new Float32Array(t)};
  }
  const upload = (arr) => { const b = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b); gl.bufferData(gl.ARRAY_BUFFER, arr, gl.STATIC_DRAW); return {b, n: arr.length / 7}; };
  function remesh(cx, cz){
    if(cx < 0 || cz < 0 || cx >= NX / CH || cz >= NZ / CH) return;
    const key = cx + ',' + cz, m = buildChunk(cx, cz), old = chunks[key];
    if(old){ if(old.o) gl.deleteBuffer(old.o.b); if(old.t) gl.deleteBuffer(old.t.b); }
    chunks[key] = {o: m.o.length ? upload(m.o) : null, t: m.t.length ? upload(m.t) : null};
  }
  function remeshAll(){ for(let cz = 0; cz < NZ / CH; cz++) for(let cx = 0; cx < NX / CH; cx++) remesh(cx, cz); }
  function remeshRadius(x, z, r){
    const keys = new Set();
    for(let dx = -r; dx <= r; dx += r) for(let dz = -r; dz <= r; dz += r) keys.add(Math.floor((x + dx) / CH) + ',' + Math.floor((z + dz) / CH));
    keys.forEach(k => { const [a, b] = k.split(',').map(Number); remesh(a, b); });
  }
  function remeshAround(x, z){
    const cx = Math.floor(x / CH), cz = Math.floor(z / CH); const set = new Set();
    for(let dx = -1; dx <= 1; dx++) for(let dz = -1; dz <= 1; dz++){ const px = x + dx, pz = z + dz; set.add(Math.floor(px / CH) + ',' + Math.floor(pz / CH)); }
    set.forEach(k => { const [a, b] = k.split(',').map(Number); remesh(a, b); });
  }

  /* ---------- ציור ---------- */
  const S0 = {};
  function compile(vs, fs){
    const sh = (ty, s) => { const o = gl.createShader(ty); gl.shaderSource(o, s); gl.compileShader(o); if(!gl.getShaderParameter(o, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(o)); return o; };
    const p = gl.createProgram(); gl.attachShader(p, sh(gl.VERTEX_SHADER, vs)); gl.attachShader(p, sh(gl.FRAGMENT_SHADER, fs)); gl.linkProgram(p);
    if(!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p)); return p;
  }
  function persp(f, a, n, fa){ const t = 1 / Math.tan(f / 2), o = new Float32Array(16); o[0] = t / a; o[5] = t; o[10] = (fa + n) / (n - fa); o[11] = -1; o[14] = 2 * fa * n / (n - fa); return o; }
  function look(e, c){
    let zx = e[0]-c[0], zy = e[1]-c[1], zz = e[2]-c[2], l = Math.hypot(zx, zy, zz); zx/=l; zy/=l; zz/=l;
    let xx = zz, xz = -zx; l = Math.hypot(xx, 0, xz); xx/=l; xz/=l;
    const yx = zy*xz, yy = zz*xx - zx*xz, yz = -zy*xx;
    return {m: new Float32Array([xx,yx,zx,0, 0,yy,zy,0, xz,yz,zz,0, -(xx*e[0]+xz*e[2]), -(yx*e[0]+yy*e[1]+yz*e[2]), -(zx*e[0]+zy*e[1]+zz*e[2]), 1]), right:[xx,0,xz], up:[yx,yy,yz], fwd:[-zx,-zy,-zz]};
  }
  function mul(a, b){ const o = new Float32Array(16); for(let i = 0; i < 4; i++) for(let j = 0; j < 4; j++){ let s = 0; for(let k = 0; k < 4; k++) s += a[k*4+j] * b[i*4+k]; o[i*4+j] = s; } return o; }
  function texOf(key, w, h, draw){
    if(texS[key]) return texS[key];
    const c = document.createElement('canvas'); c.width = w; c.height = h; const x = c.getContext('2d'); x.textAlign = 'center'; x.textBaseline = 'middle'; draw(x, w, h);
    const t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, c); gl.generateMipmap(gl.TEXTURE_2D);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    return texS[key] = t;
  }
  const emojiTex = e => texOf('e' + e, 256, 256, (x, w, h) => { x.font = '190px serif'; x.fillText(e, w/2, h/2 + 12); });
  const avatarTex = () => { const a = (H.AVATARS.find(v => v.id === H.state.avatar) || H.AVATARS[0]).e, hat = (H.HATS.find(v => v.id === H.state.hat) || {}).e || '';
    return texOf('av' + a + hat, 256, 256, (x, w, h) => { x.font = '170px serif'; x.fillText(a, w/2, 156); if(hat){ x.font = '100px serif'; x.fillText(hat, w/2, 46); } }); };

  function initGL(){
    if(gl) return true;
    cv = H.$('vxcv');
    gl = cv.getContext('webgl', {antialias: true, alpha: false}) || cv.getContext('experimental-webgl');
    if(!gl) return false;
    try{
      progM = compile('attribute vec3 p;attribute vec2 t;attribute float s;attribute float b;uniform mat4 vp;uniform vec3 cam;varying vec2 uv;varying float sh;varying float bl;varying float vd;' +
        'void main(){gl_Position=vp*vec4(p,1.);uv=t;sh=s;bl=b;vd=length(p-cam);}',
        'precision mediump float;varying vec2 uv;varying float sh;varying float bl;varying float vd;uniform sampler2D tx;uniform vec3 fog;uniform float cut;uniform vec3 tint;uniform float amb;' +
        'void main(){vec4 c=texture2D(tx,uv);if(c.a<cut)discard;float sky=sh*amb;float l=max(sky,bl);vec3 warm=mix(vec3(1.),vec3(1.2,.95,.7),clamp((bl-sky)*2.2,0.,1.));' +
        'float f=clamp((vd-45.)/80.,0.,1.);gl_FragColor=vec4(mix(c.rgb*l*tint*warm,fog,f),c.a);}');
      progE = compile('attribute vec3 p;attribute vec3 n;attribute vec3 c;uniform mat4 vp;uniform mat4 m;uniform vec3 cam;varying vec3 vc;varying float vd;' +
        'void main(){vec4 w=m*vec4(p,1.);gl_Position=vp*w;vec3 nn=normalize((m*vec4(n,0.)).xyz);float l=max(dot(nn,normalize(vec3(.5,1.,.35))),0.);vc=c*(.55+.45*l);vd=length(w.xyz-cam);}',
        'precision mediump float;varying vec3 vc;varying float vd;uniform vec3 fog;uniform float lum;uniform vec3 tint;void main(){float f=clamp((vd-45.)/80.,0.,1.);gl_FragColor=vec4(mix(vc*lum*tint,fog,f),1.);}');
      progS = compile('attribute vec2 q;uniform mat4 vp;uniform vec3 ctr;uniform vec2 sz;uniform vec3 rt;uniform vec3 up;varying vec2 uv;' +
        'void main(){uv=vec2(q.x*.5+.5,.5-q.y*.5);vec3 w=ctr+rt*q.x*sz.x+up*q.y*sz.y;gl_Position=vp*vec4(w,1.);}',
        'precision mediump float;varying vec2 uv;uniform sampler2D tx;void main(){vec4 c=texture2D(tx,uv);if(c.a<.06)discard;gl_FragColor=c;}');
      progB = compile('attribute vec2 q;varying float y;void main(){y=q.y;gl_Position=vec4(q,.999,1.);}',
        'precision mediump float;varying float y;uniform vec3 hz;uniform vec3 zn;uniform float hy;void main(){float u=clamp((y-hy)/max(.05,1.-hy),0.,1.);u=pow(u,.7);gl_FragColor=vec4(mix(hz,zn,u),1.);}');
    }catch(e){ console.warn(e); gl = null; return false; }
    gl.enable(gl.DEPTH_TEST); gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    S0.quad = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, S0.quad); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 1,-1, 1,1, -1,-1, 1,1, -1,1]), gl.STATIC_DRAW);
    atlas = makeAtlas();
    atlasTex = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, atlasTex); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, atlas);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    return true;
  }
  const theme = () => H.WORLD_THEMES[H.state.bg] || H.WORLD_THEMES.day;
  /* שעה ביום: 0 חצות, .25 זריחה, .5 צהריים, .75 שקיעה. מחזור מלא בעשר דקות. */
  const smoothstep = (a, b, v) => { const t = clamp((v - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
  function dayInfo(){
    const th = theme(), a = (S.tod - .25) * 6.2832, sunH = Math.sin(a), k = smoothstep(-.18, .22, sunH);
    const night = [.03, .04, .13], w = Math.exp(-Math.pow(sunH / .22, 2)) * (1 - Math.abs(Math.sin(a - 1.5708)) * .0) * .38;
    const sky = [0, 1, 2].map(i => clamp(night[i] + (th.sky[i] - night[i]) * k + [1, .5, .25][i] * w * (k > .02 && k < .98 ? 1 : .25), 0, 1));
    return {a, sunH, k, amb: .3 + .7 * k, sky};
  }
  const STARS = (() => { const r = rngOf(31), out = []; for(let i = 0; i < 46; i++){ const az = r() * 6.2832, el = .15 + r() * 1.2; out.push([Math.cos(az) * Math.cos(el), Math.sin(el), Math.sin(az) * Math.cos(el)]); } return out; })();

  /* ---------- קרן (DDA) ---------- */
  const RAYABLE = id => id !== AIR && id !== WATER;
  function ray(o, d, maxD, plants){
    let x = Math.floor(o[0]), y = Math.floor(o[1]), z = Math.floor(o[2]);
    const sx = d[0] > 0 ? 1 : -1, sy = d[1] > 0 ? 1 : -1, sz = d[2] > 0 ? 1 : -1;
    const tdx = d[0] ? Math.abs(1 / d[0]) : 1e9, tdy = d[1] ? Math.abs(1 / d[1]) : 1e9, tdz = d[2] ? Math.abs(1 / d[2]) : 1e9;
    let tx = d[0] ? ((d[0] > 0 ? x + 1 - o[0] : o[0] - x) * tdx) : 1e9, ty = d[1] ? ((d[1] > 0 ? y + 1 - o[1] : o[1] - y) * tdy) : 1e9, tz = d[2] ? ((d[2] > 0 ? z + 1 - o[2] : o[2] - z) * tdz) : 1e9;
    let nx = 0, ny = 0, nz = 0, t = 0;
    for(let i = 0; i < 200 && t <= maxD; i++){
      if((plants ? RAYABLE : SOLID)(get(x, y, z)) && !(x < 0 || z < 0 || x >= NX || z >= NZ)) return {x, y, z, nx, ny, nz, t};
      if(tx < ty && tx < tz){ x += sx; t = tx; tx += tdx; nx = -sx; ny = 0; nz = 0; }
      else if(ty < tz){ y += sy; t = ty; ty += tdy; nx = 0; ny = -sy; nz = 0; }
      else { z += sz; t = tz; tz += tdz; nx = 0; ny = 0; nz = -sz; }
    }
    return null;
  }

  /* ---------- שחקן ופיזיקה ---------- */
  const HW = .3, PH = 1.8;
  const solidAt = (x, y, z) => SOLID(get(Math.floor(x), Math.floor(y), Math.floor(z)));
  function collides(px, py, pz){
    for(let dx = -HW; dx <= HW; dx += HW) for(let dz = -HW; dz <= HW; dz += HW) for(let dy = 0; dy <= PH; dy += PH / 2){
      if(solidAt(px + dx, py + dy + .001, pz + dz)) return true; }
    return false;
  }
  const inWater = (p) => get(Math.floor(p.x), Math.floor(p.y + .6), Math.floor(p.z)) === WATER;
  function physics(dt){
    const p = S.p; let ix = stick.x, iy = stick.y;
    if(keys.ArrowLeft || keys.a) ix -= 1; if(keys.ArrowRight || keys.d) ix += 1;
    if(keys.ArrowUp || keys.w) iy -= 1; if(keys.ArrowDown || keys.s) iy += 1;
    const mag = Math.min(1, Math.hypot(ix, iy)), wet = inWater(p), speed = (wet ? 2.6 : 4.6);
    let vx = 0, vz = 0;
    if(mag > .12){
      const fx = -Math.sin(cam.yaw), fz = -Math.cos(cam.yaw), rx = Math.cos(cam.yaw), rz = -Math.sin(cam.yaw);
      const dx = fx * -iy + rx * ix, dz = fz * -iy + rz * ix, l = Math.hypot(dx, dz) || 1;
      vx = dx / l * speed * mag; vz = dz / l * speed * mag; p.face = dx > 0 ? 1 : -1; p.walk += dt * 10;
    }
    if((S.jump || keys[' ']) && (p.ground || wet)){ p.vy = wet ? 3.2 : 7.7; p.ground = false; }
    p.vy -= (wet ? 8 : 24) * dt; if(wet) p.vy = Math.max(p.vy, -3); p.vy = Math.max(p.vy, -30);
    let nx = p.x + vx * dt, nz = p.z + vz * dt, blocked = false;
    if(!collides(nx, p.y, p.z)) p.x = nx; else blocked = true;
    if(!collides(p.x, p.y, nz)) p.z = nz; else blocked = true;
    if(blocked && p.ground && mag > .3 && !collides(p.x + vx * .1, p.y + 1.05, p.z + vz * .1)){ p.vy = 7.2; p.ground = false; }   /* קפיצה אוטומטית על מדרגה */
    const ny = p.y + p.vy * dt;
    if(!collides(p.x, ny, p.z)){ p.y = ny; p.ground = false; }
    else {
      if(p.vy < 0){ p.y = Math.floor(ny + .001) + 1; p.ground = true; }          /* נוחתים בדיוק על פני הבלוק */
      else p.y = Math.floor(ny + PH) - PH - .002;                                 /* מכים בראש */
      p.vy = 0;
    }
    p.x = clamp(p.x, 1, NX - 1); p.z = clamp(p.z, 1, NZ - 1);
    if(p.y < -5){ p.x = S0.spawn.x; p.y = S0.spawn.y; p.z = S0.spawn.z; p.vy = 0; }
    S.jump = false;
    if(collides(p.x, p.y, p.z)) p.y += .25;                                    /* נתקענו בתוך בלוק (למשל אחרי בנייה): עולים */
    const pet = S.pet, d = Math.hypot(p.x - pet.x, p.z - pet.z);
    if(d > 1.8){ const k = Math.min(1, dt * 3); pet.x += (p.x - pet.x) * k * (1 - 1.5 / d); pet.z += (p.z - pet.z) * k * (1 - 1.5 / d); }
    pet.y += (p.y - pet.y) * Math.min(1, dt * 6);
  }

  /* ---------- בנייה ושבירה ---------- */
  function setBlock(x, y, z, id, record){
    if(x < 0 || z < 0 || x >= NX || z >= NZ || y < 1 || y >= NY) return false;
    const i = idx(x, y, z), old = blocks[i];
    if(record !== false){
      if(edits.size >= 5000 && !edits.has(i)){ H.toast('הגעת למקסימום בלוקים שנשמרים', 'no'); return false; }
      if(grp) grp.push([i, old]); else { undo.push([[i, old]]); if(undo.length > 60) undo.shift(); }
      edits.set(i, id);
    }
    blocks[i] = id; updateTop(x, z);
    const lampChange = old === 21 || id === 21;
    if(lampChange){ lamps = lamps.filter(l => !(Math.floor(l[0]) === x && Math.floor(l[1]) === y && Math.floor(l[2]) === z)); if(id === 21) lamps.push([x + .5, y + .5, z + .5]); }
    if(pendingMesh) pendingMesh.push([x, z]);
    else if(lampChange) remeshRadius(x, z, 9);
    else remeshAround(x, z);
    markDirty(); return true;
  }
  const markDirty = () => { dirtyT = performance.now(); };
  function act(hit){
    if(!hit) return;
    const p = S.p, cx = hit.x + .5, cy = hit.y + .5, cz = hit.z + .5;
    if(Math.hypot(cx - p.x, cy - (p.y + 1), cz - p.z) > 7.5){ H.toast('רחוק מדי. התקרב'); return; }
    if(editMode === 'stamp') return placeStamp(hit);
    if(editMode === 'break'){
      if(hit.y <= 0) return;
      const id = get(hit.x, hit.y, hit.z); if(id === 3 && hit.y <= 1) return;
      setBlock(hit.x, hit.y, hit.z, AIR); H.sfx.tap();
    } else {
      const id = S.hot[S.sel]; if(!id) return;
      if(!owned(id)) return buyBlock(id);
      const onPlant = PLANT(get(hit.x, hit.y, hit.z));
      const nx = onPlant ? hit.x : hit.x + hit.nx, ny = onPlant ? hit.y : hit.y + hit.ny, nz = onPlant ? hit.z : hit.z + hit.nz;
      const cur = get(nx, ny, nz); if(cur !== AIR && cur !== WATER && !PLANT(cur)) return;
      /* לא מניחים בלוק על השחקן */
      const bx0 = nx, bx1 = nx + 1, by0 = ny, by1 = ny + 1, bz0 = nz, bz1 = nz + 1;
      if(p.x + HW > bx0 && p.x - HW < bx1 && p.z + HW > bz0 && p.z - HW < bz1 && p.y + PH > by0 && p.y < by1) return;
      if(setBlock(nx, ny, nz, id)){ H.sfx.tap(); checkWord(); }
    }
  }
  function owned(id){
    if(id >= LET0) return letterOpen(H.VOX_LETTERS[id - LET0]);
    const b = BDEF[id]; return !b || !b.cost || H.owns('blk_' + b.k);
  }
  function buyBlock(id){
    const b = BDEF[id];
    if(!b) return H.toast('האות הזאת עוד נעולה. למד מילה עם האות 🔒');
    if(H.state.coins < b.cost) return H.toast('צריך ' + b.cost + ' 🪙 לבלוק הזה', 'no');
    if(H.buy('blk_' + b.k, b.cost)){ H.toast('קנית: ' + b.n + ' 🎉', 'good'); renderBar(); renderTop(); }
  }
  function letterOpen(ch){
    if(challenge && challenge.letters.includes(ch)) return true;
    const base = H.VOX_FINAL[ch] || ch;
    return unlocked().has(ch) || unlocked().has(base);
  }
  /* אותיות שנפתחו: כל אות שמופיעה במילה שנלמדה (באלבום) */
  let unl = null, unlKey = '';
  function unlocked(){
    const key = H.state.album.length + ':' + H.state.packs.length;
    if(unl && key === unlKey) return unl;
    const set = new Set(); H.state.album.forEach(w => { for(const c of String(w)) if(H.VOX_LETTERS.includes(c)) set.add(c); });
    unlKey = key; return unl = set;
  }

  /* ---------- תבניות בנייה (נוצרו ב-Blender) ---------- */
  const TPL = {};
  (H.VOX_TEMPLATES || []).forEach(t => {
    const bin = atob(t.v), vox = []; for(let i = 0; i + 3 < bin.length; i += 4) vox.push([bin.charCodeAt(i), bin.charCodeAt(i+1), bin.charCodeAt(i+2), bin.charCodeAt(i+3)]);
    TPL[t.id] = {id: t.id, n: t.n, size: t.size, vox, png: 'data:image/png;base64,' + t.png};
  });
  /* סיבוב ברבעי סיבוב: (x,z) -> (-z,x), ואז מיישרים לפינה */
  function rotated(t, k){
    let v = t.vox.map(a => [a[0], a[1], a[2], a[3]]), w = t.size[0], d = t.size[2];
    for(let r = 0; r < k; r++){ v = v.map(a => [d - 1 - a[2], a[1], a[0], a[3]]); const tmp = w; w = d; d = tmp; }
    return {v, w, d};
  }
  /* הדלת בתבניות פונה ל-z=0 (כלפי "צפון"). מסובבים כך שתפנה אל המצלמה. */
  function faceRot(){
    const sx = Math.sin(cam.yaw), cz = Math.cos(cam.yaw);
    if(Math.abs(sx) > Math.abs(cz)) return sx > 0 ? 1 : 3;
    return cz > 0 ? 2 : 0;
  }
  function placeStamp(hit){
    const t = TPL[S.stamp]; if(!t) return;
    const R = rotated(t, S.rot || 0);
    const ax = hit.x + hit.nx - Math.floor(R.w / 2), ay = hit.y + hit.ny, az = hit.z + hit.nz - Math.floor(R.d / 2);
    if(edits.size + R.v.length > 5000){ H.toast('אין מקום בשמירה לתבנית הזאת. נקה קצת', 'no'); return; }
    const p = S.p; let placed = 0; grp = []; pendingMesh = [];
    R.v.forEach(a => {
      const x = ax + a[0], y = ay + a[1], z = az + a[2]; if(x < 1 || z < 1 || x >= NX - 1 || z >= NZ - 1 || y < 1 || y >= NY - 1) return;
      const cur = blocks[idx(x, y, z)]; if(cur !== AIR && cur !== WATER && cur !== 6 && !PLANT(cur)) return;               /* לא דורסים קרקע */
      if(a[3] === 0) return;
      if(p.x + HW > x && p.x - HW < x + 1 && p.z + HW > z && p.z - HW < z + 1 && p.y + PH > y && p.y < y + 1) return;
      if(setBlock(x, y, z, a[3])) placed++;
    });
    const g = grp, pm = pendingMesh; grp = null; pendingMesh = null;
    if(g.length){ undo.push(g); if(undo.length > 60) undo.shift(); }
    computeLight();
    const keys = new Set(); pm.forEach(([x, z]) => { for(let dx = -9; dx <= 9; dx += 9) for(let dz = -9; dz <= 9; dz += 9) keys.add(Math.floor((x + dx) / CH) + ',' + Math.floor((z + dz) / CH)); });
    keys.forEach(kk => { const [a, b] = kk.split(',').map(Number); remesh(a, b); });
    H.sfx.tap(); H.toast('🏗️ ' + t.n + ': ' + placed + ' בלוקים (אפשר לבטל)', 'good'); renderTop(); checkWord();
  }
  function pickStamp(id){
    S.stamp = id; S.rot = faceRot(); editMode = 'stamp';
    H.$('vxpal').style.display = 'none'; renderBar(); renderTop();
    H.toast('לחץ על הקרקע כדי להניח: ' + TPL[id].n);
  }

  /* ---------- חיות (נבנו ב-Blender) ---------- */
  const mT = (x, y, z) => new Float32Array([1,0,0,0, 0,1,0,0, 0,0,1,0, x,y,z,1]);
  const mRY = a => { const c = Math.cos(a), s = Math.sin(a); return new Float32Array([c,0,-s,0, 0,1,0,0, s,0,c,0, 0,0,0,1]); };
  const mRX = a => { const c = Math.cos(a), s = Math.sin(a); return new Float32Array([1,0,0,0, 0,c,s,0, 0,-s,c,0, 0,0,0,1]); };
  const mRZ = a => { const c = Math.cos(a), s = Math.sin(a); return new Float32Array([c,s,0,0, -s,c,0,0, 0,0,1,0, 0,0,0,1]); };
  const MOBBUF = {};
  function mobBuffers(){
    if(MOBBUF.done) return MOBBUF; MOBBUF.done = true;
    const b64 = t => { const bin = atob(t), a = new Uint8Array(bin.length); for(let i = 0; i < bin.length; i++) a[i] = bin.charCodeAt(i); return a; };
    Object.keys(H.MOBS || {}).forEach(k => {
      MOBBUF[k] = {};
      H.MOBS[k].parts.forEach(pt => {
        const raw = b64(pt.v), i16 = new Int16Array(raw.buffer.slice(raw.byteOffset, raw.byteOffset + raw.length)), cols = b64(pt.c), n = pt.n;
        const P = new Float32Array(n * 9), N = new Float32Array(n * 9), C = new Float32Array(n * 9);
        for(let i = 0; i < n; i++){
          for(let j = 0; j < 9; j++) P[i*9+j] = i16[i*9+j] / 256;
          const ux = P[i*9+3]-P[i*9], uy = P[i*9+4]-P[i*9+1], uz = P[i*9+5]-P[i*9+2], vx = P[i*9+6]-P[i*9], vy = P[i*9+7]-P[i*9+1], vz = P[i*9+8]-P[i*9+2];
          let nx = uy*vz-uz*vy, ny = uz*vx-ux*vz, nz = ux*vy-uy*vx; const l = Math.hypot(nx, ny, nz) || 1; nx/=l; ny/=l; nz/=l;
          for(let v = 0; v < 3; v++){ N[i*9+v*3] = nx; N[i*9+v*3+1] = ny; N[i*9+v*3+2] = nz; C[i*9+v*3] = cols[i*3]/255; C[i*9+v*3+1] = cols[i*3+1]/255; C[i*9+v*3+2] = cols[i*3+2]/255; }
        }
        const mk = a => { const b = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b); gl.bufferData(gl.ARRAY_BUFFER, a, gl.STATIC_DRAW); return b; };
        MOBBUF[k][pt.p] = {p: mk(P), n: mk(N), c: mk(C), count: n * 3, pivot: pt.pivot};
      });
    });
    return MOBBUF;
  }
  function groundY(x, z, y){
    const xi = Math.floor(x), zi = Math.floor(z); if(xi < 1 || zi < 1 || xi >= NX - 1 || zi >= NZ - 1) return null;
    for(let yy = Math.floor(y) + 2; yy >= Math.floor(y) - 3; yy--){
      if(SOLID(get(xi, yy, zi)) && !SOLID(get(xi, yy + 1, zi)) && !SOLID(get(xi, yy + 2, zi))) return get(xi, yy + 1, zi) === WATER ? null : yy + 1;
    }
    return null;
  }
  function spawnMobs(){
    const r = rngOf(777), kinds = ['pig','pig','pig','pig','pig','pig','sheep','sheep','sheep','sheep','sheep','sheep','cow','cow','cow','cow','cow','chicken','chicken','chicken','chicken','chicken','chicken'], out = [];
    for(const kind of kinds){
      for(let tries = 0; tries < 60; tries++){
        const x = 6 + r() * (NX - 12), z = 6 + r() * (NZ - 12), xi = Math.floor(x), zi = Math.floor(z), y = topY[zi * NX + xi] + 1;
        if(get(xi, y - 1, zi) !== 1 || !(get(xi, y, zi) === AIR || PLANT(get(xi, y, zi)))) continue;      /* רק על דשא פנוי */
        out.push({kind, x, y, z, h: r() * 6.28, wait: r() * 3, walk: false, ph: r() * 6, graze: 0, heart: 0});
        break;
      }
    }
    return out;
  }
  function updateMobs(dt){
    S.mobs.forEach(m => {
      const def = H.MOBS[m.kind]; if(!def) return;
      if(m.heart > 0) m.heart -= dt;
      m.wait -= dt;
      if(m.wait <= 0){
        if(m.walk){ m.walk = false; m.wait = 1.5 + Math.random() * 4; m.graze = Math.random() < .5 ? 1.4 : 0; }
        else { m.walk = true; m.wait = 2 + Math.random() * 4; m.h += (Math.random() - .5) * 3.4; m.graze = 0; }
      }
      if(m.graze > 0) m.graze -= dt;
      if(m.walk){
        const sp = def.speed * dt, nx = m.x + Math.sin(m.h) * sp, nz = m.z + Math.cos(m.h) * sp, ny = groundY(nx, nz, m.y);
        if(ny === null || Math.abs(ny - m.y) > 1.05){ m.h += 1.6 + Math.random() * 1.5; m.wait = Math.min(m.wait, .1 + Math.random() * .4); }
        else { m.x = nx; m.z = nz; m.y += (ny - m.y) * Math.min(1, dt * 12); m.ph += dt * def.speed * 7.5; }
      } else {
        const ny = groundY(m.x, m.z, m.y + 1); if(ny !== null) m.y += (ny - m.y) * Math.min(1, dt * 12);
      }
    });
  }
  function drawMobs(c){
    const B = mobBuffers(), th = theme();
    gl.useProgram(progE);
    gl.uniformMatrix4fv(gl.getUniformLocation(progE, 'vp'), false, c.vp); gl.uniform3fv(gl.getUniformLocation(progE, 'cam'), c.eye);
    gl.uniform3fv(gl.getUniformLocation(progE, 'fog'), S.day.sky); gl.uniform3fv(gl.getUniformLocation(progE, 'tint'), new Float32Array(th.tint));
    const lp = gl.getAttribLocation(progE, 'p'), ln = gl.getAttribLocation(progE, 'n'), lc = gl.getAttribLocation(progE, 'c'), um = gl.getUniformLocation(progE, 'm'), ul = gl.getUniformLocation(progE, 'lum');
    S.mobs.forEach(m => {
      const parts = B[m.kind]; if(!parts) return;
      const xi = Math.floor(m.x), zi = Math.floor(m.z), lit = skyLit(xi, Math.floor(m.y) + 1, zi);
      gl.uniform1f(ul, Math.max(lit * S.day.amb, lampAt(m.x, m.y + .6, m.z)) * 1.05);
      const base = mul(mT(m.x, m.y, m.z), mRY(m.h)), bird = H.MOBS[m.kind].kind === 'bird', sw = m.walk ? Math.sin(m.ph) * .75 : 0;
      for(const pn in parts){
        const pt = parts[pn]; let M = base;
        const a = pn === 'legFL' || pn === 'legBR' ? sw : (pn === 'legFR' || pn === 'legBL' ? -sw : 0);
        if(pn.startsWith('leg') && a) M = mul(M, mul(mT(pt.pivot[0], pt.pivot[1], pt.pivot[2]), mul(mRX(a), mT(-pt.pivot[0], -pt.pivot[1], -pt.pivot[2]))));
        else if(pn === 'wingL' || pn === 'wingR'){ const f = bird && m.walk ? Math.sin(m.ph * 2.2) * .7 : 0, an = pn === 'wingL' ? f : -f;
          if(f) M = mul(M, mul(mT(pt.pivot[0], pt.pivot[1], pt.pivot[2]), mul(mRZ(an), mT(-pt.pivot[0], -pt.pivot[1], -pt.pivot[2])))); }
        else if(pn === 'head' && (m.graze > 0 || m.walk)){ const an = m.graze > 0 ? .55 : Math.sin(m.ph * .5) * .06;
          M = mul(M, mul(mT(pt.pivot[0], pt.pivot[1], pt.pivot[2]), mul(mRX(an), mT(-pt.pivot[0], -pt.pivot[1], -pt.pivot[2])))); }
        gl.uniformMatrix4fv(um, false, M);
        [[lp, pt.p], [ln, pt.n], [lc, pt.c]].forEach(([l, b]) => { gl.bindBuffer(gl.ARRAY_BUFFER, b); gl.enableVertexAttribArray(l); gl.vertexAttribPointer(l, 3, gl.FLOAT, false, 0, 0); });
        gl.drawArrays(gl.TRIANGLES, 0, pt.count);
      }
    });
  }
  const labelTex = t => texOf('lb' + H.scriptNow() + t, 512, 128, (x, w, h) => {
    x.fillStyle = 'rgba(255,255,255,.95)'; x.beginPath(); if(x.roundRect) x.roundRect(8, 12, w - 16, h - 24, 44); else x.rect(8, 12, w - 16, h - 24);
    x.fill(); x.fillStyle = '#2b2250'; x.font = (H.scriptNow() === 'ktav' ? '' : 'bold ') + '72px ' + (H.scriptNow() === 'ktav' ? '"KtavYad","Arial Hebrew"' : '"Arial Hebrew"') + ',Arial,sans-serif'; x.fillText(t, w / 2, h / 2 + 4); });
  /* לחיצה על חיה: אומרים את שמה בעברית ומציגים אותו */
  function mobAtTap(o, d, maxT){
    let best = null, bt = maxT;
    S.mobs.forEach(m => { const h = H.MOBS[m.kind].h, cx = m.x, cy = m.y + h / 2, cz = m.z, rad = .55 + h * .25;
      const ox = o[0] - cx, oy = o[1] - cy, oz = o[2] - cz, b = ox * d[0] + oy * d[1] + oz * d[2], c = ox * ox + oy * oy + oz * oz - rad * rad, disc = b * b - c;
      if(disc < 0) return; const t = -b - Math.sqrt(disc); if(t > 0 && t < bt){ bt = t; best = m; } });
    return best;
  }
  function tapMob(m){
    const def = H.MOBS[m.kind]; H.speak(def.name); m.heart = 1.6; m.walk = false; m.wait = 1.5;
    S.label = {m, until: performance.now() + 2600, text: def.name};
  }

  /* ---------- שמירה ---------- */
  function encodeEdits(){
    const bytes = new Uint8Array(edits.size * 4); let o = 0;
    edits.forEach((id, i) => { bytes[o++] = i & 255; bytes[o++] = (i >> 8) & 255; bytes[o++] = (i >> 16) & 255; bytes[o++] = id; });
    let s = ''; for(let i = 0; i < bytes.length; i += 8192) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 8192));
    return btoa(s);
  }
  function decodeEdits(str){
    edits = new Map(); if(!str) return;
    try{ const bin = atob(str); for(let i = 0; i + 3 < bin.length; i += 4){ const ix = bin.charCodeAt(i) | (bin.charCodeAt(i+1) << 8) | (bin.charCodeAt(i+2) << 16), id = bin.charCodeAt(i+3);
      if(ix < NX * NY * NZ) edits.set(ix, id); } }catch(e){ edits = new Map(); }
  }
  function save(){
    const b = H.state.build || (H.state.build = {e: '', hot: []});
    b.e = encodeEdits(); b.hot = S ? S.hot.slice() : b.hot; H.save();
  }

  /* ---------- בונים מילה ---------- */
  function scanWord(word){
    const L = word.split('');
    const find = (ch) => { const out = []; edits.forEach((id, i) => { if(id >= LET0 && H.VOX_LETTERS[id - LET0] === ch){ const y = Math.floor(i / (NX * NZ)), r = i % (NX * NZ); out.push([r % NX, y, Math.floor(r / NX)]); } }); return out; };
    const starts = find(L[0]); if(!starts.length) return false;
    const dirs = [[-1,0,0],[1,0,0],[0,0,-1],[0,0,1],[0,-1,0]];
    return starts.some(s => dirs.some(d => L.every((ch, k) => { const x = s[0] + d[0] * k, y = s[1] + d[1] * k, z = s[2] + d[2] * k; const id = get(x, y, z); return id >= LET0 && H.VOX_LETTERS[id - LET0] === ch; })));
  }
  function checkWord(){
    if(mode !== 'blocks' || !challenge || challenge.done) return;
    if(scanWord(challenge.letters.join(''))){
      challenge.done = true; const cb = challenge.onDone;
      H.toast('🎉 בנית את המילה!', 'level'); H.confetti && H.confetti(40); H.speak(challenge.word);
      setTimeout(() => cb && cb(true), 1500);
    }
  }
  function hunt(word, onDone){
    const letters = H.strip(word).replace(/\s+/g, '').split('');
    challenge = {word, letters, onDone, done: false};
    /* סרגל קצר: האותיות של המילה */
    const uniq = [...new Set(letters)];
    S.hot = uniq.map(c => LET0 + H.VOX_LETTERS.indexOf(c)).concat(S.hot.filter(id => id < LET0)).slice(0, 9); S.sel = 0; editMode = 'build';
    renderBar(); renderTop();
  }

  /* ---------- ממשק ---------- */
  function renderTop(){
    const box = H.$('vxhud'); if(!box) return;
    let mid = '';
    if(mode === 'blocks' && challenge) mid = '<div class="wh-word">' + challenge.letters.map(c => '<span>' + H.esc(c) + '</span>').join('') + '</div><div class="wh-sub">בנה שורה: האותיות לפי הסדר (אפשר גם מלמעלה למטה)</div>';
    else mid = '<div class="wh-sub">' + (editMode === 'stamp' && TPL[S.stamp] ? '🏗️ תבנית: ' + H.esc(TPL[S.stamp].n) : (editMode === 'build' ? '🔨 בנייה' : '⛏️ שבירה')) + ' · 🧱 ' + edits.size + '</div>';
    box.innerHTML = '<div class="wh-top"><button class="wh-exit" id="vxexit">✕ יציאה</button><span class="wh-coins">🪙 ' + H.state.coins + '</span><button class="wh-bug" id="vxbug" aria-label="דווח על בעיה">🐞</button>' +
      '<button class="wh-topic" id="vxundo">↶ בטל</button></div>' + mid;
    H.$('vxexit').onclick = () => { H.sfx.tap(); flush(); H.goBack(); };
    H.$('vxbug').onclick = () => H.openReport();
    H.$('vxundo').onclick = () => {
      const g = undo.pop(); if(!g) return;
      const keys = new Set();
      for(let k = g.length - 1; k >= 0; k--){ const i = g[k][0], id = g[k][1]; blocks[i] = id; if(id === AIR) edits.delete(i); else edits.set(i, id);
        const r = i % (NX * NZ), x = r % NX, z = Math.floor(r / NX); for(let dx = -1; dx <= 1; dx++) for(let dz = -1; dz <= 1; dz++) keys.add(Math.floor((x + dx) / CH) + ',' + Math.floor((z + dz) / CH)); }
      computeLight(); remeshAll(); markDirty(); renderTop(); };
  }
  function slotImg(id){ const ft = faceTiles(id); return tileDataUrl(id >= LET0 ? LET0 + (id - LET0) : ft[1]); }
  function renderBar(){
    const bar = H.$('vxbar'); if(!bar) return; bar.innerHTML = '';
    S.hot.forEach((id, i) => {
      const b = H.el('button', 'vxslot' + (i === S.sel ? ' on' : '') + (owned(id) ? '' : ' lock'));
      b.innerHTML = '<img src="' + slotImg(id) + '" alt="">' + (owned(id) ? '' : '<i>🔒</i>');
      b.onclick = () => { S.sel = i; editMode = 'build'; renderBar(); renderTop(); };
      bar.appendChild(b);
    });
    const more = H.el('button', 'vxslot more', '⋯'); more.onclick = () => openPalette(); bar.appendChild(more);
    const mbtn = H.$('vxmode'); if(mbtn){ mbtn.textContent = editMode === 'stamp' ? '🏗️' : (editMode === 'build' ? '🔨' : '⛏️'); mbtn.classList.toggle('brk', editMode === 'break'); }
    const rb = H.$('vxrot'); if(rb) rb.style.display = editMode === 'stamp' ? '' : 'none';
  }
  function openPalette(){
    const pal = H.$('vxpal'); pal.style.display = ''; let html = '<div class="vxp-h"><b>בלוקים</b><button class="mini" id="vxpclose">✕</button></div><div class="vxp-grid">';
    H.VOX_BLOCKS.forEach(b => { const o = owned(b.id);
      html += '<button class="vxp-b' + (o ? '' : ' lock') + '" data-id="' + b.id + '"><img src="' + slotImg(b.id) + '" alt=""><small>' + H.esc(b.n) + (o ? '' : '<br>🪙 ' + b.cost) + '</small></button>'; });
    html += '</div><div class="vxp-h"><b>🏗️ תבניות (נבנו ב-Blender)</b><small>לחץ והנח בלחיצה על הקרקע</small></div><div class="vxp-grid tpl">' + Object.values(TPL).map(t => '<button class="vxp-b tplb" data-tpl="' + t.id + '"><img src="' + t.png + '" alt=""><small>' + H.esc(t.n) + '</small></button>').join('') + '</div><div class="vxp-h"><b>אותיות</b><small>נפתחות כשלומדים מילה</small></div><div class="vxp-grid">';
    for(let i = 0; i < H.VOX_LETTERS.length; i++){ const ch = H.VOX_LETTERS[i], o = letterOpen(ch);
      html += '<button class="vxp-b' + (o ? '' : ' lock') + '" data-id="' + (LET0 + i) + '"><img src="' + slotImg(LET0 + i) + '" alt=""><small>' + (o ? '' : '🔒') + '</small></button>'; }
    pal.innerHTML = html + '</div>';
    H.$('vxpclose').onclick = () => { pal.style.display = 'none'; };
    pal.querySelectorAll('.tplb').forEach(b => b.onclick = () => pickStamp(b.dataset.tpl));
    pal.querySelectorAll('.vxp-b:not(.tplb)').forEach(b => b.onclick = () => {
      const id = Number(b.dataset.id);
      if(!owned(id)){ if(id < LET0) buyBlock(id); else H.toast('האות הזאת נעולה. למד מילה עם האות 🔒'); openPalette(); return; }
      S.hot[S.sel] = id; editMode = 'build'; pal.style.display = 'none'; renderBar(); renderTop(); save(); });
  }
  function flush(){ if(dirtyT){ dirtyT = 0; save(); } }

  /* ---------- מצלמה וציור ---------- */
  function camera(){
    const p = S.p, head = [p.x, p.y + 1.5, p.z], cp = Math.cos(cam.pitch);
    const dir = [Math.sin(cam.yaw) * cp, Math.sin(cam.pitch), Math.cos(cam.yaw) * cp];
    let dist = cam.dist; const h = ray(head, dir, dist + .4); if(h) dist = Math.max(1.2, Math.min(dist, h.t - .3));
    const eye = [head[0] + dir[0] * dist, head[1] + dir[1] * dist, head[2] + dir[2] * dist];
    const asp = cv.width / cv.height, look_ = look(eye, head);
    return {eye, vp: mul(persp(1.0, asp, .1, 300), look_.m), right: look_.right, up: look_.up, fwd: look_.fwd, asp};
  }
  function drawChunks(c, pass, cut){
    const th = theme(); gl.useProgram(progM);
    gl.uniformMatrix4fv(gl.getUniformLocation(progM, 'vp'), false, c.vp); gl.uniform3fv(gl.getUniformLocation(progM, 'cam'), c.eye);
    gl.uniform3fv(gl.getUniformLocation(progM, 'fog'), S.day.sky); gl.uniform1f(gl.getUniformLocation(progM, 'cut'), cut); gl.uniform1f(gl.getUniformLocation(progM, 'amb'), S.day.amb);
    gl.uniform3fv(gl.getUniformLocation(progM, 'tint'), new Float32Array(th.tint));
    gl.bindTexture(gl.TEXTURE_2D, atlasTex);
    const lp = gl.getAttribLocation(progM, 'p'), lt = gl.getAttribLocation(progM, 't'), ls = gl.getAttribLocation(progM, 's'), lb = gl.getAttribLocation(progM, 'b');
    for(const k in chunks){ const m = chunks[k][pass]; if(!m) continue;
      gl.bindBuffer(gl.ARRAY_BUFFER, m.b);
      gl.enableVertexAttribArray(lp); gl.vertexAttribPointer(lp, 3, gl.FLOAT, false, 28, 0);
      gl.enableVertexAttribArray(lt); gl.vertexAttribPointer(lt, 2, gl.FLOAT, false, 28, 12);
      gl.enableVertexAttribArray(ls); gl.vertexAttribPointer(ls, 1, gl.FLOAT, false, 28, 20);
      gl.enableVertexAttribArray(lb); gl.vertexAttribPointer(lb, 1, gl.FLOAT, false, 28, 24);
      gl.drawArrays(gl.TRIANGLES, 0, m.n); }
  }
  function sprite(tx, x, y, z, w, h){
    gl.uniform3f(gl.getUniformLocation(progS, 'ctr'), x, y, z); gl.uniform2f(gl.getUniformLocation(progS, 'sz'), w / 2, h / 2);
    gl.bindTexture(gl.TEXTURE_2D, tx); gl.drawArrays(gl.TRIANGLES, 0, 6);
  }
  function draw(){
    const q = Math.min(window.matchMedia && matchMedia('(pointer:coarse)').matches ? 2 : 2, window.devicePixelRatio || 1) * (S.qual || 1);
    const w = Math.max(2, Math.round(cv.clientWidth * q)), h = Math.max(2, Math.round(cv.clientHeight * q));
    if(cv.width !== w || cv.height !== h){ cv.width = w; cv.height = h; }
    gl.viewport(0, 0, cv.width, cv.height);
    S.day = dayInfo(); const th = theme(), sk = S.day.sky; gl.clearColor(sk[0], sk[1], sk[2], 1); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    const c = camera(); S.cam = c;
    { const e = Math.asin(clamp(c.fwd[1], -1, 1)), hy = clamp(Math.tan(-e) / Math.tan(.5), -1, 1.4);
      gl.useProgram(progB); gl.disable(gl.DEPTH_TEST);
      gl.uniform3fv(gl.getUniformLocation(progB, 'hz'), sk); gl.uniform3f(gl.getUniformLocation(progB, 'zn'), sk[0] * .55, sk[1] * .74, Math.min(1, sk[2] * 1.05 + .02));
      gl.uniform1f(gl.getUniformLocation(progB, 'hy'), hy);
      const q0 = gl.getAttribLocation(progB, 'q'); gl.bindBuffer(gl.ARRAY_BUFFER, S0.quad); gl.enableVertexAttribArray(q0); gl.vertexAttribPointer(q0, 2, gl.FLOAT, false, 0, 0);
      gl.drawArrays(gl.TRIANGLES, 0, 6); gl.enable(gl.DEPTH_TEST); }
    drawChunks(c, 'o', .5);
    drawMobs(c);
    /* דמות וחבר: ציורים שפונים למצלמה */
    gl.useProgram(progS); gl.uniformMatrix4fv(gl.getUniformLocation(progS, 'vp'), false, c.vp);
    gl.uniform3fv(gl.getUniformLocation(progS, 'rt'), c.right); gl.uniform3fv(gl.getUniformLocation(progS, 'up'), c.up);
    const ql = gl.getAttribLocation(progS, 'q'); gl.bindBuffer(gl.ARRAY_BUFFER, S0.quad); gl.enableVertexAttribArray(ql); gl.vertexAttribPointer(ql, 2, gl.FLOAT, false, 0, 0);
    const p = S.p, bob = S.p.ground && (Math.abs(stick.x) + Math.abs(stick.y) > .1 || keys.w || keys.s || keys.a || keys.d) ? Math.abs(Math.sin(p.walk)) * .12 : 0;
    sprite(avatarTex(), p.x, p.y + 1.0 + bob, p.z, 2.0, 2.0);
    S.mobs.forEach(m => { if(m.heart > 0) sprite(emojiTex('❤️'), m.x, m.y + H.MOBS[m.kind].h + .4 + (1.6 - m.heart) * .6, m.z, .7, .7); });
    if(S.label && performance.now() < S.label.until){ const m = S.label.m; sprite(labelTex(S.label.text), m.x, m.y + H.MOBS[m.kind].h + 1.1, m.z, 2.4, .6); }
    const pet = (H.PETS.find(v => v.id === H.state.pet) || {}).e; if(pet) sprite(emojiTex(pet), S.pet.x, S.pet.y + .5, S.pet.z, 1.0, 1.0);
    { const d = S.day, sx = Math.cos(d.a), sy = Math.sin(d.a);
      if(d.sunH > -.3) sprite(emojiTex('☀️'), c.eye[0] + sx * 110, c.eye[1] + sy * 110, c.eye[2] - 40, 26, 26);
      if(d.sunH < .3) sprite(emojiTex('🌙'), c.eye[0] - sx * 110, c.eye[1] - sy * 110, c.eye[2] + 40, 22, 22);
      if(d.k < .6){ const st = emojiTex('✨'); STARS.forEach(v => sprite(st, c.eye[0] + v[0] * 150, c.eye[1] + v[1] * 150, c.eye[2] + v[2] * 150, 3, 3)); } }
    /* מים וזכוכית: שקופים, אחרי הכול */
    gl.depthMask(false); drawChunks(c, 't', 0); gl.depthMask(true);
    /* משבצת מסומנת: מסגרת סביב הבלוק שמכוון אליו */
  }
  function frame(ts){
    if(!running) return;
    if(H.screen !== 'voxel'){ running = false; return; }
    const dt = Math.min(.05, (ts - last) / 1000); last = ts;
    S.acc = (S.acc || 0) + dt; S.nf = (S.nf || 0) + 1;
    if(S.nf >= 60){ const a = S.acc / S.nf; if(a > .042 && (S.qual || 1) > .7) S.qual = (S.qual || 1) - .1; S.acc = 0; S.nf = 0; }
    S.tod = (S.tod + dt / 600) % 1; if(S.mobs) updateMobs(dt);
    try{ physics(dt); draw(); if(dirtyT && performance.now() - dirtyT > 2500){ dirtyT = 0; save(); } }catch(e){ console.warn(e); running = false; return; }
    requestAnimationFrame(frame);
  }

  /* ---------- קלט ---------- */
  function rayFromPixel(cx, cy){
    const r = cv.getBoundingClientRect(), nx = (cx - r.left) / r.width * 2 - 1, ny = 1 - (cy - r.top) / r.height * 2, c = S.cam, t = Math.tan(.5), d = [0, 0, 0];
    for(let i = 0; i < 3; i++) d[i] = c.fwd[i] + c.right[i] * nx * t * c.asp + c.up[i] * ny * t;
    const l = Math.hypot(d[0], d[1], d[2]); return {o: c.eye, d: [d[0] / l, d[1] / l, d[2] / l]};
  }
  function bind(){
    if(bind.done) return; bind.done = true;
    cv.addEventListener('pointerdown', e => { try{ cv.setPointerCapture(e.pointerId); }catch(_){} ptr.set(e.pointerId, {x: e.clientX, y: e.clientY});
      tap = ptr.size === 1 ? {x: e.clientX, y: e.clientY, t: performance.now(), moved: false} : null;
      if(ptr.size === 2){ const [a, b] = [...ptr.values()]; pinch = Math.hypot(a.x - b.x, a.y - b.y); } });
    cv.addEventListener('pointermove', e => { const p = ptr.get(e.pointerId); if(!p) return; const dx = e.clientX - p.x, dy = e.clientY - p.y; p.x = e.clientX; p.y = e.clientY;
      if(ptr.size === 2){ const [a, b] = [...ptr.values()], d = Math.hypot(a.x - b.x, a.y - b.y); if(pinch) cam.dist = clamp(cam.dist * pinch / d, 3, 16); pinch = d; return; }
      if(tap && Math.hypot(e.clientX - tap.x, e.clientY - tap.y) > 8) tap.moved = true;
      if(tap && tap.moved){ cam.yaw -= dx * .008; cam.pitch = clamp(cam.pitch + dy * .005, -.2, 1.3); } });
    const up = e => { ptr.delete(e.pointerId); pinch = 0;
      if(tap && !tap.moved && performance.now() - tap.t < 450 && S){ const r = rayFromPixel(e.clientX, e.clientY), hit = ray(r.o, r.d, 60, true), m = S.mobs && mobAtTap(r.o, r.d, hit ? hit.t : 60); if(m) tapMob(m); else act(hit); }
      tap = null; };
    cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
    cv.addEventListener('wheel', e => { e.preventDefault(); cam.dist = clamp(cam.dist + e.deltaY * .01, 3, 16); }, {passive: false});
    window.addEventListener('keydown', e => { if(H.screen !== 'voxel') return; if(e.target && /^(INPUT|TEXTAREA)$/.test(e.target.tagName)) return; const k = e.key.length === 1 ? e.key.toLowerCase() : e.key; keys[k] = true;
      if(k === ' ' || k.startsWith('Arrow')) e.preventDefault();
      if(k >= '1' && k <= '9'){ S.sel = Math.min(S.hot.length - 1, Number(k) - 1); editMode = 'build'; renderBar(); renderTop(); }
      if(k === 'b'){ editMode = editMode === 'build' ? 'break' : 'build'; renderBar(); renderTop(); }
      if(k === 'e') openPalette(); });
    window.addEventListener('keyup', e => { const k = e.key.length === 1 ? e.key.toLowerCase() : e.key; keys[k] = false; });
    const st = H.$('vxstick'), kn = H.$('vxknob');
    const setv = (cx, cy) => { const r = st.getBoundingClientRect(), mx = r.left + r.width / 2, my = r.top + r.height / 2, rad = r.width / 2 - 16;
      let dx = cx - mx, dy = cy - my; const l = Math.hypot(dx, dy); if(l > rad){ dx *= rad / l; dy *= rad / l; } stick.x = dx / rad; stick.y = dy / rad; kn.style.transform = 'translate(' + dx + 'px,' + dy + 'px)'; };
    st.addEventListener('pointerdown', e => { try{ st.setPointerCapture(e.pointerId); }catch(_){} stick.id = e.pointerId; setv(e.clientX, e.clientY); e.preventDefault(); e.stopPropagation(); });
    st.addEventListener('pointermove', e => { if(stick.id === e.pointerId) setv(e.clientX, e.clientY); });
    const rel = e => { if(stick.id !== e.pointerId) return; stick.id = null; stick.x = stick.y = 0; kn.style.transform = ''; };
    st.addEventListener('pointerup', rel); st.addEventListener('pointercancel', rel);
    H.$('vxjump').addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); S.jump = true; });
    H.$('vxmode').addEventListener('click', () => { editMode = editMode === 'build' ? 'break' : 'build'; H.sfx.tap(); renderBar(); renderTop(); });
    H.$('vxtime').addEventListener('click', () => { const seq = [.5, .72, .0, .27]; const nxt = seq.find(v => v > S.tod + .02) ; S.tod = nxt === undefined ? seq[0] : nxt; H.sfx.tap(); H.toast(S.tod === .5 ? '☀️ צהריים' : S.tod === .72 ? '🌇 שקיעה' : S.tod === 0 ? '🌙 לילה' : '🌅 זריחה'); });
    H.$('vxrot').addEventListener('click', () => { S.rot = ((S.rot || 0) + 1) % 4; H.sfx.tap(); H.toast('↻ סיבוב'); });
  }

  /* ---------- כניסה ---------- */
  function open(m){
    if(!initGL()) return false;
    bind(); mode = m || 'free'; challenge = null;
    if(!blocks){ decodeEdits((H.state.build && H.state.build.e) || ''); generate(); remeshAll(); }
    const b = H.state.build || (H.state.build = {e: '', hot: []});
    const hot = (b.hot && b.hot.length ? b.hot : [1, 2, 3, 7, 8, 15, 11, 18, 9]).filter(id => id > 0).slice(0, 9);
    S = {p: {x: S0.spawn.x, y: S0.spawn.y, z: S0.spawn.z, vy: 0, ground: false, face: 1, walk: 0}, pet: {x: S0.spawn.x + 1.5, y: S0.spawn.y, z: S0.spawn.z + 1}, hot, sel: 0, jump: false, cam: null, qual: 1, tod: .5, day: null, mobs: [], label: null};
    if(S.p.y < 1) S.p.y = 20;
    for(let k = 0; k < 40 && collides(S.p.x, S.p.y, S.p.z); k++) S.p.y += 1;      /* אם נולדנו בתוך בלוק, עולים החוצה */
    cam.dist = cv.clientWidth / Math.max(1, cv.clientHeight) < .75 ? 9 : 7.5;
    S.mobs = spawnMobs();
    renderBar(); renderTop(); H.$('vxpal').style.display = 'none';
    if(!running){ running = true; last = performance.now(); requestAnimationFrame(frame); }
    return true;
  }
  return {
    supported: () => initGL(), open, hunt, flush, state: () => S, cam: () => cam, mode: () => mode,
    reset(){ edits = new Map(); undo = []; generate(); remeshAll(); S.p.x = S0.spawn.x; S.p.y = S0.spawn.y; S.p.z = S0.spawn.z; S.p.vy = 0; save(); renderTop(); },
    diag: () => ({vmode: mode, edit: editMode, edits: edits.size, tod: S ? +S.tod.toFixed(2) : 0, mobs: S ? S.mobs.length : 0, vqual: S ? +(S.qual || 1).toFixed(2) : 0}),
    mobs: () => S && S.mobs, setBlock: (x, y, z, id) => setBlock(x, y, z, id), get, edits: () => edits, check: checkWord, end(){ flush(); running = false; document.body.classList.remove('inworld'); }
  };
})();

H.openVoxel = function(){
  H.run = {origin: 'home', game: null, word: null, right: 0, wrong: 0, total: 0, queue: []};
  H.show('voxel');
  if(!H.vox.open('free')){ H.toast('הדפדפן הזה לא תומך בתלת־ממד'); H.home(); }
};
H.renderVoxelBtn = function(){
  const b = H.$('voxbtn'); if(!b) return;
  b.innerHTML = '<span class="m-e">🧱</span><b>עולם הבנייה</b><small>בונים עם בלוקים ואותיות</small>';
};
/* משחק: בונים מילה */
H.game({
  id:'blocks', e:'🧱', name:'בונים מילה',
  desc:'בנה את המילה מבלוקי אותיות',
  start(){
    H.show('voxel');
    if(!H.vox.open('blocks')){ H.toast('הדפדפן הזה לא תומך בתלת־ממד'); return H.home(); }
    this.next();
  },
  next(){
    const w = H.nextWord();
    if(!w){ H.vox.end(); return H.endRound(); }
    H.vox.hunt(w, ok => { if(ok) H.right(); else H.wrong(); this.next(); });
    setTimeout(() => H.say(w), 300);
  },
  stop(){ H.vox.end(); }
});
