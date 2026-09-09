const SUPABASE_URL = 'https://llqikrcqavwfbuajykig.supabase.co';

export const config = {
  runtime: 'edge'
};

export default async function handler(request) {
  if (request.method !== 'GET') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json; charset=utf-8' }
    });
  }

  const secret = process.env.SUPABASE_SECRET_KEY;
  if (!secret) {
    return new Response(JSON.stringify({ error: 'SUPABASE_SECRET_KEY 미설정' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json; charset=utf-8' }
    });
  }

  try {
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

    if (!r.ok) {
      return new Response(JSON.stringify({ error: txt }), {
        status: r.status,
        headers: { 'Content-Type': 'application/json; charset=utf-8' }
      });
    }

    let payload = { players: [], universities: [] };
    try { payload = JSON.parse(txt) || payload } catch (_) {}

    return new Response(JSON.stringify(payload), {
      status: 200,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        // Browser: 60 sec. CDN: 5 min. Expired CDN data may be served
        // instantly for a day while Vercel refreshes it in background.
        'Cache-Control': 'public, max-age=60, s-maxage=300, stale-while-revalidate=86400'
      }
    });
  } catch (_) {
    return new Response(JSON.stringify({ players: [], universities: [] }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'public, max-age=15, s-maxage=60, stale-while-revalidate=3600'
      }
    });
  }
}
