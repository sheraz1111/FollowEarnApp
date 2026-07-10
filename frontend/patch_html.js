const fs = require('fs');
let c = fs.readFileSync('index.html', 'utf8');

// Remove 'active' class from userAuthModal so it doesn't show on load
const old = 'class="admin-login-modal active" id="userAuthModal"';
const neu = 'class="admin-login-modal" id="userAuthModal"';

if (c.includes(old)) {
    c = c.replace(old, neu);
    fs.writeFileSync('index.html', c, 'utf8');
    console.log('SUCCESS: userAuthModal active class removed!');
} else {
    console.log('Not found - checking...');
    const idx = c.indexOf('userAuthModal');
    console.log(c.substring(idx-80, idx+50));
}
