import { animate } from "motion";
import html2canvas from "html2canvas";
import { GoogleGenerativeAI } from "@google/generative-ai";

console.log("📚 ComicGen Student Edition initialized...");

// API Keys from Vite env
const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY;
const NVIDIA_API_KEY = import.meta.env.VITE_NVIDIA_API_KEY;

// DOM Elements
const studentTextarea = document.getElementById('studentTextarea');
const studentGenerateBtn = document.getElementById('studentGenerateBtn');
const studentGenerateText = document.getElementById('studentGenerateText');
const studentDemoBtn = document.getElementById('studentDemoBtn');
const studentLoadingPanel = document.getElementById('studentLoadingPanel');
const studentStatusText = document.getElementById('studentStatusText');
const studentOutputSection = document.getElementById('studentOutputSection');
const studentComicCanvas = document.getElementById('studentComicCanvas');
const studentComicTitle = document.getElementById('studentComicTitle');
const studentDownloadBtn = document.getElementById('studentDownloadBtn');
const studentShareBtn = document.getElementById('studentShareBtn');

// Initialize Gemini
let genAI = null;
if (GEMINI_API_KEY && !GEMINI_API_KEY.includes('ADD_YOUR')) {
    genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
}

// ---------------- MOTION.DEV ENTRANCE ANIMATIONS ----------------
function playEntranceAnimations() {
  // Smoothly fade and slide down the welcoming header board
  animate(".welcome-board", 
    { opacity: [0, 1], y: [-25, 0] }, 
    { duration: 0.7, easing: "ease-out" }
  );

  // Smoothly fade and slide up the card catalog input panel
  animate(".student-input-panel", 
    { opacity: [0, 1], y: [30, 0] }, 
    { duration: 0.8, delay: 0.15, easing: "ease-out" }
  );
}

// Play initial page entrance transitions
playEntranceAnimations();


// ---------------- GENERATION CONTROLLERS ----------------

// Generate 3-Panel History Storyboard via Gemini
async function generateStudentComic(text, style) {
    console.log("📝 Generating student comic narrative...");
    
    const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    
    // Serverless production call (Netlify)
    if (!isLocalhost || !GEMINI_API_KEY || GEMINI_API_KEY.includes('ADD_YOUR')) {
        console.log("🌐 Calling secure Netlify function for student comic...");
        const response = await fetch("/.netlify/functions/generateStudentComic", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ text, style })
        });
        if (!response.ok) {
            const errData = await response.json().catch(() => ({}));
            throw new Error(errData.error || `HTTP ${response.status} failed to generate student comic`);
        }
        return await response.json();
    }
    
    if (!genAI) {
        throw new Error("Gemini API key is not configured locally.");
    }
    
    const prompt = `
        You are an elite educational comic-book editor. Convert the following historical/humanities textbook passage into a 3-panel comic strip chronicle designed for students to easily visualize the timeline and core events.
        
        Generate a JSON object containing the following fields:
        1. "title": A dramatic, bold historical title for the entire comic strip.
        2. "panels": An array of exactly 3 panel objects (representing chronological story points: Part I: Narrative, Part II: Climax, Part III: Aftermath).
           Each panel object MUST contain:
           - "caption": A concise, educational narrator description of the event (exactly 1-2 sentences, approximately 20-30 words) styled like a classic comic narrator's text box.
           - "imagePrompt": A highly descriptive, detailed image prompt representing the historical action described in the caption.
             CRITICAL STYLE OVERRIDE: The ENTIRE image (characters, environment, background, objects, lighting) MUST be strictly in the "${style}" style. 
             Do not use realistic, cinematic, or any conflicting styles. Every single visual element must strongly match the "${style}" aesthetic.
             CRITICAL CELEBRITY/HISTORICAL FIGURES RULE: Do NOT use real-world copyrighted public figures or modern celebrity names. Describe historical figures generically (e.g., instead of "Napoleon Bonaparte", use "a short French general in an early 19th-century military uniform with a bicorn hat"; instead of "George Washington", use "a tall American general with powdered hair wearing a blue continental army uniform").
        
        Output MUST be in valid JSON format like this:
        {
            "title": "...",
            "panels": [
                { "caption": "...", "imagePrompt": "..." },
                { "caption": "...", "imagePrompt": "..." },
                { "caption": "...", "imagePrompt": "..." }
            ]
        }

        PASSAGE:
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
            throw lastError || new Error("All tried Gemini fallback models failed.");
        }

        const response = await result.response;
        const textResult = response.text();
        console.log("🤖 Gemini Response:", textResult);
        
        const jsonMatch = textResult.match(/\{[\s\S]*\}/);
        if (!jsonMatch) throw new Error("Could not parse storyboard JSON from Gemini response");
        return JSON.parse(jsonMatch[0]);
    } catch (error) {
        console.error("❌ Student Storyboard Generation Error:", error);
        throw new Error(`Gemini Error: ${error.message || 'Unknown error'}`);
    }
}

// Generate Single Image via Flux (Nvidia API)
async function generateImage(prompt, style, caption = '', retryCount = 0) {
    const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    
    // Serverless production call (Netlify)
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

    const enhancedPrompt = buildNvidiaPrompt(prompt, style);
    
    console.log(`🎨 Generating image for prompt: ${enhancedPrompt.substring(0, 80)}...`);
    
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
            
            if (retryCount < 1) {
                console.warn(`⚠️ Retrying generation in 3s...`);
                await new Promise(resolve => setTimeout(resolve, 3000));
                const simplifiedPrompt = anonymizePrompt(prompt, style, caption);
                return generateImage(simplifiedPrompt, style, caption, retryCount + 1);
            }
            
            const errorMsg = typeof errorData === 'object' ? JSON.stringify(errorData) : errorData.detail;
            throw new Error(`Nvidia API error: ${response.status} - ${errorMsg}`);
        }

        const data = await response.json();
        if (data.image) return data.image;
        if (data.artifacts && data.artifacts[0] && data.artifacts[0].base64) return data.artifacts[0].base64;
        if (data.data && data.data[0] && data.data[0].b64_json) return data.data[0].b64_json;
        
        throw new Error("Unexpected API response structure");
    } catch (error) {
        if (retryCount < 1) {
            console.warn(`⚠️ Retrying generation due to error in 3s...`);
            await new Promise(resolve => setTimeout(resolve, 3000));
            const simplifiedPrompt = anonymizePrompt(prompt, style, caption);
            return generateImage(simplifiedPrompt, style, caption, retryCount + 1);
        }
        console.error("❌ Image Generation Error:", error);
        throw error;
    }
}

// Generate Action Trigger
studentGenerateBtn.addEventListener('click', async () => {
    const passage = studentTextarea.value.trim();
    if (!passage) {
        alert("Please paste your textbook text first!");
        return;
    }

    const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    if (isLocalhost) {
        if (!GEMINI_API_KEY || !NVIDIA_API_KEY || GEMINI_API_KEY.includes('ADD_YOUR') || NVIDIA_API_KEY.includes('ADD_YOUR')) {
            alert("Local development detected: Please set your API keys in the local .env file first!");
            return;
        }
    }

    toggleStudentLoading(true);
    resetStudentUI();

    try {
        const studentStyle = document.querySelector('input[name="studentStyle"]:checked').value;
        
        updateStudentStatus("Deciphering historical text...", 20);
        const storyData = await generateStudentComic(passage, studentStyle);
        
        if (!storyData || !storyData.title || !storyData.panels || storyData.panels.length !== 3) {
            throw new Error("Failed to map the narrative timeline. Please try again.");
        }

        updateStudentStatus("Narrative compiled! Forging layout...", 40);
        studentComicTitle.innerText = storyData.title.toUpperCase();
        
        // Populate captions
        document.getElementById('studentCaption1').innerText = storyData.panels[0].caption;
        document.getElementById('studentCaption2').innerText = storyData.panels[1].caption;
        document.getElementById('studentCaption3').innerText = storyData.panels[2].caption;
        
        // Show skeletons
        for (let i = 1; i <= 3; i++) {
            const container = document.getElementById(`studentImg${i}`);
            container.className = 'student-panel-img-box loading-state';
            container.innerHTML = '<div class="skeleton-img"></div>';
        }

        // Reveal output strip using Motion.dev slide fade
        studentOutputSection.style.display = 'block';
        animate("#studentOutputSection", 
            { opacity: [0, 1], y: [40, 0] }, 
            { duration: 0.8, easing: "ease-out" }
        );

        // Sequence render the 3 panel images
        for (let i = 0; i < 3; i++) {
            updateStudentStatus(`Forging Panel ${i + 1} (${i === 0 ? "Introduction" : i === 1 ? "Climax" : "Resolution"})...`, 50 + i * 15);
            try {
                const imgUrl = await generateImage(storyData.panels[i].imagePrompt, studentStyle, storyData.panels[i].caption);
                updateStudentPanelImage(i + 1, imgUrl);
            } catch (imgErr) {
                console.error(`Panel ${i + 1} failed:`, imgErr);
                updateStudentPanelError(i + 1, imgErr.message);
            }
        }

        updateStudentStatus("Chronicle Successfully Forged!", 100);
        studentGenerateBtn.dataset.success = "true";

    } catch (err) {
        console.error("Student generation failed:", err);
        alert(`Error: ${err.message}`);
    } finally {
        toggleStudentLoading(false);
    }
});

function updateStudentPanelImage(index, imageUrl) {
    const container = document.getElementById(`studentImg${index}`);
    const skeleton = container.querySelector('.skeleton-img');
    const imgSrc = imageUrl.startsWith('http') ? imageUrl : `data:image/png;base64,${imageUrl}`;
    
    const img = document.createElement('img');
    img.src = imgSrc;
    img.onload = () => {
        container.classList.remove('loading-state');
        if (skeleton) skeleton.remove();
        container.innerHTML = '';
        container.appendChild(img);
        
        // Motion.dev scale reveal
        animate(img, 
            { scale: [1.1, 1], opacity: [0, 1] }, 
            { duration: 0.6, easing: "ease-out" }
        );
    };
}

function updateStudentPanelError(index, errorMessage) {
    const container = document.getElementById(`studentImg${index}`);
    container.classList.remove('loading-state');
    container.classList.add('error-state');
    
    let displayMessage = "⚠️ Render Failed";
    if (errorMessage && errorMessage.toLowerCase().includes("policy violation")) {
        displayMessage = "⚠️ Content Policy";
    }
    
    container.innerHTML = `<div class="error-text" style="display: flex; align-items: center; justify-content: center; height: 100%; font-family: 'Special Elite', cursive; font-size: 1rem; color: var(--v-accent); text-align: center; padding: 10px;">${displayMessage}</div>`;
}

function toggleStudentLoading(isLoading) {
    studentGenerateBtn.disabled = isLoading;
    const btnText = document.getElementById('studentGenerateText');
    if (isLoading) {
        btnText.innerText = 'FORGING...';
        studentGenerateBtn.dataset.success = "false";
        
        studentLoadingPanel.style.display = 'block';
        animate("#studentLoadingPanel", 
            { opacity: [0, 1], scale: [0.95, 1] }, 
            { duration: 0.4, easing: "ease-out" }
        );
    } else {
        btnText.innerText = studentGenerateBtn.dataset.success === "true" ? 'FORGED!' : 'FORGE!';
        studentLoadingPanel.style.display = 'none';
    }
}

function updateStudentStatus(text, progress) {
    studentStatusText.innerText = text;
}

function resetStudentUI() {
    studentComicTitle.innerText = "THE HISTORICAL CHRONICLE";
    for (let i = 1; i <= 3; i++) {
        const img = document.getElementById(`studentImg${i}`);
        img.innerHTML = '';
        img.className = 'student-panel-img-box';
        document.getElementById(`studentCaption${i}`).innerText = `NARRATIVE PORTION ${i}...`;
    }
    studentOutputSection.style.display = 'none';
}

// Student Demo Mode Handler
studentDemoBtn.addEventListener('click', async () => {
    toggleStudentLoading(true);
    resetStudentUI();
    
    updateStudentStatus("Demo Mode: Scanning academic references...", 25);
    await new Promise(resolve => setTimeout(resolve, 1200));

    studentComicTitle.innerText = "THE STORMING OF THE BASTILLE";
    
    const fakeCaptions = [
        "PARIS, JULY 14, 1789: ANGRY CITIZENS ASSEMBLE OUTSIDE THE BASTILLE FORTRESS, DEMANDING GUNPOWDER AND AN END TO THE KING'S TYRANNY!",
        "THE CHAOTIC CLIMAX: REVOLUTIONARIES BREACH THE GATES, COLLIDING WITH THE GUARD FORCES IN A FIERCE AND HISTORIC FIRE RUN!",
        "THE REVOLUTION TRIUMPHANT: THE PRISON IS CAPTURED, MARKING THE INITIATION OF THE FRENCH REVOLUTION AND THE COLLAPSE OF ROYAL POWER!"
    ];

    for (let i = 1; i <= 3; i++) {
        document.getElementById(`studentCaption${i}`).innerText = fakeCaptions[i - 1];
        const container = document.getElementById(`studentImg${i}`);
        container.className = 'student-panel-img-box loading-state';
        container.innerHTML = '<div class="skeleton-img"></div>';
    }

    studentOutputSection.style.display = 'block';
    animate("#studentOutputSection", 
        { opacity: [0, 1], y: [40, 0] }, 
        { duration: 0.8, easing: "ease-out" }
    );
    
    // Simulate sequential loading of images
    for (let i = 1; i <= 3; i++) {
        updateStudentStatus(`Demo Mode: Finalizing Panel ${i} details...`, 40 + i * 20);
        await new Promise(resolve => setTimeout(resolve, 800));
        const demoImgUrl = `https://picsum.photos/seed/student_${i}_${Math.random()}/800/800`;
        updateStudentPanelImage(i, demoImgUrl);
    }

    updateStudentStatus("Demo Chronicle complete!", 100);
    toggleStudentLoading(false);
});

// Student Download Action
studentDownloadBtn.addEventListener('click', async () => {
    if (studentDownloadBtn.disabled) return;
    const originalText = studentDownloadBtn.innerText;
    studentDownloadBtn.innerText = "PREPARING STRIP...";
    studentDownloadBtn.disabled = true;

    try {
        await document.fonts.ready;
        const canvas = await html2canvas(studentComicCanvas, {
            useCORS: true,
            scale: 2,
            backgroundColor: '#ffffff',
            logging: false
        });
        const dataUrl = canvas.toDataURL('image/png');
        const link = document.createElement('a');
        link.href = dataUrl;
        link.download = `ComicGen_StudentChronicle_${Date.now()}.png`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    } catch (err) {
        console.error("Student download failed:", err);
        alert("Failed to download the chronicle.");
    } finally {
        studentDownloadBtn.innerText = originalText;
        studentDownloadBtn.disabled = false;
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

// Student Share Action
studentShareBtn.addEventListener('click', async () => {
    if (studentShareBtn.disabled) return;
    const originalText = studentShareBtn.innerText;
    studentShareBtn.innerText = "PREPARING...";
    studentShareBtn.disabled = true;

    try {
        await document.fonts.ready;
        const canvas = await html2canvas(studentComicCanvas, {
            useCORS: true,
            scale: 2,
            backgroundColor: '#ffffff',
            logging: false
        });
        
        const blob = await getBlobFromCanvas(canvas);
        if (!blob) throw new Error("Failed to generate canvas image blob");
        
        const file = new File([blob], `ComicGen_StudentChronicle_${Date.now()}.png`, { type: 'image/png' });
        
        if (navigator.canShare && navigator.canShare({ files: [file] })) {
            await navigator.share({
                files: [file],
                title: 'My ComicGen Historical Chronicle',
                text: 'Check out this awesome AI generated history comic strip!'
            });
        } else {
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
            alert("Failed to share chronicle: " + err.message);
        }
    } finally {
        studentShareBtn.innerText = originalText;
        studentShareBtn.disabled = false;
    }
});

// Prompt helper utilities
function buildNvidiaPrompt(prompt, style) {
    const stylePrefix = style && style !== 'custom characters' ? `Style: ${style}. ` : '';
    const styleSuffix = style && style !== 'custom characters' ? ' Keep it fully stylized.' : '';
    return `${stylePrefix}${prompt}${styleSuffix}`.trim();
}

function anonymizePrompt(prompt, style, caption = '') {
    let simplifiedPrompt = prompt;
    const replacements = [
        { regex: /napoleon bonaparte/gi, replacement: "a short French general in early 19th-century military uniform with a bicorn hat" },
        { regex: /napoleon/gi, replacement: "a French general" },
        { regex: /george washington/gi, replacement: "a tall American general with powdered hair wearing a blue continental army uniform" },
        { regex: /washington/gi, replacement: "an American general" },
        { regex: /elon musk/gi, replacement: "a wealthy tech entrepreneur" }
    ];
    for (const r of replacements) {
        simplifiedPrompt = simplifiedPrompt.replace(r.regex, r.replacement);
    }
    if (caption) {
        simplifiedPrompt = `A scene entirely in ${style || 'comic'} style. ${caption.substring(0, 150)}. No realistic elements.`;
    }
    return simplifiedPrompt;
}
