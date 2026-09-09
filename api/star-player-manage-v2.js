const SUPABASE_URL = 'https://llqikrcqavwfbuajykig.supabase.co';

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { password, action, id, data = {} } = req.body || {};

    if (
        String(password) !==
        String(process.env.STAR_ADMIN_PASSWORD || '')
    ) {
        return res.status(401).json({
            error: '관리자 비밀번호가 틀렸습니다.'
        });
    }

    const secret = process.env.SUPABASE_SECRET_KEY;

    if (!secret) {
        return res.status(500).json({
            error: 'SUPABASE_SECRET_KEY 미설정'
        });
    }

    const H = {
        apikey: secret,
        Authorization: `Bearer ${secret}`,
        'Content-Type': 'application/json'
    };

    // =========================================================
    // 대학 관리
    // =========================================================

    if (action === 'university_create') {
        const name = String(data.name || '').trim();
        const logo_url = String(data.logo_url || '').trim();

        if (!name) {
            return res.status(400).json({
                error: '대학 이름을 입력해.'
            });
        }

        /*
         * 동일한 이름의 대학 검색
         *
         * 대학 삭제는 실제 행 삭제가 아니라 enabled=false로 처리되므로
         * 같은 이름의 비활성 대학이 있으면 새로 INSERT하지 않고 복구한다.
         */
        const existingResponse = await fetch(
            `${SUPABASE_URL}/rest/v1/star_universities` +
            `?name=eq.${encodeURIComponent(name)}` +
            `&select=*` +
            `&limit=1`,
            {
                method: 'GET',
                headers: H
            }
        );

        if (!existingResponse.ok) {
            return res.status(existingResponse.status).json({
                error: `기존 대학 확인 실패: ${await existingResponse.text()}`
            });
        }

        let existingRows = [];

        try {
            existingRows = await existingResponse.json();
        } catch {
            existingRows = [];
        }

        const existingUniversity = existingRows?.[0];

        // 이미 활성화된 동일 이름 대학이 존재하는 경우
        if (existingUniversity?.enabled) {
            return res.status(409).json({
                error: `"${name}" 대학은 이미 등록되어 있습니다.`
            });
        }

        // 현재 가장 큰 정렬 순서 확인
        const sortResponse = await fetch(
            `${SUPABASE_URL}/rest/v1/star_universities` +
            `?select=sort_order` +
            `&order=sort_order.desc` +
            `&limit=1`,
            {
                method: 'GET',
                headers: H
            }
        );

        let maxSortOrder = 0;

        if (sortResponse.ok) {
            try {
                const sortRows = await sortResponse.json();
                maxSortOrder = Number(
                    sortRows?.[0]?.sort_order || 0
                );
            } catch {
                maxSortOrder = 0;
            }
        }

        /*
         * 같은 이름의 삭제된 대학이 있으면 복구
         */
        if (existingUniversity) {
            const restoreData = {
                name,
                enabled: true,
                sort_order: maxSortOrder + 1,
                updated_at: new Date().toISOString()
            };

            // 새 로고를 선택한 경우에만 기존 로고 교체
            if (logo_url) {
                restoreData.logo_url = logo_url;
            }

            const restoreResponse = await fetch(
                `${SUPABASE_URL}/rest/v1/star_universities` +
                `?id=eq.${encodeURIComponent(existingUniversity.id)}`,
                {
                    method: 'PATCH',
                    headers: {
                        ...H,
                        Prefer: 'return=representation'
                    },
                    body: JSON.stringify(restoreData)
                }
            );

            const restoreText = await restoreResponse.text();

            if (!restoreResponse.ok) {
                return res.status(restoreResponse.status).json({
                    error: `대학 복구 실패: ${restoreText}`
                });
            }

            let restoredRows = [];

            try {
                restoredRows = restoreText
                    ? JSON.parse(restoreText)
                    : [];
            } catch {
                restoredRows = [];
            }

            if (!restoredRows?.[0]) {
                return res.status(500).json({
                    error: '대학 복구 후 행을 받지 못했습니다.'
                });
            }

            return res.status(200).json({
                ok: true,
                restored: true,
                university: restoredRows[0]
            });
        }

        /*
         * 같은 이름의 기존 행이 없으면 신규 대학 등록
         */
        const createResponse = await fetch(
            `${SUPABASE_URL}/rest/v1/star_universities`,
            {
                method: 'POST',
                headers: {
                    ...H,
                    Prefer: 'return=representation'
                },
                body: JSON.stringify({
                    name,
                    logo_url: logo_url || null,
                    sort_order: maxSortOrder + 1,
                    enabled: true
                })
            }
        );

        const createText = await createResponse.text();

        if (!createResponse.ok) {
            return res.status(createResponse.status).json({
                error: `대학 등록 실패: ${createText}`
            });
        }

        let createdRows = [];

        try {
            createdRows = createText
                ? JSON.parse(createText)
                : [];
        } catch {
            createdRows = [];
        }

        if (!createdRows?.[0]) {
            return res.status(500).json({
                error: '대학 등록 후 행을 받지 못했습니다.'
            });
        }

        return res.status(200).json({
            ok: true,
            university: createdRows[0]
        });
    }

    if (action === 'university_update') {
        if (!id) {
            return res.status(400).json({
                error: '대학 id가 없습니다.'
            });
        }

        const clean = {
            updated_at: new Date().toISOString()
        };

        if (
            Object.prototype.hasOwnProperty.call(data, 'name')
        ) {
            clean.name = String(data.name || '').trim();
        }

        if (
            Object.prototype.hasOwnProperty.call(data, 'logo_url')
        ) {
            clean.logo_url =
                String(data.logo_url || '').trim() || null;
        }

        if (
            Object.prototype.hasOwnProperty.call(data, 'sort_order')
        ) {
            clean.sort_order = Number(data.sort_order) || 0;
        }

        if (
            Object.prototype.hasOwnProperty.call(clean, 'name') &&
            !clean.name
        ) {
            return res.status(400).json({
                error: '대학 이름은 비울 수 없습니다.'
            });
        }

        const response = await fetch(
            `${SUPABASE_URL}/rest/v1/star_universities` +
            `?id=eq.${encodeURIComponent(id)}`,
            {
                method: 'PATCH',
                headers: {
                    ...H,
                    Prefer: 'return=representation'
                },
                body: JSON.stringify(clean)
            }
        );

        const text = await response.text();

        if (!response.ok) {
            return res.status(response.status).json({
                error: `대학 수정 실패: ${text}`
            });
        }

        let rows = [];

        try {
            rows = text ? JSON.parse(text) : [];
        } catch {
            rows = [];
        }

        if (!rows?.[0]) {
            return res.status(404).json({
                error: '수정된 대학이 없습니다.'
            });
        }

        return res.status(200).json({
            ok: true,
            university: rows[0]
        });
    }

    if (action === 'university_delete') {
        if (!id) {
            return res.status(400).json({
                error: '대학 id가 없습니다.'
            });
        }

        /*
         * 해당 대학에 소속된 선수들을 먼저 무소속 처리
         */
        const detachResponse = await fetch(
            `${SUPABASE_URL}/rest/v1/star_players` +
            `?university_id=eq.${encodeURIComponent(id)}`,
            {
                method: 'PATCH',
                headers: {
                    ...H,
                    Prefer: 'return=minimal'
                },
                body: JSON.stringify({
                    university_id: null,
                    updated_at: new Date().toISOString()
                })
            }
        );

        if (!detachResponse.ok) {
            return res.status(detachResponse.status).json({
                error:
                    `선수 대학 해제 실패: ` +
                    `${await detachResponse.text()}`
            });
        }

        /*
         * 대학 행은 실제 삭제하지 않고 비활성화
         */
        const deleteResponse = await fetch(
            `${SUPABASE_URL}/rest/v1/star_universities` +
            `?id=eq.${encodeURIComponent(id)}`,
            {
                method: 'PATCH',
                headers: {
                    ...H,
                    Prefer: 'return=representation'
                },
                body: JSON.stringify({
                    enabled: false,
                    updated_at: new Date().toISOString()
                })
            }
        );

        const deleteText = await deleteResponse.text();

        if (!deleteResponse.ok) {
            return res.status(deleteResponse.status).json({
                error: `대학 삭제 실패: ${deleteText}`
            });
        }

        let deletedRows = [];

        try {
            deletedRows = deleteText
                ? JSON.parse(deleteText)
                : [];
        } catch {
            deletedRows = [];
        }

        if (!deletedRows?.[0]) {
            return res.status(404).json({
                error: '삭제할 대학을 찾지 못했습니다.'
            });
        }

        return res.status(200).json({
            ok: true
        });
    }

    // =========================================================
    // 선수 관리
    // =========================================================

    const allowed = [
        'tier',
        'race',
        'player_name',
        'display_name',
        'soop_user_id',
        'soop_nickname',
        'soop_profile_image',
        'status_flags',
        'enabled',
        'sort_order',
        'university_id'
    ];

    const clean = {};

    for (const key of allowed) {
        if (
            Object.prototype.hasOwnProperty.call(data, key)
        ) {
            clean[key] =
                key === 'university_id' &&
                (data[key] === '' || data[key] === null)
                    ? null
                    : data[key];
        }
    }

    /*
     * 신규 선수 등록
     */
    if (action === 'create') {
        const name = String(
            clean.player_name || ''
        ).trim();

        const tier = String(
            clean.tier || ''
        ).trim();

        const race = String(
            clean.race || ''
        ).trim();

        if (
            !name ||
            !tier ||
            !['T', 'Z', 'P'].includes(race)
        ) {
            return res.status(400).json({
                error: '이름/티어/종족을 확인해.'
            });
        }

        const sortResponse = await fetch(
            `${SUPABASE_URL}/rest/v1/star_players` +
            `?select=sort_order` +
            `&order=sort_order.desc` +
            `&limit=1`,
            {
                method: 'GET',
                headers: H
            }
        );

        let maxSortOrder = 0;

        if (sortResponse.ok) {
            try {
                const sortRows = await sortResponse.json();
                maxSortOrder = Number(
                    sortRows?.[0]?.sort_order || 0
                );
            } catch {
                maxSortOrder = 0;
            }
        }

        const body = {
            player_name: name,
            display_name:
                String(
                    clean.display_name || name
                ).trim() || name,
            tier,
            race,
            sort_order: maxSortOrder + 1,
            status_flags:
                Array.isArray(clean.status_flags)
                    ? clean.status_flags
                    : [],
            enabled: true,
            university_id:
                clean.university_id ?? null
        };

        for (const key of [
            'soop_user_id',
            'soop_nickname',
            'soop_profile_image'
        ]) {
            if (clean[key]) {
                body[key] = clean[key];
            }
        }

        const createResponse = await fetch(
            `${SUPABASE_URL}/rest/v1/star_players`,
            {
                method: 'POST',
                headers: {
                    ...H,
                    Prefer: 'return=representation'
                },
                body: JSON.stringify(body)
            }
        );

        const createText = await createResponse.text();

        if (!createResponse.ok) {
            return res.status(createResponse.status).json({
                error: `신규등록 실패: ${createText}`
            });
        }

        let createdRows = [];

        try {
            createdRows = createText
                ? JSON.parse(createText)
                : [];
        } catch {
            createdRows = [];
        }

        if (!createdRows?.[0]) {
            return res.status(500).json({
                error: '신규등록 후 행을 받지 못했습니다.'
            });
        }

        return res.status(200).json({
            ok: true,
            row: createdRows[0]
        });
    }

    if (!id) {
        return res.status(400).json({
            error: '선수 id가 없습니다.'
        });
    }

    /*
     * 선수 삭제
     *
     * 실제 행 삭제 대신 enabled=false로 비활성화
     */
    if (action === 'delete') {
        const deleteResponse = await fetch(
            `${SUPABASE_URL}/rest/v1/star_players` +
            `?id=eq.${encodeURIComponent(id)}`,
            {
                method: 'PATCH',
                headers: {
                    ...H,
                    Prefer: 'return=representation'
                },
                body: JSON.stringify({
                    enabled: false,
                    updated_at: new Date().toISOString()
                })
            }
        );

        const deleteText = await deleteResponse.text();

        if (!deleteResponse.ok) {
            return res.status(deleteResponse.status).json({
                error: `삭제 실패: ${deleteText}`
            });
        }

        let deletedRows = [];

        try {
            deletedRows = deleteText
                ? JSON.parse(deleteText)
                : [];
        } catch {
            deletedRows = [];
        }

        if (!deletedRows?.[0]) {
            return res.status(404).json({
                error: '삭제할 선수를 찾지 못했습니다.'
            });
        }

        return res.status(200).json({
            ok: true
        });
    }

    if (action !== 'update') {
        return res.status(400).json({
            error: '알 수 없는 작업'
        });
    }

    if (!Object.keys(clean).length) {
        return res.status(400).json({
            error: '수정할 값이 없습니다.'
        });
    }

    clean.updated_at = new Date().toISOString();

    const updateResponse = await fetch(
        `${SUPABASE_URL}/rest/v1/star_players` +
        `?id=eq.${encodeURIComponent(id)}`,
        {
            method: 'PATCH',
            headers: {
                ...H,
                Prefer: 'return=representation'
            },
            body: JSON.stringify(clean)
        }
    );

    const updateText = await updateResponse.text();

    if (!updateResponse.ok) {
        return res.status(updateResponse.status).json({
            error: `수정 실패: ${updateText}`
        });
    }

    let updatedRows = [];

    try {
        updatedRows = updateText
            ? JSON.parse(updateText)
            : [];
    } catch {
        updatedRows = [];
    }

    if (!updatedRows?.[0]) {
        return res.status(404).json({
            error: '수정된 행이 없습니다.'
        });
    }

    return res.status(200).json({
        ok: true,
        row: updatedRows[0]
    });
}