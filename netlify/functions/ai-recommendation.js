exports.handler = async function (event, context) {
    // Only allow POST
    if (event.httpMethod !== "POST") {
        return { statusCode: 405, body: "Method Not Allowed" };
    }

    const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

    if (!OPENAI_API_KEY) {
        return {
            statusCode: 500,
            body: JSON.stringify({ error: { message: "OpenAI API Key is not configured in Netlify." } })
        };
    }

    try {
        const body = JSON.parse(event.body);
        const major = body.major;
        const availableCourses = body.availableCourses;
        const mode = body.mode; // 'admin' or undefined for legacy

        if (!major) {
            return { statusCode: 400, body: JSON.stringify({ error: { message: "Major is required." } }) };
        }

        let prompt;
        let responseFormat = undefined;

        if (mode === 'admin') {
            const jointCurriculum = body.jointCurriculum || [];
            const jointStr = jointCurriculum.length > 0 
                ? JSON.stringify(jointCurriculum.map(c => ({
                    과목명: c.과목명 || c.subjectName,
                    세부교과: c.세부교과 || c.subCategory,
                    교과편제: c.교과편제
                })))
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
            responseFormat = { type: "json_object" };
        } else {
            // Default (Student Page): Plain Text
            prompt = `고등학생 진로 컨설턴트 역할. 희망 진로 '${major}'에 맞춰 다음 과목 목록에서 가장 유용한 과목 7개를 추천하고 한 문장 이유를 덧붙여줘. 형식: "과목명: 이유". 과목 목록: ${availableCourses}`;
        }

        const payload = {
            model: "gpt-4o",
            messages: [{ role: "user", content: prompt }],
            temperature: 0.3  // 낮은 temperature로 일관성 향상 (0.0~1.0, 기본값 1.0)
        };

        if (responseFormat) {
            payload.response_format = responseFormat;
        }

        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${OPENAI_API_KEY}`
            },
            body: JSON.stringify(payload)
        });

        const data = await response.json();

        if (!response.ok) {
            return {
                statusCode: response.status,
                body: JSON.stringify(data)
            };
        }

        return {
            statusCode: 200,
            body: JSON.stringify(data)
        };

    } catch (error) {
        console.error("Error:", error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: { message: "Internal Server Error: " + error.message } })
        };
    }
};
