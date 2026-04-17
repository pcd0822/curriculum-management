/**
 * 커리어넷 진로심리검사 API 프록시
 * - GET  ?action=questions&q=검사번호        → 검사 문항 조회 (v1)
 * - POST { action:"report", ...body }       → 검사 결과 제출 (v1)
 * - GET  ?action=questions_v2&q=검사번호     → 검사 문항 조회 (v2, 직업흥미검사H)
 * - POST { action:"report_v2", ...body }    → 검사 결과 제출 (v2)
 */

const CAREERNET_API_KEY = '8281762a78b4d522b5ba01aef1e0761d';
const V1_BASE = 'https://www.career.go.kr/inspct/openapi/test';
const V2_BASE = 'https://www.career.go.kr/inspct/openapi/v2';
const CNET_BASE = 'https://www.career.go.kr/cnet/openapi/getOpenApi';

const CORS_HEADERS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Content-Type': 'application/json'
};

exports.handler = async function (event) {
    // CORS preflight
    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 204, headers: CORS_HEADERS, body: '' };
    }

    try {
        // === GET requests ===
        if (event.httpMethod === 'GET') {
            const params = event.queryStringParameters || {};
            const action = params.action || '';
            const q = params.q || '';

            if (action === 'questions' && q) {
                // v1 문항 요청
                const url = `${V1_BASE}/questions?apikey=${CAREERNET_API_KEY}&q=${q}`;
                const res = await fetch(url);
                const data = await res.json();
                return { statusCode: 200, headers: CORS_HEADERS, body: JSON.stringify(data) };
            }

            if (action === 'questions_v2' && q) {
                // v2 문항 요청 (직업흥미검사 H)
                const url = `${V2_BASE}/test?apikey=${CAREERNET_API_KEY}&q=${q}`;
                const res = await fetch(url);
                const data = await res.json();
                return { statusCode: 200, headers: CORS_HEADERS, body: JSON.stringify(data) };
            }

            if (action === 'tests_v2') {
                // v2 검사 목록 요청
                const url = `${V2_BASE}/tests?apikey=${CAREERNET_API_KEY}`;
                const res = await fetch(url);
                const data = await res.json();
                return { statusCode: 200, headers: CORS_HEADERS, body: JSON.stringify(data) };
            }

            if (action === 'major_list') {
                // 학과정보 목록 조회
                const subject = params.subject || '';
                const thisPage = params.thisPage || '1';
                const perPage = params.perPage || '20';
                const searchTitle = params.searchTitle || '';
                let url = `${CNET_BASE}?apiKey=${CAREERNET_API_KEY}&svcType=api&svcCode=MAJOR&contentType=json&gubun=univ_list&subject=${subject}&thisPage=${thisPage}&perPage=${perPage}`;
                if (searchTitle) {
                    url += `&searchTitle=${encodeURIComponent(searchTitle)}`;
                }
                const res = await fetch(url);
                const data = await res.json();
                return { statusCode: 200, headers: CORS_HEADERS, body: JSON.stringify(data) };
            }

            if (action === 'major_view') {
                // 학과정보 상세 조회
                const majorSeq = params.majorSeq || '';
                const url = `${CNET_BASE}?apiKey=${CAREERNET_API_KEY}&svcType=api&svcCode=MAJOR_VIEW&contentType=json&gubun=univ_list&majorSeq=${majorSeq}`;
                const res = await fetch(url);
                const data = await res.json();
                return { statusCode: 200, headers: CORS_HEADERS, body: JSON.stringify(data) };
            }

            return {
                statusCode: 400,
                headers: CORS_HEADERS,
                body: JSON.stringify({ error: 'Invalid action. Use: questions, questions_v2, tests_v2, major_list, major_view' })
            };
        }

        // === POST requests ===
        if (event.httpMethod === 'POST') {
            let body = {};
            try { body = JSON.parse(event.body || '{}'); } catch (e) {
                return { statusCode: 400, headers: CORS_HEADERS, body: JSON.stringify({ error: 'Invalid JSON' }) };
            }

            const action = body.action || 'report';

            if (action === 'report') {
                // v1 결과 요청
                const payload = {
                    apikey: CAREERNET_API_KEY,
                    qestrnSeq: String(body.qestrnSeq),
                    trgetSe: String(body.trgetSe),
                    name: body.name || '',
                    gender: String(body.gender),
                    school: body.school || '',
                    grade: String(body.grade || '1'),
                    email: body.email || '',
                    startDtm: body.startDtm || Date.now(),
                    answers: body.answers || ''
                };

                const res = await fetch(`${V1_BASE}/report`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
                const data = await res.json();
                return { statusCode: 200, headers: CORS_HEADERS, body: JSON.stringify(data) };
            }

            if (action === 'report_v2') {
                // v2 결과 요청 (직업흥미검사 H)
                const payload = {
                    apikey: CAREERNET_API_KEY,
                    answers: body.answers || [],
                    email: body.email || '',
                    gender: String(body.gender),
                    grade: String(body.grade || '1'),
                    name: body.name || '',
                    qno: body.qno || 33,
                    school: body.school || '',
                    startdtm: body.startdtm || Date.now(),
                    trgetse: String(body.trgetse || '100207')
                };

                const res = await fetch(`${V2_BASE}/report`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
                const data = await res.json();
                return { statusCode: 200, headers: CORS_HEADERS, body: JSON.stringify(data) };
            }

            return {
                statusCode: 400,
                headers: CORS_HEADERS,
                body: JSON.stringify({ error: 'Invalid action. Use: report, report_v2' })
            };
        }

        return { statusCode: 405, headers: CORS_HEADERS, body: JSON.stringify({ error: 'Method Not Allowed' }) };

    } catch (err) {
        return {
            statusCode: 500,
            headers: CORS_HEADERS,
            body: JSON.stringify({ error: err.message })
        };
    }
};
