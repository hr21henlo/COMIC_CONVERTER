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
            return { statusCode: 500, headers, body: JSON.stringify({ error: "Gemini API key not configured." }) };
        }

        // System instruction forces JSON-only output at the model level
        const systemInstruction = {
            parts: [{ text: "You are a JSON-only API. You MUST respond with a single raw JSON object. Never use markdown, code fences, or any explanatory text. Only output the JSON." }]
        };

        const userPrompt = `Convert this news article into ${cardCount} comic card(s).

Return ONLY this JSON structure (fill in the values):
{"cards":[{"headline":"...","brief1":"...","brief2":"...","imagePrompt":"..."}]}

Rules:
- headline: punchy comic-book headline with key facts/numbers
- brief1: 2-3 sentences, pulp-narrator style, max 45 words, include dates/metrics  
- brief2: 2-3 sentences, pulp-narrator continuation, max 45 words
- imagePrompt: visual scene in "${style}" art style, absolutely NO text or numbers in the described image
- If ${cardCount} > 1, include ${cardCount} objects in the cards array

ARTICLE: ${text}`;

        const modelsToTry = ["gemini-1.5-flash", "gemini-2.5-flash"];
        let rawText = "";
        let success = false;
        let lastError = null;
        let debugInfo = {};

        for (const modelName of modelsToTry) {
            try {
                console.log(`🤖 Trying: ${modelName}`);
                const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;

                const controller = new AbortController();
                const timer = setTimeout(() => controller.abort(), 8500);

                let response;
                try {
                    response = await fetch(url, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            system_instruction: systemInstruction,
                            contents: [{ parts: [{ text: userPrompt }] }]
                        }),
                        signal: controller.signal
                    });
                } finally {
                    clearTimeout(timer);
                }

                if (!response.ok) {
                    const errText = await response.text();
                    debugInfo[modelName] = `HTTP ${response.status}: ${errText.substring(0, 150)}`;
                    throw new Error(`API ${response.status}: ${errText.substring(0, 150)}`);
                }

                const data = await response.json();
                const candidate = data?.candidates?.[0]?.content?.parts?.[0]?.text;

                if (candidate) {
                    rawText = candidate;
                    success = true;
                    console.log(`✅ Got text from ${modelName} (${rawText.length} chars). Preview: ${rawText.substring(0, 80)}`);
                    break;
                } else {
                    const reason = data?.candidates?.[0]?.finishReason || JSON.stringify(data).substring(0, 100);
                    debugInfo[modelName] = `No candidate text. finishReason: ${reason}`;
                    throw new Error(`No text in response. finishReason: ${reason}`);
                }
            } catch (err) {
                if (err.name === 'AbortError') {
                    debugInfo[modelName] = 'Timed out (8.5s)';
                    console.warn(`⏱️ ${modelName} timed out`);
                } else {
                    console.warn(`⚠️ ${modelName} failed: ${err.message}`);
                }
                lastError = err;
            }
        }

        if (!success) {
            throw new Error(`All models failed. Details: ${JSON.stringify(debugInfo)}`);
        }

        // --- Robust JSON extraction ---
        // Strip markdown fences if model ignored instructions
        let cleaned = rawText
            .replace(/^```(?:json)?\s*/i, '')
            .replace(/\s*```\s*$/i, '')
            .trim();

        const start = cleaned.indexOf('{');
        const end = cleaned.lastIndexOf('}');

        if (start === -1 || end === -1) {
            // Include preview of what Gemini actually said for debugging
            const preview = rawText.substring(0, 200).replace(/\n/g, ' ');
            throw new Error(`No JSON in response. Gemini said: "${preview}..."`);
        }

        const jsonStr = cleaned.slice(start, end + 1);
        let parsed;
        try {
            parsed = JSON.parse(jsonStr);
        } catch (parseErr) {
            const preview = jsonStr.substring(0, 200).replace(/\n/g, ' ');
            throw new Error(`JSON parse error at: ${parseErr.message}. Content: "${preview}"`);
        }

        if (!parsed.cards || !Array.isArray(parsed.cards) || parsed.cards.length === 0) {
            throw new Error(`Missing 'cards' array in JSON. Got keys: ${Object.keys(parsed).join(', ')}`);
        }

        console.log(`✅ Success: ${parsed.cards.length} card(s) generated`);
        return { statusCode: 200, headers, body: JSON.stringify(parsed) };

    } catch (error) {
        console.error("❌ Handler error:", error.message);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: error.message })
        };
    }
};