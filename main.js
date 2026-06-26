// Note: We are using the CDN version of Gemini for zero-config setup
// In index.html: <script type="importmap">...</script>
import { GoogleGenerativeAI } from "@google/generative-ai";
import { gsap } from "gsap";
import html2canvas from "html2canvas";

console.log("🎨 ComicGen initialized...");

// API Keys from .env
const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY;
const NVIDIA_API_KEY = import.meta.env.VITE_NVIDIA_API_KEY;
const SARVAM_API_KEY = import.meta.env.VITE_SARVAM_API_KEY;

if (!GEMINI_API_KEY || GEMINI_API_KEY.includes('ADD_YOUR')) {
    console.warn("⚠️ Gemini API Key is missing or default.");
} else {
    console.log("✅ Gemini API Key detected (starts with: " + GEMINI_API_KEY.substring(0, 4) + "...)");
}

if (!NVIDIA_API_KEY || NVIDIA_API_KEY.includes('ADD_YOUR')) {
    console.warn("⚠️ Nvidia API Key is missing or default.");
} else {
    console.log("✅ Nvidia API Key detected (starts with: " + NVIDIA_API_KEY.substring(0, 6) + "...)");
}

if (!SARVAM_API_KEY || SARVAM_API_KEY.includes('ADD_YOUR')) {
    console.warn("⚠️ Sarvam API Key is missing or default.");
} else {
    console.log("✅ Sarvam API Key detected.");
}

// Elements
const generateBtn = document.getElementById('generateBtn');
const articleInput = document.getElementById('articleInput');
const resultSection = document.getElementById('resultSection');
const statusText = document.getElementById('statusText');
const mainLoader = document.getElementById('mainLoader');
const demoBtn = document.getElementById('demoBtn');

const comicPage = document.getElementById('comicPage');
let newsCard = document.getElementById('newsCard');
let newsCardHeadline = document.getElementById('newsCardHeadline');
let newsCardImgContainer = document.getElementById('newsCardImgContainer');
let newsCardBrief1 = document.getElementById('newsCardBrief1');
let newsCardBrief2 = document.getElementById('newsCardBrief2');
const downloadBtn = document.getElementById('downloadBtn');
const shareBtn = document.getElementById('shareBtn');
const finalActions = document.querySelector('.final-actions');



// State
let generatedImageUrl = null;
let originalCardTexts = null;
let translationCache = {};

// Initialize Gemini
const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);

generateBtn.addEventListener('click', async () => {
    const article = articleInput.value.trim();
    if (!article) {
        alert("Please paste an article first!");
        return;
    }

    const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

    if (isLocalhost) {
        if (!GEMINI_API_KEY || !NVIDIA_API_KEY || GEMINI_API_KEY.includes('ADD_YOUR') || NVIDIA_API_KEY.includes('ADD_YOUR')) {
            alert("Local development detected: Please set your API keys in the local .env file first!");
            return;
        }
    }

    // Start Generation
    toggleLoading(true);
    resetUI();
    try {
        const characterStyle = document.querySelector('input[name="characterStyle"]:checked').value;
        const cardCount = parseInt(document.querySelector('input[name="cardCount"]:checked')?.value || '1', 10);
        
        // Step 1: Generate News Card script with Gemini
        updateStatus("Editor: Slicing article into a dramatic comic layout...", 20);
        const cardData = await generateNewsCard(article, characterStyle, cardCount);
        
        const cards = cardData.cards || [cardData];
        
        if (!cards || cards.length === 0) {
            throw new Error("Failed to generate news card data. Please try again.");
        }
        for (const card of cards) {
            if (!card.headline || !card.brief1 || !card.brief2 || !card.imagePrompt) {
                throw new Error("Failed to generate news card data. Please try again.");
            }
        }

        updateStatus("Artist: Prepping card canvas...", 40);
        renderPlaceholderCards(cards);

        // Cache original text for translations
        originalCardTexts = cards.map(c => ({
            headline: c.headline,
            brief1: c.brief1,
            brief2: c.brief2
        }));
        translationCache = {};
        const langSelect = document.getElementById('cardLanguageSelect');
        if (langSelect) langSelect.value = 'en';

        // Step 2: Generate images with Flux (Nvidia API)
        for (let i = 0; i < cards.length; i++) {
            const card = cards[i];
            try {
                updateStatus(`Artist: Sketching panel ${i + 1} of ${cards.length}...`, 50 + (i / cards.length) * 45);
                const imageUrl = await generateImage(card.imagePrompt, characterStyle, card.headline);
                
                updateCardImageAtIndex(i, imageUrl, cards.length);
            } catch (err) {
                console.error(`Error generating card image ${i + 1}:`, err);
                updateCardErrorAtIndex(i, err.message);
            }
        }

        updateStatus("Masterpiece Complete!", 100);
        generateBtn.dataset.success = "true";

    } catch (error) {
        console.error("Generation failed:", error);
        alert(`Error: ${error.message}`);
    } finally {
        toggleLoading(false);
    }
});

async function generateNewsCard(text, style, numCards = 1) {
    console.log("📝 Generating news card layout...");
    
    const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    
    // On production (Netlify), use the secure backend serverless function!
    if (!isLocalhost || !GEMINI_API_KEY || GEMINI_API_KEY.includes('ADD_YOUR')) {
        console.log("🌐 Calling secure Netlify function for news card...");
        const response = await fetch("/.netlify/functions/generateNewsCard", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ text, style, numCards })
        });
        if (!response.ok) {
            const errData = await response.json().catch(() => ({}));
            throw new Error(errData.error || `HTTP ${response.status} failed to generate news card`);
        }
        return await response.json();
    }
    
    const prompt = `
        You are an elite comic-book editor. Convert the following article into exactly ${numCards} chronological/logical visual News Card(s).
        - If exactly 1 card is requested: Summarize the entire article in one high-level card.
        - If exactly 2 cards are requested: Split the article content into 2 chronological segments (Card 1: Background/Setup, Card 2: Climax/Result).
        - If exactly 3 cards are requested: Split the article content into 3 chronological segments (Card 1: Initial Context/Background, Card 2: Core Event/Detailed Data, Card 3: Impact/Future Implications).
        - Make the summaries highly detailed, descriptive, and closer to the original text as the number of cards increases, while still remaining a summarized news layout.

        Generate a JSON object with a single field "cards" containing an array of exactly ${numCards} card objects. Each card object in the array MUST contain:
        1. "headline": A highly dramatic, punchy comic-book style headline for the top banner of the card.
           - CRITICAL DATA RETENTION RULE: If the card's section contains key metrics, stock prices, percentages, ticker symbols, or major numbers, the headline MUST explicitly include these numbers or metrics. Do not genericize or omit them.
        2. "brief1": A highly dramatic and "comicky" narrative setup of the card's story segment (exactly 2-3 sentences, approximately 40-50 words) written in the style of an energetic classic comic book pulp narrator (e.g., using dramatic hooks like "Meanwhile, in the high-stakes arena of...", "A new dawn rises as...", "But tragedy struck when...").
           - CRITICAL COMPREHENSIVENESS & DATA RETENTION RULE: Despite the pulp narrator style, it MUST remain an accurate, thorough summary. You MUST explicitly preserve and include all key metrics, numbers, percentages, dates, stock prices, ticker symbols, and specific names relevant to this section of the text. Do not simplify or omit any core details.
        3. "brief2": A highly dramatic and "comicky" continuation or impact statement of the card's story segment (exactly 2-3 sentences, approximately 40-50 words) continuing the energetic pulp narrator style (e.g., "But the clock is ticking...", "Will they succeed, or will...").
           - CRITICAL COMPREHENSIVENESS & DATA RETENTION RULE: Continue the summary in the same pulp style while explicitly including all remaining facts, statistics, percentages, metrics, and outcomes from the original text segment. It must be a complete overview, leaving no key information behind.
        4. "imagePrompt": A detailed, highly descriptive image prompt for an AI image generator representing the core action and data of this card's section.
           - STYLE & GRAPHICAL DIRECTIVE:
             - If this card's section contains statistics, metrics, or financial data, the image MUST symbolise and show exactly what the news is by depicting a high-quality stylized graphical display of the data: e.g., a waffle grid chart of square colored blocks representing proportions, a polar network/radar plot showing circular node connections, a clean rising/falling stock chart with colored nodes, or a schematic blueprint/infographic of the system (like solar panels, buildings, or microchips).
             - Map the numerical quantities from the article into visual elements. Describe the layout precisely: e.g., 'a waffle unit grid of 100 squares, where 80 squares are colored bright green representing the non-fossil target and 20 squares are orange representing transmission'.
             - If the card's section is action/event-driven, depict the actual physical event described in the article in a highly symbolic way.
             - CRITICAL TEXT-FREE SAFETY GUARD: The image prompt must NOT contain or request any words, letters, text, numbers, symbols that look like letters, speech bubbles, talk bubbles, or character dialogue. The chart/diagram must be completely wordless and numberless, conveying the data purely through visual shapes, colors, lines, grids, charts, and diagrams.
           - CRITICAL STYLE OVERRIDE: The ENTIRE image (characters, environment, background, objects, lighting) MUST be strictly in the "${style}" style. 
             Do not use realistic, cinematic, or any conflicting styles. Every single visual element must strongly match the "${style}" aesthetic.
           - CRITICAL CELEBRITY RULE: Do NOT use real-world celebrity names, specific athletes, or copyrighted public figures in the descriptions. Describe them generically.

        Output MUST be in valid JSON format like this:
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

    try {
        let result;
        const modelsToTry = [
            "gemini-2.5-flash",
            "gemini-3-flash",
            "gemini-2.5-flash-lite"
        ];
        
        let lastError = null;
        for (const modelName of modelsToTry) {
            try {
                console.log(`🤖 Trying model: ${modelName}...`);
                const model = genAI.getGenerativeModel({ model: modelName });
                result = await model.generateContent(prompt);
                if (result) {
                    console.log(`✅ Successfully generated using model: ${modelName}`);
                    break;
                }
            } catch (err) {
                console.warn(`⚠️ Model ${modelName} failed:`, err);
                lastError = err;
            }
        }
        
        if (!result) {
            throw lastError || new Error("All fallback Gemini models failed to generate storyboard.");
        }

        const response = await result.response;
        const textResult = response.text();
        console.log("🤖 Gemini Response:", textResult);
        
        const jsonMatch = textResult.match(/\{[\s\S]*\}/);
        if (!jsonMatch) throw new Error("Could not parse storyboard JSON from Gemini response");
        return JSON.parse(jsonMatch[0]);
    } catch (error) {
        console.error("❌ Storyboard Generation Error:", error);
        console.dir(error);
        throw new Error(`Gemini Error: ${error.message || 'Unknown error'}`);
    }
}

async function generateImage(prompt, style, caption = '', retryCount = 0) {
    const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    
    // On production (Netlify), use the secure backend serverless function!
    if (!isLocalhost || !NVIDIA_API_KEY || NVIDIA_API_KEY.includes('ADD_YOUR')) {
        console.log("🌐 Calling secure Netlify function for image generation...");
        const response = await fetch("/.netlify/functions/generateImage", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ prompt, style })
        });
        if (!response.ok) {
            const errData = await response.json().catch(() => ({}));
            throw new Error(errData.error || `HTTP ${response.status} failed to generate image`);
        }
        const data = await response.json();
        if (data.fallback) {
            console.error(`⚠️ NVIDIA FLUX API call fell back to SVG: ${data.error}`);
        }
        return data.image;
    }

    const enhancedPrompt = buildNvidiaPrompt(prompt, style);
    
    console.log(`🎨 Generating image for prompt: ${enhancedPrompt.substring(0, 80)}...`);
    console.log(`🧾 Prompt length: ${enhancedPrompt.length}`);
    
    // NVIDIA NIM API for FLUX.2 (Routed through Vite Proxy to fix CORS)
    const API_URL = "/api/nvidia/v1/genai/black-forest-labs/flux.2-klein-4b"; 
    
    try {
        const response = await fetch(API_URL, {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${NVIDIA_API_KEY}`,
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
            const errorData = await response.json().catch(() => ({}));
            console.error("❌ Nvidia API Error Details:", errorData);
            
            // Retry logic
            if (retryCount < 1) {
                console.warn(`⚠️ Retrying generation for prompt in 3s... (${retryCount + 1}/1)`);
                await new Promise(resolve => setTimeout(resolve, 3000));
                // Simplify/anonymize the prompt on retry using caption if available
                const simplifiedPrompt = anonymizePrompt(prompt, style, caption);
                return generateImage(buildNvidiaPrompt(simplifiedPrompt, style), style, caption, retryCount + 1);
            }
            
            const errorMsg = typeof errorData === 'object' ? JSON.stringify(errorData) : errorData.detail;
            throw new Error(`Nvidia API error: ${response.status} - ${errorMsg}`);
        }

        const data = await response.json();
        console.log("🖼️ Nvidia Response received");
        
        // Handle different possible response structures
        if (data.image) return data.image;
        if (data.artifacts && data.artifacts[0] && data.artifacts[0].base64) return data.artifacts[0].base64;
        if (data.data && data.data[0] && data.data[0].b64_json) return data.data[0].b64_json;
        
        // Log the actual response to see what Nvidia returned
        console.warn("⚠️ API Response didn't contain image data:", data);
        
        // Extract specific error details if provided by the API
        let errorMessage = "Content policy violation";
        if (data.detail) errorMessage = typeof data.detail === 'string' ? data.detail : JSON.stringify(data.detail);
        else if (data.message) errorMessage = data.message;
        else if (data.error) errorMessage = typeof data.error === 'string' ? data.error : JSON.stringify(data.error);
        else errorMessage = "Unexpected API response: " + JSON.stringify(data).substring(0, 50);
        
        throw new Error(errorMessage);
    } catch (error) {
        if (retryCount < 1) {
            console.warn(`⚠️ Retrying generation due to error in 3s... (${retryCount + 1}/1)`);
            await new Promise(resolve => setTimeout(resolve, 3000));
            // Simplify/anonymize the prompt on retry using caption if available
            const simplifiedPrompt = anonymizePrompt(prompt, style, caption);
            return generateImage(buildNvidiaPrompt(simplifiedPrompt, style), style, caption, retryCount + 1);
        }
        console.error("❌ Image Generation Error:", error);
        throw error;
    }
}

function renderPlaceholderCards(cards) {
    const cardsWorkspace = document.getElementById('cardsWorkspace');
    if (!cardsWorkspace) return;
    
    cardsWorkspace.innerHTML = '';
    
    cards.forEach((card, index) => {
        const cardDiv = document.createElement('div');
        cardDiv.className = 'news-card';
        cardDiv.id = `newsCard-${index}`;
        cardDiv.style.marginBottom = index === cards.length - 1 ? '0' : '35px';
        
        // Alternating slight rotations
        const rotationVal = index % 3 === 0 ? '-0.5deg' : (index % 3 === 1 ? '0.6deg' : '-0.3deg');
        cardDiv.style.transform = `rotate(${rotationVal})`;
        
        cardDiv.innerHTML = `
            <h3 class="news-card-headline" id="newsCardHeadline-${index}">${card.headline.toUpperCase()}</h3>
            <div class="news-card-left">
                <div class="news-card-img-container loading-state" id="newsCardImgContainer-${index}">
                    <div class="skeleton-img"></div>
                </div>
            </div>
            <div class="news-card-right" style="display: flex; flex-direction: column; gap: 16px;">
                <div class="news-card-brief" id="newsCardBrief1-${index}">${card.brief1}</div>
                <div class="news-card-brief" id="newsCardBrief2-${index}">${card.brief2}</div>
            </div>
        `;
        cardsWorkspace.appendChild(cardDiv);
    });
    
    if (comicPage) {
        comicPage.style.display = 'block';
    }
    
    finalActions.style.display = 'none';
}

// Demo Mode Logic
demoBtn.addEventListener('click', async () => {
    toggleLoading(true);
    resetUI();
    
    updateStatus("Demo Mode: Generating Layout...", 50);
    
    const fakeCard = {
        headline: "SPACEX STARSHIP LANDS TRIUMPHANTLY ON THE MARS REGOLITH!",
        brief1: "IN A HISTORIC FEAT THAT DEFIES IMAGINATION, ELON MUSK'S GIGANTIC STARSHIP HAS TOUCHED DOWN ON THE RED PLANET'S DUSTY REGOLITH!",
        brief2: "MILLIONS HELD THEIR BREATH AS THE METAL TITAN BEAMED BACK SENSATIONAL PICTURES OF A NEW DAWN FOR INTERPLANETARY HUMANITY!",
        imagePrompt: "SpaceX Starship landed on Mars"
    };

    renderPlaceholderCards([fakeCard]);

    // Cache original text for translations
    originalCardTexts = [{
        headline: fakeCard.headline,
        brief1: fakeCard.brief1,
        brief2: fakeCard.brief2
    }];
    translationCache = {};
    const langSelect = document.getElementById('cardLanguageSelect');
    if (langSelect) langSelect.value = 'en';

    // Simulate image loading
    await new Promise(resolve => setTimeout(resolve, 1500)); // 1.5s delay
    
    updateStatus("Demo Mode: Finalizing design...", 90);
    const demoImgUrl = `https://picsum.photos/seed/${Math.random()}/1024/1024`;
    updateCardImageAtIndex(0, demoImgUrl, 1);

    updateStatus("Demo Layout Complete!", 100);
    toggleLoading(false);
});

function updateCardImageAtIndex(index, imageUrl, total) {
    const imgContainer = document.getElementById(`newsCardImgContainer-${index}`);
    if (!imgContainer) return;
    
    const skeleton = imgContainer.querySelector('.skeleton-img');
    const imgSrc = (imageUrl.startsWith('http') || imageUrl.startsWith('data:')) ? imageUrl : `data:image/png;base64,${imageUrl}`;
    
    // Cache the first image URL (fallback for any legacy usage or single card checks)
    if (index === 0) {
        generatedImageUrl = imgSrc;
    }

    const img = document.createElement('img');
    img.className = 'img';
    img.src = imgSrc;
    img.onload = () => {
        imgContainer.classList.remove('loading-state');
        if (skeleton) skeleton.remove();
        imgContainer.innerHTML = '';
        imgContainer.appendChild(img);
        
        // Show download/share buttons if all panels are loaded
        const activeLoaders = document.querySelectorAll('.news-card-img-container.loading-state');
        if (activeLoaders.length === 0) {
            finalActions.style.display = 'flex';
        }

        // Springy entrance for the card image
        gsap.fromTo(img, 
            { scale: 1.15, opacity: 0, rotation: -2 },
            { scale: 1, opacity: 1, rotation: 0, duration: 0.7, ease: "back.out(2)" }
        );
    };
}

function updateCardErrorAtIndex(index, errorMessage = "") {
    const imgContainer = document.getElementById(`newsCardImgContainer-${index}`);
    if (!imgContainer) return;
    
    imgContainer.classList.remove('loading-state');
    imgContainer.classList.add('error-state');
    
    let displayMessage = "⚠️ Failed to generate image";
    if (errorMessage && errorMessage.toLowerCase().includes("policy violation")) {
        displayMessage = "⚠️ Content policy violation";
    }
    
    imgContainer.innerHTML = `<div class="error-text" style="display: flex; align-items: center; justify-content: center; height: 100%; font-family: 'Bangers', cursive; font-size: 1.4rem; color: var(--c-red);">${displayMessage}</div>`;

    // Show download/share buttons if all panels are finished (even with errors)
    const activeLoaders = document.querySelectorAll('.news-card-img-container.loading-state');
    if (activeLoaders.length === 0) {
        finalActions.style.display = 'flex';
    }
}


function toggleLoading(isLoading) {
    generateBtn.disabled = isLoading;
    const btnText = document.getElementById('generateText');
    
    if (isLoading) {
        btnText.innerText = 'GENERATING';
        generateBtn.dataset.success = "false";
        mainLoader.style.display = 'block';
        resultSection.style.display = 'block';
        
        // Dynamic dashboard panel bounce
        gsap.fromTo(".modal-content-wrapper", 
            { scale: 0.85, rotation: -3, opacity: 0 },
            { scale: 1, rotation: 0, opacity: 1, duration: 0.6, ease: "back.out(1.8)" }
        );
    } else {
        btnText.innerText = generateBtn.dataset.success === "true" ? 'GENERATED' : 'GENERATE';
        mainLoader.style.display = 'none';
    }
}

function updateStatus(text, progress) {
    statusText.innerText = text;
    if (progress === 100) {
        mainLoader.style.display = 'none';
    }
}

function resetUI() {
    const cardsWorkspace = document.getElementById('cardsWorkspace');
    if (cardsWorkspace) {
        cardsWorkspace.innerHTML = '';
    }
    if (comicPage) {
        comicPage.style.display = 'none';
    }
    finalActions.style.display = 'none';
    generatedImageUrl = null;
}


// Download Button
downloadBtn.addEventListener('click', async () => {
    if (downloadBtn.disabled) return;
    const originalText = downloadBtn.innerText;
    downloadBtn.innerText = "PREPARING CARD...";
    downloadBtn.disabled = true;

    try {
        await document.fonts.ready;
        const canvas = await html2canvas(comicPage, {
            useCORS: true,
            scale: 2,
            backgroundColor: '#ffffff',
            logging: false
        });
        const dataUrl = canvas.toDataURL('image/png');
        const link = document.createElement('a');
        link.href = dataUrl;
        link.download = `ComicGen_NewsCard_${Date.now()}.png`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    } catch (err) {
        console.error("Card download failed:", err);
        alert("Failed to download the card image.");
    } finally {
        downloadBtn.innerText = originalText;
        downloadBtn.disabled = false;
    }
});

// Helper promise wrapper for canvas to Blob conversion
const getBlobFromCanvas = (canvas) => {
    return new Promise((resolve) => {
        canvas.toBlob((blob) => {
            resolve(blob);
        }, 'image/png');
    });
};

// Share Button
shareBtn.addEventListener('click', async () => {
    if (shareBtn.disabled) return;
    const originalText = shareBtn.innerText;
    shareBtn.innerText = "PREPARING...";
    shareBtn.disabled = true;

    try {
        await document.fonts.ready;
        const canvas = await html2canvas(comicPage, {
            useCORS: true,
            scale: 2,
            backgroundColor: '#ffffff',
            logging: false
        });
        
        const blob = await getBlobFromCanvas(canvas);
        if (!blob) {
            throw new Error("Failed to generate canvas image blob");
        }
        
        const file = new File([blob], `ComicGen_NewsCard_${Date.now()}.png`, { type: 'image/png' });
        
        if (navigator.canShare && navigator.canShare({ files: [file] })) {
            await navigator.share({
                files: [file],
                title: 'My ComicGen News Card',
                text: 'Check out this awesome AI generated news card!'
            });
        } else {
            // Copy website link to clipboard
            try {
                await navigator.clipboard.writeText(window.location.href);
            } catch (clipErr) {
                const dummy = document.createElement('input');
                document.body.appendChild(dummy);
                dummy.value = window.location.href;
                dummy.select();
                document.execCommand('copy');
                document.body.removeChild(dummy);
            }
            alert("Application link copied to clipboard! 📋 (Direct image sharing is supported on mobile devices)");
        }
    } catch (err) {
        if (err.name !== 'AbortError') {
            console.error("Share failed:", err);
            alert("Failed to share card: " + err.message);
        }
    } finally {
        shareBtn.innerText = originalText;
        shareBtn.disabled = false;
    }
});

function anonymizePrompt(prompt, style, caption = '') {
    let simplifiedPrompt = prompt;
    // Anonymize common celebrity/public figure names to avoid safety/policy filters
    const celebrityReplacements = [
        { regex: /cristiano ronaldo/gi, replacement: "a famous athletic Portuguese soccer player" },
        { regex: /ronaldo/gi, replacement: "a famous soccer player" },
        { regex: /cristiano/gi, replacement: "a soccer star" },
        { regex: /lionel messi/gi, replacement: "a famous Argentine soccer player" },
        { regex: /messi/gi, replacement: "a famous soccer player" },
        { regex: /lionel/gi, replacement: "a soccer superstar" },
        { regex: /lebron james/gi, replacement: "a famous tall basketball player" },
        { regex: /lebron/gi, replacement: "a famous basketball player" },
        { regex: /canelo alvarez/gi, replacement: "a famous boxing champion" },
        { regex: /canelo/gi, replacement: "a famous boxer" },
        { regex: /alvarez/gi, replacement: "a boxing champion" },
        { regex: /shohei ohtani/gi, replacement: "a famous baseball player" },
        { regex: /ohtani/gi, replacement: "a famous baseball player" },
        { regex: /shohei/gi, replacement: "a baseball star" },
        { regex: /taylor swift/gi, replacement: "a famous pop star" },
        { regex: /elon musk/gi, replacement: "a wealthy tech entrepreneur" }
    ];
    for (const r of celebrityReplacements) {
        simplifiedPrompt = simplifiedPrompt.replace(r.regex, r.replacement);
    }
    
    // If we have a caption, use it as a 100% clean, generic fallback prompt
    if (caption) {
        // Clean out monetary metrics/brackets that look strange as visual descriptions
        const cleanCaption = caption
            .replace(/\s*\(\s*\$\d+(?:\.\d+)?B?M?\s*\)\s*/gi, ' ')
            .replace(/\s*\$\d+(?:\.\d+)?B?M?\s*/gi, ' ')
            .replace(/\s*,\s*/g, ', ')
            .replace(/\s*\.\s*/g, '. ')
            .replace(/\s+/g, ' ')
            .trim();
        simplifiedPrompt = `A scene entirely in ${style || 'anime'} style. ${cleanCaption}. Every detail must strictly match the ${style || 'anime'} style. No realistic elements. Completely wordless, no text, no letters, no speech bubbles, no dialogue, no labels.`;
    } else if (simplifiedPrompt === prompt) {
        // Fallback if no caption is present and no celebrity names were replaced
        simplifiedPrompt = `A stunning scene in ${style || 'comic'} style. ${prompt.substring(0, 100)}... Completely wordless, no text, no letters, no speech bubbles, no dialogue, no labels.`;
    } else {
        simplifiedPrompt = `${simplifiedPrompt}. Completely wordless, no text, no letters, no speech bubbles, no dialogue, no labels.`;
    }
    return simplifiedPrompt;
}

const NVIDIA_PROMPT_LIMIT = 760;

function normalizePromptText(text = '') {
    return String(text).replace(/\s+/g, ' ').trim();
}

function stripRepeatedStyleWrapper(prompt) {
    let text = normalizePromptText(prompt);
    text = text.replace(/^A scene entirely in .*?style\.\s*/i, '');
    text = text.replace(/\s*Everything including background, environment, and characters must strictly be .*?style\.\s*No realistic elements\.?\s*$/i, '');
    return text;
}

function shortenPromptText(text, limit) {
    const clean = normalizePromptText(text);
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

function buildNvidiaPrompt(prompt, style) {
    const basePrompt = stripRepeatedStyleWrapper(prompt);
    const stylePrefix = style && style !== 'custom characters' ? `Style: ${normalizePromptText(style)}. ` : '';
    const styleSuffix = style && style !== 'custom characters' ? ' Keep it fully stylized. Wordless, no text, no letters, no speech bubbles, no dialogue, no labels.' : ' Wordless, no text, no letters, no speech bubbles, no dialogue, no labels.';
    const remaining = Math.max(120, NVIDIA_PROMPT_LIMIT - stylePrefix.length - styleSuffix.length);
    const compactPrompt = shortenPromptText(basePrompt, remaining);
    return `${stylePrefix}${compactPrompt}${styleSuffix}`.trim();
}

// Initialize the entire News Hub UI & Logic
initNewsHub();
initGlobalAnimations();

function initNewsHub() {
    console.log("📰 Arched News Cover Flow Hub initializing...");

    // News Hub Elements
    const newsFanDeck = document.getElementById('newsFanDeck');
    const newsSearch = document.getElementById('newsSearch');
    const newsDetailContainer = document.getElementById('newsDetailContainer');
    const fanPrev = document.getElementById('fanPrev');
    const fanNext = document.getElementById('fanNext');
    const categoryPills = document.querySelectorAll('.category-pills .pill');
    
    // Curated Premium Visual Articles Feed
    const NEWS_DATABASE = [
        {
            id: 1,
            title: "SpaceX lands Starship spacecraft successfully at Boca Chica",
            description: "SpaceX successfully lands its Starship spacecraft after a high-altitude test flight in Texas. The massive rocket performed a flawless belly-flop maneuver, ignited its Raptor engines, and settled upright onto the landing pad amidst cheering crowds, marking a historic leap towards Martian exploration.",
            category: "science",
            source: "Space Exploration",
            date: "May 24, 2026",
            image: "https://images.unsplash.com/photo-1541185933-ef5d8ed016c2?auto=format&fit=crop&w=600&q=80"
        },
        {
            id: 2,
            title: "Deep Space Webb Telescope detects alien atmosphere on distant Exoplanet",
            description: "Astronomers have confirmed that the James Webb Space Telescope has successfully mapped oxygen, carbon dioxide, and water vapor molecules in the atmosphere of a nearby rocky exoplanet orbiting a red dwarf star. The chemical signatures suggest the presence of a active, cloud-filled atmosphere capable of holding liquid oceans.",
            category: "science",
            source: "NASA & ESA",
            date: "May 23, 2026",
            image: "https://images.unsplash.com/photo-1451187580459-43490279c0fa?auto=format&fit=crop&w=600&q=80"
        },
        {
            id: 3,
            title: "Apple showcases fully transparent holographic iPhone prototype",
            description: "At a surprise technology keynote, Apple showcased a fully transparent glass smartphone prototype that bends light around components and displays interactive 3D holographic widgets directly in the air above the screen, shocking the tech world and reinventing mobile interfaces.",
            category: "tech",
            source: "Tech Insights",
            date: "May 24, 2026",
            image: "https://images.unsplash.com/photo-1620712943543-bcc4688e7485?auto=format&fit=crop&w=600&q=80"
        },
        {
            id: 4,
            title: "New AI reasoning model passes advanced Turing Test with deep philosophy",
            description: "Researchers announce that their latest advanced reasoning artificial intelligence model has successfully held long, deep philosophical debates with human evaluators. The AI successfully fooled standard evaluators over multiple hours, setting a profound new benchmark for machine intelligence.",
            category: "tech",
            source: "AI Frontiers",
            date: "May 22, 2026",
            image: "https://images.unsplash.com/photo-1507146426996-ef05306b995a?auto=format&fit=crop&w=600&q=80"
        },
        {
            id: 5,
            title: "Canelo Alvarez retains Undisputed Champion status in Vegas KO",
            description: "The undisputed boxing king Canelo Alvarez delivered a powerful, lightning-fast right hook in the eleventh round to knock out his challenger and retain his championship belts in Las Vegas. Golden confetti rained down on the ring as thousands of cheering fans chanted his name in a packed arena.",
            category: "sports",
            source: "Vegas Ring",
            date: "May 24, 2026",
            image: "https://images.unsplash.com/photo-1549719386-74dfcbf7dbed?auto=format&fit=crop&w=600&q=80"
        },
        {
            id: 6,
            title: "LeBron James breaks another scoring record in electric LA performance",
            description: "The legendary basketball veteran LeBron James scored a towering slam-dunk under the glowing arena lights, surpassing yet another historic NBA scoring milestone. The crowd erupted into deafening cheers in Los Angeles as teammates rushed the court to celebrate his unmatched legacy.",
            category: "sports",
            source: "LA Court",
            date: "May 21, 2026",
            image: "https://images.unsplash.com/photo-1546519638-68e109498ffc?auto=format&fit=crop&w=600&q=80"
        },
        {
            id: 7,
            title: "GTA 6 shocks the internet with official gameplay trailer showing Vice City",
            description: "Rockstar Games sent shockwaves through the global gaming industry by dropping the official gameplay reveal of Grand Theft Auto VI. The trailer showcases ultra-realistic neon skylines, high-speed speedboats ripping through marshes, and the dual protagonists initiating a daring bank heist.",
            category: "gaming",
            source: "V-Game News",
            date: "May 25, 2026",
            image: "https://images.unsplash.com/photo-1538481199705-c710c4e965fc?auto=format&fit=crop&w=600&q=80"
        },
        {
            id: 8,
            title: "Microsoft announces ray-traced Minecraft 2 with physics engine",
            description: "Microsoft shocked the creative gaming world by officially announcing a full sequel to the creative masterpiece, Minecraft. The new game features a full ray-traced lighting system, advanced soft-body physics, and infinite world generation, paving the way for a stunning blocky universe.",
            category: "gaming",
            source: "M-HQ",
            date: "May 23, 2026",
            image: "https://images.unsplash.com/photo-1607604276583-eef5d076aa5f?auto=format&fit=crop&w=600&q=80"
        }
    ];

    let activeCategory = 'trending';
    let searchQuery = '';
    let selectedArticle = null;
    let activeCenterIndex = 0; // The active card at the center position
    let searchDebounceTimeout = null;

    // Load initial arched feed
    renderNews();

    // Wire up Category Pills
    categoryPills.forEach(pill => {
        pill.addEventListener('click', () => {
            categoryPills.forEach(p => p.classList.remove('active'));
            pill.classList.add('active');
            
            activeCategory = pill.dataset.category;
            activeCenterIndex = 0; // Reset center on filter change
            renderNewsWithSkeleton();
        });
    });

    // Wire up search input with 250ms debouncing
    newsSearch.addEventListener('input', (e) => {
        clearTimeout(searchDebounceTimeout);
        searchDebounceTimeout = setTimeout(() => {
            searchQuery = e.target.value.toLowerCase().trim();
            activeCenterIndex = 0; // Reset center on search query change
            renderNews();
        }, 250);
    });

    // Carousel Button Controls
    fanPrev.addEventListener('click', () => {
        const filtered = getFilteredNews();
        const N = filtered.length;
        if (N === 0) return;
        activeCenterIndex = (activeCenterIndex - 1 + N) % N;
        updateDeckPositions(filtered);
    });

    fanNext.addEventListener('click', () => {
        const filtered = getFilteredNews();
        const N = filtered.length;
        if (N === 0) return;
        activeCenterIndex = (activeCenterIndex + 1) % N;
        updateDeckPositions(filtered);
    });

    // Helper to get active list of filtered articles
    function getFilteredNews() {
        let filtered = NEWS_DATABASE;
        if (activeCategory !== 'trending') {
            filtered = filtered.filter(item => item.category === activeCategory);
        }
        if (searchQuery) {
            filtered = filtered.filter(item => 
                item.title.toLowerCase().includes(searchQuery) || 
                item.description.toLowerCase().includes(searchQuery)
            );
        }
        return filtered;
    }

    // Renders skeleton shimmer cards before loading results
    function renderNewsWithSkeleton() {
        newsFanDeck.innerHTML = `
            <div class="skeleton-fan-deck">
                <div class="skeleton-fan-card">
                    <div class="card-img"><div class="skeleton-fan-img"></div></div>
                    <div class="skeleton-fan-text title-line-1"></div>
                    <div class="skeleton-fan-text title-line-2"></div>
                    <hr class="card-divider">
                    <div class="card-footer">
                        <div class="skeleton-fan-text desc-line-1" style="width: 50%;"></div>
                        <div class="skeleton-fan-text desc-line-2" style="width: 30%;"></div>
                    </div>
                </div>
                <div class="skeleton-fan-card">
                    <div class="card-img"><div class="skeleton-fan-img"></div></div>
                    <div class="skeleton-fan-text title-line-1"></div>
                    <div class="skeleton-fan-text title-line-2"></div>
                    <hr class="card-divider">
                    <div class="card-footer">
                        <div class="skeleton-fan-text desc-line-1" style="width: 50%;"></div>
                        <div class="skeleton-fan-text desc-line-2" style="width: 30%;"></div>
                    </div>
                </div>
                <div class="skeleton-fan-card">
                    <div class="card-img"><div class="skeleton-fan-img"></div></div>
                    <div class="skeleton-fan-text title-line-1"></div>
                    <div class="skeleton-fan-text title-line-2"></div>
                    <hr class="card-divider">
                    <div class="card-footer">
                        <div class="skeleton-fan-text desc-line-1" style="width: 50%;"></div>
                        <div class="skeleton-fan-text desc-line-2" style="width: 30%;"></div>
                    </div>
                </div>
            </div>
        `;
        newsDetailContainer.style.display = 'none';

        setTimeout(() => {
            renderNews();
        }, 450);
    }

    // Filter and Render News Cards
    function renderNews() {
        const filtered = getFilteredNews();

        if (filtered.length === 0) {
            newsFanDeck.innerHTML = `
                <div style="text-align: center; padding: 3rem 1rem; color: var(--text-muted); width: 100%;">
                    <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-bottom: 1rem; opacity: 0.5;"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
                    <p style="font-weight: 600; font-size: 1.1rem;">No matching articles found</p>
                    <p style="font-size: 0.9rem;">Try filtering by a different category or search term.</p>
                </div>
            `;
            newsDetailContainer.style.display = 'none';
            return;
        }

        // Keep bounds correct
        if (activeCenterIndex >= filtered.length) {
            activeCenterIndex = 0;
        }

        newsFanDeck.innerHTML = '';
        filtered.forEach((article, idx) => {
            const card = document.createElement('div');
            card.className = 'news-card-fan';
            card.dataset.index = idx;
            card.innerHTML = `
                <div class="card-img">
                    <img class="img" src="${article.image}" alt="${article.title}" loading="lazy" />
                </div>
                <div class="card-title">${article.title}</div>
                <div class="card-subtitle">${article.description}</div>
                <hr class="card-divider">
                <div class="card-footer">
                    <div class="card-price">
                        ${article.category}
                        <span>${article.source}</span>
                    </div>
                </div>
            `;

            // Click shifts this card to the active center slot
            card.addEventListener('click', () => {
                activeCenterIndex = idx;
                updateDeckPositions(filtered);
            });

            newsFanDeck.appendChild(card);

            // GSAP card layout deal-out animation
            gsap.fromTo(card, 
                { scale: 0.8, opacity: 0, y: 30, rotation: idx % 2 === 0 ? 3 : -3 },
                { 
                    scale: 1, 
                    opacity: 1, 
                    y: 0, 
                    rotation: 0, 
                    duration: 0.5, 
                    delay: idx * 0.04, 
                    ease: "back.out(2)",
                    onComplete: () => {
                        card.style.transform = '';
                        card.style.opacity = '';
                    }
                }
            );
        });

        updateDeckPositions(filtered);
    }

    // Assign positions based on selected card to generate fanning arc
    function updateDeckPositions(filtered) {
        const N = filtered.length;
        if (N === 0) return;

        const cards = newsFanDeck.querySelectorAll('.news-card-fan');
        cards.forEach((card) => {
            // Clear any inline overrides to restore CSS cover flow layout
            card.style.transform = '';
            card.style.opacity = '';

            const idx = parseInt(card.dataset.index, 10);
            
            let diff = idx - activeCenterIndex;
            // Shortest circular wrap distance calculation
            if (diff < -N / 2) diff += N;
            if (diff > N / 2) diff -= N;

            card.className = 'news-card-fan';

            if (diff === 0) {
                card.classList.add('pos-2');
                selectedArticle = filtered[idx];
                renderDetailPanel(selectedArticle);
            } else if (diff === -1) {
                card.classList.add('pos-1');
            } else if (diff === -2) {
                card.classList.add('pos-0');
            } else if (diff === 1) {
                card.classList.add('pos-3');
            } else if (diff === 2) {
                card.classList.add('pos-4');
            } else if (diff < -2) {
                card.classList.add('pos-hidden-left');
            } else if (diff > 2) {
                card.classList.add('pos-hidden-right');
            }
        });
    }

    // Opens news card in the dynamic detail box below
    function renderDetailPanel(article) {
        newsDetailContainer.style.display = 'grid';
        
        newsDetailContainer.innerHTML = `
            <!-- Left Column: Large Image -->
            <div class="news-detail-left">
                <div class="news-detail-img-box">
                    <img src="${article.image}" alt="${article.title}" />
                </div>
            </div>

            <!-- Right Column: Title, Metadata, and scrollable description body text -->
            <div class="news-detail-right">
                <div class="news-detail-meta">
                    <span class="news-detail-category">${article.category}</span>
                    <span class="news-detail-source">${article.source}</span>
                    <span class="news-detail-date">${article.date}</span>
                </div>
                <h2 class="news-detail-title">${article.title}</h2>
                <div class="news-detail-body-text">
                    <strong>FULL ARTICLE BODY EXCERPT:</strong><br><br>
                    ${article.description} This thrilling news release is expected to send positive ripples throughout the community, setting a stunning precedent for upcoming generations of creators. Enthusiasts are highly eager to witness how developers translate these foundational improvements into actual consumer features in the very near future. The feedback received thus far has been overwhelmingly celebratory.
                </div>
            </div>
        `;

        // GSAP bounce detail panel reveal
        gsap.fromTo(newsDetailContainer,
            { y: 50, opacity: 0, scale: 0.96 },
            { y: 0, opacity: 1, scale: 1, duration: 0.55, ease: "back.out(1.6)" }
        );
        gsap.fromTo(".news-detail-img-box",
            { rotation: -4, scale: 0.9 },
            { rotation: 0, scale: 1, duration: 0.45, ease: "back.out(2.2)" }
        );
    }
}

function initGlobalAnimations() {
    console.log("🎬 Setting up GSAP Comic Animations...");

    // 1. Page Load Entrances
    // Logo sticker spin & pop
    gsap.fromTo(".logo-sticker", 
        { scale: 0, rotation: -30, opacity: 0 },
        { scale: 1, rotation: -1.5, opacity: 1, duration: 0.8, delay: 0.1, ease: "back.out(2)" }
    );

    // Comic authority stamp stamp-in effect
    gsap.fromTo(".comic-code-badge", 
        { scale: 3, rotation: 45, opacity: 0 },
        { scale: 1, rotation: 5, opacity: 1, duration: 0.5, delay: 0.5, ease: "bounce.out" }
    );

    // Header plate slide-down
    gsap.fromTo(".comic-header-bar",
        { y: -80, opacity: 0 },
        { y: 0, opacity: 1, duration: 0.7, ease: "back.out(1.2)" }
    );

    // News hub card panel pop-up
    gsap.fromTo(".news-reader-section",
        { y: 60, opacity: 0 },
        { y: 0, opacity: 1, duration: 0.75, delay: 0.2, ease: "back.out(1.3)" }
    );

    // Custom converter header and workspace panel pop-up
    gsap.fromTo(".custom-converter-header",
        { scale: 0.8, opacity: 0 },
        { scale: 1, opacity: 1, duration: 0.65, delay: 0.4, ease: "back.out(1.8)" }
    );
    gsap.fromTo(".input-panel",
        { y: 60, opacity: 0 },
        { y: 0, opacity: 1, duration: 0.8, delay: 0.5, ease: "back.out(1.3)" }
    );

    // 2. Interactive Scroll Observer for How It Works Step Strip
    const stripObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                gsap.fromTo(entry.target.querySelectorAll(".strip-panel"), 
                    { scale: 0.82, opacity: 0, y: 35, rotation: -2 },
                    { scale: 1, opacity: 1, y: 0, rotation: 0, duration: 0.6, stagger: 0.15, ease: "back.out(1.8)", overwrite: "auto" }
                );
                stripObserver.unobserve(entry.target);
            }
        });
    }, { threshold: 0.12 });

    const stripEl = document.querySelector(".how-it-works-strip");
    if (stripEl) stripObserver.observe(stripEl);

    // 3. Hover Micro-interactions (Bounce/Pop/Wiggle)
    
    // Category pills wiggle on hover
    const pills = document.querySelectorAll(".category-pills .pill");
    pills.forEach(pill => {
        pill.addEventListener('mouseenter', () => {
            if (!pill.classList.contains('active')) {
                gsap.to(pill, { scale: 1.05, rotation: Math.random() * 4 - 2, duration: 0.2, ease: "power1.out" });
            }
        });
        pill.addEventListener('mouseleave', () => {
            if (!pill.classList.contains('active')) {
                gsap.to(pill, { scale: 1, rotation: 0, duration: 0.2, ease: "power1.out" });
            }
        });
        pill.addEventListener('click', () => {
            gsap.fromTo(pill, 
                { scale: 0.9, rotation: 0 },
                { scale: 1.02, rotation: 2, duration: 0.25, ease: "back.out(3.5)" }
            );
        });
    });

    // Style selector cards wiggle
    const styleCards = document.querySelectorAll(".style-card");
    styleCards.forEach(card => {
        const content = card.querySelector(".style-card-content");
        if (!content) return;
        
        card.addEventListener('mouseenter', () => {
            const isChecked = card.querySelector("input").checked;
            if (!isChecked) {
                gsap.to(content, { scale: 1.04, rotation: Math.random() * 3 - 1.5, duration: 0.2, ease: "power1.out" });
            }
        });
        card.addEventListener('mouseleave', () => {
            const isChecked = card.querySelector("input").checked;
            if (!isChecked) {
                gsap.to(content, { scale: 1, rotation: 0, duration: 0.2, ease: "power1.out" });
            }
        });
        card.addEventListener('click', () => {
            gsap.fromTo(content, 
                { scale: 0.94 },
                { scale: 1.02, duration: 0.28, ease: "back.out(3)" }
            );
        });
    });

    // Secondary actions bounce
    const actionBtns = document.querySelectorAll(".btn-secondary-action, .btn-ghost-action");
    actionBtns.forEach(btn => {
        btn.addEventListener('mouseenter', () => {
            gsap.to(btn, { scale: 1.04, rotation: Math.random() * 2 - 1, duration: 0.2, ease: "power1.out" });
        });
        btn.addEventListener('mouseleave', () => {
            gsap.to(btn, { scale: 1, rotation: 0, duration: 0.2, ease: "power1.out" });
        });
        btn.addEventListener('click', () => {
            gsap.fromTo(btn,
                { scale: 0.92 },
                { scale: 1.02, duration: 0.25, ease: "back.out(3)" }
            );
        });
    });
}

// --- WEB AUDIO API COMIC SOUND EFFECTS ENGINE ---

const sfx = {
    ctx: null,
    muted: localStorage.getItem('sfxMuted') === 'true',
    musicInterval: null,
    musicStep: 0,
    musicPlaying: false,
    initCtx: () => {
        if (!sfx.ctx) {
            sfx.ctx = new (window.AudioContext || window.webkitAudioContext)();
        }
        if (sfx.ctx.state === 'suspended') {
            sfx.ctx.resume();
        }
    },
    toggleMute: () => {
        sfx.muted = !sfx.muted;
        localStorage.setItem('sfxMuted', sfx.muted);
        sfx.updateToggleUI();
        if (sfx.muted) {
            sfx.stopMusic();
        } else {
            sfx.initCtx();
            sfx.playMusic();
            sfx.playPop();
        }
    },
    updateToggleUI: () => {
        const toggleBtn = document.getElementById('soundToggle');
        if (toggleBtn) {
            const icon = toggleBtn.querySelector('.sound-icon');
            const text = toggleBtn.querySelector('.sound-text');
            if (sfx.muted) {
                if (icon) icon.innerText = '🔇';
                if (text) text.innerText = 'SOUNDS: MUTED';
                toggleBtn.classList.add('muted');
            } else {
                if (icon) icon.innerText = '🔊';
                if (text) text.innerText = 'SOUNDS: ON';
                toggleBtn.classList.remove('muted');
            }
        }
    },
    playPop: () => {
        try {
            sfx.initCtx();
            if (sfx.muted) return;
            const now = sfx.ctx.currentTime;
            const osc = sfx.ctx.createOscillator();
            const gain = sfx.ctx.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(600, now);
            osc.frequency.exponentialRampToValueAtTime(1500, now + 0.05);
            gain.gain.setValueAtTime(0.12, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
            osc.connect(gain);
            gain.connect(sfx.ctx.destination);
            osc.start(now);
            osc.stop(now + 0.05);
        } catch (e) {}
    },
    playBoing: () => {
        try {
            sfx.initCtx();
            if (sfx.muted) return;
            const now = sfx.ctx.currentTime;
            const osc = sfx.ctx.createOscillator();
            const gain = sfx.ctx.createGain();
            osc.type = 'triangle';
            
            // Classical bouncing pitch sequence
            osc.frequency.setValueAtTime(130, now);
            osc.frequency.exponentialRampToValueAtTime(380, now + 0.08);
            osc.frequency.exponentialRampToValueAtTime(160, now + 0.16);
            osc.frequency.exponentialRampToValueAtTime(320, now + 0.24);
            osc.frequency.exponentialRampToValueAtTime(140, now + 0.32);
            osc.frequency.exponentialRampToValueAtTime(220, now + 0.40);
            osc.frequency.exponentialRampToValueAtTime(50, now + 0.50);

            gain.gain.setValueAtTime(0.001, now);
            gain.gain.linearRampToValueAtTime(0.10, now + 0.05);
            gain.gain.linearRampToValueAtTime(0.10, now + 0.30);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.50);

            osc.connect(gain);
            gain.connect(sfx.ctx.destination);
            osc.start(now);
            osc.stop(now + 0.50);
        } catch (e) {}
    },
    playZap: () => {
        try {
            sfx.initCtx();
            if (sfx.muted) return;
            const now = sfx.ctx.currentTime;
            const osc = sfx.ctx.createOscillator();
            const gain = sfx.ctx.createGain();
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(850, now);
            osc.frequency.exponentialRampToValueAtTime(80, now + 0.18);
            gain.gain.setValueAtTime(0.07, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
            osc.connect(gain);
            gain.connect(sfx.ctx.destination);
            osc.start(now);
            osc.stop(now + 0.18);
        } catch (e) {}
    },
    playWhistle: () => {
        try {
            sfx.initCtx();
            if (sfx.muted) return;
            const now = sfx.ctx.currentTime;
            const osc = sfx.ctx.createOscillator();
            const gain = sfx.ctx.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(250, now);
            osc.frequency.quadraticRampToValueAtTime(850, now + 0.22);
            gain.gain.setValueAtTime(0.07, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
            osc.connect(gain);
            gain.connect(sfx.ctx.destination);
            osc.start(now);
            osc.stop(now + 0.22);
        } catch (e) {}
    },
    playWobble: () => {
        try {
            sfx.initCtx();
            if (sfx.muted) return;
            const now = sfx.ctx.currentTime;
            const osc = sfx.ctx.createOscillator();
            const gain = sfx.ctx.createGain();
            osc.type = 'triangle';
            
            // Fast slide wobble
            osc.frequency.setValueAtTime(320, now);
            for (let i = 0; i < 6; i++) {
                const time = now + (i * 0.04);
                const freq = i % 2 === 0 ? 480 : 220;
                osc.frequency.linearRampToValueAtTime(freq, time + 0.04);
            }
            
            gain.gain.setValueAtTime(0.07, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.24);
            osc.connect(gain);
            gain.connect(sfx.ctx.destination);
            osc.start(now);
            osc.stop(now + 0.24);
        } catch (e) {}
    },
    playGenerate: () => {
        try {
            sfx.initCtx();
            if (sfx.muted) return;
            const now = sfx.ctx.currentTime;
            
            // 1. Bubble cascade (cooking theme)
            for (let i = 0; i < 15; i++) {
                const delay = i * 0.07;
                const osc = sfx.ctx.createOscillator();
                const gain = sfx.ctx.createGain();
                osc.type = 'sine';
                const baseFreq = 220 + Math.random() * 580;
                osc.frequency.setValueAtTime(baseFreq, now + delay);
                osc.frequency.exponentialRampToValueAtTime(baseFreq * 2.8, now + delay + 0.06);
                gain.gain.setValueAtTime(0.001, now + delay);
                gain.gain.linearRampToValueAtTime(0.05, now + delay + 0.01);
                gain.gain.exponentialRampToValueAtTime(0.001, now + delay + 0.06);
                osc.connect(gain);
                gain.connect(sfx.ctx.destination);
                osc.start(now + delay);
                osc.stop(now + delay + 0.06);
            }

            // 2. Comical rising slide whistle
            const sweepOsc = sfx.ctx.createOscillator();
            const sweepGain = sfx.ctx.createGain();
            sweepOsc.type = 'triangle';
            sweepOsc.frequency.setValueAtTime(140, now);
            sweepOsc.frequency.exponentialRampToValueAtTime(1100, now + 0.95);
            sweepGain.gain.setValueAtTime(0.03, now);
            sweepGain.gain.linearRampToValueAtTime(0.03, now + 0.75);
            sweepGain.gain.exponentialRampToValueAtTime(0.001, now + 0.95);
            sweepOsc.connect(sweepGain);
            sweepGain.connect(sfx.ctx.destination);
            sweepOsc.start(now);
            sweepOsc.stop(now + 0.95);

            // 3. Fun cartoon "TADA" brassy horn chord when comic is completed
            setTimeout(() => {
                if (sfx.muted) return;
                const tadaNow = sfx.ctx.currentTime;
                const freqs = [392.00, 587.33, 783.99]; // G4, D5, G5
                freqs.forEach(freq => {
                    const osc = sfx.ctx.createOscillator();
                    const gain = sfx.ctx.createGain();
                    osc.type = 'sawtooth';
                    
                    osc.frequency.setValueAtTime(freq, tadaNow);
                    osc.frequency.linearRampToValueAtTime(freq + 6, tadaNow + 0.1);
                    osc.frequency.linearRampToValueAtTime(freq - 6, tadaNow + 0.2);
                    osc.frequency.linearRampToValueAtTime(freq, tadaNow + 0.3);
                    
                    const filter = sfx.ctx.createBiquadFilter();
                    filter.type = 'lowpass';
                    filter.frequency.setValueAtTime(1300, tadaNow);
                    
                    gain.gain.setValueAtTime(0.03, tadaNow);
                    gain.gain.linearRampToValueAtTime(0.03, tadaNow + 0.25);
                    gain.gain.exponentialRampToValueAtTime(0.001, tadaNow + 0.45);
                    
                    osc.connect(filter);
                    filter.connect(gain);
                    gain.connect(sfx.ctx.destination);
                    osc.start(tadaNow);
                    osc.stop(tadaNow + 0.45);
                });
            }, 950);
        } catch (e) {}
    },
    playMusic: () => {
        if (sfx.musicPlaying) return;
        sfx.initCtx();
        if (sfx.muted) return;
        sfx.musicPlaying = true;
        
        const bpm = 135;
        const stepTime = 60 / bpm / 2; // eighth notes
        
        // C major cheerful loop
        const melodyPattern = [
            261.63, 0, 329.63, 392.00, 0, 329.63, 293.66, 392.00,
            440.00, 0, 392.00, 523.25, 0, 440.00, 392.00, 0,
            349.23, 0, 392.00, 440.00, 0, 392.00, 349.23, 329.63,
            293.66, 0, 329.63, 392.00, 293.66, 0, 0, 0
        ];
        
        const bassPattern = [
            130.81, 130.81, 196.00, 196.00, 146.83, 146.83, 196.00, 196.00,
            174.61, 174.61, 220.00, 220.00, 196.00, 196.00, 130.81, 130.81,
            174.61, 174.61, 174.61, 174.61, 130.81, 130.81, 130.81, 130.81,
            146.83, 146.83, 196.00, 196.00, 130.81, 196.00, 130.81, 0
        ];
        
        let nextNoteTime = sfx.ctx.currentTime;
        
        function scheduler() {
            while (nextNoteTime < sfx.ctx.currentTime + 0.1) {
                const time = nextNoteTime;
                const step = sfx.musicStep % melodyPattern.length;
                
                // Melody Osc
                const melFreq = melodyPattern[step];
                if (melFreq > 0) {
                    const osc = sfx.ctx.createOscillator();
                    const gain = sfx.ctx.createGain();
                    osc.type = 'triangle';
                    osc.frequency.setValueAtTime(melFreq, time);
                    
                    gain.gain.setValueAtTime(0, time);
                    gain.gain.linearRampToValueAtTime(0.010, time + 0.01);
                    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.14);
                    
                    osc.connect(gain);
                    gain.connect(sfx.ctx.destination);
                    osc.start(time);
                    osc.stop(time + 0.15);
                }
                
                // Bass Osc
                const bassFreq = bassPattern[step];
                if (bassFreq > 0 && step % 2 === 0) {
                    const osc = sfx.ctx.createOscillator();
                    const gain = sfx.ctx.createGain();
                    osc.type = 'sine';
                    osc.frequency.setValueAtTime(bassFreq, time);
                    
                    gain.gain.setValueAtTime(0, time);
                    gain.gain.linearRampToValueAtTime(0.015, time + 0.01);
                    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.20);
                    
                    osc.connect(gain);
                    gain.connect(sfx.ctx.destination);
                    osc.start(time);
                    osc.stop(time + 0.22);
                }
                
                // Noise percussion tick on beats 2 and 4 (step 4, 12, 20, 28)
                if (step % 8 === 4) {
                    const bufferSize = sfx.ctx.sampleRate * 0.02;
                    const buffer = sfx.ctx.createBuffer(1, bufferSize, sfx.ctx.sampleRate);
                    const data = buffer.getChannelData(0);
                    for (let i = 0; i < bufferSize; i++) {
                        data[i] = Math.random() * 2 - 1;
                    }
                    const noise = sfx.ctx.createBufferSource();
                    noise.buffer = buffer;
                    const filter = sfx.ctx.createBiquadFilter();
                    filter.type = 'bandpass';
                    filter.frequency.setValueAtTime(1200, time);
                    const noiseGain = sfx.ctx.createGain();
                    noiseGain.gain.setValueAtTime(0.003, time);
                    noiseGain.gain.exponentialRampToValueAtTime(0.0001, time + 0.02);
                    
                    noise.connect(filter);
                    filter.connect(noiseGain);
                    noiseGain.connect(sfx.ctx.destination);
                    noise.start(time);
                    noise.stop(time + 0.02);
                }
                
                nextNoteTime += stepTime;
                sfx.musicStep++;
            }
        }
        
        sfx.musicInterval = setInterval(scheduler, 40);
    },
    stopMusic: () => {
        if (sfx.musicInterval) {
            clearInterval(sfx.musicInterval);
            sfx.musicInterval = null;
        }
        sfx.musicPlaying = false;
    }
};

function setupAudioSFX() {
    // 1. Initial background gesture activator
    const initAudioOnGesture = () => {
        sfx.initCtx();
        if (!sfx.muted && !sfx.musicPlaying) {
            sfx.playMusic();
        }
        // Remove gesture event bindings
        ['click', 'keydown', 'mousedown', 'touchstart'].forEach(evt => {
            document.removeEventListener(evt, initAudioOnGesture);
        });
    };
    ['click', 'keydown', 'mousedown', 'touchstart'].forEach(evt => {
        document.addEventListener(evt, initAudioOnGesture);
    });

    // 2. Setup Toggle Button Handler
    sfx.updateToggleUI();
    const toggleBtn = document.getElementById('soundToggle');
    if (toggleBtn) {
        toggleBtn.addEventListener('click', (e) => {
            e.stopPropagation(); // prevent triggering parent click handlers
            sfx.toggleMute();
        });
    }

    // 3. Hover sounds mapping
    const hoverSelectors = {
        pop: [
            'button:not(#soundToggle)',
            '.category-pills .pill',
            '.style-card',
            '.close-modal-btn',
            '.fan-deck-nav',
            '.final-actions button'
        ],
        wobble: [
            '.logo-sticker',
            '.comic-code-badge'
        ],
        whistle: [
            '#newsSearch',
            'textarea'
        ]
    };

    document.addEventListener('mouseover', (e) => {
        if (sfx.muted) return;
        
        // Find if target matches any hover sound selectors
        for (const [soundName, selectors] of Object.entries(hoverSelectors)) {
            for (const selector of selectors) {
                const el = e.target.closest(selector);
                if (el) {
                    if (!el.dataset.sfxHovered) {
                        el.dataset.sfxHovered = "true";
                        
                        // Play matched sound
                        if (soundName === 'pop') sfx.playPop();
                        else if (soundName === 'wobble') sfx.playWobble();
                        else if (soundName === 'whistle') sfx.playWhistle();
                        
                        // Small cool down to avoid rapid trigger spam
                        setTimeout(() => { delete el.dataset.sfxHovered; }, 300);
                    }
                    return; // found match, exit
                }
            }
        }
    });

    // 4. Click sounds mapping
    document.addEventListener('click', (e) => {
        if (e.target.closest('#soundToggle')) return;
        
        // Check generate action
        const genBtn = e.target.closest('#generateBtn, #generateText, .generate-btn-wrapper');
        if (genBtn) {
            sfx.playGenerate();
            return;
        }

        // Check badge / logo zap click
        const zapBtn = e.target.closest('.logo-sticker, .comic-code-badge');
        if (zapBtn) {
            sfx.playZap();
            return;
        }

        // Check slide whistle clicks (text input focus)
        const whistleBtn = e.target.closest('#newsSearch, textarea');
        if (whistleBtn) {
            sfx.playWhistle();
            return;
        }

        // Check normal interactive element click (boing!)
        const interactiveSelector = 'button, .category-pills .pill, .style-card, .news-card-fan, .close-modal-btn, .fan-deck-nav';
        const el = e.target.closest(interactiveSelector);
        if (el) {
            sfx.playBoing();
        }
    });
}

// Initialize SFX Engine
// setupAudioSFX();

// --- SARVAM TRANSLATION HELPERS & LISTENER ---

async function translateText(text, targetLanguage) {
    if (!text || text.trim() === "") return "";
    
    const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    
    // On production (Netlify), use the secure backend serverless function!
    if (!isLocalhost || !SARVAM_API_KEY || SARVAM_API_KEY.includes('ADD_YOUR')) {
        console.log(`🌐 Calling secure Netlify function for translating to ${targetLanguage}...`);
        const response = await fetch("/.netlify/functions/translate", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ text, targetLanguage })
        });
        if (!response.ok) {
            const errData = await response.json().catch(() => ({}));
            throw new Error(errData.error || `HTTP ${response.status} failed to translate`);
        }
        const data = await response.json();
        return data.translatedText;
    }
    
    // Local Fallback: Direct API call via Vite proxy to bypass CORS
    console.log(`🤖 Call to Sarvam AI via Vite proxy for translating to ${targetLanguage}...`);
    const response = await fetch("/api/sarvam/translate", {
        method: "POST",
        headers: {
            "api-subscription-key": SARVAM_API_KEY,
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
    return data.translated_text;
}

// Wire up language translation selector
const cardLanguageSelect = document.getElementById('cardLanguageSelect');
if (cardLanguageSelect) {
    cardLanguageSelect.addEventListener('change', async (e) => {
        const targetLang = e.target.value;
        if (!originalCardTexts || originalCardTexts.length === 0) return;
        
        const total = originalCardTexts.length;

        // If English is selected, restore instantly
        if (targetLang === 'en') {
            for (let i = 0; i < total; i++) {
                const headlineEl = document.getElementById(`newsCardHeadline-${i}`);
                const brief1El = document.getElementById(`newsCardBrief1-${i}`);
                const brief2El = document.getElementById(`newsCardBrief2-${i}`);
                if (headlineEl) headlineEl.innerText = originalCardTexts[i].headline.toUpperCase();
                if (brief1El) brief1El.innerText = originalCardTexts[i].brief1;
                if (brief2El) brief2El.innerText = originalCardTexts[i].brief2;
            }
            return;
        }
        
        // Check cache first
        if (translationCache[targetLang]) {
            console.log(`⚡ Translation cache hit for language: ${targetLang}`);
            const cachedArray = translationCache[targetLang];
            for (let i = 0; i < total; i++) {
                const headlineEl = document.getElementById(`newsCardHeadline-${i}`);
                const brief1El = document.getElementById(`newsCardBrief1-${i}`);
                const brief2El = document.getElementById(`newsCardBrief2-${i}`);
                if (headlineEl && cachedArray[i]) headlineEl.innerText = cachedArray[i].headline.toUpperCase();
                if (brief1El && cachedArray[i]) brief1El.innerText = cachedArray[i].brief1;
                if (brief2El && cachedArray[i]) brief2El.innerText = cachedArray[i].brief2;
            }
            return;
        }
        
        // Save original HTML in case of error
        const origValues = [];
        for (let i = 0; i < total; i++) {
            const headlineEl = document.getElementById(`newsCardHeadline-${i}`);
            const brief1El = document.getElementById(`newsCardBrief1-${i}`);
            const brief2El = document.getElementById(`newsCardBrief2-${i}`);
            
            origValues.push({
                headlineHtml: headlineEl ? headlineEl.innerHTML : '',
                brief1Html: brief1El ? brief1El.innerHTML : '',
                brief2Html: brief2El ? brief2El.innerHTML : ''
            });

            if (headlineEl) headlineEl.innerText = "TRANSLATING...";
            if (brief1El) brief1El.innerText = "TRANSLATING...";
            if (brief2El) brief2El.innerText = "TRANSLATING...";
        }
        
        try {
            const promises = [];
            for (let i = 0; i < total; i++) {
                const card = originalCardTexts[i];
                promises.push(
                    translateText(card.headline, targetLang),
                    translateText(card.brief1, targetLang),
                    translateText(card.brief2, targetLang)
                );
            }
            
            const results = await Promise.all(promises);
            const cachedArray = [];
            
            for (let i = 0; i < total; i++) {
                const transHeadline = results[i * 3];
                const transBrief1 = results[i * 3 + 1];
                const transBrief2 = results[i * 3 + 2];
                
                const headlineEl = document.getElementById(`newsCardHeadline-${i}`);
                const brief1El = document.getElementById(`newsCardBrief1-${i}`);
                const brief2El = document.getElementById(`newsCardBrief2-${i}`);
                
                if (headlineEl) headlineEl.innerText = transHeadline.toUpperCase();
                if (brief1El) brief1El.innerText = transBrief1;
                if (brief2El) brief2El.innerText = transBrief2;
                
                cachedArray.push({
                    headline: transHeadline,
                    brief1: transBrief1,
                    brief2: transBrief2
                });
            }
            
            translationCache[targetLang] = cachedArray;
            
        } catch (error) {
            console.error("Translation failed:", error);
            alert(`Translation failed: ${error.message}`);
            
            // Restore original values
            for (let i = 0; i < total; i++) {
                const headlineEl = document.getElementById(`newsCardHeadline-${i}`);
                const brief1El = document.getElementById(`newsCardBrief1-${i}`);
                const brief2El = document.getElementById(`newsCardBrief2-${i}`);
                
                if (headlineEl) headlineEl.innerHTML = origValues[i].headlineHtml;
                if (brief1El) brief1El.innerHTML = origValues[i].brief1Html;
                if (brief2El) brief2El.innerHTML = origValues[i].brief2Html;
            }
            
            e.target.value = 'en';
        }
    });
}

