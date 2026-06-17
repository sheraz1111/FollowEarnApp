import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';

const prisma = new PrismaClient();

async function main() {
    const users = await prisma.user.findMany({ where: { referralCode: null } });
    for (const user of users) {
        const code = crypto.randomBytes(4).toString('hex').toUpperCase();
        await prisma.user.update({
            where: { id: user.id },
            data: { referralCode: code }
        });
        console.log(`Updated user ${user.name} with code ${code}`);
    }
    console.log("Done updating referral codes!");
}
main();
