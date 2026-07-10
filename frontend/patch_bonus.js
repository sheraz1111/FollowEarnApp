const fs = require('fs');
let c = fs.readFileSync('app.js', 'utf8');

// Patch: dailyBonus - require login for guest users
const oldBonus = `window.claimDailyBonus = async function(btn) {\r\n`;
const newBonus = `window.claimDailyBonus = async function(btn) {\r\n    // GUEST MODE: require login\r\n    if (!state.user) {\r\n        showToast('Please login or sign up to claim your bonus! \uD83C\uDF81', 'info');\r\n        document.getElementById('userAuthModal').classList.add('active');\r\n        return;\r\n    }\r\n`;

if (c.includes(oldBonus)) {
    c = c.replace(oldBonus, newBonus);
    console.log('dailyBonus patched OK');
    fs.writeFileSync('app.js', c, 'utf8');
} else {
    console.log('dailyBonus target not found - trying alternate...');
    const alt = 'window.claimDailyBonus = async function(btn) {';
    const idx = c.indexOf(alt);
    if (idx !== -1) {
        const insertAfter = idx + alt.length;
        const guestCheck = `\r\n    // GUEST MODE: require login\r\n    if (!state.user) {\r\n        showToast('Please login or sign up to claim your bonus! \uD83C\uDF81', 'info');\r\n        document.getElementById('userAuthModal').classList.add('active');\r\n        return;\r\n    }`;
        c = c.slice(0, insertAfter) + guestCheck + c.slice(insertAfter);
        fs.writeFileSync('app.js', c, 'utf8');
        console.log('dailyBonus patched via alternate OK');
    } else {
        console.log('FAILED completely');
    }
}
