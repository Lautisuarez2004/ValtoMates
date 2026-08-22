(() => {
  const CPA_URL='https://www.correoargentino.com.ar/formularios/cpa';

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

  function run(root=document){injectStyles();polishVariants(root);addPostalHelp(root);}
  run();
  new MutationObserver(records=>records.forEach(r=>r.addedNodes.forEach(n=>{if(n.nodeType===1)run(n)}))).observe(document.body,{childList:true,subtree:true});
})();
