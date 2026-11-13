(function(){
const CATS=["مصروف البيت","بقالة وسوبرماركت","خضار وفاكهة","لحوم وفراخ وسمك","عيش وفطار","أكل برا وديليفري","قهوة وشاي ومشروبات","حلويات وتسالي","مواصلات","عربية وبنزين","إيجار وأقساط سكن","كهربا وميه وغاز","تليفون ونت","صيانة وتصليحات","أدوات منزلية ومنظفات","أولاد ومدارس","دروس وتعليم","دكاترة وتحاليل","أدوية وصيدلية","حلاقة وعناية شخصية","لبس وجزم","خروجات وترفيه","سفر ومصايف","هدايا ومناسبات","صدقات وزكاة","جمعيات وأقساط","اشتراكات ونادي","سجاير","شغل ومصاريف مهنية"];
const INC=["مرتب","دخل إضافي"];
const isInc=i=>i.type==="دخل";
const $=id=>document.getElementById(id);
const fmt=n=>(Math.round(n*100)/100).toLocaleString("ar-EG");
const pad=n=>String(n).padStart(2,"0");
const iso=d=>d.getFullYear()+"-"+pad(d.getMonth()+1)+"-"+pad(d.getDate());
const todayIso=()=>iso(new Date());
const dayLabel=s=>{const [y,m,d]=s.split("-").map(Number);const dt=new Date(y,m-1,d);
  const t=todayIso(), yd=iso(new Date(Date.now()-864e5));
  const name=dt.toLocaleDateString("ar-EG",{weekday:"long",day:"numeric",month:"long"});
  return s===t?"النهارده — "+name: s===yd?"امبارح — "+name: name;};

/* ---------- الشهر المالي: من يوم القبض لليوم اللي قبل القبض الجاي ---------- */
const MONTHS=["يناير","فبراير","مارس","أبريل","مايو","يونيو","يوليو","أغسطس","سبتمبر","أكتوبر","نوفمبر","ديسمبر"];
const DIG=x=>String(x).replace(/[0-9]/g,d=>"٠١٢٣٤٥٦٧٨٩"[d]);
const DEF_DAY=25;
let paydays={}; let payCol=null;
try{paydays=JSON.parse(localStorage.getItem("paydays")||"{}")||{}}catch(e){paydays={}}
const ymOf=d=>d.getFullYear()+"-"+pad(d.getMonth()+1);
const shiftM=(m,k)=>{const [y,mo]=m.split("-").map(Number);return ymOf(new Date(y,mo-1+k,1))};
const addD=(s,k)=>{const [y,m,d]=s.split("-").map(Number);return iso(new Date(y,m-1,d+k))};
function startOf(m){const p=paydays[m]; if(p&&p.slice(0,7)===m) return p;
  const [y,mo]=m.split("-").map(Number); return m+"-"+pad(Math.min(DEF_DAY,new Date(y,mo,0).getDate()))}
const periodOf=s=>s>=startOf(s.slice(0,7))?s.slice(0,7):shiftM(s.slice(0,7),-1);
function rangeOf(m){const s=startOf(m),n=startOf(shiftM(m,1));return {start:s,next:n,end:addD(n,-1)}}
const inPeriod=(i,m)=>{const r=rangeOf(m);return i.date>=r.start&&i.date<r.next};
const pName=m=>{const [y,mo]=m.split("-").map(Number);return "شهر "+MONTHS[mo-1]+" "+DIG(y)};
const dShort=s=>{const [,m,d]=s.split("-").map(Number);return DIG(d)+" "+MONTHS[m-1]};
const dFull=s=>{const [y,m,d]=s.split("-");return DIG(y+"/"+m+"/"+d)};
let viewM=null; // null = الشهر الحالي

$("today").textContent=new Date().toLocaleDateString("ar-EG",{weekday:"long",day:"numeric",month:"long",year:"numeric"});
$("d").value=todayIso();

/* ---------- storage: شيت جوجل عن طريق bridge.js ---------- */
let items=[]; let col=null; let mode="local";
let editId=null, editDraft=null;
function loadLocal(){try{items=JSON.parse(localStorage.getItem("masrof")||"[]")}catch(e){items=[]}}
function saveLocal(){try{localStorage.setItem("masrof",JSON.stringify(items))}catch(e){}}
loadLocal(); render(); setStore();

function setStore(){const c=$("store");
  c.textContent=mode==="db"?"محفوظة في شيت جوجل":"محفوظة على الجهاز ده بس";
  c.className="chip"+(mode==="db"?" ok":"");}

(async()=>{
  try{
    const [db,user]=await Promise.all([claude.use("db"),claude.use("user")]);
    if(!db) return;
    col=db.collection("expenses");
    mode="db"; setStore(); $("gs").hidden=false;
    payCol=col;
    const local=items.slice();
    col.orderBy("ts","desc").onSnapshot(s=>{
      const all=s.docs.map(d=>({id:d.id,...d.data()})), p={};
      all.forEach(d=>{if(d.type==="يوم قبض"&&d.date) p[d.date.slice(0,7)]=d.date});
      if(Object.keys(p).length){paydays={...paydays,...p};try{localStorage.setItem("paydays",JSON.stringify(paydays))}catch(e){}}
      window._reqs=all.filter(d=>d.type==="طلب تعديل");
      items=all.filter(d=>d.type!=="يوم قبض"&&d.type!=="طلب تعديل"); render();
    },()=>{});
    if(local.length){for(const it of local){const {id:_,...rest}=it;try{await col.add(rest)}catch(e){}}
      try{localStorage.removeItem("masrof")}catch(e){}}
  }catch(e){}
})();
(async()=>{try{const dl=await claude.use("downloads"); if(dl){window._dl=dl;$("xl").hidden=false}}catch(e){}})();

async function addItems(list){
  if(mode==="db"&&col){for(const it of list){await col.add(it)} scheduleSync()}
  else{list.forEach(it=>items.unshift({id:"l"+Date.now()+Math.random(),...it})); saveLocal(); render();}
}
async function removeItem(id){
  if(mode==="db"&&col){await col.doc(id).delete(); scheduleSync()}
  else{items=items.filter(i=>i.id!==id); saveLocal(); render();}
}

/* ---------- local Egyptian-Arabic number parser (fallback) ---------- */
const W={"صفر":0,"واحد":1,"واحده":1,"واحدة":1,"اتنين":2,"اثنين":2,"تلاته":3,"تلاتة":3,"ثلاثه":3,"ثلاثة":3,"اربعه":4,"اربعة":4,"أربعة":4,"أربعه":4,
"خمسه":5,"خمسة":5,"سته":6,"ستة":6,"سبعه":7,"سبعة":7,"تمانيه":8,"تمانية":8,"ثمانية":8,"تسعه":9,"تسعة":9,"عشره":10,"عشرة":10,"عشر":10,
"حداشر":11,"احداشر":11,"اتناشر":12,"اطناشر":12,"تلتاشر":13,"اربعتاشر":14,"اربعطاشر":14,"خمستاشر":15,"خمسطاشر":15,"ستاشر":16,"سطاشر":16,
"سبعتاشر":17,"سبعطاشر":17,"تمنتاشر":18,"تمنطاشر":18,"تسعتاشر":19,"تسعطاشر":19,"عشرين":20,"تلاتين":30,"ثلاثين":30,"اربعين":40,"أربعين":40,
"خمسين":50,"ستين":60,"سبعين":70,"تمانين":80,"ثمانين":80,"تسعين":90,"ميه":100,"مية":100,"مائة":100,"ميت":100,"ميتين":200,"مئتين":200,
"تلتميه":300,"تلتمية":300,"ربعميه":400,"ربعمية":400,"خمسميه":500,"خمسمية":500,"ستميه":600,"ستمية":600,"سبعميه":700,"سبعمية":700,
"تمنميه":800,"تمنمية":800,"تسعميه":900,"تسعمية":900,"الف":1000,"ألف":1000,"الفين":2000,"ألفين":2000,"نص":.5,"ربع":.25};
const STOP=new Set(["قبضت","استلمت","جالي","انا","أنا","صرفت","اشتريت","جبت","دفعت","ب","بـ","جنيه","جنية","جنيهات","ج","وكمان","كمان","و","في","على","علي","حق","ثمن","تمن","النهارده","النهاردة","بتاع","بتاعة","ركبت","خدت","عملت"]);
const norm=s=>s.replace(/[٠-٩]/g,c=>"٠١٢٣٤٥٦٧٨٩".indexOf(c)).replace(/[،,.؟!]/g," , ");
function numOf(tok){
  let t=tok;
  if(/^\d+(\.\d+)?$/.test(t)) return +t;
  for(const p of ["وب","و","ب","بال"]) if(t.startsWith(p)&&t.length>p.length){const r=t.slice(p.length); if(/^\d+$/.test(r)) return +r; if(W[r]!=null) return W[r];}
  if(W[t]!=null) return W[t];
  return null;
}
function localParse(text){
  const toks=norm(text).split(/\s+/).filter(Boolean);
  const out=[]; let words=[]; let i=0;
  while(i<toks.length){
    let n=numOf(toks[i]);
    if(n==null||(n<1&&n>0&&!out.length&&!words.length)){
      if(toks[i]!==",") words.push(toks[i]); i++; continue;}
    let total=0, cur=n; i++;
    while(i<toks.length){
      let t=toks[i]; let m=numOf(t);
      if(t==="الاف"||t==="آلاف"||t==="ألاف"){cur*=1000;i++;continue}
      if(m==null && t==="و" && i+1<toks.length && numOf(toks[i+1])!=null){i++;continue}
      if(m==null) break;
      if(m===.5){cur+= cur>=1000?500: cur>=100?50: .5; i++; continue}
      if(m===1000&&cur<1000){cur*=1000;i++;continue}
      total+=cur; cur=m; i++;
    }
    total+=cur;
    const label=words.filter(w=>!STOP.has(w)&&!STOP.has(w.replace(/^و/,""))).map(w=>w.replace(/^و(?=..)/,"")).join(" ").trim();
    const inc=/قبضت|مرتب|ماهي|حافز|حوافز|مكافأ|مكافا|جالي|استلمت|دخل|ارباح|أرباح/.test(words.join(" "));
    if(total>0) out.push({item:label||(inc?"دخل":"مصروف"),amount:total,type:inc?"دخل":"مصروف",category:inc?guessInc(label):guessCat(label)});
    words=[];
  }
  return out;
}
function guessInc(s){return /مرتب|ماهي/.test(s)?"مرتب":"دخل إضافي"}
function guessCat(s){
  const m=[
  ["حلاقة وعناية شخصية",/حلاق|حلقت|شعر|دقن|ذقن|كوافير|مكياج|برفان|ريحه|ريحة|شامبو|معجون|كريم|موس/],
  ["مواصلات",/ميكروباص|توك|تاكس|اوبر|أوبر|كريم|مترو|اتوبيس|أتوبيس|اجره|أجرة|مواصل|قطر|سكوتر/],
  ["عربية وبنزين",/بنزين|سولار|غسيل العربي|كاوتش|زيت العربي|جراج|ركن|ميكانيكي|ترخيص|مخالف/],
  ["تليفون ونت",/نت|كارت|شحن|باق|فودافون|اورنج|اتصالات|وي |موبايل|راوتر/],
  ["كهربا وميه وغاز",/كهربا|عداد|مياه|فاتورة الميه|غاز|انبوب|أنبوب/],
  ["إيجار وأقساط سكن",/ايجار|إيجار|قسط الشق|شقه|شقة/],
  ["صيانة وتصليحات",/صيان|سباك|كهربائي|نجار|تصليح|فني|نقاش/],
  ["أدوات منزلية ومنظفات",/منظف|صابون|كلور|مسحوق|اريال|مناديل|ادوات|أدوات|حلل|اطباق/],
  ["أدوية وصيدلية",/دوا|صيدلي|علاج|برشام/],
  ["دكاترة وتحاليل",/دكتور|كشف|تحليل|اشعه|أشعة|مستشفى|عياده|عيادة|اسنان|أسنان/],
  ["دروس وتعليم",/درس|دروس|مدرس|كورس|كتب|كتاب|ملازم/],
  ["أولاد ومدارس",/مدرسه|مدرسة|حضانه|حضانة|لعب|حفاض|بامبرز|لبن اطفال|مصروف الولاد|مصروف العيال|شنطه/],
  ["لبس وجزم",/لبس|قميص|بنطلون|جزم|جزمه|كوتش|شبشب|فستان|بدله|تيشيرت/],
  ["سجاير",/سجاير|سجائر|علبة|معسل|شيشه|شيشة/],
  ["قهوة وشاي ومشروبات",/قهوه|قهوة|شاي|نسكافيه|عصير|كافيه|بيبسي|كوكا|مشروب|ميه معدني|مياه معدني/],
  ["حلويات وتسالي",/حلويات|شيكولات|شوكولات|بسكوت|شيبسي|لب|سوداني|ايس كريم|آيس/],
  ["عيش وفطار",/عيش|فول|طعميه|طعمية|فطار|جبن|بيض/],
  ["لحوم وفراخ وسمك",/لحم|فراخ|سمك|كفته|كبده|جمبري/],
  ["خضار وفاكهة",/خضار|فاكه|طماطم|بطاطس|بصل|موز|برتقال|تفاح|عنب|ليمون/],
  ["أكل برا وديليفري",/مطعم|ديليفري|دليفري|طلبات|كشري|شاورما|بيتزا|برجر|غدا برا|عشا برا|سندوتش/],
  ["بقالة وسوبرماركت",/سوبر|بقال|رز|سكر|زيت|مكرونه|مكرونة|لبن|سمن|دقيق|شاي/],
  ["خروجات وترفيه",/سينما|خروج|فسحه|فسحة|ملاهي|نادي|بلايستيشن/],
  ["سفر ومصايف",/سفر|مصيف|فندق|تذكر|طياره/],
  ["هدايا ومناسبات",/هديه|هدية|نقطه|نقطة|عيد ميلاد|فرح|عزا|عيديه|عيدية/],
  ["صدقات وزكاة",/صدق|زكا|تبرع|جامع/],
  ["جمعيات وأقساط",/جمعي|قسط/],
  ["اشتراكات ونادي",/اشتراك|نتفلكس|شاهد|سبوتيفاي|جيم/],
  ["شغل ومصاريف مهنية",/شغل|طباعه|طباعة|تصوير ورق|مكتب/]];
  if(/مصروف البيت|مصاريف البيت|للمدام|لزوجتي|لمراتي/.test(s)) return "مصروف البيت";
  if(/توك|ميكروباص|تاكس|مواصل|اتوبيس|أتوبيس/.test(s)&&/حمز|مدرس/.test(s)) return "أولاد ومدارس";
  for(const [c,r] of m) if(r.test(s)) return c; return "مصروف البيت";
}

/* ---------- Gemini بيفهم الجملة (الأحسن)، ولو مفيش نت الفهم المحلي ---------- */
let samp=null; (async()=>{try{samp=await claude.use("sample")}catch(e){}})();
async function aiParse(text){
  if(!samp) return null;
  const prompt=`أنت بتحول كلام مصري عامي (ممكن يكون من إملاء صوتي وفيه أخطاء كتابة) لقائمة مصروفات.
النص: «${text}»
طلع كل حركة فلوس مع مبلغها، وحدد هي "مصروف" (صرف/اشترى/دفع) ولا "دخل" (قبض/مرتب/حافز/جاله فلوس) بالجنيه المصري كرقم (حول الأرقام المكتوبة بالكلام زي "ميتين وخمسين" = 250، "ألف ونص" = 1500، "عشرة ونص" = 10.5).
لو مبلغ واحد على أكتر من حاجة اعتبره بند واحد. لو فيه عدد × سعر (مثلاً "٣ كيلو طماطم الكيلو بعشرين") احسب الإجمالي.
افهم كل بند واختار أدق تصنيف ممكن (مثلاً الحلاقة = "حلاقة وعناية شخصية"، الكشري = "أكل برا وديليفري"، فيوري أو فينو للولاد = "حلويات وتسالي"، مصروف البيت للزوجة = "مصروف البيت"، توكتوك أو مواصلات حمزة أو المدرسة = "أولاد ومدارس" مش "مواصلات"). ممنوع تصنيف "تاني" أو "أخرى" نهائياً: لازم تختار أقرب تصنيف من القايمة.
اسم البند يكون قصير وواضح بالعربي (كلمة لـ ٤ كلمات) من غير "صرفت" أو "اشتريت".
تصنيف المصروف لازم يكون واحد من دول بالظبط: ${CATS.join("، ")}.
تصنيف الدخل: "مرتب" للمرتب، وأي دخل تاني (مكافأة، لجنة، حافز، شغل…) يكون "دخل إضافي"، واسم البند يكون نوعه زي ما الشخص قاله (مثلاً "مكافأة" أو "لجنة").
لو الكلام بيقول "امبارح" حط day_offset = -1، "أول امبارح" = -2، غير كده 0.
رد بـ JSON بس بالشكل ده: {"items":[{"type":"مصروف","item":"عيش","amount":10,"category":"أكل وشرب","day_offset":0}]}
لو مفيش أي مبلغ رد {"items":[]}.`;
  const r=await samp.json(prompt,{modelTier:"quick",cache:false});
  if(!r||!Array.isArray(r.items)) return null;
  return r.items.filter(x=>x&&+x.amount>0).map(x=>{const inc=x.type==="دخل";const L=inc?INC:CATS;
    return {type:inc?"دخل":"مصروف",item:String(x.item||"مصروف").slice(0,60),amount:+x.amount,
    category:L.includes(x.category)?x.category:(inc?guessInc(String(x.item||"")):guessCat(String(x.item||""))),day_offset:Math.max(-7,Math.min(0,parseInt(x.day_offset)||0))}});
}

/* ---------- preview ---------- */
let draft=[];
function showPreview(){
  const pv=$("pv"); pv.innerHTML="";
  if(!draft.length){pv.innerHTML='<div class="pvempty">اللي هتقوله هيظهر هنا متحسب لوحده، وتدوس احفظ</div>';return}
  const tip=document.createElement("div"); tip.className="pnote2"; tip.textContent="دوس على أي بند تعدّله"; pv.appendChild(tip);
  draft.forEach((d,k)=>{
    const r=document.createElement("div"); r.className="pv";
    const t=document.createElement("input"); t.type="text"; t.id="pvt"+k; t.value=d.item; t.setAttribute("aria-label","البند");
    t.oninput=()=>{d.item=t.value};
    const a=document.createElement("input"); a.type="number"; a.id="pva"+k; a.inputMode="decimal"; a.value=d.amount; a.setAttribute("aria-label","المبلغ");
    a.oninput=()=>{d.amount=+a.value||0; sum.lastChild.textContent=fmt(draft.reduce((s,x)=>s+x.amount,0))+" جنيه"};
    const x=document.createElement("button"); x.className="x"; x.type="button"; x.textContent="×"; x.setAttribute("aria-label","شيل البند");
    x.onclick=()=>{draft.splice(k,1); showPreview()};
    const ty=document.createElement("select"); ty.id="pvy"+k; ty.className="ty"; ty.setAttribute("aria-label","النوع");
    ["مصروف","دخل"].forEach(n=>{const o=document.createElement("option");o.textContent=n;if(n===(d.type||"مصروف"))o.selected=true;ty.appendChild(o)});
    const c=document.createElement("select"); c.id="pvc"+k; c.setAttribute("aria-label","التصنيف");
    const fill=()=>{c.innerHTML="";(d.type==="دخل"?INC:CATS).forEach(n=>{const o=document.createElement("option");o.textContent=n;if(n===d.category)o.selected=true;c.appendChild(o)});d.category=c.value};
    fill(); c.onchange=()=>{d.category=c.value};
    ty.onchange=()=>{d.type=ty.value; fill()};
    const sel=document.createElement("div"); sel.className="pvsel"; sel.append(ty,c);
    const sm=document.createElement("button"); sm.type="button"; sm.className="pvs";
    const upd=()=>{sm.className="pvs"+(d.type==="دخل"?" in":"");sm.innerHTML="";const n=document.createElement("span");n.textContent=d.item||"—";
      const v=document.createElement("span");v.className="a";v.textContent=(d.type==="دخل"?"+ ":"")+fmt(d.amount||0);
      const cc=document.createElement("span");cc.className="c";cc.textContent=(d.type==="دخل"?"دخل · ":"")+(d.category||"");sm.append(n,v,cc)};
    upd(); sm.onclick=()=>r.classList.toggle("open");
    r.addEventListener("input",upd); r.addEventListener("change",upd);
    r.append(sm,t,a,x,sel); pv.appendChild(r);
  });
  const sum=document.createElement("div"); sum.className="pvsum";
  const l=document.createElement("span"); l.textContent="الإجمالي"; const v=document.createElement("span");
  v.textContent=fmt(draft.reduce((s,x)=>s+x.amount,0))+" جنيه"; sum.append(l,v); pv.appendChild(sum);
  const row=document.createElement("div"); row.className="row";
  const ok=document.createElement("button"); ok.className="primary"; ok.type="button"; ok.textContent="احفظ";
  ok.onclick=async()=>{
    ok.disabled=true;
    const base=$("d").value||todayIso();
    const list=draft.filter(x=>x.amount>0).map(x=>{const [y,m,dd]=base.split("-").map(Number);
      const dt=new Date(y,m-1,dd+(x.day_offset||0));
      return {type:x.type||"مصروف",item:x.item.trim()||"مصروف",amount:x.amount,category:x.category,date:iso(dt),ts:Date.now()}});
    try{await addItems(list); setSt("اتحفظ "+list.length+" بند ✓"); draft=[]; lastParsed=""; clearTimeout(autoT); showPreview(); $("say").value="";}
    catch(e){setSt("محصلش حفظ، جرب تاني",true); ok.disabled=false}
  };
  row.appendChild(ok); pv.appendChild(row);
}
function setSt(t,err){const s=$("st"); s.textContent=t; s.className="status"+(err?" err":"")}

let parseSeq=0, lastParsed="", autoT=null;
$("say").addEventListener("input",()=>{clearTimeout(autoT);
  if(!$("say").value.trim()){draft=[];lastParsed="";showPreview();setSt("");return}
  autoT=setTimeout(()=>$("go").click(),1800)});
$("go").onclick=async()=>{
  const text=$("say").value.trim();
  if(!text){return}
  if(text===lastParsed&&draft.length) return;
  const my=++parseSeq; lastParsed=text; setSt("بفهم الكلام…");
  let res=null;
  try{res=await aiParse(text)}catch(e){res=null}
  if(!res||!res.length){res=localParse(text).map(x=>({...x,day_offset:/امبارح|إمبارح/.test(text)?-1:0}))}
  if(my!==parseSeq) return;
  if(!res.length){draft=[];showPreview();setSt("قول المبلغ مع كل حاجة، زي: عيش بعشرة جنيه",true);return}
  draft=res; setSt(""); showPreview();
};

/* ---------- المايك: الكلام بيتكتب وانت بتتكلم، وبعدها Gemini يسمع التسجيل ويطلّع البنود ---------- */
(function(){
  const b=$("mic"), ta=$("say");
  const SR=window.SpeechRecognition||window.webkitSpeechRecognition;
  let sr=null, live="", base="";
  const idle=()=>{b.classList.remove("rec","busy");b.textContent="🎤 اتكلم";b.disabled=false};
  function startLive(){
    live=""; if(!SR) return;
    try{
      sr=new SR(); sr.lang="ar-EG"; sr.continuous=true; sr.interimResults=true;
      sr.onresult=e=>{let t="";for(let i=0;i<e.results.length;i++) t+=e.results[i][0].transcript+(e.results[i].isFinal?" ":"");
        live=t.trim(); ta.value=(base?base+" ":"")+live;};
      sr.onerror=()=>{}; sr.onend=()=>{if(mRec.on){try{sr.start()}catch(e){}}};
      sr.start();
    }catch(e){sr=null}
  }
  function stopLive(){try{if(sr){const s=sr;sr=null;s.onend=null;s.stop()}}catch(e){}}
  async function fromText(text){
    let res=null; try{res=await aiParse(text)}catch(e){}
    if(!res||!res.length) res=localParse(text).map(x=>({...x,day_offset:/امبارح|إمبارح/.test(text)?-1:0}));
    return res;
  }
  function show(its){
    if(its.length){draft=draft.concat(its);setSt("");showPreview()}
    else setSt("مسمعتش مبلغ. قول الحاجة ومعاها سعرها",true);
  }
  b.onclick=async()=>{
    if(b.classList.contains("busy")) return;
    if(!mRec.on){
      clearTimeout(autoT); base=ta.value.trim();
      try{await mRec.start()}catch(e){setSt("لازم توافق على الميكروفون من إعدادات الموبايل",true);return}
      startLive();
      b.classList.add("rec");b.textContent="⏹ وقّف";setSt("بسمعك… اتكلم عادي ودوس وقّف لما تخلص");
      return;
    }
    stopLive();
    b.classList.remove("rec");b.classList.add("busy");b.textContent="⏳ بفهم…";b.disabled=true;
    const {b64,secs,rms}=mRec.stop();
    parseSeq++; lastParsed=ta.value.trim();
    if(secs<0.6&&!live){idle();setSt("التسجيل قصير، جرّب تاني",true);return}
    setSt("بفهم الكلام…");
    try{
      if(rms<0.002&&live){ show(await fromText(live)); }
      else{
        const r=await window.mApi({action:"parse",audio:b64,mime:"audio/wav",today:todayIso()},30000);
        const said=(r.transcript||"").trim();
        if(said){ta.value=(base?base+" ":"")+said; lastParsed=ta.value.trim()}
        show((r.items||[]).map(x=>({type:x.type,item:x.item,amount:+x.amount,category:x.category,day_offset:x.day_offset||0})));
      }
    }catch(e){
      if(live){ setSt("بفهم من الكلام المكتوب…"); try{show(await fromText(live))}catch(_){setSt("محصلش فهم، جرّب تاني",true)} }
      else setSt(e&&e.code==="pin"?"الرقم السري اتغير":e&&e.code==="timeout"?"النت بطيء، جرّب تاني":"محصلش فهم، جرّب تاني أو اكتب بإيدك",true);
    }
    idle();
  };
})();
$("clr").onclick=()=>{clearTimeout(autoT);parseSeq++;lastParsed="";$("say").value="";draft=[];showPreview();setSt("")};
showPreview();

/* ---------- edit one entry ---------- */
async function updateItem(id,data){
  if(mode==="db"&&col){await col.doc(id).update(data); scheduleSync()}
  else{items=items.map(i=>i.id===id?{...i,...data}:i); saveLocal(); render();}
}
function editForm(i){
  const d=editDraft, f=document.createElement("div"); f.className="edit";
  const t=document.createElement("input");t.type="text";t.id="edt";t.value=d.item;t.setAttribute("aria-label","البند");t.oninput=()=>{d.item=t.value};
  const a=document.createElement("input");a.type="number";a.id="eda";a.inputMode="decimal";a.value=d.amount;a.setAttribute("aria-label","المبلغ");a.oninput=()=>{d.amount=+a.value||0};
  const ty=document.createElement("select");ty.id="edy";ty.setAttribute("aria-label","النوع");
  ["مصروف","دخل"].forEach(n=>{const o=document.createElement("option");o.textContent=n;if(n===d.type)o.selected=true;ty.appendChild(o)});
  const c=document.createElement("select");c.id="edc";c.setAttribute("aria-label","التصنيف");
  const fill=()=>{const L0=d.type==="دخل"?INC:CATS;const L=L0.includes(d.category)?L0:[d.category].concat(L0);c.innerHTML="";
    L.forEach(n=>{const o=document.createElement("option");o.textContent=n;if(n===d.category)o.selected=true;c.appendChild(o)})};
  fill(); c.onchange=()=>{d.category=c.value}; ty.onchange=()=>{d.type=ty.value;fill()};
  const dt=document.createElement("input");dt.type="date";dt.id="edd";dt.className="full";dt.value=d.date;dt.setAttribute("aria-label","التاريخ");dt.onchange=()=>{d.date=dt.value};
  const b=document.createElement("div");b.className="btns";
  const ok=document.createElement("button");ok.type="button";ok.className="primary";ok.textContent="احفظ التعديل";
  const no=document.createElement("button");no.type="button";no.textContent="إلغاء";
  no.onclick=()=>{editId=null;editDraft=null;render()};
  ok.onclick=async()=>{
    if(!(d.amount>0)){setSt("اكتب مبلغ أكبر من صفر",true);return}
    ok.disabled=true;
    const id=editId; const data={item:d.item.trim()||"مصروف",amount:d.amount,type:d.type,category:d.category,date:d.date||i.date};
    try{editId=null;editDraft=null;await updateItem(id,data);setSt("اتعدّل: "+data.item);render()}
    catch(e){editId=id;editDraft=d;ok.disabled=false;setSt("محصلش حفظ للتعديل، جرب تاني",true)}
  };
  b.append(ok,no);
  f.append(t,a,ty,c,dt,b);
  return f;
}

/* ---------- live copy in Google Sheets ---------- */
const GS_ID="1XEaQft4984YhrdqVxFiSk-IMCsCAqJ_uOx2ZG6Z73bw";
let gsTimer=null, gsBusy=false, gsAgain=false;
const MN=["يناير","فبراير","مارس","أبريل","مايو","يونيو","يوليو","أغسطس","سبتمبر","أكتوبر","نوفمبر","ديسمبر"];
const AD=x=>String(x).replace(/[0-9]/g,d=>"٠١٢٣٤٥٦٧٨٩"[d]);
const AN=n=>AD((Number.isInteger(n)?n.toLocaleString("en-US"):n.toLocaleString("en-US",{minimumFractionDigits:2,maximumFractionDigits:2})).replace(/,/g,"٬").replace(/\./g,"٫"));
const ARF=e=>{let t="t";for(let d=0;d<10;d++)t=`SUBSTITUTE(${t},"${d}","${"٠١٢٣٤٥٦٧٨٩"[d]}")`;
  return `=LET(v,${e},t,IF(v=INT(v),TEXT(v,"#,##0"),TEXT(v,"#,##0.00")),SUBSTITUTE(SUBSTITUTE(${t},",","٬"),".","٫"))`};
function gsMsg(t,err){const e=$("gsSt");e.textContent=t;e.className=err?"err":""}
function scheduleSync(){clearTimeout(gsTimer);gsTimer=setTimeout(syncSheet,4000)}
async function syncSheet(){
  if(mode!=="db") return;
  if(gsBusy){gsAgain=true;return}
  let mcp=null; try{mcp=await claude.use("mcp")}catch(e){}
  if(!mcp){gsMsg("الربط بـ Google Sheets مش متاح هنا",true);return}
  gsBusy=true; gsMsg("بزامن مع Google Sheets…");
  try{
    const rows=items.slice().sort((a,b)=>a.date>b.date?1:a.date<b.date?-1:(a.ts||0)-(b.ts||0));
    let prev=200; try{prev=parseInt(localStorage.getItem("gsN"))||200}catch(e){}
    const n=rows.length, last=Math.max(n,1)+1, vals=[];
    const E9=["","","","","","","","",""];
    rows.forEach(it=>{const a=+it.amount||0,[y,m,d]=it.date.split("-"),inc=isInc(it),[py,pm]=periodOf(it.date).split("-");
      vals.push([MN[+pm-1]+" "+AD(py),AD(y+"/"+m+"/"+d),it.item,it.category||"مصروف البيت",inc?AN(a):"",inc?"":AN(a),py+"-"+pm+"-01",inc?a:"",inc?"":a])});
    vals.push(E9.slice());
    vals.push(["","","الإجمالي","",ARF(`SUM(H2:H${last})`),ARF(`SUM(I2:I${last})`),"","",""]);
    vals.push(["","","المتبقي (الدخل - المصروف)","",ARF(`SUM(H2:H${last})-SUM(I2:I${last})`),"","","",""]);
    const total=Math.max(vals.length,prev+3)+20;
    while(vals.length<total) vals.push(E9.slice());
    await mcp.callTool("Google Sheets","update_values",{spreadsheetId:GS_ID,range:"'الحركات'!A2:I"+(total+1),values:vals});
    try{localStorage.setItem("gsN",String(rows.length))}catch(e){}
    await syncMonthTabs(mcp,rows);
    gsMsg("الشيت متزامن ✓ "+new Date().toLocaleTimeString("ar-EG",{hour:"numeric",minute:"2-digit"}));
  }catch(e){
    gsMsg("محصلش مزامنة، هتتعاد مع أول تغيير",true);
  }finally{gsBusy=false; if(gsAgain){gsAgain=false;scheduleSync()}}
}

/* تنسيق شيت الشهر: ألوان وحدود واضحة */
function monthFmt(id,n,clearTo){
  const C=h=>({red:parseInt(h.slice(1,3),16)/255,green:parseInt(h.slice(3,5),16)/255,blue:parseInt(h.slice(5,7),16)/255});
  const G=(r0,r1,c0,c1)=>({sheetId:id,startRowIndex:r0,endRowIndex:r1,startColumnIndex:c0,endColumnIndex:c1});
  const F=(bg,fg,bold,size)=>({backgroundColor:C(bg),horizontalAlignment:"CENTER",verticalAlignment:"MIDDLE",wrapStrategy:"WRAP",
    textFormat:{foregroundColor:C(fg),bold:!!bold,fontSize:size||11,fontFamily:"Arial"}});
  const cell=(r0,r1,c0,c1,f)=>({repeatCell:{range:G(r0,r1,c0,c1),cell:{userEnteredFormat:f},fields:"userEnteredFormat"}});
  const B=(style,hex)=>({style,color:C(hex)});
  const rows=Math.max(n,1), dEnd=3+rows, s0=4+n, R=[];
  R.push(cell(0,clearTo,0,7,F("#FFFFFF","#16241D")));
  R.push({unmergeCells:{range:G(0,clearTo,0,7)}});
  R.push({mergeCells:{range:G(0,1,0,5),mergeType:"MERGE_ALL"}});
  R.push({mergeCells:{range:G(1,2,0,5),mergeType:"MERGE_ALL"}});
  R.push(cell(0,1,0,5,F("#1E6A4C","#FFFFFF",true,16)));
  R.push(cell(1,2,0,5,F("#E1EBE4","#1E6A4C",true,12)));
  R.push(cell(2,3,0,5,F("#2E7D5B","#FFFFFF",true,12)));
  R.push(cell(3,dEnd,3,4,F("#FFFFFF","#1E6A4C",true)));
  R.push(cell(3,dEnd,4,5,F("#FFFFFF","#B3402F",true)));
  for(let r=4;r<dEnd;r+=2) R.push({repeatCell:{range:G(r,r+1,0,5),cell:{userEnteredFormat:{backgroundColor:C("#F1F6F2")}},fields:"userEnteredFormat.backgroundColor"}});
  R.push({updateBorders:{range:G(2,dEnd,0,5),top:B("SOLID_MEDIUM","#1E6A4C"),bottom:B("SOLID_MEDIUM","#1E6A4C"),left:B("SOLID_MEDIUM","#1E6A4C"),right:B("SOLID_MEDIUM","#1E6A4C"),innerHorizontal:B("SOLID","#C9D6CD"),innerVertical:B("SOLID","#C9D6CD")}});
  R.push({mergeCells:{range:G(s0,s0+1,1,3),mergeType:"MERGE_ALL"}});
  R.push({mergeCells:{range:G(s0+1,s0+2,1,3),mergeType:"MERGE_ALL"}});
  R.push({mergeCells:{range:G(s0+2,s0+3,1,3),mergeType:"MERGE_ALL"}});
  R.push(cell(s0,s0+1,1,5,F("#DCEFE3","#1E6A4C",true,12)));
  R.push(cell(s0+1,s0+2,1,5,F("#F8E1DC","#B3402F",true,12)));
  R.push(cell(s0+2,s0+3,1,5,F("#F6E7C1","#7A5A12",true,13)));
  R.push({updateBorders:{range:G(s0,s0+3,1,5),top:B("SOLID_MEDIUM","#A87A22"),bottom:B("SOLID_MEDIUM","#A87A22"),left:B("SOLID_MEDIUM","#A87A22"),right:B("SOLID_MEDIUM","#A87A22"),innerHorizontal:B("SOLID","#D9C79A")}});
  R.push({updateDimensionProperties:{range:{sheetId:id,dimension:"ROWS",startIndex:0,endIndex:1},properties:{pixelSize:40},fields:"pixelSize"}});
  R.push({updateDimensionProperties:{range:{sheetId:id,dimension:"ROWS",startIndex:1,endIndex:3},properties:{pixelSize:30},fields:"pixelSize"}});
  R.push({updateDimensionProperties:{range:{sheetId:id,dimension:"ROWS",startIndex:3,endIndex:clearTo},properties:{pixelSize:26},fields:"pixelSize"}});
  [[0,110],[1,230],[2,170],[3,110],[4,110]].forEach(([c,w])=>R.push({updateDimensionProperties:{range:{sheetId:id,dimension:"COLUMNS",startIndex:c,endIndex:c+1},properties:{pixelSize:w},fields:"pixelSize"}}));
  R.push({updateSheetProperties:{properties:{sheetId:id,rightToLeft:true,gridProperties:{frozenRowCount:3,hideGridlines:true},tabColorStyle:{rgbColor:C("#1E6A4C")}},fields:"rightToLeft,gridProperties.frozenRowCount,gridProperties.hideGridlines,tabColorStyle"}});
  return R;
}

/* ---------- شيت لكل شهر (من يوم القبض لليوم اللي قبل القبض الجاي) + ملخص تحته ---------- */
async function syncMonthTabs(mcp,rows){
  const keys=[...new Set(rows.filter(i=>i.date).map(i=>periodOf(i.date)))];keys.push(periodOf(todayIso()));
  const ks=[...new Set(keys)].sort();
  const r=await mcp.callTool("Google Sheets","get_spreadsheet",{spreadsheetId:GS_ID,fields:["sheets.properties.sheetId","sheets.properties.title"]},{cache:false});
  const p=r&&r.payload; const have={};
  if(p&&Array.isArray(p.sheets)){p.sheets.forEach(x=>{if(x&&x.properties) have[x.properties.title]=x.properties.sheetId});
    const used=new Set(Object.values(have)), reqs=[];
    ks.forEach(k=>{const title=pName(k); if(have[title]!=null) return;
      let id=+k.replace("-",""); while(used.has(id)) id++; used.add(id); have[title]=id;
      reqs.push({addSheet:{properties:{sheetId:id,title,index:0,rightToLeft:true,gridProperties:{rowCount:400,columnCount:7,frozenRowCount:3}}}});
      reqs.push({updateDimensionProperties:{range:{sheetId:id,dimension:"COLUMNS",startIndex:5,endIndex:7},properties:{hiddenByUser:true},fields:"hiddenByUser"}});});
    if(reqs.length) await mcp.callTool("Google Sheets","update_spreadsheet",{spreadsheetId:GS_ID,requests:reqs});
  }
  const E7=["","","","","","",""];
  for(const k of ks){
    const title=pName(k), rg=rangeOf(k), its=rows.filter(i=>i.date&&inPeriod(i,k));
    const vals=[[title,"","","","","",""],["من "+dFull(rg.start)+" إلى "+dFull(rg.end),"","","","","",""],
      ["التاريخ","البند","التصنيف","الدخل","المصروف","دخل","مصروف"]];
    its.forEach(it=>{const a=+it.amount||0,inc=isInc(it);
      vals.push([dFull(it.date),it.item,it.category||"مصروف البيت",inc?AN(a):"",inc?"":AN(a),inc?a:"",inc?"":a])});
    const last=Math.max(its.length,1)+3;
    vals.push(E7.slice());
    vals.push(["","إجمالي الدخل في الشهر","",ARF(`SUM(F4:F${last})`),"","",""]);
    vals.push(["","إجمالي المصروف في الشهر","","",ARF(`SUM(G4:G${last})`),"",""]);
    vals.push(["","المتبقي (الدخل - المصروف)","",ARF(`SUM(F4:F${last})-SUM(G4:G${last})`),"","",""]);
    let prev=0; try{prev=parseInt(localStorage.getItem("gsT:"+k))||0}catch(e){}
    const total=Math.max(vals.length,prev)+10;
    while(vals.length<total) vals.push(E7.slice());
    await mcp.callTool("Google Sheets","update_values",{spreadsheetId:GS_ID,range:"'"+title+"'!A1:G"+total,values:vals});
    try{localStorage.setItem("gsT:"+k,String(vals.length))}catch(e){}
    const gid=have[title]!=null?have[title]:+k.replace("-","");
    try{localStorage.setItem("gsG:"+k,String(gid))}catch(e){}
    try{await mcp.callTool("Google Sheets","update_spreadsheet",{spreadsheetId:GS_ID,requests:monthFmt(gid,its.length,Math.min(400,total+5))})}catch(e){}
  }
}
$("gsGo").onclick=()=>{clearTimeout(gsTimer);(window.mRefresh?window.mRefresh():Promise.resolve()).finally(syncSheet)};

/* ---------- التنقل بين الشهور ويوم القبض ---------- */
const curM=()=>viewM||periodOf(todayIso());
const goM=m=>{viewM=(m===periodOf(todayIso()))?null:m;editId=null;render()};
$("prevM").onclick=()=>goM(shiftM(curM(),-1));
$("nextM").onclick=()=>goM(shiftM(curM(),1));
$("months").onclick=e=>{const tr=e.target.closest("tr[data-m]");if(tr)goM(tr.dataset.m)};
$("pay").onchange=async()=>{
  const v=$("pay").value; if(!/^\d{4}-\d{2}-\d{2}$/.test(v)) return;
  const m=v.slice(0,7);
  paydays={...paydays,[m]:v};
  try{localStorage.setItem("paydays",JSON.stringify(paydays))}catch(e){}
  try{if(payCol) await payCol.doc("payday-"+m).set({type:"يوم قبض",date:v,ts:0})}catch(e){setSt("يوم القبض ما اتحفظش، جرب تاني",true)}
  goM(m); setSt(pName(m)+" بقى يبدأ "+dShort(v)); scheduleSync();
};

/* ---------- render list + totals ---------- */
function render(){
  setTimeout(()=>{if(window._pr)window._pr()},0);
  const t=todayIso(), mon=viewM||periodOf(t), rg=rangeOf(mon);
  const sum=a=>a.reduce((s,i)=>s+(+i.amount||0),0);
  const tDay=sum(items.filter(i=>i.date===t&&!isInc(i)));
  const monAll=items.filter(i=>i.date&&inPeriod(i,mon));
  $("mName").textContent=pName(mon);
  $("mRange").innerHTML='من <bdi dir="ltr">'+dFull(rg.start)+'</bdi> لـ <bdi dir="ltr">'+dFull(rg.end)+'</bdi>';
  $("pay").value=rg.start;
  $("pNote").textContent=paydays[mon]?"":"(افتراضي يوم "+DIG(DEF_DAY)+")";
  const ks=new Set(items.filter(i=>i.date).map(i=>periodOf(i.date))); ks.add(periodOf(t)); ks.add(mon);
  const tb=$("months"); tb.innerHTML="";
  [...ks].sort().reverse().slice(0,24).forEach(k=>{const r=rangeOf(k),a=items.filter(i=>i.date&&inPeriod(i,k));
    const ii=sum(a.filter(isInc)),ee=sum(a.filter(i=>!isInc(i)));
    const tr=document.createElement("tr");tr.dataset.m=k;if(k===mon)tr.className="cur";
    tr.innerHTML=`<td>${pName(k)}<small>${dShort(r.start)} ← ${dShort(r.end)}</small></td><td class="in">${fmt(ii)}</td><td>${fmt(ee)}</td><td class="${ii-ee<0?"neg":""}">${fmt(ii-ee)}</td>`;
    tb.appendChild(tr)});
  const monItems=monAll.filter(i=>!isInc(i));
  const inc=sum(monAll.filter(isInc)), exp=sum(monItems);
  $("tDay").textContent=fmt(tDay);
  $("tMon").textContent=fmt(exp); $("tInc").textContent=fmt(inc);
  $("tBal").textContent=fmt(inc-exp); $("balT").className="tot"+(inc-exp<0?" neg":" inc");
  $("mLbl").textContent="دخل الشهر";
  {const sb=$("stB");sb.innerHTML="";const rows=monAll.slice().sort((a,b)=>a.date>b.date?1:a.date<b.date?-1:(a.ts||0)-(b.ts||0));
   $("stT").textContent=pName(mon); $("stR").textContent="من "+dFull(rg.start)+" إلى "+dFull(rg.end);
   if(!rows.length){const tr=document.createElement("tr");tr.innerHTML='<td colspan="5">لسه مفيش حركات</td>';sb.appendChild(tr)}
   rows.forEach(i=>{const tr=document.createElement("tr"),inc=isInc(i);
     [dFull(i.date),i.item,i.category||"مصروف البيت",inc?fmt(+i.amount||0):"",inc?"":fmt(+i.amount||0)].forEach((v,j)=>{const td=document.createElement("td");td.textContent=v;if(j===3)td.className="i";if(j===4)td.className="e";tr.appendChild(td)});
     sb.appendChild(tr)});
   $("sI").textContent=fmt(inc);$("sE").textContent=fmt(exp);$("sB").textContent=fmt(inc-exp);
   let gid=+mon.replace("-","");try{gid=parseInt(localStorage.getItem("gsG:"+mon))||gid}catch(e){}
   $("pdfL").href="https://docs.google.com/spreadsheets/d/1XEaQft4984YhrdqVxFiSk-IMCsCAqJ_uOx2ZG6Z73bw/export?format=pdf&gid="+gid+"&size=A4&portrait=true&fitw=true&gridlines=false&sheetnames=false&printtitle=false&pagenum=UNDEFINED&horizontal_alignment=CENTER&top_margin=0.5&bottom_margin=0.5&left_margin=0.4&right_margin=0.4";
   $("shL").href="https://docs.google.com/spreadsheets/d/1XEaQft4984YhrdqVxFiSk-IMCsCAqJ_uOx2ZG6Z73bw/edit#gid="+gid;}
  const by={}; monItems.forEach(i=>{by[i.category||"مصروف البيت"]=(by[i.category||"مصروف البيت"]||0)+(+i.amount||0)});
  const ent=Object.entries(by).sort((a,b)=>b[1]-a[1]); const max=ent.length?ent[0][1]:0;
  const cats=$("cats"); cats.innerHTML="";
  if(!ent.length){cats.innerHTML='<div class="empty">لسه مفيش مصروفات الشهر ده</div>'}
  ent.forEach(([c,v])=>{const r=document.createElement("div");r.className="cat";
    const n=document.createElement("span");n.textContent=c;
    const b=document.createElement("div");b.className="bar";const i=document.createElement("i");i.style.width=(max?v/max*100:0)+"%";b.appendChild(i);
    const s=document.createElement("span");s.className="v";s.textContent=fmt(v);
    r.append(n,b,s);cats.appendChild(r)});
  const list=$("list"); list.innerHTML="";
  if(!monAll.length){list.innerHTML='<div class="empty">'+(items.length?"مفيش حركات في "+pName(mon):"أول ما تسجل مصروف أو دخل هيظهر هنا، مقسم بالأيام")+'</div>';return}
  const days={}; monAll.forEach(i=>{(days[i.date]=days[i.date]||[]).push(i)});
  Object.keys(days).sort().reverse().forEach(d=>{
    const g=document.createElement("div");g.className="day";
    const h=document.createElement("div");h.className="dayhead";
    const a=document.createElement("span");a.textContent=dayLabel(d);
    const s=document.createElement("span");s.className="s";s.textContent="صرف "+fmt(days[d].filter(i=>!isInc(i)).reduce((x,i)=>x+(+i.amount||0),0))+" ج";
    const del=document.createElement("button");del.type="button";del.className="delday";del.textContent="امسح اليوم";
    del.setAttribute("aria-label","امسح كل حركات "+dayLabel(d));
    del.onclick=async()=>{
      if(!del.classList.contains("c")){del.classList.add("c");del.textContent="متأكد؟ امسح "+days[d].length;
        setTimeout(()=>{if(del.isConnected&&!del.disabled){del.classList.remove("c");del.textContent="امسح اليوم"}},4000);return}
      del.disabled=true;del.textContent="بمسح…";
      for(const it of days[d].slice()){try{await removeItem(it.id)}catch(e){}}
      setSt("اتمسحت حركات "+dayLabel(d));
    };
    const rr=document.createElement("span");rr.className="r";rr.append(s,del);
    h.append(a,rr);g.appendChild(h);
    days[d].forEach(i=>{const r=document.createElement("div");r.className="ent"+(isInc(i)?" in":"");
      const t=document.createElement("div");t.className="t";t.textContent=i.item;
      const c=document.createElement("span");c.className="c";c.textContent=(isInc(i)?"دخل · ":"")+(i.category||"مصروف البيت");t.appendChild(c);
      const v=document.createElement("span");v.className="a";v.textContent=(isInc(i)?"+ ":"")+fmt(+i.amount||0);
      if(editId===i.id){g.appendChild(editForm(i));return}
      const acts=document.createElement("span");acts.className="acts";
      const ed=document.createElement("button");ed.type="button";ed.className="ed";ed.textContent="تعديل";ed.setAttribute("aria-label","عدّل "+i.item);
      ed.onclick=()=>{editId=i.id;editDraft={item:i.item,amount:+i.amount||0,type:isInc(i)?"دخل":"مصروف",category:i.category||"مصروف البيت",date:i.date};render()};
      const x=document.createElement("button");x.type="button";x.className="rm";x.textContent="مسح";x.setAttribute("aria-label","امسح "+i.item);
      x.onclick=()=>{ if(x.classList.contains("c")){x.disabled=true;removeItem(i.id).then(()=>setSt("اتمسح: "+i.item)).catch(()=>setSt("محصلش مسح، جرب تاني",true))} else {x.classList.add("c");x.textContent="متأكد؟";
        setTimeout(()=>{if(x.isConnected&&!x.disabled){x.classList.remove("c");x.textContent="مسح"}},3000)} };
      acts.append(ed,x);
      r.append(t,v,acts);g.appendChild(r)});
    list.appendChild(g);
  });
}

/* ---------- Excel export with formulas (same layout as the master sheet) ---------- */
function buildXlsx(){
  const X=window.XLSX, TX="'الحركات'", MON='[$-ar-EG]mmmm yyyy', NUM='#,##0.00', DT='yyyy/mm/dd';
  const ser=s=>{const [y,m,d]=s.split("-").map(Number);return (Date.UTC(y,m-1,d)-Date.UTC(1899,11,30))/864e5};
  const wb=X.utils.book_new(); wb.Workbook={Views:[{RTL:true}]};
  {const ks=[...new Set(items.filter(i=>i.date).map(i=>periodOf(i.date)).concat([periodOf(todayIso())]))].sort().reverse();
   ks.forEach(k=>{const rg=rangeOf(k), its=items.filter(i=>i.date&&inPeriod(i,k)).sort((a,b)=>a.date>b.date?1:a.date<b.date?-1:(a.ts||0)-(b.ts||0));
    const sh={}, P=(ref,c)=>{sh[ref]=c};
    P("A1",{t:"s",v:pName(k)}); P("A2",{t:"s",v:"من "+dFull(rg.start)+" إلى "+dFull(rg.end)});
    ["التاريخ","البند","التصنيف","الدخل (جنيه)","المصروف (جنيه)"].forEach((h,i)=>P(X.utils.encode_cell({r:2,c:i}),{t:"s",v:h}));
    its.forEach((it,j)=>{const r=4+j,a=+it.amount||0;
      P("A"+r,{t:"s",v:dFull(it.date)});P("B"+r,{t:"s",v:it.item});P("C"+r,{t:"s",v:it.category||"مصروف البيت"});
      if(isInc(it)) P("D"+r,{t:"n",v:a,z:NUM}); else P("E"+r,{t:"n",v:a,z:NUM});});
    const last=Math.max(its.length,1)+3, s0=last+2;
    P("B"+s0,{t:"s",v:"إجمالي الدخل في الشهر"});P("D"+s0,{t:"n",f:`SUM(D4:D${last})`,z:NUM});
    P("B"+(s0+1),{t:"s",v:"إجمالي المصروف في الشهر"});P("E"+(s0+1),{t:"n",f:`SUM(E4:E${last})`,z:NUM});
    P("B"+(s0+2),{t:"s",v:"المتبقي (الدخل - المصروف)"});P("D"+(s0+2),{t:"n",f:`D${s0}-E${s0+1}`,z:NUM});
    sh["!ref"]="A1:E"+(s0+2); sh["!cols"]=[{wch:13},{wch:28},{wch:20},{wch:14},{wch:14}];
    sh["!merges"]=[{s:{r:0,c:0},e:{r:0,c:4}},{s:{r:1,c:0},e:{r:1,c:4}}];
    X.utils.book_append_sheet(wb,sh,pName(k).slice(0,31));});}
  const rows=items.slice().sort((a,b)=>a.date>b.date?1:a.date<b.date?-1:(a.ts||0)-(b.ts||0));
  const t={}; const put=(sh,ref,c)=>{sh[ref]=c};
  ["الشهر","التاريخ","البند","التصنيف","الدخل (جنيه)","المصروف (جنيه)"].forEach((h,i)=>put(t,X.utils.encode_cell({r:0,c:i}),{t:"s",v:h}));
  const n=rows.length, last=Math.max(n,1)+1;
  for(let r=2;r<=n+1;r++){
    const it=rows[r-2], a=+it.amount||0;
    put(t,"A"+r,{t:"n",v:ser(periodOf(it.date)+"-01"),z:MON});
    put(t,"B"+r,{t:"n",v:ser(it.date),z:DT});put(t,"C"+r,{t:"s",v:it.item});put(t,"D"+r,{t:"s",v:it.category||"مصروف البيت"});
    if(isInc(it)) put(t,"E"+r,{t:"n",v:a,z:NUM}); else put(t,"F"+r,{t:"n",v:a,z:NUM});
  }
  const tr=n+3;
  put(t,"C"+tr,{t:"s",v:"الإجمالي"});put(t,"E"+tr,{t:"n",f:`SUM(E2:E${last})`,z:NUM});put(t,"F"+tr,{t:"n",f:`SUM(F2:F${last})`,z:NUM});
  put(t,"C"+(tr+1),{t:"s",v:"المتبقي (الدخل - المصروف)"});put(t,"E"+(tr+1),{t:"n",f:`E${tr}-F${tr}`,z:NUM});
  t["!ref"]="A1:F"+(tr+1); t["!cols"]=[{wch:14},{wch:12},{wch:28},{wch:20},{wch:14},{wch:14}];
  X.utils.book_append_sheet(wb,t,"الحركات");
  const m={};
  put(m,"A1",{t:"s",v:"مقارنة الدخل بالمصروفات"}); put(m,"A2",{t:"s",v:"السنة"}); put(m,"B2",{t:"n",f:"YEAR(TODAY())"});
  put(m,"C2",{t:"s",v:"← غيّر السنة هنا"});
  ["الشهر","الدخل","المصروفات","المتبقي (الفرق)","نسبة الادخار","المتبقي التراكمي"].forEach((h,i)=>put(m,X.utils.encode_cell({r:3,c:i}),{t:"s",v:h}));
  for(let k=1;k<=12;k++){const r=4+k;
    put(m,"A"+r,{t:"n",f:`DATE($B$2,${k},1)`,z:MON});
    put(m,"B"+r,{t:"n",f:`SUMIFS(${TX}!$E:$E,${TX}!$A:$A,$A${r})`,z:NUM});
    put(m,"C"+r,{t:"n",f:`SUMIFS(${TX}!$F:$F,${TX}!$A:$A,$A${r})`,z:NUM});
    put(m,"D"+r,{t:"n",f:`B${r}-C${r}`,z:NUM});
    put(m,"E"+r,{t:"n",f:`IF(B${r}=0,"",D${r}/B${r})`,z:"0.0%"});
    put(m,"F"+r,{t:"n",f:k===1?`D${r}`:`F${r-1}+D${r}`,z:NUM});}
  put(m,"A17",{t:"s",v:"إجمالي السنة"});
  ["B","C"].forEach(L=>put(m,L+"17",{t:"n",f:`SUM(${L}5:${L}16)`,z:NUM}));
  put(m,"D17",{t:"n",f:"B17-C17",z:NUM}); put(m,"E17",{t:"n",f:'IF(B17=0,"",D17/B17)',z:"0.0%"});
  put(m,"A18",{t:"s",v:"متوسط الشهر"});
  ["B","C"].forEach(L=>put(m,L+"18",{t:"n",f:`IFERROR(AVERAGEIF(${L}5:${L}16,">0"),0)`,z:NUM}));
  m["!ref"]="A1:F18"; m["!cols"]=[{wch:16},{wch:15},{wch:15},{wch:17},{wch:13},{wch:18}];
  X.utils.book_append_sheet(wb,m,"الملخص الشهري");
  const c={};
  put(c,"A1",{t:"s",v:"المصروفات والدخل حسب التصنيف"}); put(c,"A2",{t:"s",v:"الشهر"});
  put(c,"B2",{t:"n",v:ser(periodOf(todayIso())+"-01"),z:MON}); put(c,"C2",{t:"s",v:"← اكتب أي تاريخ في الشهر اللي عايزه"});
  let row=5;
  const block=(title,typ,cats)=>{ const V=typ==="دخل"?"$E:$E":"$F:$F";
    [title,"الشهر المختار","% من الشهر","السنة كلها","متوسط الشهر"].forEach((h,i)=>put(c,X.utils.encode_cell({r:row-1,c:i}),{t:"s",v:h}));
    const first=row+1,last=row+cats.length,tot=last+1;
    cats.forEach((cat,j)=>{const r=first+j;
      put(c,"A"+r,{t:"s",v:cat});
      put(c,"B"+r,{t:"n",f:`SUMIFS(${TX}!${V},${TX}!$D:$D,$A${r},${TX}!$A:$A,$B$2)`,z:NUM});
      put(c,"C"+r,{t:"n",f:`IF($B$${tot}=0,"",B${r}/$B$${tot})`,z:"0.0%"});
      put(c,"D"+r,{t:"n",f:`SUMIFS(${TX}!${V},${TX}!$D:$D,$A${r},${TX}!$A:$A,">="&DATE(YEAR($B$2),1,1),${TX}!$A:$A,"<="&DATE(YEAR($B$2),12,1))`,z:NUM});
      put(c,"E"+r,{t:"n",f:`D${r}/MAX(1,MONTH($B$2))`,z:NUM});});
    put(c,"A"+tot,{t:"s",v:"الإجمالي"});
    ["B","D","E"].forEach(L=>put(c,L+tot,{t:"n",f:`SUM(${L}${first}:${L}${last})`,z:NUM}));
    row=tot+3;
  };
  block("بند المصروف","مصروف",CATS); block("بند الدخل","دخل",INC);
  c["!ref"]="A1:E"+row; c["!cols"]=[{wch:20},{wch:16},{wch:13},{wch:16},{wch:15}];
  X.utils.book_append_sheet(wb,c,"حسب التصنيف");
  return X.write(wb,{bookType:"xlsx",type:"array"});
}
$("xl").onclick=async()=>{
  if(!window._dl||!window.XLSX) return;
  try{const data=buildXlsx();
    await window._dl.save({filename:"دفتر مصروفاتي "+todayIso()+".xlsx",
      data:new Blob([data],{type:"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"})});}catch(e){}
};

/* ---------- القايمة والشاشات ---------- */
(function(){
  const dr=$("drawer"), sc=$("scrim"), pn=$("panel"), pb=$("pBody");
  let calM=null, view=null, dSel=todayIso(), wSel=null, q="", qCat="";
  const sum=a=>a.reduce((s,i)=>s+(+i.amount||0),0);
  const exp=a=>a.filter(i=>!isInc(i));
  const DD=s=>'<bdi dir="ltr">'+dFull(s)+'</bdi>';
  const wdName=s=>{const [y,m,d]=s.split("-").map(Number);return new Date(y,m-1,d).toLocaleDateString("ar-EG",{weekday:"long"})};
  const wkStart=s=>{const [y,m,d]=s.split("-").map(Number);const dt=new Date(y,m-1,d);return addD(s,-((dt.getDay()+1)%7))};
  const diffDays=(a,b)=>{const f=x=>{const [y,m,d]=x.split("-").map(Number);return Date.UTC(y,m-1,d)};return Math.round((f(b)-f(a))/864e5)};
  const esc=t=>String(t).replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
  function menuNums(){const t=todayIso(), ws=wkStart(t), m=periodOf(t);
    {const pa=items.filter(i=>i.date&&inPeriod(i,m)), r=sum(pa.filter(isInc))-sum(exp(pa));
     $("mvI").textContent=fmt(sum(pa.filter(isInc)));
     $("mvR").textContent=fmt(r); $("mvR").className="mv"+(r<0?" neg":"");
     const pend=(window._reqs||[]).filter(q=>q.status!=="اتنفذ").length; $("reqN").hidden=!pend; $("reqN").textContent=DIG(pend);}
    const e=exp(items);
    $("mvD").textContent=fmt(sum(e.filter(i=>i.date===t)));
    $("mvW").textContent=fmt(sum(e.filter(i=>i.date>=ws&&i.date<=t)));
    $("mvM").textContent=fmt(sum(e.filter(i=>i.date&&inPeriod(i,m))));}
  function openM(){menuNums();dr.classList.add("on");sc.classList.add("on");dr.setAttribute("aria-hidden","false");$("mbtn").setAttribute("aria-expanded","true");
    $("miXl").hidden=$("xl").hidden; $("miSync").hidden=$("gs").hidden; setTimeout(()=>{const b=dr.querySelector(".mi");b&&b.focus()},60)}
  function closeM(){dr.classList.remove("on");sc.classList.remove("on");dr.setAttribute("aria-hidden","true");$("mbtn").setAttribute("aria-expanded","false")}
  function closeP(){pn.classList.remove("on");view=null;document.body.style.overflow=""}
  function go(el){closeP();setTimeout(()=>el.scrollIntoView({behavior:"smooth",block:"start"}),30)}
  function openP(v){view=v;pn.classList.add("on");document.body.style.overflow="hidden";pn.scrollTop=0;draw()}
  $("mbtn").onclick=openM; $("mclose").onclick=closeM; sc.onclick=closeM; $("pMenu").onclick=openM; $("pBack").onclick=closeP;
  document.addEventListener("keydown",e=>{if(e.key==="Escape"){if(dr.classList.contains("on"))closeM();else if(view)closeP()}});
  let dtM=null; const dtO=new Set();
  [["totInc","inc"],["totExp","exp"]].forEach(([id,v])=>{const el=$(id);
    const f=()=>{dtM=viewM||periodOf(todayIso());dtO.clear();openP(v)};
    el.onclick=f; el.onkeydown=ev=>{if(ev.key==="Enter"||ev.key===" "){ev.preventDefault();f()}}});
  dr.onclick=e=>{const b=e.target.closest("[data-act]");if(!b)return;const a=b.dataset.act;closeM();
    if(a==="add"||a==="addInc"){closeP();window.scrollTo({top:0,behavior:"smooth"});const ta=$("say");
      if(a==="addInc"){ta.placeholder="مثلاً: قبضت المرتب خمستاشر ألف، أو جالي مكافأة بألفين";if(!ta.value.trim())ta.value="قبضت "}
      else{ta.placeholder="مثلاً: جبت عيش بعشرة وركبت مواصلات بعشرين";if(ta.value.trim()==="قبضت")ta.value=""}
      setTimeout(()=>{ta.focus();try{ta.setSelectionRange(ta.value.length,ta.value.length)}catch(e){}},250)}
    else if(a==="day"){dSel=todayIso();openP("day")}
    else if(a==="week"){wSel=wkStart(todayIso());openP("week")}
    else if(a==="inc"){dtM=periodOf(todayIso());dtO.clear();openP("inc")}
    else if(a==="rem")go($("tBal").closest(".totals"));
    else if(a==="req"){openP("req");setTimeout(()=>{const i=$("rqIn");i&&i.focus()},80)}
    else if(a==="cal"){calM=periodOf(todayIso());openP("cal")}
    else if(a==="search"){openP("search");setTimeout(()=>{const i=$("qIn");i&&i.focus()},80)}
    else if(a==="month")go($("mName").closest(".card"));
    else if(a==="cat")go($("cats").closest(".card"));
    else if(a==="sheet")go($("stB").closest(".card"));
    else if(a==="all")go($("months").closest(".card"));
    else if(a==="xl")$("xl").click();
    else if(a==="sync"){closeP();$("gsGo").click();go($("gs"))}
  };

  function calData(k){const t=todayIso();
    const rg=rangeOf(k), [sy,sm,sd]=rg.start.split("-").map(Number);
    const lead=(new Date(sy,sm-1,sd).getDay()+1)%7;
    const days=[]; for(let d=rg.start;d<=rg.end;d=addD(d,1)) days.push(d);
    const e=exp(items.filter(i=>i.date&&inPeriod(i,k))), by={};
    e.forEach(i=>{by[i.date]=(by[i.date]||0)+(+i.amount||0)});
    const tot=sum(e), cnt=Object.keys(by).length, pdSet=new Set(Object.values(paydays));
    const top=Object.entries(by).sort((a,b)=>b[1]-a[1])[0];
    const WD=["سبت","أحد","اتنين","تلات","أربع","خميس","جمعة"];
    let g=WD.map(w=>'<div class="wh">'+w+'</div>').join("")+'<div class="em"></div>'.repeat(lead);
    days.forEach(d=>{const v=by[d]||0;
      g+='<button type="button" class="cd'+(v?" has":"")+(d===t?" t":"")+(d>t?" fut":"")+(pdSet.has(d)?" pd":"")+'" data-d="'+d+'" aria-label="'+dShort(d)+(v?"، صرفت "+fmt(v)+" جنيه":"")+'"><span class="n">'+DIG(+d.slice(8))+((d===rg.start||d.slice(8)==="01")?'<small class="mo">'+MONTHS[+d.slice(5,7)-1]+'</small>':'')+'</span><span class="v">'+(v?fmt(v):"")+'</span></button>'});
    return {rg,g,tot,cnt,top};}
  let homeM=null, homeOpen=false;
  function homeCal(){const box=$("homeCal"); if(!box) return;
    const k=homeM||periodOf(todayIso()), {rg,g,tot}=calData(k);
    box.innerHTML=nav("h",pName(k),'من '+DD(rg.start)+' لـ '+DD(rg.end))+'<div class="cal">'+g+'</div>'+
      '<div class="kv"><span>صرفت في الشهر ده</span><b>'+fmt(tot)+' ج</b></div>';
    $("hP").onclick=()=>{homeM=shiftM(k,-1);homeCal()}; $("hN").onclick=()=>{const n=shiftM(k,1);homeM=n===periodOf(todayIso())?null:n;homeCal()};
    box.querySelectorAll(".cd").forEach(b=>b.onclick=()=>{dSel=b.dataset.d;openP("day")});}
  function catBars(list){const by={};list.forEach(i=>{const c=i.category||"مصروف البيت";by[c]=(by[c]||0)+(+i.amount||0)});
    const e=Object.entries(by).sort((a,b)=>b[1]-a[1]),mx=e.length?e[0][1]:0;
    if(!e.length) return '<div class="empty">مفيش مصروف</div>';
    return '<div class="cats">'+e.map(([c,v])=>'<div class="cat"><span>'+esc(c)+'</span><div class="bar"><i style="width:'+(mx?v/mx*100:0)+'%"></i></div><span class="v">'+fmt(v)+'</span></div>').join("")+'</div>'}
  function nav(id,title,sub){return '<nav class="mnav"><button type="button" id="'+id+'P" aria-label="اللي قبله">›</button><div class="mt"><b>'+title+'</b><small>'+sub+'</small></div><button type="button" id="'+id+'N" aria-label="اللي بعده">‹</button></nav>'}
  function draw(){
    if(!view) return; const t=todayIso();
    if(view==="day"){
      $("pT").textContent="تفصيلة اليوم";
      const all=items.filter(i=>i.date===dSel), e=exp(all), inL=all.filter(isInc);
      const lbl=dSel===t?"النهارده":dSel===addD(t,-1)?"امبارح":wdName(dSel);
      const dRows=a=>a.slice().sort((x,y)=>(x.ts||0)-(y.ts||0)).map(i=>'<div class="res'+(isInc(i)?" in":"")+'"><span>'+esc(i.item)+'</span><span class="a">'+(isInc(i)?"+ ":"")+fmt(+i.amount||0)+' ج</span><span class="c">'+esc(i.category||(isInc(i)?"دخل":"مصروف البيت"))+'</span></div>').join("");
      const dSec=(title,a)=>'<section class="card"><div class="sechead"><h2>'+title+'</h2><b>'+fmt(sum(a))+' ج</b></div><div>'+dRows(a)+'</div></section>';
      pb.innerHTML='<section class="card">'+nav("d",lbl,DD(dSel))+'</section>'+
        (all.length?(e.length?dSec("المصروفات",e):'')+(inL.length?dSec("الدخل",inL):''):'<div class="empty">مفيش مصروف ولا دخل في اليوم ده</div>');
      $("dP").onclick=()=>{dSel=addD(dSel,-1);draw()}; $("dN").onclick=()=>{dSel=addD(dSel,1);draw()};
    }
    else if(view==="week"){
      $("pT").textContent="المصروف الأسبوعي";
      const ws=wSel, we=addD(ws,6), pws=addD(ws,-7);
      const inW=(i,a,b)=>i.date>=a&&i.date<=b;
      const e=exp(items.filter(i=>i.date&&inW(i,ws,we))), pe=exp(items.filter(i=>i.date&&inW(i,pws,addD(ws,-1))));
      const tot=sum(e), ptot=sum(pe);
      const passed=t<ws?0:t>we?7:diffDays(ws,t)+1;
      const days=[...Array(7)].map((_,k)=>{const d=addD(ws,k);return [d,sum(e.filter(i=>i.date===d))]}), mx=Math.max(0,...days.map(x=>x[1]));
      const big=e.slice().sort((a,b)=>(+b.amount||0)-(+a.amount||0))[0];
      let cmp="";
      if(ptot>0){const d=tot-ptot;cmp=d===0?"زي الأسبوع اللي فات بالظبط":'<span class="'+(d>0?"up":"down")+'">'+(d>0?"أكتر":"أقل")+' من الأسبوع اللي فات بـ '+fmt(Math.abs(d))+' جنيه</span>'}
      pb.innerHTML='<section class="card">'+nav("w",ws===wkStart(t)?"الأسبوع ده":"أسبوع "+dShort(ws),'من '+DD(ws)+' لـ '+DD(we))+'</section>'+
        '<div class="tot main"><small>صرفت في الأسبوع</small><span><b>'+fmt(tot)+'</b><span class="cur">جنيه</span></span></div>'+
        '<section class="card">'+
          '<div class="kv"><span>متوسط اليوم</span><b>'+(passed?fmt(Math.round(tot/passed)):"—")+' ج</b></div>'+
          '<div class="kv"><span>الأسبوع اللي فات</span><b>'+fmt(ptot)+' ج</b></div>'+
          (cmp?'<div class="kv"><span>المقارنة</span><b>'+cmp+'</b></div>':'')+
          (big?'<div class="kv"><span>أكبر بند</span><b>'+esc(big.item)+' · '+fmt(+big.amount||0)+'</b></div>':'')+
        '</section>'+
        '<section class="card"><h2>يوم بيوم</h2><div>'+days.map(([d,v])=>'<div class="wd'+(d===t?" today":"")+'" data-d="'+d+'" role="button" tabindex="0"><span>'+wdName(d)+'</span><div class="bar"><i style="width:'+(mx?v/mx*100:0)+'%"></i></div><span class="v">'+fmt(v)+'</span></div>').join("")+'</div><p class="pnote">دوس على أي يوم تشوف حركاته</p></section>'+
        '<section class="card"><h2>حسب البند</h2>'+catBars(e)+'</section>';
      $("wP").onclick=()=>{wSel=addD(wSel,-7);draw()}; $("wN").onclick=()=>{wSel=addD(wSel,7);draw()};
      pb.querySelectorAll(".wd").forEach(r=>{const f=()=>{dSel=r.dataset.d;view="day";pn.scrollTop=0;draw()};r.onclick=f;r.onkeydown=ev=>{if(ev.key==="Enter")f()}});
    }
    else if(view==="inc"||view==="exp"){
      const isI=view==="inc", rg=rangeOf(dtM), fb=isI?"دخل":"مصروف البيت";
      $("pT").textContent=isI?"تفصيلة دخل الشهر":"تفصيلة مصروف الشهر";
      const a=items.filter(i=>i.date&&inPeriod(i,dtM)&&(isI?isInc(i):!isInc(i)));
      const by={}; a.forEach(i=>{const c=i.category||fb;(by[c]=by[c]||[]).push(i)});
      const ent=Object.entries(by).map(([c,l])=>[c,l,sum(l)]).sort((x,y)=>y[2]-x[2]);
      const row=i=>'<div class="res'+(isI?" in":"")+'"><span>'+esc(i.item)+'</span><span class="a">'+fmt(+i.amount||0)+' ج</span><span class="c">'+DD(i.date)+'</span></div>';
      pb.innerHTML='<section class="card">'+nav("dt",pName(dtM),'من '+DD(rg.start)+' لـ '+DD(rg.end))+'</section>'+
        '<div class="tot main"><small>'+(isI?"إجمالي الدخل":"إجمالي المصروف")+'</small><span><b>'+fmt(sum(a))+'</b><span class="cur">جنيه</span></span></div>'+
        (ent.length?'<section class="card"><div>'+ent.map(([c,l,v])=>'<details class="dtc" data-c="'+esc(c)+'"'+((isI||dtO.has(c))?' open':'')+'><summary><span class="n">'+esc(c)+'<small>'+DIG(l.length)+(l.length===1?" حركة":" حركات")+'</small></span><span class="v">'+fmt(v)+' ج</span></summary><div>'+l.slice().sort((x,y)=>x.date<y.date?1:x.date>y.date?-1:(y.ts||0)-(x.ts||0)).map(row).join("")+'</div></details>').join("")+'</div>'+
          (isI?'':'<p class="pnote">دوس على أي بند تشوف اللي تحته.</p>')+'</section>'
        :'<div class="empty">'+(isI?"مفيش دخل متسجل في الشهر ده":"مفيش مصروف متسجل في الشهر ده")+'</div>');
      $("dtP").onclick=()=>{dtM=shiftM(dtM,-1);dtO.clear();draw()}; $("dtN").onclick=()=>{dtM=shiftM(dtM,1);dtO.clear();draw()};
      if(!isI) pb.querySelectorAll(".dtc").forEach(d=>d.ontoggle=()=>{d.open?dtO.add(d.dataset.c):dtO.delete(d.dataset.c)});
    }
    else if(view==="req"){
      $("pT").textContent="اطلب تعديل في الدفتر";
      const keep=$("rqIn")?$("rqIn").value:"";
      const rs=(window._reqs||[]).slice().sort((a,b)=>(b.ts||0)-(a.ts||0));
      pb.innerHTML='<section class="card"><label class="lbl" for="rqIn">عايز تغيّر إيه؟</label>'+
        '<textarea id="rqIn" placeholder="اكتب بالعامية… مثلاً: ضيف بند «نادي الولاد» في التصنيفات، أو كبّر خط الأرقام، أو شيل جدول كل الشهور"></textarea>'+
        '<div class="row"><button type="button" class="primary" id="rqGo">ابعت الطلب</button></div><div class="status" id="rqSt"></div>'+
        '<p class="pnote">الطلبات بتتحفظ هنا. افتح شات جديد مع Claude وقول «نفّذ طلبات الدفتر»، وهو يعمل التعديلات كلها مرة واحدة ويعلّم عليها إنها اتنفذت.</p></section>'+
        '<section class="card"><h2>طلباتك</h2>'+(rs.length?rs.map(q=>'<div class="rq"><div class="rt">'+esc(q.item||"")+'</div>'+
          (q.note?'<div class="note">'+esc(q.note)+'</div>':'')+
          '<div class="rm"><span>'+(q.date?DD(q.date):"")+'</span><span><span class="st'+(q.status==="اتنفذ"?" ok":"")+'">'+(q.status==="اتنفذ"?"اتنفذ ✓":"مستني التنفيذ")+'</span> '+
          '<button type="button" data-del="'+q.id+'">'+(q.status==="اتنفذ"?"شيله":"إلغاء")+'</button></span></div></div>').join(""):'<div class="empty">مفيش طلبات لسه</div>')+'</section>';
      $("rqIn").value=keep;
      $("rqGo").onclick=async()=>{const v=$("rqIn").value.trim(); if(!v){$("rqSt").textContent="اكتب التعديل الأول";return}
        if(mode!=="db"||!col){$("rqSt").textContent="مفيش اتصال بالشيت";return}
        $("rqGo").disabled=true;
        try{await col.add({type:"طلب تعديل",item:v,status:"جديد",date:todayIso(),ts:Date.now()});$("rqIn").value="";$("rqSt").textContent="اتبعت ✓"}
        catch(e){$("rqSt").textContent="محصلش حفظ، جرب تاني"}
        $("rqGo").disabled=false};
      pb.querySelectorAll("[data-del]").forEach(b=>b.onclick=async()=>{
        if(!b.classList.contains("c")){b.classList.add("c");b.textContent="متأكد؟";return}
        try{await col.doc(b.dataset.del).delete()}catch(e){}});
    }
    else if(view==="cal"){
      $("pT").textContent="التقويم";
      const {rg,g,tot,cnt,top}=calData(calM);
      pb.innerHTML='<section class="card">'+nav("c",pName(calM),'من '+DD(rg.start)+' لـ '+DD(rg.end))+'<div class="cal">'+g+'</div>'+
        '<p class="pnote">الرقم الأحمر = اللي اتصرف في اليوم. الإطار الأخضر النهارده، والمنقط يوم القبض. دوس على أي يوم تشوف حركاته.</p></section>'+
        '<section class="card">'+
          '<div class="kv"><span>إجمالي مصروف '+pName(calM)+'</span><b>'+fmt(tot)+' ج</b></div>'+
          '<div class="kv"><span>أيام فيها صرف</span><b>'+DIG(cnt)+' يوم</b></div>'+
          (top?'<div class="kv"><span>أكتر يوم صرف</span><b>'+dShort(top[0])+' · '+fmt(top[1])+' ج</b></div>':'')+
        '</section>';
      $("cP").onclick=()=>{calM=shiftM(calM,-1);draw()}; $("cN").onclick=()=>{calM=shiftM(calM,1);draw()};
      pb.querySelectorAll(".cd").forEach(b=>b.onclick=()=>{dSel=b.dataset.d;view="day";pn.scrollTop=0;draw()});
    }
    else if(view==="search"){
      $("pT").textContent="دوّر في مصروفاتي";
      if(!$("qIn")){
        pb.innerHTML='<section class="card"><input class="srch" id="qIn" type="search" placeholder="اكتب اسم البند… بنزين، سجاير، دروس" aria-label="دوّر"><select id="qCat" aria-label="التصنيف"><option value="">كل التصنيفات</option>'+CATS.concat(INC).map(c=>'<option>'+esc(c)+'</option>').join("")+'</select></section><div id="qOut" class="wrap" style="max-width:none"></div>';
        $("qIn").value=q; $("qCat").value=qCat;
        $("qIn").oninput=()=>{q=$("qIn").value;draw()}; $("qCat").onchange=()=>{qCat=$("qCat").value;draw()};
      }
      const n=s=>String(s||"").replace(/[أإآ]/g,"ا").replace(/ة/g,"ه").replace(/ى/g,"ي").toLowerCase();
      const qq=n(q.trim());
      const out=$("qOut");
      if(!qq&&!qCat){out.innerHTML='<div class="empty">اكتب كلمة أو اختار تصنيف</div>';return}
      const r=items.filter(i=>i.date&&(!qCat||i.category===qCat)&&(!qq||n(i.item).includes(qq)||n(i.category).includes(qq)));
      const byM={};r.forEach(i=>{const k=periodOf(i.date);(byM[k]=byM[k]||[]).push(i)});
      const ks=Object.keys(byM).sort().reverse();
      out.innerHTML='<div class="tot main"><small>'+DIG(r.length)+' حركة · المصروف</small><span><b>'+fmt(sum(exp(r)))+'</b><span class="cur">جنيه</span></span>'+(sum(r.filter(isInc))?'<small>والدخل '+fmt(sum(r.filter(isInc)))+' جنيه</small>':'')+'</div>'+
        (r.length?ks.map(k=>{const a=byM[k].sort((x,y)=>x.date<y.date?1:-1);return '<section class="card"><div class="sechead"><h2>'+pName(k)+'</h2><b>'+fmt(sum(exp(a)))+'</b></div>'+
          a.map(i=>'<div class="res'+(isInc(i)?" in":"")+'"><span>'+esc(i.item)+'</span><span class="a">'+(isInc(i)?"+ ":"")+fmt(+i.amount||0)+'</span><span class="c">'+DD(i.date)+' · '+esc(i.category||"مصروف البيت")+'</span></div>').join("")+'</section>'}).join(""):'<div class="empty">ملقيتش حاجة</div>');
    }
  }
  window._pr=()=>{menuNums();homeCal();if(view)draw()};
  homeCal();
})();
})();
