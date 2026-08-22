(() => {
  let currentProductId = '';
  const $ = (s) => document.querySelector(s);
  const fmt = (n) => new Intl.NumberFormat('es-AR', { style:'currency', currency:'ARS', maximumFractionDigits:0 }).format(Number(n || 0));
  const esc = (s='') => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

  function getState(){
    if(window.VALTO_RUNTIME_STATE) return window.VALTO_RUNTIME_STATE;
    try { return JSON.parse(localStorage.getItem('valto_store_data') || 'null') || window.VALTO_DEFAULTS; }
    catch { return window.VALTO_DEFAULTS; }
  }

  function toast(msg){
    const t = $('#toast'); if(!t) return alert(msg);
    t.textContent = msg; t.classList.add('show'); setTimeout(() => t.classList.remove('show'), 3200);
  }

  function injectStyles(){
    if($('#paymentStyles')) return;
    const style = document.createElement('style'); style.id = 'paymentStyles';
    style.textContent = `
      .online-payment-box{margin-top:18px;padding:16px;border:1px solid rgba(41,43,35,.14);border-radius:16px;background:#fff}
      .online-payment-title{display:flex;justify-content:space-between;gap:12px;align-items:center;margin-bottom:10px}.online-payment-title b{font-size:15px}.online-payment-title span{font-size:12px;color:var(--muted)}
      .payment-badges{display:flex;flex-wrap:wrap;gap:7px;margin:10px 0 14px}.payment-badge{padding:6px 9px;border:1px solid rgba(41,43,35,.12);border-radius:8px;background:#faf9f5;font-size:11px;font-weight:700;letter-spacing:.02em}
      .payment-variant{width:100%;margin:0 0 12px;padding:11px 12px;border:1px solid rgba(41,43,35,.18);border-radius:10px;background:#fff;font:inherit}
      .payment-btn{width:100%;background:#009ee3!important;color:#fff!important;border-color:#009ee3!important}.payment-btn:disabled{opacity:.55;cursor:not-allowed}
      .payment-note{font-size:11px;line-height:1.45;color:var(--muted);margin:9px 0 0}
      .payment-stock{font-size:12px;font-weight:800;margin:0 0 10px}.payment-stock.out{color:#9b2c2c}
      .payment-notice{max-width:1180px;margin:14px auto 0;padding:14px 18px;border-radius:14px;font-weight:700}.payment-notice.approved{background:#e8f7ee;color:#176b3a}.payment-notice.pending{background:#fff6da;color:#735c0f}.payment-notice.failure{background:#fdecec;color:#8a2626}
    `;
    document.head.appendChild(style);
  }

  function parseVariants(p){
    const raw = String(p?.variants || '').trim();
    if(!raw || /^consultar/i.test(raw)) return [];
    return raw.split('·').map(v => v.trim()).filter(Boolean).filter(v => !/^consultar/i.test(v));
  }

  function enhanceModal(){
    const inner = $('#modalInner');
    if(!inner || inner.querySelector('.online-payment-box') || !currentProductId) return;
    const p = getState().products?.find(x => x.id === currentProductId); if(!p) return;
    const variants = parseVariants(p); const stock = Number(p.stock || 0); const out = stock <= 0;
    const box = document.createElement('div'); box.className = 'online-payment-box';
    box.innerHTML = `
      <div class="online-payment-title"><b>Pago online seguro</b><span>${fmt(p.price)}</span></div>
      <div class="payment-stock ${out?'out':''}">${out?'Sin stock disponible':`Stock disponible: ${stock}`}</div>
      <div class="payment-badges"><span class="payment-badge">Mercado Pago</span><span class="payment-badge">VISA</span><span class="payment-badge">Mastercard</span><span class="payment-badge">Amex</span><span class="payment-badge">Débito</span></div>
      ${variants.length ? `<select class="payment-variant" id="paymentVariant" ${out?'disabled':''}><option value="">Elegí una opción</option>${variants.map(v=>`<option value="${esc(v)}">${esc(v)}</option>`).join('')}</select>` : ''}
      <button class="btn payment-btn" id="payOnlineBtn" ${out?'disabled':''}>${out?'Producto sin stock':'Pagar con Mercado Pago o tarjeta'}</button>
      <p class="payment-note">El pago se procesa en Mercado Pago. El stock se descuenta automáticamente cuando Mercado Pago confirma el pago.</p>`;
    const wa = inner.querySelector('#modalWa'); wa?.parentElement?.insertBefore(box, wa);
    if(!out) $('#payOnlineBtn').onclick = () => pay(p, variants.length > 0);
  }

  async function pay(p, requiresVariant){
    const btn = $('#payOnlineBtn'); const variant = $('#paymentVariant')?.value || '';
    if(requiresVariant && !variant){ toast('Elegí una opción antes de pagar.'); return; }
    if(Number(p.stock || 0) <= 0){ toast('Este producto se quedó sin stock.'); return; }
    btn.disabled = true; btn.textContent = 'Abriendo Mercado Pago...';
    try{
      const r = await fetch('/api/create-preference', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({productId:p.id, quantity:1, variant}) });
      const data = await r.json(); if(!r.ok) throw new Error(data.error || 'No se pudo iniciar el pago.');
      window.location.href = data.checkoutUrl;
    }catch(e){ toast(e.message || 'No se pudo iniciar el pago.'); btn.disabled=false; btn.textContent='Pagar con Mercado Pago o tarjeta'; }
  }

  async function showReturnStatus(){
    const params = new URLSearchParams(location.search); const result = params.get('payment'); if(!result) return;
    let kind = result === 'success' ? 'approved' : result;
    let text = result === 'success' ? 'Pago recibido. Estamos verificando la operación…' : result === 'pending' ? 'El pago quedó pendiente de confirmación.' : 'El pago no se completó. Podés intentarlo nuevamente.';
    const paymentId = params.get('payment_id') || params.get('collection_id');
    if(paymentId && result === 'success'){
      try{
        const r = await fetch(`/api/payment-status?id=${encodeURIComponent(paymentId)}`); const data = await r.json();
        if(r.ok){
          kind = data.status === 'approved' ? 'approved' : data.status === 'pending' || data.status === 'in_process' ? 'pending' : 'failure';
          text = kind === 'approved' ? `Pago aprobado por ${fmt(data.amount)}. Stock actualizado. ¡Gracias por tu compra!` : kind === 'pending' ? 'El pago está siendo procesado por Mercado Pago.' : 'Mercado Pago informó que el pago no fue aprobado.';
        }
      }catch{}
    }
    const notice = document.createElement('div'); notice.className = `payment-notice ${kind}`; notice.textContent = text;
    const header = $('.site-header'); header?.insertAdjacentElement('afterend', notice);
  }

  injectStyles();
  document.addEventListener('click', (e) => { const el = e.target.closest?.('[data-open]'); if(el?.dataset?.open){ currentProductId = el.dataset.open; setTimeout(enhanceModal, 0); } }, true);
  new MutationObserver(enhanceModal).observe($('#modalInner'), { childList:true, subtree:true });
  const footerStatus = document.querySelector('.footer-bottom span:last-child'); if(footerStatus) footerStatus.textContent = 'Pagos online con Mercado Pago · Crédito y débito.';
  showReturnStatus();
})();
