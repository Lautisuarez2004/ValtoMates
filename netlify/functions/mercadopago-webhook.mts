declare const Netlify: { env: { get(name: string): string | undefined } };

const COMMERCE_URL = 'https://ptkzmshcfarerufnrrzq.supabase.co/functions/v1/valto-commerce';

export default async (req: Request) => {
  const accessToken = Netlify.env.get('MERCADOPAGO_ACCESS_TOKEN');
  if (!accessToken) return new Response('missing token', { status: 503 });

  try {
    const url = new URL(req.url);
    let body: any = {};
    if (req.method !== 'GET') body = await req.json().catch(() => ({}));

    const type = String(body?.type || body?.topic || url.searchParams.get('type') || url.searchParams.get('topic') || '');
    const paymentId = String(body?.data?.id || body?.id || url.searchParams.get('data.id') || url.searchParams.get('id') || '');

    if (type && type !== 'payment') return new Response('ignored', { status: 200 });
    if (!/^\d+$/.test(paymentId)) return new Response('ignored', { status: 200 });

    const sync = await fetch(COMMERCE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'sync_payment', accessToken, paymentId })
    });
    const text = await sync.text();
    if (!sync.ok) {
      console.error('Valto webhook sync failed', sync.status, text);
      return new Response('retry', { status: 500 });
    }
    return new Response('ok', { status: 200 });
  } catch (e) {
    console.error('Valto webhook error', e);
    return new Response('retry', { status: 500 });
  }
};

export const config = { path: '/api/mercadopago-webhook' };
