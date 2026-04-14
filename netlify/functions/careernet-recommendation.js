/**
 * 커리어넷(진로정보) 연동 — 실제 API URL·키는 Netlify 환경변수로 설정합니다.
 * CAREERNET_API_BASE_URL, CAREERNET_API_KEY 가 없으면 진로 키워드 기반 샘플 과목을 반환합니다.
 *
 * 공식 API 스펙이 정해지면 아래 fetch 본문·경로·응답 파싱(`subjects` 배열 등)을 그에 맞게 수정하세요.
 */
function mockSubjectsForMajor(major) {
    const m = (major || '').toLowerCase();
    const base = [
        { name: '수학Ⅰ', reason: '이공 계열 기초' },
        { name: '수학Ⅱ', reason: '이공 계열 기초' },
        { name: '미적분', reason: '심화 수학' },
        { name: '확률과 통계', reason: '데이터·통계 기초' },
        { name: '물리학Ⅰ', reason: '과학 탐구' },
        { name: '화학Ⅰ', reason: '과학 탐구' },
        { name: '생명과학Ⅰ', reason: '과학 탐구' },
        { name: '정보', reason: '디지털 역량' }
    ];
    if (m.includes('간호') || m.includes('의료') || m.includes('약')) {
        return [
            { name: '생명과학Ⅰ', reason: '의·약·생명 계열 기초' },
            { name: '화학Ⅰ', reason: '화학 이해' },
            { name: '윤리와 사상', reason: '인문·의료 윤리' },
            { name: '사회·문화', reason: '사회 탐구' },
            { name: '영어Ⅰ', reason: '의학 용어 기초' },
            { name: '수학Ⅱ', reason: '통계·자료 해석' }
        ];
    }
    if (m.includes('법') || m.includes('행정') || m.includes('인문')) {
        return [
            { name: '한국사', reason: '인문·사회 기초' },
            { name: '세계사', reason: '사회 탐구' },
            { name: '정치와 법', reason: '법·제도 이해' },
            { name: '경제', reason: '사회·경제 이해' },
            { name: '사회·문화', reason: '사회 탐구' },
            { name: '언어와 매체', reason: '논리·표현' }
        ];
    }
    if (m.includes('예술') || m.includes('디자인') || m.includes('음악') || m.includes('미술')) {
        return [
            { name: '미술', reason: '예술 소양' },
            { name: '음악', reason: '예술 소양' },
            { name: '체육', reason: '전공 연계 체육' },
            { name: '사회·문화', reason: '문화 이해' },
            { name: '영어Ⅰ', reason: '표현·소통' },
            { name: '수학Ⅰ', reason: '기초 소양' }
        ];
    }
    return base;
}

exports.handler = async function (event) {
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: JSON.stringify({ error: 'Method Not Allowed' }) };
    }

    let body = {};
    try {
        body = JSON.parse(event.body || '{}');
    } catch (e) {
        return { statusCode: 400, body: JSON.stringify({ error: { message: 'Invalid JSON' } }) };
    }

    const major = body.major || body.keyword || '';
    const baseUrl = (process.env.CAREERNET_API_BASE_URL || '').replace(/\/$/, '');
    const apiKey = process.env.CAREERNET_API_KEY || '';
    const pathSuffix = process.env.CAREERNET_API_PATH || '/recommend';

    if (baseUrl && apiKey) {
        try {
            const url = baseUrl.startsWith('http') ? baseUrl + pathSuffix : `https://${baseUrl}${pathSuffix}`;
            const res = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${apiKey}`
                },
                body: JSON.stringify({
                    major,
                    keyword: body.keyword,
                    schoolCourses: body.schoolCourses
                })
            });
            const text = await res.text();
            let data;
            try {
                data = JSON.parse(text);
            } catch (e) {
                return {
                    statusCode: 200,
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        source: 'api',
                        raw: text,
                        subjects: [],
                        message: 'API 응답이 JSON이 아닙니다. CAREERNET_API_PATH와 응답 형식을 확인하세요.'
                    })
                };
            }
            return {
                statusCode: 200,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ source: 'api', ...data })
            };
        } catch (err) {
            return {
                statusCode: 200,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    source: 'error',
                    message: err.message,
                    subjects: mockSubjectsForMajor(major)
                })
            };
        }
    }

    const subjects = mockSubjectsForMajor(major);
    return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            source: 'mock',
            subjects,
            message:
                '커리어넷 API가 설정되지 않았습니다. Netlify에 CAREERNET_API_BASE_URL, CAREERNET_API_KEY(및 필요 시 CAREERNET_API_PATH)를 설정하면 실제 연동됩니다. 현재는 진로 키워드 기반 샘플 과목입니다.'
        })
    };
};
