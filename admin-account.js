(() => {
  const config = window.VALTO_CONFIG || {};
  if (!window.supabase || !config.supabaseUrl || !config.supabaseAnonKey) return;

  const sb = window.supabase.createClient(config.supabaseUrl, config.supabaseAnonKey, { auth: { persistSession: true } });
  const $ = s => document.querySelector(s);
  const $$ = s => [...document.querySelectorAll(s)];

  function toast(message, ms = 3200) {
    const el = $('#toast');
    if (!el) return;
    el.textContent = message;
    el.classList.add('show');
    setTimeout(() => el.classList.remove('show'), ms);
  }

  function injectAccountPanel() {
    if ($('[data-tab="account"]')) return;
    const nav = $('.admin-nav');
    const main = $('.admin-main');
    if (!nav || !main) return;

    const button = document.createElement('button');
    button.type = 'button';
    button.dataset.tab = 'account';
    button.textContent = 'Cuenta';
    const contactButton = nav.querySelector('[data-tab="contact"]');
    if (contactButton) contactButton.insertAdjacentElement('afterend', button);
    else nav.appendChild(button);

    const section = document.createElement('section');
    section.dataset.panel = 'account';
    section.className = 'hidden';
    section.innerHTML = `
      <div class="admin-card">
        <h2>Cuenta del administrador</h2>
        <p style="color:var(--muted);margin-top:0">Cambiá el email o la contraseña que usás para ingresar al panel. Por seguridad, tenés que escribir tu contraseña actual antes de guardar cambios.</p>

        <div class="form-grid" style="margin-top:18px">
          <div class="field full">
            <label>Email actual</label>
            <input id="accountCurrentEmail" type="email" disabled>
          </div>
          <div class="field full">
            <label>Contraseña actual</label>
            <input id="accountCurrentPassword" type="password" autocomplete="current-password" placeholder="Necesaria para confirmar cambios">
          </div>
        </div>

        <div style="height:1px;background:var(--line);margin:24px 0"></div>
        <h3 style="margin:0 0 12px">Cambiar email</h3>
        <div class="form-grid">
          <div class="field full">
            <label>Nuevo email</label>
            <input id="accountNewEmail" type="email" autocomplete="email" placeholder="nuevo@email.com">
            <small style="display:block;color:var(--muted);margin-top:6px">El cambio se aplica directamente. La próxima vez ingresás con este nuevo email.</small>
          </div>
        </div>
        <div class="admin-actions"><button class="btn btn-dark" id="saveAccountEmail">Cambiar email</button></div>

        <div style="height:1px;background:var(--line);margin:24px 0"></div>
        <h3 style="margin:0 0 12px">Cambiar contraseña</h3>
        <div class="form-grid">
          <div class="field">
            <label>Nueva contraseña</label>
            <input id="accountNewPassword" type="password" autocomplete="new-password" minlength="8" placeholder="Mínimo 8 caracteres">
          </div>
          <div class="field">
            <label>Repetir nueva contraseña</label>
            <input id="accountConfirmPassword" type="password" autocomplete="new-password" minlength="8" placeholder="Repetí la contraseña">
          </div>
        </div>
        <div class="admin-actions"><button class="btn btn-dark" id="saveAccountPassword">Cambiar contraseña</button></div>
      </div>`;

    const dataSection = $('[data-panel="data"]');
    if (dataSection) dataSection.insertAdjacentElement('beforebegin', section);
    else main.appendChild(section);

    button.addEventListener('click', () => {
      $$('.admin-nav button').forEach(x => x.classList.remove('active'));
      button.classList.add('active');
      $$('[data-panel]').forEach(panel => panel.classList.add('hidden'));
      section.classList.remove('hidden');
      loadAccount();
    });

    $('#saveAccountEmail')?.addEventListener('click', changeEmail);
    $('#saveAccountPassword')?.addEventListener('click', changePassword);
  }

  async function getCurrentUser() {
    const { data, error } = await sb.auth.getUser();
    if (error) throw error;
    return data.user;
  }

  async function loadAccount() {
    try {
      const user = await getCurrentUser();
      if (!user) return;
      if ($('#accountCurrentEmail')) $('#accountCurrentEmail').value = user.email || '';
    } catch (error) {
      console.error('account load', error);
      toast('No se pudo cargar la cuenta');
    }
  }

  async function reauthenticate() {
    const user = await getCurrentUser();
    const password = $('#accountCurrentPassword')?.value || '';
    if (!user?.email) throw new Error('No se pudo identificar el email actual.');
    if (!password) throw new Error('Escribí tu contraseña actual.');
    const { error } = await sb.auth.signInWithPassword({ email: user.email, password });
    if (error) throw new Error('La contraseña actual no es correcta.');
    return user;
  }

  function setBusy(button, busy, normalText, busyText) {
    if (!button) return;
    button.disabled = busy;
    button.textContent = busy ? busyText : normalText;
  }

  async function changeEmail() {
    const button = $('#saveAccountEmail');
    const newEmail = String($('#accountNewEmail')?.value || '').trim().toLowerCase();
    const currentPassword = $('#accountCurrentPassword')?.value || '';
    if (!newEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newEmail)) return toast('Escribí un email válido.');

    setBusy(button, true, 'Cambiar email', 'Actualizando...');
    try {
      const user = await reauthenticate();
      if (String(user.email || '').toLowerCase() === newEmail) throw new Error('Ese ya es tu email actual.');

      const { data, error } = await sb.functions.invoke('valto-admin-account', {
        body: { action: 'change_email', email: newEmail }
      });
      if (error) throw new Error(data?.error || error.message || 'No se pudo cambiar el email.');
      if (!data?.ok) throw new Error(data?.error || 'No se pudo cambiar el email.');

      const { error: loginError } = await sb.auth.signInWithPassword({ email: newEmail, password: currentPassword });
      if (loginError) console.warn('El email se cambió, pero la sesión no pudo refrescarse automáticamente.', loginError);

      $('#accountCurrentPassword').value = '';
      $('#accountNewEmail').value = '';
      if ($('#accountCurrentEmail')) $('#accountCurrentEmail').value = data.email || newEmail;
      toast('Email actualizado. Desde ahora ingresás con el nuevo email.', 4200);
    } catch (error) {
      console.error('email update', error);
      toast(error?.message || 'No se pudo cambiar el email.', 4200);
    } finally {
      setBusy(button, false, 'Cambiar email', 'Actualizando...');
    }
  }

  async function changePassword() {
    const button = $('#saveAccountPassword');
    const password = $('#accountNewPassword')?.value || '';
    const confirm = $('#accountConfirmPassword')?.value || '';
    if (password.length < 8) return toast('La nueva contraseña debe tener al menos 8 caracteres.');
    if (password !== confirm) return toast('Las contraseñas nuevas no coinciden.');

    setBusy(button, true, 'Cambiar contraseña', 'Actualizando...');
    try {
      await reauthenticate();
      const { error } = await sb.auth.updateUser({ password });
      if (error) throw error;
      $('#accountCurrentPassword').value = '';
      $('#accountNewPassword').value = '';
      $('#accountConfirmPassword').value = '';
      toast('Contraseña actualizada correctamente.', 3800);
    } catch (error) {
      console.error('password update', error);
      toast(error?.message || 'No se pudo cambiar la contraseña.', 4200);
    } finally {
      setBusy(button, false, 'Cambiar contraseña', 'Actualizando...');
    }
  }

  injectAccountPanel();
  sb.auth.getSession().then(({ data }) => { if (data.session) loadAccount(); });
  sb.auth.onAuthStateChange((_event, session) => { if (session) setTimeout(loadAccount, 0); });
})();