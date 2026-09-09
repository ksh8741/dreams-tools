const SUPABASE_URL = 'https://llqikrcqavwfbuajykig.supabase.co';
const LIVE = 'https://live.sooplive.com/afreeca/player_live_api.php';
const FALLBACK = 'https://live.sooplive.co.kr/afreeca/player_live_api.php';
const STATION = 'https://st.sooplive.com/api/get_station_status.php';
const SEARCH = 'https://sch.sooplive.co.kr/api.php';

export const maxDuration = 300;

function formFor(id) {
  const p = new URLSearchParams();
  p.set('bid', id); p.set('type', 'live'); p.set('pwd', '');
  p.set('player_type', 'html5'); p.set('stream_type', 'common');
  p.set('quality', 'HD'); p.set('mode', 'landing');
  p.set('from_api', '0'); p.set('is_revive', 'false');
  return p.toString();
}

async function fetchJson(url, options = {}, timeout = 3500) {
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

async function liveCheck(id) {
  const options = {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
      'User-Agent': 'Mozilla/5.0',
      Referer: 'https://www.sooplive.co.kr/'
    },
    body: formFor(id)
  };

  let j = await fetchJson(`${LIVE}?bjid=${encodeURIComponent(id)}`, options);
  if (!j) j = await fetchJson(`${FALLBACK}?bjid=${encodeURIComponent(id)}`, options);

  const ch = j?.CHANNEL || {};
  const bno = String(ch.BNO || '').trim();
  const live = Number(ch.RESULT) === 1 && !!bno;

  return {
    live,
    bno: live ? bno : '',
    title: live ? String(ch.TITLE || '').trim() : '',
    thumbnail: live ? `https://liveimg.sooplive.co.kr/h/${encodeURIComponent(bno)}.webp` : ''
  };
}

function toIsoKst(v) {
  const s = String(v || '').trim();
  if (!s) return null;
  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(s)) {
    return s.replace(' ', 'T') + '+09:00';
  }
  return s;
}

async function liveMeta(id, base) {
  if (!base.live) return { ...base, started_at: null, viewer_count: 0 };

  const searchUrl =
    `${SEARCH}?m=liveSearch&v=1.0&szOrder=score` +
    `&szSearchType=total&szKeyword=${encodeURIComponent(id)}` +
    `&nPageNo=1&nLimit=20`;

  const [station, search] = await Promise.all([
    fetchJson(`${STATION}?szBjId=${encodeURIComponent(id)}`, {
      headers: { 'User-Agent': 'Mozilla/5.0', Referer: 'https://www.sooplive.co.kr/' }
    }),
    fetchJson(searchUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0',
        Origin: 'https://www.sooplive.co.kr',
        Referer: 'https://www.sooplive.co.kr/'
      }
    })
  ]);

  const st = station?.DATA || station?.data || station || {};
  const list = Array.isArray(search?.REAL_BROAD) ? search.REAL_BROAD : [];
  const broad = list.find(v => String(v?.user_id || '').toLowerCase() === id.toLowerCase()) || {};

  const viewer_count =
    Number(String(broad.total_view_cnt ?? broad.view_cnt ?? '0').replace(/,/g, '')) || 0;

  return {
    ...base,
    title: String(broad.broad_title || st.station_title || base.title || '').trim(),
    started_at: toIsoKst(st.broad_start || st.BROAD_START || broad.broad_start || ''),
    viewer_count
  };
}

async function mapLimit(items, limit, worker) {
  const out = new Array(items.length);
  let cursor = 0;
  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (true) {
      const i = cursor++;
      if (i >= items.length) return;
      out[i] = await worker(items[i], i);
    }
  });
  await Promise.all(runners);
  return out;
}

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && req.headers.authorization !== `Bearer ${cronSecret}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const secret = process.env.SUPABASE_SECRET_KEY;
  if (!secret) return res.status(500).json({ error: 'SUPABASE_SECRET_KEY 미설정' });

  try {
    const p = await fetch(
      `${SUPABASE_URL}/rest/v1/star_players?select=soop_user_id&enabled=eq.true&soop_user_id=not.is.null`,
      { headers: { apikey: secret, Authorization: `Bearer ${secret}` } }
    );
    if (!p.ok) return res.status(p.status).send(await p.text());

    const raw = await p.json();
    const ids = [...new Set(raw.map(x => String(x.soop_user_id || '').trim()).filter(Boolean))];

    const base = await mapLimit(ids, 20, liveCheck);
    const values = await mapLimit(ids, 12, (id, i) => liveMeta(id, base[i] || { live: false }));

    const checked_at = new Date().toISOString();
    const rows = ids.map((id, i) => {
      const v = values[i] || { live: false };
      return {
        soop_user_id: id,
        is_live: !!v.live,
        broad_no: v.bno || null,
        title: v.title || null,
        thumbnail: v.thumbnail || null,
        started_at: v.started_at || null,
        viewer_count: Number(v.viewer_count || 0),
        checked_at
      };
    });

    if (rows.length) {
      const w = await fetch(`${SUPABASE_URL}/rest/v1/star_live_cache?on_conflict=soop_user_id`, {
        method: 'POST',
        headers: {
          apikey: secret,
          Authorization: `Bearer ${secret}`,
          'Content-Type': 'application/json',
          Prefer: 'resolution=merge-duplicates,return=minimal'
        },
        body: JSON.stringify(rows)
      });
      if (!w.ok) return res.status(w.status).send(await w.text());
    }

    return res.status(200).json({
      ok: true,
      checked: ids.length,
      live: values.filter(v => v?.live).length,
      checked_at
    });
  } catch (e) {
    return res.status(500).json({ error: String(e?.message || e) });
  }
}
