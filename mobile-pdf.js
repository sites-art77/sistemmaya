/* MAYA Garden — PDF no celular: tela “PDF pronto” + botão Baixar */
(function () {
  'use strict';

  const state = {
    blob: null,
    filename: '',
    url: null,
    busy: false
  };

  function toast(msg) {
    if (typeof window.toast === 'function') window.toast(msg);
  }

  function isIOS() {
    const ua = navigator.userAgent || '';
    return /iPad|iPhone|iPod/i.test(ua) ||
      (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  }

  function isTouch() {
    try {
      return matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window || isIOS();
    } catch (_) {
      return 'ontouchstart' in window;
    }
  }

  function revokeCurrentUrl() {
    if (state.url) {
      try { URL.revokeObjectURL(state.url); } catch (_) {}
      state.url = null;
    }
  }

  function ensureUrl() {
    if (!state.blob) return '';
    if (!state.url) state.url = URL.createObjectURL(state.blob);
    return state.url;
  }

  function closePdfReady() {
    const root = document.getElementById('pdf-ready-root');
    if (root) root.remove();
  }

  function hideBusy() {
    const el = document.getElementById('pdf-busy-root');
    if (el) el.remove();
    state.busy = false;
  }

  function showBusy(label) {
    hideBusy();
    state.busy = true;
    const root = document.createElement('div');
    root.id = 'pdf-busy-root';
    root.innerHTML = `
      <div class="pdf-busy-card" role="status" aria-live="polite">
        <div class="pdf-busy-spin" aria-hidden="true"></div>
        <strong>${label || 'Gerando PDF…'}</strong>
        <span>Isso leva alguns segundos no celular.</span>
      </div>`;
    document.body.appendChild(root);
  }

  function triggerDownload() {
    if (!state.blob) return;
    const filename = state.filename || 'orcamento.pdf';

    if (navigator.msSaveOrOpenBlob) {
      navigator.msSaveOrOpenBlob(state.blob, filename);
      toast('Download do PDF iniciado.');
      return;
    }

    const url = ensureUrl();
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.target = '_blank';
    a.rel = 'noopener';
    document.body.appendChild(a);
    a.click();
    a.remove();

    if (isIOS()) {
      toast('No iPhone: toque em Compartilhar → Salvar em Arquivos.');
    } else {
      toast('Download do PDF iniciado.');
    }
  }

  function openPdf() {
    if (!state.blob) return;
    const url = ensureUrl();
    const w = window.open(url, '_blank', 'noopener,noreferrer');
    if (!w) toast('O navegador bloqueou a abertura. Use “Baixar PDF”.');
  }

  async function sharePdf() {
    if (!state.blob) return;
    try {
      const file = new File(
        [state.blob],
        state.filename || 'orcamento.pdf',
        { type: 'application/pdf' }
      );
      if (navigator.share && (!navigator.canShare || navigator.canShare({ files: [file] }))) {
        await navigator.share({
          title: state.filename || 'Orçamento MAYA Garden',
          text: 'Orçamento em PDF — MAYA Garden',
          files: [file]
        });
        return;
      }
    } catch (err) {
      if (err && err.name === 'AbortError') return;
      console.warn('Compartilhamento de PDF indisponível:', err);
    }
    triggerDownload();
    toast('Compartilhamento direto indisponível. Use Baixar PDF.');
  }

  function canShareFiles() {
    try {
      if (!navigator.share) return false;
      if (!navigator.canShare) return true;
      const test = new File(['x'], 'teste.pdf', { type: 'application/pdf' });
      return navigator.canShare({ files: [test] });
    } catch (_) {
      return false;
    }
  }

  function escapeHtml(s) {
    return String(s || '').replace(/[&<>"']/g, c => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[c]));
  }

  function showPdfReady(blob, filename) {
    hideBusy();
    revokeCurrentUrl();
    state.blob = blob;
    state.filename = filename || 'orcamento.pdf';
    closePdfReady();

    const url = ensureUrl();
    const shareOk = canShareFiles();
    const ios = isIOS();

    const root = document.createElement('div');
    root.id = 'pdf-ready-root';
    root.innerHTML = `
      <div class="pdf-ready-backdrop" role="presentation"></div>
      <section class="pdf-ready-sheet" role="dialog" aria-modal="true" aria-labelledby="pdf-ready-title">
        <div class="pdf-ready-handle" aria-hidden="true"></div>
        <div class="pdf-ready-icon" aria-hidden="true">✓</div>
        <h2 id="pdf-ready-title">PDF pronto</h2>
        <p class="pdf-ready-sub">Seu orçamento foi gerado. Toque em Baixar PDF.</p>
        <div class="pdf-ready-file" title="${escapeHtml(state.filename)}">
          <span aria-hidden="true">📄</span>
          <strong>${escapeHtml(state.filename)}</strong>
        </div>

        <a class="pdf-ready-primary" id="pdf-ready-download" href="${url}" download="${escapeHtml(state.filename)}" target="_blank" rel="noopener">
          <span aria-hidden="true">⬇</span>
          <span>Baixar PDF</span>
        </a>

        <div class="pdf-ready-grid">
          <button type="button" class="pdf-ready-secondary" id="pdf-ready-open">
            <span aria-hidden="true">↗</span>
            <span>Abrir</span>
          </button>
          <button type="button" class="pdf-ready-secondary" id="pdf-ready-share">
            <span aria-hidden="true">⇧</span>
            <span>Compartilhar</span>
          </button>
        </div>

        <p class="pdf-ready-tip">
          ${ios
            ? 'No iPhone: toque em Compartilhar e escolha “Salvar em Arquivos” ou WhatsApp.'
            : 'O arquivo entra na pasta de Downloads. Depois você pode enviar no WhatsApp.'}
        </p>
        <button type="button" class="pdf-ready-close" id="pdf-ready-close">Fechar</button>
      </section>
    `;

    document.body.appendChild(root);

    root.querySelector('.pdf-ready-backdrop').addEventListener('click', closePdfReady);
    root.querySelector('#pdf-ready-close').addEventListener('click', closePdfReady);
    root.querySelector('#pdf-ready-download').addEventListener('click', function (ev) {
      ev.preventDefault();
      triggerDownload();
    });
    root.querySelector('#pdf-ready-open').addEventListener('click', openPdf);
    root.querySelector('#pdf-ready-share').addEventListener('click', sharePdf);

    if (!shareOk) {
      const shareBtn = root.querySelector('#pdf-ready-share');
      shareBtn.style.display = 'none';
      root.querySelector('.pdf-ready-grid').style.gridTemplateColumns = '1fr';
    }

    requestAnimationFrame(() => root.classList.add('show'));

    if (!isTouch()) triggerDownload();
  }

  function installStyles() {
    if (document.getElementById('pdf-mobile-styles')) return;
    const style = document.createElement('style');
    style.id = 'pdf-mobile-styles';
    style.textContent = `
      #pdf-ready-root,#pdf-busy-root{
        position:fixed;inset:0;z-index:5000;
        display:flex;align-items:flex-end;justify-content:center;
        padding:16px;padding-bottom:calc(16px + env(safe-area-inset-bottom));
      }
      #pdf-ready-root{opacity:0;transition:opacity .18s ease}
      #pdf-ready-root.show{opacity:1}
      #pdf-busy-root{align-items:center;background:rgba(8,14,10,.55);backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px)}
      .pdf-busy-card{
        background:#142017;color:#edf7ef;border:1px solid #31543a;border-radius:18px;
        padding:22px 24px;text-align:center;min-width:min(280px,90vw);
        box-shadow:0 18px 50px rgba(0,0,0,.4)
      }
      .pdf-busy-card strong{display:block;margin-top:10px;font:800 1.05rem Inter,system-ui,sans-serif}
      .pdf-busy-card span{display:block;margin-top:6px;color:#9bb5a0;font-size:.82rem}
      .pdf-busy-spin{
        width:34px;height:34px;margin:0 auto;border-radius:50%;
        border:3px solid #2a4632;border-top-color:#49c25a;animation:pdfspin .8s linear infinite
      }
      @keyframes pdfspin{to{transform:rotate(360deg)}}
      .pdf-ready-backdrop{
        position:absolute;inset:0;background:rgba(0,0,0,.72);
        backdrop-filter:blur(7px);-webkit-backdrop-filter:blur(7px);
      }
      .pdf-ready-sheet{
        position:relative;width:min(520px,100%);z-index:1;
        background:linear-gradient(180deg,#18261c,#101913);
        color:#edf7ef;border:1px solid #31543a;border-radius:24px;
        box-shadow:0 24px 80px rgba(0,0,0,.58);
        padding:14px 18px 18px;text-align:center;
        transform:translateY(24px);transition:transform .22s ease;
      }
      #pdf-ready-root.show .pdf-ready-sheet{transform:translateY(0)}
      .pdf-ready-handle{width:44px;height:5px;border-radius:999px;background:#607b66;margin:0 auto 12px;opacity:.7}
      .pdf-ready-icon{
        width:54px;height:54px;border-radius:999px;margin:0 auto 10px;
        display:grid;place-items:center;font-size:26px;font-weight:900;
        background:#1f7a2b;color:#fff;box-shadow:0 8px 28px rgba(46,125,50,.38);
      }
      .pdf-ready-sheet h2{margin:0;font:900 1.45rem/1.15 Inter,system-ui,sans-serif;color:#fff}
      .pdf-ready-sub{margin:7px 0 13px;color:#aac0ae;font-size:.92rem}
      .pdf-ready-file{
        display:flex;align-items:center;gap:9px;text-align:left;
        background:#0d150f;border:1px solid #294632;border-radius:13px;
        padding:10px 12px;margin-bottom:13px;min-width:0;
      }
      .pdf-ready-file strong{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:.8rem;color:#dbe9de}
      .pdf-ready-primary,.pdf-ready-secondary,.pdf-ready-close{
        font:800 .96rem/1 Inter,system-ui,sans-serif;cursor:pointer;
        -webkit-tap-highlight-color:transparent;text-decoration:none;
      }
      .pdf-ready-primary{
        width:100%;min-height:56px;border:0;border-radius:14px;
        display:flex;align-items:center;justify-content:center;gap:9px;
        color:#fff;background:linear-gradient(180deg,#3aa545,#237b2b);
        box-shadow:0 10px 25px rgba(37,122,44,.34);box-sizing:border-box;
      }
      .pdf-ready-primary:active,.pdf-ready-secondary:active{transform:scale(.98)}
      .pdf-ready-grid{display:grid;grid-template-columns:1fr 1fr;gap:9px;margin-top:9px}
      .pdf-ready-secondary{
        min-height:48px;border-radius:13px;border:1px solid #376343;
        color:#b8dfbd;background:#122018;
        display:flex;align-items:center;justify-content:center;gap:7px;
      }
      .pdf-ready-tip{margin:12px 4px 5px;color:#8fa895;font-size:.76rem;line-height:1.35}
      .pdf-ready-close{border:0;background:transparent;color:#a9b9ac;padding:10px 18px 3px}
      @media (min-width:700px){
        #pdf-ready-root{align-items:center}
        .pdf-ready-sheet{padding:18px 22px 20px}
      }
      @media (max-width:420px){
        #pdf-ready-root{padding-left:10px;padding-right:10px}
        .pdf-ready-sheet{border-radius:22px 22px 16px 16px}
      }
      button[data-pdf-download-enhanced="1"]{
        border-color:#4c9c58!important;color:#bff0c5!important;
      }
    `;
    document.head.appendChild(style);
  }

  function improveVisiblePdfButtons() {
    document.querySelectorAll('button[onclick*="pdfBudget("], button[onclick*="doPDF("]').forEach(btn => {
      if (btn.dataset.pdfDownloadEnhanced === '1') return;
      btn.dataset.pdfDownloadEnhanced = '1';
      const text = (btn.textContent || '').trim();
      if (text === 'PDF' || text === 'Baixar PDF') btn.textContent = '⬇ Baixar PDF';
    });
  }

  function installButtonObserver() {
    improveVisiblePdfButtons();
    const observer = new MutationObserver(() => improveVisiblePdfButtons());
    observer.observe(document.body, { childList: true, subtree: true });
  }

  function wrapPdfFns() {
    window.onMayaPdfReady = function (blob, filename) {
      if (!blob) {
        hideBusy();
        toast('Não foi possível preparar o PDF.');
        return;
      }
      showPdfReady(blob, filename);
    };

    function wrap(name) {
      const original = window[name];
      if (typeof original !== 'function' || original.__mayaMobileWrapped) return typeof original === 'function';
      const wrapped = async function () {
        showBusy(name === 'gerarRecibo' ? 'Gerando recibo…' : 'Gerando PDF…');
        try {
          return await original.apply(this, arguments);
        } catch (err) {
          hideBusy();
          toast('Falha ao gerar o PDF.');
          throw err;
        } finally {
          setTimeout(hideBusy, 12000);
        }
      };
      wrapped.__mayaMobileWrapped = true;
      wrapped.__mayaOriginal = original;
      window[name] = wrapped;
      return true;
    }

    return wrap('gerarPDF') && wrap('gerarRecibo');
  }

  function boot() {
    installStyles();
    installButtonObserver();
    if (wrapPdfFns()) return;
    let attempts = 0;
    const timer = setInterval(() => {
      attempts += 1;
      if (wrapPdfFns() || attempts >= 40) clearInterval(timer);
    }, 250);
  }

  window.addEventListener('beforeunload', revokeCurrentUrl);

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }

  window.MayaPdfMobile = {
    download: triggerDownload,
    open: openPdf,
    share: sharePdf,
    close: closePdfReady
  };
})();
