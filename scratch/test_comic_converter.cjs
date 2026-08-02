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

const { handler } = require('../netlify/functions/comic-converter.cjs');

async function testComicConverter() {
    console.log('Testing comic-converter serverless handler with user text...');
    const event = {
        httpMethod: 'POST',
        body: JSON.stringify({
            text: 'good cow with cat and crow',
            style: 'Manga style',
            numCards: 3
        })
    };

    const res = await handler(event, {});
    console.log(`Status code: ${res.statusCode}`);
    const body = JSON.parse(res.body);
    if (res.statusCode === 200) {
        console.log(`✅ Success! Storyboard cards returned: ${body.cards.length}`);
        body.cards.forEach((c, i) => {
            console.log(`Card ${i + 1}: ${c.headline} | ${c.speechBubble.substring(0, 30)}...`);
        });
    } else {
        console.log('❌ Failed with error:', body);
    }
}

testComicConverter();
