const fs = require('fs');

const file = 'app.js';
let content = fs.readFileSync(file, 'utf8');

const oldCode = `        } catch (e) {
            localStorage.removeItem('token');
            document.getElementById('userAuthModal').classList.add('active');
        }
    } else {
        document.getElementById('userAuthModal').classList.add('active');
    }`;

const newCode = `        } catch (e) {
            localStorage.removeItem('token');
            // GUEST MODE: Show home page instead of forcing login
            loadMonetagAds();
            document.getElementById('mainHeader').classList.remove('hidden');
            if (document.getElementById('honestyBanner')) document.getElementById('honestyBanner').classList.remove('hidden');
            document.getElementById('bottomNav').classList.remove('hidden');
            showPage('home');
        }
    } else {
        // GUEST MODE: No token - show home page with ads, login required only on action
        loadMonetagAds();
        document.getElementById('mainHeader').classList.remove('hidden');
        if (document.getElementById('honestyBanner')) document.getElementById('honestyBanner').classList.remove('hidden');
        document.getElementById('bottomNav').classList.remove('hidden');
        showPage('home');
    }`;

if (content.includes(oldCode)) {
    content = content.replace(oldCode, newCode);
    fs.writeFileSync(file, content, 'utf8');
    console.log('SUCCESS: Guest mode applied!');
} else {
    console.log('ERROR: Target string not found. Check line endings.');
    // Try CRLF version
    const oldCodeCRLF = oldCode.replace(/\n/g, '\r\n');
    const newCodeCRLF = newCode.replace(/\n/g, '\r\n');
    if (content.includes(oldCodeCRLF)) {
        content = content.replace(oldCodeCRLF, newCodeCRLF);
        fs.writeFileSync(file, content, 'utf8');
        console.log('SUCCESS (CRLF): Guest mode applied!');
    } else {
        console.log('FAILED: Cannot find target in file.');
    }
}
