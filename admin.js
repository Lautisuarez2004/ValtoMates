(() => {
  const defaults = window.VALTO_DEFAULTS;
  let state = JSON.parse(localStorage.getItem('valto_store_data') || 'null') || structuredClone(defaults);
  let editingId = null;
  const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
  const save=()=>localStorage.setItem('valto_store_data',JSON.stringify(state));
  const toast=msg=>{const t=$('#toast');t.textContent=msg;t.classList.add('show');setTimeout(()=>t.classList.remove('show'),2200)};
  const fmt=n=>new Intl.NumberFormat('es-AR',{style:'currency',currency:'ARS',maximumFractionDigits:0}).format(Number(n||0));

  function fillGeneral(){for(const k of ['announcement','heroEyebrow','heroTitle','heroText','heroCta','heroSecondary','accent','accentDark','background','comboTitle','comboText']) if($('#'+k)) $('#'+k).value=state.settings[k]||'';}
  $('#saveGeneral').onclick=()=>{for(const k of ['announcement','heroEyebrow','heroTitle','heroText','heroCta','heroSecondary','accent','accentDark','background','comboTitle','comboText']) state.settings[k]=$('#'+k).value;save();toast('Cambios guardados');};

  function rows(){
    $('#productRows').innerHTML=state.products.map(p=>`<tr><td><img class="thumb" src="${p.image}" alt=""></td><td><b>${p.name}</b></td><td>${p.category}</td><td>${fmt(p.price)}</td><td>${p.featured?'Sí':'—'}</td><td><div class="table-actions"><button class="small-btn" data-edit="${p.id}">Editar</button><button class="small-btn" data-dup="${p.id}">Duplicar</button><button class="small-btn danger" data-del="${p.id}">Eliminar</button></div></td></tr>`).join('');
    $$('[data-edit]').forEach(b=>b.onclick=()=>openForm(b.dataset.edit));
    $$('[data-dup]').forEach(b=>b.onclick=()=>duplicate(b.dataset.dup));
    $$('[data-del]').forEach(b=>b.onclick=()=>remove(b.dataset.del));
  }
  function slug(s){return s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/(^-|-$)/g,'')}
  function openForm(id=null){editingId=id;const p=id?state.products.find(x=>x.id===id):{id:'',name:'',category:'Mates',badge:'',price:'',transferPrice:'',cashPrice:'',image:'assets/img/',description:'',variants:'',featured:false};$('#productFormCard').classList.remove('hidden');$('#productFormTitle').textContent=id?'Editar producto':'Nuevo producto';$('#pName').value=p.name;$('#pId').value=p.id;$('#pCategory').value=p.category;$('#pBadge').value=p.badge;$('#pPrice').value=p.price;$('#pTransfer').value=p.transferPrice||'';$('#pCash').value=p.cashPrice||'';$('#pImage').value=p.image;$('#pDescription').value=p.description||'';$('#pVariants').value=p.variants||'';$('#pFeatured').checked=!!p.featured;$('#productFormCard').scrollIntoView({behavior:'smooth'});}
  $('#newProduct').onclick=()=>openForm();$('#cancelProduct').onclick=()=>{$('#productFormCard').classList.add('hidden');editingId=null};
  $('#pName').addEventListener('input',()=>{if(!editingId) $('#pId').value=slug($('#pName').value)});
  $('#saveProduct').onclick=()=>{const p={id:$('#pId').value.trim()||slug($('#pName').value),name:$('#pName').value.trim(),category:$('#pCategory').value.trim()||'Otros',badge:$('#pBadge').value.trim(),price:Number($('#pPrice').value||0),transferPrice:Number($('#pTransfer').value||0),cashPrice:Number($('#pCash').value||0),image:$('#pImage').value.trim(),description:$('#pDescription').value.trim(),variants:$('#pVariants').value.trim(),featured:$('#pFeatured').checked};if(!p.name||!p.id){toast('Completá nombre e ID');return}if(editingId){const idx=state.products.findIndex(x=>x.id===editingId);state.products[idx]=p}else state.products.unshift(p);save();rows();$('#productFormCard').classList.add('hidden');editingId=null;toast('Producto guardado')};
  function duplicate(id){const p=state.products.find(x=>x.id===id);const copy={...structuredClone(p),id:`${p.id}-copia-${Date.now().toString().slice(-4)}`,name:`${p.name} copia`};state.products.unshift(copy);save();rows();toast('Producto duplicado')}
  function remove(id){if(!confirm('¿Eliminar este producto?'))return;state.products=state.products.filter(x=>x.id!==id);save();rows();toast('Producto eliminado')}

  $$('.admin-nav button').forEach(b=>b.onclick=()=>{$$('.admin-nav button').forEach(x=>x.classList.remove('active'));b.classList.add('active');$$('[data-panel]').forEach(p=>p.classList.add('hidden'));$(`[data-panel="${b.dataset.tab}"]`).classList.remove('hidden')});
  $('#exportData').onclick=()=>{const blob=new Blob([JSON.stringify(state,null,2)],{type:'application/json'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='valto-mates-datos.json';a.click();URL.revokeObjectURL(a.href)};
  $('#importFile').onchange=async e=>{const f=e.target.files[0];if(!f)return;try{const data=JSON.parse(await f.text());if(!data.settings||!Array.isArray(data.products))throw new Error();state=data;save();fillGeneral();rows();toast('Datos importados')}catch{toast('JSON inválido')}};
  $('#resetData').onclick=()=>{if(!confirm('¿Restaurar los datos de demostración?'))return;state=structuredClone(defaults);save();fillGeneral();rows();toast('Demo restaurada')};
  fillGeneral();rows();
})();
