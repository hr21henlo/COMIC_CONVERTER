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
        const { prompt, style, caption } = JSON.parse(event.body);
        let apiKey = process.env.VITE_NVIDIA_API_KEY || process.env.NVIDIA_API_KEY || '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';
        if (apiKey) apiKey = apiKey.trim().replace(/^["']|["']$/g, '');

        const nvidiaPrompt = buildNvidiaPrompt(anonymizePrompt(prompt, style, caption), style);
        console.log(`🎨 Calling NVIDIA FLUX NIM API... prompt: "${nvidiaPrompt.substring(0, 80)}..."`);

        let imageData = null;
        let lastError = null;

        // Try NVIDIA FLUX up to 3 times to ensure 100% success from NVIDIA
        for (let attempt = 1; attempt <= 3; attempt++) {
            try {
                const controller = new AbortController();
                const timeout = setTimeout(() => controller.abort(), 12000);

                const response = await fetch('https://ai.api.nvidia.com/v1/genai/black-forest-labs/flux.2-klein-4b', {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${apiKey}`,
                        'Content-Type': 'application/json',
                        'Accept': 'application/json'
                    },
                    body: JSON.stringify({
                        prompt: nvidiaPrompt
                    }),
                    signal: controller.signal
                });

                clearTimeout(timeout);

                if (!response.ok) {
                    const errorDetail = await response.text();
                    throw new Error(`NVIDIA HTTP ${response.status}: ${errorDetail.substring(0, 200)}`);
                }

                const data = await response.json();

                if (data.artifacts && data.artifacts[0] && data.artifacts[0].base64) {
                    imageData = data.artifacts[0].base64;
                } else if (data.image) {
                    imageData = data.image;
                } else if (data.data && data.data[0] && data.data[0].b64_json) {
                    imageData = data.data[0].b64_json;
                }

                if (imageData) {
                    console.log(`⚡ NVIDIA FLUX generated image successfully on attempt ${attempt}!`);
                    break;
                }
            } catch (err) {
                console.warn(`⚠️ NVIDIA FLUX attempt ${attempt} failed: ${err.message}`);
                lastError = err;
            }
        }

        if (imageData) {
            const finalImage = imageData.startsWith('data:') ? imageData : `data:image/png;base64,${imageData}`;
            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({ image: finalImage, provider: 'nvidia-nim' })
            };
        }

        throw lastError || new Error("Failed to generate image with NVIDIA FLUX after retries");

    } catch (error) {
        console.error('❌ Backend Image Generation Error:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: error.message || 'Failed to generate image with NVIDIA FLUX' })
        };
    }
};

const NVIDIA_PROMPT_LIMIT = 760;

// ─── Style modifier dictionary ─────────────────────────────────────────────────
const STYLE_MODIFIERS = {
    'Manga style':      '2D Japanese anime artwork, manga comic page, clean anime linework, vibrant cel-shaded color, Studio Ghibli anime aesthetic, single character focus, no photorealism, no 3d render',
    'Vintage style':    '1950s golden age classic comic book cover, retro pulp comic art, pop art halftone dots, vintage newsprint ink, classic comic hero, bold black outlines',
    '3D style':         '3D animated movie render, Pixar style cartoon character, Octane render, smooth 3D claymation, vibrant 3D studio lighting',
    'Disney style':     'Classic 2D Disney animated cartoon illustration, expressive animated character, painted background, clean bold vector linework',
    'Family Guy style': 'Seth MacFarlane cartoon sitcom style, 2D flat color cartoon illustration, bold thick outlines, expressive character design',
    // Legacy
    'Superhero style':  'modern graphic novel illustration, dynamic action pose, bold vivid colors, cinematic lighting, comic book art',
    'Watercolor style': 'watercolor painting, expressive brush strokes, pastel wash, soft edges, artistic illustration',
};

const DEFAULT_STYLE_MODIFIERS = 'comic book art style, bold ink outlines, vivid colors, dynamic composition';

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
    const styleNames = Object.keys(STYLE_MODIFIERS).map(s => s.replace(/\s+/g, '\\s+'));
    for (const sn of styleNames) {
        const rx = new RegExp(`^(${sn}[,.]?\\s*)`, 'i');
        text = text.replace(rx, '');
    }
    return text.trim();
}

function buildNvidiaPrompt(prompt, style) {
    const cleanPrompt = normalizeText(prompt);
    const negativeDirectives = ", Avoid: multiple panels, split screen, comic book page, collage, Japanese text, kanji, speech bubbles, text, watermark, human anime characters when animals are requested.";
    return `${cleanPrompt}${negativeDirectives}`.trim();
}

function anonymizePrompt(prompt, style, caption = '') {
    let simplifiedPrompt = prompt || '';

    const celebrityReplacements = [
        { regex: /cristiano ronaldo/gi, replacement: 'a famous athletic Portuguese soccer player' },
        { regex: /ronaldo/gi, replacement: 'a famous soccer player' },
        { regex: /cristiano/gi, replacement: 'a soccer star' },
        { regex: /lionel messi/gi, replacement: 'a famous Argentine soccer player' },
        { regex: /messi/gi, replacement: 'a famous soccer player' },
        { regex: /lionel/gi, replacement: 'a soccer superstar' },
        { regex: /lebron james/gi, replacement: 'a famous tall basketball player' },
        { regex: /lebron/gi, replacement: 'a famous basketball player' },
        { regex: /canelo alvarez/gi, replacement: 'a famous boxing champion' },
        { regex: /canelo/gi, replacement: 'a famous boxer' },
        { regex: /alvarez/gi, replacement: 'a boxing champion' },
        { regex: /shohei ohtani/gi, replacement: 'a famous baseball player' },
        { regex: /ohtani/gi, replacement: 'a famous baseball player' },
        { regex: /shohei/gi, replacement: 'a baseball star' },
        { regex: /taylor swift/gi, replacement: 'a famous pop star' },
        { regex: /swift/gi, replacement: 'a famous pop singer' },
        { regex: /elon musk/gi, replacement: 'a wealthy tech entrepreneur' },
        { regex: /musk/gi, replacement: 'a tech entrepreneur' },
        { regex: /donald trump/gi, replacement: 'a prominent politician' },
        { regex: /trump/gi, replacement: 'a politician' },
        { regex: /joe biden/gi, replacement: 'a prominent politician' },
        { regex: /biden/gi, replacement: 'a politician' },
        { regex: /kamala harris/gi, replacement: 'a politician' },
        { regex: /harris/gi, replacement: 'a politician' },
        { regex: /barack obama/gi, replacement: 'a former president' },
        { regex: /obama/gi, replacement: 'a former president' },
        { regex: /narendra modi/gi, replacement: 'a national leader' },
        { regex: /modi/gi, replacement: 'a leader' },
        { regex: /vladimir putin/gi, replacement: 'a national leader' },
        { regex: /putin/gi, replacement: 'a leader' },
        { regex: /xi jinping/gi, replacement: 'a leader' },
        { regex: /mark zuckerberg/gi, replacement: 'a tech CEO' },
        { regex: /zuckerberg/gi, replacement: 'a tech CEO' },
        { regex: /jeff bezos/gi, replacement: 'a wealthy business executive' },
        { regex: /bezos/gi, replacement: 'a business executive' },
        { regex: /bill gates/gi, replacement: 'a tech billionaire' },
        { regex: /gates/gi, replacement: 'a tech billionaire' },
        { regex: /sam altman/gi, replacement: 'an AI tech CEO' },
        { regex: /altman/gi, replacement: 'an AI tech CEO' },
        { regex: /sundar pichai/gi, replacement: 'a tech executive' },
        { regex: /pichai/gi, replacement: 'a tech executive' },
        { regex: /tim cook/gi, replacement: 'a tech executive' },
        { regex: /cook/gi, replacement: 'a tech executive' }
    ];

    for (const r of celebrityReplacements) {
        simplifiedPrompt = simplifiedPrompt.replace(r.regex, r.replacement);
    }

    return simplifiedPrompt;
}
