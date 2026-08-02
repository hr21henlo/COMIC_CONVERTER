const fs = require('fs');
const path = require('path');

// Load .env
const envPath = path.join(__dirname, '..', '.env');
const envContent = fs.readFileSync(envPath, 'utf8');
envContent.split('\n').forEach(line => {
    const parts = line.split('=');
    if (parts.length >= 2 && !line.startsWith('#')) {
        const key = parts[0].trim();
        const val = parts.slice(1).join('=').trim();
        process.env[key] = val;
    }
});

const { handler } = require('../netlify/functions/generateImage.cjs');

async function testGenerateFunc() {
    console.log('Testing generateImage serverless handler with .env loaded...');
    console.log(`Loaded NVIDIA_API_KEY: ${process.env.NVIDIA_API_KEY ? process.env.NVIDIA_API_KEY.substring(0, 15) + '...' : 'NONE'}`);

    const event = {
        httpMethod: 'POST',
        body: JSON.stringify({
            prompt: 'a good cow standing in a green meadow with a cat and a crow',
            style: 'Manga style'
        })
    };

    const res = await handler(event, {});
    console.log(`Status code: ${res.statusCode}`);
    const body = JSON.parse(res.body);
    console.log(`Provider: ${body.provider}`);
    console.log(`Fallback: ${body.fallback}`);
    if (body.image) {
        console.log(`Image type: ${body.image.substring(0, 40)}... (length: ${body.image.length})`);
    } else {
        console.log('No image field in response:', body);
    }
}

testGenerateFunc();
