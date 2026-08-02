exports.handler = async (event, context) => {
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS'
    };

    if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };
    if (event.httpMethod !== 'POST') return { statusCode: 405, headers, body: 'Method Not Allowed' };

    try {
        const { text, targetLanguage } = JSON.parse(event.body);
        const sarvamKey = process.env.VITE_SARVAM_API_KEY || process.env.SARVAM_API_KEY;
        const geminiKey = process.env.VITE_GEMINI_API_KEY || process.env.GEMINI_API_KEY;

        if (!text || !targetLanguage) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ error: "Missing required parameters: text and targetLanguage" })
            };
        }

        const langCode = targetLanguage.split('-')[0].toLowerCase();
        console.log(`🌐 Backend translating text to ${targetLanguage} (iso: ${langCode})...`);

        // ── 1. Try Sarvam AI for supported Indian languages if key is present ──────
        const sarvamSupportedCodes = ['hi-IN', 'bn-IN', 'kn-IN', 'ml-IN', 'mr-IN', 'pa-IN', 'ta-IN', 'te-IN', 'gu-IN', 'od-IN'];

        if (sarvamKey && sarvamSupportedCodes.includes(targetLanguage)) {
            try {
                console.log(`🇮🇳 Translating via Sarvam AI (${targetLanguage})...`);
                const response = await fetch("https://api.sarvam.ai/translate", {
                    method: "POST",
                    headers: {
                        "api-subscription-key": sarvamKey,
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify({
                        input: text,
                        source_language_code: "en-IN",
                        target_language_code: targetLanguage,
                        mode: "formal"
                    })
                });

                if (response.ok) {
                    const data = await response.json();
                    if (data && data.translated_text) {
                        console.log("✅ Sarvam AI translation successful!");
                        return {
                            statusCode: 200,
                            headers,
                            body: JSON.stringify({ translatedText: data.translated_text, provider: 'sarvam' })
                        };
                    }
                }
            } catch (sarvamErr) {
                console.warn(`⚠️ Sarvam API error: ${sarvamErr.message}. Trying next provider...`);
            }
        }

        // ── 2. Try Gemini AI with multiple model fallbacks ────────────────────────
        if (geminiKey) {
            const modelsToTry = ['gemini-2.5-flash', 'gemini-1.5-flash', 'gemini-1.5-pro', 'gemini-2.0-flash'];
            const prompt = `Translate the following text accurately into language "${targetLanguage}" (${langCode}). Return ONLY the raw translated text without quotes, markdown formatting, or explanation:\n\n${text}`;

            for (const modelName of modelsToTry) {
                try {
                    console.log(`🤖 Translating via Gemini AI (${modelName})...`);
                    const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${geminiKey}`;

                    const response = await fetch(url, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            contents: [{ parts: [{ text: prompt }] }]
                        })
                    });

                    if (response.ok) {
                        const data = await response.json();
                        const translated = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
                        if (translated) {
                            console.log(`✅ Gemini AI (${modelName}) translation successful!`);
                            return {
                                statusCode: 200,
                                headers,
                                body: JSON.stringify({ translatedText: translated, provider: `gemini-${modelName}` })
                            };
                        }
                    }
                } catch (gErr) {
                    console.warn(`⚠️ Gemini model ${modelName} failed: ${gErr.message}`);
                }
            }
        }

        // ── 3. Free Public Translation Engine (MyMemory API - 100% Guaranteed) ────
        console.log(`🌍 Translating via MyMemory Public Engine (langpair: en|${langCode})...`);
        const myMemoryUrl = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=en|${langCode}`;
        
        const mmResponse = await fetch(myMemoryUrl, { signal: AbortSignal.timeout(8000) });
        if (mmResponse.ok) {
            const mmData = await mmResponse.json();
            if (mmData?.responseData?.translatedText) {
                let cleanText = mmData.responseData.translatedText.trim();
                // Clean HTML entities if any
                cleanText = cleanText.replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&');
                console.log(`✅ MyMemory public translation successful! Result: "${cleanText}"`);
                return {
                    statusCode: 200,
                    headers,
                    body: JSON.stringify({ translatedText: cleanText, provider: 'mymemory-public' })
                };
            }
        }

        throw new Error("All translation providers failed.");

    } catch (error) {
        console.error("❌ Backend Translation Error:", error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: error.message || "Failed to translate text" })
        };
    }
};
