/* MAYA Garden — aviso 3 dias antes da visita (notificação do celular) */
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
  function line(v){
    return [v.client || 'Cliente', fmt(v.date), v.time || '', v.service || ''].filter(Boolean).join(' • ');
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

  async function afterVisitSaved(){
    const ok = await ensurePermission();
    if(!ok){
      if(typeof window.toast === 'function'){
        window.toast('Ative as notificações em Configurações para avisar 3 dias antes.');
      }
      return;
    }
    const n = await checkReminders();
    if(!n && typeof window.toast === 'function'){
      window.toast('Aviso ligado: notificação 3 dias antes da visita.');
    }
  }

  window.MayaReminders = {
    request: ensurePermission,
    check: checkReminders,
    afterVisitSaved,
    dueVisits,
    daysUntil,
    permission: () => ('Notification' in window) ? Notification.permission : 'unsupported'
  };
  window.remindersEnable = async ()=>{
    const ok = await ensurePermission();
    if(typeof window.toast === 'function'){
      window.toast(ok ? 'Avisos de visita ligados.' : 'O iPhone bloqueou. Ajuste em Ajustes → Notificações.');
    }
    if(ok) checkReminders();
    if(typeof window.render === 'function') window.render();
  };

  window.addEventListener('maya-store-changed', () => { checkReminders(); });
  window.addEventListener('maya-auth-state', () => { setTimeout(checkReminders, 900); });
  document.addEventListener('visibilitychange', () => { if(document.visibilityState === 'visible') checkReminders(); });
  window.addEventListener('load', () => { setTimeout(checkReminders, 1400); });
  setInterval(checkReminders, 12 * 60 * 1000);
})();
