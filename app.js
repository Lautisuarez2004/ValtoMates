(() => {
  const defaults = window.VALTO_DEFAULTS;
  const config = window.VALTO_CONFIG || {};
  const iconMap = window.VALTO_ICON_MAP || {};
  let state = normalizeState(JSON.parse(localStorage.getItem('valto_store_data') || 'null') || structuredClone(defaults));
  let activeCategory = 'Todos';
  let query = '';
  let sort = 'featured';
  let page = 1;
  const pageSize = 8;

  const $ = (s) => document.querySelector(s);
  const $$ = (s) => [...document.querySelectorAll(s)];
  const fmt = (n) => new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(Number(n || 0));
  const esc = (s='') => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const slug = (s='') => String(s).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/(^-|-$)/g,'');

  function normalizeState(raw){
    const next = raw && typeof raw === 'object' ? raw : structuredClone(defaults);
    next.settings = {...structuredClone(defaults.settings), ...(next.settings || {})};
    next.products = Array.isArray(next.products) ? next.products : structuredClone(defaults.products);
    if(!Array.isArray(next.categories) || !next.categories.length){
      const seen = new Set();
      const inferred = [];
      const defaultByName = Object.fromEntries((defaults.categories || []).map(c => [c.name,c]));
      next.products.forEach(p => {
        if(!p.category || seen.has(p.category)) return;
        seen.add(p.category);
        const known = defaultByName[p.category];
        inferred.push(known ? structuredClone(known) : {id:slug(p.category),name:p.category,icon:'tag'});
      });
      next.categories = inferred.length ? inferred : structuredClone(defaults.categories || []);
    }
    return next;
  }

  function iconSvg(id){
    return (iconMap[id] || iconMap.tag || {svg:''}).svg;
  }

  function applyTheme(){
    const s = state.settings;
    document.documentElement.style.setProperty('--accent', s.accent || '#4a4b37');
    document.documentElement.style.setProperty('--accent-dark', s.accentDark || '#292b23');
    document.documentElement.style.setProperty('--bg', s.background || '#f6f2e8');
    $('#heroEyebrow').textContent = s.heroEyebrow;
    $('#heroTitle').textContent = s.heroTitle;
    $('#heroText').textContent = s.heroText;
    $('#heroCta').textContent = s.heroCta;
    $('#heroSecondary').textContent = s.heroSecondary;
    $('#comboTitle').textContent = s.comboTitle;
    $('#comboText').textContent = s.comboText;
    const msg = ` ${s.announcement} `;
    $('#announcementTrack').innerHTML = `<span>${esc(msg)}</span><span>✦</span><span>${esc(msg)}</span><span>✦</span><span>${esc(msg)}</span><span>✦</span><span>${esc(msg)}</span>`;
    if(config.email) $('#mailBtn').href = `mailto:${config.email}`;
  }

  function renderCategories(){
    const allCard = `<button class="category-card ${activeCategory==='Todos'?'active':''}" data-category="Todos"><div class="category-icon">${iconSvg('sparkles')}</div><span>Todos</span></button>`;
    const cards = state.categories.map(c => `<button class="category-card ${activeCategory===c.name?'active':''}" data-category="${esc(c.name)}"><div class="category-icon">${iconSvg(c.icon)}</div><span>${esc(c.name)}</span></button>`).join('');
    $('#categoryList').innerHTML = allCard + cards;
    $$('#categoryList .category-card').forEach(btn => btn.onclick = () => {
      activeCategory = btn.dataset.category;
      page = 1;
      renderCategories();
      renderProducts();
      document.querySelector('#productos').scrollIntoView({behavior:'smooth'});
    });
  }

  function filteredProducts(){
    let arr = state.products.filter(p => (activeCategory === 'Todos' || p.category === activeCategory) && (!query || `${p.name} ${p.category}`.toLowerCase().includes(query.toLowerCase())));
    arr = [...arr].sort((a,b) => {
      if(sort==='price-asc') return a.price-b.price;
      if(sort==='price-desc') return b.price-a.price;
      if(sort==='name') return a.name.localeCompare(b.name,'es');
      return Number(b.featured)-Number(a.featured);
    });
    return arr;
  }

  function productCard(p){
    return `<article class="product-card">
      <div class="product-image-wrap" data-open="${esc(p.id)}">${p.badge?`<span class="badge">${esc(p.badge)}</span>`:''}<img src="${esc(p.image)}" alt="${esc(p.name)}" loading="lazy"></div>
      <div class="product-body"><div class="product-category">${esc(p.category)}</div><h3 class="product-name">${esc(p.name)}</h3>
      <div class="price-row"><div class="price">${fmt(p.price)}</div>${p.cashPrice?`<div class="cash-price">Efectivo ${fmt(p.cashPrice)}</div>`:''}</div>
      <div class="product-actions"><button class="btn btn-dark" data-open="${esc(p.id)}">Ver producto</button><button class="wa-mini" data-wa="${esc(p.id)}" aria-label="Consultar por WhatsApp">◉</button></div></div>
    </article>`;
  }

  function renderProducts(){
    if(activeCategory !== 'Todos' && !state.categories.some(c => c.name === activeCategory)) activeCategory = 'Todos';
    const arr = filteredProducts();
    const maxPage = Math.max(1,Math.ceil(arr.length/pageSize));
    if(page>maxPage) page=maxPage;
    const items = arr.slice((page-1)*pageSize,page*pageSize);
    $('#productCount').textContent = `${arr.length} producto${arr.length===1?'':'s'}${activeCategory!=='Todos'?` en ${activeCategory}`:''}`;
    $('#productGrid').innerHTML = items.length ? items.map(productCard).join('') : `<div class="empty-state">No encontramos productos con ese filtro.</div>`;
    $('#pagination').innerHTML = maxPage>1 ? Array.from({length:maxPage},(_,i)=>`<button class="page-btn ${page===i+1?'active':''}" data-page="${i+1}">${i+1}</button>`).join('') : '';
    $$('[data-open]').forEach(el => el.onclick = () => openProduct(el.dataset.open));
    $$('[data-wa]').forEach(el => el.onclick = (e) => { e.stopPropagation(); const p=state.products.find(x=>x.id===el.dataset.wa); wa(`Hola! Quería consultar por ${p.name} (${fmt(p.price)}).`); });
    $$('#pagination .page-btn').forEach(el => el.onclick = () => {page=Number(el.dataset.page);renderProducts();$('#productos').scrollIntoView({behavior:'smooth'});});
  }

  function openProduct(id){
    const p = state.products.find(x => x.id === id); if(!p) return;
    $('#modalInner').innerHTML = `<div class="product-modal-grid"><div class="modal-image"><img src="${esc(p.image)}" alt="${esc(p.name)}"></div><div class="modal-content"><div class="product-category">${esc(p.category)}</div><h2>${esc(p.name)}</h2><p class="modal-description">${esc(p.description || '')}</p><div class="modal-price">${fmt(p.price)}</div><div class="price-options">${p.transferPrice?`<div class="price-option"><span>Transferencia</span><b>${fmt(p.transferPrice)}</b></div>`:''}${p.cashPrice?`<div class="price-option"><span>Efectivo</span><b>${fmt(p.cashPrice)}</b></div>`:''}</div>${p.variants?`<div class="variant-box"><b>Opciones:</b> ${esc(p.variants)}</div>`:''}<button class="btn btn-dark" style="width:100%" id="modalWa">Consultar por WhatsApp</button><p style="font-size:12px;color:var(--muted);margin-top:12px">La compra se coordina por WhatsApp. La integración de tarjeta y Mercado Pago se agrega en una segunda etapa.</p></div></div>`;
    $('#modalWa').onclick = () => wa(`Hola! Quería consultar por ${p.name} (${fmt(p.price)}).`);
    $('#productModal').classList.add('open'); document.body.style.overflow='hidden';
  }
  function closeProduct(){ $('#productModal').classList.remove('open'); document.body.style.overflow=''; }
  function toast(msg){const t=$('#toast');t.textContent=msg;t.classList.add('show');setTimeout(()=>t.classList.remove('show'),2600)}
  function wa(message='Hola! Quería hacer una consulta en Valto Mates.'){
    const num = (config.whatsappNumber || '').replace(/\D/g,'');
    if(!num){toast('Falta cargar el número de WhatsApp en config.js');return;}
    window.open(`https://wa.me/${num}?text=${encodeURIComponent(message)}`,'_blank','noopener');
  }

  $('#searchInput').addEventListener('input', e => {query=e.target.value;page=1;renderProducts()});
  $('#sortSelect').addEventListener('change', e => {sort=e.target.value;page=1;renderProducts()});
  $('#focusSearch').onclick = () => {document.querySelector('#productos').scrollIntoView({behavior:'smooth'});setTimeout(()=>$('#searchInput').focus(),500)};
  $('#menuBtn').onclick = () => $('#drawerBackdrop').classList.add('open');
  $('#closeDrawer').onclick = () => $('#drawerBackdrop').classList.remove('open');
  $('#drawerBackdrop').onclick = e => {if(e.target === $('#drawerBackdrop')) $('#drawerBackdrop').classList.remove('open')};
  $$('.drawer-nav a').forEach(a => a.onclick = () => $('#drawerBackdrop').classList.remove('open'));
  $('#closeModal').onclick = closeProduct;
  $('#productModal').onclick = e => {if(e.target === $('#productModal')) closeProduct()};
  document.addEventListener('keydown', e => {if(e.key==='Escape'){closeProduct();$('#drawerBackdrop').classList.remove('open')}});
  ['#floatingWa','#headerWa','#footerWa','#comboWa'].forEach(sel => $(sel).onclick = () => wa(sel==='#comboWa'?'Hola! Quiero armar un combo matero.':'Hola! Quería hacer una consulta en Valto Mates.'));
  $('#heroSecondary').onclick = (e) => {e.preventDefault(); activeCategory='Todos'; sort='featured'; renderCategories(); renderProducts(); document.querySelector('#productos').scrollIntoView({behavior:'smooth'});};

  window.addEventListener('storage', e => {
    if(e.key==='valto_store_data'){
      state=normalizeState(JSON.parse(e.newValue||'null')||structuredClone(defaults));
      applyTheme();
      renderCategories();
      renderProducts();
    }
  });
  applyTheme();renderCategories();renderProducts();
})();
