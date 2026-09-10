/* MAYA Garden Pro — gráficos, recorrentes, relatórios, calendário, cliente 360 */
function fmtD(iso){ try{ const p=String(iso||'').slice(0,10).split('-'); return p.length===3?`${p[2]}/${p[1]}/${p[0]}`:String(iso||''); }catch{ return String(iso||''); } }
function monthKey(iso){ return String(iso||'').slice(0,7); }
function pl(n, one, many, fem){ n=Math.round(Number(n)||0); if(n<=1) return (n===0?(fem?'nenhuma ':'nenhum '):'1 ')+one; return n+' '+many; }
function heroDate(){ try{ const s=new Date().toLocaleDateString('pt-BR',{weekday:'long',day:'numeric',month:'long'}).toLowerCase(); return s.charAt(0).toUpperCase()+s.slice(1); }catch(e){ return ''; } }
function addMonths(iso,n){ const d=new Date(String(iso).slice(0,10)+'T12:00:00'); d.setMonth(d.getMonth()+Number(n||0)); return d.toISOString().slice(0,10); }
function effStatus(b){ if(!b) return '-'; if(b.status==='pendente' && b.validity && String(b.validity)<todayISO()) return 'expirado'; return b.status; }
function sweepExpired(){ let ch=false; const a=Store.budgets||[]; const t=todayISO(); a.forEach(b=>{ if(b.status==='pendente'&&b.validity&&String(b.validity)<t){ b.status='expirado'; ch=true; } }); if(ch) Store.budgets=a; migrateDicaMaya(); return ch; }
function migrateDicaMaya(){ let ch=false; const a=Store.budgets||[];
  a.forEach(b=>{(b.items||[]).forEach(it=>{ if(/dica\s*maya/i.test(String(it.desc||''))){ it.desc='Serviço contratado'; ch=true; } });});
  if(ch) Store.budgets=a; }
function zapFill(b){ const st=Store.settings;
  return String(st.zapTemplate||'Olá {nome}! Aqui é {empresa} Orçamento Nº {numero}: {total} válido até {validade}. Segue PDF em anexo.')
    .replaceAll('{nome}', b.client?.name||'').replaceAll('{numero}', b.number||'').replaceAll('{total}', brl(b.total))
    .replaceAll('{validade}', fmtD(b.validity)).replaceAll('{empresa}', st.company||'MAYA Garden');
}
function mrrTotal(){ return (Store.contracts||[]).filter(c=>c.active!==false).reduce((s,c)=>s+Number(c.value||0),0); }
function paidTotal(b){ return ((b&&b.paid&&b.paid.entries)||[]).reduce((s,e)=>s+Number(e.value||0),0); }
function paidRemaining(b){ return Math.max(0, Number(b.total||0)-paidTotal(b)); }
function paidStatus(b){ const r=paidRemaining(b); if(Number(b.total||0)<=0) return 'aberto'; if(r<=0.009) return 'pago'; return paidTotal(b)>0?'parcial':'aberto'; }
function ageDays(b){ try{ return Math.floor((Date.now()-new Date(b.createdAt||b.date).getTime())/86400000); }catch{ return 0; } }
function needsFollow(b){ return b.status==='pendente' && effStatus(b)==='pendente' && ageDays(b)>=5; }
function zapFollowFill(b){ const st=Store.settings;
  return String(st.zapFollow||'Olá {nome}! Aqui é {empresa}. O orçamento Nº {numero} ({total}) segue em aberto há {dias} dias. Posso ajudar com alguma dúvida?')
    .replaceAll('{nome}', b.client?.name||'').replaceAll('{numero}', b.number||'').replaceAll('{total}', brl(b.total))
    .replaceAll('{dias}', ageDays(b)).replaceAll('{empresa}', st.company||'MAYA Garden');
}
window.copyFollow=id=>{ const b=(Store.budgets||[]).find(x=>x.id===id); if(!b) return; navigator.clipboard?.writeText(zapFollowFill(b)).then(()=>toast('Mensagem de retorno copiada!')); };
function lastMonths(n){ const out=[]; const d=new Date(); d.setDate(1);
  for(let i=n-1;i>=0;i--){ const t=new Date(d.getFullYear(), d.getMonth()-i, 1);
    out.push({key:`${t.getFullYear()}-${String(t.getMonth()+1).padStart(2,'0')}`, label:t.toLocaleDateString('pt-BR',{month:'short'}).replace('.','')}); }
  return out;
}
function svgBars(data){
  const max = Math.max(1, ...data.map(d=>d.v));
  const W=320,H=170,pad=26,bw=Math.min(34,(W-pad*2)/data.length-8);
  let s=`<svg viewBox="0 0 ${W} ${H}" class="w-full">`;
  data.forEach((d,i)=>{ const h=Math.max(3,(H-52)*d.v/max); const x=pad+i*((W-pad*2)/data.length)+( ((W-pad*2)/data.length)-bw)/2; const y=H-30-h;
    s+=`<rect class="chart-bar" x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${bw}" height="${h.toFixed(1)}" rx="5" fill="url(#gbar)"><title>${esc(d.l)}: ${brl(d.v)}</title></rect>`;
    if(d.v>0) s+=`<text x="${(x+bw/2).toFixed(1)}" y="${(y-5).toFixed(1)}" text-anchor="middle" font-size="9" fill="#8FD694" font-weight="bold">${d.v>=1000?(d.v/1000).toFixed(1).replace('.',',')+'k':Math.round(d.v)}</text>`;
    s+=`<text x="${(x+bw/2).toFixed(1)}" y="${H-14}" text-anchor="middle" font-size="9" fill="#9DB8A3">${esc(d.l)}</text>`; });
  return `<defs><linearGradient id="gbar" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#4CAF50"/><stop offset="1" stop-color="#1E5B24"/></linearGradient></defs>`+s+`</svg>`;
}
function svgDonut(segs){
  const R=52,C=2*Math.PI*R; let off=0, arcs='';
  segs.forEach(g=>{ const frac=g.tot>0?g.v/g.tot:0; const len=frac*C;
    arcs+=`<circle class="donut-seg" cx="70" cy="70" r="${R}" fill="none" stroke="${g.c}" stroke-width="18" stroke-dasharray="${len.toFixed(1)} ${C.toFixed(1)}" data-draw="${len.toFixed(1)} ${C.toFixed(1)}" data-c="${C.toFixed(1)}" stroke-dashoffset="${(-off).toFixed(1)}" transform="rotate(-90 70 70)" stroke-linecap="butt"><title>${esc(g.l)}: ${g.v}</title></circle>`; off+=len; });
  return `<div class="flex items-center gap-3"><svg viewBox="0 0 140 140" class="w-32 h-32 shrink-0">${arcs}<text x="70" y="66" text-anchor="middle" font-size="20" font-weight="900" fill="#E9F2E9" class="donut-total" data-v="${segs.reduce((s,g)=>s+g.v,0)}">${segs.reduce((s,g)=>s+g.v,0)}</text><text x="70" y="84" text-anchor="middle" font-size="10" fill="#9DB8A3">orçamentos</text></svg>
  <div class="text-xs space-y-1">${segs.map(g=>`<div class="flex items-center gap-2"><span class="inline-block w-3 h-3 rounded" style="background:${g.c}"></span><b>${g.v}</b>&nbsp;${esc(g.l)}</div>`).join('')}</div></div>`;
}

/* ---------- DASHBOARD PRO ---------- */
function dashProHTML(){
  sweepExpired();
  const budgets=Store.budgets||[], visits=Store.visits||[], contracts=(Store.contracts||[]).filter(c=>c.active!==false);
  const mk=monthKey(todayISO());
  const aprM=budgets.filter(b=>b.status==='aprovado'&&monthKey(b.date)===mk);
  const fatM=aprM.reduce((s,b)=>s+Number(b.total||0),0);
  const pend=budgets.filter(b=>effStatus(b)==='pendente');
  const pendV=pend.reduce((s,b)=>s+Number(b.total||0),0);
  const aprAll=budgets.filter(b=>b.status==='aprovado');
  const recT=aprAll.reduce((s,b)=>s+Number(b.total||0),0);
  const ticket=aprAll.length?recT/aprAll.length:0;
  const dec=budgets.filter(b=>['aprovado','recusado','expirado'].includes(b.status));
  const conv=dec.length?100*budgets.filter(b=>b.status==='aprovado').length/dec.length:0;
  const mrr=mrrTotal();
  const recMes=budgets.reduce((s,b)=>s+((b.paid?.entries)||[]).filter(e=>monthKey(e.date)===mk).reduce((s2,e)=>s2+Number(e.value||0),0),0);
  const aReceber=budgets.filter(b=>b.status==='aprovado').reduce((s,b)=>s+paidRemaining(b),0);
  const follows=budgets.filter(needsFollow).sort((a,b)=>String(a.createdAt||'').localeCompare(String(b.createdAt||'')));
  const months=lastMonths(6).map(m=>({l:m.label, v:budgets.filter(b=>b.status==='aprovado'&&monthKey(b.date)===m.key).reduce((s,b)=>s+Number(b.total||0),0)}));
  const stc=[['aprovado','Aprovados','#4CAF50'],['pendente','Pendentes','#FFD968'],['recusado','Recusados','#FF9B9B'],['expirado','Expirados','#8A94A6']]
    .map(([k,l,c])=>({l, c, v:budgets.filter(b=>effStatus(b)===k).length, tot:budgets.length}));
  const t=todayISO(), soon=addDays(t,7);
  const expiring=pend.filter(b=>b.validity&&b.validity>=t&&b.validity<=soon).sort((a,b)=>String(a.validity).localeCompare(String(b.validity)));
  const expired=(budgets||[]).filter(b=>b.status==='expirado').sort((a,b)=>String(b.validity).localeCompare(String(a.validity))).slice(0,4);
  const upcoming=visits.filter(v=>v.status!=='concluída'&&v.date>=t).sort((a,b)=>String(a.date).localeCompare(String(b.date))).slice(0,5);
  const toBill=contracts.filter(c=>monthKey(c.lastBilled||'2000-01')!==mk);
  const kpi=(l,id,v,money)=>`<div class="maya-card p-4 anim-in"><div class="text-xs font-bold" style="color:var(--muted)">${l}</div><div class="kpi-num" id="${id}">${money?brl(v):v}</div></div>`;
  const hr=new Date().getHours(), greet=hr<12?'Bom dia':hr<18?'Boa tarde':'Boa noite';
  const todayVs=visits.filter(v=>v.date===t&&v.status!=='concluída');
  const firstName=(Store.settings.company||'MAYA Garden').split(' ')[0];
  const heroSum=pl(pend.length,'orçamento ativo','orçamentos ativos')+' • '+pl(todayVs.length,'visita hoje','visitas hoje',true)+' • '+pl(toBill.length,'cobrança do mês','cobranças do mês',true);
  const heroHtml=`<div class="hero mb-3 anim-in"><span class="orb"></span><span class="orb"></span><span class="orb"></span><h1>${greet}!</h1><p>${heroDate()} — ${heroSum}.</p></div>`;
  return `
  ${heroHtml}
  ${!budgets.length?`<div class="maya-card p-5 mb-3 anim-in" style="border-color:#4CAF50">
    <div class="font-black text-lg">Bem-vindo à MAYA Garden Pro!</div>
    <p class="text-sm mb-2" style="color:var(--muted)">Crie seu primeiro orçamento ou carregue dados de exemplo para explorar.</p>
    <div class="flex gap-2 flex-wrap"><a href="#/novo" class="maya-btn text-sm">+ Novo orçamento</a><button class="maya-btn-ghost text-sm" onclick="seedSample()">Carregar exemplo</button></div></div>`:''}
  <div class="dashboard-kpis grid grid-cols-2 md:grid-cols-4 gap-2">
    ${kpi('Faturado no mês','k-fat',fatM,1)}${kpi('Recebido no mês','k-rec',recMes,1)}
    ${kpi('A receber','k-arec',aReceber,1)}${kpi('MRR recorrente','k-mrr',mrr,1)}
    ${kpi('Ticket médio','k-tick',ticket,1)}${kpi('Conversão','k-conv',Math.round(conv)+'%',0)}
    ${kpi('Potencial pendente','k-pend',pendV,1)}${kpi('Retomar contato','k-fol',follows.length,0)}
  </div>
  <div class="grid lg:grid-cols-5 gap-3 mt-3">
    <div class="maya-card p-4 anim-in lg:col-span-3"><h2 class="font-extrabold mb-1">Receita aprovada — últimos 6 meses</h2>${svgBars(months)}</div>
    <div class="maya-card p-4 anim-in lg:col-span-2"><h2 class="font-extrabold mb-1">Funil de orçamentos</h2>${svgDonut(stc)}</div>
  </div>
  <div class="grid lg:grid-cols-3 gap-3 mt-3">
    <div class="maya-card p-4 anim-in"><h2 class="font-extrabold mb-2">Validades</h2>
      ${expiring.length?expiring.map(b=>`<div class="flex items-center gap-2 text-sm border-b py-1" style="border-color:var(--line)"><div class="flex-1"><b>${esc(b.client?.name)}</b> <span style="color:var(--muted)">vence ${fmtD(b.validity)} • ${brl(b.total)}</span></div><button class="maya-btn-ghost text-xs px-2 py-1" onclick="dupBudget('${b.id}')">Renovar</button></div>`).join(''):'<p class="text-xs" style="color:var(--muted)">Nada vencendo em 7 dias. ✓</p>'}
      ${expired.length?`<div class="text-xs font-bold mt-2" style="color:var(--muted)">Vencidos recentes</div>`+expired.map(b=>`<div class="flex items-center gap-2 text-xs py-1"><div class="flex-1">${esc(b.client?.name)} • ${fmtD(b.validity)}</div><button class="maya-btn-ghost text-xs px-2 py-1" onclick="dupBudget('${b.id}')">Renovar</button></div>`).join(''):''}
    </div>
    <div class="maya-card p-4 anim-in"><h2 class="font-extrabold mb-2">Próximas visitas</h2>
      ${upcoming.length?upcoming.map(v=>`<div class="flex items-center gap-2 text-sm border-b py-1" style="border-color:var(--line)"><div class="flex-1"><b>${fmtD(v.date)}</b> ${esc(v.time||'')} — ${esc(v.client)}<div class="text-xs" style="color:var(--muted)">${esc(v.service||'')}</div></div><button class="maya-btn-ghost text-xs px-2 py-1" onclick="toggleVisit('${v.id}')">✓</button></div>`).join(''):'<p class="text-xs" style="color:var(--muted)">Sem visitas agendadas. <a class="font-bold" style="color:var(--maya-accent)" href="#/agenda">Agendar →</a></p>'}
    </div>
    <div class="maya-card p-4 anim-in"><h2 class="font-extrabold mb-2">Cobranças do mês</h2>
      ${contracts.length?contracts.map(c=>{const billed=monthKey(c.lastBilled||'2000-01')===mk;
        return `<div class="flex items-center gap-2 text-sm border-b py-1" style="border-color:var(--line)"><div class="flex-1"><b>${esc(c.client?.name||c.title)}</b><div class="text-xs" style="color:var(--muted)">${esc(c.title||'')} • ${brl(c.value)}/mês ${billed?'• <b style="color:var(--maya-accent)">cobrado ✓</b>':''}</div></div>${billed?'':`<button class="maya-btn text-xs px-2 py-1" onclick="billContract('${c.id}')">Gerar</button>`}</div>`;}).join(''):'<p class="text-xs" style="color:var(--muted)">Nenhum contrato ativo. <a class="font-bold" style="color:var(--maya-accent)" href="#/recorrentes">Criar →</a></p>'}
      ${toBill.length?`<div class="text-xs mt-1 font-bold" style="color:#FFD968">${pl(toBill.length,'cobrança pendente','cobranças pendentes',true)} este mês.</div>`:''}
    </div>
  </div>
  <div class="maya-card p-4 mt-3 anim-in"><h2 class="font-extrabold mb-2">Retomar contato <span class="text-xs font-normal" style="color:var(--muted)">pendentes há 5+ dias</span></h2>
    ${follows.length?follows.slice(0,5).map(b=>`<div class="flex items-center gap-2 text-sm border-b py-1" style="border-color:var(--line)"><div class="flex-1"><b>${esc(b.client?.name)}</b> <span style="color:var(--muted)">há ${ageDays(b)} dias • ${brl(b.total)}</span></div><button class="maya-btn-ghost text-xs px-2 py-1" onclick="copyFollow('${b.id}')">Copiar</button><button class="maya-btn-ghost text-xs px-2 py-1" onclick="openFollowZap('${b.id}')">WhatsApp</button><a class="maya-btn-ghost text-xs px-2 py-1" href="#/editar/${b.id}">Abrir</a></div>`).join(''):'<p class="text-xs" style="color:var(--muted)">Nenhum orçamento parado. Bom ritmo.</p>'}
  </div>
  <div class="maya-card p-4 mt-3 anim-in">
    <div class="flex items-center gap-2 flex-wrap"><h2 class="font-extrabold">Banco de dados da empresa</h2>
    <span class="maya-badge b-aprovado">nuvem protegida</span><div class="flex-1"></div>
    <span class="text-xs font-bold" id="spacetext" style="color:var(--muted)">calculando espaço…</span></div>
    <div class="p-track mt-2"><div class="p-bar" id="spacefill" style="width:2%"></div></div>
    <p class="text-xs mt-1" style="color:var(--muted)">Os dados ficam compartilhados na nuvem e aparecem conforme o perfil de acesso.</p>
  </div>`;
}
function dashAfter(){
  const budgets=Store.budgets||[], mk=monthKey(todayISO());
  const fat=budgets.filter(b=>b.status==='aprovado'&&monthKey(b.date)===mk).reduce((s,b)=>s+Number(b.total||0),0);
  const rec=budgets.reduce((s,b)=>s+((b.paid?.entries)||[]).filter(e=>monthKey(e.date)===mk).reduce((s2,e)=>s2+Number(e.value||0),0),0);
  const arec=budgets.filter(b=>b.status==='aprovado').reduce((s,b)=>s+paidRemaining(b),0);
  const pend=budgets.filter(b=>effStatus(b)==='pendente').reduce((s,b)=>s+Number(b.total||0),0);
  const apr=budgets.filter(b=>b.status==='aprovado');
  const tot=apr.reduce((s,b)=>s+Number(b.total||0),0);
  const map={'k-fat':fat,'k-rec':rec,'k-arec':arec,'k-mrr':mrrTotal(),'k-tick':apr.length?tot/apr.length:0,'k-pend':pend,'k-fol':budgets.filter(needsFollow).length};
  Object.entries(map).forEach(([id,v])=>{const e=document.getElementById(id); if(!e) return; if(id==='k-fol') e.textContent=v; else countUp(e,v); });
  document.querySelectorAll('.donut-total').forEach(el=>{ const v=Number(el.dataset.v||0); el.textContent='0'; if(window.gsap && !matchMedia('(prefers-reduced-motion: reduce)').matches){ const o={v:0}; gsap.to(o,{v,duration:.9,ease:'power2.out',delay:.25,onUpdate:()=>el.textContent=Math.round(o.v)}); } else el.textContent=v; });
  if(window.gsap && !matchMedia('(prefers-reduced-motion: reduce)').matches){
    document.querySelectorAll('.donut-seg').forEach((seg,i)=>{
      const full=seg.dataset.draw||seg.getAttribute('stroke-dasharray'), c=seg.dataset.c||'327';
      if(!full||full.startsWith('0 ')) return;
      gsap.fromTo(seg,{attr:{'stroke-dasharray':`0 ${c}`}},{attr:{'stroke-dasharray':full},duration:.9,delay:.15+i*.14,ease:'power3.out'});
    });
  }
  try{ paintSpace(); }catch(e){}
  if(window.gsap && !matchMedia('(prefers-reduced-motion: reduce)').matches){
    gsap.from('.chart-bar',{scaleY:0,duration:.7,stagger:.07,ease:'power3.out',clearProps:'transform'});
    gsap.from('.donut-seg',{opacity:0,duration:.6,stagger:.1,clearProps:'opacity'});
  }
}
function repAfter(){
  if(window.gsap && !matchMedia('(prefers-reduced-motion: reduce)').matches){
    gsap.from('.chart-bar',{scaleY:0,duration:.7,stagger:.07,ease:'power3.out',clearProps:'transform'});
  }
  document.querySelectorAll('.rep-n').forEach(el=>{
    const raw=Number(el.dataset.v||0), f=el.dataset.f;
    countUp(el, raw, f==='m'?brl : f==='p' ? (v=>Math.round(v)+'%') : (v=>Math.round(v)));
  });
}

/* ---------- CLIENTES PRO ---------- */
function clientsProHTML(q){
  const cs=Store.clients||[];
  const f=(q||'').toLowerCase();
  const arr=cs.filter(c=>!f||(c.name+' '+(c.phone||'')+' '+(c.address||'')).toLowerCase().includes(f))
    .sort((a,b)=>String(a.name).localeCompare(String(b.name)));
  return `<div class="flex items-center gap-2 mb-3 anim-in flex-wrap"><h1 class="text-2xl font-black">Clientes (${cs.length})</h1><div class="flex-1"></div>
    <input id="cq" class="maya-input !w-56" placeholder="Buscar…" value="${esc(q||'')}" oninput="renderClients(this.value)">
    <button class="maya-btn text-sm" onclick="addClient()">+ Novo</button></div>
  <div id="clist" class="grid md:grid-cols-2 gap-3">${arr.map(c=>{const bs=(Store.budgets||[]).filter(b=>b.client?.name===c.name);
    const ap=bs.filter(b=>b.status==='aprovado').reduce((s,b)=>s+Number(b.total||0),0);
    return `<div class="maya-card p-4 anim-in" style="opacity:1"><div class="flex items-center gap-2"><b>${esc(c.name)}</b><div class="flex-1"></div><span class="text-xs font-bold" style="color:var(--maya-accent)">LTV ${brl(ap)}</span></div>
    <div class="text-sm" style="color:var(--muted)">${esc(c.phone||'')} • ${esc(c.address||'')}</div>
    <div class="text-xs mt-1">${pl(bs.length,'orçamento','orçamentos')} • ${pl(bs.filter(b=>effStatus(b)==='pendente').length,'ativo','ativos')}</div>
    <div class="flex gap-1 mt-2 text-xs flex-wrap"><button class="maya-btn-ghost px-2 py-1" onclick="clientDetail('${c.id}')">Ver</button><button class="maya-btn-ghost px-2 py-1" onclick="newForClient('${c.id}')">+ Orçamento</button><button class="maya-btn-ghost px-2 py-1" onclick="editClient('${c.id}')">Editar</button></div></div>`;}).join('')||emptyState('Sem clientes','Cadastre para ver histórico e LTV de cada um.','Novo cliente',"addClient()")}</div>`;
}
window.renderClients=q=>{ const w=document.getElementById('clist'); if(!w) return; const tmp=document.createElement('div'); tmp.innerHTML=clientsProHTML(q); const nl=tmp.querySelector('#clist'); if(nl) w.innerHTML=nl.innerHTML; const s=document.getElementById('cq'); };
window.clientDetail=id=>{
  const c=(Store.clients||[]).find(x=>x.id===id); if(!c) return;
  const bs=(Store.budgets||[]).filter(b=>b.client?.name===c.name).sort((a,b)=>String(b.createdAt).localeCompare(String(a.createdAt)));
  const ap=bs.filter(b=>b.status==='aprovado').reduce((s,b)=>s+Number(b.total||0),0);
  const tot=bs.reduce((s,b)=>s+Number(b.total||0),0);
  const vs=(Store.visits||[]).filter(v=>v.client===c.name);
  openDrawer(`<h3 class="font-black text-lg">${esc(c.name)}</h3>
  <div class="text-sm mb-2" style="color:var(--muted)">Tel: ${esc(c.phone||'-')} • End: ${esc(c.address||'-')}</div>
  <div class="grid grid-cols-3 gap-2 text-center my-2">
    <div class="maya-card p-2"><div class="text-[11px]" style="color:var(--muted)">Orçamentos</div><div class="font-black">${bs.length}</div></div>
    <div class="maya-card p-2"><div class="text-[11px]" style="color:var(--muted)">Total orçado</div><div class="font-black">${brl(tot)}</div></div>
    <div class="maya-card p-2"><div class="text-[11px]" style="color:var(--muted)">LTV aprovado</div><div class="font-black" style="color:var(--maya-accent)">${brl(ap)}</div></div>
  </div>
  <div class="font-extrabold text-sm mb-1">Orçamentos</div>
  ${bs.length?bs.map(b=>`<div class="flex items-center gap-2 text-sm border-b py-1" style="border-color:var(--line)"><b>${esc(b.number)}</b><span class="maya-badge b-${effStatus(b)}">${effStatus(b)}</span><div class="flex-1"></div><b>${brl(b.total)}</b><a class="font-bold" style="color:var(--maya-accent)" href="#/editar/${b.id}" onclick="closeDrawer()">abrir</a></div>`).join(''):'<p class="text-xs" style="color:var(--muted)">Sem orçamentos.</p>'}
  <div class="font-extrabold text-sm mt-2 mb-1">Histórico (${pl(vs.length,'visita','visitas')})</div>
  ${vs.length?vs.map(v=>`<div class="text-xs py-1">${fmtD(v.date)} — ${esc(v.service||'')} (${esc(v.status||'')})</div>`).join(''):'<p class="text-xs" style="color:var(--muted)">Sem visitas.</p>'}
  <div class="flex gap-2 mt-3 flex-wrap"><button class="maya-btn text-sm" onclick="closeDrawer();newForClient('${c.id}')">+ Orçamento</button><button class="maya-btn-ghost text-sm" onclick="closeDrawer()">Fechar</button></div>`);
};

/* ---------- RECORRENTES ---------- */
function viewContracts(){
  const cs=[...(Store.contracts||[])].sort((a,b)=>String(a.client?.name||'').localeCompare(String(b.client?.name||'')));
  const mrr=mrrTotal();
  return `<div class="flex items-center gap-2 mb-1 anim-in flex-wrap"><h1 class="text-2xl font-black">Manutenção recorrente</h1><div class="flex-1"></div>
  <div class="maya-card px-3 py-1 text-sm">MRR <b style="color:var(--maya-accent)">${brl(mrr)}/mês</b></div>
  <button class="maya-btn text-sm" onclick="addContract()">+ Novo contrato</button></div>
  <p class="text-sm mb-3 anim-in" style="color:var(--muted)">Contratos mensais de manutenção. Gere a cobrança do mês em 1 clique.</p>
  <div class="grid md:grid-cols-2 gap-3">${cs.map(c=>{const billed=monthKey(c.lastBilled||'2000-01')===monthKey(todayISO());
    return `<div class="maya-card p-4 anim-in" style="opacity:1;${c.active===false?'opacity:.55':''}">
    <div class="flex items-center gap-2"><b>${esc(c.client?.name||c.title)}</b>${c.active===false?'<span class="maya-badge b-expirado">pausado</span>':''}<div class="flex-1"></div><b style="color:var(--maya-accent)">${brl(c.value)}/mês</b></div>
    <div class="text-sm" style="color:var(--muted)">${esc(c.title||'')} • desde ${fmtD(c.startDate)} ${c.lastBilled?`• última cobrança ${fmtD(c.lastBilled)}`:''}</div>
    ${c.notes?`<div class="text-xs mt-1">${esc(c.notes)}</div>`:''}
    <div class="flex gap-1 mt-2 text-xs flex-wrap">
      ${billed?'<span class="text-xs font-bold" style="color:var(--maya-accent)">✓ cobrado este mês</span>':`<button class="maya-btn px-2 py-1" onclick="billContract('${c.id}')">Gerar cobrança</button>`}
      <button class="maya-btn-ghost px-2 py-1" onclick="toggleContract('${c.id}')">${c.active===false?'Ativar':'Pausar'}</button>
      <button class="maya-btn-ghost px-2 py-1" onclick="editContract('${c.id}')">Editar</button>
      <button class="maya-btn-ghost px-2 py-1 !text-red-700" onclick="delContract('${c.id}')">Excluir</button>
    </div></div>`;}).join('')||emptyState('Sem contratos','Manutenções mensais geram receita todo mês.','Novo contrato',"addContract()")}</div>`;
}
window.addContract=()=>{ openModal('Novo contrato recorrente', MF.text('co-client','Cliente *','','Nome do cliente')+MF.text('co-title','Serviço recorrente','Manutenção mensal do jardim')+`<div class="f-row2">`+MF.num('co-value','Valor mensal R$ *',350)+MF.date('co-start','Início',todayISO())+`</div>`+`<div class="f-row2">`+MF.text('co-phone','WhatsApp','')+MF.text('co-addr','Endereço','')+`</div>`+MF.area('co-notes','Observações (ex: todo dia 5)','',2), ()=>{
    const name=mv('co-client'); if(!name) return 'Informe o cliente.';
    const value=Number(mv('co-value'))||0; if(value<=0) return 'Informe o valor mensal.';
    const a=Store.contracts; a.push({id:Store.uid(), client:{name,phone:mv('co-phone'),address:mv('co-addr')}, title:mv('co-title')||'Manutenção mensal', value, freq:'mensal', startDate:mv('co-start')||todayISO(), lastBilled:'', active:true, notes:mv('co-notes')});
    Store.contracts=a; const cs=Store.clients; if(!cs.some(c=>c.name.toLowerCase()===name.toLowerCase())){ cs.push({id:Store.uid(),name,phone:mv('co-phone'),address:mv('co-addr')}); Store.clients=cs; }
    render(); toast('Contrato criado!'); return true;
  }); };
window.editContract=id=>{ const a=Store.contracts, c=a.find(x=>x.id===id); if(!c) return;
  openModal('Editar contrato', MF.text('co-title','Serviço',c.title)+`<div class="f-row2">`+MF.num('co-value','Valor mensal R$',c.value)+MF.date('co-start','Início',c.startDate)+`</div>`+MF.area('co-notes','Observações',c.notes||'',2), ()=>{
    c.title=mv('co-title')||c.title; c.value=Number(mv('co-value'))||c.value; c.startDate=mv('co-start')||c.startDate; c.notes=mv('co-notes'); Store.contracts=a; render(); toast('Contrato atualizado!'); return true;
  }); };
window.toggleContract=id=>{ const a=Store.contracts, c=a.find(x=>x.id===id); c.active=c.active===false?true:false; Store.contracts=a; render(); };
window.delContract=async id=>{ if(!await confirmModal('Excluir contrato','O contrato será encerrado. Orçamentos já gerados serão mantidos.')) return; Store.contracts=Store.contracts.filter(c=>c.id!==id); render(); };
window.billContract=id=>{ const a=Store.contracts, c=a.find(x=>x.id===id); if(!c) return;
  const t=todayISO(); const ref=new Date().toLocaleDateString('pt-BR',{month:'long',year:'numeric'});
  const b=blankBudget(); b.client={...c.client}; b.items=[{desc:`${c.title} — ref. ${ref}`,qty:1,unitLabel:'mensalidade',unit:Number(c.value)||0}];
  b.notes='Cobrança de contrato de manutenção recorrente.'; b.contractId=c.id; recalcDraft2(b);
  const all=Store.budgets; all.push(b); Store.budgets=all; c.lastBilled=t; Store.contracts=a;
  toast(`Cobrança ${b.number} gerada!`); render(); };
function recalcDraft2(b){ b.subtotal=(b.items||[]).reduce((s,it)=>s+(Number(it.qty)||0)*(Number(it.unit)||0),0); b.discountVal=b.discountType==='pct'?b.subtotal*Number(b.discount||0)/100:Number(b.discount||0); b.total=Math.max(0,b.subtotal-b.discountVal+Number(b.displacement||0)); }

/* ---------- RELATÓRIOS ---------- */
function repSeen(){ try{ return localStorage.getItem('maya_rep_seen')==='1'; }catch(e){ return false; } }
window.RepMonths = window.RepMonths || 6;
function repData(){ const cut=addMonths(todayISO(), -window.RepMonths+1).slice(0,7);
  return (Store.budgets||[]).filter(b=>monthKey(b.date)>=cut); }
function viewReports(){
  try{ localStorage.setItem('maya_rep_seen','1'); }catch(e){}
  const arr=repData();
  const apr=arr.filter(b=>b.status==='aprovado'), rec=apr.reduce((s,b)=>s+Number(b.total||0),0);
  const dec=arr.filter(b=>['aprovado','recusado','expirado'].includes(b.status));
  const conv=dec.length?100*apr.length/dec.length:0;
  const descB=arr.filter(b=>Number(b.subtotal)>0);
  const descM=descB.length?100*descB.reduce((s,b)=>s+Number(b.discountVal||0),0)/descB.reduce((s,b)=>s+Number(b.subtotal||0),0):0;
  const recP=arr.reduce((s,b)=>s+((b.paid?.entries)||[]).reduce((s2,e)=>s2+Number(e.value||0),0),0);
  const arecT=(Store.budgets||[]).filter(b=>b.status==='aprovado').reduce((s,b)=>s+paidRemaining(b),0);
  const byCli={}; apr.forEach(b=>{const k=b.client?.name||'—'; byCli[k]=(byCli[k]||0)+Number(b.total||0);});
  const topCli=Object.entries(byCli).sort((a,b)=>b[1]-a[1]).slice(0,6);
  const bySvc={}; arr.forEach(b=>(b.items||[]).forEach(it=>{const k=String(it.desc||'—').slice(0,42); bySvc[k]=(bySvc[k]||0)+(Number(it.qty)||0)*(Number(it.unit)||0);}));
  const topSvc=Object.entries(bySvc).sort((a,b)=>b[1]-a[1]).slice(0,6);
  const months=lastMonths(window.RepMonths).map(m=>({l:m.label, v:arr.filter(b=>b.status==='aprovado'&&monthKey(b.date)===m.key).reduce((s,b)=>s+Number(b.total||0),0)}));
  const kpi=(l,v)=>`<div class="maya-card p-4 anim-in"><div class="text-xs font-bold" style="color:var(--muted)">${l}</div><div class="kpi-num">${v}</div></div>`;
  const kpiR=(l,raw,f)=>`<div class="maya-card p-4 anim-in"><div class="text-xs font-bold" style="color:var(--muted)">${l}</div><div class="kpi-num rep-n" data-v="${raw}" data-f="${f}">${f==='m'?brl(raw):f==='p'?raw+'%':Math.round(raw)}</div></div>`;
  return `<div class="flex items-center gap-2 mb-3 anim-in flex-wrap"><h1 class="text-2xl font-black">Relatórios</h1><div class="flex-1"></div>
    <select class="maya-select !w-44" onchange="window.RepMonths=Number(this.value);render()">${[3,6,12].map(m=>`<option value="${m}" ${window.RepMonths===m?'selected':''}>últimos ${m} meses</option>`).join('')}</select>
    <button class="maya-btn-ghost text-sm" onclick="exportBudgetsCSV()"> Orçamentos CSV</button>
    <button class="maya-btn-ghost text-sm" onclick="exportItemsCSV()"> Itens CSV</button></div>
  <div class="grid grid-cols-2 md:grid-cols-4 gap-2">
    ${kpiR('Receita aprovada',Math.round(rec),'m')}${kpiR('Recebido',Math.round(recP),'m')}${kpiR('A receber',Math.round(arecT),'m')}${kpiR('Orçamentos',arr.length,'n')}${kpiR('Conversão',Math.round(conv),'p')}${kpiR('Ticket médio',Math.round(apr.length?rec/apr.length:0),'m')}${kpi('Desconto médio',descM.toFixed(1).replace('.',',')+'%')}
  </div>
  <div class="maya-card p-4 mt-3 anim-in"><h2 class="font-extrabold mb-1">Receita por mês</h2>${svgBars(months)}</div>
  <div class="grid lg:grid-cols-2 gap-3 mt-3">
    <div class="maya-card p-4 anim-in"><h2 class="font-extrabold mb-2">Clientes (receita aprovada)</h2>
      ${topCli.length?topCli.map(([k,v],i)=>`<div class="flex text-sm border-b py-1" style="border-color:var(--line)"><b class="w-6">${i+1}.</b><div class="flex-1">${esc(k)}</div><b style="color:var(--maya-accent)">${brl(v)}</b></div>`).join(''):'<p class="text-xs" style="color:var(--muted)">Sem aprovações no período.</p>'}</div>
    <div class="maya-card p-4 anim-in"><h2 class="font-extrabold mb-2">Serviços mais vendidos</h2>
      ${topSvc.length?topSvc.map(([k,v],i)=>`<div class="flex text-sm border-b py-1" style="border-color:var(--line)"><b class="w-6">${i+1}.</b><div class="flex-1">${esc(k)}</div><b style="color:var(--maya-accent)">${brl(v)}</b></div>`).join(''):'<p class="text-xs" style="color:var(--muted)">Sem itens no período.</p>'}</div>
  </div>`;
}
function paintSpace(){
  const t=document.getElementById('spacetext'), f=document.getElementById('spacefill');
  if(!t) return;
  const done=(used,quota)=>{ const mb=used/1048576;
    t.textContent = quota?`${mb.toFixed(1)} MB de ${Math.round(quota/1048576)} MB`:`${mb.toFixed(1)} MB em uso`;
    if(f) f.style.width = quota?Math.max(2,Math.min(100,100*used/quota)).toFixed(0)+'%':Math.min(100,2+mb)+'%'; };
  try{
    if(navigator.storage && navigator.storage.estimate){ navigator.storage.estimate().then(e=>done(e.usage||0,e.quota||0)).catch(()=>done(storageInfo().kb*1024,0)); }
    else done(storageInfo().kb*1024,0);
  }catch(e){ done(0,0); }
}
window.downloadCSV=(name,head,rows)=>{ const s='﻿'+[head,...rows].map(r=>r.map(csvCell).join(';')).join('\n');
  const a=document.createElement('a'); a.href=URL.createObjectURL(new Blob([s],{type:'text/csv'})); a.download=name; a.click(); toast('CSV baixado!'); };
window.exportBudgetsCSV=()=>{ const rows=repData().map(b=>[b.number,b.date,b.validity,b.client?.name,b.client?.phone,effStatus(b),(b.items||[]).length,Number(b.subtotal||0).toFixed(2),Number(b.discountVal||0).toFixed(2),Number(b.total||0).toFixed(2),b.payment||'']);
  downloadCSV(`maya-orcamentos-${todayISO()}.csv`,['numero','emissao','validade','cliente','fone','status','itens','subtotal','desconto','total','pagamento'],rows); };
window.exportItemsCSV=()=>{ const rows=[]; repData().forEach(b=>(b.items||[]).forEach(it=>rows.push([b.number,b.date,b.client?.name,it.desc,it.qty,it.unitLabel||'',Number(it.unit||0).toFixed(2),((Number(it.qty)||0)*(Number(it.unit)||0)).toFixed(2)])));
  downloadCSV(`maya-itens-${todayISO()}.csv`,['orcamento','emissao','cliente','descricao','qtd','un','unit','total'],rows); };

/* ---------- AGENDA PRO (calendário) ---------- */
window.CalYM = window.CalYM || monthKey(todayISO());
window.CalDay = window.CalDay || todayISO();
function agendaProHTML(){
  const [Y,M]=window.CalYM.split('-').map(Number);
  const first=new Date(Y,M-1,1); let start=(first.getDay()+6)%7; // segunda=0
  const dim=new Date(Y,M,0).getDate();
  const label=first.toLocaleDateString('pt-BR',{month:'long',year:'numeric'});
  const byDay={}; (Store.visits||[]).forEach(v=>{ if(monthKey(v.date)===window.CalYM){ (byDay[v.date]=byDay[v.date]||[]).push(v); } });
  let cells=''; for(let i=0;i<start;i++) cells+='<div></div>';
  for(let d=1;d<=dim;d++){ const iso=`${Y}-${String(M).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    const vs=byDay[iso]||[]; const sel=window.CalDay===iso; const isToday=iso===todayISO();
    cells+=`<button onclick="calPick('${iso}')" class="cal-day${sel?' sel':''}${isToday?' today':''}">${d}${vs.length?`<span class="cal-dot">${vs.length}</span>`:''}</button>`; }
  const dayVs=(Store.visits||[]).filter(v=>v.date===window.CalDay).sort((a,b)=>String(a.time||'').localeCompare(String(b.time||'')));
  return `<div class="flex items-center gap-2 mb-3 anim-in flex-wrap"><h1 class="text-2xl font-black">Agenda</h1><div class="flex-1"></div>
    <button class="maya-btn-ghost text-sm" onclick="calNav(-1)">←</button><b class="capitalize">${label}</b><button class="maya-btn-ghost text-sm" onclick="calNav(1)">→</button>
    <button class="maya-btn-ghost text-sm" onclick="openChecklist('')">Checklist</button>
    <button class="maya-btn text-sm" onclick="addVisitOn(window.CalDay)">+ Agendar dia ${fmtD(window.CalDay)}</button></div>
  <div class="grid lg:grid-cols-5 gap-3">
    <div class="maya-card p-3 anim-in lg:col-span-3"><div class="cal-grid text-xs font-bold mb-1" style="color:var(--muted)">${['SEG','TER','QUA','QUI','SEX','SÁB','DOM'].map(d=>`<div class="text-center">${d}</div>`).join('')}</div>
    <div class="cal-grid">${cells}</div></div>
    <div class="maya-card p-4 anim-in lg:col-span-2"><h2 class="font-extrabold mb-2">${fmtD(window.CalDay)}</h2>
    ${dayVs.length?dayVs.map(v=>`<div class="border rounded-xl p-2 mb-2" style="border-color:var(--line)"><b>${esc(v.time||'—')} — ${esc(v.client)}</b><div class="text-sm" style="color:var(--muted)">${esc(v.service||'')} ${v.price?'• '+brl(v.price):''} • ${esc(v.status||'agendada')}</div>
      <div class="flex gap-1 mt-1 text-xs"><button class="maya-btn-ghost px-2 py-1" onclick="toggleVisit('${v.id}')">✓ ${v.status==='concluída'?'reabrir':'concluir'}</button><button class="maya-btn-ghost px-2 py-1" onclick="openChecklist(this.dataset.cli)" data-cli="${esc(v.client)}">Checklist</button><button class="maya-btn-ghost px-2 py-1 !text-red-700" onclick="delVisit('${v.id}')">Excluir</button></div></div>`).join(''):emptyState('Dia livre','Nada agendado para este dia.','Agendar',"addVisitOn(window.CalDay)")}
    </div>
  </div>`;
}
window.calNav=d=>{ window.CalYM=addMonths(window.CalYM+'-01',d).slice(0,7); render(); };
window.calPick=iso=>{ window.CalDay=iso; render(); };
window.addVisitOn=date=>{ openModal('Agendar visita — '+fmtD(date), MF.text('av-client','Cliente *','')+`<div class="f-row2">`+MF.time('av-time','Hora','09:00')+MF.num('av-price','Valor previsto R$',0)+`</div>`+MF.text('av-service','Serviço','Visita avaliação'), ()=>{
    const client=mv('av-client'); if(!client) return 'Informe o cliente.';
    const a=Store.visits; a.push({id:Store.uid(),client,date,time:mv('av-time'),service:mv('av-service'),price:Number(mv('av-price'))||0,status:'agendada'}); Store.visits=a; render(); toast('Agendado!'); return true;
  }); };

/* ---------- DADOS DE EXEMPLO ---------- */
window.seedSample=async ()=>{
  if((Store.budgets||[]).length && !await confirmModal('Carregar exemplo','Já existem orçamentos. Adicionar os dados de exemplo mesmo assim?','Adicionar')) return;
  const t=todayISO();
  const cs=[{id:Store.uid(),name:'Maria Silva',phone:'24999990001',address:'Itaipava, Petrópolis-RJ'},{id:Store.uid(),name:'João Pereira',phone:'24999990002',address:'Corrêas, Petrópolis-RJ'},{id:Store.uid(),name:'Condomínio Alto da Serra',phone:'24999990003',address:'Quitandinha, Petrópolis-RJ'}];
  Store.clients=[...Store.clients, ...cs];
  const mkB=(cli,items,days,status,validOff)=>{ const b=blankBudget(); b.client={name:cli.name,phone:cli.phone,address:cli.address}; b.items=items; b.date=addDays(t,days); b.validity=addDays(t,validOff); b.status=status; b.payment='Pix'; b.notes='Orçamento de exemplo — edite ou exclua.'; recalcDraft2(b); return b; };
  Store.budgets=[...Store.budgets,
    mkB(cs[0],[{desc:'Replantio orquídea — substrato premium',qty:6,unitLabel:'vaso',unit:55},{desc:'Adubação foliar',qty:1,unitLabel:'aplicação',unit:90}],-20,'aprovado',-5),
    mkB(cs[2],[{desc:'Manutenção mensal do jardim (120m²)',qty:1,unitLabel:'mensalidade',unit:720},{desc:'Controle preventivo pragas',qty:1,unitLabel:'aplicação',unit:160}],-8,'aprovado',7),
    mkB(cs[1],[{desc:'Poda de arbustos ornamentais',qty:8,unitLabel:'un',unit:60},{desc:'Limpeza + remoção',qty:1,unitLabel:'serviço',unit:220}],-2,'pendente',13),
    mkB(cs[0],[{desc:'Orquidário simples 2m²',qty:1,unitLabel:'projeto',unit:900}],-40,'pendente',-25)];
  Store.visits=[...Store.visits,
    {id:Store.uid(),client:cs[1].name,date:addDays(t,2),time:'09:00',service:'Avaliação p/ poda',price:0,status:'agendada'},
    {id:Store.uid(),client:cs[2].name,date:addDays(t,5),time:'14:00',service:'Manutenção mensal',price:720,status:'agendada'}];
  Store.contracts=[...Store.contracts,
    {id:Store.uid(),client:{name:cs[2].name,phone:cs[2].phone,address:cs[2].address},title:'Manutenção mensal do jardim',value:720,freq:'mensal',startDate:addDays(t,-60),lastBilled:addDays(t,-30),active:true,notes:'Todo dia 5.'},
    {id:Store.uid(),client:{name:cs[0].name,phone:cs[0].phone,address:cs[0].address},title:'Cuidado orquidário (visita mensal)',value:180,freq:'mensal',startDate:addDays(t,-30),lastBilled:'',active:true,notes:''}];
  // demo: um recebimento parcial + um pendente antigo (follow-up)
  const _all = Store.budgets;
  const firstApr=_all.find(b=>b.status==='aprovado');
  if(firstApr){ firstApr.paid={entries:[{id:Store.uid(),date:addDays(t,-3),value:Math.round(Number(firstApr.total)*0.5*100)/100,method:'Pix'}]}; }
  const joao=_all.find(b=>b.client?.name==='João Pereira'&&b.status==='pendente');
  if(joao){ joao.createdAt=new Date(Date.now()-9*864e5).toISOString(); }
  Store.budgets=_all;
  render(); toast('Exemplo carregado!');
};

/* ---------- PACOTES PRONTOS ---------- */
function parsePackLines(text){
  return String(text||'').split('\n').map(l=>l.trim()).filter(Boolean).map(l=>{
    const p=l.split('|').map(x=>x.trim());
    return {desc:p[0]||'Serviço', qty:Number(p[1])||1, unitLabel:p[2]||'un', unit:Number(p[3])||0};
  }).filter(x=>x.desc && x.unit>0);
}
function packLinesText(items){ return (items||[]).map(it=>`${it.desc} | ${it.qty} | ${it.unitLabel||'un'} | ${it.unit}`).join('\n'); }
function packTotal(p){ return (p.items||[]).reduce((s,it)=>s+(Number(it.qty)||0)*(Number(it.unit)||0),0); }
window.openPackPick = ()=>{
  const ps=Store.packages||[];
  openDrawer(`<h3 class="font-black text-lg mb-1">Pacotes prontos</h3>
  <p class="text-xs mb-2" style="color:var(--muted)">1 clique adiciona todos os itens (editáveis depois).</p>
  ${ps.map(p=>`<div class="border rounded-xl p-3 mb-2" style="border-color:var(--line)">
    <div class="flex items-center gap-2"><b>${esc(p.name)}</b><div class="flex-1"></div><b style="color:var(--maya-accent)">${brl(packTotal(p))}</b></div>
    <div class="text-xs mb-2" style="color:var(--muted)">${esc(p.desc||'')} • ${p.items.length} itens</div>
    <button class="maya-btn text-xs w-full" onclick="addPack('${p.id}')">Adicionar pacote</button></div>`).join('')||'<p class="text-sm" style="color:var(--muted)">Nenhum pacote. Crie em Catálogo.</p>'}
  <button class="maya-btn-ghost w-full mt-1" onclick="closeDrawer()">Fechar</button>`);
};
window.addPack = id=>{
  const p=(Store.packages||[]).find(x=>x.id===id); if(!p||!Draft) return;
  (p.items||[]).forEach(it=>Draft.items.push({desc:it.desc,qty:Number(it.qty)||1,unitLabel:it.unitLabel||'un',unit:Number(it.unit)||0}));
  window._dirty=true; closeDrawer(); recalcDraft(); paintItems(); paintEditorTotalsOnly(); paintPreviewOnly();
  toast(`Pacote "${p.name}" adicionado!`);
};
window.addPackage = ()=>{
  openModal('Novo pacote', MF.text('pk-name','Nome *','','Ex: Manutenção Premium')+MF.text('pk-desc','Descrição','','Resumo do pacote')+MF.area('pk-lines','Itens (um por linha: descrição | qtd | und | valor)','Corte de grama | 50 | m² | 8',4), ()=>{
    const name=mv('pk-name'); if(!name) return 'Informe o nome do pacote.';
    const items=parsePackLines(mv('pk-lines')); if(!items.length) return 'Adicione ao menos 1 item válido.';
    const a=Store.packages; a.push({id:Store.uid(),name,desc:mv('pk-desc'),items}); Store.packages=a; render(); toast('Pacote criado!'); return true;
  });
};
window.editPackage = id=>{
  const a=Store.packages, p=a.find(x=>x.id===id); if(!p) return;
  openModal('Editar pacote', MF.text('pk-name','Nome *',p.name)+MF.text('pk-desc','Descrição',p.desc)+MF.area('pk-lines','Itens (descrição | qtd | und | valor)',packLinesText(p.items),5), ()=>{
    const name=mv('pk-name'); if(!name) return 'Informe o nome do pacote.';
    const items=parsePackLines(mv('pk-lines')); if(!items.length) return 'Adicione ao menos 1 item válido.';
    p.name=name; p.desc=mv('pk-desc'); p.items=items; Store.packages=a; render(); toast('Pacote atualizado!'); return true;
  });
};
window.delPackage = async id=>{ if(!await confirmModal('Excluir pacote','Remover este pacote pronto?'))return; Store.packages=Store.packages.filter(p=>p.id!==id); render(); };

/* ---------- ESTADOS VAZIOS + LIGHTBOX + INSTALAR ---------- */
function emptyState(t, s, btnLabel, btnGo){
  const btn = btnLabel ? (String(btnGo||'').startsWith('#/') ? `<a href="${btnGo}" class="maya-btn text-sm inline-block mt-1">${esc(btnLabel)}</a>` : `<button class="maya-btn text-sm mt-1" onclick="${btnGo}">${esc(btnLabel)}</button>`) : '';
  return `<div class="empty anim-in" style="opacity:1"><svg width="52" height="52" viewBox="0 0 54 54" fill="none"><path d="M27 48 V26" stroke="#2E7D32" stroke-width="3" stroke-linecap="round"/><path d="M27 30 C18 30 12 24 11 15 C20 15 26 21 27 30 Z" fill="#2E7D32"/><path d="M27 26 C36 26 42 20 43 11 C34 11 28 17 27 26 Z" fill="#4CAF50"/><path d="M12 48 H42" stroke="#2E7D32" stroke-width="3" stroke-linecap="round"/></svg><div class="empty-t">${esc(t)}</div><div class="text-xs mb-1">${esc(s)}</div>${btn}</div>`;
}
window.emptyState = emptyState;
window.openLight = src=>{ let o=document.getElementById('lightbox'); if(!o){ o=document.createElement('div'); o.id='lightbox'; document.body.appendChild(o); } o.innerHTML=`<div class="lightbox" onclick="document.getElementById('lightbox').innerHTML=''"><img src="${src}" alt="foto ampliada"></div>`; };
window.installApp = async ()=>{ if(window._pwaPrompt){ window._pwaPrompt.prompt(); try{ await window._pwaPrompt.userChoice; }catch(e){} window._pwaPrompt=null; } else toast('No Chrome: menu ⋮ → "Instalar app" ou "Adicionar à tela inicial".'); };

/* ---------- WHATSAPP DIRETO ---------- */
function zapDigits(phone){ let d=String(phone||'').replace(/\D/g,''); if(d && d.length<=11 && !d.startsWith('55')) d='55'+d; return d; }
window.openZapText=(phone,msg)=>{ const d=zapDigits(phone); if(!d){ toast('Cliente sem WhatsApp cadastrado.'); return; } window.open('https://wa.me/'+d+'?text='+encodeURIComponent(msg),'_blank'); };
window.openZapDraft=()=>{ if(!Draft) return; collectSilent(); recalcDraft(); openZapText(Draft.client.phone, zapFill(Draft)); };
window.openZapBudget=id=>{ const b=(Store.budgets||[]).find(x=>x.id===id); if(b) openZapText(b.client?.phone, zapFill(b)); };
window.openFollowZap=id=>{ const b=(Store.budgets||[]).find(x=>x.id===id); if(b) openZapText(b.client?.phone, zapFollowFill(b)); };

/* ---------- ORDEM DE SERVIÇO (impressão) ---------- */
window.printOS=id=>{ const b=(Store.budgets||[]).find(x=>x.id===id)||(Store.os||[]).find(x=>x.id===id); if(b) printOSObj(b); };
window.printOSDraft=()=>{ if(!Draft) return; collectSilent(); recalcDraft(); if(!Draft.client.name){ toast('Preencha o cliente antes.'); return; } printOSObj(Draft); };
function printOSObj(b){ const st=Store.settings;
  let ov=document.getElementById('os-print'); if(!ov){ ov=document.createElement('div'); ov.id='os-print'; document.body.appendChild(ov); }
  ov.innerHTML=`<div class="os-sheet">
    <div class="os-head"><div><div class="os-title">ORDEM DE SERVIÇO</div><div class="os-sub">${esc(st.company)} • ${esc(st.tagline||'')}</div></div>
    <div class="os-num">Nº ${esc(b.number)}<br><span>Emissão ${fmtD(b.date)}</span></div></div>
    <div class="os-box"><b>Cliente:</b> ${esc(b.client?.name||'-')} &nbsp; <b>Whats:</b> ${esc(b.client?.phone||'-')}<br><b>Endereço:</b> ${esc(b.client?.address||'-')}</div>
    <table class="os-table"><tr><th style="width:34px">OK</th><th>Serviço</th><th style="width:52px">Qtd</th><th style="width:90px">Obs. campo</th></tr>
    ${(b.items||[]).map(it=>`<tr><td class="os-check">☐</td><td>${esc(it.desc||'')}</td><td>${esc(it.qty)}</td><td></td></tr>`).join('')}</table>
    ${b.notes?`<div class="os-box"><b>Observações:</b> ${esc(b.notes)}</div>`:''}
    <div class="os-foot">${esc(st.company)} • Whats ${esc(st.whatsappDisplay||'')} • ${esc(st.address||'')} &nbsp;|&nbsp; Equipe: __________ &nbsp; Data exec.: ____/____/____</div>
  </div>`;
  document.body.classList.add('os-print');
  const done=()=>document.body.classList.remove('os-print');
  window.addEventListener('afterprint', done, {once:true});
  setTimeout(()=>window.print(),120);
};

/* ---------- BUSCA GLOBAL (Ctrl+K) ---------- */
window._palIdx = 0; window._palItems = [];
window.openPalette=()=>{
  let root=document.getElementById('pal-root');
  if(!root){ root=document.createElement('div'); root.id='pal-root'; document.body.appendChild(root); }
  root.innerHTML=`<div class="modal-bg show" id="pal-bg"></div><div class="pal-box" id="pal-box">
    <input id="pal-in" placeholder="Buscar orçamento, cliente, serviço ou ação…" autocomplete="off">
    <div id="pal-list"></div>
    <div class="pal-hint">↑↓ navegar • Enter abrir • Esc fechar</div></div>`;
  const close=()=>{ root.innerHTML=''; };
  window.__palClose=close;
  document.getElementById('pal-bg').onclick=close;
  const inp=document.getElementById('pal-in');
  inp.oninput=()=>palRender(inp.value);
  inp.onkeydown=e=>{ if(e.key==='ArrowDown'){e.preventDefault();palMove(1);} else if(e.key==='ArrowUp'){e.preventDefault();palMove(-1);} else if(e.key==='Enter'){palGo();} else if(e.key==='Escape'){close();} };
  palRender(''); setTimeout(()=>inp.focus(),40);
  if(window.gsap && !matchMedia('(prefers-reduced-motion: reduce)').matches){ gsap.fromTo('#pal-box',{y:-18,opacity:0,scale:.98},{y:0,opacity:1,scale:1,duration:.28,ease:'power3.out',clearProps:'transform'}); }
};
function palIndex(){
  const out=[];
  (Store.budgets||[]).forEach(b=>out.push({t:`${b.number} — ${b.client?.name||''} — ${brl(b.total)}`, s:'Orçamento', go:`#/editar/${b.id}`}));
  (Store.clients||[]).forEach(c=>out.push({t:`${c.name} — ${c.phone||''}`, s:'Cliente', act:()=>clientDetail(c.id)}));
  (Store.catalog||[]).forEach(c=>out.push({t:`${c.name} — ${brl(c.price)}`, s:'Serviço', go:'#/catalogo'}));
  [['Novo orçamento','Ação','#/novo'],['Recorrentes','Ação','#/recorrentes'],['Agenda','Ação','#/agenda'],['Relatórios','Ação','#/relatorios'],['Checklist de visita','Ação',null]].forEach(([t,s,go])=>out.push({t,s,go,act:go?null:()=>{closePaletteGo();openChecklist('');}}));
  return out;
}
function closePaletteGo(){ const r=document.getElementById('pal-root'); if(r) r.innerHTML=''; }
function palRender(q){
  q=String(q||'').toLowerCase();
  window._palItems=palIndex().filter(o=>!q||o.t.toLowerCase().includes(q)).slice(0,12);
  window._palIdx=0; palPaint();
}
function palPaint(){
  const box=document.getElementById('pal-list'); if(!box) return;
  box.innerHTML=window._palItems.map((o,i)=>`<div class="pal-item${i===window._palIdx?' on':''}" data-i="${i}"><span class="pal-tag">${o.s}</span><span>${esc(o.t)}</span></div>`).join('')||'<div class="pal-empty">Nada encontrado.</div>';
  box.querySelectorAll('.pal-item').forEach(el=>{ el.onclick=()=>{ window._palIdx=Number(el.dataset.i); palGo(); }; });
}
function palMove(d){ if(!window._palItems.length) return; window._palIdx=(window._palIdx+d+window._palItems.length)%window._palItems.length; palPaint(); }
function palGo(){ const o=window._palItems[window._palIdx]; if(!o) return; closePaletteGo(); if(o.act) o.act(); else if(o.go) location.hash=o.go; }
document.addEventListener('keydown', e=>{
  if((e.ctrlKey||e.metaKey)&&String(e.key).toLowerCase()==='k'){ e.preventDefault(); const r=document.getElementById('pal-root'); if(r&&r.innerHTML) { r.innerHTML=''; } else openPalette(); }
  else if(e.key==='Escape'){ const r=document.getElementById('pal-root'); if(r&&r.innerHTML){ r.innerHTML=''; return; }
    const m=document.getElementById('modal-root'); if(m&&m.innerHTML){ closeModal(); return; }
    const d=document.getElementById('drawer-root'); if(d&&d.innerHTML){ closeDrawer(); } }
});

/* ---------- CHECKLIST DE VISITA → ORÇAMENTO ---------- */
const CHECK_ITEMS = [
  {k:'grama', t:'Corte de grama', cat:'c1'},
  {k:'poda', t:'Poda (arbustos/árvores)', cat:'c2'},
  {k:'limpeza', t:'Limpeza do terreno', cat:'c3'},
  {k:'adubo', t:'Adubação do solo', cat:'c4'},
  {k:'pragas', t:'Pragas / fungos', cat:'c5'},
  {k:'orq', t:'Orquídeas', cat:'c6'},
  {k:'irrig', t:'Irrigação', cat:'c12'},
  {k:'plantio', t:'Plantio / canteiros', cat:'c10'}
];
window._check = null;
window.openChecklist = (clientName)=>{
  window._check = {client:clientName||'', sev:{}, obs:''};
  CHECK_ITEMS.forEach(it=>window._check.sev[it.k]='ok');
  openDrawer(`<h3 class="font-black text-lg">Checklist da visita</h3>
  <p class="text-xs mb-2" style="color:var(--muted)">Marque cada ponto. Atenção e Crítico viram itens do orçamento.</p>
  <label class="text-xs font-bold">Cliente<input class="maya-input" id="ck-client" value="${esc(clientName||'')}"></label>
  <div class="mt-2 space-y-2" id="ck-list">
  ${CHECK_ITEMS.map(it=>`<div class="border rounded-xl p-2" style="border-color:var(--line)">
    <div class="text-sm font-bold mb-1">${it.t}</div>
    <div class="seg" data-ck="${it.k}">
      <button data-v="ok" onclick="ckSev('${it.k}','ok')">Ok</button>
      <button data-v="att" onclick="ckSev('${it.k}','att')">Atenção</button>
      <button data-v="crit" onclick="ckSev('${it.k}','crit')">Crítico</button>
    </div></div>`).join('')}
  </div>
  <label class="text-xs font-bold block mt-2">Observações da visita<textarea class="maya-textarea" rows="2" id="ck-obs" placeholder="Ex: formigueiro no canto, sombrite rasgado…"></textarea></label>
  <button class="maya-btn w-full mt-3" onclick="genFromChecklist()">Gerar orçamento →</button>
  <button class="maya-btn-ghost w-full mt-2" onclick="closeDrawer()">Fechar</button>`);
  syncCheckUI();
};
function syncCheckUI(){ $$('#ck-list .seg').forEach(box=>{ const k=box.dataset.ck; box.querySelectorAll('button').forEach(b=>b.classList.toggle('seg-on', b.dataset.v===(window._check.sev[k]||'ok'))); }); }
window.ckSev = (k,v)=>{ window._check.sev[k]=v; syncCheckUI(); };
window.genFromChecklist = ()=>{
  const name=(document.getElementById('ck-client')||{}).value||''; if(!name){ toast('Informe o cliente.'); return; }
  const obs=(document.getElementById('ck-obs')||{}).value||'';
  const items=[];
  CHECK_ITEMS.forEach(it=>{ const s=window._check.sev[it.k]; if(s==='ok') return;
    const cat=(Store.catalog||[]).find(c=>c.id===it.cat) || (Store.catalog||[]).find(c=>c.name.toLowerCase().includes(it.t.split(' ')[0].toLowerCase()));
    const base=cat?`${cat.name} — ${cat.desc||''}`.slice(0,120):it.t;
    items.push({desc:(s==='crit'?'[URGENTE] ':'')+base, qty:1, unitLabel:cat?cat.unit:'serviço', unit:cat?Number(cat.price)||0:0});
  });
  if(!items.length){ toast('Nada a orçar: tudo Ok.'); return; }
  const cs=Store.clients; let c=cs.find(x=>x.name.toLowerCase()===name.toLowerCase());
  if(!c){ c={id:Store.uid(),name,phone:'',address:''}; cs.push(c); Store.clients=cs; }
  Draft=normItems(blankBudget()); Draft.client={name:c.name,phone:c.phone||'',address:c.address||''};
  Draft.items=items; Draft.notes=(obs?('Visita: '+obs+'\n'):'')+'Orçamento gerado a partir do checklist da visita.'; recalcDraft();
  const vs=Store.visits; vs.push({id:Store.uid(),client:name,date:todayISO(),time:'',service:'Avaliação com checklist ('+items.length+' pontos)',price:0,status:'concluída'}); Store.visits=vs;
  closeDrawer(); location.hash='#/novo'; if(currentRoute()==='#/novo') render();
  toast(items.length+' itens puxados do checklist!');
};

/* ---------- ORDENS DE SERVIÇO ---------- */
const OS_STATUS = ['aberta','em execução','concluída','cancelada'];
function osBadge(s){ return {'aberta':'b-aberta','em execução':'b-exec','concluída':'b-conc','cancelada':'b-canc'}[s]||'b-expirado'; }
function parseOSLines(text){
  return String(text||'').split('\n').map(l=>l.trim()).filter(Boolean).map(l=>{
    const p=l.split('|').map(x=>x.trim());
    return {desc:p[0]||'Serviço', qty:Number(p[1])||1};
  }).filter(x=>x.desc);
}
function osLinesText(items){ return (items||[]).map(it=>`${it.desc} | ${it.qty||1}`).join('\n'); }
function viewOS(){
  const arr=[...(Store.os||[])].sort((a,b)=>String(b.createdAt).localeCompare(String(a.createdAt)));
  const open=arr.filter(o=>o.status==='aberta'||o.status==='em execução').length;
  return `<div class="flex items-center gap-2 mb-1 anim-in flex-wrap"><h1 class="text-2xl font-black">Ordens de serviço</h1><div class="flex-1"></div>
  <div class="maya-card px-3 py-1 text-sm">${pl(open,'em aberto','em aberto')} • ${pl(arr.filter(o=>o.status==='concluída').length,'concluída','concluídas')}</div>
  <button class="maya-btn text-sm" onclick="addOS()">+ Nova OS</button></div>
  <p class="text-sm mb-3 anim-in" style="color:var(--muted)">Execução em campo: crie, acompanhe o status e imprima para levar. Pode nascer de um orçamento.</p>
  <div class="grid md:grid-cols-2 gap-3">${arr.map(o=>`
    <div class="maya-card p-4 anim-in" style="opacity:1">
    <div class="flex items-center gap-2"><b>Nº ${esc(o.number)}</b><span class="maya-badge ${osBadge(o.status)}">${esc(o.status)}</span><div class="flex-1"></div><span class="text-xs" style="color:var(--muted)">${fmtD(o.date)}</span></div>
    <div class="text-sm mt-1"><b>${esc(o.client?.name||'-')}</b> • ${esc(o.client?.address||'')}${o.team?` • Equipe: ${esc(o.team)}`:''}</div>
    <div class="text-xs mt-1" style="color:var(--muted)">${pl((o.items||[]).length,'tarefa','tarefas')}${o.budgetId?` • do orçamento ${esc((Store.budgets||[]).find(b=>b.id===o.budgetId)?.number||'')}`:''}</div>
    <div class="flex gap-1 mt-2 flex-wrap text-xs">
      <button class="maya-btn-ghost px-2 py-1" onclick="printOS('${o.id}')">Imprimir</button>
      <select class="maya-select !w-36 !py-1 text-xs" onchange="setOSStatus('${o.id}',this.value)">${OS_STATUS.map(s=>`<option value="${s}" ${o.status===s?'selected':''}>${s}</option>`).join('')}</select>
      <button class="maya-btn-ghost px-2 py-1" onclick="editOS('${o.id}')">Editar</button>
      <button class="maya-btn-ghost px-2 py-1 !text-red-700" onclick="delOS('${o.id}')">Excluir</button>
    </div></div>`).join('')||emptyState('Sem ordens de serviço','Crie avulsa ou gere a partir de um orçamento.','Nova OS',"addOS()")}</div>`;
}
function osFormHTML(o){
  o = o || {client:{name:'',phone:'',address:''}, date:todayISO(), team:'', notes:'', items:[]};
  return MF.text('os-client','Cliente *',o.client.name)+`<div class="f-row2">`+MF.text('os-phone','WhatsApp',o.client.phone)+MF.date('os-date','Data de execução',o.date)+`</div>`
  + MF.text('os-addr','Endereço',o.client.address)+`<div class="f-row2">`+MF.text('os-team','Equipe',''+ (o.team||''))+MF.sel('os-status','Status',OS_STATUS,o.status||'aberta')+`</div>`
  + MF.area('os-tasks','Tarefas (uma por linha: descrição | qtd)',osLinesText(o.items),4)
  + MF.area('os-notes','Observações',''+(o.notes||''),2);
}
function osFromForm(o){
  const name=mv('os-client'); if(!name) return 'Informe o cliente.';
  const items=parseOSLines(mv('os-tasks')); if(!items.length) return 'Adicione ao menos 1 tarefa.';
  o.client={name, phone:mv('os-phone'), address:mv('os-addr')};
  o.date=mv('os-date')||todayISO(); o.team=mv('os-team'); o.status=mv('os-status')||'aberta';
  o.items=items; o.notes=mv('os-notes');
  return true;
}
window.addOS=()=>{ openModal('Nova ordem de serviço', osFormHTML(null), ()=>{
    const o={id:Store.uid(), number:Store.nextOSNumber(), createdAt:new Date().toISOString(), budgetId:''};
    const r=osFromForm(o); if(r!==true) return r;
    const a=Store.os; a.push(o); Store.os=a; render(); toast(`OS ${o.number} criada!`); return true;
  }); };
window.editOS=id=>{ const a=Store.os, o=a.find(x=>x.id===id); if(!o) return;
  openModal('Editar OS '+o.number, osFormHTML(o), ()=>{
    const r=osFromForm(o); if(r!==true) return r;
    Store.os=a; render(); toast('OS atualizada!'); return true;
  }); };
window.delOS=async id=>{ if(!await confirmModal('Excluir OS','Remover esta ordem de serviço?'))return; Store.os=Store.os.filter(o=>o.id!==id); render(); };
window.setOSStatus=(id,s)=>{ const a=Store.os, o=a.find(x=>x.id===id); if(!o) return; o.status=s; Store.os=a; render(); };
window.billOS=budgetId=>{ const b=(Store.budgets||[]).find(x=>x.id===budgetId); if(!b) return;
  const o={id:Store.uid(), number:Store.nextOSNumber(), createdAt:new Date().toISOString(), budgetId:b.id,
    client:{name:b.client?.name||'', phone:b.client?.phone||'', address:b.client?.address||''},
    date:todayISO(), team:'', status:'aberta',
    items:(b.items||[]).map(it=>({desc:String(it.desc||'Serviço'), qty:Number(it.qty)||1})),
    notes:(b.notes?b.notes+'\n':'')+`Gerada do orçamento Nº ${b.number}.`};
  const a=Store.os; a.push(o); Store.os=a;
  toast(`OS ${o.number} gerada!`); location.hash='#/os';
};
