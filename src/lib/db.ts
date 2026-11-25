import { PrismaClient as SqlitePrismaClient } from "@prisma/client";
import { PrismaClient as LayeroPrismaClient } from "@/generated/layero";
import { PrismaNeon } from "@prisma/adapter-neon";

const layeroUrl = process.env.LAYERO_DATABASE_URL;
if (!process.env.DATABASE_URL && layeroUrl) process.env.DATABASE_URL = layeroUrl;

const databaseUrl = process.env.DATABASE_URL;
const useLayero = Boolean(layeroUrl || databaseUrl?.startsWith("postgres://") || databaseUrl?.startsWith("postgresql://"));
const globalForPrisma = globalThis as unknown as {
  prisma?: SqlitePrismaClient;
  layeroPrisma?: LayeroPrismaClient;
};

const selectedClient = useLayero
  ? (globalForPrisma.layeroPrisma ?? new LayeroPrismaClient({ adapter: new PrismaNeon({ connectionString: databaseUrl! }) }))
  : (globalForPrisma.prisma ?? new SqlitePrismaClient());

if (process.env.NODE_ENV !== "production") {
  if (useLayero) globalForPrisma.layeroPrisma = selectedClient as LayeroPrismaClient;
  else globalForPrisma.prisma = selectedClient as SqlitePrismaClient;
}

// Both generated Prisma clients expose the same application models.
export const db = selectedClient as unknown as SqlitePrismaClient;
export const databaseConfigured = Boolean(databaseUrl);
