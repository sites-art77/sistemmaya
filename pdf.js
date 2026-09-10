/* MAYA Garden — PDF com marca d'água do logo em TODAS as páginas */
async function loadImageDataUrl(src){
  // logo oficial fixo da empresa
  try{
    const res = await fetch(src, {cache:'force-cache'});
    const blob = await res.blob();
    const bmp = await createImageBitmap(blob);
    const c = document.createElement('canvas');
    // limita para não estourar o PDF
    const max = 900; const sc = Math.min(1, max/Math.max(bmp.width,bmp.height));
    c.width = Math.round(bmp.width*sc); c.height = Math.round(bmp.height*sc);
    c.getContext('2d').drawImage(bmp,0,0,c.width,c.height);
    return c.toDataURL('image/png');
  }catch(e){ return null; }
}

function brlPDF(v){ return (Number(v)||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'}); }
function safeFile(s){ return String(s||'Cliente').normalize('NFC').replace(/[<>:"/\\|?*\u0000-\u001F]/g,' ').replace(/\s+/g,' ').trim().slice(0,56)||'Cliente'; }

function fmtDPDF(iso){ try{ const p=String(iso||'').slice(0,10).split('-'); return p.length===3?`${p[2]}/${p[1]}/${p[0]}`:String(iso||''); }catch{ return String(iso||''); } }

async function gerarPDF(budget){
  const { jsPDF } = window.jspdf;
  const st = Store.settings;
  const doc = new jsPDF({unit:'mm', format:'a4'});
  const W = 210, H = 297, M = 14;
  const wmOpacity = st.wmEnabled ? Number(st.wmOpacity ?? 0.09) : 0;
  const logoUrl = await loadImageDataUrl(st.logoPath);

  function watermark(){
    if(!wmOpacity) return;
    try{
      doc.saveGraphicsState();
      doc.setGState(new doc.GState({opacity: wmOpacity}));
      const sizePct = Number(st.wmSizePct||60)/100;
      const s = Math.min(W,H)*sizePct*1.35; // ~120mm em 60%
      if(logoUrl){
        try{ doc.addImage(logoUrl,'PNG',(W-s)/2,(H-s)/2-8,s,s,'wm'); }
        catch{ doc.addImage(logoUrl,'JPEG',(W-s)/2,(H-s)/2-8,s,s,'wm'); }
      }else{
        doc.setFont('helvetica','bold'); doc.setFontSize(34); doc.setTextColor(26,93,26);
        doc.text('MAYA Garden', W/2, H/2, {align:'center', angle: -25});
      }
      doc.restoreGraphicsState();
    }catch(e){ /* mantém PDF mesmo sem GState */ }
  }
  function headerFooter(page, pages){
    // header
    doc.setFillColor(26,93,26); doc.rect(0,0,W,26,'F');
    if(logoUrl){ try{ doc.addImage(logoUrl,'PNG',M,4,18,18,'logo'); }catch{ try{doc.addImage(logoUrl,'JPEG',M,4,18,18,'logo');}catch{}} }
    doc.setTextColor(255,255,255); doc.setFont('helvetica','bold'); doc.setFontSize(13);
    doc.text(st.company||'MAYA Garden', M+22, 11);
    doc.setFontSize(8); doc.setFont('helvetica','normal');
    doc.text(st.tagline||'', M+22, 16);
    const contact2 = [st.address||'', st.whatsappDisplay?('Whats '+st.whatsappDisplay):'', st.instagram||'', st.email||'', st.cnpj?('CNPJ '+st.cnpj):''].filter(Boolean).join('  •  ');
    doc.text(contact2.slice(0,110), M+22, 20.5);
    doc.setFontSize(9); doc.setFont('helvetica','bold');
    doc.text(`Nº ${budget.number}`, W-M, 11, {align:'right'});
    doc.setFontSize(8); doc.setFont('helvetica','normal');
    doc.text(`Emissão ${fmtDPDF(budget.date)}   Validade ${fmtDPDF(budget.validity)}`, W-M, 16, {align:'right'});
    doc.setFontSize(8); doc.setFont('helvetica','bold');
    const stColor = {pendente:[138,109,0],aprovado:[20,100,20],recusado:[161,26,26],expirado:[90,90,90]}[budget.status]||[60,60,60];
    doc.setTextColor(...stColor);
    doc.text(String(budget.status||'').toUpperCase(), W-M, 20.5, {align:'right'});
    doc.setTextColor(20,20,20);
    // footer
    doc.setFontSize(7.5); doc.setTextColor(110,110,110);
    doc.text(st.footerText||'', W/2, H-10, {align:'center'});
    doc.text(`Página ${page} de ${pages}  •  ${st.company}${st.email?('  •  '+st.email):''}  •  Whats ${st.whatsappDisplay||''}`, W/2, H-6.5, {align:'center'});
    doc.setTextColor(20,20,20);
  }

  // ---- monta conteúdo em páginas lógicas (tabela pode quebrar) ----
  // Estratégia: desenha tudo, conta páginas, depois aplica watermark+header/footer em cada página.
  let y = 34;
  doc.setFontSize(10);
  // cliente box
  doc.setFillColor(245,241,232); doc.roundedRect(M,y,W-2*M,27,2,2,'F');
  doc.setFont('helvetica','bold'); doc.setFontSize(10);
  doc.text(`Cliente: ${budget.client?.name||'-'}`, M+3, y+7);
  doc.setFont('helvetica','normal'); doc.setFontSize(9);
  doc.text(`Zap: ${budget.client?.phone||'-'}    End: ${budget.client?.address||'-'}`, M+3, y+13);
  doc.text(`Pagamento: ${(typeof payLabel==='function'?payLabel(budget):(budget.payment||'-'))}${budget.contractId?'  •  Contrato recorrente':''}    Proposta válida até ${fmtDPDF(budget.validity)}`, M+3, y+19);
  if(budget.contractId) doc.text('Contrato de manutenção recorrente', M+3, y+24);
  y += 32;

  // tabela itens
  const colX = [M, M+108, M+128, M+152];
  function tableHead(yy){
    doc.setFillColor(26,93,26); doc.rect(M,yy,W-2*M,8,'F');
    doc.setTextColor(255,255,255); doc.setFont('helvetica','bold'); doc.setFontSize(8.5);
    doc.text('Descrição', colX[0]+2, yy+5.5);
    doc.text('Qtd', colX[1]+2, yy+5.5); doc.text('Unit', colX[2]+2, yy+5.5); doc.text('Total', colX[3]+2, yy+5.5);
    doc.setTextColor(20,20,20);
  }
  tableHead(y); y+=11;
  doc.setFont('helvetica','normal'); doc.setFontSize(9);
  const lineH = 6;
  for(const it of (budget.items||[])){
    const desc = String(it.desc||'').slice(0,90);
    const lines = doc.splitTextToSize(desc, 100);
    const h = Math.max(lineH, lines.length*4.6+2);
    if(y+h > H-58){ doc.addPage(); y=34; tableHead(y); y+=11; }
    doc.text(lines, colX[0]+2, y+4);
    doc.text(String(it.qty??'')+(it.unitLabel?' '+String(it.unitLabel).slice(0,8):''), colX[1]+2, y+4);
    doc.text(brlPDF(it.unit), colX[2]+2, y+4);
    doc.text(brlPDF((Number(it.qty)||0)*(Number(it.unit)||0)), colX[3]+2, y+4);
    // linha divisória
    doc.setDrawColor(225,230,210); doc.line(M, y+h-1, W-M, y+h-1);
    y += h;
  }
  y += 3;
  if(y > H-70){ doc.addPage(); y=34; }
  // valor final apresentado ao cliente; os cálculos internos não são expostos no PDF
  const rx = W-M-76;
  if(Number(budget.displacement)>0){
    doc.setFont('helvetica','normal'); doc.setFontSize(9); doc.setTextColor(70,70,70);
    doc.text(`Taxa de deslocamento: ${brlPDF(budget.displacement)}`, rx, y);
    y += 5.5;
  }
  doc.setFillColor(232,244,233);
  doc.setDrawColor(180,214,184);
  doc.roundedRect(rx-5, y-5, 81, 15, 2.5, 2.5, 'FD');
  doc.setFont('helvetica','bold'); doc.setFontSize(8); doc.setTextColor(60,100,65);
  doc.text('VALOR TOTAL', rx, y-0.5);
  doc.setFontSize(12); doc.setTextColor(26,93,26);
  doc.text(brlPDF(budget.total), rx, y+6);
  doc.setTextColor(20,20,20); y+=17;
  if(Number(budget.signalPct)>0){
    doc.setFont('helvetica','normal'); doc.setFontSize(9);
    const payment = `Condição de pagamento: sinal de ${budget.signalPct}% (${brlPDF(budget.total*Number(budget.signalPct)/100)}) • saldo na conclusão (${brlPDF(budget.total*(1-Number(budget.signalPct)/100))})`;
    const paymentLines = doc.splitTextToSize(payment, W-2*M);
    doc.text(paymentLines, M, y); y += paymentLines.length*4.5 + 2;
  }
  if(budget.notes){
    doc.setFont('helvetica','bold'); doc.setFontSize(9); doc.text('Observações:', M, y); y+=5;
    doc.setFont('helvetica','normal');
    const nl = doc.splitTextToSize(String(budget.notes), W-2*M);
    for(const l of nl){ if(y>H-40){doc.addPage(); y=34;} doc.text(l, M, y); y+=4.5; }
    y+=2;
  }
  if(y>H-45){ doc.addPage(); y=34; }
  doc.setFontSize(8.5); doc.setTextColor(90,90,90);
  const val = doc.splitTextToSize(`Validade: ${fmtDPDF(budget.validity)} • ${st.headerText||''}${st.pix?` • Pix: ${st.pix}`:''}`, W-2*M);
  doc.text(val, M, y); y+= val.length*4 + 4;
  if(st.terms){ doc.setFont('helvetica','bold'); doc.setFontSize(9); doc.setTextColor(60,60,60); doc.text('Condições:', M, y); y+=5;
    doc.setFont('helvetica','normal'); doc.setFontSize(8.5); doc.setTextColor(90,90,90);
    const tl = doc.splitTextToSize(String(st.terms), W-2*M);
    for(const l of tl){ if(y>H-42){doc.addPage(); y=34;} doc.text(l, M, y); y+=4.2; }
    y+=2;
  }
  doc.setTextColor(20,20,20);
  // fotos antes/depois (2 por linha)
  const photos = Array.isArray(budget.photos)?budget.photos:[];
  if(photos.length){
    if(y>H-110){ doc.addPage(); y=34; }
    y+=2; doc.setFont('helvetica','bold'); doc.setFontSize(11); doc.setTextColor(26,93,26);
    doc.text('Registro fotográfico', M, y); y+=4;
    doc.setDrawColor(26,93,26); doc.setLineWidth(0.6); doc.line(M, y, W-M, y); y+=6; doc.setLineWidth(0.2);
    const gap=6, cw=(W-2*M-gap)/2, chh=62;
    for(let i=0;i<photos.length;i+=2){
      if(y+chh+8>H-20){ doc.addPage(); y=34; }
      for(let k=0;k<2;k++){ const p=photos[i+k]; if(!p) break;
        const x=M+k*(cw+gap);
        try{ doc.addImage(p.src, p.src.indexOf('image/png')>=0?'PNG':'JPEG', x, y, cw, chh); }
        catch(e){ doc.setDrawColor(200,200,200); doc.rect(x,y,cw,chh); }
        doc.setFont('helvetica','normal'); doc.setFontSize(8); doc.setTextColor(80,80,80);
        doc.text(String(p.label||`Foto ${i+k+1}`).slice(0,48), x+2, y+chh+5);
      }
      y+=chh+11;
    }
    doc.setTextColor(20,20,20);
  }
  // encerramento profissional (sem assinaturas)
  y += 4;
  doc.setDrawColor(26,93,26); doc.setLineWidth(0.6); doc.line(M, y, W-M, y); y += 6;
  doc.setFont('helvetica','bold'); doc.setFontSize(10); doc.setTextColor(26,93,26);
  doc.text('Atenciosamente,', M, y); y += 5;
  doc.setFontSize(11); doc.text(st.company||'MAYA Garden', M, y); y += 5;
  doc.setFont('helvetica','normal'); doc.setFontSize(9); doc.setTextColor(60,60,60);
  doc.text(`${st.tagline||''}`, M, y); y += 5;
  doc.text(`WhatsApp ${st.whatsappDisplay||''}  •  ${st.instagram||''}  •  ${st.address||''}`, M, y); y += 5;
  doc.setFontSize(8.5); doc.setTextColor(110,110,110);
  doc.text('Este orçamento tem validade conforme data indicada. Valores sujeitos a reajuste após o vencimento.', M, y);
  doc.setTextColor(20,20,20); doc.setLineWidth(0.2);

  const pages = doc.getNumberOfPages();
  for(let i=1;i<=pages;i++){ doc.setPage(i); watermark(); headerFooter(i,pages); }
  // header/footer foram desenhados após watermark? Reordem: watermark por cima com opacity baixa = legível. Mantém.
  const fname = `MAYA Garden - Orçamento ${budget.number} - ${safeFile(budget.client?.name)}.pdf`;
  doc.save(fname);
}
window.gerarPDF = gerarPDF;

/* ---------- valor por extenso (reais) ---------- */
function chunk3(n){ const U=['','um','dois','três','quatro','cinco','seis','sete','oito','nove','dez','onze','doze','treze','quatorze','quinze','dezesseis','dezessete','dezoito','dezenove'];
  const D=['','','vinte','trinta','quarenta','cinquenta','sessenta','setenta','oitenta','noventa'];
  const H=['','cento','duzentos','trezentos','quatrocentos','quinhentos','seiscentos','setecentos','oitocentos','novecentos'];
  if(n===100) return 'cem'; const h=Math.floor(n/100), r=n%100;
  let s=h?H[h]:''; if(r) s=s?s+' e '+(r<20?U[r]:(D[Math.floor(r/10)]+(r%10?' e '+U[r%10]:''))):(r<20?U[r]:(D[Math.floor(r/10)]+(r%10?' e '+U[r%10]:'')));
  return s; }
function reaisWords(n){ const mi=Math.floor(n/1e6), th=Math.floor((n%1e6)/1e3), un=n%1e3; const items=[];
  if(mi) items.push({w:mi===1?'um milhão':chunk3(mi)+' milhões', rem:n%1e6});
  if(th) items.push({w:th===1?'mil':chunk3(th)+' mil', rem:un});
  if(un||!items.length) items.push({w:chunk3(un)||'zero', rem:0});
  let s=items[0].w;
  for(let i=1;i<items.length;i++){ const r=items[i-1].rem; s+=(r>0&&(r<100||r%100===0)?' e ':' ')+items[i].w; }
  return s; }
function valorExtenso(v){ v=Math.round(Number(v||0)*100)/100; if(!(v>0)) return 'zero real';
  const it=Math.floor(v), ct=Math.round((v-it)*100);
  let s=reaisWords(it)+((it>=1000000&&it%1000000===0)?' de reais':(it===1?' real':' reais'));
  if(ct) s+=' e '+(ct===1?'um centavo':(ct<20?['','um','dois','três','quatro','cinco','seis','sete','oito','nove','dez','onze','doze','treze','quatorze','quinze','dezesseis','dezessete','dezoito','dezenove'][ct]:Math.floor(ct/10)===2&&ct%10?'vinte e '+['','um','dois','três','quatro','cinco','seis','sete','oito','nove'][ct%10]:['','','vinte','trinta','quarenta','cinquenta','sessenta','setenta','oitenta','noventa'][Math.floor(ct/10)]+(ct%10?' e '+['','um','dois','três','quatro','cinco','seis','sete','oito','nove'][ct%10]:''))+' centavos');
  return s; }

/* ---------- RECIBO ---------- */
async function gerarRecibo(budget, entryId){
  const { jsPDF } = window.jspdf;
  const st = Store.settings;
  const doc = new jsPDF({unit:'mm', format:'a4'});
  const W=210, H=297, M=16;
  const entry=((budget.paid&&budget.paid.entries)||[]).find(e=>e.id===entryId) || {};
  const val=Number(entry.value||0);
  const logoUrl = await loadImageDataUrl(st.logoPath);
  const wmOpacity = st.wmEnabled?Number(st.wmOpacity??0.09):0;
  function watermark(){
    if(!wmOpacity) return;
    try{ doc.saveGraphicsState(); doc.setGState(new doc.GState({opacity:wmOpacity}));
      const s=Math.min(W,H)*Number(st.wmSizePct||60)/100*1.35;
      if(logoUrl){ try{doc.addImage(logoUrl,'PNG',(W-s)/2,(H-s)/2,s,s,'wm');}catch{doc.addImage(logoUrl,'JPEG',(W-s)/2,(H-s)/2,s,s,'wm');} }
      doc.restoreGraphicsState();
    }catch(e){}
  }
  // cabeçalho
  doc.setFillColor(26,93,26); doc.rect(0,0,W,30,'F');
  if(logoUrl){ try{doc.addImage(logoUrl,'PNG',M,5,20,20,'logo');}catch{try{doc.addImage(logoUrl,'JPEG',M,5,20,20,'logo');}catch{}} }
  doc.setTextColor(255,255,255); doc.setFont('helvetica','bold'); doc.setFontSize(15);
  doc.text(st.company||'MAYA Garden', M+24, 12);
  doc.setFontSize(9); doc.setFont('helvetica','normal');
  doc.text(`${st.tagline||''}`, M+24, 17.5);
  doc.text(`${st.address||''}  •  Whats ${st.whatsappDisplay||''}${st.cnpj?('  •  CNPJ '+st.cnpj):''}`, M+24, 22.5);
  // título
  let y=44;
  doc.setTextColor(26,93,26); doc.setFont('helvetica','bold'); doc.setFontSize(20);
  doc.text('RECIBO', W/2, y, {align:'center'}); y+=7;
  doc.setFontSize(11); doc.setTextColor(80,80,80);
  doc.text(`Nº ${budget.number||''} • ${fmtDPDF(entry.date||budget.date)}`, W/2, y, {align:'center'}); y+=12;
  // corpo
  doc.setTextColor(20,20,20); doc.setFont('helvetica','normal'); doc.setFontSize(12);
  const ext=valorExtenso(val); const Ext=ext.charAt(0).toUpperCase()+ext.slice(1);
  const lines=doc.splitTextToSize(`Recebi de ${budget.client?.name||'-'} a quantia de ${brlPDF(val)} (${Ext}), referente ao orçamento Nº ${budget.number||'-'} — ${((budget.items||[]).slice(0,3).map(i=>i.desc).join('; ')||'serviços de jardinagem').slice(0,140)}.`, W-2*M);
  doc.text(lines, M, y); y+=lines.length*6+8;
  doc.setFontSize(11);
  doc.text(`Forma de pagamento: ${entry.method||((typeof payLabel==='function')?payLabel(budget):(budget.payment||'-'))}`, M, y); y+=7;
  doc.text(`Total do orçamento: ${brlPDF(budget.total)}    •    Restante: ${brlPDF(Math.max(0,Number(budget.total||0)-val))}`, M, y); y+=12;
  doc.setDrawColor(26,93,26); doc.setLineWidth(0.6); doc.line(M,y,W-M,y); y+=8; doc.setLineWidth(0.2);
  doc.setFont('helvetica','bold'); doc.setFontSize(11); doc.setTextColor(26,93,26);
  doc.text(st.company||'MAYA Garden', M, y); y+=6;
  doc.setFont('helvetica','normal'); doc.setFontSize(9); doc.setTextColor(90,90,90);
  doc.text(`${st.address||''}  •  Whats ${st.whatsappDisplay||''}  •  ${st.instagram||''}${st.email?('  •  '+st.email):''}`, M, y);
  // rodapé + marca
  doc.setFontSize(7.5); doc.setTextColor(110,110,110);
  doc.text(`${st.company} • Petrópolis-RJ`, W/2, H-10, {align:'center'});
  watermark();
  doc.save(`recibo-${budget.number||'s-n'}.pdf`);
}
window.gerarRecibo = gerarRecibo;
