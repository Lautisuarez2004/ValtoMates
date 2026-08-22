(() => {
  const config = window.VALTO_CONFIG || {};
  const CART_KEY = 'valto_cart_v2';
  const POSTAL_KEY = 'valto_postal_code';
  const $ = s => document.querySelector(s);
  const $$ = s => [...document.querySelectorAll(s)];
  const fmt = n => new Intl.NumberFormat('es-AR',{style:'currency',currency:'ARS',maximumFractionDigits:0}).format(Number(n||0));
  const esc = (s='') => String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const defaultSettings = {
    installments_count: 3,
    installments_interest_free: true,
    shipping_enabled: true,
    shipping_base_cost: 0,
    shipping_free_from: 0,
    shipping_dispatch_text: 'Despachamos entre 1 y 3 días hábiles',
    shipping_provider: 'manual'
  };
  let settings = {...defaultSettings};
  let cart = loadCart();
  let activeProductId = '';
  let selectedVariants = {};
  let modalQty = 1;

  function state(){ return window.VALTO_RUNTIME_STATE || window.VALTO_DEFAULTS || {products:[]}; }
  function products(){ return Array.isArray(state().products) ? state().products : []; }
  function product(id){ return products().find(p=>String(p.id)===String(id)); }
  function variants(p){
    const raw = String(p?.variants||'').trim();
    if(!raw || /^consultar/i.test(raw)) return [];
    return raw.split('·').map(v=>v.trim()).filter(Boolean).filter(v=>!/^consultar/i.test(v));
  }
  function postalValid(v){ return /^[A-Z0-9]{4,8}$/.test(String(v||'').toUpperCase().replace(/\s+/g,'')); }
  function normalizePostal(v){ return String(v||'').toUpperCase().replace(/\s+/g,'').trim(); }

  function loadCart(){
    try{ const raw=JSON.parse(localStorage.getItem(CART_KEY)||'[]'); return Array.isArray(raw)?raw:[]; }catch{return[];}
  }
  function saveCart(){ localStorage.setItem(CART_KEY,JSON.stringify(cart)); renderCart(); }
  function cartKey(productId,variant=''){ return `${productId}::${variant}`; }
  function toast(msg){ const t=$('#toast'); if(!t)return; t.textContent=msg;t.classList.add('show');setTimeout(()=>t.classList.remove('show'),2600); }

  async function loadSettings(){
    if(!config.supabaseUrl || !config.supabaseAnonKey) return;
    try{
      const r=await fetch(`${config.supabaseUrl}/rest/v1/valto_commerce_settings?id=eq.default&select=*`,{headers:{apikey:config.supabaseAnonKey},cache:'no-store'});
      const rows=await r.json();
      if(r.ok && Array.isArray(rows) && rows[0]) settings={...defaultSettings,...rows[0]};
      window.VALTO_COMMERCE_SETTINGS=settings;
      enhanceCards();
      enhanceModal();
      renderCart();
    }catch(e){ console.error('commerce settings',e); }
  }

  function installmentText(amount){
    const count=Math.max(1,Math.floor(Number(settings.installments_count||3)));
    if(count<=1) return '';
    const each=Number(amount||0)/count;
    return `Hasta ${count} cuota${count===1?'':'s'}${settings.installments_interest_free?' sin interés':''} de ${fmt(each)}`;
  }

  function shippingFor(subtotal,postal){
    if(settings.shipping_enabled===false) return {cost:0,label:'Envío a coordinar con el vendedor',ready:true};
    if(!postalValid(postal)) return {cost:0,label:'Ingresá tu código postal para calcular el envío',ready:false};
    const freeFrom=Math.max(0,Number(settings.shipping_free_from||0));
    if(freeFrom>0 && Number(subtotal)>=freeFrom) return {cost:0,label:'Envío gratis',ready:true};
    const base=Math.max(0,Number(settings.shipping_base_cost||0));
    if(base>0) return {cost:base,label:`Envío estimado: ${fmt(base)}`,ready:true};
    return {cost:0,label:'Costo a confirmar con el correo',ready:true};
  }

  function addToCart(productId,variant='',qty=1){
    const p=product(productId); if(!p) return toast('Producto no disponible.');
    const stock=Number(p.stock||0); if(stock<=0) return toast('Este producto está sin stock.');
    const required=variants(p);
    if(required.length && !required.includes(variant)) return toast(`Elegí ${String(p.variantLabel||'opción').toLowerCase()} antes de agregar.`);
    const key=cartKey(p.id,variant);
    const existing=cart.find(i=>i.key===key);
    const current=existing?Number(existing.quantity||0):0;
    const next=Math.min(stock,current+Math.max(1,Number(qty||1)));
    if(existing) existing.quantity=next;
    else cart.push({key,productId:p.id,variant,quantity:next});
    saveCart();
    toast('Agregado al carrito');
    openCart();
  }

  function reconcileCart(){
    cart=cart.filter(item=>{
      const p=product(item.productId); if(!p || Number(p.stock||0)<=0)return false;
      item.quantity=Math.max(1,Math.min(Number(item.quantity||1),Number(p.stock||0)));
      return true;
    });
    localStorage.setItem(CART_KEY,JSON.stringify(cart));
  }

  function enhanceCards(){
    $$('.product-card').forEach(card=>{
      const trigger=card.querySelector('[data-open]');
      const id=trigger?.dataset?.open; const p=product(id); if(!p)return;
      const body=card.querySelector('.product-body'); if(!body)return;
      let line=body.querySelector('.installment-line');
      if(!line){ line=document.createElement('div');line.className='installment-line'; const price=body.querySelector('.price-row'); price?.insertAdjacentElement('afterend',line); }
      line.textContent=installmentText(p.price);
      let btn=body.querySelector('.quick-cart');
      if(!btn){ btn=document.createElement('button');btn.className='btn btn-outline quick-cart'; const actions=body.querySelector('.product-actions'); actions?.insertAdjacentElement('beforebegin',btn); }
      btn.disabled=Number(p.stock||0)<=0;
      btn.textContent=btn.disabled?'Sin stock':variants(p).length?`Elegir ${String(p.variantLabel||'opción').toLowerCase()} y agregar`:'Agregar al carrito';
      btn.onclick=(e)=>{e.stopPropagation(); if(variants(p).length){trigger?.click();}else addToCart(p.id,'',1);};
    });
  }

  function modalProduct(){ return product(activeProductId); }
  function enhanceModal(){
    const inner=$('#modalInner'); const p=modalProduct();
    if(!inner || !p || !$('#productModal')?.classList.contains('open')) return;
    const content=inner.querySelector('.modal-content'); if(!content)return;
    if(inner.dataset.commerceProduct===String(p.id)) return;
    inner.dataset.commerceProduct=String(p.id);

    const price=content.querySelector('.modal-price');
    if(price){ const line=document.createElement('div');line.className='installment-line modal-installments';line.textContent=installmentText(p.price);price.insertAdjacentElement('afterend',line); }

    const wa=content.querySelector('#modalWa');
    const opts=document.createElement('div');opts.className='purchase-options';
    const vs=variants(p); const label=String(p.variantLabel||'Opción').trim()||'Opción';
    const chosen=selectedVariants[p.id]||'';
    opts.innerHTML=`<div class="purchase-options-title">Configurá tu compra</div>${vs.length?`<div class="variant-selector"><label for="purchaseVariant">Elegí ${esc(label)}</label><select id="purchaseVariant"><option value="">Seleccionar ${esc(label.toLowerCase())}</option>${vs.map(v=>`<option value="${esc(v)}" ${v===chosen?'selected':''}>${esc(v)}</option>`).join('')}</select></div>`:''}<div class="modal-buy-row"><div class="qty-control" aria-label="Cantidad"><button type="button" id="modalQtyMinus">−</button><span id="modalQtyValue">${modalQty}</span><button type="button" id="modalQtyPlus">+</button></div><button class="btn btn-dark modal-add-cart" id="modalAddCart" ${Number(p.stock||0)<=0?'disabled':''}>${Number(p.stock||0)<=0?'Sin stock':'Agregar al carrito'}</button></div>`;
    wa?.insertAdjacentElement('beforebegin',opts);

    const note=document.createElement('div');note.className='dispatch-note';note.innerHTML=`<span>ⓘ</span><span>${esc(settings.shipping_dispatch_text||defaultSettings.shipping_dispatch_text)}</span>`;opts.insertAdjacentElement('afterend',note);
    const ship=document.createElement('div');ship.className='shipping-box';ship.innerHTML=`<strong>Calcular costo de envío</strong><div class="shipping-form"><input id="productPostalCode" inputmode="text" maxlength="8" placeholder="Tu código postal" value="${esc(localStorage.getItem(POSTAL_KEY)||'')}"><button class="btn btn-outline" id="productShippingCalc">Calcular</button></div><div class="shipping-result" id="productShippingResult"></div><div class="shipping-help">Estimación configurada por la tienda. Al conectar Correo Argentino o Andreani puede cotizarse una tarifa exacta por destino y paquete.</div>`;note.insertAdjacentElement('afterend',ship);
    const share=document.createElement('div');share.className='share-row';share.innerHTML=`<button class="btn btn-outline" id="shareProduct">Compartir producto</button>`;ship.insertAdjacentElement('afterend',share);

    $('#purchaseVariant')?.addEventListener('change',e=>{selectedVariants[p.id]=e.target.value;});
    $('#modalQtyMinus').onclick=()=>{modalQty=Math.max(1,modalQty-1);$('#modalQtyValue').textContent=String(modalQty);};
    $('#modalQtyPlus').onclick=()=>{modalQty=Math.min(Number(p.stock||1),modalQty+1);$('#modalQtyValue').textContent=String(modalQty);};
    $('#modalAddCart').onclick=()=>addToCart(p.id,$('#purchaseVariant')?.value||'',modalQty);
    $('#productShippingCalc').onclick=()=>{
      const cp=normalizePostal($('#productPostalCode').value); localStorage.setItem(POSTAL_KEY,cp); $('#productPostalCode').value=cp;
      const result=shippingFor(Number(p.price||0)*modalQty,cp); $('#productShippingResult').textContent=result.label;
    };
    $('#shareProduct').onclick=async()=>{
      const shareData={title:p.name,text:`Mirá ${p.name} en Valto Mates`,url:location.href};
      try{if(navigator.share)await navigator.share(shareData);else{await navigator.clipboard.writeText(location.href);toast('Link copiado');}}catch{}
    };

    const related=products().filter(x=>x.id!==p.id && Number(x.stock||0)>0).sort((a,b)=>Number(b.category===p.category)-Number(a.category===p.category)).slice(0,3);
    if(related.length){
      const wrap=document.createElement('div');wrap.className='related-wrap';wrap.innerHTML=`<h3>Te puede interesar también</h3><div class="related-grid">${related.map(r=>`<button class="related-card" data-related="${esc(r.id)}"><img src="${esc(r.image)}" alt="${esc(r.name)}"><div><b>${esc(r.name)}</b><span>${fmt(r.price)}</span></div></button>`).join('')}</div>`;inner.appendChild(wrap);
      wrap.querySelectorAll('[data-related]').forEach(b=>b.onclick=()=>{activeProductId=b.dataset.related;modalQty=1;inner.dataset.commerceProduct='';document.querySelector(`[data-open="${CSS.escape(activeProductId)}"]`)?.click();});
    }
  }

  function cartSubtotal(){ return cart.reduce((sum,item)=>{const p=product(item.productId);return sum+(p?Number(p.price||0)*Number(item.quantity||0):0);},0); }
  function renderCart(){
    reconcileCart();
    const count=cart.reduce((s,i)=>s+Number(i.quantity||0),0); const countEl=$('#cartCount'); if(countEl){countEl.textContent=String(count);countEl.dataset.count=String(count);}
    const items=$('#cartItems'), summary=$('#cartSummary'); if(!items||!summary)return;
    if(!cart.length){items.innerHTML='<div class="cart-empty"><b>Tu carrito está vacío</b>Agregá productos y armá tu compra.</div>';summary.innerHTML='';return;}
    items.innerHTML=cart.map(item=>{const p=product(item.productId);if(!p)return'';return `<div class="cart-item" data-key="${esc(item.key)}"><img src="${esc(p.image)}" alt="${esc(p.name)}"><div><h4>${esc(p.name)}</h4><div class="cart-item-meta">${item.variant?`${esc(p.variantLabel||'Opción')}: ${esc(item.variant)} · `:''}Stock ${p.stock}</div><div class="cart-item-price">${fmt(Number(p.price)*Number(item.quantity))}</div><div class="qty-control"><button data-cart-minus>−</button><span>${item.quantity}</span><button data-cart-plus>+</button></div></div><button class="cart-item-remove" data-cart-remove>Eliminar</button></div>`;}).join('');
    const subtotal=cartSubtotal(); const cp=localStorage.getItem(POSTAL_KEY)||''; const ship=shippingFor(subtotal,cp); const total=subtotal+ship.cost;
    summary.innerHTML=`<div class="shipping-box" style="margin-top:0;padding-top:0;border-top:0"><strong>Calcular costo de envío</strong><div class="shipping-form"><input id="cartPostalCode" inputmode="text" maxlength="8" placeholder="Tu código postal" value="${esc(cp)}"><button class="btn btn-outline" id="cartShippingCalc">Calcular</button></div><div class="shipping-result" id="cartShippingResult">${cp?esc(ship.label):''}</div></div><div class="cart-row"><span>Subtotal</span><b>${fmt(subtotal)}</b></div><div class="cart-row"><span>Envío</span><b>${ship.ready?(ship.cost?fmt(ship.cost):ship.label):'—'}</b></div><div class="cart-row total"><span>Total</span><span>${fmt(total)}</span></div><div class="cart-installments">${esc(installmentText(total))}</div><button class="btn cart-checkout" id="cartCheckout" ${settings.shipping_enabled!==false&&!postalValid(cp)?'disabled':''}>Pagar con Mercado Pago</button>`;
    $$('#cartItems .cart-item').forEach(row=>{
      const key=row.dataset.key,item=cart.find(i=>i.key===key),p=item&&product(item.productId);if(!item||!p)return;
      row.querySelector('[data-cart-minus]').onclick=()=>{item.quantity=Math.max(1,item.quantity-1);saveCart();};
      row.querySelector('[data-cart-plus]').onclick=()=>{item.quantity=Math.min(Number(p.stock||0),item.quantity+1);saveCart();};
      row.querySelector('[data-cart-remove]').onclick=()=>{cart=cart.filter(i=>i.key!==key);saveCart();};
    });
    $('#cartShippingCalc').onclick=()=>{const cp2=normalizePostal($('#cartPostalCode').value);localStorage.setItem(POSTAL_KEY,cp2);renderCart();};
    $('#cartCheckout').onclick=checkoutCart;
  }

  async function checkoutCart(){
    if(!cart.length)return;
    const cp=normalizePostal($('#cartPostalCode')?.value||localStorage.getItem(POSTAL_KEY)||'');
    if(settings.shipping_enabled!==false&&!postalValid(cp))return toast('Ingresá tu código postal antes de pagar.');
    const btn=$('#cartCheckout');btn.disabled=true;btn.textContent='Abriendo Mercado Pago...';
    try{
      const r=await fetch('/api/create-preference',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({postalCode:cp,items:cart.map(i=>({productId:i.productId,quantity:i.quantity,variant:i.variant||''}))})});
      const data=await r.json();if(!r.ok)throw new Error(data.error||'No se pudo iniciar el pago.');window.location.href=data.checkoutUrl;
    }catch(e){toast(e.message||'No se pudo iniciar el pago.');btn.disabled=false;btn.textContent='Pagar con Mercado Pago';}
  }

  function openCart(){ $('#cartBackdrop')?.classList.add('open');document.body.style.overflow='hidden';renderCart(); }
  function closeCart(){ $('#cartBackdrop')?.classList.remove('open'); if(!$('#productModal')?.classList.contains('open'))document.body.style.overflow=''; }

  $('#cartBtn')?.addEventListener('click',openCart);$('#closeCart')?.addEventListener('click',closeCart);$('#cartBackdrop')?.addEventListener('click',e=>{if(e.target===$('#cartBackdrop'))closeCart();});
  document.addEventListener('keydown',e=>{if(e.key==='Escape')closeCart();});
  document.addEventListener('click',e=>{const el=e.target.closest?.('[data-open]');if(el?.dataset?.open){activeProductId=el.dataset.open;modalQty=1;setTimeout(enhanceModal,0);}},true);
  new MutationObserver(()=>{enhanceCards();}).observe($('#productGrid'),{childList:true,subtree:true});
  new MutationObserver(()=>setTimeout(enhanceModal,0)).observe($('#modalInner'),{childList:true,subtree:true});
  window.addEventListener('valto:commerce-updated',()=>{enhanceCards();renderCart();if(activeProductId)setTimeout(enhanceModal,0);});
  window.addEventListener('valto:payment-approved',()=>{cart=[];saveCart();});
  window.addEventListener('storage',e=>{if(e.key===CART_KEY){cart=loadCart();renderCart();}});

  loadSettings();renderCart();setTimeout(enhanceCards,500);
})();
