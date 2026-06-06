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
        const { prompt, style } = JSON.parse(event.body);
        const apiKey = process.env.VITE_NVIDIA_API_KEY;

        if (!apiKey) {
            return {
                statusCode: 500,
                headers,
                body: JSON.stringify({ error: "NVIDIA API key is not configured on the server." })
            };
        }

        const enhancedPrompt = buildNvidiaPrompt(prompt, style);

        console.log(`🎨 Backend generating image for style: ${style}`);
        console.log(`🧾 Backend prompt length: ${enhancedPrompt.length}`);
        
        const nvidiaUrl = "https://ai.api.nvidia.com/v1/genai/black-forest-labs/flux.2-klein-4b";

        const response = await fetch(nvidiaUrl, {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${apiKey}`,
                "Content-Type": "application/json",
                "Accept": "application/json",
            },
            body: JSON.stringify({
                "prompt": enhancedPrompt,
                "height": 1024,
                "width": 1024,
                "cfg_scale": 1,
                "steps": 4
            }),
        });

        if (!response.ok) {
            const errorDetail = await response.text();
            throw new Error(`HTTP ${response.status}: ${errorDetail}`);
        }

        const data = await response.json();
        
        // Find and extract image data
        let imageData = null;
        if (data.image) {
            imageData = data.image;
        } else if (data.artifacts && data.artifacts[0] && data.artifacts[0].base64) {
            imageData = data.artifacts[0].base64;
        } else if (data.data && data.data[0] && data.data[0].b64_json) {
            imageData = data.data[0].b64_json;
        }

        if (!imageData) {
            throw new Error("Could not find image data in Nvidia response");
        }

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({ image: imageData })
        };

    } catch (error) {
        console.error("❌ Backend Image Error:", error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: error.message || "Failed to generate image" })
        };
    }
};

const NVIDIA_PROMPT_LIMIT = 760;

function normalizeText(text = '') {
    return String(text).replace(/\s+/g, ' ').trim();
}

function shortenText(text, limit) {
    const clean = normalizeText(text);
    if (clean.length <= limit) return clean;

    const slice = clean.slice(0, limit);
    const breakPoints = [
        slice.lastIndexOf('. '),
        slice.lastIndexOf('! '),
        slice.lastIndexOf('? '),
        slice.lastIndexOf('; '),
        slice.lastIndexOf(', '),
        slice.lastIndexOf(' ')
    ].filter((index) => index > 80);

    const cutIndex = breakPoints.length ? Math.max(...breakPoints) : limit;
    return clean.slice(0, cutIndex).trimEnd() + '.';
}

function stripRepeatedStyleWrapper(prompt) {
    let text = normalizeText(prompt);
    text = text.replace(/^A scene entirely in .*?style\.\s*/i, '');
    text = text.replace(/\s*Everything including background, environment, and characters must strictly be .*?style\.\s*No realistic elements\.?\s*$/i, '');
    return text;
}

function buildNvidiaPrompt(prompt, style) {
    const basePrompt = stripRepeatedStyleWrapper(prompt);
    const stylePrefix = style && style !== 'custom characters' ? `Style: ${normalizeText(style)}. ` : '';
    const styleSuffix = style && style !== 'custom characters' ? ' Keep it fully stylized.' : '';
    const remaining = Math.max(120, NVIDIA_PROMPT_LIMIT - stylePrefix.length - styleSuffix.length);
    const compactPrompt = shortenText(basePrompt, remaining);
    return `${stylePrefix}${compactPrompt}${styleSuffix}`.trim();
}
