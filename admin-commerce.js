(() => {
  const config=window.VALTO_CONFIG||{};
  if(!window.supabase||!config.supabaseUrl||!config.supabaseAnonKey)return;
  const sb=window.supabase.createClient(config.supabaseUrl,config.supabaseAnonKey,{auth:{persistSession:true}});
  const $=s=>document.querySelector(s);
  const esc=(s='')=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const fmt=n=>new Intl.NumberFormat('es-AR',{style:'currency',currency:'ARS',maximumFractionDigits:0}).format(Number(n||0));
  const toast=msg=>{const t=$('#toast');if(!t)return;t.textContent=msg;t.classList.add('show');setTimeout(()=>t.classList.remove('show'),2500)};

  async function loadSettings(){
    const {data,error}=await sb.from('valto_commerce_settings').select('*').eq('id','default').maybeSingle();
    if(error){console.error(error);return;}
    const s=data||{};
    if($('#installmentsCount'))$('#installmentsCount').value=Number(s.installments_count||3);
    if($('#installmentsInterestFree'))$('#installmentsInterestFree').checked=s.installments_interest_free!==false;
    if($('#shippingBaseCost'))$('#shippingBaseCost').value=Number(s.shipping_base_cost||0);
    if($('#shippingFreeFrom'))$('#shippingFreeFrom').value=Number(s.shipping_free_from||0);
    if($('#shippingDispatchText'))$('#shippingDispatchText').value=s.shipping_dispatch_text||'Despachamos entre 1 y 3 días hábiles';
  }

  async function saveSettings(){
    const payload={
      id:'default',
      installments_count:Math.max(1,Math.min(24,Math.floor(Number($('#installmentsCount')?.value||3)))),
      installments_interest_free:!!$('#installmentsInterestFree')?.checked,
      shipping_enabled:true,
      shipping_base_cost:Math.max(0,Number($('#shippingBaseCost')?.value||0)),
      shipping_free_from:Math.max(0,Number($('#shippingFreeFrom')?.value||0)),
      shipping_dispatch_text:String($('#shippingDispatchText')?.value||'').trim()||'Despachamos entre 1 y 3 días hábiles',
      shipping_provider:'manual',
      updated_at:new Date().toISOString()
    };
    const {error}=await sb.from('valto_commerce_settings').upsert(payload,{onConflict:'id'});
    if(error){console.error(error);toast('No se pudo guardar la configuración');return;}
    toast('Envíos y cuotas actualizados');
  }

  async function renderOrders(){
    const target=$('#orderRows');if(!target)return;
    const {data,error}=await sb.from('valto_orders').select('id,status,payment_status,total,subtotal,shipping_cost,postal_code,stock_committed,created_at,payment_id,valto_order_items(name_snapshot,variant,quantity)').order('created_at',{ascending:false}).limit(100);
    if(error){console.error(error);return;}
    const rows=data||[];
    target.innerHTML=rows.length?rows.map(o=>{
      const items=(o.valto_order_items||[]).map(i=>`${esc(i.name_snapshot)}${i.variant?` · ${esc(i.variant)}`:''} ×${i.quantity}`).join('<br>')||'—';
      const shipping=Number(o.shipping_cost||0)>0?`<small style="display:block;color:var(--muted);margin-top:4px">Envío ${fmt(o.shipping_cost)}${o.postal_code?` · CP ${esc(o.postal_code)}`:''}</small>`:'';
      const paid=o.payment_status==='approved'||o.status==='paid';
      const failed=['payment_failed','rejected','cancelled'].includes(o.status)||o.payment_status==='rejected';
      const cls=paid?'paid':failed?'failed':'pending';
      const label=paid?'Aprobado':failed?'Fallido':o.payment_status||'Pendiente';
      return `<tr><td>${new Date(o.created_at).toLocaleString('es-AR')}</td><td>${items}${shipping}</td><td>${fmt(o.total)}</td><td><span class="order-status ${cls}">${esc(label)}</span></td><td>${o.stock_committed?'Descontado':'Pendiente'}</td><td style="font-size:11px">${esc(String(o.id).slice(0,8))}</td></tr>`;
    }).join(''):'<tr><td colspan="6">Todavía no hay ventas registradas.</td></tr>';
  }

  if($('#saveCommerceSettings'))$('#saveCommerceSettings').onclick=saveSettings;
  if($('#refreshOrders'))$('#refreshOrders').onclick=renderOrders;
  document.addEventListener('click',e=>{
    const tab=e.target.closest?.('.admin-nav button');
    if(tab?.dataset?.tab==='shipping')setTimeout(loadSettings,0);
    if(tab?.dataset?.tab==='orders')setTimeout(renderOrders,40);
  },true);

  sb.auth.getSession().then(({data})=>{if(data.session){loadSettings();renderOrders();}});
  sb.auth.onAuthStateChange((_event,session)=>{if(session){setTimeout(loadSettings,0);setTimeout(renderOrders,0);}});
})();
