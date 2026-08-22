(() => {
  function wire(){
    const btn=document.getElementById('cartCheckout');
    if(!btn)return;
    btn.disabled=false;
    btn.textContent='Finalizar compra';
    btn.style.background='var(--accent-dark)';
    btn.style.borderColor='var(--accent-dark)';
    btn.onclick=(e)=>{e.preventDefault();location.href='checkout.html';};
  }
  wire();
  const target=document.getElementById('cartSummary');
  if(target)new MutationObserver(wire).observe(target,{childList:true,subtree:true});
})();
