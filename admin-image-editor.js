(() => {
  const config = window.VALTO_CONFIG || {};
  const $ = (s) => document.querySelector(s);
  if (!window.supabase || !config.supabaseUrl || !config.supabaseAnonKey) return;

  const sb = window.supabase.createClient(config.supabaseUrl, config.supabaseAnonKey, { auth: { persistSession: true } });
  const frame = { x: 50, y: 50, zoom: 1 };
  let loadedProductId = '';

  const clamp = (n, min, max) => Math.max(min, Math.min(max, Number(n)));
  const safeUrl = (v = '') => String(v).trim();

  function injectStyles() {
    if ($('#imageEditorStyles')) return;
    const style = document.createElement('style');
    style.id = 'imageEditorStyles';
    style.textContent = `
      .image-editor{margin-top:10px;padding:18px;border:1px solid #ddd9cf;border-radius:18px;background:#f8f6ef}
      .image-editor-head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;margin-bottom:14px}
      .image-editor-head h3{margin:0;font-size:18px}.image-editor-head p{margin:5px 0 0;color:var(--muted);font-size:12px;max-width:650px}
      .image-editor-layout{display:grid;grid-template-columns:minmax(260px,340px) 1fr;gap:22px;align-items:start}
      .crop-stage{position:relative;width:100%;aspect-ratio:1/1;overflow:hidden;border-radius:18px;background:#e8e5dc;touch-action:none;cursor:grab;user-select:none;box-shadow:inset 0 0 0 1px rgba(41,43,35,.12)}
      .crop-stage.dragging{cursor:grabbing}.crop-stage img{width:100%;height:100%;object-fit:cover;pointer-events:none;will-change:transform,object-position}
      .crop-grid{position:absolute;inset:0;pointer-events:none;background-image:linear-gradient(to right,transparent 33.1%,rgba(255,255,255,.9) 33.1%,rgba(255,255,255,.9) 33.7%,transparent 33.7%,transparent 66.3%,rgba(255,255,255,.9) 66.3%,rgba(255,255,255,.9) 66.9%,transparent 66.9%),linear-gradient(to bottom,transparent 33.1%,rgba(255,255,255,.9) 33.1%,rgba(255,255,255,.9) 33.7%,transparent 33.7%,transparent 66.3%,rgba(255,255,255,.9) 66.3%,rgba(255,255,255,.9) 66.9%,transparent 66.9%);filter:drop-shadow(0 1px 1px rgba(0,0,0,.35))}
      .crop-empty{position:absolute;inset:0;display:grid;place-items:center;padding:24px;text-align:center;color:#777;font-size:13px;background:#eeeae0}
      .image-editor-controls{display:grid;gap:14px;margin-top:14px}.crop-control{display:grid;grid-template-columns:90px 1fr 54px;gap:10px;align-items:center}.crop-control label{font-size:12px;font-weight:800;text-transform:uppercase;letter-spacing:.05em;color:#666}.crop-control output{font-size:12px;text-align:right;color:#555}.crop-control input[type=range]{width:100%}
      .image-preview-title{font-size:12px;text-transform:uppercase;letter-spacing:.08em;color:var(--muted);font-weight:800;margin-bottom:10px}
      .image-preview-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px;align-items:start}.image-preview-card{border:1px solid #dedad0;background:#fff;border-radius:16px;overflow:hidden}.image-preview-card.mobile{max-width:160px}.image-preview-card.modal-preview{max-width:260px}.image-preview-image{position:relative;aspect-ratio:1/1;overflow:hidden;background:#ebe7dc}.image-preview-image img{width:100%;height:100%;object-fit:cover;will-change:transform,object-position}.image-preview-copy{padding:10px}.image-preview-copy small{display:block;color:var(--muted);font-size:9px;text-transform:uppercase;letter-spacing:.08em}.image-preview-copy b{display:block;font-family:var(--serif);font-size:14px;line-height:1.15;margin:4px 0 7px}.image-preview-copy span{font-size:12px;font-weight:850}
      .image-editor-actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:14px}.image-editor-actions button{font-size:12px}
      .image-editor-values{font-size:11px;color:var(--muted);margin-top:8px}
      @media(max-width:900px){.image-editor-layout{grid-template-columns:1fr}.crop-stage{max-width:420px}.image-preview-grid{grid-template-columns:repeat(3,minmax(120px,1fr));overflow:auto;padding-bottom:4px}}
      @media(max-width:560px){.image-preview-grid{grid-template-columns:repeat(3,140px)}.crop-control{grid-template-columns:72px 1fr 46px}.image-editor{padding:14px}}
    `;
    document.head.appendChild(style);
  }

  function imageTransform(img) {
    if (!img) return;
    img.style.objectPosition = `${frame.x}% ${frame.y}%`;
    img.style.transformOrigin = `${frame.x}% ${frame.y}%`;
    img.style.transform = `scale(${frame.zoom})`;
  }

  function syncPreview() {
    const url = safeUrl($('#pImage')?.value || '');
    document.querySelectorAll('[data-frame-image]').forEach(img => {
      if (img.getAttribute('src') !== url) img.setAttribute('src', url);
      imageTransform(img);
    });
    const empty = $('#cropEmpty');
    if (empty) empty.style.display = url ? 'none' : 'grid';
    if ($('#frameX')) $('#frameX').value = String(frame.x);
    if ($('#frameY')) $('#frameY').value = String(frame.y);
    if ($('#frameZoom')) $('#frameZoom').value = String(frame.zoom);
    if ($('#frameXOut')) $('#frameXOut').textContent = `${Math.round(frame.x)}%`;
    if ($('#frameYOut')) $('#frameYOut').textContent = `${Math.round(frame.y)}%`;
    if ($('#frameZoomOut')) $('#frameZoomOut').textContent = `${frame.zoom.toFixed(2)}×`;
    if ($('#imageEditorValues')) $('#imageEditorValues').textContent = `Encuadre guardado: X ${Math.round(frame.x)}% · Y ${Math.round(frame.y)}% · zoom ${frame.zoom.toFixed(2)}×`;
    const name = $('#pName')?.value.trim() || 'Nombre del producto';
    const price = Number($('#pPrice')?.value || 0);
    const priceText = new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(price);
    document.querySelectorAll('[data-preview-name]').forEach(el => el.textContent = name);
    document.querySelectorAll('[data-preview-price]').forEach(el => el.textContent = priceText);
  }

  function setFrame(next = {}) {
    frame.x = clamp(next.x ?? frame.x, 0, 100);
    frame.y = clamp(next.y ?? frame.y, 0, 100);
    frame.zoom = clamp(next.zoom ?? frame.zoom, 1, 3);
    syncPreview();
  }

  function injectEditor() {
    injectStyles();
    if ($('#productImageEditor')) return;
    const imageField = $('#pImage')?.closest('.field');
    if (!imageField) return;
    const editor = document.createElement('div');
    editor.id = 'productImageEditor';
    editor.className = 'field full';
    editor.innerHTML = `
      <div class="image-editor">
        <div class="image-editor-head"><div><h3>Encuadre de la imagen</h3><p>La cuadrícula representa el recorte 1:1 que usa Valto. Arrastrá la foto para acomodarla y usá el zoom. La imagen original no se modifica.</p></div></div>
        <div class="image-editor-layout">
          <div>
            <div class="crop-stage" id="cropStage"><img data-frame-image alt="Vista previa del encuadre"><div class="crop-empty" id="cropEmpty">Pegá una URL de imagen arriba para empezar a encuadrarla.</div><div class="crop-grid"></div></div>
            <div class="image-editor-controls">
              <div class="crop-control"><label for="frameZoom">Zoom</label><input id="frameZoom" type="range" min="1" max="3" step="0.01" value="1"><output id="frameZoomOut">1.00×</output></div>
              <div class="crop-control"><label for="frameX">Horizontal</label><input id="frameX" type="range" min="0" max="100" step="1" value="50"><output id="frameXOut">50%</output></div>
              <div class="crop-control"><label for="frameY">Vertical</label><input id="frameY" type="range" min="0" max="100" step="1" value="50"><output id="frameYOut">50%</output></div>
            </div>
            <div class="image-editor-actions"><button type="button" class="small-btn" id="resetFrame">Centrar imagen</button></div>
            <div class="image-editor-values" id="imageEditorValues"></div>
          </div>
          <div>
            <div class="image-preview-title">Vista previa real</div>
            <div class="image-preview-grid">
              <div><div class="image-preview-card"><div class="image-preview-image"><img data-frame-image alt="Catálogo"></div><div class="image-preview-copy"><small>Catálogo</small><b data-preview-name>Nombre del producto</b><span data-preview-price>$0</span></div></div></div>
              <div><div class="image-preview-card mobile"><div class="image-preview-image"><img data-frame-image alt="Celular"></div><div class="image-preview-copy"><small>Celular · 2 columnas</small><b data-preview-name>Nombre del producto</b><span data-preview-price>$0</span></div></div></div>
              <div><div class="image-preview-card modal-preview"><div class="image-preview-image"><img data-frame-image alt="Ficha"></div><div class="image-preview-copy"><small>Ficha de producto</small><b data-preview-name>Nombre del producto</b><span data-preview-price>$0</span></div></div></div>
            </div>
          </div>
        </div>
      </div>`;
    imageField.insertAdjacentElement('afterend', editor);

    $('#frameZoom').addEventListener('input', e => setFrame({ zoom: e.target.value }));
    $('#frameX').addEventListener('input', e => setFrame({ x: e.target.value }));
    $('#frameY').addEventListener('input', e => setFrame({ y: e.target.value }));
    $('#resetFrame').onclick = () => setFrame({ x: 50, y: 50, zoom: 1 });
    $('#pImage').addEventListener('input', syncPreview);
    $('#pName')?.addEventListener('input', syncPreview);
    $('#pPrice')?.addEventListener('input', syncPreview);

    const stage = $('#cropStage');
    let dragging = false, startPointerX = 0, startPointerY = 0, startX = 50, startY = 50;
    stage.addEventListener('pointerdown', e => {
      if (!safeUrl($('#pImage')?.value)) return;
      dragging = true; stage.classList.add('dragging'); stage.setPointerCapture(e.pointerId);
      startPointerX = e.clientX; startPointerY = e.clientY; startX = frame.x; startY = frame.y;
    });
    stage.addEventListener('pointermove', e => {
      if (!dragging) return;
      const rect = stage.getBoundingClientRect();
      const factor = 100 / Math.max(1, frame.zoom);
      setFrame({ x: startX - ((e.clientX - startPointerX) / rect.width) * factor, y: startY - ((e.clientY - startPointerY) / rect.height) * factor });
    });
    const stop = e => { if (!dragging) return; dragging = false; stage.classList.remove('dragging'); try { stage.releasePointerCapture(e.pointerId); } catch {} };
    stage.addEventListener('pointerup', stop); stage.addEventListener('pointercancel', stop);
    syncPreview();
  }

  async function loadFrame(productId) {
    loadedProductId = productId || '';
    if (!productId) { setFrame({ x: 50, y: 50, zoom: 1 }); return; }
    const { data, error } = await sb.from('valto_products').select('image_position_x,image_position_y,image_zoom').eq('id', productId).maybeSingle();
    if (error || !data || loadedProductId !== productId) return;
    setFrame({ x: Number(data.image_position_x ?? 50), y: Number(data.image_position_y ?? 50), zoom: Number(data.image_zoom ?? 1) });
  }

  function attachFormHooks() {
    injectEditor();
    document.addEventListener('click', e => {
      const edit = e.target.closest?.('[data-edit]');
      if (edit) setTimeout(() => { injectEditor(); loadFrame(edit.dataset.edit); syncPreview(); }, 80);
      if (e.target.closest?.('#newProduct')) setTimeout(() => { injectEditor(); loadFrame(''); syncPreview(); }, 40);
    }, true);

    const save = $('#saveProduct');
    if (save && !save.dataset.imageFrameWrapped) {
      const original = save.onclick;
      save.onclick = async function(ev) {
        const productId = $('#pId')?.value.trim();
        const snapshot = { x: frame.x, y: frame.y, zoom: frame.zoom };
        if (original) await original.call(this, ev);
        if (productId) {
          const { error } = await sb.from('valto_products').update({
            image_position_x: snapshot.x,
            image_position_y: snapshot.y,
            image_zoom: snapshot.zoom,
            updated_at: new Date().toISOString()
          }).eq('id', productId);
          if (error) console.error('No se pudo guardar el encuadre de la imagen', error);
        }
      };
      save.dataset.imageFrameWrapped = '1';
    }
  }

  attachFormHooks();
})();
