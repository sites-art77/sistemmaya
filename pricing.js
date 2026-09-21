/* MAYA Garden — Assistente Dica de Preço (100% editável via Config > Tabela) */
function getPricing(){ return Store.pricing; }

function cxMult(complexidade, p){
  if(complexidade==='medio') return Number(p.cxMedio||1.2);
  if(complexidade==='premium') return Number(p.cxPremium||1.45);
  return Number(p.cxSimples||1);
}
function freqMult(freq, p){
  if(freq==='quinzenal') return Number(p.freqQuinzenalMult||1.7);
  if(freq==='semanal') return Number(p.freqSemanalMult||3.5);
  return 1;
}
function rateOf(p, key, alias, fallback){
  const v=Number(p[key]);
  if(Number.isFinite(v) && v>0) return v;
  if(alias){ const a=Number(p[alias]); if(Number.isFinite(a) && a>0) return a; }
  return Number(fallback)||0;
}

/* Entrada: {tipo, area, horas, qtd, freq, complexidade, insumos, desloc}
   Tipos: manutencao_m2 | implantacao_m2 | grama_m2 | irrigacao_m2 | hora | vaso | orquidario | projeto_m2 | visita */
function sugerirPreco(inp){
  const p = getPricing();
  const cx = cxMult(inp.complexidade||'simples', p);
  const fq = freqMult(inp.freq||'mensal', p);
  const insumos = Number(inp.insumos||0);
  const deslocRaw = inp.desloc;
  const desloc = (deslocRaw===undefined || deslocRaw===null || deslocRaw==='')
    ? Number(Store.settings?.displacementDefault||0)
    : Number(deslocRaw);
  const marginPct = Number(p.marginPct);
  const margemPct = Number.isFinite(marginPct) ? marginPct : 30;
  const margem = (100 + margemPct)/100;
  let baseMin=0, baseIdeal=0, baseMax=0, memoria='';

  switch(inp.tipo){
    case 'manutencao_m2':{
      const a = Number(inp.area||0);
      baseMin = a*rateOf(p,'m2ManutMin',null,4); baseIdeal = a*rateOf(p,'m2ManutIdeal',null,6.5); baseMax = a*rateOf(p,'m2ManutMax',null,12);
      baseMin*=cx; baseIdeal*=cx; baseMax*=cx;
      baseMin*=fq; baseIdeal*=fq; baseMax*=fq;
      if(inp.freq==='semanal'){ const d=Number(p.freqSemanalDesc||0)/100; baseMin*=(1-d); baseIdeal*=(1-d); baseMax*=(1-d); }
      memoria = `${a}m² manutenção × R$/m² × padrão ${cx} × freq ${fq}`;
      break;
    }
    case 'grama_m2':{
      const a = Number(inp.area||0);
      const ideal=rateOf(p,'m2GramaIdeal','m2Grama',8);
      baseMin = a*rateOf(p,'m2GramaMin',null,ideal)*cx;
      baseIdeal = a*ideal*cx;
      baseMax = a*rateOf(p,'m2GramaMax',null,ideal)*cx;
      memoria = `${a}m² corte de grama × ${ideal}/m² × padrão ${cx}`;
      break;
    }
    case 'irrigacao_m2':{
      const a = Number(inp.area||0);
      const ideal=rateOf(p,'m2IrrigacaoIdeal','m2Irrigacao',30);
      baseMin = a*rateOf(p,'m2IrrigacaoMin',null,ideal)*cx;
      baseIdeal = a*ideal*cx;
      baseMax = a*rateOf(p,'m2IrrigacaoMax',null,ideal)*cx;
      memoria = `${a}m² irrigação × ${ideal}/m² × padrão ${cx}`;
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
      baseMin = Math.max(2000, a*Number(p.projetoM2Min));
      baseIdeal = Math.max(2000, a*Number(p.projetoM2Ideal));
      baseMax = Math.max(2000, a*Number(p.projetoM2Max));
      if(baseIdeal < baseMin) baseIdeal = baseMin;
      if(baseMax < baseIdeal) baseMax = baseIdeal;
      memoria = `${a}m² projeto (${p.projetoM2Min}/${p.projetoM2Ideal}/${p.projetoM2Max}), mínimo R$2000`;
      break;
    }
    default:{ // visita / genérico: custo + margem
      const custo = insumos + desloc + (Number(inp.horas||0)*Number(p.horaIdeal));
      baseIdeal = custo*margem; baseMin = custo*1.1; baseMax = custo*(margem+0.35);
      memoria = `custo (insumos ${insumos}+desloc ${desloc}+horas) × margem ${margemPct}%`;
    }
  }
  // soma insumos+desloc nos tipos por m²/hora/vaso (fora do genérico que já incluiu)
  if(!['visita','generico'].includes(inp.tipo)){
    baseMin += insumos+desloc; baseIdeal += insumos+desloc; baseMax += insumos+desloc;
    if(insumos+desloc>0) memoria += ` + insumos/desloc R$${insumos+desloc}`;
  }
  const r = v => Math.round(v);
  return { min:r(baseMin), ideal:r(baseIdeal), max:r(baseMax), memoria, margemPct };
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
