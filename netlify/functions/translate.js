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
        const { text, targetLanguage } = JSON.parse(event.body);
        const apiKey = process.env.VITE_SARVAM_API_KEY;

        if (!apiKey) {
            return {
                statusCode: 500,
                headers,
                body: JSON.stringify({ error: "Sarvam API subscription key is not configured on the server." })
            };
        }

        if (!text || !targetLanguage) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ error: "Missing required parameters: text and targetLanguage" })
            };
        }

        console.log(`🌐 Backend: Translating text to language: ${targetLanguage}`);

        const response = await fetch("https://api.sarvam.ai/translate", {
            method: "POST",
            headers: {
                "api-subscription-key": apiKey,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                input: text,
                source_language_code: "en-IN",
                target_language_code: targetLanguage,
                mode: "formal"
            })
        });

        if (!response.ok) {
            const errorDetail = await response.text();
            throw new Error(`Sarvam API HTTP ${response.status}: ${errorDetail}`);
        }

        const data = await response.json();
        
        if (data && data.translated_text) {
            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({ translatedText: data.translated_text })
            };
        } else {
            throw new Error("Invalid response format from Sarvam API");
        }

    } catch (error) {
        console.error("❌ Translation Function Error:", error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: error.message || "Failed to translate text" })
        };
    }
};
