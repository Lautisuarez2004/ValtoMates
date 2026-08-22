declare const Netlify: { env: { get(name: string): string | undefined } };

const SUPABASE_URL = 'https://ptkzmshcfarerufnrrzq.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB0a3ptc2hjZmFyZXJ1Zm5ycnpxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY3NTU1NzAsImV4cCI6MjEwMjMzMTU3MH0.eKgLehO8wnV_Jt0vY-R0LQj51RNA7Te39BMHE2iHqxU';
const COMMERCE_URL = `${SUPABASE_URL}/functions/v1/valto-commerce`;
const publicHeaders = { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` };

type RequestedItem = { productId: string; quantity: number; variant: string };

async function getProduct(productId: string) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/valto_products?id=eq.${encodeURIComponent(productId)}&visible=eq.true&select=*`, {
    headers: publicHeaders,
    cache: 'no-store'
  });
  const rows = await r.json();
  if (!r.ok) throw new Error('No se pudo consultar el stock.');
  return Array.isArray(rows) ? rows[0] : null;
}

async function getCommerceSettings() {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/valto_commerce_settings?id=eq.default&select=*`, {
    headers: publicHeaders,
    cache: 'no-store'
  });
  const rows = await r.json();
  if (!r.ok) throw new Error('No se pudo consultar la configuración comercial.');
  return Array.isArray(rows) && rows[0] ? rows[0] : {
    installments_count: 3,
    shipping_enabled: true,
    shipping_base_cost: 0,
    shipping_free_from: 0
  };
}

function normalizePostalCode(value: unknown) {
  return String(value || '').toUpperCase().replace(/\s+/g, '').trim();
}

function normalizeItems(payload: any): RequestedItem[] {
  const raw = Array.isArray(payload?.items) && payload.items.length
    ? payload.items
    : [{ productId: payload?.productId, quantity: payload?.quantity ?? 1, variant: payload?.variant ?? '' }];

  if (!raw.length || raw.length > 20) throw new Error('Carrito inválido.');
  return raw.map((item: any) => ({
    productId: String(item?.productId || ''),
    quantity: Number(item?.quantity ?? 1),
    variant: String(item?.variant || '').trim()
  }));
}

export default async (req: Request) => {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });
  const accessToken = Netlify.env.get('MERCADOPAGO_ACCESS_TOKEN');
  if (!accessToken) return Response.json({ error: 'Mercado Pago todavía no está configurado.' }, { status: 503 });

  try {
    const payload = await req.json();
    const requested = normalizeItems(payload);
    const postalCode = normalizePostalCode(payload?.postalCode);
    const settings = await getCommerceSettings();
    const shippingEnabled = settings.shipping_enabled !== false;

    if (shippingEnabled && !/^[A-Z0-9]{4,8}$/.test(postalCode)) {
      return Response.json({ error: 'Ingresá un código postal válido antes de pagar.' }, { status: 400 });
    }

    const mpItems: any[] = [];
    let subtotal = 0;

    for (const item of requested) {
      const qty = item.quantity;
      if (!item.productId || !Number.isInteger(qty) || qty < 1 || qty > 20) {
        return Response.json({ error: 'Producto o cantidad inválidos.' }, { status: 400 });
      }

      const product = await getProduct(item.productId);
      if (!product) return Response.json({ error: 'Uno de los productos ya no está disponible.' }, { status: 404 });
      if (Number(product.stock) < qty) return Response.json({ error: `No hay stock suficiente de ${product.name}.` }, { status: 409 });

      const allowedVariants = Array.isArray(product.variants) ? product.variants.filter((v: string) => v && !/^consultar/i.test(v)) : [];
      if (allowedVariants.length && (!item.variant || !allowedVariants.includes(item.variant))) {
        return Response.json({ error: `Elegí una opción válida para ${product.name}.` }, { status: 400 });
      }

      const unitPrice = Number(product.price);
      subtotal += unitPrice * qty;
      mpItems.push({
        id: `${product.id}::${item.variant}`,
        title: item.variant ? `${product.name} - ${item.variant}` : product.name,
        quantity: qty,
        unit_price: unitPrice,
        currency_id: 'ARS'
      });
    }

    const freeFrom = Math.max(0, Number(settings.shipping_free_from || 0));
    const baseShipping = Math.max(0, Number(settings.shipping_base_cost || 0));
    const shippingCost = shippingEnabled ? (freeFrom > 0 && subtotal >= freeFrom ? 0 : baseShipping) : 0;
    const installments = Math.min(24, Math.max(1, Math.floor(Number(settings.installments_count || 3))));
    const origin = new URL(req.url).origin;
    const orderId = crypto.randomUUID();

    const preference: any = {
      items: mpItems,
      external_reference: orderId,
      metadata: { source: 'valto', valto_order_id: orderId, postal_code: postalCode },
      notification_url: `${origin}/api/mercadopago-webhook`,
      back_urls: {
        success: `${origin}/?payment=success`,
        pending: `${origin}/?payment=pending`,
        failure: `${origin}/?payment=failure`
      },
      auto_return: 'approved',
      payment_methods: { installments },
      statement_descriptor: 'VALTO MATES'
    };

    if (shippingEnabled) preference.shipments = { cost: shippingCost, mode: 'not_specified' };

    const mp = await fetch('https://api.mercadopago.com/checkout/preferences', {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(preference)
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

    const host = new URL(req.url).hostname;
    const isDev = host.startsWith('dev--') || host.includes('localhost');
    const checkoutUrl = isDev ? (data.sandbox_init_point || data.init_point) : data.init_point;
    if (!checkoutUrl) return Response.json({ error: 'Mercado Pago no devolvió una URL de checkout.' }, { status: 502 });
    return Response.json({ checkoutUrl, orderId, subtotal, shippingCost, total: subtotal + shippingCost });
  } catch (e) {
    console.error(e);
    return Response.json({ error: e instanceof Error ? e.message : 'No se pudo iniciar el pago.' }, { status: 500 });
  }
};

export const config = { path: '/api/create-preference' };
