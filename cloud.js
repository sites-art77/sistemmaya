/* MAYA Garden — sincronização em nuvem (Supabase, offline-first) */
(function(){
  const SUPABASE_URL = 'https://sndhrndcyqefxwgsdlgi.supabase.co';
  const SUPABASE_ANON_KEY = 'sb_publishable_9mHmO8wjFK4qSauBWIvRMQ_aHSeS-fj';
  const TABLE = 'maya_cloud_data';
  const escCloud = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

  let client = null;
  let user = null;
  let ready = false;
  let loading = true;
  let syncing = false;
  let status = 'Preparando conexão segura…';
  let lastError = '';
  let remoteUpdatedAt = '';
  let pushTimer = null;

  function emit(){ window.dispatchEvent(new CustomEvent('maya-cloud-state')); }
  function say(message){ if(typeof window.toast === 'function') window.toast(message); }
  function localHasData(){
    try{ return !!((Store.budgets||[]).length || (Store.clients||[]).length || (Store.visits||[]).length || (Store.contracts||[]).length || (Store.os||[]).length); }
    catch(e){ return false; }
  }
  function fmtRemoteDate(value){
    try{ return new Date(value).toLocaleString('pt-BR',{dateStyle:'short',timeStyle:'short'}); }
    catch(e){ return value||''; }
  }
  function setStatus(message, error){ status=message; lastError=error||''; emit(); }
  function formValues(){
    return {
      email: String(document.getElementById('cloud-email')?.value||'').trim(),
      password: String(document.getElementById('cloud-password')?.value||'')
    };
  }
  function validateCredentials(email,password){
    if(!email || !email.includes('@')){ say('Informe um e-mail válido.'); return false; }
    if(!password || password.length<6){ say('A senha precisa ter pelo menos 6 caracteres.'); return false; }
    return true;
  }
  async function loadClient(){
    try{
      const mod = await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm');
      client = mod.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
      ready = true;
      const current = await client.auth.getSession();
      user = current?.data?.session?.user || null;
      client.auth.onAuthStateChange((_event, session)=>{
        user = session?.user || null;
        if(!user){ remoteUpdatedAt=''; setStatus('Desconectado. Os dados locais continuam disponíveis.'); return; }
        setStatus(`Conectado como ${user.email||'usuário MAYA'}.`);
        setTimeout(()=>checkRemote(),0);
      });
      loading = false;
      if(user) await checkRemote(); else setStatus('Pronto para conectar sua conta.');
    }catch(error){
      loading = false;
      ready = false;
      setStatus('Sincronização indisponível agora. O modo offline continua funcionando.', error?.message||String(error));
    }
    emit();
  }
  async function remoteRow(){
    if(!client || !user) return {row:null,error:null};
    const {data,error} = await client.from(TABLE).select('data,updated_at').eq('user_id',user.id).maybeSingle();
    return {row:data||null,error};
  }
  async function checkRemote(){
    if(!client || !user) return null;
    const {row,error}=await remoteRow();
    if(error){ setStatus('Conta conectada, mas não foi possível consultar a nuvem.',error.message); return null; }
    remoteUpdatedAt=row?.updated_at||'';
    if(row) setStatus(`Conectado. Cópia na nuvem de ${fmtRemoteDate(row.updated_at)}.`);
    else setStatus('Conectado. Ainda não há uma cópia na nuvem.');
    return row;
  }
  async function signIn(){
    if(!ready){ say('A conexão ainda está carregando.'); return; }
    const {email,password}=formValues(); if(!validateCredentials(email,password)) return;
    syncing=true; setStatus('Entrando…');
    const {data,error}=await client.auth.signInWithPassword({email,password});
    syncing=false;
    if(error){ setStatus('Não foi possível entrar.',error.message); say(error.message||'Falha ao entrar.'); return; }
    user=data?.user||null; setStatus(`Conectado como ${user?.email||email}.`); say('Conta conectada!'); await checkRemote();
  }
  async function signUp(){
    if(!ready){ say('A conexão ainda está carregando.'); return; }
    const {email,password}=formValues(); if(!validateCredentials(email,password)) return;
    syncing=true; setStatus('Criando conta…');
    const {data,error}=await client.auth.signUp({email,password,options:{emailRedirectTo:location.origin+location.pathname}});
    syncing=false;
    if(error){ setStatus('Não foi possível criar a conta.',error.message); say(error.message||'Falha ao criar conta.'); return; }
    user=data?.user||null;
    if(data?.session){ setStatus(`Conectado como ${user?.email||email}.`); say('Conta criada e conectada!'); }
    else { setStatus('Conta criada. Confira seu e-mail para confirmar o acesso.'); say('Confira seu e-mail para confirmar a conta.'); }
    emit();
  }
  async function signOut(){
    if(!client) return;
    await client.auth.signOut(); user=null; remoteUpdatedAt=''; setStatus('Desconectado. Os dados locais continuam disponíveis.'); say('Saiu da conta.');
  }
  async function pushLocal(ask){
    if(!client || !user){ say('Entre na conta antes de enviar dados.'); return false; }
    if(ask && localHasData() && typeof window.confirmModal==='function'){
      const ok=await window.confirmModal('Enviar dados para a nuvem','A cópia local deste aparelho substituirá a cópia atual na nuvem. Deseja continuar?','Enviar');
      if(!ok) return false;
    }
    syncing=true; setStatus('Enviando dados para a nuvem…');
    const payload=Store.exportBackup();
    const {error}=await client.from(TABLE).upsert({user_id:user.id,data:payload,updated_at:new Date().toISOString()},{onConflict:'user_id'});
    syncing=false;
    if(error){ setStatus('Falha ao enviar dados.',error.message); say(error.message||'Não foi possível enviar os dados.'); return false; }
    remoteUpdatedAt=new Date().toISOString(); setStatus(`Sincronizado em ${fmtRemoteDate(remoteUpdatedAt)}.`); say('Dados enviados para a nuvem!'); return true;
  }
  async function pullRemote(){
    if(!client || !user){ say('Entre na conta antes de baixar dados.'); return false; }
    const {row,error}=await remoteRow();
    if(error){ setStatus('Falha ao consultar a nuvem.',error.message); say(error.message||'Não foi possível consultar a nuvem.'); return false; }
    if(!row){ say('Ainda não existe uma cópia na nuvem para esta conta.'); setStatus('Nenhuma cópia encontrada na nuvem.'); return false; }
    if(typeof window.confirmModal==='function'){
      const ok=await window.confirmModal('Baixar dados da nuvem',`A cópia de ${fmtRemoteDate(row.updated_at)} substituirá os dados deste aparelho. Faça um backup antes de continuar.`,'Baixar');
      if(!ok) return false;
    }
    syncing=true; setStatus('Baixando dados da nuvem…');
    try{
      window.__mayaCloudMute=true;
      const result=Store.importBackup(row.data);
      localStorage.setItem('maya_cloud_last_pull',row.updated_at||'');
      remoteUpdatedAt=row.updated_at||'';
      setStatus(`Dados baixados: ${result.budgets} orçamento(s), ${result.clients} cliente(s).`);
      say('Dados da nuvem restaurados neste aparelho!');
      if(typeof window.render==='function') window.render();
      return true;
    }catch(error){ setStatus('Backup da nuvem inválido.',error.message); say(error.message||'Não foi possível baixar os dados.'); return false; }
    finally{ window.__mayaCloudMute=false; syncing=false; emit(); }
  }
  function schedulePush(){
    if(!client || !user || window.__mayaCloudMute) return;
    clearTimeout(pushTimer);
    pushTimer=setTimeout(()=>pushLocal(false),1200);
  }
  function cardHtml(){
    if(loading) return '<div class="text-sm" style="color:var(--muted)">Preparando conexão segura…</div>';
    if(!ready) return `<div class="text-sm" style="color:#9a2c2c">${escCloud(status)}<br><span class="text-xs">Você ainda pode usar o sistema offline e os backups locais.</span></div>`;
    if(user) return `<div class="text-sm" style="color:var(--muted)"><b style="color:var(--maya-accent)">Conectado:</b> ${escCloud(user.email||'conta MAYA')}<br>${escCloud(status)}</div>
      <div class="flex gap-2 mt-3 flex-wrap"><button class="maya-btn text-sm" onclick="cloudSyncPush()">Enviar dados locais</button><button class="maya-btn-ghost text-sm" onclick="cloudSyncPull()">Baixar da nuvem</button><button class="maya-btn-ghost text-sm" onclick="cloudSyncSignOut()">Sair</button></div>
      <div class="text-xs mt-2" style="color:var(--muted)">Alterações salvas neste aparelho são enviadas automaticamente após alguns segundos.</div>`;
    return `<div class="grid md:grid-cols-2 gap-2 mt-2"><label class="font-bold text-sm">E-mail<input id="cloud-email" type="email" class="maya-input" autocomplete="email" placeholder="voce@exemplo.com"></label><label class="font-bold text-sm">Senha<input id="cloud-password" type="password" class="maya-input" autocomplete="current-password" placeholder="mínimo 6 caracteres"></label></div>
      <div class="flex gap-2 mt-3 flex-wrap"><button class="maya-btn text-sm" onclick="cloudSyncSignIn()">Entrar</button><button class="maya-btn-ghost text-sm" onclick="cloudSyncSignUp()">Criar conta</button></div>
      <div class="text-xs mt-2" style="color:var(--muted)">${escCloud(status)} Os dados ficam separados por conta.</div>`;
  }
  window.CloudSync={get ready(){return ready;},get user(){return user;},get syncing(){return syncing;},get status(){return status;},cardHtml,signIn,pushLocal,pullRemote,signOut,schedulePush};
  window.cloudSyncSignIn=()=>CloudSync.signIn();
  window.cloudSyncSignUp=()=>signUp();
  window.cloudSyncSignOut=()=>signOut();
  window.cloudSyncPush=()=>pushLocal(true);
  window.cloudSyncPull=()=>pullRemote();
  window.addEventListener('maya-store-changed',schedulePush);
  loadClient();
})();
