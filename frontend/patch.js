
// ===== WALLET LOGIC =====
function openWalletModal() {
    document.getElementById('walletModal').style.display = 'flex';
    document.getElementById('walletGemsAmount').innerText = state.user ? (state.user.gems || 0) : 0;
    showWalletTab('convert');
}

function closeWalletModal() {
    document.getElementById('walletModal').style.display = 'none';
}

function showWalletTab(tab) {
    if (tab === 'convert') {
        document.getElementById('walletConvertSection').style.display = 'block';
        document.getElementById('walletWithdrawSection').style.display = 'none';
        document.getElementById('walletTabConvert').style.background = 'var(--primary)';
        document.getElementById('walletTabConvert').style.color = '#fff';
        document.getElementById('walletTabWithdraw').style.background = '#333';
        document.getElementById('walletTabWithdraw').style.color = 'var(--gray)';
    } else {
        document.getElementById('walletConvertSection').style.display = 'none';
        document.getElementById('walletWithdrawSection').style.display = 'block';
        document.getElementById('walletTabConvert').style.background = '#333';
        document.getElementById('walletTabConvert').style.color = 'var(--gray)';
        document.getElementById('walletTabWithdraw').style.background = 'var(--primary)';
        document.getElementById('walletTabWithdraw').style.color = '#fff';
        
        const gems = state.user ? (state.user.gems || 0) : 0;
        const withdrawBtn = document.getElementById('withdrawBtn');
        if (gems >= 5000) {
            withdrawBtn.style.opacity = '1';
            withdrawBtn.style.pointerEvents = 'auto';
            withdrawBtn.innerText = 'Request Withdrawal';
        } else {
            withdrawBtn.style.opacity = '0.5';
            withdrawBtn.style.pointerEvents = 'none';
            withdrawBtn.innerText = 'Request Withdrawal (Need 5,000 Gems)';
        }
    }
}

function updateConvertPreview() {
    const input = document.getElementById('convertGemsInput').value;
    const gems = parseInt(input) || 0;
    document.getElementById('convertCoinsPreview').innerText = gems * 5;
}

async function submitGemsConversion() {
    const input = document.getElementById('convertGemsInput').value;
    const gemsToConvert = parseInt(input);
    if (!gemsToConvert || gemsToConvert <= 0) return showToast('Please enter a valid amount', 'error');
    if (gemsToConvert > (state.user.gems || 0)) return showToast('Insufficient Gems!', 'error');
    
    try {
        const res = await fetch(`${API_URL}/wallet/convert`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('token')}` },
            body: JSON.stringify({ gemsToConvert })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Conversion failed');
        
        state.user.gems -= data.convertedGems;
        state.user.coins += data.receivedCoins;
        
        updateCoinDisplay(state.user.coins);
        updateGemsDisplay(state.user.gems);
        document.getElementById('walletGemsAmount').innerText = state.user.gems;
        document.getElementById('convertGemsInput').value = '';
        updateConvertPreview();
        
        showToast(`Success! Converted ${data.convertedGems} Gems to ${data.receivedCoins} Coins!`, 'success');
    } catch(err) {
        showToast(err.message, 'error');
    }
}

async function submitWithdrawal() {
    const method = document.getElementById('withdrawMethodSelect').value;
    const details = document.getElementById('withdrawDetailsInput').value;
    
    if (!details) return showToast('Please enter your payment details', 'error');
    
    try {
        const res = await fetch(`${API_URL}/wallet/withdraw`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('token')}` },
            body: JSON.stringify({ method, details })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Withdrawal failed');
        
        state.user.gems -= 5000;
        updateGemsDisplay(state.user.gems);
        document.getElementById('walletGemsAmount').innerText = state.user.gems;
        document.getElementById('withdrawDetailsInput').value = '';
        showWalletTab('withdraw'); // Re-evaluate button state
        
        showToast('Withdrawal request submitted successfully! Admin will review it.', 'success');
    } catch(err) {
        showToast(err.message, 'error');
    }
}

// ===== INSTRUCTIONS MODAL =====
function openInstructionsModal(encodedInstr) {
    const instr = decodeURIComponent(encodedInstr);
    const modal = document.getElementById('instructionsModal');
    const textEl = document.getElementById('instructionsModalText');
    if(modal && textEl) {
        textEl.innerText = instr;
        modal.style.display = 'flex';
    }
}

function closeInstructionsModal() {
    const modal = document.getElementById('instructionsModal');
    if(modal) modal.style.display = 'none';
}
