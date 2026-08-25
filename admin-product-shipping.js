(() => {
  const config = window.VALTO_CONFIG || {};
  if (!window.supabase || !config.supabaseUrl || !config.supabaseAnonKey) return;

  const sb = window.supabase.createClient(config.supabaseUrl, config.supabaseAnonKey, { auth: { persistSession: true } });
  const $ = s => document.querySelector(s);

  function injectFields() {
    if ($('#pShippingWeight')) return;
    const descriptionField = $('#pDescription')?.closest('.field');
    const formGrid = descriptionField?.parentElement;
    if (!formGrid) return;

    const title = document.createElement('div');
    title.className = 'field full';
    title.innerHTML = `
      <div style="height:1px;background:var(--line);margin:10px 0 14px"></div>
      <h3 style="margin:0 0 5px">Datos para el envío</h3>
      <small style="display:block;color:var(--muted);line-height:1.45">Cargá el peso y las medidas del producto <b>ya embalado</b>. Correo Argentino usa estos datos para cotizar. Si todavía son estimados, podés corregirlos después desde acá.</small>
    `;
    descriptionField.insertAdjacentElement('afterend', title);

    title.insertAdjacentHTML('afterend', `
      <div class="field"><label>Peso embalado (g)</label><input id="pShippingWeight" type="number" min="0" max="25000" step="1" placeholder="Ej: 650"><small style="display:block;color:var(--muted);margin-top:5px">0 = pendiente de cargar</small></div>
      <div class="field"><label>Largo embalado (cm)</label><input id="pShippingLength" type="number" min="0" max="150" step="0.1" placeholder="Ej: 25"></div>
      <div class="field"><label>Ancho embalado (cm)</label><input id="pShippingWidth" type="number" min="0" max="150" step="0.1" placeholder="Ej: 18"></div>
      <div class="field"><label>Alto embalado (cm)</label><input id="pShippingHeight" type="number" min="0" max="150" step="0.1" placeholder="Ej: 12"></div>
    `);
  }

  function resetFields() {
    ['#pShippingWeight','#pShippingLength','#pShippingWidth','#pShippingHeight'].forEach(sel => {
      if ($(sel)) $(sel).value = '';
    });
  }

  async function loadDimensions(id) {
    injectFields();
    if (!id) return resetFields();
    const { data, error } = await sb.from('valto_products')
      .select('shipping_weight_g,shipping_length_cm,shipping_width_cm,shipping_height_cm')
      .eq('id', id)
      .maybeSingle();
    if (error) {
      console.error('shipping dimensions load', error);
      return;
    }
    if ($('#pShippingWeight')) $('#pShippingWeight').value = Number(data?.shipping_weight_g || 0) || '';
    if ($('#pShippingLength')) $('#pShippingLength').value = Number(data?.shipping_length_cm || 0) || '';
    if ($('#pShippingWidth')) $('#pShippingWidth').value = Number(data?.shipping_width_cm || 0) || '';
    if ($('#pShippingHeight')) $('#pShippingHeight').value = Number(data?.shipping_height_cm || 0) || '';
  }

  function readNumber(selector, max) {
    const value = Math.max(0, Number($(selector)?.value || 0));
    return Math.min(max, Math.round(value * 10) / 10);
  }

  function wrapSave() {
    const save = $('#saveProduct');
    if (!save || save.dataset.shippingWrapped === '1') return;
    const original = save.onclick;
    save.onclick = async function (event) {
      const productId = String($('#pId')?.value || '').trim();
      const payload = {
        shipping_weight_g: Math.round(readNumber('#pShippingWeight', 25000)),
        shipping_length_cm: readNumber('#pShippingLength', 150),
        shipping_width_cm: readNumber('#pShippingWidth', 150),
        shipping_height_cm: readNumber('#pShippingHeight', 150),
        updated_at: new Date().toISOString()
      };

      if (original) await original.call(this, event);
      if (!productId) return;

      const { error } = await sb.from('valto_products').update(payload).eq('id', productId);
      if (error) console.error('shipping dimensions save', error);
    };
    save.dataset.shippingWrapped = '1';
  }

  injectFields();
  wrapSave();

  document.addEventListener('click', event => {
    const edit = event.target.closest?.('[data-edit]');
    if (edit) setTimeout(() => loadDimensions(edit.dataset.edit), 100);
    if (event.target.closest?.('#newProduct')) setTimeout(resetFields, 50);
  }, true);

  sb.auth.getSession().then(({ data }) => {
    if (data.session) {
      injectFields();
      wrapSave();
    }
  });
})();