import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
async function main() { await prisma.$connect(); console.log("Database ready; business defaults are stored in data/business.json"); }
main().finally(() => prisma.$disconnect());
