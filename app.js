/* MAYA Garden Pro — App (hash router + GSAP + tudo editável) */
const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const esc = s => String(s??'').replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const brl = v => (Number(v)||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
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
  Draft.subtotal = (Draft.items||[]).reduce((s,it)=>s+(Number(it.qty)||0)*(Number(it.unit)||0),0);
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
    discount:0, discountType:'pct', discountVal:0, subtotal:0, displacement:Number(st.displacementDefault||0),
    signalPct:Number(st.signalPct||50), payment:'Pix', payMethod:'Pix', payParcels:1, notes:'', photos:[], paid:{entries:[]}, createdAt:new Date().toISOString()
  };
}
// normaliza item antigo (unit vs unitPrice)
function normItems(b){
  b.items = (b.items||[]).map(it=>({...it, qty:Number(it.qty??it.qtd??1), unit:Number(it.unit??it.unitPrice??it.valor??0)}));
  if(!Array.isArray(b.photos)) b.photos=[];
  if(!b.paid || !Array.isArray(b.paid.entries)) b.paid={entries:[]};
  if(!b.payMethod) b.payMethod=b.payment||'Pix';
  if(!b.payParcels) b.payParcels=1;
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
const NAV_ORDER = ['#/','#/orcamentos','#/novo','#/recorrentes','#/os','#/clientes','#/catalogo','#/agenda','#/relatorios','#/config'];
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
const NAV_MGMT = [['#/recorrentes','Recorrentes','◔'],['#/os','Ordens de serviço','▣'],['#/clientes','Clientes','○'],['#/catalogo','Catálogo','≡'],['#/agenda','Agenda','▦'],['#/relatorios','Relatórios','◫']];
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
  const nToday = (Store.visits||[]).filter(v=>v.date===t&&v.status!=='concluída').length;
  const nBill = (Store.contracts||[]).filter(c=>c.active!==false&&(c.lastBilled||'').slice(0,7)!==mk).length;
  const nOS = (Store.os||[]).filter(o=>o.status==='aberta'||o.status==='em execução').length;
  const badges = {'#/orcamentos':nPend,'#/agenda':nToday,'#/recorrentes':nBill,'#/os':nOS};
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
  const r = currentRoute();
  let html='';
  if(r==='#/'||r==='' ) html = dashProHTML();
  else if(r.startsWith('#/novo')){ if(!Draft){ Draft = normItems(blankBudget()); } window._dirty=false; html = viewEditor(false); }
  else if(r.startsWith('#/editar/')){ const id=r.split('/')[2]; const b=(Store.budgets||[]).find(x=>x.id===id); if(!b){ location.hash='#/orcamentos'; return; } Draft = normItems(structuredClone(b)); window._dirty=false; html = viewEditor(true); }
  else if(r.startsWith('#/orcamentos')) html = viewList();
  else if(r.startsWith('#/os')) html = viewOS();
  else if(r.startsWith('#/recorrentes')) html = viewContracts();
  else if(r.startsWith('#/relatorios')) html = viewReports();
  else if(r.startsWith('#/admin')) html = viewAdmin();
  else if(r.startsWith('#/clientes')) html = clientsProHTML('');
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
  </div>
  <div class="maya-card p-4 mt-3 anim-in">
    <h2 class="font-extrabold mb-2">Banco de dados da empresa</h2>
    <p class="text-sm text-gray-600 mb-2">Os dados ficam salvos automaticamente na nuvem compartilhada.</p>
  </div>`;
}
function afterRender(r){
  if(r==='#/'||r===''){ sweepExpired(); if(window.dashAfter) dashAfter(); }
  if(r.startsWith('#/novo')||r.startsWith('#/editar')){ recalcDraft(); window.__lastTot = Draft.total; paintEditorTotals(); paintPreview(); applyWmVars(); paintPhotos(); paintPaid(); toggleParcels(); }
  if(r.startsWith('#/orcamentos') && window.renderList){ try{ renderList(); }catch(e){ console.warn(e); } }
  if(r.startsWith('#/relatorios') && window.repAfter){ try{ repAfter(); }catch(e){} }
}

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
      <div class="grid grid-cols-3 gap-2 mt-3">
        <label class="text-xs font-bold">Emissão<input type="date" id="f-date" class="maya-input" value="${esc(d.date)}"></label>
        <label class="text-xs font-bold">Validade<input type="date" id="f-valid" class="maya-input" value="${esc(d.validity)}"></label>
        <label class="text-xs font-bold">Status<select id="f-status" class="maya-select">${statusOpts(d.status)}</select></label>
      </div>
      <div class="grid grid-cols-2 gap-2 mt-2">
        <label class="text-xs font-bold">Pagamento<select id="f-paymethod" class="maya-select" onchange="toggleParcels()">${['Pix','Dinheiro','Cartão de crédito','Cartão de débito','Transferência','Boleto'].concat((d.payMethod&&!['Pix','Dinheiro','Cartão de crédito','Cartão de débito','Transferência','Boleto'].includes(d.payMethod))?[d.payMethod]:[]).map(m=>`<option ${d.payMethod===m||(!d.payMethod&&d.payment===m)?'selected':''}>${m}</option>`).join('')}</select></label>
        <label class="text-xs font-bold" id="f-parcelsbox">Parcelas (crédito)<input type="number" id="f-parcels" min="1" max="21" class="maya-input" value="${esc(d.payParcels||1)}"></label>
      </div>
      <div class="text-xs mt-1 font-bold" id="t-parcinfo" style="color:var(--maya-accent)"></div>
      <div class="grid grid-cols-2 gap-2 mt-2">
        <label class="text-xs font-bold">Sinal %<input type="number" id="f-signal" class="maya-input" value="${esc(d.signalPct)}"></label>
      </div>
      <label class="text-xs font-bold block mt-2">Observações<textarea id="f-notes" class="maya-textarea" rows="2" placeholder="Ex: material incluso, garantia, prazo execução…">${esc(d.notes)}</textarea></label>
    </div>

    <div class="maya-card p-4 anim-in">
      <div class="budget-items-head mb-3"><h2 class="font-extrabold">2. Itens (livres)</h2>
        <div class="budget-items-actions" role="group" aria-label="Adicionar itens ao orçamento">
          <button class="maya-btn-ghost text-sm" onclick="openPackPick()">Pacote</button>
          <button class="maya-btn-ghost text-sm" onclick="openCatalogPick()">+ do catálogo</button>
          <button class="maya-btn text-sm" onclick="addItem()">+ item livre</button>
        </div>
      </div>
      <div id="items"></div>
      <div class="grid grid-cols-3 gap-2 mt-3 text-sm">
        <label class="font-bold">Desconto<input type="number" id="f-desc" class="maya-input" value="${esc(d.discount)}"></label>
        <label class="font-bold">Tipo<select id="f-desct" class="maya-select"><option value="pct" ${d.discountType==='pct'?'selected':''}>% porc.</option><option value="vlr" ${d.discountType==='vlr'?'selected':''}>R$ valor</option></select></label>
        <label class="font-bold">Deslocamento R$<input type="number" id="f-desloc" class="maya-input" value="${esc(d.displacement)}"></label>
      </div>
      <div class="price-tip p-3 mt-3">
        <div class="font-extrabold">Dica de quanto cobrar</div>
        <p class="text-xs mb-2" style="color:var(--muted)">3 toques: serviço → tamanho → padrão. Profissional e rápido.</p>
        <button class="maya-btn mt-1 text-sm w-full" onclick="openCalc(null)">Quanto cobrar?</button>
        <div id="tip-last" class="text-xs mt-1 text-gray-700"></div>
      </div>
      <div class="mt-3 text-right">
        <div class="text-sm">Subtotal: <b id="t-sub">—</b></div>
        <div class="text-sm">Desconto: <b id="t-desc">—</b></div>
        <div class="text-xl font-black text-[#1A5D1A]">Total: <span id="t-tot">—</span></div>
        <div class="text-xs text-gray-600" id="t-signal"></div>
        <div class="text-xs font-bold" id="t-alert"></div>
      </div>
    </div>
  </div>

  <div class="grid lg:grid-cols-2 gap-3 mt-3">
    <div class="maya-card p-4 anim-in">
      <div class="flex items-center gap-2 mb-1"><h2 class="sec-title">Fotos do serviço</h2><div class="flex-1"></div>
      <label class="maya-btn-ghost text-xs cursor-pointer">+ Adicionar<input type="file" accept="image/*" multiple class="hidden" onchange="addPhotos(this)"></label></div>
      <p class="text-xs mb-2" style="color:var(--muted)">Antes/depois. Saem impressas no PDF.</p>
      <div id="photogrid" class="photo-grid"></div>
    </div>
    <div class="maya-card p-4 anim-in">
      <div class="flex items-center gap-2 mb-1"><h2 class="sec-title">Recebimentos</h2><div class="flex-1"></div>
      <button class="maya-btn text-xs" onclick="addPayment()">+ Registrar</button></div>
      <div id="paidbox"></div>
    </div>
  </div>

  <div class="mt-3 anim-in">
    <h2 class="font-extrabold mb-2">3. Prévia idêntica ao PDF (com marca d'água)</h2>
    <div id="print-area"><div class="budget-paper" id="paper"><div class="budget-inner p-5" id="preview"></div></div></div>
    <div class="flex gap-2 mt-2 flex-wrap no-print">
      <button class="maya-btn" onclick="saveDraft(${isEdit})">Salvar</button>
      <button class="maya-btn-ghost" onclick="doPDF()">Baixar PDF</button>
      <button class="maya-btn-ghost" onclick="copyZap()">Copiar msg</button>
      <button class="maya-btn-ghost" onclick="openZapDraft()">Abrir WhatsApp</button>
      <button class="maya-btn-ghost" onclick="printOSDraft()">Ordem de serviço</button>
    </div>
  </div>
  </div>`;
}

function itemRow(it, i){
  return `<div class="border rounded-xl p-2 mb-2 bg-[#fbfdf6]" data-row="${i}">
    <input class="maya-input mb-1" placeholder="Descrição do serviço *" value="${esc(it.desc)}" oninput="editItem(${i},'desc',this.value)">
    <div class="grid grid-cols-2 md:grid-cols-4 gap-1">
      <label class="text-[11px] font-bold">Qtd<input type="number" step="any" class="maya-input" value="${esc(it.qty)}" oninput="editItem(${i},'qty',this.value)"></label>
      <label class="text-[11px] font-bold">Und<input class="maya-input" value="${esc(it.unitLabel||it.unit||'un')}" oninput="editItem(${i},'unitLabel',this.value)" placeholder="m²/hora/un"></label>
      <label class="text-[11px] font-bold">Valor unit R$<input type="number" step="any" class="maya-input" value="${esc(it.unit)}" oninput="editItem(${i},'unit',this.value)"></label>
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
  // preserva foco: só re-renderiza em mudanças estruturais (chamadores controlam)
  box.innerHTML = (Draft.items||[]).map(itemRow).join('') || '<p class="text-sm text-gray-500">Sem itens. Adicione.</p>';
}
window.editItem = (i,f,v)=>{
  if(!Draft?.items[i]) return;
  Draft.items[i][f]=v; window._dirty=true;
  recalcDraft(); paintEditorTotalsOnly(); paintPreviewOnly();
  // atualiza subtotal da linha sem re-renderizar (não perde foco)
  const row = document.querySelector(`[data-row="${i}"] .row-sub`);
  if(row){ const it=Draft.items[i]; row.textContent = brl((Number(it.qty)||0)*(Number(it.unit)||0)); }
};
window.addItem = ()=>{ Draft.items.push({desc:'',qty:1,unitLabel:'un',unit:0}); window._dirty=true; recalcDraft(); paintItems(); paintEditorTotalsOnly(); paintPreviewOnly(); };

/* ---------- fotos antes/depois ---------- */
window.addPhotos = input=>{
  const files=[...(input.files||[])].slice(0,8); if(!files.length) return;
  if((Draft.photos||[]).length+files.length>12){ toast('Máximo de 12 fotos por orçamento.'); return; }
  let done=0;
  const fin=()=>{ if(++done===files.length){ window._dirty=true; paintPhotos(); toast('Foto(s) adicionada(s)!'); } };
  files.forEach(f=>{ const url=URL.createObjectURL(f); const img=new Image();
    img.onload=()=>{ try{ const max=900, sc=Math.min(1,max/Math.max(img.width||1,img.height||1));
        const c=document.createElement('canvas'); c.width=Math.max(1,Math.round(img.width*sc)); c.height=Math.max(1,Math.round(img.height*sc));
        c.getContext('2d').drawImage(img,0,0,c.width,c.height); URL.revokeObjectURL(url);
        Draft.photos.push({id:Store.uid(), label:'', src:c.toDataURL('image/jpeg',0.68)});
      }catch(e){ toast('Falha ao ler uma foto.'); } fin(); };
    img.onerror=()=>{ URL.revokeObjectURL(url); fin(); };
    img.src=url; });
  input.value='';
};
window.delPhoto = i=>{ Draft.photos.splice(i,1); window._dirty=true; paintPhotos(); };
window.photoLabel = (i,v)=>{ if(Draft.photos[i]){ Draft.photos[i].label=v; window._dirty=true; } };
function paintPhotos(){ const box=document.querySelector('#photogrid'); if(!box||!Draft) return;
  box.innerHTML = (Draft.photos||[]).map((p,i)=>`<div class="photo-thumb"><img src="${p.src}" alt="foto ${i+1}" loading="lazy" onclick="openLight('${p.src}')" style="cursor:zoom-in"><button class="photo-x" onclick="delPhoto(${i})" title="Remover">×</button><input value="${esc(p.label||'')}" placeholder="Legenda (ex: antes)" oninput="photoLabel(${i},this.value)"></div>`).join('') || '<p class="text-xs" style="color:var(--muted);grid-column:1/-1">Nenhuma foto ainda.</p>'; }

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
    const v=Number(mv('pm-value'))||0; if(v<=0) return 'Informe um valor maior que zero.';
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
  Draft.payParcels = Math.min(21, Math.max(1, Number($('#f-parcels').value||1)));
  Draft.payment = Draft.payMethod;
  Draft.signalPct = Number($('#f-signal').value||0);
  Draft.notes = $('#f-notes').value;
  Draft.discount = Number($('#f-desc').value||0);
  Draft.discountType = $('#f-desct').value;
  Draft.displacement = Number($('#f-desloc').value||0);
  recalcDraft();
}
function paintEditorTotalsOnly(){
  if(!Draft) return;
  const set = (id,v)=>{ const e=$(id); if(e) e.textContent=v; };
  set('#t-sub', brl(Draft.subtotal)); set('#t-desc','-'+brl(Draft.discountVal)); set('#t-tot', brl(Draft.total));
  if(window.__lastTot!==undefined && window.__lastTot!==Draft.total && window.gsap && !navReduced()){ const tt=$('#t-tot'); if(tt) gsap.fromTo(tt,{scale:1.14},{scale:1,duration:.28,ease:'back.out(2)',clearProps:'transform'}); }
  window.__lastTot = Draft.total;
  const tot = Number(Draft.total)||0, sp = Number(Draft.signalPct)||0;
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
    Draft.payMethod=$('#f-paymethod').value; Draft.payParcels=Math.min(21,Math.max(1,Number($('#f-parcels').value||1))); Draft.payment=Draft.payMethod;
    Draft.signalPct=Number($('#f-signal').value||0); Draft.notes=$('#f-notes').value;
    Draft.discount=Number($('#f-desc').value||0); Draft.discountType=$('#f-desct').value; Draft.displacement=Number($('#f-desloc').value||0);
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
    <table class="table-maya"><tr><th>Descrição</th><th>Qtd</th><th>Unit</th><th>Total</th></tr>
    ${(Draft.items||[]).map(it=>`<tr><td>${esc(it.desc||'-')}</td><td>${esc(it.qty)} ${esc(it.unitLabel||'')}</td><td>${brl(it.unit)}</td><td class="font-bold">${brl((Number(it.qty)||0)*(Number(it.unit)||0))}</td></tr>`).join('')}</table>
    ${Number(Draft.displacement)>0?`<div class="text-xs mt-2 text-right" style="color:#555">Taxa de deslocamento: ${brl(Draft.displacement)}</div>`:''}
    <div class="pp-totalbox"><span class="text-sm" style="color:#1A5D1A">VALOR TOTAL&nbsp;&nbsp;</span><span class="pp-total">${brl(Draft.total)}</span></div>
    <div class="text-xs mt-1" style="color:#555">Pagamento: ${esc(payLabel(Draft))} ${Draft.signalPct?`• Sinal ${esc(Draft.signalPct)}% (${brl(Draft.total*Number(Draft.signalPct)/100)}) • Saldo na conclusão (${brl(Draft.total*(1-Number(Draft.signalPct)/100))})`:''}</div>
    ${Draft.notes?`<div class="text-xs mt-1" style="color:#333"><b>Obs:</b> ${esc(Draft.notes)}</div>`:''}
    <div class="text-xs mt-2" style="color:#777">${esc(st.headerText)} ${st.pix?`• Pix: ${esc(st.pix)}`:''}</div>`;
}
function paintPreview(){
  if(!Draft) return; collectSilent(); recalcDraft();
  paintPreviewOnly(); paintItems();
}

function shrinkPhoto(src, max, q){
  return new Promise(res=>{ const img=new Image();
    img.onload=()=>{ try{ const sc=Math.min(1,max/Math.max(img.width||1,img.height||1));
      const c=document.createElement('canvas'); c.width=Math.max(1,Math.round(img.width*sc)); c.height=Math.max(1,Math.round(img.height*sc));
      c.getContext('2d').drawImage(img,0,0,c.width,c.height); res(c.toDataURL('image/jpeg',q||0.6));
    }catch(e){ res(src); } };
    img.onerror=()=>res(src); img.src=src; });
}
window.saveDraft = async (isEdit)=>{
  collectEditor();
  if(!Draft.client.name){ toast('Preencha o nome do cliente'); $('#f-name').focus(); return; }
  if(!(Draft.items||[]).some(it=>String(it.desc).trim() && Number(it.unit)>0)){ toast('Adicione ao menos 1 item com valor'); return; }
  window._dirty=false;
  const all = Store.budgets||[];
  const ix = all.findIndex(b=>b.id===Draft.id);
  Draft.updatedAt = new Date().toISOString();
  if(ix>=0) all[ix]=structuredClone(Draft); else all.push(structuredClone(Draft));
  try{ Store.budgets = all; }
  catch(e){
    try{ // sem espaço: otimiza as fotos e tenta de novo sozinho
      for(const p of (Draft.photos||[])){ p.src = await shrinkPhoto(p.src, 600, 0.55); }
      const ix2 = all.findIndex(b=>b.id===Draft.id);
      if(ix2>=0) all[ix2]=structuredClone(Draft); else all.push(structuredClone(Draft));
      Store.budgets = all; paintPhotos(); toast('Espaço otimizado e salvo!');
    }catch(e2){ toast('Sem espaço: remova fotos e tente de novo.'); return; }
  }
  // upsert cliente
  const cs = Store.clients||[];
  if(Draft.client.name && !cs.some(c=>c.name.toLowerCase()===Draft.client.name.toLowerCase())){ cs.push({id:Store.uid(),...Draft.client}); Store.clients=cs; }
  toast('Orçamento salvo!');
  if(window.gsap) gsap.fromTo('.budget-paper',{scale:.99},{scale:1,duration:.3});
  location.hash = '#/orcamentos';
};
window.pickClient = id=>{ const c=(Store.clients||[]).find(x=>x.id===id); if(!c||!Draft) return; Draft.client={name:c.name,phone:c.phone||'',address:c.address||''}; $('#f-name').value=c.name; $('#f-phone').value=c.phone||''; $('#f-addr').value=c.address||''; paintPreview(); };
window.saveClientFromDraft = ()=>{ collectSilent(); if(!Draft.client.name) return toast('Nome vazio'); const cs=Store.clients||[]; cs.push({id:Store.uid(),...Draft.client}); Store.clients=cs; toast('Cliente salvo!'); };

window.doPDF = async ()=>{ collectSilent(); recalcDraft(); if(!Draft.client.name){ toast('Preencha cliente antes do PDF'); return; } toast('Gerando PDF com marca d\'água…'); await gerarPDF(Draft); };
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
  num:(id,l,v,step)=>`<label>${l}<input type="number" step="${step||'any'}" class="maya-input" id="${id}" value="${esc(v??'')}"></label>`,
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
window.CalcTipo = 'manutencao';
window.CalcNivel = 'essencial';
window.openCalc = (itemIndex)=>{
  CalcSel = (itemIndex===null||itemIndex===undefined)? null : Number(itemIndex);
  const st = Store.settings;
  if(!CALC_OPTS.some(o=>o.v===window.CalcTipo)) window.CalcTipo='manutencao';
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
      <input type="number" id="c-size" class="calc-size" value="50" min="0">
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
      <label class="font-bold">Insumos R$<input type="number" id="c-ins" class="maya-input" value="80"></label>
      <label class="font-bold">Desloc. R$<input type="number" id="c-des" class="maya-input" value="${esc(st.displacementDefault)}"></label>
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
window.calcSize = d=>{ const i=$('#c-size'); if(!i) return; const o=calcOpt(); const step = o.unit==='horas'?1:5; i.value = Math.max(0, (Number(i.value)||0) + d*step); };
window.calcNow = ()=>{
  const o = calcOpt();
  const nivelMap = {essencial:'simples', padrao:'medio', premium:'premium'};
  const size = Number(($('#c-size')||{}).value||0);
  const inp = {tipo:o.tipo, freq:($('#c-freq')||{}).value||'mensal', complexidade:nivelMap[window.CalcNivel]||'simples',
    insumos:Number(($('#c-ins')||{}).value||0), desloc:Number(($('#c-des')||{}).value||0)};
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
    <input id="q" class="maya-input !w-56" placeholder="Buscar cliente/nº…" oninput="renderList()">
    <select id="f" class="maya-select !w-40" onchange="renderList()"><option value="">todos status</option>${['pendente','aprovado','recusado','expirado'].map(s=>`<option>${s}</option>`).join('')}</select>
    <a href="#/novo" class="maya-btn text-sm">+ Novo</a></div>
  <div id="list" class="grid md:grid-cols-2 gap-3"></div>`;
}
window.renderList = ()=>{
  sweepExpired();
  const q = ($('#q')?.value||'').toLowerCase(), f = $('#f')?.value||'';
  let arr = [...(Store.budgets||[])].sort((a,b)=>String(b.createdAt).localeCompare(String(a.createdAt)));
  if(q) arr = arr.filter(b=>(b.client?.name+' '+b.number).toLowerCase().includes(q));
  if(f) arr = arr.filter(b=>effStatus(b)===f);
  $('#list').innerHTML = arr.map(b=>{const es=effStatus(b); return `<div class="maya-card p-4 anim-in" style="opacity:1">
    <div class="flex items-center gap-2"><b>Nº ${esc(b.number)}</b><span class="maya-badge b-${es}">${es}</span>${b.contractId?'<span class="maya-badge b-aprovado">recorrente</span>':''}<div class="flex-1"></div><b class="text-[#1A5D1A]">${brl(b.total)}</b></div>
    <div class="text-sm mt-1">${esc(b.client?.name)} • ${esc(b.client?.phone||'')} • ${fmtDate(b.date)} → ${fmtDate(b.validity)}</div>
    ${b.status==='aprovado'?(()=>{const pt=paidTotal(b), tt=Number(b.total)||0, pc=tt>0?Math.min(100,100*pt/tt):0; return `<div class="flex items-center gap-2 mt-1 text-xs"><div class="p-track flex-1"><div class="p-bar" style="width:${pc.toFixed(0)}%"></div></div><b>${paidStatus(b)==='pago'?'pago':('recebido '+brl(pt)+' de '+brl(tt))}</b></div>`;})():''}
    <div class="flex gap-1 mt-2 flex-wrap text-xs">
      <a class="maya-btn-ghost px-2 py-1" href="#/editar/${b.id}">Editar</a>
      <button class="maya-btn-ghost px-2 py-1" onclick="dupBudget('${b.id}')">⧉ Duplicar</button>
      <button class="maya-btn-ghost px-2 py-1" onclick="pdfBudget('${b.id}')">PDF</button>
      <button class="maya-btn-ghost px-2 py-1" onclick="printOS('${b.id}')">OS</button>
      <button class="maya-btn-ghost px-2 py-1" onclick="zapBudget('${b.id}')">Copiar</button>
      <button class="maya-btn-ghost px-2 py-1" onclick="openZapBudget('${b.id}')">WhatsApp</button>
      <button class="maya-btn-ghost px-2 py-1" onclick="billOS('${b.id}')">Gerar OS</button>
      <select class="maya-select !w-32 !py-1 text-xs" onchange="setStatus('${b.id}',this.value)">${['pendente','aprovado','recusado','expirado'].map(s=>`<option ${b.status===s?'selected':''}>${s}</option>`).join('')}</select>
      <button class="maya-btn-ghost px-2 py-1 !text-red-700 !border-red-300" onclick="delBudget('${b.id}')">Excluir</button>
    </div></div>`;}).join('') || emptyState('Nada por aqui','Nenhum orçamento com este filtro. Crie o primeiro em segundos.','Novo orçamento','#/novo');
  if(window.gsap) gsap.fromTo('#list > div',{y:12,opacity:0},{y:0,opacity:1,duration:.35,stagger:.04,clearProps:'transform'});
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
  const cats=[...new Set(Store.catalog.map(c=>c.cat))];
  return `<div class="flex items-center gap-2 mb-2 anim-in"><h1 class="text-2xl font-black">Catálogo (tudo editável)</h1><div class="flex-1"></div><button class="maya-btn text-sm" onclick="addCat()">+ Novo item</button><button class="maya-btn-ghost text-sm" onclick="resetCat()">↺ Restaurar padrão</button></div>
  <p class="text-sm text-gray-600 mb-3 anim-in">Troque nome, descrição, unidade e preço. Usado para puxar no orçamento e na dica.</p>
  <div class="maya-card p-3 mb-3 anim-in" style="opacity:1"><div class="flex items-center gap-2 mb-1"><div class="font-extrabold" style="color:var(--maya-accent)">Pacotes prontos</div><div class="flex-1"></div><button class="maya-btn text-xs" onclick="addPackage()">+ Novo pacote</button></div>
  ${(Store.packages||[]).map(p=>`<div class="flex items-center gap-2 border-b py-1 text-sm" style="border-color:var(--line)"><div class="flex-1"><b>${esc(p.name)}</b><div class="text-xs" style="color:var(--muted)">${esc(p.desc||'')} • ${pl(p.items.length,'item','itens')} • <b style="color:var(--maya-accent)">${brl(packTotal(p))}</b></div></div><button class="maya-btn-ghost text-xs" onclick="editPackage('${p.id}')">Editar</button><button class="maya-btn-ghost text-xs !text-red-700" onclick="delPackage('${p.id}')">Excluir</button></div>`).join('')||'<p class="text-xs" style="color:var(--muted)">Nenhum pacote.</p>'}</div>
  ${cats.map(cat=>`<div class="maya-card p-3 mb-3 anim-in" style="opacity:1"><div class="font-extrabold text-[#1A5D1A] mb-1">${esc(cat)}</div>
  ${Store.catalog.filter(c=>c.cat===cat).map(c=>`<div class="grid md:grid-cols-6 gap-1 items-center border-b py-1 text-sm">
    <input class="maya-input md:col-span-2" value="${esc(c.name)}" onchange="updCat('${c.id}','name',this.value)">
    <input class="maya-input md:col-span-2" value="${esc(c.desc||'')}" onchange="updCat('${c.id}','desc',this.value)">
    <input class="maya-input" value="${esc(c.unit)}" onchange="updCat('${c.id}','unit',this.value)">
    <input type="number" class="maya-input" value="${esc(c.price)}" onchange="updCat('${c.id}','price',this.value)">
    <button class="maya-btn-ghost text-xs" onclick="delCat('${c.id}')">Excluir</button></div>`).join('')}</div>`).join('')}`;
}
window.updCat=(id,f,v)=>{ const a=Store.catalog; const c=a.find(x=>x.id===id); c[f]=(f==='price'?Number(v)||0:v); Store.catalog=a; toast('Catálogo atualizado'); };
window.delCat=async id=>{ if(!await confirmModal('Excluir item','Remover este item do catálogo?'))return; Store.catalog=Store.catalog.filter(c=>c.id!==id); render(); };
window.addCat=()=>{ const cats=[...new Set(Store.catalog.map(c=>c.cat))];
  openModal('Novo item do catálogo', MF.sel('ct-cat','Categoria',[...cats,'+ Nova categoria…'],cats[0])+MF.text('ct-catnew','Nova categoria (se escolheu + Nova)','','Ex: Irrigação')+MF.text('ct-name','Serviço *','','Ex: Poda de cerca-viva')+MF.area('ct-desc','Descrição','',2)+`<div class="f-row2">`+MF.text('ct-unit','Unidade','un')+MF.num('ct-price','Preço R$ *',100)+`</div>`, ()=>{
    let cat=mv('ct-cat'); if(cat==='+ Nova categoria…') cat=mv('ct-catnew'); if(!cat) return 'Informe a categoria.';
    const name=mv('ct-name'); if(!name) return 'Informe o nome do serviço.';
    const price=Number(mv('ct-price'))||0; if(price<=0) return 'Informe um preço maior que zero.';
    const a=Store.catalog; a.push({id:Store.uid(),cat,name,desc:mv('ct-desc'),unit:mv('ct-unit')||'un',price}); Store.catalog=a; render(); toast('Item adicionado!'); return true;
  }); };
window.resetCat=async ()=>{ if(!await confirmModal('Restaurar catálogo','Voltar à tabela padrão 2026? Suas alterações serão perdidas.','Restaurar'))return; localStorage.removeItem('maya_catalog_v1'); render(); };

/* ---------- agenda ---------- */
function viewAgendaLegacy(){
  const vs=[...(Store.visits||[])].sort((a,b)=>String(a.date).localeCompare(String(b.date)));
  return `<div class="flex items-center gap-2 mb-3 anim-in"><h1 class="text-2xl font-black">Agenda / Visitas</h1><div class="flex-1"></div><button class="maya-btn text-sm" onclick="addVisit()">+ Agendar</button></div>
  <div class="grid md:grid-cols-2 gap-3">${vs.map(v=>`<div class="maya-card p-4 anim-in" style="opacity:1"><b>${fmtDate(v.date)} ${esc(v.time||'')}</b> — ${esc(v.client)}<div class="text-sm text-gray-600">${esc(v.service)} • ${v.price?brl(v.price):''} • ${esc(v.status||'agendada')}</div>
  <div class="flex gap-1 mt-2 text-xs"><button class="maya-btn-ghost px-2 py-1" onclick="toggleVisit('${v.id}')">✓ concluir</button><button class="maya-btn-ghost px-2 py-1 !text-red-700" onclick="delVisit('${v.id}')">Excluir</button></div></div>`).join('')||'<p class="text-gray-600">Nenhuma visita. Agende avaliação, manutenção, replantio…</p>'}</div>`;
}
window.addVisit=()=>{ openModal('Agendar visita', MF.text('av-client','Cliente *','','Nome do cliente')+`<div class="f-row2">`+MF.date('av-date','Data',todayISO())+MF.time('av-time','Hora','09:00')+`</div>`+MF.text('av-service','Serviço','Visita avaliação')+MF.num('av-price','Valor previsto R$',0), ()=>{
    const client=mv('av-client'); if(!client) return 'Informe o cliente.';
    const a=Store.visits; a.push({id:Store.uid(),client,date:mv('av-date')||todayISO(),time:mv('av-time'),service:mv('av-service'),price:Number(mv('av-price'))||0,status:'agendada'}); Store.visits=a; render(); toast('Visita agendada!'); return true;
  }); };
window.toggleVisit=id=>{ const a=Store.visits; const v=a.find(x=>x.id===id); v.status=v.status==='concluída'?'agendada':'concluída'; Store.visits=a; render(); };
window.delVisit=async id=>{ if(!await confirmModal('Excluir visita','Remover esta visita da agenda?'))return; Store.visits=Store.visits.filter(v=>v.id!==id); render(); };

/* ---------- config e acessos ---------- */
function viewAdmin(){
  if(!window.MayaAuth?.isAdmin()) return `<h1 class="text-2xl font-black mb-3">Administração</h1><div class="maya-card p-4"><b>Acesso restrito</b><p class="text-sm mt-1">Somente o administrador pode gerenciar logins, perfis e expirações.</p></div>`;
  return `<h1 class="text-2xl font-black mb-3 anim-in">Administração de acessos</h1><p class="text-sm mb-3" style="color:var(--muted)">Controle quem entra no sistema. Deixe a data vazia para um acesso infinito.</p>${window.CloudSync?.adminHtml?window.CloudSync.adminHtml():'<div class="maya-card p-4">Carregando acessos…</div>'}`;
}
function viewConfig(){
  const st=Store.settings, p=Store.pricing, write=window.MayaAuth?.canWrite?.()!==false, disabled=write?'':'disabled';
  return `<h1 class="text-2xl font-black mb-3 anim-in">Configurações</h1>
  <div class="maya-card p-4 mb-3 anim-in" style="opacity:1"><div class="flex items-center gap-3 flex-wrap"><div class="flex-1"><b>Sessão atual</b><div class="text-xs" style="color:var(--muted)">O sistema exige login e guarda os dados compartilhados na nuvem.</div></div></div><div class="mt-3">${window.CloudSync?.accountHtml?window.CloudSync.accountHtml():'Carregando sessão…'}</div></div>
  <div class="grid lg:grid-cols-2 gap-3">
  <div class="maya-card p-4 anim-in" style="opacity:1"><h2 class="font-extrabold mb-2">Empresa (sai no PDF)</h2>
    <div class="grid grid-cols-2 gap-2 text-sm">
    ${[['company','Empresa'],['tagline','Slogan'],['cnpj','CNPJ (opcional)'],['email','E-mail'],['whatsappDisplay','Whats exibição'],['whatsappLink','Whats link (só números c/ DDI)'],['instagram','Instagram'],['address','Endereço'],['pix','Pix'],['headerText','Texto validade'],['footerText','Texto rodapé']].map(([k,l])=>`<label class="font-bold ${k==='headerText'||k==='footerText'||k==='tagline'?'col-span-2':''}">${l}<input ${disabled} class="maya-input" id="s-${k}" value="${esc(st[k]||'')}"></label>`).join('')}
    <label class="font-bold col-span-2">Condições e termos (saem no PDF)<textarea ${disabled} id="s-terms" class="maya-textarea" rows="3">${esc(st.terms||'')}</textarea></label>
    <label class="font-bold col-span-2">Modelo msg WhatsApp <span class="font-normal" style="color:var(--muted)">({nome} {numero} {total} {validade} {empresa})</span><textarea ${disabled} id="s-zapTemplate" class="maya-textarea" rows="2">${esc(st.zapTemplate||'')}</textarea></label>
    <label class="font-bold col-span-2">Modelo msg retorno <span class="font-normal" style="color:var(--muted)">({nome} {numero} {total} {dias} {empresa})</span><textarea ${disabled} id="s-zapFollow" class="maya-textarea" rows="2">${esc(st.zapFollow||'')}</textarea></label>
    <label class="font-bold">Validade padrão dias<input ${disabled} type="number" id="s-validityDays" class="maya-input" value="${esc(st.validityDays)}"></label>
    <label class="font-bold">Sinal padrão %<input ${disabled} type="number" id="s-signalPct" class="maya-input" value="${esc(st.signalPct)}"></label>
    <label class="font-bold">Desloc padrão R$<input ${disabled} type="number" id="s-displacementDefault" class="maya-input" value="${esc(st.displacementDefault)}"></label>
    </div>
    <div class="mt-2 text-sm grid grid-cols-3 gap-2">
      <label class="font-bold">Opacidade marca<input ${disabled} type="number" step="0.01" min="0" max="0.3" id="s-wmOpacity" class="maya-input" value="${esc(st.wmOpacity)}"></label>
      <label class="font-bold">Tamanho %<input ${disabled} type="number" id="s-wmSizePct" class="maya-input" value="${esc(st.wmSizePct)}"></label>
      <label class="font-bold">Marca ON?<select ${disabled} id="s-wmEnabled" class="maya-select"><option value="1" ${st.wmEnabled?'selected':''}>sim</option><option value="0" ${!st.wmEnabled?'selected':''}>não</option></select></label>
    </div>
    <button ${disabled} class="maya-btn mt-3" onclick="saveSettings()">Salvar empresa</button>
  </div>
  <div class="maya-card p-4 anim-in" style="opacity:1"><h2 class="font-extrabold mb-2">Tabela de referência (dica de preço)</h2>
    <div class="grid grid-cols-3 gap-2 text-sm">
    ${Object.entries({marginPct:'Margem %',horaMin:'Hora mín',horaIdeal:'Hora ideal',horaMax:'Hora máx',m2ManutMin:'Manut m² mín',m2ManutIdeal:'Manut ideal',m2ManutMax:'Manut máx',m2ImplMin:'Impl mín',m2ImplIdeal:'Impl ideal',m2ImplMax:'Impl máx',projetoM2Min:'Proj mín',projetoM2Ideal:'Proj ideal',projetoM2Max:'Proj máx',vasoMin:'Vaso mín',vasoIdeal:'Vaso ideal',vasoMax:'Vaso máx',visitaOrqMin:'Visita orq mín',visitaOrqIdeal:'Visita ideal',visitaOrqMax:'Visita máx',orquidarioMin:'Orquid mín',orquidarioIdeal:'Orquid ideal',orquidarioMax:'Orquid máx'}).map(([k,l])=>`<label class="font-bold">${l}<input ${disabled} type="number" step="any" id="p-${k}" class="maya-input" value="${esc(p[k])}"></label>`).join('')}
    </div>
    <button ${disabled} class="maya-btn mt-3" onclick="savePricing()">Salvar tabela</button>
    ${write?'<div class="mt-4 border-t pt-2 text-sm"><b class="text-red-700">Zona de perigo</b><div class="flex gap-2 mt-1 flex-wrap"><button class="maya-btn-ghost text-sm" onclick="seedSample()">Dados exemplo</button><button class="maya-btn-ghost text-sm !text-red-700 !border-red-300" onclick="confirmReset()">Apagar tudo</button></div></div>':'<div class="mt-4 text-xs" style="color:var(--muted)">Perfil visitante: somente visualização.</div>'}
  </div></div>`;
}
window.confirmReset=async ()=>{ if(!window.MayaAuth?.canWrite?.()){ toast('Acesso somente para visualização.'); return; } if(!await confirmModal('Apagar tudo','Todos os dados compartilhados serão apagados da nuvem. Deseja continuar?','Apagar tudo'))return; Store.resetAll(); await window.CloudSync?.pushLocal?.(false); location.hash='#/'; location.reload(); };
window.saveSettings=()=>{
  if(!window.MayaAuth?.canWrite?.()){ toast('Acesso somente para visualização.'); return; }
  const st=Store.settings;
  ['company','tagline','cnpj','email','whatsappDisplay','whatsappLink','instagram','address','pix','headerText','footerText','terms','zapTemplate','zapFollow'].forEach(k=>st[k]=$('#s-'+k).value);
  st.validityDays=Number($('#s-validityDays').value||15); st.signalPct=Number($('#s-signalPct').value||50); st.displacementDefault=Number($('#s-displacementDefault').value||0);
  st.wmOpacity=Number($('#s-wmOpacity').value||0.09); st.wmSizePct=Number($('#s-wmSizePct').value||60); st.wmEnabled=$('#s-wmEnabled').value==='1';
  Store.settings=st; toast('Empresa salva!'); render();
};
window.savePricing=()=>{ if(!window.MayaAuth?.canWrite?.()){ toast('Acesso somente para visualização.'); return; } const p=Store.pricing; $$('[id^="p-"]').forEach(i=>{ p[i.id.slice(2)]=Number(i.value)||0; }); Store.pricing=p; toast('Tabela salva!'); };

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
