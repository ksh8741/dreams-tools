const STATION = 'https://st.sooplive.com/api/get_station_status.php';
const SEARCH = 'https://sch.sooplive.co.kr/api.php';

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

    const stationCtrl = new AbortController();
    const searchCtrl = new AbortController();

    const stationTimer = setTimeout(() => stationCtrl.abort(), 2200);
    const searchTimer = setTimeout(() => searchCtrl.abort(), 2200);

    try {
        const searchUrl =
            `${SEARCH}?m=liveSearch&v=1.0&szOrder=score` +
            `&szSearchType=total&szKeyword=${encodeURIComponent(id)}` +
            `&nPageNo=1&nLimit=20`;

        const [stationResult, searchResult] = await Promise.allSettled([
            fetch(`${STATION}?szBjId=${encodeURIComponent(id)}`, {
                signal: stationCtrl.signal,
                headers: {
                    'User-Agent': 'Mozilla/5.0',
                    'Referer': 'https://www.sooplive.co.kr/'
                }
            }),
            fetch(searchUrl, {
                signal: searchCtrl.signal,
                headers: {
                    'User-Agent': 'Mozilla/5.0',
                    'Origin': 'https://www.sooplive.co.kr',
                    'Referer': 'https://www.sooplive.co.kr/'
                }
            })
        ]);

        let station = {};
        if (stationResult.status === 'fulfilled' && stationResult.value.ok) {
            const j = await stationResult.value.json().catch(() => ({}));
            // Actual response supplied by the user uses uppercase DATA.
            station = j?.DATA || j?.data || j || {};
        }

        let broad = {};
        if (searchResult.status === 'fulfilled' && searchResult.value.ok) {
            const j = await searchResult.value.json().catch(() => ({}));
            const list = Array.isArray(j?.REAL_BROAD) ? j.REAL_BROAD : [];
            broad = list.find(v => String(v?.user_id || '').toLowerCase() === id.toLowerCase()) || {};
        }

        // In liveSearch REAL_BROAD, total_view_cnt is the current live viewer count.
        const viewer_count =
            Number(String(broad.total_view_cnt ?? broad.view_cnt ?? '0').replace(/,/g, '')) || 0;

        res.setHeader('Cache-Control', 'no-store');

        return res.status(200).json({
            started_at: toIsoKst(
                station.broad_start ||
                station.BROAD_START ||
                broad.broad_start ||
                ''
            ),
            title: String(
                broad.broad_title ||
                station.station_title ||
                station.title ||
                ''
            ).trim(),
            viewer_count
        });
    } catch (_) {
        return res.status(200).json({
            started_at: '',
            title: '',
            viewer_count: 0
        });
    } finally {
        clearTimeout(stationTimer);
        clearTimeout(searchTimer);
    }
}
