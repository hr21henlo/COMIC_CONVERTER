// Module-scoped smart model preference and quota tracking
const exhaustedModels = new Set();
let preferredModel = "gemini-2.5-flash-lite";

const CANDIDATE_MODELS = [
    "gemini-2.5-flash-lite",
    "gemini-3.1-flash-lite",
    "gemini-2.5-flash",
    "gemini-flash-latest"
];

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

        const { text, style, numCards, num_panels, panel_count, count, factSheet: cachedFactSheet } = JSON.parse(event.body);
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

        // ──────────────────────────────────────────────────────────────
        // SHARED: Safety settings for all Gemini calls.
        // News articles inherently reference violence, religion, politics,
        // etc. Default thresholds strip these terms and produce factually
        // inaccurate summaries.
        // ──────────────────────────────────────────────────────────────
        const safetySettings = [
            { category: "HARM_CATEGORY_HARASSMENT",         threshold: "BLOCK_ONLY_HIGH" },
            { category: "HARM_CATEGORY_HATE_SPEECH",        threshold: "BLOCK_ONLY_HIGH" },
            { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT",  threshold: "BLOCK_MEDIUM_AND_ABOVE" },
            { category: "HARM_CATEGORY_DANGEROUS_CONTENT",  threshold: "BLOCK_ONLY_HIGH" }
        ];

        // ──────────────────────────────────────────────────────────────
        // SHARED: Robust JSON cleaning and parsing helper
        // ──────────────────────────────────────────────────────────────
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

        // ──────────────────────────────────────────────────────────────
        // SHARED: Call Gemini with smart model fallback and quota caching
        // ──────────────────────────────────────────────────────────────
        const callGemini = async (promptText, temperature = undefined) => {
            let responseText = "";
            let lastError = null;

            // Prioritize preferredModel, then other candidate models, skipping any known 429 models
            const activeModels = [
                preferredModel,
                ...CANDIDATE_MODELS.filter(m => m !== preferredModel)
            ].filter(m => !exhaustedModels.has(m));

            const modelsToTry = activeModels.length > 0 ? activeModels : CANDIDATE_MODELS;

            for (const modelName of modelsToTry) {
                const controller = new AbortController();
                // 10s per model call ensures we never blow past the 30s Netlify timeout
                const timeout = setTimeout(() => controller.abort(), 10000);

                try {
                    console.log(`🤖 Trying model: ${modelName}`);
                    const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;

                    const generationConfig = {
                        responseMimeType: "application/json",
                        thinkingConfig: { thinkingBudget: 0 }
                    };
                    if (temperature !== undefined) {
                        generationConfig.temperature = temperature;
                    }

                    const response = await fetch(url, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            contents: [{ parts: [{ text: promptText }] }],
                            generationConfig,
                            safetySettings
                        }),
                        signal: controller.signal
                    });

                    clearTimeout(timeout);

                    if (!response.ok) {
                        const errorDetail = await response.text();
                        if (response.status === 429) {
                            console.warn(`🛑 Model ${modelName} exceeded quota (429). Blacklisting model for this session.`);
                            exhaustedModels.add(modelName);
                        }
                        throw new Error(`HTTP ${response.status}: ${errorDetail.substring(0, 200)}`);
                    }

                    const data = await response.json();

                    if (data.candidates?.[0]?.content?.parts?.[0]?.text) {
                        responseText = data.candidates[0].content.parts[0].text;
                        console.log(`✅ Success with model: ${modelName}`);
                        preferredModel = modelName;
                        return responseText;
                    } else {
                        throw new Error("Invalid response format from Gemini API");
                    }
                } catch (err) {
                    clearTimeout(timeout);
                    console.warn(`⚠️ Model ${modelName} failed:`, err.message);
                    lastError = err;
                }
            }

            throw lastError || new Error("All tried Gemini models failed to generate content.");
        };


        // ══════════════════════════════════════════════════════════════
        //  PASS 1 — FACT EXTRACTION
        //  Run once per article. Skipped on regeneration when the
        //  frontend sends back a cached factSheet.
        // ══════════════════════════════════════════════════════════════
        let factSheet = cachedFactSheet || null;

        if (!factSheet) {
            console.log("📰 Pass 1: Extracting fact-sheet from article...");

            const factExtractionPrompt = `
You are a senior wire-service editor performing FACT EXTRACTION on a news article.
Your job is to produce a structured JSON fact-sheet that captures EVERY important
detail from the article. This fact-sheet will be used by a downstream system to
generate a comic-book adaptation — but YOUR job is ONLY extraction, not storytelling.

═══════════════════════════════════════════════════════
  EXTRACTION RULES
═══════════════════════════════════════════════════════
• Read the ENTIRE article carefully before extracting.
• Extract ALL of the following categories. If a category has no data in the
  article, use an empty array or empty string — do NOT omit the field.
• Be EXHAUSTIVE. It is better to include a minor detail than to miss it.
• Use the EXACT words, names, and numbers from the article — do not
  paraphrase, round, or generalise.
• Preserve sensitive/controversial terminology exactly as written in the
  source (religious group names, political terms, crime terminology, etc.).
  This is factual extraction, not content generation.

═══════════════════════════════════════════════════════
  SENSITIVE-CONTENT POLICY
═══════════════════════════════════════════════════════
• This tool extracts facts from real-world news. News inherently covers
  conflict, crime, politics, religion, disasters, and policy.
• You MUST retain factually accurate terminology from the source article
  even when it includes words like: violence, attack, terrorism, terrorist,
  extremism, drugs, narcotics, trafficking, murder, assault, religious
  group names (Hindu, Muslim, Christian, Sikh, Jewish, Buddhist, etc.),
  caste names, ethnic identifiers, political party names, militant group
  names, or any other term that is FACTUALLY PRESENT in the source.
• Sanitising these words would make the extraction factually inaccurate.
• You are NOT generating hate speech — you are EXTRACTING reported facts.

OUTPUT — strict JSON, no markdown fencing:
{
    "headline_focus": "Single sentence: the article's most headline-worthy statement",
    "key_entities": {
        "people": ["Full Name — role/title (e.g. 'Narendra Modi — Prime Minister of India')"],
        "organisations": ["Organisation name — context"],
        "locations": ["Specific place name — context (city, state, country as applicable)"]
    },
    "key_numbers": ["Exact figure with context, e.g. '47 people killed in the earthquake'", "$3.2 billion allocated for relief"],
    "key_dates": ["Exact date or timeframe mentioned, e.g. 'October 14, 2026', 'over the past 3 months'"],
    "key_events": [
        "Event 1: Concise WHO did WHAT WHERE WHEN — in one sentence",
        "Event 2: ..."
    ],
    "key_quotes": ["Exact or near-exact direct quotes from the article with attribution"],
    "cause_and_consequence": "Why it happened and what resulted — 1-2 sentences",
    "secondary_details": ["Any other noteworthy facts, context, or background not captured above"]
}

ARTICLE:
${text}
`;

            const factRaw = await callGemini(factExtractionPrompt, 0.1);
            factSheet = cleanAndParseJSON(factRaw);
            console.log("✅ Pass 1 complete. Fact-sheet extracted:", JSON.stringify(factSheet).substring(0, 300) + "...");
        } else {
            console.log("♻️ Reusing cached fact-sheet from frontend (skipping Pass 1).");
        }


        // ══════════════════════════════════════════════════════════════
        //  PASS 2 — COMIC PANEL GENERATION
        //  Constrained by the fact-sheet from Pass 1.
        //  Runs on every generation and regeneration.
        // ══════════════════════════════════════════════════════════════
        console.log(`🎨 Pass 2: Generating ${cardCount} comic panels constrained by fact-sheet...`);

        const comicPrompt = `
You are a veteran investigative-journalism editor who also directs comic-book adaptations of real news.
Your PRIMARY obligation is FACTUAL FIDELITY to the source article. Your secondary obligation is visual storytelling.

═══════════════════════════════════════════════════════
  MANDATORY FACT-SHEET (extracted from the article)
═══════════════════════════════════════════════════════
The following fact-sheet was pre-extracted from the article. These are the
ground-truth facts. You MUST weave ALL of them into your comic panels.

${JSON.stringify(factSheet, null, 2)}

═══════════════════════════════════════════════════════
  FACT COVERAGE CHECKLIST — YOU MUST SATISFY ALL
═══════════════════════════════════════════════════════
Before outputting, mentally verify:
✅ headline_focus → appears in at least one panel's "headline"
✅ Every person in key_entities.people → named in at least one "headline", "brief1", or "brief2"
✅ Every organisation in key_entities.organisations → mentioned in at least one "brief1" or "brief2"
✅ Every location in key_entities.locations → mentioned in at least one "brief1" or "brief2"
✅ Every item in key_numbers → appears VERBATIM in at least one "headline", "brief1", or "brief2"
✅ Every item in key_dates → appears in at least one "brief1" or "brief2"
✅ Every item in key_events → covered by the combination of headline + brief1 + brief2 of at least one panel
✅ key_quotes → at least one adapted into a "speechBubble"
✅ cause_and_consequence → covered across the panels' brief2 fields

If ANY fact from the fact-sheet is missing from your output, your output is INVALID.
Go back and add it before responding.

═══════════════════════════════════════════════════════
  SENSITIVE-CONTENT POLICY FOR NEWS SUMMARISATION
═══════════════════════════════════════════════════════
• This tool summarises real-world news. News inherently covers conflict,
  crime, politics, religion, disasters, and policy.
• You MUST retain factually accurate terminology from the fact-sheet and
  source article even when it includes words like: violence, attack,
  terrorism, terrorist, extremism, drugs, narcotics, trafficking, murder,
  assault, religious group names (Hindu, Muslim, Christian, Sikh, Jewish,
  Buddhist, etc.), caste names, ethnic identifiers, political party names,
  militant group names, or any other term that is FACTUALLY PRESENT.
• You are NOT generating hate speech — you are REPORTING on events.

═══════════════════════════════════════════════════════
  IMAGE-PROMPT RULES (for the imagePrompt field ONLY)
═══════════════════════════════════════════════════════
1. EXTRACT EXACT SUBJECTS from the article segment. Describe only what the
   article describes. NEVER hallucinate extra characters or props.
2. STRICT ART STYLE: Every imagePrompt MUST end with: ", ${selectedStyleKeywords}".
3. SINGLE FRAME: Every imagePrompt MUST include: ", single continuous scene,
   single frame, wide angle view, no internal frames."
4. NO TEXT: Every imagePrompt MUST include: ", no text, no speech bubbles,
   no kanji, no watermarks."
5. NO CELEBRITY NAMES: Describe public figures by role/appearance only
   (e.g. "a middle-aged man in a dark suit at a podium" instead of the
   real name). This rule applies ONLY to imagePrompt, NOT to headlines
   or briefs where real names MUST be preserved.

═══════════════════════════════════════════════════════
  TASK
═══════════════════════════════════════════════════════
Convert the following news article into exactly ${cardCount} chronological comic-book panel(s).

SEGMENTATION RULES:
• Read the ENTIRE article first. Identify the ${cardCount} most important narrative beats.
• Each panel must cover a distinct segment of the article IN CHRONOLOGICAL ORDER.
• For long articles (300+ words), ensure the full arc — setup, key developments,
  and outcome/conclusion — is distributed across all ${cardCount} panels.
• NO fact from the MANDATORY FACT-SHEET should be left uncovered across the full set of panels.

FOR EACH PANEL, generate a JSON object with these fields:

1. "headline"
   - A punchy, dramatic comic-book banner headline for this panel.
   - MUST include the key names, numbers, or metrics from this segment.
   - Example: "EARTHQUAKE STRIKES TÜRKIYE — 47 DEAD, THOUSANDS TRAPPED"
   - NOT: "DISASTER STRIKES!" (too vague, loses all information)

2. "speechBubble"
   - A short, energetic first-person quote or thought (10–25 words).
   - Should reflect a viewpoint present in the article (a quoted official, witness, etc.).
   - If the fact-sheet contains a key_quote, ADAPT it for a speech bubble.

3. "brief1"
   - A narrator-box sentence covering the WHO + WHAT + WHERE of this segment.
   - 30–50 words. Factual and specific. Use real names, places, and figures.

4. "brief2"
   - A narrator-box sentence covering the WHY + consequences/next-steps of this segment.
   - 30–50 words. Factual and specific.

5. "imagePrompt"
   - A detailed visual-only scene description for an AI image generator.
   - Describe: characters (by appearance, NOT by name), action, environment,
     lighting, camera angle, mood.
   - MUST begin with: "${selectedStyleKeywords}".
   - MUST include: ", single continuous scene, single frame, wide angle view, no internal frames, no text, no speech bubbles, no kanji, no watermarks."
   - NO real celebrity/politician names — describe by role and appearance only.
   - NO written text, letters, symbols, or dialogue in the visual description.

OUTPUT FORMAT — strict JSON, no markdown fencing:
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

        const comicRaw = await callGemini(comicPrompt);
        const parsedJson = cleanAndParseJSON(comicRaw);

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

        // Return cards + factSheet so the frontend can cache it for regeneration
        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                cards: parsedJson.cards,
                factSheet: factSheet
            })
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