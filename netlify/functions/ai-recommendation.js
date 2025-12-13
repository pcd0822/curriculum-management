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
            // Admin Mode: Strict JSON for structured display with enhanced prompt for consistency
            prompt = `You are a professional High School Career Consultant with expertise in Korean education system.

Target Major/Career Path: "${major}"

TASK: Analyze the provided course list and provide consistent, objective recommendations.

REQUIREMENTS:
1. Recommended Subjects: Provide exactly 5-7 subjects that are MOST relevant to the target major.
   - Format: "Subject Name: Brief reason (one sentence)"
   - Prioritize subjects that directly relate to the major's core competencies
   - Be specific and objective in your reasoning
   - Use the exact subject names from the provided course list when possible

2. Student Record Keywords: Provide exactly 5 keywords that are essential for this major.
   - These should be specific terms related to the major field
   - Use Korean terms when appropriate
   - Focus on academic and professional competencies

3. Exploration Activities: Provide exactly 3 research or exploration activities.
   - These should be concrete, actionable activities
   - Related to the target major
   - Suitable for high school students

IMPORTANT CONSIDERATIONS:
- Be consistent: For the same major and course list, provide the same recommendations
- Be objective: Base recommendations on factual relevance, not personal opinions
- Be specific: Avoid generic recommendations
- Use exact course names from the provided list when matching

Available Courses: ${availableCourses}

Output ONLY valid JSON in this exact format (no additional text, no markdown):
{
  "subjects": ["Subject Name: Reason...", "Subject Name: Reason..."],
  "keywords": ["Keyword1", "Keyword2", "Keyword3", "Keyword4", "Keyword5"],
  "activities": ["Activity 1", "Activity 2", "Activity 3"]
}

Language: Korean for all text content.`;
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
