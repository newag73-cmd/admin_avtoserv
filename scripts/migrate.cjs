const { spawnSync } = require("node:child_process");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const optional = process.argv.includes("--optional");
if (!process.env.DATABASE_URL && typeof process.loadEnvFile === "function") {
  try { process.loadEnvFile(path.join(root, ".env")); } catch {}
}

if (!process.env.DATABASE_URL && process.env.LAYERO_DATABASE_URL) process.env.DATABASE_URL = process.env.LAYERO_DATABASE_URL;
const url = process.env.DATABASE_URL || "";
if (!process.env.DATABASE_URL_UNPOOLED) process.env.DATABASE_URL_UNPOOLED = url;
let schema;
if (url.startsWith("file:")) schema = "prisma/schema.prisma";
else if (url.startsWith("postgres://") || url.startsWith("postgresql://")) schema = "prisma/layero/schema.prisma";
else if (optional) {
  console.warn("database_migrations_skipped reason=database_url_not_configured");
  process.exit(0);
} else {
  console.error("Set DATABASE_URL to a SQLite or PostgreSQL connection string.");
  process.exit(1);
}

const result = spawnSync(process.execPath, [
  path.join(root, "node_modules/prisma/build/index.js"), "migrate", "deploy", "--schema", schema,
], { cwd: root, env: process.env, stdio: "inherit", shell: false });
if (result.error) throw result.error;
process.exit(result.status ?? 1);
