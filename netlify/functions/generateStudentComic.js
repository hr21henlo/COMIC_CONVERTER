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
        const apiKey = process.env.VITE_GEMINI_API_KEY || process.env.GEMINI_API_KEY;

        if (!apiKey) {
            return {
                statusCode: 500,
                headers,
                body: JSON.stringify({ error: "Gemini API key is not configured on the server." })
            };
        }

        const prompt = `
            You are an elite educational comic-book editor. Convert the following historical/humanities textbook passage into a 3-panel comic strip chronicle designed for students to easily visualize the timeline and core events.
            
            Generate a JSON object containing the following fields:
            1. "title": A dramatic, bold historical title for the entire comic strip.
            2. "panels": An array of exactly 3 panel objects (representing chronological story points: Part I: Narrative, Part II: Climax, Part III: Aftermath).
               Each panel object MUST contain:
               - "caption": A concise, educational narrator description of the event (exactly 1-2 sentences, approximately 20-30 words) styled like a classic comic narrator's text box.
               - "imagePrompt": A highly descriptive, detailed image prompt representing the historical action described in the caption.
                 - CRITICAL TEXT-FREE SAFETY GUARD: The image prompt must NOT contain or request any words, letters, text, numbers, symbols that look like letters, speech bubbles, talk bubbles, or character dialogue. Explicitly describe a pure visual composition without any text labels or lettering of any kind in the scene.
                 - CRITICAL STYLE OVERRIDE: The ENTIRE image (characters, environment, background, objects, lighting) MUST be strictly in the "${style}" style. 
                   Do not use realistic, cinematic, or any conflicting styles. Every single visual element must strongly match the "${style}" aesthetic.
                 - CRITICAL CELEBRITY/HISTORICAL FIGURES RULE: Do NOT use real-world copyrighted public figures or modern celebrity names. Describe historical figures generically (e.g., instead of "Napoleon Bonaparte", use "a short French general in an early 19th-century military uniform with a bicorn hat"; instead of "George Washington", use "a tall American general with powdered hair wearing a blue continental army uniform").
            
            Output MUST be in valid JSON format like this:
            {
                "title": "...",
                "panels": [
                    { "caption": "...", "imagePrompt": "..." },
                    { "caption": "...", "imagePrompt": "..." },
                    { "caption": "...", "imagePrompt": "..." }
                ]
            }

            PASSAGE:
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
