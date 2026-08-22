(() => {
  const CPA_URL='https://www.correoargentino.com.ar/formularios/cpa';
  const whatsappSvg = (cls='wa-svg') => `<svg class="${cls}" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path fill="currentColor" d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.009-.371-.011-.57-.011-.198 0-.52.074-.792.371-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.095 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.57-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.981.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.885 9.888-9.885 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.055 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.14 1.588 5.945L.056 24l6.3-1.652a11.86 11.86 0 0 0 5.694 1.448h.005c6.557 0 11.892-5.335 11.895-11.893a11.821 11.821 0 0 0-3.486-8.413Z"/></svg>`;

  function injectStyles(){
    if(document.getElementById('commercePolishStyles')) return;
    const s=document.createElement('style');
    s.id='commercePolishStyles';
    s.textContent=`
      .variant-pills{display:flex;flex-wrap:wrap;gap:8px;margin-top:2px}
      .variant-pill{border:1px solid rgba(74,75,55,.55);background:transparent;color:var(--accent-dark);border-radius:12px;padding:10px 14px;font:inherit;font-size:13px;font-weight:700;cursor:pointer;transition:.16s ease}
      .variant-pill:hover{background:rgba(74,75,55,.08)}
      .variant-pill.active{background:var(--accent);color:#fff;border-color:var(--accent)}
      .postal-help-link{display:inline-block;margin-top:7px;font-size:12px;color:var(--accent);text-decoration:underline;text-underline-offset:3px}
      .quick-cart:not(:disabled){font-size:0}
      .quick-cart:not(:disabled)::after{content:'Agregar al carrito';font-size:13px;font-weight:700;line-height:1.2}
      .wa-mini{display:none!important}
      .product-actions{grid-template-columns:1fr!important}
      #headerWa{background:var(--paper);border-color:var(--line);color:#25D366;padding:0;overflow:visible}
      #headerWa:hover{background:var(--paper);color:#20bd5a}
      .wa-svg{display:block;width:22px;height:22px;overflow:visible;flex:0 0 auto}
      #headerWa .wa-svg{width:23px;height:23px}
      #floatingWa .wa-svg{width:29px;height:29px}
      #modalWa .wa-svg,#footerWa .wa-svg{width:19px;height:19px}
      #modalWa,#footerWa{display:inline-flex;align-items:center;justify-content:center;gap:9px}
      @media(max-width:600px){.variant-pill{padding:10px 13px;flex:0 0 auto}.variant-pills{gap:7px}}
    `;
    document.head.appendChild(s);
  }

  function polishVariants(root=document){
    root.querySelectorAll?.('.variant-selector').forEach(box=>{
      if(box.dataset.pillsReady==='1') return;
      const select=box.querySelector('select#purchaseVariant');
      if(!select) return;
      box.dataset.pillsReady='1';
      select.style.display='none';
      const pills=document.createElement('div');
      pills.className='variant-pills';
      [...select.options].filter(o=>o.value).forEach(opt=>{
        const b=document.createElement('button');
        b.type='button';
        b.className='variant-pill'+(select.value===opt.value?' active':'');
        b.textContent=opt.textContent;
        b.onclick=()=>{
          select.value=opt.value;
          select.dispatchEvent(new Event('change',{bubbles:true}));
          pills.querySelectorAll('.variant-pill').forEach(x=>x.classList.toggle('active',x===b));
        };
        pills.appendChild(b);
      });
      select.insertAdjacentElement('afterend',pills);
    });
  }

  function addPostalHelp(root=document){
    root.querySelectorAll?.('.shipping-box').forEach(box=>{
      if(box.querySelector('.postal-help-link')) return;
      const result=box.querySelector('.shipping-result');
      if(!result) return;
      const a=document.createElement('a');
      a.className='postal-help-link';
      a.href=CPA_URL;
      a.target='_blank';
      a.rel='noopener';
      a.textContent='No sé mi código postal';
      result.insertAdjacentElement('afterend',a);
    });
  }

  function polishWhatsApp(){
    document.querySelectorAll('.wa-mini').forEach(el=>el.remove());

    ['headerWa','floatingWa'].forEach(id=>{
      const el=document.getElementById(id);
      if(!el) return;
      if(!el.querySelector('.wa-svg')) el.innerHTML=whatsappSvg();
      el.dataset.waIconReady='1';
    });

    [['modalWa','Consultar por WhatsApp'],['footerWa','WhatsApp']].forEach(([id,label])=>{
      const el=document.getElementById(id);
      if(!el) return;
      if(!el.querySelector('.wa-svg')) el.innerHTML=`${whatsappSvg()}<span>${label}</span>`;
      el.dataset.waIconReady='1';
    });
  }

  function run(root=document){injectStyles();polishVariants(root);addPostalHelp(root);polishWhatsApp();}
  run();
  new MutationObserver(records=>records.forEach(r=>r.addedNodes.forEach(n=>{if(n.nodeType===1)run(n)}))).observe(document.body,{childList:true,subtree:true});
})();
