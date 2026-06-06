// Note: We are using the CDN version of Gemini for zero-config setup
// In index.html: <script type="importmap">...</script>
import { GoogleGenerativeAI } from "@google/generative-ai";
import { gsap } from "gsap";

console.log("🎨 ComicGen initialized...");

// API Keys from .env
const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY;
const NVIDIA_API_KEY = import.meta.env.VITE_NVIDIA_API_KEY;

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

// Elements
const generateBtn = document.getElementById('generateBtn');
const articleInput = document.getElementById('articleInput');
const resultSection = document.getElementById('resultSection');
const comicGrid = document.getElementById('comicGrid');
const statusText = document.getElementById('statusText');
const mainLoader = document.getElementById('mainLoader');
const demoBtn = document.getElementById('demoBtn');

// Available Layouts
const LAYOUTS = ['layout-hero-top', 'layout-action', 'layout-magazine'];

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
        // Step 1: Generate Storyboard with Gemini
        updateStatus("Storyboarder: Analyzing your article...", 10);
        const storyboard = await generateStoryboard(article, characterStyle);
        
        if (!storyboard || !storyboard.panels) {
            throw new Error("Failed to generate storyboard. Please try again.");
        }

        updateStatus(`Artist: Sketching ${storyboard.panels.length} panels...`, 20);

        // Step 2: Generate Images with Flux (Nvidia API)
        const totalPanels = storyboard.panels.length;
        let completed = 0;

        // Pick random layout and render placeholders
        const layoutClass = LAYOUTS[Math.floor(Math.random() * LAYOUTS.length)];
        renderPlaceholders(storyboard.panels, layoutClass);

        for (let index = 0; index < storyboard.panels.length; index++) {
            const panel = storyboard.panels[index];
            try {
                // Add a solid 2000ms (2 second) delay to be gentle on the Nvidia API rate limiter
                if (index > 0) await new Promise(resolve => setTimeout(resolve, 2000));

                const imageUrl = await generateImage(panel.description, characterStyle, panel.caption);
                completed++;
                const progress = 20 + (completed / totalPanels) * 80;
                updateStatus(`Artist: Finalizing panel ${completed}/${totalPanels}...`, progress);
                
                // Update the specific panel image
                updatePanelImage(index, imageUrl);
                panel.imageUrl = imageUrl;
            } catch (err) {
                console.error(`Error generating panel ${index + 1}:`, err);
                updatePanelError(index, err.message);
                panel.imageUrl = null;
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

async function generateStoryboard(text, style) {
    console.log("📝 Generating storyboard...");
    
    const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    
    // On production (Netlify), use the secure backend serverless function!
    if (!isLocalhost || !GEMINI_API_KEY || GEMINI_API_KEY.includes('ADD_YOUR')) {
        console.log("🌐 Calling secure Netlify function for storyboard...");
        const response = await fetch("/.netlify/functions/generateStoryboard", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ text, style })
        });
        if (!response.ok) {
            const errData = await response.json().catch(() => ({}));
            throw new Error(errData.error || `HTTP ${response.status} failed to generate storyboard`);
        }
        return await response.json();
    }
    
    // Default to 5 panels for the generated layouts
    const panelCount = 5;

    const prompt = `
        Convert the following article into a ${panelCount}-panel comic storyboard.
        For each panel, provide:
        1. "description": A highly descriptive image prompt for an AI image generator. 
           CRITICAL STYLE OVERRIDE: The ENTIRE image (characters, environment, background, objects, lighting) MUST be strictly in the "${style}" style. 
           Do not use realistic, cinematic, or any conflicting styles. Every single visual element must strongly match the "${style}" aesthetic.
           CRITICAL CELEBRITY RULE: Do NOT use real-world celebrity names, specific athletes, or copyrighted public figures in the descriptions, as this triggers the image generator's safety/censorship filters. Instead, describe them generically (e.g., instead of "Cristiano Ronaldo", use "a world-famous athletic Portuguese soccer player wearing a custom kit with number 7"; instead of "LeBron James", use "a towering athletic basketball star in a purple and gold jersey").
        2. "caption": A short, punchy caption for the bottom of the panel.

        Output MUST be in valid JSON format like this:
        {
            "panels": [
                { "description": "...", "caption": "..." }
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
        return data.image;
    }

    // Enhance the prompt with the explicit style to force Nvidia FLUX to respect it
    let enhancedPrompt = prompt;
    if (style && style !== 'custom characters') {
        enhancedPrompt = `A scene entirely in ${style} style. ${prompt}. Everything including background, environment, and characters must strictly be ${style} style. No realistic elements.`;
    }
    
    console.log(`🎨 Generating image for prompt: ${enhancedPrompt.substring(0, 80)}...`);
    
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
                return generateImage(simplifiedPrompt, style, caption, retryCount + 1);
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
            return generateImage(simplifiedPrompt, style, caption, retryCount + 1);
        }
        console.error("❌ Image Generation Error:", error);
        throw error;
    }
}

// Geometry Coordinates Map for Slanted & Circular Comic Panel shapes
const PANEL_SHAPES = {
    'layout-hero-top': [
        '0,0 100,0 100,96 0,100',       // Panel 0 (span 6)
        '0,4 100,0 97,100 0,100',       // Panel 1 (span 4)
        '6,0 100,4 100,100 0,100',      // Panel 2 (span 2)
        '0,0 94,0 100,100 0,100',       // Panel 3 (span 2)
        '3,0 100,0 100,100 0,100'       // Panel 4 (span 4)
    ],
    'layout-action': [
        '0,0 94,0 100,96 0,100',        // Panel 0 (span 2)
        '3,0 100,0 100,100 0,96',       // Panel 1 (span 4)
        '0,4 100,0 100,96 0,100',       // Panel 2 (span 6)
        '0,0 97,4 100,100 0,100',       // Panel 3 (span 4)
        '6,4 100,0 100,100 0,100'       // Panel 4 (span 2)
    ],
    'layout-magazine': [
        '0,0 100,0 97,96 0,100',        // Panel 0 (span 4)
        '6,0 100,0 100,100 0,96',       // Panel 1 (span 2)
        '0,4 94,0 100,96 0,100',        // Panel 2 (span 2)
        '3,0 100,4 100,100 0,96',       // Panel 3 (span 4)
        '0,4 100,0 100,100 0,100'       // Panel 4 (span 6)
    ]
};

function getBorderSVG(layoutClass, index) {
    const shapes = PANEL_SHAPES[layoutClass];
    if (shapes && shapes[index]) {
        const shape = shapes[index];
        return `
            <svg class="panel-border-svg" viewBox="0 0 100 100" preserveAspectRatio="none">
                <polygon points="${shape}" fill="none" stroke="black" stroke-width="8" vector-effect="non-scaling-stroke"></polygon>
            </svg>
        `;
    }
    return `
        <svg class="panel-border-svg" viewBox="0 0 100 100" preserveAspectRatio="none">
            <polygon points="0,0 100,0 100,100 0,100" fill="none" stroke="black" stroke-width="8" vector-effect="non-scaling-stroke"></polygon>
        </svg>
    `;
}

function renderPlaceholders(panels, layoutClass = '') {
    // Reset classes and apply the new layout
    comicGrid.className = 'comic-grid ' + layoutClass;
    comicGrid.innerHTML = '';
    
    panels.forEach((panel, index) => {
        const panelEl = document.createElement('div');
        panelEl.className = `comic-panel loading-state panel-idx-${index}`;
        panelEl.id = `panel-${index}`;
        
        const borderSVG = getBorderSVG(layoutClass, index);
        panelEl.innerHTML = `
            <div class="skeleton-img"></div>
            <div class="panel-caption">${panel.caption}</div>
            ${borderSVG}
        `;
        comicGrid.appendChild(panelEl);
    });
}

// Demo Mode Logic
demoBtn.addEventListener('click', async () => {
    // Default to 5 panels for demo
    const panelCount = 5;
    toggleLoading(true);
    resetUI();
    
    updateStatus("Demo Mode: Generating Layout...", 50);
    
    // Create fake panels
    const fakePanels = Array.from({ length: panelCount }).map((_, i) => ({
        caption: `Demo Panel ${i + 1} - Layout Test`
    }));

    const layoutClass = LAYOUTS[Math.floor(Math.random() * LAYOUTS.length)];
    renderPlaceholders(fakePanels, layoutClass);

    // Simulate image loading
    const totalPanels = fakePanels.length;
    for (let i = 0; i < totalPanels; i++) {
        await new Promise(resolve => setTimeout(resolve, 500)); // 0.5s per image
        const progress = 50 + ((i + 1) / totalPanels) * 50;
        updateStatus(`Demo Mode: Finalizing panel ${i + 1}/${totalPanels}...`, progress);
        
        // Use a random placeholder image
        updatePanelImage(i, `https://picsum.photos/seed/${Math.random()}/800/800`);
    }

    updateStatus("Demo Layout Complete!", 100);
    toggleLoading(false);
});

function updatePanelImage(index, imageUrl) {
    const panelEl = document.getElementById(`panel-${index}`);
    const skeleton = panelEl.querySelector('.skeleton-img');
    const imgSrc = imageUrl.startsWith('http') ? imageUrl : `data:image/png;base64,${imageUrl}`;
    
    const img = document.createElement('img');
    img.src = imgSrc;
    img.onload = () => {
        panelEl.classList.remove('loading-state');
        if (skeleton) skeleton.remove();
        panelEl.insertBefore(img, panelEl.firstChild);
        
        // Springy comic panel entrance
        gsap.fromTo(img, 
            { scale: 1.25, opacity: 0, rotation: index % 2 === 0 ? 3 : -3 },
            { scale: 1, opacity: 1, rotation: 0, duration: 0.65, ease: "back.out(2)" }
        );
    };
}

function updatePanelError(index, errorMessage = "") {
    const panelEl = document.getElementById(`panel-${index}`);
    panelEl.classList.remove('loading-state');
    panelEl.classList.add('error-state');
    
    let displayMessage = "⚠️ Failed to generate";
    if (errorMessage && errorMessage.toLowerCase().includes("policy violation")) {
        displayMessage = "⚠️ Content policy violation";
    }
    
    panelEl.querySelector('.skeleton-img').innerHTML = `<span>${displayMessage}</span>`;
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
    comicGrid.innerHTML = '';
}

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
        simplifiedPrompt = `A scene entirely in ${style || 'anime'} style. ${cleanCaption}. Every detail must strictly match the ${style || 'anime'} style. No realistic elements.`;
    } else if (simplifiedPrompt === prompt) {
        // Fallback if no caption is present and no celebrity names were replaced
        simplifiedPrompt = `A stunning scene in ${style || 'comic'} style. ${prompt.substring(0, 100)}...`;
    }
    return simplifiedPrompt;
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
setupAudioSFX();


