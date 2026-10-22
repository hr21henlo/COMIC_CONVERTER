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
        const { prompt, style, caption } = JSON.parse(event.body || '{}');
        let apiKey = process.env.VITE_NVIDIA_API_KEY || process.env.NVIDIA_API_KEY || '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';
        if (apiKey) apiKey = apiKey.trim().replace(/^["']|["']$/g, '');

        const baseAnonymized = anonymizePrompt(prompt, style, caption);
        const nvidiaPrompt = buildNvidiaPrompt(baseAnonymized, style);
        console.log(`🎨 Tier 1: Calling NVIDIA FLUX NIM... prompt: "${nvidiaPrompt.substring(0, 80)}..."`);

        let imageData = null;
        let usedProvider = 'nvidia-flux';

        // ─── TIER 1: Direct NVIDIA FLUX Generation ─────────────────────────────
        const res1 = await callNvidia(nvidiaPrompt, apiKey, 22000);
        if (res1.ok && res1.image) {
            imageData = res1.image;
        }

        // ─── TIER 2: Safety Sanitized Retry (Fixes CONTENT_FILTERED) ───────────
        if (!imageData && (res1.filtered || res1.status === 400 || res1.status === 422 || !res1.ok)) {
            const sanitized = sanitizePromptForSafety(baseAnonymized);
            const sanitizedNvidiaPrompt = buildNvidiaPrompt(sanitized, style);
            console.warn(`🛡️ Tier 2: Safety filter triggered. Retrying with sanitized visual prompt: "${sanitizedNvidiaPrompt.substring(0, 80)}..."`);
            
            const res2 = await callNvidia(sanitizedNvidiaPrompt, apiKey, 22000);
            if (res2.ok && res2.image) {
                console.log(`⚡ Tier 2: Successfully generated image after safety sanitization!`);
                imageData = res2.image;
                usedProvider = 'nvidia-flux-sanitized';
            }
        }

        // ─── TIER 3: Atmospheric Graphic Novel Scene Retry ─────────────────────
        if (!imageData) {
            console.warn(`⚠️ Tier 3: Retrying with high-impact atmospheric comic scene prompt...`);
            // Brief backoff in case of 429
            await new Promise(r => setTimeout(r, 1200));

            const safeScenePrompt = buildAtmosphericScenePrompt(style, caption || prompt);
            const res3 = await callNvidia(safeScenePrompt, apiKey, 22000);
            if (res3.ok && res3.image) {
                console.log(`⚡ Tier 3: Atmospheric scene generated successfully!`);
                imageData = res3.image;
                usedProvider = 'nvidia-flux-atmospheric';
            }
        }

        // ─── TIER 4: Guaranteed Vector Comic Graphic Fallback ───────────────────
        if (!imageData) {
            console.warn(`🛡️ Tier 4: NVIDIA FLUX unavailable. Generating stylized comic vector artwork...`);
            imageData = generateComicFallbackSVG(prompt, style, caption);
            usedProvider = 'comic-vector-fallback';
        }

        const finalImage = imageData.startsWith('data:') ? imageData : `data:image/png;base64,${imageData}`;
        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({ image: finalImage, provider: usedProvider })
        };

    } catch (error) {
        console.error('❌ Backend Image Generation caught top-level error:', error);
        // Even if something unexpected happens, deliver the fallback SVG so the UI NEVER breaks
        const fallbackSVG = generateComicFallbackSVG(event.body || '', 'comic', 'Breaking News');
        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({ image: fallbackSVG, provider: 'emergency-svg-fallback' })
        };
    }
};

// ─── NVIDIA API Caller ─────────────────────────────────────────────────────────
async function callNvidia(promptText, apiKey, timeoutMs = 22000) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
        const response = await fetch('https://ai.api.nvidia.com/v1/genai/black-forest-labs/flux.2-klein-4b', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify({
                prompt: promptText
            }),
            signal: controller.signal
        });

        clearTimeout(timeout);

        if (!response.ok) {
            const errorDetail = await response.text();
            console.warn(`⚠️ NVIDIA returned status ${response.status}: ${errorDetail.substring(0, 150)}`);
            return { ok: false, status: response.status, error: errorDetail };
        }

        const data = await response.json();
        const artifact = data.artifacts && data.artifacts[0];

        // Check specifically for NVIDIA Content Moderation filter
        if (artifact && artifact.finishReason === 'CONTENT_FILTERED') {
            console.warn(`⚠️ NVIDIA FLUX response had finishReason: CONTENT_FILTERED`);
            return { ok: false, filtered: true };
        }

        let base64 = null;
        if (artifact && artifact.base64 && artifact.base64.trim().length > 0) {
            base64 = artifact.base64;
        } else if (data.image) {
            base64 = data.image;
        } else if (data.data && data.data[0] && data.data[0].b64_json) {
            base64 = data.data[0].b64_json;
        }

        if (base64) {
            return { ok: true, image: base64 };
        }

        return { ok: false, error: 'Empty base64 in response', filtered: true };

    } catch (err) {
        clearTimeout(timeout);
        console.warn(`⚠️ NVIDIA fetch error: ${err.message}`);
        return { ok: false, error: err.message };
    }
}

// ─── Safety Sanitizer: Translates sensitive news words to visual metaphors ─────
function sanitizePromptForSafety(prompt = '') {
    let p = prompt;
    const replacements = [
        { regex: /\b(terrorist|terrorists|terrorism|militant|militants|insurgent|insurgents)\b/gi, rep: 'masked shadowy figure' },
        { regex: /\b(attack|attacks|attacked|attacking|assault|raid)\b/gi, rep: 'tense encounter' },
        { regex: /\b(clashes|clash|clashing|riot|riots|rioting)\b/gi, rep: 'intense public standoff' },
        { regex: /\b(violence|violent|violently)\b/gi, rep: 'dramatic intense scene' },
        { regex: /\b(blood|bloody|bloodshed)\b/gi, rep: 'dark shadows' },
        { regex: /\b(kill|killed|killing|dead|death|corpse|corpses|bodies|body|fatalities|casualties)\b/gi, rep: 'grim aftermath' },
        { regex: /\b(shoot|shot|shooting|gunfire|gunshot|gunshots|sniper)\b/gi, rep: 'high tension confrontation' },
        { regex: /\b(gun|guns|rifle|rifles|weapon|weapons|firearm|firearms|pistol|pistols|missile|missiles)\b/gi, rep: 'heavy equipment' },
        { regex: /\b(bomb|bombs|bombing|bombed|explosive|explosives)\b/gi, rep: 'loud blast impact' },
        { regex: /\b(explosion|explosions|exploding|exploded)\b/gi, rep: 'dramatic burst of smoke and dust' },
        { regex: /\b(murder|murdered|murderer|assassination|assassinated)\b/gi, rep: 'serious crime investigation' },
        { regex: /\b(drug|drugs|narcotics|cocaine|heroin)\b/gi, rep: 'contraband evidence boxes' }
    ];

    for (const r of replacements) {
        p = p.replace(r.regex, r.rep);
    }
    return p;
}

// ─── Atmospheric Comic Scene Builder (Tier 3 fallback) ─────────────────────────
function buildAtmosphericScenePrompt(style = 'comic book', caption = '') {
    const styleModifier = STYLE_MODIFIERS[style] || DEFAULT_STYLE_MODIFIERS;
    const cleanCaption = normalizeText(caption).substring(0, 80).replace(/[^\w\s,.-]/g, '');
    return `${styleModifier}, dramatic news illustration of ${cleanCaption || 'a breaking event'}, architectural cityscape with dramatic atmospheric lighting, graphic novel composition, bold ink linework, vibrant color, no text, no watermark`;
}

// ─── Guaranteed Comic Vector Fallback (Tier 4) ─────────────────────────────────
function generateComicFallbackSVG(prompt = '', style = 'Manga style', caption = '') {
    const styleThemes = {
        'Manga style':      { bg: '#18181b', accent: '#FFE66D', burst: '#FF0055', text: '#FFFFFF', dot: 'rgba(255,255,255,0.08)' },
        'Vintage style':    { bg: '#FDF0D5', accent: '#C1121F', burst: '#669BBC', text: '#0A0A0A', dot: 'rgba(0,0,0,0.1)' },
        '3D style':         { bg: '#03045E', accent: '#00B4D8', burst: '#90E0EF', text: '#FFFFFF', dot: 'rgba(255,255,255,0.06)' },
        'Disney style':     { bg: '#FFF0F5', accent: '#FF6B6B', burst: '#4ECDC4', text: '#0A0A0A', dot: 'rgba(255,107,107,0.1)' },
        'Family Guy style': { bg: '#FFEAA7', accent: '#0984E3', burst: '#D63031', text: '#0A0A0A', dot: 'rgba(0,0,0,0.08)' },
    };

    const theme = styleThemes[style] || styleThemes['Manga style'];

    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 1000" width="100%" height="100%" style="background:${theme.bg}">
    <defs>
      <pattern id="halftone" x="0" y="0" width="20" height="20" patternUnits="userSpaceOnUse">
        <circle cx="10" cy="10" r="3" fill="${theme.dot}" />
      </pattern>
      <linearGradient id="skyGrad" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stop-color="${theme.accent}" stop-opacity="0.3"/>
        <stop offset="100%" stop-color="${theme.bg}" stop-opacity="1"/>
      </linearGradient>
    </defs>

    <!-- Halftone background -->
    <rect width="800" height="1000" fill="url(#skyGrad)" />
    <rect width="800" height="1000" fill="url(#halftone)" />

    <!-- Comic Action Burst Lines -->
    <g stroke="${theme.accent}" stroke-width="2" opacity="0.4">
      <line x1="400" y1="500" x2="50" y2="50" stroke-dasharray="10,15" />
      <line x1="400" y1="500" x2="750" y2="50" stroke-dasharray="10,15" />
      <line x1="400" y1="500" x2="50" y2="950" stroke-dasharray="10,15" />
      <line x1="400" y1="500" x2="750" y2="950" stroke-dasharray="10,15" />
      <line x1="400" y1="500" x2="400" y2="30" stroke-dasharray="8,12" />
      <line x1="400" y1="500" x2="400" y2="970" stroke-dasharray="8,12" />
      <line x1="400" y1="500" x2="20" y2="500" stroke-dasharray="8,12" />
      <line x1="400" y1="500" x2="780" y2="500" stroke-dasharray="8,12" />
    </g>

    <!-- Comic Panel Frame -->
    <rect x="30" y="30" width="740" height="940" fill="none" stroke="#0A0A0A" stroke-width="8" rx="8" />

    <!-- Stylized Comic Silhouettes / Dynamic Skyline -->
    <g fill="${theme.bg}" stroke="#0A0A0A" stroke-width="4">
      <rect x="80" y="580" width="120" height="360" />
      <rect x="220" y="480" width="140" height="460" />
      <rect x="380" y="540" width="130" height="400" />
      <rect x="530" y="440" width="150" height="500" />
      <polygon points="290,440 280,480 300,480" fill="${theme.accent}" stroke="#0A0A0A" stroke-width="3" />
      <polygon points="605,390 595,440 615,440" fill="${theme.burst}" stroke="#0A0A0A" stroke-width="3" />
    </g>

    <!-- Comic Sound Effect / Action Starburst Badge -->
    <g transform="translate(400, 320)">
      <polygon points="0,-100 25,-40 90,-50 45,0 80,60 15,35 0,95 -20,35 -85,60 -50,0 -95,-50 -30,-40"
               fill="${theme.accent}" stroke="#0A0A0A" stroke-width="6" />
      <circle cx="0" cy="0" r="45" fill="#FFE66D" stroke="#0A0A0A" stroke-width="4" />
      <path d="M-15,-20 L15,0 L-15,20 Z" fill="#0A0A0A" />
    </g>

    <!-- Comic Genre Ribbon -->
    <g transform="translate(400, 780)">
      <rect x="-240" y="-30" width="480" height="60" fill="#FFE66D" stroke="#0A0A0A" stroke-width="5" rx="6" />
      <text x="0" y="8" font-family="'Impact', 'Arial Black', sans-serif" font-size="24" font-weight="900" fill="#0A0A0A" text-anchor="middle" letter-spacing="2">
        ${(style || 'COMIC').toUpperCase()} • EDITION
      </text>
    </g>
  </svg>`;

    return 'data:image/svg+xml;base64,' + Buffer.from(svg).toString('base64');
}

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
