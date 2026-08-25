(() => {
  const config=window.VALTO_CONFIG||{};
  const CART_KEY='valto_cart_v2';
  const CHECKOUT_KEY='valto_checkout_draft';
  const $=s=>document.querySelector(s);
  const $$=s=>[...document.querySelectorAll(s)];
  const fmt=n=>new Intl.NumberFormat('es-AR',{style:'currency',currency:'ARS',maximumFractionDigits:0}).format(Number(n||0));
  const esc=(s='')=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  let cart=[];
  let products=[];
  let settings={};
  let currentStep=1;
  let quoteSeq=0;
  let quoteTimer=null;
  let shippingQuote={status:'idle',available:false,cp:'',home:null,branch:null,source:'manual_fallback',code:'',error:'',package:null};

  function toast(msg){const t=$('#checkoutToast');if(!t)return;t.textContent=msg;t.classList.add('show');setTimeout(()=>t.classList.remove('show'),2600);}
  function loadCart(){try{const v=JSON.parse(localStorage.getItem(CART_KEY)||'[]');return Array.isArray(v)?v:[];}catch{return[];}}
  function loadDraft(){try{return JSON.parse(sessionStorage.getItem(CHECKOUT_KEY)||'{}')||{};}catch{return{};}}
  function saveDraft(){sessionStorage.setItem(CHECKOUT_KEY,JSON.stringify(readCheckout()));}
  function product(id){return products.find(p=>String(p.id)===String(id));}
  function postal(){return String($('#checkoutPostal')?.value||'').toUpperCase().replace(/\s+/g,'').trim();}
  function postalValid(v){return /^[A-Z0-9]{4,8}$/.test(v||'');}
  function selectedShipping(){return document.querySelector('input[name="shippingMethod"]:checked')?.value||'';}
  function selectedPayment(){return document.querySelector('input[name="paymentMethod"]:checked')?.value||'';}

  async function loadRemote(){
    if(!config.supabaseUrl||!config.supabaseAnonKey)throw new Error('La tienda no está configurada.');
    const headers={apikey:config.supabaseAnonKey};
    const ids=[...new Set(cart.map(i=>i.productId))];
    const filter=ids.map(id=>`"${String(id).replace(/"/g,'')}"`).join(',');
    const productFields='id,name,price,transfer_price,cash_price,stock,image,variants,variant_label,visible,shipping_weight_g,shipping_length_cm,shipping_width_cm,shipping_height_cm';
    const [sr,pr]=await Promise.all([
      fetch(`${config.supabaseUrl}/rest/v1/valto_commerce_settings?id=eq.default&select=*`,{headers,cache:'no-store'}),
      fetch(`${config.supabaseUrl}/rest/v1/valto_products?id=in.(${encodeURIComponent(filter)})&select=${productFields}`,{headers,cache:'no-store'})
    ]);
    if(!sr.ok||!pr.ok)throw new Error('No se pudo cargar la información de compra.');
    const s=await sr.json(),p=await pr.json();
    settings=s?.[0]||{};products=Array.isArray(p)?p:[];
  }

  function priceFor(p,method){
    if(method==='transferencia'&&Number(p.transfer_price||0)>0)return Number(p.transfer_price);
    if(method==='efectivo'&&Number(p.cash_price||0)>0)return Number(p.cash_price);
    const list=Number(p.price||0);
    if(method==='transferencia')return list*(1-Number(settings.transfer_discount_pct||0)/100);
    if(method==='efectivo')return list*(1-Number(settings.cash_discount_pct||0)/100);
    return list;
  }

  function subtotal(method='mercadopago'){
    return cart.reduce((sum,i)=>{const p=product(i.productId);return sum+(p?priceFor(p,method)*Number(i.quantity||0):0);},0);
  }

  function quotedRate(method){
    if(!shippingQuote.available)return null;
    if(method==='correo_sucursal')return shippingQuote.branch&&Number.isFinite(Number(shippingQuote.branch.price))?Number(shippingQuote.branch.price):null;
    if(method==='correo_domicilio')return shippingQuote.home&&Number.isFinite(Number(shippingQuote.home.price))?Number(shippingQuote.home.price):null;
    return null;
  }

  function shippingCost(method=selectedShipping(),base=subtotal(selectedPayment()||'mercadopago')){
    const freeFrom=Math.max(0,Number(settings.shipping_free_from||0));
    if(freeFrom>0&&base>=freeFrom)return 0;
    const live=quotedRate(method);
    if(live!=null)return Math.max(0,live);
    if(method==='correo_sucursal')return Math.max(0,Number(settings.shipping_branch_cost||0));
    if(method==='correo_domicilio')return Math.max(0,Number(settings.shipping_home_cost||0));
    return 0;
  }

  function total(){const pm=selectedPayment()||'mercadopago';const sub=subtotal(pm);return sub+shippingCost(selectedShipping(),sub);}

  function renderOrderDetails(){
    const pm=selectedPayment()||'mercadopago';
    const rows=cart.map(i=>{const p=product(i.productId);if(!p)return'';return `<div class="order-item"><img src="${esc(p.image||'')}" alt=""><div><b>${esc(p.name)}</b><small>${i.variant?`${esc(p.variant_label||'Opción')}: ${esc(i.variant)} · `:''}Cantidad ${Number(i.quantity||1)}</small></div><strong>${fmt(priceFor(p,pm)*Number(i.quantity||1))}</strong></div>`;}).join('');
    $('#orderDetails').innerHTML=rows;
    $('#orderTotalHeader').textContent=fmt(total());
  }

  function quoteCopy(method,cp,eta){
    if(shippingQuote.status==='loading'&&postalValid(cp))return `Calculando tarifa para CP ${esc(cp)}…`;
    const rate=method==='correo_sucursal'?shippingQuote.branch:shippingQuote.home;
    if(shippingQuote.available&&rate){
      const service=esc(rate.productName||rate.productType||'PAQ.AR');
      return `Cotización automática · ${service}${cp?' · CP '+esc(cp):''}`;
    }
    if(shippingQuote.code==='missing_product_dimensions')return `Tarifa provisoria · faltan peso/medidas de uno o más productos${cp?' · CP '+esc(cp):''}`;
    if(shippingQuote.code==='package_too_large')return `Tarifa provisoria · el carrito requiere cotización especial${cp?' · CP '+esc(cp):''}`;
    if(settings.shipping_dynamic_quote_enabled!==false&&postalValid(cp))return `Tarifa provisoria mientras Correo Argentino no esté conectado · CP ${esc(cp)}`;
    return `${eta}${cp?' · CP '+esc(cp):''}`;
  }

  function renderShipping(){
    const previous=selectedShipping()||loadDraft().shippingMethod||'';
    const cp=postal();
    const eta=esc(settings.shipping_eta_text||'3 a 6 días hábiles, según el origen y el destino. Luego de ser despachado.');
    const base=subtotal(selectedPayment()||'mercadopago');
    const branch=shippingCost('correo_sucursal',base),home=shippingCost('correo_domicilio',base);
    const branchPrice=shippingQuote.status==='loading'&&quotedRate('correo_sucursal')==null?'Calculando…':fmt(branch);
    const homePrice=shippingQuote.status==='loading'&&quotedRate('correo_domicilio')==null?'Calculando…':fmt(home);
    $('#shippingOptions').innerHTML=`
      <label class="choice"><input type="radio" name="shippingMethod" value="correo_sucursal"><div><div class="choice-title">Correo Argentino · Retiro por sucursal</div><div class="choice-copy">${quoteCopy('correo_sucursal',cp,eta)}</div></div><div class="choice-price">${branchPrice}</div></label>
      <label class="choice"><input type="radio" name="shippingMethod" value="correo_domicilio"><div><div class="choice-title">Correo Argentino · Envío a domicilio</div><div class="choice-copy">${quoteCopy('correo_domicilio',cp,eta)}</div></div><div class="choice-price">${homePrice}</div></label>
      ${settings.allow_shipping_coordination===false?'':`<label class="choice"><input type="radio" name="shippingMethod" value="coordinar"><div><div class="choice-title">A coordinar con el vendedor</div><div class="choice-copy">La entrega y su costo se coordinan después de realizar el pedido.</div></div><div class="choice-price">A coordinar</div></label>`}`;
    if(previous){const r=document.querySelector(`input[name="shippingMethod"][value="${CSS.escape(previous)}"]`);if(r)r.checked=true;}
    $$('input[name="shippingMethod"]').forEach(r=>r.onchange=()=>{toggleAddress();renderOrderDetails();renderFinalSummary();saveDraft();});
    toggleAddress();
  }

  async function refreshShippingQuote(force=false){
    const cp=postal();
    if(settings.shipping_dynamic_quote_enabled===false){
      shippingQuote={status:'idle',available:false,cp,home:null,branch:null,source:'manual_fallback',code:'dynamic_quote_disabled',error:'',package:null};
      renderShipping();renderOrderDetails();renderFinalSummary();
      return shippingQuote;
    }
    if(!postalValid(cp)){
      shippingQuote={status:'idle',available:false,cp,home:null,branch:null,source:'manual_fallback',code:'invalid_postal',error:'',package:null};
      renderShipping();renderOrderDetails();renderFinalSummary();
      return shippingQuote;
    }
    if(!force&&shippingQuote.cp===cp&&(shippingQuote.status==='loading'||shippingQuote.status==='ready'))return shippingQuote;

    const seq=++quoteSeq;
    shippingQuote={...shippingQuote,status:'loading',available:false,cp,home:null,branch:null,source:'manual_fallback',code:'',error:'',package:null};
    renderShipping();renderOrderDetails();renderFinalSummary();

    const items=cart.map(i=>({productId:i.productId,quantity:Number(i.quantity||1)}));
    try{
      const response=await fetch('/api/correo-checkout-quote',{
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify({items,postalCodeDestination:cp})
      });
      const data=await response.json().catch(()=>({}));
      if(seq!==quoteSeq||postal()!==cp)return shippingQuote;
      if(!response.ok)throw new Error(data?.error||`Error ${response.status}`);
      if(data?.available){
        shippingQuote={status:'ready',available:true,cp,home:data.home||null,branch:data.branch||null,source:data.source||'correo_argentino_api',code:'',error:'',package:data.package||null,environment:data.environment||''};
      }else{
        shippingQuote={status:'ready',available:false,cp,home:null,branch:null,source:'manual_fallback',code:data?.code||'correo_unavailable',error:data?.error||'',package:data?.package||null};
      }
    }catch(error){
      if(seq!==quoteSeq||postal()!==cp)return shippingQuote;
      shippingQuote={status:'ready',available:false,cp,home:null,branch:null,source:'manual_fallback',code:'quote_error',error:error?.message||'No se pudo cotizar.',package:null};
    }
    renderShipping();renderOrderDetails();renderFinalSummary();saveDraft();
    return shippingQuote;
  }

  function scheduleShippingQuote(){
    if(quoteTimer)clearTimeout(quoteTimer);
    quoteTimer=setTimeout(()=>refreshShippingQuote(false),450);
  }

  function renderPayments(){
    const t=Number(settings.transfer_discount_pct||23),c=Number(settings.cash_discount_pct||28),n=Math.max(1,Number(settings.installments_count||3));
    const parts=[];
    if(settings.allow_seller_agreement!==false)parts.push(`<label class="choice"><input type="radio" name="paymentMethod" value="acordar"><div><div class="choice-title">Acordar con el vendedor</div><div class="choice-copy">El vendedor se contacta para coordinar el pago.</div></div><div class="choice-price">${fmt(subtotal('acordar'))}</div></label>`);
    if(settings.allow_transfer!==false)parts.push(`<label class="choice"><input type="radio" name="paymentMethod" value="transferencia"><div><div class="choice-title">Transferencia <span class="discount-badge">${t}% de descuento</span></div><div class="choice-copy">Pedido pendiente hasta confirmar la transferencia.</div></div><div class="choice-price">${fmt(subtotal('transferencia'))}</div></label>`);
    if(settings.allow_cash!==false)parts.push(`<label class="choice"><input type="radio" name="paymentMethod" value="efectivo"><div><div class="choice-title">Efectivo <span class="discount-badge">${c}% de descuento</span></div><div class="choice-copy">El pago se coordina con el vendedor.</div></div><div class="choice-price">${fmt(subtotal('efectivo'))}</div></label>`);
    if(settings.allow_mercadopago!==false)parts.push(`<label class="choice"><input type="radio" name="paymentMethod" value="mercadopago"><div><div class="choice-title mp-mark"><span class="mp-badge">MP</span> Mercado Pago</div><div class="choice-copy">Hasta ${n} cuotas${settings.installments_interest_free!==false?' sin interés':''} con tarjetas seleccionadas.</div></div><div class="choice-price">${fmt(subtotal('mercadopago'))}</div></label>`);
    $('#paymentOptions').innerHTML=parts.join('');
    $$('input[name="paymentMethod"]').forEach(r=>r.onchange=()=>{renderShipping();renderFinalSummary();renderOrderDetails();saveDraft();});
  }

  function renderFinalSummary(){
    const pm=selectedPayment()||'mercadopago',sub=subtotal(pm),ship=shippingCost(selectedShipping(),sub),list=subtotal('mercadopago'),disc=Math.max(0,list-sub);
    const live=quotedRate(selectedShipping())!=null;
    const shippingLabel=selectedShipping()==='coordinar'?'A coordinar':fmt(ship);
    const shippingHint=selectedShipping().startsWith('correo_')?` <small style="display:block;color:var(--muted);font-weight:400">${live?'Cotizado por Correo Argentino':'Tarifa de respaldo'}</small>`:'';
    $('#finalSummary').innerHTML=`<div class="summary-row"><span>Productos</span><b>${fmt(sub)}</b></div>${disc?`<div class="summary-row"><span>Descuento</span><b>− ${fmt(disc)}</b></div>`:''}<div class="summary-row"><span>Envío</span><b>${shippingLabel}${shippingHint}</b></div><div class="summary-row total"><span>Total</span><span>${fmt(sub+ship)}</span></div>`;
    $('#orderTotalHeader').textContent=fmt(sub+ship);
  }

  function toggleAddress(){
    const method=selectedShipping();
    $('#addressFields').classList.toggle('hidden',method!=='correo_domicilio');
  }

  function showStep(step){
    currentStep=step;
    $$('.checkout-step').forEach(s=>s.classList.toggle('hidden',Number(s.dataset.step)!==step));
    $$('.step-pill').forEach((p,i)=>p.classList.toggle('active',i+1===Math.min(step,3)));
    if(step===3){renderPayments();restoreSelections();renderShipping();renderFinalSummary();}
    window.scrollTo({top:0,behavior:'smooth'});
  }

  function readCheckout(){
    const pm=selectedPayment()||'mercadopago';
    const sub=subtotal(pm);
    return {
      email:$('#checkoutEmail')?.value.trim()||'',postalCode:postal(),shippingMethod:selectedShipping(),paymentMethod:selectedPayment(),
      firstName:$('#firstName')?.value.trim()||'',lastName:$('#lastName')?.value.trim()||'',phone:$('#phone')?.value.trim()||'',taxId:$('#taxId')?.value.trim()||'',
      street:$('#street')?.value.trim()||'',number:$('#streetNumber')?.value.trim()||'',apartment:$('#apartment')?.value.trim()||'',addressDescription:$('#addressDescription')?.value.trim()||'',city:$('#city')?.value.trim()||'',province:$('#province')?.value||'',notes:$('#orderNotes')?.value.trim()||'',
      shippingQuoteSource:quotedRate(selectedShipping())!=null?'correo_argentino_api':'manual_fallback',
      shippingQuotedCost:selectedShipping()==='coordinar'?0:shippingCost(selectedShipping(),sub)
    };
  }

  function restoreDraft(){
    const d=loadDraft();
    const map={checkoutEmail:'email',checkoutPostal:'postalCode',firstName:'firstName',lastName:'lastName',phone:'phone',taxId:'taxId',street:'street',streetNumber:'number',apartment:'apartment',addressDescription:'addressDescription',city:'city',province:'province',orderNotes:'notes'};
    Object.entries(map).forEach(([id,k])=>{if($('#'+id)&&d[k]!=null)$('#'+id).value=d[k];});
  }

  function restoreSelections(){
    const d=loadDraft();
    if(d.shippingMethod){const r=document.querySelector(`input[name="shippingMethod"][value="${CSS.escape(d.shippingMethod)}"]`);if(r)r.checked=true;}
    if(d.paymentMethod){const r=document.querySelector(`input[name="paymentMethod"][value="${CSS.escape(d.paymentMethod)}"]`);if(r)r.checked=true;}
    toggleAddress();
  }

  function validateStep1(){const email=$('#checkoutEmail').value.trim();if(!/^\S+@\S+\.\S+$/.test(email)){toast('Ingresá un email válido.');return false;}return true;}
  function validateShipping(){
    if(!selectedShipping()){toast('Seleccioná un método de entrega.');return false;}
    if(selectedShipping()!=='coordinar'&&!postalValid(postal())){toast('Ingresá un código postal válido.');return false;}
    if(!$('#firstName').value.trim()||!$('#lastName').value.trim()||!$('#phone').value.trim()||!$('#taxId').value.trim()){toast('Completá los datos del destinatario.');return false;}
    if(selectedShipping()==='correo_domicilio'&&(!$('#street').value.trim()||!$('#city').value.trim()||!$('#province').value)){toast('Completá el domicilio de entrega.');return false;}
    return true;
  }

  async function finish(){
    if(!selectedPayment()){toast('Seleccioná un método de pago.');return;}
    if(!validateStep1()||!validateShipping())return;
    if(selectedShipping().startsWith('correo_'))await refreshShippingQuote(true);
    const btn=$('#finishOrder');btn.disabled=true;btn.textContent='Procesando pedido...';
    const checkout=readCheckout();saveDraft();
    const items=cart.map(i=>({productId:i.productId,quantity:Number(i.quantity||1),variant:i.variant||''}));
    try{
      if(checkout.paymentMethod==='mercadopago'){
        const r=await fetch('/api/create-preference',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({items,postalCode:checkout.postalCode,shippingMethod:checkout.shippingMethod,checkout})});
        const data=await r.json();if(!r.ok)throw new Error(data.error||'No se pudo iniciar Mercado Pago.');location.href=data.checkoutUrl;return;
      }
      const r=await fetch('/api/create-manual-order',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({items,checkout})});
      const data=await r.json();if(!r.ok)throw new Error(data.error||'No se pudo registrar el pedido.');
      localStorage.removeItem(CART_KEY);sessionStorage.removeItem(CHECKOUT_KEY);
      $('#confirmationId').textContent=`Pedido ${String(data.orderId||'').slice(0,8).toUpperCase()}`;
      const text=checkout.paymentMethod==='transferencia'?'Tu pedido quedó pendiente de transferencia. El vendedor podrá ver todos tus datos y coordinar la confirmación del pago.':checkout.paymentMethod==='efectivo'?'Tu pedido quedó registrado para pago en efectivo. El vendedor coordinará el pago y la entrega.':'Tu pedido quedó registrado. El vendedor se pondrá en contacto para coordinar pago y entrega.';
      $('#confirmationText').textContent=text;showStep(4);
    }catch(e){toast(e.message||'No se pudo finalizar el pedido.');btn.disabled=false;btn.textContent='Finalizar el pedido';}
  }

  async function init(){
    cart=loadCart();
    if(!cart.length){location.replace('index.html');return;}
    try{await loadRemote();}catch(e){toast(e.message);return;}
    const bad=cart.find(i=>{const p=product(i.productId);return !p||p.visible===false||Number(p.stock||0)<Number(i.quantity||1);});
    if(bad){toast('Cambió el stock de tu carrito. Volvé a la tienda para revisarlo.');setTimeout(()=>location.replace('index.html'),1800);return;}
    restoreDraft();
    $('#dispatchText').textContent=settings.shipping_dispatch_text||'Tu pedido se despacha entre 1 y 3 días hábiles.';
    renderShipping();restoreSelections();renderPayments();restoreSelections();renderShipping();renderOrderDetails();renderFinalSummary();
    $('#postalMirror').value=postal();
    if(postalValid(postal()))refreshShippingQuote(false);
  }

  $('#orderToggle').onclick=()=>$('#orderDetails').classList.toggle('hidden');
  $('#toShipping').onclick=()=>{if(validateStep1()){saveDraft();showStep(2);if(postalValid(postal()))refreshShippingQuote(false);}};
  $('#toPayment').onclick=async()=>{if(!validateStep1()||!validateShipping())return;if(selectedShipping().startsWith('correo_'))await refreshShippingQuote(true);saveDraft();showStep(3);};
  $('#finishOrder').onclick=finish;
  $('#checkoutPostal').addEventListener('input',()=>{
    const cp=postal();
    $('#checkoutPostal').value=cp;
    $('#postalMirror').value=cp;
    quoteSeq++;
    shippingQuote={status:'idle',available:false,cp,home:null,branch:null,source:'manual_fallback',code:'',error:'',package:null};
    renderShipping();restoreSelections();renderOrderDetails();renderFinalSummary();saveDraft();
    if(postalValid(cp))scheduleShippingQuote();
  });
  $$('[data-step-go]').forEach(b=>b.onclick=async()=>{const n=Number(b.dataset.stepGo);if(n===2&&!validateStep1())return;if(n===3&&(!validateStep1()||!validateShipping()))return;if(n===3&&selectedShipping().startsWith('correo_'))await refreshShippingQuote(true);saveDraft();showStep(n);});
  ['checkoutEmail','firstName','lastName','phone','taxId','street','streetNumber','apartment','addressDescription','city','province','orderNotes'].forEach(id=>$('#'+id)?.addEventListener('change',saveDraft));
  init();
})();
