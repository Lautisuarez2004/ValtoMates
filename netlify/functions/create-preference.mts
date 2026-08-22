declare const Netlify: { env: { get(name: string): string | undefined } };

const SUPABASE_URL = 'https://ptkzmshcfarerufnrrzq.supabase.co';
const SUPABASE_KEY = 'sb_publishable__rY7nJoJv0Nd6QCDFafIog_t2dfQ6sl';
const COMMERCE_URL = `${SUPABASE_URL}/functions/v1/valto-commerce`;

async function getProduct(productId: string) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/valto_products?id=eq.${encodeURIComponent(productId)}&visible=eq.true&select=*`, {
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` }
  });
  const rows = await r.json();
  if (!r.ok) throw new Error('No se pudo consultar el stock.');
  return Array.isArray(rows) ? rows[0] : null;
}

export default async (req: Request) => {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });
  const accessToken = Netlify.env.get('MERCADOPAGO_ACCESS_TOKEN');
  if (!accessToken) return Response.json({ error: 'Mercado Pago todavía no está configurado.' }, { status: 503 });

  try {
    const { productId, quantity = 1, variant = '' } = await req.json();
    const qty = Number(quantity);
    if (!productId || !Number.isInteger(qty) || qty < 1 || qty > 5) {
      return Response.json({ error: 'Producto o cantidad inválidos.' }, { status: 400 });
    }

    const product = await getProduct(String(productId));
    if (!product) return Response.json({ error: 'Producto no disponible.' }, { status: 404 });
    if (Number(product.stock) < qty) return Response.json({ error: 'No hay stock suficiente para completar la compra.' }, { status: 409 });

    const allowedVariants = Array.isArray(product.variants) ? product.variants.filter((v: string) => v && !/^consultar/i.test(v)) : [];
    if (allowedVariants.length && (!variant || !allowedVariants.includes(String(variant)))) {
      return Response.json({ error: 'Elegí una opción válida antes de pagar.' }, { status: 400 });
    }

    const origin = new URL(req.url).origin;
    const orderId = crypto.randomUUID();
    const unitPrice = Number(product.price);
    const body = {
      items: [{ id: product.id, title: variant ? `${product.name} - ${variant}` : product.name, quantity: qty, unit_price: unitPrice, currency_id: 'ARS' }],
      external_reference: orderId,
      metadata: { source: 'valto', valto_order_id: orderId, product_id: product.id, variant: String(variant || '') },
      notification_url: `${origin}/api/mercadopago-webhook`,
      back_urls: {
        success: `${origin}/?payment=success`,
        pending: `${origin}/?payment=pending`,
        failure: `${origin}/?payment=failure`
      },
      auto_return: 'approved',
      payment_methods: { installments: 12 },
      statement_descriptor: 'VALTO MATES'
    };

    const mp = await fetch('https://api.mercadopago.com/checkout/preferences', {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    const data = await mp.json();
    if (!mp.ok) return Response.json({ error: data?.message || 'No se pudo iniciar el pago.' }, { status: 502 });

    const reg = await fetch(COMMERCE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'register_preference', accessToken, preferenceId: data.id, orderId })
    });
    const regData = await reg.json().catch(() => ({}));
    if (!reg.ok) {
      console.error('Valto order registration failed', regData);
      return Response.json({ error: 'No se pudo registrar la orden. Intentá nuevamente.' }, { status: 502 });
    }

    const isDev = new URL(req.url).hostname.startsWith('dev--') || new URL(req.url).hostname.includes('localhost');
    const checkoutUrl = isDev ? (data.sandbox_init_point || data.init_point) : data.init_point;
    if (!checkoutUrl) return Response.json({ error: 'Mercado Pago no devolvió una URL de checkout.' }, { status: 502 });
    return Response.json({ checkoutUrl, orderId });
  } catch (e) {
    console.error(e);
    return Response.json({ error: e instanceof Error ? e.message : 'No se pudo iniciar el pago.' }, { status: 500 });
  }
};

export const config = { path: '/api/create-preference' };
