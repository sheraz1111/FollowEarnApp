import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
    try {
        await prisma.$executeRawUnsafe('UPDATE User SET coins_balance = 1000000 WHERE coins_balance > 2000000000');
        console.log("Fixed!");
    } catch(e) {
        console.error(e);
    }
}
main();
