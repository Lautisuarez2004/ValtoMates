(() => {
  const config=window.VALTO_CONFIG||{};
  if(!window.supabase||!config.supabaseUrl||!config.supabaseAnonKey)return;
  const sb=window.supabase.createClient(config.supabaseUrl,config.supabaseAnonKey,{auth:{persistSession:true}});
  const $=s=>document.querySelector(s);
  const esc=(s='')=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const fmt=n=>new Intl.NumberFormat('es-AR',{style:'currency',currency:'ARS',maximumFractionDigits:0}).format(Number(n||0));
  const toast=msg=>{const t=$('#toast');if(!t)return;t.textContent=msg;t.classList.add('show');setTimeout(()=>t.classList.remove('show'),2500)};

  function injectCommerceAdmin(){
    const panel=document.querySelector('[data-panel="shipping"] .admin-card');
    if(panel&&!$('#shippingBranchCost')){
      const grid=panel.querySelector('.form-grid');
      $('#shippingBaseCost')?.closest('.field')?.classList.add('hidden');
      grid?.insertAdjacentHTML('beforeend',`
        <div class="field"><label>Proveedor de envío</label><input value="Correo Argentino" disabled></div>
        <div class="field"><label>Correo Argentino · Retiro por sucursal</label><input id="shippingBranchCost" type="number" min="0" step="1"></div>
        <div class="field"><label>Correo Argentino · Envío a domicilio</label><input id="shippingHomeCost" type="number" min="0" step="1"></div>
        <div class="field"><label>Descuento transferencia (%)</label><input id="transferDiscountPct" type="number" min="0" max="100" step="0.1"></div>
        <div class="field"><label>Descuento efectivo (%)</label><input id="cashDiscountPct" type="number" min="0" max="100" step="0.1"></div>
        <div class="field full"><label>Plazo mostrado de Correo Argentino</label><input id="shippingEtaText" placeholder="3 a 6 días hábiles..."></div>
      `);
      const p=panel.querySelector('p');if(p)p.innerHTML='Valto usa <b>Correo Argentino</b>. Estas tarifas son editables y funcionan como cotización manual hasta conectar las credenciales/API del correo.';
    }
    const orders=document.querySelector('[data-panel="orders"] h2');if(orders)orders.textContent='Ventas';
    const ordersCopy=document.querySelector('[data-panel="orders"] p');if(ordersCopy)ordersCopy.textContent='Órdenes de Mercado Pago, transferencia, efectivo y pagos a coordinar.';
  }

  async function loadSettings(){
    injectCommerceAdmin();
    const {data,error}=await sb.from('valto_commerce_settings').select('*').eq('id','default').maybeSingle();
    if(error){console.error(error);return;}
    const s=data||{};
    if($('#installmentsCount'))$('#installmentsCount').value=Number(s.installments_count||3);
    if($('#installmentsInterestFree'))$('#installmentsInterestFree').checked=s.installments_interest_free!==false;
    if($('#shippingFreeFrom'))$('#shippingFreeFrom').value=Number(s.shipping_free_from||0);
    if($('#shippingDispatchText'))$('#shippingDispatchText').value=s.shipping_dispatch_text||'Hola! una vez abonado tu pedido va a ser despachado entre 1-3 días hábiles';
    if($('#shippingBranchCost'))$('#shippingBranchCost').value=Number(s.shipping_branch_cost||0);
    if($('#shippingHomeCost'))$('#shippingHomeCost').value=Number(s.shipping_home_cost||0);
    if($('#transferDiscountPct'))$('#transferDiscountPct').value=Number(s.transfer_discount_pct||23);
    if($('#cashDiscountPct'))$('#cashDiscountPct').value=Number(s.cash_discount_pct||28);
    if($('#shippingEtaText'))$('#shippingEtaText').value=s.shipping_eta_text||'3 a 6 días hábiles, según el origen y el destino. Luego de ser despachado.';
  }

  async function saveSettings(){
    const payload={
      id:'default',
      installments_count:Math.max(1,Math.min(24,Math.floor(Number($('#installmentsCount')?.value||3)))),
      installments_interest_free:!!$('#installmentsInterestFree')?.checked,
      shipping_enabled:true,
      shipping_base_cost:0,
      shipping_free_from:Math.max(0,Number($('#shippingFreeFrom')?.value||0)),
      shipping_dispatch_text:String($('#shippingDispatchText')?.value||'').trim()||'Hola! una vez abonado tu pedido va a ser despachado entre 1-3 días hábiles',
      shipping_provider:'correo_argentino',
      shipping_branch_cost:Math.max(0,Number($('#shippingBranchCost')?.value||0)),
      shipping_home_cost:Math.max(0,Number($('#shippingHomeCost')?.value||0)),
      transfer_discount_pct:Math.max(0,Math.min(100,Number($('#transferDiscountPct')?.value||0))),
      cash_discount_pct:Math.max(0,Math.min(100,Number($('#cashDiscountPct')?.value||0))),
      shipping_eta_text:String($('#shippingEtaText')?.value||'').trim()||'3 a 6 días hábiles, según el origen y el destino. Luego de ser despachado.',
      allow_shipping_coordination:true,allow_transfer:true,allow_cash:true,allow_seller_agreement:true,allow_mercadopago:true,
      updated_at:new Date().toISOString()
    };
    const {error}=await sb.from('valto_commerce_settings').upsert(payload,{onConflict:'id'});
    if(error){console.error(error);toast('No se pudo guardar la configuración');return;}
    toast('Envíos, descuentos y cuotas actualizados');
  }

  function methodLabel(v){return ({mercadopago:'Mercado Pago',transferencia:'Transferencia',efectivo:'Efectivo',acordar:'A coordinar'})[v]||v||'—';}
  function shippingLabel(v){return ({correo_sucursal:'Correo Arg. sucursal',correo_domicilio:'Correo Arg. domicilio',coordinar:'A coordinar'})[v]||v||'—';}

  async function renderOrders(){
    const target=$('#orderRows');if(!target)return;
    const {data,error}=await sb.from('valto_orders').select('id,status,payment_status,total,subtotal,shipping_cost,postal_code,shipping_method,payment_method,contact_email,customer_first_name,customer_last_name,stock_committed,created_at,payment_id,valto_order_items(name_snapshot,variant,quantity)').order('created_at',{ascending:false}).limit(100);
    if(error){console.error(error);return;}
    const rows=data||[];
    target.innerHTML=rows.length?rows.map(o=>{
      const items=(o.valto_order_items||[]).map(i=>`${esc(i.name_snapshot)}${i.variant?` · ${esc(i.variant)}`:''} ×${i.quantity}`).join('<br>')||'—';
      const customer=[o.customer_first_name,o.customer_last_name].filter(Boolean).join(' ');
      const meta=`<small style="display:block;color:var(--muted);margin-top:5px">${esc(methodLabel(o.payment_method))} · ${esc(shippingLabel(o.shipping_method))}${o.postal_code?` · CP ${esc(o.postal_code)}`:''}${customer?`<br>${esc(customer)}`:''}${o.contact_email?` · ${esc(o.contact_email)}`:''}</small>`;
      const paid=o.payment_status==='approved'||o.status==='paid';
      const failed=['payment_failed','rejected','cancelled'].includes(o.status)||o.payment_status==='rejected';
      const cls=paid?'paid':failed?'failed':'pending';
      const label=paid?'Aprobado':o.status==='awaiting_transfer'?'Esperando transferencia':o.status==='awaiting_cash'?'Pago en efectivo':o.status==='seller_coordination'?'A coordinar':failed?'Fallido':o.payment_status||'Pendiente';
      return `<tr><td>${new Date(o.created_at).toLocaleString('es-AR')}</td><td>${items}${meta}</td><td>${fmt(o.total)}</td><td><span class="order-status ${cls}">${esc(label)}</span></td><td>${o.stock_committed?'Descontado':'Pendiente'}</td><td style="font-size:11px">${esc(String(o.id).slice(0,8))}</td></tr>`;
    }).join(''):'<tr><td colspan="6">Todavía no hay ventas registradas.</td></tr>';
  }

  injectCommerceAdmin();
  if($('#saveCommerceSettings'))$('#saveCommerceSettings').onclick=saveSettings;
  if($('#refreshOrders'))$('#refreshOrders').onclick=renderOrders;
  document.addEventListener('click',e=>{const tab=e.target.closest?.('.admin-nav button');if(tab?.dataset?.tab==='shipping')setTimeout(loadSettings,0);if(tab?.dataset?.tab==='orders')setTimeout(renderOrders,40);},true);
  sb.auth.getSession().then(({data})=>{if(data.session){loadSettings();renderOrders();}});
  sb.auth.onAuthStateChange((_event,session)=>{if(session){setTimeout(loadSettings,0);setTimeout(renderOrders,0);}});
})();
