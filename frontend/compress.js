const sharp = require('sharp');
const fs = require('fs');

async function processIcon() {
    console.log('Processing app_icon_512.png...');
    try {
        await sharp('app_icon_512.png')
            .resize(512, 512)
            .png({
                quality: 60,
                compressionLevel: 9,
                palette: true, // This enables pngquant-like quantization which deeply compresses PNGs
                colors: 128
            })
            .toFile('app_icon_final.png');
        
        const stats = fs.statSync('app_icon_final.png');
        console.log(`Success! Final size: ${Math.round(stats.size / 1024)} KB`);
    } catch(e) {
        console.error('Error:', e);
    }
}

processIcon();
