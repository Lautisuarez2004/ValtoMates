(() => {
  const defaults = window.VALTO_DEFAULTS;
  const config = window.VALTO_CONFIG || {};
  const iconList = window.VALTO_CATEGORY_ICONS || [];
  const iconMap = window.VALTO_ICON_MAP || {};
  const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
  const esc=(s='')=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const fmt=n=>new Intl.NumberFormat('es-AR',{style:'currency',currency:'ARS',maximumFractionDigits:0}).format(Number(n||0));
  const slug=s=>String(s||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/(^-|-$)/g,'');
  const toast=msg=>{const t=$('#toast');t.textContent=msg;t.classList.add('show');setTimeout(()=>t.classList.remove('show'),2500)};

  if(!window.supabase || !config.supabaseUrl || !config.supabaseAnonKey){
    $('#loginError').textContent='Supabase no está configurado.';
    return;
  }

  const sb = window.supabase.createClient(config.supabaseUrl, config.supabaseAnonKey);
  const local = JSON.parse(localStorage.getItem('valto_store_data') || 'null');
  let state = { settings:{...structuredClone(defaults.settings), ...(local?.settings||{})}, categories:[], products:[] };
  let orders = [];
  let editingId = null;
  let editingCategoryId = null;

  function saveLocalSettings(){
    const current = JSON.parse(localStorage.getItem('valto_store_data') || 'null') || {};
    current.settings = state.settings;
    localStorage.setItem('valto_store_data', JSON.stringify(current));
  }

  function iconSvg(id){return (iconMap[id] || iconMap.tag || {svg:''}).svg}
  function fillGeneral(){ for(const k of ['announcement','heroEyebrow','heroTitle','heroText','heroCta','heroSecondary','accent','accentDark','background','comboTitle','comboText']) if($('#'+k)) $('#'+k).value=state.settings[k]||''; }
  $('#saveGeneral').onclick=()=>{ for(const k of ['announcement','heroEyebrow','heroTitle','heroText','heroCta','heroSecondary','accent','accentDark','background','comboTitle','comboText']) state.settings[k]=$('#'+k).value; saveLocalSettings(); toast('Textos guardados en este navegador'); };

  function fillIconOptions(){
    $('#cIcon').innerHTML=iconList.map(i=>`<option value="${esc(i.id)}">${esc(i.label)}</option>`).join('');
    if(!$('#cIcon').value && iconList[0]) $('#cIcon').value=iconList[0].id; updateIconPreview();
  }
  function updateIconPreview(){ const item=iconMap[$('#cIcon').value] || iconMap.tag; $('#cIconPreview').innerHTML=item?`${item.svg}<span>${esc(item.label)}</span>`:''; }
  $('#cIcon').addEventListener('change',updateIconPreview);

  function mapProduct(p){
    return { id:p.id,name:p.name,category:p.category,badge:p.badge||'',price:Number(p.price||0),transferPrice:Number(p.transfer_price||0),cashPrice:Number(p.cash_price||0),stock:Number(p.stock||0),image:p.image||'',description:p.description||'',variants:Array.isArray(p.variants)?p.variants.join(' · '):'',featured:!!p.featured };
  }
  function toDbProduct(p){
    return { id:p.id,name:p.name,category:p.category,badge:p.badge,price:p.price,transfer_price:p.transferPrice,cash_price:p.cashPrice,stock:p.stock,image:p.image,description:p.description,variants:String(p.variants||'').split('·').map(v=>v.trim()).filter(Boolean),featured:p.featured,visible:true,updated_at:new Date().toISOString() };
  }

  async function loadCommerce(){
    const [{data:cats,error:ce},{data:prods,error:pe}] = await Promise.all([
      sb.from('valto_categories').select('*').eq('visible',true).order('sort_order'),
      sb.from('valto_products').select('*').eq('visible',true).order('featured',{ascending:false}).order('created_at')
    ]);
    if(ce||pe) throw ce||pe;
    state.categories=(cats||[]).map(c=>({id:c.id,name:c.name,icon:c.icon||'tag',sortOrder:c.sort_order||0}));
    state.products=(prods||[]).map(mapProduct);
    categoryRows(); rows();
  }

  function categoryRows(){
    $('#categoryRows').innerHTML=state.categories.map(c=>{ const count=state.products.filter(p=>p.category===c.name).length; return `<tr><td><div class="admin-category-icon">${iconSvg(c.icon)}</div></td><td><b>${esc(c.name)}</b></td><td>${count}</td><td><div class="table-actions"><button class="small-btn" data-cedit="${esc(c.id)}">Editar</button><button class="small-btn danger" data-cdel="${esc(c.id)}">Eliminar</button></div></td></tr>`; }).join('');
    $$('[data-cedit]').forEach(b=>b.onclick=()=>openCategoryForm(b.dataset.cedit)); $$('[data-cdel]').forEach(b=>b.onclick=()=>removeCategory(b.dataset.cdel)); fillProductCategoryOptions();
  }
  function resetCategoryForm(){ editingCategoryId=null; $('#categoryFormTitle').textContent='Nueva categoría'; $('#saveCategory').textContent='Agregar categoría'; $('#cancelCategory').classList.add('hidden'); $('#cName').value=''; $('#cIcon').value=iconList.some(i=>i.id==='tag')?'tag':(iconList[0]?.id||''); updateIconPreview(); }
  function openCategoryForm(id){ const c=state.categories.find(x=>x.id===id);if(!c)return;editingCategoryId=id;$('#categoryFormTitle').textContent='Editar categoría';$('#saveCategory').textContent='Guardar categoría';$('#cancelCategory').classList.remove('hidden');$('#cName').value=c.name;$('#cIcon').value=iconMap[c.icon]?c.icon:'tag';updateIconPreview();$('#cName').focus(); }
  $('#cancelCategory').onclick=resetCategoryForm;
  $('#saveCategory').onclick=async()=>{
    const name=$('#cName').value.trim(), icon=$('#cIcon').value||'tag'; if(!name)return toast('Escribí un nombre');
    const duplicate=state.categories.find(c=>c.name.toLowerCase()===name.toLowerCase()&&c.id!==editingCategoryId); if(duplicate)return toast('Ya existe esa categoría');
    try{
      if(editingCategoryId){
        const c=state.categories.find(x=>x.id===editingCategoryId), oldName=c.name;
        const {error}=await sb.from('valto_categories').update({name,icon,updated_at:new Date().toISOString()}).eq('id',editingCategoryId); if(error)throw error;
        if(oldName!==name){const {error:pe}=await sb.from('valto_products').update({category:name,updated_at:new Date().toISOString()}).eq('category',oldName);if(pe)throw pe;}
      }else{
        let id=slug(name)||`categoria-${Date.now()}`; if(state.categories.some(c=>c.id===id))id=`${id}-${Date.now().toString().slice(-4)}`;
        const sortOrder=(Math.max(0,...state.categories.map(c=>c.sortOrder||0))+10);
        const {error}=await sb.from('valto_categories').insert({id,name,icon,sort_order:sortOrder,visible:true}); if(error)throw error;
      }
      await loadCommerce();resetCategoryForm();toast('Categoría guardada');
    }catch(e){console.error(e);toast('No se pudo guardar la categoría');}
  };
  async function removeCategory(id){
    const c=state.categories.find(x=>x.id===id);if(!c)return;const assigned=state.products.filter(p=>p.category===c.name);if(!confirm(`¿Eliminar “${c.name}”?${assigned.length?` ${assigned.length} producto(s) pasarán a Sin categoría.`:''}`))return;
    try{
      if(assigned.length){
        let fallback=state.categories.find(x=>x.name==='Sin categoría');
        if(!fallback){const {error}=await sb.from('valto_categories').insert({id:'sin-categoria',name:'Sin categoría',icon:'tag',sort_order:999,visible:true});if(error)throw error;}
        const {error:pe}=await sb.from('valto_products').update({category:'Sin categoría',updated_at:new Date().toISOString()}).eq('category',c.name);if(pe)throw pe;
      }
      const {error}=await sb.from('valto_categories').delete().eq('id',id);if(error)throw error;await loadCommerce();resetCategoryForm();toast('Categoría eliminada');
    }catch(e){console.error(e);toast('No se pudo eliminar la categoría');}
  }

  function fillProductCategoryOptions(selected=''){ const sel=$('#pCategory');if(!sel)return;sel.innerHTML=state.categories.map(c=>`<option value="${esc(c.name)}">${esc(c.name)}</option>`).join('');if(selected&&state.categories.some(c=>c.name===selected))sel.value=selected;else if(state.categories[0])sel.value=state.categories[0].name; }
  function stockClass(n){return n<=0?'out':n<=2?'low':''}
  function rows(){
    $('#productRows').innerHTML=state.products.map(p=>`<tr><td><img class="thumb" src="${esc(p.image)}" alt=""></td><td><b>${esc(p.name)}</b></td><td>${esc(p.category)}</td><td>${fmt(p.price)}</td><td><span class="stock-pill ${stockClass(p.stock)}">${p.stock}</span></td><td>${p.featured?'Sí':'—'}</td><td><div class="table-actions"><button class="small-btn" data-edit="${esc(p.id)}">Editar</button><button class="small-btn" data-dup="${esc(p.id)}">Duplicar</button><button class="small-btn danger" data-del="${esc(p.id)}">Ocultar</button></div></td></tr>`).join('');
    $$('[data-edit]').forEach(b=>b.onclick=()=>openForm(b.dataset.edit));$$('[data-dup]').forEach(b=>b.onclick=()=>duplicate(b.dataset.dup));$$('[data-del]').forEach(b=>b.onclick=()=>remove(b.dataset.del));
  }
  function openForm(id=null){
    editingId=id;const defaultCategory=state.categories[0]?.name||'Sin categoría';const p=id?state.products.find(x=>x.id===id):{id:'',name:'',category:defaultCategory,badge:'',price:'',transferPrice:'',cashPrice:'',stock:0,image:'',description:'',variants:'',featured:false};if(!p)return;
    $('#productFormCard').classList.remove('hidden');$('#productFormTitle').textContent=id?'Editar producto':'Nuevo producto';$('#pName').value=p.name;$('#pId').value=p.id;$('#pId').disabled=!!id;fillProductCategoryOptions(p.category);$('#pBadge').value=p.badge||'';$('#pPrice').value=p.price;$('#pTransfer').value=p.transferPrice||'';$('#pCash').value=p.cashPrice||'';$('#pStock').value=p.stock;$('#pImage').value=p.image;$('#pDescription').value=p.description||'';$('#pVariants').value=p.variants||'';$('#pFeatured').checked=!!p.featured;$('#productFormCard').scrollIntoView({behavior:'smooth'});
  }
  $('#newProduct').onclick=()=>openForm(); $('#cancelProduct').onclick=()=>{$('#productFormCard').classList.add('hidden');editingId=null;$('#pId').disabled=false}; $('#pName').addEventListener('input',()=>{if(!editingId)$('#pId').value=slug($('#pName').value)});
  $('#saveProduct').onclick=async()=>{
    const p={id:$('#pId').value.trim()||slug($('#pName').value),name:$('#pName').value.trim(),category:$('#pCategory').value||'',badge:$('#pBadge').value.trim(),price:Number($('#pPrice').value||0),transferPrice:Number($('#pTransfer').value||0),cashPrice:Number($('#pCash').value||0),stock:Math.max(0,Math.floor(Number($('#pStock').value||0))),image:$('#pImage').value.trim(),description:$('#pDescription').value.trim(),variants:$('#pVariants').value.trim(),featured:$('#pFeatured').checked};
    if(!p.name||!p.id)return toast('Completá nombre e ID');
    try{const {error}=await sb.from('valto_products').upsert(toDbProduct(p),{onConflict:'id'});if(error)throw error;await loadCommerce();$('#productFormCard').classList.add('hidden');editingId=null;$('#pId').disabled=false;toast('Producto y stock guardados');}catch(e){console.error(e);toast('No se pudo guardar el producto');}
  };
  async function duplicate(id){const p=state.products.find(x=>x.id===id);if(!p)return;const copy={...structuredClone(p),id:`${p.id}-copia-${Date.now().toString().slice(-4)}`,name:`${p.name} copia`,stock:0,featured:false};try{const {error}=await sb.from('valto_products').insert(toDbProduct(copy));if(error)throw error;await loadCommerce();toast('Producto duplicado con stock 0');}catch(e){console.error(e);toast('No se pudo duplicar');}}
  async function remove(id){if(!confirm('¿Ocultar este producto de la tienda? El historial de ventas se conserva.'))return;try{const {error}=await sb.from('valto_products').update({visible:false,updated_at:new Date().toISOString()}).eq('id',id);if(error)throw error;await loadCommerce();toast('Producto ocultado');}catch(e){console.error(e);toast('No se pudo ocultar');}}

  async function loadOrders(){
    const {data,error}=await sb.from('valto_orders').select('id,status,payment_status,total,stock_committed,created_at,payment_id,valto_order_items(name_snapshot,variant,quantity)').order('created_at',{ascending:false}).limit(100);if(error){console.error(error);toast('No se pudieron cargar las ventas');return;}orders=data||[];renderOrders();
  }
  function renderOrders(){
    $('#orderRows').innerHTML=orders.length?orders.map(o=>{const item=o.valto_order_items?.[0];const product=item?`${esc(item.name_snapshot)}${item.variant?` · ${esc(item.variant)}`:''} ×${item.quantity}`:'—';const paid=o.payment_status==='approved'||o.status==='paid';const failed=['payment_failed','rejected','cancelled'].includes(o.status)||o.payment_status==='rejected';const cls=paid?'paid':failed?'failed':'pending';const label=paid?'Aprobado':failed?'Fallido':o.payment_status||'Pendiente';return `<tr><td>${new Date(o.created_at).toLocaleString('es-AR')}</td><td>${product}</td><td>${fmt(o.total)}</td><td><span class="order-status ${cls}">${esc(label)}</span></td><td>${o.stock_committed?'Descontado':'Pendiente'}</td><td style="font-size:11px">${esc(String(o.id).slice(0,8))}</td></tr>`;}).join(''):`<tr><td colspan="6">Todavía no hay ventas registradas.</td></tr>`;
  }
  $('#refreshOrders').onclick=loadOrders;

  $$('.admin-nav button').forEach(b=>b.onclick=()=>{$$('.admin-nav button').forEach(x=>x.classList.remove('active'));b.classList.add('active');$$('[data-panel]').forEach(p=>p.classList.add('hidden'));$(`[data-panel="${b.dataset.tab}"]`).classList.remove('hidden');if(b.dataset.tab==='orders')loadOrders();});
  $('#exportData').onclick=()=>{const blob=new Blob([JSON.stringify({settings:state.settings,categories:state.categories,products:state.products,orders},null,2)],{type:'application/json'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='valto-mates-backup.json';a.click();URL.revokeObjectURL(a.href)};

  async function afterLogin(){
    $('#adminLogin').classList.add('hidden'); $('#modePill').textContent='● Supabase conectado'; $('#modePill').className='status-pill';
    fillGeneral();fillIconOptions();resetCategoryForm();await loadCommerce();await loadOrders();
  }
  $('#loginBtn').onclick=async()=>{const email=$('#loginEmail').value.trim(),password=$('#loginPassword').value;$('#loginError').textContent='';const {error}=await sb.auth.signInWithPassword({email,password});if(error){$('#loginError').textContent='No se pudo iniciar sesión. Revisá email y contraseña.';return;}await afterLogin();};
  $('#loginPassword').addEventListener('keydown',e=>{if(e.key==='Enter')$('#loginBtn').click()});
  $('#logoutBtn').onclick=async()=>{await sb.auth.signOut();location.reload();};

  (async()=>{const {data}=await sb.auth.getSession();if(data.session)await afterLogin();else{$('#modePill').textContent='● Login requerido';$('#adminLogin').classList.remove('hidden');}})();
})();
