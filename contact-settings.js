(() => {
  const config = window.VALTO_CONFIG || {};
  if (!config.supabaseUrl || !config.supabaseAnonKey) return;

  function setLink(label, href) {
    const link = document.querySelector(`.footer-social-link[aria-label="${label}"]`);
    if (!link) return false;
    if (href) {
      link.href = href;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      link.removeAttribute('aria-disabled');
      link.removeAttribute('title');
    } else {
      link.href = '#';
      link.setAttribute('aria-disabled', 'true');
      link.title = `Falta cargar el link de ${label}`;
      link.removeAttribute('target');
      link.removeAttribute('rel');
    }
    return true;
  }

  function applySocialLinks(retries = 0) {
    const instagramReady = setLink('Instagram', String(config.instagramUrl || '').trim());
    const tiktokReady = setLink('TikTok', String(config.tiktokUrl || '').trim());
    if ((!instagramReady || !tiktokReady) && retries < 20) {
      setTimeout(() => applySocialLinks(retries + 1), 100);
    }
  }

  async function load() {
    try {
      const response = await fetch(`${config.supabaseUrl}/rest/v1/valto_contact_settings?id=eq.default&select=instagram_url,tiktok_url`, {
        headers: { apikey: config.supabaseAnonKey },
        cache: 'no-store'
      });
      const rows = await response.json();
      if (response.ok && Array.isArray(rows) && rows[0]) {
        config.instagramUrl = rows[0].instagram_url || '';
        config.tiktokUrl = rows[0].tiktok_url || '';
      }
    } catch (error) {
      console.error('contact settings', error);
    }
    applySocialLinks();
    window.dispatchEvent(new CustomEvent('valto:contact-updated', { detail: {
      instagramUrl: config.instagramUrl || '',
      tiktokUrl: config.tiktokUrl || ''
    }}));
  }

  load();
})();