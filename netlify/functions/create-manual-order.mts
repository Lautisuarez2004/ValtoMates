declare const Netlify: { env: { get(name: string): string | undefined } };

const COMMERCE_URL='https://ptkzmshcfarerufnrrzq.supabase.co/functions/v1/valto-commerce';

export default async (req:Request)=>{
  if(req.method!=='POST')return new Response('Method not allowed',{status:405});
  const accessToken=Netlify.env.get('MERCADOPAGO_ACCESS_TOKEN');
  if(!accessToken)return Response.json({error:'La tienda todavía no está configurada para registrar pedidos.'},{status:503});
  try{
    const payload=await req.json();
    const orderId=crypto.randomUUID();
    const r=await fetch(COMMERCE_URL,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'register_manual_order',accessToken,orderId,items:payload?.items,checkout:payload?.checkout})});
    const data=await r.json().catch(()=>({}));
    if(!r.ok)return Response.json({error:data?.error||'No se pudo registrar el pedido.'},{status:r.status>=400&&r.status<500?r.status:502});
    return Response.json(data);
  }catch(e){
    console.error(e);
    return Response.json({error:e instanceof Error?e.message:'No se pudo registrar el pedido.'},{status:500});
  }
};

export const config={path:'/api/create-manual-order'};
