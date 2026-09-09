const SUPABASE_URL = 'https://llqikrcqavwfbuajykig.supabase.co';

export default async function handler(req, res) {
    if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

    const secret = process.env.SUPABASE_SECRET_KEY;
    if (!secret) return res.status(500).json({ error: 'SUPABASE_SECRET_KEY 미설정' });

    const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/get_star_public_payload`, {
        method: 'POST',
        headers: {
            'apikey': secret,
            'Authorization': `Bearer ${secret}`,
            'Content-Type': 'application/json'
        },
        body: '{}'
    });

    const txt = await r.text();
    if (!r.ok) return res.status(r.status).json({ error: txt });

    let payload = { players: [], universities: [] };
    try { payload = JSON.parse(txt) || payload } catch { }

    // Public board changes infrequently. Serve from Vercel CDN for 60s,
    // while stale content can be served immediately during background revalidation.
    res.setHeader('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=300');
    return res.status(200).json(payload);
}
