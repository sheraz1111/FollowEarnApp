import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
    console.log('Seeding Database...');
    
    // Clear existing data (optional, for safety we can just insert if not exists)
    // await prisma.transaction.deleteMany();
    // await prisma.submission.deleteMany();
    // await prisma.followRequest.deleteMany();
    // await prisma.platform.deleteMany();
    // await prisma.user.deleteMany();

    // Create platforms
    const platforms = ['TikTok', 'Instagram', 'Facebook', 'YouTube', 'Rumble'];
    for (const name of platforms) {
        await prisma.platform.upsert({
            where: { name },
            update: {},
            create: { name }
        });
    }

    // Create admin user
    const adminPassword = await bcrypt.hash('admin123', 10);
    const adminUser = await prisma.user.upsert({
        where: { email: 'admin@followearn.test' },
        update: {},
        create: {
            name: 'Super Admin',
            email: 'admin@followearn.test',
            password_hash: adminPassword,
            role: 'admin',
            coins_balance: 99999
        }
    });

    // Create test user
    const userPassword = await bcrypt.hash('user123', 10);
    const testUser = await prisma.user.upsert({
        where: { email: 'user@followearn.test' },
        update: {},
        create: {
            name: 'Test User',
            email: 'user@followearn.test',
            password_hash: userPassword,
            role: 'user',
            coins_balance: 100
        }
    });

    // Create demo request
    const igPlatform = await prisma.platform.findUnique({ where: { name: 'Instagram' } });
    if (igPlatform) {
        await prisma.followRequest.create({
            data: {
                userId: adminUser.id,
                platformId: igPlatform.id,
                target_link: 'https://instagram.com/testpage',
                reward_coins: 5,
                slots_remaining: 50,
                status: 'active'
            }
        });
    }

    console.log('Seeding completed.');
}

main()
    .catch(e => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
