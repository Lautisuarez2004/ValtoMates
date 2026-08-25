declare const Netlify: { env: { get(name: string): string | undefined } };

const COMMERCE_URL='https://ptkzmshcfarerufnrrzq.supabase.co/functions/v1/valto-commerce';

async function getDynamicShippingQuote(req:Request,items:any[],checkout:any){
  const method=String(checkout?.shippingMethod||'');
  if(!['correo_sucursal','correo_domicilio'].includes(method))return null;
  const postalCode=String(checkout?.postalCode||'').trim().toUpperCase().replace(/\s+/g,'');
  if(!/^[A-Z0-9]{4,8}$/.test(postalCode))return null;
  try{
    const origin=new URL(req.url).origin;
    const response=await fetch(`${origin}/api/correo-checkout-quote`,{
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({items:(Array.isArray(items)?items:[]).map(item=>({productId:item?.productId,quantity:Number(item?.quantity||1)})),postalCodeDestination:postalCode})
    });
    const data=await response.json().catch(()=>({}));
    if(!response.ok||!data?.available)return null;
    const rate=method==='correo_sucursal'?data.branch:data.home;
    const cost=Number(rate?.price);
    if(!Number.isFinite(cost)||cost<0)return null;
    return {cost,source:String(data.source||'correo_argentino_api')};
  }catch(error){
    console.error('Dynamic Correo quote unavailable',error);
    return null;
  }
}

export default async (req:Request)=>{
  if(req.method!=='POST')return new Response('Method not allowed',{status:405});
  const accessToken=Netlify.env.get('MERCADOPAGO_ACCESS_TOKEN');
  if(!accessToken)return Response.json({error:'La tienda todavía no está configurada para registrar pedidos.'},{status:503});
  try{
    const payload=await req.json();
    const orderId=crypto.randomUUID();
    const items=Array.isArray(payload?.items)?payload.items:[];
    const checkout=payload?.checkout&&typeof payload.checkout==='object'?payload.checkout:{};
    const dynamicQuote=await getDynamicShippingQuote(req,items,checkout);
    const r=await fetch(COMMERCE_URL,{
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({
        action:'register_manual_order',
        accessToken,
        orderId,
        items,
        checkout,
        shippingCostOverride:dynamicQuote?.cost??null,
        shippingQuoteSource:dynamicQuote?.source||'manual_fallback'
      })
    });
    const data=await r.json().catch(()=>({}));
    if(!r.ok)return Response.json({error:data?.error||'No se pudo registrar el pedido.'},{status:r.status>=400&&r.status<500?r.status:502});
    return Response.json({...data,shippingQuoteSource:dynamicQuote?.source||'manual_fallback'});
  }catch(e){
    console.error(e);
    return Response.json({error:e instanceof Error?e.message:'No se pudo registrar el pedido.'},{status:500});
  }
};

export const config={path:'/api/create-manual-order'};
