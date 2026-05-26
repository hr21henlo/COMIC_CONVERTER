// Note: We are using the CDN version of Gemini for zero-config setup
// In index.html: <script type="importmap">...</script>
import { GoogleGenerativeAI } from "@google/generative-ai";

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

function renderPlaceholders(panels, layoutClass = '') {
    // Reset classes and apply the new layout
    comicGrid.className = 'comic-grid ' + layoutClass;
    comicGrid.innerHTML = '';
    
    panels.forEach((panel, index) => {
        const panelEl = document.createElement('div');
        panelEl.className = 'comic-panel loading-state';
        panelEl.id = `panel-${index}`;
        panelEl.innerHTML = `
            <div class="skeleton-img"></div>
            <div class="panel-caption">${panel.caption}</div>
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
        });

        updateDeckPositions(filtered);
    }

    // Assign positions based on selected card to generate fanning arc
    function updateDeckPositions(filtered) {
        const N = filtered.length;
        if (N === 0) return;

        const cards = newsFanDeck.querySelectorAll('.news-card-fan');
        cards.forEach((card) => {
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
    }
}


