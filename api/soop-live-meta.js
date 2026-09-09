const STATION = 'https://st.sooplive.com/api/get_station_status.php';

function toIsoKst(v) {
    const s = String(v || '').trim();
    if (!s) return '';
    if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(s)) {
        return s.replace(' ', 'T') + '+09:00';
    }
    return s;
}

export default async function handler(req, res) {
    if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

    const id = String(req.query?.id || '').trim();
    if (!id) return res.status(400).json({ error: 'id required' });

    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 2200);

    try {
        const r = await fetch(`${STATION}?szBjId=${encodeURIComponent(id)}`, { signal: ctrl.signal });
        if (!r.ok) return res.status(200).json({ started_at: '', title: '', viewer_count: 0 });

        const j = await r.json().catch(() => ({}));
        const o = j?.data || j || {};

        const viewerRaw =
            o.total_view_cnt ??
            o.viewer_cnt ??
            o.current_view_cnt ??
            o.view_cnt ??
            o.total_viewer ??
            0;

        const viewer_count = Number(String(viewerRaw).replace(/,/g, '')) || 0;

        res.setHeader('Cache-Control', 's-maxage=10, stale-while-revalidate=10');
        return res.status(200).json({
            started_at: toIsoKst(o.broad_start || o.BROAD_START || ''),
            title: String(o.station_title || o.title || '').trim(),
            viewer_count
        });
    } catch (_) {
        return res.status(200).json({ started_at: '', title: '', viewer_count: 0 });
    } finally {
        clearTimeout(timer);
    }
}
