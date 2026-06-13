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
               - CRITICAL DATA RETENTION RULE: If the article contains key metrics, stock prices, percentages, ticker symbols, or major numbers, the headline MUST explicitly include these numbers or metrics. Do not genericize or omit them.
            2. "brief1": A highly informative, detailed narrative setup of the news story (exactly 2-3 sentences, approximately 40-50 words) styled like a classic comic narrator's text box.
               - CRITICAL DATA RETENTION RULE: This must be an accurate, detailed summary of the main facts. You MUST explicitly preserve and include key metrics, numbers, percentages, dates, stock prices, ticker symbols, and specific names from the article. Do not omit or simplify the core details.
            3. "brief2": A highly informative, detailed continuation or impact statement of the news story (exactly 2-3 sentences, approximately 40-50 words) styled like a second comic narrator's text box.
               - CRITICAL DATA RETENTION RULE: Continue the detailed narrative summary while explicitly preserving and including the remaining main facts, statistics, percentages, and metrics.
            4. "imagePrompt": A detailed, highly descriptive image prompt for an AI image generator representing the core action and data of the article.
               - STYLE & GRAPHICAL DIRECTIVE:
                 - If the news is data-driven, stock-market-related, financial, or statistical, the image MUST symbolise and show exactly what the news is by depicting a high-quality stylized graphical display of the data: e.g., a waffle grid chart of square colored blocks representing proportions of energy/resources, a polar network/radar plot showing connections between circular nodes, a clean rising/falling stock chart with colored nodes, or a schematic blueprint/infographic of the system (like solar panels, buildings, or microchips).
                 - Map the numerical quantities from the article into visual elements. Describe the layout precisely: e.g., 'a waffle unit grid of 100 squares, where 80 squares are colored bright green representing the non-fossil target and 20 squares are orange representing transmission'.
                 - If the news is action/event-driven, depict the actual physical event described in the article in a highly symbolic way.
                 - CRITICAL TEXT-FREE SAFETY GUARD: The image prompt must NOT contain or request any words, letters, text, numbers, symbols that look like letters, speech bubbles, talk bubbles, or character dialogue. The chart/diagram must be completely wordless and numberless, conveying the data purely through visual shapes, colors, lines, grids, charts, and diagrams.
               - CRITICAL STYLE OVERRIDE: The ENTIRE image (characters, environment, background, objects, lighting) MUST be strictly in the "${style}" style. 
                 Do not use realistic, cinematic, or any conflicting styles. Every single visual element must strongly match the "${style}" aesthetic.
               - CRITICAL CELEBRITY RULE: Do NOT use real-world celebrity names, specific athletes, or copyrighted public figures in the descriptions, as this triggers the image generator's safety/censorship filters. Instead, describe them generically (e.g., instead of "Cristiano Ronaldo", use "a world-famous athletic Portuguese soccer player wearing a custom kit with number 7"; instead of "LeBron James", use "a towering athletic basketball star in a purple and gold jersey"; instead of "Elon Musk", use "a wealthy tech entrepreneur").

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
