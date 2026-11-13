/**
 * مصروفاتي - الخادم (Google Apps Script)
 * بيتحط جوه شيت «دفتر مصروفاتي»: Extensions ← Apps Script
 *
 * من ⚙️ Project Settings ← Script properties ضيف:
 *   GEMINI_KEY = المفتاح اللي بيبدأ بـ AIza
 *   PIN        = رقم سري تختاره
 *
 * كل البيانات في تاب «قاعدة البيانات» (التطبيق والدفتر الاتنين بيقروا ويكتبوا فيه)
 */

const SHEET_ID = '1XEaQft4984YhrdqVxFiSk-IMCsCAqJ_uOx2ZG6Z73bw';
const DB = 'قاعدة البيانات';
const COLS = ['id', 'type', 'date', 'item', 'category', 'amount', 'ts', 'status', 'note', 'deleted', 'updated'];
const MODELS = ['gemini-3.5-flash-lite', 'gemini-3.1-flash-lite', 'gemini-flash-lite-latest'];

const CATS = ["مصروف البيت","بقالة وسوبرماركت","خضار وفاكهة","لحوم وفراخ وسمك","عيش وفطار","أكل برا وديليفري","قهوة وشاي ومشروبات","حلويات وتسالي","مواصلات","عربية وبنزين","إيجار وأقساط سكن","كهربا وميه وغاز","تليفون ونت","صيانة وتصليحات","أدوات منزلية ومنظفات","أولاد ومدارس","دروس وتعليم","دكاترة وتحاليل","أدوية وصيدلية","حلاقة وعناية شخصية","لبس وجزم","خروجات وترفيه","سفر ومصايف","هدايا ومناسبات","صدقات وزكاة","جمعيات وأقساط","اشتراكات ونادي","سجاير","شغل ومصاريف مهنية"];
const INC = ["مرتب", "دخل إضافي"];

function doPost(e) {
  try {
    const req = JSON.parse(e.postData.contents);
    console.log('action=' + req.action + ' keys=' + Object.keys(req).join(',') + ' docsType=' + typeof req.docs);
    const props = PropertiesService.getScriptProperties();
    if (!req.pin || String(req.pin) !== String(props.getProperty('PIN'))) return out({ ok: false, error: 'pin' });
    switch (req.action) {
      case 'ping': return out({ ok: true });
      case 'parse': return out(parse(req, props.getProperty('GEMINI_KEY')));
      case 'list': return out({ ok: true, docs: list() });
      case 'put': return out(put(asList(req.docs)));
      case 'save': {
        const c = CacheService.getScriptCache().get('t_' + req.token);
        if (!c) return out({ ok: false, error: 'expired' });
        const docs = JSON.parse(c); put(docs); CacheService.getScriptCache().remove('t_' + req.token);
        return out({ ok: true, saved: docs.length, message: 'اتسجل ' + docs.length + ' بند ✓' });
      }
      case 'del': return out(del(req.ids || []));
      case 'gen': return out(gen(req.prompt || '', props.getProperty('GEMINI_KEY')));
      case 'sheets': return out(sheets(req.tool, req.args || {}));
      default: return out({ ok: false, error: 'action' });
    }
  } catch (err) {
    return out({ ok: false, error: String(err && err.message || err) });
  }
}

/* الاختصار ممكن يبعت القايمة كنص أو كقاموس، فبنقبل الاتنين */
function asList(x) {
  if (Array.isArray(x)) return x;
  if (typeof x === 'string') { try { return asList(JSON.parse(x)); } catch (e) { return x.split(/\n+/).map(l => { try { return JSON.parse(l); } catch (e) { return null; } }).filter(Boolean); } }
  if (x && typeof x === 'object') return x.id ? [x] : Object.keys(x).map(k => x[k]);
  return [];
}

function doGet() { return out({ ok: true, app: 'masrofaty' }); }
function out(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }

/* ---------------- قاعدة البيانات ---------------- */
function tab() {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  let sh = ss.getSheetByName(DB);
  if (!sh) {
    sh = ss.insertSheet(DB);
    sh.getRange(1, 1, 1, COLS.length).setValues([COLS]).setFontWeight('bold');
    sh.setFrozenRows(1);
    sh.getRange('A:K').setNumberFormat('@');
  }
  return sh;
}

function rows(sh) {
  const n = sh.getLastRow() - 1;
  return n < 1 ? [] : sh.getRange(2, 1, n, COLS.length).getValues();
}

function toDoc(r) {
  const d = {};
  COLS.forEach((c, i) => d[c] = r[i] === null ? '' : String(r[i]));
  d.amount = +d.amount || 0; d.ts = +d.ts || 0; d.updated = +d.updated || 0;
  return d;
}

function list() {
  return rows(tab()).filter(r => r[0] && String(r[9]) !== '1').map(toDoc);
}

function put(docs) {
  const lock = LockService.getScriptLock(); lock.waitLock(20000);
  try {
    const sh = tab(), all = rows(sh), at = {};
    all.forEach((r, i) => { if (r[0]) at[String(r[0])] = i + 2; });
    const now = Date.now(), add = [];
    docs.forEach(d => {
      if (!d || !d.id) return;
      const row = COLS.map(c => c === 'updated' ? String(now) : c === 'deleted' ? '' : (d[c] === undefined || d[c] === null ? '' : String(d[c])));
      if (at[d.id]) sh.getRange(at[d.id], 1, 1, COLS.length).setValues([row]);
      else { add.push(row); at[d.id] = -1; }
    });
    if (add.length) sh.getRange(sh.getLastRow() + 1, 1, add.length, COLS.length).setValues(add);
    return { ok: true, updated: now };
  } finally { lock.releaseLock(); }
}

function del(ids) {
  const lock = LockService.getScriptLock(); lock.waitLock(20000);
  try {
    const sh = tab(), all = rows(sh), now = String(Date.now()), want = {};
    ids.forEach(i => want[String(i)] = 1);
    all.forEach((r, i) => { if (want[String(r[0])]) sh.getRange(i + 2, 10, 1, 2).setValues([['1', now]]); });
    return { ok: true };
  } finally { lock.releaseLock(); }
}

/* ---------------- فهم الكلام بـ Gemini ---------------- */
function prompt(today, typed) {
  return `انت بتسمع (أو بتقرا) كلام مصري عامي من شخص بيسجل مصروفاته ودخله بالجنيه المصري. النهارده ${today}.
${typed ? 'النص: «' + typed + '»' : 'اسمع التسجيل الصوتي المرفق.'}
١- اكتب الكلام زي ما اتقال بالعامية المصري في transcript.
٢- طلّع كل حركة فلوس مع مبلغها: "مصروف" (صرف/جاب/اشترى/دفع/ادى) ولا "دخل" (قبض/مرتب/حافز/مكافأة/لجنة/جاله فلوس).
حوّل الأرقام المنطوقة لرقم: "ميتين وخمسين" = 250، "ألف ونص" = 1500، "عشرة ونص" = 10.5، "ربعمية" = 400.
لو عدد × سعر (٣ كيلو الكيلو بعشرين) احسب الإجمالي. لو مبلغ واحد على أكتر من حاجة خليه بند واحد.
اسم البند قصير وواضح (كلمة لـ ٤ كلمات) من غير "صرفت" أو "اشتريت".
تصنيف المصروف لازم يكون واحد من دول بالظبط: ${CATS.join('، ')}.
أمثلة: مصروف الست/المدام/مراتي = "مصروف البيت"؛ فيوري أو فينو أو شيبسي = "حلويات وتسالي"؛ توكتوك أو مواصلات حمزة أو المدرسة = "أولاد ومدارس" مش "مواصلات"؛ الحلاقة = "حلاقة وعناية شخصية"؛ الكشري = "أكل برا وديليفري".
ممنوع "تاني" أو "أخرى": اختار أقرب تصنيف.
تصنيف الدخل: "مرتب" للمرتب، وأي دخل تاني "دخل إضافي" واسم البند نوعه (مكافأة، لجنة، حافز…).
"امبارح" = day_offset -1، "أول امبارح" = -2، غير كده 0.
رد JSON بس: {"transcript":"...","items":[{"type":"مصروف","item":"عيش","amount":10,"category":"عيش وفطار","day_offset":0}]}`;
}

function parse(req, key) {
  if (!key) return { ok: false, error: 'nokey' };
  const today = req.today || Utilities.formatDate(new Date(), 'Africa/Cairo', 'yyyy-MM-dd');
  const m0 = String(req.mime || 'audio/wav');
  const mimes = req.audio ? (/m4a|mp4|aac/.test(m0) ? ['audio/mp4', 'audio/aac', 'audio/m4a'] : [m0]) : [''];
  let last = '';
  for (const mime of mimes) {
    const parts = [];
    if (req.audio) parts.push({ inline_data: { mime_type: mime, data: String(req.audio).replace(/\s/g, '') } });
    parts.push({ text: prompt(today, req.text || '') });
    const body = { contents: [{ role: 'user', parts: parts }], generationConfig: { responseMimeType: 'application/json', temperature: 0.1 } };
    for (const m of MODELS) {
      const r = UrlFetchApp.fetch('https://generativelanguage.googleapis.com/v1beta/models/' + m + ':generateContent', {
        method: 'post', contentType: 'application/json', payload: JSON.stringify(body),
        headers: { 'x-goog-api-key': key }, muteHttpExceptions: true
      });
      const code = r.getResponseCode();
      if (code === 400) { last += m + ' ' + mime + ': 400 | '; break; }
      if (code !== 200) { if (code === 503 || code === 429) Utilities.sleep(1500); last += m + ': ' + code + ' | '; continue; }
      const j = JSON.parse(r.getContentText());
      const p = (((j.candidates || [])[0] || {}).content || {}).parts || [];
      const o0 = JSON.parse(p.map(x => x.text || '').join('').replace(/^```json|```$/g, '').trim());
      const o = Array.isArray(o0) ? { items: o0 } : (o0 || {});
      const items = (o.items || []).filter(x => x && +x.amount > 0).map(x => {
        const inc = x.type === 'دخل', L = inc ? INC : CATS;
        return {
          type: inc ? 'دخل' : 'مصروف', item: String(x.item || 'مصروف').slice(0, 60), amount: +x.amount,
          category: L.indexOf(x.category) >= 0 ? x.category : (inc ? 'دخل إضافي' : 'مصروف البيت'),
          day_offset: Math.max(-7, Math.min(0, parseInt(x.day_offset, 10) || 0))
        };
      });
      return Object.assign({ ok: true, transcript: o.transcript || '', items: items }, ready(items, today));
    }
  }
  return { ok: false, error: 'gemini ' + last };
}

/* بنود جاهزة للحفظ + ملخص مكتوب (بيستخدمهم اختصار الآيفون) */
function ready(items, today) {
  const ar = n => String(Math.round(n * 100) / 100).replace(/[0-9]/g, d => '٠١٢٣٤٥٦٧٨٩'[d]);
  const [y, mo, d] = today.split('-').map(Number), now = Date.now();
  const docs = items.map((x, i) => ({
    id: Utilities.getUuid().replace(/-/g, '').slice(0, 20), type: x.type, item: x.item, category: x.category, amount: x.amount,
    date: Utilities.formatDate(new Date(y, mo - 1, d + x.day_offset, 12), 'Africa/Cairo', 'yyyy-MM-dd'), ts: now + i
  }));
  const total = items.filter(x => x.type !== 'دخل').reduce((s, x) => s + x.amount, 0);
  const inc = items.filter(x => x.type === 'دخل').reduce((s, x) => s + x.amount, 0);
  const summary = items.length ? items.map(x => (x.type === 'دخل' ? 'دخل: ' : '') + x.item + ' ' + ar(x.amount) + ' ج (' + x.category + ')').join('\n') +
    (total ? '\nإجمالي المصروف ' + ar(total) + ' ج' : '') + (inc ? '\nإجمالي الدخل ' + ar(inc) + ' ج' : '') : 'مسمعتش مبلغ';
  const token = Utilities.getUuid().slice(0, 8);
  if (docs.length) CacheService.getScriptCache().put('t_' + token, JSON.stringify(docs), 1800);
  return { docs: docs, summary: summary, count: items.length, token: token };
}

/* نص حر لـ Gemini يرجع JSON (بيستخدمه التطبيق لما تكتب بإيدك) */
function gen(text, key) {
  if (!key) return { ok: false, error: 'nokey' };
  const body = { contents: [{ role: 'user', parts: [{ text: text }] }], generationConfig: { responseMimeType: 'application/json', temperature: 0.1 } };
  let last = '';
  for (const m of MODELS) {
    const r = UrlFetchApp.fetch('https://generativelanguage.googleapis.com/v1beta/models/' + m + ':generateContent', {
      method: 'post', contentType: 'application/json', payload: JSON.stringify(body),
      headers: { 'x-goog-api-key': key }, muteHttpExceptions: true
    });
    if (r.getResponseCode() !== 200) { if (r.getResponseCode() === 503 || r.getResponseCode() === 429) Utilities.sleep(1500); last = r.getResponseCode(); continue; }
    const p = ((((JSON.parse(r.getContentText()).candidates || [])[0] || {}).content || {}).parts || []);
    return { ok: true, json: JSON.parse(p.map(x => x.text || '').join('').replace(/^```json|```$/g, '').trim()) };
  }
  return { ok: false, error: 'gemini ' + last };
}

/* تحديث تابات الشيت (الحركات وشيت كل شهر) بنفس طريقة الدفتر */
function sheets(tool, a) {
  const base = 'https://sheets.googleapis.com/v4/spreadsheets/' + SHEET_ID;
  const opt = { headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken() }, muteHttpExceptions: true };
  let url;
  if (tool === 'update_values') {
    url = base + '/values/' + encodeURIComponent(a.range) + '?valueInputOption=USER_ENTERED';
    opt.method = 'put'; opt.contentType = 'application/json'; opt.payload = JSON.stringify({ values: a.values });
  } else if (tool === 'update_spreadsheet') {
    url = base + ':batchUpdate'; opt.method = 'post'; opt.contentType = 'application/json'; opt.payload = JSON.stringify({ requests: a.requests });
  } else if (tool === 'get_spreadsheet') {
    url = base + '?fields=' + encodeURIComponent((a.fields || []).join(',')); opt.method = 'get';
  } else if (tool === 'get_values') {
    url = base + '/values/' + encodeURIComponent(a.range); opt.method = 'get';
  } else return { ok: false, error: 'tool' };
  const r = UrlFetchApp.fetch(url, opt);
  if (r.getResponseCode() !== 200) return { ok: false, error: r.getResponseCode() + ' ' + r.getContentText().slice(0, 300) };
  return { ok: true, payload: JSON.parse(r.getContentText()) };
}

/** شغّلها مرة من المحرر: بتطلب الصلاحيات وبتجرب المفتاح */
function test() {
  const p = PropertiesService.getScriptProperties();
  Logger.log('عدد البنود في قاعدة البيانات: ' + list().length);
  Logger.log(JSON.stringify(parse({ text: 'جبت عيش بعشرة واديت المدام الفين' }, p.getProperty('GEMINI_KEY'))));
}
