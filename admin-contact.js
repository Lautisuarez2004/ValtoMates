(() => {
  const config = window.VALTO_CONFIG || {};
  if (!window.supabase || !config.supabaseUrl || !config.supabaseAnonKey) return;

  const sb = window.supabase.createClient(config.supabaseUrl, config.supabaseAnonKey, { auth: { persistSession: true } });
  const $ = s => document.querySelector(s);

  function toast(message) {
    const el = $('#toast');
    if (!el) return;
    el.textContent = message;
    el.classList.add('show');
    setTimeout(() => el.classList.remove('show'), 2600);
  }

  function normalizeSocial(value, platform) {
    const raw = String(value || '').trim();
    if (!raw) return '';
    if (/^https?:\/\//i.test(raw)) return raw;
    const handle = raw.replace(/^@/, '').replace(/^\/+|\/+$/g, '').trim();
    if (!handle) return '';
    return platform === 'instagram'
      ? `https://www.instagram.com/${handle}/`
      : `https://www.tiktok.com/@${handle}`;
  }

  function injectContactEditor() {
    const card = document.querySelector('[data-panel="contact"] .admin-card');
    if (!card || $('#contactInstagram')) return;

    const copy = card.querySelector('p');
    if (copy) copy.textContent = 'Configurá las redes sociales que aparecen al final de la tienda. Podés pegar el link completo o escribir solamente el usuario.';

    const grid = card.querySelector('.form-grid');
    if (!grid) return;
    grid.innerHTML = `
      <div class="field"><label>Email actual</label><input value="${String(config.email || '')}" disabled></div>
      <div class="field"><label>WhatsApp</label><input value="${config.whatsappNumber ? String(config.whatsappNumber) : 'Pendiente de cargar'}" disabled></div>
      <div class="field"><label>Instagram</label><input id="contactInstagram" placeholder="@usuario o https://instagram.com/usuario"></div>
      <div class="field"><label>TikTok</label><input id="contactTikTok" placeholder="@usuario o https://tiktok.com/@usuario"></div>
    `;

    const actions = document.createElement('div');
    actions.className = 'admin-actions';
    actions.innerHTML = '<button class="btn btn-dark" id="saveContactSettings">Guardar redes sociales</button>';
    grid.insertAdjacentElement('afterend', actions);

    $('#saveContactSettings').addEventListener('click', saveSettings);
  }

  async function loadSettings() {
    injectContactEditor();
    if (!$('#contactInstagram')) return;
    const { data, error } = await sb.from('valto_contact_settings').select('instagram_url,tiktok_url').eq('id', 'default').maybeSingle();
    if (error) {
      console.error('contact settings load', error);
      return;
    }
    $('#contactInstagram').value = data?.instagram_url || '';
    $('#contactTikTok').value = data?.tiktok_url || '';
  }

  async function saveSettings() {
    const instagramUrl = normalizeSocial($('#contactInstagram')?.value, 'instagram');
    const tiktokUrl = normalizeSocial($('#contactTikTok')?.value, 'tiktok');
    const button = $('#saveContactSettings');
    if (button) {
      button.disabled = true;
      button.textContent = 'Guardando...';
    }
    const { error } = await sb.from('valto_contact_settings').upsert({
      id: 'default',
      instagram_url: instagramUrl,
      tiktok_url: tiktokUrl,
      updated_at: new Date().toISOString()
    }, { onConflict: 'id' });

    if (button) {
      button.disabled = false;
      button.textContent = 'Guardar redes sociales';
    }
    if (error) {
      console.error('contact settings save', error);
      toast('No se pudieron guardar las redes sociales');
      return;
    }
    $('#contactInstagram').value = instagramUrl;
    $('#contactTikTok').value = tiktokUrl;
    toast('Instagram y TikTok actualizados');
  }

  injectContactEditor();
  document.addEventListener('click', event => {
    const tab = event.target.closest?.('.admin-nav button');
    if (tab?.dataset?.tab === 'contact') setTimeout(loadSettings, 0);
  }, true);

  sb.auth.getSession().then(({ data }) => {
    if (data.session) loadSettings();
  });
  sb.auth.onAuthStateChange((_event, session) => {
    if (session) setTimeout(loadSettings, 0);
  });
})();