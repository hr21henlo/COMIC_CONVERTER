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

    if (GEMINI_API_KEY.includes('ADD_YOUR') || NVIDIA_API_KEY.includes('ADD_YOUR')) {
        alert("Please set your API keys in the .env file first!");
        return;
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

        const panelPromises = storyboard.panels.map(async (panel, index) => {
            try {
                const imageUrl = await generateImage(panel.description, characterStyle);
                completed++;
                const progress = 20 + (completed / totalPanels) * 80;
                updateStatus(`Artist: Finalizing panel ${completed}/${totalPanels}...`, progress);
                
                // Update the specific panel image
                updatePanelImage(index, imageUrl);
                return { ...panel, imageUrl };
            } catch (err) {
                console.error(`Error generating panel ${index + 1}:`, err);
                updatePanelError(index);
                return { ...panel, imageUrl: null };
            }
        });

        await Promise.all(panelPromises);
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
    // Default to 5 panels for the generated layouts
    const panelCount = 5;

    const prompt = `
        Convert the following article into a ${panelCount}-panel comic storyboard.
        For each panel, provide:
        1. "description": A highly descriptive image prompt for an AI image generator. 
           CRITICAL STYLE OVERRIDE: The ENTIRE image (characters, environment, background, objects, lighting) MUST be strictly in the "${style}" style. 
           Do not use realistic, cinematic, or any conflicting styles. Every single visual element must strongly match the "${style}" aesthetic.
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

async function generateImage(prompt, style, retryCount = 0) {
    // Enhance the prompt with the explicit style to force Nvidia FLUX to respect it
    let enhancedPrompt = prompt;
    if (style && style !== 'custom characters') {
        enhancedPrompt = `A scene entirely in ${style} style. ${prompt}. Everything including background, environment, and characters must strictly be ${style} style. No realistic elements.`;
    }
    
    console.log(`🎨 Generating image for prompt: ${enhancedPrompt.substring(0, 80)}...`);
    
    // NVIDIA NIM API for FLUX.1 (Routed through Vite Proxy to fix CORS)
    const API_URL = "/api/nvidia/v1/genai/black-forest-labs/flux.1-dev"; 
    
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
                "cfg_scale": 5,
                "steps": 30
            }),
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            console.error("❌ Nvidia API Error Details:", errorData);
            
            // Retry logic
            if (retryCount < 1) {
                console.warn(`⚠️ Retrying generation for prompt... (${retryCount + 1}/1)`);
                // Simplify the prompt slightly on retry to avoid potential safety filters
                const simplifiedPrompt = `A simple scene in ${style} style. ${prompt.substring(0, 100)}...`;
                return generateImage(simplifiedPrompt, style, retryCount + 1);
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
        
        throw new Error("Could not find image data in Nvidia response");
    } catch (error) {
        if (retryCount < 1) {
            console.warn(`⚠️ Retrying generation due to fetch error... (${retryCount + 1}/1)`);
            return generateImage(prompt, style, retryCount + 1);
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

function updatePanelError(index) {
    const panelEl = document.getElementById(`panel-${index}`);
    panelEl.classList.remove('loading-state');
    panelEl.classList.add('error-state');
    panelEl.querySelector('.skeleton-img').innerHTML = "<span>⚠️ Failed to generate</span>";
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

