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
        const apiKey = process.env.VITE_NVIDIA_API_KEY || process.env.NVIDIA_API_KEY;
        const geminiApiKey = process.env.VITE_GEMINI_API_KEY || process.env.GEMINI_API_KEY;

        // Ultimate fallback helper
        const getFallbackResponse = async (errorMsg) => {
            console.warn(`⚠️ Nvidia NIM API failed: ${errorMsg}. Activating SVG fallback...`);
            try {
                if (!geminiApiKey) throw new Error("Gemini API key is not configured on the server.");
                const svgCode = await generateGeminiSVGBackend(prompt, style, geminiApiKey);
                const base64Svg = "data:image/svg+xml;base64," + Buffer.from(svgCode).toString('base64');
                return {
                    statusCode: 200,
                    headers,
                    body: JSON.stringify({ image: base64Svg })
                };
            } catch (svgErr) {
                console.error("❌ Backend SVG generation failed. Returning local fallback SVG:", svgErr);
                const localSvg = getLocalFallbackSVG(prompt, style, guessCategory(prompt));
                return {
                    statusCode: 200,
                    headers,
                    body: JSON.stringify({ image: localSvg })
                };
            }
        };

        if (!apiKey || apiKey.includes('ADD_YOUR')) {
            return await getFallbackResponse("Nvidia API key is missing or default.");
        }

        // Prepare the optimized NVIDIA prompt
        const nvidiaPrompt = buildNvidiaPrompt(prompt, style);
        console.log(`🎨 Backend sending prompt to NVIDIA FLUX NIM: "${nvidiaPrompt}"`);

        const response = await fetch("https://ai.api.nvidia.com/v1/genai/black-forest-labs/flux.1-schnell", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${apiKey}`,
                "Content-Type": "application/json",
                "Accept": "application/json"
            },
            body: JSON.stringify({
                prompt: nvidiaPrompt,
                image_format: "png",
                aspect_ratio: "1:1"
            })
        });

        if (!response.ok) {
            const errorDetail = await response.text();
            return await getFallbackResponse(`HTTP ${response.status}: ${errorDetail}`);
        }

        const data = await response.json();
        
        if (data && data.artifacts && data.artifacts[0] && data.artifacts[0].base64) {
            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({ image: data.artifacts[0].base64 })
            };
        } else {
            return await getFallbackResponse("Invalid response format from NVIDIA API");
        }

    } catch (error) {
        console.error("❌ Backend Image Generation Error:", error);
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
    const styleSuffix = style && style !== 'custom characters' ? ' Keep it fully stylized. Wordless, no text, no letters, no speech bubbles, no dialogue, no labels.' : ' Wordless, no text, no letters, no speech bubbles, no dialogue, no labels.';
    const remaining = Math.max(120, NVIDIA_PROMPT_LIMIT - stylePrefix.length - styleSuffix.length);
    const compactPrompt = shortenText(basePrompt, remaining);
    return `${stylePrefix}${compactPrompt}${styleSuffix}`.trim();
}

async function generateGeminiSVGBackend(prompt, style, apiKey) {
    const modelName = "gemini-2.5-flash";
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;
    
    const svgPrompt = `
        You are an elite graphic designer. Generate a clean, modern, valid, self-contained SVG graphic that represents the following visual concept:
        "${prompt}"
        
        CRITICAL INSTRUCTIONS:
        - The theme/art style of the SVG illustration must be strictly in "${style}" style.
        - It must be a clean, modern vector illustration, chart, diagram, waffle chart, polar/radar plot, trend line, or schematic infographic.
        - The SVG must be responsive, containing a viewBox attribute (e.g., viewBox="0 0 800 800") and NO hardcoded width/height outside the viewBox.
        - Return ONLY valid raw SVG XML code inside a code block starting with '<svg' and ending with '</svg>'.
        - Do NOT include any markdown text, explanations, or wrapping html outside the code block.
        - CRITICAL TEXT-FREE GUARD: Absolutely NO text, letters, numbers, labels, or speech bubbles are allowed in the SVG. Convey all concepts and data purely through shapes, paths, lines, circles, colors, grids, and icons.
    `;

    const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            contents: [{
                parts: [{ text: svgPrompt }]
            }]
        })
    });

    if (!response.ok) {
        throw new Error(`Gemini SVG API failed with HTTP ${response.status}`);
    }

    const data = await response.json();
    if (data.candidates && data.candidates[0] && data.candidates[0].content && data.candidates[0].content.parts[0]) {
        const textResult = data.candidates[0].content.parts[0].text;
        const match = textResult.match(/<svg[\s\S]*<\/svg>/i);
        if (match) {
            return match[0];
        }
    }
    throw new Error("Invalid SVG response format from Gemini");
}

function guessCategory(promptText = '') {
    const text = promptText.toLowerCase();
    if (text.includes('space') || text.includes('science') || text.includes('telescope') || text.includes('nasa') || text.includes('exoplanet')) {
        return 'science';
    }
    if (text.includes('tech') || text.includes('iphone') || text.includes('apple') || text.includes('silicon') || text.includes('ai ') || text.includes('artificial intelligence') || text.includes('robotic')) {
        return 'tech';
    }
    if (text.includes('game') || text.includes('gta') || text.includes('playstation') || text.includes('minecraft') || text.includes('nintendo') || text.includes('xbox')) {
        return 'gaming';
    }
    if (text.includes('sports') || text.includes('soccer') || text.includes('football') || text.includes('basketball') || text.includes('nba') || text.includes('boxing') || text.includes('champion')) {
        return 'sports';
    }
    if (text.includes('stock') || text.includes('market') || text.includes('finance') || text.includes('percent') || text.includes('gw') || text.includes('power') || text.includes('trillion') || text.includes('billion') || text.includes('chart') || text.includes('graph')) {
        return 'data';
    }
    return 'default';
}

function getLocalFallbackSVG(prompt, style, category) {
    const colors = {
        tech: { primary: '#ff007c', secondary: '#00d2ff', bg: '#0f0f12', grid: '#27272a' },
        science: { primary: '#05ff80', secondary: '#00d2ff', bg: '#faf9f5', grid: '#e4e4e7' },
        sports: { primary: '#ff5722', secondary: '#ffd000', bg: '#ffffff', grid: '#f4f4f5' },
        gaming: { primary: '#a855f7', secondary: '#ff007c', bg: '#000000', grid: '#18181b' },
        data: { primary: '#05ff80', secondary: '#ffd000', bg: '#ffffff', grid: '#e4e4e7' },
        default: { primary: '#ffd000', secondary: '#ff007c', bg: '#faf9f5', grid: '#e4e4e7' }
    };
    const c = colors[category] || colors.default;
    
    let svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 800" style="background-color: ${c.bg}; font-family: sans-serif;">`;
    
    for (let i = 100; i < 800; i += 100) {
        svg += `<line x1="${i}" y1="0" x2="${i}" y2="800" stroke="${c.grid}" stroke-width="2" stroke-dasharray="5,5"/>`;
        svg += `<line x1="0" y1="${i}" x2="800" y2="${i}" stroke="${c.grid}" stroke-width="2" stroke-dasharray="5,5"/>`;
    }
    
    if (category === 'science' || category === 'tech') {
        svg += `<circle cx="400" cy="400" r="180" fill="none" stroke="${c.primary}" stroke-width="8" stroke-dasharray="10,15"/>`;
        svg += `<circle cx="400" cy="400" r="120" fill="none" stroke="${c.secondary}" stroke-width="6"/>`;
        svg += `<circle cx="220" cy="400" r="24" fill="${c.primary}" stroke="#000" stroke-width="4"/>`;
        svg += `<circle cx="580" cy="400" r="24" fill="${c.primary}" stroke="#000" stroke-width="4"/>`;
        svg += `<circle cx="400" cy="220" r="24" fill="${c.secondary}" stroke="#000" stroke-width="4"/>`;
        svg += `<circle cx="400" cy="580" r="24" fill="${c.secondary}" stroke="#000" stroke-width="4"/>`;
        svg += `<path d="M220 400 L400 220 L580 400 L400 580 Z" fill="none" stroke="${c.primary}" stroke-width="4" stroke-dasharray="5,5"/>`;
    } else {
        svg += `<path d="M 100 600 L 220 500 L 340 550 L 460 380 L 580 420 L 700 200" fill="none" stroke="${c.primary}" stroke-width="12" stroke-linecap="round" stroke-linejoin="round"/>`;
        svg += `<path d="M 100 600 L 220 500 L 340 550 L 460 380 L 580 420 L 700 200 L 700 650 L 100 650 Z" fill="${c.secondary}" opacity="0.15"/>`;
        svg += `<circle cx="220" cy="500" r="14" fill="${c.secondary}" stroke="#000" stroke-width="4"/>`;
        svg += `<circle cx="460" cy="380" r="14" fill="${c.secondary}" stroke="#000" stroke-width="4"/>`;
        svg += `<circle cx="700" cy="200" r="18" fill="${c.primary}" stroke="#000" stroke-width="5"/>`;
    }
    
    for (let x = 60; x < 200; x += 35) {
        for (let y = 60; y < 140; y += 35) {
            const color = Math.random() > 0.4 ? c.primary : c.secondary;
            svg += `<rect x="${x}" y="${y}" width="25" height="25" fill="${color}" stroke="#000" stroke-width="2" rx="4"/>`;
        }
    }
    
    svg += `</svg>`;
    const base64 = Buffer.from(svg).toString('base64');
    return "data:image/svg+xml;base64," + base64;
}
