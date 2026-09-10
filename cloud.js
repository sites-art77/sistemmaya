/* MAYA Garden — acesso online, perfis e dados compartilhados no Supabase */
(function(){
  const SUPABASE_URL = 'https://sndhrndcyqefxwgsdlgi.supabase.co';
  const SUPABASE_ANON_KEY = 'sb_publishable_9mHmO8wjFK4qSauBWIvRMQ_aHSeS-fj';
  const ACCESS_TABLE = 'maya_user_access';
  const DATA_TABLE = 'maya_workspace_data';
  const WORKSPACE_ID = 'maya-garden-main';
  const ADMIN_FUNCTION = SUPABASE_URL + '/functions/v1/admin-users';
  const INTERNAL_DOMAIN = 'mayagarden.local';

  let client = null;
  let user = null;
  let profile = null;
  let ready = false;
  let loading = true;
  let syncing = false;
  let status = 'Conectando ao sistema…';
  let lastError = '';
  let remoteUpdatedAt = '';
  let pushTimer = null;
  let managedUsers = [];
  let sessionVersion = 0;

  const escCloud = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const roleLabel = role => ({admin:'Administrador',empresa:'Empresa',visitante:'Visitante'}[role] || role || 'Sem perfil');
  const normalizeUsername = value => String(value||'').trim().toLowerCase().replace(/[^a-z0-9._-]/g,'');
  const emailForUsername = value => {
    const raw = String(value||'').trim().toLowerCase();
    if(raw.includes('@')) return raw;
    return `${normalizeUsername(raw)}@${INTERNAL_DOMAIN}`;
  };
  const fmtDateTime = value => {
    if(!value) return 'sem expiração';
    try{return new Date(value).toLocaleString('pt-BR',{dateStyle:'short',timeStyle:'short'});}catch(e){return value;}
  };
  const fmtDate = value => value ? String(value).slice(0,10) : '';
  const isNotExpired = item => !!item && item.active !== false && (!item.expires_at || new Date(item.expires_at).getTime() > Date.now());
  const isAdmin = () => !!(isNotExpired(profile) && profile.role === 'admin');
  const canWrite = () => !!(isNotExpired(profile) && (profile.role === 'admin' || profile.role === 'empresa'));
  const authenticated = () => !!(user && isNotExpired(profile));

  function emit(){
    try{ window.dispatchEvent(new CustomEvent('maya-auth-state')); window.dispatchEvent(new CustomEvent('maya-cloud-state')); }catch(e){}
  }
  function say(message){ if(typeof window.toast === 'function') window.toast(message); }
  function setStatus(message, error){ status=message; lastError=error||''; emit(); }
  function clearLocalCache(){
    try{ window.__mayaAuthSyncing=true; if(window.Store?.clearLocalCache) Store.clearLocalCache(); }
    catch(e){}
    finally{ window.__mayaAuthSyncing=false; }
  }
  function hasLocalData(){
    try{ return !!((Store.budgets||[]).length || (Store.clients||[]).length || (Store.visits||[]).length || (Store.contracts||[]).length || (Store.os||[]).length); }
    catch(e){ return false; }
  }
  function formValues(prefix){
    return {
      username: normalizeUsername(document.getElementById(prefix+'-username')?.value||''),
      password: String(document.getElementById(prefix+'-password')?.value||'')
    };
  }
  function validateCredentials(username,password){
    if(!username || username.length<3){ say('Informe um usuário com pelo menos 3 caracteres.'); return false; }
    if(!password || password.length<5){ say('A senha precisa ter pelo menos 5 caracteres.'); return false; }
    return true;
  }
  function accessErrorMessage(error){
    const msg=String(error?.message||error||'');
    if(/invalid login credentials/i.test(msg)) return 'Usuário ou senha inválidos.';
    if(/password.*(6|characters|length)/i.test(msg)) return 'O Supabase exige senha com pelo menos 6 caracteres.';
    if(/row-level|permission|not authorized/i.test(msg)) return 'Sua conta não tem permissão para esta operação.';
    return msg||'Não foi possível concluir a operação.';
  }

  async function loadProfile(nextUser){
    if(!nextUser) return {data:null,error:null};
    const result = await client.from(ACCESS_TABLE).select('user_id,username,display_name,role,active,expires_at,created_at,updated_at').eq('user_id',nextUser.id).maybeSingle();
    return result;
  }
  async function loadWorkspace(version){
    if(version !== undefined && version !== sessionVersion) return {ok:false,stale:true};
    if(!authenticated()) return {ok:false};
    const {data,error}=await client.from(DATA_TABLE).select('data,updated_at,updated_by').eq('workspace_id',WORKSPACE_ID).maybeSingle();
    if(version !== undefined && version !== sessionVersion) return {ok:false,stale:true};
    if(error){ setStatus('Conta conectada, mas os dados não puderam ser carregados.',accessErrorMessage(error)); return {ok:false,error}; }
    remoteUpdatedAt=data?.updated_at||'';
    if(data?.data && window.Store){
      try{
        window.__mayaAuthSyncing=true;
        Store.clearLocalCache();
        if(data.data.format) Store.importBackup(data.data);
      }catch(error){ setStatus('A cópia da nuvem está inválida.',accessErrorMessage(error)); return {ok:false,error}; }
      finally{ window.__mayaAuthSyncing=false; }
    }
    const displayName = profile?.display_name || profile?.username || user?.email || 'usuário';
    if(data) setStatus(`Conectado como ${displayName}. Última atualização: ${fmtDateTime(data.updated_at)}.`);
    else setStatus(`Conectado como ${displayName}. Ainda não há dados na nuvem.`);
    return {ok:true,row:data||null};
  }
  async function applySession(nextSession){
    const version = ++sessionVersion;
    user=nextSession?.user||null;
    profile=null;
    remoteUpdatedAt='';
    if(!user){ clearLocalCache(); setStatus(ready?'Faça login para acessar o sistema.':'Conectando ao sistema…'); emit(); return; }
    const result=await loadProfile(user);
    if(version !== sessionVersion) return;
    if(result.error || !result.data){
      clearLocalCache();
      setStatus('Esta conta ainda não recebeu um perfil de acesso.',accessErrorMessage(result.error));
      try{ await client.auth.signOut(); }catch(e){}
      return;
    }
    profile=result.data;
    if(version !== sessionVersion) return;
    if(!isNotExpired(profile)){
      clearLocalCache();
      setStatus(profile.active===false?'Este acesso está desativado.':'Este acesso expirou.');
      try{ await client.auth.signOut(); }catch(e){}
      return;
    }
    await loadWorkspace(version);
    if(version !== sessionVersion) return;
    if(isAdmin()) await refreshManagedUsers();
    emit();
  }
  async function loadClient(){
    try{
      const mod=await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm');
      client=mod.createClient(SUPABASE_URL,SUPABASE_ANON_KEY,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
      ready=true;
      client.auth.onAuthStateChange((_event,nextSession)=>{ setTimeout(()=>applySession(nextSession),0); });
      const current=await client.auth.getSession();
      loading=false;
      await applySession(current?.data?.session||null);
    }catch(error){
      loading=false; ready=false; clearLocalCache(); setStatus('Não foi possível conectar ao sistema.',accessErrorMessage(error));
    }
    emit();
  }
  async function signIn(){
    if(!ready){ say('A conexão ainda está carregando.'); return; }
    const {username,password}=formValues('auth');
    if(!validateCredentials(username,password)) return;
    syncing=true; setStatus('Entrando…');
    const {data,error}=await client.auth.signInWithPassword({email:emailForUsername(username),password});
    syncing=false;
    if(error){ setStatus(accessErrorMessage(error),error.message); say(accessErrorMessage(error)); return; }
    await applySession(data?.session||null);
    if(authenticated()) say(`Bem-vindo, ${profile?.display_name||profile?.username||user?.email||'usuário'}!`);
  }
  async function signOut(){
    if(!client) return;
    syncing=true;
    try{ await client.auth.signOut(); }catch(error){ setStatus('Não foi possível sair.',accessErrorMessage(error)); }
    sessionVersion++;
    syncing=false; user=null; profile=null; managedUsers=[]; clearLocalCache(); setStatus('Você saiu do sistema.'); emit();
  }
  async function pushLocal(ask){
    if(!authenticated()){ say('Entre no sistema antes de continuar.'); return false; }
    if(!canWrite()){ say('Este acesso é somente para visualização.'); return false; }
    if(ask && hasLocalData() && typeof window.confirmModal==='function'){
      const ok=await window.confirmModal('Salvar dados na nuvem','Os dados atuais substituirão a cópia compartilhada da empresa. Deseja continuar?','Salvar');
      if(!ok) return false;
    }
    syncing=true; setStatus('Salvando dados na nuvem…');
    const payload=Store.exportBackup();
    const stamp=new Date().toISOString();
    const {data,error}=await client.from(DATA_TABLE).upsert({workspace_id:WORKSPACE_ID,data:payload,updated_at:stamp,updated_by:user.id},{onConflict:'workspace_id'}).select('updated_at').single();
    syncing=false;
    if(error){ setStatus('Falha ao salvar na nuvem.',accessErrorMessage(error)); say(accessErrorMessage(error)); return false; }
    remoteUpdatedAt=data?.updated_at||stamp; setStatus(`Dados salvos na nuvem em ${fmtDateTime(remoteUpdatedAt)}.`); say('Dados salvos na nuvem!'); return true;
  }
  async function pullRemote(){
    if(!authenticated()){ say('Entre no sistema antes de continuar.'); return false; }
    const {data,error}=await client.from(DATA_TABLE).select('data,updated_at,updated_by').eq('workspace_id',WORKSPACE_ID).maybeSingle();
    if(error){ setStatus('Falha ao consultar a nuvem.',accessErrorMessage(error)); say(accessErrorMessage(error)); return false; }
    if(!data){ say('Ainda não há dados salvos na nuvem.'); return false; }
    if(canWrite() && typeof window.confirmModal==='function'){
      const ok=await window.confirmModal('Atualizar dados','A cópia compartilhada substituirá os dados exibidos neste aparelho. Deseja continuar?','Atualizar');
      if(!ok) return false;
    }
    try{
      syncing=true; setStatus('Carregando dados da nuvem…'); window.__mayaAuthSyncing=true; Store.clearLocalCache(); const result=Store.importBackup(data.data); remoteUpdatedAt=data.updated_at||''; setStatus(`Dados atualizados: ${result.budgets} orçamento(s), ${result.clients} cliente(s).`); if(typeof window.render==='function') window.render(); return true;
    }catch(error){ setStatus('A cópia da nuvem está inválida.',accessErrorMessage(error)); return false; }
    finally{ window.__mayaAuthSyncing=false; syncing=false; emit(); }
  }
  function schedulePush(){ if(authenticated() && canWrite() && !window.__mayaAuthSyncing){ clearTimeout(pushTimer); pushTimer=setTimeout(()=>pushLocal(false),900); } }

  async function refreshManagedUsers(){
    if(!isAdmin()) return [];
    const {data,error}=await client.from(ACCESS_TABLE).select('user_id,username,display_name,role,active,expires_at,created_at,updated_at').order('username');
    if(error){ setStatus('Não foi possível carregar os acessos.',accessErrorMessage(error)); return []; }
    managedUsers=data||[]; emit(); return managedUsers;
  }
  async function adminRequest(payload){
    const current=await client.auth.getSession();
    const token=current?.data?.session?.access_token||'';
    const response=await fetch(ADMIN_FUNCTION,{method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+token},body:JSON.stringify(payload)});
    const body=await response.json().catch(()=>({}));
    if(!response.ok) throw new Error(body.error||body.message||`Falha HTTP ${response.status}`);
    return body;
  }
  async function createManagedUser(){
    if(!isAdmin()){ say('Somente o administrador pode criar acessos.'); return; }
    const username=normalizeUsername(document.getElementById('adm-username')?.value||'');
    const password=String(document.getElementById('adm-password')?.value||'');
    const role=String(document.getElementById('adm-role')?.value||'visitante');
    const expiry=String(document.getElementById('adm-expiry')?.value||'');
    if(!validateCredentials(username,password)){ return; }
    if(!['admin','empresa','visitante'].includes(role)){ say('Perfil inválido.'); return; }
    syncing=true; setStatus('Criando acesso…');
    try{
      await adminRequest({action:'create',username,password,role,expires_at:expiry?new Date(expiry+'T23:59:59').toISOString():null});
      setStatus(`Acesso ${username} criado como ${roleLabel(role)}.`); say('Novo acesso criado!');
      const u=document.getElementById('adm-username'), p=document.getElementById('adm-password'); if(u) u.value=''; if(p) p.value='';
      await refreshManagedUsers();
    }catch(error){ setStatus('Não foi possível criar o acesso.',accessErrorMessage(error)); say(accessErrorMessage(error)); }
    finally{ syncing=false; emit(); }
  }
  async function updateManagedUser(userId){
    if(!isAdmin()){ say('Somente o administrador pode alterar acessos.'); return; }
    const row=managedUsers.find(x=>x.user_id===userId); if(!row) return;
    const role=document.getElementById('adm-edit-role-'+userId)?.value||row.role;
    const active=document.getElementById('adm-edit-active-'+userId)?.checked!==false;
    const expiry=document.getElementById('adm-edit-expiry-'+userId)?.value||'';
    if(userId===user?.id && (!active || role!=='admin')){ say('O administrador não pode remover o próprio acesso administrativo.'); return; }
    syncing=true;
    try{
      await adminRequest({action:'update',user_id:userId,role,active,expires_at:expiry?new Date(expiry+'T23:59:59').toISOString():null});
      await refreshManagedUsers(); say(active?'Acesso atualizado.':'Acesso bloqueado.');
    }catch(error){ setStatus('Não foi possível atualizar o acesso.',accessErrorMessage(error)); say(accessErrorMessage(error)); }
    finally{ syncing=false; emit(); }
  }

  function authGateHtml(){
    const loginLogo='<img src="maya-garden-logo.jpg" alt="MAYA Garden" class="maya-login-logo-img">';
    if(loading) return `<div class="maya-login-card"><div class="maya-login-mark maya-login-logo">${loginLogo}</div><h1>Conectando ao MAYA Garden</h1><p>Verificando o acesso seguro…</p></div>`;
    if(!ready) return `<div class="maya-login-card"><div class="maya-login-mark maya-login-logo">${loginLogo}</div><h1>Sistema indisponível</h1><p>${escCloud(status)}</p><button class="maya-btn" onclick="location.reload()">Tentar novamente</button></div>`;
    return `<div class="maya-login-card"><div class="maya-login-mark maya-login-logo">${loginLogo}</div><h1>MAYA Garden</h1><p class="maya-login-sub">Acesso online protegido</p><form onsubmit="event.preventDefault();cloudAuthSignIn()"><label class="font-bold text-sm">Usuário<input id="auth-username" class="maya-input mt-1" autocomplete="username" placeholder="seu usuário"></label><label class="font-bold text-sm mt-3">Senha<input id="auth-password" type="password" class="maya-input mt-1" autocomplete="current-password" placeholder="sua senha"></label><button class="maya-btn w-full mt-4" type="submit">Entrar no sistema</button></form><p class="maya-login-status">${escCloud(status)}</p><p class="maya-login-note">É necessário estar conectado à internet para usar o sistema.</p></div>`;
  }
  function accountHtml(){
    if(!authenticated()) return '<div class="text-sm" style="color:#9a2c2c">Sessão não autenticada.</div>';
    const expiry=profile.expires_at?`Acesso até ${fmtDateTime(profile.expires_at)}.`:'Acesso sem data de expiração.';
    const displayName = profile?.display_name || profile?.username || user?.email || 'usuário';
    return `<div class="flex items-start gap-3 flex-wrap"><div class="flex-1"><b style="color:var(--maya-accent)">${escCloud(displayName)}</b><div class="text-sm" style="color:var(--muted)">Usuário: ${escCloud(profile?.username||'')} • Perfil: ${escCloud(roleLabel(profile?.role))}<br>${expiry}</div></div><button class="maya-btn-ghost text-sm maya-session-action" onclick="cloudAuthSignOut()">Sair</button></div><div class="flex gap-2 mt-3 flex-wrap"><button class="maya-btn text-sm maya-session-action" onclick="cloudSyncPull()">Atualizar dados</button>${canWrite()?'<button class="maya-btn-ghost text-sm" onclick="cloudSyncPush(true)">Salvar dados agora</button>':''}</div><div class="text-xs mt-2" style="color:var(--muted)">${escCloud(status)}</div>`;
  }
  function adminHtml(){
    if(!isAdmin()) return '<div class="maya-card p-4"><b>Acesso restrito</b><p class="text-sm mt-1">Esta área é exclusiva do administrador.</p></div>';
    const rows=managedUsers.map(row=>`<div class="maya-card p-3 mb-2"><div class="flex items-center gap-2 flex-wrap"><div class="flex-1"><b>${escCloud(row.username)}</b><div class="text-xs" style="color:var(--muted)">${escCloud(row.display_name||'')} • criado em ${fmtDateTime(row.created_at)}</div></div><label class="text-xs font-bold">Perfil<select id="adm-edit-role-${row.user_id}" class="maya-select text-xs"><option value="admin" ${row.role==='admin'?'selected':''}>Administrador</option><option value="empresa" ${row.role==='empresa'?'selected':''}>Empresa</option><option value="visitante" ${row.role==='visitante'?'selected':''}>Visitante</option></select></label><label class="text-xs font-bold">Expira em<input id="adm-edit-expiry-${row.user_id}" type="date" class="maya-input text-xs" value="${escCloud(fmtDate(row.expires_at))}"></label><label class="text-xs font-bold flex items-center gap-1 mt-4"><input id="adm-edit-active-${row.user_id}" type="checkbox" ${row.active!==false?'checked':''}> ativo</label><button class="maya-btn-ghost text-xs" onclick="cloudAdminSave('${row.user_id}')">Salvar</button></div></div>`).join('');
    return `<div class="maya-card p-4 mb-3"><h2 class="font-extrabold">Criar novo acesso</h2><p class="text-xs mt-1" style="color:var(--muted)">O usuário entra com um nome simples; a conta segura é criada no Supabase.</p><div class="grid md:grid-cols-4 gap-2 mt-3"><label class="font-bold text-sm">Usuário<input id="adm-username" class="maya-input" placeholder="ex.: equipe2"></label><label class="font-bold text-sm">Senha<input id="adm-password" type="password" class="maya-input" placeholder="mínimo 5 caracteres"></label><label class="font-bold text-sm">Perfil<select id="adm-role" class="maya-select"><option value="visitante">Visitante</option><option value="empresa">Empresa</option><option value="admin">Administrador</option></select></label><label class="font-bold text-sm">Expira em<input id="adm-expiry" type="date" class="maya-input"><span class="text-xs font-normal" style="color:var(--muted)">vazio = infinito</span></label></div><button class="maya-btn mt-3" onclick="cloudAdminCreate()">Criar acesso</button></div><h2 class="font-extrabold mb-2">Acessos cadastrados</h2>${rows||'<div class="maya-card p-4 text-sm">Nenhum acesso cadastrado.</div>'}`;
  }

  window.MayaAuth={get ready(){return ready;},get loading(){return loading;},get authenticated(){return authenticated();},get user(){return user;},get profile(){return profile;},get role(){return profile?.role||'';},get status(){return status;},get lastError(){return lastError;},canWrite,isAdmin,roleLabel,usernameToEmail:emailForUsername};
  window.CloudSync={get ready(){return ready;},get user(){return user;},get profile(){return profile;},get syncing(){return syncing;},get status(){return status;},get managedUsers(){return managedUsers;},authGateHtml,accountHtml,adminHtml,signIn,pushLocal,pullRemote,signOut,refreshManagedUsers,createManagedUser,updateManagedUser,schedulePush};
  window.cloudAuthSignIn=()=>signIn();
  window.cloudAuthSignOut=()=>signOut();
  window.cloudSyncPush=ask=>pushLocal(ask===true);
  window.cloudSyncPull=()=>pullRemote();
  window.cloudAdminCreate=()=>createManagedUser();
  window.cloudAdminSave=id=>updateManagedUser(id);
  window.addEventListener('maya-store-changed',schedulePush);
  loadClient();
})();
