import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import multer from 'multer';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import crypto from 'crypto';
import nodemailer from 'nodemailer';
import { OAuth2Client } from 'google-auth-library';
import { ApifyClient } from 'apify-client';
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const prisma = new PrismaClient();

app.use(cors());app.use(express.json({ 
    limit: '50mb',
    verify: (req, res, buf) => { req.rawBody = buf; }
}));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir);
}

// Multer config
const storage = multer.memoryStorage();
const upload = multer({ 
    storage,
    limits: { fileSize: 5 * 1024 * 1024 } // 5MB max limit
});

const JWT_SECRET = process.env.JWT_SECRET || 'fallback-secret-for-mvp';

// --- MIDDLEWARE ---
const authenticate = (req, res, next) => {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'Unauthorized' });

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) return res.status(403).json({ error: 'Forbidden' });
        req.user = user;
        next();
    });
};

const isAdmin = (req, res, next) => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin access required' });
    next();
};

// --- AUTH ROUTES ---
app.post('/api/register', async (req, res) => {
    try {
        const { name, email, password, referralCode } = req.body;
        if (!email.toLowerCase().endsWith('@gmail.com')) {
            return res.status(400).json({ error: 'Only @gmail.com emails are allowed for registration.' });
        }
        
        const password_hash = await bcrypt.hash(password, 10);
        const role = email.toLowerCase() === 'poetry060@gmail.com' ? 'admin' : 'user';
        const myReferralCode = crypto.randomBytes(4).toString('hex').toUpperCase();
        
        let referredById = null;
        if (referralCode) {
            const referrer = await prisma.user.findUnique({ where: { referralCode } });
            if (referrer) {
                referredById = referrer.id;
            }
        }

        const country = req.headers['x-vercel-ip-country'] || 'Unknown';
        const user = await prisma.user.create({
            data: { name, email, password_hash, role, coins_balance: 50, referralCode: myReferralCode, referredById, lastSeen: new Date(), country }
        });
        const token = jwt.sign({ id: user.id, role: user.role }, JWT_SECRET);
        res.json({ token, user: { id: user.id, name: user.name, email: user.email, role: user.role, coins: user.coins_balance, gems: user.gems, lastVoicePlayedAt: user.lastVoicePlayedAt } });
    } catch (err) {
        res.status(400).json({ error: 'Email already exists or invalid data' });
    }
});

app.post('/api/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        if (!email || !password) {
            return res.status(400).json({ error: 'Email and password required' });
        }
        let user = await prisma.user.findUnique({ where: { email } });
        if (!user || !(await bcrypt.compare(password, user.password_hash))) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }
        
        // Auto-upgrade admin
        if (email.toLowerCase() === 'poetry060@gmail.com' && user.role !== 'admin') {
            user = await prisma.user.update({
                where: { id: user.id },
                data: { role: 'admin' }
            });
        }

        if (user.status === 'banned') {
            return res.status(403).json({ error: 'Account banned' });
        }
        
        // Update lastSeen and country
        const country = req.headers['x-vercel-ip-country'] || 'Unknown';
        await prisma.user.update({
            where: { id: user.id },
            data: { lastSeen: new Date(), country }
        });

        const token = jwt.sign({ id: user.id, role: user.role }, JWT_SECRET);
        res.json({ token, user: { id: user.id, name: user.name, role: user.role, coins: user.coins_balance, gems: user.gems, lastVoicePlayedAt: user.lastVoicePlayedAt, tiktokUsername: user.tiktokUsername, youtubeChannelUrl: user.youtubeChannelUrl, instagramUsername: user.instagramUsername } });
    } catch (e) {
        console.error('Login error:', e);
        res.status(500).json({ error: 'Internal server error during login.' });
    }
});

app.post('/api/google-login', async (req, res) => {
    const { token: googleJwt } = req.body;
    // In a real app, verify the JWT with google-auth-library
    // For now, we mock parsing the payload
    try {
        const payloadStr = Buffer.from(googleJwt.split('.')[1], 'base64').toString();
        const payload = JSON.parse(payloadStr);
        const { email, name, sub: googleId } = payload;
        
        let user = await prisma.user.findUnique({ where: { email } });
        if (!user) {
            user = await prisma.user.create({
                data: {
                    name,
                    email,
                    password_hash: await bcrypt.hash(Math.random().toString(36), 10), // Random placeholder
                    googleId,
                    lastSeen: new Date()
                }
            });
        } else {
            await prisma.user.update({
                where: { id: user.id },
                data: { lastSeen: new Date() }
            });
        }
        
        const token = jwt.sign({ id: user.id, role: user.role }, JWT_SECRET);
        res.json({ token, user: { id: user.id, name: user.name, role: user.role, coins: user.coins_balance, gems: user.gems, lastVoicePlayedAt: user.lastVoicePlayedAt, tiktokUsername: user.tiktokUsername, youtubeChannelUrl: user.youtubeChannelUrl, instagramUsername: user.instagramUsername } });
    } catch (e) {
        res.status(400).json({ error: 'Invalid Google token' });
    }
});

// Config Endpoints
app.get('/api/config', async (req, res) => {
    try {
        let config = await prisma.systemConfig.findUnique({ where: { id: 1 } });
        if (!config) {
            config = await prisma.systemConfig.create({ data: {} });
        }
        res.json(config);
    } catch (e) {
        console.error('Config get error:', e);
        res.json({ popupImageUrl: null, popupText: null, isPopupEnabled: false }); // Fallback
    }
});

app.post('/api/admin/config', authenticate, isAdmin, async (req, res) => {
    try {
        const { popupImageUrl, popupText, isPopupEnabled } = req.body;
        const config = await prisma.systemConfig.upsert({
            where: { id: 1 },
            update: { popupImageUrl, popupText, isPopupEnabled },
            create: { popupImageUrl, popupText, isPopupEnabled }
        });
        res.json({ message: 'Config updated', config });
    } catch (e) {
        console.error('Config update error:', e);
        res.status(500).json({ error: 'Internal server error updating config.' });
    }
});

app.post('/api/admin/voice', authenticate, isAdmin, async (req, res) => {
    try {
        const { voiceNoteUrl } = req.body;
        const config = await prisma.systemConfig.upsert({
            where: { id: 1 },
            update: { voiceNoteUrl, voiceNoteDate: new Date() },
            create: { voiceNoteUrl, voiceNoteDate: new Date() }
        });
        res.json({ message: 'Voice Note updated', config });
    } catch (e) {
        console.error('Voice update error:', e);
        res.status(500).json({ error: 'Internal server error updating voice note.' });
    }
});

app.post('/api/users/play-voice', authenticate, async (req, res) => {
    try {
        await prisma.user.update({
            where: { id: req.user.id },
            data: { lastVoicePlayedAt: new Date() }
        });
        res.json({ success: true });
    } catch (e) {
        console.error('Play voice error:', e);
        res.status(500).json({ error: 'Internal server error updating voice play status.' });
    }
});

// Forgot Password Flow
app.post('/api/auth/forgot-password', async (req, res) => {
    const { email } = req.body;
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) return res.status(404).json({ error: 'User not found' });

    // Generate a 6-digit code
    const resetToken = Math.floor(100000 + Math.random() * 900000).toString();
    const resetPasswordExpires = new Date(Date.now() + 15 * 60 * 1000); // 15 mins expiry

    await prisma.user.update({
        where: { email },
        data: { resetPasswordToken: resetToken, resetPasswordExpires }
    });

    console.log(`[EMAIL MOCK] Password reset code for ${email} is: ${resetToken}`);
    // Since we don't have SMTP configured yet, return the token in response for testing
    // IN PRODUCTION: Do not return this to frontend, only email it.
    res.json({ success: true, message: 'Reset code generated.', mockCode: resetToken });
});

app.post('/api/auth/reset-password', async (req, res) => {
    const { email, code, newPassword } = req.body;
    const user = await prisma.user.findUnique({ where: { email } });

    if (!user || user.resetPasswordToken !== code) {
        return res.status(400).json({ error: 'Invalid or expired reset code' });
    }

    if (new Date() > new Date(user.resetPasswordExpires)) {
        return res.status(400).json({ error: 'Reset code has expired' });
    }

    const password_hash = await bcrypt.hash(newPassword, 10);
    await prisma.user.update({
        where: { email },
        data: { password_hash, resetPasswordToken: null, resetPasswordExpires: null }
    });

    res.json({ success: true, message: 'Password reset successfully. You can now log in.' });
});

// Google Login Flow
const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID || 'dummy-client-id');

app.post('/api/auth/google', async (req, res) => {
    const { credential } = req.body;
    try {
        // Since we don't have a real CLIENT_ID yet, we might just decode the JWT to mock it.
        // In production, use googleClient.verifyIdToken(...)
        const decoded = jwt.decode(credential);
        if (!decoded || !decoded.email) {
            return res.status(400).json({ error: 'Invalid Google Token' });
        }

        const { email, name, sub: googleId } = decoded;

        let user = await prisma.user.findUnique({ where: { email } });
        if (!user) {
            // Create user
            const dummyPassword = await bcrypt.hash(Math.random().toString(36), 10);
            const country = req.headers['x-vercel-ip-country'] || 'Unknown';
            user = await prisma.user.create({
                data: {
                    name,
                    email,
                    password_hash: dummyPassword,
                    googleId,
                    country,
                    lastSeen: new Date()
                }
            });
        } else {
            // Link existing account to Google if needed, update lastSeen and country
            const country = req.headers['x-vercel-ip-country'] || 'Unknown';
            user = await prisma.user.update({
                where: { email },
                data: { googleId: user.googleId || googleId, lastSeen: new Date(), country }
            });
        }

        if (user.status === 'banned') {
            return res.status(403).json({ error: 'Account banned' });
        }

        const token = jwt.sign({ id: user.id, role: user.role }, JWT_SECRET);
        res.json({ token, user: { id: user.id, name: user.name, role: user.role, coins: user.coins_balance, lastVoicePlayedAt: user.lastVoicePlayedAt, tiktokUsername: user.tiktokUsername, youtubeChannelUrl: user.youtubeChannelUrl, instagramUsername: user.instagramUsername } });
    } catch(err) {
        console.error("Google Auth Error:", err);
        res.status(400).json({ error: 'Google Authentication failed' });
    }
});

app.get('/api/me', authenticate, async (req, res) => {
    const user = await prisma.user.findUnique({ where: { id: req.user.id } });
    res.json({ user: { id: user.id, name: user.name, role: user.role, coins: user.coins_balance, gems: user.gems, referralCode: user.referralCode, isVIP: user.isVIP, uiId: user.uiId, lastVoicePlayedAt: user.lastVoicePlayedAt, tiktokUsername: user.tiktokUsername, youtubeChannelUrl: user.youtubeChannelUrl, instagramUsername: user.instagramUsername } });
});

app.get('/api/admin/direct-orders', authenticate, async (req, res) => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin only' });
    const orders = await prisma.directOrder.findMany({
        orderBy: { createdAt: 'desc' },
        include: { user: { select: { name: true, email: true, id: true, uiId: true } } }
    });
    res.json(orders);
});

app.patch('/api/admin/direct-orders/:id/process', authenticate, async (req, res) => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin only' });
    const orderId = parseInt(req.params.id);
    const { status } = req.body; // 'completed' or 'rejected'
    
    if (status !== 'completed' && status !== 'rejected') {
        return res.status(400).json({ error: 'Invalid status' });
    }

    try {
        const order = await prisma.directOrder.findUnique({ where: { id: orderId } });
        if (!order || order.status !== 'pending') return res.status(400).json({ error: 'Invalid or already processed order' });

        const [updatedOrder] = await prisma.$transaction([
            prisma.directOrder.update({
                where: { id: orderId },
                data: { status }
            }),
            prisma.notification.create({
                data: {
                    userId: order.userId,
                    message: status === 'completed' 
                        ? `Your direct order for ${order.pkgName} has been approved and is being processed!` 
                        : `Your direct order for ${order.pkgName} was rejected. Please contact support if you think this is an error.`
                }
            })
        ]);
        
        return res.json({ message: `Order ${status} successfully`, order: updatedOrder });
    } catch (err) {
        return res.status(500).json({ error: 'Server error' });
    }
});

app.get('/api/admin/stats', authenticate, async (req, res) => {
    const user = await prisma.user.findUnique({ where: { id: req.user.id } });
    res.json({ user: { id: user.id, name: user.name, role: user.role, coins: user.coins_balance, referralCode: user.referralCode, isVIP: user.isVIP } });
});

// --- PLATFORMS ---
app.get('/api/platforms', async (req, res) => {
    try {
        let platforms = await prisma.platform.findMany();
        
        // Auto-seed if empty
        if (platforms.length === 0) {
            console.log("No platforms found. Auto-seeding platforms...");
            const defaultPlatforms = [
                { name: 'YouTube' },
                { name: 'TikTok' },
                { name: 'Instagram' },
                { name: 'Facebook' },
                { name: 'Rumble' },
                { name: 'Kick' },
                { name: 'Twitch' },
                { name: 'X / Twitter' }
            ];
            
            for (const p of defaultPlatforms) {
                try {
                    await prisma.platform.create({ data: p });
                } catch(err) {
                    // Ignore unique constraint errors in case of race condition
                }
            }
            platforms = await prisma.platform.findMany();
        }
        
        // Ensure "Website / App" exists for Custom Campaigns
        let customPlat = platforms.find(p => p.name === 'Website / App' || p.name === 'Website/App');
        if (!customPlat) {
            try {
                customPlat = await prisma.platform.create({ data: { name: 'Website / App' } });
                platforms.push(customPlat);
            } catch(e) {}
        }
        
        res.json(platforms);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Server error' });
    }
});

// --- FOLLOW REQUESTS ---
app.get('/api/requests', async (req, res) => {
    try {
        // Optional auth: if token provided, filter out campaigns completed in the last 24 hours
        let completedRequestIds = [];
        let currentUserId = null;
        const authHeader = req.headers.authorization;
        if (authHeader && authHeader.startsWith('Bearer ')) {
            try {
                const token = authHeader.split(' ')[1];
                const decoded = jwt.verify(token, process.env.JWT_SECRET);
                currentUserId = decoded.id;
                const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
                const mySubmissions = await prisma.submission.findMany({
                    where: { 
                        userId: decoded.id,
                        createdAt: { gte: twentyFourHoursAgo }
                    },
                    select: { requestId: true }
                });
                completedRequestIds = mySubmissions.map(s => s.requestId);
            } catch (e) {
                // Invalid token - treat as guest, show all campaigns
            }
        }

        const requests = await prisma.followRequest.findMany({
            where: { 
                status: 'active', 
                slots_remaining: { gt: 0 },
                ...(currentUserId ? { userId: { not: currentUserId } } : {}),
                ...(completedRequestIds.length > 0 ? { id: { notIn: completedRequestIds } } : {})
            },
            include: { platform: true, user: { select: { name: true, lastSeen: true } } },
            orderBy: [
                { reward_coins: 'desc' },
                { createdAt: 'desc' }
            ]
        });
        res.json(requests);
    } catch (e) {
        console.error("Error fetching requests:", e);
        res.status(500).json({ error: "Failed to fetch requests" });
    }
});

app.get('/api/requests/mine', authenticate, async (req, res) => {
    const requests = await prisma.followRequest.findMany({
        where: { userId: req.user.id, status: { not: 'deleted' } },
        include: { platform: true }
    });
    res.json(requests);
});

app.delete('/api/requests/:id', authenticate, async (req, res) => {
    const reqId = parseInt(req.params.id);
    const campaign = await prisma.followRequest.findUnique({ where: { id: reqId } });

    if (!campaign || campaign.userId !== req.user.id) {
        return res.status(403).json({ error: 'Unauthorized or not found' });
    }

    let refund = 0;
    // Only refund if it was active and had slots left
    if (campaign.status === 'active' && campaign.slots_remaining > 0) {
        refund = campaign.slots_remaining * campaign.reward_coins;
    }

    await prisma.$transaction(async (tx) => {
        await tx.followRequest.update({
            where: { id: reqId },
            data: { status: 'deleted', slots_remaining: 0 }
        });

        if (refund > 0) {
            await tx.user.update({
                where: { id: req.user.id },
                data: { coins_balance: { increment: refund } }
            });
            await tx.transaction.create({
                data: { userId: req.user.id, type: 'earn', amount: refund }
            });
        }
    });

    res.json({ success: true, refunded: refund });
});

// Save Social Accounts
app.post('/api/users/social-accounts', authenticate, async (req, res) => {
    const { tiktokUsername, youtubeChannelUrl, instagramUsername } = req.body;
    try {
        let updateData = {};
        if (tiktokUsername !== undefined) updateData.tiktokUsername = tiktokUsername;
        if (youtubeChannelUrl !== undefined) updateData.youtubeChannelUrl = youtubeChannelUrl;
        if (instagramUsername !== undefined) updateData.instagramUsername = instagramUsername;

        await prisma.user.update({
            where: { id: req.user.id },
            data: updateData
        });
        res.json({ message: 'Social accounts updated successfully' });
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: 'Server error updating accounts' });
    }
});

// Auto Verify Task via Apify
app.post('/api/tasks/verify-auto', authenticate, async (req, res) => {
    const { requestId } = req.body;
    try {
        const user = await prisma.user.findUnique({ where: { id: req.user.id } });
        const request = await prisma.followRequest.findUnique({ 
            where: { id: parseInt(requestId) },
            include: { platform: true }
        });

        if (!request || request.status !== 'active') return res.status(400).json({ error: 'Task not available' });
        if (request.verificationType !== 'auto') return res.status(400).json({ error: 'This task requires manual screenshot verification' });

        // Simple placeholder logic. You will need to implement specific Apify Actor calls here.
        // const apifyClient = new ApifyClient({ token: process.env.APIFY_API_TOKEN });
        // Example: await apifyClient.actor('actor_id').call({ ... });
        
        // Simulating verification success for now
        let isVerified = true;
        
        if (!isVerified) {
            return res.status(400).json({ error: 'Verification failed. We could not find your username in the list.' });
        }

        // Process successful verification
        await prisma.$transaction([
            prisma.submission.create({
                data: {
                    userId: req.user.id,
                    requestId: request.id,
                    screenshot_url: 'AUTO_VERIFIED',
                    status: 'approved',
                    reward_coins: request.reward_coins
                }
            }),
            prisma.user.update({
                where: { id: req.user.id },
                data: { coins_balance: { increment: request.reward_coins }, totalTasksCompleted: { increment: 1 } }
            }),
            prisma.followRequest.update({
                where: { id: request.id },
                data: {
                    completed_slots: { increment: 1 },
                    status: request.completed_slots + 1 >= request.total_slots ? 'completed' : 'active'
                }
            })
        ]);

        res.json({ message: 'Verified successfully!', coins: request.reward_coins });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error during auto verification' });
    }
});

app.post('/api/requests', authenticate, async (req, res) => {
    let { platformId, target_link, reward_coins, slots, type, auto_approve_hours, verificationType, timer_seconds } = req.body;
    
    // Validate timer and force exact reward coins for website surfing
    timer_seconds = timer_seconds ? parseInt(timer_seconds) : 0;
    if (type === 'website') {
        if (timer_seconds === 15) reward_coins = 10;
        else if (timer_seconds === 30) reward_coins = 15;
        else if (timer_seconds === 60) reward_coins = 25;
        else if (timer_seconds === 300) reward_coins = 70;
        else if (timer_seconds === 600) reward_coins = 120;
        else return res.status(400).json({ error: 'Invalid timer duration selected.' });
    } else if (type === 'custom') {
        // Allow custom reward_coins for custom tasks, with a minimum of 15
        reward_coins = parseInt(reward_coins);
        if (isNaN(reward_coins) || reward_coins < 15) {
            return res.status(400).json({ error: 'Custom tasks require a minimum of 15 coins per task.' });
        }
    }
    
    const totalCost = reward_coins * slots;
    
    // Check balance
    const user = await prisma.user.findUnique({ where: { id: req.user.id } });
    if (user.coins_balance < totalCost) {
        return res.status(400).json({ error: 'Insufficient coins' });
    }

    // Deduct coins & create request transaction
    const bonusGems = Math.floor(totalCost / 100);

    let transactionOperations = [
        prisma.user.update({
            where: { id: req.user.id },
            data: { 
                coins_balance: { decrement: totalCost },
                totalCampaignsRun: { increment: 1 },
                gems: { increment: bonusGems }
            }
        }),
        prisma.transaction.create({
            data: { userId: req.user.id, type: 'spend', amount: totalCost }
        }),
        prisma.followRequest.create({
            data: {
                userId: req.user.id,
                platformId: parseInt(platformId),
                target_link,
                reward_coins: parseInt(reward_coins),
                slots_remaining: parseInt(slots),
                total_slots: parseInt(slots),
                auto_approve_hours: parseFloat(auto_approve_hours) || 24,
                timer_seconds: timer_seconds,
                type: type || 'subscribe',
                verificationType: verificationType === 'auto' ? 'auto' : 'manual'
            }
        })
    ];

    // Check if this is the user's 2nd campaign and they were referred
    if (user.totalCampaignsRun === 1 && user.referredById) {
        transactionOperations.push(
            prisma.user.update({
                where: { id: user.referredById },
                data: { coins_balance: { increment: 150 } }
            }),
            prisma.transaction.create({
                data: { userId: user.referredById, type: 'earn', amount: 150 }
            })
        );
        console.log(`Awarded 150 referral bonus coins to user ${user.referredById} because ${user.id} ran their 2nd campaign!`);
    }

    await prisma.$transaction(transactionOperations);
    res.json({ success: true });
});

app.post('/api/tasks/start', authenticate, async (req, res) => {
    const { requestId } = req.body;
    // Remove existing active tasks for this user/request to prevent duplicates
    await prisma.activeTask.deleteMany({
        where: { userId: req.user.id, requestId: parseInt(requestId) }
    });
    
    const activeTask = await prisma.activeTask.create({
        data: {
            userId: req.user.id,
            requestId: parseInt(requestId)
        }
    });
    res.json({ success: true, startTime: activeTask.startTime });
});

app.post('/api/upload', authenticate, upload.single('screenshot'), async (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'Screenshot required' });
    const b64 = req.file.buffer.toString('base64');
    const fileUrl = `data:${req.file.mimetype};base64,${b64}`;
    res.json({ success: true, fileUrl });
});

// --- AUTO-VERIFY FOR PTC WEBSITES ---
app.post('/api/submissions/auto-verify', authenticate, async (req, res) => {
    try {
        const { requestId } = req.body;
        const request = await prisma.followRequest.findUnique({ where: { id: parseInt(requestId) } });
        
        if (!request) return res.status(404).json({ error: 'Campaign not found' });
        if (request.type !== 'website') return res.status(400).json({ error: 'Not an auto-verify campaign' });
        if (request.slots_remaining <= 0 || request.status !== 'active') {
            return res.status(400).json({ error: 'This campaign is already full or inactive.' });
        }

        // Check if user already submitted in the last 24 hours
        const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
        const existingSub = await prisma.submission.findFirst({
            where: { 
                requestId: parseInt(requestId), 
                userId: req.user.id,
                createdAt: { gte: twentyFourHoursAgo }
            }
        });
        if (existingSub) {
            return res.status(400).json({ error: 'You have already completed this task in the last 24 hours. Please wait before trying again.' });
        }

        // Ensure VIP users get 10% bonus coins (same as normal tasks)
        const user = await prisma.user.findUnique({ where: { id: req.user.id } });
        let finalReward = request.reward_coins;
        let isVip = false;
        if (user.vipExpiry && new Date(user.vipExpiry) > new Date()) {
            finalReward = Math.ceil(finalReward * 1.1); // 10% bonus
            isVip = true;
        }

        const newStatus = (request.slots_remaining - 1) <= 0 ? 'completed' : 'active';

        // Add coins, decrement slots, and create approved submission
        const [submission] = await prisma.$transaction([
            prisma.submission.create({
                data: {
                    requestId: parseInt(requestId),
                    userId: req.user.id,
                    screenshot_url: 'AUTO_VERIFIED_PTC',
                    status: 'approved'
                }
            }),
            prisma.followRequest.update({
                where: { id: parseInt(requestId) },
                data: { 
                    slots_remaining: { decrement: 1 },
                    status: newStatus
                }
            }),
            prisma.user.update({
                where: { id: req.user.id },
                data: { 
                    coins_balance: { increment: finalReward },
                    totalTasksDone: { increment: 1 },
                    gems: { increment: 1 }
                }
            }),
            prisma.transaction.create({
                data: { userId: req.user.id, type: 'earn', amount: finalReward }
            })
        ]);

        res.json({ success: true, coins: finalReward, isVip });
    } catch(e) {
        console.error("Auto Verify Error:", e);
        res.status(500).json({ error: 'Server error during verification' });
    }
});

app.post('/api/submissions', authenticate, upload.single('screenshot'), async (req, res) => {
    const { requestId } = req.body;
    if (!req.file) return res.status(400).json({ error: 'Screenshot required' });

    const request = await prisma.followRequest.findUnique({ where: { id: parseInt(requestId) } });
    if (!request) return res.status(404).json({ error: 'Campaign not found' });
    if (request.slots_remaining <= 0 || request.status !== 'active') {
        return res.status(400).json({ error: 'This campaign is already full or inactive.' });
    }

    // 24-Hour Duplicate User Check
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const existingUserSub = await prisma.submission.findFirst({
        where: { 
            requestId: parseInt(requestId), 
            userId: req.user.id,
            createdAt: { gte: twentyFourHoursAgo }
        }
    });
    if (existingUserSub) {
        return res.status(400).json({ error: 'You have already submitted a request for this campaign in the last 24 hours.' });
    }

    // Directly accept submission

    const b64 = req.file.buffer.toString('base64');
    const screenshotUrl = `data:${req.file.mimetype};base64,${b64}`;

    // Fraud Check: Ensure this EXACT screenshot hasn't been used before anywhere
    const existingSub = await prisma.submission.findFirst({
        where: { screenshot_url: screenshotUrl }
    });
    
    if (existingSub) {
        return res.status(400).json({ error: 'Fraud Detected: This screenshot has already been used!' });
    }

    // Decrement slots immediately to prevent overbooking
    const newStatus = (request.slots_remaining - 1) <= 0 ? 'completed' : 'active';

    const [submission] = await prisma.$transaction([
        prisma.submission.create({
            data: {
                requestId: parseInt(requestId),
                userId: req.user.id,
                screenshot_url: screenshotUrl
            }
        }),
        prisma.followRequest.update({
            where: { id: parseInt(requestId) },
            data: { 
                slots_remaining: { decrement: 1 },
                status: newStatus
            }
        }),
        prisma.notification.create({
            data: { userId: request.userId, message: `A user has submitted a screenshot for your Campaign #${request.id}. Please review it.` }
        })
    ]);

    res.json(submission);
});

app.get('/api/submissions/mine', authenticate, async (req, res) => {
    const submissions = await prisma.submission.findMany({
        where: { userId: req.user.id },
        include: { request: { include: { platform: true } } },
        orderBy: { createdAt: 'desc' }
    });
    res.json(submissions);
});

app.get('/api/submissions/my-campaigns', authenticate, async (req, res) => {
    const submissions = await prisma.submission.findMany({
        where: { status: 'pending', request: { userId: req.user.id } },
        include: { request: true, user: { select: { name: true } } }
    });
    res.json(submissions);
});

app.get('/api/submissions/pending', authenticate, isAdmin, async (req, res) => {
    const submissions = await prisma.submission.findMany({
        where: { status: 'pending' },
        include: { request: true, user: { select: { name: true } } }
    });
    res.json(submissions);
});

app.patch('/api/submissions/:id/approve', authenticate, async (req, res) => {
    const subId = parseInt(req.params.id);
    const submission = await prisma.submission.findUnique({ where: { id: subId }, include: { request: true } });
    
    if (!submission || submission.status !== 'pending') return res.status(400).json({ error: 'Invalid submission' });
    
    // Check auth: ONLY the Campaign Owner can approve
    if (req.user.id !== submission.request.userId) {
        return res.status(403).json({ error: 'Not authorized to approve this task. Only the campaign owner can do this.' });
    }

    const submitter = await prisma.user.findUnique({ where: { id: submission.userId } });
    let earnedCoins = submission.request.reward_coins;
    if (submitter.isVIP) {
        earnedCoins = Math.floor(earnedCoins * 1.1); // 10% bonus for VIP
    }

    const txs = [
        prisma.submission.update({
            where: { id: subId },
            data: { status: 'approved', reviewed_by: req.user.id }
        }),
        prisma.user.update({
            where: { id: submission.userId },
            data: { 
                coins_balance: { increment: earnedCoins },
                totalTasksDone: { increment: 1 },
                gems: { increment: 1 }
            }
        }),
        prisma.transaction.create({
            data: { userId: submission.userId, type: 'earn', amount: earnedCoins, related_submission_id: subId }
        }),
        prisma.notification.create({
            data: { userId: submission.userId, message: `Your screenshot for Campaign #${submission.request.id} was approved by the owner! +${earnedCoins} coins` }
        })
    ];

    // --- Lifetime MLM Referral Bonus Logic ---
    if (submitter.referredById) {
        const refBonus1 = Math.max(1, Math.floor(earnedCoins * 0.02)); // 2% bonus, min 1 coin
        txs.push(
            prisma.user.update({
                where: { id: submitter.referredById },
                data: { coins_balance: { increment: refBonus1 } }
            }),
            prisma.transaction.create({
                data: { userId: submitter.referredById, type: 'earn', amount: refBonus1, related_submission_id: subId }
            }),
            prisma.notification.create({
                data: { userId: submitter.referredById, message: `You earned ${refBonus1} coins (2% Referral Bonus) from ${submitter.name}'s task!` }
            })
        );
        
        // Level 2 Referral
        const level1 = await prisma.user.findUnique({ where: { id: submitter.referredById } });
        if (level1 && level1.referredById) {
            const refBonus2 = Math.max(1, Math.floor(earnedCoins * 0.02));
            txs.push(
                prisma.user.update({
                    where: { id: level1.referredById },
                    data: { coins_balance: { increment: refBonus2 } }
                }),
                prisma.transaction.create({
                    data: { userId: level1.referredById, type: 'earn', amount: refBonus2, related_submission_id: subId }
                }),
                prisma.notification.create({
                    data: { userId: level1.referredById, message: `You earned ${refBonus2} coins (2% Level 2 Referral Bonus) from ${submitter.name}'s task!` }
                })
            );
        }
    }

    await prisma.$transaction(txs);
    res.json({ success: true });
});

app.patch('/api/submissions/:id/reject', authenticate, async (req, res) => {
    const subId = parseInt(req.params.id);
    const sub = await prisma.submission.findUnique({ where: { id: subId }, include: { request: true } });
    if (!sub || sub.status !== 'pending') return res.status(400).json({ error: 'Invalid submission' });

    // Check auth: ONLY the Campaign Owner can reject
    if (req.user.id !== sub.request.userId) {
        return res.status(403).json({ error: 'Not authorized to reject this task. Only the campaign owner can do this.' });
    }

    // Reject and refund the slot to the campaign
    const [submission] = await prisma.$transaction([
        prisma.submission.update({
            where: { id: subId },
            data: { status: 'rejected', reviewed_by: req.user.id }
        }),
        prisma.followRequest.update({
            where: { id: sub.requestId },
            data: { 
                slots_remaining: { increment: 1 },
                ...(sub.request.status === 'completed' ? { status: 'active' } : {})
            }
        })
    ]);
    res.json(submission);
});

// --- NOTIFICATIONS ---
app.get('/api/notifications', authenticate, async (req, res) => {
    const notifications = await prisma.notification.findMany({
        where: { userId: req.user.id },
        orderBy: { createdAt: 'desc' },
        take: 50
    });
    res.json(notifications);
});

app.patch('/api/notifications/read', authenticate, async (req, res) => {
    await prisma.notification.updateMany({
        where: { userId: req.user.id, isRead: false },
        data: { isRead: true }
    });
    res.json({ success: true });
});

// --- WALLET ---
app.get('/api/wallet/transactions', authenticate, async (req, res) => {
    const transactions = await prisma.transaction.findMany({
        where: { userId: req.user.id },
        orderBy: { timestamp: 'desc' }
    });
    res.json(transactions);
});

// --- ADMIN ---
app.get('/api/admin/users', authenticate, isAdmin, async (req, res) => {
    const users = await prisma.user.findMany({
        select: { id: true, name: true, email: true, role: true, coins_balance: true, status: true, createdAt: true, totalCampaignsRun: true, totalTasksDone: true, lastSeen: true, country: true },
        orderBy: { createdAt: 'desc' }
    });
    res.json(users);
});

app.patch('/api/admin/users/:id/ban', authenticate, isAdmin, async (req, res) => {
    const user = await prisma.user.update({
        where: { id: parseInt(req.params.id) },
        data: { status: 'banned' }
    });
    res.json(user);
});

app.post('/api/admin/users/:id/add-coins', authenticate, isAdmin, async (req, res) => {
    try {
        let amount = parseInt(req.body.amount);
        if (isNaN(amount) || amount <= 0) return res.status(400).json({ error: 'Invalid amount' });
        // Cap addition to prevent 32-bit INT overflow (Max ~2.1B)
        if (amount > 100000000) amount = 100000000;

        const userId = parseInt(req.params.id);
        const user = await prisma.user.update({
            where: { id: userId },
            data: { coins_balance: { increment: amount } }
        });
        await prisma.transaction.create({
            data: { userId, type: 'earn', amount }
        });
        res.json(user);
    } catch (e) {
        console.error("Add coins error:", e);
        res.status(500).json({ error: 'Failed to add coins. Value might be too large.' });
    }
});

// --- ADVANCED FEATURES ---
app.post('/api/users/daily-bonus', authenticate, async (req, res) => {
    const user = await prisma.user.findUnique({ where: { id: req.user.id } });
    const now = new Date();
    
    // Convert to start of day for easy comparison
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    let newStreak = user.currentStreak;
    let reward = 5; // Default day 1

    if (user.lastCheckInDate) {
        const lastCheckIn = new Date(user.lastCheckInDate);
        const lastCheckInDay = new Date(lastCheckIn.getFullYear(), lastCheckIn.getMonth(), lastCheckIn.getDate());
        
        const diffDays = Math.round((today - lastCheckInDay) / (1000 * 60 * 60 * 24));
        
        if (diffDays === 0) {
            return res.status(400).json({ error: 'You already claimed your reward today. Come back tomorrow!' });
        } else if (diffDays === 1) {
            // Consecutive day
            newStreak = (newStreak % 7) + 1; // 1 to 7
        } else {
            // Missed a day
            newStreak = 1;
        }
    } else {
        newStreak = 1;
    }

    // Calculate reward based on streak
    const rewardsMap = { 1: 5, 2: 10, 3: 15, 4: 20, 5: 25, 6: 30, 7: 50 };
    reward = rewardsMap[newStreak] || 5;

    const updatedUser = await prisma.user.update({
        where: { id: user.id },
        data: { 
            coins_balance: { increment: reward }, 
            lastCheckInDate: now,
            currentStreak: newStreak
        }
    });
    
    await prisma.transaction.create({
        data: { userId: user.id, type: 'earn', amount: reward }
    });

    res.json({ success: true, message: `Day ${newStreak} Claimed! +${reward} coins`, streak: newStreak, coins: updatedUser.coins_balance });
});

app.get('/api/users/streak', authenticate, async (req, res) => {
    const user = await prisma.user.findUnique({ where: { id: req.user.id } });
    res.json({ currentStreak: user.currentStreak, lastCheckInDate: user.lastCheckInDate });
});

app.post('/api/users/update-profile', authenticate, async (req, res) => {
    const { name } = req.body;
    if (!name) return res.status(400).json({ error: 'Name is required' });
    const updatedUser = await prisma.user.update({
        where: { id: req.user.id },
        data: { name }
    });
    res.json({ success: true, user: updatedUser });
});

app.post('/api/users/change-password', authenticate, async (req, res) => {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) return res.status(400).json({ error: 'Missing fields' });
    
    const user = await prisma.user.findUnique({ where: { id: req.user.id } });
    // Note: In a real app we would verify currentPassword with bcrypt.
    // For this mockup, if password_hash is not null, we just check equality.
    if (user.password_hash && user.password_hash !== currentPassword) {
        return res.status(400).json({ error: 'Incorrect current password' });
    }
    
    await prisma.user.update({
        where: { id: req.user.id },
        data: { password_hash: newPassword }
    });
    res.json({ success: true });
});

app.post('/api/submissions/:id/report', authenticate, async (req, res) => {
    const submissionId = parseInt(req.params.id);
    const { reason } = req.body;
    
    const submission = await prisma.submission.findUnique({
        where: { id: submissionId },
        include: { request: true }
    });
    
    if (!submission) return res.status(404).json({ error: 'Submission not found' });
    if (submission.userId !== req.user.id) return res.status(403).json({ error: 'Not your submission' });
    
    const report = await prisma.report.create({
        data: {
            reporterId: req.user.id,
            targetUserId: submission.request.userId,
            submissionId: submission.id,
            reason: reason || 'Unfair rejection'
        }
    });
    
    res.json({ success: true, report });
});

app.post('/api/requests/:id/report', authenticate, async (req, res) => {
    const requestId = parseInt(req.params.id);
    const { reason } = req.body;
    
    const campaign = await prisma.followRequest.findUnique({
        where: { id: requestId }
    });
    
    if (!campaign) return res.status(404).json({ error: 'Campaign not found' });
    
    const report = await prisma.report.create({
        data: {
            reporterId: req.user.id,
            targetUserId: campaign.userId,
            reason: `Campaign #${campaign.id}: ${reason}`
        }
    });
    res.json({ success: true, report });
});

app.get('/api/admin/reports', authenticate, async (req, res) => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin only' });
    const reports = await prisma.report.findMany({
        include: { 
            reporter: { select: { name: true } }, 
            targetUser: { select: { name: true } }
        },
        orderBy: { createdAt: 'desc' }
    });
    res.json(reports);
});

app.patch('/api/admin/reports/:id/resolve', authenticate, async (req, res) => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin only' });
    const reportId = parseInt(req.params.id);
    await prisma.report.update({
        where: { id: reportId },
        data: { status: 'resolved' }
    });
    res.json({ success: true });
});

// Admin Deposit Endpoints
app.get('/api/admin/deposits', authenticate, async (req, res) => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin only' });
    const deposits = await prisma.deposit.findMany({
        orderBy: { createdAt: 'desc' },
        include: { user: { select: { name: true, email: true, id: true, uiId: true } } }
    });
    res.json(deposits);
});

app.patch('/api/admin/deposits/:id/approve', authenticate, async (req, res) => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin only' });
    const depositId = parseInt(req.params.id);
    
    const deposit = await prisma.deposit.findUnique({ where: { id: depositId } });
    if (!deposit || deposit.status !== 'pending') return res.status(400).json({ error: 'Invalid or already processed deposit' });

    await prisma.$transaction([
        prisma.deposit.update({
            where: { id: depositId },
            data: { status: 'approved' }
        }),
        prisma.user.update({
            where: { id: deposit.userId },
            data: { coins_balance: { increment: deposit.amount } }
        }),
        prisma.transaction.create({
            data: { userId: deposit.userId, type: 'earn', amount: deposit.amount }
        }),
        prisma.notification.create({
            data: {
                userId: deposit.userId,
                message: `Your payment of ${deposit.price} was approved. You received ${deposit.amount} coins!`
            }
        })
    ]);
    res.json({ success: true });
});

app.post('/api/admin/broadcast', authenticate, isAdmin, async (req, res) => {
    try {
        const { subject, message } = req.body;
        if (!subject || !message) return res.status(400).json({ error: 'Subject and message are required' });

        const users = await prisma.user.findMany({
            where: { status: 'active', role: 'user' },
            select: { email: true }
        });

        const emails = users.map(u => u.email).filter(e => e);

        if (emails.length === 0) {
            return res.status(400).json({ error: 'No active users found to send email to.' });
        }

        const transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
                user: process.env.EMAIL_USER,
                pass: process.env.EMAIL_PASS
            }
        });

        const mailOptions = {
            from: process.env.EMAIL_USER,
            bcc: emails,
            subject: subject,
            html: `<div style="font-family: Arial, sans-serif; padding: 20px; color: #333;">
                      <h2 style="color: #ff4757;">Admin Broadcast</h2>
                      <p>${message.replace(/\n/g, '<br>')}</p>
                      <br>
                      <p style="font-size: 0.8rem; color: #777;">This is an automated message from the Follow & Earn Admin.</p>
                   </div>`
        };

        await transporter.sendMail(mailOptions);
        res.json({ success: true, count: emails.length });
    } catch (error) {
        console.error('Email Broadcast Error:', error);
        res.status(500).json({ error: 'Failed to send broadcast. Check email credentials in .env' });
    }
});

app.patch('/api/admin/deposits/:id/reject', authenticate, async (req, res) => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin only' });
    const depositId = parseInt(req.params.id);
    
    const deposit = await prisma.deposit.findUnique({ where: { id: depositId } });
    if (!deposit || deposit.status !== 'pending') return res.status(400).json({ error: 'Invalid or already processed deposit' });

    await prisma.$transaction([
        prisma.deposit.update({
            where: { id: depositId },
            data: { status: 'rejected' }
        }),
        prisma.notification.create({
            data: {
                userId: deposit.userId,
                message: `Your recent payment request was rejected. Please contact support if you think this is an error.`
            }
        })
    ]);
    res.json({ success: true });
});

app.post('/api/store/creem-checkout', authenticate, async (req, res) => {
    const { amount, price } = req.body;
    
    // We expect the frontend to pass the correct product_id or we map it here.
    // For now, since we don't have product IDs, we map them:
    const PRODUCT_MAP = {
        1000: process.env.CREEM_PROD_1000 || 'prod_placeholder_1000',
        5000: process.env.CREEM_PROD_5000 || 'prod_placeholder_5000'
    };
    
    const productId = PRODUCT_MAP[amount];
    if (!productId) return res.status(400).json({ error: 'Invalid coin amount package.' });

    try {
        const response = await fetch('https://api.creem.io/v1/checkouts', {
            method: 'POST',
            headers: {
                'x-api-key': process.env.CREEM_API_KEY || 'creem_3nf4iwV0KxXopRcZlJYqz',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                product_id: productId,
                success_url: req.headers.origin + '/?creem_session_id={CHECKOUT_SESSION_ID}&amount=' + amount,
                metadata: {
                    userId: req.user.id,
                    amount: amount,
                    price: price
                }
            })
        });

        const data = await response.json();
        if (!response.ok) {
            console.error('Creem checkout error:', data);
            return res.status(500).json({ error: 'Payment gateway error', details: data });
        }

        res.json({ checkout_url: data.checkout_url, session_id: data.id });
    } catch (e) {
        console.error('Creem error:', e);
        res.status(500).json({ error: 'Failed to create checkout session' });
    }
});

app.post('/api/store/creem-verify', authenticate, async (req, res) => {
    const { session_id, amount } = req.body;
    if (!session_id) return res.status(400).json({ error: 'Session ID required' });

    try {
        // Fetch session status from Creem
        const response = await fetch(`https://api.creem.io/v1/checkouts/${session_id}`, {
            method: 'GET',
            headers: {
                'x-api-key': process.env.CREEM_API_KEY || 'creem_3nf4iwV0KxXopRcZlJYqz'
            }
        });

        const session = await response.json();
        if (!response.ok) return res.status(400).json({ error: 'Failed to verify session' });

        // Ensure it's paid
        if (session.status !== 'paid' && session.status !== 'completed' && session.status !== 'succeeded') {
            return res.status(400).json({ error: 'Payment is not completed yet.' });
        }

        // Prevent double crediting
        const existing = await prisma.deposit.findFirst({ where: { txId: session_id } });
        if (existing) {
            return res.json({ success: true, message: 'Already credited' });
        }

        const coinsToAdd = parseInt(amount) || parseInt(session.metadata?.amount) || 0;
        if (coinsToAdd <= 0) return res.status(400).json({ error: 'Invalid amount' });

        const [user] = await prisma.$transaction([
            prisma.user.update({
                where: { id: req.user.id },
                data: { coins_balance: { increment: coinsToAdd } }
            }),
            prisma.deposit.create({
                data: {
                    userId: req.user.id,
                    amount: coinsToAdd,
                    price: parseFloat(session.metadata?.price || 0),
                    method: 'creem',
                    txId: session_id,
                    status: 'approved'
                }
            }),
            prisma.transaction.create({
                data: { userId: req.user.id, type: 'earn', amount: coinsToAdd }
            }),
            prisma.notification.create({
                data: { userId: req.user.id, message: `Your Credit/Debit Card payment was successful! +${coinsToAdd} coins` }
            })
        ]);

        res.json({ success: true, coins: user.coins_balance });

    } catch (e) {
        console.error('Creem verify error:', e);
        res.status(500).json({ error: 'Server error during verification' });
    }
});

app.post('/api/store/buy-vip', authenticate, async (req, res) => {
    const VIP_COST = 500; // Define VIP cost
    const user = await prisma.user.findUnique({ where: { id: req.user.id } });
    
    if (user.isVIP) return res.status(400).json({ error: 'You are already a VIP' });
    if (user.coins_balance < VIP_COST) return res.status(400).json({ error: 'Insufficient coins. You need 500 coins to become VIP.' });
    
    await prisma.$transaction([
        prisma.user.update({
            where: { id: req.user.id },
            data: { 
                coins_balance: { decrement: VIP_COST },
                isVIP: true
            }
        }),
        prisma.transaction.create({
            data: { userId: req.user.id, type: 'spend', amount: VIP_COST }
        })
    ]);
    res.json({ success: true });
});

app.post('/api/store/deposit', authenticate, async (req, res) => {
    const { amount, price, method, txId, proofImg } = req.body;
    if (!amount || !price || !method || !txId) {
        return res.status(400).json({ error: 'Missing required fields' });
    }

    if (method === 'jazzcash' || method === 'easypaisa') {
        if (!/^\d{11,12}$/.test(txId)) {
            return res.status(400).json({ error: 'Invalid TID. JazzCash/Easypaisa TID must be 11 or 12 digits.' });
        }
    } else if (method === 'binance') {
        if (!/^[A-Za-z0-9]{10,64}$/.test(txId)) {
            return res.status(400).json({ error: 'Invalid TXID. Binance TXID must be alphanumeric.' });
        }
    }
    const deposit = await prisma.deposit.create({
        data: {
            userId: req.user.id,
            amount: parseInt(amount),
            price: parseFloat(price),
            method,
            txId,
            proofImg
        }
    });

    // Notify Admins
    const admins = await prisma.user.findMany({ where: { role: 'admin' } });
    if (admins.length > 0) {
        await prisma.notification.createMany({
            data: admins.map(a => ({
                userId: a.id,
                message: `New Deposit of ${amount} coins received from User #${req.user.id}`
            }))
        });
    }

    res.json({ success: true, deposit });
});

app.post('/api/users/heartbeat', authenticate, async (req, res) => {
    await prisma.user.update({
        where: { id: req.user.id },
        data: { lastSeen: new Date() }
    });
    res.json({ success: true });
});

app.get('/api/leaderboard', async (req, res) => {
    const vips = await prisma.user.findMany({ where: { isVIP: true }, select: { id: true, name: true, coins_balance: true }, take: 10 });
    const topEarners = await prisma.user.findMany({ orderBy: { coins_balance: 'desc' }, select: { id: true, name: true, totalTasksDone: true, coins_balance: true }, take: 10 });
    const topPromoters = await prisma.user.findMany({ orderBy: { totalCampaignsRun: 'desc' }, select: { id: true, name: true, totalCampaignsRun: true }, take: 10 });
    
    res.json({ vips, topEarners, topPromoters });
});

app.get('/api/chat', authenticate, async (req, res) => {
    let messages = await prisma.chat.findMany({
        take: 50,
        orderBy: { createdAt: 'desc' },
        include: { user: { select: { id: true, name: true, role: true, isVIP: true } } }
    });
    res.json(messages.reverse());
});

app.post('/api/chat', authenticate, async (req, res) => {
    const { message } = req.body;
    if (!message || message.trim().length === 0) return res.status(400).json({ error: 'Message cannot be empty' });
    
    const chat = await prisma.chat.create({
        data: { userId: req.user.id, message: message.trim() },
        include: { user: { select: { id: true, name: true, role: true, isVIP: true } } }
    });
    res.json(chat);
});

app.post('/api/submissions/auto-view', authenticate, async (req, res) => {
    const { requestId } = req.body;
    
    // 30-Second Verification Check
    const activeTask = await prisma.activeTask.findFirst({
        where: { userId: req.user.id, requestId: parseInt(requestId) },
        orderBy: { startTime: 'desc' }
    });

    if (!activeTask) return res.status(400).json({ error: 'Task not started' });

    const secondsPassed = (new Date() - new Date(activeTask.startTime)) / 1000;
    if (secondsPassed < 30) {
        return res.status(400).json({ error: `You only waited ${Math.floor(secondsPassed)} seconds. Must wait 30 seconds.` });
    }

    // Clean up active task
    await prisma.activeTask.delete({ where: { id: activeTask.id } });

    // Check if user already submitted in the last 24 hours
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const existingSub = await prisma.submission.findFirst({
        where: { 
            requestId: parseInt(requestId), 
            userId: req.user.id,
            createdAt: { gte: twentyFourHoursAgo }
        }
    });
    if (existingSub) {
        return res.status(400).json({ error: 'You have already completed this task in the last 24 hours.' });
    }

    // Directly award coins (Auto Approve for Views)
    const request = await prisma.followRequest.findUnique({ where: { id: parseInt(requestId) } });
    
    await prisma.$transaction([
        prisma.submission.create({
            data: {
                requestId: parseInt(requestId),
                userId: req.user.id,
                screenshot_url: 'AUTO_VIEW',
                status: 'approved',
                reviewed_by: 0
            }
        }),
        prisma.user.update({
            where: { id: req.user.id },
            data: { 
                coins_balance: { increment: request.reward_coins },
                totalTasksDone: { increment: 1 }
            }
        }),
        prisma.transaction.create({
            data: { userId: req.user.id, type: 'earn', amount: request.reward_coins }
        }),
        prisma.followRequest.update({
            where: { id: parseInt(requestId) },
            data: { slots_remaining: { decrement: 1 } }
        })
    ]);
    res.json({ success: true, reward: request.reward_coins });
});

// --- METADATA PROXY ---
app.get('/api/metadata', authenticate, async (req, res) => {
    try {
        const { url } = req.query;
        if (!url) return res.status(400).json({ error: 'URL is required' });

        // Simple fetch using native fetch
        const response = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            }
        });
        
        if (!response.ok) return res.status(response.status).json({ error: 'Failed to fetch URL' });
        
        const html = await response.text();
        
        // Extract title
        let title = '';
        const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
        if (titleMatch) title = titleMatch[1].trim();

        // Extract og:image
        let image = '';
        const ogImageMatch = html.match(/<meta[^>]*property=["']og:image["'][^>]*content=["']([^"']+)["'][^>]*>/i) || 
                             html.match(/<meta[^>]*content=["']([^"']+)["'][^>]*property=["']og:image["'][^>]*>/i);
        if (ogImageMatch) image = ogImageMatch[1].trim();

        res.json({ title, image });
    } catch(e) {
        console.error('Metadata fetch error:', e);
        res.status(500).json({ error: 'Failed to fetch metadata' });
    }
});

// --- BACKGROUND JOBS ---
// 24-Hour Auto-Approve (runs every 10 minutes)
setInterval(async () => {
    try {
        const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
        const expiredSubmissions = await prisma.submission.findMany({
            where: { status: 'pending', createdAt: { lt: twentyFourHoursAgo } },
            include: { request: true }
        });
        
        for (const sub of expiredSubmissions) {
            await prisma.$transaction([
                prisma.submission.update({ where: { id: sub.id }, data: { status: 'approved', reviewed_by: 0 } }),
                prisma.user.update({
                    where: { id: sub.userId },
                    data: { 
                        coins_balance: { increment: sub.request.reward_coins },
                        totalTasksDone: { increment: 1 },
                        gems: { increment: 1 }
                    }
                }),
                prisma.transaction.create({
                    data: { userId: sub.userId, type: 'earn', amount: sub.request.reward_coins, related_submission_id: sub.id }
                }),
                prisma.followRequest.update({
                    where: { id: sub.requestId },
                    data: { slots_remaining: { decrement: 1 } }
                })
            ]);
        }
        if (expiredSubmissions.length > 0) console.log(`Auto-approved ${expiredSubmissions.length} expired submissions.`);
    } catch(e) {
        console.error("Auto-approve error:", e);
    }
}, 10 * 60 * 1000);

// Monthly Bonus Cron (runs daily to check if it's the 1st of the month)
setInterval(async () => {
    const now = new Date();
    if (now.getDate() === 1) {
        try {
            // Find the top user by totalCampaignsRun + totalTasksDone who hasn't gotten a bonus this month
            const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
            const topUser = await prisma.user.findFirst({
                where: { OR: [ { lastMonthlyBonus: null }, { lastMonthlyBonus: { lt: startOfMonth } } ] },
                orderBy: [ { totalCampaignsRun: 'desc' }, { totalTasksDone: 'desc' } ]
            });
            
            if (topUser && (topUser.totalCampaignsRun > 0 || topUser.totalTasksDone > 0)) {
                await prisma.user.update({
                    where: { id: topUser.id },
                    data: { coins_balance: { increment: 500 }, lastMonthlyBonus: now }
                });
                await prisma.transaction.create({
                    data: { userId: topUser.id, type: 'earn', amount: 500 }
                });
                console.log(`Awarded Monthly Bonus to ${topUser.name}`);
            }
        } catch(e) {
            console.error("Monthly bonus error:", e);
        }
    }
}, 24 * 60 * 60 * 1000); // Check once a day

// Auto-Approve Pending Submissions
setInterval(async () => {
    try {
        const pendingSubs = await prisma.submission.findMany({
            where: { status: 'pending' },
            include: { request: true }
        });
        
        const now = new Date();
        for (const sub of pendingSubs) {
            const hoursPassed = (now - new Date(sub.createdAt)) / (1000 * 60 * 60);
            const autoApproveHours = sub.request.auto_approve_hours || 24;
            
            if (hoursPassed >= autoApproveHours) {
                // Auto-approve
                await prisma.$transaction([
                    prisma.submission.update({
                        where: { id: sub.id },
                        data: { status: 'approved', reviewed_by: 0 } // 0 or null signifies auto-approved
                    }),
                    prisma.user.update({
                        where: { id: sub.userId },
                        data: { 
                            coins_balance: { increment: sub.request.reward_coins },
                            totalTasksDone: { increment: 1 },
                            gems: { increment: 1 }
                        }
                    }),
                    prisma.transaction.create({
                        data: {
                            userId: sub.userId,
                            type: 'earn',
                            amount: sub.request.reward_coins,
                            related_submission_id: sub.id
                        }
                    }),
                    prisma.notification.create({
                        data: {
                            userId: sub.userId,
                            message: `Your screenshot for Campaign #${sub.request.id} was auto-approved! +${sub.request.reward_coins} coins`
                        }
                    })
                ]);
                console.log(`Auto-approved submission ${sub.id} (passed ${autoApproveHours}h)`);
            }
        }
    } catch(e) {
        console.error("Auto-approve error:", e);
    }
}, 5 * 60 * 1000); // Check every 5 minutes

// Data Cleanup: Delete submissions, deposits, and direct orders older than 15 days
setInterval(async () => {
    try {
        const fifteenDaysAgo = new Date();
        fifteenDaysAgo.setDate(fifteenDaysAgo.getDate() - 15);

        // 1. Clean up Submissions
        const oldSubmissions = await prisma.submission.findMany({
            where: { createdAt: { lt: fifteenDaysAgo }, status: { in: ['approved', 'rejected'] } }
        });
        for (const sub of oldSubmissions) {
            if (sub.screenshot_url && sub.screenshot_url.startsWith('/uploads/')) {
                const filePath = path.join(__dirname, sub.screenshot_url);
                if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
            }
            await prisma.submission.delete({ where: { id: sub.id } });
        }
        if (oldSubmissions.length > 0) console.log(`Data Cleanup: Deleted ${oldSubmissions.length} old submissions.`);

        // 2. Clean up Deposits
        const oldDeposits = await prisma.deposit.findMany({
            where: { createdAt: { lt: fifteenDaysAgo }, status: { in: ['approved', 'rejected'] } }
        });
        for (const dep of oldDeposits) {
            if (dep.proofImg && dep.proofImg.startsWith('/uploads/')) {
                const filePath = path.join(__dirname, dep.proofImg);
                if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
            }
            await prisma.deposit.delete({ where: { id: dep.id } });
        }
        if (oldDeposits.length > 0) console.log(`Data Cleanup: Deleted ${oldDeposits.length} old deposits.`);

        // 3. Clean up Direct Orders
        const oldOrders = await prisma.directOrder.findMany({
            where: { createdAt: { lt: fifteenDaysAgo }, status: { in: ['completed', 'rejected'] } }
        });
        for (const ord of oldOrders) {
            if (ord.proofImg && ord.proofImg.startsWith('/uploads/')) {
                const filePath = path.join(__dirname, ord.proofImg);
                if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
            }
            await prisma.directOrder.delete({ where: { id: ord.id } });
        }
        if (oldOrders.length > 0) console.log(`Data Cleanup: Deleted ${oldOrders.length} old direct orders.`);

    } catch(e) {
        console.error("Data cleanup error:", e);
    }
}, 24 * 60 * 60 * 1000); // Check once a day

app.post('/api/store/direct-order', authenticate, async (req, res) => {
    const { platform, pkgName, price, method, txId, proofImg, targetUrl } = req.body;
    if (!platform || !pkgName || !price || !method || !txId || !targetUrl) {
        return res.status(400).json({ error: 'Missing required fields' });
    }

    if (method === 'jazzcash' || method === 'easypaisa') {
        if (!/^\d{11,12}$/.test(txId)) {
            return res.status(400).json({ error: 'Invalid TID. JazzCash/Easypaisa TID must be 11 or 12 digits.' });
        }
    } else if (method === 'binance') {
        if (!/^[A-Za-z0-9]{10,64}$/.test(txId)) {
            return res.status(400).json({ error: 'Invalid TXID. Binance TXID must be alphanumeric.' });
        }
    }
    try {
        const order = await prisma.directOrder.create({
            data: {
                userId: req.user.id,
                platform,
                package: pkgName,
                price: parseFloat(price),
                method,
                txId,
                proofImg,
                targetUrl
            }
        });
        
        // Notify Admins
        const admins = await prisma.user.findMany({ where: { role: 'admin' } });
        if (admins.length > 0) {
            await prisma.notification.createMany({
                data: admins.map(a => ({
                    userId: a.id,
                    message: `New Direct Order received from User #${req.user.id} (${pkgName})`
                }))
            });
        }
        
        res.json({ message: 'Order submitted successfully', order });
    } catch (err) {
        res.status(500).json({ error: 'Server error' });
    }
});

// ----------------------------------------------------
// AUTO-APPROVE CRON JOB ENDPOINT (For Vercel)
// ----------------------------------------------------
app.get('/api/cron/auto-approve', async (req, res) => {
    try {
        const pendingSubmissions = await prisma.submission.findMany({
            where: { status: 'pending' },
            include: { request: true }
        });
        const now = new Date();
        for (const sub of pendingSubmissions) {
            const hoursDiff = (now - new Date(sub.createdAt)) / (1000 * 60 * 60);
            if (hoursDiff >= sub.request.auto_approve_hours) {
                // Auto-approve this submission
                const submitter = await prisma.user.findUnique({ where: { id: sub.userId } });
                if (!submitter) continue;
                let earnedCoins = sub.request.reward_coins;
                if (submitter.isVIP) earnedCoins = Math.floor(earnedCoins * 1.1);

                await prisma.$transaction([
                    prisma.submission.update({
                        where: { id: sub.id },
                        data: { status: 'approved', reviewed_by: 0 } // 0 or null indicating auto
                    }),
                    prisma.user.update({
                        where: { id: sub.userId },
                        data: { coins_balance: { increment: earnedCoins }, totalTasksDone: { increment: 1 }, gems: { increment: 1 } }
                    }),
                    prisma.transaction.create({
                        data: { userId: sub.userId, type: 'earn', amount: earnedCoins, related_submission_id: sub.id }
                    }),
                    prisma.notification.create({
                        data: { userId: sub.userId, message: `Your screenshot for Campaign #${sub.request.id} was auto-approved! +${earnedCoins} coins` }
                    })
                ]);
                console.log(`Auto-approved submission ${sub.id}`);
            }
        }
        res.status(200).json({ message: 'Cron job executed successfully' });
    } catch (e) {
        console.error('Error in auto-approve cron:', e);
        res.status(500).json({ error: 'Cron error' });
    }
});

// --- Other Apps (Sidebar Links) ---
app.get('/api/other-apps', async (req, res) => {
    try {
        const apps = await prisma.otherApp.findMany({ orderBy: { createdAt: 'desc' } });
        res.json(apps);
    } catch (e) {
        res.status(500).json({ error: 'Failed to fetch apps' });
    }
});

app.post('/api/other-apps', authenticate, async (req, res) => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin only' });
    const { name, url } = req.body;
    if (!name || !url) return res.status(400).json({ error: 'Name and URL required' });
    try {
        const newApp = await prisma.otherApp.create({ data: { name, url } });
        res.json(newApp);
    } catch (e) {
        res.status(500).json({ error: 'Failed to add app' });
    }
});

app.delete('/api/other-apps/:id', authenticate, async (req, res) => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin only' });
    try {
        await prisma.otherApp.delete({ where: { id: parseInt(req.params.id) } });
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: 'Failed to delete app' });
    }
});

// --- Tutorial Links (How to Work) ---
app.get('/api/tutorial-links', async (req, res) => {
    try {
        const links = await prisma.tutorialLink.findMany({ orderBy: { createdAt: 'desc' } });
        res.json(links);
    } catch (e) {
        res.status(500).json({ error: 'Failed to fetch tutorial links' });
    }
});

app.post('/api/tutorial-links', authenticate, async (req, res) => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin only' });
    const { title, url } = req.body;
    if (!title || !url) return res.status(400).json({ error: 'Title and URL required' });
    try {
        const newLink = await prisma.tutorialLink.create({ data: { title, url } });
        res.json(newLink);
    } catch (e) {
        res.status(500).json({ error: 'Failed to add tutorial link' });
    }
});

app.delete('/api/tutorial-links/:id', authenticate, async (req, res) => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin only' });
    try {
        await prisma.tutorialLink.delete({ where: { id: parseInt(req.params.id) } });
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: 'Failed to delete tutorial link' });
    }
});

// --- WALLET: CONVERT & WITHDRAW ---
app.post('/api/wallet/convert', authenticate, async (req, res) => {
    try {
        const { gemsToConvert } = req.body;
        const amount = parseInt(gemsToConvert);
        if (isNaN(amount) || amount <= 0) return res.status(400).json({ error: 'Invalid amount' });

        const user = await prisma.user.findUnique({ where: { id: req.user.id } });
        if (user.gems < amount) return res.status(400).json({ error: 'Insufficient Gems' });

        const coinsToAdd = amount * 5; // 1 Gem = 5 Coins

        await prisma.$transaction([
            prisma.user.update({
                where: { id: user.id },
                data: { 
                    gems: { decrement: amount },
                    coins_balance: { increment: coinsToAdd }
                }
            }),
            prisma.transaction.create({
                data: { userId: user.id, type: 'earn', amount: coinsToAdd }
            })
        ]);

        res.json({ success: true, convertedGems: amount, receivedCoins: coinsToAdd });
    } catch(e) {
        console.error('Convert Error:', e);
        res.status(500).json({ error: 'Server error during conversion' });
    }
});

app.post('/api/wallet/withdraw', authenticate, async (req, res) => {
    try {
        const { method, details } = req.body;
        if (!method || !details) return res.status(400).json({ error: 'Method and details required' });

        const user = await prisma.user.findUnique({ where: { id: req.user.id } });
        
        // Ensure they have exactly or more than 5000 gems
        if (user.gems < 5000) return res.status(400).json({ error: 'Minimum 5000 Gems required for withdrawal' });

        const withdrawalAmountGems = 5000;
        const amountUsd = 5.00;

        await prisma.$transaction([
            prisma.user.update({
                where: { id: user.id },
                data: { gems: { decrement: withdrawalAmountGems } }
            }),
            prisma.withdrawalRequest.create({
                data: {
                    userId: user.id,
                    gems: withdrawalAmountGems,
                    amountUsd: amountUsd,
                    method: method,
                    details: details
                }
            })
        ]);

        res.json({ success: true, message: 'Withdrawal request submitted successfully' });
    } catch(e) {
        console.error('Withdrawal Error:', e);
        res.status(500).json({ error: 'Server error during withdrawal' });
    }
});


const PORT = process.env.PORT || 5000;

if (typeof require !== 'undefined' && require.main === module) {
    app.listen(PORT, () => {
        console.log(`Server running on port ${PORT}`);
    });
} else if (process.env.NODE_ENV !== 'production' && typeof process.env.VERCEL === 'undefined') {
    // Fallback for local development using ESM
    app.listen(PORT, () => {
        console.log(`Server running on port ${PORT}`);
    });
}

export default app;

//

//

// ==========================================
// LemonSqueezy Integration
// ==========================================

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
        const { coins, priceUsd, directOrder } = req.body;
        const user = await prisma.user.findUnique({ where: { id: req.userId } });
        if (!user) return res.status(404).json({ error: 'User not found' });

        const storeId = process.env.LEMONSQUEEZY_STORE_ID || '419815';

        const customData = {
            user_id: user.id.toString(),
            coins: (coins || 0).toString()
        };

        let productName = `${(coins||0).toLocaleString()} Coins - FollowEarn`;
        let productDesc = `Purchase ${(coins||0).toLocaleString()} coins for your FollowEarn campaigns.`;
        
        if (directOrder) {
            customData.direct_platform = directOrder.platform;
            customData.direct_pkg = directOrder.pkgName;
            customData.direct_url = directOrder.targetUrl;
            customData.direct_price = priceUsd.toString();
            productName = `Direct Order - ${directOrder.pkgName} (${directOrder.platform})`;
            productDesc = `Purchase ${directOrder.pkgName} for ${directOrder.targetUrl}`;
        }

        const payload = {
            data: {
                type: 'checkouts',
                attributes: {
                    custom_price: Math.round(priceUsd * 100),
                    product_options: {
                        name: productName,
                        description: productDesc,
                        receipt_button_text: 'Return to App',
                        receipt_link_url: 'https://viraloop.website',
                        receipt_thank_you_note: 'Thank you for your purchase!'
                    },
                    checkout_options: {
                        embed: false,
                        media: false,
                        button_color: '#ffd700'
                    },
                    checkout_data: {
                        email: user.email || '',
                        name: user.name || '',
                        custom: customData
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
            return res.status(400).json({ error: 'No products found in your LemonSqueezy store.' });
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
            if (customData && customData.user_id) {
                const userId = parseInt(customData.user_id);
                
                if (customData.direct_platform) {
                    await prisma.directOrder.create({
                        data: {
                            userId: userId,
                            platform: customData.direct_platform,
                            package: customData.direct_pkg,
                            price: parseFloat(customData.direct_price),
                            method: 'lemonsqueezy',
                            txId: payload.data.id,
                            proofImg: null,
                            targetUrl: customData.direct_url,
                            status: 'pending'
                        }
                    });
                    
                    const admins = await prisma.user.findMany({ where: { role: 'admin' } });
                    if (admins.length > 0) {
                        await prisma.notification.createMany({
                            data: admins.map(a => ({
                                userId: a.id,
                                message: `New automatic direct order placed for ${customData.direct_pkg}!`
                            }))
                        });
                    }
                    console.log(`Webhook: Created direct order for user ${userId}`);
                } else if (customData.coins) {
                    const coinsToAdd = parseInt(customData.coins);
                    if (coinsToAdd > 0) {
                        await prisma.user.update({
                            where: { id: userId },
                            data: { coins_balance: { increment: coinsToAdd } }
                        });
                        console.log(`Webhook: Added ${coinsToAdd} coins to user ${userId}`);
                    }
                }
            }
        }

        res.status(200).send('Webhook received');
    } catch (err) {
        console.error('Webhook error:', err);
        res.status(500).send('Webhook handling error');
    }
});
