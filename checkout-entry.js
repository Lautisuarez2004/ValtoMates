(() => {
  if(!document.getElementById('checkoutEntryStyle')){
    const s=document.createElement('style');
    s.id='checkoutEntryStyle';
    s.textContent='.cart-checkout{background:var(--accent-dark)!important;border-color:var(--accent-dark)!important;color:#fff!important}';
    document.head.appendChild(s);
  }

  function wire(){
    const btn=document.getElementById('cartCheckout');
    if(!btn)return;
    if(btn.disabled) btn.disabled=false;
    if(btn.textContent!=='Finalizar compra') btn.textContent='Finalizar compra';
    if(btn.dataset.checkoutEntryReady==='1') return;
    btn.addEventListener('click',(e)=>{
      e.preventDefault();
      location.href='checkout.html';
    });
    btn.dataset.checkoutEntryReady='1';
  }

  wire();
  const target=document.getElementById('cartSummary');
  if(target){
    new MutationObserver(()=>wire()).observe(target,{childList:true,subtree:true});
  }
})();
