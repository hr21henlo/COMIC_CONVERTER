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
                body: JSON.stringify({ error: "Gemini API key is not configured on the server." })
            };
        }

        const prompt = `
            You are an elite comic-book editor. Convert the following article into exactly ${cardCount} chronological/logical visual News Card(s).
            - If exactly 1 card is requested: Summarize the entire article in one high-level card.
            - If exactly 2 cards are requested: Split the article content into 2 chronological segments (Card 1: Background/Setup, Card 2: Climax/Result).
            - If exactly 3 cards are requested: Split the article content into 3 chronological segments (Card 1: Initial Context/Background, Card 2: Core Event/Detailed Data, Card 3: Impact/Future Implications).
            - Make the summaries highly detailed, descriptive, and closer to the original text as the number of cards increases, while still remaining a summarized news layout.

            Generate a JSON object with a single field "cards" containing an array of exactly ${cardCount} card objects. Each card object in the array MUST contain:
            1. "headline": A highly dramatic, punchy comic-book style headline for the top banner of the card.
               - CRITICAL DATA RETENTION RULE: If the card's section contains key metrics, stock prices, percentages, ticker symbols, or major numbers, the headline MUST explicitly include these numbers or metrics. Do not genericize or omit them.
            2. "brief1": A highly dramatic and "comicky" narrative setup of the card's story segment (exactly 2-3 sentences, approximately 40-50 words) written in the style of an energetic classic comic book pulp narrator.
               - CRITICAL COMPREHENSIVENESS & DATA RETENTION RULE: Despite the pulp narrator style, it MUST remain an accurate, thorough summary. You MUST explicitly preserve and include all key metrics, numbers, percentages, dates, stock prices, ticker symbols, and specific names relevant to this section of the text.
            3. "brief2": A highly dramatic and "comicky" continuation or impact statement of the card's story segment (exactly 2-3 sentences, approximately 40-50 words) continuing the energetic pulp narrator style.
               - CRITICAL COMPREHENSIVENESS & DATA RETENTION RULE: Continue the summary in the same pulp style while explicitly including all remaining facts, statistics, percentages, metrics, and outcomes from the original text segment.
            4. "imagePrompt": A detailed, highly descriptive image prompt for an AI image generator representing the core action and data of this card's section.
               - STYLE & GRAPHICAL DIRECTIVE: Map the numerical quantities from the article into visual elements. Describe the layout precisely (e.g., waffle units, stock charts, blueprints).
               - CRITICAL TEXT-FREE SAFETY GUARD: The image prompt must NOT contain or request any words, letters, text, numbers, symbols, or character dialogue. The chart/diagram must be completely wordless and numberless.
               - CRITICAL STYLE OVERRIDE: The ENTIRE image MUST be strictly in the "${style}" style. Do not use realistic or cinematic elements.
               - CRITICAL CELEBRITY RULE: Do NOT use real-world celebrity names or copyrighted public figures. Describe them generically.

            Output MUST match this JSON structure:
            {
                "cards": [
                    {
                        "headline": "...",
                        "brief1": "...",
                        "brief2": "...",
                        "imagePrompt": "..."
                    }
                ]
            }

            ARTICLE:
            ${text}
        `;

        // Valid Gemini production models
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
                        contents: [{
                            parts: [{ text: prompt }]
                        }],
                        // Tells the Gemini engine to natively structure output as JSON
                        generationConfig: {
                            responseMimeType: "application/json"
                        }
                    })
                });

                if (!response.ok) {
                    const errorDetail = await response.text();
                    throw new Error(`HTTP ${response.status}: ${errorDetail}`);
                }

                const data = await response.json();
                
                if (data.candidates?.[0]?.content?.parts?.[0]?.text) {
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

        // Direct parsing without dangerous regex matching since responseMimeType is enforced
        const parsedJson = JSON.parse(responseText.trim());

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