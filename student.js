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
const studentScrollIndicator = document.getElementById('studentScrollIndicator');
const studentScrollBtn = document.getElementById('studentScrollBtn');

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

  // Continuous bouncing cute down arrow animation
  if (studentScrollBtn) {
    animate(".btn-scroll-down svg", 
      { y: [0, 5, 0] }, 
      { duration: 1.2, repeat: Infinity, easing: "ease-in-out" }
    );
  }
}

// Play initial page entrance transitions
playEntranceAnimations();

// Scroll down to active indicator panel smoothly
if (studentScrollBtn) {
    studentScrollBtn.addEventListener('click', () => {
        const target = studentLoadingPanel.style.display !== 'none'
            ? studentLoadingPanel
            : studentOutputSection;
        if (target) {
            target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    });
}


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
             - CRITICAL TEXT-FREE SAFETY GUARD: The image prompt must NOT contain or request any words, letters, text, numbers, symbols that look like letters, speech bubbles, talk bubbles, or character dialogue. Explicitly describe a pure visual composition without any text labels or lettering of any kind in the scene.
             - CRITICAL STYLE OVERRIDE: The ENTIRE image (characters, environment, background, objects, lighting) MUST be strictly in the "${style}" style. 
               Do not use realistic, cinematic, or any conflicting styles. Every single visual element must strongly match the "${style}" aesthetic.
             - CRITICAL CELEBRITY/HISTORICAL FIGURES RULE: Do NOT use real-world copyrighted public figures or modern celebrity names. Describe historical figures generically (e.g., instead of "Napoleon Bonaparte", use "a short French general in an early 19th-century military uniform with a bicorn hat"; instead of "George Washington", use "a tall American general with powdered hair wearing a blue continental army uniform").
        
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
        if (data.fallback) {
            console.error(`⚠️ NVIDIA FLUX API call fell back to SVG: ${data.error}`);
        }
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
    playSketchingSound(); // Start sketching sound loop

    if (studentScrollIndicator) {
        studentScrollIndicator.style.display = 'flex';
        animate("#studentScrollIndicator", 
            { opacity: [0, 1], y: [15, 0] }, 
            { duration: 0.5, easing: "ease-out" }
        );
    }

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
        typewriterSFX.playPageTurn(); // Page turn flip sound
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
        typewriterSFX.playStamp(); // Ink stamp press thud sound

    } catch (err) {
        console.error("Student generation failed:", err);
        alert(`Error: ${err.message}`);
    } finally {
        stopSketchingSound(); // Stop sketching sound loop
        toggleStudentLoading(false);
    }
});

function updateStudentPanelImage(index, imageUrl) {
    const container = document.getElementById(`studentImg${index}`);
    const skeleton = container.querySelector('.skeleton-img');
    const imgSrc = (imageUrl.startsWith('http') || imageUrl.startsWith('data:')) ? imageUrl : `data:image/png;base64,${imageUrl}`;
    
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
    if (studentScrollIndicator) {
        studentScrollIndicator.style.display = 'none';
    }
}

// Student Demo Mode Handler
studentDemoBtn.addEventListener('click', async () => {
    toggleStudentLoading(true);
    resetStudentUI();
    playSketchingSound(); // Start sketching sound loop
    
    if (studentScrollIndicator) {
        studentScrollIndicator.style.display = 'flex';
        animate("#studentScrollIndicator", 
            { opacity: [0, 1], y: [15, 0] }, 
            { duration: 0.5, easing: "ease-out" }
        );
    }
    
    try {
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
        typewriterSFX.playPageTurn(); // Page turn flip sound
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
        typewriterSFX.playStamp(); // Ink stamp press thud sound
    } finally {
        stopSketchingSound(); // Stop sketching sound loop
        toggleStudentLoading(false);
    }
});

studentDownloadBtn.addEventListener('click', async () => {
    if (studentDownloadBtn.disabled) return;
    const originalText = studentDownloadBtn.innerText;
    studentDownloadBtn.innerText = "PREPARING STUDY CARDS...";
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
        link.download = `ComicGen_StudentStudyCards_${Date.now()}.png`;
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
    const styleSuffix = style && style !== 'custom characters' ? ' Keep it fully stylized. Wordless, no text, no letters, no speech bubbles, no dialogue, no labels.' : ' Wordless, no text, no letters, no speech bubbles, no dialogue, no labels.';
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
        simplifiedPrompt = `A scene entirely in ${style || 'comic'} style. ${caption.substring(0, 150)}. No realistic elements. Completely wordless, no text, no letters, no speech bubbles, no dialogue, no labels.`;
    } else {
        simplifiedPrompt = `${simplifiedPrompt}. Completely wordless, no text, no letters, no speech bubbles, no dialogue, no labels.`;
    }
    return simplifiedPrompt;
}

// --- WEB AUDIO API SCHOLARLY SOUND EFFECTS (TYPEWRITER & PAPER RUSTLE) ---
const typewriterSFX = {
    ctx: null,
    userMuted: false, // track manual mute state
    init: () => {
        if (!typewriterSFX.ctx) {
            typewriterSFX.ctx = new (window.AudioContext || window.webkitAudioContext)();
        }
        if (typewriterSFX.ctx.state === 'suspended' && !typewriterSFX.userMuted) {
            typewriterSFX.ctx.resume();
        }
    },
    playKey: (isSpace = false) => {
        try {
            if (typewriterSFX.userMuted) return;
            typewriterSFX.init();
            const now = typewriterSFX.ctx.currentTime;
            const duration = isSpace ? 0.08 : 0.12 + Math.random() * 0.04;
            
            // Create noise buffer for pencil scratching
            const bufferSize = typewriterSFX.ctx.sampleRate * duration;
            const buffer = typewriterSFX.ctx.createBuffer(1, bufferSize, typewriterSFX.ctx.sampleRate);
            const data = buffer.getChannelData(0);
            
            // Rhythmic amplitude modulation to mimic writing strokes
            const strokeFrequency = 22 + Math.random() * 8; 
            for (let i = 0; i < bufferSize; i++) {
                const t = i / typewriterSFX.ctx.sampleRate;
                const white = Math.random() * 2 - 1;
                const am = 0.45 + 0.55 * Math.sin(2 * Math.PI * strokeFrequency * t);
                data[i] = white * am;
            }
            
            const noise = typewriterSFX.ctx.createBufferSource();
            noise.buffer = buffer;
            
            const filter = typewriterSFX.ctx.createBiquadFilter();
            filter.type = 'bandpass';
            const centerFreq = (isSpace ? 1400 : 1900) + Math.random() * 700;
            filter.frequency.setValueAtTime(centerFreq, now);
            filter.frequency.exponentialRampToValueAtTime(centerFreq * 0.75, now + duration);
            filter.Q.setValueAtTime(3.2, now);
            
            const gain = typewriterSFX.ctx.createGain();
            gain.gain.setValueAtTime(0, now);
            gain.gain.linearRampToValueAtTime(isSpace ? 0.08 : 0.26, now + 0.01);
            gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
            
            noise.connect(filter);
            filter.connect(gain);
            gain.connect(typewriterSFX.ctx.destination);
            
            noise.start(now);
            noise.stop(now + duration);
        } catch (e) {}
    },
    playReturn: () => {
        // Keeps the classic vintage desk bell ding for completion/forge clicks!
        try {
            if (typewriterSFX.userMuted) return;
            typewriterSFX.init();
            const now = typewriterSFX.ctx.currentTime;
            
            const osc1 = typewriterSFX.ctx.createOscillator();
            const osc2 = typewriterSFX.ctx.createOscillator();
            const gain = typewriterSFX.ctx.createGain();
            
            osc1.type = 'sine';
            osc1.frequency.setValueAtTime(2100, now);
            
            osc2.type = 'sine';
            osc2.frequency.setValueAtTime(2625, now);
            
            gain.gain.setValueAtTime(0.20, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
            
            osc1.connect(gain);
            osc2.connect(gain);
            gain.connect(typewriterSFX.ctx.destination);
            
            osc1.start(now);
            osc2.start(now);
            osc1.stop(now + 0.3);
            osc2.stop(now + 0.3);
        } catch (e) {}
    },
    playRustle: () => {
        try {
            if (typewriterSFX.userMuted) return;
            typewriterSFX.init();
            const now = typewriterSFX.ctx.currentTime;
            
            const bufferSize = typewriterSFX.ctx.sampleRate * 0.09;
            const buffer = typewriterSFX.ctx.createBuffer(1, bufferSize, typewriterSFX.ctx.sampleRate);
            const data = buffer.getChannelData(0);
            for (let i = 0; i < bufferSize; i++) {
                data[i] = Math.random() * 2 - 1;
            }
            const noise = typewriterSFX.ctx.createBufferSource();
            noise.buffer = buffer;
            
            const filter = typewriterSFX.ctx.createBiquadFilter();
            filter.type = 'bandpass';
            filter.frequency.setValueAtTime(1400, now);
            filter.Q.setValueAtTime(2.5, now);
            
            const gain = typewriterSFX.ctx.createGain();
            gain.gain.setValueAtTime(0.18, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.09);
            
            noise.connect(filter);
            filter.connect(gain);
            gain.connect(typewriterSFX.ctx.destination);
            
            noise.start(now);
            noise.stop(now + 0.09);
        } catch (e) {}
    },
    playStamp: () => {
        try {
            if (typewriterSFX.userMuted) return;
            typewriterSFX.init();
            const now = typewriterSFX.ctx.currentTime;
            
            // 1. Heavy low-frequency rubber thud
            const osc = typewriterSFX.ctx.createOscillator();
            const gainOsc = typewriterSFX.ctx.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(120, now);
            osc.frequency.exponentialRampToValueAtTime(18, now + 0.16);
            
            gainOsc.gain.setValueAtTime(0.38, now);
            gainOsc.gain.exponentialRampToValueAtTime(0.001, now + 0.16);
            
            osc.connect(gainOsc);
            gainOsc.connect(typewriterSFX.ctx.destination);
            
            // 2. High-frequency wood body impact click
            const clickOsc = typewriterSFX.ctx.createOscillator();
            const clickGain = typewriterSFX.ctx.createGain();
            clickOsc.type = 'triangle';
            clickOsc.frequency.setValueAtTime(1100, now);
            clickOsc.frequency.exponentialRampToValueAtTime(350, now + 0.035);
            
            clickGain.gain.setValueAtTime(0.20, now);
            clickGain.gain.exponentialRampToValueAtTime(0.001, now + 0.035);
            
            clickOsc.connect(clickGain);
            clickGain.connect(typewriterSFX.ctx.destination);
            
            osc.start(now);
            clickOsc.start(now);
            osc.stop(now + 0.16);
            clickOsc.stop(now + 0.035);
        } catch (e) {}
    },
    playPageTurn: () => {
        try {
            if (typewriterSFX.userMuted) return;
            typewriterSFX.init();
            const now = typewriterSFX.ctx.currentTime;
            const duration = 0.48;
            
            const bufferSize = typewriterSFX.ctx.sampleRate * duration;
            const buffer = typewriterSFX.ctx.createBuffer(1, bufferSize, typewriterSFX.ctx.sampleRate);
            const data = buffer.getChannelData(0);
            
            for (let i = 0; i < bufferSize; i++) {
                const t = i / typewriterSFX.ctx.sampleRate;
                const white = Math.random() * 2 - 1;
                const envelope = Math.sin(Math.PI * t / duration);
                const flutter = 0.55 + 0.45 * Math.sin(2 * Math.PI * 7.5 * t);
                data[i] = white * envelope * flutter * 0.075;
            }
            
            const source = typewriterSFX.ctx.createBufferSource();
            source.buffer = buffer;
            
            const filter = typewriterSFX.ctx.createBiquadFilter();
            filter.type = 'bandpass';
            filter.frequency.setValueAtTime(550, now);
            filter.frequency.exponentialRampToValueAtTime(1700, now + duration * 0.55);
            filter.frequency.exponentialRampToValueAtTime(750, now + duration);
            filter.Q.setValueAtTime(1.6, now);
            
            const gain = typewriterSFX.ctx.createGain();
            gain.gain.setValueAtTime(0, now);
            gain.gain.linearRampToValueAtTime(0.45, now + 0.09);
            gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
            
            source.connect(filter);
            filter.connect(gain);
            gain.connect(typewriterSFX.ctx.destination);
            
            source.start(now);
            source.stop(now + duration);
        } catch (e) {}
    }
};

let sketchingInterval = null;
function playSketchingSound() {
    if (typewriterSFX.userMuted) return;
    if (sketchingInterval) return;
    typewriterSFX.init();
    const ctx = typewriterSFX.ctx;
    
    const playStroke = () => {
        try {
            if (typewriterSFX.userMuted) return;
            const now = ctx.currentTime;
            const duration = 0.15 + Math.random() * 0.15;
            
            const bufferSize = ctx.sampleRate * duration;
            const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
            const data = buffer.getChannelData(0);
            
            const strokeFreq = 14 + Math.random() * 6;
            for (let i = 0; i < bufferSize; i++) {
                const t = i / ctx.sampleRate;
                const noiseVal = Math.random() * 2 - 1;
                const am = 0.45 + 0.55 * Math.sin(2 * Math.PI * strokeFreq * t);
                data[i] = noiseVal * am;
            }
            
            const source = ctx.createBufferSource();
            source.buffer = buffer;
            
            const filter = ctx.createBiquadFilter();
            filter.type = 'bandpass';
            const startFreq = 1700 + Math.random() * 400;
            const endFreq = 1200 + Math.random() * 300;
            filter.frequency.setValueAtTime(startFreq, now);
            filter.frequency.exponentialRampToValueAtTime(endFreq, now + duration);
            filter.Q.setValueAtTime(2.6, now);
            
            const gain = ctx.createGain();
            gain.gain.setValueAtTime(0, now);
            gain.gain.linearRampToValueAtTime(0.08, now + 0.03);
            gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
            
            source.connect(filter);
            filter.connect(gain);
            gain.connect(ctx.destination);
            
            source.start(now);
            source.stop(now + duration);
        } catch (e) {}
    };
    
    sketchingInterval = setInterval(() => {
        if (Math.random() > 0.18) {
            playStroke();
        }
    }, 160);
}

function stopSketchingSound() {
    if (sketchingInterval) {
        clearInterval(sketchingInterval);
        sketchingInterval = null;
    }
}

// Bind keyboard sounds
const textInput = document.getElementById('studentTextarea');
if (textInput) {
    textInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            typewriterSFX.playReturn();
        } else if (e.key === ' ' || e.key === 'Spacebar') {
            typewriterSFX.playKey(true);
        } else if (e.key.length === 1) {
            typewriterSFX.playKey(false);
        }
    });
}

// Bind hover and click sounds for scholastic elements
let vinylNode = null;
let ambientMusicInterval = null;
let ambientMusicStep = 0;
let ambientMusicPlaying = false;

const playAmbientMusic = () => {
    if (typewriterSFX.userMuted) return;
    if (ambientMusicPlaying) return;
    typewriterSFX.init();
    ambientMusicPlaying = true;
    const ctx = typewriterSFX.ctx;
    
    // 1. Continuous vinyl record dust noise
    try {
        const bufferSize = ctx.sampleRate * 2;
        const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
        const data = buffer.getChannelData(0);
        
        let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
        for (let i = 0; i < bufferSize; i++) {
            const white = Math.random() * 2 - 1;
            b0 = 0.99886 * b0 + white * 0.0555179;
            b1 = 0.99332 * b1 + white * 0.0750759;
            b2 = 0.96900 * b2 + white * 0.1538520;
            b3 = 0.86650 * b3 + white * 0.3104856;
            b4 = 0.55000 * b4 + white * 0.5329522;
            b5 = -0.7616 * b5 - white * 0.0168980;
            const pink = b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362;
            b6 = white * 0.115926;
            
            let pop = 0;
            if (Math.random() > 0.9997) {
                pop = (Math.random() * 2 - 1) * 0.45;
            }
            
            data[i] = (pink * 0.05 + pop) * 0.02;
        }
        
        const noiseNode = ctx.createBufferSource();
        noiseNode.buffer = buffer;
        noiseNode.loop = true;
        
        const filter = ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(3200, ctx.currentTime);
        
        const gainNode = ctx.createGain();
        gainNode.gain.setValueAtTime(0.02, ctx.currentTime);
        
        noiseNode.connect(filter);
        filter.connect(gainNode);
        gainNode.connect(ctx.destination);
        noiseNode.start(0);
        vinylNode = noiseNode;
    } catch (e) {
        console.warn("Vinyl crackle failed", e);
    }
    
    // 2. Antique scholarly minor theme loop
    const bpm = 75;
    const stepTime = 60 / bpm;
    
    const melody = [
        392.00, 311.13, 349.23, 261.63, 293.66, 311.13, 392.00, 0,
        349.23, 293.66, 311.13, 233.08, 261.63, 293.66, 349.23, 0,
        392.00, 466.16, 440.00, 349.23, 392.00, 311.13, 261.63, 0,
        293.66, 349.23, 311.13, 261.63, 196.00, 293.66, 261.63, 0
    ];
    
    const harmony = [
        130.81, 0, 174.61, 0, 146.83, 0, 130.81, 0,
        116.54, 0, 130.81, 0, 146.83, 0, 116.54, 0,
        130.81, 0, 174.61, 0, 130.81, 0, 98.00, 0,
        146.83, 0, 130.81, 0, 98.00, 0, 130.81, 0
    ];
    
    let nextNoteTime = ctx.currentTime;
    
    function scheduler() {
        while (nextNoteTime < ctx.currentTime + 0.1) {
            const time = nextNoteTime;
            const step = ambientMusicStep % melody.length;
            
            const melFreq = melody[step];
            if (melFreq > 0) {
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();
                osc.type = 'sine';
                osc.frequency.setValueAtTime(melFreq, time);
                
                const subOsc = ctx.createOscillator();
                subOsc.type = 'triangle';
                subOsc.frequency.setValueAtTime(melFreq * 0.5, time);
                
                // Vintage Tape Warble Vibrato (LFO)
                const lfo = ctx.createOscillator();
                lfo.frequency.setValueAtTime(4.2 + Math.random() * 0.8, time); // Speed of speed wobble
                const lfoGain = ctx.createGain();
                lfoGain.gain.setValueAtTime(1.5 + Math.random() * 0.8, time); // Pitch sweep depth
                
                lfo.connect(lfoGain);
                lfoGain.connect(osc.frequency);
                lfoGain.connect(subOsc.frequency);
                
                const filter = ctx.createBiquadFilter();
                filter.type = 'lowpass';
                filter.frequency.setValueAtTime(800, time);
                
                gain.gain.setValueAtTime(0, time);
                gain.gain.linearRampToValueAtTime(0.008, time + 0.03);
                gain.gain.exponentialRampToValueAtTime(0.0001, time + 1.2);
                
                osc.connect(filter);
                subOsc.connect(filter);
                filter.connect(gain);
                gain.connect(ctx.destination);
                
                lfo.start(time);
                osc.start(time);
                subOsc.start(time);
                
                lfo.stop(time + 1.25);
                osc.stop(time + 1.25);
                subOsc.stop(time + 1.25);
            }
            
            const bassFreq = harmony[step];
            if (bassFreq > 0) {
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();
                osc.type = 'sine';
                osc.frequency.setValueAtTime(bassFreq, time);
                
                // Vintage Tape Warble for Bass (slower LFO)
                const lfo = ctx.createOscillator();
                lfo.frequency.setValueAtTime(3.5, time);
                const lfoGain = ctx.createGain();
                lfoGain.gain.setValueAtTime(0.6, time);
                
                lfo.connect(lfoGain);
                lfoGain.connect(osc.frequency);
                
                gain.gain.setValueAtTime(0, time);
                gain.gain.linearRampToValueAtTime(0.010, time + 0.05);
                gain.gain.exponentialRampToValueAtTime(0.0001, time + 1.8);
                
                osc.connect(gain);
                gain.connect(ctx.destination);
                
                lfo.start(time);
                osc.start(time);
                lfo.stop(time + 1.85);
                osc.stop(time + 1.85);
            }
            
            nextNoteTime += stepTime;
            ambientMusicStep++;
        }
    }
    
    ambientMusicInterval = setInterval(scheduler, 50);
};

function setupStudentAudio() {
    const audioToggle = document.getElementById('studentAudioToggle');

    // 1. Initial background gesture activator
    const initAudioOnGesture = () => {
        if (typewriterSFX.userMuted) return;
        typewriterSFX.init();
        if (typewriterSFX.ctx) {
            playAmbientMusic();
            if (audioToggle) {
                audioToggle.innerText = "🔊 AUDIO ON";
                audioToggle.classList.add('playing');
            }
        }
        ['click', 'keydown', 'mousedown', 'touchstart'].forEach(evt => {
            document.removeEventListener(evt, initAudioOnGesture);
        });
    };
    
    // Bind global gesture events
    ['click', 'keydown', 'mousedown', 'touchstart'].forEach(evt => {
        document.addEventListener(evt, initAudioOnGesture);
    });

    // Explicit audio toggle button listener in the header bar
    if (audioToggle) {
        audioToggle.addEventListener('click', (e) => {
            e.stopPropagation(); // Prevent triggering initAudioOnGesture twice
            typewriterSFX.init();
            const ctx = typewriterSFX.ctx;
            if (ctx) {
                typewriterSFX.userMuted = !typewriterSFX.userMuted;
                if (typewriterSFX.userMuted) {
                    ctx.suspend();
                    if (ambientMusicInterval) {
                        clearInterval(ambientMusicInterval);
                        ambientMusicInterval = null;
                    }
                    if (vinylNode) {
                        try { vinylNode.stop(); } catch(err){}
                        vinylNode = null;
                    }
                    ambientMusicPlaying = false;
                    audioToggle.innerText = "🔈 AUDIO MUTED";
                    audioToggle.classList.remove('playing');
                } else {
                    ctx.resume();
                    playAmbientMusic();
                    audioToggle.innerText = "🔊 AUDIO ON";
                    audioToggle.classList.add('playing');
                }
            }
        });
    }

    const hoverSelectors = [
        'button',
        '.style-card',
        '.btn-back',
        '.btn-scroll-down',
        '.graded-stamp'
    ];

    document.addEventListener('mouseover', (e) => {
        if (typewriterSFX.userMuted) return;
        for (const selector of hoverSelectors) {
            const el = e.target.closest(selector);
            if (el) {
                if (!el.dataset.sfxHovered) {
                    el.dataset.sfxHovered = "true";
                    if (selector === '.graded-stamp') {
                        typewriterSFX.playStamp();
                    } else {
                        typewriterSFX.playRustle();
                    }
                    setTimeout(() => { delete el.dataset.sfxHovered; }, 280);
                }
                break;
            }
        }
    });

    document.addEventListener('click', (e) => {
        if (typewriterSFX.userMuted) return;
        const target = e.target.closest('button, .style-card, .btn-back, .btn-scroll-down, .graded-stamp');
        if (target) {
            if (target.id === 'studentGenerateBtn' || target.closest('.generate-btn-wrapper')) {
                typewriterSFX.playReturn();
            } else if (target.classList.contains('graded-stamp')) {
                typewriterSFX.playStamp();
            } else {
                typewriterSFX.playKey(false);
            }
        }
    });
}

// Initialize audio listeners
setupStudentAudio();
