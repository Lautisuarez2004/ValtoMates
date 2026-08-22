(() => {
  const defaults = window.VALTO_DEFAULTS;
  const iconList = window.VALTO_CATEGORY_ICONS || [];
  const iconMap = window.VALTO_ICON_MAP || {};
  let state = normalizeState(JSON.parse(localStorage.getItem('valto_store_data') || 'null') || structuredClone(defaults));
  let editingId = null;
  let editingCategoryId = null;

  const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
  const esc=(s='')=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const fmt=n=>new Intl.NumberFormat('es-AR',{style:'currency',currency:'ARS',maximumFractionDigits:0}).format(Number(n||0));
  const slug=s=>String(s||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/(^-|-$)/g,'');
  const save=()=>localStorage.setItem('valto_store_data',JSON.stringify(state));
  const toast=msg=>{const t=$('#toast');t.textContent=msg;t.classList.add('show');setTimeout(()=>t.classList.remove('show'),2200)};

  function normalizeState(raw){
    const next = raw && typeof raw === 'object' ? raw : structuredClone(defaults);
    next.settings = {...structuredClone(defaults.settings), ...(next.settings || {})};
    next.products = Array.isArray(next.products) ? next.products : structuredClone(defaults.products);
    if(!Array.isArray(next.categories) || !next.categories.length){
      const defaultByName = Object.fromEntries((defaults.categories || []).map(c => [c.name,c]));
      const seen = new Set();
      next.categories = [];
      next.products.forEach(p => {
        if(!p.category || seen.has(p.category)) return;
        seen.add(p.category);
        next.categories.push(defaultByName[p.category] ? structuredClone(defaultByName[p.category]) : {id:slug(p.category),name:p.category,icon:'tag'});
      });
      if(!next.categories.length) next.categories=structuredClone(defaults.categories||[]);
    }
    return next;
  }

  function iconSvg(id){return (iconMap[id] || iconMap.tag || {svg:''}).svg}

  function fillGeneral(){
    for(const k of ['announcement','heroEyebrow','heroTitle','heroText','heroCta','heroSecondary','accent','accentDark','background','comboTitle','comboText']) if($('#'+k)) $('#'+k).value=state.settings[k]||'';
  }
  $('#saveGeneral').onclick=()=>{
    for(const k of ['announcement','heroEyebrow','heroTitle','heroText','heroCta','heroSecondary','accent','accentDark','background','comboTitle','comboText']) state.settings[k]=$('#'+k).value;
    save();toast('Cambios guardados');
  };

  function fillIconOptions(){
    $('#cIcon').innerHTML=iconList.map(i=>`<option value="${esc(i.id)}">${esc(i.label)}</option>`).join('');
    if(!$('#cIcon').value && iconList[0]) $('#cIcon').value=iconList[0].id;
    updateIconPreview();
  }
  function updateIconPreview(){
    const item=iconMap[$('#cIcon').value] || iconMap.tag;
    $('#cIconPreview').innerHTML=item?`${item.svg}<span>${esc(item.label)}</span>`:'';
  }
  $('#cIcon').addEventListener('change',updateIconPreview);

  function categoryRows(){
    $('#categoryRows').innerHTML=state.categories.map(c=>{
      const count=state.products.filter(p=>p.category===c.name).length;
      return `<tr><td><div class="admin-category-icon">${iconSvg(c.icon)}</div></td><td><b>${esc(c.name)}</b></td><td>${count}</td><td><div class="table-actions"><button class="small-btn" data-cedit="${esc(c.id)}">Editar</button><button class="small-btn danger" data-cdel="${esc(c.id)}">Eliminar</button></div></td></tr>`;
    }).join('');
    $$('[data-cedit]').forEach(b=>b.onclick=()=>openCategoryForm(b.dataset.cedit));
    $$('[data-cdel]').forEach(b=>b.onclick=()=>removeCategory(b.dataset.cdel));
    fillProductCategoryOptions();
  }

  function resetCategoryForm(){
    editingCategoryId=null;
    $('#categoryFormTitle').textContent='Nueva categoría';
    $('#saveCategory').textContent='Agregar categoría';
    $('#cancelCategory').classList.add('hidden');
    $('#cName').value='';
    $('#cIcon').value=iconList.some(i=>i.id==='tag')?'tag':(iconList[0]?.id||'');
    updateIconPreview();
  }
  function openCategoryForm(id){
    const c=state.categories.find(x=>x.id===id); if(!c)return;
    editingCategoryId=id;
    $('#categoryFormTitle').textContent='Editar categoría';
    $('#saveCategory').textContent='Guardar categoría';
    $('#cancelCategory').classList.remove('hidden');
    $('#cName').value=c.name;
    $('#cIcon').value=iconMap[c.icon]?c.icon:'tag';
    updateIconPreview();
    $('#cName').focus();
  }
  $('#cancelCategory').onclick=resetCategoryForm;
  $('#saveCategory').onclick=()=>{
    const name=$('#cName').value.trim();
    const icon=$('#cIcon').value || 'tag';
    if(!name){toast('Escribí un nombre para la categoría');return}
    const duplicate=state.categories.find(c=>c.name.toLowerCase()===name.toLowerCase() && c.id!==editingCategoryId);
    if(duplicate){toast('Ya existe una categoría con ese nombre');return}
    if(editingCategoryId){
      const c=state.categories.find(x=>x.id===editingCategoryId); if(!c)return;
      const oldName=c.name;
      c.name=name;c.icon=icon;
      state.products.forEach(p=>{if(p.category===oldName)p.category=name});
      toast('Categoría actualizada');
    }else{
      let id=slug(name)||`categoria-${Date.now()}`;
      if(state.categories.some(c=>c.id===id)) id=`${id}-${Date.now().toString().slice(-4)}`;
      state.categories.push({id,name,icon});
      toast('Categoría agregada');
    }
    save();categoryRows();rows();resetCategoryForm();
  };
  function removeCategory(id){
    const c=state.categories.find(x=>x.id===id); if(!c)return;
    const assigned=state.products.filter(p=>p.category===c.name);
    const suffix=assigned.length?`\n\n${assigned.length} producto${assigned.length===1?'':'s'} pasarán a “Sin categoría”.`:'';
    if(!confirm(`¿Eliminar la categoría “${c.name}”?${suffix}`))return;
    state.categories=state.categories.filter(x=>x.id!==id);
    if(assigned.length){
      let fallback=state.categories.find(x=>x.name==='Sin categoría');
      if(!fallback){fallback={id:'sin-categoria',name:'Sin categoría',icon:'tag'};state.categories.push(fallback)}
      assigned.forEach(p=>p.category=fallback.name);
    }
    save();categoryRows();rows();resetCategoryForm();toast('Categoría eliminada');
  }

  function fillProductCategoryOptions(selected=''){
    const sel=$('#pCategory'); if(!sel)return;
    sel.innerHTML=state.categories.map(c=>`<option value="${esc(c.name)}">${esc(c.name)}</option>`).join('');
    if(selected && state.categories.some(c=>c.name===selected)) sel.value=selected;
    else if(state.categories[0]) sel.value=state.categories[0].name;
  }

  function rows(){
    $('#productRows').innerHTML=state.products.map(p=>`<tr><td><img class="thumb" src="${esc(p.image)}" alt=""></td><td><b>${esc(p.name)}</b></td><td>${esc(p.category)}</td><td>${fmt(p.price)}</td><td>${p.featured?'Sí':'—'}</td><td><div class="table-actions"><button class="small-btn" data-edit="${esc(p.id)}">Editar</button><button class="small-btn" data-dup="${esc(p.id)}">Duplicar</button><button class="small-btn danger" data-del="${esc(p.id)}">Eliminar</button></div></td></tr>`).join('');
    $$('[data-edit]').forEach(b=>b.onclick=()=>openForm(b.dataset.edit));
    $$('[data-dup]').forEach(b=>b.onclick=()=>duplicate(b.dataset.dup));
    $$('[data-del]').forEach(b=>b.onclick=()=>remove(b.dataset.del));
  }

  function openForm(id=null){
    editingId=id;
    const defaultCategory=state.categories[0]?.name || 'Sin categoría';
    const p=id?state.products.find(x=>x.id===id):{id:'',name:'',category:defaultCategory,badge:'',price:'',transferPrice:'',cashPrice:'',image:'assets/img/',description:'',variants:'',featured:false};
    if(!p)return;
    $('#productFormCard').classList.remove('hidden');
    $('#productFormTitle').textContent=id?'Editar producto':'Nuevo producto';
    $('#pName').value=p.name;$('#pId').value=p.id;fillProductCategoryOptions(p.category);$('#pBadge').value=p.badge||'';$('#pPrice').value=p.price;$('#pTransfer').value=p.transferPrice||'';$('#pCash').value=p.cashPrice||'';$('#pImage').value=p.image;$('#pDescription').value=p.description||'';$('#pVariants').value=p.variants||'';$('#pFeatured').checked=!!p.featured;
    $('#productFormCard').scrollIntoView({behavior:'smooth'});
  }
  $('#newProduct').onclick=()=>openForm();
  $('#cancelProduct').onclick=()=>{$('#productFormCard').classList.add('hidden');editingId=null};
  $('#pName').addEventListener('input',()=>{if(!editingId) $('#pId').value=slug($('#pName').value)});
  $('#saveProduct').onclick=()=>{
    const category=$('#pCategory').value || state.categories[0]?.name || 'Sin categoría';
    const p={id:$('#pId').value.trim()||slug($('#pName').value),name:$('#pName').value.trim(),category,badge:$('#pBadge').value.trim(),price:Number($('#pPrice').value||0),transferPrice:Number($('#pTransfer').value||0),cashPrice:Number($('#pCash').value||0),image:$('#pImage').value.trim(),description:$('#pDescription').value.trim(),variants:$('#pVariants').value.trim(),featured:$('#pFeatured').checked};
    if(!p.name||!p.id){toast('Completá nombre e ID');return}
    if(editingId){const idx=state.products.findIndex(x=>x.id===editingId);state.products[idx]=p}else state.products.unshift(p);
    save();rows();categoryRows();$('#productFormCard').classList.add('hidden');editingId=null;toast('Producto guardado');
  };
  function duplicate(id){const p=state.products.find(x=>x.id===id);if(!p)return;const copy={...structuredClone(p),id:`${p.id}-copia-${Date.now().toString().slice(-4)}`,name:`${p.name} copia`};state.products.unshift(copy);save();rows();categoryRows();toast('Producto duplicado')}
  function remove(id){if(!confirm('¿Eliminar este producto?'))return;state.products=state.products.filter(x=>x.id!==id);save();rows();categoryRows();toast('Producto eliminado')}

  $$('.admin-nav button').forEach(b=>b.onclick=()=>{
    $$('.admin-nav button').forEach(x=>x.classList.remove('active'));
    b.classList.add('active');
    $$('[data-panel]').forEach(p=>p.classList.add('hidden'));
    $(`[data-panel="${b.dataset.tab}"]`).classList.remove('hidden');
  });

  $('#exportData').onclick=()=>{const blob=new Blob([JSON.stringify(state,null,2)],{type:'application/json'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='valto-mates-datos.json';a.click();URL.revokeObjectURL(a.href)};
  $('#importFile').onchange=async e=>{const f=e.target.files[0];if(!f)return;try{const data=JSON.parse(await f.text());if(!data.settings||!Array.isArray(data.products))throw new Error();state=normalizeState(data);save();fillGeneral();categoryRows();rows();resetCategoryForm();toast('Datos importados')}catch{toast('JSON inválido')}};
  $('#resetData').onclick=()=>{if(!confirm('¿Restaurar los datos de demostración?'))return;state=normalizeState(structuredClone(defaults));save();fillGeneral();categoryRows();rows();resetCategoryForm();toast('Demo restaurada')};

  fillGeneral();fillIconOptions();categoryRows();rows();resetCategoryForm();
})();
