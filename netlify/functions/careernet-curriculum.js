/**
 * 학과 커리큘럼(강의계획서) — 공공데이터포털(odcloud) 프록시.
 *
 * Why: 인증키(ODCLOUD_API_KEY)가 브라우저에 노출되지 않도록 서버에서만 호출하고,
 *      한 행=한 강좌 구조를 (a) 대학교명으로 그룹핑하고 (b) 같은 학년/학기/과목명 중복(분반·연도)을 dedupe.
 *
 * 2단계 호출 패턴:
 *   1) GET /.netlify/functions/careernet-curriculum?major=간호학과
 *      → 매칭된 대학 목록 (universities: [{ university, college, courseCount }]) — 학생이 대학 선택용
 *   2) GET /.netlify/functions/careernet-curriculum?major=간호학과&university=강원대학교
 *      → 해당 대학의 커리큘럼 (courses: [{ id, year, semester, name, credits, type, theoryHours, practiceHours,
 *                                           description, objectives?, references, … }])
 */

const ENDPOINT = 'https://api.odcloud.kr/api/15112124/v1/uddi:e4548eca-31d4-4e26-8fda-abe24d9af847';
const MAX_PER_PAGE = 1000; // odcloud 상한 (검증됨)

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

function str(v) {
    if (v == null) return '';
    return String(v).trim();
}

function num(v) {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
}

/** odcloud 원본 row → 커리큘럼 과목 정규화 */
function normalizeCourse(row, index) {
    const year = num(row['학년']) || null;
    const semester = str(row['학기']) || '';
    const credits = num(row['학점']);
    return {
        // 행 자체에 식별자가 없어 대학·학과·학년·학기·과목명을 조합. dedupe 키와 동일.
        id: `${str(row['대학교명'])}|${str(row['학부 과명'])}|${year}|${semester}|${str(row['과목명'])}|${index}`,
        university: str(row['대학교명']),
        college: str(row['단과대학명']),
        major: str(row['학부 과명']),
        year,
        semester,
        semesterLabel: year && semester ? `${year}-${semester}` : (semester || (year ? `${year}학년` : '')),
        name: str(row['과목명']),
        type: str(row['과목구분']),
        credits,
        theoryHours: num(row['이론시간']),
        practiceHours: num(row['실습시간']),
        year_data: num(row['연도']) || null, // 강의계획 작성 연도
        description: str(row['학습목표']),
        mainTextbook: str(row['주교재']),
        subTextbook: str(row['부교재']),
        references: str(row['참고자료']),
        prerequisites: str(row['선행학습자료']),
    };
}

/** (학년, 학기, 과목명) 키로 dedupe — 같은 키 안에서는 가장 최근 연도(year_data) 우선 */
function dedupeCourses(courses) {
    const map = new Map();
    for (const c of courses) {
        const key = `${c.year}|${c.semester}|${c.name}`;
        const prev = map.get(key);
        if (!prev || (c.year_data || 0) > (prev.year_data || 0)) {
            map.set(key, c);
        }
    }
    return Array.from(map.values());
}

/** 학년 → 학기 순으로 정렬 (학기 문자열에서 숫자 추출) */
function sortCourses(courses) {
    const semOrder = (s) => {
        const m = String(s || '').match(/(\d+)/);
        return m ? Number(m[1]) : 99;
    };
    return courses.slice().sort((a, b) => {
        if ((a.year || 99) !== (b.year || 99)) return (a.year || 99) - (b.year || 99);
        if (semOrder(a.semester) !== semOrder(b.semester)) return semOrder(a.semester) - semOrder(b.semester);
        return a.name.localeCompare(b.name, 'ko');
    });
}

async function fetchOdcloud({ major, university, perPage, page, apiKey }) {
    const url = new URL(ENDPOINT);
    url.searchParams.set('page', String(page));
    url.searchParams.set('perPage', String(perPage));
    url.searchParams.set('returnType', 'json');
    url.searchParams.set('serviceKey', apiKey);
    url.searchParams.set('cond[학부 과명::LIKE]', major);
    if (university) {
        url.searchParams.set('cond[대학교명::LIKE]', university);
    }
    const res = await fetch(url.toString(), { headers: { Accept: 'application/json' } });
    const text = await res.text();
    let raw;
    try {
        raw = JSON.parse(text);
    } catch (e) {
        const err = new Error('odcloud 응답 파싱 실패');
        err.detail = text.slice(0, 300);
        err.statusCode = 502;
        throw err;
    }
    if (!res.ok) {
        const err = new Error('odcloud 오류');
        err.detail = raw;
        err.statusCode = res.status;
        throw err;
    }
    return raw;
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
        const q = str(params.suggest).slice(0, 50);
        if (!q) return respond(200, { suggestions: [] });
        const url = new URL(ENDPOINT);
        url.searchParams.set('page', '1');
        url.searchParams.set('perPage', String(MAX_PER_PAGE));
        url.searchParams.set('returnType', 'json');
        url.searchParams.set('serviceKey', apiKey);
        url.searchParams.set('cond[학부 과명::LIKE]', q);
        try {
            const res = await fetch(url.toString(), { headers: { Accept: 'application/json' } });
            const raw = await res.json();
            const rows = Array.isArray(raw.data) ? raw.data : [];
            const set = new Set();
            for (const r of rows) {
                const t = str(r['학부 과명']);
                if (t) set.add(t);
            }
            return respond(200, { suggestions: Array.from(set).sort((a, b) => a.localeCompare(b, 'ko')) });
        } catch (err) {
            return respond(200, { suggestions: [] });
        }
    }

    const major = str(params.major).slice(0, 50);
    const university = str(params.university).slice(0, 50);
    if (!major) {
        return respond(400, { error: 'major 파라미터가 필요합니다.' });
    }

    try {
        const raw = await fetchOdcloud({
            major,
            university: university || null,
            perPage: MAX_PER_PAGE,
            page: 1,
            apiKey,
        });

        const rows = Array.isArray(raw.data) ? raw.data : [];
        const matchCount = raw.matchCount ?? rows.length;
        const truncated = matchCount > rows.length;

        // 1단계: 대학 미지정 → 매칭된 대학 목록만 반환.
        if (!university) {
            const uniMap = new Map();
            for (const r of rows) {
                const u = str(r['대학교명']);
                const c = str(r['단과대학명']);
                const m = str(r['학부 과명']);
                if (!u) continue;
                const key = `${u}|${m}`;
                if (!uniMap.has(key)) {
                    uniMap.set(key, { university: u, college: c, major: m, courseCount: 0 });
                }
                uniMap.get(key).courseCount += 1;
            }
            const universities = Array.from(uniMap.values()).sort((a, b) => a.university.localeCompare(b.university, 'ko'));
            return respond(200, {
                stage: 'universities',
                major,
                matchCount,
                truncated,
                universities,
            });
        }

        // 2단계: 대학 지정 → 그 학교 커리큘럼 정규화.
        const normalized = rows.map((r, i) => normalizeCourse(r, i));
        const deduped = dedupeCourses(normalized);
        const sorted = sortCourses(deduped);

        const collegeMeta = sorted[0]
            ? { university: sorted[0].university, college: sorted[0].college, major: sorted[0].major }
            : { university, college: '', major };

        return respond(200, {
            stage: 'courses',
            major,
            university,
            college: collegeMeta.college,
            matchedMajor: collegeMeta.major,
            matchCount,
            truncated,
            courseCount: sorted.length,
            courses: sorted,
        });
    } catch (err) {
        return respond(err.statusCode || 500, { error: err.message, detail: err.detail });
    }
};
