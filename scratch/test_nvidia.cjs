const apiKey = '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';

async function testCleanNvidia() {
    const url = 'https://ai.api.nvidia.com/v1/genai/black-forest-labs/flux.2-klein-4b';
    const prompt = '2D Japanese anime artwork, manga comic page, clean anime linework, Studio Ghibli anime aesthetic, a cute black cat sitting in a meadow, crisp linework, single main subject, no text';
    
    console.log('Sending clean prompt to NVIDIA FLUX...');
    const start = Date.now();
    const res = await fetch(url, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
            'Accept': 'application/json'
        },
        body: JSON.stringify({ prompt })
    });

    console.log(`Status: ${res.status} ${res.statusText} in ${Date.now() - start}ms`);
    const data = await res.json();
    console.log(`Success! Image artifacts received: ${data.artifacts ? data.artifacts.length : 0}`);
    if (data.artifacts && data.artifacts[0]) {
        console.log(`Base64 image length: ${data.artifacts[0].base64.length} chars`);
    }
}

testCleanNvidia();
