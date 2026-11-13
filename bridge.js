/* جسر التطبيق: بيدي كود الدفتر نفس الأدوات اللي كان بياخدها من Claude
   (قاعدة البيانات، فهم الكلام، تحديث الشيت، التنزيل) بس عن طريق شيت جوجل */
(function () {
  const DEF_URL = "https://script.google.com/macros/s/AKfycbxoigEhDjpAOKLNZsJPsJdeHdcZ7VWmK8bmcROX3R91fPR_ISnQKb-EgW14HGkrxP7sqw/exec";
  let cfg = {};
  try { cfg = JSON.parse(localStorage.getItem("cfg") || "{}") || {}; } catch (e) {}
  if (!cfg.url) cfg.url = DEF_URL;

  async function api(body) {
    const r = await fetch(cfg.url, { method: "POST", body: JSON.stringify({ ...body, pin: cfg.pin }) });
    const j = await r.json();
    if (!j.ok) { const e = new Error(j.error || "error"); e.code = j.error; throw e; }
    return j;
  }
  window.mApi = api;

  /* ---------- شاشة الرقم السري أول مرة ---------- */
  let readyRes; const ready = new Promise(r => readyRes = r);
  function lockScreen(msg) {
    let o = document.getElementById("lock");
    if (!o) {
      o = document.createElement("div"); o.id = "lock"; o.dir = "rtl";
      o.innerHTML = '<div class="lk"><b>مصروفاتي</b><label for="lkPin">الرقم السري</label>' +
        '<input id="lkPin" type="password" inputmode="numeric" dir="ltr" autocomplete="current-password">' +
        '<button id="lkGo" type="button">ادخل</button><div id="lkMsg"></div>' +
        '<details><summary>لينك الربط</summary><input id="lkUrl" type="url" dir="ltr"></details></div>';
      document.body.appendChild(o);
      const st = document.createElement("style");
      st.textContent = '#lock{position:fixed;inset:0;z-index:99;background:var(--bg,#EEF2EE);display:grid;place-items:center;padding:20px}' +
        '#lock .lk{background:var(--surface,#fff);border:1px solid var(--line,#D5DDD7);border-radius:16px;padding:22px;width:min(340px,100%);display:flex;flex-direction:column;gap:10px;font-family:var(--body,Tahoma)}' +
        '#lock b{font-size:1.4rem;text-align:center}#lock input{font:inherit;font-size:1.2rem;padding:10px;border-radius:10px;border:1.5px solid var(--line,#ccc);background:var(--bg,#fff);color:var(--ink,#000);width:100%}' +
        '#lock button{font:inherit;font-weight:700;font-size:1.1rem;padding:12px;border:none;border-radius:10px;background:var(--accent,#1E6A4C);color:#fff}' +
        '#lkMsg{color:var(--danger,#B3402F);text-align:center;min-height:1.4em}#lock summary{color:var(--muted,#666);font-size:.85rem}';
      document.head.appendChild(st);
      const go = async () => {
        const p = document.getElementById("lkPin").value.trim(), u = document.getElementById("lkUrl").value.trim() || DEF_URL;
        if (!p) return;
        document.getElementById("lkMsg").textContent = "بجرّب…";
        const old = cfg; cfg = { url: u, pin: p };
        try { await api({ action: "ping" }); localStorage.setItem("cfg", JSON.stringify(cfg)); o.remove(); readyRes(); }
        catch (e) { cfg = old; document.getElementById("lkMsg").textContent = e.code === "pin" ? "الرقم السري غلط" : "مفيش اتصال، جرّب تاني"; }
      };
      document.getElementById("lkGo").onclick = go;
      document.getElementById("lkPin").onkeydown = e => { if (e.key === "Enter") go(); };
    }
    document.getElementById("lkUrl").value = cfg.url || DEF_URL;
    document.getElementById("lkMsg").textContent = msg || "";
  }
  function start() { if (cfg.pin) readyRes(); else lockScreen(); }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start); else start();

  /* ---------- قاعدة البيانات (نسخة على الموبايل + الشيت) ---------- */
  const FIELDS = ["type", "date", "item", "category", "amount", "ts", "status", "note"];
  let docs = {}; let queue = [];
  try { docs = JSON.parse(localStorage.getItem("mdb") || "{}") || {}; } catch (e) {}
  try { queue = JSON.parse(localStorage.getItem("mq") || "[]") || []; } catch (e) {}
  const subs = [];
  const save = () => { try { localStorage.setItem("mdb", JSON.stringify(docs)); localStorage.setItem("mq", JSON.stringify(queue)); } catch (e) {} };
  const snap = () => ({ docs: Object.entries(docs).sort((a, b) => (+b[1].ts || 0) - (+a[1].ts || 0)).map(([id, d]) => ({ id, data: () => d })) });
  const emit = () => { const s = snap(); subs.forEach(cb => { try { cb(s); } catch (e) {} }); };
  const clean = d => { const o = {}; FIELDS.forEach(f => { if (d[f] !== undefined) o[f] = d[f]; }); return o; };
  const uid = () => (crypto.randomUUID ? crypto.randomUUID().replace(/-/g, "").slice(0, 20) : Date.now().toString(36) + Math.random().toString(36).slice(2, 10));

  let flushing = false;
  async function flush() {
    if (flushing) return; flushing = true;
    try {
      await ready;
      while (queue.length) {
        const op = queue[0];
        if (op.op === "put") await api({ action: "put", docs: [{ id: op.id, ...op.data }] });
        else await api({ action: "del", ids: [op.id] });
        queue.shift(); save();
      }
    } catch (e) { if (e.code === "pin") { cfg.pin = ""; localStorage.removeItem("cfg"); lockScreen("الرقم السري اتغير"); } }
    finally { flushing = false; }
  }
  async function refresh() {
    await ready; await flush();
    if (queue.length) return;
    try {
      const r = await api({ action: "list" }); const n = {};
      (r.docs || []).forEach(d => { n[d.id] = clean(d); });
      docs = n; save(); emit();
    } catch (e) {}
  }
  function put(id, data) { docs[id] = clean(data); queue.push({ op: "put", id, data: docs[id] }); save(); emit(); flush(); }
  function del(id) { delete docs[id]; queue.push({ op: "del", id }); save(); emit(); flush(); }

  const docRef = id => ({
    set: async d => put(id, d),
    update: async d => put(id, { ...(docs[id] || {}), ...d }),
    delete: async () => del(id),
    get: async () => ({ exists: !!docs[id], data: () => docs[id] })
  });
  const collection = () => ({
    orderBy: () => ({ onSnapshot: (cb) => { subs.push(cb); cb(snap()); refresh(); return () => {}; } }),
    onSnapshot: (cb) => { subs.push(cb); cb(snap()); refresh(); return () => {}; },
    add: async d => { const id = uid(); put(id, d); return { id }; },
    doc: docRef,
    get: async () => ({ docs: [] })
  });
  const db = { collection };
  document.addEventListener("visibilitychange", () => { if (!document.hidden) refresh(); });
  setInterval(() => { if (!document.hidden) refresh(); }, 60000);
  window.mRefresh = refresh;

  /* ---------- باقي الأدوات ---------- */
  const sample = { json: async (prompt) => (await api({ action: "gen", prompt })).json };
  const mcp = { callTool: async (server, tool, args) => ({ payload: (await api({ action: "sheets", tool, args })).payload }) };
  const downloads = {
    save: async ({ filename, data }) => {
      const a = document.createElement("a"); a.href = URL.createObjectURL(data); a.download = filename;
      document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 4000);
    }
  };
  const tools = { db, sample, mcp, downloads };
  window.claude = { use: async name => { if (name in tools) { await ready; return tools[name]; } return null; } };
})();
