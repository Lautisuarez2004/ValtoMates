declare const Netlify: { env: { get(name: string): string | undefined } };

function json(data: unknown, status = 200) {
  return Response.json(data, { status });
}

function cleanPostalCode(value: unknown) {
  return String(value ?? '').trim().toUpperCase().replace(/\s+/g, '').slice(0, 10);
}

function toInt(value: unknown, min: number, max: number, fallback: number) {
  const n = Math.round(Number(value));
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, n));
}

async function readJson(response: Response) {
  const text = await response.text();
  try { return text ? JSON.parse(text) : {}; }
  catch { return { message: text || `HTTP ${response.status}` }; }
}

async function getToken(baseUrl: string, apiUser: string, apiPassword: string) {
  const basic = btoa(`${apiUser}:${apiPassword}`);
  const response = await fetch(`${baseUrl}/token`, {
    method: 'POST',
    headers: { Authorization: `Basic ${basic}` }
  });
  const data = await readJson(response);
  if (!response.ok || !data?.token) {
    throw new Error(data?.message || `Correo Argentino rechazó las credenciales API (${response.status}).`);
  }
  return String(data.token);
}

async function resolveCustomerId(baseUrl: string, token: string) {
  const configured = String(Netlify.env.get('CORREO_CUSTOMER_ID') || '').trim();
  if (configured) return configured;

  const email = String(Netlify.env.get('CORREO_ACCOUNT_EMAIL') || '').trim();
  const password = String(Netlify.env.get('CORREO_ACCOUNT_PASSWORD') || '');
  if (!email || !password) {
    throw new Error('Falta CORREO_CUSTOMER_ID o, alternativamente, CORREO_ACCOUNT_EMAIL y CORREO_ACCOUNT_PASSWORD.');
  }

  const response = await fetch(`${baseUrl}/users/validate`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ email, password })
  });
  const data = await readJson(response);
  if (!response.ok || !data?.customerId) {
    throw new Error(data?.message || `No se pudo validar el usuario de MiCorreo (${response.status}).`);
  }
  return String(data.customerId);
}

async function getRate(baseUrl: string, token: string, body: Record<string, unknown>) {
  const response = await fetch(`${baseUrl}/rates`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  });
  const data = await readJson(response);
  if (!response.ok) {
    return { ok: false, status: response.status, error: data?.message || `HTTP ${response.status}`, rates: [] };
  }
  return { ok: true, status: response.status, rates: Array.isArray(data?.rates) ? data.rates : [], validTo: data?.validTo || null };
}

export default async (req: Request) => {
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  try {
    const apiUser = String(Netlify.env.get('CORREO_API_USERNAME') || '').trim();
    const apiPassword = String(Netlify.env.get('CORREO_API_PASSWORD') || '');
    const baseUrl = String(Netlify.env.get('CORREO_API_BASE_URL') || 'https://apitest.correoargentino.com.ar/micorreo/v1').replace(/\/+$/, '');

    if (!apiUser || !apiPassword) {
      return json({
        error: 'Faltan las credenciales API de Correo Argentino.',
        code: 'missing_api_credentials',
        requiredEnv: ['CORREO_API_USERNAME', 'CORREO_API_PASSWORD']
      }, 503);
    }

    const payload = await req.json();
    const postalCodeOrigin = cleanPostalCode(payload?.postalCodeOrigin);
    const postalCodeDestination = cleanPostalCode(payload?.postalCodeDestination);
    if (!/^[A-Z0-9]{4,8}$/.test(postalCodeOrigin) || !/^[A-Z0-9]{4,8}$/.test(postalCodeDestination)) {
      return json({ error: 'Ingresá códigos postales válidos para origen y destino.' }, 400);
    }

    const dimensions = {
      weight: toInt(payload?.weight, 1, 25000, 1000),
      height: toInt(payload?.height, 1, 150, 20),
      width: toInt(payload?.width, 1, 150, 20),
      length: toInt(payload?.length, 1, 150, 30)
    };

    const token = await getToken(baseUrl, apiUser, apiPassword);
    const customerId = await resolveCustomerId(baseUrl, token);

    const common = { customerId, postalCodeOrigin, postalCodeDestination, dimensions };
    const [home, branch] = await Promise.all([
      getRate(baseUrl, token, { ...common, deliveredType: 'D' }),
      getRate(baseUrl, token, { ...common, deliveredType: 'S' })
    ]);

    return json({
      environment: baseUrl.includes('apitest.') ? 'qa' : 'production',
      customerId,
      postalCodeOrigin,
      postalCodeDestination,
      dimensions,
      home,
      branch
    });
  } catch (error) {
    console.error('correo quote', error);
    return json({ error: error instanceof Error ? error.message : 'No se pudo cotizar con Correo Argentino.' }, 502);
  }
};

export const config = { path: '/api/correo-quote' };
