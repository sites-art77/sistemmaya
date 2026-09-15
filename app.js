/* MAYA Garden Pro — App (hash router + GSAP + tudo editável) */
const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const esc = s => String(s??'').replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const brl = v => (Number(v)||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
function numBR(v){
  if(typeof v==='number') return Number.isFinite(v)?v:0;
  let s=String(v??'').trim().replace(/[R$\s]/g,'');
  if(!s) return 0;
  const hasC=s.includes(','), hasD=s.includes('.');
  if(hasC && hasD) s=s.replace(/\./g,'').replace(',','.');
  else if(hasC) s=s.replace(',','.');
  else if(hasD){
    const parts=s.split('.');
    if(parts.length>2) s=parts.join('');
    else if(parts[1] && parts[1].length===3) s=parts.join('');
  }
  const n=Number(s);
  return Number.isFinite(n)?n:0;
}
window.numBR = numBR;
const todayISO = () => new Date().toISOString().slice(0,10);
const addDays = (iso,d) => { const t=new Date(iso||todayISO()); t.setDate(t.getDate()+Number(d||0)); return t.toISOString().slice(0,10); };
const fmtDate = iso => { try{ return new Date(iso+'T12:00:00').toLocaleDateString('pt-BR'); }catch{ return iso||''; } };

let Draft = null; // orçamento em edição
let CalcSel = null; // índice do item recebendo dica

function toast(msg){
  let w = document.getElementById('toasts');
  if(!w){ w = document.createElement('div'); w.id='toasts'; w.setAttribute('role','status'); w.setAttribute('aria-live','polite'); document.body.appendChild(w); }
  try{ while(w.children && w.children.length>=3) w.firstChild.remove(); }catch(e){}
  const t = document.createElement('div');
  t.className = 'toast';
  const label = document.createElement('span'); label.textContent = msg; t.appendChild(label);
  const bar = document.createElement('span'); bar.className='toast-bar'; t.appendChild(bar);
  w.appendChild(t);
  const reduced = navReduced();
  if(window.gsap && !reduced) gsap.fromTo(t,{y:16,opacity:0},{y:0,opacity:1,duration:.3,ease:'power3.out'});
  setTimeout(()=>{ if(window.gsap && !reduced) gsap.to(t,{opacity:0,y:8,duration:.3,onComplete:()=>t.remove()}); else t.remove(); }, 2400);
}
function animateIn(){
  if(!window.gsap) { $$('.anim-in').forEach(e=>e.style.opacity=1); return; }
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  if(reduced){ gsap.set('.anim-in',{opacity:1}); return; }
  gsap.fromTo('.anim-in',{y:18,opacity:0},{y:0,opacity:1,duration:.5,stagger:.06,ease:'power3.out',overwrite:true,clearProps:'transform'});
}
function countUp(el, val, fmt){
  const f = fmt || brl;
  if(!window.gsap || matchMedia('(prefers-reduced-motion: reduce)').matches){ el.textContent = f(val); return; }
  const o = {v:0};
  gsap.to(o,{v:Number(val)||0,duration:.7,ease:'power2.out',onUpdate:()=>el.textContent=f(o.v)});
}

/* ---------- cálculos ---------- */
function recalcDraft(){
  if(!Draft) return;
  Draft.discount = Math.max(0, Number(Draft.discount)||0);
  Draft.discountType = Draft.discountType==='vlr' ? 'vlr' : 'pct';
  if(Draft.discountType==='pct') Draft.discount = Math.min(100, Draft.discount);
  Draft.displacement = Math.max(0, Number(Draft.displacement)||0);
  Draft.signalPct = Math.min(100, Math.max(0, Number(Draft.signalPct)||0));
  Draft.serviceValue = Math.max(0, Number(Draft.serviceValue)||0);
  const livre = (Draft.quoteMode||'livre')==='livre';
  const itemSum = livre ? 0 : (Draft.items||[]).reduce((s,it)=>s+(Number(it.qty)||0)*(Number(it.unit)||0),0);
  const freeVal = livre ? Draft.serviceValue : 0;
  Draft.subtotal = itemSum + freeVal;
  const d = Number(Draft.discount||0);
  Draft.discountVal = Draft.discountType==='pct' ? Draft.subtotal*d/100 : d;
  Draft.total = Math.max(0, Draft.subtotal - Draft.discountVal + (Number(Draft.displacement)||0));
}
function blankBudget(){
  const st = Store.settings;
  const t = todayISO();
  return {
    id: Store.uid(), number: Store.nextNumber(), date: t, validity: addDays(t, Number(st.validityDays||15)),
    status:'pendente', client:{name:'',phone:'',address:''},
    items:[{desc:'',qty:1,unitLabel:'un',unit:0}],
    // compat: usamos it.unit como valor; unitPrice espelho
    discount:0, discountType:'pct', discountVal:0, subtotal:0, displacement:0,
    signalPct:0, payment:'Pix', payMethod:'Pix', payParcels:1, notes:'', serviceText:'', serviceValue:0, quoteMode:'livre', photos:[], paid:{entries:[]}, createdAt:new Date().toISOString()
  };
}
// normaliza item antigo (unit vs unitPrice)
function normItems(b){
  b.items = (b.items||[]).map(it=>({...it, qty:Number(it.qty??it.qtd??1), unit:Number(it.unit??it.unitPrice??it.valor??0)}));
  if(!Array.isArray(b.photos)) b.photos=[];
  if(!b.paid || !Array.isArray(b.paid.entries)) b.paid={entries:[]};
  if(!b.payMethod) b.payMethod=b.payment||'Pix';
  if(!b.payParcels) b.payParcels=1;
  if(b.serviceText==null) b.serviceText='';
  b.serviceValue=Math.max(0, Number(b.serviceValue)||0);
  if(b.quoteMode!=='livre' && b.quoteMode!=='itens'){
    const hasItems=(b.items||[]).some(it=>String(it.desc||'').trim() && Number(it.unit)>0);
    b.quoteMode = (hasItems && !String(b.serviceText||'').trim()) ? 'itens' : 'livre';
  }
  return b;
}
function payLabel(b){ const m=(b&&b.payMethod)||(b&&b.payment)||'Pix'; const n=Math.min(21,Math.max(1,Number((b&&b.payParcels)||1)));
  if(/crédito/i.test(m)&&n>1&&Number(b.total)>0) return `${m} em ${n}x de ${brl(Number(b.total)/n)}`;
  return m; }
window.toggleParcels=()=>{ const m=$('#f-paymethod'); const box=$('#f-parcelsbox'); if(box) box.style.display=(m&&/crédito/i.test(m.value))?'':'none'; recalcDraftSilent(); };

/* ---------- router ---------- */
const routes = ['#/','#/novo','#/orcamentos','#/clientes','#/catalogo','#/agenda','#/config'];
function currentRoute(){ return location.hash || '#/'; }
/* ---------- transição de rotas ---------- */
function navReduced(){ try{ return matchMedia('(prefers-reduced-motion: reduce)').matches; }catch(e){ return true; } }
function navProgStart(){
  let bar = document.getElementById('navprog');
  if(!bar){ bar = document.createElement('div'); bar.id='navprog'; document.body.appendChild(bar); }
  if(window.gsap && !navReduced()){ gsap.killTweensOf(bar); gsap.fromTo(bar,{width:'0%',opacity:1},{width:'72%',duration:.45,ease:'power2.out'}); }
  else { bar.style.width='72%'; bar.style.opacity=1; }
}
function finishProg(){
  const bar = document.getElementById('navprog'); if(!bar) return;
  if(window.gsap && !navReduced()){ gsap.killTweensOf(bar); gsap.to(bar,{width:'100%',duration:.22,ease:'power2.in',onComplete:()=>gsap.to(bar,{opacity:0,duration:.3})}); }
  else { bar.style.width='100%'; bar.style.opacity=0; }
}
const NAV_ORDER = ['#/','#/orcamentos','#/novo','#/clientes','#/catalogo','#/agenda','#/relatorios','#/config'];
function orderIdx(h){ const i=NAV_ORDER.indexOf(h); if(i>=0) return i; if(String(h).startsWith('#/editar/')) return 1.5; return 99; }
function transitionTo(){
  if(window._navigating) return;
  const to = location.hash || '#/';
  const from = window._lastRoute || '#/';
  const inEd = h=>h.startsWith('#/novo')||h.startsWith('#/editar/');
  if(window._dirty && inEd(from) && from!==to && Draft && (String(Draft.client?.name||'').trim() || (Draft.items||[]).some(it=>String(it.desc||'').trim()||Number(it.unit)>0))){
    window._navigating = true; location.hash = from;
    confirmModal('Sair sem salvar?','Há alterações não salvas neste orçamento.').then(ok=>{
      window._navigating = false;
      if(ok){ window._dirty=false; Draft=null; if((location.hash||'#/')!==to) location.hash=to; else render(); }
    });
    return;
  }
  if(inEd(from) && from!==to && !window._dirty) Draft=null;
  const main = document.querySelector('main');
  navProgStart();
  const dir = orderIdx(to)>=orderIdx(from) ? 1 : -1;
  if(window.gsap && main && !navReduced()){
    gsap.to(main,{opacity:0,x:-18*dir,duration:.18,ease:'power2.in',overwrite:true,onComplete:()=>{ try{render();}catch(e){console.error(e);} }});
  } else { try{render();}catch(e){console.error(e);} }
}
window.addEventListener('hashchange', transitionTo);

const NAV_MAIN = [['#/','Início','⌂'],['#/orcamentos','Orçamentos','▤'],['#/novo','Novo orçamento','+']];
const NAV_MGMT = [['#/clientes','Clientes','○'],['#/catalogo','Catálogo','≡'],['#/agenda','Agenda','▦'],['#/relatorios','Relatórios','◫']];
const NAV_SYS = [['#/config','Configurações','◌']];
function navActive(h){ const r=currentRoute(); return (h!=='#/'&&r.startsWith(h))||(h==='#/'&&r==='#/'); }
window.toggleMobileNav = ()=>{
  const nav=document.getElementById('main-nav');
  const btn=document.getElementById('mobile-nav-toggle');
  if(!nav) return;
  const open=nav.classList.toggle('mobile-open');
  if(btn){ btn.setAttribute('aria-expanded',String(open)); btn.setAttribute('aria-label',open?'Fechar menu':'Abrir menu'); }
};
window.closeMobileNav = ()=>{
  const nav=document.getElementById('main-nav');
  const btn=document.getElementById('mobile-nav-toggle');
  if(nav) nav.classList.remove('mobile-open');
  if(btn){ btn.setAttribute('aria-expanded','false'); btn.setAttribute('aria-label','Abrir menu'); }
};
function shell(active, html){
  const st = Store.settings;
  const logo = esc(st.logoPath);
  const t = todayISO(), mk = t.slice(0,7);
  const nPend = (Store.budgets||[]).filter(b=>effStatus(b)==='pendente').length;
  const nToday = (Store.visits||[]).filter(v=>v.date===t&&v.status!=='concluída'&&v.status!=='cancelada').length;
  const badges = {'#/orcamentos':nPend,'#/agenda':nToday};
  const sysNav = window.MayaAuth?.isAdmin?.() ? [...NAV_SYS,['#/admin','Administração','⚙']] : NAV_SYS;
  const sideGroup = (t,arr)=>`<div class="side-group">${t}</div>`+arr.map(([h,l,i])=>`<a href="${h}" class="side-link${navActive(h)?' active':''}"><span class="ico">${i}</span>${l}${badges[h]?`<span class="side-badge">${badges[h]}</span>`:''}</a>`).join('');
  return `
  <div class="bg-fx" aria-hidden="true"><i></i><i></i><i></i></div>
  <aside class="side no-print">
    <div class="side-brand"><img src="${logo}" onerror="this.onerror=null;this.src='maya-garden-logo.jpg'" alt="MAYA"/><div><div class="font-black font-display" style="font-size:1.05rem">MAYA Garden</div><div style="font-size:.68rem;color:var(--muted)">Petrópolis • RJ</div></div></div>
    ${sideGroup('PRINCIPAL',NAV_MAIN)}${sideGroup('GESTÃO',NAV_MGMT)}${sideGroup('SISTEMA',sysNav)}
    <div class="side-foot"><div class="flex items-center gap-2"><span class="inline-block w-2 h-2 rounded-full" style="background:#4CAF50;box-shadow:0 0 8px #4CAF50"></span><b class="text-xs">Dados protegidos na nuvem</b></div><div class="mt-1">${esc(window.MayaAuth?.profile?.display_name||'Acesso autenticado')} • ${esc(window.MayaAuth?.roleLabel?.(window.MayaAuth?.role)||'usuário')}</div></div>
  </aside>
  <div class="with-side">
  <div class="maya-header no-print">
    <div class="max-w-6xl mx-auto px-4 py-4 flex items-center gap-3">
      <img src="${logo}" onerror="this.onerror=null;this.src='maya-garden-logo.jpg'" class="w-12 h-12 rounded-xl bg-white p-1 object-contain lg:hidden" alt="MAYA"/>
      <div class="flex-1">
       <div class="font-black text-xl leading-none font-display">MAYA Garden</div>
       <div class="text-xs opacity-90">Jardinagem • Orquídeas • Paisagismo — Petrópolis-RJ</div>
      </div>
      <button id="mobile-nav-toggle" class="mobile-menu-toggle" type="button" aria-expanded="false" aria-label="Abrir menu" onclick="toggleMobileNav()"><span aria-hidden="true">☰</span><span class="mobile-menu-label">Menu</span></button>
      <a href="#/novo" class="topbar-cta bg-white font-extrabold px-4 py-2 rounded-xl text-sm" style="color:#145214">+ Novo <span class="cta-sub">orçamento</span></a>
    </div>
    <nav id="main-nav" class="topnav max-w-6xl mx-auto px-4 pb-3 flex gap-1 flex-wrap text-sm" aria-label="Navegação principal">
      ${[...NAV_MAIN,...NAV_MGMT,...sysNav].map(([h,l])=>`<a href="${h}" onclick="closeMobileNav()" class="px-3 py-2 rounded-lg font-bold ${navActive(h)?'bg-white text-[#1A5D1A]':'text-white/90 hover:bg-white/15'}">${l}</a>`).join('')}
    </nav>
  </div>
  <main class="max-w-6xl mx-auto px-4 py-6">${html}</main>
  </div>
  <div id="drawer-root"></div><div id="modal-root"></div>`;
}

function renderAuthGate(){
  const app=document.getElementById('app'); if(!app) return;
  document.body.classList.add('maya-auth-only');
  app.innerHTML=window.CloudSync?.authGateHtml?window.CloudSync.authGateHtml():'<div class="maya-login-card"><h1>Conectando ao MAYA Garden…</h1></div>';
}
function enforceRoleUi(){
  document.body.classList.remove('maya-auth-only');
  const readOnly=window.MayaAuth && !window.MayaAuth.canWrite();
  document.body.classList.toggle('maya-readonly',!!readOnly);
  if(!readOnly) return;
  document.querySelectorAll('main button:not(.maya-session-action), main textarea, main input:not([type="search"]):not([type="date"]), main select').forEach(el=>{ el.disabled=true; el.title='Acesso somente para visualização'; });
}
function render(){
  if(!window.MayaAuth?.authenticated){ renderAuthGate(); return; }
  if(window.stripMayaDemo && window.MayaAuth.canWrite() && window.stripMayaDemo()){
    window.CloudSync?.flushPush?.();
  }
  const r = currentRoute();
  let html='';
  if(r==='#/'||r==='' ) html = dashProHTML();
  else if(r.startsWith('#/novo')){ if(!Draft){ Draft = normItems(blankBudget()); } window._dirty=false; html = viewEditor(false); }
  else if(r.startsWith('#/editar/')){ const id=r.split('/')[2]; const b=(Store.budgets||[]).find(x=>x.id===id); if(!b){ location.hash='#/orcamentos'; return; } Draft = normItems(structuredClone(b)); window._dirty=false; html = viewEditor(true); }
  else if(r.startsWith('#/orcamentos')) html = viewList();
  else if(r.startsWith('#/os')){ location.hash='#/'; return; }
  else if(r.startsWith('#/recorrentes')){ location.hash='#/'; return; }
  else if(r.startsWith('#/relatorios')) html = viewReports();
  else if(r.startsWith('#/admin')) html = viewAdmin();
  else if(r.startsWith('#/clientes')) html = clientsProHTML(window._cliQ||'');
  else if(r.startsWith('#/catalogo')) html = viewCatalog();
  else if(r.startsWith('#/agenda')) html = agendaProHTML();
  else if(r.startsWith('#/config')) html = viewConfig();
  else html = dashProHTML();
  $('#app').innerHTML = shell(r, html);
  window._lastRoute = r;
  afterRender(r);
  enforceRoleUi();
  animateIn();
  finishProg();
  if(!window.__booted){ window.__booted=true; sidebarIntro(); }
}
function sidebarIntro(){
  if(!window.gsap || navReduced()) return;
  gsap.from('.side-brand',{x:-18,opacity:0,duration:.5,ease:'power3.out'});
  gsap.from('.side-link',{x:-16,opacity:0,duration:.4,stagger:.05,ease:'power3.out',delay:.08,clearProps:'transform'});
  gsap.from('.side-foot',{opacity:0,duration:.6,delay:.5});
}

/* ---------- Dashboard ---------- */
function viewDashboardLegacy(){
  const budgets = Store.budgets||[];
  const month = new Date().toISOString().slice(0,7);
  const m = budgets.filter(b=>(b.date||'').startsWith(month));
  const tot = m.reduce((s,b)=>s+Number(b.total||0),0);
  const pend = budgets.filter(b=>b.status==='pendente').length;
  const apr = budgets.filter(b=>b.status==='aprovado').length;
  const ticket = m.length? tot/m.length : 0;
  const recent = [...budgets].sort((a,b)=>String(b.createdAt).localeCompare(String(a.createdAt))).slice(0,5);
  return `
  <div class="grid md:grid-cols-4 gap-3">
    ${[['Faturado no mês','kpi-tot',tot],['Pendentes','kpi-pend',pend],['Aprovados','kpi-apr',apr],['Ticket médio','kpi-tick',ticket]].map(([l,id,v],i)=>`
      <div class="maya-card p-4 anim-in"><div class="text-xs font-bold text-gray-500">${l}</div>
      <div class="kpi-num" id="${id}">${typeof v==='number'&&id!=='kpi-pend'&&id!=='kpi-apr'?brl(v):v}</div></div>`).join('')}
  </div>
  <div class="grid md:grid-cols-3 gap-3 mt-4">
    <a href="#/novo" class="maya-card p-5 anim-in hover:-translate-y-0.5 transition"><div class="text-2xl">+</div><div class="font-extrabold">Novo orçamento</div><div class="text-sm text-gray-600">Cliente + itens livres + dica de preço + PDF com marca d'água</div></a>
    <a href="#/catalogo" class="maya-card p-5 anim-in hover:-translate-y-0.5 transition"><div class="text-2xl">≡</div><div class="font-extrabold">Catálogo editável</div><div class="text-sm text-gray-600">Troque nomes, unidades e preços. Vale para os próximos.</div></a>
    <a href="#/config" class="maya-card p-5 anim-in hover:-translate-y-0.5 transition"><div class="text-2xl">○</div><div class="font-extrabold">Empresa + watermark</div><div class="text-sm text-gray-600">Logo, Pix, validade, opacidade da marca d'água.</div></a>
  </div>
  <div class="maya-card p-4 mt-4 anim-in">
    <div class="flex items-center justify-between mb-2"><h2 class="font-extrabold">Últimos orçamentos</h2><a href="#/orcamentos" class="text-sm font-bold text-[#1A5D1A]">ver todos →</a></div>
    ${recent.length? `<div class="overflow-x-auto"><table class="table-maya"><tr><th>Nº</th><th>Cliente</th><th>Total</th><th>Status</th><th></th></tr>${recent.map(b=>`<tr><td class="font-bold">${esc(b.number)}</td><td>${esc(b.client?.name)}</td><td>${brl(b.total)}</td><td><span class="maya-badge b-${b.status}">${b.status}</span></td><td><a class="font-bold text-[#1A5D1A]" href="#/editar/${b.id}">abrir</a></td></tr>`).join('')}</table></div>`:'<p class="text-sm text-gray-600">Nenhum ainda. Clique em Novo orçamento.</p>'}
  </div>`;
}
function afterRender(r){
  watchKeyboard();
  if(r==='#/'||r===''){ sweepExpired(); if(window.dashAfter) dashAfter(); }
  if(r.startsWith('#/novo')||r.startsWith('#/editar')){ recalcDraft(); window.__lastTot = Draft.total; paintEditorTotals(); paintPreview(); applyWmVars(); paintPaid(); toggleParcels(); applyQuoteMode(); }
  if(r.startsWith('#/orcamentos') && window.renderList){ try{ renderList(); }catch(e){ console.warn(e); } }
  if(r.startsWith('#/relatorios') && window.repAfter){ try{ repAfter(); }catch(e){} }
}
function watchKeyboard(){
  if(window._kbWatch) return;
  window._kbWatch=1;
  const apply=()=>{
    try{
      const vv=window.visualViewport;
      const covered = vv ? (window.innerHeight - vv.height) > 90 : false;
      document.body.classList.toggle('kb-open', covered);
    }catch(e){}
  };
  try{
    window.visualViewport?.addEventListener('resize', apply);
    window.visualViewport?.addEventListener('scroll', apply);
  }catch(e){}
  window.addEventListener('focusin', apply);
  window.addEventListener('focusout', ()=>setTimeout(apply, 120));
}

function m2Services(){
  const p = Store.pricing||{};
  return [
    {k:'proj', t:'Projeto paisagístico', rate:Number(p.projetoM2Ideal||40)},
    {k:'impl', t:'Implantação de jardim', rate:Number(p.m2ImplIdeal||180)}
  ];
}
window.applyM2 = function(){
  if(!Draft) return;
  const tipo = ($('#f-m2tipo')||{}).value;
  const area = numBR(($('#f-m2area')||{}).value);
  const svc = m2Services().find(x=>x.k===tipo) || m2Services()[0];
  if(!(area>0)){ toast('Informe a área em m²'); $('#f-m2area')?.focus(); return; }
  const val = Math.round(area * Number(svc.rate) * 100)/100;
  Draft.serviceValue = val;
  const inp = $('#f-servicevalue'); if(inp) inp.value = val;
  const line = svc.t+' — '+area+' m² × '+brl(svc.rate)+'/m²';
  const tx = $('#f-servicetext');
  if(tx){
    const cur = String(tx.value||'').trim();
    tx.value = cur ? cur+'\n'+line : line;
    Draft.serviceText = tx.value;
  }
  window._dirty = true;
  recalcDraft(); paintEditorTotalsOnly(); paintPreviewOnly();
  toast(area+' m² × '+brl(svc.rate)+' = '+brl(val));
};
window.hintM2 = function(){
  const tipo = ($('#f-m2tipo')||{}).value;
  const svc = m2Services().find(x=>x.k===tipo);
  const h = $('#m2-hint'); if(h && svc) h.textContent = svc.t+': '+brl(svc.rate)+' por m²';
};

/* ---------- Editor ---------- */
function statusOpts(s){ return ['pendente','aprovado','recusado','expirado'].map(o=>`<option ${s===o?'selected':''}>${o}</option>`).join(''); }

function viewEditor(isEdit){
  const d = Draft; const st = Store.settings;
  return `
  <div class="budget-editor">
  <div class="budget-editor-top flex items-center gap-2 mb-3 flex-wrap anim-in">
    <h1 class="text-2xl font-black">${isEdit?'Editar':'Novo'} orçamento <span class="text-[#1A5D1A]">Nº ${esc(d.number)}</span></h1>
    <span class="maya-badge b-${d.status}">${d.status}</span>
    <div class="flex-1"></div>
    <div class="budget-editor-actions">
      <button class="maya-btn-ghost" onclick="location.hash='#/orcamentos'">← Voltar</button>
      <button class="maya-btn" onclick="saveDraft(${isEdit})">Salvar</button>
      <button class="maya-btn-ghost" onclick="doPDF()">Baixar PDF</button>
    </div>
  </div>

  <div class="grid lg:grid-cols-2 gap-3">
    <div class="maya-card p-4 anim-in">
      <h2 class="font-extrabold mb-2">1. Cliente <span class="text-xs font-normal text-gray-500">(tudo editável)</span></h2>
      <div class="grid grid-cols-2 gap-2">
        <input class="maya-input col-span-2" placeholder="Nome do cliente *" id="f-name" value="${esc(d.client.name)}">
        <input class="maya-input" placeholder="WhatsApp (ex: 24992628213)" id="f-phone" value="${esc(d.client.phone)}">
        <input class="maya-input" placeholder="Endereço Petrópolis-RJ" id="f-addr" value="${esc(d.client.address)}">
      </div>
      <div class="mt-2 flex gap-2 flex-wrap">
        <select id="f-clientpick" class="maya-select" onchange="pickClient(this.value)"><option value="">Puxar cliente salvo…</option>${(Store.clients||[]).map(c=>`<option value="${c.id}">${esc(c.name)} — ${esc(c.phone||'')}</option>`).join('')}</select>
        <button class="maya-btn-ghost text-sm" onclick="saveClientFromDraft()">+ salvar cliente</button>
      </div>
    </div>

    <div class="maya-card p-4 anim-in" id="quote-mode-card">
      <div class="quote-mode" role="tablist" aria-label="Modo do orçamento">
        <button type="button" class="quote-mode-btn ${(d.quoteMode||'livre')==='livre'?'on':''}" data-mode="livre" onclick="setQuoteMode('livre')">Só texto</button>
        <button type="button" class="quote-mode-btn ${d.quoteMode==='itens'?'on':''}" data-mode="itens" onclick="setQuoteMode('itens')">Itens / catálogo</button>
      </div>

      <div id="livre-panel" ${(d.quoteMode||'livre')==='itens'?'hidden':''}>
        <h2 class="font-extrabold mb-1 mt-3">2. Descreva o serviço</h2>
        <p class="text-xs mb-2" style="color:var(--muted)">Escreva tudo do orçamento aqui. Sem catálogo, sem pacote. Esse texto sai no PDF.</p>
        <textarea id="f-servicetext" class="maya-textarea free-scope" rows="10" placeholder="Ex: Limpeza completa do jardim, poda das cercas-vivas, capina dos canteiros, adubação e varrição. Material incluso. Execução em 1 dia.">${esc(d.serviceText||'')}</textarea>
        <label class="text-xs font-bold block mt-2">Valor do serviço R$<input type="text" inputmode="decimal" enterkeyhint="done" id="f-servicevalue" class="maya-input" value="${esc(d.serviceValue||0)}" placeholder="0"></label>
        <div class="m2-box mt-3">
          <div class="text-xs font-extrabold mb-1">Paisagismo por m²</div>
          <p class="text-xs mb-2" style="color:var(--muted)">Só projeto e implantação. Grama e manutenção ficam no valor do serviço.</p>
          <select id="f-m2tipo" class="maya-select mb-2" onchange="hintM2()">${m2Services().map(s=>`<option value="${s.k}">${esc(s.t)} — ${brl(s.rate)}/m²</option>`).join('')}</select>
          <div class="grid grid-cols-2 gap-2">
            <input type="text" inputmode="decimal" enterkeyhint="done" id="f-m2area" class="maya-input" placeholder="Área em m²" onkeydown="if(event.key==='Enter'){event.preventDefault();applyM2()}">
            <button type="button" class="maya-btn" onclick="applyM2()">Aplicar</button>
          </div>
          <div class="text-xs mt-1" id="m2-hint" style="color:var(--muted)">${esc(m2Services()[0].t)}: ${brl(m2Services()[0].rate)} por m²</div>
        </div>
        <button class="maya-btn-ghost text-sm w-full mt-2" onclick="openCalc(null)">Quanto cobrar?</button>
        <div id="tip-last" class="text-xs mt-1" style="color:var(--muted)"></div>
      </div>

      <div id="items-panel" ${(d.quoteMode||'livre')==='livre'?'hidden':''}>
        <div class="budget-items-head mb-3 mt-3"><h2 class="font-extrabold">2. Itens</h2>
          <div class="budget-items-actions" role="group" aria-label="Adicionar itens ao orçamento">
            <button class="maya-btn-ghost text-sm" onclick="openPackPick()">Pacote</button>
            <button class="maya-btn-ghost text-sm" onclick="openCatalogPick()">+ do catálogo</button>
            <button class="maya-btn text-sm" onclick="addItem()">+ item livre</button>
          </div>
        </div>
        <div id="items"></div>
      </div>

      <div class="mt-3 text-right">
        <div class="text-xl font-black text-[#1A5D1A]">Total: <span id="t-tot">—</span></div>
        <div class="text-xs" id="t-subline" style="color:var(--muted)"></div>
        <div class="text-xs" id="t-signal" style="color:var(--muted)"></div>
        <div class="text-xs font-bold" id="t-alert"></div>
        <div class="hidden"><b id="t-sub"></b><b id="t-desc"></b></div>
      </div>

      <details class="more-opts mt-3" ${isEdit && (Number(d.signalPct)>0 || Number(d.discount)>0 || Number(d.displacement)>0 || (d.paid&&d.paid.entries&&d.paid.entries.length) || String(d.notes||'').trim() || (d.payMethod&&d.payMethod!=='Pix')) ? 'open' : ''}>
        <summary>Mais opções</summary>
        <div class="grid grid-cols-3 gap-2 mt-3 text-sm">
          <label class="font-bold">Emissão<input type="date" id="f-date" class="maya-input" value="${esc(d.date)}"></label>
          <label class="font-bold">Validade<input type="date" id="f-valid" class="maya-input" value="${esc(d.validity)}"></label>
          <label class="font-bold">Status<select id="f-status" class="maya-select">${statusOpts(d.status)}</select></label>
        </div>
        <div class="grid grid-cols-2 gap-2 mt-2 text-sm">
          <label class="font-bold">Pagamento<select id="f-paymethod" class="maya-select" onchange="toggleParcels()">${['Pix','Dinheiro','Cartão de crédito','Cartão de débito','Transferência','Boleto'].concat((d.payMethod&&!['Pix','Dinheiro','Cartão de crédito','Cartão de débito','Transferência','Boleto'].includes(d.payMethod))?[d.payMethod]:[]).map(m=>`<option ${d.payMethod===m||(!d.payMethod&&d.payment===m)?'selected':''}>${m}</option>`).join('')}</select></label>
          <label class="font-bold" id="f-parcelsbox">Parcelas (crédito)<input type="number" id="f-parcels" min="1" max="21" class="maya-input" value="${esc(d.payParcels||1)}"></label>
        </div>
        <div class="text-xs mt-1 font-bold" id="t-parcinfo" style="color:var(--maya-accent)"></div>
        <div class="grid grid-cols-2 gap-2 mt-2 text-sm">
          <label class="font-bold">Sinal %<input type="text" inputmode="decimal" enterkeyhint="done" id="f-signal" class="maya-input" value="${esc(d.signalPct||0)}" placeholder="0"></label>
          <label class="font-bold">Deslocamento R$<input type="text" inputmode="decimal" enterkeyhint="done" id="f-desloc" class="maya-input" value="${esc(d.displacement||0)}" placeholder="0"></label>
        </div>
        <div class="grid grid-cols-2 gap-2 mt-2 text-sm">
          <label class="font-bold">Desconto<input type="text" inputmode="decimal" enterkeyhint="done" id="f-desc" class="maya-input" value="${esc(d.discount)}"></label>
          <label class="font-bold">Tipo<select id="f-desct" class="maya-select"><option value="pct" ${d.discountType==='pct'?'selected':''}>% porc.</option><option value="vlr" ${d.discountType==='vlr'?'selected':''}>R$ valor</option></select></label>
        </div>
        <label class="text-xs font-bold block mt-2">Observações internas<textarea id="f-notes" class="maya-textarea" rows="2" placeholder="Só para vocês. Não sai no PDF.">${esc(d.notes)}</textarea></label>
        <div class="mt-3 pt-2" style="border-top:1px solid var(--line)">
          <div class="flex items-center gap-2 mb-1"><b>Recebimentos</b><div class="flex-1"></div>
          <button class="maya-btn text-xs" onclick="addPayment()">+ Registrar</button></div>
          <div id="paidbox"></div>
        </div>
      </details>
    </div>
  </div>

  <div class="mt-3 anim-in">
    <button type="button" class="maya-btn-ghost w-full preview-toggle" id="preview-toggle" onclick="togglePreview()">Ver prévia do PDF</button>
    <div id="preview-wrap" hidden>
      <h2 class="font-extrabold mb-2 mt-2">Prévia do PDF</h2>
      <div id="print-area"><div class="budget-paper" id="paper"><div class="budget-inner p-5" id="preview"></div></div></div>
      <div class="flex gap-2 mt-2 flex-wrap no-print">
        <button class="maya-btn-ghost" onclick="copyZap()">Copiar msg</button>
        <button class="maya-btn-ghost" onclick="openZapDraft()">Abrir WhatsApp</button>
      </div>
    </div>
  </div>
  <div class="editor-sticky no-print">
    <button class="maya-btn" onclick="saveDraft(${isEdit})">Salvar</button>
    <button class="maya-btn-ghost" onclick="doPDF()">Baixar PDF</button>
  </div>
  </div>`;
}

function itemRow(it, i){
  return `<div class="border rounded-xl p-2 mb-2 bg-[#fbfdf6]" data-row="${i}">
    <input class="maya-input mb-1" placeholder="Descrição do serviço *" value="${esc(it.desc)}" oninput="editItem(${i},'desc',this.value)">
    <div class="grid grid-cols-2 md:grid-cols-4 gap-1">
      <label class="text-[11px] font-bold">Qtd<input type="text" inputmode="decimal" enterkeyhint="done" class="maya-input" value="${esc(it.qty)}" oninput="editItem(${i},'qty',this.value)"></label>
      <label class="text-[11px] font-bold">Und<input class="maya-input" value="${esc(it.unitLabel||it.unit||'un')}" oninput="editItem(${i},'unitLabel',this.value)" placeholder="m²/hora/un"></label>
      <label class="text-[11px] font-bold">Valor unit R$<input type="text" inputmode="decimal" enterkeyhint="done" class="maya-input" value="${esc(it.unit)}" oninput="editItem(${i},'unit',this.value)"></label>
      <div class="flex items-end gap-1">
        <button class="maya-btn-ghost text-xs px-2 py-2" title="Dica de preço p/ este item" aria-label="Dica de preço para este item" onclick="openCalc(${i})">Dica</button>
        <button class="maya-btn-ghost text-xs px-2 py-2" title="Remover" aria-label="Remover item" onclick="delItem(${i})">Excluir</button>
      </div>
    </div>
    <div class="text-right text-sm font-bold mt-1">Sub: <span class="row-sub">${brl((Number(it.qty)||0)*(Number(it.unit)||0))}</span></div>
  </div>`;
}
function paintItems(){
  const box = $('#items'); if(!box||!Draft) return;
  box.innerHTML = (Draft.items||[]).map(itemRow).join('') || '<p class="text-sm text-gray-500">Sem itens. Adicione.</p>';
}
function applyQuoteMode(){
  if(!Draft) return;
  const livre = (Draft.quoteMode||'livre')==='livre';
  const lp = document.getElementById('livre-panel');
  const ip = document.getElementById('items-panel');
  if(lp) lp.hidden = !livre;
  if(ip) ip.hidden = livre;
  document.querySelectorAll('.quote-mode-btn').forEach(function(b){
    const on = b.getAttribute('data-mode') === (livre?'livre':'itens');
    b.classList.toggle('on', on);
    b.setAttribute('aria-selected', on ? 'true' : 'false');
  });
}
window.setQuoteMode = function(m){
  if(!Draft) return;
  collectSilent();
  Draft.quoteMode = m==='itens' ? 'itens' : 'livre';
  window._dirty = true;
  applyQuoteMode();
  if(Draft.quoteMode==='itens') paintItems();
  recalcDraft();
  paintEditorTotalsOnly();
  paintPreviewOnly();
};
window.editItem = (i,f,v)=>{
  if(!Draft?.items[i]) return;
  if(f==='qty'||f==='unit') v=numBR(v);
  Draft.items[i][f]=v; window._dirty=true;
  recalcDraft(); paintEditorTotalsOnly(); paintPreviewOnly();
  // atualiza subtotal da linha sem re-renderizar (não perde foco)
  const row = document.querySelector(`[data-row="${i}"] .row-sub`);
  if(row){ const it=Draft.items[i]; row.textContent = brl((Number(it.qty)||0)*(Number(it.unit)||0)); }
};
window.addItem = ()=>{ Draft.items.push({desc:'',qty:1,unitLabel:'un',unit:0}); window._dirty=true; recalcDraft(); paintItems(); paintEditorTotalsOnly(); paintPreviewOnly(); };

window.togglePreview = function(){
  const box = document.getElementById('preview-wrap');
  if(!box) return;
  const show = box.hasAttribute('hidden');
  if(show){ box.removeAttribute('hidden'); applyWmVars(); paintPreviewOnly(); }
  else box.setAttribute('hidden','');
  const btn = document.getElementById('preview-toggle');
  if(btn) btn.textContent = show ? 'Ocultar prévia' : 'Ver prévia do PDF';
};

/* ---------- recebimentos ---------- */
function paidInfo(){ recalcDraft(); const t=paidTotal(Draft), tot=Number(Draft.total)||0, rem=Math.max(0,tot-t);
  const st = tot<=0?'aberto':(rem<=0.009?'pago':(t>0?'parcial':'aberto'));
  return {t,tot,rem,pct:tot>0?Math.min(100,100*t/tot):0,st}; }
function paintPaid(){ const box=document.querySelector('#paidbox'); if(!box||!Draft) return; const p=paidInfo();
  const badge = p.st==='pago'?'<span class="maya-badge b-aprovado">pago</span>':p.st==='parcial'?'<span class="maya-badge b-pendente">parcial</span>':'<span class="maya-badge b-expirado">em aberto</span>';
  box.innerHTML = `<div class="flex items-center gap-2 text-sm mb-1"><b>${brl(p.t)}</b><span style="color:var(--muted)">de ${brl(p.tot)}</span><div class="flex-1"></div>${badge}</div>
  <div class="p-track mb-2"><div class="p-bar" style="width:${p.pct.toFixed(0)}%"></div></div>
  ${(Draft.paid.entries||[]).map((e,i)=>`<div class="flex items-center gap-2 text-sm border-b py-1" style="border-color:var(--line)"><div class="flex-1">${fmtD(e.date)} • ${esc(e.method||'')}</div><b>${brl(e.value)}</b><button class="maya-btn-ghost text-xs px-2 py-1" onclick="reciboEntry(${i})">Recibo</button><button class="maya-btn-ghost text-xs px-2 py-1" onclick="delPayment(${i})">×</button></div>`).join('')||'<p class="text-xs mb-1" style="color:var(--muted)">Nenhum recebimento lançado.</p>'}
  ${p.rem>0.009&&p.tot>0?`<button class="maya-btn-ghost text-xs mt-1" onclick="payFull()">Quitar ${brl(p.rem)}</button>`:''}`; }
window.addPayment=()=>{ recalcDraft();
  openModal('Registrar recebimento', MF.num('pm-value','Valor R$ *',paidRemaining(Draft).toFixed(2))+`<div class="f-row2">`+MF.date('pm-date','Data',todayISO())+MF.sel('pm-method','Forma',[['Pix','Pix'],['Dinheiro','Dinheiro'],['Cartão','Cartão'],['Transferência','Transferência'],['Boleto','Boleto']],'Pix')+`</div>`, ()=>{
    const v=numBR(mv('pm-value')); if(v<=0) return 'Informe um valor maior que zero.';
    Draft.paid.entries.push({id:Store.uid(),date:mv('pm-date')||todayISO(),value:v,method:mv('pm-method')}); window._dirty=true; paintPaid(); toast('Recebimento registrado!'); return true; }); };
window.payFull=()=>{ const r=paidRemaining(Draft); if(r<=0) return; Draft.paid.entries.push({id:Store.uid(),date:todayISO(),value:Math.round(r*100)/100,method:Draft.payMethod||Draft.payment||'Pix'}); window._dirty=true; paintPaid(); };
window.delPayment=i=>{ Draft.paid.entries.splice(i,1); window._dirty=true; paintPaid(); };
window.reciboEntry=async i=>{ collectSilent(); recalcDraft(); const e=Draft.paid.entries[i]; if(!e) return; toast('Gerando recibo…'); await gerarRecibo(Draft, e.id); };
window.delItem = i=>{ Draft.items.splice(i,1); if(!Draft.items.length) Draft.items.push({desc:'',qty:1,unitLabel:'un',unit:0}); window._dirty=true; recalcDraft(); paintItems(); paintEditorTotalsOnly(); paintPreviewOnly(); };

function collectEditor(){
  Draft.client.name = $('#f-name').value.trim();
  Draft.client.phone = $('#f-phone').value.trim();
  Draft.client.address = $('#f-addr').value.trim();
  Draft.date = $('#f-date').value || todayISO();
  Draft.validity = $('#f-valid').value || addDays(Draft.date, Store.settings.validityDays);
  Draft.status = $('#f-status').value;
  Draft.payMethod = $('#f-paymethod').value;
  Draft.payParcels = Math.min(21, Math.max(1, numBR($('#f-parcels').value)||1));
  Draft.payment = Draft.payMethod;
  Draft.signalPct = numBR($('#f-signal').value);
  Draft.notes = $('#f-notes').value;
  Draft.serviceText = ($('#f-servicetext')||{}).value || '';
  Draft.serviceValue = numBR(($('#f-servicevalue')||{}).value);
  Draft.discount = numBR($('#f-desc').value);
  Draft.discountType = $('#f-desct').value;
  Draft.displacement = numBR($('#f-desloc').value);
  recalcDraft();
}
function paintEditorTotalsOnly(){
  if(!Draft) return;
  const set = (id,v)=>{ const e=$(id); if(e) e.textContent=v; };
  set('#t-sub', brl(Draft.subtotal)); set('#t-desc','-'+brl(Draft.discountVal)); set('#t-tot', brl(Draft.total));
  if(window.__lastTot!==undefined && window.__lastTot!==Draft.total && window.gsap && !navReduced()){ const tt=$('#t-tot'); if(tt) gsap.fromTo(tt,{scale:1.14},{scale:1,duration:.28,ease:'back.out(2)',clearProps:'transform'}); }
  window.__lastTot = Draft.total;
  const tot = Number(Draft.total)||0, sp = Number(Draft.signalPct)||0;
  const bits=[];
  if(Number(Draft.subtotal)>0) bits.push('Serviço '+brl(Draft.subtotal));
  if(Number(Draft.discountVal)>0) bits.push('desc. -'+brl(Draft.discountVal));
  if(Number(Draft.displacement)>0) bits.push('desloc. '+brl(Draft.displacement));
  const sl=$('#t-subline'); if(sl) sl.textContent = bits.join(' • ');
  const e=$('#t-signal'); if(e) e.textContent = sp? `Sinal ${sp}%: ${brl(tot*sp/100)} • Restante: ${brl(tot*(1-sp/100))}` : '';
  const pi=$('#t-parcinfo'); if(pi){ const n=Math.min(21,Math.max(1,Number(Draft.payParcels)||1));
    pi.textContent = (/crédito/i.test(Draft.payMethod||'')&&n>1&&tot>0) ? `${n}x de ${brl(tot/n)} no cartão` : ''; }
  const al=$('#t-alert'); if(al){ al.textContent=''; }
}
function paintEditorTotals(){
  if(!Draft) return; collectSilent();
  recalcDraft(); paintEditorTotalsOnly();
}
function collectSilent(){
  if(!Draft||!$('#f-name')) return;
  try{
    Draft.client.name=$('#f-name').value; Draft.client.phone=$('#f-phone').value; Draft.client.address=$('#f-addr').value;
    Draft.date=$('#f-date').value; Draft.validity=$('#f-valid').value; Draft.status=$('#f-status').value;
    Draft.payMethod=$('#f-paymethod').value; Draft.payParcels=Math.min(21,Math.max(1,numBR($('#f-parcels').value)||1)); Draft.payment=Draft.payMethod;
    Draft.signalPct=numBR($('#f-signal').value); Draft.notes=$('#f-notes').value;
    if($('#f-servicetext')) Draft.serviceText=$('#f-servicetext').value;
    if($('#f-servicevalue')) Draft.serviceValue=numBR($('#f-servicevalue').value);
    Draft.discount=numBR($('#f-desc').value); Draft.discountType=$('#f-desct').value; Draft.displacement=numBR($('#f-desloc').value);
  }catch{}
}
['f-name','f-phone','f-addr','f-date','f-valid','f-status','f-paymethod','f-parcels','f-signal','f-notes','f-desc','f-desct','f-desloc'].forEach(()=>{});
document.addEventListener('input', e=>{ if(e.target && /^(f-)/.test(e.target.id||'')){ window._dirty=true; recalcDraftSilent(); } });
document.addEventListener('focusout', e=>{
  const id=(e.target&&e.target.id)||'';
  if(id==='f-phone'||id==='mc-phone'||id==='co-phone'){
    const d=String(e.target.value||'').replace(/\D/g,'');
    if(d.length===11) e.target.value=`(${d.slice(0,2)}) ${d.slice(2,7)}-${d.slice(7)}`;
    else if(d.length===10) e.target.value=`(${d.slice(0,2)}) ${d.slice(2,6)}-${d.slice(6)}`;
  }
});
function recalcDraftSilent(){ if(!Draft||!$('#t-tot')) return; collectSilent(); recalcDraft(); paintEditorTotalsOnly(); paintPreviewOnly(); }

function applyWmVars(){
  const st = Store.settings;
  const paper = $('#paper'); if(!paper) return;
  const logo = st.logoPath;
  paper.style.setProperty('--wm-url', st.wmEnabled? `url("${logo}")` : 'none');
  paper.style.setProperty('--wm-opacity', String(st.wmEnabled? Number(st.wmOpacity??.09):0));
}
function paintPreviewOnly(){
  const box = $('#preview'); if(!box||!Draft) return;
  const st = Store.settings;
  box.innerHTML = `
    <div class="pp-ribbon">PROPOSTA COMERCIAL</div>
    <div class="pp-head">
      <img src="${esc(st.logoPath)}" onerror="this.onerror=null;this.src='maya-garden-logo.jpg'" class="pp-logo" alt="MAYA"/>
      <div class="flex-1"><div class="pp-co">${esc(st.company)}</div>
      <div class="pp-tag">${esc(st.tagline)}</div>
      <div class="pp-tag" style="color:#666">${esc(st.address)} • Whats ${esc(st.whatsappDisplay)} • ${esc(st.instagram)}</div></div>
      <div class="pp-meta"><div class="pp-num">Nº ${esc(Draft.number)}</div><div>Emissão ${fmtDate(Draft.date)}</div><div>Válida até ${fmtDate(Draft.validity)}</div><div style="margin-top:2px"><b>${esc(Draft.status.toUpperCase())}</b></div></div>
    </div>
    <div class="pp-client"><b>Cliente:</b> ${esc(Draft.client.name||'-')} &nbsp;•&nbsp; ${esc(Draft.client.phone||'-')} &nbsp;•&nbsp; ${esc(Draft.client.address||'-')}</div>
    ${String(Draft.serviceText||'').trim()?`<div class="text-sm mt-2" style="white-space:pre-wrap;color:#222"><b>Escopo do serviço</b><br>${esc(Draft.serviceText)}</div>`:''}
    ${(Draft.quoteMode||'livre')!=='livre' && (Draft.items||[]).some(it=>String(it.desc||'').trim()||Number(it.unit)>0)?`<table class="table-maya"><tr><th>Descrição</th><th>Qtd</th><th>Unit</th><th>Total</th></tr>
    ${(Draft.items||[]).filter(it=>String(it.desc||'').trim()||Number(it.unit)>0).map(it=>`<tr><td>${esc(it.desc||'-')}</td><td>${esc(it.qty)} ${esc(it.unitLabel||'')}</td><td>${brl(it.unit)}</td><td class="font-bold">${brl((Number(it.qty)||0)*(Number(it.unit)||0))}</td></tr>`).join('')}</table>`:''}
    ${Number(Draft.displacement)>0?`<div class="text-xs mt-2 text-right" style="color:#555">Taxa de deslocamento: ${brl(Draft.displacement)}</div>`:''}
    <div class="pp-totalbox"><span class="text-sm" style="color:#1A5D1A">VALOR TOTAL&nbsp;&nbsp;</span><span class="pp-total">${brl(Draft.total)}</span></div>
    <div class="text-xs mt-1" style="color:#555">Pagamento: ${esc(payLabel(Draft))} ${Draft.signalPct?`• Sinal ${esc(Draft.signalPct)}% (${brl(Draft.total*Number(Draft.signalPct)/100)}) • Saldo na conclusão (${brl(Draft.total*(1-Number(Draft.signalPct)/100))})`:''}</div>
    <div class="text-xs mt-2" style="color:#777">${esc(st.headerText)} ${st.pix?`• Pix: ${esc(st.pix)}`:''}</div>`;
}
function paintPreview(){
  if(!Draft) return; collectSilent(); recalcDraft();
  paintPreviewOnly(); paintItems();
}

window.saveDraft = async (isEdit)=>{
  collectEditor();
  if(!Draft.client.name){ toast('Preencha o nome do cliente'); $('#f-name').focus(); return; }
  const hasItem = (Draft.items||[]).some(it=>String(it.desc||'').trim() && Number(it.unit)>0);
  const hasFree = String(Draft.serviceText||'').trim().length>0;
  if(!hasItem && !hasFree){ toast('Escreva a descrição do serviço ou adicione um item'); return; }
  if(!(Number(Draft.total)>0) && !hasItem){ toast('Informe o valor do serviço'); $('#f-servicevalue')?.focus(); return; }
  window._dirty=false;
  Draft.photos = [];
  Draft.updatedAt = new Date().toISOString();
  const all = (Store.budgets||[]).map(b=>({...b, photos:[]}));
  const ix = all.findIndex(b=>b.id===Draft.id);
  if(ix>=0) all[ix]=structuredClone(Draft); else all.push(structuredClone(Draft));
  try{ Store.budgets = all; }
  catch(e){ toast('Sem espaço no aparelho. Exclua orçamentos antigos e tente de novo.'); return; }
  // upsert cliente
  const cs = Store.clients||[];
  if(Draft.client.name && !cs.some(c=>c.name.toLowerCase()===Draft.client.name.toLowerCase())){ cs.push({id:Store.uid(),...Draft.client}); Store.clients=cs; }
  toast('Salvando no Supabase…');
  let cloudOk=true;
  try{
    if(window.CloudSync?.flushPush) cloudOk = await window.CloudSync.flushPush();
    else if(window.CloudSync?.pushLocal) cloudOk = await window.CloudSync.pushLocal(false,true);
  }catch(e){ cloudOk=false; }
  toast(cloudOk!==false ? 'Orçamento salvo no Supabase!' : 'Salvo neste aparelho. A nuvem não respondeu.');
  if(window.gsap) gsap.fromTo('.budget-paper',{scale:.99},{scale:1,duration:.3});
  location.hash = '#/orcamentos';
};
window.pickClient = id=>{ const c=(Store.clients||[]).find(x=>x.id===id); if(!c||!Draft) return; Draft.client={name:c.name,phone:c.phone||'',address:c.address||''}; $('#f-name').value=c.name; $('#f-phone').value=c.phone||''; $('#f-addr').value=c.address||''; paintPreview(); };
window.saveClientFromDraft = ()=>{ collectSilent(); if(!Draft.client.name) return toast('Nome vazio'); const cs=Store.clients||[]; cs.push({id:Store.uid(),...Draft.client}); Store.clients=cs; toast('Cliente salvo!'); };

window.doPDF = async ()=>{ collectSilent(); recalcDraft(); if(!Draft.client.name){ toast('Preencha cliente antes do PDF'); return; }
  const hasItem = (Draft.items||[]).some(it=>String(it.desc||'').trim());
  const hasFree = String(Draft.serviceText||'').trim().length>0;
  if(!hasItem && !hasFree){ toast('Escreva a descrição do serviço ou adicione um item'); return; }
  toast('Gerando PDF com marca d\'água…'); await gerarPDF(Draft); };
window.copyZap = ()=>{ collectSilent(); recalcDraft(); const t=zapFill(Draft); navigator.clipboard?.writeText(t).then(()=>toast('Mensagem copiada! Anexe o PDF no WhatsApp.')); };

/* ---------- drawer/modal ---------- */
function openDrawer(html){
  let root = document.getElementById('drawer-root');
  if(!root){ root=document.createElement('div'); root.id='drawer-root'; }
  // Keep fixed panels outside animated ancestors and visible without animation.
  document.body.appendChild(root);
  root.innerHTML = `<div class="modal-bg show" onclick="closeDrawer()"></div><div class="drawer p-4 overflow-y-auto" id="drawer" role="dialog" aria-modal="true" aria-label="Selecionar opções" tabindex="-1">${html}</div>`;
  root.querySelector('#drawer').focus({preventScroll:true});
}
window.closeDrawer = ()=>{
  document.getElementById('drawer-root')?.remove();
};

/* ---------- ripple + brilho que segue o mouse ---------- */
(function(){
  let fine=false; try{ fine = matchMedia('(pointer:fine)').matches && !matchMedia('(prefers-reduced-motion: reduce)').matches; }catch(e){}
  if(!fine) return;
  document.addEventListener('pointerdown', e=>{
    const b = e.target && e.target.closest ? e.target.closest('.maya-btn,.maya-btn-ghost,.stepper,.opt') : null;
    if(!b) return;
    const r=b.getBoundingClientRect(), s=Math.max(r.width,r.height)*1.1;
    const rip=document.createElement('span'); rip.className='ripple';
    rip.style.cssText=`width:${s}px;height:${s}px;left:${e.clientX-r.left-s/2}px;top:${e.clientY-r.top-s/2}px`;
    b.appendChild(rip); setTimeout(()=>rip.remove(),650);
  }, {passive:true});
  let raf=null;
  document.addEventListener('mousemove', e=>{
    if(raf) return;
    raf=requestAnimationFrame(()=>{ raf=null;
      const card = e.target && e.target.closest ? e.target.closest('.maya-card') : null;
      document.querySelectorAll('.maya-card.glow-on').forEach(c=>{ if(c!==card) c.classList.remove('glow-on'); });
      if(card){ const r=card.getBoundingClientRect();
        card.style.setProperty('--mx',(e.clientX-r.left)+'px'); card.style.setProperty('--my',(e.clientY-r.top)+'px');
        card.classList.add('glow-on'); }
    });
  }, {passive:true});
})();
/* ---------- modais elegantes (sem popups nativos) ---------- */
let __mRes = null;
function openModal(title, bodyHTML, onOk, okLabel){
  const root = document.querySelector('#modal-root');
  root.innerHTML = `<div class="modal-bg show" id="m-bg"></div><div class="m-modal" id="m-box" role="dialog" aria-modal="true" aria-label="${esc(title)}">
    <h3>${esc(title)}</h3><div class="m-body">${bodyHTML}</div><div class="m-err" id="m-err"></div>
    <div class="m-foot"><button class="maya-btn-ghost" id="m-cancel">Cancelar</button><button class="maya-btn" id="m-ok">${esc(okLabel||'Salvar')}</button></div></div>`;
  const done = v=>{ __mRes=null; const r=document.querySelector('#modal-root'); if(r) r.innerHTML=''; if(__mCb) { const cb=__mCb; __mCb=null; cb(v); } };
  window.__mClose = done;
  document.querySelector('#m-cancel').onclick = ()=>done(false);
  document.querySelector('#m-bg').onclick = ()=>done(false);
  document.querySelector('#m-ok').onclick = ()=>{
    const err = document.querySelector('#m-err');
    try{ const r = onOk();
      if(r===true) done(true);
      else if(typeof r==='string'){ err.textContent=r; err.classList.add('show'); }
    }catch(e){ err.textContent=String((e&&e.message)||e); err.classList.add('show'); }
  };
  if(window.gsap && !matchMedia('(prefers-reduced-motion: reduce)').matches){ gsap.fromTo('#m-box',{y:24,opacity:0,scale:.97},{y:0,opacity:1,scale:1,duration:.32,ease:'power3.out',clearProps:'transform'}); }
  const f = root.querySelector('input,select,textarea'); if(f) setTimeout(()=>f.focus(),60);
  return new Promise(res=>{ __mCb=res; });
}
let __mCb = null;
function closeModal(){ if(window.__mClose) window.__mClose(false); }
function confirmModal(title, msg, okLabel){
  return openModal(title, `<p class="text-sm" style="color:var(--muted)">${msg}</p>`, ()=>true, okLabel||'Excluir');
}
/* atalhos de campo p/ modais */
const MF = {
  text:(id,l,v,ph)=>`<label>${l}<input class="maya-input" id="${id}" value="${esc(v||'')}" placeholder="${esc(ph||'')}"></label>`,
  num:(id,l,v,step)=>`<label>${l}<input type="text" inputmode="decimal" enterkeyhint="done" class="maya-input" id="${id}" value="${esc(v??'')}"></label>`,
  date:(id,l,v)=>`<label>${l}<input type="date" class="maya-input" id="${id}" value="${esc(v||'')}"></label>`,
  time:(id,l,v)=>`<label>${l}<input type="time" class="maya-input" id="${id}" value="${esc(v||'')}"></label>`,
  area:(id,l,v,rows)=>`<label>${l}<textarea class="maya-textarea" rows="${rows||2}" id="${id}">${esc(v||'')}</textarea></label>`,
  sel:(id,l,opts,v)=>`<label>${l}<select class="maya-select" id="${id}">${opts.map(o=>{const val=Array.isArray(o)?o[0]:o, lab=Array.isArray(o)?o[1]:o;return `<option value="${esc(val)}" ${String(val)===String(v)?'selected':''}>${esc(lab)}</option>`;}).join('')}</select></label>`
};
const mv = id=>{ const e=document.getElementById(id); return e?e.value.trim():''; };
window.openCatalogPick = ()=>{
  const cats = [...new Set(Store.catalog.map(c=>c.cat))];
  openDrawer(`<h3 class="font-black text-lg mb-2">Puxar do catálogo (preço editável depois)</h3>
  ${cats.map(cat=>`<div class="drawer-section-title font-extrabold text-[#1A5D1A]">${esc(cat)}</div>${Store.catalog.filter(c=>c.cat===cat).map(c=>`<div class="drawer-list-row text-sm"><div><b>${esc(c.name)}</b><div class="text-xs text-gray-500">${esc(c.desc||'')} • ${brl(c.price)}/${esc(c.unit)}</div></div><button class="maya-btn text-xs" onclick="addFromCatalog('${c.id}')">+ add</button></div>`).join('')}`).join('')}
  <button class="maya-btn-ghost w-full mt-3" onclick="closeDrawer()">Fechar</button>`);
};
window.addFromCatalog = id=>{
  const c = Store.catalog.find(x=>x.id===id); if(!c) return;
  Draft.items.push({desc:`${c.name} — ${c.desc||''}`.slice(0,120), qty:1, unitLabel:c.unit, unit:Number(c.price)||0});
  window._dirty=true; closeDrawer(); recalcDraft(); paintItems(); paintEditorTotals(); paintPreview(); toast('Item adicionado (edite à vontade)');
};

/* calculadora + dica */
/* calculadora + dica — simples: 1 serviço, 2 tamanho, 3 padrão */
const CALC_OPTS = [
  {v:'manutencao', t:'Manutenção', s:'limpeza, grama, poda', tipo:'manutencao_m2', unit:'m²', def:50, freq:true},
  {v:'implantar', t:'Implantar jardim', s:'jardim novo completo', tipo:'implantacao_m2', unit:'m²', def:30},
  {v:'hora', t:'Por hora', s:'serviço avulso', tipo:'hora', unit:'horas', def:4},
  {v:'vasos', t:'Orquídeas', s:'replantio por vaso', tipo:'vaso', unit:'vasos', def:10},
  {v:'orquidario', t:'Orquidário', s:'projeto completo', tipo:'orquidario', unit:'', def:0},
  {v:'projeto', t:'Projeto', s:'paisagismo por m²', tipo:'projeto_m2', unit:'m²', def:50}
];
window.CalcTipo = 'implantar';
window.CalcNivel = 'essencial';
window.openCalc = (itemIndex)=>{
  CalcSel = (itemIndex===null||itemIndex===undefined)? null : Number(itemIndex);
  const st = Store.settings;
  if(!CALC_OPTS.some(o=>o.v===window.CalcTipo)) window.CalcTipo='implantar';
  if(!['essencial','padrao','premium'].includes(window.CalcNivel)) window.CalcNivel='essencial';
  openDrawer(`
  <h3 class="font-black text-lg">Quanto cobrar?</h3>
  <p class="text-xs mb-3" style="color:var(--muted)">3 toques e pronto. Base 2026 Petrópolis, tudo editável em Config.</p>
  <div class="text-xs font-extrabold mb-1" style="color:var(--muted)">1 • O SERVIÇO É…</div>
  <div class="opt-grid" id="c-opts">
    ${CALC_OPTS.map(o=>`<button class="opt" data-v="${o.v}" onclick="pickCalcTipo('${o.v}')">${o.t}<small>${o.s}</small></button>`).join('')}
  </div>
  <div id="c-sizebox" class="mt-3">
    <div class="text-xs font-extrabold mb-1" style="color:var(--muted)">2 • TAMANHO <span id="c-unit" class="font-normal"></span></div>
    <div class="calc-size-wrap">
      <button class="stepper" onclick="calcSize(-1)">−</button>
      <input type="text" inputmode="decimal" enterkeyhint="done" id="c-size" class="calc-size" value="50">
      <button class="stepper" onclick="calcSize(1)">+</button>
    </div>
    <div class="flex gap-1 mt-1">${[10,30,50,100,200].map(v=>`<button class="maya-btn-ghost text-xs px-2 py-1" onclick="document.getElementById('c-size').value=${v}">${v}</button>`).join('')}</div>
  </div>
  <div class="mt-3">
    <div class="text-xs font-extrabold mb-1" style="color:var(--muted)">3 • PADRÃO DO SERVIÇO</div>
    <div class="seg" id="c-nivel">
      <button data-v="essencial" onclick="pickCalcNivel('essencial')">Essencial</button>
      <button data-v="padrao" onclick="pickCalcNivel('padrao')">Padrão</button>
      <button data-v="premium" onclick="pickCalcNivel('premium')">Premium</button>
    </div>
  </div>
  <details class="calc-details">
    <summary>Extras (frequência, insumos, deslocamento)</summary>
    <div class="calc-details-body grid grid-cols-2 gap-2 text-sm">
      <label id="c-freqbox" class="font-bold col-span-2">Frequência<select id="c-freq" class="maya-select"><option value="mensal">mensal</option><option value="quinzenal">quinzenal</option><option value="semanal">semanal</option><option value="unica">única</option></select></label>
      <label class="font-bold">Insumos R$<input type="text" inputmode="decimal" enterkeyhint="done" id="c-ins" class="maya-input" value="80"></label>
      <label class="font-bold">Desloc. R$<input type="text" inputmode="decimal" enterkeyhint="done" id="c-des" class="maya-input" value="${esc(st.displacementDefault)}"></label>
    </div>
  </details>
  <button class="maya-btn w-full mt-3" style="font-size:1.05rem" onclick="calcNow()">Ver sugestão →</button>
  <div id="c-out" class="mt-3"></div>
  <button class="maya-btn-ghost w-full mt-2" onclick="closeDrawer()">Fechar</button>`);
  syncCalcUI();
};
function calcOpt(){ return CALC_OPTS.find(o=>o.v===window.CalcTipo) || CALC_OPTS[0]; }
function syncCalcUI(){
  $$('#c-opts .opt').forEach(b=>b.classList.toggle('opt-on', b.dataset.v===window.CalcTipo));
  $$('#c-nivel button').forEach(b=>b.classList.toggle('seg-on', b.dataset.v===window.CalcNivel));
  const o = calcOpt();
  const box = $('#c-sizebox'); if(box) box.style.display = o.unit ? '' : 'none';
  const u = $('#c-unit'); if(u) u.textContent = o.unit ? `(em ${o.unit})` : '';
  const inp = $('#c-size'); if(inp && o.unit) inp.value = o.def;
  const fq = $('#c-freqbox'); if(fq) fq.style.display = o.freq ? '' : 'none';
}
window.pickCalcTipo = v=>{ window.CalcTipo=v; syncCalcUI(); const o=$('#c-out'); if(o) o.innerHTML=''; };
window.pickCalcNivel = v=>{ window.CalcNivel=v; syncCalcUI(); const o=$('#c-out'); if(o) o.innerHTML=''; };
window.calcSize = d=>{ const i=$('#c-size'); if(!i) return; const o=calcOpt(); const step = o.unit==='horas'?1:5; i.value = Math.max(0, numBR(i.value) + d*step); };
window.calcNow = ()=>{
  const o = calcOpt();
  const nivelMap = {essencial:'simples', padrao:'medio', premium:'premium'};
  const size = numBR(($('#c-size')||{}).value);
  const inp = {tipo:o.tipo, freq:($('#c-freq')||{}).value||'mensal', complexidade:nivelMap[window.CalcNivel]||'simples',
    insumos:numBR(($('#c-ins')||{}).value), desloc:numBR(($('#c-des')||{}).value)};
  if(o.tipo==='hora') inp.horas=size; else if(o.tipo==='vaso') inp.qtd=size; else inp.area=size;
  const s = sugerirPreco(inp);
  const cur = (CalcSel!==null && Draft?.items[CalcSel]) ? Number(Draft.items[CalcSel].unit)*Number(Draft.items[CalcSel].qty||1) : Number(Draft?.total||0);
  const av = avaliarPreco(cur, s);
  $('#c-out').innerHTML = `
    <div class="result-hero anim-in" style="opacity:1">
      <div class="text-xs font-bold opacity-80">PREÇO IDEAL SUGERIDO</div>
      <div class="hero-val">${brl(s.ideal)}</div>
      <div class="text-xs opacity-80">faixa saudável: ${brl(s.min)} – ${brl(s.max)}</div>
      <button class="maya-btn w-full mt-2" style="background:rgba(255,255,255,.95);color:#145214" onclick="applyTip(${s.ideal})">Usar ${brl(s.ideal)} ✓</button>
      <div class="result-minmax">
        <button onclick="applyTip(${s.min})">mín ${brl(s.min)}</button>
        <button onclick="applyTip(${s.max})">máx ${brl(s.max)}</button>
      </div>
    </div>
    <details class="calc-details"><summary>Por que esse valor?</summary>
      <div class="calc-details-body text-xs" style="color:var(--muted)">${esc(s.memoria)} • margem ${s.margemPct}%</div>
    </details>
    ${cur?`<div class="text-xs mt-2 font-bold ${av.nivel==='baixo'?'text-red-700':av.nivel==='alto'?'text-orange-600':'text-green-700'}">Seu valor atual ${brl(cur)} — ${esc(av.msg)}</div>`:''}`;
  if(window.gsap && !matchMedia('(prefers-reduced-motion: reduce)').matches){ gsap.fromTo('#c-out',{y:10,opacity:0},{y:0,opacity:1,duration:.4,clearProps:'transform'}); gsap.fromTo('#c-out .hero-val',{scale:.6},{scale:1,duration:.5,ease:'back.out(1.8)',delay:.1,clearProps:'transform'}); }
  const tl = $('#tip-last'); if(tl) tl.textContent = `Sugestão: ideal ${brl(s.ideal)} (${brl(s.min)}–${brl(s.max)})`;
};
window.applyTip = v=>{
  v = Number(v)||0;
  if((Draft.quoteMode||'livre')==='livre' && (CalcSel===null || CalcSel===undefined)){
    Draft.serviceValue = v;
    const inp = document.getElementById('f-servicevalue');
    if(inp) inp.value = v;
    window._dirty=true;
    closeDrawer(); recalcDraft(); paintEditorTotals(); paintPreview();
    toast('Valor '+brl(v)+' aplicado no serviço');
    return;
  }
  if(CalcSel!==null && Draft?.items[CalcSel]){
    // vindo de um item: troca SOMENTE o valor, sem alterar a descrição
    const it = Draft.items[CalcSel]; const q = Number(it.qty)||1;
    it.unit = Math.round((v/q)*100)/100; // distribui pela qtd
    toast(`Valor do item ${CalcSel+1} atualizado para ${brl(v)}`);
  }else{
    // calculadora geral: aplica o valor num item vazio (ou cria um para descrever).
    // Nunca insere texto da calculadora no orçamento/PDF.
    let it = (Draft.items||[]).find(x=>!String(x.desc||'').trim());
    if(!it){ it={desc:'',qty:1,unitLabel:'serviço',unit:0}; Draft.items.push(it); }
    it.unit = v;
    toast(`Valor ${brl(v)} aplicado — descreva o serviço no item`);
  }
  window._dirty=true;
  closeDrawer(); recalcDraft(); paintItems(); paintEditorTotals(); paintPreview();
};

/* ---------- lista ---------- */
function viewList(){
  return `<div class="flex gap-2 flex-wrap items-center mb-3 anim-in">
    <h1 class="text-2xl font-black">Orçamentos</h1><div class="flex-1"></div>
    <input id="q" class="maya-input cat-search !w-full md:!w-56" placeholder="Buscar cliente ou número…" oninput="renderList()">
    <select id="f" class="maya-select !w-full md:!w-40" onchange="renderList()"><option value="">todos</option>${['pendente','aprovado','recusado','expirado'].map(s=>`<option>${s}</option>`).join('')}</select>
    <a href="#/novo" class="maya-btn text-sm">+ Novo</a></div>
  <div id="list" class="grid md:grid-cols-2 gap-3"></div>`;
}
window.renderList = ()=>{
  sweepExpired();
  const q = ($('#q')?.value||'').toLowerCase(), f = $('#f')?.value||'';
  let arr = [...(Store.budgets||[])].sort((a,b)=>String(b.createdAt).localeCompare(String(a.createdAt)));
  if(q) arr = arr.filter(b=>(b.client?.name+' '+b.number+' '+(b.client?.phone||'')).toLowerCase().includes(q));
  if(f) arr = arr.filter(b=>effStatus(b)===f);
  $('#list').innerHTML = arr.map(b=>{const es=effStatus(b); return `<div class="maya-card quote-card p-4 anim-in" style="opacity:1">
    <a class="quote-main" href="#/editar/${b.id}">
      <div class="flex items-center gap-2"><b>Nº ${esc(b.number)}</b><span class="maya-badge b-${es}">${es}</span><div class="flex-1"></div><b class="quote-total">${brl(b.total)}</b></div>
      <div class="quote-who">${esc(b.client?.name||'Sem cliente')}</div>
      <div class="quote-meta">${esc(b.client?.phone||'sem WhatsApp')} • ${fmtDate(b.date)}</div>
      ${b.status==='aprovado'?(()=>{const pt=paidTotal(b), tt=Number(b.total)||0, pc=tt>0?Math.min(100,100*pt/tt):0; return `<div class="flex items-center gap-2 mt-1 text-xs"><div class="p-track flex-1"><div class="p-bar" style="width:${pc.toFixed(0)}%"></div></div><b>${paidStatus(b)==='pago'?'pago':('recebido '+brl(pt)+' de '+brl(tt))}</b></div>`;})():''}
    </a>
    <div class="quote-card-actions">
      <button type="button" class="maya-btn" onclick="pdfBudget('${b.id}')">PDF</button>
      <button type="button" class="maya-btn-ghost" onclick="openZapBudget('${b.id}')">WhatsApp</button>
      <button type="button" class="maya-btn-ghost" onclick="quoteMore('${b.id}')">Mais</button>
    </div>
  </div>`;}).join('') || emptyState('Nada por aqui','Nenhum orçamento com este filtro. Crie o primeiro em segundos.','Novo orçamento','#/novo');
};
window.quoteMore=id=>{
  const b=(Store.budgets||[]).find(x=>x.id===id); if(!b) return;
  const es=effStatus(b);
  openDrawer(`<h3 class="font-black text-lg">Orçamento Nº ${esc(b.number)}</h3>
    <p class="text-sm mb-3" style="color:var(--muted)">${esc(b.client?.name||'')} • ${brl(b.total)}</p>
    <label class="text-xs font-bold">Status<select class="maya-select mt-1" onchange="setStatus('${b.id}',this.value);closeDrawer()">${['pendente','aprovado','recusado','expirado'].map(s=>`<option ${b.status===s?'selected':''}>${s}</option>`).join('')}</select></label>
    <div class="flex flex-col gap-2 mt-3">
      <a class="maya-btn w-full text-center" href="#/editar/${b.id}" onclick="closeDrawer()">Abrir / editar</a>
      <button class="maya-btn-ghost w-full" onclick="closeDrawer();dupBudget('${b.id}')">Duplicar</button>
      <button class="maya-btn-ghost w-full visit-del" onclick="closeDrawer();delBudget('${b.id}')">Excluir</button>
      <button class="maya-btn-ghost w-full" onclick="closeDrawer()">Fechar</button>
    </div>`);
};
window.dupBudget = id=>{ const b=(Store.budgets||[]).find(x=>x.id===id); if(!b) return; const c=structuredClone(b); c.id=Store.uid(); c.number=Store.nextNumber(); c.status='pendente'; c.date=todayISO(); c.validity=addDays(todayISO(), Number(Store.settings.validityDays||15)); c.paid={entries:[]}; delete c.contractId; c.createdAt=new Date().toISOString(); const a=Store.budgets; a.push(c); Store.budgets=a; toast('Duplicado como '+c.number); renderList(); };
window.delBudget = async id=>{ if(!await confirmModal('Excluir orçamento','Esta ação não pode ser desfeita. Deseja excluir este orçamento?')) return; Store.budgets=(Store.budgets||[]).filter(b=>b.id!==id); renderList(); toast('Orçamento excluído.'); };
window.setStatus = (id,s)=>{ const a=Store.budgets; const b=a.find(x=>x.id===id); b.status=s; Store.budgets=a; renderList(); };
window.pdfBudget = async id=>{ const b=(Store.budgets||[]).find(x=>x.id===id); toast('Gerando PDF…'); await gerarPDF(normItems(structuredClone(b))); };
window.zapBudget = id=>{ const b=(Store.budgets||[]).find(x=>x.id===id); navigator.clipboard?.writeText(zapFill(b)).then(()=>toast('Msg copiada! Anexe o PDF.')); };

/* ---------- clientes ---------- */
function viewClientsLegacy(){
  const cs = Store.clients||[];
  return `<div class="flex items-center gap-2 mb-3 anim-in"><h1 class="text-2xl font-black">Clientes (${cs.length})</h1><div class="flex-1"></div><button class="maya-btn text-sm" onclick="addClient()">+ Novo cliente</button></div>
  <div class="grid md:grid-cols-2 gap-3">${cs.map(c=>{ const n=(Store.budgets||[]).filter(b=>b.client?.name===c.name); const tot=n.reduce((s,b)=>s+Number(b.total||0),0);
    return `<div class="maya-card p-4 anim-in" style="opacity:1"><b>${esc(c.name)}</b><div class="text-sm text-gray-600">${esc(c.phone||'')} • ${esc(c.address||'')}</div><div class="text-xs mt-1">${n.length} orçamento(s) • ${brl(tot)}</div>
    <div class="flex gap-1 mt-2 text-xs"><button class="maya-btn-ghost px-2 py-1" onclick="editClient('${c.id}')">Editar</button><button class="maya-btn-ghost px-2 py-1" onclick="newForClient('${c.id}')">+ Orçamento</button><button class="maya-btn-ghost px-2 py-1 !text-red-700" onclick="delClient('${c.id}')">Excluir</button></div></div>`;}).join('')||'<p class="text-gray-600">Nenhum cliente. Salve pelo editor ou adicione.</p>'}</div>`;
}
window.addClient = ()=>{ openModal('Novo cliente', MF.text('mc-name','Nome *','')+`<div class="f-row2">`+MF.text('mc-phone','WhatsApp','','249...')+MF.text('mc-addr','Endereço','','Bairro, Petrópolis')+`</div>`, ()=>{
    const name=mv('mc-name'); if(!name) return 'Informe o nome do cliente.';
    const cs=Store.clients; cs.push({id:Store.uid(),name,phone:mv('mc-phone'),address:mv('mc-addr')}); Store.clients=cs; render(); toast('Cliente salvo!'); return true;
  }); };
window.editClient = id=>{ const cs=Store.clients; const c=cs.find(x=>x.id===id); if(!c) return;
  openModal('Editar cliente', MF.text('mc-name','Nome *',c.name)+`<div class="f-row2">`+MF.text('mc-phone','WhatsApp',c.phone)+MF.text('mc-addr','Endereço',c.address)+`</div>`, ()=>{
    const n=mv('mc-name'); if(!n) return 'Informe o nome do cliente.';
    c.name=n; c.phone=mv('mc-phone'); c.address=mv('mc-addr'); Store.clients=cs; render(); toast('Cliente atualizado!'); return true;
  }); };
window.delClient = async id=>{ if(!await confirmModal('Excluir cliente','O cliente será removido da lista. Os orçamentos gerados serão mantidos.')) return; Store.clients=Store.clients.filter(c=>c.id!==id); render(); toast('Cliente excluído.'); };
window.newForClient = id=>{ const c=Store.clients.find(x=>x.id===id); Draft=normItems(blankBudget()); if(c) Draft.client={name:c.name,phone:c.phone,address:c.address}; location.hash='#/novo'; if(currentRoute()==='#/novo') render(); };

/* ---------- catálogo ---------- */
function viewCatalog(){
  const q=String(window._catQ||'').toLowerCase().trim();
  const catF=window._catFilter||'';
  const all=Store.catalog||[];
  const cats=[...new Set(all.map(c=>c.cat))];
  const items=all.filter(c=>{
    if(catF && c.cat!==catF) return false;
    if(!q) return true;
    return (c.name+' '+(c.desc||'')+' '+c.cat+' '+c.unit).toLowerCase().includes(q);
  });
  const grouped={}; items.forEach(c=>{ (grouped[c.cat]=grouped[c.cat]||[]).push(c); });
  const packs=Store.packages||[];
  const pill=(id,label,n)=>`<button type="button" class="cat-pill${catF===id?' on':''}" onclick="setCatFilter(${JSON.stringify(id)})">${esc(label)}${n!=null?` <span>${n}</span>`:''}</button>`;
  return `<div class="cat-head anim-in">
    <h1 class="text-2xl font-black">Catálogo</h1>
    <button class="maya-btn text-sm" onclick="addCat()">+ Item</button>
    <button class="maya-btn-ghost text-sm" onclick="addPackage()">+ Pacote</button>
  </div>
  <p class="text-sm mb-2" style="color:var(--muted)">Toque em um serviço para editar nome, unidade e preço. Isso entra no orçamento.</p>
  <input id="cat-q" class="maya-input cat-search" placeholder="Buscar serviço…" value="${esc(window._catQ||'')}" oninput="typeCatQ(this.value)">
  <div class="cat-pills">${pill('','Todos',all.length)}${cats.map(c=>pill(c,c,all.filter(x=>x.cat===c).length)).join('')}</div>
  <div class="maya-card p-3 mb-3 anim-in">
    <div class="font-extrabold mb-2" style="color:var(--maya-accent)">Pacotes prontos</div>
    ${packs.length?packs.map(p=>`<div class="cat-row pack-row"><div class="info"><b>${esc(p.name)}</b><div class="meta">${esc(p.desc||'')} • ${pl(p.items.length,'item','itens')}</div></div><div class="price">${brl(packTotal(p))}</div><div class="acts"><button class="maya-btn-ghost" onclick="editPackage('${p.id}')">Editar</button><button class="maya-btn-ghost visit-del" onclick="delPackage('${p.id}')">Apagar</button></div></div>`).join(''):'<p class="text-sm" style="color:var(--muted)">Nenhum pacote ainda. Monte um conjunto de serviços para inserir no orçamento de uma vez.</p>'}
  </div>
  ${Object.keys(grouped).length?Object.entries(grouped).map(([cat,list])=>`<div class="maya-card p-3 mb-3 anim-in"><div class="font-extrabold mb-1" style="color:var(--maya-accent)">${esc(cat)} <span class="text-xs font-bold" style="color:var(--muted)">${pl(list.length,'serviço','serviços')}</span></div>
    ${list.map(c=>`<button type="button" class="cat-row cat-item" onclick="editCat('${c.id}')"><div class="info"><b>${esc(c.name)}</b><div class="meta">${esc(c.desc||'—')} • ${esc(c.unit||'un')}</div></div><div class="price">${brl(c.price)}</div></button>`).join('')}
  </div>`).join(''):emptyState('Nenhum serviço','Nada encontrado nesta busca.','+ Novo item','addCat()')}
  <p class="text-xs mt-2 mb-4" style="color:var(--muted)"><button type="button" class="maya-btn-ghost text-xs" onclick="resetCat()">Restaurar catálogo padrão</button></p>`;
}
window.setCatFilter=v=>{ window._catFilter=v||''; render(); const el=document.getElementById('cat-q'); if(el){ el.focus(); const n=el.value.length; try{el.setSelectionRange(n,n);}catch(e){} } };
window.typeCatQ=v=>{
  window._catQ=v;
  clearTimeout(window._catQTimer);
  window._catQTimer=setTimeout(()=>{
    const keep=document.getElementById('cat-q');
    const pos=keep?keep.selectionStart:null;
    render();
    const el=document.getElementById('cat-q');
    if(el){ el.focus(); try{ const n=pos==null?el.value.length:pos; el.setSelectionRange(n,n);}catch(e){} }
  },180);
};
window.updCat=(id,f,v)=>{ const a=Store.catalog; const c=a.find(x=>x.id===id); if(!c) return; c[f]=(f==='price'?numBR(v):v); Store.catalog=a; };
window.delCat=async id=>{ if(!await confirmModal('Excluir item','Remover este item do catálogo?'))return; Store.catalog=Store.catalog.filter(c=>c.id!==id); render(); toast('Item removido.'); };
function catForm(c){
  const cats=[...new Set((Store.catalog||[]).map(x=>x.cat))];
  return MF.sel('ct-cat','Categoria',[...cats,'+ Nova categoria…'],c?.cat||cats[0])+MF.text('ct-catnew','Nova categoria (se escolheu + Nova)','','Ex: Irrigação')+MF.text('ct-name','Serviço *',c?.name||'','Ex: Poda de cerca-viva')+MF.area('ct-desc','Descrição',c?.desc||'',2)+`<div class="f-row2">`+MF.text('ct-unit','Unidade',c?.unit||'un')+MF.num('ct-price','Preço R$ *',c?.price??0)+`</div>`;
}
function catFromForm(existing){
  let cat=mv('ct-cat'); if(cat==='+ Nova categoria…') cat=mv('ct-catnew'); if(!cat) return 'Informe a categoria.';
  const name=mv('ct-name'); if(!name) return 'Informe o nome do serviço.';
  const price=numBR(mv('ct-price')); if(price<=0) return 'Informe um preço maior que zero.';
  const row={id:existing?.id||Store.uid(),cat,name,desc:mv('ct-desc'),unit:mv('ct-unit')||'un',price};
  return row;
}
window.addCat=()=>{ openModal('Novo serviço', catForm(null), ()=>{
    const row=catFromForm(null); if(typeof row==='string') return row;
    const a=Store.catalog; a.push(row); Store.catalog=a; render(); toast('Serviço adicionado!'); return true;
  }); };
window.editCat=id=>{
  const a=Store.catalog, c=a.find(x=>x.id===id); if(!c) return;
  openModal('Editar serviço', catForm(c)+`<button type="button" class="maya-btn-ghost w-full mt-2 visit-del" onclick="closeModal();delCat('${c.id}')">Apagar serviço</button>`, ()=>{
    const row=catFromForm(c); if(typeof row==='string') return row;
    Object.assign(c,row); Store.catalog=a; render(); toast('Serviço atualizado!'); return true;
  });
};
window.resetCat=async ()=>{ if(!await confirmModal('Restaurar catálogo','Voltar à tabela padrão 2026? Suas alterações serão perdidas.','Restaurar'))return; localStorage.removeItem('maya_catalog_v1'); Store.catalog=Store.catalog; render(); toast('Catálogo padrão restaurado.'); };

/* ---------- agenda ---------- */
function viewAgendaLegacy(){
  const vs=[...(Store.visits||[])].sort((a,b)=>String(a.date).localeCompare(String(b.date)));
  return `<div class="flex items-center gap-2 mb-3 anim-in"><h1 class="text-2xl font-black">Agenda / Visitas</h1><div class="flex-1"></div><button class="maya-btn text-sm" onclick="addVisit()">+ Agendar</button></div>
  <div class="grid md:grid-cols-2 gap-3">${vs.map(v=>`<div class="maya-card p-4 anim-in" style="opacity:1"><b>${fmtDate(v.date)} ${esc(v.time||'')}</b> — ${esc(v.client)}<div class="text-sm text-gray-600">${esc(v.service)} • ${v.price?brl(v.price):''} • ${esc(v.status||'agendada')}</div>
  <div class="flex gap-1 mt-2 text-xs"><button class="maya-btn-ghost px-2 py-1" onclick="toggleVisit('${v.id}')">✓ concluir</button><button class="maya-btn-ghost px-2 py-1 !text-red-700" onclick="delVisit('${v.id}')">Excluir</button></div></div>`).join('')||'<p class="text-gray-600">Nenhuma visita. Agende avaliação, manutenção, replantio…</p>'}</div>`;
}
window.addVisit=()=>{ openModal('Agendar visita', MF.text('av-client','Cliente *','','Nome do cliente')+`<div class="f-row2">`+MF.date('av-date','Data',todayISO())+MF.time('av-time','Hora','09:00')+`</div>`+MF.text('av-service','Serviço','Visita avaliação')+MF.num('av-price','Valor previsto R$',0), ()=>{
    const client=mv('av-client'); if(!client) return 'Informe o cliente.';
    const a=Store.visits; a.push({id:Store.uid(),client,date:mv('av-date')||todayISO(),time:mv('av-time'),service:mv('av-service'),price:numBR(mv('av-price')),status:'agendada'}); Store.visits=a; render(); toast('Visita agendada!'); if(window.MayaReminders) window.MayaReminders.afterVisitSaved(); return true;
  }); };
window.toggleVisit=id=>{ const a=Store.visits; const v=a.find(x=>x.id===id); if(!v) return; v.status=v.status==='concluída'?'agendada':'concluída'; Store.visits=a; render(); };
window.cancelVisit=id=>{ const a=Store.visits; const v=a.find(x=>x.id===id); if(!v) return; v.status='cancelada'; Store.visits=a; render(); toast('Visita cancelada.'); };
window.reopenVisit=id=>{ const a=Store.visits; const v=a.find(x=>x.id===id); if(!v) return; v.status='agendada'; Store.visits=a; render(); toast('Visita reativada.'); };
window.delVisit=async id=>{
  const v=(Store.visits||[]).find(x=>x.id===id);
  const cancelada=v?.status==='cancelada';
  if(!await confirmModal(cancelada?'Apagar visita cancelada':'Excluir visita', cancelada?'Esta visita está cancelada. Apagar de vez?':'Remover esta visita da agenda?')) return;
  Store.visits=Store.visits.filter(x=>x.id!==id); render(); toast('Visita apagada.');
};
window.clearCancelledVisits=async ()=>{
  const n=(Store.visits||[]).filter(v=>v.status==='cancelada').length;
  if(!n){ toast('Não há visitas canceladas.'); return; }
  if(!await confirmModal('Apagar canceladas', `Apagar ${n} visita${n>1?'s':''} cancelada${n>1?'s':''}?`)) return;
  Store.visits=Store.visits.filter(v=>v.status!=='cancelada'); render(); toast('Canceladas apagadas.');
};

/* ---------- config e acessos ---------- */
function viewAdmin(){
  if(!window.MayaAuth?.isAdmin()) return `<h1 class="text-2xl font-black mb-3">Administração</h1><div class="maya-card p-4"><b>Acesso restrito</b><p class="text-sm mt-1">Somente o administrador pode gerenciar logins, perfis e expirações.</p></div>`;
  return `<h1 class="text-2xl font-black mb-3 anim-in">Administração de acessos</h1><p class="text-sm mb-3" style="color:var(--muted)">Controle quem entra no sistema. Deixe a data vazia para um acesso infinito.</p>${window.CloudSync?.adminHtml?window.CloudSync.adminHtml():'<div class="maya-card p-4">Carregando acessos…</div>'}`;
}
function viewConfig(){
  const st=Store.settings, p=Store.pricing, write=window.MayaAuth?.canWrite?.()!==false, disabled=write?'':'disabled';
  return `<h1 class="text-2xl font-black mb-3 anim-in">Configurações</h1>
  <div class="maya-card p-4 mb-3 anim-in" style="opacity:1"><div class="flex items-center gap-3 flex-wrap"><div class="flex-1"><b>Sessão atual</b><div class="text-xs" style="color:var(--muted)">Conectado ao Supabase. Orçamentos, clientes e catálogo sobem sozinhos para a nuvem.</div></div></div><div class="mt-3">${window.CloudSync?.accountHtml?window.CloudSync.accountHtml():'Carregando sessão…'}</div>
    <button type="button" class="maya-btn w-full mt-3" onclick="installApp()">Instalar no celular ou computador</button>
    <p class="text-xs mt-2" style="color:var(--muted)">iPhone: Safari → Compartilhar → Adicionar à Tela de Início. Android e PC (Chrome/Edge): toque em Instalar.</p>
    <button type="button" class="maya-btn-ghost w-full mt-2" onclick="remindersEnable()">Ativar aviso de visita</button>
    <p class="text-xs mt-2" style="color:var(--muted)">3 dias antes da visita o celular avisa. No iPhone o mais certo é <b>Agenda → Avisos no calendário</b>: o Calendário do iPhone notifica com o app fechado.</p>
  </div>
  <div class="maya-card p-4 mb-3 anim-in" style="opacity:1">
    <h2 class="font-extrabold mb-1">Preços por metro quadrado</h2>
    <p class="text-xs mb-3" style="color:var(--muted)">Quanto você cobra por m². O orçamento usa o valor <b>Você cobra</b> no cálculo. Piso = não cobrar menos. Teto = não passar disso.</p>
    ${[
      ['Corte de grama','Roçada e aparo. Ex: 80 m² × R$ 8 = R$ 640.','m2Grama',null,null],
      ['Manutenção / limpeza','Corte, capina, varrição e acabamento do jardim.','m2ManutIdeal','m2ManutMin','m2ManutMax'],
      ['Implantação de jardim','Fazer o jardim do zero: terra, plantio e grama.','m2ImplIdeal','m2ImplMin','m2ImplMax'],
      ['Irrigação','Mangueira, aspersores e instalação simples.','m2Irrigacao',null,null],
      ['Projeto paisagístico','Desenho do jardim, espécies e memorial.','projetoM2Ideal','projetoM2Min','projetoM2Max']
    ].map(([name,help,ideal,min,max])=>`<div class="price-group">
      <b>${name}</b>
      <p class="price-help">${help}</p>
      <div class="price-trio ${min?'':'one'}">
        ${min?`<label>Piso R$/m²<input ${disabled} type="text" inputmode="decimal" enterkeyhint="done" id="p-${min}" class="maya-input" value="${esc(p[min])}"></label>`:''}
        <label>Você cobra R$/m²<input ${disabled} type="text" inputmode="decimal" enterkeyhint="done" id="p-${ideal}" class="maya-input" value="${esc(p[ideal])}"></label>
        ${max?`<label>Teto R$/m²<input ${disabled} type="text" inputmode="decimal" enterkeyhint="done" id="p-${max}" class="maya-input" value="${esc(p[max])}"></label>`:''}
      </div>
    </div>`).join('')}
    <button ${disabled} class="maya-btn mt-3 w-full" onclick="savePricing()">Salvar preços por m²</button>
  </div>
  <div class="grid lg:grid-cols-2 gap-3">
  <div class="maya-card p-4 anim-in" style="opacity:1"><h2 class="font-extrabold mb-2">Empresa (sai no PDF)</h2>
    <div class="grid grid-cols-2 gap-2 text-sm">
    ${[['company','Empresa'],['tagline','Slogan'],['cnpj','CNPJ (opcional)'],['email','E-mail'],['whatsappDisplay','Whats exibição'],['whatsappLink','Whats link (só números c/ DDI)'],['instagram','Instagram'],['address','Endereço'],['pix','Pix'],['headerText','Texto validade'],['footerText','Texto rodapé']].map(([k,l])=>`<label class="font-bold ${k==='headerText'||k==='footerText'||k==='tagline'?'col-span-2':''}">${l}<input ${disabled} class="maya-input" id="s-${k}" value="${esc(st[k]||'')}"></label>`).join('')}
    <label class="font-bold col-span-2">Condições e termos (saem no PDF)<textarea ${disabled} id="s-terms" class="maya-textarea" rows="3">${esc(st.terms||'')}</textarea></label>
    <label class="font-bold col-span-2">Modelo msg WhatsApp <span class="font-normal" style="color:var(--muted)">({nome} {numero} {total} {validade} {empresa})</span><textarea ${disabled} id="s-zapTemplate" class="maya-textarea" rows="2">${esc(st.zapTemplate||'')}</textarea></label>
    <label class="font-bold col-span-2">Modelo msg retorno <span class="font-normal" style="color:var(--muted)">({nome} {numero} {total} {dias} {empresa})</span><textarea ${disabled} id="s-zapFollow" class="maya-textarea" rows="2">${esc(st.zapFollow||'')}</textarea></label>
    <label class="font-bold">Validade padrão dias<input ${disabled} type="number" id="s-validityDays" class="maya-input" value="${esc(st.validityDays)}"></label>
    <label class="font-bold">Sinal padrão %<input ${disabled} type="text" inputmode="decimal" enterkeyhint="done" id="s-signalPct" class="maya-input" value="${esc(st.signalPct)}"></label>
    <label class="font-bold">Desloc padrão R$<input ${disabled} type="text" inputmode="decimal" enterkeyhint="done" id="s-displacementDefault" class="maya-input" value="${esc(st.displacementDefault)}"></label>
    </div>
    <div class="mt-2 text-sm grid grid-cols-3 gap-2">
      <label class="font-bold">Opacidade marca<input ${disabled} type="number" step="0.01" min="0" max="0.3" id="s-wmOpacity" class="maya-input" value="${esc(st.wmOpacity)}"></label>
      <label class="font-bold">Tamanho %<input ${disabled} type="number" id="s-wmSizePct" class="maya-input" value="${esc(st.wmSizePct)}"></label>
      <label class="font-bold">Marca ON?<select ${disabled} id="s-wmEnabled" class="maya-select"><option value="1" ${st.wmEnabled?'selected':''}>sim</option><option value="0" ${!st.wmEnabled?'selected':''}>não</option></select></label>
    </div>
    <button ${disabled} class="maya-btn mt-3" onclick="saveSettings()">Salvar empresa</button>
  </div>
  <div class="maya-card p-4 anim-in" style="opacity:1">
    <h2 class="font-extrabold mb-1">Outros preços (dica Quanto cobrar?)</h2>
    <p class="text-xs mb-3" style="color:var(--muted)">Usados quando você toca em <b>Quanto cobrar?</b> no orçamento. Piso = menor valor. Você cobra = sugestão. Teto = não passar disso.</p>
    <div class="price-group">
      <b>Mão de obra por hora</b>
      <p class="price-help">Jardineiro em campo. Ex: 4 horas × R$ 55 = R$ 220.</p>
      <div class="price-trio">
        <label>Piso R$/hora<input ${disabled} type="text" inputmode="decimal" enterkeyhint="done" id="p-horaMin" class="maya-input" value="${esc(p.horaMin)}"></label>
        <label>Você cobra R$/hora<input ${disabled} type="text" inputmode="decimal" enterkeyhint="done" id="p-horaIdeal" class="maya-input" value="${esc(p.horaIdeal)}"></label>
        <label>Teto R$/hora<input ${disabled} type="text" inputmode="decimal" enterkeyhint="done" id="p-horaMax" class="maya-input" value="${esc(p.horaMax)}"></label>
      </div>
    </div>
    <div class="price-group">
      <b>Replantio de orquídea</b>
      <p class="price-help">Por vaso, com substrato.</p>
      <div class="price-trio">
        <label>Piso R$/vaso<input ${disabled} type="text" inputmode="decimal" enterkeyhint="done" id="p-vasoMin" class="maya-input" value="${esc(p.vasoMin)}"></label>
        <label>Você cobra R$/vaso<input ${disabled} type="text" inputmode="decimal" enterkeyhint="done" id="p-vasoIdeal" class="maya-input" value="${esc(p.vasoIdeal)}"></label>
        <label>Teto R$/vaso<input ${disabled} type="text" inputmode="decimal" enterkeyhint="done" id="p-vasoMax" class="maya-input" value="${esc(p.vasoMax)}"></label>
      </div>
    </div>
    <div class="price-group">
      <b>Visita ao orquidário</b>
      <p class="price-help">Manutenção pontual: limpeza, adubo e fitossanitário.</p>
      <div class="price-trio">
        <label>Piso R$/visita<input ${disabled} type="text" inputmode="decimal" enterkeyhint="done" id="p-visitaOrqMin" class="maya-input" value="${esc(p.visitaOrqMin)}"></label>
        <label>Você cobra R$/visita<input ${disabled} type="text" inputmode="decimal" enterkeyhint="done" id="p-visitaOrqIdeal" class="maya-input" value="${esc(p.visitaOrqIdeal)}"></label>
        <label>Teto R$/visita<input ${disabled} type="text" inputmode="decimal" enterkeyhint="done" id="p-visitaOrqMax" class="maya-input" value="${esc(p.visitaOrqMax)}"></label>
      </div>
    </div>
    <div class="price-group">
      <b>Orquidário completo</b>
      <p class="price-help">Projeto fechado (estrutura, tela, vasos iniciais).</p>
      <div class="price-trio">
        <label>Piso R$<input ${disabled} type="text" inputmode="decimal" enterkeyhint="done" id="p-orquidarioMin" class="maya-input" value="${esc(p.orquidarioMin)}"></label>
        <label>Você cobra R$<input ${disabled} type="text" inputmode="decimal" enterkeyhint="done" id="p-orquidarioIdeal" class="maya-input" value="${esc(p.orquidarioIdeal)}"></label>
        <label>Teto R$<input ${disabled} type="text" inputmode="decimal" enterkeyhint="done" id="p-orquidarioMax" class="maya-input" value="${esc(p.orquidarioMax)}"></label>
      </div>
    </div>
    <div class="price-group">
      <b>Margem da empresa</b>
      <p class="price-help">Percentual em cima do custo quando a dica não usa m² nem hora. 30 = 30%.</p>
      <label class="font-bold">Margem %<input ${disabled} type="text" inputmode="decimal" enterkeyhint="done" id="p-marginPct" class="maya-input" value="${esc(p.marginPct)}"></label>
    </div>
    <button ${disabled} class="maya-btn mt-3 w-full" onclick="savePricing()">Salvar esses preços</button>
    ${write?`<details class="more-opts mt-3"><summary>Zona de perigo</summary>
      <p class="text-xs mt-2" style="color:var(--muted)">Apaga orçamentos, clientes e visitas desta conta na nuvem.</p>
      <button class="maya-btn-ghost text-sm !text-red-700 !border-red-300 mt-2" onclick="confirmReset()">Apagar tudo</button>
    </details>`:'<div class="mt-4 text-xs" style="color:var(--muted)">Perfil visitante: somente visualização.</div>'}
  </div></div>`;
}

window.refreshSystem = async function(){
  toast('Atualizando o sistema…');
  try{
    if('serviceWorker' in navigator){
      const rs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(rs.map(r=>r.unregister()));
    }
    if(window.caches){
      const ks = await caches.keys();
      await Promise.all(ks.map(k=>caches.delete(k)));
    }
  }catch(e){}
  const u = new URL(location.href);
  u.searchParams.set('v', String(Date.now()));
  location.replace(u.toString());
};
window.confirmReset=async ()=>{ if(!window.MayaAuth?.canWrite?.()){ toast('Acesso somente para visualização.'); return; } if(!await confirmModal('Apagar tudo','Todos os dados compartilhados serão apagados da nuvem. Deseja continuar?','Apagar tudo'))return; Store.resetAll(); await window.CloudSync?.pushLocal?.(false); location.hash='#/'; location.reload(); };
window.saveSettings=()=>{
  if(!window.MayaAuth?.canWrite?.()){ toast('Acesso somente para visualização.'); return; }
  const st=Store.settings;
  ['company','tagline','cnpj','email','whatsappDisplay','whatsappLink','instagram','address','pix','headerText','footerText','terms','zapTemplate','zapFollow'].forEach(k=>st[k]=$('#s-'+k).value);
  st.validityDays=numBR($('#s-validityDays').value)||15; st.signalPct=numBR($('#s-signalPct').value); st.displacementDefault=numBR($('#s-displacementDefault').value);
  st.wmOpacity=numBR($('#s-wmOpacity').value)||0.09; st.wmSizePct=numBR($('#s-wmSizePct').value)||60; st.wmEnabled=$('#s-wmEnabled').value==='1';
  Store.settings=st; toast('Empresa salva!'); render();
};
window.savePricing=()=>{ if(!window.MayaAuth?.canWrite?.()){ toast('Acesso somente para visualização.'); return; } const p=Store.pricing; $$('[id^="p-"]').forEach(i=>{ p[i.id.slice(2)]=numBR(i.value); }); Store.pricing=p; toast('Preços salvos!'); };

/* ---------- backup local ---------- */
window.exportBackup=()=>{
  try{
    const payload=JSON.stringify(Store.exportBackup(), null, 2);
    const a=document.createElement('a');
    a.href=URL.createObjectURL(new Blob([payload],{type:'application/json'}));
    a.download=`maya-garden-backup-${todayISO()}.json`;
    a.click();
    setTimeout(()=>URL.revokeObjectURL(a.href),1000);
    toast('Backup baixado!');
  }catch(e){ toast('Não foi possível criar o backup.'); }
};
window.importBackupFile=async input=>{
  const file=input?.files?.[0]; if(!file) return;
  try{
    const payload=JSON.parse(await file.text());
    const ok=await confirmModal('Restaurar backup','Isso substituirá os dados atuais deste navegador. Faça um backup atual antes de continuar.','Restaurar');
    if(!ok) return;
    const r=Store.importBackup(payload);
    Draft=null; window._dirty=false; location.hash='#/';
    if(currentRoute()==='#/') render();
    toast(`Backup restaurado: ${r.budgets} orçamento(s), ${r.clients} cliente(s).`);
  }catch(e){ toast((e&&e.message)||'Arquivo de backup inválido.'); }
  finally{ input.value=''; }
};

window.addEventListener('maya-auth-state',()=>{ try{ if(window.MayaAuth?.authenticated) render(); else renderAuthGate(); }catch(e){} });
window.addEventListener('maya-cloud-state',()=>{ try{ if(typeof render==='function' && window.MayaAuth?.authenticated && (currentRoute().startsWith('#/config')||currentRoute().startsWith('#/admin'))) render(); }catch(e){} });

/* ---------- salvamento automático (navegador) ---------- */
function storageInfo(){ try{
    let bytes=0; for(let i=0;i<localStorage.length;i++){ const k=localStorage.key(i); const v=localStorage.getItem(k)||''; bytes+=(k.length+v.length)*2; }
    return {kb:bytes/1024};
  }catch(e){ return {kb:0}; } }

function bootMaya(){ try{ if(window.MayaAuth?.authenticated) { render(); sidebarIntroOnce(); } else renderAuthGate(); }catch(e){ var d=document.getElementById('errbox'); if(d){ d.style.display='block'; d.textContent='Erro ao abrir: '+(e&&e.message||e); } console.error(e); } }
function sidebarIntroOnce(){ if(window.__booted) return; }
window.addEventListener('beforeunload', function(e){
  if(window._dirty && /^#\/(novo|editar\/)\b/.test(currentRoute())){ e.preventDefault(); e.returnValue=''; }
});
if(document.readyState==='loading'){ document.addEventListener('DOMContentLoaded', bootMaya); } else { bootMaya(); }
// watchdog: se o placeholder persistir, tenta de novo (ex: script adiado)
setTimeout(function(){ var a=document.getElementById('app'); if(a && a.textContent.indexOf('Carregando MAYA')>=0){ bootMaya(); } }, 1200);
