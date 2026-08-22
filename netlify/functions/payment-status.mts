declare const Netlify: { env: { get(name: string): string | undefined } };

export default async (req: Request) => {
  const accessToken = Netlify.env.get('MERCADOPAGO_ACCESS_TOKEN');
  if (!accessToken) return Response.json({ error: 'Mercado Pago no configurado.' }, { status: 503 });
  const id = new URL(req.url).searchParams.get('id') || '';
  if (!/^\d+$/.test(id)) return Response.json({ error: 'ID de pago inválido.' }, { status: 400 });
  const mp = await fetch(`https://api.mercadopago.com/v1/payments/${id}`, { headers: { Authorization: `Bearer ${accessToken}` } });
  const data = await mp.json();
  if (!mp.ok) return Response.json({ error: 'No se pudo verificar el pago.' }, { status: 502 });
  return Response.json({ status: data.status, statusDetail: data.status_detail, amount: data.transaction_amount, reference: data.external_reference });
};

export const config = { path: '/api/payment-status' };
