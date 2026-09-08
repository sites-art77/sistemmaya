/* MAYA Garden — storage offline-first (localStorage) */
const K = {
  settings: 'maya_settings_v1',
  catalog: 'maya_catalog_v1',
  clients: 'maya_clients_v1',
  budgets: 'maya_budgets_v1',
  visits: 'maya_visits_v1',
  pricing: 'maya_pricing_v1',
  contracts: 'maya_contracts_v1',
  packages: 'maya_packages_v1',
  os: 'maya_os_v1',
  osseq: 'maya_os_seq_v1',
  seq: 'maya_seq_v1'
};

const defaultSettings = {
  company: 'MAYA Garden',
  tagline: 'Jardinagem • Especialista em Orquídeas • Paisagismo',
  whatsappDisplay: '(24) 99262-8213',
  whatsappLink: '5524992628213',
  instagram: '@mayagarden',
  address: 'Petrópolis - RJ',
  pix: '',
  cnpj: '',
  email: '',
  terms: 'Proposta válida até a data indicada. Valores incluem mão de obra e materiais descritos nos itens. Pagamento conforme condição indicada. Manutenção e garantia conforme observações do orçamento.',
  zapTemplate: 'Olá {nome}! Aqui é {empresa} Orçamento Nº {numero}: {total} válido até {validade}. Segue PDF em anexo.',
  zapFollow: 'Olá {nome}! Aqui é {empresa}. O orçamento Nº {numero} ({total}) segue em aberto há {dias} dias. Posso ajudar com alguma dúvida?',
  validityDays: 15,
  signalPct: 50,
  displacementDefault: 60,
  headerText: 'Orçamento profissional — válido mediante aprovação no prazo.',
  footerText: 'Obrigado pela preferência! MAYA Garden — jardins vivos em Petrópolis.',
  logoPath: 'assets/maya-garden-logo.jpg',
  wmOpacity: 0.09,
  wmSizePct: 60,
  wmEnabled: true
};

const defaultCatalog = [
  {id:'c1', cat:'Jardinagem', name:'Corte de grama (m²)', desc:'Corte + acabamento + limpeza leve', unit:'m²', price:8},
  {id:'c2', cat:'Jardinagem', name:'Poda de arbustos (un)', desc:'Poda ornamental + remoção', unit:'un', price:60},
  {id:'c3', cat:'Jardinagem', name:'Limpeza de terreno / quintal', desc:'Retirada folhas, galhos e descarte', unit:'serviço', price:300},
  {id:'c4', cat:'Jardinagem', name:'Adubação NPK + orgânica', desc:'Adubação equilibrada + cobertura', unit:'aplicação', price:120},
  {id:'c5', cat:'Jardinagem', name:'Controle pragas/fungos', desc:'Preventivo bimestral', unit:'aplicação', price:160},
  {id:'c6', cat:'Orquídeas', name:'Replantio orquídea (vaso)', desc:'Substrato pinus+carvão+coco + vaso', unit:'vaso', price:55},
  {id:'c7', cat:'Orquídeas', name:'Manutenção orquidário (visita)', desc:'Limpeza, adubo, fitossanitário', unit:'visita', price:180},
  {id:'c8', cat:'Orquídeas', name:'Orquidário simples 2m²', desc:'Prateleira + sombrite + 10 vasos iniciais', unit:'projeto', price:900},
  {id:'c9', cat:'Paisagismo', name:'Projeto paisagístico (m²)', desc:'Layout + espécies + memorial simples', unit:'m²', price:40},
  {id:'c10', cat:'Paisagismo', name:'Plantio árvore/arbusto (un)', desc:'Cova + substrato + plantio', unit:'un', price:150},
  {id:'c11', cat:'Paisagismo', name:'Implantação jardim completo (m²)', desc:'Grama + canteiros + vasos', unit:'m²', price:220},
  {id:'c12', cat:'Paisagismo', name:'Irrigação simples (m²)', desc:'Mangueira + aspersores básicos', unit:'m²', price:30},
  {id:'c13', cat:'Insumos', name:'Substrato orquídea 5kg', desc:'Pinus + carvão + fibra coco', unit:'saco', price:60},
  {id:'c14', cat:'Insumos', name:'Sombrite 2m² instalado', desc:'Tela 50-70% + fixação', unit:'m²', price:100},
  {id:'c15', cat:'Mão de obra', name:'Hora jardineiro', desc:'Equipe MAYA em campo', unit:'hora', price:55},
  {id:'c16', cat:'Mão de obra', name:'Deslocamento Petrópolis', desc:'Taxa visita / transporte', unit:'taxa', price:60}
];

const defaultPackages = [
  {id:'pk1', name:'Manutenção Essencial', desc:'Corte, limpeza e adubação leve (até 80m²)',
   items:[{desc:'Corte de grama + acabamento',qty:50,unitLabel:'m²',unit:8},{desc:'Limpeza leve + remoção de folhas',qty:1,unitLabel:'serviço',unit:120},{desc:'Adubação leve NPK',qty:1,unitLabel:'aplicação',unit:90}]},
  {id:'pk2', name:'Revitalização do Jardim', desc:'Poda, limpeza pesada e cobertura',
   items:[{desc:'Poda ornamental de arbustos',qty:6,unitLabel:'un',unit:60},{desc:'Limpeza pesada + descarte',qty:1,unitLabel:'serviço',unit:320},{desc:'Adubação orgânica + cobertura morta',qty:1,unitLabel:'aplicação',unit:180}]},
  {id:'pk3', name:'Cuidado Orquídeas (10 vasos)', desc:'Replantio + substrato + adubo',
   items:[{desc:'Replantio com substrato premium',qty:10,unitLabel:'vaso',unit:55},{desc:'Adubação foliar + fitossanitário',qty:1,unitLabel:'aplicação',unit:110}]}
];

const defaultPricing = {
  marginPct: 30,
  horaMin: 30, horaIdeal: 55, horaMax: 80,
  m2ManutMin: 4, m2ManutIdeal: 6.5, m2ManutMax: 12,
  m2ImplMin: 80, m2ImplIdeal: 180, m2ImplMax: 350,
  projetoM2Min: 20, projetoM2Ideal: 40, projetoM2Max: 60,
  vasoMin: 30, vasoIdeal: 55, vasoMax: 80,
  visitaOrqMin: 120, visitaOrqIdeal: 180, visitaOrqMax: 280,
  orquidarioMin: 400, orquidarioIdeal: 900, orquidarioMax: 1500,
  freqQuinzenalMult: 1.7, freqSemanalMult: 3.5, freqSemanalDesc: 10,
  cxSimples: 1.0, cxMedio: 1.2, cxPremium: 1.45
};

function load(key, fallback){
  try{
    const raw = localStorage.getItem(key);
    if(!raw) return structuredClone(fallback);
    return JSON.parse(raw);
  }catch{ return structuredClone(fallback); }
}
function save(key, val){ localStorage.setItem(key, JSON.stringify(val)); }

const Store = {
  get settings(){ const s = load(K.settings, defaultSettings); if(s && s.logoPath==='assets/maya-garden-logo.svg') s.logoPath='assets/maya-garden-logo.jpg'; if(s && s.zapTemplate) s.zapTemplate = String(s.zapTemplate).replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{FE0F}]/gu,'').replace(/ {2,}/g,' '); return s; },
  set settings(v){ save(K.settings, v); },
  get catalog(){ const c = load(K.catalog, defaultCatalog); return Array.isArray(c)&&c.length?c:structuredClone(defaultCatalog); },
  set catalog(v){ save(K.catalog, v); },
  get clients(){ return load(K.clients, []); },
  set clients(v){ save(K.clients, v); },
  get budgets(){ return load(K.budgets, []); },
  set budgets(v){ save(K.budgets, v); },
  get visits(){ return load(K.visits, []); },
  set visits(v){ save(K.visits, v); },
  get pricing(){ return {...structuredClone(defaultPricing), ...load(K.pricing, {})}; },
  set pricing(v){ save(K.pricing, v); },
  get contracts(){ return load(K.contracts, []); },
  set contracts(v){ save(K.contracts, v); },
  get os(){ return load(K.os, []); },
  set os(v){ save(K.os, v); },
  nextOSNumber(){ let seq=parseInt(localStorage.getItem(K.osseq)||'0',10)+1; localStorage.setItem(K.osseq,String(seq)); const year=new Date().getFullYear(); return `OS-${year}-${String(seq).padStart(4,'0')}`; },
  get packages(){ const p = load(K.packages, defaultPackages); return Array.isArray(p)&&p.length?p:structuredClone(defaultPackages); },
  set packages(v){ save(K.packages, v); },
  uid(){ return 'id-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,7); },
  nextNumber(){
    let seq = parseInt(localStorage.getItem(K.seq) || '0', 10) + 1;
    localStorage.setItem(K.seq, String(seq));
    const year = new Date().getFullYear();
    // garante unicidade da numeração
    const existing = new Set((this.budgets||[]).map(b=>b.number));
    let n = seq;
    while(existing.has(`${year}-${String(n).padStart(4,'0')}`)) n++;
    if(n!==seq) localStorage.setItem(K.seq, String(n));
    return `${year}-${String(n).padStart(4,'0')}`;
  },
  resetAll(){ Object.values(K).forEach(k=>localStorage.removeItem(k)); try{ ['maya_last_backup','maya_rep_seen','maya_onb_hide'].forEach(k=>localStorage.removeItem(k)); }catch(e){} }
};
window.Store = Store;
try{ localStorage.removeItem('maya_logo_custom_v1'); }catch(e){}
