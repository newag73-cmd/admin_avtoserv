import { db } from "../src/lib/db";
async function main() { await db.$connect(); console.log("Database ready; business defaults are stored in data/business.json"); }
main().finally(() => db.$disconnect());
