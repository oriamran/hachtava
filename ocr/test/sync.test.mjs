import { sanitizeState, summarize, saveState, loadState, deleteState, adminList } from "../src/sync.ts";
let pass = 0, fail = 0;
const ok = (name, cond, extra = "") => { (cond ? pass++ : fail++); console.log((cond ? "  ✓ " : "  ✗ ") + name + (cond ? "" : "   " + extra)); };

/* a tiny in-memory KV with the same surface the code uses */
const kv = () => { const m = new Map(); return {
  get: async k => m.get(k) ?? null, put: async (k, v) => { m.set(k, v); }, delete: async k => { m.delete(k); },
  list: async ({ prefix }) => ({ keys: [...m.keys()].filter(k => k.startsWith(prefix)).map(name => ({ name })), list_complete: true }),
  _m: m }; };
const user = (n) => ({ sub: "u" + n, email: `p${n}@x.com`, emailVerified: true });

console.log("sanitizeState");
ok("rejects non-objects", sanitizeState(null) === null && sanitizeState([]) === null && sanitizeState("x") === null);
const dirty = JSON.parse(`{"xp":-50,"coins":1e99,"name":"${"ש".repeat(500)}","evil":"<script>","__proto__":{"polluted":1},
  "stats":{"__proto__":{"ok":9},"constructor":{"ok":9},"שלום":{"ok":"nope","bad":5,"run":1e12}},
  "packs":[{"id":"p1","topic":"t","list":["a","b",7,null,{"x":1}],"prize":"p"}],
  "stars":{"0":99,"__proto__":3},"album":["a",5,null],"daily":{"streak":-4}}`);
const c = sanitizeState(dirty);
ok("drops unknown keys", !("evil" in c));
ok("clamps negatives and huge numbers", c.xp === 0 && c.coins === 10_000_000, JSON.stringify([c.xp, c.coins]));
ok("truncates long strings", c.name.length === 30);
ok("keeps only strings in lists", JSON.stringify(c.packs[0].list) === '["a","b"]');
ok("no prototype pollution", ({}).polluted === undefined && !Object.keys(c.stats).includes("__proto__") && !Object.keys(c.stats).includes("constructor"));
ok("clamps nested numbers", c.stats["שלום"].run === 1_000_000 && c.stats["שלום"].ok === 0);
ok("clamps stars to 0..3", c.stars["0"] === 3);
ok("album only strings", JSON.stringify(c.album) === '["a"]');
ok("negative streak -> 0", c.daily.streak === 0);
const big = { packs: [{ id: "x", list: Array(100000).fill("w") }], stats: Object.fromEntries(Array.from({ length: 9000 }, (_, i) => ["w" + i, { ok: 1 }])) };
const cb = sanitizeState(big);
ok("caps list sizes", cb.packs[0].list.length === 200 && Object.keys(cb.stats).length === 2000);

console.log("draft flag");
const dr = sanitizeState({ packs: [{ id: "p2", topic: "t", list: ["a"], draft: true, libId: "a2/home" }, { id: "p3", topic: "u", list: ["b"], draft: "yes" }], pack: "p2" });
ok("draft: true survives sanitising", dr.packs[0].draft === true && dr.packs[0].libId === "a2/home");
ok("a non-boolean draft is NOT treated as true", dr.packs[1].draft === false);

console.log("saveState / load / delete / admin");
const env = { DATA: kv() };
const st = { xp: 500, packs: [{ id: "p1", list: ["a", "b", "c"] }], pack: "p1", stats: { a: { run: 3 }, b: { run: 1 } }, album: [], daily: { streak: 4 }, stars: { 0: 3, 1: 2 }, usage: { first: 1000, last: 2000, visits: 7, activeSec: 1800 } };
let r = await saveState(env.DATA ? env : env, user(1), st, 100);
ok("first save works", r.ok === true && !r.skipped, JSON.stringify(r));
r = await saveState(env, user(1), { ...st, xp: 600 }, 200);
ok("a second save within 15s is skipped, not written", r.ok && r.skipped === true);
const loaded = await loadState(env, user(1));
ok("skipped write did not overwrite", loaded.state.xp === 500, String(loaded.state.xp));
env.DATA._m.set("s:u1", JSON.stringify({ ...JSON.parse(env.DATA._m.get("s:u1")), serverAt: Date.now() - 60000 }));
r = await saveState(env, user(1), { ...st, xp: 600 }, 50);
ok("an older copy is refused (stale)", r.ok === false && r.stale === true);
r = await saveState(env, user(1), { ...st, xp: 600 }, 300);
ok("a newer copy after the gap is written", r.ok === true && !r.skipped);
ok("invalid payload refused", (await saveState(env, user(2), "garbage", 1)).invalid === true);
await saveState(env, user(2), { ...st, xp: 1300, usage: { first: 1, last: 5000, visits: 2, activeSec: 60 } }, 10);
const sm = summarize(user(1), sanitizeState(st));
ok("summary: mastered 1/3, level 5, 7 visits, 30 min", sm.earned === 1 && sm.words === 3 && sm.level === 5 && sm.visits === 7 && sm.sec === 1800, JSON.stringify(sm));
ok("summary holds email and no child name", sm.email === "p1@x.com" && !("name" in sm));
const adm = await adminList(env);
ok("admin: 2 registered, most recent first", adm.total === 2 && adm.users[0].email === "p2@x.com", JSON.stringify(adm.users.map(u => u.email)));
await deleteState(env, user(1));
ok("delete removes the account's data", (await loadState(env, user(1))).state === null && (await adminList(env)).total === 1);

console.log("admin metrics: games, progress, stuck words");
const rich = sanitizeState({ level: "f6", nikud: "weird", tour: true, xp: 240,
  packs: [{ id: "p", list: ["שָׁלוֹם", "בַּיִת", "ספר"] }], pack: "p", album: ["ספר"],
  stats: { "שלום": { ok: 1, bad: 5, run: 0 }, "בית": { ok: 4, bad: 2, run: 1 }, "ספר": { ok: 3, bad: 3, run: 0 } },
  letters: { "ש": { ok: 1, bad: 9 }, "ב": { ok: 20, bad: 1 }, "ל": { ok: 1, bad: 1 } },
  log: { "2026-09-30": { sec: 300 } },
  usage: { first: 1, last: 2, visits: 3, activeSec: 4,
    games: { write: { sec: 600, rounds: 5, right: 12, wrong: 3 }, "BAD KEY": { sec: 9 }, __proto__: { sec: 1 } },
    hist: { "2026-09-29": { xp: 100, e: 1 }, "2026-09-30": { xp: 240, e: 2 }, "nope": { xp: 1 } } } });
ok("grade kept, bad nikud mode falls back to auto", rich.level === "f6" && rich.nikud === "auto" && rich.tour === true);
ok("only well-formed game ids and dates survive", Object.keys(rich.usage.games).join() === "write" && Object.keys(rich.usage.hist).length === 2);
const rs = summarize(user(9), rich);
ok("earned counts nikud-stripped words (ספר via album)", rs.earned === 1 && rs.words === 3, JSON.stringify([rs.earned, rs.words]));
ok("stuck: worst first, mastered words excluded", rs.stuck.length === 2 && rs.stuck[0].w === "שלום" && !rs.stuck.some(x => x.w === "ספר"), JSON.stringify(rs.stuck));
ok("weak letters need 5+ tries, worst rate first", rs.weakLetters.length === 2 && rs.weakLetters[0].l === "ש", JSON.stringify(rs.weakLetters));
ok("progress series and per-game totals present", rs.hist.length === 2 && rs.hist[1][1] === 240 && rs.games.write.sec === 600 && rs.days[0][1] === 300);
const e2 = { DATA: kv() };
await saveState(e2, user(7), { xp: 1, packs: [{ id: "p", list: ["a", "b"] }], pack: "p" }, 5);
const c1 = JSON.parse(e2.DATA._m.get("s:u7")).created;
e2.DATA._m.set("s:u7", JSON.stringify({ ...JSON.parse(e2.DATA._m.get("s:u7")), serverAt: 1 }));
await saveState(e2, user(7), { xp: 2, packs: [{ id: "p", list: ["a", "b"] }], pack: "p" }, 6);
ok("registration time is set once and kept", c1 > 0 && JSON.parse(e2.DATA._m.get("s:u7")).created === c1);
ok("admin list exposes registration time", (await adminList(e2)).users[0].created === c1);

console.log("word stage ladder");
const lad = sanitizeState({ stats: { a: { ok: 1, st: 3 }, b: { ok: 1, st: 99 }, c: { ok: 1, st: "x" }, d: { ok: 1 } } });
ok("stage kept and clamped to 0..4", lad.stats.a.st === 3 && lad.stats.b.st === 4);
ok("a non-numeric or missing stage is dropped", !("st" in lad.stats.c) && !("st" in lad.stats.d));

console.log("shop fields");
const sh = sanitizeState({ bg: "space", pet: "chick", owned: ["a", 5, "b"] });
ok("background and pet are kept", sh.bg === "space" && sh.pet === "chick");
ok("defaults when absent", sanitizeState({}).bg === "day" && sanitizeState({}).pet === "none");
ok("an oversized id is truncated", sanitizeState({ bg: "x".repeat(99) }).bg.length === 20);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
