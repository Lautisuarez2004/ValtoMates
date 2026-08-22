import { catalog } from './_shared/catalog.mts';
declare const Netlify: { env: { get(name: string): string | undefined } };

export default async (req: Request) => {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });
  const accessToken = Netlify.env.get('MERCADOPAGO_ACCESS_TOKEN');
  if (!accessToken) return Response.json({ error: 'Mercado Pago todavía no está configurado.' }, { status: 503 });

  try {
    const { productId, quantity = 1, variant = '' } = await req.json();
    const product = catalog[String(productId || '')];
    const qty = Number(quantity);
    if (!product || !Number.isInteger(qty) || qty < 1 || qty > 5) {
      return Response.json({ error: 'Producto o cantidad inválidos.' }, { status: 400 });
    }
    if (product.variants?.length && (!variant || !product.variants.includes(String(variant)))) {
      return Response.json({ error: 'Elegí una opción válida antes de pagar.' }, { status: 400 });
    }

    const origin = new URL(req.url).origin;
    const body = {
      items: [{
        id: product.id,
        title: variant ? `${product.title} - ${variant}` : product.title,
        quantity: qty,
        unit_price: product.price,
        currency_id: 'ARS'
      }],
      external_reference: `valto-${product.id}-${Date.now()}`,
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

    // La rama dev usa credenciales de prueba. Los tokens de prueba de Checkout Pro
    // también pueden empezar con APP_USR, por lo que no se deben detectar por prefijo.
    // Preferimos siempre el sandbox_init_point cuando Mercado Pago lo devuelve.
    const checkoutUrl = data.sandbox_init_point || data.init_point;
    if (!checkoutUrl) return Response.json({ error: 'Mercado Pago no devolvió una URL de checkout.' }, { status: 502 });

    return Response.json({ checkoutUrl });
  } catch {
    return Response.json({ error: 'No se pudo iniciar el pago.' }, { status: 500 });
  }
};

export const config = { path: '/api/create-preference' };
