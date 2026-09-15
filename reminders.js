/* MAYA Garden — aviso 3 dias antes da visita (notificação + calendário do celular) */
(function(){
  const KEY = 'maya_visit_nudge_v1';
  const DAYS = 3;

  function todayISO(){ return new Date().toISOString().slice(0,10); }
  function daysUntil(iso){
    const a = new Date(todayISO()+'T12:00:00');
    const b = new Date(String(iso||'')+'T12:00:00');
    if(Number.isNaN(b.getTime())) return 999;
    return Math.round((b - a) / 86400000);
  }
  function fmt(iso){
    try{ return new Date(iso+'T12:00:00').toLocaleDateString('pt-BR'); }
    catch(e){ return iso; }
  }
  function loadSeen(){ try{ return JSON.parse(localStorage.getItem(KEY)||'{}'); }catch(e){ return {}; } }
  function saveSeen(o){ try{ localStorage.setItem(KEY, JSON.stringify(o)); }catch(e){} }
  function dueVisits(){
    return ((window.Store && Store.visits) || []).filter(v => v && v.status !== 'concluída' && v.status !== 'cancelada' && daysUntil(v.date) === DAYS);
  }
  function upcomingVisits(){
    return ((window.Store && Store.visits) || []).filter(v => v && v.status !== 'concluída' && v.status !== 'cancelada' && daysUntil(v.date) >= 0);
  }
  function line(v){
    return [v.client || 'Cliente', fmt(v.date), v.time || '', v.service || ''].filter(Boolean).join(' • ');
  }
  function icsText(s){ return String(s||'').replace(/\\/g,'\\\\').replace(/\n/g,'\\n').replace(/,/g,'\\,').replace(/;/g,'\\;'); }
  function icsStamp(){ return new Date().toISOString().replace(/[-:]/g,'').replace(/\.\d{3}Z$/,'Z'); }
  function icsLocal(date, time){
    const t=String(time||'09:00').replace(/\D/g,'').padEnd(4,'0').slice(0,4);
    return String(date||'').replace(/-/g,'')+'T'+t+'00';
  }
  function icsEnd(date, time){
    const t=String(time||'09:00').replace(/\D/g,'').padEnd(4,'0').slice(0,4);
    const hh=Number(t.slice(0,2))+1;
    return String(date||'').replace(/-/g,'')+'T'+String(Math.min(hh,23)).padStart(2,'0')+t.slice(2)+'00';
  }
  function visitEvent(v){
    const uid=(v.id||Math.random().toString(36).slice(2))+'@mayagarden.app';
    const start=icsLocal(v.date, v.time);
    const end=icsEnd(v.date, v.time);
    const title=icsText('Visita MAYA Garden — '+(v.client||'Cliente'));
    const desc=icsText((v.service||'Visita')+(v.price?(' • R$ '+v.price):''));
    return ['BEGIN:VEVENT','UID:'+uid,'DTSTAMP:'+icsStamp(),'DTSTART:'+start,'DTEND:'+end,'SUMMARY:'+title,'DESCRIPTION:'+desc,'BEGIN:VALARM','ACTION:DISPLAY','DESCRIPTION:Visita MAYA Garden em 3 dias','TRIGGER:-P3D','END:VALARM','BEGIN:VALARM','ACTION:DISPLAY','DESCRIPTION:Visita MAYA Garden amanhã','TRIGGER:-P1D','END:VALARM','END:VEVENT'].join('\r\n');
  }
  function icsFile(visits){
    return ['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//MAYA Garden//Agenda//PT','CALSCALE:GREGORIAN','METHOD:PUBLISH'].concat(visits.map(visitEvent)).concat(['END:VCALENDAR']).join('\r\n');
  }
  function downloadIcs(visits, name){
    if(!visits.length){ if(typeof window.toast==='function') window.toast('Nenhuma visita para o calendário.'); return false; }
    const blob=new Blob([icsFile(visits)],{type:'text/calendar;charset=utf-8'});
    const url=URL.createObjectURL(blob);
    const a=document.createElement('a');
    a.href=url; a.download=name||'visitas-maya-garden.ics';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(()=>URL.revokeObjectURL(url), 2500);
    if(typeof window.toast==='function') window.toast('Abra no Calendário. O iPhone avisa 3 dias antes, mesmo com o app fechado.');
    return true;
  }

  async function ensurePermission(){
    if(!('Notification' in window)) return false;
    if(Notification.permission === 'granted') return true;
    if(Notification.permission === 'denied') return false;
    try{
      const p = await Notification.requestPermission();
      return p === 'granted';
    }catch(e){ return false; }
  }

  async function showNote(title, body, tag){
    const icon = new URL('icon-192.png', location.href).href;
    const opts = { body, icon, badge: icon, tag: tag || 'maya-visit', renotify: true, data: { url: '#/agenda' } };
    try{
      const reg = navigator.serviceWorker && await navigator.serviceWorker.ready;
      if(reg && reg.showNotification){ await reg.showNotification(title, opts); return true; }
    }catch(e){}
    try{ new Notification(title, opts); return true; }catch(e){}
    return false;
  }

  async function checkReminders(){
    const list = dueVisits();
    if(!list.length) return 0;
    const seen = loadSeen();
    const day = todayISO();
    let n = 0;
    const granted = ('Notification' in window) && Notification.permission === 'granted';
    for(const v of list){
      const key = (v.id || v.client) + ':' + v.date + ':' + day;
      if(seen[key]) continue;
      const body = line(v);
      if(granted) await showNote('Visita em 3 dias', body, 'visit-'+(v.id||n));
      if(typeof window.toast === 'function') window.toast('Lembrete: visita em 3 dias — '+body);
      seen[key] = 1;
      n++;
    }
    const keep = {};
    Object.keys(seen).forEach(k => { if(k.indexOf(':'+day) !== -1 || k.split(':')[2] >= day) keep[k] = seen[k]; });
    saveSeen(keep);
    return n;
  }

  async function afterVisitSaved(visit){
    await ensurePermission();
    await checkReminders();
    if(visit) downloadIcs([visit], 'visita-maya-'+(visit.date||'')+'.ics');
  }

  window.MayaReminders = {
    request: ensurePermission,
    check: checkReminders,
    afterVisitSaved,
    dueVisits,
    daysUntil,
    permission: () => ('Notification' in window) ? Notification.permission : 'unsupported',
    calendar: downloadIcs
  };
  window.remindersEnable = async ()=>{
    const ok = await ensurePermission();
    if(typeof window.toast === 'function'){
      window.toast(ok ? 'Avisos de visita ligados.' : 'O iPhone bloqueou. Use Avisos no calendário na Agenda.');
    }
    if(ok) checkReminders();
    if(typeof window.render === 'function') window.render();
  };
  window.addVisitToCalendar = id=>{
    const v=((window.Store && Store.visits)||[]).find(x=>x.id===id);
    if(v) downloadIcs([v], 'visita-maya-'+(v.date||'')+'.ics');
  };
  window.syncVisitCalendar = ()=> downloadIcs(upcomingVisits(), 'visitas-maya-garden.ics');

  window.addEventListener('maya-store-changed', () => { checkReminders(); });
  window.addEventListener('maya-auth-state', () => { setTimeout(checkReminders, 900); });
  document.addEventListener('visibilitychange', () => { if(document.visibilityState === 'visible') checkReminders(); });
  window.addEventListener('load', () => { setTimeout(checkReminders, 1400); });
  setInterval(checkReminders, 12 * 60 * 1000);
})();
