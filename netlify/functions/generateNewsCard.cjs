exports.handler = async (event, context) => {
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS'
    };

    if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };
    if (event.httpMethod !== 'POST') return { statusCode: 405, headers, body: 'Method Not Allowed' };

    try {
        if (!event.body) {
            return { statusCode: 400, headers, body: JSON.stringify({ error: "Missing request body." }) };
        }

        const { text, style, numCards } = JSON.parse(event.body);
        const cardCount = parseInt(numCards, 10) || 1;
        const apiKey = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY;

        if (!apiKey) {
            return { statusCode: 500, headers, body: JSON.stringify({ error: "Gemini API key is not configured on Netlify." }) };
        }

        const prompt = `You are a comic book editor. Convert the article below into exactly ${cardCount} comic news card(s) in "${style}" style.

IMPORTANT: Respond with ONLY a raw JSON object. No markdown, no code fences, no explanation. Just the JSON.

Required JSON format:
{"cards":[{"headline":"string","brief1":"string","brief2":"string","imagePrompt":"string"}]}

Rules:
- headline: dramatic comic-book headline, include key numbers/facts
- brief1: 2-3 sentence pulp-narrator setup (max 40 words), keep key facts
- brief2: 2-3 sentence pulp-narrator continuation (max 40 words), keep metrics
- imagePrompt: visual scene in ${style} style, NO text/letters/numbers in the image

ARTICLE:
${text}`;

        const modelsToTry = ["gemini-1.5-flash", "gemini-2.5-flash"];
        let rawText = "";
        let success = false;
        let lastError = null;

        for (const modelName of modelsToTry) {
            try {
                console.log(`🤖 Trying model: ${modelName}`);
                const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;

                const controller = new AbortController();
                const timer = setTimeout(() => controller.abort(), 8500);

                let response;
                try {
                    response = await fetch(url, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            contents: [{ parts: [{ text: prompt }] }],
                            generationConfig: {
                                temperature: 0.7,
                                maxOutputTokens: 1024
                            }
                        }),
                        signal: controller.signal
                    });
                } finally {
                    clearTimeout(timer);
                }

                if (!response.ok) {
                    const errText = await response.text();
                    throw new Error(`API ${response.status}: ${errText.substring(0, 200)}`);
                }

                const data = await response.json();
                const candidate = data?.candidates?.[0]?.content?.parts?.[0]?.text;
                if (candidate) {
                    rawText = candidate;
                    success = true;
                    console.log(`✅ Got response from ${modelName}, length: ${rawText.length}`);
                    break;
                } else {
                    throw new Error("Empty or invalid Gemini response structure");
                }
            } catch (err) {
                console.warn(`⚠️ Model ${modelName} failed: ${err.message}`);
                lastError = err;
            }
        }

        if (!success) {
            throw lastError || new Error("All Gemini models failed.");
        }

        // --- Robust JSON extraction ---
        // 1. Strip markdown code fences (```json ... ``` or ``` ... ```)
        let cleaned = rawText
            .replace(/^```(?:json)?\s*/i, '')
            .replace(/\s*```\s*$/i, '')
            .trim();

        // 2. Extract the JSON object using balanced brace matching
        const start = cleaned.indexOf('{');
        const end = cleaned.lastIndexOf('}');
        if (start === -1 || end === -1) {
            console.error("❌ No JSON object found in response. Raw:", rawText.substring(0, 300));
            throw new Error("Gemini did not return a JSON object.");
        }
        const jsonString = cleaned.slice(start, end + 1);

        // 3. Parse
        let parsed;
        try {
            parsed = JSON.parse(jsonString);
        } catch (parseErr) {
            console.error("❌ JSON parse failed. Raw excerpt:", jsonString.substring(0, 400));
            throw new Error(`JSON parse error: ${parseErr.message}`);
        }

        if (!parsed.cards || !Array.isArray(parsed.cards)) {
            throw new Error("Response JSON missing 'cards' array.");
        }

        return { statusCode: 200, headers, body: JSON.stringify(parsed) };

    } catch (error) {
        console.error("❌ Handler error:", error.message);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: error.message || "Failed to generate news card" })
        };
    }
};