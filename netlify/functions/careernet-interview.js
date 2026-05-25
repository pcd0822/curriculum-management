/**
 * 학과 교수님 인터뷰 — 공공데이터포털(odcloud) 프록시.
 *
 * Why: 인증키(ODCLOUD_API_KEY)가 브라우저에 노출되지 않도록 서버에서만 호출하고,
 *      odcloud의 와이드 컬럼(질문_1~N / 답변_1~N)을 클라이언트가 쓰기 좋은 형태로 정규화한다.
 *
 * 요청:  GET /.netlify/functions/careernet-interview?major=언어학
 * 응답:  { major, totalCount, interviews: [{ no, professor, position, qas: [{ question, answer }] }] }
 */

const ENDPOINT = 'https://api.odcloud.kr/api/15090642/v1/uddi:48606f80-3988-45b4-b532-c71186741e27';
const MAX_PER_PAGE = 100; // odcloud 기본 상한

const CORS_HEADERS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
};

function respond(statusCode, body) {
    return {
        statusCode,
        headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
        body: typeof body === 'string' ? body : JSON.stringify(body),
    };
}

/**
 * odcloud 원본 row → 정규화.
 * row 예: { 연번, 인터뷰제목, '인터뷰이 직업(직위)', 질문_1, 답변_1, ... }
 */
function normalizeRow(row) {
    const qas = [];
    // 질문_N / 답변_N 페어를 N 순서대로 모은다.
    const indices = new Set();
    for (const key of Object.keys(row)) {
        const m = key.match(/^질문_(\d+)$/);
        if (m) indices.add(Number(m[1]));
    }
    const sorted = Array.from(indices).sort((a, b) => a - b);
    for (const i of sorted) {
        const q = row[`질문_${i}`];
        const a = row[`답변_${i}`];
        // 질문이 비어 있으면 스킵. 답변만 비어 있는 경우는 공백으로 표시.
        if (q == null || String(q).trim() === '') continue;
        qas.push({
            question: String(q).trim(),
            answer: a == null ? '' : String(a).trim(),
        });
    }
    // 원본 데이터에는 교수 개인 이름이 없고 직위(예: 교수/부교수/강사)만 제공됨.
    // 화면 표기는 직위로 통일하고 position은 빈 값으로 두어 중복 표시를 피한다.
    const position = (row['인터뷰이 직업(직위)'] || '교수').trim();
    return {
        no: row['연번'] ?? null,
        professor: position,
        position: '',
        major: (row['인터뷰제목'] || '').trim(),
        qas,
    };
}

exports.handler = async function (event) {
    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 204, headers: CORS_HEADERS, body: '' };
    }
    if (event.httpMethod !== 'GET') {
        return respond(405, { error: 'Method Not Allowed' });
    }

    const apiKey = process.env.ODCLOUD_API_KEY;
    if (!apiKey) {
        return respond(500, { error: 'ODCLOUD_API_KEY 환경변수가 설정되지 않았습니다.' });
    }

    const params = event.queryStringParameters || {};

    // ─── suggest 모드: 학과명 자동완성용 distinct 목록 ───
    if (params.suggest != null) {
        const q = String(params.suggest).trim().slice(0, 50);
        if (!q) return respond(200, { suggestions: [] });
        const url = new URL(ENDPOINT);
        url.searchParams.set('page', '1');
        url.searchParams.set('perPage', '100');
        url.searchParams.set('returnType', 'json');
        url.searchParams.set('serviceKey', apiKey);
        url.searchParams.set('cond[인터뷰제목::LIKE]', q);
        try {
            const res = await fetch(url.toString(), { headers: { Accept: 'application/json' } });
            const raw = await res.json();
            const rows = Array.isArray(raw.data) ? raw.data : [];
            const set = new Set();
            for (const r of rows) {
                const t = String(r['인터뷰제목'] || '').trim();
                if (t) set.add(t);
            }
            return respond(200, { suggestions: Array.from(set).sort() });
        } catch (err) {
            return respond(200, { suggestions: [] });
        }
    }

    const rawMajor = String(params.major || '').trim();
    if (!rawMajor) {
        return respond(400, { error: 'major 파라미터가 필요합니다.' });
    }
    // 입력 길이 cap — 비정상 입력 방어.
    const major = rawMajor.slice(0, 50);
    const page = Math.max(1, Number(params.page) || 1);
    const perPage = Math.min(MAX_PER_PAGE, Math.max(1, Number(params.perPage) || 30));

    const url = new URL(ENDPOINT);
    url.searchParams.set('page', String(page));
    url.searchParams.set('perPage', String(perPage));
    url.searchParams.set('returnType', 'json');
    url.searchParams.set('serviceKey', apiKey);
    // 서버 사이드 LIKE 검색 — '인터뷰제목' = 학과명
    url.searchParams.set('cond[인터뷰제목::LIKE]', major);

    try {
        const res = await fetch(url.toString(), { headers: { Accept: 'application/json' } });
        const text = await res.text();
        let raw;
        try {
            raw = JSON.parse(text);
        } catch (e) {
            return respond(502, { error: 'odcloud 응답 파싱 실패', raw: text.slice(0, 300) });
        }
        if (!res.ok) {
            return respond(res.status, { error: 'odcloud 오류', detail: raw });
        }

        const data = Array.isArray(raw.data) ? raw.data : [];
        const interviews = data.map(normalizeRow).filter((iv) => iv.qas.length > 0);

        return respond(200, {
            major,
            matchCount: raw.matchCount ?? interviews.length,
            totalCount: raw.totalCount ?? null,
            page,
            perPage,
            interviews,
        });
    } catch (err) {
        return respond(500, { error: 'odcloud 호출 실패: ' + (err && err.message) });
    }
};
