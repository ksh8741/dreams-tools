const SUPABASE_URL = 'https://llqikrcqavwfbuajykig.supabase.co';

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const secret = process.env.SUPABASE_SECRET_KEY;
  if (!secret) return res.status(500).json({ error: 'SUPABASE_SECRET_KEY 미설정' });

  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/get_star_public_payload`, {
      method: 'POST',
      headers: {
        apikey: secret,
        Authorization: `Bearer ${secret}`,
        'Content-Type': 'application/json'
      },
      body: '{}'
    });

    if (!r.ok) return res.status(r.status).send(await r.text());

    const payload = await r.json();
    res.setHeader('Cache-Control', 'public, max-age=15, s-maxage=60, stale-while-revalidate=300');
    return res.status(200).json(payload || { players: [], universities: [] });
  } catch (e) {
    return res.status(200).json({ players: [], universities: [] });
  }
}
