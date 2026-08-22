(() => {
  const defaults = window.VALTO_DEFAULTS;
  const config = window.VALTO_CONFIG || {};
  const iconMap = window.VALTO_ICON_MAP || {};
  const local = JSON.parse(localStorage.getItem('valto_store_data') || 'null');
  let state = normalizeState({
    settings: {...structuredClone(defaults.settings), ...(local?.settings || {})},
    products: structuredClone(defaults.products || []),
    categories: structuredClone(defaults.categories || [])
  });
  let activeCategory = 'Todos';
  let query = '';
  let sort = 'featured';
  let page = 1;
  let currentModalProductId = '';
  let initialized = false;
  let commerceSignature = '';
  const pageSize = 8;

  const $ = (s) => document.querySelector(s);
  const $$ = (s) => [...document.querySelectorAll(s)];
  const fmt = (n) => new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(Number(n || 0));
  const esc = (s='') => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot',"'":'&#39;'}[c]));
  const slug = (s='') => String(s).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/(^-|-$)/g,'');

  function normalizeState(raw){
    const next = raw && typeof raw === 'object' ? raw : structuredClone(defaults);
    next.settings = {...structuredClone(defaults.settings), ...(next.settings || {})};
    next.products = Array.isArray(next.products) ? next.products.map(p => ({...p, stock: Number.isFinite(Number(p.stock)) ? Number(p.stock) : 0, variantLabel: p.variantLabel || 'Color'})) : [];
    if(!Array.isArray(next.categories) || !next.categories.length){
      const seen = new Set(); const inferred = [];
      const defaultByName = Object.fromEntries((defaults.categories || []).map(c => [c.name,c]));
      next.products.forEach(p => {
        if(!p.category || seen.has(p.category)) return;
        seen.add(p.category); const known = defaultByName[p.category];
        inferred.push(known ? structuredClone(known) : {id:slug(p.category),name:p.category,icon:'tag'});
      });
      next.categories = inferred.length ? inferred : structuredClone(defaults.categories || []);
    }
    return next;
  }

  function iconSvg(id){ return (iconMap[id] || iconMap.tag || {svg:''}).svg; }

  async function loadRemoteCommerce({silent=false} = {}){
    if(!config.supabaseUrl || !config.supabaseAnonKey) return false;
    const headers = { apikey: config.supabaseAnonKey };
    try{
      const [cr, pr] = await Promise.all([
        fetch(`${config.supabaseUrl}/rest/v1/valto_categories?select=id,name,icon,sort_order&visible=eq.true&order=sort_order.asc`, {headers, cache:'no-store'}),
        fetch(`${config.supabaseUrl}/rest/v1/valto_products?select=id,name,category,price,transfer_price,cash_price,stock,image,badge,featured,description,variants,variant_label,visible&visible=eq.true&order=featured.desc,created_at.asc`, {headers, cache:'no-store'})
      ]);
      if(!cr.ok || !pr.ok) throw new Error('No se pudo cargar el catálogo');
      const categories = await cr.json();
      const products = await pr.json();
      const nextCategories = categories.map(c => ({id:c.id,name:c.name,icon:c.icon||'tag'}));
      const nextProducts = products.map(p => ({
        id:p.id,name:p.name,category:p.category,price:Number(p.price||0),transferPrice:Number(p.transfer_price||0),cashPrice:Number(p.cash_price||0),
        stock:Number(p.stock||0),image:p.image||'',badge:p.badge||'',featured:!!p.featured,description:p.description||'',
        variants:Array.isArray(p.variants)?p.variants.join(' · '):'',variantLabel:String(p.variant_label||'Color').trim()||'Color'
      }));
      const nextSignature = JSON.stringify({
        c: nextCategories.map(c=>[c.id,c.name,c.icon]),
        p: nextProducts.map(p=>[p.id,p.name,p.category,p.price,p.transferPrice,p.cashPrice,p.stock,p.image,p.badge,p.featured,p.description,p.variants,p.variantLabel])
      });
      const changed = nextSignature !== commerceSignature;
      commerceSignature = nextSignature;
      state.categories = nextCategories;
      state.products = nextProducts;
      window.VALTO_RUNTIME_STATE = state;

      if(changed && initialized){
        renderCategories();
        renderProducts();
        if(currentModalProductId && $('#productModal')?.classList.contains('open')) openProduct(currentModalProductId, true);
        window.dispatchEvent(new CustomEvent('valto:commerce-updated', {detail:{products:state.products}}));
      }
      return changed;
    }catch(e){
      console.error(e);
      window.VALTO_RUNTIME_STATE = state;
      if(!silent) toast('No se pudo actualizar el stock. Reintentá en unos segundos.');
      return false;
    }
  }

  function applyTheme(){
    const s = state.settings;
    document.documentElement.style.setProperty('--accent', s.accent || '#4a4b37');
    document.documentElement.style.setProperty('--accent-dark', s.accentDark || '#292b23');
    document.documentElement.style.setProperty('--bg', s.background || '#f6f2e8');
    $('#heroEyebrow').textContent = s.heroEyebrow; $('#heroTitle').textContent = s.heroTitle; $('#heroText').textContent = s.heroText;
    $('#heroCta').textContent = s.heroCta; $('#heroSecondary').textContent = s.heroSecondary; $('#comboTitle').textContent = s.comboTitle; $('#comboText').textContent = s.comboText;
    const msg = ` ${s.announcement} `;
    $('#announcementTrack').innerHTML = `<span>${esc(msg)}</span><span>✦</span><span>${esc(msg)}</span><span>✦</span><span>${esc(msg)}</span><span>✦</span><span>${esc(msg)}</span>`;
    if(config.email) $('#mailBtn').href = `mailto:${config.email}`;
  }

  function renderCategories(){
    const allCard = `<button class="category-card ${activeCategory==='Todos'?'active':''}" data-category="Todos"><div class="category-icon">${iconSvg('sparkles')}</div><span>Todos</span></button>`;
    const cards = state.categories.map(c => `<button class="category-card ${activeCategory===c.name?'active':''}" data-category="${esc(c.name)}"><div class="category-icon">${iconSvg(c.icon)}</div><span>${esc(c.name)}</span></button>`).join('');
    $('#categoryList').innerHTML = allCard + cards;
    $$('#categoryList .category-card').forEach(btn => btn.onclick = () => { activeCategory=btn.dataset.category; page=1; renderCategories(); renderProducts(); document.querySelector('#productos').scrollIntoView({behavior:'smooth'}); });
  }

  function filteredProducts(){
    let arr = state.products.filter(p => (activeCategory === 'Todos' || p.category === activeCategory) && (!query || `${p.name} ${p.category}`.toLowerCase().includes(query.toLowerCase())));
    arr = [...arr].sort((a,b) => { if(sort==='price-asc') return a.price-b.price; if(sort==='price-desc') return b.price-a.price; if(sort==='name') return a.name.localeCompare(b.name,'es'); return Number(b.featured)-Number(a.featured); });
    return arr;
  }

  function productCard(p){
    const badge = p.stock <= 0 ? 'Sin stock' : p.badge;
    return `<article class="product-card">
      <div class="product-image-wrap" data-open="${esc(p.id)}">${badge?`<span class="badge">${esc(badge)}</span>`:''}<img src="${esc(p.image)}" alt="${esc(p.name)}" loading="lazy"></div>
      <div class="product-body"><div class="product-category">${esc(p.category)}</div><h3 class="product-name">${esc(p.name)}</h3>
      <div class="price-row"><div class="price">${fmt(p.price)}</div>${p.cashPrice?`<div class="cash-price">Efectivo ${fmt(p.cashPrice)}</div>`:''}</div>
      <div style="font-size:12px;margin:7px 0;color:${p.stock<=0?'#9b2c2c':'var(--muted)'}">${p.stock<=0?'Sin stock':`Stock disponible: ${p.stock}`}</div>
      <div class="product-actions"><button class="btn btn-dark" data-open="${esc(p.id)}">Ver producto</button><button class="wa-mini" data-wa="${esc(p.id)}" aria-label="Consultar por WhatsApp">◉</button></div></div>
    </article>`;
  }

  function renderProducts(){
    if(activeCategory !== 'Todos' && !state.categories.some(c => c.name === activeCategory)) activeCategory = 'Todos';
    const arr = filteredProducts(); const maxPage = Math.max(1,Math.ceil(arr.length/pageSize)); if(page>maxPage) page=maxPage;
    const items = arr.slice((page-1)*pageSize,page*pageSize);
    $('#productCount').textContent = `${arr.length} producto${arr.length===1?'':'s'}${activeCategory!=='Todos'?` en ${activeCategory}`:''}`;
    $('#productGrid').innerHTML = items.length ? items.map(productCard).join('') : `<div class="empty-state">No encontramos productos con ese filtro.</div>`;
    $('#pagination').innerHTML = maxPage>1 ? Array.from({length:maxPage},(_,i)=>`<button class="page-btn ${page===i+1?'active':''}" data-page="${i+1}">${i+1}</button>`).join('') : '';
    $$('[data-open]').forEach(el => el.onclick = () => openProduct(el.dataset.open));
    $$('[data-wa]').forEach(el => el.onclick = (e) => { e.stopPropagation(); const p=state.products.find(x=>x.id===el.dataset.wa); wa(`Hola! Quería consultar por ${p.name} (${fmt(p.price)}).`); });
    $$('#pagination .page-btn').forEach(el => el.onclick = () => {page=Number(el.dataset.page);renderProducts();$('#productos').scrollIntoView({behavior:'smooth'});});
  }

  function openProduct(id, refresh=false){
    const p = state.products.find(x => x.id === id); if(!p) return;
    currentModalProductId = id;
    $('#modalInner').innerHTML = `<div class="product-modal-grid"><div class="modal-image"><img src="${esc(p.image)}" alt="${esc(p.name)}"></div><div class="modal-content"><div class="product-category">${esc(p.category)}</div><h2>${esc(p.name)}</h2><p class="modal-description">${esc(p.description || '')}</p><div class="modal-price">${fmt(p.price)}</div><div style="font-size:13px;font-weight:700;margin:8px 0;color:${p.stock<=0?'#9b2c2c':'var(--accent-dark)'}">${p.stock<=0?'Sin stock disponible':`Stock disponible: ${p.stock}`}</div><div class="price-options">${p.transferPrice?`<div class="price-option"><span>Transferencia</span><b>${fmt(p.transferPrice)}</b></div>`:''}${p.cashPrice?`<div class="price-option"><span>Efectivo</span><b>${fmt(p.cashPrice)}</b></div>`:''}</div><button class="btn btn-dark" style="width:100%" id="modalWa">Consultar por WhatsApp</button></div></div>`;
    $('#modalWa').onclick = () => wa(`Hola! Quería consultar por ${p.name} (${fmt(p.price)}).`);
    if(!refresh){ $('#productModal').classList.add('open'); document.body.style.overflow='hidden'; }
  }
  function closeProduct(){ currentModalProductId=''; $('#productModal').classList.remove('open'); document.body.style.overflow=''; }
  function toast(msg){const t=$('#toast');if(!t)return;t.textContent=msg;t.classList.add('show');setTimeout(()=>t.classList.remove('show'),2600)}
  function wa(message='Hola! Quería hacer una consulta en Valto Mates.'){
    const num = (config.whatsappNumber || '').replace(/\D/g,''); if(!num){toast('Falta cargar el número de WhatsApp en config.js');return;} window.open(`https://wa.me/${num}?text=${encodeURIComponent(message)}`,'_blank','noopener');
  }

  $('#searchInput').addEventListener('input', e => {query=e.target.value;page=1;renderProducts()});
  $('#sortSelect').addEventListener('change', e => {sort=e.target.value;page=1;renderProducts()});
  $('#focusSearch').onclick = () => {document.querySelector('#productos').scrollIntoView({behavior:'smooth'});setTimeout(()=>$('#searchInput').focus(),500)};
  $('#menuBtn').onclick = () => $('#drawerBackdrop').classList.add('open'); $('#closeDrawer').onclick = () => $('#drawerBackdrop').classList.remove('open');
  $('#drawerBackdrop').onclick = e => {if(e.target === $('#drawerBackdrop')) $('#drawerBackdrop').classList.remove('open')}; $$('.drawer-nav a').forEach(a => a.onclick = () => $('#drawerBackdrop').classList.remove('open'));
  $('#closeModal').onclick = closeProduct; $('#productModal').onclick = e => {if(e.target === $('#productModal')) closeProduct()};
  document.addEventListener('keydown', e => {if(e.key==='Escape'){closeProduct();$('#drawerBackdrop').classList.remove('open')}});
  ['#floatingWa','#headerWa','#footerWa','#comboWa'].forEach(sel => $(sel).onclick = () => wa(sel==='#comboWa'?'Hola! Quiero armar un combo matero.':'Hola! Quería hacer una consulta en Valto Mates.'));
  $('#heroSecondary').onclick = (e) => {e.preventDefault();activeCategory='Todos';sort='featured';renderCategories();renderProducts();document.querySelector('#productos').scrollIntoView({behavior:'smooth'});};

  window.addEventListener('storage', e => { if(e.key==='valto_store_data'){ try{ const updated=JSON.parse(e.newValue||'null'); if(updated?.settings){state.settings={...state.settings,...updated.settings};applyTheme();} }catch{} } });
  window.addEventListener('focus', () => loadRemoteCommerce({silent:true}));
  document.addEventListener('visibilitychange', () => { if(!document.hidden) loadRemoteCommerce({silent:true}); });

  async function init(){
    applyTheme();
    await loadRemoteCommerce();
    window.VALTO_RUNTIME_STATE = state;
    renderCategories(); renderProducts();
    initialized = true;
    setInterval(() => loadRemoteCommerce({silent:true}), 4000);
  }
  init();
})();