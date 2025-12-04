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

        if (!major) {
            return { statusCode: 400, body: JSON.stringify({ error: { message: "Major is required." } }) };
        }

        const prompt = `고등학생 진로 컨설턴트 역할. 희망 진로 '${major}'에 맞춰 다음 과목 목록에서 가장 유용한 과목 7개를 추천하고 한 문장 이유를 덧붙여줘. 형식: "과목명: 이유". 과목 목록: ${availableCourses}`;

        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${OPENAI_API_KEY}`
            },
            body: JSON.stringify({
                model: "gpt-4o",
                messages: [{ role: "user", content: prompt }]
            })
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
