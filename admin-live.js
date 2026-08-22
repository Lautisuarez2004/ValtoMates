(() => {
  const config = window.VALTO_CONFIG || {};
  const $ = (s) => document.querySelector(s);
  if(!window.supabase || !config.supabaseUrl || !config.supabaseAnonKey) return;
  const sbLive = window.supabase.createClient(config.supabaseUrl, config.supabaseAnonKey, {auth:{persistSession:true}});

  function addVariantLabelField(){
    if($('#pVariantLabel')) return;
    const variantsField = $('#pVariants')?.closest('.field');
    if(!variantsField) return;
    variantsField.classList.remove('full');
    const field = document.createElement('div');
    field.className = 'field';
    field.innerHTML = `<label>Tipo de opción</label><input id="pVariantLabel" placeholder="Ej: Color, Tamaño, Modelo, Sabor"><small style="display:block;color:var(--muted);margin-top:5px">Este texto aparece en la tienda como “Elegí Color”, “Elegí Tamaño”, etc.</small>`;
    variantsField.parentElement.insertBefore(field, variantsField);
    const label = variantsField.querySelector('label');
    if(label) label.textContent = 'Opciones separadas por ·';
  }

  async function loadProductExtras(id){
    if(!id) return;
    const {data,error} = await sbLive.from('valto_products').select('id,stock,variant_label').eq('id',id).maybeSingle();
    if(error || !data) return;
    if($('#pVariantLabel')) $('#pVariantLabel').value = data.variant_label || 'Color';
    if($('#pStock') && document.activeElement !== $('#pStock')) $('#pStock').value = Number(data.stock || 0);
  }

  function attachFormHooks(){
    addVariantLabelField();
    document.addEventListener('click', (e) => {
      const edit = e.target.closest?.('[data-edit]');
      if(edit) setTimeout(() => loadProductExtras(edit.dataset.edit), 80);
      if(e.target.closest?.('#newProduct')) setTimeout(() => { if($('#pVariantLabel')) $('#pVariantLabel').value='Color'; }, 30);
    }, true);

    const save = $('#saveProduct');
    if(save && !save.dataset.variantWrapped){
      const original = save.onclick;
      save.onclick = async function(ev){
        const productId = $('#pId')?.value.trim();
        const variantLabel = ($('#pVariantLabel')?.value || 'Color').trim() || 'Color';
        if(original) await original.call(this, ev);
        if(productId){
          const {error} = await sbLive.from('valto_products').update({variant_label:variantLabel,updated_at:new Date().toISOString()}).eq('id',productId);
          if(error) console.error('No se pudo guardar el tipo de opción', error);
        }
      };
      save.dataset.variantWrapped='1';
    }
  }

  function stockClass(n){ return n<=0?'out':n<=2?'low':''; }

  async function refreshStockDom(){
    const {data,error} = await sbLive.from('valto_products').select('id,stock').eq('visible',true);
    if(error || !Array.isArray(data)) return;
    data.forEach(p => {
      const edit = document.querySelector(`[data-edit="${CSS.escape(String(p.id))}"]`);
      const row = edit?.closest('tr');
      const pill = row?.querySelector('.stock-pill');
      const n = Number(p.stock || 0);
      if(pill){ pill.textContent=String(n); pill.className=`stock-pill ${stockClass(n)}`.trim(); }
      if($('#pId')?.value===String(p.id) && $('#productFormCard') && !$('#productFormCard').classList.contains('hidden') && document.activeElement!==$('#pStock')) $('#pStock').value=n;
    });
  }

  function ordersPanelVisible(){
    const panel = document.querySelector('[data-panel="orders"]');
    return panel && !panel.classList.contains('hidden');
  }

  let timer = null;
  async function startLive(){
    if(timer) return;
    await refreshStockDom();
    timer = setInterval(async () => {
      if(document.hidden) return;
      await refreshStockDom();
      if(ordersPanelVisible()) $('#refreshOrders')?.click();
    }, 4000);
  }

  function stopLive(){ if(timer){clearInterval(timer);timer=null;} }

  attachFormHooks();
  sbLive.auth.getSession().then(({data}) => { if(data.session) startLive(); });
  sbLive.auth.onAuthStateChange((_event,session) => { if(session) startLive(); else stopLive(); });
  window.addEventListener('focus', refreshStockDom);
  document.addEventListener('visibilitychange', () => { if(!document.hidden) refreshStockDom(); });
})();