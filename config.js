window.VALTO_CONFIG = {
  supabaseUrl: "https://ptkzmshcfarerufnrrzq.supabase.co",
  supabaseAnonKey: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB0a3ptc2hjZmFyZXJ1Zm5ycnpxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY3NTU1NzAsImV4cCI6MjEwMjMzMTU3MH0.eKgLehO8wnV_Jt0vY-R0LQj51RNA7Te39BMHE2iHqxU",
  whatsappNumber: "",
  instagramUrl: "",
  tiktokUrl: "",
  email: "valtomateslp@gmail.com"
};

window.addEventListener('DOMContentLoaded', () => {
  const load = (src, attr) => {
    if (document.querySelector(`script[${attr}]`)) return;
    const s = document.createElement('script');
    s.src = src;
    s.async = false;
    s.setAttribute(attr, '1');
    document.body.appendChild(s);
  };

  if (/\/admin\.html$/.test(location.pathname)) {
    load('admin-live.js', 'data-admin-live');
    load('admin-commerce.js', 'data-admin-commerce');
    load('admin-image-editor.js', 'data-admin-image-editor');
    load('admin-contact.js', 'data-admin-contact');
  } else {
    load('contact-settings.js', 'data-contact-settings');
    load('commerce-polish.js', 'data-commerce-polish');
    load('product-image-framing.js', 'data-product-image-framing');
  }
});
