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

        const { text, style, numCards, num_panels, panel_count, count } = JSON.parse(event.body);
        const cardCount = parseInt(numCards || num_panels || panel_count || count, 10) || 3;
        const apiKey = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY;

        if (!apiKey) {
            return {
                statusCode: 500,
                headers,
                body: JSON.stringify({ error: "Gemini API key is not configured on the server." })
            };
        }

        const STYLE_MAP = {
            "Manga": "highly detailed Japanese Manga style, cel-shaded anime, clean ink lines, flat colors, masterpiece",
            "Vintage": "1950s golden age comic book style, halftone dots, retro colors, vintage ink",
            "3D": "3D animated movie style, Pixar style render, Octane render, volumetric lighting, high poly",
            "Disney": "classic 2D western animation style, expressive characters, vibrant painted backgrounds",
            "Default": "high quality graphic novel style, detailed comic book art"
        };

        const selectedStyleKeywords = STYLE_MAP[style] || STYLE_MAP["Default"];

        const geminiSystemInstruction = `
You are a master comic book director. Your job is to translate the user's raw text into a strict, highly descriptive image generation prompt for NVIDIA Flux.

CRITICAL RULES:
1. EXTRACT EXACT SUBJECTS: Identify exactly what the user is asking for (e.g., if they ask for animals, only describe animals. If they ask for politicians, describe politicians). NEVER hallucinate or add human characters (like anime girls or bystanders) unless the user explicitly asks for them in their text.
2. STRICT ART STYLE: Every prompt MUST end with this exact string: ", ${selectedStyleKeywords}".
3. SINGLE FRAME ENFORCER: Every prompt MUST include: ", single continuous scene, single frame, wide angle view, no internal frames."
4. NO TEXT ALLOWED: Every prompt MUST include: ", no text, no speech bubbles, no kanji, no watermarks."

FORMAT YOUR OUTPUT EXACTLY LIKE THIS:
"[Exact subjects and actions extracted from user text], in ${selectedStyleKeywords}, single continuous scene, single frame, wide angle view, no internal frames, no text, no speech bubbles, no kanji, no watermarks."
`;

        const prompt = `
            ${geminiSystemInstruction}

            You are an elite comic-book editor. Convert the following article into exactly ${cardCount} chronological comic book panel(s).
            If the article is long (300+ words), divide it logically across all ${cardCount} panels to tell a complete visual story from start to finish.

            Generate a JSON object with a single field "cards" containing an array of exactly ${cardCount} card/panel objects. Each card object in the array MUST contain:
            1. "headline": A highly dramatic, punchy comic-book style title/headline for the top banner of the panel (e.g. "CHAPTER 1: THE DISCOVERY!").
               - Include any major key numbers, metrics, or ticker symbols if present in this segment.
            2. "speechBubble": A short, punchy, energetic character dialogue or character thought (1-2 short sentences, 10-25 words max) to be placed inside a comic speech/thought cloud.
            3. "brief1": A dramatic pulp narrator setup of this story segment (1-2 sentences, ~30-40 words) for the narrator box.
            4. "brief2": A dramatic pulp narrator continuation or outcome of this story segment (1-2 sentences, ~30-40 words).
            5. "imagePrompt": A detailed, highly descriptive visual-only image prompt for an AI image generator representing the core action, characters, subject, and setting of this panel.
               - VISUAL STORYTELLING DIRECTIVE: Describe the characters, subject, action, environment, lighting, and art style.
               - MUST BEGIN WITH: "${selectedStyleKeywords}".
               - CRITICAL TEXT-FREE SAFETY GUARD: The imagePrompt MUST NOT contain any words, letters, text, numbers, symbols, speech bubbles, or dialogue. Describe ONLY the physical visual scene.
               - CRITICAL CELEBRITY RULE: Do NOT use real-world celebrity names. Describe them generically.

            Output MUST match this JSON structure:
            {
                "cards": [
                    {
                        "headline": "...",
                        "speechBubble": "...",
                        "brief1": "...",
                        "brief2": "...",
                        "imagePrompt": "..."
                    }
                ]
            }

            ARTICLE:
            ${text}
        `;

        const modelsToTry = [
            "gemini-2.5-flash",
            "gemini-2.0-flash",
            "gemini-1.5-pro",
            "gemini-1.5-flash-8b",
            "gemini-1.0-pro"
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

        // Robust JSON cleaning and parsing helper
        const cleanAndParseJSON = (raw) => {
            let cleaned = raw.trim()
                .replace(/^```(?:json)?\s*/i, '')
                .replace(/\s*```\s*$/i, '')
                .trim();

            const firstBrace = cleaned.indexOf('{');
            const lastBrace = cleaned.lastIndexOf('}');
            if (firstBrace !== -1 && lastBrace !== -1) {
                cleaned = cleaned.slice(firstBrace, lastBrace + 1);
            }

            // Remove trailing commas before closing braces/brackets
            cleaned = cleaned.replace(/,\s*([\}\]])/g, '$1');

            try {
                return JSON.parse(cleaned);
            } catch (pErr) {
                console.warn("⚠️ Initial JSON.parse failed. Sanitizing string control chars...");
                // Sanitize raw newlines/tabs inside JSON string values
                const sanitized = cleaned
                    .replace(/\r?\n|\r/g, '\\n')
                    .replace(/\t/g, ' ');
                return JSON.parse(sanitized);
            }
        };

        const parsedJson = cleanAndParseJSON(responseText);

        // Guarantee exact cardCount cards in response
        if (!parsedJson || typeof parsedJson !== 'object') {
            throw new Error("Invalid JSON structure returned by Gemini.");
        }

        if (!Array.isArray(parsedJson.cards)) {
            parsedJson.cards = [];
        }

        console.log(`📊 Gemini returned ${parsedJson.cards.length} cards, target count: ${cardCount}`);

        // Pad if Gemini returned fewer cards than requested
        while (parsedJson.cards.length < cardCount) {
            const idx = parsedJson.cards.length;
            const refCard = parsedJson.cards[idx - 1] || parsedJson.cards[0] || {};
            parsedJson.cards.push({
                headline: `CHAPTER ${idx + 1}: THE STORY CONTINUES!`,
                speechBubble: refCard.speechBubble || "WHAT CAN WE EXPECT NEXT IN THIS ESCALATING DRAMA?",
                brief1: refCard.brief1 || `Chapter ${idx + 1} brings unexpected developments to the scene.`,
                brief2: refCard.brief2 || "The tension mounts as new revelations come to light.",
                imagePrompt: `${refCard.imagePrompt || text}, comic book illustration panel ${idx + 1}, dramatic angle, ${style}`
            });
        }

        // Slice if Gemini returned more cards than requested
        if (parsedJson.cards.length > cardCount) {
            parsedJson.cards = parsedJson.cards.slice(0, cardCount);
        }

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