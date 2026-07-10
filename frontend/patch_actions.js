const fs = require('fs');
let c = fs.readFileSync('app.js', 'utf8');

// Patch 1: openTask - require login
const oldTask = `window.openTask = async function(taskId, taskUrl, type) {\r\n    state.currentTaskId = taskId;\r\n    state.currentTaskType = type;\r\n    \r\n    let taskWindow = null;`;
const newTask = `window.openTask = async function(taskId, taskUrl, type) {\r\n    // GUEST MODE: require login before doing any task\r\n    if (!state.user) {\r\n        showToast('Please login or sign up to start earning! 🚀', 'info');\r\n        document.getElementById('userAuthModal').classList.add('active');\r\n        return;\r\n    }\r\n    state.currentTaskId = taskId;\r\n    state.currentTaskType = type;\r\n    \r\n    let taskWindow = null;`;

if (c.includes(oldTask)) {
    c = c.replace(oldTask, newTask);
    console.log('openTask patched OK');
} else {
    console.log('openTask target not found');
}

// Patch 2: dailyBonus - require login
const oldBonus = `window.claimDailyBonus = async function() {`;
const newBonus = `window.claimDailyBonus = async function() {\r\n    // GUEST MODE: require login\r\n    if (!state.user) {\r\n        showToast('Please login or sign up to claim your bonus! 🎁', 'info');\r\n        document.getElementById('userAuthModal').classList.add('active');\r\n        return;\r\n    }`;

if (c.includes(oldBonus)) {
    c = c.replace(oldBonus, newBonus);
    console.log('dailyBonus patched OK');
} else {
    console.log('dailyBonus target not found');
}

fs.writeFileSync('app.js', c, 'utf8');
console.log('Done!');
