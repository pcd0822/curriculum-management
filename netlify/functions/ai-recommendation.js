/**
 * 사용자 입력 sanitize.
 *
 * Why: 입력값이 OpenAI 프롬프트에 직접 삽입되므로 (a) 비용 폭증을 막기 위해 길이를 캡하고
 *      (b) 제어문자/줄바꿈을 정리해 prompt injection 표면을 줄인다.
 */
const MAX_MAJOR_LEN = 200;
const MAX_COURSES_LEN = 10_000;
const MAX_JOINT_ITEMS = 200;
const MAX_JOINT_FIELD_LEN = 200;

const CORS_HEADERS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
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

function cleanString(s, maxLen) {
    if (s == null) return '';
    let str = typeof s === 'string' ? s : String(s);
    // 제어문자(NUL ~ US, DEL) 제거 — 줄바꿈 포함하여 한 줄로 합친다.
    str = str.replace(/[\x00-\x1f\x7f]/g, ' ');
    if (str.length > maxLen) str = str.slice(0, maxLen);
    return str.trim();
}

function sanitizeJointCurriculum(arr) {
    if (!Array.isArray(arr)) return [];
    return arr.slice(0, MAX_JOINT_ITEMS).map(c => ({
        과목명: cleanString(c && (c.과목명 || c.subjectName), MAX_JOINT_FIELD_LEN),
        세부교과: cleanString(c && (c.세부교과 || c.subCategory), MAX_JOINT_FIELD_LEN),
        교과편제: cleanString(c && c.교과편제, MAX_JOINT_FIELD_LEN),
    }));
}

exports.handler = async function (event, context) {
    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 204, headers: CORS_HEADERS, body: '' };
    }
    if (event.httpMethod !== 'POST') {
        return respond(405, { error: { message: 'Method Not Allowed' } });
    }

    const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

    if (!OPENAI_API_KEY) {
        return respond(500, { error: { message: 'OpenAI API Key is not configured in Netlify.' } });
    }

    try {
        let body;
        try {
            body = JSON.parse(event.body || '{}');
        } catch (e) {
            return respond(400, { error: { message: 'Invalid JSON body.' } });
        }

        const major = cleanString(body.major, MAX_MAJOR_LEN);
        const availableCourses = cleanString(body.availableCourses, MAX_COURSES_LEN);
        const mode = body.mode === 'admin' ? 'admin' : undefined;

        if (!major) {
            return respond(400, { error: { message: 'Major is required.' } });
        }

        let prompt;
        let responseFormat = undefined;

        if (mode === 'admin') {
            const jointCurriculum = sanitizeJointCurriculum(body.jointCurriculum);
            const jointStr = jointCurriculum.length > 0
                ? JSON.stringify(jointCurriculum)
                : '[]';

            prompt = `You are a professional High School Career Consultant with expertise in Korean education system.

Target Major/Career Path: "${major}"
Student's Selected Courses: ${availableCourses}
공동교육과정 개설 과목: ${jointStr}

TASK: Provide recommendations including 공동교육과정 (joint curriculum) if available.

REQUIREMENTS:
1. balancedRecommendations: If 공동교육과정 목록 has items, recommend exactly 3 courses that would BALANCE the student's selection considering career and subject trend. Format: [{ "subject": "과목명", "reason": "추천 사유" }]
2. advancedRecommendations: If 공동교육과정 has 진로/융합 교과편제 items, recommend exactly 3 ADVANCED (심화) courses. Format: [{ "subject": "과목명", "reason": "추천 사유" }]
3. Recommended Subjects: Provide exactly 5-7 subjects (from regular curriculum) most relevant to the major. Format: "Subject Name: Brief reason"
4. Keywords: Exactly 5 keywords for student record
5. Activities: Exactly 3 exploration activities

If 공동교육과정 is empty, set balancedRecommendations and advancedRecommendations to empty arrays [].

Output ONLY valid JSON:
{
  "balancedRecommendations": [{"subject":"과목명","reason":"사유"}],
  "advancedRecommendations": [{"subject":"과목명","reason":"사유"}],
  "subjects": ["Subject Name: Reason..."],
  "keywords": ["Keyword1", "Keyword2", ...],
  "activities": ["Activity 1", "Activity 2", "Activity 3"]
}

Language: Korean.`;
            responseFormat = { type: 'json_object' };
        } else {
            // Default (Student Page): Plain Text
            prompt = `고등학생 진로 컨설턴트 역할. 희망 진로 '${major}'에 맞춰 다음 과목 목록에서 가장 유용한 과목 7개를 추천하고 한 문장 이유를 덧붙여줘. 형식: "과목명: 이유". 과목 목록: ${availableCourses}`;
        }

        const payload = {
            model: 'gpt-4o',
            messages: [{ role: 'user', content: prompt }],
            temperature: 0.3,
        };

        if (responseFormat) {
            payload.response_format = responseFormat;
        }

        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${OPENAI_API_KEY}`,
            },
            body: JSON.stringify(payload),
        });

        const data = await response.json();
        return respond(response.ok ? 200 : response.status, data);
    } catch (error) {
        console.error('AI recommendation error:', error && error.message);
        return respond(500, { error: { message: 'Internal Server Error: ' + (error && error.message) } });
    }
};
