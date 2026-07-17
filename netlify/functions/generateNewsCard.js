exports.handler = async (event, context) => {
    // Enable CORS
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS'
    };

    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 200, headers, body: '' };
    }

    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, headers, body: 'Method Not Allowed' };
    }

    try {
        if (!event.body) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ error: "Missing request body." })
            };
        }

        const { text, style, numCards } = JSON.parse(event.body);
        const cardCount = parseInt(numCards, 10) || 1;
        const apiKey = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY;

        if (!apiKey) {
            return {
                statusCode: 500,
                headers,
                body: JSON.stringify({ error: "Gemini API key is not configured on Netlify." })
            };
        }

        // Streamlined prompt to guarantee blazing-fast responses under Netlify's 10s limit
        const prompt = `Convert this article into exactly ${cardCount} chronological comic news cards. Output valid JSON matching the schema below.
Style requirement: ${style}

JSON Schema:
{
  "cards": [
    {
      "headline": "Dramatic headline including key metrics or numbers.",
      "brief1": "Pulp-narrator comic style story setup (2-3 sentences, max 50 words). Include concrete dates/facts.",
      "brief2": "Pulp-narrator style outcome continuation (2-3 sentences, max 50 words). Include metrics/data.",
      "imagePrompt": "Visual description for image generator in pure ${style} style. Absolutely NO text, words, or numbers."
    }
  ]
}

ARTICLE:
${text}`;

        // Using high-speed production models to prevent latency timeouts
        const modelsToTry = [
            "gemini-1.5-flash",
            "gemini-2.5-flash"
        ];

        let responseText = "";
        let success = false;
        let lastError = null;

        for (const modelName of modelsToTry) {
            try {
                console.log(`🤖 Backend trying model: ${modelName}`);
                const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;
                
                const response = await fetch(url, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        contents: [{ parts: [{ text: prompt }] }],
                        generationConfig: { responseMimeType: "application/json" }
                    })
                });

                if (response.ok) {
                    const data = await response.json();
                    if (data.candidates?.[0]?.content?.parts?.[0]?.text) {
                        responseText = data.candidates[0].content.parts[0].text;
                        success = true;
                        console.log(`✅ Backend successfully generated using model: ${modelName}`);
                        break;
                    }
                } else {
                    const errText = await response.text();
                    throw new Error(`Status ${response.status}: ${errText}`);
                }
            } catch (err) {
                console.warn(`⚠️ Model ${modelName} failed:`, err.message);
                lastError = err;
            }
        }

        if (!success) {
            throw lastError || new Error("All tried Gemini models failed to respond in time.");
        }

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify(JSON.parse(responseText.trim()))
        };

    } catch (error) {
        console.error("❌ Backend Storyboard Error:", error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: error.message || "Failed to generate storyboard" })
        };
    }
};