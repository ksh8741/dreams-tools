const SUPABASE_URL = 'https://llqikrcqavwfbuajykig.supabase.co';

const LIVE_ENDPOINTS = [
    'https://live.sooplive.com/afreeca/player_live_api.php',
    'https://live.sooplive.co.kr/afreeca/player_live_api.php'
];

const STATION = 'https://st.sooplive.com/api/get_station_status.php';

function formFor(id) {
    const p = new URLSearchParams();
    p.set('bid', id);
    p.set('type', 'live');
    p.set('pwd', '');
    p.set('player_type', 'html5');
    p.set('stream_type', 'common');
    p.set('quality', 'HD');
    p.set('mode', 'landing');
    p.set('from_api', '0');
    p.set('is_revive', 'false');
    return p.toString();
}

async function fetchJson(url, options = {}, timeout = 2400) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeout);
    try {
        const r = await fetch(url, { ...options, signal: ctrl.signal });
        if (!r.ok) return null;
        return await r.json().catch(() => null);
    } catch (_) {
        return null;
    } finally {
        clearTimeout(timer);
    }
}

async function liveRequest(id, base) {
    return fetchJson(`${base}?bjid=${encodeURIComponent(id)}`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
            'User-Agent': 'Mozilla/5.0',
            'Referer': 'https://www.sooplive.co.kr/'
        },
        body: formFor(id)
    }, 2400);
}

function toIsoKst(v) {
    const s = String(v || '').trim();
    if (!s) return null;
    if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(s)) {
        return s.replace(' ', 'T') + '+09:00';
    }
    const d = new Date(s);
    return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

async function stationMeta(id) {
    const j = await fetchJson(`${STATION}?szBjId=${encodeURIComponent(id)}`, {}, 2200);
    const o = j?.data || j || {};
    return {
        started_at: toIsoKst(o.broad_start || o.BROAD_START || ''),
        station_title: String(o.station_title || o.title || '').trim()
    };
}

async function checkOne(id) {
    let j = null;
    for (const base of LIVE_ENDPOINTS) {
        j = await liveRequest(id, base);
        if (j) break;
    }

    const ch = j?.CHANNEL || {};
    const bno = String(ch.BNO || '').trim();
    const isLive = Number(ch.RESULT) === 1 && !!bno;

    if (!isLive) {
        return {
            soop_user_id: id,
            is_live: false,
            broad_no: null,
            title: null,
            thumbnail: null,
            started_at: null,
            checked_at: new Date().toISOString()
        };
    }

    // Extra station call only for users who are actually LIVE.
    const meta = await stationMeta(id);
    const title = String(ch.TITLE || meta.station_title || '').trim() || null;

    return {
        soop_user_id: id,
        is_live: true,
        broad_no: bno,
        title,
        thumbnail: `https://liveimg.sooplive.co.kr/h/${encodeURIComponent(bno)}.webp`,
        started_at: meta.started_at,
        checked_at: new Date().toISOString()
    };
}

async function mapLimit(items, limit, worker) {
    const out = new Array(items.length);
    let idx = 0;
    const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
        while (true) {
            const i = idx++;
            if (i >= items.length) return;
            out[i] = await worker(items[i]);
        }
    });
    await Promise.all(runners);
    return out;
}

function authorized(req) {
    const secret = process.env.CRON_SECRET;
    if (!secret) return true; // works immediately even before CRON_SECRET is configured
    return req.headers.authorization === `Bearer ${secret}`;
}

export default async function handler(req, res) {
    if (req.method !== 'GET' && req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }
    if (!authorized(req)) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    const secret = process.env.SUPABASE_SECRET_KEY;
    if (!secret) return res.status(500).json({ error: 'SUPABASE_SECRET_KEY 미설정' });

    const H = {
        'apikey': secret,
        'Authorization': `Bearer ${secret}`,
        'Content-Type': 'application/json'
    };

    const pr = await fetch(
        `${SUPABASE_URL}/rest/v1/star_players?select=soop_user_id&enabled=eq.true&soop_user_id=not.is.null`,
        { headers: H }
    );
    const ptxt = await pr.text();
    if (!pr.ok) return res.status(pr.status).json({ error: ptxt });

    let players = [];
    try { players = JSON.parse(ptxt) } catch { }
    const ids = [...new Set(players.map(x => String(x.soop_user_id || '').trim()).filter(Boolean))];

    // 341-ish users: high concurrency is OK because this is server-side cron, not page load.
    const rows = await mapLimit(ids, 55, checkOne);

    // Upsert in manageable chunks.
    for (let i = 0; i < rows.length; i += 100) {
        const chunk = rows.slice(i, i + 100);
        const r = await fetch(
            `${SUPABASE_URL}/rest/v1/star_live_cache?on_conflict=soop_user_id`,
            {
                method: 'POST',
                headers: {
                    ...H,
                    'Prefer': 'resolution=merge-duplicates,return=minimal'
                },
                body: JSON.stringify(chunk)
            }
        );
        if (!r.ok) {
            return res.status(r.status).json({ error: `cache upsert failed: ${await r.text()}` });
        }
    }

    return res.status(200).json({
        ok: true,
        checked: rows.length,
        live: rows.filter(x => x.is_live).length,
        at: new Date().toISOString()
    });
}
