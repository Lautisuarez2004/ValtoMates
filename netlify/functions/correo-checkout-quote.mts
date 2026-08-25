declare const Netlify: { env: { get(name: string): string | undefined } };

const SUPABASE_URL = 'https://ptkzmshcfarerufnrrzq.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB0a3ptc2hjZmFyZXJ1Zm5ycnpxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY3NTU1NzAsImV4cCI6MjEwMjMzMTU3MH0.eKgLehO8wnV_Jt0vY-R0LQj51RNA7Te39BMHE2iHqxU';
const publicHeaders = { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` };

type CartItem = { productId: string; quantity: number };
type ProductRow = {
  id: string;
  name: string;
  visible: boolean;
  shipping_weight_g: number;
  shipping_length_cm: number;
  shipping_width_cm: number;
  shipping_height_cm: number;
};

function json(data: unknown, status = 200) {
  return Response.json(data, { status });
}

function cleanPostalCode(value: unknown) {
  return String(value ?? '').trim().toUpperCase().replace(/\s+/g, '').slice(0, 10);
}

function normalizeItems(payload: any): CartItem[] {
  const raw = Array.isArray(payload?.items) ? payload.items : [];
  if (!raw.length || raw.length > 20) throw new Error('Carrito inválido.');
  return raw.map((item: any) => {
    const productId = String(item?.productId || '').trim();
    const quantity = Number(item?.quantity || 0);
    if (!productId || !Number.isInteger(quantity) || quantity < 1 || quantity > 20) throw new Error('Producto o cantidad inválidos.');
    return { productId, quantity };
  });
}

async function getSettings() {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/valto_commerce_settings?id=eq.default&select=shipping_origin_postal_code,shipping_dynamic_quote_enabled`, {
    headers: publicHeaders,
    cache: 'no-store'
  });
  const rows = await response.json();
  if (!response.ok) throw new Error('No se pudo leer la configuración de envíos.');
  return Array.isArray(rows) && rows[0] ? rows[0] : {};
}

async function getProducts(ids: string[]): Promise<ProductRow[]> {
  const filter = ids.map(id => `"${id.replace(/"/g, '')}"`).join(',');
  const select = 'id,name,visible,shipping_weight_g,shipping_length_cm,shipping_width_cm,shipping_height_cm';
  const response = await fetch(`${SUPABASE_URL}/rest/v1/valto_products?id=in.(${encodeURIComponent(filter)})&select=${select}`, {
    headers: publicHeaders,
    cache: 'no-store'
  });
  const rows = await response.json();
  if (!response.ok) throw new Error('No se pudieron leer las medidas de los productos.');
  return Array.isArray(rows) ? rows : [];
}

function combinePackage(items: CartItem[], products: ProductRow[]) {
  const byId = new Map(products.map(product => [String(product.id), product]));
  const missing: string[] = [];
  let weight = 0;
  let totalVolume = 0;
  let longest = 0;
  let middle = 0;
  let shortest = 0;
  let totalUnits = 0;

  for (const item of items) {
    const product = byId.get(item.productId);
    if (!product || product.visible === false) {
      missing.push(item.productId);
      continue;
    }

    const productWeight = Number(product.shipping_weight_g || 0);
    const dims = [
      Number(product.shipping_length_cm || 0),
      Number(product.shipping_width_cm || 0),
      Number(product.shipping_height_cm || 0)
    ].sort((a, b) => b - a);

    if (productWeight <= 0 || dims.some(value => value <= 0)) {
      missing.push(product.name || product.id);
      continue;
    }

    const qty = item.quantity;
    totalUnits += qty;
    weight += productWeight * qty;
    totalVolume += dims[0] * dims[1] * dims[2] * qty;
    longest = Math.max(longest, dims[0]);
    middle = Math.max(middle, dims[1]);
    shortest = Math.max(shortest, dims[2]);
  }

  if (missing.length) return { ok: false as const, missing };
  if (weight > 25000) return { ok: false as const, tooLarge: true, reason: 'El carrito supera los 25 kg admitidos por esta cotización.' };

  if (totalUnits === 1) {
    return {
      ok: true as const,
      algorithm: 'single_exact',
      dimensions: {
        weight: Math.max(1, Math.round(weight)),
        length: Math.max(1, Math.ceil(longest)),
        width: Math.max(1, Math.ceil(middle)),
        height: Math.max(1, Math.ceil(shortest))
      }
    };
  }

  const paddedVolume = totalVolume * 1.12;
  let length = Math.max(1, Math.ceil(longest));
  let width = Math.max(1, Math.ceil(middle));
  let height = Math.max(Math.ceil(shortest), Math.ceil(paddedVolume / Math.max(1, length * width)));

  if (height > 150) {
    width = Math.min(150, Math.max(width, Math.ceil(Math.sqrt(paddedVolume / Math.max(1, length)))));
    height = Math.max(Math.ceil(shortest), Math.ceil(paddedVolume / Math.max(1, length * width)));
  }
  if (height > 150) {
    length = Math.min(150, Math.max(length, Math.ceil(Math.cbrt(paddedVolume))));
    width = Math.min(150, Math.max(width, Math.ceil(Math.sqrt(paddedVolume / Math.max(1, length)))));
    height = Math.max(Math.ceil(shortest), Math.ceil(paddedVolume / Math.max(1, length * width)));
  }

  if ([length, width, height].some(value => value > 150)) {
    return { ok: false as const, tooLarge: true, reason: 'El bulto combinado supera las medidas máximas de la cotización.' };
  }

  return {
    ok: true as const,
    algorithm: 'combined_estimate',
    dimensions: {
      weight: Math.max(1, Math.round(weight)),
      length,
      width,
      height
    }
  };
}

function pickRate(result: any) {
  if (!result?.ok || !Array.isArray(result.rates)) return null;
  const rates = result.rates
    .map((rate: any) => ({ ...rate, price: Number(rate?.price) }))
    .filter((rate: any) => Number.isFinite(rate.price) && rate.price >= 0)
    .sort((a: any, b: any) => a.price - b.price);
  return rates[0] || null;
}

export default async (req: Request) => {
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  try {
    const payload = await req.json();
    const items = normalizeItems(payload);
    const destination = cleanPostalCode(payload?.postalCodeDestination || payload?.postalCode);
    if (!/^[A-Z0-9]{4,8}$/.test(destination)) return json({ error: 'Ingresá un código postal válido.' }, 400);

    const settings = await getSettings();
    if (settings.shipping_dynamic_quote_enabled === false) {
      return json({ available: false, code: 'dynamic_quote_disabled' });
    }

    const origin = cleanPostalCode(settings.shipping_origin_postal_code || '1900');
    if (!/^[A-Z0-9]{4,8}$/.test(origin)) {
      return json({ available: false, code: 'invalid_origin_postal_code', error: 'El CP de origen de la tienda no es válido.' });
    }

    const ids = [...new Set(items.map(item => item.productId))];
    const products = await getProducts(ids);
    const combined = combinePackage(items, products);

    if (!combined.ok) {
      if ('missing' in combined) {
        return json({ available: false, code: 'missing_product_dimensions', missingProducts: combined.missing });
      }
      return json({ available: false, code: 'package_too_large', error: combined.reason || 'El paquete no puede cotizarse automáticamente.' });
    }

    const originUrl = new URL(req.url).origin;
    const quoteResponse = await fetch(`${originUrl}/api/correo-quote`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        postalCodeOrigin: origin,
        postalCodeDestination: destination,
        ...combined.dimensions
      })
    });
    const quote = await quoteResponse.json().catch(() => ({}));

    if (!quoteResponse.ok) {
      return json({
        available: false,
        code: quote?.code || 'correo_unavailable',
        error: quote?.error || 'Correo Argentino todavía no está disponible.'
      });
    }

    const home = pickRate(quote.home);
    const branch = pickRate(quote.branch);
    if (!home && !branch) {
      return json({ available: false, code: 'no_rates', error: 'Correo Argentino no devolvió tarifas para este destino.' });
    }

    return json({
      available: true,
      source: 'correo_argentino_api',
      environment: quote.environment,
      postalCodeOrigin: origin,
      postalCodeDestination: destination,
      package: { ...combined.dimensions, algorithm: combined.algorithm },
      home,
      branch
    });
  } catch (error) {
    console.error('correo checkout quote', error);
    return json({ available: false, code: 'quote_error', error: error instanceof Error ? error.message : 'No se pudo preparar la cotización.' });
  }
};

export const config = { path: '/api/correo-checkout-quote' };
