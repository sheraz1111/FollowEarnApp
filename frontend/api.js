const API_BASE = '/api';

const api = {
    request: async (endpoint, options = {}) => {
        const token = localStorage.getItem('token');
        const headers = { ...options.headers };

        if (token) headers['Authorization'] = `Bearer ${token}`;

        if (!(options.body instanceof FormData)) {
            headers['Content-Type'] = 'application/json';
            if (options.body && typeof options.body === 'object') {
                options.body = JSON.stringify(options.body);
            }
        }

        const response = await fetch(`${API_BASE}${endpoint}`, { ...options, headers });
        const data = await response.json().catch(() => ({}));

        if (!response.ok) throw new Error(data.error || `Error ${response.status}`);
        return data;
    },

    auth: {
        login:          (email, password) => api.request('/login',    { method: 'POST', body: { email, password } }),
        googleLogin:    (credential) => api.request('/auth/google', { method: 'POST', body: { credential } }),
        register:       (name, email, password) => api.request('/register', { method: 'POST', body: { name, email, password } }),
        forgotPassword: (email) => api.request('/auth/forgot-password', { method: 'POST', body: { email } }),
        resetPassword:  (email, code, newPassword) => api.request('/auth/reset-password', { method: 'POST', body: { email, code, newPassword } }),
        updateProfile:  (name) => api.request('/users/update-profile', { method: 'POST', body: { name } }),
        changePassword: (currentPassword, newPassword) => api.request('/users/change-password', { method: 'POST', body: { currentPassword, newPassword } }),
        me:             () => api.request('/me')
    },

    requests: {
        list:   () => api.request('/requests'),
        mine:   () => api.request('/requests/mine'),
        create: (data) => api.request('/requests', { method: 'POST', body: data })
    },

    platforms: {
        list: () => api.request('/platforms')
    },

    submissions: {
        upload:      (formData) => api.request('/submissions',                { method: 'POST',  body: formData }),
        mine:        ()         => api.request('/submissions/mine'),
        myCampaigns: ()         => api.request('/submissions/my-campaigns'),
        getPending:  ()         => api.request('/submissions/pending'),
        approve:     (id)       => api.request(`/submissions/${id}/approve`,  { method: 'PATCH' }),
        reject:      (id)       => api.request(`/submissions/${id}/reject`,   { method: 'PATCH' })
    },

    notifications: {
        list: () => api.request('/notifications'),
        markRead: () => api.request('/notifications/read', { method: 'PATCH' })
    },

    wallet: {
        transactions: () => api.request('/wallet/transactions')
    },

    store: {
        buyCoins: (amount) => api.request('/store/buy-coins', { method: 'POST', body: { amount } }),
        buyVip: () => api.request('/store/buy-vip', { method: 'POST' }),
        deposit: (data) => api.request('/store/deposit', { method: 'POST', body: data }),
        directOrder: (data) => api.request('/store/direct-order', { method: 'POST', body: data }),
        creemCheckout: (data) => api.request('/store/creem-checkout', { method: 'POST', body: data }),
        creemVerify: (data) => api.request('/store/creem-verify', { method: 'POST', body: data })
    },

    admin: {
        users:    ()         => api.request('/admin/users'),
        ban:      (id)       => api.request(`/admin/users/${id}/ban`, { method: 'PATCH' }),
        addCoins: (id, amount) => api.request(`/admin/users/${id}/add-coins`, { method: 'POST', body: { amount } }),
        deposits: ()         => api.request('/admin/deposits'),
        approveDeposit: (id) => api.request(`/admin/deposits/${id}/approve`, { method: 'PATCH' }),
        rejectDeposit: (id)  => api.request(`/admin/deposits/${id}/reject`, { method: 'PATCH' }),
        directOrders: ()     => api.request('/admin/direct-orders'),
        processDirectOrder: (id, status) => api.request(`/admin/direct-orders/${id}/process`, { method: 'PATCH', body: { status } })
    },

    payment: {
        submit: (formData) => api.request('/payment/submit', { method: 'POST', body: formData })
    },

    metadata: {
        fetch: (url) => api.request(`/metadata?url=${encodeURIComponent(url)}`)
    }
};
