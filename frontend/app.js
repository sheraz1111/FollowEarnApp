/* ============================================================
   VIRALLOOP - FULL APPLICATION JAVASCRIPT
   ============================================================ */

// ===== STATE =====
const API_URL = typeof API_BASE !== 'undefined' ? API_BASE : '/api';

const state = {
    user: null,
    allRequests: [],
    currentPlatformFilter: 'all',
    currentPage: 'home',
    currentTaskId: null,
    selectedPackage: null,
    selectedPaymentMethod: null,
    campaignType: null,
    isSignup: false,
    notifications: []
};

// ===== UTILS =====
function showToast(msg, type = 'success') {
    const c = document.getElementById('toastContainer');
    const t = document.createElement('div');
    t.className = `toast ${type}`;
    const icon = type === 'error' ? 'fa-times-circle' : type === 'info' ? 'fa-info-circle' : 'fa-check-circle';
    t.innerHTML = `<i class="fas ${icon}" style="font-size:1.1rem;"></i> ${msg}`;
    c.appendChild(t);
    setTimeout(() => t.classList.add('show'), 50);
    setTimeout(() => { t.classList.remove('show'); setTimeout(() => t.remove(), 400); }, 3500);
}

function getPlatformAvatar(platformName) {
    const p = (platformName || '').toLowerCase();
    if (p.includes('youtube')) return 'yt';
    if (p.includes('tiktok')) return 'tt';
    if (p.includes('facebook')) return 'fb';
    if (p.includes('instagram')) return 'ig';
    if (p.includes('kick')) return 'kick';
    if (p.includes('twitch')) return 'tw';
    if (p.includes('x')) return 'x';
    return 'def';
}

function getPlatformIcon(platformName) {
    const p = (platformName || '').toLowerCase();
    if (p.includes('youtube')) return 'fa-youtube fab';
    if (p.includes('tiktok')) return 'fa-tiktok fab';
    if (p.includes('facebook')) return 'fa-facebook fab';
    if (p.includes('instagram')) return 'fa-instagram fab';
    if (p.includes('kick')) return 'fa-play fas';
    if (p.includes('twitch')) return 'fa-twitch fab';
    if (p.includes('x')) return 'fa-twitter fab';
    return 'fa-video fas';
}

function generateUID(name) {
    const letters = (name || 'VL').replace(/\s/g, '').substring(0, 2).toUpperCase();
    return letters + Math.floor(Math.random() * 900000 + 100000);
}

function copyUID() {
    const uid = document.getElementById('sidebarUID').innerText;
    navigator.clipboard.writeText(uid).then(() => showToast('UID Copied!', 'info'));
}

// ===== AUTH =====
function toggleAuthMode() {
    state.isSignup = !state.isSignup;
    const nameGroup = document.getElementById('nameFieldGroup');
    const authTitle = document.getElementById('authTitle');
    const authBtnText = document.getElementById('authBtnText');
    const authToggleText = document.getElementById('authToggleText');
    if (state.isSignup) {
        nameGroup.style.display = 'block';
        authTitle.innerHTML = '<i class="fas fa-user-plus"></i> Create Account';
        authBtnText.textContent = 'Sign Up';
        authToggleText.textContent = 'Already have an account?';
    } else {
        nameGroup.style.display = 'none';
        authTitle.innerHTML = '<i class="fas fa-user-circle"></i> Welcome';
        authBtnText.textContent = 'Login';
        authToggleText.textContent = 'New here?';
    }
    document.getElementById('authError').style.display = 'none';
}

function togglePasswordVisibility() {
    const passInput = document.getElementById('userPassInput');
    const eyeIcon = document.getElementById('togglePasswordIcon');
    if (passInput.type === 'password') {
        passInput.type = 'text';
        eyeIcon.classList.remove('fa-eye');
        eyeIcon.classList.add('fa-eye-slash');
    } else {
        passInput.type = 'password';
        eyeIcon.classList.remove('fa-eye-slash');
        eyeIcon.classList.add('fa-eye');
    }
}

async function handleAuthSubmit(e) {
    e.preventDefault();
    const errEl = document.getElementById('authError');
    errEl.style.display = 'none';
    const btn = document.getElementById('authBtn');
    btn.disabled = true;
    btn.innerHTML = '<div class="loading-spinner"></div> Please wait...';

    const email = document.getElementById('userEmailInput').value;
    const pass = document.getElementById('userPassInput').value;

    try {
        let res;
        if (state.isSignup) {
            const name = document.getElementById('userNameInput').value;
            if (!name.trim()) throw new Error('Please enter your full name');
            res = await api.auth.register(name, email, pass);
        } else {
            res = await api.auth.login(email, pass);
        }
        localStorage.setItem('token', res.token);
        state.user = res.user;
        document.getElementById('userAuthModal').classList.remove('active');
        initUserUI();
        showPage('home');
        showToast(`Welcome, ${res.user.name}! 🎉`);
    } catch (err) {
        errEl.innerText = err.message;
        errEl.style.display = 'block';
    } finally {
        btn.disabled = false;
        btn.innerHTML = `<i class="fas fa-${state.isSignup ? 'user-plus' : 'sign-in-alt'}"></i> <span id="authBtnText">${state.isSignup ? 'Sign Up' : 'Login'}</span>`;
    }
}

// ===== FORGOT PASSWORD =====
function openForgotPasswordModal() {
    document.getElementById('userAuthModal').classList.remove('active');
    document.getElementById('forgotPasswordModal').style.display = 'flex';
    document.getElementById('fpEmailForm').style.display = 'block';
    document.getElementById('fpResetForm').style.display = 'none';
    document.getElementById('fpInstructionText').innerText = "Enter your email and we'll send you a 6-digit recovery code.";
}

function closeForgotPasswordModal() {
    document.getElementById('forgotPasswordModal').style.display = 'none';
    document.getElementById('userAuthModal').classList.add('active');
}

let fpEmailTarget = '';

async function handleFpEmailSubmit(e) {
    e.preventDefault();
    const errEl = document.getElementById('fpEmailError');
    errEl.style.display = 'none';
    const email = document.getElementById('fpEmailInput').value;
    const btn = e.target.querySelector('button');
    btn.disabled = true;
    btn.innerHTML = '<div class="loading-spinner"></div> Sending...';

    try {
        const res = await api.auth.forgotPassword(email);
        fpEmailTarget = email;
        document.getElementById('fpEmailForm').style.display = 'none';
        document.getElementById('fpResetForm').style.display = 'block';
        
        if(res.mockCode) {
            document.getElementById('fpInstructionText').innerHTML = `<span style="color:#10b981; font-weight:bold; font-size:1.1rem;">Your 6-digit recovery code is: ${res.mockCode}</span>`;
            showToast(`Your code is: ${res.mockCode}`, 'info');
        } else {
            document.getElementById('fpInstructionText').innerText = `Code sent to ${email}`;
            showToast('Recovery code sent to your email!');
        }
    } catch (err) {
        errEl.innerText = err.message;
        errEl.style.display = 'block';
    } finally {
        btn.disabled = false;
        btn.innerHTML = 'Send Code';
    }
}

async function handleFpResetSubmit(e) {
    e.preventDefault();
    const errEl = document.getElementById('fpResetError');
    errEl.style.display = 'none';
    const code = document.getElementById('fpCodeInput').value;
    const newPass = document.getElementById('fpNewPassInput').value;
    const btn = e.target.querySelector('button');
    btn.disabled = true;
    btn.innerHTML = '<div class="loading-spinner"></div> Updating...';

    try {
        await api.auth.resetPassword(fpEmailTarget, code, newPass);
        showToast('Password updated successfully! Please login.', 'success');
        closeForgotPasswordModal();
    } catch (err) {
        errEl.innerText = err.message;
        errEl.style.display = 'block';
    } finally {
        btn.disabled = false;
        btn.innerHTML = 'Update Password';
    }
}

// ===== GOOGLE LOGIN =====
async function handleGoogleLoginMock() {
    // This is a placeholder since we don't have a Google Client ID yet.
    // We will generate a fake token structure just to test the backend logic.
    showToast('Initializing Google Sign-in...', 'info');
    
    // Fake a Google JWT (this won't pass real google-auth-library, but our mock backend jwt.decode will parse it)
    const mockPayload = {
        sub: 'google_test_12345',
        email: 'test_google@gmail.com',
        name: 'Google Test User'
    };
    
    const base64UrlEncode = (obj) => btoa(JSON.stringify(obj)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    const fakeJwt = `header.${base64UrlEncode(mockPayload)}.signature`;

    try {
        const res = await api.auth.googleLogin(fakeJwt);
        localStorage.setItem('token', res.token);
        state.user = res.user;
        document.getElementById('userAuthModal').classList.remove('active');
        initUserUI();
        showPage('home');
        showToast(`Welcome via Google, ${res.user.name}! 🎉`);
    } catch (err) {
        showToast(err.message, 'error');
    }
}

const auth = {
    logout: () => {
        localStorage.removeItem('token');
        state.user = null;
        location.reload();
    }
};

// ===== NAVIGATION / UI =====
const EXCLUDED_EMAILS = [
    'poetry060@gmail.com',
    'sherazwalled218@gmail.com',
    'sherazwalled@gmail.com'
];

let monetagLoaded = false;
function loadMonetagAds() {
    if (monetagLoaded) return;
    
    monetagLoaded = true;
    
    window.triggerMonetagAd = function() {
        window.open('https://omg10.com/4/11160137', '_blank');
    };

    
    // Push Notification Ad
    const pushScript = document.createElement('script');
    pushScript.src = "https://5gvci.com/act/files/tag.min.js?z=11160140";
    pushScript.setAttribute('data-cfasync', 'false');
    pushScript.async = true;
    document.head.appendChild(pushScript);

    // In-Page Push (Banner) Ad
    const bannerScript = document.createElement('script');
    bannerScript.innerHTML = `(function(s){s.dataset.zone='11160142',s.src='https://nap5k.com/tag.min.js'})([document.documentElement, document.body].filter(Boolean).pop().appendChild(document.createElement('script')))`;
    document.body.appendChild(bannerScript);
}

function initUserUI() {
    if (!state.user) return;
    loadMonetagAds();
    // Show main UI elements
    document.getElementById('mainHeader').classList.remove('hidden');
    if (document.getElementById('honestyBanner')) document.getElementById('honestyBanner').classList.remove('hidden');
    document.getElementById('bottomNav').classList.remove('hidden');
    document.getElementById('fabCreate').classList.remove('hidden');

    loadNotifications();

    // Set user info
    document.getElementById('nav-coins-amount').innerText = state.user.coins;
    document.getElementById('headerUsername').innerText = state.user.name.split(' ')[0];

    const uid = state.user.uid || generateUID(state.user.name);
    document.getElementById('sidebarUID').innerText = uid;
    document.getElementById('sidebarName').innerText = state.user.name;
    document.getElementById('sidebarAvatar').innerText = state.user.name.charAt(0).toUpperCase();
    document.getElementById('headerUID').innerText = uid;

    if (state.user.role === 'admin') {
        document.getElementById('adminTriggerDot').style.display = 'block';
        const superAdminBtn = document.getElementById('sidebarSuperAdminBtn');
        const superAdminLink = document.getElementById('sidebarSuperAdminLink');
        if(superAdminBtn) superAdminBtn.classList.remove('hidden');
        if(superAdminLink) superAdminLink.classList.remove('hidden');
    }
}

function updateCoinDisplay(coins) {
    if (state.user) state.user.coins = coins;
    document.getElementById('nav-coins-amount').innerText = coins;
}

function showPage(page) {
    state.currentPage = page;
    localStorage.setItem('currentPage', page);
    closeSidebar();

    // Update bottom nav active state
    ['home','mychannel','history','earn'].forEach(p => {
        const el = document.getElementById(`nav-${p}`);
        if (el) el.classList.toggle('active', p === page);
    });

    // Show/hide platform bar and FAB
    const platformBar = document.getElementById('platformBar');
    const howToWorkContainer = document.getElementById('howToWorkContainer');
    const fab = document.getElementById('fabCreate');
    if (page === 'home') {
        platformBar.classList.remove('hidden');
        if (howToWorkContainer) howToWorkContainer.classList.remove('hidden');
        fab.classList.remove('hidden');
    } else {
        platformBar.classList.add('hidden');
        if (howToWorkContainer) howToWorkContainer.classList.add('hidden');
        fab.classList.add('hidden');
    }

    // Render the page
    renderPage(page);
}

async function renderPage(page) {
    const app = document.getElementById('app');
    app.innerHTML = '<div class="empty-state"><div class="loading-spinner" style="width:35px;height:35px;margin:0 auto;"></div></div>';
    try {
        switch (page) {
            case 'home':         app.innerHTML = await buildHomePage(); break;
            case 'mychannel':    app.innerHTML = await buildMyChannelPage(); break;
            case 'history':      app.innerHTML = await buildHistoryPage(); break;
            case 'earn':         app.innerHTML = await buildEarnPage(); break;
            case 'profile-page': app.innerHTML = await buildProfilePage(); break;
            case 'leaderboard':  app.innerHTML = await buildLeaderboardPage(); break;
            case 'personal-admin': app.innerHTML = await buildPersonalAdminPage(); break;
            case 'super-admin':  app.innerHTML = await buildSuperAdminPage(); break;
            case 'privacy':      app.innerHTML = buildInfoPage('Privacy Policy', privacyContent); break;
            case 'terms':        app.innerHTML = buildInfoPage('Terms of Service', termsContent); break;
            case 'disclaimer':   app.innerHTML = buildInfoPage('Disclaimer', disclaimerContent); break;
            case 'contact':      app.innerHTML = buildInfoPage('Contact Us', contactContent); break;
            case 'rateus':       app.innerHTML = buildRateUsPage(); break;
            default:             app.innerHTML = await buildHomePage();
        }
        app.querySelector('.animate-fade') && null; // just reference
    } catch (e) {
        app.innerHTML = `<div class="empty-state"><i class="fas fa-exclamation-triangle"></i><p>Error: ${e.message}</p></div>`;
    }
}

// ===== SIDEBAR =====
function toggleSidebar() {
    const s = document.getElementById('sidebar');
    const o = document.getElementById('sidebarOverlay');
    s.classList.toggle('open');
    o.style.display = s.classList.contains('open') ? 'block' : 'none';
}
function closeSidebar() {
    document.getElementById('sidebar').classList.remove('open');
    document.getElementById('sidebarOverlay').style.display = 'none';
}

window.toggleHowToWorkDropdown = async function() {
    const dropdown = document.getElementById('howToWorkDropdown');
    const chevron = document.getElementById('howToWorkChevron');
    if (dropdown.style.display === 'none' || dropdown.style.display === '') {
        dropdown.style.display = 'flex';
        chevron.style.transform = 'rotate(180deg)';
        
        if (dropdown.innerHTML.includes('Loading...')) {
            try {
                const links = await api.request('/tutorial-links', { method: 'GET' });
                if (links.length === 0) {
                    dropdown.innerHTML = '<div style="color:var(--gray); text-align:center; font-size:0.9rem;">No tutorials available yet.</div>';
                } else {
                    dropdown.innerHTML = links.map(link => `
                        <a href="${link.url}" target="_blank" style="background:rgba(255,255,255,0.05); padding:10px 15px; border-radius:8px; display:flex; align-items:center; gap:10px; color:var(--text-main); text-decoration:none; transition:background 0.3s;">
                            <i class="fab fa-youtube" style="color:#ff0000; font-size:1.2rem;"></i>
                            <span style="font-weight:bold;">${link.title}</span>
                        </a>
                    `).join('');
                }
            } catch(e) {
                dropdown.innerHTML = '<div style="color:#ff4757; text-align:center; font-size:0.9rem;">Failed to load links</div>';
            }
        }
    } else {
        dropdown.style.display = 'none';
        chevron.style.transform = 'rotate(0deg)';
    }
}

window.toggleOtherAppsDropdown = async function() {
    const dropdown = document.getElementById('otherAppsDropdown');
    const chevron = document.getElementById('otherAppsChevron');
    const isHidden = dropdown.style.display === 'none';
    
    if (isHidden) {
        dropdown.style.display = 'flex';
        chevron.style.transform = 'rotate(180deg)';
        
        // Fetch apps
        try {
            const apps = await api.request('/other-apps', { method: 'GET' });
            if (apps.length === 0) {
                dropdown.innerHTML = '<div class="sidebar-item" style="color:var(--gray);font-size:0.85rem;padding-left:10px;">Coming Soon...</div>';
            } else {
                dropdown.innerHTML = apps.map(app => `
                    <div class="sidebar-item" onclick="window.open('${app.url}', '_blank')" style="font-size:0.85rem; padding-left:10px; color:var(--text-main);">
                        <i class="fas fa-caret-right" style="color:var(--gold); margin-right:5px;"></i> ${app.name}
                    </div>
                `).join('');
            }
        } catch(e) {
            dropdown.innerHTML = '<div class="sidebar-item" style="color:#ff4757;font-size:0.85rem;padding-left:10px;">Failed to load</div>';
        }
    } else {
        dropdown.style.display = 'none';
        chevron.style.transform = 'rotate(0deg)';
    }
}

// ===== THEME =====
function toggleTheme() {
    const body = document.body;
    const icon = document.getElementById('themeToggleBtn').querySelector('i');
    if (body.dataset.theme === 'light') {
        delete body.dataset.theme;
        icon.className = 'fas fa-moon';
        localStorage.setItem('theme', 'dark');
    } else {
        body.dataset.theme = 'light';
        icon.className = 'fas fa-sun';
        localStorage.setItem('theme', 'light');
    }
}

// ===== NOTIFICATIONS =====
window.globalAudioCtx = null;
document.addEventListener('click', () => {
    if (!window.globalAudioCtx) window.globalAudioCtx = new (window.AudioContext || window.webkitAudioContext)();
    if (window.globalAudioCtx.state === 'suspended') window.globalAudioCtx.resume();
});

window.playNotificationSound = function() {
    const pref = localStorage.getItem('notifSound') || 'tone1';
    if (pref === 'mute') return;

    try {
        if (!window.globalAudioCtx) window.globalAudioCtx = new (window.AudioContext || window.webkitAudioContext)();
        const ctx = window.globalAudioCtx;
        if (ctx.state === 'suspended') ctx.resume();

        const duration = 7.0; // 7 seconds
        
        if (pref === 'tone1') {
            // Tone 1: Gentle Chime looping for 7 seconds (1 ping per second)
            for (let i = 0; i < 7; i++) {
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();
                osc.connect(gain);
                gain.connect(ctx.destination);
                
                osc.type = 'sine';
                osc.frequency.setValueAtTime(880, ctx.currentTime + i);
                osc.frequency.exponentialRampToValueAtTime(440, ctx.currentTime + i + 0.1);
                
                gain.gain.setValueAtTime(0, ctx.currentTime + i);
                gain.gain.linearRampToValueAtTime(1.0, ctx.currentTime + i + 0.05);
                gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + i + 0.8);
                
                osc.start(ctx.currentTime + i);
                osc.stop(ctx.currentTime + i + 0.9);
            }
        } else if (pref === 'tone2') {
            // Tone 2: Continuous Pulsing Pad for 7 seconds
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.connect(gain);
            gain.connect(ctx.destination);
            
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(440, ctx.currentTime);
            gain.gain.setValueAtTime(0, ctx.currentTime);
            for (let i = 0; i < 7; i++) {
                gain.gain.linearRampToValueAtTime(1.0, ctx.currentTime + i + 0.5);
                gain.gain.linearRampToValueAtTime(0.1, ctx.currentTime + i + 0.8);
            }
            gain.gain.linearRampToValueAtTime(0, ctx.currentTime + duration);
            
            osc.start(ctx.currentTime);
            osc.stop(ctx.currentTime + duration);
        } else if (pref === 'tone3') {
            // Tone 3: Urgent double beep repeating for 7 seconds
            for (let i = 0; i < 7; i++) {
                // First beep
                let osc1 = ctx.createOscillator();
                let gain1 = ctx.createGain();
                osc1.connect(gain1); gain1.connect(ctx.destination);
                osc1.type = 'square';
                osc1.frequency.setValueAtTime(600, ctx.currentTime + i);
                gain1.gain.setValueAtTime(0.1, ctx.currentTime + i);
                gain1.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + i + 0.2);
                osc1.start(ctx.currentTime + i); osc1.stop(ctx.currentTime + i + 0.2);
                
                // Second beep
                let osc2 = ctx.createOscillator();
                let gain2 = ctx.createGain();
                osc2.connect(gain2); gain2.connect(ctx.destination);
                osc2.type = 'square';
                osc2.frequency.setValueAtTime(800, ctx.currentTime + i + 0.3);
                gain2.gain.setValueAtTime(0.1, ctx.currentTime + i + 0.3);
                gain2.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + i + 0.5);
                osc2.start(ctx.currentTime + i + 0.3); osc2.stop(ctx.currentTime + i + 0.5);
            }
        }
    } catch(e) {
        console.error("Audio error: ", e);
    }
};

window.showNotificationSettings = function() {
    const current = localStorage.getItem('notifSound') || 'tone1';
    const modal = document.createElement('div');
    modal.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.8);z-index:9999;display:flex;align-items:center;justify-content:center;';
    modal.innerHTML = `
        <div style="background:var(--card-bg);width:90%;max-width:350px;border-radius:15px;padding:20px;border:1px solid var(--gold);">
            <h3 style="color:var(--gold);margin-bottom:10px;"><i class="fas fa-bell"></i> Notification Sound</h3>
            <p style="font-size:0.8rem; color:var(--gray); margin-bottom:5px; line-height:1.4;">If you want to know when your campaign completes, select a tone here.</p>
            <p style="font-size:0.8rem; color:var(--gold); margin-bottom:15px; line-height:1.4;">Agar aap chahte hain ki campaign puri hone par aapko pata chale, toh yahan se tone select karein.</p>
            <select id="soundSelect" style="width:100%;padding:10px;background:#222;color:#fff;border:1px solid #444;border-radius:8px;margin-bottom:15px;">
                <option value="tone1" ${current==='tone1'?'selected':''}>Tone 1 (Classic Bell)</option>
                <option value="tone2" ${current==='tone2'?'selected':''}>Tone 2 (Soft Chime)</option>
                <option value="tone3" ${current==='tone3'?'selected':''}>Tone 3 (Digital Pop)</option>
                <option value="mute" ${current==='mute'?'selected':''}>Mute (No Sound)</option>
            </select>
            <div style="display:flex;gap:10px;">
                <button onclick="
                    const val = document.getElementById('soundSelect').value;
                    localStorage.setItem('notifSound', val);
                    playNotificationSound();
                " style="flex:1;background:#333;color:#fff;border:1px solid var(--primary);padding:10px;border-radius:8px;cursor:pointer;">Play Sample</button>
                <button onclick="
                    const val = document.getElementById('soundSelect').value;
                    localStorage.setItem('notifSound', val);
                    this.parentElement.parentElement.parentElement.remove();
                    showToast('Sound saved!', 'success');
                " style="flex:1;background:var(--primary);color:#fff;border:none;padding:10px;border-radius:8px;cursor:pointer;">Save</button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
};

async function loadNotifications() {
    if (!state.user) return;
    try {
        const notifs = await api.notifications.list();
        state.notifications = notifs;
        const unreadCount = notifs.filter(n => !n.isRead).length;
        const badge = document.getElementById('notifBadge');
        if (unreadCount > 0) {
            badge.style.display = 'block';
            badge.innerText = unreadCount;
            
            let previousCount = state.lastUnreadCount;
            if (previousCount === undefined) {
                previousCount = parseInt(localStorage.getItem('lastUnreadCount')) || 0;
            }
            
            if (unreadCount > previousCount) {
                playNotificationSound();
                const bells = document.querySelectorAll('.notification-bell');
                bells.forEach(b => b.classList.add('shake'));
            }
        } else {
            badge.style.display = 'none';
        }
        state.lastUnreadCount = unreadCount;
        localStorage.setItem('lastUnreadCount', unreadCount);

        const listEl = document.getElementById('notificationList');
        if (notifs.length === 0) {
            listEl.innerHTML = '<div style="padding:20px;color:var(--gray);text-align:center;">No notifications</div>';
            return;
        }

        listEl.innerHTML = notifs.map(n => `
            <div class="notification-item ${n.isRead ? '' : 'unread'}" style="padding:15px; border-bottom:1px solid var(--border); ${n.isRead ? 'opacity:0.7;' : 'background:rgba(124, 58, 237, 0.1);'}">
                <div style="font-size:0.9rem; color:var(--text-main);">${n.message}</div>
                <div style="font-size:0.75rem; color:var(--gray); margin-top:5px;">${new Date(n.createdAt).toLocaleString()}</div>
            </div>
        `).join('');

    } catch (e) {
        console.error("Failed to load notifications", e);
    }
}

async function toggleNotifications() {
    const panel = document.getElementById('notificationPanel');
    panel.classList.toggle('open');
    if (panel.classList.contains('open')) {
        const bells = document.querySelectorAll('.notification-bell');
        bells.forEach(b => b.classList.remove('shake'));
        // mark as read when opened
        const unread = state.notifications.filter(n => !n.isRead);
        if (unread.length > 0) {
            try {
                await api.notifications.markRead();
                document.getElementById('notifBadge').style.display = 'none';
                state.notifications.forEach(n => n.isRead = true);
                loadNotifications(); // re-render as read
            } catch(e) {}
        }
    }
}

document.addEventListener('click', (e) => {
    const panel = document.getElementById('notificationPanel');
    if (!panel.contains(e.target) && !e.target.closest('.notification-bell')) {
        panel.classList.remove('open');
    }
});

// ===== PLATFORM FILTER & THEME =====
function changeThemeForPlatform(platform) {
    const root = document.documentElement;
    const p = platform.toLowerCase();
    let primary = '#7c3aed';
    let primaryLight = '#a855f7';

    if (p === 'youtube') { primary = '#ff0000'; primaryLight = '#ff4d4d'; }
    else if (p === 'tiktok') { primary = '#ff0050'; primaryLight = '#00f2fe'; }
    else if (p === 'facebook') { primary = '#1877f2'; primaryLight = '#4267b2'; }
    else if (p === 'instagram') { primary = '#e1306c'; primaryLight = '#f56040'; }
    else if (p === 'rumble') { primary = '#85c742'; primaryLight = '#9bd061'; }
    else if (p === 'kick') { primary = '#53fc18'; primaryLight = '#82ff54'; }
    else if (p === 'twitch') { primary = '#9146ff'; primaryLight = '#a970ff'; }
    else if (p === 'x') { primary = '#1da1f2'; primaryLight = '#65b8eb'; }

    root.style.setProperty('--primary', primary);
    root.style.setProperty('--primary-light', primaryLight);
}

function filterPlatform(platform, btn) {
    state.currentPlatformFilter = platform;
    document.querySelectorAll('.platform-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    changeThemeForPlatform(platform);
    renderPage('home');
}

// ===== PLATFORM BAR INIT =====
async function initPlatformBar() {
    try {
        const platforms = await api.platforms.list();
        // The static platform bar is already in HTML, no dynamic needed
    } catch (e) {}
}

// ===== HOME PAGE =====
async function buildHomePage() {
    const requests = await api.requests.list();
    state.allRequests = requests;

    let filtered = requests;
    if (state.currentPlatformFilter !== 'all') {
        filtered = requests.filter(r => r.platform.name.toLowerCase().includes(state.currentPlatformFilter));
    }
    if (state.currentTypeFilter && state.currentTypeFilter !== 'all') {
        filtered = filtered.filter(r => (r.type || 'subscribe') === state.currentTypeFilter);
    }
    if (state.showOnlineOnly) {
        filtered = filtered.filter(r => {
            if (!r.user.lastSeen) return false;
            return (Date.now() - new Date(r.user.lastSeen).getTime()) < 3 * 60 * 1000;
        });
    }
    // Verification filter removed
    if (state.timeFilter && state.timeFilter !== 'all') {
        const now = Date.now();
        let msThreshold = 0;
        if (state.timeFilter === '1d') msThreshold = 24 * 60 * 60 * 1000;
        else if (state.timeFilter === '7d') msThreshold = 7 * 24 * 60 * 60 * 1000;
        else if (state.timeFilter === '15d') msThreshold = 15 * 24 * 60 * 60 * 1000;
        else if (state.timeFilter === '30d') msThreshold = 30 * 24 * 60 * 60 * 1000;

        filtered = filtered.filter(r => (now - new Date(r.createdAt).getTime()) <= msThreshold);
    }

    let html = `<div class="animate-fade">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:15px; padding:0 10px; flex-wrap:wrap; gap:10px;">
            <h3 style="margin:0;color:var(--text-main);">Available Campaigns</h3>
            <div style="display:flex; gap:10px; align-items:center; flex-wrap:wrap;">
                <select onchange="setTimeFilter(this.value)" style="padding:4px; border-radius:5px; background:var(--card-solid); color:var(--text-main); border:1px solid var(--border-main); outline:none; font-size:0.85rem;">
                    <option value="all" ${!state.timeFilter || state.timeFilter === 'all' ? 'selected' : ''}>Latest (All)</option>
                    <option value="1d" ${state.timeFilter === '1d' ? 'selected' : ''}>Last 1 Day</option>
                    <option value="7d" ${state.timeFilter === '7d' ? 'selected' : ''}>Last 1 Week</option>
                    <option value="15d" ${state.timeFilter === '15d' ? 'selected' : ''}>Last 15 Days</option>
                    <option value="30d" ${state.timeFilter === '30d' ? 'selected' : ''}>Last 1 Month</option>
                </select>

                <label style="display:flex; align-items:center; gap:8px; cursor:pointer; color:var(--text-main); font-size:0.9rem;">
                    <input type="checkbox" ${state.showOnlineOnly ? 'checked' : ''} onchange="toggleOnlineFilter(this.checked)" style="accent-color:var(--primary);width:16px;height:16px;">
                    Online <div style="width:10px;height:10px;background:#10b981;border-radius:50%;"></div>
                </label>
            </div>
        </div>
        
        <div style="display:flex; gap:10px; margin-bottom:15px; overflow-x:auto; padding-bottom:5px; padding-left:10px;" class="hide-scrollbar">
            <button onclick="setTypeFilter('all')" style="padding:5px 12px; border-radius:20px; border:none; cursor:pointer; background:${(!state.currentTypeFilter || state.currentTypeFilter === 'all') ? 'var(--primary)' : '#333'}; color:white; font-weight:bold; white-space:nowrap;">All</button>
            <button onclick="setTypeFilter('subscribe')" style="padding:5px 12px; border-radius:20px; border:none; cursor:pointer; background:${state.currentTypeFilter === 'subscribe' ? 'var(--primary)' : '#333'}; color:white; font-weight:bold; white-space:nowrap;"><i class="fas fa-user-plus"></i> Subscribe</button>
            <button onclick="setTypeFilter('like')" style="padding:5px 12px; border-radius:20px; border:none; cursor:pointer; background:${state.currentTypeFilter === 'like' ? 'var(--primary)' : '#333'}; color:white; font-weight:bold; white-space:nowrap;"><i class="fas fa-thumbs-up"></i> Like</button>
            <button onclick="setTypeFilter('comment')" style="padding:5px 12px; border-radius:20px; border:none; cursor:pointer; background:${state.currentTypeFilter === 'comment' ? 'var(--primary)' : '#333'}; color:white; font-weight:bold; white-space:nowrap;"><i class="fas fa-comment"></i> Comment</button>
        </div>

        ${!window.honestyBoxClosed ? `
        <div style="position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.85); z-index:9999; display:flex; align-items:center; justify-content:center; animation:fadeIn 0.3s ease;">
            <div class="notice-box" style="position:relative; max-width:400px; width:90%; background:linear-gradient(135deg,rgba(20,20,20,1),rgba(245,158,11,0.2)); border:2px solid var(--gold); border-radius:15px; padding:20px; box-shadow:0 10px 30px rgba(0,0,0,0.8);">
                <div style="position:absolute; top:-12px; right:-12px; background:#ff4757; color:#fff; width:32px; height:32px; border-radius:50%; display:flex; align-items:center; justify-content:center; cursor:pointer; font-weight:bold; font-size:1.1rem; box-shadow:0 2px 8px rgba(0,0,0,0.5); border:2px solid #fff;" onclick="if(window.triggerMonetagAd) window.triggerMonetagAd(); window.honestyBoxClosed=true; this.parentElement.parentElement.remove()">
                    <i class="fas fa-times"></i>
                </div>
                <div class="notice-title" style="margin-top:5px; font-size:1.1rem;">🤝 HONESTY SYSTEM 🤝</div>
                <div class="notice-urdu">❤️ Please upload the FULL screenshot!</div>
                <div class="notice-hindi">Kripya poora screenshot upload karein!</div>
                <ul class="notice-list" style="margin-top:15px;">
                    <li><span class="notice-icon"><i class="fas fa-check-circle"></i></span>Every second here is precious. Be honest!</li>
                    <li><span class="notice-icon"><i class="fas fa-check-circle"></i></span>Do NOT fake screenshots. Your account will be banned.</li>
                    <li><span class="notice-icon"><i class="fas fa-check-circle"></i></span>Complete the task first, then upload.</li>
                </ul>
            </div>
        </div>
        ` : ''}
    `;

    if (filtered.length === 0) {
        html += `<div class="empty-state"><i class="fas fa-inbox"></i><p>No active campaigns for this platform.<br>Check back later!</p></div>`;
    } else {
        html += '<div class="content-grid">';
        filtered.forEach(req => {
            let actualLink = req.target_link;
            let instructionsHtml = '';
            if (actualLink && actualLink.includes('|||')) {
                const parts = actualLink.split('|||');
                actualLink = parts[0];
                const instrText = parts[1];
                instructionsHtml = `
                    <div style="background:rgba(16, 185, 129, 0.05); border:1px dashed var(--green); padding:10px; margin:0 12px 10px; border-radius:8px; font-size:0.85rem; color:var(--text-main);">
                        <strong style="color:var(--green); display:block; margin-bottom:4px;"><i class="fas fa-clipboard-list"></i> Task Instructions:</strong>
                        ${instrText}
                    </div>
                `;
            }

            const total = req.total_slots || req.slots_remaining; // fallback
            const done = total - req.slots_remaining;
            const pct = total > 0 ? Math.round((done / total) * 100) : 0;
            const avatarClass = getPlatformAvatar(req.platform.name);
            const platIcon = getPlatformIcon(req.platform.name);
            
            let isOnline = false;
            if (req.user.lastSeen) {
                const diffMs = Date.now() - new Date(req.user.lastSeen).getTime();
                if (diffMs < 3 * 60 * 1000) isOnline = true; // 3 minutes
            }
            
            let ytThumbnail = '';
            if (actualLink.includes('youtube.com') || actualLink.includes('youtu.be')) {
                let videoId = '';
                if (actualLink.includes('v=')) videoId = actualLink.split('v=')[1]?.split('&')[0];
                else if (actualLink.includes('youtu.be/')) videoId = actualLink.split('youtu.be/')[1]?.split('?')[0];
                if (videoId) {
                    ytThumbnail = `<img src="https://img.youtube.com/vi/${videoId}/mqdefault.jpg" style="width:100%;height:100px;object-fit:cover;border-radius:12px 12px 0 0;" alt="Video Thumbnail">`;
                }
            }

            html += `
                <div class="campaign-card" style="padding:0;overflow:hidden;">
                    ${ytThumbnail}
                    <div style="padding:12px;">
                        <div class="card-header">
                            <div class="card-avatar ${avatarClass}" style="position:relative;">
                                <i class="${platIcon}"></i>
                                ${isOnline ? '<div style="position:absolute;bottom:0;right:0;width:12px;height:12px;background:#10b981;border-radius:50%;border:2px solid var(--card-bg);"></div>' : ''}
                            </div>
                            <div class="card-meta">
                                <h4 style="display:flex;align-items:center;gap:5px;">
                                    ${req.user.name} 
                                    ${isOnline ? '<span style="font-size:0.7rem;background:rgba(16,185,129,0.1);color:var(--green);padding:2px 6px;border-radius:10px;">Active Now</span>' : ''}
                                </h4>
                                <div class="card-sub"><i class="${platIcon}" style="font-size:0.75rem;"></i> ${req.platform.name} &bull; ${req.slots_remaining} slots left</div>
                            </div>
                        </div>
                        <div class="progress-bar-wrap"><div class="progress-bar-fill" style="width:${pct}%"></div></div>
                        <div class="progress-label">${pct}% (${done} / ${total} Completed)</div>
                        <div class="card-reward">
                            <span class="reward-coins"><i class="fas fa-coins"></i> +${req.reward_coins} coins</span>
                            <span class="slots-left">${req.slots_remaining} left</span>
                        </div>
                    </div>
                    ${instructionsHtml}
                    <div style="padding:0 12px 12px;">
                        <button class="action-btn btn-subscribe" onclick="openTask(${req.id}, '${actualLink.replace(/'/g, '')}', '${req.type || 'subscribe'}')" style="margin-bottom:5px;">
                            <i class="fas fa-play"></i> Start Task
                        </button>
                        <button onclick="reportCampaign(${req.id})" style="background:transparent; color:var(--gray); border:none; cursor:pointer; font-size:0.8rem; text-decoration:underline;">
                            <i class="fas fa-flag"></i> Report Issue
                        </button>
                    </div>
                </div>
            `;
        });
        html += '</div>';
    }
    html += '</div>';
    return html;
}

// ===== TASK FLOW =====
window.setTypeFilter = function(type) {
    state.currentTypeFilter = type;
    renderPage('home');
};


window.setTimeFilter = function(val) {
    state.timeFilter = val;
    renderPage('home');
};

window.toggleOnlineFilter = function(checked) {
    state.showOnlineOnly = checked;
    renderPage('home');
};

window.reportCampaign = async function(taskId) {
    const reason = prompt("Why are you reporting this campaign? (e.g. Broken link, inappropriate content)");
    if (!reason || reason.trim() === '') return;
    
    try {
        const res = await api.request(`/requests/${taskId}/report`, {
            method: 'POST',
            body: JSON.stringify({ reason })
        });
        if (res.success) {
            showToast('Report submitted successfully. Admins will review it.', 'success');
        } else {
            showToast(res.error || 'Failed to submit report', 'error');
        }
    } catch(e) {
        showToast('Failed to submit report', 'error');
    }
}

window.openTask = async function(taskId, taskUrl, type) {
    // GUEST MODE: require login before doing any task
    if (!state.user) {
        showToast('Please login or sign up to start earning! 🚀', 'info');
        document.getElementById('userAuthModal').classList.add('active');
        return;
    }
    state.currentTaskId = taskId;
    state.currentTaskType = type;
    
    let taskWindow = null;
    if (type !== 'view') {
        taskWindow = window.open(taskUrl, '_blank');
    }
    
    // Call backend to start task timer
    try {
        await fetch(`${API_URL}/tasks/start`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('token')}` },
            body: JSON.stringify({ requestId: taskId })
        });
    } catch(e) {
        console.error("Failed to start task on backend", e);
    }

    if (type === 'view') {
        // Auto-View Logic: Open iframe in modal instead of new tab
        openAutoViewModal(taskId, taskUrl);
    } else {
        // Normal Flow (Screenshot)
        setTimeout(() => openUploadOverlay(), 1500);
    }
}

function openAutoVerifyOverlay(taskId) {
    const modalHtml = `
        <div id="autoVerifyModal" style="position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.95);z-index:9999;display:flex;flex-direction:column;align-items:center;justify-content:center;">
            <i class="fas fa-robot" style="font-size:4rem;color:var(--gold);margin-bottom:20px;"></i>
            <div style="color:white;font-size:1.5rem;margin-bottom:10px;font-weight:bold;text-align:center;">
                Auto API Verification
            </div>
            <p style="color:var(--gray);margin-bottom:30px;text-align:center;font-size:0.9rem;max-width:300px;">
                Did you complete the task? Click verify below. The system will automatically check via API and award coins instantly.
            </p>
            
            <div id="autoVerifyUsernameBox" style="margin-bottom:20px;display:none;width:100%;max-width:300px;">
                <label style="color:var(--gold);font-size:0.85rem;display:block;margin-bottom:5px;">Your Social Username (Important) *</label>
                <input type="text" id="autoVerifyUsernameInput" class="form-input" placeholder="e.g. @yourname" style="width:100%;margin-bottom:10px;">
                <button onclick="saveSocialAccountForAutoVerify()" class="btn-primary" style="width:100%;padding:10px;border-radius:8px;">Save Username</button>
            </div>

            <button id="btnTriggerAutoVerify" onclick="triggerAutoVerify(${taskId})" style="background:var(--primary);border:none;color:white;padding:12px 30px;border-radius:25px;font-weight:bold;font-size:1.1rem;cursor:pointer;margin-bottom:15px;box-shadow:0 4px 15px rgba(239,68,68,0.4);">
                Verify & Earn
            </button>
            <button onclick="document.getElementById('autoVerifyModal').remove()" style="background:transparent;border:1px solid #555;color:#ccc;padding:8px 20px;border-radius:8px;cursor:pointer;">Cancel</button>
        </div>
    `;
    document.body.insertAdjacentHTML('beforeend', modalHtml);
    
    // Check if user has a username saved (assuming TikTok for now, but should ideally check the platform of the task)
    // To keep it simple, we just show the username box if tiktokUsername is missing (since it's a test for tiktok primarily)
    if (!state.user.tiktokUsername) {
        document.getElementById('autoVerifyUsernameBox').style.display = 'block';
        document.getElementById('btnTriggerAutoVerify').style.display = 'none';
    }
}

window.saveSocialAccountForAutoVerify = async function() {
    const val = document.getElementById('autoVerifyUsernameInput').value.trim();
    if (!val) return showToast('Please enter username', 'error');
    
    try {
        const res = await fetch(`${API_URL}/users/social-accounts`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('token')}` },
            body: JSON.stringify({ tiktokUsername: val })
        });
        if (!res.ok) throw new Error('Failed to save');
        state.user.tiktokUsername = val;
        document.getElementById('autoVerifyUsernameBox').style.display = 'none';
        document.getElementById('btnTriggerAutoVerify').style.display = 'block';
        showToast('Username saved!', 'success');
    } catch(e) {
        showToast(e.message, 'error');
    }
}

window.triggerAutoVerify = async function(taskId) {
    const btn = document.getElementById('btnTriggerAutoVerify');
    btn.disabled = true;
    btn.innerHTML = '<div class="loading-spinner" style="border-color:#fff; border-top-color:transparent; width:15px; height:15px;"></div> Verifying...';
    
    try {
        const res = await fetch(`${API_URL}/tasks/verify-auto`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('token')}` },
            body: JSON.stringify({ requestId: taskId })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Verification failed');
        
        showToast(`${data.message} +${data.coins} Coins`, 'success');
        document.getElementById('autoVerifyModal').remove();
        
        // Update user state and refresh home
        const userRes = await api.auth.me();
        state.user = userRes.user;
        updateCoinDisplay(userRes.user.coins);
        buildHomePage();
    } catch(e) {
        showToast(e.message, 'error');
        btn.disabled = false;
        btn.innerHTML = 'Try Again';
    }
}

function openAutoViewModal(taskId, taskUrl) {
    // Open in new tab natively to avoid embedding risks
    window.open(taskUrl, '_blank');

    // Create modal
    const modalHtml = `
        <div id="autoViewModal" style="position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.95);z-index:9999;display:flex;flex-direction:column;align-items:center;justify-content:center;">
            <i class="fas fa-eye" style="font-size:4rem;color:var(--gold);margin-bottom:20px;animation:pulse 2s infinite;"></i>
            <div style="color:white;font-size:1.8rem;margin-bottom:10px;font-weight:bold;text-align:center;">
                Watching Video...<br>
                <span id="autoViewTimer" style="color:var(--primary);font-size:3rem;">30</span><span style="font-size:1.5rem;">s</span>
            </div>
            <p style="color:var(--gray);margin-bottom:30px;text-align:center;font-size:0.9rem;">Please don't close the video tab.<br>Coins will be awarded automatically.</p>
            
            <div style="background:#222;padding:15px 25px;border-radius:12px;display:flex;align-items:center;gap:15px;">
                <span style="color:white;font-weight:bold;">Autoplay Next Video</span>
                <label class="switch">
                    <input type="checkbox" id="autoplayToggle" ${state.autoplayEnabled ? 'checked' : ''} onchange="state.autoplayEnabled=this.checked">
                    <span class="slider round"></span>
                </label>
            </div>
            <button onclick="closeAutoViewModal()" style="margin-top:20px;background:transparent;border:1px solid #555;color:#ccc;padding:8px 20px;border-radius:8px;cursor:pointer;">Cancel</button>
        </div>
    `;
    document.body.insertAdjacentHTML('beforeend', modalHtml);

    let timeLeft = 30;
    state.autoViewInterval = setInterval(() => {
        timeLeft--;
        const tEl = document.getElementById('autoViewTimer');
        if (tEl) tEl.innerText = timeLeft;

        if (timeLeft <= 0) {
            clearInterval(state.autoViewInterval);
            submitAutoView(taskId);
        }
    }, 1000);
}

function closeAutoViewModal() {
    if (state.autoViewInterval) clearInterval(state.autoViewInterval);
    const m = document.getElementById('autoViewModal');
    if (m) m.remove();
}

async function submitAutoView(taskId) {
    const modal = document.getElementById('autoViewModal');
    if(modal) modal.innerHTML = '<div class="loading-spinner"></div><div style="color:white;margin-top:20px;font-size:1.2rem;">Verifying...</div>';
    
    try {
        const res = await fetch(`${API_URL}/submissions/auto-view`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('token')}` },
            body: JSON.stringify({ requestId: taskId })
        });
        const data = await res.json();
        
        if(modal) modal.remove();
        
        if (res.ok) {
            showToast(`Task Complete! +${data.reward} Coins`, 'success');
            
            // Re-fetch user coins
            const meRes = await api.auth.me();
            state.user = meRes.user;
            updateCoinDisplay(state.user.coins);

            // Handle Autoplay
            if (state.autoplayEnabled) {
                findAndStartNextViewCampaign();
            } else {
                renderPage('home');
            }
        } else {
            showToast(data.error || 'Verification failed', 'error');
            renderPage('home');
        }
    } catch(e) {
        if(modal) modal.remove();
        showToast('Error verifying task', 'error');
        renderPage('home');
    }
}

async function findAndStartNextViewCampaign() {
    showToast('Looking for next video...', 'info');
    try {
        const res = await api.requests.list();
        // Filter out completed and find the first available view campaign
        const available = res.filter(r => r.slots_remaining > 0 && r.type === 'view' && r.user_id !== state.user.id);
        
        if (available.length > 0) {
            const nextReq = available[0];
            showToast('Starting next video...', 'success');
            setTimeout(() => {
                openTask(nextReq.id, nextReq.target_link, 'view');
            }, 1500);
        } else {
            showToast('No more View campaigns available.', 'info');
            renderPage('home');
        }
    } catch(e) {
        renderPage('home');
    }
}

let timerInterval;
function openUploadOverlay() {
    document.getElementById('uploadStep1').style.display = 'block';
    document.getElementById('uploadingStep').classList.remove('active');
    document.getElementById('uploadOverlay').classList.add('active');
    
    const submitBtn = document.getElementById('submitScreenshotBtn');
    if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.style.opacity = '1';
        submitBtn.style.cursor = 'pointer';
        submitBtn.innerHTML = `<i class="fas fa-upload"></i> Upload & Earn`;
    }
}
function closeUploadOverlay() {
    document.getElementById('uploadOverlay').classList.remove('active');
    clearScreenshot();
}
function handleScreenshotSelect(input) {
    if (!input.files[0]) return;
    const reader = new FileReader();
    reader.onload = (e) => {
        document.getElementById('previewImg').src = e.target.result;
        document.getElementById('uploadPreview').style.display = 'block';
        document.getElementById('submitScreenshotBtn').style.display = 'block';
    };
    reader.readAsDataURL(input.files[0]);
}
function clearScreenshot() {
    document.getElementById('screenshotInput').value = '';
    document.getElementById('previewImg').src = '';
    document.getElementById('uploadPreview').style.display = 'none';
    document.getElementById('submitScreenshotBtn').style.display = 'none';
}
async function submitScreenshot() {
    // Monetag Direct Link Ad (On Submit)
    if (window.triggerMonetagAd) {
        window.triggerMonetagAd();
    }

    const input = document.getElementById('screenshotInput');
    if (!input.files[0]) return showToast('Please select a screenshot', 'error');

    document.getElementById('uploadStep1').style.display = 'none';
    document.getElementById('uploadingStep').classList.add('active');

    const fd = new FormData();
    fd.append('screenshot', input.files[0]);
    fd.append('requestId', state.currentTaskId);

    try {
        await api.submissions.upload(fd);
        closeUploadOverlay();
        showToast('Screenshot submitted! Awaiting approval. 🎉');
    } catch (e) {
        document.getElementById('uploadStep1').style.display = 'block';
        document.getElementById('uploadingStep').classList.remove('active');
        showToast(e.message, 'error');
    }
}

// ===== MY CAMPAIGNS PAGE =====
async function buildMyChannelPage() {
    let html = `<div class="animate-fade">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;">
            <h2 style="color:var(--gold);"><i class="fas fa-bullhorn"></i> My Campaigns</h2>
            <div style="display:flex; gap:10px;">
                <button onclick="reviewMyCampaignSubmissions()" style="background:#333;color:#fff;border:1px solid var(--gold);padding:10px 15px;border-radius:10px;font-weight:bold;cursor:pointer;font-size:0.9rem;">
                    <i class="fas fa-check-double"></i> Review
                </button>
                <button onclick="openCampaignModal()" style="background:var(--primary);color:#fff;border:none;padding:10px 18px;border-radius:10px;font-weight:bold;cursor:pointer;font-size:0.9rem;">
                    <i class="fas fa-plus"></i> New
                </button>
            </div>
        </div>
    `;
    try {
        const myReqs = await api.requests.mine();
        if (myReqs.length === 0) {
            html += `<div class="empty-state"><i class="fas fa-bullhorn"></i><p>No campaigns yet.<br>Create your first campaign!</p></div>`;
        } else {
            myReqs.forEach(req => {
                const total = req.total_slots || 1;
                const done = total - req.slots_remaining;
                const pct = Math.round((done / total) * 100);
                const isActive = req.status === 'active' && req.slots_remaining > 0;
                const statusColor = isActive ? 'var(--green)' : req.status === 'cancelled' ? '#ff4757' : 'var(--gold)';
                const statusText = isActive ? 'Active' : req.status === 'cancelled' ? 'Cancelled' : 'Completed';
                html += `
                    <div class="my-campaign-card" style="background:var(--card-bg);padding:15px;border-radius:12px;margin-bottom:15px;position:relative;">
                        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">
                            <h4 style="color:var(--text-main);margin:0;font-size:1rem;"><i class="fab fa-${req.platform.name.toLowerCase()}"></i> ${req.platform.name} - <span style="color:var(--primary);text-transform:uppercase;font-size:0.8rem;">${req.type}</span></h4>
                            <span style="color:${statusColor};font-size:0.8rem;font-weight:bold;background:rgba(255,255,255,0.1);padding:3px 8px;border-radius:5px;">${statusText}</span>
                        </div>
                        <div style="font-size:0.85rem;color:var(--gray);margin-bottom:10px;word-break:break-all;">${req.target_link}</div>
                        
                        <div class="progress-bar-wrap" style="height:8px;background:#333;border-radius:4px;overflow:hidden;margin-bottom:5px;">
                            <div class="progress-bar-fill" style="width:${pct}%;height:100%;background:linear-gradient(90deg, var(--primary), var(--gold));border-radius:4px;"></div>
                        </div>
                        
                        <div style="display:flex;justify-content:space-between;margin-top:5px;font-size:0.85rem;color:var(--gray);margin-bottom:15px;">
                            <span><b>${done}</b> / ${total} completed</span>
                            <span style="color:var(--gold);"><b>${req.reward_coins * total}</b> coins total</span>
                        </div>
                        
                        <div style="display:flex;gap:10px;">
                            <button onclick="viewCampaignSolvers(${req.id})" style="flex:1;background:#2a2a2a;color:#fff;border:1px solid #444;padding:8px;border-radius:8px;cursor:pointer;font-size:0.85rem;"><i class="fas fa-users"></i> View Solvers</button>
                            <button onclick="deleteCampaign(${req.id})" style="flex:1;background:rgba(255,71,87,0.2);color:#ff4757;border:1px solid #ff4757;padding:8px;border-radius:8px;cursor:pointer;font-size:0.85rem;"><i class="fas fa-trash"></i> Delete</button>
                        </div>
                    </div>
                `;
            });
        }
    } catch(e) {
        html += `<div class="empty-state"><i class="fas fa-exclamation-triangle"></i><p>${e.message}</p></div>`;
    }
    html += '</div>';
    return html;
}

window.deleteCampaign = async function(id) {
    if (!confirm("Are you sure you want to delete this campaign? Any remaining slots will be refunded to your account.")) return;
    try {
        const res = await api.request(`/requests/${id}`, { method: 'DELETE' });
        if (res.success) {
            showToast(`Campaign deleted! ${res.refunded > 0 ? 'Refunded ' + res.refunded + ' coins.' : ''}`, 'success');
            // Refresh coins
            const meRes = await api.auth.me();
            state.user = meRes.user;
            updateCoinDisplay(state.user.coins);
            showPage('mychannel');
        }
    } catch(e) {
        showToast(e.message, 'error');
    }
};

window.reviewMyCampaignSubmissions = async function() {
    try {
        const subs = await api.submissions.myCampaigns();
        let html = `<div style="padding:20px;max-height:80vh;overflow-y:auto;color:white;">
            <h3 style="color:var(--gold);margin-bottom:15px;"><i class="fas fa-check-double"></i> Pending Submissions</h3>`;
        
        if (subs.length === 0) {
            html += `<p style="color:var(--gray);">No pending submissions to review right now.</p>`;
        } else {
            subs.forEach(s => {
                html += `
                <div style="background:var(--card-bg);padding:15px;border-radius:12px;margin-bottom:15px;border:1px solid #444;">
                    <div style="display:flex;justify-content:space-between;margin-bottom:10px;">
                        <span><b>User:</b> ${s.user.name}</span>
                        <span style="color:var(--gold);">Pending</span>
                    </div>
                    <div style="margin-bottom:10px;font-size:0.9rem;color:var(--gray);">
                        Campaign #${s.request.id} - ${s.request.target_link}
                    </div>
                    <img src="${s.screenshot_url}" style="max-width:100%;border-radius:8px;margin-bottom:10px;cursor:pointer;border:1px solid #333;" onclick="window.open('${s.screenshot_url}')">
                    <div style="display:flex;gap:10px;">
                        <button onclick="ownerApproveSubmission(${s.id}, this)" style="flex:1;background:var(--green);color:white;border:none;padding:10px;border-radius:8px;cursor:pointer;font-weight:bold;"><i class="fas fa-check"></i> Approve</button>
                        <button onclick="ownerRejectSubmission(${s.id}, this)" style="flex:1;background:#ff4757;color:white;border:none;padding:10px;border-radius:8px;cursor:pointer;font-weight:bold;"><i class="fas fa-times"></i> Reject</button>
                    </div>
                </div>`;
            });
        }
        html += `</div>`;
        const modal = document.createElement('div');
        modal.id = 'ownerReviewModal';
        modal.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.8);z-index:9999;display:flex;align-items:center;justify-content:center;';
        modal.innerHTML = `
            <div style="background:#1a1a1a;width:95%;max-width:500px;border-radius:15px;overflow:hidden;border:1px solid #333;display:flex;flex-direction:column;">
                ${html}
                <button onclick="this.parentElement.parentElement.remove(); buildMyChannelPage().then(h => document.getElementById('app').innerHTML = h);" style="width:100%;padding:15px;background:#333;color:#fff;border:none;cursor:pointer;font-weight:bold;border-top:1px solid #444;">Close</button>
            </div>
        `;
        document.body.appendChild(modal);
    } catch(e) {
        showToast(e.message, 'error');
    }
};

window.ownerApproveSubmission = async function(id, btn) {
    btn.disabled = true;
    try {
        await api.submissions.approve(id);
        showToast('Submission approved!', 'success');
        btn.parentElement.parentElement.remove();
    } catch(e) { showToast(e.message, 'error'); btn.disabled = false; }
};

window.ownerRejectSubmission = async function(id, btn) {
    btn.disabled = true;
    try {
        await api.submissions.reject(id);
        showToast('Submission rejected!', 'info');
        btn.parentElement.parentElement.remove();
    } catch(e) { showToast(e.message, 'error'); btn.disabled = false; }
};

window.viewCampaignSolvers = async function(id) {
    try {
        const solvers = await api.request(`/requests/${id}/solvers`);
        let html = `<div style="padding:20px;max-height:60vh;overflow-y:auto;">
            <h3 style="color:var(--gold);margin-bottom:15px;"><i class="fas fa-users"></i> Users who completed this</h3>`;
        
        if (solvers.length === 0) {
            html += `<p style="color:var(--gray);">No users have completed this task yet.</p>`;
        } else {
            solvers.forEach(s => {
                html += `
                <div style="background:var(--card-bg);padding:12px;border-radius:8px;margin-bottom:8px;display:flex;align-items:center;gap:10px;">
                    <div style="width:35px;height:35px;background:var(--primary);border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:bold;">${s.name.charAt(0)}</div>
                    <div>
                        <div style="font-weight:bold;">${s.name}</div>
                        <div style="font-size:0.8rem;color:var(--gray);">UID: ${s.id}</div>
                    </div>
                </div>`;
            });
        }
        html += `</div>`;
        
        // Show in a modal-like structure or just inject into dom
        const modal = document.createElement('div');
        modal.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.8);z-index:9999;display:flex;align-items:center;justify-content:center;';
        modal.innerHTML = `
            <div style="background:#1a1a1a;width:90%;max-width:400px;border-radius:15px;overflow:hidden;border:1px solid #333;">
                ${html}
                <button onclick="this.parentElement.parentElement.remove()" style="width:100%;padding:15px;background:#333;color:#fff;border:none;cursor:pointer;font-weight:bold;">Close</button>
            </div>
        `;
        document.body.appendChild(modal);
    } catch(e) {
        showToast(e.message, 'error');
    }
};

// ===== HISTORY PAGE =====
async function buildHistoryPage() {
    let html = `<div class="animate-fade">
        <h2 style="color:var(--gold);margin-bottom:20px;"><i class="fas fa-history"></i> My History</h2>
        <div class="tabs">
            <button class="tab active" onclick="switchHistoryTab('submissions', this)"><i class="fas fa-upload"></i> My Submissions</button>
            <button class="tab" onclick="switchHistoryTab('transactions', this)"><i class="fas fa-coins"></i> Transactions</button>
        </div>
        <div id="historyContent">`;

    try {
        const subs = await api.submissions.mine();
        if (subs.length === 0) {
            html += `<div class="empty-state"><i class="fas fa-history"></i><p>No submissions yet.</p></div>`;
        } else {
            subs.forEach(sub => {
                const statusClass = sub.status === 'approved' ? 'badge-approved' : sub.status === 'rejected' ? 'badge-rejected' : 'badge-pending';
                const statusIcon = sub.status === 'approved' ? 'fa-check' : sub.status === 'rejected' ? 'fa-times' : 'fa-clock';
                html += `
                    <div class="history-item">
                        <div style="display:flex;align-items:center;gap:12px;">
                            <div style="width:42px;height:42px;border-radius:50%;background:var(--card-solid);border:1px solid var(--border-main);display:flex;align-items:center;justify-content:center;font-size:1.1rem;overflow:hidden;">
                                <img src="${sub.screenshot_url}" style="width:100%;height:100%;object-fit:cover;" onerror="this.parentNode.innerHTML='<i class=\\'fas fa-image\\'></i>'">
                            </div>
                            <div>
                                <div style="font-weight:500;">${sub.request && sub.request.platform ? sub.request.platform.name : 'Task'}</div>
                                <div style="font-size:0.78rem;color:var(--gray);">${new Date(sub.submitted_at || sub.timestamp).toLocaleDateString()}</div>
                            </div>
                        </div>
                        <div style="text-align:right;">
                            <div class="badge ${statusClass}"><i class="fas ${statusIcon}"></i> ${sub.status}</div>
                            ${sub.status === 'approved' ? `<div style="color:var(--green);font-weight:bold;margin-top:4px;">+${sub.request.reward_coins || 0} coins</div>` : ''}
                            ${sub.status === 'rejected' ? `<button onclick="reportSubmission(${sub.id})" style="background:transparent;border:1px solid #f43f5e;color:#f43f5e;padding:4px 8px;border-radius:4px;font-size:0.75rem;margin-top:5px;cursor:pointer;"><i class="fas fa-flag"></i> Report</button>` : ''}
                        </div>
                    </div>
                `;
            });
        }
    } catch(e) {
        html += `<div class="empty-state"><i class="fas fa-exclamation-triangle"></i><p>${e.message}</p></div>`;
    }

    html += `</div></div>`;
    return html;
}

window.switchHistoryTab = async function(tab, btn) {
    document.querySelectorAll('.tab').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    const cont = document.getElementById('historyContent');
    cont.innerHTML = '<div class="empty-state"><div class="loading-spinner" style="width:30px;height:30px;margin:0 auto;"></div></div>';

    if (tab === 'transactions') {
        try {
            const txs = await api.wallet.transactions();
            let html = '';
            if (txs.length === 0) {
                html = '<div class="empty-state"><i class="fas fa-coins"></i><p>No transactions yet.</p></div>';
            } else {
                txs.forEach(tx => {
                    const isEarn = tx.type === 'earn';
                    html += `
                        <div class="history-item">
                            <div style="display:flex;align-items:center;gap:12px;">
                                <div style="width:42px;height:42px;border-radius:50%;background:${isEarn ? 'rgba(16,185,129,0.15)' : 'rgba(255,71,87,0.15)'};display:flex;align-items:center;justify-content:center;font-size:1.1rem;color:${isEarn ? 'var(--green)' : '#ff4757'};">
                                    <i class="fas ${isEarn ? 'fa-arrow-down' : 'fa-arrow-up'}"></i>
                                </div>
                                <div>
                                    <div style="font-weight:500;">${isEarn ? 'Task Approved' : 'Campaign Created'}</div>
                                    <div style="font-size:0.78rem;color:var(--gray);">${new Date(tx.timestamp).toLocaleString()}</div>
                                </div>
                            </div>
                            <div style="font-weight:bold;font-size:1.1rem;color:${isEarn ? 'var(--green)' : '#ff4757'};">${isEarn ? '+' : '-'}${tx.amount}</div>
                        </div>
                    `;
                });
            }
            cont.innerHTML = html;
        } catch(e) {
            cont.innerHTML = `<div class="empty-state"><i class="fas fa-exclamation-triangle"></i><p>${e.message}</p></div>`;
        }
    } else {
        // Reload submissions
        const newPage = await buildHistoryPage();
        document.getElementById('app').innerHTML = newPage;
    }
}

// ===== EARN/WALLET PAGE =====
async function buildEarnPage() {
    const refCode = state.user.referralCode || 'N/A';
    
    // Fetch streak data
    const streakRes = await api.request('/users/streak').catch(() => ({ currentStreak: 0 }));
    const streakText = streakRes.currentStreak > 0 ? `Streak: Day ${streakRes.currentStreak}/7` : 'Claim Daily Bonus';

    let html = `<div class="animate-fade">
        <h2 style="color:var(--gold);margin-bottom:20px;"><i class="fas fa-coins"></i> Earn & Wallet</h2>

        <div class="notice-box" style="margin-bottom:20px; background:linear-gradient(45deg, rgba(255, 71, 87, 0.1), rgba(255, 165, 2, 0.1)); border:1px dashed var(--gold);">
            <div class="notice-title" style="color:var(--gold);"><i class="fas fa-rocket"></i> Coming Soon: Withdraw Your Coins!</div>
            <p style="color:var(--text-main); font-size:0.9rem; margin-top:5px;">Very soon, you will be able to withdraw your earned coins for real money (JazzCash, Easypaisa, etc.). Start collecting coins now!</p>
        </div>

        <div class="stats-grid" style="margin-bottom:20px;">
            <div class="stat-card" style="border-color:var(--gold)">
                <div style="color:var(--gray);font-size:0.85rem;margin-bottom:8px;">Your Coins</div>
                <h3 id="earnCoinsText"><i class="fas fa-coins"></i> ${state.user.coins}</h3>
            </div>
            <div class="stat-card" style="border-color:var(--green);cursor:pointer;" onclick="claimDailyBonus()">
                <div style="color:var(--gray);font-size:0.85rem;margin-bottom:8px;">${streakText}</div>
                <h3 style="color:var(--green);font-size:1.1rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;"><i class="fas fa-gift"></i> Claim Now!</h3>
            </div>
        </div>

        <!-- 7-DAY STREAK CHART -->
        <div style="background:var(--card-bg); padding:15px; border-radius:12px; margin-bottom:20px; border:1px solid var(--border);">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:15px;">
                <h3 style="color:var(--gold);"><i class="fas fa-calendar-check"></i> 7-Day Streak</h3>
                <span style="font-size:0.85rem; color:var(--gray);">Current: Day ${streakRes.currentStreak}</span>
            </div>
            <div style="display:flex; justify-content:space-between; align-items:center; gap:5px; overflow-x:auto; padding-bottom:5px;">
                ${[1,2,3,4,5,6,7].map(day => {
                    const isPassed = day <= streakRes.currentStreak;
                    const isToday = day === streakRes.currentStreak + 1; // approx next target
                    const rewards = [5, 10, 15, 20, 25, 30, 50];
                    const reward = rewards[day-1];
                    const bg = isPassed ? 'var(--green)' : 'rgba(255,255,255,0.05)';
                    const color = isPassed ? '#000' : 'var(--gray)';
                    const border = isPassed ? 'none' : '1px solid var(--border)';
                    return `
                    <div style="min-width:45px; flex:1; text-align:center; background:${bg}; color:${color}; border:${border}; border-radius:8px; padding:10px 5px; opacity:${isPassed ? '1' : '0.7'}; position:relative;">
                        <div style="font-size:0.7rem; margin-bottom:5px;">Day ${day}</div>
                        <div style="font-weight:bold; font-size:0.9rem;"><i class="fas fa-coins" style="font-size:0.7rem;"></i> ${reward}</div>
                        ${isPassed ? '<i class="fas fa-check-circle" style="position:absolute; top:-5px; right:-5px; color:#fff; font-size:0.8rem; background:var(--green); border-radius:50%;"></i>' : ''}
                    </div>
                    `;
                }).join('')}
            </div>
        </div>

        <button onclick="openPaymentModal()" class="action-btn btn-payment" style="margin-bottom:20px;font-size:1.1rem;background:linear-gradient(45deg, var(--gold), #ffed4e);color:#000;">
            <i class="fas fa-shopping-cart"></i> Coin Store & VIP
        </button>

        <div class="invite-section">
            <h3 style="color:var(--green);margin-bottom:10px;"><i class="fas fa-users"></i> Invite Friends</h3>
            <p style="color:var(--gray);font-size:0.9rem;margin-bottom:8px;">Share your Referral Link. You get 150 bonus coins when they create their 2nd campaign, PLUS 2% of their earnings for lifetime!</p>
            <div class="invite-code" onclick="copyReferralCode(window.location.origin + '/?ref=${refCode}')">
                Copy Referral Link <i class="fas fa-copy" style="font-size:0.85rem;margin-left:8px;"></i>
            </div>
        </div>

        <div class="notice-box" style="margin-top:15px;">
            <div class="notice-title"><i class="fas fa-info-circle"></i> How to Earn</div>
            <ul class="notice-list">
                <li><span class="notice-icon"><i class="fas fa-play-circle"></i></span>Go to Home, pick a campaign</li>
                <li><span class="notice-icon"><i class="fas fa-clock"></i></span>Wait 30 seconds on the page</li>
                <li><span class="notice-icon"><i class="fas fa-upload"></i></span>Upload screenshot for approval</li>
                <li><span class="notice-icon"><i class="fas fa-coins"></i></span>Coins added after admin approval</li>
            </ul>
        </div>
    </div>`;
    return html;
}

// ===== STORE PAGE =====
async function buildStorePage() {
    let html = `<div class="animate-fade">
        <div onclick="showPage('earn')" style="cursor:pointer;margin-bottom:15px;color:var(--gray);display:flex;align-items:center;gap:5px;"><i class="fas fa-arrow-left"></i> Back</div>
        <h2 style="color:var(--gold);margin-bottom:20px;"><i class="fas fa-store"></i> Coin Store</h2>
        
        <p style="color:var(--gray);margin-bottom:20px;">Purchase coins to boost your campaigns instantly. (Demo Version)</p>

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:15px;margin-bottom:20px;">
            <div style="background:var(--card-bg);border:1px solid var(--border-main);border-radius:15px;padding:20px;text-align:center;cursor:pointer;transition:transform 0.2s;" onmouseenter="this.style.transform='scale(1.05)'" onmouseleave="this.style.transform='scale(1)'" onclick="buyCoins(1000)">
                <div style="color:var(--gold);font-size:2rem;margin-bottom:10px;"><i class="fas fa-coins"></i></div>
                <h3 style="margin-bottom:5px;">1,000 Coins</h3>
                <div style="color:var(--gray);font-size:0.9rem;margin-bottom:15px;">Rs. 400</div>
                <button style="background:var(--primary);color:#fff;border:none;padding:8px 20px;border-radius:5px;cursor:pointer;font-weight:bold;">Buy Now</button>
            </div>
            
            <div style="background:var(--card-bg);border:1px solid var(--gold);border-radius:15px;padding:20px;text-align:center;cursor:pointer;transition:transform 0.2s;position:relative;" onmouseenter="this.style.transform='scale(1.05)'" onmouseleave="this.style.transform='scale(1)'" onclick="buyCoins(5000)">
                <div style="position:absolute;top:-10px;right:-10px;background:#f43f5e;color:#fff;padding:4px 8px;border-radius:10px;font-size:0.7rem;font-weight:bold;">BEST VALUE</div>
                <div style="color:var(--gold);font-size:2rem;margin-bottom:10px;"><i class="fas fa-money-bill-wave"></i></div>
                <h3 style="margin-bottom:5px;">5,000 Coins</h3>
                <div style="color:var(--gray);font-size:0.9rem;margin-bottom:15px;">Rs. 1,500</div>
                <button style="background:linear-gradient(45deg,var(--gold),#ffed4e);color:#000;border:none;padding:8px 20px;border-radius:5px;cursor:pointer;font-weight:bold;">Buy Now</button>
            </div>
        </div>

        <div style="background:linear-gradient(45deg, rgba(255,193,7,0.1), rgba(255,237,78,0.1));border:1px solid var(--gold);border-radius:15px;padding:20px;text-align:center;margin-top:20px;">
            <h3 style="color:var(--gold);margin-bottom:10px;"><i class="fas fa-crown"></i> VIP Membership</h3>
            <p style="color:var(--gray);font-size:0.9rem;margin-bottom:15px;">Get your campaigns pinned to the top for 30 days! Guaranteed faster completion.</p>
            <div style="font-size:1.2rem;font-weight:bold;margin-bottom:15px;">Rs. 2,000 / month</div>
            <button onclick="buyVIP()" style="background:#000;color:var(--gold);border:1px solid var(--gold);padding:10px 30px;border-radius:8px;font-weight:bold;cursor:pointer;"><i class="fas fa-star"></i> Upgrade to VIP</button>
        </div>
    </div>`;
    return html;
}

// ===== ADVANCED FEATURES LOGIC =====

window.claimDailyBonus = async function(btn) {
    // GUEST MODE: require login
    if (!state.user) {
        showToast('Please login or sign up to claim your bonus! 🎁', 'info');
        document.getElementById('userAuthModal').classList.add('active');
        return;
    }
    if (btn) btn.disabled = true;
    try {
        // Monetag Direct Link Ad
        if (window.triggerMonetagAd) {
            window.triggerMonetagAd();
        }

        const data = await api.request('/users/daily-bonus', { method: 'POST' });
        if (data.success) {
            state.user.coins = data.coins;
            updateCoinDisplay(state.user.coins);
            showToast('Daily bonus claimed! +10 Coins', 'success');
            if (state.currentPage === 'earn') renderPage('earn');
        } else {
            showToast(data.error || 'Could not claim daily bonus.', 'error');
        }
    } catch (e) {
        showToast(e.message || 'Error claiming bonus', 'error');
    } finally {
        if (btn) btn.disabled = false;
    }
}

window.copyReferralCode = function(link) {
    navigator.clipboard.writeText(link).then(() => {
        showToast('Referral Link Copied! Share it with friends.', 'success');
    }).catch(() => {
        showToast('Failed to copy', 'error');
    });
}

window.copyToClipboard = function(text) {
    navigator.clipboard.writeText(text).then(() => {
        showToast('User ID Copied to Clipboard!', 'success');
    }).catch(() => {
        showToast('Failed to copy', 'error');
    });
}

window.claimScratchCard = async function() {
    try {
        const data = await api.request('/users/daily-bonus', { method: 'POST' });
        if (data.success) {
            state.user.coins = data.coins;
            updateCoinDisplay(state.user.coins);
        }
    } catch(e) {}
}

window.buyCoins = async function(amount) {
    try {
        const res = await fetch(`${API_URL}/store/buy-coins`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('token')}` },
            body: JSON.stringify({ amount })
        });
        const data = await res.json();
        if (res.ok) {
            state.user.coins = data.coins;
            updateHeaderCoins();
            showToast(`Success! Added ${amount} coins.`, 'success');
        } else {
            showToast(data.error, 'error');
        }
    } catch(e) {
        showToast('Payment failed', 'error');
    }
}

window.buyVIP = function() {
    showToast('VIP Membership added to cart! (Demo)', 'info');
}

window.reportSubmission = async function(subId) {
    const reason = prompt("Why are you reporting this rejection? (e.g. 'I actually subscribed')");
    if (!reason) return;
    try {
        const res = await fetch(`${API_URL}/submissions/${subId}/report`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('token')}` },
            body: JSON.stringify({ reason })
        });
        const data = await res.json();
        if (res.ok) {
            showToast('Report submitted! Super Admin will review.', 'success');
        } else {
            showToast(data.error || 'Report failed', 'error');
        }
    } catch(e) {
        showToast('Report error', 'error');
    }
}

// ===== LEADERBOARD PAGE =====
async function buildLeaderboardPage() {
    let html = `<div class="animate-fade">
        <h2 style="color:var(--gold);margin-bottom:20px;"><i class="fas fa-trophy"></i> Leaderboard</h2>
        <div class="tabs">
            <button class="tab active" onclick="switchLeaderboardTab('top-earners', this)"><i class="fas fa-coins"></i> Top Earners</button>
            <button class="tab" onclick="switchLeaderboardTab('top-promoters', this)"><i class="fas fa-bullhorn"></i> Top Promoters</button>
            <button class="tab" onclick="switchLeaderboardTab('vips', this)"><i class="fas fa-star"></i> VIPs</button>
        </div>
        <div id="leaderboardContent">
            <div class="empty-state"><div class="loading-spinner" style="width:30px;height:30px;margin:0 auto;"></div></div>
        </div>
    </div>`;
    setTimeout(() => loadLeaderboardData('top-earners'), 50);
    return html;
}

window.switchLeaderboardTab = function(tab, btn) {
    document.querySelectorAll('.tabs .tab').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    loadLeaderboardData(tab);
}

async function loadLeaderboardData(tab) {
    const cont = document.getElementById('leaderboardContent');
    cont.innerHTML = '<div class="empty-state"><div class="loading-spinner" style="width:30px;height:30px;margin:0 auto;"></div></div>';
    try {
        const res = await fetch(`${API_URL}/leaderboard`);
        const data = await res.json();
        let html = '<div class="screenshot-grid" style="grid-template-columns:1fr;gap:10px;">';
        
        let list = [];
        let label = '';
        let valKey = '';
        if (tab === 'top-earners') { list = data.topEarners; label = 'Tasks Done'; valKey = 'totalTasksDone'; }
        if (tab === 'top-promoters') { list = data.topPromoters; label = 'Campaigns Run'; valKey = 'totalCampaignsRun'; }
        if (tab === 'vips') { list = data.vips; label = 'VIP Coins'; valKey = 'coins_balance'; }
        
        if (list.length === 0) {
            html = `<div class="empty-state"><p>No users found here yet!</p></div>`;
        } else {
            list.forEach((u, i) => {
                const rankColor = i === 0 ? 'var(--gold)' : i === 1 ? 'silver' : i === 2 ? '#cd7f32' : 'var(--gray)';
                html += `
                    <div style="background:var(--card-solid);padding:15px;border-radius:12px;display:flex;align-items:center;justify-content:space-between;border:1px solid var(--border-main);">
                        <div style="display:flex;align-items:center;gap:15px;">
                            <div style="font-size:1.5rem;font-weight:bold;color:${rankColor};width:30px;text-align:center;">#${i+1}</div>
                            <div style="width:40px;height:40px;border-radius:50%;background:rgba(255,255,255,0.1);display:flex;justify-content:center;align-items:center;font-weight:bold;">${u.name[0].toUpperCase()}</div>
                            <div>
                                <div style="font-weight:bold;font-size:1.1rem;">${u.name} ${tab === 'vips' ? '<i class="fas fa-check-circle" style="color:var(--gold);font-size:0.8rem;"></i>' : ''}</div>
                                <div style="font-size:0.8rem;color:var(--gray);">${label}: <span style="color:var(--text-main);">${u[valKey]}</span></div>
                            </div>
                        </div>
                    </div>
                `;
            });
            html += '</div>';
        }
        cont.innerHTML = html;
    } catch(e) {
        cont.innerHTML = `<div class="empty-state"><p>Error loading leaderboard</p></div>`;
    }
}

// ===== PROFILE PAGE =====
async function buildProfilePage() {
    const uid = state.user.uid || generateUID(state.user.name);
    return `<div class="animate-fade">
        <h2 style="color:var(--gold);margin-bottom:20px;"><i class="fas fa-user"></i> My Profile</h2>
        <div class="profile-card">
            <div class="profile-avatar-big">${state.user.name.charAt(0).toUpperCase()}</div>
            <h3 style="font-size:1.4rem;margin-bottom:5px;">
                ${state.user.name}
                <i class="fas fa-edit" onclick="editUsernameDirectly()" style="font-size:1rem;color:var(--gray);cursor:pointer;margin-left:8px;" title="Edit Username"></i>
            </h3>
            <div style="color:var(--gray);font-size:0.9rem;margin-bottom:10px;">${state.user.email}</div>
            <div style="background:rgba(124,58,237,0.1);border:1px solid var(--border-main);border-radius:10px;padding:10px 20px;display:inline-block;margin-bottom:15px;">
                UID: <span style="color:var(--gold);font-weight:bold;">${uid}</span>
                <i class="fas fa-copy" onclick="copyUID()" style="cursor:pointer;margin-left:8px;color:var(--gray);"></i>
            </div>
            <div class="stats-grid" style="margin-top:15px;">
                <div class="stat-card">
                    <div style="color:var(--gray);font-size:0.8rem;">Coins</div>
                    <h3 style="font-size:1.8rem;">${state.user.coins}</h3>
                </div>
                <div class="stat-card" style="border-color:var(--green);">
                    <div style="color:var(--gray);font-size:0.8rem;">Role</div>
                    <h3 style="font-size:1.2rem;color:var(--green);">${state.user.role === 'admin' ? 'Admin' : 'User'}</h3>
                </div>
            </div>
        </div>
        <button onclick="openSettingsModal()" style="width:100%;padding:14px;background:rgba(255,255,255,0.05);color:var(--text-main);border:1px solid var(--border);border-radius:12px;font-weight:bold;cursor:pointer;font-size:1rem;margin-bottom:10px;">
            <i class="fas fa-cog"></i> Account Settings
        </button>
        <button onclick="auth.logout()" style="width:100%;padding:14px;background:rgba(255,71,87,0.1);color:#ff4757;border:2px solid #ff4757;border-radius:12px;font-weight:bold;cursor:pointer;font-size:1rem;">
            <i class="fas fa-sign-out-alt"></i> Logout
        </button>
    </div>`;
}

window.openSettingsModal = function() {
    const modal = document.getElementById('taskModal');
    const content = document.getElementById('taskModalContent');
    
    content.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px;">
            <h3 style="color:var(--gold); margin:0;"><i class="fas fa-cog"></i> Account Settings</h3>
            <i class="fas fa-times" onclick="closeModal()" style="cursor:pointer; font-size:1.2rem; color:var(--gray);"></i>
        </div>
        
        <div style="margin-bottom:20px;">
            <label style="display:block; margin-bottom:5px; color:var(--gray); font-size:0.9rem;">Change Name</label>
            <input type="text" id="settingsName" value="${state.user.name}" style="width:100%; padding:10px; background:rgba(0,0,0,0.3); border:1px solid var(--border); color:#fff; border-radius:8px; margin-bottom:10px;">
            <button onclick="saveSettingsName()" class="action-btn" style="width:100%; background:var(--gold); color:#000;">Save Name</button>
        </div>
        
        <hr style="border-color:var(--border); margin:20px 0;">
        
        <div>
            <label style="display:block; margin-bottom:5px; color:var(--gray); font-size:0.9rem;">Change Password</label>
            <input type="password" id="settingsCurrentPass" placeholder="Current Password" style="width:100%; padding:10px; background:rgba(0,0,0,0.3); border:1px solid var(--border); color:#fff; border-radius:8px; margin-bottom:10px;">
            <input type="password" id="settingsNewPass" placeholder="New Password" style="width:100%; padding:10px; background:rgba(0,0,0,0.3); border:1px solid var(--border); color:#fff; border-radius:8px; margin-bottom:10px;">
            <button onclick="saveSettingsPassword()" class="action-btn" style="width:100%; background:var(--gold); color:#000;">Change Password</button>
        </div>
    `;
    modal.style.display = 'flex';
};

window.saveSettingsName = async function() {
    const newName = document.getElementById('settingsName').value.trim();
    if (!newName) return showToast('Name cannot be empty', 'error');
    try {
        const res = await api.auth.updateProfile(newName);
        state.user.name = res.user.name;
        showToast('Name updated successfully!', 'success');
        renderPage('profile-page');
    } catch(e) {
        showToast(e.message, 'error');
    }
};

window.editUsernameDirectly = async function() {
    const newName = prompt("Enter your new username:", state.user.name);
    if (!newName || newName.trim() === "" || newName.trim() === state.user.name) return;
    
    try {
        const res = await api.auth.updateProfile(newName.trim());
        state.user.name = res.user.name;
        showToast('Username updated successfully!', 'success');
        renderPage('profile-page');
        document.getElementById('headerUsername').innerText = state.user.name;
    } catch(e) {
        showToast(e.message, 'error');
    }
};

window.saveSettingsPassword = async function() {
    const cur = document.getElementById('settingsCurrentPass').value;
    const newP = document.getElementById('settingsNewPass').value;
    if (!cur || !newP) return showToast('Please fill all password fields', 'error');
    try {
        await api.auth.changePassword(cur, newP);
        showToast('Password changed successfully!', 'success');
        document.getElementById('settingsCurrentPass').value = '';
        document.getElementById('settingsNewPass').value = '';
    } catch(e) {
        showToast(e.message, 'error');
    }
};

// ===== LEADERBOARD =====
async function buildLeaderboardPage() {
    let html = `<div class="animate-fade">
        <h2 style="color:var(--gold);margin-bottom:5px;"><i class="fas fa-trophy"></i> Leaderboard</h2>
        <p style="color:var(--gray);font-size:0.9rem;margin-bottom:20px;">Top earners this month</p>
        <div style="background:linear-gradient(45deg,var(--gold),#ffed4e);color:#000;padding:14px;border-radius:10px;margin-bottom:20px;text-align:center;font-weight:bold;">
            <i class="fas fa-crown"></i> Top 3 get Bonus Coins every month!
        </div>
        <div id="dynamicLeaderboardContent">
            <div class="empty-state"><div class="loading-spinner" style="width:30px;height:30px;margin:0 auto;"></div></div>
        </div>
    </div>`;

    setTimeout(async () => {
        const cont = document.getElementById('dynamicLeaderboardContent');
        if (!cont) return;
        try {
            const res = await fetch(`${API_URL}/leaderboard`);
            const data = await res.json();
            let topUsers = data.topEarners || [];
            let listHtml = '';
            if (topUsers.length === 0) {
                listHtml = '<div class="empty-state"><p>No users found yet!</p></div>';
            } else {
                topUsers.forEach((user, idx) => {
                    const rank = idx + 1;
                    const rankClass = rank <= 3 ? `rank-${rank}` : 'rank-other';
                    listHtml += `
                        <div class="leaderboard-item">
                            <div class="leaderboard-rank ${rankClass}">${rank <= 3 ? ['🥇','🥈','🥉'][rank-1] : rank}</div>
                            <div style="flex:1;">
                                <div style="font-weight:600;">${user.name}</div>
                            </div>
                            <div style="color:var(--gold);font-weight:bold;"><i class="fas fa-coins"></i> ${user.coins_balance}</div>
                        </div>
                    `;
                });
            }
            cont.innerHTML = listHtml;
        } catch(e) {
            cont.innerHTML = '<div class="empty-state"><p>Error loading leaderboard</p></div>';
        }
    }, 50);

    return html;
}

// ===== ADMIN PAGES =====
async function buildPersonalAdminPage() {
    let html = `<div class="animate-fade">
        <h2 style="color:var(--primary);margin-bottom:20px;"><i class="fas fa-user-shield"></i> Personal Admin Dashboard</h2>
        <p style="color:var(--gray);margin-bottom:15px;">Approve screenshots submitted for your campaigns.</p>
        <div id="adminContent">
    `;
    try {
        const myCampaignSubs = await api.submissions.myCampaigns();
        html += buildAdminSubmissionGrid(myCampaignSubs, 'personal-admin');
    } catch(e) {
        html += `<div class="empty-state"><i class="fas fa-exclamation-triangle"></i><p>${e.message}</p></div>`;
    }
    html += `</div></div>`;
    return html;
}

async function buildSuperAdminPage() {
    if (state.user.role !== 'admin') { showPage('home'); return ''; }
    let html = `<div class="animate-fade">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px; background:var(--gold); padding:15px; border-radius:10px;">
            <h2 style="color:#000; margin:0;"><i class="fas fa-crown"></i> Super Admin Dashboard</h2>
            <button onclick="showPage('home')" style="background:#000;color:var(--gold);border:none;padding:8px 15px;border-radius:8px;cursor:pointer;"><i class="fas fa-times"></i> Exit</button>
        </div>
        <div class="tabs">
            <button class="tab active" onclick="loadSuperAdminTab('users', this)"><i class="fas fa-users"></i> All Users</button>
            <button class="tab" onclick="loadSuperAdminTab('pending', this)"><i class="fas fa-clock"></i> Pending Tasks</button>
            <button class="tab" onclick="loadSuperAdminTab('reports', this)"><i class="fas fa-flag"></i> Reports</button>
            <button class="tab" onclick="loadSuperAdminTab('payments', this)"><i class="fas fa-money-bill"></i> Payments</button>
            <button class="tab" onclick="loadSuperAdminTab('directOrders', this)"><i class="fas fa-shopping-cart"></i> Direct Orders</button>
            <button class="tab" onclick="loadSuperAdminTab('popupConfig', this)"><i class="fas fa-image"></i> Popup Config</button>
            <button class="tab" onclick="loadSuperAdminTab('voiceConfig', this)"><i class="fas fa-microphone"></i> Voice Config</button>
            <button class="tab" onclick="loadSuperAdminTab('otherApps', this)"><i class="fas fa-link"></i> Other Apps</button>
            <button class="tab" onclick="loadSuperAdminTab('tutorialLinks', this)"><i class="fas fa-chalkboard-teacher"></i> Tutorial Links</button>
            <button class="tab" style="background:var(--primary);color:#fff;" onclick="loadSuperAdminTab('broadcast', this)"><i class="fas fa-envelope"></i> Broadcast Message</button>
        </div>
        <div id="superAdminContent">
            <div class="empty-state"><div class="loading-spinner" style="width:30px;height:30px;margin:0 auto;"></div></div>
        </div>
    </div>`;
    
    // Auto-load users tab
    setTimeout(() => loadSuperAdminTab('users', document.querySelector('.tab.active')), 50);
    return html;
}

function buildAdminSubmissionGrid(subs, pageContext = 'super-admin') {
    if (subs.length === 0) return '<div class="empty-state"><i class="fas fa-check-circle"></i><p>No pending submissions!</p></div>';
    let html = '<div class="screenshot-grid">';
    subs.forEach(sub => {
        html += `
            <div class="screenshot-card pending">
                <img src="${sub.screenshot_url}" class="screenshot-img" alt="Screenshot" onclick="viewImage('${sub.screenshot_url}', ${sub.id}, '${pageContext}')">
                <div class="screenshot-info">
                    <div style="font-weight:600;margin-bottom:3px;">${sub.user ? sub.user.name : 'User'}</div>
                    <div style="font-size:0.8rem;color:var(--gray);margin-bottom:10px;">${new Date(sub.createdAt || Date.now()).toLocaleString()}</div>
                    <div style="display:flex;gap:8px;">
                        <button onclick="adminReview(${sub.id}, 'approve', '${pageContext}')" style="flex:1;padding:9px;border:none;border-radius:8px;background:var(--green);color:#fff;font-weight:bold;cursor:pointer;font-size:0.9rem;"><i class="fas fa-check"></i> Approve</button>
                        <button onclick="adminReview(${sub.id}, 'reject', '${pageContext}')" style="flex:1;padding:9px;border:none;border-radius:8px;background:#ff4757;color:#fff;font-weight:bold;cursor:pointer;font-size:0.9rem;"><i class="fas fa-times"></i> Reject</button>
                    </div>
                </div>
            </div>
        `;
    });
    html += '</div>';
    return html;
}

window.loadSuperAdminTab = async function(tab, btn) {
    document.querySelectorAll('.tab').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    const cont = document.getElementById('superAdminContent');
    cont.innerHTML = '<div class="empty-state"><div class="loading-spinner" style="width:30px;height:30px;margin:0 auto;"></div></div>';
    try {
        if (tab === 'pending') {
            const data = await api.submissions.getPending();
            cont.innerHTML = buildAdminSubmissionGrid(data, 'super-admin');
        } else if (tab === 'popupConfig') {
            const config = await api.request('/config', { method: 'GET' });
            cont.innerHTML = `
                <h3 style="margin-bottom:15px;"><i class="fas fa-image"></i> Startup Popup Banner Settings</h3>
                <div style="background:var(--card-bg); padding:20px; border-radius:12px; border:1px solid var(--border);">
                    <div class="form-group">
                        <label style="color:var(--gold); display:block; margin-bottom:5px;">Upload Popup Image (Gallery)</label>
                        <input type="file" id="adminPopupImageFile" accept="image/*" class="form-input" style="padding:10px;">
                        <img id="adminPopupImagePreview" src="${config.popupImageUrl || ''}" style="max-width:100%; margin-top:10px; border-radius:8px; display:${config.popupImageUrl ? 'block' : 'none'};">
                    </div>
                    <div class="form-group" style="margin-top:15px;">
                        <label style="color:var(--gold); display:block; margin-bottom:5px;">Popup Text (Optional)</label>
                        <input type="text" id="adminPopupText" class="form-input" placeholder="Welcome to Viral Loop!" value="${config.popupText || ''}">
                    </div>
                    <div class="form-group" style="margin-top:15px; display:flex; align-items:center; gap:10px;">
                        <input type="checkbox" id="adminPopupEnabled" ${config.isPopupEnabled ? 'checked' : ''} style="width:18px;height:18px;">
                        <label style="color:var(--gold);">Enable Popup on Startup?</label>
                    </div>
                    <div style="display:flex; gap:10px; margin-top:20px;">
                        <button onclick="saveAdminPopupConfig()" style="flex:1; padding:12px; background:var(--gold); color:#000; border:none; border-radius:8px; font-weight:bold; cursor:pointer;"><i class="fas fa-save"></i> Save Settings</button>
                        <button onclick="deleteAdminPopupConfig()" style="padding:12px; background:#ff4757; color:#fff; border:none; border-radius:8px; font-weight:bold; cursor:pointer;" title="Delete Banner"><i class="fas fa-trash"></i></button>
                    </div>
                </div>
            `;
            
            document.getElementById('adminPopupImageFile').addEventListener('change', function(e) {
                const file = e.target.files[0];
                if (file) {
                    const reader = new FileReader();
                    reader.onload = function(evt) {
                        const img = document.getElementById('adminPopupImagePreview');
                        img.src = evt.target.result;
                        img.style.display = 'block';
                    };
                    reader.readAsDataURL(file);
                }
            });
        } else if (tab === 'otherApps') {
            const apps = await api.request('/other-apps', { method: 'GET' });
            cont.innerHTML = `
                <h3 style="margin-bottom:15px;"><i class="fas fa-link"></i> Manage "Other Apps" Sidebar Links</h3>
                <div style="background:var(--card-bg); padding:20px; border-radius:12px; border:1px solid var(--border); margin-bottom: 20px;">
                    <div class="form-group">
                        <label style="color:var(--gold); display:block; margin-bottom:5px;">App Name</label>
                        <input type="text" id="adminOtherAppName" class="form-input" placeholder="e.g. My Shopping App">
                    </div>
                    <div class="form-group" style="margin-top:15px;">
                        <label style="color:var(--gold); display:block; margin-bottom:5px;">App Link (URL)</label>
                        <input type="url" id="adminOtherAppUrl" class="form-input" placeholder="https://myapp.com">
                    </div>
                    <button onclick="addAdminOtherApp()" style="margin-top:20px; width:100%; padding:12px; background:var(--gold); color:#000; border:none; border-radius:8px; font-weight:bold; cursor:pointer;"><i class="fas fa-plus"></i> Add App Link</button>
                </div>
                <h4>Existing Apps</h4>
                <div style="display:flex; flex-direction:column; gap:10px; margin-top:10px;">
                    ${apps.length === 0 ? '<div class="empty-state">No apps added yet.</div>' : ''}
                    ${apps.map(app => `
                        <div style="background:rgba(255,255,255,0.05); padding:15px; border-radius:10px; display:flex; justify-content:space-between; align-items:center;">
                            <div>
                                <div style="font-weight:bold;">${app.name}</div>
                                <a href="${app.url}" target="_blank" style="color:var(--primary); font-size:0.8rem;">${app.url}</a>
                            </div>
                            <button onclick="deleteAdminOtherApp(${app.id})" style="background:#ff4757; color:#fff; border:none; padding:8px 12px; border-radius:6px; cursor:pointer;"><i class="fas fa-trash"></i></button>
                        </div>
                    `).join('')}
                </div>
            `;
        } else if (tab === 'tutorialLinks') {
            const links = await api.request('/tutorial-links', { method: 'GET' });
            cont.innerHTML = `
                <h3 style="margin-bottom:15px;"><i class="fas fa-chalkboard-teacher"></i> Manage "How to Work" Links</h3>
                <div style="background:var(--card-bg); padding:20px; border-radius:12px; border:1px solid var(--border); margin-bottom: 20px;">
                    <div class="form-group">
                        <label style="color:var(--gold); display:block; margin-bottom:5px;">Link Title (Language)</label>
                        <input type="text" id="adminTutorialTitle" class="form-input" placeholder="e.g. Urdu Tutorial">
                    </div>
                    <div class="form-group" style="margin-top:15px;">
                        <label style="color:var(--gold); display:block; margin-bottom:5px;">Video URL</label>
                        <input type="url" id="adminTutorialUrl" class="form-input" placeholder="https://youtube.com/...">
                    </div>
                    <button onclick="addAdminTutorialLink()" style="margin-top:20px; width:100%; padding:12px; background:var(--gold); color:#000; border:none; border-radius:8px; font-weight:bold; cursor:pointer;"><i class="fas fa-plus"></i> Add Tutorial Link</button>
                </div>
                <h4>Existing Links</h4>
                <div style="display:flex; flex-direction:column; gap:10px; margin-top:10px;">
                    ${links.length === 0 ? '<div class="empty-state">No tutorial links added yet.</div>' : ''}
                    ${links.map(link => `
                        <div style="background:rgba(255,255,255,0.05); padding:15px; border-radius:10px; display:flex; justify-content:space-between; align-items:center;">
                            <div>
                                <div style="font-weight:bold;">${link.title}</div>
                                <a href="${link.url}" target="_blank" style="color:var(--primary); font-size:0.8rem;">${link.url}</a>
                            </div>
                            <button onclick="deleteAdminTutorialLink(${link.id})" style="background:#ff4757; color:#fff; border:none; padding:8px 12px; border-radius:6px; cursor:pointer;"><i class="fas fa-trash"></i></button>
                        </div>
                    `).join('')}
                </div>
            `;
        } else if (tab === 'voiceConfig') {
            const config = await api.request('/config', { method: 'GET' });
            cont.innerHTML = `
                <h3 style="margin-bottom:15px;"><i class="fas fa-microphone"></i> Global Voice Announcement</h3>
                <div style="background:var(--card-bg); padding:20px; border-radius:12px; border:1px solid var(--border);">
                    <p style="color:var(--gray); margin-bottom:15px; font-size:0.9rem;">Upload a voice note. It will be sent to all users and will expire in 5 days automatically.</p>
                    <div class="form-group">
                        <label style="color:var(--gold); display:block; margin-bottom:5px;">Upload Audio File</label>
                        <input type="file" id="adminVoiceFile" accept="audio/*" class="form-input" style="padding:10px;">
                        <audio id="adminVoicePreview" controls style="width:100%; margin-top:15px; display:${config.voiceNoteUrl ? 'block' : 'none'};" src="${config.voiceNoteUrl || ''}"></audio>
                    </div>
                    <button onclick="saveAdminVoiceConfig()" style="margin-top:20px; width:100%; padding:12px; background:var(--gold); color:#000; border:none; border-radius:8px; font-weight:bold; cursor:pointer;"><i class="fas fa-paper-plane"></i> Send Voice Announcement</button>
                </div>
            `;
            
            document.getElementById('adminVoiceFile').addEventListener('change', function(e) {
                const file = e.target.files[0];
                if (file) {
                    const reader = new FileReader();
                    reader.onload = function(evt) {
                        const audio = document.getElementById('adminVoicePreview');
                        audio.src = evt.target.result;
                        audio.style.display = 'block';
                        audio.setAttribute('data-base64', evt.target.result);
                    };
                    reader.readAsDataURL(file);
                }
            });
        } else if (tab === 'users') {
            const users = await api.admin.users();
            cont.innerHTML = buildSuperAdminUsersList(users);
        } else if (tab === 'directOrders') {
            const orders = await api.admin.directOrders();
            if (orders.length === 0) {
                cont.innerHTML = '<div class="empty-state"><i class="fas fa-check-circle"></i><p>No direct orders yet.</p></div>';
            } else {
                let html = '<h3 style="margin-bottom:15px;"><i class="fas fa-shopping-cart"></i> Direct Orders</h3>';
                orders.forEach(o => {
                    html += `
                    <div style="background:var(--card-bg); padding:15px; border-radius:12px; margin-bottom:15px; border:1px solid var(--border);">
                        <div style="display:flex;justify-content:space-between;margin-bottom:10px;">
                            <span style="font-weight:bold;color:var(--text-main);">User: ${o.user.name} (UID: ${o.user.uiId}) <i class="fas fa-copy" style="cursor:pointer;color:var(--primary);margin-left:5px;" onclick="copyToClipboard('${o.user.uiId}')" title="Copy User UID"></i></span>
                            <span style="color:${o.status === 'pending' ? 'var(--gold)' : (o.status === 'completed' ? 'var(--green)' : 'red')}">${o.status.toUpperCase()}</span>
                        </div>
                        <div style="margin-bottom:5px;color:var(--gray);">Platform: ${o.platform.toUpperCase()} - Package: ${o.package}</div>
                        <div style="margin-bottom:5px;color:var(--gray);">Price Paid: $${o.price} via ${o.method}</div>
                        <div style="margin-bottom:10px;color:var(--gray);">Target URL: <a href="${o.targetUrl}" target="_blank" style="color:var(--primary);">${o.targetUrl}</a></div>
                        <div style="margin-bottom:10px;color:var(--gray);">TxID: ${o.txId}</div>
                        ${o.proofImg ? `<img src="${o.proofImg}" style="max-width:100px;border-radius:5px;margin-bottom:10px;cursor:pointer;" onclick="window.open('${o.proofImg}')">` : ''}
                        ${o.status === 'pending' ? `
                            <div style="display:flex; gap:10px; margin-top:10px;">
                                <button onclick="adminProcessDirectOrder(${o.id}, 'completed')" style="flex:1;padding:8px;border-radius:5px;background:var(--green);border:none;color:#fff;cursor:pointer;">Complete</button>
                                <button onclick="adminProcessDirectOrder(${o.id}, 'rejected')" style="flex:1;padding:8px;border-radius:5px;background:#ff4757;border:none;color:#fff;cursor:pointer;">Reject</button>
                            </div>
                        ` : ''}
                    </div>`;
                });
                cont.innerHTML = html;
            }
        } else if (tab === 'reports') {
            const reports = await api.request('/admin/reports');
            if (reports.length === 0) {
                cont.innerHTML = '<div class="empty-state"><i class="fas fa-check-circle"></i><p>No reports found.</p></div>';
            } else {
                cont.innerHTML = reports.map(r => `
                    <div style="background:var(--card-bg); padding:15px; border-radius:12px; margin-bottom:15px; border:1px solid var(--border);">
                        <div style="display:flex;justify-content:space-between;margin-bottom:10px;">
                            <span style="font-weight:bold;color:var(--text-main);">From: ${r.reporter.name}</span>
                            <span style="font-size:0.8rem;color:${r.status === 'resolved' ? 'var(--green)' : 'var(--gold)'};font-weight:bold;">${r.status.toUpperCase()}</span>
                        </div>
                        <div style="font-size:0.9rem;color:var(--gray);margin-bottom:10px;">Target User: ${r.targetUser.name}</div>
                        <div style="font-size:0.9rem;color:var(--text-main);background:rgba(255,255,255,0.05);padding:10px;border-radius:8px;margin-bottom:15px;">
                            ${r.reason}
                        </div>
                        ${r.status !== 'resolved' ? `<button onclick="resolveReport(${r.id})" style="background:var(--green);color:#fff;border:none;padding:8px 15px;border-radius:8px;cursor:pointer;font-weight:bold;"><i class="fas fa-check"></i> Mark Resolved</button>` : ''}
                    </div>
                `).join('');
            }
        } else if (tab === 'broadcast') {
            cont.innerHTML = `
                <h3 style="margin-bottom:15px;"><i class="fas fa-envelope"></i> Broadcast Message</h3>
                <div style="background:var(--card-bg); padding:20px; border-radius:12px; border:1px solid var(--border);">
                    <p style="color:var(--gray); margin-bottom:15px;">Send an email directly to all registered users from the app server.</p>
                    <div class="form-group">
                        <label style="color:var(--gold); display:block; margin-bottom:5px;">Subject</label>
                        <input type="text" id="adminBroadcastSubject" class="form-input" placeholder="Enter email subject" required>
                    </div>
                    <div class="form-group" style="margin-top:15px;">
                        <label style="color:var(--gold); display:block; margin-bottom:5px;">Message</label>
                        <textarea id="adminBroadcastMessage" class="form-input" rows="6" placeholder="Type your message here..." required></textarea>
                    </div>
                    <button onclick="sendAdminBroadcast()" style="width:100%;background:var(--primary);color:#fff;border:none;padding:15px;border-radius:10px;cursor:pointer;font-weight:bold;margin-top:20px;font-size:1rem;">
                        <i class="fas fa-paper-plane"></i> Send to All Users
                    </button>
                </div>
            `;
        } else if (tab === 'payments') {
            const deposits = await api.admin.deposits();
            if (deposits.length === 0) {
                cont.innerHTML = '<div class="empty-state"><i class="fas fa-check-circle"></i><p>No pending payments!</p></div>';
            } else {
                cont.innerHTML = deposits.map(d => `
                    <div style="background:var(--card-bg); padding:15px; border-radius:12px; margin-bottom:15px; border:1px solid var(--border);">
                        <div style="display:flex;justify-content:space-between;margin-bottom:10px;">
                            <span style="font-weight:bold;color:var(--text-main);">User: ${d.user.name} (UID: ${d.user.uiId}) <i class="fas fa-copy" style="cursor:pointer;color:var(--primary);margin-left:5px;" onclick="copyToClipboard('${d.user.uiId}')" title="Copy User UID"></i></span>
                            <span style="font-size:0.8rem;color:${d.status === 'approved' ? 'var(--green)' : d.status === 'rejected' ? '#ff4757' : 'var(--gold)'};font-weight:bold;">${d.status.toUpperCase()}</span>
                        </div>
                        <div style="font-size:0.9rem;color:var(--gray);margin-bottom:5px;">Method: <strong style="color:var(--primary)">${d.method.toUpperCase()}</strong></div>
                        <div style="font-size:0.9rem;color:var(--gray);margin-bottom:5px;">TID / TxID: <strong style="color:var(--gold)">${d.txId}</strong></div>
                        <div style="font-size:0.9rem;color:var(--gray);margin-bottom:15px;">Amount Paid: <strong>$${d.price}</strong> => <strong>${d.amount} Coins</strong></div>
                        
                        ${d.proofImg ? `<img src="${d.proofImg}" style="max-width:100%;max-height:200px;border-radius:8px;margin-bottom:15px;cursor:pointer;" onclick="viewImage('${d.proofImg}')">` : ''}
                        
                        ${d.status === 'pending' ? `
                        <div style="display:flex;gap:10px;">
                            <button onclick="adminProcessDeposit(${d.id}, 'approve')" style="flex:1;background:var(--green);color:#fff;border:none;padding:10px;border-radius:8px;cursor:pointer;font-weight:bold;"><i class="fas fa-check"></i> Approve & Add Coins</button>
                            <button onclick="adminProcessDeposit(${d.id}, 'reject')" style="flex:1;background:#ff4757;color:#fff;border:none;padding:10px;border-radius:8px;cursor:pointer;font-weight:bold;"><i class="fas fa-times"></i> Reject</button>
                        </div>
                        ` : ''}
                    </div>
                `).join('');
            }
        }
    } catch(e) {
        cont.innerHTML = `<div class="empty-state"><i class="fas fa-exclamation-triangle"></i><p>${e.message}</p></div>`;
    }
};

window.adminProcessDeposit = async function(id, action) {
    try {
        if (action === 'approve') await api.admin.approveDeposit(id);
        else await api.admin.rejectDeposit(id);
        showToast(`Deposit ${action}d successfully`, 'success');
        loadSuperAdminTab('payments', document.querySelector('.tab.active'));
    } catch(e) {
        showToast(e.message, 'error');
    }
};

window.adminProcessDirectOrder = async function(id, status) {
    try {
        await api.admin.processDirectOrder(id, status);
        showToast(`Order marked as ${status}`, 'success');
        loadSuperAdminTab('directOrders', document.querySelector('.tab.active'));
    } catch(e) {
        showToast(e.message, 'error');
    }
};

function buildSuperAdminUsersList(users) {
    const countries = [...new Set(users.map(u => u.country || 'Unknown'))].sort();
    let countryOptions = '<option value="all">All Countries</option>';
    countries.forEach(c => {
        countryOptions += `<option value="${c}">${c}</option>`;
    });

    let html = `
        <h3 style="margin-bottom:15px;"><i class="fas fa-users"></i> All Registered Users</h3>
        
        <!-- Bulk Email System -->
        <div style="background:var(--card-solid); padding:15px; border-radius:10px; margin-bottom:15px; border:1px solid var(--border); display:flex; flex-wrap:wrap; gap:10px; align-items:center;">
            <div style="display:flex; align-items:center; gap:8px; margin-right:15px;">
                <input type="checkbox" id="selectAllAdminUsers" style="width:18px;height:18px;" onchange="toggleAllAdminUserCheckboxes(this)">
                <label for="selectAllAdminUsers" style="font-weight:bold; cursor:pointer;">Select All Users</label>
            </div>
            <button onclick="copySelectedAdminEmails()" style="background:var(--primary); color:#fff; border:none; padding:8px 15px; border-radius:5px; cursor:pointer; font-weight:bold;"><i class="fas fa-copy"></i> Copy Emails</button>
            <button onclick="sendBulkEmailAdmin()" style="background:#ff4757; color:#fff; border:none; padding:8px 15px; border-radius:5px; cursor:pointer; font-weight:bold;"><i class="fas fa-envelope"></i> Send Email (BCC)</button>
            
            <select id="superAdminCountryFilter" style="padding:8px; border-radius:5px; background:var(--card-bg); color:var(--text-main); border:1px solid var(--border); font-weight:bold; margin-left:auto;" onchange="filterSuperAdminUsers()">
                ${countryOptions}
            </select>
        </div>

        <input type="text" id="superAdminSearch" placeholder="Search by ID, email, or name..." style="width:100%;padding:10px;border-radius:8px;border:none;background:var(--card-bg);color:var(--text-main);margin-bottom:15px;" oninput="filterSuperAdminUsers()">
        <div id="superAdminUsersList">
    `;
    users.forEach(u => {
        const joinDate = new Date(u.createdAt).toLocaleDateString();
        let isOnline = false;
        if (u.lastSeen) {
            const diffMs = Date.now() - new Date(u.lastSeen).getTime();
            if (diffMs < 5 * 60 * 1000) isOnline = true;
        }
        const countryLabel = u.country || 'Unknown';
        html += `
            <div class="user-row" data-country="${countryLabel}" data-search="${u.id} ${u.name.toLowerCase()} ${u.email.toLowerCase()}" style="display:flex; justify-content:space-between; align-items:center; background:var(--card-bg); padding:15px; border-radius:10px; margin-bottom:10px; border-left: 4px solid var(--primary);">
                <div style="display:flex; align-items:center; gap:15px;">
                    <input type="checkbox" class="admin-user-checkbox" value="${u.email}" style="width:20px; height:20px;">
                    <div style="flex:1;">
                        <div style="font-weight:bold; display:flex; align-items:center; gap:8px;">
                            ${u.name} <span style="color:var(--gray);font-size:0.8rem;">(UID: ${u.id})</span>
                            <span style="font-size:0.75rem;background:var(--card-solid);color:var(--gold);padding:2px 8px;border-radius:10px;border:1px solid var(--gold);"><i class="fas fa-globe"></i> ${countryLabel}</span>
                            ${isOnline ? '<span style="font-size:0.7rem;background:rgba(16,185,129,0.1);color:var(--green);padding:2px 6px;border-radius:10px;">Online</span>' : '<span style="font-size:0.7rem;background:rgba(255,255,255,0.1);color:var(--gray);padding:2px 6px;border-radius:10px;">Offline</span>'}
                        </div>
                        <div style="color:var(--gold);font-size:0.9rem; margin-top:2px;">${u.email}</div>
                        <div style="display:flex; gap:15px; font-size:0.8rem; color:var(--text-sub); margin-top:8px;">
                            <span><i class="fas fa-calendar-alt"></i> Joined: ${joinDate}</span>
                            <span><i class="fas fa-bullhorn"></i> Campaigns: ${u.totalCampaignsRun || 0}</span>
                            <span><i class="fas fa-check-square"></i> Tasks: ${u.totalTasksDone || 0}</span>
                            <span><i class="fas fa-coins"></i> Coins: <b>${u.coins_balance}</b></span>
                        </div>
                    </div>
                </div>
                <div style="display:flex; flex-direction:column; gap:8px;">
                    <button onclick="promptAddCoins(${u.id})" style="background:var(--green);color:#fff;border:none;padding:8px 12px;border-radius:5px;cursor:pointer;font-weight:bold;font-size:0.8rem;"><i class="fas fa-plus"></i> Coins</button>
                    <button onclick="adminBanUser(${u.id})" style="background:#ff4757;color:#fff;border:none;padding:8px 12px;border-radius:5px;cursor:pointer;font-weight:bold;font-size:0.8rem;"><i class="fas fa-ban"></i> Ban</button>
                </div>
            </div>
        `;
    });
    html += '</div>';
    return html;
}

window.filterSuperAdminUsers = function() {
    const term = document.getElementById('superAdminSearch').value.toLowerCase();
    const countryFilter = document.getElementById('superAdminCountryFilter') ? document.getElementById('superAdminCountryFilter').value : 'all';
    
    document.querySelectorAll('#superAdminUsersList .user-row').forEach(row => {
        const matchTerm = row.dataset.search.includes(term);
        const matchCountry = (countryFilter === 'all') || (row.dataset.country === countryFilter);
        
        if (matchTerm && matchCountry) {
            row.style.display = 'flex';
        } else {
            row.style.display = 'none';
        }
    });
};

window.toggleAllAdminUserCheckboxes = function(checkbox) {
    document.querySelectorAll('.admin-user-checkbox').forEach(cb => {
        if (cb.closest('.user-row').style.display !== 'none') {
            cb.checked = checkbox.checked;
        }
    });
};

window.copySelectedAdminEmails = function() {
    const checkboxes = document.querySelectorAll('.admin-user-checkbox:checked');
    if (checkboxes.length === 0) return showToast('Please select at least one user.', 'error');
    
    const emails = Array.from(checkboxes).map(cb => cb.value).join(', ');
    navigator.clipboard.writeText(emails).then(() => {
        showToast(`Copied ${checkboxes.length} emails to clipboard!`, 'success');
    }).catch(() => showToast('Failed to copy emails.', 'error'));
};

window.sendBulkEmailAdmin = function() {
    const checkboxes = document.querySelectorAll('.admin-user-checkbox:checked');
    if (checkboxes.length === 0) return showToast('Please select at least one user.', 'error');
    
    const emails = Array.from(checkboxes).map(cb => cb.value).join(',');
    window.location.href = `mailto:?bcc=${emails}&subject=Update from ViralLoop Admin`;
};

window.sendAdminBroadcast = async function() {
    const subject = document.getElementById('adminBroadcastSubject').value.trim();
    const message = document.getElementById('adminBroadcastMessage').value.trim();
    
    if (!subject || !message) {
        return showToast('Please enter both subject and message.', 'error');
    }
    
    const btn = event.currentTarget;
    const oldText = btn.innerHTML;
    btn.innerHTML = '<div class="loading-spinner"></div> Sending...';
    btn.disabled = true;
    
    try {
        const res = await api.request('/admin/broadcast', {
            method: 'POST',
            body: { subject, message }
        });
        showToast(`Success! Email sent to ${res.count} users.`, 'success');
        document.getElementById('adminBroadcastSubject').value = '';
        document.getElementById('adminBroadcastMessage').value = '';
    } catch(e) {
        showToast(e.message, 'error');
    } finally {
        btn.innerHTML = oldText;
        btn.disabled = false;
    }
};

window.promptAddCoins = async function(userId) {
    const amount = prompt("How many coins to add?");
    if (!amount || isNaN(amount)) return;
    try {
        await api.admin.addCoins(userId, parseInt(amount));
        showToast(`Added ${amount} coins successfully!`, 'success');
        loadSuperAdminTab('users', document.querySelector('.tab.active'));
    } catch(e) {
        showToast(e.message, 'error');
    }
};

window.saveAdminPopupConfig = async function() {
    try {
        const popupImageUrl = document.getElementById('adminPopupImagePreview').src;
        const popupText = document.getElementById('adminPopupText').value;
        const isPopupEnabled = document.getElementById('adminPopupEnabled').checked;
        await api.request('/admin/config', {
            method: 'POST',
            body: JSON.stringify({ popupImageUrl, popupText, isPopupEnabled })
        });
        showToast('Popup Settings Saved!', 'success');
    } catch(e) {
        showToast(e.message, 'error');
    }
};

window.deleteAdminPopupConfig = async function() {
    if(!confirm("Are you sure you want to delete the global popup?")) return;
    try {
        await api.request('/admin/config', {
            method: 'POST',
            body: JSON.stringify({ popupImageUrl: '', popupText: '', isPopupEnabled: false })
        });
        showToast('Popup Deleted Successfully!', 'success');
        document.getElementById('adminPopupImagePreview').src = '';
        document.getElementById('adminPopupImagePreview').style.display = 'none';
        document.getElementById('adminPopupText').value = '';
        document.getElementById('adminPopupEnabled').checked = false;
        document.getElementById('adminPopupImageFile').value = '';
    } catch(e) {
        showToast(e.message, 'error');
    }
};

window.addAdminOtherApp = async function() {
    try {
        const name = document.getElementById('adminOtherAppName').value.trim();
        const url = document.getElementById('adminOtherAppUrl').value.trim();
        if (!name || !url) return showToast('Please enter both name and URL', 'error');
        await api.request('/other-apps', { method: 'POST', body: JSON.stringify({ name, url }) });
        showToast('App added successfully!', 'success');
        loadSuperAdminTab('otherApps', document.querySelector('.tab.active'));
    } catch(e) {
        showToast(e.message, 'error');
    }
};

window.deleteAdminOtherApp = async function(id) {
    if (!confirm('Delete this app link?')) return;
    try {
        await api.request(`/other-apps/${id}`, { method: 'DELETE' });
        showToast('Deleted successfully', 'success');
        loadSuperAdminTab('otherApps', document.querySelector('.tab.active'));
    } catch(e) {
        showToast(e.message, 'error');
    }
};

window.saveAdminVoiceConfig = async function() {
    try {
        const audio = document.getElementById('adminVoicePreview');
        const voiceNoteUrl = audio.getAttribute('data-base64');
        if (!voiceNoteUrl) {
            showToast('Please select an audio file first.', 'error');
            return;
        }
        await api.request('/admin/voice', {
            method: 'POST',
            body: JSON.stringify({ voiceNoteUrl })
        });
        showToast('Voice Announcement Sent!', 'success');
    } catch(e) {
        showToast(e.message, 'error');
    }
};

window.playVoiceAnnouncement = async function() {
    const audio = document.getElementById('globalVoicePlayer');
    if (audio.src) {
        try {
            await audio.play();
            // Update UI to remove red dot
            document.getElementById('voiceBadge').style.display = 'none';
            // Call API to register the play
            await api.request('/users/play-voice', { method: 'POST' });
        } catch (e) {
            console.error('Audio playback failed', e);
            showToast('Unable to play audio. Tap to try again.', 'error');
        }
    }
};

window.resolveReport = async function(id) {
    try {
        const res = await api.request(`/admin/reports/${id}/resolve`, { method: 'PATCH' });
        if (res.success) {
            showToast('Report marked as resolved', 'success');
            loadSuperAdminTab('reports', document.querySelector('.tab.active'));
        }
    } catch(e) {
        showToast(e.message, 'error');
    }
};

window.adminReview = async function(id, action, pageContext = 'super-admin') {
    try {
        if (action === 'approve') await api.submissions.approve(id);
        else await api.submissions.reject(id);
        showToast(action === 'approve' ? 'Approved! Coins awarded.' : 'Submission rejected.', action === 'approve' ? 'success' : 'error');
        renderPage(pageContext);
    } catch(e) {
        showToast(e.message, 'error');
    }
};

// ===== ADMIN TRIGGER =====
function adminTrigger() {
    showPage('super-admin');
}

// ===== IMAGE MODAL =====
function viewImage(src, subId, pageContext = 'super-admin') {
    document.getElementById('imageModalImg').src = src;
    const actions = document.getElementById('imageModalActions');
    if (subId) {
        actions.innerHTML = `
            <button onclick="adminReview(${subId},'approve', '${pageContext}');closeImageModal();" style="flex:1;padding:10px;background:var(--green);color:#fff;border:none;border-radius:8px;font-weight:bold;cursor:pointer;"><i class="fas fa-check"></i> Approve</button>
            <button onclick="adminReview(${subId},'reject', '${pageContext}');closeImageModal();" style="flex:1;padding:10px;background:#ff4757;color:#fff;border:none;border-radius:8px;font-weight:bold;cursor:pointer;"><i class="fas fa-times"></i> Reject</button>
        `;
    } else {
        actions.innerHTML = '';
    }
    document.getElementById('imageModal').classList.add('active');
}
function closeImageModal() {
    document.getElementById('imageModal').classList.remove('active');
}

// ===== CAMPAIGN MODAL =====
function openCampaignModal() {
    document.querySelectorAll('.form-step').forEach(s => s.classList.remove('active'));
    document.getElementById('campaignStep1').classList.add('active');
    document.getElementById('campaignModal').classList.add('active');
    loadCampaignPlatforms();
}
function closeCampaignModal() {
    document.getElementById('campaignModal').classList.remove('active');
}
function backToCampaignStep1() {
    document.querySelectorAll('.form-step').forEach(s => s.classList.remove('active'));
    document.getElementById('campaignStep1').classList.add('active');
}
async function loadCampaignPlatforms() {
    try {
        const platforms = await api.platforms.list();
        const sel = document.getElementById('campaignPlatformSelect');
        sel.innerHTML = platforms.map(p => `<option value="${p.id}">${p.name}</option>`).join('');
        updateCampaignLabels();
    } catch(e) {}
}

window.updateCampaignLabels = function() {
    const platformSelect = document.getElementById('campaignPlatformSelect');
    if (!platformSelect || platformSelect.selectedIndex === -1) return;
    const platformName = platformSelect.options[platformSelect.selectedIndex].text.toLowerCase();
    const isSubscribe = state.campaignType === 'subscribe';
    const isCustom = state.campaignType === 'custom' || platformName.includes('website') || platformName.includes('custom');
    
    const instrGroup = document.getElementById('campaignInstructionsGroup');
    if (instrGroup) instrGroup.style.display = isCustom ? 'block' : 'none';
    
    const urlLabel = document.querySelector('label[for="campaignUrl"]') || document.getElementById('campaignUrlLabel') || document.querySelector('#campaignFormStep label:nth-of-type(2)');
    if (!urlLabel) return; // Fallback if ID is missing

    let labelText = 'Target Link *';
    let placeholderText = 'Enter valid URL';

    if (isCustom) {
        labelText = 'Website / App Link *';
        placeholderText = 'e.g. https://yourwebsite.com';
    } else if (platformName.includes('youtube')) {
        labelText = isSubscribe ? 'Channel Link *' : 'Video Link *';
        placeholderText = isSubscribe ? 'e.g. youtube.com/@channel' : 'e.g. youtube.com/watch?v=...';
    } else if (platformName.includes('tiktok')) {
        labelText = isSubscribe ? 'Profile Link *' : 'Video Link *';
        placeholderText = isSubscribe ? 'e.g. tiktok.com/@username' : 'e.g. tiktok.com/@user/video/...';
    } else if (platformName.includes('instagram')) {
        labelText = isSubscribe ? 'Profile Link *' : 'Post/Reel Link *';
        placeholderText = isSubscribe ? 'e.g. instagram.com/username' : 'e.g. instagram.com/p/...';
    } else if (platformName.includes('facebook')) {
        labelText = isSubscribe ? 'Page/Profile Link *' : 'Post/Video Link *';
        placeholderText = isSubscribe ? 'e.g. facebook.com/page' : 'e.g. facebook.com/user/posts/...';
    } else if (platformName.includes('reddit')) {
        labelText = isSubscribe ? 'Subreddit / User Link *' : 'Post / Comment Link *';
        placeholderText = isSubscribe ? 'e.g. reddit.com/r/community' : 'e.g. reddit.com/r/.../comments/...';
    } else if (platformName.includes('telegram')) {
        labelText = isSubscribe ? 'Channel / Group Link *' : 'Message Link *';
        placeholderText = 'e.g. t.me/channelname';
    } else if (platformName.includes('discord')) {
        labelText = 'Server Invite Link *';
        placeholderText = 'e.g. discord.gg/invitecode';
    } else if (platformName.includes('spotify')) {
        labelText = isSubscribe ? 'Artist / User Link *' : 'Track / Playlist Link *';
        placeholderText = 'e.g. open.spotify.com/artist/...';
    } else if (platformName.includes('twitch')) {
        labelText = isSubscribe ? 'Channel Link *' : 'Video / Clip Link *';
        placeholderText = 'e.g. twitch.tv/username';
    } else if (platformName.includes('x') || platformName.includes('twitter')) {
        labelText = isSubscribe ? 'Profile Link *' : 'Tweet Link *';
        placeholderText = 'e.g. x.com/username';
    }

    urlLabel.innerText = labelText;
    document.getElementById('campaignUrl').placeholder = placeholderText;
};

function selectCampaignType(type) {
    state.campaignType = type;
    const coinsEach = type === 'subscribe' ? 10 : type === 'comment' ? 8 : type === 'view' ? 2 : type === 'custom' ? 15 : 5;
    document.getElementById('campaignCoinsEach').innerText = coinsEach;
    document.getElementById('campaignFormTitle').innerHTML = type === 'subscribe'
        ? '<i class="fas fa-user-plus"></i> Subscribe Campaign'
        : type === 'view' ? '<i class="fas fa-eye"></i> Views Campaign (Auto)' : type === 'comment' ? '<i class="fas fa-comment"></i> Comment Campaign' : type === 'custom' ? '<i class="fas fa-check-double"></i> Custom Task / App' : '<i class="fas fa-thumbs-up"></i> Like Campaign';
    document.getElementById('campaignUserBalance').innerText = `${state.user.coins} coins`;
    document.getElementById('campaignTotalCost').innerText = '0 coins';
    document.getElementById('campaignCount').value = '';
    document.querySelectorAll('.form-step').forEach(s => s.classList.remove('active'));
    document.getElementById('campaignFormStep').classList.add('active');
    updateCampaignLabels();
}

window.fetchUrlMetadata = async function(url) {
    if (!url || url.length < 10) return;
    const previewDiv = document.getElementById('campaignMetadataPreview');
    const imgEl = document.getElementById('campaignPreviewImg');
    const titleEl = document.getElementById('campaignPreviewTitle');
    const nameInput = document.getElementById('campaignName');
    
    try {
        titleEl.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Fetching details...';
        previewDiv.style.display = 'flex';
        
        const data = await api.metadata.fetch(url);
        if (data.title || data.image) {
            titleEl.innerText = data.title || 'Unknown Channel/Video';
            if (data.image) {
                imgEl.src = data.image;
                imgEl.style.display = 'block';
            } else {
                imgEl.style.display = 'none';
            }
            if (!nameInput.value && data.title) {
                nameInput.value = data.title.substring(0, 50);
            }
        } else {
            previewDiv.style.display = 'none';
        }
    } catch(e) {
        previewDiv.style.display = 'none';
    }
};

function calcCampaignCost() {
    const count = parseInt(document.getElementById('campaignCount').value) || 0;
    const coinsEach = state.campaignType === 'subscribe' ? 10 : state.campaignType === 'comment' ? 8 : state.campaignType === 'view' ? 2 : state.campaignType === 'custom' ? 15 : 5;
    document.getElementById('campaignTotalCost').innerText = `${count * coinsEach} coins`;
}

async function submitCampaignForm() {
    const platformSelect = document.getElementById('campaignPlatformSelect');
    if (!platformSelect || platformSelect.options.length === 0 || platformSelect.selectedIndex === -1) {
        return showToast('No platform available. Please check your internet or contact Admin.', 'error');
    }
    const platformId = platformSelect.value;
    const platformName = platformSelect.options[platformSelect.selectedIndex].text.toLowerCase();
    
    const name = document.getElementById('campaignName').value.trim();
    let url = document.getElementById('campaignUrl').value.trim();
    const count = parseInt(document.getElementById('campaignCount').value);
    
    const instrGroup = document.getElementById('campaignInstructionsGroup');
    const instructions = instrGroup && instrGroup.style.display !== 'none' ? document.getElementById('campaignInstructions').value.trim() : '';

    if (!url || !count || count < 10) return showToast('Please provide URL and Min 10 quantity.', 'error');
    if (instrGroup && instrGroup.style.display !== 'none' && !instructions) return showToast('Please provide Task Instructions.', 'error');
    
    url = url.trim();
    if (!/^https?:\/\//i.test(url)) {
        url = 'https://' + url;
    }

    // URL Validation
    const urlLower = url.toLowerCase();
    let isValidUrl = false;
    const isSubscribe = state.campaignType === 'subscribe';
    const isCustom = state.campaignType === 'custom' || platformName.includes('custom') || platformName.includes('website');
    
    if (isCustom) {
        isValidUrl = true; // allow any for custom
    } else if (platformName.includes('youtube')) {
        if (!urlLower.includes('youtube.com/') && !urlLower.includes('youtu.be/')) return showToast('Please enter a valid YouTube URL.', 'error');
        if (isSubscribe) {
            if (urlLower.includes('/watch') || urlLower.includes('youtu.be') || urlLower.includes('/shorts/')) return showToast('For Subscribe campaigns, please enter a Channel link, not a video link.', 'error');
        } else {
            if (urlLower.includes('/channel/') || urlLower.includes('/c/') || urlLower.includes('/user/') || (urlLower.includes('/@') && !urlLower.includes('/shorts/'))) return showToast('For this campaign, please enter a Video link, not a channel link.', 'error');
        }
        isValidUrl = true;
    } else if (platformName.includes('tiktok')) {
        if (!urlLower.includes('tiktok.com/')) return showToast('Please enter a valid TikTok URL.', 'error');
        if (isSubscribe) {
            if (urlLower.includes('/video/') || urlLower.includes('vt.tiktok.com') || urlLower.includes('vm.tiktok.com') || urlLower.includes('/t/')) return showToast('For Subscribe campaigns, please enter a Profile link, not a video link.', 'error');
        } else {
            if (!urlLower.includes('/video/') && !urlLower.includes('vt.tiktok.com') && !urlLower.includes('vm.tiktok.com') && !urlLower.includes('/t/')) return showToast('For this campaign, please enter a Video link, not a profile link.', 'error');
        }
        isValidUrl = true;
    } else if (platformName.includes('facebook')) {
        if (!urlLower.includes('facebook.com/') && !urlLower.includes('fb.watch/')) return showToast('Please enter a valid Facebook URL.', 'error');
        if (isSubscribe) {
            if (urlLower.includes('/posts/') || urlLower.includes('/videos/') || urlLower.includes('fb.watch') || urlLower.includes('/watch') || urlLower.includes('/reel/') || urlLower.includes('/reels/') || urlLower.includes('/photo') || urlLower.includes('permalink.php') || urlLower.includes('story.php')) return showToast('For Follow campaigns, please enter a Page/Profile link.', 'error');
        } else {
            if (!urlLower.includes('/posts/') && !urlLower.includes('/videos/') && !urlLower.includes('fb.watch') && !urlLower.includes('/watch') && !urlLower.includes('/reel/') && !urlLower.includes('/reels/') && !urlLower.includes('/photo') && !urlLower.includes('permalink.php') && !urlLower.includes('story.php')) return showToast('For this campaign, please enter a Post, Video, or Reel link.', 'error');
        }
        isValidUrl = true;
    } else if (platformName.includes('instagram')) {
        if (!urlLower.includes('instagram.com/')) return showToast('Please enter a valid Instagram URL.', 'error');
        if (isSubscribe) {
            if (urlLower.includes('/p/') || urlLower.includes('/reel/') || urlLower.includes('/reels/') || urlLower.includes('/tv/')) return showToast('For Follow campaigns, please enter a Profile link.', 'error');
        } else {
            if (!urlLower.includes('/p/') && !urlLower.includes('/reel/') && !urlLower.includes('/reels/') && !urlLower.includes('/tv/')) return showToast('For this campaign, please enter a Post or Reel link.', 'error');
        }
        isValidUrl = true;
    } else if (platformName.includes('rumble')) {
        if (!urlLower.includes('rumble.com/')) return showToast('Please enter a valid Rumble URL.', 'error');
        if (isSubscribe) {
            if (urlLower.includes('/v') && urlLower.includes('.html')) return showToast('For Subscribe campaigns, please enter a Channel/User link.', 'error');
        } else {
            if (urlLower.includes('/c/') || urlLower.includes('/user/')) return showToast('For this campaign, please enter a Video link.', 'error');
        }
        isValidUrl = true;
    } else if (platformName.includes('kick')) {
        if (!urlLower.includes('kick.com/')) return showToast('Please enter a valid Kick URL.', 'error');
        if (isSubscribe) {
            if (urlLower.includes('/video/') || urlLower.includes('/clip/')) return showToast('For Follow campaigns, please enter a Channel link.', 'error');
        } else {
            if (!urlLower.includes('/video/') && !urlLower.includes('/clip/')) return showToast('For this campaign, please enter a Video/Clip link.', 'error');
        }
        isValidUrl = true;
    } else if (platformName.includes('twitch')) {
        if (!urlLower.includes('twitch.tv/')) return showToast('Please enter a valid Twitch URL.', 'error');
        if (isSubscribe) {
            if (urlLower.includes('/videos/') || urlLower.includes('/clip/') || urlLower.includes('clips.twitch.tv')) return showToast('For Follow campaigns, please enter a Channel link.', 'error');
        } else {
            if (!urlLower.includes('/videos/') && !urlLower.includes('/clip/') && !urlLower.includes('clips.twitch.tv')) return showToast('For this campaign, please enter a Video/Clip link.', 'error');
        }
        isValidUrl = true;
    } else if (platformName.includes('x') || platformName.includes('twitter')) {
        if (!urlLower.includes('twitter.com/') && !urlLower.includes('x.com/')) return showToast('Please enter a valid X/Twitter URL.', 'error');
        if (isSubscribe) {
            if (urlLower.includes('/status/')) return showToast('For Follow campaigns, please enter a Profile link.', 'error');
        } else {
            if (!urlLower.includes('/status/')) return showToast('For this campaign, please enter a Tweet link.', 'error');
        }
        isValidUrl = true;
    } else if (platformName.includes('telegram')) {
        if (!urlLower.includes('t.me/')) return showToast('Please enter a valid Telegram (t.me) URL.', 'error');
        isValidUrl = true;
    } else if (platformName.includes('spotify')) {
        if (!urlLower.includes('open.spotify.com/')) return showToast('Please enter a valid Spotify URL.', 'error');
        if (isSubscribe) {
            if (!urlLower.includes('/artist/') && !urlLower.includes('/user/')) return showToast('For Follow campaigns, please enter an Artist or User Profile link.', 'error');
        } else {
            if (!urlLower.includes('/track/') && !urlLower.includes('/album/')) return showToast('For this campaign, please enter a Track or Album link.', 'error');
        }
        isValidUrl = true;
    } else if (platformName.includes('discord')) {
        if (!urlLower.includes('discord.gg/') && !urlLower.includes('discord.com/invite/')) return showToast('Please enter a valid Discord Invite URL.', 'error');
        isValidUrl = true;
    } else if (platformName.includes('reddit')) {
        if (!urlLower.includes('reddit.com/')) return showToast('Please enter a valid Reddit URL.', 'error');
        if (isSubscribe) {
            if (!urlLower.includes('/r/') && !urlLower.includes('/user/')) return showToast('For Join/Follow campaigns, please enter a Subreddit or User link.', 'error');
        } else {
            if (!urlLower.includes('/comments/')) return showToast('For Upvote campaigns, please enter a Post/Comment link.', 'error');
        }
        isValidUrl = true;
    } else if (platformName.includes('threads')) {
        if (!urlLower.includes('threads.net/')) return showToast('Please enter a valid Threads URL.', 'error');
        if (isSubscribe) {
            if (urlLower.includes('/post/')) return showToast('For Follow campaigns, please enter a Profile link.', 'error');
        } else {
            if (!urlLower.includes('/post/')) return showToast('For this campaign, please enter a Post link.', 'error');
        }
        isValidUrl = true;
    } else {
        // For any other platform, we just ensure it's a valid http URL for now
        isValidUrl = true;
    }

    const coinsEach = state.campaignType === 'subscribe' ? 10 : state.campaignType === 'comment' ? 8 : state.campaignType === 'view' ? 2 : state.campaignType === 'custom' ? 15 : 5;
    const totalCost = count * coinsEach;
    if (state.user.coins < totalCost) return showToast(`Not enough coins! Need ${totalCost}, you have ${state.user.coins}`, 'error');
    
    // Append instructions to URL if any
    let finalUrl = url;
    if (instructions) {
        finalUrl = finalUrl + '|||' + instructions;
    }

    const btn = document.getElementById('campaignSubmitBtn');
    btn.disabled = true;
    btn.innerHTML = '<div class="loading-spinner"></div> Creating...';

    try {
        const autoApproveEl = document.getElementById('campaignAutoApprove');
        const autoApproveHours = autoApproveEl ? parseFloat(autoApproveEl.value) : 24;
        await api.requests.create({ 
            platformId, 
            target_link: finalUrl, 
            reward_coins: coinsEach, 
            slots: count, 
            type: state.campaignType,
            auto_approve_hours: autoApproveHours
        });
        const res = await api.auth.me();
        state.user = res.user;
        updateCoinDisplay(res.user.coins);
        closeCampaignModal();
        showToast('Campaign created successfully! 🚀');
        showPage('mychannel');
    } catch(e) {
        showToast(e.message, 'error');
    } finally {
        btn.disabled = false;
        btn.innerHTML = '<i class="fas fa-rocket"></i> Start Campaign';
    }
}

// ===== PAYMENT MODAL =====
function openPaymentModal() {
    document.getElementById('packagesContainer').querySelectorAll('.payment-package').forEach(p => p.classList.remove('selected'));
    document.getElementById('paymentMethodsSection').classList.remove('active');
    document.getElementById('paymentFormSection').classList.remove('active');
    document.getElementById('paymentModal').classList.add('active');
    state.selectedPackage = null;
    state.selectedPaymentMethod = null;
    
    const vipBanner = document.getElementById('vipBannerContainer');
    if (state.user.isVIP) {
        vipBanner.innerHTML = `
            <div style="background:rgba(46,213,115,0.1); border:1px solid var(--green); padding:15px; border-radius:10px; margin-bottom:20px;">
                <div style="display:flex; align-items:center; color:var(--green);">
                    <i class="fas fa-crown" style="font-size:1.5rem; margin-right:10px;"></i>
                    <div>
                        <h4 style="margin:0;">VIP Active</h4>
                        <div style="font-size:0.85rem; color:var(--gray);">You are enjoying 10% bonus coins on all tasks!</div>
                    </div>
                </div>
            </div>
        `;
    } else {
        vipBanner.innerHTML = `
            <div style="background:var(--card-bg); border:1px solid var(--gold); padding:15px; border-radius:10px; margin-bottom:20px; display:flex; justify-content:space-between; align-items:center;">
                <div>
                    <h4 style="color:var(--gold); margin:0 0 5px;"><i class="fas fa-crown"></i> VIP Membership</h4>
                    <div style="font-size:0.85rem; color:var(--gray);">Get 10% bonus coins on all tasks!</div>
                </div>
                <button onclick="buyVip()" style="background:var(--gold); color:#000; border:none; padding:8px 15px; border-radius:8px; cursor:pointer; font-weight:bold; white-space:nowrap;">
                    Buy (500 Coins)
                </button>
            </div>
        `;
    }
}

window.buyVip = async function() {
    if (!confirm("Do you want to buy VIP Membership for 500 coins?")) return;
    try {
        const res = await api.store.buyVip();
        if (res.success) {
            showToast('Congratulations! You are now a VIP!', 'success');
            const meRes = await api.auth.me();
            state.user = meRes.user;
            updateCoinDisplay(state.user.coins);
            openPaymentModal(); // refresh UI
            if(document.getElementById('profile-page')) renderPage('profile-page'); // refresh if on profile
        }
    } catch(e) {
        showToast(e.message, 'error');
    }
};
function closePaymentModal() {
    document.getElementById('paymentModal').classList.remove('active');
}
function selectPackage(coins, price, el) {
    state.selectedPackage = { coins, price };
    state.directOrder = null;
    document.querySelectorAll('.payment-package-card').forEach(p => p.style.border = '1px solid #444');
    el.style.border = '2px solid var(--gold)';
    document.getElementById('paymentMethodsSection').classList.add('active');
    document.getElementById('paymentFormSection').classList.remove('active');
    document.getElementById('directOrderUrlGroup').style.display = 'none';
}
function selectDirectPackage(platform, pkgName, priceInRs, el) {
    // Treat priceInRs as PKR and calculate roughly USD price
    const priceUsd = (priceInRs / 278).toFixed(2);
    state.selectedPackage = { coins: 0, price: priceUsd, priceInRs };
    state.directOrder = { platform, pkgName };
    document.querySelectorAll('.payment-package-card').forEach(p => p.style.border = '1px solid #444');
    el.style.border = '2px solid ' + el.style.borderColor;
    document.getElementById('paymentMethodsSection').classList.add('active');
    document.getElementById('paymentFormSection').classList.remove('active');
    document.getElementById('directOrderUrlGroup').style.display = 'block';

    if (state.selectedPaymentMethod === 'binance') {
        state.selectedPaymentMethod = null;
        document.getElementById('paymentDetails').innerHTML = '';
    }
}
function selectPaymentMethod(method) {
    if (state.directOrder && method === 'binance') {
        showToast('Dollar/Binance payments are only available for larger packages. Please purchase a larger package instead.', 'error');
        return;
    }
    state.selectedPaymentMethod = method;
    const det = document.getElementById('paymentDetails');
    if (method === 'jazzcash') {
        det.innerHTML = `
            <h3 style="margin-bottom:10px;font-size:1.1rem;color:var(--primary)">Send to EasyPaisa / JazzCash</h3>
            <div style="font-size:1.5rem;font-weight:bold;margin:8px 0;">8805</div>
            <div style="color:#555;margin-bottom:8px;">Account Title: Viral Loop</div>
            <div style="font-size:1.3rem;font-weight:bold;color:#c0392b;">Amount: Rs. ${state.selectedPackage.priceInRs || (state.selectedPackage.price * 278)} (≈ $${state.selectedPackage.price})</div>
            <div style="margin-top:10px; text-align:center;">
                <img src="/qr_jazzcash.jpg" alt="JazzCash QR" style="max-width:200px; border-radius:10px; border:2px solid var(--primary);">
                <div style="color:var(--text-sub); font-size:0.9rem; margin-top:5px;">Scan to Pay via JazzCash App</div>
            </div>
        `;
    } else if (method === 'creem') {
        det.innerHTML = `
            <h3 style="margin-bottom:15px;font-size:1.1rem;color:#7C3AED"><i class="fas fa-credit-card"></i> Pay via Credit/Debit Card</h3>
            <div style="background:var(--card-solid); padding:15px; border-radius:10px; border:1px solid #444; margin-bottom:10px;">
                <div class="form-group" style="margin-bottom:10px;">
                    <label style="display:block;margin-bottom:5px;font-size:0.85rem;color:#aaa;">Cardholder Name *</label>
                    <input type="text" class="form-input" placeholder="e.g. John Doe" style="width:100%;">
                </div>
                <div class="form-group" style="margin-bottom:10px;">
                    <label style="display:block;margin-bottom:5px;font-size:0.85rem;color:#aaa;">Card Number *</label>
                    <div style="position:relative;">
                        <i class="fas fa-credit-card" style="position:absolute;left:10px;top:12px;color:#777;"></i>
                        <input type="text" class="form-input" placeholder="0000 0000 0000 0000" style="width:100%; padding-left:35px;" maxlength="19">
                    </div>
                </div>
                <div style="display:flex; gap:10px;">
                    <div class="form-group" style="flex:1;">
                        <label style="display:block;margin-bottom:5px;font-size:0.85rem;color:#aaa;">Expiry (MM/YY) *</label>
                        <input type="text" class="form-input" placeholder="MM/YY" style="width:100%;" maxlength="5">
                    </div>
                    <div class="form-group" style="flex:1;">
                        <label style="display:block;margin-bottom:5px;font-size:0.85rem;color:#aaa;">CVV *</label>
                        <input type="password" class="form-input" placeholder="123" style="width:100%;" maxlength="4">
                    </div>
                </div>
            </div>
            <div style="font-size:1.3rem;font-weight:bold;color:#7C3AED;text-align:right;">Total to Pay: $${state.selectedPackage.price}</div>
            <div style="margin-top:5px; color:#aaa; font-size:0.75rem; text-align:right;"><i class="fas fa-lock"></i> Secured by Creem Gateway</div>
        `;
    } else {
        det.innerHTML = `
            <h3 style="margin-bottom:10px;font-size:1.1rem;color:var(--gold)">Send via Binance / TrustWallet (USDT)</h3>
            <div style="font-size:1rem;font-weight:bold;margin:8px 0; word-break: break-all; background:var(--card-bg); padding:10px; border-radius:5px; border:1px dashed var(--gold);">0xBf6ad9057E4663245E19830B84752B046c0575CC</div>
            <div style="color:#555;margin-bottom:8px;">Coin & Network: <strong style="color:var(--gold)">USDT (ERC20)</strong> <br>Account Title: Viral Loop</div>
            <div style="font-size:1.3rem;font-weight:bold;color:#c0392b;">Amount: $${state.selectedPackage.price}</div>
            <div style="margin-top:10px; text-align:center;">
                <img src="/qr_usdt.jpg" alt="USDT QR" style="max-width:200px; border-radius:10px; border:2px solid var(--gold);">
                <div style="color:var(--text-sub); font-size:0.9rem; margin-top:5px;">Scan to Pay via Crypto Wallet</div>
            </div>
        `;
    }

    document.querySelectorAll('.payment-method').forEach(el => el.style.borderColor = 'var(--border-main)');
    if (method === 'jazzcash') event.currentTarget.style.borderColor = 'var(--primary)';
    else if (method === 'creem') event.currentTarget.style.borderColor = '#7C3AED';
    else event.currentTarget.style.borderColor = 'var(--gold)';

    document.getElementById('paymentFormSection').classList.add('active');
    
    // Hide proof inputs for Creem
    const proofSection = document.getElementById('paymentProofSection');
    if (proofSection) {
        proofSection.style.display = method === 'creem' ? 'none' : 'block';
    }
    
    // Change button text
    const submitBtn = document.getElementById('paymentSubmitBtn');
    if (submitBtn) {
        submitBtn.innerHTML = method === 'creem' ? '<i class="fas fa-lock"></i> Pay Securely' : 'Submit Payment Proof';
    }
}
function handlePaymentScreenshot(input) {
    if (input.files && input.files[0]) {
        const reader = new FileReader();
        reader.onload = function(e) {
            document.getElementById('paymentPreviewImg').src = e.target.result;
            document.getElementById('paymentPreview').style.display = 'block';
            document.getElementById('paymentFileLabel').innerText = input.files[0].name;
        };
        reader.readAsDataURL(input.files[0]);
    }
}
async function submitPayment() {
    const method = state.selectedPaymentMethod;
    
    // Auto-checkout for Creem
    if (method === 'creem') {
        const btn = document.getElementById('paymentSubmitBtn');
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Redirecting...';
        btn.disabled = true;
        try {
            const res = await api.store.creemCheckout({ 
                amount: state.selectedPackage.coins, 
                price: state.selectedPackage.price 
            });
            if (res.checkout_url) {
                window.location.href = res.checkout_url;
                return;
            } else {
                throw new Error("Checkout URL not found");
            }
        } catch (e) {
            btn.innerHTML = '<i class="fas fa-lock"></i> Pay Securely';
            btn.disabled = false;
            return showToast(e.message || 'Failed to start checkout process.', 'error');
        }
    }

    const txId = document.getElementById('paymentTxId').value.trim();
    const screenshot = document.getElementById('paymentScreenshot').files[0];
    const targetUrl = document.getElementById('directTargetUrl').value.trim();

    if (state.directOrder && !targetUrl) return showToast('Please enter the Target URL', 'error');
    if (!txId) return showToast('Please enter the Transaction ID (TID / TxID)', 'error');
    
    // TXID Validation
    if (method === 'jazzcash') {
        if (!/^\d{11,12}$/.test(txId)) {
            return showToast('Invalid TID! EasyPaisa/JazzCash TID must be exactly 11 or 12 numbers (no English letters).', 'error');
        }
    } else if (method === 'binance') {
        if (txId.length < 8) {
            return showToast('Invalid Binance TxID or Pay ID!', 'error');
        }
    }

    if (!screenshot) return showToast('Please upload payment screenshot', 'error');
    if (!state.selectedPackage) return showToast('Please select a package', 'error');

    const btn = document.getElementById('paymentSubmitBtn');
    btn.disabled = true;
    btn.innerHTML = '<div class="loading-spinner"></div> Submitting...';

    try {
        const fd = new FormData();
        fd.append('screenshot', screenshot);
        
        // 1. First upload the screenshot
        const uploadRes = await api.request('/upload', { method: 'POST', body: fd });
        if (uploadRes.error) throw new Error(uploadRes.error);
        const proofImg = uploadRes.fileUrl;

        // 2. Submit the order (either Direct Order or Deposit)
        let res;
        if (state.directOrder) {
            const orderData = {
                platform: state.directOrder.platform,
                pkgName: state.directOrder.pkgName,
                price: state.selectedPackage.price,
                method: state.selectedPaymentMethod,
                txId: txId,
                proofImg: proofImg,
                targetUrl: targetUrl
            };
            res = await api.store.directOrder(orderData);
        } else {
            const depositData = {
                amount: state.selectedPackage.coins,
                price: state.selectedPackage.price,
                method: state.selectedPaymentMethod,
                txId: txId,
                proofImg: proofImg
            };
            res = await api.store.deposit(depositData);
        }
        
        if (res.error) throw new Error(res.error);

        closePaymentModal();
        showToast('Payment submitted! Admin will verify in 24hrs. ✅', 'success');
    } catch(e) {
        showToast(e.message || 'Payment submission failed', 'error');
    } finally {
        btn.disabled = false;
        btn.innerHTML = '<i class="fas fa-check"></i> I Have Paid - Submit for Verification';
    }
}

// ===== INFO PAGES =====
const privacyContent = `
<h2>Privacy Policy</h2>
<p>Last updated: 2025</p>
<h3>Data Collection</h3>
<p>We collect email addresses and usage data to provide our service. Your data is never sold to third parties.</p>
<h3>Cookies</h3>
<p>We use localStorage to keep you logged in. No tracking cookies are used.</p>
<h3>Security</h3>
<p>Passwords are hashed. Screenshots are stored securely.</p>
<h3>Contact</h3>
<p>Email: viraloopteem@gmail.com</p>
`;
const termsContent = `
<h2>Terms of Service</h2>
<h3>1. Acceptance of Terms</h3>
<p>By accessing and using ViralLoop, you accept and agree to be bound by the terms and provision of this agreement.</p>
<h3>2. User Conduct</h3>
<p>You agree to use the service for lawful purposes only and in a way that does not infringe the rights of, restrict or inhibit anyone else's use and enjoyment of the website.</p>
<h3>3. Account Termination</h3>
<p>We reserve the right to terminate or suspend access to our service immediately, without prior notice or liability, for any reason whatsoever, including without limitation if you breach the Terms.</p>
`;
const contactContent = `
<h2>Contact Us</h2>
<p>If you have any questions, concerns, or need support regarding our services, please feel free to reach out to us.</p>
<p><strong>Email Support:</strong> viraloopteem@gmail.com</p>
<p>We aim to respond to all inquiries within 24-48 hours. For faster resolution, please include your User ID (UID) when emailing us regarding account issues.</p>
`;
const disclaimerContent = `
<h2>Disclaimer</h2>
<h3>Platform Risk</h3>
<p>Exchanging follows/likes may violate third-party platform Terms of Service. ViralLoop is not responsible for any account restrictions imposed by YouTube, TikTok, Facebook, Instagram, or other platforms.</p>
<h3>Coin Value</h3>
<p>Coins are virtual credits with no guaranteed monetary value. Coin-to-cash rates may change.</p>
<h3>Fraud Prevention</h3>
<p>Fake screenshots will result in permanent account ban without refund.</p>
`;

function buildInfoPage(title, content) {
    return `<div class="animate-fade"><div class="info-page-content">${content}</div></div>`;
}
function buildRateUsPage() {
    return `<div class="animate-fade">
        <div class="info-page-content" style="text-align:center;">
            <h2><i class="fas fa-star"></i> Rate Us</h2>
            <p style="color:var(--gray);margin-bottom:20px;">How would you rate ViralLoop?</p>
            <div class="rating-stars" id="ratingStars">
                ${[1,2,3,4,5].map(i => `<span onclick="setRating(${i})" id="star${i}">⭐</span>`).join('')}
            </div>
            <div id="ratingMsg" style="color:var(--gray);min-height:30px;"></div>
            <button onclick="submitRating()" style="background:var(--primary);color:#fff;border:none;padding:14px 30px;border-radius:12px;font-weight:bold;cursor:pointer;margin-top:20px;font-size:1rem;">
                <i class="fas fa-paper-plane"></i> Submit Rating
            </button>
        </div>
    </div>`;
}
window.setRating = function(val) {
    state.rating = val;
    const msgs = ['','Very Poor','Poor','Average','Good','Excellent! 🎉'];
    document.getElementById('ratingMsg').innerText = msgs[val];
};
window.submitRating = function() {
    if (!state.rating) return showToast('Please select a rating', 'error');
    showToast(`Thank you for rating us ${state.rating}/5! ⭐`);
};

// ===== APP INIT =====
async function initApp() {
    // Load saved theme
    if (localStorage.getItem('theme') === 'light') {
        document.body.dataset.theme = 'light';
        const icon = document.getElementById('themeToggleBtn');
        if (icon) icon.querySelector('i').className = 'fas fa-sun';
    }

    const token = localStorage.getItem('token');
    if (token) {
        try {
            const res = await api.auth.me();
            state.user = res.user;
            document.getElementById('userAuthModal').classList.remove('active');
            initUserUI();
            
            // Check for Creem Checkout return
            const urlParams = new URLSearchParams(window.location.search);
            const creemSessionId = urlParams.get('creem_session_id');
            const creemAmount = urlParams.get('amount');
            
            if (creemSessionId) {
                showToast('Verifying Credit/Debit Card Payment... Please wait.');
                try {
                    const verifyRes = await api.store.creemVerify({ session_id: creemSessionId, amount: creemAmount });
                    if (verifyRes.success) {
                        showToast(verifyRes.message || 'Payment Successful! Coins added.', 'success');
                        state.user.coins_balance = verifyRes.coins;
                        updateCoinDisplay(verifyRes.coins);
                    }
                } catch (e) {
                    showToast(e.message || 'Payment verification failed or pending.', 'error');
                }
                window.history.replaceState({}, document.title, window.location.pathname);
            }

            const savedPage = localStorage.getItem('currentPage') || 'home';
            showPage(savedPage);
        } catch (e) {
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
    }

    // Check for Global Popup and Voice Announcement
    try {
        const config = await api.request('/config', { method: 'GET' });
        
        // Popup
        if (config && config.isPopupEnabled && config.popupImageUrl) {
            document.getElementById('globalPopupImg').src = config.popupImageUrl;
            if (config.popupText) {
                document.getElementById('globalPopupText').innerText = config.popupText;
                document.getElementById('globalPopupTextContainer').style.display = 'block';
            }
            document.getElementById('globalPopupModal').classList.add('active');
        }
        
        // Voice Announcement
        if (config && config.voiceNoteUrl && config.voiceNoteDate) {
            const uploadDate = new Date(config.voiceNoteDate);
            const now = new Date();
            const daysDiff = (now - uploadDate) / (1000 * 60 * 60 * 24);
            
            if (daysDiff <= 5) {
                document.getElementById('voiceAnnounceBtn').style.display = 'inline-flex';
                document.getElementById('globalVoicePlayer').src = config.voiceNoteUrl;
                
                const lastPlayed = state.user?.lastVoicePlayedAt ? new Date(state.user.lastVoicePlayedAt) : new Date(0);
                if (lastPlayed < uploadDate) {
                    document.getElementById('voiceBadge').style.display = 'block';
                } else {
                    document.getElementById('voiceBadge').style.display = 'none';
                }
            } else {
                document.getElementById('voiceAnnounceBtn').style.display = 'none';
            }
        }
    } catch(e) {
        console.log("Could not load config", e);
    }
}

window.onload = initApp;

// Heartbeat Interval
setInterval(async () => {
    if (localStorage.getItem('token')) {
        fetch(`${API_URL}/users/heartbeat`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        }).catch(e => console.log('Heartbeat failed'));

        try {
            const meRes = await api.auth.me();
            if (meRes && meRes.user) {
                state.user = meRes.user;
                updateCoinDisplay(state.user.coins);
            }
        } catch(e) {}

        // Also poll notifications
        loadNotifications();

        // Auto refresh My Campaigns page if we are on it and review modal is not open
        if (state.currentPage === 'mychannel' && !document.getElementById('ownerReviewModal')) {
            buildMyChannelPage().then(h => {
                const app = document.getElementById('app');
                if (app && state.currentPage === 'mychannel') app.innerHTML = h;
            });
        }
    }
}, 15000); 

// ===== CHAT WIDGET LOGIC =====
let chatInterval = null;
window.toggleChatWidget = function() {
    const w = document.getElementById('chatWidget');
    if (w.classList.contains('hidden')) {
        w.classList.remove('hidden');
        loadChatMessages();
        chatInterval = setInterval(loadChatMessages, 5000);
    } else {
        w.classList.add('hidden');
        if (chatInterval) clearInterval(chatInterval);
    }
}

async function loadChatMessages() {
    if (!localStorage.getItem('token')) return;
    try {
        const res = await fetch(`${API_URL}/chat`, {
            headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        });
        if(!res.ok) throw new Error("Failed to fetch chat");
        const msgs = await res.json();
        const container = document.getElementById('chatMessages');
        container.innerHTML = msgs.map(m => {
            const isMe = m.userId === state.user?.id;
            const d = new Date(m.createdAt);
            const timeStr = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            const dateStr = d.toLocaleDateString([], { month: 'short', day: 'numeric' });
            
            return `
                <div class="chat-message ${isMe ? 'self' : ''}" style="margin-bottom:12px;">
                    <div class="chat-meta" style="display:flex; justify-content:space-between; align-items:center;">
                        <div>
                            ${m.user && m.user.role === 'admin' ? '<i class="fas fa-crown" style="color:#ffed4e;"></i>' : (m.user && m.user.isVIP ? '<i class="fas fa-star" style="color:var(--gold);"></i>' : '')} 
                            <b style="color:${m.user && m.user.role === 'admin' ? '#ff4757' : 'inherit'}">
                                ${m.user && m.user.role === 'admin' ? '<span style="background:#ff4757;color:#fff;padding:2px 5px;border-radius:5px;font-size:0.7rem;">ADMIN</span> ' : ''}${m.user ? m.user.name : 'Unknown User'}
                            </b>
                        </div>
                        <span style="font-size:0.65rem; color:var(--gray); margin-left:8px;">${dateStr}, ${timeStr}</span>
                    </div>
                    <div style="color:var(--text-main); margin-top:4px;">${m.message}</div>
                </div>
            `;
        }).join('');
        container.scrollTop = container.scrollHeight;
    } catch(e) {
        console.error("Chat Error:", e);
    }
}

window.sendChatMessage = async function() {
    const input = document.getElementById('chatInput');
    const msg = input.value.trim();
    if (!msg) return;
    input.value = '';
    
    try {
        const res = await fetch(`${API_URL}/chat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('token')}` },
            body: JSON.stringify({ message: msg })
        });
        if(!res.ok) {
            const err = await res.json();
            throw new Error(err.error || "Failed to send message");
        }
        loadChatMessages();
    } catch(e) {
        showToast(e.message, 'error');
    }
}

// Register PWA Service Worker
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js')
            .then(reg => console.log('Service Worker registered', reg))
            .catch(err => console.error('Service Worker registration failed', err));
    });
}

window.deleteAdminOtherApp = async function(id) {
    if (!confirm('Delete this app link?')) return;
    try {
        await api.request(/other-apps/, { method: 'DELETE' });
        showToast('Deleted successfully', 'success');
        loadSuperAdminTab('otherApps', document.querySelector('.tab.active'));
    } catch(e) {
        showToast(e.message, 'error');
    }
};

window.addAdminTutorialLink = async function() {
    try {
        const title = document.getElementById('adminTutorialTitle').value.trim();
        const url = document.getElementById('adminTutorialUrl').value.trim();
        if (!title || !url) return showToast('Please enter both title and URL', 'error');
        await api.request('/tutorial-links', { method: 'POST', body: JSON.stringify({ title, url }) });
        showToast('Tutorial link added successfully!', 'success');
        loadSuperAdminTab('tutorialLinks', document.querySelector('.tab.active'));
    } catch(e) {
        showToast(e.message, 'error');
    }
};

window.deleteAdminTutorialLink = async function(id) {
    if (!confirm('Delete this tutorial link?')) return;
    try {
        await api.request(/tutorial-links/, { method: 'DELETE' });
        showToast('Deleted successfully', 'success');
        loadSuperAdminTab('tutorialLinks', document.querySelector('.tab.active'));
    } catch(e) {
        showToast(e.message, 'error');
    }
};
