(() => {
  const config = window.VALTO_CONFIG || {};
  if (!config.supabaseUrl || !config.supabaseAnonKey) return;
  const frames = new Map();
  let currentProductId = '';
  let signature = '';

  const clamp = (n, min, max) => Math.max(min, Math.min(max, Number(n)));

  function injectStyles() {
    if (document.getElementById('productFrameStyles')) return;
    const s = document.createElement('style');
    s.id = 'productFrameStyles';
    s.textContent = `
      .product-image-wrap img,.modal-image img,.related-card img{object-position:var(--valto-frame-x,50%) var(--valto-frame-y,50%);transform:scale(var(--valto-frame-zoom,1));transform-origin:var(--valto-frame-x,50%) var(--valto-frame-y,50%);will-change:transform,object-position}
      .product-card:hover .product-image-wrap img{transform:scale(var(--valto-frame-hover-zoom,var(--valto-frame-zoom,1)))}
    `;
    document.head.appendChild(s);
  }

  function frameFor(id) { return frames.get(String(id)) || { x: 50, y: 50, zoom: 1 }; }
  function applyImage(img, id) {
    if (!img || !id) return;
    const f = frameFor(id);
    img.style.setProperty('--valto-frame-x', `${f.x}%`);
    img.style.setProperty('--valto-frame-y', `${f.y}%`);
    img.style.setProperty('--valto-frame-zoom', String(f.zoom));
    img.style.setProperty('--valto-frame-hover-zoom', String(Math.min(3, f.zoom + 0.035)));
  }

  function applyCards(root = document) {
    root.querySelectorAll?.('.product-card').forEach(card => {
      const trigger = card.querySelector('[data-open]');
      const id = trigger?.dataset?.open;
      applyImage(card.querySelector('.product-image-wrap img'), id);
    });
    root.querySelectorAll?.('.related-card[data-related]').forEach(card => applyImage(card.querySelector('img'), card.dataset.related));
  }

  function applyModal() {
    if (!currentProductId) return;
    applyImage(document.querySelector('#modalInner .modal-image img'), currentProductId);
  }

  async function loadFrames() {
    try {
      const r = await fetch(`${config.supabaseUrl}/rest/v1/valto_products?select=id,image_position_x,image_position_y,image_zoom&visible=eq.true`, { headers: { apikey: config.supabaseAnonKey }, cache: 'no-store' });
      const rows = await r.json();
      if (!r.ok || !Array.isArray(rows)) return;
      const next = JSON.stringify(rows.map(p => [p.id, p.image_position_x, p.image_position_y, p.image_zoom]));
      if (next === signature) return;
      signature = next;
      frames.clear();
      rows.forEach(p => frames.set(String(p.id), {
        x: clamp(p.image_position_x ?? 50, 0, 100),
        y: clamp(p.image_position_y ?? 50, 0, 100),
        zoom: clamp(p.image_zoom ?? 1, 1, 3)
      }));
      applyCards(); applyModal();
    } catch (e) { console.error('No se pudo cargar el encuadre de imágenes', e); }
  }

  injectStyles();
  document.addEventListener('click', e => {
    const trigger = e.target.closest?.('[data-open]');
    if (trigger?.dataset?.open) { currentProductId = trigger.dataset.open; setTimeout(applyModal, 40); }
    const related = e.target.closest?.('[data-related]');
    if (related?.dataset?.related) { currentProductId = related.dataset.related; setTimeout(applyModal, 80); }
  }, true);

  const grid = document.getElementById('productGrid');
  if (grid) new MutationObserver(() => applyCards(grid)).observe(grid, { childList: true, subtree: true });
  const modal = document.getElementById('modalInner');
  if (modal) new MutationObserver(() => { applyModal(); applyCards(modal); }).observe(modal, { childList: true, subtree: true });

  window.addEventListener('valto:commerce-updated', () => { applyCards(); loadFrames(); });
  window.addEventListener('focus', loadFrames);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) loadFrames(); });
  loadFrames();
  setInterval(() => { if (!document.hidden) loadFrames(); }, 5000);
})();
