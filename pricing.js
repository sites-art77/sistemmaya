/* MAYA Garden — Assistente Dica de Preço (100% editável via Config > Tabela) */
function getPricing(){ return Store.pricing; }

function cxMult(complexidade, p){
  if(complexidade==='medio') return p.cxMedio;
  if(complexidade==='premium') return p.cxPremium;
  return p.cxSimples;
}
function freqMult(freq, p){
  if(freq==='quinzenal') return p.freqQuinzenalMult;
  if(freq==='semanal') return p.freqSemanalMult;
  return 1;
}

/* Entrada: {tipo, area, horas, qtd, freq, complexidade, insumos, desloc}
   Tipos: manutencao_m2 | implantacao_m2 | hora | vaso | orquidario | projeto_m2 | plantio_un | visita */
function sugerirPreco(inp){
  const p = getPricing();
  const cx = cxMult(inp.complexidade||'simples', p);
  const fq = freqMult(inp.freq||'mensal', p);
  const insumos = Number(inp.insumos||0);
  const desloc = Number(inp.desloc||Store.settings.displacementDefault||0);
  const margem = (100 + Number(p.marginPct||30))/100;
  let baseMin=0, baseIdeal=0, baseMax=0, memoria='';

  switch(inp.tipo){
    case 'manutencao_m2':{
      const a = Number(inp.area||0);
      baseMin = a*Number(p.m2ManutMin); baseIdeal = a*Number(p.m2ManutIdeal); baseMax = a*Number(p.m2ManutMax);
      baseMin*=cx; baseIdeal*=cx; baseMax*=cx;
      baseMin*=fq; baseIdeal*=fq; baseMax*=fq;
      if(inp.freq==='semanal'){ const d=Number(p.freqSemanalDesc||0)/100; baseMin*=(1-d); baseIdeal*=(1-d); baseMax*=(1-d); }
      memoria = `${a}m² × R$/m² (${p.m2ManutMin}/${p.m2ManutIdeal}/${p.m2ManutMax}) × complexidade ${cx} × freq ${fq}`;
      break;
    }
    case 'implantacao_m2':{
      const a = Number(inp.area||0);
      baseMin = a*Number(p.m2ImplMin)*cx; baseIdeal = a*Number(p.m2ImplIdeal)*cx; baseMax = a*Number(p.m2ImplMax)*cx;
      memoria = `${a}m² × implantação (${p.m2ImplMin}/${p.m2ImplIdeal}/${p.m2ImplMax}) × cx ${cx}`;
      break;
    }
    case 'hora':{
      const h = Number(inp.horas||1);
      baseMin = h*Number(p.horaMin); baseIdeal = h*Number(p.horaIdeal); baseMax = h*Number(p.horaMax);
      memoria = `${h}h × R$/h (${p.horaMin}/${p.horaIdeal}/${p.horaMax})`;
      break;
    }
    case 'vaso':{
      const q = Number(inp.qtd||1);
      baseMin = q*Number(p.vasoMin); baseIdeal = q*Number(p.vasoIdeal); baseMax = q*Number(p.vasoMax);
      memoria = `${q} vasos × (${p.vasoMin}/${p.vasoIdeal}/${p.vasoMax})`;
      break;
    }
    case 'orquidario':{
      baseMin = Number(p.orquidarioMin); baseIdeal = Number(p.orquidarioIdeal); baseMax = Number(p.orquidarioMax);
      baseMin*=cx; baseIdeal*=cx; baseMax*=cx;
      memoria = `orquidário base (${p.orquidarioMin}/${p.orquidarioIdeal}/${p.orquidarioMax}) × cx ${cx}`;
      break;
    }
    case 'projeto_m2':{
      const a = Number(inp.area||0);
      baseMin = Math.max(2000, a*Number(p.projetoM2Min)); baseIdeal = Math.max(2000, a*Number(p.projetoM2Ideal)); baseMax = a*Number(p.projetoM2Max);
      memoria = `${a}m² projeto (${p.projetoM2Min}/${p.projetoM2Ideal}/${p.projetoM2Max}), mínimo R$2000`;
      break;
    }
    default:{ // visita / genérico: custo + margem
      const custo = insumos + desloc + (Number(inp.horas||0)*Number(p.horaIdeal));
      baseIdeal = custo*margem; baseMin = custo*1.1; baseMax = custo*(margem+0.35);
      memoria = `custo (insumos ${insumos}+desloc ${desloc}+horas) × margem ${p.marginPct}%`;
    }
  }
  // soma insumos+desloc nos tipos por m²/hora/vaso (fora do genérico que já incluiu)
  if(!['visita','generico'].includes(inp.tipo)){
    baseMin += insumos+desloc; baseIdeal += insumos+desloc; baseMax += insumos+desloc;
    if(insumos+desloc>0) memoria += ` + insumos/desloc R$${insumos+desloc}`;
  }
  const r = v => Math.round(v);
  return { min:r(baseMin), ideal:r(baseIdeal), max:r(baseMax), memoria, margemPct:Number(p.marginPct||30) };
}

function avaliarPreco(valorDigitado, sugestao){
  valorDigitado = Number(valorDigitado||0);
  if(!valorDigitado || !sugestao) return {nivel:'ok', msg:''};
  if(valorDigitado < sugestao.min) return {nivel:'baixo', msg:`Abaixo do mercado (mín R$${sugestao.min}). Risco de prejuízo.`};
  if(valorDigitado > sugestao.max*1.4) return {nivel:'alto', msg:`Bem acima do teto (máx ref R$${sugestao.max}). Justifique no campo observações.`};
  if(valorDigitado >= sugestao.min && valorDigitado <= sugestao.max) return {nivel:'ok', msg:`Dentro da faixa saudável R$${sugestao.min}–R$${sugestao.max}.`};
  return {nivel:'ok', msg:''};
}
window.sugerirPreco = sugerirPreco;
window.avaliarPreco = avaliarPreco;
