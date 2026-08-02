const fetch = require('node-fetch');

const apiKey = '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';

async function testNvidia() {
    const endpoints = [
        {
            url: 'https://ai.api.nvidia.com/v1/genai/black-forest-labs/flux-1-dev',
            body: { prompt: 'a cute anime cat in manga style' }
        },
        {
            url: 'https://ai.api.nvidia.com/v1/genai/black-forest-labs/flux.2-klein-4b',
            body: { prompt: 'a cute anime cat in manga style' }
        },
        {
            url: 'https://ai.api.nvidia.com/v1/genai/stabilityai/stable-diffusion-3-medium',
            body: { prompt: 'a cute anime cat in manga style' }
        },
        {
            url: 'https://ai.api.nvidia.com/v1/genai/stabilityai/sdxl-turbo',
            body: { prompt: 'a cute anime cat in manga style' }
        }
    ];

    for (const ep of endpoints) {
        console.log(`\nTesting ${ep.url}...`);
        try {
            const res = await fetch(ep.url, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                body: JSON.stringify(ep.body)
            });

            console.log(`Status: ${res.status} ${res.statusText}`);
            const text = await res.text();
            console.log(`Response snippet: ${text.substring(0, 300)}`);
        } catch (err) {
            console.error(`Error: ${err.message}`);
        }
    }
}

testNvidia();
