const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const deposits = await prisma.deposit.findMany({
        orderBy: { createdAt: 'desc' },
        take: 5,
        include: { user: true }
    });
    console.log(JSON.stringify(deposits, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
