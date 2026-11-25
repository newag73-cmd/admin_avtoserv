const { spawnSync } = require("node:child_process");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const prismaCli = path.join(root, "node_modules/prisma/build/index.js");

function generate(schema, url, directUrl = url) {
  const env = { ...process.env, DATABASE_URL: url, DATABASE_URL_UNPOOLED: directUrl };
  const result = spawnSync(process.execPath, [prismaCli, "generate", "--schema", schema], {
    cwd: root,
    env,
    stdio: "inherit",
    shell: false,
  });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}

generate("prisma/schema.prisma", "file:./dev.db");
const layeroUrl = process.env.LAYERO_DATABASE_URL || "postgresql://build:build@127.0.0.1:5432/build?schema=public";
generate("prisma/layero/schema.prisma", layeroUrl, process.env.DATABASE_URL_UNPOOLED || layeroUrl);
