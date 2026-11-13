/**
 * مصروفاتي - الخادم (Google Apps Script)
 * بيتحط جوه شيت «دفتر مصروفاتي»: الإضافات ← Apps Script
 *
 * قبل التشغيل: من ⚙️ إعدادات المشروع ← خصائص النص البرمجي (Script properties) ضيف:
 *   GEMINI_KEY = المفتاح اللي بيبدأ بـ AIza
 *   PIN        = رقم سري تختاره (مثلاً ٤ أو ٦ أرقام)
 */

const SHEET_ID = '1XEaQft4984YhrdqVxFiSk-IMCsCAqJ_uOx2ZG6Z73bw';
const TAB = 'وارد التطبيق';
const HEAD = ['id', 'التاريخ', 'النوع', 'البند', 'التصنيف', 'المبلغ', 'الكلام', 'الحالة', 'وقت التسجيل'];
const MODELS = ['gemini-flash-latest', 'gemini-2.5-flash'];

const CATS = ["مصروف البيت","بقالة وسوبرماركت","خضار وفاكهة","لحوم وفراخ وسمك","عيش وفطار","أكل برا وديليفري","قهوة وشاي ومشروبات","حلويات وتسالي","مواصلات","عربية وبنزين","إيجار وأقساط سكن","كهربا وميه وغاز","تليفون ونت","صيانة وتصليحات","أدوات منزلية ومنظفات","أولاد ومدارس","دروس وتعليم","دكاترة وتحاليل","أدوية وصيدلية","حلاقة وعناية شخصية","لبس وجزم","خروجات وترفيه","سفر ومصايف","هدايا ومناسبات","صدقات وزكاة","جمعيات وأقساط","اشتراكات ونادي","سجاير","شغل ومصاريف مهنية"];
const INC = ["مرتب", "دخل إضافي"];

function doPost(e) {
  try {
    const req = JSON.parse(e.postData.contents);
    const props = PropertiesService.getScriptProperties();
    if (!req.pin || String(req.pin) !== String(props.getProperty('PIN'))) return out({ ok: false, error: 'pin' });
    if (req.action === 'ping') return out({ ok: true });
    if (req.action === 'parse') return out(parse(req, props.getProperty('GEMINI_KEY')));
    if (req.action === 'save') return out(save(req.items || []));
    if (req.action === 'recent') return out(recent());
    return out({ ok: false, error: 'action' });
  } catch (err) {
    return out({ ok: false, error: String(err && err.message || err) });
  }
}

function doGet() { return out({ ok: true, app: 'masrofaty' }); }

function out(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}

function prompt(today, typed) {
  return `انت بتسمع (أو بتقرا) كلام مصري عامي من شخص بيسجل مصروفاته ودخله بالجنيه المصري. النهارده ${today}.
${typed ? 'النص: «' + typed + '»' : 'اسمع التسجيل الصوتي المرفق.'}
١- اكتب الكلام زي ما اتقال بالعامية المصري في transcript.
٢- طلّع كل حركة فلوس مع مبلغها: "مصروف" (صرف/جاب/اشترى/دفع/ادى) ولا "دخل" (قبض/مرتب/حافز/مكافأة/لجنة/جاله فلوس).
حوّل الأرقام المنطوقة لرقم: "ميتين وخمسين" = 250، "ألف ونص" = 1500، "عشرة ونص" = 10.5، "ربعمية" = 400.
لو عدد × سعر (٣ كيلو الكيلو بعشرين) احسب الإجمالي. لو مبلغ واحد على أكتر من حاجة خليه بند واحد.
اسم البند قصير وواضح (كلمة لـ ٤ كلمات) من غير "صرفت" أو "اشتريت".
تصنيف المصروف لازم يكون واحد من دول بالظبط: ${CATS.join('، ')}.
أمثلة: مصروف الست/المدام/مراتي = "مصروف البيت"؛ فيوري أو فينو أو شيبسي = "حلويات وتسالي"؛ توكتوك أو مواصلات حمزة أو المدرسة أو الحضانة أو التمرين أو السباحة = "أولاد ومدارس"؛ درس حمزة = "دروس وتعليم"؛ اللحمة والفراخ = "لحوم وفراخ وسمك"؛ الحلاقة = "حلاقة وعناية شخصية".
ممنوع "تاني" أو "أخرى": اختار أقرب تصنيف.
تصنيف الدخل: "مرتب" للمرتب، وأي دخل تاني "دخل إضافي" واسم البند نوعه (مكافأة، لجنة، حافز…).
"امبارح" = day_offset -1، "أول امبارح" = -2، غير كده 0.
رد JSON بس: {"transcript":"...","items":[{"type":"مصروف","item":"عيش","amount":10,"category":"عيش وفطار","day_offset":0}]}`;
}

function parse(req, key) {
  if (!key) return { ok: false, error: 'nokey' };
  const today = req.today || Utilities.formatDate(new Date(), 'Africa/Cairo', 'yyyy-MM-dd');
  const parts = [];
  if (req.audio) parts.push({ inline_data: { mime_type: req.mime || 'audio/wav', data: req.audio } });
  parts.push({ text: prompt(today, req.text || '') });
  const body = {
    contents: [{ role: 'user', parts: parts }],
    generationConfig: { responseMimeType: 'application/json', temperature: 0.1 }
  };
  let last = '';
  for (const m of MODELS) {
    const r = UrlFetchApp.fetch('https://generativelanguage.googleapis.com/v1beta/models/' + m + ':generateContent', {
      method: 'post', contentType: 'application/json', payload: JSON.stringify(body),
      headers: { 'x-goog-api-key': key }, muteHttpExceptions: true
    });
    if (r.getResponseCode() !== 200) { last = r.getResponseCode() + ' ' + r.getContentText().slice(0, 300); continue; }
    const j = JSON.parse(r.getContentText());
    const txt = (((j.candidates || [])[0] || {}).content || {}).parts;
    const s = (txt || []).map(p => p.text || '').join('').replace(/^```json|```$/g, '').trim();
    const o = JSON.parse(s);
    const items = (o.items || []).filter(x => x && +x.amount > 0).map(x => {
      const inc = x.type === 'دخل';
      const L = inc ? INC : CATS;
      return {
        type: inc ? 'دخل' : 'مصروف',
        item: String(x.item || 'مصروف').slice(0, 60),
        amount: +x.amount,
        category: L.indexOf(x.category) >= 0 ? x.category : (inc ? 'دخل إضافي' : 'مصروف البيت'),
        day_offset: Math.max(-7, Math.min(0, parseInt(x.day_offset, 10) || 0))
      };
    });
    return { ok: true, transcript: o.transcript || '', items: items };
  }
  return { ok: false, error: 'gemini ' + last };
}

function tab() {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  let sh = ss.getSheetByName(TAB);
  if (!sh) {
    sh = ss.insertSheet(TAB);
    sh.getRange(1, 1, 1, HEAD.length).setValues([HEAD]).setFontWeight('bold').setBackground('#1E6A4C').setFontColor('#FFFFFF');
    sh.setRightToLeft(true);
    sh.setFrozenRows(1);
  }
  return sh;
}

function save(items) {
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const sh = tab();
    const now = Utilities.formatDate(new Date(), 'Africa/Cairo', 'yyyy-MM-dd HH:mm');
    const rows = items.filter(x => x && +x.amount > 0 && /^\d{4}-\d{2}-\d{2}$/.test(x.date || '')).map(x => [
      x.id || Utilities.getUuid(), x.date, x.type === 'دخل' ? 'دخل' : 'مصروف', String(x.item || '').slice(0, 60),
      x.category || '', +x.amount, String(x.said || '').slice(0, 300), 'جديد', now
    ]);
    if (rows.length) {
      const r0 = sh.getLastRow() + 1;
      sh.getRange(r0, 1, rows.length, HEAD.length).setNumberFormat('@');
      sh.getRange(r0, 6, rows.length, 1).setNumberFormat('0.##');
      sh.getRange(r0, 1, rows.length, HEAD.length).setValues(rows);
    }
    return { ok: true, saved: rows.length };
  } finally { lock.releaseLock(); }
}

function recent() {
  const sh = tab();
  const n = sh.getLastRow() - 1;
  if (n < 1) return { ok: true, rows: [] };
  const start = Math.max(2, sh.getLastRow() - 29);
  const v = sh.getRange(start, 1, sh.getLastRow() - start + 1, HEAD.length).getDisplayValues();
  return { ok: true, rows: v.reverse().map(r => ({ date: r[1], type: r[2], item: r[3], category: r[4], amount: +r[5], status: r[7] })) };
}

/** شغّلها مرة من المحرر عشان توافق على الصلاحيات وتتأكد إن المفتاح شغال */
function test() {
  const p = PropertiesService.getScriptProperties();
  Logger.log(JSON.stringify(parse({ text: 'جبت عيش بعشرة واديت المدام الفين' }, p.getProperty('GEMINI_KEY'))));
  tab();
}
