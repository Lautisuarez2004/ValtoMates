(() => {
  if (!document.querySelector('link[data-valto-v2]')) {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'v2.css';
    link.dataset.valtoV2 = 'true';
    document.head.appendChild(link);
  }
})();

window.VALTO_CATEGORY_ICONS = [
  {id:'sparkles',label:'Destacados',svg:'<svg viewBox="0 0 32 32" aria-hidden="true"><path d="M16 3l1.6 5.4L23 10l-5.4 1.6L16 17l-1.6-5.4L9 10l5.4-1.6L16 3Z"/><path d="M24 17l1.1 3.9L29 22l-3.9 1.1L24 27l-1.1-3.9L19 22l3.9-1.1L24 17Z"/><path d="M8 18l.9 3.1L12 22l-3.1.9L8 26l-.9-3.1L4 22l3.1-.9L8 18Z"/></svg>'},
  {id:'mate',label:'Mate',svg:'<svg viewBox="0 0 32 32" aria-hidden="true"><path d="M10 13h13l-1.5 10.5A5 5 0 0 1 16.6 28h-.2a5 5 0 0 1-4.9-4.5L10 13Z"/><path d="M8 13h17"/><path d="M20 13 25 4"/><path d="M24 5l2 1"/><path d="M13 17c2 1.3 5 1.3 7 0"/></svg>'},
  {id:'thermos',label:'Termo',svg:'<svg viewBox="0 0 32 32" aria-hidden="true"><path d="M12 6h8l1 4v15a3 3 0 0 1-3 3h-4a3 3 0 0 1-3-3V10l1-4Z"/><path d="M12 10h9"/><path d="M13 3h6v3h-6z"/><path d="M14 15h4"/></svg>'},
  {id:'bottle',label:'Hidratación',svg:'<svg viewBox="0 0 32 32" aria-hidden="true"><path d="M13 4h6v5l2 3v13a3 3 0 0 1-3 3h-4a3 3 0 0 1-3-3V12l2-3V4Z"/><path d="M13 8h6"/><path d="M11 17h10"/></svg>'},
  {id:'bag',label:'Matera / Bolso',svg:'<svg viewBox="0 0 32 32" aria-hidden="true"><path d="M6 12h20l-1 15H7L6 12Z"/><path d="M11 12V9a5 5 0 0 1 10 0v3"/><path d="M10 18h12"/></svg>'},
  {id:'bombilla',label:'Bombilla',svg:'<svg viewBox="0 0 32 32" aria-hidden="true"><path d="M10 27 22 6"/><path d="m21 6 3-2 2 1-1 4-3 1-1-4Z"/><path d="M8 27h4"/><path d="M17 14l2 1"/></svg>'},
  {id:'combo',label:'Combo',svg:'<svg viewBox="0 0 32 32" aria-hidden="true"><path d="M5 11h22v16H5z"/><path d="M16 11v16"/><path d="M4 8h24v5H4z"/><path d="M16 8c-4 0-6-1.5-6-3.5C10 2 14 3 16 8Z"/><path d="M16 8c4 0 6-1.5 6-3.5C22 2 18 3 16 8Z"/></svg>'},
  {id:'coffee',label:'Café',svg:'<svg viewBox="0 0 32 32" aria-hidden="true"><path d="M7 12h15v8a7 7 0 0 1-7 7h-1a7 7 0 0 1-7-7v-8Z"/><path d="M22 14h2a4 4 0 0 1 0 8h-3"/><path d="M11 8c0-2 2-2 2-4"/><path d="M16 8c0-2 2-2 2-4"/></svg>'},
  {id:'leaf',label:'Yerba / Natural',svg:'<svg viewBox="0 0 32 32" aria-hidden="true"><path d="M25 6C14 7 8 12 8 20c0 4 3 7 7 7 8 0 11-9 10-21Z"/><path d="M7 27c3-7 8-11 15-15"/></svg>'},
  {id:'gift',label:'Regalos',svg:'<svg viewBox="0 0 32 32" aria-hidden="true"><path d="M5 13h22v14H5z"/><path d="M4 9h24v5H4z"/><path d="M16 9v18"/><path d="M16 9c-4 0-6-1.5-6-3.5C10 3 14 4 16 9Z"/><path d="M16 9c4 0 6-1.5 6-3.5C22 3 18 4 16 9Z"/></svg>'},
  {id:'tag',label:'General',svg:'<svg viewBox="0 0 32 32" aria-hidden="true"><path d="m5 17 12-12h9v9L14 26 5 17Z"/><circle cx="22" cy="9" r="1.5"/></svg>'}
];
window.VALTO_ICON_MAP = Object.fromEntries(window.VALTO_CATEGORY_ICONS.map(x => [x.id,x]));

(() => {
  const s = document.createElement('script');
  s.src = 'payments.js';
  s.defer = true;
  document.head.appendChild(s);
})();
