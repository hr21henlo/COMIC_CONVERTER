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
            return { statusCode: 500, headers, body: JSON.stringify({ error: "Gemini API key not configured on Netlify. Go to Site Config > Environment Variables and add GEMINI_API_KEY." }) };
        }

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

        // Try both v1 and v1beta endpoints with multiple models
        // v1 is more stable for some API key types; v1beta has newer models
        const attempts = [
            { model: "gemini-2.0-flash",       version: "v1beta" },
            { model: "gemini-2.0-flash",       version: "v1" },
            { model: "gemini-1.5-flash-latest", version: "v1beta" },
            { model: "gemini-1.5-flash-latest", version: "v1" },
            { model: "gemini-1.5-flash",        version: "v1" },
            { model: "gemini-2.5-flash-lite",   version: "v1beta" }
        ];

        let rawText = "";
        let success = false;
        let debugErrors = [];

        for (const { model, version } of attempts) {
            const label = `${model} (${version})`;
            try {
                console.log(`🤖 Trying: ${label}`);
                const url = `https://generativelanguage.googleapis.com/${version}/models/${model}:generateContent?key=${apiKey}`;

                const controller = new AbortController();
                const timer = setTimeout(() => controller.abort(), 7000);

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
                    const shortErr = `HTTP ${response.status}: ${errText.replace(/\s+/g, ' ').substring(0, 120)}`;
                    debugErrors.push(`${label} → ${shortErr}`);
                    console.warn(`⚠️ ${label}: ${shortErr}`);
                    continue;
                }

                const data = await response.json();
                const candidate = data?.candidates?.[0]?.content?.parts?.[0]?.text;

                if (candidate && candidate.trim().length > 10) {
                    rawText = candidate;
                    success = true;
                    console.log(`✅ Got response from ${label} (${rawText.length} chars)`);
                    break;
                } else {
                    const reason = data?.candidates?.[0]?.finishReason || 'unknown';
                    debugErrors.push(`${label} → empty response (finishReason: ${reason})`);
                }
            } catch (err) {
                const msg = err.name === 'AbortError' ? 'timed out (7s)' : err.message;
                debugErrors.push(`${label} → ${msg}`);
                console.warn(`⚠️ ${label}: ${msg}`);
            }
        }

        if (!success) {
            const details = debugErrors.join(' | ');
            throw new Error(`All model attempts failed. Details: ${details}`);
        }

        // Robust JSON extraction
        let cleaned = rawText
            .replace(/^```(?:json)?\s*/i, '')
            .replace(/\s*```\s*$/i, '')
            .trim();

        const start = cleaned.indexOf('{');
        const end = cleaned.lastIndexOf('}');

        if (start === -1 || end === -1) {
            const preview = rawText.substring(0, 150).replace(/\n/g, ' ');
            throw new Error(`Gemini returned no JSON. Response preview: "${preview}"`);
        }

        let parsed;
        try {
            parsed = JSON.parse(cleaned.slice(start, end + 1));
        } catch (parseErr) {
            const preview = cleaned.slice(start, start + 200).replace(/\n/g, ' ');
            throw new Error(`JSON parse failed: ${parseErr.message}. Content: "${preview}"`);
        }

        if (!parsed.cards || !Array.isArray(parsed.cards) || parsed.cards.length === 0) {
            throw new Error(`JSON missing 'cards' array. Got keys: ${Object.keys(parsed).join(', ')}`);
        }

        console.log(`✅ Done: ${parsed.cards.length} card(s)`);
        return { statusCode: 200, headers, body: JSON.stringify(parsed) };

    } catch (error) {
        console.error("❌ Error:", error.message);
        return { statusCode: 500, headers, body: JSON.stringify({ error: error.message }) };
    }
};