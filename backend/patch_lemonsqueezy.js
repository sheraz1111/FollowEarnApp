
// ==========================================
// LemonSqueezy Integration
// ==========================================
const crypto = require('crypto');

// Helper to interact with LemonSqueezy API
async function lsApi(path, method = 'GET', body = null) {
    const key = process.env.LEMONSQUEEZY_API_KEY || 'eyJ0eXAiOiJKV1QiLCJhbGciOiJSUzI1NiJ9.eyJhdWQiOiI5NGQ1OWNlZi1kYmI4LTRlYTUtYjE3OC1kMjU0MGZjZDY5MTkiLCJqdGkiOiIwOGY4NGY5OTljZTVkZjgwNWYyYzI1M2IxZjE1MDJjY2YzOTU5MTkwNjgxN2E1ZGY2MzYxNzFmMmMxMDFjMjFjZDc2MTNhYTNjZmU4OTMyOCIsImlhdCI6MTc4MzczNTgwNi4yNjA5ODcsIm5iZiI6MTc4MzczNTgwNi4yNjA5OSwiZXhwIjoxNzk5NjI1NjAwLjAzOTAzOSwic3ViIjoiNzQ4MjY4OSIsInNjb3BlcyI6W119.oTqwJKTAaWr9Go6asPUQM97K1QRi8bTHKy_Cvdu9yHxHG6RdZ0nr0OrMemJEbuzx3sHN6u38dzhC1K3G2Z79NXAtpV86PlUwY5dsjZu1i4WcSlJpFQG_8jt3T795FmAplw3dYuC_Evn9Bxrj20QaWK-Ez0POks1BaKzd8odKsRhHsKCAv0IVs2AI9cDXSDa8RCs11AmhDLi9Jwp49ISzRfD9_owrPHOxIwIidO5dHMiCb-PESgctkU4JvB1e-1lFHcoetwv4N3z69Aq29_N2Fa_llMnNTsXFmoaSfOVQvkx8VuSRmFnuLMkWaf7SE3vDP2Ojn6ZIa8BoucVzWRtRBRqYeEU0UTPbawIAdWdVy7tJggOgyJH81sFcqeY_gaEAJOazFlq2_P_QXvfoL77D3uHq77M0c487uENh88oy43PuMmmiWWO7VPo6t8oRZTo2TQ6QUkMkEUQ9F1x81XH_J9et5uWGLdZlaJq_w4uDUhYB9LV-1f37XLKCI_mvXxgiKsY4UVpKIo7rxhBcbMsFFnpy3DXhLTh0Fqe0NZrxTfd16lVvQfTH6sPq1bjfIVcniNuyE1G4OmRnuOnIjyzb0PAiNHOzFR9ASBYudJ7BD5B1CqeUf-ffI6JEG7wum039hbbf0eOr_o1tJpE8F0wEm-YCGIgrqlemp6cRdcT1Zr0';
    
    const options = {
        method,
        headers: {
            'Accept': 'application/vnd.api+json',
            'Content-Type': 'application/vnd.api+json',
            'Authorization': 'Bearer ' + key
        }
    };
    if (body) options.body = JSON.stringify(body);
    
    const res = await fetch(`https://api.lemonsqueezy.com/v1${path}`, options);
    if (!res.ok) {
        const text = await res.text();
        throw new Error(`LemonSqueezy API error: ${res.status} ${text}`);
    }
    return res.json();
}

app.post('/api/wallet/buy-coins', authenticate, async (req, res) => {
    try {
        const { coins, priceUsd } = req.body;
        const user = await prisma.user.findUnique({ where: { id: req.userId } });
        if (!user) return res.status(404).json({ error: 'User not found' });

        const storeId = process.env.LEMONSQUEEZY_STORE_ID || '419815';

        const payload = {
            data: {
                type: 'checkouts',
                attributes: {
                    custom_price: Math.round(priceUsd * 100),
                    product_options: {
                        name: `${coins.toLocaleString()} Coins - FollowEarn`,
                        description: `Purchase ${coins.toLocaleString()} coins for your FollowEarn campaigns.`,
                        receipt_button_text: 'Return to App',
                        receipt_link_url: 'https://viraloop.website',
                        receipt_thank_you_note: 'Thank you for purchasing coins! They have been added to your account.'
                    },
                    checkout_options: {
                        embed: false,
                        media: false,
                        button_color: '#ffd700'
                    },
                    checkout_data: {
                        email: user.email || '',
                        name: user.name || '',
                        custom: {
                            user_id: user.id.toString(),
                            coins: coins.toString()
                        }
                    }
                },
                relationships: {
                    store: {
                        data: {
                            type: 'stores',
                            id: storeId
                        }
                    },
                    variant: {
                        data: {
                            type: 'variants',
                            id: 'dummy' // we will replace this
                        }
                    }
                }
            }
        };

        const storeProducts = await lsApi(`/products?filter[store_id]=${storeId}`);
        if (!storeProducts.data || storeProducts.data.length === 0) {
            return res.status(400).json({ error: 'No products found in your LemonSqueezy store. Please create at least one dummy product.' });
        }
        
        const productId = storeProducts.data[0].id;
        const productVariants = await lsApi(`/variants?filter[product_id]=${productId}`);
        const variantId = productVariants.data[0].id;

        payload.data.relationships.variant.data.id = variantId.toString();

        const checkoutData = await lsApi('/checkouts', 'POST', payload);
        res.json({ checkoutUrl: checkoutData.data.attributes.url });

    } catch (err) {
        console.error('Buy coins error:', err);
        res.status(500).json({ error: 'Failed to generate checkout link', details: err.message });
    }
});

app.post('/api/lemonsqueezy/webhook', async (req, res) => {
    try {
        const secret = process.env.LEMONSQUEEZY_WEBHOOK_SECRET || 'followearn123xyz';
        const signature = req.headers['x-signature'];

        if (!signature || !req.rawBody) {
            return res.status(400).send('Invalid webhook request');
        }

        const hmac = crypto.createHmac('sha256', secret);
        const digest = Buffer.from(hmac.update(req.rawBody).digest('hex'), 'utf8');
        const signatureBuffer = Buffer.from(signature, 'utf8');

        if (digest.length !== signatureBuffer.length || !crypto.timingSafeEqual(digest, signatureBuffer)) {
            return res.status(401).send('Invalid signature');
        }

        const payload = JSON.parse(req.rawBody.toString('utf8'));

        if (payload.meta.event_name === 'order_created') {
            const customData = payload.meta.custom_data;
            if (customData && customData.user_id && customData.coins) {
                const userId = parseInt(customData.user_id);
                const coinsToAdd = parseInt(customData.coins);

                await prisma.user.update({
                    where: { id: userId },
                    data: { coins_balance: { increment: coinsToAdd } }
                });
                
                console.log(`Webhook: Added ${coinsToAdd} coins to user ${userId}`);
            }
        }

        res.status(200).send('Webhook received');
    } catch (err) {
        console.error('Webhook error:', err);
        res.status(500).send('Webhook handling error');
    }
});
