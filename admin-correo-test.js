(() => {
  const $ = s => document.querySelector(s);
  const money = n => new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 2 }).format(Number(n || 0));

  function currentOrigin() {
    return String($('#shippingOriginPostalCode')?.value || '1900').trim().toUpperCase().replace(/\s+/g, '') || '1900';
  }

  function injectTester() {
    const panel = document.querySelector('[data-panel="shipping"] .admin-card');
    if (!panel || $('#correoTestCard')) {
      if ($('#correoOriginCp') && document.activeElement !== $('#correoOriginCp')) $('#correoOriginCp').value = currentOrigin();
      return;
    }

    const wrap = document.createElement('div');
    wrap.id = 'correoTestCard';
    wrap.style.cssText = 'margin-top:26px;padding-top:24px;border-top:1px solid var(--line)';
    wrap.innerHTML = `
      <h3 style="margin:0 0 6px">Prueba API · Correo Argentino</h3>
      <p style="color:var(--muted);margin:0 0 16px">Hace una cotización real contra el ambiente QA de MiCorreo sin afectar las tarifas visibles de la tienda.</p>
      <div class="form-grid">
        <div class="field"><label>CP origen</label><input id="correoOriginCp" value="${currentOrigin()}" maxlength="8"></div>
        <div class="field"><label>CP destino</label><input id="correoDestinationCp" placeholder="Ej: 1425" maxlength="8"></div>
        <div class="field"><label>Peso (gramos)</label><input id="correoWeight" type="number" min="1" max="25000" value="1000"></div>
        <div class="field"><label>Alto (cm)</label><input id="correoHeight" type="number" min="1" max="150" value="20"></div>
        <div class="field"><label>Ancho (cm)</label><input id="correoWidth" type="number" min="1" max="150" value="20"></div>
        <div class="field"><label>Largo (cm)</label><input id="correoLength" type="number" min="1" max="150" value="30"></div>
      </div>
      <div class="admin-actions"><button class="btn btn-dark" id="correoTestBtn">Probar cotización</button></div>
      <div id="correoTestResult" style="margin-top:14px"></div>
    `;
    panel.appendChild(wrap);
    $('#correoTestBtn')?.addEventListener('click', runTest);
  }

  function renderRates(label, result) {
    if (!result?.ok) return `<div style="padding:10px 12px;border:1px solid var(--line);border-radius:12px"><b>${label}</b><br><span style="color:#9b2c2c">${String(result?.error || 'Sin cotización')}</span></div>`;
    const rates = Array.isArray(result.rates) ? result.rates : [];
    if (!rates.length) return `<div style="padding:10px 12px;border:1px solid var(--line);border-radius:12px"><b>${label}</b><br><span style="color:var(--muted)">Sin tarifas devueltas.</span></div>`;
    return `<div style="padding:10px 12px;border:1px solid var(--line);border-radius:12px"><b>${label}</b>${rates.map(r => `<div style="margin-top:7px">${String(r.productName || r.productType || 'Servicio')} · <strong>${money(r.price)}</strong></div>`).join('')}</div>`;
  }

  async function runTest() {
    const button = $('#correoTestBtn');
    const result = $('#correoTestResult');
    const payload = {
      postalCodeOrigin: String($('#correoOriginCp')?.value || '').trim(),
      postalCodeDestination: String($('#correoDestinationCp')?.value || '').trim(),
      weight: Number($('#correoWeight')?.value || 1000),
      height: Number($('#correoHeight')?.value || 20),
      width: Number($('#correoWidth')?.value || 20),
      length: Number($('#correoLength')?.value || 30)
    };

    if (!payload.postalCodeDestination) {
      if (result) result.innerHTML = '<span style="color:#9b2c2c">Ingresá un código postal de destino.</span>';
      return;
    }

    if (button) { button.disabled = true; button.textContent = 'Consultando Correo...'; }
    if (result) result.innerHTML = '<span style="color:var(--muted)">Conectando con MiCorreo QA...</span>';

    try {
      const response = await fetch('/api/correo-quote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data?.error || `Error ${response.status}`);
      if (result) result.innerHTML = `
        <div style="display:grid;gap:10px">
          <div style="font-size:12px;color:var(--muted)">Ambiente: <b>${data.environment === 'qa' ? 'QA / pruebas' : 'Producción'}</b> · Cliente MiCorreo: ${String(data.customerId || '—')}</div>
          ${renderRates('Envío a domicilio', data.home)}
          ${renderRates('Retiro por sucursal', data.branch)}
        </div>`;
    } catch (error) {
      if (result) result.innerHTML = `<div style="padding:11px 13px;background:#fdecec;color:#8a2626;border-radius:12px"><b>No se pudo cotizar.</b><br>${String(error?.message || error)}</div>`;
    } finally {
      if (button) { button.disabled = false; button.textContent = 'Probar cotización'; }
    }
  }

  injectTester();
  document.addEventListener('input', event => {
    if (event.target?.id === 'shippingOriginPostalCode' && $('#correoOriginCp') && document.activeElement !== $('#correoOriginCp')) {
      $('#correoOriginCp').value = currentOrigin();
    }
  });
  document.addEventListener('click', event => {
    const tab = event.target.closest?.('.admin-nav button');
    if (tab?.dataset?.tab === 'shipping') setTimeout(injectTester, 0);
  }, true);
})();
