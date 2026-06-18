const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
    console.log("Connecting...");
    const user = await prisma.user.findFirst();
    console.log("User:", user);
}
main().catch(console.error).finally(() => prisma.$disconnect());
