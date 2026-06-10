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
        const { text, style } = JSON.parse(event.body);
        const apiKey = process.env.VITE_GEMINI_API_KEY;

        if (!apiKey) {
            return {
                statusCode: 500,
                headers,
                body: JSON.stringify({ error: "Gemini API key is not configured on the server." })
            };
        }

        const prompt = `
            You are an elite comic-book editor. Convert the following article into a 1-panel visual News Card.
            Generate the following four fields in JSON format:
            1. "headline": A highly dramatic, punchy comic-book style headline for the top banner of the card.
            2. "brief1": A dramatic narrative setup of the news story (exactly 1-2 sentences, approximately 20-30 words) styled like a classic comic narrator's text box.
            3. "brief2": A dramatic continuation or impact statement of the news story (exactly 1-2 sentences, approximately 20-30 words) styled like a second comic narrator's text box, providing more details.
            4. "imagePrompt": A detailed, highly descriptive image prompt for an AI image generator representing the core action of the article.
               CRITICAL STYLE OVERRIDE: The ENTIRE image (characters, environment, background, objects, lighting) MUST be strictly in the "${style}" style. 
               Do not use realistic, cinematic, or any conflicting styles. Every single visual element must strongly match the "${style}" aesthetic.
               CRITICAL CELEBRITY RULE: Do NOT use real-world celebrity names, specific athletes, or copyrighted public figures in the descriptions, as this triggers the image generator's safety/censorship filters. Instead, describe them generically (e.g., instead of "Cristiano Ronaldo", use "a world-famous athletic Portuguese soccer player wearing a custom kit with number 7"; instead of "LeBron James", use "a towering athletic basketball star in a purple and gold jersey"; instead of "Elon Musk", use "a wealthy tech entrepreneur").

            Output MUST be in valid JSON format like this:
            {
                "headline": "...",
                "brief1": "...",
                "brief2": "...",
                "imagePrompt": "..."
            }

            ARTICLE:
            ${text}
        `;

        // Active 2026 models to try
        const modelsToTry = [
            "gemini-2.5-flash",
            "gemini-3-flash",
            "gemini-2.5-flash-lite"
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
                        contents: [{
                            parts: [{ text: prompt }]
                        }]
                    })
                });

                if (!response.ok) {
                    const errorDetail = await response.text();
                    throw new Error(`HTTP ${response.status}: ${errorDetail}`);
                }

                const data = await response.json();
                
                if (data.candidates && data.candidates[0] && data.candidates[0].content && data.candidates[0].content.parts[0]) {
                    responseText = data.candidates[0].content.parts[0].text;
                    success = true;
                    console.log(`✅ Backend successfully generated using model: ${modelName}`);
                    break;
                } else {
                    throw new Error("Invalid response format from Gemini API");
                }
            } catch (err) {
                console.warn(`⚠️ Backend model ${modelName} failed:`, err.message);
                lastError = err;
            }
        }

        if (!success) {
            throw lastError || new Error("All tried Gemini models failed to generate content.");
        }

        // Parse JSON from response
        const jsonMatch = responseText.match(/\{[\s\S]*\}/);
        if (!jsonMatch) throw new Error("Could not parse storyboard JSON from Gemini response");
        const parsedJson = JSON.parse(jsonMatch[0]);

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify(parsedJson)
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
