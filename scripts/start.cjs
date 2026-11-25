const { spawn, spawnSync } = require("node:child_process");
const { copyFileSync, existsSync, mkdirSync } = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
if (!process.env.DATABASE_URL && typeof process.loadEnvFile === "function") {
  try { process.loadEnvFile(path.join(root, ".env")); } catch {}
}
if (!process.env.DATABASE_URL && process.env.LAYERO_DATABASE_URL) process.env.DATABASE_URL = process.env.LAYERO_DATABASE_URL;

if (process.env.DATA_DIR) {
  mkdirSync(process.env.DATA_DIR, { recursive: true });
  for (const file of ["business.json", "system-prompt.txt", "system-prompt.default.txt"]) {
    const target = path.join(process.env.DATA_DIR, file);
    if (!existsSync(target)) copyFileSync(path.join(root, "data", file), target);
  }
}

function runMigration() {
  const result = spawnSync(process.execPath, [path.join(root, "scripts/migrate.cjs"), "--optional"], {
    cwd: root, env: process.env, stdio: "inherit", shell: false,
  });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}

runMigration();
const server = spawn(process.execPath, [path.join(root, "node_modules/next/dist/bin/next"), "start", "-H", "0.0.0.0", "-p", process.env.PORT || "3000"], {
  cwd: root, env: process.env, stdio: "inherit", shell: false,
});
for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => server.kill(signal));
server.on("exit", (code, signal) => process.exit(code ?? (signal ? 1 : 0)));
