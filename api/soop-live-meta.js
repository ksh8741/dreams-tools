const STATION = 'https://st.sooplive.com/api/get_station_status.php';
const LIVE = 'https://live.sooplive.com/afreeca/player_live_api.php';

function toIsoKst(v) {
    const s = String(v || '').trim();
    if (!s) return '';
    if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(s)) {
        return s.replace(' ', 'T') + '+09:00';
    }
    return s;
}

function liveForm(id) {
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

export default async function handler(req, res) {
    if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

    const id = String(req.query?.id || '').trim();
    if (!id) return res.status(400).json({ error: 'id required' });

    const stationCtrl = new AbortController();
    const liveCtrl = new AbortController();
    const stationTimer = setTimeout(() => stationCtrl.abort(), 2200);
    const liveTimer = setTimeout(() => liveCtrl.abort(), 2200);

    try {
        const [stationResult, liveResult] = await Promise.allSettled([
            fetch(`${STATION}?szBjId=${encodeURIComponent(id)}`, {
                signal: stationCtrl.signal
            }),
            fetch(`${LIVE}?bjid=${encodeURIComponent(id)}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
                    'User-Agent': 'Mozilla/5.0',
                    'Referer': 'https://www.sooplive.co.kr/'
                },
                body: liveForm(id),
                signal: liveCtrl.signal
            })
        ]);

        let station = {};
        if (stationResult.status === 'fulfilled' && stationResult.value.ok) {
            const j = await stationResult.value.json().catch(() => ({}));

            // 실제 SOOP 응답은 DATA 대문자.
            station = j?.DATA || j?.data || j || {};
        }

        let channel = {};
        if (liveResult.status === 'fulfilled' && liveResult.value.ok) {
            const j = await liveResult.value.json().catch(() => ({}));
            channel = j?.CHANNEL || {};
        }

        // 현재 시청자 수는 player_live_api의 CHANNEL.CTUSER.
        const viewer_count = Number(channel.CTUSER || 0) || 0;

        res.setHeader('Cache-Control', 'no-store');
        return res.status(200).json({
            started_at: toIsoKst(station.broad_start || station.BROAD_START || ''),
            title: String(channel.TITLE || station.station_title || station.title || '').trim(),
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
        clearTimeout(liveTimer);
    }
}
