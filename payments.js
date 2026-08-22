(() => {
  let currentProductId = '';
  const $ = (s) => document.querySelector(s);
  const fmt = (n) => new Intl.NumberFormat('es-AR', { style:'currency', currency:'ARS', maximumFractionDigits:0 }).format(Number(n || 0));

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
      .product-checkout-box{margin-top:12px;padding:14px;border:1px solid rgba(41,43,35,.14);border-radius:16px;background:#fff}
      .product-checkout-actions{display:grid;grid-template-columns:1fr 1fr;gap:9px}
      .product-finish-btn{width:100%;justify-content:center}
      .product-continue-btn{width:100%;justify-content:center;background:transparent!important;color:var(--accent-dark)!important;border-color:rgba(41,43,35,.22)!important}
      .payment-notice{max-width:1180px;margin:14px auto 0;padding:14px 18px;border-radius:14px;font-weight:700}.payment-notice.approved{background:#e8f7ee;color:#176b3a}.payment-notice.pending{background:#fff6da;color:#735c0f}.payment-notice.failure{background:#fdecec;color:#8a2626}
      @media(max-width:560px){.product-checkout-actions{grid-template-columns:1fr}}
    `;
    document.head.appendChild(style);
  }

  function parseVariants(p){
    const raw = String(p?.variants || '').trim();
    if(!raw || /^consultar/i.test(raw)) return [];
    return raw.split('·').map(v => v.trim()).filter(Boolean).filter(v => !/^consultar/i.test(v));
  }

  function finishFromProduct(p){
    const variants = parseVariants(p);
    const variantLabel = String(p.variantLabel || 'opción').trim() || 'opción';
    const variant = $('#purchaseVariant')?.value || '';
    const quantity = Math.max(1, Number($('#modalQtyValue')?.textContent || 1));
    if(variants.length && !variant){ toast(`Elegí ${variantLabel.toLowerCase()} antes de continuar.`); return; }
    if(Number(p.stock || 0) < quantity){ toast('No hay stock suficiente para esa cantidad.'); return; }

    const addBtn = $('#modalAddCart');
    if(!addBtn || addBtn.disabled){ toast('No se pudo agregar el producto al carrito.'); return; }
    addBtn.click();
    setTimeout(() => { window.location.href = 'checkout.html'; }, 80);
  }

  function enhanceModal(){
    const inner = $('#modalInner');
    if(!inner || !currentProductId || !$('#productModal')?.classList.contains('open')) return;
    const p = getState().products?.find(x => x.id === currentProductId); if(!p) return;

    inner.querySelector('.online-payment-box')?.remove();
    inner.querySelector('.purchase-choice-box')?.remove();
    if(inner.querySelector('.product-checkout-box')) return;

    const wa = inner.querySelector('#modalWa');
    if(!wa) return;
    const box = document.createElement('div');
    box.className = 'product-checkout-box';
    box.innerHTML = `<div class="product-checkout-actions"><button class="btn btn-dark product-finish-btn" id="finishProductCheckout">Finalizar compra</button><button class="btn btn-outline product-continue-btn" id="continueShopping">Seguir comprando</button></div>`;
    wa.parentElement?.insertBefore(box, wa);

    $('#finishProductCheckout').onclick = () => finishFromProduct(p);
    $('#continueShopping').onclick = () => $('#closeModal')?.click();
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
          if(kind === 'approved') window.dispatchEvent(new CustomEvent('valto:payment-approved',{detail:data}));
        }
      }catch{}
    }
    const notice = document.createElement('div'); notice.className = `payment-notice ${kind}`; notice.textContent = text;
    const header = $('.site-header'); header?.insertAdjacentElement('afterend', notice);
  }

  injectStyles();
  document.addEventListener('click', (e) => { const el = e.target.closest?.('[data-open]'); if(el?.dataset?.open){ currentProductId = el.dataset.open; setTimeout(enhanceModal, 30); } }, true);
  new MutationObserver(()=>setTimeout(enhanceModal,30)).observe($('#modalInner'), { childList:true, subtree:true });
  window.addEventListener('valto:commerce-updated', () => { if(currentProductId) setTimeout(enhanceModal, 30); });
  const footerStatus = document.querySelector('.footer-bottom span:last-child'); if(footerStatus) footerStatus.textContent = 'Pagos: Mercado Pago, transferencia, efectivo o a coordinar.';
  showReturnStatus();
})();
